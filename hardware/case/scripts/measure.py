#!/usr/bin/env python3
"""
STL을 실제로 고치기 전에, 먼저 "무엇이 어디에 있는지"를 숫자로 뽑아낸다.

이 스크립트는 원본 STL을 건드리지 않는다(읽기 전용). 화면으로 보이는 넓고 평평한
영역, 버튼처럼 튀어나온 작은 돌기 군집을 자동으로 찾아 좌표를 출력하고, 그 후보를
색으로 표시한 앞면 미리보기 이미지를 저장한다. 사람이 그 이미지를 보고 어느 번호가
실제 화면/버튼인지 확인한 뒤 features.json 에 옮겨 적는다 — 완전 자동이 아니라
"측정 + 사람 확인" 이다.

사용법:
    python3 measure.py hardware/case/original/bmo_base.stl
    python3 measure.py hardware/case/original/bmo_base.stl --front-axis y

옵션:
    --front-axis {x,y,z}   정면이 향하는 축 (기본: y). 미리보기 이미지를 보고
                            앞모습이 아니면 x/z로 바꿔가며 다시 실행한다.
    --front-sign {+,-}     정면 축의 방향 (기본: +)
    --plane-angle-deg N    이 각도(기본 10도) 안에 있는 면들을 "평평한 화면 후보"로 묶는다
    --bump-height N        이 높이(mm, 기본 0.6) 이상 튀어나온 부분을 "버튼 후보"로 본다
    --out DIR              결과 이미지 저장 위치 (기본: hardware/case/generated/)
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import trimesh


AXIS_INDEX = {"x": 0, "y": 1, "z": 2}


def load_mesh(path: Path) -> trimesh.Trimesh:
    mesh = trimesh.load(path, force="mesh")
    if not isinstance(mesh, trimesh.Trimesh):
        sys.exit(f"메시를 읽지 못했다 (여러 개체가 섞여 있을 수 있음): {path}")
    if not mesh.is_watertight:
        print("경고: 메시가 완전히 막혀 있지 않다(watertight 아님). "
              "치수 측정은 문제없지만 나중에 불리언 연산(fit_internals.py)에서 "
              "실패할 수 있다 — 그때는 mesh.fill_holes() 나 슬라이서의 '복구' 기능을 써야 한다.")
    return mesh


def bounding_box_report(mesh: trimesh.Trimesh) -> dict:
    dims = mesh.bounds[1] - mesh.bounds[0]
    return {
        "min_mm": mesh.bounds[0].round(2).tolist(),
        "max_mm": mesh.bounds[1].round(2).tolist(),
        "size_mm": dims.round(2).tolist(),
        "volume_mm3": round(mesh.volume, 1),
    }


def find_planar_patches(mesh: trimesh.Trimesh, front_axis: int, front_sign: int,
                         angle_deg: float, min_area_mm2: float = 20.0):
    """정면을 향하는 면들 중, 서로 이어져 있고 방향이 비슷한 덩어리(화면 후보)를 찾는다."""
    target = np.zeros(3)
    target[front_axis] = front_sign
    cos_thresh = np.cos(np.radians(angle_deg))

    facing = mesh.face_normals @ target > cos_thresh
    if not facing.any():
        return []

    # 이어진 면들끼리 묶는다 (같은 화면 오목/양각이면 서로 인접해 있다)
    adjacency = mesh.face_adjacency
    mask_pair = facing[adjacency[:, 0]] & facing[adjacency[:, 1]]
    graph_edges = adjacency[mask_pair]

    import scipy.sparse as sp
    import scipy.sparse.csgraph as csgraph

    n = len(mesh.faces)
    if len(graph_edges) == 0:
        labels = np.where(facing, np.arange(n), -1)
    else:
        g = sp.coo_matrix((np.ones(len(graph_edges)), (graph_edges[:, 0], graph_edges[:, 1])),
                           shape=(n, n))
        n_comp, labels = csgraph.connected_components(g, directed=False)
        labels = np.where(facing, labels, -1)

    patches = []
    for label in set(labels.tolist()) - {-1}:
        face_idx = np.where(labels == label)[0]
        if len(face_idx) < 1:
            continue
        area = mesh.area_faces[face_idx].sum()
        if area < min_area_mm2:
            continue
        verts = mesh.vertices[np.unique(mesh.faces[face_idx])]
        other_axes = [i for i in range(3) if i != front_axis]
        extent = verts[:, other_axes].max(0) - verts[:, other_axes].min(0)
        center = verts.mean(0)
        patches.append({
            "area_mm2": round(float(area), 1),
            "center_mm": center.round(2).tolist(),
            "extent_mm": {["x", "y", "z"][other_axes[0]]: round(float(extent[0]), 2),
                          ["x", "y", "z"][other_axes[1]]: round(float(extent[1]), 2)},
            "face_count": int(len(face_idx)),
        })
    patches.sort(key=lambda p: -p["area_mm2"])
    return patches


def find_bump_clusters(mesh: trimesh.Trimesh, front_axis: int, front_sign: int,
                        bump_height_mm: float, angle_deg: float = 60.0):
    """정면 쪽으로 튀어나온 작은 돌기(버튼 후보)를 찾는다."""
    target = np.zeros(3)
    target[front_axis] = front_sign
    cos_thresh = np.cos(np.radians(angle_deg))
    facing = mesh.face_normals @ target > cos_thresh
    if not facing.any():
        return []

    coord = mesh.vertices[:, front_axis] * front_sign
    # 중앙값(대체로 몸통 표면)보다 bump_height_mm 이상 튀어나온 면만 "돌출부 후보"로 본다
    baseline = np.percentile(coord, 50)
    threshold = baseline + bump_height_mm
    if coord.max() - baseline < bump_height_mm:
        return []  # 표면이 전체적으로 평평해서 뚜렷한 돌기가 없다

    face_coord = coord[mesh.faces].mean(axis=1)
    is_bump_face = facing & (face_coord >= threshold)
    if not is_bump_face.any():
        return []

    adjacency = mesh.face_adjacency
    mask_pair = is_bump_face[adjacency[:, 0]] & is_bump_face[adjacency[:, 1]]
    graph_edges = adjacency[mask_pair]

    import scipy.sparse as sp
    import scipy.sparse.csgraph as csgraph

    n = len(mesh.faces)
    if len(graph_edges) == 0:
        labels = np.where(is_bump_face, np.arange(n), -1)
    else:
        g = sp.coo_matrix((np.ones(len(graph_edges)), (graph_edges[:, 0], graph_edges[:, 1])),
                           shape=(n, n))
        n_comp, labels = csgraph.connected_components(g, directed=False)
        labels = np.where(is_bump_face, labels, -1)

    clusters = []
    for label in set(labels.tolist()) - {-1}:
        face_idx = np.where(labels == label)[0]
        if len(face_idx) < 2:
            continue
        verts = mesh.vertices[np.unique(mesh.faces[face_idx])]
        other_axes = [i for i in range(3) if i != front_axis]
        extent = verts[:, other_axes].max(0) - verts[:, other_axes].min(0)
        diameter = float(max(extent))
        # 버튼치고 너무 크면(팔·다리 등) 후보에서 뺀다
        if diameter > 25.0 or diameter < 1.0:
            continue
        center = verts.mean(0)
        clusters.append({
            "center_mm": center.round(2).tolist(),
            "approx_diameter_mm": round(diameter, 2),
            "height_above_surface_mm": round(float(face_coord[face_idx].max() - baseline), 2),
        })
    clusters.sort(key=lambda c: c["center_mm"][2] if front_axis != 2 else c["center_mm"][1])
    return clusters


def save_preview(mesh: trimesh.Trimesh, front_axis: int, front_sign: int,
                  patches: list, bumps: list, out_path: Path):
    import matplotlib.pyplot as plt

    other_axes = [i for i in range(3) if i != front_axis]
    labels = ["X", "Y", "Z"]
    verts2d = mesh.vertices[:, other_axes]

    fig, ax = plt.subplots(figsize=(6, 8))
    ax.scatter(verts2d[::7, 0], verts2d[::7, 1], s=0.4, color="#888888", alpha=0.35,
               label="mesh surface (sampled)")

    for i, p in enumerate(patches[:5]):
        c = p["center_mm"]
        cx, cy = [c[ax_] for ax_ in other_axes]
        ax.scatter([cx], [cy], s=p["area_mm2"] * 2, alpha=0.25, color="tab:blue")
        ax.annotate(f"screen#{i} area={p['area_mm2']}mm²", (cx, cy), fontsize=8, color="tab:blue")

    for i, b in enumerate(bumps[:20]):
        c = b["center_mm"]
        cx, cy = [c[ax_] for ax_ in other_axes]
        ax.scatter([cx], [cy], s=60, color="tab:red", marker="x")
        ax.annotate(f"btn#{i}", (cx, cy), fontsize=7, color="tab:red")

    ax.set_xlabel(labels[other_axes[0]] + " (mm)")
    ax.set_ylabel(labels[other_axes[1]] + " (mm)")
    ax.set_title(f"front projection (axis={labels[front_axis]}{'+' if front_sign > 0 else '-'})")
    ax.set_aspect("equal")
    ax.legend(loc="upper right", fontsize=8)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=150)
    print(f"미리보기 저장: {out_path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stl_path", type=Path)
    ap.add_argument("--front-axis", choices=["x", "y", "z"], default="y")
    ap.add_argument("--front-sign", choices=["+", "-"], default="+")
    ap.add_argument("--plane-angle-deg", type=float, default=10.0)
    ap.add_argument("--bump-height", type=float, default=0.6)
    ap.add_argument("--out", type=Path, default=Path("hardware/case/generated"))
    args = ap.parse_args()

    if not args.stl_path.exists():
        sys.exit(f"파일이 없다: {args.stl_path}\n"
                  f"STL을 hardware/case/original/bmo_base.stl 로 먼저 올려야 한다.")

    mesh = load_mesh(args.stl_path)
    front_axis = AXIS_INDEX[args.front_axis]
    front_sign = 1 if args.front_sign == "+" else -1

    bbox = bounding_box_report(mesh)
    print("=== 전체 치수 ===")
    print(json.dumps(bbox, ensure_ascii=False, indent=2))

    patches = find_planar_patches(mesh, front_axis, front_sign, args.plane_angle_deg)
    print(f"\n=== 화면 후보 (평평한 정면 영역, {len(patches)}개) ===")
    for i, p in enumerate(patches[:5]):
        print(f"  screen#{i}: 면적={p['area_mm2']}mm²  중심={p['center_mm']}  크기={p['extent_mm']}")
    if not patches:
        print("  없음 — --front-axis 를 바꿔서 다시 시도하거나 --plane-angle-deg 를 키워본다.")

    bumps = find_bump_clusters(mesh, front_axis, front_sign, args.bump_height)
    print(f"\n=== 버튼(돌기) 후보 ({len(bumps)}개) ===")
    for i, b in enumerate(bumps[:20]):
        print(f"  btn#{i}: 중심={b['center_mm']}  지름≈{b['approx_diameter_mm']}mm  "
              f"높이≈{b['height_above_surface_mm']}mm")
    if not bumps:
        print("  없음 — --bump-height 를 낮춰서 다시 시도해본다 (예: --bump-height 0.3).")

    save_preview(mesh, front_axis, front_sign, patches, bumps, args.out / "preview_candidates.png")

    print("\n다음 단계: 위 preview_candidates.png 를 실제 BMO 사진과 비교해서 "
          "screen#N 과 btn#N 중 진짜 화면/버튼이 어느 것인지 확인하고, "
          "hardware/case/scripts/features.json 에 그 좌표를 옮겨 적는다.")


if __name__ == "__main__":
    main()

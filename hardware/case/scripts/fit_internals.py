#!/usr/bin/env python3
"""
features.json 좌표를 기준으로 원본 STL을 실제로 깎는다.

원칙: 원본의 바깥 표면(실루엣·화면 창 모양·버튼 위치/모양)은 절대 건드리지 않는다.
전부 원본이 이미 뒤쪽으로 파둔 오목한 자리(스크린 베젤 바닥, 버튼 포켓 바닥, 팔 소켓)
안에서만, 안쪽 방향으로 작업한다.

이 스크립트가 하는 일:
  1. front-plate: 화면 베젤 바닥과 실배선 버튼 2곳의 "바닥 아래 남은 살"을 뚫어서
     뒤에서 OLED/스위치가 닿을 수 있게 한다 (원본 앞모습은 그대로 유지된다 —
     이미 원본 자체가 그 자리를 오목하게 파놓았고, 우리는 그 뒤에 남은 얇은 벽만
     제거한다).
  2. front-plate: 뒷판을 고정할 나사 구멍을 기존 체결 지점(버튼박스 파스너 5곳 +
     모서리 마운트 4곳)에 새로 뚫는다.
  3. 팔 2개: 어깨 스텁의 블라인드 사각 소켓을, 같은 자리에서 3.2mm 관통 축 구멍으로
     다시 뚫는다.
  4. 뒷판: 원본에 없으므로 새로 만든다 (프리미티브 조합, 불리언 없음). 서보 축 받침,
     체결 보스, 케이블 개구부를 포함한다.

전부 features.json 의 scale_to_target 배율을 적용한 뒤 진행한다.

사용법:
    python3 fit_internals.py
"""
import json
from pathlib import Path

import numpy as np
import trimesh

HERE = Path(__file__).parent
ORIG = HERE.parent / "original"
GEN = HERE.parent / "generated"
FEATURES = json.loads((HERE / "features.json").read_text())

SCALE = FEATURES["scale_to_target"]["factor"]

# 원본 파일마다 이름에 공백이 하나 더 있는 등 표기가 살짝 다르다 — 여기서 흡수한다.
FILES = {
    "front": "bmo-front-plate.stl",
    "arm1": "BMO Arm 1.stl",
    "arm2": "BMO Arm 2.stl",
}

BOOLEAN_ENGINE = "manifold"


def load_scaled(key: str) -> trimesh.Trimesh:
    path = ORIG / FILES[key]
    if not path.exists():
        raise SystemExit(f"원본 파일이 없다: {path}")
    mesh = trimesh.load(path, force="mesh")
    mesh.apply_scale(SCALE)
    return mesh


def s(v):
    """스칼라/좌표에 축척을 곱한다."""
    return np.asarray(v, dtype=float) * SCALE


def box_tool(center_xy, size_xy, z_lo, z_hi, margin=0.5):
    """z_lo~z_hi 구간을 뚫는 사각 절삭 도구. 경계면 겹침 오류를 피하려고 margin만큼
    위아래로 살짝 여유를 준다."""
    cx, cy = center_xy
    w, h = size_xy
    depth = (z_hi - z_lo) + 2 * margin
    box = trimesh.creation.box(extents=[w, h, depth])
    box.apply_translation([cx, cy, (z_lo + z_hi) / 2])
    return box


def cylinder_tool(center_xy, diameter, z_lo, z_hi, margin=0.5, sections=24):
    cx, cy = center_xy
    depth = (z_hi - z_lo) + 2 * margin
    cyl = trimesh.creation.cylinder(radius=diameter / 2, height=depth, sections=sections)
    cyl.apply_translation([cx, cy, (z_lo + z_hi) / 2])
    return cyl


def cut(mesh: trimesh.Trimesh, tools: list) -> trimesh.Trimesh:
    if not tools:
        return mesh
    result = trimesh.boolean.difference([mesh] + tools, engine=BOOLEAN_ENGINE)
    if isinstance(result, list):
        result = trimesh.util.concatenate(result)
    return result


# ---------------------------------------------------------------------------
# 1~2. front-plate 가공
# ---------------------------------------------------------------------------
def fit_front_plate() -> trimesh.Trimesh:
    front = load_scaled("front")
    tools = []

    # --- 화면: 절삭 불필요 ---
    # contains() 샘플링으로 실측 확인: bezel_outer(109x79mm) 영역은 z=0~4 구간이
    # 테두리 바로 안쪽부터 이미 전부 비어 있다(내부 비율 0%). find_planar_patches가
    # 찾은 z=4 "패치"는 얇은 테두리 리브 정도였던 것으로 보인다. 즉 화면 창은
    # 원본에서 이미 뒤까지 뚫려 있어서 우리가 따로 뚫을 게 없다 — OLED+아크릴을
    # 이 자리에 바로 마운트하면 된다.

    # --- 버튼 2곳: 각 버튼 포켓 바닥(z=2) 아래 남은 살을 뚫어 스위치가 닿게 한다.
    #     구멍은 버튼 자체보다 작게 뚫어서 버튼이 빠지지 않게 한다 (짧은 변의 60%). ---
    for name in ("green", "blue"):
        b = FEATURES["buttons_wired"][name]
        cx, cy, floor_z = s(b["center_mm"])
        w, h = s(b["size_mm"])
        hole_d = min(w, h) * 0.6
        tools.append(cylinder_tool((cx, cy), hole_d, z_lo=0, z_hi=floor_z))

    # --- 뒷판 체결용 나사 구멍: 기존 체결 지점 좌표를 그대로 재사용 ---
    mounts = FEATURES["back_panel"]["reuse_mount_points_mm"]
    screw_pts = mounts["button_box_fasteners"] + mounts["corner_mounts"]
    plate_h = FEATURES["front_plate_bounds_mm"]["max"][2] * SCALE
    for pt in screw_pts:
        cx, cy = s(pt)
        tools.append(cylinder_tool((cx, cy), diameter=1.8, z_lo=0, z_hi=plate_h))

    return cut(front, tools)


# ---------------------------------------------------------------------------
# 3. 팔: 블라인드 사각 소켓 -> 3.2mm 관통 축 구멍
# ---------------------------------------------------------------------------
def fit_arm(key: str, local: dict) -> trimesh.Trimesh:
    arm = load_scaled(key)
    axle_d = FEATURES["arm_axle"]["diameter_mm"]  # 서보 축 지름은 우리가 정한 고정값(3.2mm) — 스케일 대상 아님

    cx, cz = s(local["stub_center_xz"])
    y_bounds = arm.bounds[:, 1]
    y_lo, y_hi = y_bounds[0] - 1.0, y_bounds[1] + 1.0  # 확실히 완전 관통하도록 넉넉히

    cyl = trimesh.creation.cylinder(radius=axle_d / 2, height=(y_hi - y_lo), sections=24)
    # 실린더 기본 축은 Z 방향 -> 팔의 삽입축(로컬 Y)에 맞춰 X축 기준 -90도 회전
    cyl.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
    cyl.apply_translation([cx, (y_lo + y_hi) / 2, cz])

    return cut(arm, [cyl])


# ---------------------------------------------------------------------------
# 4. 뒷판: 원본에 없음 — 프리미티브로 새로 설계
# ---------------------------------------------------------------------------
# 부품 실측 치수는 hardware/case/README.md §2 표를 따른다.
BACK_PANEL_DEPTH_MM = 20.0     # 서보는 축이 X방향이라 두께(12mm)만 차지 — 30mm는 과했다
WALL_MM = 2.0
BOSS_OUTER_D = 6.0
SCREW_HOLE_D = 2.2              # M2 태핑용 파일럿 홀

TRAY_BACK_Z = -(BACK_PANEL_DEPTH_MM - WALL_MM)  # 트레이 안쪽 벽면(뒤쪽) z좌표. 스탠드오프는 여기서 앞으로(z+) 자란다.

# --- 부품별 마운트 스펙 (전부 "1차 배치안" — 실물 확보 후 조정 필수) ---
OLED_FOOTPRINT_MM = (32.0, 17.0)     # SSD1306 모듈 대략 크기 + 여유
OLED_TARGET_Z = -3.0                  # 화면 창(z=0)에서 3mm만 뒤로 — 시야각 확보
BOARD_FOOTPRINT_MM = (27.0, 52.0)     # ESP32-S3 개발보드 + 여유, 세로로 배치
BOARD_TARGET_Z = -12.0                # 커넥터·배선 여유를 위해 좀 더 뒤로
BOARD_OFFSET_XY = (-18.0, -12.0)      # 화면·버튼과 안 겹치는 좌측 자리 (1차 배치안)
BUTTON_SWITCH_FOOTPRINT_MM = (10.0, 10.0)
BUTTON_SWITCH_TARGET_Z = -4.0         # 버튼 포켓 바닥 바로 뒤 (스위치 액추에이터가 닿을 정도)
SERVO_BODY_MM = (23.0, 12.2)          # SG90: (샤프트 축 방향 길이, 두께). 높이(29mm)는 Y방향이라
                                       # 화면-버튼 사이 공간에 맞는지 실물로 반드시 확인할 것
CABLE_EXIT_W, CABLE_EXIT_H = 20.0, 10.0


def corner_standoffs(center_xy, footprint_xy, target_z, margin=3.0):
    """부품 4귀퉁이에 스탠드오프 기둥 4개 + 나사 파일럿홀을 만든다.
    기둥은 TRAY_BACK_Z(뒤쪽 안쪽 벽)에서 target_z까지 자란다."""
    cx, cy = center_xy
    w, h = footprint_xy
    height = target_z - TRAY_BACK_Z
    if height <= 0:
        raise ValueError(f"target_z({target_z})가 뒷벽({TRAY_BACK_Z})보다 뒤에 있다")
    xs = [cx - w / 2 + margin, cx + w / 2 - margin]
    ys = [cy - h / 2 + margin, cy + h / 2 - margin]
    parts = []
    for x in xs:
        for y in ys:
            peg = trimesh.creation.cylinder(radius=BOSS_OUTER_D / 2.2 / 2, height=height, sections=16)
            peg.apply_translation([x, y, TRAY_BACK_Z + height / 2])
            hole = trimesh.creation.cylinder(radius=SCREW_HOLE_D / 2, height=height + 2, sections=12)
            hole.apply_translation([x, y, TRAY_BACK_Z + height / 2])
            peg = trimesh.boolean.difference([peg, hole], engine=BOOLEAN_ENGINE)
            parts.append(peg)
    return parts


def build_back_panel() -> trimesh.Trimesh:
    """
    front-plate 뒷면에 붙는 상자형 뒷판.
      - 외곽: front-plate 실루엣보다 살짝 안쪽으로 들어간 사각 트레이(첫 버전 — 실측 후
        정밀 실루엣으로 교체 예정. 지금은 스크린/버튼 클러스터를 덮는 영역만 우선 커버)
      - 서보 축 받침: 팔 축 좌표 2곳의 높이(z)에 맞춰 베어링 보스 2개
      - 체결 보스: 기존 9개 지점 재사용
      - 하단 케이블 개구부

    OLED/개발보드/버튼스위치 스탠드오프와 서보 포켓, 하단 케이블 개구부까지 포함한다.
    좌표는 전부 1차 배치안 — 파일 상단 상수들을 실물 치수로 갱신하면서 재생성하는
    것을 전제로 한다.
    """
    bounds = FEATURES["front_plate_bounds_mm"]
    x0, y0 = s(bounds["min"][:2])
    x1, y1 = s(bounds["max"][:2])

    # 화면·버튼 클러스터를 전부 덮는 영역만 우선 커버 (몸통 하단 절반은 원본에 없는
    # 다리 연결부라 여기서 다루지 않는다). 세로로 화면 베젤부터 버튼 아래까지.
    tray_y0 = s(FEATURES["screen"]["bezel_outer"]["center_mm"][1]) - s(FEATURES["screen"]["bezel_outer"]["height_mm"]) / 2 - s(10)
    tray_y1 = s(FEATURES["buttons_dummy_reference"]["red"]["center_mm"][1]) + s(FEATURES["buttons_dummy_reference"]["red"]["size_mm"][1]) / 2 + s(10)
    tray_x0, tray_x1 = x0 + s(5), x1 - s(5)

    outer_w = tray_x1 - tray_x0
    outer_h = tray_y1 - tray_y0
    cx, cy = (tray_x0 + tray_x1) / 2, (tray_y0 + tray_y1) / 2

    # 바깥 상자에서 안쪽을 파내 벽 두께 WALL_MM 만 남긴 트레이를 만든다
    outer = trimesh.creation.box(extents=[outer_w, outer_h, BACK_PANEL_DEPTH_MM])
    inner = trimesh.creation.box(
        extents=[outer_w - 2 * WALL_MM, outer_h - 2 * WALL_MM, BACK_PANEL_DEPTH_MM - WALL_MM]
    )
    inner.apply_translation([0, 0, WALL_MM])  # 앞쪽(front-plate와 맞닿는 쪽)은 뚫려 있어야 한다
    tray = trimesh.boolean.difference([outer, inner], engine=BOOLEAN_ENGINE)
    tray.apply_translation([cx, cy, -BACK_PANEL_DEPTH_MM / 2])  # front-plate 뒷면(z=0)에서 뒤로

    parts = [tray]

    # --- 체결 보스 (원기둥 + 나사 파일럿홀) ---
    mounts = FEATURES["back_panel"]["reuse_mount_points_mm"]
    for pt in mounts["button_box_fasteners"] + mounts["corner_mounts"]:
        bx, by = s(pt)
        if not (tray_x0 <= bx <= tray_x1 and tray_y0 <= by <= tray_y1):
            continue  # 이번 v1 트레이 범위 밖(예: 다리 쪽) 마운트는 다음 버전에서 다룬다
        boss = trimesh.creation.cylinder(radius=BOSS_OUTER_D / 2, height=WALL_MM * 2, sections=20)
        boss.apply_translation([bx, by, -WALL_MM])
        hole = trimesh.creation.cylinder(radius=SCREW_HOLE_D / 2, height=WALL_MM * 4, sections=16)
        hole.apply_translation([bx, by, -WALL_MM])
        boss = trimesh.boolean.difference([boss, hole], engine=BOOLEAN_ENGINE)
        parts.append(boss)

    # --- 서보 축 받침: 팔 축 두 점의 높이(z)를 그대로 따라가는 베어링 보스 한 쌍 ---
    # 팔 로컬 좌표(x,z)를 몸통 좌표로 그대로 옮기는 정확한 변환식은 아직 없다
    # (몸통 쪽 소켓 짝이 원본에 없어서). 우선 화면·버튼 클러스터 중간 높이를
    # 잠정값으로 쓴다 — 실물 사진과 대조해 조정해야 한다 (TODO, 아래 출력 참고).
    axle_y_world = (s(FEATURES["screen"]["bezel_outer"]["center_mm"][1]) +
                    s(FEATURES["buttons_wired"]["blue"]["center_mm"][1])) / 2
    for side, x_edge in (("left", tray_x0), ("right", tray_x1)):
        bearing = trimesh.creation.cylinder(radius=BOSS_OUTER_D / 2, height=WALL_MM * 3, sections=20)
        bearing.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
        bearing.apply_translation([x_edge, axle_y_world, -WALL_MM * 1.5])
        axle_hole = trimesh.creation.cylinder(radius=1.7, height=WALL_MM * 6, sections=16)
        axle_hole.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
        axle_hole.apply_translation([x_edge, axle_y_world, -WALL_MM * 1.5])
        bearing = trimesh.boolean.difference([bearing, axle_hole], engine=BOOLEAN_ENGINE)
        parts.append(bearing)

    # --- OLED 스탠드오프: 화면 창(이미 뚫려 있음) 바로 뒤, 3mm 만 물러난 자리 ---
    screen_center = s(FEATURES["screen"]["bezel_outer"]["center_mm"][:2])
    parts += corner_standoffs(screen_center, OLED_FOOTPRINT_MM, OLED_TARGET_Z)

    # --- 개발보드 스탠드오프: 화면·버튼과 안 겹치는 좌측 자리 (1차 배치안) ---
    board_center = (screen_center[0] + BOARD_OFFSET_XY[0], screen_center[1] + BOARD_OFFSET_XY[1])
    parts += corner_standoffs(board_center, BOARD_FOOTPRINT_MM, BOARD_TARGET_Z)

    # --- 버튼 스위치 마운트: green/blue 좌표 바로 뒤 ---
    for name in ("green", "blue"):
        b = FEATURES["buttons_wired"][name]
        btn_center = s(b["center_mm"][:2])
        parts += corner_standoffs(btn_center, BUTTON_SWITCH_FOOTPRINT_MM, BUTTON_SWITCH_TARGET_Z, margin=2.0)

    # --- 서보 포켓: 축 받침 사이, 화면과 D패드 사이의 좁은 틈에 얹는 라이즈드 블록 +
    #     서보 몸체가 딱 끼워지는 포켓. 폭(SERVO_BODY_MM[0])이 두 축 받침 사이 거리보다
    #     작아야 한다 — 실행 끝에 자동으로 확인해서 경고를 찍는다. ---
    servo_len, servo_thick = SERVO_BODY_MM
    servo_block = trimesh.creation.box(extents=[servo_len + 4, servo_thick + 4, WALL_MM * 3])
    servo_block.apply_translation([0, axle_y_world, TRAY_BACK_Z + WALL_MM * 1.5])
    servo_pocket = trimesh.creation.box(extents=[servo_len, servo_thick, WALL_MM * 3 + 1])
    servo_pocket.apply_translation([0, axle_y_world, TRAY_BACK_Z + WALL_MM * 1.5])
    servo_block = trimesh.boolean.difference([servo_block, servo_pocket], engine=BOOLEAN_ENGINE)
    parts.append(servo_block)

    axle_span = (tray_x1 - BOSS_OUTER_D) - (tray_x0 + BOSS_OUTER_D)
    if servo_len + 4 > axle_span:
        print(f"[경고] 서보 포켓 폭({servo_len+4:.1f}mm)이 두 축 받침 사이 거리"
              f"({axle_span:.1f}mm)보다 크다 — 서보가 안 들어간다. SERVO_BODY_MM 이나 "
              f"트레이 폭을 조정할 것.")

    # --- 하단 케이블 개구부: 트레이 바닥(아래쪽 짧은 변)에 사각 구멍 ---
    cable_hole = trimesh.creation.box(extents=[CABLE_EXIT_W, WALL_MM * 4, CABLE_EXIT_H])
    cable_hole.apply_translation([0, tray_y0, -BACK_PANEL_DEPTH_MM / 2])
    tray_with_exit = trimesh.boolean.difference([parts[0], cable_hole], engine=BOOLEAN_ENGINE)
    parts[0] = tray_with_exit

    result = trimesh.util.concatenate(parts)

    print(f"[TODO] 서보 축 받침 높이를 잠정값 y={axle_y_world:.1f}mm 으로 두었다. "
          f"실제 어깨 위치는 팔 파츠에만 있고 몸통 쪽 소켓이 원본에 없어서 추정치다 — "
          f"조립 전에 실물/사진과 대조해서 back_panel.stl 을 다시 생성할 것.")
    print(f"[TODO] OLED/보드/버튼스위치 스탠드오프는 전부 1차 배치안이다. 부품이 도착하면 "
          f"실물 치수로 OLED_FOOTPRINT_MM/BOARD_FOOTPRINT_MM/... 값을 갱신하고 다시 생성할 것.")

    return result


# ---------------------------------------------------------------------------
def main():
    GEN.mkdir(parents=True, exist_ok=True)

    print("front-plate 가공 중...")
    front = fit_front_plate()
    front.export(GEN / "front_plate_final.stl")
    print(f"  저장: {GEN / 'front_plate_final.stl'}  (watertight={front.is_watertight})")

    for key, jkey in (("arm1", "arm1_local"), ("arm2", "arm2_local")):
        print(f"{key} 가공 중...")
        arm = fit_arm(key, FEATURES["arm_axle"][jkey])
        out = GEN / f"{key}_final.stl"
        arm.export(out)
        print(f"  저장: {out}  (watertight={arm.is_watertight})")

    print("뒷판 설계 중...")
    back = build_back_panel()
    back.export(GEN / "back_panel.stl")
    print(f"  저장: {GEN / 'back_panel.stl'}  (watertight={back.is_watertight})")

    print("\n완료. hardware/case/generated/ 에서 결과 확인.")
    print("watertight=False 인 게 있으면 슬라이서의 '메시 복구' 기능을 거쳐야 출력 가능하다.")


if __name__ == "__main__":
    main()

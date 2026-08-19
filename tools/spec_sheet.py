#!/usr/bin/env python3
"""부품 사양(JSON)을 유니티 인스펙터 입력용 체크시트(마크다운)로 변환한다.

parts/*.part.json 이 단일 진실 공급원이고, 이 스크립트가 만든
docs/generated/*.md 는 유니티에서 그대로 보고 따라 치는 용도다.
수치를 바꿨으면 이 스크립트를 다시 돌려 문서를 갱신할 것.

사용법:  python3 tools/spec_sheet.py [parts/meridian.part.json ...]
"""

import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs", "generated")


def vec(v):
    return "({}, {})".format(v[0], v[1]) if isinstance(v, list) and len(v) == 2 else str(v)


def table(rows):
    out = ["| 모듈 | 필드 | 값 |", "|---|---|---|"]
    for module, field, value in rows:
        out.append("| `{}` | `{}` | `{}` |".format(module, field, value))
    return "\n".join(out)


def build_sheet(part):
    eng = part["engine"]
    fuel = part["fuel"]
    name = part["displayName"]["en"]

    rows = [
        ("Part", "displayName", "{} / {}".format(part["displayName"]["en"], part["displayName"]["ko"])),
        ("Part", "description", part["description"]["ko"]),
        ("Part", "mass", part["mass"]),
        ("EngineModule", "thrust", eng["thrust"]),
        ("EngineModule", "ISP", eng["isp"]),
        ("EngineModule", "thrustNormal", vec(eng["thrustNormal"])),
        ("EngineModule", "thrustPosition", vec(eng["thrustPosition"])),
        ("EngineModule", "hasGimbal", str(eng["hasGimbal"]).lower()),
        ("EngineModule", "gimbal (torque)", eng.get("gimbalTorque", "-")),
        ("EngineModule", "engineOn", "engine_on (스톡 변수 그대로)"),
        ("EngineModule", "throttle_Out", "throttle (스톡 변수 그대로)"),
        ("EngineModule", "heatOn", "heat_on__for_creative_use"),
        ("EngineModule", "source (FlowModule)", "{} 흐름 (연료: {})".format(fuel.get("sourceFlow", "up"), fuel["resourceType"])),
        ("FlowModule", "resourceType", "{} (GUID {})".format(fuel["resourceType"], fuel["resourceGuid"])),
    ]

    lines = []
    lines.append("<!-- 이 파일은 tools/spec_sheet.py 가 생성한다. 직접 고치지 말고 parts/*.part.json 을 고칠 것. -->")
    lines.append("")
    lines.append("# {} — 유니티 인스펙터 입력 시트".format(name))
    lines.append("")
    lines.append("원본 사양: `parts/{}.part.json` · 빌드 카테고리: **{}** · 크기: 폭 {} × 높이 {}".format(
        part["id"].replace("_engine", ""), ", ".join(part["pickCategories"]), part["width"], part["height"]))
    lines.append("")
    lines.append("## 1. 모듈 값")
    lines.append("")
    lines.append(table(rows))
    lines.append("")

    lines.append("## 2. 부착점 (Attach Points)")
    lines.append("")
    lines.append("| 이름 | 위치 | surface | breakForce |")
    lines.append("|---|---|---|---|")
    for ap in part["attachPoints"]:
        lines.append("| {} | `{}` | {} | {} |".format(
            ap.get("name", "-"), vec(ap["position"]), ap.get("surfaceId", "-"), ap.get("breakForce", "-")))
    lines.append("")

    lines.append("## 3. 콜라이더 (ColliderModule / Polygon)")
    lines.append("")
    for col in part["colliders"]:
        pts = " ".join("({}, {})".format(p[0], p[1]) for p in col["points"])
        lines.append("- **{}** ({}): `{}`".format(col.get("name", "-"), col.get("type", "polygon"), pts))
    lines.append("")

    lines.append("## 4. 텍스처")
    lines.append("")
    for tex in part["textures"]:
        lines.append("- `{}` — {} px, {} 타일링 → `{}`".format(
            tex["name"], "×".join(str(n) for n in tex.get("size", [])), tex.get("tiling", "-"), tex["file"]))
    lines.append("")

    fx = part.get("effects", {})
    if fx:
        lines.append("## 5. 이펙트")
        lines.append("")
        flame = fx.get("flame", {})
        if flame:
            lines.append("- 화염: 프리팹 `{}`, 위치 `{}`, 스케일 {}, 색 `{}`".format(
                flame.get("prefab", "-"), vec(flame.get("position", [])), flame.get("scale", "-"), flame.get("color", "-")))
        sound = fx.get("sound", {})
        if sound:
            lines.append("- 사운드: `{}` (volume {})".format(sound.get("clip", "-"), sound.get("volume", "-")))
        lines.append("")

    notes = part.get("notes", [])
    if notes:
        lines.append("## 6. 메모")
        lines.append("")
        for n in notes:
            lines.append("- {}".format(n))
        lines.append("")

    return "\n".join(lines)


def main(argv):
    targets = argv[1:] or sorted(glob.glob(os.path.join(ROOT, "parts", "*.part.json")))
    if not targets:
        print("변환할 부품 파일이 없다: parts/*.part.json", file=sys.stderr)
        return 1
    os.makedirs(OUT_DIR, exist_ok=True)
    for path in targets:
        with open(path, encoding="utf-8") as f:
            part = json.load(f)
        out_path = os.path.join(OUT_DIR, "{}-inspector.md".format(part["id"].replace("_", "-")))
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(build_sheet(part) + "\n")
        print("생성: {}".format(os.path.relpath(out_path, ROOT)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

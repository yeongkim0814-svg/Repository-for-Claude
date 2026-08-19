#!/usr/bin/env python3
"""부품 사양(parts/*.part.json) 검증기.

- 스키마 검사: 필수 필드와 타입
- 밸런스 검사: 스톡 엔진(parts/stock-reference.json) 대비 규칙
- Δv 비교표: 동일한 표준 스테이지에서 스톡 엔진 대비 성능

표준 라이브러리만 사용한다(빌드 서버/공용 PC에 별도 설치가 필요 없도록).
문제가 있으면 종료 코드 1로 끝나므로 CI에서 그대로 쓸 수 있다.
"""

import argparse
import glob
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS_DIR = os.path.join(ROOT, "parts")
STOCK_PATH = os.path.join(PARTS_DIR, "stock-reference.json")

NUM = (int, float)


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, where, msg):
        self.errors.append("{}: {}".format(where, msg))

    def warn(self, where, msg):
        self.warnings.append("{}: {}".format(where, msg))

    @property
    def ok(self):
        return not self.errors


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# --- 스키마 -----------------------------------------------------------------
# (경로, 타입, 필수여부). 경로는 점 표기법, []는 리스트 원소를 뜻한다.
SCHEMA = [
    ("schemaVersion", int, True),
    ("id", str, True),
    ("packId", str, True),
    ("displayName.en", str, True),
    ("displayName.ko", str, True),
    ("description.en", str, True),
    ("description.ko", str, True),
    ("pickCategories", list, True),
    ("width", NUM, True),
    ("height", NUM, True),
    ("mass", NUM, True),
    ("engine.thrust", NUM, True),
    ("engine.isp", NUM, True),
    ("engine.thrustNormal", list, True),
    ("engine.thrustPosition", list, True),
    ("engine.hasGimbal", bool, True),
    ("fuel.resourceType", str, True),
    ("fuel.resourceGuid", str, True),
    ("attachPoints", list, True),
    ("colliders", list, True),
    ("textures", list, True),
]

VALID_CATEGORIES = {
    "Basic", "Engines", "Boosters", "Aero", "Structural", "Fairings", "Other",
    "Small", "6 wide", "8 wide", "10 wide", "12 wide",
}


def dig(data, path):
    """점 표기 경로로 값을 꺼낸다. 없으면 (False, None)."""
    cur = data
    for key in path.split("."):
        if not isinstance(cur, dict) or key not in cur:
            return False, None
        cur = cur[key]
    return True, cur


def check_schema(part, name, rep):
    for path, typ, required in SCHEMA:
        found, value = dig(part, path)
        if not found:
            if required:
                rep.error(name, "필수 필드 누락: {}".format(path))
            continue
        # bool 은 int 의 하위 타입이므로 숫자 검사에서 걸러낸다.
        if typ is NUM and isinstance(value, bool):
            rep.error(name, "{} 는 숫자여야 하는데 bool 이다".format(path))
        elif not isinstance(value, typ):
            want = typ.__name__ if not isinstance(typ, tuple) else "number"
            rep.error(name, "{} 의 타입이 {} 가 아니다 (실제: {})".format(path, want, type(value).__name__))

    for cat in part.get("pickCategories", []):
        if cat not in VALID_CATEGORIES:
            rep.error(name, "알 수 없는 빌드 카테고리: {!r} (허용: {})".format(cat, ", ".join(sorted(VALID_CATEGORIES))))

    for field in ("thrustNormal", "thrustPosition"):
        found, vec = dig(part, "engine." + field)
        if found and (not isinstance(vec, list) or len(vec) != 2
                      or not all(isinstance(v, NUM) and not isinstance(v, bool) for v in vec)):
            rep.error(name, "engine.{} 은 숫자 2개짜리 배열이어야 한다".format(field))

    for i, ap in enumerate(part.get("attachPoints", [])):
        pos = ap.get("position")
        if not isinstance(pos, list) or len(pos) != 2:
            rep.error(name, "attachPoints[{}].position 은 숫자 2개짜리 배열이어야 한다".format(i))

    for i, col in enumerate(part.get("colliders", [])):
        pts = col.get("points")
        if not isinstance(pts, list) or len(pts) < 3:
            rep.error(name, "colliders[{}].points 는 점 3개 이상이어야 한다".format(i))

    for i, tex in enumerate(part.get("textures", [])):
        f = tex.get("file")
        if not isinstance(f, str):
            rep.error(name, "textures[{}].file 이 없다".format(i))
        elif not os.path.exists(os.path.join(ROOT, f)):
            rep.warn(name, "텍스처 파일이 아직 없다: {} (tools/make_texture_template.py 로 생성)".format(f))


# --- 밸런스 -----------------------------------------------------------------
def check_balance(part, name, stock, rep):
    # 다른 필드가 잘못돼 있어도 이 검사는 독립적으로 수행한다.
    pos = part.get("engine", {}).get("thrustPosition")
    if isinstance(pos, list) and len(pos) == 2 and isinstance(pos[1], NUM) and pos[1] >= 0:
        rep.error(name, "engine.thrustPosition.y 는 음수여야 한다 (화염이 부품 아래로 나가야 함). 현재 {}".format(pos[1]))

    thrust = part.get("engine", {}).get("thrust")
    isp = part.get("engine", {}).get("isp")
    mass = part.get("mass")
    if not all(isinstance(v, NUM) and not isinstance(v, bool) for v in (thrust, isp, mass)):
        return  # 값 자체가 숫자가 아니면 아래 계산은 무의미하다(스키마 단계에서 이미 보고됨)

    if thrust <= 0:
        rep.error(name, "thrust 는 0보다 커야 한다")
    if isp <= 0:
        rep.error(name, "ISP 는 0보다 커야 한다")
    if mass <= 0:
        rep.error(name, "mass 는 0보다 커야 한다")
    if thrust <= 0 or isp <= 0 or mass <= 0:
        return

    engines = stock["engines"]
    isp_max = max(e["isp"] for e in engines)
    tm_values = [e["thrust"] / e["mass"] for e in engines]
    tm_min, tm_max = min(tm_values), max(tm_values)
    tm = thrust / mass

    # 핵심 규칙: 스톡보다 효율이 높다면 추력 대비 무게로 대가를 치러야 한다.
    if isp > isp_max and tm > tm_min:
        rep.error(name, (
            "ISP {:.0f} 이 스톡 최고치 {:.0f} 를 넘는데 추력/질량비 {:.1f} 이 스톡 최저치 {:.1f} 보다 높다. "
            "효율과 추력을 동시에 이기면 스톡 엔진이 전부 무의미해진다 — mass 를 올리거나 thrust 를 낮출 것."
        ).format(isp, isp_max, tm, tm_min))

    if tm > tm_max:
        rep.warn(name, "추력/질량비 {:.1f} 이 스톡 최고치 {:.1f} 보다 높다. 의도한 것인지 확인할 것.".format(tm, tm_max))

    if isp > isp_max * 1.5:
        rep.warn(name, "ISP {:.0f} 이 스톡 최고치의 1.5배를 넘는다. 이온엔진처럼 추력이 아주 낮은 부품이 아니라면 과하다.".format(isp))


# --- Δv ---------------------------------------------------------------------
def stage_delta_v(isp, engine_mass, stage, stock):
    """주어진 스테이지에 이 엔진을 얹었을 때의 Δv(m/s)와 초기질량."""
    tank_wet = stage["tankWetMass"]
    payload = stage["payloadMass"]
    tank_dry = tank_wet * stock["tankDryMassPercent"]
    m0 = tank_wet + payload + engine_mass
    mf = tank_dry + payload + engine_mass
    dv = isp * stock["gravity"] * math.log(m0 / mf)
    return dv, m0


def delta_v_rows(part, stage, stock):
    """(이름, 추력, ISP, 질량, T/M, Δv, 초기 T/W) 행 목록. 마지막 행이 검증 대상 부품."""
    rows = []
    entries = [(e["name"], e["thrust"], e["isp"], e["mass"]) for e in stock["engines"]]
    entries.append((part["displayName"]["en"] + " *", part["engine"]["thrust"], part["engine"]["isp"], part["mass"]))
    for name, thrust, isp, mass in entries:
        dv, m0 = stage_delta_v(isp, mass, stage, stock)
        rows.append((name, thrust, isp, mass, thrust / mass, dv, thrust / m0))
    return rows


def print_tables(part, stock):
    for stage in stock["referenceStages"]:
        print("\n[{}] 연료탱크 습질량 {}t / 건조 {:.0%} / 페이로드 {}t".format(
            stage["name"], stage["tankWetMass"], stock["tankDryMassPercent"], stage["payloadMass"]))
        head = ("엔진", "추력", "ISP", "질량", "T/M", "Δv(m/s)", "초기 T/W")
        print("  {:<14}{:>7}{:>7}{:>8}{:>8}{:>11}{:>11}".format(*head))
        print("  " + "-" * 56)
        for name, thrust, isp, mass, tm, dv, twr in delta_v_rows(part, stage, stock):
            print("  {:<14}{:>7.0f}{:>7.0f}{:>8.1f}{:>8.1f}{:>11.0f}{:>11.2f}".format(
                name, thrust, isp, mass, tm, dv, twr))
    print("  * 표시가 이번에 검증한 부품. 초기 T/W 는 추력 ÷ 스테이지 초기질량(중력 무시한 단순 비율).")


def validate_part(path, stock, rep, show_table=True):
    name = os.path.basename(path)
    try:
        part = load_json(path)
    except json.JSONDecodeError as exc:
        rep.error(name, "JSON 파싱 실패: {}".format(exc))
        return
    check_schema(part, name, rep)
    if rep.ok or "engine" in part:
        check_balance(part, name, stock, rep)
    if show_table and "engine" in part and isinstance(part.get("mass"), NUM):
        try:
            print_tables(part, stock)
        except (KeyError, TypeError, ValueError, ZeroDivisionError):
            pass  # 스키마 오류로 표를 못 그리는 경우는 위에서 이미 보고됨


def main():
    ap = argparse.ArgumentParser(description="SFS 부품 사양 검증")
    ap.add_argument("parts", nargs="*", help="검증할 .part.json 경로 (생략 시 parts/ 전체)")
    ap.add_argument("--no-table", action="store_true", help="Δv 비교표를 출력하지 않는다")
    args = ap.parse_args()

    stock = load_json(STOCK_PATH)
    targets = args.parts or sorted(glob.glob(os.path.join(PARTS_DIR, "*.part.json")))
    if not targets:
        print("검증할 부품 파일이 없다: parts/*.part.json", file=sys.stderr)
        return 1

    rep = Report()
    for path in targets:
        print("검증: {}".format(os.path.relpath(path, ROOT)))
        validate_part(path, stock, rep, show_table=not args.no_table)

    print()
    for w in rep.warnings:
        print("경고  {}".format(w))
    for e in rep.errors:
        print("오류  {}".format(e))

    if rep.ok:
        print("통과: 부품 {}개, 오류 0, 경고 {}개".format(len(targets), len(rep.warnings)))
        return 0
    print("실패: 오류 {}개, 경고 {}개".format(len(rep.errors), len(rep.warnings)))
    return 1


if __name__ == "__main__":
    sys.exit(main())

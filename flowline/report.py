"""수치 비교표 생성."""

from mpmath import mp

from .constants import BODIES, C
from . import checks, kinematics as K, model, theory


def _fmt(x, n=6):
    return mp.nstr(mp.mpf(x), n)


def _rule(width=110, ch="-"):
    return ch * width


def _body_table(title, header_line, width, row_fn, notes, bodies=BODIES):
    """BODIES 를 한 줄씩 훑는 표의 공통 골격.

    table_time_dilation 과 table_potential_and_field 가 열 구성만 다르고
    '제목 + 헤더 + 구분선 + 행들 + 각주' 뼈대를 그대로 반복하던 것을 모았다.
    table_conventions 는 (규약 x u) 이중 순회라 구조가 달라 별도로 둔다.
    """
    lines = [title, "", header_line, _rule(width)]
    lines += [row_fn(b) for b in bodies]
    lines += [""] + list(notes)
    return "\n".join(lines)


def table_time_dilation():
    """모델 예측 t(r)/t(inf) 를 Schwarzschild 및 교과서 1차식과 비교."""
    def row(b):
        r, rs, GM = b.r, b.rs, b.GM
        w = model.flow_speed(r, GM)
        rm = model.time_ratio(r, GM)
        rt = theory.schwarzschild_ratio(r, rs)
        resid = abs(rm - rt) / rt
        weak_err = abs(theory.weak_field_ratio(r, GM) - rt) / rt
        return (f"{b.label:<40} {_fmt(r / rs, 6):>12} {_fmt(w / C, 6):>12} "
                f"{mp.nstr(rm, 18):>24} {_fmt(resid, 3):>18} {_fmt(weak_err, 3):>14}")

    return _body_table(
        "[표 1] 시간 지연 비  t(r)/t(inf)",
        f"{'천체 / 위치':<40} {'r/r_s':>12} {'w/c':>12} "
        f"{'모델 = Schwarzschild':>24} {'모델-Schw (상대)':>18} {'1차근사 오차':>14}",
        126, row,
        [
            "  * '모델'과 'Schwarzschild' 열이 하나인 이유: 두 값이 60자리 전 자리에서",
            "    같아 따로 쓸 내용이 없다. 근사가 아니라 항등이다.",
            "  * 마지막 열은 교과서 1차식 1+Phi/c^2 이 Schwarzschild 에서 벗어난 정도.",
            "    이 모델은 그 오차를 갖지 않는다.",
        ],
    )


def table_potential_and_field():
    """Phi 와 g 의 모델-Newton 대응."""
    def row(b):
        r, GM = b.r, b.GM
        phi_m, phi_n = model.potential(r, GM), theory.newton_potential(r, GM)
        g_m, g_n = model.field(r, GM), theory.newton_field(r, GM)
        return (f"{b.label:<40} {_fmt(phi_m, 10):>24} {_fmt(abs(phi_m - phi_n) / abs(phi_n), 3):>16} "
                f"{_fmt(g_m, 10):>24} {_fmt(abs(g_m - g_n) / abs(g_n), 3):>16}")

    return _body_table(
        "[표 2] 포텐셜과 중력장 -- Phi = -w^2/2,  g = w dw/dr",
        f"{'천체 / 위치':<40} {'Phi = -w^2/2 [J/kg]':>24} {'-GM/r 상대오차':>16} "
        f"{'g = w dw/dr [m/s^2]':>24} {'-GM/r^2 상대오차':>16}",
        124, row,
        [
            "  * g 는 해석해를 대입한 것이 아니라 흐름장 w(r) 를 수치 미분해 얻었다.",
            "    즉 '중력장 = 흐름의 이류 가속도 Dw/Dt' 가 실제로 성립함을 보인 것.",
        ],
    )


def table_conventions():
    """네 측정 규약이 서로 다른 w 를 낳는다는 것을 한 지점에서 보인다."""
    b = next(x for x in BODIES if "중성자별" in x.label)
    R = theory.schwarzschild_ratio(b.r, b.rs)
    lines = [
        "[표 3] 측정 규약별 역산 결과  (기준점: " + b.label + ")",
        f"        목표 비 t(r)/t(inf) = {mp.nstr(R, 16)},   탈출속도 v_esc/c = "
        f"{_fmt(theory.escape_speed(b.r, b.GM) / C, 10)}",
        "",
        f"{'규약':<6} {'설명':<44} {'u':>8} {'역산 w/c':>16} {'v_esc 대비':>14} {'판정':<10}",
        _rule(104),
    ]
    desc = {
        "A": "실험실계 좌표에서 잰 점의 변위",
        "B1": "직선 고유시계로 잰 눈금 진행거리",
        "B2": "점의 도착 사건을 직선좌표로 읽음",
        "C": "B1 의 눈금거리를 실험실계에서 읽음",
    }
    for conv in K.CONVENTIONS:
        for uf in ("0.5", "1.0"):
            u = mp.mpf(uf) * C
            try:
                w = K.solve_w(conv, R, u)
                wc, rel = _fmt(w / C, 10), _fmt(w / theory.escape_speed(b.r, b.GM), 8)
            except K.DegenerateInversion:
                wc, rel = "퇴화", "-"
            if conv == "A":
                verdict = "기각(u의존/퇴화)"
            elif conv == "B2":
                verdict = "기각(u의존)"
            elif conv == "B1":
                verdict = "채택"
            else:
                verdict = "g_tt 자체"
            lines.append(f"{conv:<6} {desc[conv]:<44} {uf + 'c':>8} {wc:>16} {rel:>14} {verdict:<10}")
    lines += [
        "",
        "  * B1 만이 u 에 무관하면서 v_esc 와 정확히 일치한다 (비율 1.0).",
        "  * C 는 비 = 1-beta^2 = g_tt 를 재므로 시간 지연 sqrt(g_tt) 가 아니다.",
        "    같은 목표 비를 넣으면 다른 w 가 나온다.",
    ]
    return "\n".join(lines)


def section_checks():
    lines = ["[검사] 정합성 검증", ""]
    n_fail = 0
    for name, ok, detail in checks.run_all():
        n_fail += not ok
        lines.append(f"  {'PASS' if ok else 'FAIL'}  {name}")
        lines.append(f"        {detail}")
    lines += ["", f"  총 {len(checks.ALL_CHECKS)}개 중 실패 {n_fail}개."]
    return "\n".join(lines), n_fail


def full_report():
    checks_text, n_fail = section_checks()
    header = [
        _rule(126, "="),
        "흐르는-직선(flow-line) 시간지연 모델  --  정합적 이론과의 비교",
        _rule(126, "="),
        "",
        "모델:  직선이 속력 w 로 (점의 진행 반대방향, 즉 천체 쪽) 평행이동하고,",
        "       점은 직선 정지계에서 속력 u 로 직선을 따라 나아간다.",
        "       점이 직선 눈금 위에서 나아간 거리가 시계 눈금이다.",
        "",
        f"계산 정밀도: {mp.dps} 자리 (mpmath)",
        "",
    ]
    return "\n".join(header) + "\n\n" + "\n\n".join([
        table_time_dilation(),
        table_potential_and_field(),
        table_conventions(),
        checks_text,
    ]), n_fail

"""모델의 정합성 검사. 각 검사는 (이름, 통과여부, 설명) 을 돌려준다."""

from mpmath import mp

from .constants import BODIES, C, GM_SUN
from . import kinematics as K
from . import model, theory

TOL = mp.mpf(10) ** (-mp.dps + 8)   # 반올림 여유를 둔 '정확히 같다' 기준


def _rel(a, b):
    """상대 오차. b=0 이면 절대 오차."""
    return abs(a - b) / abs(b) if b != 0 else abs(a - b)


def check_boost_vs_closed_form():
    """네 규약의 닫힌 형태가 명시적 Lorentz 부스트와 일치하는가."""
    worst, where = mp.mpf(0), ""
    for uf in ("0.1", "0.5", "0.9", "1.0"):
        for wf in ("0.05", "0.3", "0.7", "0.95"):
            u, w = mp.mpf(uf) * C, mp.mpf(wf) * C
            for conv in K.CONVENTIONS:
                d = _rel(K.ratio(conv, u, w), K.ratio_closed_form(conv, u, w))
                if d > worst:
                    worst, where = d, f"{conv}, u={uf}c, w={wf}c"
    return ("부스트 유도 == 닫힌 형태", worst < TOL,
            f"최대 상대오차 {mp.nstr(worst, 3)} ({where})")


def check_u_independence():
    """채택 규약 B1 은 점의 속력 u 에 무관해야 한다.

    시간 지연은 '무엇으로 재느냐' 에 의존하면 안 되므로, 이것이
    규약 선택의 핵심 판정 기준이다. A 와 B2 는 여기서 탈락한다.
    """
    w = mp.mpf("0.6") * C
    us = [mp.mpf(f) * C for f in ("0.1", "0.3", "0.5", "0.9", "1.0")]
    spread = {}
    for conv in K.CONVENTIONS:
        vals = []
        for u in us:
            try:
                vals.append(K.ratio_closed_form(conv, u, w))
            except ZeroDivisionError:
                vals.append(mp.inf)
        spread[conv] = max(vals) - min(vals)
    ok = spread["B1"] < TOL and spread["C"] < TOL and spread["A"] > 1e-3 and spread["B2"] > 1e-3
    detail = ", ".join(f"{c}: 폭 {mp.nstr(spread[c], 4)}" for c in K.CONVENTIONS)
    return ("u-독립성 (B1, C 만 통과)", ok, detail + "  [w=0.6c, u=0.1c~c]")


def check_convention_A_degenerate():
    """규약 A 는 u=c 에서 어떤 w 를 넣어도 비가 1 -> 정보가 없다."""
    vals = [K.ratio_closed_form("A", C, mp.mpf(f) * C) for f in ("0.1", "0.5", "0.9")]
    flat = all(_rel(v, 1) < TOL for v in vals)
    try:
        K.solve_w("A", mp.mpf("0.5"), C)
        raised = False
    except K.DegenerateInversion:
        raised = True
    return ("규약 A 는 u=c 에서 퇴화", flat and raised,
            "w=0.1c/0.5c/0.9c 모두 비=1, 역산은 DegenerateInversion 을 던짐")


def check_B2_is_doppler():
    """B2 는 비가 1 을 넘어 '시간이 빨리 간다' 가 되어 버린다."""
    w = mp.mpf("0.6") * C
    val = K.ratio_closed_form("B2", C, w)
    expected = mp.sqrt((1 + w / C) / (1 - w / C))     # 상대론적 Doppler 인자
    return ("B2 = Doppler 인자 (기각 근거)", val > 1 and _rel(val, expected) < TOL,
            f"u=c, w=0.6c 에서 비 = {mp.nstr(val, 10)} > 1, "
            f"sqrt((1+b)/(1-b)) 와 일치")


def check_calibrated_w_is_escape_speed():
    """B1 로 역산한 w 가 정확히 탈출속도인가 (약한장 근사가 아니라 전 영역)."""
    worst, where = mp.mpf(0), ""
    for b in BODIES:
        w = model.calibrate_flow_speed(b.r, b.rs, "B1")
        d = _rel(w, theory.escape_speed(b.r, b.GM))
        if d > worst:
            worst, where = d, b.label
    return ("역산 w(r) == 탈출속도 sqrt(2GM/r)", worst < TOL,
            f"최대 상대오차 {mp.nstr(worst, 3)} ({where})")


def check_forward_ratio_matches_schwarzschild():
    """순방향 예측이 Schwarzschild 와 정확히 일치하는가."""
    worst, where = mp.mpf(0), ""
    for b in BODIES:
        d = _rel(model.time_ratio(b.r, b.GM), theory.schwarzschild_ratio(b.r, b.rs))
        if d > worst:
            worst, where = d, b.label
    return ("순방향 t(r)/t(inf) == Schwarzschild", worst < TOL,
            f"최대 상대오차 {mp.nstr(worst, 3)} ({where})")


def check_potential_and_field():
    """Phi = -w^2/2 와 g = w dw/dr 가 Newton 값과 맞는가."""
    worst_phi = worst_g = mp.mpf(0)
    for b in BODIES:
        worst_phi = max(worst_phi, _rel(model.potential(b.r, b.GM),
                                        theory.newton_potential(b.r, b.GM)))
        worst_g = max(worst_g, _rel(model.field(b.r, b.GM),
                                    theory.newton_field(b.r, b.GM)))
    return ("Phi = -w^2/2, g = w dw/dr 가 Newton 과 일치",
            worst_phi < TOL and worst_g < TOL,
            f"Phi 최대오차 {mp.nstr(worst_phi, 3)}, g 최대오차 {mp.nstr(worst_g, 3)} "
            "(g 는 수치 미분)")


def check_vacuum_closure():
    """3차원 닫힘 조건: 진공에서 laplacian(-w^2/2) = 0.

    1차원 구성이 스스로 낳지 못하는 유일한 재료가 이것이고,
    이것이 w 의 r^(-1/2) 의존성을 고정한다.
    """
    worst, where = mp.mpf(0), ""
    for b in BODIES:
        lap = model.radial_laplacian_of_potential(b.r, b.GM)
        # 같은 지점의 g/r 규모로 무차원화해서 비교한다.
        scale = abs(theory.newton_field(b.r, b.GM)) / b.r
        d = abs(lap) / scale
        if d > worst:
            worst, where = d, b.label
    return ("진공 닫힘 조건 laplacian(-w^2/2) = 0", worst < mp.mpf("1e-20"),
            f"최대 규격화 잔차 {mp.nstr(worst, 3)} ({where})")


def check_weak_field_coefficient():
    """약한장에서 모델 - 교과서 1차식 의 잔차가 -(1/8)(r_s/r)^2 인가.

    1차 항이 맞는 건 당연하고, 2차 항의 계수까지 맞는지가 진짜 검사다.
    """
    GM = GM_SUN
    rs = 2 * GM / C**2
    rows, ok = [], True
    for e in (6, 9, 12):
        r = rs * mp.mpf(10) ** e
        eps = rs / r
        resid = model.time_ratio(r, GM) - theory.weak_field_ratio(r, GM)
        coeff = resid / eps**2
        # 다음 항이 -(1/16) eps^3 이므로 계수의 편차는 O(eps) 로 줄어들어야
        # 한다. 상수 허용오차가 아니라 이 수렴 속도 자체를 검사한다.
        dev = _rel(coeff, mp.mpf(-1) / 8)
        ok = ok and dev < 10 * eps
        rows.append(f"r/r_s=1e{e}: 계수 {mp.nstr(coeff, 12)} (편차/eps {mp.nstr(dev / eps, 4)})")
    return ("약한장 2차 계수 == -1/8 (수렴속도 O(eps) 포함)", ok,
            "; ".join(rows) + "  (기대 -0.125, 편차/eps -> 0.5)")


def check_horizon_emerges():
    """w = c 인 지점이 r_s 와 같은가. 가정이 아니라 결과여야 한다."""
    GM = mp.mpf(10) * GM_SUN
    r_h = model.horizon_radius(GM)
    rs = 2 * GM / C**2
    return ("지평선이 결과로 출현 (w=c <=> r=r_s)",
            _rel(r_h, rs) < TOL and _rel(model.flow_speed(r_h, GM), C) < TOL,
            f"w(r)=c 인 r = {mp.nstr(r_h, 12)} m, r_s = {mp.nstr(rs, 12)} m")


ALL_CHECKS = [
    check_boost_vs_closed_form,
    check_u_independence,
    check_convention_A_degenerate,
    check_B2_is_doppler,
    check_calibrated_w_is_escape_speed,
    check_forward_ratio_matches_schwarzschild,
    check_potential_and_field,
    check_vacuum_closure,
    check_weak_field_coefficient,
    check_horizon_emerges,
]


def run_all():
    return [fn() for fn in ALL_CHECKS]

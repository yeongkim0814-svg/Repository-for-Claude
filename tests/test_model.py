"""pytest 스위트. 정합성 검사 전부 + 몇 가지 성질 검사."""

import pytest
from mpmath import mp

from flowline import checks, kinematics as K, model, theory
from flowline.constants import BODIES, C, GM_SUN

TOL = mp.mpf(10) ** (-mp.dps + 8)


@pytest.mark.parametrize("check", checks.ALL_CHECKS, ids=lambda f: f.__name__)
def test_consistency_check(check):
    name, ok, detail = check()
    assert ok, f"{name}: {detail}"


@pytest.mark.parametrize("body", BODIES, ids=lambda b: b.label)
def test_forward_matches_schwarzschild(body):
    assert abs(model.time_ratio(body.r, body.GM)
               - theory.schwarzschild_ratio(body.r, body.rs)) < TOL


@pytest.mark.parametrize("body", BODIES, ids=lambda b: b.label)
def test_calibration_round_trip(body):
    """역산한 w 를 순방향에 다시 넣으면 목표 비가 돌아와야 한다."""
    target = theory.schwarzschild_ratio(body.r, body.rs)
    w = model.calibrate_flow_speed(body.r, body.rs, "B1")
    assert abs(K.ratio_closed_form("B1", C, w) - target) < TOL


@pytest.mark.parametrize("u_frac", ["0.1", "0.5", "0.9", "1.0"])
def test_B1_is_independent_of_u(u_frac):
    w = mp.mpf("0.42") * C
    u = mp.mpf(u_frac) * C
    assert abs(K.ratio("B1", u, w) - mp.sqrt(1 - (w / C) ** 2)) < TOL


def test_w_zero_gives_unit_ratio():
    """정지한 직선은 무한원과 같아야 한다 (경계조건)."""
    for conv in K.CONVENTIONS:
        assert abs(K.ratio_closed_form(conv, mp.mpf("0.5") * C, mp.mpf(0)) - 1) < TOL


def test_ratio_decreases_toward_the_body():
    """안쪽으로 갈수록 시계가 느려져야 한다 (단조성)."""
    GM = mp.mpf(10) * GM_SUN
    rs = 2 * GM / C**2
    ratios = [model.time_ratio(f * rs, GM) for f in (1.5, 2, 5, 20, 100)]
    assert all(a < b for a, b in zip(ratios, ratios[1:]))


def test_horizon_is_where_flow_reaches_c():
    GM = mp.mpf(3) * GM_SUN
    assert abs(model.flow_speed(model.horizon_radius(GM), GM) - C) < TOL


def test_convention_A_inversion_raises_at_u_equals_c():
    with pytest.raises(K.DegenerateInversion):
        K.solve_w("A", mp.mpf("0.5"), C)


def test_convention_B2_has_no_solution_at_u_equals_c():
    with pytest.raises(K.DegenerateInversion):
        K.solve_w("B2", mp.mpf("0.5"), C)


def test_unknown_convention_rejected():
    with pytest.raises(ValueError):
        K.ratio_closed_form("B3", C, mp.mpf(0))

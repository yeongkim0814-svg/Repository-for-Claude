"""비교 대상이 되는 기존 이론들 (Schwarzschild, Newton)."""

from mpmath import mp

from .constants import C


def schwarzschild_ratio(r, rs):
    """정지 시계의 고유시간 / 무한원 좌표시간 = sqrt(1 - r_s/r).

    이것이 t(r)/t(inf) 이며, 모델이 맞춰야 할 목표값이다.
    """
    return mp.sqrt(1 - rs / r)


def newton_potential(r, GM):
    return -GM / r


def newton_field(r, GM):
    """부호 있는 반경 성분. 안쪽으로 당기므로 음수."""
    return -GM / r**2


def escape_speed(r, GM):
    return mp.sqrt(2 * GM / r)


def weak_field_ratio(r, GM, c=C):
    """교과서 1차 근사 1 + Phi/c^2."""
    return 1 + newton_potential(r, GM) / c**2

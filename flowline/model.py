"""흐르는-직선 모델의 순방향(예측) 정식화.

역방향(교정)과 순방향(예측)을 분리하는 것이 이 파일의 요점이다.

역방향 -- calibrate_flow_speed()
    Schwarzschild 의 t(r)/t(inf) 를 목표로 놓고 직선의 속력 w(r) 를
    역산한다. "내 모델이 맞으려면 직선이 얼마나 빨라야 하는가?"

순방향 -- flow_speed() 이하
    1차원 구성만으로는 w 의 r 의존성이 나오지 않는다. 그것은 3차원
    닫힘 조건에서 온다:

        진공에서  laplacian( -w^2/2 ) = 0,   w(inf) = 0
        =>  w^2 = 2GM/r  =>  w(r) = sqrt(2GM/r)   (= 탈출속도)

    이 w(r) 를 모델의 공준으로 놓으면 Phi 와 g 가 따라 나온다:

        Phi(r) = -w^2/2            포텐셜 = 흐름의 단위질량당 운동에너지의 음수
        g(r)   = w dw/dr           중력장 = 흐름장의 이류 가속도 (Dw/Dt)

    이 그림은 Painleve-Gullstrand 좌표계 / river model 과 같은 구조다.
"""

from mpmath import mp

from .constants import C
from .kinematics import solve_w
from .theory import schwarzschild_ratio


def calibrate_flow_speed(r, rs, convention="B1", u=None, c=C):
    """Schwarzschild 시간 지연 비를 재현하도록 w(r) 를 역산한다."""
    u = c if u is None else u
    return solve_w(convention, schwarzschild_ratio(r, rs), u, c)


# --- 순방향: 3차원 닫힘 조건이 고정해 준 흐름 프로파일 ---------------------


def flow_speed(r, GM):
    """w(r) = sqrt(2GM/r). 그 지점의 탈출속도와 같다."""
    return mp.sqrt(2 * GM / r)


def potential(r, GM):
    """Phi = -w^2/2."""
    return -flow_speed(r, GM) ** 2 / 2


def field(r, GM):
    """g = w dw/dr, 수치 미분으로 계산 (해석해를 대입하지 않는다)."""
    w = flow_speed(r, GM)
    dwdr = mp.diff(lambda rr: flow_speed(rr, GM), r)
    return w * dwdr


def time_ratio(r, GM, c=C):
    """모델이 예측하는 t(r)/t(inf) = sqrt(1 - w^2/c^2)."""
    return mp.sqrt(1 - (flow_speed(r, GM) / c) ** 2)


def horizon_radius(GM, c=C):
    """w = c 가 되는 반지름. 모델의 결과로 나오는 지평선."""
    return 2 * GM / c**2


def radial_laplacian_of_potential(r, GM):
    """진공 닫힘 조건 검사: (1/r^2) d/dr ( r^2 dPhi/dr ) 이 0 인가."""
    inner = lambda rr: rr**2 * mp.diff(lambda x: potential(x, GM), rr)
    return mp.diff(inner, r) / r**2

"""물리 상수와 가상 천체 정의.

GM 값은 IAU 공칭값(nominal)을 사용한다. G 와 M 을 따로 곱하면 G 의
상대 불확도(~2e-5)가 그대로 들어오지만, GM 은 훨씬 정밀하게 알려져
있기 때문이다. 이 모델의 비교는 1e-16 수준의 잔차를 다루므로
이 구분이 실제로 의미가 있다.
"""

from dataclasses import dataclass

from mpmath import mp

# 고정밀 계산용. 지구 표면에서 r_s/r ~ 1.4e-9 이라 배정밀도로는
# 모델-이론 잔차가 반올림 잡음에 묻힌다.
mp.dps = 60

C = mp.mpf("299792458")                    # 광속 [m/s], 정의값
GM_SUN = mp.mpf("1.32712440018e20")        # 태양 중력계수 [m^3/s^2]
GM_EARTH = mp.mpf("3.986004418e14")        # 지구 중력계수 [m^3/s^2]


def schwarzschild_radius(GM):
    """r_s = 2GM/c^2."""
    return 2 * GM / C**2


@dataclass(frozen=True)
class Body:
    """가상(또는 실재) 천체의 진공 외부 한 지점.

    r 은 절대 반지름[m] 으로 주거나, r_over_rs 로 r_s 의 배수로 준다.
    """

    label: str
    GM: mp.mpf
    r_m: float | None = None
    r_over_rs: float | None = None

    @property
    def rs(self):
        return schwarzschild_radius(self.GM)

    @property
    def r(self):
        if self.r_m is not None:
            return mp.mpf(self.r_m)
        if self.r_over_rs is not None:
            return mp.mpf(self.r_over_rs) * self.rs
        raise ValueError(f"{self.label}: r_m 또는 r_over_rs 중 하나가 필요하다")

    def __post_init__(self):
        if (self.r_m is None) == (self.r_over_rs is None):
            raise ValueError("r_m 과 r_over_rs 중 정확히 하나만 지정할 것")


# 약한장 -> 강한장 순서. 모델이 어느 영역까지 버티는지 보기 위한 사다리.
BODIES = [
    Body("지구 표면 (약한장)", GM_EARTH, r_m=6.3781e6),
    Body("태양 표면", GM_SUN, r_m=6.957e8),
    Body("백색왜성 0.6 M_sun, R=9000 km", mp.mpf("0.6") * GM_SUN, r_m=9.0e6),
    Body("중성자별 1.5 M_sun, R=12 km", mp.mpf("1.5") * GM_SUN, r_m=1.2e4),
    Body("블랙홀 10 M_sun, r=100 r_s", mp.mpf("10") * GM_SUN, r_over_rs=100.0),
    Body("블랙홀 10 M_sun, r=3 r_s (ISCO)", mp.mpf("10") * GM_SUN, r_over_rs=3.0),
    Body("블랙홀 10 M_sun, r=1.01 r_s (지평선 근방)", mp.mpf("10") * GM_SUN, r_over_rs=1.01),
]

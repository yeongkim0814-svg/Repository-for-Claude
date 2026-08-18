"""1차원 흐르는-직선(flow-line) 구성의 순수 특수상대론 부분.

구성
----
실험실계 S = 무한원의 정지 관측자.
  * 직선은 자기 자신과 평행하게, 속력 w 로 평행이동한다.
    방향은 점의 진행 방향과 반대 (= 천체 쪽, 안쪽).
  * 점은 직선의 정지계 S' 에서 직선을 따라 속력 u 로 나아간다.
  * S' 는 S 에 대해 속도 -w 로 움직인다.

"시계"는 점이 직선 눈금 위에서 나아간 거리다. 정지한 직선(w=0)에서의
같은 양과의 비가 시간 지연 비 t(r)/t(inf) 의 후보가 된다.

측정 규약
--------
"일정 시간 T 동안 나아간 거리" 는 아직 미결정 표현이다. 어느 계에서
시간을 재고 어느 계에서 거리를 재느냐에 따라 네 가지로 갈라지며,
결과가 통째로 달라진다. 네 규약을 모두 구현해 비교한다.

  A  : 실험실계 좌표에서 잰 점의 변위.
  B1 : 직선에 붙은 고유시계(출발 눈금)로 잰 경과시간 동안 점이 나아간
       눈금 거리.  <-- 채택
  B2 : 점이 도착한 사건의 직선-좌표를 읽은 것. 동시성의 상대성 때문에
       Doppler 인자가 섞여 들어온다.
  C  : B1 의 눈금 거리를 실험실계에서 (길이 수축을 포함해) 잰 것.

모든 거리는 순진한 공식이 아니라 명시적 Lorentz 부스트로부터 유도한다.
"""

from mpmath import mp

from .constants import C

CONVENTIONS = ("A", "B1", "B2", "C")


def boost(t, x, v, c=C):
    """실험실계 S 의 사건 (t, x) 를, S 에 대해 속도 v 로 움직이는 S' 로 변환."""
    gamma = 1 / mp.sqrt(1 - (v / c) ** 2)
    return gamma * (t - v * x / c**2), gamma * (x - v * t)


def point_lab_velocity(u, w, c=C):
    """직선 정지계에서 +u 로 가는 점의, 실험실계에서의 속도.

    S' 가 S 에 대해 -w 로 움직이므로 속도 덧셈은 (u - w)/(1 - u w / c^2).
    """
    return (u - w) / (1 - u * w / c**2)


def travelled_distances(u, w, T, c=C):
    """실험실계 경과시간 T 동안 점이 '나아간 거리' 를 네 규약으로 계산.

    반환값의 단위는 규약마다 다른 계에서 잰 길이지만, 항상 정지한 직선
    (w=0) 에서의 같은 양으로 나눠 쓰므로 비는 무차원이다.
    """
    v_frame = -w  # S' 의 S 에 대한 속도
    up = point_lab_velocity(u, w, c)

    # 점의 세계선: E0 = (0, 0) -> E1 = (T, up*T)
    _, x_arrival = boost(T, up * T, v_frame, c)

    # 출발 눈금에 붙어 직선과 함께 흐르는 시계: O0 = (0,0) -> O1 = (T, -w*T)
    tau_line, _ = boost(T, -w * T, v_frame, c)

    xi_marks = u * tau_line                       # 직선 눈금으로 잰 진행 거리
    contraction = mp.sqrt(1 - (w / c) ** 2)       # 1/gamma

    return {
        "A": up * T,
        "B1": xi_marks,
        "B2": x_arrival,
        "C": xi_marks * contraction,
    }


def ratio(convention, u, w, c=C, T=None):
    """움직이는 직선 / 정지한 직선 의 진행거리 비. T 에 무관하다(선형)."""
    if convention not in CONVENTIONS:
        raise ValueError(f"알 수 없는 규약: {convention!r}")
    T = mp.mpf(1) if T is None else T
    moving = travelled_distances(u, w, T, c)[convention]
    static = travelled_distances(u, mp.mpf(0), T, c)[convention]
    return moving / static


# ---------------------------------------------------------------------------
# 위 부스트에서 손으로 정리하면 나오는 닫힌 형태. 수치 검증용이자,
# 각 규약이 u 에 의존하는지 한눈에 보게 해 준다.
#
#   A  : (1 - w/u) / (1 - u w / c^2)                        u 의존
#   B1 : sqrt(1 - w^2/c^2)                                  u 무관  <-- 채택
#   B2 : sqrt(1 - w^2/c^2) / (1 - u w / c^2)                u 의존
#   C  : 1 - w^2/c^2                                        u 무관
# ---------------------------------------------------------------------------


def ratio_closed_form(convention, u, w, c=C):
    beta = w / c
    if convention == "A":
        return (1 - w / u) / (1 - u * w / c**2)
    if convention == "B1":
        return mp.sqrt(1 - beta**2)
    if convention == "B2":
        return mp.sqrt(1 - beta**2) / (1 - u * w / c**2)
    if convention == "C":
        return 1 - beta**2
    raise ValueError(f"알 수 없는 규약: {convention!r}")


class DegenerateInversion(Exception):
    """규약이 목표 비를 결정하지 못할 때 (예: 규약 A + u=c)."""


def solve_w(convention, target_ratio, u, c=C):
    """진행거리 비가 target_ratio 가 되게 하는 직선의 속력 w 를 구한다."""
    R = mp.mpf(target_ratio)

    if convention == "B1":
        return c * mp.sqrt(1 - R**2)
    if convention == "C":
        return c * mp.sqrt(1 - R)
    if convention == "A":
        # u=c 에서 순방향 사상이 상수 1 이 되어 역산이 불가능하다. 대수적으로
        # 정리하면 w = c 라는 근이 나오지만, 그 값을 순방향에 넣으면 0/0 이라
        # 실제 해가 아니다 (허근). 목표 비를 담아내지 못한다는 뜻.
        if mp.almosteq(u, c, rel_eps=mp.mpf(10) ** (-mp.dps + 5)):
            raise DegenerateInversion(
                "규약 A 는 u=c 에서 퇴화한다: 어떤 w<c 를 넣어도 비가 1 이므로 "
                "순방향 사상이 상수이고 역산이 성립하지 않는다."
            )
        return u * (1 - R) / (1 - R * u**2 / c**2)
    if convention == "B2":
        # B2 의 비는 beta=0 에서 1, beta=u/c 에서 최대, 이후 beta->1 에서 0 으로
        # 떨어진다. 단조가 아니므로 초기추정값 뉴턴법은 복소근으로 새어나간다.
        # 감소 구간 [u/c, 1) 을 잡아 이분법으로 푼다.
        if mp.almosteq(u, c, rel_eps=mp.mpf(10) ** (-mp.dps + 5)):
            raise DegenerateInversion(
                "규약 B2 는 u=c 에서 해가 없다: 비가 sqrt((1+b)/(1-b)) >= 1 이라 "
                "1 보다 작은 시간 지연 비를 결코 만들 수 없다."
            )
        lo, hi = u / c, 1 - mp.mpf(10) ** (-mp.dps // 2)
        f = lambda beta: ratio_closed_form("B2", u, beta * c, c) - R
        return c * mp.findroot(f, (lo, hi), solver="bisect", tol=mp.mpf(10) ** (-mp.dps + 5))
    raise ValueError(f"알 수 없는 규약: {convention!r}")

#!/usr/bin/env python3
"""Kerosene(RP-1)/LOX 로켓엔진 설계 스펙 계산기.

설계 요구사항:
    - 추력(F)        : 345 N
    - 비추력(Isp)     : 300 s
    - 챔버 압력(Pc)   : 20 bar
    - 노즐 형식       : de Laval(수축-확장) 노즐, 등엔트로피 팽창 가정

계산 절차:
    1. 목표 추력/Isp로부터 총 추진제 유량과 유효 배기속도 산출
    2. 연소가스 물성치(감마, 분자량, 연소실 온도)로 특성속도(c*) 산출
    3. c*와 Pc로 목(throat) 단면적 산출
    4. 목표 Isp를 만족하는 완전팽창 출구압력을 등엔트로피 관계식으로 역산
    5. 출구 마하수, 팽창비, 출구 단면적을 산출해 de Laval 노즐 형상 결정
    6. 원추형(15도 반각) 및 80% 벨(bell) 근사 노즐 길이, 연소실 크기 산출

주의: 감마/분자량/연소실온도는 O/F~2.24 부근 케로신-LOX 연소의 대표적인
문헌값(Sutton, Rocket Propulsion Elements)을 사용한 근사치이며, 실제 값은
CEA 등 화학평형 계산 코드로 정밀하게 구해야 한다.
"""

import math
from dataclasses import dataclass

G0 = 9.80665  # m/s^2, 표준 중력가속도
R_UNIVERSAL = 8314.5  # J/(kmol*K), 일반기체상수


@dataclass
class PropellantProperties:
    """케로신(RP-1)/LOX 연소가스의 열역학적 물성치 (근사값)."""

    gamma: float = 1.222  # 비열비
    Tc: float = 3670.0  # K, 연소실 정체온도
    M: float = 21.87  # kg/kmol, 연소가스 평균 분자량
    of_ratio: float = 2.24  # 산화제/연료 질량 혼합비 (O/F)

    @property
    def R_specific(self) -> float:
        """비기체상수 [J/(kg*K)]."""
        return R_UNIVERSAL / self.M


@dataclass
class DesignRequirements:
    """엔진 설계 요구사항."""

    thrust: float = 345.0  # N
    isp: float = 300.0  # s
    pc: float = 20e5  # Pa (20 bar)
    contraction_ratio: float = 6.0  # Ac/At, 연소실-목 단면적비
    l_star: float = 1.02  # m, 특성길이(characteristic length), 케로신/LOX 전형값
    cone_half_angle_deg: float = 15.0  # deg, 원추형 노즐 반각


@dataclass
class EngineDesign:
    """계산된 엔진 설계 결과."""

    mdot_total: float
    mdot_fuel: float
    mdot_ox: float
    ve_effective: float
    c_star: float
    cf: float
    throat_area: float
    throat_diameter: float
    exit_pressure: float
    exit_mach: float
    expansion_ratio: float
    exit_area: float
    exit_diameter: float
    cone_length: float
    bell_length: float
    chamber_area: float
    chamber_diameter: float
    chamber_volume: float
    chamber_length: float


def characteristic_velocity(gamma: float, r_specific: float, tc: float) -> float:
    """특성속도 c* [m/s] 계산 (등엔트로피 1차원 노즐 유동 이론)."""
    vandenkerckhove = math.sqrt(gamma) * (2.0 / (gamma + 1.0)) ** (
        (gamma + 1.0) / (2.0 * (gamma - 1.0))
    )
    return math.sqrt(r_specific * tc) / vandenkerckhove


def solve_exit_pressure_for_velocity(
    gamma: float, r_specific: float, tc: float, pc: float, ve_target: float
) -> float:
    """목표 배기속도를 만족하는 완전팽창 출구압력 pe [Pa]를 등엔트로피
    에너지식을 역산하여 구한다.

        Ve^2 = 2*gamma/(gamma-1) * R * Tc * (1 - (pe/pc)^((gamma-1)/gamma))
    """
    x = 1.0 - ve_target**2 * (gamma - 1.0) / (2.0 * gamma * r_specific * tc)
    if x <= 0.0:
        raise ValueError(
            "목표 배기속도가 이용 가능한 열에너지(연소온도)로 달성 불가능합니다."
        )
    return pc * x ** (gamma / (gamma - 1.0))


def exit_mach_from_pressure_ratio(gamma: float, pc: float, pe: float) -> float:
    """등엔트로피 압력비로부터 출구 마하수 Me를 계산."""
    pressure_ratio = pc / pe
    return math.sqrt(
        (2.0 / (gamma - 1.0)) * (pressure_ratio ** ((gamma - 1.0) / gamma) - 1.0)
    )


def area_ratio_from_mach(gamma: float, mach: float) -> float:
    """등엔트로피 면적-마하수 관계식으로 팽창비 eps = Ae/At를 계산."""
    term = (2.0 / (gamma + 1.0)) * (1.0 + (gamma - 1.0) / 2.0 * mach**2)
    exponent = (gamma + 1.0) / (2.0 * (gamma - 1.0))
    return (1.0 / mach) * term**exponent


def design_engine(
    req: DesignRequirements, prop: PropellantProperties
) -> EngineDesign:
    r_specific = prop.R_specific

    ve_effective = req.isp * G0
    mdot_total = req.thrust / ve_effective
    mdot_fuel = mdot_total / (1.0 + prop.of_ratio)
    mdot_ox = mdot_total - mdot_fuel

    c_star = characteristic_velocity(prop.gamma, r_specific, prop.Tc)
    throat_area = mdot_total * c_star / req.pc
    throat_diameter = math.sqrt(4.0 * throat_area / math.pi)
    cf = ve_effective / c_star

    exit_pressure = solve_exit_pressure_for_velocity(
        prop.gamma, r_specific, prop.Tc, req.pc, ve_effective
    )
    exit_mach = exit_mach_from_pressure_ratio(prop.gamma, req.pc, exit_pressure)
    expansion_ratio = area_ratio_from_mach(prop.gamma, exit_mach)
    exit_area = expansion_ratio * throat_area
    exit_diameter = math.sqrt(4.0 * exit_area / math.pi)

    throat_radius = throat_diameter / 2.0
    exit_radius = exit_diameter / 2.0
    half_angle_rad = math.radians(req.cone_half_angle_deg)
    cone_length = (exit_radius - throat_radius) / math.tan(half_angle_rad)
    bell_length = 0.8 * cone_length  # Rao 80%-bell 근사

    chamber_area = req.contraction_ratio * throat_area
    chamber_diameter = math.sqrt(4.0 * chamber_area / math.pi)
    chamber_volume = req.l_star * throat_area
    chamber_length = chamber_volume / chamber_area  # 원통부 근사 (수축콘 부피 무시)

    return EngineDesign(
        mdot_total=mdot_total,
        mdot_fuel=mdot_fuel,
        mdot_ox=mdot_ox,
        ve_effective=ve_effective,
        c_star=c_star,
        cf=cf,
        throat_area=throat_area,
        throat_diameter=throat_diameter,
        exit_pressure=exit_pressure,
        exit_mach=exit_mach,
        expansion_ratio=expansion_ratio,
        exit_area=exit_area,
        exit_diameter=exit_diameter,
        cone_length=cone_length,
        bell_length=bell_length,
        chamber_area=chamber_area,
        chamber_diameter=chamber_diameter,
        chamber_volume=chamber_volume,
        chamber_length=chamber_length,
    )


def print_report(req: DesignRequirements, prop: PropellantProperties, d: EngineDesign) -> None:
    print("=" * 60)
    print(" Kerosene(RP-1)/LOX 로켓엔진 설계 스펙")
    print("=" * 60)

    print("\n[설계 요구사항]")
    print(f"  추력            F   = {req.thrust:.1f} N")
    print(f"  비추력          Isp = {req.isp:.1f} s")
    print(f"  챔버 압력       Pc  = {req.pc / 1e5:.1f} bar")

    print("\n[연소가스 물성치 (근사값, O/F={:.2f})]".format(prop.of_ratio))
    print(f"  비열비          gamma = {prop.gamma:.3f}")
    print(f"  연소실 온도     Tc    = {prop.Tc:.1f} K")
    print(f"  평균 분자량     M     = {prop.M:.2f} kg/kmol")
    print(f"  비기체상수      R     = {prop.R_specific:.2f} J/(kg*K)")

    print("\n[추진제 유량]")
    print(f"  전체 추진제 유량   mdot_total = {d.mdot_total * 1000:.2f} g/s")
    print(f"  연료(RP-1) 유량    mdot_fuel  = {d.mdot_fuel * 1000:.2f} g/s")
    print(f"  산화제(LOX) 유량   mdot_ox    = {d.mdot_ox * 1000:.2f} g/s")
    print(f"  유효 배기속도      Ve         = {d.ve_effective:.1f} m/s")
    print(f"  특성속도           c*         = {d.c_star:.1f} m/s")
    print(f"  추력계수           Cf         = {d.cf:.3f}")

    print("\n[목(Throat)]")
    print(f"  목 단면적   At = {d.throat_area * 1e6:.2f} mm^2")
    print(f"  목 직경     Dt = {d.throat_diameter * 1000:.2f} mm")

    print("\n[de Laval 노즐 팽창부 (완전팽창 설계)]")
    print(f"  설계 출구압력    Pe        = {d.exit_pressure:.1f} Pa "
          f"({d.exit_pressure / 1e5:.4f} bar)")
    print(f"  출구 마하수      Me        = {d.exit_mach:.3f}")
    print(f"  팽창비           eps=Ae/At = {d.expansion_ratio:.2f}")
    print(f"  출구 단면적      Ae        = {d.exit_area * 1e6:.2f} mm^2")
    print(f"  출구 직경        De        = {d.exit_diameter * 1000:.2f} mm")
    print(f"  원추형 노즐 길이 (half-angle {req.cone_half_angle_deg:.0f}deg) "
          f"= {d.cone_length * 1000:.2f} mm")
    print(f"  80% 벨(bell) 근사 노즐 길이 = {d.bell_length * 1000:.2f} mm")

    print("\n[연소실 (Chamber)]")
    print(f"  수축비        Ac/At = {req.contraction_ratio:.1f}")
    print(f"  연소실 단면적 Ac    = {d.chamber_area * 1e6:.2f} mm^2")
    print(f"  연소실 직경   Dc    = {d.chamber_diameter * 1000:.2f} mm")
    print(f"  특성길이      L*    = {req.l_star:.2f} m")
    print(f"  연소실 부피   Vc    = {d.chamber_volume * 1e6:.2f} cm^3")
    print(f"  연소실 길이(원통부 근사) Lc = {d.chamber_length * 1000:.2f} mm")

    print("\n" + "=" * 60)
    if d.exit_pressure < 5e3:
        note = "저압(진공/고고도) 팽창에 가까움 -> 고고도/진공용 노즐로 해석"
    elif d.exit_pressure < 5e4:
        note = "고고도 팽창에 가까움"
    else:
        note = "해수면 근접 팽창"
    print(f" 참고: 설계 출구압력 기준 {note}")
    print("=" * 60)


def main() -> None:
    req = DesignRequirements()
    prop = PropellantProperties()
    design = design_engine(req, prop)
    print_report(req, prop, design)


if __name__ == "__main__":
    main()

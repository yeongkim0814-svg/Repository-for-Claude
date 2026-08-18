"""그림 생성.

수치표는 mpmath 고정밀로 뽑지만, 그림은 강한장 영역을 그리므로
자릿수 소거 문제가 없다. 여기서는 float/numpy 를 쓴다.
"""

import matplotlib

matplotlib.use("Agg")

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np


def _font_has(path, codepoints):
    """폰트가 해당 코드포인트를 실제로 담고 있는지 확인. fontTools 가 없으면 None."""
    try:
        from fontTools.ttLib import TTFont
    except ImportError:
        return None
    try:
        font = TTFont(path, fontNumber=0, lazy=True)
        cmap = set()
        for table in font["cmap"].tables:
            cmap |= set(table.cmap)
        font.close()
    except Exception:
        return None
    return all(cp in cmap for cp in codepoints)


# 한글(U+AC00) 과 마이너스(U+2212) 를 모두 담아야 한다. 후자는 로그축 눈금
# 라벨에 쓰이는데, 나눔 계열에는 없어서 눈금이 두부(tofu)가 된다.
_REQUIRED = (0xAC00, 0x2212)


def _hangul_font():
    """그림 라벨이 한글이라 한글 폰트가 필요하다. 없으면 두부가 찍힌다."""
    preferred = ("Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic",
                 "AppleGothic", "NanumGothic", "NanumBarunGothic")
    installed = {f.name: f.fname for f in fm.fontManager.ttflist}
    fallback = None
    for name in preferred:
        if name not in installed:
            continue
        ok = _font_has(installed[name], _REQUIRED)
        if ok or ok is None:
            return name
        fallback = fallback or name          # 한글은 되지만 글리프가 모자란 폰트

    import warnings

    if fallback:
        warnings.warn(
            f"{fallback} 에는 U+2212(마이너스) 글리프가 없어 로그축 눈금이 깨진다. "
            "권장: apt-get install fonts-noto-cjk",
            RuntimeWarning,
        )
        return fallback
    warnings.warn(
        "한글 폰트를 찾지 못했다. 그림의 한글 라벨이 깨진다. "
        "설치: apt-get install fonts-noto-cjk  (그 뒤 matplotlib 캐시 삭제)",
        RuntimeWarning,
    )
    return None


# dataviz 기준 팔레트 (light 모드). 계열은 고정 순서로 배정하고 순환시키지 않는다.
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#dcdbd6"
S1, S2, S3 = "#2a78d6", "#eb6834", "#1baf7a"        # 범주형 슬롯 1~3
SEQ = ["#86b6ef", "#2a78d6", "#104281"]             # 순차 램프 (u 는 연속량)

_FONT = _hangul_font()

plt.rcParams.update({
    **({"font.family": [_FONT, "DejaVu Sans"]} if _FONT else {}),
    "axes.unicode_minus": False,
    # 로그축 눈금은 mathtext 로 그려지고, mathtext 의 'default'/'normal' 슬롯은
    # 폰트셋이 아니라 본문 폰트를 쓴다. 본문 폰트에 U+2212 이 없으면 눈금이
    # 두부가 되므로, 'rm' 으로 고정해 폰트셋 쪽을 쓰게 한다.
    "mathtext.fontset": "dejavusans",
    "mathtext.default": "rm",
    "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE,
    "savefig.facecolor": SURFACE,
    "font.size": 10,
    "axes.labelcolor": INK,
    "axes.edgecolor": GRID,
    "text.color": INK,
    "xtick.color": INK_2,
    "ytick.color": INK_2,
    "axes.titlesize": 11,
    "axes.titleweight": "normal",
    "lines.linewidth": 2.0,
    "legend.frameon": False,
})


def _style(ax, title, xlabel, ylabel, logx=True):
    ax.set_title(title, loc="left", color=INK, pad=10)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    if logx:
        ax.set_xscale("log")
    ax.grid(True, color=GRID, linewidth=0.8, alpha=0.9)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)


def figure_profiles(path):
    """반지름에 따른 네 프로파일. 모델(실선) vs 기존 이론(파선)."""
    x = np.logspace(0.0001, 3, 500)          # r/r_s
    beta = np.sqrt(1.0 / x)                  # w/c = sqrt(r_s/r)

    fig, axes = plt.subplots(2, 2, figsize=(12, 8.5))

    ax = axes[0, 0]
    ax.plot(x, np.sqrt(1 - beta**2), color=S1, label="모델  sqrt(1 - w²/c²)")
    ax.plot(x, np.sqrt(1 - 1 / x), color=S2, linestyle="--", dashes=(5, 4),
            label="Schwarzschild  sqrt(1 - r_s/r)")
    ax.plot(x, 1 - 0.5 / x, color=S3, linestyle=":", linewidth=1.8,
            label="교과서 1차 근사  1 + Φ/c²")
    _style(ax, "시간 지연 비  t(r) / t(∞)", "r / r_s", "비")
    ax.legend(loc="lower right")
    ax.annotate("두 곡선이 겹쳐 하나로 보인다\n(60자리까지 항등)",
                xy=(6, np.sqrt(1 - 1 / 6)), xytext=(20, 0.55), color=INK_2, fontsize=9,
                arrowprops=dict(arrowstyle="->", color=INK_2, linewidth=1))

    ax = axes[0, 1]
    ax.plot(x, beta, color=S1, label="직선의 속력  w/c = sqrt(r_s/r)")
    ax.axhline(1.0, color=INK_2, linewidth=1, linestyle="--", dashes=(3, 3))
    _style(ax, "직선의 평행이동 속력 (= 탈출속도)", "r / r_s", "w / c")
    ax.set_ylim(0, 1.15)
    ax.legend(loc="upper right")
    ax.annotate("w = c  →  r = r_s\n지평선이 결과로 나옴",
                xy=(1.02, 0.99), xytext=(3, 0.62), color=INK_2, fontsize=9,
                arrowprops=dict(arrowstyle="->", color=INK_2, linewidth=1))

    ax = axes[1, 0]
    ax.plot(x, -0.5 * beta**2, color=S1, label="모델  Φ = -w²/2")
    ax.plot(x, -0.5 / x, color=S2, linestyle="--", dashes=(5, 4), label="Newton  Φ = -GM/r")
    _style(ax, "포텐셜 (c² 단위)", "r / r_s", "Φ / c²")
    ax.legend(loc="lower right")

    ax = axes[1, 1]
    ax.plot(x, -0.5 / x**2, color=S1, label="모델  g = w dw/dr")
    ax.plot(x, -0.5 / x**2, color=S2, linestyle="--", dashes=(5, 4), label="Newton  g = -GM/r²")
    _style(ax, "중력장 (c²/r_s 단위)", "r / r_s", "g r_s / c²")
    ax.set_yscale("symlog", linthresh=1e-6)
    ax.legend(loc="lower right")

    fig.suptitle("흐르는-직선 모델 vs 정합적 이론  (규약 B1)",
                 x=0.008, ha="left", fontsize=13, color=INK)
    fig.tight_layout(rect=(0, 0, 1, 0.965))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def figure_conventions(path):
    """측정 규약이 왜 B1 이어야 하는지를 두 패널로."""
    beta = np.linspace(0, 0.995, 500)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.6))

    ax = axes[0]
    ax.plot(beta, np.sqrt(1 - beta**2), color=S1, label="B1  (채택) — u 무관")
    ax.plot(beta, 1 - beta**2, color=S2, linestyle="--", dashes=(5, 4),
            label="C  = g_tt, 시간지연 아님")
    ax.plot(beta, np.sqrt(1 - beta**2) / (1 - 0.5 * beta), color=S3, linestyle=":",
            linewidth=1.8, label="B2  (u=0.5c) — Doppler 오염")
    ax.axhline(1.0, color=INK_2, linewidth=1, linestyle="--", dashes=(3, 3))
    _style(ax, "규약별 진행거리 비", "w / c", "비", logx=False)
    ax.set_ylim(0, 1.42)
    ax.legend(loc="lower left")
    ax.annotate("B2 는 비 > 1\n(시간이 빨리 감)", xy=(0.5, 1.155), xytext=(0.6, 1.32),
                color=INK_2, fontsize=9, arrowprops=dict(arrowstyle="->", color=INK_2, linewidth=1))

    ax = axes[1]
    for u_over_c, color in zip((0.3, 0.6, 0.9), SEQ):
        with np.errstate(divide="ignore", invalid="ignore"):
            r = (1 - beta / u_over_c) / (1 - u_over_c * beta)
        ax.plot(beta, r, color=color, label=f"규약 A,  u = {u_over_c}c")
    ax.axhline(0.0, color=INK_2, linewidth=1)
    _style(ax, "규약 A 는 점의 속력 u 에 의존한다 (기각 근거)", "w / c", "비", logx=False)
    ax.set_ylim(-2, 1.2)
    ax.legend(loc="lower left")

    fig.suptitle("측정 규약의 선택 — 왜 B1 인가",
                 x=0.008, ha="left", fontsize=13, color=INK)
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def figure_weak_field(path):
    """약한장에서 모델과 교과서 1차식의 잔차가 기울기 2 로 사라지는가.

    이 곡선만은 mpmath 로 계산한다. 잔차가 eps^2/8 이라 eps < 3e-8 에서
    1e-16 아래로 내려가는데, 배정밀도로는 그 지점부터 반올림 잡음이 되어
    톱니가 생긴다. 표를 60자리로 뽑는 이유가 바로 이것이다.
    """
    from mpmath import mp

    eps_f = np.logspace(-9, -1, 160)                 # r_s / r
    resid = np.array([
        float(abs(mp.sqrt(1 - mp.mpf(e)) - (1 - mp.mpf(e) / 2))) for e in eps_f
    ])

    fig, ax = plt.subplots(figsize=(7.2, 4.8))
    ax.plot(eps_f, resid, color=S1, label="| 모델 - (1 + Φ/c²) |  (60자리 계산)")
    ax.plot(eps_f, eps_f**2 / 8, color=S2, linestyle="--", dashes=(5, 4),
            label="(1/8)(r_s/r)²  기준선")
    ax.axhline(2.2e-16, color=INK_2, linewidth=1, linestyle=":")
    ax.set_xscale("log")
    ax.set_yscale("log")
    _style(ax, "약한장 잔차 — 2차 항 계수 검증", "r_s / r", "|잔차|", logx=True)
    ax.legend(loc="upper left")
    ax.annotate("배정밀도 한계 (2.2e-16)\n이 아래는 float 로는 잡음이 된다",
                xy=(2e-9, 2.2e-16), xytext=(3e-9, 3e-13),
                color=INK_2, fontsize=9,
                arrowprops=dict(arrowstyle="->", color=INK_2, linewidth=1))
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)

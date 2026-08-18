"""그림 생성.

수치표는 mpmath 고정밀로 뽑지만, 그림은 강한장 영역을 그리므로
자릿수 소거 문제가 없다. 여기서는 float/numpy 를 쓴다.

그림 안의 텍스트(제목/축/범례/주석)는 일부러 영어로 쓴다. 코랩 커널이
matplotlib 을 미리 로드해 둔 뒤에 한글 폰트를 설치하면, 폰트 매니저
싱글턴이 여러 모듈에 '값으로' 복사돼 있어(matplotlib/text.py 등) 설치
후에도 두부(tofu) 가 찍히는 경우가 있었다 (addfont 로 그 자리에서
갱신해도 코랩 환경별로 재현이 들쭉날쭉했다). matplotlib 기본 번들
폰트인 DejaVu Sans 는 라틴/그리스 문자와 기호(Φ, β, →, ∞, − 등)를
설치 없이 항상 지원하므로, 그림 텍스트를 영어로 두면 이 문제 자체가
사라진다. 코드 주석과 report.py 의 표 출력, README 는 그대로 한글이다
-- 그건 matplotlib 이 그리는 게 아니라 터미널/브라우저가 그리는
텍스트라 이 문제와 무관하다.
"""

import sys

import matplotlib

# CLI(run_all.py)는 디스플레이가 없는 헤드리스 환경일 수 있어 Agg 가 필요하다.
# 반대로 Jupyter/Colab 은 노트북을 열 때 이미 IPython 이 백엔드를 골라 두므로,
# 여기서 Agg 로 덮어쓰면 노트북 안에서 plt.show() 를 쓰는 다른 셀이 깨진다.
# "이미 IPython 이 로드돼 있는가" 로 두 경우를 가른다.
if "IPython" not in sys.modules:
    matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np

# dataviz 기준 팔레트 (light 모드). 계열은 고정 순서로 배정하고 순환시키지 않는다.
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#dcdbd6"
S1, S2, S3 = "#2a78d6", "#eb6834", "#1baf7a"        # 범주형 슬롯 1~3
SEQ = ["#86b6ef", "#2a78d6", "#104281"]             # 순차 램프 (u 는 연속량)

plt.rcParams.update({
    "axes.unicode_minus": False,
    "mathtext.fontset": "dejavusans",
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
    ax.plot(x, np.sqrt(1 - beta**2), color=S1, label="Model  sqrt(1 - w²/c²)")
    ax.plot(x, np.sqrt(1 - 1 / x), color=S2, linestyle="--", dashes=(5, 4),
            label="Schwarzschild  sqrt(1 - r_s/r)")
    ax.plot(x, 1 - 0.5 / x, color=S3, linestyle=":", linewidth=1.8,
            label="Textbook 1st order  1 + Φ/c²")
    _style(ax, "Time dilation ratio  t(r) / t(∞)", "r / r_s", "ratio")
    ax.legend(loc="lower right")
    ax.annotate("Curves overlap into one\n(identical to 60 digits)",
                xy=(6, np.sqrt(1 - 1 / 6)), xytext=(20, 0.55), color=INK_2, fontsize=9,
                arrowprops=dict(arrowstyle="->", color=INK_2, linewidth=1))

    ax = axes[0, 1]
    ax.plot(x, beta, color=S1, label="Flow speed  w/c = sqrt(r_s/r)")
    ax.axhline(1.0, color=INK_2, linewidth=1, linestyle="--", dashes=(3, 3))
    _style(ax, "Flow-line speed (= escape velocity)", "r / r_s", "w / c")
    ax.set_ylim(0, 1.15)
    ax.legend(loc="upper right")
    ax.annotate("w = c  →  r = r_s\nhorizon emerges as a result",
                xy=(1.02, 0.99), xytext=(3, 0.62), color=INK_2, fontsize=9,
                arrowprops=dict(arrowstyle="->", color=INK_2, linewidth=1))

    ax = axes[1, 0]
    ax.plot(x, -0.5 * beta**2, color=S1, label="Model  Φ = -w²/2")
    ax.plot(x, -0.5 / x, color=S2, linestyle="--", dashes=(5, 4), label="Newton  Φ = -GM/r")
    _style(ax, "Potential (units of c²)", "r / r_s", "Φ / c²")
    ax.legend(loc="lower right")

    ax = axes[1, 1]
    ax.plot(x, -0.5 / x**2, color=S1, label="Model  g = w dw/dr")
    ax.plot(x, -0.5 / x**2, color=S2, linestyle="--", dashes=(5, 4), label="Newton  g = -GM/r²")
    _style(ax, "Gravitational field (units of c²/r_s)", "r / r_s", "g r_s / c²")
    ax.set_yscale("symlog", linthresh=1e-6)
    ax.legend(loc="lower right")

    fig.suptitle("Flow-line model vs. established theory  (convention B1)",
                 x=0.008, ha="left", fontsize=13, color=INK)
    fig.tight_layout(rect=(0, 0, 1, 0.965))
    fig.savefig(path, dpi=150)
    plt.close(fig)


def figure_conventions(path):
    """측정 규약이 왜 B1 이어야 하는지를 두 패널로."""
    beta = np.linspace(0, 0.995, 500)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.6))

    ax = axes[0]
    ax.plot(beta, np.sqrt(1 - beta**2), color=S1, label="B1  (adopted) — u-independent")
    ax.plot(beta, 1 - beta**2, color=S2, linestyle="--", dashes=(5, 4),
            label="C  = g_tt, not a time dilation")
    ax.plot(beta, np.sqrt(1 - beta**2) / (1 - 0.5 * beta), color=S3, linestyle=":",
            linewidth=1.8, label="B2  (u=0.5c) — Doppler-contaminated")
    ax.axhline(1.0, color=INK_2, linewidth=1, linestyle="--", dashes=(3, 3))
    _style(ax, "Distance-travelled ratio by convention", "w / c", "ratio", logx=False)
    ax.set_ylim(0, 1.42)
    ax.legend(loc="lower left")
    ax.annotate("B2 exceeds 1\n(time runs fast)", xy=(0.5, 1.155), xytext=(0.6, 1.32),
                color=INK_2, fontsize=9, arrowprops=dict(arrowstyle="->", color=INK_2, linewidth=1))

    ax = axes[1]
    for u_over_c, color in zip((0.3, 0.6, 0.9), SEQ):
        with np.errstate(divide="ignore", invalid="ignore"):
            r = (1 - beta / u_over_c) / (1 - u_over_c * beta)
        ax.plot(beta, r, color=color, label=f"Convention A,  u = {u_over_c}c")
    ax.axhline(0.0, color=INK_2, linewidth=1)
    _style(ax, "Convention A depends on particle speed u (why it's rejected)", "w / c", "ratio", logx=False)
    ax.set_ylim(-2, 1.2)
    ax.legend(loc="lower left")

    fig.suptitle("Choosing the measurement convention — why B1",
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
    ax.plot(eps_f, resid, color=S1, label="| model - (1 + Φ/c²) |  (60-digit)")
    ax.plot(eps_f, eps_f**2 / 8, color=S2, linestyle="--", dashes=(5, 4),
            label="(1/8)(r_s/r)²  reference line")
    ax.axhline(2.2e-16, color=INK_2, linewidth=1, linestyle=":")
    ax.set_xscale("log")
    ax.set_yscale("log")
    _style(ax, "Weak-field residual — checking the 2nd-order coefficient", "r_s / r", "|residual|", logx=True)
    ax.legend(loc="upper left")
    ax.annotate("double precision floor (2.2e-16)\nbelow this, float is just noise",
                xy=(2e-9, 2.2e-16), xytext=(3e-9, 3e-13),
                color=INK_2, fontsize=9,
                arrowprops=dict(arrowstyle="->", color=INK_2, linewidth=1))
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)

#!/usr/bin/env python3
"""전체 실행: 비교표 출력 + 그림 생성.

    python3 run_all.py [--figdir figures] [--report report.txt]

종료 코드는 실패한 정합성 검사의 개수다.
"""

import argparse
import pathlib
import sys

from flowline import plots, report


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--figdir", default="figures", help="그림 저장 폴더")
    ap.add_argument("--report", default="report.txt", help="보고서 저장 경로")
    args = ap.parse_args()

    text, n_fail = report.full_report()
    print(text)
    pathlib.Path(args.report).write_text(text + "\n", encoding="utf-8")

    figdir = pathlib.Path(args.figdir)
    figdir.mkdir(parents=True, exist_ok=True)
    plots.figure_profiles(figdir / "fig1_profiles.png")
    plots.figure_conventions(figdir / "fig2_conventions.png")
    plots.figure_weak_field(figdir / "fig3_weak_field.png")

    print(f"\n보고서: {args.report}")
    print(f"그림:   {figdir}/fig1_profiles.png, fig2_conventions.png, fig3_weak_field.png")
    return n_fail


if __name__ == "__main__":
    sys.exit(main())

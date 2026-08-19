#!/usr/bin/env python3
"""부품 텍스처 템플릿(PNG) 생성기 — 외부 라이브러리 없이 stdlib(zlib)만 사용한다.

SFS 부품은 2D 스프라이트를 원통 표면처럼 보이게 칠한다. 그래서 텍스처는
 - 가로축: 원통 조명(가장자리 어둡고 한쪽에 하이라이트)
 - 세로축: 부품 길이를 따라 반복(타일링)
하는 구조가 기본이다. 이 스크립트는 그 규칙을 지킨 플레이스홀더를 만들어
유니티에서 바로 붙여 보고, 나중에 실제 아트로 교체할 수 있게 한다.

사용법:
  python3 tools/make_texture_template.py            # parts/*.part.json 의 textures 항목 전부 생성
  python3 tools/make_texture_template.py --guides   # 정렬 확인용 가이드 선을 함께 그린다
"""

import argparse
import glob
import json
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# --- 최소 PNG 라이터 ---------------------------------------------------------
def write_png(path, pixels, width, height):
    """pixels: (r, g, b, a) 튜플의 행 리스트. RGBA 8bit PNG 로 저장."""
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # 필터 타입 0 (None)
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", header)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, int(round(v))))


def cylinder_shade(x, width):
    """가로 위치를 원통 조명 밝기 계수(0.35~1.15)로 바꾼다. 하이라이트는 왼쪽 35% 지점."""
    t = x / max(1, width - 1)
    highlight = 0.35
    d = abs(t - highlight) / max(highlight, 1 - highlight)
    return 1.15 - 0.8 * (d ** 1.4)


# --- 텍스처 종류 -------------------------------------------------------------
def make_body(width, height, base=(150, 156, 165), band_every=32):
    """엔진 본체: 원통 음영 + 일정 간격의 가로 밴드(타일 이음매를 눈으로 확인하기 위함)."""
    rows = []
    for y in range(height):
        row = []
        band = (y % band_every) in (0, 1)
        seam = y in (0, height - 1)
        for x in range(width):
            k = cylinder_shade(x, width)
            r, g, b = (clamp(c * k) for c in base)
            if band:
                r, g, b = clamp(r * 0.82), clamp(g * 0.82), clamp(b * 0.86)
            if seam:
                r, g, b = clamp(r * 0.7), clamp(g * 0.7), clamp(b * 0.75)
            row.append((r, g, b, 255))
        rows.append(row)
    return rows


def make_nozzle(width, height, base=(96, 92, 104), rib_every=16):
    """노즐: 더 어둡고, 냉각 채널을 흉내 낸 촘촘한 리브 + 아래로 갈수록 그을음."""
    rows = []
    for y in range(height):
        row = []
        rib = (y % rib_every) < 2
        soot = 1.0 - 0.35 * (y / max(1, height - 1))  # 아래쪽이 더 탄 느낌
        for x in range(width):
            k = cylinder_shade(x, width) * soot
            r, g, b = (clamp(c * k) for c in base)
            if rib:
                r, g, b = clamp(r * 1.18), clamp(g * 1.18), clamp(b * 1.18)
            row.append((r, g, b, 255))
        rows.append(row)
    return rows


MAKERS = {
    "body": make_body,
    "nozzle": make_nozzle,
}


def draw_guides(rows, width, height):
    """정렬 확인용: 하이라이트 중심선(마젠타)과 좌우 가장자리(청록)를 1px 로 표시."""
    hi_x = int(0.35 * (width - 1))
    for y in range(height):
        rows[y][hi_x] = (255, 0, 200, 255)
        rows[y][0] = (0, 220, 220, 255)
        rows[y][width - 1] = (0, 220, 220, 255)
    for x in range(width):
        rows[0][x] = (0, 220, 220, 255)
        rows[height - 1][x] = (0, 220, 220, 255)
    return rows


def kind_of(name):
    for key in MAKERS:
        if name.endswith(key):
            return key
    return "body"


def main(argv=None):
    ap = argparse.ArgumentParser(description="SFS 부품 텍스처 템플릿 생성")
    ap.add_argument("--guides", action="store_true", help="정렬 가이드 선을 그린다")
    ap.add_argument("--force", action="store_true", help="이미 있는 파일도 덮어쓴다")
    args = ap.parse_args(argv)

    made = 0
    for spec_path in sorted(glob.glob(os.path.join(ROOT, "parts", "*.part.json"))):
        with open(spec_path, encoding="utf-8") as f:
            part = json.load(f)
        for tex in part.get("textures", []):
            out = os.path.join(ROOT, tex["file"])
            width, height = tex.get("size", [256, 256])
            if os.path.exists(out) and not args.force:
                print("건너뜀(이미 있음): {}".format(tex["file"]))
                continue
            os.makedirs(os.path.dirname(out), exist_ok=True)
            rows = MAKERS[kind_of(tex["name"])](width, height)
            if args.guides:
                rows = draw_guides(rows, width, height)
            write_png(out, rows, width, height)
            print("생성: {} ({}x{})".format(tex["file"], width, height))
            made += 1

    if made == 0:
        print("새로 만든 텍스처가 없다. 덮어쓰려면 --force 를 붙일 것.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

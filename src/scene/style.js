/**
 * ============================================================================
 *  아트 스타일 — "Surgeon Simulator" 풍 (밝은 병원 톤 + 장난감 같은 둥근 형태)
 * ============================================================================
 *
 *  원칙
 *   · 형태  : 모서리가 둥근 굵직한 덩어리 (RoundedBoxGeometry). 가는 디테일 대신 큰 실루엣.
 *   · 색    : 옅은 민트/크림 배경 + 파스텔 포인트(피치, 버터, 로즈, 스카이, 라벤더, 세이지).
 *             검정 외곽 대신 부드러운 청회색(ink). 빛(레이저)만 선명한 원색 → 시선이 광선으로 감
 *   · 재질  : 무광에 가까운 말랑한 플라스틱 (높은 거칠기 + 약한 클리어코트 + sheen)
 *   · 조명  : 강한 반구광(그림자 쪽도 밝게) + 넓게 번지는 VSM 소프트 그림자, Neutral 톤매핑
 *             (ACES보다 채도·명도를 덜 눌러 파스텔 색이 그대로 유지됨), 옅은 안개로 원경을 부드럽게
 *
 *  도구·씬 코드는 여기의 PALETTE / toy() / metal() / rbox() 만 써서 스타일을 한곳에서 바꿀 수 있다.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PALETTE = {
  // 배경 (아주 옅은 파스텔)
  mint: 0xd4f1ea,
  teal: 0xa6ddd2,
  tealDark: 0x86c7bb,
  white: 0xfcfbf8,
  offWhite: 0xf1efea,
  cream: 0xfaf5ec,
  tile: 0xf6f3ee,
  grout: 0xdcd6ce,
  steel: 0xd7dde2,
  ink: 0x5b6770,       // 검정 대신 부드러운 청회색
  // 포인트 (파스텔 원색)
  orange: 0xffb48f,    // 피치
  yellow: 0xffe08a,    // 버터
  red: 0xff9aa8,       // 로즈
  pink: 0xffc6d9,
  blue: 0x9cc4ff,      // 스카이
  purple: 0xc4b2ff,    // 라벤더
  green: 0xa8e6b0,     // 세이지
  glove: 0xb8dcff,
  scrubs: 0x9fdccf,
  wood: 0xf0cf9c,
  ledOn: 0x6fe38a,
  ledOff: 0xff8a8a,
};

/**
 * 부드러운 파스텔 플라스틱: 거칠기를 높이고 클리어코트를 약하게 → 반사광이 넓고 은은함.
 * sheen(천 표면 같은 가장자리 광택)으로 윤곽이 부드럽게 빛나 '말랑한' 느낌을 준다.
 */
export function toy(color, { rough = 0.55, clearcoat = 0.25, ...rest } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0, clearcoat, clearcoatRoughness: 0.45,
    specularIntensity: 0.35, sheen: 0.4, sheenRoughness: 0.8, sheenColor: 0xffffff, ...rest,
  });
}

/** 스테인리스·크롬 */
export function metal(color = PALETTE.steel, rough = 0.38) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: rough });
}

/** 모서리가 둥근 박스. r을 생략하면 가장 짧은 변의 30%. 세그먼트를 넉넉히(5) 줘서 곡면이 매끈. */
export function rbox(w, h, d, r) {
  const radius = r ?? Math.min(w, h, d) * 0.3;
  return new RoundedBoxGeometry(w, h, d, 5, Math.min(radius, Math.min(w, h, d) / 2 - 1e-4));
}

/** 둥근 원기둥 느낌: 원기둥 + 위아래 살짝 좁힌 뚜껑 대신, 세그먼트 넉넉한 원기둥 */
export function cyl(r, h, rTop = r, seg = 40) {
  return new THREE.CylinderGeometry(rTop, r, h, seg);
}

/** 굵은 글씨 라벨 텍스처 (간판, 찬장 표지) */
export function labelTexture(text, { bg = '#ffffff', fg = '#5b6770', border = '#ffffff', w = 512, h = 128, font = 64 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const r = h * 0.35;
  g.fillStyle = border;
  roundRect(g, 0, 0, w, h, r);
  g.fill();
  g.fillStyle = bg;
  roundRect(g, 8, 8, w - 16, h - 16, r - 6);
  g.fill();
  g.fillStyle = fg;
  let size = font;
  do g.font = `bold ${size}px Jua, Fredoka, "Arial Rounded MT Bold", sans-serif`;
  while (g.measureText(text).width > w - h * 0.6 && --size > 12);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

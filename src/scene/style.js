/**
 * ============================================================================
 *  아트 스타일 — "Surgeon Simulator" 풍 (밝은 병원 톤 + 장난감 같은 둥근 형태)
 * ============================================================================
 *
 *  원칙
 *   · 형태  : 모서리가 둥근 굵직한 덩어리 (RoundedBoxGeometry). 가는 디테일 대신 큰 실루엣.
 *   · 색    : 민트/흰색 병원 배경 위에 채도 높은 원색 포인트 (주황, 노랑, 빨강, 파랑, 보라)
 *   · 재질  : 광택 있는 플라스틱 (MeshPhysicalMaterial + clearcoat) — 환경맵 반사로 '장난감' 느낌
 *   · 조명  : 밝은 전체광 + 수술등 스포트라이트 + 부드러운 그림자, ACES 톤매핑
 *
 *  도구·씬 코드는 여기의 PALETTE / toy() / metal() / rbox() 만 써서 스타일을 한곳에서 바꿀 수 있다.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PALETTE = {
  mint: 0x8fe0cf,
  teal: 0x2fa89a,
  tealDark: 0x1d7d73,
  white: 0xf5f8f7,
  offWhite: 0xe3ebea,
  tile: 0xe9eff1,
  grout: 0xb9c7cc,
  steel: 0xc9d3d8,
  ink: 0x263238,
  orange: 0xff7a3d,
  yellow: 0xffcf3f,
  red: 0xff4d5a,
  blue: 0x3d8bff,
  purple: 0x8a6cff,
  green: 0x5ad16a,
  glove: 0x8fcaff,
  scrubs: 0x3fb5a5,
  wood: 0xe8b25a,
};

/** 광택 플라스틱 */
export function toy(color, { rough = 0.38, clearcoat = 0.7, ...rest } = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat, clearcoatRoughness: 0.25, specularIntensity: 0.5, ...rest });
}

/** 스테인리스·크롬 */
export function metal(color = PALETTE.steel, rough = 0.28) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: rough });
}

/** 모서리가 둥근 박스. r을 생략하면 가장 짧은 변의 22%. */
export function rbox(w, h, d, r) {
  const radius = r ?? Math.min(w, h, d) * 0.22;
  return new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, Math.min(w, h, d) / 2 - 1e-4));
}

/** 둥근 원기둥 느낌: 원기둥 + 위아래 살짝 좁힌 뚜껑 대신, 세그먼트 넉넉한 원기둥 */
export function cyl(r, h, rTop = r, seg = 28) {
  return new THREE.CylinderGeometry(rTop, r, h, seg);
}

/** 굵은 글씨 라벨 텍스처 (간판, 찬장 표지) */
export function labelTexture(text, { bg = '#ffffff', fg = '#263238', border = '#263238', w = 512, h = 128, font = 64 } = {}) {
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

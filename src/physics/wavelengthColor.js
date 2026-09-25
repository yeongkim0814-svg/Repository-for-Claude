/** 가시광 파장(nm) → 근사 RGB (Dan Bruton 근사). 광선·스크린 무늬 색에 공통 사용. */
import * as THREE from 'three';

export function wavelengthToColor(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else { r = 1; }
  // 가시광 양 끝에서 눈의 감도 저하
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  return new THREE.Color(r * f, g * f, b * f);
}

export function wavelengthToCss(nm, alpha = 1) {
  const c = wavelengthToColor(nm);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
}

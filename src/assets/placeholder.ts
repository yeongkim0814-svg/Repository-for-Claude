import * as THREE from 'three';
import type { PlaceholderSpec } from '../config/types';

/**
 * placeholder 도형 생성. 모델 규약과 동일하게 원점 = 바닥 중앙.
 * 크기·색은 전부 spec(assets.json)에서 온다.
 */
export function createPlaceholder(spec: PlaceholderSpec): THREE.Mesh {
  const [w, h, d] = spec.sizeM;
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(0, h / 2, 0);

  const material = new THREE.MeshLambertMaterial({
    color: new THREE.Color(spec.color),
    flatShading: true,
    // 방은 안쪽에서 보므로 뒷면을 그린다.
    side: spec.shape === 'room' ? THREE.BackSide : THREE.FrontSide,
  });

  return new THREE.Mesh(geometry, material);
}

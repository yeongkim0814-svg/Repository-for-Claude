/**
 * 광학 도구 공통 규약
 *  · 광축 높이 OPTICAL_AXIS_H: 모든 광학 도구의 "빛이 지나는 높이" (도구 바닥면 기준).
 *    같은 테이블에 놓으면 레이저 빔이 렌즈·슬릿·스크린 중심을 자동으로 지난다.
 *  · 도구 로컬 +Z = 정면(광원은 +Z로 빛을 냄, 소자는 ±Z 어느 쪽 빛도 받음)
 *
 *  optics 인터페이스 (ToolDefinition.optics)
 *    emit(entity, ctx)                → [{ origin, direction, light }]   광원만
 *    respond(entity, ray, hit, ctx)   → { rays?: [...], segments?: [...] }
 *        ray  = { origin, direction, light }  (월드 좌표)
 *        hit  = { point, distance, object }
 *        rays : 새로 나가는 광선 (월드 좌표). extraPath로 내부 광로 길이를 더할 수 있음
 *        segments : 소자 내부에서 빛이 지나간 구간 (그리기용, 예: 유리 속 광선)
 *    light = { wavelength(nm), power(W), coherent(bool), aperture? }
 */
import * as THREE from 'three';

export const OPTICAL_AXIS_H = 0.15;

const _q = new THREE.Quaternion();

/** 월드 점 → 도구 로컬 */
export function toLocal(entity, p) {
  _q.copy(entity.transform.quaternion).invert();
  return p.clone().sub(entity.transform.position).applyQuaternion(_q);
}
/** 월드 방향 → 도구 로컬 */
export function dirToLocal(entity, d) {
  _q.copy(entity.transform.quaternion).invert();
  return d.clone().applyQuaternion(_q);
}
/** 로컬 점 → 월드 */
export function toWorld(entity, p) {
  return new THREE.Vector3(p.x, p.y, p.z).applyQuaternion(entity.transform.quaternion).add(entity.transform.position);
}
/** 로컬 방향 → 월드 */
export function dirToWorld(entity, d) {
  return new THREE.Vector3(d.x, d.y, d.z).applyQuaternion(entity.transform.quaternion).normalize();
}

/** beam_output 포트마다 광선 하나씩 (광원 도구 공통) */
export function emitFromPorts(entity, light) {
  return entity
    .worldPortsOfType('beam_output')
    .filter((p) => p.active)
    .map((p) => ({ origin: p.origin, direction: p.direction, light: { ...light } }));
}

/** 빛의 세기를 곱한 새 light */
export const attenuate = (light, k, extra = {}) => ({ ...light, power: light.power * k, ...extra });

/**
 * URL 프리셋: ?demo=<이름>  (값 없이 ?demo 만 쓰면 Phase 0 성공 기준 데모)
 *
 *  (기본)  도르래 + 그 기둥을 겨냥한 레이저   → 빛이 닿아도 규칙이 없어 아무 일도 없음
 *  slit    레이저 → 이중 슬릿 → 스크린(정면)    → 간섭 무늬, 칠판에 Δy = λL/d. 우클릭/Z로 확대
 *  mirror  레이저 → 슬릿 → 거울(45°) → 스크린   → L이 꺾인 광로 전체로 계산되는지 확인
 *  lens    광선 상자 → 볼록 렌즈 → 스크린(f 위치) → 평행광이 초점에 모임
 *  tir     레이저 → 반원 유리 블록(45°)          → 전반사. 패널에서 방향을 30°대로 바꾸면 굴절
 */
import * as THREE from 'three';
import { TABLE } from './scene/LabScene.js';

const Y = TABLE.height;
const Z = TABLE.z;
const yawQ = (deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (deg * Math.PI) / 180);
const v = (x, z) => new THREE.Vector3(x, Y, z);

const PRESETS = {
  '': [
    ['pulley', v(-0.6, Z), 0],
    ['laser', v(0.7, Z - 0.05), -90],
  ],
  slit: [
    // 빔이 플레이어에서 멀어지는 방향(−Z)으로 → 스크린을 정면에서 본다
    ['laser', v(0, Z + 0.45), 180],
    ['slit', v(0, Z + 0.2), 0, { slitWidth: 60, slitSpacing: 200 }],
    ['screen', v(0, Z - 0.55), 0],         // L = 0.75 m → Δy = λL/d ≈ 2.4 mm
  ],
  mirror: [
    ['laser', v(1.3, Z + 0.3), -90],
    ['slit', v(0.9, Z + 0.3), 90],
    ['mirror', v(0.3, Z + 0.3), 135],      // 법선 = (−x 입사)와 (−z 반사)의 이등분선
    ['screen', v(0.3, Z - 0.45), 0],       // L = 0.6 + 0.75 = 1.35 m
  ],
  lens: [
    ['raybox', v(1.1, Z), -90],
    ['lens', v(0.55, Z), 90, { focalLength: 0.25 }],
    ['screen', v(0.3, Z), 90],             // 렌즈에서 f = 0.25 m 뒤 → 광선이 한 점에 모임
  ],
  tir: (() => {
    // 곡면 쪽에서 중심을 향해 θ = 45° 로 입사 (평평한 면 법선 기준) → n=1.5 에서 전반사
    const th = (45 * Math.PI) / 180, D = 0.28;
    const c = v(0, Z + 0.1);
    const laserPos = c.clone().add(new THREE.Vector3(Math.sin(th), 0, -Math.cos(th)).multiplyScalar(D + 0.135));
    return [
      ['glassblock', c, 0],
      ['laser', laserPos, -45],
    ];
  })(),
};

export function spawnDemo(ctx, name) {
  const list = PRESETS[name] ?? PRESETS[''];
  for (const [type, pos, deg, props] of list) {
    const def = ctx.tools.get(type);
    ctx.entities.spawn(def, pos, yawQ(deg), { ...def.defaultProperties, ...props });
  }
}

export const demoNames = Object.keys(PRESETS);

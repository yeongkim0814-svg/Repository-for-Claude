/**
 * 평면 거울 — physicsDomain: ["optical"]
 *
 * respond: 앞면(로컬 +Z 법선)에 닿은 빛만 반사  d' = d − 2(d·n)n
 *          뒷면·테두리에 닿으면 흡수(아무 광선도 돌려주지 않음)
 * 반사율 R: 반사광 세기 = R × 입사광 세기 (은도금 거울 ≈ 0.95)
 *
 * 입사각 = 반사각 은 식에서 자동으로 나온다: n 방향 성분만 부호가 바뀌고
 * 면에 나란한 성분은 그대로이므로 |cos θᵢ| = |cos θᵣ|.
 */
import * as THREE from 'three';
import { ToolRegistry } from '../../core/ToolRegistry.js';
import { PALETTE as C, toy, metal, rbox, cyl } from '../../scene/style.js';
import { reflect, dot, deg } from '../../physics/opticsMath.js';
import { OPTICAL_AXIS_H as H, toLocal, dirToWorld, attenuate } from './common.js';

const W = 0.14, HT = 0.1;

ToolRegistry.define({
  type: 'mirror',
  label: '평면 거울',
  icon: '🪞',
  description: '앞면(흰 화살표 쪽)으로 들어온 빛을 반사한다. 설정 패널의 "방향"으로 각도를 1° 단위 조절.',
  physicsDomain: ['optical'],
  defaultProperties: { reflectivity: 0.95 },
  propertyMeta: {
    reflectivity: { label: '반사율 R', min: 0, max: 1, step: 0.01, rebuild: false },
  },
  interactionPorts: [
    { name: 'face', type: 'beam_input', origin: [0, H, 0.012], direction: [0, 0, 1] },
  ],
  footprint: () => ({ x: 0.085, y: 0.105, z: 0.04 }),

  buildMesh() {
    const root = new THREE.Group();
    const base = new THREE.Mesh(rbox(0.12, 0.022, 0.07), toy(C.purple));
    base.position.y = 0.011;
    const post = new THREE.Mesh(cyl(0.012, H - 0.06), toy(C.white));
    post.position.set(0, 0.022 + (H - 0.06) / 2, -0.012);
    const frame = new THREE.Mesh(rbox(W + 0.02, HT + 0.02, 0.018, 0.009), toy(C.pink));
    frame.position.set(0, H, -0.004);
    const glass = new THREE.Mesh(rbox(W, HT, 0.006, 0.003), metal(0xf4f7ff, 0.04));
    glass.material.metalness = 1;
    glass.position.set(0, H, 0.007);
    glass.name = 'glass';
    root.add(base, post, frame, glass);
    return root;
  },

  optics: {
    respond(entity, ray, hit) {
      const n = dirToWorld(entity, { x: 0, y: 0, z: 1 });
      const cosI = -dot(ray.direction, n);
      const lp = toLocal(entity, hit.point);
      const onGlass = Math.abs(lp.x) < W / 2 && Math.abs(lp.y - H) < HT / 2;
      if (cosI <= 0 || !onGlass) return {}; // 뒷면·테두리 = 흡수
      const r = reflect(ray.direction, n);
      entity.state.optics.last = { thetaI: deg(Math.acos(Math.min(1, cosI))), thetaR: deg(Math.acos(Math.min(1, dot(r, n)))) };
      return {
        rays: [{
          origin: hit.point.clone(),
          direction: new THREE.Vector3(r.x, r.y, r.z).normalize(),
          light: attenuate(ray.light, entity.properties.reflectivity),
        }],
      };
    },
  },

  readouts(entity) {
    const l = entity.state.optics?.last;
    return {
      '입사각 θᵢ (법선 기준)': l ? `${l.thetaI.toFixed(1)}°` : '빛이 앞면에 닿지 않음',
      '반사각 θᵣ': l ? `${l.thetaR.toFixed(1)}°` : '-',
      '반사율 R': `${(entity.properties.reflectivity * 100).toFixed(0)} %`,
    };
  },
});

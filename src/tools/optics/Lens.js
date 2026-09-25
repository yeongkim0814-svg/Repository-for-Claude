/**
 * 얇은 렌즈 — physicsDomain: ["optical"]
 *
 * respond: 렌즈면(로컬 z=0)의 높이 h에서 광선 기울기가 h/f 만큼 광축 쪽으로 꺾인다.
 *            t' = t − h/f   (opticsMath.thinLens)
 *          f > 0 볼록(모으는) 렌즈, f < 0 오목(퍼뜨리는) 렌즈. 테두리 밖은 흡수.
 *
 * 이 모델이 깨지는 곳 (근축 근사의 한계)
 *   · h/f 가 크면(렌즈 가장자리, 짧은 초점) 실제 렌즈는 구면 수차로 초점이 흐려지지만
 *     여기서는 모든 평행광이 정확히 한 점에 모인다.
 *   · 두께·굴절률에 따른 초점거리 변화(렌즈 제작자 공식)와 색수차(파장별 f)는 무시.
 */
import * as THREE from 'three';
import { ToolRegistry } from '../../core/ToolRegistry.js';
import { PALETTE as C, toy, rbox, cyl } from '../../scene/style.js';
import { thinLens } from '../../physics/opticsMath.js';
import { OPTICAL_AXIS_H as H, toLocal, toWorld, dirToLocal, dirToWorld, attenuate } from './common.js';

const clampF = (f) => (Math.abs(f) < 0.02 ? (f < 0 ? -0.02 : 0.02) : f);

ToolRegistry.define({
  type: 'lens',
  label: '얇은 렌즈',
  icon: '🔍',
  description: '초점거리 f (양수 = 볼록, 음수 = 오목). 광선 상자의 평행광으로 초점을 찾아보자.',
  physicsDomain: ['optical'],
  defaultProperties: { focalLength: 0.25, diameter: 0.09, transmittance: 0.96 },
  propertyMeta: {
    focalLength: { label: '초점거리 f', min: -0.5, max: 0.5, step: 0.01, unit: 'm' },
    diameter: { label: '지름 D', min: 0.03, max: 0.12, step: 0.005, unit: 'm' },
    transmittance: { label: '투과율', min: 0, max: 1, step: 0.01, rebuild: false },
  },
  interactionPorts: [
    { name: 'front', type: 'beam_input', origin: [0, H, 0], direction: [0, 0, 1] },
    { name: 'back', type: 'beam_input', origin: [0, H, 0], direction: [0, 0, -1] },
  ],
  footprint: (p) => ({ x: Math.max(0.06, p.diameter / 2 + 0.012), y: (H + p.diameter / 2 + 0.015) / 2, z: 0.035 }),

  buildMesh(p) {
    const r = p.diameter / 2;
    const f = clampF(p.focalLength);
    const root = new THREE.Group();
    const base = new THREE.Mesh(rbox(0.1, 0.022, 0.06), toy(C.blue));
    base.position.y = 0.011;
    const post = new THREE.Mesh(cyl(0.011, H - r - 0.02), toy(C.white));
    post.position.y = 0.022 + (H - r - 0.02) / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.006, 16, 48), toy(C.blue));
    ring.position.y = H;

    // 유리: 볼록은 가운데가 두껍고, 오목은 가장자리가 두껍다 (두께는 1/|f| 에 비례하게 과장)
    const bulge = Math.min(0.02, 0.0015 / Math.abs(f)) * (f > 0 ? 1 : -1);
    const edge = f > 0 ? 0.003 : 0.004 + Math.abs(bulge);
    const pts = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const rho = (r * i) / n;
      pts.push(new THREE.Vector2(rho, edge / 2 + bulge * (1 - (rho / r) ** 2)));
    }
    for (let i = n; i >= 0; i--) {
      const rho = (r * i) / n;
      pts.push(new THREE.Vector2(rho, -(edge / 2 + bulge * (1 - (rho / r) ** 2))));
    }
    const glassGeo = new THREE.LatheGeometry(pts, 48).rotateX(Math.PI / 2);
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({
      color: 0xdff3ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
    }));
    glass.position.y = H;
    glass.name = 'glass';
    root.add(base, post, ring, glass);
    return root;
  },

  optics: {
    respond(entity, ray, hit) {
      const p = entity.properties;
      const lp = toLocal(entity, hit.point);
      const hx = lp.x, hy = lp.y - H;
      if (Math.hypot(hx, hy) > p.diameter / 2) return {}; // 테두리 = 흡수
      const d = thinLens(dirToLocal(entity, ray.direction), hx, hy, clampF(p.focalLength));
      entity.state.optics.h = Math.hypot(hx, hy);
      return {
        rays: [{
          origin: toWorld(entity, { x: hx, y: lp.y, z: 0 }), // 렌즈면에서 출발
          direction: dirToWorld(entity, d),
          light: attenuate(ray.light, p.transmittance),
        }],
      };
    },
  },

  readouts(entity) {
    const f = clampF(entity.properties.focalLength);
    return {
      '종류': f > 0 ? '볼록 렌즈 (모음)' : '오목 렌즈 (퍼뜨림)',
      '굴절력 P = 1/f': `${(1 / f).toFixed(2)} D (디옵터)`,
      '평행광의 초점': f > 0 ? `렌즈 뒤 ${f.toFixed(3)} m 에 실초점` : `렌즈 앞 ${(-f).toFixed(3)} m 에 허초점`,
      '렌즈 공식': '1/a + 1/b = 1/f',
      '마지막 광선 높이 h': entity.state.optics?.h != null ? `${(entity.state.optics.h * 1000).toFixed(1)} mm` : '-',
    };
  },
});

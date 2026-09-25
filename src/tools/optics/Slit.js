/**
 * N-슬릿 (단일 슬릿 · 영의 이중 슬릿 · 회절격자) — physicsDomain: ["optical"]
 *
 * respond: 빔이 가운데 창(±6 mm)에 닿으면 같은 방향으로 통과시키고, 빛에
 *          aperture 정보를 붙인다. 판의 다른 곳에 닿으면 흡수.
 *
 * 회절·간섭 무늬 자체는 여기서 그리지 않는다. 무늬는 "슬릿 + 스크린" 조합으로만
 * 생기는 현상이므로 InteractionRegistry의 ('slit','screen') 규칙이 계산한다
 * (src/interaction/rules.js). 슬릿은 자기 성질(a, d, N)만 알고, 스크린까지의 거리 L은
 * broad phase가 알려 준다.
 *
 * 기하광학 광선은 슬릿을 지나 직진만 한다 (= 0차 중앙 극대 방향). 옆으로 퍼지는
 * 회절광은 광선 하나로 표현할 수 없어 스크린 위의 세기 분포로만 나타낸다.
 */
import * as THREE from 'three';
import { ToolRegistry } from '../../core/ToolRegistry.js';
import { PALETTE as C, toy, rbox, cyl } from '../../scene/style.js';
import { OPTICAL_AXIS_H as H, toLocal, attenuate } from './common.js';

const WINDOW = 0.006; // 빔을 통과시키는 창의 반폭 (m)

ToolRegistry.define({
  type: 'slit',
  label: 'N-슬릿',
  icon: '▥',
  description: 'N=1 단일 슬릿, N=2 영의 이중 슬릿, N이 크면 회절격자. 레이저 + 스크린과 함께.',
  physicsDomain: ['optical'],
  defaultProperties: { slitCount: 2, slitWidth: 80, slitSpacing: 300 },
  propertyMeta: {
    slitCount: { label: '슬릿 개수 N', min: 1, max: 20, step: 1, rebuild: false },
    slitWidth: { label: '슬릿 폭 a', min: 10, max: 400, step: 5, unit: 'μm', rebuild: false },
    slitSpacing: { label: '슬릿 간격 d', min: 50, max: 1500, step: 10, unit: 'μm', rebuild: false },
  },
  interactionPorts: [
    { name: 'in', type: 'beam_input', origin: [0, H, 0], direction: [0, 0, 1] },
    { name: 'out', type: 'beam_output', origin: [0, H, 0], direction: [0, 0, -1] },
  ],
  footprint: () => ({ x: 0.085, y: 0.11, z: 0.035 }),

  buildMesh() {
    const root = new THREE.Group();
    const base = new THREE.Mesh(rbox(0.12, 0.022, 0.06), toy(C.yellow));
    base.position.y = 0.011;
    const post = new THREE.Mesh(cyl(0.011, H - 0.08), toy(C.white));
    post.position.y = 0.022 + (H - 0.08) / 2;
    const plate = new THREE.Mesh(rbox(0.16, 0.13, 0.008, 0.004), toy(C.yellow));
    plate.position.y = H;
    // 가운데 창: 어두운 사각형 + 세로줄 (슬릿 모양 암시)
    const win = new THREE.Mesh(rbox(WINDOW * 2, WINDOW * 2, 0.009, 0.002), new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.6 }));
    win.position.y = H;
    const lines = new THREE.Group();
    for (let i = -1; i <= 1; i += 2) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.0008, WINDOW * 1.8, 0.0095), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
      l.position.set(i * 0.0018, H, 0);
      lines.add(l);
    }
    root.add(base, post, plate, win, lines);
    return root;
  },

  optics: {
    respond(entity, ray, hit) {
      const lp = toLocal(entity, hit.point);
      if (Math.abs(lp.x) > WINDOW || Math.abs(lp.y - H) > WINDOW) return {}; // 판에 막힘
      const p = entity.properties;
      entity.state.optics.passed = true;
      // 통과하는 빛의 비율 ≈ 열린 폭 / 빔 폭 (빔 지름 ~2 mm 가정, 시각용)
      const k = Math.min(0.9, Math.max(0.08, (p.slitCount * p.slitWidth * 1e-6) / 2e-3));
      return {
        rays: [{
          origin: hit.point.clone(),
          direction: ray.direction.clone(),
          light: attenuate(ray.light, k, { aperture: { slitId: entity.id } }),
        }],
      };
    },
  },

  readouts(entity) {
    const p = entity.properties;
    const pat = entity.state.pattern; // ('slit','screen') 규칙이 채움
    const out = {
      '빔 통과': entity.state.optics?.passed ? '예' : '아니오 (창을 겨냥하세요)',
      '구성': p.slitCount === 1 ? '단일 슬릿' : p.slitCount === 2 ? '이중 슬릿 (영)' : `회절격자 N=${p.slitCount}`,
    };
    if (pat) {
      out['스크린까지 광로 L'] = `${pat.L.toFixed(3)} m`;
      out['첫 어두운 무늬 y₁ = λL/a'] = `${(pat.y1 * 1000).toFixed(2)} mm`;
      if (p.slitCount > 1) out['밝은 무늬 간격 Δy = λL/d'] = `${(pat.dy * 1000).toFixed(2)} mm`;
    } else {
      out['스크린'] = '연결 안 됨';
    }
    return out;
  },
});

/**
 * ============================================================================
 *  레이저  —  physicsDomain: ["optical"]
 * ============================================================================
 *
 *  포트: beam_output  (로컬 origin = 출사구, direction = 로컬 +Z)
 *  매 프레임 BeamTracer로 포트에서 반직선을 쏘아 처음 닿는 불투명 물체까지 빔을 그린다.
 *  (빛이 불투명한 물체에서 멈추는 것은 기하광학의 기본 성질이지 "도구 간 상호작용"이
 *   아니다. 상호작용이란 한쪽 도구의 상태가 다른 도구 때문에 바뀌는 것 — 예: 슬릿이
 *   빔을 받아 회절 무늬를 만드는 것 — 이고 그것은 InteractionRegistry의 몫이다.)
 *
 *  광자 관점 측정값
 *   E_photon = hc/λ,   초당 광자 수 N = P / E_photon
 *   (632.8 nm He-Ne, 5 mW → E ≈ 1.96 eV, N ≈ 1.6×10¹⁶ 개/s)
 *
 *  다음 Phase: 슬릿/거울/렌즈가 등록되면 이 빔이 그 도구에 닿는 순간 broad phase가
 *  (laser, slit) 후보를 만들고, InteractionRegistry.register('laser','slit', …) 핸들러가
 *  ctx.contact.hit.point(빔-슬릿 교차점)로 회절 무늬를 계산한다.
 */
import * as THREE from 'three';
import { ToolRegistry } from '../core/ToolRegistry.js';
import { PALETTE as PAL, toy, metal, rbox, cyl } from '../scene/style.js';

const BEAM_Y = 0.15;
const APERTURE_Z = 0.135;
const H = 6.62607015e-34;
const C = 299792458;
const EV = 1.602176634e-19;

/** 가시광 파장(nm) → 근사 RGB (Dan Bruton 근사) */
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

export const LaserTool = ToolRegistry.define({
  type: 'laser',
  label: '레이저',
  icon: '🔦',
  description: '단색 레이저 광원. 흰 화살표(+Z) 방향으로 직진하는 빔을 쏜다.',
  physicsDomain: ['optical'],
  defaultProperties: {
    wavelength: 632.8,
    power: 5,
    enabled: true,
  },
  propertyMeta: {
    wavelength: { label: '파장 λ', min: 380, max: 750, step: 0.1, unit: 'nm', rebuild: false },
    power: { label: '출력 P', min: 0.5, max: 50, step: 0.5, unit: 'mW', rebuild: false },
    enabled: { label: '전원', rebuild: false },
  },
  interactionPorts: [
    { name: 'beam', type: 'beam_output', origin: [0, BEAM_Y, APERTURE_Z], direction: [0, 0, 1] },
  ],

  footprint: () => ({ x: 0.06, y: 0.1, z: 0.14 }),

  buildMesh() {
    const root = new THREE.Group();
    const base = new THREE.Mesh(rbox(0.11, 0.025, 0.27, 0.01), toy(PAL.blue));
    base.position.y = 0.0125;
    const post = new THREE.Mesh(cyl(0.014, BEAM_Y - 0.06), toy(PAL.white));
    post.position.y = 0.025 + (BEAM_Y - 0.06) / 2;
    const clamp = new THREE.Mesh(rbox(0.05, 0.03, 0.06, 0.01), toy(PAL.white));
    clamp.position.y = BEAM_Y - 0.045;
    // 몸통: 굵직한 주황 박스 + 노랑/검정 경고 띠 + 앞쪽 크롬 노즐
    const body = new THREE.Mesh(rbox(0.078, 0.078, 0.23, 0.022), toy(PAL.orange));
    body.position.set(0, BEAM_Y, -0.01);
    const stripe = new THREE.Mesh(rbox(0.082, 0.082, 0.03, 0.02), toy(PAL.yellow));
    stripe.position.set(0, BEAM_Y, 0.05);
    const back = new THREE.Mesh(rbox(0.07, 0.07, 0.02, 0.012), toy(PAL.white));
    back.position.set(0, BEAM_Y, -0.13);
    const nozzle = new THREE.Mesh(cyl(0.026, 0.035, 0.02, 24), metal());
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, BEAM_Y, APERTURE_Z - 0.018);
    const aperture = new THREE.Mesh(new THREE.CircleGeometry(0.009, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    aperture.position.set(0, BEAM_Y, APERTURE_Z + 0.0005);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: PAL.green }));
    led.position.set(0, BEAM_Y + 0.04, -0.08);
    led.name = 'led';
    root.add(base, post, clamp, body, stripe, back, nozzle, aperture, led);

    // 빔: 가는 심 + 바깥 글로우 (길이 1로 만들어 두고 scale.z로 늘림) + 맞은 지점 광점
    const beamGeo = (r) => cyl(r, 1, r, 10).translate(0, 0.5, 0).rotateX(Math.PI / 2);
    const additive = (opacity) => new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const core = () => new THREE.MeshBasicMaterial({ color: 0xff2200, toneMapped: false });
    const beam = new THREE.Mesh(beamGeo(0.0024), core());
    beam.add(new THREE.Mesh(beamGeo(0.007), additive(0.25)));
    beam.position.set(0, BEAM_Y, APERTURE_Z);
    beam.name = 'beam';
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), core());
    spot.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), additive(0.25)));
    spot.name = 'spot';
    for (const m of [beam, spot]) {
      m.traverse((o) => (o.userData.noRaycast = true)); // 조준·다른 빔이 빔 자체에 맞지 않도록
      m.visible = false;           // 고스트/손에 든 모습에서는 숨김. 배치 후 update()가 켠다.
      root.add(m);
    }
    return root;
  },

  onSpawn(entity) {
    applyColor(entity);
  },

  onPropertyChange(entity) {
    applyColor(entity);
  },

  update(entity, dt, ctx) {
    const p = entity.properties;
    const port = entity.interactionPorts[0];
    port.active = p.enabled; // 전원이 꺼지면 broad phase에서도 빔이 사라진다
    const beam = entity.mesh.getObjectByName('beam');
    const spot = entity.mesh.getObjectByName('spot');
    beam.visible = spot.visible = p.enabled;
    entity.mesh.getObjectByName('led').material.color.set(p.enabled ? PAL.green : PAL.red);
    if (!p.enabled) {
      entity.state.hit = null;
      return;
    }
    const hit = ctx.beamTracer.trace(entity, entity.toWorldPort(port));
    entity.state.hit = hit;
    beam.scale.z = hit.distance; // rotateX 후 길이 방향이 로컬 Z
    spot.position.set(0, BEAM_Y, APERTURE_Z + hit.distance);
  },

  readouts(entity) {
    const p = entity.properties;
    const E = (H * C) / (p.wavelength * 1e-9);
    const hit = entity.state.hit;
    return {
      '광자 에너지 E = hc/λ': `${(E / EV).toFixed(3)} eV`,
      '초당 광자 수 N = P/E': `${((p.power * 1e-3) / E).toExponential(2)} /s`,
      '진동수 f = c/λ': `${(C / (p.wavelength * 1e-9) / 1e12).toFixed(1)} THz`,
      '빔이 닿은 곳': hit ? (hit.entity ? hit.entity.label : '환경(벽/테이블 등)') : '-',
      '빔 길이': hit ? `${hit.distance.toFixed(3)} m` : '-',
    };
  },
});

function applyColor(entity) {
  const p = entity.properties;
  const c = wavelengthToColor(p.wavelength);
  const beam = entity.mesh.getObjectByName('beam');
  const spot = entity.mesh.getObjectByName('spot');
  for (const o of [beam, spot]) o.traverse((m) => m.material?.color.copy(c));
  // 출력이 클수록 빔이 굵고 진하게 (시각적 표현, 로그 스케일)
  const k = 0.6 + 0.4 * Math.log10(p.power);
  beam.scale.x = beam.scale.y = Math.max(0.5, k);
  beam.children[0].material.opacity = Math.min(0.6, 0.15 + 0.12 * Math.log10(p.power)); // 글로우 세기
}

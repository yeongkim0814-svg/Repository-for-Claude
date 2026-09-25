/**
 * ============================================================================
 *  레이저  —  physicsDomain: ["optical"]   (결맞는 단색 광원)
 * ============================================================================
 *
 *  포트: beam_output  (로컬 origin = 출사구, direction = 로컬 +Z)
 *  optics.emit: 전원이 켜져 있으면 포트에서 광선 하나를 낸다. 빛이 어디로 가는지
 *  (거울 반사, 렌즈 굴절, 흡수)는 OpticalSystem이 푼다.
 *
 *  light.coherent = true : 레이저 빛은 위상이 고른(결맞는) 빛이라 슬릿을 지나면
 *  간섭 무늬를 만든다. 광선 상자(백열등)의 빛은 coherent=false → 무늬 없음.
 *
 *  광자 관점 측정값
 *   E_photon = hc/λ,   초당 광자 수 N = P / E_photon
 *   (632.8 nm He-Ne, 5 mW → E ≈ 1.96 eV, N ≈ 1.6×10¹⁶ 개/s)
 */
import * as THREE from 'three';
import { ToolRegistry } from '../core/ToolRegistry.js';
import { PALETTE as PAL, toy, metal, rbox, cyl } from '../scene/style.js';
import { OPTICAL_AXIS_H, emitFromPorts } from './optics/common.js';

const BEAM_Y = OPTICAL_AXIS_H;
const APERTURE_Z = 0.135;
const H = 6.62607015e-34;
const C = 299792458;
const EV = 1.602176634e-19;

export const LaserTool = ToolRegistry.define({
  type: 'laser',
  label: '레이저',
  icon: '🔦',
  description: '결맞는 단색 광원. 흰 화살표(+Z) 방향으로 빔을 쏜다. 슬릿과 함께 쓰면 간섭 무늬.',
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
    const base = new THREE.Mesh(rbox(0.11, 0.025, 0.27, 0.012), toy(PAL.blue));
    base.position.y = 0.0125;
    const post = new THREE.Mesh(cyl(0.014, BEAM_Y - 0.06), toy(PAL.white));
    post.position.y = 0.025 + (BEAM_Y - 0.06) / 2;
    const clamp = new THREE.Mesh(rbox(0.05, 0.03, 0.06, 0.012), toy(PAL.white));
    clamp.position.y = BEAM_Y - 0.045;
    const body = new THREE.Mesh(rbox(0.078, 0.078, 0.23, 0.03), toy(PAL.orange));
    body.position.set(0, BEAM_Y, -0.01);
    const stripe = new THREE.Mesh(rbox(0.082, 0.082, 0.03, 0.028), toy(PAL.yellow));
    stripe.position.set(0, BEAM_Y, 0.05);
    const back = new THREE.Mesh(rbox(0.07, 0.07, 0.02, 0.01), toy(PAL.white));
    back.position.set(0, BEAM_Y, -0.13);
    const nozzle = new THREE.Mesh(cyl(0.026, 0.035, 0.02, 24), metal());
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, BEAM_Y, APERTURE_Z - 0.018);
    const aperture = new THREE.Mesh(new THREE.CircleGeometry(0.009, 16), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    aperture.position.set(0, BEAM_Y, APERTURE_Z + 0.0005);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), new THREE.MeshBasicMaterial({ color: PAL.ledOn }));
    led.position.set(0, BEAM_Y + 0.04, -0.08);
    led.name = 'led';
    root.add(base, post, clamp, body, stripe, back, nozzle, aperture, led);
    return root;
  },

  optics: {
    emit(entity) {
      const p = entity.properties;
      return emitFromPorts(entity, { wavelength: p.wavelength, power: p.power * 1e-3, coherent: true });
    },
  },

  update(entity) {
    const p = entity.properties;
    entity.interactionPorts[0].active = p.enabled; // 전원이 꺼지면 광선도, broad phase 연결도 사라진다
    entity.mesh.getObjectByName('led').material.color.set(p.enabled ? PAL.ledOn : PAL.ledOff);
  },

  readouts(entity) {
    const p = entity.properties;
    const E = (H * C) / (p.wavelength * 1e-9);
    const hit = entity.state.firstHit;
    return {
      '광자 에너지 E = hc/λ': `${(E / EV).toFixed(3)} eV`,
      '초당 광자 수 N = P/E': `${((p.power * 1e-3) / E).toExponential(2)} /s`,
      '진동수 f = c/λ': `${(C / (p.wavelength * 1e-9) / 1e12).toFixed(1)} THz`,
      '빔이 처음 닿은 곳': hit ? (hit.entity ? hit.entity.label : '환경(벽/테이블 등)') : '-',
      '첫 구간 길이': hit ? `${hit.distance.toFixed(3)} m` : '-',
    };
  },
});

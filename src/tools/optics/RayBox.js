/**
 * 광선 상자 — physicsDomain: ["optical"]
 *
 * 학교 광학 실험의 "광선 상자": 나란한 광선 여러 개를 낸다. 렌즈의 초점, 거울의 반사를
 * 한눈에 보기 좋다. 레이저와 달리 결맞지 않는 빛(coherent: false)이라 슬릿을
 * 지나도 간섭 무늬가 생기지 않는다 → ('slit','screen') 규칙이 light.coherent 를 확인.
 *
 * 포트 개수가 속성(광선 수)에 따라 달라지므로 interactionPorts 를 함수로 정의한다.
 * (EntityManager.rebuild 가 속성 변경 시 포트를 다시 만든다)
 */
import * as THREE from 'three';
import { ToolRegistry } from '../../core/ToolRegistry.js';
import { PALETTE as C, toy, rbox } from '../../scene/style.js';
import { OPTICAL_AXIS_H as H, emitFromPorts } from './common.js';

const FRONT_Z = 0.08;

ToolRegistry.define({
  type: 'raybox',
  label: '광선 상자',
  icon: '🔆',
  description: '나란한 광선 여러 개 (결맞지 않은 빛). 렌즈 초점·거울 반사를 보기 좋다.',
  physicsDomain: ['optical'],
  defaultProperties: { rayCount: 5, spacing: 1.5, wavelength: 530, power: 3, enabled: true },
  propertyMeta: {
    rayCount: { label: '광선 수', min: 1, max: 9, step: 1 },
    spacing: { label: '광선 간격', min: 0.5, max: 2.5, step: 0.1, unit: 'cm' },
    wavelength: { label: '파장 λ', min: 380, max: 750, step: 1, unit: 'nm', rebuild: false },
    power: { label: '광선당 출력', min: 0.5, max: 20, step: 0.5, unit: 'mW', rebuild: false },
    enabled: { label: '전원', rebuild: false },
  },
  interactionPorts: (p) => Array.from({ length: p.rayCount }, (_, i) => ({
    name: `ray${i}`,
    type: 'beam_output',
    origin: [(i - (p.rayCount - 1) / 2) * p.spacing * 0.01, H, FRONT_Z + 0.004],
    direction: [0, 0, 1],
  })),
  footprint: (p) => ({ x: Math.max(0.07, ((p.rayCount - 1) * p.spacing * 0.01) / 2 + 0.03), y: 0.1, z: 0.09 }),

  buildMesh(p) {
    const root = new THREE.Group();
    const w = Math.max(0.14, (p.rayCount - 1) * p.spacing * 0.01 + 0.06);
    const body = new THREE.Mesh(rbox(w, 0.13, 0.16, 0.035), toy(C.green));
    body.position.set(0, 0.075, 0);
    const face = new THREE.Mesh(rbox(w - 0.02, 0.05, 0.01, 0.005), toy(C.white));
    face.position.set(0, H, FRONT_Z - 0.002);
    root.add(body, face);
    for (let i = 0; i < p.rayCount; i++) {
      const hole = new THREE.Mesh(rbox(0.003, 0.03, 0.004, 0.0012), new THREE.MeshBasicMaterial({ color: 0xfff8d0, toneMapped: false }));
      hole.position.set((i - (p.rayCount - 1) / 2) * p.spacing * 0.01, H, FRONT_Z + 0.003);
      root.add(hole);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), toy(C.yellow));
    knob.position.set(w / 2 - 0.02, 0.145, -0.04);
    root.add(knob);
    return root;
  },

  optics: {
    emit(entity) {
      const p = entity.properties;
      if (!p.enabled) return [];
      return emitFromPorts(entity, { wavelength: p.wavelength, power: p.power * 1e-3, coherent: false });
    },
  },

  readouts(entity) {
    const p = entity.properties;
    return {
      '광선 수 × 간격': `${p.rayCount} × ${p.spacing.toFixed(1)} cm`,
      '빛의 종류': '결맞지 않음 (간섭 무늬 없음)',
    };
  },
});

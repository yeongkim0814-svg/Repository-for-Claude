/**
 * 스크린 — physicsDomain: ["optical"]
 *
 * respond: 닿은 빛을 흡수하면서 그 위치·색·세기를 기록한다 (광점).
 * 회절 무늬: ('slit','screen') 규칙이 entity.state.patterns 에 무늬 파라미터를 넣으면
 *           스크린이 N-슬릿 세기 공식으로 CanvasTexture 에 그린다.
 *
 * 좌표: 스크린 판 = 로컬 XY 평면(z=0), 가운데 = (0, H). 앞면은 +Z.
 * 캔버스 2048 px ↔ 폭 0.5 m → 1 px ≈ 0.24 mm. 이중 슬릿 무늬 간격(수 mm)이 충분히 보인다.
 * 아래쪽 눈금자(1 mm / 1 cm)로 무늬 간격을 직접 재서 λ = Δy·d/L 을 역산해 볼 수 있다.
 */
import * as THREE from 'three';
import { ToolRegistry } from '../../core/ToolRegistry.js';
import { PALETTE as C, toy, rbox, cyl } from '../../scene/style.js';
import { nSlitIntensity } from '../../physics/opticsMath.js';
import { wavelengthToCss } from '../../physics/wavelengthColor.js';
import { OPTICAL_AXIS_H as H, toLocal } from './common.js';

const SW = 0.5, SH = 0.26;
const PX_W = 2048, PX_H = Math.round((PX_W * SH) / SW);
const M_PER_PX = SW / PX_W;
const BAR_HALF = 0.006; // 무늬 막대 세로 반길이 (m). 실제 빔 높이(~2 mm)보다 과장해서 보기 좋게

/** 스크린 로컬 (x, y) → 캔버스 px */
const toPx = (x, y) => ({ u: (x / SW + 0.5) * PX_W, v: (0.5 - (y - H) / SH) * PX_H });

ToolRegistry.define({
  type: 'screen',
  label: '스크린',
  icon: '🖼',
  description: '빛이 닿은 곳을 보여 주는 스크린. 슬릿 뒤에 두면 회절·간섭 무늬가 나타난다. 아래 눈금 1 mm.',
  physicsDomain: ['optical'],
  defaultProperties: { gain: 5, showRuler: true },
  propertyMeta: {
    gain: { label: '밝기 증폭', min: 1, max: 20, step: 0.5, rebuild: false },
    showRuler: { label: '눈금자 표시', rebuild: false },
  },
  interactionPorts: [{ name: 'face', type: 'beam_input', origin: [0, H, 0], direction: [0, 0, 1] }],
  footprint: () => ({ x: SW / 2 + 0.02, y: (H + SH / 2 + 0.02) / 2, z: 0.04 }),

  buildMesh() {
    const root = new THREE.Group();
    const base = new THREE.Mesh(rbox(SW + 0.03, 0.02, 0.07), toy(C.purple));
    base.position.y = 0.01;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(cyl(0.01, H - SH / 2), toy(C.white));
      post.position.set(sx * (SW / 2 - 0.04), 0.02 + (H - SH / 2 - 0.02) / 2, -0.012);
      root.add(post);
    }
    const frame = new THREE.Mesh(rbox(SW + 0.03, SH + 0.03, 0.016, 0.008), toy(C.purple));
    frame.position.set(0, H, -0.01);

    const canvas = document.createElement('canvas');
    canvas.width = PX_W;
    canvas.height = PX_H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    board.position.set(0, H, 0.0005);
    board.name = 'board';
    board.userData.noSpot = true;
    board.userData.canvas = canvas;
    board.userData.texture = tex;
    root.add(base, frame, board);
    return root;
  },

  onSpawn(entity) {
    entity.state.patterns = new Map(); // slitId → 무늬 파라미터 (규칙이 관리)
    entity.state.sig = '';
  },

  optics: {
    respond(entity, ray, hit) {
      const lp = toLocal(entity, hit.point);
      if (Math.abs(lp.x) <= SW / 2 && Math.abs(lp.y - H) <= SH / 2 && lp.z > -0.002) {
        (entity.state.optics.spots ??= []).push({ x: lp.x, y: lp.y, wavelength: ray.light.wavelength, power: ray.light.power });
      }
      return {}; // 흡수
    },
  },

  update(entity) {
    const p = entity.properties;
    const spots = entity.state.optics?.spots ?? [];
    const pats = [...entity.state.patterns.values()];
    // 바뀐 게 있을 때만 다시 그린다
    const sig = JSON.stringify([
      p.gain, p.showRuler,
      spots.map((s) => [Math.round(s.x * 2000), Math.round(s.y * 2000), s.wavelength | 0, s.power.toExponential(1)]),
      pats.map((q) => [q.u0, q.v0, q.ex, q.ey, q.lambda, q.a, q.d, q.N, q.L.toFixed(4)].map((v) => (typeof v === 'number' ? +v.toFixed(3) : v))),
    ]);
    if (sig === entity.state.sig) return;
    entity.state.sig = sig;
    draw(entity.mesh.getObjectByName('board'), p, spots, pats);
  },

  readouts(entity) {
    const spots = entity.state.optics?.spots ?? [];
    const out = { '닿은 광선 수': `${spots.length}` };
    for (const q of entity.state.patterns?.values() ?? []) {
      out[`무늬 (${q.N === 1 ? '단일 슬릿' : `${q.N}-슬릿`})`] = `λ=${q.lambda.toFixed(1)} nm, L=${q.L.toFixed(3)} m`;
      out['  첫 어두운 무늬 y₁ = λL/a'] = `${((q.lambda * 1e-9 * q.L) / q.a * 1000).toFixed(2)} mm`;
      if (q.N > 1) out['  밝은 무늬 간격 Δy = λL/d'] = `${((q.lambda * 1e-9 * q.L) / q.d * 1000).toFixed(2)} mm`;
    }
    return out;
  },
});

function draw(board, p, spots, pats) {
  const cv = board.userData.canvas;
  const g = cv.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  // 어두운 파스텔 남색 바탕: 밝은 실험실에서도 빛이 잘 보이도록
  const grad = g.createLinearGradient(0, 0, 0, PX_H);
  grad.addColorStop(0, '#3a4560');
  grad.addColorStop(1, '#2f3850');
  g.fillStyle = grad;
  g.fillRect(0, 0, PX_W, PX_H);

  if (p.showRuler) {
    g.strokeStyle = 'rgba(220,230,255,.18)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, PX_H / 2); g.lineTo(PX_W, PX_H / 2); g.stroke();
    g.beginPath(); g.moveTo(PX_W / 2, 0); g.lineTo(PX_W / 2, PX_H); g.stroke();
    g.fillStyle = 'rgba(230,236,255,.7)';
    g.font = '28px Jua, sans-serif';
    g.textAlign = 'center';
    for (let mm = -250; mm <= 250; mm++) {
      const u = PX_W / 2 + mm / 1000 / M_PER_PX;
      const len = mm % 10 === 0 ? 34 : mm % 5 === 0 ? 20 : 11;
      g.fillRect(u - 1, PX_H - len - 6, 2, len);
      if (mm % 50 === 0) g.fillText(`${mm / 10}cm`, u, PX_H - 50);
    }
  }

  // 회절·간섭 무늬: 가산 혼합으로 겹치면 밝아짐
  g.globalCompositeOperation = 'lighter';
  for (const q of pats) {
    const lambda = q.lambda * 1e-9;
    const barPx = BAR_HALF / M_PER_PX;
    const range = Math.ceil(PX_W * 1.2);
    for (let s = -range; s <= range; s++) {
      const y = s * M_PER_PX;
      const sin = y / Math.hypot(y, q.L);
      // 표시 밝기 = (세기 × 증폭)^0.7 : 눈의 밝기 감각은 세기에 비선형이라 약한 부극대도 보이게
      const I = Math.min(1, (nSlitIntensity(sin, lambda, q.a, q.d, q.N) * q.power * p.gain) ** 0.7);
      if (I < 0.004) continue;
      const u = q.u0 + s * q.ex, v = q.v0 + s * q.ey;
      if (u < -2 || u > PX_W + 2 || v < -barPx || v > PX_H + barPx) continue;
      g.strokeStyle = wavelengthToCss(q.lambda, I);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(u - q.ey * barPx, v + q.ex * barPx);
      g.lineTo(u + q.ey * barPx, v - q.ex * barPx);
      g.stroke();
    }
  }

  // 광점 (무늬 없는 빛, 또는 무늬의 중앙)
  for (const s of spots) {
    const { u, v } = toPx(s.x, s.y);
    const k = Math.min(1, 0.4 + 0.25 * Math.log10(s.power / 1e-3 + 1) * p.gain);
    const r = 14 + 10 * k;
    const rg = g.createRadialGradient(u, v, 0, u, v, r);
    rg.addColorStop(0, wavelengthToCss(s.wavelength, 0.95 * k));
    rg.addColorStop(0.35, wavelengthToCss(s.wavelength, 0.55 * k));
    rg.addColorStop(1, wavelengthToCss(s.wavelength, 0));
    g.fillStyle = rg;
    g.beginPath(); g.arc(u, v, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  board.userData.texture.needsUpdate = true;
}

/** 규칙에서 쓰는 도우미: 스크린 로컬 점 → 캔버스 px, 로컬 방향 → 캔버스 방향 */
export const screenGeometry = { SW, SH, PX_W, PX_H, M_PER_PX, toPx };

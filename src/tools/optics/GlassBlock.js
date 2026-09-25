/**
 * 반원 유리 블록 — physicsDomain: ["optical"]   (스넬 법칙 · 전반사 실험)
 *
 * 모양 (로컬 XZ 평면, 광축 높이 H): 반원 { x² + z² ≤ R², z ≤ 0 }
 *   평평한 면 : z = 0, 바깥 법선 +Z  (흰 화살표 쪽)
 *   곡면      : 바깥 법선 = 중심에서 바깥쪽 방사 방향
 *   받침 위 각도기 눈금: 평평한 면의 법선(0°) 기준
 *
 * ── 대표 실험: 전반사 ──────────────────────────────────────────────────────
 *   곡면 쪽에서 "중심을 향해" 빛을 쏘면 곡면에 수직 입사 → 꺾이지 않고 중심에 도달.
 *   평평한 면에서 유리→공기로 나갈 때 입사각 θ가 임계각 θc = asin(1/n) 보다 크면
 *   굴절광이 사라지고 전부 반사된다 (n = 1.5 → θc ≈ 41.8°).
 *   블록을 15° 단위로 돌리면 30° → 굴절(약 48.6°), 45° → 전반사. 설정 패널 "방향"으로 1° 조절.
 *
 * 경계마다 프레넬 반사율 R(θ)로 빛을 굴절광(1−R)과 반사광(R)으로 나눈다.
 * 이 때문에 임계각에 가까워질수록 굴절광이 어두워지고 반사광이 밝아지는 것이 보인다
 * (전반사가 갑자기 "켜지는" 게 아니라 연속적으로 넘어가는 이유).
 *
 * 깨지는 곳: 분산(파장별 n) 없음 → 프리즘 무지개는 안 나옴. 윗면·아랫면 반사 무시.
 */
import * as THREE from 'three';
import { ToolRegistry } from '../../core/ToolRegistry.js';
import { PALETTE as C, toy, cyl } from '../../scene/style.js';
import { refract, reflect, fresnel, halfDiskExit, criticalAngle, dot, deg, acosDeg, scale, add, len, sub } from '../../physics/opticsMath.js';
import { OPTICAL_AXIS_H as H, toLocal, toWorld, dirToLocal, dirToWorld, attenuate } from './common.js';

const BLOCK_H = 0.05;
const MAX_INTERNAL = 12;
const KEEP = 0.05; // 원래 세기의 5% 미만인 내부 반사광은 버림 (표면 반사 4%짜리 잔광은 생략)

ToolRegistry.define({
  type: 'glassblock',
  label: '반원 유리 블록',
  icon: '◗',
  description: '스넬 법칙과 전반사. 곡면 쪽에서 중심을 향해 빛을 쏘고 블록을 돌려 보자.',
  physicsDomain: ['optical'],
  defaultProperties: { refractiveIndex: 1.5, radius: 0.07 },
  propertyMeta: {
    refractiveIndex: { label: '굴절률 n', min: 1.0, max: 2.5, step: 0.01, rebuild: false },
    radius: { label: '반지름 R', min: 0.04, max: 0.1, step: 0.005, unit: 'm' },
  },
  interactionPorts: [
    { name: 'flat', type: 'beam_input', origin: [0, H, 0], direction: [0, 0, 1] },
  ],
  footprint: (p) => ({ x: p.radius + 0.03, y: (H + BLOCK_H / 2 + 0.005) / 2, z: p.radius + 0.03 }),

  buildMesh(p) {
    const R = p.radius;
    const root = new THREE.Group();
    // 받침 + 각도기 원판
    const post = new THREE.Mesh(cyl(0.016, H - BLOCK_H / 2 - 0.01), toy(C.white));
    post.position.y = (H - BLOCK_H / 2 - 0.01) / 2;
    const foot = new THREE.Mesh(cyl(0.05, 0.014), toy(C.pink));
    foot.position.y = 0.007;
    const disk = new THREE.Mesh(cyl(R + 0.028, 0.008, R + 0.028, 64), [
      toy(C.pink), new THREE.MeshBasicMaterial({ map: protractorTexture(), toneMapped: false }), toy(C.pink),
    ]);
    disk.position.y = H - BLOCK_H / 2 - 0.005;
    root.add(post, foot, disk);

    // 반원 유리: 2D 반원을 위로 돌출 (shape의 y ≥ 0 → 로컬 z ≤ 0)
    const shape = new THREE.Shape();
    shape.absarc(0, 0, R, 0, Math.PI, false);
    shape.lineTo(R, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: BLOCK_H, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 4, curveSegments: 64 });
    geo.rotateX(-Math.PI / 2);
    const glass = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: 0xd8f0ff, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false,
    }));
    glass.position.y = H - BLOCK_H / 2;
    glass.name = 'glass';
    root.add(glass);
    return root;
  },

  optics: {
    respond(entity, ray, hit) {
      if (hit.object.name !== 'glass') return {}; // 받침에 닿음 = 흡수
      const n = entity.properties.refractiveIndex;
      const R = entity.properties.radius;
      const P0 = ray.light.power;
      const events = [];
      const rays = [];
      const segments = [];
      const toW = (v) => toWorld(entity, { x: v.x, y: v.y + H, z: v.z });

      // 블록 로컬, 중심 = (0, H, 0) 기준
      const lp = toLocal(entity, hit.point);
      let p = { x: lp.x, y: lp.y - H, z: Math.min(lp.z, 0) };
      let d = dirToLocal(entity, ray.direction);

      // ── 입사면 판별 ──
      const flat = Math.abs(p.z) < 0.004;
      if (flat) p.z = 0;
      else { const r = Math.hypot(p.x, p.z); p.x *= R / r; p.z *= R / r; }
      const N = flat ? { x: 0, y: 0, z: 1 } : { x: p.x / R, y: 0, z: p.z / R };
      if (dot(N, d) >= 0) return {}; // 안쪽에서 나오는 방향(수치 오차) → 무시

      // ── 공기 → 유리 ──
      const inn = refract(d, N, 1, n);
      const Rin = fresnel(inn.cosI, inn.cosT, 1, n);
      events.push({ face: flat ? '평면' : '곡면', dir: '공기→유리', thI: acosDeg(inn.cosI), thT: acosDeg(inn.cosT) });
      const rOut = reflect(d, N);
      rays.push({ origin: hit.point.clone(), direction: dirToWorld(entity, rOut), light: attenuate(ray.light, Rin) });

      // ── 유리 내부 추적 ──
      let power = P0 * (1 - Rin);
      d = inn.dir;
      let path = 0;
      for (let i = 0; i < MAX_INTERNAL && power > P0 * KEEP; i++) {
        const e = halfDiskExit(p, d, R);
        if (!e) break;
        segments.push({ from: toW(p), to: toW(e.point), light: { ...ray.light, power } });
        path += len(sub(e.point, p));
        const Nin = scale(e.normal, -1); // 유리 안쪽(입사 쪽)을 향하는 법선
        const out = refract(d, Nin, n, 1);
        if (out.tir) {
          events.push({ face: e.face === 'flat' ? '평면' : '곡면', dir: '유리→공기', thI: acosDeg(out.cosI), thT: null });
          d = reflect(d, e.normal);
          p = e.point;
          continue; // 전반사: 에너지 손실 없이 계속
        }
        const Rf = fresnel(out.cosI, out.cosT, n, 1);
        events.push({ face: e.face === 'flat' ? '평면' : '곡면', dir: '유리→공기', thI: acosDeg(out.cosI), thT: acosDeg(out.cosT) });
        rays.push({
          origin: toW(e.point), direction: dirToWorld(entity, out.dir),
          light: { ...ray.light, power: power * (1 - Rf) }, extraPath: path,
        });
        power *= Rf; // 부분 반사광은 유리 안에서 계속
        d = reflect(d, e.normal);
        p = add(e.point, scale(d, 1e-7));
      }
      entity.state.optics.events = [...(entity.state.optics.events ?? []), ...events].slice(0, 6);
      return { rays, segments };
    },
  },

  readouts(entity) {
    const n = entity.properties.refractiveIndex;
    const thc = criticalAngle(n, 1);
    const out = {
      '임계각 θc = asin(1/n)': thc ? `${deg(thc).toFixed(2)}°` : '없음 (n ≤ 1)',
    };
    const ev = entity.state.optics?.events ?? [];
    if (!ev.length) out['빛'] = '블록에 닿지 않음';
    ev.forEach((e, i) => {
      out[`${i + 1}. ${e.face} ${e.dir}`] = e.thT == null
        ? `θ₁=${e.thI.toFixed(1)}° → 전반사!`
        : `θ₁=${e.thI.toFixed(1)}° → θ₂=${e.thT.toFixed(1)}°`;
    });
    const first = ev.find((e) => e.thT != null && e.thI > 0.5);
    if (first) {
      const [n1, n2] = first.dir === '공기→유리' ? [1, n] : [n, 1];
      out['스넬 확인 n₁sinθ₁ | n₂sinθ₂'] = `${(n1 * Math.sin((first.thI * Math.PI) / 180)).toFixed(4)} | ${(n2 * Math.sin((first.thT * Math.PI) / 180)).toFixed(4)}`;
    }
    return out;
  },
});

/** 각도기 눈금 (윗면 텍스처). 0° = 평평한 면의 법선(+Z) 방향 */
function protractorTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#ffe3ec';
  g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.strokeStyle = '#8a7080';
  g.fillStyle = '#8a7080';
  g.font = '22px Jua, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let a = 0; a < 360; a += 5) {
    // CylinderGeometry 윗면 UV: u = z/r (캔버스 가로), v = x/r (캔버스 위쪽).
    // 각도 a를 +Z에서 잰 방향 (x=sin a, z=cos a) → 캔버스 (cos a, −sin a)
    const rad = (a * Math.PI) / 180;
    const dx = Math.cos(rad), dy = -Math.sin(rad);
    const r0 = a % 30 === 0 ? S * 0.37 : a % 10 === 0 ? S * 0.42 : S * 0.45;
    g.lineWidth = a % 30 === 0 ? 3 : 1.5;
    g.beginPath(); g.moveTo(dx * r0, dy * r0); g.lineTo(dx * S * 0.49, dy * S * 0.49); g.stroke();
    if (a % 30 === 0) {
      const lab = a <= 180 ? a : 360 - a;
      g.fillText(`${lab}°`, dx * S * 0.31, dy * S * 0.31);
    }
  }
  g.strokeStyle = '#c08aa0';
  g.lineWidth = 2;
  g.setLineDash([8, 8]);
  g.beginPath(); g.moveTo(-S / 2, 0); g.lineTo(S / 2, 0); g.stroke(); // 평평한 면의 법선 (로컬 z축)
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

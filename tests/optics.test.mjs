// 광학 계산 단위 테스트: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reflect, refract, fresnel, criticalAngle, thinLens, nSlitIntensity, halfDiskExit, normalize, dot,
} from '../src/physics/opticsMath.js';

const near = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) < eps, `${msg ?? ''} ${a} ≉ ${b}`);
const dirAt = (deg) => ({ x: Math.sin((deg * Math.PI) / 180), y: 0, z: -Math.cos((deg * Math.PI) / 180) });

test('반사: 입사각 = 반사각, 법선 성분만 뒤집힘', () => {
  const n = { x: 0, y: 0, z: 1 };
  const d = dirAt(30);
  const r = reflect(d, n);
  near(r.x, d.x);
  near(r.z, -d.z);
  near(-dot(d, n), dot(r, n)); // cos(입사각) = cos(반사각)
});

test('굴절: 스넬 법칙 n₁sinθ₁ = n₂sinθ₂ (공기 → 유리)', () => {
  const n = { x: 0, y: 0, z: 1 };
  for (const deg of [0, 10, 30, 60, 85]) {
    const r = refract(dirAt(deg), n, 1.0, 1.5);
    const sin1 = Math.sin((deg * Math.PI) / 180);
    const sin2 = Math.hypot(r.dir.x, r.dir.y);
    near(1.0 * sin1, 1.5 * sin2, 1e-9, `θ=${deg}`);
    assert.ok(r.dir.z < 0, '빛은 계속 −z로 진행');
  }
});

test('전반사: 유리(1.5) → 공기, 임계각 41.81° 기준', () => {
  const thc = (criticalAngle(1.5, 1.0) * 180) / Math.PI;
  near(thc, 41.8103, 1e-3);
  const n = { x: 0, y: 0, z: 1 };
  assert.equal(refract(dirAt(40), n, 1.5, 1.0).tir, false);
  assert.equal(refract(dirAt(45), n, 1.5, 1.0).tir, true);
  assert.equal(criticalAngle(1.0, 1.5), null); // 공기→유리는 전반사 없음
});

test('프레넬: 수직 입사 유리 반사율 4%', () => {
  near(fresnel(1, 1, 1.0, 1.5), 0.04, 1e-12);
});

test('얇은 렌즈: 광축에 평행한 광선은 초점 f를 지난다 (볼록 +, 오목은 허초점)', () => {
  const f = 0.2, h = 0.01;
  const d = thinLens({ x: 0, y: 0, z: 1 }, h, 0, f);
  near(h + (d.x / d.z) * f, 0, 1e-12);          // z=f 에서 x=0
  const back = thinLens({ x: 0, y: 0, z: -1 }, h, 0, f);   // 반대 방향 입사도 동일
  near(h + (back.x / -back.z) * f, 0, 1e-12);
  const dv = thinLens({ x: 0, y: 0, z: 1 }, h, 0, -f);   // 오목: 광축에서 멀어짐
  assert.ok(dv.x > 0);
  near(h - (dv.x / dv.z) * f, 0, 1e-12);        // 거꾸로 연장하면 z=−f 에서 광축
});

test('N-슬릿 세기: 단일 슬릿 첫 어두운 무늬 a sinθ = λ, 이중 슬릿 밝은 무늬 d sinθ = mλ', () => {
  const lambda = 633e-9, a = 100e-6, d = 400e-6;
  near(nSlitIntensity(0, lambda, a, d, 1), 1);
  near(nSlitIntensity(lambda / a, lambda, a, d, 1), 0, 1e-20);
  const m1 = nSlitIntensity(lambda / d, lambda, a, d, 2);    // 1차 밝은 무늬: 포락선 값과 같아야
  near(m1, nSlitIntensity(lambda / d, lambda, a, d, 1), 1e-9);
  near(nSlitIntensity(lambda / (2 * d), lambda, a, d, 2), 0, 1e-12); // 첫 어두운 무늬 (반파장 차)
});

test('반원 블록: 곡면으로 중심을 향해 들어온 빛은 평평한 면 중심에 닿는다', () => {
  const R = 0.06;
  const ang = (30 * Math.PI) / 180;
  const p = { x: -R * Math.sin(ang), y: 0, z: -R * Math.cos(ang) }; // 곡면 위의 점
  const d = normalize({ x: -p.x, y: 0, z: -p.z });                   // 중심 방향
  const hit = halfDiskExit(p, d, R);
  assert.equal(hit.face, 'flat');
  near(hit.point.x, 0, 1e-12);
  near(hit.point.z, 0, 1e-12);
});

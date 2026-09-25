/**
 * ============================================================================
 *  opticsMath — 광학 계산 순수 함수 모음 (Three.js 의존 없음 → Node에서 단위 테스트)
 * ============================================================================
 *  벡터는 {x, y, z} 평범한 객체. 모든 방향 벡터는 단위벡터라고 가정한다.
 *
 *  ┌ 반사 ─────────────────────────────────────────────────────────────────┐
 *  │ d' = d − 2(d·n)n                                                       │
 *  │ n 방향 성분만 뒤집힌다 → 입사각 = 반사각 이 자동으로 성립               │
 *  └───────────────────────────────────────────────────────────────────────┘
 *  ┌ 굴절 (벡터형 스넬 법칙) ────────────────────────────────────────────────┐
 *  │ n₁ sinθ₁ = n₂ sinθ₂.  η = n₁/n₂, cosθ₁ = −n·d                           │
 *  │ k = 1 − η²(1 − cos²θ₁) = cos²θ₂                                         │
 *  │ k < 0 → sinθ₂ > 1 : 굴절광이 존재할 수 없음 = 전반사(TIR)                │
 *  │ t = η d + (η cosθ₁ − √k) n                                              │
 *  │ (접선 성분은 η배, 법선 성분은 |t|=1 이 되도록 결정)                      │
 *  └───────────────────────────────────────────────────────────────────────┘
 */

export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const len = (a) => Math.sqrt(dot(a, a));
export const normalize = (a) => scale(a, 1 / len(a));

/** 반사. n은 단위 법선 (방향 무관: (d·n)n 항이 부호를 흡수) */
export function reflect(d, n) {
  return sub(d, scale(n, 2 * dot(d, n)));
}

/**
 * 굴절. n은 입사 쪽을 향하는 단위 법선 (n·d < 0).
 * @returns {{dir: object|null, cosI: number, cosT: number, tir: boolean}}
 */
export function refract(d, n, n1, n2) {
  const eta = n1 / n2;
  const cosI = Math.min(1, Math.max(-1, -dot(n, d))); // 부동소수 오차로 1을 살짝 넘는 것 방지
  const k = 1 - eta * eta * (1 - cosI * cosI);
  if (k < 0) return { dir: null, cosI, cosT: 0, tir: true };
  const cosT = Math.sqrt(k);
  return { dir: normalize(add(scale(d, eta), scale(n, eta * cosI - cosT))), cosI, cosT, tir: false };
}

/**
 * 프레넬 반사율 (편광 안 된 빛 = s, p 평균).
 * 수직 입사에서 R = ((n₁−n₂)/(n₁+n₂))² → 유리(1.5)는 약 4%
 */
export function fresnel(cosI, cosT, n1, n2) {
  const rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT);
  const rp = (n1 * cosT - n2 * cosI) / (n1 * cosT + n2 * cosI);
  return (rs * rs + rp * rp) / 2;
}

/** 임계각 θc = asin(n₂/n₁)  (n₁ > n₂ 일 때만 존재) */
export function criticalAngle(n1, n2) {
  return n1 > n2 ? Math.asin(n2 / n1) : null;
}

/**
 * 얇은 렌즈 (근축 근사). 렌즈 로컬 좌표: 렌즈면 = z=0 평면, 광축 = z축.
 * 광선이 높이 h=(hx,hy)에서 렌즈를 지나면 기울기(slope)가 h/f 만큼 광축 쪽으로 꺾인다.
 *   t' = t − h/f        (t = dx/dz, dy/dz)
 * 근거: 광축에 평행한 광선(t=0)은 t' = −h/f → 거리 f 뒤에서 광축과 만남 = 초점.
 * 빛이 −z 방향으로 가도 같은 렌즈이므로 z를 뒤집어 계산한 뒤 되돌린다.
 */
export function thinLens(d, hx, hy, f) {
  const s = d.z >= 0 ? 1 : -1;
  const dz = d.z * s;
  const tx = d.x / dz - hx / f;
  const ty = d.y / dz - hy / f;
  const out = normalize({ x: tx, y: ty, z: 1 });
  return { x: out.x, y: out.y, z: out.z * s };
}

/**
 * N-슬릿 프라운호퍼 회절 세기 (중앙 최대 = 1로 정규화)
 *   I(θ) = [sin β / β]² · [sin(Nγ) / (N sin γ)]²
 *   β = π a sinθ / λ   (슬릿 하나의 폭 a → 단일 슬릿 포락선, 첫 어두운 무늬 a sinθ = λ)
 *   γ = π d sinθ / λ   (슬릿 간격 d → 간섭 무늬, 밝은 무늬 d sinθ = mλ)
 *   N = 1 이면 단일 슬릿, 2 = 영의 이중 슬릿, 큰 N = 회절격자
 */
export function nSlitIntensity(sinTheta, lambda, a, d, N) {
  const beta = (Math.PI * a * sinTheta) / lambda;
  const envelope = Math.abs(beta) < 1e-9 ? 1 : (Math.sin(beta) / beta) ** 2;
  if (N <= 1) return envelope;
  const gamma = (Math.PI * d * sinTheta) / lambda;
  const sg = Math.sin(gamma);
  // γ = mπ 근처(주 극대)에서 0/0 → 극한값 1
  const interf = Math.abs(sg) < 1e-7 ? 1 : (Math.sin(N * gamma) / (N * sg)) ** 2;
  return envelope * interf;
}

/**
 * 반원 유리 블록 내부의 2D 광선 추적 한 단계.
 * 블록 로컬 XZ 평면: 반원 = { x² + z² ≤ R², z ≤ 0 }.  평평한 면: z = 0 (바깥 법선 +z),
 * 곡면: 바깥 법선 = (x, 0, z)/R.  p는 블록 안(또는 경계 위), d는 진행 방향.
 * @returns {{t, point, normal, face}} 가장 가까운 경계 교차 (t > eps)
 */
export function halfDiskExit(p, d, R, eps = 1e-6) {
  let best = null;
  // 평평한 면 z = 0
  if (Math.abs(d.z) > 1e-12) {
    const t = -p.z / d.z;
    const x = p.x + d.x * t;
    if (t > eps && Math.abs(x) <= R + 1e-9) best = { t, face: 'flat' };
  }
  // 곡면 x² + z² = R² (z ≤ 0)
  const A = d.x * d.x + d.z * d.z;
  const B = 2 * (p.x * d.x + p.z * d.z);
  const C = p.x * p.x + p.z * p.z - R * R;
  const disc = B * B - 4 * A * C;
  if (A > 1e-12 && disc >= 0) {
    const sq = Math.sqrt(disc);
    for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
      const z = p.z + d.z * t;
      if (t > eps && z <= 1e-9 && (!best || t < best.t)) best = { t, face: 'curved' };
    }
  }
  if (!best) return null;
  const point = add(p, scale(d, best.t));
  const normal = best.face === 'flat' ? { x: 0, y: 0, z: 1 } : normalize({ x: point.x, y: 0, z: point.z });
  return { ...best, point, normal };
}

/** 라디안 → 도 */
export const deg = (r) => (r * 180) / Math.PI;

/** cos 값 → 각도(도). 오차로 |c|>1 이어도 NaN이 되지 않게 */
export const acosDeg = (c) => deg(Math.acos(Math.min(1, Math.max(-1, c))));

/**
 * ============================================================================
 *  상호작용 규칙 모음 — 도구 "쌍" 사이의 물리 법칙을 등록하는 유일한 장소
 * ============================================================================
 *
 *  무엇이 규칙이 되고 무엇이 안 되는가 (Phase 1에서 정한 기준)
 *   · 한 도구의 성질만으로 정해지는 것 → 도구 자신의 응답 (규칙 아님)
 *       반사(거울), 굴절(렌즈·유리), 흡수(불투명 물체), 광점 기록(스크린)
 *       → def.optics.respond, OpticalSystem이 처리
 *   · 두 도구의 조합으로만 생기는 현상 → 여기 등록
 *       슬릿(a, d, N) + 스크린(거리 L) → 회절·간섭 무늬
 *
 *  레이저-도르래처럼 등록되지 않은 조합은 여전히 "행이 없음" = 아무 일도 없음.
 */
import { InteractionRegistry } from './InteractionRegistry.js';
import { screenGeometry } from '../tools/optics/Screen.js';
import { toLocal, dirToLocal, dirToWorld } from '../tools/optics/common.js';

export function registerRules() {
  /**
   * 슬릿 → 스크린 : N-슬릿 프라운호퍼 회절
   *
   *   I(θ) = [sin β/β]² · [sin Nγ / (N sin γ)]²,  β = πa sinθ/λ,  γ = πd sinθ/λ
   *   작은 각에서 sinθ ≈ y/L →  첫 어두운 무늬 y₁ = λL/a,  밝은 무늬 간격 Δy = λL/d
   *
   *   L  = broad phase가 준 "슬릿→스크린 광로 길이" (중간에 거울이 있어도 경로 전체)
   *   λ  = 빛이 들고 온 파장 (광원이 무엇이든)
   *   조건: light.coherent — 결맞지 않은 빛(광선 상자)은 간섭 무늬를 만들지 않는다.
   *
   *   어디서 깨지나: 프라운호퍼(원거리) 근사는 L ≫ a²/λ 일 때 성립.
   *   a = 80 μm, λ = 633 nm → a²/λ ≈ 1 cm 이므로 테이블 위 거리(수십 cm)에서는 충분히 맞다.
   *   슬릿 폭을 400 μm 로 키우면 a²/λ ≈ 25 cm → 스크린을 가까이 두면 실제 무늬(프레넬 회절)와 달라진다.
   */
  InteractionRegistry.register('slit', 'screen', {
    name: 'N-슬릿 회절·간섭 무늬',
    onUpdate(slit, screen, { contact, blackboard }) {
      const { light, hit, pathLength: L } = contact;
      if (!light.coherent) return clear(slit, screen, blackboard);

      const p = slit.properties;
      const lambda = light.wavelength;
      const a = p.slitWidth * 1e-6;
      const d = p.slitSpacing * 1e-6;
      const N = p.slitCount;

      // 무늬 중심 = 빛이 스크린에 닿은 점, 퍼지는 방향 = 슬릿 폭 방향(슬릿 로컬 X)을 스크린 면에 투영
      const lp = toLocal(screen, hit.point);
      const { u, v } = screenGeometry.toPx(lp.x, lp.y);
      const ax = dirToLocal(screen, dirToWorld(slit, { x: 1, y: 0, z: 0 }));
      let ex = ax.x, ey = -ax.y; // 캔버스 v축은 아래 방향
      const n = Math.hypot(ex, ey);
      if (n < 1e-3) { ex = 1; ey = 0; } else { ex /= n; ey /= n; }

      screen.state.patterns.set(slit.id, {
        u0: u, v0: v, ex, ey, lambda, a, d, N, L,
        // 슬릿은 빛의 일부만 통과시키므로(수 %) 0.4 mW를 기준 밝기로 정규화
        power: Math.min(3, Math.max(0.3, light.power / 0.4e-3)),
      });
      const y1 = (lambda * 1e-9 * L) / a;
      const dy = (lambda * 1e-9 * L) / d;
      slit.state.pattern = { L, y1, dy };

      boardOnce(blackboard, `slit:${lambda.toFixed(1)}:${a}:${d}:${N}:${L.toFixed(3)}`, [
        N === 1 ? '단일 슬릿 회절' : N === 2 ? '영의 이중 슬릿' : `회절격자 (N = ${N})`,
        `λ = ${lambda.toFixed(1)} nm    L = ${(L * 100).toFixed(1)} cm`,
        `a = ${p.slitWidth} μm${N > 1 ? `    d = ${p.slitSpacing} μm` : ''}`,
        `첫 어두운 무늬  y₁ = λL/a = ${(y1 * 1000).toFixed(2)} mm`,
        N > 1 ? `밝은 무늬 간격  Δy = λL/d = ${(dy * 1000).toFixed(2)} mm` : 'a sinθ = λ  (첫 어두운 무늬)',
      ]);
    },
    onExit(slit, screen, { blackboard }) {
      clear(slit, screen, blackboard);
    },
  });
}

function clear(slit, screen, blackboard) {
  screen.state.patterns?.delete(slit.id);
  slit.state.pattern = null;
  if (blackboard && blackboard.key?.startsWith('slit:')) {
    blackboard.key = null;
    blackboard.reset();
  }
}

/** 칠판은 다시 그리는 비용이 크므로 내용(key)이 바뀔 때만 쓴다 */
function boardOnce(blackboard, key, lines) {
  if (!blackboard || blackboard.key === key) return;
  blackboard.key = key;
  blackboard.writeLines(lines, { size: 64, gap: 1.45, y: 130 });
}

/**
 * ============================================================================
 *  상호작용 규칙 모음 — 도구 쌍 사이의 "물리 법칙"을 등록하는 유일한 장소
 * ============================================================================
 *
 *  Phase 0에는 등록된 규칙이 **하나도 없다.** 이것이 Phase 0의 검증 포인트다.
 *    · 레이저 빔이 도르래에 닿으면 broad phase는 (laser, pulley)를 후보로 올린다.
 *    · narrow phase의 InteractionRegistry.match()는 빈 배열을 돌려준다.
 *    · 엔진은 빈 배열을 순회(0회)할 뿐 → 아무 일도 일어나지 않는다.
 *    "레이저-도르래는 상호작용 없음" 이라는 코드는 어디에도 없다.
 *
 *  다음 Phase 예시 (주석 해제 + Slit 도구 추가 시 즉시 동작):
 *
 *  InteractionRegistry.register('laser', 'slit', {
 *    name: '단일 슬릿 프라운호퍼 회절',
 *    onUpdate(laser, slit, { contact }) {
 *      // contact.hit.point: 빔이 슬릿 평면에 닿은 3D 점
 *      const λ = laser.properties.wavelength * 1e-9;   // m
 *      const a = slit.properties.width * 1e-3;          // m
 *      const L = slit.properties.screenDistance;        // m
 *      // 세기 I(θ) = I₀ [sin β / β]²,  β = π a sinθ / λ,  첫 어두운 무늬 y₁ = λL/a
 *      slit.state.pattern = { λ, a, L, y1: (λ * L) / a };
 *    },
 *    onExit(laser, slit) { slit.state.pattern = null; },
 *  });
 */
// eslint-disable-next-line no-unused-vars
import { InteractionRegistry } from './InteractionRegistry.js';

export function registerRules() {
  // Phase 0: 의도적으로 비어 있음.
}

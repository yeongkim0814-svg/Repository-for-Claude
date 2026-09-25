/**
 * ============================================================================
 *  InteractionEngine — 매 프레임 2단계 상호작용 파이프라인
 * ============================================================================
 *
 *    ┌──────────── 모든 엔티티 쌍 (i<j) ────────────┐
 *    │ 1) Broad phase  : checker.checkProximity(a,b) │ ← 도메인 조합별 공간 판정
 *    │        null → 다음 쌍                          │
 *    │ 2) Narrow phase : registry.match(a,b)          │ ← 타입 조합별 규칙 조회
 *    │        규칙 배열을 순회하며 onEnter/onUpdate    │    (없으면 빈 배열 → 0회 실행)
 *    └───────────────────────────────────────────────┘
 *    3) 이번 프레임에 사라진 (쌍, 규칙) → onExit
 *
 *  N이 작은(수십 개) 실험실 규모라 O(N²) 쌍 순회로 충분하다. 도구가 수백 개가 되면
 *  broad phase 앞에 공간 해시/BVH를 끼워 넣으면 되고, 규칙 쪽 코드는 바뀌지 않는다.
 *
 *  lastReport: HUD "상호작용 엔진 모니터"용 디버그 정보 (엔진 동작에는 영향 없음)
 */
export class InteractionEngine {
  constructor({ checker, registry, ctx }) {
    this.checker = checker;
    this.registry = registry;
    this.ctx = ctx;
    /** "idA|idB|ruleId" → { rule, a, b } */
    this.active = new Map();
    this.lastReport = { pairsChecked: 0, candidates: [] };
  }

  update(entities) {
    const next = new Map();
    const candidates = [];
    let pairsChecked = 0;

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        pairsChecked++;

        // ── 1단계: Broad phase ───────────────────────────
        const contact = this.checker.checkProximity(a, b);
        if (!contact) continue;

        // ── 2단계: Narrow phase ──────────────────────────
        const rules = this.registry.match(a, b);
        candidates.push({ a, b, contact, rules: rules.map((r) => r.name) });

        const ctx = { ...this.ctx, contact };
        for (const rule of rules) {
          const k = `${a.id}|${b.id}|${rule.id}`;
          if (!this.active.has(k)) rule.invoke('onEnter', a, b, ctx);
          rule.invoke('onUpdate', a, b, ctx);
          next.set(k, { rule, a, b });
        }
      }
    }

    // ── 3단계: 끝난 상호작용 정리 ─────────────────────────
    for (const [k, { rule, a, b }] of this.active) {
      if (!next.has(k)) rule.invoke('onExit', a, b, { ...this.ctx, contact: null });
    }
    this.active = next;
    this.lastReport = { pairsChecked, candidates };
  }

  /** 엔티티가 제거될 때 진행 중인 상호작용을 닫는다. */
  forget(entity) {
    for (const [k, { rule, a, b }] of this.active) {
      if (a === entity || b === entity) {
        rule.invoke('onExit', a, b, { ...this.ctx, contact: null });
        this.active.delete(k);
      }
    }
  }
}

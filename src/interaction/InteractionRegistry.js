/**
 * ============================================================================
 *  InteractionRegistry — Narrow phase 규칙 테이블  (Phase 0의 핵심)
 * ============================================================================
 *
 *  "어떤 도구 A와 도구 B가 만나면 무슨 물리가 일어나는가"를 (typeA, typeB) 키로
 *  등록해 두는 순수한 조회 테이블이다.
 *
 *  ── 핵심 설계: "상호작용 없음"은 코드가 아니라 '테이블에 행이 없음'이다 ──────────
 *    match(a, b)는 항상 **배열**을 돌려준다. 등록된 규칙이 없으면 빈 배열이고,
 *    엔진은 `for (const rule of registry.match(a, b)) rule.invoke(...)` 만 실행한다.
 *    빈 배열 순회 = 0회 실행. 따라서 레이저-도르래처럼 아무 관계 없는 조합을 위한
 *    if 문, NullHandler, "noInteraction" 플래그 같은 것이 코드 어디에도 존재하지 않는다.
 *    새 도구 N개를 추가해도 N² 조합을 신경 쓸 필요 없이 "의미 있는" 조합만 등록하면 된다.
 *
 *  ── 확장 방법 (다음 Phase에서 참고) ───────────────────────────────────────────
 *    // 간단형: 매 프레임(공간적으로 가까운 동안) 호출
 *    InteractionRegistry.register('laser', 'slit', (laser, slit, ctx) => { ... });
 *
 *    // 수명주기형: 만남/지속/헤어짐을 구분
 *    InteractionRegistry.register('laser', 'slit', {
 *      name: '단일 슬릿 회절',
 *      onEnter(laser, slit, ctx)  { 스크린 텍스처 생성 },
 *      onUpdate(laser, slit, ctx) { 빔-슬릿 평면 교차점, 슬릿 폭 → 회절 패턴 갱신 },
 *      onExit(laser, slit, ctx)   { 패턴 제거 },
 *    });
 *
 *    - 등록 순서('laser','slit')는 기억된다: 엔진이 (slit, laser) 순으로 쌍을 찾아도
 *      핸들러는 항상 (laser, slit) 순서로 인자를 받는다. → 핸들러 안에서 역할 혼동 없음.
 *    - 같은 쌍에 규칙을 여러 개 등록할 수 있다 (예: 광학 규칙 + 열 규칙).
 *    - ctx.contact 에 broad phase 결과(빔 교차점, 접촉 여부 등)가 담겨 전달된다.
 *    - 같은 타입끼리('pulley','pulley')도 등록 가능하다.
 */

const key = (a, b) => (a < b ? `${a}::${b}` : `${b}::${a}`);

class Rule {
  constructor(id, typeA, typeB, spec) {
    this.id = id;
    this.typeA = typeA;
    this.typeB = typeB;
    const s = typeof spec === 'function' ? { onUpdate: spec } : spec;
    this.name = s.name ?? `${typeA}×${typeB}`;
    this.onEnter = s.onEnter;
    this.onUpdate = s.onUpdate;
    this.onExit = s.onExit;
  }

  /** 등록 시 선언한 인자 순서로 정렬 */
  order(a, b) {
    return a.type === this.typeA ? [a, b] : [b, a];
  }

  invoke(phase, a, b, ctx) {
    const [x, y] = this.order(a, b);
    this[phase]?.(x, y, ctx);
  }
}

export class InteractionRegistryClass {
  constructor() {
    /** "typeA::typeB" → Rule[] */
    this.table = new Map();
    this.nextId = 1;
  }

  register(typeA, typeB, spec) {
    const rule = new Rule(this.nextId++, typeA, typeB, spec);
    const k = key(typeA, typeB);
    if (!this.table.has(k)) this.table.set(k, []);
    this.table.get(k).push(rule);
    return rule;
  }

  unregister(rule) {
    const list = this.table.get(key(rule.typeA, rule.typeB));
    if (list) list.splice(list.indexOf(rule), 1);
  }

  /** 두 엔티티에 해당하는 규칙 배열. 미등록 조합이면 빈 배열(= 자연스러운 "상호작용 없음"). */
  match(a, b) {
    return this.table.get(key(a.type, b.type)) ?? EMPTY;
  }
}

const EMPTY = Object.freeze([]);

/** 앱 전역 싱글턴. 테스트에서는 new InteractionRegistryClass()로 독립 인스턴스 사용. */
export const InteractionRegistry = new InteractionRegistryClass();

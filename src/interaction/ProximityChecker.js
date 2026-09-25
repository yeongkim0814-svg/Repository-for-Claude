/**
 * ============================================================================
 *  ProximityChecker — Broad phase: checkProximity(entityA, entityB)
 * ============================================================================
 *
 *  "두 도구가 공간적으로 상호작용할 수 있는 위치에 있는가?"는 도메인마다 뜻이 다르다.
 *    · 역학(mechanical) 끼리 : 물체가 닿거나 가까이 있다 → Rapier 충돌/센서 이벤트
 *    · 광학(optical) 관련    : 빔(광선) 경로 위에 상대가 있다 → Three.js Raycaster
 *    · (다음 Phase) 전자기   : 자기장 세기가 임계값 이상인 거리 안
 *    · (다음 Phase) 열       : 열접촉(콜라이더 접촉) 또는 복사 거리
 *
 *  그래서 판정 로직을 (domainA, domainB) 조합으로 등록하는 전략 테이블로 만든다.
 *  '*'는 와일드카드: ('optical','*') = "광학 도구와 어떤 도구든" (빔은 무엇에든 닿을 수 있음)
 *
 *  checkProximity(a, b)
 *    for da in a.physicsDomain, db in b.physicsDomain:      ← 다중 도메인 도구 지원
 *      for strategy in 전략들(da, db) ∪ (da,*) ∪ (db,*) ∪ (*,*):
 *        result = strategy(a, b)  → truthy면 후보 확정, 결과(교차점 등)를 반환
 *    → 등록된 전략이 없으면 순회 0회 → null (여기서도 "없음"을 특별 처리하지 않는다)
 *
 *  전략 함수 규약: (a, b) 순서와 무관하게 대칭적으로 판정할 것.
 *  반환값: falsy 또는 { via: '설명', ...세부정보 } — narrow phase 핸들러에 ctx.contact로 전달.
 */

const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class ProximityChecker {
  constructor() {
    /** "domA|domB" → [{ name, fn }] */
    this.strategies = new Map();
  }

  register(domainA, domainB, name, fn) {
    const k = key(domainA, domainB);
    if (!this.strategies.has(k)) this.strategies.set(k, []);
    this.strategies.get(k).push({ name, fn });
  }

  *strategiesFor(da, db) {
    const seen = new Set();
    for (const k of [key(da, db), key(da, '*'), key(db, '*'), key('*', '*')]) {
      if (seen.has(k)) continue;
      seen.add(k);
      yield* this.strategies.get(k) ?? [];
    }
  }

  checkProximity(a, b) {
    for (const da of a.physicsDomain) {
      for (const db of b.physicsDomain) {
        for (const s of this.strategiesFor(da, db)) {
          const r = s.fn(a, b);
          if (r) return { strategy: s.name, domains: [da, db], ...r };
        }
      }
    }
    return null;
  }
}

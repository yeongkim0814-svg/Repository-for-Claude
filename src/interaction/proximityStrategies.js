/**
 * 도메인별 broad phase 전략 등록.
 *
 * 새 도메인 추가 예 (다음 Phase):
 *   checker.register('electromagnetic', 'electromagnetic', 'field-range', (a, b) =>
 *     a.transform.position.distanceTo(b.transform.position) < fieldRange(a, b) && { via: '자기장 범위' });
 */
export function registerDefaultStrategies(checker, ctx) {
  // ── 역학 × 역학: Rapier 충돌/근접(센서 교차) 이벤트를 그대로 사용 ──────────
  checker.register('mechanical', 'mechanical', 'rapier-contact', (a, b) =>
    ctx.physics.entitiesInContact(a, b) && { via: 'Rapier 근접 센서/접촉 이벤트' },
  );

  // ── 광학 × (무엇이든): "광학적으로 연결되어 있는가" (OpticalSystem의 광선 추적 결과) ──
  //    A에서 나온 빛이 (직접 또는 거울·렌즈를 거쳐) B에 닿으면 후보.
  //    빛은 도르래든 슬릿이든 가리지 않고 닿는다. 닿은 뒤 "무슨 일이 일어나는지"는
  //    narrow phase(InteractionRegistry)가 결정할 일이다.
  checker.register('optical', '*', 'light-path', (a, b) => {
    const link = ctx.optics.linkBetween(a, b);
    return link && { via: `빛 경로 ${link.from.type}→${link.to.type} (광로 ${link.pathLength.toFixed(2)} m)`, ...link };
  });
}

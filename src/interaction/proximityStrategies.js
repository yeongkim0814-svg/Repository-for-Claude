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

  // ── 광학 × (무엇이든): 빔 경로 위에 상대가 있는가 (Three.js Raycaster) ──────
  //    빛은 도르래든 슬릿이든 가리지 않고 닿는다. 닿은 뒤 "무슨 일이 일어나는지"는
  //    narrow phase(InteractionRegistry)가 결정할 일이다.
  const beamHit = (src, dst) => {
    if (!src.hasDomain('optical')) return null;
    for (const port of src.worldPortsOfType('beam_output')) {
      if (!port.active) continue;
      const hit = ctx.beamTracer.trace(src, port);
      if (hit.entity === dst) {
        return { via: `빔 경로 교차 (${src.type}→${dst.type}, ${hit.distance.toFixed(2)} m)`, source: src, port, hit };
      }
    }
    return null;
  };
  checker.register('optical', '*', 'beam-path', (a, b) => beamHit(a, b) || beamHit(b, a));
}

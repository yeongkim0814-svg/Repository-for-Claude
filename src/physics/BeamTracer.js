/**
 * ============================================================================
 *  BeamTracer — 광학 도메인의 공간 판정 서비스 (Three.js Raycaster)
 * ============================================================================
 *
 *  광학에서 "상호작용 가능"은 충돌이 아니라 **빛의 경로 위에 물체가 있는가**이다.
 *  빛은 기하광학 근사에서 직진하므로, 포트(origin, direction)에서 반직선을 쏘아
 *  처음 맞는 불투명 물체가 곧 빛이 도달하는 대상이다.
 *
 *  같은 프레임에 레이저 렌더링(빔 길이 결정)과 broad phase(누가 맞았나)가 모두
 *  같은 결과를 쓰도록 프레임 단위 캐시를 둔다 → 두 결과가 절대 어긋나지 않는다.
 *
 *  다음 Phase(거울, 렌즈): trace() 결과의 hit 엔티티가 "beam_input" 포트를 가진
 *  광학 소자면 그 소자가 새 빔을 내보내는 식으로 경로를 이어 붙이면 된다
 *  (반사: d' = d − 2(d·n)n, 굴절: 스넬 법칙 n₁sinθ₁ = n₂sinθ₂).
 */
import * as THREE from 'three';

export class BeamTracer {
  constructor(ctx, maxDistance = 30) {
    this.ctx = ctx;
    this.maxDistance = maxDistance;
    this.raycaster = new THREE.Raycaster();
    this.cache = new Map();
  }

  beginFrame() {
    this.cache.clear();
  }

  /**
   * @returns {{origin, direction, point, distance, object, entity}} entity는 도구가 아니면 null
   */
  trace(entity, worldPort) {
    const k = `${entity.id}:${worldPort.name}`;
    if (this.cache.has(k)) return this.cache.get(k);

    const { origin, direction } = worldPort;
    this.raycaster.set(origin, direction);
    this.raycaster.far = this.maxDistance;

    const targets = [...this.ctx.staticBlockers];
    for (const e of this.ctx.entities.entities) if (e !== entity && e.mesh) targets.push(e.mesh);

    const hit = this.raycaster.intersectObjects(targets, true).find((h) => !h.object.userData.noRaycast);
    const result = hit
      ? { origin, direction, point: hit.point, distance: hit.distance, object: hit.object, entity: hit.object.userData.entity ?? null }
      : { origin, direction, point: origin.clone().addScaledVector(direction, this.maxDistance), distance: this.maxDistance, object: null, entity: null };

    this.cache.set(k, result);
    return result;
  }
}

/**
 * ============================================================================
 *  PhysicsWorld — Rapier World 래퍼
 * ============================================================================
 *
 *  역할
 *   1) 고정 시간 간격(fixed timestep) 스텝: 렌더 프레임률과 무관하게 dt = 1/60 s로
 *      적분한다. 가변 dt로 적분하면 같은 실험도 컴퓨터마다 결과가 달라진다.
 *   2) 콜라이더 → 소유 Entity 매핑 (colliderOwner)
 *   3) Rapier 충돌/교차 이벤트를 모아 "현재 접촉 중인 엔티티 쌍" 집합을 유지
 *      → 역학 도메인의 broad phase가 이것을 그대로 사용한다.
 */
import RAPIER from 'rapier';

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class PhysicsWorld {
  constructor() {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.fixedDt = 1 / 60;
    this.world.timestep = this.fixedDt;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.accumulator = 0;

    /** collider handle → Entity (도구가 아닌 테이블·벽 등은 등록하지 않음) */
    this.colliderOwner = new Map();
    /** "h1|h2" → entity pair key : 현재 겹쳐 있는 콜라이더 쌍 */
    this.colliderPairs = new Map();
    /** "idA|idB" → 겹친 콜라이더 쌍의 개수 */
    this.entityPairCount = new Map();
  }

  /**
   * 누적된 실제 시간만큼 고정 스텝을 돌린다.
   * @param {number} frameDt  렌더 프레임 dt (초)
   * @param {(dt:number)=>void} preStep  매 스텝 전 (플레이어 이동, 토크 적용)
   * @param {(dt:number)=>void} postStep 매 스텝 후 (상태 적분, 키네마틱 목표 갱신)
   */
  update(frameDt, preStep, postStep) {
    this.accumulator += Math.min(frameDt, 0.1); // 탭 전환 등으로 인한 폭주 방지
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 5) {
      preStep(this.fixedDt);
      this.world.step(this.eventQueue);
      this.drainEvents();
      postStep(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;
  }

  drainEvents() {
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      const k = pairKey(h1, h2);
      if (started) {
        const a = this.colliderOwner.get(h1);
        const b = this.colliderOwner.get(h2);
        if (!a || !b || a === b || this.colliderPairs.has(k)) return;
        const ek = pairKey(a.id, b.id);
        this.colliderPairs.set(k, ek);
        this.entityPairCount.set(ek, (this.entityPairCount.get(ek) ?? 0) + 1);
      } else {
        this.#dropColliderPair(k);
      }
    });
  }

  #dropColliderPair(k) {
    const ek = this.colliderPairs.get(k);
    if (ek === undefined) return;
    this.colliderPairs.delete(k);
    const n = (this.entityPairCount.get(ek) ?? 1) - 1;
    if (n <= 0) this.entityPairCount.delete(ek);
    else this.entityPairCount.set(ek, n);
  }

  /** 역학 broad phase용: Rapier가 보고한 접촉/근접(센서 교차)이 있는가 */
  entitiesInContact(a, b) {
    return this.entityPairCount.has(pairKey(a.id, b.id));
  }

  registerCollider(collider, owner) {
    this.colliderOwner.set(collider.handle, owner);
  }

  /** 엔티티의 모든 바디(→ 콜라이더·조인트 자동 제거)를 지우고 매핑을 정리한다. */
  removeEntityPhysics(entity) {
    const phys = entity.collider;
    if (!phys) return;
    const handles = new Set(phys.colliders.map((c) => c.handle));
    for (const [k] of this.colliderPairs) {
      const [h1, h2] = k.split('|').map(Number);
      if (handles.has(h1) || handles.has(h2)) this.#dropColliderPair(k);
    }
    for (const h of handles) this.colliderOwner.delete(h);
    for (const body of phys.bodies) this.world.removeRigidBody(body);
    entity.collider = null;
  }
}

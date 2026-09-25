/**
 * ============================================================================
 *  EntityManager — 배치된 엔티티의 생성/제거/재생성 (도구 종류와 무관한 공통 로직)
 * ============================================================================
 *
 *  spawn() 순서
 *   1. Entity 생성 (컴포넌트 초기화)
 *   2. mesh   = def.buildMesh(props) → 씬에 추가, 모든 하위 메시에 userData.entity 태그
 *   3. collider
 *        · anchor: 엔티티 transform에 놓인 fixed 바디 (+ footprint 크기의 고체 콜라이더)
 *        · proximity sensor: footprint보다 margin 만큼 큰 센서 → Rapier 교차 이벤트로
 *          "두 도구가 가까이 있음"을 알린다 (역학 broad phase)
 *        · def.createPhysics(): 도구 고유 바디(도르래 바퀴, 추)와 조인트
 *   4. def.onSpawn()
 */
import * as THREE from 'three';
import { Entity } from './Entity.js';

const PROXIMITY_MARGIN = 0.06; // m

export class EntityManager {
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Entity[]} */
    this.entities = [];
  }

  spawn(def, position, quaternion, properties) {
    const e = new Entity(def, properties);
    e.transform.position.copy(position);
    e.transform.quaternion.copy(quaternion);
    this.#buildMesh(e);
    this.#buildPhysics(e);
    def.onSpawn?.(e, this.ctx);
    this.entities.push(e);
    return e;
  }

  remove(e) {
    this.ctx.physics.removeEntityPhysics(e);
    this.#disposeMesh(e);
    this.entities = this.entities.filter((x) => x !== e);
  }

  /** 속성 변경으로 형상/질량이 바뀌었을 때: 같은 자리·같은 id로 메시와 물리를 다시 만든다. */
  rebuild(e) {
    this.ctx.physics.removeEntityPhysics(e);
    this.#disposeMesh(e);
    e.state = {};
    this.#buildMesh(e);
    this.#buildPhysics(e);
    e.def.onSpawn?.(e, this.ctx);
  }

  /** 설정 패널이 호출: rebuild 여부는 propertyMeta로 결정 (도구별 UI 코드 없음) */
  setProperty(e, key, value) {
    e.properties[key] = value;
    const meta = e.def.propertyMeta?.[key];
    if (meta?.rebuild === false) e.def.onPropertyChange?.(e, key, this.ctx);
    else this.rebuild(e);
  }

  fixedUpdate(dt, phase) {
    for (const e of this.entities) e.def.fixedUpdate?.(e, dt, this.ctx, phase);
  }

  update(dt) {
    for (const e of this.entities) e.def.update?.(e, dt, this.ctx);
  }

  // ───────────────────────────────────────────────────────────────
  #buildMesh(e) {
    const root = e.def.buildMesh(e.properties);
    root.position.copy(e.transform.position);
    root.quaternion.copy(e.transform.quaternion);
    root.traverse((o) => {
      o.userData.entity = e;
      if (o.isMesh && !o.userData.noRaycast) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    root.userData.targetKind = 'entity';
    e.mesh = root;
    this.ctx.scene.add(root);
  }

  #disposeMesh(e) {
    if (!e.mesh) return;
    this.ctx.scene.remove(e.mesh);
    e.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    e.mesh = null;
  }

  #buildPhysics(e) {
    const { RAPIER, world } = this.ctx.physics;
    const p = e.transform.position;
    const q = e.transform.quaternion;
    const fp = e.def.footprint(e.properties);

    const anchor = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
    const colliders = [];

    // 근접 센서: 별도의 키네마틱 바디에 붙인다. Rapier broad phase는 fixed-fixed 쌍을
    // 아예 검사하지 않으므로, 센서를 fixed anchor에 붙이면 나란히 놓인 두 도구가 서로를
    // 감지하지 못한다. (키네마틱 바디는 움직이지 않으면 fixed와 똑같이 제자리에 있다.)
    const sensorBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
    const sensor = world.createCollider(
      RAPIER.ColliderDesc.cuboid(fp.x + PROXIMITY_MARGIN, fp.y + PROXIMITY_MARGIN, fp.z + PROXIMITY_MARGIN)
        .setTranslation(0, fp.y, 0)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
        .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL),
      sensorBody,
    );
    colliders.push(sensor);

    // footprint 고체 콜라이더: 플레이어가 도구를 뚫고 지나가지 않게 + 다른 도구 배치 시 겹침 판정.
    // (fixed 바디라 키네마틱 추와는 접촉 계산이 없고, 조인트로 연결된 동적 부품과는
    //  joint.setContactsEnabled(false)로 접촉을 끈다)
    colliders.push(world.createCollider(RAPIER.ColliderDesc.cuboid(fp.x, fp.y, fp.z).setTranslation(0, fp.y, 0), anchor));

    const extra = e.def.createPhysics?.(e, this.ctx, anchor) ?? {};
    const bodies = [anchor, sensorBody, ...(extra.bodies ?? [])];
    colliders.push(...(extra.colliders ?? []));

    e.collider = { body: anchor, bodies, colliders, joints: extra.joints ?? [], sensor };
    for (const c of colliders) this.ctx.physics.registerCollider(c, e);
  }
}

/** 메시 원점 기준 쿼터니언을 엔티티 로컬로 바꾸는 헬퍼 (동적 서브바디 → 자식 메시 동기화) */
export function worldToLocalQuat(entity, worldQuat, out = new THREE.Quaternion()) {
  return out.copy(entity.transform.quaternion).invert().multiply(worldQuat);
}

/**
 * 화면 중앙 레이캐스트: "플레이어가 지금 무엇을 바라보는가"를 매 프레임 판정한다.
 *
 * 레이캐스트 대상 오브젝트에는 userData.targetKind 가 붙어 있다.
 *   'surface' : 배치 가능한 표면 (테이블 상판, 바닥)
 *   'cabinet' : 찬장 (E로 열기)
 *   'entity'  : 배치된 도구 (userData.entity 로 Entity 참조)
 *   'static'  : 벽·칠판 등 — 시선을 가리기만 함
 * 가장 가까운 히트에서 부모 방향으로 올라가며 첫 targetKind를 찾는다.
 */
import * as THREE from 'three';

const _center = new THREE.Vector2(0, 0);

export class Targeting {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.maxDistance = 6;
    /** @type {null | {kind, object, root, entity, point, normal, distance}} */
    this.current = null;
  }

  update() {
    this.raycaster.setFromCamera(_center, this.camera);
    this.raycaster.far = this.maxDistance;
    const targets = [...this.ctx.staticBlockers];
    for (const e of this.ctx.entities.entities) if (e.mesh) targets.push(e.mesh);

    const hit = this.raycaster.intersectObjects(targets, true).find((h) => !h.object.userData.noRaycast);
    if (!hit) return (this.current = null);

    let root = hit.object;
    while (root && !root.userData.targetKind) root = root.parent;
    if (!root) return (this.current = null);

    const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    this.current = {
      kind: root.userData.targetKind,
      object: hit.object,
      root,
      entity: root.userData.entity ?? null,
      point: hit.point,
      normal,
      distance: hit.distance,
    };
    return this.current;
  }
}

/**
 * 배치 미리보기(고스트)와 배치 가능 판정.
 *
 * 판정 규칙 (모두 만족해야 초록):
 *  1) 겹침 없음 : 도구 footprint 크기의 직육면체를 표면 바로 위(1 cm 띄움)에 놓고
 *                Rapier intersectionsWithShape로 다른 콜라이더(도구, 벽, 찬장, 플레이어)와
 *                교차하는지 검사. 센서(근접 영역)는 제외.
 *  2) 지지됨    : footprint의 네 모서리 + 중심에서 아래로 짧은 광선을 쏴 모두 같은 높이의
 *                표면에 닿아야 함 → 테이블 모서리에 반쯤 걸친 배치를 막는다.
 */
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export class Placement {
  constructor(ctx) {
    this.ctx = ctx;
    this.down = new THREE.Raycaster();
    this.ghost = null;
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x7fe0a0, transparent: true, opacity: 0.45, depthWrite: false });
  }

  /** 표면 히트 지점과 yaw로부터 도구의 월드 자세 계산 */
  pose(point, yaw) {
    return {
      position: point.clone(),
      quaternion: new THREE.Quaternion().setFromAxisAngle(UP, yaw),
    };
  }

  check(def, props, position, quaternion) {
    const { RAPIER, world } = this.ctx.physics;
    const fp = def.footprint(props);

    // 1) 겹침
    const center = new THREE.Vector3(0, fp.y + 0.01, 0).applyQuaternion(quaternion).add(position);
    const shape = new RAPIER.Cuboid(fp.x * 0.97, fp.y * 0.99, fp.z * 0.97);
    let blocked = false;
    world.intersectionsWithShape(
      center, { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }, shape,
      () => { blocked = true; return false; },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    );
    if (blocked) return { ok: false, reason: '다른 물체와 겹침' };

    // 2) 지지
    const surfaces = [];
    for (const b of this.ctx.staticBlockers) b.traverse((o) => o.userData.targetKind === 'surface' && surfaces.push(o));
    const corners = [[0, 0], [fp.x, fp.z], [-fp.x, fp.z], [fp.x, -fp.z], [-fp.x, -fp.z]];
    for (const [x, z] of corners) {
      const from = new THREE.Vector3(x, 0.05, z).applyQuaternion(quaternion).add(position);
      this.down.set(from, new THREE.Vector3(0, -1, 0));
      this.down.far = 0.1;
      if (this.down.intersectObjects(surfaces, false).length === 0) return { ok: false, reason: '표면 밖으로 벗어남' };
    }
    return { ok: true, reason: '' };
  }

  showGhost(def, props) {
    this.hideGhost();
    const g = def.buildMesh(props);
    g.traverse((o) => {
      if (o.isMesh) o.material = this.ghostMat;
      if (o.isLine) o.visible = false;
      o.userData.noRaycast = true;
    });
    // 정면(+Z) 방향 화살표: 레이저처럼 방향이 물리적으로 의미 있는 도구를 위해
    const fp = def.footprint(props);
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, fp.y * 2 + 0.03, 0), Math.max(0.25, fp.z * 2), 0xffffff, 0.06, 0.04);
    g.add(arrow);
    this.ghost = g;
    this.ctx.scene.add(g);
  }

  updateGhost(position, quaternion, ok) {
    if (!this.ghost) return;
    this.ghost.visible = true;
    this.ghost.position.copy(position);
    this.ghost.quaternion.copy(quaternion);
    this.ghostMat.color.set(ok ? 0x7fe0a0 : 0xff8f9f);
  }

  setGhostVisible(v) {
    if (this.ghost) this.ghost.visible = v;
  }

  hideGhost() {
    if (!this.ghost) return;
    this.ctx.scene.remove(this.ghost);
    this.ghost.traverse((o) => o.geometry?.dispose());
    this.ghost = null;
  }
}

/**
 * 실험실 고정 환경: 바닥, 벽, 천장, 실험 테이블, 도구 찬장, 칠판, 조명.
 *
 * 모든 고정 구조물은 (1) Three.js 메시 + (2) Rapier 정적(fixed) 콜라이더 쌍으로 만든다.
 *   메시     → 렌더링, 조준 레이캐스트, 빔 차단
 *   콜라이더 → 캐릭터가 뚫고 지나가지 못함, 배치 겹침 판정
 * userData.targetKind 로 조준 시 의미를 부여한다 ('surface' | 'cabinet' | 'static').
 */
import * as THREE from 'three';
import { Blackboard } from './Blackboard.js';

export const ROOM = { halfX: 7, halfZ: 6, height: 3.2 };
export const TABLE = { x: 0, z: -1.5, halfW: 1.5, halfD: 0.6, height: 0.9 };

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b9b4aa';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#a8a397';
  g.fillRect(0, 0, 128, 128);
  g.fillRect(128, 128, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,.12)';
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ROOM.halfX, ROOM.halfZ);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildLabScene(ctx) {
  const { scene } = ctx;
  const { RAPIER, world } = ctx.physics;
  const blockers = [];

  const addStatic = (mesh, kind, halfExtents, center = mesh.position) => {
    mesh.userData.targetKind = kind;
    mesh.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    scene.add(mesh);
    blockers.push(mesh);
    if (halfExtents) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z));
      const q = mesh.quaternion;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
        body,
      );
    }
    return mesh;
  };

  // ── 조명 ────────────────────────────────────────────────
  scene.background = new THREE.Color(0x20242b);
  scene.add(new THREE.HemisphereLight(0xf0f4ff, 0x4a4238, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(3, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 20 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  for (const x of [-3.5, 0, 3.5]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: 0xfffbe8 }));
    lamp.position.set(x, ROOM.height - 0.03, -1);
    scene.add(lamp);
    const pl = new THREE.PointLight(0xfff4dd, 6, 9, 1.6);
    pl.position.set(x, ROOM.height - 0.3, -1);
    scene.add(pl);
  }

  // ── 바닥 / 벽 / 천장 ────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.halfX * 2, 0.2, ROOM.halfZ * 2),
    new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.9 }),
  );
  floor.position.set(0, -0.1, 0);
  addStatic(floor, 'surface', { x: ROOM.halfX, y: 0.1, z: ROOM.halfZ });

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.95 });
  const t = 0.2;
  const walls = [
    [0, -ROOM.halfZ - t / 2, ROOM.halfX + t, t / 2],
    [0, ROOM.halfZ + t / 2, ROOM.halfX + t, t / 2],
    [-ROOM.halfX - t / 2, 0, t / 2, ROOM.halfZ],
    [ROOM.halfX + t / 2, 0, t / 2, ROOM.halfZ],
  ];
  for (const [x, z, hx, hz] of walls) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, ROOM.height, hz * 2), wallMat);
    w.position.set(x, ROOM.height / 2, z);
    addStatic(w, 'static', { x: hx, y: ROOM.height / 2, z: hz });
  }
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(ROOM.halfX * 2, 0.1, ROOM.halfZ * 2), wallMat);
  ceil.position.set(0, ROOM.height + 0.05, 0);
  addStatic(ceil, 'static', { x: ROOM.halfX, y: 0.05, z: ROOM.halfZ });

  // ── 실험 테이블 ─────────────────────────────────────────
  // 콜라이더는 바닥~상판을 채우는 하나의 직육면체 (테이블 밑으로 기어들어가지 않게)
  const table = new THREE.Group();
  table.position.set(TABLE.x, 0, TABLE.z);
  table.userData.targetKind = 'static';
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE.halfW * 2, 0.06, TABLE.halfD * 2),
    new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.55 }),
  );
  top.position.y = TABLE.height - 0.03;
  top.userData.targetKind = 'surface'; // ← 배치 가능 표면
  table.add(top);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.4 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, TABLE.height - 0.06, 0.07), legMat);
    leg.position.set(sx * (TABLE.halfW - 0.08), (TABLE.height - 0.06) / 2, sz * (TABLE.halfD - 0.08));
    table.add(leg);
  }
  const apron = new THREE.Mesh(new THREE.BoxGeometry(TABLE.halfW * 2 - 0.1, 0.12, TABLE.halfD * 2 - 0.1), legMat);
  apron.position.y = TABLE.height - 0.12;
  table.add(apron);
  addStatic(table, 'static', { x: TABLE.halfW, y: TABLE.height / 2, z: TABLE.halfD }, new THREE.Vector3(TABLE.x, TABLE.height / 2, TABLE.z));

  // ── 도구 찬장 (왼쪽 벽, +X 방향을 바라봄) ────────────────
  const cab = new THREE.Group();
  const cabHalf = { x: 0.35, y: 1.0, z: 0.8 };
  cab.position.set(-ROOM.halfX + cabHalf.x, 0, -2.5);
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(cabHalf.x * 2, cabHalf.y * 2, cabHalf.z * 2), wood);
  body.position.y = cabHalf.y;
  cab.add(body);
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.35, roughness: 0.1 });
  for (const sz of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.7, 0.74), glass);
    door.position.set(cabHalf.x + 0.016, cabHalf.y + 0.05, sz * 0.39);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.03), legMat);
    handle.position.set(cabHalf.x + 0.05, cabHalf.y, sz * 0.06);
    cab.add(door, handle);
  }
  // 선반 위 장식용 도구 실루엣
  for (let i = 0; i < 3; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 1.5), wood);
    shelf.position.set(0, 0.45 + i * 0.55, 0);
    cab.add(shelf);
    const knick = new THREE.Mesh(
      i % 2 ? new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16) : new THREE.BoxGeometry(0.15, 0.12, 0.25),
      new THREE.MeshStandardMaterial({ color: [0xc0392b, 0x2980b9, 0xd4ac0d][i], roughness: 0.4 }),
    );
    knick.position.set(0, 0.56 + i * 0.55, (i - 1) * 0.4);
    cab.add(knick);
  }
  const sign = makeLabel('실험 도구 (E)');
  sign.position.set(cabHalf.x + 0.02, cabHalf.y * 2 + 0.12, 0);
  sign.rotation.y = Math.PI / 2;
  cab.add(sign);
  addStatic(cab, 'cabinet', cabHalf, new THREE.Vector3(cab.position.x, cabHalf.y, cab.position.z));

  // ── 칠판 (뒤쪽 벽) ─────────────────────────────────────
  const blackboard = new Blackboard(4, 1.6);
  blackboard.mesh.position.set(0, 1.75, -ROOM.halfZ + 0.03);
  addStatic(blackboard.mesh, 'static', { x: 2.08, y: 0.88, z: 0.03 });

  return { staticBlockers: blockers, blackboard };
}

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1f26';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#ffd54a';
  g.font = 'bold 54px sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.19), new THREE.MeshBasicMaterial({ map: tex }));
}

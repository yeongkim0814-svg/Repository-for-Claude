/**
 * 실험실 고정 환경: 바닥, 벽, 천장, 실험 테이블, 도구 찬장, 칠판, 조명, 장식 소품.
 *
 * 모든 고정 구조물은 (1) Three.js 메시 + (2) Rapier 정적(fixed) 콜라이더 쌍으로 만든다.
 *   메시     → 렌더링, 조준 레이캐스트, 빔 차단
 *   콜라이더 → 캐릭터가 뚫고 지나가지 못함, 배치 겹침 판정
 * userData.targetKind 로 조준 시 의미를 부여한다 ('surface' | 'cabinet' | 'static').
 *
 * 아트 스타일은 scene/style.js (Surgeon Simulator 풍 병원 실험실).
 */
import * as THREE from 'three';
import { Blackboard } from './Blackboard.js';
import { PALETTE as C, toy, metal, rbox, cyl, labelTexture } from './style.js';

export const ROOM = { halfX: 7, halfZ: 6, height: 3.2 };
export const TABLE = { x: 0, z: -1.5, halfW: 1.5, halfD: 0.6, height: 0.9 };

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const s = 256;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = (i + j) % 2 ? '#efeaf3' : '#faf7f2'; // 크림 · 옅은 라벤더 체크
    g.fillRect(i * s, j * s, s, s);
    // 타일 가장자리 하이라이트/음영 → 살짝 볼록한 타일
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(i * s + 6, j * s + 6, s - 12, 5);
    g.fillStyle = 'rgba(0,40,50,.06)';
    g.fillRect(i * s + 6, j * s + s - 11, s - 12, 5);
  }
  g.strokeStyle = '#e2dcd4';
  g.lineWidth = 5;
  for (let k = 0; k <= 2; k++) {
    g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s, 512); g.stroke();
    g.beginPath(); g.moveTo(0, k * s); g.lineTo(512, k * s); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ROOM.halfX / 0.6, ROOM.halfZ / 0.6); // 타일 한 장 = 0.6 m
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildLabScene(ctx) {
  const { scene } = ctx;
  const { RAPIER, world } = ctx.physics;
  const blockers = [];

  const shade = (obj) => obj.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });

  const addStatic = (mesh, kind, halfExtents, center = mesh.position) => {
    mesh.userData.targetKind = kind;
    shade(mesh);
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
  /** 레이캐스트·충돌에 관여하지 않는 순수 장식 */
  const addDecor = (obj) => {
    shade(obj);
    obj.traverse((o) => (o.userData.noRaycast = true));
    scene.add(obj);
    return obj;
  };

  // ── 조명: 밝은 병원 조명 + 수술등 ───────────────────────────
  scene.background = new THREE.Color(0xeaf6f3);
  scene.fog = new THREE.Fog(0xeaf6f3, 11, 28); // 원경을 옅게 → 부드러운 깊이감
  // 반구광을 강하게: 그림자 쪽도 어둡게 가라앉지 않고 파스텔 색이 유지됨
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf3e6ee, 1.35));
  const sun = new THREE.DirectionalLight(0xfff4ec, 1.1);
  sun.position.set(3, 7, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 20 });
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 14;      // VSM 블러 반경 → 넓고 부드러운 그림자
  sun.shadow.blurSamples = 20;
  scene.add(sun);

  // 수술등 (테이블 위): 천장 기둥 + 관절 팔 + 원형 등갓 + 스포트라이트
  const surg = new THREE.Group();
  surg.position.set(TABLE.x, 0, TABLE.z);
  const pole = new THREE.Mesh(cyl(0.05, 0.5), metal());
  pole.position.y = ROOM.height - 0.25;
  const arm = new THREE.Mesh(rbox(0.9, 0.08, 0.1, 0.04), toy(C.white));
  arm.position.set(0.4, ROOM.height - 0.5, 0);
  const head = new THREE.Mesh(cyl(0.36, 0.14, 0.26, 40), toy(C.white));
  head.position.set(0.8, ROOM.height - 0.72, 0);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshBasicMaterial({ color: 0xfffdf0 }));
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0.8, ROOM.height - 0.795, 0);
  for (let i = 0; i < 6; i++) {
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const a = (i / 6) * Math.PI * 2;
    bulb.rotation.x = Math.PI / 2;
    bulb.position.set(0.8 + Math.cos(a) * 0.17, ROOM.height - 0.797, Math.sin(a) * 0.17);
    surg.add(bulb);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.03, 12, 40), toy(C.teal));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.8, ROOM.height - 0.72, 0);
  surg.add(pole, arm, head, glass, ring);
  addDecor(surg);
  const spot = new THREE.SpotLight(0xfff6ee, 14, 6, 0.8, 0.9, 1.4);
  spot.position.set(TABLE.x + 0.8, ROOM.height - 0.8, TABLE.z);
  spot.target.position.set(TABLE.x, TABLE.height, TABLE.z);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  spot.shadow.radius = 10;
  spot.shadow.blurSamples = 16;
  scene.add(spot, spot.target);

  // 천장 LED 패널
  for (const [x, z] of [[-4, -2.5], [4, -2.5], [-4, 2.5], [4, 2.5]]) {
    const panel = new THREE.Mesh(rbox(1.4, 0.06, 0.7, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    panel.position.set(x, ROOM.height - 0.02, z);
    addDecor(panel);
  }

  // ── 바닥 / 벽 / 천장 ────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.halfX * 2, 0.2, ROOM.halfZ * 2),
    new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.35, metalness: 0 }),
  );
  floor.position.set(0, -0.1, 0);
  addStatic(floor, 'surface', { x: ROOM.halfX, y: 0.1, z: ROOM.halfZ });

  const wallMat = toy(C.mint, { rough: 0.8, clearcoat: 0 });
  const t = 0.2;
  const walls = [
    // x, z, hx, hz, 안쪽 법선 방향(n)
    [0, -ROOM.halfZ - t / 2, ROOM.halfX + t, t / 2, [0, 1]],
    [0, ROOM.halfZ + t / 2, ROOM.halfX + t, t / 2, [0, -1]],
    [-ROOM.halfX - t / 2, 0, t / 2, ROOM.halfZ, [1, 0]],
    [ROOM.halfX + t / 2, 0, t / 2, ROOM.halfZ, [-1, 0]],
  ];
  for (const [x, z, hx, hz, [nx, nz]] of walls) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, ROOM.height, hz * 2), wallMat);
    w.position.set(x, ROOM.height / 2, z);
    addStatic(w, 'static', { x: hx, y: ROOM.height / 2, z: hz });

    // 병원 벽 장식: 아래쪽 청록 판넬, 흰 난간 띠, 걸레받이
    const len = nx === 0 ? ROOM.halfX * 2 : ROOM.halfZ * 2;
    const band = (y, h, depth, mat) => {
      const m = new THREE.Mesh(nx === 0 ? rbox(len, h, depth, 0.01) : rbox(depth, h, len, 0.01), mat);
      m.position.set(x + nx * (t / 2 + depth / 2), y, z + nz * (t / 2 + depth / 2));
      addDecor(m);
    };
    band(0.55, 1.1, 0.02, toy(C.teal, { rough: 0.6, clearcoat: 0.3 }));
    band(1.12, 0.07, 0.06, toy(C.white));
    band(0.06, 0.12, 0.04, toy(C.tealDark));
  }
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(ROOM.halfX * 2, 0.1, ROOM.halfZ * 2), toy(C.white, { rough: 0.9, clearcoat: 0 }));
  ceil.position.set(0, ROOM.height + 0.05, 0);
  addStatic(ceil, 'static', { x: ROOM.halfX, y: 0.05, z: ROOM.halfZ });

  // ── 실험 테이블 (스테인리스 상판 + 청록 다리 + 주황 고무발) ──
  // 콜라이더는 바닥~상판을 채우는 하나의 직육면체 (테이블 밑으로 기어들어가지 않게)
  const table = new THREE.Group();
  table.position.set(TABLE.x, 0, TABLE.z);
  table.userData.targetKind = 'static';
  const top = new THREE.Mesh(rbox(TABLE.halfW * 2, 0.06, TABLE.halfD * 2, 0.025), toy(0xf4f1fa, { rough: 0.45, clearcoat: 0.5 })); // 연라벤더 화이트 상판
  top.position.y = TABLE.height - 0.03;
  top.userData.targetKind = 'surface'; // ← 배치 가능 표면
  table.add(top);
  const apron = new THREE.Mesh(rbox(TABLE.halfW * 2 - 0.12, 0.14, TABLE.halfD * 2 - 0.12, 0.04), toy(C.white));
  apron.position.y = TABLE.height - 0.13;
  const shelf = new THREE.Mesh(rbox(TABLE.halfW * 2 - 0.2, 0.04, TABLE.halfD * 2 - 0.2, 0.015), toy(C.offWhite));
  shelf.position.y = 0.22;
  table.add(apron, shelf);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(cyl(0.04, TABLE.height - 0.1), toy(C.teal));
    leg.position.set(sx * (TABLE.halfW - 0.1), (TABLE.height - 0.1) / 2 + 0.04, sz * (TABLE.halfD - 0.1));
    const foot = new THREE.Mesh(cyl(0.055, 0.05, 0.045), toy(C.orange));
    foot.position.set(leg.position.x, 0.025, leg.position.z);
    table.add(leg, foot);
  }
  addStatic(table, 'static', { x: TABLE.halfW, y: TABLE.height / 2, z: TABLE.halfD }, new THREE.Vector3(TABLE.x, TABLE.height / 2, TABLE.z));

  // ── 도구 찬장 (왼쪽 벽, +X 방향을 바라봄) ────────────────
  const cab = new THREE.Group();
  const cabHalf = { x: 0.35, y: 1.0, z: 0.8 };
  cab.position.set(-ROOM.halfX + cabHalf.x, 0, -2.5);
  const body = new THREE.Mesh(rbox(cabHalf.x * 2, cabHalf.y * 2, cabHalf.z * 2, 0.06), toy(C.white));
  body.position.y = cabHalf.y;
  cab.add(body);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1 });
  for (const sz of [-1, 1]) {
    const frame = new THREE.Mesh(rbox(0.04, 1.72, 0.74, 0.02), toy(C.teal));
    frame.position.set(cabHalf.x + 0.01, cabHalf.y + 0.04, sz * 0.39);
    const pane = new THREE.Mesh(rbox(0.02, 1.4, 0.56, 0.01), glassMat);
    pane.position.set(cabHalf.x + 0.03, cabHalf.y + 0.1, sz * 0.39);
    const handle = new THREE.Mesh(rbox(0.05, 0.22, 0.05, 0.02), toy(C.yellow));
    handle.position.set(cabHalf.x + 0.06, cabHalf.y, sz * 0.08);
    cab.add(frame, pane, handle);
  }
  // 선반 위 알록달록한 실험 기구 (장식)
  const knickColors = [C.red, C.blue, C.yellow, C.purple, C.orange, C.green];
  for (let i = 0; i < 3; i++) {
    const shelfM = new THREE.Mesh(rbox(0.6, 0.03, 1.5, 0.01), toy(C.offWhite));
    shelfM.position.set(0, 0.45 + i * 0.55, 0);
    cab.add(shelfM);
    for (let k = 0; k < 2; k++) {
      const col = knickColors[i * 2 + k];
      const knick = new THREE.Mesh(
        (i + k) % 2 ? cyl(0.07, 0.22, 0.04) : rbox(0.18, 0.14, 0.24),
        toy(col),
      );
      knick.position.set(-0.02, 0.58 + i * 0.55, (k ? 0.35 : -0.35));
      cab.add(knick);
    }
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.26), new THREE.MeshBasicMaterial({ map: labelTexture('🧪 실험 도구 (E)', { bg: '#a6ddd2', fg: '#4f5d66' }), transparent: true }));
  sign.position.set(cabHalf.x + 0.02, cabHalf.y * 2 + 0.2, 0);
  sign.rotation.y = Math.PI / 2;
  cab.add(sign);
  addStatic(cab, 'cabinet', cabHalf, new THREE.Vector3(cab.position.x, cabHalf.y, cab.position.z));

  // ── 칠판 (뒤쪽 벽) ─────────────────────────────────────
  const blackboard = new Blackboard(4, 1.6);
  blackboard.mesh.position.set(0, 1.75, -ROOM.halfZ + 0.04);
  addStatic(blackboard.mesh, 'static', { x: 2.1, y: 0.9, z: 0.04 });

  // ── 소품 (충돌체 있음) ──────────────────────────────────
  // 빨간 휴지통
  const bin = new THREE.Group();
  const binBody = new THREE.Mesh(cyl(0.2, 0.5, 0.23), toy(C.red));
  binBody.position.y = 0.25;
  const lid = new THREE.Mesh(cyl(0.24, 0.05), toy(C.white));
  lid.position.y = 0.52;
  bin.add(binBody, lid);
  bin.position.set(-ROOM.halfX + 0.5, 0, 1.2);
  addStatic(bin, 'static', { x: 0.24, y: 0.27, z: 0.24 }, new THREE.Vector3(bin.position.x, 0.27, bin.position.z));

  // 오른쪽 벽의 이동식 카트 + 비커
  const cart = new THREE.Group();
  for (const y of [0.25, 0.8]) {
    const tray = new THREE.Mesh(rbox(0.5, 0.05, 0.9, 0.02), toy(C.white));
    tray.position.y = y;
    cart.add(tray);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(cyl(0.018, 0.8), metal());
    post.position.set(sx * 0.22, 0.45, sz * 0.42);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), toy(C.ink));
    wheel.position.set(sx * 0.22, 0.04, sz * 0.42);
    cart.add(post, wheel);
  }
  const liquids = [C.green, C.purple, C.orange];
  liquids.forEach((col, i) => {
    const beaker = new THREE.Mesh(cyl(0.05, 0.14), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1 }));
    beaker.position.set(0, 0.9, -0.3 + i * 0.3);
    const liquid = new THREE.Mesh(cyl(0.044, 0.08), toy(col, { emissive: col, emissiveIntensity: 0.25 }));
    liquid.position.set(0, 0.87, -0.3 + i * 0.3);
    cart.add(beaker, liquid);
  });
  cart.position.set(ROOM.halfX - 0.45, 0, -2.2);
  addStatic(cart, 'static', { x: 0.26, y: 0.5, z: 0.46 }, new THREE.Vector3(cart.position.x, 0.5, cart.position.z));

  // 벽 포스터
  const poster = (text, bg, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.34), new THREE.MeshBasicMaterial({ map: labelTexture(text, { bg, fg: '#5b6770', border: '#ffffff' }), transparent: true }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    addDecor(m);
  };
  poster('⚠ 레이저를 눈으로 보지 마세요', '#ffc2cb', ROOM.halfX - 0.01, 1.9, 1.2, -Math.PI / 2);
  poster('🥽 보안경 착용!', '#c6dcff', -ROOM.halfX + 0.01, 1.9, 1.5, Math.PI / 2);
  poster('F = ma 는 언제나 옳다*', '#ddd2ff', 3.8, 2.3, -ROOM.halfZ + 0.01, 0);

  // 오른쪽 벽의 문 (장식)
  const door = new THREE.Group();
  const dFrame = new THREE.Mesh(rbox(0.08, 2.2, 1.2, 0.03), toy(C.white));
  dFrame.position.y = 1.1;
  const dLeaf = new THREE.Mesh(rbox(0.06, 2.05, 1.0, 0.03), toy(C.blue));
  dLeaf.position.set(-0.02, 1.05, 0);
  const dWin = new THREE.Mesh(rbox(0.07, 0.4, 0.3, 0.05), new THREE.MeshPhysicalMaterial({ color: 0xcff3ff, roughness: 0.05, clearcoat: 1 }));
  dWin.position.set(-0.03, 1.55, 0);
  const dKnob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), toy(C.yellow));
  dKnob.position.set(-0.08, 1.0, -0.38);
  door.add(dFrame, dLeaf, dWin, dKnob);
  door.position.set(ROOM.halfX - 0.03, 0, 3.4);
  addDecor(door);

  return { staticBlockers: blockers, blackboard };
}

/**
 * 1인칭 손 + "손에 든 도구" 표시 (Surgeon Simulator 풍 파란 수술 장갑).
 *
 * 별도의 씬(heldScene)에 두고, 메인 씬을 그린 뒤 깊이 버퍼를 지우고 한 번 더 그린다.
 * → 벽에 바짝 붙어도 손과 도구가 벽을 뚫고 잘려 보이지 않는다 (FPS 무기 렌더링 기법).
 *
 * 애니메이션
 *   · 대기  : 손가락을 살짝 편 채 숨쉬듯 흔들림
 *   · 걷기  : 걸음 주기에 맞춰 위아래·좌우 흔들림 (head bob)
 *   · 들기  : 손가락이 도구를 감싸 쥠
 *   · E/클릭: 손을 한 번 꽉 쥐었다 폄 (pulse)
 * 모든 동작은 목표값으로 지수 보간(lerp)해 부드럽게 전환한다.
 */
import * as THREE from 'three';
import { PALETTE as C, toy, rbox } from '../scene/style.js';

const REST = new THREE.Vector3(0.2, -0.17, -0.42);

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12).rotateX(Math.PI / 2).translate(0, 0, -len / 2), mat);
  return m;
}

/** 손가락: 두 마디. pivot.rotation.x = 첫 마디 굽힘, pivot.userData.tip.rotation.x = 둘째 마디 굽힘 */
function finger(len, r, mat) {
  const pivot = new THREE.Group();
  pivot.add(capsule(r, len * 0.55, mat));
  const tip = new THREE.Group();
  tip.position.z = -len * 0.55 - r * 0.6;
  tip.add(capsule(r * 0.95, len * 0.45, mat));
  pivot.add(tip);
  pivot.userData.tip = tip;
  return pivot;
}

export class HeldView {
  constructor(camera) {
    this.camera = camera;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9fd8cc, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1, 2, 1);
    this.scene.add(key);
    this.anchor = new THREE.Group();
    this.scene.add(this.anchor);

    this.hand = this.#buildHand();
    this.anchor.add(this.hand);

    this.item = null;
    this.t = 0;
    this.walkPhase = 0;
    this.walkAmt = 0;
    this.grip = 0.25;   // 0 = 펼침, 1 = 꽉 쥠
    this.pulseT = 0;
  }

  #buildHand() {
    const glove = toy(C.glove, { rough: 0.45, clearcoat: 0.9 });
    const hand = new THREE.Group();

    // 소매(청록 수술복) + 장갑 커프
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.1, 24).rotateX(Math.PI / 2).translate(0, 0, 0.1), toy(C.scrubs, { rough: 0.9, clearcoat: 0 }));
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 24), toy(0x74b8f0));
    cuff.position.z = 0.04;
    const wrist = capsule(0.036, 0.05, glove);
    wrist.position.z = 0.05;

    // 손바닥 (위를 향함)
    const palm = new THREE.Mesh(rbox(0.088, 0.032, 0.1, 0.014), glove);
    palm.position.z = -0.03;
    hand.add(sleeve, cuff, wrist, palm);

    this.fingers = [];
    const specs = [ // x, 길이
      [-0.033, 0.07], [-0.011, 0.078], [0.011, 0.074], [0.032, 0.06],
    ];
    for (const [x, len] of specs) {
      const f = finger(len, 0.0105, glove);
      f.position.set(x, 0.002, -0.078);
      hand.add(f);
      this.fingers.push(f);
    }
    // 엄지 (오른손, 손바닥이 아래 → 엄지는 −x 쪽)
    this.thumb = finger(0.055, 0.012, glove);
    this.thumb.position.set(-0.045, -0.006, -0.02);
    this.thumb.rotation.y = 0.9;
    hand.add(this.thumb);

    // 물건을 쥐는 자리 (손가락 끝 아래)
    this.socket = new THREE.Group();
    this.socket.position.set(-0.01, -0.035, -0.13);
    hand.add(this.socket);

    hand.position.copy(REST);
    hand.rotation.set(-0.12, 0.38, 0.28); // 손등이 보이게(손바닥 아래), 손끝은 화면 안쪽·가운데
    return hand;
  }

  show(def, props) {
    this.clear();
    const mesh = def.buildMesh(props);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const s = 0.24 / Math.max(size.x, size.y, size.z);
    mesh.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
    mesh.position.sub(c);
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.rotation.set(-0.3, 0.9, -0.4);
    this.item = holder;
    this.socket.add(holder);
  }

  clear() {
    if (!this.item) return;
    this.socket.remove(this.item);
    this.item.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material ?? []).forEach((m) => m.dispose());
    });
    this.item = null;
  }

  /** E·클릭 시 한 번 꽉 쥐는 동작 */
  pulse() {
    this.pulseT = 1;
  }

  render(renderer, dt, moving = false) {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 10);

    // 걷기 흔들림
    this.walkAmt += ((moving ? 1 : 0) - this.walkAmt) * k;
    this.walkPhase += dt * 9 * this.walkAmt;
    const bobX = Math.sin(this.walkPhase) * 0.012 * this.walkAmt;
    const bobY = -Math.abs(Math.cos(this.walkPhase)) * 0.014 * this.walkAmt + Math.sin(this.t * 1.6) * 0.003;

    // 쥐기 정도
    this.pulseT = Math.max(0, this.pulseT - dt * 4);
    const target = Math.min(1, (this.item ? 0.8 : 0.22) + this.pulseT * 0.7);
    this.grip += (target - this.grip) * k;
    this.fingers.forEach((f, i) => {
      const g = this.grip + Math.sin(this.t * 2 + i) * 0.02;
      f.rotation.x = -g * 1.25;          // 음(-)의 x 회전 = 손바닥(아래) 쪽으로 굽힘
      f.userData.tip.rotation.x = -g * 1.1;
    });
    this.thumb.rotation.x = -this.grip * 0.6;
    this.thumb.userData.tip.rotation.x = -this.grip * 0.7;

    this.hand.position.set(REST.x + bobX, REST.y + bobY - this.pulseT * 0.015, REST.z + this.pulseT * 0.02);

    this.anchor.matrixAutoUpdate = false;
    this.anchor.matrix.copy(this.camera.matrixWorld);
    this.anchor.matrixWorldNeedsUpdate = true;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
}

/**
 * 1인칭 "손에 든 도구" 표시.
 * 별도의 씬(heldScene)에 두고, 메인 씬을 그린 뒤 깊이 버퍼를 지우고 한 번 더 그린다.
 * → 벽에 바짝 붙어도 들고 있는 도구가 벽을 뚫고 잘려 보이지 않는다 (FPS 무기 렌더링 기법).
 */
import * as THREE from 'three';

export class HeldView {
  constructor(camera) {
    this.camera = camera;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2));
    this.anchor = new THREE.Group();
    this.scene.add(this.anchor);
    this.item = null;
    this.t = 0;
  }

  show(def, props) {
    this.clear();
    const mesh = def.buildMesh(props);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const s = 0.3 / Math.max(size.x, size.y, size.z);
    mesh.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
    const holder = new THREE.Group();
    mesh.position.sub(c);
    holder.add(mesh);
    holder.position.set(0.32, -0.27, -0.55);
    holder.rotation.set(0.25, -0.6, 0);
    this.item = holder;
    this.anchor.add(holder);
  }

  clear() {
    if (!this.item) return;
    this.anchor.remove(this.item);
    this.item.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material ?? []).forEach((m) => m.dispose());
    });
    this.item = null;
  }

  render(renderer, dt) {
    if (!this.item) return;
    this.t += dt;
    this.item.position.y = -0.27 + Math.sin(this.t * 2) * 0.004; // 살짝 흔들림
    this.anchor.matrixAutoUpdate = false;
    this.anchor.matrix.copy(this.camera.matrixWorld);
    this.anchor.matrixWorldNeedsUpdate = true;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
}

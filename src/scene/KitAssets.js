/**
 * ============================================================================
 *  KitAssets — Kenney "Factory Kit" (CC0) glTF 소품 로더
 * ============================================================================
 *
 *  실험실의 실제 실험 도구(도르래·레이저 등)는 지금까지처럼 style.js의 절차적
 *  지오메트리(rbox/cyl + toy/metal 재질)로 만든다. 이 모듈은 그와 별개로,
 *  걸어다닐 배경을 채우는 **순수 장식** 소품(배관·크레인·상자·톱니바퀴 등)을
 *  실제 3D 모델(vendor/kenney/factory-kit/*.glb)로 배치하기 위한 것이다.
 *
 *  · 모든 모델이 같은 팔레트 텍스처(Textures/colormap.png)의 서로 다른 UV
 *    영역을 샘플링하는 방식이라, 파일마다 별도 텍스처가 없다 (가볍다).
 *  · placeKitProp()이 로드한 원본(template)은 캐시하고, 배치할 때마다
 *    clone(true)만 한다 — 같은 소품을 몇 번 놓아도 네트워크 요청은 1회.
 *  · material.color를 은은한 파스텔 톤으로 곱해 기존 파스텔 실험실 톤과
 *    어울리게 한다 (유리 재질은 원래 색 유지).
 *  · 장식이므로 기본값은 레이캐스트/충돌 없음. collide:true를 주면 로드된
 *    모델의 실제 바운딩 박스로 Rapier 고정 콜라이더를 자동 생성한다
 *    (모델마다 크기를 직접 잴 필요가 없다).
 *
 *  로딩은 비동기(glTF fetch)라서 buildLabScene()과 분리되어 있다:
 *  main.js가 buildLabScene() 이후 dressFactoryDecor(ctx)를 fire-and-forget으로
 *  호출한다. 소품은 씬에 순서대로 나타나며, 실패한 개별 소품은 콘솔에만 남기고
 *  나머지 배치를 막지 않는다.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = 'vendor/kenney/factory-kit/';
const PASTEL_TINT = new THREE.Color(0xdce8f2); // 채도를 살짝 낮춰 실험실 파스텔 톤과 맞춘다

const loader = new GLTFLoader().setPath(BASE);
const cache = new Map();

function load(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      loader.loadAsync(`${name}.glb`).then((gltf) => {
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          for (const m of [].concat(o.material)) {
            if (m.name !== 'material-glass') m.color?.multiply(PASTEL_TINT);
            m.envMapIntensity = 0.6;
          }
        });
        return gltf.scene;
      }),
    );
  }
  return cache.get(name);
}

/**
 * 소품 하나를 배치한다.
 * @param {{position:THREE.Vector3, rotationY?:number, scale?:number, collide?:boolean}} opts
 */
export async function placeKitProp(ctx, name, opts = {}) {
  const { position, rotationY = 0, scale = 1, collide = false } = opts;
  let template;
  try {
    template = await load(name);
  } catch (err) {
    console.warn(`[KitAssets] "${name}" 로드 실패 (장식 소품이라 계속 진행함):`, err);
    return null;
  }
  const inst = template.clone(true);
  inst.position.copy(position);
  inst.rotation.y = rotationY;
  inst.scale.setScalar(scale);
  inst.traverse((o) => (o.userData.noRaycast = true));
  ctx.scene.add(inst);

  if (collide) {
    // setFromObject는 호출 시점의 matrixWorld를 그대로 쓰므로, 방금 바꾼 position/rotation/scale이
    // 반영되도록 먼저 강제로 갱신한다 (렌더 루프가 아직 한 번도 안 돌았을 수 있음).
    inst.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(inst);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const { RAPIER, world } = ctx.physics;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(size.x / 2, 0.01), Math.max(size.y / 2, 0.01), Math.max(size.z / 2, 0.01)), body);
  }
  return inst;
}

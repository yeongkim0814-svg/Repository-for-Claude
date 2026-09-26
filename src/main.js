/**
 * ============================================================================
 *  main.js — 조립(composition root)과 메인 루프
 * ============================================================================
 *
 *  ctx (모든 시스템이 공유하는 컨텍스트)
 *    scene, camera, physics(PhysicsWorld), entities(EntityManager),
 *    optics(OpticalSystem), staticBlockers, blackboard, engine, ui
 *
 *  한 프레임의 순서
 *    1. physics.update  : 고정 dt 스텝 반복 [플레이어 이동 → 도구 'pre' → Rapier step
 *                         → 충돌 이벤트 수집 → 도구 'post']
 *    2. 카메라를 캐릭터 눈높이에 맞춤
 *    3. optics.update   : 광선 추적 (광원 → 거울·렌즈·유리 respond → 흡수), 광학적 연결 기록
 *       entities.update : 도구 시각 갱신 (스크린 무늬 그리기 등)
 *    4. engine.update   : 상호작용 엔진 (broad → narrow)
 *    5. stateMachine    : 조준 레이캐스트 + idle/aiming/holding/placing
 *    6. 렌더 (메인 씬 → 깊이 클리어 → 손에 든 도구)
 */
import * as THREE from 'three';
import RAPIER from 'rapier';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// 도구 정의를 가장 먼저 등록 (찬장 목록 순서 = tools/index.js 의 import 순서)
import './tools/index.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { OpticalSystem } from './physics/OpticalSystem.js';
import { spawnDemo } from './demos.js';
import { EntityManager } from './core/EntityManager.js';
import { ToolRegistry } from './core/ToolRegistry.js';
import { InteractionRegistry } from './interaction/InteractionRegistry.js';
import { ProximityChecker } from './interaction/ProximityChecker.js';
import { InteractionEngine } from './interaction/InteractionEngine.js';
import { registerDefaultStrategies } from './interaction/proximityStrategies.js';
import { registerRules } from './interaction/rules.js';
import { buildLabScene, TABLE } from './scene/LabScene.js';
import { dressFactoryDecor } from './scene/FactoryDecor.js';
import { InputManager } from './player/InputManager.js';
import { PlayerController } from './player/PlayerController.js';
import { Targeting } from './player/Targeting.js';
import { InteractionStateMachine } from './player/InteractionStateMachine.js';
import { TouchControls, isTouchDevice } from './player/TouchControls.js';
import { HUD } from './ui/HUD.js';
import { HeldView } from './ui/HeldView.js';
import { UIManager } from './ui/UIManager.js';

await RAPIER.init();
// 캔버스 텍스처(칠판·간판)가 둥근 폰트로 그려지도록 웹폰트를 잠깐 기다린다 (오프라인이면 1.5초 후 기본 폰트)
await Promise.race([
  Promise.all(['64px Jua', '64px Fredoka'].map((f) => document.fonts.load(f))).catch(() => {}),
  new Promise((r) => setTimeout(r, 1500)),
]);

// ── 렌더러 / 카메라 ─────────────────────────────────────────
const params = new URLSearchParams(location.search);
// ?lowfx : 저사양 모드 (그림자 끔, 픽셀 비율 1) — 내장 그래픽 노트북용
const LOW_FX = params.has('lowfx');
// 태블릿/폰 판정: coarse 포인터(손가락) 우선 여부. ?touch=1/0으로 강제 전환 가능(테스트용).
const TOUCH = params.has('touch') ? params.get('touch') !== '0' : isTouchDevice();
document.body.classList.toggle('touch-mode', TOUCH);
const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(LOW_FX ? 1 : Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !LOW_FX;
// 부드러운 파스텔 룩
//  · VSM 그림자: 그림자 가장자리를 가우시안으로 흐려 넓고 부드럽게 번짐 (shadow.radius / blurSamples)
//  · Neutral 톤매핑: ACES처럼 채도·대비를 누르지 않아 파스텔 색이 그대로 유지됨
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 100);
scene.add(camera);

// ── 컨텍스트 조립 ───────────────────────────────────────────
const ctx = { THREE, scene, camera, registry: InteractionRegistry, tools: ToolRegistry };
ctx.physics = new PhysicsWorld();
ctx.entities = new EntityManager(ctx);
Object.assign(ctx, buildLabScene(ctx)); // staticBlockers, blackboard
ctx.optics = new OpticalSystem(ctx);
// 배경 장식(Kenney 소품)은 glTF를 비동기로 불러온다 — 로딩을 기다리지 않고 하나씩 나타나게 둔다.
dressFactoryDecor(ctx).catch((err) => console.warn('[FactoryDecor] 배경 장식 배치 중 오류:', err));

const checker = new ProximityChecker();
registerDefaultStrategies(checker, ctx);
registerRules();
ctx.engine = new InteractionEngine({ checker, registry: InteractionRegistry, ctx });

const player = new PlayerController(ctx, camera, document.body, new THREE.Vector3(0, 0, 2.5), { touch: TOUCH });
const basePointerSpeed = player.controls.pointerSpeed; // 확대 시 이 값에 비례해서 줄인다 (터치/데스크톱 공통)
camera.lookAt(0, 1.0, TABLE.z);
const ui = (ctx.ui = new UIManager(ctx, player.controls));
const input = new InputManager(() => player.controls.isLocked && !ui.isModalOpen());
player.controls.addEventListener('unlock', () => input.clear());
const hud = new HUD(ctx);
const heldView = new HeldView(camera);
heldView.scene.environment = envMap;
heldView.scene.environmentIntensity = 0.5;
addEventListener('keydown', (e) => e.code === 'KeyE' && player.controls.isLocked && heldView.pulse());
addEventListener('mousedown', () => player.controls.isLocked && heldView.pulse());
const stateMachine = new InteractionStateMachine(ctx, {
  input, targeting: new Targeting(ctx, camera), player, hud, ui, heldView,
});
Object.assign(ctx, { player, input, stateMachine });

// 태블릿/폰: 조이스틱 + 버튼 HUD (E/F 버튼은 자체적으로 heldView.pulse()도 호출한다)
const touchControls = TOUCH ? new TouchControls(ctx, { input, heldView }) : null;

// ── ?demo[=slit|mirror|lens|tir] : 프리셋 배치 (src/demos.js) ──
if (params.has('demo')) spawnDemo(ctx, params.get('demo'));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── 메인 루프 ───────────────────────────────────────────────
const timer = new THREE.Timer();
timer.connect(document);
function frame() {
  timer.update();
  const dt = timer.getDelta();
  scene.updateMatrixWorld();

  ctx.physics.update(
    dt,
    (h) => {
      player.fixedUpdate(h, input);
      ctx.entities.fixedUpdate(h, 'pre');
    },
    (h) => ctx.entities.fixedUpdate(h, 'post'),
  );
  player.syncCamera();
  // 확대(우클릭 또는 Z 누르고 있기): mm 단위 간섭 무늬를 테이블 너머에서 보기 위한 쌍안경
  const zoom = input.isDown('Mouse2') || input.isDown('KeyZ');
  const fov = THREE.MathUtils.lerp(camera.fov, zoom ? 12 : 72, 1 - Math.exp(-dt * 12));
  if (Math.abs(fov - camera.fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    player.controls.pointerSpeed = basePointerSpeed * (fov / 72); // 확대 중에는 조준도 정밀하게
  }
  heldView.anchor.visible = fov > 40;
  ctx.optics.renderer.airVisibility = THREE.MathUtils.clamp((fov - 12) / 40, 0.12, 1);
  document.body.classList.toggle('zoomed', fov < 40);

  ctx.optics.update();      // 광선 추적 (광학 도메인 솔버) → 광학 소자 respond, 광학적 연결 기록
  ctx.entities.update(dt);
  ctx.engine.update(ctx.entities.entities);
  stateMachine.update();

  hud.updateMonitor(dt, ctx.engine, ctx.entities.entities);
  ui.update(dt);
  // 모달(찬장/설정 패널)이 열려 있는 동안은 조이스틱·버튼이 화면 위 DOM 버튼과 겹치지 않게 숨긴다
  touchControls?.setVisible(!ui.isModalOpen());

  renderer.render(scene, camera);
  const moving = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => input.isDown(k)) || Math.hypot(input.moveAxis.x, input.moveAxis.y) > 0.15;
  heldView.render(renderer, dt, moving);
  input.endFrame();
}
renderer.setAnimationLoop(frame);
ui.ready();

// 콘솔 디버깅용: lab.entities.entities, lab.engine.lastReport, lab.registry …
window.lab = Object.assign(ctx, { renderer });

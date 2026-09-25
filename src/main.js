/**
 * ============================================================================
 *  main.js — 조립(composition root)과 메인 루프
 * ============================================================================
 *
 *  ctx (모든 시스템이 공유하는 컨텍스트)
 *    scene, camera, physics(PhysicsWorld), entities(EntityManager),
 *    beamTracer, staticBlockers, blackboard, engine, ui
 *
 *  한 프레임의 순서
 *    1. physics.update  : 고정 dt 스텝 반복 [플레이어 이동 → 도구 'pre' → Rapier step
 *                         → 충돌 이벤트 수집 → 도구 'post']
 *    2. 카메라를 캐릭터 눈높이에 맞춤
 *    3. entities.update : 도구 시각 갱신 (레이저 빔 추적 등)
 *    4. engine.update   : 상호작용 엔진 (broad → narrow)
 *    5. stateMachine    : 조준 레이캐스트 + idle/aiming/holding/placing
 *    6. 렌더 (메인 씬 → 깊이 클리어 → 손에 든 도구)
 */
import * as THREE from 'three';
import RAPIER from 'rapier';

import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { BeamTracer } from './physics/BeamTracer.js';
import { EntityManager } from './core/EntityManager.js';
import { ToolRegistry } from './core/ToolRegistry.js';
import { InteractionRegistry } from './interaction/InteractionRegistry.js';
import { ProximityChecker } from './interaction/ProximityChecker.js';
import { InteractionEngine } from './interaction/InteractionEngine.js';
import { registerDefaultStrategies } from './interaction/proximityStrategies.js';
import { registerRules } from './interaction/rules.js';
import { buildLabScene, TABLE } from './scene/LabScene.js';
import { InputManager } from './player/InputManager.js';
import { PlayerController } from './player/PlayerController.js';
import { Targeting } from './player/Targeting.js';
import { InteractionStateMachine } from './player/InteractionStateMachine.js';
import { HUD } from './ui/HUD.js';
import { HeldView } from './ui/HeldView.js';
import { UIManager } from './ui/UIManager.js';
import './tools/index.js';

await RAPIER.init();

// ── 렌더러 / 카메라 ─────────────────────────────────────────
const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 100);
scene.add(camera);

// ── 컨텍스트 조립 ───────────────────────────────────────────
const ctx = { THREE, scene, camera, registry: InteractionRegistry, tools: ToolRegistry };
ctx.physics = new PhysicsWorld();
ctx.entities = new EntityManager(ctx);
ctx.beamTracer = new BeamTracer(ctx);
Object.assign(ctx, buildLabScene(ctx)); // staticBlockers, blackboard

const checker = new ProximityChecker();
registerDefaultStrategies(checker, ctx);
registerRules();
ctx.engine = new InteractionEngine({ checker, registry: InteractionRegistry, ctx });

const player = new PlayerController(ctx, camera, document.body, new THREE.Vector3(0, 0, 2.5));
camera.lookAt(0, 1.0, TABLE.z);
const ui = (ctx.ui = new UIManager(ctx, player.controls));
const input = new InputManager(() => player.controls.isLocked && !ui.isModalOpen());
player.controls.addEventListener('unlock', () => input.clear());
const hud = new HUD(ctx);
const heldView = new HeldView(camera);
const stateMachine = new InteractionStateMachine(ctx, {
  input, targeting: new Targeting(ctx, camera), player, hud, ui, heldView,
});
Object.assign(ctx, { player, input, stateMachine });

// ── ?demo : 성공 기준 확인용 — 도르래와, 그 기둥을 겨냥한 레이저를 미리 배치 ──
if (new URLSearchParams(location.search).has('demo')) {
  const Y = TABLE.height;
  ctx.entities.spawn(ToolRegistry.get('pulley'), new THREE.Vector3(-0.6, Y, TABLE.z), new THREE.Quaternion());
  ctx.entities.spawn(
    ToolRegistry.get('laser'),
    new THREE.Vector3(0.7, Y, TABLE.z - 0.05),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2), // +Z → −X
  );
}

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
  ctx.beamTracer.beginFrame();

  ctx.physics.update(
    dt,
    (h) => {
      player.fixedUpdate(h, input);
      ctx.entities.fixedUpdate(h, 'pre');
    },
    (h) => ctx.entities.fixedUpdate(h, 'post'),
  );
  player.syncCamera();

  ctx.entities.update(dt);
  ctx.engine.update(ctx.entities.entities);
  stateMachine.update();

  hud.updateMonitor(dt, ctx.engine, ctx.entities.entities);
  ui.update(dt);

  renderer.render(scene, camera);
  heldView.render(renderer, dt);
  input.endFrame();
}
renderer.setAnimationLoop(frame);
ui.ready();

// 콘솔 디버깅용: lab.entities.entities, lab.engine.lastReport, lab.registry …
window.lab = ctx;

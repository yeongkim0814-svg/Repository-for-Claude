/**
 * ============================================================================
 *  PlayerController — 1인칭 이동 (마인크래프트 스타일)
 * ============================================================================
 *
 *  시점 : PointerLockControls가 마우스 이동량으로 카메라 yaw/pitch를 돌린다.
 *  이동 : 매 물리 스텝마다 WASD를 폴링 →
 *           forward = 카메라 시선의 XZ 투영(정규화), right = forward × up
 *           wish    = (W−S)·forward + (D−A)·right   (정규화 후 × 속력)
 *         수직 속도 vy는 직접 적분: vy ← vy + g·dt (접지 시 Space → vy = v_jump)
 *         점프 속도: 최고점 높이 h = v²/2g → v = √(2gh). h = 1.0 m → v ≈ 4.43 m/s
 *  충돌 : Rapier KinematicCharacterController가 "원하는 이동량"을 받아 벽·테이블에
 *         막히는 성분을 제거한 "실제 이동량"을 계산한다(미끄러짐, 계단 오르기 포함).
 *         캐릭터 몸체는 캡슐 콜라이더를 가진 kinematicPositionBased 바디.
 *
 *         캡슐: 반높이 0.55 + 반지름 0.3 → 전체 키 1.7 m, 눈높이 = 발 + 1.6 m
 */
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const HALF_HEIGHT = 0.55;
const RADIUS = 0.3;
const EYE_OFFSET = 0.75; // 캡슐 중심(발+0.85) 기준 눈 위치
const WALK_SPEED = 3.2;  // m/s
const RUN_SPEED = 5.5;
const JUMP_SPEED = Math.sqrt(2 * 9.81 * 1.0);
const GRAVITY = -9.81;

export class PlayerController {
  constructor(ctx, camera, domElement, spawn = new THREE.Vector3(0, 0, 3)) {
    this.ctx = ctx;
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.controls.pointerSpeed = 0.8;

    // 크롬은 pointer lock 직후 movementX/Y가 수백 px인 가짜 mousemove를 보내는 경우가 있어
    // 패널을 닫을 때 시점이 튄다. 잠금 직후 짧은 시간과 비정상적으로 큰 이동량을 걸러낸다.
    // (capture 단계의 window 리스너가 PointerLockControls의 document 리스너보다 먼저 실행됨)
    let lockedAt = 0;
    this.controls.addEventListener('lock', () => (lockedAt = performance.now()));
    addEventListener('mousemove', (e) => {
      if (!this.controls.isLocked) return;
      const spike = Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300;
      if (spike || performance.now() - lockedAt < 100) e.stopImmediatePropagation();
    }, true);

    const { RAPIER, world } = ctx.physics;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + HALF_HEIGHT + RADIUS, spawn.z),
    );
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), this.body);

    this.cc = world.createCharacterController(0.02);
    this.cc.setUp({ x: 0, y: 1, z: 0 });
    this.cc.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    this.cc.enableAutostep(0.25, 0.2, false);
    this.cc.enableSnapToGround(0.3);
    this.cc.setApplyImpulsesToDynamicBodies(false);

    this.vy = 0;
    this.grounded = false;
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this.syncCamera();
  }

  /** 물리 스텝 직전 호출 (고정 dt) */
  fixedUpdate(dt, input) {
    const { RAPIER } = this.ctx.physics;

    // 1) 시선 기준 수평 이동 방향
    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    this._fwd.normalize();
    this._right.crossVectors(this._fwd, this.camera.up).normalize();

    const f = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const r = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    this._wish.set(0, 0, 0).addScaledVector(this._fwd, f).addScaledVector(this._right, r);
    if (this._wish.lengthSq() > 0) this._wish.normalize().multiplyScalar(input.isDown('ShiftLeft') ? RUN_SPEED : WALK_SPEED);

    // 2) 수직 속도 적분 (반암시적 오일러)
    if (this.grounded && input.isDown('Space')) this.vy = JUMP_SPEED;
    this.vy += GRAVITY * dt;

    // 3) 캐릭터 컨트롤러로 충돌 보정
    const desired = { x: this._wish.x * dt, y: this.vy * dt, z: this._wish.z * dt };
    this.cc.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const m = this.cc.computedMovement();
    this.grounded = this.cc.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = 0;
    if (this.vy > 0 && m.y < desired.y * 0.5) this.vy = 0; // 천장에 머리 부딪힘

    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
  }

  syncCamera() {
    const p = this.body.translation();
    this.camera.position.set(p.x, p.y + EYE_OFFSET, p.z);
  }

  /** 카메라가 수평으로 바라보는 yaw (라디안, +Z 기준) */
  get yaw() {
    this.camera.getWorldDirection(this._fwd);
    return Math.atan2(this._fwd.x, this._fwd.z);
  }
}

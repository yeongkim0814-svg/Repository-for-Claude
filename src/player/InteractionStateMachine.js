/**
 * ============================================================================
 *  InteractionStateMachine — 도구 획득·배치 상태 머신 (1인칭 레이캐스트 기반)
 * ============================================================================
 *
 *            조준 대상이 상호작용 가능              표면(테이블/바닥)을 조준
 *   ┌──────┐ ─────────────────────▶ ┌────────┐      ┌─────────┐ ──────────▶ ┌─────────┐
 *   │ idle │                        │ aiming │      │ holding │             │ placing │
 *   └──────┘ ◀───────────────────── └────────┘      └─────────┘ ◀────────── └─────────┘
 *      ▲        대상에서 시선이 벗어남    │  │  ▲         ▲   │      표면에서 벗어남    │
 *      │                                 │  │  │         │   │ X: 반납                │
 *      │        E(찬장) → 찬장 UI → 도구 선택┘  │         │   ▼                        │
 *      │        F(도구) → 집기 ────────────────┴─────────┘  idle                      │
 *      │        E(도구) → 설정 패널 (모달)                                            │
 *      └──────────────────── E / 좌클릭 (배치 가능할 때) → 배치 확정 ─────────────────┘
 *
 *  - 상태별 동작은 `handlers` 테이블에 모여 있다. 새 상태(예: 'wiring' — 전자기 Phase의
 *    도선 연결)를 추가하려면 State에 이름을 넣고 handlers에 함수를 추가하면 된다.
 *  - 모달 UI(찬장/설정 패널)가 열려 있는 동안은 상태 머신이 입력을 처리하지 않는다
 *    (pointer lock 해제 → InputManager가 입력을 받지 않음 + update 조기 반환).
 *  - placing 단계에서 Q/R로 yaw를 15°씩 회전. 도구의 로컬 +Z가 "정면"이므로 레이저는
 *    고스트 위 흰 화살표 방향으로 빔을 쏜다.
 */
import * as THREE from 'three';
import { Placement } from './Placement.js';

export const State = Object.freeze({
  IDLE: 'idle',
  AIMING: 'aiming',
  HOLDING: 'holding',
  PLACING: 'placing',
});

const REACH = 3.5;       // 도구/찬장과 상호작용 가능한 거리 (m)
const PLACE_REACH = 5.0; // 배치 가능한 거리 (m)
const ROT_STEP = Math.PI / 12; // 15°

export class InteractionStateMachine {
  constructor(ctx, { input, targeting, player, hud, ui, heldView }) {
    this.ctx = ctx;
    this.input = input;
    this.targeting = targeting;
    this.player = player;
    this.hud = hud;
    this.ui = ui;
    this.heldView = heldView;
    this.placement = new Placement(ctx);

    this.state = State.IDLE;
    /** 손에 든 도구: { def, properties } */
    this.held = null;
    this.yaw = 0;
    this.lastCheck = { ok: false, reason: '' };

    /** 상태 → 매 프레임 핸들러 */
    this.handlers = {
      [State.IDLE]: (t) => this.#idle(t),
      [State.AIMING]: (t) => this.#aiming(t),
      [State.HOLDING]: (t) => this.#holding(t),
      [State.PLACING]: (t) => this.#placing(t),
    };
  }

  transition(next) {
    if (next === this.state) return;
    // exit
    if (this.state === State.PLACING) this.placement.setGhostVisible(false);
    this.state = next;
    // enter
    if (next === State.IDLE || next === State.AIMING) {
      if (this.held) this.#dropHeld();
    }
  }

  update() {
    if (this.ui.isModalOpen()) return;
    const t = this.targeting.update();
    this.handlers[this.state](t);
    this.hud.setState(this.state, this.held?.def.label);
  }

  // ─── 판정 헬퍼 ──────────────────────────────────────────────
  #isInteractive(t) {
    return t && (t.kind === 'cabinet' || t.kind === 'entity') && t.distance <= REACH;
  }

  #isPlaceable(t) {
    return t && t.kind === 'surface' && t.normal.y > 0.9 && t.distance <= PLACE_REACH;
  }

  // ─── 상태 핸들러 ────────────────────────────────────────────
  #idle(t) {
    this.hud.setTarget(null);
    if (this.#isInteractive(t)) return this.transition(State.AIMING);
    this.hud.setCrosshair('');
    this.hud.setTooltip('');
  }

  #aiming(t) {
    if (!this.#isInteractive(t)) {
      this.transition(State.IDLE);
      return this.#idle(t);
    }
    this.hud.setTarget(t.root);
    this.hud.setCrosshair('active');

    if (t.kind === 'cabinet') {
      this.hud.setTooltip('실험 도구 찬장\nE: 열기');
      if (this.input.consume('KeyE')) {
        this.ui.openCabinet((def) => this.beginHolding(def, def.defaultProperties));
      }
      return;
    }

    const e = t.entity;
    this.hud.setTooltip(`${e.def.icon} ${e.def.label}  [${e.physicsDomain.join(', ')}]\nE: 설정 · F: 집기 · Del: 제거`);
    if (this.input.consume('KeyE')) {
      this.ui.openProperties(e);
    } else if (this.input.consume('KeyF')) {
      const props = structuredClone(e.properties);
      this.#removeEntity(e);
      this.beginHolding(e.def, props);
    } else if (this.input.consume('Delete') || this.input.consume('Backspace')) {
      this.#removeEntity(e);
      this.transition(State.IDLE);
    }
  }

  #holding(t) {
    this.hud.setTarget(null);
    if (this.#isPlaceable(t)) {
      this.transition(State.PLACING);
      return this.#placing(t);
    }
    this.hud.setCrosshair('');
    this.hud.setTooltip(`${this.held.def.label}을(를) 들고 있음\n테이블/바닥을 조준하세요 · X: 찬장에 반납`);
    if (this.input.consume('KeyX')) this.transition(State.IDLE);
  }

  #placing(t) {
    this.hud.setTarget(null);
    if (!this.#isPlaceable(t)) {
      this.transition(State.HOLDING);
      return this.#holding(t);
    }
    if (this.input.consume('KeyQ')) this.yaw += ROT_STEP;
    if (this.input.consume('KeyR')) this.yaw -= ROT_STEP;
    if (this.input.consume('KeyX')) return this.transition(State.IDLE);

    const { def, properties } = this.held;
    const { position, quaternion } = this.placement.pose(t.point, this.yaw);
    const check = (this.lastCheck = this.placement.check(def, properties, position, quaternion));
    this.placement.updateGhost(position, quaternion, check.ok);

    const deg = Math.round(THREE.MathUtils.radToDeg(this.yaw)) % 360;
    this.hud.setCrosshair(check.ok ? 'valid' : 'invalid');
    this.hud.setTooltip(
      check.ok
        ? `E / 좌클릭: 배치 · Q/R: 회전 (${(deg + 360) % 360}°) · X: 반납`
        : `배치 불가: ${check.reason}\nQ/R: 회전 · X: 반납`,
    );

    const confirm = this.input.consume('KeyE') | this.input.consume('Mouse0');
    if (confirm && check.ok) {
      this.ctx.entities.spawn(def, position, quaternion, properties);
      this.held = null; // 배치 완료: 반납이 아니라 소비
      this.placement.hideGhost();
      this.heldView.clear();
      this.transition(State.IDLE);
    }
  }

  // ─── 동작 ──────────────────────────────────────────────────
  /** 찬장에서 선택하거나 F로 집었을 때 */
  beginHolding(def, properties) {
    this.held = { def, properties: structuredClone(properties) };
    // 초기 방향: 도구 정면(+Z)이 플레이어 시선과 같은 쪽을 향하도록, 15° 단위로 스냅
    this.yaw = Math.round(this.player.yaw / ROT_STEP) * ROT_STEP;
    this.placement.showGhost(def, properties);
    this.placement.setGhostVisible(false);
    this.heldView.show(def, properties);
    this.state = State.HOLDING;
  }

  #dropHeld() {
    this.held = null;
    this.placement.hideGhost();
    this.heldView.clear();
  }

  #removeEntity(e) {
    this.ctx.engine.forget(e);
    this.ctx.entities.remove(e);
    this.hud.setTarget(null);
  }
}

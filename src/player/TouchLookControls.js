/**
 * ============================================================================
 *  TouchLookControls — PointerLockControls를 대신하는 터치용 시점 컨트롤
 * ============================================================================
 *
 *  태블릿·폰에는 포인터 락이 없다(iOS Safari는 아예 지원하지 않고, 안드로이드도
 *  손가락으로는 "마우스 이동량"이라는 개념 자체가 없다). 그래서 화면을 드래그한
 *  거리만큼 카메라 yaw/pitch를 직접 돌리는 방식으로 같은 결과를 낸다.
 *
 *  PointerLockControls와 똑같은 최소 인터페이스(isLocked, lock(), unlock(),
 *  addEventListener('lock'|'unlock', …), pointerSpeed)를 흉내 내서, PlayerController·
 *  UIManager·main.js 어디도 "지금 데스크톱인지 터치인지" 몰라도 되게 한다 — 둘 다
 *  `player.controls.isLocked` 같은 같은 코드로 다룰 수 있다.
 *
 *  조이스틱·버튼(TouchControls.js) 위에서 시작된 드래그는 시점 회전에서 제외해야
 *  하므로, 그 요소들에 data-touch-ui 속성을 붙여 두면 이 컨트롤이 알아서 건너뛴다.
 *  (한 손가락은 조이스틱, 다른 손가락은 시점 드래그 — 서로 다른 pointerId라 동시에 된다)
 */
import * as THREE from 'three';

const PITCH_LIMIT = Math.PI / 2 - 1e-3;

export class TouchLookControls extends THREE.EventDispatcher {
  constructor(camera, domElement) {
    super();
    this.camera = camera;
    this.domElement = domElement;
    this.isLocked = false;
    this.pointerSpeed = 1.0;

    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._pointerId = null;
    this._lastX = 0;
    this._lastY = 0;

    this._onDown = (e) => {
      if (!this.isLocked || this._pointerId !== null) return;
      if (e.target.closest?.('[data-touch-ui]')) return; // 조이스틱/버튼은 시점 회전 제외
      this._pointerId = e.pointerId;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onMove = (e) => {
      if (e.pointerId !== this._pointerId) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;

      this._euler.setFromQuaternion(this.camera.quaternion);
      this._euler.y -= dx * 0.0034 * this.pointerSpeed;
      this._euler.x -= dy * 0.0034 * this.pointerSpeed;
      this._euler.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this._euler.x));
      this.camera.quaternion.setFromEuler(this._euler);
      this.dispatchEvent({ type: 'change' });
    };
    this._onUp = (e) => {
      if (e.pointerId === this._pointerId) this._pointerId = null;
    };

    domElement.addEventListener('pointerdown', this._onDown);
    domElement.addEventListener('pointermove', this._onMove);
    domElement.addEventListener('pointerup', this._onUp);
    domElement.addEventListener('pointercancel', this._onUp);
  }

  lock() {
    if (this.isLocked) return;
    this.isLocked = true;
    this.dispatchEvent({ type: 'lock' });
  }

  unlock() {
    if (!this.isLocked) return;
    this.isLocked = false;
    this._pointerId = null;
    this.dispatchEvent({ type: 'unlock' });
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this._onDown);
    this.domElement.removeEventListener('pointermove', this._onMove);
    this.domElement.removeEventListener('pointerup', this._onUp);
    this.domElement.removeEventListener('pointercancel', this._onUp);
  }
}

/**
 * ============================================================================
 *  TouchControls — 태블릿/폰용 온스크린 조이스틱 + 버튼
 * ============================================================================
 *
 *  키보드 대신 화면 버튼이 정확히 같은 키 코드를 누르고/떼게 만든다
 *  (InputManager.press/release = keydown/keyup 흉내) — 그래서 PlayerController나
 *  InteractionStateMachine은 입력이 키보드에서 왔는지 손가락에서 왔는지 전혀 모른다.
 *
 *   좌하단 조이스틱      → input.setMoveAxis(x, y)  (WASD의 아날로그 버전)
 *   우하단 버튼 묶음     → Space/E/F/Q/R/X/Del/KeyZ 를 누르고 뗌
 *   "5°" 토글           → TouchFine (가상 키. Shift는 달리기와 겹쳐서 따로 둠)
 *   시점 회전은 화면 아무 데나 드래그 (TouchLookControls, 이 버튼들 위에서는 제외)
 *
 *  버튼/조이스틱 요소에는 data-touch-ui를 달아 TouchLookControls가 시점 드래그로
 *  오인하지 않게 한다.
 */

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

const BTN = (label, sub) => {
  const b = document.createElement('button');
  b.className = 'tbtn';
  b.dataset.touchUi = '1';
  b.innerHTML = `<span class="tbtn-label">${label}</span>${sub ? `<span class="tbtn-sub">${sub}</span>` : ''}`;
  return b;
};

export class TouchControls {
  constructor(ctx, { input, heldView }) {
    this.input = input;
    this.heldView = heldView;
    this.root = document.createElement('div');
    this.root.id = 'touch-hud';
    this.#buildJoystick();
    this.#buildButtons();
    document.body.appendChild(this.root);
  }

  setVisible(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  // ── 이동 조이스틱 ───────────────────────────────────────────
  #buildJoystick() {
    const base = document.createElement('div');
    base.id = 'joy-base';
    base.dataset.touchUi = '1';
    const knob = document.createElement('div');
    knob.id = 'joy-knob';
    base.appendChild(knob);
    this.root.appendChild(base);

    const R = 42; // 넉이 움직일 수 있는 반지름(px)
    let pointerId = null;
    let cx = 0, cy = 0;

    const move = (clientX, clientY) => {
      let dx = clientX - cx, dy = clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(len, R);
      dx = (dx / len) * clamped;
      dy = (dy / len) * clamped;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // 화면 아래(+y)가 "뒤로" → forward는 -dy. 데드존 8%로 미세한 흔들림 무시.
      const nx = dx / R, ny = -dy / R;
      const mag = Math.hypot(nx, ny);
      const k = mag < 0.08 ? 0 : Math.min(1, mag);
      this.input.setMoveAxis((nx / (mag || 1)) * k, (ny / (mag || 1)) * k);
    };
    const reset = () => {
      pointerId = null;
      knob.style.transform = 'translate(0, 0)';
      this.input.setMoveAxis(0, 0);
    };

    base.addEventListener('pointerdown', (e) => {
      if (pointerId !== null) return;
      pointerId = e.pointerId;
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      base.setPointerCapture(pointerId);
      move(e.clientX, e.clientY);
      e.preventDefault();
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      move(e.clientX, e.clientY);
      e.preventDefault();
    });
    base.addEventListener('pointerup', (e) => { if (e.pointerId === pointerId) reset(); });
    base.addEventListener('pointercancel', (e) => { if (e.pointerId === pointerId) reset(); });
  }

  // ── 동작 버튼 ───────────────────────────────────────────────
  #buildButtons() {
    const wrap = document.createElement('div');
    wrap.id = 'touch-buttons';

    // 누르고 있는 동안만 눌린 상태(hold): 점프, 확대
    const hold = (label, code, extra) => {
      const b = BTN(label, extra);
      const down = (e) => { this.input.press(code); b.classList.add('active'); e.preventDefault(); };
      const up = () => { this.input.release(code); b.classList.remove('active'); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      return b;
    };
    // 한 번 탭 = 짧게 눌렀다 뗌 (E, F, Q, R, X, Del 처럼 consume()으로 읽는 액션)
    const tap = (label, code, extra, onTap) => {
      const b = BTN(label, extra);
      b.addEventListener('pointerdown', (e) => {
        this.input.press(code);
        onTap?.();
        b.classList.add('active');
        e.preventDefault();
        setTimeout(() => this.input.release(code), 80);
      });
      b.addEventListener('pointerup', () => b.classList.remove('active'));
      return b;
    };
    // 누를 때마다 켜짐/꺼짐이 뒤집히는 토글 (5° 미세 회전)
    const toggle = (label, code, extra) => {
      const b = BTN(label, extra);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const on = this.input.isDown(code);
        if (on) this.input.release(code);
        else this.input.press(code);
        b.classList.toggle('active', !on);
      });
      return b;
    };

    const pulse = () => this.heldView.pulse();

    const grid = document.createElement('div');
    grid.className = 'tbtn-grid';
    grid.append(
      tap('E', 'KeyE', '상호작용', pulse),
      tap('F', 'KeyF', '집기', pulse),
      hold('🔍', 'KeyZ', '확대'),
      hold('⤴', 'Space', '점프'),
      tap('Q', 'KeyQ', '회전←'),
      tap('R', 'KeyR', '회전→'),
      toggle('5°', 'TouchFine', '미세'),
      tap('X', 'KeyX', '반납'),
      tap('␡', 'Delete', '제거'),
    );
    wrap.appendChild(grid);
    this.root.appendChild(wrap);
  }
}

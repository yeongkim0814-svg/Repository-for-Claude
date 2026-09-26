import { joystickInput, type Vec2 } from './controlMath';

/**
 * 멀티터치 입력. 화면 왼쪽 절반에서 시작한 터치 = 조이스틱(이동),
 * 오른쪽 절반에서 시작한 터치 = 드래그(시점). pointerId 로 각각 추적하므로
 * 두 손가락 동시 조작이 가능하다.
 */
export class TouchControls {
  /** 현재 조이스틱 입력 ([-1,1]). */
  move: Vec2 = { x: 0, y: 0 };

  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private lookAccum = { x: 0, y: 0 };

  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  constructor(
    private readonly surface: HTMLElement,
    private readonly radiusPx: number,
  ) {
    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.appendChild(this.knob);
    document.body.appendChild(this.base);
    this.base.style.width = this.base.style.height = `${radiusPx * 2}px`;

    surface.addEventListener('pointerdown', this.onDown);
    surface.addEventListener('pointermove', this.onMove);
    surface.addEventListener('pointerup', this.onUp);
    surface.addEventListener('pointercancel', this.onUp);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** 마지막 호출 이후 누적된 시점 드래그(px)를 꺼내고 0 으로 되돌린다. */
  consumeLook(): Vec2 {
    const d = { ...this.lookAccum };
    this.lookAccum = { x: 0, y: 0 };
    return d;
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.surface.setPointerCapture(e.pointerId);
    const leftHalf = e.clientX < window.innerWidth / 2;
    if (leftHalf && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('active');
      this.setKnob(0, 0);
    } else if (!leftHalf && this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      const dx = e.clientX - this.joyOrigin.x;
      const dy = e.clientY - this.joyOrigin.y;
      this.move = joystickInput(dx, dy, this.radiusPx);
      this.setKnob(this.move.x * this.radiusPx, -this.move.y * this.radiusPx);
    } else if (e.pointerId === this.lookId) {
      this.lookAccum.x += e.clientX - this.lookLast.x;
      this.lookAccum.y += e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.move = { x: 0, y: 0 };
      this.base.classList.remove('active');
    } else if (e.pointerId === this.lookId) {
      this.lookId = null;
    }
  };

  private setKnob(xPx: number, yPx: number): void {
    this.knob.style.transform = `translate(calc(-50% + ${xPx}px), calc(-50% + ${yPx}px))`;
  }
}

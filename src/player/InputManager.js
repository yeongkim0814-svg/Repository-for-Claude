/**
 * 키보드/마우스 상태 폴링.
 *  - isDown(code)  : 누르고 있는 동안 true (WASD 이동처럼 매 프레임 폴링)
 *  - consume(code) : 이번 프레임에 새로 눌렸으면 true를 한 번만 반환 (E, Q, R 같은 액션)
 *  포인터가 잠겨 있을 때(=게임 조작 중)만 입력을 받는다. UI 패널이 열려 있는 동안의
 *  키 입력이 게임 액션으로 새어 들어가지 않게 하기 위함.
 */
export class InputManager {
  constructor(isActive) {
    this.isActive = isActive;
    this.down = new Set();
    this.pressed = new Set();

    addEventListener('keydown', (e) => {
      if (!this.isActive()) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('mousedown', (e) => {
      if (this.isActive()) this.pressed.add(`Mouse${e.button}`);
    });
    addEventListener('blur', () => this.clear());
  }

  isDown(code) {
    return this.down.has(code);
  }

  consume(code) {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }

  endFrame() {
    this.pressed.clear();
  }

  clear() {
    this.down.clear();
    this.pressed.clear();
  }
}

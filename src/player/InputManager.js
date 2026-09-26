/**
 * 키보드/마우스/터치 버튼 상태 폴링.
 *  - isDown(code)  : 누르고 있는 동안 true (WASD 이동처럼 매 프레임 폴링)
 *  - consume(code) : 이번 프레임에 새로 눌렸으면 true를 한 번만 반환 (E, Q, R 같은 액션)
 *  포인터가 잠겨 있을 때(=게임 조작 중)만 입력을 받는다. UI 패널이 열려 있는 동안의
 *  키 입력이 게임 액션으로 새어 들어가지 않게 하기 위함.
 *
 *  press(code)/release(code) : 화면 터치 버튼이 실제 키보드 keydown/keyup과 똑같이 동작하도록
 *  흉내 낸다 (TouchControls.js가 사용). release는 keyup처럼 isActive 여부와 무관하게 항상
 *  허용한다 — 손가락을 뗐는데 모달이 열려서 상태가 안 풀리는 "눌린 채로 고정" 버그를 막는다.
 *
 *  moveAxis : 조이스틱 같은 아날로그 이동 입력 (x=오른쪽, y=앞, 각각 -1..1).
 *  WASD 디지털 입력과 합쳐서 쓴다 (PlayerController.fixedUpdate).
 */
export class InputManager {
  constructor(isActive) {
    this.isActive = isActive;
    this.down = new Set();
    this.pressed = new Set();
    this.moveAxis = { x: 0, y: 0 };

    addEventListener('keydown', (e) => {
      if (!this.isActive()) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('mousedown', (e) => {
      if (!this.isActive()) return;
      this.pressed.add(`Mouse${e.button}`);
      this.down.add(`Mouse${e.button}`);
    });
    addEventListener('mouseup', (e) => this.down.delete(`Mouse${e.button}`));
    addEventListener('contextmenu', (e) => this.isActive() && e.preventDefault());
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

  /** 터치 버튼용 keydown 흉내 */
  press(code) {
    if (!this.isActive()) return;
    this.pressed.add(code);
    this.down.add(code);
  }

  /** 터치 버튼용 keyup 흉내 (isActive 상관없이 항상 풀어줌) */
  release(code) {
    this.down.delete(code);
  }

  setMoveAxis(x, y) {
    this.moveAxis.x = x;
    this.moveAxis.y = y;
  }

  endFrame() {
    this.pressed.clear();
  }

  clear() {
    this.down.clear();
    this.pressed.clear();
    this.moveAxis.x = 0;
    this.moveAxis.y = 0;
  }
}

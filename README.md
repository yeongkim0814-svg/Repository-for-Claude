# 가상 물리 실험실 — Phase 0 (3D 아키텍처 + 상호작용 엔진)

1인칭(마인크래프트 스타일)으로 돌아다니며 찬장에서 실험 도구를 꺼내 테이블에 놓고,
도구끼리 **등록된 물리 법칙에 따라서만** 상호작용하는 3D 실험실입니다.
Phase 0에서는 이후 역학·광학·전자기·열역학 도구를 얹을 **뼈대**를 만들었습니다.

- 렌더링: Three.js r186 · 물리: Rapier 0.20 (`@dimforge/rapier3d-compat`, WASM 내장)
- 빌드 도구 없음. 라이브러리는 `vendor/`에 들어 있어 **오프라인에서도 실행**됩니다.

## 실행 방법

ES 모듈과 WASM은 `file://`로 열면 브라우저 보안 정책(CORS) 때문에 로드되지 않습니다.
**로컬 정적 서버**를 하나 띄우세요 (아래 중 아무거나).

```bash
cd Repository-for-Claude
python3 -m http.server 8000        # 또는: npm start
# Node만 있다면: npx http-server -p 8000 -c-1 .
```

브라우저에서 <http://localhost:8000> 을 여세요.
**<http://localhost:8000/?demo>** 로 열면 도르래와 (그 기둥을 겨냥한) 레이저가 미리 놓여 있어
Phase 0 성공 기준을 바로 확인할 수 있습니다.

단위 테스트 (Node 18 이상, 브라우저 불필요): `npm test`

## 조작

| 키 | 동작 |
|---|---|
| 마우스 | 시점 회전 (화면 클릭 → 마우스 잠금, Esc → 해제) |
| W A S D / Shift | 이동 / 달리기 |
| Space | 점프 |
| E | 찬장 열기 · 도구 설정 패널 열기/닫기 · (배치 미리보기 중) 배치 확정 |
| 좌클릭 | (배치 미리보기 중) 배치 확정 |
| Q / R | 배치 미리보기 회전 (15°씩). 흰 화살표 = 도구의 정면(+Z), 레이저 빔 방향 |
| F | 조준한 도구 다시 집기 |
| X | 들고 있는 도구 반납 |
| Delete | 조준한 도구 제거 |

도르래 사용법: 도르래를 조준 → **E** → `놓기` 체크 → 추가 움직입니다. 패널 아래쪽에서
Rapier가 계산한 가속도와 앳우드 공식 이론값을 실시간으로 비교할 수 있습니다.

## 폴더 구조

```
index.html, style.css
src/
  main.js                       조립 + 메인 루프 (한 프레임의 순서가 주석에 정리됨)
  core/
    Entity.js                   엔티티 = 6개 컴포넌트 (physicsDomain, transform, properties,
                                 interactionPorts, mesh, collider)
    ToolRegistry.js             도구 "종류" 정의 카탈로그 (ToolDefinition 인터페이스 문서)
    EntityManager.js            생성/제거/재생성, 근접 센서 자동 부착
  physics/
    PhysicsWorld.js             Rapier 월드, 고정 dt, 충돌 이벤트 → 접촉 중인 엔티티 쌍
    BeamTracer.js               광학 broad phase: Three.js Raycaster 빔 추적 (프레임 캐시)
  interaction/
    InteractionRegistry.js      ★ narrow phase 규칙 테이블 (확장 방법 상세 주석)
    ProximityChecker.js         ★ broad phase: checkProximity(a, b) 도메인 조합별 분기
    proximityStrategies.js      역학=Rapier 이벤트, 광학=빔 경로 전략 등록
    InteractionEngine.js        broad → narrow → enter/update/exit 파이프라인
    rules.js                    도구 쌍 규칙을 등록하는 곳 (Phase 0: 비어 있음)
  player/
    PlayerController.js         PointerLockControls + KinematicCharacterController(캡슐)
    InputManager.js             키 상태 폴링 (isDown / consume)
    Targeting.js                화면 중앙 레이캐스트
    InteractionStateMachine.js  ★ idle → aiming → holding → placing 상태 머신
    Placement.js                고스트 미리보기 + 배치 가능 판정 (겹침/지지)
  scene/  LabScene.js, Blackboard.js (CanvasTexture 훅)
  tools/  Pulley.js, Laser.js, index.js
  ui/     HUD.js (상호작용 모니터 포함), HeldView.js, UIManager.js (범용 설정 패널)
tests/interaction.test.mjs      레지스트리·엔진 단위 테스트
vendor/                         three, PointerLockControls, rapier (라이선스 동봉)
```

## 핵심 아키텍처

### 1. 상호작용 = 2단계 파이프라인

```
모든 엔티티 쌍 (a, b)
 ├─ 1) Broad phase  checkProximity(a, b)
 │     a.physicsDomain × b.physicsDomain 조합으로 전략 선택
 │       mechanical × mechanical → Rapier 센서/충돌 이벤트
 │       optical    × *          → 빔 광선이 상대에 닿는가 (Raycaster)
 │     전략 없음 / 판정 실패 → 다음 쌍
 └─ 2) Narrow phase InteractionRegistry.match(a, b)  →  규칙 배열
       for (rule of 규칙배열) rule.onEnter / onUpdate / onExit
```

**"상호작용 없음"은 코드가 아니라 테이블에 행이 없는 상태입니다.** `match()`는 미등록 조합에 대해
빈 배열을 돌려주고, 엔진은 그것을 0번 순회할 뿐입니다. 레이저–도르래를 위한 `if`, NullHandler,
플래그는 저장소 어디에도 없습니다.

### 2. Phase 0 성공 기준 확인

`?demo`로 열면 레이저 빔이 도르래 기둥에 닿아 멈추고, 오른쪽 위 **상호작용 엔진 모니터**에 이렇게 표시됩니다.

```
● 도르래#1 ↔ 레이저#2
  broad [mechanical×optical] 빔 경로 교차 (laser→pulley, 1.15 m)
  narrow: 등록된 규칙 0개 → 아무 일도 없음
```

공간적으로는 후보(빔이 실제로 닿음)이지만 규칙이 없으므로 도르래의 상태는 전혀 바뀌지 않습니다.
빔이 기둥에서 멈추는 것은 "빛이 불투명한 물체를 통과하지 못한다"는 레이저 자신의 기하광학이지
도구 간 상호작용이 아닙니다. 도르래 두 개를 나란히 놓으면 `mechanical×mechanical`
(Rapier 근접 센서) 후보가 되지만, 이 역시 규칙이 없어 아무 일도 일어나지 않습니다.
`npm test`의 첫 번째 테스트가 같은 내용을 브라우저 없이 검증합니다.

### 3. 확장 방법 요약

| 추가할 것 | 할 일 |
|---|---|
| 새 도구 | `src/tools/X.js`에 `ToolRegistry.define({...})` + `tools/index.js`에 import 한 줄. 찬장·고스트·설정 패널은 자동으로 처리됨 |
| 도구 쌍의 물리 | `rules.js`에서 `InteractionRegistry.register('laser', 'slit', { onEnter, onUpdate, onExit })` |
| 새 물리 도메인 | `proximityStrategies.js`에서 `checker.register('electromagnetic', '*', 이름, (a, b) => …)` |
| 새 조작 상태 | `InteractionStateMachine`의 `State`와 `handlers`에 한 항목씩 추가 |
| 칠판에 값 표시 | `ctx.blackboard.writeLines([...])` 또는 `ctx.blackboard.draw((g, w, h) => …)` |

## 물리 모델 메모

**도르래(앳우드 기계).** 로프가 늘어나지 않고 미끄러지지 않으면 두 추의 위치는 바퀴 각도 θ 하나로
정해집니다(y = d₀ ± Rθ). 그래서 계를 자유도 1개로 줄여 Rapier의 RevoluteJoint 바퀴 하나로 적분합니다.

- 알짜 토크: τ = (m_L − m_R)·g·R − τ_f
- 유효 관성: I = ½MR² + (m_L + m_R)R²
- 양변을 R로 나누면 → **a = [(m_L − m_R)g − τ_f/R] / (m_L + m_R + M/2)**

기본값(0.25 kg, 0.2 kg, M = 0.2 kg)에서 이론값은 0.869 m/s²이고, Rapier 측정값 Δv/Δt와 일치합니다.
(m_R = 0.1, τ_f = 0.01 N·m일 때 둘 다 2.9922 m/s²)

이 모델이 **틀리는 경우**: 로프의 늘어남과 질량, 추의 진자 흔들림, 속도에 비례하는 공기 저항은
포함하지 않습니다. `M/2` 항은 바퀴를 균일한 원판으로 가정한 결과이므로, 테가 무거운 바퀴라면
이 항이 M에 가까워집니다.

**레이저.** 설정 패널에 E = hc/λ, 초당 광자 수 N = P/E, 진동수 f = c/λ를 표시합니다
(He-Ne 632.8 nm, 5 mW → 1.96 eV, 약 1.6×10¹⁶개/s).

## 다음 Phase(광학 도구 추가)가 이어받을 것

Phase 1은 새 도구 파일(슬릿·거울·렌즈·스크린)을 `ToolRegistry.define`으로 추가하고, 그 물리를
`rules.js`의 `InteractionRegistry.register('laser', 'slit', …)` 같은 규칙으로 등록하는 일만 하면 됩니다.
그대로 쓸 수 있는 것은 네 가지입니다.

- 레이저의 `beam_output` 포트와, 같은 프레임에서 렌더링과 판정이 같은 결과를 쓰도록 캐시하는 `BeamTracer`
- `optical × *` broad phase 전략. 빔이 새 도구에 닿는 순간 자동으로 후보가 되고, `ctx.contact.hit.point`로
  빔–소자 교차점이 전달됩니다.
- 설정 패널. `properties`만 선언하면 슬릿 폭이나 초점거리 슬라이더가 자동으로 생깁니다.
- 칠판 `CanvasTexture` 훅. 측정값과 수식을 그릴 때 씁니다.

새로 설계해야 할 핵심은 빔 경로를 여러 번 잇는 방식입니다. 거울이나 렌즈가 `beam_input`으로 빛을 받아
`beam_output`으로 새 빔을 내보내게 하려면 `BeamTracer`가 반사(d′ = d − 2(d·n)n)와 굴절(스넬 법칙)을
따라 경로를 이어 가야 합니다. 이때 거울 두 개가 마주 보면 무한 루프가 생기므로 최대 반사 횟수를
정해야 합니다. 회절 무늬는 스크린 도구의 `CanvasTexture`에 I(θ) = I₀[sin β/β]²로 그리면 됩니다.

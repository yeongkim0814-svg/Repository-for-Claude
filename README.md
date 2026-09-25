# 가상 물리 실험실 — Phase 1 (광학)

1인칭(마인크래프트 스타일)으로 돌아다니며 찬장에서 실험 도구를 꺼내 테이블에 놓고,
도구끼리 **등록된 물리 법칙에 따라서만** 상호작용하는 3D 실험실입니다.
Phase 0에서는 이후 역학·광학·전자기·열역학 도구를 얹을 **뼈대**를 만들었습니다.

- 렌더링: Three.js r186 · 물리: Rapier 0.20 (`@dimforge/rapier3d-compat`, WASM 내장)
- 빌드 도구 없음. 라이브러리는 `vendor/`에 들어 있어 **오프라인에서도 실행**됩니다.
- 그래픽: Surgeon Simulator 풍 형태(둥근 장난감 같은 도구, 1인칭 장갑 손) + **부드러운 파스텔 톤**
  (VSM 소프트 그림자, Neutral 톤매핑, 옅은 안개). 둥근 폰트 Jua/Fredoka는 온라인일 때 Google Fonts에서 받음
- 저사양 노트북이면 주소 뒤에 `?lowfx` (그림자 끔)

## 실행 방법

ES 모듈과 WASM은 `file://`로 열면 브라우저 보안 정책(CORS) 때문에 로드되지 않습니다.
**로컬 정적 서버**를 하나 띄우세요 (아래 중 아무거나).

```bash
cd Repository-for-Claude
python3 -m http.server 8000        # 또는: npm start
# Node만 있다면: npx http-server -p 8000 -c-1 .
```

브라우저에서 <http://localhost:8000> 을 여세요. 미리 배치된 실험으로 바로 시작하려면:

| 주소 | 실험 |
|---|---|
| `/?demo` | Phase 0 성공 기준: 도르래 + 레이저 (빛이 닿아도 규칙이 없어 아무 일도 없음) |
| `/?demo=slit` | 레이저 → 이중 슬릿 → 스크린. **우클릭/Z로 확대**해서 간섭 무늬와 눈금 보기 |
| `/?demo=mirror` | 레이저 → 슬릿 → 거울(45°) → 스크린. 꺾인 경로에서도 L이 경로 전체로 계산됨 |
| `/?demo=lens` | 광선 상자 → 볼록 렌즈(f = 25 cm) → 스크린: 평행광이 초점에 모임 |
| `/?demo=tir` | 레이저 → 반원 유리 블록: 45° 전반사. 블록 설정의 "방향"을 −15°로 → 30° 굴절 |

단위 테스트 (Node 18 이상, 브라우저 불필요): `npm test`

## 조작

| 키 | 동작 |
|---|---|
| 마우스 | 시점 회전 (화면 클릭 → 마우스 잠금, Esc → 해제) |
| W A S D / Shift | 이동 / 달리기 |
| Space | 점프 |
| E | 찬장 열기 · 도구 설정 패널 열기/닫기 · (배치 미리보기 중) 배치 확정 |
| 좌클릭 | (배치 미리보기 중) 배치 확정 |
| Q / R | 배치 미리보기 회전 (15°씩, Shift와 함께 5°씩). 흰 화살표 = 도구의 정면(+Z) |
| 우클릭 또는 Z (누르고 있기) | 확대 (mm 단위 간섭 무늬·눈금 보기) |
| F | 조준한 도구 다시 집기 |
| X | 들고 있는 도구 반납 |
| Delete | 조준한 도구 제거 |

설정 패널(E)은 모든 도구에 **방향(yaw) 슬라이더**가 있어 1° 단위로 돌릴 수 있습니다(광학 정렬용).
도르래: `놓기` 체크 → 운동 시작, Rapier 가속도와 앳우드 이론값을 실시간 비교.

## Phase 1 광학 도구

| 도구 | 물리 | 주요 설정 | 측정값(설정 패널) |
|---|---|---|---|
| 🔦 레이저 | 결맞는 단색광 | λ, 출력 | E = hc/λ, 초당 광자 수 |
| 🔆 광선 상자 | 나란한 광선 N개, **결맞지 않음** | 광선 수·간격·λ | — |
| 🪞 평면 거울 | d′ = d − 2(d·n)n | 반사율 | 입사각·반사각 |
| 🔍 얇은 렌즈 | t′ = t − h/f (근축) | f(±), 지름 | 굴절력 1/f, 초점 위치 |
| ▥ N-슬릿 | N=1 단일, 2 이중, 큰 N 격자 | N, 폭 a, 간격 d | y₁ = λL/a, Δy = λL/d |
| 🖼 스크린 | 광점 기록 + 회절 무늬 그림 (1 mm 눈금) | 밝기 증폭 | 무늬 파라미터 |
| ◗ 반원 유리 블록 | 스넬 + 프레넬 + 전반사 | n, R | 면마다 θ₁→θ₂, 임계각, 스넬 검산 |

슬릿 무늬가 나타나면 칠판에 λ, L, a, d와 y₁·Δy가 자동으로 적힙니다.

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
    OpticalSystem.js            ★ 광학 도메인 솔버: 광선 트리 추적, 광학적 연결(A→B, 광로 L) 기록, 빔 렌더링
    opticsMath.js               반사·굴절(벡터 스넬)·프레넬·얇은 렌즈·N-슬릿 세기·반원 경계 (순수 함수, 단위 테스트)
    wavelengthColor.js          파장 → RGB
  interaction/
    InteractionRegistry.js      ★ narrow phase 규칙 테이블 (확장 방법 상세 주석)
    ProximityChecker.js         ★ broad phase: checkProximity(a, b) 도메인 조합별 분기
    proximityStrategies.js      역학=Rapier 이벤트, 광학=빔 경로 전략 등록
    InteractionEngine.js        broad → narrow → enter/update/exit 파이프라인
    rules.js                    도구 쌍 규칙을 등록하는 곳 (Phase 1: 슬릿×스크린 회절 규칙 1개)
  player/
    PlayerController.js         PointerLockControls + KinematicCharacterController(캡슐)
    InputManager.js             키 상태 폴링 (isDown / consume)
    Targeting.js                화면 중앙 레이캐스트
    InteractionStateMachine.js  ★ idle → aiming → holding → placing 상태 머신
    Placement.js                고스트 미리보기 + 배치 가능 판정 (겹침/지지)
  scene/  LabScene.js, Blackboard.js (CanvasTexture 훅),
          style.js (아트 스타일: 팔레트, toy()/metal() 재질, rbox() 둥근 박스 — 룩은 여기서 일괄 조정)
  tools/  Pulley.js, Laser.js, index.js
          optics/ common.js(광축 높이·optics 규약), RayBox, Mirror, Lens, Slit, Screen, GlassBlock
  demos.js                      ?demo=… 프리셋
  ui/     HUD.js (상호작용 모니터 포함), HeldView.js (1인칭 장갑 손 + 들고 있는 도구),
          UIManager.js (범용 설정 패널)
tests/interaction.test.mjs      레지스트리·엔진 단위 테스트
tests/optics.test.mjs           반사·스넬·전반사 임계각·프레넬 4%·렌즈 초점·슬릿 극소/극대 검증
vendor/                         three (+ PointerLockControls, RoundedBoxGeometry, RoomEnvironment),
                                rapier (라이선스 동봉)
```

## 핵심 아키텍처

### 1. 상호작용 = 2단계 파이프라인

```
모든 엔티티 쌍 (a, b)
 ├─ 1) Broad phase  checkProximity(a, b)
 │     a.physicsDomain × b.physicsDomain 조합으로 전략 선택
 │       mechanical × mechanical → Rapier 센서/충돌 이벤트
 │       optical    × *          → A의 빛이 (거울·렌즈를 거쳐서라도) B에 닿는가 (OpticalSystem)
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

## Phase 1 설계: 빛의 전파는 솔버, 조합 현상은 규칙

반사를 `register('laser','mirror')` 같은 규칙으로 만들면 `('raybox','mirror')`, `('mirror','mirror')`,
`('lens','mirror')` … 모든 조합을 등록해야 합니다. Phase 0에서 피하려던 N² 폭발입니다. 그래서 역학이
Rapier(솔버) + 규칙으로 나뉘듯 광학도 두 층으로 나눴습니다.

| 층 | 무엇을 | 어디서 |
|---|---|---|
| 광학 솔버 | 소자 하나의 성질만으로 정해지는 것: 반사·굴절·흡수·광점 | 각 도구의 `optics.respond`, `OpticalSystem`이 광선 트리로 추적 |
| 상호작용 규칙 | 두 도구의 조합으로만 생기는 것: 슬릿(a,d,N) + 스크린(L) → 무늬 | `rules.js`의 `register('slit','screen', …)` |

광선은 지나온 소자 목록과 누적 광로 길이를 들고 다닙니다. 그래서 슬릿과 스크린 사이에 거울을 넣어도
(슬릿 → 스크린) 연결이 생기고, 무늬 크기에 쓰이는 L도 꺾인 경로 전체 길이로 정확히 계산됩니다
(`?demo=mirror`에서 L = 0.59 + 0.75 = 1.34 m 확인).

**어디서 깨지는가**
- 기하광학 광선 1개로는 옆으로 퍼지는 회절광을 표현할 수 없습니다. 그래서 회절은 스크린 위의 세기 분포로만 나타나고, 슬릿 뒤 광선은 0차 방향으로 직진합니다.
- 회절 무늬는 프라운호퍼(원거리) 근사이므로 L ≫ a²/λ일 때만 맞습니다. a = 400 μm이면 a²/λ ≈ 25 cm라서 스크린을 가까이 두면 실제(프레넬 회절)와 달라집니다.
- 렌즈는 근축 근사라서 구면 수차가 없고, 분산이 없어 프리즘 무지개는 나오지 않습니다.
- 슬릿 다음에 두 번째 슬릿을 두는 것처럼 회절광이 다시 회절하는 연쇄는 다루지 않습니다.

## 다음 Phase(전자기)가 이어받을 것

- `ProximityChecker`에 `('electromagnetic', …)` 전략 한 줄을 추가하면 됩니다. 판정 방식은 거리 기반 장(field) 세기나 도선 연결(포트 간 그래프)입니다.
- 광학처럼 "소자 하나의 응답"은 도메인 솔버에 둡니다. 회로라면 키르히호프 연립방정식이고, 저항·전지·전구가 각자 `circuit.stamp()`를 제공하는 식입니다.
- "조합으로만 생기는 현상"은 규칙에 둡니다. 예: 자석 + 코일 → 유도 기전력 ε = −dΦ/dt.
- 포트(`interactionPorts`)는 이미 도선 단자(`terminal`)를 표현할 수 있고, 새 조작 상태 `wiring`(단자 → 단자 드래그)만 상태 머신에 추가하면 됩니다.
- 광전 효과처럼 광학 × 전자기가 겹치는 도구는 `physicsDomain: ['optical','electromagnetic']` 배열로 두 솔버에 동시에 참여합니다.

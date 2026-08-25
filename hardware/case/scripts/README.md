# STL 편집 스크립트

Blender·OpenSCAD 같은 GUI 3D 툴 없이, Printables에서 받은 실제 BMO STL을 **바깥
모양은 그대로 두고 안쪽만** 깎아서 전자부품이 들어갈 자리를 만드는 스크립트다.

원칙: **원본 STL이 정답이다.** 화면 창 모양·크기, 버튼 위치·모양·개수는 전부 원본을
따라간다. 우리가 하는 일은 그 안에 OLED·개발보드·서보·버튼 스위치가 들어갈 자리를
안쪽에서 파내는 것뿐이다.

## 준비

```bash
pip install -r ../requirements.txt
```

Blender나 OpenSCAD 설치는 필요 없다 — `trimesh` + `manifold3d`(순수 파이썬 불리언
연산 엔진)만으로 구멍/포켓을 판다.

## 순서

### 1. 원본 올리기

받은 STL을 `hardware/case/original/bmo_base.stl` 로 저장한다. 이 파일은 이후
**절대 직접 고치지 않는다** — 결과물은 전부 이 파일에서 다시 만들어낸다.

### 2. 측정 (`measure.py`)

```bash
python3 measure.py ../original/bmo_base.stl
```

원본을 읽기만 하고(수정 없음), 전체 치수와 함께 두 가지 후보를 자동으로 찾는다.

- **화면 후보**: 정면을 향한 넓고 평평한 영역들 (면적 큰 순으로)
- **버튼 후보**: 정면 쪽으로 튀어나온 작은 돌기 군집들

`hardware/case/generated/preview_candidates.png` 에 위치를 표시한 미리보기 이미지가
저장된다. 파란 원이 화면 후보, 빨간 X가 버튼 후보다.

**정면이 이상하게 나오면** (몸통이 아니라 옆면/바닥이 보이면) `--front-axis` 를
`x`/`y`/`z`로 바꿔가며 다시 돌린다:

```bash
python3 measure.py ../original/bmo_base.stl --front-axis x
```

버튼이 하나도 안 잡히면 `--bump-height` 를 낮춰본다(기본 0.6mm):

```bash
python3 measure.py ../original/bmo_base.stl --bump-height 0.3
```

### 3. 확인 (사람이 직접) → `features.json`

`preview_candidates.png` 를 실제 BMO 정면 사진과 나란히 놓고 눈으로 비교한다.
- 어느 `screen#N` 이 진짜 화면 창인지
- `btn#N` 중 어느 2개가 초록/파랑으로 쓸 버튼인지(D패드나 다른 컬러 버튼도 후보로
  잡히지만, 우리는 그중 2개만 배선한다 — 실제로 쓸 두 개를 고른다)

확인한 좌표를 `features.json` 에 옮겨 적는다 (템플릿은 이 폴더에 있음, `measure.py`
콘솔 출력의 `center_mm` 값을 그대로 복사).

### 4. 내부 가공 (`fit_internals.py`)

```bash
python3 fit_internals.py
```

`features.json` 좌표를 기준으로 원본 안쪽만 깎는다:
- 화면 자리 뒤: OLED + 아크릴 두께만큼 파내기
- 실배선 버튼 2곳: 안쪽 벽에 스위치 포켓
- 팔 축 관통 홀
- 뒤판 분리 + 나사 보스
- 하단 케이블 개구부

결과물은 `hardware/case/generated/body_final.stl` (재생성 가능한 산출물이라 git에는
안 올라간다 — `original/` 원본만 커밋한다).

이 스크립트는 원본 STL 확보 후, `features.json` 좌표가 확정되면 작성한다
(좌표 없이 미리 만들면 추측으로 자리를 파게 되어 오히려 위험하다).

### 5. 맞는지 확인

```bash
python3 measure.py ../generated/body_final.stl --front-axis <2단계에서 쓴 값>
```

바깥 실루엣(전체 치수)이 원본과 같은지, 화면·버튼 좌표가 그대로인지 다시 측정해서
확인한다. 부품이 실제로 들어가는 공간인지는 `hardware/case/README.md` 의 부품 크기
표와 대조한다.

## 파일

| 파일 | 역할 |
|---|---|
| `measure.py` | 원본/결과물 측정 + 화면·버튼 후보 자동 검출 (읽기 전용) |
| `features.json` | 사람이 확인한 실제 좌표 (측정값 + 사람 판단) |
| `fit_internals.py` | `features.json` 기준으로 안쪽만 가공 (다음 단계) |

## 진행 상황 (2026-08-25)

`features.json`이 대부분 실측값으로 채워졌다.

- 화면 베젤, 버튼 4종, D패드, 컨트롤러 포트, 드라이브 슬롯, LED, 나사 보스: **완료**
  (front-plate 직접 실측, 개별 부품 파일 치수와 대조해 검증함)
- 팔 축(어깨 소켓): **완료** — Arm 1/2에서 지름 11mm 원통 스텁 확인, 좌우 대칭 검증됨.
  원본은 고정 핀이 박히는 블라인드 소켓인데, 우리는 이걸 3.2mm 관통홀로 다시 뚫어
  서보 축을 통과시킨다.
- 버튼 스프링 포켓: **우회 완료** — Button Box의 로컬 좌표계를 front-plate 좌표계에
  정렬하려는 시도(5개 파스너 구멍 매칭)가 표준편차 10mm 이상으로 실패해서 포기했다.
  대신 이미 확보한 버튼 월드 좌표 뒤에 스프링 실측 치수(17.3×24.5×5mm)를 바로
  적용하는 방식으로 우회했다 — Button Box 좌표계 자체는 필요 없다.
- 몸통 쪽 팔 소켓 짝, 뒷판, 케이블 개구부: 원본에 없어서 **우리가 새로 설계**
- `fit_internals.py` **작성 및 실행 완료** — 결과를 실제로 만들어보고 시각 확인함:
  - **화면은 절삭 자체가 불필요하다는 게 실측으로 드러났다**: `contains()` 샘플링으로
    확인한 결과 bezel 영역(z=0~4mm)이 테두리 바로 안쪽부터 이미 비어 있다(내부
    비율 0%). 원본 front-plate에 화면 창이 이미 뒤까지 뚫려 있다 — OLED+아크릴을
    바로 그 자리에 마운트하면 된다. (버튼 자리는 반대로 실제로 막혀 있어서
    73% 내부 확인 — 절삭이 맞게 필요했다.)
  - 버튼 2곳(초록/파랑) 관통홀, 뒷판 체결용 나사 파일럿홀 9곳 절삭 확인
  - 팔 2개의 어깨 스텁을 3.2mm 관통 축 구멍으로 재천공 — 결과물 watertight 확인
  - 뒷판 v2 — 트레이(화면·버튼 클러스터 영역, 나사 보스 9곳 전부 포함 — 확인해보니
    다리 쪽 절반 없이도 9곳 모두 이 범위 안에 들어왔다) + OLED/개발보드/버튼스위치
    2개 스탠드오프 + 서보 포켓 + 하단 케이블 개구부까지 전부 생성.
    깊이를 30mm→20mm로 줄였다(서보는 두께 12mm만 차지, 30mm는 과했음을 뒤늦게 확인).
    모든 스탠드오프 좌표를 직접 계산해서 서로 충돌하지 않는지 검산 완료
    (OLED·개발보드·버튼스위치 기둥 좌표가 실제로는 안 겹침, 서보 포켓 폭이 두 축
    받침 사이 거리보다 작음 — 스크립트가 실행 시 자동으로 이 조건을 확인하고
    안 맞으면 경고를 찍는다).

**아직 실물 확인이 필요한 것** (스크립트 실행 시 `[TODO]`로도 출력됨):
  - 서보 축 받침 높이 — 몸통 쪽 원본 소켓이 없어 화면/버튼 경계의 빈 틈(약
    12.6mm 폭)에 잠정 배치했다. 서보 몸체(29mm 방향)가 그 틈에 실제로 맞는지는
    부품 도착 후 반드시 확인.
  - OLED/개발보드 크기와 배치 — `fit_internals.py` 상단의 `OLED_FOOTPRINT_MM`,
    `BOARD_FOOTPRINT_MM`, `BOARD_OFFSET_XY` 등은 전부 1차 배치안. 실물 치수로
    갱신 후 다시 생성할 것.
  - 버튼 스위치 마운트 깊이(`BUTTON_SWITCH_TARGET_Z`) — 실제 산 스위치 모듈
    두께에 맞춰 조정.

돌리는 법: `python3 fit_internals.py` → `hardware/case/generated/` 에
`front_plate_final.stl`, `arm1_final.stl`, `arm2_final.stl`, `back_panel.stl` 생성.

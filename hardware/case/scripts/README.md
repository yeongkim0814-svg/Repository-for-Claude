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
| `fit_internals.py` | `features.json` 기준으로 안쪽만 가공 (아직 작성 전 — STL 확보 후 진행) |

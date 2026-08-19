# Meridian Pack — Spaceflight Simulator 커스텀 부품 모드

Spaceflight Simulator(Team Curiosity)에 **진공 특화 상단 엔진 "Meridian(메리디안)"** 을 추가하는 파트팩입니다.
`.pack` 파일 하나로 배포되며 **PC와 모바일(Android/iOS) 모두에서 동작**합니다.

| | |
|---|---|
| 배포 형태 | 파트팩 (`.pack`) — 코드 모드 아님 |
| 지원 플랫폼 | Windows / macOS / Android / iOS |
| 필요 자원 | 스톡 액체연료만 사용 (새 자원 타입 없음 → 스톡 연료탱크와 그대로 호환) |
| 빌드 카테고리 | Engines |

## 부품 요약

| 항목 | 값 | 스톡 비교 |
|---|---|---|
| 추력 | 60 | Valiant(40)와 Frontier(100) 사이 |
| ISP | 330 | 스톡 최고 Frontier(290)보다 높음 |
| 질량 | 5.0 t | 추력/질량비 12.0 — 게임 내 최저 |

효율을 얻는 대신 추력 대비 무게를 희생한 설계입니다. 이륙단으로 쓰면 손해고, 궤도에 올린 뒤 전이 단계에서 이득을 봅니다.
설계 근거와 수치 계산은 [docs/01-design.md](docs/01-design.md)에 있습니다.

## 플레이어용 설치법

1. 릴리스에서 `MeridianPack.pack` 을 받습니다.
2. SFS 게임 폴더의 `Mods/Custom Assets/Part Packs` 안에 넣습니다.
   - Windows: `.../Spaceflight Simulator Game/Mods/Custom Assets/Part Packs`
   - Android: 게임이 만든 `Spaceflight Simulator` 폴더 아래 같은 경로
3. 게임을 재시작하고 **설정 → Mods** 에서 활성화합니다.
4. 빌드 화면 좌측 카테고리 **Engines** 에서 Meridian 을 찾습니다.

## 개발자용 — 이 저장소의 구조

이 저장소는 **유니티 앞단 전부**(설계·수치·검증·텍스처·조립 지시서·선택적 C# 코드)를 담습니다.
최종 `.pack` 빌드만 유니티가 설치된 PC에서 수행합니다.

```
parts/meridian.part.json     부품 사양 — 단일 진실 공급원(SSOT). 수치는 여기만 고친다.
parts/stock-reference.json   스톡 엔진 실측치(밸런스 기준). 임의 수정 금지.
parts/schema.md              사양 필드 ↔ 유니티 모듈 대응표
tools/validate_parts.py      스키마 + 밸런스 검증, Δv 비교표 (종료 코드로 CI 가능)
tools/spec_sheet.py          유니티 인스펙터 입력 시트 생성 → docs/generated/
tools/make_texture_template.py  텍스처 템플릿 PNG 생성 (외부 라이브러리 불필요)
docs/01-design.md            설계서
docs/02-unity-workflow.md    유니티 툴킷 설치 → 프리팹 조립 → .pack 빌드
docs/03-testing-checklist.md 인게임 검증 체크리스트
docs/04-publishing.md        배포·버전·라이선스
unity/                       (선택) PC 전용 커스텀 동작 C# 스켈레톤
assets/textures/             플레이스홀더 텍스처
```

### 수치를 바꾸는 절차

```bash
$EDITOR parts/meridian.part.json      # 1. 사양 수정
python3 tools/validate_parts.py       # 2. 밸런스 검증 (실패하면 종료 코드 1)
python3 tools/spec_sheet.py           # 3. 유니티 입력 시트 재생성
```

파이썬 3.8 이상이면 되고 설치할 패키지는 없습니다.

## 라이선스

MIT. 자세한 배포 규칙은 [docs/04-publishing.md](docs/04-publishing.md) 참고.

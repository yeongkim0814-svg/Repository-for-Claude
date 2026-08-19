# 부품 사양 스키마 (`*.part.json`)

`parts/*.part.json` 이 이 모드의 **단일 진실 공급원(SSOT)** 이다.
유니티 인스펙터 값, 문서의 표, 텍스처 크기가 전부 여기서 파생된다.
필수 필드와 타입은 `tools/validate_parts.py` 의 `SCHEMA` 목록이 강제한다.

## 필드 ↔ 유니티 모듈 대응

| JSON 경로 | 타입 | 필수 | 유니티에서의 위치 |
|---|---|---|---|
| `schemaVersion` | int | ✔ | (도구용) |
| `id` | string | ✔ | 프리팹 이름 / 세이브에 기록되는 식별자 — **배포 후 변경 금지** |
| `packId` | string | ✔ | Pack Data 에셋의 팩 식별자 |
| `displayName.en` / `.ko` | string | ✔ | `Part.displayName` (TranslationVariable) |
| `description.en` / `.ko` | string | ✔ | `Part.description` |
| `pickCategories` | string[] | ✔ | `Assets/Resources/Pick Categories/*.asset` 등록 대상 |
| `width`, `height` | number | ✔ | 프리팹 형상 기준 치수(게임 단위) |
| `mass` | number | ✔ | `Part.mass` (톤) |
| `engine.thrust` | number | ✔ | `EngineModule.thrust` |
| `engine.isp` | number | ✔ | `EngineModule.ISP` |
| `engine.thrustNormal` | [x, y] | ✔ | `EngineModule.thrustNormal` — 보통 `(0, 1)` |
| `engine.thrustPosition` | [x, y] | ✔ | `EngineModule.thrustPosition` — **y 는 음수**(부품 아래로 분출) |
| `engine.hasGimbal` | bool | ✔ | `EngineModule.hasGimbal` |
| `engine.gimbalTorque` | string | | 짐벌 `MoveModule` 의 torque 식 (예: `throttle * 3`) |
| `engine.heatOn` | bool | | `EngineModule.heatOn` 사용 여부 |
| `fuel.resourceType` | string | ✔ | `FlowModule` 이 참조하는 `ResourceType` 이름 |
| `fuel.resourceGuid` | string | ✔ | 해당 에셋의 유니티 GUID (스톡 액체연료: `228bca42e456ecb4cb87cdd837fa81fe`) |
| `fuel.hasOwnTank` | bool | | true 면 `ResourceModule` 을 부품에 직접 붙인다 |
| `fuel.sourceFlow` | string | | 연료를 어느 방향에서 받는지 (`up` 등) |
| `attachPoints[]` | object[] | ✔ | 부착점. `position`, `surfaceId`, `breakForce` |
| `colliders[]` | object[] | ✔ | `ColliderModule` / Polygon. `points` 는 3점 이상 |
| `textures[]` | object[] | ✔ | `name`, `file`, `size`, `tiling`. 파일이 없으면 검증기가 경고 |
| `effects.flame` | object | | 화염 프리팹·위치·스케일·색. 위치는 `thrustPosition` 과 일치시킬 것 |
| `effects.sound` | object | | `EffectModule` 사운드 |
| `notes[]` | string[] | | 사람이 읽는 메모. 도구는 무시 |

## 밸런스 검사 규칙 (`tools/validate_parts.py`)

| 규칙 | 종류 |
|---|---|
| `thrust`, `isp`, `mass` > 0 | 오류 |
| `engine.thrustPosition.y` < 0 | 오류 |
| `pickCategories` 가 스톡 카테고리 목록 안에 있음 | 오류 |
| ISP 가 스톡 최고치(290)를 넘으면 추력/질량비가 스톡 최저치(16.7)보다 낮아야 함 | 오류 |
| 추력/질량비가 스톡 최고치(34.3)를 넘음 | 경고 |
| ISP 가 스톡 최고치의 1.5배(435)를 넘음 | 경고 |
| 참조한 텍스처 파일이 존재하지 않음 | 경고 |

기준값은 전부 `parts/stock-reference.json` 에서 읽는다. 하드코딩된 수치는 없다.

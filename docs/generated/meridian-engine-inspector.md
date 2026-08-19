<!-- 이 파일은 tools/spec_sheet.py 가 생성한다. 직접 고치지 말고 parts/*.part.json 을 고칠 것. -->

# Meridian — 유니티 인스펙터 입력 시트

원본 사양: `parts/meridian.part.json` · 빌드 카테고리: **Engines** · 크기: 폭 2 × 높이 3

## 1. 모듈 값

| 모듈 | 필드 | 값 |
|---|---|---|
| `Part` | `displayName` | `Meridian / 메리디안` |
| `Part` | `description` | `진공 특화 상단 엔진. 효율은 매우 높지만 추력 대비 무게가 무거워 이륙에는 쓸 수 없고, 궤도 전이 단계에서 진가를 발휘한다.` |
| `Part` | `mass` | `5.0` |
| `EngineModule` | `thrust` | `60.0` |
| `EngineModule` | `ISP` | `330.0` |
| `EngineModule` | `thrustNormal` | `(0, 1)` |
| `EngineModule` | `thrustPosition` | `(0, -3.0)` |
| `EngineModule` | `hasGimbal` | `true` |
| `EngineModule` | `gimbal (torque)` | `throttle * 3` |
| `EngineModule` | `engineOn` | `engine_on (스톡 변수 그대로)` |
| `EngineModule` | `throttle_Out` | `throttle (스톡 변수 그대로)` |
| `EngineModule` | `heatOn` | `heat_on__for_creative_use` |
| `EngineModule` | `source (FlowModule)` | `up 흐름 (연료: Liquid Fuel)` |
| `FlowModule` | `resourceType` | `Liquid Fuel (GUID 228bca42e456ecb4cb87cdd837fa81fe)` |

## 2. 부착점 (Attach Points)

| 이름 | 위치 | surface | breakForce |
|---|---|---|---|
| top | `(0, 0)` | Fuselage | 1500 |
| bottom | `(0, -3.0)` | Fuselage | 800 |

## 3. 콜라이더 (ColliderModule / Polygon)

- **body** (polygon): `(-1, 0) (1, 0) (0.6, -1.6) (-0.6, -1.6)`
- **nozzle** (polygon): `(-0.6, -1.6) (0.6, -1.6) (1.0, -3.0) (-1.0, -3.0)`

## 4. 텍스처

- `meridian_body` — 256×256 px, vertical 타일링 → `assets/textures/meridian_body.png`
- `meridian_nozzle` — 256×256 px, vertical 타일링 → `assets/textures/meridian_nozzle.png`

## 5. 이펙트

- 화염: 프리팹 `Engine Flame`, 위치 `(0, -3.0)`, 스케일 0.8, 색 `#7FD4FF`
- 사운드: `Engine Loop` (volume 0.7)

## 6. 메모

- 새 ResourceType을 만들지 않고 스톡 액체연료를 그대로 쓴다 → 스톡 탱크와 호환되고 모바일에서도 안전하다.
- 수치는 tools/validate_parts.py 의 밸런스 규칙을 통과해야 한다. 값을 바꾸면 검증기와 spec_sheet를 다시 실행할 것.


# 선택적 코드 어셈블리 (PC 전용)

## 먼저 알아야 할 것

**이 폴더의 코드는 없어도 된다.** Meridian 엔진은 툴킷 모듈 조합만으로 완전히 동작하며,
그것이 이 모드의 설계 원칙이다(→ `docs/01-design.md` 4절).

이유:

- 코드 모드(`.dll`)는 **PC 전용**이다. 모바일 SFS 는 코드 모드를 지원하지 않는다.
- 파트팩 빌더(`SFS → Build Pack`)가 커스텀 코드 어셈블리를 `.pack` 안에 함께 넣는 기능을 제공하지만,
  모바일 빌드(IL2CPP)에서 그 어셈블리가 실행된다는 보장이 없다.
- 따라서 **코드가 없을 때의 동작이 정상 동작**이어야 한다. 코드는 PC 에서의 추가 재미일 뿐이다.

## 들어 있는 것

| 파일 | 설명 |
|---|---|
| `Scripts/MeridianEngineModule.cs` | 대기 밀도에 따라 ISP 를 보간하는 확장 스켈레톤. 기본값은 **비활성**(`enableIspCurve = false`) |
| `MeridianPack.csproj` | .NET Framework 4.8 클래스 라이브러리 프로젝트 |

`MeridianEngineModule.cs` 에는 TODO 가 두 곳 있다:

1. `GetAtmosphereDensity01()` — SFS 의 대기/행성 API 연결
2. `ApplyIsp()` — `EngineModule.ISP` 는 `Composed_Float` 타입이라 단순 대입이 아니다

두 곳 모두 **SFS 버전마다 시그니처가 달라질 수 있어 추측으로 채우지 않았다.**
게임의 `Spaceflight Simulator_Data/Managed/Assembly-CSharp.dll` 을 dnSpy 로 열어
`SFS.Parts.Modules.EngineModule` 과 대기 관련 클래스를 확인한 뒤 채우면 된다.
채우기 전까지는 고정 ISP 330 으로 안전하게 동작한다.

## 빌드

게임 DLL 이 있어야 컴파일된다(저작권 때문에 저장소에 포함하지 않는다).

```bash
msbuild unity/MeridianPack.csproj /p:SfsManagedDir="<게임경로>/Spaceflight Simulator_Data/Managed"
```

또는 `unity/Dependencies/` 폴더를 만들어 다음 DLL 을 복사해두고 인자 없이 빌드한다:
`Assembly-CSharp.dll`, `UnityEngine.dll`, `UnityEngine.CoreModule.dll`, `Newtonsoft.Json.dll`
(Harmony 패치를 쓸 경우 `0Harmony.dll` 추가). 이 폴더는 `.gitignore` 되어 있다.

빌드 산출물 `MeridianPack.dll` 은 `SFS → Build Pack` 창의 code assembly 칸에 지정한다.

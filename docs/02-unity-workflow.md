# 유니티 작업 지시서 — 프리팹 조립부터 `.pack` 빌드까지

이 문서는 **유니티가 설치된 PC에서** 수행하는 절차다. 이 저장소의
`docs/generated/meridian-engine-inspector.md` 를 옆에 띄워놓고 값을 그대로 옮겨 적으면 된다.

> **공용 PC 주의사항**
> - Unity 에디터 + 툴킷은 디스크를 수 GB 쓴다. 작업 후 정리할 계획을 미리 세울 것.
> - Unity 계정과 Odin 트라이얼 모두 로그인이 필요하다. **작업이 끝나면 반드시 로그아웃**할 것.
> - 유니티 프로젝트 자체는 용량이 커서 이 저장소에 넣지 않는다. 대신 사양(JSON)·텍스처·지시서가
>   저장소에 있으므로, PC가 초기화돼도 이 문서만 있으면 30분 안에 재현할 수 있다.
> - 만든 `.pack` 파일과 최종 텍스처는 작업 직후 이 저장소에 커밋해 보존할 것.

## 1. 설치 (최초 1회)

1. **Unity Hub** 설치 → Unity 계정 로그인 → 개인용 무료 라이선스 발급(Hub 의 라이선스 메뉴).
2. **Unity 에디터 6000.1.x** 설치. 툴킷이 이 버전대로 만들어져 있다.
   - 안드로이드에서도 쓰려면 설치 시 **Android Build Support** 모듈을 함께 체크한다.
   - macOS/iOS 대상까지 빌드하려면 해당 플랫폼 모듈도 체크한다.
3. **Modding Toolkit** 다운로드: `https://github.com/Stef-Moroyna/Spaceflight-Simulator--ModdingToolkit`
   → ZIP 을 받아 압축을 푼다. 안의 `Modding Toolkit` 폴더가 유니티 프로젝트다.
4. **Odin Inspector** 다운로드(`https://odininspector.com`, 계정 생성 후 무료 트라이얼).
   툴킷이 Odin 을 쓰기 때문에 없으면 컴파일 에러가 난다.
5. Unity Hub → **Add → Add project from disk** → 위 `Modding Toolkit` 폴더 선택 → 열기.
6. 처음 열면 **Safe Mode 경고와 콘솔 에러가 뜬다. 무시한다.**
   `Assets → Import Package → Custom Package` 에서 Odin 패키지를 임포트하면 에러가 사라진다.

## 2. 프리팹 만들기

값은 전부 `docs/generated/meridian-engine-inspector.md` 에 있다.

1. `Assets/Resources/Parts/Engines/Engine Frontier.prefab` 을 복제(Ctrl+D)하고
   `Engine Meridian.prefab` 로 이름을 바꾼다. 스톡 프리팹을 그대로 두고 사본을 쓴다.
   - 복제로 시작하는 이유: 부착점·콜라이더·화염 이펙트·변수(`engine_on`, `throttle`) 배선이 이미 되어 있다.
2. 프리팹을 열고 루트의 **`Part`** 컴포넌트에서
   - `displayName` → `Meridian`
   - `description` → 인스펙터 시트의 설명 문구
   - `mass` → `5`
3. **`EngineModule`** 에서
   - `thrust` → `60`
   - `ISP` → `330`
   - `thrustNormal` → `(0, 1)` (변경 없음)
   - `thrustPosition` → `(0, -3)`
   - `hasGimbal` → 켬, 짐벌 `torque` 식을 `throttle * 3` 으로
   - `engineOn` / `throttle_Out` / `heatOn` 은 복제해온 스톡 변수 참조를 **그대로 둔다**.
     여기를 건드리면 스로틀과 스테이징이 동작하지 않는다.
   - `source` 는 위쪽 연료 흐름을 가리키는 `FlowModule` 참조 — 그대로 둔다(스톡 액체연료를 쓴다).
4. **콜라이더 / 부착점**: 인스펙터 시트 2·3절의 좌표로 맞춘다. 폭 2 × 높이 3 이므로
   Frontier(폭 2 × 높이 3.5)에서 아래 부착점 y 를 `-3.5` → `-3` 으로 줄이는 것이 핵심 변경이다.
   **부착점 y 와 `thrustPosition.y` 와 화염 이펙트 위치 세 값이 전부 `-3` 으로 일치해야 한다.**
5. **텍스처**: `assets/textures/meridian_body.png`, `meridian_nozzle.png` 를 프로젝트로 드래그해 넣고
   임포트 설정을 스톡 파트 텍스처와 동일하게 맞춘다(특히 **Wrap Mode = Repeat**, 세로 타일링이므로).
   플레이스홀더이므로 나중에 실제 아트로 교체하면 된다 — 교체해도 이 문서 절차는 그대로다.
6. **Pick Category**: `Assets/Resources/Pick Categories/Engines.asset` 에 이 파트를 등록한다.
   (스톡 카테고리: `Basic / Engines / Boosters / Aero / Structural / Fairings / Other`,
   크기 버킷 `Small / 6 wide / 8 wide / 10 wide / 12 wide`)

## 3. `.pack` 빌드

1. 프리팹과 텍스처 등 이 팩에 들어갈 에셋들을 선택하고, 인스펙터 하단에서
   **AssetBundle 라벨**을 하나 부여한다(예: `meridianpack`). 빌더는 이 라벨 단위로 번들을 만든다.
2. 상단 메뉴 **SFS → Build Pack**.
3. 창에서
   - **Output File Name**: `MeridianPack`
   - **Pack Data**: 팩 정보(이름/작성자/버전) 에셋
   - **AssetBundle**: 1번에서 만든 라벨 선택
   - 대상 플랫폼: **Windows / macOS / Android / iOS** 를 모두 체크하면 하나의 `.pack` 이 전 플랫폼 번들을 담는다.
     (모바일 대상을 체크하려면 해당 빌드 서포트 모듈이 설치돼 있어야 한다.)
   - **Custom code assembly(DLL)**: 비워 둔다. 이 팩은 코드 없이 동작한다. → `unity/README.md` 참고
4. **Build Mod** 를 누르면 `ModBuilder` 폴더에 `MeridianPack.pack` 이 생성된다.

## 4. 설치와 실행

1. `MeridianPack.pack` 을 SFS 의 `Mods/Custom Assets/Part Packs` 폴더에 넣는다.
2. 게임 재시작 → **설정 → Mods** 에서 팩을 활성화한다.
3. 새 게임 또는 세이브 로드 → 빌드 화면 좌측 **Engines** 카테고리에 Meridian 이 보이면 성공.
4. 이후 [`docs/03-testing-checklist.md`](03-testing-checklist.md) 의 항목을 순서대로 확인한다.

## 5. 자주 막히는 지점

| 증상 | 원인 | 조치 |
|---|---|---|
| 유니티 콘솔에 컴파일 에러가 잔뜩 | Odin 미임포트 | 1-6 단계 재확인 |
| 빌드 메뉴에 부품이 안 보임 | Pick Category 미등록 또는 AssetBundle 라벨 누락 | 2-6, 3-1 재확인 |
| 부품은 보이는데 점화가 안 됨 | `engineOn` / `throttle_Out` 변수 참조가 끊김 | 스톡 프리팹에서 다시 복제해 시작 |
| 불꽃이 노즐에서 떨어져 나옴 | `thrustPosition` 과 이펙트 위치 불일치 | 둘 다 `(0, -3)` 인지 확인 |
| 연료를 안 빨아들임 | `source` FlowModule 참조 문제 | 스톡 값을 그대로 두었는지 확인 |
| 모바일에서만 부품이 없음 | 해당 플랫폼 번들 미포함 | 3-3 에서 Android/iOS 체크 후 재빌드 |

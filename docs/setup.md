# 설정 방법

## 1. 브로커 만들기 (무료)

기숙사 WiFi는 NAT/방화벽 뒤에 있어서 한국에서 직접 접속할 수 없다.
그래서 BMO가 **바깥으로** 브로커에 붙어 있게 하고, 웹앱도 같은 브로커에 붙는다.

1. [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/) 무료 클러스터 생성
2. **Access Management** 에서 계정을 **두 개** 만든다
   - `bmo-device` — BMO 펌웨어용
   - `bmo-web` — 웹앱용
   - 계정을 나눠야 한쪽이 유출돼도 다른 쪽을 갈아끼우면 된다
3. 클러스터 주소를 적어둔다 (`xxxxx.s1.eu.hivemq.cloud`)
   - 기기용 TLS 포트: **8883**
   - 웹앱용 WebSocket 포트: **8884**, 경로 `/mqtt`

## 2. 펌웨어 올리기

```bash
cd firmware
pio run -t upload      # PlatformIO 필요
pio device monitor     # 로그 확인
```

접속 정보는 코드에 넣지 않는다. 아래 3번에서 기기에 직접 입력한다.

## 3. BMO에 WiFi / 브로커 정보 넣기

접속 정보가 없거나 WiFi 연결에 실패하면 BMO가 스스로 설정용 WiFi를 띄운다.
(이미 설정된 뒤에도 **파란 버튼을 5초 길게 눌러** 다시 열 수 있다)

1. 폰이나 태블릿에서 WiFi `BMO-setup` 에 접속 (비밀번호 `bmosetup`)
2. 브라우저가 설정 화면을 자동으로 띄운다. 안 뜨면 `http://192.168.4.1`
3. 입력:
   - WiFi 종류: **학교 WiFi (계정 로그인)** ← KTJ 기숙사는 WPA2-Enterprise
   - SSID, 계정 ID, 계정 비밀번호
   - MQTT 주소 / 포트 **8883** / 사용자 `bmo-device` / 비밀번호
   - 기기 이름 (예: `bmo1`) — 웹앱에도 같은 값을 넣어야 한다
4. 저장하면 자동으로 재시작하고 연결을 시도한다

비밀번호는 기기 안(NVS)에만 저장되며 깃허브에는 올라가지 않는다.

## 4. 웹앱 열기

`webapp/` 을 GitHub Pages 로 배포하거나, 로컬에서 그냥 띄운다.

```bash
cd webapp && python3 -m http.server 8000
```

브라우저에서 열고 **설정**을 눌러 입력한다.

| 항목 | 값 |
|---|---|
| 브로커 주소 | `xxxxx.s1.eu.hivemq.cloud` |
| WebSocket 포트 | `8884` |
| 경로 | `/mqtt` |
| 사용자 / 비밀번호 | `bmo-web` 계정 |
| 기기 이름 | BMO에 넣은 것과 **똑같이** |

이 값은 브라우저 localStorage 에만 저장된다.

상단 점이 초록색이 되고 "온라인"이 뜨면 성공이다.

## 학교 WiFi가 안 붙을 때

WPA2-Enterprise는 학교마다 정책이 달라서 이 프로젝트에서 가장 불확실한 부분이다.

1. **계정 ID 형식 확인** — `id` 인지 `id@ktj.edu.my` 인지 학교마다 다르다
2. **CA 인증서 요구** — 필요한 경우 `wifi_provision.cpp` 의 표시된 위치에
   `esp_eap_client_set_ca_cert()` 로 인증서를 넣어야 한다
3. **MAC 등록 정책** — 학교 IT에 기기 등록이 필요할 수 있다
4. **플랜 B (권장)** — 소형 트래블 라우터(GL.iNet 등)를 같이 보낸다.
   라우터가 학교 로그인을 처리하고 BMO에는 평범한 WiFi를 준다.
   이러면 설정에서 "일반 WiFi"를 고르면 되고, 학교 정책이 바뀌어도 라우터만 손보면 된다.
5. 최후 수단 — 폰 핫스팟

## 보안 메모

- TLS로 암호화되지만 기본 설정은 서버 인증서를 검증하지 않는다(`setInsecure()`).
  통신 내용은 보호되지만 브로커 위장까지 막으려면 `mqtt_client.cpp` 에서
  `setCACert()` 로 루트 인증서를 넣는다.
- 어떤 자격증명도 리포지토리에 커밋하지 않는다. `.gitignore` 로 막아두었다.

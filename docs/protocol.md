# MQTT 프로토콜

기기 이름이 `bmo1` 이라면 모든 토픽은 `bmo/bmo1/...` 이 된다.

## 웹앱 → BMO

| 토픽 | 페이로드 | 설명 |
|---|---|---|
| `cmd/face` | `{"preset":"happy"}` | 내장 표정으로 전환 |
| `cmd/face` | `{"bitmap":"<base64>"}` | 직접 그린 그림 / 글씨 |
| `cmd/arm` | `{"angle":70}` | 팔 각도 (20~160으로 클램프됨) |
| `cmd/arm` | `{"preset":"wave"}` | `down` `up` `wave` `hug` |
| `cmd/sys` | `{"sleep":true}` | 수면모드 |
| `cmd/sys` | `{"brightness":75}` | 화면 밝기 % |

QoS 1, retained 아님. 그림이나 팔 명령이 오면 수면모드는 자동으로 풀린다.

내장 표정: `neutral` `happy` `love` `wink` `surprise` `sad` `angry` `bored` `sleepy` `cheeky`

## BMO → 웹앱

| 토픽 | 페이로드 |
|---|---|
| `status` | `online` / `offline` (retained, LWT) |
| `state` | `{"expression":"happy","arm":30,"armPreset":"down","sleeping":false,"brightness":75,"rssi":-58,"ip":"...","uptime":1234,"heap":180000}` (retained) |

`status` 는 **LWT(Last Will)** 로 등록되어 있다. BMO의 전원이 끊기거나 WiFi가 죽으면
브로커가 대신 `offline` 을 발행하므로, 웹앱은 BMO가 사라진 것을 확실히 알 수 있다.

`state` 는 retained 라서 웹앱을 열자마자 현재 상태가 바로 보인다.

## 그림 포맷

64×48 캔버스를 팔레트 인덱스(0~3)로 만든 뒤 RLE + base64 로 감싼다.

```
바이트 하나 = ((연속길이 - 1) << 2) | 팔레트인덱스     // 길이 1~64
```

팔레트는 펌웨어 `face_config.h` 와 웹앱 `encode.js` 가 **같은 값을 써야 한다.**

| 인덱스 | 색 | 용도 |
|---|---|---|
| 0 | `#3FBFA0` | 배경 (민트) |
| 1 | `#122B3D` | 이목구비 (진남색) |
| 2 | `#E58BA0` | 볼 (분홍) |
| 3 | `#F2FBF6` | 하이라이트 |

실측 크기 (`webapp/test/codec.test.mjs`):

| 그림 | base64 크기 |
|---|---|
| 전부 배경 | 64 B |
| 전형적인 표정 | 116 B |
| 최악(랜덤 노이즈) | 약 3.0 KB |

펌웨어 MQTT 버퍼는 8 KB 이므로 최악의 경우도 여유 있게 들어간다.

인코더/디코더를 고칠 때는 반드시 왕복 테스트를 돌린다:

```bash
./tools/test_codec.sh
```

## 한글은 어떻게 나오는가

BMO 안에는 **한글 폰트가 없다.** 웹앱이 브라우저 폰트로 글씨를 64×48 캔버스에 그린 뒤
2치화해서 비트맵으로 보낸다(`drawing.js` 의 `rasterizeText`).
덕분에 한글·이모지·손글씨가 전부 같은 경로로 처리되고, 기기 펌웨어는 단순해진다.

기기의 5×7 도트 폰트는 버튼으로 부르는 상태 화면(ASCII)에만 쓴다.

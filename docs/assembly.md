# 조립 순서

납땜은 하지 않는다. 자세한 배선은 [`hardware/wiring.md`](../hardware/wiring.md) 참고.

## 1. 케이스 없이 먼저 동작시킨다

부품을 책상 위에 늘어놓은 채로 전부 동작시킨 뒤에 케이스에 넣는다.
케이스 안에서 디버깅하는 것은 훨씬 괴롭다.

1. 보드에 USB 연결 → 펌웨어 업로드 → 얼굴이 뜨는지 확인
2. 버튼 모듈 2개 연결 → 수면모드 / 상태 화면 확인
3. 스크류 단자대로 서보 전원 연결 → **공통 GND 연결** → 팔 프리셋 확인
4. 설정 포털에서 WiFi/MQTT 입력 → 웹앱에서 그림 전송 확인

## 2. 스모크 아크릴 확인

케이스를 출력하기 **전에**, 아크릴 조각을 손으로 화면 위에 들고 눈으로 본다.
투과율이 맞는지 여기서 판단한다. ([`acrylic.md`](acrylic.md))

## 3. STL 가공 실행

프린터가 오기 전에 여기까지는 이미 끝나 있어야 한다 (`hardware/case/scripts/`).

1. `python3 measure.py` 로 원본 실측 → `python3 fit_internals.py` 로 실제 절삭
   ([`hardware/case/scripts/README.md`](../hardware/case/scripts/README.md))
2. `hardware/case/generated/` 에 `front_plate_final.stl`, `arm1_final.stl`,
   `arm2_final.stl`, `back_panel.stl` 이 생성된다
3. **부품이 실제로 도착하면** `fit_internals.py` 상단의 치수 상수(`OLED_FOOTPRINT_MM`,
   `BOARD_FOOTPRINT_MM`, `BOARD_OFFSET_XY`, `BUTTON_SWITCH_TARGET_Z` 등)를 실측값으로
   갱신하고 다시 돌린다 — 지금 값은 BOM 표 기준 1차 배치안이다.
4. 그 외 원본 그대로 쓰는 파츠(버튼 캡 4종, D-패드, 다리)는 손댈 것 없이 그대로 출력.

## 4. 껍데기 시험 출력

속 빈 케이스만 먼저 뽑아 부품이 들어가는지 확인한다.
안 들어가면 `fit_internals.py` 의 `BACK_PANEL_DEPTH_MM` 을 키우고 다시 생성한다.

## 5. 출력 · 도색

[`painting.md`](painting.md) 참고. 아크릴은 도색이 끝난 뒤 붙인다.

## 6. 최종 조립

1. 디스플레이 보드를 마운트에 고정 (아크릴에서 1~2mm 띄운 상태)
2. 서보를 마운트에 넣고, 팔 축을 몸통에 관통시켜 양팔을 키 결합
3. **팔을 끼우기 전에** 서보를 `down` 위치로 보내고, 그 상태에서 팔이
   아래를 향하도록 각도를 맞춰 끼운다 (안 그러면 가동 범위가 어긋난다)
4. 버튼 모듈을 보스에 고정, 버튼 캡 끼우기
5. 케이블 2가닥을 하단 개구부로 빼기
6. 동작 재확인 → **그 다음에** 모든 듀폰 커넥터에 글루건
7. 뒤판 닫고 M2 나사 4개

## 7. 보내기 전 확인

- 48시간 연속 구동 (재부팅·메모리 누수 없는지)
- 들어서 흔들어도 접촉 불량이 없는지
- 폰 LTE(집 WiFi 아님)에서 원격 조작이 되는지
- 설정 포털이 열리는지 (현지에서 WiFi를 다시 잡아야 할 수 있다)
- 현지에서 볼 사람이 혼자 설정할 수 있도록 [`setup.md`](setup.md) 3번을 인쇄해 동봉

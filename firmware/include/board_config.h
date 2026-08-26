#pragma once
// ---------------------------------------------------------------------------
// 보드/배선 설정 — 부품을 바꾸면 이 파일만 고치면 된다.
// 실제 핀 번호는 구매한 보드의 데이터시트를 보고 채운다. (hardware/wiring.md 참고)
// ---------------------------------------------------------------------------

// --- 디스플레이 패널 --------------------------------------------------------
// 흑백 OLED (128x64, I2C). 색이 필요 없어서 컬러 LCD 대신 이걸 쓴다.
//   - 꺼진 픽셀이 완전한 검정(자체발광이라 백라이트 번짐이 없음) → 스모크 아크릴과 궁합이 좋다
//   - I2C라 배선이 4가닥(VCC/GND/SDA/SCL)뿐이다
//   - 일반 ESP32-S3 개발보드 + OLED 모듈 조합이라 USB 위치 문제(옆으로 튀어나옴)가 없다
//
// 주의: 128x64 OLED는 크기에 따라 드라이버 칩이 다르다.
//   - 0.96인치 128x64 → 거의 항상 SSD1306
//   - 1.3인치  128x64 → 거의 항상 SH1106 (내부 132x64 RAM에서 128x64만 잘라 씀)
// 두 드라이버는 명령셋이 달라서 잘못 고르면 화면이 안 켜지거나 밀려 나온다.
// 구매한 모듈 크기에 맞춰 아래 스위치를 켠다.
#define OLED_DRIVER_SH1106   1   // 1.3인치 모듈이면 1, 0.96인치(SSD1306)면 0

#define OLED_WIDTH           128
#define OLED_HEIGHT          64
#define OLED_I2C_ADDR        0x3C
#define PIN_OLED_SDA         8      // ESP32-S3 개발보드 기본 I2C 핀. 보드 실측 후 확정
#define PIN_OLED_SCL         9
#define OLED_I2C_FREQ        400000

// --- 얼굴 캔버스 배치 -------------------------------------------------------
// 논리 캔버스(64x32)를 패널에 정수배로 확대해 중앙에 놓는다. 128x64 화면에 정확히
// 2배로 꽉 찬다. FACE_SCALE 을 0으로 두면 패널 크기에 맞춰 자동 계산한다.
#define FACE_SCALE           0
#define FACE_NUDGE_X         0     // 케이스 조립 후 미세 정렬용 (픽셀 단위)
#define FACE_NUDGE_Y         0

// --- 서보 (양팔 공용) -------------------------------------------------------
#define PIN_SERVO            1
#define ARM_ANGLE_MIN        20    // 기구 간섭 방지용 하한
#define ARM_ANGLE_MAX        160   // 기구 간섭 방지용 상한
#define ARM_ANGLE_DOWN       30    // 팔 내림 (기본 자세)
#define ARM_ANGLE_UP         150   // 만세
#define ARM_DETACH_MS        500   // 정지 후 이 시간이 지나면 PWM 분리(지터/소음 제거)

// --- 버튼 2개 (모듈, INPUT_PULLUP, 누르면 LOW) ------------------------------
#define PIN_BTN_GREEN        2     // 수면모드 토글
#define PIN_BTN_BLUE         3     // 상태 화면 / 길게 누르면 WiFi 설정 포털
#define BTN_ACTIVE_LOW       true
#define BTN_DEBOUNCE_MS      30
#define BTN_LONGPRESS_MS     5000

// --- 기타 ------------------------------------------------------------------
#define DEFAULT_BRIGHTNESS   75    // OLED 명암(contrast) 기본값 (%)
#define SETUP_AP_SSID        "BMO-setup"
#define SETUP_AP_PASSWORD    "bmosetup"   // 8자 이상

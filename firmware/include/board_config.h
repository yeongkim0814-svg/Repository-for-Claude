#pragma once
// ---------------------------------------------------------------------------
// 보드/배선 설정 — 부품을 바꾸면 이 파일만 고치면 된다.
// 실제 핀 번호는 구매한 보드의 데이터시트를 보고 채운다. (hardware/wiring.md 참고)
// ---------------------------------------------------------------------------

// --- 디스플레이 패널 --------------------------------------------------------
// 일체형 보드(Waveshare ESP32-S3-LCD-1.47)의 기본값. 다른 패널이면 여기만 수정.
#define PANEL_ST7789        1     // 0이면 ST7735 계열로 전환 (display.h 참고)
#define PANEL_WIDTH         172
#define PANEL_HEIGHT        320
#define PANEL_OFFSET_X      34    // 172x320 패널은 보통 X 오프셋이 필요하다
#define PANEL_OFFSET_Y      0
#define PANEL_INVERT        true
#define PANEL_RGB_ORDER_BGR false

#define PIN_LCD_SCLK        40
#define PIN_LCD_MOSI        45
#define PIN_LCD_MISO        -1
#define PIN_LCD_DC          41
#define PIN_LCD_CS          42
#define PIN_LCD_RST         39
#define PIN_LCD_BL          48    // 백라이트 (PWM 밝기 조절)

// --- 얼굴 캔버스 배치 -------------------------------------------------------
// 논리 캔버스(64x48)를 패널에 정수배로 확대해 중앙에 놓는다.
// FACE_SCALE 을 0 으로 두면 패널 크기에 맞춰 자동 계산한다.
#define FACE_SCALE          0
#define FACE_NUDGE_X        0     // 케이스 조립 후 미세 정렬용 (픽셀 단위)
#define FACE_NUDGE_Y        0

// --- 서보 (양팔 공용) -------------------------------------------------------
#define PIN_SERVO           1
#define ARM_ANGLE_MIN       20    // 기구 간섭 방지용 하한
#define ARM_ANGLE_MAX       160   // 기구 간섭 방지용 상한
#define ARM_ANGLE_DOWN      30    // 팔 내림 (기본 자세)
#define ARM_ANGLE_UP        150   // 만세
#define ARM_DETACH_MS       500   // 정지 후 이 시간이 지나면 PWM 분리(지터/소음 제거)

// --- 버튼 2개 (모듈, INPUT_PULLUP, 누르면 LOW) ------------------------------
#define PIN_BTN_GREEN       2     // 수면모드 토글
#define PIN_BTN_BLUE        3     // 상태 화면 / 길게 누르면 WiFi 설정 포털
#define BTN_ACTIVE_LOW      true
#define BTN_DEBOUNCE_MS     30
#define BTN_LONGPRESS_MS    5000

// --- 기타 ------------------------------------------------------------------
#define DEFAULT_BRIGHTNESS  75    // 스모크 아크릴이 빛을 먹으므로 기본을 높게
#define SETUP_AP_SSID       "BMO-setup"
#define SETUP_AP_PASSWORD   "bmosetup"   // 8자 이상

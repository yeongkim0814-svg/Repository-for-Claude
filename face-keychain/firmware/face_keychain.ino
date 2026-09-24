/*
 * Face-Display Keychain
 * MCU: Arduino Pro Mini 3.3V/8MHz (ATmega328P) - or any 3.3V/5V AVR board with I2C
 * Display: SSD1306 OLED, I2C (VCC, GND, SCL, SDA)
 * Libraries: Adafruit_GFX, Adafruit_SSD1306 (Library Manager)
 *
 * Wiring:
 *   OLED VCC -> MCU 3.3V (direct from LiPo rail, no extra regulator)
 *   OLED GND -> MCU GND
 *   OLED SCL -> MCU A5 (Uno/Pro Mini hardware I2C clock)
 *   OLED SDA -> MCU A4 (Uno/Pro Mini hardware I2C data)
 *
 * Design notes: see ../DESIGN.md
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ---- Display geometry: set to match the actual panel ----
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64      // use 32 if the panel is 128x32
#define OLED_I2C_ADDR  0x3C    // common default; 0x3D on some modules

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ---- Face geometry (derived from screen size, not hardcoded) ----
const int16_t centerY   = SCREEN_HEIGHT / 2;
const int16_t eyeGap    = SCREEN_WIDTH / 4;          // distance from center to each eye
const int16_t leftEyeX  = SCREEN_WIDTH / 2 - eyeGap;
const int16_t rightEyeX = SCREEN_WIDTH / 2 + eyeGap;
const int16_t eyeW      = SCREEN_WIDTH / 6;
const int16_t eyeHFull  = SCREEN_HEIGHT / 3;

// ---- Expression state machine ----
enum Expression { NORMAL, BLINK, HAPPY, LOVE, SLEEPY };
Expression state = NORMAL;

unsigned long stateEnteredAt = 0;
unsigned long nextBlinkAt    = 0;
unsigned long nextMoodAt     = 0;
unsigned long lastActivityAt = 0;

const unsigned long BLINK_DURATION   = 140;    // ms, eye fully closed
const unsigned long HAPPY_DURATION   = 1600;
const unsigned long LOVE_DURATION    = 2200;
const unsigned long IDLE_TO_SLEEPY   = 30000UL; // 30s no mood change -> sleepy hint

void setup() {
  Wire.begin();
  // If the panel needs the internal charge pump (most SSD1306 modules do):
  display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR);
  display.setTextColor(SSD1306_WHITE);
  display.clearDisplay();
  display.display();

  randomSeed(analogRead(A0));   // floating pin noise as entropy source
  scheduleNextBlink();
  scheduleNextMood();
  lastActivityAt = millis();
}

void loop() {
  unsigned long now = millis();

  // --- state transitions (non-blocking) ---
  switch (state) {
    case NORMAL:
      if (now >= nextBlinkAt) {
        state = BLINK;
        stateEnteredAt = now;
      } else if (now >= nextMoodAt) {
        state = random(0, 2) == 0 ? HAPPY : LOVE;
        stateEnteredAt = now;
        lastActivityAt = now;
      } else if (now - lastActivityAt > IDLE_TO_SLEEPY) {
        state = SLEEPY;
        stateEnteredAt = now;
      }
      break;

    case BLINK:
      if (now - stateEnteredAt >= BLINK_DURATION) {
        state = NORMAL;
        scheduleNextBlink();
      }
      break;

    case HAPPY:
      if (now - stateEnteredAt >= HAPPY_DURATION) {
        state = NORMAL;
        scheduleNextMood();
      }
      break;

    case LOVE:
      if (now - stateEnteredAt >= LOVE_DURATION) {
        state = NORMAL;
        scheduleNextMood();
      }
      break;

    case SLEEPY:
      // wakes back up periodically just so it doesn't look frozen/dead
      if (now - stateEnteredAt >= 4000) {
        state = NORMAL;
        lastActivityAt = now;
        scheduleNextBlink();
      }
      break;
  }

  drawFace(state, now);
  delay(20); // ~50 fps cap; cheap way to bound I2C traffic without blocking logic above
}

void scheduleNextBlink() {
  nextBlinkAt = millis() + random(2500, 6000); // irregular interval, like a real blink
}

void scheduleNextMood() {
  nextMoodAt = millis() + random(8000, 15000);
}

// ---------------- drawing ----------------

void drawFace(Expression e, unsigned long now) {
  display.clearDisplay();

  switch (e) {
    case NORMAL:
      drawEyePair(eyeHFull);
      break;

    case BLINK: {
      // eyelid closing/opening approximated as a linear height scale over the blink window
      unsigned long t = now - stateEnteredAt;
      float phase = (float)t / BLINK_DURATION;              // 0..1
      float scale = 1.0f - sin(phase * PI);                 // 1 -> ~0 -> 1
      int16_t h = max((int16_t)1, (int16_t)(eyeHFull * scale));
      drawEyePair(h);
      break;
    }

    case HAPPY:
      drawHappyEyes();
      break;

    case LOVE:
      drawHeartEyes();
      break;

    case SLEEPY:
      drawEyePair(eyeHFull / 2);
      break;
  }

  display.display();
}

void drawEyePair(int16_t h) {
  int16_t y = centerY - h / 2;
  display.fillRoundRect(leftEyeX  - eyeW / 2, y, eyeW, h, 3, SSD1306_WHITE);
  display.fillRoundRect(rightEyeX - eyeW / 2, y, eyeW, h, 3, SSD1306_WHITE);
}

void drawHappyEyes() {
  // ^-shaped eyes: two line segments meeting at a peak, drawn thick via triangles
  drawArcEye(leftEyeX);
  drawArcEye(rightEyeX);
}

void drawArcEye(int16_t cx) {
  int16_t halfW = eyeW / 2;
  int16_t baseY = centerY + eyeHFull / 4;
  int16_t peakY = baseY - eyeHFull / 2;
  for (int8_t t = 0; t < 3; t++) { // thickness by stacking offset lines
    display.drawLine(cx - halfW, baseY + t, cx, peakY + t, SSD1306_WHITE);
    display.drawLine(cx, peakY + t, cx + halfW, baseY + t, SSD1306_WHITE);
  }
}

void drawHeartEyes() {
  drawHeart(leftEyeX, centerY);
  drawHeart(rightEyeX, centerY);
}

void drawHeart(int16_t cx, int16_t cy) {
  int16_t r = eyeW / 3;
  // two overlapping circles for the lobes + a triangle for the bottom point
  display.fillCircle(cx - r / 2, cy - r / 3, r, SSD1306_WHITE);
  display.fillCircle(cx + r / 2, cy - r / 3, r, SSD1306_WHITE);
  display.fillTriangle(cx - r - r / 2, cy - r / 4,
                        cx + r + r / 2, cy - r / 4,
                        cx, cy + r + r / 2,
                        SSD1306_WHITE);
}

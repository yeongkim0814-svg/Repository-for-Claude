#pragma once
#include <stdint.h>
#include "face_config.h"
#include "display.h"

// 64x48 논리 캔버스를 들고 있다가, 패널에 정수배로 확대해서 중앙에 밀어 넣는다.
// 패널 해상도가 달라도 배율과 오프셋이 자동 계산되므로 코드를 고칠 필요가 없다.
class Renderer {
public:
    void begin(BmoDisplay* lcd);

    // --- 논리 캔버스 그리기 ---
    void clear(uint8_t color = COL_BG);
    inline void px(int x, int y, uint8_t color) {
        if ((unsigned)x < FACE_W && (unsigned)y < FACE_H) _buf[y * FACE_W + x] = color;
    }
    void hline(int x, int y, int w, uint8_t color);
    void vline(int x, int y, int h, uint8_t color);
    void rect(int x, int y, int w, int h, uint8_t color);
    void ellipse(int cx, int cy, int rx, int ry, uint8_t color);
    // 5x7 도트 폰트 (ASCII 전용 — 상태 화면에서만 사용).
    // 한글은 웹앱에서 비트맵으로 만들어 보내므로 기기에 폰트가 필요 없다.
    void text(int x, int y, const char* s, uint8_t color);
    int  textWidth(const char* s) const;

    // 외부에서 받은 완성된 프레임(웹앱이 보낸 그림/글씨)을 그대로 얹는다.
    void blit(const uint8_t* pixels);

    uint8_t* buffer() { return _buf; }
    void push();                       // 변경분만 패널에 전송
    void setBrightness(uint8_t pct);
    uint8_t brightness() const { return _brightness; }

private:
    BmoDisplay* _lcd = nullptr;
    uint8_t  _buf[FACE_PIXELS];
    uint8_t  _shadow[FACE_PIXELS];     // 직전 프레임 — 바뀐 줄만 다시 그리기 위함
    bool     _shadowValid = false;
    int      _scale = 1, _originX = 0, _originY = 0;
    uint8_t  _brightness = DEFAULT_BRIGHTNESS;
    uint16_t _pal565[4];
    lgfx::LGFX_Sprite _row;            // 한 줄(확대된)만 담는 작은 스프라이트
};

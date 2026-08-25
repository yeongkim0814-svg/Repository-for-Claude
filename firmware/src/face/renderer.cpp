#include "renderer.h"
#include "font5x7.h"
#include <string.h>
#include <ctype.h>
#include <math.h>

static inline uint16_t to565(uint32_t rgb) {
    return ((rgb >> 8) & 0xF800) | ((rgb >> 5) & 0x07E0) | ((rgb >> 3) & 0x001F);
}

void Renderer::begin(BmoDisplay* lcd) {
    _lcd = lcd;
    for (int i = 0; i < 4; ++i) _pal565[i] = to565(FACE_PALETTE[i]);

    // 정수배 확대 — 도트가 뭉개지지 않게 반드시 정수배로만 키운다.
    int scale = FACE_SCALE;
    if (scale <= 0) {
        int sx = _lcd->width()  / FACE_W;
        int sy = _lcd->height() / FACE_H;
        scale = (sx < sy) ? sx : sy;
        if (scale < 1) scale = 1;
    }
    _scale   = scale;
    _originX = (_lcd->width()  - FACE_W * _scale) / 2 + FACE_NUDGE_X;
    _originY = (_lcd->height() - FACE_H * _scale) / 2 + FACE_NUDGE_Y;

    _row.setColorDepth(16);
    _row.createSprite(FACE_W * _scale, _scale);

    _lcd->fillScreen(0x0000);   // 얼굴 창 바깥은 검정 — 스모크 아크릴 뒤로 사라진다
    _shadowValid = false;
    clear();
    setBrightness(_brightness);
}

void Renderer::setBrightness(uint8_t pct) {
    if (pct > 100) pct = 100;
    _brightness = pct;
    if (_lcd) _lcd->setBrightness((uint8_t)(pct * 255 / 100));
}

void Renderer::clear(uint8_t color) { memset(_buf, color, FACE_PIXELS); }

void Renderer::hline(int x, int y, int w, uint8_t c) {
    for (int i = 0; i < w; ++i) px(x + i, y, c);
}
void Renderer::vline(int x, int y, int h, uint8_t c) {
    for (int i = 0; i < h; ++i) px(x, y + i, c);
}
void Renderer::rect(int x, int y, int w, int h, uint8_t c) {
    for (int j = 0; j < h; ++j) hline(x, y + j, w, c);
}

void Renderer::ellipse(int cx, int cy, int rx, int ry, uint8_t c) {
    if (rx <= 0 || ry <= 0) return;
    for (int y = -ry; y <= ry; ++y) {
        // 반지름 비율로 가로 폭을 구해 채운다 (작은 크기에서도 좌우 대칭이 유지된다)
        float t = 1.0f - (float)(y * y) / (float)(ry * ry);
        if (t < 0) continue;
        int w = (int)(rx * sqrtf(t) + 0.5f);
        hline(cx - w, cy + y, w * 2 + 1, c);
    }
}

int Renderer::textWidth(const char* s) const {
    int n = strlen(s);
    return n > 0 ? n * 6 - 1 : 0;   // 글자 5px + 자간 1px
}

void Renderer::text(int x, int y, const char* s, uint8_t c) {
    for (; *s; ++s) {
        char ch = toupper((unsigned char)*s);
        if (ch < 0x20 || ch > 0x5A) ch = ' ';
        const uint8_t* g = FONT5X7[ch - 0x20];
        for (int col = 0; col < 5; ++col) {
            uint8_t bits = g[col];
            for (int row = 0; row < 7; ++row)
                if (bits & (1 << row)) px(x + col, y + row, c);
        }
        x += 6;
    }
}

void Renderer::blit(const uint8_t* pixels) { memcpy(_buf, pixels, FACE_PIXELS); }

void Renderer::push() {
    if (!_lcd) return;
    uint16_t* line = (uint16_t*)_row.getBuffer();
    const int rowPixels = FACE_W * _scale;

    for (int y = 0; y < FACE_H; ++y) {
        const uint8_t* src = _buf + y * FACE_W;
        if (_shadowValid && memcmp(src, _shadow + y * FACE_W, FACE_W) == 0) continue;

        // 논리 픽셀 하나를 가로로 _scale 번 복제해 한 줄을 만든다
        for (int x = 0; x < FACE_W; ++x) {
            uint16_t col = _pal565[src[x] & 3];
            uint16_t* dst = line + x * _scale;
            for (int k = 0; k < _scale; ++k) dst[k] = col;
        }
        // 세로 확대는 같은 줄을 _scale 번 복사
        for (int k = 1; k < _scale; ++k)
            memcpy(line + k * rowPixels, line, rowPixels * sizeof(uint16_t));

        _row.pushSprite(_lcd, _originX, _originY + y * _scale);
    }
    memcpy(_shadow, _buf, FACE_PIXELS);
    _shadowValid = true;
}

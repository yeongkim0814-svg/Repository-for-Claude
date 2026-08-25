#include "animator.h"
#include <Arduino.h>
#include <string.h>
#include <strings.h>
#include <math.h>

// ---------------------------------------------------------------------------
// 내장 표정 프리셋
// ---------------------------------------------------------------------------
struct Preset { const char* name; FaceParams p; };

static const Preset PRESETS[] = {
    // name         eyeL  eyeR  curve  pX    pY    mW    mH    mouth          blush brow
    {"neutral",  {1.00f,1.00f,0.00f,0.0f,0.0f,1.00f,1.00f, MOUTH_SMILE,     0.0f, 0.0f}},
    {"happy",    {0.85f,0.85f,1.00f,0.0f,0.0f,1.20f,1.10f, MOUTH_GRIN,      1.0f, 0.0f}},
    {"love",     {0.90f,0.90f,1.00f,0.0f,0.0f,1.00f,1.00f, MOUTH_CAT,       1.0f, 0.0f}},
    {"wink",     {1.00f,0.05f,0.60f,0.0f,0.0f,1.10f,1.00f, MOUTH_SMILE,     1.0f, 0.0f}},
    {"surprise", {1.00f,1.00f,0.00f,0.0f,-0.2f,0.90f,1.30f, MOUTH_SMALL_O,  0.0f, 0.4f}},
    {"sad",      {0.70f,0.70f,0.00f,0.0f,0.3f,1.00f,1.00f, MOUTH_WAVY,      0.0f, 1.0f}},
    {"angry",    {0.80f,0.80f,0.00f,0.0f,0.0f,0.90f,1.00f, MOUTH_FLAT,      0.0f,-1.0f}},
    {"bored",    {0.55f,0.55f,0.00f,-0.6f,0.2f,0.90f,1.00f, MOUTH_FLAT,     0.0f, 0.3f}},
    {"sleepy",   {0.25f,0.25f,0.00f,0.0f,0.4f,0.80f,0.80f, MOUTH_FLAT,      0.0f, 0.5f}},
    {"cheeky",   {0.90f,0.90f,0.80f,0.4f,0.0f,1.10f,1.20f, MOUTH_OPEN,      1.0f, 0.0f}},
};
static const int PRESET_COUNT = sizeof(PRESETS) / sizeof(PRESETS[0]);

const char* const* Animator::presetNames(int& count) {
    static const char* names[PRESET_COUNT];
    for (int i = 0; i < PRESET_COUNT; ++i) names[i] = PRESETS[i].name;
    count = PRESET_COUNT;
    return names;
}

static inline float lerpf(float a, float b, float t) { return a + (b - a) * t; }
static inline float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
static inline float easeInOut(float t) { return t * t * (3.0f - 2.0f * t); }
static inline float frand() { return (float)random(0, 10000) / 10000.0f; }

// ---------------------------------------------------------------------------
void Animator::begin(Renderer* r) {
    _r = r;
    _from = _to = _cur = PRESETS[0].p;
    _blend = 1.0f;
    _lastMs = millis();
    _nextBlink   = _lastMs + 2000;
    _nextSaccade = _lastMs + 1500;
    _nextYawn    = _lastMs + 25000;
}

bool Animator::setExpression(const char* name) {
    for (int i = 0; i < PRESET_COUNT; ++i) {
        if (strcasecmp(name, PRESETS[i].name) == 0) {
            _from  = _cur;              // 지금 보이는 상태에서 출발해야 튀지 않는다
            _to    = PRESETS[i].p;
            _blend = 0.0f;
            _mode  = MODE_FACE;
            strncpy(_exprName, PRESETS[i].name, sizeof(_exprName) - 1);
            _exprName[sizeof(_exprName) - 1] = 0;
            return true;
        }
    }
    return false;
}

void Animator::showBitmap(const uint8_t* pixels) {
    memcpy(_bitmap, pixels, FACE_PIXELS);
    _mode = MODE_BITMAP;
    strncpy(_exprName, "custom", sizeof(_exprName) - 1);
}

void Animator::showStatus(const char* l1, const char* l2, const char* l3, uint32_t ms) {
    strncpy(_status[0], l1 ? l1 : "", sizeof(_status[0]) - 1);
    strncpy(_status[1], l2 ? l2 : "", sizeof(_status[1]) - 1);
    strncpy(_status[2], l3 ? l3 : "", sizeof(_status[2]) - 1);
    _statusUntil = millis() + ms;
}

void Animator::setSleeping(bool on) { _sleeping = on; }

// ---------------------------------------------------------------------------
void Animator::update(uint32_t now) {
    float dt = (now - _lastMs) / 1000.0f;
    if (dt > 0.2f) dt = 0.2f;              // 렉이 걸려도 애니메이션이 튀지 않게
    _lastMs = now;

    if (_blend < 1.0f) _blend = clampf(_blend + dt / 0.15f, 0.0f, 1.0f);
    _sleepPhase = clampf(_sleepPhase + (_sleeping ? dt / 1.2f : -dt / 0.4f), 0.0f, 1.0f);
    _breathe += dt;

    if (_statusUntil && now > _statusUntil) _statusUntil = 0;

    // --- 눈 깜빡임: 간격을 랜덤화하고, 가끔 두 번 연속으로 깜빡인다 ---
    if (_blinkPhase < 0.0f && now >= _nextBlink) {
        _blinkPhase = 0.0f;
        if (_blinkBurst == 0 && frand() < 0.20f) _blinkBurst = 1;
    }
    if (_blinkPhase >= 0.0f) {
        _blinkPhase += dt / 0.20f;
        if (_blinkPhase >= 1.0f) {
            _blinkPhase = -1.0f;
            if (_blinkBurst > 0) { _blinkBurst--; _nextBlink = now + 120; }
            else                 { _nextBlink = now + 2200 + (uint32_t)(frand() * 3600); }
        }
    }

    // --- 미세 시선 이동 ---
    if (now >= _nextSaccade) {
        _gazeTargetX = (frand() - 0.5f) * 0.9f;
        _gazeTargetY = (frand() - 0.5f) * 0.5f;
        _nextSaccade = now + 1500 + (uint32_t)(frand() * 3000);
    }
    _gazeX = lerpf(_gazeX, _gazeTargetX, clampf(dt / 0.12f, 0.0f, 1.0f));
    _gazeY = lerpf(_gazeY, _gazeTargetY, clampf(dt / 0.12f, 0.0f, 1.0f));

    // --- 하품 ---
    if (_yawnPhase < 0.0f && now >= _nextYawn) _yawnPhase = 0.0f;
    if (_yawnPhase >= 0.0f) {
        _yawnPhase += dt / 1.8f;
        if (_yawnPhase >= 1.0f) {
            _yawnPhase = -1.0f;
            _nextYawn = now + 20000 + (uint32_t)(frand() * 25000);
        }
    }
}

// 표정 위에 아이들 모션을 덮어씌운다 (표정 자체를 건드리지 않는다)
void Animator::applyIdle(uint32_t now, FaceParams& p) {
    p.pupilX = clampf(p.pupilX + _gazeX * 0.5f, -1.0f, 1.0f);
    p.pupilY = clampf(p.pupilY + _gazeY * 0.5f, -1.0f, 1.0f);

    if (_blinkPhase >= 0.0f) {
        // 감기는 건 빠르게, 뜨는 건 느리게 — 비대칭이라야 사람처럼 보인다
        float f = (_blinkPhase < 0.35f) ? (_blinkPhase / 0.35f)
                                        : (1.0f - (_blinkPhase - 0.35f) / 0.65f);
        f = clampf(f, 0.0f, 1.0f);
        p.eyeOpenL *= (1.0f - f);
        p.eyeOpenR *= (1.0f - f);
    }

    if (_yawnPhase >= 0.0f) {
        float y = sinf(_yawnPhase * (float)M_PI);        // 0 → 1 → 0
        p.mouth  = MOUTH_OPEN;
        p.mouthH = lerpf(p.mouthH, 2.0f, y);
        p.mouthW = lerpf(p.mouthW, 0.9f, y);
        p.eyeOpenL *= (1.0f - y * 0.85f);                 // 하품하면 눈이 찡그려진다
        p.eyeOpenR *= (1.0f - y * 0.85f);
    }

    if (_sleepPhase > 0.0f) {
        float s = easeInOut(_sleepPhase);
        p.eyeOpenL = lerpf(p.eyeOpenL, 0.0f, s);
        p.eyeOpenR = lerpf(p.eyeOpenR, 0.0f, s);
        p.eyeCurve = lerpf(p.eyeCurve, 0.0f, s);
        p.mouthW   = lerpf(p.mouthW, 0.5f, s);
        p.mouthH   = lerpf(p.mouthH, 0.5f, s);
        p.blush    = lerpf(p.blush, 0.0f, s);
        p.browTilt = lerpf(p.browTilt, 0.0f, s);
        if (s > 0.5f) p.mouth = MOUTH_FLAT;
    }
}

// ---------------------------------------------------------------------------
void Animator::render() {
    if (!_r) return;

    // 상태 화면(버튼으로 부른 정보)은 얼굴 위에 잠깐 덮인다
    if (_statusUntil) {
        _r->clear(COL_BG);
        for (int i = 0; i < 3; ++i) {
            if (!_status[i][0]) continue;
            int w = _r->textWidth(_status[i]);
            _r->text((FACE_W - w) / 2, 10 + i * 11, _status[i], COL_INK);
        }
        return;
    }

    if (_mode == MODE_BITMAP) { _r->blit(_bitmap); return; }

    // 표정 A → B 크로스 모프
    float t = easeInOut(_blend);
    FaceParams p;
    p.eyeOpenL = lerpf(_from.eyeOpenL, _to.eyeOpenL, t);
    p.eyeOpenR = lerpf(_from.eyeOpenR, _to.eyeOpenR, t);
    p.eyeCurve = lerpf(_from.eyeCurve, _to.eyeCurve, t);
    p.pupilX   = lerpf(_from.pupilX,   _to.pupilX,   t);
    p.pupilY   = lerpf(_from.pupilY,   _to.pupilY,   t);
    p.mouthW   = lerpf(_from.mouthW,   _to.mouthW,   t);
    p.mouthH   = lerpf(_from.mouthH,   _to.mouthH,   t);
    p.blush    = lerpf(_from.blush,    _to.blush,    t);
    p.browTilt = lerpf(_from.browTilt, _to.browTilt, t);
    p.mouth    = (t < 0.5f) ? _from.mouth : _to.mouth;
    _cur = p;                               // 다음 전환의 출발점

    applyIdle(_lastMs, p);
    drawFace(p);
}

// 포물선 호(弧). dir=+1 이면 가운데가 아래로 처진 웃는 입, -1 이면 반대.
void Animator::drawArc(int cx, int cy, int w, int h, int dir, uint8_t color) {
    if (w < 2) w = 2;
    for (int i = -w / 2; i <= w / 2; ++i) {
        float u = (float)i / (float)(w / 2);
        int y = cy + (int)lroundf(dir * h * (1.0f - u * u));
        _r->px(cx + i, y, color);
        _r->px(cx + i, y + 1, color);       // 2px 두께라야 도트가 또렷하다
    }
}

void Animator::drawFace(const FaceParams& p) {
    _r->clear(COL_BG);

    // 아주 느린 상하 "호흡" — 1px이지만 있고 없고의 차이가 크다
    int yOff = (int)lroundf(sinf(_breathe * 1.6f) * 1.0f);

    const int eyeCX[2] = {20, 44};
    const int eyeCY    = 19 + yOff;
    const float open[2] = {p.eyeOpenL, p.eyeOpenR};

    for (int i = 0; i < 2; ++i) {
        int gx = (int)lroundf(p.pupilX * 3.0f);
        int gy = (int)lroundf(p.pupilY * 2.0f);
        int cx = eyeCX[i] + gx;
        int cy = eyeCY + gy;
        float o = clampf(open[i], 0.0f, 1.4f);

        if (o < 0.12f) {
            // 감은 눈 — 살짝 웃는 곡선으로 그려야 "죽은 눈"처럼 안 보인다
            drawArc(cx, cy - 1, 13, 2, 1, COL_INK);
        } else if (p.eyeCurve > 0.5f) {
            // 웃는 눈 (^ ^)
            drawArc(cx, cy + 2, 13, 4, -1, COL_INK);
        } else {
            int ry = (int)lroundf(8.0f * o);
            if (ry < 1) ry = 1;
            _r->ellipse(cx, cy, 7, ry, COL_INK);
            if (o > 0.55f) {                       // 눈동자 하이라이트
                _r->rect(cx - 4, cy - ry + 2, 2, 2, COL_HI);
            }
        }

        if (fabsf(p.browTilt) > 0.15f) {
            int tilt = (int)lroundf(p.browTilt * 3.0f);
            int inner = (i == 0) ? +1 : -1;        // 안쪽 끝이 오르내린다
            int bx = eyeCX[i] - 6, by = eyeCY - 12;
            for (int k = 0; k < 13; ++k) {
                float u = (float)k / 12.0f;
                int yy = by + (int)lroundf((inner > 0 ? (1.0f - u) : u) * tilt);
                _r->px(bx + k, yy, COL_INK);
                _r->px(bx + k, yy + 1, COL_INK);
            }
        }
    }

    if (p.blush > 0.5f) {
        _r->ellipse(8,  30 + yOff, 4, 2, COL_BLUSH);
        _r->ellipse(55, 30 + yOff, 4, 2, COL_BLUSH);
    }

    const int mcx = 32;
    const int mcy = 34 + yOff;
    int mw = (int)lroundf(14 * clampf(p.mouthW, 0.2f, 2.5f));
    int mh = (int)lroundf(5  * clampf(p.mouthH, 0.2f, 2.5f));

    switch (p.mouth) {
        case MOUTH_SMILE:   drawArc(mcx, mcy - 2, mw, mh, 1, COL_INK); break;
        case MOUTH_FLAT:    _r->rect(mcx - mw / 2, mcy, mw, 2, COL_INK); break;
        case MOUTH_OPEN:    _r->ellipse(mcx, mcy + 1, mw / 2, mh, COL_INK); break;
        case MOUTH_SMALL_O: _r->ellipse(mcx, mcy + 1, 3, (mh < 3 ? 3 : mh), COL_INK); break;
        case MOUTH_WAVY:
            for (int i = -mw / 2; i <= mw / 2; ++i) {
                int y = mcy + (int)lroundf(sinf(i * 0.9f) * 1.5f);
                _r->px(mcx + i, y, COL_INK);
                _r->px(mcx + i, y + 1, COL_INK);
            }
            break;
        case MOUTH_GRIN:
            // 활짝 웃는 입 — 호 안쪽을 채운다
            for (int i = -mw / 2; i <= mw / 2; ++i) {
                float u = (float)i / (float)(mw / 2);
                int bottom = mcy + (int)lroundf(mh * (1.0f - u * u));
                _r->vline(mcx + i, mcy - 2, bottom - mcy + 3, COL_INK);
            }
            break;
        case MOUTH_CAT:     // ω 모양
            drawArc(mcx - mw / 4, mcy, mw / 2, mh - 1, 1, COL_INK);
            drawArc(mcx + mw / 4, mcy, mw / 2, mh - 1, 1, COL_INK);
            break;
    }

    if (_sleepPhase > 0.8f) {                      // 수면모드일 때 떠오르는 Z
        int t = (int)(_breathe * 2.0f) % 3;
        _r->text(48, 8 - t, "Z", COL_INK);
    }
}

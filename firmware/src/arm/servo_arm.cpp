#include "servo_arm.h"
#include <Arduino.h>
#include <string.h>
#include <strings.h>

static inline int clampAngle(int a) {
    if (a < ARM_ANGLE_MIN) return ARM_ANGLE_MIN;
    if (a > ARM_ANGLE_MAX) return ARM_ANGLE_MAX;
    return a;
}
static inline float easeInOut(float t) { return t * t * (3.0f - 2.0f * t); }

void ServoArm::begin() {
    ESP32PWM::allocateTimer(0);
    _servo.setPeriodHertz(50);
    _cur = _startAngle = _target = ARM_ANGLE_DOWN;
    attachIfNeeded();
    _servo.write((int)_cur);
    _idleSince = millis();
}

void ServoArm::attachIfNeeded() {
    if (!_attached) {
        _servo.attach(PIN_SERVO, 500, 2400);
        _attached = true;
    }
}

void ServoArm::moveTo(int angle, uint32_t durationMs) {
    _target     = clampAngle(angle);
    _startAngle = _cur;
    _moveStart  = millis();
    _moveDur    = durationMs ? durationMs : 1;
    attachIfNeeded();
}

bool ServoArm::preset(const char* name) {
    _waving = false;
    if (!strcasecmp(name, "down"))      { moveTo(ARM_ANGLE_DOWN, 700); }
    else if (!strcasecmp(name, "up"))   { moveTo(ARM_ANGLE_UP,   700); }
    else if (!strcasecmp(name, "hug"))  { moveTo((ARM_ANGLE_DOWN + ARM_ANGLE_UP) / 2, 800); }
    else if (!strcasecmp(name, "wave")) {
        _waving = true; _waveCount = 6; _waveHigh = true;
        moveTo(ARM_ANGLE_UP, 400);
    } else return false;

    strncpy(_preset, name, sizeof(_preset) - 1);
    _preset[sizeof(_preset) - 1] = 0;
    return true;
}

void ServoArm::update(uint32_t now) {
    if (_moveDur) {
        float t = (float)(now - _moveStart) / (float)_moveDur;
        if (t >= 1.0f) {
            t = 1.0f;
            _moveDur = 0;
            _idleSince = now;

            if (_waving && _waveCount > 0) {     // 손 흔들기 왕복
                _waveCount--;
                _waveHigh = !_waveHigh;
                int mid = (ARM_ANGLE_DOWN + ARM_ANGLE_UP) / 2;
                moveTo(_waveHigh ? ARM_ANGLE_UP : mid, 300);
            } else if (_waving) {
                _waving = false;
                moveTo(ARM_ANGLE_DOWN, 600);
            }
        }
        // 이징 없이 선형으로 움직이면 장난감처럼 뚝뚝 끊긴다
        _cur = _startAngle + (_target - _startAngle) * easeInOut(t);
        attachIfNeeded();
        _servo.write((int)(_cur + 0.5f));
        return;
    }

    // 멈춘 뒤에는 PWM을 끊는다 — 지터/소음/발열이 사라진다
    if (_attached && (now - _idleSince) > ARM_DETACH_MS) {
        _servo.detach();
        _attached = false;
    }
}

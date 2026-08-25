#pragma once
#include <stdint.h>
#include <ESP32Servo.h>
#include "board_config.h"

// 서보 1개가 몸통을 가로지르는 축을 돌리고, 양팔이 그 축에 함께 물려 있다.
// 따라서 두 팔은 항상 같은 각도로 움직인다(설계 의도).
class ServoArm {
public:
    void begin();
    void update(uint32_t now);

    void moveTo(int angle, uint32_t durationMs = 600);
    bool preset(const char* name);          // down / up / wave / hug
    int  angle() const { return (int)(_cur + 0.5f); }
    const char* lastPreset() const { return _preset; }

private:
    void attachIfNeeded();

    Servo    _servo;
    bool     _attached = false;
    float    _cur = ARM_ANGLE_DOWN;
    float    _startAngle = ARM_ANGLE_DOWN;
    int      _target = ARM_ANGLE_DOWN;
    uint32_t _moveStart = 0, _moveDur = 0;
    uint32_t _idleSince = 0;
    char     _preset[8] = "down";

    // wave(손 흔들기) 반복용
    bool     _waving = false;
    uint8_t  _waveCount = 0;
    bool     _waveHigh = false;
};

#include "buttons.h"
#include <Arduino.h>

void Buttons::begin() {
    _green.pin = PIN_BTN_GREEN;
    _blue.pin  = PIN_BTN_BLUE;
    pinMode(_green.pin, BTN_ACTIVE_LOW ? INPUT_PULLUP : INPUT);
    pinMode(_blue.pin,  BTN_ACTIVE_LOW ? INPUT_PULLUP : INPUT);
}

bool Buttons::read(uint8_t pin) {
    int v = digitalRead(pin);
    return BTN_ACTIVE_LOW ? (v == LOW) : (v == HIGH);
}

ButtonEvent Buttons::poll(uint32_t now) {
    ButtonEvent ev = BTN_NONE;
    Btn* list[2] = {&_green, &_blue};

    for (int i = 0; i < 2; ++i) {
        Btn* b = list[i];
        bool raw = read(b->pin);
        if (raw != b->raw) { b->raw = raw; b->changed = now; }        // 채터링 시작
        if ((now - b->changed) < BTN_DEBOUNCE_MS) continue;           // 아직 흔들리는 중

        if (raw != b->stable) {
            b->stable = raw;
            if (raw) {                       // 눌림 시작
                b->pressed = now;
                b->longFired = false;
            } else if (!b->longFired) {      // 뗌 → 짧게 누름 확정
                ev = (b == &_green) ? BTN_GREEN_SHORT : BTN_BLUE_SHORT;
            }
        }

        // 파란 버튼만 길게 누르기를 쓴다 (손을 떼기 전에 즉시 발동)
        if (b == &_blue && b->stable && !b->longFired &&
            (now - b->pressed) >= BTN_LONGPRESS_MS) {
            b->longFired = true;
            ev = BTN_BLUE_LONG;
        }
    }
    return ev;
}

#pragma once
#include <stdint.h>
#include "board_config.h"

// 실제로 배선하는 버튼은 2개뿐이다. 나머지 BMO 버튼은 모양만 있는 더미다.
// (케이스에는 모든 버튼 자리에 스위치 보스를 파두므로 나중에 추가할 수 있다)
enum ButtonEvent : uint8_t {
    BTN_NONE = 0,
    BTN_GREEN_SHORT,     // 수면모드 토글
    BTN_BLUE_SHORT,      // 상태 화면
    BTN_BLUE_LONG,       // WiFi 설정 포털 재진입
};

class Buttons {
public:
    void begin();
    ButtonEvent poll(uint32_t now);

private:
    struct Btn {
        uint8_t  pin;
        bool     stable   = false;   // true = 눌림
        bool     raw      = false;
        uint32_t changed  = 0;
        uint32_t pressed  = 0;
        bool     longFired = false;
    };
    Btn _green, _blue;
    bool read(uint8_t pin);
};

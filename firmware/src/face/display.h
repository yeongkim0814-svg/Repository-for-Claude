#pragma once
#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include "board_config.h"

// 흑백 OLED (128x64, I2C). LovyanGFX가 색상 API를 그대로 받아서
// 내부적으로 밝기 임계값으로 켬/끔을 판정해주므로, renderer.cpp 는 컬러 패널을
// 쓸 때와 코드가 거의 같다.
// 드라이버 칩(SSD1306 / SH1106)은 board_config.h 의 OLED_DRIVER_SH1106 으로 고른다.
class BmoDisplay : public lgfx::LGFX_Device {
#if OLED_DRIVER_SH1106
    lgfx::Panel_SH1106  _panel;
#else
    lgfx::Panel_SSD1306 _panel;
#endif
    lgfx::Bus_I2C       _bus;

public:
    BmoDisplay() {
        {
            auto cfg = _bus.config();
            cfg.i2c_port    = 0;
            cfg.freq_write  = OLED_I2C_FREQ;
            cfg.freq_read   = OLED_I2C_FREQ;
            cfg.pin_sda     = PIN_OLED_SDA;
            cfg.pin_scl     = PIN_OLED_SCL;
            cfg.i2c_addr    = OLED_I2C_ADDR;
            _bus.config(cfg);
            _panel.setBus(&_bus);
        }
        {
            auto cfg = _panel.config();
            cfg.panel_width  = OLED_WIDTH;
            cfg.panel_height = OLED_HEIGHT;
            cfg.offset_x     = 0;
            cfg.offset_y     = 0;
            _panel.config(cfg);
        }
        setPanel(&_panel);
    }
};

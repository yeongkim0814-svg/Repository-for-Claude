#pragma once
#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include "board_config.h"

// 보드에 따라 달라지는 부분을 여기서 한 번만 기술한다.
// 패널/핀을 바꾸려면 include/board_config.h 만 수정하면 된다.
class BmoDisplay : public lgfx::LGFX_Device {
    lgfx::Panel_ST7789 _panel;
    lgfx::Bus_SPI      _bus;
    lgfx::Light_PWM    _light;

public:
    BmoDisplay() {
        {
            auto cfg = _bus.config();
            cfg.spi_host    = SPI2_HOST;
            cfg.spi_mode    = 0;
            cfg.freq_write  = 40000000;
            cfg.freq_read   = 16000000;
            cfg.pin_sclk    = PIN_LCD_SCLK;
            cfg.pin_mosi    = PIN_LCD_MOSI;
            cfg.pin_miso    = PIN_LCD_MISO;
            cfg.pin_dc      = PIN_LCD_DC;
            _bus.config(cfg);
            _panel.setBus(&_bus);
        }
        {
            auto cfg = _panel.config();
            cfg.pin_cs         = PIN_LCD_CS;
            cfg.pin_rst        = PIN_LCD_RST;
            cfg.panel_width    = PANEL_WIDTH;
            cfg.panel_height   = PANEL_HEIGHT;
            cfg.offset_x       = PANEL_OFFSET_X;
            cfg.offset_y       = PANEL_OFFSET_Y;
            cfg.invert         = PANEL_INVERT;
            cfg.rgb_order      = PANEL_RGB_ORDER_BGR;
            _panel.config(cfg);
        }
        {
            auto cfg = _light.config();
            cfg.pin_bl      = PIN_LCD_BL;
            cfg.freq        = 12000;
            cfg.pwm_channel = 7;
            _light.config(cfg);
            _panel.setLight(&_light);
        }
        setPanel(&_panel);
    }
};

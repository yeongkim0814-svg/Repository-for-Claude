#pragma once
#include <stdint.h>

// 논리 캔버스 해상도. 이 값이 웹앱의 도트 캔버스, MQTT 비트맵 포맷과 일치해야 한다.
constexpr int FACE_W = 64;
constexpr int FACE_H = 48;
constexpr int FACE_PIXELS = FACE_W * FACE_H;   // 3072

// 4색 팔레트 (RGB888). 인덱스 0~3 이 그대로 2비트 값이 된다.
// 0 = 배경(민트), 1 = 이목구비(진남색), 2 = 볼(분홍), 3 = 하이라이트(흰색)
constexpr uint32_t FACE_PALETTE[4] = {
    0x3FBFA0,  // BMO 화면 민트
    0x122B3D,  // 진한 남색
    0xE58BA0,  // 볼 분홍
    0xF2FBF6,  // 거의 흰색
};

enum : uint8_t { COL_BG = 0, COL_INK = 1, COL_BLUSH = 2, COL_HI = 3 };

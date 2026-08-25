#pragma once
#include <stdint.h>

// 논리 캔버스 해상도. 128x64 OLED에 정확히 2배로 꽉 차도록 2:1 비율로 잡았다.
// 이 값이 웹앱의 도트 캔버스, MQTT 비트맵 포맷과 일치해야 한다.
constexpr int FACE_W = 64;
constexpr int FACE_H = 32;
constexpr int FACE_PIXELS = FACE_W * FACE_H;   // 2048

// 흑백 OLED라 실제로는 켬/끔 2색뿐이다. 다만 렌더러·애니메이터 코드가
// "팔레트 인덱스 0~3" 을 그대로 쓰므로 배열은 4칸을 유지하고, 1~3번을
// 전부 켬(흰색)으로 겹쳐 둔다. 볼(blush)은 같은 색이 되는 대신
// animator.cpp 에서 점무늬(디더링)로 그려 배경과 구별한다.
constexpr uint32_t FACE_PALETTE[4] = {
    0x000000,  // 0: 꺼짐 (배경)
    0xFFFFFF,  // 1: 켜짐 (이목구비)
    0xFFFFFF,  // 2: 켜짐 (볼 — 점무늬로 그려 구분)
    0xFFFFFF,  // 3: 켜짐 (하이라이트)
};

enum : uint8_t { COL_BG = 0, COL_INK = 1, COL_BLUSH = 2, COL_HI = 3 };

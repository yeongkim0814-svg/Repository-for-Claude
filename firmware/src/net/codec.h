#pragma once
#include <stdint.h>
#include <stddef.h>

// 웹앱 → BMO 로 그림을 보낼 때 쓰는 포맷.
//   1) 64x32 캔버스의 각 픽셀을 팔레트 인덱스(0~3)로 만든다
//   2) RLE: 바이트 하나가 ((길이-1) << 2) | 인덱스,  길이는 1~64
//   3) 그 바이트열을 base64 로 감싼다
// 보통 100~400바이트로 줄어들어 MQTT 한 메시지에 넉넉히 들어간다.
// webapp/encode.js 의 인코더와 짝을 이룬다.

// 성공하면 true. out 은 최소 FACE_PIXELS 바이트여야 한다.
bool decodeFaceBitmap(const char* b64, uint8_t* out, size_t outLen);

#include "codec.h"
#include <string.h>

static int b64val(char c) {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '+') return 62;
    if (c == '/') return 63;
    return -1;                       // '=' 나 공백 등은 건너뛴다
}

bool decodeFaceBitmap(const char* b64, uint8_t* out, size_t outLen) {
    if (!b64 || !out) return false;

    size_t written = 0;
    uint32_t acc = 0;
    int bits = 0;

    for (const char* p = b64; *p; ++p) {
        int v = b64val(*p);
        if (v < 0) continue;
        acc = (acc << 6) | (uint32_t)v;
        bits += 6;
        if (bits < 8) continue;

        bits -= 8;
        uint8_t byte = (uint8_t)((acc >> bits) & 0xFF);

        uint8_t color = byte & 0x03;
        int     count = (byte >> 2) + 1;
        if (written + count > outLen) return false;      // 데이터가 깨졌다
        memset(out + written, color, count);
        written += count;
    }
    return written == outLen;        // 캔버스를 정확히 다 채워야 정상
}

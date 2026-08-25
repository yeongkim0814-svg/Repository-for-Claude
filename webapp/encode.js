// 64x32 팔레트 인덱스 배열 <-> base64 RLE
// firmware/src/net/codec.cpp 의 디코더와 짝을 이룬다. 한쪽을 고치면 반대쪽도 고쳐야 한다.
// 128x64 흑백 OLED에 정확히 2배로 꽉 차도록 2:1 비율로 잡았다.
export const FACE_W = 64;
export const FACE_H = 32;
export const FACE_PIXELS = FACE_W * FACE_H;

// 흑백 OLED라 실제로는 켬/끔 2색뿐이다. 그림 그리기 UI에서는 구분이 되도록
// 화면에서만 다른 색으로 보여주고(볼=회색 점무늬, 하이라이트=옅은 회색),
// 전송할 때는 펌웨어의 face_config.h 와 동일하게 인덱스 그대로 나간다.
export const PALETTE = ['#000000', '#FFFFFF', '#9CA3AF', '#D1D5DB'];
export const PALETTE_NAMES = ['꺼짐(배경)', '켜짐(이목구비)', '볼(점무늬)', '하이라이트'];

export function encodeRLE(indices) {
  if (indices.length !== FACE_PIXELS) throw new Error('캔버스 크기가 맞지 않습니다');
  const bytes = [];
  let run = 1;
  for (let i = 1; i <= indices.length; i++) {
    // 길이는 최대 64 (6비트) — 그 이상은 끊어서 다음 바이트로 넘긴다
    if (i < indices.length && indices[i] === indices[i - 1] && run < 64) {
      run++;
      continue;
    }
    bytes.push(((run - 1) << 2) | (indices[i - 1] & 3));
    run = 1;
  }
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function estimateBytes(indices) {
  return encodeRLE(indices).length;
}

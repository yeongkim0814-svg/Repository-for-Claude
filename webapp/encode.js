// 64x48 팔레트 인덱스 배열 <-> base64 RLE
// firmware/src/net/codec.cpp 의 디코더와 짝을 이룬다. 한쪽을 고치면 반대쪽도 고쳐야 한다.
export const FACE_W = 64;
export const FACE_H = 48;
export const FACE_PIXELS = FACE_W * FACE_H;

// BMO 화면 팔레트 (펌웨어 face_config.h 와 동일해야 한다)
export const PALETTE = ['#3FBFA0', '#122B3D', '#E58BA0', '#F2FBF6'];
export const PALETTE_NAMES = ['배경', '이목구비', '볼', '하이라이트'];

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

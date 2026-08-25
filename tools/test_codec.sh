#!/usr/bin/env bash
# 웹앱의 JS 인코더와 펌웨어의 C++ 디코더가 실제로 같은 포맷을 쓰는지 검증한다.
# 둘 중 한쪽만 고치면 BMO 화면에 쓰레기가 뜨므로, 포맷을 건드릴 때마다 돌린다.
#
#   ./tools/test_codec.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# 펌웨어 디코더를 PC에서 그대로 컴파일한다 (Arduino 의존성이 없는 순수 C++)
cat > "$TMP/host.cpp" <<CPP
#include "$PWD/firmware/src/net/codec.cpp"
#include <cstdio>
int main(int argc, char** argv) {
    static uint8_t out[2048];
    if (!decodeFaceBitmap(argv[1], out, 2048)) { printf("DECODE_FAIL\n"); return 1; }
    unsigned long sum = 0;
    for (int i = 0; i < 2048; ++i) sum += (unsigned long)out[i] * (i + 1);
    printf("%lu\n", sum);
    return 0;
}
CPP
g++ -O1 -o "$TMP/host" "$TMP/host.cpp"

cat > "$TMP/run.mjs" <<JS
import { encodeRLE, FACE_PIXELS } from '$PWD/webapp/encode.js';
import { execFileSync } from 'child_process';

const cases = {
  '전부 배경':   new Uint8Array(FACE_PIXELS),
  '줄무늬':      new Uint8Array(FACE_PIXELS).map((_, i) => (i >> 4) & 3),
  '랜덤 노이즈': new Uint8Array(FACE_PIXELS).map(() => Math.floor(Math.random() * 4)),
  '긴 연속':     (() => { const a = new Uint8Array(FACE_PIXELS); a.fill(2, 0, 900); return a; })(),
};

let fail = 0;
for (const [name, arr] of Object.entries(cases)) {
  const b64 = encodeRLE(arr);
  const expect = arr.reduce((s, v, i) => s + v * (i + 1), 0);
  let got;
  try { got = +execFileSync('$TMP/host', [b64]).toString().trim(); } catch { got = NaN; }
  const ok = got === expect;
  if (!ok) fail++;
  console.log(\`\${ok ? 'PASS' : 'FAIL'}  \${name.padEnd(12)} base64=\${String(b64.length).padStart(5)}B\`);
}

// 깨진 데이터는 반드시 거부해야 한다 (화면에 쓰레기를 그리지 않도록)
try {
  execFileSync('$TMP/host', ['AAAA']);
  console.log('FAIL  잘린 데이터를 통과시킴');
  fail++;
} catch {
  console.log('PASS  잘린 데이터 거부');
}

console.log(fail ? \`\n\${fail}건 실패\` : '\n전부 통과');
process.exit(fail ? 1 : 0);
JS
node "$TMP/run.mjs"

// 64x32 도트 캔버스. 손가락/S펜/마우스로 그리고, 글씨를 도트로 굽는다.
// 한글은 여기서 브라우저 폰트로 래스터화하므로 BMO 안에 한글 폰트가 필요 없다.
import { FACE_W, FACE_H, FACE_PIXELS, PALETTE } from './encode.js';

export class DotCanvas {
  constructor(canvasEl) {
    this.el = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.px = new Uint8Array(FACE_PIXELS);   // 팔레트 인덱스
    this.color = 1;
    this.brush = 1;
    this.undoStack = [];
    this.drawing = false;
    this._bindPointer();
    this.resize();
    this.clear();
  }

  resize() {
    const cssW = this.el.clientWidth || 320;
    this.scale = Math.max(1, Math.floor(cssW / FACE_W));
    const dpr = window.devicePixelRatio || 1;
    this.el.width  = FACE_W * this.scale * dpr;
    this.el.height = FACE_H * this.scale * dpr;
    this.el.style.height = (FACE_H * this.scale) + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.render();
  }

  clear(index = 0) {
    this.pushUndo();
    this.px.fill(index);
    this.render();
  }

  pushUndo() {
    this.undoStack.push(this.px.slice());
    if (this.undoStack.length > 30) this.undoStack.shift();
  }

  undo() {
    const prev = this.undoStack.pop();
    if (prev) { this.px = prev; this.render(); }
  }

  set(x, y, index) {
    const r = this.brush - 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= FACE_W || ny >= FACE_H) continue;
        this.px[ny * FACE_W + nx] = index;
      }
    }
  }

  load(indices) { this.pushUndo(); this.px.set(indices); this.render(); }

  render() {
    const s = this.scale;
    const ctx = this.ctx;
    for (let y = 0; y < FACE_H; y++) {
      for (let x = 0; x < FACE_W; x++) {
        ctx.fillStyle = PALETTE[this.px[y * FACE_W + x]];
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    // 도트 격자 — 실제 BMO 화면의 픽셀 느낌을 미리 보여준다
    if (s >= 4) {
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= FACE_W; x++) { ctx.moveTo(x * s + .5, 0); ctx.lineTo(x * s + .5, FACE_H * s); }
      for (let y = 0; y <= FACE_H; y++) { ctx.moveTo(0, y * s + .5); ctx.lineTo(FACE_W * s, y * s + .5); }
      ctx.stroke();
    }
  }

  _pos(ev) {
    const r = this.el.getBoundingClientRect();
    return {
      x: Math.floor((ev.clientX - r.left) / (r.width  / FACE_W)),
      y: Math.floor((ev.clientY - r.top)  / (r.height / FACE_H)),
    };
  }

  _bindPointer() {
    const down = (ev) => {
      ev.preventDefault();
      this.pushUndo();
      this.drawing = true;
      this.el.setPointerCapture(ev.pointerId);
      const p = this._pos(ev);
      this.last = p;
      this.set(p.x, p.y, this.color);
      this.render();
    };
    const move = (ev) => {
      if (!this.drawing) return;
      const p = this._pos(ev);
      // 빠르게 그으면 점이 끊기므로 직전 점과 선으로 이어준다
      if (this.last) this._line(this.last, p);
      this.last = p;
      this.render();
    };
    const up = (ev) => { this.drawing = false; this.last = null; };

    this.el.addEventListener('pointerdown', down);
    this.el.addEventListener('pointermove', move);
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
    this.el.style.touchAction = 'none';
  }

  _line(a, b) {
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
    let err = dx - dy, x = a.x, y = a.y;
    for (;;) {
      this.set(x, y, this.color);
      if (x === b.x && y === b.y) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 <  dx) { err += dx; y += sy; }
    }
  }
}

// 글씨를 64x32 도트로 굽는다. 한글/이모지 모두 브라우저 폰트로 처리된다.
export function rasterizeText(text, { ink = 1, bg = 0 } = {}) {
  const off = document.createElement('canvas');
  off.width = FACE_W; off.height = FACE_H;
  const c = off.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, FACE_W, FACE_H);
  c.fillStyle = '#000';
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  const lines = text.split('\n').flatMap(l => wrap(c, l));
  // 줄 수에 맞춰 글자 크기를 줄인다 (작은 캔버스라 여백을 아껴야 읽힌다)
  let size = Math.min(20, Math.floor((FACE_H - 4) / Math.max(1, lines.length)) + 2);
  for (; size >= 6; size--) {
    c.font = `bold ${size}px "Malgun Gothic", system-ui, sans-serif`;
    if (lines.every(l => c.measureText(l).width <= FACE_W - 2)) break;
  }
  c.font = `bold ${size}px "Malgun Gothic", system-ui, sans-serif`;

  const lh = size + 1;
  const startY = FACE_H / 2 - (lines.length - 1) * lh / 2;
  lines.forEach((l, i) => c.fillText(l, FACE_W / 2, startY + i * lh));

  // 임계값으로 2치화 — 안티에일리어싱을 없애야 도트답게 보인다
  const img = c.getImageData(0, 0, FACE_W, FACE_H).data;
  const out = new Uint8Array(FACE_PIXELS);
  for (let i = 0; i < FACE_PIXELS; i++) {
    out[i] = img[i * 4] < 140 ? ink : bg;
  }
  return out;

  function wrap(ctx, line) {
    if (!line) return [''];
    ctx.font = 'bold 12px system-ui';
    const parts = [];
    let cur = '';
    for (const ch of line) {
      if (ctx.measureText(cur + ch).width > FACE_W - 4 && cur) { parts.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) parts.push(cur);
    return parts;
  }
}

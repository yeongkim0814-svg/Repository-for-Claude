/**
 * 칠판 — CanvasTexture 기반.
 * Phase 0에서는 장식만 그린다. 다음 Phase에서 측정값·수식을 쓰려면:
 *
 *   ctx.blackboard.draw((g, w, h) => {
 *     g.fillText(`a = ${a.toFixed(3)} m/s²`, 60, 200);
 *   });
 *   // 또는 간단히
 *   ctx.blackboard.writeLines(['T = 2π√(L/g)', `L = ${L} m`]);
 *
 * draw()는 배경(칠판 질감)을 다시 칠한 뒤 콜백을 호출하고 텍스처를 갱신한다.
 */
import * as THREE from 'three';
import { PALETTE, toy, rbox } from './style.js';

export class Blackboard {
  constructor(width = 4, height = 1.6) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2048;
    this.canvas.height = Math.round((2048 * height) / width);
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    const frame = new THREE.Mesh(rbox(width + 0.2, height + 0.2, 0.07, 0.035), toy(PALETTE.wood));
    const tray = new THREE.Mesh(rbox(width * 0.9, 0.05, 0.12, 0.02), toy(PALETTE.wood));
    tray.position.set(0, -height / 2 - 0.08, 0.06);
    const chalks = [PALETTE.white, PALETTE.yellow, PALETTE.red, PALETTE.blue].map((c, i) => {
      const ch = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.06, 4, 8), toy(c));
      ch.rotation.z = Math.PI / 2;
      ch.position.set(-1.2 + i * 0.14, -height / 2 - 0.04, 0.07);
      return ch;
    });
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.95 }),
    );
    board.position.z = 0.036;
    this.mesh = new THREE.Group();
    this.mesh.add(frame, board, tray, ...chalks);
    this.mesh.userData.targetKind = 'static';

    this.defaultDraw = (g, w, h) => {
      g.font = '110px Jua, "Comic Sans MS", cursive, sans-serif';
      g.fillText('가상 물리 실험실', 90, 170);
      g.font = '70px Jua, "Comic Sans MS", cursive, sans-serif';
      g.fillText('F = ma', 110, 330);
      g.fillText('∮ E·dA = Q / ε₀', 110, 450);
      g.fillText('d sinθ = mλ', 110, 570);
      g.fillText('ΔU = Q − W', 1100, 330);
      g.globalAlpha = 0.35;
      g.fillText('Phase 1 — optics', w - 700, h - 70);
    };
    this.reset();
  }

  /** 기본(장식) 화면으로 되돌린다 */
  reset() {
    this.draw(this.defaultDraw);
  }

  /** 배경을 다시 칠하고 drawFn(g, w, h)로 내용을 그린다 (분필 스타일 기본값 설정됨). */
  draw(drawFn) {
    const { g, canvas } = this;
    const w = canvas.width, h = canvas.height;
    g.globalAlpha = 1;
    g.fillStyle = '#4a6b62'; // 부드러운 세이지 그린
    g.fillRect(0, 0, w, h);
    // 분필 자국 질감
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 40, 1 + Math.random() * 3);
    }
    g.fillStyle = 'rgba(240,240,230,0.92)';
    g.strokeStyle = 'rgba(240,240,230,0.92)';
    g.textBaseline = 'alphabetic';
    drawFn?.(g, w, h);
    this.texture.needsUpdate = true;
  }

  writeLines(lines, { x = 90, y = 160, size = 80, gap = 1.35 } = {}) {
    this.draw((g) => {
      g.font = `${size}px Jua, "Comic Sans MS", cursive, sans-serif`;
      lines.forEach((l, i) => g.fillText(l, x, y + i * size * gap));
    });
  }
}

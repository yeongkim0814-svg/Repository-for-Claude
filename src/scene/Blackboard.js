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

export class Blackboard {
  constructor(width = 4, height = 1.6) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2048;
    this.canvas.height = Math.round((2048 * height) / width);
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.16, height + 0.16, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 }),
    );
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.95 }),
    );
    board.position.z = 0.026;
    this.mesh = new THREE.Group();
    this.mesh.add(frame, board);
    this.mesh.userData.targetKind = 'static';

    this.draw((g, w, h) => {
      g.font = 'bold 110px "Nanum Pen Script", "Comic Sans MS", cursive, sans-serif';
      g.fillText('가상 물리 실험실', 90, 170);
      g.font = '70px "Comic Sans MS", cursive, sans-serif';
      g.fillText('F = ma', 110, 330);
      g.fillText('∮ E·dA = Q / ε₀', 110, 450);
      g.fillText('d sinθ = mλ', 110, 570);
      g.fillText('ΔU = Q − W', 1100, 330);
      g.globalAlpha = 0.35;
      g.fillText('Phase 0 — architecture', w - 900, h - 70);
    });
  }

  /** 배경을 다시 칠하고 drawFn(g, w, h)로 내용을 그린다 (분필 스타일 기본값 설정됨). */
  draw(drawFn) {
    const { g, canvas } = this;
    const w = canvas.width, h = canvas.height;
    g.globalAlpha = 1;
    g.fillStyle = '#1f3a2e';
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
      g.font = `${size}px "Comic Sans MS", cursive, sans-serif`;
      lines.forEach((l, i) => g.fillText(l, x, y + i * size * gap));
    });
  }
}

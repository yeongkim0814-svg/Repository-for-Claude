/**
 * 화면 고정 HUD: 크로스헤어, 툴팁, 상태 뱃지, 조준 하이라이트, 상호작용 엔진 모니터.
 */
import * as THREE from 'three';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export class HUD {
  constructor(ctx) {
    this.ctx = ctx;
    this.crosshair = document.getElementById('crosshair');
    this.tooltip = document.getElementById('tooltip');
    this.badge = document.getElementById('state-badge');
    this.monitor = document.getElementById('monitor-body');

    this.highlight = new THREE.BoxHelper(undefined, 0xffd54a);
    this.highlight.visible = false;
    this.highlight.userData.noRaycast = true;
    ctx.scene.add(this.highlight);
    this.monitorTimer = 0;
  }

  setState(state, heldLabel) {
    this.badge.textContent = heldLabel ? `${state} · ${heldLabel}` : state;
  }

  setCrosshair(mode) {
    this.crosshair.className = mode;
  }

  setTooltip(text) {
    this.tooltip.textContent = text;
    this.tooltip.classList.toggle('hidden', !text);
  }

  setTarget(root) {
    if (!root) return void (this.highlight.visible = false);
    this.highlight.setFromObject(root);
    this.highlight.visible = true;
  }

  /** 엔진의 디버그 리포트를 주기적으로 출력 */
  updateMonitor(dt, engine, entities) {
    this.monitorTimer -= dt;
    if (this.monitorTimer > 0) return;
    this.monitorTimer = 0.2;

    const r = engine.lastReport;
    const lines = [`엔티티 ${entities.length}개 · 검사한 쌍 ${r.pairsChecked}개`];
    if (r.candidates.length === 0) lines.push('<span class="none">Broad phase 후보 없음</span>');
    for (const c of r.candidates) {
      lines.push(`<span class="hit">● ${esc(c.a.label)} ↔ ${esc(c.b.label)}</span>`);
      lines.push(`&nbsp;&nbsp;broad [${c.contact.domains.join('×')}] ${esc(c.contact.via)}`);
      lines.push(
        c.rules.length
          ? `&nbsp;&nbsp;narrow: <span class="hit">${c.rules.map(esc).join(', ')}</span>`
          : `&nbsp;&nbsp;narrow: <span class="miss">등록된 규칙 0개 → 아무 일도 없음</span>`,
      );
    }
    this.monitor.innerHTML = lines.join('<br>');
  }
}

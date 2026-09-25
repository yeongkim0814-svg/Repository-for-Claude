/**
 * ============================================================================
 *  UIManager — 모달 패널(찬장, 도구 설정)과 pointer lock 전환
 * ============================================================================
 *
 *  모달 열기  : modalOpen=true → controls.unlock() (마우스 커서로 UI 조작)
 *  모달 닫기  : 패널 숨김 → modalOpen=false → controls.lock() (다시 1인칭)
 *               닫기 버튼 클릭 또는 E 키 (둘 다 사용자 제스처라 lock 요청이 허용됨)
 *  Esc        : 브라우저가 pointer lock을 해제 → 일시정지 오버레이 (클릭하면 재개)
 *
 *  범용 설정 패널(openProperties)
 *   entity.properties 의 키를 순회하며 값의 자료형으로 입력 위젯을 자동 생성한다.
 *     number  → 슬라이더 + 숫자 입력 (propertyMeta의 min/max/step/unit/label 사용)
 *     boolean → 체크박스
 *     string  → 텍스트 입력
 *   + def.readouts(entity) → 실시간 측정값, def.actions → 버튼
 *   도구를 새로 추가해도 이 파일은 수정할 필요가 없다.
 */
import { ToolRegistry } from '../core/ToolRegistry.js';

export class UIManager {
  constructor(ctx, controls) {
    this.ctx = ctx;
    this.controls = controls;
    this.modalOpen = false;
    this.current = null;

    this.overlay = document.getElementById('overlay');
    this.overlayStatus = document.getElementById('overlay-status');
    this.cabinetPanel = document.getElementById('cabinet-panel');
    this.cabinetList = document.getElementById('cabinet-list');
    this.propPanel = document.getElementById('property-panel');
    this.propTitle = document.getElementById('property-title');
    this.propBody = document.getElementById('property-body');
    this.readoutEl = null;
    this.readoutEntity = null;
    this.readoutTimer = 0;

    this.overlay.addEventListener('click', () => this.controls.lock());
    controls.addEventListener('lock', () => this.#refreshOverlay());
    controls.addEventListener('unlock', () => this.#refreshOverlay());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));

    addEventListener('keydown', (e) => {
      if (!this.modalOpen) return;
      if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
      if (e.code === 'KeyE') this.close();
      if (e.code === 'Escape') this.close(false);
    });
  }

  ready() {
    this.overlayStatus.textContent = '클릭하여 시작';
  }

  isModalOpen() {
    return this.modalOpen;
  }

  #refreshOverlay() {
    this.overlay.classList.toggle('hidden', this.controls.isLocked || this.modalOpen);
  }

  #open(panel) {
    this.modalOpen = true;
    this.current = panel;
    panel.classList.remove('hidden');
    this.controls.unlock();
    this.#refreshOverlay();
  }

  close(relock = true) {
    if (!this.modalOpen) return;
    this.current.classList.add('hidden');
    this.current = null;
    this.readoutEl = null;
    this.readoutEntity = null;
    this.modalOpen = false;
    if (relock) this.controls.lock();
    // lock 요청이 거부되면(브라우저 정책) 오버레이로 폴백
    setTimeout(() => this.#refreshOverlay(), 250);
    this.#refreshOverlay();
  }

  // ─── 찬장 ──────────────────────────────────────────────────
  openCabinet(onSelect) {
    this.cabinetList.innerHTML = '';
    for (const def of ToolRegistry.all()) {
      const card = document.createElement('div');
      card.className = 'tool-card';
      card.innerHTML = `
        <div class="icon">${def.icon}</div>
        <div>
          <div><b>${def.label}</b> ${def.physicsDomain.map((d) => `<span class="tag">${d}</span>`).join('')}</div>
          <div class="desc">${def.description ?? ''}</div>
        </div>`;
      card.addEventListener('click', () => {
        this.close();
        onSelect(def);
      });
      this.cabinetList.appendChild(card);
    }
    this.#open(this.cabinetPanel);
  }

  // ─── 범용 설정 패널 ────────────────────────────────────────
  openProperties(entity) {
    const def = entity.def;
    this.propTitle.textContent = `${def.icon} ${entity.label}`;
    this.propBody.innerHTML = '';

    const info = document.createElement('div');
    info.className = 'desc';
    info.innerHTML = `도메인: ${entity.physicsDomain.map((d) => `<span class="tag">${d}</span>`).join('')}
      포트: ${entity.interactionPorts.map((p) => `<span class="tag">${p.name}:${p.type}</span>`).join('') || '없음'}`;
    this.propBody.appendChild(info);

    for (const [key, value] of Object.entries(entity.properties)) {
      this.propBody.appendChild(this.#makeField(entity, key, value, def.propertyMeta?.[key] ?? {}));
    }

    if (def.readouts) {
      const sec = document.createElement('div');
      sec.className = 'prop-section';
      sec.innerHTML = '<h4>실시간 측정값</h4><div></div>';
      this.propBody.appendChild(sec);
      this.readoutEl = sec.lastChild;
      this.readoutEntity = entity;
      this.#renderReadouts();
    }

    if (def.actions) {
      const row = document.createElement('div');
      row.className = 'actions';
      for (const [, action] of Object.entries(def.actions)) {
        const btn = document.createElement('button');
        btn.textContent = action.label;
        btn.addEventListener('click', () => action.run(entity, this.ctx));
        row.appendChild(btn);
      }
      this.propBody.appendChild(row);
    }
    this.#open(this.propPanel);
  }

  #makeField(entity, key, value, meta) {
    const row = document.createElement('div');
    row.className = 'prop-row';
    const label = document.createElement('label');
    label.textContent = meta.label ?? key;
    row.appendChild(label);
    const unit = document.createElement('span');
    unit.textContent = meta.unit ?? '';

    // 값 변경 → EntityManager.setProperty (rebuild 여부는 propertyMeta가 결정)
    const commit = (v) => this.ctx.entities.setProperty(entity, key, v);
    // rebuild가 필요한 속성은 슬라이더를 놓을 때(change)만 적용, 아니면 드래그 중(input)에도 적용
    const liveEvent = meta.rebuild === false ? 'input' : 'change';

    if (typeof value === 'number') {
      const min = meta.min ?? 0;
      const max = meta.max ?? (value > 0 ? value * 4 : 1);
      const step = meta.step ?? (max - min) / 100;
      const range = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value });
      const num = Object.assign(document.createElement('input'), { type: 'number', min, max, step, value });
      range.addEventListener('input', () => (num.value = range.value));
      range.addEventListener(liveEvent, () => commit(Number(range.value)));
      num.addEventListener('change', () => {
        range.value = num.value;
        commit(Number(num.value));
      });
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '6px';
      range.style.flex = '1';
      num.style.width = '64px';
      wrap.append(range, num);
      row.append(wrap, unit);
    } else if (typeof value === 'boolean') {
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: value });
      cb.addEventListener('change', () => commit(cb.checked));
      const wrap = document.createElement('div');
      wrap.append(cb);
      row.append(wrap, unit);
    } else {
      const tx = Object.assign(document.createElement('input'), { type: 'text', value: String(value) });
      tx.addEventListener('change', () => commit(tx.value));
      row.append(tx, unit);
    }
    return row;
  }

  #renderReadouts() {
    const data = this.readoutEntity.def.readouts(this.readoutEntity);
    this.readoutEl.innerHTML = Object.entries(data)
      .map(([k, v]) => `<div class="readout"><span>${k}</span><span>${v}</span></div>`)
      .join('');
  }

  update(dt) {
    if (!this.readoutEl) return;
    this.readoutTimer -= dt;
    if (this.readoutTimer > 0) return;
    this.readoutTimer = 0.1;
    this.#renderReadouts();
  }
}

/* ==========================================================================
   Atelier UI — the stage (poster, loading, fallback, HUD) + the control
   panel, bound to the selection store. Used by the homepage atelier and by
   the product page "3D prikaz" tab. The heavy viewer module (three.js) is
   imported lazily, only when the stage approaches the viewport.
   ========================================================================== */
import { COLORS, COLOR_ORDER, ENTRIES, DESIGNS, entryById, colorStatus } from './data.js';
import { store, productUrl, REDUCED } from './site.js';

const DRAG_ICON = '<svg viewBox="0 0 22 12" fill="none" stroke="currentColor" stroke-width="1"><path d="M1 6h20M5 2 1 6l4 4M17 2l4 4-4 4"/></svg>';

export function buildStage(el, { badge = true, compact = false } = {}) {
  const e = entryById(store.get().entry);
  el.classList.add('stage');
  el.innerHTML = `
    <figure class="stage__poster"><img src="${e.poster}" alt="${e.photos[0].alt}"><figcaption class="cap">Fotografija — ${e.label}</figcaption></figure>
    <div class="stage__veil"></div>
    <div class="stage__status">
      <div class="stage__loader" aria-hidden="true"></div>
      <p class="cap" data-status>Učitavanje 3D prikaza…</p>
      <button class="btn btn--ink btn--sm" data-start hidden>Pokreni 3D prikaz</button>
    </div>
    ${badge ? `<div class="stage__badge" aria-hidden="true"><span class="cap" data-badge-cap></span><strong data-badge-name></strong></div>` : ''}
    <div class="stage__hint cap" aria-hidden="true">${DRAG_ICON}<span>Prevuci za rotaciju</span></div>
    <div class="stage__hud">
      <div class="stage__views" role="group" aria-label="Kadar">
        <button data-view="front" aria-pressed="false">Prednja strana</button>
        <button data-view="back" aria-pressed="false">Zadnja strana</button>
        <button data-view="detail" aria-pressed="false">Detalji</button>
        <button data-view="reset">${compact ? 'Reset' : 'Resetuj prikaz'}</button>
      </div>
      <div class="stage__zoom" role="group" aria-label="Uvećanje">
        <button data-zoom="-1" aria-label="Umanji">−</button>
        <button data-zoom="1" aria-label="Uvećaj">+</button>
      </div>
    </div>
    <div class="stage__fallback" aria-live="polite"></div>`;
  return el;
}

export function renderPanel(panel, { looks = true, title = true } = {}) {
  panel.innerHTML = `
    ${title ? `<div class="panel__head">
      <span class="eyebrow">3D atelje</span>
      <h2 class="panel__title" data-p-title></h2>
      <div class="panel__meta"><span class="tag">Radni naziv</span><span class="tag" data-p-fidelity></span></div>
    </div>` : ''}
    ${looks ? `<div class="panel__group">
      <div class="panel__label"><span class="cap" id="lbl-model">Izaberi model</span><span class="num" data-p-count></span></div>
      <div class="looks-pick" role="group" aria-labelledby="lbl-model">
        ${ENTRIES.map(e => `<button data-entry="${e.id}" aria-pressed="false" aria-label="${e.label} — ${e.tempName}">
          <span class="th"><img src="${e.poster}" alt="" loading="lazy"></span><span class="lb">${e.label}</span></button>`).join('')}
      </div>
    </div>` : ''}
    <div class="panel__group">
      <div class="panel__label"><span class="cap" id="lbl-colour">Izaberi boju</span><span class="cap" data-p-colour-state></span></div>
      <div class="swatches" role="radiogroup" aria-labelledby="lbl-colour">
        ${COLOR_ORDER.map(c => `<button class="swatch" role="radio" aria-checked="false" data-color="${c}">
          <span class="dot" style="--c:${COLORS[c].ui}"></span><span class="nm">${COLORS[c].label}</span><span class="st"></span></button>`).join('')}
      </div>
    </div>
    ${looks ? '<p class="body" data-p-caption></p>' : ''}
    <div class="panel__group">
      <span class="cap">Prikaz</span>
      <div class="toggle" role="group" aria-label="Prikaz">
        <button data-display="mannequin" aria-pressed="true">Na lutki</button>
        <button data-display="dress" aria-pressed="false">Samo haljina</button>
      </div>
      <div class="panel__row"><button class="switch" role="switch" aria-checked="false" data-auto><i></i>Automatska rotacija</button></div>
    </div>
    <p class="panel__status" role="status" aria-live="polite" data-p-status></p>
    ${looks ? `<div class="panel__actions">
      <a class="btn btn--sm" data-p-product href="#">Pogledaj haljinu</a>
      <button class="btn btn--ink btn--sm" data-inquire>Pošalji upit</button>
    </div>` : ''}
    <p class="panel__note"><strong>Približan 3D prototip</strong> prema fotografijama, ne tačna replika. Boje označene „pregled“ nisu potvrđeni proizvodi — dostupnost proverite upitom.</p>`;
  return panel;
}

/* keep panel + stage labels in sync with the store */
function syncUI(stage, panel, s) {
  const e = entryById(s.entry), c = COLORS[s.color];
  const status = colorStatus(e, s.color);
  const name = e.tempName.split('—')[0].trim();
  if (panel) {
    const t = panel.querySelector('[data-p-title]');
    if (t) t.innerHTML = `${e.label} <em>— ${c.label}</em>`;
    const f = panel.querySelector('[data-p-fidelity]');
    if (f) f.textContent = DESIGNS[e.design].model.status === 'final' ? '3D model' : '3D prototip';
    const cnt = panel.querySelector('[data-p-count]'); if (cnt) cnt.textContent = `${e.no} / 0${ENTRIES.length}`;
    panel.querySelectorAll('[data-entry]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.entry === e.id)));
    panel.querySelectorAll('.swatch').forEach(b => {
      const on = b.dataset.color === s.color;
      b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
      const stt = b.dataset.color === e.photoColor ? 'sa fotografije' : 'pregled';
      b.querySelector('.st').textContent = stt;
      b.setAttribute('aria-label', `${COLORS[b.dataset.color].label}, ${stt}`);
    });
    const cs = panel.querySelector('[data-p-colour-state]');
    if (cs) cs.textContent = status === 'fotografisano' ? 'Fotografisano' : '3D pregled';
    const cap = panel.querySelector('[data-p-caption]'); if (cap) cap.textContent = e.caption;
    const pr = panel.querySelector('[data-p-product]'); if (pr) pr.href = productUrl(e.id, s.color);
    const st = panel.querySelector('[data-p-status]');
    if (st) st.textContent = `Izabrano: ${e.label} · ${c.label}${status === 'fotografisano' ? ' (boja sa fotografije)' : ' (3D pregled)'}`;
  }
  if (stage) {
    const bc = stage.querySelector('[data-badge-cap]'), bn = stage.querySelector('[data-badge-name]');
    if (bc) bc.textContent = `${e.label} · ${status === 'fotografisano' ? 'boja sa fotografije' : '3D pregled boje'}`;
    if (bn) bn.textContent = `${name} — ${c.label}`;
    const poster = stage.querySelector('.stage__poster img');
    if (poster && !stage.classList.contains('is-ready')) { poster.src = e.poster; poster.alt = e.photos[0].alt; }
  }
}

function showFallback(stage, why) {
  const e = entryById(store.get().entry);
  stage.classList.add('is-fallback');
  const fb = stage.querySelector('.stage__fallback');
  fb.innerHTML = e.photos.slice(0, 3).map(p => `<img src="${p.src}" alt="${p.alt}" loading="lazy">`).join('')
    + `<p class="cap">${why === 'webgl' ? '3D prikaz nije dostupan na ovom uređaju — prikazujemo fotografije.' : '3D prikaz nije mogao da se učita — prikazujemo fotografije.'}</p>`;
}

function slowDevice() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /2g/.test(c.effectiveType || '') || (c.downlink && c.downlink < 1.2))) || (navigator.deviceMemory && navigator.deviceMemory <= 2);
}

/* ---------------------------------------------------------------------------
   mountAtelier — lazy viewer + all bindings. Returns a controller whose
   `ready` promise resolves with the viewer (or null on fallback).
   --------------------------------------------------------------------------- */
export function mountAtelier({ stage, panel, mode = 'manual', eager = false, onViewer, autoRotate = false }) {
  const ctl = { viewer: null, ready: null };
  let resolveReady;
  ctl.ready = new Promise(r => (resolveReady = r));
  syncUI(stage, panel, store.get());

  /* panel → store */
  panel?.addEventListener('click', e => {
    const be = e.target.closest('[data-entry]');
    if (be) { store.set({ entry: be.dataset.entry }, 'panel'); return; }
    const bc = e.target.closest('.swatch');
    if (bc) { store.set({ color: bc.dataset.color }, 'panel'); return; }
    const bd = e.target.closest('[data-display]');
    if (bd) { ctl.viewer?.setDisplay(bd.dataset.display); return; }
    const ba = e.target.closest('[data-auto]');
    if (ba) { const on = ba.getAttribute('aria-checked') !== 'true'; ctl.viewer?.setAutoRotate(on); ba.setAttribute('aria-checked', String(on)); }
  });
  // roving arrow keys inside the colour radiogroup
  panel?.querySelector('.swatches')?.addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const i = COLOR_ORDER.indexOf(store.get().color);
    const n = COLOR_ORDER[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + COLOR_ORDER.length) % COLOR_ORDER.length];
    store.set({ color: n }, 'panel');
    panel.querySelector(`.swatch[data-color="${n}"]`)?.focus();
  });

  /* stage HUD */
  stage.addEventListener('click', e => {
    const v = e.target.closest('[data-view]');
    if (v && ctl.viewer) {
      ctl.viewer.view(v.dataset.view);
      stage.querySelectorAll('[data-view]').forEach(b => b.hasAttribute('aria-pressed') && b.setAttribute('aria-pressed', String(b === v && v.dataset.view !== 'reset')));
      if (v.dataset.view === 'reset') stage.querySelector('[data-view="front"]').setAttribute('aria-pressed', 'true');
    }
    const z = e.target.closest('[data-zoom]');
    if (z && ctl.viewer) ctl.viewer.zoom(+z.dataset.zoom);
  });

  store.on((s, prev) => {
    syncUI(stage, panel, s);
    if (ctl.viewer && (s.entry !== prev.entry || s.color !== prev.color)) ctl.viewer.setEntry(s.entry, s.color);
    if (s.entry !== prev.entry) stage.querySelectorAll('[data-view][aria-pressed]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  });

  /* desktop drag cursor */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !REDUCED) {
    const cur = document.createElement('div'); cur.className = 'stage__cursor'; cur.textContent = 'Prevuci'; cur.setAttribute('aria-hidden', 'true');
    document.body.append(cur);
    let x = 0, y = 0, raf = 0;
    const move = () => { raf = 0; cur.style.translate = `${x}px ${y}px`; };
    stage.addEventListener('pointermove', e => {
      const onCanvas = e.target.classList?.contains('atelier-canvas');
      cur.classList.toggle('is-on', onCanvas && stage.classList.contains('is-ready') && !stage.classList.contains('is-dragging'));
      x = e.clientX; y = e.clientY; if (!raf) raf = requestAnimationFrame(move);
    });
    stage.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
    stage.addEventListener('pointerdown', () => cur.classList.remove('is-on'));
  }

  async function start() {
    const status = stage.querySelector('[data-status]');
    stage.querySelector('[data-start]').hidden = true;
    stage.querySelector('.stage__loader').hidden = false;
    status.textContent = 'Učitavanje 3D prikaza…';
    try {
      const mod = await import('./atelier/viewer.js');
      if (!mod.webglAvailable()) { showFallback(stage, 'webgl'); resolveReady(null); return; }
      const v = mod.createViewer(stage, { mode, autoRotate });
      ctl.viewer = v;
      v.on('interact', () => stage.classList.add('has-interacted'));
      v.on('display', d => panel?.querySelectorAll('[data-display]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.display === d))));
      v.on('autorotate', on => panel?.querySelector('[data-auto]')?.setAttribute('aria-checked', String(on)));
      onViewer?.(v);
      const sleevesHint = () => {
        const h = panel?.querySelector('[data-p-sleeves]');
        if (h) h.hidden = v.hasArms || v.state.display === 'dress';
      };
      v.on('display', sleevesHint); v.on('body', sleevesHint);
      v.bodyReady.then(sleevesHint);
      const s = store.get();
      await v.setEntry(s.entry, s.color);
      resolveReady(v);
    } catch (err) {
      console.warn('[atelier]', err);
      showFallback(stage, err?.message === 'webgl-unavailable' ? 'webgl' : 'error');
      resolveReady(null);
    }
  }

  const startBtn = stage.querySelector('[data-start]');
  startBtn.addEventListener('click', start);
  const arm = () => {
    if (slowDevice()) {
      stage.querySelector('.stage__loader').hidden = true;
      stage.querySelector('[data-status]').textContent = '3D prikaz se učitava na zahtev.';
      startBtn.hidden = false;
    } else start();
  };
  if (eager) arm();
  else {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); arm(); } }, { rootMargin: '900px 0px' });
    io.observe(stage);
  }
  ctl.start = start;
  return ctl;
}

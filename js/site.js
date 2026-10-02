/* ==========================================================================
   Shared behaviour for every page:
   selection store · smooth scroll · header contrast · mobile menu ·
   inquiry drawer · reveals · lightbox · toast
   ========================================================================== */
import { BRAND, COLORS, COLOR_ORDER, ENTRIES, INQUIRY, entryById, colorStatus } from './data.js';

export const QS = new URLSearchParams(location.search);
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches && !QS.has('motion');
export const DESKTOP = () => matchMedia('(min-width: 961px)').matches;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;

/* ---------------------------------------------------------------------------
   Selection store — garment + colour + size survive across the viewer,
   product page and inquiry form (localStorage, same tab + other tabs).
   --------------------------------------------------------------------------- */
const KEY = 'zba.selection.v1';
const listeners = new Set();
let sel = (() => {
  try { return { entry: 'look-03', color: null, size: '', qty: 1, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { entry: 'look-03', color: null, size: '', qty: 1 }; }
})();
if (!ENTRIES.some(e => e.id === sel.entry)) sel.entry = 'look-03';
export const store = {
  get() {
    const e = entryById(sel.entry);
    return { ...sel, color: COLORS[sel.color] ? sel.color : e.photoColor };
  },
  set(patch, source) {
    const prev = this.get();
    sel = { ...sel, ...patch };
    // a new garment starts in its photographed colour unless one is given
    if (patch.entry && patch.entry !== prev.entry && !patch.color) sel.color = entryById(patch.entry).photoColor;
    try { localStorage.setItem(KEY, JSON.stringify(sel)); } catch {}
    const cur = this.get();
    document.documentElement.style.setProperty('--accent', COLORS[cur.color].ui);
    listeners.forEach(f => f(cur, prev, source));
  },
  on(f) { listeners.add(f); return () => listeners.delete(f); },
};
document.documentElement.style.setProperty('--accent', COLORS[store.get().color].ui);
addEventListener('storage', e => { if (e.key === KEY) { try { sel = { ...sel, ...JSON.parse(e.newValue) }; listeners.forEach(f => f(store.get(), store.get(), 'storage')); } catch {} } });

export const productUrl = (entry, color) => `haljina.html?id=${entry}${color ? `&boja=${color}` : ''}`;

/* ---------------------------------------------------------------------------
   Smooth scroll (Lenis) wired to GSAP's ticker so ScrollTrigger stays in sync
   --------------------------------------------------------------------------- */
export let lenis = null;
function initScroll() {
  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }
  if (REDUCED || QS.has('raw') || !window.Lenis || !gsap) return;
  lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.2 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
}
export function scrollToEl(target, opts = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (el == null && typeof target !== 'number') return;
  const offset = opts.offset ?? 0;
  if (lenis && opts.immediate) {
    const y = typeof target === 'number' ? target : el.getBoundingClientRect().top + scrollY + offset;
    lenis.scrollTo(y, { immediate: true, force: true });
    requestAnimationFrame(() => lenis.scrollTo(y, { immediate: true, force: true }));
  } else if (lenis) lenis.scrollTo(el ?? target, { offset, duration: opts.duration ?? 1.4, force: true });
  else {
    const y = typeof target === 'number' ? target : el.getBoundingClientRect().top + scrollY + offset;
    scrollTo({ top: y, behavior: REDUCED || opts.immediate ? 'auto' : 'smooth' });
  }
}

/* ---------------------------------------------------------------------------
   Header: contrast follows the section under it; compact state on scroll
   --------------------------------------------------------------------------- */
function initHeader() {
  const hdr = document.querySelector('.hdr');
  if (!hdr) return;
  const zones = [...document.querySelectorAll('[data-header]')];
  let ticking = false;
  const update = () => {
    ticking = false;
    const probe = hdr.offsetHeight / 2;
    let dark = false;
    for (const z of zones) {
      const r = z.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { dark = z.dataset.header === 'dark'; break; }
    }
    hdr.classList.toggle('is-dark', dark);
    hdr.classList.toggle('is-scrolled', scrollY > 30);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
  // in-page anchors go through Lenis
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"], a[href^="index.html#"]');
    if (!a) return;
    const id = a.getAttribute('href').split('#')[1];
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(el, { offset: el.dataset.anchorOffset ? +el.dataset.anchorOffset : 0 });
    history.replaceState(null, '', '#' + id);
  });
  updateInqCount();
  store.on(updateInqCount);
}
function updateInqCount() {
  document.querySelectorAll('[data-inq-label]').forEach(n => { n.textContent = entryById(store.get().entry).label.replace('Look ', ''); });
}

/* ---------------------------------------------------------------------------
   Mobile menu (pure CSS transitions; JS only toggles state + focus)
   --------------------------------------------------------------------------- */
let menuEl = null, menuBtn = null;
function initMenu() {
  menuEl = document.querySelector('.menu');
  menuBtn = document.querySelector('.hdr__menu');
  if (!menuEl || !menuBtn) return;
  menuBtn.addEventListener('click', () => (menuEl.classList.contains('is-open') ? closeMenu() : openMenu()));
  menuEl.querySelector('[data-menu-close]')?.addEventListener('click', closeMenu);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}
function openMenu() {
  menuEl.classList.add('is-open'); menuEl.removeAttribute('inert');
  menuBtn.setAttribute('aria-expanded', 'true'); lenis?.stop();
  setTimeout(() => menuEl.querySelector('a')?.focus(), 300);
}
export function closeMenu() {
  if (!menuEl?.classList.contains('is-open')) return;
  menuEl.classList.remove('is-open'); menuEl.setAttribute('inert', '');
  menuBtn.setAttribute('aria-expanded', 'false'); lenis?.start(); menuBtn.focus();
}

/* ---------------------------------------------------------------------------
   Toast
   --------------------------------------------------------------------------- */
let toastT;
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 3200);
}

/* ---------------------------------------------------------------------------
   Inquiry drawer — remembers garment, colour, size, quantity.
   No backend: never pretends a message was sent (see data.js → INQUIRY).
   --------------------------------------------------------------------------- */
let drawer, lastFocus;
function buildDrawer() {
  drawer = document.createElement('div');
  drawer.className = 'drawer'; drawer.id = 'upit';
  drawer.setAttribute('inert', '');
  drawer.innerHTML = `
  <div class="drawer__scrim" data-close></div>
  <section class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="inq-title" data-lenis-prevent>
    <div class="drawer__top">
      <span class="eyebrow" id="inq-title">Upit za haljinu</span>
      <button class="link" data-close>Zatvori <i>×</i></button>
    </div>
    <div class="drawer__body">
      <div class="inq-sum">
        <figure class="media"><img alt="" data-sum-img></figure>
        <div>
          <span class="cap" data-sum-label></span>
          <h3 data-sum-name></h3>
          <dl><dt>Boja</dt><dd data-sum-color></dd><dt>Na fotografiji</dt><dd data-sum-photo></dd><dt>Veličina</dt><dd data-sum-size>—</dd></dl>
          <a class="link swap" data-sum-link href="#">Pogledaj haljinu <i>→</i></a>
        </div>
      </div>
      <form class="form" novalidate>
        <div class="field field--full"><label for="f-name">Ime i prezime</label><input id="f-name" name="name" autocomplete="name" required><span class="err" aria-live="polite"></span></div>
        <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required><span class="err" aria-live="polite"></span></div>
        <div class="field"><label for="f-phone">Telefon <small>(nije obavezno)</small></label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
        <div class="field field--full"><label for="f-model">Model haljine</label><select id="f-model" name="model">${ENTRIES.map(e => `<option value="${e.id}">${e.label} — ${e.tempName}</option>`).join('')}</select></div>
        <div class="field"><label for="f-color">Boja</label><select id="f-color" name="color">${COLOR_ORDER.map(c => `<option value="${c}">${COLORS[c].label}</option>`).join('')}</select></div>
        <div class="field"><label for="f-size">Veličina <small>(ako znate)</small></label><input id="f-size" name="size" placeholder="npr. S ili 36" autocomplete="off"></div>
        <div class="field"><label for="f-qty">Količina</label><input id="f-qty" name="qty" type="number" min="1" max="10" value="1" inputmode="numeric"></div>
        <div class="field field--full"><label for="f-msg">Poruka</label><textarea id="f-msg" name="message" placeholder="Pitanje o dostupnosti, veličini ili probi u butiku…"></textarea></div>
        <p class="form__note" data-color-note></p>
        <div class="form__actions">
          <button class="btn btn--ink btn--block" type="submit">${INQUIRY.endpoint ? 'Pošalji upit' : 'Pripremi upit za Instagram'} <span class="arr">→</span></button>
        </div>
        <div class="form__result" role="status" aria-live="polite"></div>
        <p class="form__note">${INQUIRY.endpoint ? '' : `Brend upite prima porukom na Instagramu (${BRAND.instagramHandle}). Kada potvrdite, tekst upita će biti kopiran i otvoriće se razgovor — samo ga nalepite i pošaljite.`}
        Butik: ${BRAND.address}, ${BRAND.city}. ${BRAND.walkIn}</p>
      </form>
    </div>
  </section>`;
  document.body.append(drawer);
  const form = drawer.querySelector('form');
  drawer.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeInquiry));
  drawer.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeInquiry();
    if (e.key === 'Tab') trapFocus(e, drawer.querySelector('.drawer__panel'));
  });
  form.model.addEventListener('change', () => store.set({ entry: form.model.value }, 'form'));
  form.color.addEventListener('change', () => store.set({ color: form.color.value }, 'form'));
  form.size.addEventListener('input', () => store.set({ size: form.size.value.trim() }, 'form'));
  form.qty.addEventListener('input', () => store.set({ qty: Math.max(1, +form.qty.value || 1) }, 'form'));
  form.addEventListener('submit', submitInquiry);
  store.on((s, p, src) => { if (src !== 'form') syncDrawer(); else syncSummary(); });
  syncDrawer();
}
function syncSummary() {
  const s = store.get(), e = entryById(s.entry), c = COLORS[s.color];
  const status = colorStatus(e, s.color);
  drawer.querySelector('[data-sum-img]').src = e.poster;
  drawer.querySelector('[data-sum-img]').alt = e.photos[0].alt;
  drawer.querySelector('[data-sum-label]').textContent = `${e.label} · radni naziv`;
  drawer.querySelector('[data-sum-name]').textContent = e.tempName.split(' — ')[0];
  drawer.querySelector('[data-sum-color]').innerHTML = `<span style="display:inline-flex;gap:8px;align-items:center"><span class="dot" style="--c:${c.ui}"></span>${c.label} <span class="cap">· ${status === 'fotografisano' ? 'sa fotografije' : '3D pregled'}</span></span>`;
  drawer.querySelector('[data-sum-size]').textContent = s.size || '—';
  drawer.querySelector('[data-sum-photo]').textContent = COLORS[e.photoColor].label;
  drawer.querySelector('[data-sum-link]').href = productUrl(e.id, s.color);
  drawer.querySelector('[data-color-note]').textContent = status === 'fotografisano'
    ? ''
    : `Napomena: boja „${c.label}“ za ovaj model prikazana je samo kao 3D konfiguracija. Dostupnost ćemo potvrditi u odgovoru.`;
}
function syncDrawer() {
  if (!drawer) return;
  const s = store.get(), f = drawer.querySelector('form');
  f.model.value = s.entry; f.color.value = s.color;
  if (document.activeElement !== f.size) f.size.value = s.size || '';
  f.qty.value = s.qty || 1;
  syncSummary();
}
export function openInquiry(patch) {
  if (!drawer) buildDrawer();
  if (patch) store.set(patch, 'open');
  syncDrawer();
  lastFocus = document.activeElement;
  drawer.removeAttribute('inert');
  drawer.classList.add('is-open');
  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';
  setTimeout(() => drawer.querySelector('#f-name').focus({ preventScroll: true }), 350);
}
export function closeInquiry() {
  if (!drawer?.classList.contains('is-open')) return;
  drawer.classList.remove('is-open'); drawer.setAttribute('inert', '');
  lenis?.start(); document.documentElement.style.overflow = '';
  lastFocus?.focus?.({ preventScroll: true });
}
function trapFocus(e, root) {
  const f = [...root.querySelectorAll('a[href],button:not([disabled]),input,select,textarea')].filter(n => n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function composeMessage(d) {
  const e = entryById(d.model), c = COLORS[d.color];
  return [
    `Zdravo, ZOE BY AZ!`,
    ``,
    `Zanima me haljina: ${e.label} — ${e.tempName}`,
    `Boja: ${c.label}${d.color === e.photoColor ? '' : ' (prikazana u 3D pregledu na sajtu)'}`,
    d.size ? `Veličina: ${d.size}` : null,
    +d.qty > 1 ? `Količina: ${d.qty}` : null,
    d.message ? `\n${d.message}` : null,
    ``,
    `${d.name}`,
    d.email,
    d.phone || null,
  ].filter(x => x !== null).join('\n');
}
async function submitInquiry(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const res = form.querySelector('.form__result');
  const d = Object.fromEntries(new FormData(form));
  let ok = true;
  const setErr = (name, msg) => {
    const el = form[name]; const err = el.parentElement.querySelector('.err');
    el.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (err) err.textContent = msg || '';
    if (msg && ok) { el.focus(); ok = false; }
  };
  setErr('name', d.name.trim().length < 2 ? 'Upišite ime i prezime.' : '');
  setErr('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim()) ? '' : 'Upišite ispravnu email adresu.');
  if (!ok) return;
  const text = composeMessage(d);
  const btn = form.querySelector('[type=submit]');

  if (INQUIRY.endpoint) {
    btn.disabled = true;
    try {
      const r = await fetch(INQUIRY.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...d, text }) });
      if (!r.ok) throw new Error(r.status);
      res.innerHTML = '<strong>Upit je poslat.</strong> Odgovor stiže na vašu email adresu.';
    } catch {
      res.innerHTML = `Slanje trenutno nije uspelo. Pošaljite upit porukom na Instagramu: <a class="link" href="${BRAND.instagramDM}" target="_blank" rel="noopener">${BRAND.instagramHandle} <i>↗</i></a>`;
    }
    btn.disabled = false; res.classList.add('is-on');
    return;
  }

  let copied = false;
  try {
    // some browsers never settle the permission prompt — don't wait forever
    await Promise.race([navigator.clipboard.writeText(text), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500))]);
    copied = true;
  } catch {}
  res.innerHTML = `
    <strong>${copied ? 'Tekst upita je kopiran.' : 'Upit je pripremljen.'}</strong>
    ${copied ? 'Otvorite razgovor na Instagramu i nalepite ga.' : 'Kopirajte tekst ispod i pošaljite ga porukom na Instagramu.'}
    Upit još nije poslat — šaljete ga vi, iz Instagram poruke.
    <div style="margin-top:12px"><a class="btn btn--ink btn--sm" href="${BRAND.instagramDM}" target="_blank" rel="noopener">Otvori Instagram poruku <span class="arr">↗</span></a></div>
    <label class="visually-hidden" for="f-text">Tekst upita</label>
    <textarea id="f-text" readonly>${text.replace(/</g, '&lt;')}</textarea>`;
  res.classList.add('is-on');
  res.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
}

/* ---------------------------------------------------------------------------
   Reveals — a small vocabulary, deliberately not one fade-up for everything
     [data-clip]      image frame opens (bottom→top, or "left")
     [data-lines]     masked lines rise in sequence
     [data-fade]      soft opacity (captions, small print)
     [data-parallax]  gentle drift of an image inside its frame
   --------------------------------------------------------------------------- */
function initReveals() {
  if (REDUCED || !gsap || !ScrollTrigger) {
    document.documentElement.classList.remove('js-motion');
    return;
  }
  gsap.utils.toArray('[data-clip]').forEach(el => {
    const img = el.querySelector('img');
    const from = el.dataset.clip === 'left' ? 'inset(0 100% 0 0)' : 'inset(100% 0 0 0)';
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    tl.fromTo(el, { clipPath: from }, { clipPath: 'inset(0% 0 0 0)', duration: 1.35, ease: 'expo.inOut' });
    if (img && !el.hasAttribute('data-parallax')) tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0.1);
  });
  gsap.utils.toArray('[data-lines]').forEach(el => {
    const lines = el.querySelectorAll('.ln > *');
    gsap.set(lines, { yPercent: 112 });
    ScrollTrigger.create({ trigger: el, start: 'top 86%', once: true, onEnter: () => gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.09 }) });
  });
  gsap.utils.toArray('[data-fade]').forEach(el => {
    ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => gsap.to(el, { opacity: 1, duration: 1.1, ease: 'power2.out', delay: +(el.dataset.fade || 0) }) });
  });
  gsap.utils.toArray('[data-parallax]').forEach(el => {
    const img = el.querySelector('img'); if (!img) return;
    const amt = +el.dataset.parallax || 8;
    gsap.set(img, { scale: 1 + amt / 50 });
    gsap.fromTo(img, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* ---------------------------------------------------------------------------
   Lightbox (product galleries)
   --------------------------------------------------------------------------- */
export function lightbox(photos, start = 0) {
  let lb = document.querySelector('.lightbox');
  if (!lb) {
    lb = document.createElement('div'); lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Uvećana fotografija');
    lb.innerHTML = `<img alt=""><button class="x">Zatvori ×</button><button class="pv" aria-label="Prethodna">←</button><button class="nx" aria-label="Sledeća">→</button><p></p>`;
    document.body.append(lb);
  }
  let i = start;
  const img = lb.querySelector('img'), cap = lb.querySelector('p');
  const show = () => { const p = photos[i]; img.src = p.src; img.alt = p.alt; cap.textContent = `${i + 1} / ${photos.length} — ${p.view || ''}`; };
  const close = () => { lb.classList.remove('is-open'); lenis?.start(); removeEventListener('keydown', key); prev?.focus(); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') { i = (i + 1) % photos.length; show(); } if (e.key === 'ArrowLeft') { i = (i - 1 + photos.length) % photos.length; show(); } };
  const prev = document.activeElement;
  lb.querySelector('.x').onclick = close;
  lb.querySelector('.nx').onclick = () => { i = (i + 1) % photos.length; show(); };
  lb.querySelector('.pv').onclick = () => { i = (i - 1 + photos.length) % photos.length; show(); };
  lb.onclick = e => { if (e.target === lb) close(); };
  addEventListener('keydown', key);
  show(); lb.classList.add('is-open'); lenis?.stop();
  lb.querySelector('.x').focus();
}

/* ---------------------------------------------------------------------------
   Boot
   --------------------------------------------------------------------------- */
export function boot() {
  initScroll();
  initHeader();
  initMenu();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-inquire]');
    if (!b) return;
    e.preventDefault();
    const patch = {};
    if (b.dataset.entry) patch.entry = b.dataset.entry;
    if (b.dataset.color) patch.color = b.dataset.color;
    openInquiry(Object.keys(patch).length ? patch : null);
  });
  if (location.hash === '#upit') setTimeout(() => openInquiry(), 400);
  document.querySelectorAll('[data-year]').forEach(n => (n.textContent = new Date().getFullYear()));
}
export function startReveals() { initReveals(); }

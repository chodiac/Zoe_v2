/* ==========================================================================
   Catalog page — photographic collection rendered from data.js.
   Filters appear only for attributes the data actually carries.
   ========================================================================== */
import { COLORS, COLOR_ORDER, CATALOG_PENDING, catalogItems } from './data.js';
import { boot, startReveals, productUrl, REDUCED } from './site.js';

boot();
const gsap = window.gsap;
const items = catalogItems();
const grid = document.querySelector('[data-grid]');
const state = { color: null, only3d: false };

// editorial rhythm: wide / tall / offset, but browsing order stays left→right
const RHYTHM = ['is-wide', 'is-wide is-off', 'is-tall', '', 'is-tall is-off'];

grid.innerHTML = items.map((it, i) => {
  const p = it.photos[0], alt = it.photos[1];
  const cols = it.colors.map(c => `<span style="display:inline-flex;gap:6px;align-items:center"><span class="dot" style="--c:${COLORS[c].ui}"></span>${COLORS[c].label}</span>`).join('');
  return `
  <article class="card ${RHYTHM[i % RHYTHM.length]}" data-colors="${it.colors.join(' ')}" data-3d="${it.featured3d ? 1 : 0}">
    <a class="card__media" href="${productUrl(it.id)}" data-clip aria-label="${it.name}: detalji">
      <img src="${p.src}" width="${p.w}" height="${p.h}" alt="${p.alt}" loading="${i < 3 ? 'eager' : 'lazy'}">
      ${alt ? `<img class="alt" src="${alt.src}" alt="" loading="lazy">` : ''}
      ${it.featured3d ? '<span class="card__flag"><span class="dot" style="--c:var(--champ)"></span>3D prikaz</span>' : ''}
    </a>
    <div class="card__body">
      <h2>${it.name}</h2>
      <span class="price">${it.price ? it.price : 'Cena na upit'}</span>
      <div class="meta">${it.label ? `<span class="cap">${it.label}${it.nameVerified ? '' : ' · radni naziv'}</span>` : ''}${cols}</div>
      <div class="meta"><a class="link" href="${productUrl(it.id)}">Detalji <i>→</i></a><button class="link" data-inquire data-entry="${it.id}" data-color="${it.colors[0]}">Upit <i>→</i></button></div>
    </div>
  </article>`;
}).join('');

document.querySelector('[data-pending]').innerHTML = Array.from({ length: CATALOG_PENDING }, (_, i) => `
  <div class="card card--pending ${i % 3 === 1 ? 'is-off' : ''}" aria-hidden="true">
    <div class="card__media"><span class="cap">Model u pripremi<br>fotografija od brenda</span></div>
    <div class="card__body"><span class="cap">Mesto ${String(i + 1).padStart(2, '0')}</span></div>
  </div>`).join('');

/* colour filter — only colours that exist in the data */
const present = COLOR_ORDER.filter(c => items.some(it => it.colors.includes(c)));
const fc = document.querySelector('[data-filter-colors]');
fc.innerHTML = `<button class="chip" aria-pressed="true" data-color="">Sve</button>` +
  present.map(c => `<button class="chip" aria-pressed="false" data-color="${c}"><span class="dot" style="--c:${COLORS[c].ui}"></span>${COLORS[c].label}</button>`).join('');
fc.addEventListener('click', e => {
  const b = e.target.closest('[data-color]'); if (!b) return;
  state.color = b.dataset.color || null;
  fc.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  apply();
});
const f3 = document.querySelector('[data-filter-3d]');
// the 3D filter is only meaningful when some items lack 3D
if (items.every(it => it.featured3d)) f3.hidden = true;
f3.addEventListener('click', () => { state.only3d = !state.only3d; f3.setAttribute('aria-pressed', String(state.only3d)); apply(); });

function apply() {
  const cards = [...grid.querySelectorAll('.card')];
  let n = 0;
  cards.forEach(c => {
    const ok = (!state.color || c.dataset.colors.split(' ').includes(state.color)) && (!state.only3d || c.dataset['3d'] === '1');
    c.hidden = !ok; if (ok) n++;
  });
  document.querySelector('[data-count]').textContent = `${n} ${n === 1 ? 'model' : 'modela'}`;
  let empty = grid.querySelector('.cat-empty');
  if (!n && !empty) { empty = document.createElement('p'); empty.className = 'cat-empty'; empty.textContent = 'Nema modela za izabrani filter.'; grid.append(empty); }
  if (n && empty) empty.remove();
  if (!REDUCED && gsap) gsap.fromTo(cards.filter(c => !c.hidden), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', clearProps: 'transform' });
  window.ScrollTrigger?.refresh();
}
apply();
Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 1500))]).then(startReveals);

/* ==========================================================================
   Product page — photos first (the real garment), 3D as a second tab.
   The chosen colour is shared with the viewer and the inquiry drawer and
   kept in the URL (?id=…&boja=…) so a configuration can be shared.
   ========================================================================== */
import { ENTRIES, COLORS, DESIGNS, entryById, colorStatus } from './data.js';
import { boot, store, lightbox, productUrl, startReveals } from './site.js';
import { buildStage, renderPanel, mountAtelier } from './atelier-ui.js';

boot();
const $ = (s, r = document) => r.querySelector(s);
const q = new URLSearchParams(location.search);
const entry = entryById(q.get('id'));
const urlColour = COLORS[q.get('boja')] ? q.get('boja') : null;
store.set({ entry: entry.id, color: urlColour || (store.get().entry === entry.id ? store.get().color : entry.photoColor) }, 'url');

const [baseName] = entry.tempName.split(' — ');
document.title = `${entry.label} — ${entry.tempName} · ZOE BY AZ`;
$('[data-crumb]').textContent = `${entry.label} — ${entry.tempName}`;
$('[data-label]').textContent = `${entry.label} · ${DESIGNS[entry.design].name}`;
$('[data-caption]').textContent = entry.caption;
$('[data-visible]').innerHTML = DESIGNS[entry.design].visible.map(v => `<li>${v}</li>`).join('');

/* ---- colour-aware texts ---- */
function syncInfo(s) {
  if (s.entry !== entry.id) return;
  const c = COLORS[s.color];
  $('[data-name]').innerHTML = `${baseName} <em>— ${c.label.toLowerCase()}</em>`;
  const status = colorStatus(entry, s.color);
  $('[data-spec-color]').innerHTML = `<span style="display:inline-flex;gap:8px;align-items:center"><span class="dot" style="--c:${c.ui}"></span>${c.label} — ${status === 'fotografisano' ? 'na fotografijama' : 'samo 3D pregled, dostupnost na upit'}</span>`;
  const note = $('[data-photo-note]');
  const msgs = [];
  if (status !== 'fotografisano') msgs.push(`Fotografije prikazuju boju „${COLORS[entry.photoColor].label}“. Boja „${c.label}“ za ovaj model postoji samo kao 3D konfiguracija.`);
  if (entry.photoNote) msgs.push(entry.photoNote);
  note.hidden = !msgs.length; note.textContent = msgs.join(' ');
  const u = new URL(location.href); u.searchParams.set('id', entry.id); u.searchParams.set('boja', s.color);
  history.replaceState(null, '', u);
}
store.on(syncInfo);
syncInfo(store.get());

/* ---- gallery ---- */
let idx = 0;
const photos = entry.photos;
$('[data-thumbs]').innerHTML = photos.map((p, i) => `<button aria-label="Fotografija ${i + 1}: ${p.view}" aria-current="${i === 0}" data-i="${i}"><img src="${p.src}" alt="" loading="lazy"></button>`).join('');
function show(i) {
  idx = (i + photos.length) % photos.length;
  const p = photos[idx], img = $('[data-main-img]');
  img.style.opacity = 0;
  const pre = new Image(); pre.src = p.src;
  pre.onload = () => { img.src = p.src; img.alt = p.alt; img.width = p.w; img.height = p.h; img.style.opacity = 1; };
  $('[data-main-cap]').textContent = `${idx + 1} / ${photos.length} — ${p.view}`;
  document.querySelectorAll('[data-thumbs] button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === idx)));
}
$('[data-thumbs]').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) show(+b.dataset.i); });
$('[data-prev]').addEventListener('click', e => { e.stopPropagation(); show(idx - 1); });
$('[data-next]').addEventListener('click', e => { e.stopPropagation(); show(idx + 1); });
$('[data-main]').addEventListener('click', e => { if (!e.target.closest('button')) lightbox(photos, idx); });
$('[data-main]').tabIndex = 0;
$('[data-main]').setAttribute('aria-label', 'Uvećaj fotografiju');
$('[data-main]').addEventListener('keydown', e => {
  if (e.key === 'Enter') lightbox(photos, idx);
  if (e.key === 'ArrowRight') show(idx + 1);
  if (e.key === 'ArrowLeft') show(idx - 1);
});
// touch swipe on the main image
let sx = null;
$('[data-main]').addEventListener('touchstart', e => (sx = e.touches[0].clientX), { passive: true });
$('[data-main]').addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1)); sx = null; });
show(0);

/* ---- colour panel (shared with the viewer) + lazy 3D tab ---- */
const panel = renderPanel($('[data-panel]'), { looks: false, title: false });
panel.querySelectorAll('.panel__group').forEach(g => { if (g.querySelector('.toggle')) g.dataset.only3d = ''; });
const stage = buildStage($('[data-stage]'), { badge: true, compact: true });
mountAtelier({ stage, panel, mode: 'manual' });

const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(t) {
  tabs.forEach(x => {
    const on = x === t;
    x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
  });
  document.body.dataset.tab = t.id === 'tab-3d' ? '3d' : 'photo';
}
tabs.forEach(t => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = tabs[(tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    n.focus(); selectTab(n);
  });
});
selectTab(q.get('prikaz') === '3d' ? tabs[1] : tabs[0]);

/* ---- related: same construction, other shades ---- */
$('[data-related]').innerHTML = ENTRIES.filter(e => e.id !== entry.id).map(e => `
  <a class="card" href="${productUrl(e.id)}" style="grid-column:auto">
    <span class="card__media"><img src="${e.poster}" alt="${e.photos[0].alt}" loading="lazy"></span>
    <span class="card__body"><span class="cap">${e.label}</span><h2 style="font-size:19px">${e.tempName}</h2></span>
  </a>`).join('');

Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 1500))]).then(startReveals);

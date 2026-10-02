/* ==========================================================================
   Homepage choreography
   cover entrance → cover becomes a framed spread → five shades →
   pinned 3D sequence that releases into the free atelier → five looks →
   horizontal lookbook → brand → contact
   ========================================================================== */
import { ENTRIES, COLORS, GROUP_PHOTO, entryById } from './data.js';
import { boot, store, REDUCED, DESKTOP, scrollToEl, startReveals, productUrl } from './site.js';
import { buildStage, renderPanel, mountAtelier } from './atelier-ui.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MOTION = !REDUCED && !!gsap && !!ScrollTrigger;

boot();
renderShades();
renderLooks();

/* atelier: stage + panel exist immediately; three.js loads lazily */
const atelierSection = $('#atelje');
const stage = buildStage($('[data-stage]'));
const panel = renderPanel($('[data-panel]'));
let viewer = null;
let userTook = false;         // visitor grabbed the model → scroll never drives it again
let seqST = null;
let lastPose = null;
const atelier = mountAtelier({
  stage, panel,
  mode: MOTION ? 'scroll' : 'manual',
  onViewer(v) {
    viewer = v;
    v.on('interact', () => { userTook = true; atelierSection.classList.add('is-free'); });
    if (!MOTION) return;
    if (atelierSection.classList.contains('is-free')) v.setMode('manual');
    else if (lastPose) { v.setScrollPose(lastPose); }
  },
});
if (!MOTION) atelierSection.classList.add('is-free');

/* build all scroll choreography once fonts are final (no late refresh hops) */
const fontsReady = Promise.race([document.fonts?.ready || Promise.resolve(), new Promise(r => setTimeout(r, 2000))]);
fontsReady.then(() => {
  if (MOTION) {
    coverIntro();
    coverScroll();
    atelierSequence();
    looksMotion();
    lookbook();
    spreadMotion();
  }
  startReveals();
  if (MOTION) ScrollTrigger.refresh();
  // deep link into the page after pins exist
  if (location.hash && location.hash !== '#upit') {
    const el = document.getElementById(location.hash.slice(1));
    if (el === atelierSection && seqST) setTimeout(() => { atelierSection.classList.add('is-free'); userTook = true; scrollToEl(seqST.end + 2, { immediate: true }); }, 60);
    else if (el) setTimeout(() => scrollToEl(el, { immediate: true }), 60);
  }
});

/* ---------------------------------------------------------------------------
   02 — spread: legend + markers on the group photo
   --------------------------------------------------------------------------- */
function renderShades() {
  const list = $('[data-shades]'), marks = $('[data-markers]');
  list.innerHTML = ENTRIES.map(e => {
    const c = COLORS[e.photoColor];
    return `<li><a href="#${e.id}" data-shade="${e.id}"><span class="num">${e.no}</span><span class="dot" style="--c:${c.ui}"></span><span class="nm">${c.label}</span><span class="cap">${e.label}</span></a></li>`;
  }).join('');
  marks.innerHTML = GROUP_PHOTO.markers.map(m => {
    const e = entryById(m.entry);
    return `<a class="marker" href="#${e.id}" data-shade="${e.id}" style="left:${m.x}%;top:${m.y}%" aria-label="${e.label} — ${COLORS[e.photoColor].label}">${e.no}</a>`;
  }).join('');
  const hot = (id, on) => $$(`[data-shade="${id}"]`).forEach(n => n.classList.toggle('is-hot', on));
  $$('[data-shade]').forEach(n => {
    n.addEventListener('mouseenter', () => hot(n.dataset.shade, true));
    n.addEventListener('mouseleave', () => hot(n.dataset.shade, false));
    n.addEventListener('focus', () => hot(n.dataset.shade, true));
    n.addEventListener('blur', () => hot(n.dataset.shade, false));
  });
}
function spreadMotion() {
  gsap.from('.marker', { scale: 0, opacity: 0, duration: 0.8, ease: 'back.out(2)', stagger: 0.08, scrollTrigger: { trigger: '.spread__photo', start: 'top 55%', once: true } });
  gsap.from('.shade-list li', { x: -24, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '.shade-list', start: 'top 85%', once: true } });
  $$('.detail-fig').forEach((f, i) => gsap.fromTo(f, { y: 60 + i * 30 }, { y: -30 - i * 20, ease: 'none', scrollTrigger: { trigger: '.spread__details', start: 'top bottom', end: 'bottom top', scrub: true } }));
}

/* ---------------------------------------------------------------------------
   04 — five looks (data-driven so photos ↔ 3D entries can never drift)
   --------------------------------------------------------------------------- */
function renderLooks() {
  const grid = $('[data-looks]');
  grid.innerHTML = ENTRIES.map((e, i) => {
    const c = COLORS[e.photoColor];
    const [name] = e.tempName.split(' — ');
    const alt = e.photos[1] || e.photos[0];
    return `
    <article class="look look--${i + 1}" id="${e.id}">
      <a class="look__media" href="${productUrl(e.id)}" data-clip="${i % 2 ? 'left' : ''}" aria-label="${e.label} — ${e.tempName}: detalji">
        <img src="${e.poster}" width="${e.photos[0].w}" height="${e.photos[0].h}" alt="${e.photos[0].alt}" loading="lazy">
        <img class="alt" src="${alt.src}" alt="" loading="lazy">
      </a>
      <span class="look__no" aria-hidden="true">${e.no}</span>
      <div class="look__body">
        <div><span class="cap">${e.label} · radni naziv</span><h3>${name} <em class="serif-it">— ${c.label.toLowerCase()}</em></h3></div>
        <span class="look__colour"><span class="dot" style="--c:${c.ui}"></span>${c.label}</span>
        <p>${e.caption}</p>
        <div class="look__actions">
          <button class="btn btn--sm" data-3d="${e.id}">Pogledaj u 3D</button>
          <a class="link" href="${productUrl(e.id)}">Detalji <i>→</i></a>
          <button class="link" data-inquire data-entry="${e.id}" data-color="${e.photoColor}">Upit <i>→</i></button>
        </div>
      </div>
    </article>`;
  }).join('') + `<p class="looks__note">Look 05 (slonovača) za sada postoji samo na grupnoj fotografiji. Ostale boje u 3D ateljeu su konfiguracije za pregled.</p>`;

  grid.addEventListener('click', e => {
    const b = e.target.closest('[data-3d]');
    if (!b) return;
    const entry = entryById(b.dataset['3d']);
    store.set({ entry: entry.id, color: entry.photoColor }, 'looks');
    goToAtelier();
  });
}
function looksMotion() {
  $$('.look__no').forEach(n => gsap.fromTo(n, { yPercent: 40 }, { yPercent: -40, ease: 'none', scrollTrigger: { trigger: n.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
  $$('.look__body').forEach(b => gsap.from(b.children, { y: 26, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: b, start: 'top 90%', once: true } }));
}

/* jump to the free, interactive atelier (end of the pinned sequence) */
function goToAtelier() {
  atelierSection.classList.add('is-free');
  if (seqST) {
    userTook = true;
    viewer?.setMode('manual');
    viewer?.view('front');
    scrollToEl(seqST.end + 2, { duration: 1.6 });
  } else scrollToEl(atelierSection);
}
$('[data-seq-skip]')?.addEventListener('click', e => { e.preventDefault(); goToAtelier(); });
// header / hero links to #atelje land on the interactive state too
$$('a[href="#atelje"]').forEach(a => a.addEventListener('click', e => {
  if (!seqST) return;
  e.preventDefault(); e.stopImmediatePropagation();
  goToAtelier();
}, true));

/* ---------------------------------------------------------------------------
   01 — cover entrance (short: the brand + actions are readable at once)
   --------------------------------------------------------------------------- */
function coverIntro() {
  const hdr = $('[data-hdr]');
  const pin = $('[data-cover]');
  if (scrollY > 40) { hdr.classList.remove('is-intro'); pin.style.opacity = 1; return; }
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  const mast = $('[data-mast]');
  gsap.set(mast, { clipPath: 'inset(-20% 0 0 0)' });
  tl.set(pin, { opacity: 1 })
    .fromTo('[data-cover-img]', { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.5, ease: 'expo.inOut' }, 0)
    .fromTo('[data-cover-img] img', { scale: 1.28 }, { scale: 1, duration: 2.2 }, 0.15)
    .fromTo('[data-mast] .ch', { yPercent: 102 }, { yPercent: 0, duration: 1.3, stagger: 0.045 }, 0.35)
    .fromTo('[data-cover-title] .ln > *', { yPercent: 112 }, { yPercent: 0, duration: 1.2, stagger: 0.09 }, 0.75)
    .fromTo('[data-cover-issue]', { '--rule': 0 }, { '--rule': 1, duration: 1.4 }, 0.6)
    .fromTo('[data-cover-issue] > span', { opacity: 0 }, { opacity: 1, duration: 1, stagger: 0.1 }, 0.8)
    // entrance animates INNER nodes; the scroll timeline owns the wrappers
    .fromTo(['[data-cover-cta] > *', '[data-cover-side] > *', '[data-cover-foot] > *'], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.06 }, 1.05)
    .add(() => hdr.classList.remove('is-intro'), 0.9)
    .add(() => gsap.set(mast, { clearProps: 'clipPath' }));
  // safety: never leave the cover hidden if the ticker stalls
  setTimeout(() => { if (tl.progress() < 1) tl.progress(1); hdr.classList.remove('is-intro'); }, 4200);
}

/* ---------------------------------------------------------------------------
   01 → 02 — the cover image becomes a framed editorial picture while the
   next title enters (desktop pin; mobile scrolls naturally)
   --------------------------------------------------------------------------- */
function coverScroll() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 961px)', () => {
    const img = $('[data-cover-img]');
    gsap.set(img, { xPercent: -50, x: 0 });
    const next = $('[data-cover-next]');
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.cover', start: 'top top', end: '+=115%', pin: true, scrub: 0.6, invalidateOnRefresh: true },
    });
    tl.to('[data-mast]', { yPercent: -55, opacity: 0, duration: 0.42 }, 0)
      .to('.cover__head', { y: -60, opacity: 0, duration: 0.3 }, 0)
      .to(['[data-cover-side]', '[data-cover-issue]', '[data-cover-foot]'], { opacity: 0, duration: 0.25 }, 0)
      .to(img, { x: () => -innerWidth * 0.22, y: () => -innerHeight * 0.04, scale: 0.9, duration: 1, ease: 'power2.inOut' }, 0)
      .to('[data-cover-frame]', { borderColor: 'rgba(255,255,255,.85)', inset: 14, duration: 0.5 }, 0.45)
      .to('[data-cover-cap]', { opacity: 1, duration: 0.3 }, 0.6)
      .set(next, { visibility: 'visible' }, 0.3)
      .fromTo('[data-cover-next] .eyebrow', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.35)
      .fromTo('[data-cover-next] .ln > *', { yPercent: 112 }, { yPercent: 0, duration: 0.35, stagger: 0.08, ease: 'power3.out' }, 0.38)
      .fromTo('[data-cover-next] .lede', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 }, 0.62)
      .to({}, { duration: 0.2 });
    return () => gsap.set(img, { clearProps: 'all' });
  });
  mm.add('(max-width: 960px)', () => {
    gsap.to('[data-cover-img] img', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.cover', start: 'top top', end: 'bottom top', scrub: true } });
  });
}

/* ---------------------------------------------------------------------------
   03 — signature 3D sequence. Explicit modes: the pin only drives the model
   while viewer.mode === 'scroll'; the first drag hands it to the visitor.
   --------------------------------------------------------------------------- */
const TAU = Math.PI * 2;
const KEYS = [
  { p: 0.00, rot: -0.55, dist: 5.4, elev: 0.12 },  // enters the studio
  { p: 0.16, rot: 0.0, dist: 3.5, elev: 0.04 },   // front silhouette
  { p: 0.36, rot: 0.82, dist: 3.6, elev: 0.05 },   // three-quarter
  { p: 0.56, rot: 0.38, dist: 1.5, elev: 0.03 },   // bodice + lace close-up
  { p: 0.77, rot: Math.PI, dist: 2.4, elev: 0.07 },// back / lacing
  { p: 0.93, rot: TAU, dist: 3.5, elev: 0.04 },   // full silhouette again
  { p: 1.00, rot: TAU, dist: 3.5, elev: 0.04 },
];
const STEP_AT = [0, 0.22, 0.45, 0.66, 0.86];
function poseAt(p) {
  let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  let t = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
  t = t * t * (3 - 2 * t);
  return { rot: a.rot + (b.rot - a.rot) * t, dist: a.dist + (b.dist - a.dist) * t, elev: a.elev + (b.elev - a.elev) * t };
}
function atelierSequence() {
  const mm = gsap.matchMedia();
  const steps = $$('.seq-step:not(.is-mobile)');
  const bars = $$('.seq-progress i');

  mm.add('(min-width: 961px)', () => {
    let current = -1;
    const show = idx => {
      if (idx === current) return;
      steps.forEach((s, i) => gsap.to(s, { opacity: i === idx ? 1 : 0, y: i === idx ? 0 : (i < idx ? -24 : 24), duration: 0.6, ease: 'power3.out', overwrite: true }));
      current = idx;
    };
    gsap.set(steps, { yPercent: -50, y: 24 });
    // stage opens as the section arrives
    gsap.fromTo('[data-stage]', { clipPath: 'inset(10% 16% 10% 16%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: atelierSection, start: 'top bottom', end: 'top top', scrub: true } });
    gsap.fromTo('.atelier__ghost', { xPercent: 12 }, { xPercent: -12, ease: 'none', scrollTrigger: { trigger: atelierSection, start: 'top bottom', end: 'bottom top', scrub: true } });

    seqST = ScrollTrigger.create({
      trigger: atelierSection, start: 'top top', end: () => '+=' + Math.round(innerHeight * 2.8),
      pin: '[data-atelier-pin]', invalidateOnRefresh: true,
      onUpdate(self) {
        const p = self.progress;
        lastPose = poseAt(p);
        let idx = 0; STEP_AT.forEach((s, i) => { if (p >= s) idx = i; });
        show(idx);
        bars.forEach((b, i) => b.style.setProperty('--p', Math.min(1, Math.max(0, (p - STEP_AT[i]) / ((STEP_AT[i + 1] ?? 1) - STEP_AT[i])))));
        const free = p >= 0.985 || userTook;
        atelierSection.classList.toggle('is-free', free);
        if (!viewer) return;
        if (userTook) return;                       // the visitor owns the model now
        if (free) viewer.setMode('manual');
        else { viewer.setMode('scroll'); viewer.setScrollPose(lastPose); }
      },
    });
    return () => { seqST = null; };
  });

  mm.add('(max-width: 960px)', () => {
    // short, unpinned: the model turns gently while the stage passes by
    $('[data-seq-mobile]')?.classList.add('is-mobile');
    ScrollTrigger.create({
      trigger: '[data-stage]', start: 'top 85%', end: 'bottom 25%',
      onUpdate(self) {
        if (!viewer || userTook) return;
        viewer.setMode('scroll');
        viewer.setScrollPose({ rot: -0.9 + self.progress * 1.8, dist: 3.5, elev: 0.04 });
      },
      onLeave() { if (viewer && !userTook) viewer.setMode('manual'); },
    });
  });
}

/* ---------------------------------------------------------------------------
   05 — lookbook: vertical scroll drives a horizontal spread (desktop)
   --------------------------------------------------------------------------- */
function lookbook() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 961px)', () => {
    const track = $('[data-lb-track]'), bar = $('[data-lb-bar]'), count = $('[data-lb-count]');
    const panels = $$('.lb__panel', track);
    const imgs = $$('.lb__panel .media img', track);
    gsap.set(imgs, { scale: 1.12 });
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '#lookbook', start: 'top top', end: () => '+=' + dist(), pin: '[data-lb-pin]', scrub: 0.8, invalidateOnRefresh: true,
        onUpdate(self) {
          bar.style.setProperty('--p', self.progress.toFixed(4));
          const n = Math.min(panels.length, 1 + Math.floor(self.progress * panels.length));
          count.textContent = `${String(n).padStart(2, '0')} / ${String(panels.length).padStart(2, '0')}`;
          // in-frame drift: each photo slides slightly against the track
          const W = innerWidth;
          for (const im of imgs) {
            const r = im.parentElement.getBoundingClientRect();
            const c = (r.left + r.width / 2 - W / 2) / W;
            im.style.transform = `translateX(${(-c * 7).toFixed(2)}%) scale(1.12)`;
          }
        },
      },
    });
    gsap.from('.lb__title h2', { yPercent: 30, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '#lookbook', start: 'top 70%', once: true } });
  });
}

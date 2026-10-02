/* ==========================================================================
   3D atelier viewer — ONE renderer per page, mounted into a host element.

   Scene modes (explicit, so scroll + hand never fight):
     'scroll'  — the page's scroll sequence drives the pose (setScrollPose)
     'manual'  — the visitor drives it (drag, keys, presets, zoom)
   The first drag / key / preset switches to 'manual' and emits 'interact'.

   Renders on demand: the loop sleeps when nothing moves and while the
   stage is off-screen.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMannequin, loadDressForm, MANNEQUIN } from './mannequin.js';
import { L, setBodyProfile } from './body.js';
import { buildCorsetMini, clearanceReport } from './garment.js';
import { makeLaceSet, makeWeave, makeBlob, loadLacePattern } from './textures.js';
import { DESIGNS, COLORS, entryById } from '../data.js';

const PROCEDURAL = { corsetMini: buildCorsetMini };

export const PRESETS = {
  front:  { rot: 0, dist: 3.5, elev: 0.04 },
  back:   { rot: Math.PI, dist: 2.4, elev: 0.06 },
  detail: { rot: 0.36, dist: 1.42, elev: 0.03 },
};
export const DIST = { min: 1.3, max: 5.0, full: 3.5 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const tyForDist = d => (L.waist - 0.1) + ((L.bust - 0.016) - (L.waist - 0.1)) * clamp((DIST.full - d) / (DIST.full - 1.42), 0, 1.1);

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch { return false; }
}

/* scallop cut-out for lace edges (needs the `edge` attribute) */
function withEdge(mat) {
  const m = mat.clone();
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 edge;\nvarying vec2 vEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEdge = edge;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vEdge;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float sx = fract(vEdge.x / 0.026) * 2.0 - 1.0;
        float bound = 0.0105 * (1.0 - sqrt(max(0.0, 1.0 - sx * sx)));
        if (vEdge.y < bound) discard;
        vec2 hp = vec2(fract(vEdge.x / 0.026) - 0.5, vEdge.y - 0.0125);
        if (length(hp * vec2(0.026, 1.0)) < 0.0019 && vEdge.y < 0.02) discard;`);
  };
  m.customProgramCacheKey = () => 'edge' + mat.type;
  return m;
}

export function createViewer(host, opts = {}) {
  if (!webglAvailable()) throw new Error('webgl-unavailable');
  const mobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;

  /* ---- renderer / scene ------------------------------------------------ */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'atelier-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '3D prikaz haljine na lutki. Prevucite ili koristite strelice za rotaciju.');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 30);

  // soft photographic studio: broad key, fill, rim, warm bounce
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0xd9cbb8, 0.75));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
  key.position.set(-2.2, 3.6, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -1.1, right: 1.1, top: 2.0, bottom: -0.2, near: 0.5, far: 9 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xf1ecf4, 0.7); fill.position.set(3, 1.6, 2.4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(0.6, 2.6, -3.4); scene.add(rim);

  // floor: contact shadow + soft blob
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.13 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.018; floor.receiveShadow = true;
  scene.add(floor);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ map: makeBlob(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = -0.017; scene.add(blob);

  const figure = new THREE.Group(); scene.add(figure);

  /* ---- materials (garment targets kept separate from everything else) -- */
  const weave = makeWeave();
  weave.repeat.set(14, 14);
  const skin = new THREE.MeshStandardMaterial({ color: 0xd6cab8, roughness: 0.8, metalness: 0, envMapIntensity: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc8b48d, roughness: 0.34, metalness: 0.75, envMapIntensity: 0.9 });
  const base = {
    shell: new THREE.MeshPhysicalMaterial({ roughness: 0.6, sheen: 1, sheenRoughness: 0.42, normalMap: weave, normalScale: new THREE.Vector2(0.16, 0.16), envMapIntensity: 0.7 }),
    lining: new THREE.MeshStandardMaterial({ roughness: 0.82, side: THREE.BackSide, envMapIntensity: 0.4 }),
    lace: new THREE.MeshPhysicalMaterial({ roughness: 1, metalness: 1, alphaTest: 0.45, side: THREE.DoubleSide, sheen: 0.6, sheenRoughness: 0.5, envMapIntensity: 0.85 }),
    trim: new THREE.MeshPhysicalMaterial({ roughness: 0.38, sheen: 0.8, sheenRoughness: 0.3, normalMap: weave, normalScale: new THREE.Vector2(0.08, 0.08), envMapIntensity: 0.8 }),
    cord: new THREE.MeshStandardMaterial({ roughness: 0.5, envMapIntensity: 0.6 }),
    tulle: new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.2, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  };
  base.sleeve = base.lace.clone();
  base.sleeve.alphaTest = 0.66;  // sleeves: unlined, most of the net drops out → more transparent than the body
  const edgeMats = { lace: withEdge(base.lace), sleeve: withEdge(base.sleeve), tulle: withEdge(base.tulle) };
  // colour targets: material → which colour key it follows
  const colourOf = [
    [base.shell, 'shell'], [base.lining, 'lining'], [base.lace, 'lace'], [edgeMats.lace, 'lace'],
    [base.trim, 'trim'], [base.cord, 'cord'], [base.sleeve, 'sleeve'], [edgeMats.sleeve, 'sleeve'],
    [base.tulle, 'sleeve'], [edgeMats.tulle, 'sleeve'],
  ];
  const targetCol = new Map(colourOf.map(([m]) => [m, new THREE.Color()]));
  const laceMats = [base.lace, edgeMats.lace, base.sleeve, edgeMats.sleeve];

  /* ---- state ------------------------------------------------------------ */
  const st = {
    rot: 0, dist: 7.5, elev: 0.06,          // current
    tRot: 0, tDist: DIST.full, tElev: 0.04, // target
    mode: opts.mode || 'manual',
    auto: !!opts.autoRotate,
    vel: 0, dragging: false,
    entry: null, color: null, design: null, display: 'mannequin',
    colourT: 1, pulse: 0, visible: true, disposed: false, tyOff: 0,
  };
  const listeners = {};
  const emit = (e, d) => (listeners[e] || []).forEach(f => f(d));

  // mannequin: owner-supplied dress form (measured) → procedural fallback.
  // The body profile MUST be set before any garment geometry is built.
  let mannequin = null, hasArms = true;
  const bodyReady = (async () => {
    const lace = loadLacePattern();   // owner's rose lace (falls back to procedural)
    if (MANNEQUIN.src) {
      try {
        const { group, profile } = await loadDressForm();
        setBodyProfile(profile);
        mannequin = group; hasArms = !!MANNEQUIN.hasArms;
      } catch (e) { console.warn('[atelier] dress form failed, using procedural mannequin:', e); }
    }
    if (!mannequin) { mannequin = buildMannequin(skin, metal); hasArms = true; }
    figure.add(mannequin);
    mannequin.visible = st.display === 'mannequin';
    const fy = hasArms ? -0.018 : 0.0005;
    floor.position.y = fy; blob.position.y = fy + 0.001;
    await lace;
    emit('body', { hasArms, source: L.source });
  })();
  let garment = new THREE.Group(); figure.add(garment);
  const designCache = new Map(), laceCache = new Map();
  let parts = null;

  async function loadDesign(id) {
    if (designCache.has(id)) return designCache.get(id);
    const d = DESIGNS[id];
    let p = null;
    if (d.model.src) {
      try { p = await loadGLBParts(d); } catch (e) { console.warn('[atelier] GLB failed, using prototype:', e); }
    }
    if (!p) p = PROCEDURAL[d.model.procedural]();
    designCache.set(id, p);
    return p;
  }

  function buildGarment(p) {
    const g = new THREE.Group(); g.name = 'garment';
    for (const part of p) {
      let mat = part.edge ? edgeMats[part.target] : base[part.target];
      if (part.material) {
        // finished GLB: keep its authored maps, but let the colour system drive .color
        mat = part.material;
        if (!targetCol.has(mat)) { colourOf.push([mat, part.target === 'tulle' ? 'sleeve' : part.target]); targetCol.set(mat, new THREE.Color()); }
      }
      const m = new THREE.Mesh(part.geometry, mat);
      m.name = part.name;
      m.castShadow = ['shell', 'trim'].includes(part.target);
      m.receiveShadow = part.target !== 'tulle';
      m.renderOrder = part.target === 'tulle' ? 2 : 0;
      g.add(m);
      if (part.lining) {
        const l = new THREE.Mesh(part.geometry, base.lining);
        l.name = part.name + '_lining'; l.receiveShadow = true;
        g.add(l);
      }
    }
    return g;
  }

  function applyLace(entry) {
    let set = laceCache.get(entry.id);
    if (!set) {
      set = makeLaceSet(entry.surface, mobile ? 512 : 1024);
      laceCache.set(entry.id, set);
      // keep at most two lace sets alive
      for (const [k, v] of laceCache) if (laceCache.size > 2 && k !== entry.id) {
        Object.values(v).forEach(t => t.dispose()); laceCache.delete(k);
      }
    }
    const ns = 0.55 * (entry.surface.relief || 1);
    for (const m of laceMats) {
      m.map = set.map; m.normalMap = set.normalMap; m.roughnessMap = set.ormMap; m.metalnessMap = set.ormMap;
      m.normalScale = new THREE.Vector2(ns, ns);
      m.needsUpdate = true;
    }
  }

  function setColour(colorId, instant = false) {
    const c = COLORS[colorId] || COLORS[Object.keys(COLORS)[0]];
    for (const [m, key] of colourOf) {
      targetCol.get(m).set(c.targets[key]);
      if (instant) m.color.copy(targetCol.get(m));
    }
    st.colourT = instant ? 1 : 0;
    st.color = colorId;
    invalidate();
  }

  async function setEntry(entryId, colorId) {
    const entry = entryById(entryId);
    const colour = colorId || entry.photoColor;
    const first = !st.entry;
    await bodyReady;
    const designChanged = entry.design !== st.design;
    const surfaceChanged = !st.entry || st.entry !== entry.id;
    if (!designChanged && !surfaceChanged) { setColour(colour); emit('change', { entry: entry.id, color: colour }); return; }

    host.classList.add('is-switching');
    if (!first) await new Promise(r => setTimeout(r, 180));
    if (designChanged) {
      parts = await loadDesign(entry.design);
      figure.remove(garment);
      garment = buildGarment(parts);
      garment.visible = true;
      figure.add(garment);
      updateSleeves();
      st.design = entry.design;
    }
    applyLace(entry);
    st.entry = entry.id;
    setColour(colour, first);
    st.pulse = first ? 0 : 1;
    host.classList.remove('is-switching');
    invalidate();
    emit('change', { entry: entry.id, color: colour });
  }

  /* ---- interaction ------------------------------------------------------ */
  function toManual(reason) {
    if (st.mode !== 'manual') { st.mode = 'manual'; emit('mode', { mode: 'manual', reason }); }
    if (st.auto) { st.auto = false; emit('autorotate', false); }
    emit('interact', reason);
  }
  let px = 0, py = 0, lastT = 0, pid = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    pid = e.pointerId; try { canvas.setPointerCapture(pid); } catch {}
    st.dragging = true; st.vel = 0; px = e.clientX; py = e.clientY; lastT = performance.now();
    host.classList.add('is-dragging');
    toManual('drag'); invalidate();
  });
  canvas.addEventListener('pointermove', e => {
    if (!st.dragging || e.pointerId !== pid) return;
    const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    const now = performance.now(), dt = Math.max(1, now - lastT); lastT = now;
    const k = 0.0105;
    st.tRot += dx * k;
    const v = clamp((dx * k) / (Math.max(dt, 8) / 1000), -5, 5);
    st.vel = st.vel * 0.5 + v * 0.5;   // smoothed fling, bounded spin
    if (e.pointerType !== 'touch') st.tElev = clamp(st.tElev + dy * 0.0028, -0.12, 0.34);
    invalidate();
  });
  const end = e => {
    if (!st.dragging) return;
    st.dragging = false; host.classList.remove('is-dragging');
    try { if (pid != null && canvas.hasPointerCapture(pid)) canvas.releasePointerCapture(pid); } catch {}
    pid = null;
    if (performance.now() - lastT > 80) st.vel = 0;
    invalidate();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', e => {
    const map = { ArrowLeft: () => (st.tRot -= 0.3), ArrowRight: () => (st.tRot += 0.3),
      ArrowUp: () => (st.tElev = clamp(st.tElev + 0.05, -0.12, 0.34)), ArrowDown: () => (st.tElev = clamp(st.tElev - 0.05, -0.12, 0.34)),
      '+': () => zoom(1), '=': () => zoom(1), '-': () => zoom(-1) };
    if (map[e.key]) { e.preventDefault(); toManual('key'); map[e.key](); invalidate(); }
  });

  function zoom(dir) {
    toManual('zoom');
    st.tDist = clamp(st.tDist * (dir > 0 ? 0.78 : 1.28), DIST.min, DIST.max);
    invalidate();
  }
  function view(name) {
    toManual('preset');
    const p = name === 'reset' ? PRESETS.front : PRESETS[name];
    if (!p) return;
    // shortest turn towards the preset angle
    const twoPi = Math.PI * 2;
    const cur = st.tRot;
    const delta = ((((p.rot - cur) % twoPi) + twoPi * 1.5) % twoPi) - Math.PI;
    st.tRot = cur + delta;
    st.tDist = p.dist; st.tElev = p.elev; st.vel = 0;
    if (name === 'reset') { setDisplay('mannequin'); }
    invalidate();
  }
  function setScrollPose(p) {
    if (st.mode !== 'scroll') return;
    st.tRot = p.rot; st.tDist = p.dist; st.tElev = p.elev ?? 0.04;
    invalidate();
  }
  function setMode(m) { if (st.mode !== m) { st.mode = m; if (m === 'manual') { st.tRot = normalise(st.tRot); st.rot = normalise(st.rot); } emit('mode', { mode: m }); } }
  const normalise = a => { const t = Math.PI * 2; return ((a % t) + t * 1.5) % t - Math.PI; };
  // detached sleeves are independent meshes: always shown, floating where the arms would be
  function updateSleeves() {
    garment.traverse(o => { if (o.isMesh && /^sleeve/.test(o.name)) o.visible = true; });
  }
  function setDisplay(d) {
    if (d === st.display) return;
    st.display = d; if (mannequin) mannequin.visible = d === 'mannequin';
    updateSleeves();
    blob.visible = d === 'mannequin';
    // frame the garment on its own; restore the full figure afterwards
    if (d === 'dress' && st.tDist > 2.7) st.tDist = 2.6;
    if (d === 'mannequin' && st.tDist < 3.2 && st.mode !== 'scroll') st.tDist = DIST.full;
    emit('display', d); invalidate();
  }
  function setAutoRotate(b) { st.auto = b; if (b && st.mode === 'scroll') st.mode = 'manual'; emit('autorotate', b); invalidate(); }

  /* ---- loop ------------------------------------------------------------- */
  let raf = 0, last = 0, readyFired = false;
  const tmpC = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  function step(dt) {
    let moving = false;
    if (st.auto && !st.dragging) { st.tRot += dt * 0.32; moving = true; }
    if (!st.dragging && Math.abs(st.vel) > 0.02) { st.tRot += st.vel * dt; st.vel *= Math.pow(0.04, dt); moving = true; }
    const k = st.mode === 'scroll' ? 7.5 : 6.5;
    const a = 1 - Math.exp(-dt * (st.dragging ? 16 : k));
    st.rot += (st.tRot - st.rot) * a;
    st.dist += (st.tDist - st.dist) * a;
    st.elev += (st.tElev - st.elev) * a;
    if (Math.abs(st.tyOff - (st.display === 'dress' ? -0.1 : 0)) > 1e-4 || Math.abs(st.tRot - st.rot) > 1e-4 || Math.abs(st.tDist - st.dist) > 1e-4 || Math.abs(st.tElev - st.elev) > 1e-4) moving = true;
    if (st.colourT < 1) {
      st.colourT = Math.min(1, st.colourT + dt / 0.6);
      const b = 1 - Math.exp(-dt * 7);
      for (const [m] of colourOf) m.color.lerp(targetCol.get(m), st.colourT >= 1 ? 1 : b);
      moving = true;
    }
    for (const [m] of colourOf) {
      if (m.sheenColor) {
        const lum = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11;
        m.sheenColor.copy(m.color).lerp(white, 0.3);
        if (lum < 0.05) m.sheenColor.copy(tmpC.setRGB(0.09, 0.085, 0.1)); // black keeps its folds
      }
    }
    if (st.pulse > 0.001) { st.pulse *= Math.pow(0.02, dt); moving = true; } else st.pulse = 0;
    figure.rotation.y = st.rot;
    const s = 1 - 0.018 * st.pulse;
    garment.scale.setScalar(s); garment.position.y = (1 - s) * 0.9;
    st.tyOff += ((st.display === 'dress' ? -0.1 : 0) - st.tyOff) * a;
    const ty = tyForDist(st.dist) + st.tyOff * clamp((st.dist - 1.4) / 1.2, 0, 1);
    camera.position.set(0, ty + Math.sin(st.elev) * st.dist, Math.cos(st.elev) * st.dist);
    camera.lookAt(0, ty, 0);
    return moving;
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const moving = step(dt);
    renderer.render(scene, camera);
    if (!readyFired && st.entry) { readyFired = true; host.classList.add('is-ready'); emit('ready'); }
    emit('frame', st);
    if (moving && st.visible && !st.disposed) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function invalidate() {
    if (!raf && st.visible && !st.disposed) raf = requestAnimationFrame(frame);
  }

  /* ---- mount / resize / visibility -------------------------------------- */
  const ro = new ResizeObserver(() => resize());
  const io = new IntersectionObserver(es => {
    st.visible = es[0].isIntersecting;
    if (st.visible) invalidate();
  }, { rootMargin: '120px' });
  function resize() {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole dress in frame on narrow stages
    camera.fov = w / h < 0.62 ? 31 : 28;
    camera.updateProjectionMatrix();
    invalidate();
  }
  function mount(el) {
    ro.disconnect(); io.disconnect();
    host = el;
    host.prepend(canvas);
    ro.observe(host); io.observe(host);
    resize();
  }
  mount(host);

  function dispose() {
    st.disposed = true; cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    for (const v of laceCache.values()) Object.values(v).forEach(t => t.dispose());
    renderer.dispose(); canvas.remove();
  }

  const api = {
    setEntry, setColour, view, zoom, setScrollPose, setMode, setDisplay, setAutoRotate, mount, dispose,
    get hasArms() { return hasArms; }, bodyReady,
    get mode() { return st.mode; }, get state() { return st; }, get scene() { return scene; },
    on(e, f) { (listeners[e] ||= []).push(f); return api; },
    clearance: () => (parts ? clearanceReport(parts) : null),
    invalidate,
  };
  window.__zba = api;
  return api;
}

/* ---- finished GLB garments ---------------------------------------------
   Expected: metres, Y-up, feet at y = 0, authored on the reference
   mannequin (export it from models/README). Mesh or material names map to
   targets via DESIGNS[id].materialTargets. */
async function loadGLBParts(design) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(new URL(design.model.src, new URL('../../', import.meta.url)).href);
  const parts = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const names = `${o.name} ${(o.material && o.material.name) || ''}`.toLowerCase();
    let target = 'shell';
    for (const [t, keys] of Object.entries(design.materialTargets)) if (keys.some(k => names.includes(k))) { target = t; break; }
    const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
    const material = o.material.clone();
    parts.push({ name: o.name, target, geometry: geo, material, lining: target === 'shell' && material.side === THREE.FrontSide });
  });
  if (!parts.length) throw new Error('GLB has no meshes');
  return parts;
}

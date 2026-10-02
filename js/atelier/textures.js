/* ==========================================================================
   Procedural fabric textures (canvas → THREE textures).
   Lace tile = TILE metres of fabric, seamlessly tileable.
   Colour lives in the material — these maps are neutral so a colour change
   never destroys texture or shading:
     map        RGB = relief shade (neutral), A = lace coverage (cut-out)
     normalMap  derived from the coverage/height field
     ormMap     G = roughness, B = metalness (sequins / beads only)
   ========================================================================== */
import * as THREE from 'three';

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const STYLES = {
  // motif count per tile, flower radius range, net cell, fill solidity, leaves
  floral:      { motifs: 12, rMin: 0.11, rMax: 0.17, net: 11, fill: 0.85, leaves: 3, vines: 10, beads: 0.55 },
  sequin:      { motifs: 12, rMin: 0.1,  rMax: 0.15, net: 10, fill: 0.9,  leaves: 2, vines: 9,  beads: 1.0 },
  embroidered: { motifs: 16, rMin: 0.08, rMax: 0.12, net: 9,  fill: 0.95, leaves: 3, vines: 12, beads: 0.25 },
  applique:    { motifs: 10, rMin: 0.13, rMax: 0.19, net: 12, fill: 0.95, leaves: 3, vines: 7,  beads: 0.4 },
};

/* draw `fn` at every wrap offset so the tile is seamless */
function wrapDraw(ctx, S, x, y, r, fn) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    const px = x + ox, py = y + oy;
    if (px + r < 0 || px - r > S || py + r < 0 || py - r > S) continue;
    ctx.save(); ctx.translate(px, py); fn(ctx); ctx.restore();
  }
}

/* owner-supplied rose lace (img/lace/rose-coverage.png, from tools/make_lace.py) */
let LACE_IMG = null;
export function loadLacePattern() {
  if (LACE_IMG) return Promise.resolve(LACE_IMG);
  return new Promise(res => {
    const im = new Image();
    im.onload = () => { LACE_IMG = im; res(im); };
    im.onerror = () => res(null);                        // procedural fallback
    im.src = new URL('../../img/lace/rose-coverage.png', import.meta.url).href;
  });
}

export function makeLaceSet(surface, size = 1024) {
  const st = STYLES[surface.lace] || STYLES.floral;
  const R = rng(surface.seed || 7);
  const S = size;
  const k = S / 1024;

  // coverage / height canvas (white on black, grayscale)
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
  c.lineCap = 'round'; c.lineJoin = 'round';

  const fromImage = !!LACE_IMG;
  if (fromImage) c.drawImage(LACE_IMG, 0, 0, S, S);
  else {
  /* 1 — tulle net (hexagonal) */
  const cell = st.net * k;
  c.strokeStyle = 'rgb(165,165,165)'; c.lineWidth = 2.2 * k;
  c.beginPath();
  const hx = cell * Math.sqrt(3);
  const cols = Math.ceil(S / hx) + 1, rows = Math.ceil(S / (cell * 1.5)) + 1;
  const hxAdj = S / Math.round(S / hx), vy = S / Math.round(S / (cell * 1.5));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const cx = i * hxAdj + (j % 2 ? hxAdj / 2 : 0), cy = j * vy;
    for (let a = 0; a < 6; a++) {
      const a0 = Math.PI / 3 * a + Math.PI / 6, a1 = a0 + Math.PI / 3;
      c.moveTo(cx + Math.cos(a0) * cell, cy + Math.sin(a0) * cell);
      c.lineTo(cx + Math.cos(a1) * cell, cy + Math.sin(a1) * cell);
    }
  }
  c.stroke();

  /* 2 — vines (scrolling cords) */
  for (let i = 0; i < st.vines * surface.density; i++) {
    const x = R() * S, y = R() * S, len = (0.18 + R() * 0.22) * S, a = R() * Math.PI * 2;
    wrapDraw(c, S, x, y, len, ctx => {
      ctx.rotate(a);
      ctx.strokeStyle = 'rgb(235,235,235)'; ctx.lineWidth = 5 * k;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(len * 0.3, -len * 0.25, len * 0.6, len * 0.25, len, 0);
      ctx.stroke();
      // tendrils
      for (let t = 0.2; t < 1; t += 0.22) {
        const px = len * t, py = Math.sin(t * Math.PI * 2) * len * 0.12;
        ctx.lineWidth = 3 * k; ctx.beginPath();
        ctx.arc(px, py - 10 * k, 10 * k, Math.PI * 0.5, Math.PI * 1.9); ctx.stroke();
      }
    });
  }

  /* 3 — leaves */
  const leaf = (ctx, L, W) => {
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.5, -W, L, 0); ctx.quadraticCurveTo(L * 0.5, W, 0, 0);
    ctx.fillStyle = `rgb(${Math.round(200 * st.fill)},${Math.round(200 * st.fill)},${Math.round(200 * st.fill)})`; ctx.fill();
    ctx.strokeStyle = 'rgb(255,255,255)'; ctx.lineWidth = 4 * k; ctx.stroke();
    ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(L * 0.1, 0); ctx.lineTo(L * 0.85, 0); ctx.stroke();
    // openwork holes in the leaf
    ctx.fillStyle = 'rgb(40,40,40)';
    for (let t = 0.3; t < 0.8; t += 0.18) { ctx.beginPath(); ctx.arc(L * t, W * 0.22, 2.4 * k, 0, 7); ctx.arc(L * t, -W * 0.22, 2.4 * k, 0, 7); ctx.fill(); }
  };

  /* 4 — flowers: petals with corded outline + spiral centre */
  const n = Math.round(st.motifs * surface.density);
  const centres = [];
  for (let i = 0; i < n; i++) {
    // jittered grid so motifs don't clump
    const cols = Math.ceil(Math.sqrt(n)), rws = Math.ceil(n / cols);
    const gx = (i % cols + 0.5 + (R() - 0.5) * 0.8) / cols, gy = (Math.floor(i / cols) + 0.5 + (R() - 0.5) * 0.8) / rws;
    const x = gx * S, y = (((gy % 1) + 1) % 1) * S;
    const r = (st.rMin + R() * (st.rMax - st.rMin)) * S;
    const petals = 5 + Math.floor(R() * 3), rot = R() * Math.PI;
    centres.push({ x, y, r });
    wrapDraw(c, S, x, y, r * 1.8, ctx => {
      ctx.rotate(rot);
      for (let l = 0; l < st.leaves; l++) {
        ctx.save(); ctx.rotate((l / st.leaves) * Math.PI * 2 + 0.4); ctx.translate(r * 0.85, 0);
        leaf(ctx, r * 0.95, r * 0.32); ctx.restore();
      }
      for (let p = 0; p < petals; p++) {
        ctx.save(); ctx.rotate((p / petals) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(r * 0.52, 0, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
        const f = Math.round(215 * st.fill);
        ctx.fillStyle = `rgb(${f},${f},${f})`; ctx.fill();
        ctx.strokeStyle = 'rgb(255,255,255)'; ctx.lineWidth = 5.5 * k; ctx.stroke();
        // inner petal line + openwork
        ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.3, r * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgb(30,30,30)';
        ctx.beginPath(); ctx.arc(r * 0.82, 0, 3 * k, 0, 7); ctx.fill();
        ctx.restore();
      }
      // inner cupped petal ring → reads as a rose, not a daisy
      for (let p = 0; p < 4; p++) {
        ctx.save(); ctx.rotate((p / 4) * Math.PI * 2 + 0.5);
        ctx.beginPath(); ctx.ellipse(r * 0.24, 0, r * 0.24, r * 0.17, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgb(225,225,225)'; ctx.fill();
        ctx.strokeStyle = 'rgb(255,255,255)'; ctx.lineWidth = 3.5 * k; ctx.stroke();
        ctx.restore();
      }
      // spiral rose centre
      ctx.strokeStyle = 'rgb(255,255,255)'; ctx.lineWidth = 3.5 * k; ctx.beginPath();
      for (let a = 0; a < Math.PI * 6; a += 0.2) {
        const rr = (a / (Math.PI * 6)) * r * 0.34;
        a === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.stroke();
    });
  }

  } // procedural motifs
  const cov = c.getImageData(0, 0, S, S).data;

  /* 5 — sequins / beads (gloss + metal) placed on lace */
  const sc = document.createElement('canvas'); sc.width = sc.height = S;
  const s2 = sc.getContext('2d');
  s2.fillStyle = 'rgb(255,255,0)'; s2.fillRect(0, 0, S, S); // G=255 → not a bead
  const beads = Math.round(4200 * surface.sparkle * st.beads * k * k);
  for (let i = 0; i < beads; i++) {
    const x = R() * S, y = R() * S;
    const v = cov[(((y | 0) * S + (x | 0)) * 4)];
    if (v < 120) continue;
    const r = (1.4 + R() * (surface.lace === 'sequin' ? 2.6 : 1.4)) * k;
    wrapDraw(s2, S, x, y, r, ctx => {
      ctx.fillStyle = `rgb(255,${Math.round(255 * (0.1 + R() * 0.25))},${Math.round(255 * (0.5 + R() * 0.45))})`;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    });
  }
  const spark = s2.getImageData(0, 0, S, S).data;

  /* height (blurred coverage) → normal map */
  const hc = document.createElement('canvas'); hc.width = hc.height = S;
  const h2 = hc.getContext('2d');
  h2.filter = `blur(${1.6 * k}px)`;
  // draw 3x3 so blur wraps
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) h2.drawImage(cv, ox, oy);
  const hd = h2.getImageData(0, 0, S, S).data;

  const map = new ImageData(S, S), nrm = new ImageData(S, S), orm = new ImageData(S, S);
  const relief = 1.5 * (surface.relief || 1);   // gentle: lace, not crust
  const H = (x, y) => hd[((((y + S) % S) * S + ((x + S) % S)) * 4)] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const cv0 = cov[i] / 255;
    const sp = spark[i + 2] / 255, isBead = spark[i + 1] < 200;
    // albedo shade: net darker, motif cords bright
    const shade = 0.72 + 0.28 * cv0 + (isBead ? 0.1 : 0);
    map.data[i] = map.data[i + 1] = map.data[i + 2] = Math.min(255, shade * 255);
    map.data[i + 3] = Math.min(255, cv0 * 255 * 1.35 + (isBead ? 255 : 0));
    // normal from height (Sobel)
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * relief, ny = dy * relief, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    nrm.data[i] = (nx * 0.5 + 0.5) * 255; nrm.data[i + 1] = (ny * 0.5 + 0.5) * 255; nrm.data[i + 2] = (nz * 0.5 + 0.5) * 255; nrm.data[i + 3] = 255;
    // roughness / metalness
    orm.data[i] = 255;
    orm.data[i + 1] = isBead ? spark[i + 1] : (0.86 - 0.12 * cv0) * 255;
    orm.data[i + 2] = isBead ? sp * 255 * 0.85 : 0;
    orm.data[i + 3] = 255;
  }
  const tex = (img, srgb) => {
    const cc = document.createElement('canvas'); cc.width = cc.height = S;
    cc.getContext('2d').putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cc);
    t.wrapS = t.wrapT = fromImage ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(map, true), normalMap: tex(nrm, false), ormMap: tex(orm, false) };
}

/* fine satin / crepe weave normal map for the shell (tileable) */
export function makeWeave(size = 256) {
  const S = size, img = new ImageData(S, S);
  const R = rng(99);
  const noise = new Float32Array(S * S).map(() => R());
  const h = (x, y) => {
    x = (x + S) % S; y = (y + S) % S;
    const w = Math.sin((x / S) * Math.PI * 2 * 48) * 0.5 + Math.sin((y / S) * Math.PI * 2 * 96) * 0.3;
    return w * 0.35 + noise[y * S + x] * 0.25;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz);
    const i = (y * S + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  const cc = document.createElement('canvas'); cc.width = cc.height = S;
  cc.getContext('2d').putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cc);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  t.repeat.set(1, 1);
  return t;
}

/* soft radial contact shadow */
export function makeBlob() {
  const S = 256, cc = document.createElement('canvas'); cc.width = cc.height = S;
  const c = cc.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(40,30,22,0.42)'); g.addColorStop(0.45, 'rgba(40,30,22,0.16)'); g.addColorStop(1, 'rgba(40,30,22,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cc); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

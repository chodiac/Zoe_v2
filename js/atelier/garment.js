/* ==========================================================================
   "korset mini" — procedural garment, rev. 2 (construction corrected from
   the owner's photographs + front/back construction sketch).

   Construction (front ⇄ back mirror, see ASSETS.md for observed/inferred):
     · fitted bodice with sculpted sweetheart cups, bridged centre
     · wide draped satin overlay across the lower cups + small centre keeper
     · elongated CENTRAL PANEL (front and back): hugs the abdomen / seat,
       then falls as a modest A-line into the middle of the skirt
     · gathered SIDE sections: strong hip volume, broad irregular folds
     · 4 long flat satin bands (2 front, 2 back) border the central panels,
       starting at the hips and running inward to the hem
     · real OPEN BACK: two separate rear panels, V-shaped gap, bound edges,
       crossed cords spanning empty space (nothing fills the gap)
     · detached floating lace sleeves (separate meshes, no arms)

   Every surface is derived from bodyPoint() + a fabric offset, so it sits
   on the (measured) mannequin without clipping:
     shell +9 mm · lace +12.5 mm · satin overlay/bands +13.5–21 mm
   Returns geometry + material TARGET per part; the viewer owns materials.
   ========================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  bodyPoint, bodyRadius, smoothstep, ySeam, yTop, yHem,
  gridGeometry, tubeGeometry, armCurve, armRadius, armFrame, L,
} from './body.js';

export const TILE = 0.2;             // one lace tile = 20 cm of fabric (roses ≈ 4 cm across)
const OFF_SHELL = 0.009, OFF_LACE = 0.0125;
const SKIRT_EXT = 1.065;              // lace hangs ~2 cm below the satin hem
const BODICE_EXT = 0.011;             // lace scallops rise 11 mm above the neckline
const TAU = Math.PI * 2;

const SK = { A: 0.29, BF: 0.245, BB: 0.29 };   // deeper at the back (side view)
const v3 = () => new THREE.Vector3();
const _b = v3(), _c = v3();

/* ---------------------------------------------------------------------------
   Bodice surface: body + cup volume + a bridged centre front (a real corset
   spans the cleavage instead of following it).
   --------------------------------------------------------------------------- */
function cup(phi, y) {
  // gentle rounding only — the cups follow the dress form's real bust
  const a = (Math.abs(phi) - 0.42) / 0.32, b = (y - (L.bust + 0.008)) / 0.045;
  return 0.008 * Math.exp(-a * a - b * b);
}
function bodicePoint(phi, y, off, out) {
  bodyPoint(phi, y, 0, out);
  const r0 = Math.hypot(out.x, out.z) || 1e-6;
  const dx = out.x / r0, dz = out.z / r0;
  let r = r0;
  const ap = Math.abs(phi);
  if (ap < 0.32) {
    bodyPoint(0.32, y, 0, _c);
    const bridge = Math.hypot(_c.x, _c.z) * Math.cos(0.32) / Math.cos(phi);
    const w = smoothstep(L.waist + 0.02, L.bust - 0.03, y);
    r = Math.max(r, r + (bridge - r) * w);
  }
  r += off + cup(phi, y);
  return out.set(dx * r, y, dz * r);
}

/* open back: half-width of the V gap (metres) at height y */
const GAP_BOT = () => ySeam(Math.PI) + 0.012;
function gapHalf(y) {
  const y0 = GAP_BOT(), y1 = yTop(Math.PI);
  if (y <= y0) return 0.0015;
  return 0.004 + 0.03 * Math.pow(Math.min(1, (y - y0) / (y1 - y0)), 0.8);
}
const gapPhi = y => gapHalf(y) / Math.max(0.03, bodyRadius(Math.PI, y));

/* ---------------------------------------------------------------------------
   Skirt surface: t 0 (seam) → 1 (hem), may extrapolate past 1.
   Central panels (front + back) hug the body, then fall as a modest A-line;
   the sides gather into strong hip volume with broad irregular folds.
   --------------------------------------------------------------------------- */
// angle of the satin band from the front (and, mirrored, from the back) centre
export const bandAngle = t => 0.27 + 0.95 * Math.pow(1 - Math.min(Math.max(t, 0), 1), 1.4);
// 0 inside a central panel, 1 in the gathered sides
// the gathered fabric rises out from under the band in a rounded pouf
// (fast at the band, then easing over ~15 cm) instead of a vertical wall
function pouf(d, fb) {
  const x = Math.min(1, Math.max(0, (d - (fb - 0.015)) / 0.55));
  return 1 - Math.pow(1 - x, 2.2);
}
export function sideWeight(phi, t) {
  const ap = Math.abs(phi), fb = bandAngle(t);
  return Math.min(pouf(ap, fb), pouf(Math.PI - ap, fb));
}
export function skirtPoint(phi, t, extra, out) {
  const y0 = ySeam(phi), y1 = yHem(phi);
  const tt = Math.max(t, 0);
  bodyPoint(phi, y0 + (y1 - y0) * tt, 0, _b);
  const rb = Math.hypot(_b.x, _b.z) || 1e-6;
  const dx = _b.x / rb, dz = _b.z / rb;
  const c = dz, s = dx;
  const B = SK.BB + (SK.BF - SK.BB) * smoothstep(-0.4, 0.4, c);
  const Re = 1 / Math.sqrt((s / SK.A) ** 2 + (c / B) ** 2);
  const base = rb + 0.0105;

  // central panel: fitted over abdomen / seat, then a restrained A-line
  const k = Math.pow(smoothstep(0.05, 0.95, tt), 1.25);
  let Rc = base + (Math.max(base, 0.86 * Re) - base) * k;
  Rc += 0.003 * smoothstep(0.3, 1, tt) * Math.sin(5 * phi + 0.8);          // soft drape
  // back panel stands out over the seat (the skirt is lifted there in the side view)
  const backW = Math.pow(Math.max(0, -c), 1.6);
  Rc += 0.03 * backW * smoothstep(0.02, 0.28, tt) * (1 - 0.35 * smoothstep(0.5, 1, tt));

  // gathered side panels: a BELL (not a hip ledge) — volume builds all the way down
  const x = Math.min(tt / 0.8, 1);
  const P = 1 - Math.pow(1 - x, 1.7);
  let Rs = rb + (Math.max(Re, base) - rb) * P;
  Rs += 0.032 * smoothstep(0.4, 1, tt);
  Rs += 0.012 * s * s * Math.exp(-(((tt - 0.3) / 0.22) ** 2));            // a little hip lift
  Rs += 0.03 * backW * Math.exp(-(((tt - 0.22) / 0.22) ** 2));              // bustle-like lift at the back

  // organ-pipe gathers radiating from the satin bands: fold lines follow the
  // band (u is measured across the side panel, band → band), rounded crests,
  // narrower valleys, irregular widths, depth growing toward the hem
  const fb = bandAngle(tt), ap = Math.abs(phi), sg = phi < 0 ? 1 : 0;
  const u = Math.min(1, Math.max(0, (ap - fb) / Math.max(0.2, Math.PI - 2 * fb)));
  const K = 13;
  const ph = u * K * TAU + 0.55 * Math.sin(u * 4.3 + tt * 2.1 + sg * 1.7) + 0.35 * tt * Math.sin(u * 9 + sg);
  const crest = Math.pow(0.5 + 0.5 * Math.cos(ph), 0.6);
  const irregular = 0.72 + 0.28 * Math.sin(u * 7.1 + 1.3 + sg * 2.2);
  const edgeFade = 0.35 + 0.65 * smoothstep(0, 0.12, Math.min(u, 1 - u));
  const fold = crest * irregular;
  Rs += (0.005 + 0.042 * Math.pow(tt, 0.8)) * fold * edgeFade;
  // fine gathering where the side panel is sewn to the band / seam
  Rs += 0.004 * Math.pow(1 - Math.min(tt, 1), 1.6) * (0.5 + 0.5 * Math.cos(u * 46 * Math.PI));
  Rs = Math.max(Rs, base);

  const w = sideWeight(phi, tt);
  let R = Rc + (Rs - Rc) * w + extra;
  // hem follows the folds: crests hang a little lower, valleys lift
  const yy = y0 + (y1 - y0) * t
    + (0.003 * Math.sin(9 * phi + 1) - 0.02 * (fold - 0.55) * w) * tt * tt * tt;
  return out.set(dx * R, yy, dz * R);
}
export function skirtRadiusAt(phi, y) {
  const y0 = ySeam(phi), y1 = yHem(phi);
  const t = (y0 - y) / (y0 - y1);
  if (t < 0 || t > SKIRT_EXT) return 0;
  const p = skirtPoint(phi, t, OFF_LACE - OFF_SHELL, v3());
  return Math.hypot(p.x, p.z);
}

/* frame helper for tubes along a numeric curve */
function curveFrame(fn) {
  return (s, f) => {
    fn(s, f.p);
    const q = fn(Math.min(1, s + 0.002), v3()), q0 = fn(Math.max(0, s - 0.002), v3());
    f.t.copy(q).sub(q0).normalize();
    f.n.set(f.p.x, 0, f.p.z).normalize();
    f.n.addScaledVector(f.t, -f.n.dot(f.t)).normalize();
    f.b.copy(f.t).cross(f.n).normalize();
    return f;
  };
}

export function buildCorsetMini() {
  const parts = [];
  const push = (name, target, geometry, extra = {}) => parts.push({ name, target, geometry, ...extra });

  /* ---- bodice: two rear panels separated by the open V gap ------------- */
  const nb = Math.round(TAU * 0.135 / TILE);
  const bodice = (off, ext) => gridGeometry(176, 48, (u, v, o) => {
    // rough row height first, then the angular span that stops at the gap edges
    const phiRough = -Math.PI + u * TAU;
    const ys = ySeam(phiRough) - 0.006, yt = yTop(phiRough) + ext;
    const y = ys + (yt - ys) * v;
    const half = Math.PI - gapPhi(y);
    const phi = -half + u * 2 * half;
    const yy = ySeam(phi) - 0.006 + ((yTop(phi) + ext) - (ySeam(phi) - 0.006)) * v;
    bodicePoint(phi, yy, off, o.p);
    o.uv.set(u * nb, yy / TILE);
    if (ext > 0) o.edge.set(phi * 0.14, (yTop(phi) + ext) - yy);
  }, { flip: true, edge: ext > 0, closedU: false, arcU: TILE });
  push('bodice_shell', 'shell', bodice(OFF_SHELL, 0), { lining: true });
  push('bodice_lace', 'lace', bodice(OFF_LACE, BODICE_EXT), { edge: true });

  // bound edges of the two rear panels (finished edge, not a cut)
  for (const sd of [-1, 1]) {
    const edgeFn = (s, out) => {
      const y = GAP_BOT() - 0.004 + (yTop(Math.PI) - 0.001 - (GAP_BOT() - 0.004)) * s;
      return bodicePoint(sd * (Math.PI - gapPhi(y)), y, OFF_LACE + 0.0012, out);
    };
    push(`back_edge_${sd > 0 ? 'l' : 'r'}`, 'trim', tubeGeometry(60, 8, 0, 1, curveFrame(edgeFn), () => 0.0024));
  }

  /* ---- skirt ------------------------------------------------------------ */
  const ns = Math.round(TAU * 0.26 / TILE);
  const skirt = (extra, tMax, edge) => gridGeometry(440, 90, (u, v, o) => {
    const phi = -Math.PI + u * TAU;
    const t = v * tMax;
    skirtPoint(phi, t, extra, o.p);
    const Ls = ySeam(phi) - yHem(phi);
    o.uv.set(u * ns, (t * (Ls + 0.08)) / TILE);
    if (edge) o.edge.set(phi * 0.29, (tMax - t) * Ls * 1.15);
  }, { edge, arcU: TILE });
  push('skirt_shell', 'shell', skirt(0, 1, false), { lining: true });
  push('skirt_lace', 'lace', skirt(OFF_LACE - OFF_SHELL, SKIRT_EXT, true), { edge: true });

  /* ---- neckline binding (thin, mostly hidden under the scallops) ---------- */
  const topFn = (s, out) => {
    const half = Math.PI - gapPhi(yTop(Math.PI));
    const phi = -half + s * 2 * half;
    return bodicePoint(phi, yTop(phi) - 0.001, OFF_SHELL + 0.0022, out);
  };
  push('binding', 'trim', tubeGeometry(300, 8, 0, 1, curveFrame(topFn), () => 0.0024));

  /* ---- satin bust band: lies over the lower half of the cups, a little
     narrower where it is gathered into the keeper; soft folds lead into the
     keeper; ends taper into the side seams. Calm, not winged. ------------- */
  const PH = 1.38;
  const bTop = phi => {
    const ap = Math.abs(phi);
    return L.bust + 0.004 + 0.006 * smoothstep(0.05, 0.45, ap) - 0.01 * smoothstep(0.8, PH, ap);
  };
  const bBot = phi => {
    const ap = Math.abs(phi);
    return L.bust - 0.036 + 0.012 * Math.exp(-((ap / 0.2) ** 2)) + 0.01 * smoothstep(0.8, PH, ap);
  };
  const bandMid = phi => (bTop(phi) + bBot(phi)) / 2;
  const bandHH = phi => (bTop(phi) - bBot(phi)) / 2;
  push('bust_overlay', 'trim', gridGeometry(200, 48, (u, v, o) => {
    const phi = -PH + u * 2 * PH, ap = Math.abs(phi);
    const h = v * 2 - 1;
    const end = 1 - smoothstep(1.12, PH, ap);
    const y = bandMid(phi) + h * bandHH(phi);
    const near = Math.exp(-((ap / 0.3) ** 2));
    const fph = (h * 0.5 + 0.5) * Math.PI * 5 + 0.4 * Math.sin(2.1 * ap) + (phi < 0 ? 0.3 : 0);
    const fold = Math.pow(0.5 + 0.5 * Math.cos(fph), 0.7);
    const body = Math.pow(Math.max(0, 1 - h * h), 0.4);
    const off = OFF_LACE + 0.0012
      + ((0.0028 + 0.0012 * near) * body + (0.0013 + 0.0015 * near) * fold * body) * (0.3 + 0.7 * end);
    bodicePoint(phi, y, off, o.p);
    o.uv.set(u * 4, v);
  }, { closedU: false, flip: true }));
  const keeper = new RoundedBoxGeometry(0.018, 0.031, 0.009, 4, 0.0035);
  const kp = bodicePoint(0, bandMid(0), OFF_LACE + 0.0012 + 0.004 + 0.0045, v3());
  const kTop = bodicePoint(0, bandMid(0) + 0.01, 0, v3()), kBot = bodicePoint(0, bandMid(0) - 0.01, 0, v3());
  keeper.rotateX(Math.atan2(kTop.z - kBot.z, 0.02));
  keeper.translate(kp.x, kp.y, kp.z);
  push('bust_keeper', 'trim', keeper);

  /* ---- seams: princess seams on the fitted bodice + centre-back skirt seam */
  const seams = [];
  for (const ph0 of [0.36, -0.36, Math.PI / 2, -Math.PI / 2]) {
    const yA = ySeam(ph0) - 0.004, yB = ph0 === 0.36 || ph0 === -0.36 ? bandMid(ph0) - bandHH(ph0) + 0.004 : yTop(ph0) - 0.006;
    const fn = (s2, out) => {
      const y = yA + (yB - yA) * s2;
      const ph = ph0 + Math.sign(ph0) * 0.05 * Math.sin(Math.PI * s2) * (Math.abs(ph0) < 1 ? 1 : 0);
      return bodicePoint(ph, y, OFF_LACE + 0.0006, out);
    };
    seams.push(tubeGeometry(50, 6, 0, 1, curveFrame(fn), () => 0.0012).toNonIndexed());
  }
  const cbFn = (s2, out) => skirtPoint(Math.PI, 0.01 + s2 * 0.99, OFF_LACE - OFF_SHELL + 0.0006, out);
  seams.push(tubeGeometry(60, 6, 0, 1, curveFrame(cbFn), () => 0.0012).toNonIndexed());
  push('seams', 'shell', mergeGeometries(seams));

  /* ---- long satin bands bordering the central panels (front + back) ------ */
  const RIB_W = 0.0135;
  for (const back of [false, true]) for (const sd of [1, -1]) {
    push(`band_${back ? 'back' : 'front'}_${sd > 0 ? 'l' : 'r'}`, 'trim', gridGeometry(14, 90, (u, v, o) => {
      const t = 0.005 + v * 1.01;
      const a = bandAngle(t) + 0.045;
      const phiC = sd * (back ? Math.PI - a : a);
      const Rc = Math.hypot(...(() => { const p = skirtPoint(phiC, t, 0, _c); return [p.x, p.z]; })());
      const w = u * 2 - 1;
      const phi = phiC + w * (RIB_W / Rc);
      // flat ribbon: raised face, edges meet the lace → visible thickness
      const face = 1 - Math.pow(Math.abs(w), 8);
      const crinkle = (0.0009 * Math.sin(t * 37 + w * 2.6 + sd * 1.3 + (back ? 2 : 0)) + 0.0005 * Math.sin(t * 83 - w * 4)) * face;   // soft diagonal creases
      const off = (OFF_LACE - OFF_SHELL) + 0.0015 + 0.0042 * face + crinkle;
      skirtPoint(phi, t, off, o.p);
      o.uv.set(u, v * 4);
    }, { closedU: false }));
  }

  /* ---- open-back lacing: eyelets on both panel edges + crossed cords ----- */
  const rows = 9, eyes = [], cords = [];
  const yb0 = GAP_BOT() + 0.012, yb1 = yTop(Math.PI) - 0.014;
  const eyeP = (i, side) => {
    const y = yb0 + (yb1 - yb0) * (i / (rows - 1));
    const rb = bodyRadius(Math.PI, y);
    return bodicePoint(side * (Math.PI - gapPhi(y) - 0.0075 / rb), y, OFF_LACE + 0.0015, v3());
  };
  for (let i = 0; i < rows; i++) for (const sd of [-1, 1]) {
    const e = new THREE.TorusGeometry(0.0033, 0.0011, 6, 14);
    const p = eyeP(i, sd);
    e.lookAt(new THREE.Vector3(p.x, 0, p.z));
    e.translate(p.x, p.y, p.z);
    eyes.push(e);
  }
  for (let i = 0; i < rows - 1; i++) for (const sd of [-1, 1]) {
    // cords span the open gap: straight, slightly taut, nothing behind them
    const a = eyeP(i, sd), b = eyeP(i + 1, -sd);
    cords.push(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 6, 0.0019, 6, false));
  }
  for (const sd of [-1, 1]) {   // short tied ends at the bottom
    const a = eyeP(0, sd);
    const b = a.clone().add(new THREE.Vector3(sd * 0.01, -0.06, -0.01));
    cords.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(sd * 0.004, -0.025, -0.01)), b]), 12, 0.0019, 6, false));
  }
  push('lacing_eyelets', 'cord', mergeGeometries(eyes.map(g => g.toNonIndexed())));
  push('lacing_cord', 'cord', mergeGeometries(cords.map(g => g.toNonIndexed())));

  /* ---- detached floating lace sleeves (no arms; a relaxed arm path) ------
     slim sheer sleeve → ruched band at the wrist → separate flared cuff
     flounce (elliptical opening, soft ruffles, scalloped edge) ---------- */
  for (const side of [1, -1]) {
    const curve = armCurve(side);
    const fA = (s2, f) => armFrame(curve, s2, f);
    const nm = side > 0 ? 'l' : 'r';
    const rBody = (s2, th) => armRadius(Math.min(s2, 1)) * 0.78 + 0.006
      + 0.0035 * Math.exp(-(((s2 - 0.9) / 0.025) ** 2)) * (1 + 0.25 * Math.cos(th * 14));   // ruched band
    const bothEdges = (l, Ln, arc, e) => e.set(arc, Math.min(l, Ln - l));
    push(`sleeve_${nm}`, 'sleeve', tubeGeometry(110, 40, 0.2, 0.95, fA, rBody, { edgeFn: bothEdges, tile: TILE }), { edge: true, side });
    push(`sleeve_tulle_${nm}`, 'tulle', tubeGeometry(72, 32, 0.205, 0.95, fA, (s2, th) => rBody(s2, th) - 0.0016, { edgeFn: bothEdges, tile: TILE }), { edge: true, side });
    // cuff flounce: starts inside the ruched band, flares past the wrist
    const rCuff = (s2, th) => {
      const k = smoothstep(0.9, 1.19, s2);
      const ell = 1 + 0.18 * Math.cos(th) * k;                         // elliptical opening
      const ruffle = (0.008 * Math.cos(th * 7 + side * 0.8) + 0.004 * Math.cos(th * 12 + 1.1)) * Math.pow(k, 1.2);
      return (armRadius(Math.min(s2, 1)) * 0.78 + 0.0085 + 0.052 * Math.pow(k, 1.3)) * ell + ruffle;
    };
    const endEdge = (l, Ln, arc, e) => e.set(arc, Ln - l);
    push(`sleeve_cuff_${nm}`, 'sleeve', tubeGeometry(56, 80, 0.89, 1.19, fA, rCuff, { edgeFn: endEdge, tile: TILE }), { edge: true, side });
  }

  return parts;
}

/* Dev QA: minimum gap between sleeves and the skirt / bodice (metres).
   Run in the console: __zba.clearance() */
export function clearanceReport(parts) {
  const rep = {};
  for (const p of parts.filter(q => q.target === 'sleeve')) {
    const pos = p.geometry.attributes.position;
    let min = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const phi = Math.atan2(x, z), r = Math.hypot(x, z);
      const rs = skirtRadiusAt(phi, y);
      const rbod = y > L.waist - 0.07 && y < L.top + 0.03 ? bodyRadius(phi, y) + OFF_LACE + 0.008 : 0;
      const gap = r - Math.max(rs, rbod);
      if ((rs || rbod) && gap < min) min = gap;
    }
    rep[p.name] = +min.toFixed(4);
  }
  return rep;
}

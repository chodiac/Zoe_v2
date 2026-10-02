/* ==========================================================================
   Shared body definition — the single source of truth for the mannequin
   AND for every garment that is fitted to it.

   The garment is not "placed near" the mannequin: every garment surface is
   computed from bodyPoint(φ, y, offset), i.e. the body surface pushed
   outward by the fabric offset. That is what guarantees no clipping.

   Units: metres. y up, +z = front. φ = 0 at centre front, ±π at centre back,
   +φ towards the mannequin's left side (+x).
   ========================================================================== */
import * as THREE from 'three';

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// smooth maximum (polynomial), k = blend width
export const smax = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};

/* ---- torso profile: y, half-width, front depth, back depth ------------- */
const PROFILE = [
  [0.770, 0.092, 0.070, 0.080],
  [0.800, 0.150, 0.094, 0.106],
  [0.860, 0.169, 0.099, 0.119],
  [0.930, 0.175, 0.101, 0.126],
  [1.000, 0.157, 0.091, 0.108],
  [1.070, 0.126, 0.080, 0.086],
  [1.140, 0.128, 0.086, 0.088],
  [1.200, 0.136, 0.094, 0.092],
  [1.265, 0.145, 0.099, 0.093],
  [1.320, 0.150, 0.093, 0.092],
  [1.370, 0.158, 0.083, 0.087],
  [1.410, 0.163, 0.071, 0.079],
  [1.435, 0.116, 0.060, 0.065],
  [1.455, 0.062, 0.050, 0.052],
  [1.480, 0.049, 0.046, 0.047],
];

/* monotone cubic (Fritsch–Carlson) per column — no overshoot between rows */
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const Y = PROFILE.map(r => r[0]);
const fA = monotone(Y, PROFILE.map(r => r[1]));
const fBF = monotone(Y, PROFILE.map(r => r[2]));
const fBB = monotone(Y, PROFILE.map(r => r[3]));

export const TORSO_Y = [PROFILE[0][0], PROFILE[PROFILE.length - 1][0]];

/* bust: two soft cups on the front */
function bust(phi, y) {
  const dy = (y - 1.256) / 0.05;
  const g = Math.exp(-dy * dy);
  const a = (phi - 0.44) / 0.34, b = (phi + 0.44) / 0.34;
  return 0.029 * g * (Math.exp(-a * a) + Math.exp(-b * b));
}

const N_EXP = 2 / 2.25; // superellipse exponent → slightly squared torso section

/* ---- landmarks every garment is positioned from ------------------------
   Defaults = procedural mannequin. setBodyProfile() replaces them with
   values measured from a real mannequin mesh (models/*-profile.json). */
export const L = {
  waist: 1.07, bust: 1.256, top: 1.30, shoulderY: 1.392, shoulderX: 0.163,
  source: 'procedural',
};
let PROF = null;

/* measured body: r(phi, y) table from tools/export_dressform.py */
export function setBodyProfile(p) {
  // drop rim rows that were hole-filled (constant radius all around)
  let rows = p.r.map((row, j) => ({ y: p.y[j], row }));
  rows = rows.filter(({ row }) => Math.max(...row) - Math.min(...row) > 0.004);
  // the open hip rim of a dress form measures noisily — keep 3 cm clear of it
  const yLow = rows[0].y + 0.03;
  rows = rows.filter(q => q.y >= yLow);
  const n = p.nphi;
  // light smoothing (3-tap in phi and y) so the bodice has no faceting
  const sm = rows.map(({ row }) => row.map((v, i) => (row[(i - 1 + n) % n] + 2 * v + row[(i + 1) % n]) / 4));
  const r = sm.map((row, j) => row.map((v, i) => {
    const a = sm[Math.max(0, j - 1)][i], b = sm[Math.min(sm.length - 1, j + 1)][i];
    return (a + 2 * v + b) / 4;
  }));
  const ys = rows.map(q => q.y);
  PROF = { r, n, y0: ys[0], dy: (ys[ys.length - 1] - ys[0]) / (ys.length - 1), ny: ys.length, yMax: ys[ys.length - 1] };
  // landmarks
  const ext = (y, f) => { let m = 0; for (let i = 0; i < n; i++) { const ph = -Math.PI + 2 * Math.PI * i / n; m = Math.max(m, f(profR(ph, y), ph)); } return m; };
  const halfW = y => ext(y, (rr, ph) => Math.abs(rr * Math.sin(ph)));
  const front = y => ext(y, (rr, ph) => rr * Math.cos(ph));
  const lo = PROF.y0, hi = PROF.yMax, H = hi - lo;
  let waist = lo, wMin = 9;
  for (let y = lo + H * 0.3; y < lo + H * 0.75; y += 0.005) { const w = halfW(y); if (w < wMin) { wMin = w; waist = y; } }
  let shoulder = waist, sMax = 0;
  for (let y = waist; y < hi; y += 0.005) { const w = halfW(y); if (w > sMax) { sMax = w; shoulder = y; } }
  let bust = waist + 0.15, fMax = 0;
  for (let y = waist + 0.06; y < shoulder - 0.06; y += 0.005) { const f = front(y); if (f > fMax) { fMax = f; bust = y; } }
  Object.assign(L, {
    waist, bust, top: bust + 0.044,
    shoulderY: shoulder - 0.05, shoulderX: halfW(shoulder - 0.05) + 0.004,
    source: 'measured',
  });
  return L;
}
export const hasBodyProfile = () => !!PROF;

function profR(phi, y) {
  const P = PROF;
  let fy = (y - P.y0) / P.dy; fy = Math.min(P.ny - 1, Math.max(0, fy));
  const j = Math.floor(fy), tj = fy - j, j1 = Math.min(j + 1, P.ny - 1);
  let fp = ((phi + Math.PI) / (2 * Math.PI)) * P.n; fp = ((fp % P.n) + P.n) % P.n;
  const i = Math.floor(fp), ti = fp - i, i1 = (i + 1) % P.n;
  const R = P.r;
  return (R[j][i] * (1 - ti) + R[j][i1] * ti) * (1 - tj) + (R[j1][i] * (1 - ti) + R[j1][i1] * ti) * tj;
}

/* body surface point pushed outward by `off` (metres). Writes into out. */
export function bodyPoint(phi, y, off = 0, out = new THREE.Vector3()) {
  if (PROF) {
    const r = profR(phi, y) + off;
    return out.set(Math.sin(phi) * r, y, Math.cos(phi) * r);
  }
  const a = fA(y), bf = fBF(y), bb = fBB(y);
  const c = Math.cos(phi), s = Math.sin(phi);
  const b = bb + (bf - bb) * smoothstep(-0.35, 0.35, c);
  let x = a * Math.sign(s) * Math.pow(Math.abs(s), N_EXP);
  let z = b * Math.sign(c) * Math.pow(Math.abs(c), N_EXP);
  const r = Math.hypot(x, z) || 1e-6;
  const k = (r + bust(phi, y) + off) / r;
  return out.set(x * k, y, z * k);
}
export function bodyRadius(phi, y) {
  const p = bodyPoint(phi, y, 0, _tmp);
  return Math.hypot(p.x, p.z);
}
const _tmp = new THREE.Vector3();

/* ---- garment landmarks shared by the dress builder + docs ------------- */
// curved (basque) waist seam: highest at centre front, dips at the sides
export const ySeam = phi =>
  L.waist + 0.002 - 0.072 * Math.pow(Math.abs(Math.sin(phi)), 1.3) - 0.034 * Math.max(0, -Math.cos(phi));
// sweetheart top edge: two cup peaks + centre notch at front, straight at back
export function yTop(phi) {
  // natural sweetheart, defined in METRES across the chest (x ≈ arc length
  // from the centre front), not in angle space:
  //   inner side of each lobe: a round (elliptical) arc down to a shallow
  //   centre dip; outer side: a soft bell curve easing down to the side
  //   line; the side line then continues gently lower to the back.
  const x = Math.abs(phi) * 0.12;               // ≈ metres from centre front
  const XC = 0.05, A = 0.046, DIP = 0.22;      // lobe centre, lobe height, dip as fraction of A
  const aIn = XC / Math.sqrt(1 - DIP * DIP);
  let lobe;
  if (x <= XC) {
    const q = (XC - x) / aIn;
    lobe = A * Math.sqrt(Math.max(0, 1 - q * q));
  } else {
    lobe = A * Math.exp(-(((x - XC) / 0.062) ** 2));
  }
  const back = smoothstep(1.4, 2.6, Math.abs(phi));
  return L.bust + 0.016 + lobe - 0.008 * back;
}
export const yHem = phi => L.waist - 0.385 + 0.004 * Math.cos(phi) + 0.004 * Math.sin(5 * phi + 0.7)
  + 0.012 * Math.max(0, -Math.cos(phi)) ** 2;   // slightly lifted over the seat

/* ---- arms -------------------------------------------------------------- */
const ARM_ABD = 0.41;   // upper-arm abduction (rad) — keeps sleeves clear of the skirt
const FORE_ABD = 0.56;  // forearm angle
export function armCurve(side) {
  const S = new THREE.Vector3(side * L.shoulderX, L.shoulderY, -0.008);
  const up = new THREE.Vector3(side * Math.sin(ARM_ABD), -Math.cos(ARM_ABD), 0.02).normalize();
  const E = S.clone().addScaledVector(up, 0.29);
  const fd = new THREE.Vector3(side * Math.sin(FORE_ABD), -Math.cos(FORE_ABD), 0.17).normalize();
  const W = E.clone().addScaledVector(fd, 0.26);
  const mid1 = S.clone().lerp(E, 0.5), mid2 = E.clone().lerp(W, 0.5);
  const curve = new THREE.CatmullRomCurve3([S, mid1, E, mid2, W], false, 'centripetal');
  curve.userData = { S, E, W, foreDir: fd };
  return curve;
}
// arm radius along the curve parameter s ∈ [0,1] (0 shoulder → 1 wrist)
export function armRadius(s) {
  const K = [[0, 0.046], [0.22, 0.040], [0.45, 0.033], [0.52, 0.031], [0.66, 0.033], [0.86, 0.028], [1, 0.024]];
  if (s >= 1) return 0.024;
  let i = 0; while (s > K[i + 1][0]) i++;
  const t = (s - K[i][0]) / (K[i + 1][0] - K[i][0]);
  const e = t * t * (3 - 2 * t);
  return K[i][1] + (K[i + 1][1] - K[i][1]) * e;
}
// point along arm, extrapolating past the wrist (for the flared sleeve end)
export function armFrame(curve, s, out) {
  const W = curve.userData.W, fd = curve.userData.foreDir;
  if (s <= 1) {
    out.p.copy(curve.getPoint(s));
    out.t.copy(curve.getTangent(s)).normalize();
  } else {
    out.p.copy(W).addScaledVector(fd, (s - 1) * 0.26);
    out.t.copy(fd);
  }
  out.n.set(0, 0, 1).cross(out.t).normalize();      // horizontal-ish normal
  out.b.copy(out.t).cross(out.n).normalize();
  return out;
}

/* ---- legs -------------------------------------------------------------- */
export function legCurve(side) {
  // side +1 = left leg (+x, straight / weight-bearing), −1 = relaxed leg
  const relaxed = side < 0;
  const H = new THREE.Vector3(side * 0.084, 0.84, -0.006);
  const K = relaxed ? new THREE.Vector3(side * 0.064, 0.475, 0.048) : new THREE.Vector3(side * 0.078, 0.47, 0.012);
  const A = relaxed ? new THREE.Vector3(side * 0.056, 0.105, 0.004) : new THREE.Vector3(side * 0.066, 0.092, -0.022);
  return new THREE.CatmullRomCurve3([H, H.clone().lerp(K, 0.5).add(new THREE.Vector3(0, 0, 0.012)), K, K.clone().lerp(A, 0.5), A], false, 'centripetal');
}
export function legRadius(s) {
  const K = [[0, 0.088], [0.2, 0.077], [0.42, 0.056], [0.5, 0.047], [0.6, 0.052], [0.68, 0.053], [0.88, 0.033], [1, 0.029]];
  let i = 0; while (i < K.length - 2 && s > K[i + 1][0]) i++;
  const t = Math.min(1, Math.max(0, (s - K[i][0]) / (K[i + 1][0] - K[i][0])));
  const e = t * t * (3 - 2 * t);
  return K[i][1] + (K[i + 1][1] - K[i][1]) * e;
}

/* ---- generic geometry helpers ----------------------------------------- */
/* Parametric grid: fn(u, v, out:{p,uv,edge}) for u,v ∈ [0,1].
   closedU → seam normals averaged so there is no lighting line. */
export function gridGeometry(nu, nv, fn, { closedU = true, edge = false, flip = false, arcU = 0 } = {}) {
  const cols = nu + 1, rows = nv + 1;
  const pos = new Float32Array(cols * rows * 3);
  const uv = new Float32Array(cols * rows * 2);
  const ed = edge ? new Float32Array(cols * rows * 2) : null;
  const o = { p: new THREE.Vector3(), uv: new THREE.Vector2(), edge: new THREE.Vector2(99, 99) };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      o.edge.set(99, 99);
      fn(i / nu, j / nv, o);
      pos[k * 3] = o.p.x; pos[k * 3 + 1] = o.p.y; pos[k * 3 + 2] = o.p.z;
      uv[k * 2] = o.uv.x; uv[k * 2 + 1] = o.uv.y;
      if (ed) { ed[k * 2] = o.edge.x; ed[k * 2 + 1] = o.edge.y; }
    }
  }
  // arc-length U: lace keeps its scale on steep / curved surfaces (no smearing)
  // (one shared tile count for all rows → no seams between rows)
  if (arcU) {
    const all = [];
    let mean = 0;
    for (let j = 0; j < rows; j++) {
      let d = 0; const ds = [0];
      for (let i = 1; i < cols; i++) {
        const a = (j * cols + i - 1) * 3, b = (j * cols + i) * 3;
        d += Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
        ds.push(d);
      }
      all.push(ds); mean += d / rows;
    }
    const N = closedU ? Math.max(1, Math.round(mean / arcU)) : mean / arcU;
    for (let j = 0; j < rows; j++) {
      const ds = all[j], d = ds[ds.length - 1] || 1;
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        uv[k * 2] = (ds[i] / d) * N;
        if (ed) ed[k * 2] = ds[i];
      }
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (ed) g.setAttribute('edge', new THREE.BufferAttribute(ed, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (closedU) {
    const n = g.attributes.normal;
    for (let j = 0; j < rows; j++) {
      const a = j * cols, b = j * cols + nu;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return g;
}

/* Variable-radius tube along a parametric spine.
   frameAt(s, frame) fills {p,t,n,b}; radiusAt(s, θ) → r. */
export function tubeGeometry(ns, nr, s0, s1, frameAt, radiusAt, { edgeFn = null, tile = 0.12 } = {}) {
  const fr = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3() };
  // pre-compute arc length along the spine for uv.v
  const lens = [0]; let prev = null;
  for (let j = 0; j <= ns; j++) {
    frameAt(s0 + (s1 - s0) * j / ns, fr);
    if (prev) lens.push(lens[lens.length - 1] + prev.distanceTo(fr.p));
    prev = fr.p.clone();
  }
  const L = lens[lens.length - 1];
  const g = gridGeometry(nr, ns, (u, v, o) => {
    const j = Math.round(v * ns);
    const s = s0 + (s1 - s0) * v;
    frameAt(s, fr);
    const th = u * Math.PI * 2;
    const r = radiusAt(s, th);
    o.p.copy(fr.p).addScaledVector(fr.n, Math.cos(th) * r).addScaledVector(fr.b, Math.sin(th) * r);
    const around = Math.max(1, Math.round((Math.PI * 2 * r) / tile));
    o.uv.set(u * around, lens[j] / tile);
    if (edgeFn) edgeFn(lens[j], L, th * r, o.edge);
  }, { closedU: true, edge: !!edgeFn, flip: true });
  return g;
}

/* Ellipsoid helper */
export function ellipsoid(rx, ry, rz, ws = 32, hs = 24) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

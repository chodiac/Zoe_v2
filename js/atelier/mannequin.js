/* ==========================================================================
   Procedural fashion mannequin — genuine 3D geometry built from body.js.
   Abstract head, no facial features, relaxed A-pose with a soft
   contrapposto so the bodice, sleeves and skirt volume stay readable.
   Replaceable: put a GLB at MANNEQUIN.src (see ASSETS.md).
   ========================================================================== */
import * as THREE from 'three';
import {
  bodyPoint, TORSO_Y, gridGeometry, tubeGeometry, ellipsoid,
  armCurve, armRadius, armFrame, legCurve, legRadius,
} from './body.js';

/* Owner-supplied dress form (g2f-dress-mannequin, exported from the .blend by
   tools/export_dressform.py). The dress is fitted to its MEASURED profile.
   Set src: null to fall back to the procedural mannequin below. */
export const MANNEQUIN = {
  // resolved relative to this module → works from any page depth
  src: new URL('../../models/dressform.glb', import.meta.url).href,
  profile: new URL('../../models/dressform-profile.json', import.meta.url).href,
  status: 'owner-supplied',
  hasArms: false,
};

export async function loadDressForm() {
  const [{ GLTFLoader }, profile] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    fetch(MANNEQUIN.profile).then(r => { if (!r.ok) throw new Error('profile ' + r.status); return r.json(); }),
  ]);
  const gltf = await new GLTFLoader().loadAsync(MANNEQUIN.src);
  const g = new THREE.Group();
  g.name = 'mannequin';
  gltf.scene.position.z = -profile.axisZ;   // measured axis → x = z = 0
  g.add(gltf.scene);
  g.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    if (m) { m.envMapIntensity = 0.75; if (m.map) m.map.anisotropy = 8; }
  });
  return { group: g, profile };
}

export function buildMannequin(skin, metal) {
  const g = new THREE.Group();
  g.name = 'mannequin';
  const add = (geo, mat = skin, name = '') => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    g.add(m); return m;
  };

  /* torso — same function the dress is fitted to */
  const [y0, y1] = TORSO_Y;
  add(gridGeometry(128, 72, (u, v, o) => {
    const phi = -Math.PI + u * Math.PI * 2;
    bodyPoint(phi, y0 + (y1 - y0) * v, 0, o.p);
  }, { flip: true }), skin, 'torso');
  // pelvis floor (hidden between the thighs)
  const pf = add(ellipsoid(0.118, 0.045, 0.092), skin, 'pelvis');
  pf.position.set(0, 0.79, 0.004);

  /* neck + head (abstract) */
  const neck = add(new THREE.CylinderGeometry(0.041, 0.047, 0.12, 40, 1, true), skin, 'neck');
  neck.position.set(0, 1.495, 0.004);
  neck.rotation.x = -0.1;
  const head = add(ellipsoid(0.077, 0.104, 0.09, 48, 36), skin, 'head');
  head.position.set(0, 1.618, 0.014);
  head.rotation.x = -0.2;

  /* arms */
  for (const side of [1, -1]) {
    const curve = armCurve(side);
    const { S, W, foreDir } = curve.userData;
    add(tubeGeometry(64, 32, 0, 1, (s, f) => armFrame(curve, s, f), s => armRadius(s)), skin, 'arm');
    const sh = add(ellipsoid(0.046, 0.047, 0.047), skin, 'shoulder');
    sh.position.copy(S).add(new THREE.Vector3(-side * 0.006, -0.004, 0));
    const wr = add(ellipsoid(0.025, 0.025, 0.025, 20, 14), skin, 'wrist');
    wr.position.copy(W);
    // abstract hand: flattened almond aligned with the forearm, palm to thigh
    const hand = add(ellipsoid(0.021, 0.082, 0.041, 28, 20), skin, 'hand');
    hand.position.copy(W).addScaledVector(foreDir, 0.07);
    hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), foreDir);
  }

  /* legs */
  for (const side of [1, -1]) {
    const curve = legCurve(side);
    add(tubeGeometry(72, 32, 0, 1, (s, f) => {
      f.p.copy(curve.getPoint(s));
      f.t.copy(curve.getTangent(s)).normalize();
      f.n.set(0, 0, 1).cross(f.t).normalize();
      f.b.copy(f.t).cross(f.n).normalize();
      return f;
    }, s => legRadius(s)), skin, 'leg');
    const A = curve.getPoint(1);
    const ankle = add(ellipsoid(0.03, 0.03, 0.032, 20, 14), skin, 'ankle');
    ankle.position.copy(A);
    // arched foot (as if in heels) pointing forward
    const foot = add(ellipsoid(0.03, 0.028, 0.1, 28, 18), skin, 'foot');
    foot.position.set(A.x, A.y - 0.032, A.z + 0.05);
    foot.rotation.x = 0.62;
    foot.rotation.y = side * 0.08;
  }

  /* display stand: champagne rod + stone base */
  const rod = add(new THREE.CylinderGeometry(0.008, 0.008, 0.82, 16), metal, 'stand-rod');
  rod.position.set(0, 0.42, -0.13);
  const bar = add(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 16), metal, 'stand-bar');
  bar.rotation.x = Math.PI / 2; bar.position.set(0, 0.835, -0.1);
  const base = add(new THREE.CylinderGeometry(0.23, 0.235, 0.018, 64), metal, 'stand-base');
  base.position.set(0, -0.009, -0.03);

  return g;
}

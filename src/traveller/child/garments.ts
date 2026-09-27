import * as THREE from 'three';
import { BONE, HEM_BONES } from './skeleton';
import { Builder, MAT, angleTo, bump, smooth, type Point, type Skin } from './mesh';

/**
 * The child, modelled in the root's frame (feet on y = 0, facing +z, left is +x) in the pose the mesh is bound in.
 * Every garment is one smooth surface, laid out so its own shape does the work: the coat hangs from the shoulders
 * and flares to the knee in a few broad folds, the hood is a big soft dome with a rolled edge, the bag sags.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** Catmull-Rom through a table of rows keyed by their first column, which runs downward. */
function lookup(table: number[][], key: number, col: number): number {
  const n = table.length;
  let i = 0;
  while (i < n - 2 && key < table[i + 1][0]) i++;
  const a = table[Math.max(0, i - 1)];
  const b = table[i];
  const c = table[i + 1];
  const d = table[Math.min(n - 1, i + 2)];
  const t = THREE.MathUtils.clamp((key - b[0]) / (c[0] - b[0]), 0, 1);
  const cr = (p0: number, p1: number, p2: number, p3: number) =>
    0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  return cr(a[col], b[col], c[col], d[col]);
}

// ---------------------------------------------------------------------------------------------------------------
// The coat

/** Height, half-width, half-depth and how far forward the middle of the coat is, from the collar to below the hem. */
const COAT = [
  [1.625, 0.13, 0.125, 0.0],
  [1.6, 0.175, 0.16, 0.0],
  [1.56, 0.232, 0.197, 0.0],
  [1.51, 0.268, 0.222, 0.002],
  [1.46, 0.29, 0.238, 0.006],
  [1.4, 0.303, 0.252, 0.012],
  [1.3, 0.318, 0.272, 0.02],
  [1.18, 0.338, 0.29, 0.024],
  [1.04, 0.366, 0.306, 0.02],
  [0.88, 0.404, 0.33, 0.01],
  [0.72, 0.443, 0.358, 0.0],
  [0.58, 0.48, 0.386, -0.01],
  [0.45, 0.512, 0.41, -0.018],
];
export const COAT_TOP = 1.625;

/** Broad folds that fan out from the chest toward the hem: angle from the front, width, and ridge (+) or valley (-). */
const FOLDS: [number, number, number][] = [
  [0.5, 0.2, 0.35], [1.05, 0.22, -0.9], [1.42, 0.2, 1.0], [1.86, 0.22, -0.7], [2.36, 0.22, 0.9], [2.8, 0.2, -0.6],
];

function foldAt(a: number, y: number): number {
  const amp = 0.034 * smooth(1.38, 0.62, y);
  if (amp <= 0) return 0;
  const fan = (1.3 - y) * 0.12;
  let d = 0.7 * bump(angleTo(a, Math.PI), 0.2);
  for (const [at, w, s] of FOLDS) {
    d += s * bump(angleTo(a, at + fan), w);
    d += s * bump(angleTo(a, -at - fan), w);
  }
  return amp * d;
}

export const hemY = (a: number) => 0.56 + 0.01 * Math.sin(3 * a + 0.4) + 0.005 * Math.sin(5 * a + 1.1) - 0.3 * foldAt(a, 0.56);

export interface CoatSample {
  p: THREE.Vector3;
  /** The outward normal of the section at that point, ignoring slope. */
  n: THREE.Vector3;
  fold: number;
}

/** A point on the coat's outside at an angle from the front and a height. */
export function coatAt(a: number, y: number, out: CoatSample = { p: V(), n: V(), fold: 0 }): CoatSample {
  const w = lookup(COAT, y, 1);
  const d = lookup(COAT, y, 2);
  const zc = lookup(COAT, y, 3);
  const s = Math.sin(a);
  const c = Math.cos(a);
  /** A touch squarer than an ellipse lower down, so the coat reads as cloth hanging, not as a barrel. */
  const e = THREE.MathUtils.lerp(1, 0.9, smooth(1.4, 0.7, y));
  const sx = Math.sign(s) * Math.pow(Math.abs(s), e);
  const sz = Math.sign(c) * Math.pow(Math.abs(c), e);
  const x = w * sx;
  const z = d * sz;
  out.n.set(x / (w * w), 0, z / (d * d)).normalize();
  const fold = foldAt(a, y);
  /** The placket: a strip down the front a few millimetres proud of the rest. */
  const placket = 0.007 * (1 - smooth(0.025, 0.04, Math.abs(x))) * smooth(-0.1, 0.1, z);
  out.fold = fold;
  out.p.set(x, y, z + zc).addScaledVector(out.n, fold + placket);
  return out;
}

/** The coat hangs from the shoulders and chest; below the waist it belongs more and more to the hem's ring. */
export function coatSkin(a: number, y: number, x: number): Skin {
  const neck = 0.5 * smooth(1.53, 1.625, y);
  const chest = (1 - neck) * smooth(1.0, 1.28, y);
  const rest = 1 - neck - chest;
  const spine = rest * smooth(0.76, 1.1, y);
  const low = rest - spine;
  const hem = low * Math.pow(smooth(1.04, 0.66, y), 0.8);
  const hips = low - hem;
  const side = x >= 0;
  const arm = chest * 0.5 * smooth(0.2, 0.3, Math.abs(x)) * smooth(1.3, 1.42, y) * (1 - smooth(1.49, 1.56, y));
  const clav = chest * 0.45 * smooth(0.12, 0.26, Math.abs(x)) * smooth(1.4, 1.5, y);
  const skin: Skin = [
    [BONE.neck, neck],
    [BONE.chest, chest - arm - clav],
    [side ? BONE.upperL : BONE.upperR, arm],
    [side ? BONE.clavL : BONE.clavR, clav],
    [BONE.spine, spine],
    [BONE.hips, hips],
  ];
  if (hem > 0) {
    const f = (((a % TAU) + TAU) % TAU) / (TAU / HEM_BONES);
    const i = Math.floor(f) % HEM_BONES;
    const t = f - Math.floor(f);
    skin.push([BONE.hem + i, hem * (1 - t)], [BONE.hem + ((i + 1) % HEM_BONES), hem * t]);
  }
  return skin;
}

function coat(b: Builder): void {
  const AROUND = 72;
  const ROWS = 50;
  const rows: Point[][] = [];
  const s: CoatSample = { p: V(), n: V(), fold: 0 };
  const angles = Array.from({ length: AROUND }, (_, j) => (j / AROUND) * TAU);
  for (let r = 0; r <= ROWS; r++) {
    const v = Math.pow(r / ROWS, 1.12);
    rows.push(angles.map((a) => {
      const y = THREE.MathUtils.lerp(COAT_TOP, hemY(a), v);
      coatAt(a, y, s);
      /** Shade where the sleeves and scarf hang over it, and down in the folds. */
      const under = 1 - 0.35 * smooth(0.22, 0.3, Math.abs(s.p.x)) * smooth(1.46, 1.3, y) * smooth(1.05, 1.22, y);
      const ao = Math.min(under, 1 - 0.4 * smooth(1.52, 1.61, y)) * (1 + Math.min(0, s.fold) * 9);
      return { p: s.p.clone(), skin: coatSkin(a, y, s.p.x), mat: MAT.coat, ao, uv: [a, y] };
    }));
  }
  /** The hem is turned up inside, so from below or edge-on the coat has a thickness. */
  const turn: [number, number, number][] = [[-0.012, -0.011, 0.9], [-0.03, 0.004, 0.75], [-0.033, 0.065, 0.6]];
  for (const [inward, up, ao] of turn) {
    rows.push(angles.map((a) => {
      const y = hemY(a);
      coatAt(a, y, s);
      return {
        p: s.p.clone().addScaledVector(s.n, inward).setY(y + up),
        skin: coatSkin(a, y, s.p.x),
        mat: MAT.coat,
        k: 1,
        ao,
        uv: [a, y],
      };
    }));
  }
  b.rows(rows, true, V(0, 1.1, 0));

  for (const y of [1.3, 1.1, 0.9]) {
    coatAt(0, y, s);
    const above = coatAt(0, y + 0.01).p;
    const below = coatAt(0, y - 0.01).p;
    const down = below.sub(above).normalize();
    const n = V(0, 0, 1).sub(down.clone().multiplyScalar(down.z)).normalize();
    dome(b, s.p, n, 0.036, 0.016, coatSkin(0, y, 0), MAT.button);
  }
}

/** A small round dome standing on a surface: a button, a rivet. */
function dome(b: Builder, at: THREE.Vector3, n: THREE.Vector3, r: number, h: number, skin: Skin, mat: number): void {
  const t = V(1, 0, 0).sub(n.clone().multiplyScalar(n.x)).normalize();
  const u = V().crossVectors(n, t);
  const rows: Point[][] = [];
  for (let i = 0; i <= 5; i++) {
    const phi = (i / 5) * (Math.PI / 2);
    const ring = Math.cos(phi) * r;
    const lift = Math.sin(phi) * h;
    if (i === 5) {
      rows.push([{ p: at.clone().addScaledVector(n, h), skin, mat, k: 0 }]);
      break;
    }
    rows.push(Array.from({ length: 14 }, (_, j) => {
      const a = (j / 14) * TAU;
      return {
        p: at.clone().addScaledVector(t, Math.cos(a) * ring).addScaledVector(u, Math.sin(a) * ring).addScaledVector(n, lift - 0.004),
        skin,
        mat,
        k: i === 0 ? 1 : 0,
      };
    }));
  }
  b.rows(rows, true, at.clone().addScaledVector(n, -0.02));
}

// ---------------------------------------------------------------------------------------------------------------
// Tubes along the limbs

interface Station {
  /** Distance along the tube's axis from its start. */
  s: number;
  /** Half-width across (along `side`) and half-depth. */
  rx: number;
  ry: number;
  skin: Skin;
  mat: number;
  k?: number;
  ao?: number;
}

/** A tube round a straight axis, from `from` along `dir`; ends are closed with a pole where a station has no size. */
function tube(b: Builder, from: THREE.Vector3, dir: THREE.Vector3, side: THREE.Vector3, stations: Station[], around: number, inside: THREE.Vector3): void {
  const t = dir.clone().normalize();
  const x = side.clone().sub(t.clone().multiplyScalar(side.dot(t))).normalize();
  const y = V().crossVectors(t, x);
  const rows: Point[][] = stations.map((st) => {
    const c = from.clone().addScaledVector(t, st.s);
    if (st.rx <= 0) return [{ p: c, skin: st.skin, mat: st.mat, k: st.k, ao: st.ao, uv: [st.s, 0] }];
    return Array.from({ length: around }, (_, j) => {
      const a = (j / around) * TAU;
      return {
        p: c.clone().addScaledVector(x, Math.cos(a) * st.rx).addScaledVector(y, Math.sin(a) * st.ry),
        skin: st.skin,
        mat: st.mat,
        k: st.k,
        ao: st.ao,
        uv: [st.s, a] as [number, number],
      };
    });
  });
  b.rows(rows, true, inside);
}

function blend(a: number, b: number, t: number): Skin {
  return [[a, 1 - t], [b, t]];
}

function sleeve(b: Builder, rest: THREE.Vector3[], left: boolean): void {
  const up = left ? BONE.upperL : BONE.upperR;
  const fore = left ? BONE.foreL : BONE.foreR;
  const clav = left ? BONE.clavL : BONE.clavR;
  const S = rest[up];
  const W = rest[left ? BONE.handL : BONE.handR];
  const dir = W.clone().sub(S).normalize();
  const skinAt = (s: number): Skin => {
    if (s < 0.06) {
      const k = smooth(-0.1, 0.06, s);
      return [[clav, 0.45 * (1 - k)], [BONE.chest, 0.1 * (1 - k)], [up, 0.45 + 0.55 * k]];
    }
    return blend(up, fore, smooth(0.2, 0.37, s));
  };
  const full = (s: number) => 1.02 + 0.2 * smooth(0.0, 0.5, s);
  const st = (s: number, rx: number, ry = rx, k = 0, ao = 1): Station => ({ s, rx: rx * full(s), ry: ry * full(s), skin: skinAt(s), mat: MAT.coat, k, ao });
  tube(b, S, dir, V(0, 0, 1), [
    st(-0.105, 0, 0, 0, 0.7),
    st(-0.098, 0.04, 0.04, 0, 0.75),
    st(-0.08, 0.072, 0.075, 0, 0.8),
    st(-0.045, 0.094, 0.098, 0, 0.9),
    st(0.0, 0.104, 0.106),
    st(0.07, 0.102, 0.104),
    st(0.15, 0.098, 0.1),
    st(0.24, 0.095, 0.096),
    st(0.3, 0.095, 0.096),
    st(0.38, 0.098, 0.099),
    st(0.44, 0.102, 0.104),
    /** The turned-back cuff: a band a little proud of the sleeve, and then the turn inside. */
    st(0.455, 0.109, 0.111, 1),
    st(0.51, 0.111, 0.113, 1),
    st(0.525, 0.104, 0.106, 1, 0.8),
    st(0.52, 0.088, 0.09, 1, 0.45),
    st(0.48, 0.082, 0.084, 1, 0.3),
  ], 28, S.clone().addScaledVector(dir, 0.3));
}

function mitten(b: Builder, bind: THREE.Matrix4[], left: boolean): void {
  const bone = left ? BONE.handL : BONE.handR;
  const m = bind[bone];
  const mx = left ? 1 : -1;
  const skin: Skin = [[bone, 1]];
  const rows: Point[][] = [];
  /** A soft paddle: round across the back of the hand, fullest where the fingers are, a blunt round end. */
  const prof: [number, number, number][] = [
    [0.03, 0.036, 0.046], [0.0, 0.041, 0.052], [-0.03, 0.044, 0.058], [-0.065, 0.047, 0.062],
    [-0.1, 0.046, 0.06], [-0.13, 0.04, 0.052], [-0.152, 0.03, 0.038], [-0.166, 0.016, 0.02], [-0.171, 0, 0],
  ];
  for (const [y0, rx0, rz0] of prof) {
    const y = y0 * 1.2;
    const rx = rx0 * 1.45;
    const rz = rz0 * 1.42;
    if (rx === 0) {
      rows.push([{ p: V(0, y, 0.005).applyMatrix4(m), skin, mat: MAT.mitten }]);
      continue;
    }
    rows.push(Array.from({ length: 20 }, (_, j) => {
      const a = (j / 20) * TAU;
      return { p: V(Math.cos(a) * rx, y, Math.sin(a) * rz + 0.005).applyMatrix4(m), skin, mat: MAT.mitten, ao: y > 0.01 ? 0.7 : 1 };
    }));
  }
  b.rows(rows, true, V(0, -0.06, 0.005).applyMatrix4(m));
  /** The thumb, on the inside edge and forward, which is what lets a mitten read as holding rather than touching. */
  const base = V(-mx * 0.02, -0.042, 0.075);
  const dir = V(-mx * 0.35, -0.62, 0.7).normalize();
  const rowsT: Point[][] = [];
  const side = V(mx, 0, 0).sub(dir.clone().multiplyScalar(dir.x * mx)).normalize();
  const other = V().crossVectors(dir, side);
  const tprof: [number, number][] = [[0, 0.037], [0.044, 0.041], [0.08, 0.039], [0.1, 0.03], [0.112, 0.014], [0.116, 0]];
  for (const [s, r] of tprof) {
    const c = base.clone().addScaledVector(dir, s);
    if (r === 0) {
      rowsT.push([{ p: c.applyMatrix4(m), skin, mat: MAT.mitten }]);
      continue;
    }
    rowsT.push(Array.from({ length: 12 }, (_, j) => {
      const a = (j / 12) * TAU;
      return { p: c.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(other, Math.sin(a) * r * 0.9).applyMatrix4(m), skin, mat: MAT.mitten };
    }));
  }
  b.rows(rowsT, true, base.clone().addScaledVector(dir, 0.03).applyMatrix4(m));
}

function leg(b: Builder, rest: THREE.Vector3[], left: boolean): void {
  const thigh = left ? BONE.thighL : BONE.thighR;
  const shin = left ? BONE.shinL : BONE.shinR;
  const foot = left ? BONE.footL : BONE.footR;
  const hip = rest[thigh];
  const knee = rest[shin];
  const skinY = (y: number): Skin => {
    if (y > knee.y + 0.1) return [[BONE.hips, 0.5 * smooth(hip.y - 0.08, hip.y + 0.1, y)], [thigh, 1]];
    return blend(thigh, shin, smooth(knee.y + 0.07, knee.y - 0.06, y));
  };
  const st = (y: number, r: number): Station => ({ s: hip.y + 0.14 - y, rx: r, ry: r, skin: skinY(y), mat: MAT.trousers });
  tube(b, V(hip.x, hip.y + 0.14, 0), V(0, -1, 0), V(1, 0, 0), [
    st(hip.y + 0.14, 0), st(hip.y + 0.13, 0.075), st(hip.y + 0.1, 0.112), st(0.6, 0.112), st(0.48, 0.108), st(0.42, 0.106),
    st(0.36, 0.104), st(0.3, 0.1), st(0.24, 0.096), st(0.22, 0),
  ], 18, V(hip.x, 0.5, 0));
  boot(b, V(hip.x, 0, 0), shin, foot);
}

/**
 * A chunky round-toed wellington: the shaft, the bend of the ankle and the foot are one swept tube, so the heel and
 * instep come out of the same surface. The shaft opens a little at the top; the sole is pressed flat on the ground.
 */
function boot(b: Builder, at: THREE.Vector3, shin: number, foot: number): void {
  const path = new THREE.CatmullRomCurve3([
    V(0, 0.39, -0.01), V(0, 0.27, -0.012), V(0, 0.16, -0.01), V(0, 0.098, 0.035), V(0, 0.08, 0.115), V(0, 0.076, 0.185), V(0, 0.074, 0.235),
  ], false, 'catmullrom', 0.5);
  const N = 30;
  const rows: Point[][] = [];
  /** The top of the shaft: a thick cut edge, and the dark inside going down round the trouser leg. */
  const lipRows: [number, number, number][] = [[0.33, 0.118, 0.25], [0.375, 0.124, 0.4], [0.392, 0.134, 0.7], [0.4, 0.143, 0.95], [0.396, 0.15, 1]];
  for (const [y, r, ao] of lipRows) {
    rows.push(Array.from({ length: 24 }, (_, j) => {
      const a = (j / 24) * TAU;
      return { p: V(at.x + Math.cos(a) * r, y, Math.sin(a) * r * 0.94 - 0.01), skin: [[shin, 1]] as Skin, mat: MAT.boot, k: 0.5, ao };
    }));
  }
  const tan = V();
  const pt = V();
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    path.getPointAt(u, pt);
    path.getTangentAt(u, tan);
    const along = u;
    /** Width across the foot and height through it: a wide shaft flaring to its top, broad and low along the foot. */
    const footness = smooth(0.42, 0.62, along);
    const flare = 0.012 * smooth(0.18, 0.0, along);
    const rx = (THREE.MathUtils.lerp(0.138, 0.14, footness) + flare) * (1 - 0.68 * smooth(0.9, 1.0, along) ** 1.5);
    const ry = (THREE.MathUtils.lerp(0.13, 0.092, footness) + flare) * (1 - 0.72 * smooth(0.88, 1.0, along) ** 1.5);
    const side = V(1, 0, 0);
    const up = V().crossVectors(tan, side).normalize();
    const w = smooth(0.4, 0.58, along);
    const skin: Skin = [[shin, 1 - w], [foot, w]];
    rows.push(Array.from({ length: 24 }, (_, j) => {
      const a = (j / 24) * TAU;
      const p = pt.clone().addScaledVector(side, Math.cos(a) * rx).addScaledVector(up, Math.sin(a) * ry);
      /** A rounder, fuller toe box than heel. */
      if (p.z > 0.13) p.x *= 1 + 0.05 * smooth(0.13, 0.22, p.z);
      p.y = Math.max(p.y, 0.006);
      p.x += at.x;
      const sole = 1 - smooth(0.014, 0.034, p.y);
      return { p, skin, mat: MAT.boot, k: sole, ao: 1 - 0.3 * sole, uv: [along, a] as [number, number] };
    }));
  }
  rows.push([{ p: V(at.x, 0.07, 0.254), skin: [[foot, 1]], mat: MAT.boot }]);
  b.rows(rows, true, V(at.x, 0.14, 0.02));
}

// ---------------------------------------------------------------------------------------------------------------
// The head

/**
 * The middle of the head, its half-width and half-depth, and how far it reaches up to the crown and down to the chin.
 * A small child's face: as wide as it is long from the brow down, the eyes at the middle of the head.
 */
export const FACE = { c: V(0, 2.03, 0.07), rx: 0.262, rz: 0.25, up: 0.3, down: 0.262 };

/** A point on the face's surface in the direction (theta from the top, phi from the front). */
function facePoint(theta: number, phi: number, out = V()): THREE.Vector3 {
  const ct = Math.cos(theta);
  /** Below the eyes the face fills out and stays full to a round chin: a broad U, never a V. */
  const ring = ct >= 0 ? Math.sin(theta) : Math.pow(1 - Math.pow(-ct, 2.2), 1 / 2.2);
  const low = smooth(0.1, -0.55, ct);
  const x = FACE.rx * ring * Math.sin(phi) * (1 + 0.1 * low);
  const y = (ct >= 0 ? FACE.up : FACE.down) * ct;
  let z = FACE.rz * ring * Math.cos(phi) * (1 + 0.06 * low * bump(Math.abs(phi) - 0.8, 0.7));
  if (z > 0) z *= 0.93;
  return out.set(x, y, z).add(FACE.c);
}

function face(b: Builder): void {
  const ROWS = 40;
  const AROUND = 56;
  const rows: Point[][] = [];
  for (let i = 0; i <= ROWS; i++) {
    const theta = (i / ROWS) * Math.PI;
    if (i === 0 || i === ROWS) {
      rows.push([{ p: facePoint(theta, 0), skin: [[BONE.head, 1]], mat: MAT.skin }]);
      continue;
    }
    rows.push(Array.from({ length: AROUND }, (_, j) => {
      const phi = (j / AROUND) * TAU;
      const p = facePoint(theta, phi);
      const ct = Math.cos(theta);
      /** How much of a small button nose this vertex carries; the shader raises it. */
      const nose = bump(ct + 0.4, 0.075) * bump(angleTo(phi, 0), 0.11);
      const skin: Skin = ct < -0.75 ? [[BONE.head, 0.8], [BONE.neck, 0.2]] : [[BONE.head, 1]];
      return { p, skin, mat: MAT.skin, k: nose, ao: 1 - 0.45 * smooth(-0.8, -0.98, ct), uv: [phi, ct] as [number, number] };
    }));
  }
  b.rows(rows, true, FACE.c);
  tube(b, V(0, 1.54, -0.005), V(0, 1, 0.12), V(1, 0, 0), [
    { s: 0, rx: 0.078, ry: 0.076, skin: [[BONE.chest, 0.5], [BONE.neck, 0.5]], mat: MAT.skin, ao: 0.2 },
    { s: 0.12, rx: 0.076, ry: 0.074, skin: [[BONE.neck, 1]], mat: MAT.skin, ao: 0.25 },
    { s: 0.24, rx: 0.08, ry: 0.078, skin: [[BONE.neck, 0.3], [BONE.head, 0.7]], mat: MAT.skin, ao: 0.35 },
  ], 16, V(0, 1.66, 0.01));
  for (const mx of [1, -1]) {
    const c = V(mx * 0.258, 1.925, 0.022);
    const rows: Point[][] = [];
    for (let i = 0; i <= 6; i++) {
      const th = (i / 6) * Math.PI;
      if (i === 0 || i === 6) {
        rows.push([{ p: c.clone().add(V(0, Math.cos(th) * 0.058, 0)), skin: [[BONE.head, 1]], mat: MAT.skin, ao: 0.8 }]);
        continue;
      }
      rows.push(Array.from({ length: 12 }, (_, j) => {
        const a = (j / 12) * TAU;
        return {
          p: c.clone().add(V(Math.cos(a) * 0.03 * Math.sin(th), Math.cos(th) * 0.058, Math.sin(a) * 0.042 * Math.sin(th))),
          skin: [[BONE.head, 1]] as Skin,
          mat: MAT.skin,
          ao: 0.8,
        };
      }));
    }
    b.rows(rows, true, c.clone().add(V(-mx * 0.02, 0, 0)));
  }
}

/** The hairline's height on the head relative to the face's middle, by angle from the front. */
function hairline(phi: number): number {
  const c = Math.cos(phi);
  return THREE.MathUtils.lerp(-0.22, 0.13, smooth(-0.95, 0.9, c)) - 0.12 * bump(Math.abs(angleTo(phi, 0)) - 1.4, 0.35);
}

const HAIR = { c: FACE.c.clone().add(V(0, 0.015, -0.02)), rx: 0.282, ry: 0.296, rz: 0.282 };

/**
 * The fringe and the hair round the face, as locks: angle from the front and the cosine down from the crown where
 * each starts and ends, its width, and how far it swings sideways along the way. Parted on the child's left, the
 * fringe sweeps across to the right; shorter locks fall the other way from the parting, and a few come down in front
 * of the ears.
 */
const LOCKS: [number, number, number, number, number, number][] = [
  [0.36, 0.92, -0.12, 0.2, 0.15, 0.1],
  [0.16, 0.9, -0.44, 0.27, 0.14, 0.08],
  [-0.08, 0.86, -0.74, 0.2, 0.13, 0.06],
  [-0.4, 0.8, -0.98, 0.06, 0.12, 0.05],
  [0.5, 0.88, 0.22, 0.3, 0.12, -0.07],
  [0.62, 0.82, 0.66, 0.34, 0.11, -0.09],
  [0.76, 0.76, 0.98, 0.18, 0.11, -0.07],
  [1.02, 0.66, 1.18, -0.28, 0.11, 0.06],
  [-1.08, 0.64, -1.2, -0.34, 0.115, -0.06],
  [1.3, 0.54, 1.36, -0.16, 0.1, 0.05],
  [-1.32, 0.52, -1.4, -0.22, 0.1, -0.05],
  [1.75, 0.45, 1.8, -0.32, 0.12, 0.04],
  [-1.75, 0.45, -1.8, -0.3, 0.12, -0.04],
];

function hair(b: Builder): void {
  const AROUND = 48;
  const ROWS = 16;
  const rows: Point[][] = [[{ p: HAIR.c.clone().add(V(0, HAIR.ry, 0)), skin: [[BONE.head, 1]], mat: MAT.hair }]];
  const lift = HAIR.c.y - FACE.c.y;
  for (let i = 1; i <= ROWS; i++) {
    rows.push(Array.from({ length: AROUND }, (_, j) => {
      const phi = (j / AROUND) * TAU;
      const end = Math.acos(THREE.MathUtils.clamp((hairline(phi) - lift) / HAIR.ry, -1, 1));
      const th = (i / ROWS) * end;
      const p = HAIR.c.clone().add(V(HAIR.rx * Math.sin(th) * Math.sin(phi), HAIR.ry * Math.cos(th), HAIR.rz * Math.sin(th) * Math.cos(phi)));
      return { p, skin: [[BONE.head, 1]] as Skin, mat: MAT.hair, ao: i === ROWS ? 0.7 : 1, uv: [phi, th] as [number, number] };
    }));
  }
  b.rows(rows, true, HAIR.c);
  for (const [phi0, c0, phi1, c1, width, swing] of LOCKS) lock(b, phi0, c0, phi1, c1, width, swing);
}

/** A point on the hair's shell, by angle from the front and the cosine of the angle down from the crown. */
function onHair(phi: number, ct: number, lift: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  const st = Math.sqrt(Math.max(0, 1 - ct * ct));
  const n = V(Math.sin(phi) * st / HAIR.rx, ct / HAIR.ry, Math.cos(phi) * st / HAIR.rz).normalize();
  const p = HAIR.c.clone().add(V(HAIR.rx * st * Math.sin(phi), HAIR.ry * ct, HAIR.rz * st * Math.cos(phi))).addScaledVector(n, lift);
  return { p, n };
}

function lock(b: Builder, phi0: number, c0: number, phi1: number, c1: number, width: number, swing: number): void {
  const STEPS = 14;
  const rows: Point[][] = [];
  const skin: Skin = [[BONE.head, 1]];
  /** The path over the shell, with a soft S across it so no lock runs straight. */
  const at = (t: number): [number, number] => [THREE.MathUtils.lerp(phi0, phi1, t) + swing * Math.sin(t * Math.PI * 1.5), THREE.MathUtils.lerp(c0, c1, t)];
  let last = V();
  const root = onHair(phi0, c0 + 0.03, -0.004);
  rows.push([{ p: root.p, skin, mat: MAT.hair }]);
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const [phi, ct] = at(t);
    /** Full at the root, tapering to a soft point that lifts a little off the head, the way a wave of hair ends. */
    const taper = t < 0.45 ? 1 : 1 - Math.pow((t - 0.45) / 0.55, 1.5);
    const thick = 0.026 * (1 - 0.5 * t) * Math.max(taper, 0.2);
    const w = width * 0.5 * (0.8 + 0.25 * Math.sin(Math.min(1, t / 0.4) * (Math.PI / 2))) * taper;
    const { p, n } = onHair(phi, ct, 0.003 + thick * 0.85 + 0.012 * Math.sin(t * Math.PI) + 0.018 * smooth(0.7, 1, t));
    const [phiN, ctN] = at(Math.min(1, t + 0.01));
    const along = onHair(phiN, ctN, 0).p.sub(onHair(phi, ct, 0).p).normalize();
    const side = V().crossVectors(n, along).normalize();
    if (i === STEPS) {
      rows.push([{ p: p.addScaledVector(along, 0.006), skin, mat: MAT.hair, uv: [t, 0] }]);
      break;
    }
    rows.push(Array.from({ length: 12 }, (_, j) => {
      const a = (j / 12) * TAU;
      return {
        p: p.clone().addScaledVector(side, Math.cos(a) * Math.max(w, 0.003)).addScaledVector(n, Math.sin(a) * Math.max(thick, 0.004)),
        skin,
        mat: MAT.hair,
        k: t,
        ao: 0.7 + 0.3 * Math.max(0, Math.sin(a)),
        uv: [t, Math.cos(a)] as [number, number],
      };
    }));
    last = p;
  }
  b.rows(rows, true, last.clone().addScaledVector(V().subVectors(HAIR.c, last).normalize(), 0.05));
}

// ---------------------------------------------------------------------------------------------------------------
// The hood

export const HOOD = {
  c: V(0, 2.065, -0.03),
  r: V(0.4, 0.368, 0.372),
  /** The opening faces forward and a touch down, so the brim just shades the fringe. */
  tilt: 0.1,
};

/**
 * How far round from the front the opening is cut, by angle round it from the top: the brim sits back over the
 * fringe, the sides open wide enough to show the ears and the hair beside them, and it narrows under the chin into
 * the scarf.
 */
function hoodOpen(lambda: number): number {
  const s = Math.sin(lambda);
  const c = Math.cos(lambda);
  return 0.8 + 0.3 * s * s * (1 - 0.55 * Math.max(0, -c)) + 0.08 * Math.pow(Math.max(0, -c), 2);
}
const hoodF = V(0, -Math.sin(HOOD.tilt), Math.cos(HOOD.tilt));
const hoodUp = V(0, Math.cos(HOOD.tilt), Math.sin(HOOD.tilt));
const hoodSide = V(1, 0, 0);

/** Direction from the hood's middle by angle round the opening (0 up) and angle back from the opening's axis. */
function hoodDir(lambda: number, gamma: number, out = V()): THREE.Vector3 {
  return out
    .copy(hoodF)
    .multiplyScalar(Math.cos(gamma))
    .addScaledVector(hoodUp, Math.sin(gamma) * Math.cos(lambda))
    .addScaledVector(hoodSide, Math.sin(gamma) * Math.sin(lambda));
}

/**
 * A bell, not a ball: an egg over the crown with a soft peak along the seam, sides that fall almost straight to the
 * shoulders, and a back that hangs down over the top of the bag. Under the chin it goes in behind the scarf.
 */
function hoodPoint(lambda: number, gamma: number): { p: THREE.Vector3; n: THREE.Vector3; fold: number; d: THREE.Vector3 } {
  const d = hoodDir(lambda, gamma);
  const r = HOOD.r;
  const flat = Math.hypot(d.x, d.z);
  const hx = flat > 1e-5 ? d.x / flat : 0;
  const hz = flat > 1e-5 ? d.z / flat : 0;
  const yN = THREE.MathUtils.clamp(d.y, -1, 1);
  const ring = yN >= 0 ? Math.sqrt(1 - yN * yN) : Math.pow(1 - Math.pow(-yN, 3), 1 / 3);
  const egg = smooth(0.3, 1.0, yN);
  const skirt = smooth(-0.15, -0.9, yN);
  const back = smooth(0.3, -0.6, hz);
  const p = V(
    r.x * ring * hx * (1 - 0.11 * egg) * (1 + 0.05 * skirt),
    r.y * yN - 0.09 * skirt * skirt * (0.45 + 0.55 * back),
    r.z * ring * hz * (1 - 0.05 * egg) * (1 + 0.05 * skirt * back),
  );
  p.y += 0.024 * smooth(0.5, 1.0, yN) * Math.exp(-(p.x * p.x) / 0.025);
  const n = V(p.x / (r.x * r.x), p.y / (r.y * r.y), p.z / (r.z * r.z)).normalize();
  /** A few broad folds: a crease down each side from the temple, and cloth gathered at the nape. */
  const fromRim = smooth(hoodOpen(lambda), hoodOpen(lambda) + 0.6, gamma) * (1 - smooth(2.3, 2.9, gamma));
  let fold = 0;
  for (const s of [1, -1]) {
    fold += -0.013 * bump(angleTo(lambda, s * 1.2), 0.16) * fromRim;
    fold += 0.009 * bump(angleTo(lambda, s * 0.85), 0.2) * fromRim;
    fold += 0.011 * bump(angleTo(lambda, s * 1.65), 0.22) * fromRim;
  }
  const nape = smooth(-0.1, -0.6, yN) * back;
  fold += nape * (0.014 * Math.sin(lambda * 7 + 0.6));
  /** The centre seam sits in a very slight valley. */
  const seam = -0.004 * bump(p.x, 0.012) * smooth(-0.3, 0.2, yN);
  p.addScaledVector(n, fold + seam);
  /** In front, below the chin, the hood goes in behind the scarf rather than lying over it. */
  const y = p.y + HOOD.c.y;
  const front = smooth(-0.05, 0.45, hz);
  if (y < 1.84 && front > 0) {
    const rr = Math.hypot(p.x, p.z + HOOD.c.z);
    const most = 0.25 + 1.4 * Math.max(0, y - 1.72);
    const w = 0.07;
    const soft = rr < most - w ? rr : most - w + w * Math.tanh((rr - most + w) / w);
    const k = THREE.MathUtils.lerp(1, soft / Math.max(rr, 1e-4), front);
    p.x *= k;
    p.z = (p.z + HOOD.c.z) * k - HOOD.c.z;
  }
  p.add(HOOD.c);
  return { p, n, fold, d };
}

function hoodSkin(d: THREE.Vector3, gamma: number): Skin {
  const lag = 0.7 * smooth(1.1, Math.PI * 0.95, gamma);
  const onBody = smooth(-0.3, -0.85, d.y) * smooth(0.4, -0.3, d.z);
  return [
    [BONE.head, (1 - lag) * (1 - onBody)],
    [BONE.hood, lag * (1 - onBody)],
    [BONE.neck, onBody * 0.45],
    [BONE.chest, onBody * 0.55],
  ];
}

function hood(b: Builder): void {
  const AROUND = 64;
  const ROWS = 30;
  const rows: Point[][] = [];
  for (let i = 0; i <= ROWS; i++) {
    if (i === ROWS) {
      const h = hoodPoint(0, Math.PI);
      rows.push([{ p: h.p, skin: hoodSkin(h.d, Math.PI), mat: MAT.coat, uv: [0, Math.PI] }]);
      break;
    }
    rows.push(Array.from({ length: AROUND }, (_, j) => {
      const lambda = (j / AROUND) * TAU;
      const gamma = THREE.MathUtils.lerp(hoodOpen(lambda), Math.PI, Math.pow(i / ROWS, 0.9));
      const h = hoodPoint(lambda, gamma);
      const ao = (1 - 0.4 * smooth(-0.35, -0.8, h.d.y)) * (1 + Math.min(0, h.fold) * 10);
      return { p: h.p, skin: hoodSkin(h.d, gamma), mat: MAT.coat, ao, uv: [lambda, gamma] as [number, number] };
    }));
  }
  b.rows(rows, true, HOOD.c);

  /** The thick rolled edge round the face: fullest over the brow, thinning where it goes down into the scarf. */
  const ALONG = 72;
  const rim: Point[][] = [];
  for (let i = 0; i < ALONG; i++) {
    const lambda = (i / ALONG) * TAU;
    const open = hoodOpen(lambda);
    const edge = hoodPoint(lambda, open);
    const inward = hoodPoint(lambda, open + 0.05).p.sub(edge.p).normalize();
    const tangent = hoodPoint(lambda + 0.01, hoodOpen(lambda + 0.01)).p.sub(edge.p).normalize();
    const out = V().crossVectors(tangent, inward).normalize();
    if (out.dot(edge.n) < 0) out.negate();
    const bottom = smooth(0.55, 0.95, -Math.cos(lambda));
    const r = 0.038 * (1 - 0.7 * bottom) * (1 + 0.1 * Math.cos(lambda));
    const centre = edge.p.clone().addScaledVector(inward, r * 0.35).addScaledVector(out, -r * 0.1);
    const skin = hoodSkin(edge.d, open);
    rim.push(Array.from({ length: 14 }, (_, j) => {
      const a = (j / 14) * TAU;
      return {
        p: centre.clone().addScaledVector(out, Math.cos(a) * r).addScaledVector(inward.clone().negate(), Math.sin(a) * r * 1.05),
        skin,
        mat: MAT.coat,
        k: 0.35,
        ao: 0.85 + 0.15 * Math.cos(a),
        uv: [lambda, a] as [number, number],
      };
    }));
  }
  b.rows(rim, true, HOOD.c, true);
}

// ---------------------------------------------------------------------------------------------------------------
// The scarf's wrap and the bag

/** Where the scarf's wrap runs round the neck, by angle from the front: two turns, the lower one fuller. */
const BANDS = [
  { y: 1.6, x: 0.262, z: 0.232, sag: 0.03, ry: 0.086, rr: 0.078, phase: 0 },
  { y: 1.672, x: 0.232, z: 0.212, sag: -0.012, ry: 0.078, rr: 0.07, phase: 2.2 },
];
export function wrapPath(theta: number, out = V(), band = 0): THREE.Vector3 {
  const w = BANDS[band];
  return out.set(w.x * Math.sin(theta), w.y - w.sag * Math.cos(theta), 0.012 + w.z * Math.cos(theta));
}
/** The knot the two ends come out of: front, on the child's left. */
export const KNOT_THETA = 0.72;

function wrap(b: Builder): void {
  for (let band = 0; band < BANDS.length; band++) wrapBand(b, band);
}

function wrapBand(b: Builder, band: number): void {
  const ALONG = 80;
  const AROUND = 16;
  const rows: Point[][] = [];
  const w = BANDS[band];
  for (let i = 0; i < ALONG; i++) {
    const theta = (i / ALONG) * TAU;
    const c = wrapPath(theta, V(), band);
    const t = wrapPath(theta + 0.01, V(), band).sub(c).normalize();
    const outward = V(c.x, 0, c.z - 0.012).normalize();
    const up = V().crossVectors(outward, t).normalize();
    if (up.y < 0) up.negate();
    const knot = band === 0 ? bump(angleTo(theta, KNOT_THETA), 0.32) : 0.4 * bump(angleTo(theta, KNOT_THETA + 0.25), 0.3);
    /** Knitted wool bunched as it goes round: never an even tube. */
    const lump = 1 + 0.09 * Math.sin(2 * theta + 0.5 + w.phase) + 0.05 * Math.sin(5 * theta + 2 + w.phase) + 0.4 * knot;
    const ry = w.ry * lump;
    const rr = w.rr * lump;
    const centre = c.clone().addScaledVector(outward, 0.018 * knot).addScaledVector(up, -0.012 * knot);
    const front = smooth(-0.2, 0.6, Math.cos(theta));
    const skin: Skin = [[BONE.chest, 0.6 - 0.15 * front], [BONE.neck, 0.4], [BONE.head, 0.15 * front]];
    rows.push(Array.from({ length: AROUND }, (_, j) => {
      const a = (j / AROUND) * TAU;
      return {
        p: centre.clone().addScaledVector(outward, Math.cos(a) * rr).addScaledVector(up, Math.sin(a) * ry),
        skin,
        mat: MAT.knit,
        ao: 0.75 + 0.25 * Math.max(0, Math.cos(a)) - 0.25 * Math.max(0, -Math.sin(a)) * 0.6,
        uv: [(theta / TAU) * 1.35 + band * 0.37, a / TAU] as [number, number],
      };
    }));
  }
  b.rows(rows, true, V(0, w.y, 0.012), true);
}

/** Low on the back, as in the concept: the bird rides at the shoulders with its head beside the hood, not in it. */
export const BAG = { c: V(0, 1.23, -0.48), lip: 1.42 };
const BAG_BOTTOM = -0.27;
/** How square the box is round its sides: 2 would be an ellipse, higher a box with rounder and rounder corners. */
const BAG_SQUARE = 4;

/** Half-width and half-depth by how far up from the bottom (0..1): soft leather bellies out low down, under the weight. */
function bagSize(f: number): [number, number] {
  const belly = bump(f - 0.3, 0.38);
  return [0.25 + 0.03 * belly, 0.165 + 0.035 * belly];
}

/** The open top sags between the corners, and its near side, against the child, stands higher than the far. */
function bagLip(phi: number): number {
  const c = Math.cos(phi);
  return BAG.lip - BAG.c.y + 0.04 * c - 0.022 * c * c + 0.008 * Math.sin(3 * phi + 0.5);
}

function bagPoint(phi: number, h: number, scale = 1, crease = 0): THREE.Vector3 {
  const f = THREE.MathUtils.clamp((h - BAG_BOTTOM) / (bagLip(phi) - BAG_BOTTOM), 0, 1);
  const [a, b] = bagSize(f);
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const e = 2 / BAG_SQUARE;
  /** Soft creases where the leather gives under the weight, down the far face and the sides. */
  const give = 1 + crease * 0.03 * Math.sin(7 * phi + 1.3) * Math.max(0, -c + 0.4);
  const x = a * scale * give * Math.sign(s) * Math.pow(Math.abs(s), e);
  let z = b * scale * give * Math.sign(c) * Math.pow(Math.abs(c), e);
  /** Its weight slumps the far face out and down. */
  if (c < 0) z -= 0.03 * smooth(0.4, 0.0, f) * -c;
  return V(x, h, z).add(BAG.c);
}

/** Out from the box's side at a point, in the horizontal plane. */
function bagOutward(phi: number): THREE.Vector3 {
  const [a, b] = bagSize(1);
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const e = 2 / BAG_SQUARE;
  const gx = Math.pow(Math.abs(s), e * (BAG_SQUARE - 1)) / a;
  const gz = Math.pow(Math.abs(c), e * (BAG_SQUARE - 1)) / b;
  return V(Math.sign(s) * gx, 0, Math.sign(c) * gz).normalize();
}

/** Down the side from the lip (f 1) to the bottom (f 0), then in across the flat bottom (scale falling to 0). */
const BAG_ROWS: [number, number][] = [
  [1, 1], [0.9, 1], [0.76, 1], [0.62, 1], [0.48, 1], [0.34, 1], [0.21, 1], [0.1, 0.995], [0.045, 0.97], [0.014, 0.915], [0, 0.82], [0, 0.45], [0, 0],
];

function bag(b: Builder): void {
  const AROUND = 48;
  const rows: Point[][] = [];
  const skinAt = (phi: number, h: number): Skin => {
    const top = smooth(0.0, 0.2, h) * smooth(0.2, 0.9, Math.cos(phi));
    return [[BONE.bag, 1 - 0.5 * top], [BONE.chest, 0.5 * top]];
  };
  for (const [f, scale] of BAG_ROWS) {
    if (scale === 0) {
      rows.push([{ p: bagPoint(0, BAG_BOTTOM, 0), skin: skinAt(0, BAG_BOTTOM), mat: MAT.leather, ao: 0.7 }]);
      continue;
    }
    rows.push(Array.from({ length: AROUND }, (_, j) => {
      const phi = (j / AROUND) * TAU;
      const hh = THREE.MathUtils.lerp(BAG_BOTTOM, bagLip(phi), f);
      const crease = smooth(1, 0.7, f) * smooth(0, 0.35, f);
      const ao = (1 - 0.3 * smooth(0.5, 0.05, f)) * (1 - 0.2 * crease * Math.max(0, -Math.sin(7 * phi + 1.3))) * (scale < 0.9 ? 0.75 : 1);
      return { p: bagPoint(phi, hh, scale, crease), skin: skinAt(phi, hh), mat: MAT.leather, ao, uv: [phi, hh] as [number, number] };
    }));
  }
  /** The inside of the mouth: the leather turns in over the rim and goes down into the bag. */
  const inner: Point[][] = [];
  for (const [scale, dh, ao] of [[0.92, -0.015, 0.5], [0.86, -0.09, 0.3]] as const) {
    inner.push(Array.from({ length: AROUND }, (_, j) => {
      const phi = (j / AROUND) * TAU;
      const hh = bagLip(phi) + dh;
      return { p: bagPoint(phi, hh, scale), skin: skinAt(phi, hh), mat: MAT.leather, k: 1, ao, uv: [phi, hh] as [number, number] };
    }));
  }
  b.rows([...inner.reverse(), ...rows], true, BAG.c);
  /** The rolled rim. */
  const rim: Point[][] = [];
  for (let j = 0; j < AROUND; j++) {
    const phi = (j / AROUND) * TAU;
    const hh = bagLip(phi);
    const out = bagOutward(phi);
    const c = bagPoint(phi, hh, 0.975);
    rim.push(Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * TAU;
      return { p: c.clone().addScaledVector(out, Math.cos(a) * 0.022).add(V(0, Math.sin(a) * 0.02, 0)), skin: skinAt(phi, hh), mat: MAT.strap, k: 0.4 };
    }));
  }
  b.rows(rim, true, V(0, bagLip(0) + BAG.c.y, BAG.c.z), true);
}

/** The shoulder straps lie on the coat: each is authored on the coat's own surface, by angle and height. */
function strap(b: Builder, left: boolean): void {
  const mx = left ? 1 : -1;
  const path: [number, number][] = [
    [2.7, 1.3], [2.55, 1.42], [2.3, 1.52], [2.0, 1.575], [1.62, 1.597], [1.2, 1.585], [0.85, 1.54], [0.64, 1.46], [0.56, 1.36], [0.58, 1.25],
    [0.7, 1.16], [0.95, 1.1],
  ];
  const curve = new THREE.SplineCurve(path.map(([a, y]) => new THREE.Vector2(a, y)));
  const N = 40;
  const rows: Point[][] = [];
  const s = { p: V(), n: V(), fold: 0 };
  for (let i = 0; i <= N; i++) {
    const q = curve.getPointAt(i / N);
    const a = mx * q.x;
    coatAt(a, q.y, s);
    const p0 = s.p.clone();
    const na = coatAt(a + 0.01, q.y).p.sub(p0);
    const ny = coatAt(a, q.y + 0.01).p.sub(p0);
    const n = V().crossVectors(na, ny).normalize();
    if (n.dot(V(p0.x, 0.3, p0.z)) < 0) n.negate();
    const q2 = curve.getPointAt(Math.min(1, i / N + 0.01));
    const along = coatAt(mx * q2.x, q2.y).p.sub(p0).normalize();
    if (i === N) along.copy(p0).sub(coatAt(mx * curve.getPointAt(1 - 0.01).x, curve.getPointAt(1 - 0.01).y).p).normalize();
    const across = V().crossVectors(n, along).normalize();
    const centre = p0.addScaledVector(n, 0.014);
    const skin = coatSkin(a, q.y, s.p.x);
    const W = 0.034;
    const T = 0.009;
    const corners: [number, number][] = [[-1, -1], [-0.8, 0], [-1, 1], [0, 1.15], [1, 1], [0.8, 0], [1, -1], [0, -1.1]];
    rows.push(corners.map(([u, v]) => ({
      p: centre.clone().addScaledVector(across, u * W).addScaledVector(n, v * T),
      skin,
      mat: MAT.strap,
      ao: v < 0 ? 0.6 : 1,
      uv: [i / N, u] as [number, number],
    })));
  }
  b.rows(rows, true, coatAt(mx * 1.2, 1.4).p.multiplyScalar(0.5));
}

export function buildGarments(rest: THREE.Vector3[], bind: THREE.Matrix4[]): Builder {
  const b = new Builder();
  coat(b);
  sleeve(b, rest, true);
  sleeve(b, rest, false);
  mitten(b, bind, true);
  mitten(b, bind, false);
  leg(b, rest, true);
  leg(b, rest, false);
  face(b);
  hair(b);
  hood(b);
  wrap(b);
  bag(b);
  strap(b, true);
  strap(b, false);
  return b;
}

import * as THREE from 'three';
import { blob, merge, mirrored, type BlobSpec, type V3 } from '../shapes';

/** Parts the vertex shader moves: the body is rigid, the neck bends along its length and the wings along their span. */
export const BODY = 0;
export const NECK = 1;
export const HEAD = 2;
export const WING_L = 3;
export const WING_R = 4;
export const TAIL = 5;
export const FEET = 6;

export const PLUME = 0;
export const VANE = 1;
export const BILL = 2;
export const FOOT = 3;
export const EYE = 4;

/** The neck's root sits inside the breast, so however far it bends the joint is never on the outside of the bird. */
export const NECK_AT: V3 = [0, 0.054, 0.238];
export const NECK_LEN = 0.9;
export const HEAD_AT: V3 = [0, NECK_AT[1], NECK_AT[2] + NECK_LEN];
/** Where a wing leaves the body, and the half-span it covers running straight out along x. */
export const SHOULDER: V3 = [0.13, 0.08, 0.054];
export const SPAN = 1.78;
export const TAIL_AT: V3 = [0, 0.076, -0.4];

const TAU = Math.PI * 2;

const at = (v: number[], i: number) => v[Math.min(v.length - 1, Math.max(0, i))];

/** Catmull-Rom through a short table of numbers, so a wing profile can be authored as a handful of values. */
function spline(v: number[], s: number): number {
  const f = s * (v.length - 1);
  const i = Math.min(v.length - 2, Math.floor(f));
  const t = f - i;
  const [p0, p1, p2, p3] = [at(v, i - 1), at(v, i), at(v, i + 1), at(v, i + 2)];
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
}

function attribute(geo: THREE.BufferGeometry, name: string, value: number): THREE.BufferGeometry {
  geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(value), 1));
  return geo;
}

interface Ring {
  z: number;
  y: number;
  rx: number;
  up: number;
  down: number;
}

/**
 * A closed skin swept along z: every ring is an ellipse that can be deeper below its centre than above. `along`
 * is written into `aSpan` as the fraction of the way down the sweep, which is how the shader knows where on a
 * neck a vertex sits.
 */
function sweptSkin(part: number, mat: number, rings: Ring[], around: number, blend?: (t: number, a: number) => number, along = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const mats: number[] = [];
  const spans: number[] = [];
  const idx: number[] = [];
  const push = (x: number, y: number, z: number, t: number, k: number) => {
    pos.push(x, y, z);
    mats.push(mat, k);
    spans.push(along ? t : 0);
  };
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    const t = i / (rings.length - 1);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * TAU;
      const lift = Math.sin(a);
      push(r.rx * Math.cos(a), r.y + (lift >= 0 ? r.up : r.down) * lift, r.z, t, blend ? blend(t, a) : 0);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      idx.push(a, b, a + around, b, b + around, a + around);
    }
  }
  for (const [ring, first] of [
    [0, true],
    [rings.length - 1, false],
  ] as const) {
    const r = rings[ring];
    const pole = pos.length / 3;
    push(0, r.y, r.z, first ? 0 : 1, blend ? blend(first ? 0 : 1, -Math.PI / 2) : 0);
    for (let j = 0; j < around; j++) {
      const a = ring * around + j;
      const b = ring * around + ((j + 1) % around);
      if (first) idx.push(pole, b, a);
      else idx.push(pole, a, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(mats, 2));
  geo.setAttribute('aSpan', new THREE.Float32BufferAttribute(spans, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return attribute(geo, 'aPart', part);
}

/** Leading edge, chord and thickness across the wing: broad and blunt over the arm, swept and thin at the hand. */
const LEAD = [0.2, 0.225, 0.225, 0.2, 0.15, 0.04, -0.2];
const CHORD = [0.44, 0.53, 0.57, 0.55, 0.47, 0.33, 0.09];
const THICK = [0.062, 0.055, 0.048, 0.04, 0.03, 0.018, 0.008];

/**
 * One wing as a closed airfoil lofted along +x, carrying its span fraction in `aSpan`. The shader bends it from
 * that fraction alone, so the whole wing is one smooth sheet with no hinge to break.
 */
function wingSkin(part: number, side: number): THREE.BufferGeometry {
  const stations = 15;
  const around = 12;
  const pos: number[] = [];
  const mats: number[] = [];
  const spans: number[] = [];
  const idx: number[] = [];
  const [sx, sy, sz] = SHOULDER;
  for (let i = 0; i <= stations; i++) {
    const s = i / stations;
    const c = spline(CHORD, s);
    const le = spline(LEAD, s);
    const th = spline(THICK, s) * (i === stations ? 0.25 : 1);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * TAU;
      const along = 0.5 - 0.5 * Math.cos(a);
      /** Cambered, and more so over the arm: the underside stays in shadow where the top catches the sun. */
      const camber = Math.sin(along * Math.PI) * c * (0.13 - 0.07 * s);
      pos.push((sx + s * SPAN) * side, sy + Math.sin(a) * th * (1 - along * 0.55) + camber, sz + le - c * along);
      mats.push(VANE, s);
      spans.push(s);
    }
  }
  const ring = (i: number, j: number) => i * around + (j % around);
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < around; j++) {
      const [a, b, d, e] = [ring(i, j), ring(i, j + 1), ring(i + 1, j), ring(i + 1, j + 1)];
      if (side > 0) idx.push(a, b, d, b, e, d);
      else idx.push(a, d, b, b, d, e);
    }
  }
  for (const [i, first] of [
    [0, true],
    [stations, false],
  ] as const) {
    const pole = pos.length / 3;
    pos.push((sx + (first ? 0 : SPAN)) * side, sy, sz + spline(LEAD, first ? 0 : 1) - spline(CHORD, first ? 0 : 1) * 0.5);
    mats.push(VANE, first ? 0 : 1);
    spans.push(first ? 0 : 1);
    for (let j = 0; j < around; j++) {
      const [a, b] = [ring(i, j), ring(i, j + 1)];
      if (first === side > 0) idx.push(pole, b, a);
      else idx.push(pole, a, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(mats, 2));
  geo.setAttribute('aSpan', new THREE.Float32BufferAttribute(spans, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return attribute(geo, 'aPart', part);
}

/** Deep-keeled and short: a swan's body is a boat, and a boat that floats high is what says swan at any distance. */
const BODY_RINGS: Ring[] = [
  { z: 0.475, y: 0.081, rx: 0.03, up: 0.028, down: 0.032 },
  { z: 0.443, y: 0.063, rx: 0.093, up: 0.089, down: 0.099 },
  { z: 0.378, y: 0.035, rx: 0.14, up: 0.14, down: 0.16 },
  { z: 0.281, y: 0.012, rx: 0.17, up: 0.179, down: 0.201 },
  { z: 0.151, y: 0.001, rx: 0.184, up: 0.197, down: 0.222 },
  { z: 0, y: 0, rx: 0.186, up: 0.203, down: 0.23 },
  { z: -0.14, y: 0.004, rx: 0.176, up: 0.197, down: 0.216 },
  { z: -0.27, y: 0.017, rx: 0.151, up: 0.173, down: 0.179 },
  { z: -0.378, y: 0.037, rx: 0.117, up: 0.136, down: 0.13 },
  { z: -0.464, y: 0.056, rx: 0.076, up: 0.089, down: 0.078 },
  { z: -0.518, y: 0.068, rx: 0.032, up: 0.038, down: 0.032 },
];

/** The neck: thick where it leaves the breast, slimmest two thirds of the way up, swelling again into the head. */
const NECK_RINGS: Ring[] = (() => {
  const r = [0.138, 0.121, 0.101, 0.085, 0.076, 0.07, 0.066, 0.063, 0.062, 0.062, 0.064, 0.066, 0.063];
  return r.map((rx, i) => {
    const t = i / (r.length - 1);
    return { z: NECK_AT[2] + t * NECK_LEN, y: NECK_AT[1], rx, up: rx * 0.94, down: rx * 1.04 };
  });
})();

const TAIL_RINGS: Ring[] = [
  { z: TAIL_AT[2], y: TAIL_AT[1], rx: 0.103, up: 0.054, down: 0.054 },
  { z: TAIL_AT[2] - 0.086, y: TAIL_AT[1] + 0.005, rx: 0.124, up: 0.034, down: 0.034 },
  { z: TAIL_AT[2] - 0.173, y: TAIL_AT[1] + 0.01, rx: 0.113, up: 0.023, down: 0.023 },
  { z: TAIL_AT[2] - 0.248, y: TAIL_AT[1] + 0.013, rx: 0.084, up: 0.015, down: 0.015 },
  { z: TAIL_AT[2] - 0.297, y: TAIL_AT[1] + 0.015, rx: 0.035, up: 0.01, down: 0.01 },
];

/** The bill runs on from the forehead with no step, and dips at the tip. */
const BILL_RINGS: Ring[] = [0, 0.065, 0.14, 0.216, 0.27, 0.313, 0.33].map((d, i) => ({
  z: HEAD_AT[2] + 0.043 + d,
  y: HEAD_AT[1] + 0.028 - d * 0.14,
  rx: [0.052, 0.058, 0.056, 0.053, 0.048, 0.032, 0.009][i],
  up: [0.032, 0.03, 0.024, 0.018, 0.014, 0.01, 0.004][i],
  down: [0.03, 0.028, 0.024, 0.021, 0.017, 0.012, 0.005][i],
}));

/**
 * A swan in the air: a long body, a neck as long again held straight out in front, broad blunt wings and black
 * feet trailing under the tail. Everything is authored in one rest pose — neck and wings straight — and bent from
 * per-instance numbers, so the same mesh flies, folds up on the water and sleeps with its head on its back.
 */
export function swanGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pair = (spec: BlobSpec, right: number) => {
    parts.push(attribute(blob(spec), 'aSpan', 0));
    parts.push(attribute(blob(mirrored(spec, right)), 'aSpan', 0));
  };

  parts.push(sweptSkin(BODY, PLUME, BODY_RINGS, 14, (_, a) => Math.max(0, -Math.sin(a)) * 0.55));
  parts.push(sweptSkin(NECK, PLUME, NECK_RINGS, 12, undefined, true));
  parts.push(sweptSkin(TAIL, PLUME, TAIL_RINGS, 10));
  parts.push(wingSkin(WING_L, 1), wingSkin(WING_R, -1));

  parts.push(
    attribute(
      blob({
        part: HEAD,
        mat: PLUME,
        at: HEAD_AT,
        size: [0.085, 0.093, 0.124],
        offset: [0, 0.019, 0.013],
        detail: 2,
        /** The crown is flat and the forehead runs straight into the bill: no step, or it stops being a swan. */
        shape: (u) => {
          u.y -= Math.max(0, u.z) * Math.max(0, u.y) * 0.34;
          u.z *= 1 + Math.max(0, -u.z) * 0.18;
        },
      }),
      'aSpan',
      0,
    ),
  );
  parts.push(sweptSkin(HEAD, BILL, BILL_RINGS, 10, (t) => 1 - Math.min(1, t * 2.4)));
  pair({ part: HEAD, mat: EYE, at: [0.065, HEAD_AT[1] + 0.055, HEAD_AT[2] + 0.063], size: [0.017, 0.018, 0.017], detail: 1 }, HEAD);

  /** Feet up under the tail, toes trailing: the one piece of black on a white bird seen from below. */
  const foot: BlobSpec = {
    part: FEET,
    mat: FOOT,
    at: [0.059, -0.049, -0.454],
    size: [0.067, 0.018, 0.162],
    offset: [0, 0, -0.151],
    rot: [-0.06, -0.09, 0],
    detail: 2,
    shape: (u) => {
      const back = Math.max(0, -u.z);
      u.x *= 0.34 + 0.66 * back;
      u.y *= 1 - 0.45 * back;
    },
  };
  pair(foot, FEET);
  pair({ part: FEET, mat: FOOT, at: [0.063, -0.041, -0.421], size: [0.03, 0.024, 0.076], detail: 1 }, FEET);

  return merge(parts);
}

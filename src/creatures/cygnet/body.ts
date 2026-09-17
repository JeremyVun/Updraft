import type * as THREE from 'three';
import { blob, loft, merge, mirrored, skinned, type BlobSpec, type Station, type V3 } from '../shapes';

/**
 * A swan cygnet the way a child would draw one: a pear of pale grey down low to the ground, a soft neck long enough
 * to make an S, a round head with big dark eyes and a flat dark bill, short legs set well back on outsized webbed
 * feet, and wings that are still mostly arm. Body, neck and head are one skin, so nothing about it has a seam.
 * Everything is authored in one rest space (standing, neck straight up, wings straight out) and bound to bones.
 */
export const BONES = 21;
export const [
  ROOT, BODY, NECK_1, NECK_2, NECK_3, NECK_4, HEAD, JAW, TAIL,
  WING_L, FORE_L, HAND_L, WING_R, FORE_R, HAND_R,
  THIGH_L, SHIN_L, FOOT_L, THIGH_R, SHIN_R, FOOT_R,
] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
export const NECK = [NECK_1, NECK_2, NECK_3, NECK_4];

export const COAT = 0;
export const QUILL = 1;
export const BILL = 2;
export const SHANK = 3;
export const EYE = 4;

export const SIZE = 1;
export const THIGH = 0.07;
export const SHIN = 0.088;
/** How far the sole is below the ankle. */
export const SOLE = 0.014;
const STAND = 0.215;
const NECK_LINK = 0.052;

/** Each joint's rest position on its parent. */
export const SKELETON: [bone: number, parent: number, at: V3][] = [
  [BODY, ROOT, [0, STAND, 0]],
  [NECK_1, BODY, [0, 0.1, 0.17]],
  [NECK_2, NECK_1, [0, NECK_LINK, 0]],
  [NECK_3, NECK_2, [0, NECK_LINK, 0]],
  [NECK_4, NECK_3, [0, NECK_LINK, 0]],
  [HEAD, NECK_4, [0, NECK_LINK, 0]],
  [JAW, HEAD, [0, 0.056, 0.078]],
  [TAIL, BODY, [0, 0.035, -0.17]],
  [WING_L, BODY, [0.118, 0.055, 0.06]],
  [FORE_L, WING_L, [0.1, 0, 0]],
  [HAND_L, FORE_L, [0.11, 0, 0]],
  [WING_R, BODY, [-0.118, 0.055, 0.06]],
  [FORE_R, WING_R, [-0.1, 0, 0]],
  [HAND_R, FORE_R, [-0.11, 0, 0]],
  [THIGH_L, BODY, [0.062, -0.065, -0.05]],
  [SHIN_L, THIGH_L, [0, -THIGH, 0]],
  [FOOT_L, SHIN_L, [0, -SHIN, 0]],
  [THIGH_R, BODY, [-0.062, -0.065, -0.05]],
  [SHIN_R, THIGH_R, [0, -THIGH, 0]],
  [FOOT_R, SHIN_R, [0, -SHIN, 0]],
];

/** Where each joint is in the rest space the mesh is authored in. */
export const REST: V3[] = (() => {
  const out: V3[] = [[0, 0, 0]];
  for (const [bone, parent, [x, y, z]] of SKELETON) out[bone] = [out[parent][0] + x, out[parent][1] + y, out[parent][2] + z];
  return out;
})();

/** Eye centre in rest space (left eye); the shader closes the lids around it. */
export const EYE_AT: V3 = [0.079, REST[HEAD][1] + 0.082, REST[HEAD][2] + 0.046];
export const EYE_R = 0.026;

/** Where the child's mittens go, in the body's own frame: under the belly either side, and the middle of the back. */
export const HOLDS = { bellyL: [0.1, -0.1, 0.02] as V3, bellyR: [-0.1, -0.1, 0.02] as V3, back: [0, 0.11, -0.03] as V3 };

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function skin(): Station[] {
  const b = REST[BODY];
  const body = (z: number, y: number, rx: number, up: number, down: number, s: [number, number, number] = [BODY, BODY, 0]): Station => ({
    at: add(b, [0, y, z]),
    rx,
    up,
    down,
    skin: s,
  });
  const st: Station[] = [
    body(-0.245, 0.098, 0.004, 0.003, 0.003, [TAIL, TAIL, 0]),
    body(-0.232, 0.09, 0.024, 0.013, 0.014, [TAIL, TAIL, 0]),
    body(-0.208, 0.07, 0.048, 0.028, 0.032, [TAIL, TAIL, 0]),
    body(-0.172, 0.042, 0.088, 0.06, 0.07, [BODY, TAIL, 0.5]),
    body(-0.125, 0.018, 0.128, 0.094, 0.11),
    body(-0.065, 0.004, 0.152, 0.116, 0.134),
    body(0, 0, 0.16, 0.124, 0.14),
    body(0.06, 0.006, 0.155, 0.122, 0.138),
    body(0.108, 0.024, 0.138, 0.11, 0.132),
    body(0.142, 0.052, 0.114, 0.088, 0.122),
    body(0.162, 0.086, 0.09, 0.07, 0.1, [BODY, NECK_1, 0.35]),
  ];
  /** The neck: a ring at every joint, shared between the bones either side, and one between, so it bends as a curve. */
  const radius = [0.07, 0.063, 0.059, 0.056, 0.055, 0.054, 0.054, 0.055, 0.059];
  for (let i = 0; i < 4; i++) {
    const joint = REST[NECK[i]];
    const below = i === 0 ? BODY : NECK[i - 1];
    const r = radius[i * 2];
    const rm = radius[i * 2 + 1];
    st.push({ at: joint, rx: r, up: r * 0.95, down: r * (i === 0 ? 1.25 : 1.02), skin: [below, NECK[i], 0.5] });
    st.push({ at: add(joint, [0, NECK_LINK / 2, 0]), rx: rm, up: rm * 0.95, down: rm * 1.02, skin: [NECK[i], NECK[i], 0] });
  }
  const h = REST[HEAD];
  const head = (y: number, z: number, rx: number, up: number, down: number, s: [number, number, number] = [HEAD, HEAD, 0]): Station => ({
    at: add(h, [0, y, z]),
    rx,
    up,
    down,
    skin: s,
  });
  st.push(
    head(0, 0, 0.061, 0.06, 0.063, [NECK_4, HEAD, 0.5]),
    head(0.022, 0.006, 0.08, 0.074, 0.084),
    head(0.05, 0.012, 0.097, 0.088, 0.1),
    head(0.082, 0.014, 0.103, 0.094, 0.102),
    head(0.112, 0.012, 0.097, 0.09, 0.092),
    head(0.14, 0.008, 0.078, 0.074, 0.072),
    head(0.161, 0.003, 0.047, 0.046, 0.042),
    head(0.171, 0, 0.004, 0.004, 0.004),
  );
  return st;
}

function bill(bone: number, y: number, up: number, down: number, reach: number): Station[] {
  const from = add(REST[HEAD], [0, y, 0.074]);
  const ring = (z: number, drop: number, rx: number, k: number): Station => ({
    at: add(from, [0, -drop, z]),
    rx,
    up: up * k,
    down: down * k,
    skin: [bone, bone, 0],
  });
  return [
    ring(0, 0, 0.004, 0.2),
    ring(0.014, 0, 0.04, 1),
    ring(reach * 0.32, 0.005, 0.04, 0.84),
    ring(reach * 0.6, 0.012, 0.042, 0.62),
    ring(reach * 0.82, 0.018, 0.041, 0.48),
    ring(reach * 0.95, 0.023, 0.031, 0.38),
    ring(reach, 0.026, 0.004, 0.1),
  ];
}

export function cygnetGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rigid = (spec: BlobSpec) => parts.push(skinned(blob(spec)));
  const pair = (spec: BlobSpec, right: number) => {
    rigid(spec);
    rigid(mirrored(spec, right));
  };

  parts.push(
    loft({
      stations: skin(),
      mat: COAT,
      around: 28,
      smooth: 2,
      /** Darker down along the back, the nape and the crown; palest on the belly, the breast, the throat and the face. */
      blend: (t, a) => 0.56 - Math.sin(a) * 0.4 - Math.max(0, t - 0.9) * 2.2 * Math.max(0, Math.sin(a) + 0.4),
    }),
  );
  parts.push(loft({ stations: bill(HEAD, 0.066, 0.03, 0.009, 0.118), mat: BILL, around: 12, blend: (t) => Math.max(0, (t - 0.78) / 0.22) }));
  parts.push(loft({ stations: bill(JAW, 0.054, 0.004, 0.013, 0.106), mat: BILL, around: 12, blend: (t) => Math.max(0, (t - 0.78) / 0.22) * 0.6 }));
  pair({ part: HEAD, mat: EYE, at: EYE_AT, size: [EYE_R * 0.8, EYE_R, EYE_R], detail: 2 }, HEAD);

  /** The wing is arm first: three downy lengths, the outer two carrying a row of soft grey quills that fan when it opens. */
  const arm = (bone: number, from: V3, length: number, r0: number, r1: number): Station[] => {
    const n = 5;
    const out: Station[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const end = i === 0 || i === n ? 0.12 : 1;
      const r = (r0 + (r1 - r0) * k) * end;
      out.push({ at: add(from, [length * k, 0, 0]), rx: r * 1.5, up: r, down: r, skin: [bone, bone, 0] });
    }
    return out;
  };
  const wing: THREE.BufferGeometry[] = [];
  const quill = (bone: number, root: V3, length: number, width: number, spin: number, droop = 0): THREE.BufferGeometry =>
    skinned(
      blob({
        part: bone,
        mat: QUILL,
        at: root,
        size: [width, 0.0045, length / 2],
        offset: [0, 0, -length / 2],
        rot: [droop, spin, 0],
        detail: 2,
        shape: (u) => {
          const tip = Math.max(0, -u.z);
          u.x *= 1 - 0.45 * tip * tip;
        },
        blend: (u) => Math.max(0, -u.z) ** 1.5,
      }),
    );
  wing.push(loft({ stations: arm(WING_L, REST[WING_L], 0.1, 0.034, 0.028), mat: COAT, around: 10, side: [0, 0, 1], blend: () => 0.42 }));
  wing.push(loft({ stations: arm(FORE_L, REST[FORE_L], 0.11, 0.029, 0.022), mat: COAT, around: 10, side: [0, 0, 1], blend: () => 0.4 }));
  wing.push(loft({ stations: arm(HAND_L, REST[HAND_L], 0.085, 0.022, 0.012), mat: COAT, around: 10, side: [0, 0, 1], blend: () => 0.38 }));
  for (let i = 0; i < 3; i++) wing.push(quill(WING_L, add(REST[WING_L], [0.025 + i * 0.03, -0.004, -0.01]), 0.1 + i * 0.012, 0.022, 0.12 - i * 0.05));
  for (let i = 0; i < 4; i++) wing.push(quill(FORE_L, add(REST[FORE_L], [0.012 + i * 0.028, -0.004, -0.008]), 0.138 + i * 0.006, 0.021, -0.04 - i * 0.05));
  for (let i = 0; i < 5; i++) wing.push(quill(HAND_L, add(REST[HAND_L], [0.008 + i * 0.019, -0.004, -0.004]), 0.15 - i * 0.004, 0.018, -0.3 - i * 0.26));
  for (const g of wing) {
    parts.push(g);
    parts.push(mirrorSkin(g));
  }

  pair(
    {
      part: THIGH_L,
      mat: COAT,
      at: REST[THIGH_L],
      size: [0.04, THIGH * 0.72, 0.046],
      offset: [0, -THIGH * 0.42, 0],
      blend: (u) => 0.72 - u.y * 0.1,
    },
    THIGH_R,
  );
  pair({ part: SHIN_L, mat: SHANK, at: REST[SHIN_L], size: [0.0155, SHIN / 2 + 0.008, 0.0175], offset: [0, -SHIN / 2, 0], detail: 1 }, SHIN_R);
  pair({ part: FOOT_L, mat: SHANK, at: REST[FOOT_L], size: [0.018, 0.016, 0.02], offset: [0, -0.002, 0.002], detail: 1 }, FOOT_R);
  /** The web: a flat triangle from the heel, scalloped between three toes, and far too big for it. */
  pair(
    {
      part: FOOT_L,
      mat: SHANK,
      at: REST[FOOT_L],
      size: [0.062, 0.0042, 0.066],
      offset: [0.004, -SOLE + 0.004, 0.058],
      detail: 3,
      shape: (u) => {
        const along = (u.z + 1) / 2;
        const spread = u.x / Math.max(0.2, along);
        u.x *= 0.12 + 0.88 * along;
        const between = Math.cos(Math.min(1, Math.abs(spread)) * Math.PI * 2);
        if (u.z > 0) u.z *= 1 - 0.16 * (1 - between) * 0.5 * Math.min(1, along * 1.2);
      },
      blend: () => 0.35,
    },
    FOOT_R,
  );
  for (const [spin, reach] of [
    [0.04, 0.122],
    [0.5, 0.108],
    [-0.42, 0.108],
  ]) {
    pair(
      {
        part: FOOT_L,
        mat: SHANK,
        at: REST[FOOT_L],
        size: [0.0085, 0.0075, reach / 2],
        offset: [0, -SOLE + 0.0075, reach / 2],
        rot: [0, spin, 0],
        detail: 1,
        shape: (u) => {
          const tip = Math.max(0, u.z);
          u.x *= 1 - 0.4 * tip;
          u.y *= 1 - 0.35 * tip;
        },
      },
      FOOT_R,
    );
  }

  return merge(parts);
}

const RIGHT: Record<number, number> = { [WING_L]: WING_R, [FORE_L]: FORE_R, [HAND_L]: HAND_R };

/** The other wing: the same mesh reflected across the body, rebound to the right-hand bones, facing outward again. */
function mirrorSkin(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = src.clone();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const bones = geo.attributes.aSkin as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
    bones.setXY(i, RIGHT[bones.getX(i)] ?? bones.getX(i), RIGHT[bones.getY(i)] ?? bones.getY(i));
  }
  const index = geo.index!.array;
  for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  geo.computeVertexNormals();
  return geo;
}

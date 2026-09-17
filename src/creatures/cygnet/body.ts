import type * as THREE from 'three';
import { blob, loft, merge, mirrored, skinned, type BlobSpec, type LoftSpec, type Station, type V3 } from '../shapes';
import { FAN, feather, still, webFoot } from './parts';

/**
 * A swan cygnet the way a child would draw one: a pear of soft grey down low to the ground, a short thick neck long
 * enough to make an S, a round head with big dark eyes and a flat dark bill, short legs set well back on outsized
 * webbed feet, and small useless wings. Body, neck and head are one skin, so nothing about it has a seam.
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

/** An armful: about as big as the child's head, and heavy enough that carrying it is a decision. */
export const SIZE = 1.42;
export const THIGH = 0.085;
export const SHIN = 0.092;
/** How far the sole is below the ankle. */
export const SOLE = 0.014;
/** The hip is buried high in the flank, so the leg only shows below the down. */
const HIP = 0.022;
const STAND = HIP + THIGH + SHIN + SOLE;
const NECK_LINK = 0.05;

/** Each joint's rest position on its parent. */
export const SKELETON: [bone: number, parent: number, at: V3][] = [
  [BODY, ROOT, [0, STAND, 0]],
  [NECK_1, BODY, [0, 0.086, 0.148]],
  [NECK_2, NECK_1, [0, NECK_LINK, 0]],
  [NECK_3, NECK_2, [0, NECK_LINK, 0]],
  [NECK_4, NECK_3, [0, NECK_LINK, 0]],
  [HEAD, NECK_4, [0, NECK_LINK, 0]],
  [JAW, HEAD, [0, 0.042, 0.026]],
  [TAIL, BODY, [0, 0.046, -0.15]],
  [WING_L, BODY, [0.112, 0.052, 0.03]],
  [FORE_L, WING_L, [0.075, 0, 0]],
  [HAND_L, FORE_L, [0.075, 0, 0]],
  [WING_R, BODY, [-0.112, 0.052, 0.03]],
  [FORE_R, WING_R, [-0.075, 0, 0]],
  [HAND_R, FORE_R, [-0.075, 0, 0]],
  [THIGH_L, BODY, [0.056, -HIP, -0.038]],
  [SHIN_L, THIGH_L, [0, -THIGH, 0]],
  [FOOT_L, SHIN_L, [0, -SHIN, 0]],
  [THIGH_R, BODY, [-0.056, -HIP, -0.038]],
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
export const EYE_AT: V3 = [0.09, REST[HEAD][1] + 0.061, REST[HEAD][2] + 0.062];
export const EYE_R = 0.031;
/** Where the bill leaves the face; between here and the eye the down gives way to bare dark skin. */
export const LORE_AT: V3 = [0.02, REST[HEAD][1] + 0.05, REST[HEAD][2] + 0.062];

/** Where the child's mittens go, in the body's own frame: under the belly either side, and the middle of the back. */
export const HOLDS = { bellyL: [0.112, -0.092, 0.01] as V3, bellyR: [-0.112, -0.092, 0.01] as V3, back: [0, 0.114, -0.02] as V3 };

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const ramp = (x: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The one skin: the tail stub, a deep pear of a body, the neck as a ring at every joint and one between so it bends
 * as a curve, then the head. `up` and `down` differ so the belly can hang lower than the back rises.
 */
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
    /** The tail is a stub fan, not a point: flat, a little wider than it is thick, and carried clear of the rump. */
    body(-0.236, 0.108, 0.034, 0.005, 0.005, [TAIL, TAIL, 0]),
    body(-0.228, 0.104, 0.042, 0.009, 0.009, [TAIL, TAIL, 0]),
    body(-0.206, 0.084, 0.06, 0.032, 0.03, [TAIL, TAIL, 0]),
    body(-0.168, 0.038, 0.096, 0.076, 0.08, [BODY, TAIL, 0.5]),
    body(-0.124, 0.013, 0.124, 0.1, 0.114),
    body(-0.064, 0.0, 0.141, 0.114, 0.134),
    body(0, -0.002, 0.146, 0.118, 0.142),
    body(0.058, 0.004, 0.142, 0.118, 0.138),
    body(0.106, 0.024, 0.13, 0.112, 0.126),
    body(0.128, 0.046, 0.108, 0.094, 0.112),
    /** Never further forward than the neck itself: a spine that goes forward and back folds the skin over here. */
    body(0.142, 0.072, 0.086, 0.076, 0.096, [BODY, NECK_1, 0.3]),
  ];
  const radius = [0.068, 0.062, 0.058, 0.055, 0.053, 0.052, 0.052, 0.054, 0.058];
  for (let i = 0; i < 4; i++) {
    const joint = REST[NECK[i]];
    const below = i === 0 ? BODY : NECK[i - 1];
    const r = radius[i * 2];
    const rm = radius[i * 2 + 1];
    st.push({ at: joint, rx: r, up: r * 0.95, down: r * (i === 0 ? 1.3 : 1.02), skin: [below, NECK[i], 0.5] });
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
    head(-0.006, -0.004, 0.06, 0.058, 0.062, [NECK_4, HEAD, 0.5]),
    head(0.02, 0.005, 0.084, 0.078, 0.086),
    head(0.048, 0.015, 0.1, 0.092, 0.102),
    head(0.078, 0.02, 0.106, 0.098, 0.104),
    head(0.109, 0.019, 0.101, 0.094, 0.095),
    head(0.134, 0.014, 0.084, 0.08, 0.078),
    head(0.152, 0.008, 0.062, 0.06, 0.058),
    head(0.164, 0.003, 0.034, 0.033, 0.032),
    head(0.172, 0.0, 0.005, 0.005, 0.005),
  );
  return st;
}

/** Upper and lower bill: broad, flat and dished, with the lower one nested inside the upper so the mouth has no gap. */
function bill(bone: number, y: number, up: number, down: number, half: number, reach: number): Station[] {
  const from = add(REST[HEAD], [0, y, 0.062]);
  const ring = (z: number, drop: number, rx: number, k: number): Station => ({
    at: add(from, [0, -drop, z]),
    rx: rx * half,
    up: up * k,
    down: down * k,
    skin: [bone, bone, 0],
  });
  return [
    ring(0, 0, 0.12, 0.25),
    ring(0.012, 0, 0.95, 1),
    ring(reach * 0.3, 0.004, 1, 0.9),
    ring(reach * 0.55, 0.01, 1.02, 0.76),
    ring(reach * 0.74, 0.017, 0.99, 0.6),
    ring(reach * 0.88, 0.024, 0.86, 0.45),
    ring(reach * 0.96, 0.03, 0.56, 0.28),
    ring(reach, 0.034, 0.08, 0.1),
  ];
}

export function cygnetGeometry(): THREE.BufferGeometry {
  return merge(parts(false));
}

/** The same coat, coarser, for the down shells to be pushed out of: no bill, no eyes, no legs, no flight feathers. */
export function cygnetDownGeometry(): THREE.BufferGeometry {
  return merge(parts(true));
}

function parts(down: boolean): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const coat = (spec: LoftSpec) => out.push(still(loft(down ? { ...spec, around: Math.round((spec.around ?? 16) * 0.66) } : spec)));
  const rigid = (spec: BlobSpec) => out.push(still(skinned(blob(down ? { ...spec, detail: Math.max(1, (spec.detail ?? 2) - 1) } : spec))));
  const pair = (spec: BlobSpec, right: number) => {
    rigid(spec);
    rigid(mirrored(spec, right));
  };

  coat({
    stations: skin(),
    mat: COAT,
    around: 26,
    smooth: 2,
    /**
     * Darker down along the back, the rump, the nape and the crown; palest on the belly, breast, throat and cheeks.
     * Every term is smooth: a kink anywhere in here draws a hard line across the bird that reads as a crack.
     */
    blend: (t, a) => {
      const top = Math.sin(a) * 0.5 + 0.5;
      const rump = 1 - ramp(t, 0.02, 0.44);
      const head = ramp(t, 0.6, 1);
      return 0.99 - top * 0.84 - rump * top * 0.4 - head * top * 0.34 + head * (1 - top) * 0.2;
    },
  });
  addWing(out, down);
  pair(
    {
      part: THIGH_L,
      mat: COAT,
      at: REST[THIGH_L],
      size: [0.044, THIGH * 0.8, 0.052],
      offset: [0, -THIGH * 0.34, 0.004],
      detail: 1,
      blend: (u) => 0.5 - u.y * 0.14,
    },
    THIGH_R,
  );
  if (down) return out;

  out.push(still(loft({ stations: bill(HEAD, 0.05, 0.026, 0.01, 0.041, 0.116), mat: BILL, around: 14, smooth: 1, blend: (t) => Math.max(0, (t - 0.8) / 0.2) })));
  out.push(
    still(loft({ stations: bill(JAW, 0.036, 0.009, 0.012, 0.036, 0.107), mat: BILL, around: 14, smooth: 1, blend: (t) => Math.max(0, (t - 0.8) / 0.2) * 0.4 })),
  );
  pair({ part: HEAD, mat: EYE, at: EYE_AT, size: [EYE_R * 0.78, EYE_R, EYE_R * 0.96], detail: 2 }, HEAD);

  pair({ part: SHIN_L, mat: SHANK, at: REST[SHIN_L], size: [0.018, SHIN / 2 + 0.012, 0.021], offset: [0, -SHIN / 2 + 0.004, 0], detail: 1 }, SHIN_R);
  pair({ part: FOOT_L, mat: SHANK, at: REST[FOOT_L], size: [0.021, 0.019, 0.024], offset: [0, -0.003, 0.004], detail: 1 }, FOOT_R);
  const foot = {
    part: FOOT_L,
    mat: SHANK,
    at: add(REST[FOOT_L], [0.002, -SOLE + 0.005, 0.006]),
    toes: [
      [-0.66, 0.108],
      [0.02, 0.132],
      [0.68, 0.11],
    ] as [number, number][],
    thick: 0.012,
    scallop: 0.22,
  };
  out.push(still(skinned(webFoot(foot))));
  out.push(still(skinned(webFoot({ ...foot, part: FOOT_R, at: [-foot.at[0], foot.at[1], foot.at[2]], toes: foot.toes.map(([a, l]) => [-a, l]) }))));
  return out;
}

/**
 * The wing: a soft downy paddle of an arm with two rows of rounded coverts over it, a short fan of grey flight
 * feathers with paler tips, and no more reach than a bird this size has. Each vane carries the pivot and the angle
 * it swings through as the wing shuts, so the fan closes the way a real one does instead of folding as a slab.
 */
function addWing(out: THREE.BufferGeometry[], down: boolean): void {
  const s = REST[WING_L];
  const at = (x: number, y: number, z: number): V3 => [x, s[1] + y, s[2] + z];
  const wing: THREE.BufferGeometry[] = [];
  const arm: Station[] = [
    /** Buried in the flank and bound to the body alone, so no swing of the wing can push its blunt end through. */
    { at: at(0.018, 0.004, 0.022), rx: 0.03, up: 0.024, down: 0.024, skin: [BODY, BODY, 0] },
    { at: at(0.062, 0.004, 0.02), rx: 0.05, up: 0.038, down: 0.04, skin: [BODY, WING_L, 0.6] },
    { at: at(0.104, 0.004, 0.014), rx: 0.06, up: 0.038, down: 0.038, skin: [WING_L, WING_L, 0] },
    { at: at(0.135, 0.002, 0.008), rx: 0.058, up: 0.033, down: 0.032, skin: [WING_L, WING_L, 0] },
    { at: at(0.18, -0.002, -0.002), rx: 0.052, up: 0.028, down: 0.027, skin: [WING_L, FORE_L, 0.55] },
    { at: at(0.22, -0.006, -0.012), rx: 0.044, up: 0.023, down: 0.022, skin: [FORE_L, FORE_L, 0] },
    { at: at(0.258, -0.01, -0.022), rx: 0.033, up: 0.017, down: 0.016, skin: [FORE_L, HAND_L, 0.6] },
    { at: at(0.288, -0.014, -0.03), rx: 0.019, up: 0.01, down: 0.01, skin: [HAND_L, HAND_L, 0] },
    { at: at(0.302, -0.016, -0.035), rx: 0.004, up: 0.004, down: 0.004, skin: [HAND_L, HAND_L, 0] },
  ];
  const coat = (spec: LoftSpec) => (down ? loft({ ...spec, around: 9 }) : loft(spec));
  wing.push(coat({ stations: arm, mat: COAT, around: 12, smooth: 1, side: [0, 0, -1], blend: (_t, a) => 0.6 - Math.sin(a) * 0.22 }));

  /** Shut, every vane lines up along its own bone, so the fan closes and the tips run on past the wrist to the tail. */
  const SHUT = 0.14;
  const vane = (spec: Parameters<typeof feather>[0]) =>
    wing.push(skinned(feather({ ...spec, close: SHUT - spec.spin, rows: down ? 4 : 6, around: 6 })));
  if (!down) {
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      vane({
        part: HAND_L,
        mat: QUILL,
        root: at(0.254 + k * 0.046, -0.012 - k * 0.003, -0.016 - k * 0.006),
        length: 0.118 + k * 0.04,
        width: 0.03 - k * 0.004,
        spin: 1.06 - k * 0.6,
        lift: -0.03 - k * 0.04,
        pale: 0.85 + k * 0.15,
      });
    }
    for (let i = 0; i < 4; i++) {
      const k = i / 3;
      vane({
        part: FORE_L,
        mat: QUILL,
        root: at(0.19 + k * 0.058, -0.008 - k * 0.003, -0.01 - k * 0.004),
        length: 0.088 + k * 0.026,
        width: 0.032 - k * 0.002,
        spin: 1.4 - k * 0.2,
        lift: -0.02,
        pale: 0.5 + k * 0.3,
      });
    }
  }
  /** Coverts: short, round and downy, and rooted out past the flank so none of them ever cuts through the body. */
  for (let i = 0; i < 4; i++) {
    const k = i / 3;
    vane({
      part: k < 0.4 ? WING_L : FORE_L,
      mat: COAT,
      root: at(0.166 + k * 0.078, 0.008 - k * 0.005, -0.006 - k * 0.008),
      length: 0.066 + k * 0.022,
      width: 0.03 - k * 0.004,
      spin: 1.46 - k * 0.16,
      lift: 0.04,
      thick: 0.009,
      pale: 0.42,
    });
  }
  for (let i = 0; i < 3; i++) {
    const k = i / 2;
    vane({
      part: k < 0.6 ? WING_L : FORE_L,
      mat: COAT,
      root: at(0.16 + k * 0.07, 0.022 - k * 0.008, 0.008 - k * 0.008),
      length: 0.054 + k * 0.016,
      width: 0.032 - k * 0.004,
      spin: 1.4 - k * 0.12,
      lift: 0.14,
      thick: 0.011,
      pale: 0.3,
    });
  }
  for (const g of wing) {
    out.push(still(g));
    out.push(mirrorSkin(still(g)));
  }
}

const RIGHT: Record<number, number> = { [WING_L]: WING_R, [FORE_L]: FORE_R, [HAND_L]: HAND_R };

/** The other wing: the same mesh reflected across the body, rebound to the right-hand bones, facing outward again. */
function mirrorSkin(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = src.clone();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const bones = geo.attributes.aSkin as THREE.BufferAttribute;
  const fan = geo.getAttribute(FAN) as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
    bones.setXY(i, RIGHT[bones.getX(i)] ?? bones.getX(i), RIGHT[bones.getY(i)] ?? bones.getY(i));
    fan.setX(i, -fan.getX(i));
    fan.setW(i, -fan.getW(i));
  }
  const index = geo.index!.array;
  for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  geo.computeVertexNormals();
  return geo;
}

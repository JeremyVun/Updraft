import type * as THREE from 'three';
import { blob, merge, mirrored, type BlobSpec, type V3 } from '../shapes';

/**
 * A crane colt a few weeks old, the way a child would draw one: a round downy body, a big round head on a soft
 * neck, enormous dark eyes, a short pink bill, stubby wings with the first quills just coming in, and legs far too
 * long for it. Everything about the adult (the dagger bill, the long rigid neck, the wide wings) is what it does
 * not have yet, and that is what makes it look like it needs carrying.
 */
export const BONES = 18;
export const [ROOT, BODY, NECK_A, NECK_B, HEAD, JAW, TUFT, TAIL, WING_L, HAND_L, WING_R, HAND_R, THIGH_L, SHIN_L, FOOT_L, THIGH_R, SHIN_R, FOOT_R] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
];

export const COAT = 0;
export const QUILL = 1;
export const BILL = 2;
export const SHANK = 3;
export const EYE = 4;

/** Built at life size and scaled up a little so it reads from the camera the game is played at, and no more. */
export const SIZE = 1.4;
export const THIGH = 0.09;
export const SHIN = 0.1;
/** Eye centre in head space; the shader closes the lids around it. */
export const EYE_AT: V3 = [0.034, 0.009, 0.029];

/** Each joint's rest position on its parent. */
export const SKELETON: [bone: number, parent: number, at: V3][] = [
  [BODY, ROOT, [0, 0.225, 0]],
  [NECK_A, BODY, [0, 0.052, 0.068]],
  [NECK_B, NECK_A, [0, 0.072, 0]],
  [HEAD, NECK_B, [0, 0.064, 0.004]],
  [JAW, HEAD, [0, -0.014, 0.036]],
  [TUFT, HEAD, [0, 0.044, -0.004]],
  [TAIL, BODY, [0, 0.024, -0.096]],
  [WING_L, BODY, [0.062, 0.028, 0.012]],
  [HAND_L, WING_L, [0.094, 0, -0.012]],
  [WING_R, BODY, [-0.062, 0.028, 0.012]],
  [HAND_R, WING_R, [-0.094, 0, -0.012]],
  [THIGH_L, BODY, [0.036, -0.036, -0.01]],
  [SHIN_L, THIGH_L, [0, -THIGH, 0]],
  [FOOT_L, SHIN_L, [0, -SHIN, 0]],
  [THIGH_R, BODY, [-0.036, -0.036, -0.01]],
  [SHIN_R, THIGH_R, [0, -THIGH, 0]],
  [FOOT_R, SHIN_R, [0, -SHIN, 0]],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A straight-sided tube with rounded ends, thicker at the bottom, so the neck reads as down over a neck. */
function neckSegment(part: number, r0: number, r1: number, half: number): BlobSpec {
  return {
    part,
    mat: COAT,
    at: [0, 0, 0],
    size: [1, half, 1],
    offset: [0, half * 0.92, 0],
    shape: (u) => {
      const s = Math.min(1 / Math.max(Math.sqrt(Math.max(1 - u.y * u.y, 0)), 0.45), 2.2);
      const r = lerp(r0, r1, (u.y + 1) * 0.5);
      u.x *= s * r;
      u.z *= s * r;
    },
    blend: (u) => 0.42 + u.z * 0.38,
  };
}

export function coltGeometry(): THREE.BufferGeometry {
  const at: V3 = [0, 0, 0];
  const specs: BlobSpec[] = [];
  const pair = (spec: BlobSpec, right: number) => specs.push(spec, mirrored(spec, right));

  specs.push({
    part: BODY,
    mat: COAT,
    at,
    size: [0.084, 0.08, 0.11],
    detail: 3,
    shape: (u) => {
      const back = Math.max(0, -u.z);
      u.x *= 1 - 0.22 * back * back;
      u.y *= 1 - 0.12 * back * back;
      u.y += back * back * 0.2;
      if (u.y < 0) u.y *= 1.08;
    },
    blend: (u) => 0.55 - u.y * 0.5 + Math.max(0, u.z) * 0.12,
  });
  specs.push({ part: BODY, mat: COAT, at, size: [0.064, 0.062, 0.062], offset: [0, -0.008, 0.05], blend: (u) => 0.74 - u.y * 0.3 });
  specs.push({ part: BODY, mat: COAT, at, size: [0.05, 0.045, 0.05], offset: [0, 0.04, 0.055], blend: (u) => 0.5 - u.y * 0.25 });
  pair({ part: BODY, mat: COAT, at, size: [0.03, 0.036, 0.042], offset: [0.046, -0.03, -0.012], blend: (u) => 0.62 - u.y * 0.15 }, BODY);
  specs.push({
    part: TAIL,
    mat: COAT,
    at,
    size: [0.04, 0.03, 0.05],
    offset: [0, 0.006, -0.028],
    rot: [0.45, 0, 0],
    shape: (u) => {
      const tip = Math.max(0, -u.z);
      u.x *= 1 - 0.35 * tip;
      u.y *= 1 - 0.3 * tip;
    },
    blend: (u) => 0.3 - u.y * 0.15,
  });

  specs.push(neckSegment(NECK_A, 0.031, 0.027, 0.042), neckSegment(NECK_B, 0.027, 0.024, 0.038));

  specs.push({
    part: HEAD,
    mat: COAT,
    at,
    size: [0.048, 0.047, 0.05],
    offset: [0, 0.01, 0.006],
    detail: 3,
    shape: (u) => {
      u.y -= Math.max(0, u.z) * 0.06;
    },
    /** Rust on the crown, cream on the cheeks and under the chin, like the adults' faces turned soft. */
    blend: (u) => 0.25 - u.y * 0.36 + Math.max(0, u.z) * 0.3 * (1 - Math.abs(u.y)),
  });
  specs.push({
    part: HEAD,
    mat: BILL,
    at,
    size: [0.013, 0.011, 0.036],
    offset: [0, -0.005, 0.06],
    shape: (u) => {
      const tip = Math.max(0, u.z);
      u.x *= 1 - 0.55 * tip;
      u.y *= 1 - 0.5 * tip;
      u.y -= tip * tip * 0.1;
    },
    blend: (u) => Math.max(0, u.z) ** 2,
  });
  specs.push({
    part: JAW,
    mat: BILL,
    at,
    size: [0.011, 0.007, 0.03],
    offset: [0, -0.003, 0.02],
    shape: (u) => {
      const tip = Math.max(0, u.z);
      u.x *= 1 - 0.5 * tip;
      u.y *= 1 - 0.4 * tip;
    },
    blend: (u) => Math.max(0, u.z) ** 2 * 0.8,
  });
  pair({ part: HEAD, mat: EYE, at, size: [0.0125, 0.013, 0.0105], offset: EYE_AT, detail: 2 }, HEAD);
  /** A cowlick of down on the crown: the one thing about it that is not round, and it bounces. */
  specs.push({ part: TUFT, mat: COAT, at, size: [0.0055, 0.019, 0.007], offset: [0, 0.011, 0], rot: [-0.65, 0, 0], detail: 1, blend: () => 0.1 });
  pair({ part: TUFT, mat: COAT, at, size: [0.005, 0.015, 0.0065], offset: [0.0075, 0.008, -0.003], rot: [-0.45, 0, 0.55], detail: 1, blend: () => 0.12 }, TUFT);

  /** Stubby wings: a downy paddle from the shoulder, and a hand that carries the first scalloped quills. */
  pair({ part: WING_L, mat: COAT, at, size: [0.03, 0.021, 0.032], offset: [0.014, 0.002, -0.004], blend: (u) => 0.3 - u.y * 0.2 }, WING_R);
  pair(
    {
      part: WING_L,
      mat: QUILL,
      at,
      size: [0.056, 0.011, 0.045],
      offset: [0.046, 0, -0.01],
      shape: (u) => {
        const s = Math.max(0, u.x);
        u.y *= 1 - 0.35 * s;
        u.z *= 1 - 0.2 * s;
        u.z -= 0.25 * s;
      },
      blend: (u) => 0.45 - Math.max(0, u.x) * 0.2,
    },
    WING_R,
  );
  for (const [spin, reach] of [
    [-0.5, 0.046],
    [-0.15, 0.048],
    [0.22, 0.042],
  ]) {
    pair(
      {
        part: HAND_L,
        mat: QUILL,
        at,
        size: [reach, 0.006, 0.019],
        offset: [reach * 0.8, 0, -0.004],
        rot: [0, spin, 0],
        shape: (u) => {
          const s = Math.max(0, u.x);
          u.y *= 1 - 0.5 * s * s;
          u.z *= 1 - 0.3 * s;
        },
        blend: (u) => 0.25 - Math.max(0, u.x) * 0.25,
      },
      HAND_R,
    );
  }

  pair(
    {
      part: THIGH_L,
      mat: SHANK,
      at,
      size: [0.0115, THIGH / 2, 0.0115],
      offset: [0, -THIGH / 2, 0],
      detail: 1,
      shape: (u) => {
        const s = 0.75 + 0.5 * ((u.y + 1) * 0.5);
        u.x *= s;
        u.z *= s;
      },
    },
    THIGH_R,
  );
  pair({ part: SHIN_L, mat: SHANK, at, size: [0.0125, 0.0125, 0.0125], offset: [0, 0.002, 0], detail: 1 }, SHIN_R);
  pair(
    {
      part: SHIN_L,
      mat: SHANK,
      at,
      size: [0.0095, SHIN / 2, 0.0095],
      offset: [0, -SHIN / 2, 0],
      detail: 1,
      shape: (u) => {
        const s = 1 + 0.12 * u.y;
        u.x *= s;
        u.z *= s;
      },
    },
    SHIN_R,
  );
  const toe = (spin: number, reach: number, thick: number): BlobSpec => ({
    part: FOOT_L,
    mat: SHANK,
    at,
    size: [thick, 0.0055, reach],
    offset: [0, -0.004, reach * 0.82],
    rot: [0, spin, 0],
    detail: 1,
    shape: (u) => {
      const tip = Math.max(0, u.z);
      u.x *= 1 - 0.55 * tip;
      u.y *= 1 - 0.4 * tip;
    },
  });
  for (const t of [toe(0, 0.036, 0.0075), toe(0.62, 0.031, 0.0068), toe(-0.58, 0.03, 0.0068)]) pair(t, FOOT_R);
  pair({ part: FOOT_L, mat: SHANK, at, size: [0.005, 0.0045, 0.013], offset: [0, -0.003, -0.011], detail: 1 }, FOOT_R);

  return merge(specs.map((spec) => blob(spec)));
}

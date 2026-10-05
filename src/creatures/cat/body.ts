import type * as THREE from 'three';
import { blob, loft, merge, mirrored, skinned, type BlobSpec, type Station, type V3 } from '../shapes';

/**
 * A small tabby built the way the model sheet draws it: a big round head half as wide as the sitting cat is tall,
 * set straight onto the shoulders, big gentle eyes a little below the middle of it, a short white muzzle, round
 * cheeks and wide ears; a deep soft body on short thick legs, round haunches and a thick tail. Authored in metres in
 * one rest space (standing, facing +z, legs straight down), bound to bones, and posed by `pose.ts`.
 */
export const BONES = 28;
export const [
  ROOT, BODY, PELVIS, CHEST, NECK, HEAD, JAW, EAR_L, EAR_R,
  TAIL_1, TAIL_2, TAIL_3, TAIL_4, TAIL_5,
  ARM_L, FORE_L, FPAW_L, THIGH_L, SHIN_L, META_L, HPAW_L,
  ARM_R, FORE_R, FPAW_R, THIGH_R, SHIN_R, META_R, HPAW_R,
] = Array.from({ length: BONES }, (_, i) => i);
export const TAIL = [TAIL_1, TAIL_2, TAIL_3, TAIL_4, TAIL_5];

export const FUR = 0;
export const EAR = 1;
export const EYE = 2;
export const NOSE = 3;
export const MOUTH = 4;
export const WHISKER = 5;

export const ARM = 0.047;
export const FORE = 0.046;
export const THIGH = 0.05;
export const SHIN = 0.048;
export const META = 0.035;
/** How far the wrist and the toe joint sit above the ground when the paw is flat. */
export const WRIST = 0.014;
export const TOE = 0.012;
export const TAIL_LINK = 0.05;
/** The head is authored at one size and built this much bigger about its joint: the one knob for how big it reads. */
export const HEAD_K = 1.08;
const JAW_AT: V3 = [0, -0.012, 0.04];
const EAR_AT: V3 = [0.045, 0.062, 0.014];
const big = (v: V3): V3 => [v[0] * HEAD_K, v[1] * HEAD_K, v[2] * HEAD_K];

/** Each joint's rest position on its parent. */
export const SKELETON: [bone: number, parent: number, at: V3][] = [
  [BODY, ROOT, [0, 0.13, -0.01]],
  [PELVIS, BODY, [0, 0, -0.06]],
  [CHEST, BODY, [0, 0, 0.06]],
  [NECK, CHEST, [0, 0.03, 0.03]],
  [HEAD, NECK, [0, 0.026, 0.024]],
  [JAW, HEAD, big(JAW_AT)],
  [EAR_L, HEAD, big(EAR_AT)],
  [EAR_R, HEAD, big([-EAR_AT[0], EAR_AT[1], EAR_AT[2]])],
  [TAIL_1, PELVIS, [0, 0.022, -0.05]],
  [TAIL_2, TAIL_1, [0, 0, -TAIL_LINK]],
  [TAIL_3, TAIL_2, [0, 0, -TAIL_LINK]],
  [TAIL_4, TAIL_3, [0, 0, -TAIL_LINK]],
  [TAIL_5, TAIL_4, [0, 0, -TAIL_LINK]],
  [ARM_L, CHEST, [0.03, -0.026, 0.008]],
  [FORE_L, ARM_L, [0, -ARM, 0]],
  [FPAW_L, FORE_L, [0, -FORE, 0]],
  [THIGH_L, PELVIS, [0.036, -0.01, 0.0]],
  [SHIN_L, THIGH_L, [0, -THIGH, 0]],
  [META_L, SHIN_L, [0, -SHIN, 0]],
  [HPAW_L, META_L, [0, -META, 0]],
  [ARM_R, CHEST, [-0.03, -0.026, 0.008]],
  [FORE_R, ARM_R, [0, -ARM, 0]],
  [FPAW_R, FORE_R, [0, -FORE, 0]],
  [THIGH_R, PELVIS, [-0.036, -0.01, 0.0]],
  [SHIN_R, THIGH_R, [0, -THIGH, 0]],
  [META_R, SHIN_R, [0, -SHIN, 0]],
  [HPAW_R, META_R, [0, -META, 0]],
];

export const REST: V3[] = (() => {
  const out: V3[] = [[0, 0, 0]];
  for (const [bone, parent, [x, y, z]] of SKELETON) out[bone] = [out[parent][0] + x, out[parent][1] + y, out[parent][2] + z];
  return out;
})();

/** The legs, front left, front right, hind left, hind right: the bones of each from the body down. */
export const LEGS = [
  { upper: ARM_L, lower: FORE_L, paw: FPAW_L, side: 1, front: true },
  { upper: ARM_R, lower: FORE_R, paw: FPAW_R, side: -1, front: true },
  { upper: THIGH_L, lower: SHIN_L, meta: META_L, paw: HPAW_L, side: 1, front: false },
  { upper: THIGH_R, lower: SHIN_R, meta: META_R, paw: HPAW_R, side: -1, front: false },
] as const;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const ramp = (x: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const H = REST[HEAD];
/** A point authored on the head, where it is once the head is built at its size. */
const onHead = (p: V3): V3 => [H[0] + (p[0] - H[0]) * HEAD_K, H[1] + (p[1] - H[1]) * HEAD_K, H[2] + (p[2] - H[2]) * HEAD_K];
/** The skull as authored: its centre and its radii. */
const S: V3 = [0, H[1] + 0.024, H[2] + 0.024];
const SIZE: V3 = [0.064, 0.056, 0.054];

/**
 * The whole head as one round shape, from the unit sphere: full cheeks that make the lower face wider than the
 * brow, a face flat enough in front for the eyes to sit in, and a soft chin. One surface, so nothing on the face is
 * a ball stuck on.
 */
function skullShape(u: { x: number; y: number; z: number }): void {
  const cheek = ramp(-u.y, -0.15, 0.4) * (1 - ramp(-u.y, 0.75, 1)) * ramp(u.z, -0.6, 0.2);
  u.x *= (1 + 0.2 * cheek) * (1 - 0.12 * ramp(u.y, 0.15, 0.9));
  if (u.y > 0.45) u.y = 0.45 + (u.y - 0.45) * 0.8;
  /** The face leans forward at the bottom: the brow rounds back over the eyes and the muzzle leads. */
  const front = ramp(u.z, 0.2, 0.75);
  u.z += front * (0.05 * ramp(-u.y, -0.1, 0.5) - 0.1 * ramp(u.y, -0.05, 0.75));
  if (u.z > 0.5) u.z = 0.5 + (u.z - 0.5) * 0.85;
  u.z += 0.04 * ramp(-u.y, 0.45, 0.9) * ramp(u.z, 0.1, 0.6);
  /** A short soft muzzle that leads the face, so the eyes sit back from the nose. */
  u.z += 0.2 * front * Math.exp(-((u.x / 0.36) ** 2) - ((u.y + 0.42) / 0.28) ** 2);
  /** A full chin and jowls under it, down into the bib. */
  u.y -= 0.14 * ramp(-u.y, 0.35, 0.85) * ramp(u.z, -0.2, 0.5);
}

/** Shallow sockets the eyes sit in, so a whole round eye shows without standing proud of the face like a lens. */
function sockets(u: { x: number; y: number; z: number }): void {
  const d = Math.hypot(Math.abs(u.x) - 0.5, u.y + 0.17);
  u.z -= 0.075 * (1 - ramp(d, 0.18, 0.42)) * ramp(u.z, 0.3, 0.6);
}

/** The point on the skull's face in front of rest-space (x, y), and its outward normal there. */
function onFace(x: number, y: number, socketed = false): { at: V3; normal: V3 } {
  const point = (ux: number, uy: number): V3 => {
    const u = { x: ux, y: uy, z: Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy)) };
    skullShape(u);
    if (socketed) sockets(u);
    return [S[0] + u.x * SIZE[0], S[1] + u.y * SIZE[1], S[2] + u.z * SIZE[2]];
  };
  let ux = x / SIZE[0];
  let uy = (y - S[1]) / SIZE[1];
  for (let i = 0; i < 40; i++) {
    const p = point(ux, uy);
    ux += ((x - p[0]) / SIZE[0]) * 0.8;
    uy += ((y - p[1]) / SIZE[1]) * 0.8;
  }
  const at = point(ux, uy);
  const e = 1e-3;
  const dx = point(ux + e, uy);
  const dy = point(ux, uy + e);
  const a: V3 = [dx[0] - at[0], dx[1] - at[1], dx[2] - at[2]];
  const b: V3 = [dy[0] - at[0], dy[1] - at[1], dy[2] - at[2]];
  const n: V3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = Math.hypot(...n);
  return { at, normal: [n[0] / len, n[1] / len, n[2] / len] };
}

/** The eye as it shows: its radius, and its centre's height below the middle of the skull and distance off the middle line. */
const EYE_R = 0.0168;
const EYE_FACE = onFace(0.032, S[1] - 0.009);
/** The eye is a shallow dome a little proud of the face, wider than what shows: its rim is the soft lid round it. */
const EYE_DOME: V3 = [EYE_R / 0.86, EYE_R / 0.86, 0.007];
const EYE_C: V3 = add(EYE_FACE.at, EYE_FACE.normal.map((n) => n * (0.0028 - EYE_DOME[2])) as V3);
const NOSE_C: V3 = add(onFace(0, EYE_C[1] - 0.0125).at, [0, 0, -0.0012]);
const MUZZLE_C: V3 = add(onFace(0, EYE_C[1] - 0.0215).at, [0, 0, -0.004]);

/** Where the face is once the head is built at its size, for the shader to measure it. */
export const SKULL = onHead(S);
export const SKULL_SIZE = big(SIZE);
export const EYE_RADIUS = EYE_R * HEAD_K;
export const EYE_AT = onHead(EYE_C);
export const EYE_SIZE = big(EYE_DOME);
export const EYE_TURN = Math.atan2(EYE_FACE.normal[0], EYE_FACE.normal[2]);
export const EYE_TILT = -Math.asin(EYE_FACE.normal[1]);
export const NOSE_AT = onHead(NOSE_C);
/** The middle of the whisker pads, where the whiskers grow from. */
export const MUZZLE = onHead(MUZZLE_C);

/** Rump to chest, then up into a neck as wide as the head's underside, so that no neck ever shows. */
function trunk(): Station[] {
  const b = REST[BODY];
  const s = (z: number, y: number, rx: number, up: number, down: number, skin: [number, number, number]): Station => ({
    at: add(b, [0, y, z]),
    rx,
    up,
    down,
    skin,
  });
  return [
    s(-0.118, 0.01, 0.012, 0.012, 0.012, [PELVIS, PELVIS, 0]),
    s(-0.11, 0.008, 0.038, 0.036, 0.038, [PELVIS, PELVIS, 0]),
    s(-0.092, 0.005, 0.056, 0.048, 0.054, [PELVIS, PELVIS, 0]),
    s(-0.06, 0.002, 0.061, 0.05, 0.058, [PELVIS, PELVIS, 0]),
    s(-0.025, 0.0, 0.058, 0.048, 0.06, [PELVIS, BODY, 0.6]),
    s(0.01, 0.0, 0.058, 0.048, 0.063, [BODY, BODY, 0]),
    s(0.04, 0.003, 0.06, 0.048, 0.067, [BODY, CHEST, 0.6]),
    s(0.065, 0.006, 0.062, 0.048, 0.07, [CHEST, CHEST, 0]),
    s(0.088, 0.013, 0.06, 0.046, 0.065, [CHEST, CHEST, 0]),
    s(0.105, 0.027, 0.056, 0.05, 0.056, [CHEST, NECK, 0.5]),
    s(0.114, 0.044, 0.053, 0.05, 0.05, [NECK, NECK, 0]),
    s(0.119, 0.061, 0.048, 0.045, 0.043, [NECK, HEAD, 0.5]),
    s(0.121, 0.076, 0.036, 0.03, 0.032, [HEAD, HEAD, 0]),
    s(0.122, 0.084, 0.008, 0.008, 0.008, [HEAD, HEAD, 0]),
  ];
}

/** A leg as one thick tube from inside the body down to a round mitten of a paw, bent only at its joints. */
function leg(front: boolean): Station[] {
  const l = LEGS[front ? 0 : 2];
  const top = REST[l.upper];
  const x = top[0];
  const z = top[2];
  const s = (y: number, rx: number, up: number, down: number, skin: [number, number, number], dz = 0): Station => ({ at: [x, y, z + dz], rx, up, down, skin });
  if (front) {
    const elbow = REST[l.lower][1];
    const wrist = REST[l.paw][1];
    return [
      s(top[1] + 0.03, 0.016, 0.016, 0.016, [CHEST, CHEST, 0]),
      s(top[1] + 0.01, 0.024, 0.026, 0.024, [CHEST, l.upper, 0.5]),
      s(top[1] - 0.022, 0.023, 0.025, 0.023, [l.upper, l.upper, 0]),
      s(elbow + 0.006, 0.0225, 0.023, 0.022, [l.upper, l.lower, 0.5]),
      s(elbow - 0.022, 0.021, 0.021, 0.0205, [l.lower, l.lower, 0]),
      s(wrist + 0.012, 0.0205, 0.0205, 0.0195, [l.lower, l.paw, 0.5]),
      s(wrist - 0.003, 0.019, 0.018, 0.018, [l.paw, l.paw, 0], 0.004),
      s(wrist - 0.01, 0.008, 0.008, 0.008, [l.paw, l.paw, 0], 0.008),
    ];
  }
  const meta = 'meta' in l ? l.meta : l.lower;
  const knee = REST[l.lower][1];
  const hock = REST[meta][1];
  const toe = REST[l.paw][1];
  /** The thigh is a round haunch where it leaves the body: folded in the sit, it is the bottom of the pear. */
  return [
    s(top[1] + 0.03, 0.022, 0.022, 0.022, [PELVIS, PELVIS, 0]),
    s(top[1] + 0.01, 0.036, 0.042, 0.038, [PELVIS, l.upper, 0.5], -0.002),
    s(top[1] - 0.014, 0.038, 0.045, 0.036, [l.upper, l.upper, 0], 0.002),
    s(top[1] - 0.036, 0.03, 0.034, 0.026, [l.upper, l.upper, 0], 0.002),
    s(knee + 0.004, 0.02, 0.022, 0.02, [l.upper, l.lower, 0.5]),
    s(knee - 0.026, 0.017, 0.018, 0.017, [l.lower, l.lower, 0]),
    s(hock + 0.006, 0.0155, 0.015, 0.017, [l.lower, meta, 0.5]),
    s(hock - 0.019, 0.015, 0.0145, 0.0155, [meta, meta, 0]),
    s(toe + 0.009, 0.0165, 0.0155, 0.015, [meta, l.paw, 0.5]),
    s(toe - 0.003, 0.0165, 0.0155, 0.0145, [l.paw, l.paw, 0], 0.005),
    s(toe - 0.009, 0.006, 0.006, 0.006, [l.paw, l.paw, 0], 0.01),
  ];
}

/** Thick all the way and fuller toward the end, a soft brush of a tail: it reads as a cat from a long way off. */
function tail(): Station[] {
  const base = REST[TAIL_1];
  const st: Station[] = [{ at: add(base, [0, 0.002, 0.03]), rx: 0.022, up: 0.022, down: 0.022, skin: [PELVIS, PELVIS, 0] }];
  const radius = [0.02, 0.0205, 0.0215, 0.023, 0.0235];
  for (let i = 0; i < TAIL.length; i++) {
    const at = REST[TAIL[i]];
    const prev = i === 0 ? PELVIS : TAIL[i - 1];
    st.push({ at, rx: radius[i], up: radius[i], down: radius[i], skin: [prev, TAIL[i], 0.5] });
    st.push({ at: add(at, [0, 0, -TAIL_LINK / 2]), rx: radius[i] + 0.001, up: radius[i] + 0.001, down: radius[i] + 0.001, skin: [TAIL[i], TAIL[i], 0] });
  }
  const end = add(REST[TAIL_5], [0, 0, -TAIL_LINK]);
  st.push({ at: add(end, [0, 0, 0.008]), rx: 0.02, up: 0.02, down: 0.02, skin: [TAIL_5, TAIL_5, 0] });
  st.push({ at: add(end, [0, 0, -0.008]), rx: 0.011, up: 0.011, down: 0.011, skin: [TAIL_5, TAIL_5, 0] });
  return st;
}

/** Sets the blend toward the second colour from where each vertex is in rest space. */
function paint(geo: THREE.BufferGeometry, k: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const mat = geo.attributes.aMat as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) mat.setY(i, Math.max(mat.getY(i), k(pos.getX(i), pos.getY(i), pos.getZ(i))));
  return geo;
}

const mirrorStations = (st: Station[], swap: Record<number, number>): Station[] =>
  st.map((s) => ({ ...s, at: [-s.at[0], s.at[1], s.at[2]] as V3, skin: [swap[s.skin[0]] ?? s.skin[0], swap[s.skin[1]] ?? s.skin[1], s.skin[2]] }));

const LEFT_TO_RIGHT: Record<number, number> = {
  [ARM_L]: ARM_R, [FORE_L]: FORE_R, [FPAW_L]: FPAW_R, [THIGH_L]: THIGH_R, [SHIN_L]: SHIN_R, [META_L]: META_R, [HPAW_L]: HPAW_R, [EAR_L]: EAR_R,
};

/** A soft rounded tuft: a blunt cone along its own +y, as long as `length`, standing on `at`. */
function tuft(part: number, at: V3, rot: V3, length: number, width: number, white = 0): BlobSpec {
  return {
    part,
    mat: FUR,
    at,
    rot,
    size: [width, length / 2, width * 0.8],
    offset: [0, length * 0.4, 0],
    detail: 2,
    shape: (u) => {
      const k = 0.5 * (1 - u.y);
      u.x *= 0.25 + 0.75 * k;
      u.z *= 0.25 + 0.75 * k;
      u.z += 0.5 * (1 - k) * (1 - k);
    },
    blend: () => white,
  };
}

/** Every part, coat and face alike; `coat` keeps only what grows fur, for the shells. */
function parts(coat: boolean): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const rigid = (spec: BlobSpec) => out.push(skinned(blob(spec)));
  const pair = (spec: BlobSpec) => {
    rigid(spec);
    rigid(mirrored(spec, LEFT_TO_RIGHT[spec.part] ?? spec.part));
  };
  const face = (spec: BlobSpec) => !coat && rigid(spec);
  const faces = (spec: BlobSpec) => !coat && pair(spec);

  out.push(
    loft({
      stations: trunk(),
      mat: FUR,
      around: 26,
      smooth: 2,
      /** The white bib runs from the chin down the throat and chest and on, fainter, under the belly. */
      blend: (t, a) => {
        const under = ramp(-Math.sin(a), 0.0, 0.6);
        const bib = ramp(t, 0.5, 0.66);
        return under * (bib + (1 - bib) * 0.65 * ramp(t, 0.15, 0.4));
      },
    }),
  );
  for (const side of [1, -1]) {
    for (const front of [true, false]) {
      const st = leg(front);
      const socks = front ? REST[FPAW_L][1] + 0.028 : REST[HPAW_L][1] + 0.034;
      /** The bib runs on down the fronts of the forelegs into the mittens, as it does on a bicolour tabby. */
      const fronts = front ? (_t: number, a: number) => ramp(Math.sin(a), -0.2, 0.6) : undefined;
      const geo = loft({ stations: side > 0 ? st : mirrorStations(st, LEFT_TO_RIGHT), mat: FUR, around: 16, smooth: 1, blend: fronts });
      out.push(paint(geo, (_x, y) => ramp(y, socks + 0.006, socks - 0.006)));
    }
  }
  out.push(loft({ stations: tail(), mat: FUR, around: 16, smooth: 1 }));

  /** Paws: round mittens, all white. */
  pair({ part: FPAW_L, mat: FUR, at: add(REST[FPAW_L], [0, -WRIST + 0.013, 0.012]), size: [0.0235, 0.0135, 0.026], detail: 3, blend: () => 1 });
  pair({ part: HPAW_L, mat: FUR, at: add(REST[HPAW_L], [0, -TOE + 0.012, 0.011]), size: [0.022, 0.013, 0.027], detail: 3, blend: () => 1 });

  rigid({
    part: HEAD,
    mat: FUR,
    at: SKULL,
    size: SIZE,
    detail: 4,
    shape: (u) => {
      skullShape(u);
      sockets(u);
    },
    blend: (u) => {
      const low = ramp(-u.y, 0.3, 0.5) * ramp(u.z, 0.3, 0.7) * (1 - ramp(Math.abs(u.x), 0.5, 0.75));
      const jowl = ramp(-u.y, 0.5, 0.8) * ramp(u.z, -0.2, 0.3);
      return Math.max(low, jowl);
    },
  });
  /** The muzzle: two soft white whisker pads close under the nose, barely proud of the face, and a small chin. */
  pair({ part: HEAD, mat: FUR, at: add(MUZZLE_C, [0.0078, 0.001, -0.003]), size: [0.0095, 0.0078, 0.0065], detail: 3, blend: () => 1 });
  rigid({ part: JAW, mat: FUR, at: add(MUZZLE_C, [0, -0.0105, -0.008]), size: [0.0085, 0.006, 0.0065], detail: 3, blend: () => 1 });
  /** The inside of the mouth stays with the head, so the chin opens away from it in a small round mew. */
  face({ part: HEAD, mat: MOUTH, at: add(MUZZLE_C, [0, -0.0085, -0.0115]), size: [0.0062, 0.0058, 0.006], detail: 2 });
  face({
    part: HEAD,
    mat: NOSE,
    at: NOSE_C,
    size: [0.0072, 0.0048, 0.0045],
    rot: [0.35, 0, 0],
    detail: 2,
    shape: (u) => {
      u.x *= 0.55 + 0.45 * ramp(u.y, -1, 0.7);
    },
  });
  faces({ part: HEAD, mat: EYE, at: EYE_C, size: EYE_DOME, rot: [EYE_TILT, EYE_TURN, 0], detail: 4 });
  if (!coat) {
    for (const [i, lift] of [0.1, 0.0, -0.1, -0.2].entries()) {
      pair({
        part: HEAD,
        mat: WHISKER,
        at: add(MUZZLE_C, [0.018, 0.003 - i * 0.0025, -0.002]),
        offset: [0.03, 0, 0],
        size: [0.032, 0.00045, 0.00045],
        rot: [0, -0.35 + i * 0.05, lift],
        detail: 1,
      });
    }
  }

  const ear: BlobSpec = {
    part: EAR_L,
    mat: EAR,
    at: add(H, EAR_AT),
    offset: [0, 0.02, 0],
    size: [0.027, 0.03, 0.0085],
    rot: [-0.1, 0.3, -0.52],
    detail: 3,
    shape: (u) => {
      const k = 0.5 * (1 - u.y);
      u.x *= 0.04 + 1.0 * k ** 0.85;
      u.z -= 0.7 * (1 - u.x * u.x) * (0.3 + 0.7 * k);
    },
    blend: (u) => ramp(u.z, -0.1, 0.4) * (1 - ramp(Math.abs(u.x), 0.45, 0.75)) * (1 - ramp(u.y, 0.45, 0.8)),
  };
  if (!coat) pair(ear);

  /** Bedraggled: the flood has left the top of its head in a few damp points. */
  rigid(tuft(HEAD, add(S, [0.002, 0.048, 0.004]), [0.95, 0, -0.15], 0.016, 0.007));
  rigid(tuft(HEAD, add(S, [-0.009, 0.047, -0.002]), [0.8, 0, 0.55], 0.014, 0.0065));
  rigid(tuft(HEAD, add(S, [0.011, 0.046, -0.008]), [0.7, 0, -0.7], 0.013, 0.006));

  /** The head is built about its joint at its size, and everything on it with it. */
  for (const geo of out) {
    const skin = geo.attributes.aSkin as THREE.BufferAttribute;
    if (![HEAD, JAW, EAR_L, EAR_R].includes(skin.getX(0)) || skin.getZ(0) !== 0) continue;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, ...onHead([pos.getX(i), pos.getY(i), pos.getZ(i)]));
  }
  return out;
}

export function catGeometry(): THREE.BufferGeometry {
  return merge(parts(false));
}

/** Only what grows fur: the coat the shells are pushed out from. */
export function catCoatGeometry(): THREE.BufferGeometry {
  return merge(parts(true));
}

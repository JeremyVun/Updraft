import type * as THREE from 'three';
import { blob, loft, merge, mirrored, skinned, type BlobSpec, type Station, type V3 } from '../shapes';

/**
 * A small tabby the way a child would draw one: a round head nearly as wide as its shoulders, big eyes, tall soft
 * ears, a short soft barrel of a body on short legs, white mittens and bib, and a thick tail. Authored in metres in
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

export const ARM = 0.082;
export const FORE = 0.076;
export const THIGH = 0.07;
export const SHIN = 0.066;
export const META = 0.046;
/** How far the wrist and the toe joint sit above the ground when the paw is flat. */
export const WRIST = 0.016;
export const TOE = 0.013;
export const TAIL_LINK = 0.056;

/** Each joint's rest position on its parent. */
export const SKELETON: [bone: number, parent: number, at: V3][] = [
  [BODY, ROOT, [0, 0.165, -0.01]],
  [PELVIS, BODY, [0, 0, -0.085]],
  [CHEST, BODY, [0, 0, 0.085]],
  [NECK, CHEST, [0, 0.03, 0.05]],
  [HEAD, NECK, [0, 0.06, 0.032]],
  [JAW, HEAD, [0, -0.03, 0.038]],
  [EAR_L, HEAD, [0.037, 0.046, -0.004]],
  [EAR_R, HEAD, [-0.037, 0.046, -0.004]],
  [TAIL_1, PELVIS, [0, 0.03, -0.066]],
  [TAIL_2, TAIL_1, [0, 0, -TAIL_LINK]],
  [TAIL_3, TAIL_2, [0, 0, -TAIL_LINK]],
  [TAIL_4, TAIL_3, [0, 0, -TAIL_LINK]],
  [TAIL_5, TAIL_4, [0, 0, -TAIL_LINK]],
  [ARM_L, CHEST, [0.036, -0.02, 0.01]],
  [FORE_L, ARM_L, [0, -ARM, 0]],
  [FPAW_L, FORE_L, [0, -FORE, 0]],
  [THIGH_L, PELVIS, [0.042, -0.012, 0.004]],
  [SHIN_L, THIGH_L, [0, -THIGH, 0]],
  [META_L, SHIN_L, [0, -SHIN, 0]],
  [HPAW_L, META_L, [0, -META, 0]],
  [ARM_R, CHEST, [-0.036, -0.02, 0.01]],
  [FORE_R, ARM_R, [0, -ARM, 0]],
  [FPAW_R, FORE_R, [0, -FORE, 0]],
  [THIGH_R, PELVIS, [-0.042, -0.012, 0.004]],
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

const H = REST[HEAD];
/** The skull: its centre and its radii in rest space. */
export const SKULL: V3 = [0, H[1] + 0.012, H[2] + 0.024];
export const SKULL_SIZE: V3 = [0.063, 0.055, 0.054];
/** The middle of the whisker pads, where the whiskers grow from. */
export const MUZZLE: V3 = [0, H[1] - 0.015, H[2] + 0.072];
/** Left eye centre in rest space, how far it is turned out from straight ahead, and its radii. */
export const EYE_AT: V3 = [0.028, H[1] + 0.02, H[2] + 0.063];
export const EYE_TURN = 0.36;
export const EYE_SIZE: V3 = [0.0195, 0.0215, 0.01];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const ramp = (x: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Rump to chest, then up the neck into the skull: a short soft barrel, deepest at the chest and full at the hips. */
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
    s(-0.17, 0.01, 0.012, 0.012, 0.012, [PELVIS, PELVIS, 0]),
    s(-0.16, 0.008, 0.046, 0.046, 0.048, [PELVIS, PELVIS, 0]),
    s(-0.135, 0.004, 0.065, 0.06, 0.068, [PELVIS, PELVIS, 0]),
    s(-0.095, 0.002, 0.07, 0.062, 0.074, [PELVIS, PELVIS, 0]),
    s(-0.05, 0.0, 0.064, 0.06, 0.068, [PELVIS, BODY, 0.6]),
    s(0.0, 0.0, 0.063, 0.06, 0.068, [BODY, BODY, 0]),
    s(0.045, 0.002, 0.066, 0.06, 0.073, [BODY, CHEST, 0.6]),
    s(0.085, 0.004, 0.066, 0.058, 0.076, [CHEST, CHEST, 0]),
    s(0.118, 0.012, 0.06, 0.052, 0.072, [CHEST, CHEST, 0]),
    s(0.142, 0.03, 0.054, 0.045, 0.064, [CHEST, NECK, 0.5]),
    s(0.158, 0.058, 0.048, 0.04, 0.054, [NECK, NECK, 0]),
    s(0.168, 0.084, 0.044, 0.037, 0.046, [NECK, HEAD, 0.5]),
    s(0.175, 0.104, 0.034, 0.03, 0.034, [HEAD, HEAD, 0]),
    s(0.178, 0.114, 0.008, 0.008, 0.008, [HEAD, HEAD, 0]),
  ];
}

/** A leg as one tube from inside the body down to a round mitten of a paw, bent only at its joints. */
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
      s(top[1] + 0.032, 0.016, 0.016, 0.016, [CHEST, CHEST, 0]),
      s(top[1] + 0.012, 0.03, 0.034, 0.032, [CHEST, l.upper, 0.5]),
      s(top[1] - 0.025, 0.027, 0.03, 0.027, [l.upper, l.upper, 0]),
      s(elbow + 0.008, 0.022, 0.022, 0.023, [l.upper, l.lower, 0.5]),
      s(elbow - 0.026, 0.02, 0.02, 0.019, [l.lower, l.lower, 0]),
      s(wrist + 0.014, 0.019, 0.019, 0.018, [l.lower, l.paw, 0.5]),
      s(wrist - 0.002, 0.018, 0.017, 0.017, [l.paw, l.paw, 0], 0.004),
      s(wrist - 0.01, 0.008, 0.008, 0.008, [l.paw, l.paw, 0], 0.008),
    ];
  }
  const meta = 'meta' in l ? l.meta : l.lower;
  const knee = REST[l.lower][1];
  const hock = REST[meta][1];
  const toe = REST[l.paw][1];
  return [
    s(top[1] + 0.03, 0.02, 0.02, 0.02, [PELVIS, PELVIS, 0]),
    s(top[1] + 0.008, 0.034, 0.04, 0.036, [PELVIS, l.upper, 0.55], -0.004),
    s(top[1] - 0.026, 0.031, 0.036, 0.03, [l.upper, l.upper, 0], -0.002),
    s(knee + 0.006, 0.022, 0.024, 0.022, [l.upper, l.lower, 0.5]),
    s(knee - 0.03, 0.017, 0.018, 0.017, [l.lower, l.lower, 0]),
    s(hock + 0.006, 0.015, 0.014, 0.017, [l.lower, meta, 0.5]),
    s(hock - 0.022, 0.0145, 0.014, 0.015, [meta, meta, 0]),
    s(toe + 0.01, 0.016, 0.015, 0.015, [meta, l.paw, 0.5]),
    s(toe - 0.003, 0.016, 0.015, 0.014, [l.paw, l.paw, 0], 0.005),
    s(toe - 0.009, 0.006, 0.006, 0.006, [l.paw, l.paw, 0], 0.01),
  ];
}

/** Thick all the way and a little fuller toward the end, the way a cat's tail is: it reads as a cat from a long way off. */
function tail(): Station[] {
  const base = REST[TAIL_1];
  const st: Station[] = [{ at: add(base, [0, 0.002, 0.03]), rx: 0.024, up: 0.024, down: 0.024, skin: [PELVIS, PELVIS, 0] }];
  const radius = [0.024, 0.0235, 0.024, 0.0245, 0.0225];
  for (let i = 0; i < TAIL.length; i++) {
    const at = REST[TAIL[i]];
    const prev = i === 0 ? PELVIS : TAIL[i - 1];
    st.push({ at, rx: radius[i], up: radius[i], down: radius[i], skin: [prev, TAIL[i], 0.5] });
    st.push({ at: add(at, [0, 0, -TAIL_LINK / 2]), rx: radius[i] + 0.0015, up: radius[i] + 0.0015, down: radius[i] + 0.0015, skin: [TAIL[i], TAIL[i], 0] });
  }
  const end = add(REST[TAIL_5], [0, 0, -TAIL_LINK]);
  st.push({ at: add(end, [0, 0, 0.006]), rx: 0.018, up: 0.018, down: 0.018, skin: [TAIL_5, TAIL_5, 0] });
  st.push({ at: add(end, [0, 0, -0.01]), rx: 0.006, up: 0.006, down: 0.006, skin: [TAIL_5, TAIL_5, 0] });
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
    size: [width, length / 2, width * 0.75],
    offset: [0, length * 0.4, 0],
    detail: 2,
    shape: (u) => {
      const k = 0.5 * (1 - u.y);
      u.x *= 0.3 + 0.7 * k;
      u.z *= 0.3 + 0.7 * k;
    },
    blend: () => white,
  };
}

export function catGeometry(): THREE.BufferGeometry {
  const out: THREE.BufferGeometry[] = [];
  const rigid = (spec: BlobSpec) => out.push(skinned(blob(spec)));
  const pair = (spec: BlobSpec) => {
    rigid(spec);
    rigid(mirrored(spec, LEFT_TO_RIGHT[spec.part] ?? spec.part));
  };

  out.push(
    loft({
      stations: trunk(),
      mat: FUR,
      around: 24,
      smooth: 2,
      /** The white bib runs from the chin down the throat and chest and on, fainter, under the belly. */
      blend: (t, a) => {
        const under = ramp(-Math.sin(a), 0.15, 0.7);
        const bib = ramp(t, 0.55, 0.72) * (1 - ramp(t, 0.95, 1));
        return under * (bib + (1 - bib) * 0.6 * ramp(t, 0.2, 0.45));
      },
    }),
  );
  for (const side of [1, -1]) {
    for (const front of [true, false]) {
      const st = leg(front);
      const socks = front ? REST[FPAW_L][1] + 0.03 : REST[HPAW_L][1] + 0.026;
      /** The bib runs on down the fronts of the forelegs into the mittens, as it does on a bicolour tabby. */
      const fronts = front ? (_t: number, a: number) => ramp(Math.sin(a), 0.2, 0.75) * 0.9 : undefined;
      const geo = loft({ stations: side > 0 ? st : mirrorStations(st, LEFT_TO_RIGHT), mat: FUR, around: 14, smooth: 1, blend: fronts });
      out.push(paint(geo, (_x, y) => ramp(y, socks + 0.006, socks - 0.006)));
    }
  }
  out.push(loft({ stations: tail(), mat: FUR, around: 14, smooth: 1 }));

  /** Paws: round mittens, all white. */
  pair({ part: FPAW_L, mat: FUR, at: add(REST[FPAW_L], [0, -WRIST + 0.012, 0.013]), size: [0.02, 0.0125, 0.024], detail: 2, blend: () => 1 });
  pair({ part: HPAW_L, mat: FUR, at: add(REST[HPAW_L], [0, -TOE + 0.011, 0.012]), size: [0.019, 0.012, 0.025], detail: 2, blend: () => 1 });

  rigid({
    part: HEAD,
    mat: FUR,
    at: SKULL,
    size: SKULL_SIZE,
    detail: 3,
    shape: (u) => {
      /** Wide at the cheeks and a little flat across the brow, which is a cat's face rather than a ball. */
      const cheek = ramp(-u.y, -0.4, 0.4) * (1 - ramp(-u.y, 0.8, 1)) * ramp(u.z, -0.6, 0.2);
      u.x *= 1 + 0.16 * cheek;
      if (u.y > 0.55) u.y = 0.55 + (u.y - 0.55) * 0.8;
      if (u.z > 0.45) u.z = 0.45 + (u.z - 0.45) * 0.8;
    },
    blend: (u) => ramp(-u.y, 0.2, 0.6) * ramp(u.z, 0.2, 0.65) * (1 - ramp(Math.abs(u.x), 0.55, 0.8)),
  });
  /** The muzzle: two round whisker pads and a chin, white, with a small pink nose on top. */
  pair({ part: HEAD, mat: FUR, at: add(H, [0.0155, -0.013, 0.071]), size: [0.0195, 0.0155, 0.016], detail: 2, blend: () => 1 });
  rigid({ part: JAW, mat: FUR, at: add(REST[JAW], [0, -0.004, 0.025]), size: [0.0165, 0.01, 0.016], detail: 2, blend: () => 1 });
  rigid({ part: JAW, mat: MOUTH, at: add(REST[JAW], [0, 0.006, 0.019]), size: [0.014, 0.008, 0.016], detail: 2 });
  rigid({
    part: HEAD,
    mat: NOSE,
    at: add(H, [0, -0.001, 0.085]),
    size: [0.0095, 0.0062, 0.006],
    rot: [0.3, 0, 0],
    detail: 1,
    shape: (u) => {
      u.x *= 0.65 + 0.35 * ramp(u.y, -1, 0.6);
    },
  });
  pair({ part: HEAD, mat: EYE, at: EYE_AT, size: EYE_SIZE, rot: [0.05, EYE_TURN, 0], detail: 3 });
  for (const [i, lift] of [0.08, -0.02, -0.12].entries()) {
    pair({
      part: HEAD,
      mat: WHISKER,
      at: add(H, [0.027, -0.015 - i * 0.003, 0.07]),
      offset: [0.028, 0, 0],
      size: [0.03, 0.001, 0.001],
      rot: [0, -0.3, lift],
      detail: 1,
    });
  }

  const ear: BlobSpec = {
    part: EAR_L,
    mat: EAR,
    at: REST[EAR_L],
    offset: [0, 0.028, 0],
    size: [0.029, 0.033, 0.01],
    rot: [-0.12, 0.3, -0.3],
    detail: 2,
    shape: (u) => {
      const k = 0.5 * (1 - u.y);
      u.x *= 0.2 + 0.86 * k;
      u.z -= 0.75 * (1 - u.x * u.x) * (0.4 + 0.6 * k);
    },
    blend: (u) => ramp(u.z, 0.0, 0.5) * (1 - ramp(Math.abs(u.x), 0.45, 0.8)) * (1 - ramp(u.y, 0.5, 0.85)),
  };
  pair(ear);

  /** Full soft cheeks, which more than anything are what make the face a kitten's. */
  pair({ part: HEAD, mat: FUR, at: add(H, [0.043, -0.016, 0.034]), size: [0.024, 0.024, 0.028], detail: 2, blend: (u) => ramp(-u.y, -0.2, 0.6) * 0.5 });
  /** Bedraggled: the flood has left the top of its head in damp points. */
  rigid(tuft(HEAD, add(H, [0.006, 0.058, 0.0]), [-0.5, 0, 0.25], 0.016, 0.009));
  rigid(tuft(HEAD, add(H, [-0.01, 0.056, 0.008]), [-0.2, 0, -0.35], 0.013, 0.008));

  return merge(out);
}

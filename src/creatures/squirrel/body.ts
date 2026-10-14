import * as THREE from 'three';
import { blob, loft, merge, mirrored, skinned, type BlobSpec, type Station, type V3 } from '../shapes';

/**
 * A red squirrel at its real size (the creature's `scale` cheats it up): a round head with big dark eyes set to the
 * sides in cream rings, upright ears with long autumn tufts, a long soft body on big haunches and long hind feet,
 * small hands, and a plume of a tail as long as the body. Authored in metres in one rest space (on all fours, facing
 * +z, legs straight down, the tail straight out behind), bound to bones, and posed by `pose.ts`.
 */
export const BONES = 31;
export const [
  ROOT, BODY, PELVIS, CHEST, NECK, HEAD, JAW, EAR_L, EAR_R,
  TAIL_1, TAIL_2, TAIL_3, TAIL_4, TAIL_5, TAIL_6, TAIL_7, TAIL_8,
  ARM_L, FORE_L, HAND_L, THIGH_L, SHIN_L, META_L, FOOT_L,
  ARM_R, FORE_R, HAND_R, THIGH_R, SHIN_R, META_R, FOOT_R,
] = Array.from({ length: BONES }, (_, i) => i);
export const TAIL = [TAIL_1, TAIL_2, TAIL_3, TAIL_4, TAIL_5, TAIL_6, TAIL_7, TAIL_8];

export const FUR = 0;
export const EAR = 1;
export const EYE = 2;
export const NOSE = 3;
export const MOUTH = 4;
export const WHISKER = 5;
export const NUT = 6;
export const TUFT = 7;

export const ARM = 0.026;
export const FORE = 0.028;
export const THIGH = 0.034;
export const SHIN = 0.038;
/** Heel to the ball of the foot; the toes run on past it. */
export const META = 0.03;
/** How far the wrist and the ball of the foot are held above the ground when the paw is flat, its pad and fur under them. */
export const WRIST = 0.0062;
export const TOE = 0.0062;
export const TAIL_LINK = 0.022;

const EAR_AT: V3 = [0.0105, 0.0175, -0.003];
const JAW_AT: V3 = [0, -0.009, 0.02];

export const SKELETON: [bone: number, parent: number, at: V3][] = [
  [BODY, ROOT, [0, 0.064, 0]],
  [PELVIS, BODY, [0, 0, -0.04]],
  [CHEST, BODY, [0, 0.003, 0.038]],
  [NECK, CHEST, [0, 0.012, 0.026]],
  [HEAD, NECK, [0, 0.013, 0.016]],
  [JAW, HEAD, JAW_AT],
  [EAR_L, HEAD, EAR_AT],
  [EAR_R, HEAD, [-EAR_AT[0], EAR_AT[1], EAR_AT[2]]],
  [TAIL_1, PELVIS, [0, 0.01, -0.03]],
  ...TAIL.slice(1).map((bone, i): [number, number, V3] => [bone, TAIL[i], [0, 0, -TAIL_LINK]]),
  [ARM_L, CHEST, [0.013, -0.012, 0.006]],
  [FORE_L, ARM_L, [0, -ARM, 0]],
  [HAND_L, FORE_L, [0, -FORE, 0]],
  [THIGH_L, PELVIS, [0.017, -0.004, 0.004]],
  [SHIN_L, THIGH_L, [0, -THIGH, 0]],
  [META_L, SHIN_L, [0, -SHIN, 0]],
  [FOOT_L, META_L, [0, -META, 0]],
  [ARM_R, CHEST, [-0.013, -0.012, 0.006]],
  [FORE_R, ARM_R, [0, -ARM, 0]],
  [HAND_R, FORE_R, [0, -FORE, 0]],
  [THIGH_R, PELVIS, [-0.017, -0.004, 0.004]],
  [SHIN_R, THIGH_R, [0, -THIGH, 0]],
  [META_R, SHIN_R, [0, -SHIN, 0]],
  [FOOT_R, META_R, [0, -META, 0]],
];

export const REST: V3[] = (() => {
  const out: V3[] = [[0, 0, 0]];
  for (const [bone, parent, [x, y, z]] of SKELETON) out[bone] = [out[parent][0] + x, out[parent][1] + y, out[parent][2] + z];
  return out;
})();

export const LEGS = [
  { upper: ARM_L, lower: FORE_L, paw: HAND_L, side: 1, front: true },
  { upper: ARM_R, lower: FORE_R, paw: HAND_R, side: -1, front: true },
  { upper: THIGH_L, lower: SHIN_L, meta: META_L, paw: FOOT_L, side: 1, front: false },
  { upper: THIGH_R, lower: SHIN_R, meta: META_R, paw: FOOT_R, side: -1, front: false },
] as const;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const ramp = (x: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const H = REST[HEAD];
/** The skull: its centre and radii. */
export const SKULL: V3 = add(H, [0, 0.004, 0.006]);
export const SKULL_SIZE: V3 = [0.0158, 0.0158, 0.0205];

/**
 * The head from the unit sphere: a round crown, full cheeks low behind the eyes, and a short blunt muzzle that
 * narrows and drops to the nose, so the eyes sit high on a face that is mostly cheek and brow.
 */
function skullShape(u: { x: number; y: number; z: number }): void {
  const front = ramp(u.z, 0.15, 0.95);
  u.x *= 1 - 0.42 * front;
  u.y = u.y * (1 - 0.3 * front) - 0.16 * ramp(u.z, 0.35, 1);
  u.z += 0.1 * front * (1 - ramp(Math.abs(u.y), 0.2, 0.7));
  const cheek = ramp(-u.y, -0.25, 0.35) * Math.exp(-(((u.z - 0.05) / 0.45) ** 2));
  u.x *= 1 + 0.16 * cheek;
  if (u.y > 0.45) u.y = 0.45 + (u.y - 0.45) * 0.8;
  u.y -= 0.12 * ramp(-u.y, 0.4, 0.95) * ramp(u.z, -0.3, 0.4);
}

/** A point on the skull for a direction from its centre, with the surface's normal there. */
function onSkull(dir: V3): { at: V3; normal: V3 } {
  const point = (d: THREE.Vector3): V3 => {
    const u = { x: d.x, y: d.y, z: d.z };
    skullShape(u);
    return [SKULL[0] + u.x * SKULL_SIZE[0], SKULL[1] + u.y * SKULL_SIZE[1], SKULL[2] + u.z * SKULL_SIZE[2]];
  };
  const d = new THREE.Vector3(...dir).normalize();
  const at = point(d);
  const t1 = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
  const t2 = new THREE.Vector3().crossVectors(t1, d).normalize();
  const e = 1e-3;
  const a = point(d.clone().addScaledVector(t1, e).normalize());
  const b = point(d.clone().addScaledVector(t2, e).normalize());
  const n = new THREE.Vector3(a[0] - at[0], a[1] - at[1], a[2] - at[2]).cross(new THREE.Vector3(b[0] - at[0], b[1] - at[1], b[2] - at[2])).normalize();
  if (n.dot(d) < 0) n.negate();
  return { at, normal: [n.x, n.y, n.z] };
}

const EYE_FACE = onSkull([0.8, 0.3, 0.5]);
export const EYE_RADIUS = 0.0054;
const EYE_DOME: V3 = [EYE_RADIUS / 0.9, EYE_RADIUS / 0.9, 0.0032];
export const EYE_AT: V3 = add(EYE_FACE.at, EYE_FACE.normal.map((n) => n * (0.0012 - EYE_DOME[2])) as V3);
export const EYE_TURN = Math.atan2(EYE_FACE.normal[0], EYE_FACE.normal[2]);
export const EYE_TILT = -Math.asin(EYE_FACE.normal[1]);
export const NOSE_AT: V3 = add(onSkull([0, -0.05, 1]).at, [0, 0, -0.0012]);
export const MUZZLE: V3 = add(onSkull([0.35, -0.3, 0.9]).at, [-0.002, 0, -0.002]);
/** Where the forepaws bring a nut up to, under the chin, in the head's rest space. */
export const CHIN: V3 = add(onSkull([0, -0.75, 0.66]).at, [0, -0.004, 0.004]);

function trunk(): Station[] {
  const b = REST[BODY];
  const s = (z: number, y: number, rx: number, up: number, down: number, skin: [number, number, number]): Station => ({
    at: add(b, [0, y, z]), rx, up, down, skin,
  });
  return [
    s(-0.074, 0.004, 0.006, 0.006, 0.006, [PELVIS, PELVIS, 0]),
    s(-0.068, 0.004, 0.019, 0.018, 0.019, [PELVIS, PELVIS, 0]),
    s(-0.056, 0.003, 0.026, 0.025, 0.027, [PELVIS, PELVIS, 0]),
    s(-0.036, 0.002, 0.027, 0.026, 0.03, [PELVIS, BODY, 0.3]),
    s(-0.012, 0.001, 0.025, 0.025, 0.031, [PELVIS, BODY, 0.85]),
    s(0.012, 0.002, 0.023, 0.023, 0.029, [BODY, CHEST, 0.4]),
    s(0.032, 0.004, 0.021, 0.021, 0.025, [BODY, CHEST, 0.9]),
    s(0.048, 0.008, 0.018, 0.018, 0.02, [CHEST, NECK, 0.2]),
    s(0.06, 0.016, 0.0155, 0.016, 0.017, [CHEST, NECK, 0.7]),
    s(0.07, 0.025, 0.0145, 0.0145, 0.015, [NECK, HEAD, 0.4]),
    s(0.078, 0.031, 0.012, 0.012, 0.012, [NECK, HEAD, 0.85]),
    s(0.083, 0.035, 0.004, 0.004, 0.004, [HEAD, HEAD, 0]),
  ];
}

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
      s(top[1] + 0.016, 0.009, 0.009, 0.009, [CHEST, CHEST, 0]),
      s(top[1] + 0.004, 0.0105, 0.011, 0.0105, [CHEST, l.upper, 0.5]),
      s(top[1] - 0.012, 0.0085, 0.0095, 0.009, [l.upper, l.upper, 0]),
      s(elbow + 0.003, 0.0068, 0.0075, 0.007, [l.upper, l.lower, 0.5]),
      s(elbow - 0.012, 0.0056, 0.006, 0.0056, [l.lower, l.lower, 0]),
      s(wrist + 0.005, 0.0046, 0.0046, 0.0044, [l.lower, l.paw, 0.5]),
      s(wrist - 0.002, 0.0042, 0.0042, 0.004, [l.paw, l.paw, 0], 0.001),
      s(wrist - 0.006, 0.002, 0.002, 0.002, [l.paw, l.paw, 0], 0.002),
    ];
  }
  const meta = 'meta' in l ? l.meta : l.lower;
  const knee = REST[l.lower][1];
  const hock = REST[meta][1];
  const toe = REST[l.paw][1];
  return [
    s(top[1] + 0.016, 0.012, 0.012, 0.012, [PELVIS, PELVIS, 0]),
    s(top[1] + 0.002, 0.017, 0.019, 0.017, [PELVIS, l.upper, 0.5], -0.002),
    s(top[1] - 0.014, 0.016, 0.019, 0.015, [l.upper, l.upper, 0], 0.001),
    s(knee + 0.006, 0.0095, 0.01, 0.009, [l.upper, l.lower, 0.5]),
    s(knee - 0.016, 0.0068, 0.007, 0.0064, [l.lower, l.lower, 0]),
    s(hock + 0.004, 0.0052, 0.0052, 0.0056, [l.lower, meta, 0.5]),
    s(hock - 0.014, 0.0046, 0.0045, 0.0052, [meta, meta, 0]),
    s(toe + 0.004, 0.0052, 0.0048, 0.005, [meta, l.paw, 0.5]),
    s(toe - 0.002, 0.0048, 0.0045, 0.0045, [l.paw, l.paw, 0], 0.003),
    s(toe - 0.005, 0.002, 0.002, 0.002, [l.paw, l.paw, 0], 0.006),
  ];
}

/** Half-widths of the plume along its length, root to tip: thin at the root, full through the middle, round at the end. */
const PLUME = [0.011, 0.017, 0.023, 0.027, 0.03, 0.031, 0.03, 0.027];
/** The plume is wider across than it is deep, as a squirrel's tail hair fans out to the sides. */
const PLUME_DEEP = 0.74;

function tail(): Station[] {
  const base = REST[TAIL_1];
  const st: Station[] = [{ at: add(base, [0, 0.002, 0.024]), rx: 0.008, up: 0.008, down: 0.008, skin: [PELVIS, PELVIS, 0] }];
  for (let i = 0; i < TAIL.length; i++) {
    const at = REST[TAIL[i]];
    const prev = i === 0 ? PELVIS : TAIL[i - 1];
    const r = PLUME[i];
    const r2 = (PLUME[i] + (PLUME[i + 1] ?? 0.022)) / 2;
    st.push({ at, rx: r, up: r * PLUME_DEEP, down: r * PLUME_DEEP, skin: [prev, TAIL[i], 0.5] });
    st.push({ at: add(at, [0, 0, -TAIL_LINK / 2]), rx: r2, up: r2 * PLUME_DEEP, down: r2 * PLUME_DEEP, skin: [TAIL[i], TAIL[i], 0] });
  }
  const end = add(REST[TAIL_8], [0, 0, -TAIL_LINK]);
  st.push({ at: add(end, [0, 0, 0.004]), rx: 0.018, up: 0.014, down: 0.014, skin: [TAIL_8, TAIL_8, 0] });
  st.push({ at: add(end, [0, 0, -0.008]), rx: 0.006, up: 0.005, down: 0.005, skin: [TAIL_8, TAIL_8, 0] });
  return st;
}

const mirrorStations = (st: Station[], swap: Record<number, number>): Station[] =>
  st.map((s) => ({ ...s, at: [-s.at[0], s.at[1], s.at[2]] as V3, skin: [swap[s.skin[0]] ?? s.skin[0], swap[s.skin[1]] ?? s.skin[1], s.skin[2]] }));

const LEFT_TO_RIGHT: Record<number, number> = {
  [ARM_L]: ARM_R, [FORE_L]: FORE_R, [HAND_L]: HAND_R, [THIGH_L]: THIGH_R, [SHIN_L]: SHIN_R, [META_L]: META_R, [FOOT_L]: FOOT_R, [EAR_L]: EAR_R,
};

/** A blunt cone along its own +y, as long as `length`, standing on `at`: one lock of a tuft. */
function lock(part: number, mat: number, at: V3, rot: V3, length: number, width: number): BlobSpec {
  return {
    part,
    mat,
    at,
    rot,
    size: [width, length / 2, width * 0.7],
    offset: [0, length * 0.42, 0],
    detail: 2,
    shape: (u) => {
      const k = 0.5 * (1 - u.y);
      u.x *= 0.12 + 0.88 * k;
      u.z *= 0.12 + 0.88 * k;
    },
    blend: (u) => ramp(u.y, 0.2, 0.9),
  };
}

const EAR_ROT: V3 = [-0.12, 0.42, -0.2];
const EAR_SIZE: V3 = [0.0076, 0.0088, 0.0032];
const earPoint = (local: V3): V3 => {
  const v = new THREE.Vector3(...local).applyEuler(new THREE.Euler(...EAR_ROT, 'YXZ'));
  return add(add(H, EAR_AT), [v.x, v.y, v.z]);
};

function parts(coat: boolean): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const rigid = (spec: BlobSpec) => out.push(skinned(blob(spec)));
  const pair = (spec: BlobSpec) => {
    rigid(spec);
    rigid(mirrored(spec, LEFT_TO_RIGHT[spec.part] ?? spec.part));
  };
  const faces = (spec: BlobSpec) => !coat && pair(spec);

  out.push(
    loft({
      stations: trunk(),
      mat: FUR,
      around: 24,
      smooth: 2,
      /** Cream from the chin down the throat and chest and along the belly; the flanks stay rust right down to it. */
      blend: (t, a) => {
        const throat = ramp(t, 0.55, 0.75);
        return ramp(-Math.sin(a), 0.55 - 0.3 * throat, 0.8 - 0.3 * throat) * (0.85 + 0.15 * throat);
      },
    }),
  );
  for (const side of [1, -1]) {
    for (const front of [true, false]) {
      const st = leg(front);
      /** The insides of the legs carry the belly's cream down a little way. */
      const inner = (t: number, a: number) => ramp(-Math.cos(a) * side, 0.5, 0.95) * (1 - ramp(t, 0.2, 0.5)) * 0.7;
      out.push(loft({ stations: side > 0 ? st : mirrorStations(st, LEFT_TO_RIGHT), mat: FUR, around: 12, smooth: 1, blend: inner }));
    }
  }
  /** The plume's edges, where the long hair fans out, are paler than its core. */
  out.push(loft({ stations: tail(), mat: FUR, around: 18, smooth: 1, blend: (t, a) => Math.abs(Math.cos(a)) ** 2 * ramp(t, 0.05, 0.4) }));

  /** The haunch: a big round thigh, the bottom of the pear when it sits up. */
  pair({ part: THIGH_L, mat: FUR, at: add(REST[THIGH_L], [0.002, -0.012, -0.002]), size: [0.017, 0.023, 0.023], detail: 3 });
  /** Small hands, and long narrow hind feet that run on past the ball of the foot into the toes. */
  pair({ part: HAND_L, mat: FUR, at: add(REST[HAND_L], [0, -0.001, 0.004]), size: [0.0048, 0.0032, 0.0072], detail: 2 });
  pair({ part: FOOT_L, mat: FUR, at: add(REST[FOOT_L], [0, -0.0008, 0.007]), size: [0.0055, 0.0032, 0.0125], detail: 2 });

  rigid({
    part: HEAD,
    mat: FUR,
    at: SKULL,
    size: SKULL_SIZE,
    detail: 10,
    shape: skullShape,
    /** Cream under the chin and along the lips; the cheeks stay rust so the head's round outline holds. */
    blend: (u) => Math.max(ramp(-u.y, 0.55, 0.85) * ramp(u.z, -0.2, 0.3), ramp(-u.y, 0.25, 0.45) * ramp(u.z, 0.75, 0.92) * 0.8),
  });
  /** The lower jaw, a small soft chin that drops for a chitter. */
  rigid({ part: JAW, mat: FUR, at: add(H, add(JAW_AT, [0, -0.0005, 0.0005])), size: [0.0055, 0.0035, 0.0068], detail: 2, blend: () => 1 });
  if (!coat) rigid({ part: HEAD, mat: MOUTH, at: add(H, add(JAW_AT, [0, 0.0016, 0.0005])), size: [0.0032, 0.002, 0.004], detail: 2 });
  if (!coat) {
    rigid({ part: HEAD, mat: NOSE, at: NOSE_AT, size: [0.0028, 0.0021, 0.002], rot: [0.3, 0, 0], detail: 2, shape: (u) => { u.x *= 0.6 + 0.4 * ramp(u.y, -1, 0.7); } });
  }
  faces({ part: HEAD, mat: EYE, at: EYE_AT, size: EYE_DOME, rot: [EYE_TILT, EYE_TURN, 0], detail: 4 });
  if (!coat) {
    for (const [i, lift] of [0.15, 0.02, -0.12, -0.26].entries()) {
      pair({
        part: HEAD,
        mat: WHISKER,
        at: add(MUZZLE, [0.001, 0.0015 - i * 0.0012, 0]),
        offset: [0.011, 0, 0],
        size: [0.012, 0.00016, 0.00016],
        rot: [0, -0.55 + i * 0.07, lift],
        detail: 1,
      });
    }
  }

  /** Upright, rounded, a little cupped forward; rust outside and paler inside. */
  pair({
    part: EAR_L,
    mat: EAR,
    at: add(H, EAR_AT),
    offset: [0, EAR_SIZE[1] * 0.85, 0],
    size: EAR_SIZE,
    rot: EAR_ROT,
    detail: 3,
    shape: (u) => {
      const k = 0.5 * (1 - u.y);
      u.x *= 0.45 + 0.55 * Math.sqrt(k);
      u.z -= 0.55 * (1 - u.x * u.x) * (0.35 + 0.65 * k);
    },
    blend: (u) => ramp(u.z, -0.2, 0.4) * (1 - ramp(Math.abs(u.x), 0.4, 0.75)) * (1 - ramp(u.y, 0.3, 0.75)),
  });
  /** The autumn tufts: a brush of long dark locks off each ear's tip, fanning up and out. */
  const tip = earPoint([0, EAR_SIZE[1] * 1.55, -0.0005]);
  for (const [dx, dz, lean, splay, length] of [
    [0, 0, 0.05, -0.1, 0.019],
    [0.0012, -0.0012, -0.18, -0.38, 0.016],
    [-0.0012, 0.0008, 0.22, 0.12, 0.015],
    [0.0006, 0.0012, 0.3, -0.25, 0.013],
    [-0.0008, -0.0014, -0.3, -0.05, 0.014],
  ] as const) {
    pair(lock(EAR_L, TUFT, add(tip, [dx, -0.004, dz]), [lean, 0.4, -0.18 + splay], length, 0.0028));
  }
  /** A nut held in the forepaws; the shader hides it when there is none. */
  if (!coat) rigid({ part: HAND_R, mat: NUT, at: add(REST[HAND_R], [0.0075, -0.007, 0.004]), size: [0.0068, 0.0072, 0.0082], detail: 2, shape: (u) => { u.x *= 1 - 0.25 * ramp(u.z, 0, 1); u.y *= 1 - 0.25 * ramp(u.z, 0, 1); } });
  return out;
}

export function squirrelGeometry(): THREE.BufferGeometry {
  return merge(parts(false));
}

/** Only what grows fur: the coat the shells are pushed out from. */
export function squirrelCoatGeometry(): THREE.BufferGeometry {
  return merge(parts(true));
}

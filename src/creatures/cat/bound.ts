import { ARM, ARM_L, BODY, FORE, REST, THIGH_L } from './body';

/**
 * The bound, a cat's gallop as it reads from across a roof: the hind paws come down under the belly with the back
 * arched and every paw gathered (the bunch), drive it on and up, all four come off the roof with the spine long and
 * the legs stretched apart, the front paws reach and come down first, and the hind paws swing up under it to gather
 * again. Phases are fractions of a stride from the left hind paw touching down; lengths are in metres before scale,
 * across (to its left), up off what it stands on, and along the way it faces, from the point under it.
 */

/** When each paw comes down (front left, front right, hind left, hind right), and the share of the stride it stays down. */
export const BOUND_DOWN = [0.6, 0.65, 0, 0.04] as const;
export const BOUND_DUTY = [0.28, 0.28, 0.3, 0.3] as const;

export interface BoundShape {
  /** The body raised (positive) from how it stands. */
  rise: number;
  /** The back rounded up (positive) or long and hollow. */
  flex: number;
  /** The trunk drawn out along the spine (positive) or bunched up short. */
  stretch: number;
  /** The whole body carried ahead of the point under it. */
  surge: number;
  /** Nose up. */
  pitch: number;
  /** The tail's root lifted. */
  tail: number;
}

type Keys = readonly (readonly [number, number])[];

const RISE: Keys = [[0, -0.02], [0.2, -0.006], [0.34, 0.012], [0.47, 0.036], [0.6, 0.012], [0.76, -0.012], [0.92, -0.022]];
const FLEX: Keys = [[0, 0.6], [0.2, 0.15], [0.36, -0.25], [0.5, -0.32], [0.64, -0.1], [0.8, 0.32], [0.94, 0.62]];
const STRETCH: Keys = [[0, -0.024], [0.2, -0.004], [0.36, 0.016], [0.5, 0.026], [0.64, 0.018], [0.8, -0.006], [0.94, -0.024]];
const PITCH: Keys = [[0, -0.02], [0.18, 0.1], [0.32, 0.13], [0.47, 0.02], [0.62, -0.13], [0.8, -0.09], [0.94, -0.04]];
const TAIL: Keys = [[0.02, 0.28], [0.3, 0.1], [0.52, -0.12], [0.76, 0.02]];

/** A smooth closed curve through values at phases round the stride. */
function loop(p: number, keys: Keys): number {
  const n = keys.length;
  let x = p - Math.floor(p);
  let i = n - 1;
  if (x < keys[0][0]) x += 1;
  else for (let j = 0; j < n; j++) if (keys[j][0] <= x) i = j;
  const at = (j: number): readonly [number, number] => {
    const k = ((j % n) + n) % n;
    return [keys[k][0] + Math.floor(j / n), keys[k][1]];
  };
  const [t0, v0] = at(i - 1), [t1, v1] = at(i), [t2, v2] = at(i + 1), [t3, v3] = at(i + 2);
  const h = t2 - t1;
  const u = (x - t1) / h;
  const m1 = ((v2 - v0) / (t2 - t0)) * h;
  const m2 = ((v3 - v1) / (t3 - t1)) * h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
}

/** `low`, 0..1, is fear: the same bound kept down nearer the roof and drawn out longer. */
export function boundShape(p: number, low: number, out: BoundShape): BoundShape {
  const stretch = loop(p, STRETCH) * (1 + 0.3 * low);
  out.rise = loop(p, RISE) * (1 - 0.4 * low) - 0.012 * low;
  out.flex = loop(p, FLEX) * (1 - 0.2 * low);
  out.stretch = stretch;
  /** The hips go on at an even pace; it is the shoulders that check over the front paws and surge on after. */
  out.surge = stretch / 2;
  out.pitch = loop(p, PITCH) * (1 - 0.3 * low);
  out.tail = loop(p, TAIL);
  return out;
}

const SHOULDER = REST[ARM_L];
const HIP = REST[THIGH_L];
const BODY_Y = REST[BODY][1];
/** Its legs at a bound against their own length, and how high the body is carried on them before its rise. */
export const BOUND_LEGS = 1.2;
const BOUND_BODY = 0.12 + (BOUND_LEGS - 1) * (ARM + FORE);

const shape: BoundShape = { rise: 0, flex: 0, stretch: 0, surge: 0, pitch: 0, tail: 0 };

/**
 * Where a paw in the air is reaching for, as the body is now, at two moments of its swing: a front paw folds up under
 * the chest and then reaches out long ahead of it; a hind paw trails out straight behind and then swings up under
 * the belly. Writes [along, up] for each moment and returns when in the swing they fall.
 */
export function boundReach(leg: number, p: number, low: number, first: number[], second: number[]): readonly [number, number] {
  boundShape(p, low, shape);
  const y = BOUND_BODY + shape.rise;
  if (leg < 2) {
    const along = SHOULDER[2] + shape.surge + shape.stretch / 2;
    const up = y + SHOULDER[1] - BODY_Y;
    first[0] = along - 0.012;
    first[1] = 0.05 * BOUND_LEGS;
    second[0] = along + 0.092 * BOUND_LEGS;
    second[1] = up - 0.06 * BOUND_LEGS;
    return [0.3, 0.72];
  }
  const along = HIP[2] + shape.surge - shape.stretch / 2;
  const up = y + HIP[1] - BODY_Y;
  first[0] = along - 0.13 * BOUND_LEGS;
  first[1] = up - 0.075 * BOUND_LEGS;
  second[0] = along + 0.045;
  second[1] = 0.045 * BOUND_LEGS;
  return [0.26, 0.76];
}

/** How far each hind foot lies back from standing on its toes, through its own stride from touching down. */
export function boundHock(mine: number, duty: number): number {
  if (mine < duty) {
    const t = mine / duty;
    return 1.0 - 1.25 * t * t * (3 - 2 * t);
  }
  const s = (mine - duty) / (1 - duty);
  return s < 0.3 ? -0.25 - 0.7 * (s / 0.3) : -0.95 + 1.95 * Math.min(1, (s - 0.3) / 0.45);
}

/**
 * The middle of each paw's time down, along the way it faces, against the paw's home under the standing cat: where
 * the shoulders or the hips are then, drawn in under the body, since each pair leaves from far out behind it.
 */
export const BOUND_SHIFT = BOUND_DOWN.map((down, i) => {
  boundShape(down + BOUND_DUTY[i] / 2, 0, shape);
  return i < 2 ? shape.surge + shape.stretch / 2 - 0.02 : shape.surge - shape.stretch / 2 + 0.02;
});
export const BOUND_SET_OFF = BOUND_DOWN[2] + BOUND_DUTY[2] / 2 + 0.05;

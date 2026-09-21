import { MIRROR_SHIFT } from './geography';
import { glsl, tuning } from '../tuning';

/** A sandbank just beneath the sea, well west of home. Nothing rises above the reflected horizon. */
export const SKY_MIRROR = { x: -455 + MIRROR_SHIFT.x, z: -2310 + MIRROR_SHIFT.z, rx: 82, rz: 70 } as const;
/** Moor offshore, alongside a wooden walk that reaches the submerged flat. */
export const MIRROR_ENTRY_DECK = { x0: -514.12 + MIRROR_SHIFT.x, z0: -2268.87 + MIRROR_SHIFT.z, x1: -501 + MIRROR_SHIFT.x, z1: -2278 + MIRROR_SHIFT.z, halfWidth: 1.15, height: 0.28, stepOffDepth: -0.04 };
export const MIRROR_LANDING = { x: -515.66 + MIRROR_SHIFT.x, z: -2271.09 + MIRROR_SHIFT.z, yaw: Math.atan2(13.12,-9.13) } as const;
export const MIRROR_WATCH = { x: -454 + MIRROR_SHIFT.x, z: -2281 + MIRROR_SHIFT.z } as const;
/** Legacy causeway stops, retained for existing checkpoint and route tooling. */
export const MIRROR_PATH = [
  { x: -455 + MIRROR_SHIFT.x, z: -2274 + MIRROR_SHIFT.z }, { x: -458 + MIRROR_SHIFT.x, z: -2297 + MIRROR_SHIFT.z },
  { x: -436 + MIRROR_SHIFT.x, z: -2320 + MIRROR_SHIFT.z }, { x: -406 + MIRROR_SHIFT.x, z: -2323 + MIRROR_SHIFT.z },
] as const;
export const MIRROR_BERTH = { x: -390 + MIRROR_SHIFT.x, z: -2323 + MIRROR_SHIFT.z, yaw: Math.PI } as const;
export const MIRROR_DECK = { x0: -407 + MIRROR_SHIFT.x, z0: -2323 + MIRROR_SHIFT.z, x1: -391 + MIRROR_SHIFT.x, z1: -2323 + MIRROR_SHIFT.z, halfWidth: 1.15, height: 0.22 };
/** The empty hull drifts through the deep channel, never over the walkable mirror. */
export const MIRROR_DRIFT = [
  { x: -532 + MIRROR_SHIFT.x, z: -2259 + MIRROR_SHIFT.z }, { x: -533 + MIRROR_SHIFT.x, z: -2215 + MIRROR_SHIFT.z }, { x: -403 + MIRROR_SHIFT.x, z: -2206 + MIRROR_SHIFT.z },
  { x: -354 + MIRROR_SHIFT.x, z: -2260 + MIRROR_SHIFT.z }, { x: -350 + MIRROR_SHIFT.x, z: -2319 + MIRROR_SHIFT.z }, MIRROR_BERTH,
] as const;

/** A handful of fallen lights, all on the existing shallow flat. Order is the player's choice. */
export const MIRROR_STARS = [
  { x: -457 + MIRROR_SHIFT.x, z: -2304 + MIRROR_SHIFT.z }, { x: -438 + MIRROR_SHIFT.x, z: -2317 + MIRROR_SHIFT.z }, { x: -458 + MIRROR_SHIFT.x, z: -2333 + MIRROR_SHIFT.z },
  { x: -435 + MIRROR_SHIFT.x, z: -2338 + MIRROR_SHIFT.z },
] as const;
export const MIRROR_STAR_MASK = (1 << MIRROR_STARS.length) - 1;
export const MIRROR_BOWL = { x: -458 + MIRROR_SHIFT.x, z: -2293 + MIRROR_SHIFT.z } as const;
/** A slightly crooked kite above the far jetty: top, right, long lower point, left. */
export const MIRROR_CONSTELLATION = [
  { x: -345.2 + MIRROR_SHIFT.x, z: -2336.2 + MIRROR_SHIFT.z, rise: 22 },
  { x: -341.3 + MIRROR_SHIFT.x, z: -2326.9 + MIRROR_SHIFT.z, rise: 11 },
  { x: -347.2 + MIRROR_SHIFT.x, z: -2340.8 + MIRROR_SHIFT.z, rise: -6 },
  { x: -350.3 + MIRROR_SHIFT.x, z: -2348.1 + MIRROR_SHIFT.z, rise: 10 },
] as const;

export function mirrorWater(x: number, z: number): number {
  const t = Math.max(0, Math.min(1, (Math.hypot(x - SKY_MIRROR.x, z - SKY_MIRROR.z) - tuning.skyMirror.waterInner)
    / (tuning.skyMirror.waterOuter - tuning.skyMirror.waterInner)));
  return 1 - t * t * (3 - 2 * t);
}

export function mirrorBed(x: number, z: number): number {
  const r = Math.hypot((x - SKY_MIRROR.x) / SKY_MIRROR.rx, (z - SKY_MIRROR.z) / SKY_MIRROR.rz);
  const t = Math.max(0, Math.min(1, (r - 0.72) / 0.48));
  return -0.025 - 11 * t * t * (3 - 2 * t);
}

export const MIRROR_LAYOUT_GLSL = /* glsl */ `
float mirrorBed(vec2 p) {
  float r = length((p - vec2(${glsl(SKY_MIRROR.x)}, ${glsl(SKY_MIRROR.z)})) / vec2(${glsl(SKY_MIRROR.rx)}, ${glsl(SKY_MIRROR.rz)}));
  return -0.025 - 11.0 * smoothstep(0.72, 1.2, r);
}
float mirrorWater(vec2 p) {
  return 1.0 - smoothstep(${glsl(tuning.skyMirror.waterInner)}, ${glsl(tuning.skyMirror.waterOuter)}, length(p - vec2(${glsl(SKY_MIRROR.x)}, ${glsl(SKY_MIRROR.z)})));
}
`;

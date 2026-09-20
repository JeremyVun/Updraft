import { glsl } from '../tuning';

/** A sandbank just beneath the sea, well west of home. Nothing rises above the reflected horizon. */
export const SKY_MIRROR = { x: -455, z: -2310, rx: 82, rz: 70 } as const;
/** Moor offshore, alongside a wooden walk that reaches the submerged flat. */
export const MIRROR_ENTRY_DECK = { x0: -514.12, z0: -2268.87, x1: -501, z1: -2278, halfWidth: 1.15, height: 0.28, stepOffDepth: -0.04 };
export const MIRROR_LANDING = { x: -515.66, z: -2271.09, yaw: Math.atan2(13.12,-9.13) } as const;
export const MIRROR_WATCH = { x: -454, z: -2281 } as const;
/** Legacy causeway stops, retained for existing checkpoint and route tooling. */
export const MIRROR_PATH = [
  { x: -455, z: -2274 }, { x: -458, z: -2297 },
  { x: -436, z: -2320 }, { x: -406, z: -2323 },
] as const;
export const MIRROR_BERTH = { x: -390, z: -2323, yaw: Math.PI } as const;
export const MIRROR_DECK = { x0: -407, z0: -2323, x1: -391, z1: -2323, halfWidth: 1.15, height: 0.22 };
/** The empty hull drifts through the deep channel, never over the walkable mirror. */
export const MIRROR_DRIFT = [
  { x: -532, z: -2259 }, { x: -533, z: -2215 }, { x: -403, z: -2206 },
  { x: -354, z: -2260 }, { x: -350, z: -2319 }, MIRROR_BERTH,
] as const;

/** A handful of fallen lights, all on the existing shallow flat. Order is the player's choice. */
export const MIRROR_STARS = [
  { x: -457, z: -2304 }, { x: -438, z: -2317 }, { x: -458, z: -2333 },
] as const;
export const MIRROR_BOWL = { x: -458, z: -2293 } as const;
/** Seen above the far jetty from the flat: a low, three-point constellation. */
export const MIRROR_CONSTELLATION = [
  { x: -354, z: -2357, rise: 0 }, { x: -346, z: -2338, rise: 5 }, { x: -338, z: -2319, rise: 0 },
] as const;

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
  return 1.0 - smoothstep(125.0, 260.0, length(p - vec2(${glsl(SKY_MIRROR.x)}, ${glsl(SKY_MIRROR.z)})));
}
`;

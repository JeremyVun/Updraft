import { glsl, tuning } from '../tuning';

function ease(a: number, b: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A fixed, broad disturbance: increasing the wave can never turn earned colour grey again. */
export function musicDistance(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const folds = Math.sin(x * 0.055 + z * 0.035) * 0.58
    + Math.sin(x * 0.11 - z * 0.065) * 0.28 + Math.sin(x * 0.035 - z * 0.14) * 0.14;
  return r + ease(13, 70, r) * tuning.piano.growthRoughness * folds;
}

export function musicLife(x: number, z: number, radius: number, soft: number): number {
  if (radius < 0) return 0;
  const feather = soft + ease(13, 70, radius) * tuning.piano.growthSoftness;
  return Math.max(0, Math.min(1, (radius - musicDistance(x, z)) / feather));
}

/** Find the same irregular front for the visible music and the wind that bends the grass. */
export function musicFront(radius: number, angle: number): number {
  let lo = Math.max(0, radius - tuning.piano.growthRoughness), hi = radius + tuning.piano.growthRoughness;
  const x = Math.sin(angle), z = -Math.cos(angle);
  for (let i = 0; i < 10; i++) {
    const r = (lo + hi) * 0.5;
    if (musicDistance(x * r, z * r) < radius) lo = r;
    else hi = r;
  }
  return (lo + hi) * 0.5;
}

/** Mirrors musicLife. Avoid trigonometry outside the narrow band of changing colour. */
export const MUSIC_GROWTH_GLSL = /* glsl */ `
float musicLife(vec2 p, float radius, float soft) {
  if (radius < 0.0) return 0.0;
  float r = length(p);
  float feather = soft + smoothstep(13.0, 70.0, radius) * ${glsl(tuning.piano.growthSoftness)};
  if (r < radius - feather - ${glsl(tuning.piano.growthRoughness)}) return 1.0;
  if (r > radius + ${glsl(tuning.piano.growthRoughness)}) return 0.0;
  float folds = sin(p.x * 0.055 + p.y * 0.035) * 0.58
    + sin(p.x * 0.11 - p.y * 0.065) * 0.28 + sin(p.x * 0.035 - p.y * 0.14) * 0.14;
  float d = r + smoothstep(13.0, 70.0, r) * ${glsl(tuning.piano.growthRoughness)} * folds;
  return clamp((radius - d) / feather, 0.0, 1.0);
}`;

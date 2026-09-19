import { glsl, tuning } from '../tuning';

/** Shared by the ground, water, fleet and bank walkers. Positive s travels toward the far shore. */
export const LITTLE_BOATS = { x: 350, z: -590, rx: 48, rz: 70, startZ: -548, length: 101 } as const;
export const BOATS_LANDING = { x: 367, z: -536 };
export const BOATS_BERTH = { x: 353, z: -652 };
export function boatsX(s: number): number {
  return LITTLE_BOATS.x + 7 * Math.sin(s * 0.087) - 3;
}
/** Follow the outlet into deep water, then make a broad rightward turn away from the island. */
export function boatsCourse(s: number, out: { x: number; z: number; yaw: number }): void {
  if (s <= 107) {
    out.x = boatsX(s);
    out.z = LITTLE_BOATS.startZ - s;
    out.yaw = Math.atan2(0.609 * Math.cos(s * 0.087), -1);
    return;
  }
  const d = s - 107,
    turn = 24,
    t = Math.min(1, d / turn);
  const blend = t * t * (3 - 2 * t);
  const integral = turn * (t * t * t - 0.5 * t * t * t * t) + Math.max(0, d - turn);
  const dx = 0.609 * Math.cos(107 * 0.087);
  out.x = boatsX(107) + dx * d + (1 - dx) * integral;
  out.z = LITTLE_BOATS.startZ - 107 - d + 0.7 * integral;
  out.yaw = Math.atan2(dx + (1 - dx) * blend, -1 + 0.7 * blend);
}
export function boatsWidth(s: number): number {
  return (
    2.1 +
    5.3 * Math.exp(-(((s - 12) / 11) ** 2)) +
    5.7 * Math.exp(-(((s - 46) / 12) ** 2)) +
    6 * Math.exp(-(((s - 79) / 12) ** 2))
  );
}
export function boatsLevel(s: number): number {
  const t = Math.max(0, Math.min(1, (s - 83) / 24));
  return 2.1 * (1 - t * t * (3 - 2 * t));
}
export function boatsOut(x: number, z: number): number {
  const s = LITTLE_BOATS.startZ - z;
  const t = Math.max(0, Math.min(107, s));
  return Math.hypot((x - boatsX(t)) / boatsWidth(t), Math.max(0, -s, s - 107) / 5);
}
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** The sea rises into the sheltered stream. Both the renderer and floating toys use this surface. */
export function boatsWaterBase(x: number, z: number): number {
  if (Math.abs(x - LITTLE_BOATS.x) > 65 || Math.abs(z - LITTLE_BOATS.z) > 85) return 0;
  return boatsLevel(LITTLE_BOATS.startZ - z) * (1 - smooth(1.2, 1.65, boatsOut(x, z)));
}
export function boatsRipple(x: number, z: number, time: number): number {
  if (Math.abs(x - LITTLE_BOATS.x) > 65 || Math.abs(z - LITTLE_BOATS.z) > 85) return 0;
  const s = LITTLE_BOATS.startZ - z;
  const shelter = (1 - smooth(0.7, 1.2, boatsOut(x, z))) * (1 - smooth(92, 107, s));
  return (
    shelter *
    tuning.littleBoats.rippleHeight *
    (Math.sin(x * 0.72 + z * 0.43 - time * 1.65) + 0.45 * Math.sin(x * 1.13 - z * 0.61 - time * 2.2))
  );
}
export function boatsWaterHeight(x: number, z: number, time: number): number {
  return boatsWaterBase(x, z) + boatsRipple(x, z, time);
}
/** Keep the stranded toy visible on a small bare patch beside the pool. */
export function boatsToyClearing(x: number, z: number): number {
  return smooth(0.8, 1.6, Math.hypot(x - boatsX(3) - boatsWidth(3) - 0.45, z - LITTLE_BOATS.startZ + 3));
}
export const LITTLE_BOATS_GLSL = /* glsl */ `
float boatsX(float s) { return ${glsl(LITTLE_BOATS.x - 3)} + 7.0 * sin(s * 0.087); }
float boatsWidth(float s) { return 2.1 + 5.3 * exp(-pow((s - 12.0) / 11.0, 2.0)) + 5.7 * exp(-pow((s - 46.0) / 12.0, 2.0)) + 6.0 * exp(-pow((s - 79.0) / 12.0, 2.0)); }
float boatsLevel(float s) { return 2.1 * (1.0 - smoothstep(83.0, 107.0, s)); }
float boatsOut(vec2 p) {
  float s = ${glsl(LITTLE_BOATS.startZ)} - p.y;
  float t = clamp(s, 0.0, 107.0);
  return length(vec2((p.x - boatsX(t)) / boatsWidth(t), max(0.0, max(-s, s - 107.0)) / 5.0));
}
float boatsWaterBase(vec2 p) {
  if (abs(p.x - ${glsl(LITTLE_BOATS.x)}) > 65.0 || abs(p.y - ${glsl(LITTLE_BOATS.z)}) > 85.0) return 0.0;
  return boatsLevel(${glsl(LITTLE_BOATS.startZ)} - p.y) * (1.0 - smoothstep(1.2, 1.65, boatsOut(p)));
}
float boatsRipple(vec2 p, float time) {
  if (abs(p.x - ${glsl(LITTLE_BOATS.x)}) > 65.0 || abs(p.y - ${glsl(LITTLE_BOATS.z)}) > 85.0) return 0.0;
  float s = ${glsl(LITTLE_BOATS.startZ)} - p.y;
  float shelter = (1.0 - smoothstep(0.7, 1.2, boatsOut(p))) * (1.0 - smoothstep(92.0, 107.0, s));
  return shelter * ${glsl(tuning.littleBoats.rippleHeight)} *
    (sin(p.x * 0.72 + p.y * 0.43 - time * 1.65) + 0.45 * sin(p.x * 1.13 - p.y * 0.61 - time * 2.2));
}
float boatsDry(vec2 p, float h) {
  if (abs(p.x - ${glsl(LITTLE_BOATS.x)}) > 65.0 || abs(p.y - ${glsl(LITTLE_BOATS.z)}) > 85.0) return 1.0;
  float clearing = smoothstep(0.8, 1.6, length(p - vec2(boatsX(3.0) + boatsWidth(3.0) + 0.45, ${glsl(LITTLE_BOATS.startZ - 3)})));
  return clearing * mix(1.0, smoothstep(boatsLevel(${glsl(LITTLE_BOATS.startZ)} - p.y) + 0.05, boatsLevel(${glsl(LITTLE_BOATS.startZ)} - p.y) + 0.3, h), 1.0 - smoothstep(0.9, 1.2, boatsOut(p)));
}
`;

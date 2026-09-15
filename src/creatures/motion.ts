import * as THREE from 'three';

export function ease(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function easeAngle(current: number, target: number, rate: number, dt: number): number {
  return current + wrapAngle(target - current) * (1 - Math.exp(-rate * dt));
}

/** A damped spring for floppy secondary motion (ears, tails). */
export class Spring {
  value = 0;
  velocity = 0;

  step(target: number, stiffness: number, damping: number, dt: number): number {
    this.velocity += (stiffness * (target - this.value) - damping * this.velocity) * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
}

export type Rng = () => number;

export const range = (rand: Rng, lo: number, hi: number) => lo + (hi - lo) * rand();

const projected = new THREE.Vector3();

/**
 * How squarely a pointer stroke from `a` to `b` (normalised device coordinates) passes over `pos` on screen, 0..1.
 * Flying creatures are pushed by what the player sees, like the glider.
 */
export function screenBrush(camera: THREE.Camera, pos: THREE.Vector3, a: THREE.Vector2, b: THREE.Vector2, radius: number): number {
  const s = projected.copy(pos).project(camera);
  if (s.z > 1) return 0;
  const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1;
  const px = s.x * aspect;
  const ax = a.x * aspect;
  const abx = b.x * aspect - ax;
  const aby = b.y - a.y;
  const t = THREE.MathUtils.clamp(((px - ax) * abx + (s.y - a.y) * aby) / Math.max(abx * abx + aby * aby, 1e-6), 0, 1);
  const d = Math.hypot(px - (ax + abx * t), s.y - (a.y + aby * t));
  return d < radius ? (1 - d / radius) ** 2 : 0;
}

/** Screen x of a world point, -1..1, for panning sounds. */
export function screenPan(camera: THREE.Camera, pos: THREE.Vector3): number {
  return THREE.MathUtils.clamp(projected.copy(pos).project(camera).x, -1, 1);
}

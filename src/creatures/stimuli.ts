import type * as THREE from 'three';
import type { PointerInput } from '../input/pointer';
import type { WindField, WindSample } from '../wind/field';
import type { Voices } from './voices';

/** What every species senses this frame. */
export interface Stimuli {
  wind: WindField;
  /** Scratch sample for wind lookups. */
  sample: WindSample;
  camera: THREE.Camera;
  input: PointerInput;
  /** Where a player gust is sweeping the ground this frame. */
  gustAt: THREE.Vector3 | null;
  /** The player's updraft: centre and strength 0..1, lingering briefly after release. */
  updraft: { x: number; z: number; strength: number };
  glider: THREE.Vector3 | null;
  /** The travelling child, whom ground animals keep a wary distance from. */
  walker: THREE.Vector3 | null;
  /** How alive the world is at (x, z): 0 grey and still, 1 restored. Creatures only appear where it has come back. */
  life(x: number, z: number): number;
  /** The prevailing breeze, 0 still to 1 blowing. */
  breeze: number;
  voices: Voices;
}

/** Creatures farther than this from the camera are neither simulated nor drawn. */
export const DORMANT_RANGE = 320;

export function dormant(s: Stimuli, x: number, z: number): boolean {
  const c = s.camera.position;
  return (x - c.x) ** 2 + (z - c.z) ** 2 > DORMANT_RANGE * DORMANT_RANGE;
}

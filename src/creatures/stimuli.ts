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
  voices: Voices;
}

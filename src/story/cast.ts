import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Glider } from '../glider/glider';
import type { PointerInput } from '../input/pointer';
import type { Crane } from '../creatures/crane';
import type { CraneFlock } from '../creatures/flock';
import type { Boat } from '../traveller/boat';
import type { SeaLife } from '../fx/sealife';
import type { Drawing } from '../traveller/drawing';
import type { Traveller } from '../traveller/traveller';
import type { WindField } from '../wind/field';
import type { Cottage } from '../world/cottage';
import type { LifeField } from '../world/life';
import type { Tree } from '../world/tree';

/** Everyone and everything the story directs. */
export interface Cast {
  child: Traveller;
  plane: Glider;
  boat: Boat;
  wind: WindField;
  input: PointerInput;
  life: LifeField;
  tree: Tree;
  drawing: Drawing;
  cottage: Cottage;
  sealife: SeaLife;
  /** The crane colt that cannot keep up with its flock, and the flock that goes on without it. */
  crane: Crane;
  flock: CraneFlock;
  /** The nearest animal worth a glance within `radius` of (x, z), written into `out`. */
  nearby(x: number, z: number, radius: number, out: THREE.Vector3): boolean;
}

/** What a chapter tells the rest of the game each frame. */
export interface Chapter {
  readonly shot: Shot;
  /** How much of the prevailing breeze is blowing, 0..1. */
  readonly breeze: number;
  /** How alive the world feels, 0 (still, grey) to 1 (golden). */
  readonly worldLife: number;
  /** Time of day: 0 golden afternoon, 1 sunset, 2 night. */
  readonly dusk: number;
  /** How fast the camera glides toward the shot. */
  readonly pace: number;
  /** Where the camera's attention is, for things like sound. */
  readonly focus: THREE.Vector3;
  readonly done: boolean;
  /** A passing shower, 0 dry to 1. */
  readonly shower?: number;
  /** Haze thick enough to hide what is ahead, 0 to 1. */
  readonly haze?: number;
  /** How far the music pulls back, so a moment can be heard on its own. */
  readonly hush?: number;
  /** True while the story is playing a beat out on its own: the player's gestures move the world but drive nothing. */
  readonly scripted?: boolean;
  /** How strongly a rainbow shows opposite the sun, 0..1. */
  readonly rainbow?: number;
  /** Where the gulls should circle, or null to leave them to their own coast. */
  readonly escort?: THREE.Vector3 | null;
  update(dt: number, time: number): void;
}

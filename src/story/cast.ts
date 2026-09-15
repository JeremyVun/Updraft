import type * as THREE from 'three';
import type { Shot } from '../camera';
import type { Glider } from '../glider/glider';
import type { PointerInput } from '../input/pointer';
import type { Boat } from '../traveller/boat';
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
  update(dt: number, time: number): void;
}

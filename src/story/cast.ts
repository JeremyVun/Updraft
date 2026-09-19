import * as THREE from 'three';
import type { Mood } from '../audio/audio';
import type { Shot } from '../camera';
import type { Glider } from '../glider/glider';
import type { PointerInput } from '../input/pointer';
import type { Carry } from '../companion/carry';
import type { Cygnet } from '../creatures/cygnet';
import type { Embers } from '../fx/embers';
import type { Coax } from '../fx/swirl';
import type { SwanFlock } from '../creatures/flock';
import type { Boat } from '../traveller/boat';
import type { SeaLife } from '../fx/sealife';
import type { Drawing } from '../traveller/drawing';
import type { Traveller } from '../traveller/traveller';
import type { WindField } from '../wind/field';
import type { AutumnBirches } from '../world/birches';
import type { SleepingIsland } from '../world/sleeping';
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
  /** The cygnet that cannot keep up with its flock, and the flock that goes on without it. */
  cygnet: Cygnet;
  flock: SwanFlock;
  /** Everything the two of them do with their hands on each other: gathering up, holding, setting down, the satchel. */
  carry: Carry;
  /** The embers in the leaf litter of the dark wood: the only light the player can make there. */
  embers: Embers;
  /** The island of gold birches, its leaves and the swing hanging on the crest. */
  birches: AutumnBirches;
  /** The bed in the hollow, the bedroom round it, and the fog the player's gusts carve lanes in. */
  sleeping: SleepingIsland;
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
  /** Which room's music this chapter is played to. */
  readonly music?: Mood;
  /** How far through the turn of the year this room is, 0 late autumn to 1 the frozen night. It only rises. */
  readonly season?: number;
  /** True while the story is playing a beat out on its own: the player's gestures move the world but drive nothing. */
  readonly scripted?: boolean;
  /** How strongly a rainbow shows opposite the sun, 0..1. */
  readonly rainbow?: number;
  /** The winter storm, 0 calm to 1: how hard the trees and the village are being worked over. */
  readonly storm?: number;
  /** A patch of grass to press flat so something small in it can be seen: centre (x, z) and radius. */
  readonly trodden?: THREE.Vector3 | null;
  /** How awake the embers in the leaf litter are, 0 none to 1: the only light in the dark wood. */
  readonly embers?: number;
  /** Where the gulls should circle, or null to leave them to their own coast. */
  readonly escort?: THREE.Vector3 | null;
  /** Where the chapter is waiting for the player to twirl up an updraft, so the wind shows the gesture there. */
  readonly coax?: Coax | null;
  /** True while the story is waiting for the player to put wind under the cygnet: there a plain gust counts as lift. */
  readonly invitesFlight?: boolean;
  /** True once the music has been cut for good and only the world is left to hear. */
  readonly silence?: boolean;
  /** True once the story is over and the credits may roll. */
  readonly finished?: boolean;
  update(dt: number, time: number): void;
}

import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { piano } from '../world/piano';
import type { Cast } from './cast';

type Beat = 'ahead' | 'walking' | 'looking' | 'sitting' | 'seated' | 'leaving' | 'done';

/** How near the child has to come before they notice it, and how far past it they can get before it is missed. */
const NOTICE = 15;
const GIVE_UP = 95;
/** Nothing in this stop may hold the walk up for longer than this, whatever goes wrong with a leg of it. */
const PATIENCE = 22;
/** How long they take to lower themselves onto the stool. */
const SIT_FOR = 0.7;

/**
 * The stop at the piano on the meadow. The plane leans toward it like any other waypoint, and if the child comes
 * near they stop, look at it, sit down on the stool and press one key — and then sit with their hands in their lap
 * and listen for as long as the player keeps playing. Nothing is gated on any of it: they walk on after a little
 * quiet, or after a while whatever happens, and a player who leads them straight past never finds out it was there.
 */
export class PianoStop {
  private beat: Beat = 'ahead';
  private since = 0;
  private now = 0;
  private pressAt = 0;
  private noteAt = 0;
  private hushed = 0;
  private fromYaw = 0;
  private readonly aim = new THREE.Vector2(piano.stand.x, piano.stand.z);
  private readonly from = new THREE.Vector3();
  private readonly onto = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  /** Round to the sunward side of the piano's front, so the case is rimmed and the child is in profile. */
  private readonly side = new THREE.Vector3(Math.sin(piano.yaw + 0.55), 0, Math.cos(piano.yaw + 0.55));

  /** The music pulls back while they are at it, so what the wind is playing is what you hear. */
  get hush(): number {
    return this.hushed;
  }

  /** The plane is the signpost: while the piano is still ahead of them, it leans that way instead. */
  waypoint(next: THREE.Vector2, child: THREE.Vector3): THREE.Vector2 {
    if (this.beat === 'done') return next;
    /** Once they are past it, or well west of it and on their way up the walk, the stop is behind them. */
    const past = child.z < piano.keys.z - 12 || child.x < piano.keys.x - 20;
    if (past || Math.hypot(child.x - piano.keys.x, child.z - piano.keys.z) > GIVE_UP) {
      this.beat = 'done';
      return next;
    }
    return this.beat === 'ahead' ? this.aim : next;
  }

  /** Runs the stop. True while it has the child, and the walk waits for it. */
  hold(dt: number, time: number, cast: Cast): boolean {
    this.now = time;
    const c = cast.child;
    this.hushed += ((this.beat === 'seated' ? tuning.piano.hush : 0) - this.hushed) * (1 - Math.exp(-dt * 0.8));

    switch (this.beat) {
      case 'ahead':
        if (Math.hypot(c.position.x - piano.stand.x, c.position.z - piano.stand.z) < NOTICE) {
          c.stop();
          c.walkTo(piano.stand.x, piano.stand.z, false, () => this.to('looking'), 0.7);
          this.to('walking');
        }
        break;
      case 'walking':
        c.lookAt = piano.keys;
        /** If anything at all keeps them from reaching it, the stop is simply missed. Nobody is stranded here. */
        if (this.t > PATIENCE) this.give(c);
        break;
      case 'looking':
        c.lookAt = piano.keys;
        c.faceToward(piano.keys.x, piano.keys.z, Math.min(1, dt * 4));
        if (this.t > 1.9) {
          this.from.copy(c.position);
          this.fromYaw = c.yaw;
          this.to('sitting');
        }
        break;
      case 'sitting': {
        /** Lowered onto the stool rather than put on it: the sitting pose folds up as they go down. */
        const k = THREE.MathUtils.smoothstep(this.t / SIT_FOR, 0, 1);
        const want = Math.atan2(piano.keys.x - piano.seat.x, piano.keys.z - piano.seat.z);
        c.ride(this.onto.lerpVectors(this.from, piano.seat, k), this.fromYaw + shortest(want - this.fromYaw) * k);
        c.lookAt = piano.keys;
        if (this.t >= SIT_FOR) {
          this.to('seated');
          this.pressAt = time + 0.55;
        }
        break;
      }
      case 'seated': {
        c.lookAt = piano.keys;
        /** One key, pressed with a finger: the only note in this room nobody had to be the wind for. */
        if (this.pressAt > 0 && time > this.pressAt) {
          this.pressAt = 0;
          this.noteAt = time + 0.4;
          c.pickUp(() => undefined);
        }
        if (this.noteAt > 0 && time > this.noteAt) {
          this.noteAt = 0;
          piano.press();
        }
        const heard = Math.max(this.since + 2, piano.lastGestureNote);
        if (time - heard > tuning.piano.listenFor || this.t > tuning.piano.stayFor) {
          c.dismount();
          c.walkTo(piano.stand.x, piano.stand.z, false, () => this.give(c), 1);
          this.to('leaving');
        }
        break;
      }
      case 'leaving':
        if (this.t > PATIENCE) this.give(c);
        break;
      default:
        break;
    }
    return this.beat !== 'ahead' && this.beat !== 'done';
  }

  /**
   * The camera goes round to one side of the piano — square on, the child sits with their back to you and their
   * head is in front of the keyboard — and stays where the rest of the game stands: back far enough and low
   * enough that the two of them are small in the grass with the hills and the low sun behind them.
   */
  frame(shot: Shot): void {
    if (this.beat === 'ahead' || this.beat === 'done') return;
    const near = this.beat !== 'walking';
    this.mid.lerpVectors(piano.keys, piano.seat, 0.3);
    shot.target.set(this.mid.x, piano.keys.y + 0.3, this.mid.z);
    shot.from = this.side;
    shot.distance = near ? 15 : 20;
    shot.height = near ? 2.8 : 5;
  }

  private give(child: Cast['child']): void {
    child.stop();
    child.lookAt = null;
    this.to('done');
  }

  private get t(): number {
    return this.now - this.since;
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.since = this.now;
  }
}

function shortest(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { piano } from '../world/piano';
import type { Cast } from './cast';

type Beat = 'ahead' | 'walking' | 'looking' | 'sitting' | 'seated' | 'leaving' | 'done';

/**
 * How far the island has woken: one for the hollow round the piano, two out to the crest, three for all of it. The
 * third comes with the whole lullaby, whether the player found it or the piano played it to itself.
 */
export type Waking = 1 | 2 | 3;

/** How near the child has to come before they notice it, and how far past it they can get before it is missed. */
const NOTICE = 15;
const GIVE_UP = 95;
/** Nothing in this stop may hold the walk up for longer than this, whatever goes wrong with a leg of it. */
const PATIENCE = 22;
/** How long they take to lower themselves onto the stool. */
const SIT_FOR = 0.7;

/**
 * The lullaby, in steps of the meadow's scale up from a low note. The piano says a phrase; the player answers by
 * sweeping the wind along the keys the way the phrase went, once for each part of it; the piano goes on to the
 * next. Rising, falling, then over the top and home.
 */
const LULLABY: number[][][] = [
  [[0, 1, 2, 4]],
  [[5, 4, 2, 1]],
  [[0, 2, 4, 5], [4, 2, 1, 0]],
];
const CADENCE = [0, 2, 4, 7, 4, 2, 0];

/**
 * The stop at the piano on the meadow. The plane leans toward it like any other waypoint, and if the child comes
 * near they stop, look at it, sit down on the stool and press one key — and then sit with their hands in their lap
 * and listen for as long as the player keeps playing. Nothing is gated on any of it: they walk on after a little
 * quiet, or after a while whatever happens, and a player who leads them straight past never finds out it was there.
 */
export class PianoStop {
  /**
   * What the piano does to the island: the meadow hears each phrase of the lullaby and wakes a little further.
   * Whoever owns the room sets this; the stop itself only says how far the tune has got.
   */
  onWake: ((stage: Waking, answered: boolean) => void) | null = null;
  private beat: Beat = 'ahead';
  private since = 0;
  private now = 0;
  private pressAt = 0;
  private noteAt = 0;
  /** Which phrase of the lullaby they are on, which part of it the player has got to, and when the piano speaks next. */
  private phrase = 0;
  private part = 0;
  private sayAt = 0;
  private heardTo = 0;
  private said = 0;
  private finishedAt = 0;
  private answered = false;
  private hushed = 0;
  /** The cygnet's own turn at the keys: when it starts walking them, and when it is back in the arms. */
  private walkFrom = 0;
  private walkStep = 0;
  private readonly foot = new THREE.Vector3();
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
        this.duet(time, cast);
        this.onTheKeys(time, cast);
        const heard = Math.max(this.since + 2, piano.lastGestureNote);
        const over = this.finishedAt > 0 && time > this.finishedAt;
        /** Nothing may cut the finale short: the island is waking, and the bird is on the keys. */
        if (this.finishedAt > 0 && !over) break;
        if (over || time - heard > tuning.piano.listenFor || this.t > tuning.piano.stayFor) {
          piano.expect = null;
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
    /** While the bird is on the keys the camera comes in to them: at the walking distance it is a speck of white. */
    const keys = this.walkFrom !== 0 ? 1 : 0;
    this.mid.lerpVectors(piano.keys, piano.seat, 0.3 - keys * 0.25);
    shot.target.set(this.mid.x, piano.keys.y + 0.3, this.mid.z);
    shot.from = this.side;
    shot.distance = near ? 15 - keys * 5.4 : 20;
    shot.height = near ? 2.1 - keys * 0.7 : 5;
  }

  /**
   * The piano says a phrase and waits. A sweep of wind along the keys the way the phrase went plays it back, and
   * the piano goes on; anything else is just the wind on a piano, and after a while it says the phrase again.
   * Nothing is failed: a player who only listens is walked on from here like anywhere else.
   */
  private duet(time: number, cast: Cast): void {
    if (this.finishedAt > 0 || this.noteAt > 0 || this.pressAt > 0) return;
    const base = Math.floor(piano.steps * 0.3);
    const parts = LULLABY[this.phrase];
    if (this.sayAt === 0) this.sayAt = time + 1.4;

    if (piano.matched > this.heardTo) {
      this.heardTo = piano.matched;
      this.answered = true;
      this.part++;
      if (this.part >= parts.length) {
        this.phrase++;
        this.part = 0;
        this.said = 0;
        if (this.phrase >= LULLABY.length) {
          this.finish(cast, true);
          return;
        }
        /** The island answers the phrase before the piano asks the next one: the colour is the reply. */
        this.onWake?.(this.phrase as Waking, true);
        this.sayAt = time + 1.6;
      } else {
        piano.expect = parts[this.part].map((s) => base + s);
        /** Half an answer earns the time to finish it before the piano says the phrase over again. */
        this.sayAt = time + tuning.piano.sayAgain;
      }
      return;
    }

    /**
     * Nothing here is gated. A player who only listens is played the whole tune anyway, once the piano has asked
     * often enough, and the island wakes on it more quietly than it would have done for them.
     */
    if (this.said >= tuning.piano.saysTwice || (!this.answered && this.t > tuning.piano.listenFor * 0.7)) {
      this.finish(cast, false);
      return;
    }

    if (time > this.sayAt) {
      this.part = 0;
      this.said++;
      const said = parts.flat().map((s) => base + s);
      const ends = piano.phrase(said, tuning.piano.phraseSpacing);
      piano.expect = parts[0].map((s) => base + s);
      this.heardTo = piano.matched;
      this.sayAt = ends + tuning.piano.sayAgain;
    }
  }

  /**
   * The whole lullaby, from the top, played by the piano itself: the tune they have been finding was there the
   * whole time. The island wakes all the way on it, and the cygnet climbs out onto the keys to help.
   */
  private finish(cast: Cast, answered: boolean): void {
    const base = Math.floor(piano.steps * 0.3);
    piano.expect = null;
    this.answered = answered;
    const whole = [...LULLABY.flat(2), ...CADENCE].map((s) => base + s);
    const ends = piano.phrase(whole, tuning.piano.phraseSpacing * (answered ? 0.8 : 0.95), answered ? 0.42 : 0.3);
    this.finishedAt = ends + tuning.piano.walkKeys * 0.4 + 3.4;
    if (answered) cast.child.cheer();
    this.onWake?.(3, answered);
    /** Out of the satchel first, because from there it can reach the keys without anybody lifting it. */
    this.walkFrom = -1;
    cast.carry.unstow(() => {
      this.walkFrom = this.now;
      this.walkStep = 0;
      piano.walkKeys(piano.noteAlong(tuning.piano.walkFrom), piano.noteAlong(tuning.piano.walkTo), tuning.piano.walkKeys);
    });
  }

  /**
   * The cygnet walks the keyboard, one plink a step, while the piano plays the rest of the tune around it. It is
   * the only thing in the game that makes music with its feet, and neither of them says a word about it.
   */
  private onTheKeys(time: number, cast: Cast): void {
    if (this.walkFrom <= 0) return;
    const { walkKeys, walkFrom, walkTo } = tuning.piano;
    const k = (time - this.walkFrom) / walkKeys;
    const { cygnet, child } = cast;
    if (k < 1) {
      const t = walkFrom + (walkTo - walkFrom) * k;
      piano.alongKeys(t, this.foot);
      /** A step of its own: it bobs as it goes, so it is walking the keys and not sliding along them. */
      this.foot.y += Math.max(0, Math.sin(k * walkKeys * 2.6)) * 0.035;
      cygnet.perch(this.foot, piano.alongYaw + Math.sin(k * walkKeys * 1.3) * 0.22);
      child.lookAt = cygnet.eye(this.onto);
      return;
    }
    if (this.walkStep === 0) {
      this.walkStep = 1;
      cygnet.rideIn('cradle');
      cygnet.bind(0.12);
      child.lookAt = cygnet.eye(this.onto);
    } else if (this.walkStep === 1 && time - this.walkFrom > walkKeys + 1.4 && !cast.carry.busy) {
      this.walkStep = 2;
      this.walkFrom = 0;
      child.lookAt = piano.keys;
      cast.carry.stow();
    }
  }

  private give(child: Cast['child']): void {
    piano.expect = null;
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

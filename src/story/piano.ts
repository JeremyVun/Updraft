import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { piano } from '../world/piano';
import type { Cast } from './cast';

type Beat = 'ahead' | 'walking' | 'looking' | 'sitting' | 'seated' | 'leaving' | 'done';

/**
 * Each mirrored sweep wakes a wider stretch of the meadow. The fourth sends the whole lullaby across the island.
 */
export type Waking = 1 | 2 | 3 | 4;

/** How near the child has to come before they notice it, and how far past it they can get before it is missed. */
const NOTICE = 26;
/** They are level with it and still walking: near enough, they go over to it rather than leave it behind. */
const PASSING = 60;
/** Recovery limit for stepping away from the stool after the completed tune. */
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


/** The child and wind play the meadow awake. The invitation waits; only a traced answer advances it. */
export class PianoStop {
  /**
   * What the piano does to the island: the meadow hears each phrase of the lullaby and wakes a little further.
   * Whoever owns the room sets this; the stop itself only says how far the tune has got.
   */
  onWake: ((stage: Waking, answered: boolean) => void) | null = null;
  /** Completion is heard after the final melody, while its colour front keeps travelling. */
  onComplete: (() => void) | null = null;
  private completeAt = 0;
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
  private finishedAt = 0;
  private answered = false;
  private hushed = 0;
  private hushProgress = 0;
  /** The cygnet's own turn at the keys: when it starts walking them, and when it is back in the arms. */
  private walkFrom = 0;
  private walkStep = 0;
  /** When the island is told to wake all the way, at the latest, and when the camera began its one long rise. */
  private wakeAt = 0;
  private roseFrom = 0;
  private responseAt = -1;
  private readonly foot = new THREE.Vector3();
  private fromYaw = 0;
  private readonly aim = new THREE.Vector2(piano.stand.x, piano.stand.z);
  private readonly from = new THREE.Vector3();
  private readonly onto = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly hands = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly approachChild = new THREE.Vector3();
  private readonly approachFrame = { primary: this.approachChild, secondary: piano.keys,
    margin: tuning.piano.approachMargin, extra: tuning.piano.approachExtra };

  /** QA: how far the stop has got, from noticing it to walking on. */
  get at(): string {
    return this.beat;
  }

  /** A checkpoint beyond the stop never replays or re-scores the puzzle. */
  restoreDone(): void { this.beat = 'done'; this.completeAt = 0; this.hushed = this.hushProgress = 0; piano.expect = null; piano.engaged = false; piano.finale = false; }

  /** The music pulls back while they are at it, so what the wind is playing is what you hear. */
  get hush(): number {
    return this.hushed;
  }

  /** The plane is the signpost: while the piano is still ahead of them, it leans that way instead. */
  waypoint(next: THREE.Vector2): THREE.Vector2 {
    if (this.beat === 'done') return next;
    return this.aim;
  }

  /** Runs the stop. True while it has the child, and the walk waits for it. */
  hold(dt: number, time: number, cast: Cast): boolean {
    this.now = time;
    const c = cast.child;
    this.approachChild.copy(c.position).y += 1.2;
    piano.engaged = this.beat !== 'ahead' && this.beat !== 'done';
    // Ownership starts on approach, but music stays with the walk and the first look at the keys.
    const playing = this.beat === 'sitting' || this.beat === 'seated' || this.beat === 'leaving';
    this.hushProgress = THREE.MathUtils.clamp(this.hushProgress + dt
      * (playing ? 1 / tuning.piano.fadeOut : -1 / tuning.piano.fadeIn), 0, 1);
    this.hushed = tuning.piano.hush * THREE.MathUtils.smoothstep(this.hushProgress, 0, 1);

    switch (this.beat) {
      case 'ahead': {
        /** The walk follows the plane, not the waypoints, so it can wander by: level with the piano they go to it. */
        const gap = Math.hypot(c.position.x - piano.stand.x, c.position.z - piano.stand.z);
        if (gap < NOTICE || (gap < PASSING && c.position.z < piano.keys.z + 8)) {
          c.stop();
          c.stowPlane(true);
          cast.plane.hold(c);
          c.walkTo(piano.stand.x, piano.stand.z, false, () => this.to('looking'), 0.7);
          this.to('walking');
        }
        break;
      }
      case 'walking':
        c.lookAt = piano.keys;
        /** Retry an interrupted approach; walking around the piano cannot complete the duet. */
        if (!c.moving && !c.acting) c.walkTo(piano.stand.x, piano.stand.z, false, () => this.to('looking'), 0.7);
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
          this.playHands(time, cast);
        }
        if (this.noteAt > 0 && time > this.noteAt) {
          this.noteAt = 0;
          piano.press();
        }
        this.playHands(time, cast);
        this.duet(time, cast);
        this.onTheKeys(time, cast);
        this.wakeIsland(time);
        const over = this.finishedAt > 0 && time > this.finishedAt;
        if (over) {
          this.releaseHands(cast);
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

  /** A steady view over the keys into falling ground; one gentle widening follows the final phrase. */
  frame(shot: Shot): number | null {
    if (this.beat === 'ahead' || this.beat === 'done') return null;
    const t = tuning.piano;
    /** It waits further out while they are still on their way to it and comes in as they sit: one move, not two. */
    const settled = this.beat === 'walking' || this.beat === 'looking' ? 0 : 1;
    let bearing = piano.yaw + t.frameTurn;
    let distance = t.frameBack + t.frameWide * (1 - settled);
    let height = t.frameUp + t.frameHigh * (1 - settled);
    this.mid.set(piano.keys.x, piano.keys.y + t.frameLook, piano.keys.z - t.frameOn);
    shot.fitWidth = true;
    shot.subjects = undefined;
    if (this.beat === 'walking') {
      // Introduce the instrument with the approaching child. Looking straight at the keys too early
      // let the child leave the bottom of the frame while climbing the last slope.
      const gap = Math.hypot(this.approachChild.x - piano.stand.x, this.approachChild.z - piano.stand.z);
      this.mid.lerp(this.approachChild, THREE.MathUtils.smoothstep(gap, 4, NOTICE) * t.approachShare);
      distance += gap * t.approachBack;
      shot.subjects = this.approachFrame;
    }
    if (this.responseAt >= 0 && this.roseFrom === 0) {
      const age = this.now - this.responseAt;
      const open = THREE.MathUtils.smoothstep(age, 0, t.responseLift)
        * (1 - THREE.MathUtils.smoothstep(age, t.responseHold, t.responseReturn));
      const step = Math.min(2, this.heardTo - 1);
      distance += (t.responseBack[step] - distance) * open;
      height += (t.responseUp[step] - height) * open;
      this.mid.z -= (t.responseOn[step] - t.frameOn) * open;
    }
    if (this.roseFrom > 0) {
      /** Eased at both ends, so the rise begins and settles without a hand on it anywhere in between. */
      const k = THREE.MathUtils.smoothstep(this.now - this.roseFrom, 0, t.riseFor);
      const far = this.answered ? 1 : t.riseQuiet;
      bearing += (t.riseTo - bearing) * k;
      distance += (t.riseBack * far - distance) * k;
      height += (t.riseUp * far - height) * k;
      this.mid.z -= (t.riseOn * far - t.frameOn) * k;
    }
    shot.target.copy(this.mid);
    shot.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
    shot.distance = distance;
    shot.height = height;
    return this.roseFrom > 0 ? t.risePace : this.responseAt >= 0 && this.now - this.responseAt < t.phraseRest ? 1.3 : t.framePace;
  }

  /** Demonstrate the next sweep without spending its colour or resetting a partial answer. */
  private duet(time: number, cast: Cast): void {
    if (this.finishedAt > 0 || this.noteAt > 0 || this.pressAt > 0) return;
    const base = Math.floor(piano.steps * 0.3);
    if (this.sayAt === 0) this.sayAt = time + 1.4;
    if (piano.matched > this.heardTo) {
      this.heardTo = piano.matched;
      this.answered = true;
      this.responseAt = time;
      this.part++;
      if (this.part >= LULLABY[this.phrase].length) {
        this.phrase++;
        this.part = 0;
        if (this.phrase >= LULLABY.length) {
          this.finish(cast, true);
          return;
        }
      }
      this.onWake?.(this.heardTo as Waking, true);
      // Leave room to hear the answer and watch its colour travel before the next invitation.
      this.sayAt = time + tuning.piano.phraseRest;
      return;
    }
    if (time > this.sayAt && piano.gesture.progress === 0) {
      const notes = LULLABY[this.phrase][this.part].map(s => base + s);
      const ends = piano.phrase(notes, tuning.piano.phraseSpacing, 0.42);
      if (!piano.expect) piano.expect = notes;
      this.sayAt = ends + tuning.piano.sayAgain;
    }
  }

  private playHands(time: number, cast: Cast): void {
    if (this.walkFrom !== 0 || cast.carry.busy) return;
    const recent = Math.exp(-Math.max(0, time - piano.performedAt) * 7);
    const note = THREE.MathUtils.clamp(piano.performedKey, 0.2, 0.8);
    for (const hand of [0, 1] as const) {
      const home = hand === 0 ? 0.65 : 0.35;
      const active = (note >= 0.5 ? 0 : 1) === hand;
      piano.alongKeys(active ? home + (note - home) * recent : home, this.hands[hand]);
      this.hands[hand].y += 0.07 + (active ? 0.07 * (1 - recent) : 0.05);
      cast.child.reachFor(hand, this.hands[hand]);
    }
    cast.child.lean = 0.06;
  }

  private releaseHands(cast: Cast): void {
    cast.child.reachFor(0, null);
    cast.child.reachFor(1, null);
    cast.child.lean = 0;
  }

  /**
   * The whole lullaby, from the top, played by the piano itself: the tune they have been finding was there the
   * whole time. The island wakes all the way on it, and the cygnet climbs out onto the keys to help.
   */
  private finish(cast: Cast, answered: boolean): void {
    const base = Math.floor(piano.steps * 0.3);
    piano.expect = null;
    this.answered = answered;
    piano.finale = true;
    this.releaseHands(cast);
    const whole = [...LULLABY.flat(2), ...CADENCE].map((s) => base + s);
    const ends = piano.phrase(whole, tuning.piano.phraseSpacing * (answered ? 0.8 : 0.95), answered ? 0.52 : 0.4);
    this.completeAt = ends + tuning.piano.completionRest;
    /** The front begins while the lullaby is sounding, with the bird joining it. */
    this.wakeAt = this.now + tuning.piano.finaleWaveAfter;
    this.finishedAt = this.wakeAt + tuning.piano.riseFor + tuning.piano.restFor;
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
      child.lookAt = piano.keys;
      cast.carry.stow();
    }
  }

  /** Music, the colour front and the widening camera begin together. */
  private wakeIsland(time: number): void {
    if (this.completeAt > 0 && time >= this.completeAt) {
      this.completeAt = 0;
      this.onComplete?.();
    }
    if (this.wakeAt === 0 || time < this.wakeAt) return;
    this.wakeAt = 0;
    this.roseFrom = time;
    this.onWake?.(4, this.answered);
    this.finishedAt = time + tuning.piano.riseFor + tuning.piano.restFor;
  }

  private give(child: Cast['child']): void {
    piano.expect = null;
    piano.engaged = false;
    piano.finale = false;
    child.stowPlane(false);
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

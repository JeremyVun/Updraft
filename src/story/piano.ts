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
const NOTICE = 26;
const GIVE_UP = 190;
/** They are level with it and still walking: near enough, they go over to it rather than leave it behind. */
const PASSING = 60;
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
  /** When the island is told to wake all the way, at the latest, and when the camera began its one long rise. */
  private wakeAt = 0;
  private roseFrom = 0;
  private readonly foot = new THREE.Vector3();
  private fromYaw = 0;
  private readonly aim = new THREE.Vector2(piano.stand.x, piano.stand.z);
  private readonly from = new THREE.Vector3();
  private readonly onto = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private readonly side = new THREE.Vector3();

  /** QA: how far the stop has got, from noticing it to walking on. */
  get at(): string {
    return this.beat;
  }

  /** A checkpoint beyond the stop never replays or re-scores the puzzle. */
  restoreDone(): void { this.beat = 'done'; piano.expect = null; }

  /** The music pulls back while they are at it, so what the wind is playing is what you hear. */
  get hush(): number {
    return this.hushed;
  }

  /** The plane is the signpost: while the piano is still ahead of them, it leans that way instead. */
  waypoint(next: THREE.Vector2, child: THREE.Vector3): THREE.Vector2 {
    if (this.beat === 'done') return next;
    /** Once they are past it, or well west of it and on their way up the walk, the stop is behind them. */
    const past = child.z < piano.keys.z - 26 || child.x < piano.keys.x - 34;
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
      case 'ahead': {
        /** The walk follows the plane, not the waypoints, so it can wander by: level with the piano they go to it. */
        const gap = Math.hypot(c.position.x - piano.stand.x, c.position.z - piano.stand.z);
        if (gap < NOTICE || (gap < PASSING && c.position.z < piano.keys.z + 8)) {
          c.stop();
          c.walkTo(piano.stand.x, piano.stand.z, false, () => this.to('looking'), 0.7);
          this.to('walking');
        }
        break;
      }
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
        this.wakeIsland(time);
        const heard = Math.max(this.since + 2, piano.lastGestureNote);
        const over = this.finishedAt > 0 && time > this.finishedAt;
        /** Nothing may cut the finale short: the island is waking, and the bird is on the keys. */
        if (this.finishedAt > 0 && !over) break;
        /**
         * A player who never played anything is walked on from here like anywhere else. A player who answered
         * even once is not: they are owed the end of the tune, and the piano is on its way to playing it.
         */
        const quiet = time - heard > tuning.piano.listenFor && !this.answered;
        if (over || quiet || this.t > tuning.piano.stayFor) {
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
   * One frame for the whole duet, and one move out of it. The camera stands behind the child and a little over
   * their shoulder, near enough square on the keyboard that left and right on screen is along the keys and their
   * head is off them, high enough to see the keys past them and the meadow they are waking beyond the piano. It
   * arrives there in a single glide as they sit and does not move again until the tune is whole. Then it lifts
   * out of that frame in one slow, eased rise, spiralling round behind them and up onto the way north, and comes
   * to rest well back and mid-high, the child and the piano at the foot of the frame and the green rolling away
   * from them to the crest, toward the notch the pond lies beyond. The pond itself cannot be seen from here: it
   * is two rises and two hundred paces off, and a camera high enough to look over them would be looking down on
   * the game. Its reveal is the brow's, on the walk. Returns how fast the camera should follow, or null while the
   * stop does not own the frame.
   */
  frame(shot: Shot): number | null {
    if (this.beat === 'ahead' || this.beat === 'done') return null;
    const t = tuning.piano;
    /** It waits further out while they are still on their way to it and comes in as they sit: one move, not two. */
    const settled = this.beat === 'walking' || this.beat === 'looking' ? 0 : 1;
    /** And it creeps in while the bird is on the keys, because at the settled distance a cygnet is a speck. */
    const creep = this.walkFrom > 0 ? THREE.MathUtils.smoothstep(this.now - this.walkFrom, 0, 2.5) : 0;
    let bearing = piano.yaw + t.frameTurn;
    let distance = t.frameBack + t.frameWide * (1 - settled) - t.frameCreep * creep;
    let height = t.frameUp + t.frameHigh * (1 - settled);
    this.mid.set(piano.keys.x, piano.keys.y + t.frameLook, piano.keys.z);
    if (this.roseFrom > 0) {
      /** Eased at both ends, so the rise begins and settles without a hand on it anywhere in between. */
      const k = THREE.MathUtils.smoothstep(this.now - this.roseFrom, 0, t.riseFor);
      const far = this.answered ? 1 : t.riseQuiet;
      bearing += (t.riseTo - bearing) * k;
      distance += (t.riseBack * far - distance) * k;
      height += (t.riseUp * far - height) * k;
      this.mid.z -= t.riseOn * far * k;
    }
    shot.target.copy(this.mid);
    shot.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
    shot.distance = distance;
    shot.height = height;
    return this.roseFrom > 0 ? t.risePace : t.framePace;
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
    const waited = this.said >= tuning.piano.saysTwice || this.t > tuning.piano.stayFor - 18;
    if (waited || (!this.answered && this.t > tuning.piano.listenFor * 0.7)) {
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
    /** However the bird's turn on the keys goes, the island is woken and the child is up again by these times. */
    this.wakeAt = ends + tuning.piano.walkKeys;
    this.finishedAt = this.wakeAt + tuning.piano.riseFor + tuning.piano.restFor;
    if (answered) cast.child.cheer();
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

  /**
   * The last thing that happens is the green. The island is told to wake all the way once the bird is back off
   * the keys, and the camera begins the one rise that the wave is watched from.
   */
  private wakeIsland(time: number): void {
    if (this.wakeAt === 0 || (this.walkStep < 1 && time < this.wakeAt)) return;
    this.wakeAt = 0;
    this.roseFrom = time;
    this.onWake?.(3, this.answered);
    this.finishedAt = time + tuning.piano.riseFor + tuning.piano.restFor;
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

import * as THREE from 'three';
import { FROM, verticalFov, widthFit, type Shot } from '../camera';
import { tuning } from '../tuning';
import { heightAt } from '../world/island';
import { piano, PLACE } from '../world/piano';
import { windBough } from '../world/wind-bough';
import { MEADOW_CALLS, MEADOW_FINALE, type MeadowAnswer } from '../audio/meadow-duet';
import type { Cast } from './cast';

type Beat = 'ahead' | 'walking' | 'looking' | 'sitting' | 'seated' | 'leaving' | 'done';
/** A view as a shot gives it: what it looks at, the bearing it stands on from there, how far back and how high. */
interface View { target: THREE.Vector3; bearing: number; distance: number; height: number }
const view = (): View => ({ target: new THREE.Vector3(), bearing: 0, distance: 1, height: 0 });

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
/** Seconds seated before the bough's first call. */
const FIRST_CALL = 2;
/** The cygnet climbs out of the satchel this long before it starts along the keys. */
const UNSTOW = 1.8;

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
  /** Which phrase of the lullaby they are on, which part of it the player has got to, and when the piano speaks next. */
  private phrase = 0;
  private callEnds = 0;
  private pendingReply: MeadowAnswer | null = null;
  /** How many times the bough has called this phrase: once, and once more, softer, if no answer has begun. */
  private asked = 0;
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
  /** When the cygnet starts along the keys: on the finale's arrival, after her last answer has rung down. */
  private walkAt = 0;
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
  /** The finale's three views: the playing view it rises from, the whole island, and the walk's view it comes down to. */
  private readonly rest = view();
  private readonly high = view();
  private readonly onward = view();
  /** The paper plane gliding to the music desk as she comes to the piano, and back into her hand as she leaves. */
  private planeGlide: { to: 'desk' | 'hand'; start: number; length: number } | null = null;
  /** Whose paper it is while it waits on the desk, so a restore past the stop hands it straight back. */
  private planeOwner: Cast | null = null;
  private readonly planeFrom = new THREE.Vector3();
  private readonly planeFromTurn = new THREE.Quaternion();
  private readonly planeAt = new THREE.Vector3();
  private readonly planeTurn = new THREE.Quaternion();
  private readonly planeTurnTo = new THREE.Quaternion();
  private readonly planeRest = new THREE.Euler();
  private readonly approachFrame = { primary: this.approachChild, secondary: piano.keys,
    margin: tuning.piano.approachMargin, extra: tuning.piano.approachExtra };

  /** QA: how far the stop has got, from noticing it to walking on. */
  get at(): string {
    return this.beat;
  }

  /** A checkpoint beyond the stop never replays or re-scores the puzzle. */
  restoreDone(): void {
    if (this.planeOwner) this.returnPlane(this.planeOwner);
    this.beat = 'done'; this.completeAt = 0; this.hushed = this.hushProgress = 0; this.pendingReply = null; windBough.reset(); piano.expect = null; piano.engaged = false; piano.finale = false; }

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
    this.tendPlane(cast);
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
          // Her hands are for the keys: the paper glides ahead of her onto the music desk and waits there, in view.
          c.stowPlane(true);
          this.glidePlane('desk', cast);
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
        if (this.t >= SIT_FOR) this.to('seated');
        break;
      }
      case 'seated': {
        c.lookAt = piano.keys;
        this.duet(time, cast);
        if (windBough.sounding(time)) {
          c.lookAt = windBough.mouth;
          this.releaseHands(cast);
        } else this.playHands(time, cast);
        this.onTheKeys(time, cast);
        this.wakeIsland(time);
        const over = this.finishedAt > 0 && time > this.finishedAt;
        if (over) {
          this.releaseHands(cast);
          piano.expect = null;
          c.dismount();
          c.lookAt = null;
          const [beside, behind] = piano.wayRound;
          c.walkTo(beside.x, beside.z, false, () => c.walkTo(behind.x, behind.z, false, () => this.give(cast), 0.6), 0.35);
          this.to('leaving');
          this.glidePlane('hand', cast);
        }
        break;
      }
      case 'leaving':
        if (this.t > PATIENCE) this.give(cast);
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
    if (this.roseFrom > 0) {
      // The walk's own view of her, which the story has already put in the shot, is where the finale comes down to.
      const from = shot.from ?? FROM;
      this.onward.target.copy(shot.target);
      this.onward.bearing = Math.atan2(from.x, from.z);
      this.onward.distance = shot.distance;
      this.onward.height = shot.height;
    }
    /** It waits further out while they are still on their way to it and comes in as they sit: one move, not two. */
    const settled = this.beat === 'walking' || this.beat === 'looking' ? 0 : 1;
    let bearing = piano.yaw + t.frameTurn;
    let distance = t.frameBack + t.frameWide * (1 - settled);
    let height = t.frameUp + t.frameHigh * (1 - settled);
    let on = t.frameOn;
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
    if (this.heardTo > 0) {
      // Each answer steps the view back and up to take in the colour it sent, and the view stays there: the
      // field grows with the music, and the lens never pumps out and back to the keys between answers.
      const step = Math.min(t.restBack.length, this.heardTo);
      const ease = this.heardTo > t.restBack.length ? 1
        : THREE.MathUtils.smoothstep((this.roseFrom || this.now) - this.responseAt, 0, t.restEase);
      const rest = (list: readonly number[], base: number, n: number): number => n > 0 ? list[n - 1] : base;
      on = THREE.MathUtils.lerp(rest(t.restOn, t.frameOn, step - 1), rest(t.restOn, t.frameOn, step), ease);
      distance = THREE.MathUtils.lerp(rest(t.restBack, distance, step - 1), rest(t.restBack, distance, step), ease);
      height = THREE.MathUtils.lerp(rest(t.restUp, height, step - 1), rest(t.restUp, height, step), ease);
      this.mid.z -= on - t.frameOn;
    }
    if (this.roseFrom > 0) return this.finale(shot, bearing, distance, height);
    shot.target.copy(this.mid);
    shot.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
    shot.distance = distance;
    shot.height = height;
    return this.responseAt >= 0 && this.now - this.responseAt < t.phraseRest ? 1.3 : t.framePace;
  }

  /**
   * Under the bough's finale, one move: up and out until the whole island is seen turning green, a hold on it, and
   * down to the walk's own view of her as she gets up. It is the playing view drawn back for a narrow screen at the
   * start and the walk's view at the end, so nothing moves at either hand-over.
   */
  private finale(shot: Shot, bearing: number, distance: number, height: number): number {
    const t = tuning.piano;
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;
    const fit = widthFit(verticalFov(aspect), aspect);
    const far = this.answered ? 1 : t.riseQuiet;
    this.rest.target.copy(this.mid);
    this.rest.bearing = bearing;
    this.rest.distance = distance * fit;
    this.rest.height = height * fit;
    const x = PLACE.x + t.riseLook[0] * far, z = PLACE.z + t.riseLook[1] * far;
    this.high.target.set(x, Math.max(heightAt(x, z), 0), z);
    this.high.bearing = t.riseTo;
    // One view for any screen: a tall one already sees more of the island's length, and from steeper the pond goes black.
    this.high.distance = t.riseBack * far;
    this.high.height = t.riseUp * far;
    const since = this.now - this.roseFrom, down = t.riseFor + t.riseHold;
    if (since < down) this.between(this.rest, this.high, THREE.MathUtils.smootherstep(since, 0, t.riseFor), shot);
    else this.between(this.high, this.onward, THREE.MathUtils.smootherstep(since, down, down + t.descendFor), shot);
    shot.fitWidth = false;
    return t.risePace;
  }

  /** Part of the way from one view to another, by ratio of reach so a move from near to far runs evenly. */
  private between(a: View, b: View, k: number, shot: Shot): void {
    const ra = Math.hypot(a.distance, a.height), rb = Math.hypot(b.distance, b.height);
    const reach = ra * (rb / ra) ** k;
    const along = Math.abs(rb - ra) > 1e-3 ? (reach - ra) / (rb - ra) : k;
    const lift = THREE.MathUtils.lerp(Math.atan2(a.height, a.distance), Math.atan2(b.height, b.distance), k);
    const bearing = a.bearing + shortest(b.bearing - a.bearing) * k;
    shot.target.lerpVectors(a.target, b.target, along);
    shot.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
    shot.distance = reach * Math.cos(lift);
    shot.height = reach * Math.sin(lift);
  }

  /**
   * The bough opens the duet: nothing sounds from the piano before its first call. It calls, and once more, softer,
   * if no answer has begun `callAgainAfter` later; after that only the guide invites. A partial answer is never
   * interrupted, and her answer plays out before the next call.
   */
  private duet(time: number, cast: Cast): void {
    if (this.finishedAt > 0) return;
    if (this.sayAt === 0) this.sayAt = time + FIRST_CALL;
    if (piano.matched > this.heardTo) {
      this.heardTo = piano.matched;
      this.answered = true;
      this.responseAt = time;
      this.phrase++;
      this.asked = 0;
      if (this.phrase >= MEADOW_CALLS.length) {
        this.finish(cast, true);
        return;
      }
      this.onWake?.(this.heardTo as Waking, true);
      // Leave room to hear the answer and watch its colour travel before the next invitation.
      this.sayAt = Math.max(time + tuning.piano.phraseRest, piano.answerEnds + tuning.windBough.answerAfter);
      return;
    }
    if (this.pendingReply) {
      if (time < this.callEnds + tuning.windBough.answerAfter) return;
      piano.expect = this.pendingReply;
      this.pendingReply = null;
      this.sayAt = time + tuning.meadowMusic.callAgainAfter;
    } else if (time > this.sayAt && piano.gesture.progress === 0 && this.asked < 2) {
      const phrase = MEADOW_CALLS[this.phrase];
      piano.expect = null;
      this.pendingReply = phrase.reply;
      this.callEnds = windBough.play(phrase.call, time, false, this.asked === 0 ? 0 : tuning.meadowMusic.callAgainDb);
      this.asked++;
    }
  }

  private playHands(time: number, cast: Cast): void {
    if (this.walkFrom > 0 || cast.carry.busy) return;
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

  /** The bough carries the final greening; the cygnet adds a few piano notes beneath it. */
  private finish(cast: Cast, answered: boolean): void {
    piano.expect = null;
    this.pendingReply = null;
    this.answered = answered;
    piano.finale = true;
    this.releaseHands(cast);
    // The finale waits for her last answer to ring down.
    const starts = Math.max(this.now, piano.answerEnds) + tuning.windBough.finalRest;
    const ends = windBough.play(MEADOW_FINALE, starts, true);
    this.completeAt = ends + tuning.piano.completionRest;
    this.wakeAt = starts + tuning.windBough.inhale + MEADOW_FINALE.greenAt;
    this.walkAt = this.wakeAt;
    this.finishedAt = Math.max(this.completeAt, this.wakeAt + finaleFor());
    this.walkFrom = -1;
  }

  /**
   * The cygnet walks the keyboard, one plink a step, while the piano plays the rest of the tune around it. It is
   * the only thing in the game that makes music with its feet, and neither of them says a word about it.
   */
  private onTheKeys(time: number, cast: Cast): void {
    /** Out of the satchel first, because from there it can reach the keys without anybody lifting it. */
    if (this.walkFrom === -1 && time >= this.walkAt - UNSTOW) {
      this.walkFrom = -2;
      cast.carry.unstow(() => {
        this.walkFrom = Math.max(this.now, this.walkAt);
        this.walkStep = 0;
        piano.walkKeys(tuning.piano.walkFrom, tuning.piano.walkTo, tuning.piano.walkKeys, this.walkFrom);
      });
    }
    if (this.walkFrom <= 0 || time < this.walkFrom) return;
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
    this.finishedAt = Math.max(this.finishedAt, time + finaleFor());
  }

  /** The paper never vanishes: it flies from wherever it is, in a low arc, to the desk or to her hand. */
  private glidePlane(to: 'desk' | 'hand', cast: Cast): void {
    const { plane } = cast;
    this.planeOwner = cast;
    this.planeFrom.copy(plane.position);
    this.planeFromTurn.copy(plane.group.quaternion);
    piano.planeRest(this.planeAt, this.planeRest);
    const length = Math.max(tuning.piano.planeGlide, this.planeFrom.distanceTo(this.planeAt) / 8);
    this.planeGlide = { to, start: this.now, length };
  }

  private tendPlane({ plane, child }: Cast): void {
    const glide = this.planeGlide;
    if (!glide) return;
    const k = THREE.MathUtils.smootherstep(this.now - glide.start, 0, glide.length);
    if (glide.to === 'desk') piano.planeRest(this.planeAt, this.planeRest);
    else {
      child.handPosition(this.planeAt);
      this.planeRest.set(0, child.yaw, 0);
    }
    this.planeTurnTo.setFromEuler(this.planeRest);
    this.planeAt.lerpVectors(this.planeFrom, this.planeAt, k).y += Math.sin(k * Math.PI) * 0.6;
    this.planeRest.setFromQuaternion(this.planeTurn.slerpQuaternions(this.planeFromTurn, this.planeTurnTo, k));
    plane.pin(this.planeAt, this.planeRest);
    plane.visible = true;
    plane.keptSmall = true;
    if (k < 1) return;
    this.planeGlide = null;
    if (glide.to === 'hand') this.returnPlane({ plane, child });
  }

  private returnPlane({ plane, child }: Pick<Cast, 'plane' | 'child'>): void {
    this.planeGlide = null;
    this.planeOwner = null;
    plane.keptSmall = false;
    plane.visible = true;
    plane.hold(child);
  }

  private give({ child, plane }: Cast): void {
    if (this.planeGlide?.to === 'hand' || !plane.held) this.returnPlane({ plane, child });
    piano.expect = null;
    piano.engaged = false;
    piano.finale = false;
    child.stowPlane(false);
    plane.visible = true;
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

/** From the greening to the camera coming back down to her, when she gets up. */
function finaleFor(): number {
  const t = tuning.piano;
  return t.riseFor + t.riseHold + t.descendFor;
}

function shortest(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

import * as THREE from 'three';
import { FROM, verticalFov, widthFit, type Shot } from '../camera';
import { tuning } from '../tuning';
import { piano } from '../world/piano';
import { windBough } from '../world/wind-bough';
import { MEADOW_CALLS, MEADOW_FINALE, type MeadowAnswer } from '../audio/meadow-duet';
import type { Cast } from './cast';
import { PAPER_NOSE } from '../glider/glider';
import type { WindSample } from '../wind/field';
import type { GustFront } from '../fx/windlines';

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
/**
 * The share of its glide the paper spends sliding along its own line into or out of the fork: a quarter, because the
 * curve that carries it there arrives at three times its last leg's length per share, so its speed never jumps.
 */
const SLIDE = 0.25;
/** Seconds seated before the bough's first call. */
const FIRST_CALL = 2;

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
  /** When the island is told to wake all the way, at the latest, and when the finale's widening began. */
  private wakeAt = 0;
  private roseFrom = 0;
  /** The cygnet hears the finale out from the satchel: 0 not yet, 1 listening to the bough, 2 looking about at the colour. */
  private heard = 0;
  private responseAt = -1;
  private readonly out = new THREE.Vector3();
  private fromYaw = 0;
  private readonly aim = new THREE.Vector2(piano.stand.x, piano.stand.z);
  private readonly from = new THREE.Vector3();
  private readonly onto = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly hands = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly approachChild = new THREE.Vector3();
  /** The playing view the duet starts from and the walk's view its widening ends on. */
  private readonly rest = view();
  private readonly onward = view();
  /** The paper plane gliding into the bough's fork as she comes to the piano, and back into her hand as she leaves. */
  private planeGlide: { to: 'fork' | 'hand'; start: number; length: number } | null = null;
  /** Whose paper it is while it is stuck in the fork, so a restore past the stop hands it straight back. */
  private planeOwner: Cast | null = null;
  private readonly planeFrom = new THREE.Vector3();
  private readonly planeFromTurn = new THREE.Quaternion();
  private readonly planeAt = new THREE.Vector3();
  /** Where it sticks in the fork, and the points `planeLead` and twice that back along its line out of it. */
  private readonly planeFork = new THREE.Vector3();
  private readonly planeLine = new THREE.Vector3();
  private readonly planeBack = new THREE.Vector3();
  private readonly planeHand = new THREE.Vector3();
  private readonly planeOver = new THREE.Vector3();
  private readonly planeTurn = new THREE.Quaternion();
  private readonly planeForkTurn = new THREE.Quaternion();
  private readonly planeHerTurn = new THREE.Quaternion();
  private readonly planeRest = new THREE.Euler();
  private readonly planeNose = new THREE.Vector3();
  private readonly planeShake = new THREE.Quaternion();
  private readonly shook = new THREE.Euler();
  /** The island's own gust that takes the paper from over her into the fork, not the player's wind. */
  private readonly carry: GustFront = { at: new THREE.Vector3(), dir: new THREE.Vector2(1, 0), flow: new THREE.Vector2(),
    strength: 0, lines: tuning.piano.planeGust.lines };
  private carryFrom = -Infinity;
  /** The finale's steady stream of traces off the bough's mouth: when the next goes, and when the last. */
  private streamAt = 0;
  private streamTo = 0;
  private streamed = 0;
  private carryFor = 0;
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  /** How hard the wind is catching the paper in the fork, eased. */
  private blown = 0;
  private readonly approachFrame = { primary: this.approachChild, secondary: piano.keys,
    margin: tuning.piano.approachMargin, extra: tuning.piano.approachExtra };

  get gustFront(): GustFront | null { return this.carry.strength > 0 ? this.carry : null; }

  /** QA: how far the stop has got, from noticing it to walking on. */
  get at(): string {
    return this.beat;
  }

  /** A checkpoint beyond the stop never replays or re-scores the puzzle. */
  restoreDone(): void {
    if (this.planeOwner) this.returnPlane(this.planeOwner);
    this.beat = 'done'; this.completeAt = 0; this.hushed = this.hushProgress = 0; this.pendingReply = null; windBough.reset(); piano.expect = null; piano.engaged = false; }

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
    this.tendPlane(cast, dt);
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
          // Her hands are for the keys: the paper glides ahead of her into the bough's fork and sticks there, in view.
          c.stowPlane(true);
          this.glidePlane('fork', cast);
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
        this.wakeIsland(time);
        this.hearFinale(time, cast);
        this.streamFinale(time);
        const over = this.finishedAt > 0 && time > this.finishedAt;
        if (over) {
          cast.cygnet.watch(null);
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

  /**
   * A steady view over the keys into falling ground that steps back and up as the duet goes on: a little after each
   * answer, and the rest of the way under the finale, ending on the walk's own view of her so nothing moves when she
   * gets up.
   */
  frame(shot: Shot): number | null {
    if (this.beat === 'ahead' || this.beat === 'done') return null;
    const t = tuning.piano;
    // The walk's view of her, which the story has already put in the shot, is where the duet's widening ends.
    const from = shot.from ?? FROM;
    this.onward.target.copy(shot.target);
    this.onward.bearing = Math.atan2(from.x, from.z);
    this.onward.distance = shot.distance;
    this.onward.height = shot.height;
    /** It waits further out while they are still on their way to it and comes in as they sit: one move, not two. */
    const settled = this.beat === 'walking' || this.beat === 'looking' ? 0 : 1;
    const bearing = piano.yaw + t.frameTurn;
    let distance = t.frameBack + t.frameWide * (1 - settled);
    const height = t.frameUp + t.frameHigh * (1 - settled);
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
    shot.target.copy(this.mid);
    shot.from = this.side.set(Math.sin(bearing), 0, Math.cos(bearing));
    shot.distance = distance;
    shot.height = height;
    if (this.heardTo === 0) return t.framePace;
    // The playing view as a narrow screen draws it back, so the first step leaves from where the lens already is.
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9;
    const fit = widthFit(verticalFov(aspect), aspect);
    this.rest.target.copy(this.mid);
    this.rest.bearing = bearing;
    this.rest.distance = distance * fit;
    this.rest.height = height * fit;
    this.between(this.rest, this.onward, this.widened(), shot);
    shot.fitWidth = false;
    const easing = this.roseFrom > 0 || this.now - this.responseAt < t.stepAfter + t.stepEase + t.stepSettle;
    return easing ? t.stepPace : t.framePace;
  }

  /**
   * How far the view has come from the playing view toward the walk's: each answer eases it out to its own step
   * and it stays there; the finale carries it on from wherever that ease has got to, so the hand-over never jumps.
   */
  private widened(): number {
    const t = tuning.piano;
    const n = Math.min(this.heardTo, t.steps.length);
    const ease = THREE.MathUtils.smootherstep(this.now - this.responseAt, t.stepAfter, t.stepAfter + t.stepEase);
    const step = THREE.MathUtils.lerp(n > 1 ? t.steps[n - 2] : 0, t.steps[n - 1], ease);
    if (this.roseFrom <= 0) return step;
    return step + (1 - step) * THREE.MathUtils.smootherstep(this.now - this.roseFrom, 0, t.finaleEase);
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
    if (cast.carry.busy) return;
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

  /** The bough carries the final greening alone. */
  private finish(cast: Cast, answered: boolean): void {
    piano.expect = null;
    this.pendingReply = null;
    this.answered = answered;
    this.releaseHands(cast);
    // The finale waits for her last answer to ring down.
    const starts = Math.max(this.now, piano.answerEnds) + tuning.windBough.finalRest;
    const ends = windBough.play(MEADOW_FINALE, starts, true);
    this.streamAt = starts + tuning.windBough.inhale;
    this.streamTo = ends - tuning.piano.finaleStream.tail;
    this.completeAt = ends + tuning.piano.completionRest;
    this.wakeAt = starts + tuning.windBough.inhale + MEADOW_FINALE.greenAt;
    this.finishedAt = Math.max(this.completeAt, this.wakeAt + finaleFor());
  }

  /**
   * The cygnet stays in the satchel for the finale: it lifts its head to the bough as it starts, and when the colour
   * pours off the knoll it looks about and then out over the waking meadow, without a call.
   */
  private hearFinale(time: number, cast: Cast): void {
    const { cygnet } = cast;
    if (this.heard === 0 && this.completeAt > 0 && windBough.sounding(time)) {
      this.heard = 1;
      cygnet.watch(windBough.mouth, true);
    } else if (this.heard === 1 && this.roseFrom > 0) {
      this.heard = 2;
      this.out.subVectors(piano.keys, piano.seat).setY(0).setLength(18).add(piano.keys).y += 2;
      cygnet.does('look-about', this.out, 2.4);
      cygnet.watch(this.out, true);
    }
  }

  /** Under the finale the bough breathes traces out over the meadow at an even pace, the way her answers did. */
  private streamFinale(time: number): void {
    if (this.streamAt <= 0 || time < this.streamAt || time > this.streamTo) return;
    const k = tuning.piano.finaleStream;
    this.streamAt = time + k.every;
    this.streamed++;
    piano.breathe(windBough.mouth, 0.5 + 0.4 * Math.sin(this.streamed * 2.4), k.strength);
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

  /**
   * The paper never vanishes: it flies from wherever it is to the fork or to her hand. Near the fork it slides along
   * its own line, already turned as it sits there, so it goes in nose first between the pipes and comes out the way
   * it went in; the rest of the way it is carried up over her and the piano, and down.
   */
  private glidePlane(to: 'fork' | 'hand', cast: Cast): void {
    const { plane } = cast;
    const lead = tuning.piano.planeLead;
    this.planeOwner = cast;
    this.planeFrom.copy(plane.position);
    this.planeFromTurn.copy(plane.group.quaternion);
    windBough.planeRest(this.planeFork, this.planeRest);
    this.planeForkTurn.setFromEuler(this.planeRest);
    this.planeLine.set(0, 0, -lead).applyEuler(this.planeRest).add(this.planeFork);
    this.planeBack.set(0, 0, -2 * lead).applyEuler(this.planeRest).add(this.planeFork);
    const her = to === 'fork' ? this.planeFrom : cast.child.handPosition(this.planeHand);
    const way = her.distanceTo(this.planeBack) + 2 * lead;
    this.planeGlide = { to, start: this.now, length: Math.max(tuning.piano.planeGlide, way / 8) };
    if (to !== 'fork') return;
    const g = tuning.piano.planeGust;
    this.carry.dir.set(this.planeFork.x - this.planeFrom.x, this.planeFork.z - this.planeFrom.z).normalize();
    this.carry.flow.copy(this.carry.dir).multiplyScalar(g.pace * Math.max(way / this.planeGlide.length, g.leastPace));
    this.carryFrom = this.now;
    this.carryFor = this.planeGlide.length + g.after;
  }

  /** The gust rises as the paper is lifted, travels with it and blows on past the fork as it sticks. */
  private blowCarry(cast: Cast): void {
    const g = tuning.piano.planeGust, f = this.carry, age = this.now - this.carryFrom;
    f.strength = age < 0 || age > this.carryFor ? 0
      : THREE.MathUtils.smoothstep(age, 0, g.rise) * (1 - THREE.MathUtils.smoothstep(age, this.carryFor - g.fall, this.carryFor));
    if (!f.strength) return;
    f.at.set(this.planeAt.x - f.dir.x * g.behind, this.planeAt.y, this.planeAt.z - f.dir.y * g.behind);
    cast.wind.addSplat({ source: f,
      ax: f.at.x - f.dir.x * g.length, az: f.at.z - f.dir.y * g.length, bx: f.at.x, bz: f.at.z,
      vx: f.dir.x * g.speed * f.strength, vz: f.dir.y * g.speed * f.strength, radius: g.radius,
      energy: g.energy * f.strength, swirl: 0, lift: g.lift * f.strength });
  }

  private tendPlane(cast: Cast, dt: number): void {
    this.blowCarry(cast);
    const { plane, child } = cast;
    const glide = this.planeGlide;
    if (!glide) {
      if (!this.planeOwner) return;
      windBough.planeRest(this.planeFork, this.planeRest);
      this.planeTurn.setFromEuler(this.planeRest);
      this.shake(cast, dt, this.planeFork, this.planeTurn, 1);
      return;
    }
    const k = THREE.MathUtils.smootherstep(this.now - glide.start, 0, glide.length);
    const toFork = glide.to === 'fork' ? k : 1 - k;
    const carried = 1 - SLIDE;
    const her = glide.to === 'fork' ? this.planeFrom : child.handPosition(this.planeHand);
    if (glide.to === 'fork') this.planeHerTurn.copy(this.planeFromTurn);
    else this.planeHerTurn.setFromEuler(this.planeRest.set(0, child.yaw, 0));
    let turn = 1;
    if (toFork >= carried) this.planeAt.lerpVectors(this.planeLine, this.planeFork, (toFork - carried) / SLIDE);
    else {
      const u = toFork / carried;
      this.planeOver.copy(her).y = Math.max(her.y, piano.top) + tuning.piano.planeLift;
      bezier(her, this.planeOver, this.planeBack, this.planeLine, u, this.planeAt);
      turn = THREE.MathUtils.smoothstep(u, 0, 1);
    }
    this.planeTurn.slerpQuaternions(this.planeHerTurn, this.planeForkTurn, turn);
    // It starts trembling as it sticks, and is still trembling as it pulls free.
    this.shake(cast, dt, this.planeAt, this.planeTurn, THREE.MathUtils.smoothstep(toFork, 0.85, 1));
    if (k < 1) return;
    this.planeGlide = null;
    if (glide.to === 'hand') this.returnPlane({ plane, child });
  }

  /**
   * Caught in the fork, the paper is never quite still: it rocks a little about its jammed nose, its tail and wing
   * tips flutter, and more so when wind goes by, the player's or the bough's own breath. `caught` is how far into
   * the fork it is.
   */
  private shake({ plane, wind }: Cast, dt: number, at: THREE.Vector3, turn: THREE.Quaternion, caught: number): void {
    const t = tuning.windBough;
    const air = wind.sample(at.x, at.z, this.air);
    const blown = THREE.MathUtils.clamp(air.energy * t.planeGust, 0, 1);
    this.blown += (blown - this.blown) * (1 - Math.exp(-dt * (blown > this.blown ? 8 : 1.5)));
    const now = this.now, k = THREE.MathUtils.lerp(t.planeCalm, 1, this.blown) * caught;
    const flutter = this.blown * caught;
    const [pitch, yaw, roll] = t.planeTremble;
    this.shook.set(
      pitch * (k * 0.6 * Math.sin(now * 1.9) + flutter * 0.4 * Math.sin(now * 13.1)),
      yaw * (k * 0.6 * Math.sin(now * 1.3 + 2) + flutter * 0.4 * Math.sin(now * 9.7 + 1)),
      roll * (k * 0.5 * Math.sin(now * 2.3 + 4) + flutter * 0.5 * Math.sin(now * 16.9 + 3)),
      'YXZ');
    const nose = this.planeNose.copy(PAPER_NOSE).multiplyScalar(tuning.paperCarry.scale).applyQuaternion(turn).add(at);
    turn.multiply(this.planeShake.setFromEuler(this.shook));
    this.planeAt.copy(nose).sub(this.planeNose.copy(PAPER_NOSE).multiplyScalar(tuning.paperCarry.scale).applyQuaternion(turn));
    plane.pin(this.planeAt, this.planeRest.setFromQuaternion(turn, 'YXZ'));
    plane.visible = true;
    plane.keptSmall = true;
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

/** From the greening to the camera arriving at the walk's view of her, before she gets up. */
function finaleFor(): number {
  return tuning.piano.finaleEase;
}

/** A point `k` of the way along the curve from `a`, leaving toward `c1` and arriving from `c2`, to `b`. */
function bezier(a: THREE.Vector3, c1: THREE.Vector3, c2: THREE.Vector3, b: THREE.Vector3, k: number, out: THREE.Vector3): THREE.Vector3 {
  const j = 1 - k;
  return out.copy(b).multiplyScalar(k * k * k).addScaledVector(c2, 3 * j * k * k).addScaledVector(c1, 3 * j * j * k).addScaledVector(a, j * j * j);
}

function shortest(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

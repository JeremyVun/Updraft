import * as THREE from 'three';
import { tuning } from '../../tuning';
import { gladUniforms } from '../../world/water/glad';
import { swellUniforms } from '../../world/water/swell';
import { BLOWHOLE, EYE_S, EYE_Y, FIN_DIR, FIN_ROOT, FIN_SPAN, LENGTH, SPINE_END, TOP, crown, finPoint as finSurface, flankAt, halfWidthAt, ringPoint } from './anatomy';
import { curve } from './curve';
import { FOAM, type Marks } from './marks';
import { Seabirds } from './seabirds';
import { DROP, MIST, type Spray } from './spray';
import { WhaleWake, type WhaleSound } from './wake';
import { DREAM_SCALE, DREAM_SHAPE, SPINE_N, SPINE_STEP, WhaleRig } from './whale';

/** Along the flipper's trailing edge from here to its tip the sea pours off it as it lifts (0 root .. 1 tip). */
const POURS_FROM = 0.18;

export type SleeperSound = WhaleSound | 'whale-sigh' | 'whale-breath' | 'whale-slap' | 'flipper-pour' | 'seabirds-lift';

const K = tuning.netWhale;
/** The tail stock, behind the hump: what the body tips over as it lifts its flukes. */
const PIVOT = 0.75;
/** How far out on the skin the near eye is, in the rest pose. */
const EYE_X = flankAt(EYE_S, EYE_Y);
/** The lower jaw on the near side, at the waterline. */
const JAW_S = 0.07;
const JAW_Y = -0.12;
const JAW_X = flankAt(JAW_S, JAW_Y);
const FIN_LENGTH = FIN_SPAN * DREAM_SHAPE.fin;
const FIN_S = -FIN_ROOT.z / LENGTH;
/** Rolling free it lays its flippers back along its flanks, so on its back they lie low rather than stand up. */
const FREE_FIN = new THREE.Vector2(0.95, -0.4);
/** Lying at the surface the fluke tips curl up a little at the far end. */
const REST_CURL = 0.2;
/** How far through each slow breath it breathes out, and how long a sigh seen from far off goes on rising (s). */
const SIGH_AT = 0.42;
const SIGH_FOR = 2.2;
/** The first full breath, in seconds: drawn in, then out in a soft column up through the spiral. */
const BREATH_IN = 1.4;
const BREATH_OUT = 3.6;
/**
 * Free, in seconds: a long breath drawn while it drifts clear of the boat and the pod comes, the spout, its mist coming
 * down over the boat while the net it wore sinks away, then from `DIVE_AT` it dives as a whale does.
 */
export const SPOUT_FROM = 6;
export const SPOUT_TO = 8.8;
/** How hard it breathes out, `t` s into a blow: all at once, then easing off. */
const blowing = (t: number) => THREE.MathUtils.smoothstep(t, 0, 0.15) * Math.exp(-t / K.blow.exhale);
/** The spout's mist comes down over the boat for this long after it (s). */
const VEIL_FOR = 5;
export const DIVE_AT = 15.5;
const D = DIVE_AT;
/**
 * The dive: one slow forward glide down a way through the sea that the whole body follows. Its head goes down where
 * it lies, bending about `BEND_AT` along it (the dive's way starts there, where its spout stood); the long back rises
 * into an arch over that bend and slides forward and under; the flukes rise high there once, turning to face her as
 * if waving, and slip straight down.
 */
const BEND_AT = 0.22;
/** The way's slope down from the bend, by metres ahead of it: rising a little into the arch, then down steeply. */
const DIVE_SLOPE = curve([[-30, 0], [-24, 0], [-12, 0.1], [0, 0], [14, -0.55], [28, -1.15], [40, -1.2], [60, -1.2]]);
/** Seconds into the dive over which its head goes down off the surface onto the way. */
const HEAD_DOWN = 6.5;
/** Its glide along its own length, in metres a second, from the dive's start. */
const GLIDE = curve([
  [0, 0], [1, 0.3], [4, 4.6], [6.5, 8.6], [9.5, 8.6], [11.3, 3.2], [12.3, 2.2], [14.5, 1.6], [16.5, 1.3], [17.5, 2.4],
  [19.5, 5.5], [21.5, 6.5], [30, 6.5],
]);
/** Where along it the tail stock bends to lift the flukes, and how far into the flukes the lift has all of them. */
const STOCK = 0.84;
const STOCK_TO = 0.95;
/** The flukes' pitch held up out of the sea (radians, nose up): a little short of straight up, undersides to the sky. */
const FLUKES_UP = -1.45;
/**
 * The lift, by metres the tail stock lies ahead of the bend: coming up as it nears it, held as the flukes stand over
 * it and slip down through it.
 */
const LIFT_BY = curve([[-4, 0], [-1, 0.14], [2, 0.75], [4.5, 1], [40, 1]]);
/**
 * As the flukes come up the whale turns `TURN_TO_HER` of the way round toward the boat, so their pale undersides open
 * toward her. Most of it (`YAW_SHARE`) is the whole body turning about its bend over `YAW_WITH` of their lift; the
 * rest its tail stock turns them about its own line, from the start of the lift over `TILT_WITH` of it, but never so
 * far that they tip more than `TILT` (the sine of the slope across their span) while they are still low; standing,
 * that turn is a turn like the body's. Meanwhile they trail low from the stock by `TRAIL` (radians at the hinge),
 * straightening over `TRAIL_UNTIL` of the lift, so they rise already opening and never edge on, and never swing out
 * over the boat.
 */
const TURN_TO_HER = 0.75;
const YAW_SHARE = 0.6;
const YAW_WITH = [0.1, 0.85] as const;
const TILT = 0.3;
const TILT_WITH = 0.3;
const TRAIL = 0.7;
const TRAIL_UNTIL = [0.4, 0.85] as const;
/** A slow wave of the flukes while they are up: radians of flex at the hinge, and of turn, and its pace. */
const WAVE_FLEX = 0.16;
const WAVE_TURN = 0.12;
const WAVE_PACE = 1.25;
/** Seconds after the notch slips under before the boat may go and the pod goes with it, and before it is gone. */
const GOING_AFTER = 1.2;
const GONE_AFTER = 3;
/** Metres along its length it has glided, by seconds into the dive, integrated once from the glide. */
const GLIDED = (() => {
  const dt = 1 / 30;
  const out = new Float32Array(Math.ceil(60 / dt) + 2);
  let d = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = d;
    d += ((GLIDE(i * dt) + GLIDE((i + 1) * dt)) / 2) * dt;
  }
  return out;
})();
const glided = (t: number) => {
  const x = Math.min(Math.max(t * 30, 0), GLIDED.length - 1.001);
  const i = Math.floor(x);
  return GLIDED[i] + (GLIDED[i + 1] - GLIDED[i]) * (x - i);
};
/** Seconds into the dive when it has glided `m` metres. */
const glidedAt = (m: number) => {
  let i = 0;
  while (i < GLIDED.length - 1 && GLIDED[i + 1] < m) i++;
  return (i + (m - GLIDED[i]) / Math.max(1e-6, GLIDED[i + 1] - GLIDED[i])) / 30;
};
const BODY_M = LENGTH * DREAM_SCALE;
/** Seconds into being free when the flukes start up out of the sea, when the notch slips under, and the swell goes out. */
const FLUKES_FROM = D + glidedAt((STOCK - BEND_AT) * BODY_M - 1);
const UNDER_AT = D + glidedAt((1 - BEND_AT) * BODY_M + 4);
const SURGE_AT = D + glidedAt((STOCK - BEND_AT) * BODY_M + 12);
const GOING_AT = UNDER_AT + GOING_AFTER;
const GONE = UNDER_AT + GONE_AFTER;
/**
 * Free, it drifts clear of the boat before it spouts: its head swung away about the tail stock (radians) and its
 * body slid away sideways (m), over seconds.
 */
const CLEAR_TURN = curve([[0, 0], [0.8, 0], [7.5, 0.05], [12, 0.06]]);
const CLEAR_SLIDE = curve([[0, 0], [0.8, 0], [7.5, 1.6], [12, 2]]);
/** The near flipper's lift, slow and heavy: up over nearly three seconds, held, and laid back down on the water. */
const LIFT = curve([[0, 0], [0.7, 0.1], [2.7, 0.95], [4, 1], [5.4, 0.35], [6, -0.04], [6.6, 0]]);
const LIFT_HITS = 5.9;
const LIFT_POURS = 1;
const LIFT_FOR = 6.6;
/** Where the sea streams off its bared head as the net comes off it: along the head (s) and how high up the near flank (of the top). */
const STREAMS = [[0.05, 0.55], [0.08, 0.7], [0.11, 0.5], [0.14, 0.75], [0.17, 0.6], [0.2, 0.8], [0.23, 0.55], [0.27, 0.7]] as const;
/** How far through each slow breath its back is rising fast enough to shed the sea off its top. */
const SHEDS_AT = 0.2;
/** The part of it lying along the surface, from the snout: what the sea round it swells out from as it breathes. */
const LYING = 0.75;
/** A slow blink: the lid down over half a second, a moment shut, and up again over most of a second. */
const BLINK = curve([[0, 0], [0.5, 0.9], [0.75, 0.9], [1.6, 0]]);
/** Under the weight on it, one try to open its eye: the lid strains up, holds trembling, and falls back (of the try's height). */
const TRY = curve([[0, 0], [1.1, 1], [1.6, 0.92], [2.1, 0.1], [2.4, 0], [3.4, 0]]);
const TRY_EVERY = 3.4;

/**
 * Lying at rest: the head carried a little high so the eye and the jaw stand clear, the back level behind the
 * blowhole, lowering only far along into the haze.
 */
function restPitch(s: number): number {
  const sm = THREE.MathUtils.smoothstep;
  return 0.08 * (1 - sm(s, 0.12, 0.32)) + 0.08 * sm(s, 0.6, 1);
}

/** How much of a breath lifts the body at s: the back swells with it, the head only by `head` of it. */
const breathAt = (s: number, head = 0.3) => head + (1 - head) * THREE.MathUtils.smoothstep(s, 0.2, 0.45);

/** The height of the skin and its normal at a point, from `surfaceAt`. */
export interface Skin {
  height: number;
  readonly normal: THREE.Vector3;
}

/**
 * The whale lying at the surface beside the boat, worn out: from far off a long low island that breathes. Its weak
 * breaths only sputter; given its first full breath its eye opens; free, it spouts and dives as a whale does, its
 * flukes raised high once as if waving, and the swell it leaves lifts the boat.
 */
export class SleepingWhale extends WhaleRig {
  phase: 'resting' | 'woken' | 'free' | 'gone' = 'gone';
  /** Seconds into the current phase. */
  time = 0;
  /** How far toward its first full breath the player's wind has brought it, 0..1: it breathes deeper as it does. */
  stir = 0;
  /** How far up each of its tries to open its eye under the weight on it lifts the lid, 0 when it is not trying. */
  struggle = 0;
  /** The lazy lifts of the near flipper since it lay down. */
  lifts = 0;
  /** Where the parts that matter are this frame, in the world. */
  readonly blowhole = new THREE.Vector3();
  readonly eye = new THREE.Vector3();
  readonly jaw = new THREE.Vector3();
  readonly finRoot = new THREE.Vector3();
  readonly finTip = new THREE.Vector3();
  /** The middle of the back above the water, and the fluke notch. */
  readonly back = new THREE.Vector3();
  readonly flukes = new THREE.Vector3();
  /** Where it bends down into its dive on the water, and so where its flukes will rise: known once it has drifted clear. */
  readonly farewell = new THREE.Vector3();
  /** How far the near flipper is lifted, 0..1. */
  flipperLift = 0;
  /** How far off it is seen from (m): its sighs spread wider and slower so they show in the haze from far off. */
  seenFrom = 0;
  /** Each weak breath out, with how strong it was: what the net over the blowhole has to answer. */
  onExhale: ((strength: number) => void) | null = null;
  onSound: ((kind: SleeperSound, x: number, y: number, z: number) => void) | null = null;
  /** The seabirds standing far along its back. */
  readonly birds: Seabirds;
  private readonly wake: WhaleWake;
  private readonly pivot = new THREE.Vector3();
  private readonly rest = new THREE.Vector3();
  /** Where the boat rests beside it. */
  private readonly near = new THREE.Vector3();
  private readonly restHeading = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private readonly gazeAt = new THREE.Vector3();
  private gazing = false;
  /** How far open its eye is, and seconds into a blink, or -1. */
  private opened = 0;
  private blinkT = -1;
  private tryT = 0;
  private headWet = 0;
  private breath = 0;
  private sighed = true;
  /**
   * Seconds since its back last rose with a breath and shed the sea off its top, how deep that breath was, and how
   * much of the sea poured off in falls rather than running off as a sheen (1 for the breaths that matter).
   */
  private shedT = Infinity;
  private shedBy = 0;
  private shedFalls = 0;
  private shed = true;
  private liftT = -1;
  /** A sigh seen from far off, still rising: seconds of it left, how far off, how strong. */
  private sigh = { left: 0, far: 1, strength: 1 };
  private worldTime = 0;
  /** The dive's way, laid once it has drifted clear: its bend, how high its back arches over it, how far round it turns. */
  private planned = false;
  private readonly bendFrom = new THREE.Vector3();
  private twist = 0;
  private arch = 0;
  private readonly u = new Float32Array(SPINE_N);
  private readonly y = new Float32Array(SPINE_N);
  private readonly pitch = new Float32Array(SPINE_N);
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Vector3();
  private readonly ring = { x: 0, y: 0 };

  constructor(private readonly spray: Spray, private readonly foam: Marks, slicks: Marks) {
    super();
    this.wake = new WhaleWake(this, spray, foam, slicks);
    this.wake.onSound = (kind, x, y, z) => this.onSound?.(kind, x, y, z);
    this.birds = new Seabirds(this.uniforms);
    this.birds.onLift = (at) => this.onSound?.('seabirds-lift', at.x, at.y, at.z);
  }

  /** It has drawn its first full breath: from here on it is awake. */
  get awake(): boolean {
    return this.phase === 'woken' || this.phase === 'free';
  }

  /** The tall plume it throws up as it is free: the moment the open sea is won. */
  get spouting(): boolean {
    return this.phase === 'free' && this.time >= SPOUT_FROM && this.time < SPOUT_TO;
  }

  /** Its flukes up out of the sea, waving: the time to wave back. */
  get fluking(): boolean {
    return this.phase === 'free' && this.time > FLUKES_FROM && this.time < UNDER_AT;
  }

  /** How far up out of the sea its flukes stand as it dives, 0 under .. 1 high. */
  get flukesShown(): number {
    return this.phase === 'free' && this.time >= D ? THREE.MathUtils.smoothstep(this.flukes.y, 0, 7) : 0;
  }

  /** Seconds into its dive, or a negative number before it. */
  get diving(): number {
    return this.phase === 'free' ? this.time - D : this.phase === 'gone' ? Infinity : -1;
  }

  /** Under, or gone: the boat may go, and the pod with it. */
  get going(): boolean {
    return (this.phase === 'free' && this.time >= GOING_AT) || this.phase === 'gone';
  }

  /**
   * Lays it resting with its near eye over `eye` (only x and z are kept) and its snout along `noseYaw`, rolled near
   * side up. `near` is where the boat rests, for how high its swell is there.
   */
  lie(eye: THREE.Vector3, noseYaw: number, near: THREE.Vector3): void {
    this.phase = 'resting';
    this.time = 0;
    this.stir = 0;
    this.lifts = 0;
    this.heading.set(Math.sin(noseYaw), 0, Math.cos(noseYaw));
    this.rest.set(0, 0, 0);
    this.pivot.copy(this.rest);
    this.lay(0, 0, 0, 0, K.roll);
    this.rest.y = K.crown - this.point(0, crown(BLOWHOLE), BLOWHOLE, this.p).y;
    this.pivot.copy(this.rest);
    this.lay(0, 0, 0, 0, K.roll);
    this.point(EYE_X, EYE_Y, EYE_S, this.p);
    this.rest.x = eye.x - this.p.x;
    this.rest.z = eye.z - this.p.z;
    this.pivot.copy(this.rest);
    this.lay(0, 0, 0, 0, K.roll);
    this.near.copy(near);
    this.restHeading.copy(this.heading);
    this.away.set(-this.heading.z, 0, this.heading.x);
    if (this.away.x * (eye.x - near.x) + this.away.z * (eye.z - near.z) < 0) this.away.negate();
    this.liftT = -1;
    this.flipperLift = 0;
    this.skin.uEye.value = this.opened = 0;
    this.blinkT = -1;
    this.gazing = false;
    this.wake.reset(true);
    this.uniforms.uCurl.value = REST_CURL;
    this.uniforms.uFin.value.set(K.finRestSweep, -K.finRestRaise);
    this.uniforms.uSlap.value.set(1, 0, 0);
    this.uniforms.uHaze.value = 1;
    gladUniforms.uGlad.value.w = 0;
    swellUniforms.uHeave.value.w = swellUniforms.uHeaveBefore.value.w = 0;
    this.shedT = Infinity;
    this.shed = true;
    this.locate();
    this.mesh.visible = this.ghost.visible = true;
    this.birds.settle();
  }

  /** How lost in the morning haze it is from far off, 0..1. */
  set lost(amount: number) {
    this.uniforms.uLost.value = amount;
  }

  /** Seconds until its next weak breath out, while it lies resting. */
  get untilSigh(): number {
    if (this.phase !== 'resting') return Infinity;
    return (this.breath < SIGH_AT ? SIGH_AT - this.breath : 1 + SIGH_AT - this.breath) * this.breathPeriod();
  }

  /** Its next weak breath out comes `seconds` from now, while it lies resting. */
  sighIn(seconds: number): void {
    if (this.phase !== 'resting') return;
    this.breath = SIGH_AT - Math.min(SIGH_AT - 0.02, seconds / this.breathPeriod());
    this.sighed = false;
  }

  private breathPeriod(): number {
    return K.breathEvery / (1 + (this.phase === 'woken' ? 1 : this.stir) * 0.6);
  }

  /** Gone already: nothing of it left on the water. */
  vanish(): void {
    this.phase = 'gone';
    this.time = 1e3;
    this.mesh.visible = this.ghost.visible = false;
    swellUniforms.uSurge.value.w = 0;
    swellUniforms.uHeave.value.w = swellUniforms.uHeaveBefore.value.w = 0;
    gladUniforms.uGlad.value.w = 0;
    this.birds.hide();
  }

  /** The eye opens on `at` (and follows it), or closes again under its heavy lid when `null`. */
  look(at: THREE.Vector3 | null): void {
    this.gazing = at !== null;
    if (at) this.gazeAt.copy(at);
  }

  /** The near flipper lifts lazily out of the water, is held up, and is laid back down. False while it already is. */
  liftFlipper(): boolean {
    if (this.liftT >= 0 || (this.phase !== 'resting' && this.phase !== 'woken')) return false;
    this.liftT = 0;
    this.lifts++;
    return true;
  }

  /** One slow blink of its open eye. */
  blink(): void {
    if (this.blinkT < 0) this.blinkT = 0;
  }

  /** Its first full breath: drawn in, then out in a soft column up through the spiral. */
  drawBreath(): void {
    if (this.phase !== 'resting') return;
    this.phase = 'woken';
    this.time = 0;
    this.stir = 1;
    this.onSound?.('whale-breath', this.blowhole.x, this.blowhole.y, this.blowhole.z);
  }

  /**
   * Already past its first full breath, as a save after it resumes: awake, its eye open on `at` from the first frame,
   * or still shut under the weight on it when `at` is null.
   */
  awaken(at: THREE.Vector3 | null): void {
    if (this.phase !== 'resting' && this.phase !== 'woken') return;
    this.phase = 'woken';
    this.time = BREATH_OUT + 1;
    this.stir = 1;
    this.look(at);
    this.skin.uEye.value = this.opened = at ? 1 : 0;
  }

  /** Free: the spout, then its dive: the head down, the back arching under, the flukes raised high once, and away. */
  free(): void {
    if (this.phase !== 'resting' && this.phase !== 'woken') return;
    this.phase = 'free';
    this.time = 0;
    this.stir = 1;
    this.planned = false;
    this.onSound?.('whale-breath', this.blowhole.x, this.blowhole.y, this.blowhole.z);
  }

  update(dt: number, time: number): void {
    this.worldTime = time;
    this.time += dt;
    this.uniforms.uTurn.value = 0;
    if (this.phase === 'gone') {
      if (this.time > 30 && this.time < 1e3) swellUniforms.uSurge.value.w = 0;
      return;
    }
    if (this.phase === 'free') this.leave(dt);
    else this.lieThere(dt);
    this.lift(dt);
    this.locate();
    if (this.sigh.left > 0) {
      this.spray.plume(this.blowhole, this.sigh.far, this.sigh.strength * (this.sigh.left / SIGH_FOR) ** 0.6, dt);
      this.sigh.left -= dt;
    }
    this.lookOut(dt);
    this.wake.update(dt, time);
    this.shedSea(dt);
    this.birds.update(dt, this, this.phase === 'free' ? this.time - SPOUT_FROM : -1, this.blowhole, this.away);
    this.uniforms.uPour.value.y = this.headWet;
    if (this.headWet > 0) {
      for (let i = 0; i < SPINE_N; i++) {
        const head = 1 - THREE.MathUtils.smoothstep((i / (SPINE_N - 1)) * SPINE_END, 0.24, 0.34);
        this.wet[i] = Math.max(this.wet[i], this.headWet * head);
      }
      this.headWet = 0;
    }
    if (this.phase === 'free' && this.time > GONE) {
      this.phase = 'gone';
      this.time = 0;
      this.mesh.visible = this.ghost.visible = false;
      gladUniforms.uGlad.value.w = 0;
      this.birds.hide();
    }
  }

  /**
   * The height of its skin over (x, z) on the head and forward back (snout to mid-back) and the skin's normal there;
   * the height is -Infinity off the body. For whatever has to lie on it.
   */
  surfaceAt(x: number, z: number, out: Skin): Skin {
    out.height = this.topAt(x, z);
    if (out.height === -Infinity) {
      out.normal.set(0, 1, 0);
      return out;
    }
    const e = 0.35;
    const hx = this.topAt(x + e, z);
    const hz = this.topAt(x, z + e);
    out.normal.set(hx === -Infinity ? 0 : out.height - hx, e, hz === -Infinity ? 0 : out.height - hz).normalize();
    return out;
  }

  /** Lying there: slow breaths that only sputter, deeper and quicker as `stir` rises; then its first full breath. */
  private lieThere(dt: number): void {
    let rise: number;
    if (this.phase === 'woken' && this.time < BREATH_OUT + 1) {
      const t = this.time;
      rise = K.breathRise * 2.6 * THREE.MathUtils.smootherstep(t, 0, BREATH_IN)
        * (1 - 0.6 * THREE.MathUtils.smootherstep(t, BREATH_IN, BREATH_OUT + 1));
      if (t >= BREATH_IN && t < BREATH_OUT) this.spray.blowOut(this.blowhole, K.firstBreathHeight, blowing(t - BREATH_IN), dt);
      if (t >= BREATH_IN && t - dt < BREATH_IN) this.onSound?.('whale-blow', this.blowhole.x, this.blowhole.y, this.blowhole.z);
      if (t >= BREATH_IN * 0.5 && t - dt < BREATH_IN * 0.5) this.rises(1.3, 1);
      this.breath = 0.6;
      this.sighed = true;
    } else {
      const deep = this.phase === 'woken' ? 1 : this.stir;
      this.breath += dt / this.breathPeriod();
      if (this.breath >= 1) {
        this.breath -= 1;
        this.sighed = false;
        this.shed = false;
      }
      const b = this.breath;
      if (!this.shed && b > SHEDS_AT) {
        this.shed = true;
        this.rises((1 + deep * 1.2) / 2.2);
      }
      rise = K.breathRise * (1 + deep * 1.2) * (0.5 - 0.5 * Math.cos(Math.PI * 2 * Math.min(1, b / 0.8)));
      if (!this.sighed && b > SIGH_AT) {
        this.sighed = true;
        const strength = 0.6 + deep * 0.8;
        this.mist(strength);
        this.onExhale?.(strength);
        this.onSound?.('whale-sigh', this.blowhole.x, this.blowhole.y, this.blowhole.z);
      }
    }
    const liftRoll = this.liftT < 0 ? 0 : 0.06 * LIFT(this.liftT);
    this.lay(0, rise, 0, 0, K.roll + liftRoll);
    this.uniforms.uCurl.value = REST_CURL;
    // The flipper lies awash: as the body rises with a breath it floats there rather than lifting out of the sea.
    const awash = (rise * breathAt(FIN_S)) / (FIN_LENGTH * this.scale * 0.95);
    this.uniforms.uFin.value.set(K.finRestSweep + Math.sin(this.worldTime * 0.17) * 0.03,
      -K.finRestRaise + awash + Math.sin(this.worldTime * 0.23 + 1) * 0.015);
  }

  /** Free: the deep breath and the spout, its mist over the boat, then its dive. */
  private leave(dt: number): void {
    const t = this.time;
    const draw = THREE.MathUtils.smootherstep(t, 0, SPOUT_FROM) * (1 - THREE.MathUtils.smootherstep(t, SPOUT_TO, SPOUT_TO + 1.8));
    if (t >= SPOUT_FROM && t - dt < SPOUT_FROM) this.onSound?.('whale-blow', this.blowhole.x, this.blowhole.y, this.blowhole.z);
    if (t >= SPOUT_FROM - 1 && t - dt < SPOUT_FROM - 1) this.rises(1.5, 1);
    if (t >= SPOUT_FROM && t < SPOUT_TO) this.spray.blowOut(this.blowhole, K.spoutHeight, blowing(t - SPOUT_FROM), dt, K.spoutBreadth, 1);
    // Its mist comes down over the boat in the gold light.
    const veil = THREE.MathUtils.smoothstep(t, SPOUT_FROM + 1, SPOUT_TO) * (1 - THREE.MathUtils.smoothstep(t, SPOUT_TO + VEIL_FOR - 2, SPOUT_TO + VEIL_FOR));
    if (veil > 0) this.spray.veil(this.blowhole, K.spoutHeight, this.near, veil, dt);
    this.driftClear(t);
    this.lay(0, K.breathRise * 2.4 * draw, 0, 0, K.roll, 1);
    if (!this.planned && t >= D - 3) this.plan();
    if (t >= D) this.dive(t - D);
    this.brighten(t);
    this.uniforms.uCurl.value = REST_CURL * (1 - THREE.MathUtils.smoothstep(t, D - 2, D + 2));
    this.uniforms.uHaze.value = 1 - 0.8 * THREE.MathUtils.smoothstep(t, D + 0.5, D + 6);
    const lower = THREE.MathUtils.smoothstep(t, D - 4, D - 1);
    this.uniforms.uFin.value.set(THREE.MathUtils.lerp(K.finRestSweep, FREE_FIN.x, lower), THREE.MathUtils.lerp(-K.finRestRaise, FREE_FIN.y, lower));
    if (t >= SURGE_AT && t - dt < SURGE_AT) this.surge();
  }

  /**
   * The dive's way, from where it lies clear of the boat: its bend on the water at its blowhole, and how far round
   * it turns as its flukes rise, so their pale undersides open toward the boat rather than stand edge on.
   */
  private plan(): void {
    this.planned = true;
    this.bendFrom.copy(this.point(0, 0, BEND_AT, this.p));
    this.farewell.copy(this.bendFrom).setY(0);
    // Standing up, its underside faces back along the way it goes: turned all the way, that is toward the boat.
    const full = Math.atan2(this.farewell.x - this.near.x, this.farewell.z - this.near.z) - Math.atan2(this.heading.x, this.heading.z);
    this.twist = Math.atan2(Math.sin(full), Math.cos(full)) * TURN_TO_HER;
    let rise = 0;
    for (let c = -30; c < 0; c += 0.25) rise += Math.sin(DIVE_SLOPE(c + 0.125)) * 0.25;
    this.arch = rise;
  }

  /**
   * `t` seconds into its dive: each part of it lies where the dive's way has taken it, glided along its own length
   * through the bend, its head eased down onto the way, its flukes held up over the bend and turned toward her.
   */
  private dive(t: number): void {
    const step = SPINE_STEP * this.scale;
    const down = THREE.MathUtils.smootherstep(t, 0, HEAD_DOWN);
    const glide = glided(t);
    // How far back along it from the snout the bend now lies.
    const at = BEND_AT * BODY_M + glide;
    const stock = at - STOCK * BODY_M;
    const lift = LIFT_BY(stock) * THREE.MathUtils.smoothstep(t, 2, 6);
    const waving = THREE.MathUtils.smoothstep(t, FLUKES_FROM - D + 1.5, FLUKES_FROM - D + 3.5)
      * (1 - THREE.MathUtils.smoothstep(t, UNDER_AT - D - 3, UNDER_AT - D - 1));
    const wave = -Math.sin((t - (FLUKES_FROM - D + 1.5)) * WAVE_PACE) * waving;
    const trail = TRAIL * THREE.MathUtils.smoothstep(lift, 0, 0.2) * (1 - THREE.MathUtils.smootherstep(lift, TRAIL_UNTIL[0], TRAIL_UNTIL[1]));
    // It sounds more steeply as its tail comes to the bend, so by the time its flukes rise the rest of it is under.
    const steeper = 1 + THREE.MathUtils.smoothstep(stock, -45, -10);
    for (let i = 0; i < SPINE_N; i++) {
      const s = (i / (SPINE_N - 1)) * SPINE_END;
      const c = at - i * step;
      const posture = THREE.MathUtils.lerp(1, 1 - THREE.MathUtils.smoothstep(c, -40, -8), down);
      const way = restPitch(s) * posture + down * DIVE_SLOPE(c > 0 ? c * steeper : c);
      const aft = THREE.MathUtils.smoothstep(s, STOCK, STOCK_TO);
      this.pitch[i] = THREE.MathUtils.lerp(way, FLUKES_UP, aft * lift) + THREE.MathUtils.smoothstep(s, 0.9, 0.96) * (WAVE_FLEX * wave + trail);
    }
    let u = 0;
    let y = 0;
    for (let i = 0; i < SPINE_N; i++) {
      this.u[i] = u;
      this.y[i] = y;
      if (i < SPINE_N - 1) {
        const mid = (this.pitch[i] + this.pitch[i + 1]) / 2;
        u -= Math.cos(mid) * step;
        y -= Math.sin(mid) * step;
      }
    }
    // The bend stays where it was on the water, rising a little into its arch, and the body slides through it.
    const fi = at / step;
    const k = Math.min(Math.floor(fi), SPINE_N - 2);
    const f = fi - k;
    const bu = this.u[k] + (this.u[k + 1] - this.u[k]) * f;
    const by = this.y[k] + (this.y[k + 1] - this.y[k]) * f;
    const yaw = this.twist * YAW_SHARE * THREE.MathUtils.smootherstep(lift, YAW_WITH[0], YAW_WITH[1]);
    const h = this.heading;
    h.set(h.x * Math.cos(yaw) + h.z * Math.sin(yaw), 0, h.z * Math.cos(yaw) - h.x * Math.sin(yaw));
    const ay = this.bendFrom.y + this.arch * down;
    for (let i = 0; i < SPINE_N; i++) {
      const du = this.u[i] - bu;
      this.spine[i].set(this.bendFrom.x + h.x * du, ay + this.y[i] - by, this.bendFrom.z + h.z * du, this.pitch[i]);
    }
    // Turned about the stock's own line they tip across by the sine of the turn times how low they still lie.
    const low = Math.cos(this.pitch[SPINE_N - 3]);
    const most = low > TILT ? Math.asin(TILT / low) : Math.PI / 2;
    const turn = Math.min(Math.abs(this.twist) * (1 - YAW_SHARE) * THREE.MathUtils.smootherstep(lift, 0, TILT_WITH), most);
    this.uniforms.uRoll.value = K.roll * (1 - down);
    this.uniforms.uTurn.value = -Math.sign(this.twist) * turn + WAVE_TURN * wave;
    this.uniforms.uCurl.value = 0.25 * wave * lift;
  }

  /** As it spouts free the sea round it clears and fills with light, gathering to where it goes down as it dives. */
  private brighten(t: number): void {
    const glad = THREE.MathUtils.smoothstep(t, SPOUT_FROM, SPOUT_FROM + 3) * (1 - THREE.MathUtils.smootherstep(t, D + 1, UNDER_AT));
    const reach = THREE.MathUtils.lerp(8, K.gladReach, THREE.MathUtils.smootherstep(t, SPOUT_FROM, SPOUT_FROM + 5));
    const into = this.planned ? THREE.MathUtils.smootherstep(t, D, D + HEAD_DOWN) : 0;
    const x = THREE.MathUtils.lerp(this.blowhole.x, this.farewell.x, into);
    const z = THREE.MathUtils.lerp(this.blowhole.z, this.farewell.z, into);
    gladUniforms.uGlad.value.set(x, z, reach, glad * K.gladSea);
    gladUniforms.uGladAxis.value.set(-this.heading.x, -this.heading.z, 0.45 * LENGTH * this.scale * (1 - 0.7 * into));
  }

  /** Turned away about its tail stock (the pivot) and slid off sideways, so its head lies clear of the boat as it spouts. */
  private driftClear(t: number): void {
    const turn = CLEAR_TURN(t) * Math.sign(this.away.x * this.restHeading.z - this.away.z * this.restHeading.x);
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const h = this.restHeading;
    this.heading.set(h.x * c + h.z * s, 0, -h.x * s + h.z * c);
    this.pivot.copy(this.rest).addScaledVector(this.away, CLEAR_SLIDE(t));
  }

  /** The swell it leaves going down, spreading from the arch it bent under through. */
  private surge(): void {
    const h = this.heading;
    const half = 0.12 * BODY_M;
    const centre = this.q.copy(this.farewell).addScaledVector(h, -half);
    const along = THREE.MathUtils.clamp((this.near.x - centre.x) * h.x + (this.near.z - centre.z) * h.z, -half, half);
    const near = Math.hypot(this.near.x - centre.x - h.x * along, this.near.z - centre.z - h.z * along);
    const height = (K.surgeHeight * (12 + near)) / 12;
    swellUniforms.uSurge.value.set(centre.x, centre.z, this.worldTime, height);
    swellUniforms.uSurgeAxis.value.set(h.x, h.z, half);
  }

  /** A weak breath out over the blowhole, a sputter rather than a blow: an updraft there carries it up the spiral. */
  private mist(strength: number): void {
    const at = this.blowhole;
    const far = THREE.MathUtils.clamp(this.seenFrom / 25, 1, 4);
    // Seen from far off, its sigh is a soft plume standing in the haze.
    if (far > 1.6) this.sigh = { left: SIGH_FOR, far, strength };
    const slow = Math.sqrt(far);
    const n = Math.round(14 * strength * K.mist);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = (0.2 + Math.random() * 0.4) * slow;
      this.spray.emit(MIST, at.x + Math.cos(a) * 0.3 * far, at.y + 0.1, at.z + Math.sin(a) * 0.3 * far, Math.cos(a) * out,
        (0.8 + Math.random() * 0.8 * strength) * slow, Math.sin(a) * out, (0.3 + Math.random() * 0.2) * far,
        (2.2 + Math.random() * 1.5) * slow, 0.35, (0.05 + Math.random() * 0.04) * (1 + 0.25 * (far - 1)));
    }
  }

  /** The eye opens on what it is looking at, and closes again under its lid, slowly. */
  private lookOut(dt: number): void {
    const open = this.gazing && this.phase !== 'gone' ? 1 : 0;
    this.opened += (open - this.opened) * (1 - Math.exp(-dt * (open > this.opened ? K.eyeOpening : 0.6)));
    if (this.blinkT >= 0) this.blinkT += dt;
    if (this.blinkT > 1.6) this.blinkT = -1;
    this.tryT = this.struggle > 0 ? (this.tryT + dt) % TRY_EVERY : 0;
    const trying = this.struggle * TRY(this.tryT) * (1 + 0.04 * Math.sin(this.tryT * 23) * THREE.MathUtils.smoothstep(this.tryT, 0.9, 1.2));
    this.skin.uEye.value = Math.max(trying, this.opened * (1 - (this.blinkT < 0 ? 0 : BLINK(this.blinkT))));
    if (!this.gazing) return;
    const d = Math.max(1, this.p.subVectors(this.gazeAt, this.eye).length());
    const g = this.skin.uGaze.value;
    g.x += (THREE.MathUtils.clamp(this.p.dot(this.heading) / d, -1, 1) - g.x) * (1 - Math.exp(-dt * 2));
    g.y += (THREE.MathUtils.clamp((2 * this.p.y) / d, -1, 1) - g.y) * (1 - Math.exp(-dt * 2));
  }

  private lift(dt: number): void {
    if (this.liftT < 0) {
      this.flipperLift = 0;
      this.uniforms.uSlap.value.set(1, 0, 0);
      return;
    }
    const was = this.liftT;
    this.liftT += dt;
    const k = LIFT(this.liftT);
    this.flipperLift = Math.max(0, k);
    const swing = THREE.MathUtils.smoothstep(this.liftT, 0, 2.2) * (1 - THREE.MathUtils.smoothstep(this.liftT, 4.6, LIFT_FOR));
    this.uniforms.uSlap.value.set(1, K.finLift * k, K.finSwing * swing);
    if (was < LIFT_POURS && this.liftT >= LIFT_POURS) {
      const mid = this.finPoint(0.7, this.p);
      this.onSound?.('flipper-pour', mid.x, Math.max(0, mid.y), mid.z);
    }
    if (this.liftT > 0.3 && this.liftT < LIFT_HITS - 0.2) this.drip(dt);
    if (was < LIFT_HITS && this.liftT >= LIFT_HITS) this.splashFin();
    if (this.liftT > LIFT_FOR) this.liftT = -1;
  }

  /**
   * The sea running off the flipper as it comes up out of it: in sheets off the whole of its trailing edge while it
   * rises, thinning to drops as it drains.
   */
  private drip(dt: number): void {
    const size = Math.sqrt(this.scale);
    const pouring = 1 - THREE.MathUtils.smoothstep(this.liftT, 1.2, 3.6);
    const n = Math.floor(dt * (50 + 700 * pouring) + Math.random());
    for (let k = 0; k < n; k++) {
      const e = this.finAt(POURS_FROM + Math.random() * (1 - POURS_FROM), 0.96 + Math.random() * 0.04, this.p);
      if (e.y < 0.12) continue;
      const x = e.x + (Math.random() - 0.5) * 0.06;
      const z = e.z + (Math.random() - 0.5) * 0.06;
      if (Math.random() < 0.15 + 0.75 * pouring) {
        this.spray.emit(DROP, x, e.y - 0.02, z, (Math.random() - 0.5) * 0.03, -0.4 - Math.random() * 0.5, (Math.random() - 0.5) * 0.03,
          (0.0035 + Math.random() * 0.004) * size, 1.6, 0, 0.3 + Math.random() * 0.25);
      } else {
        this.spray.emit(DROP, x, e.y - 0.04, z, (Math.random() - 0.5) * 0.06, -0.2 - Math.random() * 0.4, (Math.random() - 0.5) * 0.06,
          (0.018 + Math.random() * 0.014) * size, 2, 0, 0.65 + Math.random() * 0.3);
      }
    }
  }

  /**
   * Its back rising with a breath `deep` as a waking breath: the sea runs off its top, in broad falls as much as
   * `falls` (0..1), and the sea round it swells out from its flank and settles.
   */
  private rises(deep: number, falls = 0): void {
    this.shedT = 0;
    this.shedBy = deep;
    this.shedFalls = falls;
    const h = this.heading;
    const half = (LYING / 2) * BODY_M;
    const mid = this.point(0, 0, LYING / 2, this.q);
    const at = this.spine[this.at(0.3)];
    const flank = halfWidthAt(0.3, -at.y / (Math.cos(at.w) * this.scale)) * this.scale;
    swellUniforms.uHeaveBefore.value.copy(swellUniforms.uHeave.value);
    swellUniforms.uHeaveAxisBefore.value.copy(swellUniforms.uHeaveAxis.value);
    swellUniforms.uHeave.value.set(mid.x, mid.z, this.worldTime, K.heaveHeight * deep);
    swellUniforms.uHeaveAxis.value.set(h.x, h.z, half, flank);
  }

  /**
   * After each breath the sea runs off its back in glinting sheets down its flanks, and laces white along its
   * waterline where it pours back into the sea.
   */
  private shedSea(dt: number): void {
    if (this.shedT > K.sheetFor + 1) return;
    this.shedT += dt;
    const wet = K.sheetWet * Math.min(1, this.shedBy) * THREE.MathUtils.smoothstep(this.shedT, 0, 0.6)
      * (1 - THREE.MathUtils.smoothstep(this.shedT, 1.5, K.sheetFor));
    this.uniforms.uPour.value.x = Math.max(-2, K.pourFrom - this.shedT * (K.pourSpeed + 0.5 * K.pourFall * this.shedT));
    this.uniforms.uPour.value.z = this.shedFalls;
    for (let i = 0; i < SPINE_N; i++) {
      const s = (i / (SPINE_N - 1)) * SPINE_END;
      const top = THREE.MathUtils.smoothstep(s, 0.08, 0.2) * (1 - THREE.MathUtils.smoothstep(s, 0.72, 0.86));
      this.wet[i] = Math.max(this.wet[i], wet * top);
    }
    // It reaches the sea as its front comes down to the waterline.
    const pouring = this.shedBy * THREE.MathUtils.lerp(K.sheenShed, 1, this.shedFalls)
      * THREE.MathUtils.smoothstep(this.shedT, 1.3, 2.1) * (1 - THREE.MathUtils.smoothstep(this.shedT, 3, 5));
    this.drops(pouring, dt);
    const n = Math.floor(dt * 30 * pouring + Math.random());
    const h = this.heading;
    for (let k = 0; k < n; k++) {
      const s = 0.18 + Math.random() * 0.5;
      const P = this.spine[this.at(s)];
      const c = Math.cos(P.w);
      const half = halfWidthAt(s, -P.y / (c * this.scale)) * this.scale;
      if (half <= 0) continue;
      const side = Math.random() < 0.7 ? 1 : -1;
      const out = half + 0.2 + Math.random() * 0.8;
      const x = P.x + h.z * side * out;
      const z = P.z - h.x * side * out;
      // Lace laid over the flipper lying awash would draw as white threads across its dark blade.
      if (side > 0 && this.overFin(x, z)) continue;
      this.foam.add(FOAM, x, z, 0.6 + Math.random() * 0.8, 3 + Math.random() * 2.5,
        this.worldTime, 0.2 + Math.random() * 0.2, 0.3 + Math.random() * 0.3, Math.atan2(h.z, h.x), 1.2 + Math.random() * 0.6);
    }
  }

  /** Whether (x, z) lies within reach of the near flipper's blade. */
  private overFin(x: number, z: number): boolean {
    const r = this.finRoot;
    const dx = this.finTip.x - r.x;
    const dz = this.finTip.z - r.z;
    const t = THREE.MathUtils.clamp(((x - r.x) * dx + (z - r.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    return Math.hypot(x - r.x - dx * t, z - r.z - dz * t) < 2.8;
  }

  /** Where its falls meet the sea, strings of drops running off the flank just over the waterline, mostly on the near side. */
  private drops(pouring: number, dt: number): void {
    const size = Math.sqrt(this.scale);
    const n = Math.floor(dt * K.pourDrops * pouring + Math.random());
    for (let k = 0; k < n; k++) {
      const s = 0.12 + Math.random() * 0.66;
      const y = TOP(s) * Math.random() * 0.45;
      const e = this.point(flankAt(s, y) * 1.01 * (Math.random() < 0.75 ? 1 : -1), y, s, this.p);
      if (e.y < 0.1 || e.y > 1.6) continue;
      this.spray.emit(DROP, e.x, e.y, e.z, (Math.random() - 0.5) * 0.1, -0.5 - Math.random() * 0.8, (Math.random() - 0.5) * 0.1,
        (0.01 + Math.random() * 0.012) * size, 1.2, 0, 0.55 + Math.random() * 0.35);
    }
  }

  /**
   * The sea streaming off its head where the net has just come off it, sheeting down the skin and running off the
   * near flank in strings of drops, `wet` 0..1 as much as there is. Asked for each frame it streams.
   */
  stream(wet: number, dt: number): void {
    this.headWet = wet;
    const size = Math.sqrt(this.scale) * 1.6;
    const n = Math.floor(dt * 200 * wet + Math.random());
    for (let k = 0; k < n; k++) {
      const [s, up] = STREAMS[Math.floor(Math.random() * STREAMS.length)];
      const y = TOP(s) * (up + (Math.random() - 0.5) * 0.04);
      const e = this.point(flankAt(s, y) * 1.01, y, s + (Math.random() - 0.5) * 0.004, this.p);
      if (e.y < 0.2) continue;
      this.spray.emit(DROP, e.x, e.y, e.z, (Math.random() - 0.5) * 0.05, -0.8 - Math.random() * 0.6, (Math.random() - 0.5) * 0.05,
        (0.012 + Math.random() * 0.012) * size, 2, 0, 0.55 + Math.random() * 0.35);
    }
  }

  /** Laid back down on the water: white water along it. */
  private splashFin(): void {
    const tip = this.finPoint(0.85, this.p);
    const mid = this.finPoint(0.45, this.q);
    const size = Math.sqrt(this.scale);
    this.spray.splash(tip.x, tip.z, 0.9 * size, 0.45);
    this.spray.splash(mid.x, mid.z, 0.7 * size, 0.3);
    this.onSound?.('whale-slap', tip.x, 0, tip.z);
  }

  /** Every part that is watched or held this frame, where it is in the world. */
  private locate(): void {
    this.point(0, crown(BLOWHOLE), BLOWHOLE, this.blowhole);
    this.point(EYE_X, EYE_Y, EYE_S, this.eye);
    this.point(JAW_X, JAW_Y, JAW_S, this.jaw);
    this.finPoint(0, this.finRoot);
    this.finPoint(1, this.finTip);
    this.point(0, TOP(0.45), 0.45, this.back);
    this.point(0, 0, 1, this.flukes);
  }

  /** A point on the near flipper `t` out along it and `along` across its chord, posed as the shader poses it, in the world. */
  private finAt(t: number, along: number, out: THREE.Vector3): THREE.Vector3 {
    const fin = this.uniforms.uFin.value;
    const lift = this.uniforms.uSlap.value;
    finSurface(t, along, out).multiplyScalar(DREAM_SHAPE.fin).applyAxisAngle(FIN_DIR, -lift.y * tuning.whaleLook.finTurn);
    rotZ(out, lift.y - fin.y);
    rotY(out, fin.x + lift.z);
    out.add(FIN_ROOT);
    return this.point(out.x, out.y, -out.z / LENGTH, out);
  }

  /** A point `t` of the way out along the near flipper, posed as the shader poses it, in the world. */
  private finPoint(t: number, out: THREE.Vector3): THREE.Vector3 {
    const fin = this.uniforms.uFin.value;
    const lift = this.uniforms.uSlap.value;
    out.copy(FIN_DIR).multiplyScalar(t * FIN_LENGTH);
    rotZ(out, lift.y - fin.y);
    rotY(out, fin.x + lift.z);
    out.add(FIN_ROOT);
    return this.point(out.x, out.y, -out.z / LENGTH, out);
  }

  /** The top of the skin over (x, z), or -Infinity where that is not over the head and forward back. */
  private topAt(x: number, z: number): number {
    const h = this.heading;
    const nose = this.spine[0];
    const s = ((nose.x - x) * h.x + (nose.z - z) * h.z) / (LENGTH * this.scale);
    if (s < 0.01 || s > 0.5) return -Infinity;
    const fi = (s / SPINE_END) * (SPINE_N - 1);
    const i = Math.min(Math.floor(fi), SPINE_N - 2);
    const a = this.spine[i];
    const b = this.spine[i + 1];
    const f = fi - i;
    const spineY = a.y + (b.y - a.y) * f;
    const pitch = a.w + (b.w - a.w) * f;
    const across = ((x - nose.x) * h.z - (z - nose.z) * h.x) / this.scale;
    const roll = this.uniforms.uRoll.value;
    const c = Math.cos(roll);
    const sn = Math.sin(roll);
    let top = -Infinity;
    let px = 0;
    let py = 0;
    for (let j = 0; j <= 48; j++) {
      ringPoint(s, (j / 48) * Math.PI * 2, this.ring);
      const rx = c * this.ring.x - sn * this.ring.y;
      const ry = sn * this.ring.x + c * this.ring.y;
      if (j > 0 && (px - across) * (rx - across) <= 0 && rx !== px) top = Math.max(top, py + ((ry - py) * (across - px)) / (rx - px));
      px = rx;
      py = ry;
    }
    return top === -Infinity ? top : spineY + top * this.scale * Math.cos(pitch);
  }

  /** Index of the spine sample nearest `s`. */
  private at(s: number): number {
    return Math.round((s / SPINE_END) * (SPINE_N - 1));
  }

  /** Pitch along the body, from the rest pose tipped head down by `dip` and the tail stock lifted by `tail`. */
  private bend(dip: number, tail: number): void {
    let u = 0;
    let y = 0;
    for (let i = 0; i < SPINE_N; i++) {
      const s = (i / (SPINE_N - 1)) * SPINE_END;
      const aft = THREE.MathUtils.smoothstep(s, PIVOT - 0.1, PIVOT + 0.15);
      this.pitch[i] = restPitch(s) * (1 - Math.min(1, Math.abs(dip) * 4)) + dip + tail * aft;
    }
    for (let i = 0; i < SPINE_N; i++) {
      this.u[i] = u;
      this.y[i] = y;
      if (i < SPINE_N - 1) {
        const mid = (this.pitch[i] + this.pitch[i + 1]) / 2;
        u -= Math.cos(mid) * SPINE_STEP * this.scale;
        y -= Math.sin(mid) * SPINE_STEP * this.scale;
      }
    }
  }

  /**
   * Poses the spine about the pivot: sunk by `sink`, its back lifted by `rise`, tipped by `dip` and `tail`, rolled by
   * `roll`, its head lifted by `head` of the rise.
   */
  private lay(sink: number, rise: number, dip: number, tail: number, roll: number, head = 0.3): void {
    this.bend(dip, tail);
    const k = this.at(PIVOT);
    const h = this.heading;
    const py = this.pivot.y + sink;
    for (let i = 0; i < SPINE_N; i++) {
      const du = this.u[i] - this.u[k];
      const lift = rise * breathAt((i / (SPINE_N - 1)) * SPINE_END, head);
      this.spine[i].set(this.pivot.x + h.x * du, py + lift + this.y[i] - this.y[k], this.pivot.z + h.z * du, this.pitch[i]);
    }
    this.uniforms.uRoll.value = roll;
  }
}

function rotZ(p: THREE.Vector3, a: number): void {
  const c = Math.cos(a);
  const s = Math.sin(a);
  p.set(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

function rotY(p: THREE.Vector3, a: number): void {
  const c = Math.cos(a);
  const s = Math.sin(a);
  p.set(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

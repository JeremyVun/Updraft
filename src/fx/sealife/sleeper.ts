import * as THREE from 'three';
import { tuning } from '../../tuning';
import { swellUniforms } from '../../world/water/swell';
import { BLOWHOLE, FIN_DIR, FIN_ROOT, FIN_SPAN, LENGTH, SPINE_END, TOP, crown, flankAt, ringPoint } from './anatomy';
import { curve } from './curve';
import type { Marks } from './marks';
import { DROP, MIST, type Spray } from './spray';
import { WhaleWake, type WhaleSound } from './wake';
import { DREAM_SHAPE, SPINE_N, SPINE_STEP, WhaleRig } from './whale';

/** Where along the flipper the sea pours off it as it lifts (0 root .. 1 tip). */
const POURS = [0.38, 0.5, 0.61, 0.73, 0.84, 0.95];

export type SleeperSound = WhaleSound | 'whale-sigh' | 'whale-breath' | 'whale-slap' | 'flipper-pour';

const K = tuning.netWhale;
/** The tail stock, behind the hump: what the body tips over as it lifts its flukes. */
const PIVOT = 0.75;
const CREST = 0.55;
/** The eye on the near side of the head, in the rest pose: along, up, and out on the skin there. */
const EYE_S = 0.16;
const EYE_Y = 0.17;
const EYE_X = flankAt(EYE_S, EYE_Y);
/** The lower jaw on the near side, at the waterline. */
const JAW_S = 0.07;
const JAW_Y = -0.12;
const JAW_X = flankAt(JAW_S, JAW_Y);
const FIN_LENGTH = FIN_SPAN * DREAM_SHAPE.fin;
/** Rolling free it lays its flippers back along its flanks, so on its back they lie low rather than stand up. */
const FREE_FIN = new THREE.Vector2(0.95, -0.4);
/** Lying at the surface the fluke tips curl up a little at the far end. */
const REST_CURL = 0.5;
/** The first full breath, in seconds: drawn in, then out in a soft column up through the spiral. */
const BREATH_IN = 1.4;
const BREATH_OUT = 3.6;
/**
 * Free, in seconds: a long breath drawn while it drifts clear of the boat and the pod comes, the spout, then it rolls
 * onto its back, lifts its flukes and waves them, and goes under.
 */
const SPOUT_FROM = 6;
const SPOUT_TO = 8.8;
const ROLL = curve([[0, 0], [10.5, 0], [14.5, 3.05], [21.5, 3.05], [24.5, 2.2], [28.5, 1.2]]);
const SINK = curve([[0, 0], [10.5, 0], [14.5, -3.6], [20.5, -3.8], [23.5, -5.5], [28.5, -22]]);
const TAIL = curve([[0, 0], [14, 0], [16.5, -0.62], [21, -0.66], [23.5, -0.25], [25.5, 0]]);
const DIP = curve([[0, 0], [20.5, 0], [23.5, -0.12], [28.5, -0.3]]);
const WAVE_FROM = 16.5;
const WAVE_TO = 21.5;
const SURGE_AT = 21;
const RELEASE_AT = 20.5;
const GONE = 29.5;
/** Seconds into being free when it is looking at its flukes rather than its breath. */
export const FREE_FLUKES_FROM = 13.5;
/**
 * Free, it drifts clear of the boat before it spouts: its head swung away about the tail stock (radians) and its
 * body slid away sideways (m), over seconds.
 */
const CLEAR_TURN = curve([[0, 0], [0.8, 0], [7.5, 0.05], [12, 0.06]]);
const CLEAR_SLIDE = curve([[0, 0], [0.8, 0], [7.5, 1.6], [12, 2]]);
/** The near flipper's lazy lift: up over two seconds, held, and laid back down on the water. */
const LIFT = curve([[0, 0], [0.4, 0.12], [1.8, 0.95], [3, 1], [4.2, 0.35], [4.7, -0.04], [5.2, 0]]);
const LIFT_HITS = 4.6;
const LIFT_POURS = 0.7;
const LIFT_FOR = 5.2;

/** The head carried a little higher than the tail, so the eye and blowhole stand clear and the flukes lie just under. */
function restPitch(s: number): number {
  return 0.1 * (1 - THREE.MathUtils.smoothstep(s, 0.3, 0.6)) - 0.01 * THREE.MathUtils.smoothstep(s, 0.72, 0.95);
}

/** The height of the skin and its normal at a point, from `surfaceAt`. */
export interface Skin {
  height: number;
  readonly normal: THREE.Vector3;
}

/**
 * The whale lying at the surface beside the boat, worn out: from far off a long low island that breathes. Its weak
 * breaths only sputter; given its first full breath its eye opens; free, it spouts, rolls onto its back, lifts its
 * flukes high as if waving, and goes under, and the swell it leaves lifts the boat.
 */
export class SleepingWhale extends WhaleRig {
  phase: 'resting' | 'woken' | 'free' | 'gone' = 'gone';
  /** Seconds into the current phase. */
  time = 0;
  /** How far toward its first full breath the player's wind has brought it, 0..1: it breathes deeper as it does. */
  stir = 0;
  /** Frames a gust has spent crossing its back, and the lazy lifts of the flipper they drew, since it lay down. */
  tickles = 0;
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
  /** How far the near flipper is lifted, 0..1. */
  flipperLift = 0;
  /** Each weak breath out, with how strong it was: what the net over the blowhole has to answer. */
  onExhale: ((strength: number) => void) | null = null;
  onSound: ((kind: SleeperSound, x: number, y: number, z: number) => void) | null = null;
  private readonly wake: WhaleWake;
  private readonly pivot = new THREE.Vector3();
  private readonly rest = new THREE.Vector3();
  private readonly restHeading = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private readonly gazeAt = new THREE.Vector3();
  private gazing = false;
  private breath = 0;
  private sighed = true;
  private shiverS = 0;
  private shiverDir = 1;
  private shiverAmp = 0;
  private liftT = -1;
  private liftCool = 0;
  private surgeNear = 12;
  private worldTime = 0;
  private readonly u = new Float32Array(SPINE_N);
  private readonly y = new Float32Array(SPINE_N);
  private readonly pitch = new Float32Array(SPINE_N);
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Vector3();
  private readonly ring = { x: 0, y: 0 };

  constructor(private readonly spray: Spray, foam: Marks, slicks: Marks) {
    super();
    this.wake = new WhaleWake(this, spray, foam, slicks);
    this.wake.onSound = (kind, x, y, z) => this.onSound?.(kind, x, y, z);
  }

  /** It has drawn its first full breath: from here on it is awake. */
  get awake(): boolean {
    return this.phase === 'woken' || this.phase === 'free';
  }

  /** The tall plume it throws up as it is free: the moment the open sea is won. */
  get spouting(): boolean {
    return this.phase === 'free' && this.time >= SPOUT_FROM && this.time < SPOUT_TO;
  }

  /** On its back with its flukes up out of the water: the time to wave. */
  get fluking(): boolean {
    return this.phase === 'free' && this.time > WAVE_FROM - 1 && this.time < WAVE_TO + 1;
  }

  /** Going under, or gone: the boat may go, and the pod with it. */
  get going(): boolean {
    return (this.phase === 'free' && this.time >= RELEASE_AT) || this.phase === 'gone';
  }

  /**
   * Lays it resting with its near eye over `eye` (only x and z are kept) and its snout along `noseYaw`, rolled near
   * side up. `near` is where the boat rests, for how high its swell is there.
   */
  lie(eye: THREE.Vector3, noseYaw: number, near: THREE.Vector3): void {
    this.phase = 'resting';
    this.time = 0;
    this.stir = 0;
    this.tickles = this.lifts = 0;
    this.heading.set(Math.sin(noseYaw), 0, Math.cos(noseYaw));
    this.bend(0, 0);
    const iP = this.at(PIVOT);
    const iC = this.at(CREST);
    this.rest.set(0, K.crest - TOP(CREST) * this.scale - (this.y[iC] - this.y[iP]), 0);
    this.pivot.copy(this.rest);
    this.lay(0, 0, 0, 0, K.roll);
    this.point(EYE_X, EYE_Y, EYE_S, this.p);
    this.rest.x = eye.x - this.p.x;
    this.rest.z = eye.z - this.p.z;
    this.pivot.copy(this.rest);
    this.lay(0, 0, 0, 0, K.roll);
    this.point(0, 0, 0.5, this.q);
    this.surgeNear = Math.hypot(near.x - this.q.x, near.z - this.q.z);
    this.restHeading.copy(this.heading);
    this.away.set(-this.heading.z, 0, this.heading.x);
    if (this.away.x * (eye.x - near.x) + this.away.z * (eye.z - near.z) < 0) this.away.negate();
    this.shiverAmp = 0;
    this.liftT = -1;
    this.liftCool = 0;
    this.flipperLift = 0;
    this.skin.uEye.value = 0;
    this.gazing = false;
    this.wake.reset(true);
    this.uniforms.uCurl.value = REST_CURL;
    this.uniforms.uFin.value.set(K.finRestSweep, -K.finRestRaise);
    this.uniforms.uSlap.value.set(1, 0, 0);
    this.locate();
    this.mesh.visible = this.ghost.visible = true;
  }

  /** Gone already: nothing of it left on the water. */
  vanish(): void {
    this.phase = 'gone';
    this.time = 1e3;
    this.mesh.visible = this.ghost.visible = false;
    swellUniforms.uSurge.value.w = 0;
  }

  /** The eye opens on `at` (and follows it), or closes again under its heavy lid when `null`. */
  look(at: THREE.Vector3 | null): void {
    this.gazing = at !== null;
    if (at) this.gazeAt.copy(at);
  }

  /**
   * A gust across its back at `s` (0 snout .. 1 flukes), running toward the flukes when `along` is positive: the skin
   * shivers along the stroke, and now and then the near flipper comes up lazily. It never wakes it.
   */
  tickle(s: number, along: number, strength: number, mayLift = true): void {
    if (this.phase !== 'resting' && this.phase !== 'woken') return;
    if (this.shiverAmp < 0.02 || Math.abs(s - this.shiverS) > 0.2) {
      this.shiverS = s;
      this.shiverDir = Math.sign(along) || 1;
    }
    this.shiverAmp = Math.min(0.06, Math.max(this.shiverAmp, 0.035 + 0.025 * strength));
    this.tickles++;
    if (mayLift && this.liftCool <= 0 && this.liftFlipper()) this.liftCool = K.liftEvery;
  }

  /** The near flipper lifts lazily out of the water, is held up, and is laid back down. False while it already is. */
  liftFlipper(): boolean {
    if (this.liftT >= 0 || (this.phase !== 'resting' && this.phase !== 'woken')) return false;
    this.liftT = 0;
    this.lifts++;
    return true;
  }

  /** Its first full breath: drawn in, then out in a soft column up through the spiral. */
  drawBreath(): void {
    if (this.phase !== 'resting') return;
    this.phase = 'woken';
    this.time = 0;
    this.stir = 1;
    this.onSound?.('whale-breath', this.blowhole.x, this.blowhole.y, this.blowhole.z);
  }

  /** Already past its first full breath, as a save after it resumes: awake, its eye open on `at` from the first frame. */
  awaken(at: THREE.Vector3): void {
    if (this.phase !== 'resting' && this.phase !== 'woken') return;
    this.phase = 'woken';
    this.time = BREATH_OUT + 1;
    this.stir = 1;
    this.look(at);
    this.skin.uEye.value = 1;
  }

  /** Free: the spout, the roll onto its back, the flukes lifted high, and away under the sea. */
  free(): void {
    if (this.phase !== 'resting' && this.phase !== 'woken') return;
    this.phase = 'free';
    this.time = 0;
    this.stir = 1;
    this.onSound?.('whale-breath', this.blowhole.x, this.blowhole.y, this.blowhole.z);
  }

  update(dt: number, time: number): void {
    this.worldTime = time;
    this.time += dt;
    if (this.phase === 'gone') {
      if (this.time > 30 && this.time < 1e3) swellUniforms.uSurge.value.w = 0;
      return;
    }
    this.liftCool = Math.max(0, this.liftCool - dt);
    if (this.phase === 'free') this.leave(dt);
    else this.lieThere(dt);
    this.shiverS = THREE.MathUtils.clamp(this.shiverS + this.shiverDir * 0.18 * dt, 0.05, 0.95);
    this.shiverAmp *= Math.exp(-dt * 1.8);
    this.uniforms.uShiver.value.set(this.shiverS, this.shiverAmp, 0.05);
    this.lift(dt);
    this.locate();
    this.lookOut(dt);
    this.wake.update(dt, time);
    if (this.phase === 'free' && this.time > GONE) {
      this.phase = 'gone';
      this.time = 0;
      this.mesh.visible = this.ghost.visible = false;
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
      if (t >= BREATH_IN && t < BREATH_OUT) {
        const k = (t - BREATH_IN) / (BREATH_OUT - BREATH_IN);
        this.spray.jet(this.blowhole, K.firstBreathHeight, 0.45 * Math.sin(Math.PI * Math.min(1, k * 1.4)) ** 0.5, dt);
      }
      if (t >= BREATH_IN && t - dt < BREATH_IN) this.onSound?.('whale-blow', this.blowhole.x, this.blowhole.y, this.blowhole.z);
      this.breath = 0.6;
      this.sighed = true;
    } else {
      const deep = this.phase === 'woken' ? 1 : this.stir;
      this.breath += dt / (K.breathEvery / (1 + deep * 0.6));
      if (this.breath >= 1) {
        this.breath -= 1;
        this.sighed = false;
      }
      const b = this.breath;
      rise = K.breathRise * (1 + deep * 1.2) * (0.5 - 0.5 * Math.cos(Math.PI * 2 * Math.min(1, b / 0.8)));
      if (!this.sighed && b > 0.42) {
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
    const awash = rise / (FIN_LENGTH * this.scale * 0.95);
    this.uniforms.uFin.value.set(K.finRestSweep + Math.sin(this.worldTime * 0.17) * 0.03,
      -K.finRestRaise + awash + Math.sin(this.worldTime * 0.23 + 1) * 0.015);
  }

  /** Free: the deep breath and the spout, then onto its back, flukes up and waving, and away under. */
  private leave(dt: number): void {
    const t = this.time;
    const draw = THREE.MathUtils.smootherstep(t, 0, SPOUT_FROM) * (1 - THREE.MathUtils.smootherstep(t, SPOUT_TO, SPOUT_TO + 1.8));
    if (t >= SPOUT_FROM && t - dt < SPOUT_FROM) this.onSound?.('whale-blow', this.blowhole.x, this.blowhole.y, this.blowhole.z);
    if (t >= SPOUT_FROM && t < SPOUT_TO) {
      const k = (t - SPOUT_FROM) / (SPOUT_TO - SPOUT_FROM);
      this.spray.jet(this.blowhole, K.spoutHeight, Math.sin(Math.PI * Math.min(1, k * 1.6)) ** 0.5 * (1 - k * 0.3), dt);
    }
    const wave = THREE.MathUtils.smoothstep(t, WAVE_FROM, WAVE_FROM + 1) * (1 - THREE.MathUtils.smoothstep(t, WAVE_TO - 1, WAVE_TO));
    const sway = Math.sin((t - WAVE_FROM) * 2.1) * wave;
    this.driftClear(t);
    this.lay(SINK(t), K.breathRise * 2.4 * draw, DIP(t), TAIL(t) + 0.05 * sway, K.roll + ROLL(t) + 0.22 * sway);
    this.uniforms.uCurl.value = REST_CURL * (1 - THREE.MathUtils.smoothstep(t, 8.5, 12.5)) + 0.3 * sway;
    const lower = THREE.MathUtils.smoothstep(t, 6.5, 9.5);
    this.uniforms.uFin.value.set(THREE.MathUtils.lerp(K.finRestSweep, FREE_FIN.x, lower), THREE.MathUtils.lerp(-K.finRestRaise, FREE_FIN.y, lower));
    if (t >= SURGE_AT && t - dt < SURGE_AT) this.surge();
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

  /** The swell the body leaves as it goes under, spreading from its whole length. */
  private surge(): void {
    const centre = this.point(0, 0, 0.5, this.q);
    const height = K.surgeHeight * (12 + this.surgeNear) / 12;
    swellUniforms.uSurge.value.set(centre.x, centre.z, this.worldTime, height);
    swellUniforms.uSurgeAxis.value.set(this.heading.x, this.heading.z, 0.3 * LENGTH * this.scale);
  }

  /** A weak breath out over the blowhole, a sputter rather than a blow: an updraft there carries it up the spiral. */
  private mist(strength: number): void {
    const at = this.blowhole;
    const n = Math.round(14 * strength * K.mist);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = 0.2 + Math.random() * 0.4;
      this.spray.emit(MIST, at.x + Math.cos(a) * 0.3, at.y + 0.1, at.z + Math.sin(a) * 0.3, Math.cos(a) * out,
        0.8 + Math.random() * 0.8 * strength, Math.sin(a) * out, 0.3 + Math.random() * 0.2, 2.2 + Math.random() * 1.5, 0.35,
        0.05 + Math.random() * 0.04);
    }
  }

  /** The eye opens on what it is looking at, and closes again under its lid, slowly. */
  private lookOut(dt: number): void {
    const open = this.gazing && this.phase !== 'gone' ? 1 : 0;
    const eye = this.skin.uEye;
    eye.value += (open - eye.value) * (1 - Math.exp(-dt * (open > eye.value ? 1.3 : 0.6)));
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
    const swing = THREE.MathUtils.smoothstep(this.liftT, 0, 1.5) * (1 - THREE.MathUtils.smoothstep(this.liftT, 3.4, LIFT_FOR));
    this.uniforms.uSlap.value.set(1, K.finLift * k, K.finSwing * swing);
    if (was < LIFT_POURS && this.liftT >= LIFT_POURS) {
      const mid = this.finPoint(0.7, this.p);
      this.onSound?.('flipper-pour', mid.x, Math.max(0, mid.y), mid.z);
    }
    if (this.liftT > 0.3 && this.liftT < LIFT_HITS - 0.2) this.drip(dt);
    if (was < LIFT_HITS && this.liftT >= LIFT_HITS) this.splashFin();
    if (this.liftT > LIFT_FOR) this.liftT = -1;
  }

  /** The sea running off the flipper as it comes up out of it, in strings of drops from the low places along its edge. */
  private drip(dt: number): void {
    const size = Math.sqrt(this.scale);
    const n = Math.floor(dt * 90 + Math.random());
    for (let k = 0; k < n; k++) {
      const at = POURS[Math.floor(Math.random() * POURS.length)];
      const e = this.finPoint(at + (Math.random() - 0.5) * 0.015, this.p);
      if (e.y < 0.15) continue;
      this.spray.emit(DROP, e.x + (Math.random() - 0.5) * 0.08, e.y - 0.1, e.z + (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.05, -0.6 - Math.random() * 0.5, (Math.random() - 0.5) * 0.05,
        (0.01 + Math.random() * 0.012) * size, 2, 0, 0.5 + Math.random() * 0.4);
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

  /** Poses the spine about the pivot: sunk by `sink`, lifted by `rise`, tipped by `dip` and `tail`, rolled by `roll`. */
  private lay(sink: number, rise: number, dip: number, tail: number, roll: number): void {
    this.bend(dip, tail);
    const k = this.at(PIVOT);
    const h = this.heading;
    const py = this.pivot.y + sink + rise;
    for (let i = 0; i < SPINE_N; i++) {
      const du = this.u[i] - this.u[k];
      this.spine[i].set(this.pivot.x + h.x * du, py + this.y[i] - this.y[k], this.pivot.z + h.z * du, this.pitch[i]);
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

import * as THREE from 'three';
import { tuning } from '../../tuning';
import { swellUniforms } from '../../world/water/swell';
import { BLOWHOLE, FIN_ROOT, LENGTH, SPINE_END, TOP } from './anatomy';
import { curve } from './curve';
import type { Marks } from './marks';
import { PerchedGull, type GullSound } from './perched-gull';
import { DROP, MIST, type Spray } from './spray';
import { WhaleWake, type WhaleSound } from './wake';
import { SPINE_N, SPINE_STEP, WhaleRig } from './whale';

export type SleeperSound = WhaleSound | GullSound | 'whale-sigh' | 'whale-breath' | 'whale-slap';

const K = tuning.sleepingWhale;
/** The tail stock, behind the hump: what the body turns about and tips over as it leaves. */
const PIVOT = 0.75;
const CREST = 0.55;
/** The waking, in seconds: the breath is drawn, the eye opens, the spout, and then it goes. */
const DRAWN = 1.6;
const SPOUT_FROM = 1.7;
const SPOUT_TO = 3.9;
const LEAVE = 5;
/** The leaving, in seconds: rolled away and sinking while it turns its head out ahead, then the flukes. */
const SINK = curve([[0, 0], [2, -0.5], [6, -2.4], [9, -2.7], [11, -2.2], [14, -2.3], [17.5, -8]]);
const DIP = curve([[0, 0], [2, -0.06], [6, -0.25], [9, -0.55], [11, -0.7], [14, -0.75], [17.5, -1.1]]);
const TAIL = curve([[0, 0], [7.5, 0], [9.5, -0.3], [11, -0.42], [13.5, -0.38], [16, -0.1], [18, 0]]);
const ROLL = curve([[0, 0], [3, 0.4], [7, 0.3], [9.5, 0]]);
const WAVE_FROM = 10.5;
const WAVE_TO = 14.5;
const SURGE_AT = 6;
const GONE = 18.5;
/** The flipper's lazy slap: lifted (radians) over its first second, then down onto the water. */
const SLAP = curve([[0, 0], [0.45, 0.6], [0.85, 1.3], [1.0, 1.35], [1.15, 0.3], [1.3, -0.05], [1.8, 0]]);
const SLAP_HITS = 1.2;
const SLAP_FOR = 1.8;
/** A slender blue-grey sleeper rather than the first crossing's humpback: short flippers, small flukes. */
const FIN_SCALE = 0.62;
const FLUKE_SCALE = 0.62;
const FIN_SPAN = 4.5 * FIN_SCALE;
const GULL_SIZE = 2;
const FIN_DIR = new THREE.Vector3(0.8, -0.3, -0.52).normalize();
const REST_FIN = new THREE.Vector2(0.35, 0.3);
/** Asleep, the fluke tips curl up out of the water at the far end. */
const REST_CURL = 0.7;

/** The head carried a little higher than the tail, so the eye is just out of the water and the flukes just under it. */
function restPitch(s: number): number {
  return 0.1 * (1 - THREE.MathUtils.smoothstep(s, 0.3, 0.6)) - 0.01 * THREE.MathUtils.smoothstep(s, 0.72, 0.95);
}

/**
 * The whale asleep across the way: lying at the surface like a long low island, breathing slowly. Gusts only tickle
 * it; woken, it draws a breath, opens its eye, spouts, rolls away and sinks with its flukes lifted high.
 */
export class SleepingWhale extends WhaleRig {
  phase: 'asleep' | 'waking' | 'leaving' | 'gone' = 'gone';
  /** Seconds into the current phase. */
  time = 0;
  /** How far the player's circling over the blowhole has got toward waking it, 0..1: it breathes deeper as it does. */
  stir = 0;
  /** Frames a gust has spent crossing its back, and the flipper slaps that answered, since it lay down. */
  tickles = 0;
  slaps = 0;
  readonly gull = new PerchedGull(GULL_SIZE);
  readonly blowhole = new THREE.Vector3();
  /** The middle of the back above the water, for a glance. */
  readonly back = new THREE.Vector3();
  readonly flukes = new THREE.Vector3();
  onSound: ((kind: SleeperSound, x: number, y: number, z: number) => void) | null = null;
  private readonly wake: WhaleWake;
  private readonly pivot = new THREE.Vector3();
  private readonly rest = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private yaw0 = 0;
  private yaw1 = 0;
  private breath = 0;
  private sighed = true;
  private shiverS = 0;
  private shiverDir = 1;
  private shiverAmp = 0;
  private slapT = -1;
  private slapCool = 0;
  private surgeNear = 10;
  private worldTime = 0;
  private readonly u = new Float32Array(SPINE_N);
  private readonly y = new Float32Array(SPINE_N);
  private readonly pitch = new Float32Array(SPINE_N);
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Vector3();

  constructor(private readonly spray: Spray, foam: Marks, slicks: Marks) {
    super(K.scale);
    this.uniforms.uShape.value.set(FIN_SCALE, 0.3, FLUKE_SCALE);
    this.skin.uBack.value.set('#34505e');
    this.skin.uFill.value.set(0.05, 0.06, 0.09);
    this.skin.uDetail.value.set(0.15, 0.5, 0.06, 0.3);
    this.skin.uEyeAt.value.set(0.16, 0.12, 1.8);
    this.wake = new WhaleWake(this, spray, foam, slicks);
    this.wake.onSound = (kind, x, y, z) => this.onSound?.(kind, x, y, z);
    this.gull.onSound = (kind, at) => this.onSound?.(kind, at.x, at.y, at.z);
  }

  /** It has drawn its waking breath: from here it is awake, whatever comes after. */
  get awake(): boolean {
    return this.phase === 'leaving' || this.phase === 'gone' || (this.phase === 'waking' && this.time >= DRAWN);
  }

  /** Its flukes are up out of the water: the time to wave. */
  get fluking(): boolean {
    return this.phase === 'leaving' && this.time > WAVE_FROM - 0.5 && this.time < WAVE_TO + 1;
  }

  /**
   * Lays it asleep broadside across the way: body centre at `centre`, snout pointing along `yaw`, and when it goes
   * it turns out toward `awayYaw`. `near` is where the boat will rest, for how high its swell is there.
   */
  lie(centre: THREE.Vector3, yaw: number, awayYaw: number, near: THREE.Vector3): void {
    this.phase = 'asleep';
    this.time = 0;
    this.stir = 0;
    this.tickles = this.slaps = 0;
    this.yaw0 = yaw;
    this.yaw1 = awayYaw;
    this.away.set(Math.sin(awayYaw), 0, Math.cos(awayYaw));
    this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.bend(0, 0);
    const iP = this.at(PIVOT);
    const iM = this.at(0.5);
    const iC = this.at(CREST);
    const along = this.u[iP] - this.u[iM];
    this.rest.set(centre.x + this.heading.x * along, 0, centre.z + this.heading.z * along);
    this.rest.y = K.crest - TOP(CREST) * this.scale - (this.y[iC] - this.y[iP]);
    this.pivot.copy(this.rest);
    this.surgeNear = Math.hypot(near.x - centre.x, near.z - centre.z);
    this.shiverAmp = 0;
    this.slapT = -1;
    this.eye.value = 0;
    this.gull.settle();
    this.wake.reset(true);
    this.lay(0, 0, 0, 0);
    this.mesh.visible = this.ghost.visible = true;
  }

  /** Gone already: nothing of it left on the water. */
  vanish(): void {
    this.phase = 'gone';
    this.time = 0;
    this.mesh.visible = this.ghost.visible = false;
    this.gull.vanish();
    swellUniforms.uSurge.value.w = 0;
  }

  /**
   * A gust across its back at `s` (0 snout .. 1 flukes), running toward the flukes when `along` is positive: the skin
   * shivers along the stroke, the gull hops, and now and then the near flipper comes up lazily and slaps.
   */
  tickle(s: number, along: number, strength: number): void {
    if (this.phase !== 'asleep') return;
    if (this.shiverAmp < 0.02 || Math.abs(s - this.shiverS) > 0.2) {
      this.shiverS = s;
      this.shiverDir = Math.sign(along) || 1;
    }
    this.shiverAmp = Math.min(0.08, Math.max(this.shiverAmp, 0.05 + 0.03 * strength));
    this.tickles++;
    this.gull.startle();
    if (this.slapT < 0 && this.slapCool <= 0) {
      this.slapT = 0;
      this.slaps++;
      this.slapCool = K.slapEvery;
    }
  }

  wakeUp(): void {
    if (this.phase !== 'asleep') return;
    this.phase = 'waking';
    this.time = 0;
    this.onSound?.('whale-breath', this.blowhole.x, this.blowhole.y, this.blowhole.z);
  }

  update(dt: number, time: number): void {
    this.worldTime = time;
    if (this.phase === 'gone') {
      this.time += dt;
      if (this.time > 30) swellUniforms.uSurge.value.w = 0;
      if (this.gull.state === 'away') this.gull.update(dt, this);
      return;
    }
    this.time += dt;
    this.slapCool = Math.max(0, this.slapCool - dt);
    if (this.phase === 'asleep') this.sleep(dt);
    else if (this.phase === 'waking') this.waking(dt);
    else this.leaving();
    this.shiverS = THREE.MathUtils.clamp(this.shiverS + this.shiverDir * 0.28 * dt, 0.05, 0.95);
    this.shiverAmp *= Math.exp(-dt * 2.2);
    this.uniforms.uShiver.value.set(this.shiverS, this.shiverAmp, 0.07);
    this.slap(dt);
    this.point(0, TOP(BLOWHOLE), BLOWHOLE, this.blowhole);
    this.point(0, TOP(0.45), 0.45, this.back);
    this.point(0, 0, 1, this.flukes);
    this.gull.update(dt, this);
    this.wake.update(dt, time);
    if (this.phase === 'leaving' && this.time > GONE) {
      this.phase = 'gone';
      this.time = 0;
      this.mesh.visible = this.ghost.visible = false;
    }
  }

  private sleep(dt: number): void {
    const every = K.breathEvery / (1 + this.stir * 0.8);
    this.breath += dt / every;
    if (this.breath >= 1) {
      this.breath -= 1;
      this.sighed = false;
    }
    const b = this.breath;
    const rise = K.breathRise * (1 + this.stir * 1.5) * (0.5 - 0.5 * Math.cos(Math.PI * 2 * Math.min(1, b / 0.8)));
    if (!this.sighed && b > 0.42) {
      this.sighed = true;
      this.mist(0.6 + this.stir * 0.8);
      this.onSound?.('whale-sigh', this.blowhole.x, this.blowhole.y, this.blowhole.z);
    }
    this.lay(0, rise, 0, 0);
    this.uniforms.uCurl.value = REST_CURL;
    this.uniforms.uFin.value.set(REST_FIN.x + Math.sin(this.worldTime * 0.21) * 0.04, REST_FIN.y + Math.sin(this.worldTime * 0.3 + 1) * 0.05);
  }

  private waking(dt: number): void {
    const t = this.time;
    const draw = THREE.MathUtils.smootherstep(t, 0, DRAWN) * (1 - THREE.MathUtils.smootherstep(t, SPOUT_TO, LEAVE));
    this.eye.value = THREE.MathUtils.smoothstep(t, 0.6, 1.4);
    this.lay(0, K.breathRise * 2.2 * draw, 0, 0);
    if (t >= SPOUT_FROM && t - dt < SPOUT_FROM) {
      this.onSound?.('whale-blow', this.blowhole.x, this.blowhole.y, this.blowhole.z);
      this.gull.leave();
    }
    if (t >= SPOUT_FROM && t < SPOUT_TO) {
      const u = (t - SPOUT_FROM) / (SPOUT_TO - SPOUT_FROM);
      this.spray.jet(this.blowhole, K.spoutHeight, Math.sin(Math.PI * Math.min(1, u * 1.6)) ** 0.5 * (1 - u * 0.3), dt);
    }
    if (t >= LEAVE) {
      this.phase = 'leaving';
      this.time = 0;
    }
  }

  private leaving(): void {
    const t = this.time;
    const turn = THREE.MathUtils.smootherstep(t, 0.5, 9.5);
    const yaw = this.yaw0 + Math.atan2(Math.sin(this.yaw1 - this.yaw0), Math.cos(this.yaw1 - this.yaw0)) * turn;
    this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
    const drift = 7 * THREE.MathUtils.smootherstep(t, 1, 12);
    this.pivot.copy(this.rest).addScaledVector(this.away, drift);
    const wave = THREE.MathUtils.smoothstep(t, WAVE_FROM, WAVE_FROM + 1) * (1 - THREE.MathUtils.smoothstep(t, WAVE_TO - 1, WAVE_TO));
    this.lay(SINK(t), 0, DIP(t), TAIL(t), ROLL(t) + Math.sin((t - WAVE_FROM) * 2.2) * 0.14 * wave);
    this.uniforms.uCurl.value = REST_CURL * (1 - THREE.MathUtils.smoothstep(t, 0, 4)) - 0.25 * wave
      + Math.sin((t - WAVE_FROM) * 2.2 + 0.8) * 0.12 * wave;
    this.uniforms.uFin.value.set(REST_FIN.x + 0.5 * THREE.MathUtils.smoothstep(t, 0, 4), REST_FIN.y + 0.4 * THREE.MathUtils.smoothstep(t, 0, 4));
    if (t >= SURGE_AT && t - 1 / 30 < SURGE_AT) this.surge();
  }

  /** The swell the body leaves as it goes under, spreading from where it lay. */
  private surge(): void {
    const centre = this.point(0, 0, 0.5, this.q);
    const height = K.surgeHeight * (12 + this.surgeNear) / 12;
    swellUniforms.uSurge.value.set(centre.x, centre.z, this.worldTime, height);
  }

  /** A faint breath out over the blowhole: the player's updraft carries it up into the spiral. */
  private mist(strength: number): void {
    const at = this.blowhole;
    const n = Math.round(10 * strength * K.mist);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = 0.1 + Math.random() * 0.25;
      this.spray.emit(MIST, at.x, at.y + 0.1, at.z, Math.cos(a) * out, 0.7 + Math.random() * 0.6 * strength, Math.sin(a) * out,
        0.18 + Math.random() * 0.12, 2.2 + Math.random() * 1.5, 0.22, 0.05 + Math.random() * 0.04);
    }
  }

  private slap(dt: number): void {
    if (this.slapT < 0) {
      this.uniforms.uSlap.value.set(1, 0, 0);
      return;
    }
    const was = this.slapT;
    this.slapT += dt;
    this.uniforms.uSlap.value.set(1, SLAP(this.slapT), 0.25 * Math.min(1, this.slapT / 0.8));
    if (was < SLAP_HITS && this.slapT >= SLAP_HITS) this.splashFin();
    if (this.slapT > SLAP_FOR) this.slapT = -1;
  }

  /** Where the flipper meets the water, white water thrown up along it, and a few drops toward the boat. */
  private splashFin(): void {
    const tip = this.finPoint(0.85, this.p);
    const mid = this.finPoint(0.45, this.q);
    const toward = Math.hypot(tip.x - this.back.x, tip.z - this.back.z) || 1;
    const tx = (tip.x - this.back.x) / toward;
    const tz = (tip.z - this.back.z) / toward;
    this.spray.splash(tip.x, tip.z, 0.9, 0.55);
    this.spray.splash(mid.x, mid.z, 0.7, 0.35);
    for (let i = 0; i < 26; i++) {
      const v = 2 + Math.random() * 2.5;
      this.spray.emit(DROP, tip.x, 0.1, tip.z, tx * v + (Math.random() - 0.5), 2.5 + Math.random() * 2.5, tz * v + (Math.random() - 0.5),
        0.02 + Math.random() * 0.02, 1.4, 0, 0.7);
    }
    this.onSound?.('whale-slap', tip.x, 0, tip.z);
  }

  /** A point `t` of the way out along the near flipper, posed as the shader poses it, in the world. */
  private finPoint(t: number, out: THREE.Vector3): THREE.Vector3 {
    const fin = this.uniforms.uFin.value;
    const slap = this.uniforms.uSlap.value;
    out.copy(FIN_DIR).multiplyScalar(t * FIN_SPAN);
    rotZ(out, -fin.y);
    rotY(out, fin.x);
    rotZ(out, slap.y);
    rotY(out, slap.z);
    out.add(FIN_ROOT);
    return this.point(out.x, out.y, -out.z / LENGTH, out);
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
  private lay(sink: number, rise: number, dip: number, tail: number, roll = 0.03): void {
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

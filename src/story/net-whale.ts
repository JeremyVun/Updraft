import * as THREE from 'three';
import type { Shot } from '../camera';
import { screenBrush } from '../creatures/motion';
import { TOP } from '../fx/sealife/anatomy';
import type { Net } from '../fx/sealife/net';
import { FREE_FLUKES_FROM, type SleepingWhale } from '../fx/sealife/sleeper';
import type { Coax } from '../fx/swirl';
import { tuning } from '../tuning';
import type { Cast } from './cast';
import { completeObjective } from './cues';

const K = tuning.netWhale;

/**
 * The encounter's steps, in order. `approach` until the boat is at rest beside its head; `breath`, `line` and
 * `flipper` are what the net asks of the player, the child and the cygnet; `free` from its spout until it has gone
 * under; `gone` once the boat may sail on.
 */
export type WhaleStep = 'approach' | 'breath' | 'line' | 'flipper' | 'free' | 'gone';
export const WHALE_STEPS: readonly WhaleStep[] = ['approach', 'breath', 'line', 'flipper', 'free', 'gone'];

/** The step the breath hands on to. */
const AFTER_BREATH: WhaleStep = 'line';
/** Seconds each of the line and the flipper takes while they only play themselves through (the next phase builds them). */
const PASSING = 4;
/** Seconds the empty net takes to drift away once it is free. */
const DRIFT_FROM = 1;
const DRIFT_TO = 38;
/**
 * The valve's dolphin leaps from this far out on the near side of the blowhole, over the crown and down beyond it;
 * the last stretch of its run in rises straight along its leap for `RUN_UP` seconds.
 */
const LEAP_OUT = 14;
const RUN_UP = 0.35;
const LEAP_DOWN = 1.6;
/** How near the blowhole on screen a stroke is taken for the start of a circle rather than a sweep (NDC). */
const BLOWHOLE_CLEAR = 0.16;
/** Where along the back a gust is looked for, snout to tail stock. */
const BRUSH_FROM = 0.06;
const BRUSH_TO = 0.92;
const BRUSH_STEPS = 18;
/** How far out from the pod's anchor the bow is when it lets the boat come to rest alone (m). */
const POD_PARTS = 22;
/**
 * Where the pod waits while the boat does, in metres to port and ahead of the boat at rest: circling slowly behind
 * the camera, `POD_WAIT_RADIUS` across at `POD_WAIT_PACE` metres a second.
 */
const POD_WAIT = new THREE.Vector2(24, -18);
const POD_WAIT_RADIUS = 8;
const POD_WAIT_PACE = 2;
/**
 * The pod's way past the boat as the whale spouts free, from wherever it is waiting: across the water between the
 * boat and the whale's jaw and on along its flank to starboard, at `POD_PACE` metres a second with its lanes drawn
 * in by `POD_SPREAD`.
 */
const POD_WAY = [new THREE.Vector2(9, 0), new THREE.Vector2(-40, 26)];
const POD_PACE = 4;
const POD_SPREAD = 0.45;
/** Seconds the child holds a point toward a breath she has seen. */
const POINT_FOR = 2.6;

/** Where the dolphins are asked to run this frame, for `SeaLife.dolphinsWith`. */
export interface PodRun {
  near: THREE.Vector3 | null;
  heading: number;
  camera: number;
  busy: boolean;
  ready: boolean;
  lead: number;
  leaps: boolean;
  spread: number;
}

/**
 * The whale in the net, as the open sea plays it. It lies across the way from the start, a long low island in the
 * sunrise haze that breathes; once the pod has nudged the boat it leads it off its line, and the boat eases to rest
 * beside its head. The steps go in order, each started by `goTo`. Free, it spouts, rolls onto its back and lifts its
 * flukes as if waving, and goes under; the boat is let go the way it was held, and the pod goes with the whale.
 */
export class NetWhale {
  step: WhaleStep = 'approach';
  /** Seconds in the current step. */
  stepTime = 0;
  /** Where the boat comes to rest, and the way it faces there. */
  readonly rest = new THREE.Vector3();
  readonly yaw: number;
  /** The speed limit holding the boat, eased to nothing as it comes alongside and let go again after. */
  limit = Infinity;
  /** How far the crossing's view has given way to the hold beside it, 0..1, and to the wider view as it goes. */
  hold = 0;
  release = 0;
  /** How far the child has turned on her seat toward it, radians. */
  turn = 0;
  /** The pod has nudged the boat and now leads it; from here the encounter says where the dolphins run. */
  led = false;
  /** How far the patch of net over the blowhole has been lifted clear by circling, or by the valve's dolphin, 0..1. */
  progress = 0;
  /** What lifted it: the player's circles, or the dolphin sent once nothing had for a long while. */
  liftedBy: 'circles' | 'dolphin' | null = null;
  /** Seconds since the valve's dolphin was sent for, or -1. */
  valveT = -1;
  private readonly dir = new THREE.Vector2();
  private still = 0;
  /** Seconds at rest in a step without progress: the invitation, then the valve. */
  private waiting = 0;
  private released = -1;
  private rested = false;
  private rewarded = false;
  private nextWave = 0;
  /** When she began pointing toward its breath, or -1. */
  private pointing = -1;
  private nextPoint = 0;
  private cygnetIn: 'cradle' | 'stowing' | 'satchel' | 'unstowing' = 'cradle';
  private podGone = false;
  /** How far round its wait, and how far along its way past the boat, the pod's anchor has come. */
  private waited = 0;
  private escort = 0;
  private readonly wayFrom = new THREE.Vector3();
  private camera: THREE.PerspectiveCamera | null = null;
  private readonly asking: Coax = { at: new THREE.Vector3(), urgency: K.coaxUrgency, radius: K.coaxRadius };
  private readonly anchor = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly subjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), tertiary: new THREE.Vector3(),
    margin: 0.85, extra: 10 };
  /** Seconds since the encounter began, and when it last breathed out. */
  private clock = 0;
  private exhaled = -1e9;
  /** How strongly the player's updraft is lifting under the patch right now, eased. */
  private wind = 0;
  private breathed = false;
  private greeted = false;
  private waved = false;
  private freedAt = -1;
  /** The valve's dolphin: where it left the pod, where it leaves the water, its heading over the crown and its throw. */
  private readonly vFrom = new THREE.Vector3();
  private readonly vLaunch = new THREE.Vector3();
  private readonly vDir = new THREE.Vector3();
  private vYaw = 0;
  private vSpeed = 0;
  private vRise = 0;
  private vAir = 0;
  private vFlung = false;
  private vDone = false;
  /** Where its beak is, while she can see it. */
  private readonly diver = new THREE.Vector3();
  private diverSeen = false;

  /**
   * Lays the whale beside `rest`, where a boat sailing in from `lead` comes to rest facing the way it came: its eye
   * `tuning.netWhale.eyeDistance` off to port, its length running away into the haze to starboard.
   */
  constructor(private readonly cast: Cast, lead: THREE.Vector2, rest: THREE.Vector2) {
    this.dir.subVectors(rest, lead).normalize();
    this.yaw = Math.atan2(this.dir.x, this.dir.y);
    this.rest.set(rest.x, 0, rest.y);
    const toEye = this.yaw + K.eyeBearing;
    this.p.set(rest.x + Math.sin(toEye) * K.eyeDistance, 0, rest.y + Math.cos(toEye) * K.eyeDistance);
    const whale = this.whale;
    whale.lie(this.p, this.yaw - K.bodyAngle + Math.PI, this.rest);
    whale.onExhale = (strength) => {
      this.exhaled = this.clock;
      this.net.breathe(strength);
    };
    this.net.drape(this.rest);
    this.local(POD_WAIT.x + POD_WAIT_RADIUS, POD_WAIT.y, this.wayFrom);
  }

  get whale(): SleepingWhale {
    return this.cast.sealife.sleeper;
  }

  get net(): Net {
    return this.cast.sealife.net;
  }

  /** Moves the encounter on to `step`; what the whale does there begins with it. */
  goTo(step: WhaleStep): void {
    if (step === this.step) return;
    if (this.step === 'breath') this.breathed = true;
    this.step = step;
    this.stepTime = 0;
    this.waiting = 0;
    const whale = this.whale;
    if (step === 'free') {
      whale.free();
      this.freedAt = this.clock;
    }
    if (step === 'gone' && whale.phase !== 'gone') whale.vanish();
  }

  /**
   * Taken at rest beside it before the first step and again once its first full breath is drawn, each kept until
   * the next, and the last once it has gone and the cygnet is back in her arms, so nothing in between ever falls
   * back to a save before it.
   */
  get checkpoint(): string | null {
    if (this.step === 'gone' && this.cygnetIn === 'cradle' && !this.cast.carry.busy) return 'whale-gone';
    if (this.breathed) return 'whale-breath';
    if (this.step === 'breath' && this.progress === 0 && this.still > 1) this.rested = true;
    return this.rested ? 'whale-rest' : null;
  }

  /**
   * A save at rest finds it lying there still and the boat held; one after its breath finds the patch lifted and
   * its eye open on her; one from after it has gone finds the way clear.
   */
  restore(point: string): void {
    if (point === 'whale-rest' || point === 'whale-breath') {
      this.net.finishDraping();
      this.led = true;
      this.rested = true;
      this.waited = 1e-3;
      this.step = 'breath';
      this.stepTime = 0;
      this.limit = 0;
      this.hold = 1;
      this.turn = this.turnToward();
      this.cygnetIn = this.cast.cygnet.seat === 'satchel' ? 'satchel' : 'cradle';
      if (point === 'whale-breath') {
        this.step = AFTER_BREATH;
        this.progress = 1;
        this.breathed = this.greeted = true;
        this.whale.awaken(this.cast.child.position);
        this.net.lift = 1;
      }
    } else if (point === 'whale-gone') {
      this.led = true;
      this.podGone = true;
      this.whale.vanish();
      this.net.hide();
      this.step = 'gone';
      this.stepTime = 100;
      this.released = 1e3;
      this.rewarded = true;
      this.limit = Infinity;
      this.cygnetIn = 'cradle';
    }
  }

  /** The boat may round its hold waypoint and sail on. */
  get passed(): boolean {
    return this.whale.going;
  }

  /** Circling over the blowhole stands the column there, while the breath is what is asked. */
  get updraftTarget(): THREE.Vector3 | null {
    return this.step === 'breath' && this.remaining() < 8 && this.progress < 1 ? this.whale.blowhole : null;
  }

  get coax(): Coax | null {
    if (this.step !== 'breath' || this.progress >= 1 || this.waiting < K.inviteAfter || this.valveT >= 0) return null;
    this.asking.at.copy(this.whale.blowhole);
    return this.asking;
  }

  /** The rendered camera, for what a gust crosses on screen. */
  sees(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  update(dt: number): void {
    this.clock += dt;
    this.stepTime += dt;
    const { boat } = this.cast;
    const whale = this.whale;
    const left = this.remaining();
    const resting = left < 1.5 && boat.speed < 0.2;
    this.still = resting ? this.still + dt : 0;
    if (this.step === 'approach' && this.still > 1) this.goTo('breath');
    if (this.step === 'breath') this.breathe(dt);
    if (this.step === 'line' || this.step === 'flipper') this.passThrough();
    this.drive(dt);
    if (this.step === 'free' && whale.spouting && !this.rewarded) {
      this.rewarded = true;
      completeObjective();
    }
    if (this.step === 'free' && whale.phase === 'gone') this.goTo('gone');
    if (this.released < 0 && whale.going) this.released = 0;
    if (this.released >= 0) this.released += dt;
    const approach = Math.min(Math.sqrt(2 * K.slowing * Math.max(0, left)), K.settling * Math.max(0, left));
    const freed = this.released >= 0 ? K.release * this.released : 0;
    this.limit = freed > tuning.sail.topSpeed ? Infinity : Math.max(approach, freed);
    if (this.step !== 'approach' && this.released < 0) this.limit = Math.min(this.limit, approach);
    const near = 1 - THREE.MathUtils.smootherstep(left, K.holdFull, K.holdFrom);
    const want = this.step === 'gone' ? 0 : this.step === 'approach' ? near : 1;
    this.hold += (want - this.hold) * (1 - Math.exp(-dt * K.holdEase));
    const out = this.step === 'free' ? THREE.MathUtils.smootherstep(this.stepTime, 0.5, 5) : this.step === 'gone' ? 1 : 0;
    this.release += (out - this.release) * (1 - Math.exp(-dt * K.holdEase));
    const turning = this.step === 'gone' ? 0 : this.turnToward() * (1 - THREE.MathUtils.smootherstep(left, 30, 120));
    this.turn += (turning - this.turn) * (1 - Math.exp(-dt * 1.2));
  }

  /**
   * Where the pod runs while the encounter has it: ahead of the bow leading the boat in, gone under while the boat
   * waits, round the whale's head as it spouts free, and away with it as it goes.
   */
  pod(out: PodRun, dt: number): PodRun {
    const { boat } = this.cast;
    const whale = this.whale;
    out.camera = 1;
    out.busy = false;
    out.ready = false;
    out.lead = 0;
    out.leaps = false;
    out.spread = 1;
    out.heading = boat.yaw;
    out.near = null;
    if (this.step === 'approach') {
      if (this.remaining() > POD_PARTS) {
        out.near = boat.position;
        out.lead = K.podLead;
      }
      return out;
    }
    if ((this.step === 'free' && whale.going) || this.step === 'gone' || this.podGone) {
      this.podGone = true;
      out.heading = this.escortYaw();
      return out;
    }
    if (this.step !== 'free') {
      // Gone under ahead of the boat as it came to rest, the pod comes back round behind it and waits there.
      if (this.waited === 0 && this.cast.sealife.dolphinsHere) return out;
      this.waited += (dt * POD_WAIT_PACE) / POD_WAIT_RADIUS;
      this.local(POD_WAIT.x + Math.cos(this.waited) * POD_WAIT_RADIUS, POD_WAIT.y + Math.sin(this.waited) * POD_WAIT_RADIUS, this.anchor);
      out.near = this.anchor;
      out.heading = this.yaw - this.waited;
      this.wayFrom.copy(this.anchor);
      return out;
    }
    this.escort = Math.min(1, this.escort + (dt * POD_PACE) / this.wayLength());
    this.wayAt(this.escort, this.anchor);
    out.near = this.anchor;
    out.heading = this.escortYaw();
    out.ready = whale.time > 1;
    out.leaps = true;
    out.spread = POD_SPREAD;
    // Their leaps are thrown out to the side of the camera, behind the boat.
    out.camera = -1;
    return out;
  }

  /** A point `left` metres to port of the boat at rest and `ahead` metres before it, in the world. */
  private local(left: number, ahead: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.rest.x + Math.sin(this.yaw) * ahead + Math.cos(this.yaw) * left, 0,
      this.rest.z + Math.cos(this.yaw) * ahead - Math.sin(this.yaw) * left);
  }

  /** A point `t` of the way along the pod's way past the boat, from where it was waiting, in the world. */
  private wayAt(t: number, out: THREE.Vector3): THREE.Vector3 {
    const u = 1 - t;
    this.local(POD_WAY[0].x, POD_WAY[0].y, this.p);
    this.local(POD_WAY[1].x, POD_WAY[1].y, this.b);
    return out.copy(this.wayFrom).multiplyScalar(u * u).addScaledVector(this.p, 2 * u * t).addScaledVector(this.b, t * t);
  }

  private wayLength(): number {
    this.local(POD_WAY[0].x, POD_WAY[0].y, this.p);
    return this.wayFrom.distanceTo(this.p) + POD_WAY[0].distanceTo(POD_WAY[1]);
  }

  /** The way the pod swims along its way past the boat, and on as the whale goes. */
  private escortYaw(): number {
    this.wayAt(Math.min(1, this.escort + 0.02), this.forward);
    this.wayAt(Math.max(0, this.escort - 0.02), this.a);
    return Math.atan2(this.forward.x - this.a.x, this.forward.z - this.a.z);
  }

  /**
   * What the two of them do about it, over whatever the crossing had them doing. She knows it before the player
   * does: as it breathes in the haze she leans toward it and points, with the cygnet up in the satchel looking too.
   * At rest she watches the blowhole, and the eye when it opens on her; free, she waves.
   */
  direct(time: number): void {
    const { child, cygnet, carry } = this.cast;
    const whale = this.whale;
    const left = this.remaining();
    const near = 1 - THREE.MathUtils.smootherstep(left, 40, 160);
    if (this.step === 'gone') {
      child.lean = 0;
      this.stopPointing();
      if (this.cygnetIn === 'satchel' && this.stepTime > 2 && !carry.busy) {
        this.cygnetIn = 'unstowing';
        carry.unstow(() => (this.cygnetIn = 'cradle'));
      }
      return;
    }
    if (!this.led || near <= 0) return;
    if (this.cygnetIn === 'cradle' && !carry.busy && cygnet.seat === 'cradle') {
      this.cygnetIn = 'stowing';
      carry.stow(() => (this.cygnetIn = 'satchel'));
    }
    if (this.cygnetIn === 'stowing') return;
    const watching = this.watched();
    child.lookAt = watching;
    if (this.cygnetIn === 'satchel') cygnet.watch(watching);
    // Looked at, she leans a little toward it.
    const looked = whale.phase === 'woken' && whale.time > K.eyeOpens ? 0.05 : 0;
    child.lean = (this.step === 'approach' ? 0.18 : 0.12 + looked) * near;
    if (this.step === 'approach') this.recognise(time);
    else this.stopPointing();
    if (this.step === 'free' && (whale.spouting || whale.fluking) && time > this.nextWave) {
      child.wave();
      this.nextWave = time + 2.4;
    }
  }

  /** At each breath she sees in the haze, an arm out toward it for a moment. */
  private recognise(time: number): void {
    const { child } = this.cast;
    if (this.pointing < 0 && this.clock - this.exhaled < 1 && time > this.nextPoint && this.inView()) this.pointing = time;
    if (this.pointing < 0) return;
    if (time - this.pointing > POINT_FOR) {
      this.stopPointing();
      this.nextPoint = time + 4;
      return;
    }
    // An arm's length out toward the breath, a little above her shoulder.
    child.face(this.a);
    this.b.subVectors(this.whale.blowhole, this.a).setY(0).normalize();
    this.p.copy(this.a).addScaledVector(this.b, 0.5).setY(this.a.y + 0.08);
    child.reachFor(0, this.p);
  }

  private stopPointing(): void {
    if (this.pointing >= 0) this.cast.child.reachFor(0, null);
    this.pointing = -1;
  }

  /** The breath is in the haze ahead of her rather than behind the sail. */
  private inView(): boolean {
    const { boat } = this.cast;
    const blow = this.whale.blowhole;
    const bearing = Math.atan2(blow.x - boat.position.x, blow.z - boat.position.z) - boat.yaw;
    return Math.cos(bearing) > 0.2;
  }

  /** What they are both looking at: the breath, the dolphin that lifts the net, the column, the eye, the spout, the flukes. */
  private watched(): THREE.Vector3 {
    const whale = this.whale;
    if (this.diverSeen && this.progress < 1) return this.diver;
    if (this.step === 'free') {
      if (whale.fluking || whale.time > FREE_FLUKES_FROM) return this.look.copy(whale.flukes).setY(Math.max(whale.flukes.y, 2));
      return this.look.copy(whale.blowhole).setY(whale.blowhole.y + (whale.spouting ? 6 : 1));
    }
    if (whale.phase === 'woken' && whale.time < K.eyeOpens) {
      return this.look.copy(whale.blowhole).setY(whale.blowhole.y + 1 + 2.5 * THREE.MathUtils.smoothstep(whale.time, 1, K.eyeOpens));
    }
    if (whale.awake) return whale.eye;
    return this.look.copy(whale.blowhole).setY(whale.blowhole.y + 0.6 + this.net.lift * K.netLift * 0.6);
  }

  /**
   * The breath: circling over the blowhole lifts the patch of net off it, and what the wind has lifted stays lifted.
   * Clear, it draws its first full breath up through the spiral; then its eye opens on her, it calls once, and the
   * look between them holds before the next step. Left a long while with nothing lifted, a dolphin does it.
   */
  private breathe(dt: number): void {
    const whale = this.whale;
    if (this.progress >= 1) {
      if (this.valveT >= 0) this.valve(dt);
      this.wind += -this.wind * (1 - Math.exp(-dt * 2));
      if (whale.phase === 'resting') whale.drawBreath();
      if (whale.phase !== 'woken') return;
      if (whale.time > K.eyeOpens) whale.look(this.cast.child.position);
      if (!this.greeted && whale.time > K.eyeOpens + 0.6) {
        this.greeted = true;
        this.net.sound('whale-call', whale.eye);
      }
      if (whale.time > K.eyeOpens + K.lookFor) this.goTo(AFTER_BREATH);
      return;
    }
    if (this.still > 0) this.waiting += dt;
    this.tickled();
    const { input } = this.cast;
    let lifting = 0;
    if (input.present && !input.muted) {
      const over = 1 - THREE.MathUtils.smoothstep(Math.hypot(input.updraftAt.x - whale.blowhole.x, input.updraftAt.z - whale.blowhole.z),
        K.reach * 0.5, K.reach);
      lifting = THREE.MathUtils.smoothstep(input.charge, K.liftFrom, K.liftFull) * over;
      if (lifting > 0.02) {
        this.progress = Math.min(1, this.progress + K.liftRate * lifting * dt);
        this.liftedBy ??= 'circles';
        this.waiting = 0;
      }
    }
    this.wind += (lifting - this.wind) * (1 - Math.exp(-dt * 3));
    if (this.waiting > K.valveAfter || this.valveT >= 0) this.valve(dt);
    whale.stir = this.progress;
  }

  /**
   * The valve: a dolphin from the waiting pod swims in under the water, leaps from beside the boat over the whale's
   * crown, catches the mesh on its nose and flicks the patch up off the blowhole, and goes in beyond the head.
   */
  private valve(dt: number): void {
    const { sealife } = this.cast;
    const whale = this.whale;
    if (this.valveT < 0) {
      const from = sealife.lendDolphin();
      if (!from) return;
      this.valveT = 0;
      this.vFrom.set(from.x, from.y, from.z);
      const blow = whale.blowhole;
      this.vDir.subVectors(whale.eye, blow).setY(0);
      this.vDir.addScaledVector(whale.heading, -this.vDir.dot(whale.heading)).normalize();
      this.vLaunch.copy(blow).addScaledVector(this.vDir, LEAP_OUT).setY(0);
      this.vDir.negate();
      this.vYaw = Math.atan2(this.vDir.x, this.vDir.z);
      const height = blow.y + K.valveClear;
      const up = Math.sqrt((2 * height) / K.valveFall);
      this.vRise = K.valveFall * up;
      this.vSpeed = LEAP_OUT / up;
      this.vAir = 2 * up;
    }
    if (this.vDone) return;
    this.valveT += dt;
    const t = this.valveT;
    const swim = K.valveSwim;
    const p = this.diver;
    let pitch = 0;
    let yaw = this.vYaw;
    if (t < swim) {
      // In under the water from the pod to the foot of its leap, gathering speed, rising along it at the end.
      const u = (t / swim) ** 1.6;
      this.a.copy(this.vLaunch).addScaledVector(this.vDir, -this.vSpeed * RUN_UP).setY(-this.vRise * RUN_UP);
      this.b.copy(this.a).addScaledVector(this.vDir, -6).setY(-2.6);
      this.forward.copy(this.vFrom).setY(-2.2);
      bezier(this.vFrom, this.forward, this.b, this.a, u, p);
      bezier(this.vFrom, this.forward, this.b, this.a, Math.min(1, u + 0.01), this.lookFrom);
      yaw = Math.atan2(this.lookFrom.x - p.x, this.lookFrom.z - p.z);
      pitch = Math.atan2(this.lookFrom.y - p.y, Math.hypot(this.lookFrom.x - p.x, this.lookFrom.z - p.z));
    } else {
      const f = t - swim - RUN_UP;
      p.copy(this.vLaunch).addScaledVector(this.vDir, this.vSpeed * f);
      let rise: number;
      if (f < 0) {
        p.y = this.vRise * f;
        rise = this.vRise;
      } else if (f < this.vAir) {
        p.y = this.vRise * f - 0.5 * K.valveFall * f * f;
        rise = this.vRise - K.valveFall * f;
      } else {
        const x = Math.min(f - this.vAir, LEAP_DOWN) / LEAP_DOWN;
        p.y = -this.vRise * LEAP_DOWN * 0.5 * (1 - (1 - x) ** 2);
        rise = -this.vRise * (1 - x);
      }
      pitch = Math.atan2(rise, this.vSpeed);
      this.flick(p);
      if (f > this.vAir + LEAP_DOWN) {
        this.vDone = true;
        this.diverSeen = false;
        sealife.handBackDolphin();
        return;
      }
    }
    this.diverSeen = p.y > -0.5;
    sealife.poseDolphin(p.x, p.y, p.z, yaw, pitch);
  }

  /** Its beak over the crown catches the mesh and flicks the patch up, which goes on rising after it has passed. */
  private flick(beak: THREE.Vector3): void {
    if (this.progress >= 1) return;
    const blow = this.whale.blowhole;
    const past = (beak.x - blow.x) * this.vDir.x + (beak.z - blow.z) * this.vDir.z;
    if (past > -2.5 && beak.y > blow.y - 0.5) {
      this.progress = Math.max(this.progress, 0.3 * THREE.MathUtils.smoothstep(past, -2.5, 0));
      this.liftedBy ??= 'dolphin';
    }
    if (past > 0) this.vFlung = true;
  }

  /** The line and the flipper only play themselves through for now: the net peels into the water, the loop slides off. */
  private passThrough(): void {
    this.tickled();
    const net = this.net;
    const t = THREE.MathUtils.smootherstep(this.stepTime, 0.6, 0.6 + PASSING);
    if (this.step === 'line' && !net.posed) net.peel = Math.max(net.peel, t);
    if (this.step === 'flipper' && !net.posed) net.loop = Math.max(net.loop, t);
    if (this.stepTime > PASSING + 1.2) this.goTo(this.step === 'line' ? 'flipper' : 'free');
  }

  /** The net's four parts, from where the encounter is; its eye on her while it is awake; its goodbye. */
  private drive(dt: number): void {
    const net = this.net;
    const whale = this.whale;
    if (this.vFlung && this.progress < 1) this.progress = Math.min(1, this.progress + K.valveFling * dt);
    if (this.step !== 'breath' && this.step !== 'approach' && whale.phase === 'woken') whale.look(this.cast.child.position);
    if (this.step === 'free' && whale.fluking && !this.waved) {
      this.waved = true;
      net.sound('whale-call', whale.back);
    }
    if (net.posed) return;
    const held = this.progress >= 1 ? 1 : this.progress * (K.netSettle + (1 - K.netSettle) * this.wind);
    net.lift += (held - net.lift) * (1 - Math.exp(-dt * 2.5));
    net.updraft = this.wind;
    if (this.freedAt >= 0) net.drift = THREE.MathUtils.smoothstep(this.clock - this.freedAt, DRIFT_FROM, DRIFT_TO);
  }

  /** Gusts across its back only tickle it: a shiver along the stroke, now and then a lazy lift of the flipper. */
  private tickled(): void {
    const { input } = this.cast;
    const whale = this.whale;
    const camera = this.camera;
    // Circles are the breath's gesture, and answered at the blowhole: only a sweep across the back tickles it.
    if (!camera || !input.present || input.muted || input.gust <= K.brushFrom || input.charge > K.liftFrom) return;
    if (screenBrush(camera, whale.blowhole, input.prevNdc, input.ndc, BLOWHOLE_CLEAR) > 0) return;
    let best = 0;
    let at = 0;
    for (let i = 0; i <= BRUSH_STEPS; i++) {
      const s = BRUSH_FROM + ((BRUSH_TO - BRUSH_FROM) * i) / BRUSH_STEPS;
      const top = whale.point(0, TOP(s), s, this.p);
      const hit = screenBrush(camera, top, input.prevNdc, input.ndc, this.reach(camera, top, s));
      if (hit > best) {
        best = hit;
        at = s;
      }
    }
    if (best <= 0.01) return;
    whale.point(0, TOP(0.1), 0.1, this.a).project(camera);
    whale.point(0, TOP(0.9), 0.9, this.b).project(camera);
    const along = (this.b.x - this.a.x) * (input.ndc.x - input.prevNdc.x) * camera.aspect * camera.aspect
      + (this.b.y - this.a.y) * (input.ndc.y - input.prevNdc.y);
    whale.tickle(at, along, Math.min(1, input.gust / 12) * best);
  }

  /** How near a stroke has to pass on screen to touch the back there: the body's own thickness, seen from here. */
  private reach(camera: THREE.PerspectiveCamera, top: THREE.Vector3, s: number): number {
    const whale = this.whale;
    this.a.copy(top).project(camera);
    this.b.copy(top).setY(top.y - TOP(s) * whale.scale - 0.5).project(camera);
    return Math.max(K.brushRadius, Math.abs(this.b.y - this.a.y)) + 0.02;
  }

  /** Sailing distance still to go before the boat is at rest beside it, along the way it comes in. */
  remaining(): number {
    const p = this.cast.boat.position;
    return (this.rest.x - p.x) * this.dir.x + (this.rest.z - p.z) * this.dir.y;
  }

  /** The seat turned toward its head, at most 0.6 radians. */
  private turnToward(): number {
    const { boat } = this.cast;
    const eye = this.whale.eye;
    const bearing = Math.atan2(eye.x - boat.position.x, eye.z - boat.position.z) - boat.yaw;
    return THREE.MathUtils.clamp(Math.atan2(Math.sin(bearing), Math.cos(bearing)), -0.6, 0.6);
  }

  /**
   * Eases the crossing's view from behind the sail to the hold low beside the boat: a little to port of astern in
   * landscape, so its eye and blowhole stand clear of the sail with room to circle; in portrait on the line from its
   * head through the boat, so boat, eye and blowhole stack up the frame. Free, it eases back out to see the spout,
   * and glances round to its flukes as they wave.
   */
  frame(shot: Shot): void {
    const h = THREE.MathUtils.smootherstep(this.hold, 0, 1);
    if (h <= 0.001) return;
    const whale = this.whale;
    const boat = this.cast.boat.position;
    const portrait = (this.camera?.aspect ?? 16 / 9) < 1;
    const out = THREE.MathUtils.smootherstep(this.release, 0, 1);
    const head = this.p.copy(whale.eye).lerp(whale.blowhole, 0.5);
    this.look.copy(boat).setY(1.2).lerp(head.setY(2.6), portrait ? 0.62 : 0.5);
    const glance = whale.phase === 'free' ? THREE.MathUtils.smoothstep(whale.time, FREE_FLUKES_FROM, FREE_FLUKES_FROM + 3.5)
      * (1 - THREE.MathUtils.smoothstep(whale.time, FREE_FLUKES_FROM + 10, FREE_FLUKES_FROM + 14)) : 0;
    if (glance > 0) this.look.lerp(this.a.copy(whale.flukes).setY(Math.max(4, whale.flukes.y * 0.5)), glance * (portrait ? 0.85 : 0.55));
    // Behind the boat: just to port of astern, or in portrait on the line from the head through the boat.
    const aim = portrait ? Math.atan2(head.x - boat.x, head.z - boat.z) : this.yaw - K.holdBearing;
    const distance = THREE.MathUtils.lerp(K.holdDistance, K.releaseDistance, out);
    this.lookFrom.set(boat.x - Math.sin(aim) * distance, boat.y + THREE.MathUtils.lerp(K.holdHeight, K.releaseHeight, out),
      boat.z - Math.cos(aim) * distance);
    this.forward.subVectors(this.lookFrom, this.look).setY(0);
    const reach = this.forward.length();
    this.forward.normalize();
    shot.target.lerp(this.look, h);
    const from = shot.from ?? this.a.set(0, 0, 1);
    const was = Math.atan2(from.x, from.z);
    const want = Math.atan2(this.forward.x, this.forward.z);
    const bearing = was + Math.atan2(Math.sin(want - was), Math.cos(want - was)) * h;
    shot.from = from.set(Math.sin(bearing), 0, Math.cos(bearing));
    shot.distance = THREE.MathUtils.lerp(shot.distance, reach, h);
    shot.height = THREE.MathUtils.lerp(shot.height, this.lookFrom.y - this.look.y, h);
    // Its blowhole with room above for the spiral, and its eye, join the travelling pair by degrees.
    const s = this.subjects;
    const pair = shot.subjects;
    s.primary.copy(this.cast.child.position).y += 1.2;
    const rest = pair?.secondary ?? s.primary;
    s.secondary.copy(whale.blowhole).y += whale.phase === 'free' && whale.time < FREE_FLUKES_FROM - 3 ? 8 : 2.5;
    s.tertiary.copy(whale.eye);
    if (glance > 0) s.tertiary.lerp(this.a.copy(whale.flukes).setY(Math.max(whale.flukes.y, 1)), glance * 0.6);
    s.secondary.lerp(rest, 1 - h);
    s.tertiary.lerp(rest, 1 - h);
    s.margin = THREE.MathUtils.lerp(pair?.margin ?? 0.85, 0.85, h);
    s.extra = THREE.MathUtils.lerp(pair?.extra ?? 10, 10 + 8 * out, h);
    shot.subjects = s;
  }
}

/** A point `t` of the way along the cubic from `a` to `d` drawn toward `b` and `c`. */
function bezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  return out.copy(a).multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
}

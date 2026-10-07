import * as THREE from 'three';
import type { Shot } from '../camera';
import { screenBrush } from '../creatures/motion';
import { TOP } from '../fx/sealife/anatomy';
import type { Net, NetGrip } from '../fx/sealife/net';
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
/** Seconds the flipper takes while it only plays itself through (the next phase builds it). */
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
/**
 * Where she takes the line, in the boat's own frame (x to port, y up from its origin, z forward): coming up out of
 * the water into her outer mitten just outside the rail, through the inner one in toward her, and down in a coil on
 * the boards at her feet. `REACH_FROM`/`REACH_TO` bound where a cork is within her reach, and `REACH_HANDS` how far
 * out over the rail and down toward the water her mittens can go for it.
 */
const RAIL = new THREE.Vector3(1.05, 0.62, 0.1);
const INBOARD = new THREE.Vector3(0.55, 0.74, -0.05);
const COIL_AT = new THREE.Vector3(0.42, -0.17, 0.45);
const REACH_FROM = new THREE.Vector2(0.85, -0.9);
const REACH_TO = new THREE.Vector2(2.1, 1.4);
const REACH_HANDS = { out: 1.1, low: 0.45, back: -0.1, ahead: 0.35 };
/** Seconds her mittens take to go down to the cork, and to bring it up to the rail once they have it. */
const REACH_FOR = 0.7;
const LIFT_FOR = 0.45;
/** The last stretch of the line, back from its near cork, that a sweep across it also catches, and how much less. */
const NEAR_LINKS = [{ back: 1, weight: 0.75 }, { back: 2, weight: 0.5 }];
/** Seconds after a stroke crosses the cork that the same stroke, going on over the whale, still belongs to the cork. */
const CORK_STROKE = 0.6;
const CORK_AROUND = 3;
/** The valve's dolphin, nosing in: how near behind the cork its beak keeps, and how long it takes to turn away and go under. */
const NOSE_GAP = 0.3;
const NOSE_AWAY = 2.6;
/** How high on the head a phone's view looks: its tall frame has sky enough without raising it. */
const PORTRAIT_LOOK_Y = 2.6;

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
   * The line: its near cork out on the water until she can reach it, her mittens going down for it, the haul, and
   * letting it go. `hauledIn` is how much of it her pulls have brought aboard (m).
   */
  haul: 'out' | 'reaching' | 'hauling' | 'letting' = 'out';
  hauledIn = 0;
  /** What brought the cork to her: the player's sweeps, or the valve's dolphin. */
  broughtBy: 'sweeps' | 'dolphin' | null = null;
  /** How far along the thwart to port she has slid to lean out over the rail (m), and how far she leans out, 0..1. */
  slide = 0;
  private out = 0;
  private haulT = 0;
  private hauled = false;
  /** Seconds since a sweep last crossed the cork: the drawn sweep waits for a few. */
  private idle = 0;
  /** Seconds since a stroke last crossed the cork: the rest of that stroke, carrying on across its flank, is not a tickle. */
  private corkStroke = 1e3;
  private pulled = 0;
  /** The line's dolphin: how far behind the cork its beak still is, and when it turned away (s), or -1. */
  private noseGap = 0;
  private noseAway = -1;
  private readonly grip: NetGrip = { by: null, coil: new THREE.Vector3(), out: 0 };
  private readonly catchAt = new THREE.Vector3();
  private readonly inviting = new THREE.Vector3();
  private inviteHeading = 0;
  private readonly hand = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly ray = new THREE.Vector3();
  /** The holds the camera eases between: what it was holding when the step changed, what it is going to, and how far. */
  private readonly holdFrom = new Float32Array(6);
  private readonly holdTo = new Float32Array(6);
  private readonly holdNow = new Float32Array(6);
  private holdT = 1;
  private holdSet = false;

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
    this.net.drape(this.rest, this.yaw);
    this.net.hull = cast.boat;
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
    if (this.step === 'line') this.hauled = true;
    this.step = step;
    this.stepTime = 0;
    this.waiting = 0;
    this.idle = 0;
    if (step === 'line') {
      if (this.valveT >= 0 && !this.vDone) this.cast.sealife.handBackDolphin();
      this.valveT = -1;
      this.vDone = this.diverSeen = false;
    }
    this.holdFor(step, false);
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
    if (this.hauled) return 'whale-line';
    if (this.breathed) return 'whale-breath';
    if (this.step === 'breath' && this.progress === 0 && this.still > 1) this.rested = true;
    return this.rested ? 'whale-rest' : null;
  }

  /**
   * A save at rest finds it lying there still and the boat held; one after its breath finds the patch lifted and
   * its eye open on her; one after the line finds the net peeled off into the water and the line let go; one from
   * after it has gone finds the way clear.
   */
  restore(point: string): void {
    if (point === 'whale-rest' || point === 'whale-breath' || point === 'whale-line') {
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
      if (point !== 'whale-rest') {
        this.step = AFTER_BREATH;
        this.progress = 1;
        this.breathed = this.greeted = true;
        this.whale.awaken(this.cast.child.position);
        this.net.lift = 1;
      }
      if (point === 'whale-line') {
        this.step = 'flipper';
        this.hauled = true;
        this.haul = 'letting';
        this.net.peel = 1;
      }
      this.holdFor(this.step, true);
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

  /** The drawn sweep across the cork toward her, once the line has waited a few seconds with nothing crossing it. */
  get windInvitation(): THREE.Vector3 | null {
    if (this.step !== 'line' || this.haul !== 'out' || this.idle < K.inviteAfter || this.valveT >= 0) return null;
    return this.inviting;
  }

  /** It only works one way: from the cork toward the boat, on screen. */
  get invitationHeading(): number | null {
    return this.windInvitation ? this.inviteHeading : null;
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
    if (this.step === 'line') this.haulLine(dt);
    if (this.step === 'flipper') this.passThrough();
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
    const leaning = this.step === 'line' && (this.haul === 'reaching' || this.haul === 'hauling');
    this.out += ((leaning ? 1 : 0) - this.out) * (1 - Math.exp(-dt * (leaning ? 3 : 1.6)));
    this.slide = K.haulSlide * THREE.MathUtils.smoothstep(this.out, 0, 1);
    const turning = this.step === 'gone' ? 0 : this.turnToward() * (1 - THREE.MathUtils.smootherstep(left, 30, 120));
    this.turn += (THREE.MathUtils.lerp(turning, K.haulTurn, this.out) - this.turn) * (1 - Math.exp(-dt * 1.2));
    this.holdT = Math.min(1, this.holdT + dt / K.holdMove);
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
    if (this.step === 'line') this.haulHands();
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
    if (this.diverSeen && (this.progress < 1 || (this.step === 'line' && this.haul === 'out'))) return this.diver;
    if (this.step === 'line' && (this.haul === 'out' || this.haul === 'reaching')) return this.net.float.position;
    if (this.step === 'line' && this.haul === 'hauling') return this.net.foot;
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

  /** The flipper only plays itself through for now: the loop slides off. */
  private passThrough(): void {
    this.tickled();
    const net = this.net;
    if (!net.posed) net.loop = Math.max(net.loop, THREE.MathUtils.smootherstep(this.stepTime, 0.6, 0.6 + PASSING));
    if (this.stepTime > PASSING + 1.2) this.goTo('free');
  }

  /**
   * The line. Its near cork floats a few metres off the port side; a sweep across it on screen pushes it the way the
   * stroke goes, so one toward the boat brings it in and one away only nudges it against its tether. Within her reach
   * she leans out over the rail and takes the line in both mittens, hauls it hand over hand, each pull drawing the
   * net further off its head into the water, and lets it go. Left a long while with the cork out, a dolphin noses it in.
   */
  private haulLine(dt: number): void {
    const net = this.net;
    const { boat, child } = this.cast;
    boat.group.updateMatrixWorld();
    boat.group.localToWorld(this.catchAt.copy(RAIL));
    this.haulT += dt;
    this.corkStroke += dt;
    if (this.valveT >= 0) this.noseCork(dt);
    if (this.haul === 'out') {
      if (this.still > 0) {
        this.waiting += dt;
        this.idle += dt;
      }
      this.brushCork(dt);
      if (this.waiting > K.valveAfter && this.valveT < 0) this.noseCork(dt);
      this.invite();
      if (this.withinReach()) {
        this.broughtBy = this.valveT >= 0 ? 'dolphin' : 'sweeps';
        this.to('reaching');
      }
    } else if (this.haul === 'reaching') {
      this.drawCork();
      if (this.haulT > REACH_FOR && this.gripped()) {
        this.grip.by = child;
        this.grip.out = net.lineLength;
        boat.group.localToWorld(this.grip.coil.copy(COIL_AT));
        net.grip = this.grip;
        for (const h of [0, 1] as const) boat.group.worldToLocal(child.mitten(h, this.hand[h]));
        this.pulled = 0;
        this.to('hauling');
      }
    } else if (this.haul === 'hauling') {
      boat.group.localToWorld(this.grip.coil.copy(COIL_AT));
      const pull = Math.max(0, this.haulT - LIFT_FOR) / K.pullTime;
      const k = Math.floor(pull);
      const drawn = k >= K.haulPulls ? 0 : THREE.MathUtils.smootherstep((pull - k) / K.pullDraw, 0, 1);
      if (k < K.haulPulls && pull - k > 0.02 && this.pulled <= k) {
        this.pulled = k + 1;
        net.sound('rope-pull', child.mitten(k % 2 === 0 ? 0 : 1, this.a), 1);
      }
      this.hauledIn = Math.min(K.haulPulls, k + drawn) * K.pullTake;
      this.grip.out = net.lineLength - this.hauledIn;
      if (!net.posed) net.peel = this.hauledIn / (K.haulPulls * K.pullTake);
      if (pull > K.haulPulls + K.haulHold / K.pullTime) {
        this.grip.by = null;
        this.to('letting');
      }
    } else if (this.haulT > K.letGo) this.goTo('flipper');
    if (this.corkStroke > CORK_STROKE) this.tickled();
  }

  private to(haul: NetWhale['haul']): void {
    this.haul = haul;
    this.haulT = 0;
  }

  /** The near cork is near enough the rail beside her for her mittens to go down to it. */
  private withinReach(): boolean {
    const local = this.cast.boat.group.worldToLocal(this.a.copy(this.net.float.position));
    return local.x > REACH_FROM.x && local.x < REACH_TO.x && local.z > REACH_FROM.y && local.z < REACH_TO.y;
  }

  /** Where her mittens go down to it: over the cork, as far out and down as she can lean, in the world. */
  private reachPoint(out: THREE.Vector3): THREE.Vector3 {
    const g = this.cast.boat.group;
    const local = g.worldToLocal(out.copy(this.net.float.position));
    local.set(REACH_HANDS.out, REACH_HANDS.low, THREE.MathUtils.clamp(local.z, REACH_HANDS.back, REACH_HANDS.ahead));
    return g.localToWorld(local);
  }

  /** Her reach draws the cork the last little way in, up against the planking under her mittens. */
  private drawCork(): void {
    const float = this.net.float;
    const g = this.cast.boat.group;
    g.localToWorld(g.worldToLocal(this.reachPoint(this.b)).setX(0.9)).sub(float.position).setY(0);
    const want = this.b.multiplyScalar(3);
    if (want.length() > 1.5) want.setLength(1.5);
    float.push(want.sub(float.velocity).setY(0));
  }

  /** A mitten has closed on the line at the cork. */
  private gripped(): boolean {
    const { child } = this.cast;
    const cork = this.net.float.position;
    for (const h of [0, 1] as const) {
      child.mitten(h, this.a);
      if (Math.hypot(this.a.x - cork.x, this.a.z - cork.z) < 0.4) return true;
    }
    return false;
  }

  /**
   * A sweep across the near cork on screen, or across the last of the line just behind it, sets it moving across the
   * water the way the stroke goes, as fast as the stroke goes; a stroke away from the boat only nudges it.
   */
  private brushCork(dt: number): void {
    const { input } = this.cast;
    const camera = this.camera;
    if (!camera || !input.present || input.muted || dt <= 0) return;
    const dx = input.ndc.x - input.prevNdc.x;
    const dy = input.ndc.y - input.prevNdc.y;
    const moved = Math.hypot(dx * camera.aspect, dy);
    if (moved < 1e-4) return;
    const float = this.net.float;
    // A stroke on its way to the cork, or just past it, is about the cork, not the whale behind it.
    if (screenBrush(camera, float.position, input.prevNdc, input.ndc, K.corkRadius * CORK_AROUND) > 0) this.corkStroke = 0;
    let hit = screenBrush(camera, float.position, input.prevNdc, input.ndc, K.corkRadius);
    for (const near of NEAR_LINKS) {
      hit = Math.max(hit, near.weight * screenBrush(camera, this.net.link(near.back, this.a), input.prevNdc, input.ndc, K.corkRadius));
    }
    if (hit <= 0.01) return;
    this.idle = 0;
    // The stroke's way across the water at the cork: a step along it on screen, followed down onto the water.
    const step = 0.02 / Math.hypot(dx, dy);
    this.a.copy(float.position).project(camera);
    this.b.set(this.a.x + dx * step, this.a.y + dy * step, 0.5).unproject(camera).sub(camera.position);
    if (this.b.y > -1e-3) return;
    this.b.multiplyScalar((float.position.y - camera.position.y) / this.b.y).add(camera.position).sub(float.position).setY(0);
    if (this.b.lengthSq() < 1e-8) return;
    const way = this.b.normalize();
    const toward = this.a.subVectors(this.catchAt, float.position).setY(0).normalize().dot(way);
    const pace = Math.min(K.corkPushMax, (K.corkPush * moved) / 2 / dt) * (toward < 0 ? K.corkWrongWay : 1);
    // A cork is a small thing to cross: anywhere near the middle of the stroke's reach counts in full.
    const more = pace * Math.min(1, 1.5 * Math.sqrt(hit)) - float.velocity.dot(way);
    if (more <= 0) return;
    float.push(this.ray.copy(way).multiplyScalar(more));
    if (toward > 0.3) this.waiting = 0;
  }

  /** Where the drawn sweep goes: across the cork and on toward her, and which way that is on screen. */
  private invite(): void {
    const camera = this.camera;
    const cork = this.net.float.position;
    this.inviting.copy(cork).lerp(this.catchAt, 0.45).setY(cork.y);
    if (!camera) return;
    this.a.copy(cork).project(camera);
    this.b.copy(this.catchAt).project(camera);
    this.inviteHeading = Math.atan2(this.b.y - this.a.y, (this.b.x - this.a.x) * camera.aspect);
  }

  /**
   * The line's valve: a dolphin from the waiting pod swims in under the water, rises just behind the cork and noses
   * it in to her at an easy pace (the same push a sweep gives it); once she can reach it, it turns away and goes under.
   */
  private noseCork(dt: number): void {
    const { sealife } = this.cast;
    const float = this.net.float;
    const cork = float.position;
    if (this.valveT < 0) {
      const from = sealife.lendDolphin();
      if (!from) return;
      this.valveT = 0;
      this.vFrom.set(from.x, from.y, from.z);
      this.vDir.subVectors(this.catchAt, cork).setY(0).normalize();
      this.vLaunch.copy(cork).addScaledVector(this.vDir, -K.noseFrom).setY(0);
      this.noseGap = K.noseFrom;
      this.noseAway = -1;
    }
    if (this.vDone) return;
    this.valveT += dt;
    const t = this.valveT;
    const p = this.diver;
    let yaw = Math.atan2(this.vDir.x, this.vDir.z);
    let pitch = 0;
    if (t < K.valveSwim) {
      // In under the water from the pod to just behind the cork, coming up to the surface there.
      const u = (t / K.valveSwim) ** 1.4;
      this.a.copy(this.vLaunch).setY(0.02);
      this.b.copy(this.vLaunch).addScaledVector(this.vDir, -5).setY(-1.8);
      this.forward.copy(this.vFrom).setY(-2.2);
      bezier(this.vFrom, this.forward, this.b, this.a, u, p);
      bezier(this.vFrom, this.forward, this.b, this.a, Math.min(1, u + 0.01), this.lookFrom);
      yaw = Math.atan2(this.lookFrom.x - p.x, this.lookFrom.z - p.z);
      pitch = Math.atan2(this.lookFrom.y - p.y, Math.hypot(this.lookFrom.x - p.x, this.lookFrom.z - p.z));
    } else if (this.haul === 'out' && this.noseAway < 0) {
      // Its beak comes up to the cork and keeps just behind it, pushing it on toward her.
      this.b.subVectors(this.catchAt, cork).setY(0).normalize();
      this.vDir.lerp(this.b, 1 - Math.exp(-dt * 2)).normalize();
      this.noseGap = Math.max(NOSE_GAP, this.noseGap - K.noseSpeed * dt);
      p.copy(cork).addScaledVector(this.vDir, -this.noseGap).setY(0.02);
      yaw = Math.atan2(this.vDir.x, this.vDir.z);
      if (this.noseGap <= NOSE_GAP + 1e-3) {
        const more = K.noseSpeed - float.velocity.dot(this.vDir);
        if (more > 0) float.push(this.ray.copy(this.vDir).multiplyScalar(more));
      }
    } else {
      // Turned away from the boat, and down.
      if (this.noseAway < 0) this.noseAway = t;
      const f = Math.min(1, (t - this.noseAway) / NOSE_AWAY);
      this.b.subVectors(p, this.catchAt).setY(0).normalize();
      this.vDir.lerp(this.b, 1 - Math.exp(-dt * 1.5)).normalize();
      p.addScaledVector(this.vDir, 2.2 * dt);
      p.y = 0.02 - 2.4 * THREE.MathUtils.smoothstep(f, 0.15, 1);
      yaw = Math.atan2(this.vDir.x, this.vDir.z);
      pitch = -0.4 * Math.sin(Math.PI * THREE.MathUtils.smoothstep(f, 0.15, 1));
      if (f >= 1) {
        this.vDone = true;
        this.diverSeen = false;
        sealife.handBackDolphin();
        return;
      }
    }
    this.diverSeen = p.y > -0.5;
    sealife.poseDolphin(p.x, p.y, p.z, yaw, pitch);
  }

  /**
   * Her body on the line: watching the cork come in; leaning out over the port rail for it with both mittens going
   * down to it; hauling it hand over hand, one mitten drawing the line in to her while the other goes back out along
   * it to the rail, rocking back with each pull; then sitting back up once it is let go.
   */
  private haulHands(): void {
    const { child, boat } = this.cast;
    const g = boat.group;
    g.updateMatrixWorld();
    if (this.haul === 'out' || this.haul === 'letting') {
      child.reachFor(0, null);
      child.reachFor(1, null);
      child.lean = 0.12 + 0.1 * this.out;
      return;
    }
    if (this.haul === 'reaching') {
      child.lean = K.reachLean * this.out;
      this.reachPoint(this.a);
      // A hand's width apart along the line, the outer one on the cork.
      this.b.subVectors(this.net.link(1, this.b), this.a).setY(0).normalize();
      child.reachFor(0, this.hand[0].copy(this.a));
      child.reachFor(1, this.hand[1].copy(this.a).addScaledVector(this.b, 0.2).setY(this.a.y + 0.05));
      return;
    }
    const pull = Math.max(0, this.haulT - LIFT_FOR) / K.pullTime;
    const k = Math.min(Math.floor(pull), K.haulPulls);
    const w = k >= K.haulPulls ? 1 : pull - k;
    const drawn = THREE.MathUtils.smootherstep(w / K.pullDraw, 0, 1);
    const back = w < K.pullDraw ? drawn : 1 - THREE.MathUtils.smootherstep((w - K.pullDraw) / (1 - K.pullDraw), 0, 1);
    const lift = THREE.MathUtils.smootherstep(this.haulT / LIFT_FOR, 0, 1);
    const settled = k >= K.haulPulls ? 1 - THREE.MathUtils.smootherstep(pull - K.haulPulls, 0, 0.5) : 1;
    child.lean = (K.haulLean - 0.3 * back * settled) * this.out;
    const puller = k % 2 === 0 ? 0 : 1;
    for (const h of [0, 1] as const) {
      const pulling = h === puller;
      const from = pulling ? RAIL : INBOARD;
      const to = pulling ? INBOARD : RAIL;
      const at = this.a.copy(from).lerp(to, drawn);
      at.y += Math.sin(Math.PI * drawn) * (pulling ? 0.08 : 0.18);
      if (!pulling) at.x += Math.sin(Math.PI * drawn) * 0.05;
      g.localToWorld(at.lerp(this.hand[h], 1 - lift));
      child.reachFor(h, at);
    }
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
   * The hold for `step`, eased to over `holdMove` from wherever the camera is holding now, or taken at once: high
   * behind the boat for the breath with the blowhole in reach of a circle, closer and lower for the line with her
   * mittens, the cork and the net coming off its head in frame, and closer and lower again for the flipper. Free,
   * it goes back to the breath's hold and eases out from there.
   */
  private holdFor(step: WhaleStep, now: boolean): void {
    const to = this.holdTo;
    if (step === 'line') to.set([K.lineDistance, K.lineHeight, K.lineBearing, K.lineLookY, K.lineToward, 0]);
    else if (step === 'flipper') to.set([K.flipperDistance, K.flipperHeight, K.flipperBearing, K.flipperLookY, K.flipperToward, 1]);
    else to.set([K.holdDistance, K.holdHeight, K.holdBearing, K.holdLookY, K.holdToward, 0]);
    if (now || !this.holdSet) {
      this.holdFrom.set(to);
      this.holdNow.set(to);
      this.holdT = 1;
      this.holdSet = true;
      return;
    }
    this.holdFrom.set(this.holdNow);
    this.holdT = 0;
  }

  /**
   * Eases the crossing's view from behind the sail to the step's hold beside the boat: a little to port of astern
   * in landscape, so what the step asks for stands clear of the sail; in portrait on the line from its head through
   * the boat, nearer, so boat, eye and head stack up the frame. Free, it eases back out to see the spout, and
   * glances round to its flukes as they wave.
   */
  frame(shot: Shot): void {
    const h = THREE.MathUtils.smootherstep(this.hold, 0, 1);
    if (!this.holdSet) this.holdFor(this.step, true);
    if (h <= 0.001) return;
    const whale = this.whale;
    const boat = this.cast.boat.position;
    const portrait = (this.camera?.aspect ?? 16 / 9) < 1;
    const out = THREE.MathUtils.smootherstep(this.release, 0, 1);
    const now = this.holdNow;
    const moved = THREE.MathUtils.smootherstep(this.holdT, 0, 1);
    for (let i = 0; i < now.length; i++) now[i] = THREE.MathUtils.lerp(this.holdFrom[i], this.holdTo[i], moved);
    const [holdDistance, holdHeight, bearing, lookY, toward, fin] = now;
    const head = this.p.copy(whale.eye).lerp(whale.blowhole, 0.5);
    const focus = this.b.copy(head).lerp(whale.finTip, fin).setY(portrait ? Math.min(lookY, PORTRAIT_LOOK_Y) : lookY);
    this.look.copy(boat).setY(1.2).lerp(focus, portrait ? toward + 0.12 : toward);
    const glance = whale.phase === 'free' ? THREE.MathUtils.smoothstep(whale.time, FREE_FLUKES_FROM, FREE_FLUKES_FROM + 3.5)
      * (1 - THREE.MathUtils.smoothstep(whale.time, FREE_FLUKES_FROM + 10, FREE_FLUKES_FROM + 14)) : 0;
    if (glance > 0) this.look.lerp(this.a.copy(whale.flukes).setY(Math.max(4, whale.flukes.y * 0.5)), glance * (portrait ? 0.85 : 0.55));
    // Behind the boat: just to port of astern, or in portrait on the line from the head through the boat.
    const aim = portrait ? Math.atan2(head.x - boat.x, head.z - boat.z) : this.yaw - bearing;
    const nearer = portrait ? K.portraitIn : 1;
    const distance = THREE.MathUtils.lerp(holdDistance, K.releaseDistance, out) * nearer;
    this.lookFrom.set(boat.x - Math.sin(aim) * distance, boat.y + THREE.MathUtils.lerp(holdHeight, K.releaseHeight, out) * nearer,
      boat.z - Math.cos(aim) * distance);
    this.forward.subVectors(this.lookFrom, this.look).setY(0);
    const reach = this.forward.length();
    this.forward.normalize();
    shot.target.lerp(this.look, h);
    const from = shot.from ?? this.a.set(0, 0, 1);
    const was = Math.atan2(from.x, from.z);
    const want = Math.atan2(this.forward.x, this.forward.z);
    const turned = was + Math.atan2(Math.sin(want - was), Math.cos(want - was)) * h;
    shot.from = from.set(Math.sin(turned), 0, Math.cos(turned));
    shot.distance = THREE.MathUtils.lerp(shot.distance, reach, h);
    shot.height = THREE.MathUtils.lerp(shot.height, this.lookFrom.y - this.look.y, h);
    // What the step is about, and its eye, join the travelling pair by degrees.
    const s = this.subjects;
    const pair = shot.subjects;
    s.primary.copy(this.cast.child.position).y += 1.2;
    const rest = pair?.secondary ?? s.primary;
    if (this.step === 'line') s.secondary.copy(this.haul === 'out' || this.haul === 'reaching' ? this.net.float.position : this.net.foot);
    else if (this.step === 'flipper') s.secondary.copy(whale.finTip);
    else s.secondary.copy(whale.blowhole).y += whale.phase === 'free' && whale.time < FREE_FLUKES_FROM - 3 ? 8 : 2.5;
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

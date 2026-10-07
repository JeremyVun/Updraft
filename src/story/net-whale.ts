import * as THREE from 'three';
import type { Shot } from '../camera';
import { screenBrush } from '../creatures/motion';
import { TOP } from '../fx/sealife/anatomy';
import type { SleepingWhale } from '../fx/sealife/sleeper';
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

/** The step the breath hands on to. The net's line and flipper steps come between it and `free`. */
const AFTER_BREATH: WhaleStep = 'free';
/** Seconds of its first full breath and the look between them before the breath step hands on. */
const LOOKING = 5;
/** Where along the back a gust is looked for, snout to tail stock. */
const BRUSH_FROM = 0.06;
const BRUSH_TO = 0.92;
const BRUSH_STEPS = 18;
/** How far out from the pod's anchor the bow is when it lets the boat come to rest alone (m). */
const POD_PARTS = 22;
/** Seconds the child holds a point toward a breath she has seen, and the least between two. */
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
  /** How far the player's circling has brought its first full breath, 0..1 (the stand-in for the net's breath). */
  progress = 0;
  private readonly dir = new THREE.Vector2();
  private readonly lead = new THREE.Vector2();
  private still = 0;
  /** Seconds at rest in a step without progress: the invitation, then the valve. */
  private waiting = 0;
  private released = -1;
  private rewarded = false;
  private nextWave = 0;
  /** When she began pointing toward its breath, or -1. */
  private pointing = -1;
  private nextPoint = 0;
  private cygnetIn: 'cradle' | 'stowing' | 'satchel' | 'unstowing' = 'cradle';
  private podGone = false;
  private escort = 0;
  private camera: THREE.PerspectiveCamera | null = null;
  private readonly asking: Coax = { at: new THREE.Vector3(), urgency: K.coaxUrgency, radius: K.coaxRadius };
  private readonly anchor = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly nose = new THREE.Vector3();
  private readonly toBoat = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly subjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), tertiary: new THREE.Vector3(),
    margin: 0.85, extra: 10 };
  /** Seconds since the encounter began, and when it last breathed out. */
  private clock = 0;
  private exhaled = -1e9;

  /**
   * Lays the whale beside `rest`, where a boat sailing in from `lead` comes to rest facing the way it came: its eye
   * `tuning.netWhale.eyeDistance` off to port, its length running away into the haze to starboard.
   */
  constructor(private readonly cast: Cast, lead: THREE.Vector2, rest: THREE.Vector2) {
    this.lead.copy(lead);
    this.dir.subVectors(rest, lead).normalize();
    this.yaw = Math.atan2(this.dir.x, this.dir.y);
    this.rest.set(rest.x, 0, rest.y);
    const toEye = this.yaw + K.eyeBearing;
    this.p.set(rest.x + Math.sin(toEye) * K.eyeDistance, 0, rest.y + Math.cos(toEye) * K.eyeDistance);
    const whale = this.whale;
    whale.lie(this.p, this.yaw - K.bodyAngle + Math.PI, this.rest);
    whale.onExhale = () => (this.exhaled = this.clock);
  }

  get whale(): SleepingWhale {
    return this.cast.sealife.sleeper;
  }

  /** Moves the encounter on to `step`; what the whale does there begins with it. */
  goTo(step: WhaleStep): void {
    if (step === this.step) return;
    this.step = step;
    this.stepTime = 0;
    this.waiting = 0;
    const whale = this.whale;
    if (step === 'free') whale.free();
    if (step === 'gone' && whale.phase !== 'gone') whale.vanish();
  }

  /** At rest beside it before the first step, and once it has gone with the cygnet back in her arms. */
  get checkpoint(): string | null {
    if (this.step === 'gone' && this.cygnetIn === 'cradle' && !this.cast.carry.busy) return 'whale-gone';
    if (this.step === 'breath' && this.progress === 0 && this.still > 1) return 'whale-rest';
    return null;
  }

  /** A save at rest finds it lying there still and the boat held; one from after finds the way clear. */
  restore(point: string): void {
    if (point === 'whale-rest') {
      this.led = true;
      this.podGone = true;
      this.step = 'breath';
      this.stepTime = 0;
      this.limit = 0;
      this.hold = 1;
      this.turn = this.turnToward();
      this.cygnetIn = this.cast.cygnet.seat === 'satchel' ? 'satchel' : 'cradle';
    } else if (point === 'whale-gone') {
      this.led = true;
      this.podGone = true;
      this.whale.vanish();
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
    if (this.step !== 'breath' || this.progress >= 1 || this.waiting < K.inviteAfter) return null;
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
    if (this.step === 'line' || this.step === 'flipper') this.tickled();
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
    whale.point(0, 0.15, 0, this.nose);
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
    out.heading = boat.yaw;
    out.near = null;
    if (this.step === 'approach') {
      if (this.remaining() > POD_PARTS) {
        out.near = boat.position;
        out.lead = K.podLead;
      }
      return out;
    }
    if (this.step !== 'free' || whale.going || this.podGone) {
      if (this.step === 'free' && whale.going) this.podGone = true;
      out.heading = this.escortYaw();
      return out;
    }
    // Round the front of its head, from the near side to the far, leaping out in front of it.
    this.escort += (dt * 3) / K.podMill;
    const theta = 1 + this.escort;
    this.toBoat.set(whale.heading.z, 0, -whale.heading.x);
    this.anchor.copy(this.nose).addScaledVector(this.toBoat, Math.cos(theta) * K.podMill)
      .addScaledVector(whale.heading, Math.sin(theta) * K.podMill).setY(0);
    out.near = this.anchor;
    out.heading = this.escortYaw();
    out.ready = whale.time > 1;
    out.leaps = true;
    return out;
  }

  /** The way round its head the pod swims, and away along its far side as it goes. */
  private escortYaw(): number {
    const whale = this.whale;
    const theta = 1 + this.escort;
    const x = -Math.sin(theta) * whale.heading.z + Math.cos(theta) * whale.heading.x;
    const z = Math.sin(theta) * whale.heading.x + Math.cos(theta) * whale.heading.z;
    return Math.atan2(x, z);
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
    child.lean = (this.step === 'approach' ? 0.18 : 0.12) * near;
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

  /** What they are both looking at: the breath, the eye, the spout, the flukes. */
  private watched(): THREE.Vector3 {
    const whale = this.whale;
    if (this.step === 'free') {
      if (whale.fluking || whale.time > 9) return this.look.copy(whale.flukes).setY(Math.max(whale.flukes.y, 2));
      return this.look.copy(whale.blowhole).setY(whale.blowhole.y + (whale.spouting ? 6 : 1));
    }
    if (whale.awake) return whale.eye;
    return this.look.copy(whale.blowhole).setY(whale.blowhole.y + 0.6);
  }

  /** The stand-in for the net's breath: circling over the blowhole gives it its first full breath. */
  private breathe(dt: number): void {
    const whale = this.whale;
    if (this.progress >= 1) {
      whale.look(this.cast.child.position);
      if (whale.phase === 'woken' && whale.time > LOOKING) this.goTo(AFTER_BREATH);
      return;
    }
    if (this.still > 0) this.waiting += dt;
    this.tickled();
    const { input } = this.cast;
    if (input.present && !input.muted) {
      const over = 1 - THREE.MathUtils.smoothstep(Math.hypot(input.updraftAt.x - whale.blowhole.x, input.updraftAt.z - whale.blowhole.z),
        K.reach * 0.5, K.reach);
      const lifting = THREE.MathUtils.smoothstep(input.charge, K.liftFrom, K.liftFull) * over;
      if (lifting > 0.02) {
        this.progress = Math.min(1, this.progress + K.liftRate * lifting * dt);
        this.waiting = 0;
      }
    }
    // Left long enough it finds its own breath: the stand-in's valve, until the net's dolphin lifts the mesh.
    if (this.waiting > K.valveAfter) this.progress = Math.min(1, this.progress + K.liftRate * 0.6 * dt);
    whale.stir = this.progress;
    if (this.progress >= 1) whale.drawBreath();
  }

  /** Gusts across its back only tickle it: a shiver along the stroke, now and then a lazy lift of the flipper. */
  private tickled(): void {
    const { input } = this.cast;
    const whale = this.whale;
    const camera = this.camera;
    if (!camera || !input.present || input.muted || input.gust <= K.brushFrom) return;
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
    const glance = whale.phase === 'free' ? THREE.MathUtils.smoothstep(whale.time, 9, 12.5) * (1 - THREE.MathUtils.smoothstep(whale.time, 19, 23)) : 0;
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
    s.secondary.copy(whale.blowhole).y += whale.phase === 'free' && whale.time < 6 ? 8 : 2.5;
    s.tertiary.copy(whale.eye);
    if (glance > 0) s.tertiary.lerp(this.a.copy(whale.flukes).setY(Math.max(whale.flukes.y, 1)), glance);
    s.secondary.lerp(rest, 1 - h);
    s.tertiary.lerp(rest, 1 - h);
    s.margin = THREE.MathUtils.lerp(pair?.margin ?? 0.85, 0.85, h);
    s.extra = THREE.MathUtils.lerp(pair?.extra ?? 10, 10 + 20 * out, h);
    shot.subjects = s;
  }
}

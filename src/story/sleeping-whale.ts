import * as THREE from 'three';
import type { Shot } from '../camera';
import { screenBrush } from '../creatures/motion';
import { HALF_WIDTH, TOP } from '../fx/sealife/anatomy';
import type { Coax } from '../fx/swirl';
import { tuning } from '../tuning';
import type { Cast } from './cast';

const K = tuning.sleepingWhale;
/** Where along the back a gust is looked for, snout to tail stock. */
const BRUSH_FROM = 0.06;
const BRUSH_TO = 0.92;
const BRUSH_STEPS = 18;

/**
 * The whale asleep across the way, as the crossing to the meadow plays it. The boat eases to rest off its flank and
 * waits; gusts across its back only tickle it; an updraft wound over the blowhole wakes it (or, left long enough,
 * the gull does), and once its flukes are up the boat is let go the way it was held.
 */
export class WhaleAcross {
  /** Where the boat comes to rest, off its flank. */
  readonly rest = new THREE.Vector3();
  /** The speed limit holding the boat, eased to nothing as it comes alongside and let go again after. */
  limit = Infinity;
  /** How far the crossing's view has given way to watching it, 0..1. */
  hold = 0;
  /** How far the child has turned on her seat toward it, radians. */
  turn = 0;
  private readonly centre = new THREE.Vector3();
  private readonly start = new THREE.Vector2();
  private readonly dir = new THREE.Vector2();
  private readonly yaw: number;
  private readonly stopAlong: number;
  private progress = 0;
  /** Seconds the boat has been at rest beside it. */
  private still = 0;
  /** Seconds at rest with no circling over the blowhole: the invitation, then the gull. */
  private waiting = 0;
  private released = -1;
  private cygnetUp: 'ducked' | 'perched' | 'back' = 'ducked';
  private passed = false;
  private nextWave = 0;
  private camera: THREE.PerspectiveCamera | null = null;
  private readonly asking: Coax = { at: new THREE.Vector3(), urgency: K.coaxUrgency, radius: K.coaxRadius };
  private readonly look = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly seat = new THREE.Vector3();
  private readonly perch = new THREE.Vector3();
  /** Where its blowhole end and its tail were last seen above the water, for the frame. */
  private readonly head = new THREE.Vector3();
  private readonly tail = new THREE.Vector3();
  private readonly subjects = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), tertiary: new THREE.Vector3(),
    margin: 0.85, extra: 12 };

  /** Lies it across the leg from `from` to `to`, `tuning.sleepingWhale.along` metres out. */
  constructor(private readonly cast: Cast, from: THREE.Vector2, to: THREE.Vector2) {
    this.start.copy(from);
    this.dir.subVectors(to, from).normalize();
    this.yaw = Math.atan2(this.dir.x, this.dir.y);
    const sleeper = cast.sealife.sleeper;
    const flank = HALF_WIDTH(0.42) * sleeper.scale;
    this.stopAlong = K.along - flank - K.gap - K.bow;
    this.centre.set(from.x + this.dir.x * K.along, 0, from.y + this.dir.y * K.along);
    this.rest.set(from.x + this.dir.x * this.stopAlong, 0, from.y + this.dir.y * this.stopAlong);
    sleeper.lie(this.centre, this.yaw + Math.PI / 2, this.yaw, this.rest);
  }

  /** Taken once the boat is at rest beside it asleep, and again once it has gone and the cygnet is back in the bag. */
  get checkpoint(): string | null {
    if (this.passed) return 'whale-gone';
    return this.cast.sealife.sleeper.phase === 'asleep' && this.still > 1 ? 'whale-asleep' : null;
  }

  /** A save from before it woke finds it asleep there still; one from after finds the way clear. */
  restore(point: string): void {
    if (point !== 'whale-gone') return;
    this.cast.sealife.sleeper.vanish();
    this.released = 1e3;
    this.limit = Infinity;
    this.cygnetUp = 'back';
    this.passed = true;
  }

  get updraftTarget(): THREE.Vector3 | null {
    const sleeper = this.cast.sealife.sleeper;
    return sleeper.phase === 'asleep' && this.remaining() < 8 ? sleeper.blowhole : null;
  }

  get coax(): Coax | null {
    const sleeper = this.cast.sealife.sleeper;
    if (sleeper.phase !== 'asleep' || this.waiting < K.inviteAfter || sleeper.gull.state !== 'asleep') return null;
    this.asking.at.copy(sleeper.blowhole);
    return this.asking;
  }

  /** The rendered camera, for what a gust crosses on screen. */
  sees(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  update(dt: number): void {
    const { boat } = this.cast;
    const sleeper = this.cast.sealife.sleeper;
    const left = this.remaining();
    if (sleeper.phase === 'asleep') this.play(dt);
    if (this.released < 0 && (sleeper.fluking || (sleeper.phase === 'gone' && sleeper.awake))) this.released = 0;
    if (this.released >= 0) this.released += dt;
    const approach = Math.min(Math.sqrt(2 * K.slowing * Math.max(0, left)), K.settling * Math.max(0, left));
    const freed = this.released >= 0 ? K.release * this.released : 0;
    this.limit = freed > tuning.sail.topSpeed ? Infinity : Math.max(approach, freed);
    const resting = sleeper.phase === 'asleep' && left < 1.5 && boat.speed < 0.2;
    this.still = resting ? this.still + dt : 0;
    if (resting) this.waiting += dt;
    if (sleeper.phase === 'asleep' && this.waiting > K.valveAfter) sleeper.gull.walk();
    if (sleeper.gull.pecked) sleeper.wakeUp();
    const near = 1 - THREE.MathUtils.smootherstep(left, 6, 34);
    const want = this.passed ? 0 : near * (1 - THREE.MathUtils.smootherstep(this.released, 3, 10));
    this.hold += (want - this.hold) * (1 - Math.exp(-dt * K.holdEase));
    const bearing = Math.atan2(sleeper.back.x - boat.position.x, sleeper.back.z - boat.position.z) - boat.yaw;
    const toward = THREE.MathUtils.clamp(Math.atan2(Math.sin(bearing), Math.cos(bearing)), -0.6, 0.6);
    this.turn += ((sleeper.phase === 'gone' ? 0 : toward * near) - this.turn) * (1 - Math.exp(-dt * 1.2));
    if (!this.passed && sleeper.phase === 'gone' && this.cygnetUp === 'back' && !this.cast.carry.busy) this.passed = true;
  }

  /**
   * What the two of them do about it, over whatever the crossing had them doing: she leans over the side toward it
   * and the cygnet peeks from the satchel; when it spouts the cygnet comes up, and when it goes she waves after it.
   */
  direct(time: number): void {
    const { child, cygnet, boat } = this.cast;
    const sleeper = this.cast.sealife.sleeper;
    const near = 1 - THREE.MathUtils.smootherstep(this.remaining(), 6, 34);
    if (this.passed || near <= 0) {
      child.lean = 0;
      cygnet.duck = 0;
      return;
    }
    const watching = sleeper.phase === 'leaving' ? sleeper.flukes
      : sleeper.phase === 'waking' ? this.look.copy(sleeper.blowhole).setY(sleeper.blowhole.y + 2)
        : sleeper.gull.state !== 'asleep' && sleeper.gull.state !== 'gone' ? sleeper.gull.position : sleeper.blowhole;
    if (sleeper.phase !== 'gone') child.lookAt = watching;
    child.lean = (sleeper.phase === 'asleep' || sleeper.phase === 'waking' ? 0.26 : 0.08) * near;
    if (sleeper.fluking && time > this.nextWave) {
      child.wave();
      this.nextWave = time + 2.6;
    }
    if (this.cygnetUp === 'ducked') {
      cygnet.duck = sleeper.phase === 'asleep' ? near : sleeper.phase === 'waking' ? 0.5 : 0;
      cygnet.watch(watching);
      if (sleeper.phase === 'leaving' && sleeper.time > 2 && !this.cast.carry.busy) this.cygnetUp = 'perched';
    }
    if (this.cygnetUp === 'perched') {
      cygnet.duck = 0;
      const sideways = this.p.set(Math.cos(boat.yaw), 0, -Math.sin(boat.yaw));
      this.perch.copy(boat.seat(this.seat)).addScaledVector(sideways, 0.82).setY(boat.position.y + 0.1);
      cygnet.perch(this.perch, boat.yaw);
      cygnet.watch(sleeper.phase === 'gone' ? null : watching);
      if (sleeper.phase === 'gone' && sleeper.time > 3) {
        cygnet.watch(null);
        cygnet.rideIn('satchel');
        this.cygnetUp = 'back';
      }
    }
  }

  /** Gusts across the back tickle it; an updraft wound over the blowhole brings it up toward waking. */
  private play(dt: number): void {
    const { input } = this.cast;
    const sleeper = this.cast.sealife.sleeper;
    const camera = this.camera;
    if (!input.present || input.muted) return;
    if (camera && input.gust > K.brushFrom) {
      let best = 0;
      let at = 0;
      for (let i = 0; i <= BRUSH_STEPS; i++) {
        const s = BRUSH_FROM + ((BRUSH_TO - BRUSH_FROM) * i) / BRUSH_STEPS;
        const top = sleeper.point(0, TOP(s), s, this.p);
        const hit = screenBrush(camera, top, input.prevNdc, input.ndc, this.reach(camera, top, s));
        if (hit > best) {
          best = hit;
          at = s;
        }
      }
      if (best > 0.01) {
        sleeper.point(0, TOP(0.1), 0.1, this.a).project(camera);
        sleeper.point(0, TOP(0.9), 0.9, this.b).project(camera);
        const along = (this.b.x - this.a.x) * (input.ndc.x - input.prevNdc.x) * camera.aspect * camera.aspect
          + (this.b.y - this.a.y) * (input.ndc.y - input.prevNdc.y);
        sleeper.tickle(at, along, Math.min(1, input.gust / 12) * best);
      }
    }
    const over = 1 - THREE.MathUtils.smoothstep(Math.hypot(input.updraftAt.x - sleeper.blowhole.x, input.updraftAt.z - sleeper.blowhole.z),
      K.reach * 0.5, K.reach);
    const lifting = THREE.MathUtils.smoothstep(input.charge, K.liftFrom, K.liftFull) * over;
    if (lifting > 0.02) {
      this.progress = Math.min(1, this.progress + K.liftRate * lifting * dt);
      this.waiting = 0;
    }
    sleeper.stir = this.progress;
    if (this.progress >= 1) sleeper.wakeUp();
  }

  /** How near a stroke has to pass on screen to touch the back there: the body's own thickness, seen from here. */
  private reach(camera: THREE.PerspectiveCamera, top: THREE.Vector3, s: number): number {
    const sleeper = this.cast.sealife.sleeper;
    this.a.copy(top).project(camera);
    this.b.copy(top).setY(top.y - TOP(s) * sleeper.scale - 0.5).project(camera);
    return Math.max(K.brushRadius, Math.abs(this.b.y - this.a.y)) + 0.02;
  }

  /** Sailing distance still to go before the boat is at rest off its flank. */
  private remaining(): number {
    const p = this.cast.boat.position;
    return this.stopAlong - ((p.x - this.start.x) * this.dir.x + (p.z - this.start.y) * this.dir.y);
  }

  /** Eases the crossing's view round to hold it broadside, the boat low in the middle; in portrait, its blowhole end. */
  frame(shot: Shot, heading: number, quarter: number): void {
    const h = THREE.MathUtils.smootherstep(this.hold, 0, 1);
    if (h <= 0.001) return;
    const sleeper = this.cast.sealife.sleeper;
    const boat = this.cast.boat.position;
    const portrait = (this.camera?.aspect ?? 16 / 9) < 1;
    const going = sleeper.phase === 'leaving' || sleeper.phase === 'gone';
    const focus = going ? this.p.copy(this.head).lerp(sleeper.flukes, THREE.MathUtils.smoothstep(sleeper.flukes.y, 0.3, 2.5))
      : sleeper.blowhole;
    this.look.set(boat.x + this.dir.x * K.holdAhead, 1.6, boat.z + this.dir.y * K.holdAhead);
    if (portrait) this.look.lerp(this.p.copy(focus).setY(1.6), 0.4);
    shot.target.lerp(this.look, h);
    const from = shot.from ?? this.p.set(0, 0, 1);
    const was = Math.atan2(from.x, from.z);
    const want = heading + Math.PI + quarter * K.holdBearing;
    const bearing = was + Math.atan2(Math.sin(want - was), Math.cos(want - was)) * h;
    shot.from = from.set(Math.sin(bearing), 0, Math.cos(bearing));
    shot.distance = THREE.MathUtils.lerp(shot.distance, K.holdDistance, h);
    shot.height = THREE.MathUtils.lerp(shot.height, K.holdHeight, h);
    // Its ends join the travelling pair by degrees, so the lens never has to find a new fit all at once. Going
    // under, it is framed where it lay until the flukes come up out of the water, and then on them.
    const s = this.subjects;
    const pair = shot.subjects;
    s.primary.copy(this.cast.child.position).y += 1.2;
    const rest = pair?.secondary ?? s.primary;
    if (!going) {
      this.head.copy(sleeper.blowhole).y += 1.5;
      if (portrait) this.tail.copy(this.head);
      else sleeper.point(0, TOP(0.9), 0.9, this.tail);
    }
    const up = THREE.MathUtils.smoothstep(sleeper.flukes.y, 0.3, 2.5);
    s.secondary.copy(this.head);
    if (sleeper.phase === 'waking') s.secondary.y += K.spoutHeight * 0.6 - 1.5;
    s.tertiary.copy(this.tail);
    if (going) {
      s.tertiary.lerp(sleeper.flukes, up);
      if (portrait) s.secondary.lerp(sleeper.flukes, up);
    }
    // Only what is out of the water needs room: a body going under must not draw the lens back after it.
    s.secondary.y = Math.max(s.secondary.y, 1.5);
    s.tertiary.y = Math.max(s.tertiary.y, 0.5);
    s.secondary.lerp(rest, 1 - h);
    s.tertiary.lerp(rest, 1 - h);
    s.margin = THREE.MathUtils.lerp(pair?.margin ?? 0.85, 0.85, h);
    s.extra = THREE.MathUtils.lerp(pair?.extra ?? 12, 12, h);
    shot.subjects = s;
  }
}

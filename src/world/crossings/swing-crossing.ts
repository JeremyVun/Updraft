import * as THREE from 'three';
import { tuning } from '../../tuning';
import { RopeSwing, type SwingSpot } from './rope-swing';
import type { CrossingCast } from './tree-crossing';

/** Where she gets on the swing, where she comes down off it, and where she goes on to. */
export interface SwingWay {
  /** On the near side, beside the seat as it hangs. */
  board: THREE.Vector3;
  /** On the far side's slope, where her feet come down. */
  landing: THREE.Vector3;
  onward?: THREE.Vector3;
}

export type SwingEvent = 'creak' | 'leap' | 'land';

/**
 * The second crossing: a rope swing over open water from an old tree's bough. She gets on by herself; the player's
 * gusts pump it; when a forward swing will carry her far enough she lets go near its top and lands on the far
 * slope. Nothing is timed: the player only pumps, she chooses the moment, and if they stop she waits on it.
 */
export class SwingCrossing {
  readonly swing: RopeSwing;
  phase: 'off' | 'boarding' | 'riding' | 'flying' | 'landed' | 'leaving' | 'over' = 'off';
  invitation: THREE.Vector3 | null = null;
  heading = 0;
  t = 0;
  onEvent: ((kind: SwingEvent, at: THREE.Vector3, strength: number) => void) | null = null;
  private quiet = 0;
  private stalled = 0;
  private best = 0;
  private valveClock = 0;
  private hand: 0 | 1 = 0;
  /** Back on her feet after the landing. */
  private up = false;
  private lastSpeed = 0;
  private readonly from = new THREE.Vector3();
  private readonly seatNow = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private fromYaw = 0;

  constructor(spot: SwingSpot, readonly way: SwingWay, private readonly cast: CrossingCast) {
    this.swing = new RopeSwing(spot);
  }

  get done(): boolean {
    return this.phase === 'over';
  }

  get valving(): boolean {
    return this.stalled > tuning.crossings.swing.valveAfter;
  }

  /** The way it swings out, as a yaw. */
  get facing(): number {
    return Math.atan2(this.swing.toward.x, this.swing.toward.y);
  }

  reset(): void {
    this.swing.reset();
    this.phase = 'off';
    this.invitation = null;
    this.t = this.quiet = this.stalled = this.best = this.valveClock = 0;
    this.up = false;
    const c = this.cast.child;
    c.swing = c.kick = 0;
  }

  /** She is at the board point: she catches hold, sits, and pushes off. */
  begin(): void {
    const c = this.cast.child;
    this.phase = 'boarding';
    this.t = 0;
    this.from.copy(c.position);
    this.fromYaw = c.yaw;
    this.swing.held = true;
    const side = (c.position.x - this.swing.pivot.x) * this.swing.toward.y - (c.position.z - this.swing.pivot.z) * this.swing.toward.x;
    this.hand = side > 0 ? 1 : 0;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const { child: c, input, wind } = this.cast;
    this.t += dt;
    if (this.phase === 'riding') this.swing.brush(camera, input, wind);
    if (this.swing.brushAge < 0.4) this.quiet = 0;
    this.quiet += dt;
    if (this.phase === 'boarding') this.board();
    this.swing.update(dt, wind);
    if (this.lastSpeed * this.swing.speed < 0 && Math.abs(this.swing.angle) > 0.12) {
      this.onEvent?.('creak', this.swing.pivot, Math.min(1, Math.abs(this.swing.angle) * 1.5));
    }
    this.lastSpeed = this.swing.speed;

    if (this.phase === 'riding') this.ride(dt, camera);
    else if (this.phase === 'flying' || this.phase === 'landed' || this.phase === 'leaving') {
      c.swing = Math.max(0, c.swing - dt * 4);
      c.kick *= Math.exp(-dt * 6);
      if (this.phase === 'landed') this.lookBack();
    }
    if (this.phase !== 'riding') this.invitation = null;
  }

  /** Round to face the way it swings, a hand to the near rope as the seat is drawn in, then down onto it. */
  private board(): void {
    const k = tuning.crossings.swing;
    const c = this.cast.child;
    const s = this.swing;
    const u = THREE.MathUtils.clamp(this.t / k.boardFor, 0, 1);
    const across = (this.from.x - s.pivot.x) * s.toward.y - (this.from.z - s.pivot.z) * s.toward.x;
    const ahead = (this.from.x - s.pivot.x) * s.toward.x + (this.from.z - s.pivot.z) * s.toward.y;
    const draw = THREE.MathUtils.smootherstep(u, 0.1, 0.45);
    s.aside = Math.asin(THREE.MathUtils.clamp(across * 0.55 / s.rope, -0.5, 0.5)) * draw;
    s.angle = Math.asin(THREE.MathUtils.clamp(ahead / s.rope, -0.5, 0.5)) * draw;
    s.speed = 0;
    const seat = s.seat(this.seatNow);
    const turn = Math.atan2(Math.sin(this.facing - this.fromYaw), Math.cos(this.facing - this.fromYaw));
    const grip = this.tmp.copy(seat).lerp(s.pivot, 0.12);
    c.reachFor(this.hand, u < 0.75 ? grip : null);
    const sit = THREE.MathUtils.smootherstep(u, 0.4, 0.92);
    if (sit <= 0) {
      c.yaw = this.fromYaw + turn * THREE.MathUtils.smootherstep(u, 0, 0.35);
      return;
    }
    const at = this.tmp.lerpVectors(this.from, seat, sit);
    at.y += Math.sin(sit * Math.PI) * 0.12;
    c.ride(at, this.fromYaw + turn);
    c.swing = sit;
    if (u >= 1) {
      c.reachFor(this.hand, null);
      s.held = false;
      s.speed = k.pushOff;
      s.best = Math.max(0, s.angle);
      this.best = s.best;
      this.phase = 'riding';
      this.t = this.quiet = this.stalled = 0;
    }
  }

  private ride(dt: number, camera: THREE.PerspectiveCamera): void {
    const k = tuning.crossings.swing;
    const c = this.cast.child;
    const s = this.swing;
    s.rider = 1;
    c.ride(s.seat(this.seatNow), this.facing);
    c.swing = 1;
    c.kick = THREE.MathUtils.clamp(s.angle / 0.5, -1, 1);
    c.lookAt = this.way.landing;
    if (s.best > this.best + 0.02) {
      this.best = s.best;
      this.stalled = 0;
    } else this.stalled += dt;
    if (this.valving) this.blow(dt);
    this.invitation = this.quiet > k.inviteAfter && !this.valving ? s.seat(this.from) : null;
    if (this.invitation) {
      const a = this.projected.copy(this.invitation).project(camera);
      const bx = this.invitation.x + s.toward.x * 2, bz = this.invitation.z + s.toward.y * 2;
      const b = this.tmp.set(bx, this.invitation.y, bz).project(camera);
      this.heading = Math.atan2(b.y - a.y, (b.x - a.x) * camera.aspect);
    }
    if (this.carries()) this.letGo();
  }

  /** Near the top of a forward swing, and a leap from here would reach the landing. */
  private carries(): boolean {
    const k = tuning.crossings.swing;
    const s = this.swing;
    if (s.speed <= 0 || s.peak - s.angle > k.releaseLead || s.angle < 0.2) return false;
    const seat = s.seat(this.seatNow);
    const v = this.leapVelocity(this.velocity);
    const g = k.leapGravity;
    const drop = seat.y - this.way.landing.y;
    const flight = (v.y + Math.sqrt(Math.max(0, v.y * v.y + 2 * g * drop))) / g;
    const forward = (this.way.landing.x - seat.x) * s.toward.x + (this.way.landing.z - seat.z) * s.toward.y;
    const reach = (v.x * s.toward.x + v.z * s.toward.y) * flight;
    return reach >= forward + k.releaseSpare;
  }

  private leapVelocity(out: THREE.Vector3): THREE.Vector3 {
    const k = tuning.crossings.swing;
    const s = this.swing;
    s.velocity(out);
    return out.set(out.x + s.toward.x * k.leapForward, out.y + k.leapUp, out.z + s.toward.y * k.leapForward);
  }

  private letGo(): void {
    const k = tuning.crossings.swing;
    const c = this.cast.child;
    const s = this.swing;
    const v = this.leapVelocity(this.velocity);
    s.rider = 0;
    /** Her push off the seat sends it back a little, lighter now, as she goes. */
    s.speed -= (k.leapForward * 0.5) / s.rope;
    this.phase = 'flying';
    this.t = 0;
    c.lookAt = null;
    this.onEvent?.('leap', c.position, 1);
    c.leap(v, this.way.landing, k.leapGravity, () => {
      this.phase = 'landed';
      this.t = 0;
      this.onEvent?.('land', this.way.landing, 1);
    }, () => {
      c.swing = c.kick = 0;
      this.up = true;
    });
  }

  /** Up off her hands, a look back at the swing going on without her, then on her way. */
  private lookBack(): void {
    const c = this.cast.child;
    if (this.t > 0.25) c.lookAt = this.swing.seat(this.tmp);
    if (!this.up || this.t < tuning.crossings.swing.landFor + tuning.crossings.swing.lookBack || c.busy) return;
    const onward = this.way.onward;
    this.phase = onward ? 'leaving' : 'over';
    c.lookAt = null;
    if (onward) c.walkTo(onward.x, onward.z, false, () => { this.phase = 'over'; }, 0.3);
  }

  /** The world's own gusts at the seat, one each way it swings, until she is carried over. */
  private blow(dt: number): void {
    const k = tuning.crossings.swing;
    this.valveClock -= dt;
    if (this.valveClock > 0) return;
    this.valveClock = k.valveEvery;
    const s = this.swing;
    const seat = s.seat(this.seatNow);
    const way = s.speed >= 0 ? 1 : -1;
    this.cast.lines.gust(seat.x - s.toward.x * way * 2, seat.z - s.toward.y * way * 2, s.toward.x * way, s.toward.y * way, 5, 8);
    s.blow(this.cast.wind, k.valveEnergy);
  }
}

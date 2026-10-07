import * as THREE from 'three';
import { tuning } from '../../tuning';
import type { Deck } from '../decks';
import { MillSpiral } from './mill-spiral';
import { SAIL, Windmill, type MillSound, type MillSpot } from './windmill';
import type { CrossingCast } from './tree-crossing';

/** Where she waits for the sail, where she steps off it, and where she goes on to. */
export interface MillWay {
  /** On the low wall beside the sails' plane, where the boarding sail's rail comes level beside her. */
  wait: THREE.Vector3;
  /** On the high roof, a stride beyond the rail's tip as the sail dwells there. */
  stepOff: THREE.Vector3;
  onward: THREE.Vector3;
}

export type MillEvent = MillSound;

/**
 * The middle crossing: a drowned mill's sails turned by the player's circling. A sail comes round level beside the
 * wall she waits on and dwells; she walks out onto its rail with a hand on the stock and stands there while the turn
 * lifts her, until it dwells again beside the high roof and she walks off its end. Nothing is timed and nothing
 * fails: she chooses when to step on and off, the wrong way only rocks it, and it holds her when the player stops.
 */
export class MillCrossing {
  readonly mill: Windmill;
  readonly spiral = new MillSpiral();
  phase: 'off' | 'waiting' | 'boarding' | 'riding' | 'leaving' | 'over' = 'off';
  /** Seconds in the current phase. */
  t = 0;
  onEvent: ((kind: MillEvent, at: THREE.Vector3, strength: number) => void) | null = null;
  /** The rail she walks on, kept under the sail as it turns. */
  readonly rail: Deck = { x0: 0, z0: 0, x1: 0, z1: 0, halfWidth: 0.2, height: 0, height1: 0 };
  /** Where she stands, held in the sails' frame while she rides. */
  readonly riding = new THREE.Vector3();
  private stalled = 0;
  private dwelt = 0;
  private best = 0;
  private valveOn = false;
  private readonly at = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  constructor(spot: MillSpot, readonly way: MillWay, private readonly cast: CrossingCast) {
    this.mill = new Windmill(spot);
    this.mill.onSound = (kind, where, strength) => this.onEvent?.(kind, where, strength);
  }

  get objects(): THREE.Object3D[] {
    return [...this.mill.objects, ...this.spiral.objects];
  }

  get done(): boolean {
    return this.phase === 'over';
  }

  /** Once the world's own breath has taken over it keeps on until she is across. */
  get valving(): boolean {
    if (this.stalled > tuning.crossings.mill.valveAfter) this.valveOn = true;
    return this.valveOn;
  }

  /** Where the drawn spiral is offered: while the sails wait for the player's turning, and not just after it. */
  get inviting(): boolean {
    const k = tuning.crossings.mill;
    const m = this.mill;
    if ((this.phase !== 'waiting' && this.phase !== 'riding') || m.dwelling || this.valving) return false;
    return m.quiet > k.inviteAfter || (m.wrong && m.quiet > k.inviteWrong);
  }

  reset(): void {
    this.mill.reset();
    this.phase = 'off';
    this.t = this.stalled = this.best = this.dwelt = 0;
    this.valveOn = false;
    this.offRail();
  }

  /** She is at the wait point on the wall: from here the sail is hers to wait for. */
  begin(): void {
    this.to('waiting');
    this.mill.dwellAt = tuning.crossings.mill.board;
    this.best = this.mill.angle;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const k = tuning.crossings.mill;
    const m = this.mill;
    const c = this.cast.child;
    this.t += dt;
    m.read(camera, this.cast.input, dt);
    if (m.angle > this.best + 0.02) {
      this.best = m.angle;
      this.stalled = 0;
    } else if (this.phase === 'waiting' || this.phase === 'riding') this.stalled += dt;
    m.assist = this.valving && (this.phase === 'waiting' || this.phase === 'riding') ? k.valveDrive : 0;
    m.update(dt);
    if (this.phase !== 'off') this.layRail();

    if (this.phase === 'waiting') {
      c.lookAt = m.railTop(k.stand, this.look);
      this.dwelt = m.dwelling ? this.dwelt + dt : 0;
      if (this.dwelt >= k.boardAfter && !c.busy) this.board();
    } else if (this.phase === 'riding') {
      this.ride(dt);
      if (m.dwelling) this.stepOff();
    }
    this.spiral.update(dt, camera, m, this.inviting);
  }

  /** How far her feet are above the rail's top where she stands on it (QA). */
  railGap(): number {
    const c = this.cast.child.position, r = this.rail;
    const dx = r.x1 - r.x0, dz = r.z1 - r.z0;
    const u = THREE.MathUtils.clamp(((c.x - r.x0) * dx + (c.z - r.z0) * dz) / (dx * dx + dz * dz), 0, 1);
    return c.y - THREE.MathUtils.lerp(r.height, r.height1 ?? r.height, u);
  }

  /** Across onto the rail beside her and a step out along it toward the tip, then she holds the stock and rides. */
  private board(): void {
    const k = tuning.crossings.mill;
    const { child: c } = this.cast;
    const m = this.mill;
    this.to('boarding');
    m.hold = true;
    if (!c.decks.includes(this.rail)) c.decks.push(this.rail);
    const onto = m.railTop(k.stand - 0.1, this.at);
    const out = m.railTop(k.stand, new THREE.Vector3());
    c.lookAt = null;
    c.stroll = k.railStroll;
    c.walkTo(onto.x, onto.z, false, () => {
      c.balance = 0.6;
      c.walkTo(out.x, out.z, false, () => {
        m.toRotor(c.position, this.riding);
        m.hold = false;
        m.aboard = true;
        m.dwellAt = k.top;
        this.to('riding');
      }, 0.05);
    }, 0.1);
  }

  /** Feet on the rail, a hand on the stock, carried with the sail; small shifts of balance as it goes. */
  private ride(dt: number): void {
    const k = tuning.crossings.mill;
    const { child: c } = this.cast;
    const m = this.mill;
    m.fromRotor(this.riding, this.at);
    c.position.copy(this.at);
    const turn = Math.atan2(Math.sin(m.outward - c.yaw), Math.cos(m.outward - c.yaw));
    c.yaw += turn * (1 - Math.exp(-dt * 3));
    c.balance = THREE.MathUtils.lerp(c.balance, 0.25 + 0.1 * Math.sin(this.t * 1.3), 1 - Math.exp(-dt * 2));
    c.lean = 0.06 + 0.05 * Math.sin(this.t * 0.9) + m.sail * 0.15;
    c.reachFor(1, m.stockAt(k.stand + 0.2, this.look));
    c.lookAt = this.way.stepOff;
  }

  /** Let go of the stock, up the rail to its tip, and a stride off its end onto the high roof. */
  private stepOff(): void {
    const k = tuning.crossings.mill;
    const { child: c } = this.cast;
    const m = this.mill;
    this.to('leaving');
    m.hold = true;
    c.reachFor(1, null);
    c.lookAt = null;
    c.lean = 0;
    c.balance = 0.7;
    c.stroll = k.railStroll;
    const tip = m.railTop(SAIL.to - 0.12, this.at);
    c.walkTo(tip.x, tip.z, false, () => {
      c.walkTo(this.way.stepOff.x, this.way.stepOff.z, false, () => {
        c.balance = 0;
        c.stroll = 1;
        this.offRail();
        m.hold = false;
        m.aboard = false;
        m.dwellAt = null;
        c.walkTo(this.way.onward.x, this.way.onward.z, false, () => this.to('over'), 0.3);
      }, 0.15);
    }, 0.08);
  }

  /** The rail as a strip to walk, from the lattice's inner end out to the tip, as the sail lies now. */
  private layRail(): void {
    const m = this.mill;
    const a = m.railTop(SAIL.from, this.at);
    this.rail.x0 = a.x; this.rail.z0 = a.z; this.rail.height = a.y;
    const b = m.railTop(SAIL.to, this.at);
    this.rail.x1 = b.x; this.rail.z1 = b.z; this.rail.height1 = b.y;
  }

  private offRail(): void {
    const decks = this.cast.child.decks;
    const i = decks.indexOf(this.rail);
    if (i >= 0) decks.splice(i, 1);
  }

  private to(phase: MillCrossing['phase']): void {
    this.phase = phase;
    this.t = 0;
  }
}

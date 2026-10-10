import * as THREE from 'three';
import { tuning } from '../../tuning';
import type { MaterialSound } from '../../audio/foley';
import type { Deck } from '../decks';
import type { CatStep } from './cat-way';
import { MillSpiral } from './mill-spiral';
import { HOIST, Windmill, type MillSound, type MillSpot } from './windmill';
import type { CrossingCast } from './tree-crossing';

/** Where she waits for the basket, where she steps off it at the top, and where she goes on to. */
export interface MillWay {
  /** At her roof's edge, a stride from the basket waiting there. */
  wait: THREE.Vector3;
  /** On the high roof, a stride beyond the basket at the top. */
  stepOff: THREE.Vector3;
  onward: THREE.Vector3;
}

export type MillEvent = MillSound;

/** The mill's own voice: the dry axle as it starts, the cap working round, the brake as it settles, the linen, the pawl. */
export const MILL_SOUNDS = { start: 'mill-start', creak: 'mill-creak', settle: 'mill-settle', flap: 'linen-flap', click: 'mill-click' } as const satisfies Record<MillEvent, MaterialSound>;

/**
 * The circles crossing: a drowned mill's sack hoist. The basket waits at her roof's edge; she steps into it and stands
 * holding its ropes, and the player's circling turns the sails, which wind the rope onto its drum and raise her the
 * whole height of the mill, to step off at the top onto the high roof. Nothing is timed and nothing fails: the pawl
 * holds her wherever the sails stop, the wrong way only rocks them, and after a long while the world's own breath
 * turns them. The cat goes first: it leaps onto the low sail's end, rides it up as it turns, bounds in along the
 * stock and leaps onto the cap.
 */
export class MillCrossing {
  readonly mill: Windmill;
  readonly spiral: MillSpiral;
  phase: 'off' | 'waiting' | 'boarding' | 'riding' | 'leaving' | 'over' = 'off';
  /** Seconds in the current phase. */
  t = 0;
  /** False until the cat is on its sail: the brake stays on until it is. Whoever drives the cat sets it. */
  clear = true;
  /** Set while the cat is on its sail, so they turn gently until it is off onto the cap. */
  catOn = false;
  /** What she looks down at over her shoulder as she rises, the room's fog below; by default the water she came over. */
  below: THREE.Vector3 | null = null;
  onEvent: ((kind: MillEvent, at: THREE.Vector3, strength: number) => void) | null = null;
  /** What she stands on from her roof's edge into the basket, in it as it rises, and out of it onto the high roof. */
  readonly deck: Deck = { x0: 0, z0: 0, x1: 0, z1: 0, halfWidth: 0.4, height: 0 };
  private stalled = 0;
  private best = 0;
  private valveOn = false;
  private readonly at = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  /** Given a mill already standing in the world, and the spiral drawn round it, it takes those over. */
  constructor(spot: MillSpot | Windmill, readonly way: MillWay, private readonly cast: CrossingCast, spiral = new MillSpiral()) {
    this.mill = spot instanceof Windmill ? spot : new Windmill(spot);
    this.spiral = spiral;
    this.mill.onSound = (kind, where, strength) => this.onEvent?.(kind, where, strength);
  }

  get objects(): THREE.Object3D[] {
    return [...this.mill.objects, ...this.spiral.objects];
  }

  get done(): boolean {
    return this.phase === 'over';
  }

  /** Once the world's own breath has taken over it keeps on until she is up. */
  get valving(): boolean {
    if (this.stalled > tuning.crossings.mill.valveAfter) this.valveOn = true;
    return this.valveOn;
  }

  /** Where the drawn spiral is offered: while the sails wait for the player's turning, and not just after it. */
  get inviting(): boolean {
    const k = tuning.crossings.mill;
    const m = this.mill;
    if (this.phase !== 'riding' || m.topped || this.valving) return false;
    return m.quiet > k.inviteAfter || (m.wrong && m.quiet > k.inviteWrong);
  }

  /** The way she faces in the basket: toward the tower, the rope she holds in front of her. */
  get facing(): number {
    return this.mill.facing + Math.PI / 2;
  }

  reset(): void {
    this.mill.reset();
    this.phase = 'off';
    this.t = this.stalled = this.best = 0;
    this.valveOn = false;
    this.clear = true;
    this.catOn = false;
    this.offDeck();
  }

  /** She is at the wait point on her roof's edge: from here the basket is hers. */
  begin(): void {
    this.to('waiting');
    this.mill.hold = true;
    this.best = 0;
  }

  /**
   * The cat's own way up, from wherever it waits within a leap of the low sail's end: onto the end of the stock as
   * it rests, two bounds in along the stock as the sails start to turn it up, crouched there riding it, and a leap
   * down onto the cap. Set `clear` once it is on the sail, and `catOn` while it bounds along it.
   */
  catWay(): CatStep[] {
    const m = this.mill, k = tuning.crossings.mill;
    const inward = (d: number) => new THREE.Vector3(d, 0, 0);
    return [
      { leap: inward(0.3), frame: m.perch, yaw: Math.PI / 2 },
      { hop: inward(2.1), frame: m.perch, yaw: Math.PI / 2, gather: 0.1 },
      { hop: inward(4.0), frame: m.perch, yaw: Math.PI / 2, gather: 0.1 },
      { leap: m.at(m.capTop(new THREE.Vector3())), gather: 0.1, when: () => m.shown >= k.catLeap },
    ];
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const k = tuning.crossings.mill;
    const m = this.mill;
    const c = this.cast.child;
    this.t += dt;
    m.read(camera, this.cast.input, dt);
    const progress = m.wound;
    if (progress > this.best + 0.02) {
      this.best = progress;
      this.stalled = 0;
    } else if (this.phase === 'riding') this.stalled += dt;
    m.assist = this.valving && this.phase === 'riding' ? k.valveDrive : 0;
    if (this.phase === 'riding') m.hold = !this.clear;
    m.catRiding = this.catOn;
    m.update(dt);

    if (this.phase === 'waiting') {
      c.lookAt = m.basketFloor(this.look).setY(this.look.y + 0.6);
      if (this.t >= k.boardAfter && !c.busy) this.board();
    } else if (this.phase === 'riding') {
      this.ride(dt, camera);
      if (m.topped && m.speed === 0 && this.t > 0.5) this.stepOff();
    }
    if (this.phase === 'riding' || this.phase === 'leaving') this.layDeck();
    this.spiral.update(dt, camera, m, this.inviting);
  }

  /** How far her feet are above the basket's floor while she rides (QA). */
  floorGap(): number {
    return this.cast.child.position.y - this.mill.basketFloor(this.at).y;
  }

  /** Across her roof's edge into the middle of the basket, round to face the tower, and hands to the rope. */
  private board(): void {
    const k = tuning.crossings.mill;
    const { child: c } = this.cast;
    const m = this.mill;
    this.to('boarding');
    const into = m.basketFloor(this.at).clone();
    this.lay(this.way.wait, into, m.from);
    c.lookAt = null;
    c.stroll = k.stroll;
    c.walkTo(into.x, into.z, false, () => {
      m.engaged = true;
      m.aboard = true;
      this.to('riding');
    }, 0.06);
  }

  /**
   * Feet on the floor, facing the tower with both mittens on the rope in front of her: looking up at the cat going first
   * and the top, then down over her shoulder at what is below, then to where she is going; never round at the lens.
   */
  private ride(dt: number, camera: THREE.PerspectiveCamera): void {
    const k = tuning.crossings.mill;
    const { child: c } = this.cast;
    const m = this.mill;
    m.basketFloor(this.at);
    c.position.copy(this.at);
    const turn = Math.atan2(Math.sin(this.facing - c.yaw), Math.cos(this.facing - c.yaw));
    c.yaw += turn * (1 - Math.exp(-dt * 3.5));
    const settled = Math.min(1, this.t / 0.6);
    if (settled > 0.3) {
      c.reachFor(0, m.grip(0, this.look, k.gripHigh));
      c.reachFor(1, m.grip(0, this.look, k.gripLow));
    }
    const share = m.wound / m.full;
    if (share > k.lookOn) c.lookAt = this.look.copy(this.way.stepOff).setY(this.way.stepOff.y + 0.5);
    else if (share > k.lookDown) {
      if (this.below) c.lookAt = this.look.copy(this.below);
      else c.lookAt = m.at(this.look.set(HOIST.x + 1.2, 0, HOIST.z + 3));
    } else c.lookAt = m.at(m.capTop(this.look));
    /** Turned no further toward the lens than a glance over her shoulder. */
    const her = c.position, lens = camera.position;
    const away = Math.atan2(her.x - lens.x, her.z - lens.z);
    const want = Math.atan2(c.lookAt.x - her.x, c.lookAt.z - her.z);
    const off = Math.atan2(Math.sin(want - away), Math.cos(want - away));
    if (Math.abs(off) > k.lookOff) {
      const to = away + Math.sign(off) * k.lookOff, reach = Math.max(3, Math.hypot(c.lookAt.x - her.x, c.lookAt.z - her.z));
      c.lookAt.set(her.x + Math.sin(to) * reach, c.lookAt.y, her.z + Math.cos(to) * reach);
    }
  }

  /** Hands off the ropes, round to the high roof, out of the back of the basket onto it, and on. */
  private stepOff(): void {
    const k = tuning.crossings.mill;
    const { child: c } = this.cast;
    const m = this.mill;
    this.to('leaving');
    m.hold = true;
    c.reachFor(0, null);
    c.reachFor(1, null);
    c.lookAt = null;
    c.stroll = k.stroll;
    const from = m.basketFloor(this.at).clone();
    this.lay(from, this.way.stepOff, m.to);
    c.walkTo(this.way.stepOff.x, this.way.stepOff.z, false, () => {
      c.stroll = 1;
      m.aboard = false;
      m.engaged = false;
      m.hold = false;
      c.walkTo(this.way.onward.x, this.way.onward.z, false, () => {
        this.offDeck();
        this.to('over');
      }, 0.3);
    }, 0.15);
  }

  /** While she rides, the floor under her as it rises. */
  private layDeck(): void {
    if (this.phase === 'leaving') return;
    const at = this.mill.basketFloor(this.at);
    const d = this.deck;
    d.x0 = at.x - 0.01; d.z0 = at.z; d.x1 = at.x + 0.01; d.z1 = at.z;
    d.height = at.y;
    d.height1 = undefined;
  }

  /** A strip from `a` to `b`, a stride longer at each end so a step taken while she turns stays on it. */
  private lay(a: THREE.Vector3, b: THREE.Vector3, height: number): void {
    const d = this.deck;
    const dx = b.x - a.x, dz = b.z - a.z, over = 0.45 / Math.max(Math.hypot(dx, dz), 1e-3);
    d.x0 = a.x - dx * over; d.z0 = a.z - dz * over; d.x1 = b.x + dx * over; d.z1 = b.z + dz * over;
    d.height = height;
    d.height1 = undefined;
    const decks = this.cast.child.decks;
    if (!decks.includes(d)) decks.push(d);
  }

  private offDeck(): void {
    const decks = this.cast.child.decks;
    const i = decks.indexOf(this.deck);
    if (i >= 0) decks.splice(i, 1);
  }

  private to(phase: MillCrossing['phase']): void {
    this.phase = phase;
    this.t = 0;
  }
}

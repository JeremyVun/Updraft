import * as THREE from 'three';
import { tuning } from '../../tuning';
import type { PointerInput } from '../../input/pointer';
import type { Traveller } from '../../traveller/traveller';
import type { WindField } from '../../wind/field';
import type { WindLines } from '../../fx/windlines';
import type { MaterialSound } from '../../audio/foley';
import { ToppleTree, type TreeEvent, type TreeSpot } from './topple-tree';

/** The dead tree's voice in the world's foley: its creak as it rocks, the roots giving and tearing, the fall. */
export const TREE_SOUNDS = { creak: 'tree-creak', loosen: 'roots-give', tear: 'root-tear', impact: 'tree-fall' } as const satisfies Record<TreeEvent, MaterialSound>;

/** Where she waits for the tree, and where she goes on to once she is over. */
export interface TreeWay {
  /** On the near side, a step back from the end, where she stands while the player works on the tree. */
  wait: THREE.Vector3;
  /** Where she hops down off the end of the trunk onto what it lies across: the trunk is as thick as she is tall to the waist. */
  stepOff: THREE.Vector3;
  /** On the far side, past where she steps off the trunk. */
  onward: THREE.Vector3;
  /** She waits by its foot and walks up the trunk from where it lies over her side to where it rests on the far roof. */
  climb?: boolean;
}

export interface CrossingCast {
  child: Traveller;
  wind: WindField;
  lines: WindLines;
  input: PointerInput;
}

/**
 * The first crossing: she stops at the end of a ridge with deep water between her and a garden wall, and the dead
 * tree beside the gap is the way over once the player has pushed it down. She waits as long as it takes, looking across
 * to where it would take her and up at it now and then; the push across its crown is drawn soon after she stops and
 * again whenever a try has not brought it down, and after long enough with nothing gained the world's own gust does it.
 */
export class TreeCrossing {
  readonly tree: ToppleTree;
  phase: 'off' | 'waiting' | 'falling' | 'looking' | 'crossing' | 'over' = 'off';
  /** Where the drawn push goes while she waits and the player has not found it, and its screen angle. */
  invitation: THREE.Vector3 | null = null;
  heading = 0;
  /** Seconds in the current phase. */
  t = 0;
  private quiet = 0;
  private stirred = 0;
  private stalled = 0;
  private best = 0;
  private valveClock = 0;
  private valveOn = false;
  private readonly at = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly lineDir = new THREE.Vector2();

  /** Given a tree already standing in the world, it takes that one over. */
  constructor(spot: TreeSpot | ToppleTree, readonly way: TreeWay, private readonly cast: CrossingCast) {
    this.tree = spot instanceof ToppleTree ? spot : new ToppleTree(spot, cast.wind);
  }

  get done(): boolean {
    return this.phase === 'over';
  }

  /** Once the world's own gust has taken over it keeps on until she is across: its own progress never stops it. */
  get valving(): boolean {
    if (this.stalled > tuning.crossings.tree.valveAfter) this.valveOn = true;
    return this.valveOn;
  }

  reset(): void {
    this.tree.reset();
    this.phase = 'off';
    this.invitation = null;
    this.t = this.quiet = this.stirred = this.stalled = this.best = this.valveClock = 0;
    this.valveOn = false;
    const decks = this.cast.child.decks;
    const i = decks.indexOf(this.tree.deck);
    if (i >= 0) decks.splice(i, 1);
  }

  /** She has come to the end of the ridge: from here the gap is hers to wait at. */
  begin(): void {
    this.phase = 'waiting';
    this.t = this.quiet = this.stirred = this.stalled = 0;
    this.best = this.tree.progress;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const k = tuning.crossings.tree;
    const { child, input } = this.cast;
    this.t += dt;
    const pushed = this.tree.brush(camera, input, dt);
    if (pushed > 0.002) this.quiet = 0;
    this.quiet += dt;
    if (this.phase === 'waiting') this.wait(dt, camera);
    this.tree.update(dt);

    if (this.phase === 'falling' && this.tree.down) this.to('looking');
    if (this.phase === 'falling') {
      child.lookAt = this.tree.trunkAt(0.75, this.look);
    } else if (this.phase === 'looking') {
      child.lookAt = this.tree.trunkAt(this.tree.down ? 0.6 : 0.75, this.look);
      if (this.t > k.lookFor && !child.busy) this.cross();
    }
    if (this.phase !== 'waiting') this.invitation = null;
  }

  private wait(dt: number, camera: THREE.PerspectiveCamera): void {
    const k = tuning.crossings.tree;
    const { child } = this.cast;
    const progress = this.tree.progress;
    if (progress > this.best + 0.02) {
      this.best = progress;
      this.stalled = 0;
    } else this.stalled += dt;
    this.stirred = this.tree.stirring > k.stirs ? k.glanceFor : Math.max(0, this.stirred - dt);
    const glancing = this.stirred > 0 || this.t % k.glanceEvery > k.glanceEvery - k.glanceFor;
    const across = this.way.stepOff;
    child.lookAt = glancing ? this.tree.trunkAt(k.glanceAt, this.look) : this.look.set(across.x, across.y + 0.4, across.z);
    const invited = this.t > k.inviteAfter && this.quiet > k.inviteQuiet && !this.valving;
    this.invitation = invited ? this.tree.trunkAt(k.inviteAt, this.at) : null;
    this.heading = this.tree.fallHeading(camera);
    if (this.valving) this.blow(dt);
    if (this.tree.state === 'falling') {
      this.to('falling');
      if (this.way.climb) return;
      /** A step back from the end as it comes down toward her. */
      const back = this.lineDir.set(this.way.wait.x - this.tree.spot.rest.x, this.way.wait.z - this.tree.spot.rest.z).normalize();
      child.walkTo(this.way.wait.x + back.x * 0.7, this.way.wait.z + back.y * 0.7, false, undefined, 0.15);
    }
  }

  /** The world's own gust: across the tree toward the gap, drawn and pushing as a firm stroke would. */
  private blow(dt: number): void {
    const k = tuning.crossings.tree;
    this.valveClock -= dt;
    if (this.valveClock > 0) return;
    this.valveClock = k.valveEvery;
    const f = this.tree.fall;
    const mid = this.tree.trunkAt(0.45, this.at);
    this.cast.lines.gust(mid.x - f.x * 2, mid.z - f.y * 2, f.x, f.y, 6, 9);
    this.cast.wind.addSplat({ source: this, impulse: true, ax: mid.x - f.x * 4, az: mid.z - f.y * 4, bx: mid.x + f.x * 2, bz: mid.z + f.y * 2,
      vx: f.x * 9, vz: f.y * 9, radius: 3.5, energy: 0.8, lift: 0, swirl: 0 });
    this.tree.nudge(k.valvePush);
  }

  /**
   * Onto the trunk where it lies on the ridge, and down it to the far side with her arms out; or, climbing, onto it
   * where it lies over her wall and up it to where it rests on the far roof.
   */
  private cross(): void {
    const k = tuning.crossings.tree;
    const { child } = this.cast;
    const deck = this.tree.deck;
    if (!child.decks.includes(deck)) child.decks.push(deck);
    this.to('crossing');
    child.lookAt = null;
    const len = Math.hypot(deck.x1 - deck.x0, deck.z1 - deck.z0);
    const on = Math.min(0.35, len * 0.1);
    const ux = (deck.x1 - deck.x0) / len, uz = (deck.z1 - deck.z0) / len;
    const along = (onto: () => void) => {
      child.balance = 1;
      child.stroll = k.crossStroll;
      onto();
    };
    const off = () => {
      const to = this.way.stepOff;
      const way = this.lineDir.set(to.x - child.position.x, to.z - child.position.z).normalize();
      child.leap(this.at.set(way.x * 1.1, 1.1, way.y * 1.1), to, 9.81, () => { child.balance = 0; }, () => {
        child.stroll = 1;
        child.walkTo(this.way.onward.x, this.way.onward.z, false, () => this.to('over'), 0.3);
      }, true);
    };
    if (!this.way.climb) {
      child.walkTo(deck.x0 + ux * on, deck.z0 + uz * on, false, () => along(() => child.walkTo(deck.x1, deck.z1, false, off, 0.12)), 0.12);
      return;
    }
    /**
     * Back along her wall to beside the trunk where it lies over it, as thick as she is tall to the waist, up onto it and
     * up it on all fours of balance.
     */
    const foot = this.look.set(deck.x1 - ux * k.climbOn, 0, deck.z1 - uz * k.climbOn);
    foot.y = deck.height1! + (deck.height - deck.height1!) * (k.climbOn / len);
    const back = this.lineDir.set(this.way.wait.x - deck.x1, this.way.wait.z - deck.z1).normalize();
    const fromX = deck.x1 + back.x * k.climbReach, fromZ = deck.z1 + back.y * k.climbReach;
    const near = Math.hypot(child.position.x - fromX, child.position.z - fromZ);
    child.walkTo(fromX, fromZ, false, () => {
      const way = this.lineDir.set(foot.x - child.position.x, foot.z - child.position.z).normalize();
      child.leap(this.at.set(way.x * 0.8, 1.6, way.y * 0.8), foot.clone(), 9.81, () => {}, () => along(() =>
        child.walkTo(deck.x0 + ux * k.climbShort, deck.z0 + uz * k.climbShort, false, off, 0.12)), true);
    }, near > 0.2 ? 0.15 : 10);
  }

  private to(phase: TreeCrossing['phase']): void {
    this.phase = phase;
    this.t = 0;
  }
}

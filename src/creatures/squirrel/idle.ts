import * as THREE from 'three';

/** The ways it holds still that have a red squirrel's stop-start life in them. */
export type Still = 'stand' | 'sit' | 'perch' | 'freeze' | 'climb' | 'buried';

type Fidget = 'glance' | 'flick' | 'hop' | 'bob' | 'ears';

/** For each way of holding still, how long it stays still between fidgets (s) and how often it does each. */
const HABITS: Record<Still, { gap: [number, number]; does: Partial<Record<Fidget, number>> }> = {
  stand: { gap: [0.25, 1.1], does: { glance: 3, flick: 3, hop: 3, bob: 1, ears: 1 } },
  sit: { gap: [0.35, 1.4], does: { glance: 3, flick: 3, hop: 2, ears: 2 } },
  perch: { gap: [0.4, 1.6], does: { glance: 3, flick: 3, ears: 2 } },
  freeze: { gap: [0.8, 2.2], does: { flick: 2, ears: 1, glance: 0.6 } },
  climb: { gap: [0.5, 1.8], does: { glance: 2, flick: 2, ears: 1 } },
  buried: { gap: [1.0, 2.6], does: { flick: 1 } },
};
const TAU = Math.PI * 2;
const FLICK = 0.17;
const BOB = 0.26;
const between = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * How it is never quite still: long moments frozen, broken by a fidget, each sudden and over at once. Its head snaps
 * round in two or three quick looks; its tail jerks up its length in a run of flicks; its ears flick; it bobs; or it
 * hops round on the spot to face a little away, and next time back. The squirrel reads what to lay over its pose
 * here each frame and takes `hop` when it is set.
 */
export class Idle {
  /** Where the head is snapped to, from where it would look: across to its left and up, radians. */
  readonly glance = new THREE.Vector2();
  tailLift = 0;
  tailFlick = 0;
  ripple = 0;
  ripplePhase = 0;
  /** A quick dip of the body, 0..1. */
  bob = 0;
  earL = 0;
  earR = 0;
  /** A turn on the spot it wants to hop, radians (to its left positive); taken and cleared by the squirrel. */
  hop = 0;
  private wait = 0.6;
  private flicks = 0;
  private flickT = 0;
  private looks = 0;
  private lookIn = 0;
  private wide = 1;
  private bobT = -1;
  private away = false;
  private lastHop = 0;

  /** Starts it still afresh, the next fidget a moment off. */
  reset(): void {
    this.wait = between(0.3, 0.9);
    this.flicks = this.looks = 0;
    this.bobT = -1;
    this.hop = 0;
    this.away = false;
  }

  update(dt: number, still: Still | null, canHop: boolean): void {
    this.earL *= Math.exp(-dt * 9);
    this.earR *= Math.exp(-dt * 9);
    this.tick(dt);
    if (!still) {
      this.glance.set(0, 0);
      return;
    }
    this.wait -= dt;
    if (this.wait > 0 || this.flicks > 0 || this.looks > 0) return;
    const habit = HABITS[still];
    const fidget = this.pick(habit.does, canHop);
    this.wait = between(...habit.gap);
    this.wide = still === 'freeze' ? 0.4 : still === 'perch' || still === 'climb' ? 0.8 : 1;
    if (fidget === 'glance') {
      this.looks = 1 + Math.floor(Math.random() * 3);
      this.lookIn = 0;
    } else if (fidget === 'flick') {
      this.flicks = still === 'freeze' ? 1 : 2 + Math.floor(Math.random() * 3);
      this.flickT = 0;
    } else if (fidget === 'hop') {
      this.hop = this.away ? -this.lastHop : between(0.4, 0.8) * (Math.random() < 0.5 ? -1 : 1);
      this.lastHop = this.hop;
      this.away = !this.away;
      this.wait += 0.25;
    } else if (fidget === 'bob') this.bobT = 0;
    else {
      if (Math.random() < 0.6) this.earL = 1;
      if (Math.random() < 0.6) this.earR = 1;
      if (this.earL + this.earR === 0) this.earL = this.earR = 1;
    }
  }

  /** A run of `count` tail flicks now, whatever it was doing. */
  flick(count: number): void {
    this.flicks = count;
    this.flickT = 0;
  }

  /** The hop it asked for, if any, and forgets it. */
  takeHop(): number {
    const turn = this.hop;
    this.hop = 0;
    return turn;
  }

  private pick(does: Partial<Record<Fidget, number>>, canHop: boolean): Fidget {
    if (this.away && canHop && does.hop) return 'hop';
    let total = 0;
    for (const [f, w] of Object.entries(does) as [Fidget, number][]) if (f !== 'hop' || canHop) total += w;
    let r = Math.random() * total;
    for (const [f, w] of Object.entries(does) as [Fidget, number][]) {
      if (f === 'hop' && !canHop) continue;
      r -= w;
      if (r <= 0) return f;
    }
    return 'glance';
  }

  private tick(dt: number): void {
    if (this.looks > 0) {
      this.lookIn -= dt;
      if (this.lookIn <= 0) {
        this.looks--;
        const w = this.wide;
        if (this.looks === 0 && Math.random() < 0.5) this.glance.set(0, 0);
        else this.glance.set(between(-1.1, 1.1) * w, between(-0.25, 0.45) * w);
        this.lookIn = between(0.18, 0.4);
      }
    }
    let pulse = 0;
    if (this.flicks > 0) {
      this.flickT += dt;
      if (this.flickT >= FLICK) {
        this.flickT -= FLICK;
        this.flicks--;
      }
      if (this.flicks > 0) pulse = Math.sin((this.flickT / FLICK) * Math.PI);
    }
    this.tailFlick = 1.4 * pulse;
    this.tailLift = 0.32 * pulse;
    this.ripple += ((this.flicks > 0 ? 0.28 : 0) - this.ripple) * (1 - Math.exp(-dt * 12));
    this.ripplePhase += dt * TAU * 5;
    if (this.bobT >= 0) {
      this.bobT += dt;
      this.bob = this.bobT < BOB ? Math.sin((this.bobT / BOB) * Math.PI) : 0;
      if (this.bobT >= BOB) this.bobT = -1;
    }
  }
}

import * as THREE from 'three';
import { tuning } from '../tuning';
import type { Traveller } from './traveller';

/** A place she climbs by: where a mitten closes on it, where an ankle sits with the boot's toe in it, and its height. */
export interface ClimbHold {
  hand: THREE.Vector3;
  foot: THREE.Vector3;
  up: number;
}

/**
 * A wall she climbs up and over the sill of an opening at its top: a point on the wall's face at the foot of the
 * climb (the ridge she starts from) and the wall's outward normal; each side's holds, low to high, her left first as
 * she faces the wall; the middle of the sill's outer edge, and how deep the wall is there.
 */
export interface ClimbWay {
  wall: THREE.Vector3;
  out: THREE.Vector3;
  holds: [ClimbHold[], ClimbHold[]];
  sill: THREE.Vector3;
  depth: number;
}

/** Her limbs, as the climb moves them: her left hand, her right hand, her left foot, her right foot; -1 is her body. */
type Limb = -1 | 0 | 1 | 2 | 3;

/** One move: a limb (or her body) from where it was to `to`, which is where it is once the move is over. */
interface Step {
  limb: Limb;
  to: THREE.Vector3;
  from: THREE.Vector3;
  /** Seconds it takes going up, and when it starts after the one before. */
  dur: number;
  gap: number;
  /** Her body's lean in to the wall once it is over (going up). */
  lean?: number;
}

interface Running {
  step: Step;
  start: number;
  dur: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  feel: boolean;
}

/** How high above her soles a hand can close at full reach, and how low before it moves on up. */
const REACH = 2.08;
const LOW_HAND = 1.36;
/** How high over the foot she stands on a raised knee can carry the other. */
const KNEE = 0.97;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Her climb up a wall by its holds, hand over hand, a knee up and a foot onto the next fork and a push up onto it,
 * over the sill on her knee and in; and down the same way, feet first, each foot feeling for its hold. She goes by
 * turns, a hand and the opposite foot: the hand that is lowest goes up first to the next hold it can reach, the
 * lower foot comes up onto the next hold on its own side, and only once it is there does her body rise. Every hold a
 * hand lets go of is taken by the foot on that side later, as on a ladder. The moves are planned once from the holds
 * and played in time; her limbs and her body only ever go where the plan puts them, so nothing slips.
 */
export class Climb {
  phase: 'off' | 'up' | 'down' = 'off';
  /** Seconds into the climb, and how long it takes. */
  t = 0;
  length = 0;
  /** QA: how far a mitten or an ankle was ever from where it was put while it was meant to be there. */
  readonly worst = { hand: 0, foot: 0, handAt: '', footAt: '' };
  private plan: Step[] = [];
  private running: Running[] = [];
  private next = 0;
  private nextAt = 0;
  private readonly limbs = [0, 1, 2, 3].map(() => new THREE.Vector3());
  private readonly root = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly lookWant = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private onDone: (() => void) | null = null;
  private lean = 0.12;
  private leanWant = 0.12;
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly child: Traveller, readonly way: ClimbWay) {
    this.right.crossVectors(way.out, UP).negate();
  }

  get busy(): boolean {
    return this.phase !== 'off';
  }

  /** The way she faces on the wall: into it. */
  get facing(): number {
    return Math.atan2(-this.way.out.x, -this.way.out.z);
  }

  /** Where she stands at the foot of the wall to start. */
  start(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.way.wall).addScaledVector(this.way.out, tuning.crossings.climb.standOff);
  }

  /** From where she stands at the foot, facing the wall, up and over the sill; `onDone` once she stands in the opening. */
  up(onDone?: () => void): void {
    this.plan = this.planned().up;
    this.begin('up', onDone);
  }

  /** From standing in the opening with her back to the drop, back over the sill and down; `onDone` once she is on the ridge. */
  down(onDone?: () => void): void {
    this.plan = this.planned().down;
    this.begin('down', onDone);
  }

  stop(): void {
    this.phase = 'off';
    this.running.length = 0;
    const c = this.child;
    c.climbing = 0;
    for (const foot of [0, 1] as const) c.footFor(foot, null);
    c.reachFor(0, null);
    c.reachFor(1, null);
    c.climbPose.lean = c.climbPose.twist = c.climbPose.sway = 0;
  }

  resetWorst(): void {
    this.worst.hand = this.worst.foot = 0;
    this.worst.handAt = this.worst.footAt = '';
  }

  update(dt: number): void {
    if (this.phase === 'off') return;
    const c = this.child;
    this.t += dt;
    while (this.next < this.plan.length && this.t >= this.nextAt) {
      const s = this.plan[this.next];
      const from = (s.limb < 0 ? this.root : this.limbs[s.limb]).clone();
      this.running.push({ step: s, start: this.nextAt, dur: s.dur, from, to: s.to, feel: this.phase === 'down' && s.limb >= 2 });
      this.next++;
      if (this.next < this.plan.length) this.nextAt += this.plan[this.next].gap;
    }
    let reaching = 0, twist = 0;
    for (const r of this.running) {
      const u = THREE.MathUtils.clamp((this.t - r.start) / r.dur, 0, 1);
      const limb = r.step.limb;
      if (limb < 0) {
        const e = THREE.MathUtils.smootherstep(u, 0, 1);
        this.root.lerpVectors(r.from, r.to, e);
        if (r.step.lean !== undefined) this.leanWant = r.step.lean;
        continue;
      }
      this.moveLimb(r, u, this.limbs[limb]);
      if (u < 1) {
        reaching = Math.max(reaching, Math.sin(u * Math.PI));
        if (limb < 2) twist = (limb === 0 ? 1 : -1) * 0.16 * Math.sin(u * Math.PI);
        this.lookWant.copy(r.to);
        if (limb >= 2 && this.phase === 'up') this.lookWant.addScaledVector(UP, 0.9);
      }
    }
    this.running = this.running.filter((r) => this.t < r.start + r.dur);

    this.look.lerp(this.lookWant, 1 - Math.exp(-dt * 6));
    this.lean += (this.leanWant - this.lean) * (1 - Math.exp(-dt * 4));
    c.position.copy(this.root);
    c.yaw = this.facing;
    c.climbing = 1;
    c.climbPose.lean = this.lean - 0.06 * reaching;
    c.climbPose.twist = twist;
    c.climbPose.sway = 0.05 * Math.sin(this.t * 2.6);
    c.lookAt = this.look;
    for (const hand of [0, 1] as const) c.reachFor(hand, this.limbs[hand]);
    for (const foot of [0, 1] as const) c.footFor(foot, this.limbs[foot + 2]);
    this.measure();

    if (this.next >= this.plan.length && this.running.length === 0) this.finish();
  }

  /** Away from the wall and on, then in onto the hold; a foot going down overshoots a little and feels its way back up onto it. */
  private moveLimb(r: Running, u: number, into: THREE.Vector3): void {
    const k = tuning.crossings.climb;
    const e = THREE.MathUtils.smootherstep(u, 0, 1);
    into.lerpVectors(r.from, r.to, e);
    const span = r.from.distanceTo(r.to);
    into.addScaledVector(this.way.out, Math.min(k.arc, span * 0.4) * Math.sin(u * Math.PI));
    if (r.feel) {
      const f = THREE.MathUtils.smoothstep(u, 0.45, 0.8) * (1 - THREE.MathUtils.smoothstep(u, 0.8, 1));
      into.addScaledVector(UP, -0.07 * f).addScaledVector(this.right, 0.05 * Math.sin(u * 14) * f);
    } else if (r.step.limb >= 2) {
      into.addScaledVector(UP, 0.06 * Math.sin(u * Math.PI));
    }
  }

  private begin(phase: 'up' | 'down', onDone?: () => void): void {
    const c = this.child;
    this.phase = phase;
    this.onDone = onDone ?? null;
    this.t = 0;
    this.next = 0;
    this.nextAt = 0;
    this.running.length = 0;
    this.root.copy(c.position);
    c.mitten(0, this.limbs[0]);
    c.mitten(1, this.limbs[1]);
    c.ankle(0, this.limbs[2]);
    c.ankle(1, this.limbs[3]);
    c.stop();
    c.climbing = 1;
    this.lookWant.copy(this.plan[0].to);
    this.look.copy(c.position).addScaledVector(UP, 2);
    this.lean = this.leanWant = phase === 'up' ? 0.12 : 0.2;
    this.length = this.plan.reduce((t, s) => t + s.gap, 0) + this.plan[this.plan.length - 1].dur;
  }

  private finish(): void {
    const done = this.onDone;
    const c = this.child;
    this.phase = 'off';
    c.climbing = 0;
    for (const foot of [0, 1] as const) c.footFor(foot, null);
    c.reachFor(0, null);
    c.reachFor(1, null);
    c.lookAt = null;
    this.onDone = null;
    done?.();
  }

  private measure(): void {
    const c = this.child;
    for (const hand of [0, 1] as const) {
      if (c.reached(hand) < 0.99 || this.running.some((r) => r.step.limb === hand)) continue;
      const gap = c.mitten(hand, this.tmp).distanceTo(this.limbs[hand]);
      if (gap > this.worst.hand) {
        this.worst.hand = gap;
        this.worst.handAt = `${this.phase} ${this.t.toFixed(2)}s hand ${hand}`;
      }
    }
    for (const foot of [0, 1] as const) {
      if (c.footReached(foot) < 0.99 || this.running.some((r) => r.step.limb === foot + 2)) continue;
      const slip = c.ankle(foot, this.tmp).distanceTo(this.limbs[foot + 2]);
      if (slip > this.worst.foot) {
        this.worst.foot = slip;
        this.worst.footAt = `${this.phase} ${this.t.toFixed(2)}s foot ${foot}`;
      }
    }
  }

  /**
   * The whole way up as moves, worked out from the holds: where each limb and her body are after each move, so that
   * every hold is within reach of where her body is when a limb is on it. It starts from her standing at the foot
   * with her arms down, whether she is there yet or not. Going down, she backs out over the sill (its own moves, so
   * that her body is lowered before a foot feels down for the top hold) and then plays the ladder backwards: each limb
   * back to where it came from, every foot feeling for its hold.
   */
  private planned(): { up: Step[]; down: Step[] } {
    const k = tuning.crossings.climb;
    const { wall, out, holds, sill, depth } = this.way;
    const plan: Step[] = [];
    const root0 = this.start();
    const facing = out.clone().negate();
    const side = (s: number) => this.right.clone().multiplyScalar(s ? 1 : -1);
    const limbs = [0, 1].map((s) => root0.clone().addScaledVector(side(s), 0.32).addScaledVector(UP, 1.05).addScaledVector(facing, 0.1))
      .concat([0, 1].map((s) => root0.clone().addScaledVector(side(s), 0.15).addScaledVector(UP, 0.11)));
    const base = wall.y;
    const lateral = (p: THREE.Vector3) => p.clone().sub(wall).dot(this.right);
    let rootY = base, standOff = k.standOff;
    const rootAt = () => {
      const across = (lateral(limbs[0]) + lateral(limbs[1])) * 0.2 + (lateral(limbs[2]) + lateral(limbs[3])) * 0.3;
      return wall.clone().addScaledVector(this.right, across).addScaledVector(out, standOff).setY(rootY);
    };
    let root = root0.clone();
    const move = (limb: Limb, to: THREE.Vector3, dur: number, gap: number, lean?: number) => {
      plan.push({ limb, from: (limb < 0 ? root : limbs[limb]).clone(), to: to.clone(), dur, gap, lean });
      if (limb < 0) root = to.clone();
      else limbs[limb] = to.clone();
    };
    const sole = [0, 0];
    const hand = [-1, -1];
    const foot = [-1, -1];
    const grip = (h: ClimbHold) => h.hand.y - base;
    /** The highest hold on a side a hand can reach from where her body is, or -1. */
    const highest = (s: number, rel: number, above = -1) => {
      let best = -1;
      holds[s].forEach((h, i) => { if (i > above && grip(h) <= rel + REACH && h.up < sill.y - base - 0.2) best = i; });
      return best;
    };
    hand[0] = highest(0, 0);
    hand[1] = highest(1, -0.25);
    move(0, holds[0][hand[0]].hand, 0.45, 0, 0.12);
    move(1, holds[1][hand[1]].hand, 0.45, 0.22, 0.12);

    const S = sill.y - base;
    const onSill = [false, false];
    const sillHand = (s: number) => sill.clone().addScaledVector(side(s), 0.24).addScaledVector(out, -0.1).addScaledVector(UP, 0.045);
    let foot0 = holds[1][0].up < holds[0][0].up ? 1 : 0;
    let gap = 0.32;
    const sillGrip = S + 0.045;
    for (let guard = 0; guard < 40 && !(onSill[0] && onSill[1] && rootY - base >= S - 1.3); guard++) {
      const other = 1 - foot0;
      const rel = rootY - base;
      const want = holds[foot0].findIndex((h, i) => i > foot[foot0] && h.up > sole[other] + 0.1);
      if (want < 0 || holds[foot0][want].up > rel + KNEE) break;
      const after = Math.max(0, Math.min(holds[foot0][want].up, sole[other]) - 0.2);
      /**
       * Before her body rises, any hand it would leave too low goes up to the highest hold it can reach, the hand on the
       * other side from the foot first; once the sill is in reach it goes onto that.
       */
      let moved = 0;
      for (const s of [other, foot0]) {
        if (onSill[s] || grip(holds[s][hand[s]]) > after + LOW_HAND) continue;
        const up = highest(s, rel, hand[s]);
        const lead = moved ? k.hand * 0.6 : gap;
        if (sillGrip <= rel + REACH + 0.04 && (up < 0 || holds[s][up].up > S - 0.6)) {
          onSill[s] = true;
          move(s as Limb, sillHand(s), k.hand * 1.25, lead, 0.16);
          moved++;
        } else if (up >= 0) {
          hand[s] = up;
          move(s as Limb, holds[s][up].hand, k.hand, lead, 0.14);
          moved++;
        }
      }
      foot[foot0] = want;
      sole[foot0] = holds[foot0][want].up;
      move((foot0 + 2) as Limb, holds[foot0][want].foot, k.foot, moved ? k.lead : gap, 0.16);
      rootY = base + after;
      standOff = k.standOff - 0.2 * THREE.MathUtils.smoothstep(rootY - base, S - 1.9, S - 1.0);
      move(-1, rootAt(), k.push, k.foot * 0.75, 0.2);
      gap = Math.max(0.05, k.beat - (moved ? k.lead + (moved - 1) * k.hand * 0.6 : 0) - k.foot * 0.75);
      foot0 = other;
    }

    for (const s of [0, 1]) if (!onSill[s]) move(s as Limb, sillHand(s), k.reachSill, 0.3, 0.16);
    const ladder = plan.length;
    const top = limbs.map((l) => l.clone());
    const ladderRoot = root.clone();
    const inReveal = (deep: number, across: number, up: number) =>
      sill.clone().addScaledVector(out, -deep).addScaledVector(this.right, across).addScaledVector(UP, up);
    const jamb = (s: number, up: number) => inReveal(0.14, s ? 0.47 : -0.47, up + (s ? 0.06 : 0));
    const knee = inReveal(0.26, 0.12, 0.13);
    const stand = inReveal(depth * 0.45, 0, 0);
    const standFoot = (s: number) => stand.clone().addScaledVector(side(s), 0.14).addScaledVector(UP, 0.11);
    /** Up on her arms until her chest is over the sill; her hands to the sides of the opening; a knee up onto it; up into the opening. */
    rootY = Math.max(rootY, sill.y - 1.02);
    standOff = 0.2;
    const over = rootAt();
    move(-1, over, k.pull, 0.2, 0.3);
    move(0, jamb(0, 0.6), k.hand, k.pull * 0.7, 0.3);
    move(1, jamb(1, 0.6), k.hand, k.hand * 0.6, 0.3);
    move(3, knee, k.knee, k.hand * 0.5, 0.32);
    move(-1, stand, k.rise, k.knee * 0.85, 0.24);
    move(0, jamb(0, 1.4), k.rise * 0.8, k.rise * 0.15, 0.2);
    move(1, jamb(1, 1.4), k.rise * 0.8, 0.06, 0.2);
    move(2, standFoot(0), k.knee * 0.8, k.rise * 0.2, 0.2);
    move(3, standFoot(1), k.knee * 0.6, k.knee * 0.7, 0.1);

    const d = k.down;
    const step = (limb: Limb, to: THREE.Vector3, dur: number, gap: number, lean?: number): Step => ({ limb, from: to, to: to.clone(), dur, gap, lean });
    /** Backing out: hold the sides of the opening, a foot to the edge of the sill, down over it on her arms, a foot feeling for the top fork. */
    const out0 = [
      step(0, jamb(0, 1.4), k.hand * d, 0, 0.2),
      step(1, jamb(1, 1.4), k.hand * d, 0.15, 0.2),
      step(3, knee, k.knee * d, 0.35, 0.24),
      step(-1, over, k.rise * d * 1.2, k.knee * d * 0.8, 0.3),
      step(0, jamb(0, 0.6), k.hand * d, k.rise * d * 0.3, 0.3),
      step(1, jamb(1, 0.6), k.hand * d, 0.1, 0.3),
      step(2, top[2], k.foot * d + k.feel, k.hand * d * 0.4, 0.3),
      step(0, top[0], k.hand * d, k.foot * d + k.feel * 0.7, 0.3),
      step(1, top[1], k.hand * d, k.hand * d * 0.6, 0.3),
      step(3, top[3], k.foot * d + k.feel, k.hand * d * 0.6, 0.3),
      step(-1, ladderRoot, k.pull * d, k.foot * d, 0.2),
    ];
    const back = plan.slice(0, ladder).reverse().map((s, i, all): Step => {
      const after = all[i - 1];
      return { limb: s.limb, from: s.to, to: s.from, dur: s.dur * d + (s.limb >= 2 ? k.feel : 0), gap: (after?.gap ?? 0.3) * d, lean: s.lean };
    });
    back[0].gap = k.foot * d + k.feel;
    return { up: plan, down: [...out0, ...back] };
  }
}

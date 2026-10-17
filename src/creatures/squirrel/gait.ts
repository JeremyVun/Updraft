import * as THREE from 'three';
import type { Kind } from './route';

export interface Paw {
  /** Where the pad meets what it stands on. Planted, this does not move. */
  at: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  planted: boolean;
  swing: number;
  /** Where in its own cycle this swing began: late, if it was picked up part-way through, so it never jumps ahead. */
  begun: number;
  curl: number;
  /** How far a hind foot lies back from standing on its toes. */
  hock: number;
  /** What it last came down on. */
  on: Kind;
}

const paw = (): Paw => ({ at: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), planted: true, swing: 0, begun: 0, curl: 0, hock: 1.45, on: 'ground' });

type Four = readonly [number, number, number, number];

/**
 * How it goes on each kind of surface: when in the stride each paw comes down (front left, front right, hind left,
 * hind right) and the share of it each stays down; where each pair is put down, [across, ahead] of the point under
 * it at the middle of its time down; and how long a stride is for a speed (both before scale).
 *
 * All three are the squirrel's bound: the forepaws land together, the body vaults over them and the hind feet swing
 * up outside them and come down ahead of where they are, then drive it on into the air. On the ground there is a
 * long flight between bounds; up a trunk the reach is short and it is never off the bark; along the wool every paw
 * comes down on the one line.
 */
export interface Pattern {
  down: Four;
  duty: Four;
  front: readonly [number, number];
  hind: readonly [number, number];
  stride: (speed: number) => number;
  /** Where in the stride it sets off from standing: its hind feet down to push, its forepaws just lifting to reach. */
  setOff: number;
}

export const PATTERNS: Record<Kind, Pattern> = {
  ground: { down: [0, 0.04, 0.24, 0.27], duty: [0.3, 0.3, 0.32, 0.32], front: [0.011, 0.034], hind: [0.024, 0.004], stride: (v) => Math.min(0.26, 0.1 + 0.14 * v), setOff: 0.3 },
  trunk: { down: [0, 0.05, 0.4, 0.44], duty: [0.45, 0.45, 0.5, 0.5], front: [0.024, 0.03], hind: [0.03, -0.012], stride: (v) => Math.min(0.12, 0.06 + 0.1 * v), setOff: 0.45 },
  line: { down: [0, 0.05, 0.28, 0.32], duty: [0.38, 0.38, 0.4, 0.4], front: [0.0015, 0.032], hind: [0.003, 0.0], stride: (v) => Math.min(0.2, 0.08 + 0.12 * v), setOff: 0.38 },
};

/** Where it is on its way this frame, and how to put a paw on what is under it. */
export interface Support {
  origin: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  side: THREE.Vector3;
  scale: number;
  snap: (p: THREE.Vector3) => Kind;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
/**
 * The most bounds a second, whatever the surface: faster than that it reaches further each bound and is down for
 * less of it, as a squirrel flat out does.
 */
const CADENCE = 7;
/** The longest it is ever off the ground in a bound, seconds: going slowly its hind feet stay down longer instead. */
const HANG = 0.13;

/**
 * Its paws, each put down somewhere and left exactly there until it is picked up, with the body carried over it.
 * Going, the stride advances by distance travelled, never by the clock, so a paw never slides whatever the speed;
 * a paw in the air sweeps on one smooth curve from where it left, through where the bound carries it (a forepaw
 * tucked up under the chest then reaching, a hind foot trailing out behind then swinging up under the belly), to
 * where it will land. Standing, a paw left out of place is stepped home, one at a time.
 */
export class SquirrelGait {
  readonly paws: [Paw, Paw, Paw, Paw] = [paw(), paw(), paw(), paw()];
  phase = 0;
  speed = 0;
  /** How much longer than its usual bound the stride is, taken up at the start of each: 1 at its own pace, more flat out. */
  reach = 1;
  /** Seconds a stride takes at the pace it is going. */
  period = 1;
  /** Where in the stride its last hind foot leaves what it stands on, all four in the air until the forepaws land at 0. */
  liftOff = 1;
  /** Paws that came down this frame, and on what. */
  readonly landed: number[] = [];
  /** The surface's pattern, taken up at the start of each stride so no paw changes its mind mid-air. */
  private pattern: Pattern = PATTERNS.ground;
  private readonly prev = new THREE.Vector3();
  private going = false;
  private leaping = false;
  private readonly homes = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  private readonly keys = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly tangents = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly v = new THREE.Vector3();
  /** Each paw's share of the stride down, shorter the further it reaches; and where in its own stride it was last frame. */
  private readonly duty = [0, 0, 0, 0];
  private readonly was = [0, 0, 0, 0];

  /** Every paw down where it is told, nothing carried over. */
  reset(at: readonly THREE.Vector3[]): void {
    for (const [i, p] of this.paws.entries()) {
      p.at.copy(at[i]);
      this.settle(p);
    }
    this.going = false;
    this.leaping = false;
  }

  /** Every paw off whatever it stood on, put where the caller says (in the air, at a leap). */
  lift(at: readonly THREE.Vector3[], curl: number): void {
    for (const [i, p] of this.paws.entries()) {
      p.at.copy(at[i]);
      p.from.copy(at[i]);
      p.planted = false;
      p.swing = 0;
      p.curl = curl;
    }
    this.going = false;
    this.leaping = false;
  }

  get still(): boolean {
    return this.paws.every((p) => p.planted);
  }

  /**
   * Standing: planted paws stay put; one well out of place is stepped to `homes`, one at a time, `lift` high. Paws
   * still in the air when it stops are each taken the rest of the way from where they are.
   */
  hold(dt: number, homes: readonly THREE.Vector3[], up: THREE.Vector3, lift: number, slack: number): void {
    this.landed.length = 0;
    if (this.going) {
      for (const p of this.paws) {
        if (p.planted) continue;
        p.from.copy(p.at);
        p.swing = 0;
      }
      this.going = false;
      this.leaping = false;
    }
    this.speed = 0;
    if (this.still) {
      let worst = slack;
      let stepping = -1;
      for (const [i, p] of this.paws.entries()) {
        const off = p.at.distanceTo(homes[i]);
        if (off > worst) {
          worst = off;
          stepping = i;
        }
      }
      if (stepping < 0) return;
      const p = this.paws[stepping];
      p.planted = false;
      p.from.copy(p.at);
      p.swing = 0;
    }
    for (const [i, p] of this.paws.entries()) {
      if (p.planted) continue;
      p.swing = Math.min(1, p.swing + dt / 0.13);
      p.at.lerpVectors(p.from, homes[i], smooth(p.swing)).addScaledVector(up, Math.sin(p.swing * Math.PI) * lift);
      p.curl = Math.sin(p.swing * Math.PI) * 0.8;
      if (p.swing >= 1) {
        p.at.copy(homes[i]);
        this.settle(p);
        this.landed.push(i);
      }
    }
  }

  /** Going: the body is at `s.origin` this frame, on a surface whose pattern is `pattern`, `homes` eased toward it. */
  run(dt: number, s: Support, pattern: Pattern, homes: readonly THREE.Vector2[]): void {
    this.landed.length = 0;
    if (!this.going) {
      this.prev.copy(s.origin);
      this.going = true;
      this.pattern = pattern;
      this.phase = pattern.setOff;
      this.reach = 1;
      for (const p of this.paws) if (!p.planted) this.settleOn(p, s);
    }
    for (let i = 0; i < 4; i++) this.homes[i].copy(homes[i]);
    const moved = this.v.subVectors(s.origin, this.prev).length();
    this.prev.copy(s.origin);
    this.speed = dt > 0 ? moved / dt : 0;
    const k = s.scale;
    const usual = this.pattern.stride(this.speed / k);
    const stride = Math.max(usual, this.speed / k / CADENCE) * k;
    const before = this.phase;
    this.phase = (this.phase + moved / stride) % 1;
    if (this.phase < before) {
      this.pattern = pattern;
      this.reach = stride / (usual * k);
    }
    this.period = this.speed > 1e-3 ? stride / this.speed : Infinity;
    const down = this.pattern.down, duty = this.duty;
    const least = 1 - HANG / this.period;
    this.liftOff = 0;
    for (let i = 0; i < 4; i++) {
      duty[i] = this.pattern.duty[i] / this.reach;
      if (i >= 2) {
        duty[i] = Math.max(duty[i], least - down[i]);
        this.liftOff = Math.max(this.liftOff, down[i] + duty[i]);
      }
    }
    for (const [i, p] of this.paws.entries()) {
      const mine = (((this.phase - down[i]) % 1) + 1) % 1;
      /** Flat out, a frame can step clean over its short time down: it lands all the same, never swinging round again. */
      const due = mine < this.was[i] && !p.planted;
      this.was[i] = mine;
      const swinging = mine >= duty[i] && !due;
      const front = i < 2;
      if (!front) {
        const t = mine < duty[i] ? mine / duty[i] : 1;
        p.hock = swinging ? 0.5 + 0.9 * smooth(Math.min(1, (mine - duty[i]) / (1 - duty[i]) / 0.6)) : 1.45 - 1.0 * smooth(t);
      }
      if (swinging && p.planted) {
        p.planted = false;
        p.from.copy(p.at);
        p.begun = Math.min(mine, 0.98);
      }
      if (swinging) {
        p.swing = Math.max(0, (mine - p.begun) / (1 - p.begun));
        const [across, mid] = [this.homes[i].x * (i % 2 === 0 ? 1 : -1), this.homes[i].y];
        /** Aimed where the body will be when it lands, so it comes down as far ahead of its home as it will leave behind it. */
        const ahead = (1 - mine) * stride + duty[i] * stride * 0.5 + mid * k;
        p.to.copy(s.origin).addScaledVector(s.side, across * k).addScaledVector(s.forward, ahead);
        p.on = s.snap(p.to);
        this.sweep(i, p, s, across);
      } else if (!p.planted) {
        p.at.copy(p.to);
        this.settle(p);
        this.landed.push(i);
      }
    }
  }

  /**
   * From one surface to another (the ground onto a trunk, a trunk onto the wool): every paw comes off together and
   * is carried to its place on the new surface, arriving there as `u` reaches 1, where they come down together and
   * the bound picks up again with a push of the hind feet.
   */
  leap(u: number, s: Support, homes: readonly THREE.Vector2[], lift: number): void {
    this.landed.length = 0;
    if (!this.leaping) {
      this.leaping = true;
      for (const p of this.paws) {
        p.from.copy(p.at);
        p.planted = false;
      }
    }
    const k = s.scale;
    const t = smooth(Math.min(1, u));
    for (const [i, p] of this.paws.entries()) {
      p.to.copy(s.origin).addScaledVector(s.side, homes[i].x * (i % 2 === 0 ? 1 : -1) * k).addScaledVector(s.forward, homes[i].y * k);
      p.on = s.snap(p.to);
      p.at.lerpVectors(p.from, p.to, t).addScaledVector(s.up, Math.sin(Math.PI * t) * lift);
      p.curl = Math.sin(Math.PI * t) * (i < 2 ? 1.1 : 0.7);
      if (i >= 2) p.hock = 1.45 - 0.9 * Math.sin(Math.PI * t);
    }
    this.prev.copy(s.origin);
    this.going = true;
  }

  /** Down from a leap onto a surface going in `pattern`: every paw on the place it was carried to. */
  land(pattern: Pattern): void {
    if (!this.leaping) return;
    this.leaping = false;
    this.landed.length = 0;
    for (const [i, p] of this.paws.entries()) {
      p.at.copy(p.to);
      this.settle(p);
      this.landed.push(i);
    }
    this.phase = pattern.setOff;
    this.pattern = pattern;
  }

  get inLeap(): boolean {
    return this.leaping;
  }

  /** Setting off with a paw still in the air: put down under where it is. */
  private settleOn(p: Paw, s: Support): void {
    p.on = s.snap(p.at);
    this.settle(p);
  }

  private sweep(i: number, p: Paw, s: Support, across: number): void {
    const k = s.scale;
    const [from, a, b, to] = this.keys;
    from.copy(p.from);
    to.copy(p.to);
    const front = i < 2;
    /** Body-relative places the swing passes through: [ahead, up], before scale. */
    const first: [number, number] = front ? [0.03, 0.03] : [-0.075, 0.028];
    const t1 = 0.3, t2 = 0.72;
    a.copy(s.origin).addScaledVector(s.side, across * k).addScaledVector(s.forward, first[0] * k).addScaledVector(s.up, first[1] * k);
    b.lerpVectors(a, to, 0.75).addScaledVector(s.up, (front ? 0.016 : 0.022) * k);
    const times = [0, t1, t2, 1];
    const [m0, m1, m2, m3] = this.tangents;
    m0.subVectors(a, from).multiplyScalar(0.5 / t1);
    m1.subVectors(b, from).divideScalar(t2);
    m2.subVectors(to, a).divideScalar(1 - t1);
    m3.subVectors(to, b).multiplyScalar(0.3 / (1 - t2));
    const j = p.swing < t1 ? 0 : p.swing < t2 ? 1 : 2;
    const h = times[j + 1] - times[j];
    const u = (p.swing - times[j]) / h;
    const u2 = u * u, u3 = u2 * u;
    p.at.copy(this.keys[j]).multiplyScalar(2 * u3 - 3 * u2 + 1)
      .addScaledVector(this.tangents[j], (u3 - 2 * u2 + u) * h)
      .addScaledVector(this.keys[j + 1], -2 * u3 + 3 * u2)
      .addScaledVector(this.tangents[j + 1], (u3 - u2) * h);
    p.curl = front ? 1.2 * Math.sin(Math.PI * Math.min(1, p.swing / 0.6)) : 0.8 * Math.sin(Math.PI * p.swing);
  }

  private settle(p: Paw): void {
    p.planted = true;
    p.swing = 0;
    p.curl = 0;
  }
}

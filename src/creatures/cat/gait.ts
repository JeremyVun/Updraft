import * as THREE from 'three';
import { BOUND_DOWN, BOUND_DUTY, BOUND_SET_OFF, BOUND_SHIFT, boundHock, boundReach } from './bound';

export interface Paw {
  /** Where the pad meets whatever it stands on, in the frame the cat is in. Planted, this does not move. */
  at: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  planted: boolean;
  swing: number;
  /** Where in its own cycle this swing began: late, if it was picked up part-way through, so it never jumps ahead. */
  begun: number;
  /** How far off the surface it is this frame, and how far it is curled as it comes up. */
  lift: number;
  curl: number;
  /** At a bound, how far a hind foot lies back from standing on its toes. */
  hock: number;
}

const paw = (): Paw => ({ at: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), planted: true, swing: 0, begun: 0, lift: 0, curl: 0, hock: 1 });

export type GaitKind = 'walk' | 'trot' | 'bound' | 'climb';

type Four = readonly [number, number, number, number];
const four = (x: number): Four => [x, x, x, x];

/**
 * When in the cycle each paw comes down (front left, front right, hind left, hind right), the share of it each spends
 * down, and where in it to set off from standing: the moment that leaves no paw standing under it carried too far back.
 */
const PATTERN: Record<GaitKind, { down: Four; duty: Four; setOff?: number }> = {
  /** Hind, fore on the same side, then the other side: the cat's own walk. */
  walk: { down: [0.75, 0.25, 0, 0.5], duty: four(0.64), setOff: 0.35 },
  trot: { down: [0, 0.5, 0.5, 0], duty: four(0.5), setOff: 0.2 },
  bound: { down: BOUND_DOWN, duty: BOUND_DUTY, setOff: BOUND_SET_OFF },
  /** Up a wall: both front paws reach together, then both hind paws push. */
  climb: { down: [0.5, 0.45, 0, 0.95], duty: four(0.5) },
};

/**
 * Distance the body travels in one cycle at a given speed: longer strides as it goes faster, not only a faster patter,
 * but never so long that a paw down at the end of its stance is out of reach of its leg.
 */
export function strideAt(kind: GaitKind, speed: number): number {
  if (kind === 'walk') return 0.125 + 0.078 * speed;
  if (kind === 'trot') return 0.155 + 0.078 * speed;
  if (kind === 'bound') return 0.3 + 0.19 * speed;
  return 0.175 + 0.065 * speed;
}

export interface Support {
  origin: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  /** Moves a point onto the surface under it, along `up`. */
  snap: (p: THREE.Vector3) => void;
}

/**
 * Walking as paws, not as a cycle: each paw is put down somewhere and stays exactly there until it is picked up,
 * and the body is carried over it. The cycle is advanced by distance travelled, never by the clock, so a paw never
 * slides whatever speed the story asks for.
 */
export class CatGait {
  readonly paws: [Paw, Paw, Paw, Paw] = [paw(), paw(), paw(), paw()];
  phase = 0;
  kind: GaitKind = 'walk';
  /** Paws that came down this frame, for the sound of them. */
  readonly landed: number[] = [];
  /** 0 standing to 1 at full stretch, eased, for the body to lean and bob with. */
  pace = 0;
  speed = 0;
  /** How big the cat is: its strides are as long as its legs. */
  scale = 1;
  /** Fear, 0..1: at a bound it keeps lower and reaches longer. */
  low = 0;
  private readonly prev = new THREE.Vector3();
  private yawWas = 0;
  private fresh = true;
  private idle = 0;
  private wasStepping = false;
  private kindWas: GaitKind = 'walk';
  private readonly side = new THREE.Vector3();
  private readonly home = new THREE.Vector3();
  private readonly step = new THREE.Vector3();

  /** Every paw at home under it, nothing carried over from wherever it was before. */
  reset(s: Support, homes: readonly THREE.Vector2[]): void {
    this.side.crossVectors(s.up, s.forward).normalize();
    for (const [i, p] of this.paws.entries()) {
      this.placeHome(s, homes[i], p.at);
      this.settle(p);
    }
    this.prev.copy(s.origin);
    this.fresh = false;
  }

  /** Every paw down where it already is, as after a landing: any out of place are then walked home one at a time. */
  plantAt(s: Support, at: readonly THREE.Vector3[], yaw: number): void {
    for (const [i, p] of this.paws.entries()) {
      p.at.copy(at[i]);
      s.snap(p.at);
      this.settle(p);
    }
    this.prev.copy(s.origin);
    this.yawWas = yaw;
    this.fresh = false;
    this.wasStepping = false;
    this.idle = 0;
    this.speed = 0;
  }

  /** Forget the last position, so the next update starts with every paw at home. */
  release(): void {
    this.fresh = true;
  }

  get stepping(): boolean {
    return this.wasStepping;
  }

  /** True while every paw is down. */
  get still(): boolean {
    return this.paws.every((p) => p.planted);
  }

  private settle(p: Paw): void {
    p.planted = true;
    p.lift = 0;
    p.swing = 0;
    p.curl = 0;
  }

  private placeHome(s: Support, home: THREE.Vector2, out: THREE.Vector3): THREE.Vector3 {
    out.copy(s.origin).addScaledVector(this.side, home.x).addScaledVector(s.forward, home.y);
    s.snap(out);
    return out;
  }

  update(dt: number, s: Support, yaw: number, homes: readonly THREE.Vector2[], lift: number): void {
    this.landed.length = 0;
    if (this.fresh) {
      this.reset(s, homes);
      this.yawWas = yaw;
    }
    if (dt <= 0) return;
    this.side.crossVectors(s.up, s.forward).normalize();
    const moved = this.step.copy(s.origin).sub(this.prev).length();
    const turned = Math.abs(Math.atan2(Math.sin(yaw - this.yawWas), Math.cos(yaw - this.yawWas)));
    this.yawWas = yaw;
    this.prev.copy(s.origin);
    this.speed = moved / dt;
    const bound = this.kind === 'bound';
    const stride = strideAt(this.kind, this.speed / this.scale) * this.scale * (bound ? 1 + 0.12 * this.low : 1);
    this.pace += (Math.min(1, this.speed / 3) - this.pace) * (1 - Math.exp(-dt * 6));
    /** Turning on the spot takes steps too: each paw has to go round the body. */
    const travel = moved + turned * 0.12;
    const stepping = this.speed > 0.03 || turned > dt * 0.3;
    const { down, duty, setOff } = PATTERN[this.kind];
    const cycle = (i: number) => (((this.phase - down[i]) % 1) + 1) % 1;
    if (setOff !== undefined && stepping && !this.wasStepping && this.still) this.phase = setOff;
    if (stepping) {
      this.phase = (this.phase + travel / stride) % 1;
      this.idle = 0;
    } else this.idle += dt;
    if ((!this.wasStepping && stepping) || this.kind !== this.kindWas) {
      /** Setting off, or changing gait, with a paw in the air: it carries on from where it is rather than from where it left. */
      for (const [i, p] of this.paws.entries()) {
        if (p.planted) continue;
        p.from.copy(p.at).addScaledVector(s.up, -p.lift);
        p.begun = Math.min(cycle(i), 0.98);
      }
    }
    if (this.wasStepping && !stepping) {
      /** A paw caught in the air when it stops is taken the rest of the way home from where it is. */
      for (const p of this.paws) {
        if (p.planted) continue;
        p.from.copy(p.at).addScaledVector(s.up, -p.lift);
        p.swing = 0;
      }
    }
    this.wasStepping = stepping;
    this.kindWas = this.kind;

    for (const [i, p] of this.paws.entries()) {
      const home = this.placeHome(s, homes[i], this.home);
      if (stepping) {
        const mine = cycle(i);
        const swinging = mine >= duty[i];
        if (bound) p.hock = boundHock(mine, duty[i]);
        if (swinging && p.planted) {
          p.planted = false;
          p.from.copy(p.at);
          p.begun = Math.min(mine, 0.98);
        }
        if (swinging) {
          p.swing = Math.max(0, (mine - p.begun) / (1 - p.begun));
          /** Aimed where the body will be when it lands, so it comes down as far ahead of its home as it will leave behind it. */
          const ahead = (moved / Math.max(travel, 1e-6)) * ((1 - p.swing) * (1 - duty[i]) * stride + duty[i] * stride * 0.5);
          p.to.copy(home).addScaledVector(s.forward, ahead + (bound ? BOUND_SHIFT[i] * this.scale : 0));
          s.snap(p.to);
          if (bound) this.reachFor(i, p, s, homes[i].x);
          else {
            const k = p.swing * p.swing * (3 - 2 * p.swing);
            p.at.lerpVectors(p.from, p.to, k);
            p.lift = Math.sin(p.swing * Math.PI) * lift;
            p.curl = Math.sin(Math.min(1, p.swing * 1.4) * Math.PI);
            p.at.addScaledVector(s.up, p.lift);
          }
        } else if (!p.planted) this.plant(p, i, s);
      } else if (p.planted && p.at.distanceTo(home) > 0.03 * this.scale && this.othersDown(i) && (this.idle > 0.08 || p.at.distanceTo(home) > 0.07 * this.scale)) {
        /** Standing, a paw left out of place is put back under it, one at a time; one left well out straight away. */
        p.planted = false;
        p.from.copy(p.at);
        p.swing = 0;
      } else if (!p.planted) {
        p.swing = Math.min(1, p.swing + dt / 0.2);
        const k = p.swing * p.swing * (3 - 2 * p.swing);
        p.at.lerpVectors(p.from, home, k);
        p.lift = Math.sin(p.swing * Math.PI) * Math.min(0.03, lift + 0.012);
        p.curl = Math.sin(p.swing * Math.PI) * 0.7;
        p.at.addScaledVector(s.up, p.lift);
        if (p.swing >= 1) this.plant(p, i, s);
      }
    }
  }

  private readonly keys = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly tangents = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly first: number[] = [0, 0];
  private readonly second: number[] = [0, 0];

  /**
   * A paw in the air at a bound goes where the body carries it rather than along the ground: one smooth sweep from
   * where it left the roof, through the two reaches the bound asks of it as the body is now, to where it will land.
   */
  private reachFor(i: number, p: Paw, s: Support, across: number): void {
    const [t1, t2] = boundReach(i, this.phase, this.low, this.first, this.second);
    const k = this.scale;
    const [from, a, b, to] = this.keys;
    from.copy(p.from);
    to.copy(p.to);
    for (const [key, [along, up]] of [[a, this.first], [b, this.second]] as const) {
      key.copy(s.origin).addScaledVector(this.side, across).addScaledVector(s.forward, along * k).addScaledVector(s.up, up * k);
    }
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
    p.lift = 0;
    p.curl = i < 2 ? 1.3 * Math.sin(Math.PI * Math.min(1, p.swing / 0.55)) : 0.9 * Math.sin(Math.PI * p.swing);
  }

  private plant(p: Paw, i: number, s: Support): void {
    p.at.addScaledVector(s.up, -p.lift);
    s.snap(p.at);
    this.settle(p);
    this.landed.push(i);
  }

  private othersDown(i: number): boolean {
    return this.paws.every((p, j) => j === i || p.planted);
  }
}

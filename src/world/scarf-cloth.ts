import * as THREE from 'three';
import type { WindField } from '../wind/field';
import { tuning } from '../tuning';

export interface ClothCapsule { a: THREE.Vector3; b: THREE.Vector3; radius: number }
interface Link { a: number; b: number; rest: number; compliance: number; alpha: number; lambda: number }
const H = 1 / 120;
const PERMANENT = 1, SUPPORT = 2;

/** Two connected edges of wool. The detailed knitted surface is drawn over this small physical mesh. */
export class ScarfCloth {
  readonly positions: THREE.Vector3[] = [];
  private readonly previous: THREE.Vector3[] = [];
  private readonly home: THREE.Vector3[] = [];
  private readonly weights: number[] = [];
  private readonly floors: number[] = [];
  private readonly links: Link[] = [];
  private readonly supports = new Set<number>();
  private readonly permanent = new Set<number>();
  private readonly pins: Uint8Array;
  private readonly supportRows: number[] = [];
  private readonly pullWeights: Float64Array;
  private readonly lengths: number[] = [0];
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly side = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private accumulator = 0;
  private released = false;
  private releaseRequested = false;
  private slipTime = 0;
  private work = 0;
  private slide = 0;
  private lift = 0;
  private capsuleList: ClothCapsule[] = [];
  /** Per capsule: endpoint bounds in x and z, then its axis and squared length. */
  private capsuleShape = new Float64Array(0);
  private supportRail: { a: THREE.Vector3; b: THREE.Vector3 } | null = null;

  setSupportRail(a: THREE.Vector3, b: THREE.Vector3): void { this.supportRail = { a, b }; }

  get capsules(): ClothCapsule[] { return this.capsuleList; }
  set capsules(list: ClothCapsule[]) {
    this.capsuleList = list;
    this.capsuleShape = new Float64Array(list.length * 8);
    list.forEach(({ a, b }, c) => {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      this.capsuleShape.set([Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z),
        dx, dy, dz, dx * dx + dy * dy + dz * dz], c * 8);
    });
  }

  get length(): number { return this.lengths[this.lengths.length - 1]; }

  constructor(points: THREE.Vector3[], width: number, supports: number[], permanent: number[],
    private readonly floor: (x: number, z: number) => number) {
    for (let i = 0; i < points.length; i++) {
      if (i) this.lengths.push(this.lengths[i - 1] + points[i].distanceTo(points[i - 1]));
      this.tangent.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(0, i - 1)]).normalize();
      this.side.set(-this.tangent.z, 0, this.tangent.x).normalize();
      if (this.side.lengthSq() < .1) this.side.set(1, 0, 0);
      this.side.applyAxisAngle(this.tangent, Math.sin(this.lengths[i] * .23) * .65);
      for (const sign of [-1, 1]) {
        const p = points[i].clone().addScaledVector(this.side, sign * width * .5);
        this.positions.push(p); this.previous.push(p.clone()); this.home.push(p.clone()); this.weights.push(1); this.floors.push(0);
      }
      if (supports.includes(i)) { this.supports.add(i * 2); this.supports.add(i * 2 + 1); }
      if (permanent.includes(i)) { this.permanent.add(i * 2); this.permanent.add(i * 2 + 1); }
    }
    const add = (a: number, b: number, compliance: number, rest = this.positions[a].distanceTo(this.positions[b])) => {
      this.links.push({ a, b, rest, compliance, alpha: compliance / (H * H), lambda: 0 });
    };
    for (let row = 0; row < points.length; row++) {
      add(row * 2, row * 2 + 1, .000001);
      if (row + 1 < points.length) {
        for (let edge = 0; edge < 2; edge++) {
          add(row * 2 + edge, (row + 1) * 2 + edge, .0000001);
          add(row * 2 + edge, (row + 1) * 2 + 1 - edge, .000004);
        }
      }
      if (row + 2 < points.length) for (let edge = 0; edge < 2; edge++) {
        // Wool resists sharp folds, but has no spring pulling it back into the authored knot.
        const a = row * 2 + edge, b = (row + 2) * 2 + edge;
        const rest = this.positions[a].distanceTo(this.positions[a + 2]) + this.positions[a + 2].distanceTo(this.positions[b]);
        add(a, b, tuning.birches.scarf.clothBend, rest * .97);
      }
    }
    this.pins = Uint8Array.from(this.positions, (_, i) => (this.permanent.has(i) ? PERMANENT : 0) | (this.supports.has(i) ? SUPPORT : 0));
    for (const pin of this.supports) if (!this.supportRows.includes(pin >> 1)) this.supportRows.push(pin >> 1);
    this.pullWeights = Float64Array.from({ length: this.positions.length * this.supportRows.length }, (_, k) => {
      const d = this.lengths[Math.floor(k / this.supportRows.length) >> 1] - this.lengths[this.supportRows[k % this.supportRows.length]];
      return Math.exp(-d * d / 12);
    });
  }

  setPull(work: number, lift: number): void { this.work = work; this.lift = lift; }

  release(): void {
    this.releaseRequested = true;
    if (!this.supportRail) this.released = true;
  }

  reset(released = false): void {
    this.releaseRequested = released;
    this.released = released && !this.supportRail;
    this.slipTime = 0;
    this.work = this.slide = released ? 1 : 0; this.lift = 0; this.accumulator = 0;
    this.positions.forEach((p, i) => { p.copy(this.home[i]); this.previous[i].copy(p); });
  }

  update(dt: number, wind?: WindField): void {
    this.accumulator += Math.min(dt, .06);
    while (this.accumulator >= H - 1e-8) { this.step(H, wind); this.accumulator -= H; }
  }

  private step(h: number, wind?: WindField): void {
    const k = tuning.birches.scarf;
    const drag = Math.exp(-k.clothDrag * h);
    this.slide += (this.work - this.slide) * (1 - Math.exp(-h * k.clothSlideResponse));
    if (this.releaseRequested && !this.released && this.slide > .985) this.slipTime += h;
    if (this.releaseRequested && !this.released && this.slipTime >= k.clothSlipSeconds) {
      this.released = true;
      const rail = this.supportRail!;
      this.tangent.subVectors(rail.b, rail.a).normalize();
      for (let i = 0; i < this.positions.length; i++) {
        let weight = 0;
        for (const pin of this.supports) {
          const distance = this.lengths[i >> 1] - this.lengths[pin >> 1];
          weight = Math.max(weight, Math.exp(-distance * distance / 4));
        }
        this.previous[i].addScaledVector(this.tangent, -k.clothSlipSpeed * h * weight);
      }
    }
    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i], old = this.previous[i], home = this.home[i];
      const pins = this.pins[i];
      const pinned = (pins & PERMANENT) !== 0 || (!this.released && (pins & SUPPORT) !== 0);
      this.weights[i] = pinned ? 0 : 1;
      if (pinned) {
        old.copy(p); p.copy(home);
        if (!(pins & PERMANENT) && this.supportRail) {
          const row = i & ~1;
          this.side.subVectors(this.home[row + 1], this.home[row]).multiplyScalar(i % 2 ? .5 : -.5);
          p.lerpVectors(this.supportRail.a, this.supportRail.b, this.slide).add(this.side);
          p.y += .19;
          if (this.slipTime > 0) {
            // Carry the loop beyond the finite tip, then down its OUTSIDE before relinquishing it.
            // Merely removing the pins at the tip lets gravity put it straight back on the branch.
            const t = Math.min(1, this.slipTime / k.clothSlipSeconds);
            const out = THREE.MathUtils.smootherstep(t / .65, 0, 1);
            const down = THREE.MathUtils.smootherstep((t - .45) / .55, 0, 1);
            this.tangent.subVectors(this.supportRail.b, this.supportRail.a).setY(0).normalize();
            p.addScaledVector(this.tangent, out * k.clothSlipReach);
            p.y += Math.sin(out * Math.PI) * .3 - down * k.clothSlipDrop;
          }
        }
        continue;
      }
      const w = wind?.sample(p.x, p.z, this.air);
      const vx = (p.x - old.x) * drag, vy = (p.y - old.y) * drag, vz = (p.z - old.z) * drag;
      old.copy(p);
      let pull = 0;
      if (!this.released) for (let r = 0, rows = this.supportRows.length; r < rows; r++) {
        pull = Math.max(pull, this.pullWeights[i * rows + r] * this.lift * k.clothLift);
      }
      p.x += vx + THREE.MathUtils.clamp((w?.x ?? 0) * k.clothWind, -8, 8) * h * h;
      p.y += vy + (-k.clothGravity + (w?.lift ?? 0) * .5 + pull) * h * h;
      p.z += vz + THREE.MathUtils.clamp((w?.z ?? 0) * k.clothWind, -8, 8) * h * h;
    }
    for (const link of this.links) link.lambda = 0;
    for (let iteration = 0; iteration < k.clothIterations; iteration++) {
      // Alternating the solve direction carries tension along the whole strip without a preferred end.
      const reverse = iteration % 2 === 1;
      for (let j = 0; j < this.links.length; j++) {
        const link = this.links[reverse ? this.links.length - 1 - j : j];
        const a = this.positions[link.a], b = this.positions[link.b];
        const wa = this.weights[link.a], wb = this.weights[link.b];
        if (wa + wb === 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const length = Math.hypot(dx, dy, dz);
        if (length < .000001) continue;
        const change = (-(length - link.rest) - link.alpha * link.lambda) / (wa + wb + link.alpha);
        link.lambda += change;
        const amount = change / length;
        a.x -= dx * amount * wa; a.y -= dy * amount * wa; a.z -= dz * amount * wa;
        b.x += dx * amount * wb; b.y += dy * amount * wb; b.z += dz * amount * wb;
      }
      this.collide(iteration === k.clothIterations - 1, iteration === 0 || iteration === k.clothIterations - 1);
    }
  }

  private collide(friction: boolean, refreshFloor: boolean): void {
    const margin = tuning.birches.scarf.clothClearance;
    for (let i = 0; i < this.positions.length; i++) {
      if (!this.weights[i]) continue;
      const p = this.positions[i], old = this.previous[i];
      for (let c = 0; c < this.capsuleList.length; c++) {
        const a = this.capsuleList[c].a, shape = this.capsuleShape, o = c * 8;
        const radius = this.capsuleList[c].radius + margin;
        if (p.x < shape[o] - radius || p.x > shape[o + 1] + radius
          || p.z < shape[o + 2] - radius || p.z > shape[o + 3] + radius) continue;
        const dx = shape[o + 4], dy = shape[o + 5], dz = shape[o + 6];
        const t = THREE.MathUtils.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / shape[o + 7], 0, 1);
        const x = p.x - a.x - t * dx, y = p.y - a.y - t * dy, z = p.z - a.z - t * dz;
        const distance = Math.hypot(x, y, z);
        if (distance < radius && distance > .00001) {
          const amount = radius / distance - 1;
          p.x += x * amount; p.y += y * amount; p.z += z * amount;
        }
      }
      if (refreshFloor) this.floors[i] = this.floor(p.x, p.z) + margin;
      const floor = this.floors[i];
      if (p.y < floor) {
        p.y = floor;
        if (friction) {
          old.x = p.x - (p.x - old.x) * .75;
          old.z = p.z - (p.z - old.z) * .75;
          old.y = p.y;
        }
      }
    }
  }

  /** Sample by material distance: the render mesh keeps its yarn and tassels attached to the moving cloth. */
  sample(distance: number, center: THREE.Vector3, across?: THREE.Vector3): void {
    let lo = 0, hi = this.lengths.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.lengths[mid] < distance) lo = mid; else hi = mid; }
    const t = THREE.MathUtils.clamp((distance - this.lengths[lo]) / Math.max(.0001, this.lengths[hi] - this.lengths[lo]), 0, 1);
    const a = this.positions[lo * 2], b = this.positions[lo * 2 + 1];
    const c = this.positions[hi * 2], d = this.positions[hi * 2 + 1];
    center.set((a.x + b.x) * (1 - t) * .5 + (c.x + d.x) * t * .5,
      (a.y + b.y) * (1 - t) * .5 + (c.y + d.y) * t * .5,
      (a.z + b.z) * (1 - t) * .5 + (c.z + d.z) * t * .5);
    if (across) across.set((b.x - a.x) * (1 - t) + (d.x - c.x) * t,
      (b.y - a.y) * (1 - t) + (d.y - c.y) * t, (b.z - a.z) * (1 - t) + (d.z - c.z) * t).normalize();
  }

  report(): { stretch: number; speed: number; penetration: number } {
    let stretch = 1, speed = 0, penetration = 0;
    for (const link of this.links) if (link.compliance < .000001) {
      stretch = Math.max(stretch, this.positions[link.a].distanceTo(this.positions[link.b]) / link.rest);
    }
    this.positions.forEach((p, i) => {
      speed = Math.max(speed, p.distanceTo(this.previous[i]) * 120);
      penetration = Math.max(penetration, this.floor(p.x, p.z) - p.y);
    });
    return { stretch, speed, penetration };
  }
}

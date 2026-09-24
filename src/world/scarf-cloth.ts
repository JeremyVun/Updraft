import * as THREE from 'three';
import type { WindField } from '../wind/field';
import { tuning } from '../tuning';

export interface ClothCapsule { a: THREE.Vector3; b: THREE.Vector3; radius: number }
const H = 1 / 120;
const PERMANENT = 1, SUPPORT = 2;

/** Two connected edges of wool. The detailed knitted surface is drawn over this small physical mesh. */
export class ScarfCloth {
  /** Read-only copies of the solver's particles, refreshed after every update. */
  readonly positions: THREE.Vector3[] = [];
  private readonly previous: THREE.Vector3[] = [];
  private readonly home: THREE.Vector3[] = [];
  private readonly pos: Float64Array;
  private readonly prev: Float64Array;
  private readonly velocity: Float64Array;
  private readonly shared: Float64Array;
  /** Pinned particles, and each particle's greatest material distance from each of them. */
  private readonly anchors: Int32Array;
  private readonly reach: Float64Array;
  private readonly weights: Float64Array;
  private readonly floors: Float64Array;
  private readonly linkA: Int32Array;
  private readonly linkB: Int32Array;
  private readonly rest: Float64Array;
  private readonly compliance: Float64Array;
  private readonly alpha: Float64Array;
  private readonly lambda: Float64Array;
  private readonly supports = new Set<number>();
  private readonly permanent = new Set<number>();
  private readonly pins: Uint8Array;
  private readonly supportRows: number[] = [];
  private readonly pullWeights: Float64Array;
  private readonly lengths: number[] = [0];
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly side = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
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
  /** Which capsules each ground cell could touch, in capsule order, for the clearance the grid was built with. */
  private grid = { margin: NaN, x: 0, z: 0, cell: 1, width: 0, depth: 0, start: new Int32Array(1), items: new Int32Array(0) };
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
    this.grid.margin = NaN;
  }

  get length(): number { return this.lengths[this.lengths.length - 1]; }

  /** `across`, when given, is the direction the width already lies in at each point, so taking over shows no turn. */
  constructor(points: THREE.Vector3[], width: number, supports: number[], permanent: number[],
    private readonly floor: (x: number, z: number) => number, across?: THREE.Vector3[]) {
    for (let i = 0; i < points.length; i++) {
      if (i) this.lengths.push(this.lengths[i - 1] + points[i].distanceTo(points[i - 1]));
      this.tangent.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(0, i - 1)]).normalize();
      if (across) this.side.copy(across[i]).addScaledVector(this.tangent, -across[i].dot(this.tangent)).normalize();
      else {
        this.side.set(-this.tangent.z, 0, this.tangent.x).normalize();
        if (this.side.lengthSq() < .1) this.side.set(1, 0, 0);
        this.side.applyAxisAngle(this.tangent, Math.sin(this.lengths[i] * .23) * .65);
      }
      for (const sign of [-1, 1]) {
        const p = points[i].clone().addScaledVector(this.side, sign * width * .5);
        this.positions.push(p); this.previous.push(p.clone()); this.home.push(p.clone());
      }
      if (supports.includes(i)) { this.supports.add(i * 2); this.supports.add(i * 2 + 1); }
      if (permanent.includes(i)) { this.permanent.add(i * 2); this.permanent.add(i * 2 + 1); }
    }
    const count = this.positions.length;
    this.pos = new Float64Array(count * 3); this.prev = new Float64Array(count * 3);
    this.velocity = new Float64Array(count * 3); this.shared = new Float64Array(count * 3);
    this.weights = new Float64Array(count).fill(1); this.floors = new Float64Array(count);
    this.positions.forEach((p, i) => { p.toArray(this.pos, i * 3); p.toArray(this.prev, i * 3); });
    const links: { a: number; b: number; rest: number; compliance: number }[] = [];
    const add = (a: number, b: number, compliance: number, rest = this.positions[a].distanceTo(this.positions[b])) => {
      links.push({ a, b, rest, compliance });
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
    this.linkA = Int32Array.from(links, l => l.a); this.linkB = Int32Array.from(links, l => l.b);
    this.rest = Float64Array.from(links, l => l.rest); this.compliance = Float64Array.from(links, l => l.compliance);
    this.alpha = Float64Array.from(links, l => l.compliance / (H * H)); this.lambda = new Float64Array(links.length);
    this.pins = Uint8Array.from(this.positions, (_, i) => (this.permanent.has(i) ? PERMANENT : 0) | (this.supports.has(i) ? SUPPORT : 0));
    for (const pin of this.supports) if (!this.supportRows.includes(pin >> 1)) this.supportRows.push(pin >> 1);
    this.anchors = Int32Array.from([...this.permanent, ...this.supports]);
    const edge = this.positions.map((p, i) => i < 2 ? 0 : p.distanceTo(this.positions[i - 2]));
    for (let i = 2; i < count; i++) edge[i] += edge[i - 2];
    // The yarn path along the stitch's own edge, then across: never shorter than the real one.
    this.reach = Float64Array.from({ length: count * this.anchors.length }, (_, k) => {
      const i = Math.floor(k / this.anchors.length), a = this.anchors[k % this.anchors.length];
      const along = Math.abs(edge[i] - edge[(a & ~1) | (i & 1)]);
      return along + ((i & 1) === (a & 1) ? 0 : this.positions[a].distanceTo(this.positions[a ^ 1]));
    });
    this.pullWeights = Float64Array.from({ length: count * this.supportRows.length }, (_, k) => {
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
    this.home.forEach((p, i) => { p.toArray(this.pos, i * 3); p.toArray(this.prev, i * 3); });
    this.publish();
  }

  update(dt: number, wind?: WindField): void {
    this.accumulator += Math.min(dt, .06);
    while (this.accumulator >= H - 1e-8) { this.step(H, wind); this.accumulator -= H; }
    this.publish();
  }

  private publish(): void {
    this.positions.forEach((p, i) => { p.fromArray(this.pos, i * 3); this.previous[i].fromArray(this.prev, i * 3); });
  }

  private step(h: number, wind?: WindField): void {
    const k = tuning.birches.scarf;
    const { pos, prev } = this;
    this.slide += (this.work - this.slide) * (1 - Math.exp(-h * k.clothSlideResponse));
    if (this.releaseRequested && !this.released && this.slide > .985) this.slipTime += h;
    if (this.releaseRequested && !this.released && this.slipTime >= k.clothSlipSeconds) {
      this.released = true;
      const rail = this.supportRail!;
      this.tangent.subVectors(rail.b, rail.a).normalize();
      for (let i = 0; i < this.home.length; i++) {
        let weight = 0;
        for (const pin of this.supports) {
          const distance = this.lengths[i >> 1] - this.lengths[pin >> 1];
          weight = Math.max(weight, Math.exp(-distance * distance / 4));
        }
        const shift = -k.clothSlipSpeed * h * weight;
        prev[i * 3] += this.tangent.x * shift; prev[i * 3 + 1] += this.tangent.y * shift; prev[i * 3 + 2] += this.tangent.z * shift;
      }
    }
    const count = this.home.length, rows = count >> 1;
    const { velocity, shared, floors } = this;
    for (let i = 0; i < count * 3; i++) velocity[i] = pos[i] - prev[i];
    // Wool's internal friction: each stitch shares its motion with its neighbours, so a length swings as one piece
    // instead of wriggling.
    const share = 1 - Math.exp(-k.clothViscosity * h);
    for (let i = 0; i < count; i++) {
      const o = i * 3, partner = (i ^ 1) * 3, before = i > 1 ? o - 6 : partner, after = i < count - 2 ? o + 6 : partner;
      for (let c = 0; c < 3; c++) {
        const mean = (velocity[partner + c] + velocity[before + c] + velocity[after + c]) / 3;
        shared[o + c] = velocity[o + c] + (mean - velocity[o + c]) * share;
      }
    }
    const drag = Math.exp(-k.clothDrag * h);
    for (let row = 0; row < rows; row++) {
      const a = row * 6, b = a + 3;
      const lo = Math.max(0, row - 1) * 6, hi = Math.min(rows - 1, row + 1) * 6;
      const tx = pos[hi] + pos[hi + 3] - pos[lo] - pos[lo + 3], ty = pos[hi + 1] + pos[hi + 4] - pos[lo + 1] - pos[lo + 4];
      const tz = pos[hi + 2] + pos[hi + 5] - pos[lo + 2] - pos[lo + 5];
      const sx = pos[b] - pos[a], sy = pos[b + 1] - pos[a + 1], sz = pos[b + 2] - pos[a + 2];
      let nx = ty * sz - tz * sy, ny = tz * sx - tx * sz, nz = tx * sy - ty * sx;
      const n = Math.hypot(nx, ny, nz);
      if (n > 1e-9) { nx /= n; ny /= n; nz /= n; }
      for (let i = row * 2; i < row * 2 + 2; i++) {
        const o = i * 3, pins = this.pins[i];
        const pinned = (pins & PERMANENT) !== 0 || (!this.released && (pins & SUPPORT) !== 0);
        this.weights[i] = pinned ? 0 : 1;
        if (pinned) {
          prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
          const p = this.point.copy(this.home[i]);
          if (!(pins & PERMANENT) && this.supportRail) {
            const pair = i & ~1;
            this.side.subVectors(this.home[pair + 1], this.home[pair]).multiplyScalar(i % 2 ? .5 : -.5);
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
          p.toArray(pos, o);
          continue;
        }
        const x = pos[o], y = pos[o + 1], z = pos[o + 2];
        const vx = shared[o] * drag, vy = shared[o + 1] * drag, vz = shared[o + 2] * drag;
        prev[o] = x; prev[o + 1] = y; prev[o + 2] = z;
        let pull = 0;
        if (!this.released) for (let r = 0, supports = this.supportRows.length; r < supports; r++) {
          pull = Math.max(pull, this.pullWeights[i * supports + r] * this.lift * k.clothLift);
        }
        // Air pushes on the face of the wool and barely on its edge; the litter shelters what lies on the ground.
        const w = wind?.sample(x, z, this.air);
        const shelter = THREE.MathUtils.smoothstep(y - floors[i], 0, k.clothShelter);
        const rx = (w ? w.x * shelter : 0) - vx / h, ry = (w ? w.lift * k.clothUpdraft * shelter : 0) - vy / h;
        const rz = (w ? w.z * shelter : 0) - vz / h, face = rx * nx + ry * ny + rz * nz;
        const ax = THREE.MathUtils.clamp(face * nx * k.clothFace + (rx - face * nx) * k.clothEdge, -8, 8);
        const ay = THREE.MathUtils.clamp(face * ny * k.clothFace + (ry - face * ny) * k.clothEdge, -8, 8);
        const az = THREE.MathUtils.clamp(face * nz * k.clothFace + (rz - face * nz) * k.clothEdge, -8, 8);
        pos[o] = x + vx + ax * h * h;
        pos[o + 1] = y + vy + (ay - k.clothGravity + pull) * h * h;
        pos[o + 2] = z + vz + az * h * h;
      }
    }
    const { linkA, linkB, rest, alpha, lambda, weights } = this, links = linkA.length;
    lambda.fill(0);
    for (let iteration = 0; iteration < k.clothIterations; iteration++) {
      // Alternating the solve direction carries tension along the whole strip without a preferred end.
      const reverse = iteration % 2 === 1;
      for (let j = 0; j < links; j++) {
        const l = reverse ? links - 1 - j : j;
        const wa = weights[linkA[l]], wb = weights[linkB[l]];
        if (wa + wb === 0) continue;
        const a = linkA[l] * 3, b = linkB[l] * 3;
        const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const length = Math.hypot(dx, dy, dz);
        if (length < .000001) continue;
        const change = (-(length - rest[l]) - alpha[l] * lambda[l]) / (wa + wb + alpha[l]);
        lambda[l] += change;
        const amount = change / length;
        pos[a] -= dx * amount * wa; pos[a + 1] -= dy * amount * wa; pos[a + 2] -= dz * amount * wa;
        pos[b] += dx * amount * wb; pos[b + 1] += dy * amount * wb; pos[b + 2] += dz * amount * wb;
      }
      const last = iteration === k.clothIterations - 1;
      if (last) this.tether();
      this.collide(last, iteration === 0 || last);
    }
  }

  /** Knitted wool gives a little, never like elastic: nothing may lie further from a held point than the yarn between them. */
  private tether(): void {
    const { pos, anchors, reach, weights } = this, count = anchors.length, slack = tuning.birches.scarf.clothGive;
    for (let n = 0; n < count; n++) {
      const a = anchors[n];
      if (weights[a]) continue;
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
      for (let i = 0; i < this.home.length; i++) {
        if (!weights[i]) continue;
        const o = i * 3, dx = pos[o] - ax, dy = pos[o + 1] - ay, dz = pos[o + 2] - az;
        const limit = reach[i * count + n] * slack, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 <= limit * limit) continue;
        const scale = limit / Math.sqrt(d2);
        pos[o] = ax + dx * scale; pos[o + 1] = ay + dy * scale; pos[o + 2] = az + dz * scale;
      }
    }
  }

  /** Cells cover each capsule's full test box, so a particle only meets the capsules its own cell lists. */
  private buildGrid(margin: number): void {
    const shape = this.capsuleShape, count = this.capsuleList.length;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let c = 0; c < count; c++) {
      const radius = this.capsuleList[c].radius + margin;
      minX = Math.min(minX, shape[c * 8] - radius); maxX = Math.max(maxX, shape[c * 8 + 1] + radius);
      minZ = Math.min(minZ, shape[c * 8 + 2] - radius); maxZ = Math.max(maxZ, shape[c * 8 + 3] + radius);
    }
    const cell = Math.max(1, (maxX - minX) / 128, (maxZ - minZ) / 128);
    const width = count ? Math.floor((maxX - minX) / cell) + 1 : 0, depth = count ? Math.floor((maxZ - minZ) / cell) + 1 : 0;
    const lists: number[][] = Array.from({ length: width * depth }, () => []);
    for (let c = 0; c < count; c++) {
      const radius = this.capsuleList[c].radius + margin;
      const x0 = Math.floor((shape[c * 8] - radius - minX) / cell), x1 = Math.floor((shape[c * 8 + 1] + radius - minX) / cell);
      const z0 = Math.floor((shape[c * 8 + 2] - radius - minZ) / cell), z1 = Math.floor((shape[c * 8 + 3] + radius - minZ) / cell);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) lists[z * width + x].push(c);
    }
    const start = new Int32Array(lists.length + 1);
    lists.forEach((list, i) => { start[i + 1] = start[i] + list.length; });
    this.grid = { margin, x: minX, z: minZ, cell, width, depth, start, items: Int32Array.from(lists.flat()) };
  }

  /** Push a particle out of one capsule. True if it was inside and moved. */
  private push(o: number, c: number, margin: number): boolean {
    const pos = this.pos, shape = this.capsuleShape, s = c * 8, capsule = this.capsuleList[c], a = capsule.a;
    const radius = capsule.radius + margin;
    if (pos[o] < shape[s] - radius || pos[o] > shape[s + 1] + radius
      || pos[o + 2] < shape[s + 2] - radius || pos[o + 2] > shape[s + 3] + radius) return false;
    const dx = shape[s + 4], dy = shape[s + 5], dz = shape[s + 6];
    const t = THREE.MathUtils.clamp(((pos[o] - a.x) * dx + (pos[o + 1] - a.y) * dy + (pos[o + 2] - a.z) * dz) / shape[s + 7], 0, 1);
    const x = pos[o] - a.x - t * dx, y = pos[o + 1] - a.y - t * dy, z = pos[o + 2] - a.z - t * dz;
    // Clearly outside: the margin dwarfs any rounding in the exact distance, which only nearer points need.
    if (x * x + y * y + z * z > radius * radius * 1.000001) return false;
    const distance = Math.hypot(x, y, z);
    if (distance < radius && distance > .00001) {
      const amount = radius / distance - 1;
      pos[o] += x * amount; pos[o + 1] += y * amount; pos[o + 2] += z * amount;
      return true;
    }
    return false;
  }

  private collide(friction: boolean, refreshFloor: boolean): void {
    const k = tuning.birches.scarf, margin = k.clothClearance, stick = k.clothStick * H, slide = k.clothSlide;
    if (margin !== this.grid.margin) this.buildGrid(margin);
    const { pos, prev, grid } = this, count = this.capsuleList.length;
    for (let i = 0; i < this.home.length; i++) {
      if (!this.weights[i]) continue;
      const o = i * 3;
      const x = Math.floor((pos[o] - grid.x) / grid.cell), z = Math.floor((pos[o + 2] - grid.z) / grid.cell);
      if (x >= 0 && z >= 0 && x < grid.width && z < grid.depth) {
        const cell = z * grid.width + x;
        for (let e = grid.start[cell]; e < grid.start[cell + 1]; e++) {
          // Once pushed, the particle may have left its cell, so every later capsule is tested as before.
          if (this.push(o, grid.items[e], margin)) {
            for (let c = grid.items[e] + 1; c < count; c++) this.push(o, c, margin);
            break;
          }
        }
      }
      if (refreshFloor) this.floors[i] = this.floor(pos[o], pos[o + 2]) + margin;
      const floor = this.floors[i];
      if (pos[o + 1] < floor) {
        pos[o + 1] = floor;
        if (friction) {
          // Wool on leaf litter holds where it lies: slow pulls do not move it, and a dragged length soon stops.
          const dx = pos[o] - prev[o], dz = pos[o + 2] - prev[o + 2];
          if (dx * dx + dz * dz < stick * stick) { pos[o] = prev[o]; pos[o + 2] = prev[o + 2]; }
          else { prev[o] = pos[o] - dx * slide; prev[o + 2] = pos[o + 2] - dz * slide; }
          prev[o + 1] = pos[o + 1];
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
    for (let l = 0; l < this.linkA.length; l++) if (this.compliance[l] < .000001) {
      stretch = Math.max(stretch, this.positions[this.linkA[l]].distanceTo(this.positions[this.linkB[l]]) / this.rest[l]);
    }
    this.positions.forEach((p, i) => {
      speed = Math.max(speed, p.distanceTo(this.previous[i]) * 120);
      penetration = Math.max(penetration, this.floor(p.x, p.z) - p.y);
    });
    return { stretch, speed, penetration };
  }
}

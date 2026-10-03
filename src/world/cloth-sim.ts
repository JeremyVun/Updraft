/** Air through the cloth in metres a second, turning at `spin` radians a second about the upright through `cx`, `cz`. */
export interface ClothAir { x: number; y: number; z: number; spin: number; cx: number; cz: number }

/**
 * A sheet of cloth as a grid of particles held together by distance constraints, stepped on the CPU (position
 * based, after Jakobsen). It is for the few pieces of washing that must really fall, swing, lie on the grass and
 * catch on things; everything that only flutters on its pegs stays in the cloth shader.
 */
export class Cloth {
  readonly count: number;
  readonly pos: Float32Array;
  /** Where the cloth is drawn: between the last two steps, at the frame's moment, with its normals. */
  readonly view: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array;
  readonly index: Uint16Array;
  /** 0 holds a particle at its `pin`, 1 leaves it free. */
  readonly free: Float32Array;
  readonly pin: Float32Array;
  private readonly prev: Float32Array;
  private readonly last: Float32Array;
  private readonly face: Float32Array;
  private readonly cons: Uint16Array;
  private readonly rest: Float32Array;
  private readonly stiff: Float32Array;
  private readonly squash: Float32Array;
  /** Long-range tethers: no particle may be further from a pinned one than the cloth between them allows. */
  private tethers: Int32Array = new Int32Array(0);
  private tetherRest: Float32Array = new Float32Array(0);

  /** `bend` is how hard the cloth resists folding over two particles' span, so it folds broadly, not at every one. */
  constructor(readonly cols: number, readonly rows: number, readonly width: number, readonly drop: number, bend = 0.06) {
    const n = cols * rows;
    this.count = n;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.last = new Float32Array(n * 3);
    this.view = new Float32Array(n * 3);
    this.normal = new Float32Array(n * 3);
    this.face = new Float32Array(n * 3);
    this.uv = new Float32Array(n * 2);
    this.free = new Float32Array(n).fill(1);
    this.pin = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.uv[i * 2] = (i % cols) / (cols - 1);
      // The pegged edge is uv.y 1 and the hem 0, as in the cloth shader.
      this.uv[i * 2 + 1] = 1 - Math.floor(i / cols) / (rows - 1);
    }
    const index: number[] = [];
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      index.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
    }
    this.index = new Uint16Array(index);
    const pairs: number[] = [];
    const stiff: number[] = [];
    const squash: number[] = [];
    // Cloth resists stretching but gives under compression, so it folds instead of standing like a board, and a
    // fold, once made, does not spring back open.
    const link = (a: number, b: number, k: number, give: number) => { pairs.push(a, b); stiff.push(k); squash.push(give); };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) link(i, i + 1, 1, 0.25);
      if (r + 1 < rows) link(i, i + cols, 1, 0.25);
      if (c + 1 < cols && r + 1 < rows) { link(i, i + cols + 1, 0.5, 0.25); link(i + 1, i + cols, 0.5, 0.25); }
      if (c + 2 < cols) link(i, i + 2, bend, 0.25);
      if (r + 2 < rows) link(i, i + cols * 2, bend, 0.25);
    }
    this.cons = new Uint16Array(pairs);
    this.stiff = new Float32Array(stiff);
    this.squash = new Float32Array(squash);
    this.rest = new Float32Array(stiff.length);
    for (let k = 0; k < stiff.length; k++) this.rest[k] = this.flatDistance(pairs[k * 2], pairs[k * 2 + 1]);
  }

  /** Distance between two particles across the cloth laid flat. */
  flatDistance(a: number, b: number): number {
    const du = ((a % this.cols) - (b % this.cols)) / (this.cols - 1) * this.width;
    const dv = (Math.floor(a / this.cols) - Math.floor(b / this.cols)) / (this.rows - 1) * this.drop;
    return Math.sqrt(du * du + dv * dv);
  }

  place(i: number, x: number, y: number, z: number): void {
    this.pos[i * 3] = this.prev[i * 3] = this.last[i * 3] = x;
    this.pos[i * 3 + 1] = this.prev[i * 3 + 1] = this.last[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = this.prev[i * 3 + 2] = this.last[i * 3 + 2] = z;
  }

  /** Velocity of a particle over the last step, in metres a second. */
  velocity(i: number, h: number, out: { x: number; y: number; z: number }): void {
    out.x = (this.pos[i * 3] - this.prev[i * 3]) / h;
    out.y = (this.pos[i * 3 + 1] - this.prev[i * 3 + 1]) / h;
    out.z = (this.pos[i * 3 + 2] - this.prev[i * 3 + 2]) / h;
  }

  /** Draw it `alpha` of the way from the step before the last to the last, so it moves as smoothly as the frames. */
  blend(alpha: number): void {
    const { pos, last, view } = this;
    for (let k = 0; k < view.length; k++) view[k] = last[k] + (pos[k] - last[k]) * alpha;
    this.normals(view, this.normal);
  }

  /** Nudge a particle's velocity, in metres a second, for the next step `h` long. */
  kick(i: number, vx: number, vy: number, vz: number, h: number): void {
    this.prev[i * 3] -= vx * h;
    this.prev[i * 3 + 1] -= vy * h;
    this.prev[i * 3 + 2] -= vz * h;
  }

  hold(i: number, x: number, y: number, z: number): void {
    this.free[i] = 0;
    this.pin[i * 3] = x; this.pin[i * 3 + 1] = y; this.pin[i * 3 + 2] = z;
  }

  /** Call after changing which particles are held. */
  retether(): void {
    const held: number[] = [];
    for (let i = 0; i < this.count; i++) if (!this.free[i]) held.push(i);
    const pairs: number[] = [];
    const rest: number[] = [];
    // The nearest few holds are enough to stop it stretching, and far cheaper than all of them.
    for (let i = 0; i < this.count; i++) {
      if (!this.free[i]) continue;
      const near = held.map(j => [j, this.flatDistance(i, j)]).sort((a, b) => a[1] - b[1]).slice(0, 4);
      for (const [j, d] of near) { pairs.push(i, j); rest.push(d); }
    }
    this.tethers = new Int32Array(pairs);
    this.tetherRest = new Float32Array(rest);
  }

  /** Mean speed of the free particles over the last step, in metres a second. */
  motion(h: number): number {
    let sum = 0, n = 0;
    for (let i = 0; i < this.count; i++) {
      if (!this.free[i]) continue;
      const k = i * 3;
      sum += Math.sqrt((this.pos[k] - this.prev[k]) ** 2 + (this.pos[k + 1] - this.prev[k + 1]) ** 2 + (this.pos[k + 2] - this.prev[k + 2]) ** 2);
      n++;
    }
    return n ? sum / n / h : 0;
  }

  /**
   * One step `h` long. `air` is the wind through the cloth (x, y, z in metres a second), `drag` how hard it pushes
   * on the cloth across its face, and `gust(i)` lets each particle feel it a little differently. `ground(x, z)` is
   * the height the cloth comes to rest on; `posts` are upright poles it cannot pass through, as x, z, radius, top.
   * `follow` is how quickly, every second, the air brings the cloth to its own speed whichever way the cloth faces.
   */
  step(h: number, air: ClothAir, drag: number, damping: number, iterations: number,
    gust: (i: number) => number, ground: (x: number, z: number) => number, posts: readonly number[], follow = 0): void {
    const { pos, prev, free, pin } = this;
    const normal = this.face;
    this.last.set(pos);
    this.normals(pos, normal);
    const keep = Math.exp(-damping * h);
    const along = drag * 0.08 + follow;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      if (!free[i]) continue;
      const vx = (pos[k] - prev[k]) / h, vy = (pos[k + 1] - prev[k + 1]) / h, vz = (pos[k + 2] - prev[k + 2]) / h;
      const g = gust(i);
      const rx = (air.x + air.spin * (pos[k + 2] - air.cz)) * g - vx, ry = air.y * g - vy;
      const rz = (air.z - air.spin * (pos[k] - air.cx)) * g - vz;
      const nx = normal[k], ny = normal[k + 1], nz = normal[k + 2];
      const across = nx * rx + ny * ry + nz * rz;
      // Pressure on the face goes with the square of the air through it; a little skin friction along it.
      const push = drag * across * Math.abs(across);
      let ax = nx * push + rx * along, ay = ny * push + ry * along - 9.8, az = nz * push + rz * along;
      const a = Math.sqrt(ax * ax + ay * ay + az * az);
      if (a > 60) { ax *= 60 / a; ay *= 60 / a; az *= 60 / a; }
      const x = pos[k], y = pos[k + 1], z = pos[k + 2];
      pos[k] += (x - prev[k]) * keep + ax * h * h;
      pos[k + 1] += (y - prev[k + 1]) * keep + ay * h * h;
      pos[k + 2] += (z - prev[k + 2]) * keep + az * h * h;
      prev[k] = x; prev[k + 1] = y; prev[k + 2] = z;
    }
    for (let i = 0; i < this.count; i++) if (!free[i]) {
      const k = i * 3;
      prev[k] = pos[k]; prev[k + 1] = pos[k + 1]; prev[k + 2] = pos[k + 2];
      pos[k] = pin[k]; pos[k + 1] = pin[k + 1]; pos[k + 2] = pin[k + 2];
    }
    const { cons, rest, stiff, squash } = this;
    for (let it = 0; it < iterations; it++) {
      for (let c = 0; c < stiff.length; c++) {
        const a = cons[c * 2], b = cons[c * 2 + 1];
        const wa = free[a], wb = free[b];
        const w = wa + wb;
        if (w === 0) continue;
        const ka = a * 3, kb = b * 3;
        const dx = pos[kb] - pos[ka], dy = pos[kb + 1] - pos[ka + 1], dz = pos[kb + 2] - pos[ka + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const s = (d - rest[c]) / d * stiff[c] * (d < rest[c] ? squash[c] : 1) / w;
        pos[ka] += dx * s * wa; pos[ka + 1] += dy * s * wa; pos[ka + 2] += dz * s * wa;
        pos[kb] -= dx * s * wb; pos[kb + 1] -= dy * s * wb; pos[kb + 2] -= dz * s * wb;
      }
    }
    const { tethers, tetherRest } = this;
    for (let t = 0; t < tetherRest.length; t++) {
      const ka = tethers[t * 2] * 3, kb = tethers[t * 2 + 1] * 3;
      const dx = pos[ka] - pos[kb], dy = pos[ka + 1] - pos[kb + 1], dz = pos[ka + 2] - pos[kb + 2];
      const dd = dx * dx + dy * dy + dz * dz;
      if (dd <= tetherRest[t] * tetherRest[t]) continue;
      const d = Math.sqrt(dd);
      const s = tetherRest[t] / d;
      pos[ka] = pos[kb] + dx * s; pos[ka + 1] = pos[kb + 1] + dy * s; pos[ka + 2] = pos[kb + 2] + dz * s;
    }
    for (let i = 0; i < this.count; i++) {
      if (!free[i]) continue;
      const k = i * 3;
      for (let p = 0; p < posts.length; p += 4) {
        if (pos[k + 1] > posts[p + 3]) continue;
        const dx = pos[k] - posts[p], dz = pos[k + 2] - posts[p + 1];
        const dd = dx * dx + dz * dz;
        if (dd >= posts[p + 2] * posts[p + 2] || dd < 1e-12) continue;
        const d = Math.sqrt(dd);
        pos[k] = posts[p] + dx / d * posts[p + 2];
        pos[k + 2] = posts[p + 1] + dz / d * posts[p + 2];
      }
      const floor = ground(pos[k], pos[k + 2]);
      if (pos[k + 1] < floor) {
        pos[k + 1] = floor;
        // Grass slows the cloth that lies on it, though what hangs above can still drag it along.
        prev[k] += (pos[k] - prev[k]) * 0.02;
        prev[k + 2] += (pos[k + 2] - prev[k + 2]) * 0.02;
        if (prev[k + 1] < floor) prev[k + 1] = floor;
      }
    }
  }

  normals(pos: Float32Array, normal: Float32Array): void {
    const { cols, rows } = this;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const l = (c > 0 ? i - 1 : i) * 3, rr = (c < cols - 1 ? i + 1 : i) * 3;
      const u = (r > 0 ? i - cols : i) * 3, d = (r < rows - 1 ? i + cols : i) * 3;
      const ax = pos[rr] - pos[l], ay = pos[rr + 1] - pos[l + 1], az = pos[rr + 2] - pos[l + 2];
      const bx = pos[d] - pos[u], by = pos[d + 1] - pos[u + 1], bz = pos[d + 2] - pos[u + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;
      normal[i * 3] = nx; normal[i * 3 + 1] = ny; normal[i * 3 + 2] = nz;
    }
  }
}

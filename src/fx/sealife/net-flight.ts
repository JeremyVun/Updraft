import * as THREE from 'three';

/** The air moving at `p`, `t` seconds after the cloth was let go (m/s). */
export type Air = (p: THREE.Vector3, t: number, out: THREE.Vector3) => THREE.Vector3;
/** The height of anything solid under (x, z) it may come down on besides the water, or -Infinity. */
export type Ground = (x: number, z: number) => number;

export interface FlightFeel {
  /** How strongly air through its face carries it, and air along it drags it (1/s). */
  catch: number;
  skim: number;
  /** How hard it is drawn down (m/s²). */
  fall: number;
  /** Where the water lies under it (m), and how quickly the water stills a point that has come down on it (1/s). */
  water: number;
  wetDrag: number;
  /** How quickly the air lets go of it once it is on the water (1/s). */
  soak: number;
}

/** Pulled toward its rest length this hard each pass: along and across, diagonally, and two apart. */
const STIFF = [1, 0.5, 0.12];
const PASSES = 10;
const STEP = 1 / 120;
const MOST_STEPS = 8;
const START_SPEED = 4;
/** How far over solid ground a point keeps, and how much of its way along the ground each step keeps (m, share). */
const GROUND_GAP = 0.2;
const GROUND_SLIP = 0.9;

/**
 * A patch of net let go to the air as cloth: a grid of points, each joined to its neighbours along and across it,
 * diagonally and two apart, so it billows and folds but barely stretches. The air pushes on it through its face and
 * drags along it, so it catches a rising breath like a sail, slides edge first when it turns side on and tumbles as it
 * comes down. A point that reaches the water lies on it and is stilled there.
 */
export class ClothFlight {
  readonly points: Float32Array;
  /** How far each point has come down on the water, 0..1. */
  readonly wet: Float32Array;
  private readonly floor: Float32Array;
  /** Seconds since it was let go, and when it first came down on the water. */
  time = 0;
  private touched = Infinity;
  private readonly before: Float32Array;
  private readonly normals: Float32Array;
  private readonly links: Int32Array;
  private readonly lengths: Float32Array;
  private readonly stiffness: Float32Array;
  private left = 0;
  private readonly p = new THREE.Vector3();
  private readonly w = new THREE.Vector3();

  /** `rows` by `cols` points, laid out row by row, whose rest lengths are measured from `rest` (x, y, z each). */
  constructor(readonly rows: number, readonly cols: number, rest: Float32Array) {
    const n = rows * cols;
    this.points = new Float32Array(n * 3);
    this.before = new Float32Array(n * 3);
    this.normals = new Float32Array(n * 3);
    this.wet = new Float32Array(n);
    this.floor = new Float32Array(n).fill(-Infinity);
    const links: number[] = [], kinds: number[] = [];
    const join = (a: number, b: number, kind: number) => { links.push(a, b); kinds.push(kind); };
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const k = i * cols + j;
        if (j + 1 < cols) join(k, k + 1, 0);
        if (i + 1 < rows) join(k, k + cols, 0);
        if (i + 1 < rows && j + 1 < cols) { join(k, k + cols + 1, 1); join(k + 1, k + cols, 1); }
        if (j + 2 < cols) join(k, k + 2, 2);
        if (i + 2 < rows) join(k, k + 2 * cols, 2);
      }
    }
    this.links = Int32Array.from(links);
    this.lengths = new Float32Array(kinds.length);
    this.stiffness = Float32Array.from(kinds, (kind) => STIFF[kind]);
    const apart = (ka: number, kb: number) => {
      const a = ka * 3, b = kb * 3;
      return Math.hypot(rest[a] - rest[b], rest[a + 1] - rest[b + 1], rest[a + 2] - rest[b + 2]);
    };
    // Two apart it rests flat, however it lay over the skin.
    for (let l = 0; l < kinds.length; l++) {
      const a = links[l * 2], b = links[l * 2 + 1], mid = (a + b) / 2;
      this.lengths[l] = kinds[l] === 2 ? apart(a, mid) + apart(mid, b) : apart(a, b);
    }
  }

  /** Let go from `now`, moving as it moved from `last` over `dt` seconds. */
  start(now: Float32Array, last: Float32Array, dt: number): void {
    this.points.set(now);
    // Carried on at the speed it had, which a hover never makes more than a few metres a second.
    const keep = dt > 0 ? STEP / Math.max(dt, STEP) : 0, most = START_SPEED * STEP;
    for (let i = 0; i < now.length; i++) this.before[i] = now[i] - THREE.MathUtils.clamp((now[i] - last[i]) * keep, -most, most);
    this.wet.fill(0);
    this.time = 0;
    this.touched = Infinity;
    this.left = 0;
  }

  /**
   * It has lain soaking on the water `after` seconds with all of it down below `low`, or `latest` seconds whatever:
   * afloat from here.
   */
  settled(after: number, low: number, latest: number): boolean {
    const lain = this.time - this.touched;
    if (lain < after) return false;
    if (lain < latest) for (let k = 0; k < this.wet.length; k++) if (this.points[k * 3 + 1] > low) return false;
    this.wet.fill(1);
    return true;
  }

  /** Its middle, the mean of its points. */
  centre(out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    const P = this.points, n = this.wet.length;
    for (let k = 0; k < n; k++) out.x += P[k * 3], out.y += P[k * 3 + 1], out.z += P[k * 3 + 2];
    return out.multiplyScalar(1 / n);
  }

  update(dt: number, air: Air, feel: FlightFeel, ground?: Ground): void {
    if (ground) for (let k = 0; k < this.floor.length; k++) this.floor[k] = ground(this.points[k * 3], this.points[k * 3 + 2]) + GROUND_GAP;
    this.left = Math.min(this.left + dt, STEP * MOST_STEPS);
    while (this.left >= STEP) {
      this.left -= STEP;
      this.time += STEP;
      this.move(air, feel);
      for (let pass = 0; pass < PASSES; pass++) this.hold();
      this.land(feel);
    }
  }

  private move(air: Air, feel: FlightFeel): void {
    const P = this.points, B = this.before, N = this.normals, h = STEP, h2 = h * h;
    this.faces();
    // Once it is on the water it soaks and lies heavy, and the air lets go of it.
    const soaked = Math.exp(-Math.max(0, this.time - this.touched) * feel.soak);
    for (let k = 0; k < this.wet.length; k++) {
      const i = k * 3;
      const vx = (P[i] - B[i]) / h, vy = (P[i + 1] - B[i + 1]) / h, vz = (P[i + 2] - B[i + 2]) / h;
      air(this.p.set(P[i], P[i + 1], P[i + 2]), this.time, this.w);
      const rx = this.w.x - vx, ry = this.w.y - vy, rz = this.w.z - vz;
      const through = (rx * N[i] + ry * N[i + 1] + rz * N[i + 2]) * feel.catch;
      const dry = (1 - this.wet[k]) * soaked;
      const ax = (N[i] * through + rx * feel.skim) * dry;
      const ay = (N[i + 1] * through + ry * feel.skim) * dry - feel.fall;
      const az = (N[i + 2] * through + rz * feel.skim) * dry;
      const still = P[i + 1] <= feel.water + 1e-3 ? Math.exp(-feel.wetDrag * h) : 1;
      for (let c = 0; c < 3; c++) {
        const x = P[i + c];
        P[i + c] = x + (x - B[i + c]) * still + (c === 0 ? ax : c === 1 ? ay : az) * h2;
        B[i + c] = x;
      }
    }
  }

  /** Each point's facing, across its neighbours along and across the grid. */
  private faces(): void {
    const P = this.points, N = this.normals, { rows, cols } = this;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const k = (i * cols + j) * 3;
        const a = (Math.min(rows - 1, i + 1) * cols + j) * 3, b = (Math.max(0, i - 1) * cols + j) * 3;
        const c = (i * cols + Math.min(cols - 1, j + 1)) * 3, d = (i * cols + Math.max(0, j - 1)) * 3;
        const px = P[a] - P[b], py = P[a + 1] - P[b + 1], pz = P[a + 2] - P[b + 2];
        const qx = P[c] - P[d], qy = P[c + 1] - P[d + 1], qz = P[c + 2] - P[d + 2];
        const x = py * qz - pz * qy, y = pz * qx - px * qz, z = px * qy - py * qx;
        const inverse = 1 / (Math.hypot(x, y, z) || 1);
        N[k] = x * inverse; N[k + 1] = y * inverse; N[k + 2] = z * inverse;
      }
    }
  }

  private hold(): void {
    const P = this.points, L = this.links, W = this.wet;
    for (let l = 0; l < this.lengths.length; l++) {
      const ka = L[l * 2], kb = L[l * 2 + 1], a = ka * 3, b = kb * 3;
      const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
      const length = Math.hypot(dx, dy, dz) || 1e-6;
      // A point lying on the water is held there more than one still in the air.
      const wa = 1 - 0.8 * W[ka], wb = 1 - 0.8 * W[kb], share = wa + wb;
      if (share < 1e-6) continue;
      const pull = ((length - this.lengths[l]) / length) * this.stiffness[l] / share;
      P[a] += dx * pull * wa; P[a + 1] += dy * pull * wa; P[a + 2] += dz * pull * wa;
      P[b] -= dx * pull * wb; P[b + 1] -= dy * pull * wb; P[b + 2] -= dz * pull * wb;
    }
  }

  private land(feel: FlightFeel): void {
    const P = this.points, B = this.before;
    for (let k = 0; k < this.wet.length; k++) {
      const i = k * 3;
      if (P[i + 1] < this.floor[k]) {
        P[i + 1] = B[i + 1] = this.floor[k];
        B[i] = P[i] - (P[i] - B[i]) * GROUND_SLIP;
        B[i + 2] = P[i + 2] - (P[i + 2] - B[i + 2]) * GROUND_SLIP;
      }
      if (P[i + 1] > feel.water) continue;
      P[i + 1] = B[i + 1] = feel.water;
      this.touched = Math.min(this.touched, this.time);
      this.wet[k] = Math.min(1, this.wet[k] + STEP * 2);
    }
  }
}

import * as THREE from 'three';

/**
 * A line down the middle of the flights and landings for the bird to walk along. Sent straight at somewhere up a
 * stair it cuts the corners and fetches up outside the rails, so instead it is always sent to a point a little
 * ahead of itself along this line, toward where it is going.
 */
export class Track {
  private readonly along: number[] = [0];
  private readonly tmp = new THREE.Vector3();

  constructor(readonly points: readonly THREE.Vector3[]) {
    for (let i = 1; i < points.length; i++) this.along.push(this.along[i - 1] + points[i].distanceTo(points[i - 1]));
  }

  /** How far along the line its `i`th point is. */
  to(i: number): number {
    return this.along[i];
  }

  get length(): number {
    return this.along[this.along.length - 1];
  }

  /** How far along the line the nearest point to `p` is; height counts, so flights one over another are told apart. */
  project(p: THREE.Vector3): number {
    let best = 0, near = Infinity;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1], b = this.points[i];
      const ab = this.tmp.subVectors(b, a);
      const len2 = Math.max(ab.lengthSq(), 1e-6);
      const t = THREE.MathUtils.clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / len2, 0, 1);
      const dx = a.x + ab.x * t - p.x, dy = (a.y + ab.y * t - p.y) * 0.6, dz = a.z + ab.z * t - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < near) { near = d; best = this.along[i - 1] + Math.sqrt(len2) * t; }
    }
    return best;
  }

  /** The point `s` metres along the line. */
  at(s: number, out = new THREE.Vector3()): THREE.Vector3 {
    const k = THREE.MathUtils.clamp(s, 0, this.length);
    let i = 1;
    while (i < this.along.length - 1 && this.along[i] < k) i++;
    const a = this.points[i - 1], b = this.points[i];
    const span = this.along[i] - this.along[i - 1];
    return out.lerpVectors(a, b, span > 1e-6 ? (k - this.along[i - 1]) / span : 0);
  }

  /**
   * Where to send a walker at `from` so that it goes along the line toward `to`, and how far it still has to go.
   * Round a turn a point a little way on along the line can be very near the walker; it is sent further on, so
   * that it never counts itself there and stops at the corner.
   */
  lead(from: THREE.Vector3, to: number, out: THREE.Vector3, reach = 0.9): number {
    const s = this.project(from);
    const left = Math.abs(to - s), way = Math.sign(to - s);
    let step = Math.min(left, 0.8);
    this.at(s + way * step, out);
    while (step < left && Math.hypot(out.x - from.x, out.z - from.z) < reach) {
      step = Math.min(left, step + 0.2);
      this.at(s + way * step, out);
    }
    return left;
  }
}

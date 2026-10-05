import * as THREE from 'three';

const before = new THREE.Vector3();

/** A way through a list of points as one smooth curve, measured along its length, for a body to be carried along. */
export class Route {
  private readonly points: THREE.Vector3[] = [];
  private readonly lengths: number[] = [];
  readonly length: number;

  constructor(through: readonly THREE.Vector3[], spacing = 0.03) {
    const kept = through.filter((p, i) => i === 0 || p.distanceTo(through[i - 1]) > 1e-3);
    if (kept.length === 1) kept.push(kept[0].clone().add(new THREE.Vector3(0, 0, 1e-3)));
    const curve = kept.length === 2 ? new THREE.LineCurve3(kept[0], kept[1]) : new THREE.CatmullRomCurve3(kept, false, 'centripetal');
    const n = Math.max(2, Math.ceil(curve.getLength() / spacing));
    this.points = curve.getSpacedPoints(n);
    let total = 0;
    this.lengths.push(0);
    for (let i = 1; i < this.points.length; i++) {
      total += this.points[i].distanceTo(this.points[i - 1]);
      this.lengths.push(total);
    }
    this.length = total;
  }

  private find(s: number): [number, number] {
    const at = THREE.MathUtils.clamp(s, 0, this.length);
    let lo = 0;
    let hi = this.lengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.lengths[mid] <= at) lo = mid;
      else hi = mid;
    }
    const span = this.lengths[hi] - this.lengths[lo];
    return [lo, span > 0 ? (at - this.lengths[lo]) / span : 0];
  }

  at(s: number, out: THREE.Vector3): THREE.Vector3 {
    const [i, t] = this.find(s);
    return out.lerpVectors(this.points[i], this.points[i + 1], t);
  }

  /** The way along it at `s`, averaged over a little of it either side so a corner turns rather than snaps. */
  tangent(s: number, out: THREE.Vector3, over = 0.06): THREE.Vector3 {
    this.at(Math.max(0, s - over), before);
    return this.at(Math.min(this.length, s + over), out).sub(before).normalize();
  }
}

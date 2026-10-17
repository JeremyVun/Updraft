import * as THREE from 'three';

/**
 * The shape each answer's guide is traced along, one per phrase: a sweep to the right, a sweep back to the left,
 * an arc and a wave. `t` runs from where the trace starts to where it ends; `x` is across, −1 to 1, and `y` up, in
 * the same units. `tilt` raises the straight sweeps' far end with the answer's melody.
 */
export function guideShape(phrase: number, t: number, tilt: number, out: THREE.Vector2): THREE.Vector2 {
  switch (phrase % 4) {
    case 0: return out.set(-1 + 2 * t, (t - 0.5) * 0.2 * tilt);
    case 1: return out.set(1 - 2 * t, (t - 0.5) * 0.2 * tilt);
    case 2: return out.set(-1 + 2 * t, Math.sin(t * Math.PI) * 0.45);
    default: return out.set(1 - 2 * t, Math.sin(t * Math.PI * 2) * 0.22);
  }
}

const SAMPLES = 48;
/** How far beyond what has been traced a finger may be and still count: following, not jumping to the end. */
const REACH = 0.3;
/** The finger's way between frames is followed in steps this short (screen heights), so speed changes nothing. */
const STEP = 0.008;

/** A forgiving trace along the visible guide; distances are measured in screen heights. */
export class PianoStroke {
  /** How much of the guide has been traced, from its start. */
  progress = 0;
  /** Where along the guide the finger was a moment ago, while it is on it: only moving on along it traces. */
  private last = -1;
  private readonly points = Array.from({ length: SAMPLES + 1 }, () => new THREE.Vector2());
  private readonly at = new THREE.Vector2();
  private readonly segment = new THREE.Vector2();
  private readonly offset = new THREE.Vector2();

  reset(): void { this.progress = 0; this.last = -1; }

  /** Where the guide lies on screen now, as `place(t, out)` gives it. */
  lay(place: (t: number, out: THREE.Vector2) => THREE.Vector2): void {
    this.points.forEach((p, i) => place(i / SAMPLES, p));
  }

  /** The pointer moved from `from` to `to`: whatever of the guide it passed close by is traced. */
  follow(from: THREE.Vector2, to: THREE.Vector2, tolerance: number): number {
    const steps = Math.max(1, Math.ceil(from.distanceTo(to) / STEP));
    for (let i = 1; i <= steps; i++) {
      this.at.lerpVectors(from, to, i / steps);
      this.nearest(this.at, tolerance);
    }
    return this.progress;
  }

  private nearest(p: THREE.Vector2, tolerance: number): void {
    let best = -1, closest = tolerance;
    const last = Math.min(SAMPLES, Math.ceil((this.progress + REACH) * SAMPLES));
    for (let i = 0; i < last; i++) {
      const a = this.points[i];
      this.segment.subVectors(this.points[i + 1], a);
      const k = THREE.MathUtils.clamp(this.offset.subVectors(p, a).dot(this.segment) / Math.max(1e-9, this.segment.lengthSq()), 0, 1);
      const distance = this.offset.sub(this.segment.multiplyScalar(k)).length();
      if (distance <= closest) { closest = distance; best = (i + k) / SAMPLES; }
    }
    if (best > this.progress && best - this.progress <= REACH && this.last >= 0 && best > this.last) this.progress = best;
    this.last = best;
  }
}

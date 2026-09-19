import * as THREE from 'three';
import { tuning } from '../tuning';
import { RibbonBatch, type Ribbon } from './ribbons';

export type SweepKind = 'across' | 'lift' | 'outward';
const POINTS = 48;
const STRANDS = [
  { delay: 0, length: 1, width: 1, alpha: 1, offset: 0 },
  { delay: 0.1, length: 0.68, width: 0.6, alpha: 0.62, offset: 1 },
  { delay: 0.19, length: 0.45, width: 0.42, alpha: 0.38, offset: -0.7 },
];

/** Keep an invitation readable without enlarging it into a solid band near the camera. */
export function windPen(camera: THREE.Camera, at: THREE.Vector3, width: number): number {
  const k = tuning.invitation;
  const depth = Math.max(0.1, -(at.x * camera.matrixWorldInverse.elements[2]
    + at.y * camera.matrixWorldInverse.elements[6] + at.z * camera.matrixWorldInverse.elements[10]
    + camera.matrixWorldInverse.elements[14]));
  const pixel = 2 * depth / (camera.projectionMatrix.elements[5] * Math.max(1, window.innerHeight));
  return THREE.MathUtils.clamp(width, pixel * k.minPixels, pixel * k.maxPixels);
}

/** One gust crosses the useful target, its unequal wakes curling apart as it leaves. Drawing only. */
export class WindGesture {
  readonly batch = new RibbonBatch(POINTS * STRANDS.length * 2, '#fff4dd', 1, false, tuning.invitation.lightFloor);
  readonly strokes: Ribbon[] = Array.from({ length: STRANDS.length * 2 }, () => ({
    points: Array.from({ length: POINTS }, () => new THREE.Vector3()), alpha: 0, width: 0,
  }));
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();

  constructor(name: string) { this.batch.mesh.name = name; this.hide(); }
  hide(): void { this.batch.mesh.visible = false; }

  draw(camera: THREE.Camera, at: THREE.Vector3, phase: number, span: number, alpha: number,
    width: number, kind: SweepKind = 'across', direction = 1): void {
    this.hide();
    const fade = THREE.MathUtils.smoothstep(phase, 0, 0.12)
      * (1 - THREE.MathUtils.smoothstep(phase, 0.82, 1.22));
    if (alpha * fade < 0.002) return;
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    this.toward.setFromMatrixColumn(camera.matrixWorld, 2);
    const pen = windPen(camera, at, width);
    const k = tuning.invitation;
    const depth = this.projected.copy(at).applyMatrix4(camera.matrixWorldInverse).z;
    this.projected.copy(at).project(camera);
    const edge = 1 - k.screenMargin - Math.abs(kind === 'lift' ? this.projected.y : this.projected.x);
    if (edge <= 0 || depth >= 0) return;
    // Let departing air dissolve inside the frame, including a sail close to a phone's edge.
    span = Math.min(span, -depth / camera.projectionMatrix.elements[kind === 'lift' ? 5 : 0] * edge);
    for (let j = 0; j < this.strokes.length; j++) {
      const r = this.strokes[j], s = STRANDS[j % STRANDS.length];
      const side = j < STRANDS.length ? direction : -direction;
      r.alpha = j >= STRANDS.length && kind !== 'outward' ? 0 : alpha * fade * s.alpha;
      r.width = pen * s.width;
      if (!r.alpha) continue;
      const head = phase * 1.22 - s.delay;
      if (head <= 0) { r.alpha = 0; continue; }
      const length = Math.min(head, k.tail * s.length);
      r.alpha *= THREE.MathUtils.smoothstep(head, 0, 0.1);
      for (let i = 0; i < POINTS; i++) {
        const tail = i / (POINTS - 1);
        const t = head - tail * length;
        // The leading end is clean. The older air bows, then peels away into a loose curl.
        const old = tail * tail;
        const peel = THREE.MathUtils.smoothstep(phase, 0.48, 1.15) * old;
        const arc = t * Math.PI * 1.5 + s.offset * 0.6;
        let along = (t - 0.5) * span;
        let across = Math.sin(t * Math.PI * 2) * span * 0.035
          + s.offset * span * k.spread * (0.35 + old)
          + Math.sin(arc + tail * 3.8) * span * k.curl * peel;
        along += Math.cos(arc + tail * 3.8) * span * k.curl * peel;
        if (kind === 'outward') along = t * span * 0.55;
        const x = kind === 'lift' ? across : along * side;
        const y = kind === 'lift' ? along : across;
        r.points[i].copy(at).addScaledVector(this.right, x).addScaledVector(this.up, y)
          .addScaledVector(this.toward, 0.15 + Math.sin(t * Math.PI) * span * 0.035 + peel * span * 0.06);
      }
    }
    this.batch.mesh.visible = true;
    this.batch.update(this.strokes);
  }
}

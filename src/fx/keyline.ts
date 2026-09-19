import * as THREE from 'three';
import { tuning } from '../tuning';
import { RibbonBatch, type Ribbon } from './ribbons';
import { windPen } from './wind-gesture';

const POINTS = 49;
/** A path that stays while listening, with air repeatedly demonstrating its direction. */
export class KeyLine {
  readonly batch = new RibbonBatch(POINTS * 4, '#fff4dd', 1, false, tuning.invitation.lightFloor);
  private readonly ribbon: Ribbon = { points: Array.from({ length: POINTS }, () => new THREE.Vector3()), alpha: 0, width: 0 };
  private readonly sweep: Ribbon = { points: Array.from({ length: POINTS }, () => new THREE.Vector3()), alpha: 0, width: 0 };
  private readonly answer: Ribbon = { points: Array.from({ length: POINTS }, () => new THREE.Vector3()), alpha: 0, width: 0 };
  private readonly centre = new THREE.Vector3();
  private readonly start = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly marker: Ribbon = { points: Array.from({ length: POINTS }, () => new THREE.Vector3()), alpha: 0, width: 0 };
  private shown = 0;
  private since = 0;
  private direction = 0;

  update(dt: number, time: number, along: (t: number, out: THREE.Vector3) => THREE.Vector3,
    camera: THREE.Camera, direction: number, progress: number): void {
    if (direction !== this.direction) { this.since = time; this.direction = direction; }
    this.shown += ((direction ? 1 : 0) - this.shown) * (1 - Math.exp(-dt * 5));
    this.batch.mesh.visible = this.shown > 0.005;
    if (!this.batch.mesh.visible) return;
    const t = tuning.piano;
    const phase = ((time - this.since) % t.guideCycle) / t.guideSweep;
    const head = Math.min(1, phase);
    const pen = windPen(camera, along(0.5, this.centre), t.linePen);
    this.ribbon.alpha = this.shown * 0.65;
    this.ribbon.width = pen * 0.45;
    this.sweep.alpha = this.shown * (1 - THREE.MathUtils.smoothstep(phase, 1, 1.3));
    this.sweep.width = pen;
    this.answer.alpha = this.shown * (progress > 0 ? 0.95 : 0);
    this.answer.width = pen * 0.8;
    along(direction < 0 ? 1 : 0, this.start);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    this.marker.alpha = this.shown * (progress < 0.05 ? 0.75 + Math.sin(time * 3) * 0.15 : 0);
    this.marker.width = pen * 0.45;
    for (let i = 0; i < POINTS; i++) {
      const f = i / (POINTS - 1);
      along(f, this.ribbon.points[i]);
      const demonstration = Math.max(0, head - (1 - f) * 0.28);
      along(direction < 0 ? 1 - demonstration : demonstration, this.sweep.points[i]);
      along(direction < 0 ? 1 - f * progress : f * progress, this.answer.points[i]);
      this.marker.points[i].copy(this.start)
        .addScaledVector(this.right, Math.cos(f * Math.PI * 2) * pen * 1.8)
        .addScaledVector(this.up, Math.sin(f * Math.PI * 2) * pen * 1.8);
    }
    this.batch.update([this.ribbon, this.sweep, this.answer, this.marker]);
  }
}

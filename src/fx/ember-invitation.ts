import * as THREE from 'three';
import { tuning } from '../tuning';
import { RibbonBatch, type Ribbon } from './ribbons';

/** Quiet strokes around the waiting ember (or wet plane). Drawing only: never writes wind or heat. */
export class EmberInvitation {
  readonly batch = new RibbonBatch(72, '#ffe0a0', 3);
  private readonly strokes: Ribbon[] = Array.from({ length: 3 }, () => ({
    points: Array.from({ length: 24 }, () => new THREE.Vector3()), alpha: 0, width: 0,
  }));
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private target: THREE.Vector3 | null = null;
  private elapsed = 0;

  constructor() {
    this.batch.mesh.name = 'ember-invitation';
    this.batch.mesh.visible = false;
  }

  update(dt: number, camera: THREE.Camera, target: THREE.Vector3 | null): void {
    this.batch.mesh.visible = false;
    if (target !== this.target) { this.target = target; this.elapsed = 0; }
    if (!target) return;
    this.elapsed += dt;
    const k = tuning.wood;
    if (this.elapsed < k.inviteAfter) return;
    const at = this.elapsed - k.inviteAfter;
    const cycle = k.inviteSweep + k.invitePause;
    const phase = (at % cycle) / k.inviteSweep;
    const fade = THREE.MathUtils.smoothstep(phase, 0, 0.16) * (1 - THREE.MathUtils.smoothstep(phase, 0.8, 1));
    if (fade < 0.002) return;
    const direction = Math.floor(at / cycle) % 2 === 0 ? 1 : -1;
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    const pen = THREE.MathUtils.smoothstep(phase, 0, 1);
    for (let strand = 0; strand < this.strokes.length; strand++) {
      const r = this.strokes[strand];
      r.alpha = k.inviteAlpha * fade * (strand === 0 ? 1 : 0.4);
      r.width = k.inviteWidth * (strand === 0 ? 1 : 0.6);
      for (let i = 0; i < r.points.length; i++) {
        const tail = i / (r.points.length - 1);
        const t = Math.max(0, pen - tail * 0.4 - strand * 0.04);
        r.points[i].copy(target)
          .addScaledVector(this.right, (t - 0.5) * k.inviteSpan * direction)
          .addScaledVector(this.up, 0.4 + Math.sin(t * Math.PI) * 0.38 + strand * 0.15);
      }
    }
    this.batch.mesh.visible = true;
    this.batch.update(this.strokes);
  }
}

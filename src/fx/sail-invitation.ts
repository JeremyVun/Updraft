import * as THREE from 'three';
import type { Boat } from '../traveller/boat';
import { tuning } from '../tuning';
import { RibbonBatch, type Ribbon } from './ribbons';

/** A short sweep across the slack sail, using the washing's invitation gesture. Purely drawn: no wind. */
export class SailInvitation {
  readonly batch = new RibbonBatch(72, '#fff1d5');
  private readonly strokes: Ribbon[] = Array.from({ length: 3 }, () => ({
    points: Array.from({ length: 24 }, () => new THREE.Vector3()), alpha: 0, width: 0,
  }));
  private readonly center = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();
  private elapsed = 0;

  constructor() {
    this.batch.mesh.name = 'sail-invitation';
    this.batch.mesh.visible = false;
  }

  update(dt: number, camera: THREE.Camera, boat: Boat, invited: boolean): void {
    const k = tuning.sail;
    this.batch.mesh.visible = false;
    // Read the same droop the cloth renders. A chapter timer alone would offer wind while it still billows.
    if (!invited || boat.sailDroop < k.inviteDroop) { this.elapsed = 0; return; }
    this.elapsed += dt;
    if (this.elapsed < k.inviteAfter) return;
    const phase = ((this.elapsed - k.inviteAfter) % (k.inviteSweep + k.invitePause)) / k.inviteSweep;
    const fade = THREE.MathUtils.smoothstep(phase, 0, 0.18)
      * (1 - THREE.MathUtils.smoothstep(phase, 0.78, 1));
    if (fade < 0.002) return;

    boat.sailPoint(this.center);
    this.toward.subVectors(camera.position, this.center).normalize();
    this.center.addScaledVector(this.toward, k.inviteStandOff);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    // Follow the bow's screen direction; this demonstrates a sweep, not the updraft's climbing circles.
    const direction = Math.sin(boat.yaw) * this.right.x + Math.cos(boat.yaw) * this.right.z >= 0 ? 1 : -1;
    const pen = THREE.MathUtils.smoothstep(phase, 0, 1);
    for (let strand = 0; strand < this.strokes.length; strand++) {
      const r = this.strokes[strand];
      r.alpha = k.inviteAlpha * fade * (strand === 0 ? 1 : 0.45);
      r.width = k.inviteWidth * (strand === 0 ? 1 : 0.65);
      for (let i = 0; i < r.points.length; i++) {
        const tail = i / (r.points.length - 1);
        const t = Math.max(0, pen - tail * 0.36 - strand * 0.045);
        r.points[i].copy(this.center)
          .addScaledVector(this.right, (t - 0.5) * k.inviteSpan * direction)
          .addScaledVector(this.up, Math.sin(t * Math.PI) * k.inviteArc + strand * k.inviteSpacing);
      }
    }
    this.batch.mesh.visible = true;
    this.batch.update(this.strokes);
  }
}

import * as THREE from 'three';
import { tuning } from '../tuning';
import type { WashingCurtain } from '../world/lines-passage';
import { RibbonBatch, type Ribbon } from './ribbons';

/** A sideways brushstroke across the first sheet: a sweep invitation, distinct from the climbing updraft coils.
 * These strokes are purely drawn. They never touch the wind field or advance the puzzle. */
export class WashingInvitation {
  readonly batch = new RibbonBatch(72, '#c87d39');
  private readonly strokes: Ribbon[] = Array.from({ length: 3 }, () => ({
    points: Array.from({ length: 24 }, () => new THREE.Vector3()), alpha: 0, width: 0,
  }));
  private curtain: WashingCurtain | null = null;
  private elapsed = 0;
  private alpha = 0;

  update(dt: number, active: WashingCurtain | null): void {
    const c = active?.curtain === 0 && !active.cleared ? active : null;
    if (c !== this.curtain) { this.curtain = c; this.elapsed = 0; this.alpha = 0; }
    this.batch.mesh.visible = false;
    if (!c) return;
    const k = tuning.linesPassage;
    this.elapsed += dt;
    const offered = this.elapsed > k.inviteAfter && c.brushAge > k.inviteResume;
    this.alpha += ((offered ? k.inviteAlpha : 0) - this.alpha) * (1 - Math.exp(-dt * 6));
    if (this.alpha < 0.002) return;

    const cycle = k.inviteSweep + k.invitePause;
    const at = Math.max(0, this.elapsed - k.inviteAfter);
    const pass = Math.floor(at / cycle);
    const phase = (at % cycle) / k.inviteSweep;
    const direction = pass % 2 === 0 ? 1 : -1;
    const fade = THREE.MathUtils.smoothstep(phase, 0, 0.16) * (1 - THREE.MathUtils.smoothstep(phase, 0.82, 1.08));
    const pen = THREE.MathUtils.smoothstep(phase, 0, 1);
    for (let strand = 0; strand < this.strokes.length; strand++) {
      const r = this.strokes[strand];
      r.alpha = this.alpha * fade * (strand === 0 ? 1 : 0.45);
      r.width = k.inviteWidth * (strand === 0 ? 1 : 0.65);
      for (let i = 0; i < r.points.length; i++) {
        const tail = i / (r.points.length - 1);
        const t = Math.max(0, pen - tail * 0.36 - strand * 0.045);
        r.points[i].set(
          c.center.x + (t - 0.5) * c.width * k.inviteSpan * direction,
          c.center.y - 0.5 + Math.sin(t * Math.PI) * 0.35 + strand * 0.19,
          c.center.z + 1.1,
        );
      }
    }
    this.batch.mesh.visible = fade > 0.002;
    if (this.batch.mesh.visible) this.batch.update(this.strokes);
  }
}

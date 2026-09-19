import * as THREE from 'three';
import { tuning } from '../tuning';
import { RibbonBatch, type Ribbon } from './ribbons';

/** How many lengths the streak is drawn from: a keyboard's worth of travel and no more. */
const POINTS = 40;

/**
 * The wind showing the way along a keyboard. A pale streak runs with the notes as they sound — up the keys for a
 * rising phrase, back down for a falling one — and when the phrase is answered it lets go and blows away. It is
 * drawn in the same grammar as every other wind the player sees, so nothing here is a mark or an arrow.
 */
export class KeyLine {
  readonly batch = new RibbonBatch(POINTS, '#fffaf0');
  private readonly ribbon: Ribbon = { points: [], alpha: 0, width: 0 };
  private readonly spare: THREE.Vector3[] = [];
  private readonly at = new THREE.Vector3();
  /** Where the streak has got to along the keys, and the key that is sounding now. */
  private head = 0;
  private want = 0;
  private aimed = -1e3;
  private shown = 0;
  private blown = 0;
  private now = 0;

  /** The key that is sounding, from the bottom note to the top. The line runs to it while the notes keep coming. */
  aim(t: number): void {
    if (this.now - this.aimed > tuning.piano.lineHolds) {
      this.head = t;
      this.blown = 0;
    }
    this.want = t;
    this.aimed = this.now;
  }

  /** The phrase came back. The line lets go of the keys and the wind has it. */
  flourish(): void {
    this.blown = 1;
  }

  update(dt: number, time: number, along: (t: number, out: THREE.Vector3) => THREE.Vector3): void {
    this.now = time;
    const t = tuning.piano;
    const live = time - this.aimed < t.lineHolds;
    const points = this.ribbon.points;
    this.head += (this.want - this.head) * (1 - Math.exp(-dt * t.lineChases));
    this.shown += ((live ? 1 : 0) - this.shown) * (1 - Math.exp(-dt * (live ? 7 : 1.4)));
    /** Everything already laid down floats off the keys, and faster once the phrase has been played back. */
    const rise = (t.lineRise + t.lineBlown * this.blown) * dt;
    for (const p of points) p.y += rise;

    if (live) {
      along(this.head, this.at);
      /** Laid a little over the keys, and never quite steady, because it is air and not a line drawn on them. */
      this.at.y += t.lineOver + Math.sin(time * 4.3 + this.head * 11) * 0.012;
      const last = points[points.length - 1];
      if (!last || last.distanceTo(this.at) > 0.03) points.push((this.spare.pop() ?? new THREE.Vector3()).copy(this.at));
      else last.copy(this.at);
      while (points.length > POINTS) this.spare.push(points.shift()!);
    } else if (points.length > 0) {
      /** It dissolves from the tail, the way a wind line does, so the last of it is where the phrase ended. */
      this.spare.push(points.shift()!);
    }

    this.ribbon.alpha = this.shown * t.lineAlpha * (1 - 0.35 * this.blown);
    this.ribbon.width = t.linePen;
    this.batch.mesh.visible = points.length > 1 && this.ribbon.alpha > 0.004;
    if (this.batch.mesh.visible) this.batch.update([this.ribbon]);
  }
}

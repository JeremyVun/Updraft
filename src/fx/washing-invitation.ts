import * as THREE from 'three';
import { tuning } from '../tuning';
import type { WashingCurtain } from '../world/lines-passage';
import { WindGesture } from './wind-gesture';

/** The first sheet teaches a sweep. The demonstration never supplies wind or progress. */
export class WashingInvitation {
  private readonly gesture = new WindGesture('washing-invitation');
  readonly batch = this.gesture.batch;
  readonly strokes = this.gesture.strokes;
  private readonly center = new THREE.Vector3();
  private curtain: WashingCurtain | null = null;
  private elapsed = 0;
  private alpha = 0;

  update(dt: number, camera: THREE.Camera, active: WashingCurtain | null): void {
    const c = active?.curtain === 0 && !active.cleared ? active : null;
    if (c !== this.curtain) { this.curtain = c; this.elapsed = 0; this.alpha = 0; }
    this.gesture.hide();
    if (!c) return;
    const k = tuning.linesPassage;
    this.elapsed += dt;
    const offered = this.elapsed > k.inviteAfter && c.brushAge > k.inviteResume;
    this.alpha += ((offered ? k.inviteAlpha : 0) - this.alpha)
      * (1 - Math.exp(-dt * (offered ? 6 : tuning.invitation.handover)));
    const cycle = k.inviteSweep + k.invitePause;
    const at = Math.max(0, this.elapsed - k.inviteAfter);
    this.center.copy(c.center); this.center.z += 1.1;
    this.gesture.draw(camera, this.center, (at % cycle) / k.inviteSweep, c.width * k.inviteSpan,
      this.alpha, k.inviteWidth, 'across', Math.floor(at / cycle) % 2 === 0 ? 1 : -1);
  }
}

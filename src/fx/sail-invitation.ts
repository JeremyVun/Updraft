import * as THREE from 'three';
import type { Boat } from '../traveller/boat';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import { tuning } from '../tuning';
import { WindGesture } from './wind-gesture';

/** A travelling gust crosses the slack sail, then gives way to the player's wind. */
export class SailInvitation {
  private readonly gesture = new WindGesture('sail-invitation');
  readonly batch = this.gesture.batch;
  private readonly center = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();
  private elapsed = 0;
  private quiet = 0;
  private alpha = 0;

  update(dt: number, camera: THREE.Camera, boat: Boat, invited: boolean, input: PointerInput): void {
    const k = tuning.sail;
    this.gesture.hide();
    if (!invited) { this.elapsed = 0; this.alpha = 0; return; }
    boat.sailPoint(this.center);
    this.quiet += dt;
    if (input.present && !input.muted && input.ndc.distanceToSquared(input.prevNdc) > 1e-8
      && screenBrush(camera, this.center, input.prevNdc, input.ndc, 0.2) > 0.02) this.quiet = 0;
    const slack = boat.sailDroop >= k.inviteDroop;
    if (slack) this.elapsed += dt; else this.elapsed = 0;
    const offered = slack && this.elapsed > k.inviteAfter && this.quiet > tuning.invitation.resumeAfter;
    this.alpha += ((offered ? k.inviteAlpha : 0) - this.alpha)
      * (1 - Math.exp(-dt * (offered ? 6 : tuning.invitation.handover)));
    this.toward.subVectors(camera.position, this.center).normalize();
    this.center.addScaledVector(this.toward, k.inviteStandOff);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    const direction = Math.sin(boat.yaw) * this.right.x + Math.cos(boat.yaw) * this.right.z >= 0 ? 1 : -1;
    const phase = (Math.max(0, this.elapsed - k.inviteAfter) % (k.inviteSweep + k.invitePause)) / k.inviteSweep;
    this.gesture.draw(camera, this.center, phase, k.inviteSpan, this.alpha, k.inviteWidth, 'across', direction);
  }
}

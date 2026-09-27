import * as THREE from 'three';
import type { Glider } from '../glider/glider';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import { tuning } from '../tuning';
import { WindGesture } from './wind-gesture';

/** A gust drawn across the paper plane while it waits for wind, heading the way the chapter wants it to go. */
export class PlaneInvitation {
  private readonly gesture = new WindGesture('plane-invitation');
  readonly batch = this.gesture.batch;
  private readonly center = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();
  private elapsed = 0;
  private quiet = 0;
  private alpha = 0;

  /** `into`: the held plane's first gust, drawn from the bottom right of the frame up to the top left, into the grass. */
  update(dt: number, camera: THREE.Camera, plane: Glider, aim: THREE.Vector3 | null, input: PointerInput, into = false): void {
    const k = tuning.opening;
    this.gesture.hide();
    if (!aim) { this.elapsed = 0; this.alpha = 0; return; }
    this.elapsed += dt;
    this.quiet += dt;
    if (input.present && !input.muted && input.ndc.distanceToSquared(input.prevNdc) > 1e-8
      && screenBrush(camera, plane.position, input.prevNdc, input.ndc, 0.2) > 0.02) this.quiet = 0;
    const offered = this.elapsed > k.planeInviteAfter && this.quiet > tuning.invitation.resumeAfter;
    this.alpha += ((offered ? k.planeInviteAlpha : 0) - this.alpha)
      * (1 - Math.exp(-dt * (offered ? 6 : tuning.invitation.handover)));
    this.center.copy(plane.position);
    this.toward.subVectors(camera.position, this.center).normalize();
    this.center.addScaledVector(this.toward, k.planeInviteStandOff);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    const direction = into ? -1 : (aim.x - plane.position.x) * this.right.x + (aim.z - plane.position.z) * this.right.z >= 0 ? 1 : -1;
    const phase = (Math.max(0, this.elapsed - k.planeInviteAfter) % (k.planeInviteSweep + k.planeInvitePause)) / k.planeInviteSweep;
    this.gesture.draw(camera, this.center, phase, into ? k.planeInviteIntoSpan : k.planeInviteSpan, this.alpha, k.planeInviteWidth,
      'across', direction, into ? -k.planeInviteRise : 0);
  }
}

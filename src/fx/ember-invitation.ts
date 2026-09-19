import * as THREE from 'three';
import { tuning } from '../tuning';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import { WindGesture } from './wind-gesture';

/** Shared sweeps for embers, wet paper, toy sails and soap bubbles. Drawing only. */
export class EmberInvitation {
  private readonly gesture = new WindGesture('ember-invitation');
  readonly batch = this.gesture.batch;
  readonly strokes = this.gesture.strokes;
  private target: THREE.Vector3 | null = null;
  private elapsed = 0;
  private quiet = 0;
  private alpha = 0;
  private readonly center = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();
  private readonly rim = new THREE.Vector3();
  private readonly screen = new THREE.Vector3();

  update(dt: number, camera: THREE.Camera, target: THREE.Vector3 | null, input: PointerInput,
    alternate?: THREE.Vector3, surfaceRadius = 0): void {
    this.gesture.hide();
    if (target !== this.target) { this.target = target; this.elapsed = 0; this.quiet = 0; this.alpha = 0; }
    if (!target) return;
    this.elapsed += dt; this.quiet += dt;
    let brushRadius = tuning.wood.brushRadius;
    if (surfaceRadius > 0) {
      this.screen.copy(target).project(camera);
      this.toward.setFromMatrixColumn(camera.matrixWorld, 0);
      this.rim.copy(target).addScaledVector(this.toward, surfaceRadius).project(camera);
      brushRadius = Math.max(brushRadius, Math.abs(this.rim.x - this.screen.x)
        * (camera as THREE.PerspectiveCamera).aspect + tuning.skyMirror.bubbleHitPadding);
    }
    if (input.present && !input.muted && input.ndc.distanceToSquared(input.prevNdc) > 1e-8
      && (screenBrush(camera, target, input.prevNdc, input.ndc, brushRadius) > 0.02
        || (alternate && screenBrush(camera, alternate, input.prevNdc, input.ndc, brushRadius) > 0.02))) this.quiet = 0;
    const k = tuning.wood;
    const offered = this.elapsed > k.inviteAfter && this.quiet > tuning.invitation.resumeAfter;
    this.alpha += ((offered ? k.inviteAlpha : 0) - this.alpha)
      * (1 - Math.exp(-dt * (offered ? 6 : tuning.invitation.handover)));
    const at = Math.max(0, this.elapsed - k.inviteAfter), cycle = k.inviteSweep + k.invitePause;
    // A large target such as a soap bubble must not bury the demonstration inside its opaque surface.
    this.center.copy(target).addScaledVector(this.toward.subVectors(camera.position, target).normalize(), surfaceRadius);
    this.gesture.draw(camera, this.center, (at % cycle) / k.inviteSweep, Math.max(k.inviteSpan, surfaceRadius * 2.3), this.alpha,
      k.inviteWidth, 'across', Math.floor(at / cycle) % 2 === 0 ? 1 : -1);
  }
}

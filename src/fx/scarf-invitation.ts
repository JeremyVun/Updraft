import * as THREE from 'three';
import { SCARF_SNAGS } from '../world/birch-scarf';
import type { AutumnBirches } from '../world/birches';
import type { Coax } from './swirl';
import { tuning } from '../tuning';
import { WindGesture } from './wind-gesture';

/** The same sweeps as the rest of the journey; a wrapped trunk asks for the shared updraft. */
export class ScarfInvitation {
  private readonly gesture = new WindGesture('scarf-invitation');
  readonly batch = this.gesture.batch;
  readonly strokes = this.gesture.strokes;
  private readonly center = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();
  private readonly winding: Coax = { at: new THREE.Vector3(), urgency: 0, radius: tuning.birches.scarf.inviteCircleRadius };
  coax: Coax | null = null;
  private key = -1;
  private elapsed = 0;
  private alpha = 0;

  update(dt: number, camera: THREE.Camera, world: AutumnBirches | null): void {
    const scarf = world?.scarf;
    const snag = scarf?.snags[scarf.active];
    const key = snag && !snag.freed && snag.target < 1 ? scarf!.active : world?.swing.invited ? SCARF_SNAGS.length : -1;
    this.gesture.hide(); this.coax = null;
    if (key !== this.key) { this.key = key; this.elapsed = 0; this.alpha = 0; }
    if (key < 0 || !world) return;
    const k = tuning.birches.scarf;
    this.elapsed += dt;
    const quiet = key === SCARF_SNAGS.length ? world.swing.brushAge : snag!.brushAge;
    const offered = this.elapsed > k.inviteAfter && quiet > k.inviteResume;
    this.alpha += ((offered ? k.inviteAlpha : 0) - this.alpha)
      * (1 - Math.exp(-dt * (offered ? 6 : tuning.invitation.handover)));
    if (key === SCARF_SNAGS.length) world.swing.seat(this.center); else this.center.copy(snag!.center);
    const kind = SCARF_SNAGS[key]?.kind;
    if (kind === 'unwind') {
      this.winding.at.copy(this.center);
      this.winding.urgency = THREE.MathUtils.smoothstep(this.elapsed, k.inviteAfter, k.inviteAfter + 2);
      this.coax = this.winding.urgency > 0 ? this.winding : null;
      return;
    }
    this.center.addScaledVector(this.toward.subVectors(camera.position, this.center).normalize(), 1.7);
    const phase = (Math.max(0, this.elapsed - k.inviteAfter) % (k.inviteSweep + k.invitePause)) / k.inviteSweep;
    this.gesture.draw(camera, this.center, phase, kind === 'bow' ? k.inviteBowSpan : k.inviteSpan, this.alpha, k.inviteWidth,
      kind === 'lift' ? 'lift' : kind === 'bow' ? 'outward' : 'across');
  }
}

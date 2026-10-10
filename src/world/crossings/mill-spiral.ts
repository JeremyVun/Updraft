import * as THREE from 'three';
import { tuning } from '../../tuning';
import { RibbonBatch, type Ribbon } from '../../fx/ribbons';
import { windPen } from '../../fx/wind-gesture';
import type { Windmill } from './windmill';

const POINTS = 64;
/** A clean leading strand and two fainter wakes a little inside and behind it. */
const STRANDS = [
  { delay: 0, length: 1, width: 1, alpha: 1, inset: 0 },
  { delay: 0.08, length: 0.7, width: 0.55, alpha: 0.55, inset: 0.12 },
  { delay: 0.16, length: 0.45, width: 0.4, alpha: 0.3, inset: -0.1 },
];

/**
 * The mill's invitation: a flat spiral of air in the sails' plane, a little in front of them, winding out from the
 * hub about a turn and a quarter the way they turn, its travelling tip showing the way. Drawing only.
 */
export class MillSpiral {
  readonly batch = new RibbonBatch(POINTS * STRANDS.length, '#fff4dd', 1, false, tuning.invitation.lightFloor);
  private readonly strokes: Ribbon[] = STRANDS.map(() => ({
    points: Array.from({ length: POINTS }, () => new THREE.Vector3()), alpha: 0, width: 0,
  }));
  private elapsed = 0;
  private alpha = 0;

  constructor() {
    this.batch.mesh.name = 'mill-invitation';
    this.batch.mesh.visible = false;
  }

  get objects(): THREE.Object3D[] {
    return [this.batch.mesh];
  }

  update(dt: number, camera: THREE.Camera, mill: Windmill, offered: boolean): void {
    const k = tuning.crossings.mill;
    this.alpha += ((offered ? k.inviteAlpha : 0) - this.alpha) * (1 - Math.exp(-dt * (offered ? 3 : tuning.invitation.handover)));
    if (offered) this.elapsed += dt;
    else if (this.alpha < 0.01) this.elapsed = 0;
    if (this.alpha < 0.005) {
      this.batch.mesh.visible = false;
      return;
    }
    const phase = (this.elapsed % (k.inviteSweep + k.invitePause)) / k.inviteSweep;
    const fade = THREE.MathUtils.smoothstep(phase, 0, 0.1) * (1 - THREE.MathUtils.smoothstep(phase, 0.85, 1.25));
    const pen = windPen(camera, mill.hub, k.inviteWidth);
    const turns = k.inviteTurns * Math.PI * 2;
    /** Starting below the hub on the boarding side, so the tip ends going up past the sail she waits for. */
    const start = -Math.PI * 0.75;
    for (let j = 0; j < STRANDS.length; j++) {
      const s = STRANDS[j], r = this.strokes[j];
      const head = Math.min(1, phase * 1.15 - s.delay);
      r.alpha = head > 0 ? this.alpha * fade * s.alpha * THREE.MathUtils.smoothstep(head, 0, 0.1) : 0;
      r.width = pen * s.width;
      if (!r.alpha) continue;
      const length = Math.min(head, 0.75 * s.length);
      for (let i = 0; i < POINTS; i++) {
        const t = head - (i / (POINTS - 1)) * length;
        const a = start + t * turns;
        const rad = THREE.MathUtils.lerp(k.inviteInner, k.inviteOuter, t) * (1 + s.inset * (1 - t) * 0.3);
        /** Forward is the boarding side's tip rising: clockwise seen from the front. */
        mill.group.localToWorld(r.points[i].set(-Math.cos(a) * rad, mill.hub.y + Math.sin(a) * rad, 0.45 + 0.05 * Math.sin(t * 9)));
      }
    }
    this.batch.mesh.visible = this.batch.update(this.strokes);
  }
}

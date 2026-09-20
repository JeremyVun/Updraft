import type * as THREE from 'three';
import { screenPan } from '../creatures/motion';
import { tuning } from '../tuning';
import type { Foley } from './foley';

/** One room-wide leaf budget, independent of particle count. Missed sounds are discarded. */
export class BirchesFoley {
  private time = 0;
  private nextLeaf = 0;
  private nextCreak = 0;
  private contact = 0;
  private walking = false;
  private swinging = false;
  private direction = 0;
  private excursion = 0;
  private angle = 0;
  private travel = 0;

  constructor(private readonly foley: Foley, private readonly camera: THREE.Camera) {}

  update(dt: number): void { this.time += dt; }

  private distance(at: THREE.Vector3): number {
    const k = tuning.audio;
    const t = Math.max(0, Math.min(1, (this.camera.position.distanceTo(at) - k.birchesFoleyNear)
      / (k.birchesFoleyFar - k.birchesFoleyNear)));
    return 1 - t * t * (3 - 2 * t);
  }

  step(at: THREE.Vector3, contact: number, cover: number, active: boolean): void {
    const changed = contact > this.contact, wasWalking = this.walking;
    this.contact = contact;
    this.walking = active;
    // Entry, teleports and resume establish a baseline; merely moving a seated child is silent.
    if (!active || !wasWalking || !changed || cover < tuning.audio.leafCoverMin) return;
    this.scuff(at, Math.min(1, cover) * 0.65, true);
  }

  scuff(at: THREE.Vector3, strength: number, active: boolean): void {
    if (!active || this.time < this.nextLeaf) return;
    const level = Math.min(1, strength) * this.distance(at) * tuning.audio.leafScuffLevel;
    if (level < 0.015) return;
    this.foley.material('leaf-scuff', level, screenPan(this.camera, at));
    this.nextLeaf = this.time + tuning.audio.leafScuffEvery;
  }

  swing(at: THREE.Vector3, angle: number, speed: number, rider: number, active: boolean): void {
    const direction = Math.abs(speed) > 0.035 ? Math.sign(speed) : 0;
    if (!active || !this.swinging) {
      this.swinging = active; this.direction = direction; this.excursion = 0;
      this.angle = angle; this.travel = 0;
      return;
    }
    this.travel += Math.abs(angle - this.angle);
    this.angle = angle;
    this.excursion = Math.max(this.excursion, Math.abs(angle));
    if (!direction) return;
    const reversed = this.direction !== 0 && direction !== this.direction;
    this.direction = direction;
    if (!reversed) return;
    const excursion = this.excursion;
    const travel = this.travel;
    this.travel = 0;
    this.excursion = Math.abs(angle);
    if (excursion < tuning.audio.swingCreakAngle || travel < tuning.audio.swingCreakAngle
      || this.time < this.nextCreak) return;
    const level = Math.min(1, excursion / 0.65) * (0.4 + 0.6 * rider)
      * this.distance(at) * tuning.audio.swingCreakLevel;
    if (level < 0.015) return;
    this.foley.material('swing-creak', level, screenPan(this.camera, at));
    this.nextCreak = this.time + tuning.audio.swingCreakEvery;
  }
}

import * as THREE from 'three';
import type { Cast } from './cast';
import { tuning } from '../tuning';
import { heightAt } from '../world/island';

/** Reaching a completed destination ends pursuit. The paper comes back before the child goes on. */
export class PlaneArrival {
  private phase: 'waiting' | 'landing' | 'pickup' | 'done' = 'waiting';
  private readonly at = new THREE.Vector3();

  get active(): boolean { return this.phase !== 'waiting'; }

  update(cast: Cast, ready: boolean, next: () => void): boolean {
    const { child, plane, carry } = cast;
    if (this.phase === 'waiting') {
      if (!ready || child.acting || carry.busy) return false;
      child.stop();
      if (plane.held) {
        this.phase = 'done';
        next();
        return true;
      }
      // Land in front of the hands, without flying down through the child's head. Keep the
      // current foothold as a fallback at a steep bank or the edge of the mirror's shallow flat.
      this.at.copy(child.position);
      const x = this.at.x + Math.sin(child.yaw) * tuning.planeGuide.pickupAhead;
      const z = this.at.z + Math.cos(child.yaw) * tuning.planeGuide.pickupAhead;
      const ground = plane.landingGround?.(x, z) ?? heightAt(x, z);
      const water = plane.water?.over(x, z) ? plane.water.level : 0;
      if (ground > water && Math.abs(ground - child.position.y) < 0.8) this.at.set(x, ground, z);
      plane.settleAt(this.at);
      this.phase = 'landing';
    }
    if (this.phase === 'landing') {
      child.lookAt = plane.position;
      if (plane.landed && Math.hypot(plane.position.x - child.position.x, plane.position.z - child.position.z) < 2.6) {
        this.phase = 'pickup';
        child.pickUp(() => {
          plane.hold(child);
          this.phase = 'done';
          next();
        });
      }
    }
    return true;
  }
}

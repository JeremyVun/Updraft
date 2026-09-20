import * as THREE from 'three';
import { tuning } from '../tuning';
import { mirrorBed } from '../world/sky-mirror-layout';
import type { Cast } from './cast';

/** Confidence after the sleeping island: investigate, accompany and look up, without solving the puzzle. */
export class MirrorCompanion {
  private nextChoice = 0;
  private nextInspect = 0;
  private lastLight = -1;
  private readonly goal = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();

  constructor(private readonly cast: Cast) {}

  reset(): void {
    const k = this.cast.cygnet;
    k.errand = null; k.stay = false; k.pace = 1; k.watch(null);
    this.lastLight = -1;
  }

  update(time: number, target: number, playing: boolean): void {
    const { cygnet: k, child, carry, skyMirror: room } = this.cast;
    if (k.carried || carry.busy || k.seating.move || k.state !== 'following') return;
    const T = tuning.mirrorCompanion;
    k.mind.trust(0.85);
    k.pace = T.pace;
    const bubble = room.carried ?? room.bubbles.find(b => b.pop === 0);
    const rising = room.stars.findIndex(s => s.state === 'rising');
    const light = bubble?.star ?? -1;
    const lifted = rising >= 0 ? rising : light;
    if (lifted >= 0) {
      k.errand = null;
      k.watch(rising >= 0 ? room.stars[rising].light.position : bubble!.position);
      // Both wings open easily now. It remains beside the child rather than stealing the final flight.
      if (this.lastLight !== lifted) {
        this.lastLight = lifted;
        k.does('stretch', undefined, T.stretchFor);
      }
      return;
    }
    if (!playing) {
      k.errand = null; k.watch(null);
      return;
    }
    if (time < this.nextChoice) return;
    this.nextChoice = time + T.chooseEvery;
    const star = room.stars[target];
    if (star.state !== 'fallen') return;
    this.look.copy(bubble?.position ?? star.origin);
    // Approach beside the light or bubble, leaving the player's steering line clear.
    this.direction.subVectors(this.look, child.position).setY(0).normalize();
    const standOff = bubble ? T.bubbleStandOff : T.starStandOff;
    this.goal.copy(this.look).addScaledVector(this.direction, -standOff);
    this.goal.x += this.direction.z * standOff;
    this.goal.z -= this.direction.x * standOff;
    this.direction.subVectors(this.goal, child.position).setY(0).clampLength(0, T.exploreRadius);
    this.goal.copy(child.position).add(this.direction).setY(0);
    if (mirrorBed(this.goal.x, this.goal.z) < -0.04) return;
    k.watch(this.look);
    if (Math.hypot(k.position.x - this.goal.x, k.position.z - this.goal.z) > 0.65) {
      k.errand = this.goal;
    } else if (time > this.nextInspect && !bubble) {
      k.errand = null;
      k.does('nibble', this.look, 1.6);
      this.nextInspect = time + T.inspectEvery;
    }
  }
}

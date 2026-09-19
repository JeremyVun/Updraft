import * as THREE from 'three';
import { tuning } from '../tuning';
import { BIRCH_PILES } from '../world/birches';
import { heightAt } from '../world/island';
import type { Cast } from './cast';

/** Small decisions alongside the player's walk, never a chapter beat or a camera takeover. */
export class BirchLeafPlay {
  private nextChoice = 0;
  private scuffIn = 0;
  private roaming = false;
  private restingUntil = 0;
  private readonly spot = new THREE.Vector3();
  private readonly last = new THREE.Vector3();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };

  constructor(private readonly cast: Cast) {}

  update(dt: number, time: number): void {
    const { child, cygnet: bird, carry, wind, birches } = this.cast;
    if (carry.busy || bird.seating.move || bird.seating.held) return;
    const knobs = tuning.birches;
    const pile = BIRCH_PILES.reduce((best, p) =>
      Math.hypot(p.x - child.position.x, p.z - child.position.z) < Math.hypot(best.x - child.position.x, best.z - child.position.z) ? p : best);
    const near = Math.hypot(pile.x - child.position.x, pile.z - child.position.z);
    const breeze = wind.sample(pile.x, pile.z, this.air);
    if (bird.carried) {
      if (bird.seat !== 'satchel' || near > knobs.playRadius || (near > knobs.playHopNear && breeze.energy < knobs.playWind)) return;
      // Hop rearward out of the bag, clear of the child's body, even while they walk.
      const angle = child.yaw + Math.PI + 0.5;
      this.spot.set(child.position.x + Math.sin(angle) * knobs.playHopReach, 0, child.position.z + Math.cos(angle) * knobs.playHopReach);
      if (heightAt(this.spot.x, this.spot.z) < knobs.playDryHeight) return;
      bird.release(this.spot);
      bird.errand = null;
      this.last.copy(bird.position);
      this.nextChoice = time + knobs.playHopPause;
      return;
    }
    if (bird.state !== 'following') return;
    const gap = Math.hypot(bird.position.x - child.position.x, bird.position.z - child.position.z);
    bird.stay = time < this.restingUntil && gap < knobs.playRummageNear;
    if (gap > knobs.playRadius || near > knobs.playRadius + 3) {
      bird.errand = null;
      bird.watch(null);
      this.roaming = false;
      this.last.copy(bird.position);
      return;
    }
    this.scuffIn -= dt;
    const moved = bird.position.distanceTo(this.last);
    this.last.copy(bird.position);
    const inPile = Math.hypot(bird.position.x - pile.x, bird.position.z - pile.z) < pile.r;
    if (inPile && moved > dt * 0.7 && this.scuffIn <= 0) {
      birches.kick(bird.position.x, bird.position.z, knobs.playScuffRadius, knobs.playScuffStrength);
      this.scuffIn = knobs.playScuffEvery;
    }
    if (time < this.nextChoice) return;
    if (this.roaming && !bird.errand) {
      this.roaming = false;
      bird.watch(null);
      if (inPile) bird.mind.perform(Math.random() < 0.65 ? 'delve' : 'shake', knobs.playRummageFor);
      this.nextChoice = time + knobs.playPause * (0.6 + Math.random());
      this.restingUntil = inPile ? time + knobs.playRummageFor : 0;
      return;
    }
    if (bird.errand) return;
    const w = wind.sample(bird.position.x, bird.position.z, this.air);
    const speed = Math.hypot(w.x, w.z);
    if (w.energy > knobs.playWind && speed > 1) {
      this.spot.set(bird.position.x + w.x / speed * knobs.playChaseReach, 0, bird.position.z + w.z / speed * knobs.playChaseReach);
    } else {
      const a = Math.random() * Math.PI * 2;
      this.spot.set(pile.x + Math.sin(a) * pile.r * 0.7, 0, pile.z + Math.cos(a) * pile.r * 0.7);
    }
    if (heightAt(this.spot.x, this.spot.z) < knobs.playDryHeight || Math.hypot(this.spot.x - child.position.x, this.spot.z - child.position.z) > knobs.playRadius) {
      this.nextChoice = time + 1;
      return;
    }
    bird.errand = this.spot;
    bird.watch(this.spot);
    this.roaming = true;
    this.nextChoice = time + 1;
  }
}

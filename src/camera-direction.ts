import * as THREE from 'three';
import type { Shot } from './camera';
import { tuning } from './tuning';
import { heightAt } from './world/island';

/** A story names what matters; the lens can notice it without moving the boat's physical anchor. */
export interface CameraAttention {
  point: THREE.Vector3;
  /** Presence of the moment, including its approach and release, 0..1. */
  strength: number;
  /** Share of the gaze given to it; the foreground remains the subject. */
  weight: number;
  /** Optional preferred view of the moment, in world radians from south. */
  bearing?: number;
  distance?: number;
  height?: number;
}

const arc = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Small, persistent corrections to a story's composition. No scene traversal or render/readback work. */
export class CameraDirection {
  private offset = 0;
  private wanted = 0;
  private untilReview = 0;
  private heldFor = 0;
  private proposed = 0;
  private confirmedFor = 0;
  private sinceReview = 0;
  private readonly relative = new THREE.Vector3();
  private readonly candidate = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly local = new THREE.Vector3();

  reset(): void {
    this.offset = this.wanted = this.untilReview = this.heldFor = 0;
    this.proposed = this.confirmedFor = this.sinceReview = 0;
  }

  release(): void {
    this.wanted = this.untilReview = this.heldFor = 0;
    this.proposed = this.confirmedFor = this.sinceReview = 0;
  }

  /** Resolve attention first. Unlike translating a follow shot, this actually turns the lens. */
  compose(shot: Shot, eye: THREE.Vector3, look: THREE.Vector3): void {
    look.copy(shot.target);
    const attention = shot.attention;
    if (!attention) return;
    const strength = THREE.MathUtils.clamp(attention.strength, 0, 1);
    this.relative.subVectors(eye, look);
    const bearing = Math.atan2(this.relative.x, this.relative.z);
    const turn = arc((attention.bearing ?? bearing) - bearing) * strength;
    const distance = THREE.MathUtils.lerp(Math.hypot(this.relative.x, this.relative.z),
      attention.distance ?? Math.hypot(this.relative.x, this.relative.z), strength);
    eye.set(look.x + Math.sin(bearing + turn) * distance,
      look.y + THREE.MathUtils.lerp(this.relative.y, attention.height ?? this.relative.y, strength),
      look.z + Math.cos(bearing + turn) * distance);
    look.lerp(attention.point, strength * THREE.MathUtils.clamp(attention.weight, 0, 1));
  }

  /** Keep the authored view unless a nearby angle materially improves its framing. */
  adapt(dt: number, shot: Shot, eye: THREE.Vector3, look: THREE.Vector3,
    camera: THREE.PerspectiveCamera, hold: boolean): void {
    const k = tuning.cinematography;
    if (dt <= 0) return;
    this.untilReview -= dt;
    this.heldFor += dt;
    this.sinceReview += dt;
    if (hold || shot.eye || shot.composition === 'hold') {
      // The rig glides from its current pose into this staged view. Do not bend the destination too.
      this.wanted = this.offset = this.heldFor = 0;
      this.proposed = this.confirmedFor = this.sinceReview = 0;
      return;
    }
    if (!shot.subjects) {
      this.wanted = this.proposed = this.confirmedFor = this.sinceReview = 0;
    }
    else if (this.untilReview <= 0) {
      this.untilReview = k.reviewEvery;
      let best = this.wanted;
      const current = this.score(this.wanted, shot, eye, look, camera);
      let bestScore = current;
      for (let i = -2; i <= 2; i++) {
        const angle = i * k.freedom / 2;
        const score = this.score(angle, shot, eye, look, camera);
        if (score < bestScore) { bestScore = score; best = angle; }
      }
      const useful = current - bestScore > k.improvement;
      if (useful && best === this.proposed) this.confirmedFor += this.sinceReview;
      else { this.proposed = best; this.confirmedFor = 0; }
      if (!useful) this.confirmedFor = 0;
      this.sinceReview = 0;
      if (this.heldFor >= k.holdFor && this.confirmedFor >= k.confirmFor) {
        this.wanted = best;
        this.heldFor = this.confirmedFor = 0;
      }
    }
    this.offset += (this.wanted - this.offset) * (1 - Math.exp(-dt * k.compositionResponse));
    this.rotate(eye, look, this.offset, eye);
  }

  private rotate(eye: THREE.Vector3, look: THREE.Vector3, angle: number, out: THREE.Vector3): void {
    const x = eye.x - look.x, z = eye.z - look.z;
    out.set(look.x + x * Math.cos(angle) + z * Math.sin(angle), eye.y,
      look.z + z * Math.cos(angle) - x * Math.sin(angle));
  }

  private score(angle: number, shot: Shot, eye: THREE.Vector3, look: THREE.Vector3,
    camera: THREE.PerspectiveCamera): number {
    const pair = shot.subjects!;
    this.rotate(eye, look, angle, this.candidate);
    this.back.subVectors(this.candidate, look).normalize();
    this.right.set(this.back.z, 0, -this.back.x).normalize();
    this.up.crossVectors(this.back, this.right);
    const vertical = Math.tan(camera.fov * Math.PI / 360) * pair.margin;
    const horizontal = vertical * camera.aspect;
    let retreat = 0;
    for (let i = 0; i < 3 + (pair.points?.length ?? 0); i++) {
      const point = i === 0 ? pair.primary : i === 1 ? pair.secondary : i === 2 ? pair.tertiary : pair.points![i - 3];
      if (!point) continue;
      this.local.subVectors(point, this.candidate);
      const depth = -this.local.dot(this.back);
      retreat = Math.max(retreat, Math.abs(this.local.dot(this.right)) / horizontal - depth,
        Math.abs(this.local.dot(this.up)) / vertical - depth);
    }
    // Do not win a little screen space by moving behind a ridge or below the water.
    let obstruction = 0;
    for (let i = 0; i < 4; i++) {
      const along = i / 4;
      this.local.lerpVectors(this.candidate, pair.primary, along);
      obstruction = Math.max(obstruction, Math.max(0, heightAt(this.local.x, this.local.z))
        + (1 - along) * (shot.clearance ?? 2.8) - this.local.y);
    }
    const distance = Math.max(1, eye.distanceTo(look));
    return retreat / distance + Math.max(0, obstruction) / distance * 2
      + Math.abs(angle) * tuning.cinematography.authoredPreference;
  }
}

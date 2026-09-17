import type * as THREE from 'three';
import { FORE_L, FORE_R, HAND_L, HAND_R, WING_L, WING_R } from './body';

/** What the rest of the cygnet asks of its wings each frame. Everything here is already eased by the caller. */
export interface WingPose {
  /** 0 folded against the body to 1 fully spread. */
  open: number;
  /** The stroke, -1 bottom of the downbeat to 1 top of the upbeat, already scaled by how hard it is beating. */
  beat: number;
  /** The same stroke a moment later, for the hand to follow the arm. */
  lag: number;
  /** Leading edge down (negative) or up, radians: gliding trims it, effort works it. */
  twist: number;
  /** Frightened or cold: held tighter to the body than folded, 0..1. */
  clamp: number;
  /** Extra lift of one wing by itself (preening under it, a hand out for balance), radians, left then right. */
  raise: [number, number];
  /** A shiver or a shake running through both, radians. */
  shake: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sets the six wing bones. Folded, the arm lies back along the flank, the forearm comes forward and the hand goes back over the rump. */
export function poseWings(n: THREE.Object3D[], w: WingPose): void {
  const sweep = lerp(1.35, 0.1, w.open) + w.clamp * 0.12;
  const roll = lerp(-0.22 - w.clamp * 0.15, 0.15, w.open) + w.beat * 0.95 + w.shake * 0.4;
  const handSweep = lerp(0.9, -0.05, w.open) - Math.max(0, w.lag) * 0.3;
  const handRoll = lerp(0.1, 0, w.open) + w.lag * 0.55;
  n[WING_L].rotation.set(w.twist, sweep, roll + w.raise[0]);
  n[WING_R].rotation.set(w.twist, -sweep, -roll - w.raise[1]);
  n[FORE_L].rotation.set(0, -handSweep * 1.6, 0);
  n[FORE_R].rotation.set(0, handSweep * 1.6, 0);
  n[HAND_L].rotation.set(0, handSweep * 1.7, handRoll);
  n[HAND_R].rotation.set(0, -handSweep * 1.7, -handRoll);
}

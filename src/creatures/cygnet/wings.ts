import * as THREE from 'three';
import { FORE_L, FORE_R, HAND_L, HAND_R, WING_L, WING_R } from './body';

/** What the rest of the cygnet asks of its wings each frame. Everything here is already eased by the caller. */
export interface WingPose {
  /** 0 folded against the body to 1 fully spread. */
  open: number;
  /** Protection of the recovering left wing; fades as it heals and opens at the sleeping hilltop. */
  guard: number;
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

/**
 * Where an arm bone points in the mesh's own rest space, rather than on its parent: roll about its own length first,
 * then elevation, then sweep toward the tail. Saying it this way means a fold can be drawn by eye — each bone put
 * where it should end up — instead of solved through whatever the bone above it is doing.
 */
type Aim = [twist: number, lift: number, sweep: number];

/** Out to the side, barely swept, with a little camber along it. */
const SPREAD: Aim[] = [
  [0.05, 0.17, -0.15],
  [0.0, 0.21, -0.04],
  [-0.06, 0.2, 0.1],
];
/**
 * Shut: the whole wing rolls over so that its top faces out, and lies back along the upper flank with the vanes
 * running on past the wrist to the tail. The roll is what stops a folded wing reading as a plank stuck on the side.
 */
const FOLD: Aim[] = [
  [1.25, 0.14, 1.3],
  [1.3, 0.05, 1.64],
  [1.3, -0.06, 1.9],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const euler = new THREE.Euler(0, 0, 0, 'YZX');
const aim = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const local = new THREE.Quaternion();

/** Sets the six wing bones for both sides. Every output is continuous in every input, so a wing can never pop. */
export function poseWings(n: THREE.Object3D[], w: WingPose): void {
  for (const side of [1, -1]) {
    const guard = side > 0 ? w.guard : 0;
    const open = w.open * (1 - guard * 0.96);
    const shut = 1 - open;
    const bones = side > 0 ? [WING_L, FORE_L, HAND_L] : [WING_R, FORE_R, HAND_R];
    const raise = (side > 0 ? w.raise[0] : w.raise[1]) * (1 - guard);
    for (let i = 0; i < 3; i++) {
      let twist = lerp(FOLD[i][0], SPREAD[i][0], open);
      let lift = lerp(FOLD[i][1], SPREAD[i][1], open);
      let sweep = lerp(FOLD[i][2], SPREAD[i][2], open);
      /** The arm leads the stroke and the hand comes through after it, which is the whole shape of a wingbeat. */
      lift += (i === 0 ? w.beat * 0.86 : i === 1 ? w.beat * 0.34 + w.lag * 0.5 : w.lag * 0.82) * open;
      /** The hand swings forward over the top of the stroke and trails at the bottom. */
      sweep -= (i === 0 ? w.beat * 0.06 : w.lag * 0.22) * open;
      twist += w.twist * (0.6 + i * 0.5) + (i === 2 ? w.lag * 0.3 : 0) * open;
      /** Clamped in, it is tighter than merely folded: swept further back and pulled down onto the flank. */
      sweep += w.clamp * 0.13 * shut;
      sweep += guard * 0.1;
      lift -= guard * 0.055;
      lift -= w.clamp * 0.07;
      twist += w.clamp * 0.1 * shut;
      lift += raise * (i === 0 ? 1 : 0.35) + w.shake * (0.3 + i * 0.12) * (1 - guard * 0.85);
      twist += w.shake * 0.35;
      /** The right wing is the left one seen in a mirror: the roll survives it, the sweep and the elevation turn over. */
      euler.set(twist, sweep * side, lift * side);
      aim[i].setFromEuler(euler);
      if (i === 0) n[bones[0]].quaternion.copy(aim[0]);
      else n[bones[i]].quaternion.copy(local.copy(aim[i - 1]).invert().multiply(aim[i]));
    }
  }
}

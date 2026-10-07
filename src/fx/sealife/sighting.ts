import type * as THREE from 'three';
import { tuning } from '../../tuning';

/**
 * Where the whale comes up far off ahead of a boat at `boat` heading `yaw`, on its starboard bow when `side` is 1:
 * where a 14 m whale once came up, as many times further off as it is dreamt bigger. It swims on along `yaw - 0.3 * side`.
 */
export function whaleSighting(boat: THREE.Vector3, yaw: number, side: number, out: THREE.Vector3): THREE.Vector3 {
  const far = tuning.netWhale.farOff;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return out.set(boat.x + (fx * 58 - fz * 17 * side) * far, 0, boat.z + (fz * 58 + fx * 17 * side) * far);
}

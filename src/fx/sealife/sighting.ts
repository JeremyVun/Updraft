import type * as THREE from 'three';
import { tuning } from '../../tuning';

const K = tuning.netWhale;

/**
 * Where the whale comes up far off ahead of a boat at `boat` heading `yaw`, on its starboard bow when `side` is 1;
 * it swims on along `sightingHeading`.
 */
export function whaleSighting(boat: THREE.Vector3, yaw: number, side: number, out: THREE.Vector3): THREE.Vector3 {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return out.set(boat.x + fx * K.sightAhead - fz * K.sightAside * side, 0, boat.z + fz * K.sightAhead + fx * K.sightAside * side);
}

export function sightingHeading(yaw: number, side: number): number {
  return yaw - K.sightTurn * side;
}

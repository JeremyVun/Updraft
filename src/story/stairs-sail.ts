import * as THREE from 'three';
import type { Shot } from '../camera';

/** Where the lens is on the way over the cloud, relative to the boat and the way it is going. */
export interface Framing {
  /** How far the boat has come when this framing is reached, metres. */
  at: number;
  /** Where the lens stands: its bearing off the bow round to port (radians), how far off and how high over the hull. */
  bearing: number;
  distance: number;
  height: number;
  /** Where it looks: how far ahead of the child, and how high over them. */
  ahead: number;
  up: number;
  zoom: number;
  /** How far through the move to this framing the look waits before it goes after the new one, 0 to 1. */
  lookLag?: number;
}

/**
 * The lens over the cloud, by how far the boat has come. It goes once round the boat, from the starboard bow across
 * to port and on round astern, and never back: from ahead of them, looking back at the stair they are leaving, in to
 * their faces, up and away astern until they are small on the cloud under the sun, and down behind them as the bank
 * of mist comes up ahead. Between two framings it moves on one slow, even curve; two alike are a hold.
 */
export const SAIL_SHOTS: readonly Framing[] = [
  // Off the landing: ahead and to starboard, looking back past them at the stair standing out of the cloud.
  { at: 0, bearing: -0.55, distance: 10, height: 2.6, ahead: -3, up: 1.3, zoom: 1 },
  { at: 26, bearing: -0.55, distance: 14, height: 3.6, ahead: -5, up: 1.5, zoom: 1 },
  // Across the bow, in close: their faces in the lantern light and the last of the sun.
  { at: 52, bearing: 0.38, distance: 6.5, height: 1.2, ahead: 0, up: 1.1, zoom: 1.4 },
  { at: 95, bearing: 0.42, distance: 6.6, height: 1.2, ahead: 0, up: 1.1, zoom: 1.4 },
  // Up and away astern to port, still on them until it is well back: the boat small on the sea of cloud, the sun
  // low ahead over the bank of mist and the kite going before them.
  { at: 195, bearing: 2.3, distance: 48, height: 15, ahead: 36, up: 7.5, zoom: 1, lookLag: 0.4 },
  { at: 215, bearing: 2.33, distance: 48, height: 15, ahead: 36, up: 7.5, zoom: 1 },
  // Down behind them as the bank comes up ahead and the sun goes down into it.
  { at: 255, bearing: 2.78, distance: 14, height: 3.4, ahead: 12, up: 3, zoom: 1 },
  { at: 272, bearing: 2.82, distance: 12.5, height: 3.4, ahead: 12, up: 2.2, zoom: 1 },
  // After them into the white, level.
  { at: 300, bearing: 2.88, distance: 12, height: 3.4, ahead: 8, up: 1.6, zoom: 1 },
];

/** On the sea, as the white thins: back and up to where the drowned village's own lens takes them. */
export const OUT_OF_THE_WHITE: Framing = { at: 0, bearing: Math.PI - 0.12, distance: 21.5, height: 6.2, ahead: 1.3, up: 0.9, zoom: 1 };

const PLACE = ['bearing', 'distance', 'height', 'zoom'] as const;
const LOOK = ['ahead', 'up'] as const;

export function blend(a: Framing, b: Framing, k: number, out: Framing): Framing {
  for (const key of PLACE) out[key] = THREE.MathUtils.lerp(a[key], b[key], k);
  const look = b.lookLag ? THREE.MathUtils.smootherstep(k, b.lookLag, 1) : k;
  for (const key of LOOK) out[key] = THREE.MathUtils.lerp(a[key], b[key], look);
  return out;
}

/** The framing when the boat has come this far. */
export function framingAt(sailed: number, out: Framing): Framing {
  let i = 0;
  while (i < SAIL_SHOTS.length - 1 && sailed > SAIL_SHOTS[i + 1].at) i++;
  const a = SAIL_SHOTS[i], b = SAIL_SHOTS[Math.min(i + 1, SAIL_SHOTS.length - 1)];
  return blend(a, b, a === b ? 0 : THREE.MathUtils.smootherstep(sailed, a.at, b.at), out);
}

/**
 * Puts a framing into a shot: the eye placed off the hull, carried along with it, looking at a point by the child.
 * `yaw` is the way reckoned as ahead.
 */
export function frameVoyage(s: Shot, f: Framing, hull: THREE.Vector3, child: THREE.Vector3, yaw: number, eye: THREE.Vector3): void {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const px = Math.cos(yaw), pz = -Math.sin(yaw);
  const c = Math.cos(f.bearing), n = Math.sin(f.bearing);
  eye.set(hull.x + (fx * c + px * n) * f.distance, hull.y + f.height, hull.z + (fz * c + pz * n) * f.distance);
  s.eye = eye;
  s.target.set(child.x + fx * f.ahead, child.y + f.up, child.z + fz * f.ahead);
  s.zoom = f.zoom;
  s.carry = true;
  s.carryAnchor = hull;
}

import type * as THREE from 'three';

/**
 * One move of the cat's own way over a piece, for the room to play with the cat it has: a run along points, a small
 * hop, or a real leap; what it stands on there (`floor`, by default a level surface through the point). A hop or leap
 * onto something that moves gives its point in that thing's space (`frame`), and the cat rides it once down, upright
 * in the world if it tips (`upright`). A move with `when` waits until that holds. The piece knows its way; the room
 * drives the cat through it and tells the piece where the cat is and when it is over.
 */
export type CatStep = (
  | { run: THREE.Vector3[]; narrow?: boolean }
  | { hop: THREE.Vector3 }
  | { leap: THREE.Vector3 }
) & { floor?: (x: number, z: number) => number; frame?: THREE.Object3D; upright?: boolean; yaw?: number; when?: () => boolean; gather?: number };

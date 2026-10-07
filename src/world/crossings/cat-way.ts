import type * as THREE from 'three';

/**
 * One move of the cat's own way over a piece, for the room to play with the cat it has: a run along points (on a
 * narrow way, with its own floor under the points), a small hop, or a real leap. The piece knows its way; the room
 * drives the cat through it and tells the piece where the cat is and when it is over.
 */
export type CatStep =
  | { run: THREE.Vector3[]; narrow?: boolean; floor?: (x: number, z: number) => number }
  | { hop: THREE.Vector3 }
  | { leap: THREE.Vector3 };

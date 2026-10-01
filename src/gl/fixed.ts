import type * as THREE from 'three';

/**
 * For scenery that nothing moves, turns, rescales or reparents once placed: its matrix is composed now and never
 * again, and under a fixed parent its world matrix is not recomputed on every render. Only the objects passed are
 * fixed; their children keep their own setting. `tools/fixed-matrices-check.mjs` checks every fixed object.
 */
export function fixInPlace(...objects: THREE.Object3D[]): void {
  for (const o of objects) {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
    o.userData.fixed = true;
  }
}

/** `fixInPlace` for a whole subtree. */
export function fixTreeInPlace(root: THREE.Object3D): void {
  root.traverse((o) => fixInPlace(o));
}

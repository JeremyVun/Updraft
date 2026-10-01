import * as THREE from 'three';

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

/**
 * One geometry for pieces placed by translation alone. Each vertex is the float32 sum `modelMatrix * position` gave
 * on the GPU, so merged they draw exactly as they did apart.
 */
export function mergeTranslated(pieces: readonly { geometry: THREE.BufferGeometry; x: number; y: number; z: number }[]): THREE.BufferGeometry {
  const names = Object.keys(pieces[0].geometry.attributes);
  const vertices = pieces.reduce((n, p) => n + p.geometry.attributes.position.count, 0);
  const arrays = names.map((n) => new Float32Array(vertices * pieces[0].geometry.attributes[n].itemSize));
  const index: number[] = [];
  let base = 0;
  for (const { geometry, x, y, z } of pieces) {
    const offset = [Math.fround(x), Math.fround(y), Math.fround(z)];
    names.forEach((n, k) => {
      const a = geometry.attributes[n] as THREE.BufferAttribute;
      const size = a.itemSize;
      for (let i = 0; i < a.count * size; i++) {
        arrays[k][base * size + i] = n === 'position' ? Math.fround(a.array[i] + offset[i % 3]) : a.array[i];
      }
    });
    for (const i of geometry.index!.array) index.push(base + i);
    base += geometry.attributes.position.count;
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  names.forEach((n, k) => merged.setAttribute(n, new THREE.BufferAttribute(arrays[k], pieces[0].geometry.attributes[n].itemSize)));
  merged.setIndex(index);
  return merged;
}

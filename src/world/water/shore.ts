import * as THREE from 'three';
import { DOMAIN, heightAt } from '../island';

const RES = 512;
const FAR = 60;

/** Squared distance transform along one line (Felzenszwalb and Huttenlocher). */
function transformLine(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Distance in cells from every cell to the nearest cell where `inside` holds. */
function distanceTo(inside: Uint8Array): Float64Array {
  const grid = new Float64Array(RES * RES);
  for (let i = 0; i < grid.length; i++) grid[i] = inside[i] ? 0 : 1e12;
  const f = new Float64Array(RES);
  const d = new Float64Array(RES);
  const v = new Int32Array(RES);
  const z = new Float64Array(RES + 1);
  for (let x = 0; x < RES; x++) {
    for (let y = 0; y < RES; y++) f[y] = grid[y * RES + x];
    transformLine(f, RES, d, v, z);
    for (let y = 0; y < RES; y++) grid[y * RES + x] = d[y];
  }
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) f[x] = grid[y * RES + x];
    transformLine(f, RES, d, v, z);
    for (let x = 0; x < RES; x++) grid[y * RES + x] = d[x];
  }
  for (let i = 0; i < grid.length; i++) grid[i] = Math.sqrt(grid[i]);
  return grid;
}

/**
 * Signed horizontal distance to the waterline in world units over the height texture's domain: positive on land,
 * negative at sea. Swash reach and breaker spacing are measured with it, so bumps in the beach do not trap water.
 */
export function bakeShoreDistance(): THREE.DataTexture {
  const cell = DOMAIN.size / RES;
  const heights = new Float32Array(RES * RES);
  const land = new Uint8Array(RES * RES);
  const sea = new Uint8Array(RES * RES);
  for (let j = 0; j < RES; j++) {
    const z = DOMAIN.min + (j + 0.5) * cell;
    for (let i = 0; i < RES; i++) {
      const h = heightAt(DOMAIN.min + (i + 0.5) * cell, z);
      heights[j * RES + i] = h;
      land[j * RES + i] = h > 0 ? 1 : 0;
      sea[j * RES + i] = h > 0 ? 0 : 1;
    }
  }
  const toSea = distanceTo(sea);
  const toLand = distanceTo(land);
  const data = new Uint16Array(RES * RES);
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const k = j * RES + i;
      const h = heights[k];
      let sd = (land[k] ? toSea[k] - 0.5 : 0.5 - toLand[k]) * cell;
      if (Math.abs(sd) < cell * 2.5) {
        const hx = (heights[j * RES + Math.min(RES - 1, i + 1)] - heights[j * RES + Math.max(0, i - 1)]) / (2 * cell);
        const hz = (heights[Math.min(RES - 1, j + 1) * RES + i] - heights[Math.max(0, j - 1) * RES + i]) / (2 * cell);
        const local = h / Math.max(Math.hypot(hx, hz), 0.05);
        sd = THREE.MathUtils.lerp(local, sd, Math.abs(sd) / (cell * 2.5));
      }
      data[k] = THREE.DataUtils.toHalfFloat(THREE.MathUtils.clamp(sd, -FAR, FAR));
    }
  }
  const tex = new THREE.DataTexture(data, RES, RES, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

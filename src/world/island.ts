import { GRASS_LINE, worldHeight } from './heightfield';

export { GRASS_LINE };

interface HeightGrid {
  data: Float32Array;
  minX: number;
  minZ: number;
  size: number;
  res: number;
  /** Floats per texel in `data`; the height is the first. */
  stride: number;
}

let grid: HeightGrid | null = null;

/** Installs a CPU copy of the GPU height bake; lookups inside it are then a bilinear read instead of noise. */
export function setHeightGrid(next: HeightGrid): void {
  grid = next;
}

/** Terrain height at a world position (the seabed where it is below 0). */
export function heightAt(x: number, z: number): number {
  const g = grid;
  if (g) {
    const fx = ((x - g.minX) / g.size) * g.res - 0.5;
    const fz = ((z - g.minZ) / g.size) * g.res - 0.5;
    if (fx >= 0 && fz >= 0 && fx < g.res - 1 && fz < g.res - 1) {
      const x0 = Math.floor(fx);
      const z0 = Math.floor(fz);
      const tx = fx - x0;
      const tz = fz - z0;
      const s = g.stride;
      const i = (z0 * g.res + x0) * s;
      const d = g.data;
      const a = d[i] + (d[i + s] - d[i]) * tx;
      const b = d[i + g.res * s] + (d[i + g.res * s + s] - d[i + g.res * s]) * tx;
      return a + (b - a) * tz;
    }
  }
  return worldHeight(x, z);
}

export function slopeAt(x: number, z: number): number {
  const e = 0.7;
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}

/** Height of the surface something can rest on: land, or the sea at y = 0. */
export function surfaceHeight(x: number, z: number): number {
  return Math.max(heightAt(x, z), 0);
}

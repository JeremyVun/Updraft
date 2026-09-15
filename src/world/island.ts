import * as THREE from 'three';
import { createNoise2D, fbm, smoothstep } from './noise';

/** Square region of the XZ plane covered by the wind simulation, heightmap and terrain mesh. */
export const DOMAIN = { min: -160, size: 320 } as const;

/** Grass grows above this height; below it is beach. */
export const GRASS_LINE = 1.15;

const coastNoise = createNoise2D(7);
const hillNoise = createNoise2D(19);
const duneNoise = createNoise2D(31);

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Approximate signed distance to the coastline in world units, negative on land. */
function coastDistance(x: number, z: number): number {
  const n = fbm(coastNoise, x * 0.016, z * 0.016, 3);
  const ex = (x + 6) / 60;
  const ez = (z + 14) / 44;
  let d = (Math.hypot(ex, ez) - 1 - n * 0.22) * 48;
  const cove = Math.hypot((x - 16) * 0.8, z - 34) - 14 + n * 6;
  d = -smin(-d, cove, 12);
  const islet = Math.hypot(x - 62, (z - 30) * 1.2) - 8 - n * 5;
  return smin(d, islet, 5);
}

export function islandHeight(x: number, z: number): number {
  const d = coastDistance(x, z);
  const land = smoothstep(10, -14, d);
  let h = land * 2.7 - 1.5;
  const hills = fbm(hillNoise, x * 0.02, z * 0.02, 3) * 0.5 + 0.5;
  const ridge = Math.exp(-((x + 16) ** 2 + (z + 34) ** 2) / (2 * 20 ** 2));
  const knoll = Math.exp(-((x - 26) ** 2 + (z + 6) ** 2) / (2 * 12 ** 2));
  h += land * land * (hills ** 1.7 * 7 + ridge * 13 + knoll * 4.5);
  h += land * (1 - land) * 1.2 * (fbm(duneNoise, x * 0.06, z * 0.06, 2) * 0.5 + 0.5);
  h -= smoothstep(0, 55, d) * 7.5;
  return h;
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

const HM_RES = 512;
let grid: Float32Array | null = null;

function heightGrid(): Float32Array {
  if (grid) return grid;
  grid = new Float32Array(HM_RES * HM_RES);
  for (let j = 0; j < HM_RES; j++) {
    const z = DOMAIN.min + ((j + 0.5) / HM_RES) * DOMAIN.size;
    for (let i = 0; i < HM_RES; i++) {
      const x = DOMAIN.min + ((i + 0.5) / HM_RES) * DOMAIN.size;
      grid[j * HM_RES + i] = islandHeight(x, z);
    }
  }
  return grid;
}

/** Fast bilinear lookup of the baked heightmap; matches what the GPU samples from the height texture. */
export function heightAt(x: number, z: number): number {
  const g = heightGrid();
  const fx = ((x - DOMAIN.min) / DOMAIN.size) * HM_RES - 0.5;
  const fz = ((z - DOMAIN.min) / DOMAIN.size) * HM_RES - 0.5;
  if (fx < 0 || fz < 0 || fx > HM_RES - 1 || fz > HM_RES - 1) return -12;
  const x0 = Math.min(HM_RES - 2, Math.floor(fx));
  const z0 = Math.min(HM_RES - 2, Math.floor(fz));
  const tx = fx - x0;
  const tz = fz - z0;
  const i = z0 * HM_RES + x0;
  const a = g[i] + (g[i + 1] - g[i]) * tx;
  const b = g[i + HM_RES] + (g[i + HM_RES + 1] - g[i + HM_RES]) * tx;
  return a + (b - a) * tz;
}

export function makeHeightTexture(): THREE.DataTexture {
  const g = heightGrid();
  const data = new Uint16Array(HM_RES * HM_RES);
  for (let i = 0; i < data.length; i++) data[i] = THREE.DataUtils.toHalfFloat(g[i]);
  const tex = new THREE.DataTexture(data, HM_RES, HM_RES, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function makeTerrainGeometry(segments = 320): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(DOMAIN.size, DOMAIN.size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, islandHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  return geo;
}

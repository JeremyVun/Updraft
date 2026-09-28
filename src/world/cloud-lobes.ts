import * as THREE from 'three';

/**
 * The round lobes cumulus heaps up from, baked into two small tiling textures: height and its slope, soft mounds in
 * one and heads fuller at the top with tight creases in the other. One sample stands in for nine cells of hashes,
 * and the mipmaps give each octave already smoothed to however finely it is sampled, so far off the mesh carries
 * only what it can hold and nothing jumps as it is sampled afresh.
 */
const PERIOD = 16;
const TEXELS = 16;
const SIZE = PERIOD * TEXELS;

function fract(x: number): number {
  return x - Math.floor(x);
}

function hash12(x: number, y: number): number {
  let a = fract(x * 0.1031);
  let b = fract(y * 0.1031);
  let c = a;
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d;
  b += d;
  c += d;
  return fract((a + b) * c);
}

/** Round lobes on a jittered grid that repeats every PERIOD cells, run together where they meet: height, slope. */
function lobes(px: number, py: number, full: number, out: Float32Array, at: number): void {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  let sum = 0, sx = 0, sy = 0;
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    const cx = (((ix + x) % PERIOD) + PERIOD) % PERIOD, cy = (((iy + y) % PERIOD) + PERIOD) % PERIOD;
    const ox = x + hash12(cx, cy) * 0.9 + 0.05 - fx;
    const oy = y + hash12(cx + 17.3, cy + 17.3) * 0.9 + 0.05 - fy;
    const r = 0.4 + (0.6 + 0.3 * full) * hash12(cx + 41.7, cy + 41.7);
    const u = (ox * ox + oy * oy) / (r * r);
    // Some stand taller than their neighbours, so they heap up rather than lying in a quilt.
    const w = Math.exp(9 * (r * (1 - u) * (1 + full * u) + (0.4 + 0.4 * full) * hash12(cx + 63.1, cy + 63.1)));
    const k = (w / r) * (1 - full + 2 * full * u);
    sum += w;
    sx += k * ox;
    sy += k * oy;
  }
  out[at] = Math.log(sum) / 9 - 0.3 - 0.2 * full;
  out[at + 1] = (sx * 2) / sum;
  out[at + 2] = (sy * 2) / sum;
  out[at + 3] = 1;
}

function bake(full: number): Float32Array {
  const data = new Float32Array(SIZE * SIZE * 4);
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) lobes((i + 0.5) / TEXELS, (j + 0.5) / TEXELS, full, data, (j * SIZE + i) * 4);
  }
  return data;
}

function texture(data: Float32Array): THREE.DataTexture {
  const half = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  const tex = new THREE.DataTexture(half, SIZE, SIZE, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** The two bakes, soft (full 0) and full (full 1), on the CPU too, so a hull can ride on the same cloud. */
export class CloudLobes {
  readonly soft: Float32Array;
  readonly full: Float32Array;
  readonly softTexture: THREE.DataTexture;
  readonly fullTexture: THREE.DataTexture;

  constructor() {
    this.soft = bake(0);
    this.full = bake(1);
    this.softTexture = texture(this.soft);
    this.fullTexture = texture(this.full);
  }

  /** lobesT at the finest level: x height, yz slope, for a point in cells; `full` 0 to 1. */
  at(px: number, py: number, full: number, out: THREE.Vector3): THREE.Vector3 {
    const x = px * TEXELS - 0.5, y = py * TEXELS - 0.5;
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    out.set(0, 0, 0);
    for (let c = 0; c < 4; c++) {
      const dx = c & 1, dy = c >> 1;
      const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
      const tx = (((ix + dx) % SIZE) + SIZE) % SIZE, ty = (((iy + dy) % SIZE) + SIZE) % SIZE;
      const k = (ty * SIZE + tx) * 4;
      for (let e = 0; e < 3; e++) out.setComponent(e, out.getComponent(e) + w * (this.soft[k + e] + (this.full[k + e] - this.soft[k + e]) * full));
    }
    return out;
  }
}

/**
 * lobesT(p, full, lod): x height, yz slope (per cell) of the lobes at p (in cells), full 0 soft mounds to 1 full
 * heads. In the vertex stage `lod` picks how smoothed they are; in the fragment stage the screen footprint does.
 */
export const LOBES_TEXTURE_GLSL = /* glsl */ `
uniform sampler2D uLobesSoft;
uniform sampler2D uLobesFull;
#ifdef LOBES_VERTEX
#define LOBES_SAMPLE(t, uv, lod) textureLod(t, uv, lod)
#else
#define LOBES_SAMPLE(t, uv, lod) texture(t, uv)
#endif
vec3 lobesT(vec2 p, float full, float lod) {
  vec2 uv = p * ${(1 / PERIOD).toFixed(8)};
  vec3 a = LOBES_SAMPLE(uLobesSoft, uv, lod).xyz;
  if (full <= 0.0) return a;
  return mix(a, LOBES_SAMPLE(uLobesFull, uv, lod).xyz, full);
}
/** The level of the lobes' mipmaps to sample for an octave of cells this many metres across on a mesh this fine. */
float lobesLod(float spacing, float cell) {
  return max(0.0, log2(spacing * ${TEXELS.toFixed(1)} / cell) + 0.5);
}`;

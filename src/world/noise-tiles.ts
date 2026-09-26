import * as THREE from 'three';
import { params } from '../params';

/**
 * The fine ground noise as small tiling textures (perf-bakes item E): a sample in place of the hashes. The pattern is
 * like the procedural one, not the same one, and the mipmaps filter it where the procedural noise would alias.
 * R: one octave of value noise, `vnoise`, over NOISE_CELLS lattice cells. G: four octaves of it, `fbm`, over
 * FBM_CELLS base cells. `?noise=live` computes the noise in the shaders again, for comparison.
 */
const SIZE = 512;
const NOISE_CELLS = 128;
const FBM_CELLS = 32;
/** Patterns that several stages must agree on (the frost, the Wood's tint) sample this one level everywhere. */
const FIXED_LEVEL = 0;

function fract(x: number): number {
  return x - Math.floor(x);
}

/** `hash12` of NOISE_GLSL, in double precision. */
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

/** A lattice of `period`² values; `seed` gives each octave its own. */
function lattice(period: number, seed: number): Float32Array {
  const values = new Float32Array(period * period);
  for (let y = 0; y < period; y++) for (let x = 0; x < period; x++) values[y * period + x] = hash12(x + seed, y);
  return values;
}

/** Value noise over a lattice that repeats every `period` cells. */
function tilingNoise(values: Float32Array, period: number, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period;
  const y0 = ((iy % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = ((y0 + 1) % period) * period;
  const a = values[y0 * period + x0];
  const b = values[y0 * period + x1];
  const c = values[y1 + x0];
  const d = values[y1 + x1];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function bake(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 2);
  const noise = lattice(NOISE_CELLS, 0);
  const octaves = [0, 1, 2, 3].map(o => ({ period: FBM_CELLS << o, values: lattice(FBM_CELLS << o, 1000 * (o + 1)) }));
  const noiseTexel = NOISE_CELLS / SIZE;
  const fbmTexel = FBM_CELLS / SIZE;
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const k = (j * SIZE + i) * 2;
      data[k] = Math.round(tilingNoise(noise, NOISE_CELLS, (i + 0.5) * noiseTexel, (j + 0.5) * noiseTexel) * 255);
      // Octaves double on an unrotated lattice, so each is shifted off the one below or their corners would line up.
      let s = 0;
      let a = 0.5;
      for (let o = 0; o < 4; o++) {
        const f = 1 << o;
        s += a * tilingNoise(octaves[o].values, octaves[o].period, (i + 0.5) * fbmTexel * f + o * 0.37, (j + 0.5) * fbmTexel * f + o * 0.61);
        a *= 0.5;
      }
      data[k + 1] = Math.round((s / 0.9375) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export const noiseTileUniforms = {
  uNoiseTile: { value: null as THREE.DataTexture | null },
};

/** Builds the tile (about 10 ms of CPU on an M4 Pro); called once during world construction, before anything draws. */
export function bakeNoiseTiles(): void {
  noiseTileUniforms.uNoiseTile.value ??= bake();
}

/** Needs NOISE_GLSL first. Arguments are the procedural call's, plus the footprint of p where it is filtered. */
export const NOISE_TILES_GLSL = /* glsl */ `
#define NOISE_LIVE ${params.noise === 'live' ? 1 : 0}
uniform sampler2D uNoiseTile;
/** vnoise(p), filtered over p's screen footprint (dx, dy). */
float tiledNoise(vec2 p, vec2 dx, vec2 dy) {
#if NOISE_LIVE
  return vnoise(p);
#else
  const float k = ${(1 / NOISE_CELLS).toFixed(8)};
  return textureGrad(uNoiseTile, fract(p * k), dx * k, dy * k).r;
#endif
}
/** fbm(p), filtered over p's screen footprint (dx, dy). */
float tiledFbm(vec2 p, vec2 dx, vec2 dy) {
#if NOISE_LIVE
  return fbm(p);
#else
  const float k = ${(1 / FBM_CELLS).toFixed(8)};
  return textureGrad(uNoiseTile, fract(p * k), dx * k, dy * k).g;
#endif
}
/** fbm(p) at one level of the tile, the same in every stage and at every distance. */
float tiledFbmFixed(vec2 p) {
#if NOISE_LIVE
  return fbm(p);
#else
  return textureLod(uNoiseTile, fract(p * ${(1 / FBM_CELLS).toFixed(8)}), ${FIXED_LEVEL.toFixed(1)}).g;
#endif
}
`;

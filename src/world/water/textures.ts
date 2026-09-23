import * as THREE from 'three';
import { mulberry32 } from '../noise';

function tilingTexture(data: Uint8Array, res: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Tiling ripple slopes from a sum of waves with whole-number wave counts, so the texture wraps seamlessly.
 * rg: slope, b: squared slope. Mipmapping averages both, so b - |rg|² is the slope variance a texel hides.
 */
export function rippleTexture(res = 256): THREE.DataTexture {
  const rand = mulberry32(3);
  const waves: [number, number, number, number][] = [];
  while (waves.length < 64) {
    const kx = Math.round((rand() * 2 - 1) * 28);
    const ky = Math.round((rand() * 2 - 1) * 28);
    const k = Math.hypot(kx, ky);
    if (k < 3) continue;
    waves.push([kx, ky, 1 / Math.pow(k, 1.3), rand() * Math.PI * 2]);
  }
  const gx = new Float32Array(res * res);
  const gy = new Float32Array(res * res);
  // cos(x + y) reuses each row/column's phase instead of evaluating every wave at every texel.
  // Keep Float64 intermediates and the original wave summation order; packed texture bytes stay identical.
  const phases = waves.map(([kx, ky, amplitude, phase]) => {
    const cx = new Float64Array(res), sx = new Float64Array(res);
    const cy = new Float64Array(res), sy = new Float64Array(res);
    for (let i = 0; i < res; i++) {
      const x = 2 * Math.PI * kx * (i / res) + phase;
      const y = 2 * Math.PI * ky * (i / res);
      cx[i] = Math.cos(x); sx[i] = Math.sin(x);
      cy[i] = Math.cos(y); sy[i] = Math.sin(y);
    }
    return { kx, ky, amplitude, cx, sx, cy, sy };
  });
  let max = 0;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      let dx = 0;
      let dy = 0;
      for (const wave of phases) {
        const c = (wave.cx[i] * wave.cy[j] - wave.sx[i] * wave.sy[j]) * wave.amplitude;
        dx += c * wave.kx;
        dy += c * wave.ky;
      }
      gx[j * res + i] = dx;
      gy[j * res + i] = dy;
      max = Math.max(max, Math.abs(dx), Math.abs(dy));
    }
  }
  const data = new Uint8Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    const x = gx[i] / max;
    const y = gy[i] / max;
    data[i * 4] = Math.round(x * 127.5 + 127.5);
    data[i * 4 + 1] = Math.round(y * 127.5 + 127.5);
    data[i * 4 + 2] = Math.round(Math.min(1, x * x + y * y) * 255);
    data[i * 4 + 3] = 255;
  }
  return tilingTexture(data, res);
}

/** Distance to the nearest cell border of a wrapping Worley pattern (F2 - F1), in cell units. */
function cellBorders(res: number, cells: number, seed: number): Float32Array {
  const rand = mulberry32(seed);
  const points = new Float32Array(cells * cells * 2);
  for (let i = 0; i < points.length; i++) points[i] = rand();
  const out = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = (i / res) * cells;
      const y = (j / res) * cells;
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      let f1 = 81;
      let f2 = 81;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = cx + ox;
          const ny = cy + oy;
          const k = (((ny % cells) + cells) % cells) * cells + (((nx % cells) + cells) % cells);
          const dx = nx + points[k * 2] - x, dy = ny + points[k * 2 + 1] - y;
          const d = dx * dx + dy * dy;
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) {
            f2 = d;
          }
        }
      }
      // Ranking squared distances needs only the two winning square roots per texel.
      out[j * res + i] = Math.sqrt(f2) - Math.sqrt(f1);
    }
  }
  return out;
}

/**
 * Tiling foam and caustic patterns, stored as distance-like fields so thresholds stay crisp when magnified.
 * r: foam lace (1 on the strands between bubbles), g: caustic web (1 on the bright lines), b: soft noise.
 */
export function laceTexture(res = 256): THREE.DataTexture {
  const coarse = cellBorders(res, 9, 21);
  const fine = cellBorders(res, 23, 22);
  const web = cellBorders(res, 7, 23);
  const soft = cellBorders(res, 4, 24);
  const data = new Uint8Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    const lace = Math.max(1 - coarse[i] / 0.55, (1 - fine[i] / 0.5) * 0.8);
    data[i * 4] = Math.round(Math.max(0, lace) * 255);
    data[i * 4 + 1] = Math.round(Math.max(0, 1 - web[i] / 0.6) * 255);
    data[i * 4 + 2] = Math.round(Math.min(1, soft[i] / 0.7) * 255);
    data[i * 4 + 3] = 255;
  }
  return tilingTexture(data, res);
}

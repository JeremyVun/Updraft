/**
 * The terrain height of the whole world, written twice: in TypeScript for gameplay and in GLSL for baking and
 * drawing. Both use the same integer-hashed gradient noise, so they agree to within float rounding.
 * Keep the two versions in step; `tools/play.mjs` runs with `?shot` report the largest gap as `heightParity`.
 */

const HASH_OFFSET = 1 << 20;

function pcg(v: number): number {
  const state = (Math.imul(v, 747796405) + 2891336453) >>> 0;
  const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}

function hash2(ix: number, iy: number): number {
  return pcg((ix + HASH_OFFSET + pcg(iy + HASH_OFFSET)) >>> 0);
}

function gradDot(h: number, x: number, y: number): number {
  const k = h & 7;
  if (k < 4) return ((k & 1) === 0 ? x : -x) + ((k & 2) === 0 ? y : -y);
  if (k === 4) return x;
  if (k === 5) return -x;
  if (k === 6) return y;
  return -y;
}

/** Gradient noise in roughly [-1, 1]. */
export function gnoise(x: number, y: number): number {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const ix = fx | 0;
  const iy = fy | 0;
  const tx = x - fx;
  const ty = y - fy;
  const ux = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
  const uy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
  const a = gradDot(hash2(ix, iy), tx, ty);
  const b = gradDot(hash2(ix + 1, iy), tx - 1, ty);
  const c = gradDot(hash2(ix, iy + 1), tx, ty - 1);
  const d = gradDot(hash2(ix + 1, iy + 1), tx - 1, ty - 1);
  const ab = a + (b - a) * ux;
  const cd = c + (d - c) * ux;
  return (ab + (cd - ab) * uy) * 1.4;
}

export function gfbm(x: number, y: number, octaves: number, seed: number): number {
  x += seed * 37.13;
  y -= seed * 71.37;
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * gnoise(x, y);
    norm += amp;
    const nx = 1.6 * x - 1.2 * y;
    y = 1.2 * x + 1.6 * y;
    x = nx;
    amp *= 0.5;
  }
  return sum / norm;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

/** Grass grows above this height; below it is beach. */
export const GRASS_LINE = 1.15;

/** Approximate signed distance to the still island's coast in world units, negative on land. */
function islandCoast(x: number, z: number): number {
  const n = gfbm(x * 0.016, z * 0.016, 3, 1);
  const ex = (x + 6) / 60;
  const ez = (z + 14) / 44;
  let d = (Math.hypot(ex, ez) - 1 - n * 0.22) * 48;
  const cove = Math.hypot((x - 16) * 0.8, z - 34) - 14 + n * 6;
  d = -smin(-d, cove, 12);
  const islet = Math.hypot(x - 62, (z - 30) * 1.2) - 8 - n * 5;
  return smin(d, islet, 5);
}

function islandHeight(x: number, z: number): number {
  const d = islandCoast(x, z);
  const land = smoothstep(10, -14, d);
  let h = land * 2.7 - 1.5;
  const hills = gfbm(x * 0.02, z * 0.02, 3, 2) * 0.5 + 0.5;
  const ridge = Math.exp(-((x + 16) ** 2 + (z + 34) ** 2) / (2 * 20 ** 2));
  const knoll = Math.exp(-((x - 26) ** 2 + (z + 6) ** 2) / (2 * 12 ** 2));
  h += land * land * (Math.max(hills, 0) ** 1.7 * 7 + ridge * 13 + knoll * 4.5);
  h += land * (1 - land) * 1.2 * (gfbm(x * 0.06, z * 0.06, 2, 3) * 0.5 + 0.5);
  h -= smoothstep(0, 55, d) * 7.5;
  return h;
}

/** Where the mainland meets the sea: a wandering east-west line, land to the north (−z). */
export function mainlandCoastZ(x: number): number {
  return -700 + 46 * gfbm(x * 0.0032, 0.5, 2, 11) + 14 * gnoise(x * 0.012, 3.3);
}

/** The endless green hills: a beach or low cliffs at the coast, then broad rolling pasture rising inland. */
function mainlandHeight(x: number, z: number): number {
  const inland = mainlandCoastZ(x) - z;
  const land = smoothstep(-12, 16, inland);
  let h = land * 4.8 - 1.6;
  const cliffs = smoothstep(0.0, 0.3, gfbm(x * 0.006, 7.7, 2, 12));
  h += cliffs * smoothstep(-3, 7, inland) * 8;
  const rise = smoothstep(10, 260, inland);
  const broad = gfbm(x * 0.0042, z * 0.0042, 3, 13);
  const mid = gfbm(x * 0.012, z * 0.012, 3, 14);
  const swell = Math.max(0, 16 + 26 * broad + 7 * mid);
  const lastHill = 52 * Math.exp(-((x - 20) ** 2 + (z + 1520) ** 2) / (2 * 150 ** 2));
  h += land * (rise * swell + lastHill);
  h -= smoothstep(0, 70, -inland) * 8;
  return h;
}

export function worldHeight(x: number, z: number): number {
  return smax(islandHeight(x, z), mainlandHeight(x, z), 4);
}

export const HEIGHTFIELD_GLSL = /* glsl */ `
uint hf_pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uint hf_hash2(ivec2 i) {
  uvec2 u = uvec2(i + ivec2(${HASH_OFFSET}));
  return hf_pcg(u.x + hf_pcg(u.y));
}
float hf_gradDot(uint h, vec2 v) {
  uint k = h & 7u;
  if (k < 4u) return ((k & 1u) == 0u ? v.x : -v.x) + ((k & 2u) == 0u ? v.y : -v.y);
  if (k == 4u) return v.x;
  if (k == 5u) return -v.x;
  if (k == 6u) return v.y;
  return -v.y;
}
float gnoise(vec2 p) {
  vec2 fl = floor(p);
  ivec2 i = ivec2(fl);
  vec2 t = p - fl;
  vec2 u = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  float a = hf_gradDot(hf_hash2(i), t);
  float b = hf_gradDot(hf_hash2(i + ivec2(1, 0)), t - vec2(1.0, 0.0));
  float c = hf_gradDot(hf_hash2(i + ivec2(0, 1)), t - vec2(0.0, 1.0));
  float d = hf_gradDot(hf_hash2(i + ivec2(1, 1)), t - vec2(1.0, 1.0));
  float ab = a + (b - a) * u.x;
  float cd = c + (d - c) * u.x;
  return (ab + (cd - ab) * u.y) * 1.4;
}
float gfbm(vec2 p, int octaves, float seed) {
  p += vec2(seed * 37.13, -seed * 71.37);
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int o = 0; o < 6; o++) {
    if (o >= octaves) break;
    sum += amp * gnoise(p);
    norm += amp;
    p = vec2(1.6 * p.x - 1.2 * p.y, 1.2 * p.x + 1.6 * p.y);
    amp *= 0.5;
  }
  return sum / norm;
}
float hf_smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float hf_smax(float a, float b, float k) {
  return -hf_smin(-a, -b, k);
}
float hf_islandCoast(vec2 p) {
  float n = gfbm(p * 0.016, 3, 1.0);
  float ex = (p.x + 6.0) / 60.0;
  float ez = (p.y + 14.0) / 44.0;
  float d = (length(vec2(ex, ez)) - 1.0 - n * 0.22) * 48.0;
  float cove = length(vec2((p.x - 16.0) * 0.8, p.y - 34.0)) - 14.0 + n * 6.0;
  d = -hf_smin(-d, cove, 12.0);
  float islet = length(vec2(p.x - 62.0, (p.y - 30.0) * 1.2)) - 8.0 - n * 5.0;
  return hf_smin(d, islet, 5.0);
}
float hf_island(vec2 p) {
  float d = hf_islandCoast(p);
  float land = smoothstep(10.0, -14.0, d);
  float h = land * 2.7 - 1.5;
  float hills = gfbm(p * 0.02, 3, 2.0) * 0.5 + 0.5;
  float ridge = exp(-(pow(p.x + 16.0, 2.0) + pow(p.y + 34.0, 2.0)) / (2.0 * 400.0));
  float knoll = exp(-(pow(p.x - 26.0, 2.0) + pow(p.y + 6.0, 2.0)) / (2.0 * 144.0));
  h += land * land * (pow(max(hills, 0.0), 1.7) * 7.0 + ridge * 13.0 + knoll * 4.5);
  h += land * (1.0 - land) * 1.2 * (gfbm(p * 0.06, 2, 3.0) * 0.5 + 0.5);
  h -= smoothstep(0.0, 55.0, d) * 7.5;
  return h;
}
float mainlandCoastZ(float x) {
  return -700.0 + 46.0 * gfbm(vec2(x * 0.0032, 0.5), 2, 11.0) + 14.0 * gnoise(vec2(x * 0.012, 3.3));
}
float hf_mainland(vec2 p) {
  float inland = mainlandCoastZ(p.x) - p.y;
  float land = smoothstep(-12.0, 16.0, inland);
  float h = land * 4.8 - 1.6;
  float cliffs = smoothstep(0.0, 0.3, gfbm(vec2(p.x * 0.006, 7.7), 2, 12.0));
  h += cliffs * smoothstep(-3.0, 7.0, inland) * 8.0;
  float rise = smoothstep(10.0, 260.0, inland);
  float broad = gfbm(p * 0.0042, 3, 13.0);
  float mid = gfbm(p * 0.012, 3, 14.0);
  float swell = max(0.0, 16.0 + 26.0 * broad + 7.0 * mid);
  float lastHill = 52.0 * exp(-(pow(p.x - 20.0, 2.0) + pow(p.y + 1520.0, 2.0)) / (2.0 * 22500.0));
  h += land * (rise * swell + lastHill);
  h -= smoothstep(0.0, 70.0, -inland) * 8.0;
  return h;
}
float worldHeight(vec2 p) {
  return hf_smax(hf_island(p), hf_mainland(p), 4.0);
}
`;

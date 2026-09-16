/**
 * The terrain height of the whole world, written twice: in TypeScript for gameplay and in GLSL for baking and
 * drawing. Both use the same integer-hashed gradient noise, so they agree to within float rounding.
 * Keep the two versions in step; `tools/play.mjs` runs with `?shot` report the largest gap as `heightParity`.
 */

const HASH_OFFSET = 1 << 20;

export function pcg(v: number): number {
  const state = (Math.imul(v, 747796405) + 2891336453) >>> 0;
  const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}

export function hash2(ix: number, iy: number): number {
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

/**
 * The chain of islands. Each lies further north than the last with a stretch of sea between, and the stretches
 * shrink as home gets nearer, so the world closes in. The still island keeps its own shape; the rest are ellipses.
 */
export const ISLES = {
  lines: { x: 14, z: -360, rx: 70, rz: 56 },
  meadow: { x: 10, z: -880, rx: 340, rz: 300 },
  drowned: { x: -10, z: -1440, rx: 210, rz: 175 },
  wood: { x: -30, z: -1800, rx: 130, rz: 115 },
  home: { x: -45, z: -2120, rx: 190, rz: 165 },
} as const;

type Isle = (typeof ISLES)[keyof typeof ISLES];

/** Roughly how far outside an island's coast a point lies, in world units; negative on land. */
function isleCoast(x: number, z: number, c: Isle, wobble: number, seed: number): number {
  const n = gfbm(x / (c.rx * 0.9), z / (c.rz * 0.9), 3, seed);
  const ex = (x - c.x) / c.rx;
  const ez = (z - c.z) / c.rz;
  return (Math.hypot(ex, ez) - 1 - n * wobble) * Math.min(c.rx, c.rz) * 0.8;
}

/** The island of lines: a low green whaleback, small enough that the washing on it is the whole room. */
function linesHeight(x: number, z: number): number {
  const c = ISLES.lines;
  const d = isleCoast(x, z, c, 0.16, 21);
  const land = smoothstep(10, -30, d);
  const r = Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz);
  let h = land * 3.2 - 1.4;
  h += land * land * (Math.max(0, 1 - r * r) * 12 + (gfbm(x * 0.022, z * 0.022, 3, 22) * 0.5 + 0.5) * 5);
  return h - smoothstep(0, 40, d) * 8;
}

/** The meadow: the broad rolling pasture, now bounded by its own coast on every side. */
function meadowHeight(x: number, z: number): number {
  const inland = -isleCoast(x, z, ISLES.meadow, 0.08, 11);
  const land = smoothstep(-12, 16, inland);
  let h = land * 4.8 - 1.6;
  const cliffs = smoothstep(0, 0.3, gfbm(x * 0.006, 7.7, 2, 12));
  h += cliffs * smoothstep(-3, 7, inland) * 8;
  const rise = smoothstep(10, 260, inland);
  const broad = gfbm(x * 0.0042, z * 0.0042, 3, 13);
  const mid = gfbm(x * 0.012, z * 0.012, 3, 14);
  h += land * rise * Math.max(0, 16 + 26 * broad + 7 * mid);
  return h - smoothstep(0, 70, -inland) * 8;
}

/**
 * The drowned village: mud banks well under the water it is sailed across. It is deep on purpose — the sea shader
 * paints a sandy bed and caustics wherever it can see the bottom, and a drowned village over turquoise shallows
 * reads as a holiday. The banks only come near enough the surface to ghost the water paler in a few places.
 */
function drownedHeight(x: number, z: number): number {
  const d = isleCoast(x, z, ISLES.drowned, 0.14, 31);
  const land = smoothstep(20, -30, d);
  const lumps = gfbm(x * 0.013, z * 0.013, 3, 32);
  return land * (0.5 + lumps * 2.3) - 6.5 - smoothstep(0, 80, d) * 2;
}

/**
 * The dark wood: small, steep and close, the least room of any island. Its coast shelves out a long way, because
 * the first version came out of the sea as a cliff and a child in the dark could not get off the boat.
 */
function woodHeight(x: number, z: number): number {
  const c = ISLES.wood;
  const d = isleCoast(x, z, c, 0.2, 41);
  const land = smoothstep(16, -38, d);
  const r = Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz);
  let h = land * 2.6 - 1.5;
  h += land * land * (Math.max(0, 1 - r * r) * 22 + (gfbm(x * 0.03, z * 0.03, 3, 42) * 0.5 + 0.5) * 5);
  return h - smoothstep(0, 60, d) * 7;
}

/** The top of the last hill, where the journey ends. */
export const LAST_HILL = { x: -30, z: -2060 } as const;

/** Home: one long hill to come over, with the cottage in the valley beyond it. */
function homeHeight(x: number, z: number): number {
  const d = isleCoast(x, z, ISLES.home, 0.1, 51);
  const land = smoothstep(10, -22, d);
  let h = land * 4 - 1.6;
  h += land * land * (14 + gfbm(x * 0.006, z * 0.006, 3, 52) * 12);
  const r2 = (x - LAST_HILL.x) ** 2 + (z - LAST_HILL.z) ** 2;
  h += land * (34 * Math.exp(-r2 / (2 * 58 ** 2)) + 18 * Math.exp(-r2 / (2 * 170 ** 2)));
  return h - smoothstep(0, 70, d) * 8;
}

/** The meadow's south coast, where the boat comes ashore: kept as a function of x for the story and the camera. */
export function mainlandCoastZ(x: number): number {
  const c = ISLES.meadow;
  const ex = Math.min(1, Math.abs(x - c.x) / c.rx);
  const n = gfbm(x / (c.rx * 0.9), (c.z + c.rz) / (c.rz * 0.9), 3, 11);
  return c.z + c.rz * (1 + n * 0.08) * Math.sqrt(Math.max(0, 1 - ex * ex));
}

/** How far inside the meadow's coast a point lies; negative outside it. */
export function meadowInset(x: number, z: number): number {
  return -isleCoast(x, z, ISLES.meadow, 0.08, 11);
}

function rawHeight(x: number, z: number): number {
  let h = smax(islandHeight(x, z), linesHeight(x, z), 6);
  h = smax(h, meadowHeight(x, z), 6);
  h = smax(h, drownedHeight(x, z), 6);
  h = smax(h, woodHeight(x, z), 6);
  return smax(h, homeHeight(x, z), 6);
}

/** The cottage below the last hill sits on a levelled pad. */
export const COTTAGE = { x: -70, z: -2124, radius: 13 } as const;
export const COTTAGE_Y = rawHeight(COTTAGE.x, COTTAGE.z);

export function worldHeight(x: number, z: number): number {
  const h = rawHeight(x, z);
  const d = Math.hypot(x - COTTAGE.x, z - COTTAGE.z);
  if (d > COTTAGE.radius * 2) return h;
  return h + (COTTAGE_Y - h) * smoothstep(COTTAGE.radius * 2, COTTAGE.radius, d);
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
float sq(float x) {
  return x * x;
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
  float ridge = exp(-(sq(p.x + 16.0) + sq(p.y + 34.0)) / (2.0 * 400.0));
  float knoll = exp(-(sq(p.x - 26.0) + sq(p.y + 6.0)) / (2.0 * 144.0));
  h += land * land * (pow(max(hills, 0.0), 1.7) * 7.0 + ridge * 13.0 + knoll * 4.5);
  h += land * (1.0 - land) * 1.2 * (gfbm(p * 0.06, 2, 3.0) * 0.5 + 0.5);
  h -= smoothstep(0.0, 55.0, d) * 7.5;
  return h;
}
float hf_isleCoast(vec2 p, vec2 c, vec2 r, float wobble, float seed) {
  float n = gfbm(p / (r * 0.9), 3, seed);
  vec2 e = (p - c) / r;
  return (length(e) - 1.0 - n * wobble) * min(r.x, r.y) * 0.8;
}
float hf_lines(vec2 p) {
  vec2 c = vec2(${ISLES.lines.x}.0, ${ISLES.lines.z}.0);
  vec2 r = vec2(${ISLES.lines.rx}.0, ${ISLES.lines.rz}.0);
  float d = hf_isleCoast(p, c, r, 0.16, 21.0);
  float land = smoothstep(10.0, -30.0, d);
  float rr = length((p - c) / r);
  float h = land * 3.2 - 1.4;
  h += land * land * (max(0.0, 1.0 - rr * rr) * 12.0 + (gfbm(p * 0.022, 3, 22.0) * 0.5 + 0.5) * 5.0);
  return h - smoothstep(0.0, 40.0, d) * 8.0;
}
float meadowInset(vec2 p) {
  return -hf_isleCoast(p, vec2(${ISLES.meadow.x}.0, ${ISLES.meadow.z}.0), vec2(${ISLES.meadow.rx}.0, ${ISLES.meadow.rz}.0), 0.08, 11.0);
}
float hf_meadow(vec2 p) {
  vec2 c = vec2(${ISLES.meadow.x}.0, ${ISLES.meadow.z}.0);
  vec2 r = vec2(${ISLES.meadow.rx}.0, ${ISLES.meadow.rz}.0);
  float inland = -hf_isleCoast(p, c, r, 0.08, 11.0);
  float land = smoothstep(-12.0, 16.0, inland);
  float h = land * 4.8 - 1.6;
  float cliffs = smoothstep(0.0, 0.3, gfbm(vec2(p.x * 0.006, 7.7), 2, 12.0));
  h += cliffs * smoothstep(-3.0, 7.0, inland) * 8.0;
  float rise = smoothstep(10.0, 260.0, inland);
  float broad = gfbm(p * 0.0042, 3, 13.0);
  float mid = gfbm(p * 0.012, 3, 14.0);
  h += land * rise * max(0.0, 16.0 + 26.0 * broad + 7.0 * mid);
  return h - smoothstep(0.0, 70.0, -inland) * 8.0;
}
float hf_drowned(vec2 p) {
  vec2 c = vec2(${ISLES.drowned.x}.0, ${ISLES.drowned.z}.0);
  vec2 r = vec2(${ISLES.drowned.rx}.0, ${ISLES.drowned.rz}.0);
  float d = hf_isleCoast(p, c, r, 0.14, 31.0);
  float land = smoothstep(20.0, -30.0, d);
  float lumps = gfbm(p * 0.013, 3, 32.0);
  return land * (0.5 + lumps * 2.3) - 6.5 - smoothstep(0.0, 80.0, d) * 2.0;
}
float hf_wood(vec2 p) {
  vec2 c = vec2(${ISLES.wood.x}.0, ${ISLES.wood.z}.0);
  vec2 r = vec2(${ISLES.wood.rx}.0, ${ISLES.wood.rz}.0);
  float d = hf_isleCoast(p, c, r, 0.2, 41.0);
  float land = smoothstep(16.0, -38.0, d);
  float rr = length((p - c) / r);
  float h = land * 2.6 - 1.5;
  h += land * land * (max(0.0, 1.0 - rr * rr) * 22.0 + (gfbm(p * 0.03, 3, 42.0) * 0.5 + 0.5) * 5.0);
  return h - smoothstep(0.0, 60.0, d) * 7.0;
}
float hf_home(vec2 p) {
  vec2 c = vec2(${ISLES.home.x}.0, ${ISLES.home.z}.0);
  vec2 r = vec2(${ISLES.home.rx}.0, ${ISLES.home.rz}.0);
  float d = hf_isleCoast(p, c, r, 0.1, 51.0);
  float land = smoothstep(10.0, -22.0, d);
  float h = land * 4.0 - 1.6;
  h += land * land * (14.0 + gfbm(p * 0.006, 3, 52.0) * 12.0);
  float r2 = sq(p.x - ${LAST_HILL.x}.0) + sq(p.y - (${LAST_HILL.z}.0));
  h += land * (34.0 * exp(-r2 / (2.0 * 3364.0)) + 18.0 * exp(-r2 / (2.0 * 28900.0)));
  return h - smoothstep(0.0, 70.0, d) * 8.0;
}
float worldHeight(vec2 p) {
  float h = hf_smax(hf_island(p), hf_lines(p), 6.0);
  h = hf_smax(h, hf_meadow(p), 6.0);
  h = hf_smax(h, hf_drowned(p), 6.0);
  h = hf_smax(h, hf_wood(p), 6.0);
  h = hf_smax(h, hf_home(p), 6.0);
  float d = length(p - vec2(${COTTAGE.x.toFixed(1)}, ${COTTAGE.z.toFixed(1)}));
  return mix(h, ${COTTAGE_Y.toFixed(4)}, 1.0 - smoothstep(${COTTAGE.radius.toFixed(1)}, ${(COTTAGE.radius * 2).toFixed(1)}, d));
}
`;

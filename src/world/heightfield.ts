import { BOATS_SHIFT, SHORE_SHIFT, HOME_SHIFT } from './geography';
import { mirrorBed, MIRROR_LAYOUT_GLSL } from './sky-mirror-layout';
import { glsl, tuning } from '../tuning';
import { LITTLE_BOATS, LITTLE_BOATS_GLSL, boatsOut, boatsLevel } from './little-boats-layout';

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
const MEADOW_SCULPTED = { x: 10, z: -880, rx: 340, rz: 300 } as const;
const MEADOW_SOUTH = MEADOW_SCULPTED.z + MEADOW_SCULPTED.rz;
const MEADOW_SCALE = tuning.world.meadowLength / (2 * MEADOW_SCULPTED.rz);

/**
 * The meadow is a scale model of the ground it was sculpted as, shrunk toward the coast the boat lands on, so its
 * hills, cliffs and coastline keep their places along the walk. This takes a sculpted point to where it now lies.
 */
export function meadowPoint(x: number, z: number): { x: number; z: number } {
  return { x: MEADOW_SCULPTED.x + (x - MEADOW_SCULPTED.x) * MEADOW_SCALE, z: MEADOW_SOUTH + (z - MEADOW_SOUTH) * MEADOW_SCALE };
}

function meadowSculpted(x: number, z: number): { x: number; z: number } {
  return { x: MEADOW_SCULPTED.x + (x - MEADOW_SCULPTED.x) / MEADOW_SCALE, z: MEADOW_SOUTH + (z - MEADOW_SOUTH) / MEADOW_SCALE };
}

export const ISLES = {
  lines: { x: 14, z: -368.4, rx: 70, rz: 64.4 },
  meadow: {
    x: MEADOW_SCULPTED.x,
    z: MEADOW_SOUTH - MEADOW_SCULPTED.rz * MEADOW_SCALE,
    rx: MEADOW_SCULPTED.rx * MEADOW_SCALE,
    rz: MEADOW_SCULPTED.rz * MEADOW_SCALE,
  },
  boats: LITTLE_BOATS,
  birches: { x: 0, z: -1128, rx: 60, rz: 80 },
  drowned: { x: -10, z: -1440, rx: 210, rz: 175 },
  wood: { x: -30, z: -1800, rx: 130, rz: 115 },
  /** The frosted island the bed stands on, out west on the long crossing's own detour. */
  sleeping: { x: -175, z: -1922, rx: 42, rz: 46 },
  home: { x: -45 + HOME_SHIFT.x, z: -2120 + HOME_SHIFT.z, rx: 190, rz: 165 },
} as const;

/** The small shore reached only through the red door; separated from the washing island by open sea. */
export const DOOR_SHORE = { x: 240 + SHORE_SHIFT.x, z: -460 + SHORE_SHIFT.z, rx: 23, rz: 30 } as const;
function doorShoreHeight(x: number, z: number): number {
  const r = Math.hypot((x - DOOR_SHORE.x) / DOOR_SHORE.rx, (z - DOOR_SHORE.z) / DOOR_SHORE.rz);
  return 3.4 - smoothstep(0.35, 1.08, r) * 5.2 - smoothstep(1, 1.6, r) * 8;
}

type Isle = (typeof ISLES)[keyof typeof ISLES];

/**
 * The two things that give the long walk over the birches a shape: the rise the swing tree stands on, and the
 * hollow beyond it where the year's leaves have been collecting all autumn. Shared so ground and shader agree.
 */
export const BIRCH_RISE = { x: 2.6, z: -1118, rx: 38, rz: 30, h: 3.6 };
export const BIRCH_HOLLOW = { x: -6, z: -1150, rx: 19, rz: 14, h: 2.9 };

/** 1 in the middle of one of those and 0 at its edge, squared so the ground leaves it smoothly. */
function lump(x: number, z: number, c: { x: number; z: number; rx: number; rz: number }): number {
  const k = Math.max(0, 1 - ((x - c.x) / c.rx) ** 2 - ((z - c.z) / c.rz) ** 2);
  return k * k;
}

const LUMP_GLSL = /* glsl */ `
float hf_lump(vec2 p, vec2 c, vec2 r) {
  float k = max(0.0, 1.0 - dot((p - c) / r, (p - c) / r));
  return k * k;
}`;

/** Roughly how far outside an island's coast a point lies, in world units; negative on land. */
function isleCoast(x: number, z: number, c: Isle, wobble: number, seed: number): number {
  const n = gfbm(x / (c.rx * 0.9), z / (c.rz * 0.9), 3, seed);
  const ex = (x - c.x) / c.rx;
  const ez = (z - c.z) / c.rz;
  return (Math.hypot(ex, ez) - 1 - n * wobble) * Math.min(c.rx, c.rz) * 0.8;
}

/** Low sandy banks enclose three connected pools; the last stream shelves into the sea. */
function littleBoatsHeight(x: number, z: number): number {
  const c = LITTLE_BOATS;
  const r = Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz);
  let h = 3.5 - smoothstep(0.58, 1.08, r) * 5.1 - smoothstep(1, 1.5, r) * 8;
  h += Math.max(0, 1 - r) * gnoise((x - BOATS_SHIFT.x) * 0.07, (z - BOATS_SHIFT.z) * 0.07) * 0.55;
  const d = boatsOut(x, z);
  if (d > 1.65) return h;
  const level = boatsLevel(c.startZ - z);
  const bed = level - 0.65 + Math.min(1, d * d) * 0.24;
  const bank = Math.max(h, level + 0.42);
  const bowl = bed + (bank - bed) * smoothstep(0.65, 1.35, d);
  const shaped = bowl + (h - bowl) * smoothstep(1.35, 1.65, d);
  // Open the last pool into the sea instead of closing it with a submerged end wall.
  return shaped + (h - shaped) * smoothstep(101, 112, c.startZ - z);
}

/** The island of lines: a low green whaleback, small enough that the washing on it is the whole room. */
function linesHeight(x: number, z: number): number {
  const c = ISLES.lines;
  const d = isleCoast(x, z, c, 0.16, 21);
  const land = smoothstep(10, -30, d);
  const r = Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz);
  let h = land * 3.2 - 1.4;
  h += land * land * (Math.max(0, 1 - r * r) * tuning.world.linesDome + (gfbm(x * 0.022, z * 0.022, 3, 22) * 0.5 + 0.5) * 5);
  return h - smoothstep(0, 40, d) * 8;
}

/**
 * The bank over the landing. The boat comes ashore in a shallow bay, and everything the meadow is lies behind a
 * bank of grass the child has to climb: from the beach there is sand, the bank and the sky, and what is over it is
 * only seen from the top of it. The arms of the bay come further south than the middle, so the beach is enclosed.
 */
export const BANK = { x: 9, crest: -624, reach: 82, arms: 30, arm: 13, rise: 21, fall: 17, height: 10.5 } as const;

/** An open saddle lets the beach reveal the green ground beneath the piano. */
const PIANO_SADDLE = { x: -15, z: -706, rx: 32, rz: 32, start: -744, full: -718 };

function landingBank(wx: number, wz: number): number {
  const lateral = Math.exp(-(((wx - BANK.x) / BANK.reach) ** 2));
  const crest = BANK.crest + BANK.arm * (1 - Math.exp(-(((wx - BANK.x) / BANK.arms) ** 2)));
  const u = wz - crest;
  const shape = u > 0 ? smoothstep(BANK.rise, 0, u) : Math.exp(-((u / BANK.fall) ** 2));
  return BANK.height * lateral * shape;
}

/** The meadow: the broad rolling pasture, now bounded by its own coast on every side. */
function meadowHeight(wx: number, wz: number): number {
  const { x, z } = meadowSculpted(wx, wz);
  const inland = -isleCoast(x, z, MEADOW_SCULPTED, 0.08, 11);
  const land = smoothstep(-12, 16, inland);
  let h = land * 4.8 - 1.6;
  const cliffs = smoothstep(0, 0.3, gfbm(x * 0.006, 7.7, 2, 12));
  h += cliffs * smoothstep(-3, 7, inland) * 8;
  const rise = smoothstep(10, 260, inland);
  const broad = gfbm(x * 0.0042, z * 0.0042, 3, 13);
  const mid = gfbm(x * 0.012, z * 0.012, 3, 14);
  h += land * rise * Math.max(0, 16 + 26 * broad + 7 * mid);
  h += land * landingBank(wx, wz);
  const saddle = Math.exp(-(((wx - PIANO_SADDLE.x) / PIANO_SADDLE.rx) ** 2 + ((wz - PIANO_SADDLE.z) / PIANO_SADDLE.rz) ** 2));
  h -= land * saddle * smoothstep(PIANO_SADDLE.start, PIANO_SADDLE.full, wz) * tuning.world.meadowPianoSaddle;
  return h - smoothstep(0, 70, -inland) * 8;
}

/** The autumn birches: a small low island between the meadow and the village, domed and shelving to bare beaches. */
function birchesHeight(x: number, z: number): number {
  const c = ISLES.birches;
  const d = isleCoast(x, z, c, 0.13, 61);
  /** A long shallow ramp out of the water on both ends: a beach a boat runs up and a slope a camera can see down. */
  const land = smoothstep(18, -38, d);
  const r = Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz);
  let h = land * 3.4 - 1.6;
  h += land * land * (Math.max(0, 1 - r * r) * tuning.world.birchesCrest + (gfbm(x * 0.028, z * 0.028, 3, 62) * 0.5 + 0.5) * 3.2);
  h += land * land * lump(x, z, BIRCH_RISE) * BIRCH_RISE.h;
  h -= land * lump(x, z, BIRCH_HOLLOW) * BIRCH_HOLLOW.h;
  // A wind-scoured notch: rock face on the inside, a steep fall beyond the outer footing.
  const across=((x+164.56)*2+(z+1925.88))/Math.sqrt(5);
  const along=((x+164.56)-2*(z+1925.88))/Math.sqrt(5);
  h -= 4.5*smoothstep(1.65,3.8,across)*(1-smoothstep(2.2,5.5,Math.abs(along)));
  return h - smoothstep(0, 36, d) * 8;
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

/**
 * The sleeping island: an open bed terrace and a high shoulder with an exposed outward lip.
 * SLEEP_HOLLOW retains the fog domain centre; the old terrain depression has been removed.
 */
export const SLEEP_HOLLOW = { x: -175, z: -1912, rx: 16, rz: 14, h: 0 };
export const SLEEP_HILL = { x: -180, z: -1940, rx: 22, rz: 18, h: 13 };

function sleepingHeight(x: number, z: number): number {
  const c = ISLES.sleeping;
  const d = isleCoast(x, z, c, 0.14, 81);
  const land = smoothstep(10, -16, d);
  const r = Math.hypot((x - c.x) / c.rx, (z - c.z) / c.rz);
  let h = land * 3.0 - 1.5;
  h += land * land * (Math.max(0, 1 - r * r) * 4.5 + (gfbm(x * 0.03, z * 0.03, 3, 82) * 0.5 + 0.5) * 2.6);
  // A rounded ridge with a steep south face and a long grassy back. Walking never changes its height.
  const dx=x-SLEEP_HILL.x;
  const dz=z-(SLEEP_HILL.z+dx*dx*.012);
  const depth=dz>0?4.8:SLEEP_HILL.rz;
  h+=land*land*SLEEP_HILL.h*Math.exp(-.7*((dx/SLEEP_HILL.rx)**2+(dz/depth)**2));
  const terrace = 1 - smoothstep(6, 13, Math.hypot(x + 176.5, z + 1911));
  h += (6.3 + (x + 176.5) * 0.018 - (z + 1911) * 0.025 - h) * terrace;
  return h - smoothstep(0, 36, d) * 8;
}

/** The top of the last hill, where the journey ends. */
export const LAST_HILL = { x: -30 + HOME_SHIFT.x, z: -2060 + HOME_SHIFT.z } as const;

/** Home: one long hill to come over, with the cottage in the valley beyond it. */
function homeHeight(x: number, z: number): number {
  const d = isleCoast(x - HOME_SHIFT.x, z - HOME_SHIFT.z, { ...ISLES.home, x: -45, z: -2120 }, 0.1, 51);
  const land = smoothstep(10, -22, d);
  /** The shore shelves up onto the island over a long way: a beach the boat runs up and a slope off it, not a cliff. */
  const inland = smoothstep(4, -110, d);
  let h = land * 4 - 1.6;
  h += land * inland * (14 + gfbm((x - HOME_SHIFT.x) * 0.006, (z - HOME_SHIFT.z) * 0.006, 3, 52) * 12);
  const r2 = (x - LAST_HILL.x) ** 2 + (z - LAST_HILL.z) ** 2;
  h += land * (34 * Math.exp(-r2 / (2 * 58 ** 2)) + inland * 18 * Math.exp(-r2 / (2 * 170 ** 2)));
  return h - smoothstep(0, 70, d) * 8;
}

/** The meadow's south coast, where the boat comes ashore: kept as a function of x for the story and the camera. */
export function mainlandCoastZ(wx: number): number {
  const c = MEADOW_SCULPTED;
  const x = meadowSculpted(wx, 0).x;
  const ex = Math.min(1, Math.abs(x - c.x) / c.rx);
  const n = gfbm(x / (c.rx * 0.9), (c.z + c.rz) / (c.rz * 0.9), 3, 11);
  return meadowPoint(x, c.z + c.rz * (1 + n * 0.08) * Math.sqrt(Math.max(0, 1 - ex * ex))).z;
}

/** How far inside the meadow's coast a point lies; negative outside it. */
export function meadowInset(wx: number, wz: number): number {
  const { x, z } = meadowSculpted(wx, wz);
  return -isleCoast(x, z, MEADOW_SCULPTED, 0.08, 11) * MEADOW_SCALE;
}

function rawHeight(x: number, z: number): number {
  let h = smax(islandHeight(x, z), linesHeight(x, z), 6);
  h = smax(h, doorShoreHeight(x, z), 2);
  h = Math.max(h, littleBoatsHeight(x, z));
  h = smax(h, meadowHeight(x, z), 6);
  h = smax(h, birchesHeight(x, z), 6);
  h = smax(h, drownedHeight(x, z), 6);
  h = smax(h, woodHeight(x, z), 6);
  h = smax(h, sleepingHeight(x, z), 6);
  h = Math.max(smax(h, homeHeight(x, z), 6), mirrorBed(x, z));
  // The submerged western approach moves with home and clears the boat's keel.
  const channel = Math.hypot((x - HOME_SHIFT.x + 150) / 24, (z - HOME_SHIFT.z + 1974) / 17);
  return h - (1 - smoothstep(0.25, 1, channel)) * 1.5;
}

/**
 * The tarn on the open north slope, where the cygnet's family is resting. It lies on a shelf beyond the brow, so
 * the walk comes over the top and the ground falls away to it, and everything that leaves it leaves over falling
 * ground and open water. It is longer north to south than a swan's take-off run, so nothing runs out of water.
 */
export const POND = { x: 24, z: -892, rx: 15.5, rz: 17 } as const;
/** How far the middle is dug below the water, and how low a lip holds it on the side where the slope falls away. */
const POND_BED = 2.6;
const POND_LIP = 0.4;
/**
 * The still water's surface, taken from the shelf it lies on so the pond belongs to the ground around it, and set
 * low enough into it that the lip holding it downhill is no taller than the bite it takes out of the slope above.
 */
export const POND_LEVEL = rawHeight(POND.x, POND.z) - 0.85;

/** How far out of the middle of the pond a point lies, 1 at the rim of its ellipse, wandering so it is not drawn. */
export function pondOut(x: number, z: number): number {
  const d = Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
  return d * (1 + 0.16 * gfbm(x * 0.05, z * 0.05, 2, 71));
}

/**
 * The bowl. The middle is dug out; the rim is the slope itself where the slope stands above the water, and a
 * low lip where it falls below, just enough to hold the water in. A bank raised all the way round read as a
 * crater sitting on the hillside rather than a tarn lying in it.
 */
function pondHeight(h: number, x: number, z: number): number {
  const d = pondOut(x, z);
  if (d > 1.5) return h;
  const bed = POND_LEVEL - POND_BED * (1 - d * d);
  const rim = Math.max(h, POND_LEVEL + POND_LIP);
  const held = bed + (rim - bed) * smoothstep(0.9, 1.15, d);
  return held + (h - held) * smoothstep(1.15, 1.5, d);
}

/** The cottage below the last hill sits on a levelled pad. */
export const COTTAGE = { x: -70 + HOME_SHIFT.x, z: -2124 + HOME_SHIFT.z, radius: 13, approachRadius: 26 } as const;
const cottageApproachLength = Math.hypot(LAST_HILL.x - COTTAGE.x, LAST_HILL.z - COTTAGE.z);
const COTTAGE_APPROACH = {
  x: (LAST_HILL.x - COTTAGE.x) / cottageApproachLength,
  z: (LAST_HILL.z - COTTAGE.z) / cottageApproachLength,
};
export const COTTAGE_Y = rawHeight(COTTAGE.x, COTTAGE.z);

export function worldHeight(x: number, z: number): number {
  const h = pondHeight(rawHeight(x, z), x, z);
  // Extend the terrace uphill so the foreground turf falls below the view of the lower walls.
  // The seaward edge and the house's foundation stay at their existing height.
  const dx = x - COTTAGE.x, dz = z - COTTAGE.z;
  const along = dx * COTTAGE_APPROACH.x + dz * COTTAGE_APPROACH.z;
  const across = dx * COTTAGE_APPROACH.z - dz * COTTAGE_APPROACH.x;
  const reach = COTTAGE.radius + (COTTAGE.approachRadius - COTTAGE.radius) * smoothstep(0, COTTAGE.radius, along);
  const d = Math.hypot(across, along * COTTAGE.radius / reach);
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
  float land = (1.0 - smoothstep(-14.0, 10.0, d));
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
${LUMP_GLSL}
float hf_lines(vec2 p) {
  vec2 c = vec2(${ISLES.lines.x}.0, ${glsl(ISLES.lines.z)});
  vec2 r = vec2(${ISLES.lines.rx}.0, ${glsl(ISLES.lines.rz)});
  float d = hf_isleCoast(p, c, r, 0.16, 21.0);
  float land = (1.0 - smoothstep(-30.0, 10.0, d));
  float rr = length((p - c) / r);
  float h = land * 3.2 - 1.4;
  h += land * land * (max(0.0, 1.0 - rr * rr) * ${glsl(tuning.world.linesDome)} + (gfbm(p * 0.022, 3, 22.0) * 0.5 + 0.5) * 5.0);
  return h - smoothstep(0.0, 40.0, d) * 8.0;
}
vec2 hf_meadowSculpted(vec2 p) {
  vec2 pivot = vec2(${MEADOW_SCULPTED.x}.0, ${MEADOW_SOUTH}.0);
  return pivot + (p - pivot) * ${glsl(1 / MEADOW_SCALE)};
}
float meadowInset(vec2 p) {
  return -hf_isleCoast(hf_meadowSculpted(p), vec2(${MEADOW_SCULPTED.x}.0, ${MEADOW_SCULPTED.z}.0), vec2(${MEADOW_SCULPTED.rx}.0, ${MEADOW_SCULPTED.rz}.0), 0.08, 11.0) * ${glsl(MEADOW_SCALE)};
}
float hf_bank(vec2 world) {
  float lateral = exp(-sq((world.x - ${glsl(BANK.x)}) / ${glsl(BANK.reach)}));
  float crest = ${glsl(BANK.crest)} + ${glsl(BANK.arm)} * (1.0 - exp(-sq((world.x - ${glsl(BANK.x)}) / ${glsl(BANK.arms)})));
  float u = world.y - crest;
  float shape = u > 0.0 ? (1.0 - smoothstep(0.0, ${glsl(BANK.rise)}, u)) : exp(-sq(u / ${glsl(BANK.fall)}));
  return ${glsl(BANK.height)} * lateral * shape;
}
float hf_meadow(vec2 world) {
  vec2 p = hf_meadowSculpted(world);
  vec2 c = vec2(${MEADOW_SCULPTED.x}.0, ${MEADOW_SCULPTED.z}.0);
  vec2 r = vec2(${MEADOW_SCULPTED.rx}.0, ${MEADOW_SCULPTED.rz}.0);
  float inland = -hf_isleCoast(p, c, r, 0.08, 11.0);
  float land = smoothstep(-12.0, 16.0, inland);
  float h = land * 4.8 - 1.6;
  float cliffs = smoothstep(0.0, 0.3, gfbm(vec2(p.x * 0.006, 7.7), 2, 12.0));
  h += cliffs * smoothstep(-3.0, 7.0, inland) * 8.0;
  float rise = smoothstep(10.0, 260.0, inland);
  float broad = gfbm(p * 0.0042, 3, 13.0);
  float mid = gfbm(p * 0.012, 3, 14.0);
  h += land * rise * max(0.0, 16.0 + 26.0 * broad + 7.0 * mid);
  h += land * hf_bank(world);
  vec2 saddle = (world - vec2(${glsl(PIANO_SADDLE.x)}, ${glsl(PIANO_SADDLE.z)})) / vec2(${glsl(PIANO_SADDLE.rx)}, ${glsl(PIANO_SADDLE.rz)});
  h -= land * exp(-dot(saddle, saddle)) * smoothstep(${glsl(PIANO_SADDLE.start)}, ${glsl(PIANO_SADDLE.full)}, world.y) * ${glsl(tuning.world.meadowPianoSaddle)};
  return h - smoothstep(0.0, 70.0, -inland) * 8.0;
}
float hf_birches(vec2 p) {
  vec2 c = vec2(${ISLES.birches.x}.0, ${ISLES.birches.z}.0);
  vec2 r = vec2(${ISLES.birches.rx}.0, ${ISLES.birches.rz}.0);
  float d = hf_isleCoast(p, c, r, 0.13, 61.0);
  float land = (1.0 - smoothstep(-38.0, 18.0, d));
  float rr = length((p - c) / r);
  float h = land * 3.4 - 1.6;
  h += land * land * (max(0.0, 1.0 - rr * rr) * ${glsl(tuning.world.birchesCrest)} + (gfbm(p * 0.028, 3, 62.0) * 0.5 + 0.5) * 3.2);
  h += land * land * hf_lump(p, vec2(${glsl(BIRCH_RISE.x)}, ${glsl(BIRCH_RISE.z)}), vec2(${glsl(BIRCH_RISE.rx)}, ${glsl(BIRCH_RISE.rz)})) * ${glsl(BIRCH_RISE.h)};
  h -= land * hf_lump(p, vec2(${glsl(BIRCH_HOLLOW.x)}, ${glsl(BIRCH_HOLLOW.z)}), vec2(${glsl(BIRCH_HOLLOW.rx)}, ${glsl(BIRCH_HOLLOW.rz)})) * ${glsl(BIRCH_HOLLOW.h)};
  vec2 notch=p-vec2(-164.56,-1925.88);
  float across=dot(notch,vec2(2.0,1.0))/sqrt(5.0), along=dot(notch,vec2(1.0,-2.0))/sqrt(5.0);
  h-=4.5*smoothstep(1.65,3.8,across)*(1.0-smoothstep(2.2,5.5,abs(along)));
  return h - smoothstep(0.0, 36.0, d) * 8.0;
}
float hf_drowned(vec2 p) {
  vec2 c = vec2(${ISLES.drowned.x}.0, ${ISLES.drowned.z}.0);
  vec2 r = vec2(${ISLES.drowned.rx}.0, ${ISLES.drowned.rz}.0);
  float d = hf_isleCoast(p, c, r, 0.14, 31.0);
  float land = (1.0 - smoothstep(-30.0, 20.0, d));
  float lumps = gfbm(p * 0.013, 3, 32.0);
  return land * (0.5 + lumps * 2.3) - 6.5 - smoothstep(0.0, 80.0, d) * 2.0;
}
float hf_wood(vec2 p) {
  vec2 c = vec2(${ISLES.wood.x}.0, ${ISLES.wood.z}.0);
  vec2 r = vec2(${ISLES.wood.rx}.0, ${ISLES.wood.rz}.0);
  float d = hf_isleCoast(p, c, r, 0.2, 41.0);
  float land = (1.0 - smoothstep(-38.0, 16.0, d));
  float rr = length((p - c) / r);
  float h = land * 2.6 - 1.5;
  h += land * land * (max(0.0, 1.0 - rr * rr) * 22.0 + (gfbm(p * 0.03, 3, 42.0) * 0.5 + 0.5) * 5.0);
  return h - smoothstep(0.0, 60.0, d) * 7.0;
}
float hf_sleeping(vec2 p) {
  vec2 c = vec2(${ISLES.sleeping.x}.0, ${ISLES.sleeping.z}.0);
  vec2 r = vec2(${ISLES.sleeping.rx}.0, ${ISLES.sleeping.rz}.0);
  float d = hf_isleCoast(p, c, r, 0.14, 81.0);
  float land = (1.0 - smoothstep(-16.0, 10.0, d));
  float rr = length((p - c) / r);
  float h = land * 3.0 - 1.5;
  h += land * land * (max(0.0, 1.0 - rr * rr) * 4.5 + (gfbm(p * 0.03, 3, 82.0) * 0.5 + 0.5) * 2.6);
  float dx=p.x - (${glsl(SLEEP_HILL.x)});
  float dz=p.y-(${glsl(SLEEP_HILL.z)}+dx*dx*.012);
  float depth=dz>0.0?4.8:${glsl(SLEEP_HILL.rz)};
  h+=land*land*${glsl(SLEEP_HILL.h)}*exp(-.7*(sq(dx/${glsl(SLEEP_HILL.rx)})+sq(dz/depth)));
  float terrace = 1.0 - smoothstep(6.0, 13.0, length(p - vec2(-176.5, -1911.0)));
  h = mix(h, 6.3 + (p.x + 176.5) * 0.018 - (p.y + 1911.0) * 0.025, terrace);
  return h - smoothstep(0.0, 36.0, d) * 8.0;
}
float hf_home(vec2 p) {
  vec2 c = vec2(${ISLES.home.x}.0, ${ISLES.home.z}.0);
  vec2 r = vec2(${ISLES.home.rx}.0, ${ISLES.home.rz}.0);
  float d = hf_isleCoast(p - vec2(${glsl(HOME_SHIFT.x)}, ${glsl(HOME_SHIFT.z)}), vec2(-45.0, -2120.0), r, 0.1, 51.0);
  float land = (1.0 - smoothstep(-22.0, 10.0, d));
  float inland = (1.0 - smoothstep(-110.0, 4.0, d));
  float h = land * 4.0 - 1.6;
  h += land * inland * (14.0 + gfbm((p - vec2(${glsl(HOME_SHIFT.x)}, ${glsl(HOME_SHIFT.z)})) * 0.006, 3, 52.0) * 12.0);
  float r2 = sq(p.x - ${LAST_HILL.x}.0) + sq(p.y - (${LAST_HILL.z}.0));
  h += land * (34.0 * exp(-r2 / (2.0 * 3364.0)) + inland * 18.0 * exp(-r2 / (2.0 * 28900.0)));
  return h - smoothstep(0.0, 70.0, d) * 8.0;
}
/** How far out of the middle of the pond a point lies; mirrors pondOut in TypeScript. */
float pondOut(vec2 p) {
  vec2 c = vec2(${POND.x}.0, ${POND.z}.0);
  vec2 r = vec2(${glsl(POND.rx)}, ${glsl(POND.rz)});
  return length((p - c) / r) * (1.0 + 0.16 * gfbm(p * 0.05, 2, 71.0));
}
/** 0 where the pond's water stands over the ground, so no meadow grows up through the surface of it. */
float pondDry(vec2 p, float groundH) {
  float o = pondOut(p);
  if (o > 1.0) return 1.0;
  return mix(1.0, smoothstep(${glsl(POND_LEVEL - 0.05)}, ${glsl(POND_LEVEL + 0.2)}, groundH), (1.0 - smoothstep(0.9, 1.0, o)));
}
float hf_pond(float h, vec2 p) {
  float d = pondOut(p);
  if (d > 1.5) return h;
  float bed = ${glsl(POND_LEVEL)} - ${glsl(POND_BED)} * (1.0 - d * d);
  float rim = max(h, ${glsl(POND_LEVEL + POND_LIP)});
  float held = mix(bed, rim, smoothstep(0.9, 1.15, d));
  return mix(held, h, smoothstep(1.15, 1.5, d));
}
float hf_doorShore(vec2 p) {
  float r = length((p - vec2(${glsl(DOOR_SHORE.x)}, ${glsl(DOOR_SHORE.z)})) / vec2(${glsl(DOOR_SHORE.rx)}, ${glsl(DOOR_SHORE.rz)}));
  return 3.4 - smoothstep(0.35, 1.08, r) * 5.2 - smoothstep(1.0, 1.6, r) * 8.0;
}
${LITTLE_BOATS_GLSL}
float hf_littleBoats(vec2 p) {
  float r = length((p - vec2(${glsl(LITTLE_BOATS.x)}, ${glsl(LITTLE_BOATS.z)})) / vec2(${glsl(LITTLE_BOATS.rx)}, ${glsl(LITTLE_BOATS.rz)}));
  float h = 3.5 - smoothstep(0.58, 1.08, r) * 5.1 - smoothstep(1.0, 1.5, r) * 8.0;
  h += max(0.0, 1.0 - r) * gnoise((p - vec2(${glsl(BOATS_SHIFT.x)}, ${glsl(BOATS_SHIFT.z)})) * 0.07) * 0.55;
  float d = boatsOut(p);
  if (d > 1.65) return h;
  float level = boatsLevel(${glsl(LITTLE_BOATS.startZ)} - p.y);
  float bed = level - 0.65 + min(1.0, d * d) * 0.24;
  float bank = max(h, level + 0.42);
  float bowl = mix(bed, bank, smoothstep(0.65, 1.35, d));
  float shaped = mix(bowl, h, smoothstep(1.35, 1.65, d));
  return mix(shaped, h, smoothstep(101.0, 112.0, ${glsl(LITTLE_BOATS.startZ)} - p.y));
}
${MIRROR_LAYOUT_GLSL}
float worldHeight(vec2 p) {
  float h = hf_smax(hf_island(p), hf_lines(p), 6.0);
  h = hf_smax(h, hf_doorShore(p), 2.0);
  h = max(h, hf_littleBoats(p));
  h = hf_smax(h, hf_meadow(p), 6.0);
  h = hf_smax(h, hf_birches(p), 6.0);
  h = hf_smax(h, hf_drowned(p), 6.0);
  h = hf_smax(h, hf_wood(p), 6.0);
  h = hf_smax(h, hf_sleeping(p), 6.0);
  h = hf_smax(h, hf_home(p), 6.0);
  h = max(h, mirrorBed(p));
  float channel = length((p - vec2(${glsl(-150 + HOME_SHIFT.x)}, ${glsl(-1974 + HOME_SHIFT.z)})) / vec2(24.0, 17.0));
  h -= (1.0 - smoothstep(0.25, 1.0, channel)) * 1.5;
  h = hf_pond(h, p);
  vec2 cottageDelta = p - vec2(${COTTAGE.x.toFixed(1)}, ${COTTAGE.z.toFixed(1)});
  vec2 cottageApproach = vec2(${glsl(COTTAGE_APPROACH.x)}, ${glsl(COTTAGE_APPROACH.z)});
  float along = dot(cottageDelta, cottageApproach);
  float across = dot(cottageDelta, vec2(cottageApproach.y, -cottageApproach.x));
  float reach = ${glsl(COTTAGE.radius)} + ${glsl(COTTAGE.approachRadius - COTTAGE.radius)} * smoothstep(0.0, ${glsl(COTTAGE.radius)}, along);
  float d = length(vec2(across, along * ${glsl(COTTAGE.radius)} / reach));
  return mix(h, ${COTTAGE_Y.toFixed(4)}, 1.0 - smoothstep(${COTTAGE.radius.toFixed(1)}, ${(COTTAGE.radius * 2).toFixed(1)}, d));
}
`;

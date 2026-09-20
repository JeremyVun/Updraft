import { LITTLE_BOATS, boatsOut, boatsLevel, boatsToyClearing } from './little-boats-layout';
import * as THREE from 'three';
import { params } from '../params';
import { glsl, tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { FIELDS_GLSL, fieldAt, type FieldSample } from './fields';
import { COTTAGE, GRASS_LINE, HEIGHTFIELD_GLSL, ISLES, LAST_HILL, POND_LEVEL, pondOut } from './heightfield';

/**
 * How much height grass keeps on grazed islands and the pond's margin. The bank stays short enough to see the
 * child offer the water and receive the cygnet. Mirrors `croppedAt` in the blade shaders; keep them in step.
 */
function croppedAt(x: number, z: number): number {
  if (Math.abs(x - LITTLE_BOATS.x) < 55 && Math.abs(z - LITTLE_BOATS.z) < 78) return 0.22;
  const lines = 1 - smoothstep(0.78, 1.12, Math.hypot((x - ISLES.lines.x) / ISLES.lines.rx, (z - ISLES.lines.z) / ISLES.lines.rz));
  const birches = 1 - smoothstep(0.62, 1.02, Math.hypot((x - ISLES.birches.x) / ISLES.birches.rx, (z - ISLES.birches.z) / ISLES.birches.rz));
  const bank = 1 - smoothstep(tuning.crest.bankCropFrom, tuning.crest.bankCropTo, pondOut(x, z));
  return (1 - 0.34 * lines) * (1 - 0.62 * birches) * (1 - (1 - tuning.crest.bankGrass) * bank);
}

/**
 * The dark wood has a floor of its own — wet leaves, roots and deadfall — and meadow grass three metres deep grew
 * straight through all of it and hid the room. Mirrors `woodFloorAt` in the blade shaders; keep them in step.
 */
function woodFloorAt(x: number, z: number): number {
  const d = Math.hypot((x - ISLES.wood.x) / ISLES.wood.rx, (z - ISLES.wood.z) / ISLES.wood.rz);
  return 1 - smoothstep(0.7, 1.05, d);
}

/** Short scattered tufts, mirrored by woodGrassCrop in GLSL. */
function woodGrassCrop(x: number, z: number): number {
  const wood = woodFloorAt(x, z);
  if (wood <= 0) return 1;
  const k = tuning.wood;
  const patch = smoothstep(0.42, 0.63, shaderFbm(x * k.grassPatchScale + 53, z * k.grassPatchScale - 17));
  return 1 + (k.grassBaseCrop + (k.grassTuftCrop - k.grassBaseCrop) * patch - 1) * wood;
}

/** The sleeping island's look numbers: what a blade cropped this short keeps of itself, and how its rime lies. */
const SLEEP = tuning.sleeping;

/**
 * The sleeping island is cropped shortest of all: frosted stubble, so a small white bird walking away from the
 * bed is legible the whole way up the hill. A blade takes its width down with its height here, unlike the other
 * cropped islands, so what is left is fine grass and not a chip wider than it is tall.
 * Mirrors `sleepFloorAt` in the blade shaders; keep them in step.
 */
function sleepFloorAt(x: number, z: number): number {
  const d = Math.hypot((x - ISLES.sleeping.x) / ISLES.sleeping.rx, (z - ISLES.sleeping.z) / ISLES.sleeping.rz);
  return 1 - smoothstep(0.72, 1.06, d);
}

/**
 * Home is the one island the pasture grass is let grow on: the last hill is lush rather than grazed, deep enough
 * to feel like the meadow again without swallowing the child. Mirrors `homeAt` in the blade shaders.
 */
const HOME_LUSH = 0.8;
function homeAt(x: number, z: number): number {
  const d = Math.hypot((x - ISLES.home.x) / ISLES.home.rx, (z - ISLES.home.z) / ISLES.home.rz);
  return 1 - smoothstep(0.75, 1.05, d);
}
import { heightAt } from './island';
import { shaderFbm, smoothstep } from './noise';
import { WINDOW, onWindowMove } from './window';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const TILE = 8;
/** Cells per tile side of the finest grid. Every blade lives in one of these cells, whichever level draws it. */
const FINE = 32;
/** No blade, flowering and laid flat by the wind, reaches further from its root than this. */
const MAX_BLADE = 6;
/** A blade about to be thinned away shrinks into the ground over this many metres of camera travel. */
const SHRINK_BAND = 7;

/**
 * The levels draw one population of blades, not three. Level 1 holds one chosen blade from every 2x2 block of
 * level 0's cells and level 2 one from every pair of level 1's, and the chosen blades carry the lowest ranks, so
 * by the time thinning has brought a tile down to the next level's density the blades left standing are exactly
 * the ones that level draws. A tile changing level changes nothing on screen. `gr_cell` and `gr_rank` in
 * BLADE_LOD_GLSL hold the other half of this; the grids here must stay 32x32, 16x16 and 8x16.
 */
interface LodSpec {
  /** Blades per tile, across and down. */
  cols: number;
  rows: number;
  segments: number;
  /** Tiles wholly beyond the previous level's reach, and not beyond this one's, use this level. */
  reach: number;
  /** Where the meadow starts thinning toward the next level (or, for the last, sinking away), as a fraction of `reach`. */
  thinFrom: number;
  /** Blade width once the meadow has thinned to this level, making up for the blades that are gone. */
  widthScale: number;
  maxTiles: number;
}

const LODS: LodSpec[] = [
  { cols: 32, rows: 32, segments: 6, reach: 52, thinFrom: 0.85, widthScale: 1, maxTiles: 700 },
  { cols: 16, rows: 16, segments: 5, reach: 112, thinFrom: 0.84, widthScale: 1.55, maxTiles: 1100 },
  { cols: 8, rows: 16, segments: 4, reach: 176, thinFrom: 0.8, widthScale: 1.7, maxTiles: 1600 },
];

/** The meadow palette and tint pattern, shared with the terrain so far grass matches the blades. */
export const GRASS_GLSL = /* glsl */ `
uniform vec3 uGrassRoot;
uniform vec3 uTipLush;
uniform vec3 uTipDry;
uniform vec3 uTipCool;
/** 1 on the mainland's grazed pasture, 0 on the island's wild meadow. */
float pastureAt(vec2 xz) {
  return smoothstep(-600.0, -660.0, xz.y);
}
/** 1 under the birches, where the floor is fallen gold and the little grass left in it has gone over with the year. */
float birchFloorAt(vec2 xz) {
  return 1.0 - smoothstep(0.62, 1.02, length((xz - vec2(${ISLES.birches.x}.0, ${ISLES.birches.z}.0)) / vec2(${ISLES.birches.rx}.0, ${ISLES.birches.rz}.0)));
}
/** Short, irregular grass around the tarn where the swans have been resting. */
float pondBankAt(vec2 xz) {
  return 1.0 - smoothstep(${glsl(tuning.crest.bankCropFrom)}, ${glsl(tuning.crest.bankCropTo)}, pondOut(xz));
}
/** How much of its height a blade keeps on the cropped islands and the pond's bank. */
float croppedAt(vec2 xz) {
  if (abs(xz.x - 350.0) < 55.0 && abs(xz.y + 590.0) < 78.0) return 0.22;
  float lines = 1.0 - smoothstep(0.78, 1.12, length((xz - vec2(${ISLES.lines.x}.0, ${glsl(ISLES.lines.z)})) / vec2(${ISLES.lines.rx}.0, ${glsl(ISLES.lines.rz)})));
  float bank = pondBankAt(xz);
  return (1.0 - 0.34 * lines) * (1.0 - 0.62 * birchFloorAt(xz)) * mix(1.0, ${glsl(tuning.crest.bankGrass)}, bank);
}
/** 1 over the home island, where the pasture is let grow lush for the last hill. */
float homeAt(vec2 xz) {
  return 1.0 - smoothstep(0.75, 1.05, length((xz - vec2(${ISLES.home.x}.0, ${ISLES.home.z}.0)) / vec2(${ISLES.home.rx}.0, ${ISLES.home.rz}.0)));
}
/** 1 over the sleeping island, where the grass is frosted stubble and a small bird has to stay legible in it. */
float sleepFloorAt(vec2 xz) {
  return 1.0 - smoothstep(0.72, 1.06, length((xz - vec2(${ISLES.sleeping.x}.0, ${ISLES.sleeping.z}.0)) / vec2(${ISLES.sleeping.rx}.0, ${ISLES.sleeping.rz}.0)));
}
/** 1 over the dark wood, where the floor is leaf litter and nothing grows tall enough to hide it. */
float woodFloorAt(vec2 xz) {
  return 1.0 - smoothstep(0.7, 1.05, length((xz - vec2(${ISLES.wood.x}.0, ${ISLES.wood.z}.0)) / vec2(${ISLES.wood.rx}.0, ${ISLES.wood.rz}.0)));
}
float woodGrassCrop(vec2 xz) {
  float wood = woodFloorAt(xz);
  if (wood <= 0.0) return 1.0;
  float tuftPatch = smoothstep(0.42, 0.63, fbm(xz * ${glsl(tuning.wood.grassPatchScale)} + vec2(53.0, -17.0)));
  return mix(1.0, mix(${glsl(tuning.wood.grassBaseCrop)}, ${glsl(tuning.wood.grassTuftCrop)}, tuftPatch), wood);
}
vec3 grassTint(vec2 xz) {
  float dry = smoothstep(0.58, 0.76, fbm(xz * 0.022 + vec2(3.1, 7.7)));
  float cool = smoothstep(0.5, 0.68, fbm(xz * 0.041 - vec2(5.3, 1.9))) * (1.0 - dry);
  /** The year turning: more of the hillside goes over to seed, and the green that is left goes colder. */
  dry = clamp(dry + uSeason * 0.3, 0.0, 1.0);
  vec3 meadow = mix(mix(uTipLush, uTipDry, dry * 0.85), uTipCool, cool * 0.5);
  vec3 emerald = mix(vec3(0.16, 0.36, 0.07), vec3(0.3, 0.46, 0.09), fbm(xz * 0.03 + 11.0));
  emerald = mix(emerald, uTipDry * 0.9, dry * 0.35);
  vec3 tint = mix(meadow, emerald, pastureAt(xz));
  tint = mix(tint, vec3(0.44, 0.31, 0.11), birchFloorAt(xz) * 0.72);
  tint = mix(tint, mix(vec3(0.14, 0.19, 0.085), vec3(0.29, 0.27, 0.12), fbm(xz * 0.32)), woodFloorAt(xz) * 0.9);
  return mix(tint, mix(tint, vec3(0.4, 0.41, 0.31), 0.28) * 0.93, uSeason);
}
`;

/**
 * The pale the frost puts on whatever it settles on. White, taking its cast from the sky over it, so the rime is
 * blue in the night's own light and goes neutral as the morning comes up rather than staying a painted grey.
 */
export const RIME_GLSL = /* glsl */ `
vec3 rimeColour() {
  vec3 sky = uSkyAmbient / max(max(uSkyAmbient.r, max(uSkyAmbient.g, uSkyAmbient.b)), 1e-4);
  return mix(vec3(0.84, 0.86, 0.89), sky, 0.5);
}
`;

const fieldSample: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 };

/** Mirrors `troddenAt` in `ATMO_GLSL`; keep the two in step. */
function troddenAt(x: number, z: number): number {
  const t = atmo.uniforms.uTrodden.value;
  if (t.w <= 0) return 1;
  const dx = x - t.x;
  const dz = z - t.y;
  const r = (Math.hypot(dx, dz) / t.z) * (0.78 + 0.5 * shaderFbm(dx * 0.22, dz * 0.22));
  return 1 - t.w * 0.6 * (1 - smoothstep(0.1, 1.05, r));
}

/** Mirrors `pondDry` in `HEIGHTFIELD_GLSL`; keep the two in step. */
function pondDry(x: number, z: number, groundH: number): number {
  const o = pondOut(x, z);
  if (o > 1) return 1;
  return 1 + (smoothstep(POND_LEVEL - 0.05, POND_LEVEL + 0.2, groundH) - 1) * smoothstep(1, 0.9, o);
}

/** Typical blade height at (x, z): the vertex shader's formula without the per-blade randomness. */
export function grassHeightAt(x: number, z: number): number {
  const groundH = heightAt(x, z);
  if (groundH < GRASS_LINE - 0.6) return 0;
  const inBoats = Math.abs(x - LITTLE_BOATS.x) < 65 && Math.abs(z - LITTLE_BOATS.z) < 85;
  const boatDry = inBoats && boatsOut(x, z) < 1.2 ? smoothstep(boatsLevel(LITTLE_BOATS.startZ - z) + 0.05, boatsLevel(LITTLE_BOATS.startZ - z) + 0.3, groundH) : 1;
  const dry = pondDry(x, z, groundH) * boatDry * boatsToyClearing(x, z);
  if (dry <= 0) return 0;
  const lush = shaderFbm(x * 0.035 + 17, z * 0.035 + 17);
  const shortPatch = smoothstep(0.52, 0.68, shaderFbm(x * 0.05 - 23, z * 0.05 - 23));
  const fringe = smoothstep(GRASS_LINE - 0.6, GRASS_LINE + 2.2, groundH);
  const pasture = smoothstep(-600, -660, z);
  let h = (1.1 + 1.9 * smoothstep(0.3, 0.75, lush) + 0.275) * (0.2 + 0.8 * fringe * fringe) * (1 - shortPatch * 0.5);
  h *= dry;
  if (pasture <= 0) return h * croppedAt(x, z) * woodGrassCrop(x, z) * (1 - (1 - SLEEP.swardCrop) * sleepFloorAt(x, z)) * troddenAt(x, z);
  h += (0.41 + 0.26 * lush - h) * pasture;
  const f = fieldAt(x, z, fieldSample);
  const hilltop = 1 - smoothstep(45, 95, Math.hypot(x - LAST_HILL.x, z - LAST_HILL.z));
  const garden = 1 - smoothstep(14, 30, Math.hypot(x - COTTAGE.x, z - COTTAGE.z));
  const grazed = Math.max(hilltop, garden);
  const hay = (f.kind <= 0.22 ? 1 : 0) * f.presence * (1 - grazed);
  const rush = (f.kind >= 0.86 ? 1 : 0) * f.presence * (1 - grazed);
  return h * (1 + hay * 1.5 + rush * 1.2) * (1 + HOME_LUSH * homeAt(x, z)) * (1 - 0.22 * hilltop) * (1 - 0.5 * garden) * croppedAt(x, z) * woodGrassCrop(x, z) * (1 - (1 - SLEEP.swardCrop) * sleepFloorAt(x, z)) * troddenAt(x, z);
}

export const grassUniforms = {
  uGrassRoot: { value: new THREE.Color('#15291d') },
  uTipLush: { value: new THREE.Color('#7d9a3c') },
  uTipDry: { value: new THREE.Color('#c4a152') },
  uTipCool: { value: new THREE.Color('#4a8660') },
};

/** Texels per row of a blade table; a blade's texel is (index % width, index / width). */
const TABLE_WIDTH = 1024;

/** Hash and random draws shared by the blade table and the blade vertex shader, in the order the table draws them. */
const BLADE_RAND_GLSL = /* glsl */ `
uint gr_hash(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v.x ^ v.y;
}
float gr_rand(inout uint s) {
  s = s * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return float((w >> 22u) ^ w) / 4294967295.0;
}
`;

/** Which blade a level's slot draws and the rank that decides when it is thinned away (see LodSpec). */
const BLADE_LOD_GLSL = /* glsl */ `
uniform ivec2 uGrid;
uniform int uLevel;
const int GR_ORIGIN = 1 << 20;
ivec2 gr_pick4(ivec2 q) {
  uint h = gr_hash(uvec2(q) + 7919u);
  return q * 2 + ivec2(int(h & 1u), int((h >> 1u) & 1u));
}
ivec2 gr_pick2(ivec2 q) {
  uint h = gr_hash(uvec2(q) + 104729u);
  return ivec2(q.x * 2 + int(h & 1u), q.y);
}
/** The fine cell (offset by GR_ORIGIN so it is never negative) whose blade this level's slot \`id\` of the tile draws. */
ivec2 gr_cell(ivec2 tileCell, int id) {
  ivec2 q = tileCell * uGrid + ivec2(id % uGrid.x, id / uGrid.x);
  if (uLevel == 0) return q + GR_ORIGIN;
  if (uLevel == 1) return gr_pick4(q + (GR_ORIGIN >> 1));
  return gr_pick4(gr_pick2(q + ivec2(GR_ORIGIN >> 2, GR_ORIGIN >> 1)));
}
float gr_rank(ivec2 cell, float r) {
  ivec2 q1 = cell >> 1;
  if (gr_pick4(q1) != cell) return 0.25 + 0.75 * r;
  ivec2 q2 = ivec2(q1.x >> 1, q1.y);
  return gr_pick2(q2) == q1 ? 0.125 * r : 0.125 + 0.125 * r;
}
`;

/**
 * How much of the meadow stands at a distance from the eye, and how wide its blades are there. Both depend on the
 * distance alone, never on the level drawing the blade, so nothing steps where the levels meet.
 */
const BLADE_THIN_GLSL = /* glsl */ `
uniform vec2 uGrassEye;
uniform vec4 uRings;
uniform vec2 uSink;
uniform vec2 uLevelDensity;
uniform vec2 uLevelWidth;
uniform vec2 uClose;
uniform vec2 uQualityClose;
uniform float uShrinkBand;
uniform float uDensity;
uniform float uDensityPrevious;
uniform float uQualityBlend;
float densityAt(float dist) {
  return mix(mix(1.0, uLevelDensity.x, smoothstep(uRings.x, uRings.y, dist)), uLevelDensity.y, smoothstep(uRings.z, uRings.w, dist));
}
float bladeDensityFor(vec2 root, float dist, float density) {
  float near = 1.0 - smoothstep(${glsl(SLEEP.swardDetailFrom)}, ${glsl(SLEEP.swardDetailTo)}, dist);
  float winter = 1.0 - smoothstep(0.72, 1.06, length((root - vec2(${glsl(ISLES.sleeping.x)}, ${glsl(ISLES.sleeping.z)})) / vec2(${glsl(ISLES.sleeping.rx)}, ${glsl(ISLES.sleeping.rz)})));
  return min(1.0, density * mix(1.0, ${glsl(SLEEP.swardDensity)}, winter * near));
}
float bladeDensity(vec2 root, float dist) {
  return bladeDensityFor(root, dist, max(uDensity, uDensityPrevious));
}
float qualityCloseFor(vec2 root, float dist, float density) {
  if (uQualityClose.x <= 0.0) return 0.0;
  return 1.0 - smoothstep(uQualityClose.x, uQualityClose.y, bladeDensityFor(root, dist, density));
}
float bladeClose(vec2 root, float dist) {
  // Close the extra segment before changing populations; the coarser blade is then identical.
  float detail = mix(qualityCloseFor(root, dist, uDensityPrevious), qualityCloseFor(root, dist, uDensity), uQualityBlend);
  return max(smoothstep(uClose.x, uClose.y, dist), detail);
}
float widthAt(float dist) {
  return mix(mix(1.0, uLevelWidth.x, smoothstep(uRings.x, uRings.y, dist)), uLevelWidth.y, smoothstep(uRings.z, uRings.w, dist));
}
/** 0..1 size of a blade: it shrinks, whole, over the last metres before thinning removes it, and the far edge sinks away. \`share\` is the blade's fixed part of what thinning keeps. */
float standing(float rank, float share, float dist) {
  float here = densityAt(dist) * share;
  float ahead = densityAt(dist + uShrinkBand) * share;
  float grown = smoothstep(0.0, 1.0, (here - rank) / max(here - ahead, 1e-5));
  return grown * (1.0 - smoothstep(uSink.x, uSink.y, dist));
}
/** Keep both populations during a quality change and grow/shrink each blade in place. */
float qualityStanding(float rank, float share, float dist, vec2 root) {
  if (uQualityBlend >= 1.0) return standing(rank, share, dist);
  float base = max(bladeDensity(root, dist), 1e-5);
  float before = share * bladeDensityFor(root, dist, uDensityPrevious) / base;
  float after = share * bladeDensityFor(root, dist, uDensity) / base;
  return mix(standing(rank, before, dist), standing(rank, after, dist), uQualityBlend);
}
`;

/**
 * The blade table: everything about a blade that does not change from vertex to vertex or frame to frame is
 * computed once per blade here, into four texels, instead of once per vertex in the blade shader (thirteen
 * times per blade). The random draws happen in the same order as before, so every blade is where it was.
 */
const TABLE_FRAG = /* glsl */ `
precision highp float;
precision highp int;
${ATMO_GLSL}
${HEIGHTFIELD_GLSL}
${FIELDS_GLSL}
${GRASS_GLSL}
${BLADE_RAND_GLSL}
${BLADE_LOD_GLSL}
uniform sampler2D uTiles;
uniform int uTileCount;
uniform float uTileSize;
layout(location = 0) out vec4 oRoot;
layout(location = 1) out vec4 oShape;
layout(location = 2) out vec4 oTint;
layout(location = 3) out vec4 oFlower;

void main() {
  int b = int(gl_FragCoord.y) * ${TABLE_WIDTH} + int(gl_FragCoord.x);
  int per = uGrid.x * uGrid.y;
  int tileIndex = b / per;
  oRoot = vec4(0.0, 0.0, 0.0, 2.0);
  oShape = vec4(0.0);
  oTint = vec4(0.0);
  oFlower = vec4(0.0);
  if (tileIndex >= uTileCount) return;
  vec2 tile = texelFetch(uTiles, ivec2(tileIndex, 0), 0).xy;
  ivec2 cell = gr_cell(ivec2(floor(tile / uTileSize + 0.5)), b - tileIndex * per);
  uint s = gr_hash(uvec2(cell));
  vec2 root2 = (vec2(cell - GR_ORIGIN) + vec2(gr_rand(s), gr_rand(s))) * (uTileSize / ${FINE}.0);
  float rank = gr_rank(cell, gr_rand(s));

  vec2 uv = domainUv(root2);
  if (!insideUv(uv)) return;
  vec4 hn = texture(uHeightTex, uv);
  float groundH = hn.r;
  float edge = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 1.2).toFixed(2)}, groundH);
  float tufts = smoothstep(0.48, 0.72, vnoise(root2 * 0.35));
  float keep = (edge > 0.85 ? 1.0 : edge * edge * tufts) * mix(1.0, ${glsl(tuning.wood.grassDensity)}, woodFloorAt(root2));
  keep *= smoothstep(0.55, 0.7, hn.b) * pondDry(root2, groundH) * boatsDry(root2, groundH);
  vec4 surf = surfaceAt(root2);
  keep *= surf.x;
  vec4 fld = fieldAt(root2);
  oRoot = vec4(root2, groundH, rank);

  float seed = gr_rand(s);
  float lush = fbm(root2 * 0.035 + 17.0);
  float shortPatch = smoothstep(0.52, 0.68, fbm(root2 * 0.05 - 23.0));
  float fringe = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 2.2).toFixed(2)}, groundH);
  float pasture = pastureAt(root2);
  /** The frosted sward: it takes a blade's width, its tufts and its curve down with its height. */
  float sward = sleepFloorAt(root2);
  float h = (1.1 + 1.9 * smoothstep(0.3, 0.75, lush) + 0.55 * gr_rand(s)) * (0.2 + 0.8 * fringe * fringe) * (1.0 - shortPatch * 0.5);
  float tuft = step(0.93, gr_rand(s)) * smoothstep(0.45, 0.8, lush) * step(95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0)));
  h = mix(h, (0.34 + 0.26 * lush + 0.14 * gr_rand(s)) * (1.0 + tuft * mix(2.2, ${glsl(SLEEP.swardTuft)}, sward)), pasture);
  float hilltop = 1.0 - smoothstep(45.0, 95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0)));
  float garden = 1.0 - smoothstep(14.0, 30.0, length(root2 - vec2(${COTTAGE.x}.0, ${COTTAGE.z}.0)));
  float grazed = max(hilltop, garden);
  float hay = step(fld.y, 0.22) * fld.w * (1.0 - grazed);
  float rush = step(0.86, fld.y) * fld.w * (1.0 - grazed);
  h *= (1.0 + hay * 1.5 + rush * 1.2) * (1.0 + ${glsl(HOME_LUSH)} * homeAt(root2)) * mix(1.0, 0.78, hilltop) * mix(1.0, 0.5, garden) * croppedAt(root2) * woodGrassCrop(root2) * mix(1.0, ${glsl(SLEEP.swardCrop)}, sward) * troddenAt(root2);
  float width = (0.15 + 0.1 * gr_rand(s)) * mix(1.0, ${glsl(SLEEP.swardWidth)}, sward) * mix(1.0, 0.4, woodFloorAt(root2)) * mix(1.0, 0.4, pondBankAt(root2));
  float angle = gr_rand(s) * 6.2831853;
  float curve = (0.12 + 0.28 * gr_rand(s)) * mix(1.0, ${glsl(SLEEP.swardCurve)}, sward);
  float flowerRand = step(gr_rand(s), surf.z * 0.1 * (1.0 - sward) * (1.0 - woodFloorAt(root2)) * (1.0 - pondBankAt(root2)));
  float petal = gr_rand(s);
  // The petal colour class is stored as a small integer, exact in half float, instead of the draw it comes from.
  float petalClass = petal < 0.45 ? 0.0 : petal < 0.65 ? 1.0 : petal < 0.9 ? 2.0 : 3.0;

  vec3 tint = grassTint(root2) * (0.8 + 0.4 * seed) * (0.92 + 0.16 * fract(fld.y * 7.3) * fld.w);
  tint = mix(tint, vec3(0.62, 0.52, 0.2), hay * 0.55);
  tint = mix(tint, vec3(0.13, 0.24, 0.1), rush * 0.5);

  oShape = vec4(keep, h, width, angle);
  oTint = vec4(tint, curve);
  oFlower = vec4(seed, flowerRand, petalClass, 0.2 + 0.5 * pasture);
}`;

const TABLE_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/**
 * What the blade's shading needs that is the same for every fragment of the blade: its root colour, its ambient
 * occlusion as a line in t, and how flat the wind has laid it. Computed per vertex (`tint`, `groundH`, `dist`, `wa`
 * in scope) so the fragment shader, which runs several times per pixel under multisampling, does not.
 */
const BLADE_SHADE_GLSL = /* glsl */ `
  float shadeFringe = smoothstep(${(GRASS_LINE - 0.5).toFixed(2)}, ${(GRASS_LINE + 1.4).toFixed(2)}, groundH);
  float far = smoothstep(60.0, 170.0, dist);
  vRoot = mix(mix(tint * 0.55, uGrassRoot, shadeFringe), mix(uGrassRoot, tint, 0.62), far);
  float aoLow = mix(0.7, 0.22, shadeFringe);
  float aoFar = far * 0.75;
  vAo = vec2(mix(aoLow, 1.0, aoFar), (1.0 - aoFar) * (1.0 - aoLow));
  /**
   * Frost takes the colour out of a blade, thickest where it caught the sky and thinnest down in the roots, so a
   * rimed sward pales toward its tips instead of every blade going one flat white. The lamp, and later the
   * morning, light what is there rather than being added on top of it, so grass under the dawn goes green in the
   * sun instead of turning into pale confetti, and grass held stiff by rime does not flash as the wind lays it.
   */
  float winter = 1.0 - smoothstep(0.72, 1.06, length((root2 - vec2(${glsl(ISLES.sleeping.x)}, ${glsl(ISLES.sleeping.z)})) / vec2(${glsl(ISLES.sleeping.rx)}, ${glsl(ISLES.sleeping.rz)})));
  // Short winter stems do not have the deep occlusion of the metre-high meadow.
  vAo = mix(vAo, vec2(0.86, 0.14), winter);
  float green = morningAt(root2);
  vec3 winterRoot = mix(vec3(0.23, 0.29, 0.23), vec3(0.16, 0.27, 0.09), green);
  vec3 winterTip = mix(vec3(0.38, 0.44, 0.31), vec3(0.26, 0.43, 0.13), green);
  vRoot = mix(vRoot, winterRoot, winter * 0.9);
  vTint = mix(vTint, winterTip, winter * 0.85);
  float rime = frostAt(root2);
  vec3 pale = rimeColour();
  vFlat = smoothstep(0.3, 1.0, wa) * (1.0 - 0.55 * rime);
  /** A rimed blade is shaded flat rather than rounded off like a stem, so a sward reads as one surface. */
  vSideDir *= 1.0 - 0.5 * rime;
  vec3 warm = lampLight(vec3(root2.x, groundH + 0.2, root2.y), vec3(0.0, 1.0, 0.0))
            + dawnLight(vec3(root2.x, groundH + 0.3, root2.y), vec3(0.0, 1.0, 0.0));
  vRoot = mix(vRoot, pale * 0.82, rime * ${glsl(SLEEP.rimeRoot)});
  vTint = mix(vTint, pale, rime * ${glsl(SLEEP.rimeTip)});
  vLocalLight = warm;
`;

const VERT = /* glsl */ `
${ATMO_GLSL}
${RIME_GLSL}
in vec2 aTile;
uniform vec3 uGrassRoot;
uniform sampler2D uRootTex;
uniform sampler2D uShapeTex;
uniform sampler2D uTintTex;
uniform sampler2D uFlowerTex;
${BLADE_THIN_GLSL}
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSideDir;
out vec3 vGroundN;
out vec3 vTint;
out vec4 vFog;
out float vT;
out float vFlat;
out vec3 vRoot;
out vec2 vAo;
out float vSun;
out vec3 vLocalLight;
out vec4 vFlower;

void collapse() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}

void main() {
  ivec2 at = ivec2(gl_InstanceID % ${TABLE_WIDTH}, gl_InstanceID / ${TABLE_WIDTH});
  vec4 root = texelFetch(uRootTex, at, 0);
  vec2 root2 = root.xy;
  float groundH = root.z;
  float rank = root.w;
  float dist = length(root2 - uGrassEye);
  float thinned = densityAt(dist);
  if (rank >= thinned * bladeDensity(root2, dist)) { collapse(); return; }
  vec4 shape = texelFetch(uShapeTex, at, 0);
  float share = bladeDensity(root2, dist) * shape.x;
  if (rank >= thinned * share) { collapse(); return; }
  vec4 tintIn = texelFetch(uTintTex, at, 0);
  vec4 fl = texelFetch(uFlowerTex, at, 0);

  float side01 = position.x;
  float t = mix(position.y, position.z, bladeClose(root2, dist));
  float seed = fl.x;
  float life = lifeAt(root2);
  float stand = qualityStanding(rank, share, dist, root2);
  float h = shape.y * mix(0.72, 1.0, life) * stand;
  float width = shape.z * widthAt(dist) * stand;
  float angle = shape.w;
  float curve = tintIn.w;
  float flower = fl.y * step(0.5, life);
  float petalClass = fl.z;
  h *= 1.0 + flower * fl.w;
  vec3 rootPos = vec3(root2.x, groundH - mix(0.12, ${glsl(SLEEP.rootDepth)}, 1.0 - smoothstep(0.72, 1.06, length((root2 - vec2(${glsl(ISLES.sleeping.x)}, ${glsl(ISLES.sleeping.z)})) / vec2(${glsl(ISLES.sleeping.rx)}, ${glsl(ISLES.sleeping.rz)})))), root2.y);

  vec2 uv = domainUv(root2);
  vec4 ground = groundAt(root2);
  vec4 bend = texture(uBendTex, uv);
  vec4 wind = texture(uWindTex, uv);
  float sp = length(wind.xy);

  vec2 facing = vec2(cos(angle), sin(angle));
  float ph = seed * 43.1;
  float flutterAmp = (0.04 + 0.012 * sp) * (0.6 + 0.4 * t) * mix(0.3, 1.0, life);
  vec2 flutter = vec2(sin(uTime * (2.7 + seed * 2.1) + ph), sin(uTime * (2.1 + seed * 1.6) + ph * 1.7)) * flutterAmp;
  vec2 wb = bend.xy + flutter;
  float wa = length(wb);
  vec2 wdir = wa > 1e-4 ? wb / wa : facing;
  vec2 align = dot(facing, wdir) >= 0.0 ? wdir : -wdir;
  facing = normalize(mix(facing, align, smoothstep(0.2, 1.0, wa) * 0.75));

  vec2 lean = wb + facing * curve;
  float ll = length(lean);
  float A = clamp(ll, 1e-3, 1.5);
  vec2 dir = ll > 1e-4 ? lean / ll : facing;
  float sA = t * A;
  float horiz = h * (1.0 - cos(sA)) / A;
  float vert = h * sin(sA) / A;
  vec3 spine = vec3(dir.x * horiz, vert, dir.y * horiz);
  vec3 tangent = vec3(dir.x * sin(sA), cos(sA), dir.y * sin(sA));
  vec3 sideDir = vec3(-facing.y, 0.0, facing.x);
  float w = width * (1.0 - smoothstep(0.3, 1.0, t) * 0.85);
  w = mix(w, width * (t > 0.72 ? 1.9 : 0.3), flower);
  vec3 world = rootPos + spine + sideDir * side01 * w * 0.5;

  vec3 nrm = cross(sideDir, tangent);
  vNormal = length(nrm) > 1e-4 ? normalize(nrm) : vec3(0.0, 1.0, 0.0);
  vSideDir = sideDir * side01;
  vGroundN = ground.xyz;
  vec3 tint = mix(stillGrey(tintIn.rgb), tintIn.rgb, life);
  vTint = tint;
  ${BLADE_SHADE_GLSL}
  vSun = mix(ground.w, 1.0, t * t * 0.3) * cloudShadow(root2);
  vFog = fogOf(world);
  vWorld = world;
  vT = t;
  vec3 bloom = petalClass < 0.5 ? vec3(1.0, 0.8, 0.14) : petalClass < 1.5 ? vec3(0.97, 0.95, 0.9) : petalClass < 2.5 ? vec3(0.93, 0.52, 0.68) : vec3(0.62, 0.46, 0.88);
  vFlower = vec4(mix(stillGrey(bloom), bloom, life), flower);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

/** The blade shader as it was before the table: every trait recomputed per vertex. `?blades=direct` selects it for comparison. */
const VERT_DIRECT = /* glsl */ `
${ATMO_GLSL}
${HEIGHTFIELD_GLSL}
${FIELDS_GLSL}
${GRASS_GLSL}
${RIME_GLSL}
${BLADE_RAND_GLSL}
${BLADE_LOD_GLSL}
${BLADE_THIN_GLSL}
in vec2 aTile;
uniform float uTileSize;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSideDir;
out vec3 vGroundN;
out vec3 vTint;
out vec4 vFog;
out float vT;
out float vFlat;
out vec3 vRoot;
out vec2 vAo;
out float vSun;
out vec3 vLocalLight;
out vec4 vFlower;

void collapse() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}

void main() {
  ivec2 cell = gr_cell(ivec2(floor(aTile / uTileSize + 0.5)), gl_InstanceID % (uGrid.x * uGrid.y));
  uint s = gr_hash(uvec2(cell));
  vec2 root2 = (vec2(cell - GR_ORIGIN) + vec2(gr_rand(s), gr_rand(s))) * (uTileSize / ${FINE}.0);
  float rank = gr_rank(cell, gr_rand(s));

  vec2 uv = domainUv(root2);
  if (!insideUv(uv)) { collapse(); return; }
  float dist = length(root2 - uGrassEye);
  float thinned = densityAt(dist);
  if (rank >= thinned * bladeDensity(root2, dist)) { collapse(); return; }
  vec4 hn = texture(uHeightTex, uv);
  float groundH = hn.r;
  float edge = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 1.2).toFixed(2)}, groundH);
  float tufts = smoothstep(0.48, 0.72, vnoise(root2 * 0.35));
  float share = bladeDensity(root2, dist) * (edge > 0.85 ? 1.0 : edge * edge * tufts) * mix(1.0, ${glsl(tuning.wood.grassDensity)}, woodFloorAt(root2));
  share *= smoothstep(0.55, 0.7, hn.b) * pondDry(root2, groundH) * boatsDry(root2, groundH);
  vec4 surf = surfaceAt(root2);
  share *= surf.x;
  vec4 fld = fieldAt(root2);
  if (rank >= thinned * share) { collapse(); return; }

  float side01 = position.x;
  float t = mix(position.y, position.z, bladeClose(root2, dist));
  float seed = gr_rand(s);
  float lush = fbm(root2 * 0.035 + 17.0);
  float shortPatch = smoothstep(0.52, 0.68, fbm(root2 * 0.05 - 23.0));
  float fringe = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 2.2).toFixed(2)}, groundH);
  float life = lifeAt(root2);
  float pasture = pastureAt(root2);
  /** The frosted sward: it takes a blade's width, its tufts and its curve down with its height. */
  float sward = sleepFloorAt(root2);
  float h = (1.1 + 1.9 * smoothstep(0.3, 0.75, lush) + 0.55 * gr_rand(s)) * (0.2 + 0.8 * fringe * fringe) * (1.0 - shortPatch * 0.5);
  float tuft = step(0.93, gr_rand(s)) * smoothstep(0.45, 0.8, lush) * step(95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0)));
  h = mix(h, (0.34 + 0.26 * lush + 0.14 * gr_rand(s)) * (1.0 + tuft * mix(2.2, ${glsl(SLEEP.swardTuft)}, sward)), pasture);
  float hilltop = 1.0 - smoothstep(45.0, 95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0)));
  float garden = 1.0 - smoothstep(14.0, 30.0, length(root2 - vec2(${COTTAGE.x}.0, ${COTTAGE.z}.0)));
  float grazed = max(hilltop, garden);
  float hay = step(fld.y, 0.22) * fld.w * (1.0 - grazed);
  float rush = step(0.86, fld.y) * fld.w * (1.0 - grazed);
  h *= (1.0 + hay * 1.5 + rush * 1.2) * (1.0 + ${glsl(HOME_LUSH)} * homeAt(root2)) * mix(1.0, 0.78, hilltop) * mix(1.0, 0.5, garden) * croppedAt(root2) * woodGrassCrop(root2) * mix(1.0, ${glsl(SLEEP.swardCrop)}, sward) * troddenAt(root2);
  float stand = qualityStanding(rank, share, dist, root2);
  h *= mix(0.72, 1.0, life) * stand;
  float width = (0.15 + 0.1 * gr_rand(s)) * mix(1.0, ${glsl(SLEEP.swardWidth)}, sward) * mix(1.0, 0.4, woodFloorAt(root2)) * mix(1.0, 0.4, pondBankAt(root2)) * widthAt(dist) * stand;
  float angle = gr_rand(s) * 6.2831853;
  float curve = (0.12 + 0.28 * gr_rand(s)) * mix(1.0, ${glsl(SLEEP.swardCurve)}, sward);
  float flower = step(gr_rand(s), surf.z * 0.1 * (1.0 - sward) * (1.0 - woodFloorAt(root2)) * (1.0 - pondBankAt(root2))) * step(0.5, life);
  float petal = gr_rand(s);
  h *= 1.0 + flower * (0.2 + 0.5 * pasture);
  vec3 rootPos = vec3(root2.x, groundH - mix(0.12, ${glsl(SLEEP.rootDepth)}, 1.0 - smoothstep(0.72, 1.06, length((root2 - vec2(${glsl(ISLES.sleeping.x)}, ${glsl(ISLES.sleeping.z)})) / vec2(${glsl(ISLES.sleeping.rx)}, ${glsl(ISLES.sleeping.rz)})))), root2.y);

  vec4 ground = groundAt(root2);
  vec4 bend = texture(uBendTex, uv);
  vec4 wind = texture(uWindTex, uv);
  float sp = length(wind.xy);

  vec2 facing = vec2(cos(angle), sin(angle));
  float ph = seed * 43.1;
  float flutterAmp = (0.04 + 0.012 * sp) * (0.6 + 0.4 * t) * mix(0.3, 1.0, life);
  vec2 flutter = vec2(sin(uTime * (2.7 + seed * 2.1) + ph), sin(uTime * (2.1 + seed * 1.6) + ph * 1.7)) * flutterAmp;
  vec2 wb = bend.xy + flutter;
  float wa = length(wb);
  vec2 wdir = wa > 1e-4 ? wb / wa : facing;
  vec2 align = dot(facing, wdir) >= 0.0 ? wdir : -wdir;
  facing = normalize(mix(facing, align, smoothstep(0.2, 1.0, wa) * 0.75));

  vec2 lean = wb + facing * curve;
  float ll = length(lean);
  float A = clamp(ll, 1e-3, 1.5);
  vec2 dir = ll > 1e-4 ? lean / ll : facing;
  float sA = t * A;
  float horiz = h * (1.0 - cos(sA)) / A;
  float vert = h * sin(sA) / A;
  vec3 spine = vec3(dir.x * horiz, vert, dir.y * horiz);
  vec3 tangent = vec3(dir.x * sin(sA), cos(sA), dir.y * sin(sA));
  vec3 sideDir = vec3(-facing.y, 0.0, facing.x);
  float w = width * (1.0 - smoothstep(0.3, 1.0, t) * 0.85);
  w = mix(w, width * (t > 0.72 ? 1.9 : 0.3), flower);
  vec3 world = rootPos + spine + sideDir * side01 * w * 0.5;

  vec3 nrm = cross(sideDir, tangent);
  vNormal = length(nrm) > 1e-4 ? normalize(nrm) : vec3(0.0, 1.0, 0.0);
  vSideDir = sideDir * side01;
  vGroundN = ground.xyz;
  vec3 tint = grassTint(root2) * (0.8 + 0.4 * seed) * (0.92 + 0.16 * fract(fld.y * 7.3) * fld.w);
  tint = mix(tint, vec3(0.62, 0.52, 0.2), hay * 0.55);
  tint = mix(tint, vec3(0.13, 0.24, 0.1), rush * 0.5);
  tint = mix(stillGrey(tint), tint, life);
  vTint = tint;
  ${BLADE_SHADE_GLSL}
  vSun = mix(ground.w, 1.0, t * t * 0.3) * cloudShadow(root2);
  vFog = fogOf(world);
  vWorld = world;
  vT = t;
  vec3 bloom = petal < 0.45 ? vec3(1.0, 0.8, 0.14) : petal < 0.65 ? vec3(0.97, 0.95, 0.9) : petal < 0.9 ? vec3(0.93, 0.52, 0.68) : vec3(0.62, 0.46, 0.88);
  vFlower = vec4(mix(stillGrey(bloom), bloom, life), flower);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uRoom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundBounce;
uniform float uShower;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vSideDir;
in vec3 vGroundN;
in vec3 vTint;
in vec4 vFog;
in float vT;
in float vFlat;
in vec3 vRoot;
in vec2 vAo;
in float vSun;
in vec3 vLocalLight;
in vec4 vFlower;

void main() {
  if (distance(vWorld.xz, vec2(240.0, -460.0)) < 48.0) discard;
  if (uRoom.z > 0.0 && distance(vWorld.xz, uRoom.xy) > uRoom.z) discard;
  // Multisampling evaluates a sliver of a blade outside its own edges, where t extrapolates far past 1 and lights a pixel like a spark.
  float T = clamp(vT, 0.0, 1.0);
  float sun = clamp(vSun, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0) N = -N;
  N = normalize(N + vSideDir * 0.35 + vec3(0.0, 1e-3, 0.0));
  N = normalize(mix(N, vGroundN, 0.5) + vec3(0.0, 1e-3, 0.0));

  vec3 alb = mix(vRoot, vTint, smoothstep(0.0, 0.95, T));
  float flattened = vFlat * T;
  alb = mix(alb, alb * 1.45 + vec3(0.05, 0.06, 0.035), flattened);
  alb = mix(alb, vFlower.rgb, vFlower.a * smoothstep(0.66, 0.78, T));

  float ao = vAo.x + vAo.y * smoothstep(0.0, 0.8, T);
  float diff = clamp(dot(N, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  float toward = max(dot(-V, uSunDir), 0.0);
  float back = (toward * toward) * (toward * toward);
  vec3 trans = uSunColor * vTint * back * T * T * 0.9;
  vec3 H = normalize(uSunDir + V);
  alb *= 1.0 - 0.14 * uShower;
  float spec = pow(max(dot(N, H), 0.0), 24.0 + 40.0 * uShower) * (0.16 + 0.5 * flattened + 0.9 * uShower) * T;
  vec3 ambient = mix(uGroundBounce, uSkyAmbient, N.y * 0.5 + 0.5);

  vec3 col = alb * (ambient + vLocalLight) * ao + (alb * uSunColor * diff * ao + trans + uSunColor * spec) * sun;
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), 1.0);
}`;

/**
 * x is the side, y the height along the blade. z is the height the vertex slides to as the blade nears the next
 * level: the lowest segment closes up, leaving the next level's blade exactly (one segment fewer).
 */
function bladeTemplate(segments: number, closes: boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const closed = closes ? Math.max(i - 1, 0) / (segments - 1) : t;
    pos.push(-1, t, closed, 1, t, closed);
  }
  pos.push(0, 1, 1);
  const index: number[] = [];
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (segments - 1) * 2;
  index.push(last, last + 1, last + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

interface Lod {
  spec: LodSpec;
  geo: THREE.InstancedBufferGeometry;
  tiles: THREE.InstancedBufferAttribute;
  tileTex: THREE.DataTexture;
  table: THREE.WebGLRenderTarget;
  tableMat: THREE.ShaderMaterial;
  count: number;
  previousCount: number;
  tilesChanged: boolean;
  dirty: boolean;
}

/** Tiles a level can hold: every tile touching the ring between its reach and the previous level's. */
function tileCapacity(reach: number, prevReach: number): number {
  const outer = reach + TILE * 1.5;
  const inner = Math.max(0, prevReach - TILE * 1.5);
  return Math.ceil((Math.PI * (outer * outer - inner * inner)) / (TILE * TILE)) + 8;
}

/**
 * A meadow placed on the GPU in world-anchored tiles around the camera. The CPU only picks visible tiles with
 * land in them; each blade's place, size and colour come from a hash of its world cell, so nothing swims.
 * A per-level blade table (see TABLE_FRAG) holds each blade's fixed traits; the blade shader reads them.
 */
export class Grass {
  readonly group = new THREE.Group();
  private readonly lods: Lod[] = [];
  private readonly frustum = new THREE.Frustum();
  private readonly matrix = new THREE.Matrix4();
  private readonly bounds = new Map<number, THREE.Sphere | null>();
  private readonly quad = new FullScreenQuad();
  private tablesDirty = true;
  private readonly tableState = new Float64Array(17).fill(NaN);
  /** Where thinning is measured from: the camera `update` picked tiles for, on the ground plane. */
  private readonly eye = { value: new THREE.Vector2() };
  /** On a meadow sown sparsely (`uDensity`, the lite tier) the finer levels hold nothing but blades that never show, so tiles start at the first level that holds them all. */
  private finest = 0;
  /** `?blades=direct`: the per-vertex blade shader, for before/after comparison with the table. */
  private readonly direct = params.blades === 'direct';
  private readonly coarsest = Math.min(params.grasslod ?? LODS.length - 1, LODS.length - 1);

  private readonly thinning;
  private reachScale = 1;
  private reachFrom = 1;
  private reachTarget = 1;

  constructor() {
    const density = Math.max(0, Math.min(1, params.grass ?? (params.lite ? 0.25 : 1)));
    const specs = LODS.map((base) => ({ ...base }));
    const last = specs[specs.length - 1];
    const thinning = this.thinning = {
      uGrassEye: this.eye,
      uRings: { value: new THREE.Vector4(specs[0].reach * specs[0].thinFrom, specs[0].reach, specs[1].reach * specs[1].thinFrom, specs[1].reach) },
      uSink: { value: new THREE.Vector2(last.reach * last.thinFrom, last.reach) },
      uLevelDensity: { value: new THREE.Vector2(...specs.slice(1).map((l) => (l.cols * l.rows) / (FINE * FINE))) },
      uLevelWidth: { value: new THREE.Vector2(...specs.slice(1).map((l) => l.widthScale)) },
      uShrinkBand: { value: SHRINK_BAND },
      uDensity: { value: density },
      uDensityPrevious: { value: density },
      uQualityBlend: { value: 1 },
    };
    while (this.finest < this.coarsest && density <= thinning.uLevelDensity.value.getComponent(this.finest)) this.finest++;
    for (const [level, spec] of specs.entries()) {
      const blades = spec.cols * spec.rows;
      // Reserve all quality levels once. Sparse tiers may cover the inner rings too;
      // promotion must never allocate a new MRT or drop tiles because the lite pool was smaller.
      spec.maxTiles = Math.min(spec.maxTiles, tileCapacity(level === this.coarsest ? last.reach : spec.reach, 0));
      const template = bladeTemplate(spec.segments, level < specs.length - 1);
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = template.index;
      geo.setAttribute('position', template.attributes.position);
      const tileArray = new Float32Array(spec.maxTiles * 2);
      const tiles = new THREE.InstancedBufferAttribute(tileArray, 2, false, blades);
      tiles.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aTile', tiles);
      geo.instanceCount = 0;
      const tileTex = new THREE.DataTexture(tileArray, spec.maxTiles, 1, THREE.RGFormat, THREE.FloatType);
      tileTex.minFilter = tileTex.magFilter = THREE.NearestFilter;
      const rows = Math.ceil((spec.maxTiles * blades) / TABLE_WIDTH);
      const table = new THREE.WebGLRenderTarget(TABLE_WIDTH, rows, {
        count: 4,
        type: THREE.FloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      });
      // Root and shape stay full float (a half-float angle would turn blades by a visible fraction of a degree).
      for (let i = 2; i < 4; i++) table.textures[i].type = THREE.HalfFloatType;
      const tableMat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: TABLE_VERT,
        fragmentShader: TABLE_FRAG,
        uniforms: {
          ...atmo.uniforms,
          ...grassUniforms,
          uTiles: { value: tileTex },
          uTileCount: { value: 0 },
          uTileSize: { value: TILE },
          uGrid: { value: new THREE.Vector2(spec.cols, spec.rows) },
          uLevel: { value: level },
        },
        depthTest: false,
        depthWrite: false,
      });
      const mat = new THREE.ShaderMaterial({
        vertexShader: this.direct ? VERT_DIRECT : VERT,
        fragmentShader: FRAG,
        uniforms: {
          ...atmo.uniforms,
          ...grassUniforms,
          uRootTex: { value: table.textures[0] },
          uShapeTex: { value: table.textures[1] },
          uTintTex: { value: table.textures[2] },
          uFlowerTex: { value: table.textures[3] },
          ...thinning,
          uClose: { value: new THREE.Vector2(spec.reach * spec.thinFrom, spec.reach) },
          uQualityClose: { value: new THREE.Vector2(...(level === 0 ? [0.25, 0.55] as const : level === 1 ? [0.125, 0.25] as const : [0, 0] as const)) },
          uTileSize: { value: TILE },
          uGrid: { value: new THREE.Vector2(spec.cols, spec.rows) },
          uLevel: { value: level },
        },
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.lods.push({ spec, geo, tiles, tileTex, table, tableMat, count: 0, previousCount: 0, tilesChanged: false, dirty: true });
    }
    this.setQuality(density, params.lite ? 0.7 : 1, true);
    // Height and surface bakes can change even on a forced move to the same domain.
    onWindowMove(() => { this.tablesDirty = true; });
  }

  /** Explicit grass/lite overrides stay reproducible while normal play follows the governor. */
  setQuality(density: number, reach: number, immediate = false): void {
    const u = this.thinning;
    density = Math.max(0, Math.min(1, params.grass ?? (params.lite ? 0.25 : density)));
    reach = params.lite ? 0.7 : THREE.MathUtils.clamp(reach, 0.7, 1);
    if (!immediate && density === u.uDensity.value && reach === this.reachTarget) return;
    u.uDensityPrevious.value = immediate ? density : THREE.MathUtils.lerp(u.uDensityPrevious.value, u.uDensity.value, u.uQualityBlend.value);
    u.uDensity.value = density;
    this.reachFrom = immediate ? reach : this.reachScale;
    this.reachTarget = reach;
    u.uQualityBlend.value = immediate ? 1 : 0;
    this.updateQuality(0, true);
  }

  /** One-second transitions preserve world-anchored roots and require no shader recompilation. */
  private updateQuality(dt: number, force = false): void {
    const u = this.thinning;
    if (!force && u.uQualityBlend.value === 1) return;
    u.uQualityBlend.value = Math.min(1, u.uQualityBlend.value + Math.max(0, dt));
    if (u.uQualityBlend.value === 1) u.uDensityPrevious.value = u.uDensity.value;
    this.reachScale = THREE.MathUtils.lerp(this.reachFrom, this.reachTarget, u.uQualityBlend.value);
    for (let i = 0; i < this.lods.length; i++) {
      const l = this.lods[i];
      l.spec.reach = LODS[i].reach * this.reachScale;
      const mat = (this.group.children[i] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material;
      mat.uniforms.uClose.value.set(l.spec.reach * l.spec.thinFrom, l.spec.reach);
    }
    const first = this.lods[0].spec, second = this.lods[1].spec;
    u.uRings.value.set(first.reach * first.thinFrom, first.reach, second.reach * second.thinFrom, second.reach);
    const last = this.lods[this.lods.length - 1].spec;
    u.uSink.value.set(last.reach * last.thinFrom, last.reach);
    u.uShrinkBand.value = SHRINK_BAND * this.reachScale;
    this.finest = 0;
    const density = Math.max(u.uDensity.value, u.uDensityPrevious.value);
    while (this.finest < this.coarsest && density <= u.uLevelDensity.value.getComponent(this.finest)) this.finest++;
  }

  get quality(): { density: number; reach: number } {
    const u = this.thinning;
    return { density: THREE.MathUtils.lerp(u.uDensityPrevious.value, u.uDensity.value, u.uQualityBlend.value), reach: this.reachScale };
  }

  get bladesDrawn(): number {
    return this.lods.reduce((n, l) => n + l.count * l.spec.cols * l.spec.rows, 0);
  }

  /** These MRT shaders are not scene materials or ordinary single-target simulations. */
  async precompile(renderer: THREE.WebGLRenderer): Promise<void> {
    if (this.direct) return;
    const previous = renderer.getRenderTarget();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, this.lods[0].tableMat);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene.add(mesh);
    try {
      for (const lod of this.lods) {
        mesh.material = lod.tableMat;
        renderer.setRenderTarget(lod.table);
        await renderer.compileAsync(scene, camera);
      }
    } finally {
      renderer.setRenderTarget(previous);
      geometry.dispose();
    }
  }

  /** The sphere holding every blade a tile could grow, or null where it has no land. Sized from the ground under the whole tile: on a cliff the corners stand metres above and below the middle. */
  private boundsOf(tx: number, tz: number): THREE.Sphere | null {
    const key = tx * 100003 + tz;
    let v = this.bounds.get(key);
    if (v === undefined) {
      const x = tx * TILE;
      const z = tz * TILE;
      let land = false;
      let low = Infinity;
      let high = -Infinity;
      for (const [ox, oz] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]]) {
        const sx = x + ox * TILE;
        const sz = z + oz * TILE;
        const h = heightAt(sx, sz);
        low = Math.min(low, h);
        high = Math.max(high, h);
        /** Short forest tufts share the same ground and wind as the meadow blades. */
        if (h > GRASS_LINE - 0.8) land = true;
      }
      const rise = (high - low) / 2 + MAX_BLADE / 2;
      v = land ? new THREE.Sphere(new THREE.Vector3(x + TILE / 2, (low + high + MAX_BLADE) / 2, z + TILE / 2), Math.hypot(TILE * 0.7072 + MAX_BLADE * 0.6, rise) + 1) : null;
      if (this.bounds.size > 60000) this.bounds.clear();
      this.bounds.set(key, v);
    }
    return v;
  }

  /** Picks the tiles to draw for this camera; call `bake` afterwards, before the scene is drawn. */
  update(camera: THREE.Camera, dt = 0): void {
    this.updateQuality(dt);
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    const cx = camera.position.x;
    const cz = camera.position.z;
    this.eye.value.set(cx, cz);
    const reach = this.lods[this.lods.length - 1].spec.reach;
    for (const l of this.lods) { l.count = 0; l.tilesChanged = false; }
    const x0 = Math.floor((Math.max(cx - reach, WINDOW.minX)) / TILE);
    const x1 = Math.floor((Math.min(cx + reach, WINDOW.minX + WINDOW.size)) / TILE);
    const z0 = Math.floor((Math.max(cz - reach, WINDOW.minZ)) / TILE);
    const z1 = Math.floor((Math.min(cz + reach, WINDOW.minZ + WINDOW.size)) / TILE);
    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        const mx = (tx + 0.5) * TILE;
        const mz = (tz + 0.5) * TILE;
        const nearest = Math.hypot(mx - cx, mz - cz) - TILE * 0.7072;
        if (nearest > reach) continue;
        const bounds = this.boundsOf(tx, tz);
        if (!bounds || !this.frustum.intersectsSphere(bounds)) continue;
        /** A level can stand in for a tile only once every blade in it has thinned to that level; a finer one always can. */
        const winterDetail = sleepFloorAt(mx, mz) > 0.001 && nearest < SLEEP.swardDetailTo;
        let li = winterDetail ? 0 : this.finest;
        // At quarter density the 16x16 table contains every surviving forest blade.
        // Only use it when the entire tile lies in the fully cropped interior.
        if (tuning.wood.grassDensity <= 0.25 &&
          woodFloorAt(tx * TILE, tz * TILE) >= 0.9999 &&
          woodFloorAt((tx + 1) * TILE, tz * TILE) >= 0.9999 &&
          woodFloorAt(tx * TILE, (tz + 1) * TILE) >= 0.9999 &&
          woodFloorAt((tx + 1) * TILE, (tz + 1) * TILE) >= 0.9999) {
          li = Math.max(li, 1);
        }
        while (li < this.coarsest && nearest > this.lods[li].spec.reach) li++;
        while (li > this.finest && this.lods[li].count >= this.lods[li].spec.maxTiles) li--;
        const lod = this.lods[li];
        if (lod.count >= lod.spec.maxTiles) continue;
        if (lod.tiles.array[lod.count * 2] !== tx * TILE || lod.tiles.array[lod.count * 2 + 1] !== tz * TILE) lod.tilesChanged = true;
        lod.tiles.array[lod.count * 2] = tx * TILE;
        lod.tiles.array[lod.count * 2 + 1] = tz * TILE;
        lod.count++;
      }
    }
    for (const l of this.lods) {
      if (l.tilesChanged || l.count !== l.previousCount) {
        if (l.count) {
          l.tiles.clearUpdateRanges();
          l.tiles.addUpdateRange(0, l.count * 2);
          l.tiles.needsUpdate = true;
          l.tileTex.needsUpdate = true;
        }
        l.dirty = true;
      }
      l.previousCount = l.count;
      l.geo.instanceCount = l.count * l.spec.cols * l.spec.rows;
    }
  }

  /** Fills each level's blade table for the tiles `update` picked. */
  bake(renderer: THREE.WebGLRenderer): void {
    if (this.direct) return;
    // TABLE_FRAG depends on static ground/surface bakes plus season, palette and
    // flattened grass. Wind, life, lighting and eye distance stay in the blade
    // shader, so they must not force the fixed traits to be recomputed.
    let stateIndex = 0;
    const track = (value: number): void => {
      if (this.tableState[stateIndex] !== value) this.tablesDirty = true;
      this.tableState[stateIndex++] = value;
    };
    track(atmo.uniforms.uSeason.value);
    const t = atmo.uniforms.uTrodden.value;
    track(t.x); track(t.y); track(t.z); track(t.w);
    for (const { value: color } of Object.values(grassUniforms)) {
      track(color.r); track(color.g); track(color.b);
    }
    const prev = renderer.getRenderTarget();
    for (const l of this.lods) {
      if (!l.count || (!l.dirty && !this.tablesDirty)) continue;
      l.tableMat.uniforms.uTileCount.value = l.count;
      this.quad.material = l.tableMat;
      // The table reserves room for the maximum tile population, but only these
      // rows are sampled by this frame's instances. Scissor the clear as well as
      // the draw: writing four attachments for empty rows wastes bandwidth.
      const rows = Math.ceil(l.count * l.spec.cols * l.spec.rows / TABLE_WIDTH);
      l.table.scissor.set(0, 0, TABLE_WIDTH, rows);
      l.table.scissorTest = true;
      renderer.setRenderTarget(l.table);
      this.quad.render(renderer);
      l.dirty = false;
    }
    renderer.setRenderTarget(prev);
    this.tablesDirty = false;
  }
}

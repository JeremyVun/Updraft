import * as THREE from 'three';
import { params } from '../params';
import { ATMO_GLSL, atmo } from './atmosphere';
import { FIELDS_GLSL, fieldAt, type FieldSample } from './fields';
import { COTTAGE, GRASS_LINE, HEIGHTFIELD_GLSL, ISLES, LAST_HILL } from './heightfield';

/** The grass on the island of lines is grazed a little shorter, so the washing stands clear of it. */
function croppedAt(x: number, z: number): number {
  const d = Math.hypot((x - ISLES.lines.x) / ISLES.lines.rx, (z - ISLES.lines.z) / ISLES.lines.rz);
  return 1 - smoothstep(0.78, 1.12, d);
}

/**
 * The dark wood has a floor of its own — wet leaves, roots and deadfall — and meadow grass three metres deep grew
 * straight through all of it and hid the room. Mirrors `woodFloorAt` in the blade shaders; keep them in step.
 */
function woodFloorAt(x: number, z: number): number {
  const d = Math.hypot((x - ISLES.wood.x) / ISLES.wood.rx, (z - ISLES.wood.z) / ISLES.wood.rz);
  return 1 - smoothstep(0.7, 1.05, d);
}
import { heightAt } from './island';
import { shaderFbm, smoothstep } from './noise';
import { WINDOW } from './window';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const PROBE = new Set((new URLSearchParams(location.search).get('probe') ?? '').split(','));
const TILE = 8;
/** Tiles switch level of detail only this far past a ring, wider than the camera's breathing. */
const LOD_BAND = 3;

interface LodSpec {
  /** Blades per tile side. */
  side: number;
  segments: number;
  /** Tiles nearer than this (to the camera, on the ground) use this level. */
  reach: number;
  /** Where this level thins toward the next, as fractions of `reach`. */
  thinFrom: number;
  /** Density of the next level relative to this one (0 for the last, which fades out). */
  nextDensity: number;
  widthScale: number;
  maxTiles: number;
}

const LODS: LodSpec[] = [
  { side: 32, segments: 6, reach: 52, thinFrom: 0.72, nextDensity: (17 * 17) / (32 * 32), widthScale: 1, maxTiles: 700 },
  { side: 17, segments: 5, reach: 112, thinFrom: 0.84, nextDensity: (10 * 10) / (17 * 17), widthScale: 1.35, maxTiles: 1100 },
  { side: 10, segments: 4, reach: 176, thinFrom: 0.82, nextDensity: 0, widthScale: 1.9, maxTiles: 1600 },
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
/** 1 over the dark wood, where the floor is leaf litter and nothing grows tall enough to hide it. */
float woodFloorAt(vec2 xz) {
  return 1.0 - smoothstep(0.7, 1.05, length((xz - vec2(${ISLES.wood.x}.0, ${ISLES.wood.z}.0)) / vec2(${ISLES.wood.rx}.0, ${ISLES.wood.rz}.0)));
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
  return mix(tint, mix(tint, vec3(0.4, 0.41, 0.31), 0.28) * 0.93, uSeason);
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

/** Typical blade height at (x, z): the vertex shader's formula without the per-blade randomness. */
export function grassHeightAt(x: number, z: number): number {
  const groundH = heightAt(x, z);
  if (groundH < GRASS_LINE - 0.6) return 0;
  const lush = shaderFbm(x * 0.035 + 17, z * 0.035 + 17);
  const shortPatch = smoothstep(0.52, 0.68, shaderFbm(x * 0.05 - 23, z * 0.05 - 23));
  const fringe = smoothstep(GRASS_LINE - 0.6, GRASS_LINE + 2.2, groundH);
  const pasture = smoothstep(-600, -660, z);
  let h = (1.1 + 1.9 * smoothstep(0.3, 0.75, lush) + 0.275) * (0.2 + 0.8 * fringe * fringe) * (1 - shortPatch * 0.5);
  if (pasture <= 0) return h * (1 - 0.34 * croppedAt(x, z)) * (1 - 0.95 * woodFloorAt(x, z)) * troddenAt(x, z);
  h += (0.41 + 0.26 * lush - h) * pasture;
  const f = fieldAt(x, z, fieldSample);
  const grazed = Math.max(
    1 - smoothstep(45, 95, Math.hypot(x - LAST_HILL.x, z - LAST_HILL.z)),
    1 - smoothstep(14, 30, Math.hypot(x - COTTAGE.x, z - COTTAGE.z)),
  );
  const hay = (f.kind <= 0.22 ? 1 : 0) * f.presence * (1 - grazed);
  const rush = (f.kind >= 0.86 ? 1 : 0) * f.presence * (1 - grazed);
  return h * (1 + hay * 1.5 + rush * 1.2) * (1 - 0.5 * grazed) * (1 - 0.34 * croppedAt(x, z)) * (1 - 0.95 * woodFloorAt(x, z)) * troddenAt(x, z);
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
uniform sampler2D uTiles;
uniform int uTileCount;
uniform float uSide;
uniform float uTileSize;
uniform float uWidthScale;
layout(location = 0) out vec4 oRoot;
layout(location = 1) out vec4 oShape;
layout(location = 2) out vec4 oTint;
layout(location = 3) out vec4 oFlower;

void main() {
  int b = int(gl_FragCoord.y) * ${TABLE_WIDTH} + int(gl_FragCoord.x);
  int side = int(uSide);
  int per = side * side;
  int tileIndex = b / per;
  oRoot = vec4(0.0, 0.0, 0.0, 2.0);
  oShape = vec4(0.0);
  oTint = vec4(0.0);
  oFlower = vec4(0.0);
  if (tileIndex >= uTileCount) return;
  vec2 tile = texelFetch(uTiles, ivec2(tileIndex, 0), 0).xy;
  int id = b - tileIndex * per;
  vec2 cell = vec2(float(id % side), float(id / side));
  vec2 tileCell = floor(tile / uTileSize + 0.5);
  uvec2 key = uvec2(ivec2(tileCell * uSide + cell) + ivec2(1 << 20));
  uint s = gr_hash(key);
  vec2 root2 = tile + (cell + vec2(gr_rand(s), gr_rand(s))) * (uTileSize / uSide);
  float rank = gr_rand(s);

  vec2 uv = domainUv(root2);
  if (!insideUv(uv)) return;
  vec4 hn = texture(uHeightTex, uv);
  float groundH = hn.r;
  float edge = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 1.2).toFixed(2)}, groundH);
  float tufts = smoothstep(0.48, 0.72, vnoise(root2 * 0.35));
  float keep = edge > 0.85 ? 1.0 : edge * edge * tufts;
  keep *= smoothstep(0.55, 0.7, hn.b);
  vec4 surf = surfaceAt(root2);
  keep *= surf.x;
  vec4 fld = fieldAt(root2);
  oRoot = vec4(root2, groundH, rank);

  float seed = gr_rand(s);
  float lush = fbm(root2 * 0.035 + 17.0);
  float shortPatch = smoothstep(0.52, 0.68, fbm(root2 * 0.05 - 23.0));
  float fringe = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 2.2).toFixed(2)}, groundH);
  float pasture = pastureAt(root2);
  float h = (1.1 + 1.9 * smoothstep(0.3, 0.75, lush) + 0.55 * gr_rand(s)) * (0.2 + 0.8 * fringe * fringe) * (1.0 - shortPatch * 0.5);
  float tuft = step(0.93, gr_rand(s)) * smoothstep(0.45, 0.8, lush) * step(95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0)));
  h = mix(h, (0.34 + 0.26 * lush + 0.14 * gr_rand(s)) * (1.0 + tuft * 2.2), pasture);
  float grazed = max(1.0 - smoothstep(45.0, 95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0))),
                     1.0 - smoothstep(14.0, 30.0, length(root2 - vec2(${COTTAGE.x}.0, ${COTTAGE.z}.0))));
  float hay = step(fld.y, 0.22) * fld.w * (1.0 - grazed);
  float rush = step(0.86, fld.y) * fld.w * (1.0 - grazed);
  float cropped = 1.0 - smoothstep(0.78, 1.12, length((root2 - vec2(${ISLES.lines.x}.0, ${ISLES.lines.z}.0)) / vec2(${ISLES.lines.rx}.0, ${ISLES.lines.rz}.0)));
  h *= (1.0 + hay * 1.5 + rush * 1.2) * mix(1.0, 0.5, grazed) * (1.0 - 0.34 * cropped) * (1.0 - 0.95 * woodFloorAt(root2)) * troddenAt(root2);
  float width = (0.15 + 0.1 * gr_rand(s)) * uWidthScale;
  float angle = gr_rand(s) * 6.2831853;
  float curve = 0.12 + 0.28 * gr_rand(s);
  float flowerRand = step(gr_rand(s), surf.z * 0.1);
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
  float fringe = smoothstep(${(GRASS_LINE - 0.5).toFixed(2)}, ${(GRASS_LINE + 1.4).toFixed(2)}, groundH);
  float far = smoothstep(60.0, 170.0, dist);
  vRoot = mix(mix(tint * 0.55, uGrassRoot, fringe), mix(uGrassRoot, tint, 0.62), far);
  float aoLow = mix(0.7, 0.22, fringe);
  float aoFar = far * 0.75;
  vAo = vec2(mix(aoLow, 1.0, aoFar), (1.0 - aoFar) * (1.0 - aoLow));
  vFlat = smoothstep(0.3, 1.0, wa);
`;

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec2 aTile;
uniform vec3 uGrassRoot;
uniform sampler2D uRootTex;
uniform sampler2D uShapeTex;
uniform sampler2D uTintTex;
uniform sampler2D uFlowerTex;
uniform float uReach;
uniform float uThinFrom;
uniform float uNextDensity;
uniform float uDensity;
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
  float dist = length(root2 - cameraPosition.xz);
  float thin = smoothstep(uReach * uThinFrom, uReach, dist);
  float keep = mix(1.0, uNextDensity, thin) * uDensity;
  if (rank >= keep) { collapse(); return; }
  vec4 shape = texelFetch(uShapeTex, at, 0);
  keep *= shape.x;
  if (rank >= keep) { collapse(); return; }
  vec4 tintIn = texelFetch(uTintTex, at, 0);
  vec4 fl = texelFetch(uFlowerTex, at, 0);

  float side01 = position.x;
  float t = position.y;
  float seed = fl.x;
  float life = lifeAt(root2);
  float h = shape.y * mix(0.72, 1.0, life);
  h *= 1.0 - smoothstep(uReach * 0.8, uReach, dist) * step(uNextDensity, 0.001);
  float width = shape.z;
  float angle = shape.w;
  float curve = tintIn.w;
  float flower = fl.y * step(0.5, life);
  float petalClass = fl.z;
  h *= 1.0 + flower * fl.w;
  vec3 rootPos = vec3(root2.x, groundH - 0.12, root2.y);

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
${BLADE_RAND_GLSL}
in vec2 aTile;
uniform float uSide;
uniform float uTileSize;
uniform float uReach;
uniform float uThinFrom;
uniform float uNextDensity;
uniform float uWidthScale;
uniform float uDensity;
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
out vec4 vFlower;

void collapse() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}

void main() {
  int side = int(uSide);
  int id = gl_InstanceID % (side * side);
  vec2 cell = vec2(float(id % side), float(id / side));
  vec2 tileCell = floor(aTile / uTileSize + 0.5);
  uvec2 key = uvec2(ivec2(tileCell * uSide + cell) + ivec2(1 << 20));
  uint s = gr_hash(key);
  vec2 root2 = aTile + (cell + vec2(gr_rand(s), gr_rand(s))) * (uTileSize / uSide);
  float rank = gr_rand(s);

  vec2 uv = domainUv(root2);
  if (!insideUv(uv)) { collapse(); return; }
  float dist = length(root2 - cameraPosition.xz);
  float thin = smoothstep(uReach * uThinFrom, uReach, dist);
  float keep = mix(1.0, uNextDensity, thin) * uDensity;
  if (rank >= keep) { collapse(); return; }
  vec4 hn = texture(uHeightTex, uv);
  float groundH = hn.r;
  float edge = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 1.2).toFixed(2)}, groundH);
  float tufts = smoothstep(0.48, 0.72, vnoise(root2 * 0.35));
  keep *= edge > 0.85 ? 1.0 : edge * edge * tufts;
  keep *= smoothstep(0.55, 0.7, hn.b);
  vec4 surf = surfaceAt(root2);
  keep *= surf.x;
  vec4 fld = fieldAt(root2);
  if (rank >= keep) { collapse(); return; }

  float side01 = position.x;
  float t = position.y;
  float seed = gr_rand(s);
  float lush = fbm(root2 * 0.035 + 17.0);
  float shortPatch = smoothstep(0.52, 0.68, fbm(root2 * 0.05 - 23.0));
  float fringe = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 2.2).toFixed(2)}, groundH);
  float life = lifeAt(root2);
  float pasture = pastureAt(root2);
  float h = (1.1 + 1.9 * smoothstep(0.3, 0.75, lush) + 0.55 * gr_rand(s)) * (0.2 + 0.8 * fringe * fringe) * (1.0 - shortPatch * 0.5);
  float tuft = step(0.93, gr_rand(s)) * smoothstep(0.45, 0.8, lush) * step(95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0)));
  h = mix(h, (0.34 + 0.26 * lush + 0.14 * gr_rand(s)) * (1.0 + tuft * 2.2), pasture);
  float grazed = max(1.0 - smoothstep(45.0, 95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0))),
                     1.0 - smoothstep(14.0, 30.0, length(root2 - vec2(${COTTAGE.x}.0, ${COTTAGE.z}.0))));
  float hay = step(fld.y, 0.22) * fld.w * (1.0 - grazed);
  float rush = step(0.86, fld.y) * fld.w * (1.0 - grazed);
  float cropped = 1.0 - smoothstep(0.78, 1.12, length((root2 - vec2(${ISLES.lines.x}.0, ${ISLES.lines.z}.0)) / vec2(${ISLES.lines.rx}.0, ${ISLES.lines.rz}.0)));
  h *= (1.0 + hay * 1.5 + rush * 1.2) * mix(1.0, 0.5, grazed) * (1.0 - 0.34 * cropped) * (1.0 - 0.95 * woodFloorAt(root2)) * troddenAt(root2);
  h *= mix(0.72, 1.0, life);
  h *= 1.0 - smoothstep(uReach * 0.8, uReach, dist) * step(uNextDensity, 0.001);
  float width = (0.15 + 0.1 * gr_rand(s)) * uWidthScale;
  float angle = gr_rand(s) * 6.2831853;
  float curve = 0.12 + 0.28 * gr_rand(s);
  float flower = step(gr_rand(s), surf.z * 0.1) * step(0.5, life);
  float petal = gr_rand(s);
  h *= 1.0 + flower * (0.2 + 0.5 * pasture);
  vec3 rootPos = vec3(root2.x, groundH - 0.12, root2.y);

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
in vec4 vFlower;

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0) N = -N;
  N = normalize(N + vSideDir * 0.35 + vec3(0.0, 1e-3, 0.0));
  N = normalize(mix(N, vGroundN, 0.5) + vec3(0.0, 1e-3, 0.0));

  vec3 alb = mix(vRoot, vTint, smoothstep(0.0, 0.95, vT));
  float flattened = vFlat * vT;
  alb = mix(alb, alb * 1.45 + vec3(0.05, 0.06, 0.035), flattened);
  alb = mix(alb, vFlower.rgb, vFlower.a * smoothstep(0.66, 0.78, vT));

  float ao = vAo.x + vAo.y * smoothstep(0.0, 0.8, vT);
  float diff = clamp(dot(N, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  float toward = max(dot(-V, uSunDir), 0.0);
  float back = (toward * toward) * (toward * toward);
  vec3 trans = uSunColor * vTint * back * vT * vT * 0.9;
  vec3 H = normalize(uSunDir + V);
  alb *= 1.0 - 0.14 * uShower;
  float spec = pow(max(dot(N, H), 0.0), 24.0 + 40.0 * uShower) * (0.16 + 0.5 * flattened + 0.9 * uShower) * vT;
  vec3 ambient = mix(uGroundBounce, uSkyAmbient, N.y * 0.5 + 0.5);

  vec3 col = alb * ambient * ao + (alb * uSunColor * diff * ao + trans + uSunColor * spec) * vSun;
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), 1.0);
}`;

function bladeTemplate(segments: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    pos.push(-1, t, 0, 1, t, 0);
  }
  pos.push(0, 1, 0);
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
}

/** Tiles a level can hold: the ring between its reach and the previous level's, with room to spare. */
function tileCapacity(reach: number, prevReach: number): number {
  return Math.ceil((Math.PI * (reach * reach - prevReach * prevReach)) / (TILE * TILE) * 1.25) + 8;
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
  private readonly sphere = new THREE.Sphere();
  private readonly land = new Map<number, boolean>();
  private readonly lodOf = new Map<number, number>();
  private readonly quad = new FullScreenQuad();
  /** `?blades=direct`: the per-vertex blade shader, for before/after comparison with the table. */
  private readonly direct = params.blades === 'direct';
  private probeFrame = 0;

  constructor() {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const density = Math.min(1, params.grass ?? (params.lite ? 0.25 : touch ? 0.55 : 1));
    const reachScale = params.lite ? 0.7 : 1;
    let prevReach = 0;
    for (const base of LODS) {
      const spec = { ...base, reach: base.reach * reachScale };
      spec.maxTiles = Math.min(spec.maxTiles, tileCapacity(spec.reach, prevReach));
      prevReach = spec.reach;
      const template = bladeTemplate(PROBE.has('seg3') ? 3 : spec.segments);
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = template.index;
      geo.setAttribute('position', template.attributes.position);
      const tileArray = new Float32Array(spec.maxTiles * 2);
      const tiles = new THREE.InstancedBufferAttribute(tileArray, 2, false, spec.side * spec.side);
      tiles.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aTile', tiles);
      geo.instanceCount = 0;
      const tileTex = new THREE.DataTexture(tileArray, spec.maxTiles, 1, THREE.RGFormat, THREE.FloatType);
      tileTex.minFilter = tileTex.magFilter = THREE.NearestFilter;
      const rows = Math.ceil((spec.maxTiles * spec.side * spec.side) / TABLE_WIDTH);
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
          uSide: { value: spec.side },
          uTileSize: { value: TILE },
          uWidthScale: { value: spec.widthScale },
        },
        depthTest: false,
        depthWrite: false,
      });
      const mat = new THREE.ShaderMaterial({
        vertexShader: this.direct ? VERT_DIRECT : VERT,
        fragmentShader: PROBE.has('frag0') ? 'in vec3 vTint; in vec4 vFog; void main() { gl_FragColor = vec4(mix(vTint, vFog.rgb, vFog.a), 1.0); }' : PROBE.has('vary') ? 'in vec3 vWorld; in vec3 vNormal; in vec3 vSideDir; in vec3 vGroundN; in vec3 vTint; in vec4 vFog; in float vT; in float vFlat; in vec3 vRoot; in vec2 vAo; in float vSun; in vec4 vFlower; void main() { gl_FragColor = vec4(vTint + (vNormal + vSideDir + vGroundN + vRoot) * 0.001 + vWorld * 0.0001 + vFog.rgb * vFog.a + vec3(vT + vFlat + vAo.x + vAo.y + vSun) * 0.001 + vFlower.rgb * vFlower.a, 1.0); }' : FRAG,
        uniforms: {
          ...atmo.uniforms,
          ...grassUniforms,
          uRootTex: { value: table.textures[0] },
          uShapeTex: { value: table.textures[1] },
          uTintTex: { value: table.textures[2] },
          uFlowerTex: { value: table.textures[3] },
          uSide: { value: spec.side },
          uTileSize: { value: TILE },
          uWidthScale: { value: spec.widthScale },
          uReach: { value: spec.reach },
          uThinFrom: { value: spec.thinFrom },
          uNextDensity: { value: spec.nextDensity },
          uDensity: { value: density },
        },
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.lods.push({ spec, geo, tiles, tileTex, table, tableMat, count: 0 });
    }
  }

  get bladesDrawn(): number {
    return this.lods.reduce((n, l) => n + l.count * l.spec.side * l.spec.side, 0);
  }

  private hasLand(tx: number, tz: number): boolean {
    const key = tx * 100003 + tz;
    let v = this.land.get(key);
    if (v === undefined) {
      const x = tx * TILE;
      const z = tz * TILE;
      v = false;
      for (const [ox, oz] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]]) {
        const sx = x + ox * TILE;
        const sz = z + oz * TILE;
        /** The dark wood has its own floor of leaves and roots, and no blade there is ever drawn tall enough to see. */
        if (heightAt(sx, sz) > GRASS_LINE - 0.8 && woodFloorAt(sx, sz) < 0.9) {
          v = true;
          break;
        }
      }
      if (this.land.size > 60000) this.land.clear();
      this.land.set(key, v);
    }
    return v;
  }

  /**
   * The level for a tile at distance d, with hysteresis: a tile only changes level once it is well past the
   * boundary, so the camera's breathing never reshuffles the blades of tiles sitting on a ring.
   */
  private lodFor(key: number, d: number): number {
    const prev = this.lodOf.get(key);
    let level = prev ?? this.lods.findIndex((l) => d < l.spec.reach);
    if (level < 0) level = this.lods.length - 1;
    if (prev !== undefined) {
      while (level > 0 && d < this.lods[level - 1].spec.reach - LOD_BAND) level--;
      while (level < this.lods.length - 1 && d > this.lods[level].spec.reach + LOD_BAND) level++;
    }
    if (level !== prev) {
      if (this.lodOf.size > 60000) this.lodOf.clear();
      this.lodOf.set(key, level);
    }
    return level;
  }

  /** Picks the tiles to draw for this camera; call `bake` afterwards, before the scene is drawn. */
  update(camera: THREE.Camera): void {
    this.group.visible = !PROBE.has('nograss');
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    const cx = camera.position.x;
    const cz = camera.position.z;
    const reach = this.lods[this.lods.length - 1].spec.reach;
    for (const l of this.lods) l.count = 0;
    const x0 = Math.floor((Math.max(cx - reach, WINDOW.minX)) / TILE);
    const x1 = Math.floor((Math.min(cx + reach, WINDOW.minX + WINDOW.size)) / TILE);
    const z0 = Math.floor((Math.max(cz - reach, WINDOW.minZ)) / TILE);
    const z1 = Math.floor((Math.min(cz + reach, WINDOW.minZ + WINDOW.size)) / TILE);
    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        const mx = (tx + 0.5) * TILE;
        const mz = (tz + 0.5) * TILE;
        const d = Math.hypot(mx - cx, mz - cz) - TILE * 0.7;
        if (d > reach) continue;
        if (!this.hasLand(tx, tz)) continue;
        this.sphere.center.set(mx, heightAt(mx, mz) + 1.5, mz);
        this.sphere.radius = TILE * 0.75 + 4;
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
        const li = this.lodFor(tx * 100003 + tz, d);
        if (PROBE.has('lod0') && li !== 0) continue;
        if (PROBE.has('lod12') && li === 0) continue;
        const lod = this.lods[li];
        if (lod.count >= lod.spec.maxTiles) continue;
        lod.tiles.array[lod.count * 2] = tx * TILE;
        lod.tiles.array[lod.count * 2 + 1] = tz * TILE;
        lod.count++;
      }
    }
    if (PROBE.has('counts') && ++this.probeFrame === 300) console.warn('lodcounts ' + this.lods.map((l) => l.count).join(' '));
    for (const l of this.lods) {
      l.tiles.clearUpdateRanges();
      l.tiles.addUpdateRange(0, l.count * 2);
      l.tiles.needsUpdate = true;
      l.tileTex.needsUpdate = true;
      l.geo.instanceCount = l.count * l.spec.side * l.spec.side;
    }
  }

  /** Fills each level's blade table for the tiles `update` picked. */
  bake(renderer: THREE.WebGLRenderer): void {
    if (this.direct || PROBE.has('nobake')) return;
    const prev = renderer.getRenderTarget();
    for (const l of this.lods) {
      if (!l.count) continue;
      l.tableMat.uniforms.uTileCount.value = l.count;
      this.quad.material = l.tableMat;
      renderer.setRenderTarget(l.table);
      this.quad.render(renderer);
    }
    renderer.setRenderTarget(prev);
  }
}

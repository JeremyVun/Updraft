import * as THREE from 'three';
import type { Shot } from '../camera';
import { tuning } from '../tuning';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WindField } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { ISLES } from './heightfield';
import { heightAt } from './island';
import { createNoise2D, mulberry32 } from './noise';

/** The south shore of the wood, where the boat runs ashore out of the storm. */
export const WOOD_LANDING = new THREE.Vector2(-26, -1692);
/** The west-facing mouth of the low rock shelter beside the path. */
export const WOOD_REFUGE = new THREE.Vector3(-8.5, 0, -1791);
export const WOOD_HEARTH = new THREE.Vector3(-9.1, 0, -1792.05);
export const WOOD_OUTSIDE = new THREE.Vector3(-11.6, 0, -1791);
export const WOOD_COAX = new THREE.Vector3(-13, 0, -1791);
/** On the west verge, clear of the walking line and behind the rescue camera. */
export const WOOD_APPROACH_LIGHT = new THREE.Vector2(-34, -1781.5);
/** The storm left the paper on a low, forked branch, above the child's reach. */
export const WOOD_PLANE = new THREE.Vector2(-37, -1848);
/** The path's final ember is also the light used to retrieve the paper. */
export const WOOD_PLANE_LIGHT = new THREE.Vector2(WOOD_PLANE.x + 1.6, WOOD_PLANE.y + 2.2);

/** Shared by the exposed fork and its caught paper, following the wood's slow passing gusts. */
export function woodPlaneSway(time: number, breeze: THREE.Vector2, air: { x: number; z: number; energy: number }, out: THREE.Vector3): THREE.Vector3 {
  const length = breeze.length() || 1;
  const dx = breeze.x / length, dz = breeze.y / length;
  const phase = time * tuning.wood.planeSwayRate - (WOOD_PLANE.x * dx + WOOD_PLANE.y * dz) * 0.045;
  const strength = 0.45 + 0.55 * Math.min(1, Math.hypot(air.x, air.z) / 5 + air.energy * 0.3);
  const along = Math.sin(phase) * tuning.wood.planeTreeSway * strength;
  const across = Math.sin(phase * 1.63 + 0.8) * tuning.wood.planeTreeSway * 0.25 * strength;
  return out.set(dx * along - dz * across, 0, dz * along + dx * across);
}
/** The boat is drawn up on the north shore before they get there. Nobody put it there. */
export const WOOD_BERTH = new THREE.Vector3(-34, 0, -1908);

/** The way up through the trees, south shore to north shore. The wood keeps a walkable corridor along it. */
export const WOOD_PATH: THREE.Vector2[] = [
  new THREE.Vector2(-20, -1722),
  new THREE.Vector2(-44, -1762),
  new THREE.Vector2(-16, -1796),
  new THREE.Vector2(-40, -1836),
  new THREE.Vector2(-26, -1872),
  new THREE.Vector2(-34, -1900),
];

const ISLE = ISLES.wood;
/**
 * The sleeping island stands inside the square the wood sows itself over, and nothing of the wood is on it: no
 * trunks and no leaf litter. Without this the frosted island comes up wooded.
 */
const NEXT_ISLE = ISLES.sleeping;
function onNextIsle(x: number, z: number): boolean {
  return Math.hypot((x - NEXT_ISLE.x) / NEXT_ISLE.rx, (z - NEXT_ISLE.z) / NEXT_ISLE.rz) < 1.1;
}
/** Trees stop above the beach; below this the shore is bare shingle. */
const TREE_LINE = 2.0;
/** No trunk stands within this of the path, though the branches close over it. */
const CORRIDOR = 5;

/** Segments per tree in the table; a level of detail is simply the first N of them, coarsest first. */
const MAX_SEGS = 160;
const LODS = [
  { segs: MAX_SEGS, reach: 34, cap: 340 },
  { segs: 54, reach: 76, cap: 1250 },
  { segs: 30, reach: 178, cap: 2000 },
];

const onPath = new THREE.Vector2();
/** The whole walk, boat to boat: the corridor has to start where the child steps off, not where the path does. */
const WAY = [WOOD_LANDING, ...WOOD_PATH, new THREE.Vector2(WOOD_BERTH.x, WOOD_BERTH.z)];

/** Distance to the way through, leaving the nearest point on it in `onPath`. */
function pathDistance(x: number, z: number): number {
  let best = 1e9;
  for (let i = 1; i < WAY.length; i++) {
    const a = WAY[i - 1];
    const b = WAY[i];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - a.x - dx * t, z - a.y - dz * t);
    if (d < best) {
      best = d;
      onPath.set(a.x + dx * t, a.y + dz * t);
    }
  }
  return best;
}

const LITTER_CELL = 0.6;
const LITTER_GRID = 90;
const LITTER_REACH = 24;
const DEBRIS = 620;
const DEBRIS_BOX = new THREE.Vector3(48, 22, 48);

/**
 * Every branch is one camera-facing ribbon: the bare silhouette is the whole image here, and a ribbon keeps its
 * width when the twig is thinner than a pixel, where a tube would break into gaps.
 */
const RIBBON_GLSL = /* glsl */ `
uniform sampler2D uSegs;
uniform float uStorm;
uniform vec2 uStormDir;
uniform float uPixel;
/** Where this level of detail gives up: segments past x thin away between y and z metres, instead of popping. */
uniform vec3 uDetail;
in vec4 aTree;
in vec4 aForm;

/** The tree's own frame and the air at its foot, read once and used by every point on it. */
vec2 gYaw;
vec2 gTilt;
vec2 gLean;
vec2 gPush;
float gSeed;

void rootTree() {
  gYaw = vec2(cos(aForm.x), sin(aForm.x));
  gTilt = vec2(cos(aForm.z), sin(aForm.z));
  gLean = vec2(cos(aForm.w), sin(aForm.w));
  gSeed = hash12(aTree.xz * 3.7);
  vec2 uv = domainUv(aTree.xz);
  vec4 w = insideUv(uv) ? texture(uWindTex, uv) : vec4(0.0);
  float roll = sin(uTime * 0.7 - dot(aTree.xz, uStormDir) * 0.045 + gSeed * 5.0);
  gPush = w.xy * 0.014 + uStormDir * (uStorm * (0.13 + 0.095 * roll) + w.z * 0.05);
}

vec3 place(vec3 p) {
  p = vec3(gYaw.x * p.x + gYaw.y * p.z, p.y, -gYaw.y * p.x + gYaw.x * p.z);
  float along = dot(p.xz, gLean);
  vec2 perp = p.xz - gLean * along;
  float over = p.y * gTilt.y + along * gTilt.x;
  return aTree.xyz + vec3(perp.x + gLean.x * over, p.y * gTilt.x - along * gTilt.y, perp.y + gLean.y * over) * aForm.y;
}

/**
 * How far the wood is bent over at this point: the live field, the gust the player just threw, and the storm's
 * own gusts rolling across the island. It reads the undeformed position only, so neighbouring ribbons stay joined.
 */
vec3 bend(vec3 world, float up, float thin) {
  float k = pow(clamp(up, 0.0, 1.0), 1.55) * gTilt.x;
  float lash = sin(uTime * (2.2 + uStorm * 4.5) + world.x * 1.1 + world.z * 0.8 + gSeed * 12.0);
  vec2 whip = vec2(-uStormDir.y, uStormDir.x) * lash * (0.012 + 0.7 * length(gPush)) * thin;
  vec3 off = vec3(gPush.x + whip.x, 0.0, gPush.y + whip.y) * k * aForm.y;
  off.y -= dot(off.xz, off.xz) / (2.0 * aForm.y);
  return off;
}
`;

const TREE_VERT = /* glsl */ `
${ATMO_GLSL}
${RIBBON_GLSL}
out vec3 vWorld;
out vec3 vSide;
out vec3 vFace;
out vec2 vCard;
out float vLeaf;
out float vAo;
out float vSeed;
out float vSolid;

void main() {
  int v = int(aTree.w);
  int s = int(position.z);
  vec4 A = texelFetch(uSegs, ivec2(s * 2, v), 0);
  if (A.w == 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  rootTree();
  vSeed = gSeed;
  vLeaf = A.w < 0.0 ? 1.0 : 0.0;
  vAo = 0.32 + 0.68 * clamp(A.y * 2.6, 0.0, 1.0);

  if (vLeaf > 0.5) {
    vec3 c = place(A.xyz);
    c += bend(c, A.y, 1.0);
    float spin = uTime * (1.1 + uStorm * 7.0) + vSeed * 40.0;
    vec2 t = vec2(cos(spin), sin(spin));
    vec2 corner = vec2(position.x, position.y * 2.0 - 1.0);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec2 spun = vec2(corner.x * t.x - corner.y * t.y, corner.x * t.y + corner.y * t.x);
    vWorld = c + (right * spun.x + up * spun.y) * (-A.w * aForm.y);
    vSide = right;
    vFace = normalize(cross(right, up));
    vCard = corner;
    vSolid = 1.0;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
    return;
  }

  vec4 B = texelFetch(uSegs, ivec2(s * 2 + 1, v), 0);
  vec3 wa = place(A.xyz);
  vec3 wb = place(B.xyz);
  wa += bend(wa, A.y, smoothstep(0.013, 0.0015, A.w));
  wb += bend(wb, B.y, smoothstep(0.013, 0.0015, B.w));
  vec3 mid = mix(wa, wb, position.y);
  vec3 axis = normalize(wb - wa);
  vec3 toCam = cameraPosition - mid;
  float dist = length(toCam);
  toCam /= dist;
  vec3 side = normalize(cross(axis, toCam));
  float real = mix(A.w, B.w, position.y) * aForm.y;
  float r = max(real, dist * uPixel * 0.9);
  vSolid = real / r;
  /** A twig at the lens is a plank across the whole view, so thin things thin out as they come up to the camera. */
  if (real < 0.12) r *= smoothstep(0.4, 1.7, dist);
  if (float(s) >= uDetail.x) r *= 1.0 - smoothstep(uDetail.y, uDetail.z, dist);
  vWorld = mid + side * (position.x * r);
  vSide = side;
  vFace = normalize(cross(side, axis));
  vCard = vec2(position.x, position.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/** Deadfall and root plates are real tubes: they are looked at from a metre away, where a ribbon would give itself away. */
const DEAD_VERT = /* glsl */ `
${ATMO_GLSL}
out vec3 vWorld;
out vec3 vSide;
out vec3 vFace;
out vec2 vCard;
out float vLeaf;
out float vAo;
out float vSeed;
out float vSolid;
void main() {
  vWorld = position;
  vFace = normalize(normal);
  vSide = vec3(0.0, 1.0, 0.0);
  vCard = vec2(0.0);
  vLeaf = 0.0;
  vSolid = 1.0;
  vAo = 0.24 + 0.4 * clamp((position.y - texture(uHeightTex, domainUv(position.xz)).r) * 0.8, 0.0, 1.0);
  vSeed = hash12(position.xz * 3.7);
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

/**
 * The way through, in the shader: the litter is swept off it and thins at its edges, so between the lights the
 * floor itself says where the path goes. A child walking in the dark follows a worn line, not a heading.
 */
const WAY_GLSL = /* glsl */ `
uniform vec2 uWay[${WAY.length}];
float wayDistance(vec2 p) {
  float best = 1e9;
  for (int i = 1; i < ${WAY.length}; i++) {
    vec2 a = uWay[i - 1];
    vec2 ab = uWay[i] - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    best = min(best, distance(p, a + ab * t));
  }
  return best;
}`;

/** Wet leaves lying on the floor, scattered over a grid of cells that follows the camera and is fixed in the world. */
const LITTER_VERT = /* glsl */ `
${ATMO_GLSL}
${WAY_GLSL}
uniform vec2 uLitterCell;
uniform float uStorm;
in vec2 aCell;
out vec3 vWorld;
out vec3 vSide;
out vec3 vFace;
out vec2 vCard;
out float vLeaf;
out float vAo;
out float vSeed;
out float vSolid;
void main() {
  vec2 cell = uLitterCell + aCell;
  float r1 = hash12(cell);
  float r2 = hash12(cell + 19.7);
  float r3 = hash12(cell + 71.3);
  vec2 p = (cell + vec2(r1, r2)) * ${LITTER_CELL.toFixed(2)};
  vec2 uv = domainUv(p);
  float away = distance(p, cameraPosition.xz);
  float worn = smoothstep(1.1, 4.2, wayDistance(p));
  float next = length((p - vec2(${NEXT_ISLE.x}.0, ${NEXT_ISLE.z}.0)) / vec2(${NEXT_ISLE.rx}.0, ${NEXT_ISLE.rz}.0));
  if (r3 > (0.3 + 0.75 * vnoise(p * 0.6)) * worn || away > ${LITTER_REACH.toFixed(1)} || !insideUv(uv) || next < 1.1) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 hn = texture(uHeightTex, uv);
  if (hn.r < ${TREE_LINE.toFixed(1)}) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 w = texture(uWindTex, uv).xy;
  vec3 n = normalize(hn.gba);
  vec3 base = vec3(p.x, hn.r + 0.03 + r3 * 0.05, p.y);
  base.xz += w * 0.01 * (0.4 + r1) * uStorm;
  float a = r1 * 6.2831;
  vec3 t1 = normalize(cross(n, vec3(cos(a), 0.0, sin(a))));
  vec3 t2 = cross(n, t1);
  float size = 0.1 + 0.14 * r2;
  vWorld = base + (t1 * position.x + t2 * position.y) * size;
  vSide = t1;
  vFace = normalize(n + t1 * 0.2);
  vCard = position.xy * vec2(2.4, 2.0);
  vLeaf = 2.0;
  vSolid = 1.0;
  vAo = 0.08 + 0.16 * r2;
  vSeed = r2;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/** What the storm tears off: leaves and litter streaming downwind through a box that follows the view. */
const DEBRIS_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uBox;
uniform vec3 uDebrisCentre;
uniform vec3 uDrift;
uniform float uStorm;
uniform vec2 uStormDir;
in vec4 aMote;
out vec3 vWorld;
out vec3 vSide;
out vec3 vFace;
out vec2 vCard;
out float vLeaf;
out float vAo;
out float vSeed;
out float vSolid;
void main() {
  vec3 p = mod(aMote.xyz * uBox + uDrift * (0.55 + aMote.w) - uDebrisCentre + uBox * 0.5, uBox) + uDebrisCentre - uBox * 0.5;
  vec2 uv = domainUv(p.xz);
  float ground = insideUv(uv) ? texture(uHeightTex, uv).r : -1.0;
  /** Torn off the wood, so there is none of it out over the water where there is nothing to tear. */
  if (aMote.w > uStorm * 0.85 * smoothstep(0.0, 3.0, ground)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  p.y = max(p.y, ground + 0.15);
  float spin = uTime * (3.0 + aMote.w * 9.0) + aMote.x * 30.0;
  vec2 t = vec2(cos(spin), sin(spin));
  vec2 corner = vec2(position.x, position.y) * 2.0;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec2 spun = vec2(corner.x * t.x - corner.y * t.y, corner.x * t.y + corner.y * t.x);
  float size = 0.055 + 0.05 * aMote.y;
  vWorld = p + (right * spun.x + up * spun.y) * size;
  vSide = right;
  vFace = normalize(cross(right, up) + vec3(uStormDir.x, 0.0, uStormDir.y) * 0.5);
  vCard = corner;
  vLeaf = 1.0;
  vAo = 1.0;
  vSolid = 1.0;
  vSeed = aMote.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * One shading for everything wooden here: wet bark rounded across the ribbon, and dead leaves on the twigs, the
 * floor and the air. At night almost all of it is silhouette, so the moon on a wet edge is what gives it form.
 */
const WOOD_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uStorm;
uniform vec3 uViewA;
uniform vec3 uViewB;
uniform float uViewClear;
in vec3 vWorld;
in vec3 vSide;
in vec3 vFace;
in vec2 vCard;
in float vLeaf;
in float vAo;
in float vSeed;
in float vSolid;
float clearSight(vec3 subject) {
  vec3 ray = subject - cameraPosition;
  float along = dot(vWorld - cameraPosition, ray) / max(0.1, dot(ray, ray));
  float distanceToRay = distance(vWorld, cameraPosition + ray * clamp(along, 0.0, 1.0));
  return mix(1.0, smoothstep(1.1, 2.2, distanceToRay), step(0.01, along) * step(along, 0.98));
}
void main() {
  vec3 N;
  vec3 alb;
  float grain = 0.5;
  if (vLeaf > 0.5) {
    float edge = 1.0 + 0.09 * sin(atan(vCard.y, vCard.x) * 5.0 + vSeed * 30.0);
    if (length(vec2(vCard.x * 1.4, vCard.y + vCard.x * vCard.x * 0.3)) > edge) discard;
    N = normalize(vFace * 0.85 + vSide * vCard.x * 0.45);
    alb = mix(vec3(0.021, 0.013, 0.007), vec3(0.068, 0.042, 0.017), fract(vSeed * 9.7));
    /** Leaves on the floor are sodden: darker than the ones still up there, and no light comes through them. */
    if (vLeaf > 1.5) alb *= 0.22;
  } else {
    float round = sqrt(max(1.0 - vCard.x * vCard.x, 0.0));
    N = normalize(vSide * vCard.x + vFace * round);
    grain = vnoise(vec2(dot(vWorld.xz, vec2(4.3, 3.1)) + vCard.x * 1.5, vWorld.y * 5.0)) * 0.6
          + vnoise(vec2(dot(vWorld.xz, vec2(17.0, 13.0)), vWorld.y * 19.0)) * 0.4;
    alb = mix(vec3(0.017, 0.016, 0.018), vec3(0.055, 0.046, 0.039), smoothstep(0.25, 0.8, grain));
  }
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  float wrap = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float rim = pow(1.0 - abs(dot(N, V)), 4.0) * (0.45 + 0.8 * grain);
  /** Rain has been on it for an hour: the moon runs along a wet edge in patches, never as one clean stripe. */
  float wet = pow(max(dot(reflect(-V, N), uSunDir), 0.0), 16.0) * (0.3 + 0.7 * uStorm) * (0.35 + 0.9 * grain);
  vec3 col = alb * (hemiLight(N) * vAo + uSunColor * (wrap * wrap * 0.55 + 0.05) * sun * (0.25 + 0.75 * vAo));
  col += alb * uSunColor * sun * step(0.5, vLeaf) * step(vLeaf, 1.5) * pow(max(dot(-V, uSunDir), 0.0), 3.0) * 1.2;
  col += uSunColor * sun * vAo * vSolid * (rim * (0.04 + 0.26 * uNight) + wet * (0.06 + 0.3 * uNight));
  /** Firelight is the only light that reaches the floor here, so wet leaves take far more of it than their own
      near-black albedo would give back: without this the player's light throws no pool on the ground at all. */
  col += (alb + vec3(0.085, 0.048, 0.022)) * emberLight(vWorld, N);
  /**
   * Trunks right in front of the lens fade out: the camera trails the child through 2,700 trees and the one thing
   * the room can never do is hide the child, so anything between the two of them gets out of the way.
   */
  float clear = vLeaf > 0.5 ? 1.0 : smoothstep(1.2, 6.5, distance(cameraPosition, vWorld));
  clear *= mix(1.0, min(clearSight(uViewA), clearSight(uViewB)), uViewClear);
  // Also clear the sightline on devices without MSAA, where alpha-to-coverage has no effect.
  if (clear < 0.99 && hash12(floor(gl_FragCoord.xy)) > clear) discard;
  gl_FragColor = vec4(applyFog(col, vWorld), clear);
}`;

interface Seg {
  a: THREE.Vector3;
  b: THREE.Vector3;
  ra: number;
  rb: number;
}

type Kind = 'tall' | 'broken' | 'young' | 'thicket';

/** A tree grown at height 1, so an instance's scale is its height in world units and the sway can use local y. */
function grow(rand: () => number, kind: Kind): Seg[] {
  const ranks: Seg[][] = [[], [], [], [], []];
  const link = (rank: number, a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number) =>
    ranks[rank].push({ a: a.clone(), b: b.clone(), ra, rb });

  const stems = kind === 'thicket' ? 6 + Math.floor(rand() * 4) : 1;
  const trunkR = kind === 'tall' ? 0.021 + rand() * 0.008 : kind === 'broken' ? 0.024 : kind === 'young' ? 0.011 : 0.017;
  const top = kind === 'broken' ? 0.4 + rand() * 0.24 : 1;

  const tips: THREE.Vector3[] = [];
  for (let s = 0; s < stems; s++) {
    const twist = rand() * Math.PI * 2;
    const swing = (0.06 + rand() * 0.12) * (kind === 'thicket' ? 4 : 1);
    const parts = kind === 'thicket' ? 3 : 5;
    let prev = new THREE.Vector3(0, 0, 0);
    if (kind === 'thicket') prev.set(Math.cos(twist) * 0.08, 0, Math.sin(twist) * 0.08);
    const start = prev.clone();
    for (let i = 1; i <= parts; i++) {
      const t = i / parts;
      const p = new THREE.Vector3(
        start.x + Math.cos(twist) * swing * t * t + Math.sin(t * 2.2 + twist) * 0.005,
        top * t,
        start.z + Math.sin(twist) * swing * t * t + Math.cos(t * 1.9 + twist) * 0.005,
      );
      link(0, prev, p, trunkR * (1 - 0.7 * Math.pow((i - 1) / parts, 0.8)), trunkR * (1 - 0.7 * Math.pow(t, 0.8)));
      prev = p;
    }
    if (kind !== 'thicket') {
      const limbs = kind === 'tall' ? 5 + Math.floor(rand() * 2) : 4;
      /** Some of them kept a low limb, so the near trees are not all bare below the crown. */
      const low = kind === 'tall' && rand() < 0.45;
      for (let i = 0; i < limbs; i++) {
        const t = (kind === 'broken' ? 0.3 : low && i === 0 ? 0.2 : 0.42) + (i / limbs) * 0.5 + rand() * 0.1;
        if (t > 0.97) continue;
        const azimuth = (i / limbs) * Math.PI * 2 + rand() * 0.9 + twist;
        const from = new THREE.Vector3(
          start.x + Math.cos(twist) * swing * t * t,
          top * t,
          start.z + Math.sin(twist) * swing * t * t,
        );
        const rise = 0.55 + rand() * 0.6;
        const dir = new THREE.Vector3(Math.cos(azimuth), rise, Math.sin(azimuth)).normalize();
        const len = (0.2 + rand() * 0.16) * (kind === 'young' ? 0.7 : 1) * (1.15 - t * 0.45);
        limb(link, tips, from, dir, len, trunkR * (1 - 0.66 * t) * 0.62, 1, rand);
      }
    } else {
      for (let i = 0; i < 2; i++) {
        const azimuth = twist + (rand() - 0.5) * 2.4;
        const dir = new THREE.Vector3(Math.cos(azimuth), 0.8 + rand() * 0.7, Math.sin(azimuth)).normalize();
        limb(link, tips, new THREE.Vector3(start.x, top * 0.5, start.z), dir, 0.24 + rand() * 0.2, trunkR * 0.6, 2, rand);
      }
    }
  }

  if (kind !== 'thicket') {
    const roots = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < roots; i++) {
      const a = (i / roots) * Math.PI * 2 + rand() * 0.7;
      const reach = 0.04 + rand() * 0.035;
      const knee = new THREE.Vector3(Math.cos(a) * reach * 0.6, -0.002, Math.sin(a) * reach * 0.6);
      const toe = new THREE.Vector3(Math.cos(a) * reach, -0.03, Math.sin(a) * reach);
      link(3, new THREE.Vector3(0, 0.022, 0), knee, trunkR * 0.8, trunkR * 0.5);
      link(3, knee, toe, trunkR * 0.5, trunkR * 0.2);
    }
  }

  if (kind === 'tall' || kind === 'young') {
    for (let i = 0; i < 9 && tips.length > 0; i++) {
      const tip = tips[Math.floor(rand() * tips.length)];
      ranks[4].push({ a: tip.clone(), b: tip.clone(), ra: -(0.005 + rand() * 0.004), rb: 0 });
    }
  }

  for (let i = ranks[2].length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ranks[2][i], ranks[2][j]] = [ranks[2][j], ranks[2][i]];
  }
  return ranks.flat().slice(0, MAX_SEGS);
}

/** One limb and everything off it: rank 1 the limbs, rank 2 the branches, rank 3 the twigs. */
function limb(
  link: (rank: number, a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number) => void,
  tips: THREE.Vector3[],
  from: THREE.Vector3,
  dir: THREE.Vector3,
  len: number,
  r: number,
  depth: number,
  rand: () => number,
): void {
  const parts = depth === 1 ? 3 : depth === 2 ? 2 : 1;
  const curl = depth === 1 ? 0.5 + rand() * 0.5 : 0.3 + rand() * 0.6;
  let p = from.clone();
  let d = dir.clone();
  for (let i = 0; i < parts; i++) {
    d.y += curl * (len / parts) * 1.4;
    d.x += (rand() - 0.5) * 0.4;
    d.z += (rand() - 0.5) * 0.4;
    d.normalize();
    const next = p.clone().addScaledVector(d, len / parts);
    const ra = r * (1 - (i / parts) * 0.55);
    const rb = r * (1 - ((i + 1) / parts) * 0.55);
    link(depth, p, next, ra, rb);
    p = next;
  }
  if (depth >= 3) {
    tips.push(p.clone());
    return;
  }
  for (let i = 0; i < 3; i++) {
    const t = 0.35 + rand() * 0.55;
    const base = from.clone().lerp(p, t);
    const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(i % 2 === 0 ? 1 : -1);
    const out = d
      .clone()
      .multiplyScalar(0.55)
      .addScaledVector(side, 0.55 + rand() * 0.5)
      .add(new THREE.Vector3(0, 0.3 + rand() * 0.5, 0))
      .normalize();
    limb(link, tips, base, out, len * (0.42 + rand() * 0.3), r * 0.42, depth + 1, rand);
  }
}

function log(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r1, r0, len, 7, 1, false);
  const dir = b.clone().sub(a).divideScalar(len);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  geo.deleteAttribute('uv');
  return geo;
}

interface Placed {
  x: number;
  y: number;
  z: number;
  variant: number;
  yaw: number;
  scale: number;
  tilt: number;
  tiltDir: number;
}

/** Somewhere small enough to be missed: under the fallen trunk, in the roots, and in the middle of the thicket. */
const TRUNK_HOLE = { x: -9, z: -1801 };
const HOLLOW = { x: -46, z: -1832 };
const THICKET = { x: -22, z: -1812 };

/**
 * The dark wood: the first winter storm, at night, on the smallest island of the chain. Bare trees heaving in the
 * wind, a floor of wet leaves and roots, and no light in it but the light the player makes.
 */
/** A broken slab leaning on an outcrop: a low, west-facing gap, open toward the child's approach. */
function refugeRocks(): THREE.Mesh {
  const ground = heightAt(WOOD_REFUGE.x, WOOD_REFUGE.z);
  // Separate weathered masses leave a crooked seam beneath a fallen slab. The clear westward
  // passage contains both the bird and the hearth; no stone occupies their entry/exit path.
  const parts: THREE.BufferGeometry[] = [];
  const stone = (x: number, y: number, z: number, sx: number, sy: number, sz: number,
    rx: number, ry: number, rz: number, seed: number) => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const vertices = geo.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const vx = vertices.getX(i), vy = vertices.getY(i), vz = vertices.getZ(i);
      // Coordinate-based weathering keeps shared vertices together and gives each stone broad facets.
      const wear = 1 + 0.1 * Math.sin(vx * 5.7 + vy * 3.1 + vz * 4.3 + seed)
        + 0.045 * Math.sin(vz * 9.2 - vx * 4.1 + seed * 2);
      vertices.setXYZ(i, vx * wear, vy * wear, vz * wear);
    }
    geo.scale(sx, sy, sz);
    geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz);
    geo.translate(WOOD_REFUGE.x + x, ground + y, WOOD_REFUGE.z + z);
    geo.deleteAttribute('uv'); geo.computeVertexNormals();
    parts.push(geo);
  };
  // Unequal shoulders: one long stone lies down, the other is partly buried on its edge.
  stone(0.3, 0.65, -2.45, 2.85, 1.35, 1.25, 0.12, -0.18, 0.09, 1);
  stone(0.85, 0.85, 1.75, 2.15, 1.55, 1.05, -0.18, 0.28, -0.16, 3);
  stone(2.1, 0.9, -0.25, 1.25, 1.65, 2.1, 0.15, -0.2, 0.12, 5);
  // A tilted, broad slab makes a low irregular overhang, not a cut-out semicircle.
  stone(-0.05, 2.35, -0.45, 2.85, 0.72, 2.35, -0.14, 0.07, 0.13, 7);
  // Fallen chips bed the shoulders into the leaf litter, away from the cygnet's route.
  stone(-1.95, 0.1, -2.55, 0.8, 0.4, 0.7, 0.2, 0.5, -0.1, 9);
  stone(-1.25, 0.08, 2.25, 0.65, 0.32, 0.85, -0.1, -0.4, 0.1, 11);
  stone(1.9, 0.05, 2.6, 0.9, 0.38, 0.6, 0.1, 0.8, 0.15, 13);
  const geo = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: atmo.uniforms,
    vertexShader: `${ATMO_GLSL}
      out vec3 vWorld; out vec3 vNormal;
      void main() { vWorld = position; vNormal = normal; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${ATMO_GLSL}
      in vec3 vWorld; in vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        float grain = vnoise(vWorld.xz * 5.0 + vWorld.y);
        float weather = vnoise(vWorld.xz * 0.85 + vWorld.y * 0.6);
        vec3 alb = mix(vec3(0.08, 0.095, 0.105), vec3(0.17, 0.18, 0.19), weather);
        alb *= 0.88 + grain * 0.2;
        float moss = smoothstep(0.48, 0.75, weather) * smoothstep(0.1, 0.8, n.y);
        alb = mix(alb, vec3(0.075, 0.095, 0.058), moss * 0.6);
        float occlusion = mix(0.18, 1.0, smoothstep(-0.3, 0.6, n.y));
        vec3 col = alb * (hemiLight(n) * occlusion + uSunColor * max(0.0, dot(n, uSunDir)) * cloudShadow(vWorld.xz));
        col += (alb + vec3(0.05, 0.03, 0.01)) * emberLight(vWorld, n);
        vec3 view = normalize(cameraPosition - vWorld);
        col += uSunColor * pow(max(0.0, dot(reflect(-view, n), uSunDir)), 24.0) * 0.16;
        gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
      }`,
  }));
  mesh.name = 'wood-refuge';
  return mesh;
}

function planeTree(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const ground = (x: number, z: number) => heightAt(x, z) - 0.2;
  // A bare tree with an exposed fork at the paper's height. Its trunk stands behind the pickup spot.
  const base = new THREE.Vector3(WOOD_PLANE.x - 2.8, ground(WOOD_PLANE.x, WOOD_PLANE.y), WOOD_PLANE.y - 1);
  const h = tuning.wood.planeSnagHeight;
  const branch = base.clone().add(new THREE.Vector3(0.45, h - 0.7, 0.3));
  const crown = base.clone().add(new THREE.Vector3(-0.35, h + 3.2, -0.5));
  const fork = base.clone().add(new THREE.Vector3(2.6, h + 0.1, 0.95));
  parts.push(log(base, branch, 0.32, 0.21), log(branch, crown, 0.21, 0.065), log(branch, fork, 0.14, 0.045));
  parts.push(log(fork, fork.clone().add(new THREE.Vector3(0.8, 0.55, -0.35)), 0.045, 0.012));
  parts.push(log(fork, fork.clone().add(new THREE.Vector3(0.9, 0.2, 0.6)), 0.04, 0.01));
  parts.push(log(branch.clone().lerp(crown, 0.4), crown.clone().add(new THREE.Vector3(-2.1, -0.7, 0.3)), 0.1, 0.025));
  parts.push(log(branch.clone().lerp(crown, 0.6), crown.clone().add(new THREE.Vector3(1.8, -0.2, -0.6)), 0.08, 0.015));

  return mergeGeometries(parts);
}

export class DarkWood {
  readonly objects: THREE.Object3D[] = [];

  private readonly trees: Placed[] = [];
  private readonly lods: { mesh: THREE.Mesh; geo: THREE.InstancedBufferGeometry; reach: number; cap: number; trees: Float32Array; forms: Float32Array }[] = [];
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly litter: THREE.Mesh;
  private readonly debris: THREE.Mesh;
  private readonly drift = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly wind = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly placedAt = new THREE.Vector3(1e9, 0, 0);
  private storm = 0;

  constructor(private readonly field: WindField) {
    const rand = mulberry32(4113);
    const variants: Seg[][] = [];
    for (let i = 0; i < 10; i++) variants.push(grow(rand, 'tall'));
    for (let i = 0; i < 2; i++) variants.push(grow(rand, 'broken'));
    for (let i = 0; i < 2; i++) variants.push(grow(rand, 'young'));
    for (let i = 0; i < 2; i++) variants.push(grow(rand, 'thicket'));

    const table = new Float32Array(variants.length * MAX_SEGS * 2 * 4);
    variants.forEach((segs, v) => {
      segs.forEach((s, i) => {
        const o = (v * MAX_SEGS * 2 + i * 2) * 4;
        table.set([s.a.x, s.a.y, s.a.z, s.ra, s.b.x, s.b.y, s.b.z, s.rb], o);
      });
    });
    const segTex = new THREE.DataTexture(table, MAX_SEGS * 2, variants.length, THREE.RGBAFormat, THREE.FloatType);
    segTex.needsUpdate = true;

    this.uniforms = {
      ...atmo.uniforms,
      uSegs: { value: segTex },
      uStorm: { value: 0 },
      uViewA: { value: new THREE.Vector3() },
      uViewB: { value: new THREE.Vector3() },
      uViewClear: { value: 0 },
      uStormDir: { value: new THREE.Vector2(0.4, 0.92) },
      uPixel: { value: 0.0008 },
      uLitterCell: { value: new THREE.Vector2() },
      uWay: { value: WAY.map((w) => new THREE.Vector2(w.x, w.y)) },
      uBox: { value: DEBRIS_BOX },
      uDebrisCentre: { value: new THREE.Vector3() },
      uDrift: { value: this.drift },
    };
    const frag = { fragmentShader: WOOD_FRAG, uniforms: this.uniforms, side: THREE.DoubleSide, alphaToCoverage: true };

    this.place();
    LODS.forEach((lod, level) => {
      const coarse = LODS[level + 1]?.segs ?? 0;
      const treeMat = new THREE.ShaderMaterial({
        vertexShader: TREE_VERT,
        ...frag,
        uniforms: { ...this.uniforms, uDetail: { value: new THREE.Vector3(coarse, lod.reach * 0.78, lod.reach) } },
      });
      const geo = quads(lod.segs);
      const cap = Math.min(lod.cap, this.trees.length);
      const trees = new Float32Array(cap * 4);
      const forms = new Float32Array(cap * 4);
      geo.setAttribute('aTree', new THREE.InstancedBufferAttribute(trees, 4));
      geo.setAttribute('aForm', new THREE.InstancedBufferAttribute(forms, 4));
      geo.instanceCount = 0;
      const mesh = new THREE.Mesh(geo, treeMat);
      mesh.frustumCulled = false;
      this.lods.push({ mesh, geo, reach: lod.reach, cap, trees, forms });
      this.objects.push(mesh);
    });

    const deadfall = new THREE.Mesh(
      mergeGeometries(this.deadfall()),
      new THREE.ShaderMaterial({ vertexShader: DEAD_VERT, ...frag, side: THREE.FrontSide }),
    );
    const snagTree = new THREE.Mesh(planeTree(), new THREE.ShaderMaterial({
      vertexShader: DEAD_VERT.replace('void main() {', 'uniform vec3 uSnagSway; uniform vec2 uSnagHeight;\nvoid main() {')
        .replace('vWorld = position;', `vWorld = position;
          float up = max(0.0, (position.y - uSnagHeight.x) / uSnagHeight.y);
          vWorld += uSnagSway * up * up;`)
        .replace('vFace = normalize(normal);', `vFace = normalize(vec3(normal.x,
          normal.y - dot(normal.xz, uSnagSway.xz) * 2.0 * up / uSnagHeight.y, normal.z));`)
        .replace('vec4(position, 1.0)', 'vec4(vWorld, 1.0)'),
      ...frag, uniforms: { ...this.uniforms, uViewClear: { value: 0 },
        uSnagSway: { value: this.snagSway },
        uSnagHeight: { value: new THREE.Vector2(heightAt(WOOD_PLANE.x, WOOD_PLANE.y) - 0.2, tuning.wood.planeSnagHeight + 0.2) } },
    }));
    snagTree.name = 'wood-plane-tree';
    this.objects.push(deadfall, refugeRocks(), snagTree);

    const card = new THREE.PlaneGeometry(1, 1);
    const litterGeo = new THREE.InstancedBufferGeometry();
    litterGeo.index = card.index;
    litterGeo.setAttribute('position', card.attributes.position);
    const cells = new Float32Array(LITTER_GRID * LITTER_GRID * 2);
    for (let i = 0; i < LITTER_GRID * LITTER_GRID; i++) {
      cells[i * 2] = (i % LITTER_GRID) - LITTER_GRID / 2;
      cells[i * 2 + 1] = Math.floor(i / LITTER_GRID) - LITTER_GRID / 2;
    }
    litterGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
    litterGeo.instanceCount = cells.length / 2;
    litterGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.litter = new THREE.Mesh(litterGeo, new THREE.ShaderMaterial({ vertexShader: LITTER_VERT, ...frag }));
    this.litter.frustumCulled = false;
    this.objects.push(this.litter);

    const debrisGeo = new THREE.InstancedBufferGeometry();
    debrisGeo.index = card.index;
    debrisGeo.setAttribute('position', card.attributes.position);
    const motes = new Float32Array(DEBRIS * 4);
    for (let i = 0; i < motes.length; i++) motes[i] = rand();
    debrisGeo.setAttribute('aMote', new THREE.InstancedBufferAttribute(motes, 4));
    debrisGeo.instanceCount = DEBRIS;
    debrisGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.debris = new THREE.Mesh(debrisGeo, new THREE.ShaderMaterial({ vertexShader: DEBRIS_VERT, ...frag }));
    this.debris.frustumCulled = false;
    this.objects.push(this.debris);

    for (const o of this.objects) o.visible = false;
  }

  /** Thick everywhere but the corridor, thinning to wind-stunted scrub along the shore. */
  private place(): void {
    const rand = mulberry32(7717);
    const patchy = createNoise2D(53);
    const reserved: [number, number, number][] = [
      [WOOD_REFUGE.x - 9, WOOD_REFUGE.z + 5, 11],
      [WOOD_PLANE.x, WOOD_PLANE.y + 3, 8],
      [HOLLOW.x, HOLLOW.z, 3.4],
      [TRUNK_HOLE.x, TRUNK_HOLE.z, 3.6],
      [THICKET.x, THICKET.z, 1.9],
    ];
    const add = (x: number, z: number, variant: number, scale: number, tilt: number, tiltDir: number) => {
      this.trees.push({ x, y: heightAt(x, z) - 0.35, z, variant, yaw: rand() * 6.2831, scale, tilt, tiltDir });
    };

    const step = 3.2;
    const stand = createNoise2D(29);
    for (let gx = ISLE.x - ISLE.rx; gx <= ISLE.x + ISLE.rx; gx += step) {
      for (let gz = ISLE.z - ISLE.rz; gz <= ISLE.z + ISLE.rz; gz += step) {
        const x = gx + (rand() - 0.5) * step * 1.5;
        const z = gz + (rand() - 0.5) * step * 1.5;
        const y = heightAt(x, z);
        if (y < TREE_LINE || onNextIsle(x, z)) continue;
        const way = pathDistance(x, z);
        if (way < CORRIDOR * 0.66) continue;
        if (reserved.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r)) continue;
        const thick = 0.72 + 0.4 * patchy(x * 0.03, z * 0.03);
        if (rand() > thick) continue;
        /** The wind has been at the shore trees all their lives: short, bent and scrubby down there. */
        const shelter = Math.min(1, (y - TREE_LINE) / 4);
        /** Stands of taller timber and stands of scrub, so the top of the wood is a line worth looking at. */
        const stature = 0.55 + 0.45 * stand(x * 0.012, z * 0.012);
        const draw = rand();
        const understory = way < CORRIDOR || draw > 0.76 || shelter < 0.4;
        let variant = Math.floor(rand() * 10);
        let scale = (8 + rand() * 9 * stature) * (0.55 + 0.45 * shelter);
        let tilt = rand() < 0.2 ? 0.22 + rand() * 0.2 : 0.04 + rand() * 0.14;
        if (understory) {
          variant = 12 + Math.floor(rand() * 2);
          scale = (2.6 + rand() * 3.4) * (0.7 + 0.3 * shelter);
          tilt = 0.1 + rand() * 0.25;
        } else if (draw > 0.7) {
          variant = 10 + Math.floor(rand() * 2);
          scale = (6 + rand() * 6) * (0.6 + 0.4 * shelter);
          tilt = 0.08 + rand() * 0.22;
        }
        /** A few have gone over and are lying in the wood; never across the way, where they would be a fence. */
        if (draw < 0.03 && shelter > 0.5 && way > 15) {
          tilt = 1.42 + rand() * 0.14;
          scale = 8 + rand() * 5;
          variant = Math.floor(rand() * 10);
        }
        /**
         * The second rank leans over the way, so it closes overhead; the trees along the edge of it stand up, or
         * their lower limbs are in the child's face rather than arching over.
         */
        let towards = rand() * 6.2831;
        if (way > 8 && way < 16) {
          towards = Math.atan2(onPath.y - z, onPath.x - x);
          if (tilt < 1) tilt += 0.22 * (1 - (way - 8) / 8);
        }
        add(x, z, variant, scale, tilt, towards);
      }
    }

    /** A ring of scrub with a hollow in the middle of it: small enough to be missed, close enough to be found. */
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      if (Math.abs(a - 3.6) < 0.5) continue;
      const r = 1.9 + rand() * 0.7;
      add(THICKET.x + Math.cos(a) * r, THICKET.z + Math.sin(a) * r, 14 + (i % 2), 2.4 + rand() * 1.4, 0.3 + rand() * 0.25, a + Math.PI);
    }
    /** The tree over the root hollow stands on its roots, half its footing washed out from under it. */
    this.trees.push({ x: HOLLOW.x, y: heightAt(HOLLOW.x, HOLLOW.z) + 0.75, z: HOLLOW.z, variant: 1, yaw: 2.1, scale: 13, tilt: 0.16, tiltDir: 2.4 });

    for (let i = this.trees.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [this.trees[i], this.trees[j]] = [this.trees[j], this.trees[i]];
    }
  }

  /** Fallen trunks, root plates and the two hiding places that are made of them. */
  private deadfall(): THREE.BufferGeometry[] {
    const rand = mulberry32(3301);
    const parts: THREE.BufferGeometry[] = [];
    const ground = (x: number, z: number) => heightAt(x, z) - 0.2;


    /** The disc of earth and torn roots a tree brings up with it when it goes over. */
    const plate = (butt: THREE.Vector3, axis: THREE.Vector3, radius: number) => {
      const disc = new THREE.CylinderGeometry(radius, radius * 0.9, 0.26, 9, 1, false);
      disc.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis));
      disc.translate(butt.x, butt.y, butt.z);
      disc.deleteAttribute('uv');
      parts.push(disc);
      const t1 = new THREE.Vector3(-axis.z, 0, axis.x).normalize();
      const t2 = new THREE.Vector3().crossVectors(axis, t1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rand() * 0.6;
        const rim = butt
          .clone()
          .addScaledVector(t1, Math.cos(a) * radius * 0.85)
          .addScaledVector(t2, Math.sin(a) * radius * 0.85);
        const out = rim.clone().sub(butt).normalize();
        const knee = rim.clone().addScaledVector(out, 0.3 + rand() * 0.4).addScaledVector(axis, -0.1);
        const toe = knee.clone().addScaledVector(out, 0.25 + rand() * 0.5);
        toe.y -= 0.3 + rand() * 0.5;
        parts.push(log(rim, knee, 0.11 + rand() * 0.06, 0.07));
        parts.push(log(knee, toe, 0.07, 0.03));
      }
    };

    /** A trunk down across the slope, one end still up on its root plate: a dry gap under the middle of it. */
    const butt = new THREE.Vector3(TRUNK_HOLE.x + 3.6, ground(TRUNK_HOLE.x + 3.6, TRUNK_HOLE.z - 2.8) + 1.15, TRUNK_HOLE.z - 2.8);
    const mid = new THREE.Vector3(TRUNK_HOLE.x - 0.4, ground(TRUNK_HOLE.x - 0.4, TRUNK_HOLE.z + 0.3) + 1.0, TRUNK_HOLE.z + 0.3);
    const tip = new THREE.Vector3(TRUNK_HOLE.x - 4.4, ground(TRUNK_HOLE.x - 4.4, TRUNK_HOLE.z + 3.3) + 0.24, TRUNK_HOLE.z + 3.3);
    parts.push(log(butt, mid, 0.38, 0.29), log(mid, tip, 0.29, 0.19));
    parts.push(log(tip, tip.clone().add(new THREE.Vector3(-2.4, 0.15, 1.5)), 0.19, 0.09));
    plate(butt, butt.clone().sub(mid).normalize(), 1.35);

    /** The washed-out roots the big tree stands on, with a hollow under its foot. */
    const floor = ground(HOLLOW.x, HOLLOW.z);
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2 + 0.4 + rand() * 0.5;
      if (Math.abs(t - 3.5) < 0.7) continue;
      const reach = 1.3 + rand() * 0.8;
      const collar = new THREE.Vector3(HOLLOW.x + Math.cos(t) * 0.4, floor + 0.95, HOLLOW.z + Math.sin(t) * 0.4);
      const knee = new THREE.Vector3(HOLLOW.x + Math.cos(t) * reach * 0.7, floor + 0.3, HOLLOW.z + Math.sin(t) * reach * 0.7);
      const foot = new THREE.Vector3(HOLLOW.x + Math.cos(t) * reach, floor - 0.5, HOLLOW.z + Math.sin(t) * reach);
      parts.push(log(collar, knee, 0.19 + rand() * 0.07, 0.13), log(knee, foot, 0.13, 0.07));
    }

    for (let i = 0; i < 46; i++) {
      const ang = rand() * Math.PI * 2;
      const reach = Math.sqrt(rand()) * 0.86;
      const x = ISLE.x + Math.cos(ang) * reach * ISLE.rx;
      const z = ISLE.z + Math.sin(ang) * reach * ISLE.rz;
      if (ground(x, z) < TREE_LINE + 1 || pathDistance(x, z) < 5.5
        || Math.hypot(x - (WOOD_REFUGE.x - 9), z - (WOOD_REFUGE.z + 5)) < 17
        || Math.hypot(x - WOOD_PLANE.x, z - WOOD_PLANE.y) < 12) continue;
      const yaw = rand() * Math.PI * 2;
      const len = 4.5 + rand() * 5;
      const r = 0.17 + rand() * 0.18;
      const p0 = new THREE.Vector3(x, ground(x, z) + r * 0.5, z);
      const bend = yaw + (rand() - 0.5) * 0.5;
      const p1 = new THREE.Vector3(x + Math.cos(yaw) * len * 0.55, 0, z + Math.sin(yaw) * len * 0.55);
      const p2 = new THREE.Vector3(p1.x + Math.cos(bend) * len * 0.45, 0, p1.z + Math.sin(bend) * len * 0.45);
      p1.y = ground(p1.x, p1.z) + r * 0.45;
      p2.y = ground(p2.x, p2.z) + r * 0.35;
      parts.push(log(p0, p1, r, r * 0.8), log(p1, p2, r * 0.8, r * 0.55));
      if (rand() < 0.35) plate(p0, p0.clone().sub(p1).normalize(), 0.85 + rand() * 0.25);
      if (rand() < 0.4) {
        const snap = p2.clone().add(new THREE.Vector3(Math.cos(yaw + 1.1) * 2, 0.6, Math.sin(yaw + 1.1) * 2));
        parts.push(log(p2, snap, r * 0.55, r * 0.22));
      }
    }
    return parts;
  }

  /** `storm` is 0 calm to 1 the full squall: how hard the trees are working. */
  private readonly snagSway = new THREE.Vector3();
  private readonly snagWind = { x: 0, z: 0, energy: 0, lift: 0 };

  update(dt: number, time: number, camera: THREE.Camera, storm: number, sight?: Shot['subjects']): void {
    /** The wood is only ever drawn from its own island: everywhere else in the journey it is not in the world. */
    const here = Math.hypot(camera.position.x - ISLE.x, camera.position.z - ISLE.z) < ISLE.rx + 260;
    for (const o of this.objects) o.visible = here;
    if (!here) return;

    this.field.sample(WOOD_PLANE.x, WOOD_PLANE.y, this.snagWind);
    woodPlaneSway(time, this.field.breeze, this.snagWind, this.snagSway);

    this.storm += (storm - this.storm) * (1 - Math.exp(-dt * 1.4));
    const u = this.uniforms;
    u.uViewClear.value += ((sight ? 1 : 0) - u.uViewClear.value) * (1 - Math.exp(-dt * 4));
    if (sight) { u.uViewA.value.copy(sight.primary); u.uViewB.value.copy(sight.secondary); }
    u.uStorm.value = this.storm;
    const breeze = this.field.breeze;
    if (breeze.lengthSq() > 1e-4) u.uStormDir.value.copy(breeze).normalize();
    const proj = (camera as THREE.PerspectiveCamera).projectionMatrix.elements[5];
    u.uPixel.value = 2 / (Math.max(proj, 0.1) * window.innerHeight);
    u.uLitterCell.value.set(
      Math.round(camera.position.x / LITTER_CELL),
      Math.round(camera.position.z / LITTER_CELL),
    );

    this.field.sample(camera.position.x, camera.position.z, this.wind);
    this.drift.x += this.wind.x * dt * (0.4 + this.storm);
    this.drift.z += this.wind.z * dt * (0.4 + this.storm);
    this.drift.y -= dt * 0.6;
    camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    u.uDebrisCentre.value.copy(camera.position).addScaledVector(this.forward, DEBRIS_BOX.x * 0.28);
    this.debris.visible = this.storm > 0.02;

    if (camera.position.distanceToSquared(this.placedAt) > 6) {
      this.placedAt.copy(camera.position);
      this.fill(camera.position);
    }
  }

  /** Each level takes the trees inside its reach, the nearest level first, up to what its buffers hold. */
  private fill(eye: THREE.Vector3): void {
    const counts = [0, 0, 0];
    for (const t of this.trees) {
      const d = Math.hypot(t.x - eye.x, t.z - eye.z);
      const level = d < this.lods[0].reach ? 0 : d < this.lods[1].reach ? 1 : d < this.lods[2].reach ? 2 : -1;
      if (level < 0) continue;
      const lod = this.lods[level];
      const i = counts[level];
      if (i >= lod.cap) continue;
      lod.trees.set([t.x, t.y, t.z, t.variant], i * 4);
      lod.forms.set([t.yaw, t.scale, t.tilt, t.tiltDir], i * 4);
      counts[level] = i + 1;
    }
    this.lods.forEach((lod, i) => {
      lod.geo.instanceCount = counts[i];
      lod.geo.attributes.aTree.needsUpdate = true;
      lod.geo.attributes.aForm.needsUpdate = true;
    });
  }
}

/** One quad per segment; the vertex carries (across, along, segment). */
function quads(count: number): THREE.InstancedBufferGeometry {
  const pos = new Float32Array(count * 4 * 3);
  const idx = new Uint16Array(count * 6);
  const corners = [-1, 0, 1, 0, -1, 1, 1, 1];
  for (let s = 0; s < count; s++) {
    for (let c = 0; c < 4; c++) {
      pos[(s * 4 + c) * 3] = corners[c * 2];
      pos[(s * 4 + c) * 3 + 1] = corners[c * 2 + 1];
      pos[(s * 4 + c) * 3 + 2] = s;
    }
    idx.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4 + 2, s * 4 + 1, s * 4 + 3], s * 6);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(new THREE.Uint16BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(ISLE.x, 10, ISLE.z), 400);
  return geo;
}

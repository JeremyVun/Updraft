import * as THREE from 'three';
import { glsl, tuning } from '../../tuning';
import { SKY_MIRROR } from '../sky-mirror-layout';

/**
 * The long swell: the only part of the sea that is real geometry. Everything finer than these waves is a normal
 * on a flat surface, because at the distance it is seen from, shape below this scale does not read.
 *
 * Direction (unit), wavelength in world units, and share of the swell's height. The shortest wave is kept well
 * above the water mesh's spacing near the camera, or the surface would alias as it moves.
 */
const WAVES = [
  { dx: 0.94, dz: 0.34, len: 57, amp: 0.44 },
  { dx: 0.64, dz: -0.77, len: 34, amp: 0.27 },
  { dx: 0.99, dz: -0.15, len: 21, amp: 0.18 },
  { dx: 0.33, dz: 0.94, len: 14, amp: 0.11 },
];

/** How far the water is dragged toward each crest as a share of the lift: sharper crests, flatter troughs. */
const STEEP = 1.2;
const GRAVITY = 9.8;

/** Deep-water waves of this length travel at this speed, which is what makes a long swell outrun a short one. */
const speed = (len: number) => Math.sqrt((GRAVITY * len) / (2 * Math.PI));

export const swellUniforms = {
  /** Height of the swell from trough to crest in world units, 0 for a flat sea. */
  uSwell: { value: 0 },
  /** One swell spreading from where something huge went under: centre x and z, when it went, and its height. */
  uSurge: { value: new THREE.Vector4(0, 0, -1e4, 0) },
  /** The length of what went under, which the swell spreads from: its direction in xz and half its length. */
  uSurgeAxis: { value: new THREE.Vector3(1, 0, 0) },
  /** One low ring of swell going out from a breathing whale's flank: the middle of its length in x and z, when, and its height. */
  uHeave: { value: new THREE.Vector4(0, 0, -1e4, 0) },
  /** The ring its breath before sent out, still going. */
  uHeaveBefore: { value: new THREE.Vector4(0, 0, -1e4, 0) },
  /** The whale's direction in xz, half its length, and how far out from that line its flank meets the sea. */
  uHeaveAxis: { value: new THREE.Vector4(1, 0, 0, 0) },
};

const S = tuning.netWhale;

/** How far p is from the length of what went under. */
function surgeDistance(x: number, z: number): number {
  const g = swellUniforms.uSurge.value;
  const a = swellUniforms.uSurgeAxis.value;
  const along = THREE.MathUtils.clamp((x - g.x) * a.x + (z - g.y) * a.y, -a.z, a.z);
  return Math.hypot(x - g.x - a.x * along, z - g.y - a.y * along);
}

/** The surge's lift at distance r from where it began, t seconds after: one long low crest running outward. */
function surge(r: number, t: number): number {
  const front = t * S.surgeSpeed;
  const d = r - front;
  return Math.exp(-(d * d) / (S.surgeWidth * S.surgeWidth)) * Math.cos((2 * Math.PI * d) / S.surgeLength)
    * THREE.MathUtils.smoothstep(front, 0, 6) * 12 / (12 + r);
}

/** A shallow trough follows the ring out, as the sea it heaped up settles back. */
const HEAVE_TROUGH = 0.35;
/** It broadens over its first `HEAVE_SPREADS` m, and ends a little way either side, so the far sea is left as it was. */
const HEAVE_SPREADS = 12;
const HEAVE_EDGE = (d: number) => THREE.MathUtils.smoothstep(-d, -2.6, -2.0) * THREE.MathUtils.smoothstep(d, -4.4, -3.6);

/** The lift at (x, z) of the low ring of swell a breathing whale sends out from its flank. */
function heave(g: THREE.Vector4, x: number, z: number, time: number): number {
  if (g.w <= 0) return 0;
  const a = swellUniforms.uHeaveAxis.value;
  const t = time - g.z;
  const along = THREE.MathUtils.clamp((x - g.x) * a.x + (z - g.y) * a.y, -a.z, a.z);
  const off = Math.hypot(x - g.x - a.x * along, z - g.y - a.y * along) - a.w;
  const d = (off - t * S.heaveSpeed) / (S.heaveWidth + S.heaveSpread * THREE.MathUtils.clamp(off, 0, HEAVE_SPREADS));
  if (d > 2.6 || d < -4.4) return 0;
  return g.w * (Math.exp(-d * d) - HEAVE_TROUGH * Math.exp(-(d + 1.6) * (d + 1.6))) * HEAVE_EDGE(d) * THREE.MathUtils.smoothstep(t, 0, 1.5)
    * (1 - THREE.MathUtils.smoothstep(t, S.heaveFor * 0.6, S.heaveFor)) * S.heaveReach / (S.heaveReach + Math.max(off, 0));
}

const wave = (w: (typeof WAVES)[number]) => /* glsl */ `
  {
    float ph = ${glsl((2 * Math.PI) / w.len)} * dot(vec2(${glsl(w.dx)}, ${glsl(w.dz)}), p) - ${glsl((speed(w.len) * 2 * Math.PI) / w.len)} * uTime;
    drag += vec2(${glsl(w.dx)}, ${glsl(w.dz)}) * (${glsl(w.amp * STEEP)} * height * cos(ph));
    lift += ${glsl(w.amp)} * height * sin(ph);
  }`;

/** Needs ATMO_GLSL first, in whichever stage uses it. */
export const SWELL_GLSL = /* glsl */ `
uniform float uSwell;
uniform vec4 uSurge;
uniform vec3 uSurgeAxis;
uniform vec4 uHeave;
uniform vec4 uHeaveBefore;
uniform vec4 uHeaveAxis;

float surgeLift(vec2 p) {
  if (uSurge.w <= 0.0) return 0.0;
  vec2 q = p - uSurge.xy;
  float r = length(q - uSurgeAxis.xy * clamp(dot(q, uSurgeAxis.xy), -uSurgeAxis.z, uSurgeAxis.z));
  float front = (uTime - uSurge.z) * ${glsl(S.surgeSpeed)};
  float d = r - front;
  return uSurge.w * exp(-d * d / ${glsl(S.surgeWidth * S.surgeWidth)}) * cos(${glsl((2 * Math.PI) / S.surgeLength)} * d)
    * smoothstep(0.0, 6.0, front) * 12.0 / (12.0 + r);
}

float heaveRing(vec2 p, vec4 g) {
  if (g.w <= 0.0) return 0.0;
  float t = uTime - g.z;
  vec2 q = p - g.xy;
  float off = length(q - uHeaveAxis.xy * clamp(dot(q, uHeaveAxis.xy), -uHeaveAxis.z, uHeaveAxis.z)) - uHeaveAxis.w;
  float d = (off - t * ${glsl(S.heaveSpeed)}) / (${glsl(S.heaveWidth)} + ${glsl(S.heaveSpread)} * clamp(off, 0.0, ${glsl(HEAVE_SPREADS)}));
  if (d > 2.6 || d < -4.4) return 0.0;
  return g.w * (exp(-d * d) - ${glsl(HEAVE_TROUGH)} * exp(-(d + 1.6) * (d + 1.6))) * (1.0 - smoothstep(2.0, 2.6, d)) * smoothstep(-4.4, -3.6, d) * smoothstep(0.0, 1.5, t)
    * (1.0 - smoothstep(${glsl(S.heaveFor * 0.6)}, ${glsl(S.heaveFor)}, t)) * ${glsl(S.heaveReach)} / (${glsl(S.heaveReach)} + max(off, 0.0));
}

float heaveLift(vec2 p) {
  return heaveRing(p, uHeave) + heaveRing(p, uHeaveBefore);
}

/** Where the swell carries the water that would lie at p: sideways in xz, and up in y. */
vec3 swellShift(vec2 p, float height) {
  vec2 drag = vec2(0.0);
  float lift = 0.0;
  ${WAVES.map(wave).join('')}
  return vec3(drag.x, lift + surgeLift(p) + heaveLift(p), drag.y);
}

/** How much of that chop the water at p can carry: none in the shallows, none where the mesh is too coarse. */
float chopHere(vec2 p, float fromCamera) {
  vec2 uv = domainUv(p);
  vec2 edge = min(uv, 1.0 - uv);
  float inside = smoothstep(0.0, 0.04, min(edge.x, edge.y));
  float depth = -mix(-12.0, texture(uHeightTex, clamp(uv, 0.0, 1.0)).r, inside);
  return smoothstep(0.8, 3.5, depth) * (1.0 - smoothstep(55.0, 95.0, fromCamera));
}

/**
 * How much swell there is at p: none where the water is too shallow to hold it, and none far from the camera,
 * where the mesh is too coarse to carry a wave and the ripple normals do the work instead.
 */
float swellHeight(vec2 p, float fromCamera) {
  vec2 uv = domainUv(p);
  vec2 edge = min(uv, 1.0 - uv);
  float inside = smoothstep(0.0, 0.04, min(edge.x, edge.y));
  float depth = -mix(-12.0, texture(uHeightTex, clamp(uv, 0.0, 1.0)).r, inside);
  return uSwell * smoothstep(0.6, 4.5, depth) * (1.0 - smoothstep(62.0, 105.0, fromCamera));
}

/**
 * Surface at a world xz, undoing the waves' horizontal drag just as swellLift does on the CPU, and stilled over
 * the sky mirror as the water mesh is, so wakes and foam there lie on the glass rather than under or over it.
 */
float seaSurfaceY(vec2 world) {
  float height = swellHeight(world, distance(world, cameraPosition.xz))
    * smoothstep(${glsl(tuning.skyMirror.waterInner)}, ${glsl(tuning.skyMirror.waterOuter)}, distance(world, vec2(${glsl(SKY_MIRROR.x)}, ${glsl(SKY_MIRROR.z)})));
  vec2 base = world;
  for (int i = 0; i < 3; i++) base = world - swellShift(base, height).xz;
  return swellShift(base, height).y;
}
`;

export interface Swell {
  /** Lift of the water surface above y = 0. */
  height: number;
  /** Surface tilt, as the rise per unit along world x and z. */
  slopeX: number;
  slopeZ: number;
}

interface Shift {
  x: number;
  y: number;
  z: number;
}
const at: Shift = { x: 0, y: 0, z: 0 };
const along: Shift = { x: 0, y: 0, z: 0 };
const across: Shift = { x: 0, y: 0, z: 0 };

/** `swellShift` again, in the same waves and the same order, for the CPU side of the sea. */
function shift(ux: number, uz: number, time: number, out: Shift): Shift {
  const height = swellUniforms.uSwell.value;
  out.x = 0;
  out.y = 0;
  out.z = 0;
  for (const w of WAVES) {
    const ph = ((2 * Math.PI) / w.len) * (w.dx * ux + w.dz * uz) - ((speed(w.len) * 2 * Math.PI) / w.len) * time;
    const drag = Math.cos(ph) * w.amp * STEEP * height;
    out.x += w.dx * drag;
    out.z += w.dz * drag;
    out.y += w.amp * height * Math.sin(ph);
  }
  const g = swellUniforms.uSurge.value;
  if (g.w > 0) out.y += g.w * surge(surgeDistance(ux, uz), time - g.z);
  out.y += heave(swellUniforms.uHeave.value, ux, uz, time) + heave(swellUniforms.uHeaveBefore.value, ux, uz, time);
  return out;
}

/** How much of the water's height at a point is the swell something huge left going under. */
export function surgeAt(x: number, z: number, time: number): number {
  const g = swellUniforms.uSurge.value;
  return g.w > 0 ? g.w * surge(surgeDistance(x, z), time - g.z) : 0;
}

/** Just how high the water is at a point, for the many small things that ride it without lying along it. */
export function swellLift(x: number, z: number, time: number): number {
  let ux = x;
  let uz = z;
  for (let i = 0; i < 3; i++) {
    shift(ux, uz, time, at);
    ux = x - at.x;
    uz = z - at.z;
  }
  return shift(ux, uz, time, at).y;
}

/**
 * The swell under a point, for anything that floats on it. Shallow water and the distance fade are the mesh's
 * business, so this is the open-sea swell: callers floating near a beach are already aground.
 */
export function swellAt(x: number, z: number, time: number, out: Swell): Swell {
  /** The water at (x, z) started somewhere upwave of it, so undo the drag before asking how high it is. */
  let ux = x;
  let uz = z;
  for (let i = 0; i < 3; i++) {
    shift(ux, uz, time, at);
    ux = x - at.x;
    uz = z - at.z;
  }
  const e = 1.5;
  shift(ux, uz, time, at);
  shift(ux + e, uz, time, along);
  shift(ux, uz + e, time, across);
  const ax = e + along.x - at.x;
  const ay = along.y - at.y;
  const az = along.z - at.z;
  const bx = across.x - at.x;
  const by = across.y - at.y;
  const bz = e + across.z - at.z;
  const ny = bz * ax - bx * az;
  out.height = at.y;
  out.slopeX = -(by * az - bz * ay) / ny;
  out.slopeZ = -(bx * ay - by * ax) / ny;
  return out;
}

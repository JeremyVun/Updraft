import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { tuning } from '../tuning';

/** The bend where the path turns right, and the way the child comes up to it. */
const BEND = new THREE.Vector2(-44, -1762);
const INTO = new THREE.Vector2(-24, -40).normalize();
/** Just past the bend, straight ahead of her as she comes up the leg: the thing she has to walk past to turn. */
export const WOOD_SHAPE = new THREE.Vector3(BEND.x + INTO.x * 3.6, 0, BEND.y + INTO.y * 3.6);
/** The shape's own frame: `x` her right as she faces it, `z` back toward her. */
export const SHAPE_RIGHT = new THREE.Vector3(-INTO.y, 0, INTO.x);
export const SHAPE_FACING = new THREE.Vector3(-INTO.x, 0, -INTO.y);

/** A point given in the shape's frame (right, up from its foot, toward her), in the world. */
export function shapePoint(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const base = heightAt(WOOD_SHAPE.x, WOOD_SHAPE.z);
  return out.set(WOOD_SHAPE.x, base + y, WOOD_SHAPE.z).addScaledVector(SHAPE_RIGHT, x).addScaledVector(SHAPE_FACING, z);
}

/** The one waiting coal, off to the side of the stump, where its light rakes across the bark. */
export const SHAPE_SIDE_COAL = new THREE.Vector2();
{
  const side = shapePoint(-3.1, 0, 1.6);
  SHAPE_SIDE_COAL.set(side.x, side.z);
}

/** How the stump is drawn up from the sketch below: the trunk stretched to stand over her, the antlers a little. */
const TRUNK_TOP = 1.46;
const TRUNK_STRETCH = 2.25;
const ANTLER_STRETCH = 1.1;
const GIRTH = 1.32;
const grown = (p: number[]): [number, number, number] => {
  const y = p[1] <= TRUNK_TOP ? p[1] * TRUNK_STRETCH : TRUNK_TOP * TRUNK_STRETCH + (p[1] - TRUNK_TOP) * ANTLER_STRETCH;
  return [p[0] * GIRTH, y, p[2] * GIRTH];
};

/** Where the owl sits, down in the fork between the two dead limbs, facing her. */
export const OWL_PERCH_LOCAL = new THREE.Vector3(...grown([0, 1.6, 0.02]));
/** The top of the antlers, in the shape's frame. */
export const SHAPE_HEIGHT = grown([0, 3.9, 0])[1];

/**
 * A sliver of moonlight down through a gap in the canopy behind her right shoulder, falling on the stump and the
 * boulder behind it: the light that throws the antlered shadow before any coal is lit. A point, so the shadow is
 * thrown up a little larger than the stump.
 */
const MOON_LOCAL = new THREE.Vector3(5.5, 10.5, 9.5);
/** The pool the sliver lights: centre in the shape's frame and its radius. */
const POOL_LOCAL = new THREE.Vector3(-1.4, 0, -1.6);
const POOL_RADIUS = 5.2;
/** Roughly where the shadow's head falls on the boulder's face, for the camera to keep in frame. */
export const SHAPE_SHADOW_HEAD = new THREE.Vector3();
{
  const eyes = OWL_PERCH_LOCAL.clone().setY(OWL_PERCH_LOCAL.y + 0.5);
  const face = -2.9;
  const s = (face - eyes.z) / (eyes.z - MOON_LOCAL.z);
  const at = eyes.clone().addScaledVector(eyes.clone().sub(MOON_LOCAL), s);
  shapePoint(at.x, at.y, at.z, SHAPE_SHADOW_HEAD);
}

const STUMP_CAPS = 25;
export const SHAPE_STUMP_CAPS = STUMP_CAPS;
/** Two more for the owl's body and head, moved every frame, so its shadow leaves with it. */
const CAPS = STUMP_CAPS + 2;

type CapSpec = [number[], number[], number, number];

/**
 * An old dead stump: a hunched trunk broken off at head height with shards of bark standing up in front, a snapped
 * limb jutting forward under the fork like a muzzle, two shoulders broken short, and two dead limbs rising out of
 * the top in tines, like antlers. Given in the shape's frame; one list makes the mesh and the shadow it casts.
 */
const LOCAL: CapSpec[] = [
  // The trunk (drawn by `trunk`, a little fuller than these, so it never shades itself).
  [[0, -0.4, 0], [0.02, 0.75, 0.03], 0.42, 0.34],
  [[0.02, 0.75, 0.03], [0, 1.45, 0.03], 0.34, 0.26],
  // The snapped limb under it.
  [[0.02, 1.2, 0.24], [0.08, 1.0, 0.6], 0.14, 0.045],
  // Shoulders, broken short, and one long limb reaching down to the litter.
  [[-0.28, 1.12, 0.02], [-0.7, 0.98, 0.18], 0.17, 0.1],
  [[0.28, 1.1, 0.0], [0.82, 0.84, 0.28], 0.16, 0.085],
  [[0.82, 0.84, 0.28], [1.28, 0.36, 0.7], 0.085, 0.035],
  // The two dead limbs: each beam sweeps out and up and curls back in at the top like a lyre, with a brow tine
  // forward, a tine standing up off the first bend, one out off the second, and a forked crown.
  [[-0.3, 1.46, 0.0], [-0.78, 2.12, 0.08], 0.15, 0.115],
  [[-0.78, 2.12, 0.08], [-1.06, 2.86, 0.02], 0.115, 0.085],
  [[-1.06, 2.86, 0.02], [-0.96, 3.5, -0.04], 0.085, 0.055],
  [[-0.5, 1.76, 0.06], [-0.58, 2.22, 0.5], 0.07, 0.022],
  [[-0.8, 2.16, 0.08], [-0.66, 2.74, 0.2], 0.065, 0.02],
  [[-1.04, 2.78, 0.02], [-1.42, 3.18, 0.1], 0.06, 0.018],
  [[-0.96, 3.5, -0.04], [-0.74, 3.9, 0.02], 0.052, 0.016],
  [[-0.96, 3.5, -0.04], [-1.18, 3.86, -0.06], 0.05, 0.015],
  // The right one a little different: its outer tine snapped off short.
  [[0.3, 1.46, 0.0], [0.76, 2.08, 0.1], 0.15, 0.115],
  [[0.76, 2.08, 0.1], [1.08, 2.8, 0.02], 0.115, 0.085],
  [[1.08, 2.8, 0.02], [1.0, 3.44, -0.04], 0.085, 0.055],
  [[0.5, 1.74, 0.06], [0.6, 2.2, 0.5], 0.07, 0.022],
  [[0.8, 2.12, 0.1], [0.7, 2.7, 0.22], 0.065, 0.02],
  [[1.06, 2.74, 0.02], [1.3, 2.92, 0.08], 0.06, 0.045],
  [[1.0, 3.44, -0.04], [0.8, 3.84, 0.02], 0.052, 0.016],
  [[1.0, 3.44, -0.04], [1.24, 3.78, -0.06], 0.05, 0.015],
  // Roots splayed into the litter.
  [[0.32, 0.12, 0.3], [0.86, -0.12, 0.76], 0.17, 0.06],
  [[-0.34, 0.1, 0.26], [-0.9, -0.12, 0.62], 0.16, 0.05],
  [[0.0, 0.1, -0.4], [-0.2, -0.15, -1.0], 0.16, 0.05],
];

/**
 * Shadows worked out per pixel against the stump's capsules and the owl: no shadow map, no extra pass. Only pixels
 * near the stump run the loop. Two lights throw them: the player's one moving light, and the sliver of moon. The
 * dream adds `shapeEyes`: while the owl's eyes are blazing, the light that slips past them throws two eyes up into
 * the shadow's head.
 */
export const SHAPE_SHADOW_GLSL = /* glsl */ `
uniform vec4 uShapeA[${CAPS}];
uniform vec4 uShapeB[${CAPS}];
uniform vec4 uShapeAt;
uniform vec4 uShapeEyeL;
uniform vec4 uShapeEyeR;
uniform vec4 uShapeMoon;
uniform vec4 uShapePool;
float shapeShadowFrom(vec3 p, vec3 light, int count) {
  vec3 d1 = light - p;
  float a = dot(d1, d1);
  float lit = 1.0;
  for (int i = 0; i < ${CAPS}; i++) {
    if (i >= count) break;
    float rad0 = uShapeA[i].w, rad1 = uShapeB[i].w;
    if (rad0 <= 0.0) continue;
    vec3 p2 = uShapeA[i].xyz;
    vec3 d2 = uShapeB[i].xyz - p2;
    vec3 r = p - p2;
    float e = max(dot(d2, d2), 1e-6), f = dot(d2, r), c = dot(d1, r), b = dot(d1, d2);
    float den = a * e - b * b;
    float s = den > 1e-6 ? clamp((b * f - c * e) / den, 0.0, 1.0) : 0.0;
    float t = (b * s + f) / e;
    if (t < 0.0) { t = 0.0; s = clamp(-c / a, 0.0, 1.0); }
    else if (t > 1.0) { t = 1.0; s = clamp((b - c) / a, 0.0, 1.0); }
    float dist = distance(p + d1 * s, p2 + d2 * t);
    float rad = mix(rad0, rad1, t);
    float pen = 0.012 + 0.03 * s;
    lit = min(lit, smoothstep(rad - pen, rad + pen, dist));
  }
  return lit;
}
float shapeShadowCaps(vec3 p, int count) {
  if (uEmberLight.w <= 0.0 || distance(p.xz, uShapeAt.xz) > uShapeAt.w) return 1.0;
  return shapeShadowFrom(p, uEmberLight.xyz, count);
}
float shapeShadow(vec3 p) { return shapeShadowCaps(p, ${CAPS}); }
float shapeEye(vec3 p, vec4 eye, vec3 light) {
  vec3 d = p - light;
  float s = dot(eye.xyz - light, d) / max(dot(d, d), 1e-6);
  if (s <= 0.05 || s >= 0.9) return 0.0;
  float dist = distance(light + d * s, eye.xyz);
  return 1.0 - smoothstep(eye.w * 0.5, eye.w * 1.6, dist);
}
float shapeEyes(vec3 p, vec3 light) {
  if (uShapeEyeL.w <= 0.0) return 0.0;
  return shapeEye(p, uShapeEyeL, light) + shapeEye(p, uShapeEyeR, light);
}
const vec3 SHAPE_EYE_GLOW = vec3(1.0, 0.7, 0.24);
/** What the shadowed firelight gives back: the stump's shadow, and the two eyes the dream puts in it. */
vec3 shapeLit(vec3 p, vec3 lit) {
  if (uEmberLight.w <= 0.0 || distance(p.xz, uShapeAt.xz) > uShapeAt.w) return lit;
  vec3 d = uEmberLight.xyz - p;
  float fall = uEmberLight.w / (1.0 + dot(d, d) * 0.055);
  return lit * shapeShadowFrom(p, uEmberLight.xyz, ${CAPS})
    + SHAPE_EYE_GLOW * shapeEyes(p, uEmberLight.xyz) * uShapeAt.y * min(1.0, fall * 0.9);
}
/** How much of the sliver of moon reaches a point: the pool it falls in. */
float shapePoolAt(vec3 p) {
  if (uShapeMoon.w <= 0.0) return 0.0;
  return 1.0 - smoothstep(uShapePool.w * 0.55, uShapePool.w, distance(p.xz, uShapePool.xz));
}
/** The sliver of moon on alb, with the stump's shadow in it and the eyes the dream puts in the shadow's head. */
vec3 shapeMoon(vec3 p, vec3 n, vec3 alb) {
  float pool = shapePoolAt(p);
  if (pool <= 0.0) return vec3(0.0);
  vec3 L = normalize(uShapeMoon.xyz - p);
  float facing = max(0.0, dot(n, L));
  float lit = facing > 0.0 ? shapeShadowFrom(p + n * 0.03, uShapeMoon.xyz, ${CAPS}) : 0.0;
  vec3 moon = vec3(0.62, 0.74, 1.0) * uShapeMoon.w * uNight * pool;
  return alb * moon * facing * lit + SHAPE_EYE_GLOW * shapeEyes(p, uShapeMoon.xyz) * uShapeAt.y * pool * 0.9;
}`;

/** Shared by everything that receives the stump's shadow: the stump, the boulder behind it, the owl and the floor. */
export const shapeUniforms = {
  uShapeA: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  uShapeB: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  /** xz the stump, y how bright the eyes thrown into its shadow are, w how far round it the shadow is worked out. */
  uShapeAt: { value: new THREE.Vector4(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 18) },
  uShapeEyeL: { value: new THREE.Vector4() },
  uShapeEyeR: { value: new THREE.Vector4() },
  /** xyz where the sliver of moon comes from, w how bright it is. */
  uShapeMoon: { value: new THREE.Vector4() },
  /** xz the middle of the pool it lights, w its radius. */
  uShapePool: { value: new THREE.Vector4() },
};

/** Moves the owl's two shadow capsules: its body and its head, or nothing once it has gone. */
export function setOwlShadow(body: THREE.Vector3 | null, head: THREE.Vector3 | null, bodyR: number, headR: number): void {
  const a = shapeUniforms.uShapeA.value, b = shapeUniforms.uShapeB.value;
  if (body) { a[STUMP_CAPS].set(body.x, body.y, body.z, bodyR); b[STUMP_CAPS].set(body.x, body.y, body.z, bodyR); }
  else { a[STUMP_CAPS].w = 0; b[STUMP_CAPS].w = 0; }
  if (head) { a[STUMP_CAPS + 1].set(head.x, head.y, head.z, headR); b[STUMP_CAPS + 1].set(head.x, head.y, head.z, headR); }
  else { a[STUMP_CAPS + 1].w = 0; b[STUMP_CAPS + 1].w = 0; }
}

/** Where the owl's two eyes are, how large, and how brightly the light slipping past them shows in the shadow. */
export function setShadowEyes(left: THREE.Vector3, right: THREE.Vector3, radius: number, glow: number): void {
  shapeUniforms.uShapeEyeL.value.set(left.x, left.y, left.z, glow > 0.001 ? radius : 0);
  shapeUniforms.uShapeEyeR.value.set(right.x, right.y, right.z, radius);
  shapeUniforms.uShapeAt.value.y = glow;
}

function tube(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, seed: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(rb, ra, len, ra > 0.25 ? 18 : 10, Math.max(2, Math.round(len * 5)), false);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const gnarl = 1 + 0.07 * Math.sin(ang * 3 + y * 2.3 + seed) + 0.05 * Math.sin(ang * 7 - y * 5 + seed * 2);
    pos.setXYZ(i, x * gnarl, y, z * gnarl);
  }
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

/**
 * The trunk as one piece, snapped off at the top: a ragged rim of splinters, higher at the front so the owl sits
 * down in it, round a hollow where the heart rotted out.
 */
function trunk(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(rb, ra, len, 28, 12, false);
  const pos = geo.getAttribute('position');
  const top = len / 2;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    const flare = 1 + 0.35 * Math.max(0, -(y + top * 0.55) / (top * 0.45)) ** 2;
    const gnarl = 1 + 0.06 * Math.sin(ang * 3 + y * 2.1) + 0.04 * Math.sin(ang * 8 - y * 4) + 0.03 * Math.sin(ang * 13 + y * 9);
    x *= gnarl * flare; z *= gnarl * flare;
    if (y > top - 1e-4) {
      const front = Math.max(0, Math.sin(ang));
      const splinter = Math.abs(Math.sin(ang * 4.5 + 0.7)) ** 3 * 0.22 + Math.abs(Math.sin(ang * 11 + 2.1)) ** 6 * 0.12;
      y += r < 1e-3 ? -0.22 : (0.04 + 0.2 * front) * (0.5 + splinter * 3) - (1 - r / (rb * gnarl)) * 0.25;
      if (r > 1e-3) { const k = 1 - 0.18 * splinter; x *= k; z *= k; }
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

function knuckle(at: THREE.Vector3, r: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, 2);
  geo.translate(at.x, at.y, at.z);
  return geo;
}

/** Tags a part with what it is (0 wood, 1 stone) and the direction its grain runs. */
function strip(geo: THREE.BufferGeometry, kind: number, axis: THREE.Vector3): THREE.BufferGeometry {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const g = mergeVertices(geo);
  g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(new Float32Array(n).fill(kind), 1));
  const ax = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) ax.set([axis.x, axis.y, axis.z], i * 3);
  g.setAttribute('aAxis', new THREE.Float32BufferAttribute(ax, 3));
  return g;
}

const SHAPE_VERT = /* glsl */ `${ATMO_GLSL}
in float aKind;
in vec3 aAxis;
uniform vec4 uShapeAt;
out vec3 vWorld; out vec3 vNormal; out float vKind; out vec3 vAxis; out vec3 vLocal;
void main() {
  vWorld = position; vNormal = normal; vKind = aKind; vAxis = aAxis;
  vLocal = position - vec3(uShapeAt.x, 0.0, uShapeAt.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

/**
 * Old dead wood and the boulder behind it. Light from straight on flattens both into shapes; light from the side
 * rakes the furrows of the bark and the beds of the stone, which is how the stump comes to be plainly a stump.
 */
const SHAPE_FRAG = /* glsl */ `
${ATMO_GLSL}
${SHAPE_SHADOW_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in float vKind;
in vec3 vAxis;
in vec3 vLocal;
vec3 bump(vec3 n, float h, float k) {
  vec3 dpdx = dFdx(vWorld), dpdy = dFdy(vWorld);
  float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * n - grad * k);
}
void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb;
  float h;
  if (vKind < 0.5) {
    // Bark furrows run with the grain of each limb.
    vec3 axis = normalize(vAxis);
    float along = dot(vLocal, axis);
    vec3 side = normalize(cross(axis, abs(axis.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
    vec3 perp = vLocal - axis * along;
    float around = atan(dot(perp, cross(axis, side)), dot(perp, side) + 1e-4) * 2.0;
    float furrow = vnoise(vec2(around * 2.0, along * 1.1)) * 0.65 + vnoise(vec2(around * 4.3, along * 2.3)) * 0.35;
    float fine = vnoise(vec2(around * 9.0, along * 7.0));
    h = smoothstep(0.25, 0.75, furrow) * 0.7 + fine * 0.3;
    float weather = vnoise(vLocal.xz * 1.3 + vLocal.y * 0.8);
    // Dead wood goes silver where the weather gets at it and stays dark brown in the cracks.
    alb = mix(vec3(0.05, 0.04, 0.03), mix(vec3(0.11, 0.085, 0.062), vec3(0.17, 0.16, 0.145), weather), smoothstep(0.1, 0.8, h));
    float moss = smoothstep(0.5, 0.8, vnoise(vLocal.xz * 2.1 + vLocal.y * 1.7)) * smoothstep(0.0, 0.7, n.y);
    alb = mix(alb, vec3(0.06, 0.09, 0.03), moss * 0.85);
    n = bump(n, h, 0.06);
  } else {
    // Gritstone: dark and cool, blotched with pale lichen, streaked where the rain runs down it, mossed on top.
    float grain = vnoise(vLocal.xz * 5.0 + vLocal.y * 4.0) * 0.5 + vnoise(vec2(dot(vLocal.xz, vec2(0.7, -0.7)), vLocal.y) * 11.0) * 0.5;
    float pits = smoothstep(0.62, 0.8, vnoise(vec2(dot(vLocal.xz, vec2(0.7, 0.7)), vLocal.y) * 4.0));
    h = grain * 0.5 - pits * 0.6;
    vec2 face = vec2(dot(vLocal.xz, vec2(0.7, -0.7)) + vLocal.x * 0.3, vLocal.y);
    float weather = fbm(face * 0.7 + vLocal.z * 0.3);
    alb = mix(vec3(0.085, 0.09, 0.095), vec3(0.15, 0.15, 0.145), weather) * (0.85 + 0.3 * grain);
    float streak = vnoise(vec2(dot(vLocal.xz, vec2(0.7, -0.7)) * 3.5, vLocal.y * 0.35));
    alb *= mix(1.0, 0.6, smoothstep(0.55, 0.8, streak) * (1.0 - smoothstep(0.2, 0.6, n.y)));
    float lichen = smoothstep(0.55, 0.75, fbm(face * 1.3 + 4.0) * 0.8 + grain * 0.2);
    alb = mix(alb, vec3(0.26, 0.28, 0.24), lichen * 0.55);
    float moss = smoothstep(0.35, 0.7, fbm(face * 1.1 + vLocal.z * 0.8) + n.y * 0.35) * smoothstep(0.35, 0.85, n.y);
    alb = mix(alb, vec3(0.05, 0.075, 0.03), moss);
    n = bump(n, h, 0.05);
  }
  vec3 col = alb * hemiLight(n) * 0.75;
  // Faint moon all over, so the boulder's edge is there in the dark; the sliver through the canopy does the rest.
  float moon = max(0.0, dot(n, uSunDir)) * 0.5 + 0.5 * (0.4 + 0.6 * max(0.0, dot(n, V)));
  col += alb * uSunColor * moon * (vKind > 0.5 ? 0.9 : 0.35) * uNight;
  // The stump takes less of it than the stone, so it stays a dark shape in front of its own shadow.
  col += shapeMoon(vWorld, n, alb) * (vKind > 0.5 ? 1.0 : 0.3);
  vec3 warm = (alb + vec3(0.012, 0.008, 0.004)) * emberLight(vWorld, n);
  col += shapeLit(vWorld + n * 0.04, warm);
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

/** The stump that looms at the bend and the boulder it stands in front of. */
export class WoodShape {
  readonly mesh: THREE.Mesh;
  /** A place on the bark she can lay a mitten on, on the near side of the trunk. */
  readonly touch = new THREE.Vector3();
  /** Where no tree may stand: round the stump, the boulder behind it, and the owl's way up out of the fork. */
  static clears(x: number, z: number): boolean {
    const dx = x - WOOD_SHAPE.x, dz = z - WOOD_SHAPE.z;
    const lx = dx * SHAPE_RIGHT.x + dz * SHAPE_RIGHT.z, lz = dx * SHAPE_FACING.x + dz * SHAPE_FACING.z;
    return Math.hypot(lx, lz) < (lz > 0 ? 7.5 : 6) || Math.hypot(lx + 1.6, lz + 3.4) < 5.5;
  }

  constructor() {
    const base = heightAt(WOOD_SHAPE.x, WOOD_SHAPE.z);
    WOOD_SHAPE.y = base;
    const caps = LOCAL.map(([a, b, ra, rb]) => ({ a: shapePoint(...grown(a)), b: shapePoint(...grown(b)), ra: ra * GIRTH, rb: rb * GIRTH }));
    caps.forEach((c, i) => {
      shapeUniforms.uShapeA.value[i].set(c.a.x, c.a.y, c.a.z, c.ra);
      shapeUniforms.uShapeB.value[i].set(c.b.x, c.b.y, c.b.z, c.rb);
    });
    shapeUniforms.uShapeAt.value.set(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 18);
    const moon = shapePoint(MOON_LOCAL.x, MOON_LOCAL.y, MOON_LOCAL.z);
    shapeUniforms.uShapeMoon.value.set(moon.x, moon.y, moon.z, tuning.wood.shape.moonlight);
    const pool = shapePoint(POOL_LOCAL.x, 0, POOL_LOCAL.z);
    shapeUniforms.uShapePool.value.set(pool.x, 0, pool.z, POOL_RADIUS);
    shapePoint(-0.5, 1.2, 0.5, this.touch);

    const parts: THREE.BufferGeometry[] = [];
    // The trunk faces her: its front (where the rim stands highest) is the shape's +z.
    const yaw = Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z);
    const [, top] = grown([0, 1.5, 0]);
    const stem = trunk(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, top, 0), 0.5 * GIRTH, 0.34 * GIRTH);
    stem.rotateY(yaw);
    stem.translate(WOOD_SHAPE.x, base, WOOD_SHAPE.z);
    parts.push(strip(stem, 0, new THREE.Vector3(0, 1, 0)));
    caps.forEach((c, i) => {
      const axis = c.b.clone().sub(c.a).normalize();
      if (i < 2) return;
      parts.push(strip(tube(c.a, c.b, c.ra, c.rb, i * 1.7), 0, axis));
      // Joints are rounded over; broken ends are left as they snapped.
      if (caps.some((d) => d !== c && d.a.distanceTo(c.b) < 0.02)) parts.push(strip(knuckle(c.b, c.rb * 1.04), 0, axis));
    });
    this.boulder(parts);
    const geo = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...shapeUniforms },
      vertexShader: SHAPE_VERT,
      fragmentShader: SHAPE_FRAG,
    }));
    this.mesh.name = 'wood-shape';
    this.mesh.frustumCulled = false;
  }

  /**
   * One old boulder behind the stump, half sunk in the litter with its broad face leaning back toward the moon: just
   * enough stone to take the shadow. A smaller one shoulders against it and a few fallen pieces bed it in.
   */
  private boulder(parts: THREE.BufferGeometry[]): void {
    const up = new THREE.Vector3(0, 1, 0);
    // [x, y, z] centre in the shape's frame, [w, h, d] half sizes, yaw, lean back, seed.
    const stones: [number[], number[], number, number, number][] = [
      [[-1.7, 1.15, -3.6], [2.7, 2.6, 1.5], 0.15, 0.3, 3],
      [[1.5, 0.35, -3.3], [1.2, 1.05, 1.0], -0.4, 0.15, 7],
      [[-4.3, 0.1, -2.6], [0.75, 0.5, 0.65], 0.9, 0.1, 11],
      [[0.4, 0.0, -2.1], [0.5, 0.32, 0.45], -0.6, 0.1, 13],
    ];
    stones.forEach(([at, size, turn, lean, seed]) => parts.push(strip(this.stone(at, size, turn, lean, seed), 1, up)));
  }

  /** A weathered stone: a rounded mass with a few broad facets, its front face flattened and leaning back. */
  private stone(at: number[], size: number[], turn: number, lean: number, seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Flatter in front, where the shadow falls, across the top where it has weathered, and underneath where it sits.
      if (v.z > 0.25) v.z = 0.25 + (v.z - 0.25) * 0.35;
      if (v.y > 0.45) v.y = 0.45 + (v.y - 0.45) * 0.45;
      if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
      const wear = 1 + 0.12 * Math.sin(v.x * 1.7 + v.y * 1.1 + seed) * Math.sin(v.z * 2.1 - v.y * 1.6 + seed * 0.7)
        + 0.05 * Math.sin(v.x * 4.3 - v.y * 3.1 + v.z * 3.7 + seed * 2.1)
        + 0.02 * Math.sin(v.x * 9.7 + v.y * 8.3 - v.z * 7.9 + seed * 3.3);
      v.multiplyScalar(wear);
      // One shoulder stands higher than the other, as a split boulder does.
      v.y += 0.12 * v.x * (v.y + 1);
      v.multiply(new THREE.Vector3(size[0], size[1], size[2]));
      // Leaning back: the higher, the further from her.
      v.z -= lean * (v.y + size[1]);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.rotateY(turn + Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z));
    const centre = shapePoint(at[0], at[1], at[2]);
    geo.translate(centre.x, centre.y, centre.z);
    return geo;
  }
}

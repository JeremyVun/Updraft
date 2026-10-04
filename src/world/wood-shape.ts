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

/** How the stump is drawn up from the sketch below: the trunk stretched to stand over her, the antlers a little. */
const TRUNK_TOP = 1.46;
const TRUNK_STRETCH = 1.75;
const ANTLER_STRETCH = 0.95;
const GIRTH = 1.32;
const grown = (p: number[]): [number, number, number] => {
  const y = p[1] <= TRUNK_TOP ? p[1] * TRUNK_STRETCH : TRUNK_TOP * TRUNK_STRETCH + (p[1] - TRUNK_TOP) * ANTLER_STRETCH;
  return [p[0] * GIRTH, y, p[2] * GIRTH];
};

/** A point in the shape's frame at `distance` out along `angle` (radians round from toward her to her right). */
const bearing = (angle: number, distance: number) => new THREE.Vector3(Math.sin(angle) * distance, 0, Math.cos(angle) * distance);

/**
 * The last coal before the bend, close in front of the stump and to her left: its light throws the antlers broadside
 * up the rock, half as big again as the stump, because the fire sits low and near. The stump is turned to face it,
 * so the side coal, a right angle round from it and further off, sees the antlers edge on: a plain dead stump's
 * shadow, smaller.
 */
const THROW_ANGLE = -0.79;
const SIDE_ANGLE = THROW_ANGLE + Math.PI / 2;
const THROW_LOCAL = bearing(THROW_ANGLE, 3.6);
const SIDE_LOCAL = bearing(SIDE_ANGLE, 4.6);
/** The stump's turn toward the coal before the bend. */
const STUMP_TURN = THROW_ANGLE;
/**
 * The rock is a corner behind the stump: one face square to each coal, so each throws its shadow flat on stone.
 * How far behind the stump each face stands, and each face's turn, ends along it and height.
 */
const FACE_BACK = 2;
const FACES = [
  { turn: THROW_ANGLE, from: -3, to: 3.2, top: 9.2 },
  { turn: SIDE_ANGLE, from: -1.4, to: 3, top: 7.2 },
];

export const SHAPE_THROW_COAL = new THREE.Vector2();
/** The one waiting coal at the stump, off to the side, where its light rakes across the bark. */
export const SHAPE_SIDE_COAL = new THREE.Vector2();
{
  const at = shapePoint(THROW_LOCAL.x, 0, THROW_LOCAL.z);
  SHAPE_THROW_COAL.set(at.x, at.z);
  const side = shapePoint(SIDE_LOCAL.x, 0, SIDE_LOCAL.z);
  SHAPE_SIDE_COAL.set(side.x, side.z);
}
/** Where she waits by the coal before the bend: just beyond it, so it burns beside her in frame. */
export const SHAPE_WAIT = shapePoint(-1.3, 0, 4.1);

/** The stump's sketch turned to face the coal, in the shape's frame. */
const turned = (p: number[]): [number, number, number] => {
  const [x, y, z] = grown(p);
  const c = Math.cos(STUMP_TURN), s = Math.sin(STUMP_TURN);
  return [x * c + z * s, y, -x * s + z * c];
};

/** Where the owl sits, down in the fork between the two dead limbs. */
export const OWL_PERCH_LOCAL = new THREE.Vector3(...turned([0, 1.62, 0.04]));
/** The top of the antlers, in the shape's frame. */
export const SHAPE_HEIGHT = grown([0, 3.9, 0])[1];

/** The owl's way out: up off the fork, over her right shoulder and on up over the way she came, clear of the trees. */
export const OWL_FLIGHT_LOCAL = [
  new THREE.Vector3(-0.3, 3.5, 1.3),
  new THREE.Vector3(-0.8, 4.0, 3.2),
  new THREE.Vector3(-0.9, 4.6, 5.4),
  new THREE.Vector3(-0.4, 7.2, 9.5),
  new THREE.Vector3(0.4, 12, 14),
];

/** What the throwing light reaches for the shadow, centre in the shape's frame and radius: the stump, the rock, the floor between. */
const POOL_LOCAL = new THREE.Vector3(0, 0, -1.4);
const POOL_RADIUS = 6.5;

/** Moves the light that throws the shadow up the rock, `at` in the world, and how bright it is there: 0 until it wakes. */
export function throwShapeLight(at: THREE.Vector3, power: number): void {
  shapeUniforms.uShapeThrow.value.set(at.x, at.y, at.z, power);
}

/** The orb light of a coal laid at a point of the litter, in the world. */
export function coalLight(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x, Math.max(heightAt(x, z), 0) + tuning.wood.orbHover, z);
}

/** How the stump and the owl are shown: 0 dark against the light behind her, 1 lit by the side coal. */
export function showShape(amount: number): void {
  shapeUniforms.uShapeShown.value = amount;
}

const STUMP_CAPS = 25;
export const SHAPE_STUMP_CAPS = STUMP_CAPS;
/** Four more for the owl's body, head and wings, moved every frame, so its shadow flaps and leaves with it. */
const CAPS = STUMP_CAPS + 4;

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
 * near the stump run the loop. Two lights throw them: the player's one moving light, and the coal before the bend. The
 * dream adds `shapeEyes`: while the owl's eyes are blazing, the light that slips past them throws two eyes up into
 * the shadow's head.
 */
export const SHAPE_SHADOW_GLSL = /* glsl */ `
uniform vec4 uShapeA[${CAPS}];
uniform vec4 uShapeB[${CAPS}];
uniform vec4 uShapeAt;
uniform vec4 uShapeEyeL;
uniform vec4 uShapeEyeR;
uniform vec4 uShapeThrow;
uniform vec4 uShapePool;
uniform float uShapeShown;
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
  return 1.0 - smoothstep(eye.w * 0.35, eye.w * 1.0, dist);
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
/** How much of the throwing coal's light falls on a point: the rock and the litter at its foot, not the coal's own pool. */
float shapePoolAt(vec3 p) {
  if (uShapeThrow.w <= 0.0) return 0.0;
  return 1.0 - smoothstep(uShapePool.w * 0.6, uShapePool.w, distance(p.xz, uShapePool.xz));
}
/** The throwing coal's light on alb, with the stump's shadow in it and the eyes the dream puts in the shadow's head. */
vec3 shapeThrow(vec3 p, vec3 n, vec3 alb) {
  float pool = shapePoolAt(p);
  if (pool <= 0.0) return vec3(0.0);
  vec3 d = uShapeThrow.xyz - p;
  vec3 L = normalize(d);
  float facing = max(0.0, dot(n, L));
  float lit = facing > 0.0 ? shapeShadowFrom(p + n * 0.03, uShapeThrow.xyz, ${CAPS}) : 0.0;
  vec3 fire = vec3(1.0, 0.54, 0.2) * uShapeThrow.w * pool / (1.0 + dot(d, d) * 0.03);
  return alb * fire * facing * lit + SHAPE_EYE_GLOW * shapeEyes(p, uShapeThrow.xyz) * uShapeAt.y * pool * min(1.0, uShapeThrow.w);
}`;

/** Shared by everything that receives the stump's shadow: the stump, the boulder behind it, the owl and the floor. */
export const shapeUniforms = {
  uShapeA: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  uShapeB: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  /** xz the stump, y how bright the eyes thrown into its shadow are, w how far round it the shadow is worked out. */
  uShapeAt: { value: new THREE.Vector4(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 18) },
  uShapeEyeL: { value: new THREE.Vector4() },
  uShapeEyeR: { value: new THREE.Vector4() },
  /** xyz the coal before the bend that throws the stump's shadow up the rock, w how much light it throws there. */
  uShapeThrow: { value: new THREE.Vector4() },
  /** xz the middle of what it lights for the shadow, w its radius. */
  uShapePool: { value: new THREE.Vector4() },
  /** 0 the stump and owl stand dark against the fire behind her, 1 the side coal's light shows them. */
  uShapeShown: { value: 0 },
};

/** Moves the owl's shadow capsules: its body and its head, and each wing root to tip; nothing once it has gone. */
export function setOwlShadow(body: THREE.Vector3 | null, head: THREE.Vector3 | null, bodyR: number, headR: number,
  wings?: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3], wingR = 0): void {
  const a = shapeUniforms.uShapeA.value, b = shapeUniforms.uShapeB.value;
  const set = (i: number, p: THREE.Vector3 | null, q: THREE.Vector3 | null, ra: number, rb: number) => {
    if (p && q) { a[i].set(p.x, p.y, p.z, ra); b[i].set(q.x, q.y, q.z, rb); } else { a[i].w = 0; b[i].w = 0; }
  };
  set(STUMP_CAPS, body, body, bodyR, bodyR);
  set(STUMP_CAPS + 1, head, head, headR, headR);
  set(STUMP_CAPS + 2, wings?.[0] ?? null, wings?.[1] ?? null, wingR, wingR * 0.5);
  set(STUMP_CAPS + 3, wings?.[2] ?? null, wings?.[3] ?? null, wingR, wingR * 0.5);
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
    // Gritstone in beds: dark and cool, split along its bedding and down its joints, iron-stained where the rain runs,
    // a few pale crusts of lichen, moss on the ledges.
    vec2 face = vec2(dot(vLocal.xz, normalize(vAxis.xz)), vWorld.y);
    float wob = fbm(face * vec2(0.35, 0.9) + 7.0);
    float bed = face.y * 0.72 + wob * 0.9;
    float seam = 1.0 - smoothstep(0.0, 0.07, abs(fract(bed) - 0.5) - 0.43);
    float joint = 1.0 - smoothstep(0.0, 0.05, abs(vnoise(vec2(face.x * 0.9, face.y * 0.12) + 3.0) - 0.5));
    joint *= smoothstep(0.3, 0.7, vnoise(face * vec2(0.4, 0.6) + 11.0));
    float grain = vnoise(face * vec2(6.0, 9.0)) * 0.55 + vnoise(face * vec2(19.0, 23.0)) * 0.45;
    float chips = smoothstep(0.6, 0.85, vnoise(face * vec2(2.3, 3.1) + floor(bed) * 5.3));
    h = grain * 0.35 + chips * 0.4 - (seam + joint) * 0.9;
    float weather = fbm(face * 0.55 + floor(bed) * 1.7);
    alb = mix(vec3(0.16, 0.155, 0.15), vec3(0.27, 0.26, 0.245), weather) * (0.82 + 0.36 * grain);
    alb = mix(alb, vec3(0.24, 0.17, 0.12), smoothstep(0.55, 0.85, vnoise(vec2(face.x * 2.2, face.y * 0.3) + 5.0)) * 0.35);
    alb *= 1.0 - 0.5 * max(seam * 0.5, joint);
    float lichen = smoothstep(0.7, 0.82, fbm(face * 1.6 + 4.0) * 0.8 + grain * 0.25);
    alb = mix(alb, vec3(0.34, 0.35, 0.3), lichen * 0.4);
    float moss = smoothstep(0.35, 0.7, fbm(face * 1.1 + vLocal.z * 0.8) + n.y * 0.35) * smoothstep(0.45, 0.9, n.y);
    alb = mix(alb, vec3(0.04, 0.06, 0.025), moss);
    n = bump(n, h, 0.09);
  }
  vec3 col = alb * hemiLight(n) * (vKind > 0.5 ? 0.2 : 0.75);
  // Faint moon all over, no more than the trunks round it get: in the dark the rock is not there to see.
  float moon = max(0.0, dot(n, uSunDir)) * 0.5 + 0.5 * (0.4 + 0.6 * max(0.0, dot(n, V)));
  col += alb * uSunColor * moon * (vKind > 0.5 ? 0.08 : 0.3) * uNight;
  // The stump takes less of the coal before the bend than the rock, so it stays a dark shape in front of its shadow.
  col += shapeThrow(vWorld, n, alb) * (vKind > 0.5 ? 1.0 : 0.04 + 0.96 * uShapeShown);
  // The stone takes the fire only through the light that throws the shadow, so it falls off with how the face is turned.
  vec3 warm = (alb + vec3(0.012, 0.008, 0.004)) * emberLight(vWorld, n) * (vKind > 0.5 ? 0.0 : mix(0.12, 1.0, uShapeShown));
  col += shapeLit(vWorld + n * 0.04, warm);
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

/** The stump that looms at the bend and the boulder it stands in front of. */
export class WoodShape {
  readonly mesh: THREE.Mesh;
  /** Where the coal before the bend throws its light from, before anything steers it. */
  readonly throwFrom = new THREE.Vector3();
  /** Where no tree may stand: round the stump, the crag behind it, and the way the owl flies up and out. */
  static clears(x: number, z: number): boolean {
    const dx = x - WOOD_SHAPE.x, dz = z - WOOD_SHAPE.z;
    const lx = dx * SHAPE_RIGHT.x + dz * SHAPE_RIGHT.z, lz = dx * SHAPE_FACING.x + dz * SHAPE_FACING.z;
    const crag = FACES.some(({ turn, from, to }) => {
      const n = bearing(turn, 1), u = lx * n.z - lz * n.x, v = lx * n.x + lz * n.z;
      return u > from - 2 && u < to + 2 && v < -FACE_BACK + 1 && v > -FACE_BACK - 5;
    });
    let offWay = Infinity;
    for (let i = 0; i < OWL_FLIGHT_LOCAL.length; i++) {
      const p = i ? OWL_FLIGHT_LOCAL[i - 1] : OWL_PERCH_LOCAL, q = OWL_FLIGHT_LOCAL[i];
      const ex = q.x - p.x, ez = q.z - p.z;
      const t = THREE.MathUtils.clamp(((lx - p.x) * ex + (lz - p.z) * ez) / (ex * ex + ez * ez), 0, 1);
      offWay = Math.min(offWay, Math.hypot(lx - p.x - ex * t, lz - p.z - ez * t));
    }
    const coals = Math.hypot(lx - THROW_LOCAL.x, lz - THROW_LOCAL.z) < 5.5 || Math.hypot(lx - SIDE_LOCAL.x, lz - SIDE_LOCAL.z) < 4.5;
    return Math.hypot(lx, lz) < (lz > 0 ? 7.5 : 6) || crag || coals || offWay < 3.2;
  }

  constructor() {
    const base = heightAt(WOOD_SHAPE.x, WOOD_SHAPE.z);
    WOOD_SHAPE.y = base;
    const caps = LOCAL.map(([a, b, ra, rb]) => ({ a: shapePoint(...turned(a)), b: shapePoint(...turned(b)), ra: ra * GIRTH, rb: rb * GIRTH }));
    caps.forEach((c, i) => {
      shapeUniforms.uShapeA.value[i].set(c.a.x, c.a.y, c.a.z, c.ra);
      shapeUniforms.uShapeB.value[i].set(c.b.x, c.b.y, c.b.z, c.rb);
    });
    shapeUniforms.uShapeAt.value.set(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 18);
    const at = shapePoint(THROW_LOCAL.x, 0, THROW_LOCAL.z);
    coalLight(at.x, at.z, this.throwFrom);
    shapeUniforms.uShapeThrow.value.set(this.throwFrom.x, this.throwFrom.y, this.throwFrom.z, 0);
    const pool = shapePoint(POOL_LOCAL.x, 0, POOL_LOCAL.z);
    shapeUniforms.uShapePool.value.set(pool.x, 0, pool.z, POOL_RADIUS);

    const parts: THREE.BufferGeometry[] = [];
    // The trunk's rim stands lowest toward her, so the owl down in the fork is in sight once it is lit.
    const yaw = Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z) + Math.PI;
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
   * One crag of bedded gritstone behind the stump, its face toward the coal before the bend and just tall enough to
   * catch the whole of the shadow it throws. A lower block shoulders against it and a few fallen pieces bed it in.
   */
  private boulder(parts: THREE.BufferGeometry[]): void {
    const up = new THREE.Vector3(0, 1, 0);
    FACES.forEach(({ turn, from, to, top }, i) => {
      const along = new THREE.Vector3(Math.cos(turn), 0, -Math.sin(turn)).applyAxisAngle(up, Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z));
      parts.push(strip(this.crag(turn, (from + to) / 2, (to - from) / 2 + 0.3, -1.0, top, 1.5, 5 + i * 4), 1, along));
    });
    // [x, y, z] centre in the shape's frame, [w, h, d] half sizes, yaw, lean back, seed.
    const stones: [number[], number[], number, number, number][] = [
      [[-4.6, 0.1, 0.2], [0.75, 0.5, 0.65], 0.9, 0.1, 11],
      [[3.6, 0.0, 0.4], [0.5, 0.32, 0.45], -0.6, 0.1, 13],
    ];
    stones.forEach(([at, size, turn, lean, seed]) => parts.push(strip(this.stone(at, size, turn, lean, seed), 1, up)));
  }

  /**
   * A tor: beds of stone stacked one on another, each a squared block with its corners broken off along a few planes,
   * narrower and set back a little as they go up, from `bottom` to `top` above the stump's foot, the face square to
   * `face` and `x` along it.
   */
  private crag(face: number, x: number, half: number, bottom: number, top: number, depth: number, seed: number): THREE.BufferGeometry {
    const rand = (k: number) => { const r = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return r - Math.floor(r); };
    const beds: THREE.BufferGeometry[] = [];
    let y = bottom, k = 0;
    while (y < top - 0.4) {
      const tall = Math.min(top - y, 1.25 + rand(k) * 0.9);
      const narrow = 1 - 0.18 * (y - bottom) / (top - bottom) - 0.08 * rand(k + 3);
      beds.push(this.bed(x + (rand(k + 5) - 0.5) * 0.5, half * narrow, y, tall + 0.12, depth * (0.92 + 0.12 * rand(k + 7)),
        0.06 * (y - bottom) / (top - bottom) + 0.08 * rand(k + 9), (rand(k + 11) - 0.5) * 0.08, seed * 7 + k));
      y += tall;
      k++;
    }
    const geo = mergeGeometries(beds);
    for (const b of beds) b.dispose();
    geo.rotateY(face + Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z));
    const foot = shapePoint(0, 0, 0);
    geo.translate(foot.x, foot.y, foot.z);
    return geo;
  }

  /** One bed of a tor: its front on the rock's face, set back by `back`, turned a little by `turn`. */
  private bed(x: number, half: number, bottom: number, tall: number, depth: number, back: number, turn: number, seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    const rand = (k: number) => { const r = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return r - Math.floor(r); };
    const cuts = Array.from({ length: 7 }, (_, k) => {
      const yaw = (k / 7) * Math.PI * 2 + rand(k) * 0.7, rise = (rand(k + 20) - 0.4) * 1.3;
      const n = new THREE.Vector3(Math.sin(yaw) * Math.cos(rise), Math.sin(rise), Math.cos(yaw) * Math.cos(rise));
      // The face toward the coal is left whole; the cuts break the corners and the edges.
      if (n.z > 0.35) n.z = 0.12;
      return { n: n.normalize(), d: 0.8 + rand(k + 40) * 0.18 };
    });
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.set(Math.sign(v.x) * Math.abs(v.x) ** 0.12, Math.sign(v.y) * Math.abs(v.y) ** 0.12, Math.sign(v.z) * Math.abs(v.z) ** 0.12);
      for (const { n, d } of cuts) {
        const over = v.dot(n) - d;
        if (over > 0) v.addScaledVector(n, -over);
      }
      const wear = 0.03 * Math.sin(v.x * 4.3 - v.y * 3.1 + v.z * 3.7 + seed * 2.1) + 0.015 * Math.sin(v.x * 9.7 + v.y * 8.3 - v.z * 7.9 + seed);
      v.multiplyScalar(1 + wear);
      v.set(v.x * half, (v.y + 1) * tall / 2 + bottom, v.z * depth - FACE_BACK - depth - back);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.translate(0, 0, FACE_BACK + depth);
    geo.rotateY(turn);
    geo.translate(x, 0, -FACE_BACK - depth);
    return geo;
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

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { createNoise2D, mulberry32 } from './noise';
import { tuning } from '../tuning';

/** The bend where the path turns right, and the way the child comes up to it. */
const BEND = new THREE.Vector2(-44, -1762);
const INTO = new THREE.Vector2(-24, -40).normalize();
/** Out past the corner on the outside of the bend, off to her left: the thing she has to walk past to turn. */
export const WOOD_SHAPE = new THREE.Vector3(BEND.x + INTO.x * 1.6 + INTO.y * 2.0, 0, BEND.y + INTO.y * 1.6 - INTO.x * 2.0);
/** The shape's own frame: `x` her right as she comes up the path, `z` back toward her. */
export const SHAPE_RIGHT = new THREE.Vector3(-INTO.y, 0, INTO.x);
export const SHAPE_FACING = new THREE.Vector3(-INTO.x, 0, -INTO.y);

/** A point given in the shape's frame (right, up from its foot, toward her), in the world. */
export function shapePoint(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const base = heightAt(WOOD_SHAPE.x, WOOD_SHAPE.z);
  return out.set(WOOD_SHAPE.x, base + y, WOOD_SHAPE.z).addScaledVector(SHAPE_RIGHT, x).addScaledVector(SHAPE_FACING, z);
}

/** Where she stops on the path, well short of the stump: the beat's one frame is built round this spot. */
const WAIT_LOCAL = new THREE.Vector3(2.0, 0, 8.47);
/** The coal before the bend, on the path just ahead of her feet. */
const THROW_LOCAL = new THREE.Vector3(2.5, 0, 6.9);
/** The one coal at the stump, off to its side toward her, a little further from the camera than the stump. */
const SIDE_LOCAL = new THREE.Vector3(-0.75, 0, 1.65);

export const SHAPE_WAIT = shapePoint(WAIT_LOCAL.x, 0, WAIT_LOCAL.z);
export const SHAPE_THROW_COAL = new THREE.Vector2();
export const SHAPE_SIDE_COAL = new THREE.Vector2();
{
  const at = shapePoint(THROW_LOCAL.x, 0, THROW_LOCAL.z);
  SHAPE_THROW_COAL.set(at.x, at.z);
  const side = shapePoint(SIDE_LOCAL.x, 0, SIDE_LOCAL.z);
  SHAPE_SIDE_COAL.set(side.x, side.z);
}

/** A point of the held frame, given in the shape's frame with its height from her feet. */
export function framePoint(p: readonly number[], out = new THREE.Vector3()): THREE.Vector3 {
  shapePoint(p[0], 0, p[2], out);
  out.y = SHAPE_WAIT.y + p[1];
  return out;
}

/**
 * The rock: one weathered outcrop beyond the stump, its broad face turned between her light and the camera so it
 * takes the light and is seen. Its face in the shape's frame: the middle of it on the ground, the way along it (to
 * the right in the frame), how far it runs each way, its height and depth.
 */
const ROCK_AT = new THREE.Vector2(0.3, -3.0);
const ROCK_ALONG = new THREE.Vector2(0.839, -0.545).normalize();
const ROCK_OUT = new THREE.Vector2(-ROCK_ALONG.y, ROCK_ALONG.x);
const ROCK_FROM = -2.2;
const ROCK_TO = 8.6;
const ROCK_DEEP = 2.8;
/** The two shallow fissures down the face, along it and up it from its middle on the ground. */
const FISSURES: [number[], number[]][] = [[[1.4, 5.6], [2.0, 3.6]], [[5.4, 4.6], [6.1, 2.0]]];
/** Where on the face the antlers stand (along it, from the middle), and the plain stump's shadow beside them. */
const MONSTER_U = 2.6;
const SMALL_U = 3.0;

/** The stump's sketch: metres, `x` along the spread of its fork, `z` across it. */
const STUMP_SCALE = 0.95;
/**
 * The fork spreads square to the camera, so the frame sees both limbs; the side coal's light, coming across it,
 * shows a little less of the spread.
 */
const STUMP_TURN = (() => {
  const eye = tuning.wood.shape.eye;
  return Math.atan2(-eye[2], eye[0]) + Math.PI / 2;
})();

const turned = (p: readonly number[]): [number, number, number] => {
  const x = p[0] * STUMP_SCALE, y = p[1] * STUMP_SCALE, z = p[2] * STUMP_SCALE;
  const c = Math.cos(STUMP_TURN), s = Math.sin(STUMP_TURN);
  return [x * c + z * s, y, -x * s + z * c];
};

/** Where the owl sits, down in the crook of the fork against its shorter limb. */
export const OWL_PERCH_LOCAL = new THREE.Vector3(...turned([0.25, 2.2, 0.04]));
/** The top of the taller limb, in the shape's frame. */
export const SHAPE_HEIGHT = 3.95 * STUMP_SCALE;

/**
 * The owl's way out: off the fork toward her, over her head well clear of her hood, then banking up behind her on
 * the far side of the path and out above the crowns.
 */
export const OWL_FLIGHT_LOCAL = [
  new THREE.Vector3(0.4, 2.95, 1.7),
  new THREE.Vector3(1.3, 3.6, 4.7),
  new THREE.Vector3(2.0, 4.7, 8.1),
  new THREE.Vector3(0.2, 7.2, 11.6),
  new THREE.Vector3(-3.6, 12.5, 15.5),
  new THREE.Vector3(-7, 18.5, 18.5),
];

/** The rock's face frame in the world: its middle on the ground, along it, and out of it. */
const FACE_O = new THREE.Vector3();
const FACE_U = new THREE.Vector3();
const FACE_N = new THREE.Vector3();
{
  shapePoint(ROCK_AT.x, 0, ROCK_AT.y, FACE_O);
  const along = shapePoint(ROCK_AT.x + ROCK_ALONG.x, 0, ROCK_AT.y + ROCK_ALONG.y).sub(shapePoint(ROCK_AT.x, 0, ROCK_AT.y));
  FACE_U.copy(along.setY(0).normalize());
  FACE_N.set(-FACE_U.z, 0, FACE_U.x);
  const out = shapePoint(ROCK_AT.x + ROCK_OUT.x, 0, ROCK_AT.y + ROCK_OUT.y).sub(shapePoint(ROCK_AT.x, 0, ROCK_AT.y));
  if (FACE_N.dot(out) < 0) FACE_N.negate();
  FACE_O.y = heightAt(FACE_O.x, FACE_O.z);
}

/** Where the eyes in the antlered outline shine on the rock, in the world. */
export function beastEyes(out = new THREE.Vector3()): THREE.Vector3 {
  out.copy(FACE_O).addScaledVector(FACE_U, MONSTER_U + 0.02);
  out.y = FACE_O.y + 3.5;
  return out;
}

/** Moves the light the coal before the bend throws on the rock, `at` in the world, and how bright it is there. */
export function throwShapeLight(at: THREE.Vector3, power: number): void {
  shapeUniforms.uShapeThrow.value.set(at.x, at.y, at.z, power);
}

/** Moves the side coal's light on the stump, the owl, the rock and the litter round them. */
export function sideShapeLight(at: THREE.Vector3, power: number): void {
  shapeUniforms.uShapeSide.value.set(at.x, at.y, at.z, power);
}

/** The orb light of a coal laid at a point of the litter, in the world. */
export function coalLight(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x, Math.max(heightAt(x, z), 0) + tuning.wood.orbHover, z);
}

/**
 * What the rock shows: `beast` how far the antlered outline has leapt up it, `fold` how far it has folded into the
 * plain stump's shadow with the owl in it, `eyes` how brightly the eyes in the outline shine.
 */
export function shapeOnRock(beast: number, fold: number, eyes: number): void {
  shapeUniforms.uShapeMask.value.set(beast, fold, eyes, shapeUniforms.uShapeMask.value.w);
}

/** How the stump and the owl are shown: 0 dark against the light behind her, 1 lit by the side coal. */
export function showShape(amount: number): void {
  shapeUniforms.uShapeShown.value = amount;
}

const STUMP_CAPS = 14;
export const SHAPE_STUMP_CAPS = STUMP_CAPS;
/** Six more for the owl: body, head, its two ear tufts and its wings, moved every frame. */
const OWL_CAPS = 6;
const CAPS = STUMP_CAPS + OWL_CAPS;

type CapSpec = [number[], number[], number, number];

/**
 * An old dead stump a little taller than her: a thick trunk broken off where it forked, one long limb going up and
 * curling over with its tines, the other shorter, leaning out and snapped, a broken shoulder, a limb reaching down
 * to the litter, and roots. Given in its own frame; one list makes the mesh, its shadow and the shadow on the rock.
 */
const LOCAL: CapSpec[] = [
  [[0, -0.4, 0], [0.03, 1.2, 0.02], 0.46, 0.36],
  [[0.03, 1.2, 0.02], [0.04, 2.15, 0.0], 0.36, 0.3],
  [[-0.2, 2.0, 0.0], [-0.78, 2.68, 0.05], 0.17, 0.13],
  [[-0.78, 2.68, 0.05], [-0.9, 3.42, 0.0], 0.13, 0.09],
  [[-0.9, 3.42, 0.0], [-0.78, 3.95, -0.03], 0.09, 0.04],
  [[-0.82, 2.85, 0.05], [-1.25, 3.15, 0.1], 0.07, 0.025],
  [[-0.88, 3.4, 0.0], [-1.2, 3.72, 0.02], 0.05, 0.018],
  [[0.2, 2.0, 0.0], [0.78, 2.6, -0.03], 0.16, 0.12],
  [[0.78, 2.6, -0.03], [0.98, 3.3, 0.0], 0.12, 0.08],
  [[0.98, 3.3, 0.0], [0.92, 3.68, 0.0], 0.08, 0.035],
  [[0.84, 2.82, -0.02], [1.25, 3.05, 0.05], 0.065, 0.022],
  [[0.3, 1.62, 0.05], [0.86, 1.55, 0.15], 0.15, 0.1],
  [[-0.3, 1.4, 0.0], [-0.95, 1.1, 0.1], 0.15, 0.08],
  [[-0.95, 1.1, 0.1], [-1.35, 0.42, 0.2], 0.08, 0.032],
];
const ROOTS: CapSpec[] = [
  [[0.32, 0.12, 0.3], [0.86, -0.12, 0.76], 0.17, 0.06],
  [[-0.34, 0.1, 0.26], [-0.9, -0.12, 0.62], 0.16, 0.05],
  [[0.0, 0.1, -0.4], [-0.2, -0.15, -1.0], 0.16, 0.05],
];

/**
 * Shadows worked out per pixel against the stump's capsules and the owl: no shadow map, no extra pass. Only pixels
 * near the stump run the loop. The player's one moving light throws them on the litter and the trees; the two coals
 * at the bend light the set itself (`shapeSideLight`, `shapeThrow`).
 */
export const SHAPE_SHADOW_GLSL = /* glsl */ `
uniform vec4 uShapeA[${CAPS}];
uniform vec4 uShapeB[${CAPS}];
uniform vec4 uShapeAt;
uniform vec4 uShapeThrow;
uniform vec4 uShapeSide;
uniform vec4 uShapePool;
uniform vec4 uShapeMask;
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
/** The player's light, with the stump's shadow in it. */
vec3 shapeLit(vec3 p, vec3 lit) {
  if (uEmberLight.w <= 0.0 || distance(p.xz, uShapeAt.xz) > uShapeAt.w) return lit;
  return lit * shapeShadowFrom(p, uEmberLight.xyz, ${CAPS});
}
const vec3 SHAPE_FIRE = vec3(1.0, 0.54, 0.2);
/** The side coal's warm light, falling away over a few metres and wrapping round what it reaches. */
vec3 shapeSideLight(vec3 p, vec3 n) {
  if (uShapeSide.w <= 0.0) return vec3(0.0);
  vec3 d = uShapeSide.xyz - p;
  float dist = length(d);
  return SHAPE_FIRE * uShapeSide.w / (1.0 + dist * dist * 0.08) * clamp(dot(n, d / max(dist, 1e-3)) * 0.6 + 0.4, 0.0, 1.0);
}
/** The coal before the bend's light where it lands on the rock: a pool round the outline, not the whole wood. */
float shapePoolAt(vec3 p) {
  if (uShapeThrow.w <= 0.0) return 0.0;
  return 1.0 - smoothstep(uShapePool.w * 0.45, uShapePool.w, distance(p.xz, uShapePool.xz));
}
/** Both coals at the bend on the litter: the pool at the rock's foot, and the side coal's round the stump. */
vec3 shapeThrow(vec3 p, vec3 n, vec3 alb) {
  vec3 col = vec3(0.0);
  float pool = shapePoolAt(p);
  if (uShapeThrow.w > 0.0) {
    vec3 d = uShapeThrow.xyz - p;
    // Her coal's light runs out along the litter to the rock's foot, where it gathers.
    float reach = (2.2 / (1.0 + dot(d, d) * 0.012) + pool * 2.5) * smoothstep(0.35, 0.8, n.y);
    col += alb * SHAPE_FIRE * uShapeThrow.w * reach * clamp(dot(n, normalize(d)) * 0.5 + 0.5, 0.0, 1.0);
  }
  if (uShapeSide.w > 0.0 && distance(p.xz, uShapeSide.xz) < 11.0) col += alb * shapeSideLight(p, n);
  return col;
}`;

/** Shared by everything that receives the stump's shadow or the light at the bend. */
export const shapeUniforms = {
  uShapeA: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  uShapeB: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  /** xz the stump, w how far round it the shadow is worked out. */
  uShapeAt: { value: new THREE.Vector4(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 18) },
  /** xyz the coal before the bend, w how much light it throws on the rock. */
  uShapeThrow: { value: new THREE.Vector4() },
  /** xyz the side coal, w how much light it gives the stump, the owl and the rock. */
  uShapeSide: { value: new THREE.Vector4() },
  /** xz the middle of the throwing light's pool on the rock, w its radius. */
  uShapePool: { value: new THREE.Vector4() },
  /** x the antlered outline, y its fold into the plain stump's shadow, z the eyes in it, w the owl's own shadow. */
  uShapeMask: { value: new THREE.Vector4() },
  /** 0 the stump and owl stand dark, 1 the side coal's light shows them. */
  uShapeShown: { value: 0 },
};

/** What only the rock needs: where its face is, and the shadow shapes laid on it, in metres along and up it. */
const faceUniforms = {
  uFaceO: { value: FACE_O },
  uFaceU: { value: FACE_U },
  /** x where the antlers stand along the face, y the plain shadow's place, z how much the outline shrinks to it. */
  uFaceSet: { value: new THREE.Vector4(MONSTER_U, SMALL_U, 0.62, 0) },
  /** The plain stump's shadow and the owl's, as 2D capsules on the face: a.xy, b.xy; radii in the second array. */
  uCutA: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  uCutR: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
};

/** Moves the owl's shadow capsules: body, head, ear tufts, each wing root to tip; nothing once it has gone. */
export function setOwlShadow(body: THREE.Vector3 | null, head: THREE.Vector3 | null, bodyR: number, headR: number,
  tufts?: [THREE.Vector3, THREE.Vector3], tuftR = 0,
  wings?: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3], wingR = 0): void {
  const a = shapeUniforms.uShapeA.value, b = shapeUniforms.uShapeB.value;
  const set = (i: number, p: THREE.Vector3 | null, q: THREE.Vector3 | null, ra: number, rb: number) => {
    if (p && q) { a[i].set(p.x, p.y, p.z, ra); b[i].set(q.x, q.y, q.z, rb); } else { a[i].w = 0; b[i].w = 0; }
  };
  set(STUMP_CAPS, body, body, bodyR, bodyR);
  set(STUMP_CAPS + 1, head, head, headR, headR);
  set(STUMP_CAPS + 2, tufts?.[0] ?? null, tufts?.[0] && head ? head : null, tuftR, tuftR * 1.6);
  set(STUMP_CAPS + 3, tufts?.[1] ?? null, tufts?.[1] && head ? head : null, tuftR, tuftR * 1.6);
  set(STUMP_CAPS + 4, wings?.[0] ?? null, wings?.[1] ?? null, wingR, wingR * 0.45);
  set(STUMP_CAPS + 5, wings?.[2] ?? null, wings?.[3] ?? null, wingR, wingR * 0.45);
}

/**
 * Lays the stump's and the owl's capsules flat on the rock as the plain shadow the side coal throws: seen square
 * from the face, set beside the antlers and a little larger than life, leaning away from the coal. The owl's own
 * shadow slides along the face as it flies toward her, so its little flapping shape crosses the stone.
 */
export function layShadowOnRock(owlAway: number, owlShadow: number): void {
  const a = shapeUniforms.uShapeA.value, b = shapeUniforms.uShapeB.value;
  const ca = faceUniforms.uCutA.value, cr = faceUniforms.uCutR.value;
  const along = (x: number, z: number) => {
    const out = (x - FACE_O.x) * FACE_N.x + (z - FACE_O.z) * FACE_N.z;
    return (x - SMALL_FROM.x * out / SMALL_INTO - FACE_O.x) * FACE_U.x + (z - SMALL_FROM.z * out / SMALL_INTO - FACE_O.z) * FACE_U.z;
  };
  const foot = along(WOOD_SHAPE.x, WOOD_SHAPE.z);
  const lay = (p: THREE.Vector4, drift: number) => {
    const u = along(p.x, p.z) - foot, v = p.y - WOOD_SHAPE.y;
    return [SMALL_U + (u + drift) * SMALL_GROW + v * SMALL_LEAN, v * SMALL_GROW + SMALL_RISE];
  };
  for (let i = 0; i < CAPS; i++) {
    const owl = i >= STUMP_CAPS;
    if (a[i].w <= 0 || (owl && owlShadow <= 0)) { cr[i].set(0, 0, 0, 0); continue; }
    const drift = owl ? owlAway * OWL_DRIFT : 0;
    const [au, av] = lay(a[i], drift), [bu, bv] = lay(b[i], drift);
    ca[i].set(au, av, bu, bv);
    const plump = owl ? OWL_PLUMP : 1;
    cr[i].set(a[i].w * SMALL_GROW * plump, b[i].w * SMALL_GROW * plump, 0, 0);
  }
  shapeUniforms.uShapeMask.value.w = owlShadow;
}
const SMALL_GROW = 1.05;
const SMALL_LEAN = 0.48;
/** Raised clear of the litter banked at the stone's foot, so the trunk of it is seen. */
const SMALL_RISE = 0.3;
/** The owl a little plumper in its shadow than the limbs round it, so the round of it reads. */
const OWL_PLUMP = 1.32;
const OWL_DRIFT = 0.5;
/**
 * The way the plain shadow is laid on the stone: from the side coal's side of the fork, a little way round from
 * along it, so the limbs spread narrower than the camera sees them, leaning, with the owl round and eared in the
 * crook of one: a dead stump's shadow with an owl in it, never a figure with its arms up.
 */
const SMALL_FROM = (() => {
  const spread = shapePoint(...turned([1, 0, 0])).sub(WOOD_SHAPE).setY(0).normalize();
  const toward = shapePoint(SIDE_LOCAL.x, 0, SIDE_LOCAL.z).sub(WOOD_SHAPE).setY(0).normalize().negate();
  if (spread.dot(toward) < 0) spread.negate();
  const across = new THREE.Vector3(-spread.z, 0, spread.x);
  if (across.dot(FACE_N) > 0) across.negate();
  const angle = THREE.MathUtils.degToRad(35);
  return spread.multiplyScalar(Math.cos(angle)).addScaledVector(across, Math.sin(angle)).normalize();
})();
const SMALL_INTO = SMALL_FROM.dot(FACE_N);

/** The antlered beast the stump and owl make on the rock in her light, in metres from its feet along the face. */
const MONSTER_GLSL = /* glsl */ `
float sdCap(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdEll(vec2 p, vec2 c, vec2 r) {
  vec2 q = (p - c) / r;
  return (length(q) - 1.0) * min(r.x, r.y);
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
/** One antler, out to the side \`s\`: a beam sweeping out and up, with tines standing up off it like fingers. */
float antler(vec2 p, float s) {
  p.x *= s;
  p.x /= 1.12;
  p.y = 3.86 + (p.y - 3.86) / 1.08;
  float d = sdCap(p, vec2(0.2, 3.86), vec2(0.75, 4.2), 0.13, 0.11);
  d = min(d, sdCap(p, vec2(0.75, 4.2), vec2(1.35, 4.45), 0.11, 0.09));
  d = min(d, sdCap(p, vec2(1.35, 4.45), vec2(1.95, 4.78), 0.09, 0.065));
  d = min(d, sdCap(p, vec2(1.95, 4.78), vec2(2.28, 5.2), 0.065, 0.03));
  d = min(d, sdCap(p, vec2(0.52, 4.07), vec2(0.4, 4.72), 0.075, 0.025));
  d = min(d, sdCap(p, vec2(0.98, 4.29), vec2(1.02, 5.05), 0.075, 0.025));
  d = min(d, sdCap(p, vec2(1.5, 4.53), vec2(1.44, 5.36), 0.07, 0.022));
  d = min(d, sdCap(p, vec2(1.9, 4.75), vec2(1.98, 5.45), 0.06, 0.02));
  d = min(d, sdCap(p, vec2(2.08, 4.88), vec2(2.55, 4.95), 0.05, 0.018));
  return d;
}
float sdTrap(vec2 p, float r1, float r2, float he) {
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, p.y < 0.0 ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = cb.x < 0.0 && ca.y < 0.0 ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float shapeBeast(vec2 p) {
  // Hunched under a cloak of dark, spreading to the foot of the stone, shoulders up round its head.
  float body = sdTrap(p - vec2(-0.1, 0.7), 1.85, 0.85, 1.85) - 0.15;
  body = smin(body, min(sdEll(p, vec2(-0.72, 2.6), vec2(0.5, 0.4)), sdEll(p, vec2(0.75, 2.62), vec2(0.5, 0.4))), 0.3);
  float head = sdEll(p, vec2(0.03, 3.45), vec2(0.45, 0.5));
  head = smin(head, sdEll(p, vec2(0.03, 3.15), vec2(0.28, 0.3)), 0.15);
  head = min(head, sdCap(p, vec2(-0.35, 3.68), vec2(-0.82, 3.95), 0.09, 0.02));
  head = min(head, sdCap(p, vec2(0.38, 3.68), vec2(0.85, 3.95), 0.09, 0.02));
  float d = smin(body, head, 0.3);
  d = min(d, min(antler(p, 1.0), antler(p, -1.0)));
  // One long arm reaching down the stone toward her.
  d = smin(d, sdCap(p, vec2(-0.9, 2.55), vec2(-1.95, 1.85), 0.2, 0.13), 0.12);
  d = min(d, sdCap(p, vec2(-1.95, 1.85), vec2(-2.6, 0.65), 0.13, 0.05));
  return d;
}
/** The two eyes in the beast's head, slanted. */
float shapeBeastEyes(vec2 p) {
  vec2 l = p - vec2(-0.16, 3.5), r = p - vec2(0.22, 3.5);
  l = vec2(l.x * 0.94 + l.y * 0.34, -l.x * 0.34 + l.y * 0.94);
  r = vec2(r.x * 0.94 - r.y * 0.34, r.x * 0.34 + r.y * 0.94);
  float e = exp(-dot(l / vec2(0.1, 0.05), l / vec2(0.1, 0.05))) + exp(-dot(r / vec2(0.1, 0.05), r / vec2(0.1, 0.05)));
  float halo = exp(-dot(l, l) * 30.0) + exp(-dot(r, r) * 30.0);
  return e + halo * 0.25;
}`;

const FACE_GLSL = /* glsl */ `
uniform vec3 uFaceO;
uniform vec3 uFaceU;
uniform vec4 uFaceSet;
uniform vec4 uCutA[${CAPS}];
uniform vec4 uCutR[${CAPS}];
${MONSTER_GLSL}
/** Along the rock's face and up it, in metres from its middle on the ground. */
vec2 faceAt(vec3 p) {
  vec3 r = p - uFaceO;
  return vec2(dot(r, uFaceU), r.y);
}
float plainShadow(vec2 q) {
  float d = 1e3;
  for (int i = 0; i < ${CAPS}; i++) {
    if (uCutR[i].x <= 0.0) continue;
    if (i >= ${STUMP_CAPS} && uShapeMask.w <= 0.0) continue;
    d = min(d, sdCap(q, uCutA[i].xy, uCutA[i].zw, uCutR[i].x, uCutR[i].y));
  }
  return d;
}
/**
 * How dark the shadow on the rock is at q, and in y how bright the eyes in it are. The beast swings aside and
 * shrinks toward the plain shadow as the side coal wakes, and the two are blended through, so it folds into it.
 */
vec2 rockShadow(vec2 q) {
  float beast = uShapeMask.x, fold = uShapeMask.y;
  if (beast <= 0.0 && fold <= 0.0 && uShapeMask.w <= 0.0) return vec2(0.0);
  float k = smoothstep(0.0, 1.0, fold);
  float grow = mix(1.0, uFaceSet.z, k);
  vec2 m = q - vec2(mix(uFaceSet.x, uFaceSet.y, k), 0.0);
  float swing = 0.32 * k;
  m = vec2(m.x * cos(swing) - m.y * sin(swing), m.x * sin(swing) + m.y * cos(swing)) / grow;
  float d = beast > 0.0 ? shapeBeast(m) * grow : 1e3;
  float plain = plainShadow(q);
  float blend = smoothstep(0.15, 0.85, fold);
  d = mix(d, plain, blend);
  if (fold >= 1.0) d = plain;
  float soft = mix(0.05, 0.06, blend);
  float dark = (1.0 - smoothstep(-soft, soft, d)) * max(beast, fold);
  // Past the fold, only the owl's little shadow is left to move on the stone.
  float eyes = beast > 0.0 && uShapeMask.z > 0.0 ? shapeBeastEyes(m) * uShapeMask.z : 0.0;
  return vec2(dark, eyes);
}`;

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
 * Old dead wood and the stone behind it. The stump stays a dark shape until the side coal lights it from the side;
 * the rock takes the coals' light, with whatever shadow the story lays on it.
 */
const SHAPE_FRAG = /* glsl */ `
${ATMO_GLSL}
${SHAPE_SHADOW_GLSL}
${FACE_GLSL}
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
/** Noise that fades to its mean where a pixel covers more than a cycle of it, so the stone never shimmers. */
float calm(vec2 p) {
  float w = length(fwidth(p));
  return mix(vnoise(p), 0.5, smoothstep(0.35, 0.9, w));
}
void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 col;
  if (vKind < 0.5) {
    // Bark furrows run with the grain of each limb.
    vec3 axis = normalize(vAxis);
    float along = dot(vLocal, axis);
    vec3 side = normalize(cross(axis, abs(axis.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
    vec3 perp = vLocal - axis * along;
    float around = atan(dot(perp, cross(axis, side)), dot(perp, side) + 1e-4) * 2.0;
    float furrow = vnoise(vec2(around * 2.0, along * 1.1)) * 0.65 + vnoise(vec2(around * 4.3, along * 2.3)) * 0.35;
    float fine = calm(vec2(around * 9.0, along * 7.0));
    float h = smoothstep(0.25, 0.75, furrow) * 0.7 + fine * 0.3;
    float weather = vnoise(vLocal.xz * 1.3 + vLocal.y * 0.8);
    // Dead wood goes silver-brown where the weather gets at it and stays dark in the cracks.
    vec3 alb = mix(vec3(0.04, 0.028, 0.02), mix(vec3(0.12, 0.075, 0.045), vec3(0.15, 0.11, 0.08), weather), smoothstep(0.1, 0.8, h));
    float moss = smoothstep(0.5, 0.8, vnoise(vLocal.xz * 2.1 + vLocal.y * 1.7)) * smoothstep(0.0, 0.7, n.y);
    alb = mix(alb, vec3(0.06, 0.08, 0.03), moss * 0.7);
    n = bump(n, h, 0.06);
    col = alb * hemiLight(n) * 0.5;
    float moon = max(0.0, dot(n, uSunDir)) * 0.5 + 0.5 * pow(1.0 - max(0.0, dot(n, V)), 2.0);
    col += alb * uSunColor * moon * 0.3 * uNight;
    // Her light behind it reaches its front only a little: until the side coal wakes it is a shape, not a stump.
    col += shapeLit(vWorld + n * 0.04, (alb + vec3(0.01, 0.006, 0.003)) * emberLight(vWorld, n)) * mix(0.12, 0.4, uShapeShown);
    vec3 raking = shapeSideLight(vWorld, n) * uShapeShown;
    col += (alb + vec3(0.006, 0.004, 0.002)) * raking * 0.8;
    col += raking * pow(1.0 - max(0.0, dot(n, V)), 3.0) * 0.08;
  } else {
    // Weathered stone in broad planes: brown-grey, a few shallow fissures, lichen here and there, moss and fallen
    // leaves banked at its foot.
    vec2 q = faceAt(vWorld);
    vec3 an = abs(n);
    vec2 st = an.y > 0.7 ? vWorld.xz : q;
    float broad = fbm(st * 0.32 + 3.0);
    float mid = calm(st * 1.4 + 7.0);
    float grain = calm(st * 4.5);
    float h = broad * 0.6 + mid * 0.3 + grain * 0.1;
    vec3 alb = mix(vec3(0.1, 0.09, 0.08), vec3(0.16, 0.145, 0.125), smoothstep(0.2, 0.8, broad)) * (0.85 + 0.25 * mid) * (0.8 + 0.4 * grain);
    // Rain has run down it for years: darker streaks under the lips, a rusty stain or two.
    float streak = smoothstep(0.45, 0.85, calm(vec2(q.x * 1.6, q.y * 0.22) + 2.0));
    alb *= 1.0 - 0.35 * streak * (1.0 - an.y);
    alb = mix(alb, vec3(0.2, 0.13, 0.08), smoothstep(0.6, 0.85, vnoise(vec2(q.x * 0.7, q.y * 0.2) + 5.0)) * 0.3);
    float lichen = smoothstep(0.68, 0.8, fbm(st * 0.9 + 4.0) * 0.85 + mid * 0.2);
    alb = mix(alb, vec3(0.3, 0.31, 0.26), lichen * 0.35);
    float above = vWorld.y - uFaceO.y;
    float foot = 1.0 - smoothstep(0.15, 0.9 + 0.4 * broad, above);
    alb = mix(alb, mix(vec3(0.05, 0.065, 0.03), vec3(0.09, 0.05, 0.025), step(0.5, mid)), foot * 0.85);
    float moss = smoothstep(0.55, 0.85, n.y) * smoothstep(0.4, 0.7, broad + 0.2 * mid);
    alb = mix(alb, vec3(0.05, 0.07, 0.03), moss * 0.8);
    n = bump(n, h, 0.06);
    col = alb * hemiLight(n) * 0.12;
    // A breath of moon along the top edge, so it stands against the trees behind it.
    float rim = pow(1.0 - max(0.0, dot(n, V)), 3.0) * smoothstep(0.1, 0.6, n.y);
    col += alb * uSunColor * (max(0.0, dot(n, uSunDir)) * 0.025 + rim * 0.12) * uNight;
    vec2 shade = rockShadow(q);
    vec3 toCoal = uShapeThrow.xyz - vWorld;
    vec3 L = normalize(toCoal);
    // Brightest low down nearest her coal, falling away up the face and along it.
    float near = pow(dot(uShapePool.xz - uShapeThrow.xz, uShapePool.xz - uShapeThrow.xz) / max(dot(toCoal, toCoal), 1.0), 0.8);
    vec3 thrown = SHAPE_FIRE * uShapeThrow.w * shapePoolAt(vWorld) * near * clamp(dot(n, L) * 0.8 + 0.2, 0.0, 1.0)
      * mix(1.0, 0.6, smoothstep(1.5, 6.5, above));
    vec3 warm = thrown + shapeSideLight(vWorld, n) * 0.5;
    col += (alb + vec3(0.01, 0.007, 0.004)) * warm * (1.0 - 0.92 * shade.x);
    col += vec3(1.0, 0.68, 0.22) * shade.y * 2.4;
  }
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

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
 * The trunk as one piece, snapped off at the top: a ragged rim of splinters, higher at the back so the owl sits
 * down in it in sight of the camera, round a hollow where the heart rotted out.
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
    const flare = 1 + 0.4 * Math.max(0, -(y + top * 0.6) / (top * 0.4)) ** 2;
    const gnarl = 1 + 0.06 * Math.sin(ang * 3 + y * 2.1) + 0.04 * Math.sin(ang * 8 - y * 4) + 0.03 * Math.sin(ang * 13 + y * 9);
    x *= gnarl * flare; z *= gnarl * flare;
    if (y > top - 1e-4) {
      const back = Math.max(0, -Math.sin(ang));
      const splinter = Math.abs(Math.sin(ang * 4.5 + 0.7)) ** 3 * 0.22 + Math.abs(Math.sin(ang * 11 + 2.1)) ** 6 * 0.12;
      y += r < 1e-3 ? -0.2 : (0.03 + 0.16 * back) * (0.5 + splinter * 3) - (1 - r / (rb * gnarl)) * 0.22;
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

/** Distance from (x, y) to the segment a-b. */
function segment(x: number, y: number, a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}


/**
 * The bare path and the earth round the bend take the coals' light here as the litter does: warm pools round each
 * coal, and her coal's light running out along the ground to the foot of the rock. Added over the ground, so where
 * no coal burns it is nothing.
 */
const POOL_VERT = /* glsl */ `${ATMO_GLSL}
out vec3 vWorld;
void main() {
  vWorld = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;
const POOL_FRAG = /* glsl */ `${ATMO_GLSL}
${SHAPE_SHADOW_GLSL}
in vec3 vWorld;
void main() {
  // Dirt and the leaves trodden into it, in patches.
  float leaves = smoothstep(0.4, 0.8, vnoise(vWorld.xz * 2.3) * 0.6 + vnoise(vWorld.xz * 7.1) * 0.4);
  vec3 alb = mix(vec3(0.02, 0.014, 0.01), vec3(0.1, 0.055, 0.025), leaves);
  vec3 warm = vec3(0.0);
  if (uShapeThrow.w > 0.0) {
    vec3 d = uShapeThrow.xyz - vWorld;
    // A pool at her coal, and a faint run of its light along the ground to the rock's foot, where it gathers.
    warm += SHAPE_FIRE * uShapeThrow.w * (2.6 / (1.0 + dot(d, d) * 0.45) + 0.25 / (1.0 + dot(d, d) * 0.02) + shapePoolAt(vWorld) * 0.5);
  }
  if (uShapeSide.w > 0.0) {
    vec3 d = uShapeSide.xyz - vWorld;
    warm += SHAPE_FIRE * uShapeSide.w * 1.2 / (1.0 + dot(d, d) * 0.3);
  }
  warm += emberLight(vWorld, vec3(0.0, 1.0, 0.0)) * 0.25;
  vec3 col = alb * warm;
  gl_FragColor = vec4(max(applyFog(col, vWorld) - applyFog(vec3(0.0), vWorld), 0.0), 1.0);
}`;

/** The stump at the bend and the rock behind it. */
export class WoodShape {
  readonly mesh: THREE.Mesh;
  /** The coals' light on the ground round the bend. */
  readonly floor: THREE.Mesh;
  /** Where the coal before the bend throws its light from. */
  readonly throwFrom = new THREE.Vector3();

  /** Is a point on the rock's footprint, with `margin` round it? */
  static onRock(x: number, z: number, margin = 0): boolean {
    const dx = x - FACE_O.x, dz = z - FACE_O.z;
    const u = dx * FACE_U.x + dz * FACE_U.z, n = dx * FACE_N.x + dz * FACE_N.z;
    return u > ROCK_FROM - margin && u < ROCK_TO + margin && n < 0.4 + margin && n > -ROCK_DEEP - margin;
  }

  /**
   * Where no tree may stand: round the stump and the rock, by the two coals, between the held camera and what it
   * holds, and along the way the owl flies up and out.
   */
  static clears(x: number, z: number): boolean {
    const dx = x - WOOD_SHAPE.x, dz = z - WOOD_SHAPE.z;
    const lx = dx * SHAPE_RIGHT.x + dz * SHAPE_RIGHT.z, lz = dx * SHAPE_FACING.x + dz * SHAPE_FACING.z;
    let offWay = Infinity;
    for (let i = 0; i < OWL_FLIGHT_LOCAL.length; i++) {
      const p = i ? OWL_FLIGHT_LOCAL[i - 1] : OWL_PERCH_LOCAL, q = OWL_FLIGHT_LOCAL[i];
      const ex = q.x - p.x, ez = q.z - p.z;
      const t = THREE.MathUtils.clamp(((lx - p.x) * ex + (lz - p.z) * ez) / (ex * ex + ez * ez), 0, 1);
      offWay = Math.min(offWay, Math.hypot(lx - p.x - ex * t, lz - p.z - ez * t));
    }
    const coals = Math.hypot(lx - THROW_LOCAL.x, lz - THROW_LOCAL.z) < 3 || Math.hypot(lx - SIDE_LOCAL.x, lz - SIDE_LOCAL.z) < 3;
    return Math.hypot(lx, lz) < 3.4 || WoodShape.onRock(x, z, 1.6) || coals || offWay < 3.2 || inFrame(lx, lz);
  }

  constructor() {
    const base = heightAt(WOOD_SHAPE.x, WOOD_SHAPE.z);
    WOOD_SHAPE.y = base;
    const caps = LOCAL.map(([a, b, ra, rb]) => ({ a: shapePoint(...turned(a)), b: shapePoint(...turned(b)), ra: ra * STUMP_SCALE, rb: rb * STUMP_SCALE }));
    caps.forEach((c, i) => {
      shapeUniforms.uShapeA.value[i].set(c.a.x, c.a.y, c.a.z, c.ra);
      shapeUniforms.uShapeB.value[i].set(c.b.x, c.b.y, c.b.z, c.rb);
    });
    shapeUniforms.uShapeAt.value.set(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 18);
    const at = shapePoint(THROW_LOCAL.x, 0, THROW_LOCAL.z);
    coalLight(at.x, at.z, this.throwFrom);
    shapeUniforms.uShapeThrow.value.set(this.throwFrom.x, this.throwFrom.y, this.throwFrom.z, 0);
    const pool = FACE_O.clone().addScaledVector(FACE_U, MONSTER_U + 0.4);
    shapeUniforms.uShapePool.value.set(pool.x, 0, pool.z, 7);
    layShadowOnRock(0, 0);

    const parts: THREE.BufferGeometry[] = [];
    const yaw = Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z) + STUMP_TURN;
    const stem = trunk(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 2.2 * STUMP_SCALE, 0), 0.5 * STUMP_SCALE, 0.31 * STUMP_SCALE);
    stem.rotateY(yaw);
    stem.translate(WOOD_SHAPE.x, base, WOOD_SHAPE.z);
    parts.push(strip(stem, 0, new THREE.Vector3(0, 1, 0)));
    const limbs = [...caps.slice(2), ...ROOTS.map(([a, b, ra, rb]) => ({ a: shapePoint(...turned(a)), b: shapePoint(...turned(b)), ra: ra * STUMP_SCALE, rb: rb * STUMP_SCALE }))];
    limbs.forEach((c, i) => {
      const axis = c.b.clone().sub(c.a).normalize();
      parts.push(strip(tube(c.a, c.b, c.ra, c.rb, i * 1.7), 0, axis));
      // Joints are rounded over; broken ends are left as they snapped.
      if (limbs.some((d) => d !== c && d.a.distanceTo(c.b) < 0.02)) parts.push(strip(knuckle(c.b, c.rb * 1.04), 0, axis));
    });
    parts.push(strip(this.outcrop(), 1, FACE_U));
    parts.push(strip(this.stone([ROCK_TO - 1.0, 0, 1.2], [1.3, 0.85, 1.0], 0.4, 13), 1, FACE_U));
    const geo = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...shapeUniforms, ...faceUniforms },
      vertexShader: SHAPE_VERT,
      fragmentShader: SHAPE_FRAG,
    }));
    this.mesh.name = 'wood-shape';
    this.mesh.frustumCulled = false;
    this.floor = this.pool();
  }

  /** A sheet draped over the ground from behind her stop to the rock's foot. */
  private pool(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(26, 26, 104, 104);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const at = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      shapePoint(1 + pos.getX(i), 0, 3 + pos.getZ(i), at);
      at.y = heightAt(at.x, at.z) + 0.05;
      pos.setXYZ(i, at.x, at.y, at.z);
    }
    geo.deleteAttribute('uv');
    geo.deleteAttribute('normal');
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...shapeUniforms },
      vertexShader: POOL_VERT,
      fragmentShader: POOL_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    mesh.name = 'wood-shape-pool';
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }

  /**
   * One weathered outcrop: a main mass with a broad face leaning back a little, a lower shoulder broken off and
   * sloping away toward the stump, a lower end to the right; where they meet, the joints run down the face. Each mass
   * is a rounded block with lumps and hollows a metre or two across, split into broad planes by shallow cuts. Built
   * along the face (x), up (y) and out of it (z), then set in the world with its foot down in the litter.
   */
  private outcrop(): THREE.BufferGeometry {
    const masses: [number[], number[], number, number, number][] = [
      [[3.2, 2.0, 0], [3.4, 3.3, 1.5], -0.05, 0.04, 71],
      [[-0.1, 0.7, -0.9], [1.9, 1.95, 1.3], 0.38, -0.12, 83],
      [[6.9, 0.8, -0.2], [1.7, 2.2, 1.35], -0.25, 0.15, 97],
    ];
    const parts = masses.map(([at, half, roll, yaw, seed]) => this.mass(at, half, roll, yaw, seed));
    const geo = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    return this.place(geo, 0);
  }

  private mass(at: number[], half: number[], roll: number, yaw: number, seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 5);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    const lumpy = createNoise2D(seed), finer = createNoise2D(seed + 1);
    const rand = mulberry32(seed);
    const points: THREE.Vector3[] = [];
    const turn = new THREE.Euler(0, yaw, roll);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const p = new THREE.Vector3(Math.sign(v.x) * Math.abs(v.x) ** 0.42, Math.sign(v.y) * Math.abs(v.y) ** 0.45, Math.sign(v.z) * Math.abs(v.z) ** 0.5);
      // A broad face in front, leaning back as it rises; a flatter, weathered top.
      if (p.z > 0.3) p.z = 0.3 + (p.z - 0.3) * 0.4;
      if (p.y > 0.6) p.y = 0.6 + (p.y - 0.6) * 0.6;
      p.multiply(new THREE.Vector3(half[0], half[1], half[2]));
      p.z -= 0.1 * (p.y + half[1]);
      const lump = 0.3 * lumpy(p.x * 0.45 + p.z * 0.3, p.y * 0.45) + 0.1 * finer(p.x * 1.1 + p.z * 0.7, p.y * 1.1);
      p.addScaledVector(v, lump * THREE.MathUtils.smoothstep(v.y, -0.6, -0.2));
      p.applyEuler(turn);
      points.push(p);
    }
    // Shallow cuts across the face and top, each taking a set depth off whatever it faces: broad flat planes.
    for (let i = 0; i < 16; i++) {
      const top = i % 3 === 0;
      const n = (top ? new THREE.Vector3((rand() - 0.5) * 1.2, 1, (rand() - 0.2) * 1.0) : new THREE.Vector3((rand() - 0.5) * 1.3, (rand() - 0.35) * 1.0, 1)).normalize();
      const depth = 0.1 + rand() * 0.3;
      let most = -Infinity;
      for (const p of points) most = Math.max(most, p.dot(n));
      for (const p of points) {
        const over = p.dot(n) - (most - depth);
        if (over > 0) p.addScaledVector(n, -over * 0.9);
      }
    }
    const front = 0.58 * half[2];
    points.forEach((p, i) => {
      p.add(new THREE.Vector3(at[0], at[1] + half[1] - 0.7, at[2] - front));
      if (p.z > -0.8) {
        let groove = 0;
        for (const [a, c] of FISSURES) groove = Math.max(groove, Math.exp(-((segment(p.x, p.y, a, c) / 0.16) ** 2)));
        p.z -= 0.12 * groove;
      }
      pos.setXYZ(i, p.x, p.y, p.z);
    });
    return geo;
  }

  /** A lower weathered stone at the rock's foot, flattened in front and on top, at `at` along, up and out of the face. */
  private stone(at: number[], size: number[], lean: number, seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.z > 0.25) v.z = 0.25 + (v.z - 0.25) * 0.35;
      if (v.y > 0.45) v.y = 0.45 + (v.y - 0.45) * 0.45;
      if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
      const wear = 1 + 0.12 * Math.sin(v.x * 1.7 + v.y * 1.1 + seed) * Math.sin(v.z * 2.1 - v.y * 1.6 + seed * 0.7)
        + 0.05 * Math.sin(v.x * 4.3 - v.y * 3.1 + v.z * 3.7 + seed * 2.1);
      v.multiplyScalar(wear);
      v.multiply(new THREE.Vector3(size[0], size[1], size[2]));
      v.z -= lean * (v.y + size[1]);
      v.add(new THREE.Vector3(at[0], at[1], at[2]));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    return this.place(geo, 0);
  }

  /** From the face's own frame (along, up, out) to the world, standing on the litter at the face's middle. */
  private place(geo: THREE.BufferGeometry, lift: number): THREE.BufferGeometry {
    const pos = geo.getAttribute('position');
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      p.copy(FACE_O).addScaledVector(FACE_U, x).addScaledVector(FACE_N, z);
      p.y = FACE_O.y + y + lift;
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    return geo;
  }
}

/**
 * Is a point of the shape's frame inside either held frame, nearer the camera than what it holds? A trunk there would
 * stand across her, the stump or the rock.
 */
function inFrame(lx: number, lz: number): boolean {
  const k = tuning.wood.shape;
  return inView(lx, lz, k.eye, k.look, k.hfov / 2 + 6, 11.5, 17.5) || inView(lx, lz, k.portraitEye, k.portraitLook, 34, 10.5, 22);
}

function inView(lx: number, lz: number, eye: readonly number[], look: readonly number[], halfDeg: number, nearDepth: number, farDepth: number): boolean {
  const fx = look[0] - eye[0], fz = look[2] - eye[2], len = Math.hypot(fx, fz);
  const ax = fx / len, az = fz / len;
  const px = lx - eye[0], pz = lz - eye[2];
  const depth = px * ax + pz * az, across = px * -az + pz * ax;
  const half = Math.tan(THREE.MathUtils.degToRad(halfDeg));
  if (depth < -2 || Math.abs(across) > Math.max(2.5, depth * half + 2)) return false;
  // As far as a line from just behind her to beyond the rock's far end: the subjects, and a little past them.
  const reach = (across / Math.max(1, depth * half) + 1) / 2;
  return depth < THREE.MathUtils.lerp(nearDepth, farDepth, THREE.MathUtils.clamp(reach, 0, 1));
}

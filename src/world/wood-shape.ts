import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { createNoise2D, mulberry32 } from './noise';
import { glsl, tuning } from '../tuning';

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

/**
 * The litter at the bend is bare of the wood's grass tufts, from behind her stop to the rock's foot: lit low from the
 * coals and seen from the held camera, every tuft stood up as a black spike against the warm ground.
 */
const BEND_CLEAR = (() => {
  const a = shapePoint(1.8, 0, 17), b = shapePoint(0.6, 0, -2.5);
  return { a: new THREE.Vector2(a.x, a.z), b: new THREE.Vector2(b.x, b.z), inner: 8.5, outer: 12 };
})();

/** How much of its height a grass blade keeps at the bend. Mirrors `woodBendCrop` in `BEND_GRASS_GLSL`. */
export function woodBendCrop(x: number, z: number): number {
  const { a, b, inner, outer } = BEND_CLEAR;
  const ex = b.x - a.x, ez = b.y - a.y;
  const t = THREE.MathUtils.clamp(((x - a.x) * ex + (z - a.y) * ez) / (ex * ex + ez * ez), 0, 1);
  return THREE.MathUtils.smoothstep(Math.hypot(x - a.x - ex * t, z - a.y - ez * t), inner, outer);
}

export const BEND_GRASS_GLSL = /* glsl */ `
float woodBendCrop(vec2 xz) {
  vec2 a = vec2(${glsl(BEND_CLEAR.a.x)}, ${glsl(BEND_CLEAR.a.y)}), e = vec2(${glsl(BEND_CLEAR.b.x - BEND_CLEAR.a.x)}, ${glsl(BEND_CLEAR.b.y - BEND_CLEAR.a.y)});
  float t = clamp(dot(xz - a, e) / dot(e, e), 0.0, 1.0);
  return smoothstep(${glsl(BEND_CLEAR.inner)}, ${glsl(BEND_CLEAR.outer)}, length(xz - a - e * t));
}`;

/** A point of the held frame, given in the shape's frame with its height from her feet. */
export function framePoint(p: readonly number[], out = new THREE.Vector3()): THREE.Vector3 {
  shapePoint(p[0], 0, p[2], out);
  out.y = SHAPE_WAIT.y + p[1];
  return out;
}

/**
 * The rock: one weathered outcrop beyond the stump, its broad face turned between her light and the camera so it
 * takes the light and is seen. Its face in the shape's frame: the middle of it on the ground and the way along it (to
 * the right in the frame).
 */
const ROCK_AT = new THREE.Vector2(0.3, -3.0);
const ROCK_ALONG = new THREE.Vector2(0.839, -0.545).normalize();
const ROCK_OUT = new THREE.Vector2(-ROCK_ALONG.y, ROCK_ALONG.x);
/**
 * The outcrop seen square-on, along the face and up it from its middle on the ground, clockwise from its buried left
 * foot: a broken shoulder low on the stump's side, a long slope up to an uneven top, and a rounded fall to the right.
 */
const ROCK_OUTLINE: [number, number][] = [
  [-1.5, -1.0], [-1.9, 0.8], [-1.75, 2.0], [-1.15, 2.75], [-0.75, 3.7], [-0.25, 4.9], [0.6, 5.9],
  [1.5, 6.55], [2.6, 7.0], [3.35, 7.15], [3.8, 6.85], [4.4, 7.25], [5.5, 7.5], [6.7, 7.2], [7.7, 6.3],
  [8.4, 4.9], [8.85, 2.9], [8.95, 0.8], [8.75, -1.0],
];
const ROCK_MIDDLE = new THREE.Vector2(3.2, 2.6);
const ROCK_FRONT = 0.75;
const ROCK_DEEP = 2.6;
/** The two shallow fissures down the face, along it and up it from its middle on the ground, clear of the shadow's eyes. */
const FISSURES: [number[], number[]][] = [[[0.4, 5.2], [0.9, 3.0]], [[5.6, 6.6], [6.4, 3.4]]];
/** Where along the face the painted shadows stand, pinned at their base. */
const SHADOW_U = 2.7;

/**
 * The painted shadows' scale, in pixels of their 1024 masks to the metre: the monster, and the plain stump across
 * and up, a little larger than life and drawn out as a low light draws a shadow out.
 */
const MONSTER_PX = 1 / 0.0066;
const PLAIN_PX = [1 / 0.0053, 1 / 0.0061];
/** In each mask: where its two forks are, the monster's eyes, the owl's feet in the plain one (pixels from top left). */
const MONSTER_FORK = [512, 568];
const PLAIN_FORK = [535, 721];
const MONSTER_EYES = [[486, 602], [538, 602]];
const OWL_FEET = [570, 694];
/** The perched owl's shadow is grown about its feet to the size of the owl in the fork. */
const OWL_GROW = 1.5;
/** The flying owl's shadow: its body in the flap frames, and the metres one of their pixels covers as it leaves. */
const FLAP_BODY = [132, 152];
const FLAP_M = 0.009;

/** Monster metres to plain metres at the fold's end: the forks meet, turned and shrunk about the pinned base. */
const FOLD_TO = (() => {
  const m = [(MONSTER_FORK[0] - 512) / MONSTER_PX, (1023 - MONSTER_FORK[1]) / MONSTER_PX];
  const p = [(PLAIN_FORK[0] - 512) / PLAIN_PX[0], (1023 - PLAIN_FORK[1]) / PLAIN_PX[1]];
  return { turn: Math.atan2(p[0], p[1]) - Math.atan2(m[0], m[1]), size: Math.hypot(p[0], p[1]) / Math.hypot(m[0], m[1]) };
})();

/** The stump is drawn life-size in its own frame: metres, `x` along the spread of its fork, `z` across it. */
const STUMP_SCALE = 1;
/** The top of the trunk, where it forked and broke, and the owl sits on what is left of it. */
const TRUNK_TOP = 1.52;
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

/** Where the owl sits: on the broken top of the trunk, in the crook against its taller limb, toward the camera. */
export const OWL_PERCH_LOCAL = new THREE.Vector3(...turned([0.22, TRUNK_TOP + 0.05, 0.16]));

/**
 * The owl's way out: off the fork toward her, over her head well clear of her hood, then banking up behind her on
 * the far side of the path and out above the crowns.
 */
export const OWL_FLIGHT_LOCAL = [
  new THREE.Vector3(0.5, 2.85, 1.75),
  new THREE.Vector3(1.7, 3.65, 4.65),
  new THREE.Vector3(2.6, 4.7, 8.0),
  new THREE.Vector3(0.7, 7.2, 11.5),
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
/** The shadows' pinned base, along the face and up it: sunk a little into the litter banked at the stone's foot. */
const SHADOW_BASE = (() => {
  const at = FACE_O.clone().addScaledVector(FACE_U, SHADOW_U);
  return new THREE.Vector2(SHADOW_U, heightAt(at.x, at.z) - FACE_O.y - 0.25);
})();

/** Where the eyes in the antlered outline shine on the rock, in the world. */
export function beastEyes(out = new THREE.Vector3()): THREE.Vector3 {
  const eyes = MONSTER_EYES[0].map((v, i) => (v + MONSTER_EYES[1][i]) / 2);
  out.copy(FACE_O).addScaledVector(FACE_U, SHADOW_BASE.x + (eyes[0] - 512) / MONSTER_PX);
  out.y = FACE_O.y + SHADOW_BASE.y + (1023 - eyes[1]) / MONSTER_PX;
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

/** How much cold moonlight finds her while she waits in the dark before the bend. */
export function moonOnHer(amount: number): void {
  atmo.uniforms.uChildMoon.value = amount;
}

/** How the stump and the owl are shown: 0 dark against the light behind her, 1 lit by the side coal. */
export function showShape(amount: number): void {
  shapeUniforms.uShapeShown.value = amount;
}

type CapSpec = [number[], number[], number, number];

/**
 * An old dead stump a little taller than her, the one whose shadow is painted in the plain mask: a thick trunk broken
 * off where it forked; the shorter limb leaning out to her side and snapped, a twig left on it; the taller limb up and
 * out the other way in a long curve, forked into twigs at its top; a branch broken off low down, and roots. Given in
 * its own frame; one list makes the mesh and the shadow her light throws.
 */
const LOCAL: CapSpec[] = [
  [[0, -0.4, 0], [0.02, 0.8, 0.02], 0.5, 0.42],
  [[0.02, 0.8, 0.02], [0.05, TRUNK_TOP, 0.0], 0.42, 0.36],
  [[-0.14, 1.35, 0.03], [-0.3, 2.25, 0.06], 0.21, 0.16],
  [[-0.3, 2.25, 0.06], [-0.46, 2.85, 0.04], 0.16, 0.11],
  [[-0.44, 2.66, 0.05], [-0.84, 3.06, 0.1], 0.06, 0.02],
  [[0.2, 1.35, -0.02], [0.62, 2.0, -0.04], 0.25, 0.2],
  [[0.62, 2.0, -0.04], [0.9, 2.75, -0.02], 0.2, 0.15],
  [[0.9, 2.75, -0.02], [1.02, 3.45, 0.0], 0.15, 0.11],
  [[1.02, 3.45, 0.0], [1.05, 3.95, 0.02], 0.11, 0.06],
  [[1.04, 3.82, 0.02], [1.4, 4.1, 0.06], 0.05, 0.018],
  [[0.97, 3.15, 0.0], [1.3, 3.33, 0.05], 0.05, 0.018],
  [[-0.38, 0.95, 0.06], [-0.72, 1.12, 0.14], 0.12, 0.06],
];
const STUMP_CAPS = LOCAL.length;
export const SHAPE_STUMP_CAPS = STUMP_CAPS;
/** Six more for the owl: body, head, its two ear tufts and its wings, moved every frame. */
const OWL_CAPS = 6;
const CAPS = STUMP_CAPS + OWL_CAPS;
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

/** What only the rock needs: where its face is, and the painted shadows laid on it. */
const faceUniforms = {
  uFaceO: { value: FACE_O },
  uFaceU: { value: FACE_U },
  uFaceN: { value: FACE_N },
  /** xy the shadows' pinned base along the face and up it, z how much of the owl is still on its perch in the plain one. */
  uFaceSet: { value: new THREE.Vector4(SHADOW_BASE.x, SHADOW_BASE.y, 1, 0) },
  /** xy the flying owl's shadow along the face and up it, z the metres one pixel of its flap frames covers, w the frame. */
  uOwlFlight: { value: new THREE.Vector4(0, 0, FLAP_M, 0) },
  uShadowMasks: { value: null as THREE.Texture | null },
  uFlaps: { value: null as THREE.Texture | null },
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
 * The owl in the plain shadow on the rock: `perched` how much of it is still sitting in the fork there; once it is
 * off, its little flapping shadow, `away` metres from the fork, on wing frame `frame` (0 up, 1 down-stroke, 2 down,
 * 3 up-stroke), `shown` how much of it is left on the stone. It slides off up the face away from the side coal,
 * growing and softening as the owl comes away from the stone toward the light.
 */
export function owlOnRock(perched: number, away: number, frame: number, shown: number): void {
  faceUniforms.uFaceSet.value.z = perched;
  const fork = [(OWL_FEET[0] - 512) / PLAIN_PX[0], (1023 - OWL_FEET[1] + 60 * OWL_GROW) / PLAIN_PX[1]];
  faceUniforms.uOwlFlight.value.set(SHADOW_BASE.x + fork[0] + away * 0.2, SHADOW_BASE.y + fork[1] + away * 0.3,
    FLAP_M * (1 + away * 0.05), frame);
  shapeUniforms.uShapeMask.value.w = shown;
}

const FACE_GLSL = /* glsl */ `
uniform vec3 uFaceO;
uniform vec3 uFaceU;
uniform vec3 uFaceN;
uniform vec4 uFaceSet;
uniform vec4 uOwlFlight;
uniform sampler2D uShadowMasks;
uniform sampler2D uFlaps;
/** Along the rock's face and up it, in metres from its middle on the ground. */
vec2 faceAt(vec3 p) {
  vec3 r = p - uFaceO;
  return vec2(dot(r, uFaceU), r.y);
}
vec2 turn2(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}
/** A mask's pixel, counted from its top left, to where it is in the texture. */
vec2 maskUv(vec2 px, float size) { return vec2(px.x, size - px.y) / size; }
/**
 * How dark the shadow on the rock is at q, and in y how bright the eyes in it are. As the side coal wakes the light
 * swings round: pinned at its base, the monster turns clockwise, its broad left antler folding in and its crown
 * coming down, and it shrinks into the plain stump's shadow; both masks are blurred while it moves, so one shape
 * flows into the other as a penumbra would, never two shapes crossfading.
 */
vec2 rockShadow(vec2 q) {
  float beast = uShapeMask.x, fold = uShapeMask.y;
  if (beast <= 0.0 && fold <= 0.0) return vec2(0.0);
  float k = smoothstep(0.0, 1.0, fold);
  float moving = sin(3.14159 * k);
  vec2 p = q - uFaceSet.xy;
  vec2 m = turn2(p, ${glsl(FOLD_TO.turn)} * k + ${glsl(tuning.wood.shape.foldSwing)} * moving) / pow(${glsl(FOLD_TO.size)}, k);
  vec2 plain = turn2(m, -${glsl(FOLD_TO.turn)}) * ${glsl(FOLD_TO.size)};
  if (m.x < 0.0) m.x /= 1.0 - ${glsl(tuning.wood.shape.foldIn)} * k;
  vec2 mpx = vec2(512.0 + m.x * ${glsl(MONSTER_PX)}, 1023.0 - m.y * ${glsl(MONSTER_PX)});
  vec2 ppx = vec2(512.0 + plain.x * ${glsl(PLAIN_PX[0])}, 1023.0 - plain.y * ${glsl(PLAIN_PX[1])});
  vec2 opx = vec2(${OWL_FEET[0]}.0, ${OWL_FEET[1]}.0) + (ppx - vec2(${OWL_FEET[0]}.0, ${OWL_FEET[1]}.0)) / ${glsl(OWL_GROW)};
  float blur = ${glsl(tuning.wood.shape.foldBlur)} * pow(moving, 0.7);
  float monster = texture(uShadowMasks, maskUv(mpx, 1024.0), blur).r;
  float stump = max(texture(uShadowMasks, maskUv(ppx, 1024.0), blur).g, texture(uShadowMasks, maskUv(opx, 1024.0), blur).b * uFaceSet.z);
  float a = mix(monster, stump, smoothstep(0.3, 0.7, k));
  float edge = mix(0.5, 0.14, moving);
  float dark = smoothstep(0.5 - edge, 0.5 + edge, a) * max(beast, fold);
  // The owl's own little shadow, flapping off the stone.
  vec2 fpx = vec2(${FLAP_BODY[0]}.0, ${FLAP_BODY[1]}.0) + vec2(1.0, -1.0) * (q - uOwlFlight.xy) / uOwlFlight.z;
  vec2 cell = vec2(mod(uOwlFlight.w, 2.0), floor(uOwlFlight.w / 2.0)) * 256.0;
  float inCell = step(2.0, min(fpx.x, fpx.y)) * step(max(fpx.x, fpx.y), 254.0);
  float flap = texture(uFlaps, maskUv(cell + clamp(fpx, 2.0, 254.0), 512.0), 0.5).r;
  dark = max(dark, flap * inCell * uShapeMask.w);
  float eyes = 0.0;
  if (uShapeMask.z > 0.0) {
    float d = min(distance(mpx, vec2(${MONSTER_EYES[0][0]}.0, ${MONSTER_EYES[0][1]}.0)), distance(mpx, vec2(${MONSTER_EYES[1][0]}.0, ${MONSTER_EYES[1][1]}.0)));
    eyes = (1.0 - smoothstep(6.5, 9.0, d) + 0.18 * exp(-d * d / 260.0)) * uShapeMask.z;
  }
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
/** How much of a pattern of freq cycles a metre is left where a pixel covers size metres: none near the pixel's own scale. */
float keep(float freq, float size) { return 1.0 - smoothstep(0.14, 0.32, freq * size); }
/** The stone's broad relief, metres up off its face: weathered swells a metre across and hollows a hand across. */
float relief(vec2 p) { return fbm(p * 0.42) * 0.5 + vnoise(p * 2.2 + 11.0) * 0.5; }
/**
 * Granite at a point of the stone, in metres, with a pixel covering size metres there: broad warm and cool mottling,
 * then the grain, pale feldspar and dark mica a few centimetres across, and hairline cracks wandering through it.
 * Whatever is finer than a few pixels fades out rather than shimmering.
 */
vec3 granite(vec2 p, float size) {
  float mottle = fbm(p * 0.42);
  float mid = vnoise(p * 2.2 + 11.0);
  vec2 g = mat2(0.8, -0.6, 0.6, 0.8) * p;
  float fine = (vnoise(g * 9.0 + 7.0) - 0.5) * keep(9.0, size) * 0.6 + (vnoise(mat2(0.28, 0.96, -0.96, 0.28) * p * 18.0 + 3.0) - 0.5) * keep(18.0, size) * 0.6;
  vec3 alb = mix(vec3(0.12, 0.108, 0.094), vec3(0.2, 0.172, 0.14), smoothstep(0.3, 0.72, mottle)) * (0.86 + 0.28 * mid);
  alb *= 1.0 + 0.45 * (vnoise(g * 4.0) - 0.5);
  alb = mix(alb, vec3(0.33, 0.29, 0.24), smoothstep(0.1, 0.28, fine) * 0.6);
  alb = mix(alb, vec3(0.04, 0.035, 0.03), smoothstep(-0.1, -0.28, fine) * 0.5);
  float vein = abs(vnoise(p * 0.7 + 5.0) * 2.0 - 1.0);
  float crack = (1.0 - smoothstep(0.0, 0.03 + size, vein)) * smoothstep(0.5, 0.65, vnoise(p * 0.3 + 9.0)) * keep(4.0, size);
  alb *= 1.0 - 0.55 * crack;
  float lichen = smoothstep(0.66, 0.74, fbm(p * 1.1 + 4.0) + 0.1 * fine);
  return mix(alb, vec3(0.3, 0.31, 0.25) * (0.85 + 0.6 * fine), lichen * 0.45);
}
/** Where the litter banks against the stone's foot, up from its middle on the ground, along the face. */
float footAt(float u) { return 0.35 * vnoise(vec2(u * 0.7, 2.0)); }
/** Scattered fallen leaves: one in some cells of a loose grid, each turned its own way. */
float leaves(vec2 p) {
  vec2 cell = floor(p * 3.0), f = fract(p * 3.0) - 0.5;
  float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5);
  float a = h * 6.283;
  vec2 l = mat2(cos(a), -sin(a), sin(a), cos(a)) * (f - (vec2(h, fract(h * 7.3)) - 0.5) * 0.4);
  float d = length(l / vec2(0.22, 0.11)) - 1.0;
  return (1.0 - smoothstep(-0.1, 0.1 + fwidth(d), d)) * step(0.45, h);
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
    // Weathered granite: a coarse grain of pale and dark crystals over broad mottling, a few hairline cracks, lichen
    // here and there, moss on what faces up and leaves banked at its foot. Laid on from three sides, so nothing
    // stretches where the stone turns away.
    vec3 r = vWorld - uFaceO;
    vec3 c = vec3(dot(r, uFaceU), r.y, dot(r, uFaceN));
    vec3 cn = vec3(dot(n, uFaceU), n.y, dot(n, uFaceN));
    vec3 w = pow(abs(cn), vec3(4.0));
    w /= w.x + w.y + w.z;
    float size = max(length(dFdx(vWorld)), length(dFdy(vWorld)));
    vec3 alb = granite(c.xy, size) * w.z + granite(c.zy + 17.0, size) * w.x + granite(c.xz + 41.0, size) * w.y;
    // The bump is worked out on the stone itself, across each projection, so it never shows the mesh's triangles.
    const float e = 0.04;
    float h0 = relief(c.xy);
    vec3 grad = (relief(c.xy + vec2(e, 0.0)) - h0) / e * w.z * uFaceU + (relief(c.xy + vec2(0.0, e)) - h0) / e * w.z * vec3(0.0, 1.0, 0.0);
    float hs = relief(c.zy + 17.0);
    grad += ((relief(c.zy + vec2(17.0 + e, 17.0)) - hs) / e * uFaceN + (relief(c.zy + vec2(17.0, 17.0 + e)) - hs) / e * vec3(0.0, 1.0, 0.0)) * w.x;
    float ht = relief(c.xz + 41.0);
    grad += ((relief(c.xz + vec2(41.0 + e, 41.0)) - ht) / e * uFaceU + (relief(c.xz + vec2(41.0, 41.0 + e)) - ht) / e * uFaceN) * w.y;
    float above = r.y;
    float moss = smoothstep(0.5, 0.8, cn.y) * smoothstep(0.45, 0.65, fbm(c.xz * 0.9 + 3.0) + 0.15 * h0);
    float foot = 1.0 - smoothstep(0.2, 1.0 + 0.5 * fbm(c.xz * 0.6), above - footAt(c.x));
    moss = max(moss, foot * smoothstep(0.35, 0.6, h0 + 0.3 * fbm(c.xy * 1.7)));
    alb = mix(alb, mix(vec3(0.045, 0.06, 0.025), vec3(0.08, 0.09, 0.03), vnoise(c.xy * 9.0)), moss * 0.85);
    // Fallen leaves caught at its foot and on its ledges.
    float leaf = leaves(c.xz + c.y * 0.3) * max(foot, smoothstep(0.6, 0.85, cn.y));
    alb = mix(alb, mix(vec3(0.24, 0.1, 0.035), vec3(0.32, 0.17, 0.06), vnoise(c.xz * 3.0)), leaf);
    n = normalize(n - 0.12 * (grad - dot(grad, n) * n));
    col = alb * hemiLight(n) * 0.12;
    // A breath of moon along the top edge, so it stands against the trees behind it.
    float rim = pow(1.0 - max(0.0, dot(n, V)), 3.0) * smoothstep(0.1, 0.6, n.y);
    col += alb * uSunColor * (max(0.0, dot(n, uSunDir)) * 0.03 + rim * 0.14) * uNight;
    vec2 shade = rockShadow(faceAt(vWorld));
    vec3 toCoal = uShapeThrow.xyz - vWorld;
    vec3 L = normalize(toCoal);
    // Brightest low down nearest her coal, falling away up the face and along it.
    float near = pow(dot(uShapePool.xz - uShapeThrow.xz, uShapePool.xz - uShapeThrow.xz) / max(dot(toCoal, toCoal), 1.0), 0.8);
    vec3 thrown = SHAPE_FIRE * uShapeThrow.w * shapePoolAt(vWorld) * near * clamp(dot(n, L) * 0.85 + 0.15, 0.0, 1.0)
      * mix(1.0, 0.6, smoothstep(1.5, 6.5, above));
    vec3 warm = thrown + shapeSideLight(vWorld, n) * 0.5;
    col += (alb + vec3(0.006, 0.004, 0.002)) * warm * (1.0 - 0.94 * shade.x);
    col += vec3(1.0, 0.68, 0.22) * shade.y * 2.6;
  }
  // The night's haze is kept thin on the stone, so its grain and the shadow on it stay crisp from either held frame.
  gl_FragColor = vec4(max(vKind < 0.5 ? applyFog(col, vWorld) : mix(col, applyFog(col, vWorld), 0.45), 0.0), 1.0);
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

/** How far from the outcrop's middle its outline lies, in the direction `angle` on its face. */
function outlineReach(angle: number): number {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = 0;
  for (let i = 0; i < ROCK_OUTLINE.length; i++) {
    const [ax, ay] = ROCK_OUTLINE[i], [bx, by] = ROCK_OUTLINE[(i + 1) % ROCK_OUTLINE.length];
    const ex = bx - ax, ey = by - ay, ox = ax - ROCK_MIDDLE.x, oy = ay - ROCK_MIDDLE.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (ox * ey - oy * ex) / den, k = (ox * dy - oy * dx) / den;
    if (t > 0 && k >= 0 && k <= 1) best = Math.max(best, t);
  }
  return best;
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
/**
 * One layer of fallen leaves, cells to the metre: a pointed leaf with its midrib in most cells, each turned and
 * coloured its own way. Its colour in rgb, how much of the pixel it covers in a.
 */
vec4 fallen(vec2 p, float cells, float seed) {
  vec2 q = p * cells;
  vec2 cell = floor(q), f = fract(q) - 0.5;
  vec3 h = fract(sin(vec3(dot(cell, vec2(127.1, 311.7)), dot(cell, vec2(269.5, 183.3)), dot(cell, vec2(419.2, 371.9))) + seed) * 43758.5);
  float a = h.x * 6.283;
  vec2 l = mat2(cos(a), -sin(a), sin(a), cos(a)) * (f - (h.yz - 0.5) * 0.35);
  float len = 0.3 + 0.12 * h.y, wide = 0.11 + 0.05 * h.z;
  float r = (len * len + wide * wide) / (2.0 * wide);
  float d = max(length(l - vec2(0.0, wide - r)), length(l + vec2(0.0, wide - r))) - r;
  float edge = fwidth(d) + 1e-4;
  float cover = (1.0 - smoothstep(-edge, edge, d)) * step(0.42, h.z);
  vec3 col = mix(mix(vec3(0.4, 0.15, 0.04), vec3(0.24, 0.09, 0.035), h.x), vec3(0.46, 0.28, 0.07), step(0.8, h.y));
  col *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.012 + edge, abs(l.y))) * step(abs(l.x), len * 0.85);
  // A leaf smaller than a pixel or two is only a warmth in the dirt.
  return vec4(col, cover * (1.0 - smoothstep(0.25, 0.6, edge * 3.0)));
}
void main() {
  // Dirt, and leaves fallen on it, the nearer ones each a leaf.
  float trodden = smoothstep(0.4, 0.8, vnoise(vWorld.xz * 2.3) * 0.6 + vnoise(vWorld.xz * 7.1) * 0.4);
  vec3 alb = mix(vec3(0.02, 0.014, 0.01), vec3(0.08, 0.045, 0.022), trodden);
  for (int i = 0; i < 3; i++) {
    vec4 leaf = fallen(vWorld.xz + float(i) * 3.7, 2.4 + float(i) * 1.1, float(i) * 1.3);
    alb = mix(alb, leaf.rgb, leaf.a);
  }
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

/**
 * The painted shadows, packed by `tools/pack-owl-shadows.py`: `shadows` the monster, the plain stump and its perched
 * owl, one to a channel; `flaps` the flying owl's four wing frames.
 */
export interface ShadowMasks {
  shadows: THREE.Texture;
  flaps: THREE.Texture;
}

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
    return u > ROCK_OUTLINE[1][0] - margin && u < ROCK_OUTLINE[17][0] + margin && n < 1.6 + margin && n > -ROCK_DEEP - margin;
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

  constructor(masks: ShadowMasks) {
    faceUniforms.uShadowMasks.value = masks.shadows;
    faceUniforms.uFlaps.value = masks.flaps;
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
    const pool = FACE_O.clone().addScaledVector(FACE_U, SHADOW_U + 0.4);
    shapeUniforms.uShapePool.value.set(pool.x, 0, pool.z, 7);
    owlOnRock(1, 0, 0, 0);

    const parts: THREE.BufferGeometry[] = [];
    const yaw = Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z) + STUMP_TURN;
    const stem = trunk(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, TRUNK_TOP * STUMP_SCALE, 0), 0.5 * STUMP_SCALE, 0.37 * STUMP_SCALE);
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
    parts.push(strip(this.stone([5.6, 0, 1.3], [1.3, 0.85, 0.9], 0.35, 13), 1, FACE_U));
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
   * One weathered outcrop: a rounded mass whose face, seen square-on, has `ROCK_OUTLINE` for its edge, bulging gently
   * and leaning back as it rises, cut by a few shallow planes into broad facets, with lumps a metre or two across.
   * Built along the face (x), up (y) and out of it (z), then set in the world with its foot down in the litter.
   */
  private outcrop(): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 48);
    const pos = geo.getAttribute('position');
    const lumpy = createNoise2D(71), finer = createNoise2D(72);
    const rand = mulberry32(83);
    const v = new THREE.Vector3();
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const angle = Math.atan2(v.y, v.x);
      const spread = Math.hypot(v.x, v.y) ** 0.7;
      const reach = outlineReach(angle);
      const p = new THREE.Vector3(ROCK_MIDDLE.x + Math.cos(angle) * reach * spread, ROCK_MIDDLE.y + Math.sin(angle) * reach * spread,
        v.z > 0 ? ROCK_FRONT * Math.sqrt(v.z) : -ROCK_DEEP * Math.sqrt(-v.z));
      p.z -= 0.09 * Math.max(0, p.y);
      const lump = 0.32 * lumpy(p.x * 0.32, p.y * 0.32) + 0.1 * finer(p.x * 0.9, p.y * 0.9);
      p.z += lump * (v.z > 0 ? 1 : 0.5);
      points.push(p);
    }
    // Shallow cuts across the face and the top, each taking a set depth off whatever it faces: broad flat planes.
    for (let i = 0; i < 18; i++) {
      const top = i % 3 === 0;
      const n = (top ? new THREE.Vector3((rand() - 0.5) * 0.8, 1, (rand() - 0.1) * 0.8) : new THREE.Vector3((rand() - 0.5) * 1.6, (rand() - 0.4) * 1.0, 1)).normalize();
      const depth = 0.1 + rand() * 0.25;
      let most = -Infinity;
      for (const p of points) most = Math.max(most, p.dot(n));
      for (const p of points) {
        const over = p.dot(n) - (most - depth);
        if (over > 0) p.addScaledVector(n, -over * 0.85);
      }
    }
    points.forEach((p, i) => {
      if (p.z > -0.6) {
        let groove = 0;
        for (const [a, c] of FISSURES) groove = Math.max(groove, Math.exp(-((segment(p.x, p.y, a, c) / 0.12) ** 2)));
        p.z -= 0.1 * groove;
      }
      pos.setXYZ(i, p.x, p.y, p.z);
    });
    return this.place(geo, 0);
  }

  /** A lower weathered stone at the rock's foot, flattened in front and on top, at `at` along, up and out of the face. */
  private stone(at: number[], size: number[], lean: number, seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 12);
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    const lumpy = createNoise2D(seed);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.z > 0.25) v.z = 0.25 + (v.z - 0.25) * 0.45;
      if (v.y > 0.45) v.y = 0.45 + (v.y - 0.45) * 0.5;
      if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
      v.multiplyScalar(1 + 0.12 * lumpy(v.x * 1.3 + v.z, v.y * 1.3));
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

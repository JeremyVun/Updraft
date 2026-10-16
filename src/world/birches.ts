import * as THREE from 'three';
import { fixInPlace } from '../gl/fixed';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BirchCanopyMotion } from '../fx/birch-canopy';
import { FallenLeaves, HEAP_GLSL, LEAF_SHAPE_GLSL, LEAF_SIDE, LEAF_TINT_GLSL, LITTER_BOX, LITTER_GLSL, LITTER_RES, LitterField, litterTop } from '../fx/leaves';
import { glsl, tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { ISLES, birchesFirstHeight } from './heightfield';
import { heightAt } from './island';
import { createNoise2D, mulberry32 } from './noise';
import { BirchScarf, FALLEN_LOG, FORK_BRANCH, SCARF_SNAGS, SCARF_PERCHES } from './birch-scarf';
import { BIRCHES_CUTS, BIRCHES_LOCAL, birchesAt, birchesGap, birchesLocal, birchesNoise, birchesOut } from './birches-layout';

const ISLE = ISLES.birches;
/** Below this the shore is bare sand, so both beaches read as beaches and the boat is never behind a tree. */
const TREE_LINE = 2.3;
/** No trunk stands this near the walk: the ride stays open all the way over the island. */
const RIDE = 8.5;
/** How much thinner the wood grows out toward the shore, where the low camera under the canopy never looks. */
const OUTER_THINNING = 0.7;
/** Leaves on one tree. They are hidden one by one as it is stripped, so this is how much gold a tree has to lose. */
const LEAVES_PER_TREE = 420;
/** The floor is scattered over a grid of cells that follows the camera and stands still in the world. */
const LITTER_CELL = 0.5;
const LITTER_GRID = 180;
const LITTER_REACH = 44;
/** How near the island the camera has to be before its floor and its loose leaves exist at all. */
const FLOOR_RANGE = ISLE.rz + 70;
/** Seconds a tuft the wind has just taken stays in the air on its way out of the crown. */
const SHED_FLIGHT = tuning.birches.shedFlight;

const flat = (x: number, z: number): THREE.Vector2 => {
  const p = birchesAt(x, z);
  return new THREE.Vector2(p.x, p.z);
};

/** The south beach, where the boat runs ashore, and the north beach, where it is drawn up before they get there. */
const LANDING_AT = [3, -1052] as const;
const BERTH_AT = [-4, -1197] as const;
/**
 * Up off the south beach, along an open ride between the trunks, over the rise through the clearing, down into the
 * hollow where the leaves are deepest, through the last thick stand and out onto the north beach with the boat on
 * it. Half again as far as it was: the room was over before the player had found out what the floor does.
 */
const WALK_AT = [
  [7, -1068],
  [5, -1092],
  /** The clearing on the rise, where the swing hangs. */
  [2.6, -1118],
  /** Down into the hollow, which is where the leaf play happens. */
  [-6, -1146],
  [-9, -1170],
  [-4, -1190],
] as const;

export const BIRCHES_LANDING = flat(...LANDING_AT);
/** Nobody put the boat there. */
export const BIRCHES_BERTH = new THREE.Vector3(flat(...BERTH_AT).x, 0, flat(...BERTH_AT).y);
export const BIRCHES_WALK = WALK_AT.map(([x, z]) => flat(x, z));
export const BIRCHES_CLEARING = BIRCHES_WALK[2];

/**
 * The heaps. Leaves do not pile themselves in the open: they pile where something stopped them, so every one of
 * these is against something — a birch that came down years ago, the foot of the tree the swing hangs from, the
 * bottom of the hollow, the lee of the last thick stand. They are what the room is for playing with.
 */
export const BIRCH_PILES = [
  /** The squirrel's first round. Its heaps were raked up: a mound with its foot on the bare ground it was gathered from. */
  { ...birchesAt(9.8, -1076), r: 3.6, deep: 4.6, raked: true },
  { ...birchesAt(-3.6, -1113), r: 3.2, deep: 4.2, raked: false },
  /** The deep one, at the bottom of the hollow: this is the one the cygnet goes into. */
  { ...birchesAt(-6, -1149), r: 4.6, deep: 5.4, raked: false },
  { ...birchesAt(-11.5, -1172), r: 3.2, deep: 4.4, raked: false },
  /** The squirrel's second round: one either side of the ride on the shelf below the rise, each at a trunk's foot. */
  { ...birchesGap(1, 11.1, 7.9), r: 2.7, deep: 4.8, raked: true },
  { ...birchesGap(1, 14.2, -1.8), r: 2.8, deep: 4.8, raked: true },
  /** Its third, up the hollow's west side beyond the deep one, in a line toward the low sun. */
  { ...birchesGap(2, 11, -14), r: 2.8, deep: 5, raked: true },
  { ...birchesGap(2, 19.8, -15), r: 3, deep: 5.4, raked: true },
  { ...birchesAt(-14.6, -1158.6), r: 2.8, deep: 5, raked: true },
];

/** The steepest a heap is laid, in depth a metre: a little under what the litter field lets stand (`litterRepose`). */
const STEEPEST = 0.9 * tuning.birches.litterRepose / Math.max(LITTER_BOX.sx / LITTER_RES.x, LITTER_BOX.sz / LITTER_RES.z);

/**
 * How deep a heap lies `from` its middle as it was left. A raked one is a mound as steep as leaves will stand,
 * rounded over the top, so it stands as it was laid, and no deeper than that slope allows within its foot; one the
 * wind left is a softer swell.
 */
function pileDepth(pile: (typeof BIRCH_PILES)[number], from: number): number {
  if (!pile.raked) return pile.deep * (1 - (from / pile.r) ** 2);
  const { heapCrown: crown, heapFoot, heapFrom } = tuning.birches;
  const fall = (to: number): number => STEEPEST * (Math.hypot(to, crown) - crown);
  return Math.min(pile.deep, heapFrom + fall(pile.r * heapFoot)) - fall(from);
}
/** How far out a heap's own leaves and the floor raked into it reach. */
const pileReach = (pile: (typeof BIRCH_PILES)[number]): number => pile.r + (pile.raked ? tuning.birches.heapRaked : 1.2);

/** The trunks the gaps' heaps are banked against (the far one in round 3 against the last perch's birch): placed rather than grown, so a heap never loses its tree. */
const BANKS = [
  { ...birchesGap(1, 13.8, 10.1), scale: 15, variant: 2 },
  { ...birchesGap(1, 15.5, -4.1), scale: 16, variant: 0 },
  { ...birchesGap(2, 11.6, -16.6), scale: 14.5, variant: 1 },
  { ...birchesGap(2, 20.2, -17.8), scale: 13.3, variant: 0 },
  /** Between the third round's middle heap and its far one, behind them from the lens: the squirrel watches the leap from it. */
  { ...birchesAt(-17.4, -1154.4), scale: 16.4, variant: 2 },
];
const nearBank = (x: number, z: number): boolean => BANKS.some(b => Math.hypot(b.x - x, b.z - z) < 1.6);
const inHeap = (x: number, z: number): boolean => BIRCH_PILES.some(p => p.raked && Math.hypot(p.x - x, p.z - z) < p.r + 1);

/** A way back from what a lens looks at, `degrees` round from looking north (90 looks west from the east). */
const bearing = (degrees: number): { x: number; z: number } =>
  ({ x: Math.sin(THREE.MathUtils.degToRad(degrees)), z: Math.cos(THREE.MathUtils.degToRad(degrees)) });

/**
 * Where each of the squirrel's rounds is watched from (`story/birches-rounds.ts`): the point its lens looks at and
 * the way back to the lens, in landscape and in portrait. Nothing grown in a gap stands in either view.
 */
export const ROUND_VIEWS_TALL = [
  { at: birchesAt(11.5, -1075), from: bearing(75) },
  { at: birchesGap(1, 13, 3), from: bearing(65) },
  { at: birchesGap(2, 18, -14), from: bearing(8) },
] as const;
export const ROUND_VIEWS = [
  { at: birchesAt(11.8, -1074.1), from: { x: 0.643, z: 0.766 } },
  { at: birchesGap(1, 13, 4.5), from: { x: 0.259, z: 0.966 } },
  { at: birchesGap(2, 13.8, -11.8), from: { x: 0.819, z: 0.574 } },
] as const;
const inRoundView = (x: number, z: number): boolean => [...ROUND_VIEWS, ...ROUND_VIEWS_TALL].some(v => {
  const ax = x - v.at.x, az = z - v.at.z, along = Math.max(0, Math.min(24, ax * v.from.x + az * v.from.z));
  return Math.hypot(ax - v.from.x * along, az - v.from.z * along) < 3.5;
});

/** The big birch the swing hangs from: it stands west of the clearing and reaches a limb out over it. */
const SWING_TREE = flat(-2.4, -1116.6);
/** A small glade opens toward the wound trunk, keeping its cloth readable below the canopy. */
const GLADE = { ...birchesAt(-5, -1121), rx: 10, rz: 18 };
const SWING_SCALE = 16.5;
/** Where the rope is over the limb, in the unit tree the swing variant is grown as. */
const SWING_LIMB = new THREE.Vector3(0.26, 0.25, 0.04);

interface Seg {
  a: THREE.Vector3;
  b: THREE.Vector3;
  ra: number;
  rb: number;
}

interface Birch {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  variant: number;
  /** How much of its gold is gone, 0 to 1. It only ever rises. */
  strip: number;
  /** How much of it is in the air right now: what the last few seconds took off, decaying as that lands. */
  shed: number;
}

/** The tree's own frame, read once from the tree table and used by everything drawn on it. */
const BIRCH_TREE_GLSL = /* glsl */ `
uniform sampler2D uTrees;
vec4 birchT;
vec4 birchS;
vec4 birchF;
void rootBirch(int i) {
  birchT = texelFetch(uTrees, ivec2(i, 0), 0);
  birchS = texelFetch(uTrees, ivec2(i, 1), 0);
  birchF = texelFetch(uTrees, ivec2(i, 2), 0);
}
/**
 * A point on the unit tree put where the tree stands, and bent by the air at its foot. A birch is a whip: it
 * leans a long way in a gust and keeps almost nothing of it near the ground.
 */
vec3 birchPlace(vec3 local) {
  vec3 p = local * birchT.w;
  p = vec3(birchS.x * p.x + birchS.y * p.z, p.y, -birchS.y * p.x + birchS.x * p.z);
  vec3 world = birchT.xyz + p;
  /** It leans on the wind it feels, on the hanging things' spring: a gust reaches it late and it swings back. */
  vec2 w = swayAt(birchT.xz).xy;
  float k = pow(clamp(local.y, 0.0, 1.4), 1.6);
  vec2 idle = vec2(sin(uTime * 0.85 + birchS.w * 31.0), cos(uTime * 0.71 + birchS.w * 17.0)) * (0.05 + length(w) * 0.01);
  vec2 lean = (w * 0.006 + idle * 0.02) * birchT.w;
  world.xz += lean * k;
  world.y -= dot(lean, lean) * k * 0.09;
  return world;
}`;

/**
 * Nothing on this island is allowed to stand between the camera and the child, so whatever does gives way, the
 * same as the washing on the island of lines. A wood the player loses the child in is a wood they stop playing.
 */
const DISSOLVE_GLSL = /* glsl */ `
uniform vec4 uSubject;
float birchDither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
bool inTheWay(vec3 world, float width) {
  // Branches right at the lens thin away too: a camera standing in a crown should not look through a thicket.
  float hide = 1.0 - nearFade(world, 0.8, 2.6);
  if (uSubject.w > 0.5) {
    vec3 toSubject = uSubject.xyz - cameraPosition;
    float reach = length(toSubject);
    vec3 dir = toSubject / max(reach, 0.001);
    vec3 toHere = world - cameraPosition;
    float along = dot(toHere, dir);
    if (along > 0.4 && along < reach - 1.2) hide = max(hide, 1.0 - smoothstep(width, width * 2.6, length(toHere - dir * along)));
  }
  return hide > 0.02 && birchDither(gl_FragCoord.xy) < hide;
}`;

const TRUNK_VERT = /* glsl */ `
${ATMO_GLSL}
${BIRCH_TREE_GLSL}
in float aIndex;
out vec3 vWorld;
out vec3 vNormal;
out float vUp;
void main() {
  rootBirch(int(aIndex));
  vec3 world = birchPlace(position);
  vec3 n = normalize(normal);
  vNormal = vec3(birchS.x * n.x + birchS.y * n.z, n.y, -birchS.y * n.x + birchS.x * n.z);
  vUp = position.y;
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

/** White bark in torn papery bands, with the short dark dashes across it that say birch and nothing else. */
const BARK_GLSL = /* glsl */ `
vec3 birchBark(vec3 N, float along) {
  float around = atan(N.z, N.x);
  float band = vnoise(vec2(around * 1.4, along * 1.6));
  float dash = smoothstep(0.66, 0.86, vnoise(vec2(around * 3.2, along * 9.0)));
  float scar = smoothstep(0.76, 0.94, vnoise(vec2(around * 0.8 + 11.0, along * 0.35)));
  vec3 white = mix(vec3(0.78, 0.75, 0.70), vec3(1.0, 0.97, 0.92), band);
  return mix(white, vec3(0.30, 0.26, 0.23), max(dash * 0.7, scar * 0.5));
}`;

const TRUNK_FRAG = /* glsl */ `
${ATMO_GLSL}
${DISSOLVE_GLSL}
${BARK_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in float vUp;
void main() {
  if (inTheWay(vWorld, 1.1)) discard;
  vec3 N = normalize(vNormal);
  vec3 alb = birchBark(N, vWorld.y);
  /** Old bark at the foot of it, rough and dark, going up further on the big ones. */
  alb = mix(vec3(0.20, 0.17, 0.15), alb, smoothstep(0.0, 0.14, vUp));
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0) * max(dot(-V, uSunDir), 0.0);
  /** White bark under a gold canopy is never cold: it takes the light back off the leaves and off the floor. */
  vec3 ambient = hemiLight(N) * vec3(1.15, 1.02, 0.82) + uGroundBounce * 0.6;
  vec3 col = alb * (ambient + uSunColor * max(dot(N, uSunDir), 0.0) * 0.8 * sun) + uSunColor * rim * 0.3 * sun;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const CANOPY_VERT = /* glsl */ `
${ATMO_GLSL}
${BIRCH_TREE_GLSL}
uniform vec2 uDetail;
uniform sampler2D uCanopyMotion;
in vec2 aMotion;
in vec4 aLeaf;
in vec4 aTuft;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vCard;
out float vSeed;
out float vDepth;
void main() {
  rootBirch(int(aTuft.x));
  // Once detached, a card belongs to its flight simulation, not to the tree or cursor.
  vec4 motion = texture(uCanopyMotion, aMotion);
  float flight = motion.w / ${glsl(SHED_FLIGHT)};
  if (flight >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 centre = flight > 0.0 ? motion.xyz : birchPlace(aLeaf.xyz);
  float away = distance(centre, cameraPosition);
  /** Far trees keep their gold: the tufts thin out, and the ones left grow to cover for them. */
  float keep = 1.0 - 0.4 * smoothstep(uDetail.x, uDetail.y, away);
  float fade = clamp((keep - aTuft.w) * 6.0, 0.0, 1.0);
  /** And a crown the camera has walked into is a gold wall across the whole view, so it thins out of the way. */
  fade *= smoothstep(7.0, 19.0, away);
  // Detached canopy cards used to produce another dense curtain on top of the individual leaves.
  float shedKeep = 1.0 - smoothstep(${glsl(tuning.birches.shedClusterKeep - .08)}, ${glsl(tuning.birches.shedClusterKeep + .08)}, aTuft.w);
  fade *= mix(1.0, shedKeep, smoothstep(0.0, .08, flight));
  if (fade <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float size = aTuft.y * fade * (1.0 + 0.45 * smoothstep(uDetail.x, uDetail.y, away));
  /** What is in the air thins away as it goes, so the cloud has no edge and nothing ever pops out of the frame. */
  size *= 1.0 - smoothstep(0.55, 1.0, flight);
  float spin = aTuft.z * 40.0 + sin(uTime * (1.1 + fract(aTuft.z * 7.0)) + aTuft.z * 20.0) * 0.25 + flight * (4.0 + 6.0 * fract(aTuft.z * 3.3));
  vec2 c = vec2(cos(spin), sin(spin));
  vec2 corner = vec2(position.x * c.x - position.y * c.y, position.x * c.y + position.y * c.x);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vWorld = centre + (right * corner.x + up * corner.y) * size;
  vec3 outward = aLeaf.xyz - vec3(0.0, 0.7, 0.0);
  vec3 n = normalize(vec3(birchS.x * outward.x + birchS.y * outward.z, outward.y + 0.35, -birchS.y * outward.x + birchS.x * outward.z));
  vNormal = n;
  vCard = position.xy;
  vSeed = aTuft.z;
  vDepth = clamp(length(outward) / 0.3, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const CANOPY_FRAG = /* glsl */ `
${ATMO_GLSL}
${DISSOLVE_GLSL}
${LEAF_TINT_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vCard;
in float vSeed;
in float vDepth;
void main() {
  float r = length(vCard * vec2(0.86, 1.3));
  if (r > 1.0 - 0.13 * sin(atan(vCard.y, vCard.x) * 9.0 + vSeed * 27.0)) discard;
  if (inTheWay(vWorld, 1.5)) discard;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  vec3 alb = birchLeaf(fract(vSeed * 7.13), 0.35 + 0.65 * vDepth);
  float sun = cloudShadow(vWorld.xz) * mix(0.55, 1.0, groundAt(vWorld.xz).w);
  float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  /** A birch in October is mostly lit from behind: the gold is the sun coming through the leaf, not off it. */
  float through = pow(max(dot(-V, uSunDir), 0.0), 2.2) * (0.35 + 0.65 * max(-ndl, 0.0)) * vDepth;
  vec3 col = alb * (hemiLight(N) * mix(0.5, 0.95, vDepth) + uSunColor * pow(wrap, 2.0) * sun * 0.75);
  col += alb * alb * uSunColor * through * sun * 2.2;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * The floor: the leaves that are lying still. How many there are anywhere, and how deep they are heaped, is the
 * litter field and nothing else, so the floor is swept bare where the player has been blowing and stands in
 * heaps where the air ran out. These resting cards stay on the ground and thin as that field empties;
 * airborne movement belongs to the simulated leaves in `fx/leaves.ts`.
 */
const LITTER_OUT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSide;
out vec2 vCard;
out float vSeed;
out vec3 vSlope;
/** How much of the sun reaches it past a heap, how much of the sky it sees, and how far it lies on a heap's surface. */
out vec3 vLight;`;

/** Something burrowing along under the leaves: a hump `uBurrow.w` high and `uBurrow.z` across, moving with it. */
const BURROW_GLSL = /* glsl */ `
uniform vec4 uBurrow;
float burrow(vec2 p) {
  vec2 d = p - uBurrow.xy;
  float k = max(0.0, 1.0 - dot(d, d) / (uBurrow.z * uBurrow.z));
  return uBurrow.w * k * k;
}`;

const LITTER_VERT = /* glsl */ `
${ATMO_GLSL}
${LITTER_GLSL}
${HEAP_GLSL}
${BURROW_GLSL}
uniform vec2 uLitterCell;
in vec2 aCell;
${LITTER_OUT}
void main() {
  vec2 cell = uLitterCell + aCell;
  float r1 = hash12(cell);
  float r2 = hash12(cell + 19.7);
  float r3 = hash12(cell + 71.3);
  vec2 p = (cell + vec2(r1, r2)) * ${glsl(LITTER_CELL)};
  vec2 uv = domainUv(p);
  float away = distance(p, cameraPosition.xz);
  float deep = litterDepth(p);
  /** How much of the floor the leaves cover, and how much of them is heaped on top of that: two different things. */
  float cover = 1.0 - exp(-deep * 1.35);
  float top = litterTop(deep) + burrow(p);
  float heap = top / ${glsl(tuning.birches.pileHeight)};
  /** Far off, fewer and larger: the carpet has to reach the trees at the edge of the frame without the count. */
  float far = smoothstep(12.0, ${glsl(LITTER_REACH)}, away);
  float reach = 1.0 - smoothstep(${glsl(LITTER_REACH - 14)}, ${glsl(LITTER_REACH)}, away);
  float drift = cover * (1.0 - 0.55 * far) * reach;
  /** It thins away rather than winking out, so the floor being stripped is a fade and never a row of holes. */
  float fade = smoothstep(r3, r3 + 0.08, drift);
  if (fade <= 0.002 || away > ${glsl(LITTER_REACH)} || !insideUv(uv)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 hn = texture(uHeightTex, uv);
  /** Leaves carried out of the wood thin over the wet sand rather than ending at a height contour. */
  fade *= smoothstep(0.02, 0.3, hn.r);
  vec3 n = normalize(hn.gba);
  vec3 base = vec3(p.x, hn.r + 0.02 + r3 * 0.05, p.y);
  /**
   * Heaped, they are not a carpet at all: they stand off the ground through the whole depth of the heap, they lie
   * every way but flat, and they are drawn broader so that a heap reads as one solid mass and not as a thin skin
   * of leaves lifted off the floor.
   */
  float within = 0.12 + 0.88 * hash12(cell + 41.1);
  base.y += top * within;
  /** Down inside a heap a leaf sees little of the sky and none of the sun. */
  float inside = smoothstep(0.05, 0.4, top) * (1.0 - within);
  vec4 shape = heapShape(p, top * within);
  vSlope = normalize(n / max(n.y, 0.3) + vec3(-shape.x, 0.0, -shape.y));
  vLight = vec3(shape.z * (1.0 - inside), shape.w * (1.0 - 0.5 * inside), smoothstep(0.0, 0.25, top) * within);
  // Ground cover is resting litter, not a sheet displaced by the instantaneous wind.
  float a = r1 * 6.2831;
  vec3 t1 = normalize(cross(n, vec3(cos(a), 0.0, sin(a))));
  vec3 loose = normalize(vec3(cos(a) * 0.9, 0.35 + r1 * 0.9, sin(a) * 0.9));
  vec3 t2 = normalize(mix(cross(n, t1), loose, clamp(heap * 0.5, 0.0, 0.85)));
  float size = ${glsl(tuning.birches.leafSize)} * (1.25 + 0.9 * r2) * (1.0 + 0.9 * far) * (1.0 + 0.4 * heap) * fade;
  vWorld = base + (t1 * position.x * 1.45 + t2 * position.y) * size;
  vNormal = normalize(n + t1 * 0.25);
  vSide = t1;
  vCard = position.xy * 2.0;
  vSeed = r2;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const LITTER_FRAG = /* glsl */ `
${ATMO_GLSL}
${LEAF_TINT_GLSL}
${LEAF_SHAPE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vSide;
in vec2 vCard;
in float vSeed;
in vec3 vSlope;
in vec3 vLight;
void main() {
  if (birchLeafEdge(vCard, vSeed) < 0.0) discard;
  vec3 N = leafCurl(normalize(vNormal), normalize(vSide), vCard, 0.7);
  /** On a heap, the heap's own surface takes the light, so that one side of it is lit and the other is not. */
  vec3 L = normalize(mix(N, normalize(vSlope), vLight.z * 0.75));
  vec3 V = normalize(cameraPosition - vWorld);
  /** Leaves that have been down a while: drier and browner than the crowns, but the same gold underneath. */
  vec3 alb = leafVeins(birchLeaf(mix(0.22, 1.0, fract(vSeed * 7.13 + 0.25)), 0.95) * (0.86 + 0.26 * vSeed), vCard);
  /** Never fully in shadow: a floor of gold gives its own light back, which is most of what this room is lit by. */
  float sun = max(groundAt(vWorld.xz).w * cloudShadow(vWorld.xz), 0.35) * vLight.x;
  /** And the ones tipped up on their edges take the low sun through them, the same as the ones still up there. */
  float through = pow(max(dot(-V, uSunDir), 0.0), 2.0) * (0.35 + 0.65 * (1.0 - abs(dot(N, uSunDir))));
  /**
   * A heap's side away from the sun is in its own shade, and what light it has is mostly what the gold round it
   * gives back, so it goes amber rather than grey.
   */
  float shaded = vLight.z * (1.0 - vLight.x);
  vec3 sky = vLight.y * mix(vec3(1.0), vec3(0.5, 0.36, 0.22), shaded);
  vec3 col = alb * ((hemiLight(L) * vec3(1.2, 1.08, 0.86) + uGroundBounce * 0.9) * sky + uSunColor * max(dot(L, uSunDir), 0.0) * sun * 0.9);
  col += alb * alb * uSunColor * through * sun * 0.9;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * The skin of a heap: leaves laid every which way over its surface, smaller and far closer together than the floor's,
 * so a heap reads as one mound of leaves with a lit side and a shadowed one rather than a few big leaves standing up.
 * Each lies at a fixed place round a heap and shows only while the leaves there stand heaped.
 */
const HEAP_SKIN_VERT = /* glsl */ `
${ATMO_GLSL}
${LITTER_GLSL}
${HEAP_GLSL}
${BURROW_GLSL}
in vec4 aSpot;
${LITTER_OUT}
void main() {
  vec2 p = aSpot.xy;
  vec2 uv = domainUv(p);
  float top = litterTopAt(p) + burrow(p);
  float away = distance(p, cameraPosition.xz);
  /** Fewer of them toward the foot, thinning into the floor's own scatter rather than ending in a rim. */
  float from = 0.05 + 0.4 * fract(aSpot.z * 13.7);
  float grow = smoothstep(from, from + 0.1, top) * (1.0 - smoothstep(${glsl(LITTER_REACH - 14)}, ${glsl(LITTER_REACH)}, away));
  if (grow <= 0.002 || !insideUv(uv)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 hn = texture(uHeightTex, uv);
  vec3 n = normalize(hn.gba);
  vec4 shape = heapShape(p, top);
  vec3 surface = normalize(n / max(n.y, 0.3) + vec3(-shape.x, 0.0, -shape.y));
  vec3 jumble = vec3(hash12(aSpot.zw * 91.0), hash12(aSpot.wz * 57.0 + 3.1), hash12(aSpot.zw * 33.0 + 7.7)) - 0.5;
  vec3 m = normalize(surface + jumble * 1.1);
  float a = aSpot.z * 6.2831;
  vec3 t1 = normalize(cross(m, vec3(cos(a), 0.0, sin(a))));
  vec3 t2 = cross(m, t1);
  /** A layer of them, not one: wherever the top ones part there are more leaves under them, never what is buried. */
  float under = min(${glsl(tuning.birches.heapSkin)}, top * 0.6) * fract(aSpot.w * 7.31);
  vec3 base = vec3(p.x, hn.r + 0.02 + top - under, p.y);
  float far = smoothstep(12.0, ${glsl(LITTER_REACH)}, away);
  float size = ${glsl(tuning.birches.leafSize)} * (1.15 + 0.8 * aSpot.w) * (1.0 + 0.6 * far) * grow;
  vWorld = base + (t1 * position.x * 1.45 + t2 * position.y) * size;
  vNormal = m;
  vSide = t1;
  vCard = position.xy * 2.0;
  vSeed = aSpot.w;
  vSlope = surface;
  vLight = vec3(shape.zw, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * The body of a heap under its skin of leaves: a solid surface a little below the top, the deeper leaves seen
 * wherever the top ones part, so a heap is never see-through and what is buried in it stays hidden. It sinks
 * into the ground wherever the leaves are no deeper than a floor.
 */
const HEAP_CORE_VERT = /* glsl */ `
${ATMO_GLSL}
${LITTER_GLSL}
${HEAP_GLSL}
${BURROW_GLSL}
out vec3 vWorld;
out vec3 vSlope;
out vec3 vLight;
void main() {
  vec2 p = position.xz;
  vec2 uv = domainUv(p);
  float top = litterTopAt(p) + burrow(p);
  vec4 hn = insideUv(uv) ? texture(uHeightTex, uv) : vec4(-5.0, 0.0, 1.0, 0.0);
  vec3 n = normalize(hn.gba);
  vec4 shape = heapShape(p, top);
  float below = ${glsl(tuning.birches.heapCore)} + 0.4 * (1.0 - smoothstep(0.1, 0.35, top));
  vWorld = vec3(p.x, hn.r + top - below, p.y);
  vSlope = normalize(n / max(n.y, 0.3) + vec3(-shape.x, 0.0, -shape.y));
  vLight = vec3(shape.zw, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const HEAP_CORE_FRAG = /* glsl */ `
${ATMO_GLSL}
${LEAF_TINT_GLSL}
in vec3 vWorld;
in vec3 vSlope;
in vec3 vLight;
void main() {
  vec3 L = normalize(vSlope);
  float mottle = vnoise(vWorld.xz * 6.0 + vWorld.y * 3.0);
  vec3 alb = birchLeaf(mix(0.78, 0.93, mottle), 0.95) * 0.85;
  float sun = max(groundAt(vWorld.xz).w * cloudShadow(vWorld.xz), 0.35) * vLight.x;
  vec3 sky = vLight.y * mix(vec3(0.95), vec3(0.6, 0.44, 0.29), 1.0 - vLight.x);
  vec3 col = alb * ((hemiLight(L) * vec3(1.2, 1.08, 0.86) + uGroundBounce * 0.9) * sky + uSunColor * max(dot(L, uSunDir), 0.0) * sun * 0.6);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const ROPE_FRAG = /* glsl */ `
${ATMO_GLSL}
${DISSOLVE_GLSL}
uniform vec3 uPaint;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  if (inTheWay(vWorld, 0.7)) discard;
  vec3 N = normalize(vNormal);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 alb = uPaint * (0.88 + 0.24 * vnoise(vWorld.xz * 9.0 + vWorld.y * 14.0));
  vec3 col = alb * (hemiLight(N) + uSunColor * max(dot(N, uSunDir), 0.0) * 0.8 * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * The birch that came down. Same bark as the standing ones, greyer and greener for the years it has lain there,
 * and dark underneath where it meets the ground and the leaves have been banked against it.
 */
const FALLEN_FRAG = /* glsl */ `
${ATMO_GLSL}
${DISSOLVE_GLSL}
${BARK_GLSL}
in vec3 vWorld;
in vec3 vNormal;
void main() {
  if (inTheWay(vWorld, 0.9)) discard;
  vec3 N = normalize(vNormal);
  vec3 alb = birchBark(N, vWorld.x * 0.7 + vWorld.z * 0.7);
  float moss = smoothstep(0.35, 0.8, vnoise(vWorld.xz * 1.7 + 4.0)) * (1.0 - max(N.y, 0.0) * 0.4);
  alb = mix(alb * vec3(0.78, 0.76, 0.70), vec3(0.32, 0.34, 0.20), moss * 0.55);
  alb *= 0.45 + 0.55 * smoothstep(-0.7, 0.2, N.y);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(N) * vec3(1.1, 1.02, 0.86) + uGroundBounce * 0.7 + uSunColor * max(dot(N, uSunDir), 0.0) * 0.8 * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const PLAIN_VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

function log(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, radial = 5): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  const dir = b.clone().sub(a).divideScalar(len || 1);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  geo.deleteAttribute('uv');
  return geo;
}

const TRUNK_PARTS = 7;

/**
 * One birch, grown at unit height so every tree on the island is the same geometry at a different size: a trunk
 * with a lean in it, limbs that go up steeply and then droop at the ends, and the twig tips the gold hangs on.
 */
export function growBirch(rand: () => number, swingLimb: boolean): { segs: Seg[]; tips: THREE.Vector3[] } {
  const segs: Seg[] = [];
  const tips: THREE.Vector3[] = [];
  const link = (a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number): void => {
    segs.push({ a: a.clone(), b: b.clone(), ra, rb });
  };
  const trunkR = 0.021 + rand() * 0.008;
  const sway = (rand() - 0.5) * 0.06;
  const bearing = rand() * Math.PI * 2;
  const spine: THREE.Vector3[] = [];
  const parts = TRUNK_PARTS;
  for (let i = 0; i <= parts; i++) {
    const t = i / parts;
    const bend = Math.sin(t * 2.1) * sway;
    spine.push(new THREE.Vector3(Math.cos(bearing) * bend, t, Math.sin(bearing) * bend));
  }
  for (let i = 1; i < spine.length; i++) {
    const t0 = (i - 1) / parts;
    const t1 = i / parts;
    link(spine[i - 1], spine[i], trunkR * (1 - t0 * 0.82), trunkR * (1 - t1 * 0.82));
  }

  const limbs = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < limbs; i++) {
    /** Bare-legged: a birch carries its crown high, which is what lets the camera see along under a wood of them. */
    const t = 0.48 + (i / limbs) * 0.46 + rand() * 0.06;
    const from = spine[Math.min(parts, Math.round(t * parts))].clone();
    const a = bearing + i * 2.4 + rand() * 0.8;
    const reach = (0.13 + rand() * 0.14) * (1.15 - t * 0.5);
    const rise = 0.9 + rand() * 0.8;
    const dir = new THREE.Vector3(Math.cos(a), rise, Math.sin(a)).normalize();
    let p = from.clone();
    let r = trunkR * (1 - t * 0.82) * 0.66;
    /** Up hard, then over, then down: the droop at the end of a birch limb is most of its silhouette. */
    for (let k = 0; k < 3; k++) {
      const next = p.clone().addScaledVector(dir, reach);
      dir.y -= 0.45 + rand() * 0.35;
      dir.x += (rand() - 0.5) * 0.3;
      dir.z += (rand() - 0.5) * 0.3;
      dir.normalize();
      link(p, next, r, r * 0.6);
      r *= 0.6;
      p = next;
      if (k > 0) tips.push(p.clone());
      for (let j = 0; j < 2; j++) {
        const side = new THREE.Vector3(-dir.z, 0.25 + rand() * 0.5, dir.x).multiplyScalar(j === 0 ? 1 : -1).normalize();
        const twig = p.clone().addScaledVector(side, reach * (0.4 + rand() * 0.4)).addScaledVector(dir, reach * 0.2);
        twig.y -= reach * (0.1 + rand() * 0.3);
        link(p, twig, r * 0.8, r * 0.3);
        tips.push(twig);
      }
    }
  }

  if (swingLimb) {
    /**
     * The one limb in this wood that goes out instead of up: it leaves the trunk climbing, levels off over the
     * clearing where a rope has been thrown over it, and carries on past it thinning into an ordinary branch.
     */
    const along = [0, 0.3, 0.62, 1, 1.42];
    const rise = [-0.075, -0.026, 0.0, 0.012, 0.055];
    const width = [0.5, 0.42, 0.33, 0.23, 0.1];
    for (let i = 1; i < along.length; i++) {
      const a = new THREE.Vector3(SWING_LIMB.x * along[i - 1], SWING_LIMB.y + rise[i - 1], SWING_LIMB.z * along[i - 1]);
      const b = new THREE.Vector3(SWING_LIMB.x * along[i], SWING_LIMB.y + rise[i], SWING_LIMB.z * along[i]);
      segs.push({ a, b, ra: trunkR * width[i - 1], rb: trunkR * width[i] });
      if (i > 2) tips.push(b.clone());
    }
    for (let i = 0; i < 5; i++) {
      const at = 0.75 + i * 0.16;
      const from = new THREE.Vector3(SWING_LIMB.x * at, SWING_LIMB.y + 0.012 * at, SWING_LIMB.z * at);
      const twig = from.clone().add(new THREE.Vector3((rand() - 0.5) * 0.12, 0.06 + rand() * 0.1, (rand() - 0.4) * 0.14));
      link(from, twig, trunkR * 0.16, trunkR * 0.06);
      tips.push(twig);
    }
  }
  return { segs, tips };
}

/**
 * The whole walk, boat to boat: the ride has to start where the child steps off, not where the waypoints do. It
 * crosses each gap square to the cuts, so the ride through every band is exactly where it always was.
 */
const WAY = ((): THREE.Vector2[] => {
  const local = [LANDING_AT, ...WALK_AT, BERTH_AT];
  const way = [flat(...LANDING_AT)];
  for (let i = 1; i < local.length; i++) {
    const [ax, az] = local[i - 1], [bx, bz] = local[i];
    BIRCHES_CUTS.forEach((cut, gap) => {
      if (cut.open <= 0 || az < cut.z || bz >= cut.z) return;
      const x = ax + (bx - ax) * (cut.z - az) / (bz - az), from = birchesAt(x, cut.z), to = birchesGap(gap, cut.open, x);
      way.push(new THREE.Vector2(from.x, from.z), new THREE.Vector2(to.x, to.z));
    });
    way.push(flat(bx, bz));
  }
  return way;
})();

const lengthOf = (way: readonly (readonly [number, number])[]): number =>
  way.reduce((sum, p, i) => i ? sum + Math.hypot(p[0] - way[i - 1][0], p[1] - way[i - 1][1]) : 0, 0);
/** Simulated leaves to a metre of the walk, as a share of the `LEAF_SIDE` rows it had when first laid out. */
const LEAF_COUNT = LEAF_SIDE * Math.round(LEAF_SIDE * tuning.birches.looseLeaves * lengthOf(WAY.map(p => [p.x, p.y] as const)) / lengthOf([LANDING_AT, ...WALK_AT, BERTH_AT]));

/** The walk as first laid out, in band-local terms. */
const FIRST_WAY = [LANDING_AT, ...WALK_AT, BERTH_AT].map(([x, z]) => new THREE.Vector2(x, z));

/** How far a point lies off the walk. */
function walkDistance(x: number, z: number, way = WAY): number {
  let best = 1e9;
  for (let i = 1; i < way.length; i++) {
    const a = way[i - 1];
    const b = way[i];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.y - dz * t));
  }
  return best;
}

/**
 * A swing hanging from a branch with nobody on it. The wind moves it before anyone arrives; then the child gets
 * on and the player finds out what they have been doing all this time — pushing a child on a swing.
 */
export class Swing {
  readonly group = new THREE.Group();
  readonly pivot = new THREE.Vector3();
  readonly materials: THREE.ShaderMaterial[];
  /** How far it is out of true, in radians, and how fast. Positive swings north, away from the camera. */
  angle = 0;
  speed = 0;
  /** 0 empty, 1 with the child on it: a loaded swing is slower and takes more pushing. */
  rider = 0;
  braking = false;
  invited = false;
  brushAge = Infinity;
  length = 3.6;
  private readonly seatLocal = new THREE.Vector3();
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };

  constructor(pivot: THREE.Vector3, ground: number, subject: THREE.Vector4) {
    this.pivot.copy(pivot);
    this.length = Math.max(2.2, pivot.y - ground - 0.55);
    const seat = new THREE.BoxGeometry(1.25, 0.12, 0.42).translate(0, -this.length, 0);
    const rope = (side: number): THREE.BufferGeometry =>
      log(new THREE.Vector3(side * 0.44, 0.1, 0), new THREE.Vector3(side * 0.46, -this.length, 0), 0.045, 0.038, 7);
    const paint = (colour: string): THREE.ShaderMaterial =>
      new THREE.ShaderMaterial({
        vertexShader: PLAIN_VERT,
        fragmentShader: ROPE_FRAG,
        uniforms: { ...atmo.uniforms, uPaint: { value: new THREE.Color(colour) }, uSubject: { value: subject } },
      });
    const wood = paint('#705030');
    const cord = paint('#725b3c');
    this.group.add(new THREE.Mesh(seat, wood));
    this.group.add(new THREE.Mesh(mergeGeometries([rope(1), rope(-1)]), cord));
    this.group.position.copy(pivot);
    this.materials = [wood, cord];
  }

  /** Where the seat is now, in the world. */
  seat(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pivot.x, this.pivot.y - this.length * Math.cos(this.angle), this.pivot.z + this.length * Math.sin(this.angle));
  }

  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if ((!this.invited && !this.rider) || input.muted || !input.present || input.gust < 1.4) return;
    const seat = this.seat(this.seatLocal);
    const touch = screenBrush(camera, seat, input.prevNdc, input.ndc, .25);
    if (touch < .01) return;
    this.brushAge = 0;
    wind.addSplat({ source: this, ax: seat.x, az: seat.z, bx: seat.x, bz: seat.z,
      vx: input.gustDir.x * input.gust, vz: input.gustDir.y * input.gust,
      radius: 3, energy: Math.min(.8, input.gust / 20) * Math.sqrt(touch), lift: 0, swirl: 0 });
  }

  update(dt: number, wind: WindField): void {
    this.brushAge += dt;
    const seat = this.seat(this.seatLocal);
    const w = wind.sample(seat.x, seat.z, this.air);
    const load = 1 + this.rider * 0.8;
    /** A pendulum, pushed by the air along its travel and given a shove by any gust that reaches it. */
    const along = w.z;
    const travel = this.length * this.speed * Math.cos(this.angle);
    const push = (along - travel * 0.5) * tuning.birches.swingPush * (0.5 + 0.5 * this.rider);
    /** Any gust that reaches it helps it along, whichever way it is blowing: a player who keeps at it gets height. */
    const way = Math.abs(this.speed) > 0.03 ? Math.sign(this.speed) : Math.sign(along) || 1;
    const gust = w.energy * tuning.birches.swingGust * way;
    const gravity = -9.81 * 0.78 * Math.sin(this.angle);
    this.speed += ((gravity + (this.braking ? 0 : (push + gust) / load)) / this.length) * dt;
    this.speed *= Math.exp(-dt * (this.braking ? tuning.birches.scarf.swingBrake : tuning.birches.swingDamping));
    this.angle += this.speed * dt;
    if (Math.abs(this.angle) > 1.15) {
      this.angle = Math.sign(this.angle) * 1.15;
      this.speed *= -0.3;
    }
    this.group.rotation.x = -this.angle;
  }
}

/**
 * The autumn birches: a small island of gold between the meadow and the drowned village. Everything on it reads
 * the live wind, and everything the player does to it is one way — the gusts that were bringing the world back to
 * life on the first island take the last of the year off this one, and the trees stay bare.
 */
export class AutumnBirches {
  readonly objects: THREE.Object3D[] = [];
  /** Who must stay in sight: x, y, z and 1 while it applies. Anything in front of them gives way. */
  readonly subject = new THREE.Vector4();
  readonly swing: Swing;
  readonly scarf = new BirchScarf();
  private readonly trees: Birch[] = [];
  private readonly table: Float32Array;
  private readonly treeTex: THREE.DataTexture;
  private readonly leaves: FallenLeaves;
  private canopyMotion!: BirchCanopyMotion;
  private readonly litter: LitterField;
  private readonly litterCover: Float32Array;
  onLeafScuff: ((x: number, z: number, strength: number) => void) | null = null;
  private readonly litterMesh: THREE.Mesh;
  private readonly litterMat: THREE.ShaderMaterial;
  private readonly heapSkin: THREE.Mesh;
  private readonly heapCore: THREE.Mesh;
  /** Who is wading through the leaves: x, z, how far it reaches, and how fast they are going. */
  private readonly wade = new THREE.Vector4(1e6, 1e6, 2.1, 0);
  private readonly focus = new THREE.Vector3(ISLE.x, 0, ISLE.z);
  /** Something that has just gone into the heap, and the seconds left of it: it outranks anybody merely walking. */
  private readonly kicking = new THREE.Vector4(1e6, 1e6, 3, 0);
  private readonly burrowing = new THREE.Vector4(1e6, 1e6, 1, 0);
  /** The squirrel's heaps stand from the start: the wind reaches the first from the boat, before its round can hold it. */
  private holding: readonly number[] = BIRCH_PILES.flatMap((p, i) => (p.raked ? [i] : []));
  private readonly held = new Map(this.holding.map((heap) => [heap, 1]));
  private kickFor = 0;
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly walker = new THREE.Vector3();
  private readonly lastWalker = new THREE.Vector3(1e6, 0, 1e6);
  /** How hard the swing tree is being shaken by what is on it. */
  private shaking = 0;
  /** Each shape of tree's trunk, foot to crown, in the unit tree. */
  private readonly trunks: Seg[][];

  constructor(renderer: THREE.WebGLRenderer, private readonly wind: WindField, settleScarf = true) {
    const rand = mulberry32(8821);
    const variants = [growBirch(rand, false), growBirch(rand, false), growBirch(rand, false), growBirch(rand, false), growBirch(rand, true)];
    this.trunks = variants.map(v => v.segs.slice(0, TRUNK_PARTS));
    this.place(rand);
    this.scarf.setTrees(this.trees, settleScarf);

    const width = Math.max(this.trees.length, 1);
    this.table = new Float32Array(width * 3 * 4);
    this.treeTex = new THREE.DataTexture(this.table, width, 3, THREE.RGBAFormat, THREE.FloatType);
    this.treeTex.needsUpdate = true;
    this.litterCover = this.litterSeed(rand);
    this.litter = new LitterField(renderer, this.litterCover, this.wade, BIRCH_PILES);
    const shared = {
      ...atmo.uniforms,
      ...this.litter.uniforms,
      uTrees: { value: this.treeTex },
      uSubject: { value: this.subject },
      uWade: { value: this.wade },
      uBurrow: { value: this.burrowing },
    };
    this.writeTable();

    /** One draw call per shape of tree; every tree of that shape is an instance of it. */
    variants.forEach((variant, v) => {
      const mine = this.trees.filter((t) => t.variant === v);
      if (!mine.length) return;
      const merged = mergeGeometries(variant.segs.map((s) => log(s.a, s.b, s.ra, s.rb)));
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = merged.index;
      geo.setAttribute('position', merged.attributes.position);
      geo.setAttribute('normal', merged.attributes.normal);
      geo.setAttribute('aIndex', new THREE.InstancedBufferAttribute(new Float32Array(mine.map((t) => this.trees.indexOf(t))), 1));
      geo.instanceCount = mine.length;
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(ISLE.x, 10, ISLE.z), 200);
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: TRUNK_VERT, fragmentShader: TRUNK_FRAG, uniforms: shared }));
      mesh.frustumCulled = false;
      this.objects.push(mesh);
    });

    this.objects.push(this.canopy(renderer, rand, variants, shared));
    this.litterMesh = this.litterCarpet(shared);
    this.litterMat = this.litterMesh.material as THREE.ShaderMaterial;
    this.heapSkin = this.heapLeaves(shared);
    this.heapCore = this.heapBodies(shared);
    this.objects.push(this.litterMesh, this.heapSkin, this.heapCore);

    const tree = this.trees[this.trees.length - 1];
    const limb = new THREE.Vector3(SWING_LIMB.x, SWING_LIMB.y + 0.006, SWING_LIMB.z).multiplyScalar(tree.scale);
    const pivot = new THREE.Vector3(tree.x + limb.x, tree.y + limb.y, tree.z + limb.z);
    this.swing = new Swing(pivot, Math.max(heightAt(pivot.x, pivot.z), 0), this.subject);
    this.objects.push(this.swing.group);

    this.objects.push(this.fallen(shared));
    this.objects.push(this.scarf.mesh);
    const hook = this.scarf.snags[0].center;
    const branch = mergeGeometries([
      log(FORK_BRANCH.a, FORK_BRANCH.b, FORK_BRANCH.r0, FORK_BRANCH.r1, 7),
      log(new THREE.Vector3(hook.x + 1.5, hook.y + 0.65, hook.z - 0.35), new THREE.Vector3(hook.x + 1.1, hook.y + 1.95, hook.z - 0.6), 0.075, 0.025, 6),
    ]);
    this.objects.push(new THREE.Mesh(branch, new THREE.ShaderMaterial({ vertexShader: PLAIN_VERT, fragmentShader: FALLEN_FRAG, uniforms: shared })));

    const scarfBranches = mergeGeometries([
      ...this.scarf.slipLog.map(limb => log(limb.a, limb.b, limb.radius, limb.radius - .065, 11)),
      ...this.scarf.slipBranch.map((limb, i, limbs) => log(limb.a, limb.b, limb.radius, limbs[i + 1]?.radius ?? .055, 7)),
      ...this.scarf.bowBranch.map((limb, i) => log(limb.a, limb.b, limb.radius, i === 0 ? .12 : .075, 9)),
    ]);
    this.objects.push(new THREE.Mesh(scarfBranches, new THREE.ShaderMaterial({
      vertexShader: PLAIN_VERT, fragmentShader: FALLEN_FRAG, uniforms: shared,
    })));

    const stump = this.scarf.stump, base = new THREE.Vector3(stump.x, Math.max(0, heightAt(stump.x, stump.z)), stump.z);
    const top = base.clone().add(new THREE.Vector3(0, stump.height, 0));
    const stumpGeo = log(base, top, stump.radius, stump.radius * .82, 12);
    const broken = (x: number, z: number) => .07 * Math.sin(Math.atan2(z - top.z, x - top.x) * 5 + .4);
    const barkPosition = stumpGeo.attributes.position;
    for (let i = 0; i < barkPosition.count; i++) if (barkPosition.getY(i) > top.y - .01)
      barkPosition.setY(i, top.y + broken(barkPosition.getX(i), barkPosition.getZ(i)));
    stumpGeo.computeVertexNormals();
    const stumpVert = PLAIN_VERT.replace('out vec3 vWorld;', 'uniform float uBase;\nout float vUp;\nout vec3 vWorld;')
      .replace('vWorld = w.xyz;', 'vWorld = w.xyz; vUp = (w.y - uBase) / 16.0;');
    this.objects.push(new THREE.Mesh(stumpGeo, new THREE.ShaderMaterial({ vertexShader: stumpVert,
      fragmentShader: TRUNK_FRAG, uniforms: { ...shared, uBase: { value: base.y } } })));
    const cut = new THREE.CircleGeometry(stump.radius * .82, 12).rotateX(-Math.PI / 2).translate(top.x, top.y + .003, top.z);
    const cutPosition = cut.attributes.position;
    for (let i = 1; i < cutPosition.count; i++) cutPosition.setY(i, top.y + .003 + broken(cutPosition.getX(i), cutPosition.getZ(i)));
    cut.computeVertexNormals();
    this.objects.push(new THREE.Mesh(cut, new THREE.ShaderMaterial({ vertexShader: PLAIN_VERT, fragmentShader: ROPE_FRAG,
      uniforms: { ...shared, uPaint: { value: new THREE.Color('#c9a471') } } })));

    this.leaves = new FallenLeaves(renderer, this.leafState(rand, variants), this.wade, BIRCH_PILES);
    this.objects.push(this.leaves.mesh);
    for (const o of this.objects) o.visible = false;
    fixInPlace(...this.objects.filter((o) => o !== this.swing.group), ...this.swing.group.children);
  }

  /** The birch that came down, lying along the slope with the first heap of the walk banked against its lee side. */
  private fallen(shared: Record<string, THREE.IUniform>): THREE.Mesh {
    const { a, b } = FALLEN_LOG;
    /** It lies on the ground it fell on, not on a line over it: it is jointed along the slope and sunk into it. */
    const parts = 4;
    const along = (t: number): THREE.Vector3 => {
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      return new THREE.Vector3(x, Math.max(heightAt(x, z), 0) + 0.16, z);
    };
    const wide = (t: number): number => 0.34 * (1 - t * 0.42);
    const geo = mergeGeometries(
      Array.from({ length: parts }, (_, i) => log(along(i / parts), along((i + 1) / parts), wide(i / parts), wide((i + 1) / parts), 9)),
    );
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: PLAIN_VERT, fragmentShader: FALLEN_FRAG, uniforms: shared }));
    mesh.frustumCulled = false;
    return mesh;
  }

  /**
   * The floor as it stands when they arrive: a season of leaves over the whole wood, thicker in the hollow and
   * along the foot of every trunk, thin on the ride where the wind gets at it, scattered onto the dry beaches,
   * and the heaps. From here on the wind and their feet own it.
   */
  private litterSeed(rand: () => number): Float32Array {
    const { x: across, z: along } = LITTER_RES;
    const data = new Float32Array(across * along * 4);
    const patchy = createNoise2D(907);
    const cell = { x: LITTER_BOX.sx / across, z: LITTER_BOX.sz / along };
    const depths = new Float32Array(across * along);
    for (let j = 0; j < along; j++) {
      for (let i = 0; i < across; i++) {
        const x = LITTER_BOX.x + (i + 0.5) * cell.x;
        const z = LITTER_BOX.z + (j + 0.5) * cell.z;
        /** The cheap test first: over half of this grid is sea, and the ground under it is not worth looking up. */
        if (birchesOut(x, z) > 1.15) continue;
        const h = heightAt(x, z);
        if (h <= 0.05) continue;
        const patches = birchesNoise(x, z, (lx, lz) => patchy(lx * 0.12, lz * 0.12));
        const fingers = birchesNoise(x, z, (lx, lz) => patchy(lx * 0.24 + 18, lz * 0.065));
        // Broad gaps and narrow windrows, independent of the island's elliptical outline.
        const edge = h + patches * 1.6 + fingers * 0.9;
        let d = (1.15 + 0.65 * patches) * THREE.MathUtils.smoothstep(edge, 0.15, 4.8);
        // A few full-sized strays continue across the sand between the windrows.
        d += 0.12 * THREE.MathUtils.smoothstep(fingers, -0.2, 0.7);
        d *= THREE.MathUtils.smoothstep(h, 0.05, 0.65);
        /** The ride is walked and blown over: less lies on it than either side of it. */
        d *= 0.72 + 0.4 * THREE.MathUtils.smoothstep(walkDistance(x, z), 1.5, 9);
        depths[j * across + i] = Math.max(0, d);
      }
    }
    /** Banked against every trunk, because that is where a leaf blowing along the ground stops. */
    const at = (x: number, z: number, add: number): void => {
      const i = Math.round((x - LITTER_BOX.x) / cell.x - 0.5);
      const j = Math.round((z - LITTER_BOX.z) / cell.z - 0.5);
      if (i < 0 || j < 0 || i >= across || j >= along) return;
      const k = j * across + i;
      if (depths[k] > 0) depths[k] = Math.min(4, depths[k] + add);
    };
    for (const tree of this.trees) {
      const reach = 0.5 + tree.scale * 0.055;
      for (let s = 0; s < 22; s++) {
        const a = rand() * Math.PI * 2;
        const r = reach * (0.35 + rand() * 0.8);
        at(tree.x + Math.cos(a) * r, tree.z + Math.sin(a) * r, 0.5 * (1 - r / (reach * 1.15)));
      }
    }
    /**
     * And the heaps, which are the only deep leaves anybody put there on purpose. Round a raked one the floor is
     * thin, scraped in streaks toward it, most of all at its foot.
     */
    const { heapRaked, heapRakedKeep } = tuning.birches;
    for (const pile of BIRCH_PILES) {
      const span = Math.ceil(pileReach(pile) / Math.min(cell.x, cell.z)) + 1;
      const ci = Math.round((pile.x - LITTER_BOX.x) / cell.x - 0.5);
      const cj = Math.round((pile.z - LITTER_BOX.z) / cell.z - 0.5);
      for (let j = cj - span; j <= cj + span; j++) {
        for (let i = ci - span; i <= ci + span; i++) {
          if (i < 0 || j < 0 || i >= across || j >= along) continue;
          const x = LITTER_BOX.x + (i + 0.5) * cell.x;
          const z = LITTER_BOX.z + (j + 0.5) * cell.z;
          const from = Math.hypot(x - pile.x, z - pile.z), k = j * across + i;
          if (pile.raked && from < pile.r + heapRaked) {
            const tines = 0.7 + 0.6 * Math.max(0, Math.sin(Math.atan2(z - pile.z, x - pile.x) * 17 + patchy(x * 0.5, z * 0.5) * 4));
            const keep = THREE.MathUtils.lerp(heapRakedKeep * tines, 1, THREE.MathUtils.smoothstep(from, pile.r * 0.8, pile.r + heapRaked));
            depths[k] *= Math.min(1, keep);
          }
          depths[k] = Math.max(depths[k], pileDepth(pile, from));
        }
      }
    }
    for (let k = 0; k < depths.length; k++) data[k * 4] = depths[k];
    return data;
  }

  /**
   * Scattered over the island in stands, off the beaches, off the ride and out of the clearing on the crest. The wood
   * as it first grew stands tree for tree wherever its band of the island still rises above the tree line; the gaps
   * grow their own, cell by cell, by the same rules.
   */
  private place(rand: () => number): void {
    const stands = createNoise2D(311);
    const step = 4.6;
    const L = BIRCHES_LOCAL;
    const clearing = birchesLocal(BIRCHES_CLEARING.x, BIRCHES_CLEARING.y), glade = birchesLocal(GLADE.x, GLADE.z);
    const snags = SCARF_SNAGS.map(s => birchesLocal(s.treeX, s.treeZ)), perches = SCARF_PERCHES.map(p => birchesLocal(p.x, p.z));
    /** A grid cell's own numbers, so that nothing decided elsewhere on the island moves its tree. */
    const draws = (column: number, row: number, salt: number): (() => number) =>
      mulberry32(Math.imul(column + 1, 73856093) ^ Math.imul(row + 1, 19349663) ^ salt);
    /** Fewer trees out toward the shore. */
    const thinned = (way: number, column: number, row: number, salt: number): boolean =>
      draws(column, row, salt)() < OUTER_THINNING * THREE.MathUtils.smoothstep(way, 18, 32);
    /** Each tangle is watched from up to 30 m back down the ride: nothing grown in a gap stands in that view. */
    const onSightline = (x: number, z: number): boolean => SCARF_SNAGS.some(s => {
      const ax = x - (s.x + s.stopX) / 2, az = z - (s.z * .7 + s.stopZ * .3), along = Math.max(0, Math.min(32, ax * .08 + az));
      return Math.hypot(ax - .08 * along, az - along) < 4;
    });
    const standsAt = (x: number, z: number): number => 0.62 + 0.42 * birchesNoise(x, z, (lx, lz) => stands(lx * 0.035, lz * 0.035));
    for (let column = 0, gx = L.x - L.rx; gx <= L.x + L.rx; column++, gx += step) {
      for (let row = 0, gz = L.z - L.rz; gz <= L.z + L.rz; row++, gz += step) {
        const lx = gx + (rand() - 0.5) * step * 1.4;
        const lz = gz + (rand() - 0.5) * step * 1.4;
        const first = birchesFirstHeight(lx, lz);
        if (first < TREE_LINE) continue;
        /** The ride opens out at both beaches and at the clearing, and closes in between. */
        if (walkDistance(lx, lz, FIRST_WAY) < RIDE) continue;
        if (((lx - glade.x) / GLADE.rx) ** 2 + ((lz - glade.z) / GLADE.rz) ** 2 < 1) continue;
        if (this.scarf.woundNear(lx, lz) || snags.some(s => Math.hypot(lx - s.x, lz - s.z) < 3.2)
          || perches.some(s => Math.hypot(lx - s.x, lz - s.z) < 3.2)) continue;
        if (Math.hypot(lx - clearing.x, lz - clearing.z) < 8.5) continue;
        if (rand() > 0.62 + 0.42 * stands(lx * 0.035, lz * 0.035)) continue;
        /** The wind has been at the shore trees all their lives: shorter and thinner down by the water. */
        const shelter = Math.min(1, (first - TREE_LINE) / 3.5);
        const scale = (12 + rand() * 6) * (0.6 + 0.4 * shelter);
        const yaw = rand() * 6.2831, variant = Math.floor(rand() * 4);
        const { x, z } = birchesAt(lx, lz), y = heightAt(x, z);
        if (y < TREE_LINE || this.scarf.crosses(x, z) || thinned(walkDistance(x, z), column, row, 4242) || nearBank(x, z)) continue;
        this.trees.push({ x, y: y - 0.25, z, scale, yaw, variant, strip: 0, shed: 0 });
      }
    }
    BIRCHES_CUTS.forEach((cut, gap) => {
      for (let column = 0; column * step <= 2 * L.rx; column++) {
        for (let row = -1; row * step < cut.open + step; row++) {
          const draw = draws(column, row, 8822 + gap);
          const across = L.x - L.rx + column * step + (draw() - 0.5) * step * 1.4;
          const into = row * step + (draw() - 0.5) * step * 1.4;
          if (into <= 0 || into >= cut.open) continue;
          const { x, z } = birchesGap(gap, into, across), y = heightAt(x, z);
          if (y < TREE_LINE) continue;
          const way = walkDistance(x, z);
          if (way < RIDE || this.scarf.crosses(x, z) || onSightline(x, z) || draw() > standsAt(x, z) || thinned(way, column, row, 4243 + gap)
            || nearBank(x, z) || inHeap(x, z) || inRoundView(x, z)) continue;
          const shelter = Math.min(1, (y - TREE_LINE) / 3.5);
          const scale = (12 + draw() * 6) * (0.6 + 0.4 * shelter);
          this.trees.push({ x, y: y - 0.25, z, scale, yaw: draw() * 6.2831, variant: Math.floor(draw() * 4), strip: 0, shed: 0 });
        }
      }
    });
    for (const s of SCARF_SNAGS) {
      if (s.kind === 'unwind' || s.kind === 'pull') continue;
      this.trees.push({ x: s.treeX, y: heightAt(s.treeX, s.treeZ) - 0.25, z: s.treeZ, scale: 16, yaw: 0.4, variant: 1, strip: 0, shed: 0 });
    }
    for (const s of SCARF_PERCHES) {
      this.trees.push({ x: s.x, y: heightAt(s.x, s.z) - 0.25, z: s.z, scale: 15 + s.h * .2,
        yaw: birchesLocal(s.x, s.z).x * .4, variant: 1, strip: 0, shed: 0 });
    }
    for (const b of BANKS) {
      this.trees.push({ x: b.x, y: heightAt(b.x, b.z) - 0.25, z: b.z, scale: b.scale, yaw: birchesLocal(b.x, b.z).x * .7, variant: b.variant, strip: 0, shed: 0 });
    }
    /** Keep the swing tree last: the rope's pivot is read from this exact tree. */
    const y = heightAt(SWING_TREE.x, SWING_TREE.y);
    this.trees.push({ x: SWING_TREE.x, y: y - 0.3, z: SWING_TREE.y, scale: SWING_SCALE, yaw: 0, variant: 4, strip: 0, shed: 0 });
  }

  private writeTable(): void {
    const n = this.trees.length;
    this.trees.forEach((t, i) => {
      this.table.set([t.x, t.y, t.z, t.scale], i * 4);
      this.table.set([Math.cos(t.yaw), Math.sin(t.yaw), t.strip, (i * 0.618034) % 1], (n + i) * 4);
      this.table.set([t.shed, 0, 0, 0], (n * 2 + i) * 4);
    });
    this.treeTex.needsUpdate = true;
  }

  /** Gold hung on the twig ends: one card is a handful of leaves, and a tree loses them one at a time. */
  private canopy(renderer: THREE.WebGLRenderer, rand: () => number, variants: { tips: THREE.Vector3[] }[], shared: Record<string, THREE.IUniform>): THREE.Mesh {
    const leaves = new Float32Array(this.trees.length * LEAVES_PER_TREE * 4);
    const tufts = new Float32Array(this.trees.length * LEAVES_PER_TREE * 4);
    let n = 0;
    this.trees.forEach((tree, i) => {
      const tips = variants[tree.variant].tips;
      for (let k = 0; k < LEAVES_PER_TREE; k++) {
        const tip = tips[Math.floor(rand() * tips.length)];
        const spread = 0.035 + rand() * 0.05;
        const x = tip.x + (rand() - 0.5) * spread * 2;
        const y = tip.y + (rand() - 0.5) * spread * 1.4 - rand() * 0.02;
        const z = tip.z + (rand() - 0.5) * spread * 2;
        leaves.set([x, y, z, rand()], n * 4);
        tufts.set([i, (0.16 + rand() * 0.11) * (tree.scale / 12), rand(), rand()], n * 4);
        n++;
      }
    });
    this.canopyMotion = new BirchCanopyMotion(renderer, LEAVES_PER_TREE, this.trees.length, leaves, BIRCH_TREE_GLSL, shared);
    const refs = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      refs[i * 2] = ((i % LEAVES_PER_TREE) + 0.5) / LEAVES_PER_TREE;
      refs[i * 2 + 1] = (Math.floor(i / LEAVES_PER_TREE) + 0.5) / this.trees.length;
    }
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('aMotion', new THREE.InstancedBufferAttribute(refs, 2));
    geo.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(leaves, 4));
    geo.setAttribute('aTuft', new THREE.InstancedBufferAttribute(tufts, 4));
    geo.instanceCount = n;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(ISLE.x, 10, ISLE.z), 200);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: CANOPY_VERT,
        fragmentShader: CANOPY_FRAG,
        uniforms: { ...shared, uCanopyMotion: this.canopyMotion.uniform, uDetail: { value: new THREE.Vector2(34, 150) } },
        side: THREE.DoubleSide,
        alphaToCoverage: true,
      }),
    );
    mesh.frustumCulled = false;
    return mesh;
  }

  private litterCarpet(shared: Record<string, THREE.IUniform>): THREE.Mesh {
    const side = LITTER_GRID;
    const card = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = card.index;
    geo.setAttribute('position', card.attributes.position);
    const cells = new Float32Array(side * side * 2);
    for (let i = 0; i < side * side; i++) {
      cells[i * 2] = (i % side) - side / 2;
      cells[i * 2 + 1] = Math.floor(i / side) - side / 2;
    }
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
    geo.instanceCount = side * side;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: LITTER_VERT,
        fragmentShader: LITTER_FRAG,
        uniforms: { ...shared, uLitterCell: { value: new THREE.Vector2() } },
        side: THREE.DoubleSide,
        alphaToCoverage: true,
      }),
    );
    mesh.frustumCulled = false;
    return mesh;
  }

  /** The leaves over every heap's surface, at places scattered over it and round it as far as its leaves may slump. */
  private heapLeaves(shared: Record<string, THREE.IUniform>): THREE.Mesh {
    const rand = mulberry32(5303);
    const spacing = 0.2;
    const spots: number[] = [];
    for (const pile of BIRCH_PILES) {
      const reach = pileReach(pile);
      for (let gz = -reach; gz <= reach; gz += spacing) {
        for (let gx = -reach; gx <= reach; gx += spacing) {
          const x = gx + (rand() - 0.5) * spacing, z = gz + (rand() - 0.5) * spacing;
          if (Math.hypot(x, z) < reach) spots.push(pile.x + x, pile.z + z, rand(), rand());
        }
      }
    }
    const card = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = card.index;
    geo.setAttribute('position', card.attributes.position);
    geo.setAttribute('aSpot', new THREE.InstancedBufferAttribute(new Float32Array(spots), 4));
    geo.instanceCount = spots.length / 4;
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: HEAP_SKIN_VERT,
      fragmentShader: LITTER_FRAG,
      uniforms: shared,
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    }));
    mesh.frustumCulled = false;
    return mesh;
  }

  /** A sheet over each heap and as far round it as its leaves may slump, shaped to them as they lie each frame. */
  private heapBodies(shared: Record<string, THREE.IUniform>): THREE.Mesh {
    const sheets = BIRCH_PILES.map((pile) => {
      const reach = pileReach(pile), steps = Math.ceil(reach * 2 / 0.4);
      return new THREE.PlaneGeometry(reach * 2, reach * 2, steps, steps).rotateX(-Math.PI / 2).translate(pile.x, 0, pile.z);
    });
    const mesh = new THREE.Mesh(mergeGeometries(sheets), new THREE.ShaderMaterial({
      vertexShader: HEAP_CORE_VERT,
      fragmentShader: HEAP_CORE_FRAG,
      uniforms: shared,
    }));
    mesh.frustumCulled = false;
    return mesh;
  }

  /**
   * Where every simulated leaf starts: most of them on a tree, weighted toward the ones along the walk so a gust
   * where the player is playing takes a cloud off; the rest already down, drifted along the way.
   */
  private leafState(rand: () => number, variants: { tips: THREE.Vector3[] }[]): Float32Array {
    const state = new Float32Array(LEAF_COUNT * 4);
    const near = this.trees.filter((t) => walkDistance(t.x, t.z) < 17);
    /**
     * Nearly a third of them are already in the heaps, so that a gust into one bursts it in a spray and does not
     * merely thin it: shared by how much each heap covers, and more to the raked ones the squirrel hides in.
     */
    const heaped = Math.floor(LEAF_COUNT * 0.3);
    const drifts = heaped + Math.floor(LEAF_COUNT * 0.12);
    const shares = BIRCH_PILES.map((p) => p.r * p.r * (p.raked ? 1.5 : 1));
    const whole = shares.reduce((a, b) => a + b, 0);
    let pile = 0, filled = 0;
    for (let i = 0; i < LEAF_COUNT; i++) {
      if (i < heaped) {
        while (filled >= shares[pile] / whole * heaped && pile < BIRCH_PILES.length - 1) {
          filled -= shares[pile] / whole * heaped;
          pile++;
        }
        filled++;
        const p = BIRCH_PILES[pile];
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * p.r * 0.9;
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        state.set([x, Math.max(heightAt(x, z), 0) + 0.04 + rand() * litterTop(pileDepth(p, r)), z, 1], i * 4);
        continue;
      }
      if (i < drifts) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 11;
        const leg = BIRCHES_WALK[Math.floor(rand() * BIRCHES_WALK.length)];
        const x = leg.x + Math.cos(a) * r;
        const z = leg.y + Math.sin(a) * r;
        state.set([x, Math.max(heightAt(x, z), 0) + 0.05, z, 1], i * 4);
        continue;
      }
      const pool = near.length && rand() < 0.86 ? near : this.trees;
      const tree = pool[Math.floor(rand() * pool.length)];
      const tips = variants[tree.variant].tips;
      const tip = tips[Math.floor(rand() * tips.length)];
      const yaw = tree.yaw;
      const lx = (tip.x + (rand() - 0.5) * 0.07) * tree.scale;
      const ly = (tip.y + (rand() - 0.5) * 0.05) * tree.scale;
      const lz = (tip.z + (rand() - 0.5) * 0.07) * tree.scale;
      state.set([tree.x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, tree.y + ly, tree.z - Math.sin(yaw) * lx + Math.cos(yaw) * lz, 0], i * 4);
    }
    return state;
  }

  /**
   * The trunk of the tree standing nearest (x, z), `height` above its foot: its axis there into `out`, and the
   * bark's radius returned. For anything that climbs it.
   */
  trunkAt(x: number, z: number, height: number, out: THREE.Vector3): number {
    const tree = this.trees.reduce((best, t) => Math.hypot(t.x - x, t.z - z) < Math.hypot(best.x - x, best.z - z) ? t : best);
    const segs = this.trunks[tree.variant];
    const up = THREE.MathUtils.clamp(height / tree.scale, 0, segs[segs.length - 1].b.y);
    const seg = segs.find(s => s.b.y >= up) ?? segs[segs.length - 1];
    const t = (up - seg.a.y) / Math.max(1e-6, seg.b.y - seg.a.y);
    const lx = (seg.a.x + (seg.b.x - seg.a.x) * t) * tree.scale, lz = (seg.a.z + (seg.b.z - seg.a.z) * t) * tree.scale;
    const c = Math.cos(tree.yaw), s = Math.sin(tree.yaw);
    out.set(tree.x + c * lx + s * lz, tree.y + up * tree.scale, tree.z - s * lx + c * lz);
    return (seg.ra + (seg.rb - seg.ra) * t) * tree.scale;
  }

  /** Shakes the leaves out of the tree the swing hangs from, while somebody is swinging on it. */
  shake(amount: number): void {
    this.shaking = amount;
  }

  /**
   * Something has just gone into the leaves. They go up round it and come down again over the next second, and the
   * floor is left with a hole where the heap was, exactly as if the wind had burst it: the heap does not come back.
   */
  kick(x: number, z: number, radius: number, strength: number): void {
    this.kicking.set(x, z, radius, strength);
    this.kickFor = 0.7;
    this.onLeafScuff?.(x, z, strength);
  }

  /**
   * Something going into or out of the leaves at (x, z), from a squirrel's peek (0.2) through its burst (1) to a
   * child's leap (about 1.6): the leaves go up round it, as far and as high as it was hard.
   */
  burst(x: number, z: number, strength: number): void {
    const { burstReach, burstReachPer } = tuning.birches;
    this.kicking.set(x, z, burstReach + burstReachPer * strength, Math.max(strength, 0.35));
    this.kickFor = 0.7;
    this.onLeafScuff?.(x, z, Math.min(strength, 1));
  }

  /**
   * Something stirring under the leaves at (x, z): the loose leaves lying there go up, as hard as `strength`, and none
   * of the heap is taken, so a heap something lives in can shiver all afternoon and still hide it.
   */
  shiver(x: number, z: number, strength: number): void {
    const { burstReach, burstReachPer } = tuning.birches;
    this.kicking.set(x, z, burstReach + burstReachPer * strength, -strength);
    this.kickFor = 0.7;
    this.onLeafScuff?.(x, z, Math.min(strength, 1));
  }

  /**
   * Something landing in a heap at (x, z), 1 a squirrel's dive: the loose leaves round it go up high and wide, and
   * none of the heap is taken, so it is still a whole mound to hide in.
   */
  splash(x: number, z: number, strength: number): void {
    const { splashReach, splashThrow } = tuning.birches;
    this.kicking.set(x, z, splashReach * Math.sqrt(strength), -splashThrow * strength);
    this.kickFor = 0.7;
    this.onLeafScuff?.(x, z, 1);
  }

  /** Something burrowing under the leaves at (x, z), heaving them up `rise` (0..1 of a full hump); null when nothing is. */
  burrow(at: { x: number; z: number } | null, rise = 1): void {
    const { burrowReach, burrowRise } = tuning.birches;
    if (at) this.burrowing.set(at.x, at.z, burrowReach, burrowRise * rise);
    else this.burrowing.w = 0;
  }

  /**
   * Holds `heaps` (`BIRCH_PILES` indices) against the wind until the next call that leaves them out: the wind stirs
   * their tops but takes none of them. Each is held and let go over about half a second.
   */
  hold(heaps: readonly number[]): void {
    this.holding = heaps;
  }

  private holdHeaps(dt: number): void {
    for (const heap of this.holding) if (!this.held.has(heap)) this.held.set(heap, 0);
    let slot = 0;
    for (const [heap, firm] of this.held) {
      const now = THREE.MathUtils.clamp(firm + (this.holding.includes(heap) ? dt : -dt) / tuning.birches.holdEase, 0, 1);
      if (now === 0 && !this.holding.includes(heap)) { this.held.delete(heap); continue; }
      this.held.set(heap, now);
      const p = BIRCH_PILES[heap], h = this.litter.holds[slot++];
      if (h) h.set(p.x, p.z, p.r + tuning.birches.holdReach, now);
    }
    for (; slot < this.litter.holds.length; slot++) this.litter.holds[slot].w = 0;
  }

  /** Leaves at `at`, `r` m round, that only an updraft takes, as it does a heap (a drift something lies in); null for none. */
  guard(at: { x: number; z: number } | null, r = 0): void {
    const spot = this.litter.heaps[this.litter.heaps.length - 1];
    if (at) spot.set(at.x, at.z, r, 0);
    else spot.set(1e6, 1e6, 0, 0);
  }

  /** How high the leaves stand over the ground at each point, in metres, read back from the live floor. */
  depthAt(points: readonly { x: number; z: number }[]): Promise<number[]> {
    return this.litter.depthAt(points);
  }

  /**
   * How far under the leaves' surface to set a buried squirrel's paws where they stand `depth` metres deep: its
   * back well under, the tip of its tail (if out) above. Where they lie thinner it presses into the soil, so far.
   */
  buryDepth(_x: number, _z: number, depth: number): number {
    return Math.min(tuning.birches.buryBelow, Math.max(0, depth) + tuning.birches.burySoil);
  }

  /** Authored floor coverage for quiet foot scuffs, without reading the moving GPU field back. */
  leafCoverAt(x: number, z: number): number {
    const i = Math.floor((x - LITTER_BOX.x) / LITTER_BOX.sx * LITTER_RES.x);
    const j = Math.floor((z - LITTER_BOX.z) / LITTER_BOX.sz * LITTER_RES.z);
    if (i < 0 || j < 0 || i >= LITTER_RES.x || j >= LITTER_RES.z) return 0;
    return this.litterCover[(j * LITTER_RES.x + i) * 4];
  }

  update(dt: number, camera: THREE.Camera, walker: THREE.Vector3 | null): void {
    const away = Math.hypot(camera.position.x - ISLE.x, camera.position.z - ISLE.z);
    /** The gold crowns are worth seeing from the meadow's far shore; the floor and the loose leaves are not. */
    const here = away < ISLE.rz + 220;
    const near = away < FLOOR_RANGE;
    for (const o of this.objects) o.visible = here;
    this.scarf.mesh.visible = here && !this.scarf.finished;
    this.litterMesh.visible = near;
    this.heapSkin.visible = near;
    this.heapCore.visible = near;
    this.leaves.mesh.visible = near;
    if (!near) return;

    const { stripRate, stripTrickle, gripSpeed, stripSpeed } = tuning.birches;
    const land = Math.exp(-dt / SHED_FLIGHT);
    for (const tree of this.trees) {
      tree.shed *= land;
      if (tree.strip >= 0.985) continue;
      const w = this.wind.sample(tree.x, tree.z, this.air);
      const speed = Math.hypot(w.x, w.z);
      const gust = Math.min(1, w.energy * 0.85) + Math.min(1, Math.max(0, (speed - gripSpeed) / (stripSpeed - gripSpeed)));
      const shaken = tree.variant === 4 ? this.shaking * 0.06 : 0;
      const was = tree.strip;
      tree.strip = Math.min(0.985, tree.strip + (stripTrickle + shaken + stripRate * gust) * dt);
      tree.shed += tree.strip - was;
    }
    this.writeTable();
    this.canopyMotion.update(dt);

    if (walker) {
      this.walker.copy(walker);
      const speed = this.lastWalker.x < 1e5 ? this.walker.distanceTo(this.lastWalker) / Math.max(dt, 1e-4) : 0;
      this.lastWalker.copy(walker);
      /** Deep leaves come up round the knees of anybody moving through them, and settle again the moment they stop. */
      this.wade.set(walker.x, walker.z, 2.1, Math.min(1, speed * 0.75));
      this.focus.copy(walker);
    } else {
      this.wade.w = 0;
      this.focus.copy(camera.position);
    }
    this.kickFor = Math.max(0, this.kickFor - dt);
    if (this.kickFor > 0) {
      this.wade.set(this.kicking.x, this.kicking.y, this.kicking.z, this.kicking.w * Math.min(1, this.kickFor / 0.35));
    }
    this.litterMat.uniforms.uLitterCell.value.set(Math.round(camera.position.x / LITTER_CELL), Math.round(camera.position.z / LITTER_CELL));

    this.holdHeaps(dt);
    this.litter.update(dt);
    const shaking = this.shaking > 0.01 ? { x: SWING_TREE.x, z: SWING_TREE.y, radius: 9, strength: this.shaking * 0.5 } : null;
    this.leaves.update(dt, near, this.focus, shaking);
  }
}

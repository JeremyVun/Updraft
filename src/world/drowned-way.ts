import * as THREE from 'three';
import type { Deck } from './decks';

/**
 * The neighbourhood round the church, laid by hand among the generated village, and the way over its roofs from
 * the roof the becalmed boat drifts against to the foot of the tower.
 */

/** A hand-placed house: the generated village's house, put exactly where the way needs it. */
export interface PlacedHouse {
  x: number;
  z: number;
  /** Turns the house's length (its local x) to (cos yaw, -sin yaw); its local z, the side its front faces, to (sin yaw, cos yaw). */
  yaw: number;
  len: number;
  depth: number;
  wall: number;
  rise: number;
  sink: number;
  thatched: boolean;
  /** Where along the ridge each chimney stands, along local x from -1 at one end to 1 at the other. */
  stacks: number[];
  /** How far the chimney stands above the ridge. */
  stack: number;
  roll?: number;
  /** The gable end (along local x, -1 or 1) with a small window in it, just out of the water. */
  gable?: number;
  /** Bare stone walls rather than limewash. */
  stone?: boolean;
  /** How many pots each chimney carries. */
  pots?: number;
  /** No heron perches on its chimney. */
  quiet?: boolean;
}

/** A garden wall: a run of coping from (x0, z0) to (x1, z1), its top at `top`. */
export interface GardenWall {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  top: number;
  /** Iron railings set along the coping. */
  railed?: boolean;
}

export function houseLocal(h: PlacedHouse, lx: number, lz: number, out = new THREE.Vector2()): THREE.Vector2 {
  const c = Math.cos(h.yaw);
  const s = Math.sin(h.yaw);
  return out.set(h.x + lx * c + lz * s, h.z - lx * s + lz * c);
}

/** Height of a slate roof's ridge cap and of its eaves. */
export const ridgeTop = (h: PlacedHouse) => h.wall + h.rise + 0.04 - h.sink;
export const eaveAt = (h: PlacedHouse) => h.wall - 0.1 - h.sink;
/** How far the slates overhang the wall at the eaves. */
const OVERHANG = 0.28;
/** The height of a slate roof `lz` across from its ridge. */
const slatesAt = (h: PlacedHouse, lz: number) =>
  THREE.MathUtils.lerp(ridgeTop(h), eaveAt(h), Math.min(1, Math.abs(lz) / (h.depth / 2 + OVERHANG)));

/** Up the channel, north by west: the way the drift comes in. */
const CHANNEL = new THREE.Vector2(-0.4472, -0.8944);

/** Where the hull comes to rest as the air dies, and the way it lies there: swung a little off the drift as it loses way. */
export const STRAND = new THREE.Vector2(-9, -1398);
export const STRAND_YAW = Math.atan2(CHANNEL.x, CHANNEL.y) - 0.12;
/** How far ahead of the hull's middle its stem meets the water. */
const STEM = 2.1;
/** How far in from the strand roof's west gable the stem comes to rest. */
const STEP_IN = 2.2;

/**
 * The roof the boat drifts against: low in the water, its eaves just under the glass, so the stem comes to rest on
 * the slates at the waterline and she can step out onto them and climb to the ridge. It lies across the drift,
 * turned so the lens beside the boat sees its gable end and the slope the boat touches.
 */
export const STRAND_HOUSE: PlacedHouse = (() => {
  const h: PlacedHouse = { x: 0, z: 0, yaw: -0.3, len: 8, depth: 4.6, wall: 3.4, rise: 2.5, sink: 3.45, thatched: false,
    stacks: [1], stack: 1.1, gable: -1, stone: true };
  const touch = new THREE.Vector2(STRAND.x + Math.sin(STRAND_YAW) * STEM, STRAND.y + Math.cos(STRAND_YAW) * STEM);
  /** Across from the ridge to where the slates meet the water, and along it from the house's middle to the stem. */
  const waterline = (ridgeTop(h) / (ridgeTop(h) - eaveAt(h))) * (h.depth / 2 + OVERHANG);
  const along = -(h.len / 2 - STEP_IN);
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  h.x = touch.x - along * c - waterline * s;
  h.z = touch.y + along * s - waterline * c;
  return h;
})();

/** The cottage across the lane, its garden walled down to the water; the way goes up its south slope and over. */
export const GARDEN_HOUSE: PlacedHouse = {
  x: -3, z: -1423.2, yaw: -0.15, len: 10, depth: 6, wall: 3.4, rise: 2.5, sink: 2.95, thatched: false,
  stacks: [1], stack: 1.3,
};

/** The church's nave, joined to the tower's west face, its ridge running east to the tower's foot. */
export const NAVE: PlacedHouse = {
  x: 3.1, z: -1436, yaw: 0, len: 17, depth: 7.6, wall: 3.2, rise: 3.2, sink: 3.6, thatched: false, stacks: [], stack: 0,
};

/** Where the boat waits while the cat is brought over to it, off the drift as it comes round toward the church. */
export const CAT_HOLD = new THREE.Vector2(-15, -1331);

/** The cat's chimney, across the water from where the boat waits; and where the lens watching the cat stands. */
const CAT_TOWARD = new THREE.Vector2(0.915, -0.403);
const CAT_ACROSS = 9;
/**
 * The lens stands this far from the chimney, turned this far (radians) round from her toward the church: near enough
 * for the cat to read, and so far round that she looks across the frame at it and never toward the lens.
 */
const CAT_LENS_OFF = 7;
const CAT_LENS_TURN = 1.66;

/**
 * The roof the cat is stranded on: a cottage nearly gone under, only its ridge and a gable-end chimney out of the
 * water, so the cat on its pot is low enough to be seen at the same time as her. Its slope faces her, turned a little
 * toward the lens, and its chimney stands at the end toward the lens, so the cat, the slates it comes down and the
 * water the tub crosses are all in view.
 */
export const CAT_HOUSE: PlacedHouse = (() => {
  const pot = CAT_HOLD.clone().addScaledVector(CAT_TOWARD, CAT_ACROSS);
  const yaw = Math.atan2(-CAT_TOWARD.x, -CAT_TOWARD.y) - 0.3 * CAT_LENS_TURN;
  const h: PlacedHouse = { x: 0, z: 0, yaw, len: 6.5, depth: 5.6, wall: 3.4, rise: 3.0, sink: 4.8, thatched: false,
    stacks: [-1], stack: 1.0, pots: 1, quiet: true };
  const end = -(h.len / 2 - 0.75);
  h.x = pot.x - end * Math.cos(yaw);
  h.z = pot.y + end * Math.sin(yaw);
  return h;
})();

/** The roof east of the stranding, in the stranded boat's view. */
const EAST_OF_STRAND: PlacedHouse = {
  x: 14.5, z: -1365.5, yaw: 0.32, len: 10, depth: 6, wall: 3.4, rise: 3.3, sink: 3.3, thatched: false,
  stacks: [-1], stack: 1.5, pots: 1, quiet: true,
};

/**
 * Roofs round the way that are not on it: different sizes, angles and depths of water, so the way reads as picked
 * through a village rather than laid out for her.
 */
export const NEIGHBOURS: PlacedHouse[] = [
  { x: -31, z: -1378, yaw: 0.95, len: 9, depth: 5.6, wall: 3.4, rise: 3.2, sink: 2.4, thatched: true, stacks: [1], stack: 1.3 },
  { x: -27, z: -1421, yaw: -0.15, len: 14, depth: 5.2, wall: 3.4, rise: 3.0, sink: 4.6, thatched: false, stacks: [-1, 1], stack: 1.0 },
  { x: -18, z: -1442, yaw: 0.5, len: 9.5, depth: 5.8, wall: 3.4, rise: 3.4, sink: 2.9, thatched: true, stacks: [-1], stack: 1.6 },
  { x: 7, z: -1399, yaw: -0.55, len: 8.5, depth: 5.2, wall: 3.4, rise: 2.8, sink: 3.1, thatched: false, stacks: [1], stack: 1.2, roll: 0.12 },
  { x: 18, z: -1386, yaw: 0.2, len: 9.5, depth: 5.6, wall: 3.4, rise: 3.1, sink: 4.2, thatched: false, stacks: [-1], stack: 1.4 },
  { x: 25, z: -1431, yaw: 1.42, len: 13, depth: 7.5, wall: 4.4, rise: 3.6, sink: 3.4, thatched: false, stacks: [], stack: 0 },
  { x: -14, z: -1457, yaw: 0.1, len: 16, depth: 5.4, wall: 3.4, rise: 3.0, sink: 3.4, thatched: false, stacks: [-1, 1], stack: 1.2 },
  { x: 28, z: -1450, yaw: 0.75, len: 9, depth: 5.8, wall: 3.4, rise: 3.3, sink: 3.0, thatched: true, stacks: [1], stack: 1.5 },
];

/** The corner of the garden walls across the lane, where the tree comes down. */
const wallFoot = new THREE.Vector2(-10.2, -1409.6);
/** Where the stem rests, along the strand's ridge; she steps out onto the slates beside it and climbs up. */
const STEP_ALONG = -(STRAND_HOUSE.len / 2 - STEP_IN);
/** Across from the ridge to the line of slates just out of the water that she steps out onto. */
const STEP_DOWN = STRAND_HOUSE.depth / 2 - 0.1;
const strandStep = houseLocal(STRAND_HOUSE, STEP_ALONG, STEP_DOWN);
const strandTop = houseLocal(STRAND_HOUSE, STEP_ALONG, 0);
/** Along the slates she steps out onto, either side of the stem: from the gable round to the boat's near side. */
const landingA = houseLocal(STRAND_HOUSE, -(STRAND_HOUSE.len / 2 - 0.9), STEP_DOWN);
const landingB = houseLocal(STRAND_HOUSE, STEP_ALONG + 2.2, STEP_DOWN);
/** The west end of the strand's ridge, over the lane, where she waits for the tree. */
const strandEnd = houseLocal(STRAND_HOUSE, -(STRAND_HOUSE.len / 2 - 0.4), 0);
/** The height of the coping she walks along from the tree to the cottage. */
const COPING = 0.45;
const gardenEave = houseLocal(GARDEN_HOUSE, -3, GARDEN_HOUSE.depth / 2 + OVERHANG);
const gardenRidgeA = houseLocal(GARDEN_HOUSE, -3, 0);
const gardenRidgeB = houseLocal(GARDEN_HOUSE, 1, 0);
const gardenNorth = houseLocal(GARDEN_HOUSE, 1, -GARDEN_HOUSE.depth / 2 - OVERHANG);
const gardenSouthEast = houseLocal(GARDEN_HOUSE, 4.6, GARDEN_HOUSE.depth / 2);
const laneEnd = new THREE.Vector2(-1.5, -1411.4);
const naveEave = NAVE.z + NAVE.depth / 2 + OVERHANG;
/** Where she lands off the swing: a little way up the nave's south slope, under where the swing lets her go. */
const landing = new THREE.Vector2(gardenNorth.x, naveEave - 1.2);
const landingHeight = slatesAt(NAVE, landing.y - NAVE.z);

/** The foot of the tower on the nave's ridge, as high as a child can get: D on the plan. */
export const TOWER_FOOT = new THREE.Vector3(NAVE.x + NAVE.len / 2 - 0.9, ridgeTop(NAVE), NAVE.z);

/** Garden walls round the way and the green, their copings just out of the water. */
export const GARDEN_WALLS: GardenWall[] = [
  { x0: wallFoot.x, z0: wallFoot.y, x1: gardenEave.x, z1: gardenEave.y, top: COPING },
  { x0: wallFoot.x, z0: wallFoot.y, x1: laneEnd.x, z1: laneEnd.y, top: 0.35 },
  { x0: laneEnd.x, z0: laneEnd.y, x1: gardenSouthEast.x, z1: gardenSouthEast.y, top: 0.3, railed: true },
  { x0: -12.5, z0: -1427.5, x1: -6.6, z1: naveEave + 0.6, top: 0.25, railed: true },
  { x0: 8.4, z0: -1424.5, x1: 9.6, z1: naveEave + 0.8, top: 0.3 },
  { x0: 2.5, z0: -1421.5, x1: 8.4, z1: -1424.5, top: 0.2, railed: true },
  { x0: 4.5, z0: -1406, x1: 9, z1: -1419, top: 0.25 },
];

/** The dead tree rotted at its roots in the garden, leaning a little toward the lane it will bridge. */
export const GARDEN_TREE = {
  root: new THREE.Vector3(-9.7, -2.6, -1411),
  /** Toward the end of the strand's ridge, over the corner of the walls: the way it will fall. */
  fall: new THREE.Vector2(strandEnd.x + 9.7, strandEnd.y + 1411).normalize(),
  height: 9,
  lean: 0.1,
};

/** The big old tree on the drowned green, east of where the swing hangs. */
export const GREEN_TREE = new THREE.Vector3(4.6, -3.2, -1428.4);
/** The eave she swings from, and the bough over the green the swing hangs from, just out from it. */
export const SWING_FROM = new THREE.Vector3(gardenNorth.x, eaveAt(GARDEN_HOUSE), gardenNorth.y);
export const SWING_PIVOT = new THREE.Vector3(SWING_FROM.x, 5.65, SWING_FROM.z - 0.9);

/** How far along the cat's ridge its chimney stands from the middle, as the house builder places it. */
const CAT_STACK = CAT_HOUSE.stacks[0] * (CAT_HOUSE.len / 2 - 0.75);

/** The top of the chimney the cat waits on: the rim of its pot. */
export const CAT_CHIMNEY = (() => {
  const top = ridgeTop(CAT_HOUSE) - 0.04 + CAT_HOUSE.stack + 0.58;
  const at = houseLocal(CAT_HOUSE, CAT_STACK, 0);
  return new THREE.Vector3(at.x, top, at.y);
})();

/** The top of a placed slate roof under (x, z), or null off it. */
export function roofUnder(h: PlacedHouse, x: number, z: number): number | null {
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  const dx = x - h.x, dz = z - h.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  if (Math.abs(lx) > h.len / 2 + 0.1 || Math.abs(lz) > h.depth / 2 + OVERHANG) return null;
  return slatesAt(h, lz);
}

/** The cat's roof under (x, z), or the water off it. */
export const catRoof = (x: number, z: number) => roofUnder(CAT_HOUSE, x, z) ?? 0;
/** The roof the becalmed boat comes to rest against, under (x, z), or the water off it. */
export const strandRoof = (x: number, z: number) => roofUnder(STRAND_HOUSE, x, z) ?? 0;

/** A point on the cat's roof `along` its ridge from the middle and `down` its slope toward the boat, on the slates. */
export function onCatRoof(along: number, down: number, out = new THREE.Vector3()): THREE.Vector3 {
  const at = houseLocal(CAT_HOUSE, along, down, TMP2);
  return out.set(at.x, slatesAt(CAT_HOUSE, down), at.y);
}
const TMP2 = new THREE.Vector2();

/** Where on the cat's slope it lands from the chimney: just below the stack, toward the boat. */
export const CAT_LANDING = onCatRoof(CAT_STACK, 0.95);

/** How far across from the cat's ridge its slates go under the water. */
const CAT_WATERLINE = (ridgeTop(CAT_HOUSE) / (ridgeTop(CAT_HOUSE) - eaveAt(CAT_HOUSE))) * (CAT_HOUSE.depth / 2 + OVERHANG);

/**
 * The cat's roof as the tub meets it: its middle, half its length and how far across from the ridge the tub comes up
 * against the slates (where they go under), and its heading (the house's yaw). The slope toward the boat runs along
 * +z, from -`len` to +`len` along x.
 */
export const CAT_ROOF = {
  x: CAT_HOUSE.x, z: CAT_HOUSE.z, yaw: CAT_HOUSE.yaw, len: CAT_HOUSE.len / 2 + 0.11, depth: CAT_WATERLINE + 0.1,
};

/**
 * The wash-tub: where it floats when the boat comes, and the water it is kept to (a middle and a reach), between the
 * boat's bow and the cat's slates.
 */
export const TUB_START = houseLocal(CAT_HOUSE, -2.6, CAT_ROOF.depth + 3.4);
export const TUB_WATER = (() => {
  const mid = houseLocal(CAT_HOUSE, 0, CAT_ROOF.depth + 3);
  return { x: mid.x, z: mid.y, r: 5 };
})();

/** The slates' edge below the chimney, which the boat comes round to face. */
export const CAT_EAVES = (() => {
  const at = houseLocal(CAT_HOUSE, CAT_STACK * 0.5, CAT_ROOF.depth);
  return new THREE.Vector3(at.x, 0, at.y);
})();

/** A step from one walkable surface to the next across water: `from` the near end, `to` the far. */
export interface WayGap {
  name: 'tree' | 'swing';
  from: THREE.Vector3;
  to: THREE.Vector3;
}

/**
 * The way over the roofs, in walking order. Slopes are decks whose height runs from `height` at their first end to
 * `height1` at their second. `strandLanding` is the line of slates by the boat's stem she alights onto (level, as a
 * step out of a boat needs); `strandSlope` is the whole slope above it, up to `strand`, the ridge; `naveRidge` ends
 * at the tower's foot.
 */
export const WAY = {
  strandLanding: { x0: landingA.x, z0: landingA.y, x1: landingB.x, z1: landingB.y, halfWidth: 0.25,
    height: slatesAt(STRAND_HOUSE, STEP_DOWN) },
  strandSlope: { x0: strandStep.x, z0: strandStep.y, x1: strandTop.x, z1: strandTop.y, halfWidth: 2.2,
    height: slatesAt(STRAND_HOUSE, STEP_DOWN), height1: ridgeTop(STRAND_HOUSE) },
  strand: { x0: strandTop.x, z0: strandTop.y, x1: strandEnd.x, z1: strandEnd.y, halfWidth: 0.45, height: ridgeTop(STRAND_HOUSE) },
  gardenWall: { x0: wallFoot.x, z0: wallFoot.y, x1: gardenEave.x, z1: gardenEave.y, halfWidth: 0.3, height: COPING },
  gardenSlope: { x0: gardenEave.x, z0: gardenEave.y, x1: gardenRidgeA.x, z1: gardenRidgeA.y, halfWidth: 0.7,
    height: eaveAt(GARDEN_HOUSE), height1: ridgeTop(GARDEN_HOUSE) },
  gardenRidge: { x0: gardenRidgeA.x, z0: gardenRidgeA.y, x1: gardenRidgeB.x, z1: gardenRidgeB.y, halfWidth: 0.45,
    height: ridgeTop(GARDEN_HOUSE) },
  gardenNorth: { x0: gardenRidgeB.x, z0: gardenRidgeB.y, x1: gardenNorth.x, z1: gardenNorth.y, halfWidth: 0.7,
    height: ridgeTop(GARDEN_HOUSE), height1: eaveAt(GARDEN_HOUSE) },
  naveSlope: { x0: landing.x, z0: landing.y, x1: landing.x, z1: NAVE.z, halfWidth: 0.9,
    height: landingHeight, height1: ridgeTop(NAVE) },
  naveRidge: { x0: landing.x, z0: NAVE.z, x1: TOWER_FOOT.x, z1: NAVE.z, halfWidth: 0.45, height: ridgeTop(NAVE) },
} satisfies Record<string, Deck>;

/** Where she has to be helped across: the lane by the tree, the green by the swing. */
export const WAY_GAPS: WayGap[] = [
  { name: 'tree', from: new THREE.Vector3(strandEnd.x, ridgeTop(STRAND_HOUSE), strandEnd.y), to: new THREE.Vector3(wallFoot.x, COPING, wallFoot.y) },
  { name: 'swing', from: SWING_FROM.clone(), to: new THREE.Vector3(landing.x, landingHeight, landing.y) },
];

/**
 * The line the dark comes on along: from far out where they came from, through the stranding and on over the way
 * to the tower. The dark's reach is measured along it in metres.
 */
export const DARK_WAY: THREE.Vector2[] = [
  new THREE.Vector2(STRAND.x + 138, STRAND.y + 197),
  STRAND.clone(),
  strandEnd.clone(),
  wallFoot.clone(),
  gardenEave.clone(),
  gardenNorth.clone(),
  landing.clone(),
  new THREE.Vector2(TOWER_FOOT.x, TOWER_FOOT.z),
];

/** How far along `DARK_WAY` the stranded boat lies. */
export const DARK_AT_STRAND = DARK_WAY[0].distanceTo(DARK_WAY[1]);

/** The point `reach` metres along `DARK_WAY`. */
export function darkWayPoint(reach: number, out: THREE.Vector2): THREE.Vector2 {
  let left = reach;
  for (let i = 0; i < DARK_WAY.length - 1; i++) {
    const a = DARK_WAY[i], b = DARK_WAY[i + 1], len = a.distanceTo(b);
    if (left <= len || i === DARK_WAY.length - 2) return out.lerpVectors(a, b, THREE.MathUtils.clamp(left / len, 0, 1));
    left -= len;
  }
  return out.copy(DARK_WAY[0]);
}

/** The placed roofs other than the cat's. */
export const PLACED: PlacedHouse[] = [STRAND_HOUSE, GARDEN_HOUSE, EAST_OF_STRAND, ...NEIGHBOURS];

/** Where the lens stands while the tub is brought over: off the chimney's gable end, low over the water. */
export const CAT_LENS = (() => {
  const a = Math.atan2(-CAT_TOWARD.x, -CAT_TOWARD.y) - CAT_LENS_TURN;
  return new THREE.Vector2(CAT_CHIMNEY.x + Math.sin(a) * CAT_LENS_OFF, CAT_CHIMNEY.z + Math.cos(a) * CAT_LENS_OFF);
})();

/**
 * Places the generated village keeps clear of: every placed house with room round it, the garden, the green, the
 * church, and the water the drift crosses to the stranding.
 */
export const CLEARINGS: { x: number; z: number; r: number }[] = [
  ...[...PLACED, NAVE].map((h) => ({ x: h.x, z: h.z, r: h.len / 2 + 4 })),
  { x: wallFoot.x + 4, z: wallFoot.y - 4, r: 8 },
  { x: GREEN_TREE.x - 2, z: GREEN_TREE.z, r: 10 },
  { x: EAST_OF_STRAND.x - 9, z: EAST_OF_STRAND.z - 3, r: 8 },
  { x: -3, z: -1376, r: 9 },
  { x: -7, z: -1388, r: 8 },
  { x: 4, z: -1446, r: 9 },
  /** Where the lens stands beside the stranded boat. */
  { x: -23, z: -1400, r: 8 },
];

/**
 * The cat's roof, the water the tub crosses and the lens watching it. The generated village is laid out without
 * them, so every other roof and tree stands where it always has, and whatever of it falls here is left unbuilt.
 */
const CAT_GROUND = [
  { x: -2.5, z: -1336.5, r: 13 },
  { x: CAT_HOUSE.x, z: CAT_HOUSE.z, r: CAT_HOUSE.len / 2 + 4 },
  { x: -8.75, z: -1333.75, r: 8.5 },
  { x: TUB_WATER.x, z: TUB_WATER.z, r: TUB_WATER.r + 2 },
  { x: -12.78, z: -1321.4, r: 1 },
  { x: CAT_LENS.x, z: CAT_LENS.y, r: 1 },
];
export const onCatGround = (x: number, z: number, room: number) =>
  CAT_GROUND.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + room);

export const inClearing = (x: number, z: number, room: number) =>
  CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + room);

import * as THREE from 'three';
import type { Deck } from './decks';

/**
 * The neighbourhood round the church, laid by hand among the generated village, and the way over its roofs from
 * where the boat strands to the foot of the tower. Every height here is at the old water level: when the sea draws
 * back the village rises out of it by the village's `rise`, and so does everything on it.
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
  /** Which ends of the ridge carry a chimney, along local x (-1, 1). */
  stacks: number[];
  /** How far the chimney stands above the ridge. */
  stack: number;
  /** The side a ground-floor door is on, along local z, or 0 for none. */
  door: number;
  roll?: number;
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

/** Up the channel, north by west: the way the drift comes into the stranding. */
const CHANNEL = new THREE.Vector2(-0.4472, -0.8944);

/** Where the hull comes to rest as the air dies, and the way it lies there. */
export const STRAND = new THREE.Vector2(-9, -1398);
export const STRAND_YAW = Math.atan2(CHANNEL.x, CHANNEL.y);

/**
 * The roof the boat strands on: a long one with no chimney, its ridge lying along the channel just under the glass,
 * so the hull glides in over it unseen and the slates come up under the keel.
 */
export const STRAND_HOUSE: PlacedHouse = {
  x: STRAND.x + CHANNEL.x * 2.2, z: STRAND.y + CHANNEL.y * 2.2, yaw: Math.atan2(-CHANNEL.y, CHANNEL.x),
  len: 12, depth: 5.4, wall: 3.4, rise: 2.6, sink: 6.64, thatched: false, stacks: [], stack: 0, door: 0,
};

/** The cottage across the lane, its garden walled down to the water; the way goes up its south slope and over. */
export const GARDEN_HOUSE: PlacedHouse = {
  x: -3, z: -1423.2, yaw: -0.15, len: 10, depth: 6, wall: 3.4, rise: 2.5, sink: 3.7, thatched: false,
  stacks: [1], stack: 1.3, door: 1,
};

/** The church's nave, joined to the tower's west face, its ridge running east to the tower's foot. */
export const NAVE: PlacedHouse = {
  x: 3.1, z: -1436, yaw: 0, len: 17, depth: 7.6, wall: 3.2, rise: 3.2, sink: 3.6, thatched: false, stacks: [], stack: 0, door: 0,
};

/** The roof the cat is stranded on, just off the channel before the stranding (roof A on the plan). */
export const CAT_HOUSE: PlacedHouse = {
  x: 14.5, z: -1365.5, yaw: 0.32, len: 10, depth: 6, wall: 3.4, rise: 3.3, sink: 3.3, thatched: false,
  stacks: [-1], stack: 1.5, door: 0,
};

/**
 * Roofs round the way that are not on it: different sizes, angles and depths of water, so the way reads as picked
 * through a village rather than laid out for her.
 */
export const NEIGHBOURS: PlacedHouse[] = [
  { x: -31, z: -1378, yaw: 0.95, len: 9, depth: 5.6, wall: 3.4, rise: 3.2, sink: 2.4, thatched: true, stacks: [1], stack: 1.3, door: -1 },
  { x: -27, z: -1421, yaw: -0.15, len: 14, depth: 5.2, wall: 3.4, rise: 3.0, sink: 4.6, thatched: false, stacks: [-1, 1], stack: 1.0, door: 0 },
  { x: -18, z: -1442, yaw: 0.5, len: 9.5, depth: 5.8, wall: 3.4, rise: 3.4, sink: 2.9, thatched: true, stacks: [-1], stack: 1.6, door: 1 },
  { x: 7, z: -1399, yaw: -0.55, len: 8.5, depth: 5.2, wall: 3.4, rise: 2.8, sink: 3.1, thatched: false, stacks: [1], stack: 1.2, door: -1, roll: 0.12 },
  { x: 18, z: -1386, yaw: 0.2, len: 9.5, depth: 5.6, wall: 3.4, rise: 3.1, sink: 4.2, thatched: false, stacks: [-1], stack: 1.4, door: 1 },
  { x: 25, z: -1431, yaw: 1.42, len: 13, depth: 7.5, wall: 4.4, rise: 3.6, sink: 3.4, thatched: false, stacks: [], stack: 0, door: 1 },
  { x: -14, z: -1457, yaw: 0.1, len: 16, depth: 5.4, wall: 3.4, rise: 3.0, sink: 3.4, thatched: false, stacks: [-1, 1], stack: 1.2, door: 1 },
  { x: 28, z: -1450, yaw: 0.75, len: 9, depth: 5.8, wall: 3.4, rise: 3.3, sink: 3.0, thatched: true, stacks: [1], stack: 1.5, door: -1 },
];

/** Just past the stranded bow, where she climbs out onto the ridge. */
const strandBow = houseLocal(STRAND_HOUSE, 0.4, 0);
/** The far end of the strand's ridge, over the lane, where she waits for the tree. */
const strandEnd = houseLocal(STRAND_HOUSE, STRAND_HOUSE.len / 2 - 0.5, 0);
/** The corner of the garden walls across the lane, where the tree comes down. */
const wallFoot = new THREE.Vector2(-10.2, -1409.6);
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

/** Garden walls round the way and the green; their copings break the surface once the water goes. */
export const GARDEN_WALLS: GardenWall[] = [
  { x0: wallFoot.x, z0: wallFoot.y, x1: gardenEave.x, z1: gardenEave.y, top: -0.3 },
  { x0: wallFoot.x, z0: wallFoot.y, x1: laneEnd.x, z1: laneEnd.y, top: -0.45 },
  { x0: laneEnd.x, z0: laneEnd.y, x1: gardenSouthEast.x, z1: gardenSouthEast.y, top: -0.5, railed: true },
  { x0: -12.5, z0: -1427.5, x1: -6.6, z1: naveEave + 0.6, top: -0.55, railed: true },
  { x0: 8.4, z0: -1424.5, x1: 9.6, z1: naveEave + 0.8, top: -0.6 },
  { x0: 2.5, z0: -1421.5, x1: 8.4, z1: -1424.5, top: -0.65, railed: true },
  { x0: 4.5, z0: -1406, x1: 9, z1: -1419, top: -0.7 },
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

/** The top of the chimney the cat waits on: the rim of its pot. */
export const CAT_CHIMNEY = (() => {
  const top = ridgeTop(CAT_HOUSE) - 0.04 + CAT_HOUSE.stack + 0.58;
  const at = houseLocal(CAT_HOUSE, -(CAT_HOUSE.len / 2 - 0.75), 0);
  return new THREE.Vector3(at.x, top, at.y);
})();

/** A step from one walkable surface to the next across water: `from` the near end, `to` the far. */
export interface WayGap {
  name: 'tree' | 'swing';
  from: THREE.Vector3;
  to: THREE.Vector3;
}

/**
 * The way over the roofs, in walking order. Slopes are decks whose height runs from `height` at their first end to
 * `height1` at their second. `strand` is the ridge beyond the stranded bow (she alights onto it); `naveRidge` ends
 * at the tower's foot.
 */
export const WAY = {
  strand: { x0: strandBow.x, z0: strandBow.y, x1: strandEnd.x, z1: strandEnd.y, halfWidth: 0.45, height: ridgeTop(STRAND_HOUSE) },
  gardenWall: { x0: wallFoot.x, z0: wallFoot.y, x1: gardenEave.x, z1: gardenEave.y, halfWidth: 0.3, height: -0.3 },
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
  { name: 'tree', from: new THREE.Vector3(strandEnd.x, ridgeTop(STRAND_HOUSE), strandEnd.y), to: new THREE.Vector3(wallFoot.x, -0.3, wallFoot.y) },
  { name: 'swing', from: SWING_FROM.clone(), to: new THREE.Vector3(landing.x, landingHeight, landing.y) },
];

/** The way's decks as they stand with the village risen `rise` metres out of the water. */
export function wayDecks(rise: number, out: Deck[] = []): Deck[] {
  out.length = 0;
  for (const d of Object.values(WAY) as Deck[]) {
    out.push({ ...d, height: d.height + rise, height1: d.height1 === undefined ? undefined : d.height1 + rise });
  }
  return out;
}

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

export const PLACED: PlacedHouse[] = [STRAND_HOUSE, GARDEN_HOUSE, CAT_HOUSE, ...NEIGHBOURS];

/**
 * Places the generated village keeps clear of: every placed house with room round it, the garden, the green, the
 * church, and the water the drift crosses from the cat's roof to the stranding.
 */
export const CLEARINGS: { x: number; z: number; r: number }[] = [
  ...[...PLACED, NAVE].map((h) => ({ x: h.x, z: h.z, r: h.len / 2 + 4 })),
  { x: wallFoot.x + 4, z: wallFoot.y - 4, r: 8 },
  { x: GREEN_TREE.x - 2, z: GREEN_TREE.z, r: 10 },
  { x: CAT_HOUSE.x - 9, z: CAT_HOUSE.z - 3, r: 8 },
  { x: -3, z: -1376, r: 9 },
  { x: -7, z: -1388, r: 8 },
  { x: 4, z: -1446, r: 9 },
  /** Where the lens stands beside the stranded boat. */
  { x: -23, z: -1400, r: 8 },
];

export const inClearing = (x: number, z: number, room: number) =>
  CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + room);

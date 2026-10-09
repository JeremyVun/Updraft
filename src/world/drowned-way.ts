import * as THREE from 'three';
import type { Deck } from './decks';
import type { TreeSpot } from './crossings/topple-tree';
import type { TreeWay } from './crossings/tree-crossing';
import type { SwingSpot } from './crossings/rope-swing';
import type { SwingWay } from './crossings/swing-crossing';
import type { HouseType } from './drowned-houses';
import { tuning } from '../tuning';
import { HOIST, HUB_ABOVE, SAIL, type MillSpot } from './crossings/windmill';
import { BELFRY } from './belfry';
import { SHEET_OFF, SHEET_WAIT, sheetLine, type SheetWay } from './crossings/sheet-crossing';
import type { SheetSpot } from './crossings/wash-sheet';

/**
 * Her way over the roofs, laid by hand among the generated village: from the roof the becalmed boat runs aground on,
 * up the fallen tree onto a barn, along it and up the sheet's line to a higher roof, on to the drowned mill and up its
 * hoist, down onto the green cottage and its swing, over onto the nave to the foot of the church's tower by the
 * lighthouse. Every piece takes her higher than she was.
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
  /** Off her way, one of the kit's houses with more character than her plain roofs. */
  look?: HouseType;
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

/**
 * A lean-to against a house's long side, `side` +1 or -1 of its local z, from `from` to `to` along its local x: its
 * roof falls `out` metres from the wall, from `high` where it meets the wall to `low` at its eaves.
 */
export interface LeanTo {
  house: PlacedHouse;
  side: number;
  from: number;
  to: number;
  out: number;
  high: number;
  low: number;
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
export const OVERHANG = 0.28;
/** The height of a slate roof `lz` across from its ridge. */
const slatesAt = (h: PlacedHouse, lz: number) =>
  THREE.MathUtils.lerp(ridgeTop(h), eaveAt(h), Math.min(1, Math.abs(lz) / (h.depth / 2 + OVERHANG)));
/** On a placed roof's slates, `along` its ridge from the middle and `across` from it toward its local +z. */
const onRoof = (h: PlacedHouse, along: number, across: number) => {
  const at = houseLocal(h, along, across);
  return new THREE.Vector3(at.x, slatesAt(h, across), at.y);
};
/** How far across from the ridge a roof's slates stand `y` out of the water. */
const acrossAt = (h: PlacedHouse, y: number) => ((ridgeTop(h) - y) / (ridgeTop(h) - eaveAt(h))) * (h.depth / 2 + OVERHANG);
/** A house sunk until its ridge stands `ridge` out of the water, with `at` (local along, across) put at `where`. */
function sunk(h: Omit<PlacedHouse, 'x' | 'z' | 'sink'>, ridge: number, where?: { along: number; across: number; at: THREE.Vector2 | THREE.Vector3 }): PlacedHouse {
  const placed: PlacedHouse = { ...h, x: 0, z: 0, sink: h.wall + h.rise + 0.04 - ridge };
  if (where) {
    const off = houseLocal(placed, where.along, where.across);
    placed.x = where.at.x - off.x;
    placed.z = ('z' in where.at ? where.at.z : where.at.y) - off.y;
  }
  return placed;
}
/** How far either side of a ridge's line she is on it: off it, she is on the slates. */
const RIDGE = 0.2;
/** A walkable strip from `a` to `b`, at their heights. */
const strip = (a: THREE.Vector3, b: THREE.Vector3, halfWidth: number): Deck =>
  a.y === b.y ? { x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth, height: a.y }
    : { x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth, height: a.y, height1: b.y };
/** `len` metres on from `from` the way `bearing` (atan2(x, z)) points, at height `y`. */
const onFrom = (from: THREE.Vector3 | THREE.Vector2, bearing: number, len: number, y: number) =>
  new THREE.Vector3(from.x + Math.sin(bearing) * len, y, ('z' in from ? from.z : from.y) + Math.cos(bearing) * len);
/** A garden wall's coping from `a` to `b`, at `a`'s height. */
const coping = (a: THREE.Vector3, b: THREE.Vector3, railed = false): GardenWall => ({ x0: a.x, z0: a.z, x1: b.x, z1: b.z, top: a.y, railed });

const COPING = 0.45;
/** Railings standing out of the water on drowned walls: their wall's top, and how far they stand above it. */
const RAILINGS_TOP = -0.3;
export const RAILING_RISE = 0.88;

/**
 * The church by the lighthouse: the nave's ridge runs east to the tower's foot, the end of her way. The green lies
 * south of it, a clearing of water; the cottage on its far side has the swing hanging by its west gable end from the
 * old tree's bough, so the back-swing passes the end of the house, and she lets go over the nave's slope.
 */
export const NAVE: PlacedHouse = {
  x: 6.5, z: -1561, yaw: 0, len: 17, depth: 7.6, wall: 3.2, rise: 3.2, sink: 3.6, thatched: false, stacks: [], stack: 0,
};
/** The foot of the tower on the nave's ridge, as high as a child can get. */
export const TOWER_FOOT = new THREE.Vector3(NAVE.x + NAVE.len / 2 - 0.9, ridgeTop(NAVE), NAVE.z);
const SWING_X = NAVE.x + NAVE.len / 2 - 3.5;
const LANDING_Z = NAVE.z + 2.88;
const GREEN_NORTH = LANDING_Z + 6.8;
export const GREEN_HOUSE: PlacedHouse = { ...sunk({ yaw: 0, len: 9, depth: 6, wall: 3.4, rise: 2.5, thatched: false, stacks: [-0.55], stack: 1.1 }, 2.99),
  x: SWING_X + 1.05 + 4.5, z: GREEN_NORTH + 3.28 };
const BOARD = new THREE.Vector3(GREEN_HOUSE.x - 4.42, eaveAt(GREEN_HOUSE), GREEN_NORTH + 0.12);
const LANDING = new THREE.Vector3(SWING_X, slatesAt(NAVE, LANDING_Z - NAVE.z), LANDING_Z);
/** The old tree on the green, off the cottage's corner beyond the swing, its bough out over the water to the ropes. */
export const GREEN_TREE = new THREE.Vector3(SWING_X - 4.65, -3.2, GREEN_HOUSE.z + 3.28 + 0.95);
/** The tower's south face, where the churchyard's railings run up to it from the green. */
const TOWER_SOUTH = NAVE.z + 2.45;
const GREEN_EAST = onRoof(GREEN_HOUSE, GREEN_HOUSE.len / 2 - 0.15, 0);

/**
 * The drowned mill, standing in the water up to its shoulders south-east of the green, its sails facing the way she
 * comes: laid out as its yard is (`mill-yard.ts`), in its own frame (`atMill`: x to the right seen from in front, z out
 * of the front). Her roof, a cottage nearly gone under, runs in under the sails to the basket waiting at the end of its
 * ridge; the hoist lifts her the mill's whole height to the granary behind it, whose ridge is level with the hoist's
 * top. Off the granary's west slope a lean-to comes down onto the green cottage's ridge at its east gable.
 */
const MILL_FROM = 1.2;
const MILL_TO = MILL_FROM + 5.2;
const GRANARY = { len: 8.45, depth: 3.8, rise: 2.2 };
const LEAN_OUT = 1.2;
export const MILL = {
  hub: new THREE.Vector3(GREEN_EAST.x + 0.26 + LEAN_OUT + GRANARY.depth / 2 - HOIST.x, MILL_FROM + 5.2 + HUB_ABOVE, GREEN_EAST.z + 8.9),
  facing: 0,
  /** Nothing stands within this of the hub in the sails' plane, a hand's breadth beyond the sweep. */
  reach: SAIL.reach + 0.05,
  waitTop: MILL_FROM, offRidge: MILL_TO,
};
function atMill(x: number, z: number, y: number): THREE.Vector3 {
  const c = Math.cos(MILL.facing), s = Math.sin(MILL.facing);
  return new THREE.Vector3(MILL.hub.x + x * c + z * s, y, MILL.hub.z - x * s + z * c);
}
/** In a house's own frame (along its length, across from its ridge), where a point of the world is. */
function localOf(h: PlacedHouse, p: THREE.Vector3 | THREE.Vector2): THREE.Vector2 {
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  const dx = p.x - h.x, dz = ('z' in p ? p.z : p.y) - h.z;
  return new THREE.Vector2(dx * c - dz * s, dx * s + dz * c);
}
/** A house laid along the mill's frame, its ridge on the hoist's line, its middle `z` out in front of the sails. */
const onHoistLine = (h: Omit<PlacedHouse, 'x' | 'z' | 'sink' | 'yaw'>, ridge: number, z: number): PlacedHouse => {
  const at = atMill(HOIST.x, z, 0);
  return { ...sunk({ ...h, yaw: MILL.facing - Math.PI / 2 }, ridge), x: at.x, z: at.z };
};
/** Her roof: its ridge runs in along the hoist's line from out in front of the sails to the basket, like the yard's. */
const MILL_LOW = onHoistLine({ len: 8.2, depth: 4.2, wall: 3.4, rise: 2.4, thatched: false, stacks: [-2.45 / (8.2 / 2 - 0.75)], stack: 1.52, pots: 1 },
  MILL_FROM, 2.9);
/** The granary behind the mill, its gable to the basket, its ridge level with the hoist's top. */
const GRANARY_HOUSE = onHoistLine({ len: GRANARY.len, depth: GRANARY.depth, wall: 7.4, rise: GRANARY.rise, thatched: false, stacks: [], stack: 0 },
  MILL_TO, -6.9);
/** The cat's way up: the chimney on her roof just in front of the sails' plane, under the low sail's end; the rim of its pot. */
export const MILL_CHIMNEY = (() => {
  const at = houseLocal(MILL_LOW, MILL_LOW.stacks[0] * (MILL_LOW.len / 2 - 0.75), 0);
  return new THREE.Vector3(at.x, ridgeTop(MILL_LOW) - 0.08 + MILL_LOW.stack + 0.58, at.y);
})();
const MILL_WAIT = atMill(HOIST.x, -0.85, MILL_FROM);
const MILL_OFF = atMill(HOIST.x, -3.0, MILL_TO);
const MILL_ONWARD = atMill(HOIST.x, -4.4, MILL_TO);
/** Down off the granary's ridge on its west side, at the green cottage's ridge line, onto the lean-to. */
const GRANARY_DOWN = localOf(GRANARY_HOUSE, GREEN_EAST).x;
const GRANARY_LEAN: LeanTo = { house: GRANARY_HOUSE, side: 1, from: GRANARY_DOWN - 1.3, to: GRANARY_DOWN + 1.3, out: LEAN_OUT,
  high: eaveAt(GRANARY_HOUSE) - 0.05, low: GREEN_EAST.y + 0.06 };
/** The top of her way, on the granary's ridge where she turns down off it, from where she looks back down at the fog. */
export const GRANARY_TOP = onRoof(GRANARY_HOUSE, GRANARY_DOWN, 0);
const GRANARY_EAVE = onRoof(GRANARY_HOUSE, GRANARY_DOWN, GRANARY.depth / 2 + 0.2);
const LEAN_FOOT = (() => {
  const at = houseLocal(GRANARY_HOUSE, GRANARY_DOWN, GRANARY.depth / 2 + LEAN_OUT - 0.05);
  return new THREE.Vector3(at.x, GRANARY_LEAN.low, at.y);
})();

/**
 * Her own way to the mill: down off the sheet's high roof just past where it sets her down and a hop onto a garden
 * wall, north along the wall and its dogleg east to her roof beside the basket, and up its slates to the ridge.
 */
const LOW_ON = -3.2;
const MILL_FOOT = onRoof(MILL_LOW, LOW_ON, acrossAt(MILL_LOW, COPING));
/** The way the lanes there run, about north, and across them, about east. */
const NORTH = Math.PI - 0.08;
const EAST = NORTH - Math.PI / 2;
const W3_TURN = onFrom(MILL_FOOT, EAST, -2.6, COPING);
const W3_LENGTH = 8.5;
const W3_CORNER = onFrom(W3_TURN, NORTH, -W3_LENGTH, COPING);
/** How far west of the mill's way in the wall runs from the sheet's high roof, leaving open water in front of the sails. */
const W3_ACROSS = 7;
const W3_FROM = onFrom(W3_CORNER, EAST, -W3_ACROSS, COPING);

/**
 * The sheet's high roof, a ridge `SHEET_RISE` above the barn's across the lane: she comes down its east slope just past
 * where the sheet sets her down, short of its chimney, a hop from the wall.
 */
const SHEET_LANE = 4.0;
const SHEET_RISE = 1.3;
const BARN_RIDGE = 2.25;
const HIGH_LANE: PlacedHouse = (() => {
  const len = 9.4, depth = 5.0;
  const h = sunk({ yaw: Math.atan2(-Math.cos(NORTH), Math.sin(NORTH)) + 0.03, len, depth, wall: 3.4, rise: 2.6, thatched: false,
    stacks: [(-len / 2 + 2.3) / (len / 2 - 0.75)], stack: 1.37, pots: 1 }, BARN_RIDGE + SHEET_RISE);
  const off = houseLocal({ ...h, x: 0, z: 0 }, -len / 2 + 1.2, depth / 2 + OVERHANG + 0.75);
  return { ...h, x: W3_FROM.x - off.x, z: W3_FROM.z - off.y };
})();
const LANE_ON = -HIGH_LANE.len / 2 + 1.2;
const LANE_TOP = onRoof(HIGH_LANE, LANE_ON, 0);
const LANE_EAVE = onRoof(HIGH_LANE, LANE_ON, HIGH_LANE.depth / 2 + 0.12);

/**
 * The sheet: from the barn's north gable a washing line runs from its chimney over a lane to the high roof's chimney;
 * the cat runs the line first.
 */
const SHEET_ALONG = new THREE.Vector2(Math.cos(HIGH_LANE.yaw), -Math.sin(HIGH_LANE.yaw));
const LANE_GABLE = onRoof(HIGH_LANE, -HIGH_LANE.len / 2, 0);
const SHEET_EDGE = new THREE.Vector3(LANE_GABLE.x - SHEET_ALONG.x * SHEET_LANE, BARN_RIDGE, LANE_GABLE.z - SHEET_ALONG.y * SHEET_LANE);
/**
 * The barn across the lane from it, the tree coming down across its ridge between its chimney and its north gable, so
 * she steps off the trunk where the sheet waits for her.
 */
const BARN_LEN = 10.5;
const BARN_REST = 1.35;
const BARN: PlacedHouse = (() => {
  const h = sunk({ yaw: HIGH_LANE.yaw - 0.03, len: BARN_LEN, depth: 5.2, wall: 3.4, rise: 2.6, thatched: false,
    stacks: [(BARN_LEN / 2 - 2.4) / (BARN_LEN / 2 - 0.75)], stack: 1.37, pots: 1 }, BARN_RIDGE);
  const off = houseLocal({ ...h, x: 0, z: 0 }, BARN_LEN / 2, 0);
  return { ...h, x: SHEET_EDGE.x - off.x, z: SHEET_EDGE.z - off.y };
})();
/** Where each chimney's cap is, for the line's props. */
const capOf = (h: PlacedHouse, i: number) => {
  const at = houseLocal(h, h.stacks[i] * (h.len / 2 - 0.75), 0);
  return new THREE.Vector3(at.x, ridgeTop(h) + 0.08 + h.stack, at.y);
};
export const SHEET_SITE = (() => {
  const back = BARN.len / 2 - BARN.stacks[0] * (BARN.len / 2 - 0.75);
  const beyond = HIGH_LANE.stacks[0] * (HIGH_LANE.len / 2 - 0.75) + HIGH_LANE.len / 2;
  const line = sheetLine(SHEET_EDGE, SHEET_ALONG, SHEET_LANE, ridgeTop(HIGH_LANE), back, beyond);
  const caps = [capOf(BARN, 0), capOf(HIGH_LANE, 0)];
  const prop = (cap: THREE.Vector3) => cap.clone().add(new THREE.Vector3(-SHEET_ALONG.y * 0.3, 0, SHEET_ALONG.x * 0.3));
  const on = (u: number, y: number) => new THREE.Vector3(SHEET_EDGE.x + SHEET_ALONG.x * u, y, SHEET_EDGE.z + SHEET_ALONG.y * u);
  return {
    spot: { from: line.from, to: line.to, start: line.start, stop: line.stop, props: caps.map(prop) } satisfies SheetSpot,
    way: { wait: on(SHEET_WAIT, ridgeTop(BARN)), stepOff: on(SHEET_LANE + SHEET_OFF, ridgeTop(HIGH_LANE)), onward: LANE_TOP } satisfies SheetWay,
    caps,
  };
})();

/**
 * The dead tree in a walled garden across the lane from the barn: it falls east, square across the lane, onto the
 * barn's ridge near its north end. She waits on the garden's wall just past where it will come down across it, and
 * steps back onto the trunk and walks up it onto the barn.
 */
const FALL = new THREE.Vector2(Math.sin(EAST), Math.cos(EAST));
const TREE_LANE = 6.7;
const TREE_REST = onRoof(BARN, BARN_LEN / 2 - BARN_REST, 0);
const OVER = new THREE.Vector3(TREE_REST.x - FALL.x * TREE_LANE, COPING, TREE_REST.z - FALL.y * TREE_LANE);
const TREE_ROOT = new THREE.Vector3(OVER.x - FALL.x * 2.4, -0.15, OVER.z - FALL.y * 2.4);
const TREE_WAIT = onFrom(OVER, NORTH, 1.35, COPING);
const TREE_OFF = onRoof(BARN, BARN_LEN / 2 - BARN_REST + 0.55, 0);
const W1_END = onFrom(OVER, NORTH, 2.4, COPING);
/** The garden wall she comes north along, beside the lane, from the first roof. */
const W1_LENGTH = 16;
const W1_FROM = onFrom(OVER, NORTH, -W1_LENGTH, COPING);
/** Just down on it from the first roof, where she stops and looks back at the boat as the fog takes it. */
export const LOOK_BACK = onFrom(W1_FROM, NORTH, 0.4, COPING);

/** Where the drift comes from as it nears the stranding: the channel's third point. */
const DRIFT_FROM = new THREE.Vector2(4, -1372);
/** The way the hull lies once it has run aground: up the drift, swung a little off it as it lost its way. */
export const STRAND_YAW = Math.PI - 0.12;
/** How far ahead of the hull's middle its stem meets the water. */
const STEM = 2.1;
/** How far in from the first roof's west gable the stem comes to rest. */
const STEP_IN = 2.2;

/**
 * The first roof, the one the boat runs aground on and the cat leaps onto: a cottage nearly gone under, lying across
 * the drift south of the garden, its slates going on down under the glass ahead of the stem, so the hull rides up onto
 * them and she can step out onto those still out of the water and climb its ridge. Its ridge's east end is a hop from
 * the garden wall's foot.
 */
export const STRAND_HOUSE: PlacedHouse = (() => {
  const h: PlacedHouse = { x: 0, z: 0, yaw: -0.22, len: 8.4, depth: 4.6, wall: 3.4, rise: 2.5, sink: 0, thatched: false,
    stacks: [-1], stack: 0.9, gable: -1, stone: true };
  h.sink = h.wall + h.rise + 0.04 - 1.45;
  const along = new THREE.Vector2(Math.cos(h.yaw), -Math.sin(h.yaw));
  const end = new THREE.Vector2(W1_FROM.x - along.x * 0.9, W1_FROM.z - along.y * 0.9);
  h.x = end.x - along.x * (h.len / 2 - 0.35);
  h.z = end.y - along.y * (h.len / 2 - 0.35);
  return h;
})();
/** Where the hull comes to rest as the air dies, its stem on the first roof's slates where they meet the water. */
export const STRAND = (() => {
  const h = STRAND_HOUSE;
  const waterline = (ridgeTop(h) / (ridgeTop(h) - eaveAt(h))) * (h.depth / 2 + OVERHANG);
  const touch = houseLocal(h, -(h.len / 2 - STEP_IN), waterline);
  return new THREE.Vector2(touch.x - Math.sin(STRAND_YAW) * STEM, touch.y - Math.cos(STRAND_YAW) * STEM);
})();
/** The drift's last leg: from the channel's third point to where it strands, and the open water the village leaves it. */
export const STRAND_FROM = DRIFT_FROM;
const DRIFT_ROOM = 8;

/** Where she steps out onto the first roof's slates by the stem, its ridge above, and the ridge's east end. */
const STEP_ALONG = -(STRAND_HOUSE.len / 2 - STEP_IN);
const STEP_DOWN = acrossAt(STRAND_HOUSE, 0.22);
const strandStep = houseLocal(STRAND_HOUSE, STEP_ALONG, STEP_DOWN);
const strandTop = houseLocal(STRAND_HOUSE, STEP_ALONG, 0);
const landingA = houseLocal(STRAND_HOUSE, -(STRAND_HOUSE.len / 2 - 0.9), STEP_DOWN);
const landingB = houseLocal(STRAND_HOUSE, STEP_ALONG + 2.4, STEP_DOWN);
const strandEnd = houseLocal(STRAND_HOUSE, STRAND_HOUSE.len / 2 - 0.35, 0);
const RIDGE_END = new THREE.Vector3(strandEnd.x, ridgeTop(STRAND_HOUSE), strandEnd.y);

/**
 * Roofs round the way that are not on it: different sizes, angles and depths of water, so the way reads as picked
 * through a village rather than laid out for her.
 */
export const NEIGHBOURS: PlacedHouse[] = [
  { x: -31, z: -1378, yaw: 0.95, len: 9, depth: 5.6, wall: 3.4, rise: 3.2, sink: 2.4, thatched: true, stacks: [1], stack: 1.3, look: 'thatch' },
  { x: -27, z: -1421, yaw: -0.15, len: 14, depth: 5.2, wall: 3.4, rise: 3.0, sink: 4.6, thatched: false, stacks: [-1, 1], stack: 1.0, look: 'swayback' },
  { x: -18, z: -1442, yaw: 0.5, len: 9.5, depth: 5.8, wall: 3.4, rise: 3.4, sink: 2.9, thatched: true, stacks: [-1], stack: 1.6, look: 'thatch' },
  { x: 18, z: -1386, yaw: 0.2, len: 9.5, depth: 5.6, wall: 3.4, rise: 3.1, sink: 4.2, thatched: false, stacks: [-1], stack: 1.4, look: 'cottage' },
  { x: 25, z: -1431, yaw: 1.42, len: 13, depth: 7.5, wall: 4.4, rise: 3.6, sink: 3.4, thatched: false, stacks: [], stack: 0, look: 'cottage' },
  { x: 28, z: -1450, yaw: 0.75, len: 9, depth: 5.8, wall: 3.4, rise: 3.3, sink: 3.0, thatched: true, stacks: [1], stack: 1.5, look: 'thatch' },
];

/** Garden walls round the way, their copings just out of the water; the railings stand out of it on drowned walls. */
const RAIL_AT = onFrom(OVER, NORTH, -3.0, RAILINGS_TOP);
const RAIL_END = onFrom(RAIL_AT, EAST, TREE_LANE - BARN.depth / 2 - OVERHANG - 0.3, RAILINGS_TOP);
export const GARDEN_WALLS: GardenWall[] = [
  coping(W1_FROM, W1_END),
  coping(onFrom(TREE_ROOT, NORTH, -3.0, 0.3), onFrom(onFrom(TREE_ROOT, NORTH, -3.0, 0.3), EAST, -3.2, 0.3)),
  coping(onFrom(TREE_ROOT, NORTH, 3.3, 0.25), onFrom(onFrom(TREE_ROOT, NORTH, 3.3, 0.25), EAST, -2.8, 0.25)),
  coping(onFrom(RAIL_AT, EAST, 0.2, RAILINGS_TOP), RAIL_END, true),
  coping(W3_FROM, W3_CORNER),
  coping(W3_CORNER, W3_TURN),
  coping(W3_TURN, MILL_FOOT.clone().setY(COPING)),
  coping(new THREE.Vector3(SWING_X + 5, RAILINGS_TOP, GREEN_NORTH - 0.45), new THREE.Vector3(SWING_X + 5, RAILINGS_TOP, TOWER_SOUTH), true),
  coping(new THREE.Vector3(SWING_X + 5, -0.6, TOWER_SOUTH + 1.6), new THREE.Vector3(SWING_X + 8.5, -0.6, TOWER_SOUTH + 2.4), true),
];

export const LEAN_TOS: LeanTo[] = [GRANARY_LEAN];

/** The placed roofs other than the cat's; the arrival's come first, so they keep their chances. */
export const PLACED: PlacedHouse[] = [STRAND_HOUSE, BARN, ...NEIGHBOURS, HIGH_LANE, MILL_LOW, GRANARY_HOUSE, GREEN_HOUSE];

/**
 * The way over the roofs, in walking order, each from where she comes onto it to where she leaves it. Slopes are decks
 * whose height runs from `height` at their first end to `height1` at their second. `strandLanding` is the line of
 * slates by the boat's stem she alights onto (level, as a step out of a boat needs); `strandSlope` is the whole slope
 * above it, up to `strand`, the ridge; `naveRidge` ends at the tower's foot.
 */
export const WAY = {
  strandLanding: { x0: landingA.x, z0: landingA.y, x1: landingB.x, z1: landingB.y, halfWidth: 0.25,
    height: slatesAt(STRAND_HOUSE, STEP_DOWN) },
  strandSlope: { x0: strandStep.x, z0: strandStep.y, x1: strandTop.x, z1: strandTop.y, halfWidth: 1.6,
    height: slatesAt(STRAND_HOUSE, STEP_DOWN), height1: ridgeTop(STRAND_HOUSE) },
  strand: { x0: strandTop.x, z0: strandTop.y, x1: strandEnd.x, z1: strandEnd.y, halfWidth: 0.45, height: ridgeTop(STRAND_HOUSE) },
  laneWall: strip(W1_FROM, W1_END, 0.28),
  barnRidge: strip(TREE_REST, onRoof(BARN, BARN.len / 2 - 0.1, 0), RIDGE),
  laneRidge: strip(SHEET_SITE.way.stepOff.clone().setY(ridgeTop(HIGH_LANE)), LANE_TOP, RIDGE),
  laneEast: strip(LANE_TOP, LANE_EAVE, 0.7),
  millWall: strip(W3_FROM, W3_CORNER, 0.28),
  millWallUp: strip(W3_CORNER, W3_TURN, 0.28),
  millWallOn: strip(W3_TURN, MILL_FOOT.clone().setY(COPING), 0.28),
  millSlope: strip(MILL_FOOT, onRoof(MILL_LOW, LOW_ON, 0), 0.7),
  millRidge: strip(onRoof(MILL_LOW, LOW_ON, 0), MILL_WAIT, RIDGE),
  granaryRidge: strip(MILL_OFF, GRANARY_TOP, RIDGE),
  granaryWest: strip(GRANARY_TOP, GRANARY_EAVE, 0.7),
  granaryLean: strip(GRANARY_EAVE.clone().setY(GRANARY_LEAN.high), LEAN_FOOT, 0.6),
  greenRidge: strip(GREEN_EAST, onRoof(GREEN_HOUSE, -3.9, 0), RIDGE),
  greenNorth: strip(onRoof(GREEN_HOUSE, -3.9, 0), onRoof(GREEN_HOUSE, -3.9, -3.23), 0.75),
  greenEave: strip(new THREE.Vector3(GREEN_HOUSE.x - 3.9, BOARD.y, BOARD.z), new THREE.Vector3(BOARD.x - 0.1, BOARD.y, BOARD.z), 0.2),
  naveSlope: strip(new THREE.Vector3(SWING_X, slatesAt(NAVE, LANDING_Z + 0.4 - NAVE.z), LANDING_Z + 0.4),
    new THREE.Vector3(SWING_X, ridgeTop(NAVE), NAVE.z), 1.1),
  naveRidge: strip(new THREE.Vector3(SWING_X, ridgeTop(NAVE), NAVE.z), TOWER_FOOT, RIDGE),
} satisfies Record<string, Deck>;
export type WayDeck = keyof typeof WAY;

/**
 * Where she does not simply walk on from one deck to the next: a hop she makes herself, or one of the four pieces the
 * player helps her over. `after` is the deck she leaves from, `from` where she stands to go and `to` where she lands.
 */
export interface WayGap {
  by: 'hop' | 'tree' | 'sheet' | 'mill' | 'swing';
  after: WayDeck;
  from: THREE.Vector3;
  to: THREE.Vector3;
}
const deckEnd = (d: Deck) => new THREE.Vector3(d.x1, d.height1 ?? d.height, d.z1);
export const WAY_GAPS: WayGap[] = [
  { by: 'hop', after: 'strand', from: RIDGE_END, to: W1_FROM },
  { by: 'tree', after: 'laneWall', from: TREE_WAIT, to: TREE_OFF },
  { by: 'sheet', after: 'barnRidge', from: SHEET_SITE.way.wait, to: SHEET_SITE.way.stepOff },
  { by: 'hop', after: 'laneEast', from: deckEnd(WAY.laneEast), to: W3_FROM },
  { by: 'mill', after: 'millRidge', from: MILL_WAIT, to: MILL_OFF },
  { by: 'hop', after: 'granaryLean', from: LEAN_FOOT, to: GREEN_EAST },
  { by: 'swing', after: 'greenEave', from: BOARD, to: LANDING },
];

/** The four pieces' places, for the story to set them going: the dead tree, the sheet, the drowned mill and the swing. */
export const TREE_SITE: { spot: TreeSpot; way: TreeWay } = {
  spot: { root: TREE_ROOT, rest: TREE_REST, over: OVER },
  way: { wait: TREE_WAIT, stepOff: TREE_OFF, onward: onRoof(BARN, BARN_LEN / 2 - BARN_REST + 0.85, 0), climb: true },
};
export const MILL_SITE = {
  spot: { hub: new THREE.Vector2(MILL.hub.x, MILL.hub.z), facing: MILL.facing, from: MILL_FROM, to: MILL_TO } satisfies MillSpot,
  way: { wait: MILL_WAIT, stepOff: MILL_OFF, onward: MILL_ONWARD },
};
export const SWING_SITE: { spot: SwingSpot; way: SwingWay } = {
  spot: { pivot: new THREE.Vector3(SWING_X, 7.3, GREEN_NORTH - 0.34), toward: new THREE.Vector2(0, -1), rope: 7 },
  way: { board: BOARD, landing: LANDING, onward: new THREE.Vector3(SWING_X + 0.4, ridgeTop(NAVE), NAVE.z + 0.9) },
};

/**
 * The cat's own way over each gap, the surfaces it runs along and leaps between: off the wall onto the railings across
 * the lane's mouth and along their top, a leap onto the barn's slates and up to its ridge; down the green cottage's
 * north slope onto the churchyard's railings and along them to the foot of the tower. At the sheet and the mill it
 * goes the piece's own way first (`catWay`).
 */
export const CAT_WAY = {
  tree: [RAIL_AT.clone().setY(COPING), onFrom(RAIL_AT, EAST, 0.4, RAILINGS_TOP + RAILING_RISE), RAIL_END.clone().setY(RAILINGS_TOP + RAILING_RISE),
    onRoof(BARN, BARN.stacks[0] * (BARN.len / 2 - 0.75) - 1.6, -acrossAt(BARN, 1.0)), onRoof(BARN, BARN.stacks[0] * (BARN.len / 2 - 0.75) - 0.75, 0)],
  sheet: SHEET_SITE.caps,
  mill: MILL_CHIMNEY,
  swing: [onRoof(GREEN_HOUSE, SWING_X + 5 - GREEN_HOUSE.x, 0), onRoof(GREEN_HOUSE, SWING_X + 5 - GREEN_HOUSE.x, -3.1),
    new THREE.Vector3(SWING_X + 5, RAILINGS_TOP + RAILING_RISE, GREEN_NORTH - 0.6),
    new THREE.Vector3(SWING_X + 5, RAILINGS_TOP + RAILING_RISE, TOWER_SOUTH + 0.15)],
};

/** The dead tree out in the water east of the tower. */
export const BOAT_TREE = new THREE.Vector2(30.5, -1557.5);

/** The church tower at the nave's east end: its middle, half its width, and the floor of its belfry's openings. */
export const TOWER = { x: NAVE.x + NAVE.len / 2 + BELFRY.half, z: NAVE.z, half: BELFRY.half, sill: BELFRY.sill };
/**
 * The ivy up the tower's west face, from where the nave's ridge meets it to the sill of the face's north light, the
 * way the cat goes up into the belfry and she follows it.
 */
export const IVY_FOOT = new THREE.Vector3(TOWER.x - TOWER.half, ridgeTop(NAVE), TOWER.z);
export const IVY_SILL = new THREE.Vector3(TOWER.x - TOWER.half, TOWER.sill, TOWER.z - BELFRY.light.at);
/** The last of the nave's ridge, up to the tower's face, where she stands to climb. */
export const IVY_STEP: Deck = strip(TOWER_FOOT, IVY_FOOT.clone().setX(IVY_FOOT.x - 0.1), 0.3);
/**
 * Sat on in the reveal of the west light of the south and the north faces: where the cat looks down from, over the
 * green and over the north water.
 */
export const BELFRY_SOUTH = new THREE.Vector3(TOWER.x - BELFRY.light.at, TOWER.sill, TOWER.z + TOWER.half - 0.2);
export const BELFRY_NORTH = new THREE.Vector3(TOWER.x - BELFRY.light.at, TOWER.sill, TOWER.z - TOWER.half + 0.2);
/**
 * Where the boat comes alongside the nave's north slates, lying west along them, her seat abreast of the ridge's top
 * there; and her way down the slates to the water's edge beside it.
 */
const BERTH_X = SWING_X;
export const NAVE_BERTH = { x: BERTH_X - 0.25, z: NAVE.z - acrossAt(NAVE, 0) - 0.62, yaw: -Math.PI / 2 };
export const NAVE_NORTH: Deck = strip(new THREE.Vector3(BERTH_X, ridgeTop(NAVE), NAVE.z),
  new THREE.Vector3(BERTH_X, 0.4, NAVE.z - acrossAt(NAVE, 0.4)), 0.7);
/**
 * The lost boat's drift home to the bell, out of the fog over the open water north-east of the church, where its
 * lantern answers each ring a stretch nearer, just past the tower's north-west corner as the bell is seen; then in
 * round the tower's north side and alongside the nave to the berth, the stretch the player sails it.
 */
export const HOME_WAY = [new THREE.Vector2(TOWER.x + 30, TOWER.z - 40), new THREE.Vector2(TOWER.x + 22, TOWER.z - 31),
  new THREE.Vector2(TOWER.x + 15, TOWER.z - 24), new THREE.Vector2(TOWER.x + 8, TOWER.z - 18)];
export const BRING_WAY = [new THREE.Vector2(TOWER.x - 0.5, TOWER.z - 11), new THREE.Vector2(NAVE_BERTH.x, NAVE_BERTH.z)];
/**
 * Out from the nave in the storm: round into the open water north of the church, then on past the lighthouse's side
 * before the channel's last leg to the forest beach.
 */
export const STORM_WAY = [new THREE.Vector2(6, -1584), new THREE.Vector2(36, -1602), new THREE.Vector2(38, -1622)];
/** The water the storm's way out and the lens following it keep open: from the berth round to the lighthouse's side. */
const STORM_OUT = [new THREE.Vector2(NAVE_BERTH.x, NAVE_BERTH.z - 4), ...STORM_WAY];

/**
 * The line the fog comes on along: in from the sea far behind them, up the drift to the stranded boat and on along her
 * way over the roofs to the tower, so its front takes each roof she leaves just after she is off it. Its front is
 * measured along it in metres.
 */
const ON_HER_WAY = [RIDGE_END, W1_FROM, TREE_WAIT, OVER, TREE_REST, deckEnd(WAY.barnRidge), SHEET_SITE.way.stepOff, LANE_TOP, W3_FROM, W3_CORNER,
  W3_TURN, MILL_FOOT, MILL_WAIT, MILL_OFF, GRANARY_TOP, LEAN_FOOT, GREEN_EAST, deckEnd(WAY.greenRidge), BOARD, LANDING, TOWER_FOOT];
/** Her way over the roofs, as a line on the water, for the village to be laid round. */
export const HER_WAY: THREE.Vector2[] = ON_HER_WAY.map((p) => new THREE.Vector2(p.x, p.z));
export const DARK_WAY: THREE.Vector2[] = [
  new THREE.Vector2(STRAND.x, STRAND.y + 240),
  STRAND.clone(),
  ...HER_WAY,
];
/** How far along `DARK_WAY` each of its points is, and the whole of it. */
export const DARK_ALONG: number[] = DARK_WAY.map((_, i) => DARK_WAY.slice(1, i + 1).reduce((sum, p, j) => sum + p.distanceTo(DARK_WAY[j]), 0));
export const DARK_END = DARK_ALONG[DARK_ALONG.length - 1];
/** How far along `DARK_WAY` the stranded boat lies. */
export const DARK_AT_STRAND = DARK_ALONG[1];
/**
 * How far along `DARK_WAY` a point on her way lies, from the stranding on, given how far along it was a moment ago:
 * the nearest place on it no more than `back` behind that and `on` beyond it, so a way that doubles back is never
 * taken for its later stretch.
 */
export function darkAlong(x: number, z: number, was = DARK_AT_STRAND, back = 4, on = 30): number {
  let best = Infinity, along = was;
  for (let i = 2; i < DARK_WAY.length; i++) {
    if (DARK_ALONG[i] < was - back || DARK_ALONG[i - 1] > was + on) continue;
    const a = DARK_WAY[i - 1], b = DARK_WAY[i], ex = b.x - a.x, ez = b.y - a.y, l2 = ex * ex + ez * ez;
    const t = THREE.MathUtils.clamp(((x - a.x) * ex + (z - a.y) * ez) / l2, 0, 1);
    const d = Math.hypot(x - a.x - ex * t, z - a.y - ez * t);
    if (d < best) { best = d; along = DARK_ALONG[i - 1] + t * Math.sqrt(l2); }
  }
  return along;
}
/**
 * What the fog has to rise over as it comes: how far along `DARK_WAY` each thing stands and how high it is: the
 * stranded boat's masthead, then her way over the roofs.
 */
export const DARK_TOPS: { along: number; top: number }[] = [
  { along: DARK_AT_STRAND, top: tuning.drowned.fog.overBoat },
  ...ON_HER_WAY.map((p, i) => ({ along: DARK_ALONG[i + 2], top: p.y })),
];

/** The point `front` metres along `DARK_WAY`; past the tower it runs on the way its last stretch goes. */
export function darkWayPoint(front: number, out: THREE.Vector2): THREE.Vector2 {
  let left = front;
  for (let i = 0; i < DARK_WAY.length - 1; i++) {
    const a = DARK_WAY[i], b = DARK_WAY[i + 1], len = a.distanceTo(b);
    if (left <= len || i === DARK_WAY.length - 2) return out.lerpVectors(a, b, Math.max(0, left / len));
    left -= len;
  }
  return out.copy(DARK_WAY[0]);
}

/**
 * Where the boat waits while the cat is brought over: on the drift's last leg, this far short of where it strands, so
 * that once the cat is aboard and the air has died the becalmed hull has only a short way to ghost on onto the slates.
 */
const CAT_SHORT = 20;
const DRIFT_ON = new THREE.Vector2().subVectors(STRAND, DRIFT_FROM).normalize();
export const CAT_HOLD = STRAND.clone().addScaledVector(DRIFT_ON, -CAT_SHORT);
/**
 * The cat's roof stands off the drift to the east, this far round from straight ahead (radians), and the boat comes
 * round this far toward it as it waits, so it has little to swing back once the cat is aboard: the room's breeze comes
 * over its port quarter, so the sail it lets go hangs out to starboard, and the cat's slates stand off its starboard bow.
 */
const CAT_BEARING = 0.78;
const CAT_FACING = 0.2;
export const CAT_HOLD_YAW = Math.atan2(DRIFT_ON.x, DRIFT_ON.y) - CAT_FACING;
const CAT_TOWARD = (() => {
  const a = Math.atan2(DRIFT_ON.x, DRIFT_ON.y) - CAT_BEARING;
  return new THREE.Vector2(Math.sin(a), Math.cos(a));
})();
/** How far from the boat's middle as it waits the cat's slates meet the water where the tub comes in. */
const CAT_REACH = 5.6;
/**
 * How far its slope is turned from facing the boat toward the lens off her port side (radians), so it is seen rather
 * than edge on, and toward the low sun.
 */
const CAT_TURN = 0.75;
/** How far along the ridge from its middle, toward the chimney, the cat comes down to the water. */
const CAT_EDGE_ALONG = 1.1;

/**
 * The roof the cat is stranded on: a cottage nearly gone under, only its slates and a gable-end chimney out of the
 * water, so the cat on its pot is low enough to be seen at the same time as her. Its slope faces her and the lens, and
 * its chimney stands at the end away from the strand.
 */
export const CAT_HOUSE: PlacedHouse = (() => {
  const h: PlacedHouse = { x: 0, z: 0, yaw: Math.atan2(-CAT_TOWARD.x, -CAT_TOWARD.y) - CAT_TURN, len: 6.5, depth: 5.6, wall: 3.4, rise: 3.0,
    sink: 4.25, thatched: false, stacks: [1], stack: 1.0, pots: 1, quiet: true };
  const edge = CAT_HOLD.clone().addScaledVector(CAT_TOWARD, CAT_REACH);
  const off = houseLocal(h, CAT_EDGE_ALONG, acrossAt(h, 0));
  h.x = edge.x - off.x;
  h.z = edge.y - off.y;
  return h;
})();

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

/** `ahead` metres in front of the boat's middle as it waits for the cat and `port` metres to its port side (- starboard). */
export function atHold(ahead: number, port: number, out = new THREE.Vector2()): THREE.Vector2 {
  const fx = Math.sin(CAT_HOLD_YAW), fz = Math.cos(CAT_HOLD_YAW);
  return out.set(CAT_HOLD.x + fx * ahead + fz * port, CAT_HOLD.y + fz * ahead - fx * port);
}

/** Where the cat waits for the tub at the water's edge, on the slates just out of it. */
export const CAT_EDGE = onCatRoof(CAT_EDGE_ALONG, CAT_ROOF.depth - 0.25);

/**
 * The wash-tub: where it floats when the boat comes, off the bow between her and the cat, so the first trip is away
 * from her across the water to the cat; and the water it is kept to (a middle and a reach) round the bow and the cat's
 * slates.
 */
const OFF_BOW = atHold(2.4, 1.6);
const EDGE_ON_WATER = new THREE.Vector2(CAT_EDGE.x, CAT_EDGE.z);
export const TUB_START = OFF_BOW.clone().lerp(EDGE_ON_WATER, 0.42);
export const TUB_WATER = (() => {
  const mid = OFF_BOW.clone().lerp(EDGE_ON_WATER, 0.5);
  return { x: mid.x, z: mid.y, r: 5 };
})();

/**
 * What the generated village is drawn up round: a churchyard and these clearings, where the village was first laid
 * out. Keeping them means every roof, tree and gate takes the same chances it was tuned with; whatever then stands in
 * `inClearing` is drawn up and left unbuilt.
 */
export const DRAWN_ROUND = {
  church: new THREE.Vector2(14, -1436),
  clearings: [
    { x: -7.2688, z: -1401.77, r: 8 }, { x: -3, z: -1423.2, r: 9 }, { x: 14.5, z: -1365.5, r: 9 },
    { x: -31, z: -1378, r: 8.5 }, { x: -27, z: -1421, r: 11 }, { x: -18, z: -1442, r: 8.75 },
    { x: 7, z: -1399, r: 8.25 }, { x: 18, z: -1386, r: 8.75 }, { x: 25, z: -1431, r: 10.5 },
    { x: -14, z: -1457, r: 12 }, { x: 28, z: -1450, r: 8.5 }, { x: 3.1, z: -1436, r: 12.5 },
    { x: -6.2, z: -1413.6, r: 8 }, { x: 2.6, z: -1428.4, r: 10 }, { x: 5.5, z: -1368.5, r: 8 },
    { x: -3, z: -1376, r: 9 }, { x: -7, z: -1388, r: 8 }, { x: 4, z: -1446, r: 9 }, { x: -23, z: -1400, r: 8 },
  ],
};
export const inDrawnClearing = (x: number, z: number, room: number) =>
  DRAWN_ROUND.clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + room);

function toSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1e-6;
  const u = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1);
  return Math.hypot(x - ax - dx * u, z - az - dz * u);
}

/**
 * Open water the generated village leaves her: round every placed roof and her way over them, the mill, the green and
 * the churchyard.
 */
const OPEN = [
  ...PLACED.map((h) => ({ x: h.x, z: h.z, r: h.len / 2 + 3 })),
  { x: MILL.hub.x, z: MILL.hub.z, r: MILL.reach + 2 },
  { x: MILL.hub.x, z: MILL.hub.z, r: 12 },
  { x: GREEN_TREE.x + 2, z: GREEN_TREE.z - 4, r: 9 },
  { x: NAVE.x, z: NAVE.z, r: 14 },
  { x: TOWER_FOOT.x + 3, z: NAVE.z, r: 9 },
  { x: BOAT_TREE.x, z: BOAT_TREE.y, r: 7 },
  { x: 0.625, z: -1572.54, r: 16 },
];
export function inClearing(x: number, z: number, room: number): boolean {
  if (OPEN.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + room)) return true;
  if (Object.values(WAY).some((d: Deck) => toSegment(x, z, d.x0, d.z0, d.x1, d.z1) < 5 + room)) return true;
  for (let i = 1; i < STORM_OUT.length; i++) {
    const a = STORM_OUT[i - 1], b = STORM_OUT[i];
    if (toSegment(x, z, a.x, a.y, b.x, b.y) < 14 + room) return true;
  }
  return toSegment(x, z, DRIFT_FROM.x, DRIFT_FROM.y, STRAND.x, STRAND.y) < DRIFT_ROOM + room;
}

/**
 * The cat's roof, the water the tub crosses and the lens watching it off her port side, or upright from behind her.
 * The generated village is laid out without them, so every other roof and tree stands where it always has, and
 * whatever of it falls here is left unbuilt.
 */
const CAT_GROUND = [
  { x: CAT_HOUSE.x, z: CAT_HOUSE.z, r: CAT_HOUSE.len / 2 + 4 },
  { x: TUB_WATER.x, z: TUB_WATER.z, r: TUB_WATER.r + 2 },
  ...[[0, 0, 6], [2, 6, 4], [4, 13, 5], [-6, 3, 5]].map(([ahead, port, r]) => {
    const at = atHold(ahead, port);
    return { x: at.x, z: at.y, r };
  }),
  /** Behind the cat's roof as the lens sees it, so no other roof stands up there to be taken for the cat's. */
  ...[[7, -8, 6]].map(([ahead, port, r]) => {
    const at = atHold(ahead, port);
    return { x: at.x, z: at.y, r };
  }),
];
export const onCatGround = (x: number, z: number, room: number) =>
  CAT_GROUND.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + room);


import * as THREE from 'three';
import type { Deck } from './decks';
import type { TreeSpot } from './crossings/topple-tree';
import type { TreeWay } from './crossings/tree-crossing';
import type { SwingSpot } from './crossings/rope-swing';
import type { SwingWay } from './crossings/swing-crossing';

/**
 * Her way over the roofs, laid by hand among the generated village: from the roof the becalmed boat drifts against,
 * over the lane by the tree, her own way to the drowned mill, on to the green and its swing, to the foot of the
 * church's tower by the lighthouse.
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
const OVERHANG = 0.28;
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
const RIDGE_END = new THREE.Vector3(strandEnd.x, ridgeTop(STRAND_HOUSE), strandEnd.y);
/** The way she walks along the strand's ridge, and square across it over the lane to the garden. */
const ALONG = new THREE.Vector2(strandEnd.x - strandTop.x, strandEnd.y - strandTop.y).normalize();
const ACROSS_LANE = new THREE.Vector2(-ALONG.y, ALONG.x);
const along = (from: THREE.Vector3, by: THREE.Vector2, len: number, y = from.y) =>
  new THREE.Vector3(from.x + by.x * len, y, from.z + by.y * len);

/**
 * The lane: deep water from the ridge's end to the garden wall across it, the wall's coping just out of the water. The
 * dead tree stands in the garden behind the wall on the line square across the lane from the ridge's end, so it
 * falls across the wall square on, its root plate on the line of its fall.
 */
const LANE = 6.7;
const COPING = 0.45;
const OVER = along(RIDGE_END, ACROSS_LANE, LANE, COPING);
const TREE_ROOT = along(OVER, ACROSS_LANE, 2.4, -0.15);
const LANE_WEST = along(OVER, ALONG, 2.5);
const LANE_CORNER = along(OVER, ALONG, -3.9);
/** Where the garden's side wall meets the cottage's south eaves. */
const GARDEN_GATE = along(LANE_CORNER, ACROSS_LANE, 9.75);

/** The cottage the garden belongs to: up its south slope from the wall, along its ridge and down to its north eaves. */
export const GARDEN_HOUSE = sunk({ yaw: Math.atan2(ALONG.y, -ALONG.x), len: 10, depth: 6, wall: 3.4, rise: 2.5,
  thatched: false, stacks: [1], stack: 1.3 }, 2.99, { along: -3.3, across: 3.28, at: GARDEN_GATE });
const BACK_DOOR = onRoof(GARDEN_HOUSE, 4.4, -3.23);

/** The house's yaw that lays its length along `bearing`. */
const lengthAlong = (bearing: number) => Math.atan2(-Math.cos(bearing), Math.sin(bearing));

/**
 * Her own way to the mill: a back-garden wall, a lean-to up onto a tall cottage where the church stood once and over
 * its ridge, a hop down onto a broken garden wall, the ridge of a cottage nearly gone under, a dogleg of wall and a
 * slope up onto the cottage by the mill.
 */
const W1_END = onFrom(BACK_DOOR, 2.76, 8.5, 0.35);
const TALL_HOUSE = sunk({ yaw: 0.25, len: 11, depth: 5.6, wall: 3.4, rise: 2.6, thatched: false, stacks: [-1, 1], stack: 1.2 },
  3.9, { along: -2, across: 5.0, at: W1_END });
const LEAN_TO: LeanTo = { house: TALL_HOUSE, side: 1, from: -3.6, to: -0.4, out: 2.2, high: 1.05, low: 0.45 };
const LEAN_TOP = (() => { const at = houseLocal(TALL_HOUSE, -2, TALL_HOUSE.depth / 2); return new THREE.Vector3(at.x, LEAN_TO.high, at.y); })();
const TALL_EAVE = onRoof(TALL_HOUSE, 2.5, -3.03);
const W2_FROM = onFrom(TALL_EAVE, Math.PI + TALL_HOUSE.yaw, 0.6, 0.4);
const W2_BREAK = onFrom(W2_FROM, 2.9, 5.5, 0.4);
const W2_ON = onFrom(W2_BREAK, 2.9, 0.6, 0.4);
const W2_END = onFrom(W2_ON, 2.75, 7.5, 0.4);
const SUNK_HOUSE = sunk({ yaw: lengthAlong(2.8), len: 11, depth: 5, wall: 3.4, rise: 2.6, thatched: false, stacks: [1], stack: 0.9 },
  0.78, { along: -5.4, across: 0, at: W2_END });
const W3_FROM = new THREE.Vector3().copy(onRoof(SUNK_HOUSE, 5.4, 0)).setY(COPING);
const W3_TURN = onFrom(W3_FROM, 3.35, 6.5, COPING);
const W3_ON = onFrom(W3_TURN, 3.35, 0.6, COPING);

/**
 * The drowned mill, standing in the water up to its shoulders: where its sails turn and the way they face (a yaw: the
 * sails' plane is across it, their front toward +z of a frame turned by it). She comes along the ridge of the cottage
 * south of it and onto a wall in front of the sails, waits there for a sail to come round level beside her, rides it
 * up and steps off its tip onto the ridge of the high roof north of it. The heights follow the ride: the wall's top is
 * where the boarding sail's rail lies as it dwells beside her, the high ridge where the rail's tip lies as it dwells at
 * the top. Measured along her way from the hub (`on`) and out in front of the sails' plane (`out`).
 */
export const MILL = {
  hub: new THREE.Vector3(21, 2.9, -1491),
  facing: -1.7,
  /** The sails' reach: nothing else stands within it of the hub. */
  reach: 2.5,
  /** Out in front of the sails: her wall, and the rail she stands on. */
  wallOut: 0.72, railOut: 0.25,
  waitTop: 1.81, offRidge: 3.42,
  /** On along her way: where she waits, the high roof's gable end, and where she steps off onto its ridge. */
  waitOn: 1.38, gableOn: 2.94, offOn: 3.19,
};
function byMill(on: number, out: number, y: number): THREE.Vector3 {
  const c = Math.cos(MILL.facing), s = Math.sin(MILL.facing);
  return new THREE.Vector3(MILL.hub.x - on * c + out * s, y, MILL.hub.z + on * s + out * c);
}
/** The cottage south of the mill, its ridge in line with her wall and its gable end just clear of the sails. */
const MILL_HOUSE = sunk({ yaw: MILL.facing, len: 8, depth: 5.2, wall: 3.4, rise: 2.4, thatched: false, stacks: [1], stack: 1.1 },
  MILL.waitTop + 0.2, { along: 0, across: 0, at: byMill(-(MILL.reach + 4.4), MILL.wallOut, 0) });
const MILL_FOOT = onRoof(MILL_HOUSE, 2.5, acrossAt(MILL_HOUSE, COPING));
/** The high roof beyond the mill, its gable end to the sails and its ridge in line with the rail. */
const HIGH_HOUSE = sunk({ yaw: MILL.facing, len: 6.4, depth: 4.4, wall: 3, rise: 2.5, thatched: false, stacks: [-1], stack: 1.2 },
  MILL.offRidge, { along: 0, across: 0, at: byMill(MILL.gableOn + 3.2, MILL.railOut, 0) });
const MILL_WAIT = byMill(MILL.waitOn, MILL.wallOut, MILL.waitTop);
const MILL_OFF = byMill(MILL.offOn, MILL.railOut, MILL.offRidge);
const HIGH_EAVE = onRoof(HIGH_HOUSE, -2.26, -2.43);

/**
 * Her own way to the green: a hop down off the high roof onto a garden wall, a dogleg of it, a long roof she climbs and
 * walks back along, a hop off its gable end, the ridge of a cottage nearly gone under, and a wall to the green's cottage.
 */
const W4_FROM = onFrom(HIGH_EAVE, Math.atan2(-Math.sin(MILL.facing), -Math.cos(MILL.facing)), 0.55, COPING);
const W4_TURN = onFrom(W4_FROM, 2.95, 10, COPING);
const W4_ON = onFrom(W4_TURN, 2.95, 0.6, COPING);
const LONG_HOUSE: PlacedHouse = { ...sunk({ yaw: -0.42, len: 13, depth: 5.4, wall: 3.4, rise: 2.9, thatched: false, stacks: [-1], stack: 1.3 }, 1.45), x: 31, z: -1522 };
const LONG_FOOT = onRoof(LONG_HOUSE, 3.5, acrossAt(LONG_HOUSE, COPING));
const LONG_END = onRoof(LONG_HOUSE, -6.2, 0);
const W5_FROM = onFrom(LONG_END, Math.atan2(-Math.cos(LONG_HOUSE.yaw), Math.sin(LONG_HOUSE.yaw)), 0.75, COPING);
const W5_TURN = onFrom(W5_FROM, 3.3, 5, COPING);
const LOW_HOUSE = sunk({ yaw: lengthAlong(3.4), len: 8.6, depth: 5, wall: 3.4, rise: 2.6, thatched: false, stacks: [-1], stack: 0.8 },
  0.8, { along: -4.2, across: 0, at: W5_TURN });
const W6_FROM = new THREE.Vector3().copy(onRoof(LOW_HOUSE, 4.2, 0)).setY(COPING);

/**
 * The church, moved on to stand by the lighthouse: the nave's ridge runs east to the tower's foot, the end of her way.
 * The green lies south of it, a clearing of water; the cottage on its far side has the swing hanging by its west gable
 * end from the old tree's bough, so the back-swing passes the end of the house, and she lets go over the nave's slope.
 */
export const NAVE: PlacedHouse = {
  x: 6.5, z: -1561, yaw: 0, len: 17, depth: 7.6, wall: 3.2, rise: 3.2, sink: 3.6, thatched: false, stacks: [], stack: 0,
};
/** The foot of the tower on the nave's ridge, as high as a child can get. */
export const TOWER_FOOT = new THREE.Vector3(NAVE.x + NAVE.len / 2 - 0.9, ridgeTop(NAVE), NAVE.z);
const SWING_X = NAVE.x + NAVE.len / 2 - 3.5;
const LANDING_Z = NAVE.z + 2.88;
const GREEN_NORTH = LANDING_Z + 6.8;
export const GREEN_HOUSE: PlacedHouse = { ...sunk({ yaw: 0, len: 9, depth: 6, wall: 3.4, rise: 2.5, thatched: false, stacks: [1], stack: 1.3 }, 2.99),
  x: SWING_X + 1.05 + 4.5, z: GREEN_NORTH + 3.28 };
const GREEN_FOOT = onRoof(GREEN_HOUSE, 3, 3.28);
const BOARD = new THREE.Vector3(GREEN_HOUSE.x - 4.42, eaveAt(GREEN_HOUSE), GREEN_NORTH + 0.12);
const LANDING = new THREE.Vector3(SWING_X, slatesAt(NAVE, LANDING_Z - NAVE.z), LANDING_Z);
/** The old tree on the green, off the cottage's corner beyond the swing, its bough out over the water to the ropes. */
export const GREEN_TREE = new THREE.Vector3(SWING_X - 4.65, -3.2, GREEN_HOUSE.z + 3.28 + 0.95);
/** The tower's south face, where the churchyard's railings run up to it from the green. */
const TOWER_SOUTH = NAVE.z + 2.45;
/** The railings round the drowned churchyard, standing out of the water above their sunken wall. */
const RAILINGS_TOP = -0.3;

/** A roof where the church stood once, off her way. */
const OLD_SITE: PlacedHouse = { ...sunk({ yaw: 0.08, len: 9.5, depth: 5.6, wall: 3.4, rise: 3.0, thatched: true, stacks: [1], stack: 1.4 }, 2.3),
  x: 3, z: -1446 };

/** Garden walls round the way, their copings just out of the water; the railings stand out of it on drowned walls. */
export const GARDEN_WALLS: GardenWall[] = [
  coping(LANE_WEST, LANE_CORNER),
  coping(LANE_CORNER, GARDEN_GATE),
  coping(LANE_WEST, along(LANE_WEST, ACROSS_LANE, 4.2, 0.3)),
  coping(along(LANE_WEST, ACROSS_LANE, 5.6, 0.25), along(LANE_WEST, ACROSS_LANE, 8.4, 0.25)),
  coping(new THREE.Vector3(BACK_DOOR.x, 0.35, BACK_DOOR.z), W1_END),
  coping(onFrom(W1_END, 1.2, 0.2, 0.2), onFrom(W1_END, 1.2, 3.2, 0.2)),
  coping(W2_FROM, W2_BREAK),
  coping(W2_ON, W2_END),
  coping(onFrom(W2_BREAK, 1.33, 0.3, 0.25), onFrom(W2_BREAK, 1.33, 2.8, 0.25)),
  coping(W3_FROM, W3_TURN),
  coping(W3_ON, MILL_FOOT.clone().setY(COPING)),
  coping(onFrom(W3_TURN, 4.9, 0.3, 0.3), onFrom(W3_TURN, 4.9, 3.4, 0.3)),
  coping(byMill(-(MILL.reach + 0.4), MILL.wallOut, MILL.waitTop), byMill(MILL.gableOn - 0.3, MILL.wallOut, MILL.waitTop)),
  coping(W4_FROM, W4_TURN),
  coping(W4_ON, LONG_FOOT.clone().setY(COPING)),
  coping(onFrom(W4_TURN, 4.5, 0.3, 0.25), onFrom(W4_TURN, 4.5, 2.6, 0.25)),
  coping(W5_FROM, W5_TURN),
  coping(W6_FROM, GREEN_FOOT.clone().setY(COPING)),
  coping(along(RIDGE_END, ALONG, 2.0, RAILINGS_TOP), along(along(RIDGE_END, ALONG, 2.0), ACROSS_LANE, LANE - 0.25, RAILINGS_TOP), true),
  coping(new THREE.Vector3(SWING_X + 5, RAILINGS_TOP, GREEN_NORTH - 0.45), new THREE.Vector3(SWING_X + 5, RAILINGS_TOP, TOWER_SOUTH), true),
  coping(new THREE.Vector3(SWING_X + 5, -0.6, TOWER_SOUTH + 1.6), new THREE.Vector3(SWING_X + 8.5, -0.6, TOWER_SOUTH + 2.4), true),
];
/** How far the railings stand above the wall they are set in. */
export const RAILING_RISE = 0.88;

export const LEAN_TOS: LeanTo[] = [LEAN_TO];

/** The placed roofs other than the cat's; the arrival's come first, so they keep their chances. */
export const PLACED: PlacedHouse[] = [STRAND_HOUSE, GARDEN_HOUSE, EAST_OF_STRAND, ...NEIGHBOURS,
  TALL_HOUSE, SUNK_HOUSE, MILL_HOUSE, HIGH_HOUSE, LONG_HOUSE, LOW_HOUSE, GREEN_HOUSE, OLD_SITE];

/**
 * The way over the roofs, in walking order, each from where she comes onto it to where she leaves it. Slopes are decks
 * whose height runs from `height` at their first end to `height1` at their second. `strandLanding` is the line of
 * slates by the boat's stem she alights onto (level, as a step out of a boat needs); `strandSlope` is the whole slope
 * above it, up to `strand`, the ridge; `naveRidge` ends at the tower's foot.
 */
export const WAY = {
  strandLanding: { x0: landingA.x, z0: landingA.y, x1: landingB.x, z1: landingB.y, halfWidth: 0.25,
    height: slatesAt(STRAND_HOUSE, STEP_DOWN) },
  strandSlope: { x0: strandStep.x, z0: strandStep.y, x1: strandTop.x, z1: strandTop.y, halfWidth: 2.2,
    height: slatesAt(STRAND_HOUSE, STEP_DOWN), height1: ridgeTop(STRAND_HOUSE) },
  strand: { x0: strandTop.x, z0: strandTop.y, x1: strandEnd.x, z1: strandEnd.y, halfWidth: 0.45, height: ridgeTop(STRAND_HOUSE) },
  laneWall: strip(LANE_WEST, LANE_CORNER, 0.28),
  gardenWall: strip(LANE_CORNER, GARDEN_GATE, 0.28),
  gardenSlope: strip(onRoof(GARDEN_HOUSE, -3.3, 3.28), onRoof(GARDEN_HOUSE, -3.3, 0), 0.7),
  gardenRidge: strip(onRoof(GARDEN_HOUSE, -3.3, 0), onRoof(GARDEN_HOUSE, 4.4, 0), RIDGE),
  gardenNorth: strip(onRoof(GARDEN_HOUSE, 4.4, 0), BACK_DOOR, 0.7),
  backWall: strip(new THREE.Vector3(BACK_DOOR.x, 0.35, BACK_DOOR.z), W1_END, 0.28),
  leanTo: strip(W1_END.clone().setY(LEAN_TO.low), LEAN_TOP, 0.6),
  tallSlope: strip(onRoof(TALL_HOUSE, -2, 3.08), onRoof(TALL_HOUSE, -2, 0), 0.7),
  tallRidge: strip(onRoof(TALL_HOUSE, -2, 0), onRoof(TALL_HOUSE, 2.5, 0), RIDGE),
  tallNorth: strip(onRoof(TALL_HOUSE, 2.5, 0), TALL_EAVE, 0.7),
  brokenWall: strip(W2_FROM, W2_BREAK, 0.28),
  brokenWallOn: strip(W2_ON, W2_END, 0.28),
  sunkRidge: strip(onRoof(SUNK_HOUSE, -5.4, 0), onRoof(SUNK_HOUSE, 5.4, 0), RIDGE),
  dogleg: strip(W3_FROM, W3_TURN, 0.28),
  doglegOn: strip(W3_ON, MILL_FOOT.clone().setY(COPING), 0.28),
  millSlope: strip(MILL_FOOT, onRoof(MILL_HOUSE, 2.5, 0), 0.7),
  millRidge: strip(onRoof(MILL_HOUSE, 2.5, 0), onRoof(MILL_HOUSE, -3.95, 0), RIDGE),
  millWall: strip(byMill(-(MILL.reach + 0.5), MILL.wallOut, MILL.waitTop), MILL_WAIT, 0.25),
  highRidge: strip(MILL_OFF, onRoof(HIGH_HOUSE, -2.26, 0), RIDGE),
  highEast: strip(onRoof(HIGH_HOUSE, -2.26, 0), HIGH_EAVE, 0.7),
  fieldWall: strip(W4_FROM, W4_TURN, 0.28),
  fieldWallOn: strip(W4_ON, LONG_FOOT.clone().setY(COPING), 0.28),
  longSlope: strip(LONG_FOOT, onRoof(LONG_HOUSE, 3.5, 0), 0.7),
  longRidge: strip(onRoof(LONG_HOUSE, 3.5, 0), LONG_END, RIDGE),
  greenWall: strip(W5_FROM, W5_TURN, 0.28),
  lowRidge: strip(onRoof(LOW_HOUSE, -4.2, 0), onRoof(LOW_HOUSE, 4.2, 0), RIDGE),
  greenWallOn: strip(W6_FROM, GREEN_FOOT.clone().setY(COPING), 0.28),
  greenSlope: strip(GREEN_FOOT, onRoof(GREEN_HOUSE, 3, 0), 0.7),
  greenRidge: strip(onRoof(GREEN_HOUSE, 3, 0), onRoof(GREEN_HOUSE, -3.9, 0), RIDGE),
  greenNorth: strip(onRoof(GREEN_HOUSE, -3.9, 0), onRoof(GREEN_HOUSE, -3.9, -3.23), 0.75),
  greenEave: strip(new THREE.Vector3(GREEN_HOUSE.x - 3.9, BOARD.y, BOARD.z), new THREE.Vector3(BOARD.x - 0.1, BOARD.y, BOARD.z), 0.2),
  naveSlope: strip(new THREE.Vector3(SWING_X, slatesAt(NAVE, LANDING_Z + 0.4 - NAVE.z), LANDING_Z + 0.4),
    new THREE.Vector3(SWING_X, ridgeTop(NAVE), NAVE.z), 1.1),
  naveRidge: strip(new THREE.Vector3(SWING_X, ridgeTop(NAVE), NAVE.z), TOWER_FOOT, RIDGE),
} satisfies Record<string, Deck>;
export type WayDeck = keyof typeof WAY;

/**
 * Where she does not simply walk on from one deck to the next: a hop she makes herself, or one of the three pieces the
 * player helps her over. `after` is the deck she leaves from, `from` where she stands to go and `to` where she lands.
 */
export interface WayGap {
  by: 'hop' | 'tree' | 'mill' | 'swing';
  after: WayDeck;
  from: THREE.Vector3;
  to: THREE.Vector3;
}
const TREE_OFF = along(OVER, ALONG, -0.55);
const deckEnd = (d: Deck) => new THREE.Vector3(d.x1, d.height1 ?? d.height, d.z1);
export const WAY_GAPS: WayGap[] = [
  { by: 'tree', after: 'strand', from: RIDGE_END, to: TREE_OFF },
  { by: 'hop', after: 'tallNorth', from: deckEnd(WAY.tallNorth), to: W2_FROM },
  { by: 'hop', after: 'brokenWall', from: W2_BREAK, to: W2_ON },
  { by: 'hop', after: 'dogleg', from: W3_TURN, to: W3_ON },
  { by: 'mill', after: 'millWall', from: MILL_WAIT, to: MILL_OFF },
  { by: 'hop', after: 'highEast', from: deckEnd(WAY.highEast), to: W4_FROM },
  { by: 'hop', after: 'fieldWall', from: W4_TURN, to: W4_ON },
  { by: 'hop', after: 'longRidge', from: LONG_END, to: W5_FROM },
  { by: 'swing', after: 'greenEave', from: BOARD, to: LANDING },
];

/** The three pieces' places, for the story to set them going: the dead tree, the drowned mill and the swing. */
export const TREE_SITE: { spot: TreeSpot; way: TreeWay } = {
  spot: { root: TREE_ROOT, rest: RIDGE_END, over: OVER },
  way: { wait: along(RIDGE_END, ALONG, -1.25), stepOff: TREE_OFF, onward: along(OVER, ALONG, -1.9) },
};
export const MILL_SITE = {
  spot: { hub: MILL.hub, facing: MILL.facing },
  way: { wait: MILL_WAIT, stepOff: MILL_OFF, onward: byMill(MILL.offOn + 1.65, MILL.railOut, MILL.offRidge) },
};
export const SWING_SITE: { spot: SwingSpot; way: SwingWay } = {
  spot: { pivot: new THREE.Vector3(SWING_X, 7.3, GREEN_NORTH - 0.34), toward: new THREE.Vector2(0, -1), rope: 7 },
  way: { board: BOARD, landing: LANDING, onward: new THREE.Vector3(SWING_X + 0.4, ridgeTop(NAVE), NAVE.z + 0.9) },
};

/**
 * The cat's own way over each gap, the surfaces it runs along and leaps between: off the ridge's end onto the
 * railings across the lane's mouth and along their top to the wall; along her wall at the mill and up onto the high
 * roof's slates by its gable, a leap she could never make; down the green cottage's north slope onto the churchyard's
 * railings and along them to the foot of the tower.
 */
export const CAT_WAY = {
  tree: [RIDGE_END, along(RIDGE_END, ALONG, 2.0, RAILINGS_TOP + RAILING_RISE),
    along(along(RIDGE_END, ALONG, 2.0), ACROSS_LANE, LANE - 0.6, RAILINGS_TOP + RAILING_RISE), along(OVER, ALONG, 2.0, COPING)],
  mill: [onRoof(MILL_HOUSE, -3.6, 0), byMill(MILL.gableOn - 0.45, MILL.wallOut, MILL.waitTop),
    byMill(MILL.gableOn + 0.5, MILL.wallOut, slatesAt(HIGH_HOUSE, MILL.wallOut - MILL.railOut)),
    byMill(MILL.gableOn + 0.9, MILL.railOut, MILL.offRidge), byMill(MILL.gableOn + 3.4, MILL.railOut, MILL.offRidge)],
  swing: [onRoof(GREEN_HOUSE, SWING_X + 5 - GREEN_HOUSE.x, 0), onRoof(GREEN_HOUSE, SWING_X + 5 - GREEN_HOUSE.x, -3.1),
    new THREE.Vector3(SWING_X + 5, RAILINGS_TOP + RAILING_RISE, GREEN_NORTH - 0.6),
    new THREE.Vector3(SWING_X + 5, RAILINGS_TOP + RAILING_RISE, TOWER_SOUTH + 0.15)],
};

/** The dead tree out in the water east of the tower that the drifting boat fetches up against, the lighthouse beyond. */
export const BOAT_TREE = new THREE.Vector2(30.5, -1557.5);

/**
 * The line the dark comes on along: from far out where they came from, through the stranding and on over her way to
 * the tower. The dark's reach is measured along it in metres.
 */
export const DARK_WAY: THREE.Vector2[] = [
  new THREE.Vector2(STRAND.x + 138, STRAND.y + 197),
  STRAND.clone(),
  ...[RIDGE_END, OVER, LANE_CORNER, GARDEN_GATE, BACK_DOOR, W1_END, TALL_EAVE, W2_END, W3_FROM, MILL_FOOT, MILL_WAIT, MILL_OFF,
    HIGH_EAVE, W4_TURN, LONG_FOOT, LONG_END, W6_FROM, GREEN_FOOT, BOARD, LANDING, TOWER_FOOT]
    .map((p) => new THREE.Vector2(p.x, p.z)),
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

/**
 * The way the untended boat drifts once the fog's cold breath takes it off the slates: west along the roof's edge,
 * north up the open water west of her way, round behind the church and out to the dead tree east of the tower, where
 * its stem fetches up against the trunk.
 */
export const BOAT_ADRIFT: THREE.Vector2[] = (() => {
  const way = [STRAND.clone(), ...[[-14, -1399.5], [-17, -1410], [-18, -1425], [-17, -1430], [-9, -1440], [-2.5, -1452],
    [-1.5, -1466], [-1.5, -1490], [-9.5, -1519], [-10.5, -1535], [-11.5, -1550], [-9, -1568], [2, -1576], [16, -1576], [25.5, -1569]]
    .map(([x, z]) => new THREE.Vector2(x, z))];
  const last = way[way.length - 1];
  const toTree = new THREE.Vector2().subVectors(BOAT_TREE, last).normalize();
  way.push(new THREE.Vector2().copy(BOAT_TREE).addScaledVector(toTree, -(STEM + 0.4)));
  return way;
})();

/** The point `along` metres down `BOAT_ADRIFT` (held at its end), and the heading of the leg it is on. */
export function adriftAt(along: number, out: THREE.Vector2): number {
  let left = along;
  for (let i = 0; i < BOAT_ADRIFT.length - 1; i++) {
    const a = BOAT_ADRIFT[i], b = BOAT_ADRIFT[i + 1], len = a.distanceTo(b);
    if (left <= len || i === BOAT_ADRIFT.length - 2) {
      out.lerpVectors(a, b, THREE.MathUtils.clamp(left / len, 0, 1));
      return Math.atan2(b.x - a.x, b.y - a.y);
    }
    left -= len;
  }
  out.copy(BOAT_ADRIFT[0]);
  return 0;
}

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

/** Where the lens stands while the tub is brought over: off the chimney's gable end, low over the water. */
export const CAT_LENS = (() => {
  const a = Math.atan2(-CAT_TOWARD.x, -CAT_TOWARD.y) - CAT_LENS_TURN;
  return new THREE.Vector2(CAT_CHIMNEY.x + Math.sin(a) * CAT_LENS_OFF, CAT_CHIMNEY.z + Math.cos(a) * CAT_LENS_OFF);
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
 * Open water the generated village leaves her: round every placed roof and her way over them, the water the boat
 * drifts up, the mill, the green and the churchyard.
 */
const OPEN = [
  ...PLACED.map((h) => ({ x: h.x, z: h.z, r: h.len / 2 + 3 })),
  { x: MILL.hub.x, z: MILL.hub.z, r: 6 },
  { x: GREEN_TREE.x + 2, z: GREEN_TREE.z - 4, r: 9 },
  { x: NAVE.x, z: NAVE.z, r: 14 },
  { x: TOWER_FOOT.x + 3, z: NAVE.z, r: 9 },
  { x: BOAT_TREE.x, z: BOAT_TREE.y, r: 7 },
];
export function inClearing(x: number, z: number, room: number): boolean {
  if (OPEN.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + room)) return true;
  if (Object.values(WAY).some((d: Deck) => toSegment(x, z, d.x0, d.z0, d.x1, d.z1) < 5 + room)) return true;
  for (let i = 1; i < BOAT_ADRIFT.length; i++) {
    const a = BOAT_ADRIFT[i - 1], b = BOAT_ADRIFT[i];
    if (toSegment(x, z, a.x, a.y, b.x, b.y) < 4 + room) return true;
  }
  return false;
}

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
  /** Behind the cat and her as the lens sees them, so no other roof stands up between them to be taken for the cat's. */
  { x: -12, z: -1320, r: 6 },
];
export const onCatGround = (x: number, z: number, room: number) =>
  CAT_GROUND.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + room);


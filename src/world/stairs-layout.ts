import * as THREE from 'three';

/**
 * The island the stairs stand on: a small grassy knoll off the birches' north-east beach, under a low cloud deck.
 * The staircase is a household dogleg with no house round it: flights running north up the west lane and south
 * down the east lane, turning on half-landings, from the grass up through the cloud.
 */
export const STAIRS_ISLE = { x: 100, z: -1236, rx: 30, rz: 26 } as const;

/** The ground at the foot of the stair is levelled to this height over `STAIRS_TERRACE` metres. */
export const STAIRS_GROUND = 4.6;
export const STAIRS_TERRACE = { x: 103, z: -1236, radius: 7.5 } as const;

export const STEP = { rise: 0.19, going: 0.27, risers: 12, width: 1.05, landing: 1.15, gap: 0.14 } as const;
/** How far one flight climbs, and how far along the ground it runs. */
export const FLIGHT_RISE = STEP.rise * STEP.risers;
export const FLIGHT_RUN = STEP.going * (STEP.risers - 1);

/** The south line of the flights: odd flights start here and climb north; even flights arrive here. */
const ZA = -1233;
const ZB = ZA - FLIGHT_RUN;
const MID_X = 103;
export const LANE = { west: MID_X - (STEP.width + STEP.gap) / 2, east: MID_X + (STEP.width + STEP.gap) / 2 } as const;
export const STAIRS_Z = { south: ZA, north: ZB } as const;

/** Ten flights: three standing on the grass, three hanging loose under the cloud, four going up into it. */
export const FLIGHTS = 10;
export const LOOSE = [4, 5, 6] as const;

export function levelHeight(level: number): number {
  return STAIRS_GROUND + level * FLIGHT_RISE;
}

/** The cloud lies over everything from here to here; the top landing stands just clear of it. */
export const CLOUD = { base: levelHeight(6) + 2.1, top: levelHeight(FLIGHTS) - 1.25 } as const;

export interface Flight {
  index: number;
  lane: 'west' | 'east';
  /** Bottom and top of the walking line, on the lane's centre. */
  bottom: THREE.Vector3;
  top: THREE.Vector3;
  /** The half-landing the flight arrives on: its centre, and its extent across both lanes. */
  landing: THREE.Vector3;
  /** Along the flight, +1 north (-z) or -1 south. */
  dir: number;
}

export function flight(index: number): Flight {
  const north = index % 2 === 1;
  const x = north ? LANE.west : LANE.east;
  const z0 = north ? ZA : ZB;
  const z1 = north ? ZB : ZA;
  const y0 = levelHeight(index - 1);
  const y1 = levelHeight(index);
  const lz = north ? ZB - STEP.landing / 2 : ZA + STEP.landing / 2;
  return {
    index,
    lane: north ? 'west' : 'east',
    bottom: new THREE.Vector3(x, y0, z0),
    top: new THREE.Vector3(x, y1, z1),
    landing: new THREE.Vector3(MID_X, y1, lz),
    dir: north ? 1 : -1,
  };
}

/** Where the child steps off the grass onto the first tread. */
export const STAIRS_FOOT = new THREE.Vector3(LANE.west, STAIRS_GROUND, ZA + 1.6);

export const STAIRS_LANDING = new THREE.Vector2(76, -1231);
export const STAIRS_ARRIVAL = new THREE.Vector2(86, -1233);

/**
 * The top landing, open on its west side to the sun: the slippers are by the edge, the child sits there with their
 * feet over the cloud, and the boat lies alongside.
 */
export const TOP = flight(FLIGHTS).landing;
export const TOP_EDGE = MID_X - STEP.width - STEP.gap / 2 - 0.05;
export const SLIPPERS = new THREE.Vector3(TOP_EDGE + 0.2, TOP.y, TOP.z - 0.32);
export const SIT = new THREE.Vector3(TOP_EDGE + 0.32, TOP.y, TOP.z + 0.24);
export const CLOUD_BERTH = { x: TOP_EDGE - 1.45, z: TOP.z + 0.1, yaw: Math.PI } as const;

/** Round the tower and away north-west into the sun, then down through the cloud onto the water where the village begins. */
export const CLOUD_ROUTE = [
  new THREE.Vector2(92, -1240),
  new THREE.Vector2(74, -1244),
  new THREE.Vector2(56, -1251),
  new THREE.Vector2(38, -1257),
] as const;
/** Where the hull has come down onto the sea when the drowned village takes over. */
export const DESCENT_END = new THREE.Vector2(16, -1254);

/**
 * Where each loose flight is hanging when the room begins, as an offset from where it belongs: across (x),
 * along (z) and turned (yaw). The first only needs a push; the second has to come round; the third has drifted
 * behind the tower and has to be brought back past it.
 */
export const LOOSE_START = [
  { x: 4.6, z: -1.2, yaw: 0.28 },
  { x: -5.4, z: 0.6, yaw: 1.3 },
  { x: 5.2, z: -7.6, yaw: -2.4 },
] as const;

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

export const STEP = { rise: 0.2, going: 0.3, risers: 11, width: 1.45, landing: 1.9, gap: 0.3 } as const;
/** How far one flight climbs, and how far along the ground it runs. */
export const FLIGHT_RISE = STEP.rise * STEP.risers;
export const FLIGHT_RUN = STEP.going * (STEP.risers - 1);

/** The south line of the flights: odd flights start here and climb north; even flights arrive here. */
const ZA = -1233;
const ZB = ZA - FLIGHT_RUN;
const MID_X = 103;
export const LANE = { west: MID_X - (STEP.width + STEP.gap) / 2, east: MID_X + (STEP.width + STEP.gap) / 2 } as const;
export const STAIRS_Z = { south: ZA, north: ZB } as const;
/** How far a landing reaches out past the outer edge of either lane. */
const RIM = 0.08;

/**
 * Thirteen flights: two standing on the grass, three hanging loose in the gap above them, two more coming down out
 * of the cloud to meet them, and six going up through it to the top landing.
 */
export const FLIGHTS = 13;
export const LOOSE = [3, 4, 5] as const;
/** The last flight below the white: the child waits at its top while the bird goes on up first. */
export const BELOW_CLOUD = 7;

export function levelHeight(level: number): number {
  return STAIRS_GROUND + level * FLIGHT_RISE;
}

/** The cloud lies over everything from here to here; the top landing stands just clear of it. */
export const CLOUD = { base: levelHeight(BELOW_CLOUD) + 1.5, top: levelHeight(FLIGHTS) - 1.1 } as const;

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

/** The floor a flight arrives on: across both lanes, and at the top a wide platform open to the west. */
export interface Landing { x0: number; x1: number; z0: number; z1: number; y: number }

/** The top landing is deeper than the half-landings and runs on west past the stair, open to the sun. */
const TOP_DEPTH = 2.9;
const TOP_WEST = 1.35;

export function landingOf(index: number): Landing {
  const north = index % 2 === 1;
  const depth = index === FLIGHTS ? TOP_DEPTH : STEP.landing;
  const near = north ? ZB : ZA;
  const far = north ? ZB - depth : ZA + depth;
  return {
    x0: LANE.west - STEP.width / 2 - RIM - (index === FLIGHTS ? TOP_WEST : 0),
    x1: LANE.east + STEP.width / 2 + RIM,
    z0: Math.min(near, far), z1: Math.max(near, far),
    y: levelHeight(index),
  };
}

export function flight(index: number): Flight {
  const north = index % 2 === 1;
  const x = north ? LANE.west : LANE.east;
  const z0 = north ? ZA : ZB;
  const z1 = north ? ZB : ZA;
  const y0 = levelHeight(index - 1);
  const y1 = levelHeight(index);
  const l = landingOf(index);
  return {
    index,
    lane: north ? 'west' : 'east',
    bottom: new THREE.Vector3(x, y0, z0),
    top: new THREE.Vector3(x, y1, z1),
    landing: new THREE.Vector3(MID_X, y1, (l.z0 + l.z1) / 2),
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
export const TOP_EDGE = landingOf(FLIGHTS).x0 + 0.05;
export const SLIPPERS = new THREE.Vector3(TOP_EDGE + 0.3, TOP.y, TOP.z + 0.35);
export const SIT = new THREE.Vector3(TOP_EDGE + 0.42, TOP.y, TOP.z - 0.3);
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
 * along (z) and turned (yaw). The first is just out beside its place; the second has drifted across and turned
 * round; the third has gone out behind the tower and has to be brought back round it.
 */
export const LOOSE_START = [
  { x: 4.2, z: 1.4, yaw: 0.35 },
  { x: -5.2, z: -1.2, yaw: 1.4 },
  { x: 4.8, z: -8.2, yaw: -2.3 },
] as const;

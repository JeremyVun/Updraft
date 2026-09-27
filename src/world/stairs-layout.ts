import * as THREE from 'three';

/**
 * The island the stairs stand on: a small grassy knoll off the birches' north-east beach, under a low cloud deck.
 * The staircase has no house round it. It climbs away north from the grass, up and onward: each flight goes off to
 * one side, turns on a landing, and the next goes off to the other, so it zigzags on up toward the cloud and never
 * comes back toward you.
 */
export const STAIRS_ISLE = { x: 100, z: -1236, rx: 30, rz: 26 } as const;

/** The ground at the foot of the stair is levelled to this height over `STAIRS_TERRACE` metres. */
export const STAIRS_GROUND = 4.6;
export const STAIRS_TERRACE = { x: 100, z: -1222, radius: 7.5 } as const;

export const STEP = { rise: 0.2, going: 0.3, risers: 11, width: 1.45, landing: 2.0 } as const;
/** How far one flight climbs, and how far along the ground it runs. */
export const FLIGHT_RISE = STEP.rise * STEP.risers;
export const FLIGHT_RUN = STEP.going * (STEP.risers - 1);

/** Where the first riser stands on the grass, and how far each flight turns off the way north. */
const FOOT = { x: 99, z: -1221 } as const;
const SWING = Math.PI / 4;

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
  /** Bottom and top of the walking line, down its middle: the foot of the first riser and the nosing of the last. */
  bottom: THREE.Vector3;
  top: THREE.Vector3;
  /** The middle of the landing it arrives on, where the walk turns for the next flight. */
  landing: THREE.Vector3;
  /** Which way it climbs, as a turn about the vertical: it goes toward (sin yaw, 0, cos yaw). */
  yaw: number;
}

/**
 * The floor a flight arrives on, square to that flight: its middle, and how far it reaches either side (x, to the
 * climber's left positive) and back and forth (z, the way they were climbing positive). `exit` is the side the next
 * flight leaves from, +1 left, -1 right, 0 none.
 */
export interface Landing { centre: THREE.Vector3; yaw: number; x0: number; x1: number; z0: number; z1: number; exit: -1 | 0 | 1 }

/** The top landing is bigger than the others and runs on out to the left, open there to the sun. */
const TOP_DEPTH = 2.9;
const TOP_WIDE = 1.35;

export const along = (yaw: number) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
/** The climber's left when facing along `yaw`. */
export const leftOf = (yaw: number) => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

const yawOf = (index: number) => Math.PI + (index % 2 === 1 ? -SWING : SWING);

const built: { flights: Flight[]; landings: Landing[] } = (() => {
  const flights: Flight[] = [];
  const landings: Landing[] = [];
  const at = new THREE.Vector3(FOOT.x, STAIRS_GROUND, FOOT.z);
  const half = STEP.landing / 2;
  for (let i = 1; i <= FLIGHTS; i++) {
    const yaw = yawOf(i);
    const d = along(yaw);
    const bottom = at.clone();
    const top = bottom.clone().addScaledVector(d, FLIGHT_RUN).setY(levelHeight(i));
    const landing = top.clone().addScaledVector(d, half);
    const last = i === FLIGHTS;
    // Odd flights go off to the right of north and turn left onto the next; even ones the other way.
    const exit = last ? 0 : i % 2 === 1 ? 1 : -1;
    const L: Landing = last
      ? { centre: landing.clone(), yaw, x0: -half, x1: half + TOP_WIDE, z0: -half, z1: TOP_DEPTH - half, exit }
      : { centre: landing.clone(), yaw, x0: -half, x1: half, z0: -half, z1: half, exit };
    flights.push({ index: i, bottom, top, landing, yaw });
    landings.push(L);
    if (!last) at.copy(landing).addScaledVector(along(yawOf(i + 1)), half);
  }
  return { flights, landings };
})();

export function flight(index: number): Flight {
  const f = built.flights[index - 1];
  return { index, bottom: f.bottom.clone(), top: f.top.clone(), landing: f.landing.clone(), yaw: f.yaw };
}

export function landingOf(index: number): Landing {
  const L = built.landings[index - 1];
  return { ...L, centre: L.centre.clone() };
}

/** A point on a landing, from its own frame (x to the climber's left, z the way they were climbing) to the world. */
export function onLanding(L: Landing, x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(L.centre).addScaledVector(leftOf(L.yaw), x).addScaledVector(along(L.yaw), z);
}

/** Where the child steps off the grass onto the first tread. */
export const STAIRS_FOOT = flight(1).bottom.clone().addScaledVector(along(yawOf(1)), -1.2);

export const STAIRS_LANDING = new THREE.Vector2(76, -1231);
export const STAIRS_ARRIVAL = new THREE.Vector2(88, -1219);

/**
 * The top landing, open on its left side to the sun: the slippers are by that edge, the child sits there with their
 * feet over the cloud, and the boat lies alongside.
 */
const TOP_LANDING = landingOf(FLIGHTS);
export const TOP = TOP_LANDING.centre.clone();
/** The open edge: its middle, and the way out over it. */
export const TOP_EDGE = onLanding(TOP_LANDING, TOP_LANDING.x1 - 0.05, (TOP_LANDING.z0 + TOP_LANDING.z1) / 2);
export const TOP_OUT = leftOf(TOP_LANDING.yaw);
export const SLIPPERS = onLanding(TOP_LANDING, TOP_LANDING.x1 - 0.3, (TOP_LANDING.z0 + TOP_LANDING.z1) / 2 - 0.35);
export const SIT = onLanding(TOP_LANDING, TOP_LANDING.x1 - 0.42, (TOP_LANDING.z0 + TOP_LANDING.z1) / 2 + 0.3);
/** Where the boat lies alongside the open edge, bow toward the far end of the landing. */
export const CLOUD_BERTH = (() => {
  const p = TOP_EDGE.clone().addScaledVector(TOP_OUT, 1.4);
  return { x: p.x, z: p.z, yaw: TOP_LANDING.yaw } as const;
})();
/** Where the kite is tied off: the top landing's rail at the far corner of the open edge. */
export const KITE_TIE = onLanding(TOP_LANDING, TOP_LANDING.x1 - 0.05, TOP_LANDING.z1 - 0.05);

/**
 * The way over the cloud: out from the top landing and round in a slow loop, past the stair again from far off,
 * then west into the sun, into the cloud bank where the village is waiting under it. Laid out from the top landing.
 */
export const CLOUD_ROUTE = [
  [-2, -24], [17, -40], [41, -30], [49, -4], [35, 20], [9, 29], [-19, 23], [-43, 10], [-65, -4],
].map(([x, z]) => new THREE.Vector2(TOP.x + x, TOP.z + z));
/** On the last leg the cloud swells up round them. */
export const FOG_FROM = CLOUD_ROUTE.length - 1;
/** Where the hull is sailing on the sea when the drowned village takes over. */
export const DESCENT_END = new THREE.Vector2(16, -1254);

/**
 * Where each loose flight is hanging when the room begins, as an offset from where it belongs (x and z in the
 * world) and a turn. All three hang out east of the stair, on the side the puzzle is seen from: the first just out
 * beside its place, the second further off and turned across, the third low and away south, turned right round.
 */
export const LOOSE_START = [
  { x: 4.2, z: 1.2, yaw: 0.35 },
  { x: 5.5, z: -3.5, yaw: 1.4 },
  { x: 3.2, z: 6.5, yaw: -2.4 },
] as const;

import * as THREE from 'three';

/**
 * The island the stairs stand on: a small grassy knoll off the birches' north-east beach, under a low cloud deck.
 * The staircase has no house round it. It climbs away north from the grass, up and onward: each flight goes off to
 * one side, turns on a landing, and the next goes off to the other, so it zigzags on up toward the cloud and never
 * comes back toward you. Halfway up the white it goes round a square that seems to climb for ever.
 */
export const STAIRS_ISLE = { x: 100, z: -1236, rx: 30, rz: 26 } as const;

/** The ground at the foot of the stair is levelled to this height over `STAIRS_TERRACE` metres. */
export const STAIRS_GROUND = 4.6;
export const STAIRS_TERRACE = { x: 100, z: -1222, radius: 7.5 } as const;

export const STEP = { rise: 0.2, going: 0.3, risers: 11, width: 1.45, landing: 2.0 } as const;
/** How far one full flight climbs, and how far along the ground it runs. */
export const FLIGHT_RISE = STEP.rise * STEP.risers;
export const FLIGHT_RUN = STEP.going * (STEP.risers - 1);

/** Where the first riser stands on the grass. */
const FOOT = { x: 99, z: -1221 } as const;
const H = STEP.landing / 2;

/** The ways a flight can go: each is a quarter turn off the next. */
const NE = Math.PI * 0.75, NW = Math.PI * 1.25, SW = Math.PI * 1.75, SE = Math.PI * 0.25;

export const along = (yaw: number) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
/** The climber's left when facing along `yaw`. */
export const leftOf = (yaw: number) => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

/** The sides of a landing, in its own frame: behind the climber as they arrive, ahead of them, to their left and right. */
export type Face = 'back' | 'ahead' | 'left' | 'right';

/**
 * The floor a flight arrives on, square to that flight: its middle (where the walk turns), and how far it reaches
 * either side (x, to the climber's left positive) and back and forth (z, the way they were climbing positive).
 * `openings` are where a flight meets it, by face and how far along that face; `bare` faces have no rail at all.
 */
export interface Landing {
  centre: THREE.Vector3; yaw: number; x0: number; x1: number; z0: number; z1: number;
  openings: { face: Face; at: number }[];
  bare: Face[];
}

export interface Flight {
  index: number;
  /** Bottom and top of the walking line, down its middle: the foot of the first riser and the nosing of the last. */
  bottom: THREE.Vector3;
  top: THREE.Vector3;
  /** The middle of the landing it arrives on, where the walk turns for the next flight. */
  landing: THREE.Vector3;
  /** Which way it climbs, as a turn about the vertical: it goes toward (sin yaw, 0, cos yaw). */
  yaw: number;
  risers: number;
}

/**
 * The loop halfway up the white: four flights round a square, two short and two long. The long ones are longer by
 * just so much that from one place, and only from there, the top of the last flight lies exactly in front of the
 * foot of the first, so the square seems to climb for ever. That place is south of it, looking steeply down.
 */
const LOOP_SHORT = 3;
const LOOP_LONG = 9;

interface Spec { yaw: number; risers: number; exit: 'left' | 'right' | 'ahead' | null; x1?: number; z1?: number; extra?: { face: Face; at: number }[]; bare?: Face[] }

const TOP_DEPTH = 2.9;
const TOP_WIDE = 1.35;

/**
 * Up the grass and under the cloud in a zigzag; into the white; onto the corner of the loop (9), up its near side
 * to where the child waits (10), up the next to the corner the way on leaves from (11), and on up the white to the
 * top landing (15), which runs out to the left, open to the sun.
 */
const SPECS: Spec[] = [
  { yaw: NE, risers: 11, exit: 'left' },
  { yaw: NW, risers: 11, exit: 'right' },
  { yaw: NE, risers: 11, exit: 'left' },
  { yaw: NW, risers: 11, exit: 'right' },
  { yaw: NE, risers: 11, exit: 'left' },
  { yaw: NW, risers: 11, exit: 'right' },
  { yaw: NE, risers: 11, exit: 'left' },
  { yaw: NW, risers: 11, exit: 'right' },
  // The loop's near corner, open on its left where the loop's last flight seems to come onto it.
  { yaw: NE, risers: 11, exit: 'ahead', extra: [{ face: 'left', at: 0 }] },
  { yaw: NE, risers: LOOP_SHORT, exit: 'left' },
  // The loop's far corner: the way on goes straight ahead from it, and the loop turns off to the left.
  { yaw: NW, risers: LOOP_SHORT, exit: 'ahead', extra: [{ face: 'left', at: 0 }] },
  { yaw: NW, risers: 11, exit: 'right' },
  { yaw: NE, risers: 11, exit: 'left' },
  { yaw: NW, risers: 11, exit: 'right' },
  { yaw: NE, risers: 11, exit: null, x1: H + TOP_WIDE, z1: TOP_DEPTH - H, bare: ['left'] },
];

export const FLIGHTS = SPECS.length;
export const LOOSE = [3, 4, 5] as const;
/** The last flight below the white: the child waits at its top while the bird goes on up first. */
export const BELOW_CLOUD = 7;
/** The loop: the corner it seems to close on, the landing the child waits on, and the corner the way on leaves from. */
export const LOOP = { corner: 9, wait: 10, onward: 11 } as const;

/** Where a flight leaving a landing by one of its faces starts, in the landing's frame. */
function faceOf(L: Pick<Landing, 'x0' | 'x1' | 'z1'>, exit: 'left' | 'right' | 'ahead'): [number, number] {
  return exit === 'left' ? [L.x1, 0] : exit === 'right' ? [L.x0, 0] : [0, L.z1];
}
const faceName = (exit: 'left' | 'right' | 'ahead'): Face => exit;

function point(L: Pick<Landing, 'centre' | 'yaw'>, x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(L.centre).addScaledVector(leftOf(L.yaw), x).addScaledVector(along(L.yaw), z);
}

/** A flight up from `bottom` along `yaw`, and the landing it arrives on. */
function lay(index: number, bottom: THREE.Vector3, s: Spec): { flight: Flight; landing: Landing } {
  const run = STEP.going * (s.risers - 1);
  const top = bottom.clone().addScaledVector(along(s.yaw), run).setY(bottom.y + s.risers * STEP.rise);
  const centre = top.clone().addScaledVector(along(s.yaw), H);
  const openings: Landing['openings'] = [{ face: 'back', at: 0 }, ...(s.extra ?? [])];
  const L: Landing = { centre, yaw: s.yaw, x0: -H, x1: s.x1 ?? H, z0: -H, z1: s.z1 ?? H, openings, bare: s.bare ?? [] };
  if (s.exit) {
    const [x, z] = faceOf(L, s.exit);
    openings.push({ face: faceName(s.exit), at: s.exit === 'ahead' ? x : z });
  }
  return { flight: { index, bottom: bottom.clone(), top, landing: centre.clone(), yaw: s.yaw, risers: s.risers }, landing: L };
}

const built = (() => {
  const flights: Flight[] = [];
  const landings: Landing[] = [];
  const at = new THREE.Vector3(FOOT.x, STAIRS_GROUND, FOOT.z);
  SPECS.forEach((s, i) => {
    const { flight, landing } = lay(i + 1, at, s);
    flights.push(flight);
    landings.push(landing);
    if (s.exit) {
      const [x, z] = faceOf(landing, s.exit);
      point(landing, x, z, at);
    }
  });
  // The rest of the loop, which only the bird goes round: down the long far side from the corner the way on leaves
  // from, round the far corner, and back along the other long side toward the corner it seems to close on.
  const onward = landings[LOOP.onward - 1];
  const far = lay(0, point(onward, onward.x1, 0), { yaw: SW, risers: LOOP_LONG, exit: 'left' });
  const [cx, cz] = faceOf(far.landing, 'left');
  const bottom = point(far.landing, cx, cz);
  const top = bottom.clone().addScaledVector(along(SE), STEP.going * (LOOP_LONG - 1)).setY(bottom.y + LOOP_LONG * STEP.rise);
  // It comes onto a copy of the near corner by that corner's long left side, as if onto the corner itself.
  const corner = landings[LOOP.corner - 1];
  const reach = corner.x1;
  const centre = top.clone().addScaledVector(along(SE), reach);
  const back: Flight = { index: 0, bottom, top, landing: centre, yaw: SE, risers: LOOP_LONG };
  return { flights, landings, far, back, gap: centre.clone().sub(corner.centre) };
})();

export function flight(index: number): Flight {
  const f = built.flights[index - 1];
  return { ...f, bottom: f.bottom.clone(), top: f.top.clone(), landing: f.landing.clone() };
}

export function landingOf(index: number): Landing {
  const L = built.landings[index - 1];
  return { ...L, centre: L.centre.clone(), openings: L.openings.map(o => ({ ...o })), bare: [...L.bare] };
}

/** A point on a landing, from its own frame (x to the climber's left, z the way they were climbing) to the world. */
export function onLanding(L: Pick<Landing, 'centre' | 'yaw'>, x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  return point(L, x, z, out);
}

/**
 * The loop's far side, which only the bird goes round: the long flight down from the onward corner to the far
 * corner, the far corner itself, and the long flight from there that seems to come up onto the near corner. That
 * last one arrives, as built, a whole round of the loop higher than the near corner and nearer the eye, at a copy
 * of that corner `LOOP_GAP` away (`LOOP_BACK.landing` is its middle); `stairs-penrose` shrinks the copy about the eye
 * until it lies exactly over the corner.
 */
export const LOOP_FAR = { flight: built.far.flight, landing: built.far.landing } as const;
export const LOOP_BACK = built.back;
/** From the near corner to the copy of it the loop's last flight arrives on: a whole round higher, toward the eye. */
export const LOOP_GAP = built.gap;

export const levelHeight = (index: number) => (index <= 0 ? STAIRS_GROUND : built.flights[index - 1].top.y);

/** The cloud lies over everything from here to here; the top landing stands just clear of it. */
export const CLOUD = { base: levelHeight(BELOW_CLOUD) + 1.5, top: levelHeight(FLIGHTS) - 1.1 } as const;

/** Where the child steps off the grass onto the first tread. */
export const STAIRS_FOOT = flight(1).bottom.clone().addScaledVector(along(NE), -1.2);

export const STAIRS_LANDING = new THREE.Vector2(76, -1231);
export const STAIRS_ARRIVAL = new THREE.Vector2(92, -1219);

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
 * world) and a turn. Each hangs level with its place and off to one side of it as the puzzle is seen from behind the
 * child, never between the lens and its drawing: the first out to the right, the second to the left and turned
 * across, the third to the right again and turned right round.
 */
export const LOOSE_START = [
  { x: 4.2, z: 0, yaw: 0.4 },
  { x: -4.6, z: -0.4, yaw: -1.3 },
  { x: 4.6, z: 0.4, yaw: -2.4 },
] as const;

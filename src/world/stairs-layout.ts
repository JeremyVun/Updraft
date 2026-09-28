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
const LOOP_SHORT = 4;
const LOOP_LONG = 12;
/**
 * The loop's corners are no wider than a flight with its rails, which run straight on round them, so the loop reads
 * as one ring of stairs rather than landings with steps between.
 */
export const CORNER = 1.87;

interface Spec {
  yaw: number; risers: number; exit: 'left' | 'right' | 'ahead' | null; x1?: number; z1?: number; extra?: { face: Face; at: number }[]; bare?: Face[];
  /** A square landing this wide rather than the usual. */
  size?: number;
}

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
  { yaw: NE, risers: 11, exit: 'ahead', extra: [{ face: 'left', at: 0 }], size: CORNER },
  { yaw: NE, risers: LOOP_SHORT, exit: 'left', size: CORNER },
  // The loop's far corner: the way on goes straight ahead from it, and the loop turns off to the left.
  { yaw: NW, risers: LOOP_SHORT, exit: 'ahead', extra: [{ face: 'left', at: 0 }], size: CORNER },
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
  const h = (s.size ?? STEP.landing) / 2;
  const centre = top.clone().addScaledVector(along(s.yaw), h);
  const openings: Landing['openings'] = [{ face: 'back', at: 0 }, ...(s.extra ?? [])];
  const L: Landing = { centre, yaw: s.yaw, x0: -h, x1: s.x1 ?? h, z0: -h, z1: s.z1 ?? h, openings, bare: s.bare ?? [] };
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
  const far = lay(0, point(onward, onward.x1, 0), { yaw: SW, risers: LOOP_LONG, exit: 'left', size: CORNER });
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
/** Where the child stops, on the level grass a few steps short of the first tread, to look up the stair. */
export const STAIRS_ARRIVAL = new THREE.Vector2(96.4, -1219.2);
/** What the lens looks up at over her shoulder there: the stair going up from her toward the cloud (its height is hers). */
export const STAIRS_LOOK_UP = new THREE.Vector3(99.8, 0, -1231);
/**
 * Where the lens stands for it, with a longer lens (`STAIRS_LOOK_ZOOM`): well down the slope behind her and off to
 * her right, over the grass, so that she stands at the left of the frame with all of her in it and the stair looms
 * over her.
 */
export const STAIRS_LOOK_FROM = (() => {
  const back = new THREE.Vector3(STAIRS_ARRIVAL.x - STAIRS_LOOK_UP.x, 0, STAIRS_ARRIVAL.y - STAIRS_LOOK_UP.z).normalize();
  return new THREE.Vector3(STAIRS_ARRIVAL.x, 0, STAIRS_ARRIVAL.y)
    .addScaledVector(back, 13).addScaledVector(new THREE.Vector3(back.z, 0, -back.x), 3.4);
})();
export const STAIRS_LOOK_ZOOM = 1.3;

/**
 * The top landing, open on its left side to the sun: the slippers are by that edge, the child sits there with their
 * feet over the cloud, and the boat lies alongside.
 */
const TOP_LANDING = landingOf(FLIGHTS);
export const TOP = TOP_LANDING.centre.clone();
/** The open edge: its middle, and the way out over it. */
export const TOP_EDGE = onLanding(TOP_LANDING, TOP_LANDING.x1 - 0.05, (TOP_LANDING.z0 + TOP_LANDING.z1) / 2);
export const TOP_OUT = leftOf(TOP_LANDING.yaw);
/** How far in from the open edge she sits: on the lip, so her feet hang over the cloud. */
const SIT_IN = 0.12;
/**
 * The slippers, and the bird in one, on her right (her left is the bag's outer face, where the stowed paper hides it),
 * a bird's width clear of her coat.
 */
export const SLIPPERS = onLanding(TOP_LANDING, TOP_LANDING.x1 - SIT_IN - 0.05, (TOP_LANDING.z0 + TOP_LANDING.z1) / 2 + 0.55);
export const SIT = onLanding(TOP_LANDING, TOP_LANDING.x1 - SIT_IN, (TOP_LANDING.z0 + TOP_LANDING.z1) / 2 - 0.4);
/** Where the boat lies alongside the open edge, bow toward the far end of the landing. */
export const CLOUD_BERTH = (() => {
  const p = TOP_EDGE.clone().addScaledVector(TOP_OUT, 1.2);
  return { x: p.x, z: p.z, yaw: TOP_LANDING.yaw } as const;
})();
/** Where the kite is tied off: the top landing's rail at the far corner of the open edge. */
export const KITE_TIE = onLanding(TOP_LANDING, TOP_LANDING.x1 - 0.05, TOP_LANDING.z1 - 0.05);

/** The run over the cloud goes this way on the whole: toward the low sun, which stands a little to starboard of it. */
export const RUN_YAW = -2.2;
/** How far the boat comes round off the landing, and how far on the bank of mist stands across the way. */
const TURN_RADIUS = 22;
const RUN_TO_BANK = 300;
/**
 * The way wanders across the open cloud, [how far on, how far to starboard] from where the turn off the landing
 * ends: out to port among the heaps, back across to starboard past the towers, and straight on into the bank.
 */
const MEANDER: readonly [number, number][] = [[0, 0], [30, -10], [75, -24], [125, -18], [170, 6], [215, 22], [255, 12], [285, 0], [RUN_TO_BANK + 90, 0]];

/** A point [how far on, how far to starboard] of where the run starts. */
function onRun(from: THREE.Vector3, on: number, starboard: number): THREE.Vector3 {
  return from.clone().addScaledVector(along(RUN_YAW), on).addScaledVector(leftOf(RUN_YAW), -starboard);
}

const TURN_CENTRE = new THREE.Vector3(CLOUD_BERTH.x, 0, CLOUD_BERTH.z).addScaledVector(leftOf(CLOUD_BERTH.yaw), TURN_RADIUS);
const roundTheTurn = (yaw: number) => TURN_CENTRE.clone().addScaledVector(leftOf(yaw), -TURN_RADIUS);
/** Where the turn off the landing ends and the run begins. */
const RUN_FROM = roundTheTurn(RUN_YAW);
/**
 * The way over the cloud: off the top landing in one slow turn to port, away from the stair and round toward the
 * low sun, then a long wander across the open cloud, one smooth curve through the meander, into the bank of mist.
 */
export const CLOUD_ROUTE = (() => {
  const turn = RUN_YAW + Math.PI * 2 - CLOUD_BERTH.yaw;
  const points = [0.3, 0.55, 0.8].map(k => roundTheTurn(CLOUD_BERTH.yaw + turn * k));
  const curve = new THREE.CatmullRomCurve3(MEANDER.map(([on, side]) => onRun(RUN_FROM, on, side)), false, 'centripetal');
  const length = curve.getLength();
  for (let d = 0; d < length - 90; d += 16) points.push(curve.getPointAt(d / length));
  points.push(onRun(RUN_FROM, RUN_TO_BANK + 90, 0));
  return points.map(p => new THREE.Vector2(p.x, p.z));
})();
/** The bank of mist across the way: a point on its front, and the way into it. */
export const FOG_BANK = (() => {
  const front = onRun(RUN_FROM, RUN_TO_BANK, 0);
  return { x: front.x, z: front.z, yaw: RUN_YAW } as const;
})();
/**
 * The stretch of the wander where the heaped towers crowd in close either side and the boat sails between them,
 * crossing back to starboard, while the lens rises astern to show how small the boat is among them.
 */
export const TOWER_GATE = (() => {
  const from = onRun(RUN_FROM, 150, -6), to = onRun(RUN_FROM, 240, 18);
  return { from: new THREE.Vector2(from.x, from.z), to: new THREE.Vector2(to.x, to.z) } as const;
})();
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

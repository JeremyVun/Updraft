import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Floor, SquirrelPoint } from '../creatures/squirrel';
import { FALLEN_LOG, FORK_BRANCH, SCARF_SNAGS } from '../world/birch-scarf';
import { BIRCH_PILES, ROUND_VIEWS, type AutumnBirches } from '../world/birches';
import { birchesAt, birchesGap } from '../world/birches-layout';
import { heightAt } from '../world/island';

/**
 * Where the squirrel's hide-and-seek happens on the birches' walk: each round's heaps, the child's place at them and
 * the lens on them; where the squirrel sits, perches and runs between rounds. Everything is authored in the
 * island's band-local terms (`birches-layout.ts`). Plain data; `story/birches-squirrel.ts` plays it.
 */

interface Spot { x: number; z: number }

const ground = (x: number, z: number): number => Math.max(0, heightAt(x, z));
const lifted = (p: Spot, lift = 0): THREE.Vector3 => new THREE.Vector3(p.x, ground(p.x, p.z) + lift, p.z);

/**
 * A view in the vocabulary of `BirchesChapter.frame()`: the point looked at, `lift` above the ground under it; the
 * way from it to the lens; how far back and how high above it the lens stands.
 */
export interface RoomFrame {
  at: Spot;
  lift: number;
  from: Spot;
  distance: number;
  height: number;
  /** A longer lens (2 halves the field), eased in and out by the camera. */
  zoom?: number;
}
/** Portrait has its own, because its field is half as wide: heaps side by side in landscape stand one behind another in it. */
export interface Frames {
  landscape: RoomFrame;
  portrait: RoomFrame;
}

/** The narrowest screen a portrait frame is composed for (390 × 844); narrower ones stand further back. */
const PORTRAIT_ASPECT = 390 / 844;
const lens = new THREE.Vector3();

/** Writes `frames` for a screen of `aspect` into `shot`. */
export function frameShot(frames: Frames, aspect: number, shot: Shot): Shot {
  const f = aspect < 1 ? frames.portrait : frames.landscape;
  shot.target.copy(lifted(f.at, f.lift));
  shot.from = lens.set(f.from.x, 0, f.from.z).normalize();
  shot.distance = f.distance * (aspect < 1 ? Math.max(1, PORTRAIT_ASPECT / aspect) : 1);
  shot.height = f.height;
  shot.zoom = f.zoom;
  return shot;
}

/** Round `i`'s view (`ROUND_VIEWS`, kept clear of gap-grown trees), from `distance` back and `height` up. */
const view = (i: number, distance: number, height: number): RoomFrame => ({ ...ROUND_VIEWS[i], lift: 1.2, distance, height });
/**
 * Portrait's view of a round, from the bearing `degrees` (0 looks north from the south, 90 west from the east): its
 * field is half as wide, so heaps side by side in landscape stand one behind another in it, on a lens a little longer
 * so the far heaps read too. Every round uses the same lens, eased in as she comes to the heaps.
 */
const PORTRAIT_ZOOM = 1.6;
const tall = (at: Spot, degrees: number, distance: number, height: number, lift: number, zoom = PORTRAIT_ZOOM): RoomFrame =>
  ({ at, from: { x: Math.sin(THREE.MathUtils.degToRad(degrees)), z: Math.cos(THREE.MathUtils.degToRad(degrees)) }, lift, distance, height, zoom });
const lensOf = (i: number, distance: number): Spot =>
  ({ x: ROUND_VIEWS[i].at.x + ROUND_VIEWS[i].from.x * distance, z: ROUND_VIEWS[i].at.z + ROUND_VIEWS[i].from.z * distance });

const pile = (i: number): Spot => BIRCH_PILES[i];
/** A point in a heap `share` of its radius out from its middle toward `toward`. */
const inPile = (i: number, toward: Spot, share: number): THREE.Vector3 => {
  const p = pile(i), d = Math.hypot(toward.x - p.x, toward.z - p.z) || 1, r = BIRCH_PILES[i].r * share;
  return lifted({ x: p.x + (toward.x - p.x) / d * r, z: p.z + (toward.z - p.z) / d * r });
};
/** Under a heap's crest, just past its middle from round `round`'s lens, where its tail tip shows over the top. */
const crest = (i: number, round: number): THREE.Vector3 =>
  inPile(i, { x: pile(i).x - ROUND_VIEWS[round].from.x * 10, z: pile(i).z - ROUND_VIEWS[round].from.z * 10 }, 0.1);
/** The rim of a heap nearest `from`, a little outside it. */
const rimOf = (i: number, from: Spot): THREE.Vector3 => inPile(i, from, 1.15);

/** A round lying limb or log, from `a` to `b`, `r0` thick at `a` and `r1` at `b`. */
export interface Limb {
  a: THREE.Vector3;
  b: THREE.Vector3;
  r0: number;
  r1: number;
}

/** The top of a limb `t` of the way along it. */
export function onLimb(limb: Limb, t: number): THREE.Vector3 {
  return new THREE.Vector3().lerpVectors(limb.a, limb.b, t).setY(limb.a.y + (limb.b.y - limb.a.y) * t + limb.r0 + (limb.r1 - limb.r0) * t);
}

/** A limb's upper surface as a floor for paws: round over its top, falling away past its sides. */
export function overLimb(limb: Limb): Floor {
  const ax = limb.b.x - limb.a.x, az = limb.b.z - limb.a.z, span = ax * ax + az * az;
  return (x, z) => {
    const t = THREE.MathUtils.clamp(((x - limb.a.x) * ax + (z - limb.a.z) * az) / span, 0, 1);
    const d = Math.hypot(x - (limb.a.x + ax * t), z - (limb.a.z + az * t));
    const r = limb.r0 + (limb.r1 - limb.r0) * t;
    return limb.a.y + (limb.b.y - limb.a.y) * t + Math.sqrt(Math.max(0, r * r - d * d)) - Math.max(0, d - r) * 4;
  };
}

/** The fallen birch the first heap is banked against, from `t` to `u` of its length, as `world/birches.ts` lays it. */
const fallen = (t: number, u: number): Limb => {
  const at = (k: number) => lifted({ x: FALLEN_LOG.a.x + (FALLEN_LOG.b.x - FALLEN_LOG.a.x) * k, z: FALLEN_LOG.a.z + (FALLEN_LOG.b.z - FALLEN_LOG.a.z) * k }, 0.16);
  return { a: at(t), b: at(u), r0: 0.34 * (1 - t * 0.42), r1: 0.34 * (1 - u * 0.42) };
};

/** A place on the bark of the standing tree nearest `tree`, `height` above its foot, on the side facing `toward`. */
export interface OnTrunk {
  tree: Spot;
  height: number;
  toward: Spot;
}

/** Where it holds still: sitting on the ground, a log or a limb (`at`, `yaw`, `floor`), or flat to a trunk's bark. */
export type PerchSpec =
  | { action: 'sit' | 'perch'; at: THREE.Vector3; yaw: number; floor?: Floor; radius?: number }
  | { action: 'climb'; trunk: OnTrunk };

const MEETING_LOG = fallen(0.68, 0.88);

/**
 * The meeting: sitting up on the fallen birch where it comes out of the heap's near flank, nut in paws, facing down the
 * ride at them. From the round's lens it stands clear of the heap; at the far rim the heap hid half of it.
 */
export const MEETING = { action: 'sit', at: onLimb(MEETING_LOG, 0.5), yaw: Math.atan2(-0.6, 0.8), floor: overLimb(MEETING_LOG) } satisfies PerchSpec;

export interface Round {
  /** Where the round is played: its hides are within it, and so is the readback for the live leaf depth. */
  area: Spot & { r: number };
  /** Its heaps, as indices into `BIRCH_PILES`. */
  heaps: readonly number[];
  /** Where in each of them it lies hidden: under its crest, where the tip of its tail shows from the lens. */
  hides: readonly THREE.Vector3[];
  /** Where she stops at the heaps' edge to crouch and peer, and what she faces while she waits for the first gust. */
  stand: THREE.Vector3;
  face: THREE.Vector3;
  /** Where it was last seen as the round begins: in the first, the log it dives from into the heap in plain sight. */
  lastSeen: THREE.Vector3;
  /** Where the cygnet is likely to be: beside her, and at the rim of each heap nearest her. */
  cygnet: readonly THREE.Vector3[];
  frames: Frames;
}

const STAND = [birchesAt(6.4, -1073.2), birchesGap(1, 14.4, 5.2), birchesGap(2, 13.5, -9.4)];

export const ROUNDS: readonly Round[] = [
  {
    area: { ...pile(0), r: 7 },
    heaps: [0],
    hides: [inPile(0, STAND[0], 0.1)],
    stand: lifted(STAND[0]),
    face: lifted(pile(0), 0.5),
    lastSeen: MEETING.at.clone(),
    cygnet: [lifted(birchesAt(7.6, -1074.4)), rimOf(0, STAND[0])],
    /** Portrait looks from further east, so she, the heap and the squirrel on its log fit across its narrow field. */
    frames: { landscape: view(0, 14, 4), portrait: tall(birchesAt(9.6, -1074.1), 60, 20, 5, 0.9, 1.5) },
  },
  {
    area: { ...STAND[1], r: 10 },
    heaps: [4, 5],
    hides: [crest(4, 1), crest(5, 1)],
    stand: lifted(STAND[1]),
    face: lifted(pile(5), 0.5),
    lastSeen: lifted(birchesGap(1, 12.6, 3)),
    cygnet: [lifted(birchesGap(1, 15.6, 5.9)), rimOf(4, STAND[1]), rimOf(5, STAND[1])],
    frames: { landscape: view(1, 15, 3.4), portrait: tall(birchesGap(1, 13.6, 4.6), 65, 14, 4.5, 1) },
  },
  {
    area: { ...STAND[2], r: 14 },
    heaps: [6, 7, 8],
    hides: [crest(6, 2), crest(7, 2), crest(8, 2)],
    stand: lifted(STAND[2]),
    face: lifted(pile(7), 0.5),
    lastSeen: lifted(birchesGap(2, 11, -10.5)),
    cygnet: [lifted(birchesGap(2, 14.3, -8.3)), rimOf(6, STAND[2]), rimOf(7, STAND[2]), rimOf(8, STAND[2])],
    frames: { landscape: view(2, 15, 4), portrait: tall(birchesGap(2, 13.8, -11.7), 45, 18, 4.5, 1) },
  },
];

/**
 * After the third round: from where she stands she runs at the deepest heap in the hollow (the cygnet already in it),
 * leaves the ground at its rim and lands sitting in its deep. The heap is the authored one; the live readback may
 * choose another drift, and the run is then laid out the same way to it.
 */
export const LEAP = { heap: 7, from: lifted(STAND[2]), takeOff: rimOf(7, STAND[2]), land: inPile(7, STAND[2], 0.15) };

/** The birch the first loop hangs on, from a branch at its fork; the height the branch leaves its trunk. */
const FORK_TREE = { x: SCARF_SNAGS[0].treeX, z: SCARF_SNAGS[0].treeZ };
const FORK_UP = FORK_BRANCH.a.y - ground(FORK_TREE.x, FORK_TREE.z);
const FORK_TIP = { x: FORK_BRANCH.b.x, z: FORK_BRANCH.b.z };
const T1_STOP = { x: SCARF_SNAGS[0].stopX, z: SCARF_SNAGS[0].stopZ };
/** Out along the first loop's branch, just short of the loop, where it sits beside the knot. */
const BESIDE_KNOT = 0.4;
const STUMP = { x: SCARF_SNAGS[1].treeX, z: SCARF_SNAGS[1].treeZ };
const STUMP_TOP = lifted(STUMP, 4.12);
const T2_STOP = { x: SCARF_SNAGS[1].stopX, z: SCARF_SNAGS[1].stopZ };
/** The broken birch's top, where it sits through the second tangle, and the ground round it. */
export const ON_THE_STUMP: Floor = (x, z) => (Math.hypot(x - STUMP.x, z - STUMP.z) < 0.5 ? STUMP_TOP.y : ground(x, z));
/** The birch standing behind the slipped loop, beyond the fallen one, in that tangle's view. */
const BEHIND_SLIP = birchesAt(0.8, -1171.6);
const BOW_TREE = { x: SCARF_SNAGS[3].treeX, z: SCARF_SNAGS[3].treeZ };
/** Down the ride from the tangles, so that a trunk's face toward it faces their lenses. */
const T1_LENS = { x: SCARF_SNAGS[0].stopX, z: SCARF_SNAGS[0].stopZ + 20 };
const T3_LENS = { x: SCARF_SNAGS[2].stopX, z: SCARF_SNAGS[2].stopZ + 20 };
const T4_LENS = { x: SCARF_SNAGS[3].stopX, z: SCARF_SNAGS[3].stopZ + 20 };
/** The hollow's far trunk: the bank of its farthest heap (`world/birches.ts` BANKS). */
const FAR_TREE = birchesGap(2, 23.5, -17.8);
const ROUND_3_LENS = lensOf(2, 15);
const P0 = birchesAt(20, -1099);
const SWING_TREE = birchesAt(-2.4, -1116.6);
/** Where the swing's lens stands, three-quarters on to the seat, so the trunk's face toward it faces the lens. */
const SWING_LENS = birchesAt(12, -1106.3);
const BERTH_SIDE = birchesAt(-7.4, -1194.8);

/**
 * At each tangle it waits ahead of her where the knot is, in sight of the work and out of the gesture's way and the
 * lens's: out on the first loop's branch beside the loop; on the broken birch's top, where the coils rise round it and slide off past it;
 * on the trunk standing behind the slipped loop; and up the bow's own birch, above its low limb.
 */
export const TANGLE_PERCHES: readonly PerchSpec[] = [
  { action: 'sit', at: onLimb(FORK_BRANCH, BESIDE_KNOT), yaw: Math.atan2(T1_STOP.x - FORK_TREE.x, T1_STOP.z - FORK_TREE.z), floor: overLimb(FORK_BRANCH) },
  { action: 'sit', at: STUMP_TOP, yaw: Math.atan2(T2_STOP.x - STUMP.x, T2_STOP.z - STUMP.z), floor: ON_THE_STUMP },
  { action: 'climb', trunk: { tree: BEHIND_SLIP, height: 4.5, toward: T3_LENS } },
  { action: 'climb', trunk: { tree: BOW_TREE, height: 5, toward: T4_LENS } },
];

/**
 * While she swings: on the swing tree's trunk just under the limb, on the side toward the lens, where its red reads
 * against the white bark. Out on the limb it sat in the sun's glow against the gold and was lost.
 */
export const SWING_PERCH: PerchSpec = { action: 'climb', trunk: { tree: SWING_TREE, height: 3.4, toward: SWING_LENS } };

/** Up the hollow's far trunk after the third round, watching the leap from the edge of the canopy. */
export const FAR_TRUNK: PerchSpec = { action: 'climb', trunk: { tree: FAR_TREE, height: 3.6, toward: ROUND_3_LENS } };

/**
 * The goodbye. No tree reaches the berth: its beach is sand below the tree line all the way up to the wood. So it
 * comes down the beach after them and sits up at the water's edge beside the boat, in the departure's view.
 */
export const GOODBYE: PerchSpec = { action: 'sit', at: lifted(BERTH_SIDE), yaw: Math.atan2(3.4, -2.2) };

/** A step of a way between the squirrel's places: on the ground, up or down a trunk, or along wool or a log. */
export type Step = { ground: Spot } | { trunk: OnTrunk } | { line: THREE.Vector3 };

const g = (x: number, z: number): Step => ({ ground: birchesAt(x, z) });
const gap = (i: number, into: number, x: number): Step => ({ ground: birchesGap(i, into, x) });
const bark = (tree: Spot, height: number, toward: Spot): Step => ({ trunk: { tree, height, toward } });
/** A point on the scarf as it hangs before its tangles are freed, `lift` above the ground: taken from the strip. */
const wool = (p: Spot, lift: number): Step => ({ line: lifted(p, lift) });

/**
 * Its ways between its places, each from where the last beat left it. Phase 5 puts its live position in front. Wool is
 * used only while it is still tied: the first length falls when the first tangle is freed, so from the first loop's
 * foot it runs to the first perch tree and takes the length that stays up there until the scarf is gathered.
 */
export const PATHS = {
  /** Out of the first heap, over the fallen birch and up the ride's edge ahead of her, up the first loop's birch and out along its branch. */
  toTangle1: [
    { line: onLimb(fallen(0.45, 0.5), 0.5) }, g(11.6, -1078.5), gap(0, 6, 9.5), gap(0, 14.5, 10.5), g(13, -1086.4),
    bark(FORK_TREE, 0.5, FORK_TIP), bark(FORK_TREE, FORK_UP, FORK_TIP), { line: onLimb(FORK_BRANCH, 0.12) }, { line: onLimb(FORK_BRANCH, BESIDE_KNOT) },
  ],
  /** Back along the branch, down the fork tree and round it, up the first perch tree to its coil, and down the wool to the floor of the second round. */
  toRound2: [
    { line: onLimb(FORK_BRANCH, BESIDE_KNOT) }, { line: onLimb(FORK_BRANCH, 0.12) }, bark(FORK_TREE, FORK_UP, FORK_TIP), bark(FORK_TREE, 0.5, T1_LENS), g(15.8, -1089.6), g(16.5, -1094), g(19.2, -1098.3),
    bark(P0, 0.5, birchesGap(1, 2, 13.6)), bark(P0, 5, birchesGap(1, 2, 13.6)), bark(P0, 9, birchesGap(1, 2, 13.6)),
    wool(birchesAt(20.51, -1099.74), 9.22), wool(birchesAt(19.26, -1100.43), 7.58), wool(birchesGap(1, 0.38, 16.66), 5.08),
    wool(birchesGap(1, 2.09, 13.58), 2.7), wool(birchesGap(1, 3.57, 10.93), 1.16), wool(birchesGap(1, 4.84, 8.64), 0.52),
    gap(1, 6.1, 6.3), gap(1, 9.5, 4.6), gap(1, 12.6, 3),
  ],
  /** Up the ride from the second round to the swing tree, and up its trunk to just under the limb. */
  toSwing: [g(3.6, -1103.5), g(1.2, -1110.5), bark(SWING_TREE, 0.5, SWING_LENS), bark(SWING_TREE, 3.4, SWING_LENS)],
  /** Down the swing tree and round it, across the crest to the broken birch, and up inside its loose coils to the top. */
  toTangle2: [
    bark(SWING_TREE, 3.4, SWING_LENS), bark(SWING_TREE, 0.5, SWING_LENS), g(-0.2, -1118.5),
    g(-4.5, -1124), g(-8, -1133), g(-9.3, -1137.5), bark(STUMP, 0.4, T2_STOP), bark(STUMP, 2, T2_STOP), bark(STUMP, 3.9, T2_STOP),
  ],
  /** Down the broken birch's far side and across the hollow, past the deep heap, to the third round. */
  toRound3: [
    bark(STUMP, 3.9, birchesAt(-10, -1145)), bark(STUMP, 0.4, birchesAt(-10, -1145)),
    g(-10, -1144), g(-9.5, -1151), gap(2, 4, -8.8), gap(2, 11, -10.5),
  ],
  /** From the found heap between the far two and up the hollow's far trunk. */
  toFarTrunk: [gap(2, 18.3, -15.5), gap(2, 23.6, -15.4), bark(FAR_TREE, 0.5, ROUND_3_LENS), bark(FAR_TREE, 3.6, ROUND_3_LENS)],
  /** Down the far trunk, behind the third tangle's watchers, to the birch beyond the slipped loop. */
  toTangle3: [
    bark(FAR_TREE, 3.6, ROUND_3_LENS), bark(FAR_TREE, 0.5, ROUND_3_LENS),
    g(-14, -1157), g(-8.5, -1163.5), g(-2.5, -1169), g(0.4, -1171), bark(BEHIND_SLIP, 0.5, T3_LENS), bark(BEHIND_SLIP, 4.5, T3_LENS),
  ],
  /** Down, along the top of the beach's wood to the bow's birch, and up above its low limb. */
  toTangle4: [
    bark(BEHIND_SLIP, 4.5, T3_LENS), bark(BEHIND_SLIP, 0.5, T3_LENS),
    g(-4, -1174), g(-9, -1178.5), g(-12.6, -1179.6), bark(BOW_TREE, 0.5, T4_LENS), bark(BOW_TREE, 5, T4_LENS),
  ],
  /** Down the bow's birch and down the beach after the boat. */
  toGoodbye: [bark(BOW_TREE, 5, T4_LENS), bark(BOW_TREE, 0.5, T4_LENS), g(-10.5, -1185), g(-8.5, -1191), { ground: BERTH_SIDE }],
} satisfies Record<string, readonly Step[]>;

const v = new THREE.Vector3();

/** A place on bark, as the trees are grown: on the bark's surface, its outward `up`, and the trunk's radius there. */
export function onTrunk(birches: AutumnBirches, t: OnTrunk): { at: THREE.Vector3; up: THREE.Vector3; radius: number } {
  const radius = birches.trunkAt(t.tree.x, t.tree.z, t.height, v);
  const up = new THREE.Vector3(t.toward.x - v.x, 0, t.toward.z - v.z).normalize();
  return { at: v.clone().addScaledVector(up, radius), up, radius };
}

/** A way as `Squirrel.follow` takes it. */
export function route(birches: AutumnBirches, steps: readonly Step[]): SquirrelPoint[] {
  return steps.map((s): SquirrelPoint => {
    if ('ground' in s) return { at: lifted(s.ground), on: 'ground' };
    if ('line' in s) return { at: s.line.clone(), on: 'line' };
    const { at, up, radius } = onTrunk(birches, s.trunk);
    return { at, on: 'trunk', up, radius };
  });
}

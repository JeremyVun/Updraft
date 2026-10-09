import * as THREE from 'three';
import { verticalFov, type Shot } from '../camera';
import type { Deck } from '../world/decks';
import { tuning } from '../tuning';
import {
  CAT_WAY, DARK_AT_STRAND, DARK_END, GRANARY_TOP, GREEN_TREE, LOOK_BACK, MILL, MILL_SITE, NAVE, PLACED, SHEET_SITE, SWING_SITE, TOWER_FOOT, TREE_SITE, WAY, WAY_GAPS, darkAlong, darkWayPoint, roofUnder,
  type WayDeck,
} from '../world/drowned-way';
import { HOIST } from '../world/crossings/windmill';
import type { CatStep } from '../world/crossings/cat-way';
import { TREE_SOUNDS, TreeCrossing } from '../world/crossings/tree-crossing';
import { SHEET_SOUNDS, SHEET_WAIT, SheetCrossing } from '../world/crossings/sheet-crossing';
import { MILL_SOUNDS, MillCrossing } from '../world/crossings/mill-crossing';
import { SWING_SOUNDS, SwingCrossing } from '../world/crossings/swing-crossing';
import { playCatSteps, type CatSteps } from './cat-steps';
import type { Cast } from './cast';

type Piece = 'tree' | 'sheet' | 'mill' | 'swing';
const ORDER: readonly Piece[] = ['tree', 'sheet', 'mill', 'swing'];

/** A place on her way, how she gets there from the one before, and how far along the way it is. */
interface Node {
  at: THREE.Vector3;
  by: 'walk' | 'hop' | Piece;
  s: number;
}

/** Where she waits for each piece and where she is once over it. */
const PIECES: Record<Piece, { wait: THREE.Vector3; onward: THREE.Vector3 }> = {
  tree: TREE_SITE.way,
  sheet: SHEET_SITE.way,
  mill: MILL_SITE.way,
  swing: { wait: SWING_SITE.way.board, onward: SWING_SITE.way.onward! },
};

const deckEnd = (name: WayDeck) => {
  const d: Deck = WAY[name];
  return new THREE.Vector3(d.x1, d.height1 ?? d.height, d.z1);
};

/** The nearest point to `p` on the deck called `name`. */
function onDeck(name: WayDeck, p: THREE.Vector3): THREE.Vector3 {
  const d: Deck = WAY[name], dx = d.x1 - d.x0, dz = d.z1 - d.z0;
  const u = THREE.MathUtils.clamp(((p.x - d.x0) * dx + (p.z - d.z0) * dz) / (dx * dx + dz * dz), 0, 1);
  const h1 = d.height1 ?? d.height;
  return new THREE.Vector3(d.x0 + dx * u, d.height + (h1 - d.height) * u, d.z0 + dz * u);
}

/**
 * Her way from the first roof's ridge to the tower's foot, place by place: the end of every deck she walks, the far
 * side of every hop, the place she waits at each piece and where she is once over it.
 */
function lay(): Node[] {
  const names = Object.keys(WAY) as WayDeck[];
  const gaps = new Map(WAY_GAPS.map((g) => [g.after, g]));
  const first = WAY.strand;
  const nodes: Node[] = [{ at: new THREE.Vector3(first.x0, first.height, first.z0), by: 'walk', s: 0 }];
  const add = (at: THREE.Vector3, by: Node['by']) => {
    const last = nodes[nodes.length - 1];
    nodes.push({ at: at.clone(), by, s: last.s + Math.hypot(at.x - last.at.x, at.z - last.at.z) });
  };
  const from = names.indexOf('strand');
  for (let i = from; i < names.length; i++) {
    const name = names[i], gap = gaps.get(name);
    const last = nodes[nodes.length - 1];
    if (gap?.by === 'hop') {
      add(gap.from, 'walk');
      add(gap.to, 'hop');
    } else if (gap) {
      add(PIECES[gap.by].wait, 'walk');
      add(PIECES[gap.by].onward, gap.by);
    } else if (last.by !== 'walk' && last.by !== 'hop' && deckEnd(name).distanceTo(last.at) < 1.5 && names[i + 1]) {
      /** Just over a piece with this deck all but behind her: straight onto the next. */
      add(onDeck(names[i + 1], last.at), 'walk');
    } else add(deckEnd(name), 'walk');
  }
  return nodes;
}

/** The hand-laid roofs, for the cat to come down on and the lens to see her past. */
const ROOFS = [...PLACED, NAVE];
/** The top of whichever hand-laid roof is under (x, z), or `y`: what the cat lands on. */
const roofOr = (y: number) => (x: number, z: number) => {
  let top = -Infinity;
  for (const h of ROOFS) top = Math.max(top, roofUnder(h, x, z) ?? -Infinity);
  return top > -Infinity ? top : y;
};

/**
 * Past the swing the cat comes off the churchyard's railings onto the nave's slope by the tower's foot, along the slope
 * and sits a little above where she lets go to, looking back at her; once she is over it goes on up to the tower's
 * foot. Its leap off the railings (clear of the tower's corner), where it lands, where it sits, and where it waits at
 * the foot.
 */
const CAT_OFF_RAILS = new THREE.Vector3(16.5, CAT_WAY.swing[2].y, NAVE.z + 4.8);
const CAT_ON_NAVE = new THREE.Vector3(14.6, 0, NAVE.z + 3.1);
CAT_ON_NAVE.y = roofOr(0)(CAT_ON_NAVE.x, CAT_ON_NAVE.z);
const CAT_PAST_SWING = new THREE.Vector3(SWING_SITE.way.landing.x - 0.6, 0, SWING_SITE.way.landing.z - 1.7);
CAT_PAST_SWING.y = roofOr(0)(CAT_PAST_SWING.x, CAT_PAST_SWING.z);
const CAT_AT_FOOT = new THREE.Vector3(TOWER_FOOT.x + 0.5, 0, NAVE.z + 0.45);
CAT_AT_FOOT.y = roofOr(0)(CAT_AT_FOOT.x, CAT_AT_FOOT.z);

/** The point `s` metres along a way laid as `nodes`. */
function wayAt(nodes: readonly Node[], s: number, out: THREE.Vector3): THREE.Vector3 {
  if (s <= 0) return out.copy(nodes[0].at);
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].s >= s) return out.lerpVectors(nodes[i - 1].at, nodes[i].at, (s - nodes[i - 1].s) / (nodes[i].s - nodes[i - 1].s || 1));
  }
  return out.copy(nodes[nodes.length - 1].at);
}

/**
 * Turns a place she looks at round her until it is no further toward the lens than `glanceOff` of straight away from
 * it, so her face never turns to the lens.
 */
export function lookAwayFrom(at: THREE.Vector3, her: THREE.Vector3, lens: THREE.Vector3): void {
  const away = Math.atan2(her.x - lens.x, her.z - lens.z);
  const want = Math.atan2(at.x - her.x, at.z - her.z), reach = Math.max(4, Math.hypot(at.x - her.x, at.z - her.z));
  const off = Math.atan2(Math.sin(want - away), Math.cos(want - away));
  const most = tuning.drowned.run.glanceOff;
  if (Math.abs(off) <= most) return;
  const to = away + Math.sign(off) * most;
  at.set(her.x + Math.sin(to) * reach, at.y, her.z + Math.cos(to) * reach);
}

/** How often along her way the walking lens is laid, metres. */
const LENS_STEP = 1.5;

/** True if the segment from `a` to `b` passes through `box` grown by `pad`. */
function crosses(a: THREE.Vector3, b: THREE.Vector3, box: THREE.Box3, pad: number): boolean {
  let t0 = 0, t1 = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = b[axis] - a[axis], lo = box.min[axis] - pad, hi = box.max[axis] + pad;
    if (Math.abs(d) < 1e-9) {
      if (a[axis] < lo || a[axis] > hi) return false;
      continue;
    }
    let u = (lo - a[axis]) / d, v = (hi - a[axis]) / d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 > t1) return false;
  }
  return true;
}

/** Where the walking lens stands at a place on her way: its bearing from her, how far off, how high, and the way she faces. */
interface LensKey {
  bearing: number;
  reach: number;
  rise: number;
  facing: number;
}

/** Each angle in turn brought within half a turn of the one before, so a swing round is never taken the long way. */
function unwrap(keys: LensKey[], field: 'facing'): void {
  for (let i = 1; i < keys.length; i++) {
    const d = keys[i][field] - keys[i - 1][field];
    keys[i][field] = keys[i - 1][field] + Math.atan2(Math.sin(d), Math.cos(d));
  }
}

/** Where a piece's own view leaves the lens as she walks on from it: how far along her way, and its bearing from her. */
interface Anchor {
  s: number;
  bearing: number;
}

/**
 * Where the walking lens stands at every `LENS_STEP` of her way, as a bearing round her: off her shoulder, near side on
 * to the way she is going, so she walks away across the frame and the fog's front, coming on behind her, reaches back
 * from that edge of it; never where she would walk toward it, it would look down on her steeply or lose the fog; where
 * a roof stands in the way or between it and her, swung round or drawn in as little as will do, and turning between
 * steps as little as it can and never faster than the rig follows, so it comes round a corner before she does.
 */
function* layLens(nodes: readonly Node[], obstacles: readonly THREE.Box3[], upright: boolean, anchors: readonly Anchor[]): Generator<void, LensKey[]> {
  const k = tuning.drownedCamera.run;
  const near = obstacles.filter((box) => nodes.some((n) => n.at.x > box.min.x - 30 && n.at.x < box.max.x + 30
    && n.at.z > box.min.z - 30 && n.at.z < box.max.z + 30));
  const total = nodes[nodes.length - 1].s;
  const most = upright ? k.uprightDistance : k.distance;
  const rise = upright ? k.uprightRise : k.rise;
  const sideOn = upright ? k.uprightSideOn : k.sideOn;
  /**
   * Where the fog's front is at each step of her way as she walks it, near and as far back as it lingers after a
   * piece, and the way it faces: toward her.
   */
  const fogAt: { x: number; z: number; dx: number; dz: number }[][] = [];
  for (let s = 0, along = DARK_AT_STRAND, at = new THREE.Vector3(), f = new THREE.Vector2(); s <= total + LENS_STEP * 2; s += LENS_STEP) {
    wayAt(nodes, s, at);
    along = Math.max(along, darkAlong(at.x, at.z, along));
    fogAt.push([-1, 0, k.fogSlack].map((slack) => {
      darkWayPoint(along - (slack < 0 ? tuning.drowned.run.fogLaid : tuning.drowned.run.fogTrail + slack), f);
      const l = Math.hypot(at.x - f.x, at.z - f.y) || 1;
      return { x: f.x, z: f.y, dx: (at.x - f.x) / l, dz: (at.z - f.y) / l };
    }));
  }
  /** The frame's half field, as the tangent of its half angle up and across. */
  const field = Math.tan(THREE.MathUtils.degToRad(verticalFov(upright ? 9 / 16 : 16 / 9)) / 2) / (upright ? k.uprightZoom : k.zoom);
  const across = field * (upright ? 9 / 16 : 16 / 9);
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), eye = new THREE.Vector3(), focus = new THREE.Vector3();
  const sight = new THREE.Vector3(), body = new THREE.Vector3(), look = new THREE.Vector3();
  /**
   * How far out to the frame's edge (1 at it) the nearest of the fog's front stands from `eye` looking at `look`,
   * once the look has turned toward it as far as `frame`'s glance may: along its line either side of her way, its foot
   * and back into it.
   */
  const room = Math.atan(across * k.herEdge), edge = Math.atan(across);
  const fogOut = (fog: { x: number; z: number; dx: number; dz: number }) => {
    const view = Math.atan2(look.x - eye.x, look.z - eye.z), down = Math.atan2(look.y - eye.y, Math.hypot(look.x - eye.x, look.z - eye.z));
    const herAt = Math.atan2(Math.sin(Math.atan2(p.x - eye.x, p.z - eye.z) - view), Math.cos(Math.atan2(p.x - eye.x, p.z - eye.z) - view));
    const lo = Math.max(-k.glanceMost, herAt - room), hi = Math.min(k.glanceMost, herAt + room);
    let nearest = Infinity;
    for (let aside = -k.fogReach; aside <= k.fogReach; aside += k.fogReach / 5) {
      for (const deep of [0, k.fogDeep]) {
        const x = fog.x - fog.dz * aside - fog.dx * deep - eye.x, z = fog.z + fog.dx * aside - fog.dz * deep - eye.z;
        const off = Math.atan2(Math.sin(Math.atan2(x, z) - view), Math.cos(Math.atan2(x, z) - view));
        const turned = Math.abs(off - THREE.MathUtils.clamp(off, lo, hi));
        if (turned > edge * 1.5) continue;
        const rise = Math.atan2(k.fogLow - eye.y, Math.hypot(x, z)) - down;
        nearest = Math.min(nearest, Math.max(Math.tan(turned) / across, Math.abs(Math.tan(rise)) / field));
      }
    }
    return nearest;
  };
  /**
   * Whether she walks toward a lens at `bearing` from her while it stands there: it is read `keyAhead` of her, and
   * comes round a little after it is asked to.
   */
  const toward = (s: number, bearing: number) => [s - k.keyAhead, s, s + k.towardAhead].some((at) => {
    wayAt(nodes, at - 0.5, a);
    wayAt(nodes, at + 1, b);
    return Math.cos(bearing - Math.atan2(b.x - a.x, b.z - a.z)) > k.toward;
  });
  /** What stands within reach of the lens at the step being laid. */
  let local: THREE.Box3[] = [], roofs: typeof ROOFS = [];
  const probe = new THREE.Vector3();
  /**
   * Her feet at `s`, and what a lens at `bearing`, `reach` and `lift` from there costs: `blocked` where it stands in
   * something or something hides her, otherwise as much as roofs, chimneys and walls crowd in close in front of it.
   */
  const cost = (s: number, bearing: number, reach: number, lift: number, facing: number) => {
    if (toward(s, bearing)) return k.blocked;
    wayAt(nodes, s, p);
    focus.copy(p).setY(p.y + 1.6);
    eye.set(p.x + Math.sin(bearing) * reach, p.y + lift, p.z + Math.cos(bearing) * reach);
    /** Never back in the fog coming on behind her, and the nearer its face the more it costs. */
    const fogs = fogAt[Math.min(fogAt.length - 1, Math.round(s / LENS_STEP))], fog = fogs[0];
    const clear = (eye.x - fog.x) * fog.dx + (eye.z - fog.z) * fog.dz;
    if (clear < 0) return k.blocked;
    const nearFog = Math.max(0, 1 - clear / k.fogClear) * k.fogNearCost;
    sight.lerpVectors(focus, eye, 0.6 / reach);
    body.lerpVectors(focus.setY(p.y + 0.8), eye, 0.6 / reach);
    focus.setY(p.y + 1.6);
    /** The slates of the roofs of her way, exactly: the one she is on hides her from below its ridge. */
    for (let u = 0; u < 1; u += 0.05) {
      const x = eye.x + (sight.x - eye.x) * u, z = eye.z + (sight.z - eye.z) * u, y = eye.y + (sight.y - eye.y) * u;
      if (roofs.some((h) => (roofUnder(h, x, z) ?? -Infinity) > y - (u === 0 ? 0.3 : 0))) return k.blocked;
    }
    for (const box of local) {
      const above = box.max.x - box.min.x < 2 && box.max.z - box.min.z < 2 ? k.clearOf : 0.4;
      if (eye.x > box.min.x - k.clearOf && eye.x < box.max.x + k.clearOf && eye.z > box.min.z - k.clearOf && eye.z < box.max.z + k.clearOf
        && eye.y < box.max.y + above) return k.blocked;
      /** What is below her waist cannot hide her from a lens above it; anything taller must leave her head and body clear. */
      if (box.max.y > p.y + 1 && ((!box.containsPoint(sight) && crosses(eye, sight, box, 0.1))
        || (!box.containsPoint(body) && crosses(eye, body, box, 0.1)))) return k.blocked;
    }
    /** Looking down on her from high, or with the fog coming on behind her out of the frame, costs. */
    const steep = Math.max(0, Math.atan2(eye.y - focus.y, reach) - k.steepFrom) * k.steepCost;
    look.set(p.x + Math.sin(facing) * k.lead, p.y + k.aim, p.z + Math.cos(facing) * k.lead);
    const unseen = Math.max(0, ...fogs.slice(1).map((f) => Math.min(3, fogOut(f)) - k.fogInFrame)) * k.fogCost;
    let crowd = (steep + unseen + nearFog) / k.crowdCost;
    /** A chimney close in front of the lens fills the near frame however clear the sightline is. */
    const ahead = probe.subVectors(focus, eye).setY(0).normalize();
    for (const box of local) {
      if (box.max.x - box.min.x > 2 || box.max.z - box.min.z > 2) continue;
      const near = box.distanceToPoint(eye);
      if (near > k.chimneyNear) continue;
      const cx = (box.min.x + box.max.x) / 2 - eye.x, cz = (box.min.z + box.max.z) / 2 - eye.z;
      if ((cx * ahead.x + cz * ahead.z) / (Math.hypot(cx, cz) || 1) > k.chimneyCone) crowd += (k.chimneyNear - near) * k.chimneyCost / k.crowdCost;
    }
    for (let u = 0.08; u < 0.5; u += 0.06) {
      probe.lerpVectors(eye, focus, u);
      for (const box of local) crowd += Math.max(0, k.crowdNear - box.distanceToPoint(probe));
      for (const h of roofs) {
        const top = roofUnder(h, probe.x, probe.z);
        if (top !== null) crowd += Math.max(0, k.crowdNear - (probe.y - top)) * 0.5;
      }
    }
    return crowd * k.crowdCost;
  };
  /**
   * Every bearing within reach of the one it wants and every share of its distance, at each step: the path through them
   * that stays clear and sees her, wanting least to be away from where it wants to be, drawn in, or turning between steps.
   * While she is at a piece its own view holds the lens, so there the path goes wherever suits the steps either side,
   * and just past it the path starts out from where that view leaves the lens.
   */
  const SHARES = [1, 0.82, 0.66, 0.52, 0.4];
  const ARC = 2.4, BEARINGS = 33, TURNS = 5;
  const held = nodes.flatMap((n, i) => (n.by === 'walk' || n.by === 'hop' ? [] : [[nodes[i - 1].s, n.s]]));
  const steps: { want: number; along: number; lift: number; free: boolean; anchor: { bearing: number; weight: number } | null }[] = [];
  for (let s = 0; s <= total + LENS_STEP; s += LENS_STEP) {
    wayAt(nodes, s - k.behind, a);
    wayAt(nodes, s + k.ahead, b);
    const along = Math.atan2(b.x - a.x, b.z - a.z);
    wayAt(nodes, s, p);
    const lift = THREE.MathUtils.clamp(p.y + rise, k.lowest, k.highest) - p.y;
    const handed = anchors.find((h) => s >= h.s && s < h.s + k.anchorFor);
    steps.push({ want: along + Math.PI, along, lift,
      free: held.some(([from, to]) => s > from && s < to),
      anchor: handed ? { bearing: handed.bearing, weight: 1 - Math.abs(s - handed.s) / k.anchorFor } : null });
  }
  for (let i = 1; i < steps.length; i++) {
    const d = steps[i].want - steps[i - 1].want;
    steps[i].want = steps[i - 1].want + Math.atan2(Math.sin(d), Math.cos(d));
  }
  const LIFTS = [0, k.lifted];
  const states = BEARINGS * SHARES.length * LIFTS.length;
  const shareOf = (j: number) => SHARES[Math.floor(j / LIFTS.length) % SHARES.length];
  const liftOf = (i: number, j: number) => Math.min(steps[i].lift + LIFTS[j % LIFTS.length], k.highest - wayAt(nodes, i * LENS_STEP, p).y);
  const bearingOf = (i: number, j: number) =>
    steps[i].want - ARC + (2 * ARC * Math.floor(j / (SHARES.length * LIFTS.length))) / (BEARINGS - 1);
  let sums = new Float64Array(states), next = new Float64Array(states);
  const from: Int16Array[] = [];
  for (let i = 0; i < steps.length; i++) {
    const came = new Int16Array(states);
    wayAt(nodes, i * LENS_STEP, p);
    local = near.filter((box) => box.distanceToPoint(p) < most + 4);
    roofs = ROOFS.filter((h) => Math.hypot(h.x - p.x, h.z - p.z) < most + 4 + h.len);
    for (let j = 0; j < states; j++) {
      const bearing = bearingOf(i, j), share = shareOf(j), lift = LIFTS[j % LIFTS.length];
      const off = Math.abs(bearing - steps[i].want) - sideOn;
      const anchor = steps[i].anchor, from = anchor ? Math.atan2(Math.sin(bearing - anchor.bearing), Math.cos(bearing - anchor.bearing)) : 0;
      const here = steps[i].free ? 0 : cost(i * LENS_STEP, bearing, most * share, liftOf(i, j), steps[i].along)
        + off * off * k.offCost + (1 - share) * (upright ? k.uprightInCost : k.inCost) + lift * k.liftCost + (anchor ? from * from * anchor.weight * k.anchorCost : 0);
      let best = i === 0 ? 0 : Infinity, by = 0;
      const per = SHARES.length * LIFTS.length, bi = Math.floor(j / per);
      if (i > 0) for (let q = Math.max(0, bi - TURNS) * per; q < Math.min(BEARINGS, bi + TURNS + 1) * per; q++) {
        const turn = bearing - bearingOf(i - 1, q), pull = shareOf(q) - share, rising = LIFTS[q % LIFTS.length] - lift;
        const whip = Math.max(0, Math.abs(turn) - k.turnMost);
        const c = sums[q] + turn * turn * k.turnCost + whip * whip * k.whipCost + pull * pull * k.pullCost + rising * rising * k.riseCost;
        if (c < best) { best = c; by = q; }
      }
      next[j] = best + here;
      came[j] = by;
    }
    from.push(came);
    [sums, next] = [next, sums];
    yield;
  }
  let at = 0;
  for (let j = 1; j < states; j++) if (sums[j] < sums[at]) at = j;
  const keys: LensKey[] = new Array(steps.length);
  for (let i = steps.length - 1; i >= 0; i--) {
    keys[i] = { bearing: bearingOf(i, at), reach: most * shareOf(at), rise: liftOf(i, at), facing: steps[i].along };
    at = from[i][at];
  }
  unwrap(keys, 'facing');
  const smooth = (passes: number, span: number, fields: (keyof LensKey)[]) => {
    for (let pass = 0; pass < passes; pass++) {
      const was = keys.map((key) => ({ ...key }));
      for (let i = 0; i < keys.length; i++) {
        const lo = Math.max(0, i - span), hi = Math.min(keys.length - 1, i + span);
        for (const field of fields) {
          let sum = 0;
          for (let j = lo; j <= hi; j++) sum += was[j][field];
          keys[i][field] = sum / (hi - lo + 1);
        }
      }
    }
  };
  smooth(2, 2, ['rise', 'facing']);
  return keys;
}

/**
 * Her run over the roofs after the cat, from the ridge of the first roof, where the boat lies aground, to the nave's
 * ridge at the foot of the church tower. She walks it herself, making the small hops on her own, and stops at each of
 * the four pieces facing it until the player's wind gets her over, each taking her higher than she was: the dead tree
 * pushed down across the lane and walked up onto the barn, the sheet filled to carry her up its line, the mill's sails
 * turned to wind her up its hoist, the swing pumped until she lets go over the nave. The cat goes a roof ahead its own
 * way and over each piece first, already going as she comes to it. Behind her the fog comes on at her pace and rises as
 * it comes, a few roofs back, closer while she works a piece, taking each roof she leaves just after she is off it; it
 * never reaches her. The lens stays low beside her with the fog on one side of the frame and the church on the other,
 * and comes round to each piece as she comes to it.
 */
export class RoofRun {
  /** Where she is: on her way, at a piece, or at the end, on the nave's ridge at the tower's foot. */
  stage: 'off' | 'walk' | Piece | 'nave' = 'off';
  readonly tree: TreeCrossing;
  readonly sheet: SheetCrossing;
  readonly mill: MillCrossing;
  readonly swing: SwingCrossing;
  /** Seconds since she set off, and in each stretch: her own way before each piece and each piece itself. */
  time = 0;
  readonly stretches: { name: string; seconds: number }[] = [];
  /** How far along her way she is, metres. */
  along = 0;
  readonly nodes = lay();
  private next = 1;
  private camera: THREE.PerspectiveCamera | null = null;
  private readonly started = new Set<Piece>();
  private pause = -1;
  private glance = 0;
  private stretchFrom = 0;
  /**
   * She looks back at the boat as the fog takes it, once she is along the wall from the first roof: from where on her
   * way she may, and seconds of it (-1 before).
   */
  private lookingBack = -1;
  private settled = 0;
  private readonly lookBackFrom: number;
  private readonly lookDownFrom: number;
  private lookingDown = -1;
  private readonly head = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly flat = new THREE.Vector2();
  private readonly treeEye = new THREE.Vector3();
  private readonly below = new THREE.Vector3();
  private readonly her = new THREE.Vector2();
  private readonly treeTarget = new THREE.Vector3();
  /**
   * The cat: the place on her way it has got to, what it is going through now, the pieces it is over, and for each
   * piece the place on her way it goes off over it from.
   */
  private catAt = 1;
  private cat: CatSteps | null = null;
  private catStep = -1;
  private readonly catOver = new Set<Piece>();
  private readonly catFrom: Record<Piece, number>;
  private readonly pieceAt: Record<Piece, number>;
  /** The piece the cat is going over, while it is, and whether it is on the sheet's line. */
  private catPiece: Piece | null = null;
  private catOnLine = false;
  /** Gone on to the tower's foot once she is over the swing. */
  private catHome = false;
  /** The fog: her place along `DARK_WAY`, and how fast its front is coming on. */
  private dark = 0;
  private fogSpeed = 0;
  /** The lens: where it looks from and at, eased, and how far round to each piece it has come. */
  private readonly focus = new THREE.Vector3();
  /** Her velocity over the ground, steadied, and where she was a frame ago. */
  private readonly velocity = new THREE.Vector3();
  private readonly was = new THREE.Vector3();
  /** Where the walking lens stands along her way (`layLens`), landscape and upright, laid a little each frame until done. */
  private lens: { wide: LensKey[]; upright: LensKey[] } | null = null;
  private readonly laying: [Generator<void, LensKey[]>, Generator<void, LensKey[]>];
  private readonly laid: LensKey[][] = [];
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly stationEye = new THREE.Vector3();
  private readonly stationTarget = new THREE.Vector3();
  private readonly sumEye = new THREE.Vector3();
  private readonly sumTarget = new THREE.Vector3();
  private readonly held = { primary: new THREE.Vector3(), secondary: new THREE.Vector3(), margin: tuning.drownedCamera.run.margin,
    extra: tuning.drownedCamera.run.extra };
  private onTrunk = 0;
  /** How far round to each piece's own view the lens has come. */
  private readonly pieceIn: Record<Piece, number> = { tree: 0, sheet: 0, mill: 0, swing: 0 };
  private sheetGo = 0;
  private aspect = 16 / 9;
  private framed = false;
  /** How far the look has turned toward the fog's front, radians. */
  private glanced = 0;

  constructor(private readonly cast: Cast) {
    const village = cast.village!;
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    this.tree = new TreeCrossing(village.tree, TREE_SITE.way, crossingCast);
    this.sheet = new SheetCrossing(village.sheet, SHEET_SITE.way, crossingCast);
    this.mill = new MillCrossing(village.mill, MILL_SITE.way, crossingCast, village.millSpiral);
    this.swing = new SwingCrossing(village.swing, SWING_SITE.way, crossingCast);
    this.tree.tree.onEvent = (kind, where, strength) => cast.knock?.(TREE_SOUNDS[kind], where, strength);
    this.sheet.onEvent = (kind, where, strength) => cast.knock?.(SHEET_SOUNDS[kind], where, strength);
    this.mill.onEvent = (kind, where, strength) => cast.knock?.(MILL_SOUNDS[kind], where, strength);
    this.swing.onEvent = (kind, where, strength) => cast.knock?.(SWING_SOUNDS[kind], where, kind === 'leap' ? 0.5 * strength : strength);
    const index = (piece: Piece) => this.nodes.findIndex((n) => n.by === piece);
    this.pieceAt = { tree: index('tree'), sheet: index('sheet'), mill: index('mill'), swing: index('swing') };
    /** The last place on her way before the cat goes off its own way over each piece. */
    const before = (piece: Piece, p: THREE.Vector3) => {
      const s = this.sOf(p);
      let i = 0;
      while (i + 1 < this.pieceAt[piece] && this.nodes[i + 1].s <= s) i++;
      return i;
    };
    this.lookBackFrom = this.sOf(LOOK_BACK);
    this.lookDownFrom = this.sOf(GRANARY_TOP);
    this.catFrom = {
      tree: before('tree', CAT_WAY.tree[0]),
      sheet: this.pieceAt.tree,
      mill: before('mill', CAT_WAY.mill),
      swing: before('swing', CAT_WAY.swing[0]),
    };
    const ax = Math.cos(MILL.facing) * MILL.reach, az = Math.sin(MILL.facing) * MILL.reach, hub = MILL.hub;
    const sails = new THREE.Box3(new THREE.Vector3(hub.x - Math.abs(ax) - 0.4, hub.y - MILL.reach, hub.z - Math.abs(az) - 0.4),
      new THREE.Vector3(hub.x + Math.abs(ax) + 0.4, hub.y + MILL.reach, hub.z + Math.abs(az) + 0.4));
    /** The old tree's crown and its bough out to the swing, which the village's obstacles stop short of. */
    const tree = GREEN_TREE, pivot = SWING_SITE.spot.pivot;
    const crown = new THREE.Box3(new THREE.Vector3(tree.x - 6, 3.5, tree.z - 6), new THREE.Vector3(tree.x + 6, 11, tree.z + 6));
    const bough = new THREE.Box3().setFromPoints([new THREE.Vector3(tree.x, 6, tree.z), new THREE.Vector3(pivot.x, pivot.y + 1.2, pivot.z)]).expandByScalar(0.8);
    const obstacles = [...village.cameraObstacles, sails, crown, bough];
    village.mill.group.updateMatrixWorld(true);
    /** Just past the tree and the mill, the lens starts out from where each piece's view leaves it. */
    const anchors = (wide: number): Anchor[] => (['tree', 'mill'] as const).map((piece) => {
      const at = PIECES[piece].onward;
      if (piece === 'tree') this.treeView(wide, at, 1);
      else this.millView(wide, at);
      return { s: this.nodes[this.pieceAt[piece]].s, bearing: Math.atan2(this.stationEye.x - at.x, this.stationEye.z - at.z) };
    });
    this.laying = [layLens(this.nodes, obstacles, false, anchors(1)), layLens(this.nodes, obstacles, true, anchors(0))];
  }

  /** Lays the walking lens for up to `ms` milliseconds, or to the end. */
  prepare(ms = Infinity): void {
    const until = performance.now() + ms;
    while (!this.lens && performance.now() < until) {
      const at = this.laid.length, step = this.laying[at].next();
      if (step.done) this.laid.push(step.value);
      if (this.laid.length === 2) this.lens = { wide: this.laid[0], upright: this.laid[1] };
    }
  }

  /** How far along her way the place on it nearest `p` is. */
  private sOf(p: THREE.Vector3): number {
    let best = Infinity, s = 0;
    for (let i = 1; i < this.nodes.length; i++) {
      const a = this.nodes[i - 1], b = this.nodes[i], dx = b.at.x - a.at.x, dz = b.at.z - a.at.z, l2 = dx * dx + dz * dz || 1;
      const u = THREE.MathUtils.clamp(((p.x - a.at.x) * dx + (p.z - a.at.z) * dz) / l2, 0, 1);
      const d = Math.hypot(p.x - a.at.x - dx * u, p.z - a.at.z - dz * u);
      if (d < best) { best = d; s = a.s + u * Math.sqrt(l2); }
    }
    return s;
  }

  /** The length of her way, metres. */
  get length(): number {
    return this.nodes[this.nodes.length - 1].s;
  }

  /** How much of her way is behind her, 0 to 1. */
  get share(): number {
    return this.stage === 'off' ? 0 : THREE.MathUtils.clamp(this.along / this.length, 0, 1);
  }

  /** Where she is along `DARK_WAY`, for the fog. */
  get darkAt(): number {
    return this.dark;
  }

  get done(): boolean {
    return this.stage === 'nave';
  }

  /** The drawn gust while she waits at the tree, the sheet or sits on the swing, and its screen angle; the mill draws its own. */
  get invitation(): THREE.Vector3 | null {
    if (this.stage === 'tree') return this.tree.invitation;
    if (this.stage === 'sheet') return this.sheet.invitation;
    if (this.stage === 'swing') return this.swing.invitation;
    return null;
  }

  get inviteHeading(): number | null {
    if (this.stage === 'tree') return this.tree.heading;
    if (this.stage === 'sheet') return this.sheet.heading;
    if (this.stage === 'swing') return this.swing.heading;
    return null;
  }

  get invitationRadius(): number {
    return this.stage === 'tree' ? 2.2 : this.stage === 'sheet' ? 1.6 : 1.2;
  }

  /** She is on the first roof's ridge, the cat at its end, the fog coming on `fogSpeed` m/s: from here the way is hers. */
  begin(fogSpeed: number): void {
    const { child: c } = this.cast;
    this.stage = 'walk';
    this.time = this.stretchFrom = 0;
    c.decks = Object.entries(WAY).filter(([name]) => name !== 'strandLanding').map(([, d]) => d);
    c.stroll = tuning.drowned.run.stroll;
    c.balance = 0;
    c.stowPlane(false);
    this.dark = darkAlong(c.position.x, c.position.z, DARK_AT_STRAND);
    this.focus.copy(c.position).setY(c.position.y + 1.1);
    this.fogSpeed = fogSpeed;
    this.go();
  }

  /** QA (`?chapter=church`): straight to the end of her way, at the tower's foot, the cat at the foot of the ivy. */
  skipToEnd(): void {
    const { child: c, cat } = this.cast;
    const k = tuning.drowned.run;
    this.next = this.nodes.length;
    this.along = this.length;
    this.catAt = this.nodes.length - 1;
    for (const piece of ORDER) {
      this.catOver.add(piece);
      this[piece].phase = 'over';
    }
    this.lookingBack = Infinity;
    this.lookingDown = Infinity;
    this.catHome = true;
    this.dark = DARK_END;
    const dark = this.cast.village!.dark;
    dark.front = this.dark - k.fogEnd;
    dark.level = dark.tide(dark.front);
    c.place(TOWER_FOOT.x, TOWER_FOOT.z, Math.PI / 2);
    c.position.y = TOWER_FOOT.y;
    const at = CAT_AT_FOOT;
    cat.place(at, Math.atan2(TOWER_FOOT.x - at.x, TOWER_FOOT.z - at.z), { pose: 'sit', floor: roofOr(at.y) });
    this.stage = 'nave';
    c.stop();
  }

  update(dt: number): void {
    if (this.stage === 'off') return;
    const { child: c, cat } = this.cast;
    this.time += dt;
    c.face(this.head);
    this.progress();
    this.tend(dt);
    if (this.stage === 'mill') this.mill.below = this.fogFront(this.below).setY(0.5);
    this.facePiece(dt);
    this.walking(dt);
    this.atPiece(dt);
    this.catOn();
    this.fog(dt);
    this.gaze(dt);
    cat.unease = 0.6;
  }

  /** What the pieces go on doing of themselves: the sheet breathing on its line, the empty swing dying away behind her. */
  tend(dt: number): void {
    if (!this.camera) return;
    if (!this.started.has('sheet')) this.sheet.update(dt, this.camera);
    for (const piece of this.started) this[piece].update(dt, this.camera);
  }

  afterCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    this.aspect = camera.aspect;
  }

  /** Sets off for the next place on her way, however she gets there. */
  private go(): void {
    const { child: c } = this.cast;
    const n = this.nodes[this.next];
    if (!n) {
      this.lap('the nave');
      this.stage = 'nave';
      c.stop();
      return;
    }
    if (n.by === 'walk') c.walkTo(n.at.x, n.at.z, false, () => this.reached(), 0.12);
    else if (n.by === 'hop') this.pause = 0;
    else this.startPiece(n.by);
  }

  private reached(): void {
    this.next++;
    this.go();
  }

  /**
   * A turn gentle enough she takes it in her stride: on toward the place after without stopping at it. Just down off the
   * first roof onto the wall she stops and looks back at the boat as the fog takes it; at the top of her way, on the
   * granary's ridge, she stops and looks back down at the fog below.
   */
  private walking(dt: number): void {
    const { child: c } = this.cast;
    const k = tuning.drowned.run;
    if (this.lookingBack < 0 && this.stage === 'walk' && this.along >= this.lookBackFrom && !c.acting && this.pause < 0) {
      this.lookingBack = 0;
      c.stop();
    }
    if (this.lookingDown < 0 && this.stage === 'walk' && this.along >= this.lookDownFrom - 0.2 && !c.acting && this.pause < 0) {
      this.lookingDown = 0;
      c.stop();
    }
    if (this.lookingDown >= 0 && this.lookingDown < k.lookDownFor) {
      this.lookingDown += dt;
      const fog = this.fogFront(this.look);
      c.faceToward(fog.x, fog.z, 1 - Math.exp(-dt * 3));
      c.lookAt = fog.setY(c.position.y - 2);
      if (this.lookingDown >= k.lookDownFor) {
        c.lookAt = null;
        this.go();
      }
      return;
    }
    if (this.lookingBack >= 0 && this.lookingBack < k.lookBackFor) {
      this.lookingBack += dt;
      const boat = this.cast.boat.position;
      c.faceToward(boat.x, boat.z, 1 - Math.exp(-dt * 3));
      c.lookAt = this.look.copy(boat).setY(boat.y + 1.2);
      if (this.lookingBack >= k.lookBackFor) {
        c.lookAt = null;
        this.go();
      }
      return;
    }
    if (this.pause >= 0) {
      const to = this.nodes[this.next].at;
      this.pause += dt;
      c.faceToward(to.x, to.z, 1 - Math.exp(-dt * 8));
      if (this.pause > k.hopPause && !c.busy) {
        this.pause = -1;
        const way = this.tmp.set(to.x - c.position.x, 0, to.z - c.position.z).normalize();
        c.leap(this.tmp2.set(way.x * 1.1, 1.1, way.z * 1.1), to, 9.81, () => {}, () => this.reached(), true);
      }
      return;
    }
    const n = this.nodes[this.next], after = this.nodes[this.next + 1];
    if (this.stage !== 'walk' || !n || n.by !== 'walk' || !after || after.by !== 'walk') return;
    if (Math.hypot(c.position.x - n.at.x, c.position.z - n.at.z) > k.through) return;
    const was = Math.atan2(n.at.x - c.position.x, n.at.z - c.position.z);
    const then = Math.atan2(after.at.x - n.at.x, after.at.z - n.at.z);
    if (Math.abs(Math.atan2(Math.sin(then - was), Math.cos(then - was))) > k.bend) return;
    this.next++;
    c.retargetWalk(after.at.x, after.at.z);
  }

  /** How far along her way she is, and along `DARK_WAY`: never back. */
  private progress(): void {
    const c = this.cast.child.position;
    const i = Math.min(this.next, this.nodes.length - 1);
    const a = this.nodes[i - 1], b = this.nodes[i];
    const dx = b.at.x - a.at.x, dz = b.at.z - a.at.z, len = Math.hypot(dx, dz) || 1;
    const u = THREE.MathUtils.clamp(((c.x - a.at.x) * dx + (c.z - a.at.z) * dz) / (len * len), 0, 1);
    this.along = Math.max(this.along, a.s + u * len);
    this.dark = Math.max(this.dark, darkAlong(c.x, c.z, this.dark));
  }

  private startPiece(piece: Piece): void {
    const { child: c } = this.cast;
    const village = this.cast.village!;
    this.lap(`her way to the ${piece}`);
    this.stage = piece;
    this.started.add(piece);
    if (piece === 'tree') {
      village.driven.add(village.tree);
      this.tree.begin();
    } else if (piece === 'sheet') {
      c.stowPlane(true);
      this.sheet.clear = this.catOver.has('sheet') && this.catPiece !== 'sheet';
      this.sheet.begin();
    } else if (piece === 'mill') {
      village.driven.add(village.mill);
      c.stowPlane(true);
      this.mill.clear = this.catOver.has('mill') && (this.catPiece !== 'mill' || this.catStep >= 2);
      this.mill.begin();
    } else {
      village.driven.add(village.swing);
      c.stowPlane(true);
      this.swing.begin();
    }
  }

  /** Waiting at the tree or the mill she turns to face what she is waiting on. */
  private facePiece(dt: number): void {
    const { child: c } = this.cast;
    const at = this.stage === 'tree' && this.tree.phase === 'waiting' ? TREE_SITE.spot.root
      : this.stage === 'mill' && this.mill.phase === 'waiting' ? this.mill.mill.basketFloor(this.scratch) : null;
    if (at && !c.busy) c.faceToward(at.x, at.z, 1 - Math.exp(-dt * 3));
  }

  /** Over a piece: on her way again, after a breath once the sheet has set her down. */
  private atPiece(dt: number): void {
    const { child: c } = this.cast;
    const stage = this.stage;
    if (stage !== 'tree' && stage !== 'sheet' && stage !== 'mill' && stage !== 'swing') return;
    if (stage === 'swing' && this.swing.phase === 'leaving') c.stowPlane(false);
    if (!this[stage].done || c.busy) return;
    this.settled += dt;
    if (stage === 'sheet' && this.settled < tuning.drowned.run.setDown) return;
    this.settled = 0;
    this.lap(`the ${stage}`);
    this.stage = 'walk';
    c.stowPlane(false);
    c.stroll = tuning.drowned.run.stroll;
    c.balance = 0;
    c.lookAt = null;
    this.reached();
  }

  private lap(name: string): void {
    this.stretches.push({ name, seconds: +(this.time - this.stretchFrom).toFixed(1) });
    this.stretchFrom = this.time;
  }

  /**
   * The cat goes a roof ahead and waits looking back at her; at each piece it goes over its own way first, setting off
   * as she comes near so it is already going as she arrives, and waits on the far side.
   */
  private catOn(): void {
    if (this.cat) {
      this.cat.update();
      if (this.catPiece) this.pieceHooks(this.catPiece, this.catStep);
      return;
    }
    if (!this.catHome && this.catOver.has('swing') && (this.swing.phase === 'leaving' || this.swing.done)) {
      this.catHome = true;
      this.catGoes([{ run: [CAT_AT_FOOT], floor: roofOr(CAT_AT_FOOT.y) }], () => {});
      return;
    }
    if (this.catAt >= this.nodes.length - 1) return;
    const k = tuning.drowned.run;
    const piece = ORDER.find((p) => !this.catOver.has(p));
    if (piece && this.catAt >= this.catFrom[piece]) {
      const wait = this.nodes[this.pieceAt[piece] - 1].s;
      if (this.along < wait - k.catGo[piece] && this.stage !== piece) return;
      this.catOver.add(piece);
      this.catPiece = piece;
      this.catGoes(this.catSteps(piece), () => {
        this.catPiece = null;
        this.pieceHooks(piece, Infinity);
        this.catAt = piece === 'swing' ? this.nodes.length - 1 : this.pieceAt[piece] + (piece === 'mill' ? 1 : 0);
      }, piece === 'tree');
      return;
    }
    if (this.stage !== 'walk' && this.stage !== 'tree') return;
    if (this.along < this.nodes[this.catAt].s - k.catNear) return;
    const limit = piece ? this.catFrom[piece] : this.nodes.length - 1;
    let to = this.catAt;
    while (to < limit && this.nodes[to + 1].s <= this.along + k.catLead) to++;
    if (to === this.catAt) to = Math.min(limit, this.catAt + 1);
    if (to <= this.catAt) return;
    const steps: CatStep[] = [];
    let run: THREE.Vector3[] = [];
    for (let i = this.catAt + 1; i <= to; i++) {
      const n = this.nodes[i];
      if (n.by === 'hop') {
        if (run.length) steps.push({ run });
        run = [];
        steps.push({ hop: n.at, floor: roofOr(n.at.y) });
      } else run.push(n.at);
    }
    if (run.length) steps.push({ run });
    this.catGoes(steps, () => { this.catAt = to; });
  }

  /** The cat through `steps`, then sitting looking at her, or standing ready to go on. */
  private catGoes(steps: CatStep[], then: () => void, stand = false): void {
    const k = tuning.drowned.run;
    this.catStep = 0;
    this.cat = playCatSteps(this.cast.cat, steps, this.head, { run: k.catSpeed, narrow: k.railSpeed }, (i) => { this.catStep = i; }, () => {
      this.cat = null;
      this.catStep = -1;
      then();
    }, stand);
  }

  /**
   * The cat's own way over each piece: along the railings across the tree's lane and up onto the barn by its chimney;
   * up onto the chimney, along the sheet's line and down off the far chimney; off its chimney onto the mill's low sail,
   * riding it up and onto the cap, then down by the hoist's beam onto the granary ahead of her; along the green
   * cottage's ridge, down onto the churchyard's railings and along them, and over onto the nave's slope, waiting a
   * little above where she lets go to.
   */
  private catSteps(piece: Piece): CatStep[] {
    const w = CAT_WAY;
    if (piece === 'tree') {
      return [{ run: [w.tree[0]] }, { hop: w.tree[1] }, { run: [w.tree[2]], narrow: true }, { leap: w.tree[3], floor: roofOr(w.tree[3].y) },
        { run: [w.tree[4]], floor: roofOr(w.tree[4].y) }];
    }
    if (piece === 'sheet') {
      const [near, far] = w.sheet;
      const a = this.sheet.sheet.along;
      const land = new THREE.Vector3(far.x + a.x * 0.9 - a.z * 1.1, 0, far.z + a.z * 0.9 + a.x * 1.1);
      land.y = roofOr(far.y)(land.x, land.z);
      return [{ leap: near, gather: 0.15 }, ...this.sheet.catWay(near, far), { hop: land, floor: roofOr(land.y) }];
    }
    if (piece === 'mill') {
      const m = this.mill.mill;
      const beam = (x: number) => m.at(new THREE.Vector3(x, MILL.offRidge + HOIST.beamAbove + 0.1, HOIST.z));
      const roof = m.at(new THREE.Vector3(HOIST.x, MILL.offRidge, -4.6));
      const [perch, ...up] = this.mill.catWay();
      return [{ leap: w.mill, gather: 0.2 }, { ...perch, when: () => this.stage === 'mill' }, ...up,
        { hop: beam(-2.2), when: () => m.wound / m.full > tuning.drowned.run.catDown },
        { run: [beam(-3.3)], narrow: true, floor: () => MILL.offRidge + HOIST.beamAbove + 0.1 }, { leap: roof, floor: roofOr(roof.y) },
        { run: [m.at(new THREE.Vector3(HOIST.x, MILL.offRidge, -6.2))], floor: roofOr(MILL.offRidge) }];
    }
    return [{ run: [w.swing[0]], floor: roofOr(w.swing[0].y) }, { run: [w.swing[1]], floor: roofOr(w.swing[1].y) }, { leap: w.swing[2] },
      { run: [CAT_OFF_RAILS], narrow: true }, { leap: CAT_ON_NAVE, floor: roofOr(CAT_ON_NAVE.y) },
      { run: [CAT_PAST_SWING], floor: roofOr(CAT_PAST_SWING.y) }];
  }

  /** Tells the sheet and the mill where the cat is in its way over them: on the line, on the sail; `step` past the end once it is over. */
  private pieceHooks(piece: Piece, step: number): void {
    if (piece === 'sheet') {
      this.catOnLine = step === 2;
      this.sheet.catAt(this.catOnLine ? this.cast.cat.position : null);
      this.sheet.clear = step >= 3;
    } else if (piece === 'mill') {
      this.mill.clear = step >= 2;
      this.mill.catOn = step >= 2 && step <= 3;
    }
  }

  /**
   * The fog comes on along `DARK_WAY` behind her at her pace, never stopping and never rushing: toward `fogTrail`
   * behind her on her own way and `fogHold` while she works a piece, never nearer than `fogNearest`, and on past the
   * boat to `fogLooked` while she looks back, so it takes the boat as she watches; it rises as it comes
   * (`DarkBank.comeOn`).
   */
  private fog(dt: number): void {
    const k = tuning.drowned.run;
    const dark = this.cast.village!.dark;
    const looking = this.lookingBack >= 0 && this.lookingBack < k.lookBackFor;
    const hold = this.stage === 'tree' || this.stage === 'sheet' || this.stage === 'mill' || this.stage === 'swing' ? k.fogHold[this.stage]
      : this.stage === 'nave' ? k.fogEnd : looking ? k.fogLooked : k.fogTrail;
    const want = this.dark - hold;
    /** At the tower's foot it comes on to a few roofs back and waits there for the church. */
    const pull = THREE.MathUtils.clamp((want - dark.front) * k.fogPull, this.stage === 'nave' ? 0 : k.fogSlowest, k.fogFastest);
    this.fogSpeed += (pull - this.fogSpeed) * (1 - Math.exp(-dt * (looking ? k.fogLookedEase : k.fogEase)));
    dark.faces = this.her.set(this.cast.child.position.x, this.cast.child.position.z);
    dark.comeOn(Math.min(dark.front + this.fogSpeed * dt, this.dark - (looking ? k.fogLooked : k.fogNearest)), dt);
  }

  /**
   * Where she looks on her own way: at the cat when it is going and just after, ahead along the way, and now and then
   * back at the fog on the side away from the lens. At a piece the crossing has her looking at what she is waiting on.
   */
  private gaze(dt: number): void {
    const { child: c, cat } = this.cast;
    if (this.stage === 'nave') {
      c.lookAt = cat.eye(this.look);
      return;
    }
    if (this.stage === 'tree' && this.tree.phase === 'waiting' && this.tree.t < 2.5 && this.cat) {
      c.lookAt = cat.eye(this.look);
      return;
    }
    if (this.stage !== 'walk' || this.pause >= 0 || (this.lookingBack >= 0 && this.lookingBack < tuning.drowned.run.lookBackFor)) return;
    const k = tuning.drowned.run;
    this.glance += dt;
    if (this.glance > k.glanceEvery + k.glanceFor) this.glance = 0;
    if (this.glance > k.glanceEvery) c.lookAt = this.fogFront(this.look).setY(c.position.y + 1);
    else if (this.cat) c.lookAt = cat.eye(this.look);
    else c.lookAt = this.pointAt(this.along + 7, this.look).setY(c.position.y + 1.1);
    this.awayFromLens(c.lookAt);
  }

  /** Where the fog's front is behind her, on her way. */
  private fogFront(out: THREE.Vector3): THREE.Vector3 {
    darkWayPoint(this.cast.village!.dark.front, this.flat);
    return out.set(this.flat.x, 1, this.flat.y);
  }

  private awayFromLens(at: THREE.Vector3): void {
    lookAwayFrom(at, this.cast.child.position, this.camera?.position ?? this.eye);
  }

  /** The point `s` metres along her way. */
  private pointAt(s: number, out: THREE.Vector3): THREE.Vector3 {
    return wayAt(this.nodes, s, out);
  }

  /**
   * Low and beside her on the side of the low sun, looking a little ahead across her way, so the fog behind her is on
   * one side of the frame and the church ahead on the other; never higher than the roofs, clear of every roof, and
   * eased round with the way rather than turning at each corner. At each piece it comes round to that piece's own
   * view, taken from the yard it was made in: the gap, the thing to work and her all in frame.
   */
  frame(shot: Shot, dt: number): number {
    const k = tuning.drownedCamera.run;
    const c = this.cast.child.position;
    this.prepare();
    const lens = this.lens!;
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    if (this.framed && dt > 0) this.velocity.lerp(this.tmp.subVectors(c, this.was).divideScalar(dt).setY(0), ease(k.steady));
    this.was.copy(c);
    const y = this.focus.y;
    this.focus.lerp(c, this.framed ? ease(k.follow) : 1);
    this.focus.y = this.framed ? y + (c.y - y) * ease(k.followDown) : c.y;
    this.framed = true;
    /** Read a little ahead of her, so the eased, turn-capped lens comes round a corner as she does, not after. */
    const i = THREE.MathUtils.clamp((this.along + k.keyAhead) / LENS_STEP, 0, lens.wide.length - 1.001);
    const j = Math.floor(i), u = i - j;
    const key = (keys: LensKey[], field: keyof LensKey) => THREE.MathUtils.lerp(keys[j][field], keys[j + 1][field], u);
    const blend = (field: keyof LensKey) => THREE.MathUtils.lerp(key(lens.upright, field), key(lens.wide, field), wide);
    const bearing = blend('bearing'), reach = blend('reach'), facing = blend('facing');
    this.eye.set(this.focus.x + Math.sin(bearing) * reach, this.focus.y + blend('rise'), this.focus.z + Math.cos(bearing) * reach);
    this.target.set(this.focus.x + Math.sin(facing) * k.lead, this.focus.y + k.aim, this.focus.z + Math.cos(facing) * k.lead);

    /** Round to a piece's view about what it looks at, not straight across: the lens goes round her, never through. */
    const at = this.station(wide, dt);
    if (at > 0) {
      const from = Math.atan2(this.eye.x - this.target.x, this.eye.z - this.target.z);
      const to = Math.atan2(this.stationEye.x - this.stationTarget.x, this.stationEye.z - this.stationTarget.z);
      const bearing = from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * at;
      const reach = THREE.MathUtils.lerp(Math.hypot(this.eye.x - this.target.x, this.eye.z - this.target.z),
        Math.hypot(this.stationEye.x - this.stationTarget.x, this.stationEye.z - this.stationTarget.z), at);
      const rise = THREE.MathUtils.lerp(this.eye.y - this.target.y, this.stationEye.y - this.stationTarget.y, at);
      this.target.lerp(this.stationTarget, at);
      this.eye.set(this.target.x + Math.sin(bearing) * reach, this.target.y + rise, this.target.z + Math.cos(bearing) * reach);
    }
    /**
     * Asked to stand and look a little ahead of where it should as she walks, by as far as the focus and the rig's
     * easing trail behind a steady walk (never at more than a walk's pace), so the eased lens stands where it was laid
     * rather than lagging back into the roofs, and looks at her rather than where she was.
     */
    const response = Math.min(tuning.cinematography.maxResponse, k.pace * tuning.cinematography.framingResponse);
    const lead = this.tmp.copy(this.velocity).clampLength(0, k.steadiest).multiplyScalar((1 / k.follow + 2 / response) * (1 - at));
    this.eye.add(lead);
    this.target.add(lead);
    shot.free = false;
    shot.from = undefined;
    /** She and what she goes after share the frame: the piece she is at, or the cat ahead, or her way on. */
    const held = this.held;
    held.primary.copy(c).setY(c.y + 1.2);
    const cat = this.cast.cat.eye(this.scratch);
    if (at > 0.5) held.secondary.copy(this.stationTarget);
    else if (cat.distanceTo(c) < k.catHeld) held.secondary.copy(cat);
    else this.pointAt(this.along + k.lookOn, held.secondary).setY(c.y + 1);
    /** At a piece its view is authored to hold both; it never draws back while she works it. */
    held.extra = at > 0.5 ? 0 : k.extra;
    shot.zoom = THREE.MathUtils.lerp(THREE.MathUtils.lerp(k.uprightZoom, k.zoom, wide), 1, at);
    this.fogGlance(shot.zoom, (1 - at) * (this.stage === 'walk' ? 1 : 0), dt);
    shot.subjects = held;
    shot.attention = undefined;
    shot.composition = undefined;
    shot.smoothFit = undefined;
    shot.fitWidth = false;
    shot.obstacles = undefined;
    shot.eye = (shot.eye ?? new THREE.Vector3()).copy(this.eye);
    shot.orbit = true;
    shot.target.copy(this.target);
    shot.distance = Math.hypot(this.eye.x - this.target.x, this.eye.z - this.target.z);
    shot.height = this.eye.y - this.target.y;
    return k.pace;
  }

  /**
   * On her own way the look turns about the eye toward the fog's front, as far as it must for the nearest of it, along
   * its line and a little into it, to stand within `fogEdge` of the frame's edge, never so far that she stands further
   * out than `herEdge`: a glance that grows as the fog would leave the frame.
   */
  private fogGlance(zoom: number, weight: number, dt: number): void {
    const k = tuning.drownedCamera.run;
    const dark = this.cast.village!.dark;
    const eye = this.eye, view = Math.atan2(this.target.x - eye.x, this.target.z - eye.z);
    const pitch = Math.atan2(this.target.y - eye.y, Math.hypot(this.target.x - eye.x, this.target.z - eye.z));
    const field = Math.tan(THREE.MathUtils.degToRad(verticalFov(this.aspect)) / 2) / zoom, across = field * this.aspect;
    const edge = Math.atan(across * k.fogEdge), room = Math.atan(across * k.herEdge);
    const off = (x: number, z: number) => {
      const a = Math.atan2(x - eye.x, z - eye.z) - view;
      return Math.atan2(Math.sin(a), Math.cos(a));
    };
    darkWayPoint(dark.front, this.flat);
    const ax = dark.ahead.x, az = dark.ahead.y;
    let need = Infinity;
    for (let aside = -k.fogReach; aside <= k.fogReach; aside += k.fogReach / 4) {
      for (const deep of [0, k.fogDeep]) {
        const x = this.flat.x - az * aside - ax * deep, z = this.flat.y + ax * aside - az * deep;
        const a = off(x, z);
        if (Math.abs(a) > Math.PI / 2) continue;
        /** Only what a turn alone brings in: its foot or top within the frame's height. */
        const far = Math.hypot(x - eye.x, z - eye.z) * Math.cos(a);
        const up = (y: number) => Math.abs(Math.tan(Math.atan2(y - eye.y, far) - pitch)) / field;
        if (Math.min(up(Math.min(2.5, dark.level * 0.5)), up(dark.level * 0.85)) > k.fogEdge) continue;
        const turn = Math.abs(a) <= edge ? 0 : a - Math.sign(a) * edge;
        if (Math.abs(turn) < Math.abs(need)) need = turn;
      }
    }
    const her = off(this.held.primary.x, this.held.primary.z);
    const lo = Math.max(-k.glanceMost, her - room), hi = Math.min(k.glanceMost, her + room);
    const want = Number.isFinite(need) && lo <= hi ? THREE.MathUtils.clamp(need, lo, hi) * weight : 0;
    this.glanced += (want - this.glanced) * (1 - Math.exp(-dt * k.glanceRate));
    const r = Math.hypot(this.target.x - eye.x, this.target.z - eye.z), to = view + this.glanced;
    this.target.set(eye.x + Math.sin(to) * r, this.target.y, eye.z + Math.cos(to) * r);
  }

  /**
   * How far the lens has come round to a piece's own view (0 to 1), with that view in `stationEye` and
   * `stationTarget`: eased in over the last of her way to it, held while she is at it, eased out once she is over.
   * Her look back at the boat from the first roof's end has its own: over her shoulder, the boat and the fog beyond.
   */
  private station(wide: number, dt: number): number {
    const k = tuning.drownedCamera.run;
    this.onTrunk += ((this.tree.phase === 'crossing' || this.tree.phase === 'over' ? 1 : 0) - this.onTrunk) * (1 - Math.exp(-dt * 0.8));
    this.sheetGo += ((this.sheet.phase === 'carried' || this.sheet.phase === 'landing' || this.sheet.phase === 'landed'
      || this.sheet.phase === 'leaving' || this.sheet.phase === 'over' ? 1 : 0) - this.sheetGo) * (1 - Math.exp(-dt * 0.6));
    /** Where two views overlap (the swing's going as the end's comes) each takes its share, so the lens never jumps between them. */
    let total = 0;
    const eye = this.sumEye.set(0, 0, 0), target = this.sumTarget.set(0, 0, 0);
    const add = (w: number, view: () => void) => {
      if (w <= 0) return;
      view();
      eye.addScaledVector(this.stationEye, w);
      target.addScaledVector(this.stationTarget, w);
      total += w;
    };
    const back = this.lookingBack < 0 ? 0 : THREE.MathUtils.smoothstep(this.lookingBack, 0, k.backIn)
      * (1 - THREE.MathUtils.smoothstep(this.lookingBack, tuning.drowned.run.lookBackFor - k.backGone - k.backOut, tuning.drowned.run.lookBackFor - k.backGone));
    add(back * k.backHold, () => this.backView(wide));
    for (const piece of ORDER) {
      const i = this.pieceAt[piece];
      const wait = this.nodes[i - 1].s, over = this.nodes[i].s;
      const coming = THREE.MathUtils.smootherstep(this.along, wait - k.comeFrom[piece], wait - k.comeTo);
      const leave = k.leave[piece];
      const going = this[piece].done && this.stage !== piece ? THREE.MathUtils.smootherstep(this.along, over + k.leaveFrom, over + leave) : 0;
      /** Set down by the sheet she takes a breath while the lens goes round to her own way. */
      const setDown = piece === 'sheet' && this.stage === 'sheet' && this.sheet.done
        ? 1 - THREE.MathUtils.smoothstep(this.settled, 0, tuning.drowned.run.setDown) : null;
      /** Once she has stopped at a piece the lens goes on round to its view, never while she walks toward it. */
      const want = setDown ?? (this.stage === piece ? 1 : coming * (1 - going));
      this.pieceIn[piece] += (want - this.pieceIn[piece]) * (want > this.pieceIn[piece] ? 1 - Math.exp(-dt * k.roundRate) : 1);
      add(THREE.MathUtils.smootherstep(this.pieceIn[piece], 0, 1), () => this.view(piece, wide));
    }
    add(THREE.MathUtils.smootherstep(this.along, this.length - k.endFrom, this.length - 0.5), () => this.naveView(wide));
    if (total > 0) {
      this.stationEye.copy(eye).divideScalar(total);
      this.stationTarget.copy(target).divideScalar(total);
    }
    return Math.min(1, total);
  }

  private view(piece: Piece, wide: number): void {
    if (piece === 'tree') this.treeView(wide);
    else if (piece === 'sheet') this.sheetView(wide);
    else if (piece === 'mill') this.millView(wide);
    else this.swingView(wide);
  }

  /** Over her shoulder from the first roof's end: her, the boat aground below, the fog coming over it. */
  private backView(wide: number): void {
    const k = tuning.drownedCamera.run;
    const c = this.cast.child.position, boat = this.cast.boat.position;
    const ax = boat.x - c.x, az = boat.z - c.z, d = Math.hypot(ax, az) || 1;
    const sx = -az / d, sz = ax / d;
    const side = THREE.MathUtils.lerp(k.uprightBackSide, k.backSide, wide);
    this.stationEye.set(c.x - (ax / d) * k.backBehind + sx * side, c.y + k.backHigh, c.z - (az / d) * k.backBehind + sz * side);
    this.stationTarget.copy(c).lerp(boat, k.backAt).setY(c.y + k.backAim);
  }

  /**
   * North of her over the open water past the wall's end, looking back past her to the tree in its garden: the fog
   * beyond, where she came from, and the tree falling across the frame onto the barn; as she walks up the trunk it
   * comes round to the sheet's view.
   */
  private treeView(wide: number, c: THREE.Vector3 = this.cast.child.position, on = this.onTrunk): void {
    const k = tuning.drownedCamera.run;
    const root = TREE_SITE.spot.root, rest = TREE_SITE.spot.rest, over = TREE_SITE.spot.over;
    const fx = rest.x - root.x, fz = rest.z - root.z, fl = Math.hypot(fx, fz);
    const ex = fx / fl, ez = fz / fl, nx = ez, nz = -ex;
    const crossed = on * THREE.MathUtils.smoothstep(((c.x - over.x) * ex + (c.z - over.z) * ez) / (fl - 2.4), 0, 0.8);
    const north = THREE.MathUtils.lerp(k.uprightTreeNorth, k.treeNorth, wide), east = THREE.MathUtils.lerp(k.uprightTreeEast, k.treeEast, wide);
    const eye = this.treeEye.set(over.x + nx * north + ex * east, THREE.MathUtils.lerp(k.uprightTreeHigh, k.treeHigh, wide), over.z + nz * north + ez * east);
    const target = this.treeTarget.copy(over).lerp(rest, 0.25).setY(1.9).lerp(this.tmp.copy(c).setY(c.y + 1), THREE.MathUtils.lerp(k.uprightTreeOnHer, 0.45, wide));
    if (crossed > 0) {
      this.sheetView(wide, 0);
      eye.lerp(this.stationEye, crossed);
      target.lerp(this.stationTarget, crossed);
    }
    this.stationEye.copy(eye);
    this.stationTarget.copy(target);
  }

  /**
   * Side on from the side of the sheet's lane away from the fog, a little above her: her under the sheet at the near
   * edge, both chimneys and the line climbing across the frame, the cat on the far roof; it drifts with her as she is
   * carried so the far roof stays in. Upright, it stands behind her other shoulder and looks up the line, so the sheet,
   * the lane and the high roof stack up the narrow frame.
   */
  private sheetView(wide: number, go = this.sheetGo): void {
    const k = tuning.drownedCamera.run;
    const s = SHEET_SITE.spot, w = SHEET_SITE.way.wait;
    const ax = s.to.x - s.from.x, az = s.to.z - s.from.z, al = Math.hypot(ax, az);
    const ux = ax / al, uz = az / al, vx = -uz * k.sheetSide, vz = ux * k.sheetSide;
    const edge = this.scratch.set(w.x - ux * SHEET_WAIT, w.y, w.z - uz * SHEET_WAIT);
    const at = (u: number, y: number, v: number, out: THREE.Vector3) => out.set(edge.x + ux * u + vx * v, edge.y + y, edge.z + uz * u + vz * v);
    const g = THREE.MathUtils.smootherstep(go, 0, 1);
    const [eu, ey, ev] = k.sheetEye, [tu, ty] = k.sheetAt, [gu, gy] = k.sheetGo;
    at(eu + gu * g, ey + gy * g, ev, this.stationEye);
    at(tu + gu * g, ty + gy * g, 0, this.stationTarget);
    if (wide >= 1) return;
    const [uu, uy, uv] = k.uprightSheetEye, [utu, uty, utv] = k.uprightSheetAt;
    this.stationEye.lerp(at(uu + 2.4 * g, uy + 0.9 * g, uv + 0.6 * g, this.tmp), 1 - wide);
    this.stationTarget.lerp(at(utu + 1.6 * g, uty + 0.5 * g, utv, this.tmp), 1 - wide);
  }

  /**
   * Out in front of the sails and off their left, over the fog: the whole sails and the circle drawn round their hub,
   * her in the basket at the tower's foot, the granary's ridge she is wound up to and the bell tower ahead on the left;
   * it rises a little as she does, much more slowly, so she climbs up the frame and it all stays in. Upright, nearer,
   * the basket, the hub and the top stacked up the narrow frame.
   */
  private millView(wide: number, c: THREE.Vector3 = this.cast.child.position): void {
    const m = this.mill.mill;
    const from = MILL.waitTop, to = MILL.offRidge;
    const p = m.group.worldToLocal(this.tmp.copy(c));
    const rise = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((p.y - from) / (to - from), 0, 1), 0, 1);
    const f = wide >= 0.5 ? tuning.drownedCamera.run.millWide : tuning.drownedCamera.run.millUpright;
    const [ex, ey, ez] = f.eye, [tx, ty, tz] = f.at;
    this.stationEye.set(ex, from + ey + f.eyeRise * rise, ez);
    this.stationTarget.set(tx, from + ty + f.rise * rise, tz);
    m.group.localToWorld(this.stationEye);
    m.group.localToWorld(this.stationTarget);
  }

  /**
   * Off the west of the green, side on to her arc and near enough that it reads left and right: the bough over her, the
   * back of the swing by the cottage's gable, and the nave's slope she lets go onto with the cat waiting on it, across
   * the frame. It comes round from behind her well out, past the old tree's crown, and comes in once round. Upright,
   * round behind her and a little higher, the nave and the cat stacked over her.
   */
  private swingView(wide: number): void {
    const k = tuning.drownedCamera.run, pivot = SWING_SITE.spot.pivot, out = SWING_SITE.spot.toward;
    const lerp = THREE.MathUtils.lerp;
    const round = lerp(k.uprightSwingRound, k.swingRound, wide);
    const phase = this.swing.phase, going = phase === 'flying' || phase === 'landed' || phase === 'leaving' || phase === 'over';
    const back = lerp(k.swingFar, lerp(k.uprightSwingBack, k.swingBack, wide), going ? 1 : THREE.MathUtils.smoothstep(this.pieceIn.swing, k.swingIn, 1));
    /** Side on is across her arc, from the west; round turns from there toward the way she swings out. */
    const sx = out.y, sz = -out.x, a = Math.cos(round), b = Math.sin(round);
    const dx = sx * a + out.x * b, dz = sz * a + out.y * b;
    const seat = pivot.y - SWING_SITE.spot.rope;
    this.stationEye.set(pivot.x + dx * back, seat + lerp(k.uprightSwingHigh, k.swingHigh, wide), pivot.z + dz * back);
    this.stationTarget.set(pivot.x + out.x * k.swingAhead, seat + k.swingAim, pivot.z + out.y * k.swingAhead);
  }

  /** Low off the west end of the nave, looking along its ridge to her at the tower's foot, the tower over her. */
  private naveView(wide: number): void {
    const k = tuning.drownedCamera.run;
    const foot = TOWER_FOOT;
    this.stationEye.set(foot.x - k.naveBack, k.naveHigh, NAVE.z + k.naveAside);
    this.stationTarget.set(foot.x + 1, foot.y + 1.6, NAVE.z);
    if (wide >= 1) return;
    this.stationEye.lerp(this.tmp2.set(foot.x - 6, foot.y + 3, NAVE.z + 9), 1 - wide);
  }
}

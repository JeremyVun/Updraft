import * as THREE from 'three';
import type { Shot } from '../camera';
import type { Deck } from '../world/decks';
import { tuning } from '../tuning';
import { CAT_WAY, DARK_WAY, MILL, MILL_SITE, NAVE, PLACED, SWING_SITE, TOWER_FOOT, TREE_SITE, WAY, WAY_GAPS, roofUnder, type WayDeck } from '../world/drowned-way';
import { railAt } from '../world/crossings/windmill';
import { TREE_SOUNDS, TreeCrossing } from '../world/crossings/tree-crossing';
import { MILL_SOUNDS, MillCrossing } from '../world/crossings/mill-crossing';
import { SWING_SOUNDS, SwingCrossing } from '../world/crossings/swing-crossing';
import type { Cast } from './cast';

type Piece = 'tree' | 'mill' | 'swing';

/** A place on her way, how she gets there from the one before, and how far along the way it is. */
interface Node {
  at: THREE.Vector3;
  by: 'walk' | 'hop' | Piece;
  s: number;
}

/** Where she waits for each piece and where she is once over it. */
const PIECES: Record<Piece, { wait: THREE.Vector3; onward: THREE.Vector3 }> = {
  tree: TREE_SITE.way,
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
 * Her way from the strand's ridge to the tower's foot, place by place: the end of every deck she walks, the far side
 * of every hop, the place she waits at each piece and where she is once over it.
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

/** The height along a run of points, under (x, z): what the cat runs on between them. */
function lineFloor(points: readonly THREE.Vector3[]): (x: number, z: number) => number {
  return (x, z) => {
    let best = Infinity, y = points[0].y;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
      const u = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const d = Math.hypot(x - a.x - dx * u, z - a.z - dz * u);
      if (d < best) { best = d; y = a.y + (b.y - a.y) * u; }
    }
    return y;
  };
}

type CatMove = { run: THREE.Vector3[]; narrow?: boolean } | { hop: THREE.Vector3 } | { leap: THREE.Vector3 };

/** The cat's own way over each piece, from where it waits on the near side to where it waits on the far side. */
const CAT_OVER: Record<Piece, CatMove[]> = {
  tree: [{ leap: CAT_WAY.tree[1] }, { run: [CAT_WAY.tree[2]], narrow: true }, { hop: CAT_WAY.tree[3] }, { run: [deckEnd('laneWall')] }],
  mill: [{ run: [CAT_WAY.mill[0], CAT_WAY.mill[1]] }, { leap: CAT_WAY.mill[2] }, { hop: CAT_WAY.mill[3] }, { run: [CAT_WAY.mill[4]] }],
  swing: [{ run: [CAT_WAY.swing[0], CAT_WAY.swing[1]] }, { leap: CAT_WAY.swing[2] }, { run: [CAT_WAY.swing[3]], narrow: true }],
};
const ORDER: readonly Piece[] = ['tree', 'mill', 'swing'];

/** The point `s` metres along a way laid as `nodes`. */
function wayAt(nodes: readonly Node[], s: number, out: THREE.Vector3): THREE.Vector3 {
  if (s <= 0) return out.copy(nodes[0].at);
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].s >= s) return out.lerpVectors(nodes[i - 1].at, nodes[i].at, (s - nodes[i - 1].s) / (nodes[i].s - nodes[i - 1].s || 1));
  }
  return out.copy(nodes[nodes.length - 1].at);
}

/** The hand-laid roofs of her way, for the lens to see her past. */
const ROOFS = [...PLACED, NAVE];

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
function unwrap(keys: LensKey[], field: 'bearing' | 'facing'): void {
  for (let i = 1; i < keys.length; i++) {
    const d = keys[i][field] - keys[i - 1][field];
    keys[i][field] = keys[i - 1][field] + Math.atan2(Math.sin(d), Math.cos(d));
  }
}

/**
 * Where the walking lens stands at every `LENS_STEP` of her way: abeam on her left, the side the low sun is on, turned
 * back a little so it looks along her way as well as across it, at about her height; never where she would walk toward
 * it; where a roof stands in the way or between it and her, swung round or drawn in as little as will do, keeping close
 * to where it stood a step before. Then smoothed along the way as a bearing round her, so it moves as she does, goes
 * round her rather than through her at a turn, and never jumps.
 */
function layLens(nodes: readonly Node[], obstacles: readonly THREE.Box3[], upright: boolean): LensKey[] {
  const k = tuning.drownedCamera.run;
  const near = obstacles.filter((box) => nodes.some((n) => n.at.x > box.min.x - 30 && n.at.x < box.max.x + 30
    && n.at.z > box.min.z - 30 && n.at.z < box.max.z + 30));
  const total = nodes[nodes.length - 1].s;
  const back = upright ? k.uprightBack : k.back, most = upright ? k.uprightDistance : k.distance;
  const rise = upright ? k.uprightRise : k.rise;
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), eye = new THREE.Vector3(), focus = new THREE.Vector3();
  const sight = new THREE.Vector3();
  /** Her feet at `s`, and whether a lens at `bearing`, `reach` and `lift` from there stands clear and sees her. */
  const clear = (s: number, bearing: number, reach: number, lift: number) => {
    wayAt(nodes, s, p);
    focus.copy(p).setY(p.y + 1.6);
    eye.set(p.x + Math.sin(bearing) * reach, p.y + lift, p.z + Math.cos(bearing) * reach);
    sight.lerpVectors(focus, eye, 0.6 / reach);
    /** The slates of the roofs of her way, exactly: the one she is on hides her from below its ridge. */
    for (let u = 0; u < 1; u += 0.05) {
      const x = eye.x + (sight.x - eye.x) * u, z = eye.z + (sight.z - eye.z) * u, y = eye.y + (sight.y - eye.y) * u;
      if (ROOFS.some((h) => (roofUnder(h, x, z) ?? -Infinity) > y - (u === 0 ? 0.3 : 0))) return false;
    }
    for (const box of near) {
      if (eye.x > box.min.x - 0.7 && eye.x < box.max.x + 0.7 && eye.z > box.min.z - 0.7 && eye.z < box.max.z + 0.7 && eye.y < box.max.y + 0.4) return false;
      /** What is below her waist cannot hide her head from a lens above it. */
      if (box.max.y > p.y + 1 && !box.containsPoint(sight) && crosses(eye, sight, box, 0.1)) return false;
    }
    return true;
  };
  const keys: LensKey[] = [];
  let was = null as LensKey | null;
  for (let s = 0; s <= total + LENS_STEP; s += LENS_STEP) {
    wayAt(nodes, s - k.behind, a);
    wayAt(nodes, s + k.ahead, b);
    const along = Math.atan2(b.x - a.x, b.z - a.z);
    wayAt(nodes, s - 0.5, a);
    wayAt(nodes, s + 1, b);
    const facing = Math.atan2(b.x - a.x, b.z - a.z), fx = Math.sin(facing), fz = Math.cos(facing);
    wayAt(nodes, s, p);
    const lift = THREE.MathUtils.clamp(p.y + rise, k.lowest, k.highest) - p.y;
    /** Abeam on the left of the way's line, as a bearing (atan2(x, z)) from her; turned back is further round. */
    const left = along + Math.PI / 2;
    let best = null as LensKey | null, score = Infinity;
    for (let off = -2.1; off <= 2.101; off += 0.15) {
      const bearing = left + back + off;
      if (Math.sin(bearing) * fx + Math.cos(bearing) * fz > 0.2) continue;
      for (const share of [1, 0.82, 0.66, 0.52]) {
        if (!clear(s, bearing, most * share, lift)) continue;
        const turned = was ? Math.abs(Math.atan2(Math.sin(bearing - was.bearing), Math.cos(bearing - was.bearing))) : 0;
        const cost = Math.abs(off) * 3 + (1 - share) * 6 + turned * 4;
        if (cost < score) { score = cost; best = { bearing, reach: most * share, rise: lift, facing: along }; }
      }
    }
    const key: LensKey = best ?? (was ? { ...was, facing: along } : { bearing: left + back, reach: most, rise: lift, facing: along });
    keys.push(key);
    was = key;
  }
  unwrap(keys, 'bearing');
  unwrap(keys, 'facing');
  const smooth = (passes: number, span: number, fields: (keyof LensKey)[]) => {
    for (let pass = 0; pass < passes; pass++) {
      const from = keys.map((key) => ({ ...key }));
      for (let i = 0; i < keys.length; i++) {
        const lo = Math.max(0, i - span), hi = Math.min(keys.length - 1, i + span);
        for (const field of fields) {
          let sum = 0;
          for (let j = lo; j <= hi; j++) sum += from[j][field];
          keys[i][field] = sum / (hi - lo + 1);
        }
      }
    }
  };
  /**
   * Smoothed; then wherever that has carried it into a roof or behind one, swung round to the nearest bearing that is
   * clear, and smoothed again more lightly; and anywhere still not clear, drawn in until it is.
   */
  smooth(2, 2, ['bearing', 'rise', 'facing']);
  keys.forEach((key, i) => {
    if (clear(i * LENS_STEP, key.bearing, key.reach, key.rise)) return;
    for (let turn = 0.1; turn <= Math.PI; turn += 0.1) {
      const to = [key.bearing + turn, key.bearing - turn].find((bearing) => clear(i * LENS_STEP, bearing, key.reach, key.rise));
      if (to !== undefined) { key.bearing = to; return; }
    }
  });
  smooth(1, 1, ['bearing']);
  keys.forEach((key, i) => {
    for (let reach = key.reach; reach >= 2.5; reach -= 0.5) {
      key.reach = reach;
      if (clear(i * LENS_STEP, key.bearing, reach, key.rise)) break;
    }
  });
  smooth(1, 1, ['reach']);
  return keys;
}

/**
 * Her run over the roofs after the cat, from the ridge of the roof the boat lay against to the nave's ridge at the
 * foot of the church tower. She walks it herself, making the small hops on her own, and stops at each of the three
 * pieces facing it until the player's wind gets her over: the dead tree pushed down across the lane, the mill's sail
 * turned to carry her up, the swing pumped until she lets go over the nave. The cat goes a roof ahead its own way and
 * waits on the far side of each piece looking back at her; the fog comes on behind, creeping up while she waits and
 * taking the places she leaves, and never reaches her. The lens stays low beside her with the fog on one side of the
 * frame and the church on the other, and eases round to each piece as she comes to it.
 */
export class RoofRun {
  /** Where she is: on her way, at a piece, or at the end, on the nave's ridge at the tower's foot. */
  stage: 'off' | 'walk' | Piece | 'nave' = 'off';
  readonly tree: TreeCrossing;
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
  private readonly head = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  /**
   * The cat: the place on her way it has got to, whether it is on the move, the pieces it is over, and for each piece
   * the last place on her way before it goes off on its own way over.
   */
  private catAt = 1;
  private catGoing = false;
  private readonly catOver = new Set<Piece>();
  private readonly catFrom: Record<Piece, number>;
  private readonly pieceAt: Record<Piece, number>;
  /** The fog: her place along `DARK_WAY`, the leg of it she is on, and how fast its front is coming on. */
  private dark = 0;
  private darkLeg = 1;
  private darkSpeed = 0;
  private readonly darkLength: number[] = [0];
  /** The lens: where it looks from and at, eased, and how far round to each piece it has come. */
  private readonly focus = new THREE.Vector3();
  /** Where the walking lens stands along her way, landscape and upright (`layLens`). */
  private readonly lens: { wide: LensKey[]; upright: LensKey[] };
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly stationEye = new THREE.Vector3();
  private readonly stationTarget = new THREE.Vector3();
  private onTrunk = 0;
  private millAhead = 0;
  private aspect = 16 / 9;
  private framed = false;

  constructor(private readonly cast: Cast) {
    const village = cast.village!;
    const crossingCast = { child: cast.child, wind: cast.wind, lines: cast.lines, input: cast.input };
    this.tree = new TreeCrossing(village.tree, TREE_SITE.way, crossingCast);
    this.mill = new MillCrossing(village.mill, MILL_SITE.way, crossingCast, village.millSpiral);
    this.swing = new SwingCrossing(village.swing, SWING_SITE.way, crossingCast);
    this.tree.tree.onEvent = (kind, where, strength) => cast.knock?.(TREE_SOUNDS[kind], where, strength);
    this.mill.onEvent = (kind, where, strength) => cast.knock?.(MILL_SOUNDS[kind], where, strength);
    this.swing.onEvent = (kind, where, strength) => cast.knock?.(SWING_SOUNDS[kind], where, kind === 'leap' ? 0.5 * strength : strength);
    for (let i = 1; i < DARK_WAY.length; i++) this.darkLength.push(this.darkLength[i - 1] + DARK_WAY[i].distanceTo(DARK_WAY[i - 1]));
    const index = (piece: Piece) => this.nodes.findIndex((n) => n.by === piece);
    this.pieceAt = { tree: index('tree'), mill: index('mill'), swing: index('swing') };
    const before = (piece: Piece) => {
      const s = this.sOf(CAT_WAY[piece][0]);
      let i = 0;
      while (i + 1 < this.pieceAt[piece] && this.nodes[i + 1].s <= s) i++;
      return i;
    };
    this.catFrom = { tree: before('tree'), mill: before('mill'), swing: before('swing') };
    this.lens = { wide: layLens(this.nodes, village.cameraObstacles, false), upright: layLens(this.nodes, village.cameraObstacles, true) };
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

  /** The drawn gust while she waits at the tree or sits on the swing, and its screen angle; the mill draws its own. */
  get invitation(): THREE.Vector3 | null {
    if (this.stage === 'tree') return this.tree.invitation;
    if (this.stage === 'swing') return this.swing.invitation;
    return null;
  }

  get inviteHeading(): number | null {
    if (this.stage === 'tree') return this.tree.heading;
    if (this.stage === 'swing') return this.swing.heading;
    return null;
  }

  get invitationRadius(): number {
    return this.stage === 'tree' ? 2.2 : 1.2;
  }

  /** She is on the strand's ridge with the cat at its end: from here the way is hers. */
  begin(): void {
    const { child: c } = this.cast;
    const village = this.cast.village!;
    this.stage = 'walk';
    this.time = this.stretchFrom = 0;
    c.decks = Object.entries(WAY).filter(([name]) => name !== 'strandLanding').map(([, d]) => d);
    c.stroll = tuning.drowned.run.stroll;
    c.balance = 0;
    c.stowPlane(false);
    this.dark = this.darkLength[1];
    this.focus.copy(c.position).setY(c.position.y + 1.1);
    village.dark.reach = Math.min(village.dark.reach, this.dark - tuning.drowned.run.fogNearest);
    this.go();
  }

  /** QA (`?chapter=church`): straight to the end of her way, at the tower's foot, the cat at the foot of the ivy. */
  skipToEnd(): void {
    const { child: c, cat } = this.cast;
    this.next = this.nodes.length;
    this.along = this.length;
    this.catAt = this.nodes.length - 1;
    for (const piece of ORDER) {
      this.catOver.add(piece);
      this[piece].phase = 'over';
    }
    this.dark = this.darkLength[this.darkLength.length - 1];
    this.darkLeg = DARK_WAY.length - 1;
    this.cast.village!.dark.reach = this.dark - tuning.drowned.run.fogHold;
    c.place(TOWER_FOOT.x, TOWER_FOOT.z, Math.PI / 2);
    c.position.y = TOWER_FOOT.y;
    const foot = CAT_WAY.swing[CAT_WAY.swing.length - 1];
    cat.place(foot, -Math.PI / 2, { pose: 'sit', floor: () => foot.y });
    this.stage = 'nave';
    c.stop();
  }

  update(dt: number): void {
    if (this.stage === 'off') return;
    const { child: c, cat } = this.cast;
    this.time += dt;
    c.face(this.head);
    this.progress();
    if (this.camera) for (const piece of this.started) this[piece].update(dt, this.camera);
    this.facePiece(dt);
    this.walking(dt);
    this.atPiece();
    this.catOn();
    this.fog(dt);
    this.gaze(dt);
    cat.unease = 0.6;
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

  /** A turn gentle enough she takes it in her stride: on toward the place after without stopping at it. */
  private walking(dt: number): void {
    const { child: c } = this.cast;
    const k = tuning.drowned.run;
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

  /** How far along her way she is: along the leg she is on, never back. */
  private progress(): void {
    const c = this.cast.child.position;
    const i = Math.min(this.next, this.nodes.length - 1);
    const a = this.nodes[i - 1], b = this.nodes[i];
    const dx = b.at.x - a.at.x, dz = b.at.z - a.at.z, len = Math.hypot(dx, dz) || 1;
    const u = THREE.MathUtils.clamp(((c.x - a.at.x) * dx + (c.z - a.at.z) * dz) / (len * len), 0, 1);
    this.along = Math.max(this.along, a.s + u * len);
    let best = Infinity;
    for (let j = Math.max(1, this.darkLeg - 1); j < Math.min(DARK_WAY.length, this.darkLeg + 3); j++) {
      const p = DARK_WAY[j - 1], q = DARK_WAY[j], ex = q.x - p.x, ez = q.y - p.y, l2 = ex * ex + ez * ez;
      const t = THREE.MathUtils.clamp(((c.x - p.x) * ex + (c.z - p.y) * ez) / l2, 0, 1);
      const d = Math.hypot(c.x - p.x - ex * t, c.z - p.y - ez * t);
      if (d < best) {
        best = d;
        if (j >= this.darkLeg) this.darkLeg = j;
        this.dark = Math.max(this.dark, this.darkLength[j - 1] + t * Math.sqrt(l2));
      }
    }
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
    } else if (piece === 'mill') {
      village.driven.add(village.mill);
      c.decks.push(MILL_SITE.stride);
      c.stowPlane(true);
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
      : this.stage === 'mill' && this.mill.phase === 'waiting' ? this.mill.mill.railTop(tuning.crossings.mill.stand, this.scratch) : null;
    if (at && !c.busy) c.faceToward(at.x, at.z, 1 - Math.exp(-dt * 3));
  }

  /** Over a piece: on her way again. */
  private atPiece(): void {
    const { child: c } = this.cast;
    const stage = this.stage;
    if (stage !== 'tree' && stage !== 'mill' && stage !== 'swing') return;
    if (stage === 'swing' && this.swing.phase === 'leaving') c.stowPlane(false);
    if (!this[stage].done || c.busy) return;
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
   * The cat goes a roof ahead and waits looking back at her; at each piece it goes over its own way first and waits on
   * the far side until she is over too.
   */
  private catOn(): void {
    if (this.catGoing || this.catAt >= this.nodes.length - 1) return;
    const k = tuning.drowned.run;
    if (this.along < this.nodes[this.catAt].s - k.catNear) return;
    const piece = ORDER.find((p) => !this.catOver.has(p));
    if (piece && this.catAt >= this.catFrom[piece]) {
      this.catOver.add(piece);
      const at = this.pieceAt[piece];
      this.catMoves(CAT_OVER[piece], () => { this.catAt = piece === 'swing' ? this.nodes.length - 1 : piece === 'tree' ? at + 1 : at; });
      return;
    }
    if (this.stage !== 'walk') return;
    const limit = piece ? this.catFrom[piece] : this.nodes.length - 1;
    let to = this.catAt;
    while (to < limit && this.nodes[to + 1].s <= this.along + k.catLead) to++;
    if (to === this.catAt) to = Math.min(limit, this.catAt + 1);
    if (to <= this.catAt) return;
    const moves: CatMove[] = [];
    let run: THREE.Vector3[] = [];
    for (let i = this.catAt + 1; i <= to; i++) {
      const n = this.nodes[i];
      if (n.by === 'hop') {
        if (run.length) moves.push({ run });
        run = [];
        moves.push({ hop: n.at });
      } else run.push(n.at);
    }
    if (run.length) moves.push({ run });
    this.catMoves(moves, () => { this.catAt = to; });
  }

  /** The cat through `moves` one after another, then sitting looking at her. */
  private catMoves(moves: CatMove[], then: () => void): void {
    const { cat } = this.cast;
    const k = tuning.drowned.run;
    this.catGoing = true;
    const step = (i: number) => {
      const m = moves[i];
      if (!m) {
        cat.rest('sit', this.head);
        then();
        this.catGoing = false;
        return;
      }
      const on = () => step(i + 1);
      const last = i === moves.length - 1;
      if ('run' in m) {
        const from = cat.position.clone();
        cat.run(m.run, lineFloor([from, ...m.run]), { pace: 'run', speed: m.narrow ? k.railSpeed : k.catSpeed, narrow: m.narrow,
          then: last ? 'sit' : 'stand', look: last ? this.head : null }, on);
      } else if ('hop' in m) cat.hop(m.hop, { then: 'stand', arc: 0.25 }, on);
      else cat.leap(m.leap, { then: 'stand', arc: 0.35 }, on);
    };
    step(0);
  }

  /**
   * The fog comes on along `DARK_WAY` behind her: up to a little behind her while she waits at a piece, further back
   * while she is on her own way, which takes the places she has left; never back, and never onto her.
   */
  private fog(dt: number): void {
    const k = tuning.drowned.run;
    const dark = this.cast.village!.dark;
    const held = this.stage !== 'walk' && this.stage !== 'off';
    const want = this.dark - (held ? k.fogHold : k.fogTrail);
    this.darkSpeed += ((want > dark.reach + 0.3 ? k.fogCreep : 0) - this.darkSpeed) * (1 - Math.exp(-dt * 0.8));
    dark.reach = Math.min(dark.reach + this.darkSpeed * dt, this.dark - k.fogNearest, Math.max(dark.reach, want));
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
    if (this.stage === 'tree' && this.tree.phase === 'waiting' && this.tree.t < 2.5 && this.catGoing) {
      c.lookAt = cat.eye(this.look);
      return;
    }
    if (this.stage !== 'walk' || this.pause >= 0) return;
    const k = tuning.drowned.run;
    this.glance += dt;
    if (this.glance > k.glanceEvery + k.glanceFor) this.glance = 0;
    if (this.glance > k.glanceEvery) {
      const away = this.tmp.copy(c.position).sub(this.eye).setY(0).normalize();
      const back = this.pointAt(this.along - 14, this.look);
      c.lookAt = back.addScaledVector(away, 9).setY(c.position.y + 1);
      return;
    }
    if (this.catGoing) {
      c.lookAt = cat.eye(this.look);
      return;
    }
    c.lookAt = this.pointAt(this.along + 7, this.look).setY(c.position.y + 1.1);
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
    const wide = THREE.MathUtils.smoothstep(this.aspect, 0.7, 1.3);
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    this.focus.lerp(c, this.framed ? ease(k.follow) : 1);
    this.framed = true;
    const i = THREE.MathUtils.clamp(this.along / LENS_STEP, 0, this.lens.wide.length - 1.001);
    const j = Math.floor(i), u = i - j;
    const key = (keys: LensKey[], field: keyof LensKey) => THREE.MathUtils.lerp(keys[j][field], keys[j + 1][field], u);
    const blend = (field: keyof LensKey) => THREE.MathUtils.lerp(key(this.lens.upright, field), key(this.lens.wide, field), wide);
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
    shot.free = false;
    shot.from = undefined;
    shot.subjects = undefined;
    shot.attention = undefined;
    shot.composition = undefined;
    shot.smoothFit = undefined;
    shot.zoom = undefined;
    shot.fitWidth = false;
    shot.obstacles = undefined;
    shot.eye = (shot.eye ?? new THREE.Vector3()).copy(this.eye);
    shot.orbit = false;
    shot.target.copy(this.target);
    shot.distance = Math.hypot(this.eye.x - this.target.x, this.eye.z - this.target.z);
    shot.height = this.eye.y - this.target.y;
    return k.pace;
  }

  /**
   * How far the lens has come round to a piece's own view (0 to 1), with that view in `stationEye` and
   * `stationTarget`: eased in over the last of her way to it, held while she is at it, eased out once she is over.
   */
  private station(wide: number, dt: number): number {
    const k = tuning.drownedCamera.run;
    let best = 0, which: Piece | 'nave' | null = null;
    for (const piece of ['tree', 'mill', 'swing'] as const) {
      const i = this.nodes.findIndex((n) => n.by === piece);
      const wait = this.nodes[i - 1].s, over = this.nodes[i].s;
      const come = piece === 'swing' ? k.swingFrom : k.comeFrom;
      const coming = THREE.MathUtils.smootherstep(this.along, wait - come, wait - k.comeTo);
      const leave = piece === 'mill' ? k.millLeave : k.leaveTo;
      const going = this[piece].done && this.stage !== piece ? THREE.MathUtils.smootherstep(this.along, over + k.leaveFrom, over + leave) : 0;
      const w = this.stage === piece ? 1 : coming * (1 - going);
      if (w > best) { best = w; which = piece; }
    }
    const end = THREE.MathUtils.smootherstep(this.along, this.length - k.endFrom, this.length - 0.5);
    if (end > best) { best = end; which = 'nave'; }
    this.onTrunk += ((this.tree.phase === 'crossing' || this.tree.phase === 'over' ? 1 : 0) - this.onTrunk) * (1 - Math.exp(-dt * 0.8));
    this.millAhead += ((this.mill.phase === 'leaving' || this.mill.phase === 'over' ? 1 : 0) - this.millAhead) * (1 - Math.exp(-dt * 0.5));
    if (which === 'tree') this.treeView(wide);
    else if (which === 'mill') this.millView(wide);
    else if (which === 'swing') this.swingView(wide);
    else if (which === 'nave') this.naveView(wide);
    return best;
  }

  /**
   * Behind her and out to the west, looking over her shoulder across the lane to the tree, high enough to see over the
   * garden wall to the water round its foot: she faces away from the lens to the tree, it falls across the frame, and
   * she walks away up it, so the lens never has to come round to meet her. Upright, straight behind her and higher.
   */
  private treeView(wide: number): void {
    const k = tuning.drownedCamera.run;
    const c = this.cast.child.position, root = TREE_SITE.spot.root, rest = TREE_SITE.spot.rest;
    const on = this.onTrunk;
    const away = this.tmp2.set(rest.x - root.x, 0, rest.z - root.z).normalize();
    const turn = THREE.MathUtils.lerp(0, k.treeTurn, wide);
    const sx = -away.z, sz = away.x;
    const ex = away.x * Math.cos(turn) + sx * Math.sin(turn), ez = away.z * Math.cos(turn) + sz * Math.sin(turn);
    const from = this.scratch.copy(rest).lerp(c, on * 0.5);
    const back = THREE.MathUtils.lerp(k.uprightTreeBack, k.treeBack, wide);
    this.stationEye.set(from.x + ex * back, THREE.MathUtils.lerp(k.uprightTreeHigh, k.treeHigh, wide), from.z + ez * back);
    this.stationTarget.set((rest.x + root.x) / 2, 2.6, (rest.z + root.z) / 2).lerp(this.tmp.copy(c).setY(c.y + 1), on * 0.5);
  }

  /**
   * In front of the sails, out to the south side of her wall so the cottage she came over is clear of it, looking past
   * her at the sail she will ride, the hub and the high roof beyond; it rises with her only enough to show the water
   * below, and follows her along the high ridge so the mill leaves the frame.
   */
  private millView(wide: number): void {
    const m = this.mill.mill, c = this.cast.child.position;
    const p = m.group.worldToLocal(this.tmp.copy(c));
    const board = railAt(tuning.crossings.mill.board, tuning.crossings.mill.stand);
    const rise = THREE.MathUtils.clamp((p.y - MILL.waitTop) / (MILL.offRidge - MILL.waitTop), 0, 1);
    const x = Math.min(p.x, board.x), ahead = THREE.MathUtils.smootherstep(this.millAhead, 0, 1);
    const k = tuning.drownedCamera.run;
    const eye = this.stationEye.set(x + k.millAside - 4 * ahead, 2.5 + 0.7 * p.y + 0.6 * ahead, k.millOut - 0.8 * rise);
    const target = this.stationTarget.set(x + 0.9 - 5.5 * ahead, 0.8 + 0.8 * p.y, 0);
    if (wide < 1) {
      eye.lerp(this.tmp2.set(x + k.millAside - 1 - 2.5 * ahead, 2.4 + 0.7 * p.y, k.millOut + 3), 1 - wide);
      target.lerp(this.tmp2.set(x + 0.6 - 3 * ahead, p.y + 1.9, 0), 1 - wide);
    }
    m.group.localToWorld(eye);
    m.group.localToWorld(target);
  }

  /**
   * Low off the west of the green, side on to her arc: the old tree at the edge of the frame, its bough across the
   * top, the nave on the left. Upright, behind her and a little above, so each swing goes away up the frame.
   */
  private swingView(wide: number): void {
    const pivot = SWING_SITE.spot.pivot;
    this.stationEye.set(pivot.x - 21, 3.1, pivot.z - 1.6);
    this.stationTarget.set(pivot.x, 3.5, pivot.z - 1.4);
    if (wide >= 1) return;
    this.stationEye.lerp(this.tmp2.set(pivot.x - 11.5, 5.6, pivot.z + 10), 1 - wide);
    this.stationTarget.lerp(this.tmp2.set(pivot.x + 2.2, 2.6, pivot.z - 4), 1 - wide);
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

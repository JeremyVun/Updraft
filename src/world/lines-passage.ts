import { CURTAIN_LAYOUT } from './lines-layout';
import { DOOR_SHORE } from './heightfield';
import * as THREE from 'three';
import type { PointerInput } from '../input/pointer';
import { screenBrush } from '../creatures/motion';
import { feltWind, Sway, type WindField, type WindSample } from '../wind/field';
import { tuning } from '../tuning';
import { heightAt } from './island';
import { grassHeightAt } from './grass';
import { mulberry32 } from './noise';
import { Cloth, type ClothAir } from './cloth-sim';

/** The southern beach stays put; the extra fifteen percent of island is north of it. */
export const LINES_LANDING = new THREE.Vector2(14, -208);
// Rest the bow on the north beach, with dry sand beside the thwart for boarding.
export const LINES_BERTH = new THREE.Vector3(DOOR_SHORE.x, 0, DOOR_SHORE.z - 23.5);
export const LINES_WALK = [
  new THREE.Vector2(12, -220), new THREE.Vector2(0, -230), new THREE.Vector2(0, -240),
  new THREE.Vector2(25, -251), new THREE.Vector2(25, -262),
  new THREE.Vector2(11, -272), new THREE.Vector2(11, -283),
  new THREE.Vector2(11, -298), new THREE.Vector2(14, -322),
];

/** Length of a passage sheet's peg: the sheets are giant, and so are the pegs that hold them. */
export const PEG_LENGTH = 0.34;

/**
 * Downwind of the last sheet, an ordinary line with a bare stretch, off the walk and out of the family's view. The
 * last sheet is torn off its own line and comes down over this one.
 */
export const SNAG_LINE = (() => {
  const a = new THREE.Vector3(18.1, 0, -269.6);
  const b = new THREE.Vector3(20.5, 0, -284.2);
  a.y = heightAt(a.x, a.z) + 5.1;
  b.y = heightAt(b.x, b.z) + 5.3;
  return { a, b, sag: 0.32, bare: [0.22, 0.78] as [number, number] };
})();

/** A point on a line's catenary, t from 0 to 1, as the washing lines hang. */
function lineAt(line: { a: THREE.Vector3; b: THREE.Vector3; sag: number }, t: number, out: THREE.Vector3): THREE.Vector3 {
  out.lerpVectors(line.a, line.b, t);
  out.y -= Math.sin(t * Math.PI) * line.sag;
  return out;
}

/**
 * How each passage is pegged: the pegs on each sheet as fractions across it, the pegs each strong sweep works free
 * in turn as [sheet, peg], and where the way through opens, in metres along the line from its middle, with the bird
 * crossing `spread` to one side of that and the child to the other. The first
 * sheet loses the pegs at one end and hangs from the other; the pair loses theirs from the middle outward; the last
 * loses both ends and is then torn off altogether.
 */
const PEGGING: { pegs: number[][]; order: [number, number][][]; gap: number; spread: number; torn?: boolean }[] = [
  { pegs: [[0.02, 0.26, 0.5, 0.74, 0.98]], order: [[[0, 4]], [[0, 3]], [[0, 2]]], gap: 3.5, spread: 0.2 },
  { pegs: [[0.03, 0.24, 0.62, 0.97], [0.03, 0.38, 0.76, 0.97]], order: [[[0, 3]], [[1, 0]], [[0, 2]], [[1, 1]]], gap: 0.1, spread: 0.4 },
  { pegs: [[0.02, 0.34, 0.66, 0.98]], order: [[[0, 0]], [[0, 3]], [[0, 1], [0, 2]]], gap: 0, spread: 1.2, torn: true },
];

const SPACING = 0.42;
const RAIL_RUNS = 8;
const STEP = 1 / 60;

export interface CurtainPeg {
  readonly sheet: number;
  readonly u: number;
  /** Where it grips the line. */
  readonly on: THREE.Vector3;
  readonly p: THREE.Vector3;
  readonly q: THREE.Quaternion;
  off: boolean;
  resting: boolean;
  readonly v: THREE.Vector3;
  readonly spin: THREE.Vector3;
  readonly seed: number;
}

export interface CurtainSheet {
  readonly cloth: Cloth;
  /** Line fraction under each column of the sheet's top edge. */
  readonly t: Float32Array;
  readonly colour: number;
}

/** Heights the cloth and pegs come to rest on: the ground, raised a little where grass holds them up. */
class Floor {
  private readonly h: Float32Array;
  constructor(private readonly x0: number, private readonly z0: number, private readonly size: number, private readonly res: number) {
    this.h = new Float32Array(res * res);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = x0 + i / (res - 1) * size, z = z0 + j / (res - 1) * size;
      this.h[j * res + i] = heightAt(x, z) + 0.05 + Math.min(0.32, grassHeightAt(x, z) * 0.28);
    }
  }

  at = (x: number, z: number): number => {
    const fx = THREE.MathUtils.clamp((x - this.x0) / this.size * (this.res - 1), 0, this.res - 1.001);
    const fz = THREE.MathUtils.clamp((z - this.z0) / this.size * (this.res - 1), 0, this.res - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const r = this.res, h = this.h;
    const a = h[j * r + i] + (h[j * r + i + 1] - h[j * r + i]) * tx;
    const b = h[(j + 1) * r + i] + (h[(j + 1) * r + i + 1] - h[(j + 1) * r + i]) * tx;
    return a + (b - a) * tz;
  };
}

const lineDir = new THREE.Vector3();
const tmp = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const ACROSS = new THREE.Vector3(1, 0, 0);

/**
 * A sheet across the walk, pegged along its top. The player's sweeps billow it, and every strong one works a peg
 * free: the peg pops off and falls to the grass, and the cloth it held drops. With the last of its pegs gone the
 * sheet hangs from what is left at the far end or, the last time, is torn off its line and carried downwind until
 * it comes down over another line. Nothing holds it up but pegs and lines, and progress is pegs off, never lost.
 */
export class WashingCurtain {
  readonly center: THREE.Vector3;
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  readonly before: THREE.Vector3;
  readonly birdBefore: THREE.Vector3;
  readonly after: THREE.Vector3;
  /** Just short of the line where the bird goes through. */
  readonly way: THREE.Vector3;
  /** Where the child crosses under the line. */
  crossX: number;
  readonly sag = 0.22;
  readonly curtain: number;
  readonly drop: number;
  readonly sway = new Sway();
  readonly sheets: CurtainSheet[] = [];
  readonly pegs: CurtainPeg[] = [];
  /** Sweeps' worth of progress, 0 to 1; each stage of it works the next pegs free. */
  charge = 0;
  /** How far it has come open, for the sound of the cloth. */
  opening = 0;
  cleared = false;
  /** Pegs that have come off, for the sound of each. */
  pops = 0;
  /** Bumped whenever the cloth moves, so its meshes know to upload it. */
  version = 0;
  /** Time since a real cursor/touch sweep reached this sheet; invitation traces never affect it. */
  brushAge = Infinity;
  private popped = 0;
  private loose = 0;
  private downFor = 0;
  private billow = 0;
  private touched = false;
  /** Seconds since the last sheet was torn free, or below zero while it is still pegged. */
  private flight = -1;
  /** The torn sheet has come down on the snag line and hangs there. */
  private snagged = false;
  /**
   * The particles the line took, where each was as it did and where on the line it lies; each settles from there
   * onto the line over `catchSettle`.
   */
  private hung: number[] = [];
  private hungFrom: THREE.Vector3[] = [];
  private hungAt: THREE.Vector3[] = [];
  private settled = 0;
  /** The torn sheet's particles across its middle that the snag line catches, and where on it each comes to lie. */
  private caught: number[] = [];
  private catchAt: THREE.Vector3[] = [];
  /** Each caught particle's place relative to the middle of them as the sheet tore free. */
  private tornShape: THREE.Vector3[] = [];
  private readonly flightFrom = new THREE.Vector3();
  private readonly catchMid = new THREE.Vector3();
  private readonly velocity = { x: 0, y: 0, z: 0 };
  private time = 0;
  private pending = 0;
  private floor: Floor | null = null;
  private readonly posts: number[] = [];
  /** The snag line, in straight runs the torn sheet cannot pass through. */
  private readonly rails: number[] = [];
  private readonly air: ClothAir = { x: 0, y: 0, z: 0, spin: 0, cx: 0, cz: 0 };
  /** How far the torn sheet turns about the upright on its way to lie along the snag line. */
  private yaw = 0;
  private readonly phase: Float32Array[] = [];
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly point = new THREE.Vector3();
  private readonly path = new THREE.Vector3();
  private readonly pathNext = new THREE.Vector3();
  private readonly plan: (typeof PEGGING)[number];

  constructor(index: number, x: number, z: number, readonly width: number, readonly panels: number) {
    this.curtain = index;
    this.plan = PEGGING[index];
    const foot = heightAt(x, z);
    const top = Math.max(foot, heightAt(x - width / 2, z), heightAt(x + width / 2, z)) + 6.1;
    this.drop = top - foot - 0.55;
    this.center = new THREE.Vector3(x, foot + 3.1, z);
    this.a = new THREE.Vector3(x - width / 2 - 0.35, top, z);
    this.b = new THREE.Vector3(x + width / 2 + 0.35, top + 0.08, z);
    // They wait and cross where the sheet will not hang once it is down.
    const gap = x + this.plan.gap;
    this.before = this.ground(gap - this.plan.spread - 0.4, z + 4.7);
    this.birdBefore = this.ground(gap + this.plan.spread, z + 1.7);
    this.after = this.ground(gap + this.plan.spread, z - 4.5);
    this.way = this.ground(gap + this.plan.spread, z + 1);
    this.crossX = gap - this.plan.spread;
    for (const end of this.plan.torn ? [this.a, this.b, SNAG_LINE.a, SNAG_LINE.b] : [this.a, this.b]) {
      this.posts.push(end.x, end.z, 0.2, end.y + 0.1);
    }
    if (this.plan.torn) {
      const from = new THREE.Vector3(), to = new THREE.Vector3();
      for (let n = 0; n < RAIL_RUNS; n++) {
        lineAt(SNAG_LINE, n / RAIL_RUNS, from); lineAt(SNAG_LINE, (n + 1) / RAIL_RUNS, to);
        this.rails.push(from.x, from.y, from.z, to.x, to.y, to.z, SPACING * 0.55);
      }
    }

    const span = this.a.distanceTo(this.b);
    const rand = mulberry32(31 + index * 7);
    for (let j = 0; j < panels; j++) {
      const sheetWidth = width / panels + (panels > 1 ? 0.35 : 0);
      const drop = this.drop - j * 0.15;
      const cols = Math.round(sheetWidth / SPACING) + 1, rows = Math.round(drop / SPACING) + 1;
      const cloth = new Cloth(cols, rows, sheetWidth, drop, tuning.linesPassage.bend);
      const t = new Float32Array(cols);
      const middle = (j + 0.5) / panels;
      for (let c = 0; c < cols; c++) t[c] = middle + (c / (cols - 1) - 0.5) * sheetWidth / span;
      this.sheets.push({ cloth, t, colour: panels > 1 ? j + 1 : 0 });
      const phase = new Float32Array(cloth.count);
      for (let i = 0; i < cloth.count; i++) phase[i] = (i % cols) * SPACING * 1.3 + Math.floor(i / cols) * SPACING * 0.9;
      this.phase.push(phase);
      for (const u of this.plan.pegs[j]) {
        const on = lineAt(this, middle + (u - 0.5) * sheetWidth / span, new THREE.Vector3());
        this.pegs.push({ sheet: j, u, on, p: on.clone(), q: new THREE.Quaternion(), off: false, resting: false,
          v: new THREE.Vector3(), spin: new THREE.Vector3(), seed: rand() });
      }
    }
    this.hang();
  }

  private ground(x: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, heightAt(x, z), z); }

  private get stages(): number { return this.plan.order.length; }

  /** Seconds since the last sheet was torn free, below zero while it is pegged; it comes down at `snagPoint`. */
  get tornFor(): number { return this.flight; }
  get snagPoint(): THREE.Vector3 { return this.catchMid; }

  /** How far the frame is between the cloth's last two steps. */
  get alpha(): number { return this.pending / STEP; }

  /** Down long enough that the way beside it is clear to walk. */
  get passable(): boolean { return this.downFor > tuning.linesPassage.passAfter; }

  /** Pegged all along and hanging straight, as it was put out. */
  private hang(): void {
    for (const s of this.sheets) {
      const { cloth } = s;
      for (let c = 0; c < cloth.cols; c++) {
        lineAt(this, s.t[c], this.point);
        for (let r = 0; r < cloth.rows; r++) {
          cloth.place(r * cloth.cols + c, this.point.x, this.point.y - 0.03 - r / (cloth.rows - 1) * cloth.drop, this.point.z);
        }
      }
    }
    lineDir.subVectors(this.b, this.a).normalize();
    for (const peg of this.pegs) {
      peg.off = false; peg.resting = false; peg.p.copy(peg.on); peg.v.set(0, 0, 0);
      peg.q.setFromAxisAngle(UP, Math.atan2(-lineDir.z, lineDir.x));
    }
    this.repin();
    this.version++;
  }

  /** Hold each sheet's top edge on the line between the outermost of its pegs still on. */
  private repin(): void {
    this.sheets.forEach((s, j) => {
      const { cloth } = s;
      cloth.free.fill(1);
      const on = this.pegs.filter(p => p.sheet === j && !p.off).map(p => p.u);
      if (on.length) {
        const lo = Math.min(...on) - 0.04, hi = Math.max(...on) + 0.04;
        for (let c = 0; c < cloth.cols; c++) {
          const u = c / (cloth.cols - 1);
          if (u < lo || u > hi) continue;
          lineAt(this, s.t[c], this.point);
          cloth.hold(c, this.point.x, this.point.y - 0.03, this.point.z);
        }
      }
      if (this.snagged && j === 0) this.lay(0);
      cloth.retether();
    });
  }

  reset(cleared = false): void {
    this.touched = false; this.brushAge = Infinity;
    this.flight = -1; this.snagged = false; this.settled = 0; this.popped = 0; this.billow = 0; this.pending = 0; this.loose = 0;
    this.hang();
    this.downFor = 0;
    this.charge = cleared ? 1 : 0;
    this.cleared = cleared;
    this.opening = cleared ? 1 : 0;
    if (cleared) {
      // Down on an earlier visit: let it fall and settle where it did, before anyone sees it.
      this.floor ??= this.makeFloor();
      while (this.popped < this.stages) this.pop(this.popped++);
      this.downFor = Infinity;
      for (let t = 0; t < tuning.linesPassage.settleSeconds; t += STEP) this.simulate(STEP, true);
      for (const peg of this.pegs) for (let t = 0; t < 6 && !peg.resting; t += STEP) this.fly(peg, STEP);
    }
    this.pops = this.pegs.filter(p => p.off).length;
    this.version++;
  }

  private makeFloor(): Floor {
    const reach = this.plan.torn ? 32 : 22;
    return new Floor(this.center.x - reach / 2 + (this.plan.torn ? 6 : 0), this.center.z - reach / 2, reach, Math.round(reach * 2));
  }

  /** `near` is false while the travellers are too far off to see it move; the cloth then holds still. */
  update(dt: number, wind: WindField, listening: boolean, near = true): void {
    const k = tuning.linesPassage;
    this.brushAge += dt;
    this.floor ??= this.makeFloor();
    let strongest = 0;
    let vx = 0, vz = 0;
    for (const dx of [-this.width * 0.3, 0, this.width * 0.3]) {
      const w = feltWind(wind.sample(this.center.x + dx, this.center.z, this.sample), wind.calm);
      const force = THREE.MathUtils.smoothstep(w.energy, k.energyFrom, k.energyFull) *
        THREE.MathUtils.smoothstep(Math.hypot(w.x, w.z), k.speedFrom, k.speedFull);
      if (force > strongest) { strongest = force; vx = w.x; vz = w.z; }
    }
    this.sway.update(vx, vz, dt);
    if (listening && this.touched) {
      // Only air from the player's gesture can work a peg free. Waiting never supplies a breeze.
      this.charge = Math.min(1, this.charge + strongest * dt / (k.pegSeconds * this.stages));
    }
    // A loosened peg gives as the sheet falls back from the gust, so it drops from hanging, not from mid-billow.
    if (this.popped < Math.floor(this.charge * this.stages + 1e-6)) {
      this.loose += dt;
      if (this.billow < k.popBillow || this.loose > k.popWait) { this.pop(this.popped++); this.loose = 0; }
    }
    if (this.popped >= this.stages) {
      if (this.downFor <= k.passAfter && this.downFor + dt > k.passAfter) this.findWay();
      this.downFor += dt;
    }
    const gusting = THREE.MathUtils.clamp(Math.hypot(this.sway.x, this.sway.z) / k.billowSpeed, 0, 1);
    this.billow += (gusting - this.billow) * (1 - Math.exp(-dt * (gusting > this.billow ? k.rise : k.settle)));
    this.opening += (this.popped / this.stages + this.billow * 0.25 - this.opening) * (1 - Math.exp(-dt * 3));

    this.pending = near ? Math.min(this.pending + dt, STEP * 3) : 0;
    while (this.pending >= STEP) { this.pending -= STEP; this.simulate(STEP, false); }
    if (near) this.version++;
    const next = this.plan.order[this.popped] ?? [];
    const working = this.charge * this.stages - this.popped;
    for (const peg of this.pegs) {
      if (peg.off) { if (!peg.resting) this.fly(peg, dt); continue; }
      // The next peg to go works loose in the gusts before it gives.
      const loose = next.some(([s, i]) => this.pegs[this.pegIndex(s, i)] === peg) ? working : 0;
      const shake = loose * (0.12 + 0.5 * this.billow) * Math.sin(this.time * 19 + peg.seed * 40);
      lineDir.subVectors(this.b, this.a).normalize();
      peg.q.setFromAxisAngle(UP, Math.atan2(-lineDir.z, lineDir.x));
      peg.q.multiply(tmpQ.setFromAxisAngle(ACROSS, shake * 0.5 + loose * 0.25));
      peg.p.copy(peg.on).y += loose * 0.05;
    }
  }

  /**
   * Cloth falls a little differently every time. Once it is down, the travellers cross wherever along the line it
   * has left the widest way, keeping to the planned gap when that is clear.
   */
  private findWay(): void {
    const low: number[] = [];
    for (const s of this.sheets) for (let i = 0; i < s.cloth.count; i++) {
      const x = s.cloth.pos[i * 3], y = s.cloth.pos[i * 3 + 1], z = s.cloth.pos[i * 3 + 2];
      if (Math.abs(z - this.center.z) < 5.5 && y < heightAt(x, z) + 1.8) low.push(x);
    }
    const planned = this.center.x + this.plan.gap;
    // A thin post is easier to pass close by than a heap of cloth.
    const room = (x: number) => Math.min(x - this.a.x + 1, this.b.x - x + 1, ...low.map(p => Math.abs(p - x)));
    let best = planned, score = -Infinity;
    for (let x = this.a.x + 0.9; x <= this.b.x - 0.9; x += 0.1) {
      const clear = room(x);
      const here = Math.min(clear, 2.2) - Math.abs(x - planned) * 0.05;
      if (here > score) { score = here; best = x; }
    }
    const clear = room(best);
    const spread = THREE.MathUtils.clamp(clear - 1, 0, this.plan.spread);
    this.after.set(best + spread, heightAt(best + spread, this.after.z), this.after.z);
    this.way.set(best + spread, heightAt(best + spread, this.way.z), this.way.z);
    this.crossX = best - spread;
  }

  private pegIndex(sheet: number, i: number): number {
    let n = 0;
    for (let j = 0; j < sheet; j++) n += this.plan.pegs[j].length;
    return n + i;
  }

  /** The pegs of one stage come off the line, and the cloth they held drops. */
  private pop(stage: number): void {
    const k = tuning.linesPassage;
    lineDir.subVectors(this.b, this.a).normalize();
    const going = this.plan.order[stage].map(([s, i]) => this.pegs[this.pegIndex(s, i)]);
    for (const peg of going) { peg.off = true; peg.resting = false; peg.p.copy(peg.on); }
    for (const peg of going) {
      // Outward along the line, away from what is still pegged, and a little toward the waiting pair.
      const r = mulberry32(Math.floor(peg.seed * 1e6));
      const left = this.pegs.filter(p => p.sheet === peg.sheet && !p.off).map(p => p.u);
      const out = Math.sign(peg.u - (left.length ? left.reduce((a, b) => a + b) / left.length : 0.5)) || 1;
      peg.v.copy(lineDir).multiplyScalar(out * k.pegFling * (0.6 + 0.5 * r()));
      peg.v.y = k.pegHop * (0.85 + 0.3 * r());
      peg.v.z += k.pegFling * (0.35 + 0.4 * r());
      peg.spin.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(9 + 8 * r());
      this.pops++;
    }
    if (stage === this.stages - 1 && this.plan.torn) this.tear();
    this.repin();
    // Held taut between its pegs, the cloth springs back toward those still holding it as it lets go.
    if (this.plan.torn && stage === this.stages - 1) return;
    this.sheets.forEach((s, j) => {
      const on = this.pegs.filter(p => p.sheet === j && !p.off).map(p => p.u);
      if (!on.length) return;
      const lo = Math.min(...on), hi = Math.max(...on), { cloth } = s;
      for (let i = 0; i < cloth.count; i++) {
        const u = (i % cloth.cols) / (cloth.cols - 1);
        const back = (u < lo ? lo - u : u > hi ? hi - u : 0) * cloth.width * k.recoil;
        // It never falls quite flat: a ripple across it starts the folds.
        const across = back ? 0.6 * Math.sin(u * 17 + Math.floor(i / cloth.cols) * 0.9 + this.popped) : 0;
        if (cloth.free[i]) cloth.kick(i, lineDir.x * back, i < cloth.cols ? 0.6 : 0, lineDir.z * back + across, STEP);
      }
    });
  }

  /**
   * The last pegs go and the breeze takes the whole sheet. It comes down across its middle over the snag line, the
   * end of it nearer the line's start going to that end, so it turns the short way as it flies.
   */
  private tear(): void {
    const k = tuning.linesPassage;
    const { cloth } = this.sheets[0];
    const row = Math.round((cloth.rows - 1) * k.catchRow);
    const c0 = Math.round((cloth.cols - 1) * k.catchMargin), c1 = cloth.cols - 1 - c0;
    this.caught = [];
    for (let c = c0; c <= c1; c++) this.caught.push(row * cloth.cols + c);
    const first = this.caught[0] * 3, last = this.caught[this.caught.length - 1] * 3;
    const flip = (cloth.pos[last] - cloth.pos[first]) * (SNAG_LINE.b.x - SNAG_LINE.a.x) +
      (cloth.pos[last + 2] - cloth.pos[first + 2]) * (SNAG_LINE.b.z - SNAG_LINE.a.z) < 0;
    const reach = (c1 - c0) / (cloth.cols - 1) * cloth.width * k.catchGather / SNAG_LINE.a.distanceTo(SNAG_LINE.b);
    const mid = (SNAG_LINE.bare[0] + SNAG_LINE.bare[1]) / 2;
    this.catchAt = this.caught.map((_, n) => {
      const f = n / (this.caught.length - 1) - 0.5;
      const on = lineAt(SNAG_LINE, mid + (flip ? -f : f) * reach, new THREE.Vector3());
      on.y += 0.04;
      return on;
    });
    this.catchMid.set(0, 0, 0);
    for (const p of this.catchAt) this.catchMid.addScaledVector(p, 1 / this.catchAt.length);
    this.flightFrom.set(0, 0, 0);
    for (const i of this.caught) this.flightFrom.addScaledVector(tmp.fromArray(cloth.pos, i * 3), 1 / this.caught.length);
    this.tornShape = this.caught.map(i => new THREE.Vector3().fromArray(cloth.pos, i * 3).sub(this.flightFrom));
    const from = Math.atan2(-(cloth.pos[last + 2] - cloth.pos[first + 2]), cloth.pos[last] - cloth.pos[first]);
    const start = this.catchAt[0], end = this.catchAt[this.catchAt.length - 1];
    const to = Math.atan2(start.z - end.z, end.x - start.x);
    this.yaw = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    this.flight = 0;
  }

  /**
   * Where the middle of the caught particles is carried at time t of the flight: up on the gust and over the line by
   * `flightOver` of the way, then down onto it.
   */
  private carried(t: number, out: THREE.Vector3): THREE.Vector3 {
    const k = tuning.linesPassage;
    const s = Math.min(1, t / k.flightSeconds);
    out.lerpVectors(this.flightFrom, this.catchMid, THREE.MathUtils.smootherstep(s, 0, k.flightOver));
    out.y = THREE.MathUtils.lerp(this.flightFrom.y, this.catchMid.y, THREE.MathUtils.smoothstep(s, 0, 1)) +
      Math.sin(s * Math.PI) * k.flightRise;
    return out;
  }

  /**
   * The breeze carries the torn sheet toward the line and turns it, and its middle is drawn softly into place: each
   * particle across it toward its place in a row that turns from how it tore to how it will lie.
   */
  private steer(h: number): void {
    const k = tuning.linesPassage;
    const { cloth } = this.sheets[0];
    const s = this.flight / k.flightSeconds;
    this.carried(this.flight, this.path);
    this.carried(this.flight + 0.05, this.pathNext);
    const vx = (this.pathNext.x - this.path.x) / 0.05, vy = (this.pathNext.y - this.path.y) / 0.05;
    const vz = (this.pathNext.z - this.path.z) / 0.05;
    // The air carries the whole sheet, and drifts it back toward its way; the pull on its middle only shapes it.
    this.point.set(0, 0, 0);
    for (const i of this.caught) this.point.addScaledVector(tmp.fromArray(cloth.pos, i * 3), 1 / this.caught.length);
    this.point.subVectors(this.path, this.point).multiplyScalar(k.flightAim);
    this.air.x += vx * k.flightAhead + this.point.x;
    this.air.y += vy + 9.8 / k.flightFollow * k.flightLift + this.point.y;
    this.air.z += vz * k.flightAhead + this.point.z;
    // Loose in a sideways gust it swings face on at once, so it sails with the breeze filling it rather than sliding
    // edgeways; the breeze turns it rather than anything twisting it round.
    const turn = THREE.MathUtils.smoothstep(s, 0, k.flightTurn);
    this.air.spin = this.yaw * (THREE.MathUtils.smoothstep(s + 0.01, 0, k.flightTurn) - turn) / (0.01 * k.flightSeconds);
    this.air.cx = this.path.x; this.air.cz = this.path.z;
    const lie = THREE.MathUtils.smoothstep(s, 0.5, 1);
    const w = THREE.MathUtils.lerp(k.flightGrip, k.catchGrip, lie) * THREE.MathUtils.smoothstep(s, 0, 0.15);
    this.caught.forEach((i, n) => {
      this.point.subVectors(this.catchAt[n], this.catchMid);
      tmp.copy(this.tornShape[n]).applyAxisAngle(UP, this.yaw * turn).lerp(this.point, lie).add(this.path);
      cloth.velocity(i, h, this.velocity);
      let ax = w * w * (tmp.x - cloth.pos[i * 3]) + 2 * w * (vx - this.velocity.x);
      let ay = w * w * (tmp.y - cloth.pos[i * 3 + 1]) + 2 * w * (vy - this.velocity.y);
      let az = w * w * (tmp.z - cloth.pos[i * 3 + 2]) + 2 * w * (vz - this.velocity.z);
      const a = Math.hypot(ax, ay, az);
      if (a > 40) { ax *= 40 / a; ay *= 40 / a; az *= 40 / a; }
      cloth.kick(i, ax * h, ay * h, az * h, h);
    });
    if (s >= 1) this.snag();
  }

  /**
   * The line takes the sheet where it has come down across it: in each column the particle nearest the line, if it
   * is within `catchReach`, is held where it touches. Should it have come down badly, the middle is held instead,
   * so it is never left hovering.
   */
  private snag(): void {
    const k = tuning.linesPassage;
    const { cloth } = this.sheets[0];
    const { a, b, bare } = SNAG_LINE;
    const ex = b.x - a.x, ez = b.z - a.z, run = ex * ex + ez * ez;
    this.hung = []; this.hungAt = [];
    for (let c = 0; c < cloth.cols; c++) {
      let best = -1, near = k.catchReach;
      const at = new THREE.Vector3();
      for (let r = 0; r < cloth.rows; r++) {
        const i = (r * cloth.cols + c) * 3;
        const t = ((cloth.pos[i] - a.x) * ex + (cloth.pos[i + 2] - a.z) * ez) / run;
        if (t < bare[0] || t > bare[1]) continue;
        lineAt(SNAG_LINE, t, this.point);
        const d = this.point.distanceTo(tmp.fromArray(cloth.pos, i));
        if (d < near) { near = d; best = i / 3; at.copy(this.point); }
      }
      if (best >= 0) { this.hung.push(best); this.hungAt.push(at.setY(at.y + 0.04)); }
    }
    if (this.hung.length < 4) { this.hung = this.caught; this.hungAt = this.catchAt; }
    this.hungFrom = this.hung.map(i => new THREE.Vector3().fromArray(cloth.pos, i * 3));
    this.snagged = true;
    this.repin();
  }

  /** The caught particles settle `h` further onto the line from where it took them. */
  private lay(h: number): void {
    const { cloth } = this.sheets[0];
    this.settled = Math.min(1, this.settled + h / tuning.linesPassage.catchSettle);
    const f = THREE.MathUtils.smootherstep(this.settled, 0, 1);
    this.hung.forEach((i, n) => {
      tmp.lerpVectors(this.hungFrom[n], this.hungAt[n], f);
      cloth.hold(i, tmp.x, tmp.y, tmp.z);
    });
  }

  private simulate(h: number, settling: boolean): void {
    const k = tuning.linesPassage;
    this.time += h;
    const down = this.popped >= this.stages;
    let ax = settling ? 0 : this.sway.x, az = settling ? 0 : this.sway.z;
    // The player's air pushes the pegged sheet away through the gap, lifting its hem.
    if (!down) az -= this.billow * k.pushSpeed;
    // Pegged, a sheet lifts in a gust but never streams flat; down, it feels only the breeze, so a gust cannot
    // throw it back into the way.
    const most = down ? k.restAir : k.liveAir;
    ax = THREE.MathUtils.clamp(ax, -most, most);
    az = THREE.MathUtils.clamp(az, -most, most);
    this.air.x = ax; this.air.y = 0; this.air.z = az; this.air.spin = 0;
    const flying = this.flight >= 0 && !this.snagged;
    if (flying) {
      this.steer(h);
      this.flight += h;
    } else if (this.snagged && this.settled < 1) this.lay(h);
    const t = this.time;
    const floor = this.floor!;
    this.sheets.forEach((s, j) => {
      const phase = this.phase[j];
      const gust = (i: number) => 1 + 0.3 * Math.sin(t * 2.3 - phase[i]) + 0.15 * Math.sin(t * 5.3 - phase[i] * 1.7);
      s.cloth.step(h, this.air, k.drag, k.damping, k.iterations, gust, floor.at, this.posts, flying ? k.flightFollow : 0, this.rails);
    });
  }

  private fly(peg: CurtainPeg, dt: number): void {
    peg.v.y -= 9.8 * dt;
    peg.p.addScaledVector(peg.v, dt);
    const turn = peg.spin.length();
    if (turn > 1e-4) peg.q.premultiply(tmpQ.setFromAxisAngle(tmp.copy(peg.spin).divideScalar(turn), turn * dt));
    const rest = this.floor!.at(peg.p.x, peg.p.z) + 0.03;
    if (peg.p.y > rest) return;
    peg.p.y = rest;
    if (peg.v.y < -1.4) {
      peg.v.y *= -0.3; peg.v.x *= 0.5; peg.v.z *= 0.5; peg.spin.multiplyScalar(0.5);
      return;
    }
    // Lying on its side where it came down.
    tmp.set(0, 1, 0).applyQuaternion(peg.q).setY(0);
    if (tmp.lengthSq() < 1e-4) tmp.set(1, 0, 0);
    tmpQ.setFromUnitVectors(UP, tmp.normalize());
    peg.q.copy(tmpQ);
    peg.v.set(0, 0, 0); peg.spin.set(0, 0, 0);
    peg.resting = true;
  }

  /**
   * Cloth stands above the ground a low camera projects onto. Brush the visible sheet into the SAME wind field,
   * at the sheet, so an ordinary sweep reaches it instead of landing on the hillside behind it.
   */
  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if (input.muted || !input.present || input.gust < tuning.linesPassage.brushFrom || input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    let touch = 0;
    for (const dx of [-0.35, 0, 0.35]) for (const dy of [-1.5, 0, 1.5]) {
      this.point.set(this.center.x + dx * this.width, this.center.y + dy, this.center.z);
      touch = Math.max(touch, screenBrush(camera, this.point, input.prevNdc, input.ndc, tuning.linesPassage.brushRadius));
    }
    if (touch < 0.02) return;
    this.touched = true;
    this.brushAge = 0;
    const speed = input.gust * Math.sqrt(touch);
    wind.addSplat({ source: this, ax: this.a.x, az: this.a.z, bx: this.b.x, bz: this.b.z,
      vx: input.gustDir.x * speed, vz: input.gustDir.y * speed, radius: 3,
      energy: Math.min(0.5, speed / 25), swirl: 0, lift: 0 });
  }
}

export const CURTAINS = CURTAIN_LAYOUT.map((c, i) => new WashingCurtain(i, c.x, c.z, c.width, c.panels));
export const washingPassage: { active: WashingCurtain | null } = { active: null };

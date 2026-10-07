import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { range, type Rng } from '../creatures/motion';

/**
 * The drowned village's houses, in the construction of home's cottage: clean modelled masses with crisp edges and a
 * few crafted parts, coloured from the room's painting. Their character is in the silhouette; the light does the rest.
 */

/** Albedos are written linear: the renderer never tone-maps on the way in, so an sRGB hex would clip to white. */
const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

export const PLAIN = 0;
export const THATCHED = 1;
export const SLATED = 2;
export const OPENING = 3;
export const MASONRY = 4;
export const ROCK = 5;
export const ROPE = 6;
export const VANE = 7;
export const COURSED = 8;

/** Cream limewash that catches the low sun, a narrow range so the light gives the richness. */
export const LIME = [lin(0.56, 0.48, 0.355), lin(0.52, 0.46, 0.36), lin(0.58, 0.47, 0.33), lin(0.5, 0.45, 0.375)];
/** Deep weathered thatch, brown-grey rather than honey. */
export const THATCH = [lin(0.1, 0.082, 0.064), lin(0.088, 0.076, 0.064), lin(0.11, 0.088, 0.066)];
/** Charcoal slate and a dark brown-grey. */
export const SLATE = [lin(0.06, 0.058, 0.064), lin(0.052, 0.05, 0.058), lin(0.072, 0.062, 0.056)];
export const HOLLOW = lin(0.014, 0.016, 0.021);
export const TIMBER = lin(0.082, 0.06, 0.042);
const FRAME = lin(0.17, 0.12, 0.08);
const BRICK = lin(0.34, 0.082, 0.042);

/** The houses of the painted kit; `cottage` and `thatch` are the modest ones most of the village is made of. */
export type HouseType = 'cottage' | 'thatch' | 'swayback' | 'tallHat' | 'lowCap' | 'pocket' | 'catShoulder' | 'tucked'
  | 'roundKeeper' | 'openShutter';

/** A chimney: where along the ridge (-1 one gable end, 1 the other), how far its top stands above the ridge, its pots. */
export interface Stack {
  side: number;
  above: number;
  pots: number;
}

/**
 * The ground a house is built on and its frame: its length along local x, depth across, wall to the eaves, the roof's
 * rise above them, and how far its foot is under the water. `exact` keeps a slate roof's planes true to the way's
 * `slatesAt`, for roofs she walks on.
 */
export interface Lot {
  len: number;
  depth: number;
  wall: number;
  rise: number;
  sink: number;
  lime: THREE.Color;
  roof: THREE.Color;
  stacks: Stack[];
  /** The gable end (along local x, -1 or 1) with a small window in it, just out of the water. */
  gable?: number;
  exact?: boolean;
}

export interface PartSink {
  add(geo: THREE.BufferGeometry, colour: THREE.Color, kind: number, m?: THREE.Matrix4): void;
}

/** A roof's frame for a type on a generated lot: the rare shapes take their own proportions, sunk to show them. */
export function fitLot(type: HouseType, lot: Lot, rand: Rng): Lot {
  const ridgeOut = (l: Lot, out: number) => ({ ...l, sink: Math.max(l.sink, l.wall + l.rise - out) });
  switch (type) {
    case 'tallHat':
      return ridgeOut({ ...lot, len: 3.6, depth: 4.4, wall: 3.2, rise: range(rand, 6.2, 6.8), gable: 1 }, range(rand, 6.4, 7));
    case 'tucked':
      return { ...lot, sink: Math.min(lot.sink, 2.4) };
    case 'pocket':
      return { ...lot, len: 5, depth: 4, wall: 3, rise: 1.6, sink: Math.min(lot.sink, 1.6) };
    case 'roundKeeper':
      return { ...lot, len: 6.4, depth: 6.4, wall: 3.4, rise: 2.3, sink: Math.min(lot.sink, 1.2) };
    case 'lowCap':
      return { ...lot, len: Math.min(lot.len, 9.5), rise: lot.depth * 0.5, sink: Math.min(lot.sink, 2) };
    case 'swayback':
      return { ...lot, sink: Math.min(lot.sink, 2.6) };
    case 'openShutter':
      return { ...lot, sink: Math.min(lot.sink, 2.4) };
    default:
      return lot;
  }
}

/** Builds one house in its own frame `m` and returns the tops of its chimney pots in the world, for herons to stand on. */
export function buildHouse(into: PartSink, type: HouseType, lot: Lot, rand: Rng, m: THREE.Matrix4): THREE.Vector3[] {
  const perches: THREE.Vector3[] = [];
  const out = (p: THREE.Vector3) => perches.push(p.applyMatrix4(m));
  switch (type) {
    case 'lowCap':
      lowCap(into, lot, rand, m, out);
      break;
    case 'roundKeeper':
      roundKeeper(into, lot, rand, m, out);
      break;
    case 'tucked':
      tucked(into, lot, rand, m, out);
      break;
    default:
      gableHouse(into, gableFor(type, lot, rand), lot, rand, m, out, type === 'catShoulder' ? 1.0 : type === 'pocket' ? 0.5 : 0.8);
      if (type === 'openShutter') dormer(into, gableFor(type, lot, rand), lot, rand, m, true);
  }
  return perches;
}

interface Gable {
  len: number;
  depth: number;
  wall: number;
  rise: number;
  thatched: boolean;
  /** How far the roof overhangs the long walls and the gable ends. */
  over: number;
  end: number;
  /** The ridge dips this much between its ends; the eaves' corners lift this much; the slopes hollow (+) or swell (-). */
  sag: number;
  lift: number;
  bow: number;
  /** The apex leans across by this much of its height: a crooked hat. */
  lean: number;
  /** The chimney leans over by this angle. */
  tilt: number;
  /** The ridge falls this much from the middle to each end, more sharply the lower `hipCurve`: a hipped cap. */
  hip?: number;
  hipCurve?: number;
  /** The front eaves lift this much over the window `browAt` along the length (-1 to 1). */
  brow?: number;
  browAt?: number;
}

function gableFor(type: HouseType, lot: Lot, rand: Rng): Gable {
  const thatched = type === 'thatch';
  const g: Gable = {
    len: lot.len, depth: lot.depth, wall: lot.wall, rise: lot.rise, thatched,
    over: thatched ? 0.5 : 0.28, end: thatched ? 0.42 : 0.11, sag: 0, lift: 0, bow: 0, lean: 0, tilt: 0,
  };
  if (lot.exact) return g;
  switch (type) {
    case 'cottage':
      return { ...g, lift: range(rand, 0, 0.12), end: 0.3, over: 0.36 };
    case 'thatch':
      return { ...g, sag: range(rand, 0, 0.25) };
    case 'swayback':
      return { ...g, sag: range(rand, 0.55, 0.75), lift: range(rand, 0.22, 0.3), end: 0.35, over: 0.4, tilt: range(rand, 0.07, 0.1) };
    case 'tallHat':
      return { ...g, bow: 0.34, lean: range(rand, 0.04, 0.07), end: 0.34, over: 0.45, lift: 0.22 };
    case 'lowCap':
      return { ...g, thatched: true, wall: lot.wall - 0.2, over: 0.75, end: 0.7, hip: lot.rise * 0.5, hipCurve: 2.4,
        brow: 0.9, browAt: range(rand, -0.3, 0.3) };
    case 'pocket':
      return { ...g, end: 0.16, over: 0.2, tilt: range(rand, -0.05, 0.05) };
    case 'openShutter':
      return { ...g, lift: 0.1, end: 0.3, over: 0.36 };
    default:
      return g;
  }
}

type Toward = THREE.Vector3 | ((p: THREE.Vector3) => THREE.Vector3);
const outward: Toward = (p) => new THREE.Vector3(p.x, 0, p.z);

/** Flips a geometry's winding if its normals point mostly away from `toward`, so it faces out under front-face culling. */
function facing(geo: THREE.BufferGeometry, toward: Toward): THREE.BufferGeometry {
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const p = new THREE.Vector3();
  let sum = 0;
  for (let i = 0; i < n.count; i++) {
    const t = typeof toward === 'function' ? toward(p.fromBufferAttribute(geo.attributes.position, i)) : toward;
    sum += n.getX(i) * t.x + n.getY(i) * t.y + n.getZ(i) * t.z;
  }
  if (sum < 0) {
    const idx = geo.index!.array;
    for (let k = 0; k < idx.length; k += 3) {
      const t = idx[k + 1];
      idx[k + 1] = idx[k + 2];
      idx[k + 2] = t;
    }
    geo.computeVertexNormals();
  }
  return geo;
}

/** A sheet of quads over `rows` by `cols`, smooth within itself and crisp against its neighbours. */
function sheet(rows: number, cols: number, at: (i: number, j: number) => THREE.Vector3, toward: Toward, weld = false): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const p = at(i, j);
      pos.push(p.x, p.y, p.z);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  if (weld) geo = mergeVertices(geo, 1e-4);
  return facing(geo, toward);
}

/** A flat polygon, its points given as (z, y) at `x`, or as (x, z) at heights `ys` when `ys` is given. */
function cap(contour: THREE.Vector2[], toward: THREE.Vector3, x: number, ys?: number[]): THREE.BufferGeometry {
  const pos: number[] = [];
  contour.forEach((p, i) => (ys ? pos.push(p.x, ys[i], p.y) : pos.push(x, p.y, p.x)));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(THREE.ShapeUtils.triangulateShape(contour, []).flat());
  return facing(geo, toward);
}

/** Boxes laid end to end along a polyline: a ridge roll, a bargeboard. `up` turns the box's height off vertical. */
function rail(into: PartSink, points: THREE.Vector3[], w: number, h: number, colour: THREE.Color, kind: number, m: THREE.Matrix4, up = new THREE.Vector3(0, 1, 0)): void {
  const x = new THREE.Vector3();
  const z = new THREE.Vector3();
  const y = new THREE.Vector3();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = a.distanceTo(b);
    x.subVectors(b, a).normalize();
    z.crossVectors(x, up).normalize();
    y.crossVectors(z, x);
    const frame = new THREE.Matrix4().makeBasis(x, y, z).setPosition(a.clone().lerp(b, 0.5));
    into.add(new THREE.BoxGeometry(len + w * 0.6, h, w).applyMatrix4(frame), colour, kind, m);
  }
}

/** The roof's top surface `u` of the way from the eaves (0) to the apex (1), `t` along its length, on `side` of the ridge. */
class Roofline {
  readonly half: number;
  readonly eave: number;
  readonly apex: number;
  readonly thick: number;
  readonly length: number;
  readonly stations: number;
  readonly across: number;

  constructor(readonly g: Gable, readonly exact: boolean) {
    this.half = g.depth / 2 + g.over;
    this.eave = g.thatched ? g.wall - 0.4 : g.wall - 0.1;
    this.apex = g.wall + g.rise + (g.thatched ? 0 : 0.04);
    this.thick = g.thatched ? 0.5 : 0.2;
    this.length = g.len + 2 * g.end;
    this.stations = g.sag || g.lift || g.hip || g.brow || g.thatched ? 16 : 1;
    this.across = g.bow || g.thatched ? 6 : 1;
  }

  /** How far along the length a point at local `x` is, 0 to 1. */
  t(x: number): number {
    return x / this.length + 0.5;
  }

  ridge(t: number): number {
    const e = 2 * t - 1;
    let y = this.apex - this.g.sag * (1 - e * e) - (this.g.hip ?? 0) * Math.abs(e) ** (this.g.hipCurve ?? 2);
    /** Thatch rolls down over its gable ends rather than stopping square. */
    if (this.g.thatched) y -= 0.55 * THREE.MathUtils.smoothstep(Math.abs(e), 1 - 1.4 / this.length, 1) ** 2;
    return y;
  }

  eaves(t: number, side = 0): number {
    const e = 2 * t - 1;
    const brow = side > 0 && this.g.brow ? this.g.brow * Math.exp(-((((e - (this.g.browAt ?? 0)) * this.length) / 2.2) ** 2)) : 0;
    return this.eave + this.g.lift * e ** 4 + brow;
  }

  /** The apex's offset across the house. */
  lean(t: number): number {
    return this.g.lean * (this.ridge(t) - this.eaves(t));
  }

  top(t: number, side: number, u: number, under = 0): THREE.Vector3 {
    const eave = this.eaves(t, side);
    const rise = this.ridge(t) - eave;
    /** A thatch swells: rounder at the eaves than at the ridge. */
    const bow = this.g.thatched ? -0.55 : this.g.bow;
    const g = u - bow * u * (1 - u);
    const c = this.lean(t);
    const z = side * this.half + (c - side * this.half) * u;
    return new THREE.Vector3((t - 0.5) * this.length, eave + rise * g - under, z);
  }

  /** The height of the roof's underside over `z` across, at `t`. */
  underAt(t: number, z: number): number {
    const c = this.lean(t);
    const side = z >= c ? 1 : -1;
    const u = THREE.MathUtils.clamp((z - side * this.half) / (c - side * this.half), 0, 1);
    return this.top(t, side, u, this.thick).y;
  }

  /** The height of the roof's top surface over `z` across, at `t`. */
  topAt(t: number, z: number): number {
    return this.underAt(t, z) + this.thick;
  }
}

function roofGeometry(into: PartSink, r: Roofline, colour: THREE.Color, m: THREE.Matrix4): void {
  const kind = r.g.thatched ? THATCHED : SLATED;
  const { stations: n, across: k } = r;
  for (const side of [-1, 1]) {
    into.add(sheet(n, k, (i, j) => r.top(i / n, side, j / k), new THREE.Vector3(0, 1, side * 0.3)), colour, kind, m);
    into.add(sheet(n, k, (i, j) => r.top(i / n, side, j / k, r.thick), new THREE.Vector3(0, -1, 0)), colour, kind, m);
    into.add(sheet(n, 1, (i, j) => r.top(i / n, side, 0, j * r.thick), new THREE.Vector3(0, 0, side)), colour, kind, m);
    for (const end of [0, 1]) {
      into.add(sheet(k, 1, (i, j) => r.top(end, side, i / k, j * r.thick), new THREE.Vector3(end ? 1 : -1, 0, 0)), colour, kind, m);
    }
  }
}

/** The walls, lofted under the roof so a sagging or leaning roof still sits on them; their ends are the gables. */
function bodyGeometry(into: PartSink, r: Roofline, len: number, depth: number, colour: THREE.Color, m: THREE.Matrix4): void {
  const n = r.stations;
  const hw = depth / 2;
  const bottom = -2.6;
  const samples = 6;
  const section = (i: number): THREE.Vector2[] => {
    const x = (i / n - 0.5) * len;
    const t = r.t(x);
    const c = r.lean(t);
    const pts = [new THREE.Vector2(hw, bottom)];
    for (let s = 0; s <= samples; s++) {
      const z = hw + (c - hw) * (s / samples);
      pts.push(new THREE.Vector2(z, r.underAt(t, z) - 0.03));
    }
    for (let s = 1; s <= samples; s++) {
      const z = c + (-hw - c) * (s / samples);
      pts.push(new THREE.Vector2(z, r.underAt(t, z) - 0.03));
    }
    pts.push(new THREE.Vector2(-hw, bottom));
    return pts;
  };
  const sections = Array.from({ length: n + 1 }, (_, i) => section(i));
  const count = sections[0].length;
  for (let e = 0; e < count; e++) {
    const f = (e + 1) % count;
    const mid = sections[0][e].clone().add(sections[0][f]).multiplyScalar(0.5);
    const toward = new THREE.Vector3(0, mid.y - (bottom + r.eave) / 2, mid.x);
    if (e === count - 1) toward.set(0, -1, 0);
    into.add(sheet(n, 1, (i, j) => {
      const p = sections[i][j ? f : e];
      return new THREE.Vector3((i / n - 0.5) * len, p.y, p.x);
    }, toward), colour, PLAIN, m);
  }
  into.add(cap(sections[0], new THREE.Vector3(-1, 0, 0), -len / 2), colour, PLAIN, m);
  into.add(cap(sections[n], new THREE.Vector3(1, 0, 0), len / 2), colour, PLAIN, m);
}

/** A dark window set in a wall, with its frame and sill; `frame` places it, facing its +z. Arched, it has no frame. */
function windowAt(into: PartSink, w: number, h: number, frame: THREE.Matrix4, arched = false): void {
  if (arched) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2);
    s.lineTo(w / 2, -h / 2);
    s.lineTo(w / 2, h / 2 - w / 2);
    s.absarc(0, h / 2 - w / 2, w / 2, 0, Math.PI, false);
    s.lineTo(-w / 2, -h / 2);
    into.add(new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.24), HOLLOW, OPENING, frame);
    into.add(new THREE.BoxGeometry(w + 0.24, 0.1, 0.22).translate(0, -h / 2 - 0.05, 0.08), FRAME, PLAIN, frame);
    return;
  }
  into.add(new THREE.BoxGeometry(w, h, 0.3).translate(0, 0, -0.1), HOLLOW, OPENING, frame);
  const bar = 0.09;
  into.add(new THREE.BoxGeometry(w + bar * 2, bar, 0.12).translate(0, h / 2 + bar / 2, 0.04), FRAME, PLAIN, frame);
  for (const s of [-1, 1]) into.add(new THREE.BoxGeometry(bar, h, 0.12).translate(s * (w / 2 + bar / 2), 0, 0.04), FRAME, PLAIN, frame);
  into.add(new THREE.BoxGeometry(w + 0.3, 0.1, 0.26).translate(0, -h / 2 - 0.05, 0.1), FRAME, PLAIN, frame);
}

/** A frame at `(x, y, z)` turned to face `yaw` (0 faces +z) and tipped a little off true. */
function placed(m: THREE.Matrix4, x: number, y: number, z: number, yaw: number, wonk = 0): THREE.Matrix4 {
  return new THREE.Matrix4().copy(m).multiply(new THREE.Matrix4().makeTranslation(x, y, z))
    .multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationZ(wonk));
}

/**
 * A chimney standing from `base` to `top` at (x, z): a limewashed or stone shaft, its cap and brick pots. The pots' rims
 * are 0.58 above `top`, where a cat can sit. Returns that point.
 */
function chimney(into: PartSink, x: number, z: number, base: number, top: number, pots: number, w: number, shaft: THREE.Color, tilt: number, m: THREE.Matrix4): THREE.Vector3 {
  const lean = new THREE.Matrix4().copy(m).multiply(new THREE.Matrix4().makeTranslation(x, base, z))
    .multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(new THREE.Matrix4().makeTranslation(-x, -base, -z));
  const tall = top - base;
  const d = w * 0.94;
  into.add(new THREE.BoxGeometry(w, tall, d).translate(x, base + tall / 2, z), shaft, MASONRY, lean);
  into.add(new THREE.BoxGeometry(w + 0.2, 0.16, d + 0.2).translate(x, top + 0.08, z), shaft, MASONRY, lean);
  into.add(new THREE.BoxGeometry(w + 0.12, 0.1, d + 0.12).translate(x, top - 0.28, z), shaft, MASONRY, lean);
  for (const dz of pots === 1 ? [0] : [-0.24, 0.24]) {
    into.add(new THREE.CylinderGeometry(0.14, 0.16, 0.36, 8).translate(x, top + 0.34, z + dz), BRICK, MASONRY, lean);
    into.add(new THREE.CylinderGeometry(0.175, 0.15, 0.1, 8).translate(x, top + 0.53, z + dz), BRICK, MASONRY, lean);
  }
  return new THREE.Vector3(x, top + 0.2, z).applyMatrix4(new THREE.Matrix4().makeTranslation(x, base, z)
    .multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(new THREE.Matrix4().makeTranslation(-x, -base, -z)));
}

function gableHouse(into: PartSink, g: Gable, lot: Lot, rand: Rng, m: THREE.Matrix4, perch: (p: THREE.Vector3) => void, stackWidth: number): void {
  const r = new Roofline(g, !!lot.exact);
  bodyGeometry(into, r, g.len, g.depth, lot.lime, m);
  roofGeometry(into, r, lot.roof, m);
  const n = Math.max(r.stations, 6);
  const ridge = Array.from({ length: n + 1 }, (_, i) => r.top(i / n, 1, 1));
  if (!g.thatched) {
    /** The ridge's thin line: on a walked roof its top is the ridge she walks. */
    rail(into, ridge.map((p) => p.clone().setY(p.y - (lot.exact ? 0.08 : 0.03))), 0.3, 0.16, lot.roof, SLATED, m);
    /** Bargeboards along each gable's verge, a lit edge to the timber. */
    for (const end of [0, 1]) {
      for (const side of [-1, 1]) {
        const k = Math.max(r.across, 4);
        const pts = Array.from({ length: k + 1 }, (_, j) => r.top(end, side, j / k, 0.14).add(new THREE.Vector3((end ? 1 : -1) * 0.04, 0, 0)));
        rail(into, pts, 0.1, 0.3, TIMBER, PLAIN, m);
      }
    }
  }
  for (const s of lot.stacks) {
    const x = s.side * (lot.len / 2 - 0.75);
    const t = r.t(x);
    const top = r.ridge(t) - (g.thatched ? 0 : 0.04) + s.above;
    const base = Math.min(g.wall - 0.6, r.eaves(t));
    perch(chimney(into, x, r.lean(t), base, top, s.pots, stackWidth, lot.lime, g.tilt * s.side, m));
  }

  const showing = (y: number) => y > lot.sink + 0.15;
  /** One gable window, off the middle, its foot near the water: windows are never a pair of eyes. */
  const gableEnd = lot.gable ?? (rand() < 0.5 ? -1 : 1);
  const across = lot.gable ? 0 : range(rand, -0.22, 0.22) * g.depth;
  const wy = Math.max(lot.sink + 0.75, Math.min(g.wall + 0.55, r.underAt(r.t(0), across) - 1.2));
  const gw = g.depth < 4.8 ? 0.5 : 0.62;
  const gh = g.depth < 4.8 ? 0.95 : 0.85;
  if (showing(wy + gh / 2) && r.underAt(r.t(gableEnd * g.len / 2), across) > wy + gh / 2 + 0.25) {
    windowAt(into, gw, gh, placed(m, gableEnd * (g.len / 2 + 0.02), wy, across, gableEnd * Math.PI / 2, range(rand, -0.04, 0.04)), g.depth < 4.8);
  }
  /** The upstairs windows are set at the flood line, so the water stands in them; one to a side, never opposite. */
  if (g.wall - lot.sink > -0.9) {
    const sill = Math.min(lot.sink + 0.8, g.wall - 0.55);
    const along = range(rand, 0.12, 0.3) * g.len;
    for (const side of [-1, 1]) {
      const x = side * along * (rand() < 0.5 ? 1 : -1);
      windowAt(into, 0.8, 0.95, placed(m, x, sill, side * (g.depth / 2 + 0.02), side > 0 ? 0 : Math.PI, range(rand, -0.03, 0.03)));
    }
  }
}

/** A dormer on the front slope, its own little gable roof; with `shutter`, one plain shutter stands open beside it. */
function dormer(into: PartSink, g: Gable, lot: Lot, rand: Rng, m: THREE.Matrix4, shutter: boolean): void {
  const r = new Roofline(g, false);
  const x = range(rand, -0.2, 0.05) * g.len;
  const t = r.t(x);
  const w = 1.7;
  const zf = r.half * 0.5;
  const foot = r.underAt(t, zf);
  if (foot < lot.sink + 0.8) return;
  const eave = foot + 1.15;
  const peak = eave + 0.75;
  const slope = (r.ridge(t) - r.eaves(t)) / r.half;
  const deep = Math.min(zf + 0.4, (peak + 0.25 - r.topAt(t, zf)) / slope + 0.3);
  const d: Gable = { len: deep, depth: w, wall: eave - foot + 0.1, rise: peak - eave, thatched: false, over: 0.16, end: 0.12, sag: 0, lift: 0, bow: 0, lean: 0, tilt: 0 };
  const frame = new THREE.Matrix4().copy(m).multiply(new THREE.Matrix4().makeTranslation(x, foot - 0.1, zf - deep / 2))
    .multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
  const dr = new Roofline(d, false);
  bodyGeometry(into, dr, d.len, d.depth, lot.lime, frame);
  roofGeometry(into, dr, lot.roof, frame);
  const sill = foot + 0.65;
  const win = placed(m, x, sill, zf + 0.02, 0, range(rand, -0.03, 0.03));
  windowAt(into, 0.66, 0.72, win);
  if (shutter) {
    const open = 0.5;
    into.add(new THREE.BoxGeometry(0.42, 0.86, 0.06).translate(0.21, 0, 0),
      TIMBER, PLAIN, new THREE.Matrix4().copy(win).multiply(new THREE.Matrix4().makeTranslation(0.42, 0, 0.06)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2 + open)));
  }
}

/** Two ordinary cottages overlapping at a small angle and different heights, one roof family. */
function tucked(into: PartSink, lot: Lot, rand: Rng, m: THREE.Matrix4, perch: (p: THREE.Vector3) => void): void {
  const bigLen = lot.len * 0.56;
  const smallLen = lot.len * 0.5;
  const big: Lot = { ...lot, len: bigLen, stacks: lot.stacks.filter((s) => s.side < 0).map((s) => ({ ...s, side: 1 })) };
  const small: Lot = { ...lot, len: smallLen, depth: lot.depth * 0.86, wall: lot.wall - 0.25, rise: lot.rise * 0.82,
    stacks: lot.stacks.filter((s) => s.side > 0), gable: 1 };
  if (!big.stacks.length) big.stacks = [{ side: 1, above: 1.2, pots: 2 }];
  const turn = range(rand, 0.1, 0.16);
  const mb = new THREE.Matrix4().copy(m).multiply(new THREE.Matrix4().makeTranslation(-lot.len / 2 + bigLen / 2, 0, 0));
  const ms = new THREE.Matrix4().copy(m).multiply(new THREE.Matrix4().makeTranslation(lot.len / 2 - smallLen / 2, 0, 0.35))
    .multiply(new THREE.Matrix4().makeRotationY(turn));
  gableHouse(into, gableFor('cottage', big, rand), { ...big, gable: -1 }, rand, mb, perch, 0.8);
  gableHouse(into, gableFor('cottage', small, rand), small, rand, ms, perch, 0.7);
}

/** A broad thatch settled low like a cap: swelling, hipped, its eaves near the water and lifted in a brow over its one window. */
function lowCap(into: PartSink, lot: Lot, rand: Rng, m: THREE.Matrix4, perch: (p: THREE.Vector3) => void): void {
  const g = gableFor('lowCap', lot, rand);
  const r = new Roofline(g, false);
  bodyGeometry(into, r, g.len, g.depth, lot.lime, m);
  roofGeometry(into, r, lot.roof, m);
  const ridge: Gable = { ...g, len: g.len * 0.62, depth: 1.4, wall: r.ridge(0.5) - 0.32, rise: 0.5, over: 0.2, end: 0.25, hip: 0.3, brow: 0 };
  roofGeometry(into, new Roofline(ridge, false), lot.roof, m);
  const x = (g.browAt ?? 0) * (r.length / 2);
  const wy = Math.max(lot.sink + 0.45, r.eaves(r.t(x)) - 0.2);
  if (r.eaves(r.t(x), 1) - 0.45 > wy + 0.4) windowAt(into, 0.8, 0.75, placed(m, x, wy, g.depth / 2 + 0.02, 0));
  for (const s of lot.stacks) {
    const sx = s.side * (g.len / 2 - 1.2);
    const top = r.ridge(r.t(sx)) + s.above * 0.8;
    perch(chimney(into, sx, 0, g.wall - 0.6, top, s.pots, 0.8, lot.lime, 0, m));
  }
}

/** A short round cream wall under a shallow cone of charcoal slate, one small dark arch in it. */
function roundKeeper(into: PartSink, lot: Lot, rand: Rng, m: THREE.Matrix4, perch: (p: THREE.Vector3) => void): void {
  const radius = lot.depth / 2;
  const reach = radius + 0.5;
  const eave = lot.wall - 0.15;
  const apex = lot.wall + lot.rise + 0.4;
  const round = 28;
  const rings = 5;
  const thick = 0.22;
  into.add(new THREE.CylinderGeometry(radius, radius, eave + 2.6, round, 1, true).translate(0, (eave - 2.6) / 2, 0), lot.lime, PLAIN, m);
  const at = (i: number, u: number, under = 0) => {
    const phi = (i / round) * Math.PI * 2;
    const g = u - 0.22 * u * (1 - u);
    const rr = reach * (1 - u);
    return new THREE.Vector3(Math.cos(phi) * rr, eave + (apex - eave) * g - under, Math.sin(phi) * rr);
  };
  into.add(sheet(round, rings, (i, j) => at(i, j / rings), new THREE.Vector3(0, 1, 0), true), lot.roof, SLATED, m);
  into.add(sheet(round, 1, (i, j) => at(i, 0, j * thick), outward, true), lot.roof, SLATED, m);
  const rim = Array.from({ length: round }, (_, i) => at(i, 0, thick));
  into.add(cap(rim.map((p) => new THREE.Vector2(p.x, p.z)), new THREE.Vector3(0, -1, 0), 0, rim.map((p) => p.y)), lot.roof, SLATED, m);
  const tall = 1.0;
  const wy = eave - 0.35 - tall / 2;
  if (wy > lot.sink + 0.2) windowAt(into, 0.62, tall, placed(m, 0, wy, radius - 0.04, 0), true);
  const s = lot.stacks[0] ?? { side: 1, above: 1, pots: 1 };
  const x = 0.9 * s.side;
  const top = apex - 0.4 + s.above * 0.6;
  perch(chimney(into, x, 0, eave, top, s.pots, 0.7, lot.lime, 0, m));
}

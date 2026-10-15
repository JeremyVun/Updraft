import * as THREE from 'three';
import { indexedNormals } from '../gl/indexed-normals';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import type { WindField } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { birchesFirstHeight } from './heightfield';
import { ScarfCloth, type ClothCapsule } from './scarf-cloth';
import { birchesAt, birchesLocal, birchesZ } from './birches-layout';

const X = (x: number): number => birchesAt(x, 0).x;

/** The same strip passes through all four tangles, in walking order. */
const SNAGS_AT = [
  { x: 10, z: -1088, treeX: 14, treeZ: -1089, stopX: 3, stopZ: -1081, kind: 'lift' },
  { x: -10, z: -1139, treeX: -10, treeZ: -1139, stopX: -3, stopZ: -1132, kind: 'unwind' },
  { x: 2, z: -1163, treeX: -23, treeZ: -1166, stopX: -5, stopZ: -1157, kind: 'pull' },
  { x: -10.2, z: -1179.2, treeX: -13, treeZ: -1180, stopX: -3, stopZ: -1176, kind: 'bow' },
] as const;
export const SCARF_SNAGS = SNAGS_AT.map(s => ({ ...s, x: X(s.x), z: birchesZ(s.z), treeX: X(s.treeX), treeZ: birchesZ(s.treeZ),
  stopX: X(s.stopX), stopZ: birchesZ(s.stopZ) }));

/** These are real trees: the long runs double back around them, rather than floating between knots. */
const PERCHES_AT = [
  { x: 20, z: -1099, h: 10 }, { x: -15, z: -1104, h: 4.5 },
  { x: 24, z: -1114, h: 12 }, { x: -21, z: -1125, h: 6 }, { x: 18, z: -1130, h: 10 },
  { x: -20, z: -1148, h: 7 }, { x: 17, z: -1152, h: 11 },
  { x: -23, z: -1166, h: 4 }, { x: 18, z: -1171, h: 8 }, { x: -16, z: -1160, h: 6 },
] as const;
export const SCARF_PERCHES = PERCHES_AT.map(p => ({ ...birchesAt(p.x, p.z), h: p.h }));

/**
 * Where the strip is wound: in the world, or on the island as it was first built, in its own band-local terms. The
 * second is how the wool lay before its runs were stretched across the gaps, and every knot keeps its twist from it.
 */
interface Frame {
  at(x: number, z: number): { x: number; z: number };
  height(x: number, z: number): number;
  snags: readonly { x: number; z: number; treeX: number; kind: string }[];
  perches: readonly { x: number; z: number; h: number }[];
}
const WORLD: Frame = { at: birchesAt, height: heightAt, snags: SCARF_SNAGS, perches: SCARF_PERCHES };
const FIRST: Frame = { at: (x, z) => ({ x, z }), height: birchesFirstHeight, snags: SNAGS_AT, perches: PERCHES_AT };

/** The birch that came down years ago and has been catching the year's leaves ever since; the first length lies on it. */
export const FALLEN_LOG = { a: birchesAt(5.2, -1080.6), b: birchesAt(14.6, -1073.4) };

const ACROSS = 12;
const RING = ACROSS * 2;
const ACROSS_AT = Array.from({ length: ACROSS }, (_, a) => a / (ACROSS - 1) * 2 - 1);
const VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
out vec2 vCloth;
void main() {
  vWorld = position;
  vNormal = normal;
  vCloth = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vCloth;
uniform float uScarfLength;
uniform float uScarfStart;
void main() {
  // Split the two ends into tassels, with little irregular lengths of yarn.
  float end = min(vCloth.y - uScarfStart, uScarfLength - vCloth.y);
  float yarn = fract(vCloth.x * 17.0);
  if (end < 0.8 && (yarn > 0.67 || end < hash12(vec2(floor(vCloth.x * 17.0), 4.0)) * 0.18)) discard;
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = min(vCloth.x, 1.0 - vCloth.x);
  // Stockinette: nested V-shaped yarn loops, with broad ribs still visible when the fine fibres recede.
  vec2 stitches = vec2(vCloth.x * 18.0, vCloth.y * 11.0);
  float course = fract(stitches.y + abs(fract(stitches.x) - 0.5) * 1.25);
  float yarnHeight = exp(-pow((course - 0.5) * 3.6, 2.0));
  float aa = 1.0 - smoothstep(0.35, 1.5, max(fwidth(stitches.x), fwidth(stitches.y)));
  float ribs = cos(vCloth.x * 18.0 * 6.2831);
  float relief = yarnHeight * aa * 0.0025;
  vec3 dpdx = dFdx(vWorld), dpdy = dFdy(vWorld);
  vec3 rx = cross(dpdy, N), ry = cross(N, dpdx);
  float det = dot(dpdx, rx);
  N = normalize(N - (dFdx(relief) * rx + dFdy(relief) * ry) / (abs(det) + 0.00001) * sign(det));
  float hem = 1.0 - smoothstep(0.025, 0.085, edge);
  vec3 red = mix(vec3(0.43, 0.034, 0.049), vec3(0.36, 0.023, 0.038), hem * 0.3);
  red *= 0.97 + yarnHeight * aa * 0.035 + ribs * aa * 0.012;
  red *= 1.0 - 0.018 * smoothstep(0.3, 0.48, abs(fract(vCloth.y / 7.0) - 0.5));
  float sun = max(0.35, groundAt(vWorld.xz).w) * cloudShadow(vWorld.xz);
  float through = max(0.0, dot(-N, uSunDir)) * 0.13;
  float nap = pow(1.0 - min(abs(dot(N, V)), 1.0), 1.6);
  vec3 col = red * (hemiLight(N) * 1.25 + uGroundBounce * 0.4 + uSunColor * (max(0.0, dot(N, uSunDir)) * 0.85 + through) * sun);
  col += vec3(0.19, 0.063, 0.058) * nap * (0.45 + 0.3 * sun);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

interface Snag {
  center: THREE.Vector3;
  before: THREE.Vector3;
  work: number;
  release: number;
  freed: boolean;
  impulse: number;
  target: number;
  brushAge: number;
}
interface Section { tied: THREE.CatmullRomCurve3; loose: THREE.CatmullRomCurve3; snag: number; count: number; stretch: number }
const ground = (x: number, z: number, above: number): THREE.Vector3 => new THREE.Vector3(x, Math.max(0, heightAt(x, z)) + above, z);

/** The branch the first loop hangs on, out from its birch's fork to just past the loop: thick at `a`, thin at `b`. */
export const FORK_BRANCH = (() => {
  const s = SCARF_SNAGS[0], hook = ground(s.x, s.z, 3.5);
  return { a: new THREE.Vector3(s.treeX, hook.y - 0.4, s.treeZ), b: new THREE.Vector3(hook.x + 0.2, hook.y + 1.15, hook.z - 0.1), r0: 0.17, r1: 0.065 };
})();
const smooth = (x: number): number => THREE.MathUtils.smootherstep(x, 0, 1);

/** The strip's route through its snags and perches, wound in `frame`. */
function wind(frame: Frame): Section[] {
  const sections: Section[] = [];
  const lift = (x: number, z: number, above: number) => new THREE.Vector3(x, Math.max(0, frame.height(x, z)) + above, z);
  const at = (x: number, z: number, h: number) => lift(frame.at(x, z).x, frame.at(x, z).z, h);
  const place = { x: 0, z: 0, gap: -1, into: 0 };
  /** How much longer a run is for the gaps it crosses. */
  const stretch = (points: THREE.Vector3[]): number => {
    if (frame === FIRST) return 1;
    let world = 0, before = 0, px = 0, pz = 0;
    points.forEach((p, i) => {
      birchesLocal(p.x, p.z, place);
      if (i) { world += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z); before += Math.hypot(place.x - px, place.z - pz); }
      px = place.x; pz = place.z;
    });
    return before > 0 ? world / before : 1;
  };
  const add = (points: THREE.Vector3[], count: number, snag = -1, free = points) => {
    sections.push({ tied: new THREE.CatmullRomCurve3(points), loose: new THREE.CatmullRomCurve3(free), snag, count,
      stretch: stretch(points) });
  };
  const [a, b, d, c] = frame.snags.map(s => lift(s.x, s.z, s.kind === 'lift' ? 3.5 : 2.1));
  const local = (p: THREE.Vector3, x: number, y: number, z: number) => p.clone().add(new THREE.Vector3(x, y, z));
  const a0 = local(a, -2, -2.5, 4), a1 = local(a, 1.8, 1.5, -4);
  // Rows go evenly to the curve's spans, so the beach run is laid across the first gap in spans no longer than its own.
  const beach = [at(2,-1061,.2),at(1,-1065,.25),at(7,-1070,.4),at(3,-1077,.5)];
  const spans = Math.max(1, Math.round(beach[3].distanceTo(a0) / 8.6));
  for (let k = 1; k < spans; k++) {
    const p = beach[3].clone().lerp(a0, k / spans);
    beach.push(lift(p.x, p.z, .5));
  }
  add([...beach, a0], 80 * beach.length / 4);
  add([a0,local(a,-1,-1,1.7),local(a,.4,1.1,0),local(a,1.6,.4,-.7),local(a,.5,-1.7,-.3),local(a,-.9,-.4,.4),local(a,.2,1.2,-.1),a1], 110, 0);
  const coil = (index: number, turn: number, phase = 0): THREE.Vector3[] => {
    const tree = frame.perches[index], points: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const f = i / 10, angle = phase + f * Math.PI * 2 * turn;
      const radius = 0.9 + Math.sin(f * Math.PI) * 0.25;
      points.push(lift(tree.x + Math.cos(angle) * radius, tree.z + Math.sin(angle) * radius, tree.h - f * 0.7));
    }
    return points;
  };
  const drape = (start: THREE.Vector3, groups: THREE.Vector3[][], end: THREE.Vector3): THREE.Vector3[] => {
    const points = [start];
    for (const group of [...groups, [end]]) {
      const from = points[points.length - 1], to = group[0];
      const sag = Math.min(7, from.distanceTo(to) * .22);
      for (const t of [.25, .5, .75]) {
        const p = from.clone().lerp(to, t);
        p.y = Math.max(frame.height(p.x, p.z) + .25, p.y - sag * 4 * t * (1 - t));
        points.push(p);
      }
      points.push(...group);
    }
    return points;
  };
  const b0=local(b,2,2.2,5),b1=local(b,-1,-1,-4);
  add(drape(a1,[coil(0,.85),coil(1,-.7,Math.PI),coil(2,1.25,.5),coil(3,-.85,2),coil(4,.65)],b0),290);
  const wrap:THREE.Vector3[]=[b0];
  for(let i=0;i<=14;i++){
    const t=i/14,angle=t*Math.PI*5.2;
    const radius=1.15+Math.sin(t*Math.PI)*.6;
    wrap.push(new THREE.Vector3(frame.snags[1].treeX+Math.cos(angle)*radius,b.y+1.6-t*3.3+Math.sin(angle*1.2)*.35,b.z+Math.sin(angle)*radius));
  }
  wrap.push(b1);
  add(wrap,130,1,[b0,local(b,3,4.5,1),local(b,2,3,-2),b1]);
  const c0=local(c,-1.5,-.8,2.4),c1=local(c,2,-1.3,-2);
  // Both tails pass in front of the fallen limb so the solved loop can drop clear of its tip.
  const d0=local(d,3.5,-.6,3),d1=local(d,-3,-1.5,2);
  add(drape(b1,[coil(5,.9,1),coil(6,-.8)],d0),130);
  const collapse = (points: THREE.Vector3[], center: THREE.Vector3) => points.map((p, i) =>
    i === 0 || i === points.length - 1 ? p.clone()
      : local(center,(p.x-center.x)*.22,(p.y-center.y)*.22,(p.z-center.z)*.4));
  // A single slipped fold hangs from the limb; its right-hand loop draws through the collar.
  const slipped = [d0,local(d,-.22,.08,-.08),local(d,1.9,-.35,.45),local(d,2.1,-1.25,.65),
    local(d,.5,-1.45,.55),local(d,-.16,.12,-.25),d1];
  add(slipped,100,2,collapse(slipped,d));
  add(drape(d1,[coil(7,1.2,2),coil(8,-.65),coil(9,.9,1)],c0),130);
  // Uneven, heavy loops hang BELOW their collar, with the pale branch visible through the centre.
  const bow = [c0,local(c,-.22,.08,-.08),local(c,1.65,-.35,.45),local(c,1.8,-1.15,.65),
    local(c,.12,-.16,.38),local(c,-1.5,-.5,.6),local(c,-1.65,-1.35,.8),local(c,-.16,.12,-.25),c1];
  add(bow,110,3,collapse(bow,c));
  add([c1,at(-1,-1188,.4),at(-7,-1191,.3),at(-4,-1197,3)],60);
  return sections;
}

/** Guided unthreading hands each freed length to gravity between its real attachments. */
export class BirchScarf {
  readonly mesh: THREE.Mesh;
  readonly snags: Snag[] = SCARF_SNAGS.map(s => ({
    center: ground(s.x, s.z, s.kind === 'lift' ? 3.5 : 2.1), before: ground(s.stopX, s.stopZ, 0),
    work: 0, release: 0, freed: false, impulse: 0, target: 0, brushAge: Infinity,
  }));
  active = -1;
  /** Circling at the visible wrap stands the player's real updraft at the trunk. */
  get updraftTarget(): THREE.Vector3 | null {
    const snag = this.snags[this.active];
    return SCARF_SNAGS[this.active]?.kind === 'unwind' && snag && !snag.freed && snag.target < 1 ? snag.center : null;
  }
  woven = 0;
  private gathering = 0;
  private readonly sections: Section[] = [];
  private readonly tied: THREE.Vector3[] = [];
  private readonly loose: THREE.Vector3[] = [];
  private readonly centre: THREE.Vector3[] = [];
  private readonly winds: THREE.Vector3[] = [];
  private readonly velocities: THREE.Vector3[] = [];
  private readonly owner: number[] = [];
  private readonly pins: number[] = [];
  private readonly heights: number[] = [];
  private readonly lengths: number[] = [];
  /** Along the wool as it was first wound: a run grown across a gap counts as long as it was, so every knot keeps its twist. */
  private readonly wound: number[] = [];
  private readonly firstRows: THREE.Vector3[] = [];
  private readonly ownerStart: number[];
  /** Rows along the strip: as fine as when it was first wound, however long the runs between the trees have grown. */
  readonly rows: number;
  private readonly rollBase: Float64Array;
  /** Each row's frame as authored, so a moved row turns its surface locally instead of re-twisting the whole strip. */
  private readonly restTangent: Float64Array;
  private readonly restSide: Float64Array;
  private readonly restAcross: Float64Array;
  private readonly frameTangent: Float64Array;
  private readonly frameSide: Float64Array;
  private readonly windTarget: Float64Array;
  private readonly windSum: Float64Array;
  private readonly gust: Float64Array;
  private readonly bunched: Float64Array;
  private readonly folds: Float64Array;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly point = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly air = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly projected = new THREE.Vector3();
  private readonly boatEnd = new THREE.Vector3(birchesAt(-4, -1197).x, 3, birchesAt(-4, -1197).z);
  private elapsed = 0;
  private readonly firstCloth: ScarfCloth;
  private readonly firstEnd: number;
  private readonly clothAcross: THREE.Vector3[] = [];
  private readonly releasedCloth = new Map<number, { start: number; end: number; cloth: ScarfCloth; distances: number[] }>();
  private readonly collisions: ClothCapsule[] = [];
  private readonly physical: Uint8Array;
  private restoring = false;
  private drawnIn = false;
  readonly stump = { x: SCARF_SNAGS[1].treeX, z: SCARF_SNAGS[1].treeZ, height: 4.1, radius: .47 };
  /** The slipped loop catches on an upturned splinter of a fallen birch, clear of the walking sightline. */
  readonly slipBranch: ClothCapsule[] = (() => {
    const c = this.snags[2].center;
    const points = [ground(c.x + .8, c.z - 1.2, .3),
      c.clone().add(new THREE.Vector3(.6, -.9, -.7)),
      c.clone().add(new THREE.Vector3(.25, -.3, -.3)),
      c.clone().add(new THREE.Vector3(-.12, .12, -.15))];
    return points.slice(1).map((b, i) => ({ a: points[i], b, radius: [.25, .18, .12][i] }));
  })();
  /** A heavy, tapering trunk lies along the slope behind the loop, not across the child's path. */
  readonly slipLog: ClothCapsule[] = (() => {
    const c = this.snags[2].center;
    const points = Array.from({ length: 5 }, (_, i) => ground(c.x + .8 + i * 1.9, c.z - 1.2 - i * .85, .23));
    return points.slice(1).map((b, i) => ({ a: points[i], b, radius: .43 - i * .065 }));
  })();
  /** The final bow stays on a standing birch's low limb. Render and collision share the endpoints. */
  readonly bowBranch = this.supportBranch();

  private supportBranch(): ClothCapsule[] {
    const s = SCARF_SNAGS[3], c = this.snags[3].center;
    const elbow = c.clone().add(new THREE.Vector3(-.5, -.35, -.18));
    return [
      { a: new THREE.Vector3(s.treeX, c.y + .65, s.treeZ), b: elbow, radius: .18 },
      { a: elbow, b: c.clone().add(new THREE.Vector3(.65, .25, -.15)), radius: .12 },
    ];
  }

  constructor() {
    this.sections.push(...wind(WORLD));
    const rows = this.rows = this.sections.reduce((sum, s) => sum + s.count, 0);
    this.rollBase = new Float64Array(rows);
    this.restTangent = new Float64Array(rows * 3);
    this.restSide = new Float64Array(rows * 3);
    this.restAcross = new Float64Array(rows * 3);
    this.frameTangent = new Float64Array(rows * 3);
    this.frameSide = new Float64Array(rows * 3);
    this.windTarget = new Float64Array(rows * 3);
    this.windSum = new Float64Array((rows + 1) * 3);
    this.gust = new Float64Array(rows);
    this.bunched = new Float64Array(rows);
    this.folds = new Float64Array(rows * ACROSS);
    this.positions = new Float32Array(rows * RING * 3);
    this.normals = new Float32Array(rows * RING * 3);
    this.physical = new Uint8Array(rows);
    for (const section of this.sections) {
      for (let j = 0; j < section.count; j++) {
        const u = j / section.count;
        const a = section.tied.getPoint(u), b = section.loose.getPoint(u);
        this.tied.push(a); this.loose.push(b); this.centre.push(a.clone());
        this.winds.push(new THREE.Vector3()); this.velocities.push(new THREE.Vector3()); this.owner.push(section.snag);
        const trunkGap = Math.min(...SCARF_PERCHES.map(t => Math.hypot(t.x - a.x, t.z - a.z)));
        this.pins.push(Math.sin(Math.PI * u) ** 0.7 * THREE.MathUtils.smoothstep(trunkGap, 1, 3));
        this.heights.push(Math.max(0, heightAt(a.x, a.z)));
      }
    }
    let length = 0;
    this.tied.forEach((p, i) => { if (i) length += p.distanceTo(this.tied[i - 1]); this.lengths.push(length); });
    const first = wind(FIRST), was: number[] = [];
    for (const section of first) for (let j = 0; j < section.count; j++) this.firstRows.push(section.tied.getPoint(j / section.count));
    let wool = 0;
    this.firstRows.forEach((p, j) => { if (j) wool += p.distanceTo(this.firstRows[j - 1]); was.push(wool); });
    let row = 0, then = 0;
    this.sections.forEach((section, s) => {
      const span = (this.lengths[row + section.count] ?? length) - this.lengths[row];
      const spanThen = (was[then + first[s].count] ?? wool) - was[then];
      for (let i = row; i < row + section.count; i++) {
        this.wound.push(section.count === first[s].count ? was[then + i - row] : was[then] + (this.lengths[i] - this.lengths[row]) * spanThen / span);
      }
      row += section.count;
      then += first[s].count;
    });
    const carried = this.carry(first);
    this.ownerStart = [0, 1, 2, 3].map(owner => this.owner.indexOf(owner));
    for (let i = 0; i < this.rows; i++) {
      const length = this.wound[i];
      this.rollBase[i] = length * .13 + Math.sin(length * .31) * .75 + Math.sin(length * .83) * .23;
      const rumple = .5 + .5 * Math.sin(length * .57 + Math.sin(length * .2));
      this.bunched[i] = .66 + .34 * (1 - rumple);
      for (let a = 0; a < ACROSS; a++) {
        const across = ACROSS_AT[a];
        // Deep, uneven lengthwise folds and softly rolled hems give the yarn a substantial silhouette.
        this.folds[i * ACROSS + a] = Math.sin(across * Math.PI * 1.6 + length * .24) * (.09 + rumple * .1)
          + Math.pow(Math.abs(across), 5) * .13 * Math.sin(length * .42 + .5)
          + Math.sin(length * 2.1 + across * 2.4) * .025;
      }
    }
    for (let i = 0; i < this.rows; i++) {
      this.tangent.subVectors(this.tied[Math.min(this.rows - 1, i + 1)], this.tied[Math.max(0, i - 1)]).normalize();
      this.side.copy(carried[i]).applyAxisAngle(this.tangent, this.rollBase[i]);
      this.tangent.toArray(this.restTangent, i * 3); this.side.toArray(this.restSide, i * 3);
      this.side.set(-this.tangent.z, 0, this.tangent.x);
      if (this.side.lengthSq() < 1e-6) this.side.set(1, 0, 0);
      this.side.normalize().toArray(this.restAcross, i * 3);
    }
    const perch = SCARF_PERCHES[0];
    const knotStart = this.owner.indexOf(0), knotEnd = this.owner.lastIndexOf(0) + 1;
    this.firstEnd = this.tied.findIndex((p, i) => i >= knotEnd && Math.hypot(p.x - perch.x, p.z - perch.z) < 1.05);
    if (this.firstEnd < 0) throw new Error('The first scarf length needs an attachment on its next tree');
    const clothPoints: THREE.Vector3[] = [], woundAt: number[] = [];
    const endDistance = this.lengths[this.firstEnd];
    const count = Math.ceil(endDistance / .45);
    let source = 0;
    for (let row = 0; row <= count; row++) {
      const distance = endDistance * row / count;
      while (source + 1 < this.firstEnd && this.lengths[source + 1] < distance) source++;
      const t = (distance - this.lengths[source]) / (this.lengths[source + 1] - this.lengths[source]);
      clothPoints.push(this.tied[source].clone().lerp(this.tied[source + 1], t));
      woundAt.push(this.wound[source] + (this.wound[source + 1] - this.wound[source]) * t);
    }
    // Laid across as first wound, so however long the beach run has grown, the length meets its tree turned as it was.
    const across = clothPoints.map((_, i) => {
      const along = new THREE.Vector3().subVectors(clothPoints[Math.min(i + 1, count)], clothPoints[Math.max(0, i - 1)]).normalize();
      const side = new THREE.Vector3(-along.z, 0, along.x).normalize();
      if (side.lengthSq() < .1) side.set(1, 0, 0);
      return side.applyAxisAngle(along, Math.sin(woundAt[i] * .23) * .65);
    });
    const hook = this.snags[0].center.clone().add(new THREE.Vector3(.2, 1.15, -.1));
    const closestHook = (from: number, to: number): number => {
      let best = from;
      for (let i = from; i <= to; i++) if (this.tied[i].distanceToSquared(hook) < this.tied[best].distanceToSquared(hook)) best = i;
      return Math.round(this.lengths[best] / endDistance * count);
    };
    this.firstCloth = new ScarfCloth(clothPoints, tuning.birches.scarf.width * .85,
      [closestHook(knotStart + 12, knotStart + 60), closestHook(knotEnd - 40, knotEnd - 7)],
      [count], (x, z) => Math.max(0, heightAt(x, z)), across);
    this.firstCloth.setSupportRail(hook.clone().add(new THREE.Vector3(1.0, -.4, -.23)), hook);
    for (let i = 0; i < this.rows; i++) this.clothAcross.push(new THREE.Vector3());
    const uv = new Float32Array(this.rows * RING * 2);
    const indices: number[] = [];
    for (let i = 0; i < this.rows; i++) for (let j = 0; j < RING; j++) {
      const k = i * RING + j, next = i * RING + (j + 1) % RING;
      uv[k * 2] = (j < ACROSS ? j : RING - 1 - j) / (ACROSS - 1);
      uv[k * 2 + 1] = this.wound[i];
      if (i < this.rows - 1) indices.push(k, k + RING, next, next, k + RING, next + RING);
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setIndex(indices);
    this.mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uScarfLength: { value: wool }, uScarfStart: { value: 0 } }, side: THREE.DoubleSide }));
    this.mesh.name = 'impossibly-long-red-scarf';
    this.mesh.frustumCulled = false;
    this.write();
  }

  /**
   * The strip's side carried along it, row by row. A run grown across a gap would bring the wool to the next knot
   * turned some other way, so every knot takes its turn from the strip as first wound and each grown run turns
   * gradually to meet it.
   */
  private carry(first: Section[]): THREE.Vector3[] {
    const along = new THREE.Vector3(), side = new THREE.Vector3(1, 0, 0);
    const tangent = (rows: THREE.Vector3[], i: number): THREE.Vector3 =>
      along.subVectors(rows[Math.min(rows.length - 1, i + 1)], rows[Math.max(0, i - 1)]).normalize();
    const wound = this.firstRows.map((_, j) => side.addScaledVector(tangent(this.firstRows, j), -side.dot(along)).normalize().clone());
    const carried: THREE.Vector3[] = [];
    let row = 0, then = 0;
    this.sections.forEach((section, s) => {
      if (section.stretch === 1) {
        for (let k = 0; k < section.count; k++) carried.push(wound[then + k].clone());
      } else {
        side.copy(carried[row - 1] ?? wound[0]);
        for (let k = 0; k < section.count; k++) carried.push(side.addScaledVector(tangent(this.tied, row + k), -side.dot(along)).normalize().clone());
        const next = wound[then + first[s].count];
        if (next) {
          const at = tangent(this.tied, row + section.count).clone();
          const arrived = side.clone().addScaledVector(at, -side.dot(at)).normalize(), meet = next.clone().addScaledVector(at, -next.dot(at)).normalize();
          const turn = Math.atan2(arrived.clone().cross(meet).dot(at), arrived.dot(meet));
          for (let k = 0; k < section.count; k++) carried[row + k].applyAxisAngle(tangent(this.tied, row + k), turn * (k + 1) / (section.count + 1));
        }
      }
      row += section.count;
      then += first[s].count;
    });
    return carried;
  }

  /** Whether the wool, as it lay on the island first built, passes near a band-local point. */
  woundNear(x: number, z: number): boolean {
    return this.firstRows.some(p => Math.hypot(p.x - x, p.z - z) < 1.6);
  }

  get completed(): number { return this.snags.filter(s => s.freed).length; }
  get finished(): boolean { return this.woven >= 1; }
  get focus(): THREE.Vector3 | null { return this.snags[this.active]?.center ?? null; }

  /** Keep incidental trunks out of the cloth; its supporting trees are placed deliberately. */
  crosses(x: number, z: number): boolean {
    return this.tied.some(p => Math.hypot(p.x - x, p.z - z) < 1.6);
  }

  restore(count: number): void {
    this.snags.forEach((s, i) => { s.freed = i < count; s.target = s.work = s.release = s.freed ? 1 : 0; s.brushAge = Infinity; });
    this.gathering = count >= this.snags.length ? tuning.birches.scarf.gatherSeconds : 0;
    this.woven = count >= this.snags.length ? 1 : 0;
    this.firstCloth.reset(count > 0);
    this.firstCloth.gripping = false;
    if (count === 0) for (let i = 0; i < 180; i++) this.firstCloth.update(1 / 60);
    this.releasedCloth.clear(); this.restoring = count > 0;
    // A saved release restores settled cloth, not a second falling animation or a floating loop.
    if (count > 0 && count < this.snags.length) for (let i = 0; i < 360; i++) this.firstCloth.update(1 / 60);
    this.firstCloth.gripping = true;
  }

  setTrees(trees: { x: number; y: number; z: number; scale: number }[], settle = true): void {
    this.collisions.splice(0, this.collisions.length, ...trees.map(t => ({
      a: new THREE.Vector3(t.x, t.y, t.z), b: new THREE.Vector3(t.x, t.y + t.scale * .85, t.z), radius: .42,
    })), { a: ground(this.stump.x, this.stump.z, 0), b: ground(this.stump.x, this.stump.z, this.stump.height), radius: this.stump.radius },
    ...this.slipLog, ...this.slipBranch, ...this.bowBranch);
    // The trees about the first length, from the beach to a little past its perch.
    const capsules: ClothCapsule[] = trees.filter(t => t.z > SCARF_PERCHES[0].z - 5 && t.z < birchesZ(-1055) && t.x > X(-5) && t.x < X(26)).map(t => ({
      a: new THREE.Vector3(t.x, t.y, t.z), b: new THREE.Vector3(t.x, t.y + t.scale * .85, t.z), radius: .42,
    }));
    capsules.push({ a: FORK_BRANCH.a.clone(), b: FORK_BRANCH.b.clone(), radius: FORK_BRANCH.r0 });
    capsules.push({ a: ground(FALLEN_LOG.a.x, FALLEN_LOG.a.z, .16), b: ground(FALLEN_LOG.b.x, FALLEN_LOG.b.z, .16), radius: .3 });
    this.firstCloth.capsules = capsules;
    if (settle) for (const _ of this.settle()) { /* Synchronous callers keep their original preparation. */ }
  }

  /** Same fixed cloth steps, yielding the share done, so startup can give the veil a paint between batches. */
  *settle(): Generator<number> {
    this.firstCloth.gripping = false;
    for (let i = 1; i <= 180; i++) { this.firstCloth.update(1 / 60); yield i / 180; }
    this.firstCloth.gripping = true;
  }

  /** Stroke the cloth the player sees, rather than the ground beyond it under a low camera. */
  brush(camera: THREE.Camera, input: PointerInput, wind: WindField, dt: number): void {
    const snag = this.snags[this.active];
    const k = tuning.birches.scarf;
    if (!snag || snag.freed || input.muted || !input.present || input.gust < k.brushSpeed) return;
    const aspect = (camera as THREE.PerspectiveCamera).aspect;
    const dx = (input.ndc.x - input.prevNdc.x) * aspect, dy = input.ndc.y - input.prevNdc.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.0001) return;
    let touch = 0;
    for (const offset of [-1.8, 0, 1.8]) {
      this.point.copy(snag.center); this.point.x += offset;
      touch = Math.max(touch, screenBrush(camera, this.point, input.prevNdc, input.ndc, k.brushRadius));
    }
    if (touch < 0.01) return;
    this.projected.copy(snag.center).project(camera);
    const kind = SCARF_SNAGS[this.active].kind;
    // Lift, circle, draw the slipped fold rightward, then pull either bow tail outward.
    const direction = kind === 'lift' ? dy / length : kind === 'unwind' ? 1 : kind === 'pull' ? dx / length : dx / length * Math.sign(input.ndc.x - this.projected.x || dx);
    const pull = Math.max(0, direction) * Math.sqrt(touch) * Math.min(1, input.gust / 8);
    let travel = Math.max(0, direction) * length / (kind === 'bow' ? k.bowDistance : kind === 'pull' ? k.slipDistance : k.strokeDistance);
    if (kind === 'unwind') {
      const ax = (input.prevNdc.x - this.projected.x) * aspect, ay = input.prevNdc.y - this.projected.y;
      const bx = (input.ndc.x - this.projected.x) * aspect, by = input.ndc.y - this.projected.y;
      const radius = Math.hypot(bx, by);
      const turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
      // A stroke across the centre can jump half a turn. Only continuous circling with real updraft charge lifts the wrap.
      travel = radius > .035 && radius < .55 && turn < .65
        ? turn / k.circleDistance * THREE.MathUtils.smoothstep(input.charge, k.circleChargeFrom, k.circleChargeFull) : 0;
    }
    snag.target = Math.min(1, snag.target + Math.min(.18, travel) * Math.sqrt(touch));
    if (travel > 0) snag.brushAge = 0;
    snag.impulse = Math.min(1, snag.impulse + (kind === 'lift' ? pull : Math.sqrt(touch)) * dt * 5);
    wind.addSplat({ source: this, ax: snag.center.x, az: snag.center.z, bx: snag.center.x, bz: snag.center.z,
      vx: input.gustDir.x * input.gust, vz: input.gustDir.y * input.gust,
      radius: 3.5, energy: Math.min(0.6, input.gust / 25), lift: kind === 'lift' ? pull * 0.5 : 0, swirl: 0 });
  }

  update(dt: number, wind: WindField, boatMast?: THREE.Vector3): void {
    if (this.finished) { this.mesh.visible = false; return; }
    this.elapsed += dt;
    if (boatMast) this.boatEnd.copy(boatMast);
    const k = tuning.birches.scarf;
    for (const s of this.snags) {
      s.brushAge += dt;
      // Gesture distance drives the goal; the cloth eases continuously between input events.
      s.target = Math.max(s.target, s.work);
      s.work += (s.target - s.work) * (1 - Math.exp(-dt * k.gestureResponse));
      if (s.target === 1 && s.work > .995) s.work = 1;
      s.impulse *= Math.exp(-dt * 3);
      if (s.work >= 1) {
        s.release = Math.min(1, s.release + dt / k.releaseSeconds);
        if (s.release >= 1) s.freed = true;
      }
    }
    if (this.completed === this.snags.length) this.gathering = Math.min(k.gatherSeconds, this.gathering + dt);
    this.woven = smooth(Math.max(0, this.gathering / k.gatherSeconds - 0.45) / 0.55);
    this.mesh.visible = this.woven < 1;
    const step = Math.min(dt, .05);
    const spring = k.windResponse * k.windResponse * step, damping = Math.exp(-2 * k.windDamping * k.windResponse * step);
    const top = Math.max(0, heightAt(this.stump.x, this.stump.z)) + this.stump.height;
    const { windTarget, windSum, gust } = this;
    for (let i = this.firstEnd + 1; i < this.rows; i++) {
      const s = this.snags[this.owner[i]];
      const supported = this.owner[i] === 2 || this.owner[i] === 3;
      const loose = s && this.owner[i] !== 1 ? smooth(supported ? s.work / .7 : s.work) : 0;
      const p = this.centre[i].lerpVectors(this.tied[i], this.loose[i], loose);
      const w = wind.sample(p.x, p.z, this.air);
      windTarget[i * 3] = w.x; windTarget[i * 3 + 1] = w.lift; windTarget[i * 3 + 2] = w.z;
    }
    // A heavy length answers the air over its whole span, not each breath at each stitch.
    const reach = k.windSpan;
    for (let i = 0; i < this.rows * 3; i++) windSum[i + 3] = windSum[i] + windTarget[i];
    for (let i = this.firstEnd + 1; i < this.rows; i++) {
      const lo = Math.max(this.firstEnd + 1, i - reach), hi = Math.min(this.rows - 1, i + reach), n = hi - lo + 1;
      const x = (windSum[hi * 3 + 3] - windSum[lo * 3]) / n, lift = (windSum[hi * 3 + 4] - windSum[lo * 3 + 1]) / n;
      const z = (windSum[hi * 3 + 5] - windSum[lo * 3 + 2]) / n;
      gust[i] = Math.hypot(x, z);
      this.point.set(x * 0.028, lift * 0.12, z * 0.028).clampLength(0, 0.7);
      this.velocities[i].addScaledVector(this.point.sub(this.winds[i]), spring).multiplyScalar(damping);
      this.winds[i].addScaledVector(this.velocities[i], step);
    }
    for (let i = this.firstEnd + 1; i < this.rows; i++) {
      const s = this.snags[this.owner[i]];
      const supported = this.owner[i] === 2 || this.owner[i] === 3;
      const p = this.centre[i];
      // The collar stays on the wood while the loops draw through it; only its hanging lengths move.
      const contact = supported ? THREE.MathUtils.smoothstep(p.distanceTo(s.center), .45, 1.3) : 1;
      const f = this.pins[i] * THREE.MathUtils.smoothstep(p.y - this.heights[i], 0.1, 0.8) * contact;
      p.addScaledVector(this.winds[i], f);
      // Slow, nearly in step along each span: the swing of a heavy length, never a ripple running down the strip.
      const length = this.wound[i];
      const sway = k.sway * f * (.4 + Math.min(1, gust[i] / 4))
        * (Math.sin(this.elapsed * .62 + length * .021) * .7 + Math.sin(this.elapsed * 1.07 + 1.3 + length * .047) * .3);
      p.x += this.restAcross[i * 3] * sway; p.z += this.restAcross[i * 3 + 2] * sway;
      p.y -= Math.abs(sway) * .3;
      if (s && s.release < 1) p.y += s.work * f * 0.45;
      p.y = Math.max(this.heights[i] + 0.09, p.y);
      if (supported) {
        const u = (i - this.ownerStart[this.owner[i]]) / (this.owner[i] === 2 ? 100 : 110);
        const attachment = smooth(Math.min(u / .16, (1 - u) / .16));
        // Draw the collapsed loop beyond the broken tip before gravity takes its weight.
        const slip = smooth((s.work - .7) / .3);
        p.x += slip * 1.65 * attachment;
        p.z += slip * .8 * attachment;
        p.y -= smooth((s.work - .9) / .1) * .9 * attachment;
      }
      if (this.owner[i] === 1) {
        // The closed coils keep their winding around the wood until ALL of them clear its broken top.
        const u = (i - this.ownerStart[1]) / 130;
        const attachment = smooth(Math.min(u / .065, (1 - u) / .065));
        // The top coils climb first and loosen as they rise, then slide off one after another: an unwinding, not a lid.
        const lift = smooth((s.work - u * .2) / .58), slip = smooth((s.work - .78 - u * .08) / .14);
        const loosen = 1 + .28 * lift * attachment;
        p.x = this.stump.x + (p.x - this.stump.x) * loosen; p.z = this.stump.z + (p.z - this.stump.z) * loosen;
        p.y = THREE.MathUtils.lerp(p.y, top + .85 + (p.y - this.snags[1].center.y) * .34, lift * attachment);
        p.x += slip * 3.4 * attachment;
        const dx = p.x - this.stump.x, dz = p.z - this.stump.z, radius = Math.hypot(dx, dz);
        if (p.y < top + .65 && radius < 1.15) {
          const angle = radius > .001 ? Math.atan2(dz, dx) : u * Math.PI * 5.2;
          p.x = this.stump.x + Math.cos(angle) * 1.15;
          p.z = this.stump.z + Math.sin(angle) * 1.15;
        }
      }
    }
    this.physical.fill(0);
    for (let index = 1; index < this.snags.length; index++) {
      if (this.snags[index].work < 1) continue;
      if (!this.releasedCloth.has(index)) this.releaseSpan(index);
      const span = this.releasedCloth.get(index)!;
      if (this.restoring) {
        span.cloth.gripping = false;
        for (let frame = 0; frame < 300; frame++) span.cloth.update(1 / 60);
        span.cloth.gripping = true;
      }
      span.cloth.update(dt, wind);
      for (let i = span.start; i <= span.end; i++) {
        span.cloth.sample(span.distances[i - span.start], this.centre[i], this.clothAcross[i]);
        this.physical[i] = 1;
      }
    }
    this.restoring = false;
    this.firstCloth.setPull(this.snags[0].work, this.snags[0].impulse);
    if (this.snags[0].work >= 1) this.firstCloth.release();
    this.firstCloth.update(dt, wind);
    for (let i = 0; i <= this.firstEnd; i++) {
      this.physical[i] = 1;
      this.firstCloth.sample(this.lengths[i] / this.lengths[this.firstEnd] * this.firstCloth.length,
        this.centre[i], this.clothAcross[i]);
    }
    // The final loose end is physically attached to the mast, including its shoreward lean.
    for (let i = this.rows - 20; i < this.rows; i++) {
      this.centre[i].lerp(this.boatEnd, smooth((i - this.rows + 20) / 19));
    }
    this.write();
  }

  /** Capture the actual released shape; gravity takes over without a second animated destination. */
  private releaseSpan(index: number): void {
    const knotStart = this.owner.indexOf(index), knotEnd = this.owner.lastIndexOf(index);
    const previous = SCARF_PERCHES[[0, 4, 6, 9][index]], next = SCARF_PERCHES[index === 1 ? 5 : 7];
    let start = knotStart - 1, end = index === this.snags.length - 1 ? this.rows - 1 : knotEnd + 1;
    for (let i = knotStart - 1; i > this.firstEnd; i--) {
      if (Math.hypot(this.tied[i].x - previous.x, this.tied[i].z - previous.z) < 1.05) { start = i; break; }
    }
    if (index < this.snags.length - 1) for (let i = knotEnd + 1; i < this.rows; i++) {
      if (Math.hypot(this.tied[i].x - next.x, this.tied[i].z - next.z) < 1.05) { end = i; break; }
    }
    const distances = [0];
    for (let i = start + 1; i <= end; i++) distances.push(distances[i - start - 1] + this.centre[i].distanceTo(this.centre[i - 1]));
    const length = distances[distances.length - 1], count = Math.ceil(length / .35);
    const points: THREE.Vector3[] = [], across: THREE.Vector3[] = [];
    let source = 0;
    for (let row = 0; row <= count; row++) {
      const distance = length * row / count;
      while (source + 1 < distances.length - 1 && distances[source + 1] < distance) source++;
      const t = (distance - distances[source]) / Math.max(.0001, distances[source + 1] - distances[source]), a = (start + source) * 3;
      points.push(this.centre[start + source].clone().lerp(this.centre[start + source + 1], t));
      across.push(new THREE.Vector3().fromArray(this.frameSide, a).lerp(this.point.fromArray(this.frameSide, a + 3), t));
    }
    const cloth = new ScarfCloth(points, tuning.birches.scarf.width * .85, [], [0, count], (x, z) => Math.max(0, heightAt(x, z)), across);
    cloth.capsules = this.collisions.filter(c => points.some(p => Math.hypot(p.x - c.a.x, p.z - c.a.z) < 8));
    cloth.release();
    this.releasedCloth.set(index, { start, end, cloth, distances });
  }


  private write(): void {
    const width = tuning.birches.scarf.width;
    const taper = 1 - this.woven * 0.75;
    const thickness = .025 * width;
    const { centre, frameTangent, frameSide, restTangent, restSide } = this;
    for (let i = 0; i < this.rows; i++) {
      const o = i * 3, a = centre[Math.max(0, i - 1)], b = centre[Math.min(this.rows - 1, i + 1)];
      const rx = restTangent[o], ry = restTangent[o + 1], rz = restTangent[o + 2];
      let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z, length = Math.hypot(tx, ty, tz);
      if (length < 1e-4) { tx = rx; ty = ry; tz = rz; length = 1; }
      tx /= length; ty /= length; tz /= length;
      // Turn the authored frame by the least rotation onto this row's tangent: nothing is carried from row to row.
      let sx = restSide[o], sy = restSide[o + 1], sz = restSide[o + 2];
      const c = rx * tx + ry * ty + rz * tz;
      if (c > -.999) {
        const kx = ry * tz - rz * ty, ky = rz * tx - rx * tz, kz = rx * ty - ry * tx;
        const f = (kx * sx + ky * sy + kz * sz) / (1 + c);
        const cx = ky * sz - kz * sy, cy = kz * sx - kx * sz, cz = kx * sy - ky * sx;
        sx = sx * c + cx + kx * f; sy = sy * c + cy + ky * f; sz = sz * c + cz + kz * f;
      }
      let d = sx * tx + sy * ty + sz * tz;
      sx -= tx * d; sy -= ty * d; sz -= tz * d;
      const across = this.clothAcross[i];
      if (this.physical[i] === 1 && across.lengthSq() > .1) {
        // Where a fold lays the cloth's width along its length, its own across is noise: lean on the authored frame.
        d = across.x * tx + across.y * ty + across.z * tz;
        const held = THREE.MathUtils.smoothstep(Math.sqrt(Math.max(0, 1 - d * d)), .25, .6);
        const ax = across.x - tx * d, ay = across.y - ty * d, az = across.z - tz * d, al = Math.hypot(ax, ay, az);
        if (held > 0 && al > 1e-4) {
          const sl = Math.hypot(sx, sy, sz) || 1, keep = (1 - held) * Math.sign(ax * sx + ay * sy + az * sz || 1) / sl;
          sx = sx * keep + ax / al * held; sy = sy * keep + ay / al * held; sz = sz * keep + az / al * held;
        }
      }
      const sl = Math.hypot(sx, sy, sz) || 1;
      frameTangent[o] = tx; frameTangent[o + 1] = ty; frameTangent[o + 2] = tz;
      frameSide[o] = sx / sl; frameSide[o + 1] = sy / sl; frameSide[o + 2] = sz / sl;
    }
    const k = tuning.birches.scarf;
    // Drawn in, the strip keeps to the path it lay along and only its free end runs home, so no row ever jumps.
    const drawn = this.gathering > 0 ? smooth(this.gathering / k.gatherSeconds) : 0;
    const uv = this.geometry.attributes.uv as THREE.BufferAttribute;
    if (drawn === 0 && this.drawnIn) {
      for (let i = 0; i < this.rows; i++) for (let j = 0; j < RING; j++) uv.array[(i * RING + j) * 2 + 1] = this.wound[i];
      (this.mesh.material as THREE.ShaderMaterial).uniforms.uScarfStart.value = 0;
      uv.needsUpdate = true;
    }
    this.drawnIn = drawn > 0;
    for (let i = 0; i < this.rows; i++) {
      let p = centre[i];
      let bunched = this.bunched[i], fold = i * ACROSS, foldNext = fold, foldMix = 0;
      let physical = this.physical[i], rowHeight = this.heights[i];
      if (drawn > 0) {
        const at = i + drawn * (this.rows - 1 - i), lo = Math.min(this.rows - 1, Math.floor(at)), hi = Math.min(this.rows - 1, lo + 1), t = at - lo;
        p = this.point.lerpVectors(centre[lo], centre[hi], t);
        this.tangent.set(frameTangent[lo * 3] * (1 - t) + frameTangent[hi * 3] * t, frameTangent[lo * 3 + 1] * (1 - t) + frameTangent[hi * 3 + 1] * t,
          frameTangent[lo * 3 + 2] * (1 - t) + frameTangent[hi * 3 + 2] * t).normalize();
        this.side.set(frameSide[lo * 3] * (1 - t) + frameSide[hi * 3] * t, frameSide[lo * 3 + 1] * (1 - t) + frameSide[hi * 3 + 1] * t,
          frameSide[lo * 3 + 2] * (1 - t) + frameSide[hi * 3 + 2] * t);
        this.side.addScaledVector(this.tangent, -this.side.dot(this.tangent)).normalize();
        bunched = this.bunched[lo] * (1 - t) + this.bunched[hi] * t;
        fold = lo * ACROSS; foldNext = hi * ACROSS; foldMix = t;
        // Rows take on the ground contact of the place they pass through, blended so none snaps.
        physical = this.physical[lo] * (1 - t) + this.physical[hi] * t;
        rowHeight = this.heights[lo] * (1 - t) + this.heights[hi] * t;
        const v = this.wound[lo] * (1 - t) + this.wound[hi] * t;
        for (let j = 0; j < RING; j++) uv.array[(i * RING + j) * 2 + 1] = v;
        if (i === 0) (this.mesh.material as THREE.ShaderMaterial).uniforms.uScarfStart.value = v;
      } else {
        this.tangent.fromArray(frameTangent, i * 3); this.side.fromArray(frameSide, i * 3);
      }
      this.normal.crossVectors(this.tangent, this.side).normalize();
      const floor = physical > 0 ? THREE.MathUtils.lerp(rowHeight, Math.max(0, heightAt(p.x, p.z)), physical) : rowHeight;
      const foldRoom = THREE.MathUtils.smoothstep(p.y - floor, .1, .5);
      // The broad hem must wrap around the support too, rather than cut through it as the bow tightens.
      const limbs = physical > 0 || drawn > 0 ? null : this.owner[i] === 2 ? this.slipBranch : this.owner[i] === 3 ? this.bowBranch : null;
      for (let a = 0; a < ACROSS; a++) {
        const out = ACROSS_AT[a] * width * .5 * bunched * taper;
        const folded = (this.folds[fold + a] * (1 - foldMix) + this.folds[foldNext + a] * foldMix) * width * foldRoom;
        for (let back = 0; back < 2; back++) {
          const vertex = (i * RING + (back ? RING - 1 - a : a)) * 3;
          const q = this.projected.copy(p).addScaledVector(this.side, out)
            .addScaledVector(this.normal, (folded + (back ? -thickness : thickness)) * taper);
          if (limbs) for (const limb of limbs) {
            const ax = limb.b.x - limb.a.x, ay = limb.b.y - limb.a.y, az = limb.b.z - limb.a.z;
            const t = THREE.MathUtils.clamp(((q.x - limb.a.x) * ax + (q.y - limb.a.y) * ay
              + (q.z - limb.a.z) * az) / (ax * ax + ay * ay + az * az), 0, 1);
            const x = limb.a.x + ax * t, y = limb.a.y + ay * t, z = limb.a.z + az * t;
            const dx = q.x - x, dy = q.y - y, dz = q.z - z, radius = limb.radius + .035;
            // Clearly outside: the margin dwarfs any rounding in the exact distance, which only nearer points need.
            if (dx * dx + dy * dy + dz * dz > radius * radius * 1.000001) continue;
            const distance = Math.hypot(dx, dy, dz);
            if (distance < radius) {
              if (distance < .00001) q.set(x, y + radius, z);
              else q.set(x + dx / distance * radius, y + dy / distance * radius, z + dz / distance * radius);
            }
          }
          if (physical > 0) q.y += Math.max(0, Math.max(0, heightAt(q.x, q.z)) + .035 - q.y) * physical;
          this.positions[vertex] = q.x; this.positions[vertex + 1] = q.y; this.positions[vertex + 2] = q.z;
        }
      }
    }
    if (drawn > 0) uv.needsUpdate = true;
    this.geometry.attributes.position.needsUpdate = true;
    // Lighting must follow each fold, including the back and the thick hem, not just the centreline.
    indexedNormals(this.positions, this.normals, this.geometry.index!.array);
    this.geometry.attributes.normal.needsUpdate = true;
  }
}

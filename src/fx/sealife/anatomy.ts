import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { flipWinding } from '../../creatures/shapes';
import { smoothstep } from '../../world/noise';
import { curve } from './curve';

/** Snout to the notch of the flukes, in world units. */
export const LENGTH = 14;
/** The rig's spine runs on past the notch, through the flukes, to this fraction of the length. */
export const SPINE_END = 1.08;
export const BODY = 0;
export const FIN = 1;
export const FLUKES = 2;
export const DORSAL = 3;
export const FLUKE_HALF_SPAN = 2.75;
/** Root of the left pectoral fin (the right one is its mirror image): high on the flank, so lying awash it is at the surface. */
export const FIN_ROOT = new THREE.Vector3(1.45, -0.06, -0.31 * LENGTH);
/** The flipper's length and its line out from the root at rest, before it is raised and swept, in its own units. */
export const FIN_SPAN = 4.5;
export const FIN_DIR = new THREE.Vector3(0.8, -0.3, -0.52).normalize();
/**
 * Half the flipper's chord along it, either side of its line, in its own units: a narrow wrist, broadest a third of
 * the way out, tapering to a rounded tip. Never wider than the cygnet's clearance allows for (`net-whale-check` fin).
 */
export const FIN_HALF_CHORD = curve([
  [0, 0.3], [0.15, 0.42], [0.32, 0.47], [0.6, 0.335], [0.8, 0.215], [0.9, 0.16], [0.96, 0.11], [1, 0.035],
]);
/** Where the flukes hinge on the tail stock, as a fraction of the length. */
export const FLUKE_HINGE = 0.93;
export const BLOWHOLE = 0.21;

/** Heights of the back and belly and the half width of the body along its length (0 snout, 1 notch). */
export const TOP = curve([
  [0, -0.08], [0.005, 0.05], [0.012, 0.15], [0.03, 0.25], [0.06, 0.32], [0.1, 0.4], [0.16, 0.527], [0.21, 0.644],
  [0.26, 0.719], [0.3, 0.833], [0.36, 0.98], [0.42, 1.18], [0.55, 1.22], [0.62, 1.16],
  [0.7, 0.95], [0.8, 0.68], [0.9, 0.4], [0.96, 0.22], [1, 0.1],
]);
export const BOTTOM = curve([
  [0, -0.22], [0.006, -0.368], [0.015, -0.486], [0.03, -0.68], [0.06, -0.92], [0.1, -1.15], [0.17, -1.38], [0.3, -1.68],
  [0.42, -1.7], [0.55, -1.5], [0.65, -1.22], [0.75, -0.95], [0.85, -0.62], [0.93, -0.32], [1, -0.1],
]);
export const HALF_WIDTH = curve([
  [0, 0.16], [0.006, 0.4], [0.015, 0.58], [0.04, 0.84], [0.1, 1.05], [0.17, 1.22], [0.3, 1.55], [0.42, 1.6], [0.55, 1.38],
  [0.65, 1.0], [0.75, 0.6], [0.85, 0.32], [0.93, 0.2], [1, 0.1],
]);

/**
 * The mouth line in the rest pose: the height where the dark upper jaw meets the pale lower lip, from the snout back
 * to its corner under the front of the eye, running down toward the water as the head lies tipped up (never up toward
 * the eye, which would make a smile of it).
 */
export const MOUTH = curve([
  [0, -0.165], [0.006, -0.125], [0.03, -0.118], [0.06, -0.117], [0.1, -0.11], [0.125, -0.112], [0.152, -0.122],
]);
/** Where the mouth line ends, under the front of the eye, as a fraction of the length. */
export const JAW_CORNER = 0.152;
/** How much wider than the upper jaw the lower lip bows out, as a share of the half width. */
const LIP = curve([[0, 0], [0.012, 0.09], [0.1, 0.11], [0.135, 0.06], [JAW_CORNER + 0.005, 0]]);

/** The raised crown the blowhole sits on, over the top of the head. */
const MOUND = curve([[0.14, 0], [0.185, 0.08], [0.215, 0.11], [0.25, 0.05], [0.29, 0]]);
const MOUND_WIDTH = 0.42;

/** Height of the top of the body along the middle of its back, crown and all. */
export const crown = (s: number) => TOP(s) + MOUND(s);

export const DORSAL_AT = 0.64;
export const DORSAL_BASE = TOP(DORSAL_AT) - 0.12;

/** How much flatter than round the top of the body is at s: a broad flat head easing into a round back. */
const flatness = (s: number) => 1 / (1 + 0.5 * smoothstep(0.4, 0.06, s));

/** How high round the ring a point `a` radians from the top sits, from -1 under the belly to 1 on the back. */
export function ringHeight(s: number, a: number): number {
  const ca = Math.cos(a);
  return Math.sign(ca) * Math.abs(ca) ** (ca > 0 ? flatness(s) : 1);
}

/** How far the lower lip bows out at a point `below` the mouth line at s (rest units), as a share of the half width. */
function lip(s: number, below: number): number {
  if (s > JAW_CORNER + 0.005) return 0;
  return LIP(s) * smoothstep(-0.01, 0.045, below) * (1 - 0.6 * smoothstep(0.08, 0.5, below));
}

/**
 * A point on the body's rest-pose ring at s, `a` radians round from the top toward its left (+x): the shape every
 * ring of the mesh is built on, without the knuckles on the tail stock.
 */
export function ringPoint(s: number, a: number, out: { x: number; y: number }): { x: number; y: number } {
  const top = TOP(s);
  const bottom = BOTTOM(s);
  const sa = Math.sin(a);
  const e = Math.cos(a) > 0 ? flatness(s) : 1;
  out.x = HALF_WIDTH(s) * Math.sign(sa) * Math.abs(sa) ** e;
  out.y = (top + bottom) / 2 + ((top - bottom) / 2) * ringHeight(s, a);
  if (Math.cos(a) > 0) out.y += MOUND(s) * Math.exp(-((out.x / MOUND_WIDTH) ** 2));
  out.x *= 1 + lip(s, MOUTH(s) - out.y);
  return out;
}

/** How far out on its left (+x) the skin is at height y in the rest pose, at s along it. */
export function flankAt(s: number, y: number): number {
  const at = { x: 0, y: 0 };
  let lo = 0;
  let hi = Math.PI;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (ringPoint(s, mid, at).y > y) lo = mid;
    else hi = mid;
  }
  return ringPoint(s, (lo + hi) / 2, at).x;
}

/** The rest-pose point on the top half of the ring at s that lies `x` out from the midline. */
function topAtX(s: number, x: number): THREE.Vector3 {
  const at = { x: 0, y: 0 };
  let lo = 0;
  let hi = Math.PI / 2;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (ringPoint(s, mid, at).x < x) lo = mid;
    else hi = mid;
  }
  ringPoint(s, (lo + hi) / 2, at);
  return new THREE.Vector3(at.x, at.y, -s * LENGTH);
}

/**
 * The knobs on its head, on the near side (mirrored on the far): a row along the upper jaw over the mouth line, a few
 * on the chin of the lower lip, and a few either side of the rostrum's top.
 */
export const KNOBS: THREE.Vector3[] = [
  ...[[0.024, 0.08], [0.05, 0.13], [0.093, 0.1]].map(([s, up]) => {
    const y = MOUTH(s) + up;
    return new THREE.Vector3(flankAt(s, y), y, -s * LENGTH);
  }),
  ...[0.016, 0.045].map((s) => {
    const y = MOUTH(s) - 0.06;
    return new THREE.Vector3(flankAt(s, y), y, -s * LENGTH);
  }),
  topAtX(0.03, 0.22),
  topAtX(0.068, 0.34),
  topAtX(0.11, 0.24),
];

function build(pos: number[], rig: number[], idx: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aRig', new THREE.Float32BufferAttribute(rig, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Quads between consecutive loops of `around` vertices, outward when loops advance to the loop's right. */
function stitch(idx: number[], loops: number, around: number, base = 0): void {
  for (let i = 0; i < loops - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = base + i * around + j;
      const b = base + i * around + ((j + 1) % around);
      idx.push(a, b, a + around, b, b + around, a + around);
    }
  }
}

/** Where ring i of the body lies along it: close together over the head, where its forms are, and at the flukes. */
function ringAt(i: number): number {
  const HEAD = 0.34;
  if (i <= HEAD_RINGS) return HEAD * (1 - Math.cos((Math.PI / 2) * (i / HEAD_RINGS)));
  return HEAD + (1 - HEAD) * Math.sin((Math.PI / 2) * ((i - HEAD_RINGS) / (RINGS - HEAD_RINGS)));
}
const RINGS = 200;
const HEAD_RINGS = 110;

/** Rings along the length: a broad blunt head, the deep chest behind the flippers, a narrow keeled tail stock. */
function body(): THREE.BufferGeometry {
  const rings = RINGS;
  const around = 128;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  const at = { x: 0, y: 0 };
  for (let i = 0; i <= rings; i++) {
    const s = ringAt(i);
    const knuckles = 0.055 * Math.max(0, Math.sin((s - 0.68) * 62)) * smoothstep(0.68, 0.74, s) * smoothstep(0.98, 0.9, s);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      ringPoint(s, a, at);
      pos.push(at.x, at.y + knuckles * Math.max(0, Math.cos(a)) ** 6, -s * LENGTH);
      rig.push(s, BODY, j / around, ringHeight(s, a));
    }
  }
  stitch(idx, rings + 1, around);
  const nose = pos.length / 3;
  pos.push(0, (TOP(0) + BOTTOM(0)) / 2, 0.03);
  rig.push(0, BODY, 0, 0);
  for (let j = 0; j < around; j++) idx.push(nose, (j + 1) % around, j);
  const tail = pos.length / 3;
  pos.push(0, 0, -LENGTH - 0.02);
  rig.push(1, BODY, 0, 0);
  const last = rings * around;
  for (let j = 0; j < around; j++) idx.push(tail, last + j, last + ((j + 1) % around));
  return build(pos, rig, idx);
}

/**
 * A long pectoral fin, its chord centred on its line, the knobbly leading edge humpbacks are named for, thick at the
 * leading edge and thin at the trailing one.
 */
function fin(): THREE.BufferGeometry {
  const stations = 44;
  const around = 16;
  const e1 = FIN_DIR;
  const back = new THREE.Vector3(0, 0, -1);
  const e2 = back.clone().addScaledVector(e1, -back.dot(e1)).normalize();
  const e3 = new THREE.Vector3().crossVectors(e2, e1);
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const s = -FIN_ROOT.z / LENGTH;
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const half = FIN_HALF_CHORD(t);
    const knobs = 0.05 * Math.max(0, Math.sin(t * 9 * Math.PI)) ** 0.7 * smoothstep(0.1, 0.22, t) * (1 - smoothstep(0.86, 0.95, t));
    const bow = -0.06 * Math.sin(Math.PI * t);
    const thick = 0.14 * (1 - 0.72 * t) + 0.022;
    // Twisted to turn its broad top toward the boat, and sagging a little along its middle, so lying awash its smooth
    // edge breaks the surface and the knobbly one lies under the glass.
    const twist = -0.2 * smoothstep(0.05, 0.4, t);
    const sag = 0.05 * Math.sin(Math.PI * t);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const th = Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85) + (2 * along - 1) * half * twist + sag;
      p.copy(FIN_ROOT)
        .addScaledVector(e1, t * FIN_SPAN)
        .addScaledVector(e2, bow + (2 * along - 1) * half - knobs * (1 - along) ** 2)
        .addScaledVector(e3, th);
      pos.push(p.x, p.y, p.z);
      rig.push(s, FIN, t, along);
    }
  }
  stitch(idx, stations + 1, around);
  const tip = pos.length / 3;
  p.copy(FIN_ROOT).addScaledVector(e1, FIN_SPAN + 0.03);
  pos.push(p.x, p.y, p.z);
  rig.push(s, FIN, 1, 0.5);
  const last = stations * around;
  for (let j = 0; j < around; j++) idx.push(tip, last + j, last + ((j + 1) % around));
  return build(pos, rig, idx);
}

/** Rest z of the leading and trailing edges of the flukes at span t (-1 tip, 0 notch, 1 tip). */
export function flukeEdges(t: number): { lead: number; trail: number } {
  const at = Math.abs(t);
  const lead = -FLUKE_HINGE * LENGTH + 0.05 - 1.7 * at ** 1.7;
  const chord = 1.42 * Math.max(1 - at ** 2.3, 0) ** 0.55 + 0.04;
  const notch = 0.3 * Math.exp(-((t / 0.06) ** 2));
  const ragged = (0.05 * Math.sin(at * 33 + 0.7) + 0.035 * Math.sin(at * 61 + 2.1)) * smoothstep(0.1, 0.25, at) * (1 - at ** 4);
  return { lead, trail: lead - chord + notch + ragged };
}

/** Broad swept flukes with a notch in the middle and a ragged trailing edge. */
function flukes(): THREE.BufferGeometry {
  const stations = 64;
  const around = 14;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= stations; i++) {
    const t = -1 + (2 * i) / stations;
    const at = Math.abs(t);
    const { lead, trail } = flukeEdges(t);
    const thick = 0.25 * (1 - at) ** 0.8 + 0.018;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const z = lead + (trail - lead) * along;
      const y = Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85) - 0.22 * at ** 1.6;
      pos.push(t * FLUKE_HALF_SPAN, y, z);
      rig.push(-z / LENGTH, FLUKES, t, along);
    }
  }
  const idxRaw: number[] = [];
  stitch(idxRaw, stations + 1, around);
  for (let k = 0; k < idxRaw.length; k += 3) idx.push(idxRaw[k], idxRaw[k + 2], idxRaw[k + 1]);
  return build(pos, rig, idx);
}

/** The small stubby dorsal fin on its hump, two thirds of the way back. */
function dorsal(): THREE.BufferGeometry {
  const levels = 8;
  const around = 12;
  const s0 = DORSAL_AT;
  const base = DORSAL_BASE;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k <= levels; k++) {
    const h = k / levels;
    const y = base + h * 0.5;
    const lead = -s0 * LENGTH + 0.6 - h * h * 0.7;
    const chord = 1.3 * (1 - h) ** 1.3 + 0.12;
    const thick = 0.16 * (1 - h * 0.7);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const z = lead - along * chord;
      const x = Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85);
      pos.push(x, y, z);
      rig.push(-z / LENGTH, DORSAL, h, along);
    }
  }
  stitch(idx, levels + 1, around);
  const tip = pos.length / 3;
  pos.push(0, base + 0.53, -s0 * LENGTH + 0.6 - 0.7 - 0.12);
  rig.push(s0 + 0.01, DORSAL, 1, 0.5);
  const last = levels * around;
  for (let j = 0; j < around; j++) idx.push(tip, last + j, last + ((j + 1) % around));
  return build(pos, rig, idx);
}

/** The whole whale in its rest pose: snout at the origin, lying along -z, back up. */
export function whaleGeometry(): THREE.BufferGeometry {
  const left = fin();
  const right = flipWinding(fin().scale(-1, 1, 1));
  right.computeVertexNormals();
  const geo = mergeGeometries([body(), left, right, flukes(), dorsal()]);
  if (!geo) throw new Error('whale parts do not share attributes');
  return geo;
}

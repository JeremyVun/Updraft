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
/**
 * Root of the left pectoral fin (the right one is its mirror image): low on the flank just behind the corner of the
 * mouth, so it is plainly the head's own, a little under the water lying awash.
 */
export const FIN_ROOT = new THREE.Vector3(1.17, -0.158, -0.19 * LENGTH);
/** The flipper's length and its line out from the root at rest, before it is raised and swept, in its own units. */
export const FIN_SPAN = 4.5;
export const FIN_DIR = new THREE.Vector3(0.8, -0.3, -0.52).normalize();
/**
 * Half the flipper's chord along it, either side of its line, in its own units: a narrow wrist, broadest a third of
 * the way out, tapering to a rounded tip. Never wider than the cygnet's clearance allows for (`net-whale-check` fin).
 */
export const FIN_HALF_CHORD = curve([
  [0, 0.26], [0.15, 0.36], [0.32, 0.4], [0.6, 0.285], [0.8, 0.18], [0.9, 0.135], [0.96, 0.095], [1, 0.03],
]);
/** How far the flipper is turned on its edge about its own line, leading edge up (radians). */
const FIN_EDGE_UP = 0.3;
/** Across the flipper's line: back along the body, and the third axis, so its chord turns on its edge about the line. */
const FIN_ACROSS = new THREE.Vector3(0, 0, -1).addScaledVector(FIN_DIR, FIN_DIR.z).normalize();
const FIN_THROUGH = new THREE.Vector3().crossVectors(FIN_ACROSS, FIN_DIR);

/**
 * A point on the flipper at its rest size, relative to its root: `t` of the way out along its line (0 root .. 1 tip),
 * `along` across its chord (0 the knobbly leading edge, 1 the trailing edge), on its middle surface.
 */
export function finPoint(t: number, along: number, out: THREE.Vector3): THREE.Vector3 {
  const half = FIN_HALF_CHORD(t);
  const knobs = 0.12 * Math.max(0, Math.sin(t * 9 * Math.PI)) ** 0.7 * smoothstep(0.1, 0.22, t) * (1 - smoothstep(0.86, 0.95, t));
  const chord = (2 * along - 1) * half - knobs * (1 - along) ** 2;
  // Turned on its edge, the knobbly leading edge up and the trailing edge down, and drooping along its middle.
  const edge = FIN_EDGE_UP * smoothstep(0, 0.3, t);
  return out.copy(FIN_DIR).multiplyScalar(t * FIN_SPAN)
    .addScaledVector(FIN_ACROSS, -0.16 * Math.sin(Math.PI * t) + chord * Math.cos(edge))
    .addScaledVector(FIN_THROUGH, chord * Math.sin(edge) + 0.1 * Math.sin(Math.PI * t));
}
/** Where the flukes hinge on the tail stock, as a fraction of the length. */
export const FLUKE_HINGE = 0.93;
export const BLOWHOLE = 0.21;
/** The near eye in the rest pose: along, and up from the spine. */
export const EYE_S = 0.16;
export const EYE_Y = 0.136;

/**
 * The body's lines along its length (0 snout, 1 notch), from a blue whale's: heights of the back, of the line where
 * it is broadest and of the belly, and its half width there. The head is a long flat wedge rising to the blowhole;
 * the back runs on nearly level at that height and lowers only far along; it is broadest just behind the flippers,
 * below the waterline, so it sits in the sea like a hull; the tail stock is narrow and deep.
 */
export const TOP = curve([
  [0, -0.11], [0.005, -0.05], [0.015, 0.01], [0.03, 0.07], [0.06, 0.17], [0.1, 0.3], [0.13, 0.395], [0.16, 0.49],
  [0.19, 0.57], [0.21, 0.615], [0.25, 0.65], [0.3, 0.67], [0.36, 0.68], [0.42, 0.678], [0.5, 0.665], [0.58, 0.635],
  [0.66, 0.585], [0.74, 0.505], [0.82, 0.39], [0.88, 0.28], [0.93, 0.16], [1, 0.06],
]);
export const WIDEST = curve([
  [0, -0.27], [0.015, -0.28], [0.03, -0.275], [0.06, -0.25], [0.1, -0.21], [0.13, -0.185], [0.16, -0.165],
  [0.19, -0.16], [0.21, -0.17], [0.25, -0.23], [0.3, -0.3], [0.36, -0.365], [0.42, -0.39], [0.5, -0.39], [0.58, -0.38],
  [0.66, -0.34], [0.74, -0.3], [0.82, -0.26], [0.88, -0.235], [0.93, -0.185], [1, -0.105],
]);
export const BOTTOM = curve([
  [0, -0.4], [0.005, -0.49], [0.015, -0.58], [0.03, -0.67], [0.06, -0.78], [0.1, -0.915], [0.13, -1.005],
  [0.16, -1.095], [0.19, -1.175], [0.21, -1.23], [0.25, -1.34], [0.3, -1.45], [0.36, -1.515], [0.42, -1.53],
  [0.5, -1.465], [0.58, -1.345], [0.66, -1.175], [0.74, -0.995], [0.82, -0.785], [0.88, -0.63], [0.93, -0.445], [1, -0.235],
]);
export const HALF_WIDTH = curve([
  [0, 0.12], [0.005, 0.26], [0.015, 0.4], [0.03, 0.53], [0.06, 0.71], [0.1, 0.9], [0.13, 1.03], [0.16, 1.15],
  [0.19, 1.255], [0.21, 1.31], [0.25, 1.39], [0.3, 1.45], [0.36, 1.49], [0.42, 1.5], [0.5, 1.46], [0.58, 1.36],
  [0.66, 1.17], [0.74, 0.86], [0.82, 0.53], [0.88, 0.34], [0.93, 0.23], [1, 0.105],
]);
/**
 * How the skin rounds over from the broadest line to the back (above 1 a broad low ridge, below 1 the flat-topped
 * head) and down to the belly (above 1 the keel under the tail stock).
 */
const ROUND = curve([[0, 0.6], [0.13, 0.6], [0.21, 0.9], [0.3, 1.3], [0.7, 1.3], [0.85, 1.25], [1, 1.2]]);
const KEEL = curve([[0, 0.85], [0.16, 0.9], [0.3, 1], [0.66, 1], [0.8, 1.35], [1, 1.35]]);

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
const LIP = curve([[0, 0], [0.012, 0.11], [0.1, 0.15], [0.135, 0.08], [JAW_CORNER + 0.005, 0]]);

/** The splash guard before the blowhole, a gentle rise on the line of the back, and the ridge down the snout to it. */
const MOUND = curve([[0.16, 0], [0.19, 0.03], [0.207, 0.045], [0.225, 0.03], [0.255, 0]]);
const MOUND_WIDTH = 0.42;
const RIDGE = curve([[0.004, 0], [0.02, 0.035], [0.1, 0.048], [0.17, 0.038], [0.2, 0.014], [0.22, 0]]);
const RIDGE_WIDTH = 0.22;

/** Height of the top of the body along the middle of its back, crown and all. */
export const crown = (s: number) => TOP(s) + MOUND(s) + RIDGE(s);

export const DORSAL_AT = 0.74;
export const DORSAL_BASE = TOP(DORSAL_AT) - 0.08;

/** How high round the ring a point `a` radians from the top sits, from -1 under the belly to 1 on the back. */
export function ringHeight(s: number, a: number): number {
  const ca = Math.cos(a);
  return Math.sign(ca) * Math.abs(ca) ** (ca > 0 ? ROUND(s) : KEEL(s));
}

/** How far out the bare ring is at height y (rest units) at s, without the guard, the ridge or the lip. */
export function halfWidthAt(s: number, y: number): number {
  const wide = WIDEST(s);
  const k = y > wide ? (y - wide) / (TOP(s) - wide) : (wide - y) / (wide - BOTTOM(s));
  if (k >= 1) return 0;
  const c = k ** (1 / (y > wide ? ROUND(s) : KEEL(s)));
  return HALF_WIDTH(s) * Math.sqrt(1 - c * c);
}

/** How far the lower lip bows out at a point `below` the mouth line at s (rest units), as a share of the half width. */
function lip(s: number, below: number): number {
  if (s > JAW_CORNER + 0.005) return 0;
  return LIP(s) * smoothstep(-0.01, 0.045, below) * (1 - 0.6 * smoothstep(0.08, 0.5, below));
}

/**
 * A point on the body's rest-pose ring at s, `a` radians round from the top toward its left (+x): the shape every
 * ring of the mesh is built on.
 */
export function ringPoint(s: number, a: number, out: { x: number; y: number }): { x: number; y: number } {
  const wide = WIDEST(s);
  const k = ringHeight(s, a);
  out.x = HALF_WIDTH(s) * Math.sin(a);
  out.y = wide + (k > 0 ? TOP(s) - wide : wide - BOTTOM(s)) * k;
  if (k > 0) out.y += MOUND(s) * Math.exp(-((out.x / MOUND_WIDTH) ** 2)) + RIDGE(s) * Math.exp(-((out.x / RIDGE_WIDTH) ** 2));
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

/** Rings along the length: a flat wedge of a head, the broad chest behind the flippers, a narrow deep tail stock. */
function body(): THREE.BufferGeometry {
  const rings = RINGS;
  const around = 128;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  const at = { x: 0, y: 0 };
  for (let i = 0; i <= rings; i++) {
    const s = ringAt(i);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      ringPoint(s, a, at);
      pos.push(at.x, at.y, -s * LENGTH);
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
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const s = -FIN_ROOT.z / LENGTH;
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const thick = 0.14 * (1 - 0.72 * t) + 0.022;
    const edge = FIN_EDGE_UP * smoothstep(0, 0.3, t);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const th = Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85);
      finPoint(t, along, p).add(FIN_ROOT).addScaledVector(FIN_ACROSS, -th * Math.sin(edge)).addScaledVector(FIN_THROUGH, th * Math.cos(edge));
      pos.push(p.x, p.y, p.z);
      rig.push(s, FIN, t, along);
    }
  }
  stitch(idx, stations + 1, around);
  const tip = pos.length / 3;
  p.copy(FIN_ROOT).addScaledVector(FIN_DIR, FIN_SPAN + 0.03);
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

/** The small low dorsal fin, three quarters of the way back. */
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

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
/** Root of the left pectoral fin (the right one is its mirror image). */
export const FIN_ROOT = new THREE.Vector3(1.25, -0.8, -0.3 * LENGTH);
/** Where the flukes hinge on the tail stock, as a fraction of the length. */
export const FLUKE_HINGE = 0.93;
export const BLOWHOLE = 0.21;

/** Heights of the back and belly and the half width of the body along its length (0 snout, 1 notch). */
export const TOP = curve([
  [0, 0.0], [0.03, 0.22], [0.09, 0.45], [0.16, 0.62], [0.21, 0.72], [0.3, 0.98], [0.42, 1.18], [0.55, 1.22], [0.62, 1.16],
  [0.7, 0.95], [0.8, 0.68], [0.9, 0.4], [0.96, 0.22], [1, 0.1],
]);
export const BOTTOM = curve([
  [0, -0.14], [0.03, -0.5], [0.09, -0.95], [0.17, -1.35], [0.3, -1.68], [0.42, -1.7], [0.55, -1.5], [0.65, -1.22],
  [0.75, -0.95], [0.85, -0.62], [0.93, -0.32], [1, -0.1],
]);
export const HALF_WIDTH = curve([
  [0, 0.05], [0.02, 0.42], [0.08, 0.85], [0.17, 1.2], [0.3, 1.55], [0.42, 1.6], [0.55, 1.38], [0.65, 1.0],
  [0.75, 0.6], [0.85, 0.32], [0.93, 0.2], [1, 0.1],
]);

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

/** Rings along the length: a broad flat head, the deep chest behind the flippers, a narrow keeled tail stock. */
function body(): THREE.BufferGeometry {
  const rings = 90;
  const around = 44;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const s = 0.5 - 0.5 * Math.cos((Math.PI * i) / rings);
    const top = TOP(s);
    const bottom = BOTTOM(s);
    const w = HALF_WIDTH(s);
    const cy = (top + bottom) / 2;
    const h = (top - bottom) / 2;
    const knuckles = 0.055 * Math.max(0, Math.sin((s - 0.68) * 62)) * smoothstep(0.68, 0.74, s) * smoothstep(0.98, 0.9, s);
    const flat = 1 / (1 + 0.5 * smoothstep(0.4, 0.06, s));
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const e = ca > 0 ? flat : 1;
      const ridge = knuckles * Math.max(0, ca) ** 6;
      pos.push(w * Math.sign(sa) * Math.abs(sa) ** e, cy + h * Math.sign(ca) * Math.abs(ca) ** e + ridge, -s * LENGTH);
      rig.push(s, BODY, j / around, 0);
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

/** A long pectoral fin, slung low and swept back, with the knobbly leading edge humpbacks are named for. */
function fin(): THREE.BufferGeometry {
  const stations = 30;
  const around = 12;
  const span = 4.5;
  const e1 = new THREE.Vector3(0.8, -0.3, -0.52).normalize();
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
    const chord = 1.0 * Math.sqrt(Math.max(1 - t ** 3, 0)) * (0.78 + 0.22 * Math.sin(Math.PI * t)) + 0.06;
    const knobs = 0.07 * Math.max(0, Math.sin(t * 9.5 * Math.PI)) ** 0.6 * smoothstep(0.12, 0.25, t);
    const sweep = 0.55 * t * t;
    const thick = 0.12 * (1 - 0.7 * t) + 0.015;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const th = Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85);
      p.copy(FIN_ROOT)
        .addScaledVector(e1, t * span)
        .addScaledVector(e2, sweep - knobs + (along - 0.3) * chord)
        .addScaledVector(e3, th);
      pos.push(p.x, p.y, p.z);
      rig.push(s, FIN, t, along);
    }
  }
  stitch(idx, stations + 1, around);
  const tip = pos.length / 3;
  p.copy(FIN_ROOT).addScaledVector(e1, span + 0.04).addScaledVector(e2, 0.55);
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
    const thick = 0.19 * (1 - at) ** 0.9 + 0.012;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const z = lead + (trail - lead) * along;
      const y = Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85);
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
  const s0 = 0.64;
  const base = TOP(s0) - 0.12;
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

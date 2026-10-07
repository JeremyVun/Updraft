import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** What a surface is made of, for the shaders: bark, a root, the earth of a root plate, rope, seat wood. */
export const BARK = 0;
export const ROOT = 1;
export const EARTH = 2;
export const ROPE = 3;
export const PLANK = 4;

/**
 * A tapered tube along a run of points, with what it is made of, how much it shivers in a gust (0 rigid to 1 a
 * twig's tip, `shake0` at its first point to `shake1` at its last) and a phase of its own to shiver in.
 */
export function tube(points: THREE.Vector3[], r0: number, r1: number, radial: number, kind: number,
  shake0: number, shake1: number, phase: number, bulge = 0): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const segments = Math.max(2, (points.length - 1) * 3);
  const frames = curve.computeFrenetFrames(segments, false);
  const pos: number[] = [];
  const nrm: number[] = [];
  const shake: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, p);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(u, 0.8)) * (1 + bulge * Math.exp(-u * 9));
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const lump = 1 + 0.07 * Math.sin(a * 3 + u * 11 + phase * 5) * (kind === BARK ? 1 : 0.4);
      n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      pos.push(p.x + n.x * r * lump, p.y + n.y * r * lump, p.z + n.z * r * lump);
      nrm.push(n.x, n.y, n.z);
      shake.push(THREE.MathUtils.lerp(shake0, shake1, u));
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < radial; k++) {
      const q = i * (radial + 1) + k;
      idx.push(q, q + 1, q + radial + 1, q + 1, q + radial + 2, q + radial + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  return tagged(geo, kind, shake, phase);
}

/** Gives every vertex of `geo` what it is made of, how much it shivers, and its phase. */
export function tagged(geo: THREE.BufferGeometry, kind: number, shake: number[] | number, phase: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const count = g.attributes.position.count;
  const shakes = new Float32Array(count);
  const kinds = new Float32Array(count).fill(kind);
  const phases = new Float32Array(count).fill(phase);
  if (Array.isArray(shake)) {
    const order = geo.index ? (geo.index.array as ArrayLike<number>) : null;
    for (let i = 0; i < count; i++) shakes[i] = shake[order ? order[i] : i];
  } else shakes.fill(shake);
  g.setAttribute('aShake', new THREE.BufferAttribute(shakes, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return g;
}

export function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geo = mergeGeometries(parts);
  if (!geo) throw new Error('crossings: parts do not merge');
  return geo;
}

/** The shortest distance on screen between two segments, in the units they are given in. */
export function segmentGap(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, d: THREE.Vector2): number {
  const crosses = (p: THREE.Vector2, q: THREE.Vector2, r: THREE.Vector2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = crosses(c, d, a), d2 = crosses(c, d, b), d3 = crosses(a, b, c), d4 = crosses(a, b, d);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(pointGap(a, c, d), pointGap(b, c, d), pointGap(c, a, b), pointGap(d, a, b));
}

function pointGap(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const t = THREE.MathUtils.clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / Math.max(abx * abx + aby * aby, 1e-9), 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

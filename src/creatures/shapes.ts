import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];

export interface BlobSpec {
  part: number;
  mat: number;
  /** Pivot of the part; the ellipsoid sits at `offset` from it, rotated by `rot` about it. */
  at: V3;
  size: V3;
  offset?: V3;
  rot?: V3;
  detail?: number;
  /** Reshapes the unit sphere before it is scaled. */
  shape?: (u: THREE.Vector3) => void;
  /** 0..1 blend toward the material's second colour, from the unit-sphere position. */
  blend?: (u: THREE.Vector3) => number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A smooth welded ellipsoid tagged with its part (for the vertex rig) and material (for colour). */
export function blob(spec: BlobSpec): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, spec.detail ?? 2);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const geo = mergeVertices(ico);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const mat = new Float32Array(pos.count * 2);
  const u = new THREE.Vector3();
  const [ox, oy, oz] = spec.offset ?? [0, 0, 0];
  const rot = new THREE.Euler(...(spec.rot ?? [0, 0, 0]), 'YXZ');
  for (let i = 0; i < pos.count; i++) {
    u.fromBufferAttribute(pos, i);
    mat[i * 2] = spec.mat;
    mat[i * 2 + 1] = spec.blend ? clamp01(spec.blend(u)) : 0;
    spec.shape?.(u);
    u.set(u.x * spec.size[0] + ox, u.y * spec.size[1] + oy, u.z * spec.size[2] + oz).applyEuler(rot);
    pos.setXYZ(i, u.x + spec.at[0], u.y + spec.at[1], u.z + spec.at[2]);
  }
  geo.computeVertexNormals();
  geo.setAttribute('aMat', new THREE.BufferAttribute(mat, 2));
  return tag(geo, spec.part);
}

export function tag(geo: THREE.BufferGeometry, part: number): THREE.BufferGeometry {
  geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(part), 1));
  return geo;
}

export function mirrored(spec: BlobSpec, part: number): BlobSpec {
  const flip = ([x, y, z]: V3): V3 => [-x, y, z];
  const shape = spec.shape;
  const blend = spec.blend;
  const m = new THREE.Vector3();
  return {
    ...spec,
    part,
    at: flip(spec.at),
    offset: spec.offset && flip(spec.offset),
    rot: spec.rot && [spec.rot[0], -spec.rot[1], -spec.rot[2]],
    shape: shape && ((u) => {
      u.x = -u.x;
      shape(u);
      u.x = -u.x;
    }),
    blend: blend && ((u) => blend(m.set(-u.x, u.y, u.z))),
  };
}

/** Restores outward-facing triangles after mirroring a geometry with a negative scale. */
export function flipWinding(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const index = geo.index!.array;
  for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  return geo;
}

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geo = mergeGeometries(parts);
  if (!geo) throw new Error('creature parts do not share attributes');
  return geo;
}

/** Per-instance vec4 attributes rewritten every frame; one draw call per species. */
export class Instances {
  readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly arrays: Float32Array[] = [];
  private readonly attrs: THREE.InstancedBufferAttribute[] = [];

  constructor(base: THREE.BufferGeometry, readonly capacity: number, names: string[]) {
    this.geometry.index = base.index;
    for (const [name, attr] of Object.entries(base.attributes)) this.geometry.setAttribute(name, attr);
    for (const name of names) {
      const array = new Float32Array(capacity * 4);
      const attr = new THREE.InstancedBufferAttribute(array, 4);
      attr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, attr);
      this.arrays.push(array);
      this.attrs.push(attr);
    }
    this.geometry.instanceCount = 0;
  }

  set(slot: number, i: number, a: number, b: number, c: number, d: number): void {
    const arr = this.arrays[slot];
    const k = i * 4;
    arr[k] = a;
    arr[k + 1] = b;
    arr[k + 2] = c;
    arr[k + 3] = d;
  }

  commit(count: number): void {
    this.geometry.instanceCount = count;
    for (const attr of this.attrs) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, count * 4);
      attr.needsUpdate = true;
    }
  }
}

/** One ring of a lofted skin: an ellipse about `at` that can be taller above its centre than below, bound to two bones. */
export interface Station {
  at: V3;
  rx: number;
  up: number;
  down: number;
  /** The two bones this ring follows and the share of the second. */
  skin: [number, number, number];
}

export interface LoftSpec {
  stations: Station[];
  mat: number;
  around?: number;
  /** The axis every ring's width lies along; the ring's `up` is whatever is square to it and to the spine. */
  side?: V3;
  /** 0..1 blend toward the material's second colour: `t` along the spine, `a` round the ring (π/2 is `up`). */
  blend?: (t: number, a: number) => number;
  /** Extra rings put between each pair of stations on a smooth curve through them, so few stations still give a round skin. */
  smooth?: number;
}

/** Catmull-Rom through the stations; a ring's bones are those of the nearer station, with the share eased between them when they match. */
function refine(st: Station[], extra: number): Station[] {
  if (extra <= 0) return st;
  const at = (i: number) => st[Math.min(st.length - 1, Math.max(0, i))];
  const cr = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const out: Station[] = [];
  for (let i = 0; i < st.length - 1; i++) {
    out.push(st[i]);
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 1; k <= extra; k++) {
      const t = k / (extra + 1);
      const v = (f: (s: Station) => number) => Math.max(0.0005, cr(f(p0), f(p1), f(p2), f(p3), t));
      const same = p1.skin[0] === p2.skin[0] && p1.skin[1] === p2.skin[1];
      const near = t < 0.5 ? p1 : p2;
      out.push({
        at: [0, 1, 2].map((n) => cr(p0.at[n], p1.at[n], p2.at[n], p3.at[n], t)) as V3,
        rx: v((s) => s.rx),
        up: v((s) => s.up),
        down: v((s) => s.down),
        skin: same ? [p1.skin[0], p1.skin[1], p1.skin[2] + (p2.skin[2] - p1.skin[2]) * t] : between(p1, p2, t, near),
      });
    }
  }
  out.push(st[st.length - 1]);
  return out;
}

/** Between two rings bound to different pairs: when they share a bone the share slides across it, otherwise the nearer wins. */
function between(a: Station, b: Station, t: number, near: Station): [number, number, number] {
  const wa = (s: Station, bone: number) => (s.skin[0] === bone ? 1 - s.skin[2] : 0) + (s.skin[1] === bone ? s.skin[2] : 0);
  const bones = [...new Set([a.skin[0], a.skin[1], b.skin[0], b.skin[1]])];
  const weights = bones.map((bone) => wa(a, bone) * (1 - t) + wa(b, bone) * t);
  const order = bones.map((_, i) => i).sort((x, y) => weights[y] - weights[x]);
  if (order.length < 2) return near.skin;
  const [first, second] = order;
  const total = weights[first] + weights[second];
  return [bones[first], bones[second], total > 0 ? weights[second] / total : 0];
}

/**
 * One continuous skin swept along a spine, closed at both ends, smooth-skinned between bones so that a neck bends as
 * a neck and not as a string of beads. Carries `aSkin` (bone, bone, share of the second) in place of `aPart`.
 */
export function loft(spec: LoftSpec): THREE.BufferGeometry {
  const st = refine(spec.stations, spec.smooth ?? 0);
  const around = spec.around ?? 16;
  const side = new THREE.Vector3(...(spec.side ?? [1, 0, 0])).normalize();
  const positions: number[] = [];
  const mats: number[] = [];
  const skins: number[] = [];
  const index: number[] = [];
  const c = new THREE.Vector3();
  const t = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const centre = (i: number) => new THREE.Vector3(...st[Math.min(st.length - 1, Math.max(0, i))].at);
  const push = (p: THREE.Vector3, s: Station, k: number) => {
    positions.push(p.x, p.y, p.z);
    mats.push(spec.mat, clamp01(k));
    skins.push(s.skin[0], s.skin[1], s.skin[2], 0);
  };
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    c.set(...s.at);
    t.subVectors(centre(i + 1), centre(i - 1)).normalize();
    u.crossVectors(t, side).normalize();
    const along = i / (st.length - 1);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const lift = Math.sin(a);
      v.copy(c).addScaledVector(side, s.rx * Math.cos(a)).addScaledVector(u, (lift >= 0 ? s.up : s.down) * lift);
      push(v, s, spec.blend ? spec.blend(along, a) : 0);
    }
  }
  for (let i = 0; i < st.length - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      const d = (i + 1) * around + j;
      const e = (i + 1) * around + ((j + 1) % around);
      index.push(a, b, d, b, e, d);
    }
  }
  for (const [ring, s, flip] of [
    [0, st[0], true],
    [st.length - 1, st[st.length - 1], false],
  ] as const) {
    const pole = positions.length / 3;
    push(c.set(...s.at), s, spec.blend ? spec.blend(ring === 0 ? 0 : 1, -Math.PI / 2) : 0);
    for (let j = 0; j < around; j++) {
      const a = ring * around + j;
      const b = ring * around + ((j + 1) % around);
      if (flip) index.push(pole, b, a);
      else index.push(pole, a, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(mats), 2));
  geo.setAttribute('aSkin', new THREE.BufferAttribute(new Float32Array(skins), 4));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** A rigid part made to sit in the same mesh as a lofted skin: its `aPart` becomes a one-bone `aSkin`. */
export function skinned(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const part = geo.attributes.aPart as THREE.BufferAttribute;
  const skin = new Float32Array(part.count * 4);
  for (let i = 0; i < part.count; i++) skin.set([part.getX(i), part.getX(i), 0, 0], i * 4);
  geo.setAttribute('aSkin', new THREE.BufferAttribute(skin, 4));
  geo.deleteAttribute('aPart');
  return geo;
}

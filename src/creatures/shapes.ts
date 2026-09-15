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

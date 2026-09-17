import * as THREE from 'three';
import { tag, type V3 } from '../shapes';

/** The per-vertex pivot a flight feather turns about as the wing shuts, and how far it turns. */
export const FAN = 'aFan';

export interface FeatherSpec {
  part: number;
  mat: number;
  /** Where the quill leaves the wing, in rest space. */
  root: V3;
  length: number;
  /** Half the vane at its widest. */
  width: number;
  /** Fan angle from straight out along +x, positive toward the tail. */
  spin: number;
  /** Tip above (positive) or below the root. */
  lift?: number;
  /** How much further it swings about its own root once the wing is shut. */
  close?: number;
  thick?: number;
  rows?: number;
  around?: number;
  /** Blend toward the material's second colour at the tip, 0..1. */
  pale?: number;
}

/** A soft feather: a flattened tapering lens, narrow at the quill, widest just past halfway, rounded at the tip. */
export function feather(s: FeatherSpec): THREE.BufferGeometry {
  const rows = s.rows ?? 6;
  const around = s.around ?? 8;
  const thick = s.thick ?? s.width * 0.3;
  const pale = s.pale ?? 1;
  const turn = new THREE.Euler(0, s.spin, s.lift ?? 0, 'YZX');
  const v = new THREE.Vector3();
  const pos: number[] = [];
  const mats: number[] = [];
  const fans: number[] = [];
  const index: number[] = [];
  const push = (x: number, y: number, z: number, k: number) => {
    v.set(x, y, z).applyEuler(turn);
    pos.push(v.x + s.root[0], v.y + s.root[1], v.z + s.root[2]);
    mats.push(s.mat, k * pale);
    fans.push(s.root[0], s.root[1], s.root[2], s.close ?? 0);
  };
  for (let i = 0; i < rows; i++) {
    const u = i / (rows - 1);
    const w = s.width * (0.05 + 0.95 * Math.sin(Math.PI * u ** 0.85) ** 0.8);
    const h = thick * (0.32 + 0.68 * (1 - u));
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      push(u * s.length, Math.sin(a) * h, Math.cos(a) * w, u);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      const c = (i + 1) * around + j;
      const d = (i + 1) * around + ((j + 1) % around);
      index.push(a, b, c, b, d, c);
    }
  }
  for (const [ring, u, flip] of [
    [0, 0, true],
    [rows - 1, 1, false],
  ] as const) {
    const pole = pos.length / 3;
    push(u * s.length, 0, 0, u);
    for (let j = 0; j < around; j++) {
      const a = ring * around + j;
      const b = ring * around + ((j + 1) % around);
      if (flip) index.push(pole, b, a);
      else index.push(pole, a, b);
    }
  }
  return finish(pos, mats, fans, index, s.part);
}

export interface FootSpec {
  part: number;
  mat: number;
  /** The ankle, in rest space; the toes fan forward from it along +z. */
  at: V3;
  /** Each toe's bearing from straight ahead and its length. */
  toes: [bearing: number, length: number][];
  thick: number;
  /** How deeply the web is cut back between two toes, as a share of the chord. */
  scallop?: number;
  rings?: number;
}

/**
 * One webbed foot, far too big for the bird: a fan from the ankle out to three splayed toes with the web scalloped
 * between them, domed and ridged over the toes, flat underneath, and thin enough at the edge for light to come through.
 */
export function webFoot(s: FootSpec): THREE.BufferGeometry {
  const rings = s.rings ?? 4;
  const scallop = s.scallop ?? 0.2;
  const tip = (i: number): [number, number] => [Math.sin(s.toes[i][0]) * s.toes[i][1], Math.cos(s.toes[i][0]) * s.toes[i][1]];
  /** The outline, walked from one outer toe to the other: three points round each toe and two across each web. */
  const rim: { x: number; z: number; ridge: number }[] = [];
  for (let i = 0; i < s.toes.length; i++) {
    const [bearing, length] = s.toes[i];
    for (const [off, shrink, ridge] of [
      [-0.2, 0.9, 0.55],
      [0, 1, 1],
      [0.2, 0.9, 0.55],
    ]) {
      rim.push({ x: Math.sin(bearing + off) * length * shrink, z: Math.cos(bearing + off) * length * shrink, ridge });
    }
    if (i === s.toes.length - 1) break;
    const [ax, az] = tip(i);
    const [bx, bz] = tip(i + 1);
    for (const t of [0.34, 0.66]) {
      const cut = 1 - scallop * Math.sin(Math.PI * t);
      rim.push({ x: (ax + (bx - ax) * t) * cut, z: (az + (bz - az) * t) * cut, ridge: 0 });
    }
  }
  const pos: number[] = [];
  const mats: number[] = [];
  const fans: number[] = [];
  const index: number[] = [];
  const push = (x: number, y: number, z: number, k: number) => {
    pos.push(x + s.at[0], y + s.at[1], z + s.at[2]);
    mats.push(s.mat, k);
    fans.push(0, 0, 0, 0);
  };
  /** Two sheets over the same fan, meeting at a thin rim: the top domed over each toe, the sole nearly flat. */
  for (const side of [1, -1]) {
    for (let i = 0; i <= rings; i++) {
      const r = i / rings;
      const edge = 1 - r ** 6;
      for (const p of rim) {
        const swell = side > 0 ? 0.42 + 0.58 * p.ridge * r : -0.26;
        push(p.x * r, s.thick * swell * edge * (1 - 0.2 * r * r), p.z * r, p.ridge * r ** 3 * 0.35 + (1 - p.ridge) * r * 0.75);
      }
    }
  }
  const sheet = (rings + 1) * rim.length;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < rim.length - 1; j++) {
        const a = side * sheet + i * rim.length + j;
        const b = a + 1;
        const c = a + rim.length;
        const d = c + 1;
        if (side === 0) index.push(a, b, c, b, d, c);
        else index.push(a, c, b, b, c, d);
      }
    }
  }
  /** The rim and the two straight sides, so the foot is a closed surface. */
  const top = (i: number, j: number) => i * rim.length + j;
  const sole = (i: number, j: number) => sheet + i * rim.length + j;
  for (let j = 0; j < rim.length - 1; j++) index.push(top(rings, j), sole(rings, j), top(rings, j + 1), top(rings, j + 1), sole(rings, j), sole(rings, j + 1));
  for (let i = 0; i < rings; i++) {
    const j = rim.length - 1;
    index.push(top(i, 0), top(i + 1, 0), sole(i, 0), sole(i, 0), top(i + 1, 0), sole(i + 1, 0));
    index.push(top(i, j), sole(i, j), top(i + 1, j), sole(i, j), sole(i + 1, j), top(i + 1, j));
  }
  return finish(pos, mats, fans, index, s.part);
}

function finish(pos: number[], mats: number[], fans: number[], index: number[], part: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(mats), 2));
  geo.setAttribute(FAN, new THREE.BufferAttribute(new Float32Array(fans), 4));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return tag(geo, part);
}

/** Every part has to carry the fan attribute for the merge, even the ones that never swing. */
export function still(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.getAttribute(FAN)) geo.setAttribute(FAN, new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 4), 4));
  return geo;
}

import * as THREE from 'three';

/** What each vertex is made of; the shader lights and colours by it. */
export const MAT = {
  coat: 0,
  lining: 1,
  skin: 2,
  hair: 3,
  trousers: 4,
  boot: 5,
  leather: 6,
  strap: 7,
  knit: 8,
  button: 9,
  mitten: 10,
} as const;

/** Bone and weight pairs; any number, merged and cut to the four strongest when the vertex is written. */
export type Skin = [bone: number, weight: number][];

export interface Point {
  p: THREE.Vector3;
  skin: Skin;
  mat: number;
  /** A per-material shading parameter, 0..1: a darker band, a sole, the inside of a cuff. */
  k?: number;
  /** Baked occlusion, 1 open to 0 buried. */
  ao?: number;
  /** Where the point lies on its own surface (along, across), for knit, seams and grain. */
  uv?: [number, number];
}

export function skinOf(pairs: Skin): { index: number[]; weight: number[] } {
  const merged = new Map<number, number>();
  for (const [b, w] of pairs) if (w > 1e-4) merged.set(b, (merged.get(b) ?? 0) + w);
  const top = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = top.reduce((s, [, w]) => s + w, 0) || 1;
  const index = [0, 0, 0, 0];
  const weight = [0, 0, 0, 0];
  top.forEach(([b, w], i) => {
    index[i] = b;
    weight[i] = w / total;
  });
  if (top.length === 0) weight[0] = 1;
  return { index, weight };
}

/**
 * Accumulates the child's one mesh. Every part is a set of rows of points stitched together; each part is turned
 * outward-facing on its own, so the builders never have to think about winding.
 */
export class Builder {
  private readonly position: number[] = [];
  private readonly skinIndex: number[] = [];
  private readonly skinWeight: number[] = [];
  private readonly look: number[] = [];
  private readonly uv: number[] = [];
  private readonly index: number[] = [];

  private add(pt: Point): number {
    const { index, weight } = skinOf(pt.skin);
    this.position.push(pt.p.x, pt.p.y, pt.p.z);
    this.skinIndex.push(...index);
    this.skinWeight.push(...weight);
    this.look.push(pt.mat, pt.k ?? 0, pt.ao ?? 1, 0);
    this.uv.push(pt.uv?.[0] ?? 0, pt.uv?.[1] ?? 0);
    return this.position.length / 3 - 1;
  }

  /**
   * Rows stitched in order. A row of one point is a pole, fanned to its neighbour. `closed` joins each row's last
   * point to its first, and `loop` the last row to the first. Neighbouring rows of more than one point must be the
   * same length.
   * `inside` is a point the part wraps round, which decides which way its faces turn.
   */
  rows(rows: Point[][], closed: boolean, inside: THREE.Vector3, loop = false): void {
    const start = this.index.length;
    const ids = rows.map((row) => row.map((pt) => this.add(pt)));
    const count = loop ? ids.length : ids.length - 1;
    for (let r = 0; r < count; r++) {
      const a = ids[r];
      const b = ids[(r + 1) % ids.length];
      if (a.length === 1 || b.length === 1) {
        const pole = a.length === 1 ? a[0] : b[0];
        const ring = a.length === 1 ? b : a;
        const n = closed ? ring.length : ring.length - 1;
        for (let j = 0; j < n; j++) {
          const j2 = (j + 1) % ring.length;
          if (a.length === 1) this.index.push(pole, ring[j], ring[j2]);
          else this.index.push(ring[j], pole, ring[j2]);
        }
        continue;
      }
      const n = closed ? a.length : a.length - 1;
      for (let j = 0; j < n; j++) {
        const j2 = (j + 1) % a.length;
        this.index.push(a[j], b[j], a[j2], a[j2], b[j], b[j2]);
      }
    }
    this.orient(start, inside);
  }

  /** Turns a part's triangles to face away from the point it wraps round. */
  private orient(start: number, inside: THREE.Vector3): void {
    const p = this.position;
    const v = (i: number) => new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    let score = 0;
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let t = start; t < this.index.length; t += 3) {
      const a = v(this.index[t]);
      const b = v(this.index[t + 1]);
      const c = v(this.index[t + 2]);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      score += n.dot(a.add(b).add(c).multiplyScalar(1 / 3).sub(inside));
    }
    if (score >= 0) return;
    for (let t = start; t < this.index.length; t += 3) {
      const x = this.index[t + 1];
      this.index[t + 1] = this.index[t + 2];
      this.index[t + 2] = x;
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinWeight, 4));
    g.setAttribute('aLook', new THREE.Float32BufferAttribute(this.look, 4));
    g.setAttribute('aSurf', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.index);
    g.computeVertexNormals();
    return g;
  }

  get vertices(): number {
    return this.position.length / 3;
  }

  get triangles(): number {
    return this.index.length / 3;
  }
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Shortest signed angle from b to a. */
export const angleTo = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export const bump = (d: number, width: number) => Math.exp(-(d * d) / (width * width));

import * as THREE from 'three';

export type Kind = 'ground' | 'trunk' | 'line';
/** The surface height under a point of the world. */
export type Floor = (x: number, z: number) => number;

/**
 * A point on its way: on the ground, on a trunk, or on the top of the wool of the scarf. A trunk point is on the
 * bark, with the bark's outward `up` and the trunk's `radius` there (and its `axis`, if it leans); a line point is
 * where its paws go, on top of the wool.
 */
export interface SquirrelPoint {
  at: THREE.Vector3;
  on: Kind;
  up?: THREE.Vector3;
  radius?: number;
  axis?: THREE.Vector3;
}

/** Something a paw can stand on: `snap` moves a point to the nearest place on it and says how far that was. */
export interface Surface {
  kind: Kind;
  snap(p: THREE.Vector3): number;
}

const UP = new THREE.Vector3(0, 1, 0);
const STEP = 0.02;
const TRUNK_RADIUS = 0.2;

function ground(floor: Floor | null, level: number): Surface {
  return {
    kind: 'ground',
    snap(p) {
      const y = floor ? floor(p.x, p.z) : level;
      const d = Math.abs(y - p.y);
      p.y = y;
      return d;
    },
  };
}

function trunk(centre: THREE.Vector3, axis: THREE.Vector3, radius: number): Surface {
  const v = new THREE.Vector3();
  return {
    kind: 'trunk',
    snap(p) {
      v.subVectors(p, centre);
      const h = v.dot(axis);
      v.addScaledVector(axis, -h);
      const out = v.length();
      if (out < 1e-6) v.set(1, 0, 0);
      p.copy(centre).addScaledVector(axis, h).addScaledVector(v.normalize(), radius);
      return Math.abs(out - radius);
    },
  };
}

function line(points: THREE.Vector3[]): Surface {
  const ab = new THREE.Vector3();
  const best = new THREE.Vector3();
  const q = new THREE.Vector3();
  return {
    kind: 'line',
    snap(p) {
      if (points.length === 1) {
        const d = p.distanceTo(points[0]);
        p.copy(points[0]);
        return d;
      }
      let near = Infinity;
      for (let i = 0; i + 1 < points.length; i++) {
        ab.subVectors(points[i + 1], points[i]);
        const t = THREE.MathUtils.clamp(q.subVectors(p, points[i]).dot(ab) / Math.max(ab.lengthSq(), 1e-9), 0, 1);
        q.copy(points[i]).addScaledVector(ab, t);
        const d = q.distanceTo(p);
        if (d < near) {
          near = d;
          best.copy(q);
        }
      }
      p.copy(best);
      return near;
    },
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

/** `t` of the way round from the direction `a` to `b`. */
function turn(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  qb.setFromUnitVectors(a, b);
  return out.copy(a).applyQuaternion(qa.identity().slerp(qb, t));
}

/**
 * A path made into one smooth way to go: a curve through every point, laid onto the ground, wrapped round the
 * trunks and along the wool, with the surface's up at every step of it, and the surfaces near each stretch for
 * its paws to find. Between a stretch of one kind and the next (the ground to a trunk, a trunk to the wool) the up
 * turns over the gap between them, and the way stays clear of both.
 */
export class Route {
  readonly length: number;
  /** How far through its stretch the last `sample` was, 0..1. */
  t = 0;
  private readonly at: THREE.Vector3[] = [];
  private readonly ups: THREE.Vector3[] = [];
  private readonly s: number[] = [];
  private readonly seg: number[] = [];
  private readonly segT: number[] = [];
  private readonly surfaces: Surface[];
  private readonly kinds: Kind[];

  constructor(points: readonly SquirrelPoint[], floor: Floor | null) {
    const n = points.length;
    this.kinds = points.map((p) => p.on);
    const lines = new Map<number, Surface>();
    for (let i = 0; i < n; ) {
      if (points[i].on !== 'line') {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < n && points[j + 1].on === 'line') j++;
      const wool = line(points.slice(i, j + 1).map((p) => p.at));
      for (let k = i; k <= j; k++) lines.set(k, wool);
      i = j + 1;
    }
    this.surfaces = points.map((p, i) => {
      if (p.on === 'ground') return ground(floor, p.at.y);
      if (p.on === 'line') return lines.get(i)!;
      const r = p.radius ?? TRUNK_RADIUS;
      const out = (p.up ?? UP).clone().normalize();
      return trunk(p.at.clone().addScaledVector(out, -r), (p.axis ?? UP).clone().normalize(), r);
    });
    const upAt = (p: SquirrelPoint) => (p.on === 'trunk' && p.up ? p.up.clone().normalize() : UP.clone());
    const P = (i: number) => points[THREE.MathUtils.clamp(i, 0, n - 1)].at;
    const curve = new THREE.CatmullRomCurve3([], false, 'centripetal');
    let total = 0;
    const push = (p: THREE.Vector3, up: THREE.Vector3, seg: number, t: number) => {
      if (this.at.length) total += p.distanceTo(this.at[this.at.length - 1]);
      this.at.push(p);
      this.ups.push(up);
      this.s.push(total);
      this.seg.push(seg);
      this.segT.push(t);
    };
    if (n === 1) push(P(0).clone(), upAt(points[0]), 0, 1);
    for (let i = 0; i + 1 < n; i++) {
      const a = points[i], b = points[i + 1];
      const before = i > 0 ? P(i - 1) : P(0).clone().multiplyScalar(2).sub(P(1));
      const after = i + 2 < n ? P(i + 2) : P(n - 1).clone().multiplyScalar(2).sub(P(n - 2));
      curve.points = [before, a.at, b.at, after];
      const steps = Math.max(2, Math.ceil(a.at.distanceTo(b.at) / STEP));
      const upA = upAt(a), upB = upAt(b);
      for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
        const t = k / steps;
        const p = curve.getPoint((1 + t) / 3);
        const up = new THREE.Vector3();
        if (a.on === b.on && a.on === 'trunk') {
          const pa = p.clone(), pb = p.clone();
          this.surfaces[i].snap(pa);
          this.surfaces[i + 1].snap(pb);
          p.lerpVectors(pa, pb, t);
          up.copy(this.radial(points[i], p) ?? upA);
        } else if (a.on === b.on) {
          if (a.on === 'ground') this.surfaces[i].snap(p);
          up.copy(upA).lerp(upB, t).normalize();
        } else {
          /** Between kinds: kept clear of both surfaces, its up turning from one to the other. */
          for (const j of [i, i + 1]) {
            if (points[j].on === 'ground') {
              const probe = p.clone();
              this.surfaces[j].snap(probe);
              p.y = Math.max(p.y, probe.y);
            } else if (points[j].on === 'trunk') {
              const inside = this.inside(points[j], p);
              const out = this.radial(points[j], p);
              if (inside > 0 && out) p.addScaledVector(out, inside);
            }
          }
          /** Off the wool onto a trunk it turns to the bark early, so its head never meets it; off a trunk it leaves the bark first. */
          const lead = a.on === 'line' && b.on === 'trunk' ? (t - 0.05) / 0.6 : a.on === 'trunk' ? (t - 0.35) / 0.6 : t;
          turn(upA, upB, smooth(THREE.MathUtils.clamp(lead, 0, 1)), up);
        }
        push(p, up, i, t);
      }
    }
    this.length = total;
  }

  /** The bark's outward direction at `p` round the trunk `point` is on. */
  private radial(point: SquirrelPoint, p: THREE.Vector3): THREE.Vector3 | null {
    if (point.on !== 'trunk') return null;
    const r = point.radius ?? TRUNK_RADIUS;
    const axis = (point.axis ?? UP).clone().normalize();
    const centre = point.at.clone().addScaledVector((point.up ?? UP).clone().normalize(), -r);
    const v = p.clone().sub(centre);
    v.addScaledVector(axis, -v.dot(axis));
    return v.lengthSq() > 1e-10 ? v.normalize() : null;
  }

  /** How far `p` is inside the trunk `point` is on. */
  private inside(point: SquirrelPoint, p: THREE.Vector3): number {
    const r = point.radius ?? TRUNK_RADIUS;
    const axis = (point.axis ?? UP).clone().normalize();
    const centre = point.at.clone().addScaledVector((point.up ?? UP).clone().normalize(), -r);
    const v = p.clone().sub(centre);
    v.addScaledVector(axis, -v.dot(axis));
    return r - v.length();
  }

  /** Where it is `s` along the way: the point, the surface's up there, the way on, and which stretch it is in. */
  sample(s: number, at: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3): number {
    const n = this.at.length;
    if (n === 1) {
      at.copy(this.at[0]);
      up.copy(this.ups[0]);
      this.t = 1;
      return 0;
    }
    s = THREE.MathUtils.clamp(s, 0, this.length);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.s[mid] <= s) lo = mid;
      else hi = mid;
    }
    const span = this.s[hi] - this.s[lo];
    const t = span > 1e-9 ? (s - this.s[lo]) / span : 0;
    at.lerpVectors(this.at[lo], this.at[hi], t);
    up.lerpVectors(this.ups[lo], this.ups[hi], t).normalize();
    forward.subVectors(this.at[hi], this.at[lo]);
    this.t = this.seg[hi] === this.seg[lo] ? this.segT[lo] + (this.segT[hi] - this.segT[lo]) * t : this.segT[lo];
    return this.seg[lo];
  }

  /** The kind of the stretch `seg`, by the point it leaves from and the one it goes to. */
  kind(seg: number, t: 'from' | 'to'): Kind {
    return this.kinds[Math.min(this.kinds.length - 1, seg + (t === 'to' ? 1 : 0))];
  }

  /** Moves a paw onto the nearest of the surfaces around stretch `seg` (of kind `only`, if given), and says which kind it found. */
  snap(p: THREE.Vector3, seg: number, only?: Kind): Kind {
    let best = Infinity;
    let kind: Kind = 'ground';
    const out = p.clone();
    const q = new THREE.Vector3();
    const seen = new Set<Surface>();
    for (let j = Math.max(0, seg - 1); j <= Math.min(this.surfaces.length - 1, seg + 2); j++) {
      const surface = this.surfaces[j];
      if (seen.has(surface) || (only && surface.kind !== only)) continue;
      seen.add(surface);
      q.copy(p);
      const d = surface.snap(q);
      if (d < best) {
        best = d;
        kind = surface.kind;
        out.copy(q);
      }
    }
    p.copy(out);
    return kind;
  }
}

/**
 * Points spiralling round a trunk standing on `base` (a point on its axis), from `from` to `to` (each a height
 * above `base` and an angle round it from +x toward +z), about one every `step` metres along the bark. `radius` is
 * the trunk's, or its girth at a height above `base`.
 */
export function spiral(base: THREE.Vector3, radius: number | ((height: number) => number), from: { height: number; angle: number }, to: { height: number; angle: number }, step = 0.2): SquirrelPoint[] {
  const girth = typeof radius === 'number' ? () => radius : radius;
  const arc = Math.hypot((to.angle - from.angle) * girth(from.height), to.height - from.height);
  const n = Math.max(2, Math.ceil(arc / step) + 1);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const a = from.angle + (to.angle - from.angle) * t;
    const h = from.height + (to.height - from.height) * t;
    const r = girth(h);
    const up = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    return { at: base.clone().addScaledVector(up, r).setY(base.y + h), on: 'trunk' as const, up, radius: r };
  });
}

/** The centre line of a length of wool hung from `a` to `b`, sagging `sag` in the middle, as `n` points. */
export function sagging(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 12): THREE.Vector3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return new THREE.Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - 4 * sag * t * (1 - t));
  });
}

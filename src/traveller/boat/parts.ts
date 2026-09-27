import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  BOOM_LENGTH, BOW_Z, FLOOR_Y, MAST_TOP, MAST_Z, SAIL_HOIST, SAIL_RISE, SAIL_SPAN, SAIL_TACK, SAIL_TAPER, STERN_Z,
  floorAt, gunwale, halfWidth, hullDepth, sheer, spring, stationU, stationZ,
} from './form';

/** What the hull shader makes of a surface: see `HULL_FRAG`. */
export const KIND = { planks: 0, boards: 1, wood: 2, paint: 3, transom: 4 } as const;

/** Clinker strakes a side, keel to gunwale. */
export const STRAKES = 6;

const WOOD = {
  planks: new THREE.Color('#936649'),
  rail: new THREE.Color('#d9bf98'),
  ribs: new THREE.Color('#b0845a'),
  boards: new THREE.Color('#bb9467'),
  seat: new THREE.Color('#c9a376'),
  stem: new THREE.Color('#8f5d3c'),
  spar: new THREE.Color('#c2a07a'),
  hoop: new THREE.Color('#d9c09a'),
  rudder: new THREE.Color('#e7dcc4'),
};

/**
 * Every part carries the same attributes so they merge into one draw: its colour, and `aGrain` (kind, the
 * distance along the grain, across it, and for planking how far up the side it lies, 0 keel to 1 gunwale)
 * with `aTan`, the grain's direction (for planking, up the side toward the gunwale).
 */
function dress(geo: THREE.BufferGeometry, color: THREE.Color, kind: number,
  grain?: (p: THREE.Vector3, i: number) => [number, number, number], tangent?: THREE.Vector3): THREE.BufferGeometry {
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const grains = new Float32Array(n * 4);
  const tans = new Float32Array(n * 3);
  const p = new THREE.Vector3();
  const t = tangent ?? new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    colors.set([color.r, color.g, color.b], i * 3);
    const [along, across, girth] = grain ? grain(p, i) : [p.z, p.x + p.y, 0];
    grains.set([kind, along, across, girth], i * 4);
    tans.set([t.x, t.y, t.z], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!geo.getAttribute('aGrain')) geo.setAttribute('aGrain', new THREE.BufferAttribute(grains, 4));
  if (!geo.getAttribute('aTan')) geo.setAttribute('aTan', new THREE.BufferAttribute(tans, 3));
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  return geo;
}

/**
 * A round or squarish bar swept along a path: rails, ribs, stem, tiller. `out` and `up` span each cross-section,
 * `half` gives its two half-sizes at every point, and `square` near 0 squares the section off.
 */
function sweep(centres: THREE.Vector3[], outs: THREE.Vector3[], ups: THREE.Vector3[],
  half: (i: number) => [number, number], sides: number, square = 1): THREE.BufferGeometry {
  const pos: number[] = [];
  const grain: number[] = [];
  const tan: number[] = [];
  const idx: number[] = [];
  let along = 0;
  const dir = new THREE.Vector3();
  for (let i = 0; i < centres.length; i++) {
    if (i > 0) along += centres[i].distanceTo(centres[i - 1]);
    dir.subVectors(centres[Math.min(i + 1, centres.length - 1)], centres[Math.max(i - 1, 0)]).normalize();
    const [a, b] = half(i);
    for (let k = 0; k <= sides; k++) {
      const th = (k / sides) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const cx = Math.sign(c) * Math.abs(c) ** square;
      const sy = Math.sign(s) * Math.abs(s) ** square;
      const o = outs[i];
      const u = ups[i];
      pos.push(centres[i].x + o.x * cx * a + u.x * sy * b, centres[i].y + o.y * cx * a + u.y * sy * b, centres[i].z + o.z * cx * a + u.z * sy * b);
      grain.push(KIND.wood, along, (k / sides) * 0.2, 0);
      tan.push(dir.x, dir.y, dir.z);
    }
  }
  const first = new THREE.Vector3().subVectors(centres[1], centres[0]);
  const outward = new THREE.Vector3().crossVectors(outs[0], ups[0]).dot(first) < 0;
  for (let i = 0; i < centres.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * (sides + 1) + k;
      const b = a + sides + 1;
      if (outward) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  /** Close both ends so a bar never shows its hollow. */
  for (const [ring, flip] of [[0, !outward], [centres.length - 1, outward]] as const) {
    const centre = pos.length / 3;
    const c = centres[ring];
    pos.push(c.x, c.y, c.z);
    grain.push(KIND.wood, ring ? along : 0, 0, 0);
    tan.push(dir.x, dir.y, dir.z);
    for (let k = 0; k < sides; k++) {
      const a = ring * (sides + 1) + k;
      if (flip) idx.push(centre, a, a + 1);
      else idx.push(centre, a + 1, a);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aGrain', new THREE.Float32BufferAttribute(grain, 4));
  geo.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * The half-section of the planking at station `u`, sampled evenly along the girth from the keel up to the top
 * of the planking: the shell's own curve, then straight up the spring the topsides stand above it.
 */
function halfSection(u: number, count: number): { points: THREE.Vector2[]; girth: number } {
  const dense: THREE.Vector2[] = [];
  const hw = halfWidth(u);
  const d = hullDepth(u) * (1 - 0.5 * u * u);
  const S = 160;
  for (let k = 0; k <= S; k++) {
    // Denser toward the gunwale, where the section turns vertical.
    const th = (Math.PI / 2) * (1 - (k / S) ** 1.6);
    dense.push(new THREE.Vector2(hw * Math.cos(th), sheer(u) - d * Math.pow(Math.sin(th), 0.7)));
  }
  const lift = spring(u);
  if (lift > 1e-4) dense.push(new THREE.Vector2(hw, sheer(u) + lift));
  const arc = [0];
  for (let k = 1; k < dense.length; k++) arc.push(arc[k - 1] + dense[k].distanceTo(dense[k - 1]));
  const girth = arc[arc.length - 1];
  const points: THREE.Vector2[] = [];
  let k = 0;
  for (let j = 0; j <= count; j++) {
    const want = (j / count) * girth;
    while (k < arc.length - 2 && arc[k + 1] < want) k++;
    const f = arc[k + 1] > arc[k] ? (want - arc[k]) / (arc[k + 1] - arc[k]) : 0;
    points.push(new THREE.Vector2().lerpVectors(dense[k], dense[k + 1], THREE.MathUtils.clamp(f, 0, 1)));
  }
  return { points, girth };
}

/**
 * The planking: the shell the hull rests on, drawn finer and carried up into a sprung sheer. The clinker laps
 * are drawn by the shader along the girth, so they stay fine lines however far away the boat is.
 */
function planking(): THREE.BufferGeometry {
  const U = 44;
  const T = 16;
  const rows = 2 * T + 1;
  const pos: number[] = [];
  const grain: number[] = [];
  const tan: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector2();
  for (let i = 0; i <= U; i++) {
    // Closer stations toward the bow, where the planking sweeps in to the stem.
    const u = 1 - (1 - i / U) ** 1.25;
    const z = stationZ(u);
    const { points, girth } = halfSection(u, T);
    for (let j = 0; j < rows; j++) {
      // Starboard gunwale, down to the keel, up to the port gunwale.
      const k = j <= T ? T - j : j - T;
      const side = j < T ? 1 : -1;
      const p = points[k];
      up.subVectors(points[Math.min(k + 1, T)], points[Math.max(k - 1, 0)]).normalize();
      pos.push(side * p.x, p.y, z);
      grain.push(KIND.planks, z, (k / T) * girth, k / T);
      tan.push(side * up.x, up.y, 0);
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j;
      const b = a + rows;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aGrain', new THREE.Float32BufferAttribute(grain, 4));
  geo.setAttribute('aTan', new THREE.Float32BufferAttribute(tan, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return dress(geo, WOOD.planks, KIND.planks);
}

/** The transom: a flat board a little proud of the plank ends, closing the stern. */
function transom(): THREE.BufferGeometry {
  const T = 16;
  const { points } = halfSection(0, T);
  const outline: THREE.Vector3[] = [];
  const z = STERN_Z - 0.014;
  for (let j = 0; j <= 2 * T; j++) {
    const k = j <= T ? T - j : j - T;
    const side = j < T ? 1 : -1;
    outline.push(new THREE.Vector3(side * (points[k].x + 0.012), points[k].y - 0.01 * (1 - k / T), z));
  }
  const top = gunwale(0);
  const bottom = points[0].y;
  const pos: number[] = [0, (top + bottom) / 2, z];
  const idx: number[] = [];
  for (const p of outline) pos.push(p.x, p.y, p.z);
  for (let j = 1; j < outline.length; j++) idx.push(0, j, j + 1);
  idx.push(0, outline.length, 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return dress(geo, WOOD.planks, KIND.transom, (p) => [p.x, p.y, 0], new THREE.Vector3(1, 0, 0));
}

const Y = new THREE.Vector3(0, 1, 0);

/** The gunwale: a rounded rail capping the planking down each side, and across the top of the transom. */
function rails(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const N = 48;
  for (const side of [1, -1]) {
    const centres: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i === 0 ? -0.004 : 1 - (1 - i / N) ** 1.25;
      const w = halfWidth(THREE.MathUtils.clamp(u, 0, 1));
      centres.push(new THREE.Vector3(side * (w + 0.006), gunwale(THREE.MathUtils.clamp(u, 0, 1)) - 0.017, stationZ(u)));
    }
    const outs: THREE.Vector3[] = [];
    const ups: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = new THREE.Vector3().subVectors(centres[Math.min(i + 1, N)], centres[Math.max(i - 1, 0)]).normalize();
      const out = new THREE.Vector3().crossVectors(Y, t).normalize().multiplyScalar(side);
      outs.push(out);
      ups.push(new THREE.Vector3().crossVectors(t, out).normalize().multiplyScalar(side));
    }
    parts.push(dress(sweep(centres, outs, ups, (i) => [0.03 * (1 - 0.35 * (i / N) ** 4), 0.022], 10, 0.7), WOOD.rail, KIND.wood));
  }
  const w = halfWidth(0) + 0.02;
  const cap = [new THREE.Vector3(-w, gunwale(0) - 0.017, STERN_Z - 0.012), new THREE.Vector3(w, gunwale(0) - 0.017, STERN_Z - 0.012)];
  parts.push(dress(sweep(cap, [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -1)], [Y, Y], () => [0.028, 0.022], 10, 0.7), WOOD.rail, KIND.wood));
  return parts;
}

/** A point on the inside of the planking at station `u`, `f` of the way up its girth, and the way into the hull there. */
function inside(u: number, f: number, side: number): { p: THREE.Vector3; into: THREE.Vector3 } {
  const T = 64;
  const { points } = halfSection(u, T);
  const g = THREE.MathUtils.clamp(f, 0, 1) * T;
  const k = Math.min(T - 1, Math.floor(g));
  const a = points[k];
  const b = points[k + 1];
  const t = g - k;
  const p = new THREE.Vector2().lerpVectors(a, b, t);
  const along = new THREE.Vector2().subVectors(b, a).normalize();
  // Rotated toward the hull's centreline: inward and upward from the planking.
  const into = new THREE.Vector2(-along.y, along.x);
  if (into.x > 0) into.negate();
  return { p: new THREE.Vector3(side * p.x, p.y, stationZ(u)), into: new THREE.Vector3(side * into.x, into.y, 0) };
}

/** The girth fraction at which the inside of the planking reaches height `y` at station `u`. */
function girthAt(u: number, y: number): number {
  const T = 64;
  const { points } = halfSection(u, T);
  for (let k = 0; k < T; k++) {
    if (points[k + 1].y >= y) return THREE.MathUtils.clamp((k + (y - points[k].y) / Math.max(points[k + 1].y - points[k].y, 1e-6)) / T, 0, 1);
  }
  return 1;
}

/** The frames: bent ribs up the inside of the planking from the floorboards to the rail, and the risers the seats rest on. */
function frames(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const Z = new THREE.Vector3(0, 0, 1);
  for (let z = STERN_Z + 0.3; z < 1.9; z += 0.34) {
    const u = stationU(z);
    const from = girthAt(u, floorAt(u).y - 0.03);
    const to = girthAt(u, gunwale(u) - 0.04);
    for (const side of [1, -1]) {
      const centres: THREE.Vector3[] = [];
      const outs: THREE.Vector3[] = [];
      const ups: THREE.Vector3[] = [];
      const M = 7;
      for (let m = 0; m <= M; m++) {
        const { p, into } = inside(u, THREE.MathUtils.lerp(from, to, m / M), side);
        centres.push(p.addScaledVector(into, 0.02));
        outs.push(into);
        ups.push(Z);
      }
      parts.push(dress(sweep(centres, outs, ups, () => [0.012, 0.022], 8, 0.35), WOOD.ribs, KIND.wood));
    }
  }
  for (const side of [1, -1]) {
    const centres: THREE.Vector3[] = [];
    const outs: THREE.Vector3[] = [];
    const ups: THREE.Vector3[] = [];
    const y = -0.05;
    for (let z = STERN_Z + 0.2; z <= 1.75; z += 0.12) {
      const u = stationU(z);
      const { p, into } = inside(u, girthAt(u, y), side);
      centres.push(p.addScaledVector(into, 0.022));
      const out = new THREE.Vector3(into.x, 0, 0).normalize();
      outs.push(out);
      ups.push(Y);
    }
    parts.push(dress(sweep(centres, outs, ups, () => [0.012, 0.028], 8, 0.35), WOOD.ribs, KIND.wood));
  }
  return parts;
}

/** The floorboards: a flat deck lofted to the inside of the hull at the height the boards are laid. */
function floorboards(): THREE.BufferGeometry {
  const U = 18;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const { y, half } = floorAt(u);
    const z = stationZ(u);
    pos.push(-half, y, z, half, y, z);
  }
  for (let i = 0; i < U; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return dress(geo, WOOD.boards, KIND.boards, (p) => [p.z, p.x, 0]);
}

function board(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Color): THREE.BufferGeometry {
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(h, d) * 0.3).translate(x, y, z);
  return dress(geo, color, KIND.wood, (p) => [p.x, p.z, 0], new THREE.Vector3(1, 0, 0));
}

/** The seats: the thwart the child sits on, the mast thwart and the stern sheets. */
function seats(): THREE.BufferGeometry[] {
  return [
    board(1.7, 0.08, 0.34, 0, 0.02, -0.25, WOOD.seat),
    board(1.52, 0.07, 0.2, 0, 0.03, MAST_Z, WOOD.seat),
    board(1.28, 0.05, 0.36, 0, -0.035, STERN_Z + 0.24, WOOD.seat),
  ];
}

/** The little foredeck over the bow, crowned, meeting the rails at the stem. */
function foredeck(): THREE.BufferGeometry {
  const U = 10;
  const X = 6;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= U; i++) {
    const u = THREE.MathUtils.lerp(0.84, 1, i / U);
    const w = halfWidth(u);
    for (let k = 0; k <= X; k++) {
      const f = (k / X) * 2 - 1;
      pos.push(f * w, gunwale(u) - 0.012 + 0.018 * (1 - f * f), stationZ(u));
    }
  }
  for (let i = 0; i < U; i++) {
    for (let k = 0; k < X; k++) {
      const a = i * (X + 1) + k;
      const b = a + X + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return dress(geo, WOOD.seat, KIND.boards, (p) => [p.z, p.x, 0]);
}

/** The stem: the post the planking runs into, from the forefoot up past the gunwale to a rounded head. */
function stem(): THREE.BufferGeometry {
  const keel = (u: number) => sheer(u) - hullDepth(u) * (1 - 0.5 * u * u);
  const centres: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const u = THREE.MathUtils.lerp(0.8, 0.965, i / 8);
    centres.push(new THREE.Vector3(0, keel(u) - 0.004, stationZ(u)));
  }
  // Round the forefoot into the upright stem with a quadratic bend.
  const a = centres[centres.length - 1].clone();
  const corner = new THREE.Vector3(0, keel(1), BOW_Z);
  const head = new THREE.Vector3(0, gunwale(1) + 0.07, BOW_Z - 0.01);
  const b = new THREE.Vector3(0, keel(1) + 0.12, BOW_Z);
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    centres.push(new THREE.Vector3(0, (1 - t) ** 2 * a.y + 2 * t * (1 - t) * corner.y + t * t * b.y, (1 - t) ** 2 * a.z + 2 * t * (1 - t) * corner.z + t * t * b.z));
  }
  for (let i = 1; i <= 4; i++) centres.push(new THREE.Vector3().lerpVectors(b, head, i / 4));
  const outs: THREE.Vector3[] = [];
  const ups: THREE.Vector3[] = [];
  const X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < centres.length; i++) {
    const t = new THREE.Vector3().subVectors(centres[Math.min(i + 1, centres.length - 1)], centres[Math.max(i - 1, 0)]).normalize();
    outs.push(X);
    ups.push(new THREE.Vector3().crossVectors(t, X).normalize());
  }
  return dress(sweep(centres, outs, ups, (i) => [0.024, i === centres.length - 1 ? 0.026 : 0.03], 8, 0.5), WOOD.stem, KIND.wood);
}

/** The rudder hung off the transom, painted, and its tiller reaching in over the stern. */
function rudder(): THREE.BufferGeometry[] {
  const top = gunwale(0);
  const shape = new THREE.Shape();
  // Distance aft of the transom, height.
  shape.moveTo(0, top + 0.1);
  shape.lineTo(0.075, top + 0.1);
  shape.quadraticCurveTo(0.1, top - 0.02, 0.13, -0.06);
  shape.quadraticCurveTo(0.33, -0.2, 0.33, -0.4);
  shape.quadraticCurveTo(0.32, -0.53, 0.2, -0.54);
  shape.lineTo(0.02, -0.52);
  shape.lineTo(0, -0.46);
  shape.lineTo(0, top + 0.1);
  const thick = 0.03;
  const blade = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 1, curveSegments: 6 });
  blade.rotateY(Math.PI / 2).translate(-thick / 2, 0, STERN_Z - 0.03);
  const tiller: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    tiller.push(new THREE.Vector3(0, top + 0.07 + 0.08 * t - 0.05 * t * t, STERN_Z - 0.07 + 0.82 * t));
  }
  const X = new THREE.Vector3(1, 0, 0);
  const ups = tiller.map((_, i) => {
    const t = new THREE.Vector3().subVectors(tiller[Math.min(i + 1, 6)], tiller[Math.max(i - 1, 0)]).normalize();
    return new THREE.Vector3().crossVectors(t, X).normalize();
  });
  return [
    dress(blade, WOOD.rudder, KIND.paint, (p) => [p.y, p.z, 0], Y),
    dress(sweep(tiller, tiller.map(() => X), ups, (i) => [0.02 - 0.005 * (i / 6), 0.024 - 0.006 * (i / 6)], 8, 0.8), WOOD.spar, KIND.wood),
  ];
}

/** The mast, tapering to its truck, with the hoops the sail's luff is laced to. */
function mast(): THREE.BufferGeometry[] {
  const height = MAST_TOP - FLOOR_Y;
  const spar = new THREE.CylinderGeometry(0.036, 0.07, height, 12, 3).translate(0, (MAST_TOP + FLOOR_Y) / 2, MAST_Z);
  const truck = new THREE.SphereGeometry(0.048, 12, 6).scale(1, 0.55, 1).translate(0, MAST_TOP, MAST_Z);
  const parts = [
    dress(spar, WOOD.spar, KIND.wood, (p) => [p.y, Math.atan2(p.x, p.z - MAST_Z) * 0.07, 0], Y),
    dress(truck, WOOD.spar, KIND.wood, (p) => [p.y, p.x, 0], Y),
  ];
  for (let k = 1; k <= 5; k++) {
    const y = SAIL_TACK + (k / 5.6) * SAIL_HOIST;
    const r = 0.07 - 0.034 * ((y - FLOOR_Y) / height) + 0.028;
    const hoop = new THREE.TorusGeometry(r, 0.011, 5, 16).rotateX(Math.PI / 2).translate(0, y, MAST_Z);
    parts.push(dress(hoop, WOOD.hoop, KIND.wood, (p) => [Math.atan2(p.x, p.z - MAST_Z) * r, p.y, 0], new THREE.Vector3(1, 0, 0)));
  }
  return parts;
}

/** Everything fixed to the hull, in one geometry for one draw. */
export function hullGeometry(): THREE.BufferGeometry {
  const parts = [planking(), transom(), ...rails(), ...frames(), floorboards(), ...seats(), foredeck(), stem(), ...rudder(), ...mast()];
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  if (!merged) throw new Error('boat parts do not merge');
  return merged;
}

/** The boom, lying along -x from the mast: the boat turns it toward the clew every frame. */
export function boomGeometry(): THREE.BufferGeometry {
  const spar = new THREE.CylinderGeometry(0.034, 0.04, BOOM_LENGTH, 10, 2).rotateZ(Math.PI / 2).translate(-BOOM_LENGTH / 2, 0, 0);
  const end = new THREE.SphereGeometry(0.035, 10, 6).translate(-BOOM_LENGTH, 0, 0);
  const jaw = new THREE.SphereGeometry(0.05, 10, 6).scale(1.2, 0.8, 1).translate(-0.02, 0, 0);
  const merged = mergeGeometries([spar, end, jaw].map((g) => dress(g.toNonIndexed(), WOOD.spar, KIND.wood, (p) => [p.x, p.y + p.z, 0], new THREE.Vector3(1, 0, 0))));
  if (!merged) throw new Error('boom parts do not merge');
  return merged;
}

/** A cloth strip the pennant's shader flies from the masthead; the mesh carries only where each point is on it. */
export function pennantGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(1, 1, 14, 2).translate(0.5, 0.5, 0);
}

/** Enough of a grid for the cloth to hang in folds; the shader moves every point of it from its uv. */
export function sailGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 24, 22);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getX(i) + 0.5;
    const t = pos.getY(i) + 0.5;
    pos.setXYZ(i, -s * SAIL_SPAN * (1 - t * SAIL_TAPER), SAIL_TACK + t * SAIL_HOIST + s * SAIL_RISE, 0);
  }
  return geo;
}

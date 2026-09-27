import * as THREE from 'three';

/**
 * The hull the physics rests on, as it was measured: its vertices are the boat's contacts with the ground, so it
 * keeps its own numbers however the drawn hull above the waterline changes.
 */
const SHELL = { length: 4.8, beam: 0.95, depth: 0.62, sheer: 0.28 };

interface Form {
  length: number;
  beam: number;
  /** Higher keeps the hull full further forward before it closes to the stem. */
  fullness: number;
  /** The transom's width, as a fraction of the beam. */
  transom: number;
  /** The top of the planking `u` of the way from transom (0) to stem (1). */
  gunwale: (u: number) => number;
  /** How much wider the hull is at the gunwale than at the turn of the bilge. */
  flare: number;
  /** How far the stem leans forward and the transom aft as they rise above the shell. */
  rake: { bow: number; stern: number };
  /** Where the child sits: the thwart's height. */
  seat: number;
  strakes: number;
  /** The concept's finish: honey planking, a cream strake hung with rope, a stout dark mast. */
  concept: boolean;
}

/** A sheer that sweeps up from its lowest point `low` of the way along to `stern` and `bow` at the ends. */
const sweep = (mid: number, stern: number, bow: number, low: number, bend = 2) => (u: number) =>
  mid + (u < low ? (stern - mid) * ((low - u) / low) ** bend : (bow - mid) * ((u - low) / (1 - low)) ** bend);

const firstSpring = { stern: 0.13, sternTo: 0.42, bow: 0.05, bowFrom: 0.75 };
const FORMS: Record<string, Form> = {
  first: {
    length: 4.8, beam: 0.95, fullness: 3.2, transom: 0.7, flare: 0, rake: { bow: 0, stern: 0 }, seat: 0.02, strakes: 8, concept: false,
    gunwale: (u) => SHELL.sheer * u * u + firstSpring.stern * Math.max(0, 1 - u / firstSpring.sternTo) ** 2
      + firstSpring.bow * THREE.MathUtils.smoothstep(u, firstSpring.bowFrom, 1),
  },
  /** Sides raised to the seated child's waist; the seat, length and beam as they were. */
  waist: {
    length: 4.8, beam: 1.02, fullness: 3.6, transom: 0.5, flare: 0.08, rake: { bow: 0.28, stern: 0.3 }, seat: 0.02, strakes: 10, concept: true,
    gunwale: sweep(0.62, 1.0, 1.3, 0.42, 2.2),
  },
  /** The concept's tub: shorter and beamier, the child sat low with the gunwale at the chest, a strong sheer. */
  tub: {
    length: 4.1, beam: 1.1, fullness: 4.2, transom: 0.47, flare: 0.1, rake: { bow: 0.3, stern: 0.32 }, seat: -0.14, strakes: 11, concept: true,
    gunwale: sweep(0.86, 1.3, 1.62, 0.44, 2.2),
  },
  /** The tub at full length and broader still: a bigger boat as well as a deeper one. */
  big: {
    length: 4.8, beam: 1.2, fullness: 4.2, transom: 0.47, flare: 0.1, rake: { bow: 0.3, stern: 0.32 }, seat: -0.14, strakes: 12, concept: true,
    gunwale: sweep(0.9, 1.36, 1.72, 0.44, 2.2),
  },
};
const FORM = FORMS[typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('hull') ?? ''] ?? FORMS.first;

export const LENGTH = FORM.length;
export const BEAM = FORM.beam;
export const DEPTH = SHELL.depth;
export const STRAKES = FORM.strakes;
export const CONCEPT = FORM.concept;
/** Floorboards, laid across the ribs. They sit above the waterline, so the sea is never seen inside the hull. */
export const FLOOR_Y = -0.24;
/** How deep the hull floats: local y 0 rides this far above the sea, putting the waterline below the floorboards. */
export const DRAFT = 0.42;
export const SEAT_Y = FORM.seat;
export const STERN_Z = -0.45 * LENGTH;
export const BOW_Z = 0.55 * LENGTH;
/** The mast stands this far forward of the hull's origin; the sail swings about it. */
export const MAST_Z = 0.55;

/** Half-width, depth and sheer of the hull `u` of the way from transom (0) to stem (1). */
export const halfWidth = (u: number) => BEAM * (1 - Math.pow(u, FORM.fullness)) * (FORM.transom + (1 - FORM.transom) * Math.sin(u * Math.PI));
export const hullDepth = (u: number) => DEPTH * (0.8 + 0.2 * Math.sin(u * Math.PI));
export const sheer = (u: number) => SHELL.sheer * u * u;
/** The top of the planking, where the gunwale rail runs. */
export const gunwale = (u: number) => Math.max(FORM.gunwale(u), sheer(u));
/** How much the topsides flare out from the turn of the bilge: most amidships, none at the transom or the stem. */
export const flare = (u: number) => FORM.flare * Math.sin(u * Math.PI) ** 0.6;
/** The planking's half-width at the gunwale. */
export const gunwaleHalf = (u: number) => halfWidth(u) * (1 + flare(u));
export const stationZ = (u: number) => (u - 0.45) * LENGTH;
export const stationU = (z: number) => THREE.MathUtils.clamp(z / LENGTH + 0.45, 0, 1);

/**
 * How the sail is cut: the foot from mast to clew, the luff from tack to head, how far it narrows toward the
 * head, how far the foot rises to the clew and how high the tack sits, clear of the gunwale beside the mast. The
 * shader cuts the same cloth from these numbers, so the mesh only has to carry the uv and a shape to be measured for.
 */
export const SAIL_SPAN = 2.7;
export const SAIL_HOIST = 3.7;
export const SAIL_TAPER = 0.55;
export const SAIL_RISE = 0.35;
export const SAIL_TACK = Math.max(0.75, gunwale(stationU(MAST_Z)) + 0.28);
/** The masthead, above the sail's head, where the pennant flies. */
export const MAST_TOP = SAIL_TACK + 4.2;
/** The boom reaches a little past the clew of a full sail. */
export const BOOM_LENGTH = 2.8;

/**
 * The ends lean out as they rise above the shell, the stem forward and the transom aft, easing in from upright so
 * the planking bends rather than kinks. Only the drawn hull leans; the shell it rests on does not.
 */
export function rake(p: THREE.Vector3): THREE.Vector3 {
  const u = stationU(p.z);
  const h = Math.max(0, p.y - sheer(u));
  const lean = FORM.rake.bow * THREE.MathUtils.smoothstep(u, 0.72, 1) - FORM.rake.stern * (1 - THREE.MathUtils.smoothstep(u, 0, 0.32));
  p.z += lean * (h * h) / (h + 0.3);
  return p;
}

/** A point on the shell: `th` runs round the section from the starboard gunwale (0) under the keel to port (PI). */
export function shellPoint(u: number, th: number, out: THREE.Vector3): THREE.Vector3 {
  return out.set(
    halfWidth(u) * Math.cos(th),
    sheer(u) - hullDepth(u) * Math.pow(Math.sin(th), 0.7) * (1 - 0.5 * u * u),
    stationZ(u),
  );
}

/**
 * The shell the hull rests on: U-shaped sections along the length, a flat transom at the stern, rising to a point
 * at the bow. Its vertices are the hull's contacts with the ground, so it is kept exactly as it was measured.
 */
export function contactShell(): THREE.BufferGeometry {
  const U = 18;
  const T = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  const half = (u: number) => SHELL.beam * (1 - Math.pow(u, 3.2)) * (0.7 + 0.3 * Math.sin(u * Math.PI));
  const depth = (u: number) => SHELL.depth * (0.8 + 0.2 * Math.sin(u * Math.PI));
  const point = (u: number, th: number) => [
    half(u) * Math.cos(th),
    SHELL.sheer * u * u - depth(u) * Math.pow(Math.sin(th), 0.7) * (1 - 0.5 * u * u),
    (u - 0.45) * SHELL.length,
  ];
  for (let i = 0; i <= U; i++) {
    for (let j = 0; j <= T; j++) pos.push(...point(i / U, (j / T) * Math.PI));
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < T; j++) {
      const a = i * (T + 1) + j;
      const b = a + T + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const centre = pos.length / 3;
  pos.push(0, -depth(0) * 0.45, -0.45 * SHELL.length);
  for (let j = 0; j < T; j++) idx.push(centre, j, j + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Where the floorboards meet the inside of the shell at station `u`: their height and half-width there. */
export function floorAt(u: number): { y: number; half: number } {
  // At the narrow bow the shell rises above the main floor level. Follow it inside the hull.
  const y = Math.max(FLOOR_Y, sheer(u) - hullDepth(u) * (1 - 0.5 * u * u) + 0.02);
  const drop = (sheer(u) - y) / (hullDepth(u) * (1 - 0.5 * u * u));
  const sin = Math.min(1, Math.max(0, drop)) ** (1 / 0.7);
  return { y, half: halfWidth(u) * Math.sqrt(Math.max(0, 1 - sin * sin)) };
}

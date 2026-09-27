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
  /** Below 1 the planking closes to the stem in a rounded curve rather than a point. */
  round: number;
  /** A pram bow: the planking ends at a small board this wide, as a fraction of the beam, instead of a stem. */
  bow: number;
  /** The transom's width, as a fraction of the beam. */
  transom: number;
  /** The top of the planking `u` of the way from transom (0) to stem (1). */
  gunwale: (u: number) => number;
  /** How much wider the hull is at the gunwale than at the turn of the bilge. */
  flare: number;
  /** How round the bottom is: 0.7 is the shell's own boxy U, 1 an ellipse. */
  section: number;
  /** How far the keel lifts toward the transom, so the stern sweeps up clear of the water. */
  rocker: number;
  /** The keel's height along the hull, where it is not the shell's own. */
  keel?: (u: number) => number;
  /** How far the stem swells forward and the transom aft between the keel and the gunwale. */
  rake: { bow: number; stern: number };
  /** Where the child sits: the thwart's height. */
  seat: number;
  strakes: number;
  /** The concept's finish: honey planking, a cream strake hung with rope, a stout dark mast. */
  concept: boolean;
  /** A white post at the stem carrying a lantern. */
  lantern: boolean;
}

/** A sheer that sweeps up from its lowest point `low` of the way along to `stern` and `bow` at the ends. */
const sweep = (mid: number, stern: number, bow: number, low: number, bend = 2) => (u: number) =>
  mid + (u < low ? (stern - mid) * ((low - u) / low) ** bend : (bow - mid) * ((u - low) / (1 - low)) ** bend);

/**
 * A keel that runs level at `depth` and curves up only near the ends: to `bow` at the stem, `stern` at the
 * transom. `lift` 0 turns up to meet an upright stem; above 0 it sweeps up at that power to meet a pram's board.
 */
const flatKeel = (depth: number, bow: number, stern: number, bowFrom = 0.8, lift = 0, sternTo = 0.16) => (u: number) => {
  if (u > bowFrom) {
    const v = (u - bowFrom) / (1 - bowFrom);
    return depth + (bow - depth) * (lift ? v ** lift : 1 - Math.sqrt(1 - v * v));
  }
  return u < sternTo ? depth + (stern - depth) * (1 - u / sternTo) ** 2 : depth;
};

const firstSpring = { stern: 0.13, sternTo: 0.42, bow: 0.05, bowFrom: 0.75 };
const FORMS: Record<string, Form> = {
  first: {
    length: 4.8, beam: 0.95, fullness: 3.2, round: 1, bow: 0, transom: 0.7, flare: 0, section: 0.7, rocker: 0, rake: { bow: 0, stern: 0 },
    seat: 0.02, strakes: 8, concept: false, lantern: false,
    gunwale: (u) => SHELL.sheer * u * u + firstSpring.stern * Math.max(0, 1 - u / firstSpring.sternTo) ** 2
      + firstSpring.bow * THREE.MathUtils.smoothstep(u, firstSpring.bowFrom, 1),
  },
  /** Sides raised to the seated child's waist; the seat, length and beam as they were. */
  waist: {
    length: 4.8, beam: 1.02, fullness: 3.6, round: 1, bow: 0, transom: 0.5, flare: 0.08, section: 0.7, rocker: 0, rake: { bow: 0.2, stern: 0.2 },
    seat: 0.02, strakes: 10, concept: true, lantern: false,
    gunwale: sweep(0.62, 1.0, 1.3, 0.42, 2.2),
  },
  /**
   * A little smaller than waist-deep, round and flat-bottomed, wide planks, a white post and lantern at the stem,
   * the sheer only lifting a little toward the ends.
   */
  cute: {
    length: 4.4, beam: 1.0, fullness: 3.4, round: 0.72, bow: 0, transom: 0.52, flare: 0.07, section: 0.62, rocker: 0,
    keel: flatKeel(-0.46, -0.12, -0.39), rake: { bow: 0.1, stern: 0.14 }, seat: 0.02, strakes: 6, concept: true, lantern: true,
    gunwale: sweep(0.5, 0.68, 0.76, 0.48, 2.2),
  },
  /** The same boat with the concept's blunt pram bow: a small board across the bow, the white post against it. */
  pram: {
    length: 4.3, beam: 1.02, fullness: 2.6, round: 0.8, bow: 0.4, transom: 0.55, flare: 0.07, section: 0.62, rocker: 0,
    keel: flatKeel(-0.46, -0.17, -0.39, 0.66, 1.7), rake: { bow: 0.1, stern: 0.14 }, seat: 0.02, strakes: 6, concept: true, lantern: true,
    gunwale: sweep(0.5, 0.68, 0.74, 0.48, 2.2),
  },
};
const FORM = FORMS[typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('hull') ?? ''] ?? FORMS.first;

export const LENGTH = FORM.length;
export const BEAM = FORM.beam;
export const DEPTH = SHELL.depth;
export const STRAKES = FORM.strakes;
export const CONCEPT = FORM.concept;
export const LANTERN = FORM.lantern;
export const SECTION = FORM.section;
export const PRAM = FORM.bow > 0;
/** Floorboards, laid across the ribs. They sit above the waterline, so the sea is never seen inside the hull. */
export const FLOOR_Y = -0.24;
/** How deep the hull floats: local y 0 rides this far above the sea, putting the waterline below the floorboards. */
export const DRAFT = 0.42;
export const SEAT_Y = FORM.seat;
export const STERN_Z = -0.45 * LENGTH;
export const BOW_Z = 0.55 * LENGTH;
/** The mast stands this far forward of the hull's origin; the sail swings about it. */
export const MAST_Z = 0.55;

/** Half-width of the hull at the turn of the bilge `u` of the way from transom (0) to stem (1). */
export const halfWidth = (u: number) =>
  BEAM * (1 - (1 - FORM.bow) * Math.pow(u, FORM.fullness)) ** FORM.round
  * (FORM.transom + (1 - FORM.transom) * Math.sin((PRAM ? Math.min(u, 0.5) : u) * Math.PI));
export const sheer = (u: number) => SHELL.sheer * u * u;
/** How far the keel lies below the turn of the bilge: shallowest at the stem, lifting toward the transom. */
export const keelDrop = (u: number) => FORM.keel
  ? sheer(u) - FORM.keel(u)
  : DEPTH * (0.8 + 0.2 * Math.sin(u * Math.PI)) * (1 - 0.5 * u * u) * (1 - FORM.rocker * (1 - u) ** 3);
export const keel = (u: number) => sheer(u) - keelDrop(u);
/** The top of the planking, where the gunwale rail runs. */
export const gunwale = (u: number) => Math.max(FORM.gunwale(u), sheer(u));
/** How much the topsides swell out above the turn of the bilge: most amidships, none at the transom or the stem. */
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
 * The ends swell out between the keel and the gunwale, the stem forward and the transom aft, so the hull's
 * profile is round at both ends. Above the gunwale they stand upright. Only the drawn hull changes; the shell it
 * rests on does not.
 */
export function rake(p: THREE.Vector3): THREE.Vector3 {
  const u = stationU(p.z);
  const s = THREE.MathUtils.clamp((p.y - keel(u)) / Math.max(gunwale(u) - keel(u), 1e-3), 0, 1);
  const lean = FORM.rake.bow * THREE.MathUtils.smoothstep(u, 0.72, 1) - FORM.rake.stern * (1 - THREE.MathUtils.smoothstep(u, 0, 0.32));
  p.z += lean * (1 - (1 - s) ** 2);
  return p;
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

/** Where the floorboards meet the inside of the hull at station `u`: their height and half-width there. */
export function floorAt(u: number): { y: number; half: number } {
  // At the narrow bow the hull rises above the main floor level. Follow it inside.
  const y = Math.max(FLOOR_Y, keel(u) + 0.02);
  const drop = (sheer(u) - y) / keelDrop(u);
  const sin = Math.min(1, Math.max(0, drop)) ** (1 / SECTION);
  return { y, half: halfWidth(u) * Math.sqrt(Math.max(0, 1 - sin * sin)) };
}

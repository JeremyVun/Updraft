import * as THREE from 'three';

export const LENGTH = 4.4;
export const BEAM = 1.0;
/** Clinker strakes a side, keel to gunwale: few and wide. */
export const STRAKES = 6;
/** How round the bottom is across: a flattish floor turning up round the bilge (1 would be an ellipse). */
export const SECTION = 0.62;
/** Floorboards, laid across the ribs. They sit above the waterline, so the sea is never seen inside the hull. */
export const FLOOR_Y = -0.24;
/** How deep the hull floats: local y 0 rides this far above the sea, putting the waterline below the floorboards. */
export const DRAFT = 0.42;
/** Where the child sits: the thwart's height, with the gunwale about at their belly. */
export const SEAT_Y = 0.02;
export const STERN_Z = -0.45 * LENGTH;
export const BOW_Z = 0.55 * LENGTH;
/** The mast stands this far forward of the hull's origin; the sail swings about it. */
export const MAST_Z = 0.55;

/** How far the topsides swell out above the turn of the bilge, and how far the stem and transom lean out. */
const FLARE = 0.07;
const RAKE = { bow: 0.1, stern: 0.14 };

/**
 * Half-width of the hull at the turn of the bilge `u` of the way from transom (0) to stem (1): full through the
 * middle, closing to the stem in a rounded curve and narrowing to the transom.
 */
export const halfWidth = (u: number) => BEAM * (1 - u ** 3.4) ** 0.72 * (0.52 + 0.48 * Math.sin(u * Math.PI));
/** The height of the turn of the bilge, where the bottom turns up into the topsides. */
export const bilge = (u: number) => 0.28 * u * u;
/**
 * The keel runs level just below the waterline for most of the length, turns up in a short forefoot at the stem
 * and only just touches the water at the transom, so the boat sits flat in the sea.
 */
export function keel(u: number): number {
  const level = -0.46;
  if (u > 0.8) return level + 0.34 * (1 - Math.sqrt(1 - ((u - 0.8) / 0.2) ** 2));
  return u < 0.16 ? level + 0.07 * (1 - u / 0.16) ** 2 : level;
}
export const keelDrop = (u: number) => bilge(u) - keel(u);
/** The top of the planking, where the gunwale rail runs: low amidships, lifting only a little toward the ends. */
export function gunwale(u: number): number {
  const low = 0.48;
  return 0.5 + (u < low ? 0.18 * ((low - u) / low) ** 2.2 : 0.26 * ((u - low) / (1 - low)) ** 2.2);
}
/** How much the topsides swell out above the turn of the bilge: most amidships, none at the transom or the stem. */
export const flare = (u: number) => FLARE * Math.sin(u * Math.PI) ** 0.6;
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
export const SAIL_TACK = gunwale(stationU(MAST_Z)) + 0.28;
/** The masthead, above the sail's head, where the pennant flies. */
export const MAST_TOP = SAIL_TACK + 4.2;
/** The boom reaches a little past the clew of a full sail. */
export const BOOM_LENGTH = 2.8;

/**
 * The ends swell out between the keel and the gunwale, the stem forward and the transom aft, so the hull's
 * profile is round at both ends. Above the gunwale they stand upright.
 */
export function rake(p: THREE.Vector3): THREE.Vector3 {
  const u = stationU(p.z);
  const s = THREE.MathUtils.clamp((p.y - keel(u)) / Math.max(gunwale(u) - keel(u), 1e-3), 0, 1);
  const lean = RAKE.bow * THREE.MathUtils.smoothstep(u, 0.72, 1) - RAKE.stern * (1 - THREE.MathUtils.smoothstep(u, 0, 0.32));
  p.z += lean * (1 - (1 - s) ** 2);
  return p;
}

/**
 * The bottom of the hull, up to the turn of the bilge, and a point in the middle of the transom. Its vertices are
 * the boat's contacts with the ground, so it is the same bottom that is drawn.
 */
export function contactShell(): THREE.BufferGeometry {
  const U = 18;
  const T = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (let j = 0; j <= T; j++) {
      const th = (j / T) * Math.PI;
      rake(p.set(halfWidth(u) * Math.cos(th), bilge(u) - keelDrop(u) * Math.sin(th) ** SECTION, stationZ(u)));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < T; j++) {
      const a = i * (T + 1) + j;
      const b = a + T + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const centre = pos.length / 3;
  rake(p.set(0, keel(0) * 0.45, STERN_Z));
  pos.push(p.x, p.y, p.z);
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
  const drop = (bilge(u) - y) / keelDrop(u);
  const sin = Math.min(1, Math.max(0, drop)) ** (1 / SECTION);
  return { y, half: halfWidth(u) * Math.sqrt(Math.max(0, 1 - sin * sin)) };
}

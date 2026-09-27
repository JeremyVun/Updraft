import * as THREE from 'three';

export const LENGTH = 4.8;
export const BEAM = 0.95;
export const DEPTH = 0.62;
/** Floorboards, laid across the ribs. They sit above the waterline, so the sea is never seen inside the hull. */
export const FLOOR_Y = -0.24;
/** How deep the hull floats: local y 0 rides this far above the sea, putting the waterline below the floorboards. */
export const DRAFT = 0.42;
export const STERN_Z = -0.45 * LENGTH;
export const BOW_Z = 0.55 * LENGTH;
/** The mast stands this far forward of the hull's origin; the sail swings about it. */
export const MAST_Z = 0.55;
/** The masthead, above the sail's head, where the pennant flies. */
export const MAST_TOP = 4.95;

/**
 * How the sail is cut: the foot from mast to clew, the luff from tack to head, how far it narrows toward the
 * head, how far the foot rises to the clew and how high the tack sits. The shader cuts the same cloth from these
 * numbers, so the mesh only has to carry the uv and a shape to be measured for.
 */
export const SAIL_SPAN = 2.7;
export const SAIL_HOIST = 3.7;
export const SAIL_TAPER = 0.55;
export const SAIL_RISE = 0.35;
export const SAIL_TACK = 0.75;
/** The boom reaches a little past the clew of a full sail. */
export const BOOM_LENGTH = 2.8;

/** Half-width, depth and sheer of the hull `u` of the way from transom (0) to stem (1). */
export const halfWidth = (u: number) => BEAM * (1 - Math.pow(u, 3.2)) * (0.7 + 0.3 * Math.sin(u * Math.PI));
export const hullDepth = (u: number) => DEPTH * (0.8 + 0.2 * Math.sin(u * Math.PI));
export const sheer = (u: number) => 0.28 * u * u;
/**
 * The planking stands this far above the shell the hull rests on, so the gunwale sweeps up to the transom and
 * the stem instead of running level off the stern. Nothing changes where the child sits or steps aboard.
 */
export const spring = (u: number) => 0.13 * Math.max(0, 1 - u / 0.42) ** 2 + 0.05 * THREE.MathUtils.smoothstep(u, 0.75, 1);
/** The top of the planking, where the gunwale rail runs. */
export const gunwale = (u: number) => sheer(u) + spring(u);
export const stationZ = (u: number) => (u - 0.45) * LENGTH;
export const stationU = (z: number) => THREE.MathUtils.clamp(z / LENGTH + 0.45, 0, 1);

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
  const p = new THREE.Vector3();
  for (let i = 0; i <= U; i++) {
    for (let j = 0; j <= T; j++) {
      shellPoint(i / U, (j / T) * Math.PI, p);
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
  pos.push(0, sheer(0) - hullDepth(0) * 0.45, STERN_Z);
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

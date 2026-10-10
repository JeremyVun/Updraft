import * as THREE from 'three';
import { glsl } from '../../tuning';

export const LENGTH = 4.2;
export const BEAM = 1.0;
/** Clinker strakes a side, keel to gunwale: few and wide. */
export const STRAKES = 6;
/** How round the bottom is across: a flattish floor turning up round the bilge (1 would be an ellipse). */
export const SECTION = 0.62;
/** Floorboards, laid across the ribs. */
export const FLOOR_Y = -0.24;
/**
 * How deep the hull floats: local y 0 rides this far above the sea, the waterline up past the turn of the bilge
 * and over the floorboards. The sea is kept out of the hull by its lid (`waterline.ts`), not by floating high.
 */
export const DRAFT = 0.2;
/** Where the child sits: the thwart's height, with the gunwale about at their belly. */
export const SEAT_Y = 0.02;
export const STERN_Z = -0.45 * LENGTH;
export const BOW_Z = 0.55 * LENGTH;
/** The mast stands this far forward of the hull's origin; the sail swings about it. */
export const MAST_Z = 0.55;

/** How far the topsides swell out above the turn of the bilge. */
const FLARE = 0.07;
/**
 * The forefoot, where the keel sweeps up into the stem: an arc that rises this far from the level keel and turns
 * this far from horizontal, so the stem carries on up at the same lean like a rowing boat's.
 */
const FOREFOOT = { rise: 0.46, turn: THREE.MathUtils.degToRad(65) };
const FOREFOOT_RADIUS = FOREFOOT.rise / (1 - Math.cos(FOREFOOT.turn));
const FOREFOOT_FROM = 1 - (FOREFOOT_RADIUS * Math.sin(FOREFOOT.turn)) / LENGTH;
const KEEL = -0.46;

/**
 * Half-width of the hull at the turn of the bilge `u` of the way from transom (0) to stem (1): full through the
 * middle, closing to the stem in a rounded curve and narrowing to the transom.
 */
export const halfWidth = (u: number) => BEAM * (1 - u ** 3.4) ** 0.72 * (0.52 + 0.48 * Math.sin(u * Math.PI));
/** The height of the turn of the bilge, where the bottom turns up into the topsides. */
export const bilge = (u: number) => 0.28 * u * u;
/**
 * The keel runs level just below the waterline for most of the length, sweeps up round the forefoot to the stem
 * and only just touches the water at the transom, so the boat sits flat in the sea.
 */
export function keel(u: number): number {
  if (u > FOREFOOT_FROM) {
    const z = (u - FOREFOOT_FROM) * LENGTH;
    return KEEL + FOREFOOT_RADIUS - Math.sqrt(FOREFOOT_RADIUS ** 2 - z * z);
  }
  return u < 0.16 ? KEEL + 0.07 * (1 - u / 0.16) ** 2 : KEEL;
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

/** How far the stem head leans out past the foot of the stem, carrying on the forefoot's turn in a straight line. */
const STEM_RAKE = (gunwale(1) - keel(1)) / Math.tan(FOREFOOT.turn);
const TRANSOM_RAKE = 0.14;

/**
 * The ends lean out between the keel and the gunwale: the stem forward in a straight rake, the transom aft in a
 * round swell. Above the gunwale they stand upright.
 */
export function rake(p: THREE.Vector3): THREE.Vector3 {
  const u = stationU(p.z);
  const s = THREE.MathUtils.clamp((p.y - keel(u)) / Math.max(gunwale(u) - keel(u), 1e-3), 0, 1);
  p.z += STEM_RAKE * THREE.MathUtils.smoothstep(u, 0.72, 1) * s
    - TRANSOM_RAKE * (1 - THREE.MathUtils.smoothstep(u, 0, 0.32)) * (1 - (1 - s) ** 2);
  return p;
}

const deckPoint = new THREE.Vector3();
export function foredeckAt(x: number, z: number): number {
  let station = z;
  for (let i = 0; i < 6; i++) {
    const u = stationU(station), across = x / Math.max(0.001, gunwaleHalf(u));
    rake(deckPoint.set(x, gunwale(u) - 0.012 + 0.018 * (1 - across * across), station));
    station += z - deckPoint.z;
  }
  return deckPoint.y;
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

/** The bottom's half-width at station `u` and height `y`, from nothing at the keel to full at the turn of the bilge. */
export function sectionHalf(u: number, y: number): number {
  const drop = (bilge(u) - y) / keelDrop(u);
  const sin = Math.min(1, Math.max(0, drop)) ** (1 / SECTION);
  return halfWidth(u) * Math.sqrt(Math.max(0, 1 - sin * sin));
}

/**
 * `hullHolds(p, margin)`: whether a point in the hull's own frame lies within its planking, or `margin` metres out
 * from it (the section above, raked at the ends, carried straight up past the gunwale), for whatever must keep out of
 * the inside of the boat.
 */
export const HULL_GLSL = /* glsl */ `
float hullKeel(float u) {
  float fore = (u - ${glsl(FOREFOOT_FROM)}) * ${glsl(LENGTH)};
  return u > ${glsl(FOREFOOT_FROM)}
    ? ${glsl(KEEL + FOREFOOT_RADIUS)} - sqrt(max(${glsl(FOREFOOT_RADIUS ** 2)} - fore * fore, 0.0))
    : ${glsl(KEEL)} + (u < 0.16 ? 0.07 * pow(1.0 - u / 0.16, 2.0) : 0.0);
}
float hullGunwale(float u) {
  return 0.5 + (u < 0.48 ? 0.18 * pow((0.48 - u) / 0.48, 2.2) : 0.26 * pow((u - 0.48) / 0.52, 2.2));
}
bool hullHolds(vec3 p, float margin) {
  if (abs(p.x) > ${glsl(BEAM * (1 + FLARE))} + margin || p.y < ${glsl(KEEL)} - margin
    || p.z < ${glsl(STERN_Z - TRANSOM_RAKE)} - margin || p.z > ${glsl(BOW_Z + STEM_RAKE)} + margin) return false;
  // The station whose raked line runs through p.
  float z = p.z;
  for (int i = 0; i < 3; i++) {
    float k = clamp(z / ${glsl(LENGTH)} + 0.45, 0.0, 1.0);
    float keel = hullKeel(k);
    float s = clamp((p.y - keel) / max(hullGunwale(k) - keel, 1e-3), 0.0, 1.0);
    z = p.z - ${glsl(STEM_RAKE)} * smoothstep(0.72, 1.0, k) * s
      + ${glsl(TRANSOM_RAKE)} * (1.0 - smoothstep(0.0, 0.32, k)) * (1.0 - (1.0 - s) * (1.0 - s));
  }
  if (z < ${glsl(STERN_Z)} - margin || z > ${glsl(BOW_Z)} + margin) return false;
  float u = clamp(z / ${glsl(LENGTH)} + 0.45, 0.0, 1.0);
  float keel = hullKeel(u);
  float rim = 0.28 * u * u;
  if (p.y <= keel - margin) return false;
  float w = ${glsl(BEAM)} * pow(max(1.0 - pow(u, 3.4), 0.0), 0.72) * (0.52 + 0.48 * sin(u * 3.14159265));
  if (p.y < rim) {
    float s = pow(clamp((rim - p.y) / (rim - keel), 0.0, 1.0), ${glsl(1 / SECTION)});
    w *= sqrt(max(1.0 - s * s, 0.0));
  } else {
    float t = clamp((p.y - rim) / max(hullGunwale(u) - rim, 1e-3), 0.0, 1.0);
    w *= 1.0 + ${glsl(FLARE)} * pow(sin(u * 3.14159265), 0.6) * t * t * (3.0 - 2.0 * t);
  }
  return abs(p.x) < w + margin;
}
`;

/** Where the floorboards meet the inside of the hull at station `u`: their height and half-width there. */
export function floorAt(u: number): { y: number; half: number } {
  // At the narrow bow the hull rises above the main floor level. Follow it inside.
  const y = Math.max(FLOOR_Y, keel(u) + 0.02);
  return { y, half: sectionHalf(u, y) };
}

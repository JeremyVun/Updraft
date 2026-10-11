import { glsl, tuning } from '../tuning';
import { shaderFbm, smoothstep } from './noise';

/** Shared ground layout; independent of the live curtain actors and their progress. */
export const CURTAIN_LAYOUT = [
  { x: 0, z: -235, width: 9, panels: 1 },
  { x: 25, z: -257, width: 10, panels: 2 },
  { x: 3, z: -308, width: 10.5, panels: 1 },
];
export const FAMILY_PLACE = { x: -32, z: -321 };
export const DOOR_PLACE = { x: -32, z: -329 };
export const ROTARY_PLACE = tuning.rotaryWashing;
const R = ROTARY_PLACE;
export const ROTARY_PATH = [
  { x: R.x, z: R.z + R.standBack },
  { x: R.x + R.pathOffset, z: R.z - 7 },
  { x: R.farX - R.pathOffset, z: R.farZ + 7 },
  { x: R.farX - R.pathOffset, z: R.farZ - R.exitAhead },
  { x: 3, z: -301.5 },
];
// The field follows the masts; clearing around the travellers' detour opens an extra bypass beside each frame.
export const LINES_FIELD_PATH = [
  { x: 12, z: -220 }, { x: 0, z: -230 }, { x: 0, z: -240 },
  { x: 25, z: -251 }, { x: 25, z: -262 },
  { x: R.x + R.pathOffset, z: R.z + R.standBack },
  { x: R.x, z: R.z }, { x: R.farX, z: R.farZ },
  { x: 3, z: -308 }, { x: 3, z: -320 },
  { x: FAMILY_PLACE.x, z: FAMILY_PLACE.z + 4 }, { ...DOOR_PLACE },
];
const CLEARINGS: { x: number; z: number; radius: number; crop?: number }[] = [
  ...CURTAIN_LAYOUT.map(({ x, z }) => ({ x, z, radius: 8 })),
  { x: R.x, z: R.z, radius: 8 },
  { x: R.farX, z: R.farZ, radius: 8 },
  { x: FAMILY_PLACE.x, z: FAMILY_PLACE.z + 2, radius: 9, crop: 0.85 },
  { x: FAMILY_PLACE.x + 1, z: FAMILY_PLACE.z + 14, radius: 9, crop: 0.9 },
  ...[-1.7, 1.5].map(dx => ({ x: FAMILY_PLACE.x + dx, z: FAMILY_PLACE.z + 4.3, radius: 2.5, crop: 0.96 })),
  { ...DOOR_PLACE, radius: 12 },
];
const BOUNDS = {
  left: Math.min(...CLEARINGS.map(p => p.x - p.radius * 1.4)),
  right: Math.max(...CLEARINGS.map(p => p.x + p.radius * 1.4)),
  near: Math.max(...CLEARINGS.map(p => p.z + p.radius * 1.4)),
  far: Math.min(...CLEARINGS.map(p => p.z - p.radius * 1.4)),
};

/** Worn ground stays worn after the travellers leave; advancing a puzzle cannot move it. */
export function linesGrassCrop(x: number, z: number): number {
  if (x < BOUNDS.left || x > BOUNDS.right || z < BOUNDS.far || z > BOUNDS.near) return 1;
  let crop = 1;
  for (const p of CLEARINGS) {
    const dx = x - p.x, dz = z - p.z;
    if (Math.hypot(dx, dz) > p.radius * 1.4) continue;
    const r = Math.hypot(dx, dz) / p.radius * (0.78 + 0.5 * shaderFbm(dx * 0.22, dz * 0.22));
    crop = Math.min(crop, 1 - (p.crop ?? 0.6) * (1 - smoothstep(0.1, 1.05, r)));
  }
  return crop;
}

/** Same fixed, noise-edged patches in both grass render paths and CPU height queries. */
export const LINES_GRASS_GLSL = /* glsl */ `
float linesGrassCrop(vec2 xz) {
  if (xz.x < ${glsl(BOUNDS.left)} || xz.x > ${glsl(BOUNDS.right)} || xz.y < ${glsl(BOUNDS.far)} || xz.y > ${glsl(BOUNDS.near)}) return 1.0;
  float crop = 1.0;
  vec2 d;
  float r;
  ${CLEARINGS.map(p => `
  d = xz - vec2(${glsl(p.x)}, ${glsl(p.z)});
  if (length(d) < ${glsl(p.radius * 1.4)}) {
    r = length(d) / ${glsl(p.radius)} * (0.78 + 0.5 * fbm(d * 0.22));
    crop = min(crop, 1.0 - ${glsl(p.crop ?? 0.6)} * (1.0 - smoothstep(0.1, 1.05, r)));
  }`).join('')}
  return crop;
}
`;

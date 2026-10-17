import { glsl, tuning } from '../tuning';
import { shaderFbm, smoothstep } from './noise';

/** Shared ground layout; independent of the live curtain actors and their progress. */
export const CURTAIN_LAYOUT = [
  { x: 0, z: -235, width: 9, panels: 1 },
  { x: 25, z: -257, width: 10, panels: 2 },
  { x: 3, z: -316, width: 10.5, panels: 1 },
];
export const FAMILY_PLACE = { x: 14, z: -353 };
export const DOOR_PLACE = { x: 14, z: -361 };
export const FAMILY_APPROACH = { x: 14, z: -340 };
export const ROTARY_PLACE = tuning.rotaryWashing;
const R = ROTARY_PLACE;
export const ROTARY_INSIDE_PLACE = { x: R.x + R.insideSide, z: R.z - R.insideAhead };
export const ROTARY_PATH = [
  { x: R.x, z: R.z + R.standBack },
  { x: R.x + R.pathOffset, z: R.z - 7 },
  { x: R.farX - R.pathOffset, z: R.farZ + 7 },
  { x: R.farX - R.pathOffset, z: R.farZ - R.exitAhead },
  { x: 3, z: -309.5 },
];
// The field follows the masts; clearing around the travellers' detour opens an extra bypass beside each frame.
export const LINES_FIELD_PATH = [
  { x: 12, z: -220 }, { x: 0, z: -230 }, { x: 0, z: -240 },
  { x: 25, z: -251 }, { x: 25, z: -262 },
  { x: R.x + R.pathOffset, z: R.z + R.standBack },
  { x: R.x, z: R.z }, { x: R.farX, z: R.farZ },
  { x: 3, z: -316 }, { ...FAMILY_APPROACH },
  { x: FAMILY_PLACE.x, z: FAMILY_PLACE.z + 4 }, { ...DOOR_PLACE },
];
const CLEARINGS: { x: number; z: number; radius: number; crop?: number }[] = [
  ...CURTAIN_LAYOUT.map(({ x, z }) => ({ x, z, radius: 8, crop: 0.85 })),
  ...CURTAIN_LAYOUT.map(({ x, z }, i) => ({ x: x + (i === 0 ? 1.7 : i === 1 ? -0.7 : -1.6), z: z + 4.7, radius: 3.7, crop: 0.94 })),
  { x: R.x, z: R.z, radius: 8 },
  { ...ROTARY_INSIDE_PLACE, radius: 3.8, crop: 0.9 },
  { x: R.farX, z: R.farZ, radius: 8 },
  { x: R.x + 0.7, z: R.z + R.standBack, radius: 5.5, crop: 0.94 },
  { x: FAMILY_PLACE.x, z: FAMILY_PLACE.z + 2, radius: 9, crop: 0.85 },
  { x: FAMILY_PLACE.x + 1, z: FAMILY_PLACE.z + 14, radius: 9, crop: 0.9 },
  { x: FAMILY_PLACE.x, z: FAMILY_PLACE.z + 8, radius: 8, crop: 0.96 },
  ...[-1.7, 1.5].map(dx => ({ x: FAMILY_PLACE.x + dx, z: FAMILY_PLACE.z + 4.3, radius: 2.5, crop: 0.96 })),
  { ...DOOR_PLACE, radius: 12 },
];
const walks = [
  [{ x: 12, z: -220 }, { x: 1.7, z: -230.3 }],
  [{ x: 3.7, z: -240 }, { x: 24.3, z: -252.3 }],
  [{ x: 25.5, z: -261.5 }, ROTARY_PATH[0]],
  ROTARY_PATH,
  [{ x: CURTAIN_LAYOUT[2].x + 1.2, z: CURTAIN_LAYOUT[2].z - 4.5 }, FAMILY_APPROACH,
    { x: FAMILY_PLACE.x - 1.7, z: FAMILY_PLACE.z + 4.3 }],
];
for (const walk of walks) for (let i = 1; i < walk.length; i++) {
  const a = walk[i - 1], b = walk[i], steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4);
  for (let j = 0; j <= steps; j++) {
    const t = j / steps;
    CLEARINGS.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
      radius: (walk === ROTARY_PATH ? R.rotaryRadius : R.approachRadius) + Math.sin(j * 2.3 + i) * 0.6,
      crop: walk === ROTARY_PATH ? R.rotaryCrop : R.approachCrop });
  }
}
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

/** How many clearings the shader walks; `uLinesClearings` in `gl/loops.ts` bounds its loop. */
export const LINES_CLEARINGS = CLEARINGS.length;

/**
 * Same fixed, noise-edged patches in both grass render paths and CPU height queries. A table walked by a
 * uniform-bounded loop: unrolled, every clearing's fbm was inlined and the grass table's first draw cost seconds on D3D11.
 */
export const LINES_GRASS_GLSL = /* glsl */ `
uniform int uLinesClearings;
const vec4 LINES_CLEARING_AT[${LINES_CLEARINGS}] = vec4[](${CLEARINGS.map(p =>
  `vec4(${glsl(p.x)}, ${glsl(p.z)}, ${glsl(p.radius * 1.4)}, ${glsl(p.radius)})`).join(', ')});
const float LINES_CLEARING_CROP[${LINES_CLEARINGS}] = float[](${CLEARINGS.map(p => glsl(p.crop ?? 0.6)).join(', ')});
float linesGrassCrop(vec2 xz) {
  if (xz.x < ${glsl(BOUNDS.left)} || xz.x > ${glsl(BOUNDS.right)} || xz.y < ${glsl(BOUNDS.far)} || xz.y > ${glsl(BOUNDS.near)}) return 1.0;
  float crop = 1.0;
  for (int i = 0; i < uLinesClearings; i++) {
    vec4 p = LINES_CLEARING_AT[i];
    vec2 d = xz - p.xy;
    if (length(d) < p.z) {
      float r = length(d) / p.w * (0.78 + 0.5 * fbm(d * 0.22));
      crop = min(crop, 1.0 - LINES_CLEARING_CROP[i] * (1.0 - smoothstep(0.1, 1.05, r)));
    }
  }
  return crop;
}
`;

import { glsl } from '../../tuning';

/**
 * The long swell: the only part of the sea that is real geometry. Everything finer than these waves is a normal
 * on a flat surface, because at the distance it is seen from, shape below this scale does not read.
 *
 * Direction (unit), wavelength in world units, and share of the swell's height. The shortest wave is kept well
 * above the water mesh's spacing near the camera, or the surface would alias as it moves.
 */
const WAVES = [
  { dx: 0.94, dz: 0.34, len: 57, amp: 0.44 },
  { dx: 0.64, dz: -0.77, len: 34, amp: 0.27 },
  { dx: 0.99, dz: -0.15, len: 21, amp: 0.18 },
  { dx: 0.33, dz: 0.94, len: 14, amp: 0.11 },
];

/** How far the water is dragged toward each crest as a share of the lift: sharper crests, flatter troughs. */
const STEEP = 1.2;
const GRAVITY = 9.8;

/** Deep-water waves of this length travel at this speed, which is what makes a long swell outrun a short one. */
const speed = (len: number) => Math.sqrt((GRAVITY * len) / (2 * Math.PI));

export const swellUniforms = {
  /** Height of the swell from trough to crest in world units, 0 for a flat sea. */
  uSwell: { value: 0 },
};

const wave = (w: (typeof WAVES)[number]) => /* glsl */ `
  {
    float ph = ${glsl((2 * Math.PI) / w.len)} * dot(vec2(${glsl(w.dx)}, ${glsl(w.dz)}), p) - ${glsl((speed(w.len) * 2 * Math.PI) / w.len)} * uTime;
    drag += vec2(${glsl(w.dx)}, ${glsl(w.dz)}) * (${glsl(w.amp * STEEP)} * height * cos(ph));
    lift += ${glsl(w.amp)} * height * sin(ph);
  }`;

/** Needs ATMO_GLSL first, in whichever stage uses it. */
export const SWELL_GLSL = /* glsl */ `
uniform float uSwell;

/** Where the swell carries the water that would lie at p: sideways in xz, and up in y. */
vec3 swellShift(vec2 p, float height) {
  vec2 drag = vec2(0.0);
  float lift = 0.0;
  ${WAVES.map(wave).join('')}
  return vec3(drag.x, lift, drag.y);
}

/**
 * How much swell there is at p: none where the water is too shallow to hold it, and none far from the camera,
 * where the mesh is too coarse to carry a wave and the ripple normals do the work instead.
 */
float swellHeight(vec2 p, float fromCamera) {
  vec2 uv = domainUv(p);
  vec2 edge = min(uv, 1.0 - uv);
  float inside = smoothstep(0.0, 0.04, min(edge.x, edge.y));
  float depth = -mix(-12.0, texture(uHeightTex, clamp(uv, 0.0, 1.0)).r, inside);
  return uSwell * smoothstep(0.6, 4.5, depth) * smoothstep(105.0, 62.0, fromCamera);
}
`;

export interface Swell {
  /** Lift of the water surface above y = 0. */
  height: number;
  /** Surface tilt, as the rise per unit along world x and z. */
  slopeX: number;
  slopeZ: number;
}

interface Shift {
  x: number;
  y: number;
  z: number;
}
const at: Shift = { x: 0, y: 0, z: 0 };
const along: Shift = { x: 0, y: 0, z: 0 };
const across: Shift = { x: 0, y: 0, z: 0 };

/** `swellShift` again, in the same waves and the same order, for the CPU side of the sea. */
function shift(ux: number, uz: number, time: number, out: Shift): Shift {
  const height = swellUniforms.uSwell.value;
  out.x = 0;
  out.y = 0;
  out.z = 0;
  for (const w of WAVES) {
    const ph = ((2 * Math.PI) / w.len) * (w.dx * ux + w.dz * uz) - ((speed(w.len) * 2 * Math.PI) / w.len) * time;
    const drag = Math.cos(ph) * w.amp * STEEP * height;
    out.x += w.dx * drag;
    out.z += w.dz * drag;
    out.y += w.amp * height * Math.sin(ph);
  }
  return out;
}

/** Just how high the water is at a point, for the many small things that ride it without lying along it. */
export function swellLift(x: number, z: number, time: number): number {
  let ux = x;
  let uz = z;
  for (let i = 0; i < 3; i++) {
    shift(ux, uz, time, at);
    ux = x - at.x;
    uz = z - at.z;
  }
  return shift(ux, uz, time, at).y;
}

/**
 * The swell under a point, for anything that floats on it. Shallow water and the distance fade are the mesh's
 * business, so this is the open-sea swell: callers floating near a beach are already aground.
 */
export function swellAt(x: number, z: number, time: number, out: Swell): Swell {
  /** The water at (x, z) started somewhere upwave of it, so undo the drag before asking how high it is. */
  let ux = x;
  let uz = z;
  for (let i = 0; i < 3; i++) {
    shift(ux, uz, time, at);
    ux = x - at.x;
    uz = z - at.z;
  }
  const e = 1.5;
  shift(ux, uz, time, at);
  shift(ux + e, uz, time, along);
  shift(ux, uz + e, time, across);
  const ax = e + along.x - at.x;
  const ay = along.y - at.y;
  const az = along.z - at.z;
  const bx = across.x - at.x;
  const by = across.y - at.y;
  const bz = e + across.z - at.z;
  const ny = bz * ax - bx * az;
  out.height = at.y;
  out.slopeX = -(by * az - bz * ay) / ny;
  out.slopeZ = -(bx * ay - by * ax) / ny;
  return out;
}

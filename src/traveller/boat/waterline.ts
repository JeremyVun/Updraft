import * as THREE from 'three';
import { glsl } from '../../tuning';
import { DRAFT, gunwale, gunwaleHalf, rake, sectionHalf, stationZ } from './form';

/** Stations along the waterline, stern to stem, for the sea to find the hull's edge by. */
const STATIONS = 32;

/** The hull's outline where it meets a calm sea: its half-width at even steps from the aftmost wet point to the foremost. */
function outline(): { from: number; to: number; half: number[] } {
  const p = new THREE.Vector3();
  const traced: { z: number; half: number }[] = [];
  for (let i = 0; i <= 128; i++) {
    const u = i / 128;
    const half = sectionHalf(u, -DRAFT);
    if (half > 0 || traced.length) traced.push({ z: rake(p.set(half, -DRAFT, stationZ(u))).z, half });
  }
  while (traced.length > 1 && traced[traced.length - 2].half === 0) traced.pop();
  const from = traced[0].z;
  const to = traced[traced.length - 1].z;
  const half: number[] = [];
  for (let i = 0, k = 0; i <= STATIONS; i++) {
    const z = from + ((to - from) * i) / STATIONS;
    while (k < traced.length - 2 && traced[k + 1].z < z) k++;
    const a = traced[k], b = traced[k + 1];
    half.push(THREE.MathUtils.lerp(a.half, b.half, THREE.MathUtils.clamp((z - a.z) / (b.z - a.z), 0, 1)));
  }
  return { from, to, half };
}
const WATERLINE = outline();

export const waterlineUniforms = {
  /** Where the hull floats: xz, then the way its bow points as (sin, cos) of its heading. */
  uHullAt: { value: new THREE.Vector4(0, 0, 0, 1) },
  /**
   * How much the sea breaks round the hull (1 afloat, 0 not), its speed through the water, and how much the sea
   * marks the hull where they meet (1 anywhere near the sea, 0 up in the clouds).
   */
  uHullWet: { value: new THREE.Vector3() },
};

/** Needs ATMO_GLSL first. */
export const WATERLINE_GLSL = /* glsl */ `
uniform vec4 uHullAt;
uniform vec3 uHullWet;
const float WATERLINE_HALF[${STATIONS + 1}] = float[](${WATERLINE.half.map(glsl).join(', ')});

/** How far outside the hull's waterline a point of the sea lies (negative under the hull), and how far toward the bow. */
vec2 hullWaterline(vec2 xz) {
  vec2 d = xz - uHullAt.xy;
  float along = dot(d, uHullAt.zw);
  float across = abs(dot(d, vec2(uHullAt.w, -uHullAt.z)));
  float t = (along - ${glsl(WATERLINE.from)}) / ${glsl(WATERLINE.to - WATERLINE.from)};
  float x = clamp(t, 0.0, 1.0) * ${glsl(STATIONS)};
  int i = min(int(x), ${STATIONS - 1});
  float side = across - mix(WATERLINE_HALF[i], WATERLINE_HALF[i + 1], x - float(i));
  float end = max(${glsl(WATERLINE.from)} - along, along - ${glsl(WATERLINE.to)});
  return vec2(end > 0.0 ? length(vec2(max(side, 0.0), end)) : max(side, end), t);
}
`;

/** The stencil bit the hull's opening marks, so the sea and what floats on it are not drawn inside the boat. */
const INSIDE_HULL = 1;

/**
 * A lid over the hull's opening, drawn only into the stencil before the sea: any line of sight through it goes
 * down into the hull, so the sea is never seen there however deep the boat floats.
 */
export function hullLid(): THREE.Mesh {
  const U = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (const side of [-1, 1]) {
      rake(p.set(side * gunwaleHalf(u), gunwale(u), stationZ(u)));
      pos.push(p.x, p.y, p.z);
    }
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const lid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    colorWrite: false,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: INSIDE_HULL,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  }));
  lid.renderOrder = -1;
  return lid;
}

/** Keeps a material off the pixels where the hull's lid showed. */
export function outsideHull(material: THREE.Material): void {
  material.stencilWrite = true;
  material.stencilWriteMask = 0;
  material.stencilRef = INSIDE_HULL;
  material.stencilFunc = THREE.NotEqualStencilFunc;
}

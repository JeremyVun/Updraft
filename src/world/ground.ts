import * as THREE from 'three';
import { glsl, tuning } from '../tuning';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { Readback } from '../gl/readback';
import { atmo } from './atmosphere';
import { HEIGHTFIELD_GLSL } from './heightfield';
import { setHeightGrid } from './island';
import { WINDOW } from './window';

const RES = 512;
const SURFACE_RES = 256;
const MAX_OCCLUDERS = 24;
const MAX_SHAPES = 64;

/** Heights over the window plus a one-texel margin all round: texel (i, j) is output texel (i - 1, j - 1). */
const HEIGHT_FRAG = /* glsl */ `
${HEIGHTFIELD_GLSL}
uniform vec4 uDomain;
void main() {
  vec2 uv = (gl_FragCoord.xy - 1.0) / ${RES}.0;
  gl_FragColor = vec4(worldHeight(uv / uDomain.zw + uDomain.xy), 0.0, 0.0, 1.0);
}`;

const NORMAL_FRAG = /* glsl */ `
uniform sampler2D uHeights;
uniform vec4 uDomain;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy) + 1;
  float e = 1.0 / (uDomain.z * ${RES}.0);
  float h = texelFetch(uHeights, c, 0).r;
  float hl = texelFetch(uHeights, c - ivec2(1, 0), 0).r;
  float hr = texelFetch(uHeights, c + ivec2(1, 0), 0).r;
  float hb = texelFetch(uHeights, c - ivec2(0, 1), 0).r;
  float ht = texelFetch(uHeights, c + ivec2(0, 1), 0).r;
  gl_FragColor = vec4(h, normalize(vec3(hl - hr, 2.0 * e, hb - ht)));
}`;

/** Soft sun visibility marched over the terrain; the hills and the tree canopies cast long low-sun shadows. */
const GROUND_FRAG = /* glsl */ `
${HEIGHTFIELD_GLSL}
uniform sampler2D uHeightTex;
uniform vec3 uSunDir;
uniform float uStormCover;
uniform vec4 uDomain;
uniform int uOccluderCount;
uniform vec4 uOccluders[${MAX_OCCLUDERS}];
in vec2 vUv;

float heightAt(vec2 p) {
  vec2 uv = (p - uDomain.xy) * uDomain.zw;
  if (all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) return texture(uHeightTex, uv).r;
  return worldHeight(p);
}

void main() {
  vec2 world = vUv / uDomain.zw + uDomain.xy;
  vec4 hn = texture(uHeightTex, vUv);
  // Full storm cloud scatters the remaining light: no directional terrain shadow to march.
  if (uStormCover >= ${glsl(tuning.storm.shadowCovered)}) {
    gl_FragColor = vec4(hn.gba * 0.5 + 0.5, 1.0);
    return;
  }
  float h0 = max(hn.r, 0.0) + 0.6;
  vec2 dir = normalize(uSunDir.xz);
  float rise = uSunDir.y / length(uSunDir.xz);
  float vis = 1.0;
  float d = 0.8;
  for (int i = 0; i < 64; i++) {
    float gap = h0 + d * rise - max(heightAt(world + dir * d), 0.0);
    vis = min(vis, clamp(gap / (0.6 + d * 0.07), 0.0, 1.0));
    if (vis <= 0.0 || d > 190.0) break;
    d += 0.7 + d * 0.045;
  }

  vec3 origin = vec3(world.x, h0 + 0.4, world.y);
  for (int i = 0; i < ${MAX_OCCLUDERS}; i++) {
    if (i >= uOccluderCount) break;
    vec3 c = uOccluders[i].xyz;
    float r = uOccluders[i].w;
    float t = dot(c - origin, uSunDir);
    if (t <= 0.0 || r <= 0.0) continue;
    float miss = length(c - (origin + uSunDir * t));
    vis *= 1.0 - 0.8 * (1.0 - smoothstep(r * 0.55, r * 1.05, miss));
  }
  gl_FragColor = vec4(hn.gba * 0.5 + 0.5, vis);
}`;

const SURFACE_FRAG = /* glsl */ `
uniform vec4 uDomain;
uniform int uClearCount;
uniform vec4 uClear[${MAX_SHAPES}];
uniform int uFlowerCount;
uniform vec4 uFlowers[${MAX_SHAPES}];
in vec2 vUv;
void main() {
  vec2 p = vUv / uDomain.zw + uDomain.xy;
  float open = 1.0;
  for (int i = 0; i < ${MAX_SHAPES}; i++) {
    if (i >= uClearCount) break;
    open = min(open, smoothstep(0.8, 1.05, length(p - uClear[i].xy) / uClear[i].z));
  }
  float flowers = 0.0;
  for (int i = 0; i < ${MAX_SHAPES}; i++) {
    if (i >= uFlowerCount) break;
    flowers = max(flowers, 1.0 - smoothstep(0.25, 1.0, length(p - uFlowers[i].xy) / uFlowers[i].z));
  }
  gl_FragColor = vec4(open, 0.0, flowers, 0.0);
}`;

export interface Circle {
  x: number;
  z: number;
  radius: number;
}

export interface BakeInputs {
  /** Spheres (tree canopy clusters) that shade the ground. */
  occluders: { centre: THREE.Vector3; radius: number }[];
  /** Footprints where grass does not grow: rocks, trunks. */
  clearings: Circle[];
  flowers: Circle[];
}

function nearest<T>(items: T[], at: (t: T) => [number, number], max: number): T[] {
  const cx = WINDOW.minX + WINDOW.size / 2;
  const cz = WINDOW.minZ + WINDOW.size / 2;
  return items
    .map((t) => {
      const [x, z] = at(t);
      return { t, d: Math.hypot(x - cx, z - cz) };
    })
    .filter((e) => e.d < WINDOW.size * 0.9)
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((e) => e.t);
}

/**
 * Bakes the window's terrain height and normal (float, also copied back to the CPU), its surface mask, and
 * its sun visibility. The terrain bakes re-run whenever the window moves; the light bake also whenever the sun moves.
 */
export class GroundBakes {
  readonly height: THREE.WebGLRenderTarget;
  private readonly heights = new THREE.WebGLRenderTarget(RES + 2, RES + 2, {
    type: THREE.FloatType,
    format: THREE.RedFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  readonly ground = simTarget(RES, RES, THREE.HalfFloatType, THREE.LinearFilter);
  readonly surface = simTarget(SURFACE_RES, SURFACE_RES, THREE.UnsignedByteType, THREE.LinearFilter);
  private readonly gpu: GpuRunner;
  private readonly heightMat: THREE.ShaderMaterial;
  private readonly normalMat: THREE.ShaderMaterial;
  private readonly groundMat: THREE.ShaderMaterial;
  private readonly surfaceMat: THREE.ShaderMaterial;
  private readonly readback: Readback<{ minX: number; minZ: number; size: number }>;
  private readonly grids = [new Float32Array(RES * RES * 4), new Float32Array(RES * RES * 4)];
  private gridInUse = 0;
  private wanted: { minX: number; minZ: number; size: number } | null = null;
  private heightUnread = false;
  /** Whether the float height bake can be filtered linearly on this device. */
  readonly filterable: boolean;

  constructor(renderer: THREE.WebGLRenderer) {
    this.gpu = new GpuRunner(renderer);
    this.filterable = renderer.extensions.has('OES_texture_float_linear');
    this.height = simTarget(RES, RES, THREE.FloatType, this.filterable ? THREE.LinearFilter : THREE.NearestFilter);
    this.readback = new Readback(renderer, 'height', RES, RES, (data, window) => {
      if (window !== this.wanted) return;
      const grid = this.grids[1 - this.gridInUse];
      grid.set(data);
      this.gridInUse = 1 - this.gridInUse;
      setHeightGrid({ data: grid, ...window, res: RES, stride: 4 });
    }, 2, 4);
    this.heightMat = simMaterial(HEIGHT_FRAG, { uDomain: atmo.uniforms.uDomain });
    this.normalMat = simMaterial(NORMAL_FRAG, { uHeights: { value: this.heights.texture }, uDomain: atmo.uniforms.uDomain });
    this.groundMat = simMaterial(GROUND_FRAG, {
      uHeightTex: { value: this.height.texture },
      uSunDir: atmo.uniforms.uSunDir,
      uStormCover: atmo.uniforms.uStormCover,
      uDomain: atmo.uniforms.uDomain,
      uOccluderCount: { value: 0 },
      uOccluders: { value: Array.from({ length: MAX_OCCLUDERS }, () => new THREE.Vector4()) },
    });
    this.surfaceMat = simMaterial(SURFACE_FRAG, {
      uDomain: atmo.uniforms.uDomain,
      uClearCount: { value: 0 },
      uClear: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Vector4()) },
      uFlowerCount: { value: 0 },
      uFlowers: { value: Array.from({ length: MAX_SHAPES }, () => new THREE.Vector4()) },
    });
    atmo.uniforms.uHeightTex.value = this.height.texture;
    atmo.uniforms.uGroundTex.value = this.ground.texture;
    atmo.uniforms.uSurfaceTex.value = this.surface.texture;
  }

  /** Bakes everything for the current window (`atmo.uniforms.uDomain` must already match `WINDOW`). */
  bake(inputs: BakeInputs): void {
    this.gpu.run(this.heightMat, this.heights);
    this.gpu.run(this.normalMat, this.height);
    this.bakeLight(inputs);

    const su = this.surfaceMat.uniforms;
    const clearings = nearest(inputs.clearings, (c) => [c.x, c.z], MAX_SHAPES);
    const flowers = nearest(inputs.flowers, (c) => [c.x, c.z], MAX_SHAPES);
    su.uClearCount.value = clearings.length;
    clearings.forEach((c, i) => su.uClear.value[i].set(c.x, c.z, c.radius, 0));
    su.uFlowerCount.value = flowers.length;
    flowers.forEach((c, i) => su.uFlowers.value[i].set(c.x, c.z, c.radius, 0));
    this.gpu.run(this.surfaceMat, this.surface);

    atmo.uniforms.uGroundDomain.value.copy(atmo.uniforms.uDomain.value);
    this.wanted = { minX: WINDOW.minX, minZ: WINDOW.minZ, size: WINDOW.size };
    this.heightUnread = !this.readback.request(this.height, this.wanted);
  }

  /** Once a frame: retries the height readback if every slot was busy when the window moved. */
  tick(): void {
    if (this.heightUnread && this.wanted) this.heightUnread = !this.readback.request(this.height, this.wanted);
  }

  /** Re-marches the sun over the baked height: cheap enough to follow the sun as it sinks. */
  bakeLight(inputs: BakeInputs): void {
    const occluders = nearest(inputs.occluders, (o) => [o.centre.x, o.centre.z], MAX_OCCLUDERS);
    const gu = this.groundMat.uniforms;
    gu.uOccluderCount.value = occluders.length;
    occluders.forEach((o, i) => gu.uOccluders.value[i].set(o.centre.x, o.centre.y, o.centre.z, o.radius));
    this.gpu.run(this.groundMat, this.ground);
  }
}

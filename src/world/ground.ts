import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { atmo } from './atmosphere';
import { HEIGHTFIELD_GLSL } from './heightfield';
import { setHeightGrid } from './island';
import { WINDOW } from './window';

const RES = 512;
const SURFACE_RES = 256;
const MAX_OCCLUDERS = 24;
const MAX_SHAPES = 64;

const HEIGHT_FRAG = /* glsl */ `
${HEIGHTFIELD_GLSL}
uniform vec4 uDomain;
in vec2 vUv;
void main() {
  vec2 p = vUv / uDomain.zw + uDomain.xy;
  float e = 1.0 / (uDomain.z * ${RES}.0);
  float h = worldHeight(p);
  float hl = worldHeight(p - vec2(e, 0.0));
  float hr = worldHeight(p + vec2(e, 0.0));
  float hb = worldHeight(p - vec2(0.0, e));
  float ht = worldHeight(p + vec2(0.0, e));
  gl_FragColor = vec4(h, normalize(vec3(hl - hr, 2.0 * e, hb - ht)));
}`;

/** Soft sun visibility marched over the terrain; the hills and the tree canopies cast long low-sun shadows. */
const GROUND_FRAG = /* glsl */ `
${HEIGHTFIELD_GLSL}
uniform sampler2D uHeightTex;
uniform vec3 uSunDir;
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
    if (t <= 0.0) continue;
    float miss = length(c - (origin + uSunDir * t));
    vis *= 1.0 - 0.8 * smoothstep(r * 1.05, r * 0.55, miss);
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
 * Bakes the window's terrain height and normal (float, also copied back to the CPU), its sun visibility,
 * and its surface mask. Re-run whenever the window moves.
 */
export class GroundBakes {
  readonly height: THREE.WebGLRenderTarget;
  readonly ground = simTarget(RES, RES, THREE.HalfFloatType, THREE.LinearFilter);
  readonly surface = simTarget(SURFACE_RES, SURFACE_RES, THREE.UnsignedByteType, THREE.LinearFilter);
  private readonly gpu: GpuRunner;
  private readonly heightMat: THREE.ShaderMaterial;
  private readonly groundMat: THREE.ShaderMaterial;
  private readonly surfaceMat: THREE.ShaderMaterial;
  private reading = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.gpu = new GpuRunner(renderer);
    const filterable = renderer.extensions.has('OES_texture_float_linear');
    this.height = simTarget(RES, RES, THREE.FloatType, filterable ? THREE.LinearFilter : THREE.NearestFilter);
    this.heightMat = simMaterial(HEIGHT_FRAG, { uDomain: atmo.uniforms.uDomain });
    this.groundMat = simMaterial(GROUND_FRAG, {
      uHeightTex: { value: this.height.texture },
      uSunDir: atmo.uniforms.uSunDir,
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

  /** Bakes for the current window (`atmo.uniforms.uDomain` must already match `WINDOW`). */
  bake(inputs: BakeInputs): void {
    this.gpu.run(this.heightMat, this.height);

    const occluders = nearest(inputs.occluders, (o) => [o.centre.x, o.centre.z], MAX_OCCLUDERS);
    const gu = this.groundMat.uniforms;
    gu.uOccluderCount.value = occluders.length;
    occluders.forEach((o, i) => gu.uOccluders.value[i].set(o.centre.x, o.centre.y, o.centre.z, o.radius));
    this.gpu.run(this.groundMat, this.ground);

    const su = this.surfaceMat.uniforms;
    const clearings = nearest(inputs.clearings, (c) => [c.x, c.z], MAX_SHAPES);
    const flowers = nearest(inputs.flowers, (c) => [c.x, c.z], MAX_SHAPES);
    su.uClearCount.value = clearings.length;
    clearings.forEach((c, i) => su.uClear.value[i].set(c.x, c.z, c.radius, 0));
    su.uFlowerCount.value = flowers.length;
    flowers.forEach((c, i) => su.uFlowers.value[i].set(c.x, c.z, c.radius, 0));
    this.gpu.run(this.surfaceMat, this.surface);

    atmo.uniforms.uGroundDomain.value.copy(atmo.uniforms.uDomain.value);
    this.readBack();
  }

  private readBack(): void {
    const ticket = ++this.reading;
    const window = { minX: WINDOW.minX, minZ: WINDOW.minZ, size: WINDOW.size };
    const buffer = new Float32Array(RES * RES * 4);
    this.renderer
      .readRenderTargetPixelsAsync(this.height, 0, 0, RES, RES, buffer)
      .then(() => {
        if (ticket === this.reading) setHeightGrid({ data: buffer, ...window, res: RES, stride: 4 });
      })
      .catch(() => {});
  }
}

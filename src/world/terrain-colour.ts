import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { NOISE_GLSL } from './atmosphere';
import { GRASS_PATTERN_GLSL } from './grass';
import { DOOR_SHORE, ISLES } from './heightfield';
import { SKY_MIRROR } from './sky-mirror-layout';

const TEXEL = 1;
const WIDTH = 1024;

/** World-aligned texels agree in overlapping patches; empty sea needs no storage. */
export const TERRAIN_COLOUR_PATCHES = [
  { x: -6, z: -14, rx: 80, rz: 65 }, ...Object.values(ISLES), DOOR_SHORE, SKY_MIRROR,
].map(isle => {
  const minX = Math.floor((isle.x - isle.rx * 1.15 - 12) / TEXEL) * TEXEL;
  const minZ = Math.floor((isle.z - isle.rz * 1.15 - 12) / TEXEL) * TEXEL;
  const width = Math.ceil((isle.x + isle.rx * 1.15 + 12 - minX) / TEXEL);
  const height = Math.ceil((isle.z + isle.rz * 1.15 + 12 - minZ) / TEXEL);
  return { minX, minZ, width, height, x: 0, y: 0 };
}).sort((a, b) => b.height - a.height);
let x = 0, y = 0, rowHeight = 0;
for (const patch of TERRAIN_COLOUR_PATCHES) {
  if (patch.width > WIDTH) throw new Error('Terrain colour patch exceeds its atlas width');
  if (x + patch.width > WIDTH) { x = 0; y += rowHeight; rowHeight = 0; }
  patch.x = x; patch.y = y; x += patch.width; rowHeight = Math.max(rowHeight, patch.height);
}
const HEIGHT = y + rowHeight;
const f = (v: number): string => v.toFixed(4);

const PATTERN = /* glsl */ `
vec4 terrainColourPatternDirect(vec2 p) {
  return vec4(grassPatternAt(p), fbm(p * 0.09 + 31.0));
}`;
const BAKE = /* glsl */ `
${NOISE_GLSL}
${GRASS_PATTERN_GLSL}
${PATTERN}
uniform vec4 uColourBakeDomain;
in vec2 vUv;
void main() {
  gl_FragColor = terrainColourPatternDirect(uColourBakeDomain.xy + vUv * uColourBakeDomain.zw);
}`;

/** Read only the static pattern; palette, season, life, lighting and movement remain in the scene shader. */
export const TERRAIN_COLOUR_GLSL = /* glsl */ `
uniform sampler2D uTerrainColour;
uniform float uTerrainColourReady;
${PATTERN}
vec3 terrainColourAddress(vec2 p) {
  ${TERRAIN_COLOUR_PATCHES.map(a => `{
    vec2 q = (p - vec2(${f(a.minX)}, ${f(a.minZ)})) / ${f(TEXEL)};
    vec2 edge = min(q - 0.5, vec2(${f(a.width - 0.5)}, ${f(a.height - 0.5)}) - q);
    float margin = min(edge.x, edge.y);
    if (margin >= 0.0) return vec3((q + vec2(${f(a.x)}, ${f(a.y)})) / vec2(${WIDTH}.0, ${HEIGHT}.0), margin);
  }`).join('\n')}
  return vec3(0.0, 0.0, -1.0);
}
vec4 terrainColourPattern(vec2 p) {
  if (uTerrainColourReady < 0.5) return terrainColourPatternDirect(p);
  vec3 address = terrainColourAddress(p);
  if (address.z < 0.0) return terrainColourPatternDirect(p);
  vec4 cached = texture(uTerrainColour, address.xy);
  if (address.z >= 2.0) return cached;
  return mix(terrainColourPatternDirect(p), cached, smoothstep(0.0, 2.0, address.z));
}`;

export class TerrainColour {
  readonly target = simTarget(WIDTH, HEIGHT, THREE.HalfFloatType, THREE.LinearFilter);
  readonly uniforms = {
    uTerrainColour: { value: this.target.texture },
    uTerrainColourReady: { value: 0 },
  };
  private readonly domain = { value: new THREE.Vector4() };
  private readonly material = simMaterial(BAKE, { uColourBakeDomain: this.domain });

  /** One startup bake across all islands; no camera moves or season changes can invalidate it. */
  bake(renderer: THREE.WebGLRenderer): void {
    if (this.uniforms.uTerrainColourReady.value) return;
    const gpu = new GpuRunner(renderer);
    this.target.scissorTest = true;
    try {
      for (const p of TERRAIN_COLOUR_PATCHES) {
        this.domain.value.set(p.minX, p.minZ, p.width * TEXEL, p.height * TEXEL);
        this.target.viewport.set(p.x, p.y, p.width, p.height);
        this.target.scissor.copy(this.target.viewport);
        gpu.run(this.material, this.target);
      }
      this.uniforms.uTerrainColourReady.value = 1;
    } finally {
      this.target.scissorTest = false;
      this.target.viewport.set(0, 0, WIDTH, HEIGHT);
    }
  }
}

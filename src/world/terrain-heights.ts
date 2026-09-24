import * as THREE from 'three';
import { GpuRunner, simMaterial } from '../gl/gpu';
import { DOOR_SHORE, HEIGHTFIELD_GLSL, ISLES } from './heightfield';
import { LITTLE_BOATS } from './little-boats-layout';
import { SKY_MIRROR } from './sky-mirror-layout';

/**
 * Where each island (and the sky mirror's bed) lifts the ground off the open-sea floor, as offsets from its centre,
 * measured on a 2 m sweep with a margin. Beyond all of them `worldHeight` equals `seaFloor` exactly;
 * tools/terrain-heights-check.mjs proves both and must pass again after any island's shape or place changes.
 */
const REACH: [{ x: number; z: number }, number, number, number, number][] = [
  [{ x: -6, z: -14 }, -124, 130, -98, 94],
  [ISLES.lines, -122, 126, -114, 116],
  [DOOR_SHORE, -36, 36, -46, 46],
  [LITTLE_BOATS, -70, 70, -104, 104],
  [ISLES.meadow, -294, 300, -266, 252],
  [ISLES.birches, -104, 104, -142, 140],
  [ISLES.drowned, -332, 338, -276, 284],
  [ISLES.wood, -220, 216, -202, 196],
  [ISLES.sleeping, -86, 88, -96, 96],
  [ISLES.home, -298, 294, -260, 252],
  [SKY_MIRROR, -98, 98, -82, 82],
];
/** Covers the blend, the bilinear footprint and the sweep's step outside each reach. */
const MARGIN = 8;

export interface HeightPatch { minX: number; minZ: number; width: number; height: number; x: number; y: number }

/** World-aligned texels, so overlapping patches store the same heights; packed in rows like the colour atlas. */
export function layoutHeightPatches(texel: number, width: number): { patches: HeightPatch[]; width: number; height: number } {
  const patches = REACH.map(([c, x0, x1, z0, z1]) => {
    const minX = Math.floor((c.x + x0 - MARGIN) / texel) * texel;
    const minZ = Math.floor((c.z + z0 - MARGIN) / texel) * texel;
    return {
      minX, minZ, x: 0, y: 0,
      width: Math.ceil((c.x + x1 + MARGIN - minX) / texel) + 1,
      height: Math.ceil((c.z + z1 + MARGIN - minZ) / texel) + 1,
    };
  }).sort((a, b) => b.height - a.height);
  let x = 0, y = 0, row = 0;
  for (const p of patches) {
    if (p.width > width) throw new Error('Terrain height patch exceeds its atlas width');
    if (x + p.width > width) { x = 0; y += row; row = 0; }
    p.x = x; p.y = y; x += p.width; row = Math.max(row, p.height);
  }
  return { patches, width, height: y + row };
}

/** The narrowest-waste row packing no taller than 4096. */
export function smallestHeightLayout(texel: number): ReturnType<typeof layoutHeightPatches> {
  let best: ReturnType<typeof layoutHeightPatches> | null = null;
  const widest = Math.max(...layoutHeightPatches(texel, 1 << 16).patches.map(p => p.width));
  for (let w = widest; w <= 4096; w += 2) {
    const l = layoutHeightPatches(texel, w);
    if (l.height <= 4096 && (!best || l.width * l.height < best.width * best.height)) best = l;
  }
  return best!;
}

export const HEIGHT_TEXEL = 1;
/**
 * A bilinear cell that misses the height function by more than this is calculated directly, if any of it lies above
 * HEIGHT_FLAG_ABOVE: deeper ground is under the sea, and beyond the window the sea shades its bed as if it were deep.
 * Its first corner's texel carries the flag as an offset.
 */
export const HEIGHT_FLAG_METRES = 0.01;
export const HEIGHT_FLAG_ABOVE = -4;
const FLAGGED = 1000;
/** Cell corners first (the first is the texel's own height), then the points each flagged cell was tested at. */
const TESTED = [[0, 0], [1, 0], [0, 1], [1, 1], [0.25, 0.25], [0.5, 0.25], [0.75, 0.25], [0.25, 0.5], [0.5, 0.5], [0.75, 0.5],
  [0.25, 0.75], [0.5, 0.75], [0.75, 0.75], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]];
export const HEIGHT_TESTED = TESTED.slice(4);
export const HEIGHT_LAYOUT = smallestHeightLayout(HEIGHT_TEXEL);
export const TERRAIN_HEIGHT_PATCHES = HEIGHT_LAYOUT.patches;
const f = (v: number): string => v.toFixed(4);

/**
 * `worldHeight` where no island reaches: every island at its floor, and the sleeping island's notch, which is cut
 * along an unbounded strip under the open sea.
 */
const SEA_FLOOR_GLSL = /* glsl */ `
float seaFloor(vec2 p) {
  vec2 notch = p - vec2(-164.56, -1925.88);
  float across = dot(notch, vec2(2.0, 1.0)) / sqrt(5.0), along = dot(notch, vec2(1.0, -2.0)) / sqrt(5.0);
  float h = hf_smax(max(hf_smax(hf_smax(-9.0, -9.4, 6.0), -9.8, 2.0), -9.6), -9.6, 6.0);
  h = hf_smax(h, -9.6 - 4.5 * smoothstep(1.65, 3.8, across) * (1.0 - smoothstep(2.2, 5.5, abs(along))), 6.0);
  h = hf_smax(hf_smax(hf_smax(hf_smax(h, -8.5, 6.0), -8.5, 6.0), -9.5, 6.0), -9.6, 6.0);
  return max(h, -11.025);
}`;

/** Needs HEIGHTFIELD_GLSL first. Only for ground beyond the window: the window's own bakes stay exact. */
export const TERRAIN_HEIGHTS_GLSL = /* glsl */ `
uniform sampler2D uTerrainHeights;
uniform float uTerrainHeightsReady;
${SEA_FLOOR_GLSL}
float terrainHeightTexel(ivec2 i) {
  float v = texelFetch(uTerrainHeights, i, 0).r;
  return v > ${f(FLAGGED / 2)} ? v - ${f(FLAGGED)} : v;
}
float terrainHeightAt(vec2 p) {
  if (uTerrainHeightsReady > 0.5) {
    float best = -1.0;
    vec2 texel = vec2(0.0);
    vec2 last = vec2(0.0);
    ${TERRAIN_HEIGHT_PATCHES.map(a => `{
      vec2 q = (p - vec2(${f(a.minX)}, ${f(a.minZ)})) / ${f(HEIGHT_TEXEL)} - 0.5;
      vec2 edge = min(q, vec2(${f(a.width - 1)}, ${f(a.height - 1)}) - q);
      float margin = min(edge.x, edge.y);
      if (margin > best) { best = margin; texel = q + vec2(${f(a.x)}, ${f(a.y)}); last = vec2(${f(a.x + a.width - 2)}, ${f(a.y + a.height - 2)}); }
    }`).join('\n')}
    if (best < 0.0) return seaFloor(p);
    ivec2 i = ivec2(min(floor(texel), last));
    float a = texelFetch(uTerrainHeights, i, 0).r;
    if (a < ${f(FLAGGED / 2)}) {
      vec2 t = texel - vec2(i);
      float h = mix(mix(a, terrainHeightTexel(i + ivec2(1, 0)), t.x), mix(terrainHeightTexel(i + ivec2(0, 1)), terrainHeightTexel(i + ivec2(1, 1)), t.x), t.y);
      return best >= 2.0 ? h : mix(seaFloor(p), h, smoothstep(0.0, 2.0, best));
    }
  }
  return worldHeight(p);
}`;

const BAKE = /* glsl */ `
${HEIGHTFIELD_GLSL}
uniform vec4 uHeightBakePatch;
uniform vec2 uHeightBakeSize;
const vec2 TESTED[${TESTED.length}] = vec2[${TESTED.length}](${TESTED.map(([x, z]) => `vec2(${f(x)}, ${f(z)})`).join(', ')});
void main() {
  vec2 local = gl_FragCoord.xy - uHeightBakePatch.zw;
  vec2 p = uHeightBakePatch.xy + local * ${f(HEIGHT_TEXEL)};
  bool cell = all(lessThan(local + 1.0, uHeightBakeSize));
  float corner[4];
  float top = -1e9, worst = 0.0;
  for (int k = 0; k < ${TESTED.length}; k++) {
    if (k == 1 && !cell) break;
    if (k == 4 && top <= ${f(HEIGHT_FLAG_ABOVE - 1)}) break;
    float h = worldHeight(p + TESTED[k] * ${f(HEIGHT_TEXEL)});
    top = max(top, h);
    if (k < 4) corner[k] = h;
    else worst = max(worst, abs(mix(mix(corner[0], corner[1], TESTED[k].x), mix(corner[2], corner[3], TESTED[k].x), TESTED[k].y) - h));
  }
  bool flagged = top > ${f(HEIGHT_FLAG_ABOVE)} && worst > ${f(HEIGHT_FLAG_METRES)};
  gl_FragColor = vec4(corner[0] + (flagged ? ${f(FLAGGED)} : 0.0), 0.0, 0.0, 1.0);
}`;

/**
 * The ground's height over every island, baked once before Begin, for everything drawn or marched beyond the
 * window. Cells that bilinear filtering cannot follow closely enough are flagged and calculated directly.
 */
export class TerrainHeights {
  readonly target = new THREE.WebGLRenderTarget(HEIGHT_LAYOUT.width, HEIGHT_LAYOUT.height, {
    type: THREE.FloatType,
    format: THREE.RedFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  readonly uniforms = {
    uTerrainHeights: { value: this.target.texture },
    uTerrainHeightsReady: { value: 0 },
  };
  private readonly patch = { value: new THREE.Vector4() };
  private readonly size = { value: new THREE.Vector2() };
  private readonly material = simMaterial(BAKE, { uHeightBakePatch: this.patch, uHeightBakeSize: this.size });

  /** About 75 ms of GPU on an M4 Pro, so `between` can let each patch finish before the next is queued. */
  async bake(renderer: THREE.WebGLRenderer, between?: () => Promise<void>): Promise<void> {
    if (this.uniforms.uTerrainHeightsReady.value) return;
    const gpu = new GpuRunner(renderer);
    for (const p of TERRAIN_HEIGHT_PATCHES) {
      this.patch.value.set(p.minX, p.minZ, p.x, p.y);
      this.size.value.set(p.width, p.height);
      this.target.viewport.set(p.x, p.y, p.width, p.height);
      this.target.scissor.copy(this.target.viewport);
      this.target.scissorTest = true;
      try {
        gpu.run(this.material, this.target);
      } finally {
        this.target.scissorTest = false;
        this.target.viewport.set(0, 0, HEIGHT_LAYOUT.width, HEIGHT_LAYOUT.height);
      }
      await between?.();
    }
    this.uniforms.uTerrainHeightsReady.value = 1;
  }
}

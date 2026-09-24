import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { FIELDS_GLSL } from './fields';
import { HEIGHTFIELD_GLSL, ISLES } from './heightfield';

const RES = 1024;
const SPAN = Math.ceil((Math.max(ISLES.meadow.rx, ISLES.meadow.rz) * 2 + 32) / 64) * 64;
const TEXEL = SPAN / RES;
/** World-aligned origin and span of the field atlas. */
export const FIELD_ATLAS = {
  minX: Math.floor((ISLES.meadow.x - SPAN / 2) / TEXEL) * TEXEL,
  minZ: Math.floor((ISLES.meadow.z - SPAN / 2) / TEXEL) * TEXEL,
  span: SPAN,
};

/** Fixed geography only: field identity, boundary distance, walls/gates and coastal presence. */
const BAKE = /* glsl */ `
${HEIGHTFIELD_GLSL}
${FIELDS_GLSL}
uniform vec4 uTerrainFieldDomain;
in vec2 vUv;
void main() {
  gl_FragColor = fieldAt(uTerrainFieldDomain.xy + vUv / uTerrainFieldDomain.zw);
}`;

/** Keep discontinuous field identities and narrow wall/gate edges on the original exact calculation. */
export const TERRAIN_FIELDS_GLSL = /* glsl */ `
uniform sampler2D uTerrainFields;
uniform vec4 uTerrainFieldDomain;
uniform float uTerrainFieldsReady;
vec4 terrainFieldAt(vec2 p, float lineWidth) {
  if (uTerrainFieldsReady < 0.5) return fieldAt(p);
  vec2 uv = (p - uTerrainFieldDomain.xy) * uTerrainFieldDomain.zw;
  // fieldAt's own answer out here: presence is 0 beyond the atlas (tools/fields-border-check.mjs).
  if (any(lessThan(uv, vec2(0.001))) || any(greaterThan(uv, vec2(0.999)))) return vec4(99.0, 0.0, 0.0, 0.0);
  vec4 f = texture(uTerrainFields, uv);
  // Bilinear interpolation is valid within a field, not between different field kinds.
  // The extra texel margin also keeps the original distance-dependent wall width and gate cuts.
  if (f.x < max(lineWidth, ${(2 * TEXEL).toFixed(4)}) + ${(2 * TEXEL).toFixed(4)} || (f.w > 0.0 && f.w < 0.02)) return fieldAt(p);
  return f;
}`;

export class TerrainFields {
  readonly target = simTarget(RES, RES, THREE.HalfFloatType, THREE.LinearFilter);
  readonly uniforms = {
    uTerrainFields: { value: this.target.texture },
    uTerrainFieldDomain: { value: new THREE.Vector4(FIELD_ATLAS.minX, FIELD_ATLAS.minZ, 1 / SPAN, 1 / SPAN) },
    uTerrainFieldsReady: { value: 0 },
  };
  private readonly material = simMaterial(BAKE, this.uniforms);

  /** Compiled with the other simulation materials, then baked once behind the start screen. */
  bake(renderer: THREE.WebGLRenderer): void {
    if (this.uniforms.uTerrainFieldsReady.value) return;
    new GpuRunner(renderer).run(this.material, this.target);
    this.uniforms.uTerrainFieldsReady.value = 1;
  }
}

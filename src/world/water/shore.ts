import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../../gl/gpu';

/** Matches the height bake (world/ground.ts), texel for texel. */
const RES = 512;
const FAR = 60;
const NONE = -1000;

/** Waterline crossings: each texel beside the waterline stores where, between it and a neighbour, the height is 0. */
const SEED_FRAG = /* glsl */ `
uniform sampler2D uHeight;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float h = texelFetch(uHeight, p, 0).r;
  vec2 best = vec2(${NONE}.0);
  float bestD = 1e9;
  for (int k = 0; k < 4; k++) {
    ivec2 o = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1);
    ivec2 q = clamp(p + o, ivec2(0), ivec2(${RES - 1}));
    float hn = texelFetch(uHeight, q, 0).r;
    if ((hn > 0.0) == (h > 0.0)) continue;
    float t = h / (h - hn);
    if (t < bestD) {
      bestD = t;
      best = vec2(p) + 0.5 + vec2(o) * t;
    }
  }
  gl_FragColor = vec4(best, 0.0, 1.0);
}`;

/** One jump-flood round: keep the nearest crossing seen by this texel or its neighbours `uStep` texels away. */
const FLOOD_FRAG = /* glsl */ `
uniform sampler2D uSeeds;
uniform int uStep;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 c = vec2(p) + 0.5;
  vec2 best = texelFetch(uSeeds, p, 0).xy;
  float bestD = best.x <= ${NONE + 1}.0 ? 1e9 : distance(best, c);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 q = p + ivec2(i, j) * uStep;
      if (q.x < 0 || q.y < 0 || q.x >= ${RES} || q.y >= ${RES}) continue;
      vec2 s = texelFetch(uSeeds, q, 0).xy;
      if (s.x <= ${NONE + 1}.0) continue;
      float d = distance(s, c);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
  }
  gl_FragColor = vec4(best, 0.0, 1.0);
}`;

const RESOLVE_FRAG = /* glsl */ `
uniform sampler2D uSeeds;
uniform sampler2D uHeight;
uniform float uCell;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 s = texelFetch(uSeeds, p, 0).xy;
  float h = texelFetch(uHeight, p, 0).r;
  float d = s.x <= ${NONE + 1}.0 ? ${FAR}.0 : distance(s, vec2(p) + 0.5) * uCell;
  gl_FragColor = vec4(clamp(h > 0.0 ? d : -d, -${FAR}.0, ${FAR}.0), 0.0, 0.0, 1.0);
}`;

/**
 * Signed horizontal distance to the waterline over the world window: positive on land, negative at sea. Swash
 * reach and breaker spacing are measured with it, so bumps in the beach do not trap water. Baked on the GPU by
 * jump flooding from the waterline crossings of the height bake; re-bake whenever that is re-baked.
 */
export class ShoreBake {
  readonly target = simTarget(RES, RES, THREE.HalfFloatType, THREE.LinearFilter);
  private readonly gpu: GpuRunner;
  private readonly seeds = [simTarget(RES, RES, THREE.FloatType, THREE.NearestFilter), simTarget(RES, RES, THREE.FloatType, THREE.NearestFilter)];
  private readonly seedMat: THREE.ShaderMaterial;
  private readonly floodMat: THREE.ShaderMaterial;
  private readonly resolveMat: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, height: THREE.Texture) {
    this.gpu = new GpuRunner(renderer);
    this.seedMat = simMaterial(SEED_FRAG, { uHeight: { value: height } });
    this.floodMat = simMaterial(FLOOD_FRAG, { uSeeds: { value: null }, uStep: { value: 1 } });
    this.resolveMat = simMaterial(RESOLVE_FRAG, { uSeeds: { value: null }, uHeight: { value: height }, uCell: { value: 1 } });
  }

  bake(windowSize: number): void {
    this.gpu.run(this.seedMat, this.seeds[0]);
    let read = 0;
    for (let step = RES / 2; step >= 1; step /= 2) {
      this.floodMat.uniforms.uSeeds.value = this.seeds[read].texture;
      this.floodMat.uniforms.uStep.value = step;
      this.gpu.run(this.floodMat, this.seeds[1 - read]);
      read = 1 - read;
    }
    this.resolveMat.uniforms.uSeeds.value = this.seeds[read].texture;
    this.resolveMat.uniforms.uCell.value = windowSize / RES;
    this.gpu.run(this.resolveMat, this.target);
  }
}

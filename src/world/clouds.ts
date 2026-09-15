import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { CLOUD_SHADOW_GLSL, atmo } from './atmosphere';

const RES = 256;

const FRAG = /* glsl */ `
${CLOUD_SHADOW_GLSL}
uniform vec4 uCloudDomain;
in vec2 vUv;
void main() {
  vec2 xz = vUv / uCloudDomain.zw + uCloudDomain.xy;
  gl_FragColor = vec4(cloudShadowAt(xz), 0.0, 0.0, 1.0);
}`;

/** Bakes the drifting cloud shadows once per frame so every surface pays one texture read for them. */
export class CloudShadows {
  private readonly target = simTarget(RES, RES, THREE.HalfFloatType, THREE.LinearFilter);
  private readonly gpu: GpuRunner;
  private readonly mat = simMaterial(FRAG, {
    uCloudShift: atmo.uniforms.uCloudShift,
    uCloudDomain: atmo.uniforms.uCloudDomain,
  });

  constructor(renderer: THREE.WebGLRenderer) {
    this.gpu = new GpuRunner(renderer);
    atmo.uniforms.uCloudTex.value = this.target.texture;
  }

  update(): void {
    this.gpu.run(this.mat, this.target);
  }
}

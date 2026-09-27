import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';

/** A soft warm halo round the flame, reaching further through fog than the lantern itself can be seen. */
const GLOW_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uLit;
in vec2 vUv;
in vec3 vWorld;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 2.2) * (0.5 + 0.06 * sin(uTime * 7.0)) * uLit;
  a *= 1.0 - 0.3 * fogOf(vWorld).a;
  gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * a, a);
}`;

const GLOW_VERT = /* glsl */ `
out vec2 vUv;
out vec3 vWorld;
void main() {
  vUv = uv;
  vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vWorld = c + (right * position.x + up * position.y) * 2.2;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * The halo of the boat's lantern for the way over the cloud, the one warm light they carry into the fog. It is apart
 * from the lantern, so the flame can go on glowing a moment after the lantern itself is lost in the white, and go out.
 */
export class BowLantern {
  readonly glow: THREE.Mesh;
  private readonly lit = { value: 1 };

  constructor() {
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uLit: this.lit }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.glow.name = 'bow-lantern-glow';
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 8;
  }

  set brightness(v: number) {
    this.lit.value = v;
    this.glow.visible = v > 0.005;
  }
}

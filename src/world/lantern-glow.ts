import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';

const GLOW_VERT = /* glsl */ `
uniform vec3 uAt;
uniform float uSize;
out vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 view = viewMatrix * vec4(uAt, 1.0);
  view.xy += position.xy * uSize;
  /** Drawn well toward the eye, so neither the fog it hangs in nor the water in front of the flame cuts its edge. */
  view.xyz *= 1.0 - max(min(uSize, length(view.xyz) * 0.5), length(view.xyz) * 0.4) / length(view.xyz);
  gl_Position = projectionMatrix * view;
}`;

const GLOW_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uStrength;
in vec2 vUv;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float glow = exp(-r2 * 5.0) * 0.8 + exp(-r2 * 30.0) * 0.6;
  gl_FragColor = vec4(vec3(1.0, 0.63, 0.29) * glow * uStrength, 1.0);
}`;

/**
 * A lantern's light held in the fog round it, seen from far off: a soft warm glow where the flame is, drawn over
 * the fog it is in. The story says how strongly it shows (none while the lantern is lost, swelling as it answers,
 * little once the fog has gone from round it and the flame itself is seen).
 */
export class LanternGlow {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = { uAt: { value: new THREE.Vector3() }, uSize: { value: 3 }, uStrength: { value: 0 } };

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: { ...atmo.uniforms, ...this.uniforms },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  /** At `at`, `size` metres round, `strength` 0 (unseen) to about 1.5 (an answer at its brightest). */
  show(at: THREE.Vector3, size: number, strength: number): void {
    this.uniforms.uAt.value.copy(at);
    this.uniforms.uSize.value = size;
    this.uniforms.uStrength.value = strength;
    this.mesh.visible = strength > 0.002;
  }
}

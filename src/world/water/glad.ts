import * as THREE from 'three';

/**
 * The sea brightening round the whale as it breathes free: within `radius` of the line from its head (x, z) back along
 * its body (`axis` xy, `length` m), as much as `amount`.
 */
export const gladUniforms = {
  uGlad: { value: new THREE.Vector4(0, 0, 0, 0) },
  uGladAxis: { value: new THREE.Vector3(0, 1, 0) },
};

export const GLAD_GLSL = /* glsl */ `
uniform vec4 uGlad;
uniform vec3 uGladAxis;
float gladAt(vec2 xz) {
  if (uGlad.w <= 0.0) return 0.0;
  vec2 d = xz - uGlad.xy;
  float along = clamp(dot(d, uGladAxis.xy), 0.0, uGladAxis.z);
  return uGlad.w * (1.0 - smoothstep(uGlad.z * 0.35, uGlad.z, length(d - uGladAxis.xy * along)));
}`;

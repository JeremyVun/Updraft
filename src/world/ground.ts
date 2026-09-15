import * as THREE from 'three';
import { GpuRunner, simMaterial, simTarget } from '../gl/gpu';
import { atmo } from './atmosphere';

const RES = 512;
const MAX_OCCLUDERS = 24;

/** Soft sun visibility marched over the heightmap; the hills cast long low-sun shadows across the meadow. */
const BAKE_FRAG = /* glsl */ `
uniform sampler2D uHeightTex;
uniform vec3 uSunDir;
uniform vec4 uDomain;
uniform vec2 uTexel;
uniform int uOccluderCount;
uniform vec4 uOccluders[${MAX_OCCLUDERS}];
in vec2 vUv;

float heightAt(vec2 world) {
  return max(texture(uHeightTex, (world - uDomain.xy) * uDomain.zw).r, 0.0);
}

void main() {
  vec2 world = vUv / uDomain.zw + uDomain.xy;
  float cell = 1.0 / (uDomain.z * 512.0);
  float hL = texture(uHeightTex, vUv - vec2(uTexel.x, 0.0)).r;
  float hR = texture(uHeightTex, vUv + vec2(uTexel.x, 0.0)).r;
  float hB = texture(uHeightTex, vUv - vec2(0.0, uTexel.y)).r;
  float hT = texture(uHeightTex, vUv + vec2(0.0, uTexel.y)).r;
  vec3 n = normalize(vec3(hL - hR, 2.0 * cell, hB - hT));

  float h0 = heightAt(world) + 0.6;
  vec2 dir = normalize(uSunDir.xz);
  float rise = uSunDir.y / length(uSunDir.xz);
  float vis = 1.0;
  float d = 0.8;
  for (int i = 0; i < 90; i++) {
    float gap = h0 + d * rise - heightAt(world + dir * d);
    vis = min(vis, clamp(gap / (0.6 + d * 0.07), 0.0, 1.0));
    d += 0.6 + d * 0.035;
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
  gl_FragColor = vec4(n * 0.5 + 0.5, vis);
}`;

/** Occluders are spheres (tree canopy clusters) that cast soft shadows into the bake. */
export function bakeGround(renderer: THREE.WebGLRenderer, occluders: { centre: THREE.Vector3; radius: number }[]): THREE.Texture {
  const target = simTarget(RES, RES, THREE.HalfFloatType, THREE.LinearFilter);
  const spheres = Array.from({ length: MAX_OCCLUDERS }, (_, i) => {
    const o = occluders[i];
    return o ? new THREE.Vector4(o.centre.x, o.centre.y, o.centre.z, o.radius) : new THREE.Vector4();
  });
  const mat = simMaterial(BAKE_FRAG, {
    uHeightTex: atmo.uniforms.uHeightTex,
    uSunDir: atmo.uniforms.uSunDir,
    uDomain: atmo.uniforms.uDomain,
    uTexel: { value: new THREE.Vector2(1 / RES, 1 / RES) },
    uOccluderCount: { value: Math.min(occluders.length, MAX_OCCLUDERS) },
    uOccluders: { value: spheres },
  });
  new GpuRunner(renderer).run(mat, target);
  mat.dispose();
  return target.texture;
}

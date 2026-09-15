import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../atmosphere';
import { GRASS_LINE, heightAt } from '../island';
import { openGround } from '../landmarks';
import { createNoise2D, fbm, smoothstep } from '../noise';
import { REFLECTION_LAYER } from './reflection';

const VERT = /* glsl */ `
in vec3 aTint;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normal;
  vTint = aTint;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTint;
void main() {
  vec3 n = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  float diff = clamp(dot(n, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 4.0);
  vec3 col = vTint * hemiLight(n) * 0.8 + (vTint * uSunColor * diff * 0.8 + uSunColor * vTint * back * 0.6) * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const TIP_LUSH = new THREE.Color('#7d9a3c');
const TIP_DRY = new THREE.Color('#c4a152');
const TIP_COOL = new THREE.Color('#4a8660');

/**
 * The meadow as the sea mirrors it: a coarse sheet at grass-top height, tinted with the same patches as the grass,
 * so the island reflects green without drawing every blade twice. Only the reflection camera sees it.
 */
export function createCanopyProxy(): THREE.Mesh {
  const lushNoise = createNoise2D(5);
  const dryNoise = createNoise2D(23);
  const coolNoise = createNoise2D(29);
  const geo = new THREE.PlaneGeometry(190, 184, 127, 123);
  geo.rotateX(-Math.PI / 2);
  geo.translate(-2.5, 0, -10);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const tint = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    const fringe = smoothstep(GRASS_LINE - 0.6, GRASS_LINE + 2.2, h);
    const lush = fbm(lushNoise, x * 0.035, z * 0.035, 3) * 0.5 + 0.5;
    const grass = (1.1 + 1.5 * lush) * (0.2 + 0.8 * fringe * fringe) * 0.55 * openGround(x, z);
    pos.setY(i, h < GRASS_LINE - 0.3 ? h - 1 : h - 0.15 + grass);
    const dry = smoothstep(0.52, 0.72, fbm(dryNoise, x * 0.022, z * 0.022, 3) * 0.5 + 0.5);
    const cool = smoothstep(0.56, 0.76, fbm(coolNoise, x * 0.04, z * 0.04, 2) * 0.5 + 0.5) * (1 - dry);
    tint.copy(TIP_LUSH).lerp(TIP_DRY, dry * 0.85).lerp(TIP_COOL, cool * 0.45).multiplyScalar(0.75);
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  geo.setAttribute('aTint', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...atmo.uniforms } });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.layers.set(REFLECTION_LAYER);
  return mesh;
}

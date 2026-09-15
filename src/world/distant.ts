import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { createNoise2D } from './noise';

const VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  vec3 alb = mix(vec3(0.16, 0.15, 0.14), vec3(0.24, 0.24, 0.21), smoothstep(4.0, 30.0, vWorld.y));
  float wrap = max(dot(n, uSunDir) * 0.6 + 0.4, 0.0);
  vec3 col = alb * (hemiLight(n) * 0.8 + uSunColor * wrap * 0.6);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** The rest of the archipelago: grey, lifeless islands resting in the haze, waiting to be restored. */
const ISLANDS: [number, number, number, number, number][] = [
  [-720, -980, 170, 42, 1],
  [-260, -1350, 110, 26, 2],
  [520, -1150, 210, 55, 3],
  [1400, -520, 120, 22, 4],
  [-1350, -300, 160, 30, 5],
  [900, -1500, 90, 20, 6],
];

export function createDistantIslands(): THREE.Mesh {
  const parts = ISLANDS.map(([x, z, radius, height, seed]) => {
    const geo = new THREE.SphereGeometry(1, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const noise = createNoise2D(seed);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      const a = Math.atan2(pz, px);
      const ridge = 1 + noise(Math.cos(a) * 1.4, Math.sin(a) * 1.4) * 0.35 + noise(px * 3, pz * 3) * 0.12 * py;
      pos.setXYZ(i, px * radius * ridge, Math.pow(py, 1.4) * height * ridge, pz * radius * (0.55 + 0.2 * seed / 6) * ridge);
    }
    geo.computeVertexNormals();
    geo.translate(x, -2, z);
    return geo;
  });
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...atmo.uniforms } });
  const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
  mesh.frustumCulled = false;
  return mesh;
}

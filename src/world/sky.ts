import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';

const VERT = /* glsl */ `
out vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vDir;
void main() {
  gl_FragColor = vec4(skyRadiance(normalize(vDir)), 1.0);
}`;

export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...atmo.uniforms },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.layers.enable(REFLECTION_LAYER);
  return mesh;
}

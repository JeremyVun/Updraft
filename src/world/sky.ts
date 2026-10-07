import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';
import { CLOUD_DECK, STORM_BANK, register } from '../gl/variants';
import { fixInPlace } from '../gl/fixed';

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
  vec3 d = normalize(vDir);
#if CLOUD_DECK
  vec4 deck = uCloudDeck.w > 0.0 ? cloudDeck(cameraPosition, d, 4000.0) : vec4(0.0);
  // Where the deck covers the sky whole, the radiance would be mixed away.
  vec3 col = deck.a < 1.0 ? skyRadiance(d) : vec3(0.0);
  if (uCloudDeck.w > 0.0) col = mix(col, deck.rgb, deck.a);
  if (uSeaFogShape.w > 0.0) {
    vec4 sea = seaFog(cameraPosition, d, 4000.0);
    col = mix(col, sea.rgb, sea.a);
  }
#else
  vec3 col = skyRadiance(d);
#endif
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...atmo.uniforms },
    side: THREE.BackSide,
    depthWrite: false,
  });
  register(mat, CLOUD_DECK, STORM_BANK);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.layers.enable(REFLECTION_LAYER);
  fixInPlace(mesh);
  return mesh;
}

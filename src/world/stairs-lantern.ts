import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';

const VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
void main() {
  vColor = color;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/** Its frame and post are lit like everything else; the glass is lit from inside, so it glows whatever the sky does. */
const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  bool glass = vColor.r > 0.9;
  vec3 col = glass
    ? vec3(1.6, 1.05, 0.5) * (0.85 + 0.15 * sin(uTime * 7.0) * sin(uTime * 3.1))
    : vColor * (hemiLight(N) + uSunColor * clamp(dot(N, uSunDir) * 0.6 + 0.4, 0.0, 1.0) * 0.8);
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(mix(col, f.rgb, f.a * (glass ? 0.55 : 1.0)), 1.0);
}`;

/** A soft warm halo round the flame, reaching further through fog than the lantern itself can be seen. */
const GLOW_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in vec3 vWorld;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - d), 2.2) * (0.5 + 0.06 * sin(uTime * 7.0));
  a *= 1.0 - 0.5 * fogOf(vWorld).a;
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
  vWorld = c + (right * position.x + up * position.y) * 0.9;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

function paint(geo: THREE.BufferGeometry, colour: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([colour.r, colour.g, colour.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}

/**
 * The lantern hung at the bow for the way over the cloud: a little brass-bound box of warm glass on a crooked
 * post, the one warm light they carry into the fog.
 */
export function bowLantern(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bow-lantern';
  const wood = new THREE.Color('#5a3b26');
  const brass = new THREE.Color('#9c7a3e');
  const glassColour = new THREE.Color(1, 0.8, 0.5);
  const parts = [
    paint(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 6).translate(0, 0.31, 0), wood),
    paint(new THREE.BoxGeometry(0.2, 0.02, 0.02).translate(0.09, 0.6, 0), wood),
    paint(new THREE.BoxGeometry(0.13, 0.02, 0.13).translate(0.18, 0.5, 0), brass),
    paint(new THREE.BoxGeometry(0.13, 0.02, 0.13).translate(0.18, 0.33, 0), brass),
    paint(new THREE.ConeGeometry(0.09, 0.07, 4).rotateY(Math.PI / 4).translate(0.18, 0.545, 0), brass),
    paint(new THREE.TorusGeometry(0.025, 0.006, 4, 10).translate(0.18, 0.6, 0), brass),
    paint(new THREE.BoxGeometry(0.1, 0.16, 0.1).translate(0.18, 0.415, 0), glassColour),
  ];
  for (const x of [-1, 1]) for (const z of [-1, 1]) parts.push(paint(new THREE.BoxGeometry(0.014, 0.18, 0.014).translate(0.18 + x * 0.055, 0.415, z * 0.055), brass));
  const body = new THREE.Mesh(mergeGeometries(parts), new THREE.ShaderMaterial({
    uniforms: atmo.uniforms, vertexShader: VERT, fragmentShader: FRAG, vertexColors: true,
  }));
  group.add(body);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: atmo.uniforms, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.position.set(0.18, 0.415, 0);
  glow.frustumCulled = false;
  glow.renderOrder = 8;
  group.add(glow);
  return group;
}

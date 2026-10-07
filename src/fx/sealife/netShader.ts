import * as THREE from 'three';
import { glsl } from '../../tuning';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { SWELL_GLSL, swellUniforms } from '../../world/water/swell';

/**
 * The old net at its real sizes, in metres: as it would lie flat, `long` along the whale and `near` + `far` across it
 * from its crown line; its diamond cells, strands, the rope round its edge, the float-line and the corks.
 */
export const NET = { long: 45, near: 6, far: 11, cell: 0.7, strand: 0.02, rope: 0.04, line: 0.016, cork: 0.14 };

const LIGHT = /* glsl */ `
vec3 netLight(vec3 alb, vec3 N, vec3 V, vec3 world, float through) {
  float sun = cloudShadow(world.xz);
  float ndl = dot(N, uSunDir);
  vec3 col = alb * (hemiLight(N) * 0.7 + uSunColor * max(ndl * 0.5 + 0.5, 0.0) * 0.5 * sun);
  // Thin wet fibres glow where the low sun comes through them from behind.
  col += alb * uSunColor * pow(max(dot(-V, uSunDir), 0.0), 5.0) * through * sun;
  return col;
}`;

const SHEET_VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
in float afloat;
in float contact;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;
out float vContact;
void main() {
  vec3 p = position;
  p.y += seaSurfaceY(p.xz) * afloat;
  vWorld = p;
  vNormal = normal;
  vUv = uv;
  vContact = contact;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

/**
 * Strands drawn at their real width wherever a pixel can hold them, and never thinner than a pixel: a thinner one is
 * drawn a pixel wide at the share of it the strand covers, and once a cell is finer than about two pixels its lines
 * give way to the cell's average. So the mesh never crawls or sparkles against the moving sea, near or far.
 */
const SHEET_FRAG = /* glsl */ `
${ATMO_GLSL}
${LIGHT}
uniform vec3 uStrand;
uniform vec3 uWeed;
uniform vec3 uRope;
uniform vec3 uShadow;
uniform float uFade;
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;
in float vContact;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}

/** Lines at every whole x, \`w\` of a cell wide: how much of this pixel they cover. */
float lines(float x, float w) {
  float fw = max(fwidth(x), 1e-5);
  float drawn = max(w, fw * 1.25);
  float d = abs(fract(x + 0.5) - 0.5);
  float c = (1.0 - smoothstep(drawn * 0.5 - fw * 0.5, drawn * 0.5 + fw * 0.5, d)) * w / drawn;
  return mix(c, w, smoothstep(0.35, 0.75, fw));
}

/** A line \`w\` wide along d = 0. */
float band(float d, float w) {
  float fw = max(fwidth(d), 1e-5);
  float drawn = max(w, fw * 1.25);
  return (1.0 - smoothstep(drawn * 0.5 - fw * 0.5, drawn * 0.5 + fw * 0.5, abs(d))) * w / drawn;
}

void main() {
  vec2 q = vec2(vUv.x + vUv.y, vUv.x - vUv.y) * ${glsl(Math.SQRT1_2 / NET.cell)};
  float weed = smoothstep(0.66, 0.88, vnoise(vUv * 0.42 + 3.1)) * 0.85;
  float w = ${glsl(NET.strand / NET.cell)} * (1.0 + weed * 2.2);
  float ax = lines(q.x, w);
  float ay = lines(q.y, w);
  float strand = ax + ay - ax * ay;
  float edge = min(min(vUv.x, ${glsl(NET.long)} - vUv.x), min(vUv.y + ${glsl(NET.far)}, ${glsl(NET.near)} - vUv.y));
  float rope = band(edge - ${glsl(NET.rope * 0.75)}, ${glsl(NET.rope)});
  // Where the net presses on the skin, the skin under each strand is a little darker: the net reads from further off.
  float shade = max(lines(q.x, w * 2.6), lines(q.y, w * 2.6)) * vContact * 0.4;
  float cover = max(strand, rope);
  float alpha = cover + (1.0 - cover) * shade;
  if (alpha < 0.002) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  N *= sign(dot(N, V) + 1e-4);
  vec3 alb = mix(mix(uStrand, uWeed, weed), uRope, rope / max(cover, 1e-4) * step(strand, rope));
  vec3 col = netLight(alb, N, V, vWorld, 0.9);
  col = (col * cover + uShadow * (1.0 - cover) * shade) / alpha;
  gl_FragColor = vec4(applyFog(col, vWorld), alpha * uFade);
}`;

const ROPE_VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
uniform vec2 uRes;
in vec3 along;
in float side;
in float width;
in float afloat;
in float weed;
out vec3 vWorld;
out float vSide;
out float vCover;
out float vWeed;
void main() {
  vec3 p = position;
  p.y += seaSurfaceY(p.xz) * afloat;
  vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(p + along * 0.05, 1.0);
  vec2 s0 = c0.xy / c0.w * uRes;
  vec2 s1 = c1.xy / c1.w * uRes;
  vec2 t = s1 - s0;
  t = dot(t, t) > 1e-8 ? normalize(t) : vec2(1.0, 0.0);
  float px = width * projectionMatrix[1][1] * uRes.y / c0.w;
  float drawn = max(px, 1.25);
  vCover = px / drawn;
  c0.xy += vec2(-t.y, t.x) * side * drawn * 0.5 / uRes * c0.w;
  vWorld = p;
  vSide = side;
  vWeed = weed;
  gl_Position = c0;
}`;

const ROPE_FRAG = /* glsl */ `
${ATMO_GLSL}
${LIGHT}
uniform vec3 uStrand;
uniform vec3 uWeed;
uniform float uFade;
in vec3 vWorld;
in float vSide;
in float vCover;
in float vWeed;
void main() {
  float a = vCover * (1.0 - smoothstep(0.55, 1.0, abs(vSide)));
  if (a < 0.002) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 col = netLight(mix(uStrand, uWeed, vWeed), normalize(V + vec3(0.0, 0.6, 0.0)), V, vWorld, 1.1);
  gl_FragColor = vec4(applyFog(col, vWorld), a * uFade);
}`;

const CORK_VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
in vec4 iCork;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
void main() {
  vec3 p = iCork.xyz + position * vec3(${glsl(NET.cork)}, ${glsl(NET.cork * 0.82)}, ${glsl(NET.cork)});
  p.y += seaSurfaceY(iCork.xz) * iCork.w;
  vWorld = p;
  vNormal = normal;
  vLocal = position + iCork.xyz * 3.7;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const CORK_FRAG = /* glsl */ `
${ATMO_GLSL}
${LIGHT}
uniform vec3 uCork;
uniform vec3 uFouled;
uniform float uFade;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float pit = fract(sin(dot(floor(vLocal * 6.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  vec3 alb = mix(uCork, uFouled, smoothstep(0.1, -0.7, N.y) * 0.7) * (0.85 + 0.15 * pit);
  vec3 col = netLight(alb, N, V, vWorld, 0.15);
  col += uSunColor * pow(max(dot(reflect(-V, N), uSunDir), 0.0), 24.0) * 0.12 * cloudShadow(vWorld.xz);
  if (uFade < 0.999 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) > uFade) discard;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

export const netLook = {
  uStrand: { value: new THREE.Color('#6d6747') },
  uWeed: { value: new THREE.Color('#3f4a26') },
  uRope: { value: new THREE.Color('#5b5039') },
  uShadow: { value: new THREE.Color('#151a22') },
  uCork: { value: new THREE.Color('#b09468') },
  uFouled: { value: new THREE.Color('#5d6a40') },
  /** How much of it is left as it drifts off into the haze, 1 .. 0. */
  uFade: { value: 1 },
  uRes: { value: new THREE.Vector2(800, 450) },
};

export function sheetMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SHEET_VERT,
    fragmentShader: SHEET_FRAG,
    uniforms: { ...atmo.uniforms, ...swellUniforms, ...netLook },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function ropeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: ROPE_VERT,
    fragmentShader: ROPE_FRAG,
    uniforms: { ...atmo.uniforms, ...swellUniforms, ...netLook },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

export function corkMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: CORK_VERT,
    fragmentShader: CORK_FRAG,
    uniforms: { ...atmo.uniforms, ...swellUniforms, ...netLook },
  });
}

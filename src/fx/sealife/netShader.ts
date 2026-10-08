import * as THREE from 'three';
import { glsl } from '../../tuning';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { SWELL_GLSL, swellUniforms } from '../../world/water/swell';
import { LOST_GLSL } from './whaleShader';

/**
 * The old net, in metres: as it would lie flat, `long` along the whale and up to `near` + `far` across it from its
 * crown line; its diamond cells, strands, the rope round its edge, the float-line, the net's corks and the leader's
 * floats. The cells, strands and corks are drawn larger than a real net's so they read from the boat as the paintings
 * do; the float-line and its floats stay a size a child can hold.
 */
export const NET = { long: 45, near: 22, far: 11, cell: 1.25, strand: 0.07, rope: 0.1, line: 0.016, cork: 0.27, float: 0.16, sag: 0.4, corkStep: 2.4 };
/**
 * However far off, a strand is drawn at least this opaque a line a pixel and a half wide, and once its cells are too
 * fine to draw it veils the skin at least this much: an old net reads as rope from the hold without crawling.
 */
const STRAND_FLOOR = 0.6;
const STRAND_VEIL = 0.1;

const LIGHT = /* glsl */ `
vec3 netLight(vec3 alb, vec3 N, vec3 V, vec3 world, float through) {
  float sun = cloudShadow(world.xz);
  float ndl = dot(N, uSunDir);
  vec3 col = alb * (hemiLight(N) * 0.7 + uSunColor * max(ndl * 0.5 + 0.5, 0.0) * 0.5 * sun);
  // Thin wet fibres glow where the low sun comes through them from behind.
  col += alb * uSunColor * pow(max(dot(-V, uSunDir), 0.0), 5.0) * through * sun;
  return col;
}`;

/**
 * Let go, the net sinks away into the deep, unevenly, `uSunk` metres down at most: each point is drawn where it is seen
 * through the sea, slid up its view ray to the surface, and the deeper it lies the more the sea's own colour takes it.
 */
const SINK_VERT = /* glsl */ `
uniform float uSunk;
out float vUnder;
float sunkAt(vec2 xz) {
  return uSunk * (0.65 + 0.7 * vnoise(xz * 0.11 + 3.7));
}
vec3 sunk(vec3 p, float under) {
  vUnder = 0.0;
  if (under <= 0.0) return p;
  float surface = seaSurfaceY(p.xz);
  vec3 q = vec3(p.x, p.y - under, p.z);
  vUnder = surface - q.y;
  if (vUnder <= 0.0) {
    vUnder = 0.0;
    return q;
  }
  vec3 ray = q - cameraPosition;
  vec3 w = q;
  for (int i = 0; i < 2; i++) {
    w = cameraPosition + ray * (cameraPosition.y - surface - 0.05) / max(-ray.y, 1e-3);
    surface = seaSurfaceY(w.xz);
  }
  return w;
}`;

const SINK_FRAG = /* glsl */ `
uniform vec3 uDeep;
in float vUnder;
/** How much of it still shows through the sea, and its colour there. */
float sunkShows(vec3 world, float clarity) {
  if (vUnder <= 0.0) return 1.0;
  vec3 V = normalize(cameraPosition - world);
  float F = 0.02 + 0.98 * pow(1.0 - max(V.y, 0.02), 5.0);
  return mix(1.0, (1.0 - F) * exp(-vUnder * clarity), smoothstep(0.0, 0.6, vUnder));
}
vec3 sunkColour(vec3 col, vec3 world) {
  if (vUnder <= 0.0) return col;
  vec3 deep = uDeep * (uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * cloudShadow(world.xz));
  return mix(deep, col * exp(-vec3(0.5, 0.13, 0.1) * vUnder * 2.0), exp(-vUnder * 0.6));
}`;

const SHEET_VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
${SINK_VERT}
in float afloat;
in float contact;
in vec3 edge;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;
out float vContact;
out vec3 vEdge;
out float vAfloat;
void main() {
  vec3 p = position;
  p.y += seaSurfaceY(p.xz) * afloat;
  p = sunk(p, sunkAt(p.xz));
  vWorld = p;
  vNormal = normal;
  vUv = uv;
  vContact = contact;
  vEdge = edge;
  vAfloat = afloat;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

/**
 * Old rope knotted into diamonds: no two cells quite the same size, each strand sagging a little between its knots
 * toward the edges, the near edge hanging in scallops between its corks. Strands are drawn at their width wherever
 * a pixel can hold them and otherwise a pixel and a half wide, never fainter than \`STRAND_FLOOR\`; once a cell is
 * finer than about two pixels its lines give way to a veil, so the mesh never crawls against the moving sea.
 */
const SHEET_FRAG = /* glsl */ `
${ATMO_GLSL}
${LIGHT}
uniform vec3 uStrand;
uniform vec3 uWeed;
uniform vec3 uRope;
uniform vec3 uShadow;
uniform float uFade;
${LOST_GLSL}
${SINK_FRAG}
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;
in float vContact;
in vec3 vEdge;
in float vAfloat;

float netHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float netNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(netHash(i), netHash(i + vec2(1.0, 0.0)), f.x), mix(netHash(i + vec2(0.0, 1.0)), netHash(i + 1.0), f.x), f.y);
}

/** Lines at every whole x, \`w\` of a cell wide: how much of this pixel they cover, and how far across the line it is (0 middle, 1 side). */
vec2 lines(float x, float w) {
  float fw = max(fwidth(x), 1e-5);
  float drawn = max(w, fw * 1.5);
  float d = abs(fract(x + 0.5) - 0.5);
  float c = (1.0 - smoothstep(drawn * 0.5 - fw * 0.5, drawn * 0.5 + fw * 0.5, d)) * max(w / drawn, ${glsl(STRAND_FLOOR)});
  return vec2(mix(c, max(w, ${glsl(STRAND_VEIL)}), smoothstep(0.35, 0.75, fw)), min(1.0, d / (drawn * 0.5)));
}

/** A line \`w\` wide along d = 0. */
float band(float d, float w) {
  float fw = max(fwidth(d), 1e-5);
  float drawn = max(w, fw * 1.25);
  return (1.0 - smoothstep(drawn * 0.5 - fw * 0.5, drawn * 0.5 + fw * 0.5, abs(d))) * w / drawn;
}

void main() {
  float hang = vEdge.x - ${glsl(NET.sag)} * vEdge.y * sin(3.14159 * fract((vUv.x - 0.6) / ${glsl(NET.corkStep)}));
  if (vUv.y > hang + 0.02) discard;
  // Knotted by hand and pulled about since: no two cells the same shape.
  vec2 uv = vUv + (vec2(netNoise(vUv * 0.22 + 7.0), netNoise(vUv * 0.22 + 1.7)) - 0.5) * 0.9
    + (vec2(netNoise(vUv * 0.55 + 4.3), netNoise(vUv * 0.55 + 9.1)) - 0.5) * 0.45;
  vec2 kx = vec2(uv.x + uv.y, uv.x - uv.y) * ${glsl(Math.SQRT1_2 / NET.cell)};
  float weed = smoothstep(0.62, 0.85, netNoise(vUv * 0.37 + 3.1));
  float w = ${glsl(NET.strand / NET.cell)} * (1.0 + weed * 0.5) * (1.0 + vAfloat * 0.4);
  vec2 ax = lines(kx.x, w);
  vec2 ay = lines(kx.y, w);
  float strand = ax.x + ay.x - ax.x * ay.x;
  vec2 knotAt = kx - floor(kx + 0.5);
  float kfw = max(fwidth(kx.x), 1e-5);
  float knot = (1.0 - smoothstep(w * 1.1 - kfw, w * 1.1 + kfw, length(knotAt))) * smoothstep(0.6, 0.2, kfw);
  strand = max(strand, knot);
  float edge = min(min(vUv.x, ${glsl(NET.long)} - vUv.x), min(vUv.y + ${glsl(NET.far)}, (hang - vUv.y) / sqrt(1.0 + vEdge.z * vEdge.z)));
  float rope = band(edge - ${glsl(NET.rope * 0.5)}, ${glsl(NET.rope)});
  // Round rope: lit along its top, darker down its sides.
  float across = ax.x > ay.x ? ax.y : ay.y;
  float round = mix(1.0, mix(1.18, 0.62, across * across), smoothstep(1.0, 1.5, w / kfw));
  // Where it presses on the skin the skin round each strand is a little darker.
  float shade = max(lines(kx.x, w * 2.2).x, lines(kx.y, w * 2.2).x) * vContact * 0.25;
  float cover = max(strand, rope);
  float alpha = cover + (1.0 - cover) * shade;
  if (alpha < 0.002) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  N *= sign(dot(N, V) + 1e-4);
  float age = netHash(floor(kx + 0.5) * 0.37) * 0.25;
  vec3 alb = mix(mix(uStrand * (0.88 + age), uWeed, weed * 0.75), uRope, rope / max(cover, 1e-4) * step(strand, rope)) * round;
  vec3 col = netLight(alb, N, V, vWorld, 0.35);
  col = sunkColour((col * cover + uShadow * (1.0 - cover) * shade) / alpha, vWorld);
  gl_FragColor = vec4(lost(applyFog(col, vWorld), vWorld), alpha * uFade * sunkShows(vWorld, 1.3));
}`;

const ROPE_VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
${SINK_VERT}
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
  float under = sunkAt(p.xz);
  vec3 ahead = sunk(p + along * 0.05, under);
  p = sunk(p, under);
  vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(ahead, 1.0);
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
${LOST_GLSL}
${SINK_FRAG}
in vec3 vWorld;
in float vSide;
in float vCover;
in float vWeed;
void main() {
  float a = vCover * (1.0 - smoothstep(0.55, 1.0, abs(vSide)));
  if (a < 0.002) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 col = sunkColour(netLight(mix(uStrand, uWeed, vWeed) * mix(1.15, 0.7, vSide * vSide), normalize(V + vec3(0.0, 0.6, 0.0)), V, vWorld, 1.1), vWorld);
  gl_FragColor = vec4(lost(applyFog(col, vWorld), vWorld), a * uFade * sunkShows(vWorld, 1.3));
}`;

const CORK_VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
${SINK_VERT}
in vec4 iCork;
in float iSize;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
void main() {
  vec3 p = iCork.xyz + position * vec3(1.0, 0.82, 1.0) * iSize;
  p.y += seaSurfaceY(iCork.xz) * iCork.w;
  // A float goes down last, and whole.
  p = sunk(p, max(0.0, sunkAt(iCork.xz) - 0.6));
  vWorld = p;
  vNormal = normal;
  vLocal = position * 4.5 + iCork.xyz * 1.7;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

/** An old float, cream where the sun has bleached it, with dark spots and a green-fouled underside. */
const CORK_FRAG = /* glsl */ `
${ATMO_GLSL}
${LIGHT}
uniform vec3 uCork;
uniform vec3 uSpot;
uniform vec3 uFouled;
uniform float uFade;
${LOST_GLSL}
${SINK_FRAG}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
float corkHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float corkNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(corkHash(i), corkHash(i + vec3(1, 0, 0)), f.x), mix(corkHash(i + vec3(0, 1, 0)), corkHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(corkHash(i + vec3(0, 0, 1)), corkHash(i + vec3(1, 0, 1)), f.x), mix(corkHash(i + vec3(0, 1, 1)), corkHash(i + 1.0), f.x), f.y), f.z);
}
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float spot = smoothstep(0.7, 0.76, corkNoise(vLocal));
  vec3 alb = mix(uCork, uSpot, spot * 0.85);
  alb = mix(alb, uFouled, smoothstep(0.0, -0.8, N.y) * 0.6);
  vec3 col = netLight(alb, N, V, vWorld, 0.15);
  col += uSunColor * pow(max(dot(reflect(-V, N), uSunDir), 0.0), 18.0) * 0.18 * cloudShadow(vWorld.xz);
  float shows = uFade * sunkShows(vWorld, 0.35);
  if (shows < 0.004) discard;
  gl_FragColor = vec4(lost(applyFog(sunkColour(col, vWorld), vWorld), vWorld), shows);
}`;

export const netLook = {
  uStrand: { value: new THREE.Color('#8a7650') },
  uWeed: { value: new THREE.Color('#56682c') },
  uRope: { value: new THREE.Color('#8f7c55') },
  uShadow: { value: new THREE.Color('#151a22') },
  uCork: { value: new THREE.Color('#e4d7b4') },
  uSpot: { value: new THREE.Color('#4a3622') },
  uFouled: { value: new THREE.Color('#6f7448') },
  /** How much of it is left as it drifts off into the haze, 1 .. 0. */
  uFade: { value: 1 },
  uLost: { value: 0 },
  /** How far down the net let go has sunk at most (m). */
  uSunk: { value: 0 },
  uDeep: { value: new THREE.Color('#0d4a66') },
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
    // Opaque until it fades into the haze or the deep.
    transparent: true,
  });
}

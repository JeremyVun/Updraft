import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ease, range, wrapAngle, type Rng } from '../creatures/motion';
import { CREATURE_GLSL } from '../creatures/shading';
import { Instances, blob, flipWinding, merge, mirrored, tag, type BlobSpec } from '../creatures/shapes';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { mulberry32 } from './noise';
import { REFLECTION_LAYER } from './water/reflection';

/**
 * The way the boat drifts through the flooded village, south to north. The whole island lies under the water, so
 * there is nothing to run aground on: the channel is chosen to pass close by the houses, not to avoid them.
 */
export const DROWNED_CHANNEL: THREE.Vector2[] = [
  new THREE.Vector2(-6, -1258),
  new THREE.Vector2(-34, -1318),
  new THREE.Vector2(4, -1372),
  new THREE.Vector2(-28, -1436),
  new THREE.Vector2(8, -1496),
  new THREE.Vector2(-22, -1554),
  new THREE.Vector2(-14, -1614),
];

/** The church spire: the one vertical in the village, standing east of the channel at its midpoint. */
export const SPIRE = new THREE.Vector3(14, 21, -1436);

/** Albedos are written linear: the renderer never tone-maps on the way in, so an sRGB hex would clip to white. */
const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

/** The cottage's rendered lime and thatch, taken down to what has stood a winter in the water. */
const LIME = [lin(0.36, 0.325, 0.265), lin(0.33, 0.305, 0.265), lin(0.37, 0.3, 0.225), lin(0.28, 0.275, 0.26)];
const THATCH = [lin(0.145, 0.118, 0.072), lin(0.12, 0.1, 0.066), lin(0.17, 0.132, 0.075)];
const SLATE = [lin(0.052, 0.058, 0.07), lin(0.044, 0.046, 0.055)];
const STONE = lin(0.125, 0.12, 0.112);
const HOLLOW = lin(0.014, 0.016, 0.021);
const TIMBER = lin(0.082, 0.06, 0.042);
const POT = lin(0.135, 0.072, 0.042);
const IRON = lin(0.05, 0.05, 0.055);
const LEAF_COLOURS = [lin(0.4, 0.22, 0.075), lin(0.32, 0.13, 0.05), lin(0.46, 0.32, 0.11), lin(0.2, 0.13, 0.062), lin(0.37, 0.18, 0.062)];

const PLAIN = 0;
const THATCHED = 1;
const SLATED = 2;
const OPENING = 3;
const MASONRY = 4;
const ROPE = 5;
const VANE = 6;

const VILLAGE_VERT = /* glsl */ `
${ATMO_GLSL}
uniform float uVane;
uniform float uStorm;
in vec3 color;
in vec3 aLocal;
in float aKind;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec3 vLocal;
out float vKind;

vec3 turn(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, c * p.z - s * p.x);
}

void main() {
  vec3 p = position;
  vec3 n = normal;
  if (aKind > ${VANE - 0.5}) {
    p = position - aLocal + turn(aLocal, uVane);
    n = turn(normal, uVane);
  } else if (aKind > ${ROPE - 0.5}) {
    vec2 w = texture(uWindTex, domainUv(p.xz)).xy;
    float belly = sin(aLocal.x * 3.14159);
    p.xz += w * belly * (0.014 + uStorm * 0.04);
    p.y += belly * (sin(uTime * (2.2 + uStorm * 9.0) + aLocal.x * 7.0) * (0.03 + uStorm * 0.32) + length(w) * 0.02);
  }
  vWorld = p;
  vNormal = n;
  vColor = color;
  vLocal = aLocal;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const VILLAGE_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec3 vLocal;
in float vKind;

void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  int kind = int(vKind + 0.5);
  vec3 alb = vColor;
  float grain = vnoise(vLocal.xy * 2.3 + vLocal.z) * 0.6 + vnoise(vLocal.xz * 5.5 + vLocal.y) * 0.4;
  alb *= 0.9 + 0.17 * grain;
  if (kind == ${THATCHED}) {
    float strands = vnoise(vec2(vLocal.x * 6.5, vLocal.y * 1.2)) * 0.55 + vnoise(vec2(vLocal.x * 19.0, vLocal.y * 2.6)) * 0.45;
    alb *= (0.76 + 0.44 * strands) * (0.86 + 0.28 * vnoise(vLocal.xz * 0.8));
  } else if (kind == ${SLATED}) {
    float row = vLocal.y * 3.4;
    alb *= (0.8 + 0.4 * vnoise(vec2(vLocal.x * 4.5, floor(row)))) * (0.8 + 0.25 * smoothstep(0.0, 0.2, fract(row)));
  }

  /** Where the flood has stood: dark, green and slick, with the tide mark the water keeps washing. */
  float lap = 0.09 * sin(vWorld.x * 0.8 + uTime * 1.3) + 0.06 * sin(vWorld.z * 1.1 - uTime * 0.9);
  if (kind != ${OPENING}) {
    float wet = 1.0 - smoothstep(0.0, 0.85, vWorld.y - lap);
    alb = mix(alb, alb * vec3(0.3, 0.38, 0.29), wet * 0.92);
    alb += vec3(0.022, 0.026, 0.015) * (1.0 - smoothstep(0.0, 0.25, abs(vWorld.y - lap - 0.85)));
  }

  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  float sun = cloudShadow(vWorld.xz);
  float ao = mix(0.5, 1.0, smoothstep(-1.2, 2.8, vWorld.y));
  vec3 col = alb * (hemiLight(n) * ao + uSunColor * mix(ndl, wrap * wrap, 0.25) * sun);
  vec3 V = normalize(cameraPosition - vWorld);
  float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
  float edge = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += uSunColor * edge * back * sun * (kind == ${THATCHED} ? 0.55 : 0.16) * (0.35 + alb);
  if (kind == ${OPENING}) col = vColor * uSkyAmbient * 0.5;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const TREE_VERT = /* glsl */ `
${ATMO_GLSL}
uniform float uStorm;
in vec3 aBase;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec2 w = texture(uWindTex, domainUv(aBase.xz)).xy;
  float k = pow(max(position.y - aBase.y, 0.0) / 7.0, 1.7);
  float phase = aBase.x * 0.7 + aBase.z * 0.3;
  vec2 lean = w * 0.03 + vec2(sin(uTime * 1.05 + phase), cos(uTime * 0.81 + phase * 1.7)) * (0.05 + 0.02 * length(w)) * (1.0 + uStorm * 2.2);
  vec3 p = position + vec3(lean.x, -dot(lean, lean) * 0.03, lean.y) * k;
  vWorld = p;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const TREE_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  float around = atan(n.z, n.x);
  float fissures = smoothstep(0.35, 0.75, vnoise(vec2(around * 4.0, vWorld.y * 0.8)) * 0.7 + vnoise(vec2(around * 12.0, vWorld.y * 3.0)) * 0.3);
  vec3 alb = mix(vec3(0.032, 0.027, 0.025), vec3(0.085, 0.07, 0.056), fissures);
  alb = mix(alb * vec3(0.5, 0.6, 0.45), alb, smoothstep(0.0, 1.1, vWorld.y));
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.5);
  vec3 col = alb * (hemiLight(n) + uSunColor * max(dot(n, uSunDir), 0.0) * sun) + uSunColor * rim * sun * 0.12;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const LEAF_VERT = /* glsl */ `
${ATMO_GLSL}
uniform float uStorm;
in vec4 iLeaf;
in vec4 iTint;
in vec4 iState;
out vec3 vWorld;
out vec2 vUv;
out vec3 vColor;
out vec3 vNormal;
void main() {
  float yaw = iLeaf.w;
  vec3 e1 = vec3(cos(yaw), 0.0, sin(yaw));
  vec3 e2 = vec3(-sin(yaw), 0.0, cos(yaw));
  vec3 at = iLeaf.xyz;
  float tilt;
  if (iState.x < 0.5) {
    float ride = sin(uTime * 1.7 + at.x * 0.8) * 0.5 + sin(uTime * 2.3 + at.z * 0.6) * 0.5;
    tilt = iState.w + ride * (0.16 + uStorm * 0.5);
    at.y += ride * (0.025 + uStorm * 0.05);
  } else {
    tilt = iState.w + sin(uTime * (2.4 + iState.y * 0.4) + at.x) * (0.18 + uStorm * 0.7);
    vec2 w = texture(uWindTex, domainUv(at.xz)).xy;
    float k = pow(max(at.y - iState.z, 0.0) / 7.0, 1.7);
    vec2 lean = w * 0.03 + vec2(sin(uTime * 1.05 + iState.y), cos(uTime * 0.81 + iState.y * 1.7)) * (0.05 + 0.02 * length(w)) * (1.0 + uStorm * 2.2);
    at += vec3(lean.x, -dot(lean, lean) * 0.03, lean.y) * k;
  }
  vec3 e2t = e2 * cos(tilt) - vec3(0.0, 1.0, 0.0) * sin(tilt);
  vec3 world = at + (e1 * position.x + e2t * position.y) * iTint.w;
  vUv = position.xy * 2.0;
  vWorld = world;
  vColor = iTint.rgb;
  vNormal = cross(e2t, e1);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const LEAF_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec2 vUv;
in vec3 vColor;
in vec3 vNormal;
void main() {
  vec2 q = vec2(vUv.x * 1.55, vUv.y + vUv.x * vUv.x * 0.35);
  if (dot(q, q) > 1.0) discard;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  float back = pow(max(dot(-V, uSunDir), 0.0), 3.0);
  vec3 alb = vColor * (1.0 - 0.35 * smoothstep(0.1, 0.0, abs(q.x)));
  vec3 col = alb * (hemiLight(n) * 1.6 + uSunColor * (max(dot(n, uSunDir), 0.0) * 0.8 + back * 0.9) * sun);
  col += uSunColor * pow(max(dot(reflect(-uSunDir, n), V), 0.0), 20.0) * sun * 0.2;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const BODY = 0;
const NECK = 1;
const HEAD = 2;
const LEG_L = 3;
const LEG_R = 4;
const FOLD_L = 5;
const FOLD_R = 6;
const INNER_L = 7;
const INNER_R = 8;
const OUTER_L = 9;
const OUTER_R = 10;

const GREY = 0;
const PALE = 1;
const DARK = 2;
const BILL = 3;
const SHANK = 4;
const IRIS = 5;
const PINION = 6;

const HERON = 1.4;
const SHOULDER = [0.075, 0.06, 0.04] as const;
const SHOULDER_Y = 0.1;
const INNER_SPAN = 0.55;
const OUTER_SPAN = 0.62;
/** Feet to body origin: what a heron stands on has to be this far below the instance position. */
const STAND = 0.765 * HERON;

const HERON_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in float aPart;
in vec2 aMat;
in vec4 iPos;
in vec4 iAtt;
in vec4 iWing;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
void main() {
  int part = int(aPart + 0.5);
  vec3 p = position;
  vec3 n = normal;
  float open = iWing.z;
  bool inner = part == ${INNER_L} || part == ${INNER_R};
  bool outer = part == ${OUTER_L} || part == ${OUTER_R};
  if (inner || outer) {
    float side = (part == ${INNER_L} || part == ${OUTER_L}) ? 1.0 : -1.0;
    vec3 shoulder = vec3(${SHOULDER[0]} * side, ${SHOULDER[1]}, ${SHOULDER[2]});
    vec3 wrist = shoulder + vec3(${INNER_SPAN} * side, 0.0, -0.03);
    if (outer) {
      p -= wrist;
      p = rotZ(p, side * iWing.y);
      n = rotZ(n, side * iWing.y);
      p += wrist;
    }
    p -= shoulder;
    p = rotZ(p, side * iWing.x);
    n = rotZ(n, side * iWing.x);
    p += shoulder;
    p = mix(shoulder, p, open);
  } else if (part == ${FOLD_L} || part == ${FOLD_R}) {
    p = mix(p, vec3(0.0, 0.0, 0.0), open);
  } else if (part == ${LEG_L} || part == ${LEG_R}) {
    vec3 hip = vec3(0.0, -0.05, 0.0);
    p = rotX(p - hip, 1.5 * iAtt.w) + hip;
    n = rotX(n, 1.5 * iAtt.w);
  } else if (part == ${NECK} || part == ${HEAD}) {
    if (part == ${HEAD}) {
      vec3 pivot = vec3(0.0, 0.48, 0.1);
      p = rotY(p - pivot, iWing.w) + pivot;
      n = rotY(n, iWing.w);
    }
    p.y = ${SHOULDER_Y} + (p.y - ${SHOULDER_Y}) * (1.0 + 0.7 * iAtt.z);
    p.z += 0.09 * iAtt.z;
  }
  p = rotZ(rotX(p, iAtt.x), iAtt.y);
  n = rotZ(rotX(n, iAtt.x), iAtt.y);
  vec3 world = rotY(p * ${HERON.toFixed(2)}, iPos.w) + iPos.xyz;
  vWorld = world;
  vNormal = rotY(n, iPos.w);
  vMat = aMat;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const HERON_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  int m = int(vMat.x + 0.5);
  vec3 alb = vec3(0.2, 0.21, 0.235);
  float thin = 0.2;
  float fuzz = 0.55;
  if (m == ${PALE}) alb = vec3(0.34, 0.345, 0.35);
  else if (m == ${GREY}) alb = mix(alb, vec3(0.33, 0.335, 0.34), vMat.y);
  else if (m == ${DARK}) alb = vec3(0.022, 0.024, 0.028);
  else if (m == ${BILL}) { alb = vec3(0.24, 0.17, 0.05); fuzz = 0.0; thin = 0.0; }
  else if (m == ${SHANK}) { alb = vec3(0.085, 0.075, 0.06); fuzz = 0.0; thin = 0.0; }
  else if (m == ${IRIS}) { alb = vec3(0.26, 0.2, 0.025); fuzz = 0.0; thin = 0.0; }
  else if (m == ${PINION}) { alb = mix(vec3(0.19, 0.2, 0.225), vec3(0.035, 0.038, 0.045), smoothstep(0.35, 0.95, vMat.y)); thin = 0.7; }
  vec3 col = shadeCreature(alb, N, vWorld, 1.0, fuzz, thin, 1.0);
  if (m == ${IRIS}) col += uSunColor * catchlight(N, vWorld) * 0.8;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** Merged world geometry: object-space coordinates ride along as `aLocal` so grain and the vane keep their frame. */
class Merged {
  private readonly parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, colour: THREE.Color, kind: number, m?: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count;
    if (!g.attributes.aLocal) g.setAttribute('aLocal', new THREE.BufferAttribute(Float32Array.from(g.attributes.position.array), 3));
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) col.set([colour.r, colour.g, colour.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(count).fill(kind), 1));
    if (m) g.applyMatrix4(m);
    this.parts.push(g);
  }

  build(): THREE.BufferGeometry {
    return mergeGeometries(this.parts);
  }
}

function extrude(shape: THREE.Shape, len: number, curve: number, bevel = 0): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: len,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 2,
    curveSegments: curve,
  });
  /** Thatch is a rounded shape, and an extrusion's flat facets band it like decking under a grazing sun. */
  if (curve > 1) {
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo, 1e-3);
    geo.computeVertexNormals();
  }
  geo.rotateY(Math.PI / 2);
  geo.translate(-len / 2, 0, 0);
  return geo;
}

interface HouseSpec {
  x: number;
  z: number;
  yaw: number;
  roll: number;
  len: number;
  depth: number;
  wall: number;
  rise: number;
  sink: number;
  thatched: boolean;
  lime: THREE.Color;
  roof: THREE.Color;
}

function wallShape(h: HouseSpec): THREE.Shape {
  const half = h.depth / 2;
  const s = new THREE.Shape();
  s.moveTo(-half, -2.6);
  s.lineTo(half, -2.6);
  s.lineTo(half, h.wall);
  s.lineTo(0, h.wall + h.rise - 0.35);
  s.lineTo(-half, h.wall);
  s.closePath();
  return s;
}

function thatchShape(h: HouseSpec): THREE.Shape {
  const half = h.depth / 2;
  const over = 0.5;
  const t = 0.5;
  const eave = h.wall - 0.4;
  const brow = h.wall + h.rise * 0.55;
  const apex = h.wall + h.rise;
  const s = new THREE.Shape();
  s.moveTo(-half - over, eave);
  s.quadraticCurveTo(-half * 0.5, brow, 0, apex);
  s.quadraticCurveTo(half * 0.5, brow, half + over, eave);
  s.lineTo(half + over - 0.22, eave - t * 0.7);
  s.quadraticCurveTo(half * 0.5, brow - t, 0, apex - t * 1.05);
  s.quadraticCurveTo(-half * 0.5, brow - t, -half - over + 0.22, eave - t * 0.7);
  s.closePath();
  return s;
}

function slateShape(h: HouseSpec): THREE.Shape {
  const half = h.depth / 2 + 0.28;
  const eave = h.wall - 0.1;
  const apex = h.wall + h.rise;
  const t = 0.2;
  const s = new THREE.Shape();
  s.moveTo(-half, eave);
  s.lineTo(0, apex);
  s.lineTo(half, eave);
  s.lineTo(half - 0.14, eave - t);
  s.lineTo(0, apex - t * 1.4);
  s.lineTo(-half + 0.14, eave - t);
  s.closePath();
  return s;
}

/** A dark box sunk into a wall: from the water it reads as an opening with nothing behind it. */
function opening(w: number, tall: number, deep: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, tall, deep);
}

function channelPoint(s: number, out: THREE.Vector2, tangent?: THREE.Vector2): THREE.Vector2 {
  let travelled = 0;
  for (let i = 0; i < DROWNED_CHANNEL.length - 1; i++) {
    const a = DROWNED_CHANNEL[i];
    const b = DROWNED_CHANNEL[i + 1];
    const len = a.distanceTo(b);
    if (travelled + len >= s || i === DROWNED_CHANNEL.length - 2) {
      const u = THREE.MathUtils.clamp((s - travelled) / len, 0, 1);
      tangent?.subVectors(b, a).divideScalar(len);
      return out.lerpVectors(a, b, u);
    }
    travelled += len;
  }
  return out.copy(DROWNED_CHANNEL[0]);
}

const CHANNEL_LENGTH = DROWNED_CHANNEL.reduce((sum, p, i) => (i === 0 ? 0 : sum + p.distanceTo(DROWNED_CHANNEL[i - 1])), 0);

/** Distance from the channel and how far along it the nearest point lies. */
function offChannel(x: number, z: number): { d: number; s: number } {
  let best = 1e9;
  let at = 0;
  let travelled = 0;
  for (let i = 0; i < DROWNED_CHANNEL.length - 1; i++) {
    const a = DROWNED_CHANNEL[i];
    const b = DROWNED_CHANNEL[i + 1];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const len2 = dx * dx + dz * dz;
    const u = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.y) * dz) / len2, 0, 1);
    const d = Math.hypot(x - (a.x + dx * u), z - (a.y + dz * u));
    if (d < best) {
      best = d;
      at = travelled + u * Math.sqrt(len2);
    }
    travelled += Math.sqrt(len2);
  }
  return { d: best, s: at };
}

const STREET = 0.55;
const BUCKETS = 8;

/**
 * Streets on a loose grid that the channel wanders across at an angle, so the boat keeps crossing lines of houses
 * it half recognises. Each stretch of the drift gets its own few, with a handful further out in the haze.
 */
function layout(rand: Rng): HouseSpec[] {
  const ux = Math.sin(STREET);
  const uz = -Math.cos(STREET);
  const vx = Math.cos(STREET);
  const vz = Math.sin(STREET);
  const candidates: { x: number; z: number; d: number; s: number; yaw: number }[] = [];
  for (let j = -4; j <= 4; j++) {
    for (let i = -9; i <= 9; i++) {
      for (const side of [-1, 1]) {
        const along = i * 12.5 + (rand() - 0.5) * 3.2 + (side > 0 ? 6.2 : 0);
        const across = j * 27 + side * 5.6 + (rand() - 0.5) * 1.8;
        const x = -10 + ux * along + vx * across;
        const z = -1436 + uz * along + vz * across;
        const { d, s } = offChannel(x, z);
        /** Alternate rows stand gable-on to their street: a village never quite lines up. */
        const yaw = STREET + (j % 2 === 0 ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.14;
        candidates.push({ x, z, d, s, yaw });
      }
    }
  }
  candidates.sort((a, b) => Math.sin(a.x * 12.9898 + a.z * 78.233) - Math.sin(b.x * 12.9898 + b.z * 78.233));

  const near = new Array<number>(BUCKETS).fill(0);
  const far = new Array<number>(BUCKETS).fill(0);
  const houses: HouseSpec[] = [];
  for (const c of candidates) {
    const bucket = Math.min(BUCKETS - 1, Math.floor((c.s / CHANNEL_LENGTH) * BUCKETS));
    const distant = c.d > 30;
    if (distant ? far[bucket] >= 1 || bucket % 2 === 0 || c.d > 82 : near[bucket] >= 3 || c.d < 11) continue;
    if (Math.hypot(c.x - SPIRE.x, c.z - SPIRE.z) < 16 || Math.hypot(c.x - SPIRE.x + 13, c.z - SPIRE.z) < 13) continue;
    if (houses.some((h) => Math.hypot(h.x - c.x, h.z - c.z) < 11)) continue;
    if (distant) far[bucket]++;
    else near[bucket]++;
    const terrace = !distant && rand() < 0.22;
    const depth = range(rand, 5, 6.2);
    const deep = rand() < 0.4;
    const thatched = rand() < 0.55;
    houses.push({
      x: c.x,
      z: c.z,
      yaw: c.yaw,
      roll: rand() < 0.14 ? range(rand, 0.1, 0.22) * (rand() < 0.5 ? -1 : 1) : 0,
      len: terrace ? range(rand, 15, 18) : range(rand, 8, 11.5),
      depth,
      wall: 3.4,
      rise: depth * range(rand, 0.52, 0.62),
      sink: deep ? range(rand, 4.3, 5.4) : range(rand, 1.7, 3.2),
      thatched,
      lime: LIME[Math.floor(rand() * LIME.length)],
      roof: thatched ? THATCH[Math.floor(rand() * THATCH.length)] : SLATE[Math.floor(rand() * SLATE.length)],
    });
  }
  return houses;
}

function houseMatrix(h: HouseSpec): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeTranslation(h.x, -h.sink, h.z)
    .multiply(new THREE.Matrix4().makeRotationY(h.yaw))
    .multiply(new THREE.Matrix4().makeRotationX(h.roll));
}

/** Builds one house and returns the chimney tops a heron could stand on. */
function buildHouse(into: Merged, h: HouseSpec, rand: Rng, m: THREE.Matrix4): THREE.Vector3[] {
  const ridge = h.wall + h.rise;
  into.add(extrude(wallShape(h), h.len, 1), h.lime, PLAIN, m);
  if (h.thatched) into.add(extrude(thatchShape(h), h.len + 0.85, 8, 0.22), h.roof, THATCHED, m);
  else {
    into.add(extrude(slateShape(h), h.len + 0.22, 1), h.roof, SLATED, m);
    into.add(new THREE.BoxGeometry(h.len + 0.4, 0.16, 0.36).translate(0, ridge - 0.04, 0), h.roof, SLATED, m);
  }

  const perches: THREE.Vector3[] = [];
  const stacks = h.len > 14 ? [-1, 1] : [rand() < 0.5 ? -1 : 1];
  for (const side of stacks) {
    const cx = side * (h.len / 2 - 0.75);
    const top = ridge + range(rand, 1, 2.1);
    const shaft = top - (h.wall - 0.6);
    into.add(new THREE.BoxGeometry(0.82, shaft, 0.78).translate(cx, h.wall - 0.6 + shaft / 2, 0), STONE, MASONRY, m);
    into.add(new THREE.BoxGeometry(1.04, 0.18, 1.0).translate(cx, top + 0.09, 0), STONE, MASONRY, m);
    for (const pz of rand() < 0.5 ? [0] : [-0.24, 0.24]) {
      into.add(new THREE.CylinderGeometry(0.13, 0.15, 0.4, 6).translate(cx, top + 0.38, pz), POT, MASONRY, m);
    }
    perches.push(new THREE.Vector3(cx, top + 0.2, 0).applyMatrix4(m));
  }

  /** Thatch overhangs its gable, so only a slate verge leaves an attic window anything to be seen through. */
  if (!h.thatched && ridge - h.sink > 3.2) {
    into.add(opening(0.5, 0.9, 0.75).translate((rand() < 0.5 ? -1 : 1) * (h.len / 2 - 0.2), h.wall + 0.55, 0), HOLLOW, OPENING, m);
  }
  if (h.wall - h.sink > -0.9) {
    /** The upstairs windows are set at the flood line, so the water stands in them. */
    const sill = Math.min(h.sink + 0.8, h.wall - 0.55);
    const count = h.len > 14 ? 2 : 1;
    for (const side of [-1, 1]) {
      for (let i = 0; i < count; i++) {
        const wx = (i - (count - 1) / 2) * h.len * 0.42 + range(rand, -0.6, 0.6);
        into.add(opening(0.85, 1.0, 0.5).translate(wx, sill, side * (h.depth / 2 - 0.16)), HOLLOW, OPENING, m);
        into.add(new THREE.BoxGeometry(1.1, 0.1, 0.24).translate(wx, sill + 0.58, side * (h.depth / 2 + 0.02)), TIMBER, PLAIN, m);
      }
    }
  }
  return perches;
}

/** The church: a squat tower with a slate spire and the nave roof beside it, drowned to its eaves. */
function buildChurch(into: Merged, rand: Rng): void {
  const m = new THREE.Matrix4().makeTranslation(SPIRE.x, 0, SPIRE.z);
  const stone = lin(0.21, 0.192, 0.165);
  const slate = SLATE[0];
  into.add(new THREE.BoxGeometry(4.8, 16.6, 4.8).translate(0, 3.6, 0), stone, PLAIN, m);
  into.add(new THREE.BoxGeometry(5.3, 0.34, 5.3).translate(0, 11.75, 0), stone, MASONRY, m);
  into.add(new THREE.BoxGeometry(5.2, 0.26, 5.2).translate(0, 5.4, 0), stone, MASONRY, m);
  for (const side of [-1, 1]) {
    into.add(new THREE.BoxGeometry(0.7, 16.6, 0.7).translate(side * 2.25, 3.6, 2.25), stone, PLAIN, m);
    into.add(new THREE.BoxGeometry(0.7, 16.6, 0.7).translate(side * 2.25, 3.6, -2.25), stone, PLAIN, m);
    into.add(opening(1.0, 2.5, 5.0).translate(side * 1.05, 9.5, 0), HOLLOW, OPENING, m);
    into.add(opening(5.0, 2.5, 1.0).translate(0, 9.5, side * 1.05), HOLLOW, OPENING, m);
  }

  const rings = 5;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const radius = 2.62 * Math.pow(1 - t, 1.14);
    const y = 11.95 + t * 8.7;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      pos.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let k = 0; k < 8; k++) {
      const a = r * 8 + k;
      const b = r * 8 + ((k + 1) % 8);
      idx.push(a, a + 8, b, b, a + 8, b + 8);
    }
  }
  const cone = new THREE.BufferGeometry();
  cone.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cone.setIndex(idx);
  cone.computeVertexNormals();
  into.add(cone, slate, SLATED, m);

  const nave: HouseSpec = {
    x: SPIRE.x - 9.6,
    z: SPIRE.z,
    yaw: Math.PI / 2,
    roll: 0,
    len: 17,
    depth: 7.6,
    wall: 3.2,
    rise: 3.2,
    sink: 3.6,
    thatched: false,
    lime: stone,
    roof: slate,
  };
  const nm = houseMatrix(nave);
  into.add(extrude(wallShape(nave), nave.len, 1), stone, PLAIN, nm);
  into.add(extrude(slateShape(nave), nave.len + 0.22, 1), slate, SLATED, nm);
  into.add(new THREE.BoxGeometry(nave.len + 0.4, 0.16, 0.4).translate(0, nave.wall + nave.rise - 0.04, 0), slate, SLATED, nm);
  into.add(opening(0.6, 1.3, 0.9).translate(range(rand, -5, 5), nave.wall + 0.5, 0), HOLLOW, OPENING, nm);

  const top = new THREE.Matrix4().makeTranslation(SPIRE.x, SPIRE.y - 1.5, SPIRE.z);
  into.add(new THREE.CylinderGeometry(0.06, 0.09, 2.4, 5).translate(0, 0.9, 0), IRON, MASONRY, top);
  into.add(new THREE.BoxGeometry(2.3, 0.07, 0.07).translate(0, 1.15, 0), IRON, MASONRY, top);
  into.add(new THREE.BoxGeometry(0.07, 0.07, 2.3).translate(0, 1.15, 0), IRON, MASONRY, top);
  for (const [dx, dz] of [
    [1.1, 0],
    [-1.1, 0],
    [0, 1.1],
    [0, -1.1],
  ]) {
    into.add(new THREE.SphereGeometry(0.1, 5, 4).translate(dx, 1.15, dz), IRON, MASONRY, top);
  }

  const vane = new THREE.Matrix4().makeTranslation(SPIRE.x, SPIRE.y + 0.55, SPIRE.z);
  into.add(new THREE.BoxGeometry(0.05, 0.05, 2.1).translate(0, 0, 0.15), IRON, VANE, vane);
  into.add(new THREE.BoxGeometry(0.04, 0.62, 0.78).translate(0, 0.16, -0.75), IRON, VANE, vane);
  into.add(new THREE.BoxGeometry(0.04, 0.34, 0.5).translate(0, 0.02, 1.0), IRON, VANE, vane);
  into.add(new THREE.SphereGeometry(0.11, 6, 5).translate(0, -0.42, 0), IRON, VANE, vane);
}

/** The apexes of a house's two gables, where a line could be tied. */
function gables(h: HouseSpec): THREE.Vector3[] {
  const y = h.wall + h.rise - h.sink - 0.25;
  return [-1, 1].map((s) => new THREE.Vector3(h.x + Math.cos(h.yaw) * s * h.len * 0.47, y, h.z - Math.sin(h.yaw) * s * h.len * 0.47));
}

/** A line strung between two gables with nothing left on it. */
function buildLine(into: Merged, houses: HouseSpec[]): void {
  let from: THREE.Vector3 | null = null;
  let to: THREE.Vector3 | null = null;
  let bestGap = 1e9;
  for (const a of houses) {
    if (a.wall + a.rise - a.sink < 2.8) continue;
    for (const b of houses) {
      if (a === b || b.wall + b.rise - b.sink < 2.8) continue;
      for (const p of gables(a)) {
        for (const q of gables(b)) {
          const gap = p.distanceTo(q);
          if (gap < 9 || gap > 19 || Math.abs(gap - 14) > bestGap) continue;
          bestGap = Math.abs(gap - 14);
          from = p;
          to = q;
        }
      }
    }
  }
  if (!from || !to) return;
  const segments = 14;
  const around = 4;
  const pos: number[] = [];
  const local: number[] = [];
  const idx: number[] = [];
  const centre = new THREE.Vector3();
  const sag = from.distanceTo(to) * 0.08;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    centre.lerpVectors(from, to, t);
    centre.y -= Math.sin(t * Math.PI) * sag;
    for (let k = 0; k < around; k++) {
      const ang = (k / around) * Math.PI * 2;
      pos.push(centre.x + Math.cos(ang) * 0.035, centre.y + Math.sin(ang) * 0.035, centre.z + Math.cos(ang) * 0.035);
      local.push(t, 0, 0);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < around; k++) {
      const p = i * around + k;
      const q = i * around + ((k + 1) % around);
      idx.push(p, p + around, q, q, p + around, q + around);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aLocal', new THREE.Float32BufferAttribute(local, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  into.add(geo, TIMBER, ROPE);
}

/** A field gate standing open in open water, with no field left on either side of it. */
function buildGate(into: Merged, rand: Rng, houses: HouseSpec[]): void {
  const at = new THREE.Vector2();
  const tangent = new THREE.Vector2();
  for (let attempt = 0; attempt < 60; attempt++) {
    channelPoint(CHANNEL_LENGTH * range(rand, 0.4, 0.62), at, tangent);
    const side = rand() < 0.5 ? -1 : 1;
    const off = range(rand, 12, 19);
    const x = at.x - tangent.y * off * side;
    const z = at.y + tangent.x * off * side;
    if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 14) || Math.hypot(x - SPIRE.x, z - SPIRE.z) < 28) continue;
    const m = new THREE.Matrix4().makeTranslation(x, -0.9, z).multiply(new THREE.Matrix4().makeRotationY(rand() * Math.PI));
    m.multiply(new THREE.Matrix4().makeRotationZ(0.07));
    for (const px of [-1.85, 1.85]) into.add(new THREE.BoxGeometry(0.22, 4.2, 0.22).translate(px, 0.5, 0), TIMBER, PLAIN, m);
    for (let bar = 0; bar < 5; bar++) into.add(new THREE.BoxGeometry(3.7, 0.15, 0.1).translate(0, 0.35 + bar * 0.42, 0), TIMBER, PLAIN, m);
    const brace = new THREE.BoxGeometry(4.1, 0.13, 0.08).translate(0, 1.2, 0.08);
    brace.rotateZ(0.5);
    into.add(brace, TIMBER, PLAIN, m);
    return;
  }
}

function limb(a: THREE.Vector3, b: THREE.Vector3, lift: number, r0: number, r1: number, radial: number, segments: number): THREE.BufferGeometry {
  const mid = a.clone().lerp(b, 0.5);
  mid.y += lift;
  const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  const frames = curve.computeFrenetFrames(segments, false);
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, p);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(i / segments, 0.75));
    for (let k = 0; k <= radial; k++) {
      const ang = (k / radial) * Math.PI * 2;
      n.copy(frames.normals[i]).multiplyScalar(Math.cos(ang)).addScaledVector(frames.binormals[i], Math.sin(ang));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nrm.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < radial; k++) {
      const q = i * (radial + 1) + k;
      idx.push(q, q + radial + 1, q + 1, q + radial + 1, q + radial + 2, q + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  return geo;
}

interface Twig {
  p: THREE.Vector3;
  base: number;
  phase: number;
}

/** The crown of a tree whose trunk is somewhere under the flood: the fork itself is below the water. */
function drownedTree(x: number, z: number, reach: number, rand: Rng, twigs: Twig[]): THREE.BufferGeometry[] {
  const base = new THREE.Vector3(x, -2.4, z);
  const phase = x * 0.7 + z * 0.3;
  const parts: THREE.BufferGeometry[] = [];
  const crown = new THREE.Vector3(x + range(rand, -0.4, 0.4), 0.5, z + range(rand, -0.4, 0.4));
  parts.push(limb(base, crown, 0, 0.62, 0.42, 7, 3));
  const mains = 4 + Math.floor(rand() * 2);
  const fork = new THREE.Vector3();
  const tip = new THREE.Vector3();
  for (let i = 0; i < mains; i++) {
    const a = (i / mains) * Math.PI * 2 + rand() * 0.7;
    const out = range(rand, 0.4, 0.75) * reach;
    const from = crown.clone().setY(crown.y - range(rand, 0, 1.6));
    fork.set(x + Math.cos(a) * out * 0.6, from.y + reach * range(rand, 0.45, 0.62), z + Math.sin(a) * out * 0.6);
    parts.push(limb(from, fork, -reach * 0.13, 0.38, 0.15, 6, 4));
    const forks = 2 + Math.floor(rand() * 2);
    for (let k = 0; k < forks; k++) {
      const b = a + range(rand, -1.1, 1.1);
      const far = range(rand, 0.3, 0.6) * reach;
      tip.set(fork.x + Math.cos(b) * far, fork.y + range(rand, 0.16, 0.36) * reach, fork.z + Math.sin(b) * far);
      parts.push(limb(fork, tip, -reach * 0.14, 0.15, 0.055, 5, 4));
      twigs.push({ p: tip.clone(), base: base.y, phase });
      for (let j = 0; j < 2; j++) {
        const c = b + range(rand, -1.3, 1.3);
        const spur = range(rand, 0.14, 0.3) * reach;
        const end = new THREE.Vector3(tip.x + Math.cos(c) * spur, tip.y + range(rand, -0.02, 0.2) * reach, tip.z + Math.sin(c) * spur);
        parts.push(limb(tip, end, -reach * 0.06, 0.055, 0.018, 4, 3));
        twigs.push({ p: end, base: base.y, phase });
      }
    }
  }
  return parts;
}

/** A tapered tube tagged like a blob: a neck built of ellipsoids reads as a string of beads. */
function tube(part: number, mat: number, a: THREE.Vector3, b: THREE.Vector3, lift: number, r0: number, r1: number): THREE.BufferGeometry {
  const geo = limb(a, b, lift, r0, r1, 7, 5);
  const count = geo.attributes.position.count;
  const m = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) m[i * 2] = mat;
  geo.setAttribute('aMat', new THREE.BufferAttribute(m, 2));
  return tag(geo, part);
}

/** Eight crowns along the drift, standing clear of the roofs; half of them still have leaves to give the water. */
function plantTrees(houses: HouseSpec[], rand: Rng, twigs: Twig[]): THREE.BufferGeometry {
  const limbs: THREE.BufferGeometry[] = [];
  const at = new THREE.Vector2();
  const tangent = new THREE.Vector2();
  for (let i = 0; i < 8; i++) {
    for (let attempt = 0; attempt < 40; attempt++) {
      channelPoint(CHANNEL_LENGTH * ((i + 0.5) / 8 + (rand() - 0.5) * 0.09), at, tangent);
      const side = rand() < 0.5 ? -1 : 1;
      const off = range(rand, 11, 38);
      const x = at.x - tangent.y * off * side;
      const z = at.y + tangent.x * off * side;
      if (houses.some((h) => Math.hypot(h.x - x, h.z - z) < 9.5)) continue;
      if (Math.hypot(x - SPIRE.x, z - SPIRE.z) < 18) continue;
      const bare = twigs.length;
      for (const part of drownedTree(x, z, range(rand, 7, 10), rand, twigs)) {
        const count = part.attributes.position.count;
        const base = new Float32Array(count * 3);
        for (let k = 0; k < count; k++) base.set([x, -2.4, z], k * 3);
        part.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
        limbs.push(part.toNonIndexed());
      }
      if (i % 2) twigs.length = bare;
      break;
    }
  }
  return mergeGeometries(limbs);
}

function wingPanel(part: number, span: number, chord: (s: number) => number, lead: (s: number) => number, s0: number, s1: number): THREE.BufferGeometry {
  const stations = 7;
  const around = 8;
  const pos: number[] = [];
  const mat: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= stations; i++) {
    const s = i / stations;
    const c = chord(s);
    const le = lead(s);
    const t = 0.03 * (1 - s * 0.7);
    for (let k = 0; k < around; k++) {
      const a = (k / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      pos.push(s * span, Math.sin(a) * t * (1 - along * 0.6) + Math.sin(along * Math.PI) * c * 0.06, le - c * along);
      mat.push(PINION, s0 + (s1 - s0) * s);
    }
  }
  for (let i = 0; i < stations; i++) {
    for (let k = 0; k < around; k++) {
      const a = i * around + k;
      const b = i * around + ((k + 1) % around);
      idx.push(a, a + around, b, b, a + around, b + around);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(mat, 2));
  geo.setIndex(idx);
  return tag(geo, part);
}

function placed(geo: THREE.BufferGeometry, x: number, y: number, z: number, mirror: boolean): THREE.BufferGeometry {
  if (mirror) flipWinding(geo.scale(-1, 1, 1));
  geo.translate(x, y, z);
  geo.computeVertexNormals();
  return geo;
}

function heronGeometry(): THREE.BufferGeometry {
  const [sx, sy, sz] = SHOULDER;
  const wings: THREE.BufferGeometry[] = [];
  for (const mirror of [false, true]) {
    const side = mirror ? -1 : 1;
    const inner = wingPanel(mirror ? INNER_R : INNER_L, INNER_SPAN, (s) => 0.42 - 0.06 * s, () => 0.14, 0, 0.45);
    const outer = wingPanel(mirror ? OUTER_R : OUTER_L, OUTER_SPAN, (s) => 0.36 * (1 - s * s * 0.8), (s) => 0.13 - 0.14 * s * s, 0.45, 1);
    wings.push(placed(inner, sx * side, sy, sz, mirror), placed(outer, (sx + INNER_SPAN) * side, sy, sz - 0.03, mirror));
  }
  const eye: BlobSpec = { part: HEAD, mat: IRIS, at: [0.04, 0.605, 0.205], size: [0.016, 0.016, 0.016], detail: 1 };
  const fold: BlobSpec = {
    part: FOLD_L,
    mat: PINION,
    at: [0.088, 0.02, -0.03],
    size: [0.045, 0.092, 0.28],
    shape: (u) => {
      u.y *= 1 - 0.3 * Math.max(-u.z, 0);
      u.x *= 1 - 0.35 * Math.max(-u.z, 0);
    },
    blend: (u) => Math.max(0, 0.25 - u.z),
  };
  const leg: BlobSpec = { part: LEG_L, mat: SHANK, at: [0.05, -0.4, 0.0], size: [0.021, 0.37, 0.021], detail: 1 };
  const foot: BlobSpec = { part: LEG_L, mat: SHANK, at: [0.05, -0.755, 0.03], size: [0.038, 0.015, 0.075], detail: 1 };
  const specs: BlobSpec[] = [
    {
      part: BODY,
      mat: GREY,
      at: [0, 0, 0],
      size: [0.112, 0.15, 0.37],
      shape: (u) => {
        const taper = u.z < 0 ? 1 + 0.5 * u.z : 1 - 0.25 * u.z;
        u.x *= taper;
        u.y *= taper;
      },
      blend: (u) => Math.max(0, 0.32 - u.y * 0.6),
    },
    { part: BODY, mat: GREY, at: [0, 0.01, -0.34], size: [0.06, 0.03, 0.13], detail: 1 },
    { part: HEAD, mat: PALE, at: [0, 0.6, 0.155], size: [0.057, 0.054, 0.092] },
    {
      part: HEAD,
      mat: BILL,
      at: [0, 0.578, 0.3],
      size: [0.027, 0.031, 0.195],
      detail: 1,
      shape: (u) => {
        u.x *= 1 - 0.7 * Math.max(u.z, 0);
        u.y *= 1 - 0.6 * Math.max(u.z, 0);
      },
    },
    { part: HEAD, mat: DARK, at: [0, 0.628, 0.088], size: [0.013, 0.011, 0.075], rot: [0.3, 0, 0], detail: 1 },
    eye,
    mirrored(eye, HEAD),
    fold,
    mirrored(fold, FOLD_R),
    leg,
    mirrored(leg, LEG_R),
    foot,
    mirrored(foot, LEG_R),
  ];
  const neck = tube(NECK, PALE, new THREE.Vector3(0, 0.1, 0.055), new THREE.Vector3(0, 0.56, 0.135), 0.03, 0.082, 0.045);
  return merge([...specs.map(blob), neck, ...wings]);
}

type Mode = 'perched' | 'lifting' | 'flying' | 'landing' | 'gone';

interface Bird {
  rand: Rng;
  seed: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  mode: Mode;
  roost: number;
  target: number;
  t: number;
  delay: number;
  speed: number;
  climb: number;
  flap: number;
  amp: number;
  open: number;
  legs: number;
  neck: number;
  neckGoal: number;
  nextStretch: number;
  pitch: number;
  roll: number;
  headYaw: number;
  headGoal: number;
  nextLook: number;
}

interface Drifter {
  hx: number;
  hz: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  spin: number;
}

/**
 * The drowned village: homes the water took. Roof ridges and gable ends standing out of black water, chimneys
 * with herons on them, the crowns of drowned trees, and a spire with a weathervane still turning on the wind.
 * Nobody is here and nobody says what happened. It is the room that makes a lit window at the end mean something.
 */
export class DrownedVillage {
  readonly objects: THREE.Object3D[] = [];
  private readonly storm = { value: 0 };
  private readonly vaneAngle = { value: 0 };
  private vaneSpin = 0;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly roosts: THREE.Vector3[] = [];
  private readonly birds: Bird[] = [];
  private readonly herons: Instances;
  private readonly drift: Drifter[] = [];
  private readonly leafPos: THREE.InstancedBufferAttribute;

  constructor(private readonly wind: WindField) {
    const rand = mulberry32(3140);
    const houses = layout(rand);
    const body = new Merged();
    for (const h of houses) {
      const m = houseMatrix(h);
      for (const perch of buildHouse(body, h, rand, m)) {
        if (perch.y > 2.2 && perch.y < 8 && offChannel(perch.x, perch.z).d < 34) this.roosts.push(perch);
      }
    }
    buildChurch(body, rand);
    buildLine(body, houses);
    buildGate(body, rand, houses);
    const shared = { ...atmo.uniforms, uStorm: this.storm, uVane: this.vaneAngle };
    this.objects.push(
      new THREE.Mesh(
        body.build(),
        new THREE.ShaderMaterial({ vertexShader: VILLAGE_VERT, fragmentShader: VILLAGE_FRAG, uniforms: shared }),
      ),
    );

    const twigs: Twig[] = [];
    this.objects.push(
      new THREE.Mesh(
        plantTrees(houses, rand, twigs),
        new THREE.ShaderMaterial({ vertexShader: TREE_VERT, fragmentShader: TREE_FRAG, uniforms: shared }),
      ),
    );

    const at = new THREE.Vector2();
    const tangent = new THREE.Vector2();
    const drifting = 860;
    const leaves = drifting + twigs.length * 3;
    const pos = new Float32Array(leaves * 4);
    const tint = new Float32Array(leaves * 4);
    const state = new Float32Array(leaves * 4);
    for (let i = 0; i < drifting; i++) {
      channelPoint(CHANNEL_LENGTH * rand(), at, tangent);
      const side = rand() < 0.5 ? -1 : 1;
      const off = range(rand, 3.5, 30);
      const cx = at.x - tangent.y * off * side + range(rand, -6, 6);
      const cz = at.y + tangent.x * off * side + range(rand, -6, 6);
      this.drift.push({ hx: cx, hz: cz, x: cx, z: cz, vx: 0, vz: 0, yaw: rand() * 6.28, spin: range(rand, -0.25, 0.25) });
      const c = LEAF_COLOURS[Math.floor(rand() * LEAF_COLOURS.length)];
      tint.set([c.r, c.g, c.b, range(rand, 0.4, 0.62)], i * 4);
      state.set([0, 0, 0, range(rand, -0.3, 0.3)], i * 4);
      pos.set([cx, 0.045, cz, this.drift[i].yaw], i * 4);
    }
    for (let i = 0; i < twigs.length * 3; i++) {
      const twig = twigs[Math.floor(i / 3)];
      const k = drifting + i;
      const c = LEAF_COLOURS[Math.floor(rand() * LEAF_COLOURS.length)];
      pos.set([twig.p.x + range(rand, -0.32, 0.32), twig.p.y + range(rand, -0.45, 0.2), twig.p.z + range(rand, -0.32, 0.32), rand() * 6.28], k * 4);
      tint.set([c.r, c.g, c.b, range(rand, 0.22, 0.33)], k * 4);
      state.set([1, twig.phase, twig.base, range(rand, -1.4, 1.4)], k * 4);
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    const leafGeo = new THREE.InstancedBufferGeometry();
    leafGeo.index = quad.index;
    leafGeo.setAttribute('position', quad.attributes.position);
    this.leafPos = new THREE.InstancedBufferAttribute(pos, 4).setUsage(THREE.DynamicDrawUsage);
    leafGeo.setAttribute('iLeaf', this.leafPos);
    leafGeo.setAttribute('iTint', new THREE.InstancedBufferAttribute(tint, 4));
    leafGeo.setAttribute('iState', new THREE.InstancedBufferAttribute(state, 4));
    leafGeo.instanceCount = leaves;
    leafGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(-10, 0, -1440), 400);
    this.objects.push(
      new THREE.Mesh(
        leafGeo,
        new THREE.ShaderMaterial({ vertexShader: LEAF_VERT, fragmentShader: LEAF_FRAG, uniforms: shared, side: THREE.DoubleSide }),
      ),
    );

    this.roosts.sort((a, b) => b.z - a.z);
    this.herons = new Instances(heronGeometry(), 6, ['iPos', 'iAtt', 'iWing']);
    for (let i = 0; i < 5 && this.roosts.length > 6; i++) {
      const roost = Math.min(this.roosts.length - 1, Math.floor(((i + 0.5) / 5) * this.roosts.length));
      const r = this.roosts[roost];
      const bird = mulberry32(700 + i * 31);
      this.birds.push({
        rand: bird,
        seed: bird(),
        x: r.x,
        y: r.y + STAND,
        z: r.z,
        yaw: bird() * 6.28,
        mode: 'perched',
        roost,
        target: roost,
        t: 0,
        delay: 0,
        speed: 0,
        climb: 0,
        flap: bird() * 6.28,
        amp: 0,
        open: 0,
        legs: 0,
        neck: 0,
        neckGoal: 0,
        nextStretch: range(bird, 8, 30),
        pitch: 0,
        roll: 0,
        headYaw: 0,
        headGoal: 0,
        nextLook: range(bird, 2, 7),
      });
    }
    this.objects.push(
      new THREE.Mesh(
        this.herons.geometry,
        new THREE.ShaderMaterial({ vertexShader: HERON_VERT, fragmentShader: HERON_FRAG, uniforms: shared, side: THREE.DoubleSide }),
      ),
    );

    for (const o of this.objects) {
      o.frustumCulled = false;
      o.layers.enable(REFLECTION_LAYER);
      if (o instanceof THREE.Mesh && !o.geometry.boundingSphere) o.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-10, 0, -1440), 400);
    }
  }

  /** `boat` is where the boat is, so herons lift off as it comes by; `storm` is 0 calm to 1 the squall at the end. */
  update(dt: number, time: number, boat: THREE.Vector3, storm: number): void {
    this.storm.value = storm;
    this.turnVane(dt, storm);
    this.flyHerons(dt, time, boat, storm);
    this.driftLeaves(dt, boat, storm);
  }

  /**
   * The vane is a pendulum the wind pushes, not an arrow that points: it hunts, overshoots and, once the squall
   * gets behind it, goes over the top and spins.
   */
  private turnVane(dt: number, storm: number): void {
    const w = this.wind.sample(SPIRE.x, SPIRE.z, this.sample);
    const breeze = this.wind.breeze;
    const wx = Math.abs(w.x) + Math.abs(w.z) > 0.25 ? w.x : breeze.x;
    const wz = Math.abs(w.x) + Math.abs(w.z) > 0.25 ? w.z : breeze.y;
    const speed = Math.hypot(wx, wz);
    const into = Math.atan2(-wx, -wz);
    this.vaneSpin += Math.sin(wrapAngle(into - this.vaneAngle.value)) * (0.6 + speed * speed * 0.05) * dt;
    this.vaneSpin += (Math.sin(this.vaneAngle.value * 2.7) + 1.4) * storm * storm * 3.2 * dt;
    this.vaneSpin *= Math.exp(-dt * (2.2 - storm * 1.6));
    this.vaneSpin = THREE.MathUtils.clamp(this.vaneSpin, -9, 9);
    this.vaneAngle.value = wrapAngle(this.vaneAngle.value + this.vaneSpin * dt);
  }

  private flyHerons(dt: number, time: number, boat: THREE.Vector3, storm: number): void {
    let airborne = 0;
    for (const h of this.birds) if (h.mode === 'lifting' || h.mode === 'flying') airborne++;
    let shown = 0;
    for (const h of this.birds) {
      if (h.mode === 'gone') continue;
      const rand = h.rand;
      const roost = this.roosts[Math.max(h.target, 0)];
      if (h.mode === 'perched') {
        h.y = this.roosts[h.roost].y + STAND;
        h.nextLook -= dt;
        if (h.nextLook <= 0) {
          h.nextLook = range(rand, 2.5, 9);
          h.headGoal = (rand() - 0.5) * 1.4;
        }
        h.nextStretch -= dt;
        if (h.nextStretch <= 0) {
          h.nextStretch = range(rand, 14, 40);
          h.neckGoal = h.neckGoal > 0.2 ? 0 : range(rand, 0.55, 1);
        }
        h.pitch = ease(h.pitch, Math.sin(time * 0.6 + h.seed * 9) * 0.03, 1, dt);
        const spooked = Math.hypot(boat.x - h.x, boat.z - h.z) < 22 && airborne < 2;
        if (spooked || storm > 0.22) {
          h.mode = 'lifting';
          h.t = 0;
          h.delay = range(rand, 0.2, 1.1);
          h.neckGoal = 0;
          h.yaw = Math.atan2(h.x - boat.x, h.z - boat.z);
          airborne++;
          h.target = storm > 0.22 ? -1 : this.pickRoost(h, boat, rand);
        }
      } else if (h.mode === 'lifting') {
        h.t += dt;
        if (h.t > h.delay) {
          const launch = h.t - h.delay;
          h.open = ease(h.open, 1, 9, dt);
          h.amp = ease(h.amp, 1, 6, dt);
          h.speed = ease(h.speed, 6.5, 1.2, dt);
          h.climb = ease(h.climb, 3.2, 2.5, dt);
          h.legs = ease(h.legs, 1, 1.4, dt);
          if (launch > 1.1) h.mode = 'flying';
        } else {
          h.pitch = ease(h.pitch, -0.18, 5, dt);
        }
      } else {
        const tx = h.target < 0 ? h.x * 0.2 - 40 : roost.x;
        const tz = h.target < 0 ? h.z - 400 : roost.z;
        const ty = h.target < 0 ? 34 : roost.y + STAND;
        const reach = Math.hypot(tx - h.x, tz - h.z);
        const want = Math.atan2(tx - h.x, tz - h.z);
        h.yaw += THREE.MathUtils.clamp(wrapAngle(want - h.yaw) * 1.4, -0.5, 0.5) * dt;
        h.roll = ease(h.roll, THREE.MathUtils.clamp(wrapAngle(want - h.yaw) * -0.8, -0.5, 0.5), 2, dt);
        if (h.mode === 'flying') {
          const cruise = Math.max(ty, 8) + 7 + h.seed * 5;
          h.climb = ease(h.climb, THREE.MathUtils.clamp(cruise - h.y, -2, 2.4), 1.2, dt);
          h.speed = ease(h.speed, 7.5 + storm * 2, 0.8, dt);
          h.amp = ease(h.amp, Math.sin(h.t * 0.42 + h.seed * 5) > 0.72 ? 0.15 : 1, 2.5, dt);
          h.t += dt;
          if (h.target >= 0 && reach < 15 && h.t > 2.5) h.mode = 'landing';
          if (h.target < 0 && Math.hypot(h.x - boat.x, h.z - boat.z) > 210) h.mode = 'gone';
        } else {
          h.speed = ease(h.speed, 1.6, 1.6, dt);
          h.climb = ease(h.climb, THREE.MathUtils.clamp(ty - h.y, -1.6, 0.4), 2.2, dt);
          h.legs = ease(h.legs, 0, 3, dt);
          h.amp = ease(h.amp, reach < 5 ? 0.45 : 0.8, 3, dt);
          h.pitch = ease(h.pitch, 0.3, 3, dt);
          if (reach < 1.4 && Math.abs(h.y - ty) < 0.6) {
            h.mode = 'perched';
            h.roost = h.target;
            h.x = roost.x;
            h.z = roost.z;
            h.y = ty;
            h.t = 0;
            h.speed = 0;
            h.climb = 0;
            h.nextLook = range(rand, 1, 4);
          }
        }
      }
      if (h.mode === 'lifting' || h.mode === 'flying' || h.mode === 'landing') {
        h.x += Math.sin(h.yaw) * h.speed * dt;
        h.z += Math.cos(h.yaw) * h.speed * dt;
        h.y += h.climb * dt;
      }

      if (h.mode !== 'perched') {
        h.flap += dt * Math.PI * 2 * (h.mode === 'landing' ? 1.5 : 2.0);
        h.pitch = ease(h.pitch, h.mode === 'landing' ? 0.3 : -h.climb * 0.06, 2, dt);
      } else {
        h.open = ease(h.open, 0, 7, dt);
        h.amp = ease(h.amp, 0, 5, dt);
        h.legs = ease(h.legs, 0, 4, dt);
        h.roll = ease(h.roll, 0, 3, dt);
      }
      h.neck = ease(h.neck, h.neckGoal, 0.8, dt);
      h.headYaw = ease(h.headYaw, h.mode === 'perched' ? h.headGoal : 0, 3, dt);

      const beat = Math.sin(h.flap);
      const glide = h.mode === 'landing' ? 0.5 : 0.1;
      const inner = glide + beat * 0.8 * h.amp;
      const outer = (h.mode === 'landing' ? 0.35 : -0.12) + Math.sin(h.flap - 1.0) * 0.6 * h.amp;
      this.herons.set(0, shown, h.x, h.y, h.z, h.yaw);
      this.herons.set(1, shown, h.pitch, h.roll, h.neck, h.legs);
      this.herons.set(2, shown, inner, outer, h.open, h.headYaw);
      shown++;
    }
    this.herons.commit(shown);
  }

  /** A roost well clear of whatever put it up, and never the one it just left. */
  private pickRoost(h: Bird, boat: THREE.Vector3, rand: Rng): number {
    const taken = new Set(this.birds.map((b) => b.target));
    let best = h.roost;
    let bestScore = -1e9;
    for (let i = 0; i < this.roosts.length; i++) {
      if (taken.has(i)) continue;
      const r = this.roosts[i];
      const fromBoat = Math.hypot(r.x - boat.x, r.z - boat.z);
      const fromHere = Math.hypot(r.x - h.x, r.z - h.z);
      if (fromBoat < 34 || fromHere < 22 || fromHere > 110) continue;
      const score = fromBoat - Math.abs(fromHere - 60) * 0.5 + rand() * 20;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  private driftLeaves(dt: number, boat: THREE.Vector3, storm: number): void {
    if (Math.abs(boat.z + 1440) > 320) return;
    const pull = 0.2 + storm * 0.45;
    const array = this.leafPos.array as Float32Array;
    for (let i = 0; i < this.drift.length; i++) {
      const l = this.drift[i];
      if (Math.abs(l.z - boat.z) > 130) continue;
      const w = this.wind.sample(l.x, l.z, this.sample);
      l.vx += ((w.x * pull - l.vx) * 2 + (l.hx - l.x) * 0.05) * dt;
      l.vz += ((w.z * pull - l.vz) * 2 + (l.hz - l.z) * 0.05) * dt;
      l.x += l.vx * dt;
      l.z += l.vz * dt;
      l.yaw += (l.spin + w.energy * 0.8) * dt;
      array[i * 4] = l.x;
      array[i * 4 + 2] = l.z;
      array[i * 4 + 3] = l.yaw;
    }
    this.leafPos.clearUpdateRanges();
    this.leafPos.addUpdateRange(0, this.drift.length * 4);
    this.leafPos.needsUpdate = true;
  }
}

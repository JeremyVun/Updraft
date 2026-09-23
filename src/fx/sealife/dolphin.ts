import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CREATURE_GLSL } from '../../creatures/shading';
import { flipWinding } from '../../creatures/shapes';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { mirrorWater } from '../../world/sky-mirror-layout';
import { REFLECTION_LAYER } from '../../world/water/reflection';
import { SWELL_GLSL, swellLift, swellUniforms } from '../../world/water/swell';
import { curve } from './curve';
import { FOAM, Marks, RING, SLICK } from './marks';

/** Beak tip to the notch of the flukes, in world units. */
const LEN = tuning.dolphins.length;
/** The rest pose is drawn at this length and scaled to `LEN`, so the whole animal keeps its proportions. */
const DRAWN = 2.2;
const SCALE = LEN / DRAWN;
/** How high the back rides above the beak, once scaled: what has to clear the water for the dolphin to be out. */
const BACK = 0.172 * SCALE * tuning.dolphins.girth;
const G = 9.8;
/** Where the beak rides when the body lies level at the surface. */
const BASE_Y = -0.14;
/** Runners in loose ones and twos, then the two that ride the bow wave. */
const SHOALS = [1, 2, 1, 2];
const RIDERS = 2;
const POD = SHOALS.reduce((a, b) => a + b, 0) + RIDERS;

const BODY = 0;
const DORSAL = 1;
const FLIPPER = 2;
const FLUKES = 3;

const rand = (lo: number, hi: number) => lo + (hi - lo) * Math.random();
const ease = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);
const f = (x: number) => x.toFixed(4);

/** Heights of the back and belly and the half width along the body (0 beak tip, 1 fluke notch). */
const TOP = curve([
  [0, 0.016], [0.025, 0.038], [0.06, 0.048], [0.095, 0.058], [0.115, 0.088], [0.145, 0.128], [0.2, 0.155],
  [0.3, 0.17], [0.4, 0.172], [0.5, 0.162], [0.6, 0.138], [0.7, 0.108], [0.8, 0.078], [0.88, 0.055], [0.95, 0.036], [1, 0.022],
]);
const BOTTOM = curve([
  [0, -0.01], [0.025, -0.03], [0.06, -0.04], [0.095, -0.05], [0.12, -0.085], [0.16, -0.125], [0.24, -0.155],
  [0.34, -0.162], [0.45, -0.152], [0.55, -0.135], [0.65, -0.112], [0.75, -0.085], [0.85, -0.058], [0.93, -0.038], [1, -0.02],
]);
const HALF = curve([
  [0, 0.007], [0.025, 0.022], [0.06, 0.029], [0.095, 0.035], [0.12, 0.058], [0.16, 0.085], [0.24, 0.112],
  [0.34, 0.122], [0.45, 0.115], [0.55, 0.098], [0.65, 0.076], [0.75, 0.052], [0.85, 0.033], [0.93, 0.024], [1, 0.014],
]);

function build(pos: number[], rig: number[], idx: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aRig', new THREE.Float32BufferAttribute(rig, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function stitch(idx: number[], loops: number, around: number): void {
  for (let i = 0; i < loops - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      idx.push(a, b, a + around, b, b + around, a + around);
    }
  }
}

/** A slim body: a beaked head with a creased melon, the girth just behind the flippers, a compressed tail stock. */
function body(): THREE.BufferGeometry {
  const rings = 54;
  const around = 16;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const s = 0.5 - 0.5 * Math.cos((Math.PI * i) / rings);
    const top = TOP(s);
    const bottom = BOTTOM(s);
    const w = HALF(s);
    const cy = (top + bottom) / 2;
    const h = (top - bottom) / 2;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const e = ca < 0 ? 1.2 : 1;
      const v = Math.sign(ca) * Math.abs(ca) ** e;
      pos.push(w * Math.sign(sa) * Math.abs(sa) ** e, cy + h * v, -s * DRAWN);
      rig.push(s, BODY, v, j / around);
    }
  }
  stitch(idx, rings + 1, around);
  const nose = pos.length / 3;
  pos.push(0, (TOP(0) + BOTTOM(0)) / 2, 0.01);
  rig.push(0, BODY, 0, 0);
  for (let j = 0; j < around; j++) idx.push(nose, (j + 1) % around, j);
  const tail = pos.length / 3;
  pos.push(0, 0, -DRAWN - 0.01);
  rig.push(1, BODY, 0, 0);
  const last = rings * around;
  for (let j = 0; j < around; j++) idx.push(tail, last + j, last + ((j + 1) % around));
  return build(pos, rig, idx);
}

/** The tall falcate fin: raked hard back, its trailing edge cut away so the tip hooks. */
function dorsal(): THREE.BufferGeometry {
  const levels = 8;
  const around = 10;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  const root = -0.4 * DRAWN;
  const base = TOP(0.45) - 0.045;
  for (let k = 0; k <= levels; k++) {
    const h = k / levels;
    const lead = root - 0.42 * h ** 1.45;
    const chord = 0.4 * (1 - h) ** 1.35 + 0.025;
    const thick = 0.03 * (1 - h * 0.75) + 0.004;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const z = lead - along * chord;
      pos.push(Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85), base + h * 0.26, z);
      rig.push(-z / DRAWN, DORSAL, 1, along);
    }
  }
  stitch(idx, levels + 1, around);
  const tip = pos.length / 3;
  pos.push(0, base + 0.268, root - 0.45);
  rig.push(-(root - 0.45) / DRAWN, DORSAL, 1, 0.5);
  const last = levels * around;
  for (let j = 0; j < around; j++) idx.push(tip, last + j, last + ((j + 1) % around));
  return build(pos, rig, idx);
}

/** A pointed pectoral flipper, set low and swept back. */
function flipper(): THREE.BufferGeometry {
  const stations = 18;
  const around = 8;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  const root = new THREE.Vector3(0.072, -0.072, -0.2 * DRAWN);
  const e1 = new THREE.Vector3(0.62, -0.42, -0.66).normalize();
  const back = new THREE.Vector3(0, 0, -1);
  const e2 = back.clone().addScaledVector(e1, -back.dot(e1)).normalize();
  const e3 = new THREE.Vector3().crossVectors(e2, e1);
  const span = 0.34;
  const s = -root.z / DRAWN;
  const p = new THREE.Vector3();
  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const chord = 0.135 * Math.sqrt(Math.max(1 - t ** 2.6, 0)) * (0.82 + 0.18 * Math.sin(Math.PI * t)) + 0.012;
    const thick = 0.02 * (1 - 0.72 * t) + 0.003;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const th = Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85);
      p.copy(root)
        .addScaledVector(e1, t * span)
        .addScaledVector(e2, 0.2 * t * t + (along - 0.3) * chord)
        .addScaledVector(e3, th);
      pos.push(p.x, p.y, p.z);
      rig.push(s, FLIPPER, 1, along);
    }
  }
  stitch(idx, stations + 1, around);
  const tip = pos.length / 3;
  p.copy(root).addScaledVector(e1, span + 0.02).addScaledVector(e2, 0.22);
  pos.push(p.x, p.y, p.z);
  rig.push(s, FLIPPER, 1, 0.5);
  const last = stations * around;
  for (let j = 0; j < around; j++) idx.push(tip, last + j, last + ((j + 1) % around));
  return build(pos, rig, idx);
}

/** Small swept flukes with a deep notch between them. */
function flukes(): THREE.BufferGeometry {
  const stations = 36;
  const around = 8;
  const pos: number[] = [];
  const rig: number[] = [];
  const idx: number[] = [];
  const hinge = -0.985 * DRAWN;
  for (let i = 0; i <= stations; i++) {
    const t = -1 + (2 * i) / stations;
    const at = Math.abs(t);
    const lead = hinge + 0.035 - 0.3 * at ** 1.6;
    const chord = 0.3 * Math.max(1 - at ** 2.4, 0) ** 0.55 + 0.02;
    const trail = lead - chord + 0.075 * Math.exp(-((t / 0.1) ** 2));
    const thick = 0.026 * (1 - at) ** 0.9 + 0.003;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const z = lead + (trail - lead) * along;
      pos.push(t * 0.3, Math.sin(a) * thick * 2.4 * Math.sqrt(along + 0.02) * (1 - along * 0.85), z);
      rig.push(-z / DRAWN, FLUKES, 1, along);
    }
  }
  const raw: number[] = [];
  stitch(raw, stations + 1, around);
  for (let k = 0; k < raw.length; k += 3) idx.push(raw[k], raw[k + 2], raw[k + 1]);
  return build(pos, rig, idx);
}

/** The whole dolphin in its rest pose: beak at the origin, lying along -z, back up. */
function dolphinGeometry(): THREE.BufferGeometry {
  const right = flipWinding(flipper().scale(-1, 1, 1));
  right.computeVertexNormals();
  const geo = mergeGeometries([body(), dorsal(), flipper(), right, flukes()]);
  if (!geo) throw new Error('dolphin parts do not share attributes');
  geo.scale(SCALE * tuning.dolphins.girth, SCALE * tuning.dolphins.girth, SCALE);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return geo;
}

/**
 * Bends the rest pose and puts it in the world. The body is a rod of fixed length whose tangent turns by `flexAt`
 * in the vertical and `bendAt` sideways as you walk back from the beak, so a travelling tail beat, the long arch
 * of a leap and the sweep of the tail through a turn all keep it its own size.
 */
const RIG_GLSL = /* glsl */ `
in vec4 aRig;
in vec4 iA;
in vec4 iB;
in vec4 iC;
in vec4 iT;
out vec4 vRig;
out vec3 vRest;
out vec3 vRestNormal;
out float vWet;
out float vSeed;

float flexAt(float a) {
  float s = a / ${f(LEN)};
  return iB.w * pow(min(s, 1.15), 1.25) + iC.y * smoothstep(0.1, 0.95, s) * sin(iC.x - 4.4 * s);
}

float bendAt(float a) {
  return iT.x * min(a / ${f(LEN)}, 1.15);
}

vec3 place(vec3 rest, inout vec3 n) {
  float a = -rest.z;
  vec3 c = vec3(0.0);
  float th = 0.0;
  float ps = 0.0;
  for (int i = 0; i < 12; i++) {
    float a0 = float(i) * ${f(LEN / 10)};
    float seg = min(${f(LEN / 10)}, a - a0);
    if (seg <= 0.0) break;
    float m = flexAt(a0 + seg * 0.5);
    float b = bendAt(a0 + seg * 0.5);
    c += vec3(-sin(b) * cos(m), sin(m), -cos(b) * cos(m)) * seg;
    th = flexAt(a0 + seg);
    ps = bendAt(a0 + seg);
  }
  vec3 p = (c + rotY(rotX(vec3(rest.x, rest.y, 0.0), th), ps)) * iB.z;
  n = rotY(rotX(n, th), ps);
  p = rotY(rotX(rotZ(p, iB.y), -iB.x), iA.w);
  n = rotY(rotX(rotZ(n, iB.y), -iB.x), iA.w);
  vRig = aRig;
  vRest = rest;
  vRestNormal = normal;
  vWet = iC.z;
  vSeed = iC.w;
  return iA.xyz + p;
}
`;

/** The hourglass: a dark cape that plunges to a point under the dorsal, tan ahead of it and pale grey behind. */
const SKIN_GLSL = /* glsl */ `
in vec4 vRig;
in vec3 vRest;
in vec3 vRestNormal;
in float vWet;
in float vSeed;

const vec3 CAPE = vec3(0.036, 0.048, 0.068);
const vec3 SLATE = vec3(0.082, 0.094, 0.11);
const vec3 TAN = vec3(0.275, 0.205, 0.12);
const vec3 ASH = vec3(0.15, 0.157, 0.16);
const vec3 BELLY = vec3(0.33, 0.325, 0.295);
const vec3 INK = vec3(0.016, 0.02, 0.026);

struct Skin {
  vec3 albedo;
  float thin;
};

float capeLine(float s) {
  return 0.42 + 0.3 * smoothstep(0.5, 0.78, s) - 1.15 * exp(-pow((s - 0.47) / 0.16, 2.0)) - 1.25 * smoothstep(0.8, 1.04, s);
}

Skin skin() {
  int part = int(vRig.y + 0.5);
  float s = vRig.x;
  float v = vRig.z;
  vec3 rn = normalize(vRestNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float grain = vnoise(vRest.zx * vec2(7.0, 13.0) + vSeed * 37.0) - 0.5;
  Skin k = Skin(CAPE, 0.0);
  if (part == ${BODY}) {
    float cape = smoothstep(-0.13, 0.13, v - capeLine(s) + grain * 0.11);
    float floorLine = -0.4 - 0.38 * smoothstep(0.55, 0.95, s) + 0.28 * (1.0 - smoothstep(0.06, 0.25, s));
    float pale = (1.0 - smoothstep(-0.12, 0.12, v - floorLine + grain * 0.06));
    k.albedo = mix(mix(mix(TAN, ASH, smoothstep(0.44, 0.63, s)), BELLY, pale), CAPE, cape);
    float stripe = (1.0 - smoothstep(0.0, 0.11, abs(v - mix(-0.5, -0.88, smoothstep(0.1, 0.21, s))))) * smoothstep(0.085, 0.105, s) * (1.0 - smoothstep(0.2, 0.25, s));
    float beak = (1.0 - smoothstep(0.08, 0.118, s)) * smoothstep(-0.6, -0.15, v);
    k.albedo = mix(k.albedo, INK, max(stripe * 0.75, beak * 0.85));
    float eye = length(vec2((s - 0.128) * ${f(DRAWN)}, (v - 0.3) * 0.17));
    k.albedo = mix(k.albedo, INK, (1.0 - smoothstep(0.017, 0.03, eye)));
  } else {
    k.albedo = mix(CAPE, SLATE, (1.0 - smoothstep(-0.35, 0.25, rn.y)) * 0.45);
    k.thin = 0.35;
  }
  return k;
}
`;

const DOLPHIN_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${RIG_GLSL}
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec3 n = normal;
  vWorld = place(position, n);
  vNormal = n;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const DOLPHIN_FRAG = /* glsl */ `
${ATMO_GLSL}
${SKIN_GLSL}
uniform vec3 uSeaTint;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  Skin k = skin();
  float sun = cloudShadow(vWorld.xz);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  float nv = clamp(dot(N, V), 0.0, 1.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 2.0);
  vec3 ambient = mix(uSeaTint * uSkyAmbient, uSkyAmbient * 1.15, N.y * 0.5 + 0.5);
  vec3 col = k.albedo * (ambient + uSunColor * (wrap * wrap * 0.8 + 0.05) * sun);
  col += k.albedo * uSunColor * sun * k.thin * back * max(-ndl, 0.0) * 1.3;

  float sheet = vWet * smoothstep(-0.05, 0.25, vWorld.y) * smoothstep(-0.15, 0.45, N.y);
  vec2 flow = vec2(vRig.w * 5.0 + vRest.x * 3.0, vWorld.y * 4.0 + uTime * 2.2);
  float streak = smoothstep(0.62, 0.95, vnoise(vec2(flow.x * 2.2, flow.y)) * 0.7 + vnoise(vec2(flow.x * 6.5, flow.y * 3.0)) * 0.3);
  float gloss = 0.3 + 0.7 * sheet;

  vec3 R = reflect(-V, N);
  vec3 env = skyColor(vec3(R.x, max(R.y, 0.02), R.z));
  env = mix(env, uSeaTint * uSkyAmbient * 1.4, (1.0 - smoothstep(-0.3, 0.0, R.y)));
  float F = 0.035 + 0.965 * pow(1.0 - nv, 5.0);
  col = mix(col, env, F * (0.3 + 0.34 * gloss));
  vec3 H = halfVector(uSunDir, V);
  col += uSunColor * pow(max(dot(N, H), 0.0), mix(60.0, 170.0, gloss)) * (0.35 + (0.7 + 0.9 * streak) * sheet) * sun;
  col += vec3(0.85, 0.9, 0.95) * (uSkyAmbient * 0.7 + uSunColor * (0.1 + back * 0.8) * sun) * streak * sheet * 0.2;
  col += uSunColor * pow(1.0 - nv, 6.0) * back * smoothstep(-0.3, 0.5, ndl) * 0.6 * sun;

  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** The submerged body seen through the sea: slid up its view ray to the surface, tinted and faded by the water. */
const GHOST_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${RIG_GLSL}
${SWELL_GLSL}
out vec3 vSurface;
out float vDepth;
void main() {
  vec3 n = normal;
  vec3 w = place(position, n);
  float surface = seaSurfaceY(w.xz);
  vDepth = surface - w.y;
  vec3 ray = w - cameraPosition;
  if (vDepth > -0.04) {
    for (int i = 0; i < 2; i++) {
      w = cameraPosition + ray * (cameraPosition.y - surface - 0.035) / max(-ray.y, 1e-3);
      surface = seaSurfaceY(w.xz);
    }
  }
  vSurface = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const GHOST_FRAG = /* glsl */ `
${ATMO_GLSL}
${SKIN_GLSL}
uniform vec3 uDeep;
uniform vec3 uAbsorb;
in vec3 vSurface;
in float vDepth;
void main() {
  if (vDepth < -0.02) discard;
  Skin k = skin();
  float depth = max(vDepth, 0.0);
  vec3 V = normalize(cameraPosition - vSurface);
  float nv = max(V.y, 0.02);
  float cosT = sqrt(max(1.0 - (1.0 - nv * nv) / 1.77, 0.05));
  float path = depth / cosT;
  float F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  float sun = cloudShadow(vSurface.xz);
  vec3 light = uSkyAmbient * 1.2 + uSunColor * max(uSunDir.y, 0.0) * 1.1 * sun;
  vec3 deep = uDeep * (uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * sun);
  float clear = exp(-path * 0.62);
  vec3 col = mix(deep, k.albedo * light * exp(-uAbsorb * (path + depth)), clear);
  float a = (1.0 - F) * clear * smoothstep(-0.02, 0.06, vDepth) * 0.48;
  if (a < 0.004) discard;
  col = applyFog(col, vSurface);
  gl_FragColor = vec4(col * a, a);
}`;

const DROPS = 320;

const DROP_VERT = /* glsl */ `
${ATMO_GLSL}
in vec4 iD;
in vec4 iE;
in vec4 iF;
out vec2 vQ;
out vec3 vWorld;
out float vSoft;
out float vAlpha;
out float vSeed;
void main() {
  vec3 p = iD.xyz;
  vec3 along = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 across = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  float stretch = 1.0;
  if (iE.w < 0.5) {
    vec3 toCam = normalize(cameraPosition - p);
    vec3 fly = iE.xyz - dot(iE.xyz, toCam) * toCam;
    float sp = length(fly);
    if (sp > 0.01) {
      along = fly / sp;
      across = normalize(cross(along, toCam));
      stretch = 1.0 + sp * 0.022 / iD.w;
    }
  }
  vWorld = p + (across * position.x + along * position.y * stretch) * iD.w;
  vQ = position.xy;
  vSoft = iE.w;
  vAlpha = iF.x;
  vSeed = iF.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const DROP_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vQ;
in vec3 vWorld;
in float vSoft;
in float vAlpha;
in float vSeed;
void main() {
  float r = length(vQ);
  if (r > 1.0) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  float toSun = max(dot(-V, uSunDir), 0.0);
  float sun = cloudShadow(vWorld.xz);
  vec3 sky = uSkyAmbient * 1.25 + uGroundBounce * 0.4;
  float wisp = vnoise(vQ * 1.7 + vSeed * 31.0);
  float a = mix(
    (1.0 - smoothstep(0.0, 1.0, r)),
    pow(1.0 - r, 1.3) * smoothstep(0.3, 0.75, wisp + 0.35 - r * 0.45),
    vSoft) * vAlpha;
  a *= smoothstep(-0.04, 0.25, vWorld.y);
  if (a < 0.004) discard;
  float lit = mix(pow(toSun, 8.0) * 2.5 + 0.45, 0.22 + min(pow(toSun, 11.0) * 1.8, 1.1), vSoft);
  vec3 col = sky * 1.1 + uSunColor * lit * sun;
  vec4 fog = fogOf(vWorld);
  col = mix(col, fog.rgb, fog.a);
  float additive = mix(0.7, 0.14, vSoft);
  gl_FragColor = vec4(col * a, a * (1.0 - additive));
}`;

/** The little water a pod throws. The whale's Spray needs the wind field, which the pod is never handed. */
class Drops {
  readonly mesh: THREE.Mesh;
  private count = 0;
  private readonly p = new Float32Array(DROPS * 3);
  private readonly v = new Float32Array(DROPS * 3);
  private readonly age = new Float32Array(DROPS);
  private readonly life = new Float32Array(DROPS);
  private readonly size = new Float32Array(DROPS);
  private readonly soft = new Float32Array(DROPS);
  private readonly seed = new Float32Array(DROPS);
  private readonly d: THREE.InstancedBufferAttribute;
  private readonly e: THREE.InstancedBufferAttribute;
  private readonly g: THREE.InstancedBufferAttribute;
  private readonly geo = new THREE.InstancedBufferGeometry();

  constructor() {
    const quad = new THREE.PlaneGeometry(2, 2);
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.attributes.position);
    const attr = () => new THREE.InstancedBufferAttribute(new Float32Array(DROPS * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.d = attr();
    this.e = attr();
    this.g = attr();
    this.geo.setAttribute('iD', this.d);
    this.geo.setAttribute('iE', this.e);
    this.geo.setAttribute('iF', this.g);
    this.geo.instanceCount = 0;
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.ShaderMaterial({
        vertexShader: DROP_VERT,
        fragmentShader: DROP_FRAG,
        uniforms: { ...atmo.uniforms },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, soft: number): void {
    if (this.count >= DROPS) return;
    const i = this.count++;
    const o = i * 3;
    this.p[o] = x;
    this.p[o + 1] = y;
    this.p[o + 2] = z;
    this.v[o] = vx;
    this.v[o + 1] = vy;
    this.v[o + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.soft[i] = soft;
    this.seed[i] = Math.random();
  }

  update(dt: number): void {
    const { p, v } = this;
    for (let i = 0; i < this.count; ) {
      this.age[i] += dt;
      const o = i * 3;
      if (this.age[i] >= this.life[i] || (this.soft[i] < 0.5 && p[o + 1] < -0.04 && v[o + 1] < 0)) {
        this.remove(i);
        continue;
      }
      const drag = this.soft[i] > 0.5 ? 1 - Math.exp(-dt * 1.6) : 0;
      v[o] -= v[o] * drag;
      v[o + 1] -= v[o + 1] * drag + (this.soft[i] > 0.5 ? 0.35 : G) * dt;
      v[o + 2] -= v[o + 2] * drag;
      p[o] += v[o] * dt;
      p[o + 1] += v[o + 1] * dt;
      p[o + 2] += v[o + 2] * dt;
      this.size[i] += this.soft[i] * 0.06 * dt;
      i++;
    }
    const D = this.d.array as Float32Array;
    const E = this.e.array as Float32Array;
    const F = this.g.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      const t = this.age[i] / this.life[i];
      const k = i * 4;
      D[k] = p[o];
      D[k + 1] = p[o + 1];
      D[k + 2] = p[o + 2];
      D[k + 3] = this.size[i];
      E[k] = v[o];
      E[k + 1] = v[o + 1];
      E[k + 2] = v[o + 2];
      E[k + 3] = this.soft[i];
      F[k] = Math.min(1, this.age[i] * 9) * (1 - t) ** 1.5;
      F[k + 1] = this.seed[i];
    }
    for (const attr of [this.d, this.e, this.g]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * 4);
      attr.needsUpdate = true;
    }
    this.geo.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
  }

  private remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.p.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.v.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size[i] = this.size[last];
    this.soft[i] = this.soft[last];
    this.seed[i] = this.seed[last];
  }
}

/**
 * A lane one or two dolphins hold together. It sits at `station` along the boat and surges fore and aft of it on
 * its own slow period, so no two lanes ever fall into step; `entry` is the ground they still have to make up.
 */
interface Pack {
  rider: boolean;
  station: number;
  swing: number;
  rate: number;
  phase: number;
  entry: number;
  close: number;
  along: number;
  vel: number;
  side: number;
  sideAt: number;
  near: number;
  far: number;
  /** Surging forward, which is the half of the swing they porpoise through. */
  up: boolean;
  delay: number;
}

/** The set-pieces one dolphin leaves the pod to play, both of them staged between the camera and the boat. */
type Show = 'leap' | 'push';

/**
 * A dolphin out of its lane, playing one. It holds the beak's station in the boat's frame; the vertical life is
 * still the ordinary ballistic swimming, asked for a bigger throw or held at a depth.
 */
interface Stunt {
  kind: Show;
  d: Dolphin;
  /** out: down and away to its mark. run: the approach. act: the leap or the shove. back: rejoining the pod. */
  phase: 'out' | 'run' | 'act' | 'back';
  t: number;
  /** Both encounters stay on the camera's side, clear of the sail and hull. */
  side: number;
  along: number;
  across: number;
  /** Its speed in the boat's frame, which can only change as fast as a swimming animal can: nothing jumps a station. */
  va: number;
  vc: number;
  asked: boolean;
  hit: boolean;
}

/** Where the shoulder presses on the quarter, and how far off the planking the beak stays while it pushes. */
const SHOVE_ALONG = 1.5;
const SHOVE_ACROSS = 1.28;

interface Dolphin {
  pack: Pack;
  /** Full-grown, so it is one of the ones that can be asked to play a set-piece. */
  adult: boolean;
  dAlong: number;
  dAcross: number;
  size: number;
  seed: number;
  x: number;
  y: number;
  surface: number;
  placed: boolean;
  z: number;
  /** Where it really is in the pod's frame, and the station it is swimming after, whose last place gives its drift. */
  along: number;
  across: number;
  wantAlong: number;
  wantAcross: number;
  tx: number;
  tz: number;
  yaw: number;
  /** Its rate of turn, and the sweep of the tail that rate gives the body. */
  turn: number;
  bend: number;
  pitch: number;
  arch: number;
  roll: number;
  rollTo: number;
  rollFor: number;
  rollIn: number;
  phase: number;
  beat: number;
  wet: number;
  /**
   * What the beak is doing in the vertical: holding a depth on a spring, rising to a throw, flying one, or dipping
   * between two throws of a run. Every join matches height and speed, so the body never snaps to a new slope.
   */
  seg: 'hold' | 'rise' | 'air' | 'roll' | 'dip';
  segT: number;
  span: number;
  y0: number;
  v0: number;
  /** The speed it leaves the water at on this throw, and the one the dip under way is shaped to come up at. */
  vy0: number;
  next: number;
  air: number;
  once: boolean;
  /** The depth it wants to swim at, and the depth it is making for on the way there, which moves at a swimmer's rate. */
  hold: number;
  depth: number;
  /** What a set-piece is asking of it: a depth to hold, a lift-off speed for its next arc, a roll, a hard run. */
  held: number | null;
  lift: number;
  tilt: number | null;
  hurry: boolean;
  breath: number;
  vy: number;
  /** Speed through the water, which is what shapes its arcs; it never swims backwards, whatever the boat does. */
  pace: number;
  /** What the throw under way is: a breath rolls through the surface, a porpoise or a leap flies. */
  kind: 'breath' | 'porpoise' | 'leap';
  /** Seconds left of a porpoise's spurt, and how far out from the boat it has veered on it. */
  burst: number;
  veer: number;
  tuck: number;
  /** The beak's recent slopes, so the tail can follow the path the beak really took a body length ago. */
  trace: Float32Array;
  traced: number;
  /** What is left of a set-piece's station when it rejoins its lane, let go gradually rather than snapped. */
  offAlong: number;
  offAcross: number;
  wasUp: boolean;
  wasIn: boolean;
  trail: number;
}

/** Pairs of (time, slope) kept per dolphin, at most one pair per 1/60 s: over two seconds of path. */
const TRACE = 128;

/**
 * A pod of dolphins running with the boat on the long crossing: they come up out of the swell alongside, porpoise
 * ahead of the bow and fall back, and are the reason that crossing is the room where nothing is asked of you.
 */
export class Dolphins {
  readonly objects: THREE.Object3D[] = [];
  /** What to do when one of them shoulders the boat: the story hands the shove to the hull. */
  onShove: ((side: number, strength: number) => void) | null = null;
  onSplash: ((x: number, y: number, z: number, strength: number) => void) | null = null;
  onSurface: ((x: number, y: number, z: number, strength: number) => void) | null = null;
  private readonly mesh: THREE.Mesh;
  private readonly ghost: THREE.Mesh;
  private readonly marks = new Marks();
  private readonly drops = new Drops();
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly iA: THREE.InstancedBufferAttribute;
  private readonly iB: THREE.InstancedBufferAttribute;
  private readonly iC: THREE.InstancedBufferAttribute;
  private readonly iT: THREE.InstancedBufferAttribute;
  private readonly packs: Pack[] = [];
  private readonly pod: Dolphin[] = [];
  private readonly boat = new THREE.Vector3();
  private readonly was = new THREE.Vector3();
  private head = 0;
  private heading = 0;
  private speed = 4;
  private readonly seen = new THREE.Vector3();
  private here = false;
  private wanted = false;
  private going = 0;
  private stunt: Stunt | null = null;
  /** Seconds the pod has been with this boat, when the next set-piece is due, and how many have been played. */
  private clock = 0;
  private next = 0;
  private turn = 0;
  private pushed = false;
  private resumed = false;
  resumeAfterSwim(): void { this.resumed = true; }
  get leapComplete(): boolean {
    return this.turn >= 1 || this.stunt?.kind === 'leap' && this.stunt.phase === 'back' && this.stunt.t >= tuning.dolphins.leapRecovery;
  }
  get farewellReady(): boolean {
    return this.pushed && (!this.stunt || this.stunt.kind === 'push' && this.stunt.phase === 'back'
      && this.stunt.t >= tuning.dolphins.nudgeRecovery);
  }
  private camera = 1;
  private busy = false;
  private ready = true;
  private quiet = 0;
  /** How far ahead the lanes run while the boat is busy; it opens and closes no faster than they can swim it. */
  private lead = 0;

  constructor() {
    const base = dolphinGeometry();
    this.geo.index = base.index;
    for (const name of ['position', 'normal', 'aRig']) this.geo.setAttribute(name, base.attributes[name]);
    const attr = () => new THREE.InstancedBufferAttribute(new Float32Array(POD * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iA = attr();
    this.iB = attr();
    this.iC = attr();
    this.iT = attr();
    this.geo.setAttribute('iA', this.iA);
    this.geo.setAttribute('iB', this.iB);
    this.geo.setAttribute('iC', this.iC);
    this.geo.setAttribute('iT', this.iT);
    this.geo.instanceCount = 0;
    this.geo.boundingSphere = base.boundingSphere;
    const shared = {
      uSeaTint: { value: new THREE.Color('#5a8a9a') },
      uDeep: { value: new THREE.Color('#0d4a66') },
      uAbsorb: { value: new THREE.Vector3(0.5, 0.13, 0.1) },
    };
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.ShaderMaterial({
        vertexShader: DOLPHIN_VERT,
        fragmentShader: DOLPHIN_FRAG,
        uniforms: { ...atmo.uniforms, ...swellUniforms, ...shared },
        side: THREE.DoubleSide,
      }),
    );
    this.ghost = new THREE.Mesh(
      this.geo,
      new THREE.ShaderMaterial({
        vertexShader: GHOST_VERT,
        fragmentShader: GHOST_FRAG,
        uniforms: { ...atmo.uniforms, ...swellUniforms, ...shared },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      }),
    );
    for (const m of [this.mesh, this.ghost]) {
      m.frustumCulled = false;
      m.visible = false;
    }
    this.ghost.renderOrder = 1;
    this.marks.mesh.renderOrder = 3;
    this.mesh.layers.enable(REFLECTION_LAYER);
    this.drops.mesh.layers.enable(REFLECTION_LAYER);

    for (const n of SHOALS) {
      const pack = this.makePack(false);
      for (let i = 0; i < n; i++) this.pod.push(this.makeDolphin(pack, i));
    }
    for (let i = 0; i < RIDERS; i++) this.pod.push(this.makeDolphin(this.makePack(true), 0));
    this.objects.push(this.ghost, this.marks.mesh, this.mesh, this.drops.mesh);
  }

  /**
   * Keeps the pod running with a boat at `near` on bearing `heading`; a null `near` sends them away. `camera` is
   * which side of the stern the camera rides on, so the set-pieces play where they can be seen, `busy` holds
   * them off while something else has the boat, and until `ready` none begins.
   */
  run(near: THREE.Vector3 | null, heading: number, camera = 1, busy = false, ready = true): void {
    this.wanted = near !== null;
    this.camera = camera < 0 ? -1 : 1;
    this.busy = busy;
    this.ready = ready;
    if (!near) return;
    if (!this.here || this.boat.distanceToSquared(near) > 1e4) {
      this.boat.copy(near);
      this.was.copy(near);
      this.head = heading;
      this.gather();
      this.here = true;
      this.going = 0;
      this.mesh.visible = this.ghost.visible = true;
    }
    this.boat.copy(near);
    this.heading = heading;
  }

  /** The one that is playing to the boat, for the child to look at; null when the pod is only running alongside. */
  get spotlight(): THREE.Vector3 | null {
    const s = this.stunt;
    if (!s || !this.wanted || s.phase === 'out' || s.phase === 'back') return null;
    return this.seen.set(s.d.x, Math.max(s.d.y + s.d.surface, 0.2), s.d.z);
  }

  update(dt: number, time: number): void {
    this.marks.update(time);
    this.drops.update(dt);
    if (!this.here || dt <= 0) return;
    if (!this.wanted) {
      this.going += dt;
      this.speed = Math.max(3, this.speed);
      this.boat.x += Math.sin(this.head) * this.speed * dt;
      this.boat.z += Math.cos(this.head) * this.speed * dt;
      if (this.going > tuning.dolphins.departureFor) {
        this.here = false;
        this.mesh.visible = this.ghost.visible = false;
        this.geo.instanceCount = 0;
        return;
      }
    }
    const tune = tuning.dolphins;
    /** The lanes come round after the boat no faster than a pod can swim them: a turn never swings them like spokes. */
    const turn = Math.atan2(Math.sin(this.heading - this.head), Math.cos(this.heading - this.head));
    this.head += THREE.MathUtils.clamp(turn * ease(dt, 3.6), -tune.headTurn * dt, tune.headTurn * dt);
    this.quiet += ((this.busy ? 1 : 0) - this.quiet) * ease(dt, tuning.dolphins.quietEase);
    const lead = ((this.busy ? tune.quietLead : 0) - this.lead) * ease(dt, tune.quietEase);
    this.lead += THREE.MathUtils.clamp(lead, -tune.leadRate * dt, tune.leadRate * dt);
    const step = Math.hypot(this.boat.x - this.was.x, this.boat.z - this.was.z);
    if (step < 8) this.speed += (step / dt - this.speed) * ease(dt, 1.5);
    this.was.copy(this.boat);

    const fx = Math.sin(this.head);
    const fz = Math.cos(this.head);
    for (const p of this.packs) this.steer(p, dt);
    if (this.wanted) this.show(dt);
    const A = this.iA.array as Float32Array;
    const B = this.iB.array as Float32Array;
    const C = this.iC.array as Float32Array;
    const T = this.iT.array as Float32Array;
    for (let i = 0; i < POD; i++) {
      const d = this.pod[i];
      const p = d.pack;
      const s = this.stunt && this.stunt.d === d ? this.stunt : null;
      if (!s) {
        d.offAlong -= d.offAlong * ease(dt, tune.rejoinEase);
        d.offAcross -= d.offAcross * ease(dt, tune.rejoinEase);
      }
      if (d.burst > 0) {
        d.burst -= dt;
        d.offAlong += tune.porpoiseBurst * dt;
      }
      const veer = d.burst > 0 ? p.sideAt * tune.porpoiseVeer : 0;
      d.veer += THREE.MathUtils.clamp(veer - d.veer, -2 * dt, 2 * dt);
      const lane = p.along + d.dAlong + this.lead;
      d.wantAlong = s ? s.along : lane + d.offAlong;
      d.wantAcross = s ? s.across : this.wide(d, lane) + d.offAcross + d.veer;
      this.move(d, fx, fz, dt);
      // The swell dies away over the sky mirror's calm water, as the sea there is drawn.
      d.surface = swellLift(d.x, d.z, time) * (1 - mirrorWater(d.x, d.z));
      this.swim(d, dt, time);
      this.bank(d, dt, time);
      const k = i * 4;
      A[k] = d.x;
      A[k + 1] = d.y + d.surface;
      A[k + 2] = d.z;
      A[k + 3] = d.yaw;
      B[k] = d.pitch;
      B[k + 1] = d.roll;
      B[k + 2] = d.size;
      B[k + 3] = d.arch;
      C[k] = d.phase;
      C[k + 1] = d.beat;
      C[k + 2] = d.wet;
      C[k + 3] = d.seed;
      T[k] = d.bend;
    }
    this.iA.needsUpdate = this.iB.needsUpdate = this.iC.needsUpdate = this.iT.needsUpdate = true;
    this.geo.instanceCount = POD;
  }

  /**
   * Swims one dolphin after its station, as a swimmer can: it faces where it is going, turns no tighter than a body
   * of its length, and gathers or sheds speed no faster than its flukes allow. A station that runs off, when the
   * boat turns or a set-piece begins, is chased, never snapped to; in the air nothing steers it at all. Dropping
   * back on the boat is swimming slower than it, never turning round.
   */
  private move(d: Dolphin, fx: number, fz: number, dt: number): void {
    const k = tuning.dolphins;
    const tx = this.boat.x + fx * d.wantAlong + fz * d.wantAcross;
    const tz = this.boat.z + fz * d.wantAlong - fx * d.wantAcross;
    if (!d.placed) {
      d.x = d.tx = tx;
      d.z = d.tz = tz;
      d.yaw = this.head;
      d.pace = this.speed;
      d.turn = d.bend = 0;
      d.placed = true;
    }
    let tvx = (tx - d.tx) / dt;
    let tvz = (tz - d.tz) / dt;
    d.tx = tx;
    d.tz = tz;
    const tv = Math.hypot(tvx, tvz);
    if (tv > k.swimMost) {
      tvx *= k.swimMost / tv;
      tvz *= k.swimMost / tv;
    }
    let dvx = (tx - d.x) * k.chase + tvx;
    let dvz = (tz - d.z) * k.chase + tvz;
    for (const o of this.pod) {
      if (o === d || !o.placed) continue;
      const ox = d.x - o.x;
      const oz = d.z - o.z;
      const gap = Math.hypot(ox, oz, (d.y - o.y) * 1.5);
      if (gap >= k.spacing || gap < 1e-3) continue;
      const push = ((1 - gap / k.spacing) * k.swimMost) / gap;
      dvx += ox * push;
      dvz += oz * push;
    }
    if (d.seg !== 'air') {
      const forward = dvx * fx + dvz * fz;
      const aside = dvx * fz - dvz * fx;
      const want = this.head + Math.atan2(aside, Math.max(forward, k.leastHeadway));
      const turn = Math.atan2(Math.sin(want - d.yaw), Math.cos(want - d.yaw));
      const most = k.turnMost * dt;
      const step = THREE.MathUtils.clamp(turn * ease(dt, 6), -most, most);
      d.yaw += step;
      d.turn += (step / dt - d.turn) * ease(dt, 8);
      const hx = Math.sin(d.yaw);
      const hz = Math.cos(d.yaw);
      const pace = THREE.MathUtils.clamp(dvx * hx + dvz * hz, k.swimLeast, k.swimMost);
      d.pace += THREE.MathUtils.clamp(pace - d.pace, -k.swimAccel * dt, k.swimAccel * dt);
    } else d.turn -= d.turn * ease(dt, 8);
    d.x += Math.sin(d.yaw) * d.pace * dt;
    d.z += Math.cos(d.yaw) * d.pace * dt;
    /** The tail lies along the path just swum: through a turn it sweeps out of line by the turn of the last body length. */
    d.bend = THREE.MathUtils.clamp((-d.turn * LEN * d.size) / Math.max(d.pace, k.leastPace), -0.6, 0.6);
    const bx = Math.sin(this.heading);
    const bz = Math.cos(this.heading);
    const rx = d.x - this.boat.x;
    const rz = d.z - this.boat.z;
    d.along = rx * bx + rz * bz;
    d.across = rx * bz - rz * bx;
    /** No flipper ever reaches the planking. */
    if (Math.abs(d.along) < 3.4 && Math.abs(d.across) < k.hullClear) {
      d.across = (d.across < 0 ? -1 : 1) * k.hullClear;
      d.x = this.boat.x + bx * d.along + bz * d.across;
      d.z = this.boat.z + bz * d.along - bx * d.across;
    }
  }

  private makePack(rider: boolean): Pack {
    const p: Pack = { rider, station: 0, swing: 0, rate: 0, phase: 0, entry: 0, close: 3, along: 0, vel: 0, side: 1, sideAt: 1, near: 4, far: 14, up: false, delay: 0 };
    this.packs.push(p);
    return p;
  }

  private makeDolphin(pack: Pack, member: number): Dolphin {
    return {
      pack,
      adult: !member,
      dAlong: member ? rand(-3.4, -1.6) : 0,
      dAcross: member ? rand(0.95, 2.1) * (Math.random() < 0.5 ? -1 : 1) : 0,
      size: member ? rand(0.68, 0.86) : rand(0.95, 1.15),
      seed: Math.random(),
      x: 0,
      y: -2,
      surface: 0,
      placed: false,
      z: 0,
      along: 0,
      across: 0,
      wantAlong: 0,
      wantAcross: 0,
      tx: 0,
      tz: 0,
      yaw: 0,
      turn: 0,
      bend: 0,
      pitch: 0,
      arch: 0,
      roll: 0,
      rollTo: 0,
      rollFor: 0,
      rollIn: rand(6, 20),
      phase: Math.random() * 6.28,
      beat: 0.3,
      wet: 0,
      seg: 'hold',
      segT: 0,
      span: 1,
      y0: 0,
      v0: 0,
      vy0: 1,
      next: 0,
      air: 0.2,
      once: false,
      hold: -2,
      depth: -2,
      held: null,
      lift: 0,
      tilt: null,
      hurry: false,
      breath: rand(2, 14),
      vy: 0,
      pace: 4,
      kind: 'breath',
      burst: 0,
      veer: 0,
      tuck: 0,
      trace: new Float32Array(TRACE * 2),
      traced: 0,
      offAlong: 0,
      offAcross: 0,
      wasUp: false,
      wasIn: false,
      trail: 0,
    };
  }

  /** Sets the pod out astern and to both sides, deep, so it swims up into view rather than appearing. */
  private gather(): void {
    let n = 0;
    for (const p of this.packs) {
      this.lane(p, p.rider ? -rand(10, 20) : -rand(16 + n * 6, 22 + n * 7));
      p.side = n % 2 ? 1 : -1;
      p.sideAt = p.side;
      p.delay = n * tuning.dolphins.arrivalSpacing + rand(0, 1.5);
      n++;
    }
    for (const d of this.pod) {
      d.placed = false;
      d.y = d.hold = d.depth = -tuning.dolphins.arrivalDepth - rand(0, 1);
      d.vy = 0;
      d.seg = 'hold';
      d.once = false;
      d.traced = 0;
      d.offAlong = d.offAcross = 0;
      d.burst = d.veer = 0;
      d.wet = 0;
      d.breath = d.pack.delay + rand(0.5, 4);
      d.held = null;
      d.lift = 0;
      d.tilt = null;
      d.hurry = false;
    }
    this.stunt = null;
    this.clock = 0;
    this.turn = 0;
    this.pushed = false;
    this.next = rand(tuning.dolphins.leapAt - tuning.dolphins.leapSpread, tuning.dolphins.leapAt + tuning.dolphins.leapSpread);
    if (this.resumed) { this.turn = 1; this.next = 6; this.resumed = false; }
  }

  /** How far out from the boat's track a lane sits: it opens out as the pack surges away from its station. */
  private wide(d: Dolphin, along: number): number {
    const p = d.pack;
    const u = Math.min(1, Math.abs(along - p.station) / 22);
    const room = this.quiet * (p.side === this.camera ? 0 : 2);
    return p.sideAt * (p.near + room + (p.far - p.near) * u * u) + d.dAcross;
  }

  /** Picks the shape of one lane: where it sits, how far and how slowly it surges, and how close it comes. */
  private lane(p: Pack, entry: number): void {
    p.station = p.rider ? rand(1.5, 5) : rand(2, 13);
    p.swing = p.rider ? rand(0.8, 1.8) : rand(3, 7);
    p.rate = p.rider ? rand(0.13, 0.26) : rand(0.1, 0.18);
    p.phase = Math.random() * 6.2832;
    p.entry = entry;
    p.close = p.rider ? 3.2 : rand(2.6, 4.2);
    /** Near enough to ride the bow wave, never near enough for a flipper to reach the planking. */
    p.near = p.rider ? rand(3.6, 4.3) : rand(5, 8);
    p.far = p.rider ? p.near : rand(9, 12);
    p.side = Math.random() < 0.5 ? -1 : 1;
    p.along = p.station + p.swing * Math.sin(p.phase) + entry;
    p.vel = p.close;
  }

  private steer(p: Pack, dt: number): void {
    if (p.delay > 0) p.delay -= dt;
    if (this.wanted && p.delay <= 0) p.entry = Math.min(0, p.entry + dt * p.close);
    p.phase += dt * p.rate;
    const was = p.along;
    p.along = p.station + p.swing * Math.sin(p.phase) + p.entry;
    p.vel = (p.along - was) / dt;
    p.up = this.wanted && !this.busy && !p.rider && p.vel > 0.55;
    p.sideAt += (p.side - p.sideAt) * ease(dt, 0.3);
  }

  /** One set-piece at a time, and none at all while the boat has something else to attend to. */
  private show(dt: number): void {
    this.clock += dt;
    const s = this.stunt;
    if (!s) {
      const kind: Show = this.turn === 0 ? 'leap' : !this.pushed ? 'push' : Math.random() < 0.5 ? 'leap' : 'push';
      if (!this.busy && this.ready && this.wanted && this.clock > this.next) this.begin(kind);
      return;
    }
    /** Anything that comes up mid-approach sends it back to the pod; nothing is ever cut away from. */
    if ((this.busy || !this.wanted) && (s.phase === 'out' || s.phase === 'run')) {
      s.phase = 'back';
      s.t = 0;
      s.d.hurry = false;
    }
    s.t += dt;
    if (s.phase === 'back') this.rejoin(s, dt);
    else if (s.kind === 'leap') this.leap(s, dt);
    else this.shove(s, dt);
  }

  /**
   * Sends one of the grown ones out of its lane, already on the side it is wanted, so nothing jumps across, and of
   * those the one furthest astern, which has the least water to cover to its mark.
   */
  private begin(kind: Show): void {
    if (this.stunt) return;
    const side = this.camera;
    let d: Dolphin | null = null;
    let nearest = -1e9;
    for (const other of this.pod) {
      if (!other.adult || other.pack.rider || other.pack.delay > 0) continue;
      const score = side * other.across > 0 ? 1000 - other.pack.along - other.dAlong : side * other.across;
      if (score > nearest) {
        nearest = score;
        d = other;
      }
    }
    if (!d) return;
    this.stunt = { kind, d, phase: 'out', t: 0, side, along: d.wantAlong, across: d.wantAcross, va: d.pack.vel, vc: 0, asked: false, hit: false };
    d.offAlong = d.offAcross = 0;
    d.burst = 0;
    d.held = kind === 'push' ? -2.2 : -2.8;
    d.hurry = false;
    d.tilt = null;
  }

  /**
   * Swims the beak toward a station in the boat's frame, within what one can really do: it overhauls the boat at
   * its own best speed at most, and to drop back it can only ease off and let the boat run away from it.
   */
  private glide(s: Stunt, along: number, across: number, rate: number, dt: number): void {
    const k = tuning.dolphins;
    const va = THREE.MathUtils.clamp((along - s.along) * rate, -(this.speed - k.swimLeast), k.swimMost - this.speed);
    const vc = THREE.MathUtils.clamp((across - s.across) * rate, -4, 4);
    this.swimAt(s, va, vc, dt);
  }

  /** Brings its speed in the boat's frame round toward `va` along and `vc` across, no faster than a body can. */
  private swimAt(s: Stunt, va: number, vc: number, dt: number): void {
    const most = tuning.dolphins.stuntAccel * dt;
    s.va += THREE.MathUtils.clamp(va - s.va, -most, most);
    s.vc += THREE.MathUtils.clamp(vc - s.vc, -most, most);
    s.along += s.va * dt;
    s.across += s.vc * dt;
  }

  /**
   * One long leap on the near side, out and away from the boat. The whole animal stays between boat and camera; it
   * never crosses the sail or threatens the child. It runs up alongside, turns out through its last dip so the
   * camera astern sees the arc from the side, is already running flat out when it leaves the water, and nothing
   * steers it in the air.
   */
  private leap(s: Stunt, dt: number): void {
    const d = s.d;
    const k = tuning.dolphins;
    if (s.phase === 'out') {
      this.glide(s, -3, s.side * (k.leapBeside + 1.5), 0.85, dt);
      if (s.t > k.leapOutFor && (Math.abs(s.across) > k.leapBeside || s.t > 7)) {
        s.phase = 'run';
        s.t = 0;
        d.held = null;
        d.hurry = true;
      }
    } else if (s.phase === 'run') {
      if (d.lift > 0 && d.seg === 'dip' && d.next === d.lift) {
        const out = k.leapAngle * THREE.MathUtils.smoothstep(d.segT / d.span, 0.05, 0.8);
        this.swimAt(s, k.leapSpeed * Math.cos(out) - this.speed, s.side * k.leapSpeed * Math.sin(out), dt);
      } else this.glide(s, k.leapFrom, s.side * k.leapBeside, 0.55, dt);
      if (s.t > k.leapRunFor && !s.asked) {
        s.asked = true;
        /** A slow boat asks for a lower leap, never a steeper one. */
        d.lift = Math.min(k.leapLift * rand(0.96, 1.06), k.leapSpeed * Math.tan(k.leapSteepest));
      }
      if (s.asked && d.lift === 0 && d.seg === 'air') {
        s.phase = 'act';
        s.t = 0;
        d.tilt = s.side * 0.4;
      }
    } else if (s.phase === 'act') {
      if (d.seg === 'air') this.swimAt(s, s.va, s.vc, dt);
      else {
        /** In, and the sea takes the run out of it. */
        d.hurry = false;
        d.tilt = null;
        this.swimAt(s, 0.3, 0, dt);
        if (d.seg === 'hold' && d.segT > 0.6) {
          s.phase = 'back';
          s.t = 0;
          d.held = -2.4;
        }
      }
    }
  }

  /**
   * The shove. It comes up astern on the camera's side, swims in under the quarter rolled onto its side so the eye
   * that is uppermost is the one on the child, leans on the planking, and lets the boat go.
   */
  private shove(s: Stunt, dt: number): void {
    const d = s.d;
    if (s.phase === 'out') {
      this.glide(s, tuning.dolphins.nudgeApproachAlong, s.side * tuning.dolphins.nudgeApproachAcross, 0.8, dt);
      if (s.t > tuning.dolphins.nudgeApproachFor && (s.along < 0 || s.t > tuning.dolphins.nudgeApproachMax)) {
        s.phase = 'run';
        s.t = 0;
        d.held = null;
        d.hurry = true;
      }
    } else if (s.phase === 'run') {
      this.glide(s, -4.5, s.side * 2.8, 0.45, dt);
      /** It stops porpoising first: the last arc has to come down before it can lie alongside. */
      if (s.t > tuning.dolphins.nudgeRunFor) d.hurry = false;
      if (s.t > tuning.dolphins.nudgeRunFor && d.seg === 'hold') {
        s.phase = 'act';
        s.t = 0;
        /** Shallow enough that the flank it rolls onto breaks the surface, where the child can see the eye. */
        d.held = tuning.dolphins.nudgeDepth;
      }
    } else if (s.phase === 'act') {
      d.tilt = -s.side * tuning.dolphins.nudgeRoll;
      if (!s.hit) {
        this.glide(s, SHOVE_ALONG, s.side * SHOVE_ACROSS, 1.6, dt);
        if (Math.abs(d.across) < SHOVE_ACROSS + 0.12 && d.along > SHOVE_ALONG - 0.5) {
          s.hit = true;
          s.t = 0;
          this.pushed = true;
          this.onShove?.(s.side, 1);
        } else if (s.t > 6) {
          /** It could not get alongside; the boat is never shoved by a dolphin that is not there. */
          s.phase = 'back';
          s.t = 0;
          d.held = -1.8;
          d.tilt = null;
        }
      } else {
        /** The boat leaps away from it and it slides back down the planking, still looking up. */
        this.glide(s, SHOVE_ALONG - 2.4 * s.t, s.side * (SHOVE_ACROSS + 1.6 * s.t), 1.5, dt);
        if (s.t > 1.8) {
          s.phase = 'back';
          s.t = 0;
          d.held = -1.8;
          d.tilt = null;
        }
      }
    }
  }

  /** Back to its lane, which has been running on without it, and the wait before anything is played again. */
  private rejoin(s: Stunt, dt: number): void {
    const d = s.d;
    d.lift = 0;
    d.tilt = null;
    if (s.t > 1.5) d.held = null;
    const along = d.pack.along + d.dAlong + this.lead;
    const across = this.wide(d, along);
    this.glide(s, along, across, 0.5, dt);
    if (Math.hypot(along - s.along, across - s.across) < 1.2 || s.t > 16) {
      d.held = null;
      d.hurry = false;
      d.breath = rand(0.5, 3);
      d.offAlong = s.along - along;
      d.offAcross = s.across - across;
      this.stunt = null;
      this.turn++;
      const t = tuning.dolphins;
      this.next = this.clock + (!this.pushed ? t.nudgeAfter : rand(t.restLeast, t.restLeast + t.restSpread));
    }
  }

  /** The vertical life of one dolphin: a held depth, or a run of ballistic throws joined by dips shaped to match. */
  private swim(d: Dolphin, dt: number, time: number): void {
    const p = d.pack;
    const k = tuning.dolphins;
    const surging = d.hurry || (p.up && !p.rider && p.delay <= 0 && this.wanted);
    d.segT += dt;
    if (d.seg === 'rise' && !this.wanted) {
      d.seg = 'hold';
      d.depth = d.y;
    }
    if (d.seg === 'hold') {
      if (!this.wanted) d.hold = -k.arrivalDepth - 2;
      else if (d.held !== null) d.hold = d.held;
      else if (p.delay > 0) d.hold = -k.arrivalDepth;
      else if (d.hurry) d.hold = BASE_Y;
      else {
        d.breath -= dt;
        if (d.hold > -0.3) d.hold = -(p.rider ? rand(0.45, 1.1) : rand(0.6, 1.7));
      }
      const up = this.wanted && (d.lift > 0 || (d.held === null && (d.hurry || d.breath <= 0)));
      /** From deep water it comes up to breathing depth first, and only then rises to the throw. */
      if (up && d.y < BASE_Y - k.riseFrom) d.hold = Math.max(d.hold, BASE_Y - k.riseFrom + 0.3);
      /** It slants to a new depth, going away at the end or diving off after a set-piece, rather than dropping to it. */
      d.depth += THREE.MathUtils.clamp(d.hold - d.depth, -k.depthRate * dt, k.depthRate * dt);
      const to = d.depth + Math.sin(time * 0.5 + d.seed * 9) * 0.06;
      const w = 2 * (!this.wanted ? 1 : surging || d.held !== null ? 1.6 : 0.5);
      /** The water takes the speed out of a landing over a body length, not in a jolt. */
      d.vy += THREE.MathUtils.clamp(w * w * (to - d.y) - 2 * w * d.vy, -k.diveAccel, k.diveAccel) * dt;
      d.y += d.vy * dt;
      if (up && d.y >= BASE_Y - k.riseFrom) this.rise(d, surging);
    } else if (d.seg === 'rise' || d.seg === 'dip') {
      if (d.segT >= d.span) this.fly(d, d.next, d.segT - d.span);
      else this.join(d, d.seg === 'rise' ? d.y0 : BASE_Y);
    }
    if (d.seg === 'roll') {
      if (d.segT >= d.span) this.land(d, surging, d.segT - d.span);
      else this.join(d, BASE_Y);
    } else if (d.seg === 'air') {
      if (d.segT >= d.air) this.land(d, surging, d.segT - d.air);
      else {
        d.y = BASE_Y + d.vy0 * d.segT - 0.5 * G * d.segT * d.segT;
        d.vy = d.vy0 - G * d.segT;
      }
    }
    const pace = Math.max(d.pace, k.leastPace);
    d.pitch = Math.atan2(d.vy, pace);
    this.record(d, time);
    /** The body lies along the path it has just swum: the tail holds the slope the beak had a body length ago. */
    const tail = this.slopeAt(d, time - (LEN * d.size) / pace);
    const tuck = d.seg === 'air' ? 0.22 * THREE.MathUtils.smoothstep(d.segT / d.air, 0.68, 1) : 0;
    d.tuck += (tuck - d.tuck) * ease(dt, 10);
    const sway = Math.sin(time * 0.4 + d.seed * 5) * 0.05;
    /** A spine bends only so far: the path's curve beyond that is carried by the whole body turning. */
    const arch = (d.pitch - tail) * 0.6 - d.tuck + sway;
    d.arch += (k.archMost * Math.tanh(arch / k.archMost) - d.arch) * ease(dt, 10);

    const sunk = 1 - THREE.MathUtils.smoothstep(d.y, 0.0, 0.35);
    d.beat += (0.3 * (0.2 + 0.8 * sunk) * (surging ? 1.15 : 0.75) - d.beat) * ease(dt, 4);
    d.phase += dt * (surging ? 14.5 + d.seed * 2.2 : 7.6 + d.seed * 1.4);
    this.wash(d, dt, time);
  }

  /** Sets off up toward the surface from wherever it is, to leave it at the speed its throw needs. */
  private rise(d: Dolphin, surging: boolean): void {
    d.once = !surging;
    d.next = this.throwFor(d, surging);
    const depth = Math.max(0, BASE_Y - d.y);
    d.span = THREE.MathUtils.clamp((2 * depth) / (Math.max(d.vy, 0) + d.next), 0.5, 3);
    d.y0 = d.y;
    d.v0 = d.vy;
    d.seg = 'rise';
    d.segT = 0;
  }

  /**
   * Reaches the surface rising at `v`, `over` seconds ago. A porpoise or a leap is thrown clear and flies; a breath
   * rolls through, the back and blowhole out, on a swimmer's slow undulation that comes down at the speed it rose.
   */
  private fly(d: Dolphin, v: number, over: number): void {
    if (d.lift > 0 && v === d.lift) {
      d.lift = 0;
      d.once = true;
    }
    d.segT = over;
    d.vy0 = v;
    if (d.kind === 'breath') {
      d.seg = 'roll';
      d.v0 = v;
      d.next = -v;
      d.span = tuning.dolphins.breathFor;
      return;
    }
    d.seg = 'air';
    d.air = (2 * v) / G;
  }

  /** Back in, `over` seconds ago: straight into a dip that throws the next of a run, or down to swim at a depth. */
  private land(d: Dolphin, surging: boolean, over: number): void {
    const k = tuning.dolphins;
    const run = this.wanted && (d.lift > 0 || (!d.once && d.hurry && surging));
    // Breaths come in twos and threes and then a long dive, the way they really do.
    const again = !run && this.wanted && !this.busy && this.stunt?.d !== d && Math.random() < 0.16;
    d.segT = over;
    if (run || again) {
      d.seg = 'dip';
      d.v0 = -d.vy0;
      d.next = this.throwFor(d, run && surging);
      d.span = rand(1.3, 2.2);
      this.join(d, BASE_Y);
      return;
    }
    d.seg = 'hold';
    d.y = d.depth = BASE_Y - d.vy0 * over;
    d.vy = -d.vy0;
    d.once = false;
    d.hold = -(d.pack.rider ? rand(0.45, 1.1) : rand(0.6, 1.7));
    d.breath = k.breathLeast + Math.random() * k.breathSpread;
  }

  /**
   * How fast the next throw leaves the water: a set-piece's leap as asked, otherwise a slope its own pace can
   * carry, so a pod running with a slow boat rolls out low instead of standing up out of the sea.
   */
  private throwFor(d: Dolphin, surging: boolean): number {
    if (d.lift > 0) {
      d.kind = 'leap';
      return d.lift;
    }
    const k = tuning.dolphins;
    const porpoise = surging && Math.random() < k.leapChance;
    d.kind = porpoise ? 'porpoise' : 'breath';
    const slope = (porpoise ? k.porpoiseSlope : k.breathSlope) * rand(0.85, 1.15);
    /** A porpoise is run at, ahead of its lane and out from the boat, so the arc is long and low and seen from the side. */
    const spurt = porpoise && this.stunt?.d !== d;
    if (spurt) d.burst = k.porpoiseBurstFor;
    return Math.min((d.pace + (spurt ? k.porpoiseBurst : 0)) * slope, porpoise ? k.porpoiseMost : k.breathMost);
  }

  /**
   * The rise or dip under way, from (`y0`, `v0`) to leaving the surface at `next`: a cubic that matches height and
   * vertical speed at both ends, so a run of throws is one continuous path however different each throw is.
   */
  private join(d: Dolphin, y0: number): void {
    const u = d.segT / d.span;
    const m0 = d.v0 * d.span;
    const m1 = d.next * d.span;
    const u2 = u * u;
    const u3 = u2 * u;
    d.y = (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0 + (3 * u2 - 2 * u3) * BASE_Y + (u3 - u2) * m1;
    d.vy = ((6 * u2 - 6 * u) * y0 + (3 * u2 - 4 * u + 1) * m0 + (6 * u - 6 * u2) * BASE_Y + (3 * u2 - 2 * u) * m1) / d.span;
  }

  private record(d: Dolphin, time: number): void {
    const last = d.traced > 0 ? d.trace[((d.traced - 1) % TRACE) * 2] : -Infinity;
    if (time - last < 1 / 61) return;
    const i = (d.traced % TRACE) * 2;
    d.trace[i] = time;
    d.trace[i + 1] = d.pitch;
    d.traced++;
  }

  /** The beak's slope at `time`, from its trace; the oldest kept, if that is longer ago than the trace reaches. */
  private slopeAt(d: Dolphin, time: number): number {
    const kept = Math.min(d.traced, TRACE);
    let newer = -1;
    for (let n = 0; n < kept; n++) {
      const i = ((d.traced - 1 - n) % TRACE) * 2;
      if (d.trace[i] <= time) {
        if (newer < 0) return d.trace[i + 1];
        const u = (time - d.trace[i]) / Math.max(d.trace[newer] - d.trace[i], 1e-6);
        return d.trace[i + 1] + (d.trace[newer + 1] - d.trace[i + 1]) * u;
      }
      newer = i;
    }
    return newer < 0 ? d.pitch : d.trace[newer + 1];
  }

  /** Banking into the turn, a slow sway, and the roll onto one side they take to look up at the boat. */
  private bank(d: Dolphin, dt: number, time: number): void {
    const k = tuning.dolphins;
    d.rollIn -= dt;
    if (d.rollIn <= 0 && d.rollFor <= 0 && d.y < -0.1 && d.tilt === null) {
      d.rollFor = rand(1.3, 2.8);
      d.rollTo = rand(0.18, 0.4) * (Math.random() < 0.5 ? -1 : 1);
      d.rollIn = rand(9, 26);
    }
    d.rollFor -= dt;
    const lean = THREE.MathUtils.clamp(-d.turn * k.bankLean, -k.bankMost, k.bankMost);
    const want = d.tilt ?? lean + Math.sin(time * 0.7 + d.seed * 12) * 0.06 + (d.rollFor > 0 ? d.rollTo : 0);
    d.roll += (want - d.roll) * ease(dt, d.tilt === null ? 2.2 : 1.7);
  }

  /** White water: a dab and a flick of spray as the back comes out, and a small clean hole where the beak goes in. */
  private wash(d: Dolphin, dt: number, time: number): void {
    const fx = Math.sin(d.yaw);
    const fz = Math.cos(d.yaw);
    /** Marks and drops are sized against the body, which is `SCALE` times the length it was drawn at. */
    const s = d.size * SCALE;
    const back = d.y + Math.cos(d.pitch) * BACK * d.size;
    const out = back > 0.015;
    if (out && !d.wasUp) {
      this.marks.add(FOAM, d.x + fx * 0.3 * s, d.z + fz * 0.3 * s, 0.17 * s, 1.6, time, 0.42, 0.26, Math.PI / 2 - d.yaw, 2.1);
      const pace = Math.max(d.pace, 2);
      /** The harder it comes out, the more it takes with it: a breath throws a dab, a leap throws a sheet. */
      const hard = THREE.MathUtils.clamp(d.vy / 4, 0.3, 1.8);
      this.onSurface?.(d.x, d.surface, d.z, hard);
      for (let i = 0, n = Math.round(11 * hard * Math.max(1, hard)); i < n; i++) {
        const side = rand(-0.7, 0.7);
        this.drops.emit(
          d.x - fx * rand(0, 0.5) + fz * side * s,
          d.surface + 0.06 + Math.random() * 0.1,
          d.z - fz * rand(0, 0.5) - fx * side * s,
          -fx * pace * rand(0.1, 0.34) + fz * side * 1.6 * hard,
          rand(1.1, 3.2) * hard,
          -fz * pace * rand(0.1, 0.34) - fx * side * 1.6 * hard,
          rand(0.014, 0.028) * Math.max(1, hard),
          rand(0.7, 1.2),
          0,
        );
      }
      for (let i = 0, n = Math.round(2 * hard * Math.max(1, hard)); i < n; i++) {
        this.drops.emit(d.x - fx * rand(0, 0.7), d.surface + 0.12, d.z - fz * rand(0, 0.7), rand(-0.4, 0.4), rand(0.5, 1.3), rand(-0.4, 0.4), rand(0.06, 0.12), rand(0.9, 1.5), 1);
      }
    }
    if (!out && d.wasUp) {
      this.marks.add(SLICK, d.x - fx * 0.5 * s, d.z - fz * 0.5 * s, 0.45 * s, 8, time, 0.22, 0.09, Math.PI / 2 - d.yaw, 1.7);
    }
    d.wasUp = out;
    const inside = d.y < -0.02 && d.vy < 0;
    if (inside && !d.wasIn && d.vy < -1.4) {
      const deep = THREE.MathUtils.clamp(-d.vy / 4, 0.4, 1.8);
      this.onSplash?.(d.x, d.surface, d.z, deep);
      this.marks.add(RING, d.x, d.z, 0.14 * s * deep, 1.6, time, 0.4, 0.9);
      this.marks.add(FOAM, d.x, d.z, 0.1 * s * deep, 1.1, time, 0.28, 0.2);
      /** A leap going in head first throws a crown of spray up behind the tail; a breath barely marks the water. */
      for (let i = 0, n = Math.round(6 * deep * Math.max(1, deep)); i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.drops.emit(d.x, d.surface + 0.04, d.z, Math.cos(a) * rand(0.3, 0.9) * deep, rand(0.6, 1.5) * deep * Math.max(1, deep), Math.sin(a) * rand(0.3, 0.9) * deep, rand(0.014, 0.024) * Math.max(1, deep), 0.7, 0);
      }
      for (let i = 0, n = Math.round(2 * Math.max(0, deep - 1)); i < n; i++) {
        this.drops.emit(d.x - fx * rand(0, 0.5), d.surface + 0.1, d.z - fz * rand(0, 0.5), rand(-0.3, 0.3), rand(0.4, 1), rand(-0.3, 0.3), rand(0.08, 0.14), rand(0.9, 1.4), 1);
      }
    }
    d.wasIn = inside;
    d.wet = back < 0 ? 1 : Math.max(0, d.wet - dt / 1.5);
    if (!out) return;
    d.trail -= dt;
    if (d.trail > 0) return;
    d.trail = 0.1;
    this.marks.add(FOAM, d.x - fx * 0.4 * s, d.z - fz * 0.4 * s, 0.14 * s, 2.2, time, 0.5, 0.16, Math.PI / 2 - d.yaw, 1.9);
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CREATURE_GLSL } from '../../creatures/shading';
import { flipWinding } from '../../creatures/shapes';
import { tuning } from '../../tuning';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
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
 * as you walk back from the beak, so a travelling tail beat and the long arch of a leap both keep it its own size.
 */
const RIG_GLSL = /* glsl */ `
in vec4 aRig;
in vec4 iA;
in vec4 iB;
in vec4 iC;
out vec4 vRig;
out vec3 vRest;
out vec3 vRestNormal;
out float vWet;
out float vSeed;

float flexAt(float a) {
  float s = a / ${f(LEN)};
  return iB.w * pow(min(s, 1.15), 1.25) + iC.y * smoothstep(0.1, 0.95, s) * sin(iC.x - 4.4 * s);
}

vec3 place(vec3 rest, inout vec3 n) {
  float a = -rest.z;
  vec2 c = vec2(0.0);
  float th = 0.0;
  for (int i = 0; i < 12; i++) {
    float a0 = float(i) * ${f(LEN / 10)};
    float seg = min(${f(LEN / 10)}, a - a0);
    if (seg <= 0.0) break;
    float m = flexAt(a0 + seg * 0.5);
    c += vec2(sin(m), -cos(m)) * seg;
    th = flexAt(a0 + seg);
  }
  vec3 p = vec3(rest.x, c.x + cos(th) * rest.y, c.y + sin(th) * rest.y) * iB.z;
  n = vec3(n.x, n.y * cos(th) - n.z * sin(th), n.y * sin(th) + n.z * cos(th));
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
    float floorLine = -0.4 - 0.38 * smoothstep(0.55, 0.95, s) + 0.28 * smoothstep(0.25, 0.06, s);
    float pale = smoothstep(0.12, -0.12, v - floorLine + grain * 0.06);
    k.albedo = mix(mix(mix(TAN, ASH, smoothstep(0.44, 0.63, s)), BELLY, pale), CAPE, cape);
    float stripe = smoothstep(0.11, 0.0, abs(v - mix(-0.5, -0.88, smoothstep(0.1, 0.21, s)))) * smoothstep(0.085, 0.105, s) * smoothstep(0.25, 0.2, s);
    float beak = smoothstep(0.118, 0.08, s) * smoothstep(-0.6, -0.15, v);
    k.albedo = mix(k.albedo, INK, max(stripe * 0.75, beak * 0.85));
    float eye = length(vec2((s - 0.128) * ${f(DRAWN)}, (v - 0.3) * 0.17));
    k.albedo = mix(k.albedo, INK, smoothstep(0.03, 0.017, eye));
  } else {
    k.albedo = mix(CAPE, SLATE, smoothstep(0.25, -0.35, rn.y) * 0.45);
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
  env = mix(env, uSeaTint * uSkyAmbient * 1.4, smoothstep(0.0, -0.3, R.y));
  float F = 0.035 + 0.965 * pow(1.0 - nv, 5.0);
  col = mix(col, env, F * (0.3 + 0.34 * gloss));
  vec3 H = normalize(uSunDir + V);
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
    smoothstep(1.0, 0.0, r),
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
  vel: number;
  /** Fixed at lift-off: nothing steers in the air, so the throw is flown out exactly as it left. */
  flyAlong: number;
  flyAcross: number;
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
  across: number;
  yaw: number;
  pitch: number;
  arch: number;
  roll: number;
  rollTo: number;
  rollFor: number;
  rollIn: number;
  phase: number;
  beat: number;
  wet: number;
  /** 0 holding a depth, 1 running one porpoise arc. */
  arc: number;
  once: boolean;
  hold: number;
  /** What a set-piece is asking of it: a depth to hold, a lift-off speed for its next arc, a roll, a hard run. */
  held: number | null;
  lift: number;
  tilt: number | null;
  hurry: boolean;
  breath: number;
  t: number;
  air: number;
  dip: number;
  vy0: number;
  vy: number;
  wasUp: boolean;
  wasIn: boolean;
  trail: number;
}

/**
 * A pod of dolphins running with the boat on the long crossing: they come up out of the swell alongside, porpoise
 * ahead of the bow and fall back, and are the reason that crossing is the room where nothing is asked of you.
 */
export class Dolphins {
  readonly objects: THREE.Object3D[] = [];
  /** What to do when one of them shoulders the boat: the story hands the shove to the hull. */
  onShove: ((side: number, strength: number) => void) | null = null;
  private readonly mesh: THREE.Mesh;
  private readonly ghost: THREE.Mesh;
  private readonly marks = new Marks();
  private readonly drops = new Drops();
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly iA: THREE.InstancedBufferAttribute;
  private readonly iB: THREE.InstancedBufferAttribute;
  private readonly iC: THREE.InstancedBufferAttribute;
  private readonly packs: Pack[] = [];
  private readonly pod: Dolphin[] = [];
  private readonly boat = new THREE.Vector3();
  private readonly was = new THREE.Vector3();
  private head = 0;
  private heading = 0;
  private speed = 4;
  private readonly sample = { y: 0, vy: 0 };
  private readonly seen = new THREE.Vector3();
  private here = false;
  private wanted = false;
  private going = 0;
  private stunt: Stunt | null = null;
  /** Seconds the pod has been with this boat, when the next set-piece is due, and how many have been played. */
  private clock = 0;
  private next = 0;
  private turn = 0;
  private camera = 1;
  private busy = false;
  private quiet = 0;

  constructor() {
    const base = dolphinGeometry();
    this.geo.index = base.index;
    for (const name of ['position', 'normal', 'aRig']) this.geo.setAttribute(name, base.attributes[name]);
    const attr = () => new THREE.InstancedBufferAttribute(new Float32Array(POD * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iA = attr();
    this.iB = attr();
    this.iC = attr();
    this.geo.setAttribute('iA', this.iA);
    this.geo.setAttribute('iB', this.iB);
    this.geo.setAttribute('iC', this.iC);
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
   * which side of the stern the camera rides on, so the set-pieces play where they can be seen, and `busy` holds
   * them off while something else has the boat.
   */
  run(near: THREE.Vector3 | null, heading: number, camera = 1, busy = false): void {
    this.wanted = near !== null;
    this.camera = camera < 0 ? -1 : 1;
    this.busy = busy;
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
      if (this.going > 7) {
        this.here = false;
        this.mesh.visible = this.ghost.visible = false;
        this.geo.instanceCount = 0;
        return;
      }
    }
    const turn = Math.atan2(Math.sin(this.heading - this.head), Math.cos(this.heading - this.head));
    this.head += turn * ease(dt, 3.6);
    this.quiet += ((this.busy ? 1 : 0) - this.quiet) * ease(dt, tuning.dolphins.quietEase);
    const step = Math.hypot(this.boat.x - this.was.x, this.boat.z - this.was.z);
    if (step < 8) this.speed += (step / dt - this.speed) * ease(dt, 1.5);
    this.was.copy(this.boat);

    const fx = Math.sin(this.head);
    const fz = Math.cos(this.head);
    for (const p of this.packs) this.steer(p, dt);
    if (this.wanted || this.stunt) this.show(dt);
    const A = this.iA.array as Float32Array;
    const B = this.iB.array as Float32Array;
    const C = this.iC.array as Float32Array;
    for (let i = 0; i < POD; i++) {
      const d = this.pod[i];
      const p = d.pack;
      const s = this.stunt && this.stunt.d === d ? this.stunt : null;
      const along = s ? s.along : p.along + d.dAlong + this.quiet * tuning.dolphins.quietLead;
      const across = s ? s.across : this.wide(d, along);
      const oldX = d.x, oldZ = d.z;
      d.across = across;
      d.x = this.boat.x + fx * along + fz * across;
      d.z = this.boat.z + fz * along - fx * across;
      // Face the actual path through the world, including a turning boat and a change of station.
      const vx = d.placed ? (d.x - oldX) / dt : fx * this.speed;
      const vz = d.placed ? (d.z - oldZ) / dt : fz * this.speed;
      const pace = Math.max(0.5, Math.hypot(vx, vz));
      const yaw = Math.atan2(vx, vz);
      const turn = Math.atan2(Math.sin(yaw - d.yaw), Math.cos(yaw - d.yaw));
      d.yaw = d.placed ? d.yaw + turn * ease(dt, 7) : this.head;
      d.placed = true;
      const drift = Math.atan2(Math.sin(d.yaw - this.head), Math.cos(d.yaw - this.head));
      d.surface = swellLift(d.x, d.z, time);
      this.swim(d, dt, time, pace);
      this.bank(d, dt, time, drift);
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
    }
    this.iA.needsUpdate = this.iB.needsUpdate = this.iC.needsUpdate = true;
    this.geo.instanceCount = POD;
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
      across: 0,
      yaw: 0,
      pitch: 0,
      arch: 0,
      roll: 0,
      rollTo: 0,
      rollFor: 0,
      rollIn: rand(6, 20),
      phase: Math.random() * 6.28,
      beat: 0.3,
      wet: 0,
      arc: 0,
      once: false,
      hold: -2,
      held: null,
      lift: 0,
      tilt: null,
      hurry: false,
      breath: rand(2, 14),
      t: 0,
      air: 0.6,
      dip: 0.6,
      vy0: 3,
      vy: 0,
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
      p.delay = p.rider ? rand(4, 9) : rand(0, 3) * n;
      n++;
    }
    for (const d of this.pod) {
      d.placed = false;
      d.y = d.hold = -rand(1.6, 3.4);
      d.arc = 0;
      d.once = false;
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
    this.next = rand(tuning.dolphins.leapAt - 6, tuning.dolphins.leapAt + 9);
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
    p.entry = this.wanted ? Math.min(0, p.entry + dt * p.close) : p.entry - dt * 3;
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
      const kind: Show = this.turn === 0 ? 'leap' : this.turn === 1 ? 'push' : Math.random() < 0.5 ? 'leap' : 'push';
      if (!this.busy && this.wanted && this.clock > this.next) this.begin(kind);
      return;
    }
    /** Anything that comes up mid-approach sends it back to the pod; nothing is ever cut away from. */
    if ((this.busy || !this.wanted) && (s.phase === 'out' || s.phase === 'run')) {
      s.phase = 'back';
      s.t = 0;
      s.d.hurry = false;
    }
    const was = s.along;
    s.t += dt;
    if (s.phase === 'back') this.rejoin(s, dt);
    else if (s.kind === 'leap') this.leap(s, dt);
    else this.shove(s, dt);
    s.vel = (s.along - was) / dt;
  }

  /** Sends one of the grown ones out of its lane, already on the side it is wanted, so nothing jumps across. */
  private begin(kind: Show): void {
    if (this.stunt) return;
    const side = this.camera;
    let d: Dolphin | null = null;
    let nearest = -1e9;
    for (const other of this.pod) {
      if (!other.adult || other.pack.rider) continue;
      const score = side * other.across;
      if (score > nearest) {
        nearest = score;
        d = other;
      }
    }
    if (!d) return;
    this.stunt = { kind, d, phase: 'out', t: 0, side, along: d.pack.along + d.dAlong + this.quiet * tuning.dolphins.quietLead, across: d.across, vel: d.pack.vel, flyAlong: 0, flyAcross: 0, asked: false, hit: false };
    d.held = kind === 'push' ? -2.2 : -2.8;
    d.hurry = false;
    d.tilt = null;
  }

  /**
   * Eases the beak toward a station in the boat's frame, within what one can really do: it overhauls the boat at
   * its own best speed at most, and to drop back it can only stop swimming and let the boat run away from it.
   */
  private glide(s: Stunt, along: number, across: number, rate: number, dt: number): void {
    const k = ease(dt, rate);
    s.along += THREE.MathUtils.clamp((along - s.along) * k, -this.speed * dt, 7 * dt);
    s.across += THREE.MathUtils.clamp((across - s.across) * k, -6 * dt, 6 * dt);
  }

  /**
   * One long leap along the near side. The whole animal stays between boat and camera; it never crosses the
   * sail or threatens the child. Its forward and outward velocities are fixed at take-off.
   */
  private leap(s: Stunt, dt: number): void {
    const d = s.d;
    if (s.phase === 'out') {
      this.glide(s, -3, s.side * 6.5, 0.85, dt);
      if (s.t > 3.6 && (Math.abs(s.across) > 5 || s.t > 7)) {
        s.phase = 'run';
        s.t = 0;
        d.held = null;
        d.hurry = true;
      }
    } else if (s.phase === 'run') {
      this.glide(s, 0.5, s.side * 5.5, 0.55, dt);
      if (s.t > 4.2 && !s.asked) {
        s.asked = true;
        d.lift = tuning.dolphins.leapLift * rand(0.96, 1.06);
      }
      if (s.asked && d.lift === 0 && d.arc === 1) {
        s.phase = 'act';
        s.t = 0;
        s.flyAcross = s.side * 0.45;
        s.flyAlong = 3.2;
        d.tilt = s.side * 0.4;
      }
    } else if (s.phase === 'act') {
      s.along += s.flyAlong * dt;
      s.across += s.flyAcross * dt;
      if (d.t >= d.air || d.arc === 0) {
        /** In, and the sea takes the run out of it. */
        d.hurry = false;
        d.tilt = null;
        s.flyAlong += (0.3 - s.flyAlong) * ease(dt, 2.2);
        s.flyAcross -= s.flyAcross * ease(dt, 2.2);
      }
      if (d.arc === 0) {
        s.phase = 'back';
        s.t = 0;
        d.held = -2.4;
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
      this.glide(s, -16, s.side * 7, 0.8, dt);
      if (s.t > 3.2 && (s.along < -9 || s.t > 7)) {
        s.phase = 'run';
        s.t = 0;
        d.held = null;
        d.hurry = true;
      }
    } else if (s.phase === 'run') {
      this.glide(s, -4.5, s.side * 2.8, 0.45, dt);
      /** It stops porpoising first: the last arc has to come down before it can lie alongside. */
      if (s.t > 4.5) d.hurry = false;
      if (s.t > 4.5 && d.arc === 0) {
        s.phase = 'act';
        s.t = 0;
        /** High enough that the flank it rolls onto stays out of the water, where the child can see the eye. */
        d.held = -0.02;
      }
    } else if (s.phase === 'act') {
      d.tilt = -s.side * 1.5;
      if (!s.hit) {
        this.glide(s, SHOVE_ALONG, s.side * SHOVE_ACROSS, 1.1, dt);
        if (Math.abs(s.across) < SHOVE_ACROSS + 0.06 && s.along > SHOVE_ALONG - 0.4) {
          s.hit = true;
          s.t = 0;
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
    const along = d.pack.along + d.dAlong + this.quiet * tuning.dolphins.quietLead;
    const across = this.wide(d, along);
    this.glide(s, along, across, 0.5, dt);
    if (Math.hypot(along - s.along, across - s.across) < 1.2 || s.t > 16) {
      d.held = null;
      d.hurry = false;
      d.breath = rand(0.5, 3);
      this.stunt = null;
      this.turn++;
      const t = tuning.dolphins;
      this.next = this.turn === 1 ? rand(t.pushAt - 8, t.pushAt + 12) : this.clock + rand(t.restLeast, t.restLeast + t.restSpread);
    }
  }

  /** The vertical life of one dolphin: a held depth, or a ballistic arc and the matched dip that follows it. */
  private swim(d: Dolphin, dt: number, time: number, pace: number): void {
    const p = d.pack;
    const surging = d.hurry || (p.up && !p.rider && p.delay <= 0 && this.wanted);
    if (d.arc === 0) {
      if (d.held !== null) d.hold = d.held;
      else if (!this.wanted) d.hold -= dt * 0.55;
      else if (d.hurry) d.hold = BASE_Y;
      else {
        d.breath -= dt;
        if (d.breath <= 0) d.hold = BASE_Y;
        else if (d.hold > -0.3) d.hold = -(p.rider ? rand(0.45, 1.1) : rand(0.6, 1.7));
      }
      const to = d.hold + Math.sin(time * 0.5 + d.seed * 9) * 0.06;
      const was = d.y;
      d.y += (to - d.y) * ease(dt, surging || d.held !== null ? 1.6 : 0.5);
      d.vy += ((d.y - was) / dt - d.vy) * ease(dt, 6);
      const up = d.lift > 0 || (d.held === null && (d.hurry || d.breath <= 0));
      if (up && this.wanted && Math.abs(d.y - BASE_Y) < 0.1) {
        d.arc = 1;
        d.t = 0;
        d.once = !surging;
        this.pick(d, surging);
      }
    } else {
      d.t += dt;
      if (d.t >= d.air + d.dip) {
        d.t -= d.air + d.dip;
        if (!d.hurry || d.once || !surging || !this.wanted) {
          d.arc = 0;
          d.once = false;
          // Breaths come in twos and threes and then a long dive, the way they really do.
          const again = !this.busy && Math.random() < 0.16;
          d.hold = again ? BASE_Y : -(p.rider ? rand(0.45, 1.1) : rand(0.6, 1.7));
          d.breath = again ? rand(0.35, 0.95) : tuning.dolphins.breathLeast + Math.random() * tuning.dolphins.breathSpread;
        } else this.pick(d, true);
      }
      this.arcAt(d, d.t);
      d.y = this.sample.y;
      d.vy = this.sample.vy;
    }
    d.pitch = Math.atan2(d.vy, pace);
    if (d.arc === 1) {
      let lag = d.t - (LEN * d.size) / pace;
      if (lag < 0) lag += d.air + d.dip;
      this.arcAt(d, lag);
      // The body lies along the path it has just flown: the tail holds the slope the beak had a body length ago.
      const tuck = d.t < d.air ? 0.22 * THREE.MathUtils.smoothstep(d.t / d.air, 0.68, 1) : 0;
      d.arch += ((d.pitch - Math.atan2(this.sample.vy, pace)) * 0.6 - tuck - d.arch) * ease(dt, 14);
    } else d.arch += (Math.sin(time * 0.4 + d.seed * 5) * 0.05 - d.arch) * ease(dt, 2);

    const sunk = 1 - THREE.MathUtils.smoothstep(d.y, 0.0, 0.35);
    d.beat += (0.3 * (0.2 + 0.8 * sunk) * (surging ? 1.15 : 0.75) - d.beat) * ease(dt, 4);
    d.phase += dt * (surging ? 14.5 + d.seed * 2.2 : 7.6 + d.seed * 1.4);
    this.wash(d, dt, time);
  }

  /** Chooses the next arc: a true leap while they are running up, a lazy roll for a breath otherwise. */
  private pick(d: Dolphin, surging: boolean): void {
    if (d.lift > 0) {
      /** A throw this big goes in steeply on the far side, so the dip after it is short and deep. */
      d.vy0 = d.lift;
      d.lift = 0;
      d.air = (2 * d.vy0) / G;
      d.dip = 0.55;
      return;
    }
    d.vy0 = surging && Math.random() < tuning.dolphins.leapChance ? rand(2.4, 3.1) : rand(0.75, 1.25);
    d.air = (2 * d.vy0) / G;
    d.dip = rand(1.3, 2.2);
  }

  /**
   * Where the beak is `t` seconds into one porpoise: a ballistic throw, then a dip whose depth and slope are set by
   * the throw it follows, so the two meet smoothly and how deep they go falls out of how hard they left.
   */
  private arcAt(d: Dolphin, t: number): void {
    if (t < d.air) {
      this.sample.y = BASE_Y + d.vy0 * t - 0.5 * G * t * t;
      this.sample.vy = d.vy0 - G * t;
    } else {
      const u = (t - d.air) / d.dip;
      const deep = (d.vy0 * d.dip) / Math.PI;
      this.sample.y = BASE_Y - deep * Math.sin(Math.PI * u);
      this.sample.vy = -deep * (Math.PI / d.dip) * Math.cos(Math.PI * u);
    }
  }

  /** Banking into the turn, a slow sway, and the roll onto one side they take to look up at the boat. */
  private bank(d: Dolphin, dt: number, time: number, drift: number): void {
    d.rollIn -= dt;
    if (d.rollIn <= 0 && d.rollFor <= 0 && d.y < -0.1 && d.tilt === null) {
      d.rollFor = rand(1.3, 2.8);
      d.rollTo = rand(0.18, 0.4) * (Math.random() < 0.5 ? -1 : 1);
      d.rollIn = rand(9, 26);
    }
    d.rollFor -= dt;
    const want = d.tilt ?? -drift * 1.5 + Math.sin(time * 0.7 + d.seed * 12) * 0.06 + (d.rollFor > 0 ? d.rollTo : 0);
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
      const pace = Math.max(this.speed + d.pack.vel, 2);
      /** The harder it comes out, the more it takes with it: a breath throws a dab, a leap throws a sheet. */
      const hard = THREE.MathUtils.clamp(d.vy / 4, 0.3, 1.8);
      for (let i = 0, n = Math.round(11 * hard); i < n; i++) {
        const side = rand(-0.7, 0.7);
        this.drops.emit(
          d.x - fx * rand(0, 0.5) + fz * side * s,
          d.surface + 0.06 + Math.random() * 0.1,
          d.z - fz * rand(0, 0.5) - fx * side * s,
          -fx * pace * rand(0.1, 0.34) + fz * side * 1.6 * hard,
          rand(1.1, 3.2) * hard,
          -fz * pace * rand(0.1, 0.34) - fx * side * 1.6 * hard,
          rand(0.014, 0.028),
          rand(0.7, 1.2),
          0,
        );
      }
      for (let i = 0, n = Math.round(2 * hard); i < n; i++) {
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
      this.marks.add(RING, d.x, d.z, 0.14 * s * deep, 1.6, time, 0.4, 0.9);
      this.marks.add(FOAM, d.x, d.z, 0.1 * s * deep, 1.1, time, 0.28, 0.2);
      for (let i = 0, n = Math.round(6 * deep); i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.drops.emit(d.x, d.surface + 0.04, d.z, Math.cos(a) * rand(0.3, 0.9) * deep, rand(0.6, 1.5) * deep, Math.sin(a) * rand(0.3, 0.9) * deep, rand(0.014, 0.024), 0.7, 0);
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

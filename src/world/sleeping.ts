import * as THREE from 'three';
import { SleepingWeather } from './sleeping-weather';
import { SleepingHearth } from './sleeping-hearth';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Feather } from '../fx/feather';
import { CurtainRibbon } from './sleeping-ribbon';
import { SLEEP_PATH } from './sleeping-layout';
import { SleepingTrail } from './sleeping-trail';
import { GpuRunner, PingPong, simMaterial } from '../gl/gpu';
import type { PointerInput } from '../input/pointer';
import { glsl, tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { SLEEP_HILL, SLEEP_HOLLOW } from './heightfield';
import { heightAt } from './island';
import { mulberry32 } from './noise';

/** The east shore, facing back the way they came: the beach the boat runs up out of the dark wood. */
export const SLEEP_LANDING = new THREE.Vector2(-134, -1916);
/** The west shore, where the boat is drawn up for the long crossing home. */
export const SLEEP_BERTH = new THREE.Vector3(-214.5, 0, -1926);

/** The way the bed's head end points: toward the hill, and toward the window the morning comes through. */
export const BED_FACING = new THREE.Vector2(-0.35, -0.94).normalize();
const BED_LENGTH = 3.45;
const BED_WIDTH = 1.95;

function groundAround(x: number, z: number, radius: number): number {
  let top = heightAt(x, z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    top = Math.max(top, heightAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius));
  }
  return top;
}

const BED_GROUND = groundAround(-176.5, -1911, 1.4);
/** The bed, made up in the grass on the open terrace. Its head end points along `BED_FACING`. */
export const BED = new THREE.Vector3(-176.5, BED_GROUND, -1911);
/** Where the pillow lies, which is what the morning has to reach. */
export const PILLOW = new THREE.Vector3(
  BED.x + BED_FACING.x * (BED_LENGTH / 2 - 0.45),
  BED_GROUND + 0.72,
  BED.z + BED_FACING.y * (BED_LENGTH / 2 - 0.45),
);
/** The top of the hill north of the hollow: out of the fog, and where the first sun lands. */
export const HILLTOP = new THREE.Vector3(SLEEP_HILL.x, 0, SLEEP_HILL.z);
HILLTOP.y = heightAt(HILLTOP.x, HILLTOP.z);

/** Across the bed from the window: the side the child comes to it from. */
const BESIDE_BED = new THREE.Vector2(-BED_FACING.y, BED_FACING.x);

/** The bedside lamp's bulb: the one warm light in the blue. */
export const LAMP = new THREE.Vector3(PILLOW.x + BESIDE_BED.x * 1.15, 0, PILLOW.z + BESIDE_BED.y * 1.15);
const LAMP_GROUND = groundAround(LAMP.x, LAMP.z, 0.4);
LAMP.y = LAMP_GROUND + 1.3;

/** The summit window holds the morning behind its curtains, facing down into the sleeping hollow. */
export const WINDOW = new THREE.Vector3(-180, 0, -1939.6);
export const SLEEP_ROUTE = SLEEP_PATH.map(([x,z]) => new THREE.Vector3(x, heightAt(x,z), z));
export const SLEEP_LEDGE = SLEEP_ROUTE[SLEEP_ROUTE.length - 1];
export const SLEEP_APPROACH = SLEEP_ROUTE[SLEEP_ROUTE.length - 2];
const WINDOW_GROUND = groundAround(WINDOW.x, WINDOW.z, 0.9);
export const WINDOW_INTO = new THREE.Vector3(BED.x - WINDOW.x, BED.y + 1.1 - (WINDOW_GROUND + 1.35), BED.z - WINDOW.z).normalize();
const PANE_W = 2.0;
const PANE_H = 2.4;
const RAIL_Y = PANE_H + 0.2;
const CURTAIN_DROP = RAIL_Y - 0.28;
WINDOW.y = WINDOW_GROUND + 1.35;
export const CURTAIN_KNOT = new THREE.Vector3(WINDOW.x, WINDOW_GROUND + 1.52, WINDOW.z + 0.3);
/** The loose end is out beyond the lip; its underside is several metres above the slope. */
export const CURTAIN_END = new THREE.Vector3(WINDOW.x + 0.15, WINDOW_GROUND + 0.85, -1936.7);

/** Fragments of a room set into the turf: chair, writing table and crooked standing lamp. */
const FLEX_AT = new THREE.Vector2(BED.x + BESIDE_BED.x * 3.6 + BED_FACING.x * 1.6, BED.z + BESIDE_BED.y * 3.6 + BED_FACING.y * 1.6);
const CHAIR_AT = new THREE.Vector2(BED.x + BESIDE_BED.x * 3.8 + BED_FACING.x * 2.3, BED.z + BESIDE_BED.y * 3.8 + BED_FACING.y * 2.3);
const DESK_AT = new THREE.Vector2(BED.x - BESIDE_BED.x * 3.8 - BED_FACING.x * 1.2, BED.z - BESIDE_BED.y * 3.8 - BED_FACING.y * 1.2);

/** The carve field covers the island: gusts cut lanes in the fog anywhere on it, not only over the hollow. */
const CARVE_RES = 128;
const CARVE_SPAN = 116;
const CARVE_MIN = new THREE.Vector2(SLEEP_HOLLOW.x - CARVE_SPAN / 2, SLEEP_HOLLOW.z - CARVE_SPAN / 2 - 6);
/** The most gust segments stamped into it in one frame. */
const STAMPS = 6;

/** Beyond this the room is not in the world at all, and nothing it drives costs any other room anything. */
const RANGE = 300;
/** How far from the hollow the island still counts as the world one is in, for what a summer night is not allowed there. */
const PRESENCE_TO = 110;

const DOWN = 64;

/** Mirrors `laneAt` in `ATMO_GLSL`, which a simulation pass cannot include; keep the two in step. */
const LANE_GLSL = /* glsl */ `
uniform vec4 uLane;
uniform vec2 uLaneOpen;
float laneCut(vec2 xz) {
  if (uLaneOpen.y <= 0.0) return 0.0;
  vec2 ab = uLane.zw - uLane.xy;
  float t = clamp(dot(xz - uLane.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float d = distance(xz, uLane.xy + ab * t);
  return (1.0 - smoothstep(uLaneOpen.x * 0.45, uLaneOpen.x, d)) * (1.0 - smoothstep(uLaneOpen.y - 0.08, uLaneOpen.y + 0.08, t));
}`;

/**
 * The fog remembers where it has been blown apart. 1 is fog and 0 is clear air; it heals back toward 1 over a
 * few seconds, so a climb through it is made a few paces of clear air at a time.
 */
const CARVE_FRAG = /* glsl */ `
${LANE_GLSL}
uniform sampler2D uSrc;
uniform float uDt;
uniform float uHeal;
uniform vec4 uField;
uniform vec4 uStamp[${STAMPS}];
uniform vec2 uStampArg[${STAMPS}];
uniform int uStamps;
in vec2 vUv;
void main() {
  vec2 world = uField.xy + vUv / uField.zw;
  float c = texture(uSrc, vUv).r;
  c += (1.0 - c) * (1.0 - exp(-uDt * uHeal));
  for (int i = 0; i < ${STAMPS}; i++) {
    if (i >= uStamps) break;
    vec2 a = uStamp[i].xy;
    vec2 ab = uStamp[i].zw - a;
    float t = clamp(dot(world - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float d = distance(world, a + ab * t);
    float r = uStampArg[i].x;
    c -= exp(-d * d / (r * r)) * uStampArg[i].y;
  }
  gl_FragColor = vec4(clamp(min(c, 1.0 - laneCut(world)), 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

const FILL_FRAG = /* glsl */ `
void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`;

/** Everything in the room that is made of something: painted wood, brass, linen over a mattress. */
const PROP_VERT = /* glsl */ `
in vec3 color;
in float aGlow;
out vec3 vColor;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vGlow;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vColor = color;
  vWorld = w.xyz;
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vGlow = aGlow;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const PROP_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vColor;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vGlow;
void main() {
  vec3 n = normalize(vNormal);
  vec3 alb = vColor * (0.92 + 0.16 * vnoise(vLocal.xz * 7.0 + vLocal.y * 5.0));
  /** Rime settles on whatever is facing the sky, so the frost comes over the bed as well as over the grass. */
  alb = mix(alb, vec3(0.78, 0.83, 0.88), frostAt(vWorld.xz) * max(n.y, 0.0) * 0.45);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(n) + uSunColor * max(dot(n, uSunDir) * 0.6 + 0.4, 0.0) * 0.5 * sun
                    + lampLight(vWorld, n) + dawnLight(vWorld, n));
  col = mix(col, vec3(1.0, 0.76, 0.42) * 2.0, vGlow * clamp(uLamp.w / ${glsl(tuning.sleeping.lamp)}, 0.0, 1.0));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * Cloth on a bed and cloth in a window: one shader, given its shape by the vertex stage. It is thin, so the
 * light behind it comes through as much as the light on it bounces off.
 */
const CLOTH_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vColor;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  float ndl = dot(N, uSunDir);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 cloth = vColor * (0.94 + 0.06 * sin(vUv.x * 190.0) * sin(vUv.y * 150.0));
  float border = (1.0 - smoothstep(0.035, 0.05, min(vUv.x, 1.0-vUv.x)))
    + (1.0 - smoothstep(0.035, 0.05, min(vUv.y, 1.0-vUv.y)));
  cloth = mix(cloth, vec3(0.52,0.20,0.13), clamp(border,0.0,1.0)*0.5);
  cloth = mix(cloth, vec3(0.8, 0.85, 0.9), frostAt(vWorld.xz) * max(N.y, 0.0) * 0.4);
  float through = max(-ndl, 0.0) * 0.5;
  vec3 col = cloth * (hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.5 + through * 0.6) * sun
                      + lampLight(vWorld, N) + dawnLight(vWorld, N));
  float windowCloth = 1.0 - smoothstep(1.0, 2.8, distance(vWorld.xz, uDawnSource.xz));
  col += cloth * vec3(0.18,0.11,0.055) * windowCloth * (1.0-uDawn.x);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const BLANKET_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uCloth;
uniform vec4 uBed;
uniform vec2 uBedAxis;
uniform vec3 uFold;
uniform float uPull;
/** Who is under it: how much of them there is, how far up the bed they lie, and how they breathe. */
uniform vec3 uSleeper;
out vec3 vColor;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;

/**
 * A blanket thrown back is cloth folding over itself, not a sheet sliding down the bed: past the fold line the
 * cloth runs back the way it came, and it stands up over the fold as it goes.
 */
vec3 clothAt(vec2 uvw) {
  float fold = uFold.x;
  float back = uvw.y >= fold ? uvw.y : 2.0 * fold - uvw.y;
  float over = uvw.y >= fold ? 0.0 : sin(clamp((fold - uvw.y) / max(fold, 1e-3), 0.0, 1.0) * 3.14159) * (0.1 + 0.26 * fold) + 0.05;
  float across = (uvw.x - 0.5) * 2.0;
  float drape = smoothstep(0.8, 1.0, abs(across));
  vec2 side = vec2(-uBedAxis.y, uBedAxis.x);
  vec2 xz = uBed.xy + uBedAxis * ((back - 0.5) * uBed.z) + side * (across * uBed.w);
  float lift = uFold.y * (1.0 - smoothstep(0.1, 0.9, back)) * (0.35 + 0.5 * sin(back * 3.14159));
  float ripple = sin(uTime * 2.1 + back * 7.0 + across * 3.0) * uFold.z * (0.3 + 0.7 * back)
    + sin(across * 16.0 + back * 3.0) * 0.035 * smoothstep(0.3, 1.0, abs(across));
  /**
   * A child asleep under it: the cloth stands over a long shape lying up the bed, highest at the shoulders and
   * falling away down the legs, and it rises and falls with their breathing. Where the blanket has been thrown
   * back off them there is nothing left to stand over, so the shape goes with the fold.
   */
  float along = 1.0 - smoothstep(uSleeper.y - 0.3, uSleeper.y + 0.25, back);
  float wide = clamp(abs(across) / ${glsl(tuning.sleeping.sleeperWide)}, 0.0, 1.0);
  float body = uSleeper.x * sqrt(1.0 - wide * wide) * (0.65 + 0.35 * sin(back * 3.14159)) * along * smoothstep(fold - 0.08, fold + 0.12, uvw.y);
  float y = ${glsl(BED_GROUND)} + 0.655 + over - drape * 0.34 * (1.0 - min(1.0, body * 1.2)) + lift + ripple + body * (1.0 + uSleeper.z)
    + uPull * exp(-pow((uvw.y - fold) * 12.0, 2.0));
  // Keep shallow cloth ripples above the mattress as the sleeper rises; the sides still drape.
  y = max(y, ${glsl(BED_GROUND)} + 0.69 - drape * 0.34);
  return vec3(xz.x, y, xz.y);
}

void main() {
  vUv = uv;
  vec3 p = clothAt(uv);
  vec3 a = clothAt(uv + vec2(0.04, 0.0));
  vec3 b = clothAt(uv + vec2(0.0, 0.04));
  vWorld = p;
  vNormal = normalize(cross(b - p, a - p));
  vColor = uCloth;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const CURTAIN_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uCloth;
uniform vec3 uHang;
uniform vec4 uPane;
uniform vec3 uOpen;
in float aSide;
out vec3 vColor;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;

/**
 * Drawn, the two panels meet in the middle; thrown open, each gathers toward its own side of the frame into
 * folds that stand deeper as they bunch, and the hem is left behind and swings.
 */
vec3 curtainAt(vec2 uvw, float side) {
  float open = uOpen.x;
  float inner = mix(0.065 + uOpen.y * 0.14, uPane.x * ${glsl(tuning.sleeping.curtainOpen)}, open);
  float across = side * mix(inner, uPane.x, uvw.x);
  float folds = sin(uvw.x * 9.42) * (0.085 + ${glsl(tuning.sleeping.curtainGather)} * open) * (0.35 + 0.65 * uvw.y);
  float sway = (uOpen.y + uOpen.z * 0.4) * uvw.y * uvw.y;
  vec3 right = vec3(-uHang.z, 0.0, uHang.x);
  vec3 ahead = vec3(uHang.x, 0.0, uHang.z);
  vec3 p = uPane.yzw;
  float tied = (1.0 - smoothstep(0.0, 0.25, open)) * exp(-pow((uvw.y - 0.47) * 5.0, 2.0));
  p += right * (across - side * inner * tied * 0.78 * (1.0 - uvw.x) + folds * side * 0.5) + ahead * (folds + sway * (1.0 - tied));
  p.y -= uvw.y * ${glsl(CURTAIN_DROP)};
  return p;
}

void main() {
  vUv = uv;
  vec3 p = curtainAt(uv, aSide);
  vec3 a = curtainAt(uv + vec2(0.05, 0.0), aSide);
  vec3 b = curtainAt(uv + vec2(0.0, 0.05), aSide);
  vWorld = p;
  /** Both panels take the same normal: the mirrored one's winding is answered by gl_FrontFacing below. */
  vNormal = normalize(cross(b - p, a - p));
  vColor = uCloth;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

/**
 * The rug and the boards under it: flat things that were part of a floor and now give out into frosted grass.
 * Their edges are dithered away by coverage rather than blended, so the blades standing in them still draw.
 */
const FLOOR_VERT = /* glsl */ `
in vec3 color;
in vec2 aEdge;
out vec3 vColor;
out vec3 vWorld;
out vec2 vEdge;
void main() {
  vColor = color;
  vWorld = position;
  vEdge = aEdge;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const FLOOR_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vColor;
in vec3 vWorld;
in vec2 vEdge;
void main() {
  float keep = smoothstep(0.0, 1.0, min(vEdge.x, vEdge.y) * (0.6 + 0.8 * fbm(vWorld.xz * 0.8)));
  if (keep < 0.02) discard;
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 alb = vColor * (0.9 + 0.2 * vnoise(vWorld.xz * 6.0));
  alb = mix(alb, vec3(0.78, 0.83, 0.88), frostAt(vWorld.xz) * 0.5);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(n) + uSunColor * 0.35 * sun + lampLight(vWorld, n) + dawnLight(vWorld, n));
  gl_FragColor = vec4(applyFog(col, vWorld), keep);
}`;

/** The down out of the pillow: small, soft and slow, hanging on the air the way nothing else in the game does. */
const DOWN_VERT = /* glsl */ `
in vec4 aDown;
out vec2 vUv;
out float vFade;
out vec3 vWorld;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vWorld = aDown.xyz + (right * position.x + up * position.y) * 0.055;
  vUv = position.xy;
  vFade = aDown.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in float vFade;
in vec3 vWorld;
void main() {
  float a = (1.0 - smoothstep(0.1, 1.0, length(vUv))) * vFade;
  if (a < 0.004) discard;
  vec3 col = vec3(0.95, 0.96, 0.98) * (uSkyAmbient * 1.6 + uSunColor * 0.2);
  col += lampLight(vWorld, normalize(uLamp.xyz - vWorld)) * 0.8 + dawnLight(vWorld, vec3(0.0, 1.0, 0.0));
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(mix(col, f.rgb, f.a * 0.7), a);
}`;

/** Morning held behind the summit curtains; a narrow seam is visible before they open. */
const MORNING_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uOpen;
in vec2 vUv;
in vec3 vWorld;
void main() {
  vec3 col = mix(vec3(1.0, 0.73, 0.44), vec3(1.0, 0.91, 0.73), smoothstep(0.0, 0.85, vUv.y));
  float cloud = sin(vUv.y * 28.0 + sin(vUv.x * 5.0) * 0.9) * 0.025;
  col *= 0.9 + uOpen.x * 0.65 + cloud;
  float arriving = journeyVeilAt(vWorld);
  if (arriving > 0.0) col = mix(col, skyRadiance(normalize(vWorld - cameraPosition)), arriving);
  gl_FragColor = vec4(col, 1.0);
}`;

/** The first spill of light out of the window; the shared dawn lane carries it down the hill. */
const SHAFT_VERT = /* glsl */ `
out vec2 vUv;
out vec3 vWorld;
void main() {
  vUv = uv;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const SHAFT_FRAG = /* glsl */ `
uniform float uThrough;
uniform float uReach;
in vec2 vUv;
void main() {
  float edge = exp(-pow((vUv.x-.5)*4.0,2.0)) * (1.0-smoothstep(.35,.5,abs(vUv.x-.5)));
  float front = 1.0-smoothstep(uReach-.09,uReach+.09,vUv.y);
  float rays = .78+.22*sin(vUv.x*31.0+sin(vUv.y*7.0));
  float a = uThrough * edge * front * rays * (1.0-smoothstep(.8,1.0,vUv.y));
  if (a < 0.002) discard;
  gl_FragColor = vec4(vec3(1.0,.79,.46)*1.2,a*.045);
}`;

type Part = [THREE.BufferGeometry, THREE.Color, number];

function prop(geo: THREE.BufferGeometry, color: THREE.Color, glow = 0): Part {
  return [geo, color, glow];
}

function buildProps(parts: Part[]): THREE.BufferGeometry {
  return mergeGeometries(
    parts.map(([g, c, glow]) => {
      const geo = (g.index ? g.toNonIndexed() : g).clone();
      geo.deleteAttribute('uv');
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
      return geo;
    }),
  );
}

const PAINT = new THREE.Color('#dfd8c8');
const TIMBER = new THREE.Color('#7c6247');
const LINEN = new THREE.Color('#ece5d4');
const BLANKET_RED = new THREE.Color('#a85a48');
const RUG_RED = new THREE.Color('#7b5a55');
const BOARD = new THREE.Color('#7d6b55');
const BRASS = new THREE.Color('#b5915a');
const SHADE = new THREE.Color('#e9dcc0');

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/** The bed: four posts, boards at each end, a mattress and a pillow. The blanket on it is cloth and is its own. */
function cushion(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 28, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const round = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.48);
    p.setXYZ(i, round(p.getX(i)) * w / 2 + x, round(p.getY(i)) * h / 2 + y, round(p.getZ(i)) * d / 2 + z);
  }
  g.computeVertexNormals();
  return g;
}

function bedParts(): Part[] {
  const L = BED_LENGTH;
  const W = BED_WIDTH;
  const parts: Part[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tall = sz < 0 ? 0.86 : 0.58;
      parts.push(prop(box(0.09, tall, 0.09, sx * (W / 2 - 0.04), tall / 2, sz * (L / 2 - 0.04)), PAINT));
      parts.push(prop(new THREE.SphereGeometry(0.058, 8, 6).translate(sx * (W / 2 - 0.04), tall + 0.02, sz * (L / 2 - 0.04)), PAINT));
    }
  }
  parts.push(prop(box(W - 0.1, 0.34, 0.06, 0, 0.62, -(L / 2 - 0.04)), PAINT));
  parts.push(prop(box(W - 0.1, 0.2, 0.06, 0, 0.42, L / 2 - 0.04), PAINT));
  for (const sx of [-1, 1]) parts.push(prop(box(0.06, 0.13, L - 0.18, sx * (W / 2 - 0.04), 0.36, 0), PAINT));
  parts.push(prop(cushion(W - 0.1, 0.25, L - 0.16, 0, 0.54, 0), LINEN));
  const pillow = cushion(1.12, 0.22, 0.72, 0, 0.75, -(L / 2 - 0.52));
  pillow.rotateX(-0.07);
  parts.push(prop(pillow, LINEN));
  return parts;
}

/** A lamp standing on the grass where a bedside table would be, if there were one. */
function lampParts(): Part[] {
  return [
    prop(new THREE.CylinderGeometry(0.15, 0.19, 0.05, 10).translate(0, 0.025, 0), BRASS),
    prop(new THREE.CylinderGeometry(0.03, 0.035, 1.03, 8).translate(0, 0.535, 0), BRASS),
    prop(new THREE.CylinderGeometry(0.17, 0.25, 0.28, 12, 1, true).translate(0, 1.2, 0), SHADE, 0.5),
    prop(new THREE.SphereGeometry(0.075, 8, 6).translate(0, 1.14, 0), SHADE, 1),
  ];
}

/** A window frame standing in the grass with nothing either side of it. Its curtains are cloth and are their own. */
function windowParts(): Part[] {
  const parts: Part[] = [
    prop(box(PANE_W + 0.2, 0.12, 0.16, 0, PANE_H + 0.06, 0), PAINT),
    prop(box(PANE_W + 0.3, 0.1, 0.24, 0, 0.55, 0), PAINT),
  ];
  for (const sx of [-1, 1]) parts.push(prop(box(0.12, PANE_H - 0.4, 0.16, sx * (PANE_W / 2 + 0.06), (PANE_H + 0.55) / 2, 0), PAINT));
  parts.push(prop(box(0.07, PANE_H - 0.6, 0.1, 0, (PANE_H + 0.55) / 2, 0), PAINT));
  parts.push(prop(box(PANE_W - 0.1, 0.07, 0.1, 0, (PANE_H + 0.55) / 2, 0), PAINT));
  for (const sx of [-1, 1]) parts.push(prop(box(0.08, 0.08, 0.34, sx * (PANE_W / 2 + 0.16), RAIL_Y, 0.1), TIMBER));
  parts.push(prop(new THREE.CylinderGeometry(0.03, 0.03, PANE_W + 0.44, 6).rotateZ(Math.PI / 2).translate(0, RAIL_Y, 0.22), TIMBER));
  /** Two legs, because a window frame standing in a meadow needs a reason not to fall over, and has none. */
  for (const sx of [-1, 1]) parts.push(prop(box(0.1, 0.62, 0.12, sx * (PANE_W / 2 + 0.06), 0.24, 0), PAINT));
  return parts;
}

/** A kitchen chair, hung the wrong way up. */
function chairParts(): Part[] {
  const parts: Part[] = [prop(box(0.52, 0.06, 0.52, 0, 0.44, 0), TIMBER)];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(prop(box(0.05, 0.46, 0.05, sx * 0.21, 0.21, sz * 0.21), TIMBER));
  }
  for (const sx of [-1, 1]) parts.push(prop(box(0.05, 0.56, 0.05, sx * 0.21, 0.74, -0.21), TIMBER));
  parts.push(prop(box(0.47, 0.09, 0.05, 0, 0.98, -0.21), TIMBER));
  parts.push(prop(box(0.47, 0.07, 0.05, 0, 0.78, -0.21), TIMBER));
  return parts;
}

/** A small writing desk, likewise. */
function deskParts(): Part[] {
  const parts: Part[] = [prop(box(1.24, 0.07, 0.62, 0, 0.72, 0), TIMBER)];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(prop(box(0.07, 0.72, 0.07, sx * 0.54, 0.36, sz * 0.24), TIMBER));
  }
  parts.push(prop(box(1.1, 0.2, 0.44, 0, 0.56, -0.05), PAINT));
  return parts;
}

/** A ceiling lamp growing up out of the grass on its flex, bulb up, as if the ceiling had been the floor. */
function flexParts(): Part[] {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.12, 0.7, 0.06),
    new THREE.Vector3(-0.05, 1.5, -0.04),
    new THREE.Vector3(0.02, 2.2, 0.02),
  ]);
  return [
    prop(new THREE.TubeGeometry(curve, 16, 0.022, 5, false), TIMBER),
    prop(new THREE.CylinderGeometry(0.26, 0.15, 0.3, 12, 1, true).translate(0.02, 2.36, 0.02), SHADE),
    prop(new THREE.SphereGeometry(0.07, 8, 6).translate(0.02, 2.44, 0.02), SHADE),
  ];
}

/** A flat piece of what used to be a floor, laid on the ground and given out at its edges. */
function floorPiece(
  cx: number,
  cz: number,
  along: THREE.Vector2,
  length: number,
  width: number,
  lift: number,
  colour: THREE.Color,
  segments: number,
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, length, Math.max(2, Math.round(width * 2)), segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const side = new THREE.Vector2(-along.y, along.x);
  const edge = new Float32Array(pos.count * 2);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const x = cx + side.x * lx + along.x * lz;
    const z = cz + side.y * lx + along.y * lz;
    pos.setXYZ(i, x, heightAt(x, z) + lift, z);
    edge[i * 2] = Math.min(1, (width / 2 - Math.abs(lx)) / (width * 0.3));
    edge[i * 2 + 1] = Math.min(1, (length / 2 - Math.abs(lz)) / (length * 0.22));
    col.set([colour.r, colour.g, colour.b], i * 3);
  }
  geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  return geo;
}

interface Down {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
}

/**
 * The sleeping island: a bed made up in the grass in a hollow, a ground fog pooled round it, and fragments of a
 * bedroom standing in the frost with nothing joining them to anything. The player's gusts carve lanes of clear
 * air that close again slowly, frost comes in across the grass toward the bed as the night goes on, and a
 * bedside lamp is the one warm thing in it.
 *
 * Everything the story drives is a number between 0 and 1 (`fog`, `frost`, `dawn`, `curtains`, `blanket`),
 * eased in here so a chapter setting one of them never pops. See `docs/contracts/world.md`.
 */
export class SleepingIsland {
  readonly objects: THREE.Object3D[] = [];

  /** How thickly the night's fog pools in the hollow, 0 none to 1. */
  fog = 1;
  /** How far the frost has crept in from the rim toward the bed, and how hard, 0 to 1. */
  frost = 0;
  /** The morning on the hill: 0 night, 1 the sun all the way down it to the bed. */
  dawn = 0;
  /** The curtains: 0 drawn, 1 thrown open. */
  curtains = 0;
  /** The blanket: 0 tucked in, 1 thrown back. */
  blanket = 0;
  /** How far the child lifts the fold while drawing it up, in world units. */
  blanketPull = 0;
  private readonly pull = { value: 0 };
  /** Wind brushed over the visible bed, independent of ground picking. */
  bedWind = 0;
  /** Somebody asleep under the blanket, 0 an empty bed to 1: the cloth stands over them and breathes with them. */
  sleeper = 0;
  /**
   * How high the fog's top surface lies, in world units. It starts where the hollow can still be seen into and
   * the story raises it as the night thickens, so a bird climbing the hill walks up into it and the lanes the
   * player carves are what it walks through. The hilltop stands out of it however high it is: the pool thins
   * with distance from the hollow long before the summit.
   */
  fogTop = tuning.sleeping.fogTop;

  get curtainOpening(): number { return this.shown.curtains; }

  private shown = { fog: 1, frost: 0, dawn: 0, curtains: 0, blanket: 0, sleeper: 0, top: tuning.sleeping.fogTop };
  private curtainRate = 0;
  /** The failing bedside refuge and a brief hint of trapped light before the rescue. */
  cold = 0;
  hint = 0;
  private shownCold = 0;
  private readonly hintUniform = { value: 0 };
  private readonly clockHand: THREE.Mesh;
  private clockTime = 0;
  private readonly clockBody = new THREE.Group();
  private alarmAge = -1;
  readonly hearth = new SleepingHearth();
  readonly trail = new SleepingTrail();
  readonly sleepFace = PILLOW.clone();
  sleepMarks = 0;
  private readonly weather = new SleepingWeather();
  /** What a gust over the bed has lifted the blanket by, on top of whatever the story has asked for. */
  private puff = 0;
  private readonly gpu: GpuRunner;
  private readonly carveField = new PingPong(CARVE_RES, CARVE_RES, THREE.HalfFloatType, THREE.LinearFilter);
  private readonly carveMat: THREE.ShaderMaterial;
  private readonly stamps: THREE.Vector4[] = [];
  private readonly stampArgs: THREE.Vector2[] = [];
  private pending = 0;
  private readonly chair: THREE.Mesh;
  private readonly desk: THREE.Mesh;
  private readonly flex: THREE.Mesh;
  private readonly shaft: THREE.Mesh;
  private readonly fold = new THREE.Vector3();
  private readonly open = new THREE.Vector3();
  /** What the blanket stands over: how much of a child there is under it, where they lie, and their breathing. */
  private readonly under = new THREE.Vector3(0, 1.15, 0);
  private readonly shaftUniform = { value: 0 };
  private readonly shaftReach = { value: 0 };
  private readonly down: Down[] = [];
  private readonly downAttr: THREE.InstancedBufferAttribute;
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly at = new THREE.Vector3();
  private readonly last = new THREE.Vector2(1e9, 0);
  private readonly rand = mulberry32(5501);
  private here = false;
  private nearness = 0;
  /**
   * The one long white feather the pillow gives up, which is the whole of this room's control: the story releases
   * it, gives it somewhere to lean, and the bird follows it. It lives here because it comes out of the pillow.
   */
  readonly feather: Feather;
  readonly ribbon = new CurtainRibbon(CURTAIN_KNOT, CURTAIN_END);

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly wind: WindField,
    private readonly input: PointerInput,
  ) {
    this.gpu = new GpuRunner(renderer);
    this.feather = new Feather(wind);
    this.objects.push(this.ribbon.mesh, ...this.trail.objects, this.hearth.group);
    for (let i = 0; i < STAMPS; i++) {
      this.stamps.push(new THREE.Vector4());
      this.stampArgs.push(new THREE.Vector2());
    }
    this.carveMat = simMaterial(CARVE_FRAG, {
      uSrc: { value: null },
      uDt: { value: 1 / 60 },
      uHeal: { value: 1 / tuning.sleeping.carveCloses },
      uField: { value: new THREE.Vector4(CARVE_MIN.x, CARVE_MIN.y, 1 / CARVE_SPAN, 1 / CARVE_SPAN) },
      uStamp: { value: this.stamps },
      uStampArg: { value: this.stampArgs },
      uStamps: { value: 0 },
      uLane: atmo.uniforms.uLane,
      uLaneOpen: atmo.uniforms.uLaneOpen,
    });
    const fill = simMaterial(FILL_FRAG, {});
    this.gpu.run(fill, this.carveField.read);
    this.gpu.run(fill, this.carveField.write);
    atmo.uniforms.uCarveTex.value = this.carveField.texture;
    atmo.uniforms.uCarveDomain.value.set(CARVE_MIN.x, CARVE_MIN.y, 1 / CARVE_SPAN, 1 / CARVE_SPAN);
    atmo.uniforms.uHollow.value.set(SLEEP_HOLLOW.x, SLEEP_HOLLOW.z, tuning.sleeping.fogReach, 0);
    atmo.uniforms.uHollowTop.value.set(tuning.sleeping.fogTop, tuning.sleeping.fogSoft);

    const propMat = new THREE.ShaderMaterial({
      vertexShader: PROP_VERT,
      fragmentShader: PROP_FRAG,
      uniforms: { ...atmo.uniforms },
    });
    const stand = (parts: Part[], x: number, z: number, y: number, yaw: number): Part[] =>
      parts.map(([g, c, glow]) => prop(g.rotateY(yaw).translate(x, y, z), c, glow));
    const still = new THREE.Mesh(
      buildProps([
        ...stand(bedParts(), BED.x, BED.z, BED_GROUND, Math.atan2(-BED_FACING.x, -BED_FACING.y)),
        ...stand([
          prop(cushion(0.29,0.12,0.5,-0.22,0.09,0), BLANKET_RED),
          prop(cushion(0.29,0.12,0.5,0.22,0.09,0.06), BLANKET_RED),
          prop(box(0.62,0.045,0.44,0.65,0.065,0.7), BLANKET_RED),
          prop(box(0.57,0.055,0.40,0.65,0.105,0.7), LINEN),
        ], BED.x+BESIDE_BED.x*1.45, BED.z+BESIDE_BED.y*1.45, BED_GROUND, -0.36),
        ...stand(lampParts(), LAMP.x, LAMP.z, LAMP_GROUND, 0.4),
        ...stand(windowParts(), WINDOW.x, WINDOW.z, WINDOW_GROUND, Math.atan2(-WINDOW_INTO.x, -WINDOW_INTO.z)),
      ]),
      propMat,
    );
    still.frustumCulled = false;
    this.objects.push(still);

    // A little alarm clock belongs to the room. Its second hand stalls as the refuge goes cold.
    const clock = new THREE.Group();
    clock.position.copy(PILLOW).addScaledVector(new THREE.Vector3(BESIDE_BED.x,0,BESIDE_BED.y),2.2)
      .addScaledVector(new THREE.Vector3(BED_FACING.x,0,BED_FACING.y),.6);
    clock.position.y=heightAt(clock.position.x,clock.position.z);
    clock.rotation.y=0.75;
    const tableParts:Part[]=[prop(box(.7,.08,.55,0,.65,0),BOARD)];
    const clockParts: Part[]=[prop(new THREE.CylinderGeometry(.27,.27,.15,32).rotateX(Math.PI/2).translate(0,1.01,0),BRASS),
      prop(new THREE.CircleGeometry(.235,32).translate(0,1.01,.081),LINEN)];
    for(const side of [-1,1]){
      for(const depth of [-.17,.17]) tableParts.push(prop(box(.045,.65,.045,side*.25,.325,depth),TIMBER));
      clockParts.push(prop(new THREE.SphereGeometry(.10,12,8).scale(1,.65,.8).translate(side*.2,1.25,0),BRASS));
      clockParts.push(prop(box(.045,.14,.06,side*.16,.75,0),BRASS));
    }
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      clockParts.push(prop(new THREE.BoxGeometry(.016,.045,.008).rotateZ(-a).translate(Math.sin(a)*.195,1.01+Math.cos(a)*.195,.088),TIMBER));
    }
    clockParts.push(prop(new THREE.BoxGeometry(.022,.13,.012).translate(0,.05,0).rotateZ(.6).translate(0,1.01,.10),TIMBER));
    clock.add(new THREE.Mesh(buildProps(tableParts),propMat));
    this.clockBody.position.y=.69;
    this.clockBody.add(new THREE.Mesh(buildProps(clockParts).translate(0,-.69,0),propMat));
    clock.add(this.clockBody);
    this.clockHand=new THREE.Mesh(buildProps([prop(box(.012,.20,.012,0,.08,0),BLANKET_RED)]),propMat);
    this.clockHand.position.set(0,1.01-.69,.12);this.clockBody.add(this.clockHand);
    this.objects.push(clock);

    const piece = (parts: Part[], x: number, z: number, y: number, yaw: number, upsideDown: boolean): THREE.Mesh => {
      const geo = buildProps(parts);
      if (upsideDown) geo.rotateX(Math.PI);
      geo.rotateY(yaw);
      const mesh = new THREE.Mesh(geo, propMat);
      mesh.position.set(x, y, z);
      mesh.frustumCulled = false;
      this.objects.push(mesh);
      return mesh;
    };
    this.chair = piece(chairParts(), CHAIR_AT.x, CHAIR_AT.y, heightAt(CHAIR_AT.x,CHAIR_AT.y)-.04, -0.5, false);
    this.desk = piece(deskParts(), DESK_AT.x, DESK_AT.y, heightAt(DESK_AT.x,DESK_AT.y)-.06, .35, false);
    this.flex = piece(flexParts(), FLEX_AT.x, FLEX_AT.y, heightAt(FLEX_AT.x, FLEX_AT.y), 1.1, false);

    const rug = new THREE.Mesh(
      mergeGeometries([
        ...[-1.9, -1.2, -0.5, 0.2, 0.9, 1.6].map((offset) =>
          floorPiece(BED.x + BESIDE_BED.x * offset, BED.z + BESIDE_BED.y * offset, BED_FACING, 5.0, 0.64, 0.02, BOARD, 14),
        ),
        floorPiece(BED.x, BED.z, BED_FACING, 3.6, 2.6, 0.05, RUG_RED, 12),
      ]),
      new THREE.ShaderMaterial({
        vertexShader: FLOOR_VERT,
        fragmentShader: FLOOR_FRAG,
        uniforms: { ...atmo.uniforms },
        side: THREE.DoubleSide,
        alphaToCoverage: true,
      }),
    );
    rug.frustumCulled = false;
    this.objects.push(rug);

    const blanket = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 28, 36),
      new THREE.ShaderMaterial({
        vertexShader: BLANKET_VERT,
        fragmentShader: CLOTH_FRAG,
        uniforms: {
          ...atmo.uniforms,
          uCloth: { value: BLANKET_RED },
          uBed: { value: new THREE.Vector4(BED.x - BED_FACING.x * 0.25, BED.z - BED_FACING.y * 0.25, 2.85, BED_WIDTH * 0.56) },
          uBedAxis: { value: new THREE.Vector2(-BED_FACING.x, -BED_FACING.y) },
          uFold: { value: this.fold },
          uPull: this.pull,
          uSleeper: { value: this.under },
        },
        side: THREE.DoubleSide,
      }),
    );
    blanket.frustumCulled = false;
    this.objects.push(blanket);

    const morning = new THREE.Mesh(
      new THREE.PlaneGeometry(PANE_W - 0.06, PANE_H - 0.6),
      new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERT,
        fragmentShader: MORNING_FRAG,
        uniforms: { ...atmo.uniforms, uOpen: { value: this.open } },
        side: THREE.DoubleSide,
      }),
    );
    const into = new THREE.Vector3(WINDOW_INTO.x, 0, WINDOW_INTO.z).normalize();
    morning.position.set(WINDOW.x, WINDOW_GROUND + (PANE_H + 0.55) / 2, WINDOW.z).addScaledVector(into, -0.12);
    morning.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), into);
    morning.frustumCulled = false;
    this.objects.push(morning);

    // A single thin ribbon of light connects the captive morning to the child's pillow.
    const hintEnd=PILLOW.clone().add(new THREE.Vector3(0,0.4,0));
    const hintLength=hintEnd.distanceTo(WINDOW);
    const hintGeometry=new THREE.PlaneGeometry(1,hintLength,12,1).rotateX(Math.PI/2).translate(0,0,hintLength/2);
    const rayPoints=hintGeometry.attributes.position;
    for(let i=0;i<rayPoints.count;i++) rayPoints.setX(i,rayPoints.getX(i)*(.035+rayPoints.getZ(i)/hintLength*1.8));
    const hintRay=new THREE.Mesh(hintGeometry,
      new THREE.ShaderMaterial({uniforms:{uHint:this.hintUniform},vertexShader:SHAFT_VERT,
        fragmentShader:`uniform float uHint;in vec2 vUv;void main(){float edge=exp(-pow((vUv.x-.5)*5.5,2.0))*(1.0-smoothstep(.35,.5,abs(vUv.x-.5)));
          gl_FragColor=vec4(vec3(1.0,.76,.44),uHint*edge*.12*(1.0-vUv.y*.45));}`,
        transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    hintRay.position.copy(WINDOW);
    hintRay.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),hintEnd.sub(WINDOW).normalize());
    hintRay.frustumCulled=false;this.objects.push(hintRay);

    const pane = new THREE.PlaneGeometry(1, 1, 9, 9);
    const panes = mergeGeometries([pane.clone(), pane.clone()]);
    const sides = new Float32Array(panes.attributes.position.count);
    sides.fill(-1, 0, sides.length / 2);
    sides.fill(1, sides.length / 2);
    panes.setAttribute('aSide', new THREE.BufferAttribute(sides, 1));
    const curtains = new THREE.Mesh(
      panes,
      new THREE.ShaderMaterial({
        vertexShader: CURTAIN_VERT,
        fragmentShader: CLOTH_FRAG,
        uniforms: {
          ...atmo.uniforms,
          uCloth: { value: LINEN },
          uHang: { value: new THREE.Vector3(WINDOW_INTO.x, 0, WINDOW_INTO.z).normalize() },
          uPane: { value: new THREE.Vector4(PANE_W / 2 - 0.02, WINDOW.x, WINDOW_GROUND + RAIL_Y - 0.06, WINDOW.z) },
          uOpen: { value: this.open },
        },
        side: THREE.DoubleSide,
      }),
    );
    curtains.frustumCulled = false;
    this.objects.push(curtains);

    // Soft intersecting slices fill the volume from the window down to the pillow.
    const beamLength = WINDOW.distanceTo(PILLOW) + 2;
    const beamSlices = Array.from({length: 6}, (_, i) => {
      const geo = new THREE.PlaneGeometry(2, beamLength, 1, 24);
      const position = geo.attributes.position, uv = geo.attributes.uv;
      for (let j=0;j<position.count;j++) {
        const along = uv.getY(j);
        position.setXYZ(j, position.getX(j)*(.65+along*3.3), 0, along*beamLength);
      }
      return geo.rotateZ(i*Math.PI/6);
    });
    this.shaft = new THREE.Mesh(
      mergeGeometries(beamSlices),
      new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        uniforms: { uThrough: this.shaftUniform, uReach: this.shaftReach },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.shaft.position.copy(WINDOW);
    this.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), WINDOW_INTO);
    this.shaft.renderOrder = 3;
    this.shaft.frustumCulled = false;
    this.objects.push(this.shaft);

    const quad = new THREE.PlaneGeometry(2, 2);
    const downGeo = new THREE.InstancedBufferGeometry();
    downGeo.index = quad.index;
    downGeo.setAttribute('position', quad.attributes.position);
    this.downAttr = new THREE.InstancedBufferAttribute(new Float32Array(DOWN * 4), 4).setUsage(THREE.DynamicDrawUsage);
    downGeo.setAttribute('aDown', this.downAttr);
    downGeo.instanceCount = DOWN;
    downGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    for (let i = 0; i < DOWN; i++) this.down.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 1, life: 1 });
    const feathers = new THREE.Mesh(
      downGeo,
      new THREE.ShaderMaterial({
        vertexShader: DOWN_VERT,
        fragmentShader: DOWN_FRAG,
        uniforms: { ...atmo.uniforms },
        transparent: true,
        depthWrite: false,
      }),
    );
    feathers.renderOrder = 3;
    feathers.frustumCulled = false;
    this.objects.push(feathers);

    /** The story's one long white feather, beside the down it comes out of the pillow with. */
    this.objects.push(...this.feather.objects, ...this.weather.objects);

    for (const o of this.objects) o.visible = false;
  }

  /**
   * Blows a lane of clear air through the fog along a gust. The room calls this itself from the player's stroke
   * every frame; the story calls it for anything else that goes through the fog hard enough to open it.
   */
  carve(x: number, z: number, dirX: number, dirZ: number, strength: number): void {
    const len = Math.hypot(dirX, dirZ);
    const run = len > 1e-4 ? (tuning.sleeping.carveWidth * 1.6 * dirX) / len : 0;
    const runZ = len > 1e-4 ? (tuning.sleeping.carveWidth * 1.6 * dirZ) / len : 0;
    this.stamp(x, z, x + run, z + runZ, strength);
  }

  /**
   * The lane the morning comes down: fog and frost are both cleared along it, and `laneOpen` is how far down it
   * that has got, so the light travels down the hill rather than arriving all at once.
   */
  lane(from: THREE.Vector2, to: THREE.Vector2, halfWidth: number): void {
    atmo.uniforms.uLane.value.set(from.x, from.y, to.x, to.y);
    atmo.uniforms.uLaneOpen.value.x = halfWidth;
  }

  /** How far the lane has opened, 0 (and so no lane at all) to 1 the whole way down. */
  get laneOpen(): number {
    return atmo.uniforms.uLaneOpen.value.y;
  }
  set laneOpen(v: number) {
    atmo.uniforms.uLaneOpen.value.y = v;
  }

  /** A puff of down off the pillow: it hangs, and then it goes wherever the air is going. */
  pillowPuff(): void {
    const t = tuning.sleeping;
    let made = 0;
    for (const d of this.down) {
      if (made >= t.downCount) break;
      if (d.age < d.life) continue;
      made++;
      const a = this.rand() * Math.PI * 2;
      d.p.set(PILLOW.x + (this.rand() - 0.5) * 0.5, PILLOW.y + 0.08 + this.rand() * 0.12, PILLOW.z + (this.rand() - 0.5) * 0.4);
      d.v.set(Math.cos(a) * t.downThrow * (0.3 + this.rand()), 0.3 + this.rand() * 0.9, Math.sin(a) * t.downThrow * (0.3 + this.rand()));
      d.age = 0;
      d.life = t.downLife * (0.6 + this.rand() * 0.7);
    }
  }

  /** The height of the top of the fog at a point: above this, whatever is climbing the hill is out of it. */
  fogTopAt(x: number, z: number): number {
    const ground = heightAt(x, z);
    const pool = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - SLEEP_HOLLOW.x, z - SLEEP_HOLLOW.z) / tuning.sleeping.fogReach, 0.5, 1);
    const deep = pool * Math.min(1, this.shown.fog * (1 - 0.8 * this.shown.dawn) * 2);
    return deep <= 0.001 ? ground : THREE.MathUtils.lerp(ground, this.shown.top, deep);
  }

  /**
   * 1 over the island itself: nothing that belongs to a summer night belongs in it. It gives out well inside the
   * range the room is drawn at, because home is only a strait away and its fireflies are not the room's to put out.
   */
  get presence(): number {
    return this.here ? this.nearness : 0;
  }

  /** Where the child stands when they come to the bed: on the side away from the window. */
  get bedside(): THREE.Vector3 {
    return this.at.set(BED.x + BESIDE_BED.x * 2.4, BED_GROUND, BED.z + BESIDE_BED.y * 2.4);
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    const t = tuning.sleeping;
    const away = Math.hypot(camera.position.x - SLEEP_HOLLOW.x, camera.position.z - SLEEP_HOLLOW.z);
    const here = away < RANGE;
    this.nearness = 1 - THREE.MathUtils.smoothstep(away, PRESENCE_TO, PRESENCE_TO + 40);
    if (here !== this.here) {
      this.here = here;
      for (const o of this.objects) o.visible = here;
      this.feather.visible = here;
      /** Arriving shows the room as the story has set it, not an ease out of whatever it was left at. */
      if (here) this.shown = { fog: this.fog, frost: this.frost, dawn: this.dawn, curtains: this.curtains, blanket: this.blanket, sleeper: this.sleeper, top: this.fogTop };
    }
    if (!here) {
      atmo.uniforms.uHollow.value.w = 0;
      atmo.uniforms.uFrost.value.w = 0;
      atmo.uniforms.uLamp.value.w = 0;
      atmo.uniforms.uHearth.value.w = 0;
      atmo.uniforms.uDawn.value.x = 0;
      atmo.uniforms.uDawnSource.value.w = 0;
      atmo.uniforms.uSleepHint.value.w = 0;
      atmo.uniforms.uSleepMist.value.w = 0;
      return;
    }

    const k = 1 - Math.exp(-dt / t.ease);
    this.shown.fog += (this.fog - this.shown.fog) * k;
    this.shown.frost += (this.frost - this.shown.frost) * k;
    this.shown.dawn += (this.dawn - this.shown.dawn) * k;
    this.shown.blanket += (this.blanket - this.shown.blanket) * k;
    this.shown.sleeper += (this.sleeper - this.shown.sleeper) * k;
    this.shown.top += (this.fogTop - this.shown.top) * k;
    // A gust can billow tied cloth, but only the beak pulling the ribbon free releases it.
    if (!this.ribbon.released) this.curtains = 0;
    const was = this.shown.curtains;
    this.shown.curtains += (this.curtains - this.shown.curtains) * k;
    this.curtainRate += ((this.shown.curtains - was) / Math.max(dt, 1e-3) - this.curtainRate) * (1 - Math.exp(-dt * 4));

    const u = atmo.uniforms;
    u.uHollow.value.set(SLEEP_HOLLOW.x, SLEEP_HOLLOW.z, t.fogReach, this.shown.fog * (1 - 0.8 * this.shown.dawn) * t.fogThickness);
    u.uHollowTop.value.set(this.shown.top, t.fogSoft);
    u.uFrost.value.set(
      BED.x,
      BED.z,
      THREE.MathUtils.lerp(t.frostFrom, t.frostTo, this.shown.frost),
      Math.min(1, this.shown.frost * 2.2) * (1 - this.shown.dawn * 0.9),
    );
    this.shownCold += (this.cold - this.shownCold) * (1 - Math.exp(-dt * 0.6));
    const refuge = THREE.MathUtils.lerp(1, t.winterLamp, this.shownCold * (1 - this.shown.dawn));
    u.uLamp.value.set(LAMP.x, LAMP.y, LAMP.z, t.lamp * refuge * (1 - t.lampDawn * this.shown.dawn));
    /** The first sun stands on the hilltop and comes down the hill as the morning does. */
    u.uDawn.value.set(this.shown.dawn, THREE.MathUtils.lerp(HILLTOP.y + 1, BED_GROUND - 1, this.shown.dawn));
    u.uDawnSource.value.set(WINDOW.x, WINDOW.y, WINDOW.z, this.shown.curtains);
    u.uSleepHint.value.set(PILLOW.x, PILLOW.y + 0.4, PILLOW.z, this.hint);
    this.hintUniform.value = this.hint;

    this.player(dt);
    this.stepCarve(dt);
    this.cloth(dt, time);
    this.feather.update(dt, time);
    if (!this.input.muted) this.feather.brush(camera, this.input.prevNdc, this.input.ndc, this.input.gust, this.input.gustDir, this.input.charge, dt);
    this.ribbon.update(dt, time, this.shown.curtains);
    this.hearth.update(dt,time,this.shownCold,camera,this.wind);
    // A small silent alarm as the light reaches the sleeper. The feet alternate on the unmoving table.
    if(this.shown.dawn>.90 && this.alarmAge<0)this.alarmAge=0;
    if(this.alarmAge>=0)this.alarmAge=Math.min(t.alarmFor+1,this.alarmAge+dt);
    const alarm=this.alarmAge<0?0:THREE.MathUtils.smoothstep(this.alarmAge,0,.25)*(1-THREE.MathUtils.smoothstep(this.alarmAge,t.alarmFor-.9,t.alarmFor));
    this.clockBody.rotation.z=Math.sin(Math.max(0,this.alarmAge)*31)*t.alarmRock*alarm;
    this.clockBody.position.y=.69+Math.abs(Math.sin(this.clockBody.rotation.z))*.16;
    this.clockTime += dt * (1 - THREE.MathUtils.smoothstep(this.shownCold*(1-this.shown.dawn),0.3,0.65));
    this.clockHand.rotation.z=-Math.floor(this.clockTime)*Math.PI/30;
    this.trail.update(dt, time, this.shown.dawn, camera, this.shownCold);
    this.weather.update(time,this.shownCold,this.shown.sleeper,this.shown.dawn,this.sleepFace,camera,this.trail.mist,WINDOW,this.sleepMarks,this.trail.fogEnclosure);
    this.hanging(time);
    this.drift(dt);
  }

  /** The player's own stroke, taken where their cursor meets the ground, is the room's gust. */
  private player(dt: number): void {
    const { input } = this;
    if (!input.present || input.muted || input.gust < tuning.pointer.minGust) {
      this.last.set(1e9, 0);
      return;
    }
    const t = tuning.sleeping;
    const w = input.world;
    const hard = Math.min(1, input.gust / t.carveSpeed) * t.carveStrength * dt;
    if (this.last.x < 1e8) this.stamp(this.last.x, this.last.y, w.x, w.z, hard);
    else this.carve(w.x, w.z, input.gustDir.x, input.gustDir.y, hard);
    this.last.set(w.x, w.z);
  }

  private stamp(ax: number, az: number, bx: number, bz: number, strength: number): void {
    if (this.pending >= STAMPS || strength <= 0) return;
    this.stamps[this.pending].set(ax, az, bx, bz);
    this.stampArgs[this.pending].set(tuning.sleeping.carveWidth, strength);
    this.pending++;
  }

  private stepCarve(dt: number): void {
    const m = this.carveMat;
    m.uniforms.uSrc.value = this.carveField.texture;
    m.uniforms.uDt.value = dt;
    m.uniforms.uHeal.value = 1 / tuning.sleeping.carveCloses;
    m.uniforms.uStamps.value = this.pending;
    this.gpu.run(m, this.carveField.write);
    this.carveField.swap();
    atmo.uniforms.uCarveTex.value = this.carveField.texture;
    this.pending = 0;
  }

  /** The fold crease in the same coordinates as clothAt: the mittens follow the cloth, not a guessed pose. */
  blanketEdge(across: number, out: THREE.Vector3): THREE.Vector3 {
    const back = this.fold.x;
    const along = (back - 0.5) * 2.85;
    const width = BED_WIDTH * 0.56;
    out.set(BED.x - BED_FACING.x * (along + 0.25), BED.y, BED.z - BED_FACING.y * (along + 0.25));
    out.x += BED_FACING.y * across * width;
    out.z -= BED_FACING.x * across * width;
    const wide = Math.min(1, Math.abs(across) / tuning.sleeping.sleeperWide);
    const body = this.under.x * Math.sqrt(1 - wide * wide) * (0.65 + 0.35 * Math.sin(back * Math.PI))
      * (1 - THREE.MathUtils.smoothstep(back, this.under.y - 0.3, this.under.y + 0.25))
      * THREE.MathUtils.smoothstep(back, back - 0.08, back + 0.12);
    out.y = Math.max(BED_GROUND + 0.69, BED_GROUND + 0.655 + body * (1 + this.under.z) + this.pull.value);
    return out;
  }

  private cloth(dt: number, time: number): void {
    const t = tuning.sleeping;
    this.pull.value += (this.blanketPull - this.pull.value) * (1 - Math.exp(-dt * 8));
    const w = this.wind.sample(BED.x, BED.z, this.air);
    const speed = Math.hypot(w.x, w.z);
    const want = Math.min(1, (speed / t.blanketSpeed) * 0.7 + w.energy * 0.8 + this.bedWind) * t.blanketGust;
    this.puff += (want - this.puff) * (1 - Math.exp(-dt / (want > this.puff ? 0.25 : t.blanketSettles)));
    this.fold.set(this.shown.blanket * t.blanketLift, this.puff, 0.01 + Math.min(0.06, speed * 0.004 + w.energy * 0.03));
    /** They are plainly only asleep, and this is how you can tell: the blanket over them rises and falls. */
    this.under.set(this.shown.sleeper * t.sleeperHigh, 1.15, Math.sin(time * 0.75) * 0.06 * this.shown.sleeper);

    const c = this.wind.sample(WINDOW.x, WINDOW.z, this.air);
    this.open.set(
      this.shown.curtains,
      Math.min(0.5, Math.hypot(c.x, c.z) * 0.02 + c.energy * 0.25) * (0.4 + 0.6 * this.shown.curtains) + Math.sin(time * 1.3) * 0.05 + this.hint * 0.65,
      THREE.MathUtils.clamp(this.curtainRate, -1, 1),
    );
    this.shaftUniform.value = this.shown.curtains * (0.65 + 0.35 * this.shown.dawn);
    this.shaftReach.value = this.shown.dawn;
    this.shaft.visible = this.shaftUniform.value > 0.01;
  }

  /** What hangs from the fog sways in it, because everything in this game that the air can move does. */
  private hanging(time: number): void {
    // Furniture has weight. The crooked lamp alone bends in the wind.
    this.chair.rotation.z = -.035;
    this.desk.rotation.x = .025;
    this.wind.sample(FLEX_AT.x, FLEX_AT.y, this.air);
    const lean = Math.min(0.1, Math.hypot(this.air.x, this.air.z) * 0.004 + this.air.energy * 0.04);
    this.flex.rotation.z = this.air.x * 0.004 + Math.sin(time * 0.9) * lean * 0.5;
    this.flex.rotation.x = -this.air.z * 0.004;
  }

  /** The down: it hangs, it goes where the air goes, and it comes down again slowly. */
  private drift(dt: number): void {
    const data = this.downAttr.array as Float32Array;
    for (let i = 0; i < DOWN; i++) {
      const d = this.down[i];
      if (d.age >= d.life) {
        data[i * 4 + 3] = 0;
        continue;
      }
      d.age += dt;
      const w = this.wind.sample(d.p.x, d.p.z, this.air);
      d.v.x += (w.x - d.v.x) * Math.min(1, dt * 2.4);
      d.v.z += (w.z - d.v.z) * Math.min(1, dt * 2.4);
      d.v.y += (w.lift * 0.5 - 0.22 - d.v.y) * Math.min(1, dt * 1.6);
      d.p.addScaledVector(d.v, dt);
      const floor = heightAt(d.p.x, d.p.z) + 0.05;
      if (d.p.y < floor) {
        d.p.y = floor;
        d.v.y = 0;
        d.age = Math.max(d.age, d.life - 1.2);
      }
      data.set([d.p.x, d.p.y, d.p.z, Math.sin(Math.min(1, d.age / d.life) * Math.PI) * 0.9], i * 4);
    }
    this.downAttr.needsUpdate = true;
  }
}

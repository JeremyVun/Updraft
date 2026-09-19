import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
const BED_LENGTH = 2.8;
const BED_WIDTH = 1.5;

function groundAround(x: number, z: number, radius: number): number {
  let top = heightAt(x, z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    top = Math.max(top, heightAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius));
  }
  return top;
}

const BED_GROUND = groundAround(-176.5, -1911, 1.4);
/** The bed, made up in the grass in the middle of the hollow. Its head end points along `BED_FACING`. */
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
LAMP.y = LAMP_GROUND + 0.95;

/**
 * The window frame standing by itself beside the bed. `WINDOW_INTO` is the way the light comes through it: it
 * stands where the low morning sun (north-west; `lightAngles` in `world/palette.ts`) throws that light onto the
 * pillow, so throwing the curtains open puts the morning on the child's face.
 */
export const WINDOW_INTO = new THREE.Vector3(0.53, -0.18, 0.85).normalize();
export const WINDOW = new THREE.Vector3(PILLOW.x - WINDOW_INTO.x * 3.4, 0, PILLOW.z - WINDOW_INTO.z * 3.4);
const WINDOW_GROUND = groundAround(WINDOW.x, WINDOW.z, 0.9);
const PANE_W = 1.62;
const PANE_H = 2.0;
const RAIL_Y = PANE_H + 0.2;
const CURTAIN_DROP = RAIL_Y - 0.28;
WINDOW.y = WINDOW_GROUND + 1.35;

/** Where the ceiling lamp stands on its flex, and where the two upside-down pieces hang over the hollow. */
const FLEX_AT = new THREE.Vector2(BED.x + BESIDE_BED.x * 3.6 + BED_FACING.x * 1.6, BED.z + BESIDE_BED.y * 3.6 + BED_FACING.y * 1.6);
const CHAIR_AT = new THREE.Vector2(BED.x + BESIDE_BED.x * 2.0 - BED_FACING.x * 2.8, BED.z + BESIDE_BED.y * 2.0 - BED_FACING.y * 2.8);
const DESK_AT = new THREE.Vector2(BED.x - BESIDE_BED.x * 3.8 - BED_FACING.x * 1.2, BED.z - BESIDE_BED.y * 3.8 - BED_FACING.y * 1.2);

/** The carve field covers the island: gusts cut lanes in the fog anywhere on it, not only over the hollow. */
const CARVE_RES = 128;
const CARVE_SPAN = 116;
const CARVE_MIN = new THREE.Vector2(SLEEP_HOLLOW.x - CARVE_SPAN / 2, SLEEP_HOLLOW.z - CARVE_SPAN / 2 - 6);
/** The most gust segments stamped into it in one frame. */
const STAMPS = 6;

/** Beyond this the room is not in the world at all, and nothing it drives costs any other room anything. */
const RANGE = 300;

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
  return (1.0 - smoothstep(uLaneOpen.x * 0.45, uLaneOpen.x, d)) * smoothstep(uLaneOpen.y + 0.08, uLaneOpen.y - 0.08, t);
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

/**
 * The fog's top surface: a few sheets lying across the hollow at `uHollowTop`, drifting, thinned where the
 * player has carved and where the morning has come. The volume itself is in `fogOf`; these are the lid on it,
 * so the hill, and anything walking up it, can be seen to come out of the fog.
 */
const SHEET_VERT = /* glsl */ `
${ATMO_GLSL}
in float aLevel;
out vec3 vWorld;
out float vLevel;
void main() {
  vec3 w = position;
  vec2 drift = uCloudShift * ${glsl(tuning.sleeping.fogDrift)};
  w.y = uHollowTop.x + (aLevel - 2.0) * 0.55 + (fbm(w.xz * 0.07 + drift) - 0.5) * ${glsl(tuning.sleeping.fogSwell * 2)};
  vWorld = w;
  vLevel = aLevel;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const SHEET_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in float vLevel;
void main() {
  /** Every sheet lies out to its own warped edge, or four circles nested in the grass is what you see. */
  float reach = uHollow.z * (0.72 + 0.14 * vLevel) * (0.82 + 0.36 * fbm(vWorld.xz * 0.045 + vLevel * 3.1));
  float pool = 1.0 - smoothstep(0.3, 1.0, length(vWorld.xz - uHollow.xy) / reach);
  if (pool <= 0.001 || uHollow.w <= 0.0) discard;
  vec2 drift = uCloudShift * ${glsl(tuning.sleeping.fogDrift)};
  float n = fbm(vWorld.xz * 0.11 - drift * 1.6 + vLevel * 7.3);
  vec2 uv = (vWorld.xz - uCarveDomain.xy) * uCarveDomain.zw;
  float carve = insideUv(uv) ? texture(uCarveTex, uv).r : 1.0;
  float a = uHollow.w * pool * carve * smoothstep(0.3, 0.86, n) * (0.62 - vLevel * 0.1);
  if (a < 0.004) discard;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 col = uHollowTint * (uSkyAmbient * 1.4 + uSunColor * 0.55);
  col += lampLight(vWorld, up) * 0.5 + dawnLight(vWorld, up) * 0.8;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`;

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
  col = mix(col, vec3(1.0, 0.76, 0.42) * 2.4, vGlow);
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
  cloth = mix(cloth, vec3(0.8, 0.85, 0.9), frostAt(vWorld.xz) * max(N.y, 0.0) * 0.4);
  float through = max(-ndl, 0.0) * 0.5;
  vec3 col = cloth * (hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.5 + through * 0.6) * sun
                      + lampLight(vWorld, N) + dawnLight(vWorld, N));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const BLANKET_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uCloth;
uniform vec4 uBed;
uniform vec2 uBedAxis;
uniform vec3 uFold;
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
  float m = 1.0 - fold;
  float back = uvw.y <= m ? uvw.y : max(2.0 * m - uvw.y, 0.0);
  float over = uvw.y <= m ? 0.0 : sin(clamp((uvw.y - m) / max(fold, 1e-3), 0.0, 1.0) * 3.14159) * (0.1 + 0.26 * fold) + 0.05;
  float across = (uvw.x - 0.5) * 2.0;
  float drape = smoothstep(0.8, 1.0, abs(across));
  vec2 side = vec2(-uBedAxis.y, uBedAxis.x);
  vec2 xz = uBed.xy + uBedAxis * ((back - 0.5) * uBed.z) + side * (across * uBed.w);
  float lift = uFold.y * smoothstep(0.1, 0.9, back) * (0.35 + 0.5 * sin(back * 3.14159));
  float ripple = sin(uTime * 2.1 + back * 7.0 + across * 3.0) * uFold.z * (0.3 + 0.7 * back);
  float y = ${glsl(BED_GROUND)} + 0.655 + over - drape * 0.34 + lift + ripple;
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
  float inner = mix(0.0, uPane.x * ${glsl(tuning.sleeping.curtainOpen)}, open);
  float across = side * mix(inner, uPane.x, uvw.x);
  float folds = sin(uvw.x * 9.42) * (0.03 + ${glsl(tuning.sleeping.curtainGather)} * open) * (0.35 + 0.65 * uvw.y);
  float sway = (uOpen.y + uOpen.z * 0.4) * uvw.y * uvw.y;
  vec3 right = vec3(-uHang.z, 0.0, uHang.x);
  vec3 ahead = vec3(uHang.x, 0.0, uHang.z);
  vec3 p = uPane.yzw;
  p += right * (across + folds * side * 0.5) + ahead * (folds + sway);
  p.y -= uvw.y * ${glsl(CURTAIN_DROP)};
  return p;
}

void main() {
  vUv = uv;
  vec3 p = curtainAt(uv, aSide);
  vec3 a = curtainAt(uv + vec2(0.05, 0.0), aSide);
  vec3 b = curtainAt(uv + vec2(0.0, 0.05), aSide);
  vWorld = p;
  /** Both panels take the same normal: the mirrored one's winding is already answered by `gl_FrontFacing`. */
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
  vWorld = aDown.xyz + (right * position.x + up * position.y) * 0.11;
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

/** The morning coming through the open window and landing on the pillow. */
const SHAFT_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;

const SHAFT_FRAG = /* glsl */ `
uniform float uThrough;
in vec2 vUv;
void main() {
  float a = uThrough * (1.0 - smoothstep(0.1, 1.0, vUv.y)) * (1.0 - smoothstep(0.25, 1.0, abs(vUv.x - 0.5) * 2.0));
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.58) * 1.15, a * 0.38);
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
  parts.push(prop(box(W - 0.12, 0.2, L - 0.2, 0, 0.52, 0), LINEN));
  const pillow = box(0.86, 0.17, 0.52, 0, 0.71, -(L / 2 - 0.45));
  pillow.rotateX(-0.07);
  parts.push(prop(pillow, LINEN));
  return parts;
}

/** A lamp standing on the grass where a bedside table would be, if there were one. */
function lampParts(): Part[] {
  return [
    prop(new THREE.CylinderGeometry(0.15, 0.19, 0.05, 10).translate(0, 0.025, 0), BRASS),
    prop(new THREE.CylinderGeometry(0.03, 0.035, 0.68, 8).translate(0, 0.36, 0), BRASS),
    prop(new THREE.CylinderGeometry(0.17, 0.25, 0.28, 12, 1, true).translate(0, 0.85, 0), SHADE, 0.5),
    prop(new THREE.SphereGeometry(0.075, 8, 6).translate(0, 0.79, 0), SHADE, 1),
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

  private shown = { fog: 1, frost: 0, dawn: 0, curtains: 0, blanket: 0 };
  private curtainRate = 0;
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
  private readonly shaftUniform = { value: 0 };
  private readonly down: Down[] = [];
  private readonly downAttr: THREE.InstancedBufferAttribute;
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly at = new THREE.Vector3();
  private readonly last = new THREE.Vector2(1e9, 0);
  private readonly rand = mulberry32(5501);
  private here = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly wind: WindField,
    private readonly input: PointerInput,
  ) {
    this.gpu = new GpuRunner(renderer);
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
        ...stand(lampParts(), LAMP.x, LAMP.z, LAMP_GROUND, 0.4),
        ...stand(windowParts(), WINDOW.x, WINDOW.z, WINDOW_GROUND, Math.atan2(-WINDOW_INTO.x, -WINDOW_INTO.z)),
      ]),
      propMat,
    );
    still.frustumCulled = false;
    this.objects.push(still);

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
    const top = tuning.sleeping.fogTop;
    this.chair = piece(chairParts(), CHAIR_AT.x, CHAIR_AT.y, top + 1.6, 0.7, true);
    this.desk = piece(deskParts(), DESK_AT.x, DESK_AT.y, top + 2.3, -0.5, true);
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
      new THREE.PlaneGeometry(1, 1, 14, 20),
      new THREE.ShaderMaterial({
        vertexShader: BLANKET_VERT,
        fragmentShader: CLOTH_FRAG,
        uniforms: {
          ...atmo.uniforms,
          uCloth: { value: BLANKET_RED },
          uBed: { value: new THREE.Vector4(BED.x - BED_FACING.x * 0.25, BED.z - BED_FACING.y * 0.25, 1.8, BED_WIDTH * 0.56) },
          uBedAxis: { value: new THREE.Vector2(-BED_FACING.x, -BED_FACING.y) },
          uFold: { value: this.fold },
        },
        side: THREE.DoubleSide,
      }),
    );
    blanket.frustumCulled = false;
    this.objects.push(blanket);

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

    this.shaft = new THREE.Mesh(
      mergeGeometries([
        new THREE.PlaneGeometry(1.5, 4.6).rotateX(Math.PI / 2).translate(0, 0, 2.3),
        new THREE.PlaneGeometry(1.5, 4.6).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0, 2.3),
      ]),
      new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        uniforms: { uThrough: this.shaftUniform },
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

    const sheets = new THREE.Mesh(
      mergeGeometries(
        Array.from({ length: 4 }, (_, i) => {
          const g = new THREE.PlaneGeometry(tuning.sleeping.fogReach * 2.2, tuning.sleeping.fogReach * 2.2, 26, 26);
          g.rotateX(-Math.PI / 2);
          g.translate(SLEEP_HOLLOW.x, 0, SLEEP_HOLLOW.z);
          g.deleteAttribute('normal');
          g.deleteAttribute('uv');
          g.setAttribute('aLevel', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(i), 1));
          return g;
        }),
      ),
      new THREE.ShaderMaterial({
        vertexShader: SHEET_VERT,
        fragmentShader: SHEET_FRAG,
        uniforms: { ...atmo.uniforms },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    sheets.renderOrder = 2;
    sheets.frustumCulled = false;
    this.objects.push(sheets);

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

    /** The story's one long white feather belongs here, beside the down it comes out of the pillow with. */

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
    return deep <= 0.001 ? ground : THREE.MathUtils.lerp(ground, tuning.sleeping.fogTop, deep);
  }

  /** 1 while the room is in the world at all: nothing that belongs to a summer night belongs in it. */
  get presence(): number {
    return this.here ? 1 : 0;
  }

  /** Where the child stands when they come to the bed: on the side away from the window. */
  get bedside(): THREE.Vector3 {
    return this.at.set(BED.x + BESIDE_BED.x * 2.4, BED_GROUND, BED.z + BESIDE_BED.y * 2.4);
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    const t = tuning.sleeping;
    const here = Math.hypot(camera.position.x - SLEEP_HOLLOW.x, camera.position.z - SLEEP_HOLLOW.z) < RANGE;
    if (here !== this.here) {
      this.here = here;
      for (const o of this.objects) o.visible = here;
      /** Arriving shows the room as the story has set it, not an ease out of whatever it was left at. */
      if (here) this.shown = { fog: this.fog, frost: this.frost, dawn: this.dawn, curtains: this.curtains, blanket: this.blanket };
    }
    if (!here) {
      atmo.uniforms.uHollow.value.w = 0;
      atmo.uniforms.uFrost.value.w = 0;
      atmo.uniforms.uLamp.value.w = 0;
      atmo.uniforms.uDawn.value.x = 0;
      return;
    }

    const k = 1 - Math.exp(-dt / t.ease);
    this.shown.fog += (this.fog - this.shown.fog) * k;
    this.shown.frost += (this.frost - this.shown.frost) * k;
    this.shown.dawn += (this.dawn - this.shown.dawn) * k;
    this.shown.blanket += (this.blanket - this.shown.blanket) * k;
    const was = this.shown.curtains;
    this.shown.curtains += (this.curtains - this.shown.curtains) * k;
    this.curtainRate += ((this.shown.curtains - was) / Math.max(dt, 1e-3) - this.curtainRate) * (1 - Math.exp(-dt * 4));

    const u = atmo.uniforms;
    u.uHollow.value.set(SLEEP_HOLLOW.x, SLEEP_HOLLOW.z, t.fogReach, this.shown.fog * (1 - 0.8 * this.shown.dawn) * t.fogThickness);
    u.uHollowTop.value.set(t.fogTop, t.fogSoft);
    u.uFrost.value.set(
      BED.x,
      BED.z,
      THREE.MathUtils.lerp(t.frostFrom, t.frostTo, this.shown.frost),
      Math.min(1, this.shown.frost * 2.2) * (1 - this.shown.dawn * 0.9),
    );
    u.uLamp.value.set(LAMP.x, LAMP.y, LAMP.z, t.lamp * (1 - t.lampDawn * this.shown.dawn));
    /** The first sun stands on the hilltop and comes down the hill as the morning does. */
    u.uDawn.value.set(this.shown.dawn, THREE.MathUtils.lerp(HILLTOP.y + 1, BED_GROUND - 1, this.shown.dawn));

    this.player(dt);
    this.stepCarve(dt);
    this.cloth(dt, time);
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

  /** The blanket and the curtains, which are cloth and answer the air they are in. */
  private cloth(dt: number, time: number): void {
    const t = tuning.sleeping;
    const w = this.wind.sample(BED.x, BED.z, this.air);
    const speed = Math.hypot(w.x, w.z);
    const want = Math.min(1, (speed / t.blanketSpeed) * 0.7 + w.energy * 0.8) * t.blanketGust;
    this.puff += (want - this.puff) * (1 - Math.exp(-dt / (want > this.puff ? 0.25 : t.blanketSettles)));
    this.fold.set(this.shown.blanket * t.blanketLift, this.puff, 0.01 + Math.min(0.06, speed * 0.004 + w.energy * 0.03));

    const c = this.wind.sample(WINDOW.x, WINDOW.z, this.air);
    this.open.set(
      this.shown.curtains,
      Math.min(0.5, Math.hypot(c.x, c.z) * 0.02 + c.energy * 0.25) * (0.4 + 0.6 * this.shown.curtains) + Math.sin(time * 1.3) * 0.02,
      THREE.MathUtils.clamp(this.curtainRate, -1, 1),
    );
    this.shaftUniform.value = this.shown.curtains * this.shown.dawn;
    this.shaft.visible = this.shaftUniform.value > 0.01;
  }

  /** What hangs from the fog sways in it, because everything in this game that the air can move does. */
  private hanging(time: number): void {
    const swing = (mesh: THREE.Mesh, seed: number) => {
      this.wind.sample(mesh.position.x, mesh.position.z, this.air);
      const k = Math.min(0.14, Math.hypot(this.air.x, this.air.z) * 0.006 + this.air.energy * 0.05);
      mesh.rotation.z = Math.sin(time * 0.6 + seed) * (0.012 + k);
      mesh.rotation.x = Math.sin(time * 0.47 + seed * 1.7) * (0.01 + k * 0.8);
    };
    swing(this.chair, 0);
    swing(this.desk, 2.3);
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

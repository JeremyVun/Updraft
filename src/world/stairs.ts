import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import type { Deck } from './decks';
import { tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { flightPuffs, puffGeometry, puffMaterial, type Puff } from './stairs-puffs';
import { CloudWisps } from './stairs-wisps';
import {
  BELOW_CLOUD, CLOUD, FLIGHT_RISE, FLIGHT_RUN, FLIGHTS, LANE, LOOSE, LOOSE_START, SLIPPERS, STAIRS_ISLE, STEP, flight, landingOf, type Flight,
} from './stairs-layout';

/** What each part of the staircase is made of, read by the shader to decide its surface. */
const PAINT = 0, WOOD = 1, RUNNER = 2, FELT = 3, SOLE = 4;
const COLOURS: Record<number, THREE.Color> = {
  [PAINT]: new THREE.Color('#f0e1c8'),
  [WOOD]: new THREE.Color('#c88e55'),
  [RUNNER]: new THREE.Color('#c47a78'),
  [FELT]: new THREE.Color('#e7bf4a'),
  [SOLE]: new THREE.Color('#f3ead3'),
};

const VERT = /* glsl */ `
in float aPart;
in float aMist;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
out vec3 vColor;
out float vMist;
flat out float vPart;
void main() {
  vUv = uv;
  vColor = color;
  vPart = aPart;
  vMist = aMist;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * A staircase out of a child's dream: soft painted wood lit like the rest of the world, warm where the low sun
 * reaches it and lilac in its shade, and underneath, where nobody looks, it goes to mist.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
flat in float vPart;
in vec3 vColor;
in float vMist;
void main() {
  // The underside frays into drifting vapour rather than fading evenly.
  float fray = vnoise(vWorld.xz * 1.3 + vec2(vWorld.y * 1.1, uTime * 0.12)) * 0.65 + vnoise(vWorld.xy * 2.9 - uTime * 0.08) * 0.35;
  float gone = vMist + (fray - 0.5) * 0.7;
  float keep = nearFade(vWorld, 0.3, 1.1) * (1.0 - smoothstep(0.72, 1.0, gone));
  if (keep <= 0.0) discard;
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = vColor;
  int part = int(vPart + 0.5);
  float sheen = 0.0;
  if (part == ${WOOD}) {
    alb *= 0.9 + 0.14 * vnoise(vec2(vWorld.y * 9.0 + vWorld.x * 3.0, vWorld.z * 3.0));
    sheen = 0.18;
  } else if (part == ${RUNNER}) {
    alb *= 0.93 + 0.1 * vnoise(vWorld.xz * 34.0 + vWorld.y * 21.0);
  } else if (part == ${FELT}) {
    alb *= 0.92 + 0.12 * vnoise(vWorld.xz * 90.0 + vWorld.y * 70.0);
  } else {
    alb *= 0.96 + 0.06 * vnoise(vWorld.xz * 5.0 + vWorld.y * 3.0);
  }
  float sun = cloudShadow(vWorld.xz);
  float wrap = clamp(dot(N, uSunDir) * 0.62 + 0.38, 0.0, 1.0);
  vec3 H = halfVector(uSunDir, V);
  float gloss = sheen * pow(max(0.0, dot(N, H)), 14.0);
  float toward = max(0.0, dot(-V, uSunDir)) * 0.6 + 0.4;
  float rim = pow(1.0 - max(0.0, dot(N, V)), 3.0) * toward;
  vec3 col = alb * (hemiLight(N) * 1.05 + uSunColor * wrap * wrap * sun * 0.95) + uSunColor * (gloss + rim * 0.3) * sun;
  vec3 mist = uSkyAmbient * 0.85 + uSunColor * 0.1;
  col = mix(col, mist, smoothstep(0.1, 0.8, vMist) * 0.55);
  gl_FragColor = vec4(applyFog(col, vWorld), keep);
}`;

/** The pale drawing of a missing flight where it belongs: gold lines of light, as if the wind had sketched it. */
const GHOST_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uShow;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
flat in float vPart;
in vec3 vColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(N, V)), 2.2);
  float shimmer = 0.75 + 0.25 * sin(uTime * 1.7 + vWorld.y * 3.0 + vWorld.x * 2.0);
  float drift = vnoise(vWorld.xz * 1.3 + vec2(uTime * 0.2, vWorld.y));
  float a = (0.04 + rim * 0.6) * shimmer * (0.5 + 0.5 * drift) * uShow;
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.5), a * 0.32);
}`;

/** The top of the cloud as a surface: heaped up and lit gold on the sunward side, lilac in its folds. */
const TOP_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
out vec3 vWorld;
out float vRing;
BILLOW
void main() {
  vec2 xz = position.xz + uCentre;
  vRing = length(position.xz);
  vWorld = vec3(xz.x, uCloudDeckY.y + billow(xz), xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const TOP_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform float uReach;
in vec3 vWorld;
in float vRing;
BILLOW
void main() {
  if (vRing > uReach) discard;
  vec2 xz = vWorld.xz;
  if (uCloudBubble.w > 0.0) {
    float hole = length(xz - uCloudBubble.xz) - uCloudBubble.w * (0.75 + 0.35 * vnoise(xz * 0.8 + uTime * 0.1));
    if (hole < 0.0 && uCloudBubble.y < uCloudDeckY.y + 0.5) discard;
  }
  float e = 0.6;
  float h = billow(xz);
  vec3 N = normalize(vec3(h - billow(xz + vec2(e, 0.0)), e, h - billow(xz + vec2(0.0, e))));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunDir + vec3(0.0, 0.08, 0.0));
  float wrap = clamp(dot(N, L) * 0.6 + 0.4, 0.0, 1.0);
  float toward = pow(max(0.0, dot(-V, L)), 6.0);
  float rim = pow(1.0 - max(0.0, dot(N, V)), 3.0);
  float crest = smoothstep(0.0, 4.0, h);
  float fold = vnoise(xz * 0.21) * 0.5 + vnoise(xz * 0.63) * 0.25;
  vec3 shade = mix(vec3(0.60, 0.58, 0.78), vec3(0.78, 0.76, 0.88), crest) * (uSkyAmbient * 0.9 + vec3(0.12));
  vec3 sunlit = uSunColor * (0.95 + 0.4 * toward) * wrap;
  vec3 col = shade * (0.85 + 0.3 * fold) + sunlit * (0.7 + 0.3 * crest);
  col += uSunColor * rim * (0.25 + 1.4 * toward) * wrap;
  col *= 0.94 + 0.12 * vnoise(xz * 2.3);
  float cover = uCloudDeck.w;
  gl_FragColor = vec4(applyFog(col, vWorld), cover);
}`;

/** Round heaps of cloud: cellular domes in three sizes, low and gentle near the stair and the way the boat goes. */
const BILLOW_GLSL = /* glsl */ `
float domes(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float best = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash12(i + g), hash12(i + g + 17.3)) * 0.8 + 0.1;
    float r = 0.55 + 0.35 * hash12(i + g + 41.7);
    float d = length(g + o - f) / r;
    best = max(best, sqrt(max(0.0, 1.0 - d * d)) * r);
  }
  return best;
}
float billow(vec2 xz) {
  vec2 p = xz + uCloudShift * 0.6;
  float calm = smoothstep(uCalmAt.z * 0.35, uCalmAt.z, length(xz - uCalmAt.xy));
  float swell = domes(p * 0.09) * 1.1 + domes(p * 0.23 + 3.1) * 0.35;
  float heaps = domes(p * 0.028 + 9.7) * 7.5 + domes(p * 0.07 + 5.3) * 2.2;
  return mix(swell, swell + heaps, calm);
}`;

/**
 * The underside of the cloud seen from below: heavy bellies hanging out of it, lilac in their hollows and lit
 * gold on the flanks the low sun reaches under the edge of the deck. Flat and high round the stair, so it goes
 * up into the white through a level ceiling and there is room under it to work on the loose flights.
 */
const BELLY_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
out vec3 vWorld;
out float vRing;
BILLOW
void main() {
  vec2 xz = position.xz + uCentre;
  vRing = length(position.xz);
  vWorld = vec3(xz.x, uCloudDeckY.x + 0.6 - belly(xz), xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const BELLY_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform float uReach;
in vec3 vWorld;
in float vRing;
BILLOW
void main() {
  if (vRing > uReach) discard;
  vec2 xz = vWorld.xz;
  float e = 0.8;
  float h = belly(xz);
  // Hanging down, so the surface faces down and its normal is the slope of the bellies seen from below.
  vec3 N = normalize(vec3(belly(xz + vec2(e, 0.0)) - h, -e, belly(xz + vec2(0.0, e)) - h));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(vec3(uSunDir.x, max(uSunDir.y, 0.0) * 0.4 + 0.02, uSunDir.z));
  float wrap = clamp(dot(N, L) * 0.85 + 0.25, 0.0, 1.0);
  vec2 away = xz - cameraPosition.xz;
  float reach = length(away);
  float sunward = reach > 1.0 ? pow(max(0.0, dot(away / reach, normalize(uSunDir.xz + 1e-5))), 2.0) : 0.0;
  float rim = pow(1.0 - abs(dot(N, V)), 2.5);
  // The lowest parts of the bellies catch the sun coming in under the deck; the hollows between stay lilac.
  float low = smoothstep(0.5, 6.0, h);
  vec3 shade = mix(uSkyAmbient * 0.55 + uGroundBounce * 0.2, uSkyAmbient * 0.72 + uGroundBounce * 0.12, low);
  float far = smoothstep(15.0, 350.0, reach);
  vec3 sunlit = uSunColor * wrap * wrap * (0.25 + 0.9 * low + 1.1 * sunward * far);
  vec3 col = shade * (0.92 + 0.16 * vnoise(xz * 0.11)) + sunlit + uSunColor * rim * wrap * (0.15 + 0.7 * sunward) * low;
  float edge = 1.0 - smoothstep(0.55, 0.98, length(xz - uCloudDeck.xy) / uCloudDeck.z);
  gl_FragColor = vec4(applyFog(col, vWorld), uCloudDeck.w * edge);
}`;

/** Bellies of cloud hanging from the deck: big slow heaps with smaller ones on them, none near the stair. */
const BELLY_GLSL = /* glsl */ `
float belly(vec2 xz) {
  vec2 p = xz + uCloudShift * 0.6;
  float calm = smoothstep(uCalmAt.z * 0.45, uCalmAt.z, length(xz - uCalmAt.xy));
  float big = vnoise(p * 0.024 + 2.3);
  float heaps = big * big * 7.0 + vnoise(p * 0.07 + 7.1) * 2.2 + vnoise(p * 0.19 + 1.7) * 0.6;
  return heaps * (0.1 + 0.9 * calm);
}`;

/** Gathers blocks, rails and posts into one geometry with a colour, a material id and a mist amount on every vertex. */
class Build {
  private readonly parts: THREE.BufferGeometry[] = [];
  private readonly p = new THREE.Vector3();

  /** `mist` says, for a point in world space, how far it has gone to cloud: 0 solid, 1 gone. */
  add(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, part: number, colour = COLOURS[part], mist?: (p: THREE.Vector3) => number): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const pos = g.getAttribute('position');
    const n = pos.count;
    const c = new Float32Array(n * 3);
    const id = new Float32Array(n).fill(part);
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      c.set([colour.r, colour.g, colour.b], i * 3);
      if (mist) m[i] = THREE.MathUtils.clamp(mist(this.p.fromBufferAttribute(pos, i)), 0, 1);
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(id, 1));
    g.setAttribute('aMist', new THREE.BufferAttribute(m, 1));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aPart', 'aMist'].includes(name)) g.deleteAttribute(name);
    this.parts.push(g);
  }

  result(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts);
    this.parts.length = 0;
    return merged;
  }
}

const RAIL_HEIGHT = 0.82;
const PITCH = Math.atan2(STEP.rise, STEP.going);
/** How far under the line of its nosings a flight's blocks and strings go down. */
const BODY = 0.42;
const STRING = { thick: 0.12, above: 0.14, below: 0.5 } as const;

const block = (w: number, h: number, d: number, r = 0.045) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
/** A fat turned baluster one unit tall: a round foot, a belly and a collar under the rail. */
const BALUSTER = new THREE.LatheGeometry([
  [0.0, 0.0], [0.045, 0.0], [0.05, 0.03], [0.042, 0.07], [0.03, 0.12], [0.036, 0.3], [0.052, 0.48], [0.036, 0.66],
  [0.026, 0.8], [0.04, 0.86], [0.04, 0.94], [0.03, 1.0], [0.0, 1.0],
].map(([r, y]) => new THREE.Vector2(r, y)), 14);
const KNOB = new THREE.SphereGeometry(0.1, 18, 12);
const RAIL = new THREE.CylinderGeometry(0.045, 0.045, 1, 14, 1).rotateX(Math.PI / 2);

/** Local frame of a flight: +z up the flight from its bottom riser, +y up, x across with its own lane at 0 and its outer side +x. */
function flightFrame(f: Flight): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(f.bottom.x, f.bottom.y, f.bottom.z)
    .multiply(new THREE.Matrix4().makeRotationY(f.dir > 0 ? Math.PI : 0));
}

const at = (frame: THREE.Matrix4, x: number, y: number, z: number) => frame.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));

/** A newel post: a square post with a big round knob on it, standing at `floor` in the frame. */
function newel(b: Build, frame: THREE.Matrix4, x: number, s: number, floor: number, mist: (p: THREE.Vector3) => number): void {
  const top = floor + RAIL_HEIGHT + 0.1;
  const bottom = floor - 0.25;
  b.add(block(0.15, top - bottom, 0.15, 0.035), at(frame, x, (top + bottom) / 2, s), WOOD, undefined, mist);
  b.add(KNOB, at(frame, x, top + 0.07, s), WOOD, undefined, mist);
}

/** A rail from s0 to s1 in the frame at x, on a few fat balusters standing on `floor(s)`. */
function railing(b: Build, frame: THREE.Matrix4, x: number, s0: number, s1: number, floor: (s: number) => number,
  rail: (s: number) => number, balusters: number, mist: (p: THREE.Vector3) => number): void {
  for (let i = 0; i < balusters; i++) {
    const s = s0 + (i + 1) * (s1 - s0) / (balusters + 1);
    const y0 = floor(s);
    const m = at(frame, x, y0, s).multiply(new THREE.Matrix4().makeScale(1, rail(s) - y0, 1));
    b.add(BALUSTER, m, WOOD, undefined, mist);
  }
  const len = Math.hypot(s1 - s0, rail(s1) - rail(s0));
  const mid = (s0 + s1) / 2;
  const tilt = Math.atan2(rail(s1) - rail(s0), s1 - s0);
  b.add(RAIL, at(frame, x, rail(mid), mid).multiply(new THREE.Matrix4().makeRotationX(-tilt)).multiply(new THREE.Matrix4().makeScale(1, 1, len)), WOOD, undefined, mist);
}

/** One flight: a block for every step, the runner up them, a string each side and a rail up the outside. */
function buildFlight(b: Build, f: Flight): void {
  const F = flightFrame(f);
  const inv = F.clone().invert();
  const { rise, going, risers, width } = STEP;
  const local = new THREE.Vector3();
  const nosing = (s: number) => rise + s * (rise / going);
  // Anything well under the line of the nosings has gone to cloud.
  const mist = (p: THREE.Vector3) => {
    local.copy(p).applyMatrix4(inv);
    return (nosing(local.z) - local.y - 0.3) / 0.45;
  };
  for (let i = 1; i <= risers; i++) {
    const s0 = (i - 1) * going;
    const top = i * rise;
    const d = i < risers ? going + 0.03 : 0.12;
    const h = rise + 0.2;
    b.add(block(width, h, d, 0.05), at(F, 0, top - h / 2, s0 + d / 2 - 0.03), PAINT, undefined, mist);
    b.add(block(0.98, 0.022, d - 0.02, 0.01), at(F, 0, top + 0.009, s0 + d / 2 - 0.03), RUNNER, undefined, mist);
    b.add(block(0.98, rise - 0.01, 0.022, 0.01), at(F, 0, top - rise / 2 + 0.004, s0 - 0.04), RUNNER, undefined, mist);
  }
  const run = FLIGHT_RUN;
  const len = Math.hypot(run + going, FLIGHT_RISE) + 0.2;
  const mid = (run - going * 0.5) / 2;
  // A smooth soffit under the blocks, so from below it is one sloping board going to cloud.
  b.add(block(width + 0.02, 0.12, len - 0.1, 0.05), at(F, 0, nosing(mid) - BODY - 0.06, mid).multiply(new THREE.Matrix4().makeRotationX(-PITCH)), PAINT, undefined, mist);
  const centre = nosing(mid) + (STRING.above - STRING.below) / 2 - rise / 2;
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + STRING.thick / 2 - 0.01);
    b.add(block(STRING.thick, STRING.above + STRING.below, len, 0.05), at(F, x, centre, mid).multiply(new THREE.Matrix4().makeRotationX(-PITCH)), PAINT, undefined, mist);
  }
  const outer = width / 2 + STRING.thick / 2 - 0.01;
  const stringTop = (s: number) => nosing(s) + STRING.above - rise / 2 - 0.02;
  railing(b, F, outer, -0.05, run, stringTop, (s) => nosing(s) + RAIL_HEIGHT, 3, mist);
  newel(b, F, outer, -0.05, 0, mist);
}

/** The landing a flight arrives on, across both lanes, with a rail round its open sides. */
function buildLanding(b: Build, f: Flight): void {
  const L = landingOf(f.index);
  const y = L.y;
  const top = f.index === FLIGHTS;
  const mist = (p: THREE.Vector3) => (y - p.y - 0.05) / 0.5;
  const w = L.x1 - L.x0, d = L.z1 - L.z0;
  const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  const world = new THREE.Matrix4();
  b.add(block(w, 0.26, d, 0.06), at(world, cx, y - 0.13, cz), PAINT, undefined, mist);
  b.add(block(w - 0.5, 0.02, d - 0.5, 0.01), at(world, cx, y + 0.008, cz), RUNNER, undefined, mist);
  const flat = () => y;
  const rail = () => y + RAIL_HEIGHT + 0.04;
  const inset = 0.07;
  const north = f.dir > 0;
  // The far edge: across the whole landing.
  const farZ = north ? L.z0 + inset : L.z1 - inset;
  const nearZ = north ? L.z1 : L.z0;
  const across = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  railing(b, at(world, 0, 0, farZ).multiply(across), 0, -(L.x1 - inset), -(L.x0 + inset), flat, rail, top ? 5 : 3, mist);
  // The outer sides, from the stair's edge to the far corner; the top landing is open to the west.
  const sides = top ? [L.x1 - inset] : [L.x0 + inset, L.x1 - inset];
  for (const x of sides) railing(b, world, x, Math.min(nearZ, farZ), Math.max(nearZ, farZ), flat, rail, 2, mist);
  const corners = top ? [L.x1 - inset] : [L.x0 + inset, L.x1 - inset];
  for (const x of corners) {
    newel(b, world, x, farZ, y, mist);
    newel(b, world, x, nearZ, y, mist);
  }
  if (top) {
    // Over the drop where no flight goes on up.
    const x0 = LANE.east - STEP.width / 2, x1 = L.x1 - inset;
    railing(b, at(world, 0, 0, nearZ + (north ? -inset : inset)).multiply(across), 0, -x1, -x0, flat, rail, 2, mist);
    newel(b, world, x0, nearZ + (north ? -inset : inset), y, mist);
  }
}

/** How much cloud a flight rests on: none on the grass, more the higher it hangs, and in the white it is half cloud. */
function cloudUnder(index: number): number {
  return index === 1 ? 0 : index === 2 ? 0.55 : index <= BELOW_CLOUD ? 0.9 : 1.3;
}

function stairMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: atmo.uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
  });
}

/** A small felt slipper, toe pointing +z. */
function slipper(b: Build, frame: THREE.Matrix4): void {
  const felt = COLOURS[FELT];
  const cream = COLOURS[SOLE];
  b.add(new THREE.CylinderGeometry(1, 1, 1, 16), frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.014, 0)).multiply(new THREE.Matrix4().makeScale(0.056, 0.028, 0.11)), SOLE, cream.clone().multiplyScalar(0.8));
  b.add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.026, 0.035)).multiply(new THREE.Matrix4().makeScale(0.057, 0.06, 0.08)), FELT, felt);
  b.add(new THREE.TorusGeometry(0.05, 0.014, 6, 16), frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.036, -0.042)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(1, 1.35, 1)), SOLE, cream);
}

export interface LoosePiece {
  readonly flight: Flight;
  readonly group: THREE.Group;
  readonly ghost: THREE.Mesh;
  /** Where it has been pushed from its place: across (x), along (z), and turned (y). */
  readonly offset: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  docked: boolean;
  /** 0 while it floats; rises to 1 as a flight that has lined up draws into its place. */
  settling: number;
  readonly pivot: THREE.Vector3;
  /** How much the player's wind has worked on it, for sounds and for the story to notice. */
  worked: number;
  /** Seconds left of feeling for its place after the player last pushed it; it never finds its way on its own. */
  handled: number;
}

/**
 * The stairs in the clouds: a household staircase with no house, three of its flights hanging loose in the air
 * under the cloud until the player's wind brings them home, a pair of slippers on the top landing, and the top of
 * the cloud deck itself, which lies to the horizon under the sunset.
 */
export class CloudStairs {
  readonly group = new THREE.Group();
  readonly pieces: LoosePiece[] = [];
  readonly cloudTop: THREE.Mesh;
  readonly cloudBelly: THREE.Mesh;
  /** The cloud streaming past on the way up through the white. */
  readonly wisps = new CloudWisps();
  /** Called with a piece's flight number as it knocks home. */
  onDocked: (index: number) => void = () => {};
  /** 0 hides the ghost of the next missing flight; 1 draws it. */
  ghostShown = 0;
  private readonly ghostUniform = { value: 0 };
  private readonly topUniforms: { uCentre: { value: THREE.Vector2 }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number } };
  private readonly bellyUniforms: { uCentre: { value: THREE.Vector2 }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number } };
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private time = 0;

  constructor() {
    this.group.name = 'stairs-in-the-clouds';
    const material = stairMaterial();
    const puffs = puffMaterial();
    const fixed = new Build();
    const cloud: Puff[] = [];
    for (let i = 1; i <= FLIGHTS; i++) {
      if ((LOOSE as readonly number[]).includes(i)) continue;
      const f = flight(i);
      buildFlight(fixed, f);
      buildLanding(fixed, f);
      cloud.push(...flightPuffs(f, cloudUnder(i)));
    }
    const under = new THREE.Mesh(puffGeometry(cloud), puffs);
    under.name = 'stairs-cloud';
    under.frustumCulled = false;
    this.group.add(under);
    const s = new THREE.Matrix4().makeTranslation(SLIPPERS.x, SLIPPERS.y + 0.01, SLIPPERS.z);
    slipper(fixed, s.clone().multiply(new THREE.Matrix4().makeTranslation(0.02, 0, -0.07)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2 + 0.14)));
    slipper(fixed, s.clone().multiply(new THREE.Matrix4().makeTranslation(-0.03, 0, 0.08)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2 - 0.22)));
    const standing = new THREE.Mesh(fixed.result(), material);
    standing.name = 'stairs-standing';
    this.group.add(standing);

    const ghostMaterial = new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uShow: this.ghostUniform },
      vertexShader: VERT,
      fragmentShader: GHOST_FRAG,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    LOOSE.forEach((index, i) => {
      const f = flight(index);
      const b = new Build();
      buildFlight(b, f);
      buildLanding(b, f);
      const geo = b.result();
      const pivot = new THREE.Vector3().lerpVectors(f.bottom, f.landing, 0.55);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const group = new THREE.Group();
      group.name = `stairs-loose-${index}`;
      group.add(new THREE.Mesh(geo, material));
      const fluff = new THREE.Mesh(puffGeometry(flightPuffs(f, cloudUnder(index)), pivot), puffs);
      fluff.frustumCulled = false;
      group.add(fluff);
      const ghost = new THREE.Mesh(geo, ghostMaterial);
      ghost.position.copy(pivot);
      ghost.visible = false;
      ghost.renderOrder = 6;
      this.group.add(group, ghost);
      const start = LOOSE_START[i];
      this.pieces.push({ flight: f, group, ghost, offset: new THREE.Vector3(start.x, start.yaw, start.z),
        velocity: new THREE.Vector3(), docked: false, settling: 0, pivot, worked: 0, handled: 0 });
    });

    this.topUniforms = {
      uCentre: { value: new THREE.Vector2(STAIRS_ISLE.x, STAIRS_ISLE.z) },
      uCalmAt: { value: new THREE.Vector3(STAIRS_ISLE.x - 10, STAIRS_ISLE.z - 20, 95) },
      uReach: { value: 1500 },
    };
    const rings = 150, spokes = 160, reach = 1500;
    const pos: number[] = [];
    const index: number[] = [];
    for (let r = 0; r <= rings; r++) {
      const radius = reach * Math.pow(r / rings, 2.2);
      for (let a = 0; a < spokes; a++) {
        const t = (a / spokes) * Math.PI * 2;
        pos.push(Math.cos(t) * radius, 0, Math.sin(t) * radius);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let a = 0; a < spokes; a++) {
        const i0 = r * spokes + a, i1 = r * spokes + (a + 1) % spokes;
        const j0 = i0 + spokes, j1 = i1 + spokes;
        index.push(i0, j0, i1, i1, j0, j1);
      }
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    top.setIndex(index);
    const topMaterial = new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...this.topUniforms },
      vertexShader: TOP_VERT.replace('BILLOW', BILLOW_GLSL),
      fragmentShader: TOP_FRAG.replace('BILLOW', BILLOW_GLSL),
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    });
    this.cloudTop = new THREE.Mesh(top, topMaterial);
    this.cloudTop.name = 'cloud-deck-top';
    this.cloudTop.frustumCulled = false;
    this.cloudTop.renderOrder = -2;
    this.cloudTop.visible = false;
    this.group.add(this.cloudTop);

    this.bellyUniforms = {
      uCentre: { value: new THREE.Vector2(STAIRS_ISLE.x, STAIRS_ISLE.z) },
      uCalmAt: { value: new THREE.Vector3(LANE.east - 1, STAIRS_ISLE.z, 55) },
      uReach: { value: 1500 },
    };
    this.cloudBelly = new THREE.Mesh(top, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...this.bellyUniforms },
      vertexShader: BELLY_VERT.replace('BILLOW', BILLOW_GLSL + BELLY_GLSL),
      fragmentShader: BELLY_FRAG.replace('BILLOW', BILLOW_GLSL + BELLY_GLSL),
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    }));
    this.cloudBelly.name = 'cloud-deck-belly';
    this.cloudBelly.frustumCulled = false;
    this.cloudBelly.renderOrder = -2;
    this.cloudBelly.visible = false;
    this.group.add(this.cloudBelly);
    this.group.add(this.wisps.mesh);
    this.pose();
  }

  /** The next flight the stair is waiting for, or null once all of them are home. */
  get waiting(): LoosePiece | null {
    return this.pieces.find(p => !p.docked) ?? null;
  }

  get docked(): number {
    return this.pieces.filter(p => p.docked).length;
  }

  /** Puts the first `count` flights home, as a restored checkpoint finds them. */
  restore(count: number): void {
    this.pieces.forEach((p, i) => {
      p.docked = i < count;
      p.settling = p.docked ? 1 : 0;
      p.velocity.set(0, 0, 0);
      if (p.docked) p.offset.set(0, 0, 0);
      else p.offset.set(LOOSE_START[i].x, LOOSE_START[i].yaw, LOOSE_START[i].z);
    });
    this.pose();
  }

  /** A world point on a piece, where it is now: rotated about its pivot by the turn, moved by the push. */
  pointOn(piece: LoosePiece, home: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(home).sub(piece.pivot).applyAxisAngle(THREE.Object3D.DEFAULT_UP, piece.offset.y);
    return out.add(piece.pivot).add(this.tmp2.set(piece.offset.x, 0, piece.offset.z));
  }

  /** Where a screen point meets the level at height h, or null if its sightline never gets there near enough. */
  private onLevel(ndc: THREE.Vector2, h: number, camera: THREE.Camera, out: THREE.Vector3): THREE.Vector3 | null {
    out.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position);
    const t = (h - camera.position.y) / out.y;
    if (!Number.isFinite(t) || t <= 0) return null;
    out.multiplyScalar(t).add(camera.position);
    return out.distanceTo(camera.position) < 90 ? out : null;
  }

  /**
   * A loose flight goes where the wind over it goes, the way the sky mirror's bubbles do: a stroke across it sets
   * it moving with the stroke, read on the flight's own level so that on screen it stays under the hand, and it
   * coasts on when the stroke ends. It turns itself round as it nears its place; the player never has to.
   */
  brush(camera: THREE.PerspectiveCamera, input: PointerInput, dt: number): void {
    this.wisps.brush(camera, input, dt);
    if (!input.present || input.muted || dt <= 0) return;
    if (input.ndc.distanceTo(input.prevNdc) < 5e-4) return;
    const k = tuning.stairs;
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const next = this.waiting;
    for (const piece of this.pieces) {
      if (piece.docked || piece.settling > 0) continue;
      const f = piece.flight;
      let hit = 0;
      for (const along of [0.05, 0.35, 0.65, 0.95]) {
        this.tmp.lerpVectors(f.bottom, f.landing, along).y += 0.4;
        const p = this.pointOn(piece, this.tmp, this.tmp);
        const radius = THREE.MathUtils.clamp(k.grip / (p.distanceTo(camera.position) * halfHeight), 0.07, 0.3);
        hit = Math.max(hit, screenBrush(camera, p, input.prevNdc, input.ndc, radius));
      }
      if (hit <= 0) continue;
      const level = piece.pivot.y;
      const from = this.onLevel(input.prevNdc, level, camera, this.tmp);
      const to = from && this.onLevel(input.ndc, level, camera, this.tmp2);
      if (!from || !to) continue;
      let vx = (to.x - from.x) / dt, vz = (to.z - from.z) / dt;
      const speed = Math.hypot(vx, vz);
      if (speed > k.dragSpeed) { vx *= k.dragSpeed / speed; vz *= k.dragSpeed / speed; }
      // Following a reversal at once rather than adding up forces until they cancel. The flights the stair is not
      // waiting for yet only stir.
      const response = (1 - Math.exp(-dt * k.follow * Math.min(1, Math.sqrt(hit) * 2))) * (piece === next ? 1 : k.stir);
      piece.velocity.x += (vx - piece.velocity.x) * response;
      piece.velocity.z += (vz - piece.velocity.z) * response;
      piece.worked += hit * dt;
      piece.handled = k.handled;
    }
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    this.time = time;
    const k = tuning.stairs;
    const next = this.waiting;
    for (const piece of this.pieces) {
      if (piece.docked) continue;
      const o = piece.offset, v = piece.velocity;
      if (piece.settling > 0) {
        piece.settling = Math.min(1, piece.settling + dt / k.settleSeconds);
        const ease = 1 - Math.exp(-dt * 6);
        o.x += (0 - o.x) * ease;
        o.z += (0 - o.z) * ease;
        o.y += (0 - o.y) * ease;
        if (piece.settling >= 1) {
          o.set(0, 0, 0);
          piece.docked = true;
          this.onDocked(piece.flight.index);
        }
        continue;
      }
      const drag = Math.exp(-dt * k.drag);
      v.x *= drag;
      v.z *= drag;
      o.x += v.x * dt;
      o.z += v.z * dt;
      // Left alone it turns very slowly, like a leaf on a pond.
      o.y += Math.sin(this.time * 0.13 + piece.pivot.y) * k.idleTurn * dt;
      // Nothing is carried up to the lens, where a flight would fill the view and dissolve out of reach.
      const cx = piece.pivot.x + o.x - camera.position.x, cz = piece.pivot.z + o.z - camera.position.z;
      const near = Math.hypot(cx, cz);
      if (near < k.lensClear && near > 1e-3 && Math.hypot(v.x, v.z) > 0.05) {
        o.x += cx / near * (k.lensClear - near);
        o.z += cz / near * (k.lensClear - near);
        const into = (v.x * cx + v.z * cz) / near;
        if (into < 0) { v.x -= into * cx / near; v.z -= into * cz / near; }
      }
      const far = Math.hypot(o.x, o.z);
      if (far > k.reach) {
        o.x *= k.reach / far;
        o.z *= k.reach / far;
        v.x *= 0.5;
        v.z *= 0.5;
      }
      if (piece === next) {
        o.y = Math.atan2(Math.sin(o.y), Math.cos(o.y));
        const bottom = this.pointOn(piece, piece.flight.bottom, this.tmp);
        const gap = Math.hypot(bottom.x - piece.flight.bottom.x, bottom.z - piece.flight.bottom.z);
        const off = Math.hypot(o.x, o.z);
        // As it comes near its place it turns itself to fit, and once it is close and still being worked it
        // draws itself in: a near miss slides home.
        const nearing = 1 - THREE.MathUtils.smoothstep(off, k.alignNear, k.alignFrom);
        o.y *= Math.exp(-dt * k.align * nearing);
        piece.handled = Math.max(0, piece.handled - dt);
        const drawn = Math.min(1, piece.handled) * (1 - THREE.MathUtils.smoothstep(off, k.pullFrom * 0.4, k.pullFrom));
        if (drawn > 0) {
          v.x -= o.x * k.pull * drawn * dt;
          v.z -= o.z * k.pull * drawn * dt;
        }
        if (gap < k.captureGap && Math.abs(o.y) < k.captureTurn) piece.settling = 1e-3;
      }
    }
    this.ghostUniform.value += ((next ? this.ghostShown : 0) - this.ghostUniform.value) * (1 - Math.exp(-dt * 2));
    this.pose();
    const deck = atmo.uniforms.uCloudDeck.value;
    this.cloudTop.visible = deck.w > 0.01 && camera.position.y > CLOUD.top - 0.4;
    this.topUniforms.uCentre.value.set(Math.round(camera.position.x / 8) * 8, Math.round(camera.position.z / 8) * 8);
    this.wisps.update(dt, time);
    this.cloudBelly.visible = deck.w > 0.01 && camera.position.y < atmo.uniforms.uCloudDeckY.value.x - 0.3;
    this.bellyUniforms.uCentre.value.copy(this.topUniforms.uCentre.value);
  }

  private pose(): void {
    const next = this.waiting;
    this.pieces.forEach((piece, i) => {
      const bob = piece.docked ? 0 : (1 - piece.settling) * Math.sin(this.time * 0.6 + i * 2.1) * 0.08;
      const sway = piece.docked ? 0 : (1 - piece.settling) * Math.sin(this.time * 0.37 + i) * 0.025;
      piece.group.position.set(piece.pivot.x + piece.offset.x, piece.pivot.y + bob, piece.pivot.z + piece.offset.z);
      piece.group.rotation.set(sway * 0.4, piece.offset.y, sway);
      piece.ghost.visible = piece === next && this.ghostUniform.value > 0.01;
    });
  }

  /** The walking strips for a flight and the landing it arrives on, for the child's feet. */
  static decks(index: number): Deck[] {
    const f = flight(index);
    const L = landingOf(index);
    const cz = (L.z0 + L.z1) / 2;
    return [
      { x0: f.bottom.x, z0: f.bottom.z, x1: f.top.x, z1: f.top.z, halfWidth: STEP.width / 2,
        height: f.bottom.y, height1: f.top.y },
      { x0: L.x0 + 0.12, z0: cz, x1: L.x1 - 0.12, z1: cz, halfWidth: (L.z1 - L.z0) / 2 - 0.1, height: L.y },
    ];
  }
}


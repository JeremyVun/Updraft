import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import type { Deck } from './decks';
import { tuning } from '../tuning';
import { fixInPlace } from '../gl/fixed';
import type { QualityLevelName } from '../gl/quality';
import { ATMO_GLSL, atmo } from './atmosphere';
import { HAZE_SHADE_GLSL, hazeStride, hazeUnderFlight, hazeUnderLanding } from './stairs-haze';
import { CloudWisps } from './stairs-wisps';
import { StairsCloud } from './stairs-cloud';
import { CloudBank } from './stairs-bank';
import { ALONG_DRAWN, DRAWN_SLOPE, LOOP_BANK, LOOP_EYE, LOOP_SHRINK, drawIn } from './stairs-penrose';
import {
  BELOW_CLOUD, FLIGHTS, INSET, LOOP, LOOP_BACK, LOOP_FAR, LOOSE, NEWEL, OPENING, RAIL_HEIGHT, STEP_BLOCK, STRING, along, LOOSE_START, SLIPPERS, STEP, TOP_OUT,
  flight, landingOf, onLanding, type Face, type Flight, type Landing,
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
#ifdef TRICK
uniform float uUndraw;
in vec3 aBuilt;
#endif
void main() {
  vUv = uv;
  vColor = color;
  vPart = aPart;
  vMist = aMist;
#ifdef TRICK
  // Drawn in toward the eye, or let go back to how it is really built, climbing on past the corner into the air.
  vWorld = (modelMatrix * vec4(mix(position, aBuilt, uUndraw), 1.0)).xyz;
#else
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
#endif
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * A staircase out of a child's dream: soft painted wood lit like the rest of the world, warm where the low sun
 * reaches it and lilac in its shade, and underneath, where nobody looks, it goes to mist.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
${HAZE_SHADE_GLSL}
uniform float uShown;
#ifdef TRICK
uniform mat4 projectionMatrix;
uniform vec3 uLoopEye;
uniform float uShrink;
uniform float uTrueDepth;
uniform vec4 uAlong;
uniform float uAlongK;
uniform vec4 uSlope;
#endif
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
  keep *= uShown;
  if (keep <= 0.0) discard;
#ifdef TRICK
  // Drawn in, it is in front of and behind everything else as if it stood where it seems to. That squeezes its depth
  // so much near the top that the runner and the tread beneath it can no longer be told apart, so all of it is pushed
  // back alike along each line of sight, by how far up the flight that line meets its slope (DRAWN_SLOPE,
  // ALONG_DRAWN). That only holds from the one place, so once the lens leaves it the flight is sorted where it is.
  vec3 ray = vWorld - cameraPosition;
  vec3 meets = cameraPosition + ray * (uSlope.w - dot(uSlope.xyz, cameraPosition)) / dot(uSlope.xyz, ray);
  float t = dot(meets.xz, uAlong.xy) - uAlong.z;
  float along = clamp(2.0 * t / (uAlongK + sqrt(max(0.0, uAlongK * uAlongK - 4.0 * uAlong.w * t))), 0.0, 1.0);
  float push = mix(1.0 / mix(1.0, uShrink, along), 1.0, uTrueDepth);
  vec4 seems = projectionMatrix * viewMatrix * vec4(uLoopEye + (vWorld - uLoopEye) * push, 1.0);
  gl_FragDepth = seems.z / seems.w * 0.5 + 0.5;
#endif
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
  // The bottoms of the steps go into the haze they rest on, in its colour.
  vec3 mist = hazeShade() * 0.85 + uSunColor * 0.12 * sun;
  col = mix(col, mist, smoothstep(0.0, 0.3, vMist) * (0.4 + 0.4 * fray));
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

/**
 * Gathers blocks, rails and posts into one indexed geometry with a colour, a material id and a mist amount on every
 * vertex.
 */
class Build {
  private readonly parts: THREE.BufferGeometry[] = [];
  private readonly p = new THREE.Vector3();

  /** `mist` says, for a point in world space, how far it has gone to cloud: 0 solid, 1 gone. */
  add(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, part: number, colour = COLOURS[part], mist?: (p: THREE.Vector3) => number): void {
    const g = geo.clone();
    if (!g.index) shareCorners(g);
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

/** Indexes a triangle list in place, sharing only corners identical to the bit in every attribute: the same triangles in the same order. */
function shareCorners(geo: THREE.BufferGeometry): void {
  const sources = Object.keys(geo.attributes).map(name => {
    const { array, itemSize } = geo.getAttribute(name) as THREE.BufferAttribute;
    if (!(array instanceof Float32Array)) throw new Error(`Stairs attribute ${name} is not float`);
    return { name, size: itemSize, bits: new Uint32Array(array.buffer, array.byteOffset, array.length) };
  });
  const n = geo.getAttribute('position').count;
  const width = sources.reduce((sum, a) => sum + a.size, 0);
  const keys = new Uint32Array(n * width);
  let offset = 0;
  for (const { size, bits } of sources) {
    for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) keys[i * width + offset + c] = bits[i * size + c];
    offset += size;
  }
  let slots = 1;
  while (slots < n * 2) slots *= 2;
  const table = new Int32Array(slots).fill(-1);
  const first = new Int32Array(n);
  const index = new Uint32Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const at = i * width;
    let h = 0;
    for (let c = 0; c < width; c++) {
      h = Math.imul(h ^ keys[at + c], 0x9e3779b1);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h ^= h >>> 13;
    for (let s = h & (slots - 1); ; s = (s + 1) & (slots - 1)) {
      const k = table[s];
      if (k < 0) {
        table[s] = count;
        first[count] = i;
        index[i] = count++;
        break;
      }
      const other = first[k] * width;
      let c = 0;
      while (c < width && keys[other + c] === keys[at + c]) c++;
      if (c === width) {
        index[i] = k;
        break;
      }
    }
  }
  offset = 0;
  for (const { name, size } of sources) {
    const shared = new Uint32Array(count * size);
    for (let k = 0; k < count; k++) for (let c = 0; c < size; c++) shared[k * size + c] = keys[first[k] * width + offset + c];
    geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(shared.buffer), size));
    offset += size;
  }
  geo.setIndex(new THREE.BufferAttribute(count < 65536 ? Uint16Array.from(index) : index, 1));
}

const PITCH = Math.atan2(STEP.rise, STEP.going);

/** The middle of the loop's ring, on the ground plan. */
const RING_MIDDLE = [landingOf(LOOP.corner), landingOf(LOOP.wait), landingOf(LOOP.onward), LOOP_FAR.landing]
  .reduce((sum, L) => sum.add(L.centre), new THREE.Vector3()).multiplyScalar(0.25).setY(0);

const block = (w: number, h: number, d: number, r = 0.045) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
/** A fat turned baluster one unit tall: a round foot, a belly and a collar under the rail. */
const BALUSTER = new THREE.LatheGeometry([
  [0.0, 0.0], [0.08, 0.0], [0.088, 0.035], [0.074, 0.08], [0.052, 0.13], [0.062, 0.3], [0.094, 0.48], [0.064, 0.66],
  [0.046, 0.79], [0.07, 0.855], [0.07, 0.935], [0.052, 1.0], [0.0, 1.0],
].map(([r, y]) => new THREE.Vector2(r, y)), 16);
const KNOB = new THREE.SphereGeometry(0.155, 20, 14);
const RAIL = new THREE.CylinderGeometry(0.072, 0.072, 1, 16, 1).rotateX(Math.PI / 2);
/** Round the loop a rail bends with the drawn-in flight, so it needs rings all along it. */
const RING_RAIL = new THREE.CylinderGeometry(0.072, 0.072, 1, 16, 24).rotateX(Math.PI / 2);

/** Local frame of a flight: +z up the flight from its bottom riser, +y up, +x to the climber's left. */
function flightFrame(f: Flight): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(f.bottom.x, f.bottom.y, f.bottom.z)
    .multiply(new THREE.Matrix4().makeRotationY(f.yaw));
}

/** Local frame of a landing: its middle at its floor, +z the way the climber was going, +x to their left. */
function landingFrame(L: Landing): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(L.centre.x, L.centre.y, L.centre.z)
    .multiply(new THREE.Matrix4().makeRotationY(L.yaw));
}

const at = (frame: THREE.Matrix4, x: number, y: number, z: number) => frame.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));

/** A newel post: a square post with a big round knob on it, standing at `floor` in the frame. */
function newel(b: Build, frame: THREE.Matrix4, x: number, s: number, floor: number, mist: (p: THREE.Vector3) => number): void {
  const top = floor + RAIL_HEIGHT + 0.12;
  const bottom = floor - 0.3;
  b.add(block(NEWEL, top - bottom, NEWEL, 0.05), at(frame, x, (top + bottom) / 2, s), WOOD, undefined, mist);
  b.add(block(NEWEL + 0.06, 0.07, NEWEL + 0.06, 0.03), at(frame, x, top - 0.02, s), WOOD, undefined, mist);
  b.add(KNOB, at(frame, x, top + 0.14, s), WOOD, undefined, mist);
}

/** A rail from s0 to s1 in the frame at x, on a few fat balusters standing on `floor(s)`. */
function railing(b: Build, frame: THREE.Matrix4, x: number, s0: number, s1: number, floor: (s: number) => number,
  rail: (s: number) => number, balusters: number, mist: (p: THREE.Vector3) => number, geometry = RAIL): void {
  for (let i = 0; i < balusters; i++) {
    const s = s0 + (i + 1) * (s1 - s0) / (balusters + 1);
    const y0 = floor(s);
    const m = at(frame, x, y0, s).multiply(new THREE.Matrix4().makeScale(1, rail(s) - y0, 1));
    b.add(BALUSTER, m, WOOD, undefined, mist);
  }
  const len = Math.hypot(s1 - s0, rail(s1) - rail(s0));
  const mid = (s0 + s1) / 2;
  const tilt = Math.atan2(rail(s1) - rail(s0), s1 - s0);
  b.add(geometry, at(frame, x, rail(mid), mid).multiply(new THREE.Matrix4().makeRotationX(-tilt)).multiply(new THREE.Matrix4().makeScale(1, 1, len)), WOOD, undefined, mist);
}

/**
 * One flight: a block for every step, the runner up them, and a string and a rail up either side. Round the loop
 * (`ring`) the steps run out under the rail with no string, so both sides show their stepped ends, and there is a
 * rail on the outside of the ring only, which stops at the corners' newels rather than running into them.
 */
function buildFlight(b: Build, f: Flight, ring = false): void {
  const F = flightFrame(f);
  const inv = F.clone().invert();
  const { rise, going } = STEP;
  const width = ring ? STEP.width + 2 * STRING.thick - 0.02 : STEP.width;
  const risers = f.risers;
  const local = new THREE.Vector3();
  const nosing = (s: number) => rise + s * (rise / going);
  // Only the very bottom of the stack of steps frays into the cloud under it.
  const mist = (p: THREE.Vector3) => {
    local.copy(p).applyMatrix4(inv);
    return (nosing(local.z) - local.y - 0.55) / 0.3;
  };
  for (let i = 1; i <= risers; i++) {
    const s0 = (i - 1) * going;
    const top = i * rise;
    const d = i < risers ? going + 0.03 : 0.12;
    b.add(block(width, STEP_BLOCK, d, 0.06), at(F, 0, top - STEP_BLOCK / 2, s0 + d / 2 - 0.03), PAINT, undefined, mist);
    b.add(block(0.98, 0.022, d - 0.02, 0.01), at(F, 0, top + 0.009, s0 + d / 2 - 0.03), RUNNER, undefined, mist);
    b.add(block(0.98, rise - 0.01, 0.022, 0.01), at(F, 0, top - rise / 2 + 0.004, s0 - 0.04), RUNNER, undefined, mist);
  }
  const run = going * (risers - 1);
  const len = Math.hypot(run + going, risers * rise) + 0.1;
  const mid = (run - going * 0.5) / 2;
  const centre = nosing(mid) + (STRING.above - STRING.below) / 2 - rise / 2;
  const side = STEP.width / 2 + STRING.thick / 2 - 0.01;
  const stringTop = (s: number) => nosing(s) + STRING.above - rise / 2 - 0.02;
  const tread = (s: number) => rise * THREE.MathUtils.clamp(Math.floor(s / going + 0.1) + 1, 1, risers);
  const railTop = (s: number) => THREE.MathUtils.clamp(nosing(s), rise, risers * rise) + RAIL_HEIGHT - 0.1;
  if (ring) {
    const post = INSET - NEWEL / 2;
    railing(b, F, -side, -post, run + post, tread, railTop, Math.max(1, risers >> 2), mist, RING_RAIL);
    return;
  }
  for (const x of [-side, side]) {
    b.add(block(STRING.thick, STRING.above + STRING.below, len, 0.06), at(F, x, centre, mid).multiply(new THREE.Matrix4().makeRotationX(-PITCH)), PAINT, undefined, mist);
    railing(b, F, x, -INSET, run + INSET, stringTop, railTop, Math.max(1, risers >> 2), mist);
  }
  // Where the landing below has its own newels, so a loose flight has them with it and a docked one shares them.
  for (const x of [-OPENING, OPENING]) newel(b, F, x, -INSET, 0, mist);
}

/**
 * A landing, with a rail right round it but where a flight comes onto it or leaves it, and a newel at every corner
 * and wherever a rail stops, which the flights' own rails run into. The top landing is bare on its left, to the sun.
 */
function buildLanding(b: Build, L: Landing, ring = false): void {
  const F = landingFrame(L);
  const mist = (p: THREE.Vector3) => (L.centre.y - p.y - 0.3) / 0.35;
  const w = L.x1 - L.x0, d = L.z1 - L.z0;
  const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  b.add(block(w, 0.34, d, 0.07), at(F, cx, -0.17, cz), PAINT, undefined, mist);
  b.add(block(w - 0.5, 0.02, d - 0.5, 0.01), at(F, cx, 0.008, cz), RUNNER, undefined, mist);
  const flat = () => 0;
  const rail = () => RAIL_HEIGHT + 0.02;
  const x0 = L.x0 + INSET, x1 = L.x1 - INSET, z0 = L.z0 + INSET, z1 = L.z1 - INSET;
  const across = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const posts: [number, number][] = [];
  const post = ([x, z]: [number, number]) => {
    if (!posts.some(([a, c]) => Math.hypot(a - x, c - z) < 0.2)) posts.push([x, z]);
  };
  const faces: { face: Face; from: number; to: number; line: number }[] = [
    { face: 'back', from: x0, to: x1, line: z0 }, { face: 'ahead', from: x0, to: x1, line: z1 },
    { face: 'left', from: z0, to: z1, line: x1 }, { face: 'right', from: z0, to: z1, line: x0 },
  ];
  for (const f of faces) {
    const crosswise = f.face === 'back' || f.face === 'ahead';
    const pos = (s: number): [number, number] => (crosswise ? [s, f.line] : [f.line, s]);
    post(pos(f.from));
    post(pos(f.to));
    if (L.bare.includes(f.face)) continue;
    let spans = [[f.from, f.to]];
    for (const o of L.openings.filter(o => o.face === f.face)) {
      spans = spans.flatMap(([a, c]) => [[a, Math.min(c, o.at - OPENING)], [Math.max(a, o.at + OPENING), c]]).filter(([a, c]) => c - a > 0.05);
    }
    for (const [a, c] of spans) {
      post(pos(a));
      post(pos(c));
      if (c - a < 0.35) continue;
      const frame = crosswise ? at(F, 0, 0, f.line).multiply(across) : F;
      railing(b, frame, crosswise ? 0 : f.line, a, c, flat, rail, Math.max(1, Math.round((c - a) / 0.5)), mist);
    }
  }
  // Round the loop the inside of the ring is left open, so its corner there has no post either.
  const fromMiddle = ([x, z]: [number, number]) => onLanding(L, x, z).setY(0).distanceTo(RING_MIDDLE);
  const inside = ring ? posts.reduce((a, c) => (fromMiddle(c) < fromMiddle(a) ? c : a)) : null;
  for (const post of posts) if (post !== inside) newel(b, F, post[0], post[1], 0, mist);
}

/** How much cloud a flight rests on: none on the grass, more the higher it hangs, and in the white it is half cloud. */
function cloudUnder(index: number): number {
  // The loop hangs clear in its hollow in the white, over nothing: its last flight is drawn in to fool the eye, and
  // haze under the rest and none under that would give it away.
  if (index >= LOOP.corner && index <= LOOP.onward) return 0;
  return index === 1 ? 0 : index === 2 ? 0.55 : index <= BELOW_CLOUD ? 0.9 : 1.3;
}

/**
 * The haze a flight and the landing it arrives on rest on, placed relative to `origin`. Each flight's haze runs on
 * into its landing's, and each landing's into the next flight's where there is haze to meet.
 */
function hazeUnder(f: Flight, amount: number, origin = new THREE.Vector3()): THREE.Mesh[] {
  if (amount <= 0) return [];
  const L = landingOf(f.index);
  const floor = at(landingFrame(L), (L.x0 + L.x1) / 2, 0, (L.z0 + L.z1) / 2);
  const meets = (face: Face) => L.openings.some(o => o.face === face);
  const haze = [
    hazeUnderFlight(flightFrame(f), STEP.going * (f.risers - 1), STEP.rise * f.risers, STEP.width + 2 * STRING.thick, amount,
      { z0: f.index > 1 && cloudUnder(f.index - 1) > 0, z1: true }),
    hazeUnderLanding(floor, L.x1 - L.x0, L.z1 - L.z0, amount, { z0: true, x0: meets('right'), x1: meets('left'), z1: meets('ahead') }),
  ];
  for (const m of haze) m.matrix.premultiply(new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
  return haze;
}

/** Rags of cloud streaming through the white, and how much longer each step through the haze is, at each level. */
const FULL_DETAIL = { wisps: 56, stride: 1 };
const DETAIL: Record<QualityLevelName, { wisps: number; stride: number }> = {
  ultra: FULL_DETAIL, high: FULL_DETAIL, medium: { wisps: 36, stride: 1.25 }, low: { wisps: 24, stride: 1.5 },
};

function stairMaterial(shown = { value: 1 }, trick = false, undraw = { value: 0 }, trueDepth = { value: 0 }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    defines: trick ? { TRICK: 1 } : {},
    uniforms: { ...atmo.uniforms, uShown: shown, uLoopEye: { value: LOOP_EYE }, uShrink: { value: LOOP_SHRINK },
      uAlong: { value: new THREE.Vector4(ALONG_DRAWN.way.x, ALONG_DRAWN.way.y, ALONG_DRAWN.base, ALONG_DRAWN.aRun) }, uAlongK: { value: ALONG_DRAWN.k }, uSlope: { value: DRAWN_SLOPE }, uUndraw: undraw, uTrueDepth: trueDepth },
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

/** The loop's last flight drawn in until, seen from the one place, its top lies on the corner. */
function drawnInFlight(): THREE.BufferGeometry {
  const trick = new Build();
  buildFlight(trick, LOOP_BACK, true);
  const back = trick.result();
  const v = new THREE.Vector3();
  const pos = back.getAttribute('position');
  back.setAttribute('aBuilt', new THREE.BufferAttribute(Float32Array.from(pos.array as Float32Array), 3));
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    pos.setXYZ(i, ...drawIn(v).toArray());
  }
  return back;
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
  readonly group: THREE.Group;
  readonly pieces: LoosePiece[] = [];
  /** The deck's underside over the island and its top under the sunset. */
  readonly cloud: StairsCloud;
  /** The cloud streaming past on the way up through the white. */
  readonly wisps = new CloudWisps();
  /** The loop's last flight as it is drawn in, shown only while it is seen from the one place it works from. */
  readonly trick: THREE.Mesh;
  /** The cloud sitting over the foot of the way on out of the loop. */
  readonly bank: CloudBank;
  /** Whether the top of the cloud is kept out of sight, while the lens is up in the white looking down on the loop. */
  hideTop = false;
  /** Where the lens is, and a point it is looking at, as of the last frame. */
  readonly eye = new THREE.Vector3();
  readonly looking = new THREE.Vector3();
  private readonly trickUniform = { value: 0 };
  /** Every piece of haze under the flights, so those the white hides whole need not be drawn. */
  private readonly hazes: THREE.Mesh[] = [];
  private readonly undrawUniform = { value: 0 };
  private readonly trueDepthUniform = { value: 0 };
  /** Called with a piece's flight number as it knocks home. */
  onDocked: (index: number) => void = () => {};
  /** 0 hides the ghost of the next missing flight; 1 draws it. */
  ghostShown = 0;
  private readonly ghostUniform = { value: 0 };
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private time = 0;
  private stride = 1;

  /** Builds the staircase a flight at a time, yielding the share built between them, for `prepareInBatches`. */
  static *build(): Generator<number, CloudStairs> {
    const steps = FLIGHTS + 4;
    let done = 0;
    const group = new THREE.Group();
    const cloud = new StairsCloud();
    yield ++done / steps;
    const fixed = new Build();
    for (let i = 1; i <= FLIGHTS; i++) {
      if ((LOOSE as readonly number[]).includes(i)) continue;
      buildFlight(fixed, flight(i), i === LOOP.wait || i === LOOP.onward);
      buildLanding(fixed, landingOf(i), i >= LOOP.corner && i <= LOOP.onward);
      yield ++done / steps;
    }
    // Side by side at the open edge, toes to the drop and the sun.
    const s = new THREE.Matrix4().makeTranslation(SLIPPERS.x, SLIPPERS.y + 0.01, SLIPPERS.z).multiply(new THREE.Matrix4().makeRotationY(Math.atan2(TOP_OUT.x, TOP_OUT.z)));
    slipper(fixed, s.clone().multiply(new THREE.Matrix4().makeTranslation(-0.07, 0, -0.02)).multiply(new THREE.Matrix4().makeRotationY(0.14)));
    slipper(fixed, s.clone().multiply(new THREE.Matrix4().makeTranslation(0.08, 0, 0.03)).multiply(new THREE.Matrix4().makeRotationY(-0.22)));
    // The loop's far side, which only the bird goes round.
    buildFlight(fixed, LOOP_FAR.flight, true);
    buildLanding(fixed, LOOP_FAR.landing, true);
    yield ++done / steps;
    const standing = fixed.result();
    yield ++done / steps;
    const drawnIn = drawnInFlight();
    yield ++done / steps;
    const loose: THREE.BufferGeometry[] = [];
    for (const index of LOOSE) {
      const b = new Build();
      buildFlight(b, flight(index));
      buildLanding(b, landingOf(index));
      loose.push(b.result());
      yield ++done / steps;
    }
    return new CloudStairs(group, cloud, standing, drawnIn, loose);
  }

  private constructor(group: THREE.Group, cloud: StairsCloud, standingGeometry: THREE.BufferGeometry, drawnIn: THREE.BufferGeometry, looseGeometry: THREE.BufferGeometry[]) {
    this.group = group;
    this.cloud = cloud;
    this.group.name = 'stairs-in-the-clouds';
    const material = stairMaterial();
    for (let i = 1; i <= FLIGHTS; i++) {
      if ((LOOSE as readonly number[]).includes(i)) continue;
      for (const haze of hazeUnder(flight(i), cloudUnder(i))) {
        this.group.add(haze);
        this.hazes.push(haze);
      }
    }
    const standing = new THREE.Mesh(standingGeometry, material);
    standing.name = 'stairs-standing';
    this.group.add(standing);

    this.trick = new THREE.Mesh(drawnIn, stairMaterial(this.trickUniform, true, this.undrawUniform, this.trueDepthUniform));
    this.trick.name = 'stairs-loop-trick';
    this.trick.visible = false;
    this.group.add(this.trick);
    this.bank = new CloudBank(LOOP_BANK, 1.9, landingOf(LOOP.onward).centre.y);
    this.group.add(this.bank.mesh);

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
      const geo = looseGeometry[i];
      const pivot = new THREE.Vector3().lerpVectors(f.bottom, f.landing, 0.55);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const group = new THREE.Group();
      group.name = `stairs-loose-${index}`;
      const body = new THREE.Mesh(geo, material);
      group.add(body);
      const haze = hazeUnder(f, cloudUnder(index), pivot);
      group.add(...haze);
      this.hazes.push(...haze);
      const ghost = new THREE.Mesh(geo, ghostMaterial);
      ghost.position.copy(pivot);
      ghost.visible = false;
      ghost.renderOrder = 6;
      this.group.add(group, ghost);
      fixInPlace(body, ghost);
      const start = LOOSE_START[i];
      this.pieces.push({ flight: f, group, ghost, offset: new THREE.Vector3(start.x, start.yaw, start.z),
        velocity: new THREE.Vector3(), docked: false, settling: 0, pivot, worked: 0, handled: 0 });
    });

    this.group.add(this.cloud.group);
    this.group.add(this.wisps.mesh);
    fixInPlace(this.group, standing, this.trick, this.wisps.mesh);
    this.pose();
  }

  /** Fewer rags in the white and fewer steps through the haze below Ultra and High, eased in unless `immediate`. */
  setLevel(name: QualityLevelName, immediate = false): void {
    const detail = DETAIL[name];
    this.wisps.setKept(detail.wisps, immediate);
    this.stride = detail.stride;
    if (immediate) hazeStride.value = this.stride;
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
    this.bank.brush(camera, input, dt);
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
      // The flights the stair is not waiting for yet only stir.
      const share = piece === next ? 1 : k.stir;
      let vx = (to.x - from.x) / dt * share, vz = (to.z - from.z) / dt * share;
      const speed = Math.hypot(vx, vz);
      if (speed > k.dragSpeed) { vx *= k.dragSpeed / speed; vz *= k.dragSpeed / speed; }
      // Following a reversal at once rather than adding up forces until they cancel.
      const response = 1 - Math.exp(-dt * k.follow * Math.min(1, Math.sqrt(hit) * 2));
      piece.velocity.x += (vx - piece.velocity.x) * response;
      piece.velocity.z += (vz - piece.velocity.z) * response;
      if (piece !== next) continue;
      piece.worked += hit * dt;
      piece.handled = k.handled;
    }
  }

  /** The hull going through the top of the cloud, or null when it is not on the cloud. */
  sailing(hull: { position: THREE.Vector3; yaw: number; speed: number } | null, dt: number): void {
    this.cloud.sailing(hull, dt);
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    this.time = time;
    this.eye.copy(camera.position);
    this.looking.copy(camera.position).addScaledVector(camera.getWorldDirection(this.tmp), 12);
    this.trueDepthUniform.value = Math.max(this.undrawUniform.value, THREE.MathUtils.smoothstep(camera.position.distanceTo(LOOP_EYE), 0.05, 0.8));
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
    this.wisps.seeTrick(this.trick.visible, this.undrawUniform.value, this.trueDepthUniform.value);
    this.wisps.update(dt, time, camera);
    hazeStride.value += (this.stride - hazeStride.value) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(this.stride - hazeStride.value) < 1e-3) hazeStride.value = this.stride;
    this.bank.update(dt);
    this.cloud.update(dt, camera);
    this.hideHazeInTheWhite(camera);
    if (this.hideTop) this.cloud.top.visible = false;
  }

  /**
   * Inside the cloud nothing is seen beyond a few metres past the pocket of clearer air, so the haze further off than
   * that is not drawn at all; its sightlines are all white by then.
   */
  private hideHazeInTheWhite(camera: THREE.Camera): void {
    const deck = atmo.uniforms.uCloudDeck.value, y = atmo.uniforms.uCloudDeckY.value, bubble = atmo.uniforms.uCloudBubble.value;
    const inside = deck.w > 0.9 && camera.position.y > y.x + 1 && camera.position.y < y.y - 1 && bubble.w < 15;
    const pocket = this.tmp.set(bubble.x, bubble.y, bubble.z);
    for (const h of this.hazes) {
      if (!inside) { h.visible = true; continue; }
      const at = this.tmp2.setFromMatrixPosition(h.matrixWorld);
      const e = h.matrixWorld.elements;
      const reach = Math.hypot(e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]) / 2;
      h.visible = at.distanceTo(camera.position) - reach < 12 || at.distanceTo(pocket) - reach < bubble.w + 8;
    }
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

  /** 0 draws the loop's last flight in, so from the one place it seems to close the loop; 1 as it is really built. */
  set undraw(amount: number) {
    this.undrawUniform.value = amount;
  }

  /** 0 hides the loop's trick, 1 shows it; in between it comes and goes in a scatter. */
  set trickShown(amount: number) {
    this.trickUniform.value = amount;
    this.trick.visible = amount > 0.005;
  }

  /** Where only the bird walks: the loop's far side, and its last flight as it is drawn in. */
  static loopDecks(): Deck[] {
    // The drawn-in flight curves and shrinks toward its top, so it is walked in short straight pieces that follow it.
    const pieces = 16;
    const up = (t: number) => drawIn(LOOP_BACK.bottom.clone().lerp(LOOP_BACK.top, t));
    const back: Deck[] = Array.from({ length: pieces }, (_, i) => {
      const a = up(i / pieces), b = up((i + 1) / pieces);
      return { x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth: STEP.width * 0.4 * THREE.MathUtils.lerp(1, LOOP_SHRINK, (i + 0.5) / pieces),
        height: a.y, height1: b.y };
    });
    const top = up(1);
    const onto = drawIn(LOOP_BACK.top.clone().addScaledVector(along(LOOP_BACK.yaw), 0.5));
    return [
      ...CloudStairs.flightDecks(LOOP_FAR.flight, LOOP_FAR.landing),
      ...back,
      // A step on past its top, where the bird is put onto the corner itself.
      { x0: top.x, z0: top.z, x1: onto.x, z1: onto.z, halfWidth: 0.5 * LOOP_SHRINK, height: top.y },
    ];
  }

  /** Whether the pocket round a climber opens a hole in the top of the cloud; not while the cloud is swelling up round a hull. */
  set cloudHole(open: boolean) {
    this.cloud.hole = open;
  }

  /** The walking strips for a flight and the landing it arrives on, for the child's feet. */
  static decks(index: number): Deck[] {
    return CloudStairs.flightDecks(flight(index), landingOf(index));
  }

  private static flightDecks(f: Flight, L: Landing): Deck[] {
    const cz = (L.z0 + L.z1) / 2;
    const a = onLanding(L, L.x0 + 0.12, cz), b = onLanding(L, L.x1 - 0.12, cz);
    return [
      { x0: f.bottom.x, z0: f.bottom.z, x1: f.top.x, z1: f.top.z, halfWidth: STEP.width / 2,
        height: f.bottom.y, height1: f.top.y },
      { x0: a.x, z0: a.z, x1: b.x, z1: b.z, halfWidth: (L.z1 - L.z0) / 2 - 0.1, height: L.centre.y },
    ];
  }
}


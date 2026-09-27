import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import type { Deck } from './decks';
import { tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import {
  CLOUD, FLIGHT_RISE, FLIGHT_RUN, FLIGHTS, LOOSE, LOOSE_START, SLIPPERS, STAIRS_ISLE, STEP, flight, type Flight,
} from './stairs-layout';

/** What each part of the staircase is made of, read by the shader to decide its surface. */
const WOOD = 0, CARPET = 1, BRASS = 2, PAINT = 3, FELT = 4, RAIL = 5;
const COLOURS: Record<number, THREE.Color> = {
  [WOOD]: new THREE.Color('#6d4a32'),
  [CARPET]: new THREE.Color('#8f3d3b'),
  [BRASS]: new THREE.Color('#c8a55c'),
  [PAINT]: new THREE.Color('#ebe4d6'),
  [FELT]: new THREE.Color('#e7bf4a'),
  [RAIL]: new THREE.Color('#4a2e21'),
};

const VERT = /* glsl */ `
in float aPart;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
out vec3 vColor;
flat out float vPart;
void main() {
  vUv = uv;
  vColor = color;
  vPart = aPart;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
flat in float vPart;
in vec3 vColor;
void main() {
  float keep = nearFade(vWorld, 0.3, 1.1);
  if (keep <= 0.0) discard;
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = vColor;
  float spec = 0.0;
  int part = int(vPart + 0.5);
  if (part == ${WOOD} || part == ${RAIL}) {
    alb *= 0.86 + 0.22 * vnoise(vec2(dot(vWorld.xz, vec2(0.7, 0.7)) * 3.0, vWorld.y * 41.0 + vWorld.x * 7.0));
    spec = part == ${RAIL} ? 0.35 : 0.12;
  } else if (part == ${CARPET}) {
    float across = abs(vUv.x - 0.5);
    float border = smoothstep(0.36, 0.37, across) * (1.0 - smoothstep(0.43, 0.44, across));
    alb = mix(alb, vec3(0.85, 0.74, 0.52), border * 0.85);
    alb *= 0.9 + 0.16 * vnoise(vWorld.xz * 60.0 + vWorld.y * 30.0);
  } else if (part == ${BRASS}) {
    spec = 1.2;
  } else if (part == ${FELT}) {
    alb *= 0.92 + 0.12 * vnoise(vWorld.xz * 90.0 + vWorld.y * 70.0);
  }
  float sun = cloudShadow(vWorld.xz);
  float lit = max(0.0, dot(N, uSunDir) * 0.75 + 0.25);
  vec3 H = halfVector(uSunDir, V);
  float gloss = spec * pow(max(0.0, dot(N, H)), part == ${BRASS} ? 40.0 : 18.0);
  float under = 0.82 + 0.18 * (N.y * 0.5 + 0.5);
  vec3 col = alb * (hemiLight(N) * under + uSunColor * lit * sun * 0.9) + uSunColor * gloss * sun;
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

/** Gathers boxes, turnings and posts into one geometry with a colour and a material id on every vertex. */
class Build {
  private readonly parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, part: number, colour = COLOURS[part]): void {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const n = g.getAttribute('position').count;
    const c = new Float32Array(n * 3);
    const p = new Float32Array(n).fill(part);
    for (let i = 0; i < n; i++) c.set([colour.r, colour.g, colour.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(p, 1));
    this.parts.push(g);
  }

  box(frame: THREE.Matrix4, sx: number, sy: number, sz: number, x: number, y: number, z: number, part: number, pitch = 0): void {
    const m = new THREE.Matrix4().makeTranslation(x, y, z);
    if (pitch) m.multiply(new THREE.Matrix4().makeRotationX(pitch));
    this.add(new THREE.BoxGeometry(sx, sy, sz), frame.clone().multiply(m), part);
  }

  result(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts);
    this.parts.length = 0;
    return merged;
  }
}

/** A turned baluster one unit tall: a foot, a vase and a neck. */
const BALUSTER = new THREE.LatheGeometry([
  [0.0, 0.0], [0.024, 0.0], [0.024, 0.09], [0.015, 0.12], [0.022, 0.26], [0.03, 0.4], [0.02, 0.55], [0.012, 0.72],
  [0.016, 0.8], [0.016, 0.9], [0.022, 0.93], [0.022, 1.0], [0.0, 1.0],
].map(([r, y]) => new THREE.Vector2(r, y)), 7);
const FINIAL = new THREE.SphereGeometry(0.07, 10, 8);

/** Local frame of a flight: +z up the flight from its bottom riser, +y up, x across with its own lane at 0. */
function flightFrame(f: Flight): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(f.bottom.x, f.bottom.y, f.bottom.z)
    .multiply(new THREE.Matrix4().makeRotationY(f.dir > 0 ? Math.PI : 0));
}

const RAIL_HEIGHT = 0.86;
const PITCH = Math.atan2(STEP.rise, STEP.going);
const OTHER = -(STEP.width + STEP.gap);

function balustrade(b: Build, frame: THREE.Matrix4, x: number, s0: number, s1: number, floor: (s: number) => number,
  rail: (s: number) => number, spacing: number, pitched: boolean): void {
  const n = Math.max(1, Math.round((s1 - s0) / spacing));
  for (let i = 0; i < n; i++) {
    const s = s0 + (i + 0.5) * (s1 - s0) / n;
    const y0 = floor(s);
    const h = rail(s) - y0;
    b.add(BALUSTER, frame.clone().multiply(new THREE.Matrix4().makeTranslation(x, y0, s)).multiply(new THREE.Matrix4().makeScale(1, h, 1)), PAINT);
  }
  const len = Math.hypot(s1 - s0, rail(s1) - rail(s0));
  const mid = (s0 + s1) / 2;
  b.box(frame, 0.065, 0.055, len + 0.06, x, rail(mid) + 0.025, mid, RAIL, pitched ? -PITCH : 0);
}

function newel(b: Build, frame: THREE.Matrix4, x: number, s: number, floor: number, drop: boolean): void {
  const top = floor + RAIL_HEIGHT + 0.2;
  const bottom = drop ? floor - 0.42 : floor;
  b.box(frame, 0.09, top - bottom, 0.09, x, (top + bottom) / 2, s, PAINT);
  b.box(frame, 0.13, 0.04, 0.13, x, top + 0.02, s, RAIL);
  b.add(FINIAL, frame.clone().multiply(new THREE.Matrix4().makeTranslation(x, top + 0.09, s)).multiply(new THREE.Matrix4().makeScale(0.75, 0.75, 0.75)), RAIL);
  if (drop) b.add(FINIAL, frame.clone().multiply(new THREE.Matrix4().makeTranslation(x, bottom - 0.03, s)).multiply(new THREE.Matrix4().makeScale(0.6, 0.9, 0.6)), PAINT);
}

/** One flight: treads, risers, runner and rods, strings and soffit, and a banister each side. */
function buildFlight(b: Build, f: Flight, hanging: boolean): void {
  const F = flightFrame(f);
  const { rise, going, risers, width } = STEP;
  for (let i = 1; i <= risers; i++) {
    const s = (i - 1) * going;
    b.box(F, width, rise, 0.022, 0, (i - 0.5) * rise, s + 0.011, PAINT);
    b.box(F, 0.74, rise, 0.012, 0, (i - 0.5) * rise, s - 0.004, CARPET);
    if (i > 1) {
      const rod = F.clone().multiply(new THREE.Matrix4().makeTranslation(0, (i - 1) * rise + 0.016, s - 0.016))
        .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.82, 6), rod, BRASS);
    }
    if (i < risers) {
      b.box(F, width, 0.035, going + 0.03, 0, i * rise - 0.0175, s + going / 2 - 0.015, WOOD);
      b.box(F, 0.74, 0.014, going, 0, i * rise + 0.007, s + going / 2, CARPET);
    }
  }
  const run = FLIGHT_RUN;
  const len = Math.hypot(run + going, FLIGHT_RISE);
  const pitchY = (s: number) => rise + s * (rise / going);
  const mid = (run - going) / 2;
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + 0.028);
    b.box(F, 0.05, 0.3, len, x, pitchY(mid) - 0.12, mid, PAINT, -PITCH);
    balustrade(b, F, x, 0.02, run, (s) => Math.min(risers - 1, Math.floor(s / going) + 1) * rise, (s) => pitchY(s) + RAIL_HEIGHT, going / 2, true);
    newel(b, F, x, -0.05, 0, hanging);
  }
  b.box(F, width + 0.1, 0.03, len, 0, pitchY(mid) - 0.3, mid, PAINT, -PITCH);
}

/** The half-landing a flight arrives on, spanning both lanes, with its banister round the open sides. */
function buildLanding(b: Build, f: Flight, boarding: boolean): void {
  const F = flightFrame(f);
  const { width, landing } = STEP;
  const x0 = OTHER - width / 2 - 0.05, x1 = width / 2 + 0.05;
  const s0 = FLIGHT_RUN, s1 = FLIGHT_RUN + landing;
  const cx = (x0 + x1) / 2, cs = (s0 + s1) / 2, y = FLIGHT_RISE;
  b.box(F, x1 - x0, 0.2, landing, cx, y - 0.1, cs, WOOD);
  b.box(F, x1 - x0 - 0.02, 0.03, landing - 0.02, cx, y - 0.215, cs, PAINT);
  b.box(F, x1 - x0 - 0.3, 0.014, landing - 0.3, cx, y + 0.007, cs, CARPET);
  const flat = () => y;
  const rail = () => y + RAIL_HEIGHT + 0.06;
  const outer = x1 - 0.022, other = x0 + 0.022;
  balustrade(b, F, outer, s0 + 0.05, s1 - 0.05, flat, rail, 0.12, false);
  // The top landing is open on the side the sun sets.
  if (!boarding) balustrade(b, F, other, s0 + 0.05, s1 - 0.05, flat, rail, 0.12, false);
  const edge = FLIGHT_RUN + landing - 0.022;
  const across = new THREE.Matrix4().copy(F).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  balustrade(b, across, -edge, x0 + 0.05, x1 - 0.05, flat, rail, 0.12, false);
  if (boarding) balustrade(b, across, -(s0 + 0.022), x0 + 0.05, OTHER + width / 2, flat, rail, 0.12, false);
  newel(b, F, outer, s1 - 0.02, y, true);
  newel(b, F, other, s1 - 0.02, y, true);
  newel(b, F, other, s0, y, true);
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
  const cream = new THREE.Color('#f3ead3');
  b.add(new THREE.CylinderGeometry(1, 1, 1, 16), frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.012, 0)).multiply(new THREE.Matrix4().makeScale(0.046, 0.024, 0.092)), FELT, cream.clone().multiplyScalar(0.8));
  b.add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.022, 0.03)).multiply(new THREE.Matrix4().makeScale(0.047, 0.05, 0.068)), FELT, felt);
  b.add(new THREE.TorusGeometry(0.042, 0.012, 6, 16), frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.03, -0.035)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(1, 1.35, 1)), FELT, cream);
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
  /** Called with a piece's flight number as it knocks home. */
  onDocked: (index: number) => void = () => {};
  /** 0 hides the ghost of the next missing flight; 1 draws it. */
  ghostShown = 0;
  private readonly ghostUniform = { value: 0 };
  private readonly topUniforms: { uCentre: { value: THREE.Vector2 }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number } };
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private time = 0;

  constructor() {
    this.group.name = 'stairs-in-the-clouds';
    const material = stairMaterial();
    const fixed = new Build();
    for (let i = 1; i <= FLIGHTS; i++) {
      if ((LOOSE as readonly number[]).includes(i)) continue;
      const f = flight(i);
      buildFlight(fixed, f, i > LOOSE[LOOSE.length - 1]);
      buildLanding(fixed, f, i === FLIGHTS);
    }
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
      buildFlight(b, f, true);
      buildLanding(b, f, false);
      const geo = b.result();
      const pivot = new THREE.Vector3().lerpVectors(f.bottom, f.landing, 0.55);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
      const group = new THREE.Group();
      group.name = `stairs-loose-${index}`;
      group.add(new THREE.Mesh(geo, material));
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

  /**
   * The player's strokes push whatever part of a loose flight they cross, the way a gust pushes a toy boat: a
   * push on its middle moves it, a push on one end turns it about the other. The flights hang in the air, so a
   * stroke is read at the flight's own depth: across the screen is across the view, up the screen is away.
   */
  brush(camera: THREE.PerspectiveCamera, input: PointerInput, dt: number): void {
    if (!input.present || input.muted || dt <= 0) return;
    const sx = (input.ndc.x - input.prevNdc.x) * camera.aspect, sy = input.ndc.y - input.prevNdc.y;
    if (sx * sx + sy * sy < 1e-8) return;
    const k = tuning.stairs;
    camera.getWorldDirection(this.forward).setY(0).normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    for (const piece of this.pieces) {
      if (piece.docked || piece.settling > 0) continue;
      const f = piece.flight;
      for (const at of [0.04, 0.5, 0.96]) {
        this.tmp.lerpVectors(f.bottom, f.landing, at).y += 0.6;
        const p = this.pointOn(piece, this.tmp, this.tmp);
        const w = screenBrush(camera, p, input.prevNdc, input.ndc, k.brushRadius);
        if (w <= 0) continue;
        const depth = p.distanceTo(camera.position) * halfHeight;
        const vx = (this.right.x * sx + this.forward.x * sy) * depth / dt;
        const vz = (this.right.z * sx + this.forward.z * sy) * depth / dt;
        const speed = Math.hypot(vx, vz);
        const scale = speed > k.strokeCap ? k.strokeCap / speed : 1;
        const fx = vx * scale * w * k.push, fz = vz * scale * w * k.push;
        piece.velocity.x += fx;
        piece.velocity.z += fz;
        const rx = p.x - (piece.pivot.x + piece.offset.x), rz = p.z - (piece.pivot.z + piece.offset.z);
        piece.velocity.y += (rz * fx - rx * fz) * k.turn;
        piece.worked += w * dt;
        piece.handled = tuning.stairs.handled;
      }
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
      v.y *= Math.exp(-dt * k.spinDrag);
      o.x += v.x * dt;
      o.z += v.z * dt;
      o.y += v.y * dt;
      const far = Math.hypot(o.x, o.z);
      if (far > k.reach) {
        o.x *= k.reach / far;
        o.z *= k.reach / far;
        v.x *= 0.5;
        v.z *= 0.5;
      }
      if (piece === next) {
        o.y = Math.atan2(Math.sin(o.y), Math.cos(o.y));
        const turned = Math.abs(o.y);
        const bottom = this.pointOn(piece, piece.flight.bottom, this.tmp);
        const gap = Math.hypot(bottom.x - piece.flight.bottom.x, bottom.z - piece.flight.bottom.z);
        // Near its place a flight feels where it belongs, and leans that way: a near miss slides home.
        piece.handled = Math.max(0, piece.handled - dt);
        const near = Math.min(1, piece.handled) * (1 - THREE.MathUtils.smoothstep(Math.hypot(o.x, o.z), k.pullFrom * 0.4, k.pullFrom));
        if (near > 0) {
          v.x -= o.x * k.pull * near * dt;
          v.z -= o.z * k.pull * near * dt;
          // It only turns itself the rest of the way once it is roughly the right way round.
          v.y -= o.y * k.pull * 1.5 * near * (1 - THREE.MathUtils.smoothstep(turned, k.alignWithin * 0.6, k.alignWithin)) * dt;
        }
        if (gap < k.captureGap && turned < k.captureTurn) {
          piece.settling = 1e-3;
          o.y = Math.atan2(Math.sin(o.y), Math.cos(o.y));
        }
      }
    }
    this.ghostUniform.value += ((next ? this.ghostShown : 0) - this.ghostUniform.value) * (1 - Math.exp(-dt * 2));
    this.pose();
    const deck = atmo.uniforms.uCloudDeck.value;
    this.cloudTop.visible = deck.w > 0.01 && camera.position.y > CLOUD.base;
    this.topUniforms.uCentre.value.set(Math.round(camera.position.x / 8) * 8, Math.round(camera.position.z / 8) * 8);
  }

  private pose(): void {
    const next = this.waiting;
    this.pieces.forEach((piece, i) => {
      const bob = piece.docked ? 0 : (1 - piece.settling) * Math.sin(this.time * 0.6 + i * 2.1) * 0.12;
      const sway = piece.docked ? 0 : (1 - piece.settling) * Math.sin(this.time * 0.37 + i) * 0.035;
      piece.group.position.set(piece.pivot.x + piece.offset.x, piece.pivot.y + bob, piece.pivot.z + piece.offset.z);
      piece.group.rotation.set(sway * 0.4, piece.offset.y, sway);
      piece.ghost.visible = piece === next && this.ghostUniform.value > 0.01;
    });
  }

  /** The walking strips for a flight and the landing it arrives on, for the child's feet. */
  static decks(index: number): Deck[] {
    const f = flight(index);
    const lx = f.landing.x;
    const halfSpan = STEP.width + STEP.gap / 2;
    return [
      { x0: f.bottom.x, z0: f.bottom.z, x1: f.top.x, z1: f.top.z, halfWidth: STEP.width / 2,
        height: f.bottom.y, height1: f.top.y },
      { x0: lx - halfSpan, z0: f.landing.z, x1: lx + halfSpan, z1: f.landing.z, halfWidth: STEP.landing / 2 + 0.1,
        height: f.top.y },
    ];
  }
}


import * as THREE from 'three';
import { ATMO_GLSL, NOISE_GRAD_GLSL, atmo } from './atmosphere';
import { CloudWake } from './stairs-wake';
import { BELOW_CLOUD, CLOUD, CLOUD_BERTH, CLOUD_ROUTE, DESCENT_END, STAIRS_ISLE, flight } from './stairs-layout';

/** How many points of the boat's way over the cloud, and of its fresh furrow, the cloud's top is told about. */
const ROUTE_POINTS = CLOUD_ROUTE.length + 2;
const TRAIL_POINTS = 16;

/** The top of the cloud as a surface: heaped up and lit gold on the sunward side, lilac in its folds. */
const TOP_VERT = /* glsl */ `
${ATMO_GLSL}
${NOISE_GRAD_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform vec2 uRoute[${ROUTE_POINTS}];
uniform vec4 uTrail[${TRAIL_POINTS}];
uniform float uSurface;
out vec3 vWorld;
out float vRing;
out vec4 vCalm;
out float vShade;
TOP
void main() {
  vec2 xz = position.xz + uCentre;
  vRing = length(position.xz);
  float c = calmAt(xz);
  vec2 slope = vec2(calmAt(xz + vec2(1.5, 0.0)) - c, calmAt(xz + vec2(0.0, 1.5)) - c) / 1.5;
  vCalm = vec4(c, slope, smoothstep(2.5, 10.0, fromRoute(xz)));
  vec2 fold;
  vec2 detail = 1.0 - vec2(smoothstep(50.0, 140.0, vRing), smoothstep(260.0, 520.0, vRing));
  float h = cloudTop(xz, vCalm, detail, 0.0, fold).x;
  vShade = heapShade(xz, h);
  vWorld = vec3(xz.x, uSurface + h, xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const TOP_FRAG = /* glsl */ `
${ATMO_GLSL}
${NOISE_GRAD_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform vec2 uRoute[${ROUTE_POINTS}];
uniform vec4 uTrail[${TRAIL_POINTS}];
uniform float uReach;
uniform float uHole;
uniform float uSurface;
in vec3 vWorld;
in float vRing;
in vec4 vCalm;
in float vShade;
TOP
void main() {
  if (vRing > uReach) discard;
  vec2 xz = vWorld.xz;
  if (uCloudBubble.w > 0.0 && uHole > 0.5) {
    float hole = length(xz - uCloudBubble.xz) - uCloudBubble.w * (0.75 + 0.35 * vnoise(xz * 0.8 + uTime * 0.1));
    if (hole < 0.0 && uCloudBubble.y < uSurface + 0.5) discard;
  }
  vec2 fold;
  vec3 top = cloudTop(xz, vCalm, vec2(1.0), 1.0, fold);
  // Low round the landing and along the way, so the light makes more of its shape there than its height does.
  vec3 N = normalize(vec3(-top.yz * mix(2.0, 1.0, vCalm.x), 1.0).xzy);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSunDir);
  // Lit from the side by the low sun, which the cloud scatters across its whole top: peach where the light lies
  // across it, gold on the flanks turned full to it, lilac and violet in the folds, on the sides turned away and in
  // the long shadows of the heaps. Against the light it glows through its crests and thin edges.
  float facing = dot(N, L);
  float lit = clamp(facing * 1.5 + 0.22, 0.0, 1.0) * (1.0 - 0.9 * vShade) * (1.0 - 0.5 * fold.x);
  float full = smoothstep(0.2, 0.85, facing) * (1.0 - vShade);
  float toward = pow(max(0.0, dot(-V, L)), 2.0);
  float edgeOn = pow(1.0 - abs(dot(N, V)), 2.0);
  vec3 lilac = uSkyAmbient * vec3(1.2, 0.88, 1.08) + uGroundBounce * 0.3;
  vec3 violet = uSkyAmbient * vec3(0.75, 0.52, 0.95);
  vec3 shade = mix(violet, lilac, clamp(N.y * 1.3 - 0.2, 0.0, 1.0) * (1.0 - 0.6 * fold.x));
  vec3 col = mix(shade, uSunColor * vec3(0.5, 0.36, 0.38) + shade * 0.3, lit);
  col += uSunColor * vec3(1.0, 0.85, 0.65) * full * 0.2;
  // A heap is lit at its crown and goes violet toward its foot, down among the others.
  col *= mix(0.66, 1.0, fold.y);
  col += uSunColor * toward * (1.0 - 0.8 * vShade) * (0.02 + 0.5 * edgeOn * (1.0 - fold.x));
  col *= 0.95 + 0.1 * vnoise(xz * 1.7);
  // Soft where a heap turns away against whatever lies beyond it.
  col = mix(col, skyColor(-V), pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0) * 0.45);
  // Far off it goes into the haze of the horizon beyond it, gold toward the sun and rose away from it.
  vec3 ahead = vWorld - cameraPosition;
  float dist = length(ahead);
  col = mix(col, skyColor(normalize(vec3(ahead.x, 0.01, ahead.z))), (1.0 - exp(-dist / 650.0)) * 0.75);
  // Its own surface is not hidden by the deck it is the top of, only when the deck swells up over it.
  gl_FragColor = vec4(applyFog(col, vec3(vWorld.x, max(vWorld.y, uSurface + 0.05), vWorld.z)), uCloudDeck.w);
}`;

/**
 * Round lobes on a jittered grid, run together where they meet: x their height in cells, yz its slope. full 0 gives
 * soft mounds, 1 heads fuller at the top with tight creases between them, the way cumulus heaps up.
 */
const LOBES_GLSL = /* glsl */ `
vec3 lobes(vec2 p, float full) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float sum = 0.0;
  vec2 slope = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = g + vec2(hash12(i + g), hash12(i + g + 17.3)) * 0.9 + 0.05 - f;
    float r = 0.4 + (0.6 + 0.3 * full) * hash12(i + g + 41.7);
    float u = dot(o, o) / (r * r);
    // Some stand taller than their neighbours, so they heap up rather than lying in a quilt.
    float w = exp(9.0 * (r * (1.0 - u) * (1.0 + full * u) + (0.4 + 0.4 * full) * hash12(i + g + 63.1)));
    sum += w;
    slope += w * o / r * (1.0 - full + 2.0 * full * u);
  }
  return vec3(log(sum) / 9.0 - 0.3 - 0.2 * full, slope * 2.0 / sum);
}
vec3 lobes(vec2 p) {
  return lobes(p, 0.0);
}`;

/**
 * The top of the cloud: heaped cumulus in the open, big round lobes run together into heaps and smaller ones on
 * those, with soft creases where they meet. Low and gentle round the top landing and all along the way the boat
 * goes, so it sails down a valley between the heaps; and where the hull has just been, a furrow that closes up
 * again behind it, with a soft lip either side.
 */
const TOP_GLSL = /* glsl */ `
${LOBES_GLSL}
float toSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  return length(p - a - ab * t);
}
float fromRoute(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < ${ROUTE_POINTS - 1}; i++) d = min(d, toSegment(p, uRoute[i], uRoute[i + 1]));
  return d;
}
/** 0 round the top landing and along the way, 1 out in the open where the heaps are. */
float calmAt(vec2 xz) {
  return min(smoothstep(uCalmAt.z * 0.35, uCalmAt.z, length(xz - uCalmAt.xy)), smoothstep(5.0, 28.0, fromRoute(xz)));
}
/** x how deep the furrow is (its lip is negative), yz its slope: from the nearest point of the hull's fresh way. */
vec3 furrow(vec2 p) {
  float near = 1e5;
  vec2 off = vec2(0.0);
  float fresh = 0.0;
  for (int i = 0; i < ${TRAIL_POINTS - 1}; i++) {
    vec4 a = uTrail[i];
    vec4 b = uTrail[i + 1];
    vec2 ab = b.xy - a.xy;
    float t = clamp(dot(p - a.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    vec2 o = p - a.xy - ab * t;
    float f = mix(a.z, b.z, t);
    if (f > 0.0 && dot(o, o) < near) {
      near = dot(o, o);
      off = o;
      fresh = f;
    }
  }
  float d = max(sqrt(near), 1e-3);
  float dig = exp(-d * d / 1.1);
  float rim = d - 1.9;
  float lip = 0.3 * exp(-rim * rim / 0.4);
  float slope = -2.0 * d / 1.1 * dig + 2.0 * rim / 0.4 * lip;
  return fresh * vec3(dig - lip, slope * off / d);
}
/**
 * How high the heaps stand: a smooth rise and towers of great round lobes where the heaps gather, and big, middle
 * and fine lobes on the calm cloud (x) and on a heap (y).
 */
const float RISE = 1.2;
const float TOWER = 5.5;
const vec2 BIG = vec2(0.8, 5.0);
const vec2 MID = vec2(0.38, 1.9);
const vec2 FINE = vec2(0.14, 0.45);
/** 0 round the top landing and the way the boat goes, 1 far out, where the heaps tower up. */
float farOut(vec2 xz) {
  return smoothstep(90.0, 320.0, length(xz - uCalmAt.xy));
}
/** How high the heaps stand near the landing and the way, as a share of how high they stand far off. */
float nearHeap(float far) {
  return 0.45 + 0.55 * far;
}
/** Where the heaps gather: round clusters with open cloud between them. x how much, yz its slope. */
vec3 heapAt(vec2 p) {
  vec3 site = lobes(p / 80.0 + 11.3);
  vec3 m = vec3(site.x, site.yz / 80.0) * 0.65 + vnoiseGrad(p * 0.021 + 2.3) * vec3(0.35, 0.35 * 0.021, 0.35 * 0.021);
  float k = clamp((m.x - 0.3) / 0.18, 0.0, 1.0);
  return vec3(k * k * (3.0 - 2.0 * k), 6.0 * k * (1.0 - k) / 0.18 * m.yz);
}
/** The towers of a heap, rising from the calm cloud in round heads: x their height as a share of TOWER, yz slope. */
vec3 towers(vec2 p) {
  vec3 t = lobes(p / 32.0 + 3.9, 0.8);
  return vec3(t.x + 0.3, t.yz / 32.0);
}
/**
 * x the height of the cloud's top over the surface, yz its slope. calm is calmAt with its slope, and in w 0 right
 * along the way the boat goes, where the cloud lies smoother so the hull rides on it. detail scales the middle and
 * the big lobes and fine adds the smallest, for the light: the mesh further off is too coarse to carry them.
 * fold.x says how far down in a crease between lobes the point is, fold.y how far up its heap it stands.
 */
vec3 cloudTop(vec2 xz, vec4 calm, vec2 detail, float fine, out vec2 fold) {
  vec2 p = xz + uCloudShift * 0.6;
  vec3 heap = heapAt(p);
  float rise = heap.x * calm.x;
  vec2 dRise = heap.yz * calm.x + heap.x * calm.yz;
  float far = farOut(xz);
  vec3 tower = towers(p);
  // Near, the heaps are low mounds, so the cloud lies open all round; the towers stand far off.
  float stand = RISE * (0.6 + 1.2 * far);
  float lift = TOWER * (0.2 + 1.1 * far);
  vec3 big = lobes(p / 17.0 + 5.3, rise * 0.7);
  vec3 mid = lobes(p / 6.5 + 1.7, rise * 0.7);
  float stature = nearHeap(far);
  float aTower = lift * rise * stature;
  float even = 0.4 + 0.6 * calm.w;
  float aBig = (BIG.x * even + BIG.y * rise * stature) * detail.y;
  float aMid = (MID.x * even + MID.y * rise * stature) * detail.x;
  dRise *= stature;
  vec3 h = vec3(rise * stature, dRise) * stand
    + vec3(tower.x * aTower, tower.yz * aTower + tower.x * lift * dRise)
    + vec3(big.x * aBig, big.yz / 17.0 * aBig + big.x * BIG.y * detail.y * dRise)
    + vec3(mid.x * aMid, mid.yz / 6.5 * aMid + mid.x * MID.y * detail.x * dRise)
    + vec3(0.2 * (1.0 - calm.w), 0.0, 0.0);
  float crease = (1.0 - smoothstep(0.2, 0.8, tower.x)) * rise * 0.6
    + (1.0 - smoothstep(0.0, 0.5, big.x)) * (0.3 + 0.4 * rise) + (1.0 - smoothstep(0.0, 0.45, mid.x)) * 0.6;
  float crown = mix(1.0, clamp(h.x / max((stand + lift * 1.1) * stature + aBig * 0.8, 0.5), 0.0, 1.0), rise);
  if (fine > 0.0) {
    vec3 s = lobes(p / 2.4 + 7.7, rise);
    float aFine = FINE.x * even + FINE.y * rise * stature;
    h += vec3(s.x * aFine, s.yz / 2.4 * aFine);
    crease += (1.0 - smoothstep(0.0, 0.4, s.x)) * 0.3;
  }
  fold = vec2(clamp(crease, 0.0, 1.0), crown);
  // Its creases never dip below the top of the deck, or what stands just inside the cloud would show through them.
  float below = h.x - 0.1;
  float soft = sqrt(below * below + 0.02);
  h = vec3(0.1 + 0.5 * (below + soft), h.yz * 0.5 * (1.0 + below / soft));
  return h - furrow(xz) * 0.6;
}
/** How far the heaps between a point and the low sun keep the light off it: their long shadows across the cloud. */
float heapShade(vec2 xz, float h) {
  vec2 toSun = normalize(uSunDir.xz + 1e-5);
  float climb = max(uSunDir.y, 0.02) / max(length(uSunDir.xz), 1e-3);
  vec2 drift = uCloudShift * 0.6;
  float shade = 0.0;
  for (int i = 1; i <= 6; i++) {
    float t = 2.5 + 1.6 * float(i * i);
    vec2 q = xz + toSun * t;
    float far = farOut(q);
    float rise = heapAt(q + drift).x * calmAt(q) * nearHeap(far);
    float stands = rise * (RISE * (0.6 + 1.2 * far) + TOWER * (0.2 + 1.1 * far) * towers(q + drift).x)
      + (BIG.x + BIG.y * rise) * 0.45;
    float over = stands - h - t * climb;
    shade = max(shade, smoothstep(0.0, 1.5 + t * 0.04, over));
  }
  return shade;
}`;

/**
 * The underside of the cloud seen from below: bellies hanging out of it and soft cells across it, lilac in their
 * hollows and lit gold and rose where the low sun reaches in under the edge of the deck. Flat and high round the
 * stair, so it goes up into the white through a level ceiling and there is room under it to work on the loose
 * flights; further off it breaks up into separate clouds with the sky between them, their thin edges lit through.
 */
const BELLY_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform vec2 uStairAt;
out vec3 vWorld;
out float vRing;
BELLY
void main() {
  vec2 xz = position.xz + uCentre;
  vRing = length(position.xz);
  vWorld = vec3(xz.x, uCloudDeckY.x + 0.6 - belly(xz, deckCover(xz)), xz.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const BELLY_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec2 uCentre;
uniform vec3 uCalmAt;
uniform vec2 uStairAt;
uniform float uReach;
in vec3 vWorld;
in float vRing;
BELLY
void main() {
  if (vRing > uReach) discard;
  vec2 xz = vWorld.xz;
  float cover = deckCover(xz);
  vec2 toSun = normalize(uSunDir.xz + 1e-5);
  // Seen from below the cloud is darker the thicker it is: lilac and violet in the bodies of its cells, lighter in
  // the thin seams between them. The low sun reaches in sideways through whatever is thin between it and a
  // point, so each cell is lit gold along the side it faces the sun from, and more so far off toward the sun.
  float thick = bellyThick(xz, 1.0) * smoothstep(0.1, 0.9, cover);
  float before = bellyThick(xz + toSun * 6.0, 0.0) * smoothstep(0.1, 0.9, deckCover(xz + toSun * 6.0));
  float thin = 1.0 - smoothstep(0.2, 0.75, cover);
  vec3 col = deckUnderside(xz, cameraPosition, thin);
  vec2 away = xz - cameraPosition.xz;
  float reach = length(away);
  float sunward = reach > 1.0 ? max(0.0, dot(away / reach, toSun)) : 0.0;
  float far = smoothstep(20.0, 300.0, reach);
  float sunIn = exp(-2.6 * before) * (1.0 - 0.6 * thick);
  col *= mix(1.25, 0.72, thick);
  col += uSkyAmbient * vec3(0.05, 0.0, 0.12) * thick;
  col += uSkyHorizonSun * sunIn * (0.16 + 0.4 * sunward * far + 0.12 * far);
  float edge = 1.0 - smoothstep(0.55, 0.98, length(xz - uCloudDeck.xy) / uCloudDeck.z);
  // Seen from just under it, a ceiling is a line; the fringe of the deck takes over there.
  float under = smoothstep(1.0, 4.5, uCloudDeckY.x - cameraPosition.y);
  float there = smoothstep(0.08, 0.4, cover);
  gl_FragColor = vec4(applyFog(col, vWorld), uCloudDeck.w * edge * under * there);
}`;

/**
 * The underside's shape: big rounded bellies with smaller ones across them, shallow over the stair and hanging
 * deeper in the open, drawn up into the cloud at the thin edges where it breaks apart, and a belly of its own
 * round the stair, which goes up into it.
 */
const BELLY_GLSL = /* glsl */ `
${LOBES_GLSL}
/** 0 over the stair and the room round it, 1 out in the open. */
float bellyOpen(vec2 xz) {
  return smoothstep(uCalmAt.z * 0.45, uCalmAt.z, length(xz - uCalmAt.xy));
}
float edgeLift(float cover) {
  return (1.0 - smoothstep(0.15, 0.85, cover)) * 2.2;
}
/** How far the underside hangs below the base. */
float belly(vec2 xz, float cover) {
  vec2 p = xz + uCloudShift * 0.5;
  float open = bellyOpen(xz);
  float h = lobes(p / 26.0 + 2.3).x * (0.6 + 3.8 * open) + lobes(p / 9.0 + 7.1).x * (0.4 + 0.8 * open);
  vec2 fromStair = xz - uStairAt;
  float swallow = 2.8 * exp(-dot(fromStair, fromStair) / 60.0) * (0.85 + 0.3 * vnoise(xz * 0.5 + uTime * 0.05));
  return h * smoothstep(0.15, 0.85, cover) - edgeLift(cover) + swallow;
}
/** How thick the underside is at a point: 0 in the seams between its cells, 1 in the middle of one. */
float bellyThick(vec2 xz, float fine) {
  vec2 p = xz + uCloudShift * 0.5;
  float cells = lobes(p / 26.0 + 2.3).x * 0.4 + lobes(p / 9.0 + 7.1).x * 0.4;
  cells += fine > 0.0 ? lobes(p / 3.6 + 4.4).x * 0.2 : 0.07;
  return smoothstep(0.12, 0.5, cells);
}`;

/**
 * The cloud deck as the stairs room sees it from outside: its underside hanging over the island, heavy and lit by
 * the low sun, and its top lying to the horizon under the sunset with a furrow where the hull has been. Inside it,
 * the shared analytic deck in the fog takes over.
 */
export class StairsCloud {
  readonly group = new THREE.Group();
  readonly top: THREE.Mesh;
  readonly belly: THREE.Mesh;
  readonly wake = new CloudWake();
  private readonly topUniforms: { uCentre: { value: THREE.Vector2 }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number };
    uRoute: { value: THREE.Vector2[] }; uTrail: { value: THREE.Vector4[] }; uHole: { value: number }; uSurface: { value: number } };
  private readonly bellyUniforms: { uCentre: { value: THREE.Vector2 }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number }; uStairAt: { value: THREE.Vector2 } };
  /** The furrow behind the hull: where it has been, newest first, and how fresh each point is. */
  private readonly trail: THREE.Vector4[] = Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector4(0, 0, 0, 0));
  private trailFrom = new THREE.Vector2(1e5, 1e5);

  constructor() {
    this.group.name = 'stairs-cloud';
    this.topUniforms = {
      uCentre: { value: new THREE.Vector2(STAIRS_ISLE.x, STAIRS_ISLE.z) },
      uCalmAt: { value: new THREE.Vector3(CLOUD_BERTH.x, CLOUD_BERTH.z, 45) },
      uReach: { value: 1500 },
      uRoute: { value: [new THREE.Vector2(CLOUD_BERTH.x, CLOUD_BERTH.z), ...CLOUD_ROUTE.map(p => p.clone()), DESCENT_END.clone()] },
      uTrail: { value: this.trail },
      uHole: { value: 1 },
      // The surface stays where the cloud's top is, even while the deck swells above it into fog.
      uSurface: { value: CLOUD.top },
    };
    this.group.add(this.wake.mesh);
    const rings = 200, spokes = 240, reach = 1500;
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
    const disc = new THREE.BufferGeometry();
    disc.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    disc.setIndex(index);
    this.top = new THREE.Mesh(disc, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...this.topUniforms },
      vertexShader: TOP_VERT.replace('TOP', TOP_GLSL),
      fragmentShader: TOP_FRAG.replace('TOP', TOP_GLSL),
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    }));
    this.top.name = 'cloud-deck-top';
    this.top.frustumCulled = false;
    this.top.renderOrder = -2;
    this.top.visible = false;
    this.group.add(this.top);

    this.bellyUniforms = {
      uCentre: { value: new THREE.Vector2(STAIRS_ISLE.x, STAIRS_ISLE.z) },
      uCalmAt: { value: new THREE.Vector3(flight(BELOW_CLOUD).bottom.x, flight(BELOW_CLOUD).bottom.z + 8, 55) },
      uReach: { value: 1500 },
      uStairAt: { value: new THREE.Vector2(flight(BELOW_CLOUD + 1).landing.x, flight(BELOW_CLOUD + 1).landing.z) },
    };
    this.belly = new THREE.Mesh(disc, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...this.bellyUniforms },
      vertexShader: BELLY_VERT.replace('BELLY', BELLY_GLSL),
      fragmentShader: BELLY_FRAG.replace('BELLY', BELLY_GLSL),
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    }));
    this.belly.name = 'cloud-deck-belly';
    this.belly.frustumCulled = false;
    this.belly.renderOrder = -2;
    this.belly.visible = false;
    this.group.add(this.belly);
  }

  /**
   * The hull going through the top of the cloud: it leaves a furrow that closes up behind it, and throws up puffs
   * at the bow and off the quarters that curl away and thin out. `hull` is null when it is not on the cloud.
   */
  sailing(hull: { position: THREE.Vector3; yaw: number; speed: number } | null, dt: number): void {
    for (const t of this.trail) t.z = Math.max(0, t.z - dt / 14);
    this.wake.emit(hull, dt);
    if (!hull) return;
    const p = hull.position;
    if (Math.hypot(p.x - this.trailFrom.x, p.z - this.trailFrom.y) > 1.3) {
      for (let i = TRAIL_POINTS - 1; i > 0; i--) this.trail[i].copy(this.trail[i - 1]);
      this.trailFrom.set(p.x, p.z);
    }
    this.trail[0].set(p.x, p.z, Math.min(1, hull.speed / 2.5), 0);
  }

  update(dt: number, camera: THREE.Camera): void {
    const deck = atmo.uniforms.uCloudDeck.value;
    this.top.visible = deck.w > 0.01 && camera.position.y > CLOUD.top - 0.4;
    this.topUniforms.uCentre.value.set(Math.round(camera.position.x / 8) * 8, Math.round(camera.position.z / 8) * 8);
    this.wake.update(dt);
    this.belly.visible = deck.w > 0.01 && camera.position.y < atmo.uniforms.uCloudDeckY.value.x - 1;
    this.bellyUniforms.uCentre.value.copy(this.topUniforms.uCentre.value);
  }

  /** Whether the pocket round a climber opens a hole in the top of the cloud; not while the cloud is swelling up round a hull. */
  set hole(open: boolean) {
    this.topUniforms.uHole.value = open ? 1 : 0;
  }
}

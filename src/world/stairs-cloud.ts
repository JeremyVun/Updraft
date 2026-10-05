import * as THREE from 'three';
import { ATMO_GLSL, NOISE_GRAD_GLSL, atmo } from './atmosphere';
import { glsl, tuning } from '../tuning';
import { fixInPlace } from '../gl/fixed';
import { CloudWake } from './stairs-wake';
import { BEAM, LENGTH } from '../traveller/boat/form';
import { VAPOUR_GLSL } from './cloud-vapour';
import { CloudTowers, TOWER_FOOT } from './cloud-towers';
import { CloudLobes, LOBES_TEXTURE_GLSL } from './cloud-lobes';
import { CLOUD_GRID_FRAG, CLOUD_GRID_VERT, cloudGridGeometry, placeCloudGrid, placeView } from './cloud-grid';
import { BELOW_CLOUD, CLOUD, CLOUD_BERTH, CLOUD_ROUTE, RUN_YAW, TOWER_GATE, flight } from './stairs-layout';

/** The heaps' dome and towers far out, and the big, middle and fine lobes on the open cloud and on a heap, in metres. */
const SHAPE = { heap: 2.5, tower: 3.5, big: [2.6, 2.0], mid: [2.0, 1.8], fine: [1.3, 0.8] } as const;

/** How many points of the boat's way over the cloud, and of the fresh parting behind the hull, the cloud's top is told about. */
const ROUTE_POINTS = CLOUD_ROUTE.length + 1;
const TRAIL_POINTS = 16;
/** How deep the layer the low wisps stream in lies over the tops, metres. */
const WISP_LAYER = 4;
/** How many towers of cumulus the top of the cloud makes room for. */
const FEET = 16;

/** The top of the cloud as a surface: heaped up and lit gold on the sunward side, white in its folds. */
const TOP_VERT = /* glsl */ `
#define LOBES_VERTEX
${ATMO_GLSL}
${NOISE_GRAD_GLSL}
${LOBES_TEXTURE_GLSL}
${CLOUD_GRID_VERT}
uniform vec3 uCalmAt;
uniform vec2 uRoute[${ROUTE_POINTS}];
uniform vec4 uTrail[${TRAIL_POINTS}];
uniform vec4 uGate;
uniform float uSurface;
uniform float uRise;
out vec3 vWorld;
out float vRing;
out vec4 vCalm;
out float vStature;
out float vShade;
out vec4 vFog;
out vec4 vHaze;
out float vThin;
out vec3 vFoot;
out vec3 vRise;
out vec3 vTower;
flat out float vLevel;
TOP
void main() {
  if (gridUnseen(uSurface - 0.5, uSurface + uRise)) {
    gl_Position = unseen(uSurface - 0.5);
    return;
  }
  float spacing;
  vec2 xz = gridPlace(spacing, vLevel);
  vRing = length(xz - cameraPosition.xz);
  float c = calmAt(xz);
  vec2 slope = vec2(calmAt(xz + vec2(1.5, 0.0)) - c, calmAt(xz + vec2(0.0, 1.5)) - c) / 1.5;
  float way = fromRoute(xz);
  vCalm = vec4(c, slope, smoothstep(2.5, 14.0, way));
  vStature = statureAt(xz, way);
  vec2 fold;
  vec2 p = xz + uCloudShift * 0.6;
  vRise = riseAt(xz, p + uDrift * DRIFT.x, vCalm, spacing);
  vTower = towers(p + uDrift * DRIFT.y, spacing);
  vec3 lobe;
  float foot = footAt(xz);
  vFoot = vec3(foot, footAt(xz + vec2(0.5, 0.0)) - foot, footAt(xz + vec2(0.0, 0.5)) - foot) * vec3(1.0, 2.0, 2.0);
  float h = cloudTop(xz, vCalm, vStature, vRise, vTower, spacing, fold, lobe).x + foot - parting(wakeAt(xz)).x;
  vShade = heapShade(xz, h, spacing);
  vWorld = vec3(xz.x, uSurface + h, xz.y);
  // Its own surface is not hidden by the deck it is the top of, only when the deck swells up over it; seen from
  // under it, from inside the cloud, the deck covers it like anything else in there.
  vFog = fogOf(cameraPosition.y < vWorld.y ? vWorld : vec3(vWorld.x, max(vWorld.y, uSurface + 0.05), vWorld.z));
  // How much cloud the sightline goes on through past here: little at a crest's edge, where the light comes
  // through and the edge frays; all of it on the open cloud, where the sightline goes on down into it. Measured
  // against the bulk under here, so what the finer lobes add to this point does not count as air.
  vec3 ray = normalize(vWorld - cameraPosition);
  float stride = clamp(length(vWorld - cameraPosition) * 0.02, 0.5, 14.0);
  float over = h - bulkAt(xz, vCalm, vStature);
  float through = 0.0;
  for (int i = 1; i <= 4; i++) {
    vec3 q = vWorld + ray * (stride * float(i * i) * 0.6);
    through += smoothstep(-0.4, 0.4, bulkAt(q.xz, vCalm, vStature) + over - (q.y - uSurface));
  }
  vThin = 1.0 - through * 0.25;
  // Far off it goes into the haze of the horizon beyond it, gold toward the sun and rose away from it.
  vec3 ahead = vWorld - cameraPosition;
  vHaze = vec4(skyColor(normalize(vec3(ahead.x, 0.01, ahead.z))), (1.0 - exp(-length(ahead) / 700.0)) * 0.72);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const TOP_FRAG = /* glsl */ `
${ATMO_GLSL}
${NOISE_GRAD_GLSL}
${VAPOUR_GLSL}
uniform float uWisps;
uniform vec2 uWispAir;
${LOBES_TEXTURE_GLSL}
${CLOUD_GRID_FRAG}
uniform vec3 uCalmAt;
uniform vec2 uRoute[${ROUTE_POINTS}];
uniform vec4 uTrail[${TRAIL_POINTS}];
uniform vec4 uGate;
uniform float uReach;
uniform float uHole;
uniform float uSurface;
uniform vec4 uHull;
uniform float uHullOn;
in vec3 vWorld;
in float vRing;
in vec4 vCalm;
in float vStature;
in float vShade;
in vec4 vFog;
in vec4 vHaze;
in float vThin;
in vec3 vFoot;
in vec3 vRise;
in vec3 vTower;
flat in float vLevel;
TOP
void main() {
  if (vRing > uReach || gridHidden(vWorld.xz, vLevel)) discard;
  vec2 xz = vWorld.xz;
  if (uCloudBubble.w > 0.0 && uHole > 0.5) {
    float hole = length(xz - uCloudBubble.xz) - uCloudBubble.w * (0.75 + 0.35 * vnoise(xz * 0.8 + uTime * 0.1));
    if (hole < 0.0 && uCloudBubble.y < uSurface + 0.5) discard;
  }
  // Never inside the hull lying in it: the boat's own planform (boat/form.ts), a hair inside its planking.
  if (uHullOn > 0.5) {
    vec2 d = xz - uHull.xy;
    float u = dot(d, uHull.zw) / ${glsl(LENGTH)} + 0.45;
    float across = abs(d.x * uHull.w - d.y * uHull.z);
    float k = clamp(u, 0.0, 1.0);
    float beam = ${glsl(BEAM)} * pow(1.0 - pow(k, 3.4), 0.72) * (0.52 + 0.48 * sin(k * 3.14159265));
    if (u > 0.0 && u < 1.0 && across < beam * 0.97) discard;
  }
  vec2 fold;
  vec3 lobe;
  vec3 top = cloudTop(xz, vCalm, vStature, vRise, vTower, 0.0, fold, lobe) + vFoot;
  Wake wake = wakeAt(xz);
  top -= parting(wake);
  // Either side of the parting the tops curl over and stream off in soft eddies, which spread and settle as it fills.
  float stir = wake.fresh * exp(-wake.d * wake.d / (5.0 + 8.0 * (1.0 - wake.fresh)));
  if (stir > 0.01) {
    vec2 q = vec2(wake.along * 0.55 + wake.d * 0.35, wake.d * 1.3 - (1.0 - wake.fresh) * 2.5 + uTime * 0.25);
    vec3 eddy = vnoiseGrad(q) + 0.5 * vnoiseGrad(q * 2.1 + 3.7);
    top.yz += (eddy.y * wake.off + eddy.z * vec2(-wake.off.y, wake.off.x)) * 0.7 * stir;
    lobe.z = mix(lobe.z, eddy.x * 0.7, stir);
  }
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 ray = -V;
  vec3 L = normalize(uSunDir);
  vec3 N = normalize(vec3(-top.y, 1.0, -top.z));
  // The broad light goes round a lobe on a smoother normal: light soaks into cloud rather than lying on it.
  vec3 soft = normalize(vec3(-top.y * 0.5, 1.0, -top.z * 0.5));
  float dist = length(vWorld - cameraPosition);
  float thin = vThin;
  // Each lobe is lit at its crown and goes into shade toward where it sits down among the others; so is each heap.
  float puff = mix(0.45, 1.0, lobe.x) * mix(0.6, 1.0, lobe.y) * mix(0.9, 1.0, lobe.z) * mix(0.7, 1.0, fold.y);
  // Lit from the side by the low sun, which the cloud scatters across its whole top: gold where the light lies
  // across it and on the lobes turned full to it, white and a little cool where they sit down among the others and
  // on the sides turned away.
  float facing = dot(N, L);
  float crown = smoothstep(0.5, 1.0, puff);
  // Light goes into cloud and comes out round the side: a wide, soft terminator.
  float wrapped = smoothstep(0.0, 1.0, (facing + 0.5 + 0.3 * (puff - 0.75)) / 1.3);
  float sunLit = wrapped * (1.0 - 0.8 * vShade);
  float full = smoothstep(0.2, 0.85, facing) * (1.0 - vShade) * crown;
  float toward = pow(max(0.0, dot(ray, L)), 3.0);
  vec3 gold = cloudGold();
  vec3 shade = cloudShade(smoothstep(0.3, 0.95, puff));
  // The light scattered on through the cloud warms its shade, most near its crowns.
  shade += gold * 0.06 * (0.4 + 0.6 * puff) * (1.0 - 0.5 * vShade);
  vec3 col = mix(shade, gold * vec3(0.72, 0.61, 0.47) + shade * 0.35, sunLit * mix(0.55, 1.0, crown));
  col += gold * vec3(1.0, 0.9, 0.7) * full * 0.35;
  // Against the low sun the thin edges and the crests glow: the silver lining.
  col += cloudGlow() * vec3(1.0, 0.92, 0.8) * toward * (1.0 - 0.6 * vShade) * (0.02 + 0.85 * thin * thin);
  // Down between the heaps far off the air thickens: the far valleys go into the haze while the crowns stand out of it.
  float low = 1.0 - smoothstep(0.0, 6.0, top.x);
  vec3 haze = mix(vec3(lumaOf(uSkyHorizon)), uSkyHorizon, 0.5) * 0.75;
  col = mix(col, haze, (1.0 - exp(-max(dist - 40.0, 0.0) / 300.0)) * low * 0.4);
  // The tops the hull has just turned over are fresh and catch the light.
  col = mix(col, vapourLight(vWorld, ray, 0.4), stir * 0.35);
  // Low wisps of vapour stream across the tops on the air: long thin streaks in a layer lying over them, thicker
  // the longer a sightline runs through it before it reaches the cloud.
  float veil = 0.0;
  if (uWisps > 0.0 && vWorld.y < uSurface + ${glsl(WISP_LAYER)}) {
    // The stretch of the sightline inside the layer, up to where it reaches the cloud here.
    float above = cameraPosition.y - (uSurface + ${glsl(WISP_LAYER)});
    float enter = above <= 0.0 ? 0.0 : ray.y < -1e-3 ? above / -ray.y : 1e6;
    float path = clamp(dist - enter, 0.0, 160.0);
    vec2 across = vec2(-uWispAir.y, uWispAir.x);
    for (int i = 0; i < 3; i++) {
      vec2 q = xz - ray.xz * path * (0.15 + 0.35 * float(i)) - uWispAir * uTime * ${glsl(tuning.stairs.wispSpeed)};
      vec2 w = vec2(dot(q, uWispAir) / 70.0, dot(q, across) / 9.0);
      float streak = lobesT(w + 3.1, 0.0, 0.0).x * 0.7 + lobesT(w * vec2(2.3, 1.7) + 8.7, 0.0, 0.0).x * 0.3;
      veil += smoothstep(0.42, 0.78, streak);
    }
    veil = (1.0 - exp(-veil / 3.0 * path * 0.03)) * uWisps;
  }
  col = mix(col, vapourLight(vWorld, ray, 0.6), veil * 0.65);
  col = mix(col, vHaze.rgb, vHaze.a);
  col = mix(col, vFog.rgb, vFog.a);
  float edge = mix(1.0, smoothstep(0.0, 0.75, 1.0 - thin + 0.25 * vnoise(xz * 0.9 + uTime * 0.2)), smoothstep(0.35, 0.9, thin));
  // At the end of its reach it thins into the deck beyond, rather than stopping along a line.
  edge *= 1.0 - smoothstep(uReach * 0.7, uReach, vRing);
  gl_FragColor = vec4(col, uCloudDeck.w * edge);
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
 * The top of the cloud: a sea of round puffs of three sizes on low rolling heaps, with soft creases where they meet,
 * each size drifting at its own pace so the tops seem to roll. Low and gentle round the top landing and all along
 * the way the boat goes; swelling up round the feet of the towers; and where the hull has just been, a soft parting
 * that fills in again behind it.
 */
const TOP_GLSL = /* glsl */ `
uniform vec2 uDrift;
uniform vec4 uFeet[${FEET}];
/** How far the sea swells up round the foot of a tower of cumulus (as the tower's own shader has it), metres. */
float footAt(vec2 xz) {
  float f = 0.0;
  for (int i = 0; i < ${FEET}; i++) {
    float k = 1.0 - smoothstep(uFeet[i].z * ${glsl(TOWER_FOOT.in)}, uFeet[i].z * ${glsl(TOWER_FOOT.out)}, length(xz - uFeet[i].xy));
    f = max(f, uFeet[i].w * uFeet[i].z * ${glsl(TOWER_FOOT.rise)} * k * k * (3.0 - 2.0 * k));
  }
  return f;
}
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
/** 1 along the stretch of the way where the towers crowd in close either side of it, 0 elsewhere. */
float gateAt(vec2 xz) {
  vec2 ab = uGate.zw - uGate.xy;
  float t = clamp(dot(xz - uGate.xy, ab) / dot(ab, ab), 0.0, 1.0);
  return (1.0 - smoothstep(20.0, 60.0, length(xz - uGate.xy - ab * t))) * smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.75, 1.0, t));
}
/** 0 round the top landing and along the way, 1 out in the open where the heaps are. */
float calmAt(vec2 xz) {
  float g = gateAt(xz);
  // Its edge wanders, so the heaps come in toward the way here and stand back from it there.
  float wander = (vnoise(xz * 0.03 + 4.1) - 0.5) * 16.0;
  return min(smoothstep(uCalmAt.z * 0.35, uCalmAt.z, length(xz - uCalmAt.xy)), smoothstep(4.0 - g, 30.0 - 14.0 * g, fromRoute(xz) + wander * (1.0 - g)));
}
uniform vec4 uTrailBounds;
/** Where a point is from the hull's fresh way: how far off it (d), how far along it, how fresh, and which way off it. */
struct Wake { float d; float along; float fresh; vec2 off; };
Wake wakeAt(vec2 p) {
  Wake w = Wake(1e5, 0.0, 0.0, vec2(0.0, 1.0));
  if (uTrailBounds.w <= 0.0 || length(p - uTrailBounds.xy) > uTrailBounds.z) return w;
  float near = 1e10;
  for (int i = 0; i < ${TRAIL_POINTS - 1}; i++) {
    vec4 a = uTrail[i];
    vec4 b = uTrail[i + 1];
    vec2 ab = b.xy - a.xy;
    float t = clamp(dot(p - a.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    vec2 o = p - a.xy - ab * t;
    float f = mix(a.z, b.z, t);
    if (f > 0.0 && dot(o, o) < near) {
      near = dot(o, o);
      w.off = o;
      w.fresh = f;
      w.along = mix(a.w, b.w, t);
    }
  }
  w.d = sqrt(near);
  w.off /= max(w.d, 1e-3);
  return w;
}
/**
 * Where the hull has parted the tops: a soft trough, no lip, which spreads and fills in behind it as it grows
 * stale. x how deep, yz its slope.
 */
vec3 parting(Wake w) {
  if (w.fresh <= 0.0) return vec3(0.0);
  float width = 0.85 + 1.6 * (1.0 - w.fresh);
  float k = exp(-w.d * w.d / (2.0 * width * width));
  float deep = 0.28 * w.fresh * w.fresh * k;
  return vec3(deep, -deep * w.d / (width * width) * w.off);
}
/** How high a heap's dome stands, and the towers on it, far out; near the landing and the way they are lower. */
const float HEAP = ${glsl(SHAPE.heap)};
const float TOWER = ${glsl(SHAPE.tower)};
/** The big, middle and fine lobes: how high on the open cloud (x) and how much higher on a heap (y). */
const vec2 BIG = vec2(${glsl(SHAPE.big[0])}, ${glsl(SHAPE.big[1])});
const vec2 MID = vec2(${glsl(SHAPE.mid[0])}, ${glsl(SHAPE.mid[1])});
const vec2 FINE = vec2(${glsl(SHAPE.fine[0])}, ${glsl(SHAPE.fine[1])});
/** How fast each size of lobe drifts, as a share of uDrift: the small ones slide over the big, so the tops seem to roll. */
const vec4 DRIFT = vec4(0.35, 0.55, 0.75, 1.0);
/** 0 round the top landing and the way the boat goes, 1 far out, where the heaps tower up. */
float farOut(vec2 xz) {
  return max(smoothstep(60.0, 260.0, length(xz - uCalmAt.xy)), 0.75 * gateAt(xz));
}
/**
 * How tall the heaps stand here, as a share of how tall they stand far out: lower near the top landing, and lower
 * within a few tens of metres of the way, so a lens standing off the boat stays in the clear air over them.
 */
float statureAt(vec2 xz, float way) {
  return (0.5 + 0.5 * farOut(xz)) * mix(0.6, 1.0, smoothstep(25.0, 90.0, way));
}
/** Where the heaps gather, before the calm takes them down: x, and its slope. */
vec3 heapSite(vec2 p, float spacing) {
  vec3 site = lobesT(p / 80.0 + 11.3, 0.0, lobesLod(spacing, 80.0));
  return vec3(site.x, site.yz / 80.0) * 0.65 + vnoiseGrad(p * 0.021 + 2.3) * vec3(0.35, 0.35 * 0.021, 0.35 * 0.021);
}
/**
 * How much of a heap stands here, 0 to 1, and its slope: a dome, round at the top, not a table. The calm draws the
 * heaps down whole as they near the landing and the way, so they round off there rather than being cut.
 */
vec3 riseAt(vec2 xz, vec2 p, vec4 calm, float spacing) {
  vec3 site = heapSite(p, spacing);
  float g = gateAt(xz);
  float m = site.x + 0.1 * g - 0.5 * (1.0 - calm.x);
  float x = (m - 0.22) / 0.4;
  if (x <= 0.0) return vec3(0.0);
  if (x >= 1.0) return vec3(1.0, 0.0, 0.0);
  return vec3(x * x * (3.0 - 2.0 * x), 6.0 * x * (1.0 - x) / 0.4 * (site.yz + 0.5 * calm.yz));
}
/** The towers of a heap, round heads on its dome: x their height as a share of TOWER, yz its slope. */
vec3 towers(vec2 p, float spacing) {
  vec3 t = lobesT(p / 30.0 + 3.9, 0.8, lobesLod(spacing, 30.0));
  float below = t.x + 0.2;
  float soft = sqrt(below * below + 0.04);
  return vec3(0.5 * (below + soft), t.yz / 30.0 * 0.5 * (1.0 + below / soft));
}
/**
 * x the height of the cloud's top over the surface, yz its slope. calm is calmAt with its slope, and in w 0 right
 * along the way the boat goes, where the cloud lies smoother so the hull rides on it. spacing is how far apart the
 * mesh's points are here (0 for the light, per pixel), which says how smoothed each size of lobe must be.
 * lobe says how high up its own lobe the point is at each size (big, middle, fine), and fold.x how far down in a
 * crease between lobes, fold.y how far up its heap it stands.
 */
vec3 cloudTop(vec2 xz, vec4 calm, float stature, vec3 rise, vec3 tower, float spacing, out vec2 fold, out vec3 lobe) {
  vec2 p = xz + uCloudShift * 0.6;
  float heapH = HEAP * stature;
  float towerH = TOWER * stature * rise.x;
  // Lobes go down the steep flanks of a heap less than they stand on its top, or they hang down it in drapes.
  float even = 0.2 + 0.8 * calm.w;
  float aBig = (BIG.x * even + BIG.y * rise.x * stature);
  float aMid = (MID.x * even + MID.y * rise.x * stature);
  float aFine = FINE.x * (0.4 + 0.6 * calm.w) + FINE.y * rise.x;
  vec3 big = lobesT((p + uDrift * DRIFT.z) / 17.0 + 5.3, 0.3 + 0.4 * rise.x, lobesLod(spacing, 17.0));
  vec3 mid = lobesT((p + uDrift * DRIFT.w) / 6.5 + 1.7, 0.5 + 0.3 * rise.x, lobesLod(spacing, 6.5));
  vec3 fine = lobesT((p + uDrift * 1.25) / 2.4 + 7.7, 0.6 + 0.4 * rise.x, lobesLod(spacing, 2.4));
  vec3 h = vec3(rise.x * heapH, rise.yz * heapH)
    + vec3(tower.x * towerH, tower.yz * towerH + tower.x * TOWER * stature * rise.yz)
    + vec3((big.x - 0.25) * aBig, big.yz / 17.0 * aBig + (big.x - 0.25) * BIG.y * stature * rise.yz)
    + vec3((mid.x - 0.25) * aMid, mid.yz / 6.5 * aMid + (mid.x - 0.25) * MID.y * stature * rise.yz)
    + vec3((fine.x - 0.25) * aFine, fine.yz / 2.4 * aFine)
    + vec3(0.8 * (1.0 - calm.w), 0.0, 0.0);
  lobe = vec3(smoothstep(-0.15, 0.6, big.x), smoothstep(-0.1, 0.6, mid.x), smoothstep(-0.1, 0.6, fine.x));
  float crease = (1.0 - lobe.x) * (0.35 + 0.4 * rise.x) + (1.0 - lobe.y) * 0.45 + (1.0 - lobe.z) * 0.2
    + (1.0 - smoothstep(0.1, 0.6, tower.x)) * rise.x * 0.5;
  fold = vec2(clamp(crease, 0.0, 1.0), mix(1.0, clamp(h.x / max(heapH + towerH + aBig, 0.5), 0.0, 1.0), rise.x));
  // Its creases never dip below the top of the deck, or what stands just inside the cloud would show through them.
  float below = h.x - 0.1;
  float soft = sqrt(below * below + 0.02);
  h = vec3(0.1 + 0.5 * (below + soft), h.yz * 0.5 * (1.0 + below / soft));
  return h;
}
/** The height of the heaps, towers and big lobes alone: what a sightline passes through. */
float bulkAt(vec2 xz, vec4 calm, float stature) {
  vec2 p = xz + uCloudShift * 0.6;
  vec2 hp = p + uDrift * DRIFT.x;
  float m = lobesT(hp / 80.0 + 11.3, 0.0, 0.0).x * 0.65 + 0.175 + 0.1 * gateAt(xz) - 0.5 * (1.0 - calm.x);
  float x = clamp((m - 0.22) / 0.4, 0.0, 1.0);
  float rise = x * x * (3.0 - 2.0 * x);
  float big = lobesT((p + uDrift * DRIFT.z) / 17.0 + 5.3, 0.3 + 0.4 * rise, 0.0).x;
  return footAt(xz) + rise * stature * (HEAP + TOWER * towers(p + uDrift * DRIFT.y, 0.0).x)
    + (big - 0.25) * (BIG.x * (0.2 + 0.8 * calm.w) + BIG.y * rise * stature) + 0.25;
}
/** How far the heaps between a point and the low sun keep the light off it: their long shadows across the cloud. */
float heapShade(vec2 xz, float h, float spacing) {
  vec2 toSun = normalize(uSunDir.xz + 1e-5);
  float climb = max(uSunDir.y, 0.02) / max(length(uSunDir.xz), 1e-3);
  vec2 drift = uCloudShift * 0.6;
  float shade = 0.0;
  for (int i = 1; i <= 6; i++) {
    float t = 2.5 + 1.6 * float(i * i);
    vec2 q = xz + toSun * t;
    float c = calmAt(q);
    float rise = riseAt(q, q + drift + uDrift * DRIFT.x, vec4(c, 0.0, 0.0, 1.0), spacing).x;
    float stature = statureAt(q, fromRoute(q));
    float stands = rise * stature * (HEAP + TOWER * towers(q + drift + uDrift * DRIFT.y, spacing).x) + (BIG.x + BIG.y * rise) * 0.45;
    float over = stands - h - t * climb;
    shade = max(shade, smoothstep(0.0, 1.5 + t * 0.04, over));
  }
  return shade;
}`;

/**
 * The underside of the cloud seen from below: bellies hanging out of it and soft cells across it, grey in their
 * hollows and lit gold where the low sun reaches in under the edge of the deck. Flat and high round the
 * stair, so it goes up into the white through a level ceiling and there is room under it to work on the loose
 * flights; further off it breaks up into separate clouds with the sky between them, their thin edges lit through.
 */
const BELLY_VERT = /* glsl */ `
${ATMO_GLSL}
${CLOUD_GRID_VERT}
uniform vec3 uCalmAt;
uniform vec2 uStairAt;
out vec3 vWorld;
out float vRing;
out float vBefore;
flat out float vLevel;
BELLY
void main() {
  if (gridUnseen(uCloudDeckY.x - 11.0, uCloudDeckY.x + 28.0)) {
    gl_Position = unseen(uCloudDeckY.x - 11.0);
    return;
  }
  float spacing;
  vec2 xz = gridPlace(spacing, vLevel);
  vRing = length(xz - cameraPosition.xz);
  vWorld = vec3(xz.x, uCloudDeckY.x + 0.6 - belly(xz, deckCover(xz)), xz.y);
  // How much cloud lies just sunward of here changes slowly across the underside, so it is found per vertex.
  vec2 sunward = xz + normalize(uSunDir.xz + 1e-5) * 6.0;
  vBefore = bellyThick(sunward, 0.0) * smoothstep(0.1, 0.9, deckCover(sunward));
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const BELLY_FRAG = /* glsl */ `
${ATMO_GLSL}
${CLOUD_GRID_FRAG}
uniform vec3 uCalmAt;
uniform vec2 uStairAt;
uniform float uReach;
in vec3 vWorld;
in float vRing;
in float vBefore;
flat in float vLevel;
BELLY
void main() {
  if (vRing > uReach || gridHidden(vWorld.xz, vLevel)) discard;
  vec2 xz = vWorld.xz;
  float cover = deckCover(xz);
  vec2 toSun = normalize(uSunDir.xz + 1e-5);
  // Seen from below the cloud is darker the thicker it is: grey, a little cool, in the bodies of its cells, lighter in
  // the thin seams between them. The low sun reaches in sideways through whatever is thin between it and a
  // point, so each cell is lit gold along the side it faces the sun from, and more so far off toward the sun.
  float thick = bellyThick(xz, 1.0) * smoothstep(0.1, 0.9, cover);
  float before = vBefore;
  float thin = 1.0 - smoothstep(0.2, 0.75, cover);
  vec3 col = deckUnderside(xz, cameraPosition, thin);
  vec2 away = xz - cameraPosition.xz;
  float reach = length(away);
  float sunward = reach > 1.0 ? max(0.0, dot(away / reach, toSun)) : 0.0;
  float far = smoothstep(20.0, 300.0, reach);
  float sunIn = exp(-2.6 * before) * (1.0 - 0.6 * thick);
  col *= mix(1.25, 0.72, thick);
  col += lumaOf(uSkyAmbient) * vec3(0.0, 0.01, 0.04) * thick;
  col += mix(uSkyHorizonSun, cloudGold() * 0.6, 0.6) * sunIn * (0.16 + 0.4 * sunward * far + 0.12 * far);
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

function fract(x: number): number {
  return x - Math.floor(x);
}
function hash12(x: number, y: number): number {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = a;
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d;
  b += d;
  c += d;
  return fract((a + b) * c);
}
function vnoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash12(ix, iy), b = hash12(ix + 1, iy), c = hash12(ix, iy + 1), d = hash12(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** The height of the cloud's top as the shader finds it at its finest, for whatever floats on it. */
class TopShape {
  private readonly route: THREE.Vector2[];
  private readonly l = new THREE.Vector3();

  constructor(private readonly lobes: CloudLobes, route: THREE.Vector2[], private readonly gate: THREE.Vector4, private readonly calmAt: THREE.Vector3,
    private readonly feet: THREE.Vector4[]) {
    this.route = route;
  }

  private footAt(x: number, z: number): number {
    let f = 0;
    for (const t of this.feet) {
      const k = 1 - smooth(t.z * TOWER_FOOT.in, t.z * TOWER_FOOT.out, Math.hypot(x - t.x, z - t.y));
      f = Math.max(f, t.w * t.z * TOWER_FOOT.rise * k * k * (3 - 2 * k));
    }
    return f;
  }

  private fromRoute(x: number, z: number): number {
    let d = 1e5;
    for (let i = 0; i < this.route.length - 1; i++) {
      const a = this.route[i], b = this.route[i + 1];
      const abx = b.x - a.x, abz = b.y - a.y;
      const t = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.y) * abz) / Math.max(abx * abx + abz * abz, 1e-4), 0, 1);
      d = Math.min(d, Math.hypot(x - a.x - abx * t, z - a.y - abz * t));
    }
    return d;
  }

  private gateAt(x: number, z: number): number {
    const g = this.gate, abx = g.z - g.x, abz = g.w - g.y;
    const t = THREE.MathUtils.clamp(((x - g.x) * abx + (z - g.y) * abz) / (abx * abx + abz * abz), 0, 1);
    return (1 - smooth(20, 60, Math.hypot(x - g.x - abx * t, z - g.y - abz * t))) * smooth(0, 0.25, t) * (1 - smooth(0.75, 1, t));
  }

  private lobe(px: number, pz: number, full: number): number {
    return this.lobes.at(px, pz, full, this.l).x;
  }

  /** Height over the surface at (x, z), with the tops drifted by `drift` and shifted by the sky's `shift`. */
  heightAt(x: number, z: number, drift: THREE.Vector2, shift: THREE.Vector2): number {
    const g = this.gateAt(x, z);
    const way = this.fromRoute(x, z);
    const wander = (vnoise(x * 0.03 + 4.1, z * 0.03 + 4.1) - 0.5) * 16;
    const c = this.calmAt;
    const calm = Math.min(smooth(c.z * 0.35, c.z, Math.hypot(x - c.x, z - c.y)), smooth(4 - g, 30 - 14 * g, way + wander * (1 - g)));
    const even = 0.2 + 0.8 * smooth(2.5, 14, way);
    const far = Math.max(smooth(60, 260, Math.hypot(x - c.x, z - c.y)), 0.75 * g);
    const stature = (0.5 + 0.5 * far) * THREE.MathUtils.lerp(0.6, 1, smooth(25, 90, way));
    const px = x + shift.x * 0.6, pz = z + shift.y * 0.6;
    const hx = px + drift.x * 0.35, hz = pz + drift.y * 0.35;
    const site = this.lobe(hx / 80 + 11.3, hz / 80 + 11.3, 0) * 0.65 + vnoise(hx * 0.021 + 2.3, hz * 0.021 + 2.3) * 0.35;
    const m = (site + 0.1 * g - 0.5 * (1 - calm) - 0.22) / 0.4;
    const rise = m <= 0 ? 0 : m >= 1 ? 1 : m * m * (3 - 2 * m);
    const tb = this.lobe((px + drift.x * 0.55) / 30 + 3.9, (pz + drift.y * 0.55) / 30 + 3.9, 0.8) + 0.2;
    const tower = 0.5 * (tb + Math.sqrt(tb * tb + 0.04));
    const big = this.lobe((px + drift.x * 0.75) / 17 + 5.3, (pz + drift.y * 0.75) / 17 + 5.3, 0.3 + 0.4 * rise);
    const mid = this.lobe((px + drift.x) / 6.5 + 1.7, (pz + drift.y) / 6.5 + 1.7, 0.5 + 0.3 * rise);
    const fine = this.lobe((px + drift.x * 1.25) / 2.4 + 7.7, (pz + drift.y * 1.25) / 2.4 + 7.7, 0.6 + 0.4 * rise);
    const h = rise * SHAPE.heap * stature + tower * SHAPE.tower * stature * rise
      + (big - 0.25) * (SHAPE.big[0] * even + SHAPE.big[1] * rise * stature)
      + (mid - 0.25) * (SHAPE.mid[0] * even + SHAPE.mid[1] * rise * stature)
      + (fine - 0.25) * (SHAPE.fine[0] * (0.4 + 0.6 * smooth(2.5, 14, way)) + SHAPE.fine[1] * rise)
      + 0.8 * (1 - smooth(2.5, 14, way));
    const below = h - 0.1;
    return 0.1 + 0.5 * (below + Math.sqrt(below * below + 0.02)) + this.footAt(x, z);
  }
}

/**
 * The bank of mist the boat sails into at the end of the way over the cloud, and which is still round it on the
 * sea until it sails out of the back of it. The story asks for it every frame it wants it; left alone it thins away.
 */
export class FogBank {
  /** A point on its front, and the way into it. */
  readonly at = new THREE.Vector2();
  readonly into = new THREE.Vector2(0, 1);
  floor = 0;
  top = 1;
  /** How far it goes on from its front to its back. */
  deep = 1e4;
  amount = 0;
  /** The light of its white, how brightly the sun glows through it, and how clear the pocket round the boat is. */
  readonly light = new THREE.Color(1, 1, 1);
  glow = 0;
  clear = 0;
  private asked = false;
  private shown = 0;

  ask(): this {
    this.asked = true;
    return this;
  }

  /** Lays its front across a point, facing the way into it. */
  face(x: number, z: number, yaw: number): void {
    this.at.set(x, z);
    this.into.set(Math.sin(yaw), Math.cos(yaw));
  }

  /** How far past its front line a point is. */
  depthOf(x: number, z: number): number {
    return (x - this.at.x) * this.into.x + (z - this.at.y) * this.into.y;
  }

  update(dt: number, eye: THREE.Vector3): void {
    this.shown = this.asked ? this.amount : this.shown * Math.exp(-dt * 0.8);
    if (this.shown < 0.002 && !this.asked) this.shown = 0;
    this.asked = false;
    const u = atmo.uniforms;
    u.uFogBank.value.set(this.at.x, this.at.y, this.into.x, this.into.y);
    u.uFogBankShape.value.set(this.floor, this.top, this.deep, this.shown);
    u.uFogBankLight.value.set(this.light.r, this.light.g, this.light.b, this.glow);
    // How far into the white the eye is: it goes along the way the boat goes, where the front is straight across it.
    const into = this.depthOf(eye.x, eye.z);
    const inside = THREE.MathUtils.clamp(into / tuning.stairs.bankFront, 0, 1) * THREE.MathUtils.clamp((this.deep - into) / tuning.stairs.bankBack, 0, 1);
    u.uFogBankEye.value.set(this.clear, eye.y > this.floor && eye.y < this.top ? inside * this.shown : 0);
  }
}

/**
 * The cloud deck as the stairs room sees it from outside: its underside hanging over the island, heavy and lit by
 * the low sun, and its top lying to the horizon under the sunset, drifting and rolling, with towers of cumulus
 * standing out of it along the way and wisps streaming across it. Inside it, the shared analytic deck in the fog
 * takes over. Both surfaces lie on one world-anchored mesh (`cloud-grid.ts`) over baked lobes (`cloud-lobes.ts`).
 */
/**
 * How high over its surface the top of the cloud can stand: every term of cloudTop at its greatest, with the lobes at
 * the most their bakes hold, and the swell round the tallest tower's foot.
 */
function topRise(lobes: CloudLobes, feet: THREE.Vector4[]): number {
  let most = -Infinity;
  for (const bake of [lobes.soft, lobes.full]) for (let i = 0; i < bake.length; i += 4) most = Math.max(most, bake[i]);
  most += 0.01;
  const lobe = Math.max(0, most - 0.25), s = SHAPE;
  const tallest = Math.max(...feet.map(f => f.w * f.z));
  return s.heap + s.tower * (Math.max(0, most + 0.2) + 0.1) + lobe * (s.big[0] + s.big[1] + s.mid[0] + s.mid[1] + s.fine[0] + s.fine[1])
    + 0.9 + tallest * TOWER_FOOT.rise;
}

export class StairsCloud {
  readonly group = new THREE.Group();
  readonly top: THREE.Mesh;
  readonly belly: THREE.Mesh;
  readonly wake = new CloudWake();
  /** How much of the low wisps streaming across the tops there is, 0 to 1. */
  wisps = 1;
  /** Towers of cumulus standing out of the sea along the way. */
  readonly towers = new CloudTowers(CLOUD_ROUTE, TOWER_GATE, new THREE.Vector2(CLOUD_BERTH.x, CLOUD_BERTH.z), CLOUD.top + 1);
  readonly fog = new FogBank();
  private readonly lobes = new CloudLobes();
  private readonly shape: TopShape;
  private readonly grid = cloudGridGeometry(0.5);
  private readonly topUniforms: { uGrid: { value: THREE.Vector4[] }; uDrift: { value: THREE.Vector2 }; uLobesSoft: { value: THREE.Texture }; uLobesFull: { value: THREE.Texture }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number };
    uRoute: { value: THREE.Vector2[] }; uTrail: { value: THREE.Vector4[] }; uTrailBounds: { value: THREE.Vector4 }; uFeet: { value: THREE.Vector4[] }; uGate: { value: THREE.Vector4 }; uHole: { value: number }; uHull: { value: THREE.Vector4 }; uHullOn: { value: number }; uWisps: { value: number }; uWispAir: { value: THREE.Vector2 }; uSurface: { value: number }; uRise: { value: number }; uView: { value: THREE.Vector4[] }; uViewProjection: { value: THREE.Matrix4 } };
  private readonly bellyUniforms: { uGrid: { value: THREE.Vector4[] }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number }; uStairAt: { value: THREE.Vector2 }; uView: { value: THREE.Vector4[] }; uViewProjection: { value: THREE.Matrix4 } };
  /** The parting behind the hull: where its bow has been, newest first, how fresh each point is, and how far along. */
  private readonly trail: THREE.Vector4[] = Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector4(0, 0, 0, 0));
  private trailFrom = new THREE.Vector2(1e5, 1e5);
  private readonly view = { value: Array.from({ length: 6 }, () => new THREE.Vector4()) };
  private readonly viewProjection = { value: new THREE.Matrix4() };
  private trailAlong = 0;

  constructor() {
    this.group.name = 'stairs-cloud';
    this.topUniforms = {
      uGrid: { value: this.grid.levels },
      uDrift: { value: new THREE.Vector2() },
      uLobesSoft: { value: this.lobes.softTexture },
      uLobesFull: { value: this.lobes.fullTexture },
      uCalmAt: { value: new THREE.Vector3(CLOUD_BERTH.x, CLOUD_BERTH.z, 45) },
      uReach: { value: 1500 },
      uRoute: { value: [new THREE.Vector2(CLOUD_BERTH.x, CLOUD_BERTH.z), ...CLOUD_ROUTE.map(p => p.clone())] },
      uTrail: { value: this.trail },
      uTrailBounds: { value: new THREE.Vector4() },
      uFeet: { value: Array.from({ length: FEET }, () => new THREE.Vector4()) },
      uGate: { value: new THREE.Vector4(TOWER_GATE.from.x, TOWER_GATE.from.y, TOWER_GATE.to.x, TOWER_GATE.to.y) },
      uHole: { value: 1 },
      uHull: { value: new THREE.Vector4() },
      uHullOn: { value: 0 },
      uWisps: { value: 1 },
      uWispAir: { value: new THREE.Vector2(1, 0) },
      // The surface stays where the cloud's top is, even while the deck swells above it into fog.
      uSurface: { value: CLOUD.top },
      uRise: { value: 0 },
      uView: this.view,
      uViewProjection: this.viewProjection,
    };
    this.shape = new TopShape(this.lobes, this.topUniforms.uRoute.value, this.topUniforms.uGate.value, this.topUniforms.uCalmAt.value, this.topUniforms.uFeet.value);
    this.group.add(this.wake.mesh);
    this.group.add(this.towers.group);
    this.towers.feet(this.topUniforms.uFeet.value);
    this.topUniforms.uRise.value = topRise(this.lobes, this.topUniforms.uFeet.value);
    const ground = (x: number, z: number) => this.surfaceAt(x, z);
    this.wake.groundAt = ground;
    const disc = this.grid.geometry;
    this.top = new THREE.Mesh(disc, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...this.topUniforms },
      vertexShader: TOP_VERT.replace('TOP', TOP_GLSL),
      fragmentShader: TOP_FRAG.replace('TOP', TOP_GLSL),
      side: THREE.DoubleSide,
      transparent: true,
    }));
    this.top.name = 'cloud-deck-top';
    this.top.frustumCulled = false;
    this.top.renderOrder = -2;
    this.top.visible = false;
    this.group.add(this.top);

    this.bellyUniforms = {
      uGrid: { value: this.grid.levels },
      uCalmAt: { value: new THREE.Vector3(flight(BELOW_CLOUD).bottom.x, flight(BELOW_CLOUD).bottom.z + 8, 55) },
      uReach: { value: 1500 },
      uStairAt: { value: new THREE.Vector2(flight(BELOW_CLOUD + 1).landing.x, flight(BELOW_CLOUD + 1).landing.z) },
      uView: this.view,
      uViewProjection: this.viewProjection,
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
    fixInPlace(this.group, this.wake.mesh, this.top, this.belly);
    // Only the points of the grid round which something may be in view are worked out, in each view that draws it.
    this.top.onBeforeRender = this.belly.onBeforeRender = (_r, _s, camera) => placeView(this.view.value, this.viewProjection.value, camera);
  }

  /**
   * The hull going through the top of the cloud: it parts the tops, which curl off either side and fill in again
   * behind it, and a breath of vapour lifts off the stern. `hull` is null when it is not on the cloud.
   */
  sailing(hull: { position: THREE.Vector3; yaw: number; speed: number } | null, dt: number): void {
    for (const t of this.trail) t.z = Math.max(0, t.z - dt / tuning.stairs.partingFills);
    this.wake.emit(hull, dt);
    if (hull) {
      // The parting runs back from the bow, where the hull first shoulders the tops aside.
      const x = hull.position.x + Math.sin(hull.yaw) * 1.8, z = hull.position.z + Math.cos(hull.yaw) * 1.8;
      const moved = Math.hypot(x - this.trail[0].x, z - this.trail[0].y);
      this.trailAlong += Math.min(moved, 5);
      if (Math.hypot(x - this.trailFrom.x, z - this.trailFrom.y) > 2.5) {
        for (let i = TRAIL_POINTS - 1; i > 0; i--) this.trail[i].copy(this.trail[i - 1]);
        this.trailFrom.set(x, z);
      }
      this.trail[0].set(x, z, Math.min(1, hull.speed / 2.5), this.trailAlong);
    }
    const bounds = this.topUniforms.uTrailBounds.value.set(0, 0, 0, 0);
    let n = 0;
    for (const t of this.trail) if (t.z > 0) { bounds.x += t.x; bounds.y += t.y; n++; }
    if (n === 0) return;
    bounds.x /= n;
    bounds.y /= n;
    for (const t of this.trail) if (t.z > 0) bounds.z = Math.max(bounds.z, Math.hypot(t.x - bounds.x, t.y - bounds.y));
    bounds.z += 9;
    bounds.w = 1;
  }

  update(dt: number, camera: THREE.Camera): void {
    const deck = atmo.uniforms.uCloudDeck.value;
    this.top.visible = deck.w > 0.01 && camera.position.y > CLOUD.top - 0.4;
    placeCloudGrid(this.grid.levels, camera.position);
    // The air over the cloud goes the way the boat does, a little across it, and carries the tops with it.
    const airX = Math.sin(RUN_YAW + 0.5), airZ = Math.cos(RUN_YAW + 0.5);
    const drift = tuning.stairs.cloudDrift * dt;
    this.topUniforms.uDrift.value.x -= airX * drift;
    this.topUniforms.uDrift.value.y -= airZ * drift;
    this.wake.setWind(airX * tuning.stairs.wispSpeed * 0.5, airZ * tuning.stairs.wispSpeed * 0.5);
    this.topUniforms.uWispAir.value.set(airX, airZ);
    this.topUniforms.uWisps.value = this.wisps;
    this.towers.update(dt, this.top.visible && camera.position.y > CLOUD.top + 0.5);
    this.wake.update(dt);
    this.fog.update(dt, camera.position);
    this.belly.visible = deck.w > 0.01 && camera.position.y < atmo.uniforms.uCloudDeckY.value.x - 1;
  }

  /**
   * The height of the top of the cloud at (x, z) in the world, as it is drawn now (less the parting behind a hull):
   * low and gentle along the way, rising and falling on its lobes as they drift under a hull.
   */
  surfaceAt(x: number, z: number): number {
    return CLOUD.top + this.shape.heightAt(x, z, this.topUniforms.uDrift.value, atmo.uniforms.uCloudShift.value);
  }

  /** The hull lying in the cloud, whose inside its top keeps out of; null when there is none on it. */
  holdOut(hull: { group: THREE.Object3D; yaw: number } | null): void {
    const u = this.topUniforms;
    u.uHullOn.value = hull ? 1 : 0;
    if (hull) u.uHull.value.set(hull.group.position.x, hull.group.position.z, Math.sin(hull.yaw), Math.cos(hull.yaw));
  }

  /** Whether the pocket round a climber opens a hole in the top of the cloud; not while the cloud is swelling up round a hull. */
  set hole(open: boolean) {
    this.topUniforms.uHole.value = open ? 1 : 0;
  }
}

import * as THREE from 'three';
import { ATMO_GLSL, NOISE_GRAD_GLSL, atmo } from './atmosphere';
import { tuning } from '../tuning';
import { CloudWake } from './stairs-wake';
import { CloudLobes, LOBES_TEXTURE_GLSL } from './cloud-lobes';
import { CLOUD_GRID_FRAG, CLOUD_GRID_VERT, cloudGridGeometry, placeCloudGrid } from './cloud-grid';
import { BELOW_CLOUD, CLOUD, CLOUD_BERTH, CLOUD_ROUTE, RUN_YAW, TOWER_GATE, flight } from './stairs-layout';

/** How many points of the boat's way over the cloud, and of its fresh furrow, the cloud's top is told about. */
const ROUTE_POINTS = CLOUD_ROUTE.length + 1;
const TRAIL_POINTS = 16;

/** The top of the cloud as a surface: heaped up and lit gold on the sunward side, lilac in its folds. */
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
out vec3 vWorld;
out float vRing;
out vec4 vCalm;
out float vShade;
out vec4 vFog;
flat out float vLevel;
TOP
void main() {
  float spacing;
  vec2 xz = gridPlace(spacing, vLevel);
  vRing = length(xz - cameraPosition.xz);
  float c = calmAt(xz);
  vec2 slope = vec2(calmAt(xz + vec2(1.5, 0.0)) - c, calmAt(xz + vec2(0.0, 1.5)) - c) / 1.5;
  vCalm = vec4(c, slope, smoothstep(2.5, 10.0, fromRoute(xz)));
  vec2 fold;
  float h = cloudTop(xz, vCalm, spacing, fold).x;
  vShade = heapShade(xz, h, spacing);
  vWorld = vec3(xz.x, uSurface + h, xz.y);
  // Its own surface is not hidden by the deck it is the top of, only when the deck swells up over it; seen from
  // under it, from inside the cloud, the deck covers it like anything else in there.
  vFog = fogOf(cameraPosition.y < vWorld.y ? vWorld : vec3(vWorld.x, max(vWorld.y, uSurface + 0.05), vWorld.z));
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const TOP_FRAG = /* glsl */ `
${ATMO_GLSL}
${NOISE_GRAD_GLSL}
${LOBES_TEXTURE_GLSL}
${CLOUD_GRID_FRAG}
uniform vec3 uCalmAt;
uniform vec2 uRoute[${ROUTE_POINTS}];
uniform vec4 uTrail[${TRAIL_POINTS}];
uniform vec4 uGate;
uniform float uReach;
uniform float uHole;
uniform float uSurface;
uniform float uDebug;
in vec3 vWorld;
in float vRing;
in vec4 vCalm;
in float vShade;
in vec4 vFog;
flat in float vLevel;
TOP
void main() {
  if (vRing > uReach || gridHidden(vWorld.xz, vLevel)) discard;
  vec2 xz = vWorld.xz;
  if (uCloudBubble.w > 0.0 && uHole > 0.5) {
    float hole = length(xz - uCloudBubble.xz) - uCloudBubble.w * (0.75 + 0.35 * vnoise(xz * 0.8 + uTime * 0.1));
    if (hole < 0.0 && uCloudBubble.y < uSurface + 0.5) discard;
  }
  vec2 fold;
  vec3 lobe;
  vec3 top = cloudTop(xz, vCalm, 0.0, fold, lobe);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 ray = -V;
  vec3 L = normalize(uSunDir);
  vec3 N = normalize(vec3(-top.y, 1.0, -top.z));
  // The broad light goes round a lobe on a smoother normal: light soaks into cloud rather than lying on it.
  vec3 soft = normalize(vec3(-top.y * 0.5, 1.0, -top.z * 0.5));
  float dist = length(vWorld - cameraPosition);
  // How much cloud the sightline goes on through past here: little at a crest's edge, where the light comes
  // through and the edge frays; all of it on the open cloud, where the sightline goes on down into it.
  float stride = clamp(dist * 0.02, 0.5, 14.0);
  float through = 0.0;
  // Measured against the bulk under here, so what the finer lobes add to this point does not count as air.
  float over = vWorld.y - uSurface - bulkAt(xz, vCalm);
  for (int i = 1; i <= 4; i++) {
    vec3 q = vWorld + ray * (stride * float(i * i) * 0.6);
    through += smoothstep(-0.4, 0.4, bulkAt(q.xz, vCalm) + over - (q.y - uSurface));
  }
  float thin = 1.0 - through * 0.25;
  // Each lobe is lit at its crown and goes lilac toward where it sits down among the others; so is each heap.
  float puff = mix(0.45, 1.0, lobe.x) * mix(0.6, 1.0, lobe.y) * mix(0.9, 1.0, lobe.z) * mix(0.7, 1.0, fold.y);
  // Lit from the side by the low sun, which the cloud scatters across its whole top: peach where the light lies
  // across it, gold on the lobes turned full to it, lilac and violet where they sit down among the others and on
  // the sides turned away.
  float facing = dot(N, L);
  float crown = smoothstep(0.5, 1.0, puff);
  float sunLit = clamp(facing * 1.5 + 0.25 + 0.4 * (puff - 0.75), 0.0, 1.0) * (1.0 - 0.85 * vShade);
  float full = smoothstep(0.2, 0.85, facing) * (1.0 - vShade) * crown;
  float toward = pow(max(0.0, dot(ray, L)), 3.0);
  vec3 lilac = uSkyAmbient * vec3(1.25, 0.95, 1.15) + uGroundBounce * 0.3;
  vec3 violet = uSkyAmbient * vec3(0.66, 0.5, 0.98);
  vec3 shade = mix(violet, lilac, smoothstep(0.3, 0.95, puff));
  vec3 col = mix(shade, uSunColor * vec3(0.52, 0.37, 0.36) + shade * 0.3, sunLit * mix(0.5, 1.0, crown));
  col += uSunColor * vec3(1.0, 0.85, 0.62) * full * 0.22;
  // Against the low sun the thin edges and the crests glow: the silver lining.
  col += uSunColor * vec3(1.0, 0.88, 0.72) * toward * (1.0 - 0.6 * vShade) * (0.02 + 0.85 * thin * thin);
  // Down between the heaps far off the air thickens: the far valleys go blue-lilac while the crowns stand out of it.
  float low = 1.0 - smoothstep(0.0, 6.0, top.x);
  vec3 haze = mix(uSkyHorizon, uSkyAmbient * vec3(1.0, 0.85, 1.2), 0.55);
  col = mix(col, haze, (1.0 - exp(-max(dist - 60.0, 0.0) / 380.0)) * low * 0.45);
  // Far off it goes into the haze of the horizon beyond it, gold toward the sun and rose away from it.
  vec3 ahead = vWorld - cameraPosition;
  col = mix(col, skyColor(normalize(vec3(ahead.x, 0.01, ahead.z))), (1.0 - exp(-dist / 700.0)) * 0.72);
  col = mix(col, vFog.rgb, vFog.a);
  float edge = mix(1.0, smoothstep(0.0, 0.75, 1.0 - thin + 0.25 * vnoise(xz * 0.9 + uTime * 0.2)), smoothstep(0.35, 0.9, thin));
  // At the end of its reach it thins into the deck beyond, rather than stopping along a line.
  edge *= 1.0 - smoothstep(uReach * 0.7, uReach, vRing);
  gl_FragColor = vec4(col, uCloudDeck.w * edge);
  if (uDebug > 0.5) gl_FragColor = vec4(col, 1.0);
  if (uDebug > 1.5) gl_FragColor = vec4(vec3(edge), 1.0);
  if (uDebug > 2.5) gl_FragColor = vec4(vec3(puff, sunLit, full), 1.0);
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
uniform vec2 uDrift;
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
/** How high a heap's dome stands, and the towers on it, far out; near the landing and the way they are lower. */
const float HEAP = 3.5;
const float TOWER = 8.0;
/** The big, middle and fine lobes: how high on the open cloud (x) and how much higher on a heap (y). */
const vec2 BIG = vec2(1.6, 3.5);
const vec2 MID = vec2(1.0, 1.3);
const vec2 FINE = vec2(0.18, 0.22);
/** How fast each size of lobe drifts, as a share of uDrift: the small ones slide over the big, so the tops seem to roll. */
const vec4 DRIFT = vec4(0.35, 0.55, 0.75, 1.0);
/** 0 round the top landing and the way the boat goes, 1 far out, where the heaps tower up. */
float farOut(vec2 xz) {
  return max(smoothstep(60.0, 260.0, length(xz - uCalmAt.xy)), 0.75 * gateAt(xz));
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
  float m = site.x + 0.3 * g - 0.5 * (1.0 - calm.x);
  float x = (m - 0.28) / 0.4;
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
vec3 cloudTop(vec2 xz, vec4 calm, float spacing, out vec2 fold, out vec3 lobe) {
  vec2 p = xz + uCloudShift * 0.6;
  vec3 rise = riseAt(xz, p + uDrift * DRIFT.x, calm, spacing);
  float far = farOut(xz);
  float stature = 0.5 + 0.5 * far;
  vec3 tower = towers(p + uDrift * DRIFT.y, spacing);
  float heapH = HEAP * stature;
  float towerH = TOWER * stature * rise.x;
  // Lobes go down the steep flanks of a heap less than they stand on its top, or they hang down it in drapes.
  float even = 0.35 + 0.65 * calm.w;
  float aBig = (BIG.x * even + BIG.y * rise.x * stature);
  float aMid = (MID.x * even + MID.y * rise.x * stature);
  float aFine = FINE.x * even + FINE.y * rise.x;
  vec3 big = lobesT((p + uDrift * DRIFT.z) / 17.0 + 5.3, 0.3 + 0.4 * rise.x, lobesLod(spacing, 17.0));
  vec3 mid = lobesT((p + uDrift * DRIFT.w) / 6.5 + 1.7, 0.5 + 0.3 * rise.x, lobesLod(spacing, 6.5));
  vec3 fine = lobesT((p + uDrift * 1.25) / 2.4 + 7.7, 0.6 + 0.4 * rise.x, lobesLod(spacing, 2.4));
  vec3 h = vec3(rise.x * heapH, rise.yz * heapH)
    + vec3(tower.x * towerH, tower.yz * towerH + tower.x * TOWER * stature * rise.yz)
    + vec3(big.x * aBig, big.yz / 17.0 * aBig + big.x * BIG.y * stature * rise.yz)
    + vec3(mid.x * aMid, mid.yz / 6.5 * aMid + mid.x * MID.y * stature * rise.yz)
    + vec3(fine.x * aFine, fine.yz / 2.4 * aFine)
    + vec3(0.25 * (1.0 - calm.w), 0.0, 0.0);
  lobe = vec3(smoothstep(-0.2, 0.7, big.x), smoothstep(-0.1, 0.75, mid.x), smoothstep(-0.1, 0.8, fine.x));
  float crease = (1.0 - lobe.x) * (0.35 + 0.4 * rise.x) + (1.0 - lobe.y) * 0.45 + (1.0 - lobe.z) * 0.2
    + (1.0 - smoothstep(0.1, 0.6, tower.x)) * rise.x * 0.5;
  fold = vec2(clamp(crease, 0.0, 1.0), mix(1.0, clamp(h.x / max(heapH + towerH + aBig, 0.5), 0.0, 1.0), rise.x));
  // Its creases never dip below the top of the deck, or what stands just inside the cloud would show through them.
  float below = h.x - 0.1;
  float soft = sqrt(below * below + 0.02);
  h = vec3(0.1 + 0.5 * (below + soft), h.yz * 0.5 * (1.0 + below / soft));
  return h - furrow(xz) * 0.6;
}
vec3 cloudTop(vec2 xz, vec4 calm, float spacing, out vec2 fold) {
  vec3 lobe;
  return cloudTop(xz, calm, spacing, fold, lobe);
}
/** The height of the heaps, towers and big lobes alone: what a sightline passes through. */
float bulkAt(vec2 xz, vec4 calm) {
  vec2 p = xz + uCloudShift * 0.6;
  float rise = riseAt(xz, p + uDrift * DRIFT.x, calm, 0.0).x;
  float stature = 0.5 + 0.5 * farOut(xz);
  float big = lobesT((p + uDrift * DRIFT.z) / 17.0 + 5.3, 0.3 + 0.4 * rise, 0.0).x;
  return rise * stature * (HEAP + TOWER * towers(p + uDrift * DRIFT.y, 0.0).x)
    + big * (BIG.x * (0.35 + 0.65 * calm.w) + BIG.y * rise * stature) + 0.25;
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
    float stature = 0.5 + 0.5 * farOut(q);
    float stands = rise * stature * (HEAP + TOWER * towers(q + drift + uDrift * DRIFT.y, spacing).x) + (BIG.x + BIG.y * rise) * 0.45;
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
${CLOUD_GRID_VERT}
uniform vec3 uCalmAt;
uniform vec2 uStairAt;
out vec3 vWorld;
out float vRing;
out float vBefore;
flat out float vLevel;
BELLY
void main() {
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
  // Seen from below the cloud is darker the thicker it is: lilac and violet in the bodies of its cells, lighter in
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
 * the low sun, and its top lying to the horizon under the sunset with a furrow where the hull has been. Inside it,
 * the shared analytic deck in the fog takes over.
 */
export class StairsCloud {
  readonly group = new THREE.Group();
  readonly top: THREE.Mesh;
  readonly belly: THREE.Mesh;
  readonly wake = new CloudWake();
  readonly fog = new FogBank();
  private readonly lobes = new CloudLobes();
  private readonly grid = cloudGridGeometry(0.5);
  private readonly topUniforms: { uGrid: { value: THREE.Vector4[] }; uDrift: { value: THREE.Vector2 }; uLobesSoft: { value: THREE.Texture }; uLobesFull: { value: THREE.Texture }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number };
    uRoute: { value: THREE.Vector2[] }; uTrail: { value: THREE.Vector4[] }; uGate: { value: THREE.Vector4 }; uHole: { value: number }; uDebug: { value: number }; uSurface: { value: number } };
  private readonly bellyUniforms: { uGrid: { value: THREE.Vector4[] }; uCalmAt: { value: THREE.Vector3 }; uReach: { value: number }; uStairAt: { value: THREE.Vector2 } };
  /** The furrow behind the hull: where it has been, newest first, and how fresh each point is. */
  private readonly trail: THREE.Vector4[] = Array.from({ length: TRAIL_POINTS }, () => new THREE.Vector4(0, 0, 0, 0));
  private trailFrom = new THREE.Vector2(1e5, 1e5);

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
      uGate: { value: new THREE.Vector4(TOWER_GATE.from.x, TOWER_GATE.from.y, TOWER_GATE.to.x, TOWER_GATE.to.y) },
      uHole: { value: 1 },
      uDebug: { value: 0 },
      // The surface stays where the cloud's top is, even while the deck swells above it into fog.
      uSurface: { value: CLOUD.top },
    };
    this.group.add(this.wake.mesh);
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
    placeCloudGrid(this.grid.levels, camera.position);
    // The air over the cloud goes the way the boat does, a little across it, and carries the tops with it.
    const drift = tuning.stairs.cloudDrift * dt;
    this.topUniforms.uDrift.value.x -= Math.sin(RUN_YAW + 0.5) * drift;
    this.topUniforms.uDrift.value.y -= Math.cos(RUN_YAW + 0.5) * drift;
    this.wake.update(dt);
    this.fog.update(dt, camera.position);
    this.belly.visible = deck.w > 0.01 && camera.position.y < atmo.uniforms.uCloudDeckY.value.x - 1;
  }

  /** Whether the pocket round a climber opens a hole in the top of the cloud; not while the cloud is swelling up round a hull. */
  set hole(open: boolean) {
    this.topUniforms.uHole.value = open ? 1 : 0;
  }
}

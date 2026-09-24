import * as THREE from 'three';
import { MIRROR_ROOM } from './journey-rooms';
import { MIRROR_LAYOUT_GLSL, SKY_MIRROR } from './sky-mirror-layout';
import { MIRROR_RIPPLES_GLSL, mirrorUniforms } from './sky-mirror';
import { LITTLE_BOATS, LITTLE_BOATS_GLSL } from './little-boats-layout';
import { params } from '../params';
import { glsl, tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { mainlandCoastZ } from './heightfield';
import { PlanarReflection } from './water/reflection';
import { ShoreBake } from './water/shore';
import { SURF_GLSL, surfUniforms } from './water/surf';
import { SWELL_GLSL, swellUniforms } from './water/swell';
import { rippleTexture } from './water/textures';
import { WIND_WAVES_GLSL, WindWaves } from './water/wind-waves';

/** Vertex spacing of the sea near the camera, and how far that even spacing reaches before the mesh opens out. */
const STEP = 1.9;
const EVEN = 110;
const REACH = 4600;

/**
 * A grid centred on the camera, evenly spaced where the swell is real geometry and opening out geometrically
 * beyond it, so one mesh carries both the water at the bow and the water at the horizon.
 */
function seaGrid(segments: number): THREE.BufferGeometry {
  const half = segments / 2;
  const even = Math.round(EVEN / STEP);
  const grow = (REACH / EVEN) ** (1 / (half - even));
  const axis: number[] = [];
  for (let i = -half; i <= half; i++) {
    const n = Math.abs(i);
    const d = n <= even ? n * STEP : EVEN * grow ** (n - even);
    axis.push(Math.sign(i) * d);
  }
  const n = axis.length;
  const position = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      position[(j * n + i) * 3] = axis[i];
      position[(j * n + i) * 3 + 2] = axis[j];
    }
  }
  const index = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      index.set([a, a + n, a + 1, a + 1, a + n, a + n + 1], k);
      k += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

const VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
${LITTLE_BOATS_GLSL}
${WIND_WAVES_GLSL}
${MIRROR_LAYOUT_GLSL}
vec3 surfaceShift(vec2 p, float distanceToCamera) {
  return (swellShift(p, swellHeight(p, distanceToCamera)) + vec3(0.0, windWaveHeight(p) * chopHere(p, distanceToCamera) + (roomHides(p) ? 0.0 : boatsWaterBase(p) + boatsRipple(p, uTime)), 0.0)) * (1.0 - (roomHides(p) ? 0.0 : mirrorWater(p)));
}
out vec3 vWorld;
/** The swell's surface tilt here, and how much of it this far out is geometry rather than a normal. */
out vec3 vSwell;
void main() {
  vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
  vec2 xz = w.xz;
  float fromCamera = length(cameraPosition.xz - xz);
  float height = swellHeight(xz, fromCamera);
  // Neighbour samples include the envelope gradient as well as the travelling crests.
  const float E = 1.5;
  vec3 at = surfaceShift(xz, fromCamera);
  vec3 along = vec3(E, 0.0, 0.0) + surfaceShift(xz + vec2(E, 0.0), fromCamera) - at;
  vec3 across = vec3(0.0, 0.0, E) + surfaceShift(xz + vec2(0.0, E), fromCamera) - at;
  vec3 n = normalize(cross(across, along));
  vSwell = vec3(-n.x / n.y, -n.z / n.y, uSwell > 0.0 ? height / uSwell : 0.0);
  vWorld = w + at;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${SURF_GLSL}
${LITTLE_BOATS_GLSL}
${WIND_WAVES_GLSL}
${MIRROR_LAYOUT_GLSL}
${MIRROR_RIPPLES_GLSL}
uniform float uSkyMirrorAppearance;
uniform sampler2D uRipple;
uniform sampler2D uMirror;
uniform mat4 uMirrorMatrix;
uniform float uMirrorOn;
uniform vec2 uBreeze;
uniform vec3 uDeep;
uniform vec3 uAbsorb;
uniform vec3 uSand;
uniform vec3 uWetSand;
in vec3 vWorld;
in vec3 vSwell;

/**
 * The world above the sea seen along reflected ray R; nearby content is taken to lie ~48 units out. The last
 * argument is 0 where that lands off the mirror, whose border texel would otherwise streak across the water.
 */
vec3 mirrored(vec3 R, float lod, out float seen) {
  vec4 p = uMirrorMatrix * vec4(vWorld + R * 48.0, 1.0);
  vec2 uv = p.xy / p.w;
  vec2 edge = min(uv, 1.0 - uv);
  seen = p.w > 0.0 ? uMirrorOn * smoothstep(0.0, 0.06, min(edge.x, edge.y)) : 0.0;
  return textureLod(uMirror, clamp(uv, 0.0, 1.0), lod).rgb;
}

/** Ripple slopes carried along by the wind; two phases cross-fade so the drift never stretches the pattern. */
vec3 driftingRipples(vec2 p, vec2 drift, float period) {
  float t = uTime / period;
  float ph0 = fract(t);
  float ph1 = fract(t + 0.5);
  float w = abs(1.0 - 2.0 * ph0);
  vec4 a = texture(uRipple, p - drift * ph0 * period + hash12(vec2(floor(t), 1.7)) * 7.3);
  vec4 b = texture(uRipple, p - drift * ph1 * period + hash12(vec2(floor(t + 0.5), 5.1)) * 7.3);
  vec4 r = mix(a, b, w);
  vec2 slope = (r.rg * 2.0 - 1.0) / sqrt(w * w + (1.0 - w) * (1.0 - w));
  float variance = max(r.b - dot(r.rg * 2.0 - 1.0, r.rg * 2.0 - 1.0), 0.0);
  return vec3(slope, variance);
}

/** Bright web of light the waves focus onto the seabed. */
float caustics(vec2 p, vec2 warp, Footprint fp) {
  vec2 a = p * 0.16 + warp + vec2(uTime * 0.017, uTime * 0.011);
  mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
  vec2 b = turn * p * 0.19 - warp * 0.7 - vec2(uTime * 0.013, -uTime * 0.019);
  float c = min(textureGrad(uLace, a, fp.dx * 0.16, fp.dy * 0.16).g, textureGrad(uLace, b, turn * fp.dx * 0.19, turn * fp.dy * 0.19).g);
  return smoothstep(0.55, 1.0, c);
}

/**
 * Sun glints too small to resolve: world-space cells that flash briefly, as many as the glitter lobe allows.
 * Cells never shrink below a few pixels and two sizes blend, so the sparkle twinkles instead of crawling.
 */
float glintCells(vec2 xz, float cell, float density) {
  vec2 p = xz / cell;
  vec2 id = floor(p);
  float h = hash12(id + cell * 17.3);
  vec2 centre = vec2(hash12(id + 3.1), hash12(id + 8.7)) * 0.5 + 0.25;
  float spot = (1.0 - smoothstep(0.0, 0.3, length(fract(p) - centre)));
  float life = fract(uTime * (0.8 + 1.2 * h) + h * 23.0);
  float flash = smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.06, 0.32, life));
  return spot * flash * step(1.0 - density, fract(h * 91.7));
}

float glints(vec2 xz, float footprint, float density) {
  float level = log2(max(footprint * 8.0, 0.1));
  float l0 = floor(level);
  float f = level - l0;
  return mix(glintCells(xz, exp2(l0), density), glintCells(xz, exp2(l0 + 1.0), density), f);
}

/** Short-lived whitecaps, stretched along the wind and carried a little way by it; storm is the chance per cell. */
float whitecaps(vec2 xz, vec2 flow, float storm) {
  const float CELL = 3.4;
  const float LIFE = 2.0;
  vec2 dir = flow / max(length(flow), 1e-3);
  float caps = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 shift = vec2(float(k) * 0.5 * CELL);
    vec2 id = floor((xz + shift) / CELL);
    float h = hash12(id + float(k) * 17.3);
    float life = fract(uTime / LIFE + h);
    float wave = floor(uTime / LIFE + h);
    float chance = hash12(id + wave * 3.1);
    if (chance > storm) continue;
    vec2 centre = (id + 0.25 + 0.5 * vec2(hash12(id + wave), hash12(id - wave))) * CELL - shift;
    vec2 d = xz - centre - flow * life * 0.04;
    vec2 local = vec2(dot(d, dir), dot(d, vec2(-dir.y, dir.x))) / (0.6 + 0.5 * h);
    local /= vec2(local.x > 0.0 ? 0.7 : 1.7, 0.4);
    float grow = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.35, 1.0, life)) * smoothstep(chance, chance + 0.25, storm);
    caps = max(caps, (1.0 - smoothstep(0.1, 1.0, length(local))) * grow);
  }
  return caps;
}

/** Wind lands in streaks, not discs: a mask stretched along the flow, so a gust leaves a cat's paw. */
float catsPaw(vec2 xz, vec2 along) {
  vec2 p = vec2(dot(xz, along) - uTime * 2.5, dot(xz, vec2(-along.y, along.x)) * 3.2) * 0.03;
  return 0.45 + 1.1 * (vnoise(p) * 0.7 + vnoise(p * 2.9 + 5.1) * 0.3);
}

float ggx(float nh, float a2) {
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * d * d);
}

float smithVis(float nv, float nl, float a2) {
  float gv = nl * sqrt(nv * nv * (1.0 - a2) + a2);
  float gl = nv * sqrt(nl * nl * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-4);
}

vec3 glassColour(vec3 V, vec2 xz) {
  vec2 ringSlope = mirrorSlope(xz);
  vec3 mirrorNormal = normalize(vec3(-ringSlope.x, 1.0, -ringSlope.y));
  vec3 ray = reflect(-V, mirrorNormal);
  vec4 projected = uMirrorMatrix * vec4(vWorld, 1.0);
  vec2 mirrorUv = projected.xy / projected.w + ringSlope * 0.12;
  vec2 border = min(mirrorUv, 1.0 - mirrorUv);
  float on = projected.w > 0.0 ? uMirrorOn * smoothstep(0.0, 0.025, min(border.x, border.y)) : 0.0;
  vec3 reflectedScene = textureLod(uMirror, clamp(mirrorUv, 0.0, 1.0), min(3.0, length(ringSlope) * 24.0)).rgb;
  vec3 reflected = reflectedScene;
  if (on < 1.0) reflected = mix(skyRadiance(normalize(vec3(ray.x, abs(ray.y), ray.z))), reflectedScene, on);
  // A trace of cool water keeps the horizon legible without hiding the doubled clouds.
  return reflected * 0.96 + vec3(0.003, 0.006, 0.012);
}

void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 xz = vWorld.xz;
  // Screen-space derivatives stay in uniform control flow, ahead of the early returns below.
  vec2 uv = domainUv(xz);
  vec2 edge = min(uv, 1.0 - uv);
  /** Wide, because the wind beyond the window is only an approximation of it and the join must not show. */
  float inside = smoothstep(0.0, 0.11, min(edge.x, edge.y));
  if (roomHides(xz)) inside = 0.0;
  Footprint fp = footprintOf(xz);
  float footprint = max(length(fp.dx), length(fp.dy));
  float poolLevel = roomHides(xz) ? 0.0 : boatsWaterBase(xz);
  float pool = smoothstep(0.0, 0.3, poolLevel);
  float offshore = mix(60.0, -shoreDistance(xz), inside);
  if (pool > 0.0) {
    float bankDistance = max(0.0, (1.08 - boatsOut(xz)) * boatsWidth(${glsl(LITTLE_BOATS.startZ)} - xz.y));
    offshore = mix(offshore, bankDistance, pool);
  }
  float surfBlur = fwidth(offshore) / BORE_SPACING * 1.5;
  float glass = roomHides(vWorld.xz) ? 0.0 : mirrorWater(vWorld.xz) * uSkyMirrorAppearance;
  // Ordinary sea beyond the flat would show as a dark band under the horizon.
  float onFlat = 1.0 - smoothstep(${glsl(tuning.skyMirror.horizonOnFlat)}, ${glsl(tuning.skyMirror.horizonOffFlat)}, distance(cameraPosition.xz, vec2(${glsl(SKY_MIRROR.x)}, ${glsl(SKY_MIRROR.z)})));
  glass = max(glass, uSkyMirrorAppearance * onFlat * smoothstep(${glsl(tuning.skyMirror.horizonGlassFrom)}, ${glsl(tuning.skyMirror.horizonGlassTo)}, dist));
  // The full mirror replaces ordinary water, including its fog. Its transition
  // edge still evaluates both surfaces and blends them exactly as before.
  if (glass == 1.0) {
    gl_FragColor = vec4(glassColour(V, xz), 1.0);
    return;
  }
  vec4 fog = fogOf(vWorld);
  // Ordinary sea under fully opaque fog contributes only the fog colour.
  // The sky mirror is composed AFTER fog, so it must retain its own reflection.
  if (fog.a == 1.0 && glass <= 0.001) {
    gl_FragColor = vec4(fog.rgb, 1.0);
    return;
  }

  // Weather owns the underlying ripple drift and lighting. Cursor reversals cannot move their phase.
  float settled = length(uBreeze);
  vec2 along = normalize(uBreeze + vec2(1e-4, 0.0));
  vec2 flow = uBreeze;
  float paw = catsPaw(xz, along);
  float rough = clamp(max(smoothstep(1.2, 7.5, settled) * paw, uSquall), 0.0, 1.0);
  float storm = clamp(max(smoothstep(18.0, 34.0, settled) * 0.5, uSquall * 0.85) * paw, 0.0, 1.0);
  float stroke = clamp(dot(waterWindAt(xz), vec4(1.0)), 0.0, 1.0);

  float ground = mix(-12.0, texture(uHeightTex, clamp(uv, 0.0, 1.0)).r, inside);
  float depth = max(poolLevel - ground, 0.0);
  vec4 bedN = groundAt(xz);

  /** Carried at the weather's pace: ripples dragged along at a stroke's speed smear into a slick behind it. */
  vec2 drift = along * settled * 0.22;
  vec3 r0 = driftingRipples(xz * 0.041, drift * 0.041, 3.1);
  vec3 r1 = driftingRipples(xz * 0.113 + 0.5, drift * 0.113, 2.3);
  vec3 r2 = driftingRipples(xz * 0.31 + 0.25, drift * 0.31, 1.7);
  float calm = 0.2 + 0.8 * uSeaState;
  float a0 = 0.05 * calm + 0.055 * rough + 0.05 * storm;
  float a1 = 0.035 * calm + 0.085 * rough + 0.1 * storm;
  float a2 = 0.045 * calm + 0.115 * rough + 0.16 * storm;
  vec4 sw = texture(uRipple, mat2(0.94, -0.34, 0.34, 0.94) * xz * 0.011 + vec2(uTime * 0.0041, uTime * 0.0013));
  vec3 swell = vec3(sw.rg * 2.0 - 1.0, max(sw.b - dot(sw.rg * 2.0 - 1.0, sw.rg * 2.0 - 1.0), 0.0));
  /** The painted swell gives way to the modelled one as it comes close enough to the camera to be geometry. */
  float A_SWELL = 0.07 * calm * (1.0 - vSwell.z);
  vec2 slope = r0.xy * a0 + r1.xy * a1 + r2.xy * a2 + swell.xy * A_SWELL + vSwell.xy;
  float hidden = r0.z * a0 * a0 + r1.z * a1 * a1 + r2.z * a2 * a2 + swell.z * A_SWELL * A_SWELL;
  /** The ruffle tilts the surface but stays out of the hidden-roughness sum, so it cannot change the shine. */
  slope += windWaveSlope(xz, footprint);

  vec3 surf = vec3(0.0);
  float swellAmp = 0.0;
  if (offshore < 40.0 && pool < 0.99) {
    surf = surfWaves(xz, offshore, depth, surfBlur, fp) * (1.0 - pool);
    swellAmp = 0.13 * uSeaState * (1.0 - smoothstep(1.6, 4.5, depth)) * smoothstep(0.0, 1.5, offshore) * (1.0 - smoothstep(5.0, 17.0, offshore));
    vec2 toSea = -vec2(shoreDistance(xz + vec2(0.5, 0.0)) + offshore, shoreDistance(xz + vec2(0.0, 0.5)) + offshore) * 2.0;
    slope += toSea * surf.z * swellAmp;
  }
  slope *= 1.0 - (1.0 - smoothstep(0.0, 1.5, offshore)) * 0.7;
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  // Rain takes the shine off water: too fine to resolve into rings, it shows as a matte over the whole sea.
  float unresolved = hidden * 2.0 + 0.004 + 0.02 * rough + 0.05 * storm + 0.018 * uShower;
  float alpha2 = 0.0012 + unresolved + footprint * footprint * 0.00002;

  float nv = clamp(dot(N, V), 0.02, 1.0);
  vec3 R = reflect(-V, N);
  R = normalize(vec3(R.x, abs(R.y) + sqrt(unresolved) * 1.2 * (1.0 - nv), R.z));
  vec3 sky = skyColor(R);
  float seen;
  vec3 mirror = mirrored(R, clamp(log2(1.0 + sqrt(alpha2) * 60.0), 0.0, 6.0), seen);
  // Capped just above the open sky: the mirrored sun disc would bloom, and the glitter draws the sun instead.
  // The planar mirror lies at sea level; elevated pools reflect the sky rather than a displaced scene.
  vec3 refl = mix(sky, min(mirror, sky * 1.25 + 0.1), seen * (1.0 - pool));
  refl = mix(sky, refl, smoothstep(0.0, 2.5, offshore)) * (1.0 - 0.17 * rough - 0.18 * storm);
  // Facet masking dims a rough sea seen edge-on; capped, or a gust punches a hole of a different colour in it.
  float roughness = min(sqrt(sqrt(alpha2)), 0.42);
  float F = 0.02 + (max(1.0 - roughness * 1.4, 0.02) - 0.02) * pow(1.0 - nv, 5.0);

  /** The land's baked shade stops at the window; beyond it the edge texel would streak out as a hard wedge. */
  float sh = cloudShadow(xz) * mix(1.0, bedN.w, inside);
  vec3 scatterLight = uSkyAmbient * 1.1 + uSunColor * max(uSunDir.y, 0.0) * 0.6 * sh;
  vec3 body = uDeep * scatterLight;
  if (depth < 9.0) {
    vec3 T = refract(-V, N, 0.75);
    float tDown = max(-T.y, 0.25);
    vec2 bedXZ = xz + T.xz / tDown * depth * 0.8;
    float bedDepth = max(boatsWaterBase(bedXZ) - mix(-12.0, texture(uHeightTex, clamp(domainUv(bedXZ), 0.0, 1.0)).r, inside), 0.0);
    float path = bedDepth / tDown;

    float grain = vnoise(bedXZ * 1.7) * 0.5 + vnoise(bedXZ * 6.0) * 0.5;
    float ripples = sin(dot(bedXZ, vec2(0.9, 0.45)) * 2.2 + vnoise(bedXZ * 0.3) * 6.0) * 0.5 + 0.5;
    vec3 sand = uSand * (0.9 + 0.12 * grain) * (0.96 + 0.06 * ripples);
    vec3 bed = mix(uWetSand * (0.92 + 0.12 * grain), sand * 0.92, smoothstep(0.05, 0.9, bedDepth));
    float weed = smoothstep(0.58, 0.72, vnoise(bedXZ * 0.08 + 3.1) * 0.75 + vnoise(bedXZ * 0.27) * 0.25);
    bed = mix(bed, vec3(0.09, 0.12, 0.06), weed * 0.4 * smoothstep(0.9, 1.8, bedDepth) * (1.0 - smoothstep(2.5, 4.0, bedDepth)));

    vec3 sunIn = refract(-uSunDir, vec3(0.0, 1.0, 0.0), 0.75);
    float sunDown = max(-sunIn.y, 0.2);
    float sunVis = cloudShadow(bedXZ) * groundAt(bedXZ).w;
    float light = caustics(bedXZ + sunIn.xz / sunDown * bedDepth, slope * 0.6, fp) * smoothstep(0.1, 0.8, bedDepth) * exp(-bedDepth * 0.45);
    light *= (1.0 - smoothstep(60.0, 220.0, dist));
    vec3 sunBed = uSunColor * max(uSunDir.y, 0.0) * 0.8 * exp(-uAbsorb * bedDepth / sunDown) * sunVis * (0.6 + 4.0 * light);
    vec3 skyBed = uSkyAmbient * 1.25 * exp(-uAbsorb * bedDepth * 1.4);
    vec3 seen = bed * (sunBed + skyBed) * exp(-uAbsorb * path);
    body = mix(body, seen, exp(-path * 0.2) * (1.0 - smoothstep(6.0, 9.0, bedDepth)));
  }
  float crest = surf.y * swellAmp * 6.0;
  float backlit = pow(max(dot(-V, normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 3.0);
  body += vec3(0.1, 0.55, 0.45) * uSunColor * crest * (0.02 + 0.3 * backlit) * sh;
  body *= 1.0 - rough * 0.08 - storm * 0.15;

  vec3 L = uSunDir;
  vec3 H = halfVector(L, V);
  float nl = max(dot(N, L), 0.0);
  float fh = 0.02 + 0.98 * pow(1.0 - clamp(dot(V, H), 0.0, 1.0), 5.0);
  float vis = smithVis(nv, nl, alpha2) * nl * fh;
  float facet = min(ggx(max(dot(N, H), 0.0), alpha2) * vis, 5.0);
  float tan2 = (1.0 - H.y * H.y) / max(H.y * H.y, 1e-4);
  float glitter = exp(-tan2 / (0.008 + unresolved));
  float crisp = (1.0 - smoothstep(0.1, 0.7, footprint));
  float sparkle = glints(xz, footprint, glitter) * vis * (8.0 + 10.0 * crisp);
  vec3 sun = uSunColor * (facet * 0.1 + glitter * vis * mix(0.3, 0.08, crisp) + sparkle) * sh;

  /**
   * The stars on the water. The sky's own field is far finer than a pixel of sea, so reflecting it would boil
   * into noise; the sea catches it instead as the facets that happen to point at one, flashing in world-space
   * cells a few pixels across, which is how the sun's glitter is drawn too.
   */
  vec3 starlight = vec3(0.0);
  if (uStarlight > 0.0) {
    float caught = smoothstep(0.02, 0.3, R.y) * (1.0 - 0.75 * rough) * uStarlight;
    starlight = vec3(0.72, 0.8, 1.0) * glints(xz + 137.0, footprint, ${glsl(tuning.water.stars)}) * F * caught * ${glsl(tuning.water.starLight)};
  }

  vec3 col = mix(body, refl, F) + sun + starlight;
  // Wind on water darkens it and never oils it, so a gust takes light off the sea without touching its colour.
  col *= 1.0 - ${glsl(tuning.water.darken)} * stroke;

  float foam = surf.x;
  if (storm > 0.0) {
    // Water breaks on the steep face the wind is driving, so the foam goes there and not evenly over the sea.
    float face = 0.4 + 0.75 * smoothstep(0.02, 0.22, -dot(slope, along));
    foam = max(foam, foamLace(whitecaps(xz, flow, storm * 0.9) * face, xz * 3.5, Footprint(fp.dx * 3.5, fp.dy * 3.5)));
  }
  col = mix(col, foamColor(V, sh), clamp(foam, 0.0, 1.0));

  col = mix(stillGrey(col) * 1.05, col, 0.35 + 0.65 * uWorldLife);
  col += harbourLight(vWorld) * (0.08 + 0.14 * F);
  col = mix(col, fog.rgb, fog.a);
  if (glass > 0.001) {
    col = mix(col, glassColour(V, xz), glass);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/** Far enough inland that the sea is behind the camera or lost in the haze, so its mirror is not drawn. */
const SEA_OUT_OF_SIGHT = 380;

/** The sea: a plane at y = 0 shaded with the seabed, surf, wind-driven ripples, sun glitter and a mirror of the world. */
export class Water {
  readonly mesh: THREE.Mesh;
  private readonly reflection: PlanarReflection;
  private readonly shore: ShoreBake;
  private frame = 0;
  /** Only the sky mirror's special surface colour; wave geometry and ordinary sea reflections are independent. */
  skyMirrorAppearance = 1;
  mirrorEvery = params.lite ? 2 : 1;
  mirrorScale = params.lite ? 0.5 : 0.75;
  private readonly windWaves: WindWaves;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, breeze: THREE.Vector2, height: THREE.Texture) {
    this.windWaves = new WindWaves(renderer);
    this.reflection = new PlanarReflection(renderer, scene, 0.25);
    this.shore = new ShoreBake(renderer, height);
    surfUniforms.uShoreTex.value = this.shore.target.texture;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...atmo.uniforms,
        ...surfUniforms,
        ...swellUniforms,
        ...mirrorUniforms,
        uWaterWind: this.windWaves.uniform,
        uSkyMirrorAppearance: { value: 1 },
        uRipple: { value: rippleTexture() },
        uMirror: { value: this.reflection.target.texture },
        uMirrorMatrix: { value: this.reflection.matrix },
        uMirrorOn: { value: 0 },
        uBreeze: { value: breeze },
        uDeep: { value: new THREE.Color('#0d4a66') },
        uAbsorb: { value: new THREE.Vector3(0.5, 0.13, 0.1) },
        // The beach's sand (terrain.ts), so the seabed meets it at the waterline without a seam.
        uSand: { value: new THREE.Color('#e6d2a6') },
        uWetSand: { value: new THREE.Color('#a48c66') },
      },
    });
    this.mesh = new THREE.Mesh(seaGrid(params.lite ? 128 : 192), mat);
    this.mesh.frustumCulled = false;
  }

  /** Advance the water independently of the air, once per simulation frame. */
  step(dt: number): void {
    this.windWaves.update(dt);
  }

  /** Re-measures the shoreline; call after the window's height bake. */
  bakeShore(windowSize: number): void {
    this.shore.bake(windowSize);
  }

  /**
   * Renders the mirror at the current quality cadence (every frame, or alternate frames on the low tier).
   * Call after the camera has moved, before the scene is drawn.
   */
  update(camera: THREE.PerspectiveCamera, before?: (mirrorCamera: THREE.PerspectiveCamera) => void, after?: () => void): void {
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uSkyMirrorAppearance.value = this.skyMirrorAppearance;
    /** Snapped to the even part of the grid, so the vertices carrying the swell never slide through it. */
    this.mesh.position.set(Math.round(camera.position.x / STEP) * STEP, 0, Math.round(camera.position.z / STEP) * STEP);
    /** Where there is no mirror the sea must not read one: the last one drawn is a different room by now. */
    const onFlat = Math.hypot(camera.position.x - SKY_MIRROR.x, camera.position.z - SKY_MIRROR.z) < tuning.skyMirror.reflectionPrepare;
    const mirrorJourney = atmo.uniforms.uJourneyRooms.value.y === MIRROR_ROOM || atmo.uniforms.uJourneyRooms.value.x === MIRROR_ROOM;
    this.reflection.scale = mirrorJourney || onFlat ? this.mirrorScale : 0.25;
    const mirrorEvery = params.mirror ?? this.mirrorEvery;
    const mirrored = !!mirrorEvery && (mirrorJourney || onFlat || camera.position.z >= mainlandCoastZ(camera.position.x) - SEA_OUT_OF_SIGHT);
    const mirrorUniform = (this.mesh.material as THREE.ShaderMaterial).uniforms.uMirrorOn;
    const first = mirrored && mirrorUniform.value === 0;
    mirrorUniform.value = mirrored ? 1 : 0;
    if (!mirrored) return;
    if (this.frame++ % mirrorEvery && !first) return;
    atmo.uniforms.uMirrorPass.value = 1;
    this.reflection.render(camera, before, after);
    atmo.uniforms.uMirrorPass.value = 0;
  }
}

import type * as THREE from 'three';
import { laceTexture } from './textures';

/** Shared by the sea and the beach so waves run from one onto the other without a seam. */
export const surfUniforms = {
  uLace: { value: laceTexture() },
  /** Signed distance to the waterline over the world window (`ShoreBake`). */
  uShoreTex: { value: null as THREE.Texture | null },
  /** 0 glassy and still (the grey world before the first gust), 1 the breeze's usual surf. */
  uSeaState: { value: 1 },
  /** The weather working the sea over, 0 none to 1 the full squall (`Chapter.storm`, eased across rooms). */
  uSquall: { value: 0 },
};

/**
 * Shore waves. Broken waves roll in over the shallows, run up the beach, stop and slide back, leaving darker
 * wet sand that dries between waves. Distances are horizontal, from the waterline. Needs ATMO_GLSL first.
 */
export const SURF_GLSL = /* glsl */ `
uniform sampler2D uLace;
uniform sampler2D uShoreTex;
uniform float uSeaState;
uniform float uSquall;

const float SURF_PERIOD = 7.5;
const float SURF_UP = 0.3;
const float SURF_LOW = -0.6;
const float BORE_SPACING = 6.0;
const vec3 FOAM = vec3(0.92, 0.88, 0.8);

/** Screen-space derivatives of world xz, taken before any branch so textures in branches keep their filtering. */
struct Footprint {
  vec2 dx;
  vec2 dy;
};

Footprint footprintOf(vec2 xz) {
  return Footprint(dFdx(xz), dFdy(xz));
}

/** Signed distance to the waterline: positive inland, negative out to sea. */
float shoreDistance(vec2 xz) {
  return texture(uShoreTex, clamp(domainUv(xz), 0.0, 1.0)).r;
}

/** Whole numbers are the moments a wave reaches the waterline here; the offset makes waves peel along the shore. */
float surfCycle(vec2 xz) {
  return uTime / SURF_PERIOD + vnoise(xz * 0.016) * 1.8 + vnoise(xz * 0.057 + 7.3) * 0.3;
}

/** How far up the beach wave n runs. */
float surfReach(float n, vec2 xz) {
  return mix(1.0, 3.4, hash12(vec2(n, 3.7))) * (0.7 + 0.6 * vnoise(xz * 0.045 + n * 1.37)) * (0.25 + 0.75 * uSeaState);
}

float swashEdge(float p, float reach) {
  if (p < SURF_UP) {
    float q = 1.0 - p / SURF_UP;
    return mix(SURF_LOW, reach, 1.0 - q * q);
  }
  float q = (p - SURF_UP) / (1.0 - SURF_UP);
  return mix(reach, SURF_LOW, q * q * (3.0 - 2.0 * q));
}

/** Cycle fraction at which the backwash of a wave reaching reach uncovered distance x. */
float swashUncover(float x, float reach) {
  float y = clamp((reach - x) / (reach - SURF_LOW), 0.0, 1.0);
  float q = 0.5 - sin(asin(1.0 - 2.0 * y) / 3.0);
  return SURF_UP + q * (1.0 - SURF_UP);
}

/** Thick foam is solid; thin foam keeps only the strands between bubbles. */
float foamLace(float density, vec2 xz, Footprint fp) {
  float lace = textureGrad(uLace, xz * 0.085, fp.dx * 0.085, fp.dy * 0.085).r * 0.6
    + textureGrad(uLace, xz * 0.21 + 0.37, fp.dx * 0.21, fp.dy * 0.21).r * 0.4;
  float cut = 1.0 - density;
  return smoothstep(cut, cut + 0.16, lace) * smoothstep(0.0, 0.25, density);
}

/**
 * The swash at distance x inland. inland: unit vector away from the sea.
 * x: water sheet cover, y: foam, z: wetness of the sand (1 fresh, 0 dry), w: sheet depth in units.
 */
vec4 beachSwash(vec2 xz, float x, vec2 inland, Footprint fp) {
  float c = surfCycle(xz);
  float n = floor(c);
  float p = c - n;
  float reach = surfReach(n, xz);
  float edge = swashEdge(p, reach);
  float depth = edge - x;
  float cover = smoothstep(0.0, 0.08, depth);

  float age = 1e3;
  if (depth > 0.0) age = 0.0;
  else if (p > SURF_UP && x < reach) age = (p - swashUncover(x, reach)) * SURF_PERIOD;
  else {
    float prev = surfReach(n - 1.0, xz);
    if (x < prev) age = (p + 1.0 - swashUncover(x, prev)) * SURF_PERIOD;
  }
  float wet = exp(-age / 3.5);

  float rushing = p < SURF_UP ? 1.0 : exp(-(p - SURF_UP) * 7.0);
  float lip = cover * exp(-depth / 0.25) * mix(0.35, 1.0, rushing) * (0.3 + 0.7 * uSeaState);
  float sheet = cover * exp(-p * 3.5) * 0.5 * smoothstep(0.2, 0.7, vnoise(xz * 0.35 + n * 5.3)) * uSeaState;
  float mark = p > SURF_UP ? exp(-abs(x - reach) / 0.12) * exp(-(p - SURF_UP) * SURF_PERIOD / 1.4) * 0.65 : 0.0;
  vec2 carried = xz - inland * (edge - SURF_LOW) + hash12(vec2(n, 9.1)) * 41.0;
  float foam = foamLace(max(lip, max(sheet, mark)), carried, fp);
  return vec4(cover, foam, wet, max(depth, 0.0));
}

/**
 * Waves over the shallows, offshore units from the waterline over water this deep. They steepen as the sea
 * shoals, break into rolling foam lines and reach the waterline as the swash starts. aa: phase blur per pixel.
 * x: foam, y: crest height (0..1), z: slope of that height per unit offshore.
 */
vec3 surfWaves(vec2 xz, float offshore, float depth, float aa, Footprint fp) {
  float cycle = surfCycle(xz);
  float phase = cycle + offshore / BORE_SPACING;
  float s = fract(phase);
  float u = s < 0.5 ? s : s - 1.0;
  float width = u < 0.0 ? 0.07 : 0.2;
  float height = exp(-u * u / (width * width));
  float slope = -2.0 * u / (width * width) * height / BORE_SPACING;

  float wave = floor(phase + 0.5);
  float breaking = (1.0 - smoothstep(0.5, 1.9, depth)) * smoothstep(0.3, 0.62, vnoise(xz * 0.09 + wave * 3.1)) * uSeaState;
  float trail = u < 0.0 ? smoothstep(-0.05 - aa, -0.03, u) : exp(-u * 5.0);
  float wash = (1.0 - smoothstep(0.0, 1.4, offshore)) * exp(-fract(cycle) * 3.0) * 0.6 * smoothstep(0.2, 0.55, vnoise(xz * 0.07 + floor(cycle) * 1.7));
  float foam = foamLace(max(breaking * trail, wash), xz + hash12(vec2(wave, 4.3)) * 37.0, fp);
  return vec3(foam, height, slope);
}

/** Foam lit by the sun and sky; backlit foam glows warm. */
vec3 foamColor(vec3 V, float sunVis) {
  float backlit = pow(max(dot(-V, normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 3.0);
  return FOAM * (uSunColor * (0.35 + 0.45 * backlit) * sunVis + hemiLight(vec3(0.0, 1.0, 0.0)) * 1.1);
}

/** Lays the swash over lit sand: the sheet tints and mirrors the sky, drained sand keeps a sheen, foam on top. */
vec3 shadeSwash(vec3 col, vec4 swash, vec3 wpos, float sunVis) {
  vec3 V = normalize(cameraPosition - wpos);
  vec2 wobble = vec2(vnoise(wpos.xz * 1.3 + uTime * 0.9), vnoise(wpos.xz * 1.2 - uTime * 0.8)) - 0.5;
  vec3 N = normalize(vec3(wobble.x * 0.015, 1.0, wobble.y * 0.015));
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  float sheet = swash.x;
  col *= mix(vec3(1.0), exp(-vec3(0.5, 0.13, 0.1) * min(swash.w, 1.5) * 0.12), sheet);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  col = mix(col, skyColor(R), F * 0.6 * (sheet + swash.z * 0.3));
  vec3 H = normalize(uSunDir + V);
  col += uSunColor * pow(max(dot(N, H), 0.0), 150.0) * (sheet + swash.z * 0.4) * 0.8 * sunVis;
  return mix(col, foamColor(V, sunVis), swash.y);
}
`;

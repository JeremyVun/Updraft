import * as THREE from 'three';
import { params } from '../params';
import { WINDOW, onWindowMove } from './window';

const [sunAz, sunEl] = params.sun ?? [52, 13];

function sunDirection(azDeg: number, elDeg: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/** Cloud shadows are baked each frame into a texture covering this square around the camera. */
export const CLOUD_SPAN = 1400;

function windowDomain(): THREE.Vector4 {
  return new THREE.Vector4(WINDOW.minX, WINDOW.minZ, 1 / WINDOW.size, 1 / WINDOW.size);
}

onWindowMove(() => atmo.uniforms.uDomain.value.set(WINDOW.minX, WINDOW.minZ, 1 / WINDOW.size, 1 / WINDOW.size));

function hdr(hex: string, intensity: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(intensity);
}

/**
 * Uniforms shared by reference between every world material, so one update per frame reaches all of them.
 * Spread them into a material's uniforms: `{ ...atmo.uniforms, ownUniform: {...} }`.
 */
export const atmo = {
  uniforms: {
    uTime: { value: 0 },
    uSunDir: { value: sunDirection(sunAz, sunEl) },
    uSunColor: { value: hdr('#ffd2a0', 2.7) },
    uSkyZenith: { value: hdr('#3f75b8', 1.0) },
    uSkyHorizon: { value: hdr('#d8c8c4', 0.95) },
    uSkyHorizonSun: { value: hdr('#ffb46a', 1.25) },
    uSkyAmbient: { value: hdr('#8fb2dc', 0.5) },
    uGroundBounce: { value: hdr('#a4895c', 0.22) },
    uFogDensity: { value: 0.0011 },
    /** 0 by day, 1 at full night: stars, fireflies, lit windows. */
    uNight: { value: 0 },
    /** How much of the world has come back to life, 0 grey and still to 1: sets the colour of the open sea. */
    uWorldLife: { value: 0 },
    /** 1 while the sea's mirror image is drawn: the ground paints its meadow instead of waiting for blades. */
    uMirrorPass: { value: 0 },
    /** 0 none, 1 a full rainbow opposite the sun (drawn by the sky). */
    uRainbow: { value: 0 },
    /** A passing shower, 0 dry to 1: wet sheen on the grass. */
    uShower: { value: 0 },
    uCloudShift: { value: new THREE.Vector2() },
    /** The world window (minX, minZ, 1/size, 1/size) for the wind, grass lean and height textures. */
    uDomain: { value: windowDomain() },
    /** The window the ground bake was made for; it can lag `uDomain` while a re-bake is under way. */
    uGroundDomain: { value: windowDomain() },
    uWindTex: { value: null as THREE.Texture | null },
    uBendTex: { value: null as THREE.Texture | null },
    uHeightTex: { value: null as THREE.Texture | null },
    uGroundTex: { value: null as THREE.Texture | null },
    uSurfaceTex: { value: null as THREE.Texture | null },
    uLifeTex: { value: null as THREE.Texture | null },
    /** Still island centre (x, z), radius, and how fully it counts as restored. */
    uIslandLife: { value: new THREE.Vector4(0, 0, 0, 0) },
    /** Green wave over the mainland: origin (x, z), radius (negative before it starts), softness. */
    uLifeWave: { value: new THREE.Vector4(0, 0, -1, 1) },
    uCloudTex: { value: null as THREE.Texture | null },
    uCloudDomain: { value: new THREE.Vector4(-CLOUD_SPAN / 2, -CLOUD_SPAN / 2, 1 / CLOUD_SPAN, 1 / CLOUD_SPAN) },
  },
};

export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return s / 0.9375;
}
`;

/** Declares the shared uniforms and the sky, fog, lighting and wind helpers. Include once per shader stage. */
export const ATMO_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyHorizonSun;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundBounce;
uniform float uFogDensity;
uniform float uNight;
uniform float uWorldLife;
uniform float uMirrorPass;
uniform float uShower;
uniform vec2 uCloudShift;
uniform vec4 uDomain;
uniform vec4 uGroundDomain;
uniform sampler2D uWindTex;
uniform sampler2D uBendTex;
uniform sampler2D uHeightTex;
uniform sampler2D uGroundTex;
uniform sampler2D uSurfaceTex;
uniform sampler2D uLifeTex;
uniform vec4 uIslandLife;
uniform vec4 uLifeWave;
uniform sampler2D uCloudTex;
uniform vec4 uCloudDomain;

${NOISE_GLSL}

vec2 domainUv(vec2 xz) {
  return (xz - uDomain.xy) * uDomain.zw;
}

bool insideUv(vec2 uv) {
  return all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
}

/** xyz: terrain normal, w: sun visibility from the baked hill shadows (open sky outside the window). */
vec4 groundAt(vec2 xz) {
  vec2 uv = (xz - uGroundDomain.xy) * uGroundDomain.zw;
  if (!insideUv(uv)) return vec4(0.0, 1.0, 0.0, 1.0);
  vec4 g = texture(uGroundTex, uv);
  return vec4(normalize(g.xyz * 2.0 - 1.0), g.w);
}

/** How alive the land is, 0 (grey and still) to 1: the life field in the window, and regions the story has restored. */
float regionLife(vec2 xz) {
  float island = length(xz - uIslandLife.xy) < uIslandLife.z ? uIslandLife.w : 0.0;
  float d = length(xz - uLifeWave.xy);
  float wave = uLifeWave.z < 0.0 ? 0.0 : clamp((uLifeWave.z - d) / uLifeWave.w, 0.0, 1.0);
  return max(island, wave);
}
float lifeAt(vec2 xz) {
  vec2 uv = domainUv(xz);
  float local = insideUv(uv) ? texture(uLifeTex, uv).r : 0.0;
  return max(local, regionLife(xz));
}

/** The grey of the still world for a living colour: its luminance, a touch warm, a touch dim. */
vec3 stillGrey(vec3 c) {
  return vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.0, 0.97, 0.9) * 0.92;
}

/** x: open ground (0 under rocks and trunks), y: spare, z: wildflowers, w: spare. Baked with the ground. */
vec4 surfaceAt(vec2 xz) {
  vec2 uv = (xz - uGroundDomain.xy) * uGroundDomain.zw;
  if (!insideUv(uv)) return vec4(1.0, 0.0, 0.0, 0.0);
  return texture(uSurfaceTex, uv);
}

vec3 skyColor(vec3 d) {
  float y = d.y;
  float h = clamp(y, 0.0, 1.0);
  float sd = max(dot(d, uSunDir), 0.0);
  vec3 col = mix(uSkyHorizon, uSkyZenith, pow(h, 0.38));
  float toward = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 2.5);
  col = mix(col, uSkyHorizonSun, toward * pow(1.0 - h, 3.0) * 0.95);
  col += uSunColor * (0.025 * pow(sd, 5.0) + 0.1 * pow(sd, 40.0) + 0.45 * pow(sd, 500.0));
  if (y < 0.0) col = mix(col, mix(uSkyHorizon, uSkyHorizonSun, toward * 0.6) * 0.92, clamp(-y * 8.0, 0.0, 1.0));
  return col;
}

vec3 hemiLight(vec3 n) {
  return mix(uGroundBounce, uSkyAmbient, n.y * 0.5 + 0.5);
}

/** Sun let through by the drifting clouds, baked each frame by world/clouds.ts. */
float cloudShadow(vec2 xz) {
  return texture(uCloudTex, (xz - uCloudDomain.xy) * uCloudDomain.zw).r;
}

/** rgb: haze colour toward this point, a: how much haze covers it. Cheap enough to evaluate per vertex. */
vec4 fogOf(vec3 wpos) {
  vec3 rd = wpos - cameraPosition;
  float dist = length(rd);
  rd /= dist;
  float heightFactor = exp(-max(wpos.y, 0.0) * 0.06);
  float amt = 1.0 - exp(-dist * uFogDensity * (0.55 + 0.65 * heightFactor));
  vec3 fogCol = skyColor(normalize(vec3(rd.x, 0.015 + max(rd.y, 0.0) * 0.25, rd.z))) * vec3(0.84, 0.87, 0.92);
  return vec4(fogCol, clamp(amt, 0.0, 1.0));
}

vec3 applyFog(vec3 col, vec3 wpos) {
  vec4 f = fogOf(wpos);
  return mix(col, f.rgb, f.a);
}
`;

export const CLOUD_SHADOW_GLSL = /* glsl */ `
uniform vec2 uCloudShift;
${NOISE_GLSL}
float cloudShadowAt(vec2 xz) {
  vec2 p = (xz - uCloudShift) * 0.011;
  float c = smoothstep(0.5, 0.78, fbm(p + vec2(3.7, 1.3)));
  return 1.0 - c * 0.62;
}
`;

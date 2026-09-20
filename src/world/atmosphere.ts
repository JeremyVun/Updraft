import { LANE_GLSL } from './lane';
import { SKY_RADIANCE_GLSL } from './sky-radiance';
import * as THREE from 'three';
import { params } from '../params';
import { glsl, tuning } from '../tuning';
import { WINDOW, onWindowMove } from './window';
import { MUSIC_GROWTH_GLSL } from './music-growth';

/** North of this z the world is already living: the sea between the first island and the second. */
export const LIVING_BEYOND = -150;

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
    /** 1 once the last of the day has gone out of the sky and the weather is clear: the sea catches the stars. */
    uStarlight: { value: 0 },
    /** How much of the world has come back to life, 0 grey and still to 1: sets the colour of the open sea. */
    uWorldLife: { value: 0 },
    /**
     * How far through the turn of the year the story has got, 0 late autumn to 1 the frozen night at the end.
     * It only ever rises. The grass keeps the green it is loved for and ages inside it.
     */
    uSeason: { value: 0 },
    /** 1 while the sea's mirror image is drawn: the ground paints its meadow instead of waiting for blades. */
    uMirrorPass: { value: 0 },
    /** Centre x/z and radius: positive keeps this room, negative conceals it, zero shows all. */
    uRoom: { value: new THREE.Vector3(0, 0, 0) },
    /** 0 none, 1 a full rainbow opposite the sun (drawn by the sky). */
    uRainbow: { value: 0 },
    /** A passing shower, 0 dry to 1: wet sheen on the grass. */
    uShower: { value: 0 },
    uStormCover: { value: 0 },
    uHarbourLight: { value: new THREE.Vector4(0, 0, 0, 0) },
    uHarbourDirection: { value: new THREE.Vector3(0, 0, 1) },
    /** Direction of sheet lightning in the clouds, and its current strength. */
    uLightning: { value: new THREE.Vector4(0, 0.32, -1, 0) },
    /** Mist lying in the low ground, 0 clear to 1: thick in the still world and after dark. */
    uMist: { value: 0 },
    /**
     * The veil: how far you can see before the world dissolves (x, world units) and how hard it dissolves (y).
     * Unlike mist it does not care about height, so the island ahead is a rumour until you are nearly on it.
     */
    uVeil: { value: new THREE.Vector2(1e5, 0) },
    /** Offshore fog converges to the sky itself, then releases on the approach to home. */
    uOpenSea: { value: 0 },
    /** An island's offshore veil is anchored to its coast, so looking from a hill cannot expose the next room. */
    uIslandVeil: { value: new THREE.Vector4(0, 0, 1, 1) },
    uIslandVeilAmount: { value: 0 },
    uCloudShift: { value: new THREE.Vector2() },
    /** The world window (minX, minZ, 1/size, 1/size) for the wind, grass lean and height textures. */
    uDomain: { value: windowDomain() },
    /** The window the ground bake was made for; it can lag `uDomain` while a re-bake is under way. */
    uGroundDomain: { value: windowDomain() },
    uWindTex: { value: null as THREE.Texture | null },
    uBendTex: { value: null as THREE.Texture | null },
    /** The wind hanging things feel, on its spring: xy the sprung wind in world units per second, zw its rate. */
    uSwayTex: { value: null as THREE.Texture | null },
    /** How hard air with no gust in it can be felt; see `feltWind`. */
    uCalm: { value: 0 },
    uHeightTex: { value: null as THREE.Texture | null },
    uGroundTex: { value: null as THREE.Texture | null },
    uSurfaceTex: { value: null as THREE.Texture | null },
    uLifeTex: { value: null as THREE.Texture | null },
    /** Still island centre (x, z), radius, and how fully it counts as restored. */
    uIslandLife: { value: new THREE.Vector4(0, 0, 0, 0) },
    /** Land north of this z is already living: only the first island was ever grey. */
    uLivingBeyond: { value: LIVING_BEYOND },
    /** An island held back from that, waiting for its own green wave: centre (x, z) and radii, or radii 0. */
    uWaiting: { value: new THREE.Vector4(0, 0, 0, 0) },
    /** The light the player has made out of the embers: where it is (xyz) and how strong (w). */
    uEmberLight: { value: new THREE.Vector4(0, 0, 0, 0) },
    /**
     * The sleeping island's ground fog: where it pools (x, z), how far out it reaches, and how thick it is.
     * At thickness 0 the whole of it, and so every other room, costs one comparison.
     */
    uHollow: { value: new THREE.Vector4(0, 0, 1, 0) },
    /** The height its top surface lies at, and how softly it gives out there. */
    uHollowTop: { value: new THREE.Vector2(0, 2.5) },
    uHollowTint: { value: hdr('#b9c6d8', 1.0) },
    /** What the player's gestures have carved out of it: 1 fog, 0 clear air, over the square in `uCarveDomain`. */
    uCarveTex: { value: null as THREE.Texture | null },
    uCarveDomain: { value: new THREE.Vector4(0, 0, 1, 1) },
    /** Frost creeping in toward the bed: the bed (x, z), how near it the frost has come, and how hard, 0 to 1. */
    uFrost: { value: new THREE.Vector4(0, 0, 1e4, 0) },
    /** The lane the morning comes down: from (x, z) to (x, z), with half width and how far open in `uLaneOpen`. */
    uLane: { value: new THREE.Vector4(0, 0, 0, 0) },
    uLaneOpen: { value: new THREE.Vector2(3, 0) },
    /** The bedside lamp, the one warm light in the blue: where it is (xyz) and how strong (w). */
    uLamp: { value: new THREE.Vector4(0, 0, 0, 0) },
    uHearth: { value: new THREE.Vector4(0, 0, 0, 0) },
    /** The morning coming down the sleeping island's hill: how far it has come (x), and the height it has reached down to (y). */
    uDawn: { value: new THREE.Vector2(0, 0) },
    /** Summit window xyz and curtain opening; the lane is lit from its actual source. */
    uDawnSource: { value: new THREE.Vector4(0, 0, 0, 0) },
    /** Brief window light touching the pillow before the bird commits to the climb. */
    uSleepHint: { value: new THREE.Vector4(0, 0, 0, 0) },
    /** A local bank on the winter shoulder: same continuous fog integration, cleared by the player's sweep. */
    uSleepMist: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSleepMistPart: { value: 0 },
    uSleepMistAxis: { value: new THREE.Vector2(.4472136,-.8944272) },
    /** A patch of grass someone has pressed flat: centre (x, z), radius, and how flat, 0 to 1. */
    uTrodden: { value: new THREE.Vector4(0, 0, 1, 0) },
    /** Green wave over the mainland: origin (x, z), radius (negative before it starts), softness. */
    uLifeWave: { value: new THREE.Vector4(0, 0, -1, 1) },
    uCloudTex: { value: null as THREE.Texture | null },
    uCloudDomain: { value: new THREE.Vector4(-CLOUD_SPAN / 2, -CLOUD_SPAN / 2, 1 / CLOUD_SPAN, 1 / CLOUD_SPAN) },
  },
};

/**
 * The wind as a hanging thing feels it, from a sample of the wind texture. Mirrors `feltWind` in `wind/field.ts`.
 */
export const FELT_GLSL = /* glsl */ `
vec2 feltWind(vec4 w, float calm) {
  float s = length(w.xy);
  if (s < 1e-4) return vec2(0.0);
  float arrived = smoothstep(${glsl(tuning.wind.arriveFrom)}, ${glsl(tuning.wind.arriveFull)}, w.z);
  float quiet = calm * (1.0 - exp(-s / max(calm, 1e-3)));
  return w.xy * (mix(quiet, s, arrived) / s);
}`;

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
uniform float uStormCover;
uniform vec4 uHarbourLight;
uniform vec3 uHarbourDirection;
uniform vec4 uLightning;
uniform vec3 uGroundBounce;
uniform float uFogDensity;
uniform float uNight;
uniform float uStarlight;
uniform float uWorldLife;
uniform float uSeason;
uniform float uMirrorPass;
uniform float uShower;
uniform float uMist;
uniform vec2 uVeil;
uniform float uOpenSea;
uniform vec4 uIslandVeil;
uniform float uIslandVeilAmount;
uniform vec3 uRoom;
/** Hidden land must also leave no shallows or surf in the water. */
bool roomHides(vec2 p) {
  float d = distance(p, uRoom.xy);
  return (uRoom.z > 0.0 && d > uRoom.z) || (uRoom.z < 0.0 && d < -uRoom.z);
}
uniform vec2 uCloudShift;
uniform vec4 uDomain;
uniform vec4 uGroundDomain;
uniform sampler2D uWindTex;
uniform sampler2D uBendTex;
uniform sampler2D uSwayTex;
uniform float uCalm;
uniform sampler2D uHeightTex;
uniform sampler2D uGroundTex;
uniform sampler2D uSurfaceTex;
uniform sampler2D uLifeTex;
uniform vec4 uIslandLife;
uniform float uLivingBeyond;
uniform vec4 uWaiting;
uniform vec4 uHollow;
uniform vec2 uHollowTop;
uniform vec3 uHollowTint;
uniform sampler2D uCarveTex;
uniform vec4 uCarveDomain;
uniform vec4 uFrost;
uniform vec4 uLamp;
uniform vec4 uHearth;
uniform vec2 uDawn;
uniform vec4 uDawnSource;
uniform vec4 uSleepHint;
uniform vec4 uSleepMist;
uniform float uSleepMistPart;
uniform vec2 uSleepMistAxis;
uniform vec4 uTrodden;
uniform vec4 uEmberLight;
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

${FELT_GLSL}

/** The sprung wind a hanging thing at xz swings on: xy in world units per second, zw its rate of change. */
vec4 swayAt(vec2 xz) {
  vec2 uv = domainUv(xz);
  return insideUv(uv) ? texture(uSwayTex, uv) : vec4(0.0);
}

/** xyz: terrain normal, w: sun visibility from the baked hill shadows (open sky outside the window). */
vec4 groundAt(vec2 xz) {
  vec2 uv = (xz - uGroundDomain.xy) * uGroundDomain.zw;
  if (!insideUv(uv)) return vec4(0.0, 1.0, 0.0, 1.0);
  vec4 g = texture(uGroundTex, uv);
  float clouded = smoothstep(${glsl(tuning.storm.shadowSoftenFrom)}, ${glsl(tuning.storm.shadowCovered)}, uStormCover);
  return vec4(normalize(g.xyz * 2.0 - 1.0), mix(g.w, 1.0, clouded));
}

/**
 * How alive the land is, 0 (grey and still) to 1: the life field in the window, and what the story has restored.
 * Only the first island was ever grey, so everything further north is living before the child ever reaches it and
 * nothing snaps into colour underfoot. One island can be held back from that, waiting for its own green wave.
 */
${MUSIC_GROWTH_GLSL}
float regionLife(vec2 xz) {
  float island = length(xz - uIslandLife.xy) < uIslandLife.z ? uIslandLife.w : 0.0;
  float ahead = xz.y < uLivingBeyond ? 1.0 : 0.0;
  if (uWaiting.z > 0.0 && length((xz - uWaiting.xy) / uWaiting.zw) < 1.0) ahead = 0.0;
  float wave = musicLife(xz - uLifeWave.xy, uLifeWave.z, uLifeWave.w);
  return max(max(island, ahead), wave);
}
/**
 * How much of its height a blade keeps here. Grass this deep swallows anything small standing in it, so where the
 * story needs a creature to be seen the ground it is on is pressed flat, the way a child sitting down flattens it.
 */
float troddenAt(vec2 xz) {
  if (uTrodden.w <= 0.0) return 1.0;
  vec2 d = xz - uTrodden.xy;
  /** Warped by noise, or a pressed patch reads as a mown circle rather than somewhere somebody sat down. */
  float r = length(d) / uTrodden.z * (0.78 + 0.5 * fbm(d * 0.22));
  return 1.0 - uTrodden.w * 0.6 * (1.0 - smoothstep(0.1, 1.05, r));
}

float lifeAt(vec2 xz) {
  vec2 uv = domainUv(xz);
  float local = insideUv(uv) ? texture(uLifeTex, uv).r : 0.0;
  return max(local, regionLife(xz));
}

/**
 * The one light in the dark wood, and the player made it. Embers fanned bright enough show what is near them, so
 * the way through and the thing hiding off it are found by putting light on them and by nothing else.
 */
vec3 emberLight(vec3 world, vec3 N) {
  if (uEmberLight.w <= 0.0) return vec3(0.0);
  vec3 d = uEmberLight.xyz - world;
  float dist = length(d);
  float fall = uEmberLight.w / (1.0 + dist * dist * 0.055);
  return vec3(1.0, 0.54, 0.2) * fall * clamp(dot(N, d / max(dist, 0.001)) * 0.55 + 0.45, 0.0, 1.0);
}

${LANE_GLSL}

/** The window wakes the turf along its spill, then the green opens across the whole island. */
float morningAt(vec2 xz) {
  if (uDawn.x <= 0.12) return 0.0;
  float spread = smoothstep(0.55, 1.0, uDawn.x);
  float radius = spread * 110.0;
  float island = spread * (1.0 - smoothstep(radius - 10.0, radius + 10.0, distance(xz, uLane.xy)));
  return max(laneAt(xz) * uDawnSource.w, island);
}

/** Frost on the grass: hard out at the rim of the hollow, closing in on the bed as the night goes on. */
float frostAt(vec2 xz) {
  if (uFrost.w <= 0.0) return 0.0;
  float d = distance(xz, uFrost.xy) * (0.86 + 0.28 * fbm(xz * 0.12));
  return uFrost.w * smoothstep(uFrost.z - 4.0, uFrost.z + 4.0, d) * (1.0 - laneAt(xz));
}

/** The bedside lamp: the one warm light in the blue, and the reason the bed is the warmest thing in frame. */
vec3 lampLight(vec3 world, vec3 N) {
  if (uLamp.w <= 0.0 && uHearth.w <= 0.0) return vec3(0.0);
  vec3 fire = uHearth.xyz - world;
  float reach=length(fire);
  vec3 hearth=vec3(1.0,.42,.12)*uHearth.w/(1.0+reach*reach*.32)
    * clamp(dot(N,fire/max(reach,.001))*.5+.5,0.0,1.0);
  vec3 d = uLamp.xyz - world;
  float dist = length(d);
  float fall = uLamp.w / (1.0 + dist * dist * 0.09);
  return hearth + vec3(1.0, 0.72, 0.38) * fall * clamp(dot(N, d / max(dist, 0.001)) * 0.5 + 0.5, 0.0, 1.0);
}

/**
 * The first sun: it stands on the top of the hill and comes down it as the morning does, and it comes down the
 * lane the wind has torn in the fog as well, so what rides that wind arrives with the light rather than after it.
 */
vec3 dawnLight(vec3 world, vec3 N) {
  if (uDawn.x <= 0.0 && uSleepHint.w <= 0.0) return vec3(0.0);
  vec3 toWindow = normalize(uDawnSource.xyz - world + vec3(0.0, 0.001, 0.0));
  float lane = laneAt(world.xz) * uDawnSource.w;
  float morning = morningAt(world.xz) * 0.22;
  float hint = uSleepHint.w * (1.0 - smoothstep(0.35, 1.4, distance(world, uSleepHint.xyz)));
  float reached = max(max(lane * (1.0 - 0.5 * smoothstep(0.65, 1.0, uDawn.x)), morning), hint);
  return vec3(1.0, 0.82, 0.57) * ${glsl(tuning.sleeping.dawnStrength)} * reached
    * clamp(dot(N, toWindow) * 0.45 + 0.55, 0.0, 1.0);
}

/** How thick the sleeping island's ground fog is at a point: pooled in the hollow, under its top, less where carved. */
float hollowDensity(vec3 p) {
  float pool = 1.0 - smoothstep(0.5, 1.0, length(p.xz - uHollow.xy) / uHollow.z);
  if (pool <= 0.0) return 0.0;
  float wisps = vnoise(p.xz * 0.16 + uCloudShift * 0.025 + p.y * 0.09);
  float top = uHollowTop.x + (wisps - 0.5) * 2.0;
  float under = 1.0 - smoothstep(top - uHollowTop.y, top + uHollowTop.y, p.y);
  vec2 uv = (p.xz - uCarveDomain.xy) * uCarveDomain.zw;
  float carve = insideUv(uv) ? texture(uCarveTex, uv).r : 1.0;
  /** Squared, so a lane only half blown open is already a quarter as thick: a gesture has to show. */
  vec3 delta=p-uSleepMist.xyz;
  vec3 bankPos=vec3(dot(delta.xz,uSleepMistAxis),delta.y,dot(delta.xz,vec2(-uSleepMistAxis.y,uSleepMistAxis.x)))/vec3(5.5,3.2,4.5);
  bankPos.x=abs(bankPos.x)-uSleepMistPart*2.1;
  float bank=(1.0-smoothstep(0.25,1.15,length(bankPos)+(wisps-.5)*.3))*uSleepMist.w;
  return uHollow.w * pool * under * (0.35 + wisps * 1.1) * carve * carve + bank * .8;
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

/** The lighthouse's sweep catches nearby rain, water and the travellers; it cannot kindle embers. */
vec3 harbourLight(vec3 world) {
  if (uHarbourLight.w <= 0.001) return vec3(0.0);
  vec3 d = world - uHarbourLight.xyz;
  float dist = length(d);
  float cone = smoothstep(0.968, 0.994, dot(d / max(dist, 0.001), uHarbourDirection));
  float fall = 1.0 - smoothstep(35.0, 95.0, dist);
  return vec3(0.9, 0.78, 0.52) * cone * fall * uHarbourLight.w;
}

vec3 hemiLight(vec3 n) {
  return mix(uGroundBounce, uSkyAmbient, n.y * 0.5 + 0.5);
}

/** Sun let through by the drifting clouds, baked each frame by world/clouds.ts. */
float cloudShadow(vec2 xz) {
  vec2 uv = (xz - uCloudDomain.xy) * uCloudDomain.zw;
  vec2 edge = min(uv, 1.0 - uv);
  /** Past the sheet the edge texel would streak out over the world as a hard wedge, so it opens to clear sky. */
  return mix(1.0, texture(uCloudTex, clamp(uv, 0.0, 1.0)).r, smoothstep(0.0, 0.04, min(edge.x, edge.y)));
}

${SKY_RADIANCE_GLSL}

/** rgb: haze colour toward this point, a: how much haze covers it. Cheap enough to evaluate per vertex. */
vec4 fogOf(vec3 wpos) {
  vec3 rd = wpos - cameraPosition;
  float dist = length(rd);
  rd /= dist;
  float heightFactor = exp(-max(wpos.y, 0.0) * 0.06);
  float mist = uMist * exp(-max(min(wpos.y, cameraPosition.y), 0.0) * 0.22);
  float veil = max(0.0, dist - uVeil.x) * uVeil.y;
  float amt = 1.0 - exp(-dist * (uFogDensity * (0.55 + 0.65 * heightFactor) + mist * 0.0075) - veil);
  vec3 fogCol = skyColor(normalize(vec3(rd.x, 0.015 + max(rd.y, 0.0) * 0.25, rd.z))) * vec3(0.84, 0.87, 0.92);
  // Ordinary haze has its own tint. Far offshore that tint must not reveal the outline of an island.
  if (uOpenSea > 0.001 && veil > 0.0) {
    float open = uOpenSea * smoothstep(1.0, 4.0, veil);
    fogCol = mix(fogCol, skyRadiance(rd), open);
    amt = max(amt, open);
  }
  /** The ground fog of the sleeping island, taken along the eye ray at both ends and the middle of it. */
  if (uHollow.w > 0.0) {
    vec3 mid = (cameraPosition + wpos) * 0.5;
    float dens = (hollowDensity(cameraPosition) + 2.0 * hollowDensity(mid) + hollowDensity(wpos)) * 0.25;
    float nearClear = smoothstep(${glsl(tuning.sleeping.fogNear)}, ${glsl(tuning.sleeping.fogFar)}, dist);
    // A short local bank can lie between all three global fog samples. Integrate its ray chord explicitly.
    vec3 delta=cameraPosition-uSleepMist.xyz;
    vec2 forward=vec2(-uSleepMistAxis.y,uSleepMistAxis.x);
    vec3 bankOrigin=vec3(dot(delta.xz,uSleepMistAxis),delta.y,dot(delta.xz,forward))/vec3(5.5,3.2,4.5);
    vec3 bankRay=vec3(dot(rd.xz,uSleepMistAxis),rd.y,dot(rd.xz,forward))/vec3(5.5,3.2,4.5);
    float closest=clamp(-dot(bankOrigin,bankRay)/max(dot(bankRay,bankRay),1e-5),0.0,dist);
    vec3 bankSample=bankOrigin+bankRay*closest;
    bankSample.x=abs(bankSample.x)-uSleepMistPart*2.1;
    float radial=length(bankSample);
    float bank=(1.0-smoothstep(.25,1.15,radial))*uSleepMist.w*smoothstep(2.5,10.0,dist);
    float pooled = 1.0 - exp(-dist * dens * ${glsl(tuning.sleeping.fogExtinction)} * nearClear - bank*2.5);
    vec3 mistLight = uHollowTint * (uSkyAmbient * 0.9 + uSunColor * 0.24) + vec3(.10,.12,.16)*bank;
    mistLight += vec3(1.0, 0.8, 0.55) * laneAt(mid.xz) * uDawnSource.w * 0.15;
    fogCol = mix(fogCol, mistLight, pooled / max(pooled + amt, 1e-4));
    amt = 1.0 - (1.0 - amt) * (1.0 - pooled);
  }
  // Land, its props, reflections and the sea all reach the same sky colour beyond this coast.
  // Camera-distance fog alone can leave a tinted island silhouette even when fully opaque.
  if (uIslandVeilAmount > 0.0) {
    float coast = length((wpos.xz - uIslandVeil.xy) / uIslandVeil.zw);
    float hidden = smoothstep(${glsl(tuning.world.meadowVeilFrom)}, ${glsl(tuning.world.meadowVeilTo)}, coast) * uIslandVeilAmount;
    if (hidden > 0.0) {
      fogCol = mix(fogCol, skyRadiance(rd), hidden);
      amt = max(amt, hidden);
    }
  }
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

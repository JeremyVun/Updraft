import { journeyRooms, journeyReveal, JOURNEY_ROOMS_GLSL } from './journey-rooms';
import { LANE_GLSL } from './lane';
import { SKY_RADIANCE_GLSL } from './sky-radiance';
import * as THREE from 'three';
import { params } from '../params';
import { glsl, tuning } from '../tuning';
import { WINDOW, onWindowMove } from './window';
import { MUSIC_GROWTH_GLSL } from './music-growth';
import { ISLES } from './heightfield';
import { HOME_JETTY } from './home-layout';
import { NOISE_TILES_GLSL, noiseTileUniforms } from './noise-tiles';

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
    /** At most two physical rooms, shared by land, grass, props and reflected views. */
    uJourneyRooms: journeyRooms,
    uJourneyVeils: journeyReveal.veils,
    uJourneyVeilAmounts: journeyReveal.amounts,
    /** Doorway override: positive keeps this room, negative conceals it, zero uses the journey. */
    uRoom: { value: new THREE.Vector3(0, 0, 0) },
    /** 0 none, 1 a full rainbow (drawn by the sky). */
    uRainbow: { value: 0 },
    /** Where the bow is centred. Opposite the sun in nature; a chapter places it where the walk will see it. */
    uRainbowAxis: { value: new THREE.Vector3(0, -0.5, -1).normalize() },
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
    uHomeHaze: { value: 0 },
    /** An island's offshore veil is anchored to its coast, so looking from a hill cannot expose the next room. */
    uIslandVeil: { value: new THREE.Vector4(0, 0, 1, 1) },
    uIslandVeilAmount: { value: 0 },
    /**
     * The island ahead lies in its own mist (centre, radii) beyond a distance from the eye: near, far, amount,
     * and how far out over the water the bank thins away, in coast radii.
     */
    uIsleMist: { value: new THREE.Vector4(0, 0, 1, 1) },
    uIsleMistRange: { value: new THREE.Vector4(0, 1, 0, 1.32) },
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
    /**
     * The low cloud deck over the stairs: centre (x, z), how far out it lies, and how much of it there is.
     * At amount 0 every other room pays one comparison for it.
     */
    uCloudDeck: { value: new THREE.Vector4(0, 0, 1, 0) },
    /** Its base and top heights, how thick it is inside, and how thick it still is in the clear air round the child. */
    uCloudDeckY: { value: new THREE.Vector4(0, 1, 0.5, 0.05) },
    /** The pocket of thinner cloud the story keeps round whoever is climbing through it: centre and radius. */
    uCloudBubble: { value: new THREE.Vector4(0, -1e4, 0, 0) },
    /**
     * A bank of mist standing across the way over the cloud, and later round the boat on the sea: a point on its
     * front (x, z) and the way into it (z, w). Only drawn with the deck.
     */
    uFogBank: { value: new THREE.Vector4(0, 0, 0, 1) },
    /** Its floor and top heights, how deep it is from its front to its back, and how much of it there is. */
    uFogBankShape: { value: new THREE.Vector4(0, 1, 1, 0) },
    /** The light of its white (rgb) and how brightly the low sun glows through it (a). */
    uFogBankLight: { value: new THREE.Vector4(1, 1, 1, 0) },
    /** How clear the pocket round the boat is kept in it (the deck's pocket, `uCloudBubble`), 0 to 1. */
    uFogBankClear: { value: 0 },
    uCloudTex: { value: null as THREE.Texture | null },
    uCloudDomain: { value: new THREE.Vector4(-CLOUD_SPAN / 2, -CLOUD_SPAN / 2, 1 / CLOUD_SPAN, 1 / CLOUD_SPAN) },
    uNoiseTile: noiseTileUniforms.uNoiseTile,
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

/** Value noise with its gradient (yz), from the same four hashes as vnoise. Needs NOISE_GLSL or ATMO_GLSL first. */
export const NOISE_GRAD_GLSL = /* glsl */ `
vec3 vnoiseGrad(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * vec2(b - a + k * u.y, c - a + k * u.x));
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
uniform float uHomeHaze;
uniform vec4 uIslandVeil;
uniform float uIslandVeilAmount;
uniform vec4 uIsleMist;
uniform vec4 uIsleMistRange;
uniform vec3 uRoom;
uniform vec4 uJourneyVeils[2];
uniform vec2 uJourneyVeilAmounts;
${JOURNEY_ROOMS_GLSL}
/** Hidden land must also leave no shallows or surf in the water. */
bool roomHides(vec2 p) {
  float d = distance(p, uRoom.xy);
  if (uRoom.z > 0.0) return d > uRoom.z;
  return journeyHides(p) || (uRoom.z < 0.0 && d < -uRoom.z);
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
uniform vec4 uCloudDeck;
uniform vec4 uCloudDeckY;
uniform vec4 uCloudBubble;
uniform vec4 uFogBank;
uniform vec4 uFogBankShape;
uniform vec4 uFogBankLight;
uniform float uFogBankClear;
uniform sampler2D uCloudTex;
uniform vec4 uCloudDomain;

${NOISE_GLSL}
${NOISE_TILES_GLSL}

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
  float d = distance(xz, uFrost.xy) * (0.86 + 0.28 * tiledFbmFixed(xz * 0.12));
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
  // Straight up or down has no compass bearing; normalizing it would be undefined.
  float toward = dot(d.xz, d.xz) > 1e-8 ? pow(max(dot(normalize(d.xz), normalize(uSunDir.xz)), 0.0), 2.5) : 0.0;
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

/** 0 within hide metres of the lens, 1 beyond show: a large prop passing the camera fades instead of filling the view. */
float nearFade(vec3 world, float hide, float show) {
  return smoothstep(hide, show, distance(world, cameraPosition));
}

/** The half vector for highlights; looking straight back along the light it has no direction, so there is no highlight. */
vec3 halfVector(vec3 l, vec3 v) {
  vec3 h = l + v;
  float len2 = dot(h, h);
  return len2 > 1e-12 ? h * inversesqrt(len2) : vec3(0.0);
}

vec3 hemiLight(vec3 n) {
  return mix(uGroundBounce, uSkyAmbient, n.y * 0.5 + 0.5);
}

/**
 * How the bank of mist heaves at a point across it (v) and into it (u): x how far its front stands out from its
 * line, y how far its top heaves above or below its height. It rolls slowly sideways.
 */
vec2 bankHeave(float v, float u) {
  vec2 q = vec2(v + uTime * 0.7, u);
  float big = vnoise(q * vec2(0.012, 0.02) + 3.1);
  float mid = vnoise(q * vec2(0.037, 0.05) + 7.7);
  float fine = vnoise(q * vec2(0.1, 0.1) + 1.3);
  // Its front lies straight across the way itself, so the boat goes into it where the story expects.
  float front = ((big - 0.5) * 34.0 + (mid - 0.5) * 12.0) * smoothstep(30.0, 120.0, abs(v));
  return vec2(front, (big - 0.5) * 18.0 + (mid - 0.5) * 10.0 + (fine - 0.5) * 3.0);
}
/** The height of its top across it: highest where the way goes into it, and down into the cloud toward its ends. */
float bankTop(float v, float heave) {
  float tall = uFogBankShape.y - uFogBankShape.x;
  return uFogBankShape.x + (tall + heave) * (1.0 - smoothstep(150.0, 460.0, abs(v)));
}
/** How thick the bank is at a point, 0 to 1, without its thicker floor. */
float bankAt(vec3 p) {
  if (uFogBankShape.w <= 0.0) return 0.0;
  vec2 o = p.xz - uFogBank.xy;
  float u = dot(o, uFogBank.zw), v = dot(o, vec2(-uFogBank.w, uFogBank.z));
  vec2 heave = bankHeave(v, u);
  float into = u - heave.x;
  float body = clamp(into / ${glsl(tuning.stairs.bankFront)}, 0.0, 1.0)
    * clamp((uFogBankShape.z - into) / ${glsl(tuning.stairs.bankBack)}, 0.0, 1.0);
  float top = bankTop(v, heave.y);
  float under = 1.0 - clamp((p.y - top + ${glsl(tuning.stairs.bankSoft)}) / ${glsl(tuning.stairs.bankSoft)}, 0.0, 1.0);
  return uFogBankShape.w * body * under * step(uFogBankShape.x, p.y);
}

/** Sun let through by the drifting clouds, baked each frame by world/clouds.ts. */
float cloudShadow(vec2 xz) {
  vec2 uv = (xz - uCloudDomain.xy) * uCloudDomain.zw;
  vec2 edge = min(uv, 1.0 - uv);
  /** Past the sheet the edge texel would streak out over the world as a hard wedge, so it opens to clear sky. */
  float lit = mix(1.0, texture(uCloudTex, clamp(uv, 0.0, 1.0)).r, smoothstep(0.0, 0.04, min(edge.x, edge.y)));
  // Under the stairs' cloud deck most of the sun is gone; what is left is the low sun slipping in under its far edge.
  if (uCloudDeck.w > 0.0) {
    float under = 1.0 - smoothstep(uCloudDeckY.x - 2.0, uCloudDeckY.y, cameraPosition.y);
    lit *= 1.0 - 0.55 * uCloudDeck.w * under;
    // In the white of the bank of mist the sun comes through it softly, from all round.
    lit *= 1.0 - 0.5 * bankAt(cameraPosition);
  }
  return lit;
}

${SKY_RADIANCE_GLSL}


/** The part of [0, far] along a ray that lies between two heights. */
vec2 deckSlab(vec3 ro, vec3 rd, float base, float top, float far) {
  if (abs(rd.y) < 1e-5) return ro.y > base && ro.y < top ? vec2(0.0, far) : vec2(1.0, 0.0);
  float a = (base - ro.y) / rd.y;
  float b = (top - ro.y) / rd.y;
  return vec2(max(min(a, b), 0.0), min(max(a, b), far));
}
/** The part of a ray inside a vertical cylinder of radius r about (c.x, c.y). */
vec2 deckColumn(vec3 ro, vec3 rd, vec2 c, float r) {
  vec2 o = ro.xz - c;
  float a = dot(rd.xz, rd.xz);
  if (a < 1e-8) return dot(o, o) < r * r ? vec2(0.0, 1e9) : vec2(1.0, 0.0);
  float b = dot(o, rd.xz);
  float h = b * b - a * (dot(o, o) - r * r);
  if (h < 0.0) return vec2(1.0, 0.0);
  h = sqrt(h);
  return vec2((-b - h) / a, (-b + h) / a);
}
vec2 deckSphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 o = ro - c;
  float b = dot(o, rd);
  float h = b * b - dot(o, o) + r * r;
  if (h < 0.0) return vec2(1.0, 0.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
float deckSpan(vec2 a, vec2 b) {
  return max(0.0, min(a.y, b.y) - max(a.x, b.x));
}

/**
 * How much of the stairs' deck hangs over a point as it is seen from below: whole over the stair, and further out
 * breaking up into separate clouds with the sky between them. Whole while the deck is down on the sea as fog.
 */
float deckCover(vec2 xz) {
  float open = smoothstep(58.0, 125.0, length(xz - uCloudDeck.xy)) * smoothstep(8.0, 16.0, uCloudDeckY.x);
  if (open <= 0.0) return 1.0;
  vec2 q = xz + uCloudShift * 0.5;
  float n = vnoise(q * 0.014 + 4.1) * 0.6 + vnoise(q * 0.037 + 1.3) * 0.28 + vnoise(q * 0.1 + 8.2) * 0.12;
  return smoothstep(0.0, 0.13, n - mix(-0.25, 0.55, open));
}

/**
 * The underside of the deck at xz as seen from ro: lilac in the body of the cloud, and the low sun coming in under
 * its far edge lighting it gold and rose, the more toward the sun and the further off. Its thin edges are lit
 * through. thin is 0 in the body of a cloud and 1 at its edge.
 */
vec3 deckUnderside(vec2 xz, vec3 ro, float thin) {
  vec2 away = xz - ro.xz;
  float reach = length(away);
  float toward = reach > 1.0 ? dot(away / reach, normalize(uSunDir.xz + 1e-5)) * 0.5 + 0.5 : 0.5;
  float far = smoothstep(25.0, 420.0, reach);
  vec3 body = uSkyAmbient * vec3(0.95, 0.72, 0.85) + uGroundBounce * 0.3 + uSunColor * vec3(0.02, 0.012, 0.016);
  vec3 rose = uSunColor * vec3(0.9, 0.7, 0.85);
  vec3 glow = rose * (0.03 + 0.06 * toward) + uSunColor * pow(toward, 4.0) * (0.12 + 0.55 * far);
  return body + glow * (0.5 + 0.9 * far) + uSunColor * thin * (0.1 + 0.3 * toward);
}

float rampArea(float x, float w) {
  return x <= 0.0 ? 0.0 : x < w ? x * x / (2.0 * w) : x - 0.5 * w;
}
/**
 * How much of the stretch [t0, t1] of a sightline lies past a soft edge, along which some measure goes a + b t: the
 * edge begins where that measure is lo and is whole w further on.
 */
float pastEdge(float a, float b, float t0, float t1, float lo, float w) {
  if (abs(b) < 2e-3) return clamp((a + b * 0.5 * (t0 + t1) - lo) / w, 0.0, 1.0) * (t1 - t0);
  return (rampArea(a + b * t1 - lo, w) - rampArea(a + b * t0 - lo, w)) / b;
}

/**
 * The bank of mist along a sightline of length far: rgb its light, a how much of the view it covers. It stands
 * on its floor beyond a line across the way, soft and heaving along its front and its top, thick all through and
 * thicker still low down over its floor; far enough in it is nothing but white, but for the pocket kept round the
 * boat. Lit through by the low sun: glowing toward it, brightest along its top.
 */
vec4 fogBank(vec3 ro, vec3 rd, float far) {
  vec2 n = uFogBank.zw;
  vec2 o = ro.xz - uFogBank.xy;
  float u0 = dot(o, n), du = dot(rd.xz, n);
  float v0 = dot(o, vec2(-n.y, n.x)), dv = dot(rd.xz, vec2(-n.y, n.x));
  // Its front and top as they are where the sightline comes to it, or just ahead if it is in the bank already.
  float meet = u0 < 0.0 ? (du > 1e-4 ? -u0 / du : far) : 8.0;
  if (meet >= far) return vec4(0.0);
  vec2 heave = bankHeave(v0 + dv * meet, max(0.0, u0 + du * meet));
  float into0 = u0 - heave.x;
  float top = bankTop(v0 + dv * meet, heave.y);
  float fl = uFogBankShape.x, deep = uFogBankShape.z;
  vec2 span = deckSlab(ro, rd, fl, top, far);
  if (abs(du) > 1e-5) {
    float a = -into0 / du, b = (deep - into0) / du;
    span = vec2(max(span.x, min(a, b)), min(span.y, max(a, b)));
  } else if (into0 < 0.0 || into0 > deep) return vec4(0.0);
  float len = span.y - span.x;
  if (len <= 0.0) return vec4(0.0);
  const float FRONT = ${glsl(tuning.stairs.bankFront)}, BACK = ${glsl(tuning.stairs.bankBack)};
  const float SOFT = ${glsl(tuning.stairs.bankSoft)}, LOW = ${glsl(tuning.stairs.bankLow)};
  float along = pastEdge(into0, du, span.x, span.y, 0.0, FRONT) - pastEdge(into0, du, span.x, span.y, deep - BACK, BACK);
  float high = len - pastEdge(ro.y, rd.y, span.x, span.y, top - SOFT, SOFT);
  float y0 = ro.y + rd.y * span.x - fl, y1 = ro.y + rd.y * span.y - fl;
  float low = abs(rd.y) > 1e-3 ? LOW * (exp(-y0 / LOW) - exp(-y1 / LOW)) / rd.y : exp(-0.5 * (y0 + y1) / LOW) * len;
  float thick = ${glsl(tuning.stairs.bankDensity)} * uFogBankShape.w;
  float depth = along / len * (thick * high + ${glsl(tuning.stairs.bankFloor)} * uFogBankShape.w * low);
  if (uCloudBubble.w > 0.0 && uFogBankClear > 0.0) {
    float cleared = 0.55 * deckSpan(span, deckSphere(ro, rd, uCloudBubble.xyz, uCloudBubble.w))
      + 0.45 * deckSpan(span, deckSphere(ro, rd, uCloudBubble.xyz, uCloudBubble.w * 0.6));
    depth = max(0.0, depth - uFogBankClear * thick * cleared);
  }
  float cover = 1.0 - exp(-depth);
  // Its texture is its own, across it and into it, so it is the same wherever the bank is put.
  float near = min(span.x + 5.0, span.y), deeper = min(span.x + 13.0, span.y);
  float up = clamp((ro.y + rd.y * near - fl) / max(top - fl, 1.0), 0.0, 1.0);
  float billow = vnoise(vec2(v0 + dv * near, u0 + du * near) * 0.11 + (ro.y + rd.y * near - fl) * 0.07) * 0.5
    + vnoise(vec2(v0 + dv * deeper + uTime * 0.6, u0 + du * deeper) * 0.05) * 0.5;
  float toward = max(0.0, dot(rd, uSunDir));
  // Seen from outside, its face is in its own shade, the low sun being beyond it, and lighter toward its top.
  vec3 face = uFogBankLight.rgb * vec3(0.5, 0.5, 0.6) * mix(0.82, 1.18, up) * (0.78 + 0.44 * billow)
    + uSunColor * uFogBankLight.a * pow(toward, 3.0) * 0.06;
  // From inside it is white all round, and lighter toward the sun; long wisps of it stream past level as the boat
  // goes, nearer ones faster than those further off.
  vec2 wisp = vec2(u0, v0) + vec2(du, dv) * 8.0, further = vec2(u0, v0) + vec2(du, dv) * 20.0;
  float streaming = smoothstep(0.3, 0.8, vnoise(vec2(wisp.x * 0.1, wisp.y * 0.55 + (ro.y + rd.y * 8.0) * 0.7)) * 0.55
    + vnoise(vec2(further.x * 0.05, further.y * 0.25 + (ro.y + rd.y * 20.0) * 0.3) + 5.3) * 0.45);
  vec3 white = uFogBankLight.rgb * (0.72 + 0.5 * streaming) * mix(0.8, 1.0, smoothstep(0.3, 1.0, toward));
  float inside = clamp(into0 / FRONT, 0.0, 1.0) * clamp((deep - into0) / BACK, 0.0, 1.0)
    * (1.0 - clamp((ro.y - top + SOFT) / SOFT, 0.0, 1.0)) * step(fl, ro.y);
  vec3 light = mix(face, white, inside);
  // The sun glows through it, softly from inside, and brightest where it is thin along its top, where it is lit
  // right through and outshines the sky round the sun.
  float halo = pow(toward, 8.0) * 0.08 + pow(toward, 48.0) * 0.35;
  float rim = 4.0 * cover * (1.0 - cover);
  light += uSunColor * uFogBankLight.a * (halo * mix(0.3 * inside, 1.0, rim) + (pow(toward, 400.0) * 1.5 + pow(toward, 12.0) * 0.2) * rim);
  // Far off it goes into the haze of the horizon, as the cloud does.
  light = mix(light, skyColor(normalize(vec3(rd.x, 0.01, rd.z))), (1.0 - exp(-span.x / 650.0)) * 0.7);
  return vec4(light, cover);
}

vec4 deckLayer(vec3 ro, vec3 rd, float far) {
  // A thin fringe hangs under the body of the cloud, so its underside is soft rather than ruled.
  vec2 disc = deckColumn(ro, rd, uCloudDeck.xy, uCloudDeck.z);
  vec2 body = deckSlab(ro, rd, uCloudDeckY.x + 1.4, uCloudDeckY.y, far);
  vec2 fringe = deckSlab(ro, rd, uCloudDeckY.x - 1.6, uCloudDeckY.x + 1.4, far);
  vec2 slab = vec2(min(body.x, fringe.x), max(body.y, fringe.y));
  vec2 inside = vec2(max(slab.x, disc.x), min(slab.y, disc.y));
  // The fringe thickens from nothing at its foot to nearly the body at its top, so there is no floor to the cloud
  // to see edge-on: the density is linear in height, so its mean along the span is its value at the span's middle.
  vec2 fr = vec2(max(fringe.x, disc.x), min(fringe.y, disc.y));
  float thick = clamp((ro.y + rd.y * (fr.x + fr.y) * 0.5 - (uCloudDeckY.x - 1.6)) / 3.0, 0.0, 1.0);
  float len = deckSpan(body, disc) + 0.85 * thick * max(0.0, fr.y - fr.x);
  if (inside.y - inside.x <= 0.0) return vec4(0.0);
  float thin = uCloudDeckY.z - uCloudDeckY.w;
  float cleared = 0.0;
  if (uCloudBubble.w > 0.0) {
    cleared = 0.55 * deckSpan(inside, deckSphere(ro, rd, uCloudBubble.xyz, uCloudBubble.w))
      + 0.45 * deckSpan(inside, deckSphere(ro, rd, uCloudBubble.xyz, uCloudBubble.w * 0.6));
  }
  float depth = uCloudDeckY.z * len - thin * cleared;
  vec3 p = ro + rd * min(inside.x + 1.2 / uCloudDeckY.z, inside.y);
  // The far edge of the deck frays out rather than ending along a line.
  float edge = 1.0 - smoothstep(0.55, 1.0, length(p.xz - uCloudDeck.xy) / uCloudDeck.z);
  float cover = (1.0 - exp(-depth * edge)) * uCloudDeck.w;
  // From below, away from the stair, the sky shows between separate clouds. A sightline up through a gap can still
  // meet the side of a cloud beyond it: lit gold when the sun is behind the eye, a dark body with a bright edge
  // when it is ahead.
  float fromBelow = rd.y > 0.0 ? 1.0 - smoothstep(uCloudDeckY.x - 6.0, uCloudDeckY.x - 1.6, ro.y) : 0.0;
  float gap = 0.0;
  float wall = 0.0;
  if (fromBelow > 0.0) {
    float c0 = deckCover(ro.xz + rd.xz * ((uCloudDeckY.x - ro.y) / rd.y));
    float c1 = deckCover(ro.xz + rd.xz * ((uCloudDeckY.x + 2.5 - ro.y) / rd.y)) * 0.8;
    gap = (1.0 - c0) * fromBelow;
    wall = max(0.0, c1 - c0) * fromBelow;
    cover *= mix(1.0, max(c0, c1), fromBelow);
  }
  float up = clamp((p.y - uCloudDeckY.x) / max(uCloudDeckY.y - uCloudDeckY.x, 1.0), 0.0, 1.0);
  vec2 q = p.xz + uCloudShift * 0.5;
  float cells = smoothstep(0.25, 0.75, vnoise(q * 0.075));
  float billow = vnoise(q * 0.021) * 0.55 + vnoise(q * 0.06) * 0.25 + cells * 0.2;
  float sunUp = clamp(uSunDir.y * 3.0 + 0.25, 0.0, 1.0);
  float behind = dot(rd.xz, rd.xz) > 1e-8 ? max(0.0, -dot(normalize(rd.xz), normalize(uSunDir.xz))) : 0.0;
  vec3 under = deckUnderside(p.xz, ro, gap);
  under = mix(under, under * 0.8 + uSunColor * (0.06 + 0.45 * behind), wall);
  vec3 over = uSunColor * (0.55 + 0.35 * sunUp) + uSkyAmbient * 0.55;
  vec3 light = mix(under, over, smoothstep(0.0, 1.0, pow(up, 1.4)));
  light *= 0.66 + 0.55 * billow;
  return vec4(light, clamp(cover, 0.0, 1.0));
}

/**
 * The stairs' cloud deck along a sightline of length far: rgb its light, a how much of the view it covers.
 * Analytic, so it costs the same per vertex as per pixel: a slab, clipped to its disc, with the pocket round
 * the child hollowed out of it. Its light comes from where a sightline first gets well into it: sunlit gold on
 * top, lilac grey underneath, and lighter the higher up in it you are. The bank of mist stands on it.
 */
vec4 cloudDeck(vec3 ro, vec3 rd, float far) {
  vec4 deck = deckLayer(ro, rd, far);
  if (uFogBankShape.w <= 0.0) return deck;
  vec4 bank = fogBank(ro, rd, far);
  float a = 1.0 - (1.0 - bank.a) * (1.0 - deck.a);
  return vec4((bank.rgb * bank.a + deck.rgb * deck.a * (1.0 - bank.a)) / max(a, 1e-4), a);
}

/** How much of a sightline to wpos passes over a coast; sea behind a hill must have the same cover as the hill. */
float coastCover(vec4 coast, vec3 wpos, float inner, float outer) {
  vec2 origin = (cameraPosition.xz - coast.xy) / coast.zw;
  vec2 ray = (wpos.xz - cameraPosition.xz) / coast.zw;
  float along = clamp(-dot(origin, ray) / max(dot(ray, ray), 1e-6), 0.0, 1.0);
  float radius = length(origin + ray * along);
  return 1.0 - smoothstep(inner, outer, radius);
}

/** Shared with emissive props that deliberately shine through the ordinary habitat fog. */
float journeyVeilAt(vec3 wpos) {
  float covered = 0.0;
  for (int i = 0; i < 2; i++) {
    if (uJourneyVeilAmounts[i] <= 0.0) continue;
    float hidden = coastCover(uJourneyVeils[i], wpos, ${glsl(tuning.world.arrivalFogInner)}, ${glsl(tuning.world.arrivalFogOuter)}) * uJourneyVeilAmounts[i];
    covered = 1.0 - (1.0 - covered) * (1.0 - hidden);
  }
  if (uIsleMistRange.z > 0.0) {
    float misted = coastCover(uIsleMist, wpos, ${glsl(tuning.world.arrivalFogInner)}, uIsleMistRange.w)
      * smoothstep(uIsleMistRange.x, uIsleMistRange.y, distance(wpos, cameraPosition));
    covered = 1.0 - (1.0 - covered) * (1.0 - misted * uIsleMistRange.z);
  }
  return covered;
}

/** rgb: haze colour toward this point, a: how much haze covers it. Cheap enough to evaluate per vertex. */
vec4 fogOf(vec3 wpos, float landscape) {
  vec3 rd = wpos - cameraPosition;
  float dist = length(rd);
  rd /= dist;
  // The home hillside clears as one landscape, not where a sphere around the camera cuts its slope.
  float fogDistance = dist;
  if (uHomeHaze * landscape > 0.0) {
    float homeRegion = 1.0 - smoothstep(1.25, 1.65, length((wpos.xz - vec2(${glsl(ISLES.home.x)}, ${glsl(ISLES.home.z)})) / vec2(${glsl(ISLES.home.rx)}, ${glsl(ISLES.home.rz)})));
    float homeDistance = distance(cameraPosition.xz, vec2(${glsl(HOME_JETTY.x)}, ${glsl(HOME_JETTY.endZ)})) + ${glsl(tuning.homeApproach.landDepth)};
    fogDistance = mix(dist, homeDistance, homeRegion * uHomeHaze);
  }
  vec4 deck = uCloudDeck.w > 0.0 ? cloudDeck(cameraPosition, rd, dist) : vec4(0.0);
  // Haze lies between the eye and the cloud, not behind a deck that has already covered the view.
  fogDistance = mix(fogDistance, min(fogDistance, 40.0), deck.a);
  float heightFactor = exp(-max(wpos.y, 0.0) * 0.06);
  float mist = uMist * exp(-max(min(wpos.y, cameraPosition.y), 0.0) * 0.22);
  float veil = max(0.0, fogDistance - uVeil.x) * uVeil.y;
  float amt = 1.0 - exp(-fogDistance * (uFogDensity * (0.55 + 0.65 * heightFactor) + mist * 0.0075) - veil);
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
  if (deck.a > 0.0) {
    float total = 1.0 - (1.0 - amt) * (1.0 - deck.a);
    fogCol = (deck.rgb * deck.a * (1.0 - amt) + fogCol * amt) / max(total, 1e-4);
    amt = total;
  }
  float arriving = journeyVeilAt(wpos);
  if (arriving > 0.0) {
    fogCol = mix(fogCol, skyRadiance(rd), arriving);
    amt = mix(amt, 1.0, arriving);
  }
  return vec4(fogCol, clamp(amt, 0.0, 1.0));
}

vec4 fogOf(vec3 wpos) {
  return fogOf(wpos, 0.0);
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

import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { CREATURE_GLSL } from '../shading';
import type { V3 } from '../shapes';
import { BILL, BONES, EYE, EYE_AT, LORE_AT, QUILL, SHANK, cygnetDownGeometry } from './body';

/** How many times the coat is drawn over itself. Each shell keeps fewer strands, so the coat thins out into the air. */
const SHELLS = 8;

/** How long the down stands off the skin, in world units, before anything it is feeling changes it. */
const DOWN = 0.03;
/** Strands to a unit of rest space: fine enough to read as down from a metre and a half away. */
const STRAND = 300;
/** The coat lies down again over this range, before its strands are too small to survive the pixel grid. */
const DOWN_NEAR = 9;
const DOWN_FAR = 21;

const vec3 = (v: V3) => `vec3(${v[0].toFixed(5)}, ${v[1].toFixed(5)}, ${v[2].toFixed(5)})`;

/**
 * The lores: the bare dark skin running from the corner of the bill back to the eye, which is the one mark that says
 * swan rather than duckling at any distance. Both stages measure the same wedge — the frag to darken it, the vert to
 * keep the down off it — so the bare skin and the dark skin are the same shape.
 */
const LORE_GLSL = /* glsl */ `
float loreMask(vec3 rest) {
  vec3 q = vec3(abs(rest.x), rest.y, rest.z);
  vec3 ab = ${vec3(EYE_AT)} - ${vec3(LORE_AT)};
  vec3 r = q - ${vec3(LORE_AT)};
  /** Stops short of the eye: run it the whole way and the mark becomes a halo, and the eye a cartoon. */
  ab *= 0.7;
  float t = clamp(dot(r, ab) / dot(ab, ab), 0.0, 1.0);
  float wide = mix(0.011, 0.019, t);
  return (1.0 - smoothstep(wide, wide + 0.012, length(r - ab * t))) * smoothstep(0.008, 0.03, q.x);
}
`;

export const CYGNET_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${LORE_GLSL}
uniform mat4 uBones[${BONES}];
uniform float uNudge;
uniform float uBlink;
uniform float uFold;
uniform float uDown;
uniform float uRuffle;
uniform vec3 uFlow;
uniform vec3 uLay;
in vec4 aSkin;
in vec2 aMat;
in vec4 aFan;
#ifdef SHELL
in float aShell;
out float vShell;
#endif
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out vec3 vRest;
out float vFade;

/** No down where the bill leaves the face or around the eye, and finer on the head than on the body. */
float downLength(vec3 rest) {
  vec3 q = vec3(abs(rest.x), rest.y, rest.z);
  float k = smoothstep(0.018, 0.046, distance(q, ${vec3(EYE_AT)}));
  k *= 1.0 - 0.92 * loreMask(rest);
  return k * (1.0 - 0.4 * smoothstep(0.30, 0.46, rest.y));
}

void main() {
  vec3 p = position;
  vec3 n = normal;
  /**
   * A vane swings about its own quill before anything else, in the flat rest plane of the wing, so that shutting
   * the wing closes the fan; whatever roll the arm bones then have carries the shut fan onto the flank edge on.
   */
  if (aFan.w != 0.0) {
    float a = aFan.w * uFold;
    p = aFan.xyz + rotY(p - aFan.xyz, a);
    n = rotY(n, a);
  }
  if (int(aMat.x + 0.5) == ${EYE}) {
    /** The lids close by sinking the eye into the head and flattening it: what is left is down-coloured head. */
    vec3 c = vec3(sign(p.x) * ${EYE_AT[0].toFixed(4)}, ${EYE_AT[1].toFixed(4)}, ${EYE_AT[2].toFixed(4)});
    float open = 1.0 - max(uBlink, 0.0);
    p = c + (p - c) * vec3(1.0, open, 1.0 + 0.25 * max(-uBlink, 0.0)) - vec3(sign(p.x), 0.0, 0.0) * max(uBlink, 0.0) * 0.012;
  }
  mat4 a = uBones[int(aSkin.x + 0.5)];
  mat4 b = uBones[int(aSkin.y + 0.5)];
  float w = aSkin.z;
  vec3 world = mix((a * vec4(p, 1.0)).xyz, (b * vec4(p, 1.0)).xyz, w);
  vec3 N = normalize(mix(mat3(a) * n, mat3(b) * n, w));
  /** How much of the coat is still standing: strands are too fine to survive the pixel grid from far off. */
  vFade = 1.0 - smoothstep(${DOWN_NEAR.toFixed(1)}, ${DOWN_FAR.toFixed(1)}, distance(cameraPosition, world));
#ifdef SHELL
  float len = uDown * downLength(position) * vFade;
  float ruffle = 1.0 + uRuffle * sin(uTime * 6.5 + dot(position, vec3(41.0, 23.0, 31.0)));
  /** Sleeked down lies one way — back along the bird — rather than merely shortening, which is what reads as slick. */
  vec3 lay = uLay * (len * aShell);
  vec3 tip = N * (len * aShell * ruffle) + mix(mat3(a) * lay, mat3(b) * lay, w) + uFlow * (len * aShell * aShell);
  world += tip;
  N = normalize(N + tip * 9.0);
  vShell = aShell;
#endif
  vWorld = world;
  vNormal = N;
  vMat = aMat;
  vRest = position;
  gl_Position = projectionMatrix * nudgedView(vWorld, uNudge);
}`;

export const CYGNET_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${LORE_GLSL}
uniform float uAir;
uniform float uBlink;
uniform float uWet;
uniform float uGrown;
uniform float uStrand;
uniform float uFat;
uniform float uClump;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vRest;
in float vFade;
#ifdef SHELL
in float vShell;
#endif

/**
 * Linear, and far lower than they look: the golden sun here is worth about 2.7, so anything pale burns out to white.
 * A cygnet is grey — but a warm grey, cool in shadow, so it belongs to the light it stands in.
 */
const vec3 NAPE = vec3(0.033, 0.031, 0.029);
const vec3 DOVE = vec3(0.063, 0.060, 0.056);
const vec3 MILK = vec3(0.112, 0.108, 0.100);
const vec3 SNOW = vec3(0.40, 0.395, 0.378);
const vec3 SLATE = vec3(0.028, 0.025, 0.028);
const vec3 NAIL = vec3(0.078, 0.057, 0.052);
const vec3 LEG = vec3(0.034, 0.032, 0.038);
const vec3 VANE = vec3(0.068, 0.066, 0.069);
const vec3 VANE_TIP = vec3(0.124, 0.122, 0.119);
const vec3 IRIS = vec3(0.004, 0.004, 0.005);

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

/** One strand to a cell of rest space, each its own length, tapering to nothing: true at the height it still fills. */
bool strand(vec3 rest, float t) {
  vec3 q = rest * uStrand;
  vec3 c = floor(q);
  vec3 f = fract(q) - 0.5;
  float h = hash13(c + 9.1);
  /** Soaked, most of the coat sticks together and the rest hangs in points. */
  if (h < uClump) return false;
  float g = t / mix(0.55, 1.0, h);
  return g <= 1.0 && length(f - (hash33(c) - 0.5) * 0.44) < uFat * (1.0 - g * g * 0.97);
}

vec3 coat(float k, float fleck) {
  float t = clamp(k + (fleck - 0.5) * 0.2, 0.0, 1.0);
  vec3 c = mix(mix(NAPE, DOVE, smoothstep(0.0, 0.52, t)), MILK, smoothstep(0.46, 1.0, t));
  /**
   * The white comes through where the down is already palest — breast, cheeks, flanks — and the back stays grey.
   * It has to claim whole areas rather than fleck them, or it is invisible from the camera the game is played at.
   */
  return mix(c, SNOW, uGrown * (0.28 + 0.72 * smoothstep(0.16, 0.74, t * 0.92 + fleck * 0.2)));
}

void main() {
#ifdef SHELL
  if (!strand(vRest, vShell)) discard;
#endif
  vec3 N = normalize(vNormal);
  int m = int(vMat.x + 0.5);
  float k = vMat.y;
  float fleck = 0.5 * vnoise(vRest.xz * 130.0 + vRest.y * 83.0) + 0.5 * vnoise(vRest.zy * 44.0 + vRest.x * 31.0);
  vec3 alb = coat(k, fleck);
  float fuzz = 0.3;
  float thin = 0.14;
  float ao = 0.84;
  if (m == ${QUILL}) {
    alb = mix(mix(VANE, VANE_TIP, k), SNOW, uGrown * smoothstep(0.15, 0.7, k));
    fuzz = 0.3;
    thin = 0.45;
    ao = 0.96;
  } else if (m == ${BILL}) {
    alb = mix(SLATE, NAIL, k);
    fuzz = 0.04;
    thin = 0.2;
  } else if (m == ${SHANK}) {
    alb = LEG * (1.0 + k * 0.3);
    fuzz = 0.05;
    /** The web is thin enough to glow when the sun is behind it. */
    thin = 0.15 + k * 0.6;
  } else if (m == ${EYE}) {
    /** Shut, what is left of the eye is a lid: down-coloured, with only the crease of it still dark. */
    alb = mix(IRIS, coat(0.55, fleck) * 0.5, clamp(uBlink, 0.0, 1.0));
    fuzz = 0.0;
    thin = 0.0;
  } else {
    float lore = loreMask(vRest);
    alb = mix(alb, mix(SLATE, alb, 0.18), lore);
    fuzz *= 1.0 - 0.9 * lore;
  }
  /** Soaked down is darker and warmer, the colour of wet wool, not of grey gone flat. */
  alb *= mix(vec3(1.0), vec3(0.4, 0.375, 0.35), uWet);
  fuzz *= 1.0 - 0.7 * uWet;
#ifdef SHELL
  /** Down is dark at the root and catches everything at the tip, which is the whole of why a coat looks soft. */
  alb *= mix(mix(0.66, 0.44, uWet), 0.96, vShell);
  ao = mix(0.72, 1.0, vShell);
  fuzz = 0.38 * (1.0 - 0.7 * uWet);
  thin = 0.34;
#endif
#ifndef SHELL
  /**
   * Once the down has lain down with distance this skin is the whole bird, not the dark roots under a coat, so it
   * takes over the coat's own value. Without it the cygnet is pale close up and a charcoal lump from the camera.
   */
  alb *= mix(1.34, 1.0, vFade);
  ao = mix(0.98, ao, vFade);
#endif
  vec3 col = shadeCreature(alb, N, vWorld, ao, fuzz, thin, uAir);
  /**
   * A pale bird stays pale out of the sun. Without this it takes the whole of its shaded value from a warm ground
   * bounce meant for brown animals and goes charcoal the moment a cloud or the child's shoulder is over it.
   */
  col += alb * uSkyAmbient * (0.2 + 0.22 * (N.y * 0.5 + 0.5));
  if (uWet > 0.0 && m != ${EYE}) {
    /** Wet feathers go glassy at a glancing angle long before they do face on, which is what reads as soaked. */
    vec3 V = normalize(cameraPosition - vWorld);
    float gloss = pow(max(dot(N, normalize(V + uSunDir)), 0.0), 110.0) * (0.06 + 0.94 * pow(1.0 - max(dot(N, V), 0.0), 4.0));
    col += uSunColor * gloss * uWet * 1.1 * cloudShadow(vWorld.xz);
  }
  /** In the dark the eyes are all there is of it: two catchlights out of nothing, the moment light reaches it. */
  if (m == ${EYE}) col += (uSunColor * 0.9 + vec3(2.4, 1.3, 0.55) * min(1.0, uEmberLight.w)) * pow(catchlight(N, vWorld), 2.4) * (1.0 - clamp(uBlink, 0.0, 1.0));
  /** Never greyed with the land: it arrives after the island is whole, and the sea it crosses has no life field. */
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** Everything about the surface that changes from frame to frame. The cygnet writes it; only this file knows how it is drawn. */
export interface Look {
  /** 0 open to 1 shut; below 0 the eyes go wide. */
  blink: number;
  /** 0 on the ground to 1 in open air, where nothing on the ground shades it. */
  air: number;
  /** Down puffed out: asleep, content, cold. 0..1. */
  fluff: number;
  /** Down pulled in flat: frightened, or stretched out in flight. 0..1. */
  sleek: number;
  /** Soaked: 0 dry to 1, after rain or the sea. */
  wet: number;
  /** How far the white has come through the grey, 0 on the first island to 1 at the end. */
  grown: number;
  /** 0 folded to 1 spread, for anything about the wing the shader does by itself. */
  wingOpen: number;
  /** The wind on it, in world units per second, for the down to stream along. */
  wind: THREE.Vector2;
}

export function newLook(): Look {
  return { blink: 0, air: 0, fluff: 0, sleek: 0, wet: 0, grown: 0, wingOpen: 0, wind: new THREE.Vector2() };
}

/**
 * The skin, and on `userData.down` the same shader again as shells for the coat to be pushed out of. Both share one
 * set of uniforms, so `applyLook` writes each value once.
 */
export function cygnetMaterial(bones: THREE.Matrix4[]): THREE.ShaderMaterial {
  const uniforms = {
    ...atmo.uniforms,
    uBones: { value: bones },
    uNudge: { value: 2.4 },
    uAir: { value: 0 },
    uBlink: { value: 0 },
    uFold: { value: 1 },
    uDown: { value: DOWN },
    uFlow: { value: new THREE.Vector3(0, -0.3, 0) },
    uLay: { value: new THREE.Vector3() },
    uRuffle: { value: 0 },
    uStrand: { value: STRAND },
    uFat: { value: 0.82 },
    uClump: { value: 0 },
    uWet: { value: 0 },
    uGrown: { value: 0 },
  };
  const skin = new THREE.ShaderMaterial({ uniforms, vertexShader: CYGNET_VERT, fragmentShader: CYGNET_FRAG });
  skin.userData.down = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: CYGNET_VERT,
    fragmentShader: CYGNET_FRAG,
    defines: { SHELL: '' },
  });
  return skin;
}

/** The coat itself: the skinned coat drawn over again, each copy pushed a little further out along its own normal. */
export function downShells(skin: THREE.ShaderMaterial): THREE.Mesh {
  const base = cygnetDownGeometry();
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  for (const [name, attr] of Object.entries(base.attributes)) geo.setAttribute(name, attr);
  const height = new Float32Array(SHELLS);
  for (let i = 0; i < SHELLS; i++) height[i] = (i + 1) / SHELLS;
  geo.setAttribute('aShell', new THREE.InstancedBufferAttribute(height, 1));
  geo.instanceCount = SHELLS;
  const mesh = new THREE.Mesh(geo, skin.userData.down as THREE.ShaderMaterial);
  mesh.frustumCulled = false;
  return mesh;
}

export function applyLook(mat: THREE.ShaderMaterial, look: Look): void {
  const u = mat.uniforms;
  u.uBlink.value = look.blink;
  u.uAir.value = look.air;
  u.uWet.value = look.wet;
  u.uGrown.value = look.grown;
  u.uFold.value = 1 - look.wingOpen;
  u.uDown.value = DOWN * (1 + look.fluff * 0.7 - look.sleek * 0.52) * (1 - look.wet * 0.55);
  u.uStrand.value = STRAND * (1 + look.sleek * 0.22);
  u.uFat.value = 0.82 - look.wet * 0.3;
  u.uClump.value = look.wet * 0.55;
  /** Laid back along the bird, and harder still when it is soaked, when every strand goes the same way. */
  const lay = look.sleek * 0.9 + look.wet * 0.7;
  u.uLay.value.set(0, -0.3 * lay, -lay);
  const speed = look.wind.length();
  /** The coat streams along the real wind and saturates, so a gale only ever lays it flat, never blows it off. */
  const bend = speed > 0.001 ? Math.min(0.9, speed * 0.17) / speed : 0;
  u.uFlow.value.set(look.wind.x * bend, -0.3 - look.wet * 0.3, look.wind.y * bend);
  u.uRuffle.value = Math.min(0.45, speed * 0.07);
}

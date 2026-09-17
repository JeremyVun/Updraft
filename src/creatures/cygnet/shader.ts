import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { CREATURE_GLSL } from '../shading';
import { BILL, BONES, EYE, EYE_AT, QUILL, SHANK } from './body';

export const CYGNET_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform mat4 uBones[${BONES}];
uniform float uNudge;
uniform float uBlink;
in vec4 aSkin;
in vec2 aMat;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out vec3 vRest;
void main() {
  vec3 p = position;
  vec3 n = normal;
  if (int(aMat.x + 0.5) == ${EYE}) {
    /** The lids close by sinking the eye into the head and flattening it: what is left is down-coloured head. */
    vec3 c = vec3(sign(p.x) * ${EYE_AT[0].toFixed(4)}, ${EYE_AT[1].toFixed(4)}, ${EYE_AT[2].toFixed(4)});
    float open = 1.0 - max(uBlink, 0.0);
    p = c + (p - c) * vec3(1.0, open, 1.0 + 0.25 * max(-uBlink, 0.0)) - vec3(sign(p.x), 0.0, 0.0) * max(uBlink, 0.0) * 0.012;
  }
  mat4 a = uBones[int(aSkin.x + 0.5)];
  mat4 b = uBones[int(aSkin.y + 0.5)];
  float w = aSkin.z;
  vec4 world = mix(a * vec4(p, 1.0), b * vec4(p, 1.0), w);
  vWorld = world.xyz;
  vNormal = normalize(mix(mat3(a) * n, mat3(b) * n, w));
  vMat = aMat;
  vRest = position;
  gl_Position = projectionMatrix * nudgedView(vWorld, uNudge);
}`;

export const CYGNET_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uAir;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vRest;

/** Linear, and lower than they look: the golden sun here is worth about 2.7. Grey, but a warm grey, so it belongs to the light it stands in. */
const vec3 DUSK = vec3(0.075, 0.07, 0.069);
const vec3 DOVE = vec3(0.15, 0.145, 0.142);
const vec3 MILK = vec3(0.31, 0.3, 0.285);
const vec3 SLATE = vec3(0.04, 0.04, 0.046);
const vec3 NAIL = vec3(0.2, 0.14, 0.13);
const vec3 LEG = vec3(0.058, 0.056, 0.06);
const vec3 VANE = vec3(0.27, 0.26, 0.255);
const vec3 VANE_TIP = vec3(0.46, 0.45, 0.43);
const vec3 IRIS = vec3(0.004, 0.004, 0.005);

vec3 down(float k) {
  vec3 c = mix(DUSK, DOVE, smoothstep(0.0, 0.5, k));
  return mix(c, MILK, smoothstep(0.45, 1.0, k));
}

void main() {
  vec3 N = normalize(vNormal);
  int m = int(vMat.x + 0.5);
  float k = vMat.y;
  float mottle = 0.9 + 0.2 * vnoise(vRest.xz * 46.0 + vRest.y * 31.0);
  vec3 alb = down(k) * mottle;
  float fuzz = 0.22;
  float thin = 0.12;
  if (m == ${QUILL}) {
    alb = mix(VANE, VANE_TIP, k);
    fuzz = 0.2;
    thin = 0.5;
  } else if (m == ${BILL}) {
    alb = mix(SLATE, NAIL, k);
    fuzz = 0.04;
    thin = 0.2;
  } else if (m == ${SHANK}) {
    alb = LEG * (1.0 + k * 0.6);
    fuzz = 0.05;
    thin = k * 0.5;
  } else if (m == ${EYE}) {
    alb = IRIS;
    fuzz = 0.0;
    thin = 0.0;
  }
  vec3 col = shadeCreature(alb, N, vWorld, 0.84, fuzz, thin, uAir);
  /** In the dark the eyes are all there is of it: two catchlights out of nothing, the moment light reaches it. */
  if (m == ${EYE}) col += (uSunColor * 0.9 + vec3(2.4, 1.3, 0.55) * min(1.0, uEmberLight.w)) * catchlight(N, vWorld);
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

export function cygnetMaterial(bones: THREE.Matrix4[]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uBones: { value: bones }, uNudge: { value: 2.4 }, uAir: { value: 0 }, uBlink: { value: 0 } },
    vertexShader: CYGNET_VERT,
    fragmentShader: CYGNET_FRAG,
  });
}

export function applyLook(mat: THREE.ShaderMaterial, look: Look): void {
  mat.uniforms.uBlink.value = look.blink;
  mat.uniforms.uAir.value = look.air;
}

import { ATMO_GLSL } from '../../world/atmosphere';
import { CREATURE_GLSL } from '../shading';
import { BILL, BONES, EYE, EYE_AT, QUILL, SHANK } from './body';

export const CYGNET_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform mat4 uBones[${BONES}];
uniform float uNudge;
uniform float uBlink;
in float aPart;
in vec2 aMat;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out vec3 vDown;
void main() {
  vec3 p = position;
  vec3 n = normal;
  if (int(aMat.x + 0.5) == ${EYE}) {
    /** The lids close by sinking the eye into the head and flattening it: what is left is down-coloured head. */
    vec3 c = vec3(sign(p.x) * ${EYE_AT[0].toFixed(4)}, ${EYE_AT[1].toFixed(4)}, ${EYE_AT[2].toFixed(4)});
    float open = 1.0 - max(uBlink, 0.0);
    p = c + (p - c) * vec3(1.0 + 0.6 * max(-uBlink, 0.0), open, 1.0) - normalize(c) * max(uBlink, 0.0) * 0.011;
  }
  mat4 b = uBones[int(aPart + 0.5)];
  vec4 world = b * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(b) * n);
  vMat = aMat;
  /** Mottling in rest space, offset per part, so the down does not swim as the cygnet moves. */
  vDown = position * 31.0 + aPart * 5.3;
  gl_Position = projectionMatrix * nudgedView(vWorld, uNudge);
}`;

export const CYGNET_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uAir;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vDown;

/** Linear, and dark: the golden sun here is worth about 2.7, so anything lighter comes out of it cream. */
const vec3 SEPIA = vec3(0.1, 0.05, 0.028);
const vec3 RUST = vec3(0.205, 0.098, 0.04);
const vec3 CINNAMON = vec3(0.3, 0.19, 0.095);
const vec3 CREAM = vec3(0.43, 0.39, 0.3);
const vec3 HORN = vec3(0.3, 0.2, 0.16);
const vec3 TIP = vec3(0.19, 0.13, 0.11);
const vec3 LEG = vec3(0.14, 0.095, 0.085);
const vec3 IRIS = vec3(0.004, 0.004, 0.005);

/** Rust over the back and crown, cinnamon on the flanks, cream under the throat and belly. */
vec3 coat(float k) {
  vec3 c = mix(SEPIA, RUST, smoothstep(0.0, 0.28, k));
  c = mix(c, CINNAMON, smoothstep(0.24, 0.6, k));
  return mix(c, CREAM, smoothstep(0.58, 1.0, k));
}

void main() {
  vec3 N = normalize(vNormal);
  int m = int(vMat.x + 0.5);
  float k = vMat.y;
  float mottle = 0.88 + 0.22 * vnoise(vDown.xz + vDown.y);
  vec3 alb = coat(k) * mottle;
  float fuzz = 0.17;
  float thin = 0.1;
  if (m == ${QUILL}) {
    fuzz = 0.2;
    thin = 0.5;
  } else if (m == ${BILL}) {
    alb = mix(HORN, TIP, k);
    fuzz = 0.04;
    thin = 0.25;
  } else if (m == ${SHANK}) {
    alb = LEG;
    fuzz = 0.05;
    thin = 0.06;
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

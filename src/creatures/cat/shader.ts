import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { CREATURE_GLSL } from '../shading';
import type { V3 } from '../shapes';
import { BODY, BONES, EAR, EYE, EYE_AT, EYE_SIZE, EYE_TURN, MOUTH, NOSE, REST, SKULL, TAIL_1, WHISKER } from './body';

const vec3 = (v: V3) => `vec3(${v[0].toFixed(5)}, ${v[1].toFixed(5)}, ${v[2].toFixed(5)})`;

const CAT_VERT = /* glsl */ `
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
    /** The lids close by flattening the eye into the head from above and below: what shows of it is fur. */
    vec3 c = vec3(sign(p.x) * ${EYE_AT[0].toFixed(4)}, ${EYE_AT[1].toFixed(4)}, ${EYE_AT[2].toFixed(4)});
    float open = 1.0 - clamp(uBlink, 0.0, 1.0) * 0.92;
    p = c + (p - c) * vec3(1.0, open, mix(0.6, 1.0, open));
    p.z -= (1.0 - open) * 0.004;
  }
  mat4 a = uBones[int(aSkin.x + 0.5)];
  mat4 b = uBones[int(aSkin.y + 0.5)];
  vec3 world = mix((a * vec4(p, 1.0)).xyz, (b * vec4(p, 1.0)).xyz, aSkin.z);
  vWorld = world;
  vNormal = normalize(mix(mat3(a) * n, mat3(b) * n, aSkin.z));
  vMat = aMat;
  vRest = position;
  gl_Position = projectionMatrix * nudgedView(world, uNudge);
}`;

const CAT_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uAir;
uniform float uWet;
uniform float uPupil;
uniform float uBlink;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vRest;

/**
 * Linear albedo on the scale of the other animals. A warm grey-brown tabby: the ground colour is a grey fawn going
 * darker along the back, the stripes a soft dark umber rather than black, so it stays a gentle animal in the low sun.
 */
const vec3 FAWN = vec3(0.245, 0.2, 0.158);
const vec3 BACK = vec3(0.17, 0.145, 0.12);
const vec3 STRIPE = vec3(0.052, 0.043, 0.037);
const vec3 WHITE = vec3(0.62, 0.6, 0.57);
const vec3 PINK = vec3(0.76, 0.4, 0.38);
const vec3 NOSE_PINK = vec3(0.62, 0.3, 0.3);
const vec3 IRIS = vec3(0.5, 0.42, 0.1);
const vec3 IRIS_RIM = vec3(0.17, 0.14, 0.05);
const vec3 MOUTH_IN = vec3(0.26, 0.07, 0.08);
const vec3 SKULL = ${vec3(SKULL)};
const vec3 EYE_C = ${vec3(EYE_AT)};
const float TAIL_Z = ${REST[TAIL_1][2].toFixed(4)};
const float SPINE = ${(REST[BODY][1] + 0.04).toFixed(4)};

/** Mackerel tabby: stripes down the sides from a dark line along the spine, rings on the legs and tail, an M on the brow. */
float tabby(vec3 r) {
  float warp = vnoise(r.xz * 31.0 + r.y * 17.0) - 0.5;
  float ax = abs(r.x);
  if (r.z < TAIL_Z - 0.02 && r.y > 0.15) {
    float along = TAIL_Z - r.z;
    return max(smoothstep(0.1, 0.6, sin(along * 72.0 + warp)), smoothstep(0.24, 0.26, along));
  }
  if (r.y < 0.12 && ax > 0.018) {
    return smoothstep(0.2, 0.7, sin(r.y * 105.0 + warp * 1.6)) * smoothstep(0.02, 0.04, ax) * smoothstep(0.03, 0.05, r.y);
  }
  if (r.y > SKULL.y - 0.045 && r.z > SKULL.z - 0.075) {
    vec3 q = r - SKULL;
    float brow = smoothstep(EYE_C.y + 0.012, EYE_C.y + 0.02, r.y) * smoothstep(-0.005, 0.02, q.z);
    float m = smoothstep(0.3, 0.85, cos(ax * 150.0 + warp * 0.8)) * brow * (1.0 - smoothstep(0.028, 0.04, ax));
    float crown = smoothstep(0.2, 0.75, cos(ax * 120.0 + warp)) * smoothstep(0.035, 0.05, q.y) * (1.0 - smoothstep(0.0, 0.02, q.z));
    float cheek = (1.0 - smoothstep(0.003, 0.007, abs(r.y - EYE_C.y + 0.004 + (ax - 0.046) * 0.35))) * smoothstep(0.044, 0.052, ax) * smoothstep(-0.03, 0.0, q.z);
    return max(max(m, crown), cheek);
  }
  float side = smoothstep(0.1, 0.65, sin(r.z * 92.0 + warp * 1.8 + ax * 9.0)) * smoothstep(0.14, 0.21, r.y);
  float spine = (1.0 - smoothstep(0.008, 0.02, ax)) * smoothstep(SPINE, SPINE + 0.02, r.y);
  return max(side, spine);
}

void main() {
  vec3 N = normalize(vNormal);
  int m = int(vMat.x + 0.5);
  float k = vMat.y;
  float fleck = vnoise(vRest.xz * 140.0 + vRest.y * 97.0);
  vec3 ground = mix(FAWN, BACK, smoothstep(0.16, 0.23, vRest.y) * step(TAIL_Z, vRest.z));
  vec3 alb = mix(ground, STRIPE, tabby(vRest) * 0.85) * (0.92 + fleck * 0.16);
  alb = mix(alb, WHITE * (0.95 + fleck * 0.08), k);
  float fuzz = 0.55;
  float thin = 0.12;
  float ao = mix(0.62, 1.0, smoothstep(0.02, 0.2, vRest.y));
  if (m == ${EAR}) {
    alb = mix(alb, PINK, k);
    thin = 0.35 + 0.6 * k;
  } else if (m == ${NOSE}) {
    alb = NOSE_PINK;
    fuzz = 0.1;
  } else if (m == ${MOUTH}) {
    alb = MOUTH_IN;
    fuzz = 0.0;
    ao = 0.5;
  } else if (m == ${WHISKER}) {
    alb = WHITE * 1.2;
    fuzz = 0.0;
    thin = 0.8;
  } else if (m == ${EYE}) {
    /** Measured on the eye's own face: a big round pupil, an amber ring, and a darker rim round that. */
    vec3 c = vec3(sign(vRest.x) * ${EYE_AT[0].toFixed(4)}, ${EYE_AT[1].toFixed(4)}, ${EYE_AT[2].toFixed(4)});
    vec3 q = vRest - c;
    q = vec3(cos(${EYE_TURN.toFixed(3)}) * q.x * sign(vRest.x) - sin(${EYE_TURN.toFixed(3)}) * q.z, q.y, 0.0);
    vec2 e = q.xy / ${vec3(EYE_SIZE)}.xy;
    float r = length(e);
    float pupil = 1.0 - smoothstep(uPupil - 0.06, uPupil + 0.02, length(vec2(e.x / mix(0.45, 1.0, uPupil), e.y)));
    alb = mix(mix(IRIS, IRIS_RIM, smoothstep(0.62, 0.95, r)), vec3(0.008, 0.006, 0.006), pupil);
    fuzz = 0.0;
    thin = 0.0;
    ao = 1.0;
  }
  /** Damp fur is darker and clumps, most of all low down where the water reached. */
  float soak = uWet * mix(0.45, 1.0, 1.0 - smoothstep(0.04, 0.16, vRest.y));
  if (m != ${EYE} && m != ${MOUTH}) {
    alb *= mix(1.0, 0.72, soak);
    fuzz *= 1.0 - 0.5 * soak;
  }
  vec3 col = shadeCreature(alb, N, vWorld, ao, fuzz, thin, uAir);
  /** Out of the sun it must still read as a soft animal and not a hole in the dusk, so the sky fills it, warmed. */
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  col += alb * uSkyAmbient * vec3(1.35, 1.05, 0.7) * (0.2 + 0.2 * (N.y * 0.5 + 0.5));
  col += uSkyAmbient * pow(edge, 3.0) * fuzz * 0.35;
  col += alb * (lanternLight(vWorld, N) * 0.8 + dawnLight(vWorld, N));
  if (m == ${EYE}) col += (uSunColor * 0.9 + uSkyAmbient * 1.6) * pow(catchlight(N, vWorld), 2.0) * (1.0 - clamp(uBlink, 0.0, 1.0));
  if (m == ${NOSE} || (m == ${EYE} && uWet > 0.0)) col += uSunColor * pow(max(dot(N, halfVector(uSunDir, V)), 0.0), 60.0) * 0.3;
  // MSAA edge samples shaded outside the triangle extrapolate to negative colour, which half-float targets keep.
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

export interface CatLook {
  /** 0 open to 1 shut. */
  blink: number;
  /** How wide the pupils are, 0.35 slits to 1 all black: wide in the dusk, wider still when frightened. */
  pupil: number;
  /** 0 on the ground to 1 up off it, where nothing on the ground shades it. */
  air: number;
  /** 0 dry to 1 soaked. */
  wet: number;
}

export function catMaterial(bones: THREE.Matrix4[]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...atmo.uniforms,
      uBones: { value: bones },
      uNudge: { value: 0 },
      uBlink: { value: 0 },
      uPupil: { value: 0.7 },
      uAir: { value: 1 },
      uWet: { value: 0.3 },
    },
    vertexShader: CAT_VERT,
    fragmentShader: CAT_FRAG,
  });
}

export function applyCatLook(mat: THREE.ShaderMaterial, look: CatLook): void {
  const u = mat.uniforms;
  u.uBlink.value = look.blink;
  u.uPupil.value = look.pupil;
  u.uAir.value = look.air;
  u.uWet.value = look.wet;
}

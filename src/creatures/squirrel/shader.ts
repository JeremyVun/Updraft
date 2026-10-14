import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { CREATURE_GLSL } from '../shading';
import type { V3 } from '../shapes';
import {
  BODY, BONES, EAR, EYE, EYE_AT, EYE_RADIUS, EYE_TILT, EYE_TURN, FUR as COAT, MOUTH, MUZZLE, NOSE, NOSE_AT, NUT, REST, SKULL, SKULL_SIZE, TAIL_1,
  TUFT, WHISKER, HAND_R, squirrelCoatGeometry,
} from './body';

const vec3 = (v: V3) => `vec3(${v[0].toFixed(5)}, ${v[1].toFixed(5)}, ${v[2].toFixed(5)})`;

const SHELLS = 7;
/** How far the coat stands off the skin where it is shortest-but-ordinary, in rest metres; the plume grows far longer. */
const FUR = 0.0026;
const STRAND = 2600;
const FUR_NEAR = 1.5;
const FUR_FAR = 3.8;
const TAIL_Z = REST[TAIL_1][2] + 0.012;

/** Where the coat is long and where short, from where a point is on the squirrel at rest. */
const FUR_GLSL = /* glsl */ `
float furLength(vec3 r, int m) {
  if (m == ${TUFT}) return 1.4;
  if (m == ${EAR}) return 0.45;
  vec3 q = r - ${vec3(SKULL)};
  float head = step(${(SKULL[2] - SKULL_SIZE[2] * 1.1).toFixed(4)}, r.z) * smoothstep(-0.03, -0.012, q.y);
  float face = head * smoothstep(0.004, 0.016, q.z);
  float cheek = head * smoothstep(0.008, 0.016, abs(q.x)) * (1.0 - smoothstep(-0.004, 0.008, q.y)) * (1.0 - face);
  float plume = 1.0 - smoothstep(${(TAIL_Z - 0.03).toFixed(4)}, ${TAIL_Z.toFixed(4)}, r.z);
  float paw = 1.0 - smoothstep(0.006, 0.03, r.y);
  float eye = smoothstep(${(EYE_RADIUS * 1.05).toFixed(4)}, ${(EYE_RADIUS * 1.45).toFixed(4)}, distance(vec3(abs(r.x), r.yz), ${vec3(EYE_AT)}));
  float nose = smoothstep(0.003, 0.007, distance(r, ${vec3(NOSE_AT)}));
  return clamp(1.0 + 0.7 * cheek - 0.55 * face - 0.6 * paw + 3.6 * plume, 0.2, 4.6) * eye * nose;
}`;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${FUR_GLSL}
uniform mat4 uBones[${BONES}];
uniform float uNudge;
uniform float uBlink;
uniform float uFur;
uniform float uNut;
uniform vec3 uLay;
in vec4 aSkin;
in vec2 aMat;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out vec3 vRest;
out float vFade;
#ifdef SHELL
in float aShell;
out float vShell;
#endif

void main() {
  vec3 p = position;
  vec3 n = normal;
  int m = int(aMat.x + 0.5);
  if (m == ${EYE}) {
    vec3 c = vec3(sign(p.x) * ${EYE_AT[0].toFixed(5)}, ${EYE_AT[1].toFixed(5)}, ${EYE_AT[2].toFixed(5)});
    float open = 1.0 - clamp(uBlink, 0.0, 1.0) * 0.92;
    p = c + (p - c) * vec3(1.0, open, mix(0.8, 1.0, open));
  }
  if (m == ${NUT} && uNut < 0.5) p = ${vec3(REST[HAND_R])};
  mat4 a = uBones[int(aSkin.x + 0.5)];
  mat4 b = uBones[int(aSkin.y + 0.5)];
  vec3 world = mix((a * vec4(p, 1.0)).xyz, (b * vec4(p, 1.0)).xyz, aSkin.z);
  if (m == ${WHISKER}) {
    float far = smoothstep(1.5, 4.0, distance(cameraPosition, world));
    world = mix(world, (a * vec4(${vec3(MUZZLE)}, 1.0)).xyz, far);
  }
  vec3 N = normalize(mix(mat3(a) * n, mat3(b) * n, aSkin.z));
  vFade = 1.0 - smoothstep(${FUR_NEAR.toFixed(1)}, ${FUR_FAR.toFixed(1)}, distance(cameraPosition, world));
#ifdef SHELL
  /** Each strand stands out along the skin and lies back along the squirrel, more so toward its tip. */
  float len = uFur * furLength(position, m) * vFade;
  vec3 lay = mix(mat3(a) * uLay, mat3(b) * uLay, aSkin.z);
  world += (N + lay * aShell) * len * aShell;
  vShell = aShell;
#endif
  vWorld = world;
  vNormal = N;
  vMat = aMat;
  vRest = position;
  gl_Position = projectionMatrix * nudgedView(world, uNudge);
#ifdef SHELL
  if (vFade <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
#endif
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uAir;
uniform float uBlink;
uniform vec2 uGlint;
uniform float uStrand;
uniform vec3 uRust;
uniform vec3 uBack;
uniform vec3 uFlank;
uniform vec3 uCream;
uniform vec3 uPlume;
uniform vec3 uFringe;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vRest;
in float vFade;
#ifdef SHELL
in float vShell;
#endif

const vec3 TUFT_DARK = vec3(0.085, 0.032, 0.014);
const vec3 EAR_IN = vec3(0.36, 0.17, 0.09);
const vec3 NOSE_DARK = vec3(0.07, 0.035, 0.03);
const vec3 MOUTH_IN = vec3(0.07, 0.025, 0.022);
const vec3 TEETH = vec3(0.5, 0.33, 0.14);
const vec3 HAZEL = vec3(0.3, 0.14, 0.05);
const vec3 EYE_DARK = vec3(0.012, 0.007, 0.005);
const vec3 IRIS = vec3(0.05, 0.022, 0.01);
const vec3 SKULL = ${vec3(SKULL)};
const vec3 EYE_C = ${vec3(EYE_AT)};
const float TAIL_Z = ${TAIL_Z.toFixed(4)};
const float SPINE = ${(REST[BODY][1] + 0.016).toFixed(4)};
const float TURN = ${EYE_TURN.toFixed(4)};
const float TILT = ${EYE_TILT.toFixed(4)};

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

bool strand(vec3 rest, float t) {
  vec3 c = floor(rest * uStrand);
  vec3 f = fract(rest * uStrand) - 0.5;
  vec3 r = hash33(c + 9.1);
  float g = t / mix(0.45, 1.0, r.x);
  return g <= 1.0 && length(f - (hash33(c) - 0.5) * 0.4) < 0.6 * (1.0 - g * g * 0.95);
}

/** The coat: darker and browner down the spine, brighter rust on the flanks, cream beneath, a plume of chestnut paling to ginger at its edges. */
vec3 coat(vec3 r, float k) {
  float streak = vnoise(vec2(r.x * 900.0, r.z * 160.0 + r.y * 120.0));
  float fleck = vnoise(r.xz * 520.0 + r.y * 380.0);
  if (r.z < TAIL_Z) {
    float along = clamp((TAIL_Z - r.z) / 0.18, 0.0, 1.0);
    vec3 c = mix(uPlume, uPlume * 1.25, smoothstep(0.2, 0.9, along));
    return mix(c, uFringe, k * (0.6 + 0.4 * streak)) * (0.85 + 0.3 * streak);
  }
  float back = smoothstep(SPINE - 0.03, SPINE + 0.004, r.y) * (1.0 - smoothstep(SKULL.z - 0.03, SKULL.z, r.z));
  vec3 c = mix(uFlank, uBack, back);
  c = mix(c, uRust, smoothstep(SKULL.z - 0.03, SKULL.z - 0.01, r.z));
  float ring = 1.0 - smoothstep(${(EYE_RADIUS * 1.18).toFixed(4)}, ${(EYE_RADIUS * 1.36).toFixed(4)}, distance(vec3(abs(r.x), r.yz), EYE_C));
  return mix(c * (0.88 + 0.24 * streak) * (0.95 + 0.1 * fleck), uCream * (0.94 + 0.1 * fleck), max(k, ring * 0.5));
}

void main() {
  int m = int(vMat.x + 0.5);
#ifdef SHELL
  if (!strand(vRest, vShell)) discard;
#endif
  vec3 N = normalize(vNormal);
  float k = vMat.y;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = coat(vRest, k);
  float fuzz = 0.6;
  float thin = 0.15;
  float ao = mix(0.7, 1.0, smoothstep(0.01, 0.07, vRest.y));
  float glintAmount = 0.0;
  if (vRest.z < TAIL_Z && m == ${COAT}) {
    /** Light comes through the plume's long hair: it glows round its edge against a low sun. */
    thin = 0.35 + 0.5 * k;
    fuzz = 0.9;
    ao = 1.0;
  }
  if (m == ${EAR}) {
    alb = mix(uRust * 0.9, EAR_IN, k);
    thin = 0.45 + 0.4 * k;
  } else if (m == ${TUFT}) {
    alb = mix(TUFT_DARK, uRust * 0.75, k * 0.6);
    thin = 0.5;
    fuzz = 0.8;
  } else if (m == ${NOSE}) {
    alb = NOSE_DARK;
    fuzz = 0.1;
  } else if (m == ${MOUTH}) {
    alb = mix(MOUTH_IN, TEETH, smoothstep(0.0, 0.001, vRest.z - ${(NOSE_AT[2] - 0.004).toFixed(4)}) * step(abs(vRest.x), 0.0008) * step(${(NOSE_AT[1] - 0.008).toFixed(4)}, vRest.y));
    fuzz = 0.0;
    ao = 0.6;
  } else if (m == ${WHISKER}) {
    alb = vec3(0.06, 0.035, 0.022);
    fuzz = 0.0;
    thin = 0.6;
  } else if (m == ${NUT}) {
    float cap = smoothstep(0.0, 0.004, vRest.z - ${(REST[HAND_R][2] + 0.006).toFixed(4)});
    alb = mix(HAZEL * (0.85 + 0.3 * vnoise(vRest.xy * 900.0)), vec3(0.42, 0.3, 0.17), cap);
    fuzz = 0.05;
    thin = 0.0;
  } else if (m == ${EYE}) {
    /** Almost all dark: a deep brown iris round a big pupil, wet, under a soft upper lid. */
    float side = sign(vRest.x);
    vec3 q = vRest - vec3(side * EYE_C.x, EYE_C.y, EYE_C.z);
    q.x *= side;
    q = vec3(cos(TURN) * q.x - sin(TURN) * q.z, q.y, sin(TURN) * q.x + cos(TURN) * q.z);
    vec2 e = vec2(q.x, cos(TILT) * q.y + sin(TILT) * q.z) / ${EYE_RADIUS.toFixed(5)};
    float r = length(e);
    vec3 fur = coat(vRest, 1.0);
    alb = mix(IRIS * (1.0 + 1.2 * (1.0 - smoothstep(-0.8, 0.3, e.y))), EYE_DARK, 1.0 - smoothstep(0.62, 0.86, r));
    alb *= mix(1.0, 0.55, smoothstep(0.3, 0.95, e.y));
    float lid = max(smoothstep(0.98, 1.03, r), smoothstep(0.95, 1.0, e.y + 0.05 * e.x * e.x));
    alb = mix(alb, fur, lid);
    float shut = smoothstep(0.3, 0.8, uBlink);
    alb = mix(alb, mix(fur * 0.9, vec3(0.03, 0.02, 0.015), (1.0 - smoothstep(0.08, 0.2, abs(e.y + 0.2 * e.x * e.x))) * step(r, 1.0)), shut);
    lid = max(lid, shut);
    vec2 g = vec2(e.x * side, e.y);
    float glint = (1.0 - smoothstep(0.17, 0.21, distance(g, uGlint))) + 0.45 * (1.0 - smoothstep(0.06, 0.09, distance(g, uGlint * vec2(-0.6, -0.5) + vec2(0.0, -0.42))));
    glintAmount = glint * (1.0 - lid);
    fuzz = 0.0;
    thin = 0.0;
    ao = 1.0;
  }
#ifdef SHELL
  alb *= mix(0.8, 1.06, vShell);
  ao = mix(0.84, 1.0, vShell);
  fuzz = 0.3;
#else
  if (m == ${COAT} || m == ${TUFT}) alb *= mix(1.0, 0.86, vFade);
#endif
  vec3 col = shadeCreature(alb, N, vWorld, ao, fuzz, thin, uAir);
  float edge = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  col += alb * uSkyAmbient * vec3(1.15, 1.0, 0.85) * (0.24 + 0.2 * (N.y * 0.5 + 0.5));
  col += uSkyAmbient * pow(edge, 3.0) * fuzz * 0.3 * smoothstep(-0.15, 0.1, dot(N, V));
  col += alb * dawnLight(vWorld, N);
  col += (uSunColor * 0.35 + uSkyAmbient * 2.2 + 0.07) * glintAmount * (1.0 - clamp(uBlink, 0.0, 1.0));
  if (m == ${NOSE} || m == ${NUT}) col += uSunColor * pow(max(dot(N, halfVector(uSunDir, V)), 0.0), 40.0) * 0.18;
  // MSAA edge samples shaded outside the triangle extrapolate to negative colour, which half-float targets keep.
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

/** The coat as linear albedo: a deep russet, darker than the gold litter it plays in so it reads against it, which the birches' warm low light brings up to the rust of a red squirrel. */
export interface Coat {
  rust: [number, number, number];
  back: [number, number, number];
  flank: [number, number, number];
  cream: [number, number, number];
  plume: [number, number, number];
  fringe: [number, number, number];
}

export const RED: Coat = {
  rust: [0.27, 0.052, 0.016],
  back: [0.17, 0.042, 0.018],
  flank: [0.31, 0.066, 0.02],
  cream: [0.72, 0.58, 0.4],
  plume: [0.2, 0.042, 0.015],
  fringe: [0.44, 0.13, 0.04],
};

export interface SquirrelLook {
  blink: number;
  air: number;
  nut: boolean;
}

export function squirrelMaterial(bones: THREE.Matrix4[], coat: Coat = RED): THREE.ShaderMaterial {
  const uniforms = {
    ...atmo.uniforms,
    uRust: { value: new THREE.Vector3(...coat.rust) },
    uBack: { value: new THREE.Vector3(...coat.back) },
    uFlank: { value: new THREE.Vector3(...coat.flank) },
    uCream: { value: new THREE.Vector3(...coat.cream) },
    uPlume: { value: new THREE.Vector3(...coat.plume) },
    uFringe: { value: new THREE.Vector3(...coat.fringe) },
    uBones: { value: bones },
    uNudge: { value: 0 },
    uBlink: { value: 0 },
    uNut: { value: 0 },
    uGlint: { value: new THREE.Vector2(0.3, 0.36) },
    uAir: { value: 0.6 },
    uFur: { value: FUR },
    uLay: { value: new THREE.Vector3(0, -0.3, -0.75) },
    uStrand: { value: STRAND },
  };
  const skin = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
  skin.userData.coat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, defines: { SHELL: '' } });
  return skin;
}

/** The coat: the furred skin drawn over again, each copy pushed a little further out along its own normal. */
export function coatShells(skin: THREE.ShaderMaterial): THREE.Mesh {
  const base = squirrelCoatGeometry();
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  for (const [name, attr] of Object.entries(base.attributes)) geo.setAttribute(name, attr);
  geo.setAttribute('aShell', new THREE.InstancedBufferAttribute(Float32Array.from({ length: SHELLS }, (_, i) => (i + 1) / SHELLS), 1));
  geo.instanceCount = SHELLS;
  const mesh = new THREE.Mesh(geo, skin.userData.coat as THREE.ShaderMaterial);
  mesh.frustumCulled = false;
  return mesh;
}

const sunInHead = new THREE.Vector3();
const toHead = new THREE.Quaternion();

/** `head` is the head's turn in the world, which sets which side of the eyes the catchlights are on. */
export function applySquirrelLook(mat: THREE.ShaderMaterial, look: SquirrelLook, head: THREE.Quaternion): void {
  const u = mat.uniforms;
  sunInHead.copy(u.uSunDir.value).applyQuaternion(toHead.copy(head).invert());
  u.uGlint.value.set(THREE.MathUtils.clamp(sunInHead.x * 0.5, -0.36, 0.36), 0.36);
  u.uBlink.value = look.blink;
  u.uAir.value = look.air;
  u.uNut.value = look.nut ? 1 : 0;
}

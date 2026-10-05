import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { CREATURE_GLSL } from '../shading';
import type { V3 } from '../shapes';
import { BODY, BONES, catCoatGeometry, EAR, EYE, FUR as COAT, NOSE_AT, EYE_AT, EYE_RADIUS, EYE_TILT, EYE_TURN, HEAD_K, MOUTH, MUZZLE, NOSE, REST, SKULL, TAIL_1, WHISKER } from './body';

const vec3 = (v: V3) => `vec3(${v[0].toFixed(5)}, ${v[1].toFixed(5)}, ${v[2].toFixed(5)})`;

/** How many times the coat is drawn over itself; each shell keeps fewer strands, so the coat thins into the air. */
const SHELLS = 7;
/** How far the coat stands off the skin, in rest metres, where it is longest. */
const FUR = 0.0048;
/** Strands to a rest metre: fine enough to read as plush from a metre off. */
const STRAND = 900;
/** The coat lies down over this range of distances, before its strands are finer than a pixel and only shimmer. */
const FUR_NEAR = 2.2;
const FUR_FAR = 5.5;

/** Where the coat is long and where short, from where a point is on the cat at rest. */
const FUR_GLSL = /* glsl */ `
float furLength(vec3 r) {
  vec3 q = r - ${vec3(SKULL)};
  float head = smoothstep(-0.075, -0.04, q.y) * step(${(SKULL[2] - 0.08).toFixed(4)}, r.z);
  float cheek = head * smoothstep(0.035, 0.06, abs(q.x)) * (1.0 - smoothstep(0.0, 0.03, q.y));
  float face = head * smoothstep(0.02, 0.045, q.z) * (1.0 - smoothstep(0.035, 0.055, abs(q.x)));
  float tail = 1.0 - smoothstep(${(REST[TAIL_1][2] - 0.05).toFixed(4)}, ${(REST[TAIL_1][2] - 0.01).toFixed(4)}, r.z);
  float paw = 1.0 - smoothstep(0.012, 0.035, r.y);
  /** None over the rims of the eyes or on the nose and lips, which must stay clean. */
  float eye = smoothstep(${(EYE_RADIUS * 1.08).toFixed(4)}, ${(EYE_RADIUS * 1.6).toFixed(4)}, distance(vec3(abs(r.x), r.yz), ${vec3(EYE_AT)}));
  float nose = smoothstep(0.006, 0.014, distance(r, ${vec3(NOSE_AT)}));
  return clamp(0.8 + 0.6 * cheek + 0.35 * tail - 0.55 * face - 0.45 * paw, 0.2, 1.4) * eye * nose;
}`;

const CAT_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${FUR_GLSL}
uniform mat4 uBones[${BONES}];
uniform float uNudge;
uniform float uBlink;
uniform float uFur;
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
  if (int(aMat.x + 0.5) == ${EYE}) {
    /** The lids close by flattening the eye into the head from above and below: what shows of it is fur. */
    vec3 c = vec3(sign(p.x) * ${EYE_AT[0].toFixed(4)}, ${EYE_AT[1].toFixed(4)}, ${EYE_AT[2].toFixed(4)});
    float open = 1.0 - clamp(uBlink, 0.0, 1.0) * 0.94;
    p = c + (p - c) * vec3(1.0, open, mix(0.55, 1.0, open));
    p.z -= (1.0 - open) * 0.004;
  }
  mat4 a = uBones[int(aSkin.x + 0.5)];
  mat4 b = uBones[int(aSkin.y + 0.5)];
  vec3 world = mix((a * vec4(p, 1.0)).xyz, (b * vec4(p, 1.0)).xyz, aSkin.z);
  if (int(aMat.x + 0.5) == ${WHISKER}) {
    /** Whiskers thinner than a pixel only shimmer, so from a few metres off they draw back into the muzzle. */
    float far = smoothstep(2.5, 6.0, distance(cameraPosition, world));
    world = mix(world, (a * vec4(${vec3(MUZZLE)}, 1.0)).xyz, far);
  }
  vec3 N = normalize(mix(mat3(a) * n, mat3(b) * n, aSkin.z));
  vFade = 1.0 - smoothstep(${FUR_NEAR.toFixed(1)}, ${FUR_FAR.toFixed(1)}, distance(cameraPosition, world));
#ifdef SHELL
  /** Each strand stands out along the skin and lies back along the cat and down, more so toward its tip. */
  float len = uFur * furLength(position) * vFade;
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

const CAT_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uAir;
uniform float uWet;
uniform float uPupil;
uniform float uBlink;
uniform vec2 uGlint;
uniform float uStrand;
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
 * Linear albedo on the scale of the other animals. A warm brown tabby as the model sheet paints it: a soft
 * ginger-fawn ground, darker along the back, umber stripes that never go to black, and warm cream for the white.
 */
const vec3 FAWN = vec3(0.26, 0.17, 0.106);
const vec3 BACK = vec3(0.2, 0.13, 0.082);
const vec3 STRIPE = vec3(0.075, 0.048, 0.034);
const vec3 WHITE = vec3(0.7, 0.65, 0.58);
const vec3 PINK = vec3(0.72, 0.28, 0.24);
const vec3 NOSE_PINK = vec3(0.7, 0.24, 0.22);
const vec3 IRIS = vec3(0.62, 0.3, 0.035);
const vec3 IRIS_DEEP = vec3(0.24, 0.1, 0.02);
const vec3 MOUTH_IN = vec3(0.3, 0.07, 0.07);
const vec3 SKULL = ${vec3(SKULL)};
const vec3 EYE_C = ${vec3(EYE_AT)};
const float HEAD_K = ${HEAD_K.toFixed(4)};
const float TAIL_Z = ${REST[TAIL_1][2].toFixed(4)};
const float SPINE = ${(REST[BODY][1] + 0.035).toFixed(4)};
const float TURN = ${EYE_TURN.toFixed(4)};
const float TILT = ${EYE_TILT.toFixed(4)};

float band(float x, float width, float soft) {
  return 1.0 - smoothstep(width, width + soft, abs(x));
}

/** Mackerel tabby: stripes down the sides from a dark line along the spine, rings on the legs and tail, an M on the brow. */
float tabby(vec3 r) {
  float warp = vnoise(r.xz * 31.0 + r.y * 17.0) - 0.5;
  float ax = abs(r.x);
  if (r.z < TAIL_Z - 0.02) {
    float along = TAIL_Z - r.z;
    float ring = smoothstep(0.15, 0.55, sin(along * 64.0 - 0.6 + warp * 0.6));
    return max(ring, smoothstep(0.205, 0.225, along));
  }
  if (r.z > SKULL.z - 0.06 * HEAD_K && r.y > SKULL.y - 0.07 * HEAD_K) {
    /** The head's marks are laid out on the head as authored, before it was built at its size. */
    vec3 q = (r - SKULL) / HEAD_K;
    ax = abs(q.x);
    float brow = q.y - (EYE_C.y - SKULL.y) / HEAD_K;
    float front = smoothstep(-0.02, 0.01, q.z);
    float mid = band(q.x + warp * 0.002, 0.0045 - 0.002 * smoothstep(0.02, 0.05, brow), 0.002) * smoothstep(0.012, 0.02, brow) * front;
    float sides = band(length(vec2(ax - 0.017, (brow - 0.032) * 0.55)), 0.0045, 0.002) * front;
    float crown = band(ax - 0.012 + warp * 0.003, 0.0035, 0.002) * smoothstep(0.035, 0.045, q.y) * (1.0 - smoothstep(-0.01, 0.015, q.z));
    float cheek = band(brow + 0.002 + (ax - 0.04) * 0.25 + warp * 0.003, 0.0022, 0.0015) * smoothstep(0.044, 0.052, ax) * smoothstep(-0.035, 0.0, q.z);
    float jowl = band(brow + 0.016 + (ax - 0.05) * 0.4 + warp * 0.002, 0.0018, 0.0015) * smoothstep(0.052, 0.058, ax) * smoothstep(-0.02, 0.005, q.z);
    return max(max(mid, sides), max(max(crown, cheek), jowl));
  }
  if (r.y < 0.09 && ax > 0.012) {
    return smoothstep(0.25, 0.7, sin(r.y * 120.0 + warp * 1.6)) * smoothstep(0.02, 0.035, r.y);
  }
  float side = smoothstep(0.2, 0.7, sin(r.z * 150.0 + warp * 2.2 + ax * 12.0)) * smoothstep(SPINE - 0.075, SPINE - 0.035, r.y);
  float spine = band(ax, 0.008, 0.008) * smoothstep(SPINE - 0.01, SPINE + 0.01, r.y);
  return max(side, spine);
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

/** One strand to a cell of rest space, each its own length, tapering to a point: true where it still fills this shell. */
bool strand(vec3 rest, float t) {
  vec3 c = floor(rest * uStrand);
  vec3 f = fract(rest * uStrand) - 0.5;
  vec3 r = hash33(c + 9.1);
  /** Damp, much of the coat sticks down to the skin and what stands is in points. */
  if (fract(r.y + r.z * 7.13) < uClump * t) return false;
  float g = t / mix(0.5, 1.0, r.x);
  return g <= 1.0 && length(f - (hash33(c) - 0.5) * 0.4) < 0.62 * (1.0 - g * g * 0.95);
}

/** Pale patches over the eyes, as the sheet's tabby has. */
float browLight(vec3 r) {
  vec3 q = (r - EYE_C) / HEAD_K;
  return band(length(vec2((abs(r.x) - EYE_C.x) / HEAD_K + 0.002, (q.y - 0.021) * 1.6)), 0.0025, 0.0035) * step(SKULL.z, r.z);
}

void main() {
#ifdef SHELL
  if (!strand(vRest, vShell)) discard;
#endif
  vec3 N = normalize(vNormal);
  int m = int(vMat.x + 0.5);
  float k = vMat.y;
  vec3 V = normalize(cameraPosition - vWorld);
  float fleck = vnoise(vRest.xz * 140.0 + vRest.y * 97.0);
  vec3 ground = mix(FAWN, BACK, smoothstep(SPINE - 0.03, SPINE + 0.01, vRest.y) * step(TAIL_Z, vRest.z) * step(vRest.z, SKULL.z - 0.04));
  vec3 alb = mix(ground, STRIPE, tabby(vRest) * 0.9) * (0.93 + fleck * 0.14);
  alb = mix(alb, WHITE * (0.95 + fleck * 0.08), max(k, browLight(vRest) * 0.55));
  float fuzz = 0.6;
  float thin = 0.12;
  float ao = mix(0.7, 1.0, smoothstep(0.02, 0.16, vRest.y));
  float glintAmount = 0.0;
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
    alb = WHITE * 1.25;
    fuzz = 0.0;
    thin = 0.8;
  } else if (m == ${EYE}) {
    /**
     * Measured on the eye's own face: a big soft-edged pupil filling most of it and sitting a little high, so the
     * amber shows most underneath where the light falls into the eye, a dark outline, and a soft lid over the top.
     */
    float side = sign(vRest.x);
    vec3 q = vRest - vec3(side * EYE_C.x, EYE_C.y, EYE_C.z);
    q.x *= side;
    q = vec3(cos(TURN) * q.x - sin(TURN) * q.z, q.y, sin(TURN) * q.x + cos(TURN) * q.z);
    vec2 e = vec2(q.x, cos(TILT) * q.y + sin(TILT) * q.z) / ${EYE_RADIUS.toFixed(5)};
    float r = length(e);
    float pupil = 1.0 - smoothstep(uPupil - 0.035, uPupil + 0.015, length(e - vec2(0.0, 0.06)));
    vec3 fur = alb;
    vec3 iris = mix(IRIS_DEEP, IRIS, smoothstep(0.4, -0.8, e.y));
    alb = mix(iris, vec3(0.005, 0.004, 0.004), pupil);
    alb = mix(alb, vec3(0.025, 0.015, 0.01), smoothstep(0.9, 0.94, r));
    float lid = max(smoothstep(0.99, 1.02, r), smoothstep(0.9, 0.96, e.y + 0.1 * e.x * e.x));
    alb = mix(alb, fur * mix(0.92, 1.0, smoothstep(1.0, 1.1, r)), lid);
    vec2 g = vec2(e.x * side, e.y);
    float glint = (1.0 - smoothstep(0.17, 0.2, distance(g, uGlint))) + 0.6 * (1.0 - smoothstep(0.075, 0.095, distance(g, uGlint * vec2(-0.5, -0.4) + vec2(0.0, -0.38))));
    glintAmount = glint * (1.0 - lid);
    fuzz = 0.0;
    thin = 0.0;
    ao = 1.0;
  }
  /** Damp fur is darker and clumps, most of all low down where the water reached. */
  float soak = uWet * mix(0.45, 1.0, 1.0 - smoothstep(0.04, 0.14, vRest.y));
  if (m != ${EYE} && m != ${MOUTH}) {
    alb *= mix(1.0, 0.78, soak);
    fuzz *= 1.0 - 0.4 * soak;
  }
#ifdef SHELL
  /** Fur is shaded at the root and catches the light at the tip, which is the whole of why a coat looks soft. */
  alb *= mix(0.84, 1.04, vShell);
  ao = mix(0.86, 1.0, vShell);
  fuzz = 0.22;
#else
  /** Under a standing coat the skin is the roots; once the coat lies down with distance it is the whole cat. */
  if (m == ${COAT}) alb *= mix(1.0, 0.86, vFade);
#endif
  vec3 col = shadeCreature(alb, N, vWorld, ao, fuzz, thin, uAir);
  /** Out of the sun it must still read as a soft animal and not a hole in the dusk, so the sky fills it, warmed. */
  float edge = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  col += alb * uSkyAmbient * vec3(1.35, 1.05, 0.7) * (0.22 + 0.2 * (N.y * 0.5 + 0.5));
  col += uSkyAmbient * pow(edge, 3.0) * fuzz * 0.3;
  col += alb * (lanternLight(vWorld, N) * 0.8 + dawnLight(vWorld, N));
  /** A crisp catchlight on the side the light comes from, and a small one under it: the eyes are wet and alive in any light. */
  col += (uSunColor * 0.3 + uSkyAmbient * 2.0 + 0.06) * glintAmount * (1.0 - clamp(uBlink, 0.0, 1.0));
  if (m == ${NOSE}) col += uSunColor * pow(max(dot(N, halfVector(uSunDir, V)), 0.0), 40.0) * 0.15;
  // MSAA edge samples shaded outside the triangle extrapolate to negative colour, which half-float targets keep.
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

export interface CatLook {
  /** 0 open to 1 shut. */
  blink: number;
  /** How wide the pupils are, as a share of the eye: 0.55 calm in daylight to 0.82 wide with fright. */
  pupil: number;
  /** 0 on the ground to 1 up off it, where nothing on the ground shades it. */
  air: number;
  /** 0 dry to 1 soaked. */
  wet: number;
}

/**
 * The skin, and on `userData.coat` the same shader again as shells for the coat to be pushed out of. Both share one
 * set of uniforms, so `applyCatLook` writes each value once.
 */
export function catMaterial(bones: THREE.Matrix4[]): THREE.ShaderMaterial {
  const uniforms = {
    ...atmo.uniforms,
    uBones: { value: bones },
    uNudge: { value: 0 },
    uBlink: { value: 0 },
    uPupil: { value: 0.74 },
    uGlint: { value: new THREE.Vector2(0.3, 0.36) },
    uAir: { value: 1 },
    uWet: { value: 0.3 },
    uFur: { value: FUR },
    uLay: { value: new THREE.Vector3(0, -0.35, -0.7) },
    uStrand: { value: STRAND },
    uClump: { value: 0 },
  };
  const skin = new THREE.ShaderMaterial({ uniforms, vertexShader: CAT_VERT, fragmentShader: CAT_FRAG });
  skin.userData.coat = new THREE.ShaderMaterial({ uniforms, vertexShader: CAT_VERT, fragmentShader: CAT_FRAG, defines: { SHELL: '' } });
  return skin;
}

/** The coat itself: the furred skin drawn over again, each copy pushed a little further out along its own normal. */
export function coatShells(skin: THREE.ShaderMaterial): THREE.Mesh {
  const base = catCoatGeometry();
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
export function applyCatLook(mat: THREE.ShaderMaterial, look: CatLook, head: THREE.Quaternion): void {
  const u = mat.uniforms;
  sunInHead.copy(u.uSunDir.value).applyQuaternion(toHead.copy(head).invert());
  u.uGlint.value.set(THREE.MathUtils.clamp(sunInHead.x * 0.5, -0.36, 0.36), 0.36);
  u.uBlink.value = look.blink;
  u.uPupil.value = look.pupil;
  u.uAir.value = look.air;
  u.uWet.value = look.wet;
  u.uFur.value = FUR * (1 - look.wet * 0.35);
  u.uClump.value = look.wet * 0.45;
}

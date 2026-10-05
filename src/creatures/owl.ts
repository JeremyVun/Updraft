import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { SHAPE_SHADOW_GLSL, SHAPE_STUMP_CAPS, setOwlShadow, shapeUniforms } from '../world/wood-shape';
import { CREATURE_GLSL } from './shading';
import { blob, merge, mirrored, type BlobSpec } from './shapes';

const BODY = 0;
const HEAD = 1;
const FACE = 2;
const EYE_L = 3;
const EYE_R = 4;
const BEAK = 5;
const WING_L = 6;
const WING_R = 7;
const FEET = 8;
const TAIL = 9;

const PLUMAGE = 0;
const DISC = 1;
const EYE = 2;
const HORN = 3;
const WING = 4;
const DOWN = 5;

const NECK = new THREE.Vector3(0, 0.27, 0);
const CENTRE = new THREE.Vector3(0, 0.18, 0);
const SHOULDER = new THREE.Vector3(0.1, 0.24, -0.01);
const EYE_AT = new THREE.Vector3(0.057, 0.342, 0.136);
const EYE_SIZE = new THREE.Vector3(0.047, 0.047, 0.024);
/** The tip of the right ear tuft, on the head. */
const TUFT = new THREE.Vector3(0.1, 0.46, 0.0);
/** Larger than life, as the game's creatures are, so it reads from where the camera stands. */
const SCALE = 2.1;
/** The wing as built, spread: from the shoulder out to its tip, how far it reaches, and its chord. */
const WING_REACH = 0.44;
/** Where the wing's feathers are along it (0 at the shoulder, 1 at the tip) and across it (-1 trailing edge, 1 leading). */
const WING_GLSL = /* glsl */ `
float wingSpan(vec3 rest) { return clamp((abs(rest.x) - ${SHOULDER.x.toFixed(3)}) / ${WING_REACH.toFixed(3)}, 0.0, 1.0); }
float wingMid(float s) { return -0.02 - 0.06 * s * s; }
float wingHalf(float s) { return 0.11 * (1.0 - 0.45 * pow(s, 2.5)) + 0.004; }`;
/**
 * The painted wing card (`tools/pack-owl-bend.py`), in pixels of its 512 source: the shoulder and the rows it covers;
 * spread, it reaches this far from the shoulder, a little further than the folded wing would, as a cartoon owl's do.
 */
const CARD_SHOULDER = [4, 256];
const CARD_ROWS = [64, 452];
const CARD_REACH = 0.54;
const CARD_PX = CARD_REACH / 495;
/** Where the wing bends, as a share of its reach: the wrist, out past which the hand bends, sweeps and twists. */
const WRIST = 0.42;
/** Beyond this the eyeshine stops shrinking with distance. */
const GLOW_NEAR = 8;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform vec4 uOwl;
uniform vec4 uOwlHead;
uniform vec4 uOwlWing;
uniform vec4 uOwlBody;
uniform float uOwlTime;
in float aPart;
in vec2 aMat;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out vec3 vEye;
out vec3 vLocal;
out vec3 vRestN;
out float vPart;

const vec3 NECK = vec3(0.0, ${NECK.y}, 0.0);
const vec3 CENTRE = vec3(0.0, ${CENTRE.y}, 0.0);

void main() {
  int part = int(aPart + 0.5);
  vec3 p = position;
  vec3 n = normal;
  vLocal = p;
  vRestN = n;
  float fluff = uOwlHead.w;
  if (part == ${EYE_L} || part == ${EYE_R}) {
    vec3 c = vec3(${EYE_AT.x} * (part == ${EYE_L} ? -1.0 : 1.0), ${EYE_AT.y}, ${EYE_AT.z});
    vEye = (p - c) / vec3(${EYE_SIZE.x}, ${EYE_SIZE.y}, ${EYE_SIZE.z});
  } else vEye = vec3(0.0);
  // Fluffed up, the down stands out from the body in a soft shiver.
  if (part == ${BODY} || part == ${HEAD} || part == ${TAIL}) {
    vec3 c = part == ${HEAD} ? vec3(0.0, 0.33, 0.01) : CENTRE;
    float shiver = sin(uOwlTime * 38.0 + dot(p, vec3(61.0, 47.0, 53.0))) * 0.012 * fluff;
    p = c + (p - c) * (1.0 + 0.16 * fluff) + n * shiver;
  }
  if (part == ${FACE} || part == ${EYE_L} || part == ${EYE_R} || part == ${BEAK}) p.z += 0.014 * fluff;
  if (part == ${WING_L} || part == ${WING_R}) {
    float side = part == ${WING_R} ? 1.0 : -1.0;
    vec3 pivot = vec3(${SHOULDER.x} * side, ${SHOULDER.y}, ${SHOULDER.z});
    float fold = uOwlWing.x;
    p -= pivot;
    // As they open the painted cards take over from these.
    p *= smoothstep(0.55, 0.9, fold);
    // Folded at the wrist, the wing is half as long against its flank.
    p.x *= mix(1.0, 0.5, fold);
    // Spread is the wing as built, out sideways; folded it hangs down the flank and tucks back.
    vec3 q = rotZ(p, side * uOwlWing.y);
    vec3 nq = rotZ(n, side * uOwlWing.y);
    q = rotX(rotZ(q, -side * 1.42 * fold), 0.25 * fold);
    nq = rotX(rotZ(nq, -side * 1.42 * fold), 0.25 * fold);
    p = q + pivot + vec3(-side * 0.012 * fold, 0.0, 0.0) * (1.0 - fluff * 0.5);
    p.x += side * 0.02 * fluff * fold;
    n = nq;
  }
  if (part == ${HEAD} || part == ${FACE} || part == ${EYE_L} || part == ${EYE_R} || part == ${BEAK}) {
    p -= NECK;
    p = rotY(rotX(rotZ(p, uOwlHead.z), uOwlHead.y), uOwlHead.x);
    n = rotY(rotX(rotZ(n, uOwlHead.z), uOwlHead.y), uOwlHead.x);
    p += NECK;
  }
  p -= CENTRE;
  p = rotX(rotZ(p, uOwlBody.x), uOwlWing.z);
  n = rotX(rotZ(n, uOwlBody.x), uOwlWing.z);
  p += CENTRE;
  vec3 world = rotY(p * ${SCALE.toFixed(2)} * uOwlBody.y, uOwl.w) + uOwl.xyz;
  vWorld = world;
  vNormal = rotY(n, uOwl.w);
  vMat = aMat;
  vPart = aPart;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

/**
 * A small round owl, painted the way the game's other creatures are: soft wrapped light, cool shade, a warm rim, and
 * down that catches the light at its edges. Its eyes are the monster's eyes until light from the side shows them for
 * an owl's, and then they blink.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${SHAPE_SHADOW_GLSL}
${WING_GLSL}
uniform vec4 uOwlWing;
uniform vec4 uOwlEyes;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vEye;
in vec3 vLocal;
in vec3 vRestN;
in float vPart;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  int mat = int(vMat.x + 0.5);
  float t = vMat.y;
  float speck = vnoise(vLocal.xy * vec2(70.0, 52.0) + vLocal.z * 30.0);
  float streak = vnoise(vec2(vLocal.x * 48.0, vLocal.y * 16.0));
  vec3 back = mix(vec3(0.2, 0.12, 0.065), vec3(0.32, 0.2, 0.11), speck);
  // Pale spots across the back and the crown, the way a little owl is freckled.
  back = mix(back, vec3(0.62, 0.48, 0.3), smoothstep(0.8, 0.88, speck) * 0.7);
  vec3 breast = mix(vec3(0.5, 0.34, 0.19), vec3(0.28, 0.16, 0.08), smoothstep(0.55, 0.75, streak) * 0.8);
  vec3 alb = mix(back, breast, t);
  float fuzz = 1.0;
  float glow = 0.0;
  if (mat == ${DISC}) {
    // A pale ring round each eye with a soft dark rim, and white brows meeting over the beak.
    alb = mix(vec3(0.64, 0.5, 0.33), vec3(0.28, 0.17, 0.09), smoothstep(0.7, 0.98, t));
    alb = mix(alb, vec3(0.86, 0.82, 0.72), smoothstep(0.25, 0.0, abs(vLocal.y - 0.37 - abs(vLocal.x) * 0.25) * 12.0) * step(0.5, t) * 0.0 + smoothstep(0.5, 0.75, t) * smoothstep(0.0, 0.3, vLocal.y - 0.335) * 0.6);
  } else if (mat == ${HORN}) {
    alb = vec3(0.72, 0.66, 0.42); fuzz = 0.15;
  } else if (mat == ${WING}) {
    // Spotted coverts along the leading edge, then the long flight feathers, barred across, each with its own
    // rounded tip along the trailing edge; the tips at the end of the wing splay into fingers.
    float s = wingSpan(vLocal);
    float across = (vLocal.z - wingMid(s)) / wingHalf(s);
    // Each flight feather ends in a rounded tip; the long ones at the end of the wing splay further apart.
    float f = fract(s * 6.0 + across * 0.3 * s);
    float tipRound = 1.0 - sqrt(max(0.0, 1.0 - (2.0 * f - 1.0) * (2.0 * f - 1.0)));
    if (across < -1.0 + tipRound * mix(0.14, 0.4, smoothstep(0.5, 0.95, s))) discard;
    // Out at the tip the primaries part into fingers.
    float finger = fract((across * 0.5 + 0.5) * 5.0 + (s - 0.7) * 1.2);
    if (finger < 0.24 * smoothstep(0.72, 0.92, s)) discard;
    // The coverts overlap the flight feathers in a scalloped row of their own.
    float g = fract(s * 11.0);
    float coverts = smoothstep(-0.02, 0.02, across - 0.05 - 0.18 * sqrt(max(0.0, 1.0 - (2.0 * g - 1.0) * (2.0 * g - 1.0))));
    float flight = 1.0 - coverts;
    float bars = smoothstep(0.3, 0.7, abs(fract(across * 2.2 + s * 1.5) * 2.0 - 1.0)) * flight;
    float shaft = (1.0 - smoothstep(0.03, 0.09, abs(f - 0.5))) * flight;
    float under = step(vRestN.y, 0.0);
    vec3 top = mix(mix(vec3(0.3, 0.18, 0.09), vec3(0.12, 0.07, 0.035), bars), back, coverts);
    top = mix(top, vec3(0.55, 0.42, 0.26), smoothstep(0.82, 0.9, speck) * coverts * 0.8);
    top *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.06, abs(across - 0.05 - 0.18 * sqrt(max(0.0, 1.0 - (2.0 * g - 1.0) * (2.0 * g - 1.0))))));
    vec3 below = mix(vec3(0.52, 0.4, 0.26), vec3(0.3, 0.2, 0.11), bars * 0.8);
    alb = mix(top, below, under) * (1.0 - 0.3 * shaft);
  } else if (mat == ${DOWN}) {
    alb = vec3(0.45, 0.35, 0.23);
  } else if (mat == ${EYE}) {
    fuzz = 0.0;
    float r = length(vEye.xy);
    // A big black pupil in a yellow iris; the lid comes down over it from above when it blinks.
    alb = mix(vec3(0.02, 0.015, 0.01), mix(vec3(1.0, 0.76, 0.12), vec3(0.85, 0.5, 0.06), smoothstep(0.55, 0.95, r)), smoothstep(0.42, 0.5, r));
    float lid = step(1.0 - 2.1 * uOwlEyes.z, vEye.y);
    glow = (1.0 - lid) * smoothstep(0.0, 0.3, vEye.z);
    alb = mix(alb, vec3(0.4, 0.29, 0.18), lid);
  }
  vec3 moon = uSunColor * uNight;
  float wrap = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float edge = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
  vec3 col = alb * (hemiLight(N) * 0.8 + moon * (wrap * wrap * 0.4 + 0.08));
  col += moon * edge * fuzz * 0.15 * (0.3 + 0.7 * alb);
  // Until the side coal's light is on it, it is a dark lump in the fork with eyes; flying, her light finds it.
  vec3 warm = emberLight(vWorld, N) * mix(0.04, 0.45, uOwlEyes.y) * (1.0 - 0.5 * uOwlWing.w) + shapeSideLight(vWorld, N) * 0.4 * uOwlEyes.y;
  // Sat down in the fork it would be in the dead limbs' shade; let the light that shows it reach it.
  float shade = mix(1.0, shapeShadowCaps(vWorld + N * 0.03, ${SHAPE_STUMP_CAPS}), 0.3);
  col += (alb + 0.012) * warm * shade;
  col += warm * shade * edge * fuzz * 0.6 * (0.3 + 0.7 * alb);
  if (mat == ${EYE}) {
    // Further off, the eyeshine drawn over the eyes is spread wider than they are and is the only pair there is.
    float near = 1.0 - smoothstep(${GLOW_NEAR.toFixed(1)}, ${(GLOW_NEAR + 1).toFixed(1)}, distance(cameraPosition, vWorld));
    float own = mix(1.0, near, min(1.0, uOwlEyes.x * 4.0));
    col += vec3(1.0, 0.95, 0.85) * catchlight(N, vWorld) * (0.25 + 0.6 * length(warm * shade)) * glow * own;
    // Eyeshine: the light thrown back out of the eyes, which is all a frightened child sees of them in the dark.
    col += vec3(1.0, 0.72, 0.22) * uOwlEyes.x * glow * 1.8 * near;
  }
  // Flying up out of the firelight it keeps the coals' warmth from below and a warm edge to its down, so it reads as a
  // little brown owl against the night sky rather than a pale moth; the moon only touches its back.
  if (uOwlWing.w > 0.0) {
    vec3 fire = vec3(1.0, 0.55, 0.25) * uOwlWing.w;
    col += alb * fire * clamp(0.45 - N.y * 0.55, 0.0, 1.0) * 0.18;
    col += fire * edge * fuzz * 0.16 * (0.25 + 0.75 * alb);
    col += alb * vec3(0.45, 0.5, 0.62) * uNight * max(0.0, N.y) * 0.12 * uOwlWing.w;
  }
  col *= uOwlEyes.w;
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

/** The wing as the cards are posed: a point of the card (along it, across it), out from the shoulder, in the owl's own frame. */
const CARD_POSE_GLSL = /* glsl */ `
uniform vec4 uOwlWing;
uniform vec4 uOwlHand;
vec3 wingPoint(vec2 ac, float side) {
  float fold = uOwlWing.x;
  float s = ac.x / ${CARD_REACH.toFixed(3)};
  // Arched over its chord, most at the arm, so it never lies dead flat.
  float arch = 1.0 - min(1.0, pow((ac.y + 0.01) / 0.22, 2.0));
  vec3 q = vec3(ac.x * side, 0.032 * arch * (1.0 - 0.5 * s), ac.y);
  float hand = smoothstep(0.28, 0.62, s);
  vec3 wrist = vec3(${(WRIST * CARD_REACH).toFixed(3)} * side, 0.0, 0.0);
  q = wrist + rotZ(rotY(q - wrist, side * uOwlHand.y * hand), side * uOwlHand.x * hand);
  q = rotX(q, uOwlHand.z * s);
  q *= mix(1.0, 0.4, fold);
  q = rotZ(q, side * uOwlWing.y);
  q = rotX(rotZ(q, -side * 1.42 * fold), 0.25 * fold);
  return q + vec3(${SHOULDER.x} * side, ${SHOULDER.y}, ${SHOULDER.z});
}`;

const CARD_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${CARD_POSE_GLSL}
uniform vec4 uOwl;
uniform vec4 uOwlBody;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vCard;
const vec3 CENTRE = vec3(0.0, ${CENTRE.y}, 0.0);
vec3 owlFrame(vec3 p) {
  p -= CENTRE;
  p = rotX(rotZ(p, uOwlBody.x), uOwlWing.z);
  p += CENTRE;
  return rotY(p * ${SCALE.toFixed(2)} * uOwlBody.y, uOwl.w) + uOwl.xyz;
}
void main() {
  float side = position.z;
  vec2 ac = position.xy;
  vec3 p = wingPoint(ac, side);
  vec3 along = wingPoint(ac + vec2(0.01, 0.0), side) - p;
  vec3 across = wingPoint(ac + vec2(0.0, 0.01), side) - p;
  vec3 n = normalize(cross(across, along)) * side;
  vWorld = owlFrame(p);
  vNormal = rotY(rotX(rotZ(n, uOwlBody.x), uOwlWing.z), uOwl.w);
  vCard = vec2(ac.x / ${CARD_PX.toFixed(6)} + ${CARD_SHOULDER[0].toFixed(1)}, ${CARD_SHOULDER[1].toFixed(1)} - ac.y / ${CARD_PX.toFixed(6)}) / 512.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * The painted wing: its barred top where the camera sees the top of it, its pale underside where it sees under it,
 * lit as the body is so the two are one owl.
 */
const CARD_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${SHAPE_SHADOW_GLSL}
uniform sampler2D uWingCard;
uniform vec4 uOwlWing;
uniform vec4 uOwlEyes;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vCard;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  float top = step(0.0, dot(N, V));
  if (top < 0.5) N = -N;
  vec4 paint = texture(uWingCard, vec2(vCard.x, (1.0 - vCard.y) * 0.5 + 0.5 * top));
  if (paint.a < 0.5) discard;
  vec3 alb = paint.rgb * mix(vec3(0.62, 0.55, 0.5), vec3(1.0), top);
  vec3 moon = uSunColor * uNight;
  float wrap = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float edge = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
  vec3 col = alb * (hemiLight(N) * 0.8 + moon * (wrap * wrap * 0.4 + 0.08));
  // Spread feathers are thin: the firelight on the far side of a wing comes through it.
  vec3 warm = (emberLight(vWorld, N) + 0.7 * emberLight(vWorld, -N)) * mix(0.04, 0.45, uOwlEyes.y) * (1.0 - 0.5 * uOwlWing.w)
    + (shapeSideLight(vWorld, N) + 0.7 * shapeSideLight(vWorld, -N)) * 0.4 * uOwlEyes.y;
  col += (alb + 0.012) * warm;
  if (uOwlWing.w > 0.0) {
    vec3 fire = vec3(1.0, 0.55, 0.25) * uOwlWing.w;
    col += alb * fire * (clamp(0.45 - N.y * 0.55, 0.0, 1.0) * 0.18 + 0.08);
    col += fire * edge * 0.12 * (0.25 + 0.75 * alb);
    col += alb * vec3(0.45, 0.5, 0.62) * uNight * max(0.0, N.y) * 0.12 * uOwlWing.w;
  }
  col *= uOwlEyes.w;
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

/** Both wing cards: a grid over the painted wing, along it and across it from the shoulder, its side in z. */
function cardGeometry(): THREE.BufferGeometry {
  const ALONG = 18, ACROSS = 8;
  const pos: number[] = [], index: number[] = [];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= ACROSS; j++) {
      const row = THREE.MathUtils.lerp(CARD_ROWS[0], CARD_ROWS[1], j / ACROSS);
      for (let i = 0; i <= ALONG; i++) {
        pos.push((i / ALONG * 508 - CARD_SHOULDER[0]) * CARD_PX, (CARD_SHOULDER[1] - row) * CARD_PX, side);
      }
    }
    for (let j = 0; j < ACROSS; j++) {
      for (let i = 0; i < ALONG; i++) {
        const a = base + j * (ALONG + 1) + i, b = a + ALONG + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

const GLOW_VERT = /* glsl */ `
uniform vec3 uEyeL;
uniform vec3 uEyeR;
uniform float uGlowSize;
in float aSide;
out vec2 vUv;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 mid = (uEyeL + uEyeR) * 0.5;
  // Far off in the dark, the pair keeps the size it has close to: two eyes, never one spark.
  float far = max(1.0, distance(mid, cameraPosition) / ${GLOW_NEAR.toFixed(1)});
  vec3 c = mid + ((aSide < 0.0 ? uEyeL : uEyeR) - mid) * far;
  vUv = position.xy;
  vec4 view = viewMatrix * vec4(c + (right * position.x + up * position.y) * uGlowSize * far, 1.0);
  // Spread, it stands off the face as far as it is spread, so the limbs either side never cut into it.
  view.xyz += normalize(-view.xyz) * 0.12 * far;
  gl_Position = projectionMatrix * view;
}`;

const GLOW_FRAG = /* glsl */ `
uniform float uGlow;
uniform float uBlink;
in vec2 vUv;
void main() {
  float r = length(vUv);
  // Two crisp points with only a breath of glow round them.
  // The lid comes down over each from above, as it does over the eye itself.
  float lid = mix(0.38, -0.4, uBlink);
  float a = smoothstep(0.36, 0.18, r) * (1.0 - smoothstep(lid - 0.05, lid + 0.05, vUv.y)) * 0.92
    + exp(-r * r * 4.0) * 0.06 * (1.0 - uBlink);
  a *= 1.0 - smoothstep(0.8, 1.0, r);
  gl_FragColor = vec4(vec3(1.0, 0.7, 0.24) * a * uGlow, 1.0);
}`;

function owlGeometry(): THREE.BufferGeometry {
  const disc: BlobSpec = {
    part: FACE, mat: DISC, at: [-0.058, 0.336, 0.112], size: [0.077, 0.083, 0.032], rot: [0, -0.3, 0], detail: 3,
    blend: (u) => Math.hypot(u.x, u.y),
  };
  const eye: BlobSpec = { part: EYE_L, mat: EYE, at: [-EYE_AT.x, EYE_AT.y, EYE_AT.z], size: [EYE_SIZE.x, EYE_SIZE.y, EYE_SIZE.z], detail: 3 };
  // Out from the shoulder, its chord broad and swept back toward a rounded tip, as `WING_GLSL` reads it.
  const wing: BlobSpec = {
    part: WING_L, mat: WING, at: [-SHOULDER.x, SHOULDER.y, SHOULDER.z], offset: [-WING_REACH / 2, 0, 0], size: [WING_REACH / 2, 0.014, 1],
    detail: 4,
    shape: (u) => {
      const s = (1 - u.x) / 2;
      const r = Math.sqrt(Math.max(1 - u.x * u.x, 1e-4));
      const across = THREE.MathUtils.clamp(u.z / r, -1, 1);
      const half = 0.11 * (1 - 0.45 * s ** 2.5) + 0.004;
      u.z = -0.02 - 0.06 * s * s + across * half * r ** 0.25;
      u.y *= r ** 0.5;
    },
    blend: (u) => -u.x * 0.5 + 0.5,
  };
  const foot: BlobSpec = { part: FEET, mat: DOWN, at: [-0.04, 0.012, 0.05], size: [0.028, 0.016, 0.034], detail: 1 };
  const tuft: BlobSpec = {
    part: HEAD, mat: PLUMAGE, at: [-TUFT.x, TUFT.y - 0.035, TUFT.z], size: [0.03, 0.055, 0.024], rot: [0, 0, 0.35], detail: 2,
    shape: (u) => { const k = 1 - 0.7 * Math.max(0, u.y); u.x *= k; u.z *= k; },
    blend: () => 0,
  };
  const parts: BlobSpec[] = [
    {
      part: BODY, mat: PLUMAGE, at: [0, 0.16, 0], size: [0.13, 0.15, 0.12], detail: 3,
      shape: (u) => { const k = 1 + 0.12 * Math.max(0, -u.y); u.x *= k; u.z *= k; },
      blend: (u) => THREE.MathUtils.smoothstep(u.z * 0.9 - u.y * 0.3, 0.05, 0.55),
    },
    {
      part: HEAD, mat: PLUMAGE, at: [0, 0.34, 0.012], size: [0.152, 0.13, 0.128], detail: 3,
      shape: (u) => { u.y *= 1 - 0.12 * Math.max(0, u.y) * Math.abs(u.x); },
      blend: () => 0,
    },
    disc, mirrored(disc, FACE),
    eye, mirrored(eye, EYE_R),
    {
      part: BEAK, mat: HORN, at: [0, 0.314, 0.146], size: [0.014, 0.024, 0.018], rot: [0.5, 0, 0], detail: 1,
      shape: (u) => { const k = 1 - 0.6 * Math.max(-u.y, 0); u.x *= k; u.z *= k; },
    },
    wing, mirrored(wing, WING_R),
    foot, mirrored(foot, FEET),
    tuft, mirrored(tuft, HEAD),
    { part: TAIL, mat: PLUMAGE, at: [0, 0.06, -0.1], size: [0.05, 0.02, 0.07], rot: [0.5, 0, 0], detail: 1, blend: () => 0 },
  ];
  return merge(parts.map(blob));
}

const rotX = (p: THREE.Vector3, a: number) => p.set(p.x, Math.cos(a) * p.y - Math.sin(a) * p.z, Math.sin(a) * p.y + Math.cos(a) * p.z);
const rotY = (p: THREE.Vector3, a: number) => p.set(Math.cos(a) * p.x + Math.sin(a) * p.z, p.y, -Math.sin(a) * p.x + Math.cos(a) * p.z);
const rotZ = (p: THREE.Vector3, a: number) => p.set(Math.cos(a) * p.x - Math.sin(a) * p.y, Math.sin(a) * p.x + Math.cos(a) * p.y, p.z);

/** The tip of a wing card as `CARD_POSE_GLSL` poses it, in the owl's own frame. */
function wingTip(owl: Owl, side: number, out: THREE.Vector3): THREE.Vector3 {
  const wrist = WRIST * CARD_REACH * side;
  out.set(CARD_REACH * 0.95 * side - wrist, 0, 0);
  rotZ(rotY(out, side * owl.hand.y), side * owl.hand.x);
  out.x += wrist;
  rotX(out, owl.hand.z * 0.95);
  out.multiplyScalar(THREE.MathUtils.lerp(1, 0.4, owl.fold));
  rotZ(out, side * owl.flap);
  rotX(rotZ(out, -side * 1.42 * owl.fold), 0.25 * owl.fold);
  out.x += SHOULDER.x * side;
  out.y += SHOULDER.y;
  out.z += SHOULDER.z;
  return out;
}

type Phase = 'perched' | 'awake' | 'leaving' | 'gone';

/** One little hop round on the perch toward the way it means to go: when it starts, after `leave`, and its share of the turn. */
const SHUFFLES = [[0.3, 1]];
/** The spring off the fork, after `leave`: it crouches on its toes from `CROUCH` and is off at `LAUNCH`. */
const CROUCH = 0.75;
const LAUNCH = 1.3;
/** Seconds of flight per burst of wingbeats, and how much of each is beating rather than gliding. */
const BURST = 1.6;
const BEATING = 0.7;
const BEAT_RATE = 2.3;
/** Seconds from the leap to the end of its way, and the look down at her as it comes over, seconds into the flight. */
const FLIGHT = 6.8;
const GLANCE = [2.3, 3.4];
/** The wings' angle over its back (radians): the middle of the stroke, and where it holds them in a glide. */
const STROKE_MID = 0.55;
const GLIDE_LIFT = 0.45;
/** The wings' twist, leading edges down, so the barred tops of both are turned to a camera level with it. */
const WING_CUP = 0.45;
/** How far round it turns its breast toward where it is watched from, at most, on top of its heading. */
const SHOW_TURN = 1.8;
/** How much larger it grows on the wing, while its wings open, than it sat in the fork. */
const FLIGHT_GROW = 0.3;

/**
 * The owl in the fork: what it is doing, kept apart from how it is drawn so the story can drive it without a
 * renderer. Unseen it sits stock still and stares, blinking now and then. Shown for what it is, it blinks slowly,
 * tilts its head at her, fluffs itself up and hoots; then it looks the way it means to go, hops round on the fork,
 * crouches and is off on a few soft wingbeats and glides, banking round up over the path with one look back.
 */
export class Owl {
  readonly position = new THREE.Vector3();
  yaw = 0;
  /** Head turn, nod and tilt, radians. */
  readonly head = new THREE.Vector3();
  /** 0 spread, 1 folded; the wingbeat; the body's pitch forward and its roll into a turn. */
  fold = 1;
  flap = 0;
  pitch = 0;
  roll = 0;
  /** The hand of each wing at the wrist: bent up (radians), swept back, and the wing's twist, leading edge down. */
  readonly hand = new THREE.Vector3();
  fluff = 0;
  blink = 0;
  /** How much light its eyes throw back, set by the story from where the light is. */
  eyeshine = 0.6;
  /** How much of the firelight reaches it: none until the story's side light shows it. */
  shown = 0;
  /** 1 seen, falling to 0 as it goes off into the dark. */
  presence = 1;
  /** How much of the moon through the canopy it has flown up into. */
  moonlit = 0;
  phase: Phase = 'perched';
  /** How much larger than it sat it has grown on the wing, so it still reads as an owl up against the dark. */
  size = 1;
  /** Which of the painted flap frames its wings are in: 0 up, 1 coming down, 2 down, 3 going up. */
  wingFrame = 0;
  /** Raised once, the frame it hoots. */
  hooted = false;
  private t = 0;
  private time = 0;
  private nextBlink = 0;
  private blinkAt = -1;
  private readonly perch = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private readonly watch = new THREE.Vector3();
  private watching = false;
  private readonly audience = new THREE.Vector3();
  private showing = false;
  private readonly tmp = new THREE.Vector3();
  private sitYaw = 0;
  private flightYaw = 0;
  private beat = 0;
  private way: THREE.CatmullRomCurve3 | null = null;
  private readonly along = new THREE.Vector3();

  sit(at: THREE.Vector3, yaw: number): void {
    this.perch.copy(at);
    this.position.copy(at);
    this.yaw = this.sitYaw = yaw;
    this.phase = 'perched';
    this.fold = 1; this.flap = 0; this.pitch = 0; this.roll = 0; this.fluff = 0; this.blink = 0; this.presence = 1;
    this.moonlit = 0; this.shown = 0; this.beat = 0; this.size = 1;
    this.head.set(0, 0, 0);
    this.hand.set(0, 0, 0);
    this.hooted = false;
    this.t = 0;
    this.blinkAt = -1;
    this.nextBlink = 1.5;
  }

  /** Light from the side: it is only an owl after all. */
  wake(): void {
    if (this.phase !== 'perched') return;
    this.phase = 'awake';
    this.t = 0;
    this.blinkAt = -1;
    this.nextBlink = 0.5;
  }

  /** Off the fork and along `way`, a few points in the world from just off the perch to somewhere it is gone. */
  leave(way: readonly THREE.Vector3[]): void {
    if (this.phase === 'leaving' || this.phase === 'gone') return;
    this.way = new THREE.CatmullRomCurve3([this.perch.clone(), ...way.map((p) => p.clone())], false, 'centripetal');
    this.way.getTangentAt(0.04, this.away);
    this.flightYaw = Math.atan2(this.away.x, this.away.z);
    this.beat = 0;
    this.phase = 'leaving';
    this.t = 0;
  }

  /** Where it is watched from: on the wing it turns its breast partway that way, so its face and wings are seen. */
  showTo(at: THREE.Vector3 | null): void {
    this.showing = !!at;
    if (at) this.audience.copy(at);
  }

  lookAt(at: THREE.Vector3 | null): void {
    this.watching = !!at;
    if (at) this.watch.copy(at);
  }

  get gone(): boolean { return this.phase === 'gone'; }

  /** Seconds since it last changed what it is doing. */
  get elapsed(): number { return this.t; }

  update(dt: number): void {
    this.time += dt;
    this.t += dt;
    this.hooted = false;
    const t = this.t;
    if (this.phase === 'perched') {
      // Stock still and staring, as an owl is when it has been seen and hopes it has not; only the eyes go.
      this.turnHead(dt, 0.6);
      this.blinking(t, 0.3, 2.6, 2.2);
      return;
    }
    if (this.phase === 'awake') {
      this.turnHead(dt, 3);
      // A slow tilt one way and the other: curious, not afraid.
      this.head.z = 0.32 * Math.sin(Math.max(0, t - 0.6) * 1.6) * THREE.MathUtils.smoothstep(t, 0.6, 1.4) * (1 - THREE.MathUtils.smoothstep(t, 3.2, 3.8));
      this.blinking(t, 0.42, 1.1, t < 2 ? 0 : 0.8);
      // It fluffs itself up and shakes out, then settles again.
      this.fluff = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 3.6) / 1.1, 0, 1)) * 0.95;
      if (t >= 5.0 && t - dt < 5.0) this.hooted = true;
      // The soft hoot lifts its head and puffs its throat.
      this.head.y = -0.18 * Math.sin(Math.PI * THREE.MathUtils.clamp((t - 5.0) / 0.9, 0, 1));
      return;
    }
    if (this.phase === 'leaving') this.fly(dt, t);
  }

  /** Lids down and up over `length` seconds, every `every` seconds or so. */
  private blinking(t: number, length: number, every: number, spread: number): void {
    if (t > this.nextBlink && this.blinkAt < 0) this.blinkAt = t;
    if (this.blinkAt < 0) { this.blink = 0; return; }
    const b = (t - this.blinkAt) / length;
    this.blink = b < 0.4 ? b / 0.4 : Math.max(0, 1 - (b - 0.4) / 0.6);
    if (b >= 1) {
      this.blinkAt = -1;
      this.blink = 0;
      this.nextBlink = t + every + spread * (0.5 + 0.5 * Math.sin(t * 7.3 + this.time));
    }
  }

  private fly(dt: number, t: number): void {
    const smooth = THREE.MathUtils.smoothstep;
    this.blink = 0;
    this.fluff = Math.max(0, this.fluff - dt * 2);
    this.head.y *= Math.exp(-dt * 4);
    this.head.z *= Math.exp(-dt * 5);
    const turn = Math.atan2(Math.sin(this.flightYaw - this.sitYaw), Math.cos(this.flightYaw - this.sitYaw));
    if (t < LAUNCH || !this.way) {
      // It looks the way it means to go, hops round after its head, sinks on its toes, and springs with its wings
      // coming open wide.
      const look = turn - (this.yaw - this.sitYaw);
      this.head.x += (THREE.MathUtils.clamp(look, -1.4, 1.4) - this.head.x) * (1 - Math.exp(-dt * 5));
      this.head.y += (-0.2 * smooth(t, 0.1, 0.3) * (1 - smooth(t, 0.7, 1.0)) - this.head.y) * (1 - Math.exp(-dt * 8));
      let hop = 0, turned = 0;
      for (const [at, share] of SHUFFLES) {
        const k = smooth(t, at, at + 0.22);
        turned += share * k;
        hop = Math.max(hop, Math.sin(Math.PI * k));
      }
      this.yaw = this.sitYaw + turn * turned;
      const crouch = smooth(t, CROUCH, LAUNCH - 0.12) * (1 - smooth(t, LAUNCH - 0.12, LAUNCH));
      const spring = smooth(t, LAUNCH - 0.12, LAUNCH);
      this.pitch = 0.4 * crouch + 0.3 * spring;
      this.fold = 1 - smooth(t, LAUNCH - 0.3, LAUNCH);
      this.flap = 1.05 * smooth(t, LAUNCH - 0.3, LAUNCH);
      this.position.copy(this.perch);
      this.position.y += 0.07 * hop - 0.1 * crouch + 0.12 * spring;
      this.moonlit = 0;
      this.wingFrame = 0;
      this.flapWas = this.flap;
      return;
    }
    const s = t - LAUNCH;
    // The first stroke is wide and slow, then bursts of soft, slightly uneven beats with a glide between.
    const beating = s < BURST * BEATING || (s % BURST) / BURST < BEATING ? 1 : 0;
    this.flapBlend += (beating - this.flapBlend) * (1 - Math.exp(-dt * 7));
    const first = 1 - smooth(s, 0.35, 0.7);
    this.beat += dt * BEAT_RATE * Math.PI * 2 * (0.3 + 0.7 * this.flapBlend) * (0.55 + 0.45 * (1 - first)) * (1 + 0.12 * Math.sin(this.beat * 0.5));
    // Down quickly, up slowly, every other stroke a little shallower.
    const stroke = Math.cos(this.beat + 0.4 * Math.sin(this.beat));
    const depth = 0.72 * (1 - 0.18 * (0.5 + 0.5 * Math.cos(this.beat * 0.5))) + 0.3 * first;
    // The stroke sweeps from high over its back to just under level and no further, so the wings are broad to the
    // camera beside it through most of the beat and edge on only as they pass level.
    this.flap = THREE.MathUtils.lerp(GLIDE_LIFT, STROKE_MID + depth * stroke, this.flapBlend);
    // The hands trail the arms: bent up as the wings come down, bent down and swept back as they go up again.
    const going = Math.sin(this.beat + 0.4 * Math.sin(this.beat)) * this.flapBlend;
    const down = Math.max(0, going), up = Math.max(0, -going);
    this.hand.set(0.35 * down - 0.55 * up, 0.55 * up, (WING_CUP + 0.18 * down - 0.1 * up) * this.flapBlend + WING_CUP * 0.6 * (1 - this.flapBlend));
    this.fold = Math.max(0, this.fold - dt * 5);
    this.wingFrame = this.flap > 0.95 ? 0 : this.flap < 0.2 ? 2 : this.flap < this.flapWas ? 1 : 3;
    this.flapWas = this.flap;
    // Unhurried off the fork, gathering way, then climbing away.
    const k = THREE.MathUtils.clamp(s / FLIGHT, 0, 1);
    const u = THREE.MathUtils.clamp(0.5 * k * k + 0.5 * k + 0.03 * Math.sin(Math.PI * k), 0, 1);
    this.way.getPointAt(u, this.position);
    // Each downstroke lifts it a little and it sinks in the glide; the first one bobs it up, and it settles.
    const bob = 0.14 * Math.sin(Math.PI * smooth(s, 0.15, 0.75)) - 0.06 * Math.sin(Math.PI * smooth(s, 0.75, 1.2));
    this.position.y += 0.07 * stroke * this.flapBlend - 0.05 * (1 - this.flapBlend) + bob;
    this.way.getTangentAt(Math.min(0.999, u + 0.01), this.along);
    const before = this.yaw;
    let heading = Math.atan2(this.along.x, this.along.z);
    if (this.showing) {
      const toward = Math.atan2(this.audience.x - this.position.x, this.audience.z - this.position.z) - heading;
      heading += THREE.MathUtils.clamp(Math.atan2(Math.sin(toward), Math.cos(toward)), -SHOW_TURN, SHOW_TURN) * 0.92;
    }
    this.yaw += Math.atan2(Math.sin(heading - this.yaw), Math.cos(heading - this.yaw)) * (1 - Math.exp(-dt * 3));
    const swing = Math.atan2(Math.sin(this.yaw - before), Math.cos(this.yaw - before)) / Math.max(dt, 1e-4);
    this.roll += (THREE.MathUtils.clamp(-swing * 0.5, -0.3, 0.3) - this.roll) * (1 - Math.exp(-dt * 4));
    // It flies sat up, as a little owl in a picture book does, more so as it climbs, so from below its face still shows.
    const climb = Math.atan2(this.along.y, Math.hypot(this.along.x, this.along.z));
    this.pitch += (Math.max(0.12, 0.42 - 0.5 * climb) - this.pitch) * (1 - Math.exp(-dt * 5));
    // It looks down at her as it comes over her, and then on the way it goes.
    const back = smooth(s, GLANCE[0], GLANCE[0] + 0.4) * (1 - smooth(s, GLANCE[1], GLANCE[1] + 0.4));
    this.tmp.copy(this.watch).sub(this.position);
    const toHer = Math.atan2(Math.sin(Math.atan2(this.tmp.x, this.tmp.z) - this.yaw), Math.cos(Math.atan2(this.tmp.x, this.tmp.z) - this.yaw));
    let look = this.watching ? THREE.MathUtils.clamp(toHer, -1.7, 1.7) * back : 0;
    if (this.showing) {
      // Never so far round that its face is turned from where it is watched: at most it is seen in profile.
      const seen = Math.atan2(this.audience.x - this.position.x, this.audience.z - this.position.z) - this.yaw;
      const from = Math.atan2(Math.sin(seen), Math.cos(seen));
      look = THREE.MathUtils.clamp(look, from - 1.45, from + 1.45);
    }
    this.head.x += (look - this.head.x) * (1 - Math.exp(-dt * 6));
    this.head.y += ((this.watching ? 0.2 * back : 0) - this.head.y) * (1 - Math.exp(-dt * 6));
    this.moonlit = smooth(s, 0.2, 1.5);
    this.size = 1 + FLIGHT_GROW * smooth(s, 0.15, 1.4);
    this.presence = 1 - smooth(s, FLIGHT - 0.7, FLIGHT);
    if (s >= FLIGHT) this.phase = 'gone';
  }

  private flapBlend = 1;
  private flapWas = 0;

  /** Seconds since it left the fork; 0 while it is still on it. */
  get flightSeconds(): number { return this.phase === 'leaving' ? Math.max(0, this.t - LAUNCH) : 0; }

  private turnHead(dt: number, rate: number): void {
    if (!this.watching) return;
    this.tmp.copy(this.watch).sub(this.position);
    const want = Math.atan2(this.tmp.x, this.tmp.z) - this.yaw;
    const turn = THREE.MathUtils.clamp(Math.atan2(Math.sin(want), Math.cos(want)), -1.6, 1.6);
    this.head.x += (turn - this.head.x) * (1 - Math.exp(-dt * rate));
  }

  /** A point on the owl in its own frame, through its pose, into the world; `onHead` turns it with the head. */
  toWorld(local: THREE.Vector3, onHead: boolean, out: THREE.Vector3): THREE.Vector3 {
    out.copy(local);
    if (onHead) {
      out.sub(NECK);
      rotY(rotX(rotZ(out, this.head.z), this.head.y), this.head.x);
      out.add(NECK);
    }
    out.sub(CENTRE);
    rotX(rotZ(out, this.roll), this.pitch);
    out.add(CENTRE).multiplyScalar(SCALE * this.size);
    rotY(out, this.yaw);
    return out.add(this.position);
  }
}

/** The one owl, in the stump at the bend of the dark wood. */
export const woodOwl = new Owl();

/** Draws an `Owl`: its body, the eyeshine that floats over its eyes in the dark, and its share of the stump's shadow. */
export class OwlBody {
  readonly mesh: THREE.Mesh;
  /** The painted wings, which open out of the folded ones as it leaves. */
  readonly wings: THREE.Mesh;
  readonly glow: THREE.Mesh;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly glowUniforms: Record<string, THREE.IUniform>;
  private readonly local = new THREE.Vector3();
  private readonly left = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly body = new THREE.Vector3();
  private readonly headAt = new THREE.Vector3();
  private readonly wingBones: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly tufts: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  private time = 0;

  constructor(wing: THREE.Texture) {
    this.uniforms = {
      ...atmo.uniforms,
      ...shapeUniforms,
      uOwl: { value: new THREE.Vector4() },
      uOwlHead: { value: new THREE.Vector4() },
      uOwlWing: { value: new THREE.Vector4() },
      uOwlBody: { value: new THREE.Vector4() },
      uOwlEyes: { value: new THREE.Vector4() },
      uOwlHand: { value: new THREE.Vector4() },
      uOwlTime: { value: 0 },
    };
    this.mesh = new THREE.Mesh(owlGeometry(), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
    }));
    this.mesh.name = 'wood-owl';
    this.mesh.frustumCulled = false;
    this.wings = new THREE.Mesh(cardGeometry(), new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uWingCard: { value: wing } }, vertexShader: CARD_VERT, fragmentShader: CARD_FRAG,
      side: THREE.DoubleSide, alphaToCoverage: true,
    }));
    this.wings.name = 'wood-owl-wings';
    this.wings.frustumCulled = false;
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [], side: number[] = [], index: number[] = [];
    for (const s of [-1, 1]) {
      const base = pos.length / 3;
      const p = quad.getAttribute('position');
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), 0); side.push(s); }
      for (const i of quad.index!.array) index.push(base + i);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    geo.setIndex(index);
    this.glowUniforms = { uEyeL: { value: new THREE.Vector3() }, uEyeR: { value: new THREE.Vector3() }, uGlow: { value: 0 }, uBlink: { value: 0 }, uGlowSize: { value: 0.09 } };
    this.glow = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.glowUniforms, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.glow.name = 'wood-owl-eyes';
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 2;
  }

  update(dt: number, owl: Owl, visible: boolean): void {
    this.time += dt;
    const shown = visible && owl.phase !== 'gone';
    this.mesh.visible = shown;
    this.wings.visible = shown && owl.fold < 0.97;
    this.glow.visible = shown && owl.eyeshine > 0.01;
    if (!shown) {
      setOwlShadow(null, null, 0, 0);
      return;
    }
    const u = this.uniforms;
    (u.uOwl.value as THREE.Vector4).set(owl.position.x, owl.position.y, owl.position.z, owl.yaw);
    (u.uOwlHead.value as THREE.Vector4).set(owl.head.x, owl.head.y, owl.head.z, owl.fluff);
    (u.uOwlWing.value as THREE.Vector4).set(owl.fold, owl.flap, owl.pitch, owl.moonlit);
    (u.uOwlBody.value as THREE.Vector4).set(owl.roll, owl.size, 0, 0);
    (u.uOwlEyes.value as THREE.Vector4).set(owl.eyeshine, owl.shown, owl.blink, owl.presence);
    (u.uOwlHand.value as THREE.Vector4).set(owl.hand.x, owl.hand.y, owl.hand.z, 0);
    u.uOwlTime.value = this.time;
    owl.toWorld(this.local.set(-EYE_AT.x, EYE_AT.y, EYE_AT.z + 0.01), true, this.left);
    owl.toWorld(this.local.set(EYE_AT.x, EYE_AT.y, EYE_AT.z + 0.01), true, this.right);
    this.glowUniforms.uEyeL.value.copy(this.left);
    this.glowUniforms.uEyeR.value.copy(this.right);
    this.glowUniforms.uGlow.value = owl.eyeshine * owl.presence;
    this.glowUniforms.uBlink.value = owl.blink;
    owl.toWorld(this.local.set(0, 0.16, 0), false, this.body);
    owl.toWorld(this.local.set(0, 0.33, 0.01), true, this.headAt);
    const seen = owl.presence > 0.5;
    const spread = 1 - owl.fold;
    for (const [i, side] of [[0, -1], [2, 1]] as const) {
      owl.toWorld(this.local.set(SHOULDER.x * side, SHOULDER.y, SHOULDER.z), false, this.wingBones[i]);
      owl.toWorld(wingTip(owl, side, this.local), false, this.wingBones[i + 1]);
    }
    for (const [i, side] of [[0, -1], [1, 1]] as const) owl.toWorld(this.local.set(TUFT.x * side * 1.2, TUFT.y + 0.07, TUFT.z), true, this.tufts[i]);
    const r = SCALE * owl.size;
    setOwlShadow(seen ? this.body : null, seen ? this.headAt : null, 0.14 * r, 0.12 * r, seen ? this.tufts : undefined, 0.03 * r,
      seen && spread > 0.2 ? this.wingBones : undefined, 0.05 * r);
  }
}

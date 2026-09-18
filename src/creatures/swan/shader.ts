import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';
import { SWELL_GLSL, swellUniforms } from '../../world/water/swell';
import { CREATURE_GLSL } from '../shading';
import { BILL, EYE, FEET, FOOT, HEAD, NECK, NECK_AT, NECK_LEN, PLUME, SHOULDER, SPAN, TAIL, TAIL_AT, VANE, WING_L, WING_R } from './body';

const n = (v: number) => v.toFixed(4);
/** How far behind the shoulder the wingtip runs in the beat: the lag is the whole of the wing's flex. */
const LAG = 0.15;
const STEPS = 8;

/** The same clock as `stroke` in the shader below, for the body's rise and fall on the beat. */
export function stroke(q: number): number {
  const p = q - Math.floor(q);
  const u = p < 0.4 ? (0.5 * p) / 0.4 : 0.5 + (0.5 * (p - 0.4)) / 0.6;
  return Math.cos(u * Math.PI * 2);
}

const SWAN_GLSL = /* glsl */ `
mat3 mRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 mRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 mRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

/**
 * The stroke clock. The downstroke takes four tenths of the beat and the recovery the rest, so the wing falls
 * heavily and comes back up unhurried. +1 is the top of the upstroke, -1 the bottom of the downstroke.
 */
float stroke(float q) {
  q = fract(q);
  float d = 0.4;
  float u = q < d ? 0.5 * q / d : 0.5 + 0.5 * (q - d) / (1.0 - d);
  return cos(u * 6.2831853);
}`;

export const SWAN_VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
${SWAN_GLSL}
in float aPart;
in vec2 aMat;
in float aSpan;
/** Where the bird is and which way it points. */
in vec4 iPos;
/** Pitch, roll, the beat's place in its cycle, and how much of a beat there is at all. */
in vec4 iAir;
/** The neck's pitch at its root, middle and head, and how far it leans sideways. */
in vec4 iNeck;
/** Wings folded, head turn, head pitch, feet stowed. */
in vec4 iBody;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out float vUnder;

/** The wing's own slope and sweep at a fraction u along the span: one beat travelling outward, plus the fold. */
vec2 wingBend(float u) {
  float beat = stroke(iAir.z - ${n(LAG)} * u);
  float slope = 0.07 + 0.03 * u + iAir.w * (0.34 + 0.66 * u) * beat + iBody.x * (0.2 - 0.25 * u);
  float sweep = iAir.w * (0.03 + 0.34 * u * u) * (beat * 0.5 + 0.5) + iBody.x * (0.8 + 1.1 * smoothstep(0.0, 0.28, u));
  return vec2(slope, sweep);
}

/** The outer wing pitches nose-down into the downstroke and back on the recovery; folded, it stands on edge at the flank. */
float wingTwist(float u) {
  float q = iAir.z - ${n(LAG)} * u;
  float rising = stroke(q + 0.045) - stroke(q - 0.045);
  return -iAir.w * 0.5 * u * u * rising + iBody.x * 1.57;
}

/** The neck's pitch and lean at a fraction t along it: a quadratic through the three angles it is given. */
vec2 neckBend(float t) {
  return vec2(mix(mix(iNeck.x, iNeck.y, t), mix(iNeck.y, iNeck.z, t), t), iNeck.w * t);
}

/** Walks the neck from the breast out to t, returning the point it reaches and the frame it is facing there. */
vec3 neckAt(float t, out mat3 frame) {
  vec3 p = vec3(${n(NECK_AT[0])}, ${n(NECK_AT[1])}, ${n(NECK_AT[2])});
  float ds = t / float(${STEPS});
  for (int i = 0; i < ${STEPS}; i++) {
    vec2 b = neckBend((float(i) + 0.5) * ds);
    p += (mRotY(b.y) * mRotX(-b.x) * vec3(0.0, 0.0, 1.0)) * (ds * ${n(NECK_LEN)});
  }
  vec2 b = neckBend(t);
  frame = mRotY(b.y) * mRotX(-b.x);
  return p;
}

void main() {
  int part = int(aPart + 0.5);
  vec3 p = position;
  vec3 nrm = normal;
  if (part == ${WING_L} || part == ${WING_R}) {
    float side = part == ${WING_L} ? 1.0 : -1.0;
    float s = aSpan;
    float len = ${n(SPAN)} * (1.0 - 0.69 * iBody.x);
    /** Folded, the wing sits out on the flank and a little further aft than the shoulder it flies from. */
    vec3 root = vec3((${n(SHOULDER[0])} + 0.045 * iBody.x) * side, ${n(SHOULDER[1])}, ${n(SHOULDER[2])} - 0.02 * iBody.x);
    float ds = s / float(${STEPS});
    for (int i = 0; i < ${STEPS}; i++) {
      vec2 b = wingBend((float(i) + 0.5) * ds);
      root += (mRotY(side * b.y) * mRotZ(side * b.x) * vec3(side, 0.0, 0.0)) * (ds * len);
    }
    vec2 b = wingBend(s);
    /** Folded feathers overlap, so the wing loses chord as well as span or it cannot lie against the body. */
    float furl = 1.0 - iBody.x * (0.85 - 0.18 * smoothstep(0.0, 0.35, s));
    vec3 sec = vec3(0.0, p.y - ${n(SHOULDER[1])}, (p.z - ${n(SHOULDER[2])}) * furl - 0.02 * iBody.x);
    mat3 frame = mRotY(side * b.y) * mRotZ(side * b.x) * mRotX(wingTwist(s));
    p = root + frame * sec;
    nrm = frame * nrm;
  } else if (part == ${NECK}) {
    mat3 frame;
    vec3 root = neckAt(aSpan, frame);
    p = root + frame * vec3(p.x, p.y - ${n(NECK_AT[1])}, 0.0);
    nrm = frame * nrm;
  } else if (part == ${HEAD}) {
    mat3 frame;
    vec3 root = neckAt(1.0, frame);
    mat3 look = frame * mRotY(iBody.y) * mRotX(iBody.z);
    p = root + look * (p - vec3(${n(NECK_AT[0])}, ${n(NECK_AT[1])}, ${n(NECK_AT[2] + NECK_LEN)}));
    nrm = look * nrm;
  } else if (part == ${TAIL}) {
    vec3 hinge = vec3(${n(TAIL_AT[0])}, ${n(TAIL_AT[1])}, ${n(TAIL_AT[2])});
    mat3 cock = mRotX(iBody.x * 0.5);
    p = hinge + cock * (p - hinge);
    nrm = cock * nrm;
  } else if (part == ${FEET}) {
    p.y -= iBody.w * 0.45;
  }
  p = rotZ(rotX(p, iAir.x), iAir.y);
  nrm = rotZ(rotX(nrm, iAir.x), iAir.y);
  vWorld = rotY(p, iPos.w) + iPos.xyz;
  vNormal = rotY(nrm, iPos.w);
  vMat = aMat;
  vUnder = smoothstep(0.05, -0.6, vNormal.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

export const SWAN_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in float vUnder;

/** Linear and warm: white on a bird is never the white of the page, or it tears a hole in a painted sky. */
const vec3 PLUME = vec3(0.72, 0.702, 0.66);
/** What white turns when it is only lit by the sky: a swan seen from below must not be the sky's own colour. */
const vec3 SHADED = vec3(0.63, 0.66, 0.76);
const vec3 SLATE = vec3(0.045, 0.043, 0.05);
const vec3 HORN = vec3(0.3, 0.22, 0.075);
const vec3 WEB = vec3(0.032, 0.03, 0.033);
const vec3 IRIS = vec3(0.005, 0.005, 0.006);

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  int mat = int(vMat.x + 0.5);
  float k = vMat.y;
  vec3 alb = PLUME;
  float fuzz = 0.5;
  float thin = 0.3;
  float ao = 1.0 - vUnder * 0.44 - k * 0.12;
  if (mat == ${VANE}) {
    /** The flight feathers are a single layer of quills: the low sun comes through them and lights the far wing. */
    alb = PLUME * (1.0 - k * 0.06);
    /** The hand of the wing is thinner and stands away from the light, so the outer half falls off into shadow. */
    alb *= 1.0 - smoothstep(0.55, 1.0, k) * 0.12;
    thin = 0.34 + 0.5 * k;
    fuzz = 0.42;
    ao = 1.0 - vUnder * 0.42;
  } else if (mat == ${BILL}) {
    alb = mix(SLATE, HORN, k * 0.55);
    fuzz = 0.05;
    thin = 0.18;
    ao = 1.0;
  } else if (mat == ${FOOT}) {
    alb = WEB;
    fuzz = 0.06;
    thin = 0.35;
    ao = 1.0;
  } else if (mat == ${EYE}) {
    alb = IRIS;
    fuzz = 0.0;
    thin = 0.0;
    ao = 1.0;
  }
  /** White stays white in the sun and goes cool and heavy underneath, which is the only way it reads on a pale sky. */
  if (mat == ${VANE} || mat == ${PLUME}) alb = mix(alb, alb * SHADED, vUnder);
  vec3 col = shadeCreature(alb, N, vWorld, ao, fuzz, thin, 1.0);
  if (mat == ${EYE}) col += uSunColor * 0.8 * catchlight(N, vWorld);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const WAKE_VERT = /* glsl */ `
${ATMO_GLSL}
${SWELL_GLSL}
in vec4 iWake;
in vec4 iWash;
out vec2 vUv;
out vec3 vWorld;
out float vFade;
out float vKind;
void main() {
  float c = cos(iWash.x), s = sin(iWash.x);
  vec3 local = vec3(position.x * iWake.w, 0.0, position.z * iWake.z);
  vec2 still = vec2(iWake.x + c * local.x + s * local.z, iWake.y - s * local.x + c * local.z);
  /** A wake is on the water, not on the plane the water would lie in: it rides the swell like everything else. */
  vec3 ride = swellShift(still, swellHeight(still, distance(cameraPosition.xz, still)));
  vWorld = vec3(still.x + ride.x, 0.04 + ride.y, still.y + ride.z);
  vUv = position.xz;
  vFade = iWash.y;
  vKind = iWash.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const WAKE_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in vec3 vWorld;
in float vFade;
in float vKind;
void main() {
  float r = length(vUv);
  /** A swan sitting still lays a soft bright patch on the water; a foot slapping it throws up a puff of white. */
  float a = mix(smoothstep(1.0, 0.1, r), smoothstep(1.0, 0.2, r) * (0.55 + 0.45 * smoothstep(0.2, 0.62, r)), vKind);
  a *= vFade;
  if (a < 0.004) discard;
  vec3 foam = uSkyAmbient * 1.1 + uSunColor * 0.42;
  gl_FragColor = vec4(applyFog(foam, vWorld), min(a, 1.0));
}`;

export function swanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms: atmo.uniforms, vertexShader: SWAN_VERT, fragmentShader: SWAN_FRAG });
}

export function wakeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, ...swellUniforms },
    vertexShader: WAKE_VERT,
    fragmentShader: WAKE_FRAG,
    transparent: true,
    depthWrite: false,
  });
}

/** One flat quad lying on the sea, scaled and turned per instance. */
export function wakeQuad(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  return geo;
}

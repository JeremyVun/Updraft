import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { SHAPE_SHADOW_GLSL, SHAPE_STUMP_CAPS, setOwlShadow, setShadowEyes, shapeUniforms } from '../world/wood-shape';
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
const EYE_AT = new THREE.Vector3(0.05, 0.338, 0.128);
const EYE_SIZE = new THREE.Vector3(0.039, 0.039, 0.022);
/** Larger than life, as the game's creatures are, so it reads from where the camera stands. */
const SCALE = 2.1;
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
out float vPart;

const vec3 NECK = vec3(0.0, ${NECK.y}, 0.0);
const vec3 CENTRE = vec3(0.0, ${CENTRE.y}, 0.0);

void main() {
  int part = int(aPart + 0.5);
  vec3 p = position;
  vec3 n = normal;
  vLocal = p;
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
  vec3 world = rotY(p * ${SCALE.toFixed(2)}, uOwl.w) + uOwl.xyz;
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
uniform vec4 uOwlWing;
uniform vec4 uOwlEyes;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vEye;
in vec3 vLocal;
in float vPart;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  int mat = int(vMat.x + 0.5);
  float t = vMat.y;
  float speck = vnoise(vLocal.xy * vec2(70.0, 52.0) + vLocal.z * 30.0);
  float streak = vnoise(vec2(vLocal.x * 48.0, vLocal.y * 16.0));
  vec3 back = mix(vec3(0.24, 0.15, 0.09), vec3(0.36, 0.24, 0.14), speck);
  // Pale spots across the back and the crown, the way a little owl is freckled.
  back = mix(back, vec3(0.7, 0.6, 0.44), smoothstep(0.8, 0.88, speck) * 0.8);
  vec3 breast = mix(vec3(0.62, 0.52, 0.37), vec3(0.32, 0.21, 0.12), smoothstep(0.55, 0.75, streak) * 0.8);
  vec3 alb = mix(back, breast, t);
  float fuzz = 1.0;
  float glow = 0.0;
  if (mat == ${DISC}) {
    // A pale ring round each eye with a soft dark rim, and white brows meeting over the beak.
    alb = mix(vec3(0.74, 0.66, 0.5), vec3(0.3, 0.2, 0.12), smoothstep(0.7, 0.98, t));
    alb = mix(alb, vec3(0.86, 0.82, 0.72), smoothstep(0.25, 0.0, abs(vLocal.y - 0.37 - abs(vLocal.x) * 0.25) * 12.0) * step(0.5, t) * 0.0 + smoothstep(0.5, 0.75, t) * smoothstep(0.0, 0.3, vLocal.y - 0.335) * 0.6);
  } else if (mat == ${HORN}) {
    alb = vec3(0.72, 0.66, 0.42); fuzz = 0.15;
  } else if (mat == ${WING}) {
    alb = mix(back, vec3(0.2, 0.13, 0.08), smoothstep(0.6, 0.95, t) * 0.6);
    alb = mix(alb, vec3(0.8, 0.72, 0.55), step(0.5, fract(vLocal.x * 26.0 + vLocal.z * 8.0)) * smoothstep(0.35, 0.6, t) * 0.35);
  } else if (mat == ${DOWN}) {
    alb = vec3(0.78, 0.72, 0.6);
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
  vec3 col = alb * (hemiLight(N) * 0.8 + moon * (wrap * wrap * 0.9 + 0.15));
  col += moon * edge * fuzz * 0.35 * (0.3 + 0.7 * alb);
  // Until the side coal's light is on it, it is a dark lump in the fork with eyes.
  vec3 warm = emberLight(vWorld, N) * mix(0.06, 1.6, uOwlEyes.y);
  // Sat down in the fork it would be in the dead limbs' shade; let the light that shows it reach it.
  float shade = mix(1.0, shapeShadowCaps(vWorld + N * 0.03, ${SHAPE_STUMP_CAPS}), 0.3);
  col += (alb + 0.012) * warm * shade;
  col += warm * shade * edge * fuzz * 0.6 * (0.3 + 0.7 * alb);
  if (mat == ${EYE}) {
    col += vec3(1.0, 0.95, 0.85) * catchlight(N, vWorld) * (0.25 + 0.6 * length(warm * shade)) * glow;
    // Eyeshine: the light thrown back out of the eyes, which is all a frightened child sees of them in the dark.
    col += vec3(1.0, 0.72, 0.22) * uOwlEyes.x * glow * 3.2;
  }
  // Up out of the firelight, the moon through the canopy finds the edges of its down, so it never goes out.
  if (uOwlWing.w > 0.0) {
    vec3 cold = vec3(0.62, 0.74, 1.0) * uNight * uOwlWing.w;
    col += alb * cold * (wrap * 0.25 + 0.08) + cold * edge * fuzz * 0.3 * (0.3 + 0.7 * alb);
  }
  col *= uOwlEyes.w;
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

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
  view.xyz += normalize(-view.xyz) * 0.12;
  gl_Position = projectionMatrix * view;
}`;

const GLOW_FRAG = /* glsl */ `
uniform float uGlow;
in vec2 vUv;
void main() {
  float r = length(vUv);
  float a = exp(-r * r * 9.0) * 0.9 + exp(-r * r * 2.5) * 0.25;
  a *= 1.0 - smoothstep(0.8, 1.0, r);
  gl_FragColor = vec4(vec3(1.0, 0.7, 0.24) * a * uGlow, 1.0);
}`;

function owlGeometry(): THREE.BufferGeometry {
  const disc: BlobSpec = {
    part: FACE, mat: DISC, at: [-0.05, 0.332, 0.108], size: [0.066, 0.072, 0.03], rot: [0, -0.3, 0], detail: 3,
    blend: (u) => Math.hypot(u.x, u.y),
  };
  const eye: BlobSpec = { part: EYE_L, mat: EYE, at: [-EYE_AT.x, EYE_AT.y, EYE_AT.z], size: [EYE_SIZE.x, EYE_SIZE.y, EYE_SIZE.z], detail: 3 };
  const wing: BlobSpec = {
    part: WING_L, mat: WING, at: [-SHOULDER.x, SHOULDER.y, SHOULDER.z], offset: [-0.13, 0, -0.02], size: [0.14, 0.016, 0.085],
    detail: 2,
    shape: (u) => {
      const s = Math.max(-u.x, 0);
      u.z = u.z * (1 - 0.3 * s) - 0.35 * s * s;
    },
    blend: (u) => -u.x * 0.5 + 0.5,
  };
  const foot: BlobSpec = { part: FEET, mat: DOWN, at: [-0.04, 0.012, 0.05], size: [0.028, 0.016, 0.034], detail: 1 };
  const parts: BlobSpec[] = [
    {
      part: BODY, mat: PLUMAGE, at: [0, 0.16, 0], size: [0.13, 0.15, 0.12], detail: 3,
      shape: (u) => { const k = 1 + 0.12 * Math.max(0, -u.y); u.x *= k; u.z *= k; },
      blend: (u) => THREE.MathUtils.smoothstep(u.z * 0.9 - u.y * 0.3, 0.05, 0.55),
    },
    {
      part: HEAD, mat: PLUMAGE, at: [0, 0.335, 0.01], size: [0.138, 0.118, 0.12], detail: 3,
      shape: (u) => { u.y *= 1 - 0.12 * Math.max(0, u.y) * Math.abs(u.x); },
      blend: () => 0,
    },
    disc, mirrored(disc, FACE),
    eye, mirrored(eye, EYE_R),
    {
      part: BEAK, mat: HORN, at: [0, 0.312, 0.138], size: [0.014, 0.024, 0.018], rot: [0.5, 0, 0], detail: 1,
      shape: (u) => { const k = 1 - 0.6 * Math.max(-u.y, 0); u.x *= k; u.z *= k; },
    },
    wing, mirrored(wing, WING_R),
    foot, mirrored(foot, FEET),
    { part: TAIL, mat: WING, at: [0, 0.06, -0.1], size: [0.05, 0.02, 0.07], rot: [0.5, 0, 0], detail: 1, blend: () => 0.8 },
  ];
  return merge(parts.map(blob));
}

const rotX = (p: THREE.Vector3, a: number) => p.set(p.x, Math.cos(a) * p.y - Math.sin(a) * p.z, Math.sin(a) * p.y + Math.cos(a) * p.z);
const rotY = (p: THREE.Vector3, a: number) => p.set(Math.cos(a) * p.x + Math.sin(a) * p.z, p.y, -Math.sin(a) * p.x + Math.cos(a) * p.z);
const rotZ = (p: THREE.Vector3, a: number) => p.set(Math.cos(a) * p.x - Math.sin(a) * p.y, Math.sin(a) * p.x + Math.cos(a) * p.y, p.z);

type Phase = 'perched' | 'awake' | 'leaving' | 'gone';

/** One little hop round on the perch before it goes: when it starts, after `leave`, and how much of the turn it makes. */
const SHUFFLES = [[0.35, 0.55], [0.8, 0.45]];
/** The leap off the fork, after `leave`. */
const LAUNCH = 1.45;
/** Seconds of flight per burst of wingbeats, and how much of each is beating rather than gliding. */
const BURST = 1.5;
const BEATING = 0.6;
const BEAT_RATE = 2.6;
/** Seconds from the leap to the end of its way, and the look back at her, seconds into the flight. */
const FLIGHT = 7.5;
const GLANCE = [2.4, 3.1];

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
    this.moonlit = 0; this.shown = 0; this.beat = 0;
    this.head.set(0, 0, 0);
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
      // It looks the way it means to go first, then hops round after its head, twice, and crouches to spring.
      const look = turn - (this.yaw - this.sitYaw);
      this.head.x += (THREE.MathUtils.clamp(look, -1.4, 1.4) - this.head.x) * (1 - Math.exp(-dt * 5));
      this.head.y += (-0.25 * smooth(t, 0.1, 0.35) * (1 - smooth(t, 0.9, 1.2)) - this.head.y) * (1 - Math.exp(-dt * 8));
      let hop = 0, turned = 0;
      for (const [at, share] of SHUFFLES) {
        const k = smooth(t, at, at + 0.2);
        turned += share * k;
        hop = Math.max(hop, Math.sin(Math.PI * k));
      }
      this.yaw = this.sitYaw + turn * turned;
      const crouch = smooth(t, 1.0, LAUNCH - 0.05);
      this.pitch = 0.45 * crouch;
      this.fold = 1 - 0.6 * smooth(t, 1.15, LAUNCH);
      this.flap = 0.7 * smooth(t, 1.15, LAUNCH);
      this.position.copy(this.perch);
      this.position.y += 0.06 * hop - 0.08 * crouch;
      this.moonlit = 0;
      return;
    }
    const s = t - LAUNCH;
    // Wings wide on the first stroke; then bursts of soft beats with a glide between, wings held a little up.
    const beating = (s % BURST) / BURST < BEATING || s < BURST * BEATING ? 1 : 0;
    this.flapBlend += (beating - this.flapBlend) * (1 - Math.exp(-dt * 7));
    this.beat += dt * BEAT_RATE * Math.PI * 2 * (0.3 + 0.7 * this.flapBlend);
    // Down quickly, up slowly.
    const stroke = Math.cos(this.beat + 0.4 * Math.sin(this.beat));
    this.flap = THREE.MathUtils.lerp(0.16, 0.12 + 0.75 * stroke, this.flapBlend);
    this.fold = Math.max(0, this.fold - dt * 5);
    // Unhurried off the fork, gathering way, easing as it goes up out of sight.
    const k = THREE.MathUtils.clamp(s / FLIGHT, 0, 1);
    const u = THREE.MathUtils.clamp(0.55 * k * k + 0.45 * k + 0.04 * Math.sin(Math.PI * k), 0, 1);
    this.way.getPointAt(u, this.position);
    // Each downstroke lifts it a little and it sinks in the glide.
    this.position.y += 0.07 * stroke * this.flapBlend - 0.05 * (1 - this.flapBlend);
    this.way.getTangentAt(Math.min(0.999, u + 0.01), this.along);
    const before = this.yaw;
    const heading = Math.atan2(this.along.x, this.along.z);
    this.yaw += Math.atan2(Math.sin(heading - this.yaw), Math.cos(heading - this.yaw)) * (1 - Math.exp(-dt * 3));
    const swing = Math.atan2(Math.sin(this.yaw - before), Math.cos(this.yaw - before)) / Math.max(dt, 1e-4);
    this.roll += (THREE.MathUtils.clamp(-swing * 0.5, -0.45, 0.45) - this.roll) * (1 - Math.exp(-dt * 4));
    // Its body levels out along the way it climbs; a steep climb keeps it more upright.
    const climb = Math.atan2(this.along.y, Math.hypot(this.along.x, this.along.z));
    this.pitch += (0.85 - 0.6 * climb - this.pitch) * (1 - Math.exp(-dt * 5));
    // One look back over its shoulder at her, in the first glide.
    const back = smooth(s, GLANCE[0], GLANCE[0] + 0.3) * (1 - smooth(s, GLANCE[1], GLANCE[1] + 0.35));
    this.tmp.copy(this.watch).sub(this.position);
    const toHer = Math.atan2(Math.sin(Math.atan2(this.tmp.x, this.tmp.z) - this.yaw), Math.cos(Math.atan2(this.tmp.x, this.tmp.z) - this.yaw));
    this.head.x += ((this.watching ? THREE.MathUtils.clamp(toHer, -1.7, 1.7) * back : 0) - this.head.x) * (1 - Math.exp(-dt * 6));
    this.moonlit = smooth(s, 0.2, 1.5);
    this.presence = 1 - smooth(s, FLIGHT - 0.6, FLIGHT);
    if (s >= FLIGHT) this.phase = 'gone';
  }

  private flapBlend = 1;

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
    out.add(CENTRE).multiplyScalar(SCALE);
    rotY(out, this.yaw);
    return out.add(this.position);
  }
}

/** The one owl, in the stump at the bend of the dark wood. */
export const woodOwl = new Owl();

/** Draws an `Owl`: its body, the eyeshine that floats over its eyes in the dark, and its share of the stump's shadow. */
export class OwlBody {
  readonly mesh: THREE.Mesh;
  readonly glow: THREE.Mesh;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly glowUniforms: Record<string, THREE.IUniform>;
  private readonly local = new THREE.Vector3();
  private readonly left = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly body = new THREE.Vector3();
  private readonly headAt = new THREE.Vector3();
  private readonly wings: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private time = 0;

  constructor() {
    this.uniforms = {
      ...atmo.uniforms,
      ...shapeUniforms,
      uOwl: { value: new THREE.Vector4() },
      uOwlHead: { value: new THREE.Vector4() },
      uOwlWing: { value: new THREE.Vector4() },
      uOwlBody: { value: new THREE.Vector4() },
      uOwlEyes: { value: new THREE.Vector4() },
      uOwlTime: { value: 0 },
    };
    this.mesh = new THREE.Mesh(owlGeometry(), new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
    }));
    this.mesh.name = 'wood-owl';
    this.mesh.frustumCulled = false;
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
    this.glowUniforms = { uEyeL: { value: new THREE.Vector3() }, uEyeR: { value: new THREE.Vector3() }, uGlow: { value: 0 }, uGlowSize: { value: 0.16 } };
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
    this.glow.visible = shown && owl.eyeshine > 0.01;
    if (!shown) {
      setOwlShadow(null, null, 0, 0);
      setShadowEyes(this.left, this.right, 0, 0);
      return;
    }
    const u = this.uniforms;
    (u.uOwl.value as THREE.Vector4).set(owl.position.x, owl.position.y, owl.position.z, owl.yaw);
    (u.uOwlHead.value as THREE.Vector4).set(owl.head.x, owl.head.y, owl.head.z, owl.fluff);
    (u.uOwlWing.value as THREE.Vector4).set(owl.fold, owl.flap, owl.pitch, owl.moonlit);
    (u.uOwlBody.value as THREE.Vector4).set(owl.roll, 0, 0, 0);
    (u.uOwlEyes.value as THREE.Vector4).set(owl.eyeshine, owl.shown, owl.blink, owl.presence);
    u.uOwlTime.value = this.time;
    owl.toWorld(this.local.set(-EYE_AT.x, EYE_AT.y, EYE_AT.z + 0.01), true, this.left);
    owl.toWorld(this.local.set(EYE_AT.x, EYE_AT.y, EYE_AT.z + 0.01), true, this.right);
    this.glowUniforms.uEyeL.value.copy(this.left);
    this.glowUniforms.uEyeR.value.copy(this.right);
    this.glowUniforms.uGlow.value = owl.eyeshine * owl.presence * (1 - owl.blink);
    owl.toWorld(this.local.set(0, 0.16, 0), false, this.body);
    owl.toWorld(this.local.set(0, 0.33, 0.01), true, this.headAt);
    const seen = owl.presence > 0.5;
    const spread = 1 - owl.fold;
    for (const [i, side] of [[0, -1], [2, 1]] as const) {
      owl.toWorld(this.local.set(SHOULDER.x * side, SHOULDER.y, SHOULDER.z), false, this.wings[i]);
      // The wing as the shader swings it: out and up by the stroke when spread, down the flank when folded.
      const reach = 0.28 * spread + 0.1;
      this.local.set(SHOULDER.x * side + side * Math.cos(owl.flap) * reach * spread, SHOULDER.y + Math.sin(owl.flap) * reach * spread - 0.1 * (1 - spread), SHOULDER.z - 0.04);
      owl.toWorld(this.local, false, this.wings[i + 1]);
    }
    setOwlShadow(seen ? this.body : null, seen ? this.headAt : null, 0.13 * SCALE, 0.115 * SCALE, seen && spread > 0.2 ? this.wings : undefined, 0.05 * SCALE);
    setShadowEyes(this.left, this.right, EYE_SIZE.x * SCALE, owl.eyeshine * owl.presence * (1 - owl.blink));
  }
}

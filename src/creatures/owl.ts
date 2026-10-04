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
const EYE_AT = new THREE.Vector3(0.047, 0.336, 0.104);
const EYE_SIZE = new THREE.Vector3(0.033, 0.033, 0.02);

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform vec4 uOwl;
uniform vec4 uOwlHead;
uniform vec4 uOwlWing;
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
  p = rotX(p, uOwlWing.z);
  n = rotX(n, uOwlWing.z);
  p += CENTRE;
  vec3 world = rotY(p, uOwl.w) + uOwl.xyz;
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
  vec3 back = mix(vec3(0.3, 0.2, 0.12), vec3(0.42, 0.3, 0.18), speck);
  // Pale spots across the back and the crown, the way a little owl is freckled.
  back = mix(back, vec3(0.82, 0.74, 0.58), smoothstep(0.78, 0.86, speck) * 0.85);
  vec3 breast = mix(vec3(0.86, 0.79, 0.64), vec3(0.5, 0.36, 0.22), smoothstep(0.6, 0.8, streak) * 0.7);
  vec3 alb = mix(back, breast, t);
  float fuzz = 1.0;
  float glow = 0.0;
  if (mat == ${DISC}) {
    alb = mix(vec3(0.9, 0.85, 0.72), vec3(0.42, 0.3, 0.2), smoothstep(0.55, 0.95, t));
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
  vec3 warm = emberLight(vWorld, N);
  float shade = shapeShadowCaps(vWorld + N * 0.03, ${SHAPE_STUMP_CAPS});
  col += (alb + 0.04) * warm * shade;
  col += warm * shade * edge * fuzz * 0.6 * (0.3 + 0.7 * alb);
  if (mat == ${EYE}) {
    col += vec3(1.0, 0.95, 0.85) * catchlight(N, vWorld) * (0.25 + 0.6 * length(warm * shade)) * glow;
    // Eyeshine: the light thrown back out of the eyes, which is all a frightened child sees of them in the dark.
    col += vec3(1.0, 0.72, 0.22) * uOwlEyes.x * glow * 3.2;
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
  vec3 c = aSide < 0.0 ? uEyeL : uEyeR;
  vUv = position.xy;
  vec4 view = viewMatrix * vec4(c + (right * position.x + up * position.y) * uGlowSize, 1.0);
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
    part: FACE, mat: DISC, at: [-0.046, 0.33, 0.082], size: [0.062, 0.07, 0.03], rot: [0, -0.32, 0], detail: 3,
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
      part: BODY, mat: PLUMAGE, at: [0, 0.165, 0], size: [0.135, 0.16, 0.125], detail: 3,
      shape: (u) => { const k = 1 + 0.12 * Math.max(0, -u.y); u.x *= k; u.z *= k; },
      blend: (u) => THREE.MathUtils.smoothstep(u.z * 0.9 - u.y * 0.3, 0.05, 0.55),
    },
    {
      part: HEAD, mat: PLUMAGE, at: [0, 0.33, 0.01], size: [0.128, 0.112, 0.118], detail: 3,
      shape: (u) => { u.y *= 1 - 0.12 * Math.max(0, u.y) * Math.abs(u.x); },
      blend: () => 0,
    },
    disc, mirrored(disc, FACE),
    eye, mirrored(eye, EYE_R),
    {
      part: BEAK, mat: HORN, at: [0, 0.31, 0.112], size: [0.015, 0.026, 0.02], rot: [0.5, 0, 0], detail: 1,
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

/**
 * The owl in the fork: what it is doing, kept apart from how it is drawn so the story can drive it without a
 * renderer. Sitting unseen it is perfectly still; shown for what it is, it blinks, tilts its head at her, fluffs
 * itself up, hoots once and glides off ahead into the wood.
 */
export class Owl {
  readonly position = new THREE.Vector3();
  yaw = 0;
  /** Head turn, nod and tilt, radians. */
  readonly head = new THREE.Vector3();
  /** 0 spread, 1 folded; the wingbeat; the body's pitch forward. */
  fold = 1;
  flap = 0;
  pitch = 0;
  fluff = 0;
  blink = 0;
  /** How much light its eyes throw back, set by the story from where the light is. */
  eyeshine = 0.6;
  /** 1 seen, falling to 0 as it goes off into the dark. */
  presence = 1;
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

  sit(at: THREE.Vector3, yaw: number): void {
    this.perch.copy(at);
    this.position.copy(at);
    this.yaw = yaw;
    this.phase = 'perched';
    this.fold = 1; this.flap = 0; this.pitch = 0; this.fluff = 0; this.blink = 0; this.presence = 1;
    this.head.set(0, 0, 0);
    this.hooted = false;
    this.t = 0;
  }

  /** Light from the side: it is only an owl after all. */
  wake(): void {
    if (this.phase !== 'perched') return;
    this.phase = 'awake';
    this.t = 0;
    this.nextBlink = 0.5;
  }

  /** Off ahead into the wood, the way she is going. */
  leave(toward: THREE.Vector3): void {
    if (this.phase === 'leaving' || this.phase === 'gone') return;
    this.away.copy(toward).sub(this.perch).setY(0).normalize();
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
      // Stock still, as an owl is when it has been seen and hopes it has not.
      this.blink = 0;
      this.turnHead(dt, 0.6);
      return;
    }
    if (this.phase === 'awake') {
      this.turnHead(dt, 3);
      // A slow tilt one way and the other: curious, not afraid.
      this.head.z = 0.32 * Math.sin(Math.max(0, t - 0.6) * 1.6) * THREE.MathUtils.smoothstep(t, 0.6, 1.4) * (1 - THREE.MathUtils.smoothstep(t, 3.2, 3.8));
      if (t > this.nextBlink && this.blinkAt < 0) this.blinkAt = t;
      if (this.blinkAt >= 0) {
        const b = (t - this.blinkAt) / 0.42;
        this.blink = b < 0.4 ? b / 0.4 : Math.max(0, 1 - (b - 0.4) / 0.6);
        if (b >= 1) { this.blinkAt = -1; this.blink = 0; this.nextBlink = t + 1.1 + (t < 2 ? 0 : 0.8); }
      }
      // It fluffs itself up and shakes out, then settles again.
      this.fluff = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 3.6) / 1.1, 0, 1)) * 0.95;
      if (t >= 5.0 && t - dt < 5.0) this.hooted = true;
      // The soft hoot lifts its head and puffs its throat.
      this.head.y = -0.18 * Math.sin(Math.PI * THREE.MathUtils.clamp((t - 5.0) / 0.9, 0, 1));
      return;
    }
    if (this.phase === 'leaving') {
      this.blink = 0;
      this.fluff = Math.max(0, this.fluff - dt * 2);
      this.head.z *= Math.exp(-dt * 6);
      this.head.x *= Math.exp(-dt * 4);
      const travel = Math.atan2(this.away.x, this.away.z);
      this.yaw += Math.atan2(Math.sin(travel - this.yaw), Math.cos(travel - this.yaw)) * (1 - Math.exp(-dt * 5));
      // A crouch, a drop off the fork with three slow beats, then a long silent glide away into the dark.
      const crouch = THREE.MathUtils.smoothstep(t, 0, 0.35) * (1 - THREE.MathUtils.smoothstep(t, 0.45, 0.6));
      this.pitch = 0.35 * crouch + 0.5 * THREE.MathUtils.smoothstep(t, 0.45, 0.9) - 0.2 * THREE.MathUtils.smoothstep(t, 1.6, 2.6);
      this.fold = 1 - THREE.MathUtils.smoothstep(t, 0.35, 0.7);
      const beating = 1 - THREE.MathUtils.smoothstep(t, 1.8, 2.3);
      this.flap = Math.sin(Math.max(0, t - 0.5) * 9) * 0.75 * beating * (1 - this.fold) + 0.08 * (1 - beating);
      const s = Math.max(0, t - 0.45);
      const along = s * 2.2 + s * s * 0.55;
      const rise = -0.25 * Math.sin(Math.min(1, s / 0.8) * Math.PI * 0.5) + 0.35 * THREE.MathUtils.smoothstep(s, 0.8, 4);
      this.tmp.set(-this.away.z, 0, this.away.x);
      this.position.copy(this.perch).addScaledVector(this.away, along)
        .addScaledVector(this.tmp, 0.06 * along * along * 0.1);
      this.position.y = this.perch.y + rise + 0.05 * crouch;
      this.presence = 1 - THREE.MathUtils.smoothstep(t, 3.4, 5.2);
      if (t > 5.4) this.phase = 'gone';
    }
  }

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
    rotX(out, this.pitch);
    out.add(CENTRE);
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
  private time = 0;

  constructor() {
    this.uniforms = {
      ...atmo.uniforms,
      ...shapeUniforms,
      uOwl: { value: new THREE.Vector4() },
      uOwlHead: { value: new THREE.Vector4() },
      uOwlWing: { value: new THREE.Vector4() },
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
    this.glowUniforms = { uEyeL: { value: new THREE.Vector3() }, uEyeR: { value: new THREE.Vector3() }, uGlow: { value: 0 }, uGlowSize: { value: 0.32 } };
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
    (u.uOwlWing.value as THREE.Vector4).set(owl.fold, owl.flap, owl.pitch, 0);
    (u.uOwlEyes.value as THREE.Vector4).set(owl.eyeshine, 0, owl.blink, owl.presence);
    u.uOwlTime.value = this.time;
    owl.toWorld(this.local.set(-EYE_AT.x, EYE_AT.y, EYE_AT.z + 0.01), true, this.left);
    owl.toWorld(this.local.set(EYE_AT.x, EYE_AT.y, EYE_AT.z + 0.01), true, this.right);
    this.glowUniforms.uEyeL.value.copy(this.left);
    this.glowUniforms.uEyeR.value.copy(this.right);
    this.glowUniforms.uGlow.value = owl.eyeshine * owl.presence * (1 - owl.blink);
    owl.toWorld(this.local.set(0, 0.16, 0), false, this.body);
    owl.toWorld(this.local.set(0, 0.33, 0.01), true, this.headAt);
    setOwlShadow(owl.presence > 0.5 ? this.body : null, owl.presence > 0.5 ? this.headAt : null, 0.13, 0.115);
    setShadowEyes(this.left, this.right, EYE_SIZE.x, owl.eyeshine * owl.presence * (1 - owl.blink));
  }
}

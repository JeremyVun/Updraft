import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { mulberry32, smoothstep } from '../world/noise';
import type { Habitat } from './habitat';
import { ease, range, screenBrush, screenPan, wrapAngle, type Rng } from './motion';
import { CREATURE_GLSL } from './shading';
import { Instances, blob, flipWinding, merge, mirrored, tag, type BlobSpec } from './shapes';
import type { Stimuli } from './stimuli';

const BODY = 0;
const HEAD = 1;
const BEAK = 2;
const EYE = 3;
const TAIL = 4;
const INNER_L = 5;
const INNER_R = 6;
const OUTER_L = 7;
const OUTER_R = 8;

const WHITE = 0;
const BILL = 1;
const EYE_MAT = 2;
const WING = 3;

const SHOULDER = [0.09, 0.05, 0.1] as const;
const here = new THREE.Vector3();
const INNER_SPAN = 0.52;
const OUTER_SPAN = 0.68;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in float aPart;
in vec2 aMat;
in vec4 iPos;
in vec4 iAtt;
in vec4 iWing;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out float vUnder;

void main() {
  int part = int(aPart + 0.5);
  vec3 p = position;
  vec3 n = normal;
  vUnder = smoothstep(0.1, -0.4, normal.y);
  bool outer = part == ${OUTER_L} || part == ${OUTER_R};
  bool inner = part == ${INNER_L} || part == ${INNER_R};
  if (inner || outer) {
    float side = (part == ${INNER_L} || part == ${OUTER_L}) ? 1.0 : -1.0;
    vec3 shoulder = vec3(${SHOULDER[0]} * side, ${SHOULDER[1]}, ${SHOULDER[2]});
    vec3 wrist = shoulder + vec3(${INNER_SPAN} * side, 0.0, -0.02);
    float sweep = iWing.z;
    if (outer) {
      p -= wrist;
      p = rotY(rotZ(p, side * iWing.y), side * sweep * 0.9);
      n = rotY(rotZ(n, side * iWing.y), side * sweep * 0.9);
      p += wrist;
    }
    p -= shoulder;
    p = rotY(rotZ(p, side * iWing.x), side * sweep * 0.35);
    n = rotY(rotZ(n, side * iWing.x), side * sweep * 0.35);
    p += shoulder;
  }
  if (part == ${HEAD} || part == ${BEAK} || part == ${EYE}) {
    vec3 neck = vec3(0.0, 0.06, 0.3);
    p -= neck;
    p = rotY(p, iWing.w);
    n = rotY(n, iWing.w);
    p += neck;
  }
  if (part == ${TAIL}) p.x *= 1.0 + max(-iAtt.x, 0.0) * 1.2;
  p = rotZ(rotX(p, iAtt.x), iAtt.y);
  n = rotZ(rotX(n, iAtt.x), iAtt.y);
  vec3 world = rotY(p, iPos.w) + iPos.xyz;
  vWorld = world;
  vNormal = rotY(n, iPos.w);
  vMat = aMat;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform vec3 uWhite;
uniform vec3 uMantle;
uniform vec3 uTip;
uniform vec3 uBill;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in float vUnder;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  int mat = int(vMat.x + 0.5);
  vec3 alb = uWhite;
  float thin = 0.25;
  float fuzz = 0.7;
  if (mat == ${BILL}) { alb = uBill; thin = 0.0; }
  else if (mat == ${EYE_MAT}) { alb = vec3(0.02); fuzz = 0.0; thin = 0.0; }
  else if (mat == ${WING}) {
    float s = vMat.y;
    alb = mix(uMantle, uWhite * 0.92, vUnder * 0.85);
    alb = mix(alb, uTip, smoothstep(0.72, 0.8, s) * (1.0 - vUnder * 0.35));
    thin = 0.8;
  } else if (mat == ${WHITE} && vMat.y > 0.0) {
    alb = mix(uWhite, uMantle, vMat.y);
  }
  vec3 col = shadeCreature(alb, N, vWorld, 1.0, fuzz, thin, 1.0);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** A tapered wing panel lofted along +x, with its span position (0..1 across the whole wing) in the blend. */
function wingPanel(part: number, span: number, chord: (s: number) => number, lead: (s: number) => number, thick: (s: number) => number, s0: number, s1: number): THREE.BufferGeometry {
  const stations = 9;
  const around = 10;
  const pos: number[] = [];
  const mat: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= stations; i++) {
    const s = i / stations;
    const c = chord(s);
    const le = lead(s);
    const t = thick(s);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const along = 0.5 - 0.5 * Math.cos(a);
      const camber = Math.sin(along * Math.PI) * c * 0.06;
      pos.push(s * span, Math.sin(a) * t * (1 - along * 0.6) + camber, le - c * along);
      mat.push(WING, s0 + (s1 - s0) * s);
    }
  }
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = i * around + ((j + 1) % around);
      idx.push(a, a + around, b, b, a + around, b + around);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(mat, 2));
  geo.setIndex(idx);
  return tag(geo, part);
}

function placed(geo: THREE.BufferGeometry, x: number, y: number, z: number, mirror: boolean): THREE.BufferGeometry {
  if (mirror) flipWinding(geo.scale(-1, 1, 1));
  geo.translate(x, y, z);
  geo.computeVertexNormals();
  return geo;
}

function gullGeometry(): THREE.BufferGeometry {
  const [sx, sy, sz] = SHOULDER;
  const wings: THREE.BufferGeometry[] = [];
  for (const mirror of [false, true]) {
    const side = mirror ? -1 : 1;
    const inner = wingPanel(mirror ? INNER_R : INNER_L, INNER_SPAN, (s) => 0.34 - 0.08 * s, (s) => 0.1 + 0.02 * s, (s) => 0.045 - 0.015 * s, 0, 0.43);
    const outer = wingPanel(
      mirror ? OUTER_R : OUTER_L,
      OUTER_SPAN,
      (s) => 0.26 * (1 - s * s * 0.85),
      (s) => 0.12 - 0.02 * s - 0.2 * s * s,
      (s) => 0.03 * (1 - s * 0.85),
      0.43,
      1,
    );
    wings.push(placed(inner, sx * side, sy, sz, mirror), placed(outer, (sx + INNER_SPAN) * side, sy, sz - 0.02, mirror));
  }
  const eye: BlobSpec = { part: EYE, mat: EYE_MAT, at: [0.062, 0.1, 0.4], size: [0.018, 0.018, 0.018], detail: 1 };
  const blobs = [
    {
      part: BODY,
      mat: WHITE,
      at: [0, 0, 0],
      size: [0.14, 0.13, 0.42],
      shape: (u: THREE.Vector3) => {
        const taper = u.z < 0 ? 1 + 0.45 * u.z : 1 - 0.15 * u.z;
        u.x *= taper;
        u.y *= taper;
      },
      blend: (u: THREE.Vector3) => smoothstep(0.25, 0.65, u.y) * smoothstep(0.5, 0.1, u.z) * 0.8,
    },
    { part: HEAD, mat: WHITE, at: [0, 0.07, 0.37], size: [0.085, 0.085, 0.11] },
    {
      part: BEAK,
      mat: BILL,
      at: [0, 0.05, 0.5],
      size: [0.022, 0.028, 0.075],
      detail: 1,
      shape: (u: THREE.Vector3) => {
        u.y *= 1 - 0.35 * Math.max(u.z, 0);
        if (u.z > 0.6) u.y -= (u.z - 0.6) * 0.3;
      },
    },
    eye,
    mirrored(eye, EYE),
    {
      part: TAIL,
      mat: WHITE,
      at: [0, 0.02, -0.38],
      offset: [0, 0, -0.1],
      size: [0.1, 0.018, 0.14],
      shape: (u: THREE.Vector3) => {
        u.x *= 0.7 - 0.4 * u.z;
      },
    },
  ].map((spec) => blob(spec as BlobSpec));
  return merge([...blobs, ...wings]);
}

interface Gull {
  rand: Rng;
  seed: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  climb: number;
  bank: number;
  pitch: number;
  pushX: number;
  pushZ: number;
  wobble: number;
  orbit: number;
  orbitRadius: number;
  orbitDir: number;
  altitude: number;
  thermal: number;
  flapping: number;
  flapPhase: number;
  flapAmp: number;
  sweep: number;
  headYaw: number;
  nextCry: number;
  nextFlap: number;
  nextLook: number;
  headGoal: number;
}

/** Gulls soar in long lazy arcs, rarely flapping. They come to circle and rise in the player's updraft. */
export class Gulls {
  readonly mesh: THREE.Mesh;
  private readonly instances: Instances;
  private readonly list: Gull[] = [];
  private home = { x: 0, z: 0, radius: 50 };

  constructor(
    private readonly habitat: Habitat,
    capacity = 12,
  ) {
    this.instances = new Instances(gullGeometry(), capacity, ['iPos', 'iAtt', 'iWing']);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...atmo.uniforms,
        uWhite: { value: new THREE.Color('#f6f3ee') },
        uMantle: { value: new THREE.Color('#8d99a6') },
        uTip: { value: new THREE.Color('#1d1d22') },
        uBill: { value: new THREE.Color('#f2c14e') },
      },
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.instances.geometry, material);
    this.mesh.frustumCulled = false;
  }

  get count(): number {
    return this.list.length;
  }

  add(x: number, z: number, radius: number, seed: number): void {
    if (this.list.length >= this.instances.capacity) return;
    this.home = { x, z, radius };
    const rand = mulberry32(seed);
    const orbit = rand() * Math.PI * 2;
    const orbitRadius = range(rand, 0.45, 1) * radius;
    const orbitDir = rand() < 0.5 ? -1 : 1;
    this.list.push({
      rand,
      seed: rand(),
      x: x + Math.cos(orbit) * orbitRadius,
      y: range(rand, 18, 28),
      z: z + Math.sin(orbit) * orbitRadius,
      yaw: orbit + orbitDir * Math.PI * 0.5,
      speed: range(rand, 7, 9),
      climb: 0,
      bank: 0,
      pitch: 0,
      pushX: 0,
      pushZ: 0,
      wobble: 0,
      orbit,
      orbitRadius,
      orbitDir,
      altitude: range(rand, 17, 27),
      thermal: 0,
      flapping: 0,
      flapPhase: rand() * 6,
      flapAmp: 0,
      sweep: 0,
      headYaw: 0,
      nextCry: range(rand, 6, 40),
      nextFlap: range(rand, 3, 14),
      nextLook: range(rand, 1, 4),
      headGoal: 0,
    });
  }

  update(dt: number, time: number, s: Stimuli): void {
    const up = s.updraft;
    const input = s.input;
    this.list.forEach((g, i) => {
      const rand = g.rand;
      const w = s.wind.sample(g.x, g.z, s.sample);
      const toUp = Math.hypot(up.x - g.x, up.z - g.z);
      const drawn = up.strength > 0.08 && toUp < 110 ? Math.min(1, up.strength * 2.5) : 0;
      g.thermal = ease(g.thermal, drawn, drawn > g.thermal ? 2.5 : 0.25, dt);
      const inColumn = g.thermal * (1 - THREE.MathUtils.smoothstep(toUp, 20, 34));

      g.orbit += (g.orbitDir * g.speed * dt) / g.orbitRadius;
      let tx = this.home.x + Math.cos(g.orbit) * g.orbitRadius + Math.sin(time * 0.05 + g.seed * 9) * 12;
      let tz = this.home.z + Math.sin(g.orbit) * g.orbitRadius + Math.cos(time * 0.04 + g.seed * 7) * 12;
      if (g.thermal > 0.05) {
        const ring = 11 + g.seed * 7;
        const a = Math.atan2(g.z - up.z, g.x - up.x) + g.orbitDir * 0.7;
        const cx = up.x + Math.cos(a) * ring;
        const cz = up.z + Math.sin(a) * ring;
        tx += (cx - tx) * g.thermal;
        tz += (cz - tz) * g.thermal;
      }
      const want = Math.atan2(tx - g.x, tz - g.z);
      const turnRate = 0.32 + g.thermal * 0.9;
      const diff = wrapAngle(want - g.yaw);
      const turn = THREE.MathUtils.clamp(diff * 1.2, -turnRate, turnRate);
      g.yaw += turn * dt;

      const brush = input.present && input.gust > 3 ? screenBrush(s.camera, here.set(g.x, g.y, g.z), input.prevNdc, input.ndc, 0.12) : 0;
      const windSpeed = Math.hypot(w.x, w.z);
      const gusty = w.energy + Math.max(0, windSpeed - 6) * 0.06;
      if (brush > 0) {
        const k = 1 - Math.exp(-dt * 8 * brush);
        g.pushX += (input.gustDir.x * input.gust * 0.8 - g.pushX) * k;
        g.pushZ += (input.gustDir.y * input.gust * 0.8 - g.pushZ) * k;
        g.wobble += brush * input.gust * 0.05;
        g.flapping = Math.max(g.flapping, 1.4);
      }
      if (gusty > 0.15) {
        g.pushX += (w.x * 0.6 - g.pushX) * (1 - Math.exp(-dt * gusty * 2));
        g.pushZ += (w.z * 0.6 - g.pushZ) * (1 - Math.exp(-dt * gusty * 2));
        g.wobble += gusty * dt * 3;
      }
      g.pushX *= Math.exp(-dt * 0.6);
      g.pushZ *= Math.exp(-dt * 0.6);
      g.wobble *= Math.exp(-dt * 1.5);

      const ground = Math.max(this.habitat.ground(g.x, g.z), 0);
      const cruise = g.altitude + Math.sin(time * 0.07 + g.seed * 11) * 4;
      const lift = w.lift * 1.2 + inColumn * (1.4 + up.strength * 2.2);
      const target = Math.max(cruise, ground + 12);
      let vy = THREE.MathUtils.clamp((target - g.y) * 0.25, -1.4, 1.2);
      if (lift > 0.1) vy = Math.max(vy, lift);
      if (g.y > 44) vy = Math.min(vy, (44 - g.y) * 0.5);
      if (inColumn > 0.1 && here.set(g.x, g.y, g.z).project(s.camera).y > 0.6) vy = Math.min(vy, 0);
      g.climb = ease(g.climb, vy, 1.5, dt);

      g.nextFlap -= dt;
      if (g.nextFlap <= 0 || (g.climb > 0.6 && lift < 0.1 && g.flapping <= 0)) {
        g.flapping = range(rand, 1.2, 2.4);
        g.nextFlap = range(rand, 9, 22);
      }
      g.flapping -= dt;

      const fx = Math.sin(g.yaw);
      const fz = Math.cos(g.yaw);
      const speed = g.speed * (1 + g.thermal * 0.5 * THREE.MathUtils.smoothstep(toUp, 15, 40));
      g.x += (fx * speed + g.pushX) * dt;
      g.z += (fz * speed + g.pushZ) * dt;
      g.y += g.climb * dt;

      const bankTarget = THREE.MathUtils.clamp(-turn * 1.4, -0.75, 0.75) + Math.sin(time * 5.3 + g.seed * 20) * g.wobble * 0.5;
      g.bank = ease(g.bank, bankTarget, 2.5, dt);
      g.pitch = ease(g.pitch, THREE.MathUtils.clamp(-g.climb * 0.08, -0.25, 0.2), 2, dt);
      const flapping = g.flapping > 0;
      g.flapAmp = ease(g.flapAmp, flapping ? 1 : 0, 3, dt);
      g.flapPhase += dt * Math.PI * 2 * 2.4 * (flapping ? 1 : g.flapAmp);
      g.sweep = ease(g.sweep, Math.min(0.5, gusty * 0.6 + g.wobble * 0.3) + (g.climb < -0.8 ? 0.25 : 0), 4, dt);

      g.nextLook -= dt;
      if (g.nextLook <= 0) {
        g.nextLook = range(rand, 1.5, 5);
        g.headGoal = (rand() - 0.5) * 1.1;
      }
      g.headYaw = ease(g.headYaw, g.headGoal, 4, dt);

      g.nextCry -= dt * (1 + g.thermal * 1.5);
      if (g.nextCry <= 0) {
        g.nextCry = range(rand, 25, 70);
        here.set(g.x, g.y, g.z);
        s.voices.cry(screenPan(s.camera, here), 1 / (1 + here.distanceTo(s.camera.position) / 60));
      }

      const beat = Math.sin(g.flapPhase);
      const glide = 0.12 + Math.sin(time * 1.7 + g.seed * 13) * 0.03 + g.thermal * 0.06;
      const inner = glide + beat * 0.55 * g.flapAmp;
      const outer = -0.2 + Math.sin(g.flapPhase - 0.7) * 0.45 * g.flapAmp + Math.sin(time * 2.3 + g.seed * 5) * 0.04;
      this.instances.set(0, i, g.x, g.y, g.z, g.yaw);
      this.instances.set(1, i, g.pitch, g.bank, 0, 0);
      this.instances.set(2, i, inner, outer, g.sweep, g.headYaw);
    });
    this.instances.commit(this.list.length);
  }

  get state(): { x: number; y: number; z: number; thermal: number }[] {
    return this.list.map((g) => ({ x: g.x, y: g.y, z: g.z, thermal: g.thermal }));
  }
}

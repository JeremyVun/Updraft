import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { mulberry32, smoothstep } from '../world/noise';
import type { Habitat, Perch } from './habitat';
import { Spring, ease, easeAngle, range, screenPan, wrapAngle, type Rng } from './motion';
import { CREATURE_GLSL } from './shading';
import { Instances, blob, merge, mirrored, type BlobSpec } from './shapes';
import type { Stimuli } from './stimuli';

const BODY = 0;
const HEAD = 1;
const BEAK = 2;
const EYE = 3;
const TAIL = 4;
const WING_L = 5;
const WING_R = 6;
const LEGS = 7;

const PLUMAGE = 0;
const FACE = 1;
const HORN = 2;
const EYE_MAT = 3;
const WING = 4;
const TAIL_MAT = 5;

const SIZE = 1.25;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform vec3 uTreeBase;
in float aPart;
in vec2 aMat;
in vec4 iPos;
in vec4 iPose;
in vec4 iWing;
in vec4 iPerch;
in vec4 iBack;
in vec4 iBreast;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out vec3 vBack;
out vec4 vBreast;
out float vRest;
out float vAir;

const vec3 NECK = vec3(0.0, 0.27, 0.08);
const vec3 TAIL_BASE = vec3(0.0, 0.19, -0.13);
const vec3 CENTRE = vec3(0.0, 0.2, 0.0);

void main() {
  int part = int(aPart + 0.5);
  vec3 p = position;
  vec3 n = normal;
  if (part == ${WING_L} || part == ${WING_R}) {
    float side = part == ${WING_L} ? 1.0 : -1.0;
    vec3 pivot = vec3(0.095 * side, 0.26, 0.04);
    float fold = iWing.y;
    float flap = iWing.x * (1.0 - fold);
    p -= pivot;
    p = rotZ(rotY(rotZ(p, side * flap), side * 1.5 * fold), side * 1.45 * fold);
    n = rotZ(rotY(rotZ(n, side * flap), side * 1.5 * fold), side * 1.45 * fold);
    p += pivot;
    vec3 q = (p - CENTRE) / vec3(0.12, 0.125, 0.165);
    float flank = 0.12 * (q.z < 0.0 ? 1.0 + 0.3 * max(q.z, -1.0) : 1.0) * sqrt(max(0.0, 1.0 - q.y * q.y - q.z * q.z));
    vec3 hugged = vec3(side * (flank + 0.012) + (p.x - pivot.x), p.y - 0.012, p.z - 0.012);
    p = mix(p, hugged, fold);
  }
  if (part == ${HEAD} || part == ${BEAK} || part == ${EYE}) {
    p -= NECK;
    p = rotY(rotX(p, iPose.w), iPose.z);
    n = rotY(rotX(n, iPose.w), iPose.z);
    p += NECK;
  }
  if (part == ${TAIL}) {
    p -= TAIL_BASE;
    p = rotX(p, iWing.z);
    n = rotX(n, iWing.z);
    p += TAIL_BASE;
  }
  if (part == ${LEGS}) p.y = mix(p.y, 0.1 + (p.y - 0.05) * 0.2, iPerch.w);
  if (part == ${BODY} || part == ${HEAD}) p = CENTRE + (p - CENTRE) * vec3(iBreast.w, iBreast.w, 1.0);
  p.y *= iWing.w;
  p.xz *= inversesqrt(iWing.w);
  p -= CENTRE;
  p = rotZ(rotX(p, iPose.x), iPose.y);
  n = rotZ(rotX(n, iPose.x), iPose.y);
  p += CENTRE;

  vec3 world = rotY(p * ${SIZE.toFixed(2)}, iPos.w) + iPos.xyz;
  world += treeSway(uTreeBase, iPos.xyz, iPerch.y) * iPerch.x;
  vWorld = world;
  vNormal = rotY(n, iPos.w);
  vMat = aMat;
  vBack = iBack.rgb;
  vBreast = vec4(iBreast.rgb, iBack.w);
  vRest = position.y;
  vAir = iPerch.w;
  gl_Position = projectionMatrix * nudgedView(world, iPerch.z);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform vec3 uHorn;
uniform vec3 uEye;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vBack;
in vec4 vBreast;
in float vRest;
in float vAir;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  int mat = int(vMat.x + 0.5);
  float t = vMat.y;
  vec3 alb = mix(vBack, vBreast.rgb, t);
  float thin = 0.0;
  float fuzz = 0.9;
  if (mat == ${FACE}) alb = mix(vBack * mix(1.0, 0.45, vBreast.a), vBreast.rgb, t);
  else if (mat == ${HORN}) { alb = uHorn; fuzz = 0.2; }
  else if (mat == ${EYE_MAT}) { alb = uEye; fuzz = 0.0; }
  else if (mat == ${WING}) {
    alb = vBack * mix(0.95, 0.4, smoothstep(0.55, 0.85, t));
    alb = mix(alb, vBreast.rgb * 1.1, smoothstep(0.3, 0.36, t) * (1.0 - smoothstep(0.42, 0.48, t)) * 0.7);
    thin = 0.6;
  } else if (mat == ${TAIL_MAT}) {
    alb = vBack * 0.55;
    thin = 0.4;
  }
  float ao = mix(mix(0.6, 1.0, smoothstep(0.05, 0.3, vRest)), 1.0, vAir);
  vec3 col = shadeCreature(alb, N, vWorld, ao, fuzz, thin, vAir);
  if (mat == ${EYE_MAT}) col += uSunColor * catchlight(N, vWorld) * 0.8;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function birdGeometry(): THREE.BufferGeometry {
  const eye: BlobSpec = { part: EYE, mat: EYE_MAT, at: [0.058, 0.33, 0.165], size: [0.02, 0.022, 0.02], detail: 1 };
  const wing: BlobSpec = {
    part: WING_L,
    mat: WING,
    at: [0.095, 0.26, 0.04],
    offset: [0.13, 0, -0.035],
    size: [0.14, 0.014, 0.07],
    shape: (u) => {
      const s = Math.max(u.x, 0);
      u.z = u.z * (1 - 0.4 * s) - 0.45 * s * s;
    },
    blend: (u) => u.x * 0.5 + 0.5,
  };
  const leg: BlobSpec = { part: LEGS, mat: HORN, at: [0.035, 0.05, 0.02], size: [0.011, 0.05, 0.011], detail: 1 };
  return merge(
    [
      {
        part: BODY,
        mat: PLUMAGE,
        at: [0, 0.2, 0],
        size: [0.12, 0.12, 0.165],
        shape: (u: THREE.Vector3) => {
          if (u.z < 0) {
            u.x *= 1 + 0.3 * u.z;
            u.y *= 1 + 0.2 * u.z;
          } else if (u.y < 0.3) {
            u.y *= 1.06;
          }
        },
        blend: (u: THREE.Vector3) => smoothstep(-0.15, 0.45, u.z * 0.55 - u.y * 0.85),
      },
      {
        part: HEAD,
        mat: FACE,
        at: [0, 0.315, 0.11],
        size: [0.093, 0.088, 0.095],
        blend: (u: THREE.Vector3) => smoothstep(-0.05, 0.5, -u.y * 0.9 + u.z * 0.45),
      },
      {
        part: BEAK,
        mat: HORN,
        at: [0, 0.302, 0.198],
        size: [0.028, 0.025, 0.05],
        detail: 1,
        shape: (u: THREE.Vector3) => {
          const k = 1 - 0.65 * Math.max(u.z, 0);
          u.x *= k;
          u.y *= k;
        },
      },
      eye,
      mirrored(eye, EYE),
      {
        part: TAIL,
        mat: TAIL_MAT,
        at: [0, 0.19, -0.13],
        offset: [0, 0, -0.1],
        size: [0.064, 0.024, 0.12],
        rot: [0.3, 0, 0],
        shape: (u: THREE.Vector3) => {
          u.x *= 0.6 - 0.45 * u.z;
          u.y *= 0.7 + 0.3 * u.z;
        },
      },
      wing,
      mirrored(wing, WING_R),
      leg,
      mirrored(leg, LEGS),
    ].map((spec) => blob(spec as BlobSpec)),
  );
}

type Mode = 'ground' | 'perch' | 'flight';

interface Bird {
  flock: Flock;
  rand: Rng;
  seed: number;
  back: THREE.Color;
  breast: THREE.Color;
  cap: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  mode: Mode;
  perch: Perch | null;
  hop: { t: number; fromX: number; fromZ: number; fromY: number; toX: number; toZ: number; toY: number } | null;
  next: number;
  peck: number;
  preen: number;
  delay: number;
  u: number;
  duration: number;
  path: THREE.CubicBezierCurve3 | null;
  destPerch: Perch | null;
  cheepAt: number;
  flapPhase: number;
  burst: number;
  vx: number;
  vy: number;
  vz: number;
  pitch: number;
  roll: number;
  headYaw: number;
  headPitch: number;
  headGoal: number;
  flap: number;
  fold: number;
  tail: Spring;
  squash: Spring;
  puff: number;
  sway: number;
}

interface Flock {
  birds: Bird[];
  rand: Rng;
  home: { x: number; z: number; radius: number };
  mode: Mode;
  timer: number;
  centreX: number;
  centreZ: number;
}

const PLUMAGES: [string, string, number][] = [
  ['#8a5e3c', '#dcc3a0', 0.5],
  ['#7d5a40', '#e4895a', 0.2],
  ['#8a6a3a', '#e9c647', 0.65],
  ['#7a5a48', '#dc9a8a', 0.55],
  ['#96683f', '#d2ab7c', 0.1],
];

const scratch = new THREE.Vector3();

/** Small round finches that forage in the meadow and perch in the tree; a gust sends the whole flock up together. */
export class Songbirds {
  readonly mesh: THREE.Mesh;
  private readonly instances: Instances;
  private readonly flocks: Flock[] = [];
  private readonly birds: Bird[] = [];
  private readonly taken = new Set<Perch>();

  constructor(
    private readonly habitat: Habitat,
    capacity = 24,
  ) {
    this.instances = new Instances(birdGeometry(), capacity, ['iPos', 'iPose', 'iWing', 'iPerch', 'iBack', 'iBreast']);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...atmo.uniforms,
        uTreeBase: { value: habitat.treeBase },
        uHorn: { value: new THREE.Color('#c9925a') },
        uEye: { value: new THREE.Color('#0d0806') },
      },
    });
    this.mesh = new THREE.Mesh(this.instances.geometry, material);
    this.mesh.frustumCulled = false;
  }

  get count(): number {
    return this.birds.length;
  }

  /** Adds a flock of `size` birds foraging around (x, z) and ranging over `radius`. */
  addFlock(x: number, z: number, size: number, radius: number, seed: number): void {
    const rand = mulberry32(seed);
    const flock: Flock = { birds: [], rand, home: { x, z, radius }, mode: 'ground', timer: range(rand, 6, 16), centreX: x, centreZ: z };
    for (let i = 0; i < size && this.birds.length < this.instances.capacity; i++) {
      const [back, breast, cap] = PLUMAGES[Math.floor(rand() * PLUMAGES.length)];
      let bx = x;
      let bz = z;
      for (let tries = 0; tries < 8; tries++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * 1.8;
        bx = x + Math.cos(a) * d;
        bz = z + Math.sin(a) * d;
        if (this.habitat.forage(bx, bz)) break;
      }
      if (!this.habitat.forage(bx, bz)) {
        bx = x;
        bz = z;
      }
      const bird: Bird = {
        flock,
        rand: mulberry32(seed * 31 + i),
        seed: rand(),
        back: new THREE.Color(back),
        breast: new THREE.Color(breast),
        cap,
        x: bx,
        y: this.habitat.ground(bx, bz),
        z: bz,
        yaw: rand() * Math.PI * 2,
        mode: 'ground',
        perch: null,
        hop: null,
        next: range(rand, 0.2, 1.5),
        peck: 0,
        preen: 0,
        delay: 0,
        u: 0,
        duration: 1,
        path: null,
        destPerch: null,
        cheepAt: -1,
        flapPhase: rand() * 6,
        burst: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        pitch: 0,
        roll: 0,
        headYaw: 0,
        headPitch: 0,
        headGoal: 0,
        flap: 0,
        fold: 1,
        tail: new Spring(),
        squash: new Spring(),
        puff: 1,
        sway: 0,
      };
      bird.squash.value = 1;
      flock.birds.push(bird);
      this.birds.push(bird);
    }
    this.flocks.push(flock);
  }

  update(dt: number, time: number, s: Stimuli): void {
    for (const flock of this.flocks) {
      if (flock.mode !== 'flight') {
        const threat = this.threat(flock, s);
        flock.timer -= dt;
        if (threat) this.takeoff(flock, threat);
        else if (flock.timer <= 0) this.takeoff(flock, null);
      }
      for (const b of flock.birds) {
        if (b.mode === 'flight') this.fly(b, dt, s);
        else if (b.mode === 'perch') this.sit(b, dt);
        else this.forage(b, dt);
        this.pose(b, dt, time);
      }
      if (flock.mode === 'flight' && flock.birds.every((b) => b.mode !== 'flight')) {
        flock.mode = flock.birds[0].mode;
        flock.timer = flock.mode === 'perch' ? range(flock.rand, 10, 24) : range(flock.rand, 8, 20);
      }
    }
    this.birds.forEach((b, i) => this.write(b, i));
    this.instances.commit(this.birds.length);
  }

  /** Where something frightening is happening near the flock, or null when all is calm. */
  private threat(flock: Flock, s: Stimuli): { x: number; z: number } | null {
    const up = s.updraft;
    for (const b of flock.birds) {
      const w = s.wind.sample(b.x, b.z, s.sample);
      const speed = Math.hypot(w.x, w.z);
      const high = b.mode === 'perch' ? 0.5 : 1;
      if (w.energy * high > 0.16 || speed > 8.5 || w.lift * high > 0.3) {
        const from = s.gustAt ?? { x: b.x - w.x, z: b.z - w.z };
        return { x: from.x, z: from.z };
      }
      if (up.strength > 0.15 && Math.hypot(up.x - b.x, up.z - b.z) < 9) return { x: up.x, z: up.z };
      if (s.glider && s.glider.distanceTo(scratch.set(b.x, b.y, b.z)) < 4.5) return { x: s.glider.x, z: s.glider.z };
    }
    return null;
  }

  private takeoff(flock: Flock, threat: { x: number; z: number } | null): void {
    const rand = flock.rand;
    const birds = flock.birds;
    const toTree = this.habitat.perches.length >= birds.length && (flock.mode === 'ground' ? rand() < (threat ? 0.6 : 0.5) : rand() < 0.2);
    const ends: { x: number; y: number; z: number; perch: Perch | null }[] = [];
    for (const b of birds) if (b.perch) this.taken.delete(b.perch);
    if (toTree) {
      const first = this.freePerch(rand, threat);
      if (first) {
        const near = this.habitat.perches
          .filter((p) => p !== first && !this.taken.has(p))
          .sort((a, b) => Math.hypot(a.x - first.x, a.y - first.y, a.z - first.z) - Math.hypot(b.x - first.x, b.y - first.y, b.z - first.z));
        for (const p of [first, ...near].slice(0, birds.length)) {
          this.taken.add(p);
          ends.push({ x: p.x, y: p.y, z: p.z, perch: p });
        }
      }
    }
    if (ends.length < birds.length) {
      ends.length = 0;
      const spot = this.groundSpot(flock, threat);
      flock.centreX = spot[0];
      flock.centreZ = spot[1];
      for (let i = 0; i < birds.length; i++) {
        let x = spot[0];
        let z = spot[1];
        for (let tries = 0; tries < 6; tries++) {
          const a = rand() * Math.PI * 2;
          const d = 0.4 + rand() * 1.6;
          x = spot[0] + Math.cos(a) * d;
          z = spot[1] + Math.sin(a) * d;
          if (this.habitat.forage(x, z)) break;
        }
        ends.push({ x, y: this.habitat.ground(x, z), z, perch: null });
      }
    }
    flock.mode = 'flight';
    const bend = (rand() < 0.5 ? -1 : 1) * range(rand, 0.25, 0.5);
    birds.forEach((b, i) => {
      const end = ends[i];
      b.destPerch = end.perch;
      b.perch = null;
      b.mode = 'flight';
      b.hop = null;
      b.u = 0;
      b.delay = threat ? rand() * 0.18 : rand() * 0.7;
      b.cheepAt = b.rand() < (threat ? 0.7 : 0.35) ? b.delay + b.rand() * 0.2 : -1;
      const dx = end.x - b.x;
      const dz = end.z - b.z;
      const dist = Math.max(Math.hypot(dx, dz), 1);
      const sideX = -dz / dist;
      const sideZ = dx / dist;
      const arc = bend * dist + range(b.rand, -1, 1);
      const climb = 2.2 + dist * 0.16 + (threat ? 2 : 0) + range(b.rand, -0.6, 0.6);
      b.path = new THREE.CubicBezierCurve3(
        new THREE.Vector3(b.x, b.y, b.z),
        new THREE.Vector3(b.x + dx * 0.2 + sideX * arc, b.y + climb, b.z + dz * 0.2 + sideZ * arc),
        new THREE.Vector3(end.x - dx * 0.25 + sideX * arc * 0.7, end.y + climb * 0.5 + 0.8, end.z - dz * 0.25 + sideZ * arc * 0.7),
        new THREE.Vector3(end.x, end.y, end.z),
      );
      b.duration = Math.max(1.6, b.path.getLength() / range(b.rand, 7, 9));
    });
  }

  private freePerch(rand: Rng, threat: { x: number; z: number } | null): Perch | null {
    const free = this.habitat.perches.filter((p) => !this.taken.has(p) && (!threat || Math.hypot(p.x - threat.x, p.z - threat.z) > 8));
    return free.length ? free[Math.floor(rand() * free.length)] : null;
  }

  /** Somewhere open in the flock's range, away from the disturbance, preferring short grass where they can be seen. */
  private groundSpot(flock: Flock, threat: { x: number; z: number } | null): [number, number] {
    const rand = flock.rand;
    const { x, z, radius } = flock.home;
    let best: [number, number] = [flock.centreX, flock.centreZ];
    let bestScore = -Infinity;
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * radius;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (!this.habitat.forage(px, pz)) continue;
      const moved = Math.hypot(px - flock.centreX, pz - flock.centreZ);
      const away = threat ? Math.min(Math.hypot(px - threat.x, pz - threat.z), 20) * 0.1 : 0;
      const score = -this.habitat.grassHeight(px, pz) * 2 + away + (moved > 8 ? 1 : 0) + rand();
      if (score > bestScore) {
        bestScore = score;
        best = [px, pz];
      }
    }
    return best;
  }

  private forage(b: Bird, dt: number): void {
    const rand = b.rand;
    if (b.hop) {
      const h = b.hop;
      h.t = Math.min(1, h.t + dt / 0.12);
      b.x = h.fromX + (h.toX - h.fromX) * h.t;
      b.z = h.fromZ + (h.toZ - h.fromZ) * h.t;
      b.y = h.fromY + (h.toY - h.fromY) * h.t + 0.07 * 4 * h.t * (1 - h.t);
      if (h.t >= 1) {
        b.hop = null;
        b.squash.velocity -= 2.5;
        b.tail.velocity += 6;
      }
      return;
    }
    b.y = this.habitat.ground(b.x, b.z);
    b.next -= dt;
    if (b.next > 0) return;
    const roll = rand();
    if (roll < 0.5) {
      const fx = b.flock.centreX - b.x;
      const fz = b.flock.centreZ - b.z;
      const far = Math.hypot(fx, fz) > 2.2;
      const a = far ? Math.atan2(fx, fz) + (rand() - 0.5) : b.yaw + (rand() - 0.5) * 2.4;
      const d = range(rand, 0.12, 0.3);
      const tx = b.x + Math.sin(a) * d;
      const tz = b.z + Math.cos(a) * d;
      if (this.habitat.forage(tx, tz)) {
        b.yaw = a;
        b.hop = { t: 0, fromX: b.x, fromZ: b.z, fromY: b.y, toX: tx, toZ: tz, toY: this.habitat.ground(tx, tz) };
      }
      b.next = rand() < 0.3 ? range(rand, 0.04, 0.12) : range(rand, 0.25, 0.9);
    } else if (roll < 0.8) {
      b.peck = 0.14 * (1 + Math.floor(rand() * 3));
      b.next = b.peck + range(rand, 0.1, 0.5);
    } else {
      b.headGoal = (rand() - 0.5) * 2;
      if (rand() < 0.3) b.tail.velocity += 8;
      b.next = range(rand, 0.3, 1.1);
    }
  }

  private sit(b: Bird, dt: number): void {
    const p = b.perch;
    if (!p) return;
    const rand = b.rand;
    b.x = p.x;
    b.y = p.y;
    b.z = p.z;
    b.next -= dt;
    b.preen = Math.max(0, b.preen - dt);
    if (b.next > 0) return;
    const roll = rand();
    if (roll < 0.45) b.headGoal = (rand() - 0.5) * 2.2;
    else if (roll < 0.65) b.preen = range(rand, 0.6, 1.3);
    else if (roll < 0.85) b.yaw = p.yaw + (rand() - 0.5) * 1.6;
    else b.tail.velocity += 8;
    b.next = range(rand, 0.4, 1.8);
  }

  private fly(b: Bird, dt: number, s: Stimuli): void {
    const path = b.path;
    if (!path) return;
    if (b.delay > 0) {
      b.delay -= dt;
      b.cheepAt -= dt;
      return;
    }
    if (b.cheepAt > -1) {
      b.cheepAt -= dt;
      if (b.cheepAt <= 0) {
        b.cheepAt = -1;
        const pos = scratch.set(b.x, b.y, b.z);
        s.voices.cheep(screenPan(s.camera, pos), 1 / (1 + pos.distanceTo(s.camera.position) / 45));
      }
    }
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    b.u = Math.min(1, b.u + dt / b.duration);
    const e = b.u * b.u * (3 - 2 * b.u) * 0.6 + b.u * 0.4;
    path.getPoint(e, scratch);
    const bob = Math.sin(b.u * Math.PI) * Math.sin(b.burst * 14) * 0.12;
    b.x = scratch.x;
    b.y = scratch.y + bob;
    b.z = scratch.z;
    b.vx = (b.x - px) / dt;
    b.vy = (b.y - py) / dt;
    b.vz = (b.z - pz) / dt;
    if (b.u >= 1) {
      b.mode = b.destPerch ? 'perch' : 'ground';
      b.perch = b.destPerch;
      if (b.perch) b.yaw = b.perch.yaw;
      b.path = null;
      b.squash.velocity -= 3;
      b.tail.velocity += 10;
      b.next = range(b.rand, 0.3, 1.2);
    }
  }

  private pose(b: Bird, dt: number, time: number): void {
    const flying = b.mode === 'flight' && b.delay <= 0;
    let pitch = 0;
    let roll = 0;
    let headPitch = 0;
    let fold = 1;
    let flapAmp = 0;
    let tail = 0.05;
    let puff = 1;
    if (flying) {
      const hs = Math.hypot(b.vx, b.vz);
      if (hs > 0.3) {
        const prev = b.yaw;
        b.yaw = easeAngle(b.yaw, Math.atan2(b.vx, b.vz), 10, dt);
        roll = THREE.MathUtils.clamp((-wrapAngle(b.yaw - prev) / dt) * 0.18, -0.8, 0.8);
      }
      pitch = THREE.MathUtils.clamp(-Math.atan2(b.vy, Math.max(hs, 1)) * 0.6, -0.6, 0.5);
      const cruising = b.u > 0.18 && b.u < 0.82;
      b.burst += dt;
      const bounding = cruising && b.burst % 0.46 > 0.3;
      fold = bounding ? 1 : 0;
      flapAmp = 1.05;
      b.flapPhase += dt * Math.PI * 2 * (b.u > 0.85 ? 11 : 16);
      if (b.u > 0.88) pitch = -0.55;
      tail = b.u > 0.85 ? -0.35 : 0.1;
    } else {
      if (b.peck > 0) {
        b.peck -= dt;
        headPitch = Math.sin((b.peck / 0.14) * Math.PI) > 0 ? 1.1 : 0.2;
        pitch = 0.35;
      }
      if (b.preen > 0) {
        headPitch = 0.8;
        b.headGoal = Math.sin(time * 3 + b.seed * 10) > 0 ? 1.8 : -1.8;
        puff = 1.12;
      }
      if (b.hop) pitch = -0.15;
    }
    b.pitch = ease(b.pitch, pitch, 12, dt);
    b.roll = ease(b.roll, roll, 6, dt);
    b.headYaw = ease(b.headYaw, flying ? 0 : b.headGoal, 28, dt);
    b.headPitch = ease(b.headPitch, headPitch, 30, dt);
    b.fold = ease(b.fold, fold, flying ? 30 : 16, dt);
    b.flap = flapAmp > 0 ? 0.25 + Math.sin(b.flapPhase) * flapAmp : ease(b.flap, 0, 12, dt);
    b.tail.step(tail, 180, 9, dt);
    b.squash.step(1, 320, 16, dt);
    b.puff = ease(b.puff, puff + (b.mode === 'perch' ? 0.04 : 0), 3, dt);
    b.sway = ease(b.sway, b.mode === 'perch' ? 1 : 0, b.mode === 'perch' ? 20 : 6, dt);
  }

  private write(b: Bird, i: number): void {
    const inst = this.instances;
    const ground = b.mode === 'ground' ? 1 : 0;
    const air = b.mode === 'flight' && b.delay <= 0 ? 1 : 0;
    inst.set(0, i, b.x, b.y, b.z, b.yaw);
    inst.set(1, i, b.pitch, b.roll, b.headYaw, b.headPitch);
    inst.set(2, i, b.flap, b.fold, b.tail.value, b.squash.value);
    inst.set(3, i, b.sway, b.perch?.swaySeed ?? b.destPerch?.swaySeed ?? 0, ground * 3.6 + (b.mode === 'perch' ? 1.5 : 0), air);
    inst.set(4, i, b.back.r, b.back.g, b.back.b, b.cap);
    inst.set(5, i, b.breast.r, b.breast.g, b.breast.b, b.puff);
  }

  get state(): { x: number; y: number; z: number; mode: Mode }[] {
    return this.birds.map((b) => ({ x: b.x, y: b.y, z: b.z, mode: b.mode }));
  }
}

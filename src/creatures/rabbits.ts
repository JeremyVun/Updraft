import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { mulberry32, smoothstep } from '../world/noise';
import type { Habitat } from './habitat';
import { Spring, ease, easeAngle, range, wrapAngle, type Rng } from './motion';
import { CREATURE_GLSL } from './shading';
import { Instances, blob, merge, mirrored, type BlobSpec } from './shapes';
import type { Stimuli } from './stimuli';

const BODY = 0;
const HEAD = 1;
const EAR_L = 2;
const EAR_R = 3;
const TAIL = 4;
const HIND_L = 5;
const HIND_R = 6;
const FRONT_L = 7;
const FRONT_R = 8;
const EYE = 9;
const NOSE = 10;

const SIZE = 1.12;

const FUR = 0;
const EAR = 1;
const EYE_MAT = 2;
const NOSE_MAT = 3;
const TAIL_MAT = 4;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uNudge;
in float aPart;
in vec2 aMat;
in vec4 iPos;
in vec4 iBody;
in vec4 iHead;
in vec4 iEars;
in vec4 iLimb;
in vec4 iLook;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out vec3 vFur;
out float vRest;

const vec3 NECK = vec3(0.0, 0.6, 0.26);
const vec3 REAR = vec3(0.0, 0.08, -0.36);
const vec3 CENTRE = vec3(0.0, 0.4, -0.05);

void turn(inout vec3 p, inout vec3 n, vec3 pivot, vec3 angles) {
  p -= pivot;
  p = rotY(rotX(rotZ(p, angles.z), angles.x), angles.y);
  n = rotY(rotX(rotZ(n, angles.z), angles.x), angles.y);
  p += pivot;
}

void main() {
  int part = int(aPart + 0.5);
  vec3 p = position;
  vec3 n = normal;
  float side = (part == ${EAR_L} || part == ${HIND_L} || part == ${FRONT_L}) ? 1.0 : -1.0;

  if (part == ${EYE}) p.y = 0.76 + (p.y - 0.76) * (1.0 - 0.9 * iHead.w);
  if (part == ${NOSE} || (part == ${HEAD} && p.z > 0.45)) p.y += iHead.z * 0.018 * smoothstep(0.45, 0.62, p.z);
  if (part == ${EAR_L} || part == ${EAR_R}) {
    float back = part == ${EAR_L} ? iEars.x : iEars.y;
    float spread = part == ${EAR_L} ? iEars.z : iEars.w;
    turn(p, n, vec3(0.085 * side, 0.9, 0.33), vec3(-back, 0.0, -side * spread));
  }
  bool onHead = part == ${HEAD} || part == ${EAR_L} || part == ${EAR_R} || part == ${EYE} || part == ${NOSE};
  if (onHead) turn(p, n, NECK, vec3(iHead.y + iBody.z * 0.9, iHead.x, 0.0));
  if (part == ${HIND_L} || part == ${HIND_R}) turn(p, n, vec3(0.19 * side, 0.24, -0.26), vec3(iLimb.x * 1.3, 0.0, 0.0));
  if (part == ${FRONT_L} || part == ${FRONT_R}) turn(p, n, vec3(0.1 * side, 0.36, 0.22), vec3(iBody.z * 0.75 - iLimb.y * 1.7, 0.0, side * iLimb.y * 0.25));
  if (part == ${TAIL}) turn(p, n, vec3(0.0, 0.42, -0.5), vec3(-iLimb.z * 0.25, iLimb.z * 0.3, 0.0));

  bool feet = part == ${HIND_L} || part == ${HIND_R};
  turn(p, n, REAR, vec3(-iBody.z * (feet ? 0.15 : 1.05), 0.0, 0.0));
  turn(p, n, CENTRE, vec3(iBody.y, 0.0, 0.0));

  float squash = iBody.x * (1.0 - 0.2 * iBody.w);
  p.y *= squash;
  p.xz *= inversesqrt(squash) * (1.0 + 0.06 * iBody.w);
  n = normalize(vec3(n.x * sqrt(squash), n.y / squash, n.z * sqrt(squash)));

  vec3 world = rotY(p * ${SIZE.toFixed(2)}, iPos.w) + iPos.xyz;
  vWorld = world;
  vNormal = rotY(n, iPos.w);
  vMat = aMat;
  vFur = iLook.rgb;
  vRest = position.y;
  gl_Position = projectionMatrix * nudgedView(world, uNudge * smoothstep(0.04, 0.5, position.y));
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform vec3 uCream;
uniform vec3 uPink;
uniform vec3 uEye;
uniform vec3 uNose;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vFur;
in float vRest;
void main() {
  vec3 N = normalize(vNormal);
  int mat = int(vMat.x + 0.5);
  float fur = vnoise(vWorld.xz * 23.0 + vWorld.y * 17.0) * 0.14 + 0.93;
  vec3 alb = mix(vFur, uCream, vMat.y) * fur;
  float fuzz = 1.0;
  float thin = 0.0;
  if (mat == ${EAR}) {
    alb = mix(vFur * fur, uPink, vMat.y);
    thin = 0.5 + 0.9 * vMat.y;
  } else if (mat == ${EYE_MAT}) {
    alb = uEye;
    fuzz = 0.0;
  } else if (mat == ${NOSE_MAT}) {
    alb = uNose;
  } else if (mat == ${TAIL_MAT}) {
    alb = uCream * 1.08;
    thin = 0.35;
  }
  float ao = mix(0.5, 1.0, smoothstep(0.0, 0.42, vRest));
  vec3 col = shadeCreature(alb, N, vWorld, ao, fuzz, thin, 0.0);
  if (mat == ${EYE_MAT}) col += uSunColor * catchlight(N, vWorld) * 0.9;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function rabbitGeometry(): THREE.BufferGeometry {
  const ear: BlobSpec = {
    part: EAR_L,
    mat: EAR,
    at: [0.085, 0.9, 0.33],
    offset: [0, 0.31, 0],
    size: [0.088, 0.33, 0.042],
    rot: [-0.2, 0, -0.17],
    shape: (u) => {
      if (u.y < 0) u.x *= 0.62 + 0.38 * (1 + u.y);
      u.z -= u.x * u.x * 0.5;
    },
    blend: (u) => smoothstep(0.05, 0.6, u.z) * (1 - smoothstep(0.5, 0.92, Math.abs(u.y))) * (1 - smoothstep(0.45, 0.85, Math.abs(u.x))),
  };
  const eye: BlobSpec = { part: EYE, mat: EYE_MAT, at: [0.168, 0.76, 0.46], size: [0.06, 0.068, 0.064] };
  const haunch: BlobSpec = { part: BODY, mat: FUR, at: [0.17, 0.28, -0.24], size: [0.16, 0.2, 0.25], blend: (u) => smoothstep(-0.3, -0.9, u.y) * 0.6 };
  const hind: BlobSpec = { part: HIND_L, mat: FUR, at: [0.19, 0.055, -0.13], size: [0.085, 0.06, 0.25], blend: (u) => smoothstep(0.1, -0.6, u.y) };
  const front: BlobSpec = { part: FRONT_L, mat: FUR, at: [0.1, 0.075, 0.31], size: [0.058, 0.08, 0.075], blend: () => 0.45 };
  return merge(
    [
      {
        part: BODY,
        mat: FUR,
        at: [0, 0.4, -0.1],
        size: [0.33, 0.35, 0.47],
        detail: 3,
        shape: (u: THREE.Vector3) => {
          const k = u.z < 0 ? 1 + 0.14 * -u.z : 1 - 0.1 * u.z;
          u.x *= k;
          u.y *= k;
          if (u.y < -0.55) u.y = -0.55 + (u.y + 0.55) * 0.5;
        },
        blend: (u: THREE.Vector3) => smoothstep(-0.25, -0.8, u.y) * 0.9,
      },
      { part: BODY, mat: FUR, at: [0, 0.44, 0.14], size: [0.25, 0.27, 0.22], blend: (u: THREE.Vector3) => smoothstep(0.1, 0.8, u.z) * smoothstep(0.5, -0.3, u.y) },
      haunch,
      mirrored(haunch, BODY),
      {
        part: HEAD,
        mat: FUR,
        at: [0, 0.7, 0.34],
        size: [0.255, 0.235, 0.255],
        detail: 3,
        shape: (u: THREE.Vector3) => {
          if (u.y < 0.1) u.x *= 1 + 0.08 * Math.min(1, (0.1 - u.y) * 2);
        },
        blend: (u: THREE.Vector3) => smoothstep(-0.2, -0.8, u.y) * smoothstep(-0.3, 0.5, u.z),
      },
      { part: HEAD, mat: FUR, at: [0, 0.635, 0.53], size: [0.14, 0.1, 0.09], blend: () => 0.8 },
      { part: NOSE, mat: NOSE_MAT, at: [0, 0.685, 0.615], size: [0.036, 0.026, 0.022], detail: 1 },
      eye,
      mirrored(eye, EYE),
      ear,
      mirrored(ear, EAR_R),
      { part: TAIL, mat: TAIL_MAT, at: [0, 0.46, -0.56], size: [0.13, 0.13, 0.11] },
      hind,
      mirrored(hind, HIND_R),
      front,
      mirrored(front, FRONT_R),
    ].map((spec) => blob(spec as BlobSpec)),
  );
}

type Activity = 'sit' | 'graze' | 'groom' | 'look' | 'travel' | 'crouch';

interface Hop {
  t: number;
  prep: number;
  duration: number;
  height: number;
  fromX: number;
  fromZ: number;
  fromY: number;
  toX: number;
  toZ: number;
  toY: number;
}

interface Rabbit {
  rand: Rng;
  seed: number;
  fur: THREE.Color;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  y: number;
  yaw: number;
  activity: Activity;
  timer: number;
  goalX: number;
  goalZ: number;
  fleeing: boolean;
  hop: Hop | null;
  pause: number;
  alarm: number;
  lookX: number;
  lookZ: number;
  squash: Spring;
  pitch: Spring;
  sitUp: number;
  crouch: number;
  headYaw: number;
  headPitch: number;
  headYawGoal: number;
  chew: number;
  blink: number;
  hind: number;
  front: number;
  tail: Spring;
  earL: Spring;
  earR: Spring;
  spreadL: number;
  spreadR: number;
  nextFidget: number;
  nextBlink: number;
  groomEar: number;
}

const FURS = ['#8f603d', '#a87850', '#7c5c46', '#9c5f37', '#6e4c35', '#b08a62'];
const WHITE = '#f2ede4';

/** Rabbits hop between flower patches, nibble, groom and sit up; gusts make them flatten their ears or bolt. */
export class Rabbits {
  readonly mesh: THREE.Mesh;
  private readonly instances: Instances;
  private readonly list: Rabbit[] = [];

  constructor(
    private readonly habitat: Habitat,
    capacity = 16,
  ) {
    this.instances = new Instances(rabbitGeometry(), capacity, ['iPos', 'iBody', 'iHead', 'iEars', 'iLimb', 'iLook']);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...atmo.uniforms,
        uNudge: { value: 2.4 },
        uCream: { value: new THREE.Color('#ecdfc8') },
        uPink: { value: new THREE.Color('#f3a7a2') },
        uEye: { value: new THREE.Color('#130b09') },
        uNose: { value: new THREE.Color('#d98b8b') },
      },
    });
    this.mesh = new THREE.Mesh(this.instances.geometry, material);
    this.mesh.frustumCulled = false;
  }

  get count(): number {
    return this.list.length;
  }

  /** Adds a rabbit living around (x, z); returns false if there is no meadow nearby. */
  add(x: number, z: number, seed: number, white = false): boolean {
    if (this.list.length >= this.instances.capacity) return false;
    const rand = mulberry32(seed);
    const spot = this.findSpot(rand, x, z, 0, 5, 12);
    if (!spot) return false;
    const r: Rabbit = {
      rand,
      seed: rand(),
      fur: new THREE.Color(white ? WHITE : FURS[Math.floor(rand() * FURS.length)]),
      homeX: x,
      homeZ: z,
      x: spot[0],
      z: spot[1],
      y: this.habitat.ground(spot[0], spot[1]),
      yaw: rand() * Math.PI * 2,
      activity: 'sit',
      timer: range(rand, 0.5, 3),
      goalX: spot[0],
      goalZ: spot[1],
      fleeing: false,
      hop: null,
      pause: 0,
      alarm: 0,
      lookX: 0,
      lookZ: 0,
      squash: new Spring(),
      pitch: new Spring(),
      sitUp: 0,
      crouch: 0,
      headYaw: 0,
      headPitch: 0,
      headYawGoal: 0,
      chew: 0,
      blink: 0,
      hind: 0,
      front: 0,
      tail: new Spring(),
      earL: new Spring(),
      earR: new Spring(),
      spreadL: 0.1,
      spreadR: 0.1,
      nextFidget: range(rand, 0.5, 2),
      nextBlink: range(rand, 1, 4),
      groomEar: 0,
    };
    r.squash.value = 1;
    this.list.push(r);
    return true;
  }

  /** A meadow point `min`..`max` from (x, z), preferring short grass so the rabbit stays in view. */
  private findSpot(rand: Rng, x: number, z: number, min: number, max: number, tries: number): [number, number] | null {
    let best: [number, number] | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < tries; i++) {
      const a = rand() * Math.PI * 2;
      const d = min + (max - min) * Math.sqrt(rand());
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (!this.habitat.meadow(px, pz) || this.crowded(px, pz, null)) continue;
      const score = -this.habitat.grassHeight(px, pz) + rand() * 0.8;
      if (score > bestScore) {
        bestScore = score;
        best = [px, pz];
      }
    }
    return best;
  }

  private crowded(x: number, z: number, self: Rabbit | null): boolean {
    return this.list.some((o) => o !== self && Math.hypot(o.x - x, o.z - z) < 1.3);
  }

  update(dt: number, time: number, s: Stimuli): void {
    const sample = s.sample;
    this.list.forEach((r, i) => {
      s.wind.sample(r.x, r.z, sample);
      const speed = Math.hypot(sample.x, sample.z);
      let threat = sample.energy * 1.7 + Math.max(0, speed - 7) / 7;
      if (s.glider) threat += Math.max(0, 1 - Math.hypot(s.glider.x - r.x, s.glider.y - r.y, s.glider.z - r.z) / 5);
      r.alarm = Math.max(threat, r.alarm - dt * 0.5);
      this.react(r, threat, speed, sample.x, sample.z, s);
      this.behave(r, dt);
      this.pose(r, dt, time, speed);
      this.write(r, i);
    });
    this.instances.commit(this.list.length);
  }

  private react(r: Rabbit, threat: number, speed: number, wx: number, wz: number, s: Stimuli): void {
    if (threat > 0.85 && !r.fleeing) {
      let ax = wx / Math.max(speed, 1e-3);
      let az = wz / Math.max(speed, 1e-3);
      const from = s.gustAt;
      if (from && Math.hypot(from.x - r.x, from.z - r.z) < 16) {
        const d = Math.max(Math.hypot(r.x - from.x, r.z - from.z), 1e-3);
        ax = (r.x - from.x) / d + ax * 0.6;
        az = (r.z - from.z) / d + az * 0.6;
      }
      const a = Math.atan2(ax, az) + (r.rand() - 0.5) * 0.8;
      r.fleeing = true;
      this.startTravel(r, r.x + Math.sin(a) * 14, r.z + Math.cos(a) * 14);
      return;
    }
    if (r.fleeing) return;
    if (threat > 0.22) {
      if (r.activity !== 'crouch' && !r.hop) {
        r.activity = 'crouch';
        r.timer = range(r.rand, 0.8, 1.6);
      }
      if (r.activity === 'crouch') r.timer = Math.max(r.timer, 0.7);
      return;
    }
    const up = s.updraft;
    if (up.strength > 0.12 && r.activity !== 'crouch' && !r.hop) {
      const d = Math.hypot(up.x - r.x, up.z - r.z);
      if (d < 24 && d > 2) {
        r.activity = 'look';
        r.timer = Math.max(r.timer, 1.2);
        r.lookX = up.x;
        r.lookZ = up.z;
      }
    }
  }

  private startTravel(r: Rabbit, gx: number, gz: number): void {
    r.activity = 'travel';
    r.goalX = gx;
    r.goalZ = gz;
    r.pause = r.fleeing ? 0 : range(r.rand, 0.05, 0.3);
    r.timer = r.fleeing ? 4.5 : 14;
  }

  private choose(r: Rabbit): void {
    const rand = r.rand;
    const fromHome = Math.hypot(r.x - r.homeX, r.z - r.homeZ);
    if (fromHome > 14 || rand() < 0.34) {
      const flowers = this.habitat.flowers.filter((f) => Math.hypot(f.x - r.homeX, f.z - r.homeZ) < 16);
      const patch = flowers.length && rand() < 0.55 ? flowers[Math.floor(rand() * flowers.length)] : null;
      const spot = patch
        ? this.findSpot(rand, patch.x, patch.z, 0, patch.radius, 6)
        : this.findSpot(rand, fromHome > 14 ? r.homeX : r.x, fromHome > 14 ? r.homeZ : r.z, 2.5, 8, 8);
      if (spot) {
        this.startTravel(r, spot[0], spot[1]);
        return;
      }
    }
    const roll = rand();
    r.activity = roll < 0.45 ? 'graze' : roll < 0.68 ? 'sit' : roll < 0.84 ? 'groom' : 'look';
    r.timer = r.activity === 'graze' ? range(rand, 2.5, 6) : r.activity === 'sit' ? range(rand, 1.2, 3.5) : range(rand, 1.8, 3.2);
    if (r.activity === 'look') {
      const a = r.yaw + (rand() - 0.5) * 2.4;
      r.lookX = r.x + Math.sin(a) * 10;
      r.lookZ = r.z + Math.cos(a) * 10;
    }
    r.groomEar = rand() < 0.5 ? -1 : 1;
  }

  private behave(r: Rabbit, dt: number): void {
    if (r.hop) {
      this.flyHop(r, r.hop, dt);
      return;
    }
    r.y = this.habitat.ground(r.x, r.z);
    r.timer -= dt;
    if (r.activity === 'travel') {
      r.pause -= dt;
      const dx = r.goalX - r.x;
      const dz = r.goalZ - r.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.8 || r.timer < 0) {
        const wasFleeing = r.fleeing;
        r.fleeing = false;
        if (wasFleeing) {
          r.activity = 'look';
          r.timer = range(r.rand, 1.5, 3);
          r.lookX = r.x - Math.sin(r.yaw) * 10;
          r.lookZ = r.z - Math.cos(r.yaw) * 10;
        } else {
          this.choose(r);
        }
        return;
      }
      const want = Math.atan2(dx, dz);
      r.yaw = easeAngle(r.yaw, want, r.fleeing ? 14 : 5, dt);
      if (r.pause <= 0 && Math.abs(wrapAngle(want - r.yaw)) < (r.fleeing ? 0.9 : 0.5)) this.launch(r, want, dist);
      return;
    }
    if (r.activity === 'look') r.yaw = easeAngle(r.yaw, Math.atan2(r.lookX - r.x, r.lookZ - r.z), 1.2, dt);
    if (r.activity === 'graze' && r.rand() < dt * 0.12) this.launch(r, r.yaw + (r.rand() - 0.5) * 1.6, 0.5);
    if (r.timer <= 0) {
      if (r.activity === 'crouch') {
        r.activity = 'sit';
        r.timer = range(r.rand, 0.6, 1.4);
      } else {
        this.choose(r);
      }
    }
  }

  private launch(r: Rabbit, heading: number, dist: number): void {
    const rand = r.rand;
    const length = r.fleeing ? range(rand, 1.8, 2.4) : Math.min(dist, range(rand, 0.9, 1.35));
    for (const turn of [0, 0.5, -0.5, 1.1, -1.1]) {
      const a = heading + turn + (rand() - 0.5) * (r.fleeing ? 0.3 : 0.25);
      const tx = r.x + Math.sin(a) * length;
      const tz = r.z + Math.cos(a) * length;
      if (!this.habitat.meadow(tx, tz) || this.crowded(tx, tz, r)) continue;
      r.hop = {
        t: 0,
        prep: r.fleeing ? 0.04 : 0.08,
        duration: r.fleeing ? 0.3 : 0.24 + length * 0.09,
        height: r.fleeing ? 0.55 : 0.22 + length * 0.2,
        fromX: r.x,
        fromZ: r.z,
        fromY: r.y,
        toX: tx,
        toZ: tz,
        toY: this.habitat.ground(tx, tz),
      };
      return;
    }
    r.fleeing = false;
    r.goalX = r.x;
    r.goalZ = r.z;
  }

  private flyHop(r: Rabbit, h: Hop, dt: number): void {
    if (h.prep > 0) {
      h.prep -= dt;
      r.squash.step(0.8, 400, 22, dt);
      if (h.prep <= 0) {
        r.squash.velocity += 5;
        r.earL.velocity += 5;
        r.earR.velocity += 5;
      }
      return;
    }
    h.t = Math.min(1, h.t + dt / h.duration);
    const t = h.t;
    r.x = h.fromX + (h.toX - h.fromX) * t;
    r.z = h.fromZ + (h.toZ - h.fromZ) * t;
    r.y = h.fromY + (h.toY - h.fromY) * t + h.height * 4 * t * (1 - t);
    if (t >= 1) {
      r.hop = null;
      r.squash.velocity -= r.fleeing ? 5 : 3.5;
      r.pitch.velocity += 2;
      r.earL.velocity -= 7;
      r.earR.velocity -= 6;
      r.tail.velocity += 12;
      r.pause = r.fleeing ? range(r.rand, 0.02, 0.07) : r.rand() < 0.2 ? range(r.rand, 0.5, 1.2) : range(r.rand, 0.1, 0.35);
    }
  }

  private pose(r: Rabbit, dt: number, time: number, windSpeed: number): void {
    const rand = r.rand;
    const hop = r.hop;
    const act = r.activity;
    const airborne = hop !== null && hop.prep <= 0;
    const t = hop ? hop.t : 0;

    let sitUp = 0;
    let crouch = 0;
    let headPitch = 0.05;
    let front = 0;
    let ear = 0.1;
    let spread = 0.12;
    let pitch = 0;
    if (act === 'graze') {
      headPitch = 0.62;
      pitch = 0.1;
      ear = 0.25;
    } else if (act === 'groom') {
      sitUp = 0.5;
      front = 1;
      headPitch = 0.45 + Math.sin(time * 7 + r.seed * 9) * 0.18;
      ear = 0.2;
    } else if (act === 'look') {
      sitUp = 1;
      headPitch = -0.1;
      ear = -0.12;
      spread = 0.04;
    } else if (act === 'crouch') {
      crouch = 1;
      headPitch = 0.3;
      ear = 1.35;
      spread = 0.22;
    }
    if (airborne) {
      pitch = -0.4 + t * 0.75;
      ear = r.fleeing ? 0.9 : 0.45;
      front = t > 0.55 ? -0.35 : 0.15;
      sitUp = 0;
      crouch = 0;
      headPitch = -0.1 + t * 0.2;
    } else if (act === 'travel') {
      ear = r.fleeing ? 0.9 : 0.15;
      headPitch = 0.15;
    }
    const hind = airborne ? smoothstep(0.0, 0.2, t) * (1 - smoothstep(0.55, 0.95, t)) : 0;

    r.sitUp = ease(r.sitUp, sitUp, sitUp > r.sitUp ? 7 : 5, dt);
    r.crouch = ease(r.crouch, crouch, crouch > r.crouch ? 14 : 3, dt);
    r.front = ease(r.front, front, 9, dt);
    r.hind = ease(r.hind, hind, 22, dt);
    if (!hop || hop.prep <= 0) r.squash.step(airborne ? 1.1 : 1, 260, 14, dt);
    r.pitch.step(pitch, 160, 16, dt);

    r.nextFidget -= dt;
    if (r.nextFidget <= 0 && !hop) {
      r.nextFidget = range(rand, 0.6, 2.8);
      const roll = rand();
      if (roll < 0.4) (rand() < 0.5 ? r.earL : r.earR).velocity += (rand() < 0.5 ? -1 : 1) * range(rand, 5, 9);
      else if (roll < 0.8) r.headYawGoal = (rand() - 0.5) * (act === 'graze' ? 0.5 : 1.1);
      else r.tail.velocity += 10;
    }
    let headYaw = r.headYawGoal;
    if (act === 'look') headYaw = THREE.MathUtils.clamp(wrapAngle(Math.atan2(r.lookX - r.x, r.lookZ - r.z) - r.yaw), -1.1, 1.1);
    if (hop || act === 'crouch') headYaw = 0;
    r.headYaw = ease(r.headYaw, headYaw, act === 'look' ? 4 : 6, dt);
    r.headPitch = ease(r.headPitch, headPitch + r.crouch * 0.1, 8, dt);

    r.nextBlink -= dt;
    if (r.nextBlink <= 0) {
      r.nextBlink = range(rand, 1.5, 5);
      r.blink = 1;
    }
    r.blink = Math.max(0, r.blink - dt * 8);
    const nibbling = act === 'graze' && Math.sin(time * 0.9 + r.seed * 20) > -0.3;
    r.chew = nibbling ? Math.sin(time * 19 + r.seed * 7) * 0.5 + 0.5 : ease(r.chew, 0, 10, dt);

    const breeze = Math.min(windSpeed, 12) * 0.035;
    const flutter = Math.sin(time * 9 + r.seed * 30) * Math.min(windSpeed, 14) * 0.012;
    const washL = act === 'groom' && r.groomEar < 0 && Math.sin(time * 1.3 + r.seed) > 0 ? 0.9 : 0;
    const washR = act === 'groom' && r.groomEar > 0 && Math.sin(time * 1.3 + r.seed) > 0 ? 0.9 : 0;
    r.earL.step(ear + breeze + flutter + washL, 90, 8, dt);
    r.earR.step(ear + breeze - flutter * 0.7 + washR, 95, 8.5, dt);
    r.spreadL = ease(r.spreadL, spread, 6, dt);
    r.spreadR = ease(r.spreadR, spread, 6, dt);
    r.tail.step(0, 140, 7, dt);
  }

  private write(r: Rabbit, i: number): void {
    const inst = this.instances;
    inst.set(0, i, r.x, r.y, r.z, r.yaw);
    inst.set(1, i, r.squash.value, r.pitch.value, r.sitUp, r.crouch);
    inst.set(2, i, r.headYaw, r.headPitch, r.chew, r.blink);
    inst.set(3, i, r.earL.value, r.earR.value, r.spreadL, r.spreadR);
    inst.set(4, i, r.hind, r.front, r.tail.value, 0);
    inst.set(5, i, r.fur.r, r.fur.g, r.fur.b, r.seed);
  }

  /** Positions and activities, for inspection in `?shot` mode. */
  get state(): { x: number; y: number; z: number; activity: Activity; fleeing: boolean }[] {
    return this.list.map((r) => ({ x: r.x, y: r.y, z: r.z, activity: r.activity, fleeing: r.fleeing }));
  }
}

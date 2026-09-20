import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { fieldAt, type FieldSample } from '../world/fields';
import { mulberry32, smoothstep } from '../world/noise';
import type { Habitat } from './habitat';
import { Spring, ease, easeAngle, range, screenPan, wrapAngle, type Rng } from './motion';
import { CREATURE_GLSL } from './shading';
import { Instances, blob, merge, mirrored, type BlobSpec } from './shapes';
import { dormant, type Stimuli } from './stimuli';

const BODY = 0;
const NECK = 1;
const HEAD = 2;
const MUZZLE = 3;
const EYE = 4;
const EAR_L = 5;
const EAR_R = 6;
const TAIL = 7;
const FRONT_L = 8;
const FRONT_R = 9;
const HIND_L = 10;
const HIND_R = 11;

const FLEECE = 0;
const SKIN = 1;
const EYE_MAT = 2;
const EAR_MAT = 3;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uNudge;
in float aPart;
in vec2 aMat;
in vec4 iPos;
in vec4 iBody;
in vec4 iHead;
in vec4 iLimb;
in vec4 iFace;
in vec4 iLook;
in vec4 iMark;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out vec2 vMat;
out vec3 vFleece;
out vec4 vMark;

const vec3 CENTRE = vec3(0.0, 0.55, 0.0);
const vec3 NECK_AT = vec3(0.0, 0.66, 0.38);
const vec3 HEAD_AT = vec3(0.0, 0.86, 0.56);
const vec3 TAIL_AT = vec3(0.0, 0.75, -0.6);

void turn(inout vec3 p, inout vec3 n, vec3 pivot, vec3 angles) {
  p -= pivot;
  p = rotY(rotX(rotZ(p, angles.z), angles.x), angles.y);
  n = rotY(rotX(rotZ(n, angles.z), angles.x), angles.y);
  p += pivot;
}

/** Lambs: a shorter, rounder body and a bigger head. */
vec3 lambShape(vec3 q, bool head, float lamb) {
  vec3 shrink = vec3(1.0 - 0.1 * lamb, 1.0 - 0.1 * lamb, 1.0 - 0.24 * lamb);
  vec3 r = CENTRE + (q - CENTRE) * shrink;
  if (!head) return r;
  vec3 h = CENTRE + (HEAD_AT - CENTRE) * shrink;
  return h + (r - h) * (1.0 + 0.34 * lamb);
}

void main() {
  int part = int(aPart + 0.5);
  float lamb = iLook.w;
  vec3 p = position;
  vec3 n = normal;
  bool leg = part >= ${FRONT_L};
  bool front = part == ${FRONT_L} || part == ${FRONT_R};
  bool onHead = part == ${HEAD} || part == ${MUZZLE} || part == ${EYE} || part == ${EAR_L} || part == ${EAR_R};
  float side = p.x > 0.0 ? 1.0 : -1.0;
  if (part == ${EAR_L}) side = 1.0;
  if (part == ${EAR_R}) side = -1.0;

  if (part == ${EYE}) p.y = 0.885 + (p.y - 0.885) * (1.0 - 0.92 * iFace.w);
  if (part == ${MUZZLE} && p.y < 0.745) p += vec3(0.0, -0.035, -0.01) * iHead.w * (1.0 - smoothstep(0.69, 0.745, p.y));

  if (leg) {
    vec3 hip = vec3(0.19 * side, 0.42, front ? 0.32 : -0.36);
    float walkPhase = part == ${HIND_L} ? 0.0 : part == ${FRONT_L} ? 1.5708 : part == ${HIND_R} ? 3.1416 : 4.7124;
    float trotPhase = (part == ${FRONT_L} || part == ${HIND_R}) ? 0.0 : 3.1416;
    float stride = min(iLimb.y, 1.35);
    float ph = iLimb.x + mix(walkPhase, trotPhase, smoothstep(1.0, 1.3, iLimb.y));
    float swing = sin(ph) * 0.55 * stride;
    p.y += max(0.0, -cos(ph)) * 0.06 * stride;
    float fold = iBody.w * (front ? 1.45 : -1.5);
    float splay = iLimb.z;
    turn(p, n, hip, vec3(swing + fold + splay * (front ? -0.3 : 0.35), 0.0, side * splay * 0.2));
    p.xz *= vec2(1.0 - 0.1 * lamb, 1.0 - 0.24 * lamb);
  } else {
    p = lambShape(p, onHead, lamb);
  }

  vec3 neckAt = lambShape(NECK_AT, false, lamb);
  vec3 headAt = lambShape(HEAD_AT, true, lamb);
  if (part == ${EAR_L} || part == ${EAR_R}) {
    float lift = part == ${EAR_L} ? iFace.x : iFace.y;
    turn(p, n, lambShape(vec3(0.11 * side, 0.9, 0.58), true, lamb), vec3(0.0, side * max(-lift, 0.0) * 0.7, side * lift));
  }
  if (onHead) turn(p, n, headAt, vec3(iHead.z, 0.0, 0.0));
  if (onHead || part == ${NECK}) {
    turn(p, n, neckAt, vec3(iHead.x, iHead.y, 0.0));
    p += vec3(sin(iHead.y) * 0.05, -0.12, cos(iHead.y) * 0.05) * clamp(iHead.x / 1.4, 0.0, 1.0);
  }
  if (part == ${TAIL}) turn(p, n, lambShape(TAIL_AT, false, lamb), vec3(0.25 + abs(iFace.z) * 0.5, 0.0, iFace.z));

  p.y -= iBody.w * (0.3 - 0.06 * lamb);
  turn(p, n, CENTRE, vec3(iBody.y, 0.0, leg ? 0.0 : iBody.z));

  float squash = iLimb.w;
  p.y *= squash;
  p.xz *= inversesqrt(squash);
  n = normalize(vec3(n.x * sqrt(squash), n.y / squash, n.z * sqrt(squash)));

  vec3 world = rotY(p * iBody.x, iPos.w) + iPos.xyz;
  vWorld = world;
  vNormal = rotY(n, iPos.w);
  vLocal = position;
  vMat = aMat;
  vFleece = iLook.rgb;
  vMark = part == ${BODY} ? iMark : vec4(0.0);
  gl_Position = projectionMatrix * nudgedView(world, uNudge * smoothstep(0.15, 0.6, position.y));
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform vec3 uSkin;
uniform vec3 uEye;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in vec2 vMat;
in vec3 vFleece;
in vec4 vMark;

/** The farmer's raddle: a soft, ragged smudge of paint on the rump or the shoulder. */
float raddle(vec3 q, vec4 mark) {
  if (mark.a < 0.5) return 0.0;
  float seed = fract(mark.a) * 50.0;
  vec3 at = mark.a < 2.0 ? vec3(0.1, 0.95, -0.3) : vec3(-0.08, 0.93, 0.26);
  float ragged = vnoise(q.xz * 16.0 + seed) * 0.08 + vnoise(q.zy * 38.0 - seed) * 0.035;
  float d = length((q - at) * vec3(1.0, 1.5, 0.85)) + ragged;
  return (1.0 - smoothstep(0.11, 0.22, d)) * 0.92;
}

void main() {
  vec3 N = normalize(vNormal);
  int mat = int(vMat.x + 0.5);
  vec3 col;
  if (mat == ${FLEECE}) {
    float tuft = vMat.y;
    float curl = vnoise(vLocal.xz * 17.0 + vLocal.y * 13.0) * 0.6 + vnoise(vLocal.zy * 43.0) * 0.4;
    vec3 crease = mix(vec3(0.78, 0.8, 0.9), vec3(1.0), smoothstep(0.15, 0.85, tuft));
    vec3 alb = vFleece * crease * (0.88 + 0.2 * curl);
    alb = mix(alb, vMark.rgb, raddle(vLocal, vMark));
    float ao = mix(0.5, 1.0, smoothstep(0.3, 0.82, vLocal.y)) * (0.6 + 0.4 * tuft);
    col = shadeCreature(alb, N, vWorld, ao, 1.0, 0.07, 0.0);
    vec3 V = normalize(cameraPosition - vWorld);
    float edge = 1.0 - clamp(dot(N, V), 0.0, 1.0);
    float back = pow(max(dot(-V, uSunDir), 0.0), 1.5);
    float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
    col += uSunColor * alb * sun * back * pow(edge, 2.0) * (0.7 + 0.7 * tuft) * (0.7 + 0.6 * curl);
  } else if (mat == ${EYE_MAT}) {
    col = shadeCreature(uEye, N, vWorld, 1.0, 0.0, 0.0, 0.0) + uSunColor * catchlight(N, vWorld) * 0.9;
  } else {
    float grain = vnoise(vLocal.xy * 40.0 + vLocal.z * 13.0);
    vec3 alb = uSkin * (0.9 + 0.2 * grain) * (1.0 - 0.45 * vMat.y);
    float thin = mat == ${EAR_MAT} ? 0.9 : 0.0;
    col = shadeCreature(alb, N, vWorld, 1.0, 0.55, thin, 0.0);
  }
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

interface Tuft {
  dir: THREE.Vector3;
  radius: number;
}

/** Tufts spread evenly over a sphere, jittered in place and size. */
function tufts(count: number, radius: number, seed: number): Tuft[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996 + rand() * 0.7;
    const dir = new THREE.Vector3(Math.cos(a) * r, y + (rand() - 0.5) * 0.15, Math.sin(a) * r).normalize();
    return { dir, radius: radius * (0.8 + rand() * 0.4) };
  });
}

/** How high the fleece bulges over a unit-sphere point, 0..1: round domes that meet in creases. */
function tuftHeight(list: Tuft[]): (u: THREE.Vector3) => number {
  return (u) => {
    let h = 0;
    for (const { dir, radius } of list) {
      const t = 1 - Math.acos(Math.min(1, u.dot(dir))) / radius;
      if (t > 0) h = Math.max(h, Math.sqrt(t * (2 - t)));
    }
    return h;
  };
}

function fleece(spec: Omit<BlobSpec, 'mat' | 'shape' | 'blend'>, count: number, radius: number, depth: number, seed: number): BlobSpec {
  const height = tuftHeight(tufts(count, radius, seed));
  return {
    ...spec,
    mat: FLEECE,
    shape: (u) => {
      const belly = 0.4 + 0.6 * smoothstep(-0.95, -0.4, u.y);
      u.multiplyScalar(1 + depth * height(u) * belly);
    },
    blend: height,
  };
}

function sheepGeometry(): THREE.BufferGeometry {
  const taper = (u: THREE.Vector3) => {
    const k = u.y < 0 ? 1 + 0.2 * u.y : 1;
    u.x *= k;
    u.z *= k;
  };
  const hoof = (u: THREE.Vector3) => smoothstep(-0.7, -0.92, u.y);
  const front: BlobSpec = { part: FRONT_L, mat: SKIN, at: [0.19, 0.42, 0.32], offset: [0, -0.21, 0], size: [0.052, 0.235, 0.058], shape: taper, blend: hoof };
  const hind: BlobSpec = { ...front, part: HIND_L, at: [0.19, 0.42, -0.36], size: [0.056, 0.235, 0.064] };
  const hindCuff = fleece({ part: HIND_L, at: [0.19, 0.42, -0.36], offset: [0, -0.02, -0.01], size: [0.085, 0.1, 0.095], detail: 2 }, 8, 0.8, 0.2, 6);
  const eye: BlobSpec = { part: EYE, mat: EYE_MAT, at: [0.106, 0.885, 0.675], size: [0.032, 0.034, 0.028], detail: 1 };
  const ear: BlobSpec = {
    part: EAR_L,
    mat: EAR_MAT,
    at: [0.11, 0.9, 0.58],
    offset: [0.095, 0, 0],
    size: [0.1, 0.03, 0.052],
    rot: [0, 0.3, -0.38],
    detail: 2,
    shape: (u) => {
      if (u.x < 0) u.z *= 0.65 + 0.35 * (1 + u.x);
    },
  };
  return merge(
    [
      fleece({ part: BODY, at: [0, 0.64, -0.04], size: [0.39, 0.33, 0.55], detail: 4 }, 32, 0.4, 0.24, 1),
      fleece({ part: NECK, at: [0, 0.77, 0.47], size: [0.19, 0.18, 0.25], rot: [-0.84, 0, 0], detail: 3 }, 14, 0.55, 0.2, 2),
      fleece({ part: HEAD, at: [0, 0.96, 0.565], size: [0.14, 0.085, 0.12], detail: 2 }, 7, 0.8, 0.25, 3),
      { part: HEAD, mat: SKIN, at: [0, 0.85, 0.635], size: [0.135, 0.145, 0.18], rot: [0.55, 0, 0], detail: 3 },
      { part: MUZZLE, mat: SKIN, at: [0, 0.76, 0.735], size: [0.095, 0.09, 0.115], rot: [0.75, 0, 0], detail: 2 },
      eye,
      mirrored(eye, EYE),
      ear,
      mirrored(ear, EAR_R),
      fleece({ part: TAIL, at: [0, 0.75, -0.6], offset: [0, -0.1, -0.03], size: [0.075, 0.12, 0.06], detail: 2 }, 6, 0.9, 0.15, 4),
      front,
      mirrored(front, FRONT_R),
      hind,
      mirrored(hind, HIND_R),
      hindCuff,
      mirrored(hindCuff, HIND_R),
    ].map((spec) => blob(spec as BlobSpec)),
  );
}

type Activity = 'graze' | 'look' | 'walk' | 'trot' | 'rest' | 'pronk' | 'suckle';

interface Flock {
  rand: Rng;
  /** The field the flock lives in; they never leave it. */
  kind: number;
  x: number;
  z: number;
  goalX: number;
  goalZ: number;
  nextGoal: number;
  members: Member[];
  alarm: number;
  /** Seconds before a gust can make the flock bolt again; it only runs down once the wind has dropped. */
  bolted: number;
  wind: number;
  windX: number;
  windZ: number;
  nextBleat: number;
  woken: boolean;
}

interface Pronk {
  t: number;
  prep: number;
  duration: number;
  height: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  twist: number;
}

interface Member {
  flock: Flock;
  mother: Member | null;
  lamb: boolean;
  rand: Rng;
  seed: number;
  size: number;
  fleece: THREE.Color;
  mark: THREE.Color;
  markPlace: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  activity: Activity;
  timer: number;
  moving: boolean;
  goalX: number;
  goalZ: number;
  pace: number;
  then: Activity | null;
  stepIn: number;
  lookX: number;
  lookZ: number;
  lookUp: boolean;
  /** Following the child with its eyes. */
  watching: boolean;
  tucked: boolean;
  tuckSide: number;
  wary: number;
  hops: number;
  hop: Pronk | null;
  phase: number;
  stride: number;
  trot: number;
  bob: number;
  hopY: number;
  neck: number;
  nod: number;
  headYaw: number;
  headYawGoal: number;
  chew: number;
  blink: number;
  lie: number;
  pitch: number;
  roll: number;
  splay: number;
  shake: number;
  shakePhase: number;
  earL: Spring;
  earR: Spring;
  tail: Spring;
  squash: Spring;
  appear: Spring;
  nextFidget: number;
  nextBlink: number;
  bleatIn: number;
  bleating: number;
  sinceBleat: number;
  /** How dark it must be before this one lies down for the night. */
  sleepy: number;
  asleep: boolean;
  wakeDelay: number;
}

const FLEECES = ['#eee4cf', '#f1e9d8', '#e7dbc2', '#f3ede0', '#e9dfca'];
const LAMB_FLEECES = ['#faf6ec', '#f8f3e8', '#fbf8f1'];
const RADDLES = ['#2c56b8', '#b3262b'];
/** Ordinary pasture: grazed fields, not hay meadows or rushes (see `grassHeightAt`). */
const GRAZING = [0.25, 0.84];
const WINDY = 5.5;
const TAU = Math.PI * 2;

/** Sheep graze the walled pastures in loose flocks, lambs at heel; wind and the child move them about. */
export class Sheep {
  readonly mesh: THREE.Mesh;
  private readonly instances: Instances;
  private readonly flocks: Flock[] = [];
  private count = 0;
  private readonly field: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 };
  private readonly lastWalker = new THREE.Vector3();
  private walkerSeen = false;
  private walkerSpeed = 0;
  private readonly voiceAt = new THREE.Vector3();

  constructor(
    private readonly habitat: Habitat,
    capacity = 40,
  ) {
    this.instances = new Instances(sheepGeometry(), capacity, ['iPos', 'iBody', 'iHead', 'iLimb', 'iFace', 'iLook', 'iMark']);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...atmo.uniforms,
        uNudge: { value: 1.6 },
        uSkin: { value: new THREE.Color('#2a2320') },
        uEye: { value: new THREE.Color('#0c0807') },
      },
    });
    this.mesh = new THREE.Mesh(this.instances.geometry, material);
    this.mesh.frustumCulled = false;
  }

  /** Open pasture well inside a grazing field, where a flock can live. */
  pasture(x: number, z: number): boolean {
    const f = fieldAt(x, z, this.field);
    return f.presence >= 0.5 && f.kind > GRAZING[0] && f.kind < GRAZING[1] && f.edge > 5 && this.habitat.meadow(x, z);
  }

  /** How much room a flock has at (x, z): the distance to the field's edge, capped. */
  room(x: number, z: number): number {
    return Math.min(fieldAt(x, z, this.field).edge, 12) / 4;
  }

  /** A flock of `count`, about a third of them lambs, grazing the field around (x, z). */
  addFlock(x: number, z: number, count: number, seed: number): void {
    const rand = mulberry32(seed);
    const flock: Flock = {
      rand,
      kind: fieldAt(x, z, this.field).kind,
      x,
      z,
      goalX: x,
      goalZ: z,
      nextGoal: range(rand, 20, 40),
      members: [],
      alarm: 0,
      bolted: 0,
      wind: 0,
      windX: 0,
      windZ: 0,
      nextBleat: range(rand, 8, 20),
      woken: false,
    };
    const lambs = Math.round(count * 0.35);
    const ewes = count - lambs;
    const raddle = new THREE.Color(RADDLES[Math.floor(rand() * RADDLES.length)]);
    const place = rand() < 0.5 ? 1 : 2;
    for (let i = 0; i < count && this.count < this.instances.capacity; i++) {
      const lamb = i >= ewes;
      const mums = flock.members.filter((o) => !o.lamb);
      const mother = lamb ? (mums[(i - ewes) % mums.length] ?? null) : null;
      const spot = mother ? this.findSpot(flock, mother.x, mother.z, 0.6, 1.6, null) : this.findSpot(flock, x, z, 0, 4.5, null);
      if (!spot) continue;
      const marked = !lamb && rand() < 0.55;
      const m: Member = {
        flock,
        mother,
        lamb,
        rand: mulberry32(Math.floor(rand() * 1e9)),
        seed: rand(),
        size: lamb ? range(rand, 0.55, 0.62) : range(rand, 0.94, 1.06),
        fleece: new THREE.Color(lamb ? LAMB_FLEECES[i % LAMB_FLEECES.length] : FLEECES[Math.floor(rand() * FLEECES.length)]),
        mark: raddle,
        markPlace: marked ? place + rand() * 0.9 : 0,
        x: spot[0],
        y: this.habitat.ground(spot[0], spot[1]),
        z: spot[1],
        yaw: rand() * TAU,
        activity: 'graze',
        timer: range(rand, 2, 8),
        moving: false,
        goalX: spot[0],
        goalZ: spot[1],
        pace: 0.3,
        then: null,
        stepIn: range(rand, 1, 4),
        lookX: 0,
        lookZ: 0,
        lookUp: false,
        watching: false,
        tucked: false,
        tuckSide: rand() < 0.5 ? -1 : 1,
        wary: 0,
        hops: 0,
        hop: null,
        phase: rand() * TAU,
        stride: 0,
        trot: 0,
        bob: 0,
        hopY: 0,
        neck: 1.4,
        nod: 0,
        headYaw: 0,
        headYawGoal: 0,
        chew: 0,
        blink: 0,
        lie: 0,
        pitch: 0,
        roll: 0,
        splay: 0,
        shake: 0,
        shakePhase: 0,
        earL: new Spring(),
        earR: new Spring(),
        tail: new Spring(),
        squash: new Spring(),
        appear: new Spring(),
        nextFidget: range(rand, 0.5, 3),
        nextBlink: range(rand, 1, 5),
        bleatIn: Infinity,
        bleating: 0,
        sinceBleat: Infinity,
        sleepy: range(rand, 0.3, 0.75),
        asleep: true,
        wakeDelay: range(rand, 0.3, 3),
      };
      m.squash.value = 1;
      flock.members.push(m);
      this.count++;
    }
    if (flock.members.length) this.flocks.push(flock);
  }

  private allowed(f: Flock, x: number, z: number, margin = 1.5): boolean {
    const s = fieldAt(x, z, this.field);
    return s.kind === f.kind && s.edge > margin && this.habitat.meadow(x, z);
  }

  private crowded(f: Flock, x: number, z: number, self: Member | null): boolean {
    const gap = self?.lamb ? 0.8 : 1.3;
    return f.members.some((o) => o !== self && Math.hypot(o.x - x, o.z - z) < gap);
  }

  private findSpot(f: Flock, x: number, z: number, min: number, max: number, self: Member | null, margin = 1.5): [number, number] | null {
    for (let i = 0; i < 14; i++) {
      const a = f.rand() * TAU;
      const d = min + (max - min) * Math.sqrt(f.rand());
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (this.allowed(f, px, pz, margin) && !this.crowded(f, px, pz, self)) return [px, pz];
    }
    return null;
  }

  update(dt: number, time: number, s: Stimuli): void {
    const walker = s.walker;
    const moved = walker && this.walkerSeen ? Math.hypot(walker.x - this.lastWalker.x, walker.z - this.lastWalker.z) / Math.max(dt, 1e-3) : 0;
    this.walkerSpeed = ease(this.walkerSpeed, Math.min(moved, 8), 4, dt);
    this.walkerSeen = walker !== null;
    if (walker) this.lastWalker.copy(walker);
    let drawn = 0;
    for (const f of this.flocks) {
      if (dormant(s, f.x, f.z)) continue;
      this.senseFlock(f, dt, s);
      for (const m of f.members) {
        if (m.asleep) {
          if (s.life(m.x, m.z) < 0.75 || (m.wakeDelay -= dt) > 0) continue;
          this.wake(m, s);
        }
        this.sense(m, dt, s);
        this.behave(m, dt, s);
        this.pose(m, dt, time, s);
        this.voice(m, dt, s);
        this.write(m, drawn++);
      }
    }
    this.instances.commit(drawn);
  }

  /** Blooms out of the grass with a soft swell and a shake of the fleece. */
  private wake(m: Member, s: Stimuli): void {
    m.asleep = false;
    m.appear.value = 0.08;
    m.appear.velocity = 0;
    m.shake = 1;
    m.shakePhase = 0;
    m.earL.velocity = 9;
    m.earR.velocity = -7;
    m.neck = 0;
    const a = m.yaw + (m.rand() - 0.5) * 2.4;
    this.lookAt(m, m.x + Math.sin(a) * 10, m.z + Math.cos(a) * 10, range(m.rand, 1.5, 3), false);
    const f = m.flock;
    if (!f.woken) {
      f.woken = true;
      if (f.rand() < 0.6) m.bleatIn = range(f.rand, 0.6, 1.4);
    }
    if (s.night > m.sleepy) this.bed(m, true);
  }

  private senseFlock(f: Flock, dt: number, s: Stimuli): void {
    const w = s.wind.sample(f.x, f.z, s.sample);
    const speed = Math.hypot(w.x, w.z);
    const calm = f.wind <= WINDY;
    f.wind = ease(f.wind, speed, speed > f.wind ? 0.9 : 0.35, dt);
    if (calm && f.wind > WINDY) for (const m of f.members) if (m.activity !== 'trot' && !m.tucked) m.timer = Math.min(m.timer, range(f.rand, 0, 1.5));
    f.windX = ease(f.windX, w.x, 2, dt);
    f.windZ = ease(f.windZ, w.z, 2, dt);
    f.alarm = Math.max(0, f.alarm - dt);
    if (f.wind < WINDY) f.bolted = Math.max(0, f.bolted - dt);
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const m of f.members) {
      if (m.asleep) continue;
      sx += m.x;
      sz += m.z;
      n++;
    }
    if (n) {
      f.x = ease(f.x, sx / n, 2, dt);
      f.z = ease(f.z, sz / n, 2, dt);
    }
    f.nextGoal -= dt;
    if (f.nextGoal <= 0) {
      f.nextGoal = range(f.rand, 25, 50);
      const spot = this.findSpot(f, f.x, f.z, 3, 10, null, 5);
      if (spot) [f.goalX, f.goalZ] = spot;
    }
    f.nextBleat -= dt;
    if (f.nextBleat <= 0) {
      f.nextBleat = range(f.rand, 16, 42);
      const awake = f.members.filter((m) => !m.asleep && !m.tucked);
      const m = awake[Math.floor(f.rand() * awake.length)];
      if (m && s.night < 0.5 && f.alarm <= 0) {
        m.bleatIn = 0;
        this.answer(m);
      }
    }
  }

  /** A ewe calls back to her lamb, and a lamb to its mother. */
  private answer(m: Member): void {
    const kin = m.mother ?? m.flock.members.find((o) => o.mother === m);
    if (kin && !kin.asleep && !kin.tucked && m.flock.rand() < 0.7) kin.bleatIn = range(m.flock.rand, 0.7, 1.3);
  }

  private sense(m: Member, dt: number, s: Stimuli): void {
    const f = m.flock;
    const w = s.wind.sample(m.x, m.z, s.sample);
    m.wary = Math.max(0, m.wary - dt);
    if (w.energy > 0.3 && f.bolted <= 0 && f.alarm < 0.6) {
      const g = s.gustAt;
      const near = g && Math.hypot(g.x - m.x, g.z - m.z) < 18;
      const speed = Math.max(Math.hypot(w.x, w.z), 1e-3);
      this.startle(f, near ? g.x : m.x - (w.x / speed) * 6, near ? g.z : m.z - (w.z / speed) * 6, 1);
      return;
    }
    if (m.activity === 'trot' || m.hop) return;

    const walker = s.walker;
    if (walker) {
      if (m.watching) {
        m.lookX = walker.x;
        m.lookZ = walker.z;
      }
      const d = Math.hypot(walker.x - m.x, walker.z - m.z);
      const close = 3.2 + this.walkerSpeed * 0.45;
      if (d < close && f.alarm <= 0) {
        this.startle(f, walker.x, walker.z, 0.6);
        return;
      }
      if (m.wary <= 0 && d < 7.5 && (m.activity !== 'rest' || d < 5)) {
        this.avoid(m, walker.x, walker.z);
        return;
      }
      if (m.wary <= 0 && d < 16 && m.activity !== 'look' && m.activity !== 'walk' && m.activity !== 'suckle') {
        m.wary = range(m.rand, 3, 7);
        if (m.rand() < 0.75) this.lookAt(m, walker.x, walker.z, range(m.rand, 1.8, 3.5), false, true);
        return;
      }
    }

    const up = s.updraft;
    if (up.strength > 0.05 && m.activity !== 'walk' && m.activity !== 'pronk' && Math.hypot(up.x - m.x, up.z - m.z) < 26) {
      if (m.activity !== 'look' || !m.lookUp) this.lookAt(m, up.x, up.z, 1.6, true);
      m.timer = Math.max(m.timer, 1.2);
      return;
    }

    if (s.night > m.sleepy && m.activity !== 'rest' && m.then !== 'rest' && m.activity !== 'look') this.bed(m, false);
  }

  private lookAt(m: Member, x: number, z: number, time: number, up: boolean, watching = false): void {
    if (m.activity === 'rest') {
      m.tucked = false;
      m.timer = m.timer === Infinity ? time + 2 : Math.max(m.timer, time + 2);
    } else {
      m.activity = 'look';
      m.moving = false;
      m.timer = time;
    }
    m.lookX = x;
    m.lookZ = z;
    m.lookUp = up;
    m.watching = watching;
  }

  /** The whole flock bunches up and trots away from (x, z), then settles and looks back. */
  private startle(f: Flock, fromX: number, fromZ: number, fright: number): void {
    f.alarm = range(f.rand, 1.8, 3) * fright;
    f.bolted = range(f.rand, 5, 8) * fright;
    let ax = f.x - fromX;
    let az = f.z - fromZ;
    const len = Math.hypot(ax, az);
    const wind = Math.max(Math.hypot(f.windX, f.windZ), 1e-3);
    ax = (len > 0.1 ? ax / len : 0) + (f.windX / wind) * 0.4;
    az = (len > 0.1 ? az / len : 0) + (f.windZ / wind) * 0.4;
    const heading = Math.atan2(ax, az);
    let target: [number, number] | null = null;
    for (const turn of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2, -2]) {
      const d = range(f.rand, 6, 9) * (0.6 + 0.4 * fright);
      const tx = f.x + Math.sin(heading + turn) * d;
      const tz = f.z + Math.cos(heading + turn) * d;
      if (this.allowed(f, tx, tz, 3)) {
        target = [tx, tz];
        break;
      }
    }
    const [cx, cz] = target ?? [f.x, f.z];
    f.goalX = cx;
    f.goalZ = cz;
    let caller: Member | null = null;
    for (const m of f.members) {
      if (m.asleep) continue;
      let gx = cx + (m.x - f.x) * 0.35 + (m.rand() - 0.5) * 0.8;
      let gz = cz + (m.z - f.z) * 0.35 + (m.rand() - 0.5) * 0.8;
      if (m.mother) {
        gx = gx * 0.5 + (cx + (m.mother.x - f.x) * 0.35) * 0.5;
        gz = gz * 0.5 + (cz + (m.mother.z - f.z) * 0.35) * 0.5;
      }
      if (!this.allowed(f, gx, gz)) [gx, gz] = [cx, cz];
      m.activity = 'trot';
      m.tucked = false;
      m.hop = null;
      m.hopY = 0;
      m.hops = 0;
      m.then = null;
      this.go(m, gx, gz, range(m.rand, 2.1, 2.6) * (0.7 + 0.3 * fright));
      m.timer = 6;
      m.lookX = fromX;
      m.lookZ = fromZ;
      if (!caller || m.rand() < 0.3) caller = m;
    }
    if (caller && f.rand() < 0.7) caller.bleatIn = range(f.rand, 0.3, 0.8);
  }

  /** Ambles a few steps further from (x, z), keeping a wary distance. */
  private avoid(m: Member, x: number, z: number): void {
    const away = Math.atan2(m.x - x, m.z - z);
    m.wary = range(m.rand, 2, 3.5);
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const d = range(m.rand, 3, 5);
      const tx = m.x + Math.sin(away + turn) * d;
      const tz = m.z + Math.cos(away + turn) * d;
      if (!this.allowed(m.flock, tx, tz)) continue;
      m.activity = 'walk';
      m.tucked = false;
      m.then = null;
      this.go(m, tx, tz, m.lamb ? 1.1 : 0.85);
      m.timer = 10;
      return;
    }
    this.lookAt(m, x, z, 2, false);
  }

  /** Settles down for the night near the others, a lamb against its mother. */
  private bed(m: Member, now: boolean): void {
    const f = m.flock;
    const mum = m.mother;
    const spot = mum ? this.findSpot(f, mum.x, mum.z, 0.7, 1.1, m) : this.findSpot(f, f.x, f.z, 0, 2.5, m);
    if (now || !spot || Math.hypot(spot[0] - m.x, spot[1] - m.z) < 0.5) {
      this.rest(m, true);
      return;
    }
    m.activity = 'walk';
    m.then = 'rest';
    this.go(m, spot[0], spot[1], 0.6);
    m.timer = 20;
  }

  private rest(m: Member, tucked: boolean): void {
    m.activity = 'rest';
    m.moving = false;
    m.then = null;
    m.tucked = tucked;
    m.timer = tucked ? Infinity : range(m.rand, 12, 24);
  }

  private go(m: Member, x: number, z: number, pace: number): void {
    m.goalX = x;
    m.goalZ = z;
    m.pace = pace;
    m.moving = true;
  }

  private choose(m: Member, s: Stimuli): void {
    const f = m.flock;
    const rand = m.rand;
    m.moving = false;
    m.lookUp = false;
    m.watching = false;
    if (s.night > m.sleepy) {
      if (m.activity === 'rest') this.rest(m, true);
      else this.bed(m, false);
      return;
    }
    m.tucked = false;
    if (m.lamb) {
      this.chooseLamb(m);
      return;
    }
    const windy = f.wind > WINDY;
    const spread = windy ? 1.8 : 4.5;
    const cx = f.x + (f.goalX - f.x) * 0.4;
    const cz = f.z + (f.goalZ - f.z) * 0.4;
    if (Math.hypot(m.x - cx, m.z - cz) > spread + 1 || rand() < 0.2) {
      const spot = this.findSpot(f, cx, cz, 0, spread, m);
      if (spot) {
        m.activity = 'walk';
        this.go(m, spot[0], spot[1], range(rand, 0.5, 0.7));
        m.timer = 14;
        return;
      }
    }
    const roll = rand();
    if (roll < 0.62 || windy) {
      m.activity = 'graze';
      m.timer = range(rand, 5, 14);
      m.stepIn = range(rand, 1, 4);
    } else if (roll < 0.92) {
      const a = m.yaw + (rand() - 0.5) * 3;
      this.lookAt(m, m.x + Math.sin(a) * 10, m.z + Math.cos(a) * 10, range(rand, 2, 4), false);
    } else {
      this.rest(m, false);
    }
    if (rand() < 0.08) m.shake = 0.7;
  }

  /** Lambs stay at their mother's side: grazing, napping, suckling and now and then springing into the air. */
  private chooseLamb(m: Member): void {
    const rand = m.rand;
    const mum = m.mother;
    const d = mum ? Math.hypot(mum.x - m.x, mum.z - m.z) : 0;
    if (mum && d > 3) {
      const spot = this.findSpot(m.flock, mum.x, mum.z, 0.7, 1.6, m) ?? [mum.x, mum.z];
      m.activity = d > 6 ? 'trot' : 'walk';
      this.go(m, spot[0], spot[1], d > 6 ? 2.2 : 1.1);
      m.timer = 10;
      if (d > 6 && m.sinceBleat > 4) m.bleatIn = 0.2;
      return;
    }
    const roll = rand();
    if (roll < 0.2) {
      this.pronk(m, 1 + Math.floor(rand() * 3));
    } else if (roll < 0.3 && mum && !mum.moving && mum.activity !== 'rest') {
      m.activity = 'suckle';
      m.timer = range(rand, 4, 8);
      m.pace = 0.7;
    } else if (roll < 0.4 && mum) {
      const spot = this.findSpot(m.flock, mum.x, mum.z, 2.5, 4.5, m);
      if (spot) {
        m.activity = 'trot';
        m.then = 'pronk';
        this.go(m, spot[0], spot[1], range(rand, 1.8, 2.4));
        m.timer = 6;
        return;
      }
      this.pronk(m, 2);
    } else if (roll < 0.62) {
      m.activity = 'graze';
      m.timer = range(rand, 3, 7);
      m.stepIn = range(rand, 1, 3);
    } else if (roll < 0.82) {
      const a = m.yaw + (rand() - 0.5) * 3;
      this.lookAt(m, m.x + Math.sin(a) * 10, m.z + Math.cos(a) * 10, range(rand, 1.5, 3), false);
    } else if (roll < 0.9) {
      this.rest(m, rand() < 0.5);
      m.timer = range(rand, 8, 16);
    } else {
      const spot = mum ? this.findSpot(m.flock, mum.x, mum.z, 0.8, 2.2, m) : null;
      if (spot) {
        m.activity = 'walk';
        this.go(m, spot[0], spot[1], 0.9);
        m.timer = 8;
      } else {
        m.activity = 'graze';
        m.timer = range(rand, 2, 4);
      }
    }
  }

  private pronk(m: Member, hops: number): void {
    m.activity = 'pronk';
    m.moving = false;
    m.hops = hops;
    m.timer = 10;
    m.yaw += (m.rand() - 0.5) * 1.2;
    m.hop = this.launch(m);
  }

  private launch(m: Member): Pronk {
    const d = range(m.rand, 0.2, 0.45);
    const a = m.yaw + (m.rand() - 0.5) * 0.8;
    const tx = m.x + Math.sin(a) * d;
    const tz = m.z + Math.cos(a) * d;
    const ok = this.allowed(m.flock, tx, tz);
    return {
      t: 0,
      prep: 0.1,
      duration: range(m.rand, 0.34, 0.42),
      height: range(m.rand, 0.35, 0.5),
      fromX: m.x,
      fromZ: m.z,
      toX: ok ? tx : m.x,
      toZ: ok ? tz : m.z,
      twist: (m.rand() < 0.5 ? -1 : 1) * range(m.rand, 0.2, 0.5),
    };
  }

  private behave(m: Member, dt: number, s: Stimuli): void {
    const f = m.flock;
    if (m.hop) {
      this.flyPronk(m, m.hop, dt);
      return;
    }
    m.timer -= dt;
    const before = m.x;
    const beforeZ = m.z;
    const rising = m.lie > 0.25 && m.activity !== 'rest';

    if (m.activity === 'suckle' && m.mother) {
      const mum = m.mother;
      const flank = mum.yaw + m.tuckSide * 1.2;
      m.goalX = mum.x + Math.sin(flank) * 0.42 * mum.size - Math.sin(mum.yaw) * 0.15;
      m.goalZ = mum.z + Math.cos(flank) * 0.42 * mum.size - Math.cos(mum.yaw) * 0.15;
      if (mum.activity === 'rest' || mum.activity === 'trot' || Math.hypot(m.goalX - m.x, m.goalZ - m.z) > 3) m.timer = Math.min(m.timer, 0);
      if (Math.hypot(m.goalX - m.x, m.goalZ - m.z) > 0.12) this.travel(m, dt, true);
      else m.yaw = easeAngle(m.yaw, mum.yaw + Math.PI - m.tuckSide * 0.5, 4, dt);
    } else if (m.moving && !rising) {
      if (this.travel(m, dt, false)) this.arrive(m, s);
    } else if (m.activity === 'graze') {
      m.stepIn -= dt;
      if (m.stepIn <= 0) {
        m.stepIn = range(m.rand, 2, 6);
        const a = m.yaw + (m.rand() - 0.5) * 1.2;
        const d = range(m.rand, 0.25, 0.7);
        const tx = m.x + Math.sin(a) * d;
        const tz = m.z + Math.cos(a) * d;
        if (this.allowed(f, tx, tz) && !this.crowded(f, tx, tz, m)) this.go(m, tx, tz, 0.3);
      }
    }

    if (f.wind > WINDY && (m.activity === 'graze' || m.activity === 'look') && !m.moving) {
      m.yaw = easeAngle(m.yaw, Math.atan2(f.windX, f.windZ), 1.2, dt);
    } else if (m.activity === 'look') {
      const want = Math.atan2(m.lookX - m.x, m.lookZ - m.z);
      const off = wrapAngle(want - m.yaw);
      if (Math.abs(off) > 1.0) m.yaw = easeAngle(m.yaw, want - Math.sign(off) * 0.8, 1.6, dt);
    }
    this.separate(m, dt);
    this.stepGait(m, Math.hypot(m.x - before, m.z - beforeZ), dt);
    m.y = this.habitat.ground(m.x, m.z);

    if (m.timer <= 0) {
      if (m.activity === 'trot') this.settle(m);
      else this.choose(m, s);
    }
  }

  /** Walks forward along its heading, turning toward the goal; true once there or blocked. */
  private travel(m: Member, dt: number, snug: boolean): boolean {
    const dx = m.goalX - m.x;
    const dz = m.goalZ - m.z;
    const dist = Math.hypot(dx, dz);
    if (dist < (snug ? 0.05 : 0.15)) return true;
    const want = Math.atan2(dx, dz);
    m.yaw = easeAngle(m.yaw, want, m.pace > 1.5 ? 6 : 3.5, dt);
    const align = Math.max(0, Math.cos(wrapAngle(want - m.yaw)));
    const step = Math.min(dist, m.pace * (0.25 + 0.75 * align) * dt);
    const nx = m.x + Math.sin(m.yaw) * step;
    const nz = m.z + Math.cos(m.yaw) * step;
    if (!this.allowed(m.flock, nx, nz)) return true;
    m.x = nx;
    m.z = nz;
    return false;
  }

  private arrive(m: Member, s: Stimuli): void {
    m.moving = false;
    const next = m.then;
    m.then = null;
    if (next === 'rest') this.rest(m, true);
    else if (next === 'pronk') this.pronk(m, 2 + Math.floor(m.rand() * 2));
    else if (m.activity === 'trot') this.settle(m);
    else if (m.activity === 'walk') this.choose(m, s);
  }

  /** After a fright: stop, look back at what it was, and maybe (for a lamb) a relieved spring. */
  private settle(m: Member): void {
    m.moving = false;
    if (m.lamb && m.rand() < 0.35) {
      this.pronk(m, 1 + Math.floor(m.rand() * 2));
      return;
    }
    this.lookAt(m, m.lookX, m.lookZ, range(m.rand, 1.5, 3), false);
    if (m.rand() < 0.3) m.shake = 0.8;
  }

  private flyPronk(m: Member, h: Pronk, dt: number): void {
    if (h.prep > 0) {
      h.prep -= dt;
      m.squash.step(0.82, 400, 22, dt);
      if (h.prep <= 0) {
        m.squash.velocity += 5;
        m.tail.velocity += 10;
      }
      return;
    }
    h.t = Math.min(1, h.t + dt / h.duration);
    const t = h.t;
    m.x = h.fromX + (h.toX - h.fromX) * t;
    m.z = h.fromZ + (h.toZ - h.fromZ) * t;
    m.y = this.habitat.ground(m.x, m.z);
    m.hopY = h.height * 4 * t * (1 - t);
    m.yaw += h.twist * Math.PI * Math.cos(Math.PI * t) * (dt / h.duration);
    if (t < 1) return;
    m.hop = null;
    m.hopY = 0;
    m.squash.velocity -= 4;
    m.earL.velocity += 6;
    m.earR.velocity -= 6;
    if (--m.hops > 0) {
      m.hop = this.launch(m);
      m.hop.prep = 0.05;
    } else {
      m.activity = 'look';
      m.timer = range(m.rand, 0.8, 1.8);
      const a = m.yaw + (m.rand() - 0.5) * 2;
      m.lookX = m.x + Math.sin(a) * 8;
      m.lookZ = m.z + Math.cos(a) * 8;
      m.lookUp = false;
    }
  }

  /** Keeps a little room between flock-mates, a lamb allowed close to its mother. */
  private separate(m: Member, dt: number): void {
    if (m.lie > 0.3 || m.activity === 'suckle') return;
    for (const o of m.flock.members) {
      if (o === m || o.asleep) continue;
      const kin = o === m.mother || o.mother === m;
      const gap = kin ? 0.55 : 0.62 * (m.size + o.size);
      const dx = m.x - o.x;
      const dz = m.z - o.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= gap * gap || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (gap - d) * Math.min(1, dt * 3) * (o.lie > 0.3 || o.activity === 'suckle' ? 1 : 0.5);
      const nx = m.x + (dx / d) * push;
      const nz = m.z + (dz / d) * push;
      if (this.allowed(m.flock, nx, nz)) {
        m.x = nx;
        m.z = nz;
      }
    }
  }

  private stepGait(m: Member, moved: number, dt: number): void {
    const speed = moved / Math.max(dt, 1e-4);
    m.trot = ease(m.trot, speed > 1.3 ? 1 : 0, 5, dt);
    const stride = speed > 0.02 ? 0.9 + 0.45 * m.trot : 0;
    m.stride = ease(m.stride, stride, stride > m.stride ? 9 : 5, dt);
    const length = m.size * (0.6 + 0.3 * m.trot);
    m.phase = (m.phase + (moved / length) * TAU) % TAU;
    m.bob = Math.abs(Math.sin(m.phase)) * 0.045 * m.trot * m.size;
  }

  private pose(m: Member, dt: number, time: number, s: Stimuli): void {
    const rand = m.rand;
    const act = m.activity;
    const f = m.flock;
    const windy = f.wind > WINDY && act !== 'trot';
    const hop = m.hop;
    const airborne = hop !== null && hop.prep <= 0;

    let neck = 0.05;
    let nod = 0.02;
    let ear = 0;
    let lie = 0;
    let yawGoal = m.headYawGoal;
    let chewing = false;
    let tailWag = 0;
    if (act === 'graze') {
      neck = m.moving ? 1.15 : 1.45;
      nod = Math.max(0, Math.sin(time * 1.9 + m.seed * 17)) * 0.12;
      chewing = true;
      ear = -0.1;
    } else if (act === 'look') {
      neck = m.lookUp ? -0.4 : -0.08;
      nod = m.lookUp ? -0.6 : -0.1;
      ear = 0.32;
      chewing = !m.lookUp && m.seed > 0.4;
      yawGoal = THREE.MathUtils.clamp(wrapAngle(Math.atan2(m.lookX - m.x, m.lookZ - m.z) - m.yaw), -1.1, 1.1);
    } else if (act === 'walk') {
      neck = 0.3;
      nod = 0.12;
      yawGoal = 0;
    } else if (act === 'trot') {
      neck = -0.18;
      nod = -0.08;
      ear = -0.35;
      yawGoal = 0;
    } else if (act === 'rest') {
      lie = 1;
      if (m.tucked) {
        neck = 0.6;
        nod = 0.45;
        yawGoal = m.tuckSide * 1.3;
        ear = -0.45;
      } else {
        neck = m.lookUp ? -0.3 : -0.02;
        nod = m.lookUp ? -0.55 : 0.05;
        chewing = !m.lookUp;
        if (m.watching || m.lookUp) yawGoal = THREE.MathUtils.clamp(wrapAngle(Math.atan2(m.lookX - m.x, m.lookZ - m.z) - m.yaw), -1.2, 1.2);
      }
    } else if (act === 'pronk') {
      neck = -0.3;
      nod = -0.2;
      ear = 0.4;
      yawGoal = 0;
    } else if (act === 'suckle') {
      neck = 0.3;
      nod = -0.55;
      yawGoal = 0;
      tailWag = Math.sin(time * 19 + m.seed * 9) * 0.7;
    }
    if (windy) {
      ear = -0.6;
      if (act === 'graze' || act === 'look') neck = Math.max(neck, 0.5);
    }
    if (m.bleating > 0) {
      neck -= 0.25;
      nod -= 0.3;
    }

    m.lie = ease(m.lie, lie, lie > m.lie ? 1.3 : 2, dt);
    m.neck = ease(m.neck, neck, act === 'trot' ? 6 : 3, dt);
    m.nod = ease(m.nod, nod, 4, dt);

    m.nextFidget -= dt;
    if (m.nextFidget <= 0) {
      m.nextFidget = range(rand, 0.8, 3.5);
      const roll = rand();
      if (roll < 0.45) (rand() < 0.5 ? m.earL : m.earR).velocity += (rand() < 0.5 ? -1 : 1) * range(rand, 5, 10);
      else if (roll < 0.8) m.headYawGoal = (rand() - 0.5) * (act === 'graze' ? 0.7 : 1.2);
      else m.tail.velocity += (rand() < 0.5 ? -1 : 1) * (m.lamb ? 14 : 8);
    }
    m.headYaw = ease(m.headYaw, yawGoal, act === 'look' ? 3 : 2.5, dt);

    m.nextBlink -= dt;
    if (m.nextBlink <= 0) {
      m.nextBlink = range(rand, 1.5, 6);
      m.blink = 1;
    }
    m.blink = m.tucked && m.lie > 0.8 ? 1 : Math.max(0, m.blink - dt * 7);
    m.bleating = Math.max(0, m.bleating - dt);
    const mouth = m.bleating > 0 ? 0.8 * Math.min(1, m.bleating * 6) : 0;
    m.chew = chewing ? Math.sin(time * 11 + m.seed * 7) * 0.5 + 0.5 : Math.max(mouth, ease(m.chew, 0, 10, dt));

    const lean = f.wind * 0.02;
    const flutter = Math.sin(time * 8 + m.seed * 30) * Math.min(f.wind, 14) * 0.012;
    const flap = m.shake * Math.sin(m.shakePhase * 1.3) * 0.6;
    m.earL.step(ear - lean + flutter + flap, 80, 7, dt);
    m.earR.step(ear - lean - flutter * 0.7 - flap, 85, 7.5, dt);
    m.tail.step(tailWag + (windy ? 0.2 * Math.sin(time * 9 + m.seed) : 0), m.lamb ? 120 : 160, m.lamb ? 5 : 8, dt);

    m.shake = Math.max(0, m.shake - dt * 1.8);
    m.shakePhase += dt * TAU * 8.5;
    const shaking = m.shake * Math.min(1, m.shake * 3);
    m.roll = shaking * 0.2 * Math.sin(m.shakePhase) + (airborne ? hop.twist * 0.5 * Math.sin(Math.PI * hop.t) : 0);

    m.splay = ease(m.splay, airborne ? 1 : 0, airborne ? 18 : 12, dt);
    if (!hop || hop.prep <= 0) m.squash.step(1, 240, 13, dt);
    m.appear.step(1, 42, 8.5, dt);

    const ahead = 0.5 * m.size;
    const hx = Math.sin(m.yaw) * ahead;
    const hz = Math.cos(m.yaw) * ahead;
    const slope = Math.atan((this.habitat.ground(m.x - hx, m.z - hz) - this.habitat.ground(m.x + hx, m.z + hz)) / (2 * ahead));
    const kneel = 4 * m.lie * (1 - m.lie) * 0.3;
    const arch = airborne ? -0.12 * Math.sin(Math.PI * hop.t) : 0;
    m.pitch = ease(m.pitch, slope * 0.8 + kneel + arch, 8, dt);
  }

  private voice(m: Member, dt: number, s: Stimuli): void {
    m.sinceBleat += dt;
    if (m.bleatIn === Infinity) return;
    m.bleatIn -= dt;
    if (m.bleatIn > 0) return;
    m.bleatIn = Infinity;
    const at = this.voiceAt.set(m.x, m.y + 0.8 * m.size, m.z);
    const d = at.distanceTo(s.camera.position);
    m.bleating = m.lamb ? 0.4 : 0.7;
    m.sinceBleat = 0;
    if (d < 160) s.voices.baa(screenPan(s.camera, at), 1 / (1 + d / 30), m.lamb);
  }

  private write(m: Member, i: number): void {
    const inst = this.instances;
    inst.set(0, i, m.x, m.y + m.bob + m.hopY, m.z, m.yaw);
    inst.set(1, i, m.size * Math.max(0, m.appear.value), m.pitch, m.roll, m.lie);
    inst.set(2, i, m.neck, m.headYaw, m.nod, m.chew);
    inst.set(3, i, m.phase, m.stride, m.splay, m.squash.value);
    inst.set(4, i, m.earL.value, m.earR.value, m.tail.value, m.blink);
    inst.set(5, i, m.fleece.r, m.fleece.g, m.fleece.b, m.lamb ? 1 : 0);
    inst.set(6, i, m.mark.r, m.mark.g, m.mark.b, m.markPlace);
  }

  /** Positions and activities, for inspection in `?shot` mode. */
  get state(): { x: number; y: number; z: number; yaw: number; activity: Activity; lamb: boolean; awake: boolean }[] {
    return this.flocks.flatMap((f) =>
      f.members.map((m) => ({ x: m.x, y: m.y, z: m.z, yaw: m.yaw, activity: m.activity, lamb: m.lamb, awake: !m.asleep })),
    );
  }
}

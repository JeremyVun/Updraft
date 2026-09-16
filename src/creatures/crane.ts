import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';
import { CREATURE_GLSL } from './shading';
import { blob, merge, mirrored, type BlobSpec, type V3 } from './shapes';
import { ease, easeAngle, wrapAngle } from './motion';
import type { WindSample } from '../wind/field';

/** How strong an updraft under it has to be before it looks up and opens its wings, and before it goes. */
const LIFT_TO_HOPE = 0.18;
const LIFT_TO_FLY = 0.5;
/** It never climbs further above the ground than this, so a glide can never take it out of the frame. */
const CEILING = 7.5;
/** Nothing it can do keeps it up longer than this. */
const GLIDE_FOR = 9;
/**
 * Built at life size, then nudged up a little so it reads from the camera the game is played at. Only a little:
 * half lost in the grass is how a fledgling that cannot fly is supposed to look.
 */
const SIZE = 1.4;

const BONES = 16;
const [ROOT, BODY, NECK_A, NECK_B, NECK_C, HEAD, WING_L, HAND_L, WING_R, HAND_R, THIGH_L, SHIN_L, FOOT_L, THIGH_R, SHIN_R, FOOT_R] =
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const COAT = 0;
const QUILL = 1;
const BILL = 2;
const SHANK = 3;
const EYE = 4;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform mat4 uBones[${BONES}];
uniform float uNudge;
in float aPart;
in vec2 aMat;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vMat;
out vec3 vDown;
void main() {
  mat4 b = uBones[int(aPart + 0.5)];
  vec4 world = b * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(b) * normal);
  vMat = aMat;
  /** Mottling in rest space, offset per part, so the down does not swim as the colt moves. */
  vDown = position * 27.0 + aPart * 5.3;
  gl_Position = projectionMatrix * nudgedView(vWorld, uNudge);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
uniform float uAir;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vMat;
in vec3 vDown;

/** Linear, and dark: the golden sun here is worth about 2.7, so anything lighter comes out of it cream. */
const vec3 SEPIA = vec3(0.08, 0.042, 0.025);
const vec3 RUST = vec3(0.19, 0.088, 0.04);
const vec3 CINNAMON = vec3(0.285, 0.185, 0.095);
const vec3 CREAM = vec3(0.4, 0.37, 0.285);
const vec3 HORN = vec3(0.34, 0.3, 0.21);
const vec3 TIP = vec3(0.085, 0.072, 0.062);
const vec3 LEG = vec3(0.055, 0.05, 0.047);
const vec3 IRIS = vec3(0.004, 0.004, 0.005);

/** Rusty over the back and crown, cinnamon on the flanks, cream under the throat and belly. */
vec3 coat(float k) {
  vec3 c = mix(SEPIA, RUST, smoothstep(0.0, 0.3, k));
  c = mix(c, CINNAMON, smoothstep(0.26, 0.62, k));
  return mix(c, CREAM, smoothstep(0.6, 1.0, k));
}

void main() {
  vec3 N = normalize(vNormal);
  int m = int(vMat.x + 0.5);
  float k = vMat.y;
  float mottle = 0.89 + 0.2 * vnoise(vDown.xz + vDown.y);
  vec3 alb = coat(k) * mottle;
  float fuzz = 0.18;
  float thin = 0.12;
  if (m == ${QUILL}) {
    fuzz = 0.22;
    thin = 0.55;
  } else if (m == ${BILL}) {
    alb = mix(HORN, TIP, k);
    fuzz = 0.05;
    thin = 0.3;
  } else if (m == ${SHANK}) {
    alb = LEG;
    fuzz = 0.04;
    thin = 0.04;
  } else if (m == ${EYE}) {
    alb = IRIS;
    fuzz = 0.0;
    thin = 0.0;
  }
  vec3 col = shadeCreature(alb, N, vWorld, 0.82, fuzz, thin, uAir);
  /** In the dark the eyes are all there is of it: two catchlights out of nothing, the moment light reaches it. */
  if (m == ${EYE}) col += (uSunColor * 0.9 + vec3(2.4, 1.3, 0.55) * min(1.0, uEmberLight.w)) * catchlight(N, vWorld);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * A colt is all legs and neck with a small body: the bare shank is a third of its height, the neck carries a head
 * half the width of the body, and the bill is a straight dagger longer than the skull.
 */
function craneGeometry(): THREE.BufferGeometry {
  const at: V3 = [0, 0, 0];
  const specs: BlobSpec[] = [];
  const pair = (spec: BlobSpec, right: number) => specs.push(spec, mirrored(spec, right));

  specs.push({
    part: BODY,
    mat: COAT,
    at,
    size: [0.058, 0.063, 0.123],
    detail: 3,
    shape: (u) => {
      const back = Math.max(0, -u.z);
      const front = Math.max(0, u.z);
      u.x *= 1 - 0.42 * back * back;
      u.y *= 1 - 0.3 * back * back;
      u.y += back * back * 0.32;
      u.y -= front * front * 0.1;
      if (u.y < 0) u.y *= 1 + 0.12 * front;
    },
    blend: (u) => 0.56 - u.y * 0.33 + Math.max(0, u.z) * 0.08,
  });
  /** Fills the hollow where the neck leaves the shoulders, so the neck grows out of the body. */
  specs.push({
    part: BODY,
    mat: COAT,
    at,
    size: [0.042, 0.042, 0.05],
    offset: [0, 0.022, 0.07],
    blend: (u) => 0.66 - u.y * 0.2,
  });
  specs.push({
    part: BODY,
    mat: COAT,
    at,
    size: [0.028, 0.024, 0.047],
    offset: [0, 0.043, -0.12],
    rot: [0.4, 0, 0],
    shape: (u) => {
      const tip = Math.max(0, -u.z);
      u.x *= 1 - 0.5 * tip;
      u.y *= 1 - 0.45 * tip;
    },
    blend: (u) => 0.42 - u.y * 0.12,
  });
  /** Feathered thighs: the down hangs over the top of the leg, so the bare shank starts halfway down. */
  pair(
    {
      part: BODY,
      mat: COAT,
      at,
      size: [0.024, 0.028, 0.036],
      offset: [0.037, -0.034, -0.016],
      blend: (u) => 0.68 - u.y * 0.1,
    },
    BODY,
  );

  /** Capsules, not beads: a straight-sided tube with rounded caps, overlapping its neighbours end to end. */
  const neck = (part: number, r: number, half: number, rise: number): BlobSpec => ({
    part,
    mat: COAT,
    at,
    size: [r, half, r],
    offset: [0, rise, 0],
    shape: (u) => {
      const s = Math.min(1 / Math.max(Math.sqrt(Math.max(1 - u.y * u.y, 0)), 0.42), 2.2) * (1 - 0.07 * u.y);
      u.x *= s;
      u.z *= s;
    },
    blend: (u) => 0.48 + u.z * 0.3,
  });
  specs.push(neck(NECK_A, 0.0208, 0.056, 0.032), neck(NECK_B, 0.0196, 0.054, 0.031), neck(NECK_C, 0.0184, 0.052, 0.03));

  specs.push({
    part: HEAD,
    mat: COAT,
    at,
    size: [0.029, 0.0295, 0.037],
    offset: [0, 0.008, 0.004],
    detail: 3,
    shape: (u) => {
      u.y -= Math.max(0, u.z) * 0.12;
    },
    blend: (u) => 0.4 - u.y * 0.36 + Math.max(0, u.z) * 0.2,
  });
  specs.push({
    part: HEAD,
    mat: BILL,
    at,
    size: [0.0105, 0.0098, 0.05],
    offset: [0, 0.002, 0.076],
    shape: (u) => {
      const tip = Math.max(0, u.z);
      u.x *= 1 - 0.84 * tip;
      u.y *= 1 - 0.78 * tip;
      u.y -= tip * tip * 0.06;
    },
    blend: (u) => Math.max(0, u.z) ** 2,
  });
  pair(
    { part: HEAD, mat: EYE, at, size: [0.0078, 0.0085, 0.0078], offset: [0.0228, 0.016, 0.0268], detail: 1 },
    HEAD,
  );

  pair(
    {
      part: WING_L,
      mat: QUILL,
      at,
      size: [0.058, 0.0115, 0.054],
      offset: [0.054, 0, -0.008],
      shape: (u) => {
        const s = Math.max(0, u.x);
        u.z *= 1 - 0.24 * s;
        u.y *= 1 - 0.3 * s;
        u.z -= 0.3 * s;
      },
      blend: (u) => 0.68 - Math.max(0, u.x) * 0.24,
    },
    WING_R,
  );
  /** The hand carries the primaries: it folds away at rest and makes the point of the spread wing. */
  pair(
    {
      part: HAND_L,
      mat: QUILL,
      at,
      size: [0.062, 0.0085, 0.045],
      offset: [0.058, 0, -0.017],
      shape: (u) => {
        const s = Math.max(0, u.x);
        u.y *= 1 - 0.6 * s * s;
        u.z *= 1 - 0.42 * s;
        u.z -= 0.6 * s * s;
      },
      blend: (u) => 0.32 - Math.max(0, u.x) * 0.32,
    },
    HAND_R,
  );

  pair(
    {
      part: THIGH_L,
      mat: SHANK,
      at,
      size: [0.0125, 0.072, 0.0125],
      offset: [0, -0.066, 0],
      detail: 1,
      shape: (u) => {
        const s = 0.72 + 0.56 * ((u.y + 1) * 0.5);
        u.x *= s;
        u.z *= s;
      },
    },
    THIGH_R,
  );
  pair({ part: SHIN_L, mat: SHANK, at, size: [0.0135, 0.0135, 0.0135], offset: [0, 0.003, 0], detail: 1 }, SHIN_R);
  pair(
    {
      part: SHIN_L,
      mat: SHANK,
      at,
      size: [0.0102, 0.058, 0.0102],
      offset: [0, -0.055, 0],
      detail: 1,
      shape: (u) => {
        const s = 1 + 0.12 * u.y;
        u.x *= s;
        u.z *= s;
      },
    },
    SHIN_R,
  );
  const toe = (spin: number, reach: number, thick: number): BlobSpec => ({
    part: FOOT_L,
    mat: SHANK,
    at,
    size: [thick, 0.0058, reach],
    offset: [0, -0.004, reach * 0.82],
    rot: [0, spin, 0],
    detail: 1,
    shape: (u) => {
      const tip = Math.max(0, u.z);
      u.x *= 1 - 0.55 * tip;
      u.y *= 1 - 0.4 * tip;
    },
  });
  for (const t of [toe(0, 0.037, 0.008), toe(0.62, 0.032, 0.0072), toe(-0.58, 0.031, 0.0072)]) pair(t, FOOT_R);
  pair(
    { part: FOOT_L, mat: SHANK, at, size: [0.0055, 0.005, 0.014], offset: [0, -0.003, -0.012], detail: 1 },
    FOOT_R,
  );

  return merge(specs.map((spec) => blob(spec)));
}

export type CraneState = 'flying' | 'falling' | 'downed' | 'fallen' | 'carried' | 'hooded' | 'following' | 'gliding' | 'leaving';

/**
 * The crane colt: too young to keep up with its flock, carried and walked and finally flown. The only other
 * character in the story, and like the child it never makes a sound.
 */
export class Crane {
  readonly position = new THREE.Vector3();
  yaw = 0;
  state: CraneState = 'flying';
  /** How close it stays and how often it looks up at the child: only ever rises. */
  bond = 0;
  visible = false;
  private readonly root = new THREE.Object3D();
  private readonly nodes: THREE.Object3D[] = [];
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly bones: THREE.Matrix4[] = [];
  private readonly to = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private stride = 0;
  private flap = 0;
  private flapPhase = 0;
  private settle = 0;
  private lookAt: THREE.Vector3 | null = null;
  private time = 0;
  private glide = 0;
  private fallT = 0;
  private fallFor = 1;
  private readonly fallFrom = new THREE.Vector3();
  private readonly fallTo = new THREE.Vector3();
  private struggle = 0;
  private effort = 0;
  /** Control point that keeps it on the flock's line at first, so you see it drop back out of the V. */
  private readonly fallDrift = new THREE.Vector3();
  private roll = 0;
  private slew = 0;
  /** Vertical speed while it is in the air on the player's updraft. */
  private air = 0;
  private glideT = 0;
  /** How much it is asking to go: an updraft near it makes it look up and half-open its wings. */
  private hope = 0;
  private hopT = 0;
  private landedAt = 0;
  /** How many times the player has put it in the air. It has never flown before the first. */
  flights = 0;
  private leaveYaw = 0;
  private climb = 0;

  constructor() {
    const node = (parent: THREE.Object3D, x: number, y: number, z: number) => {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      parent.add(o);
      return o;
    };
    this.nodes[ROOT] = this.root;
    const body = node(this.root, 0, 0.265, 0);
    this.nodes[BODY] = body;
    const neckA = node(body, 0, 0.048, 0.062);
    this.nodes[NECK_A] = neckA;
    const neckB = node(neckA, 0, 0.068, 0.004);
    this.nodes[NECK_B] = neckB;
    const neckC = node(neckB, 0, 0.065, 0.004);
    this.nodes[NECK_C] = neckC;
    this.nodes[HEAD] = node(neckC, 0, 0.06, 0.006);
    for (const [wing, hand, side] of [
      [WING_L, HAND_L, 1],
      [WING_R, HAND_R, -1],
    ] as const) {
      this.nodes[wing] = node(body, side * 0.047, 0.032, 0.008);
      this.nodes[hand] = node(this.nodes[wing], side * 0.112, -0.002, -0.012);
    }
    for (const [thigh, shin, foot, side] of [
      [THIGH_L, SHIN_L, FOOT_L, 1],
      [THIGH_R, SHIN_R, FOOT_R, -1],
    ] as const) {
      this.nodes[thigh] = node(body, side * 0.04, -0.03, -0.014);
      this.nodes[shin] = node(this.nodes[thigh], 0, -0.132, 0);
      this.nodes[foot] = node(this.nodes[shin], 0, -0.112, 0);
    }
    for (let i = 0; i < BONES; i++) this.bones.push(new THREE.Matrix4());

    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uBones: { value: this.bones }, uNudge: { value: 2.4 }, uAir: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new THREE.Mesh(craneGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh];
  }

  /**
   * Out of the flock and down. A long shallow descent with the wings going the whole way and no lift in them,
   * then a hard landing. It is the only thing in the game that is not gentle, and it is meant to hurt.
   */
  plummet(from: THREE.Vector3, to: THREE.Vector3, seconds: number, heading?: number): void {
    this.fallFrom.copy(from);
    this.fallTo.copy(to);
    this.fallTo.y = Math.max(heightAt(to.x, to.z), 0);
    const line = heading ?? Math.atan2(to.x - from.x, to.z - from.z);
    /**
     * It carries on the flock's line for a moment, sinking, before it peels away. That first stretch is the only
     * thing that tells the player it fell out of the V rather than choosing to come down.
     */
    this.fallDrift
      .set(Math.sin(line), 0, Math.cos(line))
      .multiplyScalar(38)
      .add(from)
      .setY(from.y - (from.y - this.fallTo.y) * 0.1);
    this.fallFor = seconds;
    this.fallT = 0;
    this.roll = 0;
    this.slew = 0;
    this.state = 'falling';
    this.visible = true;
    this.position.copy(from);
    this.yaw = line;
  }

  /** How hard it is still trying to get up, 1 at the moment it lands and 0 once it gives in. */
  get effortLeft(): number {
    return this.state === 'downed' ? 1 - this.struggle : 0;
  }

  get grounded(): boolean {
    return this.state === 'downed' || this.state === 'fallen';
  }

  /** Up on the player's wind. */
  get flying(): boolean {
    return this.state === 'gliding';
  }

  /** How near it is to going: 0 nothing under it, 1 about to leave the ground. Its wings show this. */
  get hoping(): number {
    return this.hope;
  }

  /**
   * Let go for good. Once the player's wind has it up, it stops being carried by them and starts flying: it climbs
   * away on its own and it does not come back. Nothing else in the game is allowed to leave.
   */
  leave(bearing: number): void {
    if (this.state === 'leaving') return;
    this.state = 'leaving';
    this.leaveYaw = bearing;
    this.climb = 0;
    this.flights++;
  }

  /** On its way and not coming back. */
  get gone(): boolean {
    return this.state === 'leaving';
  }

  /** A few hard flaps and hops on the spot: it is trying to get up by itself, and it cannot. */
  tryToFly(): void {
    if (this.state === 'following' || this.state === 'fallen') this.hopT = 2.4;
  }

  /** Riding with the child, in the arms or in the hood. */
  get carried(): boolean {
    return this.state === 'carried' || this.state === 'hooded';
  }

  /** Comes down out of the flock and lands in the grass, too tired to go on. */
  fall(x: number, z: number, yaw: number): void {
    this.position.set(x, Math.max(heightAt(x, z), 0), z);
    this.yaw = yaw;
    this.state = 'fallen';
    this.settle = 1;
    this.visible = true;
  }

  /** Riding in the child's arms or hood; the caller gives the world point each frame. */
  carry(at: THREE.Vector3, yaw: number, hooded = false): void {
    this.state = hooded ? 'hooded' : 'carried';
    this.position.copy(at);
    this.yaw = yaw;
    this.visible = true;
  }

  /** Gone to ground and staying there: hunched as small as it can make itself, in the dark, waiting to be found. */
  cower(): void {
    this.state = 'fallen';
    this.settle = 1;
    this.flap = 0;
    this.effort = 0;
    this.hopT = 0;
    this.visible = true;
  }

  /** Set down to walk at the child's heel. */
  follow(): void {
    if (this.state !== 'following') this.settle = 0.6;
    this.state = 'following';
  }

  /** A moment shared: the bond only ever goes up. */
  bind(amount: number): void {
    this.bond = Math.min(1, this.bond + amount);
  }

  watch(target: THREE.Vector3 | null): void {
    this.lookAt = target;
  }

  update(dt: number, time: number, child: THREE.Vector3, wind: WindSample): void {
    this.time = time;
    this.mesh.visible = this.visible;
    if (!this.visible) return;

    const afoot = this.state === 'following' || this.state === 'fallen';
    /** It only ever goes up on wind that is actually under it, so the player learns where to hold the pointer. */
    const lift = afoot || this.state === 'gliding' ? wind.lift : 0;
    this.hope = ease(this.hope, afoot ? THREE.MathUtils.smoothstep(lift, LIFT_TO_HOPE, LIFT_TO_FLY) : 0, 2.5, dt);

    if (this.state === 'leaving') this.climbOut(dt);
    else if (this.state === 'gliding') this.soar(dt, wind);
    else if (this.state === 'following') this.walk(dt, child);
    else if (this.state === 'fallen') this.settle = Math.min(1, this.settle + dt * 0.5);
    else if (this.state === 'falling') this.descend(dt);
    else if (this.state === 'downed') this.struggling(dt);

    /** Enough wind under it and it goes — but not the instant it lands, or one long hold would juggle it. */
    if (afoot && lift > LIFT_TO_FLY && this.hopT <= 0 && time - this.landedAt > 1.6) this.takeOff();

    this.glide = ease(this.glide, this.state === 'gliding' ? 1 : this.hope * 0.5, 3, dt);
    this.mat.uniforms.uAir.value =
      this.state === 'falling'
        ? THREE.MathUtils.clamp((this.position.y - this.fallTo.y) / 6, 0, 1)
        : this.state === 'gliding'
          ? THREE.MathUtils.clamp((this.position.y - Math.max(heightAt(this.position.x, this.position.z), 0)) / 4, 0, 1)
          : 0;
    this.pose(dt);
  }

  /** Climbing away north, finding its own strength as it goes, until the night has it. */
  private climbOut(dt: number): void {
    this.climb = Math.min(1, this.climb + dt * 0.3);
    this.yaw = easeAngle(this.yaw, this.leaveYaw, 0.7, dt);
    const speed = 3.4 + this.climb * 7.5;
    this.position.x += Math.sin(this.yaw) * speed * dt;
    this.position.z += Math.cos(this.yaw) * speed * dt;
    this.position.y += (3.1 - this.climb * 1.1) * dt;
    this.flap = 1;
    this.effort = 0.45 + 0.3 * Math.max(0, Math.sin(this.flapPhase));
    this.roll = Math.sin(this.time * 0.6) * 0.18;
    if (this.position.y > 150) this.visible = false;
  }

  private takeOff(): void {
    this.state = 'gliding';
    this.glideT = 0;
    this.air = 2.4;
    this.settle = 0;
    this.flights++;
  }

  /**
   * The colt on the wing, for as long as the player can hold it there. It is not flying — it is being flown, and
   * the moment the updraft stops it sinks. This is where a player finds out they are the reason it can go home.
   */
  private soar(dt: number, wind: WindSample): void {
    this.glideT += dt;
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    const room = 1 - THREE.MathUtils.smoothstep(this.position.y - ground, CEILING - 2, CEILING);
    const fading = 1 - THREE.MathUtils.smoothstep(this.glideT, GLIDE_FOR - 2.5, GLIDE_FOR);
    this.air += (wind.lift * 9 * room * fading - 3.4) * dt;
    this.air = THREE.MathUtils.clamp(this.air, -3.2, 3.6);
    this.position.y += this.air * dt;

    /** It cannot steer: it goes where the air goes, sliding downwind and turning to face its own drift. */
    const drift = 0.22 + this.glide * 0.3;
    let vx = wind.x * drift + Math.sin(this.yaw) * 1.1;
    let vz = wind.z * drift + Math.cos(this.yaw) * 1.1;
    /** Capped, so a hard gust cannot carry it out of the frame and lose the player the only thing they care about. */
    const speed = Math.hypot(vx, vz);
    if (speed > 2.6) {
      vx *= 2.6 / speed;
      vz *= 2.6 / speed;
    }
    this.position.x += vx * dt;
    this.position.z += vz * dt;
    if (Math.hypot(wind.x, wind.z) > 0.6) {
      this.yaw = easeAngle(this.yaw, Math.atan2(wind.x, wind.z), 1.1, dt);
    }
    this.roll = ease(this.roll, Math.sin(this.time * 0.9) * 0.22, 2, dt);
    this.flap = ease(this.flap, this.air > 0.4 ? 0.85 : 0.2, 3, dt);
    this.effort = Math.max(0, this.air) * 0.2;

    if (this.position.y <= ground) {
      this.position.y = ground;
      this.state = 'following';
      this.landedAt = this.time;
      this.roll = 0;
      this.effort = 0;
      /** It goes up because of the player and comes down safe because of the player, and it knows. */
      this.bind(0.12);
    }
  }

  /** The descent: it loses height fast at first, then flattens out and half-crashes into the grass. */
  private descend(dt: number): void {
    this.fallT = Math.min(1, this.fallT + dt / this.fallFor);
    const k = this.fallT;
    /** Bursts of flapping with sinking between them, so every drop the player sees has a visible cause. */
    const phase = k * Math.PI * 5.4;
    const burst = Math.max(0, Math.sin(phase)) ** 0.7;
    this.effort = burst;
    this.flap = 0.3 + burst * 0.7;

    /** Quadratic through the drift point: along the flock's line at first, then away from it and down. */
    const u = 1 - k;
    const drop = this.fallFrom.y - this.fallTo.y;
    this.position.set(
      u * u * this.fallFrom.x + 2 * u * k * this.fallDrift.x + k * k * this.fallTo.x,
      u * u * this.fallFrom.y + 2 * u * k * this.fallDrift.y + k * k * this.fallTo.y + burst * 0.075 * u * drop,
      u * u * this.fallFrom.z + 2 * u * k * this.fallDrift.z + k * k * this.fallTo.z,
    );
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.position.y = Math.max(this.position.y, ground);

    /** It cannot hold a line: a wing drops, it slews off course, it hauls itself level and loses it again. */
    this.roll = Math.sin(phase * 0.63 + 0.8) * 0.8 * (1 - burst * 0.45);
    this.slew = Math.sin(phase * 0.41) * 0.55;
    const travel = Math.atan2(this.fallTo.x - this.fallFrom.x, this.fallTo.z - this.fallFrom.z);
    const line = Math.atan2(this.fallDrift.x - this.fallFrom.x, this.fallDrift.z - this.fallFrom.z);
    this.yaw = line + Math.atan2(Math.sin(travel - line), Math.cos(travel - line)) * k + this.slew;

    if (this.fallT >= 1) {
      this.state = 'downed';
      this.struggle = 0;
      this.settle = 0;
      this.roll = 0;
      this.position.y = ground;
    }
  }

  /** On the ground: three goes at getting airborne again, each weaker, and then it stops trying. */
  private struggling(dt: number): void {
    this.struggle = Math.min(1, this.struggle + dt / 9);
    const burst = Math.max(0, Math.sin(this.struggle * Math.PI * 3)) * (1 - this.struggle);
    this.effort = burst;
    this.flap = burst;
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.position.y = ground + burst * burst * 0.22;
    this.settle = Math.min(1, this.settle + dt * 0.25 * this.struggle);
    if (this.struggle >= 1) this.state = 'fallen';
  }

  private walk(dt: number, child: THREE.Vector3): void {
    if (this.hopT > 0) {
      /** Everything it has, straight up, and it gets a foot off the ground: the reason the player tries at all. */
      this.hopT -= dt;
      const burst = Math.max(0, Math.sin((2.4 - this.hopT) * Math.PI * 1.7));
      this.effort = burst;
      this.flap = Math.max(this.flap, burst);
      this.settle = 0;
      this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0) + burst * burst * 0.3;
      return;
    }
    this.effort = 0;
    const keep = 2.6 - this.bond * 1.4;
    const dx = child.x - this.position.x;
    const dz = child.z - this.position.z;
    const gap = Math.hypot(dx, dz);
    const hurry = THREE.MathUtils.clamp((gap - keep) / 6, 0, 1);
    const speed = hurry * (1.4 + 2.6 * hurry);
    if (gap > 0.2) {
      const want = Math.atan2(dx, dz);
      this.yaw = easeAngle(this.yaw, want, 5 + 4 * hurry, dt);
    }
    if (speed > 0.02) {
      this.position.x += Math.sin(this.yaw) * speed * dt;
      this.position.z += Math.cos(this.yaw) * speed * dt;
      this.stride += dt * (5 + speed * 2.6);
      this.settle = Math.max(0, this.settle - dt * 2);
    } else {
      this.settle = Math.min(1, this.settle + dt * 1.4);
    }
    this.flap = ease(this.flap, hurry > 0.55 ? 1 : 0, 6, dt);
    this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0);
  }

  /** Where the child should look to meet its eye. */
  eye(out: THREE.Vector3): THREE.Vector3 {
    this.nodes[HEAD].updateMatrixWorld(true);
    return out.setFromMatrixPosition(this.nodes[HEAD].matrixWorld);
  }

  private pose(dt: number): void {
    const t = this.time;
    const n = this.nodes;
    const lerp = THREE.MathUtils.lerp;
    const clamp = THREE.MathUtils.clamp;
    const flying = this.state === 'falling' || this.state === 'gliding' || this.state === 'leaving';
    this.root.position.copy(this.position);
    this.root.scale.setScalar(SIZE);
    this.root.rotation.order = 'YXZ';
    this.root.rotation.set(flying ? -0.3 + this.effort * 0.85 : 0, this.yaw, this.roll);

    const held = this.carried;
    const sit = held || flying ? (held ? 1 : 0) : this.grounded ? this.settle : 0;
    const afoot = flying || held ? 0 : 1 - this.settle;

    const bob = Math.sin(this.stride * 2) * 0.012 * afoot;
    /** Carried, the whole bird sits in the arms: the body drops to the hold and only the neck comes up out of it. */
    const rest = held ? 0.16 : 0.265 - sit * 0.152;
    n[BODY].position.y = rest + bob + Math.sin(t * 1.7) * 0.003 + this.glide * 0.09 + this.effort * 0.025;
    n[BODY].position.z = held ? 0.22 : -sit * 0.012;
    n[BODY].rotation.x =
      -0.05 - this.glide * 0.12 + sit * 0.03 - (held ? 0.25 : 0) + (flying ? 0.18 : 0) + Math.sin(this.stride * 2 + 1) * 0.02 * afoot;
    n[BODY].rotation.z = Math.sin(this.flapPhase + 1.2) * 0.05 * Math.max(flying ? 1 : 0, this.effort);

    /** The neck is the whole character: folded back over the shoulders, the standing S, or stretched out. */
    const tall = clamp((this.lookAt ? 0.6 : 0) + this.effort + (held ? 0.5 : 0) + this.glide * 0.4 + this.hope * 0.6, 0, 1);
    const curl = sit * (1 - tall * 0.75);
    const reach = flying ? 1 : clamp(this.flap * 0.7, 0, 1);
    const sway = Math.sin(t * 1.05) * 0.022 + Math.sin(this.stride * 2 + 0.7) * 0.028 * afoot;
    let a = lerp(lerp(-0.3, -1.25, curl), -0.03, tall);
    let b = lerp(lerp(0.5, 0.95, curl), 0.08, tall);
    let c = lerp(lerp(0.12, 0.35, curl), -0.02, tall);
    a = lerp(a, 1.1, reach);
    b = lerp(b, 0.3, reach);
    c = lerp(c, 0.15, reach);
    a += sway;
    b += sway * 0.6;
    n[NECK_A].rotation.x = a;
    n[NECK_B].rotation.x = b;
    n[NECK_C].rotation.x = c;

    const neckPitch = a + b + c;
    let pitch = (flying ? 0.02 : lerp(0.06, 0.45, curl)) - neckPitch;
    let yaw = Math.sin(t * 0.43) * 0.22 * (1 - curl * 0.7);
    if (this.lookAt) {
      this.to.copy(this.lookAt).sub(this.eye(this.want));
      yaw = clamp(wrapAngle(Math.atan2(this.to.x, this.to.z) - this.yaw), -1.3, 1.3);
      pitch = -clamp(Math.atan2(this.to.y, Math.hypot(this.to.x, this.to.z)), -0.8, 0.8) - neckPitch;
    }
    /** A long neck turns with the head, or the colt looks like it is wearing its head sideways. */
    const turn = yaw * 0.5;
    n[NECK_B].rotation.y = turn * 0.45;
    n[NECK_C].rotation.y = turn * 0.55;
    n[HEAD].rotation.set(pitch, yaw - turn, 0);

    this.flapPhase += dt * (6 + this.glide * 4 + this.effort * 9 + (flying ? 4 : 0));
    /** Folded, the arm lies along the flank and the hand tucks back over the rump; spread, the hand whips a beat late. */
    const spread = clamp(this.flap * 0.3 + this.glide + this.effort * 1.3 + this.hope * 0.55 + (flying ? 1 : 0), 0, 1);
    const power = spread * (1 - this.glide * 0.75);
    const beat = Math.sin(this.flapPhase) * power;
    const lag = Math.sin(this.flapPhase - 0.75) * power;
    const sweep = lerp(1.32, 0.14, spread);
    const roll = lerp(-0.2, 0.2, spread) + beat * 0.95;
    const handSweep = lerp(0.88, -0.06, spread) - Math.max(0, lag) * 0.3;
    const handRoll = lerp(0.12, 0, spread) + lag * 0.55;
    const twist = -this.glide * 0.12;
    n[WING_L].rotation.set(twist, sweep, roll);
    n[WING_R].rotation.set(twist, -sweep, -roll);
    n[HAND_L].rotation.set(0, handSweep, handRoll);
    n[HAND_R].rotation.set(0, -handSweep, -handRoll);

    for (const [thigh, shin, foot, side, phase] of [
      [THIGH_L, SHIN_L, FOOT_L, 1, 0],
      [THIGH_R, SHIN_R, FOOT_R, -1, Math.PI],
    ] as const) {
      const swing = Math.sin(this.stride + phase) * afoot;
      const up = Math.max(0, Math.cos(this.stride + phase)) * afoot;
      let th = 0.3 + swing * 0.5 + this.effort * 0.25;
      let sh = -0.36 + up - swing * 0.2;
      let ft = up * 0.5;
      /** Folded away to nothing: the heel comes up under the breast and the shank lies back along the belly. */
      th = lerp(th, -1.18, sit);
      sh = lerp(sh, 2.7, sit);
      ft = lerp(ft, 1.3, sit);
      /** Every push leaves the legs hanging: they straighten as it comes off the ground and fold as it drops. */
      th = lerp(th, 0.12, this.effort);
      sh = lerp(sh, -0.14, this.effort);
      ft = lerp(ft, 0.4, this.effort);
      th = lerp(th, 0.7, this.glide);
      sh = lerp(sh, 0.5, this.glide);
      ft = lerp(ft, 0.9, this.glide);
      if (this.state === 'falling' || this.state === 'leaving') {
        /** Legs trailing, neck out straight: everything it has. */
        th = 1.35;
        sh = 0.28;
        ft = 1.5;
      }
      n[thigh].rotation.set(th, 0, -side * 0.09 * (1 - sit));
      n[shin].rotation.x = sh;
      n[foot].rotation.x = ft;
    }

    this.root.updateMatrixWorld(true);
    for (let i = 0; i < BONES; i++) this.bones[i].copy(n[i].matrixWorld);
  }
}

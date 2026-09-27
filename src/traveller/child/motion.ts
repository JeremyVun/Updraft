import * as THREE from 'three';
import type { Rig } from '../body';
import { ANKLE, BONE, FOREARM, HEM_BONES, SHIN, THIGH, UPPER_ARM, WAIST, hemAngle } from './skeleton';
import { coatAt, hemY } from './garments';

/** One arm, as the story poses it. Left is the child's own left, +x. */
export interface ArmPose {
  /** Swung forward and up from hanging, radians: π/2 is straight out in front, π straight up. */
  raise: number;
  /** Lifted out from the side, radians. */
  out: number;
  /** Rolled about its own length, radians, positive turning the palm forward. */
  twist: number;
  /** Elbow bend, radians. */
  elbow: number;
  /** Wrist bend, radians, positive curling the mitten toward the inside of the forearm. */
  wrist: number;
}

/** The whole child, as the story poses it each frame; the motion below turns it into bones. */
export interface Pose {
  /** Up and down of the whole child, in world units: hops, the clamber over a wall, crouching, sitting, kneeling. */
  rise: number;
  /** The upper body bent forward from the hips (radians), turned toward the child's left, and tipped to the left. */
  lean: number;
  twist: number;
  tilt: number;
  /** Bending over something: the chest carried forward and down over the knees, 0..1. */
  bend: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  arms: [ArmPose, ArmPose];
  /** 0..1 weights of the leg poses other than standing and walking. */
  sit: number;
  kneel: number;
  swing: number;
  /** On a swing: -1 tucked at the back of the arc to 1 legs out at the front. */
  kick: number;
  /** Lying down, 0..1: the legs lie along the bed. */
  lie: number;
  /** A knee lifted for a step up: over a gunwale, onto a deck; per leg, radians of thigh raise. */
  step: [number, number];
  /** Breath, 0..1 of a slow cycle's depth. */
  breath: number;
}

export function restArm(): ArmPose {
  return { raise: 0, out: 0.12, twist: 0, elbow: 0.25, wrist: 0 };
}

export function newPose(): Pose {
  return {
    rise: 0, lean: 0, twist: 0, tilt: 0, bend: 0, headYaw: 0, headPitch: 0, headRoll: 0,
    arms: [restArm(), restArm()], sit: 0, kneel: 0, swing: 0, kick: 0, lie: 0, step: [0, 0], breath: 0,
  };
}

/** What the world is doing to the child this frame. */
export interface Drive {
  dt: number;
  time: number;
  /** Ground speed in world units a second, and how far through its stride each foot is (radians, π a step). */
  speed: number;
  gait: number;
  /** World height of the ground at a point: the terrain, a deck, the floor of a boat. */
  ground: (x: number, z: number) => number;
  /** The wind at the child and its gustiness, in world units. */
  windX: number;
  windZ: number;
  gust: number;
  /** The child's own speed through the air, world units a second. */
  velocity: THREE.Vector3;
  /** How fast they are turning, radians a second. */
  turn: number;
}

export const WALK = 2.6;
export const RUN = 5.4;
const SCALE = 1.12;
/** Gravity in world units: the child is about 2.8 of them tall and a little over a metre in the dream. */
const GRAVITY = 20;

/** The length of one step at a speed, in world units: short quick steps when slow, long ones running. */
export function stepLength(speed: number): number {
  const walk = THREE.MathUtils.lerp(0.36, 0.78, Math.min(1, speed / WALK));
  return walk + 0.47 * THREE.MathUtils.clamp((speed - WALK) / (RUN - WALK), 0, 1);
}

const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));

/** A damped spring on one number, integrated in small steps so a slow frame never makes it ring. */
class Spring {
  x = 0;
  v = 0;
  constructor(private readonly hz: number, private readonly zeta: number) {}
  step(target: number, dt: number, push = 0): number {
    const w = Math.PI * 2 * this.hz;
    let left = Math.min(dt, 0.1);
    while (left > 1e-5) {
      const h = Math.min(left, 1 / 120);
      this.v += (w * w * (target - this.x) - 2 * this.zeta * w * this.v + push) * h;
      this.x += this.v * h;
      left -= h;
    }
    return this.x;
  }
}

const Y = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Two bones hanging along -y from a joint: the rotations that put the end of the second on `target` (in the joint's
 * parent frame, from the joint), the middle bending toward `pole`. Out of reach, it reaches toward it at full stretch.
 */
function twoBone(target: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, upper: THREE.Quaternion, lower: THREE.Quaternion, t: Scratch): void {
  const span = THREE.MathUtils.clamp(target.length(), Math.abs(a - b) + 0.02, a + b - 0.002);
  t.dir.copy(target).normalize();
  const along = (a * a - b * b + span * span) / (2 * span);
  const out = Math.sqrt(Math.max(0, a * a - along * along));
  t.pole.copy(pole).addScaledVector(t.dir, -pole.dot(t.dir));
  if (t.pole.lengthSq() < 1e-8) t.pole.set(0, 0, 1);
  t.pole.normalize();
  t.mid.copy(t.dir).multiplyScalar(along).addScaledVector(t.pole, out);
  t.u.copy(t.mid).normalize();
  t.f.copy(t.dir).multiplyScalar(span).sub(t.mid).normalize();
  upper.setFromUnitVectors(DOWN, t.u);
  t.q.setFromUnitVectors(t.u, t.f);
  lower.copy(upper).invert().multiply(t.q).multiply(upper);
}

interface Scratch {
  dir: THREE.Vector3;
  pole: THREE.Vector3;
  mid: THREE.Vector3;
  u: THREE.Vector3;
  f: THREE.Vector3;
  q: THREE.Quaternion;
}

const scratch = (): Scratch => ({
  dir: new THREE.Vector3(), pole: new THREE.Vector3(), mid: new THREE.Vector3(), u: new THREE.Vector3(), f: new THREE.Vector3(),
  q: new THREE.Quaternion(),
});

/** Where each hem bone hangs from, its outward axis and its radial direction, in the hips' frame. */
const HEM = Array.from({ length: HEM_BONES }, (_, i) => {
  const a = hemAngle(i);
  const radial = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  return {
    a,
    radial,
    tangent: new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)),
    /** Rotating about this swings the hem outward. */
    axis: new THREE.Vector3().crossVectors(radial, Y).normalize(),
    pivot: new THREE.Vector3(Math.sin(a) * WAIST.w, WAIST.y, Math.cos(a) * WAIST.d),
    length: WAIST.y - hemY(a),
  };
});

/**
 * Turns a pose into bones. It walks the legs with planted feet over whatever ground is under them, bends the arms
 * the story asks for, and hangs the coat, the hood and the bag off the body on springs, so they swing with every
 * step and turn and stream in the wind without a cloth simulation.
 */
export class ChildMotion {
  private readonly b: THREE.Bone[];
  private readonly t = scratch();
  private readonly qa = new THREE.Quaternion();
  private readonly qb = new THREE.Quaternion();
  private readonly qc = new THREE.Quaternion();
  private readonly ea = new THREE.Euler();
  private readonly va = new THREE.Vector3();
  private readonly vb = new THREE.Vector3();
  private readonly vc = new THREE.Vector3();
  private readonly m = new THREE.Matrix4();
  private readonly hemOut = HEM.map(() => new Spring(1.75, 0.3));
  private readonly hemSide = HEM.map(() => new Spring(1.1, 0.35));
  private readonly hoodPitch = new Spring(2.2, 0.38);
  private readonly hoodYaw = new Spring(1.8, 0.4);
  private readonly hoodRoll = new Spring(2.0, 0.4);
  private readonly bagPitch = new Spring(1.9, 0.3);
  private readonly bagRoll = new Spring(1.7, 0.32);
  private readonly lastHips = new THREE.Vector3();
  private readonly hipsVel = new THREE.Vector3();
  private readonly hipsAcc = new THREE.Vector3();
  private readonly lastChest = new THREE.Vector3();
  private readonly chestVel = new THREE.Vector3();
  private readonly chestAcc = new THREE.Vector3();
  private lastHeadYaw = 0;
  private lastHeadPitch = 0;
  private headYawVel = 0;
  private headPitchVel = 0;
  private fresh = true;
  /** How hard the air is working the cloth, 0..1, and which way it leaves the child (in the hips' frame), for the shader's ripple. */
  flutter = 0;
  readonly flow = new THREE.Vector3();
  /** A slow shift of weight from foot to foot while standing. */
  private weight = 0;
  private weightGoal = 0;
  private nextShift = 3;
  /** How far forward the body leans against starting, stopping and the pace. */
  private readonly leanSpring = new Spring(2.4, 0.55);
  private lastSpeed = 0;
  /** The stride's lift and reach, eased so the feet settle when the child stops. */
  private stride = 0;

  constructor(private readonly rig: Rig) {
    this.b = rig.bones;
  }

  update(pose: Pose, d: Drive): void {
    const b = this.b;
    const dt = Math.max(d.dt, 1e-4);
    for (const bone of b) bone.quaternion.identity();

    const moving = Math.min(1, d.speed / WALK);
    const running = THREE.MathUtils.clamp((d.speed - WALK) / (RUN - WALK), 0, 1);
    const plant = (1 - pose.sit) * (1 - pose.kneel) * (1 - pose.swing) * (1 - pose.lie);
    this.stride = damp(this.stride, d.speed > 0.05 ? 1 : 0, d.speed > 0.05 ? 10 : 5, dt);
    const stride = this.stride * plant;

    // -- The walk: pelvis, spine and the rhythm of it, from the phase of the stride.
    const phase = d.gait;
    const stance = THREE.MathUtils.lerp(0.54, 0.36, running);
    const step = stepLength(d.speed) / SCALE;
    const reach = stance * step * stride;
    const accel = (d.speed - this.lastSpeed) / dt;
    this.lastSpeed = d.speed;
    const leanTarget = (0.06 * moving + 0.24 * running) * plant + THREE.MathUtils.clamp(accel * 0.03, -0.14, 0.18) * plant;
    const paceLean = this.leanSpring.step(leanTarget, dt);

    this.nextShift -= dt;
    if (this.nextShift <= 0) {
      this.weightGoal = this.weightGoal > 0 ? -1 : 1;
      this.nextShift = 4 + Math.random() * 5;
    }
    this.weight = damp(this.weight, this.weightGoal * (1 - moving), 1.4, dt);

    const hips = b[BONE.hips];
    const rest = this.rig.rest;
    hips.position.copy(rest[BONE.hips]);
    /** Weight over the foot in stance: the hips ride side to side, turn with the stride and drop on the swinging side. */
    const sway = Math.sin(phase) * stride;
    hips.position.x += -0.022 * sway * (1 - running * 0.6) + 0.02 * this.weight * plant;
    /** Walking, the body vaults over each planted foot; running, it drops into the stance and springs out of it. */
    const bounce = stride * (moving * (1 - running) * (0.024 * Math.cos(2 * phase) - 0.01) + running * (0.07 * Math.abs(Math.sin(phase)) - 0.05));
    hips.position.y += bounce;
    hips.position.z += -0.05 * pose.bend;
    const hipYaw = 0.14 * sway * (1 - 0.3 * running);
    const hipRoll = -0.045 * Math.cos(phase) * stride + 0.03 * this.weight * plant;
    hips.rotation.set(-0.08 * pose.sit + 0.06 * pose.bend, hipYaw, hipRoll);

    const spine = b[BONE.spine];
    const chest = b[BONE.chest];
    const lean = pose.lean + paceLean;
    /** Into a turn, the faster the more. Positive tilt is toward the child's own right, as the story says it. */
    const into = THREE.MathUtils.clamp(-d.turn * d.speed * 0.025, -0.2, 0.2) * plant;
    spine.rotation.set(lean * 0.55 + pose.bend * 0.4 + pose.breath * 0.012, pose.twist * 0.45 - hipYaw * 0.55, pose.tilt * 0.5 - hipRoll * 0.6 + into);
    chest.rotation.set(lean * 0.45 + pose.bend * 0.35 - pose.breath * 0.03, pose.twist * 0.55 - hipYaw * 0.35, pose.tilt * 0.5 - hipRoll * 0.3);
    chest.position.copy(rest[BONE.chest]).sub(rest[BONE.spine]);
    chest.position.y += pose.breath * 0.006;

    /** The head keeps still while the body moves under it: most of what the spine does is taken back at the neck. */
    const neck = b[BONE.neck];
    const head = b[BONE.head];
    const bodyPitch = spine.rotation.x + chest.rotation.x;
    const bodyYaw = spine.rotation.y + chest.rotation.y + hipYaw;
    const bodyRoll = spine.rotation.z + chest.rotation.z + hipRoll;
    const steady = 0.7 * plant;
    neck.rotation.set(pose.headPitch * 0.35 - bodyPitch * steady * 0.5, pose.headYaw * 0.4 - bodyYaw * steady * 0.6, pose.headRoll * 0.3 - bodyRoll * steady * 0.6);
    head.rotation.set(pose.headPitch * 0.65 - bodyPitch * steady * 0.3 + 0.6 * bounce, pose.headYaw * 0.6 - bodyYaw * steady * 0.3, pose.headRoll * 0.7 - bodyRoll * steady * 0.3);

    // -- Arms, from the story's pose.
    this.arm(pose.arms[0], true);
    this.arm(pose.arms[1], false);

    // -- Legs.
    this.rig.root.updateMatrixWorld(true);
    this.legs(pose, d, phase, stance, reach, stride, running, plant);

    this.rig.root.updateMatrixWorld(true);
    this.secondary(pose, d, dt);
    this.fresh = false;
  }

  private arm(p: ArmPose, left: boolean): void {
    const b = this.b;
    const s = left ? 1 : -1;
    const upper = b[left ? BONE.upperL : BONE.upperR];
    const fore = b[left ? BONE.foreL : BONE.foreR];
    const hand = b[left ? BONE.handL : BONE.handR];
    const clav = b[left ? BONE.clavL : BONE.clavR];
    /** Above the shoulder the collarbone comes up with the arm, so a raised arm does not break at the armpit. */
    const high = THREE.MathUtils.smoothstep(p.raise, 1.3, 2.9) + THREE.MathUtils.smoothstep(p.out, 0.9, 2.0);
    clav.rotation.set(0, -s * 0.12 * THREE.MathUtils.smoothstep(p.raise, 0.6, 1.8), s * 0.45 * Math.min(1, high));
    this.ea.set(-p.raise, s * p.twist, s * p.out, 'XYZ');
    upper.quaternion.setFromEuler(this.ea);
    fore.rotation.set(-p.elbow, 0, 0);
    hand.rotation.set(-p.wrist, 0, 0);
  }

  /**
   * Reaches a mitten to a point in the world: the elbow finds its own place, out and back and a little down where a
   * child's elbow goes. `w` blends from the pose's own arm.
   */
  reach(left: boolean, world: THREE.Vector3, w: number): void {
    if (w <= 0.001) return;
    const b = this.b;
    const clav = b[left ? BONE.clavL : BONE.clavR];
    const upper = b[left ? BONE.upperL : BONE.upperR];
    const fore = b[left ? BONE.foreL : BONE.foreR];
    const hand = b[left ? BONE.handL : BONE.handR];
    clav.updateMatrixWorld(true);
    const target = clav.worldToLocal(this.va.copy(world)).sub(upper.position);
    /** The grip is at the middle of the mitten, a little forward of the forearm's line. */
    const s = left ? 1 : -1;
    this.vb.set(s * 0.75, -0.45, -0.5);
    twoBone(target, UPPER_ARM, FOREARM, this.vb, this.qa, this.qb, this.t);
    upper.quaternion.slerp(this.qa, w);
    fore.quaternion.slerp(this.qb, w);
    hand.quaternion.slerp(this.qc.identity(), w);
    upper.updateMatrixWorld(true);
  }

  private legs(pose: Pose, d: Drive, phase: number, stance: number, reach: number, stride: number, running: number, plant: number): void {
    const b = this.b;
    const root = this.rig.root;
    const hips = b[BONE.hips];
    const rest = this.rig.rest;
    for (const left of [true, false]) {
      const s = left ? 1 : -1;
      const thigh = b[left ? BONE.thighL : BONE.thighR];
      const shin = b[left ? BONE.shinL : BONE.shinR];
      const foot = b[left ? BONE.footL : BONE.footR];
      const hipAt = rest[left ? BONE.thighL : BONE.thighR];

      // Standing and walking: the ankle's place under the hip, in the root's frame.
      const own = phase + (left ? 0 : Math.PI);
      const cyc = ((own / (Math.PI * 2)) % 1 + 1) % 1;
      let fz: number;
      let lift: number;
      let pitch: number;
      if (cyc < stance) {
        const u = cyc / stance;
        fz = THREE.MathUtils.lerp(reach, -reach, u);
        lift = 0;
        /** Heel strike, flat, and up onto the toe to push off. */
        pitch = (-0.25 * (1 - THREE.MathUtils.smoothstep(u, 0, 0.18)) + 0.55 * THREE.MathUtils.smoothstep(u, 0.7, 1)) * stride;
      } else {
        const u = (cyc - stance) / (1 - stance);
        const e = u * u * (3 - 2 * u);
        fz = THREE.MathUtils.lerp(-reach, reach, e);
        lift = (0.08 + 0.18 * running) * Math.pow(Math.sin(u * Math.PI), 0.8) * stride;
        pitch = (0.55 * (1 - THREE.MathUtils.smoothstep(u, 0, 0.35)) - 0.25 * THREE.MathUtils.smoothstep(u, 0.6, 1)) * stride;
      }
      const lateral = hipAt.x + s * (0.01 + 0.01 * this.weight * s);
      const standAnkle = this.vc.set(lateral, ANKLE + lift, fz);
      // The ground under that foot, as a height in the root's frame.
      const world = this.va.copy(standAnkle).setY(0).applyMatrix4(root.matrixWorld);
      const groundY = (d.ground(world.x, world.z) - root.position.y) / SCALE;
      standAnkle.y += THREE.MathUtils.clamp(groundY, -0.5, 0.5);
      /** A relaxed knee on the leg the weight is off. */
      const relax = 0.03 * Math.max(0, -this.weight * s) * plant;
      standAnkle.y += relax;

      // Sitting: feet out in front on whatever is under them.
      const sitAnkle = this.vb.set(hipAt.x + s * 0.03, ANKLE, 0.44);
      const sitWorld = this.va.copy(sitAnkle).setY(0).applyMatrix4(root.matrixWorld);
      sitAnkle.y = Math.max(ANKLE + (d.ground(sitWorld.x, sitWorld.z) - root.position.y) / SCALE, rest[BONE.hips].y - 0.6 - pose.sit * 0.0);

      // Blend: the planted walk, the sit, and a lifted knee for a step up.
      const standW = 1 - pose.sit;
      const ankle = new THREE.Vector3().copy(standAnkle).multiplyScalar(standW).addScaledVector(sitAnkle, pose.sit);
      const stepUp = pose.step[left ? 0 : 1];
      ankle.y += 0.4 * Math.max(0, stepUp);
      ankle.z += 0.3 * stepUp;

      // Into the hips' frame, from the hip joint.
      hips.updateMatrixWorld(true);
      const target = hips.worldToLocal(ankle.applyMatrix4(root.matrixWorld)).sub(thigh.position);
      const pole = this.vb.set(s * 0.12, 0.2 + pose.sit * 0.8, 1);
      twoBone(target, THIGH, SHIN, pole, this.qa, this.qb, this.t);

      // Kneeling (sitting back on the heels), swinging and lying are poses of their own.
      const kneel = pose.kneel;
      const swing = pose.swing;
      const lie = pose.lie;
      const fk = kneel + swing + lie;
      if (fk > 0.001) {
        const tk = kneel / fk;
        const ts = swing / fk;
        const tl = lie / fk;
        const k = pose.kick;
        const thighX = tk * -1.02 + ts * (-1.45 - 0.35 * k) + tl * -0.15;
        const kneeX = tk * 2.6 + ts * (1.35 - 1.1 * Math.max(0, k) + 0.35 * Math.max(0, -k)) + tl * 0.25;
        this.qc.setFromEuler(this.ea.set(thighX, 0, s * (tk * 0.06 + tl * 0.05)));
        this.qa.slerp(this.qc, Math.min(1, fk));
        this.qc.setFromEuler(this.ea.set(kneeX, 0, 0));
        this.qb.slerp(this.qc, Math.min(1, fk));
      }
      thigh.quaternion.copy(this.qa);
      shin.quaternion.copy(this.qb);

      // The foot lies at its pitch in the root's frame whatever the leg did above it.
      thigh.updateMatrixWorld(true);
      shin.updateMatrixWorld(true);
      shin.getWorldQuaternion(this.qa);
      root.getWorldQuaternion(this.qb);
      const kneelFoot = 2.2 * kneel;
      const swingFoot = swing * (0.5 + 0.3 * pose.kick);
      const sitFoot = pose.sit * -0.15;
      this.qc.setFromEuler(this.ea.set(pitch * plant + kneelFoot + swingFoot + sitFoot + lie * 0.6, 0, 0));
      this.qb.multiply(this.qc);
      foot.quaternion.copy(this.qa.invert().multiply(this.qb));
    }
  }

  private secondary(pose: Pose, d: Drive, dt: number): void {
    const b = this.b;
    const root = this.rig.root;
    const hips = b[BONE.hips];
    const chest = b[BONE.chest];

    // Motion of the hips and chest through the world, in their own frames.
    hips.getWorldPosition(this.va);
    chest.getWorldPosition(this.vb);
    if (this.fresh || this.va.distanceToSquared(this.lastHips) > 4) {
      this.lastHips.copy(this.va);
      this.lastChest.copy(this.vb);
      this.hipsVel.set(0, 0, 0);
      this.chestVel.set(0, 0, 0);
    }
    const hv = this.vc.copy(this.va).sub(this.lastHips).divideScalar(dt);
    this.hipsAcc.lerp(hv.clone().sub(this.hipsVel).divideScalar(dt).clampLength(0, 30), 1 - Math.exp(-dt * 10));
    this.hipsVel.copy(hv);
    this.lastHips.copy(this.va);
    const cv = this.vc.copy(this.vb).sub(this.lastChest).divideScalar(dt);
    this.chestAcc.lerp(cv.clone().sub(this.chestVel).divideScalar(dt).clampLength(0, 30), 1 - Math.exp(-dt * 10));
    this.chestVel.copy(cv);
    this.lastChest.copy(this.vb);

    const hipsQ = hips.getWorldQuaternion(this.qa);
    const inv = this.qb.copy(hipsQ).invert();
    /** Gravity as the hips feel it: down, less whatever they are accelerating by. */
    const g = new THREE.Vector3(0, -GRAVITY, 0).sub(this.hipsAcc).applyQuaternion(inv);
    g.y = Math.min(g.y, -GRAVITY * 0.4);
    const air = new THREE.Vector3(d.windX - d.velocity.x, 0, d.windZ - d.velocity.z).applyQuaternion(inv);
    const airSpeed = Math.hypot(air.x, air.z);
    const flow = air.clone().setY(0).normalize();
    const flutterAmp = Math.min(1, airSpeed / 6) * (0.6 + 0.4 * Math.min(1, d.gust * 4));
    this.flutter = flutterAmp;
    this.flow.copy(flow);

    // -- The hem: it hangs where gravity and the air put it, and nothing inside it gets through.
    const legPts = this.legPoints();
    const groundY = (d.ground(root.position.x, root.position.z) - root.position.y) / SCALE;
    const pivotY = hips.position.y + WAIST.y - this.rig.rest[BONE.hips].y;
    const outs: number[] = [];
    for (let i = 0; i < HEM_BONES; i++) {
      const h = HEM[i];
      /** Swung by the body's own motion, blown out on the side the air leaves, pressed in on the side it meets. */
      /** Lying down, the bed holds the coat: nothing swings it and the ground is not under the hem. */
      const up = 1 - pose.lie;
      const hang = Math.atan2(g.dot(h.radial), -g.y) * 0.9 * up;
      const lee = flow.dot(h.radial);
      const blow = Math.min(0.55, airSpeed * (lee > 0 ? 0.055 * lee : 0.015 * lee));
      const flutter = flutterAmp * (0.04 + 0.1 * Math.max(0, lee)) * Math.sin(d.time * (7.5 + 3 * d.gust) + h.a * 2.3 + d.time * 0.8 * Math.sin(h.a * 3));
      const target = THREE.MathUtils.clamp(hang + (blow + flutter) * up, -0.35, 0.9);
      let a = this.hemOut[i].step(target, dt);
      // Legs and the ground push it out.
      let floor = -Infinity;
      for (const p of legPts) floor = Math.max(floor, this.hemClear(i, p));
      const drop = pivotY - groundY - 0.035;
      if (drop < h.length && up > 0.5) floor = Math.max(floor, Math.acos(THREE.MathUtils.clamp(drop / h.length, -1, 1)));
      if (a < floor) {
        a = floor;
        this.hemOut[i].x = floor;
        this.hemOut[i].v = Math.max(0, this.hemOut[i].v);
      }
      outs.push(a);
    }
    for (let i = 0; i < HEM_BONES; i++) {
      const h = HEM[i];
      const a = outs[i] * 0.7 + (outs[(i + 1) % HEM_BONES] + outs[(i + HEM_BONES - 1) % HEM_BONES]) * 0.15;
      const sideTarget = THREE.MathUtils.clamp((Math.atan2(g.dot(h.tangent), -g.y) * 0.6 + airSpeed * 0.02 * flow.dot(h.tangent) - d.turn * 0.05) * (1 - pose.lie), -0.4, 0.4);
      const side = this.hemSide[i].step(sideTarget, dt);
      const bone = b[BONE.hem + i];
      bone.quaternion.setFromAxisAngle(h.axis, a);
      this.qc.setFromAxisAngle(h.radial, -side);
      bone.quaternion.premultiply(this.qc);
    }

    // -- The hood lags the head and lifts at the brim in a headwind.
    const head = b[BONE.head];
    const hy = pose.headYaw;
    const hp = pose.headPitch;
    this.headYawVel = damp(this.headYawVel, (hy - this.lastHeadYaw) / dt, 20, dt);
    this.headPitchVel = damp(this.headPitchVel, (hp - this.lastHeadPitch) / dt, 20, dt);
    this.lastHeadYaw = hy;
    this.lastHeadPitch = hp;
    head.getWorldQuaternion(this.qa);
    const headAir = new THREE.Vector3(d.windX - d.velocity.x, 0, d.windZ - d.velocity.z).applyQuaternion(this.qb.copy(this.qa).invert());
    const hood = b[BONE.hood];
    const pitch = this.hoodPitch.step(THREE.MathUtils.clamp(-this.headPitchVel * 0.05 + headAir.z * 0.006 - this.chestAcc.y * 0.002, -0.14, 0.14), dt);
    const yaw = this.hoodYaw.step(THREE.MathUtils.clamp(-this.headYawVel * 0.06 + headAir.x * 0.004, -0.14, 0.14), dt);
    const roll = this.hoodRoll.step(THREE.MathUtils.clamp(-headAir.x * 0.004 + Math.sin(d.time * 9 + 1) * 0.012 * flutterAmp, -0.1, 0.1), dt);
    hood.rotation.set(pitch, yaw, roll);

    // -- The bag swings from its straps and bumps with every step.
    chest.getWorldQuaternion(this.qa);
    const ci = this.qb.copy(this.qa).invert();
    const cg = new THREE.Vector3(0, -GRAVITY, 0).sub(this.chestAcc).applyQuaternion(ci);
    cg.y = Math.min(cg.y, -GRAVITY * 0.4);
    const bag = b[BONE.bag];
    /** It can swing out from the back but not in through it. */
    const still = 1 - pose.lie;
    const bp = this.bagPitch.step(THREE.MathUtils.clamp(Math.atan2(-cg.z, -cg.y) * 0.4 * still, -0.04, 0.2), dt);
    const br = this.bagRoll.step(THREE.MathUtils.clamp(Math.atan2(cg.x, -cg.y) * 0.4 * still, -0.16, 0.16), dt);
    bag.rotation.set(Math.max(bp, -0.04), 0, br);
  }

  private readonly legScratch = Array.from({ length: 8 }, () => new THREE.Vector3());

  /** Points down each leg in the hips' frame that the coat has to clear. */
  private legPoints(): THREE.Vector3[] {
    const b = this.b;
    const hips = b[BONE.hips];
    hips.updateMatrixWorld(true);
    this.m.copy(hips.matrixWorld).invert();
    let n = 0;
    for (const left of [true, false]) {
      const shin = b[left ? BONE.shinL : BONE.shinR];
      const foot = b[left ? BONE.footL : BONE.footR];
      const thigh = b[left ? BONE.thighL : BONE.thighR];
      const knee = shin.getWorldPosition(this.legScratch[n++]).applyMatrix4(this.m);
      const ankle = foot.getWorldPosition(this.legScratch[n++]).applyMatrix4(this.m);
      const hip = thigh.getWorldPosition(this.vc).applyMatrix4(this.m);
      this.legScratch[n++].lerpVectors(hip, knee, 0.65);
      this.legScratch[n++].lerpVectors(knee, ankle, 0.35);
    }
    return this.legScratch;
  }

  /** The least outward swing of hem bone `i` that keeps the coat outside a point of the leg. */
  private hemClear(i: number, p: THREE.Vector3): number {
    const h = HEM[i];
    const y = p.y + this.rig.rest[BONE.hips].y;
    if (y > WAIST.y - 0.02 || y < hemY(h.a) - 0.12) return -Infinity;
    const across = p.x * h.tangent.x + p.z * h.tangent.z;
    if (Math.abs(across) > 0.26) return -Infinity;
    const out = p.x * h.radial.x + p.z * h.radial.z + 0.1 * (1 - Math.abs(across) / 0.26) + 0.02;
    const below = Math.max(0.05, WAIST.y - y);
    const surface = coatAt(h.a, Math.max(y, hemY(h.a)));
    const r = surface.p.x * h.radial.x + surface.p.z * h.radial.z;
    if (out <= r) return -Infinity;
    return Math.asin(THREE.MathUtils.clamp((out - r) / below, -1, 1));
  }

  /** The direction the hood's opening faces, in the world. */
  hoodForward(out: THREE.Vector3): THREE.Vector3 {
    this.b[BONE.head].getWorldQuaternion(this.qa);
    return out.set(0, -0.2, 1).normalize().applyQuaternion(this.qa);
  }
}


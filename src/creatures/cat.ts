import * as THREE from 'three';
import { ease, Spring, wrapAngle } from './motion';
import { catGeometry, HEAD, JAW } from './cat/body';
import { CatGait, type GaitKind, type Support } from './cat/gait';
import { CatRig, type Drives } from './cat/pose';
import { Route } from './cat/route';
import { applyCatLook, catMaterial, type CatLook } from './cat/shader';

export type CatPose = 'stand' | 'sit' | 'crouch';
export type Pace = 'walk' | 'trot' | 'run';
/** The height of whatever it walks on under a point of the world. */
export type Floor = (x: number, z: number) => number;

/** Something it did this frame that can be heard. The cat only says what happened; the sound is made elsewhere. */
export interface CatSound {
  kind: 'mew' | 'chirrup' | 'pat' | 'land' | 'scrabble';
  amount: number;
  /** A mew: how long it is, in seconds, which the mouth keeps time with, and how much it is asking. */
  length?: number;
  plea?: number;
}

export interface JumpOptions {
  /** What it lands on: the point is in this object's space and it rides with it afterwards. Null is the world. */
  frame?: THREE.Object3D | null;
  /** Which way it faces once down, in that space; by default the way it jumped. */
  yaw?: number;
  /** How far the top of the arc is above the higher of its two ends. */
  arc?: number;
  /** What it stands on once down, in the world; otherwise a level surface through the point. */
  floor?: Floor | null;
  then?: CatPose;
  look?: THREE.Vector3 | null;
}

export interface RunOptions {
  pace?: Pace;
  /** Metres a second, in place of the pace's own. */
  speed?: number;
  /** Along a rail or a coping: paws in one line, head low, tail out behind for balance. */
  narrow?: boolean;
  /** How it holds itself once it stops; it turns to face `look` first if that is behind it. */
  then?: CatPose;
  look?: THREE.Vector3 | null;
}

interface Stance {
  bodyY: number;
  bodyZ: number;
  pitch: number;
  flex: number;
  chestUp: number;
  neckLow: number;
  hock: number;
  /** How far the front paws are curled under when they are down. */
  tuck: number;
  /** Paw homes off the point it stands on: across, and along the way it faces. */
  front: [number, number];
  hind: [number, number];
  /** The tail's root against the level of what it stands on, up positive; its curl along its length; wrapped round. */
  tailUp: number;
  tailCurl: number;
  tailWrap: number;
}

/** Its own poses, and the gathered one it springs from. */
type Hold = CatPose | 'gather';

const STANCES: Record<Hold, Stance> = {
  stand: { bodyY: 0.165, bodyZ: 0, pitch: 0.03, flex: 0.06, chestUp: 0, neckLow: 0, hock: 0.5, tuck: 0, front: [0.034, 0.088], hind: [0.04, -0.1], tailUp: 0.55, tailCurl: 0.12, tailWrap: 0 },
  sit: { bodyY: 0.128, bodyZ: -0.02, pitch: 0.78, flex: -0.15, chestUp: 0.25, neckLow: -0.15, hock: 1.45, tuck: 0, front: [0.024, 0.08], hind: [0.044, 0.004], tailUp: -0.32, tailCurl: 0.22, tailWrap: 1 },
  gather: { bodyY: 0.112, bodyZ: -0.015, pitch: -0.05, flex: 0.2, chestUp: 0, neckLow: 0.15, hock: 0.85, tuck: 0, front: [0.03, 0.08], hind: [0.042, -0.068], tailUp: 0.0, tailCurl: 0, tailWrap: 0 },
  crouch: { bodyY: 0.088, bodyZ: 0, pitch: 0.05, flex: 0.3, chestUp: 0, neckLow: 0.6, hock: 1.45, tuck: 1.3, front: [0.028, 0.074], hind: [0.046, -0.06], tailUp: -0.02, tailCurl: 0, tailWrap: 1 },
};
const POSES: Hold[] = ['stand', 'sit', 'crouch', 'gather'];

const PACE: Record<Pace, { kind: GaitKind; speed: number }> = {
  walk: { kind: 'walk', speed: 0.6 },
  trot: { kind: 'trot', speed: 1.4 },
  run: { kind: 'bound', speed: 3.2 },
};
const NARROW_SPEED = 0.45;
const CLIMB_SPEED = 0.8;
/** A little lighter than the world, so a leap hangs for a moment at the top as a cat's seems to. */
const GRAVITY = 8.5;

type Doing = 'still' | 'path' | 'air' | 'climb';
type Air = 'gather' | 'fly' | 'land';

const clamp = THREE.MathUtils.clamp;
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const UP = new THREE.Vector3(0, 1, 0);
const IDENTITY = new THREE.Matrix4();
/** Whatever carries it moves in the story's update, after the scene last worked out where everything is. */
const worldOf = (o: THREE.Object3D): THREE.Matrix4 => {
  o.updateWorldMatrix(true, false);
  return o.matrixWorld;
};

/**
 * The stranded cat of the drowned village: one small tabby the story directs by actions that each blend out of
 * whatever it was doing and call back when they are done. Where it is is always a point on something (the world, or
 * an object that carries it, a wash-tub or the boat), which way it faces along that, and the surface's own up.
 */
export class Cat {
  /** Where it stands in the world, and which way it faces: read these, set them with `place`. */
  readonly position = new THREE.Vector3();
  yaw = 0;
  visible = false;
  /** How big it is: 1.15 stands it about a quarter of a metre at the shoulder, beside a child of about 1.1 m. */
  scale = 1.15;
  /** How afraid it is underneath whatever happens, 0..1: the story sets it high in the tub and over the water. */
  unease = 0;
  /** 0 dry to 1 soaked. */
  wet = 0.35;
  /** While set it mews every few seconds, wherever it is and whatever it is doing. */
  mewing = false;
  /** Something it glances at now and then while sitting, as at the cygnet in the satchel. */
  curious: THREE.Vector3 | null = null;
  /** What it did this frame that makes a sound; whoever plays them empties the list. */
  readonly heard: CatSound[] = [];
  /** QA: the furthest a planted paw moved in one frame, and the furthest a leg was asked to reach past its length. */
  readonly probe = { slip: 0, reach: 0 };

  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly rig = new CatRig();
  private readonly gait = new CatGait();
  private readonly lookNow: CatLook = { blink: 0, pupil: 0.75, air: 0.6, wet: 0.35 };

  private doing: Doing = 'still';
  private pose: CatPose = 'sit';
  private onDone: (() => void) | null = null;
  private target: THREE.Vector3 | null = null;

  private frame: THREE.Object3D | null = null;
  private readonly frameMatrix = new THREE.Matrix4();
  private readonly frameInverse = new THREE.Matrix4();
  /** The point under it, the way it faces and the surface's up, all in the frame's space. */
  private readonly at = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3(0, 0, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private heading = 0;
  private floor: Floor | null = null;
  private level = 0;
  private onWall = false;
  /** Set when where it stands changed frames this update, so nothing measures across the change. */
  private reframed = false;
  /** An action given while it is in the air, played as soon as it is down. */
  private pending: (() => void) | null = null;
  private readonly support: Support;

  private route: Route | null = null;
  private along = 0;
  private speed = 0;
  private cruise = 0;
  private narrow = false;
  private then: CatPose = 'sit';
  private turnTo: number | null = null;
  private behind = 0;
  private turning = 0;

  private climbing: Route | null = null;
  private readonly wall = new THREE.Vector3();

  private air: Air = 'gather';
  private airT = 0;
  private airFor = 1;
  private gatherFor = 0.3;
  private landFor = 0.35;
  private leaping = false;
  private apex = 0;
  private fromFrame: THREE.Object3D | null = null;
  private readonly fromAt = new THREE.Vector3();
  private readonly fromQ = new THREE.Quaternion();
  private readonly fromPaws = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly released = [0, 0, 0, 0];
  private toFrame: THREE.Object3D | null = null;
  private readonly toAt = new THREE.Vector3();
  private readonly toFwd = new THREE.Vector3();
  private readonly toUp = new THREE.Vector3();
  private toFloor: Floor | null = null;
  private toYaw = 0;
  private toThen: CatPose = 'stand';
  private afterAir: (() => void) | null = null;
  private readonly flightAt = new THREE.Vector3();
  private readonly flightQ = new THREE.Quaternion();
  private flightPitch = 0;

  private readonly weights: Record<Hold, number> = { stand: 0, sit: 1, crouch: 0, gather: 0 };
  private readonly d: Drives;
  private readonly paws = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly homes = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  private readonly pawsWas = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly plantedWas = [false, false, false, false];

  private time = 0;
  private fear = 0;
  private readonly flinch = new Spring();
  private readonly dip = new Spring();
  private readonly earSpring = new Spring();
  private readonly tailSpring = new Spring();
  private readonly swayX = new Spring();
  private readonly swayZ = new Spring();
  private readonly frameVel = new THREE.Vector3();
  private readonly accel = new THREE.Vector3();
  private readonly frameWas = new THREE.Vector3();
  private frameFresh = true;
  private blinkT = -1;
  private nextBlink = 2;
  private nextMew = 1.2;
  private mewT = -1;
  private mewFor = 0.8;
  private chirpT = -1;
  private idle: 'wash' | 'flick' | 'glance' | 'blink' | null = null;
  private idleT = 0;
  private idleFor = 0;
  private nextIdle = 4;
  private readonly wander = new THREE.Vector2();
  private nextWander = 0;
  private twitchL = 0;
  private twitchR = 0;
  private readonly washAt = new THREE.Vector3();

  private readonly osc = { bodyY: 0, pitch: 0, flex: 0, roll: 0, head: 0 };
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly m = new THREE.Matrix4();

  constructor() {
    this.mat = catMaterial(this.rig.bones);
    this.mesh = new THREE.Mesh(catGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.support = {
      origin: this.at,
      forward: this.fwd,
      up: this.up,
      snap: (p) => this.snap(p),
    };
    this.d = {
      frame: new THREE.Matrix4(), scale: 1, origin: new THREE.Vector3(), forward: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0),
      bodyY: STANCES.sit.bodyY, bodyZ: 0, pitch: STANCES.sit.pitch, roll: 0, flex: 0, chestUp: STANCES.sit.chestUp, neckLow: 0,
      headYaw: 0, headPitch: 0, headRoll: 0, jaw: 0, earBack: 0, earTwitch: [0, 0],
      tailLift: 0, tailSwing: 0, tailCurl: 0, tailWrap: 1, tailWave: 0, tailFlick: 0,
      paws: this.paws.map((at) => ({ at, curl: 0 })), hock: [1.45, 1.45], breath: 0,
    };
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh];
  }

  /** True until the action it was last given has finished. */
  get busy(): boolean {
    return this.onDone !== null || this.doing !== 'still';
  }

  /** Where its eyes are, in the world: for the child's gaze and the camera. */
  eye(out: THREE.Vector3): THREE.Vector3 {
    return this.rig.joint(HEAD, out);
  }

  /** Turns its head to `target`, which it keeps following if it moves; null lets its gaze wander. */
  look(target: THREE.Vector3 | null): void {
    this.target = target;
  }

  /**
   * Puts it somewhere at once, for the room's start or a save: a point on `frame` (or in the world), which way it faces
   * there, how it holds itself, and the floor under it if it is on the world's roofs rather than a level surface.
   */
  place(at: THREE.Vector3, yaw: number, opts: { frame?: THREE.Object3D | null; pose?: CatPose; floor?: Floor | null } = {}): void {
    this.cancel();
    this.reframed = true;
    this.frame = opts.frame ?? null;
    this.updateFrame();
    this.at.copy(at);
    this.floor = this.frame ? null : opts.floor ?? null;
    this.level = at.y;
    this.snap(this.at);
    this.heading = yaw;
    this.up.set(0, 1, 0);
    this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.pose = opts.pose ?? 'sit';
    for (const p of POSES) this.weights[p] = p === this.pose ? 1 : 0;
    const s = STANCES[this.pose];
    Object.assign(this.d, { bodyY: s.bodyY, bodyZ: s.bodyZ, pitch: s.pitch, flex: s.flex, chestUp: s.chestUp, neckLow: s.neckLow, tailWrap: s.tailWrap });
    this.d.hock[0] = this.d.hock[1] = s.hock;
    this.doing = 'still';
    this.frameFresh = true;
    this.fear = this.unease;
    this.mewT = this.chirpT = this.blinkT = -1;
    this.idle = null;
    this.flinch.value = this.flinch.velocity = this.dip.value = this.dip.velocity = 0;
    this.homesFor(0);
    this.gait.reset(this.support, this.homes);
    this.syncWorld();
  }

  /** Stays where it is, held as `pose`, looking at `look` if given. */
  rest(pose: CatPose, look: THREE.Vector3 | null = this.target): void {
    if (this.airborne(() => this.rest(pose, look))) return;
    this.cancel();
    this.settleInto(pose);
    this.target = look;
  }

  /** Crouched where it is, tail wrapped, ears back, mewing every few seconds at `look`. */
  strand(look: THREE.Vector3 | null): void {
    this.rest('crouch', look);
    this.unease = Math.max(this.unease, 0.55);
    this.mewing = true;
  }

  /** Flinches and flattens at something frightening; it goes on with what it was doing, lower and warier. */
  afraid(amount = 1): void {
    this.fear = Math.min(1.2, this.fear + amount);
    this.flinch.velocity -= 0.9 * amount;
    this.earSpring.velocity += 6 * amount;
    this.blinkT = 0;
  }

  /** A plaintive mew now, the mouth keeping time with it. */
  mew(plea = 1): void {
    if (this.mewT >= 0) return;
    this.mewT = 0;
    this.mewFor = 0.6 + 0.3 * plea + Math.random() * 0.15;
    this.heard.push({ kind: 'mew', amount: 1, length: this.mewFor, plea });
  }

  /** Washes a paw now, if it is sitting: licks it and wipes it over its face. */
  wash(): void {
    this.idle = 'wash';
    this.idleT = 0;
    this.idleFor = 5.5;
  }

  /** "Mrrp?": arriving somewhere it wanted to be, or greeting. */
  chirrup(): void {
    this.chirpT = 0;
    this.heard.push({ kind: 'chirrup', amount: 1 });
  }

  /** A small jump to a point near by: a moment's gather, a quick arc, down. */
  hop(to: THREE.Vector3, opts: JumpOptions = {}, onDone?: () => void): void {
    this.jump(to, opts, false, onDone);
  }

  /** A real leap: it eyes the far side, gathers with a wiggle of the hips, springs, lands front paws first and settles. */
  leap(to: THREE.Vector3, opts: JumpOptions = {}, onDone?: () => void): void {
    this.jump(to, opts, true, onDone);
  }

  /**
   * Along `path`, points in the world whose heights come from `floor`, with every paw planted where it is put down.
   * It turns to the way first if it faces away, slows into the last point, then stops and holds `then`.
   */
  run(path: readonly THREE.Vector3[], floor: Floor, opts: RunOptions = {}, onDone?: () => void): void {
    if (this.airborne(() => this.run(path, floor, opts, onDone))) return;
    this.cancel();
    this.toWorld();
    this.floor = floor;
    const start = this.v.copy(this.at);
    const points = [start.clone(), ...path.map((p) => p.clone())];
    for (const p of points) p.y = floor(p.x, p.z);
    this.route = new Route(points);
    this.along = 0;
    this.narrow = opts.narrow ?? false;
    const pace = PACE[opts.pace ?? (this.narrow ? 'walk' : 'run')];
    this.gait.kind = pace.kind;
    this.cruise = opts.speed ?? (this.narrow ? NARROW_SPEED : pace.speed);
    this.then = opts.then ?? 'sit';
    if (opts.look !== undefined) this.target = opts.look;
    this.doing = 'path';
    this.onDone = onDone ?? null;
  }

  /**
   * Up a near-vertical way (ivy on a tower): `path` runs up the wall's face, `out` is the wall's outward normal, and
   * the last point is the floor of the opening it pulls itself into. It leaps onto the wall, climbs, and scrambles
   * over the lip, then holds `then` there looking at `look`.
   */
  climb(path: readonly THREE.Vector3[], out: THREE.Vector3, opts: { then?: CatPose; look?: THREE.Vector3 | null } = {}, onDone?: () => void): void {
    if (this.airborne(() => this.climb(path, out, opts, onDone))) return;
    this.cancel();
    this.toWorld();
    this.wall.copy(out).setY(0).normalize();
    const face = path.slice(0, -1);
    const ledge = path[path.length - 1].clone();
    const route = new Route(face);
    const first = route.at(0, new THREE.Vector3());
    const upWall = route.tangent(0, new THREE.Vector3());
    const inward = this.w.copy(this.wall).negate();
    const yawIn = Math.atan2(inward.x, inward.z);
    this.onDone = onDone ?? null;
    this.launch(first, null, upWall, this.wall, null, 0.12, true, 'stand', () => {
      this.climbing = route;
      this.along = 0;
      this.gait.kind = 'climb';
      this.doing = 'climb';
      this.speed = 0;
      this.floor = null;
      this.climbDone = () => {
        this.launch(ledge, null, new THREE.Vector3(Math.sin(yawIn), 0, Math.cos(yawIn)), UP, null, 0.08, false, opts.then ?? 'sit', () => this.finish(opts.then ?? 'sit'));
      };
    });
    if (opts.look !== undefined) this.target = opts.look;
    this.toYaw = yawIn;
  }
  private climbDone: (() => void) | null = null;

  private jump(to: THREE.Vector3, opts: JumpOptions, leap: boolean, onDone?: () => void): void {
    if (this.airborne(() => this.jump(to, opts, leap, onDone))) return;
    this.cancel();
    const frame = opts.frame ?? null;
    this.onDone = onDone ?? null;
    const then = opts.then ?? 'stand';
    const there = this.w2.copy(to);
    if (frame) there.applyMatrix4(worldOf(frame));
    const span = Math.hypot(there.x - this.position.x, there.z - this.position.z);
    let yaw = opts.yaw;
    if (yaw === undefined) {
      const away = Math.atan2(there.x - this.position.x, there.z - this.position.z);
      if (frame) {
        frame.getWorldQuaternion(this.q);
        const f = this.w.set(Math.sin(away), 0, Math.cos(away)).applyQuaternion(this.q.invert());
        yaw = Math.atan2(f.x, f.z);
      } else yaw = away;
    }
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const arc = opts.arc ?? (leap ? 0.12 + span * 0.1 : 0.06 + span * 0.08);
    if (opts.look !== undefined) this.target = opts.look;
    this.launch(to, frame, fwd, UP, frame ? null : opts.floor ?? null, arc, leap, then, () => this.finish(then));
  }

  /** Sets up a flight from where it stands to a point on something, eyed, gathered for, flown and landed. */
  private launch(to: THREE.Vector3, frame: THREE.Object3D | null, fwd: THREE.Vector3, up: THREE.Vector3, floor: Floor | null, arc: number, leap: boolean, then: CatPose, after: () => void): void {
    this.doing = 'air';
    this.air = 'gather';
    this.airT = 0;
    this.leaping = leap;
    this.gatherFor = leap ? 0.75 : 0.28;
    this.landFor = leap ? 0.4 : 0.28;
    this.toFrame = frame;
    this.toAt.copy(to);
    this.toFwd.copy(fwd).normalize();
    this.toUp.copy(up).normalize();
    this.toFloor = floor;
    this.toThen = then;
    this.apex = arc;
    this.afterAir = after;
    this.toYaw = Math.atan2(fwd.x, fwd.z);
  }

  private finish(pose: CatPose): void {
    this.settleInto(pose);
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  /** Holds `pose` where it is; if what it is told to look at is behind it, it turns round to it first. */
  private settleInto(pose: CatPose): void {
    this.doing = 'still';
    this.pose = pose;
    this.route = null;
    this.climbing = null;
    this.turnTo = null;
    if (pose !== 'stand' && this.target && !this.onWall) {
      const local = this.toLocal(this.target, this.w);
      const off = Math.atan2(local.x, local.z);
      if (Math.abs(off) > 1.0) this.turnTo = this.heading + off * 0.85;
    }
  }

  /** Drops whatever it was doing without calling it back, keeping where it is and the way it is moving. */
  private cancel(): void {
    this.pending = null;
    this.onDone = null;
    this.afterAir = null;
    this.climbDone = null;
    this.route = null;
    this.climbing = null;
    this.turnTo = null;
    if (this.doing !== 'still') {
      this.doing = 'still';
      this.pose = 'stand';
    }
    this.onWall = false;
  }

  /** True if it is in the air, in which case `act` is kept to be played once it is down. */
  private airborne(act: () => void): boolean {
    if (this.doing !== 'air' || this.air === 'gather') return false;
    this.pending = act;
    return true;
  }

  /** Moves everything about where it stands out of the frame it is on and into the world, keeping it where it is. */
  private toWorld(): void {
    if (!this.frame) return;
    this.updateFrame();
    const f = this.frameMatrix;
    this.at.applyMatrix4(f);
    this.fwd.transformDirection(f);
    this.up.transformDirection(f);
    for (const p of this.gait.paws) p.at.applyMatrix4(f);
    for (const p of this.paws) p.applyMatrix4(f);
    this.frame = null;
    this.updateFrame();
    this.fwd.addScaledVector(UP, -this.fwd.dot(UP)).normalize();
    this.up.copy(UP);
    this.heading = Math.atan2(this.fwd.x, this.fwd.z);
    this.level = this.at.y;
    this.floor = null;
    this.onWall = false;
    this.reframed = true;
    this.gait.plantAt(this.support, this.gait.paws.map((p) => p.at), this.heading);
  }

  private updateFrame(): void {
    if (this.frame) {
      this.frame.updateWorldMatrix(true, false);
      this.frameMatrix.copy(this.frame.matrixWorld);
    } else this.frameMatrix.identity();
    this.frameInverse.copy(this.frameMatrix).invert();
  }

  private snap(p: THREE.Vector3): void {
    if (this.onWall) {
      p.addScaledVector(this.up, -this.v.subVectors(p, this.at).dot(this.up));
    } else if (this.floor) p.y = this.floor(p.x, p.z);
    else p.y = this.level;
  }

  private homesFor(narrow: number): void {
    const w = this.weights;
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const side = i % 2 === 0 ? 1 : -1;
      let x = 0;
      let y = 0;
      for (const p of POSES) {
        const h = front ? STANCES[p].front : STANCES[p].hind;
        x += h[0] * w[p];
        y += h[1] * w[p];
      }
      this.homes[i].set(side * THREE.MathUtils.lerp(x, front ? 0.006 : 0.01, narrow), y).multiplyScalar(this.scale);
    }
  }

  update(dt: number): void {
    this.mesh.visible = this.visible;
    if (!this.visible) return;
    this.time += dt;
    this.updateFrame();

    if (this.doing === 'path') this.follow(dt);
    else if (this.doing === 'climb') this.clamber(dt);
    else if (this.doing === 'still') this.standStill(dt);

    const wantPose: Hold = this.doing === 'still' && this.turnTo === null ? this.pose : this.doing === 'air' && this.air === 'gather' ? 'gather' : 'stand';
    for (const p of POSES) this.weights[p] = ease(this.weights[p], p === wantPose ? 1 : 0, this.doing === 'air' ? 14 : 5, dt);
    this.homesFor(this.narrow && this.doing === 'path' ? 1 : 0);

    if (this.doing === 'air') this.fly(dt);
    else {
      const lift = (this.gait.kind === 'bound' ? 0.05 : this.gait.kind === 'trot' ? 0.035 : 0.028) * this.scale;
      this.gait.scale = this.scale;
      this.gait.update(dt, this.support, this.heading, this.homes, lift);
      const tuck = POSES.reduce((sum, p) => sum + STANCES[p].tuck * this.weights[p], 0);
      for (let i = 0; i < 4; i++) {
        this.paws[i].copy(this.gait.paws[i].at);
        this.d.paws[i].curl = Math.max(this.gait.paws[i].curl, i < 2 && this.gait.paws[i].planted ? tuck : 0);
      }
      if (this.gait.landed.length) this.heard.push(this.onWall ? { kind: 'scrabble', amount: 0.6 } : { kind: 'pat', amount: 0.4 + this.gait.pace });
    }

    this.moods(dt);
    this.drive(dt);
    this.syncWorld();
    this.measure();
  }

  /** Standing still: turning to face what it is told to look at before it settles, and its idles once it has. */
  private standStill(dt: number): void {
    /** Something it is watching that stays well behind it: before long it gets up and turns round to it. */
    if (this.turnTo === null && this.target && !this.frame && this.weights[this.pose] > 0.9) {
      const off = Math.atan2(this.toLocal(this.target, this.w).x, this.w.z);
      this.behind = Math.abs(off) > 1.75 ? this.behind + dt : 0;
      if (this.behind > 1.2) {
        this.turnTo = this.heading + off * 0.85;
        this.behind = 0;
      }
    }
    if (this.turnTo !== null) {
      /** Round on the spot at a cat's own unhurried pace, easing in and out of it. */
      const err = wrapAngle(this.turnTo - this.heading);
      this.turning = ease(this.turning, clamp(err * 3, -2.6, 2.6), 8, dt);
      this.heading += this.turning * dt;
      this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
      if (Math.abs(err) < 0.04 && Math.abs(this.turning) < 0.2) {
        this.turnTo = null;
        this.turning = 0;
      }
    }
  }

  /** Heads round toward `want` as fast as `rate` would ease it, but never faster than `most` radians a second. */
  private turnToward(want: number, rate: number, most: number, dt: number): void {
    this.heading += clamp(wrapAngle(want - this.heading) * (1 - Math.exp(-rate * dt)), -most * dt, most * dt);
  }

  private follow(dt: number): void {
    const route = this.route!;
    const left = route.length - this.along;
    const tangent = route.tangent(Math.min(route.length, this.along + 0.08), this.w);
    const want = Math.atan2(tangent.x, tangent.z);
    const off = Math.abs(wrapAngle(want - this.heading));
    /** Facing well away, it turns on the spot first rather than setting off sideways. */
    const facing = clamp((Math.cos(off) - 0.2) / 0.8, 0, 1);
    const brake = Math.sqrt(2 * (this.gait.kind === 'bound' ? 5 : 2.5) * Math.max(0, left));
    const goal = Math.min(this.cruise * facing, brake);
    this.speed = goal > this.speed ? ease(this.speed, goal, this.gait.kind === 'bound' ? 3 : 4, dt) : goal;
    this.along = Math.min(route.length, this.along + this.speed * dt);
    route.at(this.along, this.at);
    this.at.y = this.floor!(this.at.x, this.at.z);
    this.turnToward(want, 7, this.speed > 0.5 ? 6 : 2.6, dt);
    this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    if (left < 0.004 && this.speed < 0.05) {
      this.speed = 0;
      this.settleInto(this.then);
      const done = this.onDone;
      this.onDone = null;
      done?.();
    }
  }

  private clamber(dt: number): void {
    const route = this.climbing!;
    const left = route.length - this.along;
    this.speed = Math.min(ease(this.speed, CLIMB_SPEED, 3, dt), Math.sqrt(2 * 3 * Math.max(0, left)) + 0.15);
    this.along = Math.min(route.length, this.along + this.speed * dt);
    route.at(this.along, this.at);
    route.tangent(this.along, this.fwd, 0.1);
    this.up.copy(this.wall);
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    if (left < 0.01) {
      this.climbing = null;
      const next = this.climbDone;
      this.climbDone = null;
      next?.();
    }
  }

  private fly(dt: number): void {
    if (this.air === 'gather') {
      /** It turns to face where it is going and settles its weight back before it springs. */
      const there = this.v.copy(this.toAt);
      if (this.toFrame) there.applyMatrix4(worldOf(this.toFrame));
      there.applyMatrix4(this.frameInverse);
      if (this.up.y > 0.9) {
        const want = Math.atan2(there.x - this.at.x, there.z - this.at.z);
        this.turnToward(want, 6, 3, dt);
        this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
      }
      this.gait.update(dt, this.support, this.heading, this.homes, 0.02 * this.scale);
      for (let i = 0; i < 4; i++) this.paws[i].copy(this.gait.paws[i].at);
      this.airT += dt;
      if (this.airT >= this.gatherFor && (this.gait.still || this.airT >= this.gatherFor + 0.3)) this.takeOff();
      return;
    }
    if (this.air === 'fly') {
      this.airT += dt / this.airFor;
      this.flight(Math.min(1, this.airT));
      if (this.airT >= 1) this.touchDown();
      return;
    }
    this.airT += dt;
    this.gait.update(dt, this.support, this.heading, this.homes, 0.02 * this.scale);
    for (let i = 0; i < 4; i++) this.paws[i].copy(this.gait.paws[i].at);
    if (this.airT >= this.landFor) {
      const after = this.afterAir;
      const pending = this.pending;
      this.afterAir = null;
      this.pending = null;
      this.doing = 'still';
      if (pending) pending();
      else after?.();
    }
  }

  private readonly startW = new THREE.Vector3();
  private readonly endW = new THREE.Vector3();
  private readonly endQ = new THREE.Quaternion();
  private upFor = 0;
  private downFor = 0;

  private takeOff(): void {
    this.fromFrame = this.frame;
    this.fromAt.copy(this.at);
    this.basisQuat(this.up, this.fwd, this.fromQ);
    if (this.frame) this.fromQ.premultiply(this.frame.getWorldQuaternion(this.q));
    for (let i = 0; i < 4; i++) {
      this.fromPaws[i].copy(this.paws[i]);
      this.released[i] = i < 2 ? 0.0001 : 0;
    }
    this.startW.copy(this.at).applyMatrix4(this.frameMatrix);
    this.ends();
    const top = Math.max(this.startW.y, this.endW.y) + this.apex;
    this.upFor = Math.sqrt((2 * (top - this.startW.y)) / GRAVITY);
    this.downFor = Math.sqrt((2 * (top - this.endW.y)) / GRAVITY);
    this.airFor = Math.max(0.18, this.upFor + this.downFor);
    this.air = 'fly';
    this.airT = 0;
    this.at.copy(this.startW);
    this.fwd.transformDirection(this.frameMatrix);
    this.up.transformDirection(this.frameMatrix);
    for (const p of this.paws) p.applyMatrix4(this.frameMatrix);
    this.frame = null;
    this.onWall = false;
    this.reframed = true;
    this.updateFrame();
    this.flightPitch = 0;
    this.heard.push({ kind: 'pat', amount: 0.8 });
  }

  /** Where it will come down, in the world this frame: the thing it lands on may have moved since it set off. */
  private ends(): void {
    this.endW.copy(this.toAt);
    if (this.toFrame) {
      this.endW.applyMatrix4(worldOf(this.toFrame));
      this.toFrame.getWorldQuaternion(this.q);
    } else this.q.identity();
    if (this.toFloor) this.endW.y = this.toFloor(this.endW.x, this.endW.z);
    this.basisQuat(this.toUp, this.toFwd, this.endQ).premultiply(this.q);
  }

  private basisQuat(up: THREE.Vector3, fwd: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
    const side = this.w.crossVectors(up, fwd).normalize();
    this.m.makeBasis(side, up, fwd);
    return out.setFromRotationMatrix(this.m);
  }

  private readonly startNow = new THREE.Vector3();
  private readonly bodyPaw = new THREE.Vector3();
  private readonly landPaw = new THREE.Vector3();

  /** The body on its arc, and each paw leaving where it pushed off, held to the body in the air, and reaching for where it lands. */
  private flight(t: number): void {
    this.ends();
    this.startNow.copy(this.fromAt);
    if (this.fromFrame) this.startNow.applyMatrix4(worldOf(this.fromFrame));
    const top = Math.max(this.startW.y, this.endW.y) + this.apex;
    const tau = t * this.airFor;
    const y = tau < this.upFor ? this.startW.y + (top - this.startW.y) * (1 - (1 - tau / this.upFor) ** 2) : top - (top - this.endW.y) * ((tau - this.upFor) / this.downFor) ** 2;
    this.flightAt.lerpVectors(this.startNow, this.endW, t);
    this.flightAt.y = y;
    const vy = tau < this.upFor ? (2 * (top - this.startW.y)) / this.upFor * (1 - tau / this.upFor) : (-2 * (top - this.endW.y) * (tau - this.upFor)) / (this.downFor * this.downFor);
    const vh = Math.hypot(this.endW.x - this.startNow.x, this.endW.z - this.startNow.z) / this.airFor;
    this.flightQ.slerpQuaternions(this.fromQ, this.endQ, smooth(t * 1.15 - 0.05));
    const upright = Math.min(this.v.set(0, 1, 0).applyQuaternion(this.fromQ).y, this.w.set(0, 1, 0).applyQuaternion(this.endQ).y);
    this.flightPitch = upright * clamp(Math.atan2(vy, Math.max(vh, 0.6)) * 0.5, -0.5, 0.5);
    this.at.copy(this.flightAt);
    this.fwd.set(0, 0, 1).applyQuaternion(this.flightQ);
    this.up.set(0, 1, 0).applyQuaternion(this.flightQ);
    this.heading = Math.atan2(this.fwd.x, this.fwd.z);

    const side = this.side.crossVectors(this.up, this.fwd).normalize();
    /** The body's own axes in the air, tipped along the arc. */
    const p = this.flightPitch;
    const along = this.along3.copy(this.fwd).multiplyScalar(Math.cos(p)).addScaledVector(this.up, Math.sin(p));
    const down = this.down3.copy(this.up).multiplyScalar(-Math.cos(p)).addScaledVector(this.fwd, Math.sin(p));
    const k = this.scale;
    const body = this.body3.copy(this.at).addScaledVector(this.up, 0.155 * k);
    const stretch = Math.sin(t * Math.PI);
    const tuck = smooth((t - 0.35) / 0.4);
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const s = i % 2 === 0 ? 1 : -1;
      /** In the air the front paws reach on ahead along the body; the hind ones trail out long behind, then come under it. */
      if (front) {
        this.bodyPaw.copy(body).addScaledVector(along, (0.15 + 0.07 * stretch) * k).addScaledVector(down, (0.1 - 0.05 * stretch) * k);
      } else {
        this.bodyPaw.copy(body).addScaledVector(along, (-0.2 * (1 - tuck) - 0.04 * tuck) * k).addScaledVector(down, (0.07 + 0.06 * tuck) * k);
      }
      this.bodyPaw.addScaledVector(side, s * (front ? 0.026 : 0.036) * k);
      const home = this.homes[i];
      const sideEnd = this.v.set(1, 0, 0).applyQuaternion(this.endQ);
      const fwdEnd = this.w2.set(0, 0, 1).applyQuaternion(this.endQ);
      this.landPaw.copy(this.endW).addScaledVector(sideEnd, home.x).addScaledVector(fwdEnd, home.y + (front ? 0.03 : -0.01));
      if (this.toFloor) this.landPaw.y = this.toFloor(this.landPaw.x, this.landPaw.z);
      const from = this.v.copy(this.fromPaws[i]);
      if (this.fromFrame) from.applyMatrix4(worldOf(this.fromFrame));
      const leave = front ? smooth(t / 0.16) : smooth((t - 0.1) / 0.18);
      const arrive = front ? smooth((t - 0.7) / 0.24) : smooth((t - 0.78) / 0.22);
      this.paws[i].lerpVectors(from, this.bodyPaw, leave).lerp(this.landPaw, arrive);
      this.d.paws[i].curl = front ? 0.5 * leave * (1 - arrive) : 0.9 * Math.sin(leave * Math.PI) + 0.5 * tuck * (1 - arrive);
    }
  }
  private readonly along3 = new THREE.Vector3();
  private readonly down3 = new THREE.Vector3();
  private readonly body3 = new THREE.Vector3();
  private readonly w2 = new THREE.Vector3();
  private readonly side = new THREE.Vector3();

  /** Down: it is now on what it jumped to, every paw where it touched, and it takes the landing in its legs. */
  private touchDown(): void {
    this.ends();
    this.frame = this.toFrame;
    this.updateFrame();
    const local = this.v.copy(this.endW).applyMatrix4(this.frameInverse);
    this.at.copy(local);
    this.floor = this.frame ? null : this.toFloor;
    this.level = local.y;
    this.fwd.copy(this.toFwd);
    this.up.copy(this.toUp);
    this.onWall = this.toUp.y < 0.5;
    this.heading = this.toYaw;
    this.reframed = true;
    for (let i = 0; i < 4; i++) this.paws[i].applyMatrix4(this.frameInverse);
    this.gait.plantAt(this.support, this.paws, this.heading);
    this.air = 'land';
    this.airT = 0;
    this.dip.velocity -= this.leaping ? 1.1 : 0.7;
    this.frameFresh = true;
    this.pose = this.toThen;
    this.heard.push({ kind: 'land', amount: this.leaping ? 1 : 0.6 });
  }

  /** How it feels, eased: fear spent over a few seconds back down to the unease underneath it. */
  private moods(dt: number): void {
    this.fear = Math.max(this.unease, ease(this.fear, this.unease, 0.5, dt));
    if (this.mewing && this.mewT < 0) {
      this.nextMew -= dt;
      if (this.nextMew <= 0) {
        this.mew(0.7 + 0.3 * Math.min(1, this.fear + 0.3));
        this.nextMew = 2.6 + Math.random() * 2.4;
      }
    }
    if (this.mewT >= 0) {
      this.mewT += dt;
      if (this.mewT > this.mewFor) this.mewT = -1;
    }
    if (this.chirpT >= 0) {
      this.chirpT += dt;
      if (this.chirpT > 0.3) this.chirpT = -1;
    }
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT < 0) {
      this.blinkT = 0;
      this.nextBlink = 2.5 + Math.random() * 4;
    }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.16) this.blinkT = -1;
    }
    this.nextWander -= dt;
    if (this.nextWander <= 0) {
      this.wander.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.4) * 0.5);
      this.nextWander = 1.5 + Math.random() * 3;
    }
    const twitch = (x: number) => (Math.random() < dt * 0.25 ? 1 : x * Math.exp(-dt * 6));
    this.twitchL = twitch(this.twitchL);
    this.twitchR = twitch(this.twitchR);
    this.idles(dt);
  }

  /** Sitting with nothing asked of it: it washes a paw, flicks its tail, glances at what it is curious about, slow-blinks. */
  private idles(dt: number): void {
    const sitting = this.doing === 'still' && this.turnTo === null && this.weights.sit > 0.9;
    if (this.idle) {
      this.idleT += dt;
      if (this.idleT >= this.idleFor || (!sitting && this.idle === 'wash')) this.idle = null;
      return;
    }
    if (!sitting || this.mewT >= 0) return;
    this.nextIdle -= dt;
    if (this.nextIdle > 0) return;
    const r = Math.random();
    const calm = this.fear < 0.4;
    this.idle = calm && r < 0.35 ? 'wash' : this.curious && r < 0.6 ? 'glance' : r < 0.8 ? 'flick' : 'blink';
    this.idleFor = { wash: 5.5, glance: 2.2, flick: 1.1, blink: 1.6 }[this.idle];
    this.idleT = 0;
    this.nextIdle = 2.5 + Math.random() * 4;
  }

  private drive(dt: number): void {
    const d = this.d;
    const w = this.weights;
    const blend = (k: keyof Omit<Stance, 'front' | 'hind'>) => POSES.reduce((sum, p) => sum + STANCES[p][k] * w[p], 0);
    let bodyY = blend('bodyY');
    let bodyZ = blend('bodyZ');
    let pitch = blend('pitch');
    let flex = blend('flex');
    let chestUp = blend('chestUp');
    let neckLow = blend('neckLow');
    let hock = blend('hock');
    let tailUp = blend('tailUp');
    let tailCurl = blend('tailCurl');
    let tailWrap = blend('tailWrap');
    let roll = 0;
    let earBack = 0;
    let headYaw = this.wander.x;
    let headPitch = this.wander.y * 0.5;
    let headRoll = 0;
    let jaw = 0;
    let tailWave = 0.25;
    let tailFlick = 0;
    let pupil = 0.7;

    const fear = clamp(this.fear, 0, 1.2);
    const flinch = this.flinch.step(0, 90, 11, dt);
    bodyY += flinch * 0.05 - fear * 0.022;
    neckLow += fear * 0.35;
    earBack += fear;
    tailUp -= fear * 0.4;
    tailWave *= 1 - fear * 0.7;
    pupil += fear * 0.3;

    const osc = this.osc;
    osc.bodyY = osc.pitch = osc.flex = osc.roll = osc.head = 0;
    if (this.doing === 'path' || this.doing === 'climb') {
      const g = this.gait;
      const ph = g.phase * Math.PI * 2;
      const k = clamp(g.speed / Math.max(this.cruise, 0.3), 0, 1);
      if (g.kind === 'bound') {
        /**
         * The half bound: gathered with the hind paws reaching under it just before they land (0.88 of the cycle),
         * thrown long and high as they push off (0.38), the nose lifting with the push and dipping onto the front paws.
         */
        osc.flex = 0.38 * Math.cos(ph - 0.88 * Math.PI * 2) * k;
        osc.pitch = 0.13 * Math.cos(ph - 0.3 * Math.PI * 2) * k;
        osc.bodyY = 0.016 * Math.cos(2 * ph - 0.38 * Math.PI * 4) * k;
        osc.head = 0.3 * osc.pitch;
        bodyY -= 0.008 * k;
        neckLow -= 0.25 * k;
        tailUp = THREE.MathUtils.lerp(tailUp, 0.2, k);
        tailCurl = THREE.MathUtils.lerp(tailCurl, -0.05, k);
        earBack += 0.3 * k;
      } else if (g.kind === 'trot') {
        osc.bodyY = 0.007 * Math.cos(2 * ph) * k;
        osc.roll = 0.025 * Math.sin(ph) * k;
        osc.flex = 0.04 * Math.cos(2 * ph) * k;
        tailUp = THREE.MathUtils.lerp(tailUp, 0.95, k);
        tailCurl = THREE.MathUtils.lerp(tailCurl, 0.22, k);
      } else if (g.kind === 'walk') {
        osc.bodyY = -0.004 * Math.cos(2 * ph) * k;
        osc.roll = 0.035 * Math.sin(ph) * k;
        osc.head = 0.03 * Math.cos(2 * ph) * k;
        tailUp = THREE.MathUtils.lerp(tailUp, this.narrow ? 0.1 : 1.05, k);
        tailCurl = THREE.MathUtils.lerp(tailCurl, this.narrow ? -0.02 : 0.25, k);
        if (this.narrow) {
          bodyY -= 0.018;
          neckLow += 0.3;
          headPitch = -0.45;
          headYaw *= 0.2;
          tailWave = 0;
        }
      } else {
        osc.flex = 0.2 * Math.cos(ph) * k;
        bodyY -= 0.055;
        tailUp = -0.5;
        tailCurl = 0;
        headPitch = 0.15;
        headYaw *= 0.2;
      }
      tailWrap = 0;
      if (!this.narrow) {
        headYaw *= 0.35;
        headPitch = THREE.MathUtils.lerp(headPitch, -0.1, k);
      }
    }

    if (this.doing === 'air') {
      tailWrap = 0;
      const gather = this.air === 'gather' ? smooth(this.airT / Math.min(0.25, this.gatherFor)) : 0;
      if (this.air === 'gather') {
        bodyY -= (this.leaping ? 0.012 : 0) * gather;
        if (this.leaping && this.airT > 0.2 && this.airT < this.gatherFor - 0.1) {
          /** The wiggle: the hindquarters shuffle from side to side while the eyes stay fixed on the far side. */
          roll += 0.07 * Math.sin((this.airT - 0.2) * 22) * smooth((this.airT - 0.2) / 0.1);
          tailFlick = Math.sin(this.airT * 15) * 0.6;
        }
        pupil += 0.15;
      } else if (this.air === 'fly') {
        const t = Math.min(1, this.airT);
        flex += -0.25 * Math.sin(t * Math.PI) + 0.12 * smooth((t - 0.75) / 0.25);
        pitch += this.flightPitch;
        bodyY = THREE.MathUtils.lerp(0.15, 0.16, t);
        tailUp = 0.1 + 0.25 * Math.sin(t * Math.PI);
        tailCurl = -0.05;
        neckLow -= 0.15;
        hock = 0.7 + 0.6 * Math.sin(t * Math.PI);
        earBack += 0.2;
      } else {
        const t = this.airT / this.landFor;
        tailUp += 0.2 * (1 - t);
      }
    }

    /** It looks at what it is told to, or at where it is going when it is about to jump. */
    const gaze = this.doing === 'air' && this.air === 'gather' ? this.v.copy(this.toAt).applyMatrix4(this.toFrame ? worldOf(this.toFrame) : IDENTITY) : this.idle === 'glance' && this.curious ? this.curious : this.target;
    if (gaze && !(this.doing === 'climb')) {
      const local = this.toLocal(gaze, this.w);
      const yaw = Math.atan2(local.x, local.z - 0.12);
      const pitchTo = Math.atan2(local.y - 0.28, Math.hypot(local.x, local.z - 0.12));
      const free = this.doing === 'path' && !this.narrow ? 0.6 : 1.5;
      headYaw = clamp(yaw, -free, free);
      headPitch = clamp(pitchTo, -0.9, 0.8);
    }

    if (this.idle === 'wash') {
      const t = this.idleT / this.idleFor;
      const up = smooth(t / 0.12) * (1 - smooth((t - 0.85) / 0.15));
      headYaw = THREE.MathUtils.lerp(headYaw, 0.1, up);
      headPitch = THREE.MathUtils.lerp(headPitch, -0.55 + 0.1 * Math.sin(this.idleT * 22), up);
      headRoll = 0.25 * up * smooth((t - 0.5) / 0.1);
      jaw = up * (0.25 + 0.2 * Math.sin(this.idleT * 22));
      this.rig.joint(JAW, this.washAt);
      this.washAt.applyMatrix4(this.frameInverse);
      this.paws[1].lerp(this.washAt.addScaledVector(this.up, -0.035 * this.scale), up * 0.92);
      this.d.paws[1].curl = 1.4 * up;
    }
    if (this.idle === 'flick') tailFlick = Math.sin((this.idleT / this.idleFor) * Math.PI * 3) * 0.9;
    if (this.mewT >= 0) {
      const u = this.mewT / this.mewFor;
      const open = Math.sin(Math.min(1, u * 1.1) * Math.PI) ** 0.7;
      jaw = Math.max(jaw, open * 0.95);
      headPitch += open * 0.18;
      earBack = Math.max(earBack * 0.8, 0.25 * open);
    }
    if (this.chirpT >= 0) {
      const open = Math.sin((this.chirpT / 0.3) * Math.PI);
      jaw = Math.max(jaw, open * 0.4);
      headPitch += open * 0.1;
      headRoll += open * 0.15;
    }

    /** Riding something that rocks, its body sways after the motion and, unless it is watching something, its head stays level. */
    if (this.frame && this.doing !== 'air') {
      const now = this.v.setFromMatrixPosition(this.frameMatrix);
      if (this.frameFresh) {
        this.frameWas.copy(now);
        this.frameVel.set(0, 0, 0);
        this.frameFresh = false;
      }
      const vel = this.w.subVectors(now, this.frameWas).divideScalar(Math.max(dt, 1e-3));
      const acc = this.accel.subVectors(vel, this.frameVel).divideScalar(Math.max(dt, 1e-3));
      this.frameVel.copy(vel);
      this.frameWas.copy(now);
      const push = acc.length();
      acc.transformDirection(this.frameInverse).multiplyScalar(push);
      const across = acc.x * this.fwd.z - acc.z * this.fwd.x;
      const ahead = acc.x * this.fwd.x + acc.z * this.fwd.z;
      this.swayX.velocity += clamp(-across, -8, 8) * dt * 0.04;
      this.swayZ.velocity += clamp(-ahead, -8, 8) * dt * 0.04;
      if (!gaze) {
        const sideW = this.v.set(this.fwd.z, 0, -this.fwd.x).transformDirection(this.frameMatrix);
        headRoll -= Math.asin(clamp(sideW.y, -1, 1)) * 0.7;
        const fwdW = this.w.copy(this.fwd).transformDirection(this.frameMatrix);
        headPitch -= Math.asin(clamp(fwdW.y, -1, 1)) * 0.6;
      }
    }
    roll += this.swayX.step(0, 30, 5, dt) * 2;
    bodyZ += this.swayZ.step(0, 30, 5, dt) * 0.06;

    const dip = this.dip.step(0, 70, 9, dt);
    bodyY += dip * 0.05;
    flex -= dip * 0.4;

    const ears = this.earSpring.step(clamp(earBack, 0, 1), 140, 12, dt);
    const tailRate = this.doing === 'air' || this.doing === 'path' ? 14 : 4;
    const rate = this.doing === 'air' ? 16 : this.doing === 'path' ? 12 : 6;
    d.bodyY = ease(d.bodyY, bodyY, rate, dt);
    d.bodyZ = ease(d.bodyZ, bodyZ, rate, dt);
    d.pitch = ease(d.pitch, pitch, rate, dt);
    d.roll = ease(d.roll, roll, rate, dt);
    d.flex = ease(d.flex, flex, rate, dt);
    d.chestUp = ease(d.chestUp, chestUp, rate * 0.8, dt);
    d.neckLow = ease(d.neckLow, neckLow, 6, dt);
    d.headYaw = ease(d.headYaw, headYaw, 7, dt);
    d.headPitch = ease(d.headPitch, headPitch, 7, dt);
    d.headRoll = ease(d.headRoll, headRoll, 6, dt);
    d.jaw = ease(d.jaw, jaw, 18, dt);
    d.earBack = clamp(ears, -0.1, 0.95);
    d.earTwitch[0] = this.twitchL * (1 - d.earBack);
    d.earTwitch[1] = -this.twitchR * (1 - d.earBack);
    const hockRate = this.doing === 'air' ? 12 : 6;
    d.hock[0] = ease(d.hock[0], hock, hockRate, dt);
    d.hock[1] = ease(d.hock[1], hock, hockRate, dt);
    /** The tail is held against the level, not the back, so it stays up while the body tips. */
    d.tailLift = ease(d.tailLift, tailUp + d.pitch + 0.9 * d.flex, tailRate, dt);
    d.tailCurl = ease(d.tailCurl, tailCurl, tailRate, dt);
    d.tailWrap = ease(d.tailWrap, tailWrap, 3, dt);
    d.tailSwing = this.tailSpring.step(this.narrow && this.doing === 'path' ? -d.roll * 6 + Math.sin(this.time * 1.3) * 0.25 : 0, 20, 4, dt);
    d.tailWave += dt * (1.2 + 2 * fear) * (tailWave > 0 ? 1 : 0.3);
    d.tailFlick = ease(d.tailFlick, tailFlick, 14, dt);
    d.breath += dt * (1.6 + fear * 2.5 + (this.doing === 'path' ? 2 : 0));

    const look = this.lookNow;
    const blink = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.16) * Math.PI) : 0;
    const slow = this.idle === 'blink' ? Math.sin((this.idleT / this.idleFor) * Math.PI) ** 0.6 * 0.85 : 0;
    look.blink = Math.max(blink, slow);
    look.pupil = clamp(pupil, 0.35, 0.9);
    look.air = 0.6;
    look.wet = this.wet;
    applyCatLook(this.mat, look);

    /** What the gait swings to and fro is laid over the eased pose rather than eased itself, so it keeps its full stride. */
    d.bodyY += osc.bodyY;
    d.pitch += osc.pitch;
    d.flex += osc.flex;
    d.roll += osc.roll;
    d.headPitch += osc.head;
    d.scale = this.scale;
    d.frame.copy(this.frameMatrix);
    d.origin.copy(this.at);
    d.forward.copy(this.fwd);
    d.up.copy(this.up);
    this.rig.pose(d);
    d.bodyY -= osc.bodyY;
    d.pitch -= osc.pitch;
    d.flex -= osc.flex;
    d.roll -= osc.roll;
    d.headPitch -= osc.head;
  }

  /** A point in the world in the cat's own space: across to its left, up off what it stands on, and ahead. */
  private toLocal(p: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(p).applyMatrix4(this.frameInverse).sub(this.at);
    const side = this.v.crossVectors(this.up, this.fwd).normalize();
    const x = out.dot(side);
    const y = out.dot(this.up);
    const z = out.dot(this.fwd);
    return out.set(x, y, z).divideScalar(this.scale);
  }

  private syncWorld(): void {
    this.position.copy(this.at).applyMatrix4(this.frameMatrix);
    const f = this.v.copy(this.fwd).transformDirection(this.frameMatrix);
    this.yaw = Math.atan2(f.x, f.z);
  }

  private readonly pawW = new THREE.Vector3();

  private measure(): void {
    if (this.reframed) {
      this.reframed = false;
      this.plantedWas.fill(false);
    }
    for (let i = 0; i < 4; i++) {
      const planted = this.doing !== 'air' && this.gait.paws[i].planted && !(this.idle === 'wash' && i === 1);
      this.pawW.copy(this.paws[i]);
      if (planted && this.plantedWas[i]) this.probe.slip = Math.max(this.probe.slip, this.pawW.distanceTo(this.pawsWas[i]));
      this.pawsWas[i].copy(this.pawW);
      this.plantedWas[i] = planted;
    }
  }
}

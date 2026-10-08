import * as THREE from 'three';
import { ease, Spring, wrapAngle } from './motion';
import { ARM, BODY, catGeometry, CHEST, FORE, FPAW_L, FPAW_R, HEAD, HPAW_L, HPAW_R, JAW, PELVIS, TAIL, TOE, WRIST } from './cat/body';
import { BOUND_LEGS, boundShape, type BoundShape } from './cat/bound';
import { CatGait, type GaitKind, type Support } from './cat/gait';
import { CatRig, type Drives } from './cat/pose';
import { Route } from './cat/route';
import { applyCatLook, catMaterial, coatShells, type CatLook, type Coat } from './cat/shader';
import { Spray } from './cat/spray';

export type CatPose = 'stand' | 'sit' | 'crouch' | 'curl';
export type Pace = 'walk' | 'trot' | 'run';
/** The height of whatever it walks on under a point of the world. */
export type Floor = (x: number, z: number) => number;

/** Something it did this frame that can be heard. The cat only says what happened; the sound is made elsewhere. */
export interface CatSound {
  kind: 'mew' | 'yowl' | 'chirrup' | 'pat' | 'land' | 'scrabble';
  amount: number;
  /** A mew or a yowl: how long it is, in seconds, which the mouth keeps time with; a mew, how much it is asking. */
  length?: number;
  plea?: number;
  /** Its voice's pitch against a grown cat's: a kitten's is higher, and each kitten's its own. */
  voice?: number;
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
  /** On something that tips (a sail, a swing's seat), it keeps itself upright in the world rather than tipping with it. */
  upright?: boolean;
  then?: CatPose;
  look?: THREE.Vector3 | null;
  /** Seconds it gathers before it springs, in place of a hop's or a leap's own. */
  gather?: number;
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
  /** Curved round to its left along the spine, and rolled over onto that side. */
  bend: number;
  roll: number;
}

/** Its own poses, and the gathered one it springs from. */
type Hold = CatPose | 'gather';

const STANCES: Record<Hold, Stance> = {
  stand: { bodyY: 0.124, bodyZ: 0, pitch: 0.02, flex: 0.05, chestUp: 0, neckLow: 1.0, hock: 0.5, tuck: 0, front: [0.028, 0.066], hind: [0.036, -0.074], tailUp: 0.25, tailCurl: 0.15, tailWrap: 0, bend: 0, roll: 0 },
  sit: { bodyY: 0.066, bodyZ: 0.006, pitch: 0.72, flex: 0.25, chestUp: 0.55, neckLow: 0, hock: 1.45, tuck: 0, front: [0.019, 0.08], hind: [0.047, 0.032], tailUp: -0.15, tailCurl: 0, tailWrap: 1, bend: 0, roll: 0 },
  gather: { bodyY: 0.094, bodyZ: -0.014, pitch: -0.08, flex: 0.28, chestUp: 0, neckLow: 1.0, hock: 1.0, tuck: 0, front: [0.026, 0.068], hind: [0.036, -0.058], tailUp: -0.15, tailCurl: 0, tailWrap: 0, bend: 0, roll: 0 },
  crouch: { bodyY: 0.068, bodyZ: -0.012, pitch: 0.03, flex: 0.62, chestUp: -0.1, neckLow: 1.25, hock: 1.45, tuck: 1.3, front: [0.022, 0.064], hind: [0.05, -0.012], tailUp: -0.9, tailCurl: 0, tailWrap: -1, bend: 0, roll: 0 },
  curl: { bodyY: 0.048, bodyZ: -0.01, pitch: 0.0, flex: 0.3, chestUp: -0.05, neckLow: 1.1, hock: 1.45, tuck: 1.4, front: [0.034, 0.058], hind: [0.05, -0.02], tailUp: -0.7, tailCurl: 0, tailWrap: 1, bend: 1.7, roll: 0.42 },
};
const POSES: Hold[] = ['stand', 'sit', 'crouch', 'gather', 'curl'];

const PACE: Record<Pace, { kind: GaitKind; speed: number }> = {
  walk: { kind: 'walk', speed: 0.6 },
  trot: { kind: 'trot', speed: 1.4 },
  run: { kind: 'bound', speed: 3.2 },
};
const NARROW_SPEED = 0.45;
const NECK_GIVE = 20;
const CLIMB_SPEED = 0.8;
/** Backing down a wall, metres a second; seconds it takes to let itself down over a lip; how far its front paws slide back to hold the lip's edge. */
const DOWN_SPEED = 0.85;
const LOWER_FOR = 0.95;
const GRIP = 0.09;
/** A little lighter than the world, so a leap hangs for a moment at the top as a cat's seems to. */
const GRAVITY = 8.5;

type Doing = 'still' | 'path' | 'air' | 'climb' | 'lower';
type Air = 'gather' | 'fly' | 'land';

const clamp = THREE.MathUtils.clamp;
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const UP = new THREE.Vector3(0, 1, 0);
const PAWS = [FPAW_L, FPAW_R, HPAW_L, HPAW_R];
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
  /**
   * How big it is: 1.8 stands its back about at her knee and its ears, sitting, about at the middle of her thigh,
   * larger than life so that it reads as a cat and a character from the room's distances.
   */
  scale = 1.8;
  /** How afraid it is underneath whatever happens, 0..1: the story sets it high in the tub and over the water. */
  unease = 0;
  /** 0 dry to 1 soaked. */
  wet = 0.35;
  /** While set it mews every few seconds, wherever it is and whatever it is doing. */
  mewing = false;
  /** Something it glances at now and then while sitting, as at the cygnet in the satchel. */
  curious: THREE.Vector3 | null = null;
  /** 0..1: cold and wet, it trembles finely through its body, ears and tail, and hunches. */
  shiver = 0;
  /** What it did this frame that makes a sound; whoever plays them empties the list. */
  readonly heard: CatSound[] = [];
  /** A kitten: a bigger head for its body, a higher voice, and a wobble in everything it does. */
  readonly kitten: boolean;
  /** Its voice's pitch against a grown cat's. */
  voice = 1;
  /** QA: the furthest a planted paw moved in one frame, and the furthest a leg was asked to reach past its length. */
  readonly probe = { slip: 0, reach: 0, where: '' };

  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly rig = new CatRig();
  private readonly gait = new CatGait();
  private readonly lookNow: CatLook = { blink: 0, pupil: 0.66, air: 0.6, wet: 0.35 };
  private readonly spray: Spray;
  private readonly seed = Math.random() * 100;

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
  /** Coming down a wall tail first: its way down, how fast, how long it looks down before it drops, and where it drops to. */
  private descent: { route: Route; pause: number; land: THREE.Vector3; yaw: number; floor: Floor | null; then: CatPose; side: number } | null = null;
  private lookDownT = -1;
  private lowerT = 0;
  private readonly lowerFrom = new THREE.Vector3();
  private readonly lowerTo = new THREE.Vector3();
  private readonly lowerQ = [new THREE.Quaternion(), new THREE.Quaternion()];
  private readonly lowerPaws = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly lowerEnds = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  /** Called once a turn on the spot asked for by `turn` is done, and how brisk that turn is against its own pace. */
  private turned: (() => void) | null = null;
  private turnPace = 1;

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
  private toFrame: THREE.Object3D | null = null;
  private readonly toAt = new THREE.Vector3();
  private readonly toFwd = new THREE.Vector3();
  private readonly toUp = new THREE.Vector3();
  private toFloor: Floor | null = null;
  private uprightNext = false;
  private toYaw = 0;
  private toThen: CatPose = 'stand';
  private afterAir: (() => void) | null = null;
  private readonly flightAt = new THREE.Vector3();
  private readonly flightQ = new THREE.Quaternion();
  private flightPitch = 0;

  private readonly weights: Record<Hold, number> = { stand: 0, sit: 1, crouch: 0, gather: 0, curl: 0 };
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
  private staring: THREE.Vector3 | null = null;
  private nuzzling: THREE.Vector3 | null = null;
  private readonly legs = new THREE.Vector3();
  private rubbing = false;
  private upright = false;
  private dropping = false;
  private turnLead = 0;
  private shakeT = -1;
  private slowT = -1;
  private flinchIn = 3;
  private downT = -1;
  private batT = -1;
  private readonly batAt = new THREE.Vector3();
  private toppleT = -1;
  /** Which way it goes over: to its left (1) or its right. */
  private toppleSide = 1;
  private shudderT = -1;
  private nextShudder = 1.2;
  private turnAge = 0;
  private jolted = 0;

  /** What shakes and swings too fast to be eased, laid over the eased pose each frame. */
  private readonly osc = { bodyY: 0, bodyZ: 0, pitch: 0, flex: 0, stretch: 0, roll: 0, neck: 0, head: 0, bend: 0, headRoll: 0, headYaw: 0, hock: [0, 0] };
  private readonly bound: BoundShape = { rise: 0, flex: 0, stretch: 0, surge: 0, pitch: 0, tail: 0 };
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly m = new THREE.Matrix4();

  constructor(opts: { coat?: Coat; kitten?: boolean } = {}) {
    this.kitten = !!opts.kitten;
    this.mat = catMaterial(this.rig.bones, opts.coat);
    this.mesh = new THREE.Mesh(catGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    /** The coat hangs off the skin as a child of it, so it is shown, hidden and drawn with the cat and never apart. */
    this.mesh.add(coatShells(this.mat));
    this.spray = new Spray(0.002 * this.scale);
    this.mesh.add(this.spray.points);
    this.support = {
      origin: this.at,
      forward: this.fwd,
      up: this.up,
      snap: (p) => this.snap(p),
    };
    this.d = {
      frame: new THREE.Matrix4(), scale: 1, origin: new THREE.Vector3(), forward: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0),
      bodyX: 0, bodyY: STANCES.sit.bodyY, bodyZ: 0, pitch: STANCES.sit.pitch, roll: 0, flex: 0, stretch: 0, legs: 1, chestUp: STANCES.sit.chestUp, neckLow: 0,
      headYaw: 0, headPitch: 0, headRoll: 0, headSize: 1, jaw: 0, earBack: 0, earTwitch: [0, 0],
      tailLift: 0, tailSwing: 0, tailCurl: 0, tailWrap: 1, tailWave: 0, tailFlick: 0,
      paws: this.paws.map((at) => ({ at, curl: 0 })), hock: [1.45, 1.45], breath: 0, bend: 0,
    };
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh];
  }

  /** True until the action it was last given has finished. */
  get busy(): boolean {
    return this.onDone !== null || this.doing !== 'still';
  }

  /** True from the moment it springs until it is down. */
  get flying(): boolean {
    return this.doing === 'air' && this.air === 'fly';
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
  place(at: THREE.Vector3, yaw: number, opts: { frame?: THREE.Object3D | null; pose?: CatPose; floor?: Floor | null; upright?: boolean } = {}): void {
    this.cancel();
    this.reframed = true;
    this.frame = opts.frame ?? null;
    this.upright = !!opts.upright;
    this.shakeT = this.slowT = this.batT = this.toppleT = this.downT = -1;
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
    this.speed = 0;
    this.turning = 0;
    this.frameFresh = true;
    this.fear = this.unease;
    this.mewT = this.chirpT = this.blinkT = -1;
    this.idle = null;
    this.nextIdle = 3 + Math.random() * 3;
    this.flinch.value = this.flinch.velocity = this.dip.value = this.dip.velocity = 0;
    this.homesFor(0);
    this.gait.reset(this.support, this.homes);
    this.syncWorld();
  }

  /** Stays where it is, held as `pose`, looking at `look`; if that is well behind it, it turns round to it first. */
  rest(pose: CatPose, look: THREE.Vector3 | null = this.target): void {
    if (this.airborne(() => this.rest(pose, look))) return;
    this.cancel();
    this.target = look;
    this.settleInto(pose);
  }

  /**
   * Crouched where it is, tail wrapped, ears back, mewing every few seconds at `look`. It sets `mewing` and an
   * `unease` the story takes off again when it is rescued; nothing else does.
   */
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

  /** A plaintive mew now, a kitten's length, the mouth keeping time with it. */
  mew(plea = 1): void {
    if (this.mewT >= 0) return;
    this.mewT = 0;
    this.mewFor = (0.3 + 0.1 * plea + Math.random() * 0.05) * (this.kitten ? 0.7 : 1);
    this.heard.push({ kind: 'mew', amount: this.kitten ? 0.6 : 1, length: this.mewFor, plea, voice: this.voice });
  }

  /** A frightened mrrow, low and drawn out, the mouth held open through it. */
  yowl(): void {
    this.mewT = 0;
    this.mewFor = 0.75 + Math.random() * 0.2;
    this.heard.push({ kind: 'yowl', amount: 1, length: this.mewFor });
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

  /** Shakes the water off as a wet cat does, a twist running from its head down its body to its tail and throwing drops, about a second. */
  shake(): void {
    this.shakeT = 0;
  }

  /** The slow blink: its eyes close for a long moment and open again as its head dips a little. Trust. */
  slowBlink(): void {
    this.slowT = 0;
  }

  /**
   * Holds its eyes on `target` and nothing else: ears flat back, low, its head forward, the tip of its tail twitching.
   * Null lets it go back to looking about.
   */
  stare(target: THREE.Vector3 | null): void {
    this.staring = target;
    if (target) this.target = target;
  }

  /**
   * Rubs against her legs: comes to the front of them (`legs`, between her feet; `facing`, the way she faces) and
   * goes along her shins leaning its flank and cheek into them, tail straight up, turns at the end and comes back the
   * other way, then sits at her feet looking up at `face` and calls `onDone`. About six seconds.
   */
  press(legs: THREE.Vector3, facing: number, floor: Floor, face: THREE.Vector3, onDone?: () => void): void {
    this.legs.copy(legs);
    const fx = Math.sin(facing), fz = Math.cos(facing);
    const side = (this.position.x - legs.x) * fz - (this.position.z - legs.z) * fx >= 0 ? 1 : -1;
    const k = this.scale / 1.8;
    const at = (ahead: number, across: number) => new THREE.Vector3(legs.x + fx * ahead + fz * across * side, legs.y, legs.z + fz * ahead - fx * across * side);
    const pass = [at(0.3 * k, 0.55 * k), at(0.2 * k, 0.2 * k), at(0.19 * k, -0.2 * k), at(0.3 * k, -0.42 * k), at(0.48 * k, -0.3 * k), at(0.42 * k, 0)];
    this.run([at(0.42 * k, 0.75 * k)], floor, { pace: 'walk', speed: 0.8, then: 'stand' }, () => {
      this.rubbing = true;
      this.run(pass, floor, { pace: 'walk', speed: 0.42, then: 'sit', look: face }, () => {
        this.rubbing = false;
        this.chirrup();
        onDone?.();
      });
    });
  }

  /** Pushes its head up into `hand` with its eyes shut, rubbing its cheek on it, as she strokes it; null stops. */
  nuzzle(hand: THREE.Vector3 | null): void {
    this.nuzzling = hand;
    if (hand) this.target = hand;
  }

  /** A kitten's swipe of a front paw at `at`. */
  bat(at: THREE.Vector3): void {
    this.batT = 0;
    this.batAt.copy(at);
  }

  /** A kitten bowled over onto its side, paws up, and back onto its feet: away from `from`, if it was knocked from there. */
  topple(from?: THREE.Vector3): void {
    this.toppleT = 0;
    if (this.doing === 'still') this.pose = 'stand';
    this.toppleSide = from ? -(Math.sign(this.toLocal(from, this.w).x) || 1) : 1;
  }

  /** Where the hollow of its curl is, in the world, for what it curls round. */
  hollow(out: THREE.Vector3): THREE.Vector3 {
    const side = this.v.crossVectors(this.up, this.fwd).normalize();
    return out.copy(this.at).addScaledVector(side, 0.1 * this.scale).addScaledVector(this.fwd, 0.01 * this.scale).applyMatrix4(this.frameMatrix);
  }

  /**
   * A small jump to `to`, a point on `opts.frame` (or in the world): a moment's gather, a quick arc, down, and
   * `onDone` once it has taken the landing, about half a second plus the flight.
   */
  hop(to: THREE.Vector3, opts: JumpOptions = {}, onDone?: () => void): void {
    this.jump(to, opts, false, onDone);
  }

  /**
   * A real leap: it eyes the far side, gathers with a wiggle of the hips (most of a second), springs, lands front paws
   * first and settles, then `onDone`. To leap from a run, end the run at the take-off point: it brakes into it.
   */
  leap(to: THREE.Vector3, opts: JumpOptions = {}, onDone?: () => void): void {
    this.jump(to, opts, true, onDone);
  }

  /**
   * Along `path`, points in the world whose heights come from `floor`, with every paw planted where it is put down.
   * It turns to the way first if it faces away, slows into the last point and stops, calls `onDone`, then holds
   * `then` (turning to `look` first if that is behind it). Walk 0.6, trot 1.4, run 3.2 metres a second.
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
   * over the lip, then holds `then` there looking at `look`, and calls `onDone`. It climbs at 0.8 metres a second.
   */
  climb(path: readonly THREE.Vector3[], out: THREE.Vector3, opts: { then?: CatPose; look?: THREE.Vector3 | null; frame?: THREE.Object3D | null; speed?: number; gather?: number } = {}, onDone?: () => void): void {
    if (this.airborne(() => this.climb(path, out, opts, onDone))) return;
    this.cancel();
    this.toWorld();
    const frame = opts.frame ?? null;
    this.climbSpeed = opts.speed ?? CLIMB_SPEED;
    this.dropping = false;
    this.wall.copy(out).setY(0).normalize();
    const face = path.slice(0, -1);
    const ledge = path[path.length - 1].clone();
    const route = new Route(face);
    const first = route.at(0, new THREE.Vector3());
    const upWall = route.tangent(0, new THREE.Vector3());
    const inward = this.w.copy(this.wall).negate();
    const yawIn = Math.atan2(inward.x, inward.z);
    this.onDone = onDone ?? null;
    this.launch(first, frame, upWall, this.wall, null, 0.07 * this.scale, true, 'stand', () => {
      this.climbing = route;
      this.along = 0;
      this.gait.kind = 'climb';
      this.doing = 'climb';
      this.speed = 0;
      this.floor = null;
      this.climbDone = () => {
        this.launch(ledge, frame, new THREE.Vector3(Math.sin(yawIn), 0, Math.cos(yawIn)), UP, null, 0.045 * this.scale, false, opts.then ?? 'sit', () => this.finish(opts.then ?? 'sit'));
      };
    }, opts.gather);
    if (opts.look !== undefined) this.target = opts.look;
    this.toYaw = yawIn;
  }
  private climbDone: (() => void) | null = null;
  private climbSpeed = CLIMB_SPEED;

  /**
   * Turns round on the spot to face `yaw`, its head going first, then `onDone`: at its own unhurried pace, or `pace`
   * times as brisk.
   */
  turn(yaw: number, onDone?: () => void, pace = 1): void {
    if (this.airborne(() => this.turn(yaw, onDone, pace))) return;
    this.cancel();
    this.toWorld();
    this.pose = 'stand';
    this.turnTo = this.heading + wrapAngle(yaw - this.heading);
    this.turnAge = 0;
    this.turned = onDone ?? null;
    this.turnPace = pace;
  }

  /**
   * Down a near-vertical way as a cat comes down a tree, tail first. From where it stands at the lip of a ledge it
   * turns its back to the drop and lets itself down over the edge, hind feet feeling for the wall first and the front
   * paws holding the lip till last; then it comes down facing up the wall, a hind foot and then the front on its side.
   * At the foot of `path` it stops and looks down over its shoulder, then pushes off and drops onto `land` (on `floor`),
   * turning in the air to face `yaw`, and holds `then`. `path` runs down the wall's face from just under the lip; `out`
   * is the wall's outward normal.
   */
  backDown(path: readonly THREE.Vector3[], out: THREE.Vector3, land: THREE.Vector3,
    opts: { yaw: number; floor?: Floor | null; then?: CatPose; look?: THREE.Vector3 | null; speed?: number; pause?: number; turn?: number }, onDone?: () => void): void {
    if (this.airborne(() => this.backDown(path, out, land, opts, onDone))) return;
    this.cancel();
    this.toWorld();
    this.wall.copy(out).setY(0).normalize();
    const route = new Route(path);
    const across = this.v.crossVectors(this.wall, route.tangent(route.length, this.w).negate()).normalize();
    const side = Math.sign(this.w2.subVectors(land, route.at(route.length, this.w)).dot(across)) || 1;
    this.descent = { route, pause: opts.pause ?? 0.8, land: land.clone(), yaw: opts.yaw, floor: opts.floor ?? null, then: opts.then ?? 'sit', side };
    this.cruise = opts.speed ?? DOWN_SPEED;
    this.onDone = onDone ?? null;
    if (opts.look !== undefined) this.target = opts.look;
    const yawIn = Math.atan2(-this.wall.x, -this.wall.z);
    if (Math.abs(wrapAngle(yawIn - this.heading)) < 0.15) this.lowerOver();
    else {
      this.pose = 'stand';
      this.turnTo = this.heading + wrapAngle(yawIn - this.heading);
      this.turnAge = 0;
      this.turned = () => this.lowerOver();
      this.turnPace = opts.turn ?? 1;
    }
  }

  /** From standing at the lip with its back to the drop: where each paw is now, and where each will be on the wall. */
  private lowerOver(): void {
    const route = this.descent!.route;
    this.doing = 'lower';
    this.lowerT = 0;
    this.lowerFrom.copy(this.at);
    route.at(0, this.lowerTo);
    const upWall = route.tangent(0, this.w2).negate();
    upWall.addScaledVector(this.wall, -upWall.dot(this.wall)).normalize();
    this.basisQuat(this.up, this.fwd, this.lowerQ[0]);
    this.basisQuat(this.wall, upWall, this.lowerQ[1]);
    const across = this.side.crossVectors(this.wall, upWall).normalize();
    for (let i = 0; i < 4; i++) {
      this.lowerPaws[i].copy(this.paws[i]);
      this.lowerEnds[i].copy(this.lowerTo).addScaledVector(across, this.homes[i].x).addScaledVector(upWall, this.homes[i].y);
    }
  }

  /**
   * Over the lip: the body tips back and down about the edge while the hind feet swing down onto the wall one after
   * the other; the front paws slide back to hold the edge and let go of it last, then it is on the wall.
   */
  private lower(dt: number): void {
    const k = this.scale;
    this.lowerT += dt;
    const t = Math.min(1, this.lowerT / LOWER_FOR);
    this.flightQ.slerpQuaternions(this.lowerQ[0], this.lowerQ[1], smooth((t - 0.1) / 0.7));
    this.fwd.set(0, 0, 1).applyQuaternion(this.flightQ);
    this.up.set(0, 1, 0).applyQuaternion(this.flightQ);
    const go = smooth(t);
    this.at.lerpVectors(this.lowerFrom, this.lowerTo, go).addScaledVector(this.wall, 0.03 * k * Math.sin(Math.PI * go));
    for (let i = 0; i < 4; i++) {
      const from = this.lowerPaws[i], to = this.lowerEnds[i], paw = this.paws[i];
      if (i < 2) {
        const hold = smooth((t - 0.22) / 0.25), off = smooth((t - 0.68 - 0.08 * i) / 0.24);
        paw.copy(from).addScaledVector(this.wall, GRIP * k * hold).lerp(to, off).addScaledVector(this.wall, 0.035 * k * Math.sin(Math.PI * off));
        this.d.paws[i].curl = 0.5 * hold * (1 - off) + 0.7 * Math.sin(Math.PI * off);
      } else {
        const down = smooth((t - 0.08 - 0.14 * (i - 2)) / 0.38);
        paw.lerpVectors(from, to, down).addScaledVector(this.wall, 0.07 * k * Math.sin(Math.PI * down));
        this.d.paws[i].curl = 0.8 * Math.sin(Math.PI * down);
      }
    }
    if (t < 1) return;
    this.onWall = true;
    this.at.copy(this.lowerTo);
    this.climbing = this.descent!.route;
    this.along = 0;
    this.speed = 0;
    this.doing = 'climb';
    this.gait.kind = 'back';
    this.gait.plantAt(this.support, this.paws, this.heading);
  }

  /** Down the wall a foot at a time, its weight dropping onto each hind foot as it takes hold; at the foot it stops to look down. */
  private descend(dt: number): void {
    const route = this.climbing!;
    if (this.lookDownT >= 0) {
      this.speed = 0;
      this.lookDownT += dt;
      if (this.lookDownT >= this.descent!.pause) this.dropOff();
      return;
    }
    const left = route.length - this.along;
    this.speed = Math.min(ease(this.speed, this.cruise, 3, dt), Math.sqrt(2 * 2 * Math.max(0, left)) + 0.05);
    const settle = 1 + 0.55 * Math.cos((this.gait.phase - 0.08) * Math.PI * 4);
    this.along = Math.min(route.length, this.along + this.speed * settle * dt);
    route.at(this.along, this.at);
    route.tangent(this.along, this.fwd, 0.1).negate();
    this.up.copy(this.wall);
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    if (left < 0.01) this.lookDownT = 0;
  }

  /** It pushes off from the wall and drops, turning, onto its feet below. */
  private dropOff(): void {
    const d = this.descent!;
    this.descent = null;
    this.climbing = null;
    this.lookDownT = -1;
    this.dropping = false;
    this.gait.kind = 'walk';
    const then = d.then;
    this.launch(d.land, null, new THREE.Vector3(Math.sin(d.yaw), 0, Math.cos(d.yaw)), UP, d.floor, 0.03 * this.scale, false, then, () => this.finish(then), 0.12);
  }

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
    const drop = this.position.y - there.y;
    this.dropping = drop > 0.2 * this.scale && drop > span * 0.5;
    const arc = opts.arc ?? (this.dropping ? 0.02 * this.scale : leap ? 0.07 * this.scale + span * 0.1 : 0.035 * this.scale + span * 0.08);
    if (opts.look !== undefined) this.target = opts.look;
    this.uprightNext = !!opts.upright;
    this.launch(to, frame, fwd, UP, frame ? null : opts.floor ?? null, arc, leap, then, () => this.finish(then), opts.gather);
  }

  /** Sets up a flight from where it stands to a point on something, eyed, gathered for, flown and landed. */
  private launch(to: THREE.Vector3, frame: THREE.Object3D | null, fwd: THREE.Vector3, up: THREE.Vector3, floor: Floor | null, arc: number, leap: boolean, then: CatPose, after: () => void, gather?: number): void {
    this.doing = 'air';
    this.air = 'gather';
    this.airT = 0;
    this.leaping = leap;
    this.gatherFor = gather ?? (leap ? 0.75 : this.dropping ? 0.45 : 0.28);
    this.landFor = leap ? 0.5 : 0.3;
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
    this.turned = null;
    this.turnPace = 1;
    this.descent = null;
    this.lookDownT = -1;
    this.rubbing = false;
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
    this.upright = false;
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
    } else if (this.floor) p.y = this.footing(p, this.floor);
    else p.y = this.level;
  }

  /**
   * The floor under a paw, which never goes over an edge: a paw that would come down well below where the cat stands
   * (off the end of a wall, the side of a coping) is drawn back toward its body until it finds the top again.
   */
  private footing(p: THREE.Vector3, floor: Floor): number {
    const base = floor(this.at.x, this.at.z);
    const drop = 0.1 * this.scale;
    let h = floor(p.x, p.z);
    for (let k = 1; h < base - drop && k <= 8; k++) {
      p.x += (this.at.x - p.x) * (1 / (9 - k));
      p.z += (this.at.z - p.z) * (1 / (9 - k));
      h = floor(p.x, p.z);
    }
    return h;
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
    if (this.upright && this.frame && this.doing === 'still') {
      this.up.set(0, 1, 0).transformDirection(this.frameInverse);
      this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    }
    this.turnLead = 0;

    if (this.doing === 'path') this.follow(dt);
    else if (this.doing === 'climb') this.clamber(dt);
    else if (this.doing === 'still') this.standStill(dt);

    const wantPose: Hold = this.doing === 'still' && this.turnTo === null ? this.pose : this.doing === 'air' && this.air === 'gather' ? 'gather' : 'stand';
    for (const p of POSES) this.weights[p] = ease(this.weights[p], p === wantPose ? 1 : 0, this.doing === 'air' ? 14 : 5, dt);
    /** At a gallop its paws come in under its midline, as a running cat's do. */
    this.homesFor(this.doing !== 'path' ? 0 : this.narrow ? 1 : 0.6 * this.galloping);

    if (this.doing === 'air') this.fly(dt);
    else if (this.doing === 'lower') this.lower(dt);
    else {
      const lift = (this.gait.kind === 'bound' ? 0.042 : this.gait.kind === 'trot' ? 0.03 : 0.024) * this.scale;
      this.gait.scale = this.scale;
      this.gait.low = clamp(this.fear, 0, 1);
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
    this.spray.update(dt);
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
    if (this.turnTo === null) this.turnAge = 0;
    else {
      /** Round on the spot at a cat's own unhurried pace, easing in and out of it, its head going first. */
      const err = wrapAngle(this.turnTo - this.heading);
      this.turnLead = err;
      this.turnAge += dt;
      const brisk = this.turnPace;
      this.turning = ease(this.turning, clamp(err * 3 * brisk, -2.6 * brisk, 2.6 * brisk) * smooth((this.turnAge - 0.12) / 0.25), 8, dt);
      this.heading += this.turning * dt;
      this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
      if (Math.abs(err) < 0.04 && Math.abs(this.turning) < 0.2) {
        this.turnTo = null;
        this.turning = 0;
        const next = this.turned;
        this.turned = null;
        this.turnPace = 1;
        next?.();
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
    /** And it is up off its haunches before it goes anywhere. */
    const up = smooth((this.weights.stand - 0.55) / 0.35);
    const goal = Math.min(this.cruise * facing * up, brake);
    this.speed = goal > this.speed ? ease(this.speed, goal, this.gait.kind === 'bound' ? 3 : 4, dt) : Math.max(goal, this.speed - 8 * dt);
    this.along = Math.min(route.length, this.along + this.speed * dt);
    route.at(this.along, this.at);
    this.at.y = this.floor!(this.at.x, this.at.z);
    const ahead = route.tangent(Math.min(route.length, this.along + 0.35 * this.scale), this.w2);
    this.turnLead = wrapAngle(Math.atan2(ahead.x, ahead.z) - this.heading);
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
    if (this.descent) {
      this.descend(dt);
      return;
    }
    const route = this.climbing!;
    const left = route.length - this.along;
    this.speed = Math.min(ease(this.speed, this.climbSpeed, 3, dt), Math.sqrt(2 * 3 * Math.max(0, left)) + 0.15);
    /** In surges: the hind legs drive it up while the front paws reach, then it hangs on them as the hind come up. */
    const surge = 1 + 0.65 * Math.cos((this.gait.phase - 0.25) * Math.PI * 2);
    this.along = Math.min(route.length, this.along + this.speed * surge * dt);
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
    for (let i = 0; i < 4; i++) this.fromPaws[i].copy(this.paws[i]);
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
    this.upright = false;
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
    const body = this.body3.copy(this.at).addScaledVector(this.up, 0.12 * k);
    const stretch = Math.sin(t * Math.PI);
    const tuck = smooth((t - 0.35) / 0.4);
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const s = i % 2 === 0 ? 1 : -1;
      /** In the air the front paws reach on ahead along the body; the hind ones trail out long behind, then come under it. */
      if (front) {
        this.bodyPaw.copy(body).addScaledVector(along, (0.12 + 0.06 * stretch) * k).addScaledVector(down, (0.085 - 0.04 * stretch) * k);
      } else {
        this.bodyPaw.copy(body).addScaledVector(along, (-0.17 * (1 - tuck) - 0.035 * tuck) * k).addScaledVector(down, (0.06 + 0.05 * tuck) * k);
      }
      this.bodyPaw.addScaledVector(side, s * (front ? 0.022 : 0.032) * k);
      const home = this.homes[i];
      const sideEnd = this.v.set(1, 0, 0).applyQuaternion(this.endQ);
      const fwdEnd = this.w2.set(0, 0, 1).applyQuaternion(this.endQ);
      this.landPaw.copy(this.endW).addScaledVector(sideEnd, home.x).addScaledVector(fwdEnd, home.y + (front ? 0.025 : -0.01) * k);
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
    this.upright = this.uprightNext && !!this.frame;
    this.uprightNext = false;
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
    this.dip.velocity -= this.leaping ? 1.5 : 0.8;
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
        this.nextMew = 3.4 + Math.random() * 2.8;
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
    for (const t of ['shakeT', 'slowT', 'batT', 'toppleT', 'downT', 'shudderT'] as const) if (this[t] >= 0) this[t] = this[t] + dt > { shakeT: 1.15, slowT: 3.4, batT: 0.45, toppleT: 1.3, downT: 1.5, shudderT: 0.45 }[t] ? -1 : this[t] + dt;
    /** Cold through, every second or two a shudder takes the whole of it. */
    if (this.shiver > 0.3 && this.shudderT < 0) {
      this.nextShudder -= dt;
      if (this.nextShudder <= 0) {
        this.shudderT = 0;
        this.nextShudder = 1.4 + Math.random() * 1.4;
      }
    }
    /** Stranded and frightened, or adrift, every few seconds the water below makes it flinch and look down at it. */
    if ((this.mewing || (this.frame && this.unease > 0.5)) && this.fear > 0.4 && this.doing === 'still' && !this.staring) {
      this.flinchIn -= dt;
      if (this.flinchIn <= 0) {
        this.flinchIn = 3.5 + Math.random() * 3;
        this.afraid(0.3);
        this.downT = 0;
      }
    }
    this.idles(dt);
  }

  /** Sitting with nothing asked of it: it washes a paw, flicks its tail, glances at what it is curious about, slow-blinks. */
  private idles(dt: number): void {
    const sitting = this.doing === 'still' && this.turnTo === null && this.weights.sit > 0.9 && !this.staring && !this.nuzzling && this.slowT < 0;
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
    let roll = blend('roll');
    const bend = blend('bend');
    let earBack = 0;
    let headYaw = this.wander.x;
    let headPitch = this.wander.y * 0.5;
    let headRoll = 0;
    let jaw = 0;
    let tailWave = 0.25;
    let tailFlick = 0;
    let pupil = 0.86;

    /** On footing that falls away under a paw, a ridge or a slope, it crouches onto it rather than reaching. */
    let sink = 0;
    if (this.doing !== 'air') {
      for (let i = 0; i < 4; i++) if (this.gait.paws[i].planted) sink = Math.max(sink, this.v.subVectors(this.at, this.paws[i]).dot(this.up));
    }
    const galloping = this.galloping;
    bodyY -= Math.min(sink / this.scale, 0.04) * (0.85 - 0.45 * galloping);

    /** Frightened means low: whatever it is doing it presses down, sinks its head and rounds its back. */
    const fear = clamp(this.fear, 0, 1.2);
    const flinch = this.flinch.step(0, 90, 11, dt);
    /** Shaking itself off it stands up tall on straight legs, however frightened. */
    const shaking = this.shakeT >= 0 ? smooth(this.shakeT / 0.12) * (1 - smooth((this.shakeT - 0.65) / 0.4)) : 0;
    /** At a gallop it cannot press itself down: its fear is in its ears, its tail and how it bounds on low and long. */
    const low = fear * (w.stand + 0.6 * w.sit + 0.5 * w.gather) * (1 - shaking) * (1 - galloping);
    bodyY += flinch * 0.05 - low * 0.036 - fear * 0.006 * (1 - galloping);
    flex += low * 0.2;
    neckLow += fear * 0.45 * (1 - 0.6 * galloping);
    /** Sitting frightened, it hunches: its chest drops, its head sinks into its shoulders; riding, it keeps its head up to see out. */
    const hunch = Math.min(fear, 1) * w.sit * (this.frame ? 0 : 1);
    chestUp -= 0.32 * hunch;
    neckLow += 0.3 * hunch;
    earBack += fear;
    tailWave *= 1 - fear * 0.7;
    pupil += fear * 0.14;

    const shiver = clamp(this.shiver, 0, 1);
    const shudder = this.shudderT >= 0 ? Math.sin((this.shudderT / 0.45) * Math.PI) * shiver : 0;
    const tremble = shiver * (Math.sin(this.time * 58) * 0.6 + Math.sin(this.time * 41 + 1) * 0.4) + shudder * 2.2 * Math.sin(this.time * 76);
    bodyY += tremble * 0.0015 - shiver * 0.01 - shudder * 0.01;
    flex += shiver * 0.15 + shudder * 0.12;
    neckLow += shiver * 0.35 + shudder * 0.35;
    earBack += shiver * 0.3 + shudder * 0.4;
    tailWave *= 1 - shiver * 0.8;
    if (this.staring) {
      earBack = Math.max(earBack, 0.9);
      pupil += 0.3;
      bodyY -= 0.012;
      neckLow += 0.3;
      flex += 0.1;
      tailWave = 0;
    }

    const osc = this.osc;
    osc.bodyY = osc.bodyZ = osc.pitch = osc.flex = osc.stretch = osc.roll = osc.neck = osc.head = osc.bend = osc.headRoll = osc.headYaw = osc.hock[0] = osc.hock[1] = 0;
    osc.roll = tremble * 0.035;
    osc.headRoll = tremble * 0.03;
    if (this.doing === 'lower') {
      /** Letting itself down over the edge: low and careful, its head down over what it holds, its ears back. */
      bodyY -= 0.03;
      flex += 0.2;
      headPitch = -0.25;
      headYaw *= 0.2;
      earBack += 0.35;
      tailUp = -0.4;
      tailWrap = 0;
    }
    if (this.doing === 'path' || this.doing === 'climb') {
      const g = this.gait;
      const ph = g.phase * Math.PI * 2;
      const k = clamp(g.speed / Math.max(this.cruise, 0.3), 0, 1);
      if (g.kind === 'bound') {
        /** The head is held in the frame of the roof, so it rides level over all of it, its eyes on where it is going. */
        const b = boundShape(g.phase, clamp(fear, 0, 1), this.bound);
        osc.bodyY = b.rise * k;
        osc.bodyZ = b.surge * k;
        osc.flex = b.flex * k;
        osc.stretch = b.stretch * k;
        osc.pitch = b.pitch * k;
        /** The neck gives against the body's rise and its pitch, so the head travels much more evenly than the body. */
        osc.neck = NECK_GIVE * (b.rise + 0.12 * b.pitch) * k;
        for (const i of [0, 1]) osc.hock[i] = k * (g.paws[i + 2].hock - this.d.hock[i]);
        bodyY -= 0.004 * k;
        neckLow += 0.15 * k;
        tailUp = THREE.MathUtils.lerp(tailUp, 0.2 + 1.5 * b.tail, k);
        tailCurl = THREE.MathUtils.lerp(tailCurl, -0.05, k);
        earBack += 0.3 * k;
      } else if (g.kind === 'trot') {
        /** Light on its feet: a bounce at every diagonal pair, the head bobbing less than the body, the tail up. */
        osc.bodyY = 0.013 * Math.cos(2 * ph) * k;
        osc.roll = 0.025 * Math.sin(ph) * k;
        osc.flex = 0.05 * Math.cos(2 * ph) * k;
        osc.pitch = 0.03 * Math.sin(2 * ph) * k;
        osc.head = -0.6 * osc.pitch;
        tailUp = THREE.MathUtils.lerp(tailUp, 0.55, k);
        tailCurl = THREE.MathUtils.lerp(tailCurl, 0.22, k);
      } else if (g.kind === 'walk') {
        osc.bodyY = -0.004 * Math.cos(2 * ph) * k;
        osc.roll = 0.035 * Math.sin(ph) * k;
        osc.head = 0.03 * Math.cos(2 * ph) * k;
        tailUp = THREE.MathUtils.lerp(tailUp, this.narrow ? 0.1 : 0.3, k);
        tailCurl = THREE.MathUtils.lerp(tailCurl, this.narrow ? -0.02 : 0.12, k);
        if (this.narrow) {
          bodyY -= 0.008;
          neckLow += 0.1;
          headPitch = -0.15;
          headYaw *= 0.2;
          tailWave = 0;
        }
      } else if (g.kind === 'back') {
        /** Its weight goes from side to side with each foot it puts down, and drops onto each hind foot as it takes hold. */
        osc.roll = 0.07 * Math.sin(ph) * k;
        osc.flex = 0.14 * Math.cos(2 * ph) * k;
        bodyY -= 0.04;
        tailUp = -0.3;
        tailCurl = 0.1;
        headPitch = 0.1;
        headYaw *= 0.3;
        earBack += 0.25;
        if (this.lookDownT >= 0 && this.descent) {
          /** Stopped near the foot, it looks down over its shoulder at where it will drop to. */
          const pause = this.descent.pause, side = this.descent.side;
          const look = smooth(this.lookDownT / 0.3) * (1 - smooth((this.lookDownT - pause + 0.12) / 0.12));
          headYaw = THREE.MathUtils.lerp(headYaw, side * 1.5, look);
          headRoll += side * 0.5 * look;
          neckLow -= 0.3 * look;
          osc.bend = side * 0.45 * look;
          earBack -= 0.25 * look;
        }
      } else {
        osc.flex = 0.32 * Math.cos(ph) * k;
        bodyY -= 0.045;
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

    /** And its tail goes down and in, never up: up is for a cat that is glad. */
    const cowed = clamp(fear * 1.2, 0, 1);
    tailUp = THREE.MathUtils.lerp(tailUp, Math.min(tailUp, this.doing === 'path' ? -0.3 : -0.5), cowed);
    tailCurl *= 1 - cowed;

    if (this.doing === 'air') {
      tailWrap = 0;
      const gather = this.air === 'gather' ? smooth(this.airT / Math.min(0.25, this.gatherFor)) : 0;
      if (this.air === 'gather') {
        bodyY -= (this.leaping ? 0.012 : 0) * gather;
        if (this.dropping) {
          /** Going down, it leans out over the edge and looks at where it will land before it lets itself go. */
          pitch -= 0.45 * gather;
          neckLow += 0.35 * gather;
          bodyZ += 0.02 * gather;
        }
        if (this.leaping) {
          /**
           * Down low with its eyes on the far side, then the wiggle: its hindquarters sway as its back feet tread for
           * a grip, the tip of its tail twitching; last it loads, the rump dropping and the chest lifting to aim.
           */
          const g = this.airT, F = this.gatherFor;
          const sink = smooth(g / 0.3);
          const load = smooth((g - (F - 0.16)) / 0.12);
          const wiggle = smooth((g - 0.22) / 0.12) * (1 - smooth((g - (F - 0.2)) / 0.08));
          const sway = Math.sin((g - 0.22) * 23);
          bodyY -= 0.012 * sink + 0.012 * load;
          pitch += -0.07 * sink * (1 - load) + 0.14 * load;
          neckLow += 0.2 * sink * (1 - load);
          hock += 0.3 * load;
          osc.bend = 0.22 * sway * wiggle;
          osc.roll += 0.035 * sway * wiggle;
          for (const i of [2, 3]) this.paws[i].addScaledVector(this.up, Math.max(0, (i === 2 ? 1 : -1) * sway) * 0.011 * this.scale * wiggle);
          tailUp = -0.15 + 0.1 * load;
          tailCurl = 0.05;
          tailFlick = Math.sin(g * 17) * 0.7 * wiggle;
        }
        pupil += 0.15;
      } else if (this.air === 'fly') {
        const t = Math.min(1, this.airT);
        flex += -0.25 * Math.sin(t * Math.PI) + 0.12 * smooth((t - 0.75) / 0.25);
        pitch += this.flightPitch;
        bodyY = THREE.MathUtils.lerp(0.122, 0.132, t);
        tailUp = 0.1 + 0.25 * Math.sin(t * Math.PI);
        tailCurl = -0.05;
        neckLow -= 0.15;
        hock = 0.7 + 0.6 * Math.sin(t * Math.PI);
        earBack += 0.2;
      } else {
        /** Front paws first: the shoulders take it, the head dips and the weight carries on forward, then it settles. */
        const t = this.airT / this.landFor;
        const give = Math.sin(Math.min(1, t * 1.4) * Math.PI) * (this.leaping ? 1 : 0.5);
        pitch -= 0.16 * give;
        bodyY -= 0.012 * give;
        neckLow += 0.25 * give;
        bodyZ += 0.012 * give;
        tailUp += 0.4 * (1 - t);
        tailCurl += 0.2 * (1 - t);
      }
    }

    /** It looks at what it is told to, or at where it is going when it is about to jump. */
    const down = this.downT >= 0 ? this.v.copy(this.at).addScaledVector(this.fwd, 0.4 * this.scale).addScaledVector(this.up, -1.5).applyMatrix4(this.frameMatrix) : null;
    const landing = this.doing !== 'air' || this.air === 'land' ? null
      : this.air === 'gather' ? this.v.copy(this.toAt).applyMatrix4(this.toFrame ? worldOf(this.toFrame) : IDENTITY) : this.endW;
    const gaze = landing ?? down ?? (this.staring ?? (this.idle === 'glance' && this.curious ? this.curious : this.target));
    if (!gaze && w.curl > 0.05) {
      /** Curled up with nothing to watch, it tucks its head round into the curve of its body. */
      headYaw = THREE.MathUtils.lerp(headYaw, 1.1, w.curl);
      headPitch = THREE.MathUtils.lerp(headPitch, -0.35, w.curl);
      headRoll += 0.3 * w.curl;
    }
    if (gaze && this.doing !== 'climb' && this.doing !== 'lower') {
      const local = this.toLocal(gaze, this.w);
      const yaw = Math.atan2(local.x, local.z - 0.11);
      const pitchTo = Math.atan2(local.y - 0.22, Math.hypot(local.x, local.z - 0.11));
      const free = this.doing === 'path' && !this.narrow ? 0.6 : 1.5;
      headYaw = clamp(yaw, -free, free);
      headPitch = clamp(pitchTo, -0.9, 0.8);
      /** Watching what it is curious about while it is calm and still, it tips its head to one side. */
      if (gaze === this.curious && this.doing === 'still') headRoll -= 0.26 * (1 - clamp(fear * 2.5, 0, 1));
    }
    /** Frightened and still, it keeps glancing about. */
    if (fear > 0.4 && this.doing === 'still' && !this.staring && this.downT < 0) headYaw += this.wander.x * 0.4 * Math.min(fear, 1);
    if (this.doing === 'path' || this.turnTo !== null) headYaw = clamp(headYaw + this.turnLead * 0.7, -1.5, 1.5);
    if (this.downT >= 0) {
      /** The flinch: it starts back with its ears pinned, then stretches its neck out to peer down at the water. */
      const t = this.downT;
      const startle = Math.sin(Math.min(1, t / 0.3) * Math.PI);
      const peer = smooth((t - 0.25) / 0.3) * (1 - smooth((t - 1.1) / 0.35));
      bodyZ -= 0.014 * startle;
      pitch += 0.1 * startle;
      earBack += 0.5 * startle;
      neckLow -= 0.45 * peer;
      pupil += 0.1;
    }
    if (this.staring) tailFlick = Math.sin(this.time * 9) * 0.55 * (0.6 + 0.4 * Math.sin(this.time * 1.3));

    let lids = 0;
    if (this.rubbing && this.doing === 'path') {
      /** Along her shins: its flank and cheek lean into them and its tail stands straight up, hooked at the tip. */
      const l = this.toLocal(this.legs, this.w);
      const near = 1 - smooth((Math.hypot(l.x, l.z) - 0.12) / 0.16);
      const side = Math.sign(l.x) || 1;
      roll += side * 0.2 * near;
      /** It bends its body round her shin as it goes along it, and hooks the tip of its tail round after. */
      osc.bend = side * 0.5 * near;
      headRoll += side * 0.45 * near;
      headYaw = THREE.MathUtils.lerp(headYaw, side * 0.55, near);
      headPitch = THREE.MathUtils.lerp(headPitch, 0.15, near);
      tailUp = 1.25;
      tailCurl = 0.5;
      tailFlick = side * 0.9 * (1 - smooth((Math.abs(l.z) - 0.05) / 0.2)) * smooth(-l.z / 0.05);
      earBack = Math.min(earBack, 0.1);
      lids = 0.5 * near;
    }
    if (this.nuzzling && this.doing === 'still') {
      chestUp += 0.15;
      headPitch += 0.15;
      headRoll += Math.sin(this.time * 2.2) * 0.3;
      earBack = Math.min(earBack, 0.15);
      tailUp = Math.max(tailUp, 0.9);
      tailCurl = 0.35;
      lids = 0.9;
    }
    if (this.shakeT >= 0) {
      /** The twist starts at the head and runs back down the body to the tail, throwing the water off as it goes. */
      const t = this.shakeT;
      const env = shaking;
      const ph = t * Math.PI * 2 * 7.5;
      const head = smooth(t / 0.08) * (1 - smooth((t - 0.45) / 0.2));
      const body = smooth((t - 0.15) / 0.12) * (1 - smooth((t - 0.75) / 0.25));
      const tail = smooth((t - 0.45) / 0.12) * (1 - smooth((t - 0.9) / 0.25));
      neckLow *= 1 - env;
      flex *= 1 - 0.7 * env;
      osc.headRoll += Math.sin(ph) * 0.9 * head;
      osc.headYaw += Math.sin(ph) * 0.35 * head;
      osc.roll += Math.sin(ph - 1.1) * 0.4 * body;
      tailFlick = Math.sin(ph - 2.2) * 1.4 * tail;
      earBack = Math.max(earBack, 0.4 * env);
      lids = Math.max(lids, 0.8 * env);
      this.throwWater(dt, head, body, tail, Math.sin(ph));
    }
    if (this.slowT >= 0) {
      /** Its eyes narrow slowly, close and stay closed a long moment, open only half way, and soften back. */
      const t = this.slowT;
      const shut = t < 0.75 ? smooth(t / 0.75) : t < 1.55 ? 1 : t < 2.35 ? 1 - 0.65 * smooth((t - 1.55) / 0.8) : 0.35 * (1 - smooth((t - 2.35) / 1.05));
      const nod = smooth(t / 0.75) * (1 - smooth((t - 1.55) / 1.2));
      lids = Math.max(lids, 0.98 * shut);
      headPitch -= 0.16 * nod;
      headRoll += 0.1 * nod;
      earBack *= 1 - 0.6 * nod;
    }
    lids = Math.max(lids, 0.18 * shiver + 0.4 * shudder);
    let bodyX = 0;
    if (this.toppleT >= 0) {
      /** Knocked over away from what hit it: it rolls onto its back on that side, paws up, and scrambles up again. */
      const t = this.toppleT;
      const side = this.toppleSide;
      const over = smooth(t / 0.18) * (1 - smooth((t - 0.85) / 0.4));
      roll += 1.5 * side * over;
      bodyX += 0.1 * side * over;
      bodyY -= 0.04 * over;
      headRoll -= 0.6 * side * over;
      const across = this.v.crossVectors(this.up, this.fwd).normalize();
      for (let i = 0; i < 4; i++) {
        this.paws[i].addScaledVector(this.up, (i < 2 ? 0.06 : 0.04) * this.scale * over).addScaledVector(across, 0.03 * side * this.scale * over);
        this.d.paws[i].curl = Math.max(this.d.paws[i].curl, 1.1 * over);
      }
    }
    if (this.batT >= 0) {
      const u = Math.sin((this.batT / 0.45) * Math.PI);
      const at = this.w.copy(this.batAt).applyMatrix4(this.frameInverse);
      this.paws[0].lerp(at, 0.75 * u);
      this.d.paws[0].curl = 1.2 * u;
      headPitch -= 0.1 * u;
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
      this.paws[1].lerp(this.washAt.addScaledVector(this.up, -0.03 * this.scale), up * 0.92);
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

    if (this.kitten) {
      /** Not yet sure of its legs: a wobble through its body and head whenever it moves. */
      const going = this.doing === 'path' ? clamp(this.gait.speed / (0.4 * this.scale), 0, 1) : this.doing === 'air' ? 0.5 : 0.15;
      roll += going * (0.09 * Math.sin(this.time * 9.1 + this.seed) + 0.05 * Math.sin(this.time * 5.3 + this.seed * 2));
      headRoll += going * 0.14 * Math.sin(this.time * 6.7 + this.seed * 3);
      bodyY += going * 0.004 * Math.sin(this.time * 13 + this.seed);
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
      /** Uneasy, a lurch of what it rides makes it flinch and press itself down. */
      this.jolted = Math.max(0, this.jolted - dt);
      if (push > 2.5 && this.unease > 0.4 && this.jolted <= 0 && !this.frameFresh) {
        this.afraid(this.fear < 0.9 ? 0.2 : 0);
        this.jolted = 1.2;
      }
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

    /** At a bound its legs draw out long and carry it higher, as it gathers speed. */
    d.legs = ease(d.legs, 1 + (BOUND_LEGS - 1) * this.galloping, 10, dt);
    osc.bodyY += (d.legs - 1) * (ARM + FORE);

    const ears = this.earSpring.step(clamp(earBack, 0, 1), 140, 12, dt);
    const tailRate = this.doing === 'air' || this.doing === 'path' ? 14 : 4;
    const rate = this.doing === 'air' ? 16 : this.doing === 'path' || this.toppleT >= 0 ? 12 : 6;
    d.bodyX = ease(d.bodyX, bodyX, rate * 1.5, dt);
    d.bodyY = ease(d.bodyY, bodyY, rate, dt);
    d.bodyZ = ease(d.bodyZ, bodyZ, rate, dt);
    d.pitch = ease(d.pitch, pitch, rate, dt);
    d.roll = ease(d.roll, roll, rate, dt);
    d.flex = ease(d.flex, flex, rate, dt);
    d.chestUp = ease(d.chestUp, chestUp, rate * 0.8, dt);
    d.bend = ease(d.bend, bend, 4, dt);
    d.headSize = this.kitten ? 1.32 : 1;
    d.neckLow = ease(d.neckLow, neckLow, 6, dt);
    d.headYaw = ease(d.headYaw, headYaw, 7, dt);
    d.headPitch = ease(d.headPitch, headPitch, 7, dt);
    d.headRoll = ease(d.headRoll, headRoll, 6, dt);
    d.jaw = ease(d.jaw, jaw, 18, dt);
    d.earBack = clamp(ears, -0.1, 0.95);
    /** Its ears turn ahead of a turn, and flap as it shakes. */
    const lead = clamp(this.turnLead * 0.6, -0.6, 0.6) + (this.shakeT >= 0 ? Math.sin(this.shakeT * 47) * 0.8 * (1 - smooth((this.shakeT - 0.6) / 0.4)) : 0);
    d.earTwitch[0] = (this.twitchL + lead + tremble * 0.3) * (1 - d.earBack);
    d.earTwitch[1] = (-this.twitchR - lead - tremble * 0.3) * (1 - d.earBack);
    const hockRate = this.doing === 'air' ? 12 : 6;
    d.hock[0] = ease(d.hock[0], hock, hockRate, dt);
    d.hock[1] = ease(d.hock[1], hock, hockRate, dt);
    d.tailLift = ease(d.tailLift, tailUp, tailRate, dt);
    d.tailCurl = ease(d.tailCurl, tailCurl, tailRate, dt);
    d.tailWrap = ease(d.tailWrap, tailWrap, 3, dt);
    /** The tail swings out to the outside of a turn, and lags as it comes back. */
    const swingOut = clamp((this.doing === 'path' ? this.turnLead * 0.5 : 0) + this.turning * 0.15, -0.6, 0.6);
    d.tailSwing = this.tailSpring.step((this.narrow && this.doing === 'path' ? -d.roll * 6 + Math.sin(this.time * 1.3) * 0.25 : 0) + swingOut, 20, 4, dt);
    d.tailWave += dt * (1.2 + 2 * fear) * (tailWave > 0 ? 1 : 0.3);
    d.tailFlick = ease(d.tailFlick, tailFlick, 14, dt);
    d.breath += dt * (1.6 + fear * 2.5 + (this.doing === 'path' ? 2 : 0));

    const look = this.lookNow;
    const blink = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.16) * Math.PI) : 0;
    const slow = this.idle === 'blink' ? Math.sin((this.idleT / this.idleFor) * Math.PI) ** 0.6 * 0.85 : 0;
    look.blink = this.staring ? 0 : Math.max(blink, slow, lids, w.curl * (1 - clamp(fear * 3, 0, 1)) * (gaze ? 0 : 0.85));
    look.pupil = clamp(pupil, 0.6, 0.93);
    look.air = 0.6;
    look.wet = this.wet;

    /** What the gait swings to and fro is laid over the eased pose rather than eased itself, so it keeps its full stride. */
    d.bodyY += osc.bodyY;
    d.bodyZ += osc.bodyZ;
    d.stretch += osc.stretch;
    d.hock[0] += osc.hock[0];
    d.hock[1] += osc.hock[1];
    d.neckLow += osc.neck;
    d.pitch += osc.pitch;
    d.flex += osc.flex;
    d.roll += osc.roll;
    d.bend += osc.bend;
    d.headPitch += osc.head;
    d.headRoll += osc.headRoll;
    d.headYaw += osc.headYaw;
    d.scale = this.scale;
    d.frame.copy(this.frameMatrix);
    d.origin.copy(this.at);
    d.forward.copy(this.fwd);
    d.up.copy(this.up);
    this.rig.pose(d);
    applyCatLook(this.mat, look, this.rig.nodes[HEAD].getWorldQuaternion(this.q));
    d.bodyY -= osc.bodyY;
    d.bodyZ -= osc.bodyZ;
    d.stretch -= osc.stretch;
    d.hock[0] -= osc.hock[0];
    d.hock[1] -= osc.hock[1];
    d.neckLow -= osc.neck;
    d.pitch -= osc.pitch;
    d.flex -= osc.flex;
    d.roll -= osc.roll;
    d.bend -= osc.bend;
    d.headPitch -= osc.head;
    d.headRoll -= osc.headRoll;
    d.headYaw -= osc.headYaw;
  }

  private readonly drop = new THREE.Vector3();
  private readonly fling = new THREE.Vector3();
  private readonly spine = new THREE.Vector3();

  /** Drops off its coat where the twist is, flung out round its body the way the twist turns, with the head, body and tail each taking their turn. */
  private throwWater(dt: number, head: number, body: number, tail: number, turn: number): void {
    if (this.wet < 0.3) return;
    const k = this.scale;
    const spine = this.spine.copy(this.fwd).transformDirection(this.frameMatrix);
    const up = this.w.copy(this.up).transformDirection(this.frameMatrix);
    const side = this.w2.crossVectors(up, spine).normalize();
    for (const [amount, bone, reach] of [[head, HEAD, 0.04], [body, CHEST, 0.055], [body, BODY, 0.06], [body, PELVIS, 0.055], [tail, TAIL[3], 0.02]] as const) {
      let n = amount * this.wet * 160 * dt;
      for (; n > 0; n--) {
        if (n < 1 && Math.random() > n) break;
        const a = (Math.random() - 0.5) * 2.4;
        const out = this.fling.copy(side).multiplyScalar(Math.sin(a) * Math.sign(turn || 1)).addScaledVector(up, Math.cos(a));
        this.rig.joint(bone, this.drop).addScaledVector(out, reach * k).addScaledVector(spine, (Math.random() - 0.5) * 0.06 * k);
        const speed = 1.1 + Math.random() * 1.1;
        out.multiplyScalar(speed).addScaledVector(up, 0.5 + Math.random() * 0.6);
        this.spray.fling(this.drop, out);
      }
    }
  }

  /** 0 to 1 as it comes up to a full gallop. */
  private get galloping(): number {
    return this.doing === 'path' && this.gait.kind === 'bound' ? clamp(this.gait.speed / (1.2 * this.scale), 0, 1) : 0;
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
  private readonly pawJoint = new THREE.Vector3();

  /** QA: how far each planted paw moved since the last frame, and how far the leg fell short of where it was put down. */
  private measure(): void {
    if (this.reframed) {
      this.reframed = false;
      this.plantedWas.fill(false);
    }
    for (let i = 0; i < 4; i++) {
      const planted = this.doing !== 'air' && this.doing !== 'lower' && this.gait.paws[i].planted && !(this.idle === 'wash' && i === 1) && !(this.batT >= 0 && i === 0) && this.toppleT < 0;
      this.pawW.copy(this.paws[i]);
      if (planted && this.plantedWas[i]) this.probe.slip = Math.max(this.probe.slip, this.pawW.distanceTo(this.pawsWas[i]));
      this.pawsWas[i].copy(this.pawW);
      this.plantedWas[i] = planted;
      if (!planted) continue;
      this.rig.joint(PAWS[i], this.pawJoint);
      const rise = (i < 2 ? WRIST : TOE) * this.scale;
      this.pawW.addScaledVector(this.up, rise).applyMatrix4(this.frameMatrix);
      /** A front paw may stand up on its toes by its own length before it counts as out of reach. */
      const toes = i < 2 ? 0.022 * this.scale : 0;
      const short = this.pawJoint.distanceTo(this.pawW) - toes;
      if (short > this.probe.reach) {
        this.probe.reach = short;
        this.probe.where = `${this.doing} ${this.doing === 'air' ? this.air : ''} paw ${i} at ${this.time.toFixed(2)} s`;
      }
    }
  }
}

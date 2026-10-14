import * as THREE from 'three';
import { ease } from './motion';
import { BODY, CHEST, FOOT_L, FOOT_R, HAND_L, HAND_R, HEAD, PELVIS, THIGH_L, THIGH_R, TOE, WRIST, squirrelGeometry } from './squirrel/body';
import { boundShape, type BoundShape } from './squirrel/bound';
import { PATTERNS, SquirrelGait, type Support } from './squirrel/gait';
import { SquirrelRig, STANCES, type Drives, type Stance, type StanceName } from './squirrel/pose';
import { Route, type Floor, type Kind, type SquirrelPoint } from './squirrel/route';
import { applySquirrelLook, coatShells, squirrelMaterial, type SquirrelLook } from './squirrel/shader';
import { QA } from '../qa';
import { tuning } from '../tuning';

export type { Floor, SquirrelPoint } from './squirrel/route';
export { sagging, spiral } from './squirrel/route';

export type SquirrelAction = 'stand' | 'sit' | 'freeze' | 'scold' | 'perch' | 'buried' | 'peek' | 'bound' | 'climb' | 'dive' | 'burst' | 'run-line';

/** Something it did this frame that can be heard. The squirrel only says what happened; the sound is made elsewhere. */
export interface SquirrelSound {
  kind: 'chuck' | 'chitter' | 'squeak' | 'claw' | 'patter' | 'land' | 'gnaw';
  amount: number;
}

/** It went into or came out of the leaves at `at`, this hard (0..1): for the litter to answer. */
export interface LeafStir {
  at: THREE.Vector3;
  strength: number;
  kind: 'dive' | 'burst' | 'peek' | 'step';
}

export interface ActOptions {
  /** Where to put it at once (for `dive` and `burst`, where it lands); without it, it changes how it holds itself where it is. */
  at?: THREE.Vector3;
  yaw?: number;
  /** The surface's own up where it stands: out of the bark on a trunk. World up by default. */
  up?: THREE.Vector3;
  /** Which way it faces along a surface that is not level: up a trunk, say. */
  forward?: THREE.Vector3;
  /** What it stands on, in the world; by default a level surface through `at`. */
  floor?: Floor | null;
  /** The radius of the trunk or branch it holds, so its paws wrap round it. */
  radius?: number;
  look?: THREE.Vector3 | null;
  /** Buried, diving or peeking: the tip of its tail left out of the leaves. */
  tailOut?: boolean;
  /** Sitting: a nut in its paws. */
  nut?: boolean;
  /** Peeking: seconds its head stays up before it goes back under. */
  for?: number;
}

const ACTION_STANCE: Record<SquirrelAction, StanceName> = {
  stand: 'stand', sit: 'sit', freeze: 'freeze', scold: 'scold', perch: 'perch', buried: 'buried', peek: 'peek',
  bound: 'bound', climb: 'climb', dive: 'dive', burst: 'freeze', 'run-line': 'wool',
};
const KIND_STANCE: Record<Kind, StanceName> = { ground: 'run', trunk: 'trunk', line: 'wool' };
type Num = { [K in keyof Stance]: Stance[K] extends number ? K : never }[keyof Stance];
const NUMBERS = (Object.keys(STANCES.stand) as (keyof Stance)[]).filter((k) => typeof STANCES.stand[k] === 'number') as Num[];
/** Its tail under the leaves: curled round its side and laid low, or with the last of it standing up out of them. */
const TAIL_IN: Partial<Stance> = { tailLift: -0.28, tailCurve: 0.0, tailTip: 0.02, tailBend: 1.25 };
const TAIL_OUT: Partial<Stance> = { tailLift: 0.6, tailCurve: 0.3, tailTip: 0.05, tailBend: 0.15 };
/** Standing on the wool, every paw on the one line. */
const ON_LINE: Partial<Stance> = { front: [0.002, 0.042], hind: [0.003, -0.012] };
/** Springing out of the leaves: stretched out up and on, ears back, tail flung up behind. */
const SPRING: Partial<Stance> = { tailLift: 1.0, tailCurve: 0.2, tailTip: -0.2, earBack: 0.5 };
const PAWS = [HAND_L, HAND_R, FOOT_L, FOOT_R];
const TAU = Math.PI * 2;

const clamp = THREE.MathUtils.clamp;
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The red squirrel of the autumn birches, which plays hide-and-seek in the leaf heaps with the child and the
 * cygnet. The story directs it by actions; each is a held shape of the whole animal (`pose.ts` STANCES) that it
 * eases into quickly, with its breath, blinks, ear flicks and quick glances laid over it. Where it is is a point on
 * a surface, which way it faces along it, and that surface's up, so the same body sits on the ground, crouches
 * along a branch or spreads itself up a trunk. It goes anywhere by `follow`, bounding over the ground, up and down
 * the trunks and along the wool on planted paws; it dives into the leaves, bursts out of them and peeks.
 */
export class Squirrel {
  readonly position = new THREE.Vector3();
  yaw = 0;
  visible = false;
  scale = tuning.squirrel.scale;
  /** What it said and did that can be heard since the last frame; whoever plays it empties it. */
  readonly heard: SquirrelSound[] = [];
  /** Told each time it goes into or comes out of the leaves (and lightly at each landing of a bound on the ground). */
  onLeaves: ((stir: LeafStir) => void) | null = null;
  /** QA: the furthest a planted paw moved in one frame, and the furthest a leg was asked to reach past its length. */
  readonly probe = { slip: 0, reach: 0, where: '' };
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly rig = new SquirrelRig();
  private readonly gait = new SquirrelGait();
  private readonly lookNow: SquirrelLook = { blink: 0, air: 0.6, nut: false };
  private readonly d: Drives;
  private readonly homes = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly runHomes = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  private readonly at = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3(0, 0, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly fwdWant = new THREE.Vector3(0, 0, 1);
  private readonly upWant = new THREE.Vector3(0, 1, 0);
  private readonly side = new THREE.Vector3();
  private readonly want: Stance = { ...STANCES.sit, front: [...STANCES.sit.front], hind: [...STANCES.sit.hind] };
  private readonly now: Stance = { ...STANCES.sit, front: [...STANCES.sit.front], hind: [...STANCES.sit.hind] };
  private mode: 'hold' | 'travel' | 'air' = 'hold';
  private floor: Floor | null = null;
  /** Where it stopped at the end of a way: its paws stand on the surfaces there. */
  private stoppedOn: ((p: THREE.Vector3) => void) | null = null;
  private radius = 0;
  private target: THREE.Vector3 | null = null;
  private doing: SquirrelAction = 'sit';
  private time = 0;
  private nextBlink = 2;
  private blinkT = -1;
  private nextGlance = 1;
  private readonly glance = new THREE.Vector2();
  private readonly glanceNow = new THREE.Vector2();
  private twitchL = 0;
  private twitchR = 0;
  private settled = 0;
  private placed = true;
  private busyFor = 0;
  private seatOff = 0;
  private tailOut = false;

  private route: Route | null = null;
  private routeEnd: SquirrelPoint | null = null;
  private along = 0;
  private speed = 0;
  private setOff = 0;
  private cruise = 0;
  private seg = 0;
  private kind: Kind = 'ground';
  /** How far through a leap from one kind of surface to the next it is, or -1 on one surface. */
  private crossing = -1;
  private onArrive: (() => void) | null = null;
  private readonly bound: BoundShape = { rise: 0, flex: 0, stretch: 0, pitch: 0, tail: 0 };
  private readonly support: Support;

  private air: 'dive' | 'burst' = 'dive';
  private airT = 0;
  private airFor = 0;
  private gatherFor = 0;
  private airArc = 0;
  private airRise = 0;
  private airPitch = 0;
  private stirred = false;
  private launched = false;
  private readonly airFrom = new THREE.Vector3();
  private readonly airTo = new THREE.Vector3();
  private endYaw: number | null = null;

  private peekT = 0;
  private peekFor = 0;
  private chuckIn = 0;
  private chucksLeft = 0;
  private chuckT = 1;
  private biteT = 0;
  private biting = true;
  private gnawIn = 0;

  private readonly contacts: number[];
  private readonly pawsWas = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly plantedWas = [false, false, false, false];
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly identity = new THREE.Matrix4();

  constructor() {
    this.mat = squirrelMaterial(this.rig.bones);
    this.mesh = new THREE.Mesh(squirrelGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.add(coatShells(this.mat));
    const skin = this.mesh.geometry.attributes.aSkin;
    const sits = [BODY, PELVIS, CHEST, THIGH_L, THIGH_R];
    /** Every other vertex of what it sits on: plenty to find its lowest point, few enough to be cheap. */
    this.contacts = Array.from({ length: skin.count }, (_, i) => i).filter((i) => i % 2 === 0 && sits.includes(skin.getX(i)) && sits.includes(skin.getY(i)));
    this.d = {
      frame: new THREE.Matrix4(), scale: this.scale, origin: new THREE.Vector3(), forward: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0),
      bodyX: 0, bodyY: 0, bodyZ: 0, pitch: 0, roll: 0, flex: 0, stretch: 0, chestUp: 0, bend: 0, neckLow: 0,
      headYaw: 0, headPitch: 0, headRoll: 0, jaw: 0, earBack: 0, earTwitch: [0, 0],
      tailLift: 0, tailSwing: 0, tailCurve: 0, tailTip: 0, tailBend: 0, tailWave: 0, tailWaveSize: 0, tailFlick: 0, tailRipple: 0, tailRipplePhase: 0,
      paws: this.gait.paws.map((p) => ({ at: p.at, curl: 0 })), hold: 0, holdHigh: 0, hock: [1.45, 1.45], breath: 0,
    };
    this.support = { origin: this.at, forward: this.fwd, up: this.up, side: this.side, scale: this.scale, snap: (p) => this.route!.snap(p, this.seg, this.crossing >= 0 ? this.route!.kind(this.seg, 'to') : this.kind) };
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh];
  }

  /** True while it is on its way somewhere or in the middle of something it was asked to do. */
  get busy(): boolean {
    return this.mode !== 'hold' || this.busyFor > 0 || this.doing === 'peek';
  }

  get action(): SquirrelAction {
    return this.doing;
  }

  /** Where its eyes are, in the world: for the child's and the cygnet's gaze and the camera. */
  eye(out: THREE.Vector3): THREE.Vector3 {
    return this.rig.joint(HEAD, out);
  }

  /** Turns its head to `target`, which it keeps following if it moves; null lets its gaze wander. */
  look(target: THREE.Vector3 | null): void {
    this.target = target;
  }

  /**
   * Holds itself as `name`, put at `opts.at` if given. `dive` springs from where it is into the leaves at `opts.at`
   * (or just ahead) and ends `buried`; `burst` springs up out of them (landing at `opts.at`, if given) and ends
   * sitting bolt upright (`freeze`); `peek` puts its head up out of the leaves for `opts.for` seconds and goes back
   * under. `bound`, `climb` and `run-line` hold the shape of each gait; `follow` is how it goes anywhere.
   * Unknown names are refused.
   */
  act(name: SquirrelAction, opts: ActOptions = {}): boolean {
    const stance = ACTION_STANCE[name];
    if (!stance) return false;
    this.route = null;
    this.onArrive = null;
    this.crossing = -1;
    this.airRise = 0;
    this.airPitch = 0;
    if (opts.look !== undefined) this.target = opts.look;
    if (name === 'dive') return this.dive(opts);
    if (name === 'burst') return this.burst(opts);
    if (opts.at) this.place(opts.at, opts.yaw ?? this.yaw, opts);
    else if (opts.yaw !== undefined) this.face(opts.yaw);
    this.mode = 'hold';
    this.doing = name;
    if (name === 'buried' || name === 'peek') this.tailOut = opts.tailOut ?? (name === 'buried' ? false : this.tailOut);
    this.hold(stance, name === 'buried' ? (this.tailOut ? TAIL_OUT : TAIL_IN) : name === 'run-line' ? ON_LINE : null);
    this.lookNow.nut = name === 'sit' && opts.nut !== false;
    this.busyFor = 0;
    if (name === 'peek') {
      this.peekT = 0;
      this.peekFor = opts.for ?? 1.6;
      this.stir('peek', 0.2, this.at);
    }
    if (name === 'scold') {
      this.chuckIn = 0.1;
      this.chucksLeft = 0;
    }
    return true;
  }

  /**
   * Goes along `path` and calls `onArrive` there: bounding over the ground (on `opts.floor`, or the ground through
   * each point), up and down trunks and along the wool, its paws planted on each, the turn from one surface to the
   * next taken in the gap between their points. If it is not at the first point it goes there first. It comes to a
   * stop at the end sitting up on the ground, holding on to the bark, or crouched on the wool.
   */
  follow(path: readonly SquirrelPoint[], onArrive?: () => void, opts: { floor?: Floor | null } = {}): void {
    if (path.length === 0) {
      onArrive?.();
      return;
    }
    const points = path.slice();
    if (points[0].at.distanceTo(this.at) > 0.05 * this.scale) {
      const onTrunk = this.up.y < 0.7;
      points.unshift({ at: this.at.clone(), on: onTrunk ? 'trunk' : this.radius === 0 && this.kind === 'line' ? 'line' : 'ground', up: this.up.clone(), radius: onTrunk ? this.radius || undefined : undefined });
    }
    const going = this.mode === 'travel';
    this.route = new Route(points, opts.floor !== undefined ? opts.floor : this.floor);
    this.routeEnd = points[points.length - 1];
    if (opts.floor !== undefined) this.floor = opts.floor;
    this.along = 0;
    this.crossing = -1;
    if (!going) {
      this.speed = 0;
      this.setOff = 0;
    }
    this.onArrive = onArrive ?? null;
    this.mode = 'travel';
    this.stoppedOn = null;
    this.lookNow.nut = false;
    this.busyFor = 0;
    this.seg = this.route.sample(0, this.v, this.upWant, this.fwdWant);
    this.kind = this.route.kind(this.seg, 'from');
    this.doing = this.kind === 'trunk' ? 'climb' : this.kind === 'line' ? 'run-line' : 'bound';
    this.hold(KIND_STANCE[this.kind], null);
    for (let i = 0; i < 4; i++) this.runHomes[i].set(...(i < 2 ? PATTERNS[this.kind].front : PATTERNS[this.kind].hind));
  }

  /** Under the leaves at `at`, the tip of its tail out of them or not. */
  hide(at: THREE.Vector3, opts: { tailOut?: boolean; yaw?: number; floor?: Floor | null } = {}): void {
    this.act('buried', { at, tailOut: opts.tailOut, yaw: opts.yaw ?? this.yaw, floor: opts.floor });
  }

  /** Out of the leaves, springing up to sit bolt upright. */
  flush(): void {
    this.act('burst');
  }

  /** On a branch at `point`, facing `yaw` along it. */
  perchAt(point: THREE.Vector3, yaw: number, opts: { floor?: Floor | null; radius?: number } = {}): void {
    this.act('perch', { at: point, yaw, floor: opts.floor, radius: opts.radius });
  }

  update(dt: number, time: number): void {
    this.mesh.visible = this.visible;
    if (!this.visible) return;
    this.time = time;
    this.busyFor = Math.max(0, this.busyFor - dt);
    this.support.scale = this.scale;
    if (this.mode === 'travel') this.travel(dt);
    else if (this.mode === 'air') this.fly(dt);
    else this.stay(dt);
    this.turn(dt);
    this.ease(dt);
    this.life(dt);
    this.drive(dt);
    if (QA) this.measure();
    this.placed = false;
    this.position.copy(this.at);
    this.yaw = Math.atan2(this.fwd.x, this.fwd.z);
  }

  private place(at: THREE.Vector3, yaw: number, opts: ActOptions): void {
    this.at.copy(at);
    this.floor = opts.floor ?? null;
    this.radius = opts.radius ?? 0;
    this.up.copy(opts.up ?? UP).normalize();
    if (opts.forward) this.fwd.copy(opts.forward);
    else this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    this.upWant.copy(this.up);
    this.fwdWant.copy(this.fwd);
    this.kind = this.up.y < 0.7 ? 'trunk' : 'ground';
    this.settled = 0;
    this.placed = true;
    this.seatOff = 0;
    this.stoppedOn = null;
  }

  private face(yaw: number): void {
    this.fwdWant.set(Math.sin(yaw), 0, Math.cos(yaw)).addScaledVector(this.up, -Math.sin(yaw) * this.up.x - Math.cos(yaw) * this.up.z).normalize();
  }

  private hold(name: StanceName, over: Partial<Stance> | null): void {
    Object.assign(this.want, STANCES[name], over ?? {});
    this.want.front = [...(over?.front ?? STANCES[name].front)];
    this.want.hind = [...(over?.hind ?? STANCES[name].hind)];
  }

  private stir(kind: LeafStir['kind'], strength: number, at: THREE.Vector3): void {
    this.onLeaves?.({ at: at.clone(), strength, kind });
  }

  /**
   * Its frame turns toward the surface's up and the way on, quickly but never in one frame. On its way the route's
   * own frame is already smooth, and lagging it round a trunk would tip the body into the bark, so once it is
   * going it holds to it exactly.
   */
  private turn(dt: number): void {
    const k = this.mode === 'travel' ? (this.setOff > 0.4 ? 1 : 1 - Math.exp(-dt * 16)) : 1 - Math.exp(-dt * 10);
    this.up.lerp(this.upWant, k).normalize();
    this.fwd.lerp(this.fwdWant, k);
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up));
    if (this.fwd.lengthSq() < 1e-8) this.fwd.copy(this.fwdWant).addScaledVector(this.up, -this.fwdWant.dot(this.up));
    this.fwd.normalize();
  }

  private travel(dt: number): void {
    const route = this.route!;
    const t = tuning.squirrel;
    const pace = (k: Kind) => (k === 'trunk' ? t.climbSpeed : k === 'line' ? t.lineSpeed : t.boundSpeed);
    this.cruise = Math.min(pace(route.kind(this.seg, 'from')), pace(route.kind(this.seg, 'to')));
    this.setOff += dt;
    /** Up out of a sit before it goes anywhere. */
    const ready = smooth((this.setOff - 0.05) / 0.15);
    const left = route.length - this.along;
    const brake = Math.sqrt(2 * t.brake * Math.max(0, left));
    const goal = Math.min(this.cruise * ready, brake);
    this.speed = goal > this.speed ? ease(this.speed, goal, t.pickUp, dt) : Math.max(goal, this.speed - t.brake * 1.5 * dt);
    this.along = Math.min(route.length, this.along + this.speed * dt);
    this.seg = route.sample(this.along, this.at, this.upWant, this.fwdWant);
    this.fwdWant.addScaledVector(this.upWant, -this.fwdWant.dot(this.upWant));
    if (this.fwdWant.lengthSq() < 1e-10) this.fwdWant.copy(this.fwd);
    this.fwdWant.normalize();
    const from = route.kind(this.seg, 'from');
    const to = route.kind(this.seg, 'to');
    const kind = route.t < 0.5 ? from : to;
    this.crossing = from === to ? -1 : route.t;
    /** Leaping from one surface to the other, it goes up off the ground in an arc. */
    this.airRise = from !== to && (from === 'ground' || to === 'ground') ? Math.sin(Math.PI * route.t) * 0.03 * this.scale : 0;
    if (kind !== this.kind) {
      this.kind = kind;
      this.doing = kind === 'trunk' ? 'climb' : kind === 'line' ? 'run-line' : 'bound';
      this.hold(KIND_STANCE[kind], null);
    }
    const p = PATTERNS[kind];
    for (let i = 0; i < 4; i++) {
      const [x, y] = i < 2 ? p.front : p.hind;
      this.runHomes[i].x = ease(this.runHomes[i].x, x, 8, dt);
      this.runHomes[i].y = ease(this.runHomes[i].y, y, 8, dt);
    }
    if (left < 0.004 && this.speed < 0.05) this.arrive();
  }

  private arrive(): void {
    const end = this.routeEnd!;
    const route = this.route!;
    const seg = this.seg;
    this.stoppedOn = (p) => void route.snap(p, seg);
    this.route = null;
    this.speed = 0;
    this.mode = 'hold';
    this.settled = 0.3;
    this.crossing = -1;
    this.airRise = 0;
    if (end.on === 'trunk') {
      this.radius = end.radius ?? 0.2;
      /** Stopped on the bark it hangs straight, head up the trunk, or head down it if it was going down. */
      const down = this.fwd.y < 0 ? -1 : 1;
      this.fwdWant.set(0, down, 0).addScaledVector(this.upWant, -down * this.upWant.y).normalize();
      this.doing = 'climb';
      this.hold('climb', null);
    } else if (end.on === 'line') {
      this.radius = 0;
      this.doing = 'run-line';
      this.hold('wool', ON_LINE);
    } else {
      this.radius = 0;
      this.doing = 'sit';
      this.hold('sit', null);
    }
    const done = this.onArrive;
    this.onArrive = null;
    done?.();
  }

  private dive(opts: ActOptions): boolean {
    if (opts.floor !== undefined) this.floor = opts.floor;
    const to = opts.at ? opts.at.clone() : this.at.clone().addScaledVector(this.fwd, 0.12 * this.scale);
    this.airFrom.copy(this.at);
    this.airTo.copy(to);
    const span = Math.hypot(to.x - this.at.x, to.z - this.at.z);
    if (span > 0.02) this.face(Math.atan2(to.x - this.at.x, to.z - this.at.z));
    this.endYaw = opts.yaw ?? null;
    this.tailOut = opts.tailOut ?? false;
    this.mode = 'air';
    this.air = 'dive';
    this.airT = 0;
    this.gatherFor = 0.16;
    this.airFor = 0.3 + 0.12 * Math.sqrt(span / this.scale * 4);
    this.airArc = 0.035 * this.scale + 0.2 * span;
    this.stirred = false;
    this.launched = false;
    this.doing = 'dive';
    this.radius = 0;
    this.stoppedOn = null;
    this.lookNow.nut = false;
    this.hold('crouch', null);
    return true;
  }

  private burst(opts: ActOptions): boolean {
    if (opts.floor !== undefined) this.floor = opts.floor;
    this.airFrom.copy(this.at);
    this.airTo.copy(opts.at ?? this.at);
    if (opts.yaw !== undefined) this.face(opts.yaw);
    this.endYaw = null;
    const span = this.airFrom.distanceTo(this.airTo);
    this.mode = 'air';
    this.air = 'burst';
    this.airT = 0;
    this.gatherFor = 0;
    this.airFor = 0.4 + 0.1 * span;
    this.airArc = 0.1 * this.scale + 0.2 * span;
    if (span > 0.02) this.face(Math.atan2(this.airTo.x - this.at.x, this.airTo.z - this.at.z));
    this.doing = 'burst';
    this.radius = 0;
    this.stoppedOn = null;
    this.lookNow.nut = false;
    this.hold('dive', SPRING);
    this.stir('burst', 1, this.at);
    this.heard.push({ kind: 'squeak', amount: 1 });
    this.blinkT = -1;
    return true;
  }

  private fly(dt: number): void {
    this.airT += dt;
    if (this.airT < this.gatherFor) return;
    const u = Math.min(1, (this.airT - this.gatherFor) / this.airFor);
    if (this.air === 'dive' && !this.launched) {
      this.launched = true;
      this.hold('dive', null);
    }
    this.at.lerpVectors(this.airFrom, this.airTo, u);
    if (this.up.y > 0.9) this.at.y = this.floorAt(this.at.x, this.at.z);
    this.airRise = this.airArc * 4 * u * (1 - u);
    const climb = (this.airArc * 4 * (1 - 2 * u)) / Math.max(this.airFor, 1e-3);
    const run = this.airFrom.distanceTo(this.airTo) / Math.max(this.airFor, 1e-3);
    /** Diving, it noses over into the leaves; bursting out, it goes up nose first and levels to land. */
    this.airPitch = this.air === 'dive' ? clamp(Math.atan2(climb, Math.max(run, 0.3)) - 0.35 * u, -1.1, 0.5) : 0.8 * (1 - u) * (1 - u) - 0.1 * u;
    if (this.air === 'burst' && u > 0.7) this.hold('freeze', null);
    if (this.air === 'dive' && !this.stirred && u >= 0.8) {
      this.stirred = true;
      this.stir('dive', 0.55, this.airTo);
      this.heard.push({ kind: 'land', amount: 0.5 });
    }
    if (u < 1) return;
    this.airRise = 0;
    this.airPitch = 0;
    this.mode = 'hold';
    this.settled = 0.3;
    if (this.air === 'dive') {
      this.doing = 'buried';
      if (this.endYaw !== null) this.face(this.endYaw);
      this.hold('buried', this.tailOut ? TAIL_OUT : TAIL_IN);
      this.placed = true;
    } else {
      this.doing = 'freeze';
      this.hold('freeze', null);
      this.busyFor = 0.35;
      this.heard.push({ kind: 'land', amount: 0.7 });
    }
  }

  /** Holding still: a peek runs its course, a scold its bouts of chucks, a sit its nibbling. */
  private stay(dt: number): void {
    if (this.doing === 'peek') {
      this.peekT += dt;
      if (this.peekT >= this.peekFor) {
        this.doing = 'buried';
        this.hold('buried', this.tailOut ? TAIL_OUT : TAIL_IN);
      }
    }
    this.chuckT += dt;
    if (this.doing === 'scold') {
      this.chuckIn -= dt;
      if (this.chuckIn <= 0) {
        if (this.chucksLeft <= 0) this.chucksLeft = 3 + Math.floor(Math.random() * 5);
        this.chucksLeft--;
        this.chuckT = 0;
        const chitter = this.chucksLeft === 0 && Math.random() < 0.35;
        this.heard.push({ kind: chitter ? 'chitter' : 'chuck', amount: 0.85 + Math.random() * 0.3 });
        this.chuckIn = this.chucksLeft > 0 ? 0.13 + Math.random() * 0.06 : (chitter ? 1.1 : 0.55) + Math.random() * 0.6;
      }
    }
    if (this.doing === 'sit' && this.lookNow.nut) {
      this.biteT -= dt;
      if (this.biteT <= 0) {
        this.biting = !this.biting;
        this.biteT = this.biting ? 1.4 + Math.random() * 1.8 : 0.8 + Math.random() * 1.6;
      }
      this.gnawIn -= dt;
      if (this.biting && this.gnawIn <= 0) {
        this.heard.push({ kind: 'gnaw', amount: 1 });
        this.gnawIn = 0.35 + Math.random() * 0.3;
      }
    }
  }

  private ease(dt: number): void {
    const rate = this.placed || this.settled < 0.05 ? 1e3 : this.mode === 'air' ? 18 : tuning.squirrel.snap;
    this.settled += dt;
    for (const k of NUMBERS) (this.now[k] as number) = ease(this.now[k] as number, this.want[k] as number, rate, dt);
    for (const i of [0, 1] as const) {
      this.now.front[i] = ease(this.now.front[i], this.want.front[i], rate, dt);
      this.now.hind[i] = ease(this.now.hind[i], this.want.hind[i], rate, dt);
    }
    this.now.seat = this.want.seat;
  }

  /** What makes it alive while it holds still: quick breath, blinks, an ear flicked at a sound, glances in sudden snaps. */
  private life(dt: number): void {
    const frozen = this.doing === 'freeze' || this.doing === 'burst';
    const going = this.mode !== 'hold';
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT < 0) {
      this.blinkT = 0;
      this.nextBlink = 2 + Math.random() * 4;
    }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.12) this.blinkT = -1;
    }
    this.nextGlance -= dt;
    if (this.nextGlance <= 0) {
      const wide = this.doing === 'peek' ? 1.2 : this.target ? 0.25 : 0.9;
      this.glance.set((Math.random() - 0.5) * wide, (Math.random() - 0.45) * 0.4 * wide);
      this.nextGlance = this.doing === 'peek' ? 0.3 + Math.random() * 0.5 : 0.5 + Math.random() * 2;
    }
    const snap = 1 - Math.exp(-dt * tuning.squirrel.glanceSnap);
    const still = frozen || going ? 0 : 1;
    this.glanceNow.x += (this.glance.x * still - this.glanceNow.x) * snap;
    this.glanceNow.y += (this.glance.y * still - this.glanceNow.y) * snap;
    const twitch = (x: number) => (Math.random() < dt * (frozen ? 0 : this.doing === 'scold' ? 1.2 : 0.35) ? 1 : x * Math.exp(-dt * 9));
    this.twitchL = twitch(this.twitchL);
    this.twitchR = twitch(this.twitchR);
    this.d.breath += dt * (frozen || going ? 7 : 4.2);
    this.d.tailWave += dt * (this.kind === 'line' && going ? 2.4 : 1.6);
  }

  private drive(dt: number): void {
    const d = this.d;
    const s = this.now;
    const k = this.scale;
    this.side.crossVectors(this.up, this.fwd).normalize();
    d.scale = k;
    d.frame.copy(this.identity);
    d.origin.copy(this.at);
    d.forward.copy(this.fwd);
    d.up.copy(this.up);
    let bodyY = s.bodyY + this.airRise / k;
    let bodyZ = s.bodyZ;
    let pitch = s.pitch + this.airPitch;
    let flex = s.flex;
    let stretch = s.stretch;
    let tailLift = s.tailLift;
    let headPitch = s.headPitch;
    let neckLow = s.neckLow;
    let jaw = s.jaw;
    let roll = 0;
    let tailSwing = 0;
    let tailFlick = 0;
    d.tailRipple = 0;
    d.hock[0] = d.hock[1] = s.hock;

    if (this.mode === 'travel') {
      const g = this.gait;
      const go = clamp(g.speed / Math.max(this.cruise * 0.7, 0.1), 0, 1);
      const size = this.kind === 'ground' ? 1 : this.kind === 'trunk' ? 0.45 : 0.6;
      const air = this.kind === 'ground' ? 1 : this.kind === 'trunk' ? 0.25 : 0.45;
      const b = boundShape(g.phase, size, air, this.bound);
      bodyY += b.rise * go;
      bodyZ += (b.stretch / 2) * go;
      flex += b.flex * go;
      stretch += b.stretch * go;
      pitch += b.pitch * go;
      /** The neck gives against the body's rise and its pitch, so the head travels more evenly than the body. */
      neckLow += (b.rise * 4 + 0.3 * b.pitch) * go;
      headPitch -= 0.6 * b.pitch * go;
      tailLift += b.tail * go;
      d.tailRipple = 0.16 * go * size;
      d.tailRipplePhase = g.phase * TAU;
      for (const i of [0, 1]) d.hock[i] = THREE.MathUtils.lerp(s.hock, g.paws[i + 2].hock, go);
      if (this.kind === 'line') {
        /** Balancing on the wool: the tail swings out against each lean of its body. */
        const sway = Math.sin(this.time * 2.7) * 0.6 + Math.sin(this.time * 4.3 + 1) * 0.4;
        roll = 0.05 * sway;
        tailSwing = -0.4 * sway;
      }
    }
    if (this.doing === 'scold') {
      /** Each chuck jerks the whole of it: the jaw snaps open, the body bobs and the tail flicks up its length. */
      const c = this.chuckT;
      const pulse = c < 0.16 ? Math.sin((c / 0.16) * Math.PI) : 0;
      jaw = s.jaw * 0.25 + 0.95 * (c < 0.09 ? Math.sin((c / 0.09) * Math.PI) : 0);
      bodyY -= 0.003 * pulse;
      pitch += 0.05 * pulse;
      tailFlick = 0.9 * pulse;
      tailLift += 0.2 * pulse;
    }
    if (this.doing === 'sit' && this.lookNow.nut) {
      const bite = this.biting ? Math.max(0, Math.sin(this.time * TAU * 6.5)) : 0;
      jaw = s.jaw + bite * 0.14;
      headPitch += this.biting ? -0.12 : 0.05;
    }
    d.bodyX = 0;
    d.bodyY = bodyY + this.seatOff;
    d.bodyZ = bodyZ;
    d.pitch = pitch;
    d.roll = roll;
    d.flex = flex;
    d.stretch = stretch;
    d.chestUp = s.chestUp;
    d.bend = 0;
    d.neckLow = neckLow;
    d.earBack = clamp(s.earBack, -0.2, 1);
    d.earTwitch[0] = this.twitchL * (1 - d.earBack);
    d.earTwitch[1] = -this.twitchR * (1 - d.earBack);
    d.tailLift = tailLift;
    d.tailCurve = s.tailCurve;
    d.tailTip = s.tailTip;
    d.tailBend = s.tailBend;
    d.tailSwing = tailSwing;
    d.tailWaveSize = this.doing === 'buried' || this.mode === 'travel' ? 0 : 0.035;
    d.tailFlick = tailFlick;
    d.hold = s.hold;
    d.holdHigh = s.holdHigh;
    d.jaw = jaw;

    let headYaw = this.glanceNow.x;
    headPitch += this.glanceNow.y;
    if (this.target && this.mode === 'hold') {
      const l = this.toLocal(this.target, this.v);
      headYaw = clamp(Math.atan2(l.x, l.z - 0.08), -1.4, 1.4) + this.glanceNow.x;
      headPitch = clamp(Math.atan2(l.y - 0.12, Math.hypot(l.x, l.z - 0.08)), -0.8, 0.9) + this.glanceNow.y * 0.5;
    }
    d.headYaw = headYaw;
    d.headPitch = headPitch;
    d.headRoll = this.lookNow.nut ? -0.12 : 0;

    this.paws(dt);
    this.rig.pose(d);
    this.seat(dt);
    this.lookNow.blink = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.12) * Math.PI) : 0;
    this.lookNow.air = this.up.y > 0.9 && !this.radius ? 0.6 : 1;
    applySquirrelLook(this.mat, this.lookNow, this.rig.nodes[HEAD].getWorldQuaternion(this.q));
  }

  /** Where each paw is: planted by the gait as it goes, stepped home as it stands, carried with it in the air. */
  private paws(dt: number): void {
    const s = this.now;
    const k = this.scale;
    const g = this.gait;
    if (this.mode === 'travel') {
      if (this.crossing >= 0) g.leap(this.crossing, this.support, this.runHomes, 0.03 * k);
      else {
        if (g.inLeap) g.land(PATTERNS[this.kind]);
        else g.run(dt, this.support, PATTERNS[this.kind], this.runHomes);
      }
      if (g.landed.length) this.tread();
    } else {
      for (let i = 0; i < 4; i++) {
        const front = i < 2;
        const [x, z] = front ? s.front : s.hind;
        const across = (i % 2 === 0 ? 1 : -1) * x * k;
        const lift = (front ? s.frontLift : s.hindLift) * k;
        const p = this.homes[i].copy(this.at).addScaledVector(this.side, across).addScaledVector(this.fwd, z * k);
        if (this.radius > 0 && !this.stoppedOn) {
          /** Round the trunk or branch it holds: a paw out to the side lies further round the bark. */
          const a = clamp(across / this.radius, -1.2, 1.2);
          p.addScaledVector(this.side, this.radius * Math.sin(a) - across).addScaledVector(this.up, -this.radius * (1 - Math.cos(a)));
        }
        if (this.stoppedOn) this.stoppedOn(p);
        else if (this.up.y > 0.9) p.y = this.floorAt(p.x, p.z);
        p.addScaledVector(this.up, lift + (this.mode === 'air' ? this.airRise : 0));
      }
      if (this.placed) g.reset(this.homes);
      else if (this.mode === 'air') g.lift(this.homes, s.curl);
      else {
        g.hold(dt, this.homes, this.up, 0.014 * k, 0.003 * k);
        if (g.landed.length && this.doing !== 'buried') this.heard.push({ kind: this.up.y < 0.7 ? 'claw' : 'patter', amount: 0.3 });
      }
    }
    for (let i = 0; i < 4; i++) {
      const p = g.paws[i];
      this.d.paws[i].curl = i < 2 && (p.planted || this.mode === 'air') ? Math.max(s.curl, p.curl) : p.curl;
    }
  }

  private tread(): void {
    const g = this.gait;
    for (const i of g.landed) {
      const on = g.paws[i].on;
      if (on === 'trunk') this.heard.push({ kind: 'claw', amount: 0.7 });
      else if (i >= 2 || on === 'ground') this.heard.push({ kind: 'patter', amount: on === 'line' ? 0.25 : 0.4 + 0.6 * clamp(g.speed / (this.cruise || 1), 0, 1) });
      if (on === 'ground' && i === 3) this.stir('step', 0.06, g.paws[i].at);
    }
  }

  private floorAt(x: number, z: number): number {
    return this.floor ? this.floor(x, z) : this.at.y;
  }

  /**
   * Its weight down on what it sits on: the lowest of its belly and haunches is put on the floor, no higher and no
   * lower. In the air the offset is kept as it was; just after landing it is taken up quickly rather than at once.
   */
  private seat(dt: number): void {
    const s = this.now;
    if (this.mode === 'air') return;
    let want = 0;
    if (s.seat && this.up.y > 0.9) {
      const low = this.lowest();
      if (!Number.isFinite(low)) return;
      want = this.seatOff - (low - 0.002) / this.scale;
    }
    /** Sunk, it is lifted out at once; held above what it sits on, it settles onto it over a moment. */
    const next = this.placed || want > this.seatOff ? want : ease(this.seatOff, want, s.seat ? 30 : tuning.squirrel.snap, dt);
    if (Math.abs(next - this.seatOff) < 1e-6) return;
    this.d.bodyY += next - this.seatOff;
    this.seatOff = next;
    this.rig.pose(this.d);
  }

  private lowest(): number {
    const { position: p, aSkin: skin } = this.mesh.geometry.attributes;
    const bones = this.rig.bones;
    let low = Infinity;
    for (const i of this.contacts) {
      const blend = skin.getZ(i);
      this.v.fromBufferAttribute(p, i);
      if (blend > 0) this.w.copy(this.v).applyMatrix4(bones[skin.getY(i)]);
      this.v.applyMatrix4(bones[skin.getX(i)]);
      if (blend > 0) this.v.lerp(this.w, blend);
      low = Math.min(low, this.v.y - this.floorAt(this.v.x, this.v.z));
    }
    return low;
  }

  /** QA: how far each planted paw moved since the last frame, and how far its leg fell short of it. */
  private measure(): void {
    for (let i = 0; i < 4; i++) {
      const p = this.gait.paws[i];
      const held = i < 2 && this.now.hold > 0.05;
      const planted = p.planted && this.mode !== 'air' && !held && !this.placed;
      if (planted && this.plantedWas[i]) {
        const moved = p.at.distanceTo(this.pawsWas[i]);
        if (moved > this.probe.slip) this.probe.slip = moved;
      }
      this.pawsWas[i].copy(p.at);
      this.plantedWas[i] = planted;
      if (!planted) continue;
      this.rig.joint(PAWS[i], this.w);
      this.v.copy(p.at).addScaledVector(this.up, (i < 2 ? WRIST : TOE) * this.scale);
      const short = this.w.distanceTo(this.v);
      if (short > this.probe.reach) {
        this.probe.reach = short;
        this.probe.where = `${this.doing} (${this.mode}${this.mode === "travel" ? ` phase ${this.gait.phase.toFixed(2)}` : ""}) paw ${i} on ${p.on} at ${this.time.toFixed(2)} s`;
      }
    }
  }

  /** A point in the world in its own space, before its scale: across to its left, up off what it stands on, and ahead. */
  private toLocal(p: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(p).sub(this.at);
    const x = out.dot(this.side);
    const y = out.dot(this.up);
    const z = out.dot(this.fwd);
    return out.set(x, y, z).divideScalar(this.scale);
  }
}

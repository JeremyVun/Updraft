import * as THREE from 'three';
import { ease } from './motion';
import { BODY, CHEST, HEAD, PELVIS, THIGH_L, THIGH_R, squirrelGeometry } from './squirrel/body';
import { SquirrelRig, STANCES, type Drives, type Stance, type StanceName } from './squirrel/pose';
import { applySquirrelLook, coatShells, squirrelMaterial, type SquirrelLook } from './squirrel/shader';
import { tuning } from '../tuning';

export type SquirrelAction = 'stand' | 'sit' | 'freeze' | 'scold' | 'perch' | 'buried' | 'peek' | 'bound' | 'climb' | 'dive' | 'burst' | 'run-line';
/** The surface height under a point of the world. */
export type Floor = (x: number, z: number) => number;

/** A point on its way: on the ground, on a trunk (with the bark's outward `up`), or on the wool of the scarf. */
export interface SquirrelPoint {
  at: THREE.Vector3;
  on: 'ground' | 'trunk' | 'line';
  up?: THREE.Vector3;
}

export interface ActOptions {
  /** Where to put it at once; without it, it changes how it holds itself where it is. */
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
  /** Buried: the tip of its tail left out of the leaves. */
  tailOut?: boolean;
  /** Sitting: a nut in its paws. */
  nut?: boolean;
}

const ACTION_STANCE: Record<SquirrelAction, StanceName> = {
  stand: 'stand', sit: 'sit', freeze: 'freeze', scold: 'scold', perch: 'perch', buried: 'buried', peek: 'peek',
  bound: 'bound', climb: 'climb', dive: 'buried', burst: 'freeze', 'run-line': 'bound',
};
type Num = { [K in keyof Stance]: Stance[K] extends number ? K : never }[keyof Stance];
const NUMBERS = (Object.keys(STANCES.stand) as (keyof Stance)[]).filter((k) => typeof STANCES.stand[k] === 'number') as Num[];
/** Its tail under the leaves: curled round its side and laid low, or with the last of it standing up out of them. */
const TAIL_IN: Partial<Stance> = { tailLift: -0.28, tailCurve: 0.0, tailTip: 0.02, tailBend: 1.25 };
const TAIL_OUT: Partial<Stance> = { tailLift: 0.6, tailCurve: 0.3, tailTip: 0.05, tailBend: 0.15 };
const RUN_LINE: Partial<Stance> = { front: [0.003, 0.09], hind: [0.004, -0.08] };

const clamp = THREE.MathUtils.clamp;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The red squirrel of the autumn birches, which plays hide-and-seek in the leaf heaps with the child and the
 * cygnet. The story directs it by actions; each is a held shape of the whole animal (`pose.ts` STANCES) that it
 * eases into quickly, with its breath, blinks, ear flicks and quick glances laid over it. Where it is is a point
 * on a surface, which way it faces along it, and that surface's up, so the same body sits on the ground, crouches
 * along a branch or spreads itself up a trunk.
 */
export class Squirrel {
  readonly position = new THREE.Vector3();
  yaw = 0;
  visible = false;
  scale = tuning.squirrel.scale;
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly rig = new SquirrelRig();
  private readonly lookNow: SquirrelLook = { blink: 0, air: 0.6, nut: false };
  private readonly d: Drives;
  private readonly paws = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private readonly at = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3(0, 0, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly side = new THREE.Vector3();
  private readonly want: Stance = { ...STANCES.sit, front: [...STANCES.sit.front], hind: [...STANCES.sit.hind] };
  private readonly now: Stance = { ...STANCES.sit, front: [...STANCES.sit.front], hind: [...STANCES.sit.hind] };
  private floor: Floor | null = null;
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
  private busyFor = 0;
  private path: SquirrelPoint[] | null = null;
  private leg = 0;
  private along = 0;
  private onArrive: (() => void) | null = null;
  private readonly contacts: number[];
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
      tailLift: 0, tailSwing: 0, tailCurve: 0, tailTip: 0, tailBend: 0, tailWave: 0, tailWaveSize: 0, tailFlick: 0,
      paws: this.paws.map((at) => ({ at, curl: 0 })), hold: 0, holdHigh: 0, hock: [1.45, 1.45], breath: 0,
    };
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh];
  }

  /** True while it is on its way somewhere or in the middle of something it was asked to do. */
  get busy(): boolean {
    return this.path !== null || this.busyFor > 0;
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

  /** Holds itself as `name`, put at `opts.at` if given. Unknown names are refused. */
  act(name: SquirrelAction, opts: ActOptions = {}): boolean {
    const stance = ACTION_STANCE[name];
    if (!stance) return false;
    this.path = null;
    this.onArrive = null;
    if (opts.at) this.place(opts.at, opts.yaw ?? this.yaw, opts);
    else if (opts.yaw !== undefined) this.face(opts.yaw);
    if (opts.look !== undefined) this.target = opts.look;
    this.doing = name;
    this.hold(stance, name === 'buried' || name === 'dive' ? (opts.tailOut ? TAIL_OUT : TAIL_IN) : name === 'run-line' ? RUN_LINE : null);
    this.lookNow.nut = name === 'sit' && opts.nut !== false;
    this.busyFor = name === 'burst' ? 0.6 : 0;
    return true;
  }

  /**
   * Goes along `path` and calls `onArrive` there. For now it glides from point to point held in the shape of its
   * gait (a bound on the ground, spread on a trunk, paws in one line on the wool); its steps come later.
   */
  follow(path: readonly SquirrelPoint[], onArrive?: () => void): void {
    if (path.length === 0) {
      onArrive?.();
      return;
    }
    this.path = path.slice();
    this.leg = 0;
    this.along = 0;
    this.onArrive = onArrive ?? null;
    this.enter(this.path[0]);
  }

  /** Under the leaves at `at`, the tip of its tail out of them or not. */
  hide(at: THREE.Vector3, opts: { tailOut?: boolean; yaw?: number; floor?: Floor | null } = {}): void {
    this.act('buried', { at, tailOut: opts.tailOut, yaw: opts.yaw ?? this.yaw, floor: opts.floor });
  }

  /** Out of the leaves at once, sitting bolt upright. */
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
    if (this.path) this.travel(dt);
    this.ease(dt);
    this.life(dt);
    this.drive();
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
    this.settled = 0;
  }

  private face(yaw: number): void {
    this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw)).addScaledVector(this.up, -Math.sin(yaw) * this.up.x - Math.cos(yaw) * this.up.z).normalize();
  }

  private hold(name: StanceName, over: Partial<Stance> | null): void {
    Object.assign(this.want, STANCES[name], over ?? {});
    this.want.front = [...(over?.front ?? STANCES[name].front)];
    this.want.hind = [...(over?.hind ?? STANCES[name].hind)];
  }

  private enter(p: SquirrelPoint): void {
    const stance: SquirrelAction = p.on === 'trunk' ? 'climb' : p.on === 'line' ? 'run-line' : 'bound';
    this.doing = stance;
    this.hold(ACTION_STANCE[stance], stance === 'run-line' ? RUN_LINE : null);
    this.up.copy(p.up ?? UP).normalize();
    this.radius = 0;
    this.floor = null;
    this.lookNow.nut = false;
  }

  private travel(dt: number): void {
    const path = this.path!;
    const from = path[this.leg];
    const to = path[Math.min(this.leg + 1, path.length - 1)];
    const length = from.at.distanceTo(to.at);
    const speed = from.on === 'trunk' ? tuning.squirrel.climbSpeed : from.on === 'line' ? tuning.squirrel.lineSpeed : tuning.squirrel.boundSpeed;
    this.along += speed * dt;
    const t = length > 1e-4 ? Math.min(1, this.along / length) : 1;
    this.at.lerpVectors(from.at, to.at, t);
    this.v.subVectors(to.at, from.at);
    this.v.addScaledVector(this.up, -this.v.dot(this.up));
    if (this.v.lengthSq() > 1e-8) this.fwd.copy(this.v.normalize());
    if (t < 1) return;
    this.leg++;
    this.along = 0;
    if (this.leg >= path.length - 1) {
      this.path = null;
      this.act(to.on === 'trunk' ? 'climb' : 'sit', { nut: false });
      const done = this.onArrive;
      this.onArrive = null;
      done?.();
      return;
    }
    this.enter(path[this.leg]);
  }

  private ease(dt: number): void {
    const rate = this.settled < 0.05 ? 1e3 : tuning.squirrel.snap;
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
      const wide = this.target ? 0.25 : 0.9;
      this.glance.set((Math.random() - 0.5) * wide, (Math.random() - 0.45) * 0.4 * wide);
      this.nextGlance = 0.5 + Math.random() * 2;
    }
    const snap = 1 - Math.exp(-dt * tuning.squirrel.glanceSnap);
    this.glanceNow.x += (this.glance.x * (frozen ? 0 : 1) - this.glanceNow.x) * snap;
    this.glanceNow.y += (this.glance.y * (frozen ? 0 : 1) - this.glanceNow.y) * snap;
    const twitch = (x: number) => (Math.random() < dt * (frozen ? 0 : 0.35) ? 1 : x * Math.exp(-dt * 9));
    this.twitchL = twitch(this.twitchL);
    this.twitchR = twitch(this.twitchR);
    this.d.breath += dt * (frozen ? 6 : 4.2);
    this.d.tailWave += dt * 1.6;
  }

  private drive(): void {
    const d = this.d;
    const s = this.now;
    const k = this.scale;
    this.side.crossVectors(this.up, this.fwd).normalize();
    d.scale = k;
    d.frame.copy(this.identity);
    d.origin.copy(this.at);
    d.forward.copy(this.fwd);
    d.up.copy(this.up);
    d.bodyX = 0;
    d.bodyY = s.bodyY;
    d.bodyZ = s.bodyZ;
    d.pitch = s.pitch;
    d.roll = 0;
    d.flex = s.flex;
    d.stretch = s.stretch;
    d.chestUp = s.chestUp;
    d.bend = 0;
    d.neckLow = s.neckLow;
    d.earBack = clamp(s.earBack, -0.2, 1);
    d.earTwitch[0] = this.twitchL * (1 - d.earBack);
    d.earTwitch[1] = -this.twitchR * (1 - d.earBack);
    d.tailLift = s.tailLift;
    d.tailCurve = s.tailCurve;
    d.tailTip = s.tailTip;
    d.tailBend = s.tailBend;
    d.tailSwing = 0;
    d.tailWaveSize = this.doing === 'buried' || this.doing === 'dive' ? 0 : 0.035;
    d.tailFlick = 0;
    d.hold = s.hold;
    d.holdHigh = s.holdHigh;
    d.hock[0] = d.hock[1] = s.hock;
    const nibble = this.lookNow.nut ? Math.max(0, Math.sin(this.time * 19)) * 0.06 : 0;
    d.jaw = s.jaw + nibble;

    let headYaw = this.glanceNow.x;
    let headPitch = s.headPitch + this.glanceNow.y;
    if (this.target) {
      const l = this.toLocal(this.target, this.v);
      headYaw = clamp(Math.atan2(l.x, l.z - 0.08), -1.4, 1.4) + this.glanceNow.x;
      headPitch = clamp(Math.atan2(l.y - 0.12, Math.hypot(l.x, l.z - 0.08)), -0.8, 0.9) + this.glanceNow.y * 0.5;
    }
    d.headYaw = headYaw;
    d.headPitch = headPitch;
    d.headRoll = this.lookNow.nut ? -0.12 : 0;

    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      const [x, z] = front ? s.front : s.hind;
      const across = (i % 2 === 0 ? 1 : -1) * x * k;
      const lift = (front ? s.frontLift : s.hindLift) * k;
      const p = this.paws[i].copy(this.at).addScaledVector(this.side, across).addScaledVector(this.fwd, z * k);
      if (this.radius > 0) {
        /** Round the trunk or branch it holds: a paw out to the side lies further round the bark. */
        const a = clamp(across / this.radius, -1.2, 1.2);
        p.addScaledVector(this.side, this.radius * Math.sin(a) - across).addScaledVector(this.up, -this.radius * (1 - Math.cos(a)));
      }
      if (this.up.y > 0.9) p.y = this.floorAt(p.x, p.z);
      p.addScaledVector(this.up, lift);
      d.paws[i].curl = front ? s.curl : 0;
    }
    this.rig.pose(d);
    if (s.seat && this.up.y > 0.9) this.seat();
    this.lookNow.blink = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.12) * Math.PI) : 0;
    this.lookNow.air = this.up.y > 0.9 && !this.radius ? 0.6 : 1;
    applySquirrelLook(this.mat, this.lookNow, this.rig.nodes[HEAD].getWorldQuaternion(this.q));
  }

  private floorAt(x: number, z: number): number {
    return this.floor ? this.floor(x, z) : this.at.y;
  }

  /** Its weight down on what it sits on: the lowest of its belly and haunches is put on the floor, no higher and no lower. */
  private seat(): void {
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
    if (!Number.isFinite(low) || Math.abs(low) < 0.0005) return;
    this.d.bodyY -= (low - 0.002) / this.scale;
    this.rig.pose(this.d);
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


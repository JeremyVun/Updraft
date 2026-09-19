import * as THREE from 'three';
import type { WindField, WindSample } from '../wind/field';
import { tuning } from '../tuning';
import { fieldAt, type FieldSample } from '../world/fields';
import { heightAt } from '../world/island';
import { POND, POND_LEVEL, pondOut } from '../world/heightfield';
import { ROCKS, TREE } from '../world/landmarks';
import { buildChild, FOREARM, UPPER_ARM, type Rig, type SocketName } from './body';
import { Scarf } from './scarf';
import type { Boat } from './boat';

type Action =
  | { kind: 'throw'; t: number; released: boolean; onRelease: () => void }
  | { kind: 'pickup'; t: number; onDone: () => void }
  | { kind: 'cheer'; t: number }
  | { kind: 'wave'; t: number }
  | { kind: 'reach'; t: number }
  | { kind: 'push'; t: number }
  | {
      kind: 'board'; t: number; boat: Boat; from: THREE.Vector3; local: THREE.Vector3;
      fromYaw: number; side: number; launched: boolean; onDone: () => void;
    };

interface Goal {
  x: number;
  z: number;
  run: boolean;
  onArrive?: () => void;
  near: number;
  /** A waypoint to reach first when the straight way is blocked. */
  detour?: { x: number; z: number };
  best: number;
  since: number;
}

const OBSTACLES = [...ROCKS, { x: TREE.x, z: TREE.z, radius: 1.3 }];

/** A built surface over the water the child can walk on: a jetty's deck, a strip from one end to the other. */
export interface Deck {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  halfWidth: number;
  height: number;
}
const WALK = 2.6;
const RUN = 5.4;
const SHADOW_FRAG = /* glsl */ `
uniform float uOpacity;
in vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  gl_FragColor = vec4(0.03, 0.06, 0.08, uOpacity * (1.0 - smoothstep(0.1, 1.0, r)));
}`;

const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));

/** Eases toward a target without ever starting or stopping abruptly: for anything a passenger is riding on. */
class Glide {
  value = 0;
  private velocity = 0;
  step(target: number, time: number, dt: number): number {
    if (dt <= 0) return this.value;
    const w = 2 / time;
    const x = w * dt;
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.value - target;
    const temp = (this.velocity + w * change) * dt;
    this.velocity = (this.velocity - w * temp) * decay;
    this.value = target + (change + temp) * decay;
    return this.value;
  }
}

/**
 * The child. Moves over the terrain toward goals, plays a handful of actions, and reacts on its own to the wind:
 * scarf and hem in the air, bracing in strong gusts, eyes on the paper plane.
 */
export class Traveller {
  readonly position = new THREE.Vector3();
  readonly scarf = new Scarf();
  readonly shadow: THREE.Mesh;
  yaw = 0;
  sitting = true;
  /** Carried by something else (the boat): placed each frame by `ride`, no walking. */
  riding = false;
  private rideRoll = 0;
  private ridePitch = 0;
  /** 0..1: both hands holding the drawing up in front. */
  presenting = 0;
  /** Walking speed as a share of the usual: slowed for a walk nothing hurries. */
  stroll = 1;
  /** Where the child is looking, if anywhere in particular. */
  lookAt: THREE.Vector3 | null = null;
  /** Down on their knees with the hem of the coat on the ground, 0 to 1: the height a child talks to something small at. */
  kneeling = 0;
  /** Extra forward lean of the body, radians, for bending over what they are holding or reaching for. */
  lean = 0;
  /** The head tipped toward a shoulder, radians, positive toward their own right. */
  tilt = 0;
  /**
   * Asleep in a bed, 0 to 1, and which side they are lying on, 1 to -1. Whoever puts them there says where with
   * `lieOn`; going in and coming out of it is one eased weight, so climbing in is the same move played slowly.
   */
  abed = 0;
  abedSide = 1;
  /** Both arms drawn in round whatever they are holding: the answer to a gust that lifts the blanket. */
  tighter = 0;
  /** Eyes shut. While it is up they are asleep however much of the lying pose they are in. */
  eyesShut = 0;
  private readonly rig: Rig;
  private goal: Goal | null = null;
  private action: Action | null = null;
  private speed = 0;
  private gait = 0;
  private sit = 1;
  private brace = 0;
  private blink = 0;
  private nextBlink = 2;
  private bob = 0;
  private headYaw = 0;
  private headPitch = 0;
  private readonly kneel = new Glide();
  private readonly abedGlide = new Glide();
  private readonly sideGlide = new Glide();
  private readonly shutGlide = new Glide();
  private readonly bedAt = new THREE.Vector3();
  private bedYaw = 0;
  private readonly lie = new THREE.Quaternion();
  private readonly spin = new THREE.Quaternion();
  private readonly axisX = new THREE.Vector3(1, 0, 0);
  private readonly axisY = new THREE.Vector3(0, 1, 0);
  private readonly leanNow = new Glide();
  private readonly tiltNow = new Glide();
  private readonly reachGlide = [new Glide(), new Glide()];
  /** Where each mitten has been asked to be, in the world, and how far it has got there (0 the pose's own arm, 1 on the point). */
  private readonly reachAt = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly reachWant = [0, 0];
  private readonly reachInBody = [false, false];
  private readonly reachNow = [0, 0];
  private readonly ik = {
    target: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    pole: new THREE.Vector3(),
    elbow: new THREE.Vector3(),
    upper: new THREE.Quaternion(),
    fore: new THREE.Quaternion(),
    bend: new THREE.Quaternion(),
    down: new THREE.Vector3(0, -1, 0),
    u: new THREE.Vector3(),
    f: new THREE.Vector3(),
  };
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly field: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 };
  /** Height of the clamber over a stone wall, 0 on open ground. */
  private hop = 0;
  private readonly prev = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly shadowMat: THREE.ShaderMaterial;
  private time = 0;

  constructor(private readonly wind: WindField) {
    this.rig = buildChild();
    /** Yaw first, then the tilt of whatever is carrying them, the same order the boat lies in. */
    this.rig.root.rotation.order = 'YXZ';
    this.shadowMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: SHADOW_FRAG,
      uniforms: { uOpacity: { value: 0.32 } },
      transparent: true,
      depthWrite: false,
    });
    const sg = new THREE.PlaneGeometry(2.2, 2.2);
    sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(sg, this.shadowMat);
    this.shadow.renderOrder = 4;
  }

  get objects(): THREE.Object3D[] {
    return [this.rig.root, this.scarf.mesh, this.shadow];
  }

  get visible(): boolean {
    return this.rig.root.visible;
  }

  set visible(on: boolean) {
    for (const o of this.objects) o.visible = on;
  }

  /**
   * The middle of the sheet when they hold it up: in front of the face and a little to one side, and near enough in
   * that their own hands can be on the bottom corners of it instead of pointing at where it is.
   */
  presentPoint(out: THREE.Vector3): THREE.Vector3 {
    const up = this.sitting ? 1.88 : 2.4;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    return out.set(this.position.x + fx * 0.52 - fz * 0.38, this.position.y + up, this.position.z + fz * 0.52 + fx * 0.38);
  }

  /** A place on the child's own body where a companion rides; it moves with every bone above it. */
  socket(name: SocketName): THREE.Object3D {
    return this.rig.sockets[name];
  }

  /**
   * Puts a mitten on a point in the world and keeps it there until told otherwise (`null`). The hand is eased onto
   * the point and off it again, and the elbow finds its own place, so the caller only ever says where.
   * `hand` 0 is the one on their left (+x in their own frame), 1 the one on their right.
   */
  reachFor(hand: 0 | 1, target: THREE.Vector3 | null): void {
    if (target) {
      this.reachAt[hand].copy(target);
      this.reachInBody[hand] = false;
    }
    this.reachWant[hand] = target ? 1 : 0;
  }

  /** The same, for a point that moves with the child (something they are carrying): given in the frame of their body. */
  reachLocal(hand: 0 | 1, target: THREE.Vector3): void {
    this.reachAt[hand].copy(target);
    this.reachWant[hand] = 1;
    this.reachInBody[hand] = true;
  }

  /**
   * On a swing: how much of the pose it takes over, 0 to 1, and where in the pumping they are, -1 tucked at the
   * back of the arc to 1 with their legs out at the front of it.
   */
  swing = 0;
  kick = 0;

  /** Where the child's face is, for something small to look up at. */
  face(out: THREE.Vector3): THREE.Vector3 {
    return this.rig.head.getWorldPosition(out);
  }

  /** A world point in the frame of the child's body, as posed this frame. */
  toBody(world: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return this.rig.body.worldToLocal(out.copy(world));
  }

  fromBody(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return this.rig.body.localToWorld(out.copy(local));
  }

  /** How nearly a mitten has arrived on the point it was sent to, 0 to 1. */
  reached(hand: 0 | 1): number {
    return this.reachNow[hand];
  }

  /** World position of either mitten. */
  mitten(hand: 0 | 1, out: THREE.Vector3): THREE.Vector3 {
    this.rig.root.updateMatrixWorld(true);
    return (hand === 0 ? this.rig.handR : this.rig.handL).getWorldPosition(out);
  }

  /** Set while the child is in the middle of something with somebody else (gathering the cygnet up, setting it down), so the story waits for it like any other action. */
  engaged = false;

  get busy(): boolean {
    return this.goal !== null || this.acting;
  }

  /** An action or shared animation is in progress; ordinary walking may safely be checkpointed. */
  get acting(): boolean { return this.action !== null || this.engaged; }

  get moving(): boolean {
    return this.goal !== null;
  }

  /** Both hands belong to the cygnet; the plane's keel goes under the satchel's outer flap. */
  armsFull = false;
  /** Keeps the free mitten outside the bell of the coat while it grips the paper. */
  carryingPlane = false;
  private stowed = 0;
  private readonly paperLocal = new THREE.Quaternion();
  private readonly paperStowed = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -0.18, 'ZYX'));
  private readonly paperHand = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0, -Math.PI / 2, 'YXZ'));

  /** The paper's grip, either in the mitten or against the outside of the bag. */
  handPosition(out: THREE.Vector3): THREE.Vector3 {
    this.rig.root.updateMatrixWorld(true);
    this.rig.handR.getWorldPosition(out);
    if (this.stowed < 0.001) return out;
    const tucked = this.rig.body.localToWorld(this.tmp2.set(0.06, 0.78, -0.88));
    out.lerp(tucked, this.stowed);
    /** Carry it round the outside of the shoulder, clear of the hood and the bird. */
    this.tmp2.set(Math.sin(this.stowed * Math.PI) * tuning.paperCarry.transferArc, 0, 0);
    this.tmp2.applyQuaternion(this.rig.body.getWorldQuaternion(this.paperLocal));
    out.add(this.tmp2);
    return out;
  }

  /** Edge-on beside the coat in one hand; nose up, wings behind the bag when both arms are full. */
  planeQuaternion(out: THREE.Quaternion): THREE.Quaternion {
    this.rig.root.updateMatrixWorld(true);
    /** Keep the wing outside the hood through the wind-up; the glider levels only after release. */
    this.paperLocal.copy(this.paperHand).slerp(this.paperStowed, this.stowed);
    return this.rig.body.getWorldQuaternion(out).multiply(this.paperLocal);
  }

  /** Decks the child may walk on; anywhere else the ground is the terrain. */
  decks: Deck[] = [];

  /** The terrain under a point, or a deck built over it. */
  private ground(x: number, z: number): number {
    for (const d of this.decks) {
      const dx = d.x1 - d.x0;
      const dz = d.z1 - d.z0;
      const len2 = dx * dx + dz * dz;
      const t = ((x - d.x0) * dx + (z - d.z0) * dz) / len2;
      if (t < 0 || t > 1) continue;
      const px = d.x0 + dx * t;
      const pz = d.z0 + dz * t;
      if (Math.hypot(x - px, z - pz) <= d.halfWidth) return Math.max(d.height, heightAt(x, z));
    }
    return heightAt(x, z);
  }

  place(x: number, z: number, yaw: number): void {
    this.position.set(x, Math.max(this.ground(x, z), 0), z);
    this.yaw = yaw;
    this.pose(0);
    this.scarf.reset(this.rig.neck.getWorldPosition(this.tmp));
  }

  /**
   * Where the bed is: the point the child lies from (the foot end of the mattress, at the height their body rides)
   * and the way their head end points. Raising `abed` from 0 to 1 is getting into it; lowering it is getting out.
   */
  lieOn(at: THREE.Vector3, headTo: THREE.Vector2): void {
    this.bedAt.copy(at);
    this.bedYaw = Math.atan2(-headTo.x, -headTo.y);
  }

  ride(at: THREE.Vector3, yaw: number, roll = 0, pitch = 0): void {
    this.riding = true;
    this.sitting = true;
    this.goal = null;
    this.position.copy(at);
    this.yaw = yaw;
    /** A rider takes only some of what the hull does: they ride it out nearer upright than the boat lies. */
    this.rideRoll = roll * 0.55;
    this.ridePitch = pitch * 0.55;
  }

  dismount(): void {
    this.riding = false;
    this.sitting = false;
    this.position.y = Math.max(this.ground(this.position.x, this.position.z), 0);
  }

  walkTo(x: number, z: number, run = false, onArrive?: () => void, near = 0.6): void {
    this.sitting = false;
    this.goal = { x, z, run, onArrive, near, best: Infinity, since: 0 };
  }

  stop(): void {
    this.goal = null;
  }

  sitDown(): void {
    this.goal = null;
    this.sitting = true;
  }

  standUp(): void {
    this.sitting = false;
  }

  throwToward(x: number, z: number, onRelease: () => void): void {
    this.goal = null;
    this.sitting = false;
    this.faceToward(x, z, 1);
    this.action = { kind: 'throw', t: 0, released: false, onRelease };
  }

  pickUp(onDone: () => void): void {
    this.goal = null;
    this.action = { kind: 'pickup', t: 0, onDone };
  }

  cheer(): void {
    const busy = this.action && this.action.kind !== 'wave' && this.action.kind !== 'cheer';
    if (!busy) this.action = { kind: 'cheer', t: 0 };
  }

  wave(): void {
    if (!this.action) this.action = { kind: 'wave', t: 0 };
  }

  /** Both hands after something the wind has taken: the one gesture in the story that does not get what it wants. */
  reach(): void {
    this.action = { kind: 'reach', t: 0 };
  }

  push(): void {
    this.action = { kind: 'push', t: 0 };
  }

  /**
   * One continuous departure: push until the hull gives, travel with it while stepping over the gunwale, and only
   * hand control back to the story once the child has put their weight down on the thwart.
   */
  board(boat: Boat, onDone: () => void): void {
    this.goal = null;
    this.sitting = false;
    this.riding = false;
    boat.group.updateMatrixWorld(true);
    const from = boat.group.worldToLocal(this.position.clone());
    this.action = {
      kind: 'board', t: 0, boat, from, local: new THREE.Vector3(), fromYaw: this.yaw,
      side: from.x < 0 ? -1 : 1, launched: false, onDone,
    };
  }

  faceToward(x: number, z: number, amount: number): void {
    const target = Math.atan2(x - this.position.x, z - this.position.z);
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * amount;
  }

  update(dt: number): void {
    this.time += dt;
    const p = this.position;
    this.prev.copy(p);
    if (!this.riding) this.updateGoal(dt);
    this.updateAction(dt);

    const w = this.wind.sample(p.x, p.z, this.sample);
    const windSpeed = Math.hypot(w.x, w.z);
    const strong = Math.min(1, Math.max(0, (windSpeed - 7) / 10) + w.energy * 0.6);
    this.brace = damp(this.brace, this.sitting ? 0 : strong, strong > this.brace ? 5 : 1.5, dt);

    this.blink -= dt;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 0.13;
      this.nextBlink = 2 + Math.random() * 4;
    }

    /** Let the mitten come away from the bird before bringing the paper back out of the bag. */
    const keepStowed = this.armsFull || this.riding || (this.stowed > 0.5 && this.reachNow[0] > 0.1 && this.presenting < 0.01);
    this.stowed = damp(this.stowed, keepStowed ? 1 : 0, tuning.paperCarry.transferRate, dt);
    this.pose(dt);

    const moved = Math.hypot(p.x - this.prev.x, p.z - this.prev.z);
    if (moved > 0.01 && !this.sitting && !this.riding) {
      this.wind.addSplat({
        ax: this.prev.x,
        az: this.prev.z,
        bx: p.x,
        bz: p.z,
        vx: ((p.x - this.prev.x) / dt) * 1.2,
        vz: ((p.z - this.prev.z) / dt) * 1.2,
        radius: 1.4,
        energy: 0,
        swirl: 0,
        lift: 0,
      });
    }

    const neck = this.rig.neck.getWorldPosition(this.tmp);
    const centre = this.tmp2.set(p.x, p.y + (this.sitting ? 0.7 : 1.1), p.z);
    this.scarf.update(dt, neck, centre, 0.52, w, this.riding ? p.y - 0.2 : Math.max(this.ground(p.x, p.z), 0), p);
    this.rig.material.uniforms.uGroundPos.value.copy(p);

    this.shadow.position.set(p.x, p.y + 0.06, p.z);
    this.shadowMat.uniforms.uOpacity.value = this.riding ? 0 : 0.3;
  }

  private updateGoal(dt: number): void {
    const g = this.goal;
    const p = this.position;
    let target = 0;
    if (g) {
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      this.watchProgress(g, d, dt);
      const aim = g.detour ?? g;
      const dx = aim.x - p.x;
      const dz = aim.z - p.z;
      const da = Math.hypot(dx, dz);
      if (g.detour && da < 1) g.detour = undefined;
      if (d < g.near) {
        this.goal = null;
        g.onArrive?.();
      } else {
        target = (g.run ? RUN : WALK * this.stroll) * Math.min(1, da / 1.5 + 0.3);
        const want = this.steer(Math.atan2(dx, dz), da);
        let dy = want - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * 7);
      }
    }
    this.speed = damp(this.speed, target, target > this.speed ? 6 : 9, dt);
    if (this.speed < 0.01) return;
    const step = this.speed * dt * Math.max(0, Math.cos(Math.min(1.2, Math.abs(this.turnDebt()))));
    let nx = p.x + Math.sin(this.yaw) * step;
    let nz = p.z + Math.cos(this.yaw) * step;
    for (const r of OBSTACLES) {
      const ox = nx - r.x;
      const oz = nz - r.z;
      const od = Math.hypot(ox, oz);
      const keep = r.radius + 0.55;
      if (od < keep && od > 1e-4) {
        nx = r.x + (ox / od) * keep;
        nz = r.z + (oz / od) * keep;
      }
    }
    const nextH = this.ground(nx, nz);
    /** The inland pond sits above sea level; its bed is ground, but is not somewhere to walk. */
    const atPond = nextH < POND_LEVEL + 0.2 &&
      Math.abs(nx - POND.x) < POND.rx * 1.5 && Math.abs(nz - POND.z) < POND.rz * 1.5 && pondOut(nx, nz) < 1.15;
    const shore = atPond ? POND_LEVEL + 0.2 : 0.2;
    if (nextH < shore && nextH < this.ground(p.x, p.z)) {
      this.speed = 0;
      if (this.goal) {
        const arrive = this.goal.onArrive;
        this.goal = null;
        arrive?.();
      }
      return;
    }
    this.gait += (step / (this.speed > 4 ? 1.5 : 1.1)) * Math.PI;
    p.set(nx, Math.max(nextH, 0), nz);
    const f = fieldAt(nx, nz, this.field);
    const over = f.wall && f.presence > 0.5 ? 1 - THREE.MathUtils.smoothstep(f.edge, 0.2, 1.1) : 0;
    this.hop += (over * 1.25 - this.hop) * (1 - Math.exp(-dt * 14));
  }

  /** When the child stops closing on the goal, pick a waypoint off to the side and go round. */
  private watchProgress(g: Goal, d: number, dt: number): void {
    if (d < g.best - 0.5) {
      g.best = d;
      g.since = 0;
      return;
    }
    g.since += dt;
    if (g.since < 1.1 || g.detour) return;
    g.since = 0;
    g.best = d;
    const p = this.position;
    const ax = (g.x - p.x) / d;
    const az = (g.z - p.z) / d;
    for (const side of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
      for (const reach of [7, 11]) {
        const x = p.x + (-az * side * reach + ax * 3);
        const z = p.z + (ax * side * reach + az * 3);
        const blocked = OBSTACLES.some((r) => Math.hypot(x - r.x, z - r.z) < r.radius + 1.2);
        if (!blocked && this.ground(x, z) > 0.6) {
          g.detour = { x, z };
          return;
        }
      }
    }
  }

  /** Bends the heading around rocks and the trunk that lie between the child and the goal. */
  private steer(heading: number, distance: number): number {
    const p = this.position;
    const hx = Math.sin(heading);
    const hz = Math.cos(heading);
    let best = heading;
    let nearest = Infinity;
    for (const r of OBSTACLES) {
      const ox = r.x - p.x;
      const oz = r.z - p.z;
      const along = ox * hx + oz * hz;
      if (along < 0 || along > Math.min(distance, 7) + r.radius) continue;
      const across = ox * hz - oz * hx;
      const clear = r.radius + 0.9;
      if (Math.abs(across) > clear || along >= nearest) continue;
      nearest = along;
      const side = across >= 0 ? -1 : 1;
      best = heading + side * Math.min(1.2, Math.asin(Math.min(1, clear / Math.max(Math.hypot(ox, oz), clear))) + 0.2);
    }
    return best;
  }

  private turnDebt(): number {
    const g = this.goal;
    if (!g) return 0;
    const aim = g.detour ?? g;
    const want = this.steer(Math.atan2(aim.x - this.position.x, aim.z - this.position.z), Math.hypot(aim.x - this.position.x, aim.z - this.position.z));
    return Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw));
  }

  private updateAction(dt: number): void {
    const a = this.action;
    if (!a) return;
    a.t += dt;
    if (a.kind === 'throw') {
      if (!a.released && a.t > 0.62) {
        a.released = true;
        a.onRelease();
      }
      if (a.t > 1.1) this.action = null;
    } else if (a.kind === 'pickup') {
      if (a.t > 0.9) {
        this.action = null;
        a.onDone();
      }
    } else if (a.kind === 'cheer' && a.t > 1.3) this.action = null;
    else if (a.kind === 'wave' && a.t > 1.8) this.action = null;
    else if (a.kind === 'reach' && a.t > 4.2) this.action = null;
    else if (a.kind === 'push' && a.t > 2.4) this.action = null;
    else if (a.kind === 'board') {
      const k = tuning.boarding;
      const boat = a.boat;
      if (!a.launched && a.t >= k.launch) {
        a.launched = true;
        boat.launch(true);
      }

      /** Stay in the boat's frame once it starts to move: there is no interval in which the hull sails underneath. */
      if (a.t < k.push) {
        a.local.copy(a.from);
      } else if (a.t < k.rail) {
        const u = THREE.MathUtils.smootherstep(a.t, k.push, k.rail);
        a.local.lerpVectors(a.from, this.tmp.set(a.side * k.railIn, k.railHeight, -0.08), u);
        a.local.y += Math.sin(u * Math.PI) * k.stepArc;
      } else if (a.t < k.inside) {
        const u = THREE.MathUtils.smootherstep(a.t, k.rail, k.inside);
        a.local.lerpVectors(
          this.tmp.set(a.side * k.railIn, k.railHeight, -0.08),
          this.tmp2.set(a.side * k.insideIn, k.insideHeight, -0.25),
          u,
        );
        a.local.y += Math.sin(u * Math.PI) * k.stepArc * 0.55;
      } else {
        const u = THREE.MathUtils.smootherstep(a.t, k.inside, k.seated);
        a.local.lerpVectors(
          this.tmp.set(a.side * k.insideIn, k.insideHeight, -0.25),
          this.tmp2.set(0, 0.02, -0.25),
          u,
        );
      }
      a.local.applyMatrix4(boat.group.matrixWorld);
      this.position.copy(a.local);
      const turn = Math.atan2(Math.sin(boat.yaw - a.fromYaw), Math.cos(boat.yaw - a.fromYaw));
      this.yaw = a.fromYaw + turn * THREE.MathUtils.smootherstep(a.t, k.push * 0.55, k.inside);
      this.riding = a.t >= k.launch;
      this.sitting = a.t >= k.inside;
      this.rideRoll = boat.roll * 0.55;
      this.ridePitch = boat.pitch * 0.55;

      if (a.t >= k.settle) {
        this.action = null;
        boat.finishBoarding();
        this.ride(boat.seat(this.tmp), boat.yaw, boat.roll, boat.pitch);
        a.onDone();
      }
    }
  }

  private pose(dt: number): void {
    const r = this.rig;
    const t = this.time;
    this.sit = damp(this.sit, this.sitting ? 1 : 0, 4, dt || 1);
    const moving = Math.min(1, this.speed / WALK);
    const running = Math.min(1, Math.max(0, (this.speed - WALK) / (RUN - WALK)));
    const swing = Math.sin(this.gait);
    const legAmp = 0.55 * moving + 0.25 * running;
    const armAmp = 0.45 * moving + 0.35 * running;
    this.bob = Math.abs(Math.cos(this.gait)) * (0.06 + 0.07 * running) * moving;

    let armLX = -swing * armAmp;
    let armRX = swing * armAmp;
    let armLZ = -0.4 - 0.1 * running;
    let armRZ = 0.4 + 0.1 * running;
    /** Elbows: a little bent at rest, pumping when they run, and folded by whatever the arms are doing. */
    let elbowL = 0.3 + 0.75 * running + Math.max(0, swing) * 0.5 * moving;
    let elbowR = 0.3 + 0.75 * running + Math.max(0, -swing) * 0.5 * moving;
    let bodyX = 0.12 * moving + 0.16 * running;
    let bodyY = 0;
    let lift = 0;
    let crouch = 0;
    let boardingStep = 0;
    let boardingSide = 1;

    const a = this.action;
    if (a?.kind === 'throw') {
      /** Keep the held wing outside the coat as the arm comes up beside the hood. */
      armRZ = 0.65;
      const wind = THREE.MathUtils.smoothstep(a.t, 0, 0.55);
      const fling = THREE.MathUtils.smoothstep(a.t, 0.55, 0.72);
      const settle = THREE.MathUtils.smoothstep(a.t, 0.8, 1.1);
      armRX = THREE.MathUtils.lerp(armRX, (-2.5 * wind + 3.6 * fling) * (1 - settle), 1 - settle * 0.3);
      bodyY = (-0.35 * wind + 0.6 * fling) * (1 - settle);
      bodyX = -0.12 * wind + 0.25 * fling * (1 - settle);
      armLX = 0.5 * wind * (1 - settle);
    } else if (a?.kind === 'pickup') {
      const down = Math.sin(Math.min(1, a.t / 0.9) * Math.PI);
      bodyX = 0.9 * down;
      crouch = 0.28 * down;
      armRX = -1.2 * down;
      armLX = -0.8 * down;
      elbowL = elbowR = 0.3 + 0.5 * down;
    } else if (a?.kind === 'cheer') {
      const up = Math.sin(Math.min(1, a.t / 1.3) * Math.PI);
      armLX = armRX = -3.1 * Math.min(1, up * 1.8);
      armLZ = -0.55 * up;
      armRZ = 0.55 * up;
      lift = Math.max(0, Math.sin(a.t * 7.5)) * 0.46 * up;
      bodyY = Math.sin(a.t * 5.2) * 0.3 * up;
      bodyX = -0.3 * up;
    } else if (a?.kind === 'wave') {
      const up = Math.min(1, a.t * 4) * Math.min(1, (1.8 - a.t) * 4);
      armRX = -2.6 * up;
      armRZ = 0.3 + Math.sin(a.t * 12) * 0.35 * up;
    } else if (a?.kind === 'reach') {
      /** Straight out and then slowly down: the arms give up a long time after the rest of them does. */
      const out = Math.min(1, a.t * 5) * (1 - THREE.MathUtils.smoothstep(a.t, 1.6, 4.2));
      armLX = armRX = -2.45 * out;
      armLZ = 0.4 * out;
      armRZ = -0.4 * out;
      bodyX = -0.22 * out;
    } else if (a?.kind === 'push') {
      const lean = Math.min(1, a.t * 2) * Math.min(1, (2.4 - a.t) * 2);
      bodyX = 0.75 * lean;
      armLX = armRX = -1.4 * lean;
      crouch = 0.1 * lean;
    } else if (a?.kind === 'board') {
      const k = tuning.boarding;
      const press = THREE.MathUtils.smoothstep(a.t, 0, k.push) * (1 - THREE.MathUtils.smoothstep(a.t, k.push, k.rail));
      const climb = THREE.MathUtils.smootherstep(a.t, k.push * 0.78, k.inside);
      const settle = THREE.MathUtils.smootherstep(a.t, k.inside, k.settle);
      bodyX = 0.7 * press + 0.22 * climb * (1 - settle);
      bodyY = a.side * Math.sin(climb * Math.PI) * 0.24;
      crouch = 0.12 * press + Math.sin(climb * Math.PI) * 0.08;
      armLX = THREE.MathUtils.lerp(-1.35, -0.45, climb);
      armRX = THREE.MathUtils.lerp(-1.35, -0.55, climb);
      boardingStep = Math.sin(THREE.MathUtils.smoothstep(a.t, k.push * 0.82, k.inside) * Math.PI);
      boardingSide = a.side;
    }

    if (this.presenting > 0.01) {
      const k = this.presenting;
      armLX = THREE.MathUtils.lerp(armLX, -1.75, k);
      armRX = THREE.MathUtils.lerp(armRX, -1.75, k);
      elbowL = THREE.MathUtils.lerp(elbowL, 0.9, k);
      elbowR = THREE.MathUtils.lerp(elbowR, 0.9, k);
      armLZ = THREE.MathUtils.lerp(armLZ, 0.25, k);
      armRZ = THREE.MathUtils.lerp(armRZ, -0.25, k);
    }

    const brace = this.brace;
    if (brace > 0.02 && !a) {
      armLX = THREE.MathUtils.lerp(armLX, -2.7, brace);
      armLZ = THREE.MathUtils.lerp(armLZ, -0.9, brace);
      bodyX += 0.22 * brace;
    }

    const sit = this.sit;
    const kneel = this.kneel.step(this.kneeling, 0.55, dt) * (1 - sit);
    const leanNow = this.leanNow.step(this.lean, 0.4, dt);
    const tiltNow = this.tiltNow.step(this.tilt, 0.4, dt);
    r.root.position.copy(this.position);
    r.root.position.y += lift - crouch - sit * 0.5 - kneel * 0.56 + this.hop;
    r.root.rotation.set(this.riding ? this.ridePitch : 0, this.yaw, this.riding ? this.rideRoll : 0);
    /**
     * The coat is a rigid bell, so bending over something is not a rotation. Most of a lean is the whole body carried
     * forward and settled down over the knees, with the bell squashing as the weight comes onto it, and only a little
     * of it is the bell tipping. Any more than this and the hem planks over and the child reads as falling.
     */
    const bend = leanNow;
    r.body.position.set(0, 0.62 + this.bob + Math.sin(t * 2.2) * 0.008 - bend * 0.16 - kneel * 0.04, bend * 0.34);
    r.body.rotation.set(bodyX * (1 - sit) - sit * 0.1 + kneel * 0.1 + bend * 0.45, bodyY, 0);
    r.body.scale.set(1 + bend * 0.07, 1 + Math.sin(t * 2.2) * 0.012 - bend * 0.09, 1 + bend * 0.05);
    /** Kneeling, the shins go back under the coat and the hem settles on the ground round them. */
    r.legL.rotation.set(swing * legAmp * (1 - sit) * (1 - kneel) - sit * 1.45 + kneel * 1.22, 0, -0.05 - sit * 0.15);
    r.legR.rotation.set(-swing * legAmp * (1 - sit) * (1 - kneel) - sit * 1.45 + kneel * 1.22, 0, 0.05 + sit * 0.15);
    if (boardingStep > 0) {
      /** The near knee clears first; the other leg stays long for the last push off the sand. */
      const near = boardingSide < 0 ? r.legL : r.legR;
      const far = boardingSide < 0 ? r.legR : r.legL;
      near.rotation.x -= boardingStep * 1.05;
      far.rotation.x += boardingStep * 0.28;
    }
    const armsFree = a || this.presenting > 0.01 ? 0 : 1;
    r.armL.rotation.set(armLX * (1 - sit * armsFree) - sit * 0.3 * armsFree, 0, armLZ);
    r.armR.rotation.set(armRX * (1 - sit * armsFree) - sit * 0.5 * armsFree, 0, armRZ);
    if (this.swing > 0.01) {
      /** Hands on the ropes, and the legs going: the joy is in the body, because there is never a sound. */
      const k = this.kick * this.swing;
      r.legL.rotation.x -= k * 0.95;
      r.legR.rotation.x -= k * 0.95;
      r.body.rotation.x -= k * 0.4;
      r.armL.rotation.set(-1.35 * this.swing, 0, -0.3 * this.swing);
      r.armR.rotation.set(-1.35 * this.swing, 0, 0.3 * this.swing);
    }
    r.foreL.rotation.set(-elbowL, 0, 0);
    r.foreR.rotation.set(-elbowR, 0, 0);
    if (this.carryingPlane && !a && this.presenting < 0.01 && this.swing < 0.01) {
      /** A quiet carry at the hip: running must not swing the wing back through the coat. Companion IK still wins. */
      r.armR.rotation.set(-0.2 + swing * moving * 0.12, 0, 0.65);
      r.foreR.rotation.set(-0.4, 0, 0);
    }

    let wantYaw = Math.sin(t * 0.37) * 0.35;
    let wantPitch = Math.sin(t * 0.23) * 0.08;
    if (this.lookAt) {
      r.root.updateMatrixWorld(true);
      const head = r.head.getWorldPosition(this.tmp);
      const dx = this.lookAt.x - head.x;
      const dy = this.lookAt.y - head.y;
      const dz = this.lookAt.z - head.z;
      const yawTo = Math.atan2(dx, dz) - this.yaw;
      wantYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(yawTo), Math.cos(yawTo)), -1.1, 1.1);
      /** Looking down at something at their own feet takes a real chin-down, not a glance. */
      /** Looking down at something at their own feet takes a real chin-down; past this the hood swallows the face. */
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.9, 0.52);
    }
    this.headYaw = damp(this.headYaw, wantYaw, 5, dt || 1);
    this.headPitch = damp(this.headPitch, wantPitch, 5, dt || 1);
    r.head.rotation.set(this.headPitch, this.headYaw, Math.sin(t * 0.6) * 0.05 + tiltNow);
    r.eyes.scale.set(1, this.blink > 0 ? 0.15 : 1, 1);
    const abed = this.abedGlide.step(this.abed, 0.8, dt || 1);
    if (abed > 0.001) this.layDown(abed, t, dt || 1);
    r.root.updateMatrixWorld(true);
    for (const hand of [0, 1] as const) {
      this.reachNow[hand] = THREE.MathUtils.clamp(this.reachGlide[hand].step(this.reachWant[hand], 0.45, dt), 0, 1);
      if (this.reachNow[hand] > 0.001) this.solveArm(hand);
    }
    r.root.updateMatrixWorld(true);
  }

  /**
   * Asleep. The coat cannot bend, so nothing here tries to make it: the whole child is tipped onto their back,
   * rolled onto one side, propped so the head lands on the pillow, and flattened into the mattress until what is
   * left above the blanket is a low mound and a face in a hood. The arms stay round what they are holding.
   */
  private layDown(w: number, t: number, dt: number): void {
    const r = this.rig;
    const s = tuning.sleeping;
    const side = this.sideGlide.step(this.abedSide, 0.9, dt);
    this.lie
      .setFromAxisAngle(this.axisY, this.bedYaw)
      .multiply(this.spin.setFromAxisAngle(this.axisX, -Math.PI / 2 + s.lieTip))
      .multiply(this.spin.setFromAxisAngle(this.axisY, side * s.lieSide));
    r.root.quaternion.slerp(this.lie, w);
    r.root.position.lerp(this.bedAt, w);
    /** Breathing, which is the whole point of the beat: the scarf hangs off the neck and rises and falls with it. */
    const breath = Math.sin(t * 0.75) * 0.045 * w;
    r.body.position.set(0, THREE.MathUtils.lerp(r.body.position.y, 0.62 + breath, w), THREE.MathUtils.lerp(r.body.position.z, 0, w));
    r.body.rotation.x = THREE.MathUtils.lerp(r.body.rotation.x, 0.06, w);
    r.body.rotation.z = THREE.MathUtils.lerp(r.body.rotation.z, 0, w);
    /** Only the bell is flattened: the head, the hood and the mittens on top of the blanket keep their size. */
    r.coat.scale.set(THREE.MathUtils.lerp(1, s.lieSquash * (1 + breath * 0.8), w), 1, THREE.MathUtils.lerp(1, s.lieDeep, w));
    /** Knees drawn up under the blanket, and the arms round the plane, drawn in tighter every time they are woken. */
    const curl = w * 0.9;
    r.legL.rotation.set(THREE.MathUtils.lerp(r.legL.rotation.x, 1.15, curl), 0, -0.12);
    r.legR.rotation.set(THREE.MathUtils.lerp(r.legR.rotation.x, 1.0, curl), 0, 0.12);
    /** Both arms round what they are holding, drawn in under the chin, and tighter every time they are woken. */
    const hug = w * (1 + this.tighter * 0.3);
    r.armL.rotation.set(THREE.MathUtils.lerp(r.armL.rotation.x, -2.0, w), 0, THREE.MathUtils.lerp(r.armL.rotation.z, 0.35 + this.tighter * 0.2, w));
    r.armR.rotation.set(THREE.MathUtils.lerp(r.armR.rotation.x, -2.0, w), 0, THREE.MathUtils.lerp(r.armR.rotation.z, -0.35 - this.tighter * 0.2, w));
    r.foreL.rotation.x = THREE.MathUtils.lerp(r.foreL.rotation.x, -(1.75 + this.tighter * 0.35), hug);
    r.foreR.rotation.x = THREE.MathUtils.lerp(r.foreR.rotation.x, -(1.75 + this.tighter * 0.35), hug);
    /** Chin down toward the plane against their chest, the way a child actually sleeps holding something. */
    r.head.rotation.x = THREE.MathUtils.lerp(r.head.rotation.x, 0.3, w);
    r.head.rotation.y = THREE.MathUtils.lerp(r.head.rotation.y, -0.2 * side, w);
    const shut = this.shutGlide.step(this.eyesShut, 0.5, dt);
    if (shut > 0.5) r.eyes.scale.set(1, 0.15, 1);
  }

  /**
   * Two-bone reach, in the body's own frame. The elbow goes out and back and a little down, where a child's elbow
   * goes; a point too far away is reached toward at full stretch rather than refused.
   */
  private solveArm(hand: 0 | 1): void {
    const r = this.rig;
    const k = this.ik;
    const upper = hand === 0 ? r.armR : r.armL;
    const fore = hand === 0 ? r.foreR : r.foreL;
    const side = hand === 0 ? 1 : -1;
    const target = (this.reachInBody[hand] ? k.target.copy(this.reachAt[hand]) : r.body.worldToLocal(k.target.copy(this.reachAt[hand]))).sub(upper.position);
    const a = UPPER_ARM;
    const b = FOREARM;
    const span = THREE.MathUtils.clamp(target.length(), Math.abs(a - b) + 0.02, a + b - 0.004);
    k.dir.copy(target).normalize();
    const along = (a * a - b * b + span * span) / (2 * span);
    const out = Math.sqrt(Math.max(0, a * a - along * along));
    k.pole.set(side * 0.75, -0.45, -0.5);
    k.pole.addScaledVector(k.dir, -k.pole.dot(k.dir)).normalize();
    k.elbow.copy(k.dir).multiplyScalar(along).addScaledVector(k.pole, out);
    k.u.copy(k.elbow).normalize();
    k.f.copy(k.dir).multiplyScalar(span).sub(k.elbow).normalize();
    k.upper.setFromUnitVectors(k.down, k.u);
    k.bend.setFromUnitVectors(k.u, k.f);
    k.fore.copy(k.upper).invert().multiply(k.bend).multiply(k.upper);
    const w = this.reachNow[hand];
    upper.quaternion.slerp(k.upper, w);
    fore.quaternion.slerp(k.fore, w);
  }
}

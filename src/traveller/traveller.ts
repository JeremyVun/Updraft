import * as THREE from 'three';
import type { WindField, WindSample } from '../wind/field';
import { tuning } from '../tuning';
import { fieldAt, type FieldSample } from '../world/fields';
import { heightAt } from '../world/island';
import { POND, POND_LEVEL, pondOut } from '../world/heightfield';
import { ROCKS, TREE } from '../world/landmarks';
import { buildChild, keepOffChild, type Rig, type SocketName } from './body';
import { ChildMotion, newPose, stepLength, type ArmPose, type Drive } from './child/motion';
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
    }
  | {
      kind: 'alight'; t: number; boat: Boat; to: THREE.Vector3; rail: THREE.Vector3;
      fromYaw: number; toYaw: number; side: number; shoved: boolean; hop: number; onDone: () => void;
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
  /** Optional shallow landing at the shore end; never permits stepping off the sides into deep water. */
  stepOffDepth?: number;
  /** A ramp this long runs on from one end of the deck down to the ground. */
  rampAt?: 'start' | 'end';
  rampLength?: number;
}

/** The height of a deck's ramp under (x, z), or null off it. */
function rampHeight(d: Deck, x: number, z: number): number | null {
  if (!d.rampAt || !d.rampLength) return null;
  const dx = d.x1 - d.x0, dz = d.z1 - d.z0, len = Math.hypot(dx, dz);
  const along = ((x - d.x0) * dx + (z - d.z0) * dz) / len;
  const beyond = d.rampAt === 'end' ? along - len : -along;
  if (beyond < 0 || beyond > d.rampLength) return null;
  if (Math.abs((x - d.x0) * dz - (z - d.z0) * dx) / len > d.halfWidth) return null;
  return THREE.MathUtils.lerp(d.height, heightAt(x, z), beyond / d.rampLength);
}
const WALK = 2.6;
const RUN = 5.4;
const TURN_RATE = 7;
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
  /** Story-authored drowsiness and silent yawns; both zero outside the bedtime passage. */
  sleepiness = 0;
  yawn = 0;
  private readonly rig: Rig;
  private readonly motion: ChildMotion;
  private readonly look = newPose();
  private readonly drive: Drive = {
    dt: 0, time: 0, speed: 0, gait: 0, ground: (x, z) => this.floorAt(x, z), windX: 0, windZ: 0, gust: 0,
    velocity: new THREE.Vector3(), turn: 0,
  };
  private lastYaw = 0;
  private turnRate = 0;
  private breathT = 0;
  private goal: Goal | null = null;
  private action: Action | null = null;
  private speed = 0;
  private gait = 0;
  private sit = 1;
  private brace = 0;
  private blink = 0;
  private nextBlink = 2;
  private headYaw = 0;
  private headPitch = 0;
  private readonly kneel = new Glide();
  private readonly abedGlide = new Glide();
  private readonly sideGlide = new Glide();
  private readonly shutGlide = new Glide();
  private readonly yawnGlide = new Glide();
  private readonly hipFrom = new THREE.Vector3();
  private readonly hipTo = new THREE.Vector3();
  private readonly hipPivot = new THREE.Vector3(0, 0.62 * 1.12, 0);
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
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly field: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 };
  /** Height of the clamber over a stone wall, 0 on open ground. */
  private hop = 0;
  private readonly prev = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly shadowMat: THREE.ShaderMaterial;
  private time = 0;
  private readonly bodyInverse = new THREE.Matrix4();
  private readonly keepOffChild = (p: THREE.Vector3) => {
    keepOffChild(p.applyMatrix4(this.bodyInverse));
    p.applyMatrix4(this.rig.body.matrixWorld);
  };

  constructor(private readonly wind: WindField) {
    this.rig = buildChild();
    this.motion = new ChildMotion(this.rig);
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
   * The middle of the sheet at reading height, with its near edge within reach of the hands.
   */
  presentPoint(out: THREE.Vector3): THREE.Vector3 {
    const hold = tuning.homeReveal;
    const up = hold.paperHeight - (this.sitting ? 0.52 : 0);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    return out.set(this.position.x + fx * hold.paperForward - fz * hold.paperSide, this.position.y + up,
      this.position.z + fz * hold.paperForward + fx * hold.paperSide);
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
    return this.rig.face.getWorldPosition(out);
  }

  /** The mouth, rather than the centre of the head, for visible breath in cold air. */
  breathFrom(out: THREE.Vector3): THREE.Vector3 {
    return this.rig.face.localToWorld(out.set(0, -0.15, 0.23));
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
    return (hand === 0 ? this.rig.gripL : this.rig.gripR).getWorldPosition(out);
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

  /** Alternating contacts from the distance-driven walking pose; riding does not advance it. */
  get footContact(): number { return Math.floor(this.gait / Math.PI + 0.05); }

  /** Both hands belong to the cygnet; the plane's keel goes under the satchel's outer flap. */
  armsFull = false;
  /** Keeps the free mitten outside the bell of the coat while it grips the paper. */
  carryingPlane = false;
  private stowed = 0;
  private planeStowRequested = false;

  /** Keep the paper on the backpack while a chapter uses the child's free hands. */
  stowPlane(on: boolean, immediate = false): void {
    this.planeStowRequested = on;
    if (immediate) this.stowed = on ? 1 : 0;
  }
  private readonly paperLocal = new THREE.Quaternion();
  private readonly paperStowed = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -0.18, 'ZYX'));
  private readonly paperHand = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0, -Math.PI / 2, 'YXZ'));

  /** The paper's grip, either in the mitten or against the outside of the bag. */
  handPosition(out: THREE.Vector3): THREE.Vector3 {
    this.rig.root.updateMatrixWorld(true);
    this.rig.gripL.getWorldPosition(out);
    if (this.stowed < 0.001) return out;
    const tucked = this.rig.body.localToWorld(this.tmp2.set(0.06, 0.62, -0.86));
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
    for (const d of this.decks) {
      const ramp = rampHeight(d, x, z);
      if (ramp !== null) return Math.max(ramp, heightAt(x, z));
    }
    return heightAt(x, z);
  }

  place(x: number, z: number, yaw: number): void {
    if (this.action?.kind === 'alight') {
      this.action = null;
      this.riding = false;
    }
    this.position.set(x, Math.max(this.ground(x, z), 0), z);
    this.yaw = yaw;
    this.pose(0);
    this.rig.root.updateMatrixWorld(true);
    this.scarf.reset(this.rig.knot.getWorldPosition(this.tmp), this.rig.body.matrixWorld);
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

  /** Follow a moving subject without discarding an obstacle detour or the stuck-walk watchdog. */
  retargetWalk(x: number, z: number): void {
    const g = this.goal;
    if (!g) return;
    g.best += Math.hypot(x - this.position.x, z - this.position.z)
      - Math.hypot(g.x - this.position.x, g.z - this.position.z);
    g.x = x;
    g.z = z;
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

  /**
   * Out of the boat onto a deck alongside: up off the thwart and round to face it, a foot up onto the boards, the
   * weight carried across over the gunwale as the other leg swings through, and a settle; then the story has the
   * child back.
   */
  alight(boat: Boat, deck: Deck, onDone: () => void): void {
    const k = tuning.boarding;
    this.goal = null;
    boat.group.updateMatrixWorld(true);
    const near = (side: number, out: THREE.Vector3) => out.set(side * k.gunwaleIn, k.gunwaleHeight, -0.25).applyMatrix4(boat.group.matrixWorld);
    const dx = deck.x1 - deck.x0, dz = deck.z1 - deck.z0, len = Math.hypot(dx, dz);
    const offDeck = (p: THREE.Vector3) => {
      const t = THREE.MathUtils.clamp(((p.x - deck.x0) * dx + (p.z - deck.z0) * dz) / (len * len), 0, 1);
      return Math.hypot(p.x - (deck.x0 + dx * t), p.z - (deck.z0 + dz * t));
    };
    const side = offDeck(near(1, this.tmp)) <= offDeck(near(-1, this.tmp2)) ? 1 : -1;
    const rail = near(side, new THREE.Vector3());
    const along = THREE.MathUtils.clamp(((rail.x - deck.x0) * dx + (rail.z - deck.z0) * dz) / (len * len),
      k.alightEnd / len, 1 - k.alightEnd / len);
    const room = Math.max(0, deck.halfWidth - k.alightEdge);
    const across = THREE.MathUtils.clamp(((rail.x - deck.x0) * dz - (rail.z - deck.z0) * dx) / len, -room, room);
    const to = new THREE.Vector3(deck.x0 + dx * along + dz / len * across, 0, deck.z0 + dz * along - dx / len * across);
    to.y = Math.max(deck.height, heightAt(to.x, to.z));
    const stand = this.tmp.set(side * k.alightInside, k.alightFloor, -0.25).applyMatrix4(boat.group.matrixWorld);
    this.action = {
      kind: 'alight', t: 0, boat, to, rail, fromYaw: this.yaw,
      toYaw: Math.atan2(to.x - stand.x, to.z - stand.z), side, shoved: false,
      hop: THREE.MathUtils.smoothstep(Math.hypot(to.x - stand.x, to.z - stand.z), k.alightStride, k.alightStride + k.alightHopOver),
      onDone,
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
    const keepStowed = this.planeStowRequested || this.armsFull || this.riding || (this.stowed > 0.5 && this.reachNow[0] > 0.1 && this.presenting < 0.01);
    this.stowed = damp(this.stowed, keepStowed ? 1 : 0, tuning.paperCarry.transferRate, dt);
    this.pose(dt);

    const moved = Math.hypot(p.x - this.prev.x, p.z - this.prev.z);
    if (moved > 0.6 * dt && !this.sitting && !this.riding) {
      this.wind.addSplat({ source: this, trail: true,
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

    const neck = this.rig.knot.getWorldPosition(this.tmp);
    this.bodyInverse.copy(this.rig.body.matrixWorld).invert();
    const onBed = THREE.MathUtils.smoothstep(this.abed, 0.2, 0.8);
    const floor = this.riding ? p.y - 0.2 : Math.max(this.ground(p.x, p.z), 0);
    const mattress = this.bedAt.y - tuning.sleeping.lieHigh + 0.68;
    this.scarf.update(dt, neck, this.rig.body.matrixWorld, this.keepOffChild, w, THREE.MathUtils.lerp(floor, mattress, onBed), p);
    this.rig.material.uniforms.uGroundPos.value.copy(p);
    this.motion.hoodForward(this.rig.material.uniforms.uHoodForward.value);

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
        this.yaw += Math.sign(dy) * Math.min(Math.abs(dy), dt * TURN_RATE);
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
    const deckLanding=this.decks.some(d=>d.stepOffDepth!==undefined && nextH>=d.stepOffDepth &&
      Math.hypot(nx-d.x1,nz-d.z1)<d.halfWidth);
    const here = this.ground(p.x, p.z);
    // Down a ramp, and off its foot, but never off its sides.
    const downRamp = this.decks.some((d) => rampHeight(d, nx, nz) !== null
      || (rampHeight(d, p.x, p.z) !== null && nextH > here - 0.08));
    if (nextH < shore && nextH < here && !deckLanding && !downRamp) {
      this.speed = 0;
      if (this.goal) {
        const arrive = this.goal.onArrive;
        this.goal = null;
        arrive?.();
      }
      return;
    }
    this.gait += (step / stepLength(this.speed)) * Math.PI;
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
    } else if (a.kind === 'alight') {
      const k = tuning.boarding;
      const boat = a.boat;
      boat.group.updateMatrixWorld(true);
      const stand = this.tmp2.set(a.side * k.alightInside, k.alightFloor, -0.25).applyMatrix4(boat.group.matrixWorld);
      if (a.t < k.alightStand) {
        const u = THREE.MathUtils.smootherstep(a.t, 0, k.alightStand);
        this.position.set(0, 0.02, -0.25).applyMatrix4(boat.group.matrixWorld).lerp(stand, u);
      } else {
        // The lead foot goes up onto the boards while the weight stays in the boat, then the body follows it over.
        const lean = THREE.MathUtils.smootherstep(a.t, k.alightStand, k.alightLift) * k.alightLean;
        const u = THREE.MathUtils.smootherstep(a.t, k.alightLift, k.alightAcross);
        const along = lean + (1 - lean) * u;
        this.position.lerpVectors(stand, a.to, along);
        const rise = THREE.MathUtils.smoothstep(u, 0, 0.75);
        const middle = THREE.MathUtils.lerp(stand.y, a.to.y, 0.5);
        this.position.y = THREE.MathUtils.lerp(stand.y, a.to.y, rise)
          + (Math.max(0, a.rail.y + k.alightClear - middle) + a.hop * k.alightHop) * Math.sin(u * Math.PI);
        if (!a.shoved && a.t >= k.alightLift) {
          a.shoved = true;
          boat.nudge(-a.side, k.alightShove);
        }
      }
      const turn = Math.atan2(Math.sin(a.toYaw - a.fromYaw), Math.cos(a.toYaw - a.fromYaw));
      this.yaw = a.fromYaw + turn * THREE.MathUtils.smootherstep(a.t, 0, k.alightStand * 1.2);
      this.riding = a.t < k.alightLift;
      this.sitting = false;
      this.rideRoll = this.riding ? boat.roll * 0.55 : 0;
      this.ridePitch = this.riding ? boat.pitch * 0.55 : 0;
      if (a.t >= k.alightSettle) {
        this.action = null;
        this.position.copy(a.to);
        a.onDone();
      }
    }
  }

  /** The floor under a foot: the ground, a deck, or the boards of the boat they are riding in. */
  private floorAt(x: number, z: number): number {
    const ground = Math.max(this.ground(x, z), 0);
    if (!this.riding) return ground;
    return Math.max(this.ground(x, z), this.position.y - 0.26 * this.sit);
  }

  private pose(dt: number): void {
    const r = this.rig;
    const t = this.time;
    const P = this.look;
    const h = dt || 1;
    this.sit = damp(this.sit, this.sitting ? 1 : 0, 4, h);
    const moving = Math.min(1, this.speed / WALK);
    const running = THREE.MathUtils.clamp((this.speed - WALK) / (RUN - WALK), 0, 1);
    const [L, R] = P.arms;
    const lerp = THREE.MathUtils.lerp;
    const smooth = THREE.MathUtils.smoothstep;
    /** Arms swing against the legs, a beat behind them, bent and pumping when they run. */
    const pace = 0.52 * moving + 0.4 * running;
    const armSwing = Math.cos(this.gait - 0.35);
    arm(L, -pace * armSwing + 0.04, 0.3 + 0.08 * running, 0, 0.3 + 0.9 * running + Math.max(0, -armSwing) * 0.45 * moving, 0.12);
    arm(R, pace * armSwing + 0.04, 0.3 + 0.08 * running, 0, 0.3 + 0.9 * running + Math.max(0, armSwing) * 0.45 * moving, 0.12);
    let lean = 0;
    let twist = 0;
    let rise = 0;
    let crouch = 0;
    let bend = 0;
    let headDown = 0;
    P.step[0] = P.step[1] = 0;

    const a = this.action;
    if (a?.kind === 'throw') {
      /** Up and back with the paper beside the hood, the body winding with it; then the arm goes through. */
      const wind = smooth(a.t, 0, 0.55);
      const fling = smooth(a.t, 0.52, 0.72);
      const settle = smooth(a.t, 0.78, 1.1);
      const k = 1 - settle;
      const cock = wind * (1 - fling);
      /** Cocked out beside the hood with the paper behind it, never across the face; then long and low through. */
      L.raise = lerp(L.raise, 2.75 * cock + 1.15 * fling, k);
      L.out = lerp(L.out, 0.95 * cock + 0.25 * fling, k);
      L.elbow = lerp(L.elbow, 1.45 * cock + 0.12 * fling, k);
      L.twist = (0.3 * cock + 0.1 * fling) * k;
      L.wrist = 0.5 * cock * k;
      R.raise = lerp(R.raise, 1.0 * cock + 0.35 * fling, k);
      R.out = lerp(R.out, 0.35, k);
      R.elbow = lerp(R.elbow, 0.7 * cock + 0.3, k);
      twist = (-0.5 * cock + 0.45 * fling) * k;
      lean = (-0.14 * cock + 0.32 * fling) * k;
      P.step[1] = -0.25 * cock * k + 0.15 * fling * k;
    } else if (a?.kind === 'pickup') {
      const down = Math.sin(Math.min(1, a.t / 0.9) * Math.PI);
      bend = 0.9 * down;
      crouch = 0.3 * down;
      L.raise = lerp(L.raise, 1.1, down);
      R.raise = lerp(R.raise, 0.8, down);
      L.elbow = R.elbow = 0.3 + 0.4 * down;
      headDown = 0.35 * down;
    } else if (a?.kind === 'cheer') {
      const up = Math.sin(Math.min(1, a.t / 1.3) * Math.PI);
      const arms = Math.min(1, up * 1.8);
      /** A wide V, up past the hood: the whole of them in it. */
      for (const m of [L, R]) {
        m.raise = lerp(m.raise, 2.75, arms);
        m.out = lerp(m.out, 1.0, up);
        m.elbow = lerp(m.elbow, 0.18, arms);
        m.wrist = -0.3 * arms;
      }
      rise = Math.max(0, Math.sin(a.t * 7.5)) * 0.46 * up;
      twist = Math.sin(a.t * 5.2) * 0.3 * up;
      lean = -0.25 * up;
      P.step[0] = P.step[1] = 0.55 * smooth(rise, 0.02, 0.2);
    } else if (a?.kind === 'wave') {
      const up = Math.min(1, a.t * 4) * Math.min(1, (1.8 - a.t) * 4);
      /** Out to the side at the height of the hood, the forearm up and the mitten going. */
      L.raise = lerp(L.raise, 1.55, up);
      L.out = lerp(L.out, 1.2 + Math.sin(a.t * 10) * 0.12, up);
      L.elbow = lerp(L.elbow, 1.15 + 0.35 * Math.sin(a.t * 10 + 0.8), up);
      L.twist = 0.9 * up;
      L.wrist = 0.4 * Math.sin(a.t * 10 - 0.6) * up;
      twist = 0.08 * up;
    } else if (a?.kind === 'reach') {
      /** Straight out and then slowly down: the arms give up a long time after the rest of them does. */
      const out = Math.min(1, a.t * 5) * (1 - smooth(a.t, 1.6, 4.2));
      for (const m of [L, R]) {
        m.raise = lerp(m.raise, 2.45, out);
        m.out = lerp(m.out, -0.2, out);
        m.elbow = lerp(m.elbow, 0.12, out);
      }
      lean = -0.22 * out;
      rise = 0.05 * out;
    } else if (a?.kind === 'push') {
      const k = Math.min(1, a.t * 2) * Math.min(1, (2.4 - a.t) * 2);
      bend = 0.35 * k;
      lean = 0.35 * k;
      for (const m of [L, R]) {
        m.raise = lerp(m.raise, 1.45, k);
        m.elbow = lerp(m.elbow, 0.45, k);
        m.out = lerp(m.out, 0.1, k);
      }
      crouch = 0.1 * k;
      P.step[1] = -0.35 * k;
    } else if (a?.kind === 'board') {
      const k = tuning.boarding;
      const press = smooth(a.t, 0, k.push) * (1 - smooth(a.t, k.push, k.rail));
      const climb = THREE.MathUtils.smootherstep(a.t, k.push * 0.78, k.inside);
      const settle = THREE.MathUtils.smootherstep(a.t, k.inside, k.settle);
      lean = 0.5 * press + 0.22 * climb * (1 - settle);
      bend = 0.25 * press;
      twist = a.side * Math.sin(climb * Math.PI) * 0.24;
      crouch = 0.12 * press + Math.sin(climb * Math.PI) * 0.08;
      R.raise = lerp(1.35, 0.45, climb);
      L.raise = lerp(1.35, 0.55, climb);
      R.elbow = L.elbow = 0.45;
      /** The near knee clears first; the other leg stays long for the last push off the sand. */
      const step = Math.sin(smooth(a.t, k.push * 0.82, k.inside) * Math.PI);
      P.step[a.side < 0 ? 1 : 0] = 1.05 * step;
      P.step[a.side < 0 ? 0 : 1] = -0.28 * step;
    } else if (a?.kind === 'alight') {
      const k = tuning.boarding;
      const up = THREE.MathUtils.smootherstep(a.t, k.alightStand * 0.7, k.alightLift);
      const u = THREE.MathUtils.smootherstep(a.t, k.alightLift, k.alightAcross);
      const settle = Math.sin(smooth(a.t, k.alightAcross - 0.1, k.alightSettle) * Math.PI);
      const reach = smooth(a.t, k.alightStand * 0.4, k.alightLift) * (1 - smooth(a.t, k.alightAcross, k.alightSettle));
      /** The lead leg lifts onto the boards and straightens under the weight; the other pushes off and swings through. */
      P.step[0] = k.alightStep * up * (1 - u) + a.hop * 0.35 * Math.sin(u * Math.PI);
      P.step[1] = -0.35 * Math.sin(Math.min(1, u * 2.2) * Math.PI * 0.5) * (1 - u)
        + 0.55 * Math.sin(u * Math.PI) * smooth(u, 0.25, 0.6) + a.hop * 0.3 * Math.sin(u * Math.PI);
      lean = 0.28 * up * (1 - u) + 0.12 * Math.sin(u * Math.PI);
      crouch = 0.05 * up * (1 - u) + (0.09 + 0.06 * a.hop) * settle;
      for (const m of [L, R]) {
        m.raise = lerp(m.raise, 0.75, reach);
        m.out = lerp(m.out, 0.62, reach);
      }
    }

    if (this.presenting > 0.01) {
      const k = this.presenting;
      for (const m of [L, R]) {
        m.raise = lerp(m.raise, 1.75, k);
        m.elbow = lerp(m.elbow, 0.9, k);
        m.out = lerp(m.out, -0.25, k);
      }
    }

    const brace = this.brace;
    if (brace > 0.02 && !a) {
      /** Into a strong wind: an arm up across the face, leaning into it, chin down. */
      R.raise = lerp(R.raise, 2.2, brace);
      R.out = lerp(R.out, 0.9, brace);
      R.elbow = lerp(R.elbow, 1.2, brace);
      lean += 0.22 * brace;
      headDown += 0.15 * brace;
    }

    const sit = this.sit;
    const kneel = this.kneel.step(this.kneeling, 0.55, dt) * (1 - sit);
    const leanNow = this.leanNow.step(this.lean, 0.4, dt);
    const tiltNow = this.tiltNow.step(this.tilt, 0.4, dt);
    const armsFree = a || this.presenting > 0.01 ? 0 : 1;
    /** Seated, idle hands come to rest on the lap. */
    const rest = sit * armsFree;
    L.raise = lerp(L.raise, 0.55, rest);
    R.raise = lerp(R.raise, 0.5, rest);
    L.elbow = lerp(L.elbow, 0.85, rest);
    R.elbow = lerp(R.elbow, 0.85, rest);
    L.out = lerp(L.out, 0.22, rest);
    R.out = lerp(R.out, 0.22, rest);
    lean += -0.06 * sit + 0.1 * kneel;
    bend += leanNow;

    if (this.swing > 0.01) {
      /** Hands on the ropes, and the legs going: the joy is in the body, because there is never a sound. */
      const k = this.kick * this.swing;
      lean -= k * 0.3;
      for (const m of [L, R]) {
        m.raise = lerp(m.raise, 1.35, this.swing);
        m.out = lerp(m.out, 0.3, this.swing);
        m.elbow = lerp(m.elbow, 0.65, this.swing);
      }
    }
    if (this.carryingPlane && !a && this.presenting < 0.01 && this.swing < 0.01) {
      /** A quiet carry at the hip: running must not swing the wing back through the coat. Companion IK still wins. */
      L.raise = 0.2 - armSwing * moving * 0.12;
      L.out = 0.58;
      L.elbow = 0.45;
      L.twist = 0;
    }

    /** Idle, the gaze wanders; on the move it settles on the way ahead. */
    const settle = 1 - 0.75 * moving;
    let wantYaw = Math.sin(t * 0.37) * 0.35 * settle;
    let wantPitch = Math.sin(t * 0.23) * 0.08 * settle + 0.06 * running;
    if (this.lookAt) {
      r.root.updateMatrixWorld(true);
      const head = r.face.getWorldPosition(this.tmp);
      const dx = this.lookAt.x - head.x;
      const dy = this.lookAt.y - head.y;
      const dz = this.lookAt.z - head.z;
      const yawTo = Math.atan2(dx, dz) - this.yaw;
      wantYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(yawTo), Math.cos(yawTo)), -1.1, 1.1);
      /** Looking down at something at their own feet takes a real chin-down; past this the hood swallows the face. */
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.9, 0.52);
    }
    this.headYaw = damp(this.headYaw, wantYaw, 5, h);
    this.headPitch = damp(this.headPitch, wantPitch, 5, h);
    const abed = this.abedGlide.step(this.abed, 0.8, h);
    const yawn = this.yawnGlide.step(this.yawn, 0.35, h);
    const shut = this.shutGlide.step(Math.max(this.eyesShut, yawn * 0.9), 0.4, h);
    P.headYaw = this.headYaw;
    P.headPitch = this.headPitch + headDown + this.sleepiness * 0.24 * (1 - abed) - yawn * 0.2;
    P.headRoll = Math.sin(t * 0.6) * 0.05 + tiltNow;
    lean += this.sleepiness * 0.07 * (1 - abed);
    this.breathT += h * lerp(2.2, 0.75, abed);
    P.breath = Math.sin(this.breathT) * (1 + yawn * 2 + abed * 2.5);

    P.lean = lean;
    P.twist = twist;
    P.tilt = 0;
    P.bend = bend;
    P.rise = rise;
    P.sit = sit;
    P.kneel = kneel;
    P.swing = this.swing;
    P.kick = this.kick;
    P.lie = 0;

    r.root.position.copy(this.position);
    r.root.position.y += rise - crouch - sit * SIT_DROP - kneel * KNEEL_DROP + this.hop;
    r.root.rotation.set(this.riding ? this.ridePitch : 0, this.yaw, this.riding ? this.rideRoll : 0);
    if (abed > 0.001) this.layDown(abed);

    const d = this.drive;
    d.dt = h;
    d.time = t;
    d.speed = this.speed;
    d.gait = this.gait;
    d.windX = this.sample.x;
    d.windZ = this.sample.z;
    d.gust = this.sample.energy;
    d.velocity.set((this.position.x - this.prev.x) / h, 0, (this.position.z - this.prev.z) / h);
    const turn = Math.atan2(Math.sin(this.yaw - this.lastYaw), Math.cos(this.yaw - this.lastYaw)) / h;
    this.lastYaw = this.yaw;
    this.turnRate = damp(this.turnRate, THREE.MathUtils.clamp(turn, -TURN_RATE, TURN_RATE), 8, h);
    d.turn = this.turnRate;
    this.motion.update(P, d);
    r.material.uniforms.uFlutter.value = this.motion.flutter;
    r.material.uniforms.uFlow.value.copy(this.motion.flow);

    // A hand covers the yawn once the bird is safely on the blanket. Contact IK still has the final say.
    if (!this.armsFull && abed < 0.2 && yawn > 0.01) {
      this.breathFrom(this.tmp);
      r.face.getWorldDirection(this.tmp2);
      this.motion.reach(true, this.tmp.addScaledVector(this.tmp2, 0.12), yawn);
    }
    r.root.updateMatrixWorld(true);
    for (const hand of [0, 1] as const) {
      this.reachNow[hand] = THREE.MathUtils.clamp(this.reachGlide[hand].step(this.reachWant[hand], 0.45, dt), 0, 1);
      if (this.reachNow[hand] <= 0.001) continue;
      const target = this.reachInBody[hand] ? r.body.localToWorld(this.tmp.copy(this.reachAt[hand])) : this.tmp.copy(this.reachAt[hand]);
      this.motion.reach(hand === 0, target, this.reachNow[hand]);
    }
    r.root.updateMatrixWorld(true);
    const u = r.material.uniforms;
    u.uBlink.value = Math.max(this.blink > 0 ? 1 : 0, shut);
    u.uYawn.value = yawn;
  }

  /**
   * Asleep: the whole child is tipped onto their back, rolled onto one side and propped so the head lands on the
   * pillow, reclining around the hips so the seat stays supported. The arms stay round what they are holding.
   */
  private layDown(w: number): void {
    const r = this.rig;
    const P = this.look;
    const s = tuning.sleeping;
    const side = this.sideGlide.step(this.abedSide, 0.9, this.drive.dt || 1 / 60);
    this.lie
      .setFromAxisAngle(this.axisY, this.bedYaw)
      .multiply(this.spin.setFromAxisAngle(this.axisX, -Math.PI / 2 + s.lieTip))
      .multiply(this.spin.setFromAxisAngle(this.axisY, (0.8 + side * 0.2) * s.lieSide));
    this.hipFrom.copy(this.hipPivot).applyQuaternion(r.root.quaternion).add(r.root.position);
    this.hipTo.copy(this.hipPivot).applyQuaternion(this.lie).add(this.bedAt);
    r.root.quaternion.slerp(this.lie, w);
    r.root.position.lerpVectors(this.hipFrom, this.hipTo, w)
      .sub(this.tmp.copy(this.hipPivot).applyQuaternion(r.root.quaternion));
    const lerp = THREE.MathUtils.lerp;
    P.lie = w;
    P.sit *= 1 - w;
    P.lean = lerp(P.lean, 0.06, w);
    P.bend *= 1 - w;
    P.twist *= 1 - w;
    /** Both arms round what they are holding, drawn in under the chin, and tighter every time they are woken. */
    for (const m of P.arms) {
      m.raise = lerp(m.raise, 0.7, w);
      m.out = lerp(m.out, -0.1, w);
      m.elbow = lerp(m.elbow, 2.2 + this.tighter * 0.15, w);
      m.twist = lerp(m.twist, 0.3, w);
    }
    /** Chin down toward what they are holding, the way a child actually sleeps. */
    P.headPitch = lerp(P.headPitch, 0.3, w);
    P.headYaw = lerp(P.headYaw, -0.2 * side, w);
  }
}

function arm(m: ArmPose, raise: number, out: number, twist: number, elbow: number, wrist: number): void {
  m.raise = raise;
  m.out = out;
  m.twist = twist;
  m.elbow = elbow;
  m.wrist = wrist;
}

/** How far the root comes down when they sit (on the ground, a thwart, a stool) and when they kneel back on their heels. */
const SIT_DROP = 0.67;
const KNEEL_DROP = 0.54;

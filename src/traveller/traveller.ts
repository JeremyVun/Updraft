import * as THREE from 'three';
import type { WindField, WindSample } from '../wind/field';
import { tuning } from '../tuning';
import { fieldAt, type FieldSample } from '../world/fields';
import { deckGround, offTheEdge, rampHeight, type Deck } from '../world/decks';
import { heightAt } from '../world/island';
import { POND, POND_LEVEL, pondOut } from '../world/heightfield';
import { ROCKS, TREE } from '../world/landmarks';
import { BONE, FOREARM, UPPER_ARM, buildChild, keepOffChild, type Rig, type SocketName } from './body';
import { ChildMotion, newPose, stepLength, type ArmPose, type Drive } from './child/motion';
import { Scarf } from './scarf';
import type { Boat } from './boat';
import { gunwale, gunwaleHalf, stationU } from './boat/form';

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
      fromYaw: number; toYaw: number; side: number; inside: number; shoved: boolean; hop: number; onDone: () => void;
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

export type { Deck } from '../world/decks';
/** Where the paper's grip sits when it is put away: against the bag's outer face, low enough that the bird shows above it. */
export const PAPER_STOW = new THREE.Vector3(0.06, 0.48, -0.69);
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
  snap(value: number): void {
    this.value = value;
    this.velocity = 0;
  }
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
  /** The hull the child was last seated in, with that seat and facing in its frame. */
  private hull: Boat | null = null;
  private readonly hullSeat = new THREE.Vector3();
  private hullTurn = 0;
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
  /** Sat on an edge, how much the hanging feet swing, 0 to 1. */
  dangle = 0;
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
    velocity: new THREE.Vector3(), turn: 0, bagOpen: false,
  };
  private lastYaw = 0;
  private turnRate = 0;
  /**
   * A story that turns them round on the spot all at once is shown as a quick turn with a step or two, not a snap:
   * what is left of the turn eases out, and turns no faster than walking ones pass straight through.
   */
  private readonly yawLag = new Glide();
  private lastSetYaw = 0;
  private breathT = 0;
  private goal: Goal | null = null;
  private action: Action | null = null;
  private speed = 0;
  private gait = 0;
  private sit = 1;
  /** A sit meant to be watched is lowered into over this many seconds, eased; 0 drops into it. */
  private sitOver = 0;
  private sitRamp = 1;
  private dangleT = 0;
  private dangling = 0;
  private brace = 0;
  private blink = 0;
  private nextBlink = 2;
  private headYaw = 0;
  private headPitch = 0;
  private glance = 0;
  private glanceUntil = 0;
  private glanceYaw = 0;
  private glancePitch = 0;
  private glances = 0;
  private gusted = 0;
  private nextGlance = 5;
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
  private readonly upright = new THREE.Quaternion();
  private readonly spin = new THREE.Quaternion();
  private readonly axisX = new THREE.Vector3(1, 0, 0);
  private readonly axisY = new THREE.Vector3(0, 1, 0);
  private readonly leanNow = new Glide();
  private readonly tiltNow = new Glide();
  private readonly reachGlide = [new Glide(), new Glide()];
  /**
   * Where an action puts each mitten this frame: in the body's frame (x as for the left hand, mirrored for the right)
   * or in the world, which way its elbow points, and how much of the arm it takes over.
   */
  private readonly grips = [0, 1].map(() => ({ at: new THREE.Vector3(), elbow: new THREE.Vector3(), w: 0, world: false }));
  /** Where an action wants the head to look, in the body's frame, overriding the gaze by `w`. */
  private readonly gaze = { yaw: 0, pitch: 0, w: 0 };
  private readonly straps = new Glide();
  private readonly lap = new Glide();
  private onGround = 1;
  /** How far the held paper lies in the lap instead of standing in the mitten. */
  private lapPaper = 0;
  private pickupT = Infinity;
  private stooped = 0;
  private readonly pickupAt = new THREE.Vector3();
  private stillFor = 0;
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
  private readonly footLocal = new THREE.Vector3();
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

  /** Throws the bag's flap open for good, the first time the cygnet rides in it; `now` skips the swing over. */
  openBag(now = false): void {
    this.drive.bagOpen = true;
    if (now) this.motion.flapOpened();
  }
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
  private readonly paperLap = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, -0.12, 0.1, 'YXZ'));

  /** The paper's grip, either in the mitten or against the outside of the bag. */
  handPosition(out: THREE.Vector3): THREE.Vector3 {
    this.rig.root.updateMatrixWorld(true);
    this.rig.gripL.getWorldPosition(out);
    if (this.stowed < 0.001) return out;
    const tucked = this.rig.body.localToWorld(this.tmp2.copy(PAPER_STOW));
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
    this.paperLocal.copy(this.paperHand).slerp(this.paperLap, this.lapPaper).slerp(this.paperStowed, this.stowed);
    return this.rig.body.getWorldQuaternion(out).multiply(this.paperLocal);
  }

  /** Decks the child may walk on; anywhere else the ground is the terrain. */
  decks: Deck[] = [];

  /** The terrain under a point, or a deck built over it. */
  private ground(x: number, z: number): number {
    return deckGround(this.decks, x, z, this.position.y);
  }

  place(x: number, z: number, yaw: number): void {
    if (this.action?.kind === 'alight') {
      this.action = null;
      this.riding = false;
    }
    this.position.set(x, Math.max(this.ground(x, z), 0), z);
    this.yaw = yaw;
    this.lastSetYaw = yaw;
    this.yawLag.snap(0);
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

  /**
   * Seated at `at`, facing `yaw`. In a boat, the seat is kept in the hull's frame: the story seats the child before
   * the boat moves, and an uneven frame would otherwise leave her a varying step behind her seat.
   */
  ride(at: THREE.Vector3, yaw: number, boat?: Boat): void {
    this.riding = true;
    this.sitting = true;
    this.goal = null;
    this.position.copy(at);
    this.yaw = yaw;
    this.rideRoll = this.ridePitch = 0;
    this.hull = boat ?? null;
    if (!boat) return;
    boat.group.updateMatrixWorld(true);
    boat.group.worldToLocal(this.hullSeat.copy(at));
    this.hullTurn = yaw - boat.yaw;
    this.keepSeat();
  }

  private keepSeat(): void {
    const boat = this.hull;
    if (!boat || !this.riding) return;
    boat.group.updateMatrixWorld(true);
    this.position.copy(this.hullSeat).applyMatrix4(boat.group.matrixWorld);
    this.yaw = boat.yaw + this.hullTurn;
    /** A rider takes only some of what the hull does: they ride it out nearer upright than the boat lies. */
    this.rideRoll = boat.roll * 0.55;
    this.ridePitch = boat.pitch * 0.55;
  }

  dismount(): void {
    this.hull = null;
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

  sitDown(over = 0): void {
    this.goal = null;
    this.sitting = true;
    this.sitOver = over;
    this.sitRamp = this.sit;
  }

  standUp(): void {
    this.sitting = false;
    this.sitOver = 0;
  }

  throwToward(x: number, z: number, onRelease: () => void): void {
    this.goal = null;
    this.sitting = false;
    this.faceToward(x, z, 1);
    this.action = { kind: 'throw', t: 0, released: false, onRelease };
  }

  /**
   * Down into a squat for something on the ground at `at` (or just ahead of them), with the left mitten. `onDone`
   * comes as the mitten gets there, so what it takes comes up with it; they stand up again on their own.
   */
  pickUp(onDone: () => void, at?: THREE.Vector3): void {
    this.goal = null;
    this.action = { kind: 'pickup', t: 0, onDone };
    this.pickupT = 0;
    this.pickupAt.set(0.2, 0, 0.62).applyAxisAngle(this.axisY, this.yaw).add(this.position);
    if (at) {
      /** No further out than a squatting child can reach. */
      const dx = at.x - this.position.x, dz = at.z - this.position.z, d = Math.hypot(dx, dz);
      const k = Math.min(1, 0.8 / Math.max(d, 1e-3));
      this.pickupAt.set(this.position.x + dx * k, 0, this.position.z + dz * k);
    }
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
    const u = stationU(-0.25);
    const near = (side: number, out: THREE.Vector3) => out.set(side * gunwaleHalf(u), gunwale(u), -0.25).applyMatrix4(boat.group.matrixWorld);
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
    this.stepOut(boat, side, rail, to, k.alightInside, 0, onDone);
  }

  /**
   * Out of a boat run up on a beach: a moment sitting in the stopped hull, then the same step out over the gunwale
   * on its higher side, down onto the sand beside the bow. A walk asked for meanwhile waits for their feet.
   */
  stepAshore(boat: Boat, onDone = () => {}): void {
    if (!this.riding) {
      this.dismount();
      onDone();
      return;
    }
    const k = tuning.boarding;
    boat.group.updateMatrixWorld(true);
    const side = boat.group.worldToLocal(boat.boardingPoint(this.tmp)).x < 0 ? -1 : 1;
    const u = stationU(-0.25);
    const rail = new THREE.Vector3(side * gunwaleHalf(u), gunwale(u), -0.25).applyMatrix4(boat.group.matrixWorld);
    const to = new THREE.Vector3(side * k.ashoreOut, 0, k.ashoreAhead).applyMatrix4(boat.group.matrixWorld);
    to.y = Math.max(this.ground(to.x, to.z), 0);
    this.stepOut(boat, side, rail, to, k.ashoreInside, k.ashorePause, onDone);
  }

  private stepOut(boat: Boat, side: number, rail: THREE.Vector3, to: THREE.Vector3, inside: number, pause: number,
    onDone: () => void): void {
    const k = tuning.boarding;
    const stand = this.tmp.set(side * inside, k.alightFloor, -0.25).applyMatrix4(boat.group.matrixWorld);
    this.action = {
      kind: 'alight', t: -pause, boat, to, rail, fromYaw: this.yaw,
      toYaw: Math.atan2(to.x - stand.x, to.z - stand.z), side, inside, shoved: false,
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
    this.keepSeat();
    this.hull = null;
    this.prev.copy(p);
    if (!this.riding && this.action?.kind !== 'alight') this.updateGoal(dt);
    /** Stopping, the feet finish the step they are in and come together under them rather than sliding back. */
    const past = ((this.gait - PASSING) % Math.PI + Math.PI) % Math.PI;
    if (this.speed < 0.4 && past > 0.12) this.gait += Math.min(Math.PI - past, dt * 9);
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
    this.scarf.update(dt, neck, this.rig.body.matrixWorld, this.keepOffChild, w, THREE.MathUtils.lerp(floor, mattress, onBed), p, this.yaw, onBed);
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
    if (this.decks.some(d => d.height1 !== undefined) && offTheEdge(this.decks, nx, nz, p.y)) {
      this.speed *= 0.5;
      return;
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
    if (this.pickupT < PICKUP) this.pickupT += dt;
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
      if (a.t > PICKUP_GRAB) {
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
        this.ride(boat.seat(this.tmp), boat.yaw, boat);
        a.onDone();
      }
    } else if (a.kind === 'alight') {
      const k = tuning.boarding;
      const boat = a.boat;
      boat.group.updateMatrixWorld(true);
      const stand = this.tmp2.set(a.side * a.inside, k.alightFloor, -0.25).applyMatrix4(boat.group.matrixWorld);
      if (a.t < k.alightStand) {
        const u = THREE.MathUtils.smootherstep(a.t, 0, k.alightStand);
        this.position.set(0, 0.02, -0.25).applyMatrix4(boat.group.matrixWorld).lerp(stand, u);
      } else {
        // The lead foot goes up onto the boards while the weight stays in the boat, then the body follows it over.
        const lean = THREE.MathUtils.smootherstep(a.t, k.alightStand, k.alightLift) * k.alightLean;
        const u = THREE.MathUtils.smootherstep(a.t, k.alightLift, k.alightAcross);
        const along = lean + (1 - lean) * u;
        this.position.lerpVectors(stand, a.to, along);
        const rise = THREE.MathUtils.lerp(stand.y, a.to.y, THREE.MathUtils.smoothstep(u, 0, 0.75));
        const top = THREE.MathUtils.lerp(stand.y, a.to.y, THREE.MathUtils.smoothstep(0.5, 0, 0.75));
        this.position.y = rise + (Math.max(0, a.rail.y + k.alightClear - top) + a.hop * k.alightHop) * Math.sin(u * Math.PI);
        if (!a.shoved && a.t >= k.alightLift) {
          a.shoved = true;
          boat.nudge(-a.side, k.alightShove);
        }
      }
      const turn = Math.atan2(Math.sin(a.toYaw - a.fromYaw), Math.cos(a.toYaw - a.fromYaw));
      this.yaw = a.fromYaw + turn * THREE.MathUtils.smootherstep(a.t, 0, k.alightStand * 1.2);
      this.riding = a.t < k.alightLift;
      this.sitting = a.t < 0;
      this.rideRoll = this.riding ? boat.roll * 0.55 : 0;
      this.ridePitch = this.riding ? boat.pitch * 0.55 : 0;
      if (a.t >= k.alightSettle) {
        this.action = null;
        this.position.copy(a.to);
        a.onDone();
      }
    }
  }

  /**
   * The floor under a foot: the ground, a deck, or the boards of the boat they are riding in. Stepping out, the feet
   * keep to the body's own level, which arcs over the gunwale, and a foot still inside the hull ignores a deck that
   * reaches in under it.
   */
  private floorAt(x: number, z: number): number {
    const ground = Math.max(this.ground(x, z), 0);
    const level = this.position.y - 0.26 * this.sit;
    const a = this.action;
    if (a?.kind === 'alight') {
      const local = a.boat.group.worldToLocal(this.footLocal.set(x, 0, z));
      return Math.abs(local.x) < gunwaleHalf(stationU(local.z)) + 0.04 ? level : Math.max(ground, level);
    }
    if (!this.riding) return ground;
    return Math.max(this.ground(x, z), level);
  }

  private pose(dt: number): void {
    const r = this.rig;
    const t = this.time;
    const P = this.look;
    const h = dt || 1;
    if (this.sitOver > 0) {
      this.sitRamp = THREE.MathUtils.clamp(this.sitRamp + (this.sitting ? h : -h) / this.sitOver, 0, 1);
      this.sit = THREE.MathUtils.smootherstep(this.sitRamp, 0, 1);
    } else this.sit = damp(this.sit, this.sitting ? 1 : 0, 4, h);
    /** Swinging feet come and go in little runs, never a metronome. */
    this.dangling = damp(this.dangling, this.dangle * this.sit, 2, h);
    this.dangleT += h * (5.2 + 1.3 * Math.sin(this.time * 0.37));
    const moving = Math.min(1, this.speed / WALK);
    const running = THREE.MathUtils.clamp((this.speed - WALK) / (RUN - WALK), 0, 1);
    const [L, R] = P.arms;
    const lerp = THREE.MathUtils.lerp;
    const smooth = THREE.MathUtils.smoothstep;
    /**
     * Arms swing against the legs, a beat behind them, as far back past the hip as forward. Running they pump from
     * the shoulder: the elbow opens as the arm drives back past the hip and closes as the mitten comes up to the chest.
     */
    const pace = 0.5 * moving + 0.25 * running;
    const armSwing = Math.cos(this.gait - 0.35);
    const armBack = 0.04 * moving + 0.12 * running;
    const walkBend = 0.22 * moving * (1 - running);
    const pump = 0.4 * running;
    arm(L, -pace * armSwing - armBack, 0.22 + 0.1 * running, 0, 0.2 + 1.15 * running - pump * armSwing + Math.max(0, -armSwing) * walkBend, 0.12);
    arm(R, pace * armSwing - armBack, 0.22 + 0.1 * running, 0, 0.2 + 1.15 * running + pump * armSwing + Math.max(0, armSwing) * walkBend, 0.12);
    let lean = 0;
    let twist = 0;
    let rise = 0;
    let crouch = 0;
    let bend = 0;
    let headDown = 0;
    let tiltHead = 0;
    P.step[0] = P.step[1] = 0;

    const a = this.action;
    this.grips[0].w = this.grips[1].w = 0;
    this.gaze.w = 0;
    if (a?.kind === 'throw') {
      /**
       * The paper is taken up beside the hood with the elbow out and the shoulder drawn back, held a beat, then the
       * body unwinds and the arm goes through long, forward and up, and follows through across the front.
       */
      const cock = smooth(a.t, 0.05, 0.45) * (1 - smooth(a.t, 0.52, 0.64));
      const fling = smooth(a.t, 0.52, 0.66) * (1 - smooth(a.t, 0.8, 1.1));
      const k = smooth(a.t, 0, 0.14) * (1 - smooth(a.t, 0.82, 1.1));
      this.grip(0, THROW, a.t, k, THROW_ELBOW);
      R.raise = lerp(R.raise, 1.15, cock);
      R.out = lerp(R.out, 0.3, cock);
      R.elbow = lerp(R.elbow, 0.45, cock);
      R.raise = lerp(R.raise, 0.15, fling);
      R.elbow = lerp(R.elbow, 1.0, fling);
      twist = 0.42 * cock - 0.34 * fling;
      lean = -0.1 * cock + 0.26 * fling;
      crouch = 0.04 * cock;
      P.step[1] = 0.22 * cock;
      this.gazeAt(0, -0.12 + 0.08 * fling, k);
    } else if (a?.kind === 'cheer') {
      /** A dip, a hop with both arms flung up in a wide V, a smaller hop, and down again: the whole of them in it. */
      const hop = (from: number, to: number) => {
        const u = THREE.MathUtils.clamp((a.t - from) / (to - from), 0, 1);
        return 4 * u * (1 - u);
      };
      const air = 0.3 * hop(0.16, 0.56) + 0.16 * hop(0.7, 1.0);
      const dip = Math.sin(THREE.MathUtils.clamp(a.t / 0.16, 0, 1) * Math.PI) + 0.7 * Math.sin(THREE.MathUtils.clamp((a.t - 0.56) / 0.14, 0, 1) * Math.PI)
        + 0.5 * Math.sin(THREE.MathUtils.clamp((a.t - 1.0) / 0.16, 0, 1) * Math.PI);
      rise = air;
      crouch = 0.07 * dip;
      const k = smooth(a.t, 0.04, 0.26) * (1 - smooth(a.t, 1.0, 1.3));
      const pump = 0.05 * Math.sin(a.t * 14);
      for (const hand of [0, 1] as const) {
        const g = this.grips[hand];
        g.w = k;
        g.world = false;
        g.at.set(0.6, 1.33 + pump, 0.1);
        g.elbow.set(1, -0.5, -0.5);
      }
      twist = Math.sin(a.t * 6) * 0.12 * k;
      lean = -0.12 * k;
      P.step[0] = P.step[1] = 0.45 * Math.min(1, air * 6);
      this.gazeAt(0, -0.28, k);
    } else if (a?.kind === 'wave') {
      /** The free hand up beside the hood, the forearm upright and the mitten going side to side from the elbow. */
      const hand = this.carryingPlane && this.stowed < 0.5 ? 1 : 0;
      const k = smooth(a.t, 0, 0.3) * (1 - smooth(a.t, 1.45, 1.8));
      const g = this.grips[hand];
      g.w = k;
      g.world = false;
      g.at.set(0.58 + 0.1 * Math.sin(a.t * 11), 1.28 + 0.025 * Math.cos(a.t * 22), 0.28);
      g.elbow.set(1, -0.8, 0.1);
      twist = 0.1 * k * (hand === 0 ? 1 : -1);
      tiltHead = 0.1 * k * (hand === 0 ? 1 : -1);
    } else if (a?.kind === 'reach') {
      /** Both arms out after it, up on their toes; then the arms give up, slowly, a long time after the rest of them. */
      const out = smooth(a.t, 0, 0.22);
      const give = smooth(a.t, 1.4, 4.0);
      for (const hand of [0, 1] as const) {
        const g = this.grips[hand];
        g.w = out * (1 - smooth(a.t, 3.4, 4.2));
        g.world = false;
        g.at.set(lerp(0.2, 0.26, give), lerp(1.12, 0.62, give), lerp(0.62, 0.4, give));
        g.elbow.set(1, -1, 0);
      }
      lean = 0.16 * out * (1 - give) + 0.04;
      rise = 0.05 * out * (1 - give);
      headDown = -0.18 * out * (1 - give) + 0.1 * give;
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

    if (this.pickupT < PICKUP) {
      /**
       * Down into a squat with the other hand on a knee and the mitten to the ground, and up again: it carries on
       * after the story has what they picked up, into whatever comes next.
       */
      const u = this.pickupT;
      const down = smooth(u, 0, 0.36) * (1 - smooth(u, 0.52, PICKUP)) * (1 - 0.6 * moving);
      bend += 0.6 * down;
      lean += 0.22 * down;
      crouch += 0.54 * down;
      const g = this.grips[0];
      if (g.w === 0) {
        g.w = smooth(u, 0, 0.3) * (1 - smooth(u, 0.55, PICKUP));
        g.world = true;
        g.at.copy(this.pickupAt);
        g.at.y = this.ground(g.at.x, g.at.z) + 0.1;
        g.elbow.set(0.7, 0.2, -1);
      }
      R.raise = lerp(R.raise, 0.95, down);
      R.out = lerp(R.out, 0.35, down);
      R.elbow = lerp(R.elbow, 1.2, down);
      if (this.gaze.w === 0) this.gazeAt(0, 0.5, down);
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
      /** Into a strong wind: a forearm up across the lower face with the elbow out, leaning into it, chin down. */
      const g = this.grips[1];
      g.w = brace;
      g.world = false;
      g.at.set(0, 1.25, 0.34);
      g.elbow.set(1, -0.2, 0.3);
      lean += 0.22 * brace;
      headDown += 0.15 * brace;
    }

    const sit = this.sit;
    const kneel = this.kneel.step(this.kneeling, 0.55, dt) * (1 - sit);
    const leanNow = this.leanNow.step(this.lean, 0.4, dt);
    const tiltNow = this.tiltNow.step(this.tilt, 0.4, dt);
    const armsFree = a || this.presenting > 0.01 ? 0 : 1;
    /** Sat on the ground, the hands come in to the lap: round the paper if they have it, otherwise on the knees. */
    const onGround = this.sitting && !this.riding && armsFree === 1 && this.swing < 0.01 && !this.armsFull
      && this.reachWant[0] === 0 && this.reachWant[1] === 0;
    const lap = this.lap.step(onGround ? 1 : 0, 0.35, dt) * (1 - this.abedGlide.value);
    /** Seated anywhere else, idle hands come to rest on the lap. */
    const rest = sit * armsFree * (1 - lap);
    L.raise = lerp(L.raise, 0.55, rest);
    R.raise = lerp(R.raise, 0.5, rest);
    L.elbow = lerp(L.elbow, 0.85, rest);
    R.elbow = lerp(R.elbow, 0.85, rest);
    L.out = lerp(L.out, 0.22, rest);
    R.out = lerp(R.out, 0.22, rest);
    lean += -0.06 * sit + 0.1 * kneel;
    bend += leanNow + this.stoop(dt);

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
    /** Actions that leave the paper hand alone, or take it from the carry, keep it underneath. */
    const carryOk = !a || a.kind === 'throw' || a.kind === 'wave' || a.kind === 'cheer' || a.kind === 'reach';
    const carry = this.carryingPlane && carryOk && this.presenting < 0.01 && this.swing < 0.01 ? 1 - this.stowed : 0;
    if (carry > 0) {
      /** A quiet carry at the hip: running must not swing the wing back through the coat. Companion IK still wins. */
      L.raise = lerp(L.raise, 0.2 - armSwing * moving * 0.12, carry);
      L.out = lerp(L.out, 0.58, carry);
      L.elbow = lerp(L.elbow, 0.45, carry);
      L.twist = lerp(L.twist, 0, carry);
    }
    this.lapPaper = lap * carry;
    if (lap > 0.001) {
      const [l, r] = this.grips;
      /** The left mitten leaves the lap to cover a yawn. */
      l.w = lap * (1 - this.yawnGlide.value);
      r.w = lap;
      l.world = r.world = false;
      l.at.set(lerp(0.2, 0.07, carry), 0.24, lerp(0.42, 0.44, carry));
      r.at.set(lerp(0.2, 0.2, carry), 0.25, lerp(0.42, 0.5, carry));
      l.elbow.set(0.45, -1, -0.2);
      r.elbow.set(0.45, -1, -0.2);
      bend += 0.12 * lap;
      headDown += 0.12 * lap;
      if (this.gaze.w === 0 && !this.lookAt) this.gazeAt(0.1, 0.32, 0.9 * this.lapPaper);
    }
    /** Standing a while, whatever hand is free holds a strap of the bag at their chest. */
    const handsFree = !a && !this.sitting && this.presenting < 0.01 && this.swing < 0.01 && !this.armsFull
      && this.reachWant[0] === 0 && this.reachWant[1] === 0 && this.brace < 0.1 && this.kneeling < 0.1 && this.abed < 0.01;
    this.stillFor = moving < 0.05 && handsFree ? this.stillFor + h : 0;
    const holding = this.stillFor > 1.2;
    const straps = this.straps.step(holding ? 1 : 0, holding ? 0.55 : 0.18, dt);
    if (straps > 0.001) {
      for (const g of this.grips) {
        if (g === this.grips[0] && carry > 0.01) continue;
        g.w = straps;
        g.world = false;
        g.at.set(0.19, 0.76, 0.3);
        g.elbow.set(0.5, -1, -0.35);
      }
    }

    /**
     * Idle, the gaze wanders, and every so often they look away round to one side or up at the sky for a moment; on
     * the move it settles on the way ahead.
     */
    const settle = 1 - 0.75 * moving;
    this.nextGlance -= h;
    if (this.nextGlance <= 0) {
      /** A different look each time, at uneven times, without drawing on the shared random sequence. */
      const k = ++this.glances;
      this.nextGlance = 6 + 6 * ((k * 0.570796) % 1);
      this.glanceUntil = t + 1.4 + 0.8 * ((k * 0.414214) % 1);
      this.glanceYaw = (k % 2 ? 1 : -1) * (0.55 + 0.45 * ((k * 0.618034) % 1));
      this.glancePitch = -0.3 + 0.36 * ((k * 0.754878) % 1);
    }
    const idle = moving < 0.05 && !a && !this.sitting && this.presenting < 0.01;
    this.glance = damp(this.glance, idle && t < this.glanceUntil ? 1 : 0, 3.5, h);
    let wantYaw = lerp(Math.sin(t * 0.37) * 0.35 * settle, this.glanceYaw, this.glance);
    let wantPitch = lerp(Math.sin(t * 0.23) * 0.08 * settle + 0.06 * running, this.glancePitch, this.glance);
    /**
     * A gust arriving is felt: they look round toward where it comes from, unless something else has their
     * attention, and give a little with its push.
     */
    const ws = this.sample;
    const arrived = smooth(ws.energy, tuning.wind.arriveFrom, tuning.wind.arriveFull);
    this.gusted = damp(this.gusted, arrived, arrived > this.gusted ? 6 : 1.2, h);
    const windAhead = ws.x * Math.sin(this.yaw) + ws.z * Math.cos(this.yaw);
    const windLeft = ws.x * Math.cos(this.yaw) - ws.z * Math.sin(this.yaw);
    const push = this.gusted * (1 - this.sit) * (1 - this.abedGlide.value);
    if (Math.hypot(windAhead, windLeft) > 1) {
      const from = THREE.MathUtils.clamp(Math.atan2(-windLeft, -windAhead), -1, 1);
      const turn = 0.8 * push * (1 - this.glance);
      wantYaw = lerp(wantYaw, from, turn);
      wantPitch = lerp(wantPitch, -0.1, turn);
    }
    lean += THREE.MathUtils.clamp(windAhead * 0.008, -0.08, 0.08) * push;
    const sway = THREE.MathUtils.clamp(-windLeft * 0.008, -0.08, 0.08) * push;
    if (this.lookAt) {
      r.root.updateMatrixWorld(true);
      const head = r.face.getWorldPosition(this.tmp);
      const dx = this.lookAt.x - head.x;
      const dy = this.lookAt.y - head.y;
      const dz = this.lookAt.z - head.z;
      /**
       * Which way to turn is judged from the neck, which the turn does not move: judged from the face, something held
       * close under the chin flicks the head from side to side as each turn moves the face past it.
       */
      const neck = r.bones[BONE.neck].getWorldPosition(this.tmp2);
      const nx = this.lookAt.x - neck.x;
      const nz = this.lookAt.z - neck.z;
      const yawTo = Math.atan2(nx, nz) - this.yaw;
      const beneath = smooth(Math.hypot(nx, nz), 0.08, 0.25);
      wantYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(yawTo), Math.cos(yawTo)), -1.1, 1.1) * beneath;
      /** Looking down at something at their own feet takes a real chin-down; past this the hood swallows the face. */
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.9, 0.52);
    }
    wantYaw = lerp(wantYaw, this.gaze.yaw, this.gaze.w);
    wantPitch = lerp(wantPitch, this.gaze.pitch, this.gaze.w);
    this.headYaw = damp(this.headYaw, wantYaw, 5, h);
    this.headPitch = damp(this.headPitch, wantPitch, 5, h);
    const abed = this.abedGlide.step(this.abed, 0.8, h);
    const yawn = this.yawnGlide.step(this.yawn, 0.35, h);
    const shut = this.shutGlide.step(Math.max(this.eyesShut, yawn * 0.9), 0.4, h);
    P.headYaw = this.headYaw;
    P.headPitch = this.headPitch + headDown + this.sleepiness * 0.24 * (1 - abed) - yawn * 0.2;
    P.headRoll = Math.sin(t * 0.6) * 0.05 + tiltNow + tiltHead;
    lean += this.sleepiness * 0.07 * (1 - abed);
    this.breathT += h * lerp(2.2, 0.75, abed);
    P.breath = Math.sin(this.breathT) * (1 + yawn * 2 + abed * 2.5);

    P.lean = lean;
    P.twist = twist;
    P.tilt = sway;
    P.bend = bend;
    P.rise = rise;
    P.sit = sit;
    this.onGround = damp(this.onGround, this.riding ? 0 : 1, 4, h);
    P.lap = sit * this.onGround;
    P.kneel = kneel;
    P.swing = this.swing;
    P.kick = this.kick;
    P.dangle = this.dangling * (0.55 + 0.45 * Math.sin(this.time * 0.61 + 1.3));
    P.dangleAt = this.dangleT;
    P.lie = 0;
    P.lieFold = 0;

    r.root.position.copy(this.position);
    r.root.position.y += rise - crouch - sit * SIT_DROP - kneel * KNEEL_DROP + this.hop;
    const jump = Math.atan2(Math.sin(this.yaw - this.lastSetYaw), Math.cos(this.yaw - this.lastSetYaw));
    this.lastSetYaw = this.yaw;
    if (dt > 0 && Math.abs(jump) > TURN_RATE * 1.6 * dt && abed < 0.01) this.yawLag.value -= jump;
    /** Half a turn takes about half a second, a small one less. */
    const shownYaw = this.yaw + this.yawLag.step(0, 0.2 + 0.2 * Math.min(1, Math.abs(this.yawLag.value) / Math.PI), dt);
    r.root.rotation.set(this.riding ? this.ridePitch : 0, shownYaw, this.riding ? this.rideRoll : 0);
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
    const turn = Math.atan2(Math.sin(shownYaw - this.lastYaw), Math.cos(shownYaw - this.lastYaw)) / h;
    this.lastYaw = shownYaw;
    /** Turning on the spot, the feet step round with it. */
    if (dt > 0) this.gait += Math.abs(turn) * h * 1.3 * (1 - moving);
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
      const g = this.grips[hand];
      if (g.w <= 0.001) continue;
      const at = g.world ? this.tmp.copy(g.at) : r.body.localToWorld(this.tmp.set(hand === 0 ? g.at.x : -g.at.x, g.at.y, g.at.z));
      this.motion.reach(hand === 0, at, g.w, g.elbow);
    }
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
   * A story's reach for something low in front of them that the arms cannot get to bends them further over toward
   * it, only as far as it takes; once it is in reach they ease back up.
   */
  private stoop(dt: number): number {
    const r = this.rig;
    let over = -1;
    const onFeet = !this.sitting && !this.riding && this.abed < 0.01;
    for (const hand of [0, 1] as const) {
      if (!onFeet || this.reachNow[hand] < 0.5 || this.reachInBody[hand]) continue;
      const target = this.reachAt[hand];
      const shoulder = r.bones[hand === 0 ? BONE.upperL : BONE.upperR].getWorldPosition(this.tmp2);
      const ahead = (target.x - shoulder.x) * Math.sin(this.yaw) + (target.z - shoulder.z) * Math.cos(this.yaw);
      if (target.y > shoulder.y || ahead <= 0) continue;
      over = Math.max(over, target.distanceTo(shoulder) - ARM_REACH);
    }
    const push = over > 0 ? over * 4 : over < -0.05 ? -0.5 : 0;
    this.stooped = THREE.MathUtils.clamp(this.stooped + push * dt, 0, 0.7);
    return this.stooped;
  }

  /** Sends a mitten along an action's path, `w` of the way from the pose's own arm. */
  private grip(hand: 0 | 1, keys: readonly Key[], t: number, w: number, elbow: THREE.Vector3): void {
    const g = this.grips[hand];
    g.w = w;
    g.world = false;
    along(keys, t, g.at);
    g.elbow.copy(elbow);
  }

  private gazeAt(yaw: number, pitch: number, w: number): void {
    this.gaze.yaw = yaw;
    this.gaze.pitch = pitch;
    this.gaze.w = w;
  }

  /**
   * Getting into bed, in two moves: round onto the mattress about the seat with the hands down beside the hips and
   * the legs brought up along the bed, then back about the hips until the head is on the pillow, the whole child
   * tipped onto their back and rolled a little onto one side. The hands come in onto the chest under the chin.
   */
  private layDown(w: number): void {
    const r = this.rig;
    const P = this.look;
    const s = tuning.sleeping;
    const lerp = THREE.MathUtils.lerp;
    const smooth = THREE.MathUtils.smoothstep;
    const side = this.sideGlide.step(this.abedSide, 0.9, this.drive.dt || 1 / 60);
    const round = smooth(w, 0, s.swingIn);
    const back = smooth(w, s.swingIn * 0.8, 1);
    this.upright.setFromAxisAngle(this.axisY, this.bedYaw);
    this.lie
      .copy(this.upright)
      .multiply(this.spin.setFromAxisAngle(this.axisX, -Math.PI / 2 + s.lieTip))
      .multiply(this.spin.setFromAxisAngle(this.axisY, (0.8 + side * 0.2) * s.lieSide));
    this.hipFrom.copy(this.hipPivot).applyQuaternion(r.root.quaternion).add(r.root.position);
    this.hipTo.copy(this.hipPivot).applyQuaternion(this.lie).add(this.bedAt);
    r.root.quaternion.slerp(this.upright, round).slerp(this.lie, back);
    /** Sat up in it, the seat is as low on the mattress as it was on the edge; lying, the coat's bell lifts it. */
    this.tmp2.set(this.hipTo.x, this.hipFrom.y, this.hipTo.z);
    r.root.position.lerpVectors(this.hipFrom, this.tmp2, round).lerp(this.hipTo, back)
      .sub(this.tmp.copy(this.hipPivot).applyQuaternion(r.root.quaternion));
    P.lie = round;
    P.lieFold = s.lieFold * (1 - back);
    P.sit *= 1 - round;
    P.lap *= 1 - round;
    P.lean = lerp(P.lean, 0.06, back);
    P.bend *= 1 - round;
    P.twist *= 1 - round;
    for (const m of P.arms) {
      m.raise = lerp(m.raise, 0.7, w);
      m.out = lerp(m.out, -0.1, w);
      m.elbow = lerp(m.elbow, 2.2, w);
      m.twist = lerp(m.twist, 0.3, w);
    }
    const plant = smooth(w, 0, s.swingIn * 0.3) * (1 - smooth(w, s.swingIn * 0.8, s.swingIn * 1.3));
    const fold = smooth(w, s.swingIn * 0.8, s.swingIn * 1.4);
    for (const hand of [0, 1] as const) {
      const g = this.grips[hand];
      const was = g.world ? 0 : g.w * (1 - smooth(w, 0, s.swingIn * 0.3));
      const sum = was + plant + fold;
      if (sum < 1e-4) continue;
      g.at.multiplyScalar(was)
        .addScaledVector(this.tmp.set(0.42, 0.06, 0.02), plant)
        .addScaledVector(this.tmp2.set(0.13, 0.72 + 0.03 * this.tighter, 0.4 - 0.06 * this.tighter), fold)
        .divideScalar(sum);
      g.elbow.multiplyScalar(was).addScaledVector(this.tmp.set(0.5, 0.3, -1), plant).addScaledVector(this.tmp2.set(1, -0.8, -0.2), fold);
      g.w = Math.min(1, sum);
      g.world = false;
    }
    /** Chin down toward their hands, the way a child actually sleeps. */
    P.headPitch = lerp(P.headPitch, 0.3, back);
    P.headYaw = lerp(P.headYaw, -0.2 * side, back);
  }
}

/** A mitten's way through an action: [time, x, y, z] in the body's frame, passed through smoothly. */
type Key = readonly [number, number, number, number];

function along(keys: readonly Key[], t: number, out: THREE.Vector3): THREE.Vector3 {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const u = THREE.MathUtils.clamp((t - k1[0]) / (k2[0] - k1[0]), 0, 1);
  const u2 = u * u, u3 = u2 * u;
  const cr = (j: number) => 0.5 * (2 * k1[j] + (k2[j] - k0[j]) * u + (2 * k0[j] - 5 * k1[j] + 4 * k2[j] - k3[j]) * u2
    + (3 * k1[j] - k0[j] - 3 * k2[j] + k3[j]) * u3);
  return out.set(cr(1), cr(2), cr(3));
}

/**
 * The throwing hand: from the hip up beside the hood, drawn back a touch as the body winds, then long and up through
 * the release (at 0.62) and down across the front.
 */
const THROW: readonly Key[] = [
  [0, 0.45, 0.28, 0.12],
  [0.4, 0.5, 1.3, -0.1],
  [0.52, 0.5, 1.34, -0.15],
  [0.62, 0.3, 1.24, 0.48],
  [0.78, 0.14, 0.6, 0.42],
  [1.1, 0.42, 0.3, 0.14],
];
const THROW_ELBOW = new THREE.Vector3(1, -0.35, -0.25);

function arm(m: ArmPose, raise: number, out: number, twist: number, elbow: number, wrist: number): void {
  m.raise = raise;
  m.out = out;
  m.twist = twist;
  m.elbow = elbow;
  m.wrist = wrist;
}

/** Where in the walk's phase the feet pass each other, both under the hips: the stance foot halfway through. */
const PASSING = 0.54 * Math.PI;

/** How long a pick-up takes, and when the mitten gets to the ground. */
const PICKUP = 0.9;
const PICKUP_GRAB = 0.46;

/** From the shoulder to the middle of the mitten at full stretch, in the world, less a little. */
const ARM_REACH = (UPPER_ARM + FOREARM) * 1.12 - 0.02;

/** How far the root comes down when they sit (on the ground, a thwart, a stool) and when they kneel back on their heels. */
const SIT_DROP = 0.67;
const KNEEL_DROP = 0.54;

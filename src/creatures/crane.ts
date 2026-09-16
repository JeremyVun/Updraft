import * as THREE from 'three';
import { atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';
import { ease, easeAngle, wrapAngle, Spring } from './motion';
import type { WindSample } from '../wind/field';
import {
  BODY,
  BONES,
  FOOT_L,
  FOOT_R,
  HAND_L,
  HAND_R,
  HEAD,
  JAW,
  NECK_A,
  NECK_B,
  ROOT,
  SHIN,
  SHIN_L,
  SHIN_R,
  SIZE,
  SKELETON,
  TAIL,
  THIGH,
  THIGH_L,
  THIGH_R,
  TUFT,
  WING_L,
  WING_R,
  coltGeometry,
} from './colt/body';
import { COLT_FRAG, COLT_VERT } from './colt/shader';

/** How strong an updraft under it has to be before it looks up and opens its wings, and before it goes. */
const LIFT_TO_HOPE = 0.18;
const LIFT_TO_FLY = 0.5;
/** It never climbs further above the ground than this, so a glide can never take it out of the frame. */
const CEILING = 7.5;
/** Nothing it can do keeps it up longer than this. */
const GLIDE_FOR = 9;
const HOP_FOR = 2.6;
const FLOOR = 0.006 * SIZE;

/**
 * Where it sits on the child, in the child's frame (x to their left, z forward), from the point the child offers.
 * The arms point is inside the coat and the hood point is inside the hood, and the camera is nearly always behind
 * the child, so the colt is carried the way a child carries a hen: tucked under the right arm against the coat,
 * where it can be seen from every side. In the hood it perches on the shoulders behind the head, peeking round
 * the hood on the side the camera is on.
 */
const ARMS = new THREE.Vector3(-0.7, 0.0, -0.2);
const ARMS_YAW = 0.15;
const HOOD = new THREE.Vector3(-0.26, 0.15, -0.43);
/** The climb from the arms into the hood goes up over the right shoulder, outside the hood. */
const SHOULDER = new THREE.Vector3(-0.62, 0.42, 0.18);

export type CraneState = 'flying' | 'falling' | 'downed' | 'fallen' | 'carried' | 'hooded' | 'following' | 'gliding' | 'leaving';

interface Handoff {
  from: THREE.Vector3;
  via: THREE.Vector3 | null;
  /** Whether `from` and `via` are in the child's frame (a ride) or the world (the ground). */
  local: boolean;
  t: number;
  dur: number;
  lift: number;
  kind: 'lift' | 'climb' | 'hop' | 'dash';
}

const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function rotY(v: THREE.Vector3, yaw: number): THREE.Vector3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = v.x * c + v.z * s;
  v.z = -v.x * s + v.z * c;
  v.x = x;
  return v;
}

/**
 * The crane colt: too young to keep up with its flock, carried and walked and finally flown. The only other
 * character in the story, and like the child it never makes a sound, except when it is lost.
 */
export class Crane {
  readonly position = new THREE.Vector3();
  yaw = 0;
  state: CraneState = 'flying';
  /** How close it stays and how often it looks up at the child: only ever rises. */
  bond = 0;
  visible = false;
  /** How many times the player has put it in the air. It has never flown before the first. */
  flights = 0;

  private readonly root = new THREE.Object3D();
  private readonly nodes: THREE.Object3D[] = [];
  private readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly bones: THREE.Matrix4[] = [];
  /** Where it is drawn, which lags the story's `position` while it is being lifted, climbing or set down. */
  private readonly shown = new THREE.Vector3();
  private readonly prevShown = new THREE.Vector3();
  private shownYaw = 0;
  private time = 0;
  private lookAt: THREE.Vector3 | null = null;

  /** The point on the child it rides, and how that point is moving, so it is jostled the way a passenger is. */
  private readonly anchor = new THREE.Vector3();
  private anchorYaw = 0;
  private readonly anchorPrev = new THREE.Vector3();
  private readonly anchorVel = new THREE.Vector3();
  private readonly jostle = new THREE.Vector3();
  private readonly jostleVel = new THREE.Vector3();
  private gait = 0;
  private bob = 0;
  private rideFor = 0;
  private calm = 0;
  private doze = 0;
  private wriggle = 0;
  private nextWriggle = 0;
  private hand: Handoff | null = null;

  private stride = 0;
  private flapPhase = 0;
  private flap = 0;
  private effort = 0;
  private settle = 0;
  private glide = 0;
  private roll = 0;
  private pitch = 0;
  private slew = 0;
  private fallT = 0;
  private fallFor = 1;
  private readonly fallFrom = new THREE.Vector3();
  private readonly fallTo = new THREE.Vector3();
  private readonly fallDrift = new THREE.Vector3();
  private struggle = 0;
  /** On its side after the landing, until the first try rights it. */
  private flop = 0;
  private air = 0;
  private glideT = 0;
  private hope = 0;
  private hopT = 0;
  private hopLift = 0;
  private landedAt = 0;
  private landing = 0;
  private leaveYaw = 0;
  private climb = 0;
  private notice = 0;
  private readonly childPrev = new THREE.Vector3();
  private childSpeed = 0;

  private fear = 0;
  private blink = 0;
  private blinkT = 0;
  private nextBlink = 1.5;
  private preen = 0;
  private preenSide = 1;
  private nextPreen = 6;
  private shake = 0;
  private peck = 0;
  private nextPeck = 4;
  private beg = 0;
  private nextBeg = 0;
  private callT = 0;
  private callLong = false;
  private nextCall = 0;
  private breath = 0;
  private puff = 0;
  private glanceYaw = 0;
  private glancePitch = 0;
  private glanceChild = false;
  private nextGlance = 0;
  private headYaw = 0;
  private headPitch = 0;
  private readonly tuft = new Spring();

  /** Smoothed pose weights, so nothing it does ever snaps. */
  private readonly p = { sit: 0, held: 0, hooded: 0, hunch: 0, curl: 0, tall: 0, reach: 0, spread: 0, sleep: 0, hurry: 0 };

  private readonly to = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly want = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  constructor() {
    this.nodes[ROOT] = this.root;
    for (const [bone, parent, [x, y, z]] of SKELETON) {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      this.nodes[parent].add(o);
      this.nodes[bone] = o;
    }
    for (let i = 0; i < BONES; i++) this.bones.push(new THREE.Matrix4());

    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uBones: { value: this.bones }, uNudge: { value: 2.4 }, uAir: { value: 0 }, uBlink: { value: 0 } },
      vertexShader: COLT_VERT,
      fragmentShader: COLT_FRAG,
    });
    this.mesh = new THREE.Mesh(coltGeometry(), this.mat);
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
    this.hand = null;
    this.state = 'falling';
    this.visible = true;
    this.position.copy(from);
    this.shown.copy(from);
    this.yaw = line;
    this.shownYaw = line;
    this.fear = 0.5;
    this.nextCall = this.time + 0.6;
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
    if ((this.state === 'following' || this.state === 'fallen') && this.hopT <= 0) {
      this.state = 'following';
      this.hopT = HOP_FOR;
      this.hopLift = 0;
    }
  }

  /** Riding with the child, in the arms or in the hood. */
  get carried(): boolean {
    return this.state === 'carried' || this.state === 'hooded';
  }

  /** Comes down out of the flock and lands in the grass, too tired to go on. */
  fall(x: number, z: number, yaw: number): void {
    this.position.set(x, Math.max(heightAt(x, z), 0), z);
    this.shown.copy(this.position);
    this.yaw = yaw;
    this.state = 'fallen';
    this.settle = 1;
    this.visible = true;
  }

  /** Riding in the child's arms or hood; the caller gives the world point each frame. */
  carry(at: THREE.Vector3, yaw: number, hooded = false): void {
    const next: CraneState = hooded ? 'hooded' : 'carried';
    const was = this.state;
    this.anchor.copy(at);
    this.anchorYaw = yaw;
    if (was !== next) this.beginRide(was, next);
    this.state = next;
    this.position.copy(at);
    this.yaw = yaw;
    this.visible = true;
  }

  /** Gone to ground and staying there: hunched as small as it can make itself, in the dark, waiting to be found. */
  cower(): void {
    if (this.carried) this.startHandoff(this.shown, null, false, 1.1, 0.5, 'dash');
    this.state = 'fallen';
    this.settle = 1;
    this.flap = 0;
    this.effort = 0;
    this.hopT = 0;
    this.fear = 1;
    this.visible = true;
    this.nextCall = this.time + 1.5;
  }

  /** Set down to walk at the child's heel. */
  follow(): void {
    this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0);
    if (this.carried) {
      this.startHandoff(this.shown, null, false, 0.55, 0.35, 'hop');
      this.settle = 0.2;
      this.shake = 0;
      this.landedAt = this.time;
    } else if (this.state !== 'following') this.settle = 0.6;
    this.state = 'following';
    this.visible = true;
    this.fear = Math.min(this.fear, 0.2);
  }

  /** A moment shared: the bond only ever goes up. */
  bind(amount: number): void {
    this.bond = Math.min(1, this.bond + amount);
  }

  watch(target: THREE.Vector3 | null): void {
    this.lookAt = target;
  }

  /** Where the child should look to meet its eye. */
  eye(out: THREE.Vector3): THREE.Vector3 {
    this.nodes[HEAD].updateMatrixWorld(true);
    return out.setFromMatrixPosition(this.nodes[HEAD].matrixWorld);
  }

  update(dt: number, time: number, child: THREE.Vector3, wind: WindSample): void {
    this.time = time;
    this.mesh.visible = this.visible;
    if (!this.visible) return;
    dt = Math.min(dt, 0.05);
    this.childSpeed = ease(this.childSpeed, dt > 0 ? Math.min(8, this.tmp.copy(child).sub(this.childPrev).length() / dt) : 0, 8, dt);
    this.childPrev.copy(child);

    const afoot = this.state === 'following' || this.state === 'fallen';
    /** It only ever goes up on wind that is actually under it, so the player learns where to hold the pointer. */
    const lift = afoot || this.state === 'gliding' ? wind.lift : 0;
    this.hope = ease(this.hope, afoot && this.hopT <= 0 ? THREE.MathUtils.smoothstep(lift, LIFT_TO_HOPE, LIFT_TO_FLY) : 0, 2.5, dt);

    if (this.state === 'leaving') this.climbOut(dt);
    else if (this.state === 'gliding') this.soar(dt, wind, child);
    else if (this.state === 'following') this.walk(dt, child);
    else if (this.state === 'fallen') this.rest(dt, child);
    else if (this.state === 'falling') this.descend(dt);
    else if (this.state === 'downed') this.struggling(dt);
    else this.ride(dt);

    /** Enough wind under it and it goes — but not the instant it lands, or one long hold would juggle it. */
    if (afoot && lift > LIFT_TO_FLY && this.hopT <= 0 && this.landing <= 0 && time - this.landedAt > 1.6) this.takeOff();

    this.glide = ease(this.glide, this.state === 'gliding' ? 1 : this.hope * 0.5, 3, dt);
    this.mat.uniforms.uAir.value =
      this.state === 'falling'
        ? clamp((this.shown.y - this.fallTo.y) / 6, 0, 1)
        : this.state === 'gliding' || this.state === 'leaving'
          ? clamp((this.shown.y - Math.max(heightAt(this.shown.x, this.shown.z), 0)) / 4, 0, 1)
          : 0;
    this.live(dt, child);
    this.place(dt);
    this.pose(dt);
  }

  private beginRide(was: CraneState, next: CraneState): void {
    this.rideFor = 0;
    this.doze = 0;
    this.calm = 0;
    this.anchorPrev.copy(this.anchor);
    this.anchorVel.set(0, 0, 0);
    this.jostle.set(0, 0, 0);
    this.jostleVel.set(0, 0, 0);
    this.nextWriggle = this.time + 4 + Math.random() * 4;
    if (was === 'flying' || !this.visible) {
      this.hand = null;
      return;
    }
    const from = this.toLocal(this.shown, this.tmp);
    if (was === 'carried' && next === 'hooded') this.startHandoff(from, SHOULDER, true, 0.95, 0.12, 'climb');
    else if (was === 'hooded' && next === 'carried') this.startHandoff(from, SHOULDER, true, 0.8, 0.1, 'climb');
    else this.startHandoff(from, null, true, 0.5, 0.22, 'lift');
    this.fear = Math.min(this.fear, 0.25);
  }

  private startHandoff(from: THREE.Vector3, via: THREE.Vector3 | null, local: boolean, dur: number, lift: number, kind: Handoff['kind']): void {
    this.hand = { from: from.clone(), via: via ? via.clone() : null, local, t: 0, dur, lift, kind };
  }

  private toLocal(world: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return rotY(out.copy(world).sub(this.anchor), -this.anchorYaw);
  }

  private toWorld(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return rotY(out.copy(local), this.anchorYaw).add(this.anchor);
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
    /** Frantic at first, then long steady strokes: the beat of a bird that has found out it can. */
    this.flapPhase += dt * (11 - this.climb * 4);
    this.effort = 0.55 + 0.25 * Math.max(0, Math.sin(this.flapPhase));
    this.roll = ease(this.roll, Math.sin(this.time * 0.6) * 0.16, 2, dt);
    this.pitch = ease(this.pitch, -0.35 + Math.sin(this.flapPhase) * 0.06, 4, dt);
    if (this.position.y > 150) this.visible = false;
  }

  private takeOff(): void {
    this.state = 'gliding';
    this.glideT = 0;
    this.air = 2.4;
    this.settle = 0;
    this.flights++;
    this.fear = 0;
  }

  /**
   * The colt on the wing, for as long as the player can hold it there. It is not flying — it is being flown, and
   * the moment the updraft stops it sinks. This is where a player finds out they are the reason it can go home.
   */
  private soar(dt: number, wind: WindSample, child: THREE.Vector3): void {
    this.glideT += dt;
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    const room = 1 - THREE.MathUtils.smoothstep(this.position.y - ground, CEILING - 2, CEILING);
    const fading = 1 - THREE.MathUtils.smoothstep(this.glideT, GLIDE_FOR - 2.5, GLIDE_FOR);
    this.air += (wind.lift * 9 * room * fading - 3.4) * dt;
    this.air = clamp(this.air, -3.2, 3.6);
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
    this.roll = ease(this.roll, Math.sin(this.time * 0.9) * 0.2, 2, dt);
    /** Nose up while the air carries it, down as it sinks: the whole bird tells you which way it is going. */
    this.pitch = ease(this.pitch, clamp(-this.air * 0.16, -0.45, 0.35), 3, dt);
    const climbing = this.air > 0.4;
    this.flap = ease(this.flap, climbing ? 0.8 : 0.15, 3, dt);
    this.flapPhase += dt * (climbing ? 7 : 3);
    this.effort = Math.max(0, this.air) * 0.18;
    /** It looks down at the one who is watching it fly. */
    if (Math.random() < dt * 0.5) this.glanceAt(child, 1.9, 2.5);

    if (this.position.y <= ground) {
      this.position.y = ground;
      this.state = 'following';
      this.landedAt = this.time;
      this.landing = 0.75;
      this.roll = 0;
      this.pitch = 0;
      this.effort = 0;
      this.settle = 0;
      /** It goes up because of the player and comes down safe because of the player, and it knows. */
      this.bind(0.12);
    }
  }

  /**
   * The descent. Along the flock's line at first, sinking; then away from it and down. Every burst of flapping
   * lifts it a little and pitches it up, and every time the burst gives out it sags, drops a wing and slews.
   * By the end it has no control left at all and goes into the grass on its side.
   */
  private descend(dt: number): void {
    this.fallT = Math.min(1, this.fallT + dt / this.fallFor);
    const k = this.fallT;
    const phase = ((k * this.fallFor) / 2.05) * Math.PI * 2;
    const burst = THREE.MathUtils.smoothstep(Math.sin(phase), -0.1, 0.55);
    this.effort = burst;
    this.flap = 0.3 + burst * 0.7;
    this.flapPhase += dt * (5 + burst * 8);

    const u = 1 - k;
    const drop = this.fallFrom.y - this.fallTo.y;
    this.position.set(
      u * u * this.fallFrom.x + 2 * u * k * this.fallDrift.x + k * k * this.fallTo.x,
      u * u * this.fallFrom.y + 2 * u * k * this.fallDrift.y + k * k * this.fallTo.y + burst * 0.07 * u * drop,
      u * u * this.fallFrom.z + 2 * u * k * this.fallDrift.z + k * k * this.fallTo.z,
    );
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.position.y = Math.max(this.position.y, ground);

    const losing = THREE.MathUtils.smoothstep(k, 0.86, 1);
    this.roll = Math.sin(phase * 0.63 + 0.8) * (0.45 + 0.45 * k) * (1 - burst * 0.5) + losing * 1.35;
    this.pitch = lerp(0.42 + 0.2 * k, -0.4, burst) + losing * 0.3;
    this.slew = Math.sin(phase * 0.41) * 0.5;
    const travel = Math.atan2(this.fallTo.x - this.fallFrom.x, this.fallTo.z - this.fallFrom.z);
    const line = Math.atan2(this.fallDrift.x - this.fallFrom.x, this.fallDrift.z - this.fallFrom.z);
    this.yaw = line + wrapAngle(travel - line) * k + this.slew;
    if (this.time > this.nextCall) {
      this.call(false);
      this.nextCall = this.time + 1.2 + Math.random() * 0.5;
    }

    if (this.fallT >= 1) {
      this.state = 'downed';
      this.struggle = 0;
      this.settle = 1;
      this.flop = 1;
      this.roll = 0;
      this.pitch = 0;
      this.position.y = ground;
      this.fear = 0.9;
      this.puff = 1;
    }
  }

  /** On the ground: three goes at getting up, each weaker than the last, and then it stops trying. */
  private struggling(dt: number): void {
    this.struggle = Math.min(1, this.struggle + dt / 9);
    const s = this.struggle;
    let rise = 0;
    let amp = 0;
    for (const [start, strength] of [
      [0.05, 1],
      [0.38, 0.72],
      [0.7, 0.45],
    ]) {
      const w = (s - start) / 0.2;
      if (w >= 0 && w <= 1) {
        rise = Math.sin(w * Math.PI) ** 0.8 * strength;
        amp = strength;
      }
    }
    this.effort = rise;
    this.flap = rise > 0.05 ? 1 : 0;
    this.flapPhase += dt * (4 + rise * 14);
    /** The first push is what rights it; after that it is upright and simply cannot stay up. */
    this.flop = Math.max(0, Math.min(this.flop, 1 - s * 4));
    this.settle = 1 - rise;
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.position.y = ground + rise * rise * 0.1 * amp;
    if (rise > 0.3) {
      this.stride += dt * 9 * amp;
      this.position.x += Math.sin(this.yaw) * dt * 0.35 * amp;
      this.position.z += Math.cos(this.yaw) * dt * 0.35 * amp;
    }
    this.roll = ease(this.roll, rise > 0.05 ? Math.sin(this.stride * 0.5) * 0.25 * amp : 0, 4, dt);
    if (rise < 0.05 && this.time > this.nextCall) {
      this.call(false);
      this.nextCall = this.time + 2 + Math.random() * 0.8;
    }
    if (this.struggle >= 1) {
      this.state = 'fallen';
      this.settle = 1;
      this.flop = 0;
      this.fear = 0.7;
    }
  }

  /** Down and staying down, in the grass or in the dark, calling now and then and watching for the child. */
  private rest(dt: number, child: THREE.Vector3): void {
    this.settle = Math.min(1, this.settle + dt * 0.5);
    this.effort = 0;
    const gap = Math.hypot(child.x - this.position.x, child.z - this.position.z);
    /** It stays frightened until the child is there. That is what the child is for. */
    if (gap < 3) this.fear = Math.max(0.15, this.fear - dt * 0.12);
    if (this.time > this.nextCall) {
      this.call(false);
      this.nextCall = this.time + (this.fear > 0.6 ? 3.6 : 7) + Math.random() * 2;
    }
    this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0);
    this.begging(gap);
  }

  private walk(dt: number, child: THREE.Vector3): void {
    const ground = Math.max(heightAt(this.position.x, this.position.z), 0);
    if (this.hopT > 0) {
      this.hopping(dt, ground);
      return;
    }
    if (this.landing > 0) {
      /** Flares, hits the ground running, and takes two or three steps to stop. */
      this.landing -= dt;
      const run = clamp(this.landing / 0.75, 0, 1);
      this.stride += dt * 13 * run;
      this.position.x += Math.sin(this.yaw) * 1.6 * run * dt;
      this.position.z += Math.cos(this.yaw) * 1.6 * run * dt;
      this.flap = ease(this.flap, run, 5, dt);
      this.effort = ease(this.effort, 0, 6, dt);
      this.p.hurry = run;
      this.position.y = Math.max(heightAt(this.position.x, this.position.z), 0);
      if (this.landing <= 0) this.shake = 0.7;
      return;
    }
    this.effort = 0;
    const keep = 2.6 - this.bond * 1.6;
    const dx = child.x - this.position.x;
    const dz = child.z - this.position.z;
    const gap = Math.hypot(dx, dz);
    /** It is a beat behind: it notices the child has gone before it goes after them. */
    if (gap > keep + 0.6 && this.childSpeed > 1) this.notice = Math.min(0.45, this.notice + dt);
    else this.notice = Math.max(0, this.notice - dt * 2);
    const hurry = this.notice >= 0.45 || gap > keep + 4 ? clamp((gap - keep) / 5, 0, 1) : 0;
    this.p.hurry = ease(this.p.hurry, hurry, 4, dt);
    const speed = this.p.hurry * (1.5 + 2.9 * this.p.hurry);
    if (gap > 0.2 && speed > 0.05) this.yaw = easeAngle(this.yaw, Math.atan2(dx, dz), 5 + 4 * hurry, dt);
    if (speed > 0.02) {
      this.position.x += Math.sin(this.yaw) * speed * dt;
      this.position.z += Math.cos(this.yaw) * speed * dt;
      this.stride += dt * (6 + speed * 2.8);
      this.settle = Math.max(0, this.settle - dt * 2.5);
    } else {
      /** Stands a while, then sits down where it is, and sooner the more it trusts them to come back. */
      this.settle = Math.min(1, this.settle + dt * (0.12 + this.bond * 0.1));
      if (gap > 0.6 && gap < 3.5 && this.settle < 0.5) this.yaw = easeAngle(this.yaw, Math.atan2(dx, dz), 1.2, dt);
      /** Left standing, it now and then stretches up and calls for the family that is not there. */
      if (this.childSpeed < 0.3 && this.time > this.nextCall && !this.lookAt) {
        this.call(true);
        this.nextCall = this.time + 11 + Math.random() * 7;
      }
    }
    /** Wings out for balance when it runs, the way a chick that cannot fly still uses them. */
    this.flap = ease(this.flap, this.p.hurry > 0.5 ? 0.75 : 0, 5, dt);
    this.position.y = ground;
    this.begging(gap);
  }

  /** A chick flutters and reaches up when someone it trusts comes back to it, or stands right over it. */
  private begging(gap: number): void {
    if (this.time < this.nextBeg || this.fear > 0.5) return;
    const returning = this.bond > 0.3 && gap < 1.8 && this.childSpeed > 0.8;
    const overIt = gap < 1.5 && this.childSpeed < 0.3;
    if (returning || overIt) {
      this.beg = 1.4;
      this.nextBeg = this.time + (overIt ? 4.5 : 9);
    }
  }

  /** A crouch and a look up, then everything it has straight up, three times, and a stumble when it comes down. */
  private hopping(dt: number, ground: number): void {
    this.hopT -= dt;
    const t = HOP_FOR - this.hopT;
    let hop = 0;
    if (t < 0.5) {
      this.effort = 0.3;
      this.flap = ease(this.flap, 0.5, 6, dt);
      this.settle = ease(this.settle, 0.45, 8, dt);
    } else if (t < 2.05) {
      const w = (t - 0.5) / 0.5;
      const n = Math.floor(w);
      hop = Math.max(0, Math.sin((w - n) * Math.PI)) ** 1.3 * (0.13 + n * 0.11);
      this.effort = 1;
      this.flap = 1;
      this.flapPhase += dt * 17;
      this.settle = 0;
      this.roll = ease(this.roll, Math.sin(w * Math.PI * 2) * 0.2, 6, dt);
    } else {
      this.effort = ease(this.effort, 0, 8, dt);
      this.flap = ease(this.flap, 0, 6, dt);
      this.roll = ease(this.roll, 0, 5, dt);
      this.stride += dt * 8;
      if (this.hopT <= 0.3 && this.shake <= 0 && this.hopT > 0.25) this.shake = 0.6;
    }
    this.hopLift = ease(this.hopLift, hop, 30, dt);
    this.position.y = ground + this.hopLift;
    if (this.hopT <= 0) {
      this.landedAt = this.time;
      this.settle = 0;
    }
  }

  /** Riding: shifting its weight, dozing off on a long quiet stretch, and watching what the child watches. */
  private ride(dt: number): void {
    this.rideFor += dt;
    this.effort = 0;
    this.flap = ease(this.flap, 0, 6, dt);
    if (dt > 0) {
      this.tmp.copy(this.anchor).sub(this.anchorPrev).divideScalar(dt);
      const acc = this.tmp2.copy(this.tmp).sub(this.anchorVel).divideScalar(dt);
      acc.clampLength(0, 40);
      this.anchorVel.copy(this.tmp);
      /** Jostled the way a passenger is: it lags every start and stop, and settles again on a spring. */
      this.jostleVel.addScaledVector(acc, -0.15 * dt).addScaledVector(this.jostle, -90 * dt).addScaledVector(this.jostleVel, -12 * dt);
      this.jostle.addScaledVector(this.jostleVel, dt).clampLength(0, 0.12);
      const jolt = acc.length();
      this.calm = ease(this.calm, jolt < 2.5 ? 1 : 0, jolt < 2.5 ? 0.25 : 8, dt);
    }
    this.anchorPrev.copy(this.anchor);
    const speed = Math.hypot(this.anchorVel.x, this.anchorVel.z);
    const walking = clamp(speed / 2.4, 0, 1);
    const running = clamp((speed - 2.6) / 2.8, 0, 1);
    /** The child bobs with every step and the point they hold it at does not, so the bob is put back here. */
    this.gait += ((speed * dt) / (speed > 4 ? 1.5 : 1.1)) * Math.PI;
    this.bob = Math.abs(Math.cos(this.gait)) * (0.06 + 0.07 * running) * 1.12 * walking;

    const dozy = this.state === 'carried' && this.bond > 0.45 && this.rideFor > 22 && this.calm > 0.85 && this.fear < 0.3;
    this.doze = ease(this.doze, dozy ? 1 : 0, dozy ? 0.15 : 3, dt);
    if (this.time > this.nextWriggle && this.doze < 0.5 && this.hand === null) {
      this.wriggle = 0.8;
      this.nextWriggle = this.time + 7 + Math.random() * 8;
    }
    this.wriggle = Math.max(0, this.wriggle - dt);
    if (this.lookAt && this.state === 'hooded' && this.time > this.nextCall) {
      /** In the hood with the family in sight: it stretches up and calls to them, and nothing answers. */
      this.call(true);
      this.nextCall = this.time + 5 + Math.random() * 1.5;
    }
  }

  /** Everything that keeps it alive when nothing is happening: blinking, breathing, glancing, preening, shaking. */
  private live(dt: number, child: THREE.Vector3): void {
    const busy = this.state === 'falling' || this.state === 'downed' || this.state === 'leaving' || this.hopT > 0;
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT <= 0) {
      this.blinkT = 0.16;
      this.nextBlink = Math.random() < 0.25 ? 0.25 : 1.8 + Math.random() * 3.5;
    }
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      this.blink = Math.sin(clamp(this.blinkT / 0.16, 0, 1) * Math.PI);
    } else this.blink = 0;

    if (this.time > this.nextGlance && !this.lookAt) {
      const atChild = Math.random() < 0.25 + this.bond * 0.55;
      if (atChild) this.glanceAt(child, 1.9, 0);
      else {
        this.glanceChild = false;
        this.glanceYaw = (Math.random() - 0.5) * 2.2;
        this.glancePitch = (Math.random() - 0.5) * 0.6;
      }
      this.nextGlance = this.time + 1.5 + Math.random() * 4;
    }

    const idle = !busy && this.fear < 0.35 && this.hand === null && (this.settle > 0.7 || this.carried) && this.doze < 0.3;
    this.nextPreen -= dt;
    if (idle && this.nextPreen <= 0 && this.preen <= 0 && this.callT <= 0) {
      this.preen = 1.8;
      this.preenSide = Math.random() < 0.5 ? 1 : -1;
      this.nextPreen = 9 + Math.random() * 12;
    }
    this.preen = Math.max(0, this.preen - dt);
    this.nextPeck -= dt;
    if (!busy && !this.carried && this.settle < 0.4 && this.p.hurry < 0.1 && this.nextPeck <= 0 && this.fear < 0.35) {
      this.peck = 0.7;
      this.nextPeck = 5 + Math.random() * 7;
    }
    this.peck = Math.max(0, this.peck - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.beg = Math.max(0, this.beg - dt);
    this.callT = Math.max(0, this.callT - dt);
    this.fear = Math.max(0, this.fear - dt * (this.carried ? 0.08 : 0.01));
    /** Breathing hard after the fall, slow and deep asleep, quick when it is frightened. */
    this.puff = Math.max(0, this.puff - dt * 0.05);
    const rate = lerp(0.9 + this.fear * 1.4 + this.puff * 1.6 + this.effort * 1.2, 0.45, this.doze);
    this.breath += dt * rate * Math.PI * 2;
  }

  private glanceAt(target: THREE.Vector3, up: number, hold: number): void {
    this.glanceChild = true;
    this.want.copy(target).setY(target.y + up);
    if (hold > 0) this.nextGlance = this.time + hold;
  }

  /** Stretches up and opens its bill, two or three times; the sound is the story's to make. */
  private call(longing: boolean): void {
    this.callT = longing ? 1.4 : 0.8 - this.fear * 0.25;
    this.callLong = longing;
  }

  /** Works out where to draw it this frame: on the ground, on the child, or on the way between the two. */
  private place(dt: number): void {
    this.prevShown.copy(this.shown);
    const rest = this.tmp;
    let restYaw = this.yaw;
    if (this.carried) {
      const offset = this.tmp2.copy(this.state === 'hooded' ? HOOD : ARMS).add(this.jostle);
      /** Shifting its weight: it leans out to one side and back. */
      offset.x += Math.sin(this.wriggle * Math.PI * 2.5) * 0.05 * Math.min(1, this.wriggle * 3);
      this.toWorld(offset, rest);
      rest.y += this.bob;
      restYaw = this.anchorYaw + (this.state === 'carried' ? ARMS_YAW : 0);
    } else rest.copy(this.position);

    const h = this.hand;
    if (h) {
      h.t += dt;
      const k = smooth(clamp(h.t / h.dur, 0, 1));
      const from = h.local ? this.toWorld(h.from, this.from) : this.from.copy(h.from);
      const via = h.via ? (h.local ? this.toWorld(h.via, this.to) : this.to.copy(h.via)) : null;
      if (via) {
        const u = 1 - k;
        this.shown.set(
          u * u * from.x + 2 * u * k * via.x + k * k * rest.x,
          u * u * from.y + 2 * u * k * via.y + k * k * rest.y,
          u * u * from.z + 2 * u * k * via.z + k * k * rest.z,
        );
      } else {
        this.shown.lerpVectors(from, rest, k);
        this.shown.y += Math.sin(k * Math.PI) * h.lift;
      }
      /** Faces the way it is going on the climb, and turns to its seat as it arrives. */
      const going = this.tmp2.copy(rest).sub(from);
      const travel = Math.hypot(going.x, going.z) > 0.15 ? Math.atan2(going.x, going.z) : restYaw;
      this.shownYaw = easeAngle(this.shownYaw, k < 0.6 && h.kind !== 'lift' ? travel : restYaw, 9, dt);
      if (h.t >= h.dur) {
        this.hand = null;
        if (h.kind === 'hop') this.shake = 0.6;
      }
    } else {
      this.shown.copy(rest);
      this.shownYaw = this.carried ? easeAngle(this.shownYaw, restYaw, 14, dt) : restYaw;
    }
  }

  private pose(dt: number): void {
    const t = this.time;
    const n = this.nodes;
    const p = this.p;
    const s = this.state;
    const h = this.hand;
    const flying = s === 'falling' || s === 'gliding' || s === 'leaving';
    const riding = this.carried && !h;
    const climbing = h !== null && h.kind === 'climb';
    const lifting = h !== null && (h.kind === 'lift' || h.kind === 'hop');
    const dashing = h !== null && h.kind === 'dash';
    const afoot = s === 'following' && !h && this.landing <= 0;
    const settled = this.grounded || s === 'following' ? this.settle : 0;

    /** What it is doing, as weights; every one eased so that no change of state is a cut. */
    const hunch = this.fear * (this.carried ? 0.35 : 1) * (1 - this.effort);
    const calling = this.callT > 0 ? Math.sin(Math.min(1, this.callT / (this.callLong ? 1.4 : 0.8 - this.fear * 0.25)) * Math.PI) ** 0.5 : 0;
    p.sit = ease(p.sit, riding ? (s === 'hooded' ? 0.75 : 0.9) : flying || h ? (lifting ? 0.4 : 0) : settled, riding ? 3 : 4, dt);
    p.held = ease(p.held, riding || climbing ? 1 : 0, 5, dt);
    p.hooded = ease(p.hooded, s === 'hooded' && !h ? 1 : 0, 4, dt);
    p.hunch = ease(p.hunch, hunch, 2, dt);
    p.sleep = ease(p.sleep, this.doze, 1.5, dt);
    p.reach = ease(p.reach, flying || dashing ? 1 : 0, 4, dt);
    const alert = clamp((this.lookAt ? 0.5 : 0) + this.hope * 0.7 + calling * 1.2 + this.beg * 0.5 + (this.hopT > HOP_FOR - 0.5 ? 0.9 : 0), 0, 1);
    p.tall = ease(p.tall, alert * (1 - p.reach), 5, dt);
    const drowsy = settled * (0.55 + this.bond * 0.2) * (1 - this.fear) * (1 - alert);
    p.curl = ease(p.curl, s === 'falling' ? 1 - this.effort : drowsy + this.doze * 0.6, 3, dt);
    const spread =
      clamp(
        this.flap * 0.35 +
          this.glide +
          this.effort * 1.3 +
          this.hope * 0.55 +
          (flying ? 1 : 0) +
          (climbing || lifting ? 0.45 : 0) +
          this.beg * 0.4 +
          (this.shake > 0 ? 0.35 : 0),
        0,
        1,
      ) *
      (1 - p.hunch * 0.6 * (1 - this.effort));
    p.spread = ease(p.spread, spread, 7, dt);
    const shaking = this.shake > 0 ? Math.sin(t * 36) * Math.min(1, this.shake * 4) * 0.5 : 0;
    const tremble = p.hunch * 0.6 + this.fear * (this.carried ? 0.15 : 0.3);

    this.root.position.copy(this.shown);
    this.root.scale.setScalar(SIZE);
    this.root.rotation.order = 'YXZ';
    let rootPitch = flying ? this.pitch : 0;
    if (riding || climbing) rootPitch = lerp(rootPitch, s === 'hooded' && !climbing ? -0.22 : climbing ? 0.3 : -0.28, p.held);
    if (lifting) rootPitch = -0.15;
    let rootRoll = flying ? this.roll : this.roll * (1 - p.sit * 0.5);
    rootRoll += this.flop * 1.25 + shaking * 0.35 + Math.sin(t * 41) * 0.025 * tremble;
    this.root.rotation.set(rootPitch, this.shownYaw, rootRoll);

    /** Legs first: standing, the body sits on whichever leg is planted, so the feet never sink or float. */
    const tuck = Math.max(p.sit, p.held);
    let reach = 0;
    for (const [thigh, shin, foot, side, phase] of [
      [THIGH_L, SHIN_L, FOOT_L, 1, 0],
      [THIGH_R, SHIN_R, FOOT_R, -1, Math.PI],
    ] as const) {
      const stepping = afoot || this.landing > 0 || (s === 'downed' && this.effort > 0.3) ? 1 - p.sit : 0;
      const swing = Math.sin(this.stride + phase) * stepping;
      const up = Math.max(0, Math.cos(this.stride + phase)) * stepping;
      let th = 0.35 - swing * 0.5 - up * 0.35;
      let sh = -0.7 + up * 1.15 + swing * 0.15;
      let ft = -(th + sh) + up * 0.55;
      /** Folded away to nothing: the ankle goes back and the foot lies forward under the belly. */
      th = lerp(th, 1.25, tuck);
      sh = lerp(sh, -2.65, tuck);
      ft = lerp(ft, 1.35, tuck);
      /** Every push leaves the legs hanging: they straighten as it comes off the ground and fold as it drops. */
      const dangle = clamp(this.effort + (lifting ? 0.6 : 0) + this.hopLift * 4, 0, 1) * (1 - p.held * 0.7);
      th = lerp(th, 0.55, dangle);
      sh = lerp(sh, -0.3, dangle);
      ft = lerp(ft, 0.5, dangle);
      const trail = clamp(this.glide + (s === 'falling' || s === 'leaving' || dashing ? 1 : 0), 0, 1);
      th = lerp(th, 1.45, trail);
      sh = lerp(sh, -0.15, trail);
      ft = lerp(ft, 1.4, trail);
      if (this.landing > 0) {
        const flare = clamp(this.landing / 0.75, 0, 1);
        th = lerp(th, -0.5, flare * 0.6);
        sh = lerp(sh, -0.4, flare * 0.6);
      }
      if (climbing) {
        th = 0.2 + Math.sin(t * 22 + phase) * 0.5;
        sh = -1.0 + Math.cos(t * 22 + phase) * 0.5;
        ft = 0.6;
      }
      n[thigh].rotation.set(th, 0, -side * 0.06 * (1 - tuck));
      n[shin].rotation.x = sh;
      n[foot].rotation.x = ft;
      const planted = FLOOR / SIZE + 0.036 + THIGH * Math.cos(th) + SHIN * Math.cos(th + sh);
      reach = Math.max(reach, planted);
    }

    const stand = 1 - tuck;
    const bodyRest = riding || climbing ? 0.11 : lerp(0.072, reach, stand);
    const breathe = Math.sin(this.breath) * (0.012 + this.fear * 0.008 + this.puff * 0.01);
    const body = n[BODY];
    body.position.y = bodyRest + this.glide * 0.06 + this.effort * 0.02 + breathe * 0.4 + (afoot ? Math.abs(Math.cos(this.stride)) * 0.006 * p.hurry : 0);
    body.position.z = 0;
    body.rotation.x =
      -0.04 + p.sit * 0.04 - p.hunch * 0.12 + (this.peck > 0 ? Math.sin(Math.min(1, this.peck / 0.7) * Math.PI) * 0.25 : 0) + p.hurry * 0.12 - this.beg * 0.1;
    body.rotation.z =
      Math.sin(this.flapPhase + 1.2) * 0.05 * Math.max(flying ? 1 : 0, this.effort) + Math.sin(this.wriggle * Math.PI * 2.5) * 0.12 * Math.min(1, this.wriggle * 3);
    body.scale.set(1 + breathe * 0.6, 1 + breathe * 1.2, 1 + breathe * 0.8);

    /** The neck is the whole character: the S of a bird at ease, tucked back into the shoulders, or stretched. */
    let a = -0.35;
    let b = 0.45;
    let head = 0;
    a = lerp(a, -1.2, p.curl);
    b = lerp(b, 1.6, p.curl);
    head = lerp(head, 0.15, p.curl);
    a = lerp(a, -0.08, p.tall);
    b = lerp(b, 0.02, p.tall);
    head = lerp(head, -0.2 - calling * 0.45, p.tall);
    /** Frightened, the head is pulled down into the shoulders: the neck folds flat instead of standing. */
    a = lerp(a, -1.35, p.hunch);
    b = lerp(b, 2.1, p.hunch);
    head = lerp(head, 0.25, p.hunch);
    const heldNeck = p.held * (1 - p.curl) * (1 - p.sleep);
    a = lerp(a, -0.15 + p.hooded * 0.05, heldNeck);
    b = lerp(b, 0.05, heldNeck);
    head = lerp(head, -0.1, heldNeck);
    a = lerp(a, -1.5, p.sleep);
    b = lerp(b, 1.9, p.sleep);
    head = lerp(head, 0.5, p.sleep);
    a = lerp(a, 1.02, p.reach);
    b = lerp(b, 0.38, p.reach);
    head = lerp(head, 0, p.reach);
    if (this.peck > 0) {
      const pk = Math.sin(Math.min(1, this.peck / 0.7) * Math.PI);
      a += pk * 0.9;
      b += pk * 0.5;
      head += pk * 0.5 + Math.sin(t * 40) * 0.08 * pk;
    }
    const sway = Math.sin(t * 1.05) * 0.02 * (1 - p.reach) + (afoot ? Math.sin(this.stride * 2 + 0.7) * 0.05 * p.hurry : 0);
    /** A wingbeat pulls the head down a little; a passenger's head lags every jolt the child gives it. */
    const jolt = this.carried ? this.jostle.z * 3 : 0;
    a += sway + jolt;
    b += sway * 0.6 - this.effort * Math.max(0, Math.sin(this.flapPhase)) * 0.08;
    n[NECK_A].rotation.x = a;
    n[NECK_B].rotation.x = b;

    /** Where the head points: the target it was given, the child, or wherever it last glanced. */
    let wantYaw = this.glanceYaw;
    let wantPitch = this.glancePitch;
    const target = this.lookAt ?? (this.glanceChild ? this.want : null);
    if (target) {
      this.to.copy(target);
      /** Told to watch someone standing near it, it looks at their face, not their boots. */
      const near = Math.hypot(target.x - this.shown.x, target.z - this.shown.z) < 4;
      if (this.lookAt && near && Math.abs(target.y - Math.max(heightAt(target.x, target.z), 0)) < 0.6) this.to.y += 1.9;
      this.to.sub(this.eye(this.tmp2));
      wantYaw = clamp(wrapAngle(Math.atan2(this.to.x, this.to.z) - this.shownYaw), -1.4, 1.4);
      wantPitch = -clamp(Math.atan2(this.to.y, Math.hypot(this.to.x, this.to.z)), -1.1, 0.9) - rootPitch;
    }
    if (this.preen > 0) {
      const pr = Math.sin(Math.min(1, this.preen / 1.8) * Math.PI) ** 0.6;
      wantYaw = lerp(wantYaw, 1.55 * this.preenSide, pr);
      wantPitch = lerp(wantPitch, 0.85 + Math.sin(t * 34) * 0.1, pr);
    }
    if (this.doze > 0.5) {
      wantYaw = lerp(wantYaw, 1.5, p.sleep);
      wantPitch = lerp(wantPitch, 0.4, p.sleep);
    }
    if (this.callT > 0) {
      wantYaw *= 1 - calling * 0.6;
      wantPitch = lerp(wantPitch, this.callLong ? -0.7 : -0.35, calling);
    }
    const rate = this.lookAt ? 6 : 5;
    this.headYaw = ease(this.headYaw, wantYaw * (1 - p.reach * 0.7), rate, dt);
    this.headPitch = ease(this.headPitch, wantPitch * (1 - p.reach * 0.6), rate, dt);
    const turn = this.headYaw * 0.45;
    n[NECK_B].rotation.y = turn;
    const headPitch = head + this.headPitch - a - b + Math.sin(t * 33) * 0.04 * tremble;
    n[HEAD].rotation.set(headPitch, this.headYaw - turn + Math.sin(t * 29) * 0.05 * tremble, Math.sin(t * 0.7) * 0.04 * (1 - p.reach));
    /** The bill opens on each note of a call, and a little with every hard breath after the fall. */
    const note = this.callLong ? Math.max(0, Math.sin(this.callT * Math.PI * 1.45)) : Math.max(0, Math.sin(this.callT * Math.PI * 3.8));
    n[JAW].rotation.x = calling * note * 0.42 + this.puff * 0.08 * Math.max(0, Math.sin(this.breath));
    /** The tuft trails what the head does: flicks up as it drops, lies down as it rises. */
    const vy = dt > 0 ? (this.shown.y - this.prevShown.y) / dt : 0;
    n[TUFT].rotation.x = -0.1 + this.tuft.step(clamp(vy * 0.35 + this.headPitch * 0.3, -0.7, 0.7), 140, 11, dt) + Math.sin(t * 27) * 0.06 * tremble;
    n[TAIL].rotation.x = this.beg * Math.sin(t * 15) * 0.25 + this.bond * 0.15 * (1 - p.hunch) - p.hunch * 0.3 - this.glide * 0.3 - p.sleep * 0.15;

    this.flapPhase += dt * (5 + this.glide * 3 + (afoot ? p.hurry * 6 : 0));
    /** Folded, the arm lies along the flank and the hand tucks back over the rump; spread, the hand whips a beat late. */
    let power = p.spread * (1 - this.glide * 0.8) * (this.effort > 0.02 || this.flap > 0.3 || flying ? 1 : 0.35);
    let beatPhase = this.flapPhase;
    if (this.beg > 0 || climbing) {
      beatPhase = t * 24;
      power = Math.max(power, 0.35);
    }
    const beat = Math.sin(beatPhase) * power;
    const lag = Math.sin(beatPhase - 0.75) * power;
    const sweep = lerp(1.35, 0.1, p.spread) + p.hunch * 0.12;
    const roll = lerp(-0.22 - p.hunch * 0.15, 0.15, p.spread) + beat * 0.95 + shaking * 0.4 + (this.landing > 0 ? clamp(this.landing / 0.75, 0, 1) * 0.6 : 0);
    const handSweep = lerp(0.9, -0.05, p.spread) - Math.max(0, lag) * 0.3;
    const handRoll = lerp(0.1, 0, p.spread) + lag * 0.55 + this.glide * Math.sin(t * 3.1) * 0.06;
    const twist = -this.glide * 0.12 + this.effort * 0.1 * Math.max(0, Math.sin(this.flapPhase));
    const preenLift = this.preen > 0 ? Math.sin(Math.min(1, this.preen / 1.8) * Math.PI) * 0.25 : 0;
    n[WING_L].rotation.set(twist, sweep, roll + (this.preenSide > 0 ? preenLift : 0));
    n[WING_R].rotation.set(twist, -sweep, -roll - (this.preenSide < 0 ? preenLift : 0));
    n[HAND_L].rotation.set(0, handSweep, handRoll);
    n[HAND_R].rotation.set(0, -handSweep, -handRoll);

    this.mat.uniforms.uBlink.value = Math.max(this.blink, p.sleep) - this.fear * 0.2 * (1 - p.sleep);

    this.root.updateMatrixWorld(true);
    for (let i = 0; i < BONES; i++) this.bones[i].copy(n[i].matrixWorld);
  }
}

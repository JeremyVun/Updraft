import * as THREE from 'three';
import { ease } from '../motion';
import { BODY, FOOT_L, FOOT_R, HEAD, JAW, NECK, SHIN, SHIN_L, SHIN_R, SIZE, SKELETON, SOLE, TAIL, THIGH, THIGH_L, THIGH_R } from './body';
import type { Act } from './mind';
import type { MoveKind, Seat } from './ride';
import { poseWings } from './wings';

/**
 * Everything the cygnet's body is asked to show this frame. The cygnet decides all of it (what it is doing, how it
 * feels, where it is looking); this file only knows how each of those looks. Nothing in here may switch: every
 * drive is turned into an eased weight before it touches a bone, so no change of mind is ever a cut.
 */
export interface Drives {
  time: number;
  carried: boolean;
  seat: Seat | null;
  inHands: boolean;
  move: MoveKind | null;
  /** The passenger's lag along its own length, from the seat under it. */
  jostle: number;
  falling: boolean;
  gliding: boolean;
  leaving: boolean;
  /** Walking or standing on its own feet, as opposed to down in the grass, riding or flying. */
  afoot: boolean;
  downed: boolean;
  /** Swimming, and standing on something that is not the ground. */
  afloat: boolean;
  perched: boolean;
  /** How far it has sat down where it stands, 0..1. */
  settle: number;
  fear: number;
  bond: number;
  cold: number;
  effort: number;
  flap: number;
  flapPhase: number;
  glide: number;
  hope: number;
  hopLift: number;
  crouch: number;
  /** 1 at touchdown, running out to 0 as it stops. */
  landing: number;
  /** Down on its breast, tail up, 0..1. */
  faceplant: number;
  flop: number;
  doze: number;
  wriggle: number;
  puff: number;
  stride: number;
  hurry: number;
  pitch: number;
  roll: number;
  beg: number;
  call: { env: number; note: number; long: boolean };
  /** Where it wants its head pointed, relative to the way its body faces; `firm` when the story told it where to look. */
  gaze: { yaw: number; pitch: number; firm: boolean; wandering: boolean };
  act: Act | null;
  actK: number;
  actEnv: number;
  actSide: number;
  /** The way a reaction is aimed, relative to the way its body faces. */
  actYaw: number;
  breath: number;
  blink: number;
  /** The wind on it in its own frame (x to its left, z ahead), units per second. */
  wind: { x: number; z: number };
  /**
   * Walking on planted feet: where each ankle has to be (left, then right) in the frame of its origin, and how the
   * body rides over them. `on` is whether any of this applies.
   */
  gait: { on: boolean; feet: [{ x: number; y: number; z: number }, { x: number; y: number; z: number }]; sway: number; roll: number; twist: number; dip: number; pace: number };
}

export interface Posed {
  /** How far the middle of the body is above the origin, in world units. */
  bodyLift: number;
  rootPitch: number;
  rootRoll: number;
  /** For the surface: eyes, down, wings. */
  blink: number;
  fluff: number;
  sleek: number;
  wingOpen: number;
}

const FLOOR = 0.006 * SIZE;
/** Where the hips are on the body, from the skeleton, and how high the body stands when both legs are comfortably bent. */
const HIP = SKELETON.find(([bone]) => bone === THIGH_L)![2];
const STANDING = -HIP[1] + (THIGH + SHIN) * 0.75 + SOLE;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Poser {
  private readonly p = {
    afoot: 1,
    beg: 0,
    climb: 0,
    lifted: 0,
    sit: 0,
    held: 0,
    stowed: 0,
    hunch: 0,
    curl: 0,
    tall: 0,
    reach: 0,
    spread: 0,
    sleep: 0,
    land: 0,
    plant: 0,
    swim: 0,
    walk: 0,
  };
  /** One eased weight per thing it can be doing, so one act can fade out while the next fades in. */
  private readonly acts = new Map<Act, number>();
  private headYaw = 0;
  private headPitch = 0;
  private neckYaw = 0;
  private readonly unturn = new THREE.Quaternion();
  private readonly ankle = new THREE.Vector3();
  private readonly out: Posed = { bodyLift: 0.11, rootPitch: 0, rootRoll: 0, blink: 0, fluff: 0, sleek: 0, wingOpen: 0 };

  update(n: THREE.Object3D[], d: Drives, dt: number): Posed {
    const t = d.time;
    const p = this.p;
    const flying = d.falling || d.gliding || d.leaving;
    const climbing = d.move === 'climb';
    const lifting = d.inHands || d.move === 'lift' || d.move === 'hop';
    const dashing = d.move === 'dash';
    const riding = d.carried && d.move === null && !d.inHands;
    const afoot = d.afoot && d.move === null && d.landing <= 0;

    for (const name of ACTS) this.acts.set(name, ease(this.acts.get(name) ?? 0, d.act === name ? d.actEnv : 0, 10, dt));
    const act = (name: Act) => this.acts.get(name) ?? 0;

    const hunch = clamp(d.fear * (d.carried ? 0.35 : 1) * (1 - d.effort) + act('flinch') * 0.8 + act('brace') * 0.45, 0, 1);
    p.sit = ease(p.sit, riding ? (d.seat === 'satchel' ? 0.6 : 0.9) : flying || d.move ? (lifting ? 0.4 : 0) : d.settle, riding ? 3 : 4, dt);
    p.held = ease(p.held, riding || climbing ? 1 : 0, 5, dt);
    p.stowed = ease(p.stowed, d.seat === 'satchel' && riding ? 1 : 0, 4, dt);
    p.hunch = ease(p.hunch, hunch, act('flinch') > p.hunch ? 14 : 2, dt);
    p.sleep = ease(p.sleep, d.doze, 1.5, dt);
    p.reach = ease(p.reach, flying || dashing ? 1 : 0, 4, dt);
    p.beg = ease(p.beg, Math.min(1, d.beg), 8, dt);
    p.climb = ease(p.climb, climbing ? 1 : 0, 7, dt);
    p.lifted = ease(p.lifted, lifting && !d.inHands ? 1 : 0, 9, dt);
    p.land = ease(p.land, d.landing, 14, dt);
    p.plant = ease(p.plant, d.faceplant, 16, dt);
    p.swim = ease(p.swim, d.afloat ? 1 : 0, 5, dt);
    const alert = clamp((d.gaze.firm ? 0.5 : 0) + d.hope * 0.7 + d.call.env * 1.2 + p.beg * 0.5 + d.crouch * 0.9 + act('into-wind') * 0.6 + act('ask') + act('peer') + act('look-about') * 0.4, 0, 1);
    p.tall = ease(p.tall, alert * (1 - p.reach), 5, dt);
    const drowsy = d.settle * (0.55 + d.bond * 0.2) * (1 - d.fear) * (1 - alert);
    p.curl = ease(p.curl, d.falling ? 1 - d.effort : drowsy + d.doze * 0.6, 3, dt);
    const shake = act('shake');
    const spread =
      clamp(
        d.flap * 0.35 + d.glide + d.effort * 1.3 + d.hope * 0.55 + (flying ? 1 : 0) + (climbing || lifting ? 0.45 : 0) + p.beg * 0.4 + shake * 0.35 + act('ask') * 0.6 + act('into-wind') * 0.3 + act('bowled') * 0.8 + p.plant * 0.7,
        0,
        1,
      ) *
      (1 - p.hunch * 0.6 * (1 - d.effort));
    p.spread = ease(p.spread, spread, 7, dt);
    const shaking = Math.sin(t * 36) * shake * 0.5;
    const tremble = p.hunch * 0.6 + d.fear * (d.carried ? 0.15 : 0.3) + d.cold * 0.35;

    /** A seat tips it back by itself; only the climb and a hop add anything of their own. */
    let rootPitch = (flying ? d.pitch : 0) - 0.55 * p.climb - 0.15 * p.lifted + 0.85 * p.plant;
    let rootRoll = flying ? d.roll : d.roll * (1 - p.sit * 0.5);
    rootRoll += d.flop * 1.25 + shaking * 0.35 + Math.sin(t * 41) * 0.025 * tremble;
    /** Braced, it leans into the wind; knocked over, it goes with it. */
    const blown = Math.hypot(d.wind.x, d.wind.z) > 0.2 ? 1 : 0;
    const wx = blown ? d.wind.x / Math.hypot(d.wind.x, d.wind.z) : 0;
    const wz = blown ? d.wind.z / Math.hypot(d.wind.x, d.wind.z) : 0;
    rootRoll += (act('bowled') * 1.0 - act('brace') * 0.16 - act('into-wind') * 0.06) * wx * -1;
    rootPitch += (act('bowled') * 0.5 - act('brace') * 0.16 - act('into-wind') * 0.08) * wz;

    const tuck = Math.max(p.sit, p.held);
    const stretch = act('stretch');
    p.walk = ease(p.walk, d.gait.on && afoot && d.faceplant <= 0 ? 1 : 0, 8, dt);
    const walk = p.walk * (1 - tuck);
    const bodyY = lerp(0.072, STANDING - d.gait.dip, 1 - tuck);
    const nibble = act('nibble');
    const body = n[BODY];
    body.rotation.x = -0.04 + p.sit * 0.04 - p.hunch * 0.12 + nibble * 0.25 + d.hurry * 0.12 - p.beg * 0.1 + stretch * 0.12;
    body.rotation.z =
      Math.sin(d.flapPhase + 1.2) * 0.05 * Math.max(flying ? 1 : 0, d.effort) +
      Math.sin(d.wriggle * Math.PI * 2.5) * 0.12 * Math.min(1, d.wriggle * 3) +
      act('peer') * 0.22 * d.actSide +
      d.gait.roll * walk;
    body.rotation.y = d.gait.twist * walk + Math.sin(d.stride) * 0.06 * p.swim;
    this.unturn.setFromEuler(body.rotation).invert();
    let reach = 0;
    for (const [thigh, shin, foot, side, phase] of [
      [THIGH_L, SHIN_L, FOOT_L, 1, 0],
      [THIGH_R, SHIN_R, FOOT_R, -1, Math.PI],
    ] as const) {
      const stepping = afoot || d.landing > 0 || (d.downed && d.effort > 0.3) || act('bowled') > 0.2 ? 1 - p.sit : 0;
      const swing = Math.sin(d.stride + phase) * stepping;
      const up = Math.max(0, Math.cos(d.stride + phase)) * stepping;
      let th = 0.35 - swing * 0.5 - up * 0.35;
      let sh = -0.7 + up * 1.15 + swing * 0.15;
      let ft = -(th + sh) + up * 0.55;
      /** Folded away to nothing: the ankle goes back and the foot lies forward under the belly. */
      th = lerp(th, 1.25, tuck);
      sh = lerp(sh, -2.65, tuck);
      ft = lerp(ft, 1.35, tuck);
      /** Every push leaves the legs hanging: they straighten as it comes off the ground and fold as it drops. */
      const dangle = clamp(d.effort + (lifting ? 0.6 : 0) + d.hopLift * 4, 0, 1) * (1 - p.held * 0.7);
      th = lerp(th, 0.55, dangle);
      sh = lerp(sh, -0.3, dangle);
      ft = lerp(ft, 0.5, dangle);
      const trail = clamp(d.glide + (d.falling || d.leaving || dashing ? 1 : 0), 0, 1);
      th = lerp(th, 1.45, trail);
      sh = lerp(sh, -0.15, trail);
      ft = lerp(ft, 1.4, trail);
      th = lerp(th, -0.5, p.land * 0.6);
      sh = lerp(sh, -0.4, p.land * 0.6);
      /** In the hands its feet paddle at nothing; on the climb they scrabble for the coat. */
      const paddle = d.inHands ? 0.35 : 0;
      th += Math.sin(t * 9 + phase) * paddle * 0.4;
      sh += Math.cos(t * 9 + phase) * paddle * 0.3;
      th = lerp(th, 0.2 + Math.sin(t * 22 + phase) * 0.5, p.climb);
      sh = lerp(sh, -1.0 + Math.cos(t * 22 + phase) * 0.5, p.climb);
      ft = lerp(ft, 0.6, p.climb);
      /** Afloat, the legs trail and push alternately, mostly out of sight. */
      th = lerp(th, 0.95 + Math.sin(d.stride + phase) * 0.45, p.swim);
      sh = lerp(sh, -0.6 - Math.cos(d.stride + phase) * 0.4, p.swim);
      ft = lerp(ft, 0.9 + Math.sin(d.stride + phase) * 0.5, p.swim);
      /** A stretch: one leg straight out behind, with the wing on the same side. */
      if (side === d.actSide) {
        th = lerp(th, 1.3, stretch * (1 - tuck));
        sh = lerp(sh, -0.25, stretch * (1 - tuck));
        ft = lerp(ft, 1.0, stretch * (1 - tuck));
      }
      let splay = -side * (0.06 + act('brace') * 0.2) * (1 - tuck);
      if (walk > 0.001) {
        /** The ankle goes where the foot was planted, whatever the body is doing over it. */
        const at = d.gait.feet[side === 1 ? 0 : 1];
        /** In the body's own frame, because the hips roll and swing with the waddle and the foot must not. */
        const to = this.ankle.set(at.x - d.gait.sway * walk, at.y + SOLE - bodyY, at.z).applyQuaternion(this.unturn);
        const dx = to.x - HIP[0] * side;
        const dy = Math.min(-0.02, to.y - HIP[1]);
        const dz = to.z - HIP[2];
        const r = clamp(Math.hypot(dy, dz), Math.abs(THIGH - SHIN) + 0.004, THIGH + SHIN - 0.002);
        const line = Math.atan2(-dz, -dy);
        const hipAngle = Math.acos(clamp((THIGH * THIGH + r * r - SHIN * SHIN) / (2 * THIGH * r), -1, 1));
        const knee = Math.acos(clamp((THIGH * THIGH + SHIN * SHIN - r * r) / (2 * THIGH * SHIN), -1, 1));
        const ikTh = line + hipAngle;
        const ikSh = -(Math.PI - knee);
        th = lerp(th, ikTh, walk);
        sh = lerp(sh, ikSh, walk);
        /** Flat on the ground while it is down; toes trailing as it comes up, reaching as it goes down. */
        const lifted = clamp((at.y - 0.002) / 0.05, 0, 1);
        ft = lerp(ft, -(ikTh + ikSh) + lifted * 0.7, walk);
        splay = lerp(splay, Math.atan2(dx, -dy), walk);
      }
      n[thigh].rotation.set(th, 0, splay);
      n[shin].rotation.x = sh;
      n[foot].rotation.x = ft;
      if (side !== d.actSide || stretch < 0.05) reach = Math.max(reach, FLOOR / SIZE + 0.036 + THIGH * Math.cos(th) + SHIN * Math.cos(th + sh));
    }

    const stand = 1 - tuck;
    /** On its own feet the body stands on whichever leg is planted; carried, it rests on its keel. Eased between the two, never switched. */
    p.afoot = ease(p.afoot, d.carried ? 0 : 1, 9, dt);
    /** Afloat it rides with the water a little under halfway up its body. */
    const bodyRest = lerp(lerp(0.11, lerp(lerp(0.072, reach, stand), bodyY, p.walk), p.afoot), 0.035, p.swim);
    const breathe = Math.sin(d.breath) * (0.012 + d.fear * 0.008 + d.puff * 0.01);
    body.position.y =
      bodyRest +
      d.glide * 0.06 +
      d.effort * 0.02 +
      breathe * 0.4 -
      (act('flinch') * 0.03 + act('brace') * 0.035) * p.afoot +
      Math.abs(Math.sin(t * 11)) * 0.02 * act('ask') +
      (afoot ? Math.abs(Math.cos(d.stride)) * 0.006 * d.hurry : 0);
    body.position.x = d.gait.sway * walk;
    body.position.z = 0;
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
    head = lerp(head, -0.2 - d.call.env * 0.45, p.tall);
    /** Frightened, the head is pulled down into the shoulders: the neck folds flat instead of standing. */
    a = lerp(a, -1.35, p.hunch);
    b = lerp(b, 2.1, p.hunch);
    head = lerp(head, 0.25, p.hunch);
    const heldNeck = p.held * (1 - p.curl) * (1 - p.sleep);
    /** In the arms the neck lies out along the child; up in the bag it sits back on itself in an S, head level. */
    a = lerp(a, lerp(-0.15, -0.62, p.stowed), heldNeck);
    b = lerp(b, lerp(0.05, 0.72, p.stowed), heldNeck);
    head = lerp(head, lerp(-0.1, -0.24, p.stowed), heldNeck);
    a = lerp(a, -1.5, p.sleep);
    b = lerp(b, 1.9, p.sleep);
    head = lerp(head, 0.5, p.sleep);
    a = lerp(a, 1.02, p.reach);
    b = lerp(b, 0.38, p.reach);
    head = lerp(head, 0, p.reach);
    /** Down to the grass, and down into its own breast. */
    a += nibble * 0.9 + act('preen-breast') * 0.35 + stretch * 0.55 + act('brace') * 0.5;
    b += nibble * 0.5 + act('preen-breast') * 1.5 + stretch * 0.1 + act('brace') * 0.3;
    head += nibble * (0.5 + Math.sin(t * 40) * 0.08) + act('preen-breast') * (0.7 + Math.sin(t * 31) * 0.1) - act('yawn') * 0.4 - stretch * 0.3;
    a -= act('preen-back') * 0.75;
    /** On its breast the neck is flung out along the ground in front of it. */
    a = lerp(a, 0.75, p.plant);
    b = lerp(b, -0.55, p.plant);
    head = lerp(head, -0.2, p.plant);
    const sway = Math.sin(t * 1.05) * 0.02 * (1 - p.reach) + (afoot ? Math.sin(d.stride * 2 + 0.7) * 0.05 * d.hurry : 0);
    /** A wingbeat pulls the head down a little; a passenger's head lags every jolt the child gives it. */
    a += sway + d.jostle * 3;
    b += sway * 0.6 - d.effort * Math.max(0, Math.sin(d.flapPhase)) * 0.08;
    n[NECK[0]].rotation.x = a * 0.55;
    n[NECK[1]].rotation.x = a * 0.45;
    n[NECK[2]].rotation.x = b * 0.5;
    n[NECK[3]].rotation.x = b * 0.5;

    /** Where the head points. An act that uses the head takes it over; otherwise it goes where the mind is looking. */
    let wantYaw = d.gaze.yaw;
    let wantPitch = d.gaze.pitch - rootPitch;
    const preenWing = act('preen-wing');
    wantYaw = lerp(wantYaw, 1.55 * d.actSide, preenWing);
    wantPitch = lerp(wantPitch, 0.85 + Math.sin(t * 34) * 0.1, preenWing);
    wantYaw = lerp(wantYaw, 2.5 * d.actSide, act('preen-back'));
    wantPitch = lerp(wantPitch, 0.55 + Math.sin(t * 34) * 0.08, act('preen-back'));
    wantYaw = lerp(wantYaw, 0, Math.max(act('preen-breast'), nibble, act('yawn')));
    wantYaw = lerp(wantYaw, Math.sin(d.actK * Math.PI * 2) * 1.25, act('look-about'));
    wantYaw = lerp(wantYaw, clamp(d.actYaw, -1.3, 1.3), act('snap'));
    /** In the arms its left side is against the child, so that is where a nuzzle goes: up under their chin. */
    wantYaw = lerp(wantYaw, 1.35, act('nuzzle'));
    wantPitch = lerp(wantPitch, -0.55 + Math.sin(t * 7) * 0.12, act('nuzzle'));
    wantYaw = lerp(wantYaw, -0.5 * d.actSide, act('peer'));
    wantYaw = lerp(wantYaw, 1.5, p.sleep);
    wantPitch = lerp(wantPitch, 0.4, p.sleep);
    wantYaw *= 1 - d.call.env * 0.6;
    wantPitch = lerp(wantPitch, d.call.long ? -0.7 : -0.35, d.call.env);
    /** The head gets there first and the neck comes round after it, which is what makes a look a look. */
    const quick = d.gaze.firm || act('snap') > 0.1 ? 11 : 7.5;
    this.headYaw = ease(this.headYaw, wantYaw * (1 - p.reach * 0.7), quick, dt);
    this.headPitch = ease(this.headPitch, wantPitch * (1 - p.reach * 0.6), quick, dt);
    this.neckYaw = ease(this.neckYaw, this.headYaw * 0.5, 3.5, dt);
    n[NECK[1]].rotation.y = this.neckYaw * 0.3;
    n[NECK[2]].rotation.y = this.neckYaw * 0.35;
    n[NECK[3]].rotation.y = this.neckYaw * 0.35;
    const snap = act('snap') * Math.max(0, Math.sin(d.actK * Math.PI * 2 - 0.6));
    const headPitch = head + this.headPitch - a - b + Math.sin(t * 33) * 0.04 * tremble + snap * 0.2;
    n[HEAD].rotation.set(headPitch, this.headYaw - this.neckYaw - d.gait.twist * walk * 0.8 + Math.sin(t * 29) * 0.05 * tremble - shaking * 0.5, Math.sin(t * 0.7) * 0.04 * (1 - p.reach) + act('nuzzle') * 0.3 - d.gait.roll * walk * 0.8);
    /** The bill opens on each note of a call, with every hard breath after the fall, in a yawn, and to snap at what goes past. */
    n[JAW].rotation.x = d.call.env * d.call.note * 0.42 + d.puff * 0.08 * Math.max(0, Math.sin(d.breath)) + act('yawn') * 0.5 + snap * 0.35;
    n[TAIL].rotation.set(
      p.beg * Math.sin(t * 15) * 0.25 + d.bond * 0.15 * (1 - p.hunch) - p.hunch * 0.3 - d.glide * 0.3 - p.sleep * 0.15 - stretch * 0.25,
      Math.sin(t * 27) * 0.55 * act('wag') + shaking * 0.6,
      0,
    );

    /** Folded, the arm lies along the flank and the hand tucks back over the rump; spread, the hand whips a beat late. */
    let power = p.spread * (1 - d.glide * 0.8) * (d.effort > 0.02 || d.flap > 0.3 || flying ? 1 : 0.35);
    let beatPhase = d.flapPhase;
    const flutter = Math.max(p.beg, p.climb, act('ask') * 0.8, act('bowled'));
    if (flutter > 0.01) {
      beatPhase = t * 24;
      power = Math.max(power, 0.35 * flutter);
    }
    const preenLift = preenWing * 0.25 + stretch * 0.95;
    poseWings(n, {
      open: p.spread,
      beat: Math.sin(beatPhase) * power,
      lag: Math.sin(beatPhase - 0.75) * power,
      twist: -d.glide * 0.12 + d.effort * 0.1 * Math.max(0, Math.sin(d.flapPhase)),
      clamp: p.hunch,
      raise: [d.actSide > 0 ? preenLift : 0, d.actSide < 0 ? preenLift : 0],
      shake: shaking + p.land * 1.5,
    });

    const out = this.out;
    out.bodyLift = body.position.y * SIZE;
    out.rootPitch = rootPitch;
    out.rootRoll = rootRoll;
    const squeeze = Math.max(act('yawn') * 0.85, act('into-wind') * 0.6, act('brace') * 0.5, act('flinch'), act('nuzzle') * 0.7);
    out.blink = Math.max(d.blink, p.sleep, squeeze) - d.fear * 0.2 * (1 - p.sleep) * (1 - squeeze);
    out.fluff = clamp(p.sleep * 0.6 + p.sit * 0.3 * (1 - d.fear) + d.cold * 0.5 + shake * 0.7, 0, 1);
    out.sleek = clamp(d.fear * 0.8 + p.reach * 0.5 + act('flinch') * 0.5, 0, 1);
    out.wingOpen = p.spread;
    return out;
  }
}

const ACTS: Act[] = ['preen-breast', 'preen-wing', 'preen-back', 'nibble', 'stretch', 'yawn', 'shake', 'wag', 'look-about', 'snap', 'flinch', 'brace', 'bowled', 'into-wind', 'ask', 'nuzzle', 'peer'];

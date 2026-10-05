import * as THREE from 'three';
import {
  ARM, BODY, BONES, CHEST, EAR_L, EAR_R, FORE, HEAD, JAW, LEGS, META, NECK, PELVIS, REST, ROOT, SHIN, SKELETON, TAIL, THIGH, TOE, WRIST,
} from './body';

/**
 * Everything the body is asked to show this frame, already eased by the cat: nothing in here may switch. Lengths
 * are in metres before `scale`, angles in radians, and every place is in the frame the cat stands in (the world, or
 * whatever carries it).
 */
export interface Drives {
  /** Frame space to world. */
  frame: THREE.Matrix4;
  scale: number;
  /** The surface under it: a point on it, which way it faces along it, and the surface's own up. */
  origin: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  bodyY: number;
  bodyZ: number;
  /** Nose up, and over to its left. */
  pitch: number;
  roll: number;
  /** The back rounded up between the shoulders and the hips (positive) or stretched out long (negative). */
  flex: number;
  /** The chest lifted off the line of the back, as a sitting cat holds itself. */
  chestUp: number;
  /** The head pulled down into the shoulders. */
  neckLow: number;
  /** Where the face points, from the surface's forward: to its left, and up. */
  headYaw: number;
  headPitch: number;
  headRoll: number;
  jaw: number;
  /** 0 forward and up, 1 flat back against the head. */
  earBack: number;
  /** Each ear's own turn toward a sound, -1..1. */
  earTwitch: [number, number];
  /** Tail at its root: lifted (positive up) and swung (positive to its left); `curl` bends it on along its length. */
  tailLift: number;
  tailSwing: number;
  tailCurl: number;
  /** Wrapped round to one side along the ground: the sign is the side. */
  tailWrap: number;
  /** A wave travelling down the tail, and the tip alone flicking. */
  tailWave: number;
  tailFlick: number;
  /** Where each paw's pad is, in frame space, and how far it is curled. */
  paws: { at: THREE.Vector3; curl: number }[];
  /** How far each hind foot lies back from upright, from standing on its toes (0.3) to flat along the ground (1.45). */
  hock: [number, number];
  breath: number;
}

const ORDER = 'YXZ';
const clamp = THREE.MathUtils.clamp;

/** The skeleton as nodes, posed each frame from the drives: the body by hand, the legs reaching for their paws. */
export class CatRig {
  readonly root = new THREE.Object3D();
  readonly nodes: THREE.Object3D[] = [];
  readonly bones: THREE.Matrix4[] = [];
  private readonly unbind: THREE.Matrix4[] = [];
  private readonly basis = new THREE.Matrix4();
  private readonly side = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly qa = new THREE.Quaternion();
  private readonly qb = new THREE.Quaternion();
  private readonly qp = new THREE.Quaternion();
  private readonly m = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly hip = new THREE.Vector3();
  private readonly knee = new THREE.Vector3();
  private readonly hockAt = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly hinge = new THREE.Vector3();
  private readonly bend = new THREE.Vector3();
  private readonly wUp = new THREE.Vector3();
  private readonly wFwd = new THREE.Vector3();
  private readonly wSide = new THREE.Vector3();
  private readonly e = new THREE.Euler();
  private readonly ax = new THREE.Vector3();
  private readonly ay = new THREE.Vector3();
  private readonly az = new THREE.Vector3();
  private tiptoe = 0;

  constructor() {
    this.nodes[ROOT] = this.root;
    this.root.matrixAutoUpdate = false;
    for (const [bone, parent, [x, y, z]] of SKELETON) {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      o.rotation.order = ORDER;
      this.nodes[parent].add(o);
      this.nodes[bone] = o;
    }
    for (let i = 0; i < BONES; i++) {
      this.bones.push(new THREE.Matrix4());
      this.unbind.push(new THREE.Matrix4().makeTranslation(-REST[i][0], -REST[i][1], -REST[i][2]));
    }
  }

  /** World position of a bone's joint. */
  joint(bone: number, out: THREE.Vector3): THREE.Vector3 {
    return out.setFromMatrixPosition(this.nodes[bone].matrixWorld);
  }

  pose(d: Drives): void {
    const n = this.nodes;
    this.side.crossVectors(d.up, d.forward).normalize();
    this.basis.makeBasis(this.side, d.up, d.forward).setPosition(d.origin);
    this.m.makeScale(d.scale, d.scale, d.scale);
    this.root.matrix.multiplyMatrices(d.frame, this.basis).multiply(this.m);

    const body = n[BODY];
    body.position.set(0, d.bodyY, REST[BODY][2] + d.bodyZ);
    body.rotation.set(-d.pitch, 0, d.roll);
    const breathe = Math.sin(d.breath) * 0.012;
    body.scale.set(1 + breathe, 1 + breathe * 1.3, 1);
    n[PELVIS].rotation.set(-d.flex * 0.9, 0, 0);
    n[CHEST].rotation.set(d.flex * 0.6 - d.chestUp, 0, 0);

    n[JAW].rotation.set(d.jaw * 0.7, 0, 0);
    this.root.updateMatrixWorld(true);
    this.head(d);

    const back = d.earBack;
    for (const [bone, s, twitch] of [
      [EAR_L, 1, d.earTwitch[0]],
      [EAR_R, -1, d.earTwitch[1]],
    ] as const) {
      n[bone].rotation.set(-0.15 - back * 0.95 + twitch * 0.1, s * (back * 1.1 + twitch * 0.5), -s * back * 0.55);
    }

    for (let i = 0; i < TAIL.length; i++) {
      const k = i / (TAIL.length - 1);
      const wave = Math.sin(d.tailWave - i * 0.9) * (0.08 + 0.12 * k);
      const flick = i >= TAIL.length - 2 ? d.tailFlick * (i === TAIL.length - 1 ? 0.9 : 0.4) : 0;
      const lift = i === 0 ? d.tailLift : d.tailCurl * (0.6 + 0.6 * k);
      const swing = i === 0 ? d.tailSwing + d.tailWrap * 0.6 : d.tailWrap * (0.5 + 0.3 * k) + wave + flick;
      n[TAIL[i]].rotation.set(lift, swing, 0);
    }

    this.root.updateMatrixWorld(true);
    this.legs(d);
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < BONES; i++) this.bones[i].multiplyMatrices(n[i].matrixWorld, this.unbind[i]);
  }

  /**
   * The head looks where it is told in the frame of what it stands on, whatever the back is doing: a sitting cat's
   * chest is tipped back, and a turn taken about the chest would roll the head over. The neck takes a share of it.
   */
  private head(d: Drives): void {
    const n = this.nodes;
    this.qa.setFromRotationMatrix(this.m.extractRotation(this.root.matrixWorld));
    this.e.set(-d.headPitch, d.headYaw, d.headRoll, ORDER);
    const want = this.qa.multiply(this.qb.setFromEuler(this.e));
    n[CHEST].getWorldQuaternion(this.qp);
    this.q.copy(this.qp).slerp(want, 0.35).multiply(this.qb.setFromAxisAngle(this.ax.set(1, 0, 0), d.neckLow * 0.9));
    n[NECK].quaternion.copy(this.qp).invert().multiply(this.q);
    n[HEAD].quaternion.copy(this.q).invert().multiply(want);
    n[NECK].updateMatrixWorld(true);
  }

  private legs(d: Drives): void {
    const n = this.nodes;
    this.wSide.copy(this.side).transformDirection(d.frame);
    this.wUp.copy(d.up).transformDirection(d.frame);
    this.wFwd.copy(d.forward).transformDirection(d.frame);
    /** Knees and elbows hinge across the body, whichever way the body is turned. */
    const across = this.v.setFromMatrixColumn(n[BODY].matrixWorld, 0).normalize();
    this.hinge.copy(across);
    for (const [i, leg] of LEGS.entries()) {
      const paw = d.paws[i];
      this.target.copy(paw.at).applyMatrix4(d.frame);
      this.hip.setFromMatrixPosition(n[leg.upper].matrixWorld);
      if (leg.front) {
        this.target.addScaledVector(this.wUp, WRIST * d.scale);
        /** Reaching for a paw left far behind, the heel of the paw comes up off the ground before the leg runs out. */
        this.tiptoe = this.heelUp(this.target, this.hip, (ARM + FORE) * d.scale, 0.025 * d.scale) / (0.03 * d.scale);
        this.reach(leg.upper, leg.lower, this.hip, this.target, ARM * d.scale, FORE * d.scale, 1, this.knee);
      } else {
        this.tiptoe = 0;
        const tilt = d.hock[i - 2];
        this.target.addScaledVector(this.wUp, TOE * d.scale);
        this.hockAt.copy(this.target).addScaledVector(this.wUp, Math.cos(tilt) * META * d.scale).addScaledVector(this.wFwd, -Math.sin(tilt) * META * d.scale);
        /** Pushing off, the hock lifts and the foot stands up on its toes, which is most of a hind leg's reach. */
        this.heelUp(this.hockAt, this.hip, (THIGH + SHIN) * d.scale, META * d.scale * 1.6, this.target);
        this.reach(leg.upper, leg.lower, this.hip, this.hockAt, THIGH * d.scale, SHIN * d.scale, -1, this.knee);
        this.qp.copy(this.qb);
        this.aim(this.qa, this.dir.subVectors(this.target, this.hockAt).normalize());
        n[leg.meta].quaternion.copy(this.qp).invert().multiply(this.qa);
        this.qb.copy(this.qa);
      }
      /** The pad flat on the surface, toes along the way it faces, curled under as it swings. */
      this.m.makeBasis(this.wSide, this.wUp, this.wFwd);
      this.q.setFromRotationMatrix(this.m).multiply(this.qa.setFromEuler(this.e.set(paw.curl + this.tiptoe, 0, 0)));
      n[leg.paw].quaternion.copy(this.qb).invert().multiply(this.q);
    }
  }

  /**
   * Swings `joint` round `pivot` (or, with none, simply toward `toward`) by as much as it takes to bring it within a
   * leg's length of `toward`, over at most `give`: nothing while it is in reach, so a leg only stretches its foot when
   * it would otherwise run out.
   */
  private heelUp(joint: THREE.Vector3, toward: THREE.Vector3, length: number, give: number, pivot?: THREE.Vector3): number {
    const over = joint.distanceTo(toward) - length * 0.96;
    if (over <= 0) return 0;
    if (!pivot) {
      const shift = Math.min(over, give);
      joint.addScaledVector(this.bend.subVectors(toward, joint).normalize(), shift);
      return shift;
    }
    const radius = joint.distanceTo(pivot);
    this.bend.subVectors(joint, pivot).normalize().lerp(this.v.subVectors(toward, pivot).normalize(), Math.min(1, over / give)).normalize();
    joint.copy(pivot).addScaledVector(this.bend, radius);
    return over;
  }

  /**
   * Two bones from `from` to `to`, bending at the middle joint to the back (`bend` 1) or the front (-1). Leaves the
   * lower bone's world rotation in `qb`, for whatever hangs off it.
   */
  private reach(upper: number, lower: number, from: THREE.Vector3, to: THREE.Vector3, a: number, b: number, bend: number, mid: THREE.Vector3): void {
    const n = this.nodes;
    this.dir.subVectors(to, from);
    const dist = clamp(this.dir.length(), Math.abs(a - b) + 1e-4, (a + b) * 0.9995);
    this.dir.normalize();
    const h = this.v.copy(this.hinge).addScaledVector(this.dir, -this.hinge.dot(this.dir)).normalize();
    this.bend.crossVectors(h, this.dir).multiplyScalar(bend);
    const along = (a * a - b * b + dist * dist) / (2 * dist);
    const out = Math.sqrt(Math.max(0, a * a - along * along));
    mid.copy(from).addScaledVector(this.dir, along).addScaledVector(this.bend, out);
    const parent = n[upper].parent!;
    parent.getWorldQuaternion(this.qp);
    this.aim(this.qa, this.dir.subVectors(mid, from).normalize(), h);
    n[upper].quaternion.copy(this.qp).invert().multiply(this.qa);
    this.qp.copy(this.qa);
    this.aim(this.qb, this.dir.copy(to).sub(mid).normalize(), h);
    n[lower].quaternion.copy(this.qp).invert().multiply(this.qb);
  }

  /** The rotation that takes a bone lying straight down with its hinge across +x to lie along `dir`, hinged on `hinge`. */
  private aim(out: THREE.Quaternion, dir: THREE.Vector3, hinge: THREE.Vector3 = this.hinge): THREE.Quaternion {
    const hx = this.ax.copy(hinge).addScaledVector(dir, -hinge.dot(dir)).normalize();
    this.az.crossVectors(dir, hx);
    this.m.makeBasis(hx, this.ay.copy(dir).negate(), this.az);
    return out.setFromRotationMatrix(this.m);
  }
}

import * as THREE from 'three';
import {
  ARM, BODY, BONES, CHEST, CHIN, EAR_L, EAR_R, FORE, HEAD, JAW, LEGS, META, NECK, PELVIS, REST, ROOT, SHIN, SKELETON, TAIL, THIGH, TOE, WRIST,
} from './body';

/**
 * Everything the body is asked to show this frame, already eased by the squirrel. Lengths are metres before
 * `scale`, angles radians, and places are in the frame it stands in (the world, or whatever carries it).
 */
export interface Drives {
  frame: THREE.Matrix4;
  scale: number;
  /** The surface under it: a point on it, which way it faces along it, and the surface's own up. */
  origin: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  bodyX: number;
  bodyY: number;
  bodyZ: number;
  /** Nose up, and over to its left. */
  pitch: number;
  roll: number;
  /** The back rounded up (positive) or arched long (negative). */
  flex: number;
  stretch: number;
  /** The chest lifted off the line of the back, as it sits up. */
  chestUp: number;
  /** The spine curved round to its left. */
  bend: number;
  /** The head pulled down into the shoulders (positive) or the neck stretched up (negative). */
  neckLow: number;
  /** Where the face points, from the surface's forward: to its left, up, and tipped. */
  headYaw: number;
  headPitch: number;
  headRoll: number;
  jaw: number;
  /** 0 up and forward, 1 flat back. */
  earBack: number;
  earTwitch: [number, number];
  /**
   * The tail: its root against the surface (up positive, swung to its right positive), then a bend shared along
   * the first half (`tailCurve`, up positive) and an opposite one along the rest (`tailTip`), which together make
   * the S; `tailBend` curls it round to its left; a wave runs down it and the tip flicks.
   */
  tailLift: number;
  tailSwing: number;
  tailCurve: number;
  tailTip: number;
  tailBend: number;
  tailWave: number;
  tailWaveSize: number;
  tailFlick: number;
  /** A wave running down the tail up and down, how big and how far along it has run, as it streams behind a bound. */
  tailRipple: number;
  tailRipplePhase: number;
  /** Where each paw is, in frame space, and how far it is curled. Front paws are drawn toward the chin by `hold`. */
  paws: { at: THREE.Vector3; curl: number }[];
  /** 0 the forepaws are where `paws` puts them; 1 they are up at the body, against the chest (`holdHigh` 0) or under the chin (1). */
  hold: number;
  holdHigh: number;
  /** How far each hind foot lies back from upright: 0.3 on its toes to 1.45 flat. */
  hock: [number, number];
  breath: number;
}

/**
 * A held shape of the whole animal, in its own space and at scale 1: what each action is when nothing moves.
 * Paw homes are [across to its left, ahead] off the point it stands on, and `lift` raises them off the surface.
 */
export interface Stance {
  bodyY: number;
  bodyZ: number;
  pitch: number;
  flex: number;
  stretch: number;
  chestUp: number;
  neckLow: number;
  headPitch: number;
  hock: number;
  front: [number, number];
  hind: [number, number];
  frontLift: number;
  hindLift: number;
  curl: number;
  hold: number;
  holdHigh: number;
  tailLift: number;
  tailCurve: number;
  tailTip: number;
  tailBend: number;
  earBack: number;
  jaw: number;
  /** Sits its weight on what is under it: the lowest of its belly and haunches is put down on the floor. */
  seat: boolean;
}

export type StanceName = 'stand' | 'sit' | 'freeze' | 'scold' | 'perch' | 'buried' | 'peek' | 'bound' | 'climb' | 'run' | 'trunk' | 'wool' | 'crouch' | 'dive';

const STAND: Stance = {
  bodyY: 0.062, bodyZ: 0, pitch: 0.12, flex: 0.1, stretch: 0, chestUp: 0, neckLow: 0.2, headPitch: 0.1, hock: 1.35,
  front: [0.013, 0.05], hind: [0.022, -0.026], frontLift: 0, hindLift: 0, curl: 0, hold: 0, holdHigh: 0,
  tailLift: 0.75, tailCurve: 0.2, tailTip: -0.28, tailBend: 0, earBack: 0, jaw: 0, seat: false,
};

export const STANCES: Record<StanceName, Stance> = {
  stand: STAND,
  /** Up on its haunches, hunched over the nut it turns in its hands under its chin; tail up its back in an S. */
  sit: {
    ...STAND, bodyY: 0.07, bodyZ: 0.012, pitch: 1.0, flex: 0.32, chestUp: 0.3, neckLow: 0.15, headPitch: -0.1, hock: 1.45,
    front: [0.012, 0.05], hind: [0.02, 0.026], curl: 1.3, hold: 1, holdHigh: 1,
    tailLift: 0.95, tailCurve: 0.17, tailTip: -0.3, seat: true,
  },
  /** Bolt upright and taller than it sits, hands pressed to its chest, ears up, tail pressed flat up its back. */
  freeze: {
    ...STAND, bodyY: 0.09, bodyZ: 0.008, pitch: 1.32, flex: 0.02, chestUp: 0.18, neckLow: -0.25, headPitch: 0.05, hock: 1.45,
    front: [0.012, 0.05], hind: [0.019, 0.02], curl: 1.5, hold: 1, holdHigh: 0,
    tailLift: 1.15, tailCurve: 0.07, tailTip: -0.24, earBack: -0.15, seat: true,
  },
  /** Chest up on straight forelegs, head up at what it scolds, mouth open, tail arched high and flicked at the tip. */
  scold: {
    ...STAND, bodyY: 0.054, bodyZ: -0.004, pitch: 0.24, flex: -0.05, chestUp: 0.05, neckLow: -0.2, headPitch: 0.3, hock: 1.4,
    front: [0.012, 0.05], hind: [0.022, -0.014], curl: 0,
    tailLift: 1.25, tailCurve: 0.16, tailTip: -0.5, earBack: 0.18, jaw: 0.8,
  },
  /** On a branch, hunched along it with its paws in one line, tail curled up over its back like a question mark. */
  perch: {
    ...STAND, bodyY: 0.055, bodyZ: 0.006, pitch: 0.42, flex: 0.38, chestUp: 0.02, neckLow: 0.15, headPitch: 0.05, hock: 1.45,
    front: [0.005, 0.046], hind: [0.007, 0.0], curl: 0.4,
    tailLift: 1.3, tailCurve: 0.78, tailTip: 0.06, seat: true,
  },
  /** Pressed flat under the leaves, paws folded under, head down, the tail laid back along the ground. */
  buried: {
    ...STAND, bodyY: 0.04, bodyZ: 0, pitch: -0.04, flex: 0.42, chestUp: -0.05, neckLow: 0.9, headPitch: -0.2, hock: 1.45,
    front: [0.011, 0.042], hind: [0.022, -0.012], curl: 0.5,
    tailLift: -0.1, tailCurve: 0.02, tailTip: 0.02, earBack: 0.9, seat: true,
  },
  /** Up on its haunches in the leaves with its head and shoulders out of them, neck stretched, paws half raised, looking about. */
  peek: {
    ...STAND, bodyY: 0.08, bodyZ: 0.006, pitch: 1.2, flex: 0.1, chestUp: 0.22, neckLow: -0.4, headPitch: 0.15, hock: 1.45,
    front: [0.012, 0.05], hind: [0.02, 0.018], curl: 1.0, hold: 0.7, holdHigh: 0,
    tailLift: -0.15, tailCurve: 0.04, tailTip: 0.1, earBack: -0.1, seat: true,
  },
  /** The reach of a bound: off the ground and drawn out long, forepaws stretched for the landing, hind feet kicked back, tail streaming. */
  bound: {
    ...STAND, bodyY: 0.088, bodyZ: 0.004, pitch: 0.04, flex: -0.32, stretch: 0.012, chestUp: 0, neckLow: 0.05, headPitch: 0.0, hock: 0.6,
    front: [0.01, 0.095], hind: [0.016, -0.085], frontLift: 0.032, hindLift: 0.03, curl: 0.4,
    tailLift: 0.35, tailCurve: 0.06, tailTip: -0.12, earBack: 0.2,
  },
  /**
   * Head up a trunk, spread on it, hugging the bark (the surface's up is out of the bark), hind feet turned out
   * and flat, the tail laid down the bark behind.
   */
  climb: {
    ...STAND, bodyY: 0.045, bodyZ: 0, pitch: 0.0, flex: 0.12, chestUp: 0.05, neckLow: -0.08, headPitch: 0.32, hock: 1.45,
    front: [0.026, 0.046], hind: [0.03, -0.034], curl: 0.2,
    tailLift: 0.18, tailCurve: -0.06, tailTip: 0.14,
  },
  /** What its bound on open ground swings about: low and long, head level, tail out behind and lifting. */
  run: {
    ...STAND, bodyY: 0.057, pitch: 0.02, flex: 0.05, neckLow: 0.12, headPitch: 0.1, hock: 1.2,
    tailLift: 0.14, tailCurve: 0.05, tailTip: -0.06, earBack: 0.15,
  },
  /** Its bound up or down a trunk: flat to the bark, head lifted off it, tail laid along the bark behind. */
  trunk: {
    ...STAND, bodyY: 0.048, pitch: 0.0, flex: 0.06, chestUp: 0.04, neckLow: -0.08, headPitch: 0.4, hock: 1.3,
    tailLift: 0.16, tailCurve: -0.04, tailTip: 0.1, earBack: 0.1,
  },
  /** Along the wool: crouched low over it, eyes on the way ahead, the tail out straight to balance. */
  wool: {
    ...STAND, bodyY: 0.046, pitch: 0.0, flex: 0.18, neckLow: 0.05, headPitch: 0.02, hock: 1.3,
    tailLift: 0.18, tailCurve: 0.02, tailTip: -0.04, earBack: 0.1,
  },
  /** Gathered to spring: low on bent legs, back rounded, tail up behind. */
  crouch: {
    ...STAND, bodyY: 0.044, pitch: 0.06, flex: 0.38, neckLow: 0.25, headPitch: 0.0, hock: 1.45,
    front: [0.012, 0.042], hind: [0.024, -0.008], tailLift: 0.55, tailCurve: 0.1, tailTip: -0.12, earBack: 0.1,
  },
  /** In the air, diving: stretched out long, forepaws reaching ahead, hind feet trailing, ears flat, tail streaming. */
  dive: {
    ...STAND, bodyY: 0.06, flex: -0.3, stretch: 0.02, neckLow: -0.1, headPitch: -0.1, hock: 0.6,
    front: [0.01, 0.1], hind: [0.02, -0.09], frontLift: 0.02, hindLift: 0.03, curl: 0.3,
    tailLift: 0.35, tailCurve: 0.04, tailTip: -0.06, earBack: 0.75,
  },
};

const ORDER = 'YXZ';
const NECK_AT = SKELETON.find(([bone]) => bone === NECK)![2];
const PELVIS_AT = SKELETON.find(([bone]) => bone === PELVIS)![2];
const CHEST_AT = SKELETON.find(([bone]) => bone === CHEST)![2];
const clamp = THREE.MathUtils.clamp;
/** The halfway joint of the tail, where its bend turns the other way. */
const TURN = 4;

/** The skeleton as nodes, posed each frame from the drives: the body by hand, the legs reaching for their paws. */
export class SquirrelRig {
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
  private readonly bendV = new THREE.Vector3();
  private readonly prefer = new THREE.Vector3();
  private readonly wUp = new THREE.Vector3();
  private readonly wFwd = new THREE.Vector3();
  private readonly wSide = new THREE.Vector3();
  private readonly chin = new THREE.Vector3();
  private readonly chest = new THREE.Vector3();
  private readonly e = new THREE.Euler();
  private readonly ax = new THREE.Vector3();
  private readonly ay = new THREE.Vector3();
  private readonly az = new THREE.Vector3();

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
    for (const bone of TAIL.slice(1)) this.nodes[bone].rotation.order = 'XYZ';
    for (let i = 0; i < BONES; i++) {
      this.bones.push(new THREE.Matrix4());
      this.unbind.push(new THREE.Matrix4().makeTranslation(-REST[i][0], -REST[i][1], -REST[i][2]));
    }
  }

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
    body.position.set(d.bodyX, d.bodyY, REST[BODY][2] + d.bodyZ);
    body.rotation.set(-d.pitch, 0, d.roll);
    const breathe = Math.sin(d.breath) * 0.018;
    body.scale.set(1 + breathe, 1 + breathe * 1.2, 1);
    n[PELVIS].rotation.set(-d.flex * 0.9, -d.bend * 0.6, 0);
    n[CHEST].rotation.set(d.flex * 0.6 - d.chestUp, d.bend * 0.6, 0);
    n[PELVIS].position.z = PELVIS_AT[2] - d.stretch / 2;
    n[CHEST].position.z = CHEST_AT[2] + d.stretch / 2;
    n[JAW].rotation.set(d.jaw * 0.45, 0, 0);
    const low = d.neckLow * 0.45;
    const [, ny, nz] = NECK_AT;
    n[NECK].position.set(0, ny * Math.cos(low) - nz * Math.sin(low), ny * Math.sin(low) + nz * Math.cos(low));
    this.root.updateMatrixWorld(true);
    this.head(d);

    for (const [bone, s, twitch] of [
      [EAR_L, 1, d.earTwitch[0]],
      [EAR_R, -1, d.earTwitch[1]],
    ] as const) {
      n[bone].rotation.set(-d.earBack * 0.9 + twitch * 0.12, s * (d.earBack * 0.3 + twitch * 0.45), -s * d.earBack * 0.6);
    }

    /** The root is held in the frame of what it stands on, so a tail stands up behind however the back is tipped. */
    for (let i = 0; i < TAIL.length; i++) {
      const k = i / (TAIL.length - 1);
      const wave = Math.sin(d.tailWave - i * 0.8) * d.tailWaveSize * (0.4 + 0.6 * k);
      const flick = i >= TAIL.length - 3 ? d.tailFlick * (0.3 + 0.35 * (i - TAIL.length + 3)) : 0;
      const ripple = i > 0 ? Math.sin(d.tailRipplePhase - i * 0.9) * d.tailRipple * (0.3 + 0.7 * k) : 0;
      const lift = (i === 0 ? d.tailLift : (i < TURN ? d.tailCurve : d.tailTip) + flick) + ripple;
      const swing = (i === 0 ? d.tailSwing : 0) + d.tailBend * (0.25 + 0.15 * k) + wave;
      if (i > 0) {
        n[TAIL[i]].rotation.set(lift, swing, 0);
        continue;
      }
      this.qa.setFromRotationMatrix(this.m.extractRotation(this.root.matrixWorld));
      const want = this.qa.multiply(this.qb.setFromEuler(this.e.set(lift, swing, 0, ORDER)));
      n[PELVIS].getWorldQuaternion(this.qp);
      n[TAIL[0]].quaternion.copy(this.qp).invert().multiply(want);
    }

    this.root.updateMatrixWorld(true);
    this.legs(d);
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < BONES; i++) this.bones[i].multiplyMatrices(n[i].matrixWorld, this.unbind[i]);
  }

  /** The head looks where it is told in the frame of what it stands on, whatever the back is doing; the neck takes a share. */
  private head(d: Drives): void {
    const n = this.nodes;
    this.qa.setFromRotationMatrix(this.m.extractRotation(this.root.matrixWorld));
    this.e.set(-d.headPitch, d.headYaw, d.headRoll, ORDER);
    const want = this.qa.multiply(this.qb.setFromEuler(this.e));
    n[CHEST].getWorldQuaternion(this.qp);
    this.q.copy(this.qp).slerp(want, 0.6).multiply(this.qb.setFromAxisAngle(this.ax.set(1, 0, 0), d.neckLow * 0.8));
    n[NECK].quaternion.copy(this.qp).invert().multiply(this.q);
    n[HEAD].quaternion.copy(this.q).invert().multiply(want);
    n[NECK].updateMatrixWorld(true);
  }

  private legs(d: Drives): void {
    const n = this.nodes;
    this.wSide.copy(this.side).transformDirection(d.frame);
    this.wUp.copy(d.up).transformDirection(d.frame);
    this.wFwd.copy(d.forward).transformDirection(d.frame);
    this.hinge.setFromMatrixColumn(n[BODY].matrixWorld, 0).normalize();
    const k = d.scale;
    /** Under the chin, and against the front of the chest: where held forepaws go. */
    this.chin.set(CHIN[0], CHIN[1], CHIN[2]).sub(this.v.set(...REST[HEAD])).applyMatrix4(n[HEAD].matrixWorld);
    this.chest.set(0, -0.006, 0.026).applyMatrix4(this.m.copy(n[CHEST].matrixWorld));
    const held = clamp(d.hold, 0, 1);
    for (const [i, leg] of LEGS.entries()) {
      const paw = d.paws[i];
      this.target.copy(paw.at).applyMatrix4(d.frame);
      this.hip.setFromMatrixPosition(n[leg.upper].matrixWorld);
      if (leg.front) {
        this.target.addScaledVector(this.wUp, WRIST * k);
        if (held > 0) {
          const at = this.v.copy(this.chest).lerp(this.chin, d.holdHigh).addScaledVector(this.hinge, leg.side * 0.0058 * k);
          this.target.lerp(at, held);
        }
        this.reach(leg.upper, leg.lower, this.hip, this.target, ARM * k, FORE * k, 1, this.knee);
      } else {
        const tilt = d.hock[i - 2];
        this.target.addScaledVector(this.wUp, TOE * k);
        this.hockAt.copy(this.target).addScaledVector(this.wUp, Math.cos(tilt) * META * k).addScaledVector(this.wFwd, -Math.sin(tilt) * META * k);
        /** The knee goes forward and up off what it stands on, however far back the foot is, never down into it. */
        this.prefer.copy(this.wFwd).addScaledVector(this.wUp, 0.8);
        this.reach(leg.upper, leg.lower, this.hip, this.hockAt, THIGH * k, SHIN * k, -1, this.knee, this.prefer);
        this.qp.copy(this.qb);
        this.aim(this.qa, this.dir.subVectors(this.target, this.hockAt).normalize());
        n[leg.meta].quaternion.copy(this.qp).invert().multiply(this.qa);
        this.qb.copy(this.qa);
      }
      /** The pad flat on the surface, toes along the way it faces; a held paw turns its palm in and up to what it holds. */
      this.m.makeBasis(this.wSide, this.wUp, this.wFwd);
      this.q.setFromRotationMatrix(this.m).multiply(this.qa.setFromEuler(this.e.set(paw.curl, 0, leg.front ? -leg.side * 0.5 * held : 0)));
      n[leg.paw].quaternion.copy(this.qb).invert().multiply(this.q);
    }
  }

  /** Two bones from `from` to `to`, bending at the middle joint to the back (`bend` 1) or the front (-1). Leaves the lower bone's world rotation in `qb`. */
  private reach(upper: number, lower: number, from: THREE.Vector3, to: THREE.Vector3, a: number, b: number, bend: number, mid: THREE.Vector3, prefer?: THREE.Vector3): void {
    const n = this.nodes;
    this.dir.subVectors(to, from);
    const dist = clamp(this.dir.length(), Math.abs(a - b) + 1e-4, (a + b) * 0.9995);
    this.dir.normalize();
    const h = this.v.copy(this.hinge).addScaledVector(this.dir, -this.hinge.dot(this.dir)).normalize();
    this.bendV.crossVectors(h, this.dir).multiplyScalar(bend);
    if (prefer) {
      this.bendV.copy(prefer).addScaledVector(this.dir, -prefer.dot(this.dir)).normalize();
      h.crossVectors(this.bendV, this.dir).multiplyScalar(-bend).normalize();
    }
    const along = (a * a - b * b + dist * dist) / (2 * dist);
    const out = Math.sqrt(Math.max(0, a * a - along * along));
    mid.copy(from).addScaledVector(this.dir, along).addScaledVector(this.bendV, out);
    n[upper].parent!.getWorldQuaternion(this.qp);
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

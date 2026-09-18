import * as THREE from 'three';

export type Seat = 'cradle' | 'satchel' | 'lap';
export type MoveKind = 'lift' | 'climb' | 'hop' | 'dash' | 'settle';

/** Whoever carries it: a named place on their body, which moves with every bone above it. */
export interface Mount {
  socket(name: Seat | 'shoulder'): THREE.Object3D;
}

/**
 * How it sits in each seat: which way it faces relative to the child and how far it is tipped back. In the arms it
 * lies across the chest with its head to the child's left, the way anyone holds a duck; in the satchel and on the
 * lap it faces the way they are going.
 */
const SEATS: Record<Seat, { yaw: number; pitch: number }> = {
  cradle: { yaw: Math.PI / 2, pitch: -0.18 },
  /** Sitting up in the bag rather than lying back in it: any further and its back is all the camera behind ever sees. */
  satchel: { yaw: 0, pitch: -0.11 },
  lap: { yaw: 0, pitch: -0.1 },
};

/**
 * The way over the child between two seats, in the frame of the child's body: up the chest, over the right shoulder
 * beside the hood, and down the back. It is a path on their surface, so a climb never passes through them.
 */
const OVER_THE_SHOULDER = [new THREE.Vector3(-0.2, 1.0, 0.4), new THREE.Vector3(-0.4, 1.16, 0.04), new THREE.Vector3(-0.27, 1.08, -0.38)];

export interface Frame {
  p: THREE.Vector3;
  q: THREE.Quaternion;
}

const frame = (): Frame => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() });
const UP = new THREE.Vector3(0, 1, 0);

interface Move {
  kind: MoveKind;
  t: number;
  dur: number;
  /** Height of the arc over a straight move, world units. */
  arc: number;
  /** Where it set out from: a seat it is leaving (still moving with the child), or a fixed place in the world. */
  from: Seat | null;
  fixed: Frame;
  via: THREE.Vector3[] | null;
}

/**
 * Where the cygnet is drawn, and which way up: on the ground where the story has it, in a seat on the child, in the
 * child's hands, or on its way between two of those. Every source is read live each frame, so whatever the child
 * does while it is being lifted, climbing or settling, the two of them stay one movement.
 */
export class Ride {
  readonly shown = frame();
  seat: Seat | null = null;
  held = false;
  move: Move | null = null;
  /** The passenger's own lag behind the child's starts and stops, in the child's frame. */
  readonly jostle = new THREE.Vector3();
  /** How fast the seat is travelling over the ground, and how smoothly. */
  speed = 0;
  calm = 0;
  mount: Mount | null = null;

  private readonly ground = frame();
  private readonly hands = frame();
  private readonly target = frame();
  private readonly source = frame();
  private readonly jostleVel = new THREE.Vector3();
  private readonly seatAt = new THREE.Vector3();
  private readonly seatPrev = new THREE.Vector3();
  private readonly seatVel = new THREE.Vector3();
  private fresh = true;
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly tq = new THREE.Quaternion();
  private readonly te = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly path: THREE.Vector3[] = [];

  get yaw(): number {
    const f = this.tmp.set(0, 0, 1).applyQuaternion(this.shown.q);
    return Math.atan2(f.x, f.z);
  }

  get riding(): boolean {
    return this.seat !== null && !this.held;
  }

  /** On the ground where the story puts it. */
  stand(position: THREE.Vector3, yaw: number): void {
    this.ground.p.copy(position);
    this.ground.q.setFromAxisAngle(UP, yaw);
  }

  /** In the child's hands: the caller works out the frame from the mittens every frame for as long as it is held. */
  hold(p: THREE.Vector3, q: THREE.Quaternion): void {
    this.hands.p.copy(p);
    this.hands.q.copy(q);
  }

  /** Jumps to wherever it now belongs, with nothing in between: for a story start, never for a moment on screen. */
  snap(): void {
    this.move = null;
    this.fresh = true;
    this.jostle.set(0, 0, 0);
    this.jostleVel.set(0, 0, 0);
  }

  /** Changes where it belongs and makes the way there a movement of the given kind. */
  go(to: { seat?: Seat | null; held?: boolean }, kind: MoveKind, dur: number, arc = 0): void {
    const leaving = this.riding ? this.seat : null;
    const next = to.seat === undefined ? this.seat : to.seat;
    const over = kind === 'climb' && leaving !== null && next !== null && leaving !== next;
    this.move = {
      kind,
      t: 0,
      dur,
      arc,
      from: over ? leaving : null,
      fixed: { p: this.shown.p.clone(), q: this.shown.q.clone() },
      via: over ? (leaving === 'cradle' ? OVER_THE_SHOULDER : [...OVER_THE_SHOULDER].reverse()) : null,
    };
    this.seat = next;
    this.held = to.held ?? false;
  }

  /** `lift` is how far the middle of its body is above its own origin this frame; seats hold it by the body, not the feet. */
  update(dt: number, lift: number): void {
    this.resolve(this.target, this.held ? 'held' : this.seat, lift, true);
    const m = this.move;
    if (m) {
      m.t += dt;
      const k = THREE.MathUtils.smootherstep(Math.min(1, m.t / m.dur), 0, 1);
      if (m.from) this.resolve(this.source, m.from, lift, false);
      else {
        this.source.p.copy(m.fixed.p);
        this.source.q.copy(m.fixed.q);
      }
      if (m.via && this.mount) this.along(m.via, k);
      else {
        this.shown.p.lerpVectors(this.source.p, this.target.p, k);
        this.shown.p.y += Math.sin(k * Math.PI) * m.arc;
      }
      this.shown.q.slerpQuaternions(this.source.q, this.target.q, k);
      if (m.t >= m.dur) this.move = null;
    } else {
      this.shown.p.copy(this.target.p);
      this.shown.q.copy(this.target.q);
    }
    this.fresh = false;
  }

  /** Where it would be, and which way up, if it were sitting in a seat right now: for hands to bring it there exactly. */
  frameOf(seat: Seat, lift: number, out: Frame): Frame {
    this.resolve(out, seat, lift, false);
    return out;
  }

  private resolve(out: Frame, where: Seat | 'held' | null, lift: number, live: boolean): void {
    if (where === 'held') {
      out.p.copy(this.hands.p);
      out.q.copy(this.hands.q);
      return;
    }
    if (where === null || !this.mount) {
      out.p.copy(this.ground.p);
      out.q.copy(this.ground.q);
      return;
    }
    const socket = this.mount.socket(where);
    socket.updateWorldMatrix(true, false);
    socket.matrixWorld.decompose(out.p, out.q, this.tmp2);
    if (live) this.passenger(out);
    const s = SEATS[where];
    out.q.multiply(this.tq.setFromEuler(this.te.set(s.pitch, s.yaw, 0)));
    out.p.addScaledVector(this.tmp.set(0, 1, 0).applyQuaternion(out.q), -lift);
  }

  /** Jostled the way a passenger is: it lags every start and stop of the seat under it, and settles again on a spring. */
  private passenger(seat: Frame): void {
    const dt = this.dtFor(seat.p);
    if (dt > 0) {
      const v = this.tmp.copy(seat.p).sub(this.seatPrev).divideScalar(dt);
      const acc = this.tmp2.copy(v).sub(this.seatVel).divideScalar(dt).clampLength(0, 40);
      this.seatVel.copy(v);
      this.speed = Math.hypot(v.x, v.z);
      const jolt = acc.length();
      this.calm += ((jolt < 2.5 ? 1 : 0) - this.calm) * (1 - Math.exp(-dt * (jolt < 2.5 ? 0.25 : 8)));
      acc.applyQuaternion(this.tq.copy(seat.q).invert());
      this.jostleVel.addScaledVector(acc, -0.15 * dt).addScaledVector(this.jostle, -90 * dt).addScaledVector(this.jostleVel, -12 * dt);
      this.jostle.addScaledVector(this.jostleVel, dt).clampLength(0, 0.1);
    }
    this.seatPrev.copy(seat.p);
    seat.p.add(this.tmp.copy(this.jostle).applyQuaternion(seat.q));
  }

  private lastDt = 1 / 60;
  /** The seat's own time step: nothing on the first frame in a seat, so arriving is never read as a jolt. */
  private dtFor(at: THREE.Vector3): number {
    if (this.fresh || this.seatAt.distanceToSquared(at) > 25) {
      this.seatPrev.copy(at);
      this.seatVel.set(0, 0, 0);
      this.seatAt.copy(at);
      return 0;
    }
    this.seatAt.copy(at);
    return this.lastDt;
  }

  tick(dt: number): void {
    this.lastDt = dt;
  }

  /** A smooth curve through the way over the child, from wherever it is leaving to wherever it is going, both read live. */
  private along(via: THREE.Vector3[], k: number): void {
    const body = this.mount!.socket('cradle').parent!;
    body.updateWorldMatrix(true, false);
    const pts = this.path;
    pts.length = 0;
    pts.push(this.source.p, ...via.map((v) => body.localToWorld(v.clone())), this.target.p);
    const n = pts.length - 1;
    const x = Math.min(n - 1e-4, k * n);
    const i = Math.floor(x);
    const t = x - i;
    const at = (j: number) => pts[Math.min(n, Math.max(0, j))];
    const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const cr = (p0: number, p1: number, p2: number, p3: number) =>
      0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
    this.shown.p.set(cr(a.x, b.x, c.x, d.x), cr(a.y, b.y, c.y, d.y), cr(a.z, b.z, c.z, d.z));
  }
}

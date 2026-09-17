import * as THREE from 'three';
import type { Cygnet } from '../creatures/cygnet';
import type { Traveller } from '../traveller/traveller';
import { Duet, type Beat } from './duet';

const UP = new THREE.Vector3(0, 1, 0);
/** Where the hands hold it out to look at it, and where they bring it in to, in the frame of the child's body. */
const PRESENT = new THREE.Vector3(0, 0.8, 0.56);
/** A mitten rests against the outside of what it holds, not at the middle of it. */
const PALM = 0.07;
/** How far from it the child kneels. */
const STANDOFF = 1.0;
/** Where a kneeling child's hands stop when they are held out low: as far down as the arms go without falling over. */
const OFFER = new THREE.Vector3(0, 0.57, 0.45);

const lerp = THREE.MathUtils.lerp;

/**
 * Everything the child and the cygnet do with their hands on each other: gathering it up, holding it, setting it
 * down, letting it climb into the satchel and out again. Contact is one system. While it is in the child's hands
 * the hands lead and the cygnet goes exactly where the mittens are; while it rides in a seat the seat leads and the
 * mittens go exactly where its body is. Nothing here is two animations hoping to meet.
 */
export class Carry {
  private duet: Duet | null = null;
  /** The middle of the two mittens and how far apart they are, in the frame of the child's body, while the hands lead. */
  private readonly centre = new THREE.Vector3();
  private readonly centreFrom = new THREE.Vector3();
  private spacing = 0.36;
  private spacingFrom = 0.36;
  private leading = false;
  /** Which way it faces in the hands, relative to the child. */
  private relYaw = Math.PI;
  private relYawFrom = Math.PI;
  private pitch = 0;
  /** 0 the hands go where the script says, 1 they go to its body: eased, so taking hold and letting go are never a jump. */
  private onBody = 0;
  private onBodyWant = 0;
  private readonly gripLocal = [new THREE.Vector3(), new THREE.Vector3()];
  private hasGrips = false;
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly c = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly qi = new THREE.Quaternion();

  constructor(
    private readonly child: Traveller,
    private readonly cygnet: Cygnet,
  ) {}

  get busy(): boolean {
    return this.duet !== null;
  }

  /** What is being played, for the camera and for QA. */
  get playing(): string {
    return this.duet ? `${this.duet.name}:${this.duet.beat}` : '';
  }

  /**
   * The first time, and any time it is frightened: down on the knees, both hands offered low and then held still
   * while it makes up its mind, and only then the scoop, the lift, a look at each other, and in to the chest.
   */
  gatherUp(onDone?: () => void): void {
    const { child: c, cygnet: k } = this;
    const wary = () => THREE.MathUtils.clamp(k.frightened * 1.2 + (1 - k.bond) * 0.5, 0, 1);
    const leanFrom = { value: 0 };
    const seat = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    const qFrom = new THREE.Quaternion();
    this.play('gather', [
      {
        /** The last steps are walked, to a spot an arm and a half from it: you do not arrive on top of something that small. */
        name: 'approach',
        dur: 6,
        enter: () => {
          const away = this.a.copy(c.position).sub(k.position).setY(0);
          const gap = away.length();
          if (gap > STANDOFF - 0.12 && gap < STANDOFF + 0.12) return;
          away.normalize();
          c.walkTo(k.position.x + away.x * STANDOFF, k.position.z + away.z * STANDOFF, false, undefined, 0.08);
        },
        until: () => !c.moving,
      },
      {
        name: 'kneel',
        dur: 0.9,
        enter: () => {
          c.stop();
          c.faceToward(k.position.x, k.position.z, 1);
          c.kneeling = 1;
          k.watch(c.face(new THREE.Vector3()));
        },
        update: () => this.regard(),
      },
      {
        name: 'offer',
        dur: 1.1,
        enter: () => this.lead(Math.PI, OFFER),
        update: (kk) => {
          /** Low and open and a little short of it: an offer, not a grab. The hands stop where a kneeling child's hands stop. */
          c.lean = 0.42 * kk;
          this.regard();
        },
      },
      { name: 'wait', dur: 2.6, until: (t) => t > 0.7 + wary() * 1.6, update: () => this.regard() },
      {
        /** It gets into the hands by itself. Nothing about this is done to it. */
        name: 'step-up',
        dur: 0.75,
        enter: () => {
          this.relYawFrom = this.relYaw = wrap(k.seating.yaw - c.yaw);
          k.takeUp(true);
        },
        update: (_kk, t) => {
          /** The hands give a little as its weight arrives, and come back up. */
          this.dip = t > 0.5 ? 0.045 * Math.sin(Math.min(1, (t - 0.5) / 0.25) * Math.PI) : 0;
          this.regard();
        },
        exit: () => {
          this.dip = 0;
          this.lead(this.relYaw);
        },
      },
      {
        name: 'lift',
        dur: 1.25,
        enter: () => {
          leanFrom.value = c.lean;
          this.goal = null;
        },
        update: (kk) => {
          c.kneeling = 1 - kk;
          c.lean = lerp(leanFrom.value, 0.06, kk);
          this.centre.lerpVectors(this.centreFrom, PRESENT, kk);
          this.spacing = lerp(this.spacingFrom, 0.36, kk);
          this.relYaw = lerpAngle(this.relYawFrom, Math.PI, kk);
          this.pitch = -0.25 * kk;
          this.regard();
        },
      },
      {
        name: 'regard',
        dur: 1.3,
        enter: () => k.bind(0.02),
        update: (kk) => {
          c.tilt = 0.16 * Math.sin(kk * Math.PI);
          this.regard();
        },
      },
      {
        name: 'in',
        dur: 1.0,
        enter: () => {
          this.lead(this.relYaw);
          qFrom.copy(k.seating.shown.q);
        },
        /** It is carried to exactly where the seat will have it, so taking its seat is not a movement at all. */
        update: (kk) => {
          k.seatFrame('cradle', seat);
          const belly = this.bellyFrom(seat.p, seat.q, this.b);
          this.centre.lerpVectors(this.centreFrom, c.toBody(belly, this.a), kk);
          this.turnTo = this.turn.slerpQuaternions(qFrom, seat.q, kk);
          c.lean = 0.06 * (1 - kk);
          this.regard();
        },
        exit: () => {
          this.leading = false;
          this.turnTo = null;
          k.rideIn('cradle');
          c.tilt = 0;
        },
      },
      { name: 'settle', dur: 0.6, update: () => this.regard(), exit: () => this.atEase() },
    ], onDone);
  }

  /**
   * Down on the knees, it is lowered to the grass in both hands, steps off, and the hands come away. `facing` is the
   * way it should be standing when it is left there, if that matters.
   */
  setDown(onDone?: () => void, facing?: number): void {
    const { child: c, cygnet: k } = this;
    const spot = new THREE.Vector3();
    const leanFrom = { value: 0 };
    this.play('set-down', [
      {
        name: 'kneel',
        dur: 0.9,
        enter: () => {
          c.stop();
          c.kneeling = 1;
        },
        exit: () => {
          k.takeUp();
          this.lead(k.seating.yaw - c.yaw);
          spot.set(c.position.x + Math.sin(c.yaw) * STANDOFF, 0, c.position.z + Math.cos(c.yaw) * STANDOFF);
        },
      },
      {
        name: 'lower',
        dur: 1.2,
        update: (kk) => {
          c.lean = 0.42 * kk;
          this.centre.lerpVectors(this.centreFrom, OFFER, kk);
          this.pitch = lerp(-0.18, 0, kk);
          if (facing !== undefined) this.relYaw = lerpAngle(this.relYawFrom, facing - c.yaw, kk);
        },
      },
      {
        name: 'step-off',
        dur: 0.7,
        enter: () => {
          k.release(spot);
          this.leading = false;
          this.onBodyWant = 0;
        },
      },
      {
        name: 'let-go',
        dur: 0.7,
        enter: () => {
          leanFrom.value = c.lean;
          c.reachFor(0, null);
          c.reachFor(1, null);
          k.watch(c.face(new THREE.Vector3()));
        },
        update: (kk) => {
          c.lean = leanFrom.value * (1 - kk);
        },
      },
      { name: 'rise', dur: 0.8, enter: () => (c.kneeling = 0), exit: () => this.atEase() },
    ], onDone);
  }

  /** From the arms into the satchel: it climbs over their right shoulder, with a hand under it for as far as the hand can reach. */
  stow(onDone?: () => void): void {
    const { child: c, cygnet: k } = this;
    this.play('stow', [
      {
        name: 'climb',
        dur: 1.75,
        enter: () => k.rideIn('satchel'),
        update: (kk) => {
          this.onBodyWant = kk < 0.4 ? 1 : 0;
          c.tilt = -0.24 * Math.sin(kk * Math.PI);
          c.lean = 0.1 * Math.sin(kk * Math.PI);
          c.lookAt = kk < 0.55 ? k.eye(this.a) : null;
        },
        exit: () => this.atEase(),
      },
    ], onDone);
  }

  /** Out of the satchel and round into the arms, which come up to meet it. */
  unstow(onDone?: () => void): void {
    const { child: c, cygnet: k } = this;
    this.play('unstow', [
      {
        name: 'climb',
        dur: 1.75,
        enter: () => k.rideIn('cradle'),
        update: (kk) => {
          c.tilt = -0.24 * Math.sin(kk * Math.PI);
          c.lookAt = kk > 0.45 ? k.eye(this.a) : null;
        },
        exit: () => this.atEase(),
      },
    ], onDone);
  }

  /** Where the child's hands are while they are being held out to it, for it to look at; null the rest of the time. */
  offering(out: THREE.Vector3): THREE.Vector3 | null {
    if (!this.duet || !this.leading || this.cygnet.carried) return null;
    return this.child.mitten(0, out).add(this.child.mitten(1, this.a)).multiplyScalar(0.5);
  }

  /** QA: how far the worse of the two mittens is from the place on its body it should be resting, or null when they are not holding it. */
  get contactGap(): number | null {
    const { child: c } = this;
    let worst = 0;
    /** Hands still on their way to it are not yet holding it. */
    if (c.reached(0) < 0.985 || c.reached(1) < 0.985) return null;
    if (this.leading) {
      /** It goes where the mittens are, so the only way to lose it is for a mitten to fall short of where it was sent. */
      for (const hand of [0, 1] as const) {
        const sent = c.fromBody(this.a.copy(this.centre).setX(this.centre.x + (hand === 0 ? 0.5 : -0.5) * this.spacing), this.a);
        worst = Math.max(worst, c.mitten(hand, this.gapAt).distanceTo(sent));
      }
      return worst;
    }
    if (this.onBody < 0.95 || this.cygnet.seating.move) return null;
    for (const hand of [0, 1] as const) worst = Math.max(worst, c.mitten(hand, this.gapAt).distanceTo(this.palmOn(hand, 'cradle', this.a)));
    return worst;
  }

  private readonly gapAt = new THREE.Vector3();

  /** After the child has been posed and before the cygnet is: the hands lead here. */
  update(dt: number): void {
    const { child: c, cygnet: k } = this;
    this.duet?.update(dt);
    if (this.duet?.done) this.duet = null;
    c.armsFull = this.leading || this.onBody > 0.5;
    if (!this.duet) this.answer(dt);

    if (this.leading) {
      if (this.goal) {
        this.goalK = Math.min(1, this.goalK + dt / 1.0);
        const e = this.goalK * this.goalK * (3 - 2 * this.goalK);
        this.centre.lerpVectors(this.centreFrom, this.goal, e);
        this.spacing = lerp(this.spacingFrom, 0.36, e);
      }
      this.centre.y -= this.dip - this.dipWas;
      this.dipWas = this.dip;
      for (const hand of [0, 1] as const) c.reachLocal(hand, this.a.copy(this.centre).setX(this.centre.x + (hand === 0 ? 0.5 : -0.5) * this.spacing));
      /** It goes where the mittens actually are, not where they were sent, so a reach that falls short still holds it. */
      const mid = c.mitten(0, this.a).add(c.mitten(1, this.b)).multiplyScalar(0.5);
      if (this.turnTo) this.q.copy(this.turnTo);
      else this.q.setFromAxisAngle(UP, c.yaw + this.relYaw).multiply(this.qi.setFromAxisAngle(this.b.set(1, 0, 0), this.pitch));
      const belly = k.grip('bellyL', this.b).add(k.grip('bellyR', this.c)).multiplyScalar(0.5).sub(k.seating.shown.p);
      belly.applyQuaternion(this.qi.copy(k.seating.shown.q).invert()).applyQuaternion(this.q);
      if (k.seating.held) k.seating.hold(mid.sub(belly), this.q);
      return;
    }

    /** In the arms the mittens belong on it: under the breast and under the rump, wherever those are this frame. */
    if (!this.duet) this.onBodyWant = k.seat === 'cradle' && !k.seating.move ? 1 : 0;
    this.onBody += (this.onBodyWant - this.onBody) * (1 - Math.exp(-dt * 6));
    if (this.onBody > 0.02 && this.hasGrips) {
      c.reachLocal(0, this.gripLocal[0]);
      c.reachLocal(1, this.gripLocal[1]);
    } else if (!this.duet && this.onBodyWant === 0 && this.onBody <= 0.02 && this.held) {
      c.reachFor(0, null);
      c.reachFor(1, null);
      this.held = false;
    }
    if (this.onBody > 0.02) this.held = true;
  }

  private held = false;
  private mindful = 0;
  private wasAsleep = false;
  private wasAct: string | null = null;

  /**
   * The child's half of the small things: a head tipped into a nuzzle, a hunch over it when it is frightened, a look
   * down when it goes to sleep or cranes round their shoulder. Each is a second or two and then the child goes back
   * to whatever the story had them doing. It is these, more than the big moments, that make them two.
   */
  private answer(dt: number): void {
    const { child: c, cygnet: k } = this;
    if (!k.visible || !k.carried) {
      if (this.mindful > 0) this.relax();
      return;
    }
    const act = k.mind.act;
    const asleep = k.asleep;
    if (act !== this.wasAct && (act === 'nuzzle' || act === 'peer' || act === 'flinch')) this.mindful = act === 'peer' ? 1.4 : 2.4;
    if (asleep && !this.wasAsleep) this.mindful = 2.6;
    this.wasAct = act;
    this.wasAsleep = asleep;
    if (this.mindful <= 0) return;
    this.mindful -= dt;
    c.lookAt = k.eye(this.regardAt);
    /** In the arms its head is at their left shoulder, so that is the way their own head goes. */
    c.tilt = act === 'nuzzle' ? -0.2 : 0;
    c.lean = k.frightened > 0.45 && k.seat === 'cradle' ? 0.1 : 0;
    if (this.mindful <= 0) this.relax();
  }

  private relax(): void {
    this.mindful = 0;
    this.child.tilt = 0;
    this.child.lean = 0;
    this.child.lookAt = null;
  }
  private goal: THREE.Vector3 | null = null;
  private goalK = 0;
  private dip = 0;
  private dipWas = 0;
  /** While set, the way it faces in the hands is this and nothing else. */
  private turnTo: THREE.Quaternion | null = null;
  private readonly turn = new THREE.Quaternion();

  /** Where the middle of its belly would be if its origin were at `p` facing `q`: the point the hands carry it by. */
  private bellyFrom(p: THREE.Vector3, q: THREE.Quaternion, out: THREE.Vector3): THREE.Vector3 {
    const k = this.cygnet;
    out.copy(k.grip('bellyL', out)).add(k.grip('bellyR', this.c)).multiplyScalar(0.5).sub(k.seating.shown.p);
    return out.applyQuaternion(this.qi.copy(k.seating.shown.q).invert()).applyQuaternion(q).add(p);
  }

  /** After the cygnet has been posed: where its body now is, in the child's frame, for the mittens to be on next frame. */
  after(): void {
    const { child: c, cygnet: k } = this;
    if (!k.visible || !k.carried) {
      this.hasGrips = false;
      return;
    }
    c.toBody(this.palmOn(0, 'cradle', this.a), this.gripLocal[0]);
    c.toBody(this.palmOn(1, 'cradle', this.a), this.gripLocal[1]);
    this.hasGrips = true;
  }

  /** Where a mitten's middle goes to be resting on it: a palm's depth out from the grip, on the side that hand comes from. */
  private palmOn(hand: 0 | 1, how: 'belly' | 'cradle', out: THREE.Vector3): THREE.Vector3 {
    const { child: c, cygnet: k } = this;
    if (how === 'cradle') {
      k.grip(hand === 0 ? 'breast' : 'rump', out);
      out.y -= PALM * 0.6;
      return out.addScaledVector(this.b.set(Math.sin(c.yaw), 0, Math.cos(c.yaw)), PALM * 0.5);
    }
    /** Each hand takes whichever side of the belly is nearer to it, so it can be picked up facing any way. */
    const mine = c.mitten(hand, this.b);
    const left = k.grip('bellyL', this.c);
    const right = k.grip('bellyR', out);
    const centre = this.q1.copy(left).add(right).multiplyScalar(0.5);
    const near = mine.distanceToSquared(left) < mine.distanceToSquared(right) ? left : right;
    return out.copy(near).addScaledVector(this.b.copy(near).sub(centre).normalize(), PALM);
  }

  private readonly q1 = new THREE.Vector3();

  /** The hands take over from wherever they are now, and if given somewhere to go, set off for it. */
  private lead(relYaw: number, to?: THREE.Vector3): void {
    const { child: c } = this;
    if (this.leading) {
      /** Already leading: carry on from where the hands were being sent, which is not quite where they have got to. */
      this.centreFrom.copy(this.centre);
      this.spacingFrom = this.spacing;
    } else {
      const m0 = c.toBody(c.mitten(0, this.a), this.a);
      const m1 = c.toBody(c.mitten(1, this.b), this.b);
      this.centreFrom.copy(m0).add(m1).multiplyScalar(0.5);
      this.centre.copy(this.centreFrom);
      this.spacingFrom = this.spacing = Math.abs(m0.x - m1.x);
    }
    this.relYawFrom = this.relYaw = wrap(relYaw);
    this.leading = true;
    this.goal = to ?? null;
    this.goalK = 0;
  }

  /** They look at each other: the child at its eye, it at the child's face. */
  private regard(): void {
    const { child: c, cygnet: k } = this;
    c.lookAt = k.eye(this.regardAt);
    k.watch(c.face(this.faceAt));
  }

  private readonly regardAt = new THREE.Vector3();
  private readonly faceAt = new THREE.Vector3();

  private atEase(): void {
    const { child: c, cygnet: k } = this;
    c.lookAt = null;
    c.tilt = 0;
    c.lean = 0;
    c.kneeling = 0;
    k.watch(null);
  }

  private play(name: string, beats: Beat[], onDone?: () => void): void {
    this.duet = new Duet(name, beats, onDone);
  }
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

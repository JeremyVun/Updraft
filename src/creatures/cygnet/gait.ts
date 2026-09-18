import * as THREE from 'three';
import { SIZE } from './body';

interface Foot {
  /** Where the ankle is over the ground, in the world. While planted this does not move: that is the whole point. */
  at: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  planted: boolean;
  /** 0 to 1 through the swing. */
  swing: number;
  /** How high the foot is off the ground this frame. */
  lift: number;
  wasUp: boolean;
}

const foot = (): Foot => ({ at: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), planted: true, swing: 0, lift: 0, wasUp: false });

/** How far either side of its middle the feet come down: wider than the hips, which is what makes it a waddle. */
const TRACK = 0.078 * SIZE;
const STANCE = 0.6;
/** Steps a second, per foot, past which it is no longer stepping. */
const PATTER = 4.5;

/**
 * Walking as feet, not as a cycle. Each foot is put down somewhere in the world and stays exactly there until it is
 * picked up again, and the body is carried over it; how fast the legs go is set by how far it has travelled, never
 * by the clock. A foot that does not slide is most of what makes something small look like it has weight.
 */
export class Gait {
  readonly feet: [Foot, Foot] = [foot(), foot()];
  /** The body over the feet: shifted toward the standing foot, rolled over it, the hips swung round with the free leg, and the dip between steps. */
  sway = 0;
  roll = 0;
  twist = 0;
  dip = 0;
  /** 0 standing still to 1 flat out, for anything that scales with effort. */
  pace = 0;
  /** Feet that came down this frame, for whoever makes the sound of it. */
  footfalls = 0;
  private phase = 0;
  private readonly prev = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly vel = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private fresh = true;
  private yawWas = 0;
  private idle = 0;
  /** 0 stepping to 1 pattering, eased, for the body to lean and the wings to come out. */
  pattering = 0;

  /** Both feet under it where it stands, with nothing carried over from wherever it was before. */
  reset(position: THREE.Vector3, yaw: number): void {
    this.frame(yaw);
    for (const [i, f] of this.feet.entries()) {
      f.at.copy(position).addScaledVector(this.side, i === 0 ? TRACK : -TRACK);
      f.planted = true;
      f.lift = 0;
      f.swing = 0;
    }
    this.prev.copy(position);
    this.yawWas = yaw;
    this.vel.set(0, 0, 0);
    this.phase = 0;
    this.sway = this.roll = this.twist = this.dip = 0;
    this.fresh = false;
  }

  update(dt: number, position: THREE.Vector3, yaw: number, ground: (x: number, z: number) => number): void {
    if (this.fresh || position.distanceToSquared(this.prev) > 4) this.reset(position, yaw);
    this.footfalls = 0;
    if (dt <= 0) return;
    this.frame(yaw);
    this.tmp.copy(position).sub(this.prev).setY(0);
    /** Turning on the spot takes steps too: each foot has to go round the body, and that is as far as walking it. */
    const turned = Math.abs(Math.atan2(Math.sin(yaw - this.yawWas), Math.cos(yaw - this.yawWas)));
    this.yawWas = yaw;
    const moved = this.tmp.length() + turned * TRACK * 1.6;
    this.vel.lerp(this.tmp.divideScalar(dt), 1 - Math.exp(-dt * 12));
    this.prev.copy(position);
    const speed = this.vel.length();
    this.pace = Math.min(1, speed / 4.2);

    /**
     * Its legs are a hand's breadth long, so a step is short and the only way to go faster is to take more of them.
     * Past about nine a second they stop being steps: it patters, feet a blur under it and wings out, and nothing
     * about that is planted. Below that every foot is put down and left where it is.
     */
    const stride = (0.11 + 0.04 * this.pace) * SIZE;
    const stepping = speed > 0.06 || turned > 0.004;
    const rate = speed / (stride * 2);
    this.pattering += ((rate > PATTER ? 1 : 0) - this.pattering) * (1 - Math.exp(-dt * 10));
    const patter = this.pattering > 0.5;
    if (stepping) {
      this.phase = (this.phase + (patter ? PATTER * dt : moved / (stride * 2))) % 1;
      this.idle = 0;
    } else this.idle += dt;

    for (const [i, f] of this.feet.entries()) {
      const mine = (this.phase + (i === 0 ? 0 : 0.5)) % 1;
      const out = i === 0 ? TRACK : -TRACK;
      const home = this.tmp.copy(position).addScaledVector(this.side, out);
      if (stepping && patter) {
        /** Carried along under the body: back while it is down, forward through the air. */
        const a = mine * Math.PI * 2;
        f.planted = false;
        f.at.copy(home).addScaledVector(this.fwd, Math.cos(a) * 0.075 * SIZE);
        f.lift = Math.max(0, -Math.sin(a)) * 0.05 * SIZE;
        if (f.lift <= 0 && f.wasUp) this.footfalls++;
        f.wasUp = f.lift > 0;
      } else if (stepping) {
        const swinging = mine > STANCE;
        if (swinging && f.planted) {
          f.planted = false;
          f.from.copy(f.at);
        }
        if (swinging) {
          f.swing = (mine - STANCE) / (1 - STANCE);
          /** Aimed at where the body will be when the foot comes down, so it lands as far ahead of the hip as it will leave behind it. */
          const stillToGo = (1 - f.swing) * (1 - STANCE) * stride * 2;
          f.to.copy(home).addScaledVector(this.fwd, stillToGo + STANCE * stride);
          const k = f.swing * f.swing * (3 - 2 * f.swing);
          f.at.lerpVectors(f.from, f.to, k);
          f.lift = Math.sin(f.swing * Math.PI) * (0.03 + 0.02 * this.pace) * SIZE;
        } else if (!f.planted) {
          f.planted = true;
          f.lift = 0;
          this.footfalls++;
        }
      } else if (f.planted && f.at.distanceTo(home) > 0.06 * SIZE && this.other(i).planted && this.idle > 0.12) {
        /** Standing, a foot left out of place is shuffled back under it, one at a time. */
        f.planted = false;
        f.from.copy(f.at);
        f.swing = 0;
      } else if (!f.planted) {
        f.swing = Math.min(1, f.swing + dt / 0.22);
        f.to.copy(home);
        const k = f.swing * f.swing * (3 - 2 * f.swing);
        f.at.lerpVectors(f.from, f.to, k);
        f.lift = Math.sin(f.swing * Math.PI) * 0.025 * SIZE;
        if (f.swing >= 1) {
          f.planted = true;
          f.lift = 0;
          this.footfalls++;
        }
      }
      f.at.y = Math.max(ground(f.at.x, f.at.z), 0) + f.lift;
    }

    /** Over whichever foot is down, rolled onto it, with the hips following the free leg round. */
    const [l, r] = this.feet;
    const lean = (l.planted ? 1 : 0) - (r.planted ? 1 : 0);
    const amount = stepping ? 1 : 0.4;
    /** How fast the body answers the feet. Slower than instant is what gives the waddle its weight, and it cannot snap. */
    const follow = 1 - Math.exp(-dt * (6.5 + 6 * this.pace));
    this.sway += (lean * 0.022 * amount - this.sway) * follow;
    this.roll += (-lean * (0.13 - 0.05 * this.pace) * amount - this.roll) * follow;
    this.twist += (lean * 0.12 * amount - this.twist) * follow;
    const down = l.planted && r.planted ? 1 : 0;
    this.dip += ((stepping ? down * 0.008 : 0) - this.dip) * follow;
  }

  private other(i: number): Foot {
    return this.feet[1 - i];
  }

  private frame(yaw: number): void {
    this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
  }
}

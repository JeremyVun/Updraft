import * as THREE from 'three';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import { feltWind, type WindField, type WindSample } from '../wind/field';
import { heightAt } from './island';
import { ROTARY_PATH } from './lines-layout';

const K = tuning.rotaryWashing;
export const ROTARY_SHEET_INTERVALS = [[0.04, 0.46], [0.54, 0.96]] as const;
const ground = (x: number, z: number) => new THREE.Vector3(x, heightAt(x, z), z);
const turnGap = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const ROTARY_FOOT = ground(K.x, K.z);
export const ROTARY_TOP = ROTARY_FOOT.clone().add(new THREE.Vector3(0, K.top, 0));
export const ROTARY_BEFORE = ground(ROTARY_PATH[0].x, ROTARY_PATH[0].z);
export const ROTARY_BIRD = ground(ROTARY_BEFORE.x + 1, ROTARY_BEFORE.z - 0.2);
export const ROTARY_ROUTE = ROTARY_PATH.slice(1).map(p => ground(p.x, p.z));
export const ROTARY_AFTER = ROTARY_ROUTE[ROTARY_ROUTE.length - 1];

export class RotaryFrame {
  readonly foot: THREE.Vector3;
  readonly top: THREE.Vector3;
  readonly snagPoint: THREE.Vector3;
  readonly touchedAt = new THREE.Vector3();
  angle = 0;
  speed = 0;
  unhook = 0;
  aligned = false;
  settled = 0;
  brushAge = Infinity;
  liftAge = Infinity;
  private direction = 0;
  private strokeWind = 0;
  private readonly strokeDirection = new THREE.Vector2();
  private readonly motion = new THREE.Vector2();
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly point = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly along = new THREE.Vector3();

  constructor(readonly index: number, x: number, z: number, readonly goal: number) {
    this.foot = ground(x, z);
    this.top = this.foot.clone().add(new THREE.Vector3(0, K.top, 0));
    this.snagPoint = ground(x + K.snagSide, z + K.snagAhead).add(new THREE.Vector3(0, 3.2, 0));
    this.reset();
  }

  get ready(): boolean { return this.unhook === 1; }
  get open(): boolean { return this.aligned && this.settled >= K.settleSeconds; }
  get liftTarget(): THREE.Vector3 | null { return this.unhook < 1 ? this.snagPoint : null; }

  reset(open = false): void {
    this.angle = open ? this.goal : K.startAngle;
    this.unhook = open || !this.index ? 1 : 0;
    this.speed = 0; this.aligned = open; this.settled = open ? K.settleSeconds : 0;
    this.brushAge = this.liftAge = Infinity; this.direction = this.strokeWind = 0;
  }

  clothPoint(side: number, fraction: number, drop: number, out: THREE.Vector3): THREE.Vector3 {
    const x = K.radius * fraction, z = side * K.radius * (1 - fraction);
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return out.set(this.foot.x + x * c + z * s, this.foot.y + K.top - drop, this.foot.z + z * c - x * s);
  }

  hit(camera: THREE.Camera, input: PointerInput): number {
    if (this.aligned) return Infinity;
    let nearest = Infinity, closest = 0.08;
    for (const side of [-1, 1]) for (const fraction of [0.12, 0.25, 0.38, 0.62, 0.75, 0.88]) for (const drop of [0.7, 1.7, 2.7, 3.7, 4.5]) {
      this.clothPoint(side, fraction, drop, this.point);
      if (this.projected.copy(this.point).project(camera).z > 1) continue;
      const touch = screenBrush(camera, this.point, input.prevNdc, input.ndc, K.brushRadius);
      const distance = this.point.distanceToSquared(camera.position);
      if (touch > closest) { closest = touch; nearest = distance; this.touchedAt.copy(this.point); }
    }
    return nearest;
  }

  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    this.tangent.set(this.touchedAt.z - this.foot.z, 0, this.foot.x - this.touchedAt.x).normalize();
    this.projected.copy(this.touchedAt).project(camera);
    this.along.copy(this.touchedAt).add(this.tangent).project(camera).sub(this.projected);
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1;
    const dx = (input.ndc.x - input.prevNdc.x) * aspect, dy = input.ndc.y - input.prevNdc.y;
    this.motion.set(dx, dy).normalize();
    // Crossing a turning sheet's edge must not reverse an uninterrupted gust.
    if (this.brushAge >= K.airMemory || this.motion.dot(this.strokeDirection) < 0.5 || !this.direction) {
      this.direction = Math.sign(dx * this.along.x * aspect + dy * this.along.y);
    }
    this.strokeDirection.copy(this.motion);
    this.strokeWind = Math.min(input.gust, 14);
    this.brushAge = 0;
    const force = this.direction * this.strokeWind;
    wind.addSplat({ source: this, ax: this.touchedAt.x, az: this.touchedAt.z,
      bx: this.touchedAt.x, bz: this.touchedAt.z, vx: this.tangent.x * force, vz: this.tangent.z * force,
      radius: K.windRadius, energy: Math.min(K.brushEnergy, Math.abs(force) / K.energyDivisor), swirl: 0, lift: 0 });
  }

  update(dt: number, wind: WindField, active: boolean): void {
    this.brushAge += dt; this.liftAge += dt;
    const target = this.liftTarget;
    if (active && target && this.liftAge < K.airMemory) {
      const w = feltWind(wind.sample(target.x, target.z, this.sample), wind.calm);
      const lift = THREE.MathUtils.smoothstep(w.lift, K.liftFrom, K.liftFull);
      this.unhook = Math.min(1, this.unhook + lift * K.unhookRate * dt);
    }
    if (this.aligned) {
      const before = this.angle;
      this.angle += turnGap(this.goal, this.angle) * (1 - Math.exp(-dt * K.catchRate));
      this.speed = (this.angle - before) / Math.max(dt, 1e-6);
      this.settled += dt;
      return;
    }
    if (active && this.brushAge < K.airMemory) {
      const w = feltWind(wind.sample(this.touchedAt.x, this.touchedAt.z, this.sample), wind.calm);
      // The submitted local gust answers immediately while its GPU sample is still in flight.
      const air = Math.max(Math.hypot(w.x, w.z) * THREE.MathUtils.smoothstep(w.energy, K.energyFrom, K.energyFull), this.strokeWind * K.strokeGain);
      this.speed += this.direction * air * K.torque * dt;
    }
    this.speed = THREE.MathUtils.clamp(this.speed * Math.exp(-dt * K.friction), -K.maxSpeed, K.maxSpeed);
    this.angle += this.speed * dt;
    if (this.unhook < 1) {
      const limited = THREE.MathUtils.clamp(this.angle, K.startAngle - K.snagTurn, K.startAngle + K.snagTurn);
      if (limited !== this.angle) { this.angle = limited; this.speed *= 0.1; }
    }
    if (this.ready && Math.abs(turnGap(this.goal, this.angle)) < K.catchAngle) this.aligned = true;
  }
}

export class RotaryWashing {
  readonly rotors = [new RotaryFrame(0, K.x, K.z, Math.PI), new RotaryFrame(1, K.farX, K.farZ, 0)];
  active = false;
  get open(): boolean { return this.rotors.every(r => r.open); }
  get caught(): boolean { return this.rotors.every(r => r.aligned); }
  get updraftTarget(): THREE.Vector3 | null { return this.active ? this.rotors.find(r => r.liftTarget)?.liftTarget ?? null : null; }
  reset(open = false): void { this.active = false; this.rotors.forEach(r => r.reset(open)); }
  update(dt: number, wind: WindField): void { this.rotors.forEach(r => r.update(dt, wind, this.active)); }

  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if (!this.active || input.muted || !input.present || input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    const target = this.updraftTarget;
    if (target && input.charge > 0.12 && input.updraftAt.distanceToSquared(target) < K.liftRadius ** 2) {
      const r = this.rotors.find(r => r.liftTarget === target)!;
      r.liftAge = 0;
      return;
    }
    if (input.gust < K.brushFrom) return;
    let nearest = Infinity, rotor: RotaryFrame | null = null;
    for (const r of this.rotors) {
      const distance = r.hit(camera, input);
      if (distance < nearest) { nearest = distance; rotor = r; }
    }
    rotor?.brush(camera, input, wind);
  }
}

export const rotaryWashing = new RotaryWashing();

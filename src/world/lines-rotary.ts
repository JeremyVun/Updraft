import * as THREE from 'three';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import { feltWind, type WindField, type WindSample } from '../wind/field';
import { heightAt } from './island';
import { ROTARY_PATH, ROTARY_INSIDE_PLACE } from './lines-layout';

const K = tuning.rotaryWashing;
export const ROTARY_SHEET_INTERVALS = [[0.04, 0.46], [0.54, 0.96]] as const;
const ground = (x: number, z: number) => new THREE.Vector3(x, heightAt(x, z), z);
const turnGap = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const ROTARY_FOOT = ground(K.x, K.z);
export const ROTARY_TOP = ROTARY_FOOT.clone().add(new THREE.Vector3(0, K.top, 0));
export const ROTARY_BEFORE = ground(ROTARY_PATH[0].x, ROTARY_PATH[0].z);
export const ROTARY_BIRD = ground(ROTARY_BEFORE.x + 1, ROTARY_BEFORE.z - 0.2);
export const ROTARY_INSIDE = ground(ROTARY_INSIDE_PLACE.x, ROTARY_INSIDE_PLACE.z);
export const ROTARY_INSIDE_BIRD = ground(ROTARY_INSIDE.x + 0.9, ROTARY_INSIDE.z - 0.7);
export const ROTARY_ROUTE = ROTARY_PATH.slice(1).map(p => ground(p.x, p.z));
export const ROTARY_AFTER = ROTARY_ROUTE[ROTARY_ROUTE.length - 1];

export class RotaryFrame {
  readonly foot: THREE.Vector3;
  readonly top: THREE.Vector3;
  readonly snagPoint: THREE.Vector3;
  readonly snagFoot: THREE.Vector3;
  readonly touchedAt = new THREE.Vector3();
  angle = 0;
  speed = 0;
  unhook = 0;
  aligned = false;
  settled = 0;
  brushAge = Infinity;
  snagAge = Infinity;
  snagWind = 0;
  private bearingTravel = 0;
  private strokeWind = 0;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly point = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();

  constructor(readonly index: number, x: number, z: number, readonly goal: number) {
    this.foot = ground(x, z);
    this.top = this.foot.clone().add(new THREE.Vector3(0, K.top, 0));
    this.snagFoot = ground(x + K.snagSide, z + K.snagAhead);
    this.snagPoint = this.snagFoot.clone().add(new THREE.Vector3(0, 3.2, 0));
    this.reset();
  }

  get ready(): boolean { return this.unhook === 1; }
  get open(): boolean { return this.aligned && this.settled >= K.settleSeconds; }
  get snagTarget(): THREE.Vector3 | null { return this.unhook < 1 ? this.snagPoint : null; }
  get preferredDirection(): number { return Math.sign(turnGap(this.goal, K.startAngle)); }
  get creaked(): boolean { return this.bearingTravel >= K.creakTravel; }

  reset(open = false): void {
    this.angle = open ? this.goal : K.startAngle;
    this.unhook = open || !this.index ? 1 : 0;
    this.speed = 0; this.aligned = open; this.settled = open ? K.settleSeconds : 0;
    this.brushAge = this.snagAge = Infinity; this.strokeWind = this.snagWind = 0;
    this.bearingTravel = open ? K.creakTravel : 0;
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

  brushSnag(camera: THREE.Camera, input: PointerInput): boolean {
    if (this.ready) return false;
    let touch = 0;
    for (let i = 0; i <= 8; i++) {
      this.point.lerpVectors(this.snagFoot, this.snagPoint, i / 8);
      touch = Math.max(touch, screenBrush(camera, this.point, input.prevNdc, input.ndc, K.snagBrushRadius));
    }
    const lift = input.charge > K.snagLiftFrom && Math.hypot(input.updraftAt.x - this.snagFoot.x,
      input.updraftAt.z - this.snagFoot.z) < K.snagLiftRadius;
    if (touch <= 0.1 && !lift) return false;
    this.snagAge = 0;
    this.snagWind = Math.max(input.gust, lift ? K.snagGustFull : 0);
    return true;
  }

  brush(input: PointerInput, wind: WindField): void {
    this.tangent.set(this.touchedAt.z - this.foot.z, 0, this.foot.x - this.touchedAt.x).normalize();
    this.strokeWind = Math.min(input.gust, 14);
    this.brushAge = 0;
    const force = this.preferredDirection * this.strokeWind;
    wind.addSplat({ source: this, ax: this.touchedAt.x, az: this.touchedAt.z,
      bx: this.touchedAt.x, bz: this.touchedAt.z, vx: this.tangent.x * force, vz: this.tangent.z * force,
      radius: K.windRadius, energy: Math.min(K.brushEnergy, Math.abs(force) / K.energyDivisor), swirl: 0, lift: 0 });
  }

  update(dt: number, wind: WindField, active: boolean): void {
    this.brushAge += dt; this.snagAge += dt;
    if (active && this.snagTarget && this.snagAge < K.airMemory) {
      const pull = THREE.MathUtils.smoothstep(this.snagWind, K.brushFrom, K.snagGustFull);
      this.unhook = Math.min(1, this.unhook + pull * K.unhookRate * dt);
    }
    if (this.aligned) {
      const error = turnGap(this.angle, this.goal), rate = K.catchRate;
      const spring = this.speed + rate * error, decay = Math.exp(-rate * dt);
      const remaining = Math.abs(error), direction = this.preferredDirection;
      const advance = THREE.MathUtils.clamp(((error + spring * dt) * decay - error) * direction, 0, remaining);
      this.angle += advance * direction;
      this.speed = advance < remaining ? Math.max(0, (this.speed - rate * spring * dt) * decay * direction) * direction : 0;
      this.settled += dt;
      return;
    }
    if (active && this.brushAge < K.airMemory) {
      const w = feltWind(wind.sample(this.touchedAt.x, this.touchedAt.z, this.sample), wind.calm);
      // The submitted local gust answers immediately while its GPU sample is still in flight.
      const air = Math.max(Math.hypot(w.x, w.z) * THREE.MathUtils.smoothstep(w.energy, K.energyFrom, K.energyFull), this.strokeWind * K.strokeGain);
      const drive = Math.min(1, air / K.driveFull);
      this.speed += this.preferredDirection * drive * K.torque * dt;
    }
    this.speed = THREE.MathUtils.clamp(this.speed * this.preferredDirection * Math.exp(-dt * K.friction), 0, K.maxSpeed) * this.preferredDirection;
    this.angle += this.speed * dt;
    if (this.unhook < 1) {
      const limited = THREE.MathUtils.clamp(this.angle, K.startAngle - K.snagTurn, K.startAngle + K.snagTurn);
      if (limited !== this.angle) { this.angle = limited; this.speed *= 0.1; }
    }
    if (active && this.ready) this.bearingTravel += Math.abs(this.speed) * dt;
    if (this.ready && Math.abs(turnGap(this.goal, this.angle)) < K.catchAngle) this.aligned = true;
  }
}

export class RotaryWashing {
  readonly rotors = [new RotaryFrame(0, K.x, K.z, Math.PI), new RotaryFrame(1, K.farX, K.farZ, 0)];
  active = false;
  activeRotor = -1;
  onSound: ((kind: 'creak' | 'release', at: THREE.Vector3) => void) | null = null;
  get open(): boolean { return this.rotors.every(r => r.open); }
  get caught(): boolean { return this.rotors.every(r => r.aligned); }
  get snagTarget(): THREE.Vector3 | null { return this.active ? this.rotors.find(r => (this.activeRotor < 0 || r.index === this.activeRotor) && r.snagTarget)?.snagTarget ?? null : null; }
  reset(open = false): void { this.active = false; this.activeRotor = -1; this.rotors.forEach(r => r.reset(open)); }
  update(dt: number, wind: WindField): void {
    for (const r of this.rotors) {
      const creaked = r.creaked, ready = r.ready;
      r.update(dt, wind, this.active && (this.activeRotor < 0 || r.index === this.activeRotor));
      if (!creaked && r.creaked) this.onSound?.('creak', r.top);
      if (!ready && r.ready) this.onSound?.('release', r.snagPoint);
    }
  }

  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if (!this.active || input.muted || !input.present || input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    const target = this.snagTarget;
    if (target) {
      const r = this.rotors.find(r => r.snagTarget === target)!;
      if (r.brushSnag(camera, input)) return;
    }
    if (input.gust < K.brushFrom) return;
    let nearest = Infinity, rotor: RotaryFrame | null = null;
    for (const r of this.rotors) {
      if (this.activeRotor >= 0 && r.index !== this.activeRotor) continue;
      const distance = r.hit(camera, input);
      if (distance < nearest) { nearest = distance; rotor = r; }
    }
    rotor?.brush(input, wind);
  }
}

export const rotaryWashing = new RotaryWashing();

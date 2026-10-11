import * as THREE from 'three';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import { feltWind, type WindField, type WindSample } from '../wind/field';
import { heightAt } from './island';

const K = tuning.rotaryWashing;
export const ROTARY_FOOT = new THREE.Vector3(K.x, heightAt(K.x, K.z), K.z);
export const ROTARY_TOP = ROTARY_FOOT.clone().add(new THREE.Vector3(0, K.top, 0));
const ground = (x: number, z: number) => new THREE.Vector3(x, heightAt(x, z), z);
export const ROTARY_BEFORE = ground(K.x + K.pathOffset, K.z + K.standBack);
export const ROTARY_BIRD = ground(ROTARY_BEFORE.x + 1.5, ROTARY_BEFORE.z - 0.2);
export const ROTARY_AFTER = ground(K.x + K.pathOffset, K.z - K.exitAhead);

export class RotaryWashing {
  angle = 0;
  speed = 0;
  active = false;
  caught = false;
  settled = 0;
  brushAge = Infinity;
  private direction = 0;
  readonly touchedAt = new THREE.Vector3();
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly point = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly along = new THREE.Vector3();

  get open(): boolean { return this.caught && this.settled >= K.settleSeconds; }

  reset(open = false): void {
    this.angle = open ? Math.PI : 0;
    this.speed = 0; this.active = false; this.caught = open;
    this.settled = open ? K.settleSeconds : 0;
    this.brushAge = Infinity;
    this.direction = 0;
  }

  clothPoint(side: number, fraction: number, drop: number, out: THREE.Vector3): THREE.Vector3 {
    const x = K.radius * fraction, z = side * K.radius * (1 - fraction);
    const c = Math.cos(this.angle), s = Math.sin(this.angle);
    return out.set(K.x + x * c + z * s, ROTARY_TOP.y - drop, K.z + z * c - x * s);
  }

  brush(camera: THREE.Camera, input: PointerInput, wind: WindField): void {
    if (!this.active || this.caught || input.muted || !input.present || input.gust < K.brushFrom ||
      input.ndc.distanceToSquared(input.prevNdc) < 1e-8) return;
    let best = 0, nearest = Infinity;
    for (const side of [-1, 1]) for (const fraction of [0.24, 0.5, 0.76]) for (const drop of [1, 2.4, 3.8]) {
      this.clothPoint(side, fraction, drop, this.point);
      const touch = screenBrush(camera, this.point, input.prevNdc, input.ndc, K.brushRadius);
      const distance = this.point.distanceToSquared(camera.position);
      if (touch > 0.04 && distance < nearest) { nearest = distance; best = touch; this.touchedAt.copy(this.point); }
    }
    if (best < 0.025) return;
    this.tangent.set(this.touchedAt.z - K.z, 0, K.x - this.touchedAt.x).normalize();
    this.projected.copy(this.touchedAt).project(camera);
    this.along.copy(this.touchedAt).add(this.tangent).project(camera).sub(this.projected);
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1;
    const dx = (input.ndc.x - input.prevNdc.x) * aspect, dy = input.ndc.y - input.prevNdc.y;
    const turn = dx * this.along.x * aspect + dy * this.along.y;
    const force = Math.sign(turn) * input.gust * Math.sqrt(best);
    this.direction = Math.sign(turn);
    this.brushAge = 0;
    wind.addSplat({ source: this, ax: this.touchedAt.x, az: this.touchedAt.z,
      bx: this.touchedAt.x, bz: this.touchedAt.z, vx: this.tangent.x * force, vz: this.tangent.z * force,
      radius: K.windRadius, energy: Math.min(K.brushEnergy, Math.abs(force) / K.energyDivisor), swirl: 0, lift: 0 });
  }

  update(dt: number, wind: WindField): void {
    this.brushAge += dt;
    if (this.caught) {
      const goal = Math.sign(this.angle) * Math.PI;
      const before = this.angle;
      this.angle += (goal - this.angle) * (1 - Math.exp(-dt * K.catchRate));
      this.speed = (this.angle - before) / Math.max(dt, 1e-6);
      this.settled += dt;
      return;
    }
    if (this.active && this.brushAge < K.airMemory) {
      const w = feltWind(wind.sample(this.touchedAt.x, this.touchedAt.z, this.sample), wind.calm);
      // The readback arrives after the touched sheet has moved; retain the stroke's side of the bearing.
      const force = this.direction * Math.hypot(w.x, w.z);
      this.speed += force * THREE.MathUtils.smoothstep(w.energy, K.energyFrom, K.energyFull) * K.torque * dt;
    }
    this.speed *= Math.exp(-dt * K.friction);
    this.speed = THREE.MathUtils.clamp(this.speed, -K.maxSpeed, K.maxSpeed);
    this.angle += this.speed * dt;
    if (Math.abs(this.angle) >= Math.PI - K.catchAngle) this.caught = true;
  }
}

export const rotaryWashing = new RotaryWashing();

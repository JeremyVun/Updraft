import * as THREE from 'three';
import type { WindField } from '../wind/field';
import { heightAt } from '../world/island';

const MAX_GUST = 26;
const HOLD_SCREEN_SPEED = 90;

/** Turns pointer motion into wind: gusts along the path, and an updraft while pressed and held still. */
export class PointerInput {
  readonly world = new THREE.Vector3();
  /** Pointer in normalised device coordinates this frame and last frame. */
  readonly ndc = new THREE.Vector2();
  readonly prevNdc = new THREE.Vector2();
  /** Current gust speed in world units/s after shaping (0 when idle), and its direction on the ground. */
  gust = 0;
  readonly gustDir = new THREE.Vector2(1, 0);
  /** Updraft charge, 0..1. */
  charge = 0;
  present = false;
  /**
   * Set while the story is playing a beat out on its own. The pointer still tracks, but it puts nothing into the
   * wind, so a scripted moment is not undercut by the player's own gusts whooshing and rippling the water.
   */
  muted = false;
  down = false;

  private readonly eventNdc = new THREE.Vector2();
  private readonly prev = new THREE.Vector3();
  private hasPrev = false;
  private readonly vel = new THREE.Vector2();
  private readonly instVel = new THREE.Vector2();
  private readonly ray = new THREE.Raycaster();
  private lastEvent = { x: 0, y: 0, t: 0 };
  private screenSpeed = 0;
  private stillTime = 0;
  private listeners: ((kind: 'down' | 'up') => void)[] = [];

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerdown', (e) => {
      this.down = true;
      this.present = true;
      if (e.pointerType !== 'mouse') this.hasPrev = false;
      this.move(e);
      el.setPointerCapture(e.pointerId);
      this.listeners.forEach((l) => l('down'));
    });
    const up = (e: PointerEvent) => {
      this.down = false;
      if (e.pointerType !== 'mouse') this.present = false;
      this.listeners.forEach((l) => l('up'));
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !this.down) this.present = false;
    });
  }

  onButton(listener: (kind: 'down' | 'up') => void): void {
    this.listeners.push(listener);
  }

  private move(e: PointerEvent): void {
    const rect = this.el.getBoundingClientRect();
    this.eventNdc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const now = performance.now();
    const dt = Math.max(1, now - this.lastEvent.t) / 1000;
    const inst = Math.hypot(e.clientX - this.lastEvent.x, e.clientY - this.lastEvent.y) / dt;
    this.screenSpeed = this.screenSpeed * 0.6 + Math.min(inst, 5000) * 0.4;
    this.lastEvent = { x: e.clientX, y: e.clientY, t: now };
    if (!this.present) this.hasPrev = false;
    this.present = true;
  }

  private pick(camera: THREE.Camera, out: THREE.Vector3): void {
    this.ray.setFromCamera(this.ndc, camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    const ground = (t: number) => o.y + d.y * t - Math.max(heightAt(o.x + d.x * t, o.z + d.z * t), 0);
    let prevT = 0;
    for (let t = 2; t < 700; t += 2) {
      if (ground(t) <= 0) {
        let lo = prevT;
        let hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          if (ground(mid) > 0) lo = mid;
          else hi = mid;
        }
        out.copy(d).multiplyScalar(hi).add(o);
        return;
      }
      prevT = t;
    }
    out.copy(d).multiplyScalar(700).add(o);
    out.y = 0;
  }

  update(dt: number, camera: THREE.Camera, wind: WindField): void {
    this.screenSpeed *= Math.exp(-dt * 10);
    if (!this.present || this.muted) {
      this.hasPrev = false;
      this.gust *= Math.exp(-dt * 6);
      this.charge = Math.max(0, this.charge - dt * 1.5);
      return;
    }
    this.prevNdc.copy(this.ndc);
    this.ndc.copy(this.eventNdc);
    this.pick(camera, this.world);
    if (!this.hasPrev) {
      this.prev.copy(this.world);
      this.prevNdc.copy(this.ndc);
      this.hasPrev = true;
      return;
    }

    const dx = this.world.x - this.prev.x;
    const dz = this.world.z - this.prev.z;
    this.vel.lerp(this.instVel.set(dx / dt, dz / dt), 1 - Math.exp(-dt * 30));
    const raw = this.vel.length() * (this.down ? 0.19 : 0.15);
    const speed = MAX_GUST * Math.tanh(raw / MAX_GUST);
    this.gust = speed;
    if (speed > 0.6) {
      const nx = this.vel.x / this.vel.length();
      const nz = this.vel.y / this.vel.length();
      this.gustDir.set(nx, nz);
      wind.addSplat({
        ax: this.prev.x,
        az: this.prev.z,
        bx: this.world.x,
        bz: this.world.z,
        vx: nx * speed,
        vz: nz * speed,
        radius: 3.4 + speed * 0.14,
        energy: Math.min(1, speed / 20) * 0.5,
        swirl: 0,
        lift: 0,
      });
    }

    const still = this.down && this.screenSpeed < HOLD_SCREEN_SPEED;
    this.stillTime = still ? this.stillTime + dt : 0;
    if (this.stillTime > 0.12) this.charge = Math.min(1, this.charge + dt * 0.55);
    else this.charge = Math.max(0, this.charge - dt * 1.2);
    if (this.charge > 0.01 && this.down) {
      wind.addSplat({
        ax: this.world.x,
        az: this.world.z,
        bx: this.world.x,
        bz: this.world.z,
        vx: 0,
        vz: 0,
        radius: 5 + this.charge * 4,
        energy: 0,
        swirl: 16 + this.charge * 30,
        lift: 1.0 + this.charge * 2.2,
      });
    }
    this.prev.copy(this.world);
  }
}

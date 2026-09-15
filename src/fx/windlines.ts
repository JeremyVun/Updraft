import * as THREE from 'three';
import type { WindField, WindSample } from '../wind/field';
import { heightAt, surfaceHeight } from '../world/island';
import { RibbonBatch, type Ribbon } from './ribbons';

interface Line extends Ribbon {
  head: THREE.Vector3;
  heading: THREE.Vector2;
  age: number;
  life: number;
  maxLen: number;
  altitude: number;
  curl: number;
  dying: boolean;
}

const MAX_LINES = 40;
const MAX_POINTS = 36;
const STEP = 0.4;
const ORIGIN = new THREE.Vector2();

/** White streaks that trace the real flow and curl as they fade, in the spirit of The Wind Waker. */
export class WindLines {
  readonly batch = new RibbonBatch(MAX_LINES * MAX_POINTS, '#fffaf0');
  private readonly lines: Line[] = [];
  private readonly vectors: THREE.Vector3[] = [];
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly flow = new THREE.Vector2();
  private gustTimer = 0;
  private liftTimer = 0;
  private ambientTimer = 1.5;

  constructor(private readonly wind: WindField) {}

  private vec(p: THREE.Vector3): THREE.Vector3 {
    return (this.vectors.pop() ?? new THREE.Vector3()).copy(p);
  }

  spawn(x: number, z: number, altitude: number, life: number, width = 0.3): void {
    if (this.lines.length >= MAX_LINES) return;
    const y = surfaceHeight(x, z) + altitude;
    const head = new THREE.Vector3(x, y, z);
    this.lines.push({
      points: [this.vec(head)],
      alpha: 0,
      width,
      head,
      heading: new THREE.Vector2(1, 0),
      age: 0,
      life,
      maxLen: MAX_POINTS - 4 - Math.floor(Math.random() * 10),
      altitude,
      curl: Math.random() < 0.5 ? -1 : 1,
      dying: false,
    });
  }

  update(dt: number, gustAt: THREE.Vector3 | null, gust: number, liftAt: THREE.Vector3 | null, charge: number): void {
    if (gustAt && gust > 6) {
      this.gustTimer -= dt;
      if (this.gustTimer <= 0) {
        this.gustTimer = 0.1 - Math.min(gust, 26) * 0.0022;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 4;
        this.spawn(gustAt.x + Math.cos(a) * r, gustAt.z + Math.sin(a) * r, 2.2 + Math.random() * 3, 1.2 + Math.random() * 1.0);
      }
    }
    if (liftAt && charge > 0.25) {
      this.liftTimer -= dt;
      if (this.liftTimer <= 0) {
        this.liftTimer = 0.3 - charge * 0.12;
        const a = Math.random() * Math.PI * 2;
        const r = 3.5 + Math.random() * 3;
        this.spawn(liftAt.x + Math.cos(a) * r, liftAt.z + Math.sin(a) * r, 1.2, 2.2 + Math.random() * 0.8, 0.22);
      }
    }
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.7 + Math.random() * 1.6;
      const x = -60 + Math.random() * 110;
      const z = -55 + Math.random() * 90;
      const w = this.wind.sample(x, z, this.sample);
      if (heightAt(x, z) > 0.5 && Math.hypot(w.x, w.z) > 3.4) this.spawn(x, z, 3 + Math.random() * 4, 1.6 + Math.random() * 1.2, 0.24);
    }

    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.age += dt;
      if (!l.dying) {
        const w = this.wind.sample(l.head.x, l.head.z, this.sample);
        const speed = Math.max(2.5, Math.hypot(w.x, w.z));
        const remaining = l.life - l.age;
        if (remaining < 0.5) {
          l.heading.rotateAround(ORIGIN, l.curl * dt * (5 + (0.5 - remaining) * 22));
        } else {
          const len = Math.hypot(w.x, w.z);
          if (len > 1e-3) l.heading.lerp(this.flow.set(w.x / len, w.z / len), 1 - Math.exp(-dt * 10)).normalize();
        }
        l.head.x += l.heading.x * speed * dt;
        l.head.z += l.heading.y * speed * dt;
        const ground = surfaceHeight(l.head.x, l.head.z);
        const targetY = ground + l.altitude + w.lift * 7;
        l.head.y += (targetY - l.head.y) * (1 - Math.exp(-dt * 2.5)) + w.lift * dt * 5;
        const n = l.points.length;
        if (n < 2 || l.points[n - 2].distanceTo(l.head) > STEP) {
          l.points.push(this.vec(l.head));
          if (l.points.length > l.maxLen) this.vectors.push(l.points.shift()!);
        } else {
          l.points[n - 1].copy(l.head);
        }
        if (l.age > l.life) l.dying = true;
        l.alpha = Math.min(1, l.age / 0.2) * 0.8;
      } else {
        for (let k = 0; k < 2 && l.points.length > 0; k++) this.vectors.push(l.points.shift()!);
        if (l.points.length < 2) {
          this.vectors.push(...l.points);
          this.lines.splice(i, 1);
        }
      }
    }
    this.batch.update(this.lines);
  }
}

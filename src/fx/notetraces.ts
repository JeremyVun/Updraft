import * as THREE from 'three';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import type { LifeField } from '../world/life';
import { surfaceHeight } from '../world/island';
import { RibbonBatch, type Ribbon } from './ribbons';

interface Trace extends Ribbon {
  head: THREE.Vector3;
  heading: THREE.Vector2;
  forward: THREE.Vector2;
  age: number;
  life: number;
  pitch: number;
  strength: number;
  lifting: number;
  restores: boolean;
}

const MAX_TRACES = 14;
const MAX_POINTS = 80;
const STEP = 0.8;
const ORIGIN = new THREE.Vector2();

/**
 * What a note does to the meadow. Every note the piano sounds lifts a wind trace off its key: it rises over the
 * case and runs away up the hill behind the piano, drawn like every other wind the player sees, bending with
 * whatever wind is blowing, and where it runs it plants colour in the grass. Low notes run long and low, high
 * notes short and high. The piano and the meadow are one instrument, and the player hears it and sees it at once.
 */
export class NoteTraces {
  readonly batch = new RibbonBatch(MAX_TRACES * MAX_POINTS, '#fff4dd', 1, false, tuning.invitation.lightFloor);
  private readonly traces: Trace[] = [];
  private readonly vectors: THREE.Vector3[] = [];
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly flow = new THREE.Vector2();
  private readonly smooth = new THREE.Vector3();

  private vec(p: THREE.Vector3): THREE.Vector3 {
    return (this.vectors.pop() ?? new THREE.Vector3()).copy(p);
  }

  /** A note sounded at `key`, in the world: `back` is the way up the hill behind the piano, `pitch` 0 low to 1 high. */
  spawn(key: THREE.Vector3, back: THREE.Vector2, pitch: number, strength: number, restores = true): void {
    if (this.traces.length >= MAX_TRACES) this.retire(0);
    const t = tuning.piano;
    this.traces.push({
      points: [this.vec(key)],
      alpha: 0,
      width: t.traceWidth * (0.7 + 0.6 * strength),
      head: key.clone(),
      /** Fanned across the hill by pitch, so a phrase lays its shape on the slope the way it lay on the keys. */
      heading: back.clone().normalize().rotateAround(ORIGIN, (pitch - 0.5) * t.traceFan),
      forward: back.clone().normalize(),
      age: 0,
      life: t.traceFor + (1 - pitch) * t.traceLonger,
      pitch,
      strength,
      lifting: 1,
      restores,
    });
  }

  update(dt: number, wind: WindField, life: LifeField | null): void {
    const t = tuning.piano;
    for (let i = this.traces.length - 1; i >= 0; i--) {
      const l = this.traces[i];
      l.age += dt;
      const remaining = l.life - l.age;
      if (remaining <= 0) {
        for (let k = 0; k < 2 && l.points.length > 0; k++) this.vectors.push(l.points.shift()!);
        if (l.points.length < 2) this.retire(i);
        continue;
      }
      /** Off the key first: up and back over the case, and only then away across the ground. */
      l.lifting = Math.max(0, l.lifting - dt / t.traceLift);
      const w = wind.sample(l.head.x, l.head.z, this.sample);
      const len = Math.hypot(w.x, w.z);
      if (len > 1e-3 && l.lifting <= 0) l.heading.lerp(this.flow.set(w.x / len, w.z / len), 1 - Math.exp(-dt * t.traceBends)).normalize();
      if (l.lifting <= 0) l.heading.rotateAround(ORIGIN, dt * t.traceCurl * (0.85 + l.pitch * 0.3));
      const speed = t.traceSpeed * (0.75 + 0.5 * l.pitch) * (0.5 + 0.5 * (1 - l.lifting)) + len * 0.3;
      l.head.x += (l.heading.x * t.traceOrbit + l.forward.x * t.traceDrift) * speed * dt;
      l.head.z += (l.heading.y * t.traceOrbit + l.forward.y * t.traceDrift) * speed * dt;
      const ground = surfaceHeight(l.head.x, l.head.z);
      const ride = ground + t.traceLow + l.pitch * t.traceHigh;
      /** Lifting, it climbs faster than it settles, so it clears the case before it goes; then it rides the slope. */
      l.head.y += l.lifting > 0 ? t.traceClimb * dt : (ride - l.head.y) * (1 - Math.exp(-dt * 3));
      const n = l.points.length;
      if (n < 2 || l.points[n - 2].distanceTo(l.head) > STEP) {
        l.points.push(this.vec(l.head));
        if (l.points.length > MAX_POINTS) this.vectors.push(l.points.shift()!);
      } else {
        l.points[n - 1].copy(l.head);
      }
      // Round the wake as it follows the rolling ground, keeping its source and leading tip fixed.
      for (let j = 1; j < l.points.length - 1; j++) {
        this.smooth.copy(l.points[j - 1]).add(l.points[j + 1]).multiplyScalar(0.5);
        l.points[j].lerp(this.smooth, 1 - Math.exp(-dt * 12));
      }
      l.alpha = Math.min(1, l.age / 0.15) * Math.min(1, remaining / 0.5) * (0.55 + 0.4 * l.strength);
      /** The grass it runs over comes back: a little for a breath on the keys, more for a note struck hard. */
      if (life && l.restores && l.lifting <= 0) life.bloom(l.head.x, l.head.z, t.bloomRadius * (0.8 + 0.4 * l.strength), t.bloomRate * l.strength);
    }
    this.batch.mesh.visible = this.traces.length > 0;
    if (this.batch.mesh.visible) this.batch.update(this.traces);
  }

  private retire(i: number): void {
    const l = this.traces[i];
    this.vectors.push(...l.points);
    this.traces.splice(i, 1);
  }
}

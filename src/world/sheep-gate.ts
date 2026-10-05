import * as THREE from 'three';
import { WAY, fieldAt } from './fields';

/** How far before and beyond the gap the way has to be clear, and how wide a strip of it. */
const BEFORE = 4;
const BEYOND = 11;
const HALF = 3.6;
/** Where the child stops to wait for them, short of the gap. */
const WAIT = 5.6;

/** The gap in the wall the way leaves the sheep's field by, between the piano and the rise. */
function findGate(): { x: number; z: number } {
  const a = WAY[3];
  const b = WAY[4];
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  let kind = fieldAt(a.x, a.z).kind;
  let at = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  for (let d = 0; d <= length; d += 0.5) {
    const x = a.x + (b.x - a.x) * d / length;
    const z = a.z + (b.z - a.z) * d / length;
    const k = fieldAt(x, z).kind;
    if (k !== kind) at = { x, z };
    kind = k;
  }
  return at;
}

/**
 * A flock stands in the gateway on the way to the rise, and does not move for a child. The wind can move them: a
 * gust that reaches them sends the ones it reaches trotting off, and a sheep moved off the way never wanders back
 * onto it. `Sheep` keeps the flock; the meadow stops the child short of it while any are still in the way.
 */
export class SheepGate {
  readonly at: THREE.Vector2;
  /** Along the way, through the gap. */
  readonly along: THREE.Vector2;
  readonly wait: THREE.Vector2;
  /** The middle of the ones still in the way, and how many that is. */
  readonly herd = new THREE.Vector3();
  blocking = 0;
  /** False until a flock has been put in the gate. */
  stocked = false;

  constructor() {
    const g = findGate();
    this.at = new THREE.Vector2(g.x, g.z);
    this.along = new THREE.Vector2(WAY[4].x - WAY[3].x, WAY[4].z - WAY[3].z).normalize();
    this.wait = this.at.clone().addScaledVector(this.along, -WAIT);
  }

  /** Whether (x, z) is on the way through the gap, where a sheep is in the child's way. */
  inWay(x: number, z: number): boolean {
    const dx = x - this.at.x;
    const dz = z - this.at.y;
    const on = dx * this.along.x + dz * this.along.y;
    const off = dx * this.along.y - dz * this.along.x;
    return on > -BEFORE && on < BEYOND && Math.abs(off) < HALF;
  }

  get blocked(): boolean {
    return this.stocked && this.blocking > 0;
  }
}

export const sheepGate = new SheepGate();

/** The gateway is grazed and trodden short, where a flock stands about in it, so they are seen and not lost in hay. */
export const GATEWAY = { x: sheepGate.at.x, z: sheepGate.at.y, inner: 3.5, outer: 8, grass: 0.38 };

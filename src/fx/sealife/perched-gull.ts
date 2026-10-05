import * as THREE from 'three';
import { gullMesh } from '../../creatures/gulls';
import type { Instances } from '../../creatures/shapes';
import { BLOWHOLE, LENGTH, TOP } from './anatomy';
import type { WhaleRig } from './whale';

export type GullSound = 'gull-hop' | 'gull-peck' | 'gull-away';

/** Where along the whale it sleeps, and where it stands to peck. */
const PERCH = 0.42;
const PECK_AT = BLOWHOLE + 0.025;
/** Its body's centre above its feet. */
const STANDS = 0.16;
const WALK_SPEED = 0.7;
const HOP_FOR = 0.75;
const PECKS = 3;
const PECK_EVERY = 0.75;

/**
 * The gull asleep on the whale's back: head tucked, wings folded. A gust across the back makes it hop up and settle
 * again; left long enough, it wanders up to the blowhole and pecks; when the whale wakes it flies off.
 */
export class PerchedGull {
  readonly mesh: THREE.Mesh;
  private readonly instances: Instances;
  state: 'asleep' | 'walking' | 'pecking' | 'away' | 'gone' = 'gone';
  /** Its last peck has landed on the blowhole. */
  pecked = false;
  onSound: ((kind: GullSound, at: THREE.Vector3) => void) | null = null;
  readonly position = new THREE.Vector3();
  private s = PERCH;
  private hop = -1;
  private t = 0;
  private yaw = 0;
  private flap = 0;
  private wake = 0;
  private readonly velocity = new THREE.Vector3();
  private readonly foot = new THREE.Vector3();

  constructor() {
    ({ instances: this.instances, mesh: this.mesh } = gullMesh(1));
    this.mesh.visible = false;
  }

  settle(): void {
    this.state = 'asleep';
    this.s = PERCH;
    this.hop = -1;
    this.pecked = false;
    this.wake = 0;
  }

  vanish(): void {
    this.state = 'gone';
    this.mesh.visible = false;
  }

  /** A gust across the whale's back: up it hops, wings half open, and settles again where it was. */
  startle(): void {
    if ((this.state !== 'asleep' && this.state !== 'walking') || this.hop >= 0) return;
    this.hop = 0;
    this.onSound?.('gull-hop', this.position);
  }

  /** It has waited long enough: it goes and pecks at the blowhole. */
  walk(): void {
    if (this.state !== 'asleep') return;
    this.state = 'walking';
    this.t = 0;
  }

  /** The whale is waking under it: off it goes, out over the water ahead. */
  leave(): void {
    if (this.state === 'away' || this.state === 'gone') return;
    this.state = 'away';
    this.t = 0;
    this.velocity.set(Math.sin(this.yaw) * 2.5, 2.6, Math.cos(this.yaw) * 2.5);
    this.onSound?.('gull-away', this.position);
  }

  update(dt: number, whale: WhaleRig): void {
    if (this.state === 'gone') return;
    this.t += dt;
    const h = whale.heading;
    const along = Math.atan2(h.x, h.z);
    let inner = -1.35;
    let outer = 0.15;
    let sweep = 1.25;
    let head = 2.7;
    let pitch = 0;
    let roll = 0;
    let lift = 0;
    if (this.state === 'away') {
      this.velocity.y = Math.max(0.6, this.velocity.y - dt * 0.4);
      this.velocity.x += (h.x * 7 - this.velocity.x) * (1 - Math.exp(-dt * 0.5));
      this.velocity.z += (h.z * 7 - this.velocity.z) * (1 - Math.exp(-dt * 0.5));
      this.position.addScaledVector(this.velocity, dt);
      this.yaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.flap += dt * Math.PI * 2 * 2.6;
      const beat = Math.sin(this.flap);
      inner = 0.15 + beat * 0.55;
      outer = -0.2 + Math.sin(this.flap - 0.7) * 0.45;
      sweep = 0;
      head = 0;
      pitch = -0.15;
      this.commit(inner, outer, sweep, head, pitch, roll);
      if (this.t > 14) this.vanish();
      return;
    }
    if (this.state === 'walking') {
      this.wake = Math.min(1, this.wake + dt * 1.5);
      this.s = Math.max(PECK_AT, this.s - (WALK_SPEED * dt) / (whale.scale * LENGTH));
      lift = Math.abs(Math.sin(this.t * 7)) * 0.04;
      roll = Math.sin(this.t * 7) * 0.08;
      if (this.s <= PECK_AT) {
        this.state = 'pecking';
        this.t = 0;
      }
    } else if (this.state === 'pecking') {
      const n = Math.floor(this.t / PECK_EVERY);
      const u = (this.t % PECK_EVERY) / PECK_EVERY;
      pitch = n < PECKS ? Math.max(0, Math.sin(u * Math.PI)) ** 2 * 0.75 : 0;
      if (n < PECKS && u >= 0.5 && u - dt / PECK_EVERY < 0.5) this.onSound?.('gull-peck', this.position);
      if (n >= PECKS) this.pecked = true;
    }
    this.yaw = this.state === 'asleep' ? along + 1.9 : along;
    head = 2.7 * (1 - this.wake);
    if (this.hop >= 0) {
      this.hop += dt / HOP_FOR;
      const u = Math.min(this.hop, 1);
      const up = Math.sin(u * Math.PI);
      lift += 0.5 * up;
      inner = THREE.MathUtils.lerp(inner, 0.45 + Math.sin(u * 18) * 0.35, up);
      outer = THREE.MathUtils.lerp(outer, -0.25, up);
      sweep = THREE.MathUtils.lerp(sweep, 0.2, up);
      head = THREE.MathUtils.lerp(head, 0, Math.min(1, up * 3));
      if (this.hop >= 1) this.hop = -1;
    }
    whale.point(0, TOP(this.s), this.s, this.foot);
    this.position.copy(this.foot);
    this.position.y += STANDS + lift;
    this.commit(inner, outer, sweep, head, pitch, roll);
  }

  private commit(inner: number, outer: number, sweep: number, head: number, pitch: number, roll: number): void {
    const p = this.position;
    this.instances.set(0, 0, p.x, p.y, p.z, this.yaw);
    this.instances.set(1, 0, pitch, roll, 0, 0);
    this.instances.set(2, 0, inner, outer, sweep, head);
    this.instances.commit(1);
    this.mesh.visible = true;
  }
}

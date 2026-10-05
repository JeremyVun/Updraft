import * as THREE from 'three';
import { sheepGate } from '../world/sheep-gate';
import type { Cast } from './cast';

type Beat = 'ahead' | 'walking' | 'waiting' | 'through' | 'done';

/** How far short of the waiting place the child notices they cannot get by. */
const NOTICE = 16;
/** How long she stands looking at them before the wind is shown what it could do. */
const INVITE_AFTER = 4;
/** And how long she watches the last of them go before walking on. */
const THROUGH_FOR = 1.4;

/**
 * Sheep in the gateway on the way to the rise. The child stops short of them and waits, because they will not move
 * for her; the wind moves them, a few at a time, and she goes on through the gap once the way is clear.
 */
export class GateStop {
  private beat: Beat = 'ahead';
  private since = 0;
  private now = 0;
  private readonly look = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  /** Where the invitation is drawn, once she has waited long enough to need one. */
  invitation: THREE.Vector3 | null = null;
  /** Hands the walk back, so it can pick the plane up where it left it. */
  onRelease: (() => void) | null = null;

  /** QA: how far the stop has got. */
  get at(): string {
    return `${this.beat} blocking=${sheepGate.blocking}`;
  }

  /** A checkpoint past the gate never puts her back in front of it. */
  restoreDone(): void {
    this.beat = 'done';
    this.invitation = null;
  }

  /** The plane leans to the gap while the sheep are in it, so the walk comes up to them rather than round. */
  waypoint(next: THREE.Vector2): THREE.Vector2 {
    return this.beat === 'done' || !sheepGate.blocked ? next : sheepGate.wait;
  }

  /** While she is held up, the flock is what the frame holds beside her. */
  get herd(): THREE.Vector3 | null {
    return this.beat === 'walking' || this.beat === 'waiting' || this.beat === 'through' ? this.look : null;
  }

  /** Runs the stop. True while it has the child, and the walk waits for it. */
  hold(dt: number, time: number, cast: Cast): boolean {
    this.now = time;
    const c = cast.child;
    const g = sheepGate;
    if (g.blocking > 0) this.look.set(g.herd.x, g.herd.y + 0.6, g.herd.z);
    switch (this.beat) {
      case 'ahead': {
        if (!g.stocked) break;
        const dx = c.position.x - g.at.x;
        const dz = c.position.z - g.at.y;
        const on = dx * g.along.x + dz * g.along.y;
        const off = Math.abs(dx * g.along.y - dz * g.along.x);
        /** Already at the gap or past it, by whatever way: nothing is in the way of somebody who is through. */
        if (on > -2 || !g.blocked) {
          if (on > -2) this.beat = 'done';
          break;
        }
        if (Math.hypot(c.position.x - g.wait.x, c.position.z - g.wait.y) < NOTICE || (on > -g.wait.distanceTo(g.at) && off < 14)) {
          c.stop();
          c.walkTo(g.wait.x, g.wait.y, false, () => this.to('waiting'), 0.8);
          this.to('walking');
        }
        break;
      }
      case 'walking':
        c.lookAt = this.look;
        if (!g.blocked) this.to('through');
        else if (!c.moving && !c.acting) c.walkTo(g.wait.x, g.wait.y, false, () => this.to('waiting'), 0.8);
        break;
      case 'waiting':
        c.lookAt = this.look;
        c.faceToward(this.look.x, this.look.z, 1 - Math.exp(-dt * 2));
        cast.cygnet.watch(this.look);
        this.invitation = this.t > INVITE_AFTER ? this.look : null;
        if (!g.blocked) this.to('through');
        break;
      case 'through':
        this.invitation = null;
        c.lookAt = this.look;
        if (this.t > THROUGH_FOR) {
          cast.cygnet.watch(null);
          c.lookAt = null;
          this.beat = 'done';
          this.onRelease?.();
        }
        break;
      default:
        break;
    }
    return this.beat === 'walking' || this.beat === 'waiting' || this.beat === 'through';
  }

  private to(beat: Beat): void {
    this.beat = beat;
    this.since = this.now;
  }

  private get t(): number {
    return this.now - this.since;
  }

  /** Where the frame aims while she waits: on her, drawn a little toward the flock. */
  aim(child: THREE.Vector3): THREE.Vector3 | null {
    const herd = this.herd;
    if (!herd) return null;
    return this.target.copy(child).lerp(herd, 0.35);
  }
}

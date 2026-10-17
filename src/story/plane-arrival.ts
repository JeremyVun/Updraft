import type { Cast } from './cast';

/** Reaching a completed destination ends pursuit. The paper comes back before the child goes on. */
export class PlaneArrival {
  private phase: 'waiting' | 'catching' | 'done' = 'waiting';

  get active(): boolean { return this.phase !== 'waiting'; }

  update(cast: Cast, ready: boolean, next: () => void): boolean {
    const { child, plane, carry } = cast;
    if (this.phase === 'waiting') {
      if (!ready || child.acting || carry.busy) return false;
      child.stop();
      if (plane.held) {
        this.phase = 'done';
        next();
        return true;
      }
      plane.returnTo(child);
      this.phase = 'catching';
    }
    if (this.phase === 'catching') {
      child.lookAt = plane.position;
      if (plane.held && !plane.returning) {
        child.lookAt = null;
        this.phase = 'done';
        next();
      }
    }
    return true;
  }
}

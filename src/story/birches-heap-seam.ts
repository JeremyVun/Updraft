import type { Squirrel } from '../creatures/squirrel';
import { tuning } from '../tuning';
import { BIRCH_PILES, type AutumnBirches } from '../world/birches';

/** What the squirrel game asks of the leaf floor: phase 5a's `AutumnBirches.depthAt` and `burst`. */
export interface HeapSeam {
  /** Live litter height in metres over the ground at each point, from one batched readback. */
  depthAt(points: readonly { x: number; z: number }[]): Promise<number[]>;
  burst(x: number, z: number, strength: number): void;
}

/**
 * Stands in for phase 5a's seam until it lands, then this file goes and the game calls the floor directly: depths
 * are the heaps as authored, and a burst is a kick.
 */
export function heapSeam(birches: AutumnBirches, squirrel: Squirrel): HeapSeam {
  const own = birches as AutumnBirches & Partial<HeapSeam>;
  if (own.depthAt && own.burst) return own as HeapSeam;
  const burst = (x: number, z: number, strength: number) => birches.kick(x, z, 0.7 + 1.6 * Math.min(1.5, strength), Math.min(1, strength));
  squirrel.onLeaves ??= (stir) => { if (stir.kind !== 'step') burst(stir.at.x, stir.at.z, stir.strength); };
  return {
    depthAt: async (points) => points.map((p) => Math.max(0, ...BIRCH_PILES.map((h) =>
      h.deep * (1 - ((p.x - h.x) ** 2 + (p.z - h.z) ** 2) / h.r ** 2) - 1.6)) * tuning.birches.pileHeight),
    burst,
  };
}

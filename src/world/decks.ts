import { heightAt } from './island';

/** A built surface over the water the child can walk on: a jetty's deck, a strip from one end to the other. */
export interface Deck {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  halfWidth: number;
  height: number;
  /** A flight of stairs: the height at (x1, z1), the walk rising evenly to it from `height` at (x0, z0). */
  height1?: number;
  /** Optional shallow landing at the shore end; never permits stepping off the sides into deep water. */
  stepOffDepth?: number;
}
/** How far up a walker can step from where they stand onto the next surface. */
const STEP_UP = 0.5;

/**
 * The ground under (x, z) with the decks laid over it. Where decks lie one above another, as the flights of a
 * staircase do, the walker is on the highest one they can step up onto from the height they are already at.
 */
export function deckGround(decks: readonly Deck[], x: number, z: number, near: number): number {
  const land = heightAt(x, z);
  const flat = decks.every(d => d.height1 === undefined);
  let best = land;
  for (const d of decks) {
    const dx = d.x1 - d.x0;
    const dz = d.z1 - d.z0;
    const len2 = dx * dx + dz * dz;
    const t = ((x - d.x0) * dx + (z - d.z0) * dz) / len2;
    if (t < 0 || t > 1) continue;
    const px = d.x0 + dx * t;
    const pz = d.z0 + dz * t;
    if (Math.hypot(x - px, z - pz) > d.halfWidth) continue;
    const h = Math.max(d.height1 === undefined ? d.height : d.height + (d.height1 - d.height) * t, land);
    if (flat) return h;
    if (h <= near + STEP_UP && h > best) best = h;
  }
  return best;
}

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
  if (flat) {
    for (const d of decks) {
      const h = underDeck(d, x, z, 0);
      if (h !== null) return Math.max(h, land);
    }
    return land;
  }
  // A staircase is never stepped off: a seam or a stray foot finds the tread it was nearly on.
  for (const slack of [0, 0.35]) {
    let best = land;
    for (const d of decks) {
      const h = underDeck(d, x, z, slack);
      if (h !== null && h <= near + STEP_UP && h > best) best = h;
    }
    if (best > near - 0.6 || slack > 0) return best;
  }
  return land;
}

/** The deck's height under (x, z), or null off it; slack widens it and lets it run on past its ends. */
function underDeck(d: Deck, x: number, z: number, slack: number): number | null {
  const dx = d.x1 - d.x0;
  const dz = d.z1 - d.z0;
  const len = Math.sqrt(dx * dx + dz * dz);
  const t = len > 0 ? ((x - d.x0) * dx + (z - d.z0) * dz) / (len * len) : 0;
  const over = slack / Math.max(len, 1e-3);
  if (t < -over || t > 1 + over) return null;
  const u = Math.min(1, Math.max(0, t));
  if (Math.hypot(x - (d.x0 + dx * u), z - (d.z0 + dz * u)) > d.halfWidth + slack) return null;
  return d.height1 === undefined ? d.height : d.height + (d.height1 - d.height) * u;
}

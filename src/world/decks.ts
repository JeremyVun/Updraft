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
  /** The surface under each foot; navigation keeps the strip's centre-line heights. */
  surface?: (x: number, z: number) => number | null;
  /** Optional shallow landing at the shore end; never permits stepping off the sides into deep water. */
  stepOffDepth?: number;
  /** A ramp this long runs on from one end of the deck down to the ground. */
  rampAt?: 'start' | 'end';
  rampLength?: number;
}

/** The height of a deck's ramp under (x, z), or null off it. */
export function rampHeight(d: Deck, x: number, z: number): number | null {
  if (!d.rampAt || !d.rampLength) return null;
  const dx = d.x1 - d.x0, dz = d.z1 - d.z0, len = Math.hypot(dx, dz);
  const along = ((x - d.x0) * dx + (z - d.z0) * dz) / len;
  const beyond = d.rampAt === 'end' ? along - len : -along;
  if (beyond < 0 || beyond > d.rampLength) return null;
  if (Math.abs((x - d.x0) * dz - (z - d.z0) * dx) / len > d.halfWidth) return null;
  return d.height + (heightAt(x, z) - d.height) * (beyond / d.rampLength);
}
/** True where a step to (x, z) would carry a walker on a raised deck off its edge into a drop. */
export function offTheEdge(decks: readonly Deck[], x: number, z: number, y: number): boolean {
  return decks.length > 0 && deckGround(decks, x, z, y) < y - 0.8;
}

/** How far up a walker can step from where they stand onto the next surface. */
const STEP_UP = 0.5;

/**
 * How far (x, z) is outside the nearest strip a walker at height y could be standing on, without the slack
 * `deckGround` gives a seam.
 */
export function beyondDecks(decks: readonly Deck[], x: number, z: number, y: number): number {
  let near = Infinity;
  for (const d of decks) {
    const dx = d.x1 - d.x0, dz = d.z1 - d.z0, len = Math.max(Math.hypot(dx, dz), 1e-3);
    const t = ((x - d.x0) * dx + (z - d.z0) * dz) / (len * len);
    const u = Math.min(1, Math.max(0, t));
    const h = d.height1 === undefined ? d.height : d.height + (d.height1 - d.height) * u;
    if (h > y + STEP_UP || h < y - 0.8) continue;
    const across = Math.abs((x - d.x0) * dz - (z - d.z0) * dx) / len - d.halfWidth;
    near = Math.min(near, Math.hypot(Math.max(0, -t * len, (t - 1) * len), Math.max(0, across)));
  }
  return near;
}

/**
 * The ground under (x, z) with the decks laid over it. Where decks lie one above another, as the flights of a
 * staircase do, the walker is on the highest one they can step up onto from the height they are already at.
 */
export function deckGround(decks: readonly Deck[], x: number, z: number, near: number, feet = false): number {
  const land = heightAt(x, z);
  const flat = decks.every(d => d.height1 === undefined);
  if (flat) {
    for (const d of decks) {
      const h = underDeck(d, x, z, feet && d.surface ? 0.3 : 0, feet);
      if (h !== null) return Math.max(h, land);
    }
    for (const d of decks) {
      const ramp = rampHeight(d, x, z);
      if (ramp !== null) return Math.max(ramp, land);
    }
    return land;
  }
  // A staircase is never stepped off: a seam or a stray foot finds the tread it was nearly on.
  for (const slack of [0, 0.35]) {
    let best = land;
    for (const d of decks) {
      const h = underDeck(d, x, z, slack + (feet && d.surface ? 0.3 : 0), feet);
      if (h !== null && h <= near + STEP_UP && h > best) best = h;
    }
    if (best > near - 0.6 || slack > 0) return best;
  }
  return land;
}

/** The deck's height under (x, z), or null off it; slack widens it and lets it run on past its ends. */
function underDeck(d: Deck, x: number, z: number, slack: number, feet = false): number | null {
  const dx = d.x1 - d.x0;
  const dz = d.z1 - d.z0;
  const len = Math.sqrt(dx * dx + dz * dz);
  const t = len > 0 ? ((x - d.x0) * dx + (z - d.z0) * dz) / (len * len) : 0;
  const over = slack / Math.max(len, 1e-3);
  if (t < -over || t > 1 + over) return null;
  const u = Math.min(1, Math.max(0, t));
  if (Math.hypot(x - (d.x0 + dx * u), z - (d.z0 + dz * u)) > d.halfWidth + slack) return null;
  return feet && d.surface ? d.surface(x, z) : d.height1 === undefined ? d.height : d.height + (d.height1 - d.height) * u;
}

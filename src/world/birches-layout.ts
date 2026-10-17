import { BIRCHES_SHIFT } from './geography';
import { glsl } from '../tuning';

/**
 * The birches island as it was first built: its walk ran from the south beach at z −1052 to the berth at −1197. Every
 * place on it is still authored in these band-local terms and reaches the world through `birchesAt`, because the
 * island has since been cut across its walk, its bands pushed apart and the whole of it moved by `BIRCHES_SHIFT`.
 */
export const BIRCHES_LOCAL = { x: 0, z: -1128, rx: 60, rz: 80 } as const;

/**
 * The cuts, in band-local z, and how far each is opened. Everything between two cuts keeps its shape exactly; a gap
 * is new ground, more of the same corridor. No authored thing straddles a cut. Every opening, like the shift, is a
 * whole number of grass tiles (8 m), so each band's grass keeps the blades it was first grown with.
 */
export const BIRCHES_CUTS = [
  /** A: past the fallen log and its heap, before the first tangle. */
  { z: -1080.95, open: 16 },
  /** B: past the first length's tree, before the next perch on the way up the rise. */
  { z: -1101.5, open: 16 },
  /** C: in the hollow, past its deepest heap, before the slipped loop. */
  { z: -1154, open: 24 },
] as const;

/**
 * How far either side of a cut, as a share of its gap, the island's broad shape (coast, dome, rise and hollow) eases
 * across it. More than a quarter, so the ground only ever climbs one way through a gap; it levels into a shelf there.
 */
const EASE = 0.3;

/**
 * The flanks are drawn in so the longer island keeps its number of trees: within `keep` of the walk nothing changes;
 * beyond it, over `ease` metres, the slopes steepen until the widest coast stands at `coast` instead of 60.
 */
export const BIRCHES_NARROW = { keep: 25, ease: 8, coast: 48 } as const;
const PULL = (BIRCHES_LOCAL.rx - BIRCHES_NARROW.coast) / (BIRCHES_NARROW.coast - BIRCHES_NARROW.keep - BIRCHES_NARROW.ease / 2);

const OPENED = BIRCHES_CUTS.reduce((sum, cut) => sum + cut.open, 0);

/** The island in the world: centred between its beaches, as wide as its drawn-in coast and as long as its walk grew. */
export const BIRCHES_ISLE = {
  x: BIRCHES_LOCAL.x + BIRCHES_SHIFT.x,
  z: BIRCHES_LOCAL.z + BIRCHES_SHIFT.z - OPENED / 2,
  rx: BIRCHES_NARROW.coast,
  rz: BIRCHES_LOCAL.rz + OPENED / 2,
} as const;

export function birchesZ(z: number): number {
  let world = z + BIRCHES_SHIFT.z;
  for (const cut of BIRCHES_CUTS) if (z < cut.z) world -= cut.open;
  return world;
}

export function birchesAt(x: number, z: number): { x: number; z: number } {
  return { x: x + BIRCHES_SHIFT.x, z: birchesZ(z) };
}

/** A point in gap `gap` (0 is A), `into` metres north of its southern edge, `x` across in band-local terms. */
export function birchesGap(gap: number, into: number, x: number): { x: number; z: number } {
  return { x: x + BIRCHES_SHIFT.x, z: birchesZ(BIRCHES_CUTS[gap].z) - into };
}

export interface BirchesPlace {
  x: number;
  z: number;
  /** The gap the point is in, or −1 on a band; in a gap `z` is its cut and `into` how far north of its southern edge. */
  gap: number;
  into: number;
}

export function birchesLocal(x: number, z: number, out: BirchesPlace = { x: 0, z: 0, gap: -1, into: 0 }): BirchesPlace {
  const along = z - BIRCHES_SHIFT.z;
  out.x = x - BIRCHES_SHIFT.x;
  out.gap = -1;
  out.into = 0;
  let offset = 0;
  for (let i = 0; i < BIRCHES_CUTS.length; i++) {
    const cut = BIRCHES_CUTS[i], top = cut.z - offset;
    if (along >= top) break;
    if (along > top - cut.open) {
      out.z = cut.z;
      out.gap = i;
      out.into = top - along;
      return out;
    }
    offset += cut.open;
  }
  out.z = along + offset;
  return out;
}

const place: BirchesPlace = { x: 0, z: 0, gap: -1, into: 0 };

/**
 * A zero-mean field authored in band-local terms (the ground's noise, the drifts, the stands of trees), carried
 * across each gap by easing from the band behind it into the band ahead, without losing its strength midway.
 */
export function birchesNoise(x: number, z: number, field: (x: number, z: number) => number): number {
  const at = birchesLocal(x, z, place);
  if (at.gap < 0) return field(at.x, at.z);
  const { open } = BIRCHES_CUTS[at.gap], lx = at.x, cut = at.z, into = at.into;
  const t = into / open, w = t * t * (3 - 2 * t);
  return (field(lx, cut - into) * (1 - w) + field(lx, cut + open - into) * w) / Math.hypot(1 - w, w);
}

/**
 * How far the ground's patterns (grass blades, tufts, tint) are carried from where they were first laid down: by the
 * band's own move on the island, and by the band before it in a gap; nothing off the island.
 */
export function birchesPatternOffset(x: number, z: number, out = { x: 0, z: 0 }): { x: number; z: number } {
  out.x = out.z = 0;
  if (Math.hypot((x - BIRCHES_ISLE.x) / BIRCHES_ISLE.rx, (z - BIRCHES_ISLE.z) / BIRCHES_ISLE.rz) >= 1.4) return out;
  const along = z - BIRCHES_SHIFT.z;
  let offset = 0;
  for (const cut of BIRCHES_CUTS) {
    if (along > cut.z - offset - cut.open) break;
    offset += cut.open;
  }
  out.x = BIRCHES_SHIFT.x;
  out.z = BIRCHES_SHIFT.z - offset;
  return out;
}

/** How far out of the island a point lies: 1 at its first coast, drawn in at the flanks and opened at the gaps. */
export function birchesOut(x: number, z: number): number {
  const s = birchesShape(x, z, shapeScratch);
  return Math.hypot((s.x - BIRCHES_LOCAL.x) / BIRCHES_LOCAL.rx, (s.z - BIRCHES_LOCAL.z) / BIRCHES_LOCAL.rz);
}
const shapeScratch = { x: 0, z: 0 };

/** Where the island's broad shape is read for a world point: band-local, eased across the gaps, drawn in at the flanks. */
export function birchesShape(x: number, z: number, out = { x: 0, z: 0 }): { x: number; z: number } {
  let lx = x - BIRCHES_SHIFT.x;
  const beyond = Math.abs(lx) - BIRCHES_NARROW.keep;
  if (PULL > 0 && beyond > 0) {
    const e = BIRCHES_NARROW.ease;
    lx += Math.sign(lx) * PULL * (beyond < e ? beyond * beyond / (2 * e) : beyond - e / 2);
  }
  out.x = lx;
  const along = z - BIRCHES_SHIFT.z;
  let offset = 0;
  for (const cut of BIRCHES_CUTS) {
    const top = cut.z - offset, margin = cut.open * EASE;
    if (along > top + margin) break;
    if (along > top - cut.open - margin) {
      const u = (top + margin - along) / (cut.open + 2 * margin);
      out.z = along + offset + cut.open * u * u * (3 - 2 * u);
      return out;
    }
    offset += cut.open;
  }
  out.z = along + offset;
  return out;
}

function shapeGlsl(): string {
  const lines: string[] = [];
  let offset = 0;
  for (const cut of BIRCHES_CUTS) {
    if (cut.open > 0) {
      const top = cut.z - offset, margin = cut.open * EASE;
      lines.push(`if (r > ${glsl(top + margin)}) return vec2(x, r + ${glsl(offset)});`,
        `if (r > ${glsl(top - cut.open - margin)}) { float u = (${glsl(top + margin)} - r) / ${glsl(cut.open + 2 * margin)}; `
        + `return vec2(x, r + ${glsl(offset)} + ${glsl(cut.open)} * u * u * (3.0 - 2.0 * u)); }`);
    }
    offset += cut.open;
  }
  lines.push(`return vec2(x, r + ${glsl(offset)});`);
  return lines.join('\n  ');
}

function noiseGlsl(): string {
  const lines: string[] = [];
  let offset = 0;
  for (const cut of BIRCHES_CUTS) {
    if (cut.open > 0) {
      const top = cut.z - offset;
      lines.push(`if (r >= ${glsl(top)}) return gfbm(vec2(x, r + ${glsl(offset)}) * scale, octaves, seed);`,
        `if (r > ${glsl(top - cut.open)}) return birchesAcross(x, ${glsl(cut.z)}, ${glsl(cut.open)}, ${glsl(top)} - r, scale, octaves, seed);`);
    }
    offset += cut.open;
  }
  lines.push(`return gfbm(vec2(x, r + ${glsl(offset)}) * scale, octaves, seed);`);
  return lines.join('\n  ');
}

/** The GLSL twin of `birchesShape`, and how far out of the island a point lies: 1 at its first coast, drawn in. */
export const BIRCHES_SHAPE_GLSL = /* glsl */ `
#ifndef BIRCHES_SHAPE
#define BIRCHES_SHAPE
vec2 birchesShape(vec2 p) {
  float x = p.x - ${glsl(BIRCHES_SHIFT.x)};
  ${PULL > 0 ? `float beyond = abs(x) - ${glsl(BIRCHES_NARROW.keep)};
  if (beyond > 0.0) x += sign(x) * ${glsl(PULL)} * (beyond < ${glsl(BIRCHES_NARROW.ease)} ? beyond * beyond / ${glsl(2 * BIRCHES_NARROW.ease)} : beyond - ${glsl(BIRCHES_NARROW.ease / 2)});` : ''}
  float r = p.y - ${glsl(BIRCHES_SHIFT.z)};
  ${shapeGlsl()}
}
float birchesOut(vec2 p) {
  return length((birchesShape(p) - vec2(${glsl(BIRCHES_LOCAL.x)}, ${glsl(BIRCHES_LOCAL.z)})) / vec2(${glsl(BIRCHES_LOCAL.rx)}, ${glsl(BIRCHES_LOCAL.rz)}));
}
#endif`;

function patternGlsl(): string {
  const lines: string[] = [];
  let offset = 0;
  for (const cut of BIRCHES_CUTS) {
    lines.push(`if (along > ${glsl(cut.z - offset - cut.open)}) return vec2(${glsl(BIRCHES_SHIFT.x)}, ${glsl(BIRCHES_SHIFT.z - offset)});`);
    offset += cut.open;
  }
  lines.push(`return vec2(${glsl(BIRCHES_SHIFT.x)}, ${glsl(BIRCHES_SHIFT.z - offset)});`);
  return lines.join('\n  ');
}

/** The GLSL twin of `birchesPatternOffset`. */
export const BIRCHES_PATTERN_GLSL = /* glsl */ `
vec2 birchesPatternOffset(vec2 xz) {
  if (length((xz - vec2(${glsl(BIRCHES_ISLE.x)}, ${glsl(BIRCHES_ISLE.z)})) / vec2(${glsl(BIRCHES_ISLE.rx)}, ${glsl(BIRCHES_ISLE.rz)})) >= 1.4) return vec2(0.0);
  float along = xz.y - ${glsl(BIRCHES_SHIFT.z)};
  ${patternGlsl()}
}`;

/** The GLSL twin of `birchesNoise` over `gfbm`; needs `gfbm` first. */
export const BIRCHES_NOISE_GLSL = /* glsl */ `
float birchesAcross(float x, float cut, float open, float into, float scale, int octaves, float seed) {
  float w = smoothstep(0.0, open, into);
  float behind = gfbm(vec2(x, cut - into) * scale, octaves, seed);
  float ahead = gfbm(vec2(x, cut + open - into) * scale, octaves, seed);
  return (behind * (1.0 - w) + ahead * w) / length(vec2(1.0 - w, w));
}
float birchesFbm(vec2 p, float scale, int octaves, float seed) {
  float x = p.x - ${glsl(BIRCHES_SHIFT.x)};
  float r = p.y - ${glsl(BIRCHES_SHIFT.z)};
  ${noiseGlsl()}
}`;

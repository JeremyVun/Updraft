import { range, type Rng } from '../creatures/motion';
import type { HouseType } from './drowned-houses';
import { mulberry32 } from './noise';
import { STRAND_HOUSE, houseLocal } from './drowned-way';

/** A house of the village beyond the drift and her way: where it stands, its frame and which of the kit's houses. */
export interface Site {
  x: number;
  z: number;
  yaw: number;
  len: number;
  depth: number;
  rise: number;
  sink: number;
  thatched: boolean;
  look: HouseType;
  far: boolean;
  mid: boolean;
}

/**
 * Her door, red as home's, in the gable end of the roof the boat strands against, its top well under the water: seen
 * only down through the surface while the boat lies becalmed. Its middle on the wall, the way the wall faces (as
 * atan2(x, z)), its half width, its top and foot, and the wall round it.
 */
export const SUNK_DOOR = (() => {
  const at = houseLocal(STRAND_HOUSE, -STRAND_HOUSE.len / 2 - 0.02, 0);
  return { x: at.x, z: at.y, facing: Math.atan2(-Math.cos(STRAND_HOUSE.yaw), Math.sin(STRAND_HOUSE.yaw)),
    half: 0.62, top: -0.72, foot: -2.95, wallHalf: STRAND_HOUSE.depth / 2, wallFoot: -3.6 };
})();

/** The tall hat with the little pocket beside it, both gables to the drift as it comes in. */
export const TALL_AND_TINY = { x: -44, z: -1334, yaw: -0.95, apart: 5.6 };
/** The two cottages whose chimneys carry the washing, end to end along a lane west of her way. */
export const WASHING_PAIR = { x: -28, z: -1478, yaw: 0.1, gap: 3.4 };

type Kind = 'row' | 'huddle' | 'farm';

/** The village's loose grid: most lanes run along it or across it, and none quite straight. */
const STREET = 0.55;

/** Where lanes and huddles may start: a loose grid over the drowned island, a little beyond its shore. */
const SPACING = 32;
const CENTRE = { x: -10, z: -1462, rx: 265, rz: 222 };

const pick = <T>(rand: Rng, from: [T, number][]): T => {
  let r = rand() * from.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of from) if ((r -= w) <= 0) return v;
  return from[from.length - 1][0];
};

/** Four houses in five modest near, the rare shapes few enough that they matter; far off more of them point, as a dream's horizon does. */
function look(rand: Rng, thatched: boolean, far: boolean, long: boolean): HouseType {
  if (long) return thatched ? 'thatch' : 'tucked';
  if (thatched) return pick(rand, [['thatch', 0.82], ['lowCap', 0.18]]);
  return far
    ? pick(rand, [['cottage', 0.56], ['swayback', 0.1], ['tallHat', 0.17], ['pocket', 0.06], ['roundKeeper', 0.11]])
    : pick(rand, [['cottage', 0.72], ['swayback', 0.1], ['openShutter', 0.07], ['pocket', 0.11]]);
}

function house(rand: Rng, x: number, z: number, yaw: number, far: boolean, mid: boolean): Site {
  const thatched = rand() < 0.38;
  const long = rand() < 0.08;
  const depth = range(rand, 5, 6.2);
  const deep = rand() < 0.2;
  return {
    x, z, yaw: yaw + range(rand, -0.08, 0.08),
    len: long ? range(rand, 13, 15.5) : range(rand, 7, 10.5),
    depth,
    rise: depth * range(rand, 0.52, 0.66),
    sink: deep ? range(rand, 4.2, 5.1) : far ? range(rand, 2, 3.2) : range(rand, 1.6, 2.9),
    thatched,
    look: look(rand, thatched, far, long),
    far,
    mid,
  };
}

/**
 * Every site of the village's fuller shape, drawn from its own stream so nothing laid before it moves. `reach` is how
 * far a point is from where she goes; the middle distance from it is full, then a band of broad water, then far
 * groups into the haze. A site that `fits` refuses is left as a gap in its lane; the draws go on the same either way.
 */
/** How likely a site is to be built at a distance from where she goes: full, then a band of broad water, then far groups. */
export const bandAt = (d: number) => (d < 95 ? 0.9 : d < 135 ? 0.3 : 0.7);

export function villageShape(rand: Rng, reach: (x: number, z: number) => number, fits: (s: Site) => boolean,
  band: (d: number, x: number, z: number) => number = bandAt): Site[] {
  const sites: Site[] = [];
  const keep = (s: Site) => {
    if (fits(s)) sites.push(s);
  };
  for (let gz = CENTRE.z - CENTRE.rz; gz <= CENTRE.z + CENTRE.rz; gz += SPACING) {
    for (let gx = CENTRE.x - CENTRE.rx; gx <= CENTRE.x + CENTRE.rx; gx += SPACING) {
      const x = gx + range(rand, -0.4, 0.4) * SPACING;
      const z = gz + range(rand, -0.4, 0.4) * SPACING;
      const chance = rand();
      const kindAt = rand();
      const count = rand();
      const heading = (rand() < 0.5 ? STREET : STREET + Math.PI / 2) + range(rand, -0.25, 0.25);
      const groupSeed = rand();
      if (Math.abs((x - CENTRE.x) / CENTRE.rx) ** 4 + Math.abs((z - CENTRE.z) / CENTRE.rz) ** 4 > 1) continue;
      const d = reach(x, z);
      const far = d > 105;
      if (chance > band(d, x, z)) continue;
      const kind: Kind = kindAt < 0.5 ? 'row' : kindAt < (far ? 0.85 : 0.9) ? 'huddle' : 'farm';
      const n = kind === 'row' ? 3 + Math.floor(count * 3) : kind === 'huddle' ? 2 + Math.floor(count * 2) : 1;
      /** Each group draws from a stream of its own, so a lane's length never shifts the groups after it. */
      group(mulberry32(Math.floor(groupSeed * 4294967296)), x, z, heading, kind, n, far, d > 45, keep);
    }
  }
  return sites;
}

function group(rand: Rng, gx: number, gz: number, heading: number, kind: Kind, count: number, far: boolean, mid: boolean, keep: (s: Site) => void): void {
  if (kind === 'row') {
    /** Some lanes face their houses gable-on to the street. */
    const gableOn = rand() < 0.4;
    let h = heading;
    let x = gx;
    let z = gz;
    let reach = 0;
    for (let i = 0; i < count; i++) {
      const s = house(rand, 0, 0, gableOn ? h + Math.PI / 2 : h, far, mid);
      const half = (gableOn ? s.depth : s.len) / 2;
      const gap = range(rand, 0.5, 2.6);
      if (i > 0) {
        x += Math.cos(h) * (reach + gap + half);
        z -= Math.sin(h) * (reach + gap + half);
      }
      const off = range(rand, -0.9, 0.9);
      s.x = x - Math.sin(h) * off;
      s.z = z - Math.cos(h) * off;
      keep(s);
      reach = half;
      h += range(rand, -0.22, 0.22);
    }
    return;
  }
  const base = heading + range(rand, -0.3, 0.3);
  const around = rand() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = around + i * range(rand, 1.7, 2.4);
    const d = i === 0 ? 0 : range(rand, 8, 11);
    keep(house(rand, gx + Math.cos(a) * d, gz + Math.sin(a) * d, base + (rand() < 0.4 ? Math.PI / 2 : 0), far, mid));
  }
}

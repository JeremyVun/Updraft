import { migrateGeography } from './geography-progress';
import { MIRROR_STAR_MASK } from '../world/sky-mirror-layout';
import { GEOGRAPHY_VERSION } from '../world/geography';
import type { Cast } from './cast';
import type { ChapterName } from './journey';
import type { Seat } from '../creatures/cygnet/ride';
import { restoreWingCare } from './wing-care';

export const PROGRESS_KEY = 'updraft.progress.v1';
/** Versioned story checkpoints, not a dump of animations, callbacks or GPU textures. */
export interface Progress {
  version: 1;
  geography?: number;
  chapter: ChapterName;
  point: string;
  data: number[];
  child: number[]; // x, y, z, yaw, riding
  boat: number[]; // x, z, yaw, afloat, grounded
  bird: number[]; // x, y, z, yaw, bond, flights, visible
  seat: Seat | null;
  life: number[][];
  plane: number[]; // visible, sogginess
}

export const CHECKPOINTS: Partial<Record<ChapterName, Record<string, number>>> = {
  island: { entry: 0, companion: 0 },
  toLines: { entry: 0 }, lines: { entry: 0, 'curtain-1': 2, 'curtain-2': 2, family: 2 },
  toBoats: { entry: 0 }, boats: { entry: 0, 'pool-1': 1, 'pool-2': 1 },
  toMeadow: { entry: 0 }, meadow: { entry: 0, piano: 5, pond: 5 },
  toBirches: { entry: 0 }, birches: {
    entry: 0, swing: 3, leaves: 3,
    'scarf-0-swing': 4, 'scarf-1': 4, 'scarf-1-swing': 4,
    'scarf-2': 4, 'scarf-2-swing': 4, 'scarf-3': 4, 'scarf-3-swing': 4,
    'scarf4-0-swing': 4, 'scarf4-1': 4, 'scarf4-1-swing': 4,
    'scarf4-2': 4, 'scarf4-2-swing': 4, 'scarf4-3': 4, 'scarf4-3-swing': 4,
    'scarf4-4': 4, 'scarf4-4-swing': 4,
  },
  drowned: { entry: 0, sail: 1 }, toWood: { entry: 0 },
  wood: { entry: 0, found: 2, dry: 2 }, toSleeping: { entry: 0 },
  sleeping: { entry: 0, feather: 0, morning: 0 },
  toMirror: { entry: 0, swim: 2 }, mirror: {
    entry: 0,
    ...Object.fromEntries(Array.from({ length: MIRROR_STAR_MASK + 1 }, (_, mask) => [`stars4-${mask}`, 2])),
    stars: 2, 'stars-0': 2, 'stars-1': 2, 'stars-2': 2, 'stars-3': 2,
    'stars-4': 2, 'stars-5': 2, 'stars-6': 2, 'stars-7': 2,
    reflection: 1, window: 1, moon: 1, tide: 1, lantern: 1,
  },
  toHarbour: { entry: 0 }, toHome: { entry: 0, swim: 2 },
  home: { entry: 0, reunion: 0, drawing: 0, complete: 0 },
};

function numbers(value: unknown, count: number): value is number[] {
  return Array.isArray(value) && value.length === count && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e6);
}

export function readProgress(): Progress | null {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null');
    if (!p || p.version !== 1 || typeof p.chapter !== 'string' || typeof p.point !== 'string' || !Object.hasOwn(CHECKPOINTS, p.chapter)) return null;
    const points = CHECKPOINTS[p.chapter as ChapterName]!;
    if (!Object.hasOwn(points, p.point) || !numbers(p.data, points[p.point])) return null;
    if (!numbers(p.child, 5) || !numbers(p.boat, 5) || !numbers(p.bird, 7) || !numbers(p.plane, 2)) return null;
    if (p.seat !== null && !['cradle', 'satchel', 'lap'].includes(p.seat)) return null;
    if (!Array.isArray(p.life) || p.life.length !== 3 || !p.life.every((v: unknown) => numbers(v, 4))) return null;
    if (p.geography !== undefined && (!Number.isInteger(p.geography) || p.geography < 1 || p.geography > GEOGRAPHY_VERSION)) return null;
    return migrateGeography(p as Progress);
  } catch {
    // Storage can be unavailable or contain an old/incomplete save. Neither prevents playing.
    return null;
  }
}

export function saveProgress(chapter: ChapterName, point: string, data: number[], cast: Cast): void {
  const { child: c, boat: b, cygnet: k, life, plane } = cast;
  const p: Progress = {
    version: 1, geography: GEOGRAPHY_VERSION, chapter, point, data,
    child: [...c.position.toArray(), c.yaw, +c.riding],
    boat: [b.position.x, b.position.z, b.yaw, +b.afloat, +b.grounded],
    bird: [...k.position.toArray(), k.yaw, k.bond, k.flights, +k.visible],
    seat: k.seat,
    life: [life.regions.island.toArray(), life.regions.wave.toArray(), life.regions.waiting.toArray()],
    plane: [+plane.group.visible, plane.soggy.value],
  };
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* Saving must never interrupt play. */ }
}

export function clearProgress(): void {
  try { localStorage.removeItem(PROGRESS_KEY); } catch { /* A storage restriction must not block replay. */ }
}

/** Restores the travellers before constructing the chapter; its normal entry then supplies any walking goals. */
export function placeProgress(p: Progress, cast: Cast): void {
  const { child: c, boat: b, cygnet: k, plane } = cast;
  b.beach(p.boat[0], p.boat[1], p.boat[2]);
  b.afloat = !!p.boat[3]; b.grounded = !!p.boat[4];
  c.dismount(); c.stop(); c.place(p.child[0], p.child[2], p.child[3]); c.standUp();
  if (p.child[4]) c.ride(b.seat(c.position.clone()), b.yaw);
  k.bond = Math.max(0, Math.min(1, p.bird[4])); k.flights = Math.max(0, Math.floor(p.bird[5]));
  if (p.seat) k.rideIn(p.seat);
  else k.release(k.position.clone().fromArray(p.bird));
  k.yaw = p.bird[3]; k.visible = !!p.bird[6];
  restoreWingCare(k, p.chapter, p.point);
  plane.hold(c); plane.visible = !!p.plane[0]; plane.soggy.value = p.plane[1];
}

export function restoreLife(p: Progress, cast: Cast): void {
  cast.life.regions.island.fromArray(p.life[0]);
  cast.life.regions.wave.fromArray(p.life[1]);
  cast.life.regions.waiting.fromArray(p.life[2]);
}

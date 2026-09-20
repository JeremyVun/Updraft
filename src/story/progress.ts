import type { Cast } from './cast';
import { CHECKPOINTS } from './checkpoint-data';
export { CHECKPOINTS } from './checkpoint-data';
import type { ChapterName } from './journey';
import type { Seat } from '../creatures/cygnet/ride';
import { restoreWingCare } from './wing-care';

export const PROGRESS_KEY = 'updraft.progress.v1';
/** Versioned story checkpoints, not a dump of animations, callbacks or GPU textures. */
export interface Progress {
  version: 1;
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

function numbers(value: unknown, count: number): value is number[] {
  return Array.isArray(value) && value.length === count && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e6);
}

/** Pure decoding keeps validation independent of browser storage and preserves every v1 legacy checkpoint. */
export function decodeProgress(value: unknown): Progress | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (p.version !== 1 || typeof p.chapter !== 'string' || typeof p.point !== 'string' || !Object.hasOwn(CHECKPOINTS, p.chapter)) return null;
  const points = CHECKPOINTS[p.chapter as ChapterName]!;
  if (!Object.hasOwn(points, p.point) || !numbers(p.data, points[p.point])) return null;
  if (!numbers(p.child, 5) || !numbers(p.boat, 5) || !numbers(p.bird, 7) || !numbers(p.plane, 2)) return null;
  if (p.seat !== null && !['cradle', 'satchel', 'lap'].includes(p.seat as string)) return null;
  if (!Array.isArray(p.life) || p.life.length !== 3 || !p.life.every((v: unknown) => numbers(v, 4))) return null;
  return value as Progress;
}

export function readProgress(): Progress | null {
  try { return decodeProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null')); }
  catch { return null; } // Unavailable storage or an incomplete save must never prevent playing.
}

export function saveProgress(chapter: ChapterName, point: string, data: number[], cast: Cast): void {
  const { child: c, boat: b, cygnet: k, life, plane } = cast;
  const p: Progress = {
    version: 1, chapter, point, data,
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

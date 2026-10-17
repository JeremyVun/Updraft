import { BOATS_BERTH } from '../world/little-boats-layout';
import { MIRROR_BERTH } from '../world/sky-mirror-layout';
import type { Progress } from './progress';
import { STILL_SHIFT, SHORE_SEPARATION } from '../world/geography';
import { BIRCHES_LOCAL, birchesAt } from '../world/birches-layout';
import { BOATS_SHIFT, BOATS_OFFSHORE_SHIFT, BOATS_SHORTENING, SHORE_SHIFT, MIRROR_SHIFT, HOME_SHIFT, SEA_SHORTENING, PAST_THE_WHALE, ONWARD_SEA, WHALE_MOVE, WHALE_NEARER, WHALE_SHORTENING, MIRROR_SHORTENING, LINES_SHIFT, GEOGRAPHY_VERSION } from '../world/geography';

/** Preserve chapter progress when the islands move. Old sailing saves resume in safe open water. */
export function migrateGeography(p: Progress): Progress {
  if (p.geography === GEOGRAPHY_VERSION) return p;
  if ((p.geography ?? 0) < 6) migrateOriginalGeography(p);
  else if (p.geography! < 9) {
    const move = { x: (p.geography! < 8 ? ONWARD_SEA.x : 0) + MIRROR_SHORTENING.x,
      z: (p.geography! < 8 ? ONWARD_SEA.z : 0) + MIRROR_SHORTENING.z };
    if (['mirror', 'toHarbour', 'home'].includes(p.chapter)) {
      for (const [v, z] of [[p.child, 2], [p.bird, 2], [p.boat, 1]] as const) {
        v[0] += move.x;
        v[z] += move.z;
      }
    }
    for (const region of p.life) if (region[1] < -2180) {
      region[0] += move.x;
      region[1] += move.z;
    }
  }
  if ((p.geography ?? 0) < 7 && p.chapter === 'toMirror' && p.point.startsWith('whale-')) {
    for (const [v, z] of [[p.child, 2], [p.bird, 2], [p.boat, 1]] as const) {
      v[0] += WHALE_NEARER.x;
      v[z] += WHALE_NEARER.z;
    }
  }
  if ((p.geography ?? 0) < 9 && p.chapter === 'toMirror' && (p.point === 'swim' || p.point.startsWith('whale-'))) {
    for (const [v, z] of [[p.child, 2], [p.bird, 2], [p.boat, 1]] as const) {
      v[0] += WHALE_SHORTENING.x;
      v[z] += WHALE_SHORTENING.z;
    }
  }
  if ((p.geography ?? 0) < 10) {
    if (p.chapter === 'island' || p.chapter === 'toLines') {
      for (const [v, z] of [[p.child, 2], [p.bird, 2], [p.boat, 1]] as const) {
        v[0] += STILL_SHIFT.x;
        v[z] += STILL_SHIFT.z;
      }
    }
    for (const region of p.life) if (region[2] > 0 && region[1] > -150 && Math.abs(region[0]) < 150) {
      region[0] += STILL_SHIFT.x;
      region[1] += STILL_SHIFT.z;
    }
  }
  if ((p.geography ?? 0) < 11) {
    if (p.chapter === 'toBoats' || p.chapter === 'lines' && p.point === 'family') {
      for (const [v, z] of [[p.child, 2], [p.bird, 2], [p.boat, 1]] as const) {
        if (p.chapter === 'lines' && v[0] < 150) continue;
        v[0] += SHORE_SEPARATION.x;
        v[z] += SHORE_SEPARATION.z;
      }
    }
    for (const region of p.life) if (Math.hypot((region[0] - 240) / 23, (region[1] + 365) / 30) < 1.6) {
      region[0] += SHORE_SEPARATION.x;
      region[1] += SHORE_SEPARATION.z;
    }
  }
  if ((p.geography ?? 0) < 12 && ['birches', 'toStairs', 'drowned'].includes(p.chapter)) {
    for (const [v, z] of [[p.child, 2], [p.bird, 2], [p.boat, 1]] as const) {
      // Only what was on or just off the island moves with it; older village saves began on its far beach.
      if (Math.hypot((v[0] - BIRCHES_LOCAL.x) / BIRCHES_LOCAL.rx, (v[z] - BIRCHES_LOCAL.z) / BIRCHES_LOCAL.rz) > 1.3) continue;
      const at = birchesAt(v[0], v[z]);
      v[0] = at.x;
      v[z] = at.z;
    }
  }
  p.geography = GEOGRAPHY_VERSION;
  return p;
}

function migrateOriginalGeography(p: Progress): void {
  const original = !p.geography;
  const beforeSea = (p.geography ?? 0) < 2;
  const boatsShift = p.geography === 3 ? BOATS_SHORTENING
    : { x: BOATS_OFFSHORE_SHIFT.x + BOATS_SHORTENING.x, z: BOATS_OFFSHORE_SHIFT.z + BOATS_SHORTENING.z };
  const lateShift = { x: (beforeSea ? SEA_SHORTENING.x : 0) + PAST_THE_WHALE.x + ONWARD_SEA.x + MIRROR_SHORTENING.x,
    z: (beforeSea ? SEA_SHORTENING.z : 0) + PAST_THE_WHALE.z + ONWARD_SEA.z + MIRROR_SHORTENING.z };
  let shift = { x: 0, z: 0 };
  if (original && ['boats', 'toMeadow'].includes(p.chapter)) shift = BOATS_SHIFT;
  else if (['boats', 'toMeadow'].includes(p.chapter)) shift = boatsShift;
  else if (original && (p.chapter === 'toBoats' || p.chapter === 'lines' && p.point === 'family')) shift = SHORE_SHIFT;
  else if (p.chapter === 'home') shift = original ? HOME_SHIFT : lateShift;
  else if (p.chapter === 'mirror' || p.chapter === 'toHarbour') shift = original ? MIRROR_SHIFT : lateShift;
  else if (beforeSea && (p.chapter === 'toMirror' || p.chapter === 'toHome') && p.point === 'swim') {
    shift = { x: -385 - p.boat[0], z: -1985 - p.boat[1] };
    p.data[0] = 1;
  } else if (p.chapter === 'toMirror' && p.point.startsWith('whale-')) shift = WHALE_MOVE;
  // Before Little Boats existed, this checkpoint departed straight from the door shore.
  if (original && p.chapter === 'toMeadow' && p.boat[0] < 283 && p.boat[1] > -550) {
    shift = { x: BOATS_BERTH.x - p.boat[0], z: BOATS_BERTH.z - p.boat[1] };
  }
  // The first mirror ended on its northern shelf. Resume at today's departure berth, not across the flat.
  if (original && p.chapter === 'toHarbour' && p.boat[0] < -420 && p.boat[1] > -2280) {
    shift = { x: MIRROR_BERTH.x - p.boat[0], z: MIRROR_BERTH.z - p.boat[1] };
  }
  if (p.chapter === 'toHome') p.chapter = 'toMirror';
  const beforeLines = (p.geography ?? 0) < 5;
  const onOldLines = (x: number, z: number) => beforeLines && x > -70 && x < 100 && z < -290 && z > -450;
  for (const [v, z] of [[p.child, 2], [p.bird, 2], [p.boat, 1]] as const) {
    v[0] += shift.x; v[z] += shift.z;
    if (p.chapter === 'lines' && onOldLines(v[0], v[z])) { v[0] += LINES_SHIFT.x; v[z] += LINES_SHIFT.z; }
  }
  for (const region of p.life) {
    const [x,z] = region;
    const oldBoats = p.geography === 3 ? { x: 200, z: -230 } : { x: 230, z: -495 };
    const late = beforeSea ? x < -270 && z < -2090 || x >= -270 && z < -2250 : z < -2000;
    const move = !original ? (Math.abs(x - oldBoats.x) < 70 && Math.abs(z - oldBoats.z) < 100 ? boatsShift
      : late ? lateShift : null)
      : x > 280 && z < -500 && z > -720 ? BOATS_SHIFT
      : x < -330 && z < -2180 ? MIRROR_SHIFT
      : x > -240 && z < -1990 ? HOME_SHIFT : null;
    if (move) { region[0] += move.x; region[1] += move.z; }
    else if (onOldLines(x, z)) { region[0] += LINES_SHIFT.x; region[1] += LINES_SHIFT.z; }
  }
}

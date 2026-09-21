import { BOATS_BERTH } from '../world/little-boats-layout';
import { MIRROR_BERTH } from '../world/sky-mirror-layout';
import type { Progress } from './progress';
import { BOATS_SHIFT, SHORE_SHIFT, MIRROR_SHIFT, HOME_SHIFT, SEA_SHORTENING, GEOGRAPHY_VERSION } from '../world/geography';

/** Preserve chapter progress when the islands move. Old sailing saves resume in safe open water. */
export function migrateGeography(p: Progress): Progress {
  if (p.geography === GEOGRAPHY_VERSION) return p;
  const original = !p.geography;
  let shift = { x: 0, z: 0 };
  if (original && ['boats', 'toMeadow'].includes(p.chapter)) shift = BOATS_SHIFT;
  else if (original && (p.chapter === 'toBoats' || p.chapter === 'lines' && p.point === 'family')) shift = SHORE_SHIFT;
  else if (p.chapter === 'home') shift = original ? HOME_SHIFT : SEA_SHORTENING;
  else if (p.chapter === 'mirror' || p.chapter === 'toHarbour') shift = original ? MIRROR_SHIFT : SEA_SHORTENING;
  else if ((p.chapter === 'toMirror' || p.chapter === 'toHome') && p.point === 'swim') {
    shift = { x: -385 - p.boat[0], z: -1985 - p.boat[1] };
    p.data[0] = 1;
  }
  // Before Little Boats existed, this checkpoint departed straight from the door shore.
  if (original && p.chapter === 'toMeadow' && p.boat[0] < 283 && p.boat[1] > -550) {
    shift = { x: BOATS_BERTH.x - p.boat[0], z: BOATS_BERTH.z - p.boat[1] };
  }
  // The first mirror ended on its northern shelf. Resume at today's departure berth, not across the flat.
  if (original && p.chapter === 'toHarbour' && p.boat[0] < -420 && p.boat[1] > -2280) {
    shift = { x: MIRROR_BERTH.x - p.boat[0], z: MIRROR_BERTH.z - p.boat[1] };
  }
  if (p.chapter === 'toHome') p.chapter = 'toMirror';
  for (const [v, z] of [[p.child, 2], [p.bird, 2], [p.boat, 1]] as const) {
    v[0] += shift.x; v[z] += shift.z;
  }
  for (const region of p.life) {
    const [x,z] = region;
    const move = !original ? (x < -270 && z < -2090 || x >= -270 && z < -2250 ? SEA_SHORTENING : null)
      : x > 280 && z < -500 && z > -720 ? BOATS_SHIFT
      : x < -330 && z < -2180 ? MIRROR_SHIFT
      : x > -240 && z < -1990 ? HOME_SHIFT : null;
    if (move) { region[0] += move.x; region[1] += move.z; }
  }
  p.geography = GEOGRAPHY_VERSION;
  return p;
}

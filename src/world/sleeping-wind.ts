import * as THREE from 'three';
import { tuning } from '../tuning';

/** Broad gust fronts with uneven lulls, shared by snowfall, ambient wind and the sound mix. */
export function sleepingGust(time: number, cold: number, dawn: number): number {
  const front = Math.pow(.5 + .5 * Math.sin(time * .73 + .7 * Math.sin(time * .19)), 2);
  return cold * cold * (1 - dawn) * (.18 + tuning.sleeping.winterGust * front);
}

/**
 * The night's wind out on the hill, set by the chapter each frame. `rise` follows the climb's exposure while the bird
 * is out on the hill and settles back at the summit; `lull` is how far the wind drops, in the fog's white and at the
 * summit; `answer` is its swell after the call into the fog; `toward` is the way it blows.
 */
export const NIGHT_WIND = { rise: 0, lull: 0, answer: 0, toward: new THREE.Vector2(1, 0) };

/**
 * What the room's wind sound follows: the gust fronts, harder higher up over a roar that grows toward the crest, held
 * under `nightWindMost` so the crest blows hard and steady rather than peaking over the summit's moment.
 */
export function nightWindSound(time: number, cold: number, dawn: number): number {
  const t = tuning.sleeping, { rise, lull, answer } = NIGHT_WIND;
  const night = cold * cold * (1 - dawn), gust = sleepingGust(time, cold, dawn);
  const wind = Math.max(gust, Math.min(t.nightWindMost, gust * (1 + t.nightWindGusts * rise) + night * t.nightWindRoar * rise * rise));
  return wind * (1 - lull) + night * t.nightWindAnswer * answer;
}

import { tuning } from '../tuning';

/** Broad gust fronts with uneven lulls, shared by snowfall, ambient wind and the sound mix. */
export function sleepingGust(time: number, cold: number, dawn: number): number {
  const front = Math.pow(.5 + .5 * Math.sin(time * .73 + .7 * Math.sin(time * .19)), 2);
  return cold * cold * (1 - dawn) * (.18 + tuning.sleeping.winterGust * front);
}

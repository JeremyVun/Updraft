import type { Cygnet, Heard } from '../creatures/cygnet';
import { tuning } from '../tuning';
import type { Foley } from './foley';

/**
 * What the climb does to the bird's own sounds: snow under it and round its chest in the drift, and the bandaged wing
 * whenever it scrambles or, at the step, beats and hopes. Anything else sounds as it does everywhere.
 */
export class SleepingFoley {
  private snowy = false;
  constructor(private readonly foley: Foley) {}

  /** Plays the climb's version of `h` and returns true, or returns false for the ordinary sound. */
  heard(h: Heard, bird: Cygnet, snow: number, pan: number): boolean {
    const t = tuning.sleeping;
    if (h.kind === 'shake' && this.snowy) {
      this.snowy = false;
      this.foley.shake(pan, 0);
      this.foley.snowShed(pan);
      return true;
    }
    if (snow > t.crunchFrom) {
      const depth = Math.min(1, snow / t.driftChest);
      this.snowy = true;
      if (h.kind === 'step') this.foley.snowStep(depth, h.amount, pan);
      else if (h.kind === 'scramble') this.foley.wade(depth, pan);
      else return false;
      return true;
    }
    if (bird.wing.state !== 'wrapped') return false;
    if (h.kind === 'scramble') this.foley.bandagedScramble(pan);
    else if (h.kind === 'flap' && bird.hopeBeats > 0) this.foley.bandagedFlap(h.amount, pan);
    else if (h.kind === 'flutter' && bird.hopeBeats > 0) this.foley.bandagedFlutter(h.amount, pan);
    else return false;
    return true;
  }
}

/** Story moments the music answers. */
export type Cue = 'breeze' | 'delight' | 'restored' | 'overhead' | 'skein' | 'fallen' | 'landed' | 'kindled' | 'comfort' | 'distress' | 'calling' | 'bugle' | 'becalmed' | 'filled' | 'feather' | 'lifted' | 'wave' | 'unfold' | 'release' | 'home' | 'finale';

const pending: Cue[] = [];

export function cue(name: Cue): void {
  pending.push(name);
}

/** The opening island's rising phrase is the shared sound for completing a major objective.
 * Call at the one-way success transition, never from checkpoint restoration or smaller progress steps. */
export function completeObjective(): void {
  cue('restored');
}

/** The cues raised since the last call. */
export function takeCues(): Cue[] {
  return pending.splice(0, pending.length);
}

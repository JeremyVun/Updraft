/** Story moments the music answers. */
export type Cue = 'breeze' | 'restored' | 'wave' | 'unfold' | 'release' | 'home';

const pending: Cue[] = [];

export function cue(name: Cue): void {
  pending.push(name);
}

/** The cues raised since the last call. */
export function takeCues(): Cue[] {
  return pending.splice(0, pending.length);
}

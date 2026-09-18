/** Story moments the music answers. */
export type Cue = 'breeze' | 'delight' | 'restored' | 'skein' | 'fallen' | 'distress' | 'calling' | 'bugle' | 'becalmed' | 'filled' | 'lifted' | 'wave' | 'unfold' | 'release' | 'home' | 'finale';

const pending: Cue[] = [];

export function cue(name: Cue): void {
  pending.push(name);
}

/** The cues raised since the last call. */
export function takeCues(): Cue[] {
  return pending.splice(0, pending.length);
}

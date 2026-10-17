/** One-way story sound events; environmental calls do not duck the music. */
export type Cue = 'foghorn' | 'kindled' | 'comfort' | 'distress' | 'calling' | 'bugle' | 'flightHome' | 'puzzled' | 'hoot';

const pending: Cue[] = [];

export function cue(name: Cue): void {
  pending.push(name);
}

/** The cues raised since the last call. */
export function takeCues(): Cue[] {
  return pending.splice(0, pending.length);
}

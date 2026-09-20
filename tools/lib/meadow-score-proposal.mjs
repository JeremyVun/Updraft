// Listening study only: the walk after the piano, through the flock's departure and the safe paddle.
// No puzzle, chapter-transition or runtime music changes.
export const meadowStudy = {
  seconds: 72, label: 'Meadow — colour, longing, companionship',
  intent: 'A gentle melodic line after the island wakes, space for the departing swans, and a small return of warmth after the paddle.',
  phases: [[0, 'walking through the awakened meadow'], [24, 'the flock is already leaving'],
    [34, 'a safe paddle and waiting hands'], [50, 'the bird returns'], [56, 'walking on together']],
};
const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function meadowState(time, base) {
  const crest = smooth(time, 23, 26) * (1 - smooth(time, 32, 36));
  const pond = smooth(time, 32, 36) * (1 - smooth(time, 49, 53));
  const stroke = at => time >= at && time < at + .5 ? 8 : 0;
  return { ...base, music: 'meadow', flockChatter: false, piano: 0, pianoActive: false,
    life: 1, night: 0, land: 1, meadow: 1, sea: .16, cold: 0, breeze: .65,
    hush: .45 * crest + .3 * pond, shower: .35 * smooth(time, 56, 64),
    gust: Math.max(stroke(8), stroke(18), stroke(41), stroke(63)), charge: 0, pan: -.2,
    cygnet: { active: true, pan: -.18, distance: 12 },
    flock: { active: time < 36, pan: .3, distance: 80 + 260 * smooth(time, 24, 37) }, cues: [],
  };
}

/** The same production voices and physical sounds accompany both backgrounds. */
export function meadowEvents(tick, sound, foley, state) {
  const time = tick / 8;
  if (tick === 25 * 8) state.cues.push('bugle');
  if (tick === 29 * 8 || tick === 35 * 8) state.cues.push('calling');
  if (tick === 50 * 8) state.cues.push('restored');
  if (foley) {
    if ((time < 24 || time >= 57) && tick % 8 === 0) foley.step('grass', .3, -.18);
    if (time >= 35 && time < 49 && tick % 5 === 0) foley.paddle(.3, -.18);
  }
}

export function meadowMusic({ pad, voice, pluck }) {
  // A close relative of the existing D / B minor / G / A harmony, with a quiet moving upper line.
  for (const [at, duration, chord, level] of [
    [0, 9, [50,57,64,66], .006], [10, 9, [47,54,62,66], .0062],
    [20, 7, [43,50,59,64], .0045], [29, 7, [45,52,59,64], .0028],
    [37, 7, [47,54,62,66], .0028], [45, 8, [43,54,59,62], .0032],
    [54, 9, [50,57,64,66], .0058], [64, 5, [45,52,59,64], .0048],
  ]) pad(at, duration, chord, level);
  // D–E–F♯–B recalls the puzzle's first ascending shape in a softer, sustained voice.
  // No automatic melody during the migration, unanswered calls, paddle or completion cue.
  for (const [at, midi, duration, level] of [
    [2,62,2.1,.0042], [5,64,1.8,.0038], [7.5,66,2.4,.0043], [11,71,2.8,.004],
    [16,69,2,.0036], [19,66,2.2,.0037],
    [57,66,2.3,.0035], [61,64,2,.0032], [65,62,3,.0035],
  ]) voice(midi, at, duration, level, .08, 'soft');
  // A handful of rounded plucks gives the grassland movement without another toy-boat rhythm.
  for (const [at, midi, level] of [[1.25,57,.008], [7.25,62,.007], [13.75,59,.0075], [18.25,66,.0065],
    [55.5,62,.007], [60,57,.0065], [66.5,64,.006]]) pluck(midi, at, level, -.22, 2.7);
}

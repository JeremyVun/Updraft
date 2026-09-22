// Audition only. Use the game's ACTUAL pad, filter, reverb, gain and detuning.
// Change only its chord progression and within-phrase harmonic pace. No added instruments.
const opening = [
  ['D5', [50,57,62,69]], ['Bm7', [47,54,62,69]],
  ['Em9', [40,55,62,66]], ['A7sus4', [45,55,62,64]],
  ['Dmaj7', [50,57,61,66]], ['Gmaj7', [43,54,59,62]],
  ['C#m7b5', [49,55,59,64]], ['F#7', [42,58,61,64]],
  ['Bm7', [47,54,62,69]], ['Em9', [40,55,62,66]],
  ['A7sus4', [45,55,62,64]], ['A7', [45,55,61,64]],
  ['D(add9)', [50,57,64,69]],
];
const summit = [
  ['Em7', [40,55,59,62]], ['A7', [45,55,61,64]],
  ['Dmaj7', [50,57,61,66]], ['Gmaj7', [43,54,59,62]],
  ['C#m7b5', [49,55,59,64]], ['F#7', [42,58,61,64]],
  ['Bm7', [47,54,62,66]], ['Em9', [40,55,62,66]],
  ['A7sus4', [45,55,62,64]], ['A7', [45,55,61,64]],
  ['Gm6', [43,58,62,64]], ['D/F#', [42,57,62,66]],
  ['D6', [50,57,59,66]],
];
export const studies = Object.fromEntries([
  ['opening', 'still', opening, 'The original drone instrument follows a searching circle of fifths, returning to an open D.'],
  ['summit', 'home', summit, 'The original drone instrument moves through fifths and a borrowed minor chord before finding D.'],
].map(([name, mood, progression, intent]) => [name, {
  mood, seconds: 80, usesProductionPad: true, intent,
  chords: progression.map(([label, tones], i) => [i * 6, i === 12 ? 8 : 6, tones, label]),
}]));

export function studyState(name, t, base) {
  return {...base, music: studies[name].mood, startingIsland: name === 'opening',
    life: name === 'opening' ? Math.min(1, .1 + t / 48) : 1,
    night: 0, hush: 0, gust: 0, breeze: 0, sea: 0, land: 1, meadow: 0,
    flockChatter: false, cues: []};
}

export function scheduleStudy(name, ctx, sound) {
  const pad = sound.padVoices, voices = new Set(), schedule = [];
  // The fixture owns frequency automation only. Production continues controlling filter, level and room.
  // Keep its normal update from overwriting these pitches at the old 10/16-second chord boundaries.
  sound.padVoices = [];
  for (const [at, , chord, label] of studies[name].chords) {
    pad.forEach((voice, i) => {
      const hz = 440 * 2 ** ((chord[i] - 69) / 12);
      for (const osc of voice.osc) osc.frequency.setTargetAtTime(hz, at, at === 0 ? 3.5 : .85);
      if (at === 0) voice.gain.gain.setTargetAtTime(.25, 0, 2.5);
    });
    schedule.push({at, chord, label});
  }
  for (const voice of pad) for (const osc of voice.osc) {
    voices.add(osc); osc.stop(84);
    osc.addEventListener('ended', () => {voices.delete(osc); osc.disconnect();}, {once: true});
  }
  return {voices, schedule, dispose() {
    for (const voice of pad) voice.gain.disconnect();
    sound.padVoices = pad;
  }};
}

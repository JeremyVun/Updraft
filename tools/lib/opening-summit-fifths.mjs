// REJECTED: Jeremy wants the game's droning style retained; the piano changes its identity.
// Historical listening revision: piano-led phrases and fifths motion.
// Preview only: the game and its approved recognition melody are not changed.
const H = {
  bm: {name: 'Bm9', tones: [47, 54, 57, 62, 66]},
  em: {name: 'Em9', tones: [40, 55, 59, 62, 66]},
  a: {name: 'A13', tones: [45, 55, 61, 64, 66]},
  d: {name: 'Dmaj9', tones: [50, 57, 61, 64, 66]},
  g: {name: 'Gmaj9', tones: [43, 54, 59, 62, 69]},
  cs: {name: 'C#m7b5', tones: [49, 55, 59, 64]},
  fs: {name: 'F#7(b9)', tones: [42, 58, 61, 64, 67]},
  b: {name: 'B7', tones: [47, 54, 57, 63]},
  gm: {name: 'Gm6', tones: [43, 58, 62, 64]},
  df: {name: 'D/F#', tones: [42, 57, 62, 66]},
  as: {name: 'A7sus4', tones: [45, 55, 62, 64]},
  dr: {name: 'D6/9', tones: [50, 57, 59, 64, 66]},
};
// Each pair is a harmony and an authored melodic cell. Offsets below leave space between phrases.
const opening = [
  ['bm', [66, 69, 73, 71]], ['em', [67, 66, 64]],
  ['a', [64, 67, 66, 64]], ['d', [66, 64, 61]],
  ['g', [62, 66, 69]], ['cs', [67, 66, 64]],
  ['fs', [64, 61, 58]], ['bm', [62, 61, 59]],
  ['bm', [66, 69, 73, 74]], ['em', [71, 69, 67]],
  ['a', [69, 67, 66, 64]], ['d', [66, 69, 73]],
  ['g', [74, 73, 71]], ['cs', [71, 67, 64]],
  ['fs', [67, 66, 64, 61]], ['bm', [62, 61, 66]],
];
const summit = [
  ['em', [67, 71, 74, 73]], ['a', [73, 71, 69]],
  ['d', [69, 66, 64]], ['g', [66, 67, 69]],
  ['cs', [71, 67, 64]], ['fs', [64, 61, 58]],
  ['bm', [62, 66, 69]], ['b', [69, 66, 63]],
  ['em', [67, 71, 74]], ['a', [73, 71, 69]],
  ['d', [69, 66, 64]], ['g', [66, 67, 71]],
  ['gm', [70, 69, 67]], ['df', [69, 66, 64]],
  ['as', [67, 64]], ['dr', [66, 64, 62]],
];
const phrase = 4.5;
export const studies = Object.fromEntries([
  ['opening', 'still', opening, 'An unfolding minor-key circle: an invitation, a question, a varied return left slightly open.'],
  ['summit', 'home', summit, 'Fifths find their way toward D; the borrowed minor fourth colours the homecoming with separation.'],
].map(([name, mood, bars, intent]) => [name, {mood, seconds: 80, intent,
  chords: bars.map(([h], i) => [i * phrase, phrase, H[h].tones, H[h].name]),
  melody: bars.map(([, notes], i) => ({at: i * phrase, notes})),
}]));

export function studyState(name, t, base) {
  return {...base, music: studies[name].mood, startingIsland: name === 'opening',
    life: name === 'opening' ? Math.min(1, .1 + t / 48) : 1,
    night: 0, hush: 0, gust: 0, breeze: 0, sea: 0, land: 1, meadow: 0,
    flockChatter: false, cues: []};
}

export function scheduleStudy(name, ctx, sound, PianoStrings) {
  const study = studies[name], voices = new Set(), schedule = [], owned = [];
  const dry = ctx.createGain(), felt = ctx.createBiquadFilter(), wet = ctx.createGain();
  const touch = ctx.createDynamicsCompressor();
  // The production piano's key/hammer transient is prominent when brought this close.
  // Reduce its crest so the sung part of each note survives at quiet background levels.
  touch.threshold.value = -44; touch.knee.value = 16; touch.ratio.value = 3;
  touch.attack.value = .004; touch.release.value = .22;
  felt.type = 'lowpass'; felt.frequency.value = 2400; felt.Q.value = .4;
  dry.connect(felt).connect(touch).connect(sound.backgroundDry);
  wet.gain.value = .72; wet.connect(sound.backgroundWet);
  owned.push(dry, felt, touch, wet);
  const piano = new PianoStrings(); piano.setOutput({ctx, bus: dry, reverb: wet});
  const keys = [];
  const key = (at, midi, velocity, level, role) => keys.push({at, midi, velocity, level, role});
  function strings(at, chord, bar) {
    // A small decaying cushion, never a sustained foreground drone. Omit two bars to let phrases breathe.
    if (bar === 7 || bar === 14) return;
    chord.slice(1, 4).forEach((midi, i) => {
      const osc = ctx.createOscillator(), env = ctx.createGain(), filter = ctx.createBiquadFilter();
      osc.type = 'triangle'; osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      filter.type = 'lowpass'; filter.frequency.value = 650; filter.Q.value = .3;
      const level = name === 'opening' ? .00125 : .0015;
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(level, at + .7 + i * .08);
      env.gain.exponentialRampToValueAtTime(level * .22, at + 3.3);
      env.gain.linearRampToValueAtTime(0, at + 4.45);
      osc.connect(env).connect(filter).connect(sound.backgroundBus);
      voices.add(osc); osc.start(at); osc.stop(at + 4.5);
      osc.onended = () => {voices.delete(osc); osc.disconnect(); env.disconnect(); filter.disconnect();};
      schedule.push({at, midi, role: 'strings', end: at + 4.5});
    });
  }
  study.chords.forEach(([at, , chord], bar) => {
    const breath = bar === 7 || bar === 15;
    key(at + .03, chord[0], .36, .7, 'bass');
    // Broken inner voicing gives a gentle pulse; phrase endings omit its second half.
    key(at + .78, chord[1], .25, .50, 'accompaniment');
    key(at + 1.53, chord[2], .23, .46, 'accompaniment');
    if (!breath) key(at + 3.03, chord[3], .22, .45, 'accompaniment');
    strings(at, chord, bar);
    const notes = study.melody[bar].notes;
    const offsets = notes.length === 4 ? [.38, 1.88, 2.63, 3.38]
      : notes.length === 2 ? [.38, 2.63] : breath ? [.38, 1.5, 2.25] : [.38, 1.88, 3.0];
    notes.forEach((midi, n) => {
      const phraseShape = [1, .87, .92, .78][n];
      const intensity = (bar >= 8 && bar <= 11 ? 1.07 : 1) * (breath ? .88 : 1);
      key(at + offsets[n], midi, .47 * phraseShape * intensity, .92, 'melody');
    });
  });
  // Long soft final bass, with the last melodic note allowed to finish in its own space.
  key(72, name === 'opening' ? 47 : 50, .24, .62, 'last bass');
  keys.sort((a, b) => a.at - b.at);
  for (const note of keys) {
    const sources = piano.note(note.midi, note.velocity,
      note.role === 'melody' ? .10 : note.role.includes('bass') ? -.16 : -.24,
      note.level, note.at);
    if (!sources.length) throw new Error(`Dropped piano note at ${note.at}: ${note.midi}`);
    for (const source of sources) {
      voices.add(source); source.addEventListener('ended', () => voices.delete(source), {once: true});
    }
    schedule.push(note);
  }
  return {voices, schedule, dispose() {piano.setOutput(null); for (const node of owned) node.disconnect();}};
}

// Narrative harmonic study. Original production drone; authored voice leading and phrase lengths.
// Times compress emotional sections for listening, never proposed gameplay/story triggers.
const opening = [
  [0, 'D5', [50,57,62,69], 'unfamiliar ground'],
  [6, 'Bm7', [47,54,62,69], 'D and A remain; first trace of longing'],
  [12, 'Gadd9', [43,59,62,69], 'the inner voice rises as the bass falls; D and A remain'],
  [18, 'Em7', [40,55,62,67], 'a downward answer'],
  [24, 'A7sus4', [45,55,62,64], 'question'],
  [28, 'A7', [45,55,61,64], 'D settles into C-sharp'],
  [34, 'D', [50,57,62,66], 'first unambiguous warmth'],
  [40, 'D7/C', [48,57,62,66], 'warmth becomes unfamiliar again'],
  [46, 'Bm7', [47,57,62,66], 'bass keeps descending beneath the same upper chord'],
  [52, 'Gmaj7', [43,55,62,66], 'room to look around'],
  [58, 'A7sus4', [45,55,62,64], 'the earlier question returns'],
  [62, 'A7', [45,55,61,64], 'expectation'],
  [68, 'Bm', [47,54,62,66], 'a deceptive answer: not home yet'],
  [74, 'G6/9', [43,57,62,64], 'the world opens'],
  [80, 'Asus4', [45,57,62,64], 'held breath'],
  [86, 'Dsus2', [50,57,62,64], 'an open ending, with no final major third'],
];
const summit = [
  [0, 'Bm7', [47,57,62,66], 'arrival with the journey still in it'],
  [6, 'Em9', [40,55,62,66], 'F-sharp stays, becoming a ninth'],
  [12, 'A7sus4', [45,55,62,64], 'waiting for the bird to trust the wind'],
  [16, 'A7', [45,55,61,64], 'the suspension yields'],
  [22, 'Dmaj9', [50,57,61,64], 'warmth, still suspended on E'],
  [28, 'Gmaj7', [43,55,62,66], 'the upper voice begins to rise'],
  [34, 'D/F#', [42,57,62,66], 'bass falls while F-sharp holds'],
  [40, 'Em7', [40,55,62,67], 'G above the falling bass'],
  [46, 'Asus4', [45,57,62,69], 'A: the widest opening, for flight'],
  [52, 'D6', [50,57,59,66], 'the bird has somewhere to go'],
  [58, 'Bm7', [47,57,62,66], 'the child is left behind'],
  [64, 'Gmaj7', [43,59,62,66], 'tenderness'],
  [70, 'Gm6', [43,58,62,64], 'B lowers to B-flat; the cost of goodbye'],
  [76, 'D/F#', [42,57,62,66], 'B-flat lowers to A; recognition begins'],
  [82, 'Em7', [40,55,62,67], 'one final approach'],
  [86, 'A7sus4', [45,55,62,64], 'a last suspension'],
  [90, 'D6', [50,57,59,66], 'a quiet place to stop'],
];
export const studies = Object.fromEntries([
  ['opening', 'still', opening, 'Lostness becomes curiosity and care; warmth appears without supplying a final answer.'],
  ['summit', 'home', summit, 'Flight opens the harmony; separation withdraws it; home is the later, quieter resolution.'],
].map(([name, mood, rows, intent]) => [name, {
  mood, seconds: 100, usesProductionPad: true, preserveIntro: name === 'opening', intent,
  chords: rows.map(([at, label, notes, meaning], i) => [at, (rows[i + 1]?.[0] ?? 100) - at, notes, label, meaning]),
  phases: name === 'opening' ? [[0,'lostness'],[18,'discovery'],[34,'warmth'],[58,'searching again']]
    : [[0,'climb'],[28,'flight and reunion'],[58,'separation'],[76,'home']],
}]));

export function studyState(name, t, base) {
  return {...base, music: studies[name].mood, startingIsland: name === 'opening',
    life: name === 'opening' ? Math.min(1, .1 + t / 48) : 1,
    night: 0, hush: 0, gust: 0, breeze: 0, sea: 0, land: 1, meadow: 0,
    flockChatter: false, cues: []};
}

export function scheduleStudy(name, ctx, sound) {
  const pad = sound.padVoices, voices = new Set(), schedule = [], study = studies[name];
  sound.padVoices = [];
  // The original pad/reverb remain. This gain shapes whole phrases, not note attacks or a new instrument.
  const phrase = ctx.createGain();
  sound.padFilter.disconnect(); sound.padFilter.connect(phrase).connect(sound.backgroundBus);
  const dynamics = name === 'opening'
    ? [[0,1],[12,1],[24,.88],[34,1],[46,.97],[58,.88],[68,.90],[80,.84],[92,.80]]
    : [[0,.84],[16,.76],[28,.88],[40,1],[48,1.06],[54,.90],[62,.48],[70,.40],[76,.42],[86,.66],[94,.72]];
  dynamics.forEach(([at, level], i) => {
    if (!i) phrase.gain.setValueAtTime(level, at);
    else phrase.gain.linearRampToValueAtTime(level, at);
  });
  let previous;
  for (const [at, , chord, label, meaning] of study.chords) {
    pad.forEach((voice, i) => {
      // Retain shared tones exactly; the bass arrives first, an inner suspension resolves later.
      // All voices still belong to the same continuous, slightly detuned production pad.
      if (previous && previous[i] === chord[i]) return;
      const delay = at === 0 ? 0 : i === 0 ? 0 : i === 2 ? .30 : .12;
      const response = at === 0 ? 3.5 : i === 0 ? .62 : .82;
      for (const osc of voice.osc) {
        osc.frequency.setTargetAtTime(440 * 2 ** ((chord[i] - 69) / 12), at + delay, response);
      }
    });
    schedule.push({at, chord, label, meaning,
      heldVoices: previous ? chord.flatMap((midi, i) => midi === previous[i] ? [i] : []) : []});
    previous = chord;
  }
  for (const voice of pad) {
    voice.gain.gain.setTargetAtTime(.25, 0, 2.5);
    for (const osc of voice.osc) {
      voices.add(osc); osc.stop(study.seconds + 4);
      osc.addEventListener('ended', () => {voices.delete(osc); osc.disconnect();}, {once: true});
    }
  }
  return {voices, schedule, dispose() {
    phrase.disconnect(); for (const voice of pad) voice.gain.disconnect(); sound.padVoices = pad;
  }};
}

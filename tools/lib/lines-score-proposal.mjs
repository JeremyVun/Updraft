// Listening study only. Story events are condensed; an approved score must follow actual progress.
export const linesStudy = {
  seconds: 72, label: 'Lines — small beneath the washing',
  intent: 'A hesitant, rounded reed melody among slowly breathing open chords; warmer when the family clothes fill, with space for the bird leading and the existing completion cue.',
  phases: [[0, 'small beneath the sheets'], [17, 'first curtain; bird leads'],
    [30, 'second curtain'], [43, 'third curtain'], [47, 'family clothes fill'],
    [55, 'existing completion phrase and door opening'], [63, 'far shore']],
  melodyAttackRests: [[12, 21], [26, 33], [38, 47], [53, 64]],
};
const strokes = [13, 15, 26, 28, 39, 41];
const openings = [17, 30, 43];

export function linesState(time, base) {
  return { ...base, music: 'lines', flockChatter: false, piano: 0, pianoActive: false,
    life: 1, night: 0, land: 1, meadow: 0, sea: time < 63 ? .12 : .32,
    cold: 0, breeze: .7, hush: 0, shower: 0, pan: -.15,
    gust: strokes.some(at => time >= at && time < at + .625) ? 8 : 0,
    cygnet: { active: true, pan: -.2, distance: 12 }, flock: { active: false }, cues: [] };
}

export function linesEvents(tick, _sound, foley, state) {
  const time = tick / 8;
  if (openings.includes(time)) state.cues.push('delight');
  if (time === 55) state.cues.push('restored');
  if (!foley) return;
  const opening = openings.some(at => time >= at - 2 && time < at + 1.5);
  const family = time >= 47 && time < 55;
  if ((opening || family) && tick % 4 === 0) foley.material('cloth', family ? .16 : .22, .15);
  else if (time < 58 && tick % 11 === 0) foley.material('cloth', .06, -.3);
  if (openings.some(at => time >= at && time < at + 3) && tick % 6 === 0) foley.step('grass', .28, -.2);
  if (time === 55 || time === 55.5) foley.material('door', .35, .1);
}

/** Soft held notes in the middle register, distinct from the bright attacks of gesture chimes. */
function reed(ctx, bus, notes, epoch, midi, time, duration, level, pan = -.1) {
  const at = epoch + time, end = at + duration;
  const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(bus);
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800;
  filter.Q.value = .35; filter.connect(p);
  const env = ctx.createGain(); env.connect(filter);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(level, at + .16);
  env.gain.linearRampToValueAtTime(level * .8, at + duration * .55);
  env.gain.setValueAtTime(level * .8, end - .3);
  env.gain.linearRampToValueAtTime(0, end);
  const partials = [[1, 1], [2, .035], [3, .17], [5, .035]];
  let remaining = partials.length;
  for (const [ratio, amplitude] of partials) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12) * ratio;
    gain.gain.value = amplitude; osc.connect(gain).connect(env);
    osc.start(at); osc.stop(end + .01);
    osc.onended = () => {
      osc.disconnect(); gain.disconnect();
      if (--remaining === 0) { env.disconnect(); filter.disconnect(); p.disconnect(); }
    };
  }
  notes.push({ voice: 'soft-reed', role: 'melody', midi, at, duration, level, pan });
}

export function linesMusic({ ctx, bus, notes, epoch, pad }) {
  // Stay in the game's D-major family. Each phrase clears before a curtain reward;
  // no new fanfare or quotation of the ending's recognition melody.
  const beds = [
    [0, 7, [50,57,64], .005], [8, 7, [47,54,62,66], .0045],
    [16, 5, [43,55,62,67], .004], [22, 6, [50,57,62,66], .0048],
    [29, 4, [45,57,61,64], .0038], [34, 7, [47,54,62,66], .0046],
    [42, 4, [43,55,62,67], .004], [47, 6, [43,55,59,62], .0058],
    [54, 7, [50,57,62,66], .003], [63, 6, [50,57,62,66], .0048],
  ];
  beds.forEach(([at, duration, chord, level]) => pad(at, duration, chord, level));
  const phrases = [
    // The first question stays open; a breath, then its small downward answer.
    [2,69,1.6,.012], [4,66,1.15,.011], [5.4,64,1.8,.010],
    [9,66,1.15,.011], [10.5,62,1.3,.010],
    // Once the bird has led, the same contour reaches a little farther.
    [22,66,1.15,.012], [23.4,69,1.15,.011], [24.8,74,1.15,.010],
    [34,71,1.3,.011], [35.6,69,1,.010], [36.8,66,1.05,.010],
    // Familiar-sized clothes inside the giant washing: a warmer answer, without a climax.
    [47.4,67,1.2,.012], [48.9,71,1.25,.011], [50.4,69,1,.010], [51.7,67,1.25,.010],
    // Wait for the completion phrase and doorway before answering on the beach.
    [64,69,1.25,.010], [65.6,66,1.15,.0095], [67,64,1.1,.009], [68.4,62,1.8,.009],
  ];
  phrases.forEach(([at, midi, duration, level]) => reed(ctx, bus, notes, epoch, midi, at, duration, level));
}

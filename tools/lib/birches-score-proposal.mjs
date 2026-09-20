// Preview only. The actual walk, optional swing and four tangles are player-paced.
// No runtime score, chapter cue or island-transition changes.
export const birchesStudy = {
  seconds: 84, label: 'Birches — autumn play and letting go',
  intent: 'Warm, muted plucked strings over the existing descending bass; an unhurried swing phrase, then room for the scarf gestures and their existing release cues.',
  phases: [[0, 'gold canopy and first scarf loop'], [18, 'pushing the child on the swing'],
    [36, 'circling the wrapped trunk'], [48, 'drawing the slipped loop sideways'],
    [60, 'the last bow'], [68, 'scarf gathers into the red sail'], [74, 'walking toward the far beach']],
  melodyAttackRests: [[12, 18], [34, 74]],
};
const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const strokes = [7, 12.5, 20, 22.5, 25, 27.5, 30, 32.5, 38, 40, 42, 51, 53, 56, 63, 65, 67];
const releases = [14, 44, 57, 68];

export function birchesState(time, base) {
  const gust = strokes.some(at => time >= at && time < at + .5) ? 8 : 0;
  return { ...base, music: 'birches', flockChatter: false, piano: 0, pianoActive: false,
    life: 1, night: 0, land: 1, meadow: 0, sea: .12 + .16 * smooth(time, 74, 84),
    cold: 0, breeze: .7, hush: 0, shower: 0, gust,
    charge: .65 * smooth(time, 37, 40) * (1 - smooth(time, 43, 45)), pan: -.2,
    cygnet: { active: true, pan: -.25, distance: 14 }, flock: { active: false }, cues: [],
  };
}

/** Shared production wind, material sounds and existing scarf rewards in both versions. */
export function birchesEvents(tick, sound, foley, state) {
  const time = tick / 8;
  if (releases.includes(time)) state.cues.push('delight');
  if (!foley) return;
  // The cygnet can keep playing locally while the child works. No added animal calls.
  if (((time >= 3 && time < 10) || (time >= 37 && time < 42) || (time >= 49 && time < 54)) && tick % 6 === 0) {
    foley.step('grass', .28, -.25);
  }
  const working = strokes.some(at => time >= at && time < at + .75) && !(time >= 18 && time < 36);
  if ((working || (time >= 68 && time < 73)) && tick % 3 === 0) foley.material('wool', .22, .15);
  if (time >= 74 && tick % 12 === 0) foley.material('sail', .08, .25);
}

/** A rounded string attack with upper partials damping faster than the fundamental. */
function stringTone(ctx, bus, notes, epoch, midi, at, level, pan, decay, role) {
  at += epoch;
  const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(bus);
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .4;
  filter.frequency.setValueAtTime(2400, at);
  filter.frequency.exponentialRampToValueAtTime(850, at + .55); filter.connect(p);
  const partials = [[1, 1], [2, .32], [3, .14], [4, .055], [5, .025], [6, .012]];
  let remaining = partials.length;
  for (const [ratio, amplitude] of partials) {
    const o = ctx.createOscillator(), gain = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 440 * 2 ** ((midi - 69) / 12) * ratio;
    const end = at + decay / Math.sqrt(ratio);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level * amplitude, at + .018);
    gain.gain.exponentialRampToValueAtTime(level * amplitude * .42, at + .22);
    gain.gain.exponentialRampToValueAtTime(.000001, end - .04);
    gain.gain.linearRampToValueAtTime(0, end);
    o.connect(gain).connect(filter); o.start(at); o.stop(end + .01);
    o.onended = () => { o.disconnect(); gain.disconnect(); if (--remaining === 0) { filter.disconnect(); p.disconnect(); } };
  }
  notes.push({ voice: 'muted-string', role, midi, at, duration: decay, level, pan });
}

export function birchesMusic({ ctx, bus, notes, epoch, pad, version = 'original' }) {
  const refined = version === 'refined';
  // The revision keeps D–C–B–A underneath clear D / C / G-over-B / A-minor triads.
  // In particular, the swing no longer leaves F-sharp ringing against a new G.
  const harmony = refined ? [
    [50,57,62,66], [48,55,60,64], [47,55,62,67], [45,52,57,60],
  ] : [
    [50,57,62,66], [48,55,62,67], [47,54,62,66], [45,52,59,64],
  ];
  // Preserve the section timing, levels and falling bass in both auditions.
  // The first study's suspended upper voicings remain reproducible for comparison.
  for (const [at, duration, chord, level] of [
    [0, 8, harmony[0], .006], [9, 7, harmony[1], .0055],
    [18, 7, harmony[2], .006], [26, 7, harmony[3], .0056],
    [35, 8, harmony[0], .0035], [45, 7, harmony[1], .0034],
    [54, 7, refined ? harmony[2] : [47,54,59,66], .0032], [63, 7, harmony[3], .003],
    [73, 5, harmony[2], .0048], [79, 3, harmony[3], .0042],
  ]) pad(at, duration, chord, level);

  const string = (midi, at, level, decay = 3, role = 'melody') =>
    stringTone(ctx, bus, notes, epoch, midi, at, level, role === 'melody' ? .08 : -.2, decay, role);
  // Falling pairs leave irregular breaths, distinct from the boats' repeating six-beat pattern.
  // The swing answers with a little rise and fall. It is not a second reward phrase.
  const melody = refined ? [
    // A–F-sharp–D settles into D; E–D–C answers over C, with D only a short passing note.
    [2,69,.011,2.9], [4.5,66,.010,2.7], [7,62,.009,2.6],
    [9.5,64,.009,1.5], [10.625,62,.0065,.85], [11.75,60,.0085,1.8],
    // Two consonant arches: B–D–G, then E–C–A. No suspended ninth at the phrase end.
    [19.5,59,.009,2.6], [22,62,.010,2.7], [24.5,67,.011,2.8],
    [27,64,.009,2.7], [29.5,60,.0085,2.7], [32,57,.008,3.4],
    [75,62,.008,2.7], [77.5,59,.0075,2.8], [80,57,.007,3.2],
  ] : [
    [2,69,.011,2.9], [4.5,66,.010,2.7], [7,64,.009,2.8], [10,62,.009,3.3],
    [19.5,62,.009,2.6], [22,66,.010,2.7], [24.5,69,.011,2.8],
    [27,67,.009,2.7], [29.5,64,.0085,2.7], [32,59,.008,3.4],
    [75,66,.008,2.7], [77.5,64,.0075,2.8], [80,59,.007,3.2],
  ];
  for (const [at, midi, level, decay] of melody) string(midi, at, level, decay);
  // Sparse low accompaniment; none around a knot's release. No extra high chimes.
  for (const [at, midi, level] of [
    [0.7,50,.0055], [6,57,.0038], [18.5,47,.005], [refined ? 27 : 25.5,45,.0048],
    [37,50,.0032], [48,55,.0028], [60,refined ? 55 : 54,.0027], [74,47,.004],
  ]) string(midi, at, level, 3.8, 'accompaniment');
}

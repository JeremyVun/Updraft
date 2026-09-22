// REJECTED September 22: Jeremy heard static, annoying tones with no musicality. Never integrate.
// Historical audition: a shared harmonic memory for the still island and the final home island.
// No runtime imports. Durations describe listening phrases, not story triggers.
export const studies = {
  opening: {
    mood: 'still', seconds: 80,
    intent: 'Draw the player into the dream immediately: a continuous, slightly detuned drone, with inner notes drifting between pitches before finding fleeting open harmony.',
    chords: [
      [0, 18, [50, 57, 64, 69]],
      [18, 16, [45, 52, 59, 64]],
      [34, 14, [47, 54, 62, 66]],
      [48, 18, [43, 50, 59, 64]],
      [66, 14, [50, 57, 62, 69]],
    ],
  },
  summit: {
    mood: 'home', seconds: 80,
    intent: 'The same memory after caring for someone and letting them go. A home note arrives quietly, with tenderness still unresolved around it.',
    chords: [
      [0, 18, [47, 54, 62, 69]],
      [18, 16, [43, 54, 59, 64]],
      [34, 14, [42, 50, 57, 66]],
      [48, 18, [40, 55, 59, 64]],
      [66, 14, [50, 57, 59, 62]],
    ],
  },
};

export function studyState(name, t, base) {
  return {...base, music: studies[name].mood, startingIsland: name === 'opening',
    life: name === 'opening' ? Math.min(1, .1 + t / 48) : 1,
    night: 0, hush: 0, gust: 0, breeze: 0, sea: 0, land: 1, meadow: 0,
    flockChatter: false, cues: []};
}

/** Sustained, softly bowed tones. The upper voice carries the theme inside the harmony.
 * Narrow detuning and a very slow common breath keep it from becoming a chorus/choir pad.
 * There are no bell, piano, arpeggio, percussion or foreground-melody attacks.
 */
export function scheduleStudy(name, ctx, sound) {
  if (name === 'opening') return scheduleOpeningDrone(ctx, sound);
  const study = studies[name], voices = new Set(), owned = [];
  const bus = ctx.createGain(); bus.connect(sound.backgroundBus); owned.push(bus);
  const breath = ctx.createOscillator(), depth = ctx.createGain();
  breath.frequency.value = .031; depth.gain.value = .045;
  bus.gain.value = .95; breath.connect(depth).connect(bus.gain);
  breath.start(); breath.stop(study.seconds + 5); owned.push(breath, depth);
  const curve = (level, reverse = false) => Float32Array.from({length: 129}, (_, i) => {
    const x = i / 128; return level * (reverse ? .5 + .5 * Math.cos(Math.PI * x) : .5 - .5 * Math.cos(Math.PI * x));
  });
  const schedule = [];
  for (const [at, duration, chord] of study.chords) {
    chord.forEach((midi, i) => {
      // Opening slowly gains body; summit is closer and steadier without a crescendo.
      const awake = name === 'opening' ? .40 + .60 * Math.min(1, (at + 8) / 48) : 1;
      const level = .017 * awake * [ .78, .66, .59, .65 ][i];
      const start = at + [0, .17, .31, .09][i];
      const end = at + duration + 3.2;
      const pan = ctx.createStereoPanner(), filter = ctx.createBiquadFilter(), env = ctx.createGain();
      pan.pan.value = [-.18, .22, -.28, .12][i]; pan.connect(bus);
      filter.type = 'lowpass'; filter.Q.value = .25;
      filter.frequency.value = name === 'opening' ? 780 + 220 * awake : 1150;
      env.connect(filter).connect(pan);
      env.gain.setValueCurveAtTime(curve(level), start, at === 0 ? 4.5 : 3.4);
      env.gain.setValueAtTime(level, at + duration - .5);
      env.gain.setValueCurveAtTime(curve(level, true), at + duration - .5, 3.7);
      const harmonics = [[1, .8, -1.4], [1, .2, 1.7], [2, .10, -.3], [3, .075, .5], [5, .013, 0]];
      let remaining = harmonics.length;
      for (const [ratio, amplitude, cents] of harmonics) {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.value = 440 * 2 ** ((midi - 69) / 12) * ratio;
        osc.detune.value = cents; gain.gain.value = amplitude;
        osc.connect(gain).connect(env); voices.add(osc);
        osc.start(start); osc.stop(end + .05);
        osc.onended = () => {
          voices.delete(osc); osc.disconnect(); gain.disconnect();
          if (--remaining === 0) {env.disconnect(); filter.disconnect(); pan.disconnect();}
        };
      }
      schedule.push({at: start, end, midi, level});
    });
  }
  return {voices, schedule, dispose() {for (const node of owned) node.disconnect();}};
}

/** A separate opening revision after Jeremy identified the original's off-key drone as essential.
 * Continuous oscillators keep their phase and slide independently; no chord re-attacks.
 * The entry is already consonant enough to invite touch, but has an upper note slowly searching
 * down from between E and F. Its small beating and unresolved movement are the subject.
 */
function scheduleOpeningDrone(ctx, sound) {
  const voices = new Set(), owned = [], schedule = [];
  const bus = ctx.createGain(), filter = ctx.createBiquadFilter();
  bus.connect(filter).connect(sound.backgroundBus); owned.push(bus, filter);
  filter.type = 'lowpass'; filter.Q.value = .3;
  filter.frequency.setValueAtTime(740, 0);
  filter.frequency.linearRampToValueAtTime(940, 38);
  filter.frequency.linearRampToValueAtTime(810, 80);
  bus.gain.setValueAtTime(0, 0);
  bus.gain.setValueCurveAtTime(Float32Array.from({length: 129}, (_, i) => .5 - .5 * Math.cos(Math.PI * i / 128)), 0, 2.6);
  bus.gain.setValueAtTime(1, 79);
  bus.gain.linearRampToValueAtTime(0, 83.2);
  // The inner voice settles later than the bass, so harmony is discovered inside the movement.
  const paths = [
    [[0, 50], [19, 50], [25, 45], [37, 45], [44, 47], [53, 47], [59, 43], [69, 43], [76, 50]],
    [[0, 57], [21, 57], [28, 52], [40, 52], [47, 54], [55, 54], [62, 50], [70, 50], [78, 57]],
    [[0, 64.35], [9, 62], [16, 62], [24, 59], [35, 59], [43, 62], [50, 62], [58, 59], [68, 59], [78, 62]],
    [[0, 69.04], [17, 69], [26, 64], [36, 64], [45, 66], [51, 66], [61, 64], [71, 64], [80, 69]],
  ];
  paths.forEach((points, i) => {
    const gain = ctx.createGain(), pan = ctx.createStereoPanner();
    gain.gain.setValueAtTime([.010, .0085, .0036, .0065][i], 0);
    gain.gain.linearRampToValueAtTime([.012, .010, .0065, .008][i], 40);
    pan.pan.value = [-.12, .18, -.24, .14][i]; gain.connect(pan).connect(bus);
    owned.push(gain, pan);
    let remaining = 2;
    for (const [type, cents, amplitude] of [['triangle', -6, .55], ['sine', 7, .45]]) {
      const osc = ctx.createOscillator(), weight = ctx.createGain();
      osc.type = type; osc.detune.value = cents; weight.gain.value = amplitude;
      osc.connect(weight).connect(gain);
      // Both components retain the original beating; an extremely slow extra drift avoids a static organ.
      const drift = ctx.createOscillator(), depth = ctx.createGain();
      drift.frequency.value = .021 + i * .004; depth.gain.value = 2.2;
      drift.connect(depth).connect(osc.detune); drift.start(); drift.stop(83.25);
      for (const [at, midi] of points) {
        const f = 440 * 2 ** ((midi - 69) / 12);
        if (at === 0) osc.frequency.setValueAtTime(f, at);
        else osc.frequency.exponentialRampToValueAtTime(f, at);
      }
      voices.add(osc); osc.start(); osc.stop(83.25);
      osc.onended = () => {
        voices.delete(osc); osc.disconnect(); weight.disconnect(); drift.disconnect(); depth.disconnect();
        if (--remaining === 0) {gain.disconnect(); pan.disconnect();}
      };
    }
    schedule.push({voice: i, points});
  });
  return {voices, schedule, dispose() {for (const node of owned) node.disconnect();}};
}

// Standalone composition studies. Imported only by audio-island-proposals.mjs, never by the game.
// Times are condensed listening scenes, not proposed chapter durations.
export const proposalScenes = {
  boats: { seconds: 36, label: 'Little Boats',
    intent: 'Rounded wooden plucks in a lilting six-beat phrase; small melodic answers and breathing room.',
    phases: [[0, 'first toys'], [9, 'fleet moving'], [18, 'second phrase'], [27, 'opening toward the sea']] },
  sleeping: { seconds: 48, label: 'Sleeping',
    intent: 'Sparse felt piano, open minor harmony through the cold, then a warmer major voicing after the flight.',
    phases: [[0, 'bedside'], [12, 'cold ascent'], [28, 'flight and morning'], [40, 'settling into warmth']] },
  sea: { seconds: 60, label: 'Long sea crossing',
    intent: 'Stable sustained harmonies with a slow upper line; widening motion, space for the swim, then return.',
    phases: [[0, 'open water'], [18, 'widening'], [35, 'intimate swim'], [45, 'open water returns']] },
};

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const k = clamp(x); return k * k * (3 - 2 * k); };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

/** Identical environmental/input choreography for the current and proposed music. */
export function sceneState(name, time, base) {
  const s = { ...base, flockChatter: false, meadow: 0, pianoActive: false, cues: [],
    cygnet: { active: true, pan: -0.3, distance: 20 } };
  const stroke = (at, strength = 12) => time >= at && time < at + 0.75 ? strength : 0;
  if (name === 'boats') {
    Object.assign(s, { music: 'lines', hush: 0.28, land: 1, sea: 0.45, breeze: 0.3,
      gust: Math.max(stroke(7), stroke(24, 15)), pan: 0.25 });
  } else if (name === 'sleeping') {
    const morning = smooth((time - 28) / 8), cold = time >= 12 && time < 28;
    Object.assign(s, { music: time < 28 ? 'wood' : 'sea', hush: time < 12 ? 0.55 : cold ? 0.8 : 0.2,
      life: time < 28 ? 0.22 : 0.22 + 0.78 * morning, night: 1 - 0.7 * morning,
      land: 1, sea: 0.12, cold: 0.75 * (1 - morning), breeze: cold ? 0.46 : 0.22,
      winterGust: cold ? Math.max(0, Math.sin((time - 12) * 0.55)) * 0.58 : 0,
      gust: Math.max(stroke(17, 9), stroke(24, 12)), pan: -0.2 });
  } else {
    Object.assign(s, { music: 'sea', land: 0, sea: 1, breeze: 0.52, overLand: false,
      gust: Math.max(stroke(9, 9), stroke(23, 12)), pan: 0.3 });
  }
  return s;
}

/** Production sounds on the same schedule in both alternatives. Called at 8 Hz. */
export function contextEvents(name, tick, sound, foley, state) {
  const time = tick / 8;
  if (name === 'sleeping') {
    if (tick === 10 * 8) state.cues.push('calling');
    if (tick === 13 * 8) state.cues.push('feather');
    if (tick === 28 * 8) state.cues.push('lifted');
    if (time >= 12 && time < 28 && tick % 8 === 0) foley?.step('grass', 0.45, -0.3);
    if (time >= 28 && time < 31 && tick % 4 === 0) foley?.flap(0.3, -0.3);
  } else {
    if (tick % 4 === 0) foley?.material('water', name === 'boats' ? 0.1 : 0.28, 0.2);
    if (tick % 12 === 0) foley?.material('sail', name === 'boats' ? 0.08 : 0.18, -0.15);
    const swimming = name === 'boats' ? time >= 14 && time < 20 : time >= 36 && time < 43;
    if (swimming && tick % 5 === 0) foley?.paddle(0.35, -0.45);
    if (name === 'sea' && [17 * 8, 27 * 8].includes(tick)) foley?.material('splash', 0.18, 0.6);
  }
}

function envelope(param, at, level, attack, hold, release) {
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(level, at + attack);
  param.setValueAtTime(level, at + attack + hold);
  param.exponentialRampToValueAtTime(0.00001, at + attack + hold + release);
}

/** Shared small palette, with different articulation/density in each arrangement. */
export function scheduleProposal(name, ctx, bus, epoch = 0, version = 'original') {
  const piano = [], notes = [];
  function voice(midi, at, duration, level, pan, colour = 'pad') {
    at += epoch;
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(bus);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.35;
    filter.frequency.value = colour === 'pad' ? 1000 : colour === 'soft' ? 1600 : 2400;
    filter.connect(p);
    const gain = ctx.createGain(); gain.connect(filter);
    const attack = colour === 'pad' ? 1.8 : colour === 'soft' ? 1.4 : 0.65;
    const release = colour === 'pad' ? 2.4 : colour === 'soft' ? 2.2 : 1.5;
    envelope(gain.gain, at, level, attack, Math.max(0, duration - attack), release);
    const partials = colour === 'pad' ? [[1, 0.65, 'triangle', -3], [1, 0.35, 'sine', 3]]
      : colour === 'soft' ? [[1, 1, 'sine', 0], [2, 0.08, 'sine', 0], [3, 0.014, 'sine', 0]]
      : [[1, 1, 'sine', 0], [2, 0.12, 'sine', 0], [3, 0.025, 'sine', 0]];
    for (const [ratio, amplitude, type, detune] of partials) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = hz(midi) * ratio; o.detune.value = detune;
      g.gain.value = amplitude; o.connect(g).connect(gain);
      o.start(at); o.stop(at + duration + release + 0.1);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    }
    notes.push({ voice: colour, midi, at, duration, level });
  }
  function pad(at, duration, chord, level) {
    chord.forEach((midi, i) => voice(midi, at + i * 0.035, duration, level * (i === 0 ? 0.85 : 1),
      (i - (chord.length - 1) / 2) * 0.23));
  }
  function pluck(midi, at, level, pan = 0, decay = 1.9) {
    at += epoch;
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(bus);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.45;
    filter.frequency.setValueAtTime(3200, at);
    filter.frequency.exponentialRampToValueAtTime(900, at + 0.35); filter.connect(p);
    for (const [ratio, amplitude] of [[1, 1], [2, 0.24], [3, 0.07], [4.015, 0.025]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz(midi) * ratio;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level * amplitude, at + 0.009);
      g.gain.exponentialRampToValueAtTime(Math.max(0.00002, level * amplitude * 0.35), at + 0.12);
      g.gain.exponentialRampToValueAtTime(0.00001, at + decay / Math.sqrt(ratio));
      o.connect(g).connect(filter); o.start(at); o.stop(at + decay + 0.05);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    }
    notes.push({ voice: 'pluck', midi, at, duration: decay, level });
  }
  function key(at, midi, velocity = 0.4) { piano.push({ at: at + epoch, midi, velocity }); notes.push({ voice: 'piano', at: at + epoch, midi, velocity }); }

  if (name === 'boats') {
    const chords = [[50, 57, 64, 66], [43, 54, 59, 62], [47, 54, 62, 66], [45, 52, 62, 64],
      [50, 57, 64, 71], [43, 54, 59, 64], [45, 52, 61, 67], [50, 57, 62, 66]];
    const phrases = [
      [[0.75,66],[1.5,69],[2.25,71],[3,69]],
      [[0.75,67],[1.5,66],[2.625,64],[3.375,71]],
      [[0.375,66],[1.5,74],[2.25,73],[3.375,69]],
      [[0.75,64],[1.5,67],[2.25,66],[3,64]],
      [[0.75,66],[1.5,69],[2.25,71],[2.625,76],[3.375,74]],
      [[0.75,71],[1.5,69],[2.25,67],[3.375,74]],
      [[0.75,67],[1.5,64],[3,61]],
      [[0.75,66],[1.5,64],[2.625,62]],
    ];
    chords.forEach((chord, bar) => {
      const at = bar * 4.5;
      pad(at, 3, chord.slice(1, 3), 0.004);
      pluck(chord[0], at + 0.125, 0.04, -0.22, 2.5);
      if (bar !== 7) pluck(chord[1], at + 2.25, 0.025, 0.22);
      phrases[bar].forEach(([offset, midi], i) => pluck(midi, at + offset, 0.044 * [1,0.83,0.94,0.77,0.87][i],
        Math.sin(bar * 0.8 + i * 0.6) * 0.22, i === phrases[bar].length - 1 ? 2.8 : 1.7));
    });
  } else if (name === 'sleeping') {
    // An independent theme. Neither the meadow's learned tune nor the approved home melody is quoted.
    pad(0, 10, [50, 57, 64, 65], 0.0055);
    pad(10, 8, [46, 53, 57, 64], 0.004);
    pad(19, 7, [50, 55, 58, 64], 0.0035);
    [[1.5,69],[3.25,65],[5.5,64],[7.5,62],[14,67],[17.5,65],[22,64],[25,62]]
      .forEach(([at, midi], i) => key(at, midi, i < 4 ? 0.36 : 0.28));
    // The existing flight cue has the foreground from 28 s; morning arrives underneath it.
    pad(28, 9, [50, 57, 62, 66], 0.008);
    pad(37, 6, [43, 54, 59, 62], 0.0085);
    pad(43, 3, [50, 57, 64, 66], 0.008);
    [[40,69],[41.75,66],[43.5,64],[45,62]].forEach(([at, midi]) => key(at, midi, 0.4));
  } else if (version === 'refined') {
    // Relief after Sleeping, then a closer view of the companions, then the sky mirror.
    // A background with occasional melodic fragments: no peak before the swim or new reward cue.
    const beds = [
      [0, 14, [45, 57, 64, 69], 0.0065],
      [12, 12, [43, 54, 59, 64], 0.0075],
      [24, 10, [50, 57, 64, 66], 0.008],
      [33, 13, [47, 54, 61, 66], 0.0045],
      [44, 9, [43, 54, 62, 66], 0.007],
      [53, 8, [50, 57, 64, 69], 0.006],
    ];
    for (const [at, duration, chord, level] of beds) pad(at, duration, chord, level);
    for (const [at, midi, duration, level] of [[8,69,3.5,0.0055], [14,71,3.5,0.006],
      [21,74,4,0.0065], [29,71,3.5,0.006], [49,69,4,0.005], [55,66,3,0.0045]]) {
      voice(midi, at, duration, level * 0.5, 0.05, 'soft');
    }
    for (const [at, midi] of [[18.5,64], [26.5,66], [51.5,64]]) pluck(midi, at, 0.004, -0.18, 3);
  } else {
    const chords = [[45, 52, 57, 64], [43, 50, 59, 66], [50, 57, 64, 71],
      [47, 54, 61, 69], [43, 54, 59, 66], [50, 57, 64, 71]];
    const starts = [0, 11, 22, 33, 44, 53];
    chords.forEach((chord, i) => pad(starts[i], i === 5 ? 5 : i === 4 ? 7 : 9, chord,
      i === 3 ? 0.0035 : i === 0 ? 0.006 : i < 3 ? 0.009 : 0.008));
    for (const [at, midi, duration] of [[2.5,69,3.5],[8,71,2.5],[14,74,3.5],[19,71,2.5],
      [24,78,4],[30,76,3],[46,71,3],[51,69,3],[55,66,3]]) {
      voice(midi, at, duration, at < 18 ? 0.015 : 0.022, 0.08, 'air');
    }
    for (const [at, midi] of [[20,66],[22.75,69],[25.5,74],[28.25,71],[31,69],
      [46.75,66],[49.5,69],[52.25,74],[55,71]]) pluck(midi, at, 0.015, -0.3, 2.6);
    key(37.5, 66, 0.25); key(41, 64, 0.23);
  }
  return { piano, notes };
}

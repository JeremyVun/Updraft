// Listening proposals only. No runtime imports: Jeremy auditions new compositions before integration.
// Section clocks would follow real progress; these timelines compress the story for listening.
export const studies = {
  mirror: {
    seconds: 104,
    intent: 'Suspended luminous harmony, distant reflected melody and rising halos as the child repairs the sky.',
    phases: [[0, 'approach'], [16, 'unreturned sky'], [36, 'one star'], [56, 'two stars'],
      [76, 'constellation'], [84, 'walk to the boat']],
    melodyRests: [[33, 39], [53, 59], [73, 78]],
    harmony: [[0, [50,57,64,69]], [8, [45,57,64,71]],
      [16, [50,57,64,69]], [26, [47,54,62,69]],
      [36, [50,57,64,66,73]], [46, [47,54,62,66,69]],
      [56, [43,55,62,66,69]], [66, [45,57,62,64,71]],
      [76, [50,57,64,69,71]], [84, [43,55,62,66,69]], [92, [50,57,64,69,71]]],
  },
  drowned: {
    seconds: 112,
    intent: 'Homes remembered through water; darkening harmony and a gathering low undertow carry the score into the storm.',
    phases: [[0, 'rooftops'], [16, 'passing the spire'], [32, 'becalmed'],
      [46, 'the sail fills'], [62, 'weather gathers'], [81, 'lighthouse fades'],
      [84, 'plane taken'], [88, 'empty hand'], [100, 'toward the wood']],
    melodyRests: [[29, 52], [79, 100]],
    // A/E/F-sharp during becalming accommodates the authored A–F-sharp–E cue.
    harmony: [[0, [47,54,62,64]], [8, [45,52,59,62]], [16, [43,50,57,59]],
      [24, [42,49,57,64]], [32, [45,52,54,59]], [46, [50,57,62,66]],
      [54, [47,54,62,64]], [62, [43,50,57,60]], [70, [41,48,57,62]],
      [78, [38,45,50,53]], [88, [38,45,50,57]], [100, [38,45,51,58]]],
  },
};

export function harmonyAt(name, time) {
  return studies[name].harmony.findLast(([at]) => at <= time)?.[1] ?? studies[name].harmony[0][1];
}

// Durations include attack and release. The last entries deliberately leave the reverb time to clear.
export function composition(name) {
  const notes = [];
  const note = (voice, at, midi, duration, level, pan = 0, role = 'melody') =>
    notes.push({ voice, at, midi, duration, level, pan, role });
  const chord = (at, end, tones, level, voice = 'air') => tones.forEach((midi, i) =>
    note(voice, at + i * .045, midi, end - at, level * (i === 0 ? .78 : 1),
      (i - (tones.length - 1) / 2) * .18, 'harmony'));
  const phrase = (voice, rows, scale = 1, pan = -.12) => rows.forEach(([at, midi, duration, level = .018]) =>
    note(voice, at, midi, duration, level * scale, pan));

  if (name === 'mirror') {
    // The floor loses weight: widely spaced upper voices float above a much quieter bass.
    // Ninths and a restrained major seventh give the returned light a new colour.
    const chords = studies.mirror.harmony;
    chords.forEach(([at, tones], i) => {
      const end = (chords[i + 1]?.[0] ?? 96) + 3.2;
      note('air',at,tones[0],end-at,.0032,0,'harmony');
      chord(at,end,tones.slice(1),at < 36 ? .008 : .009,'halo');
    });
    // A soft, bowed-glass voice blooms into the note instead of announcing each attack.
    phrase('starlight', [[2.5,74,5.8,.014], [6,76,5.6,.012], [11,69,6,.013],
      [18,74,6,.014], [22,81,6.4,.011], [28,78,5.7,.012], [31,74,5.5,.011]]);
    phrase('reflection', [[7,69,6], [14,64,6], [24.5,69,6], [30,66,6]], .36, .3);
    // First star: D–E–F-sharp rises an octave, then reaches the B above it.
    phrase('starlight', [[39,74,5.5,.013], [42,76,5.5,.012], [45,78,6,.012], [49,83,6.5,.0085]]);
    phrase('reflection', [[43.5,66,6], [50,69,6]], .35, .28);
    // The answer drifts down through the growing constellation, leaving the player's notes space.
    phrase('starlight', [[59,81,6,.010], [62,78,6,.012], [66.5,76,6,.011], [71,74,6,.010]]);
    phrase('reflection', [[63,71,6], [70,69,6]], .32, .3);
    // Soft upward trails blossom after each return, increasingly wide and high, with no hard bell ping.
    for (const [at, tones] of [[36,[62,69,76]], [56,[62,69,78,81]], [76,[62,69,76,81,83]]]) {
      tones.forEach((midi, i) => note('bloom', at + i * .65, midi, 9,
        .006 * .77 ** i, -.35 + i * .16, 'star'));
    }
    phrase('starlight', [[79,81,7,.0085], [84,76,6.5,.010], [89,74,6,.010], [94,71,5.5,.008]]);
    phrase('reflection', [[86,69,6], [94,64,6]], .3, .3);
  } else if (name === 'drowned') {
    const beds = [[0,10.2,.012], [8,18.2,.0115], [16,26.2,.011], [24,35,.010],
      [32,45,.002], [46,56.2,.008], [54,64.2,.010], [62,72.2,.009],
      [70,81,.009], [78,91,.007], [88,103,.0045], [100,108,.0035]];
    beds.forEach(([at, end, level]) => chord(at, end, harmonyAt(name, at), level, 'water-string'));
    // The journey question has lost its upward ending: D–E–F-sharp falls to the lower B.
    // The second half continues the descending bass inherited from Birches.
    phrase('cello', [[2,62,3.4,.019], [4.5,64,3,.017], [6,66,3,.017], [10,59,4.8,.019],
      [18,62,3.8,.018], [21,59,4.2,.017], [26,57,5,.016]]);
    phrase('felt', [[1,54,3.8,.012], [13,52,4.5,.014], [17,50,4.8,.012], [27.5,49,4.5,.011]], 1, .17);
    // No lead during the becalming cue or the existing objective phrase when the sail fills.
    // Recovered motion is tentative; this is not the triumphant escape from the village.
    phrase('cello', [[52.5,66,3.8,.015], [57,64,3.6,.014], [60,62,4,.013],
      [65,62,4.8,.014], [69,60,4.8,.013], [74,57,5,.012], [77,53,5,.010]]);
    phrase('felt', [[55,54,4.5,.010], [67,50,4.8,.009], [76,48,4.8,.007]], 1, .17);
    // The storm is already underneath the resumed drift. Slow swells draw closer together;
    // the F-natural arrives before the loss, preparing the wood's minor/semitone colour.
    for (const [at,midi,duration,level] of [[24,42,9,.003], [52,47,10,.0035], [58,43,10,.0045],
      [64,43,9,.005], [69,41,9,.006], [73.5,41,9,.0065], [78,38,11,.007],
      [83,45,12,.005], [88,38,15,.004], [98,38,10,.0025]]) {
      note('undertow',at,midi,duration,level,0,'weather');
    }
    // Lead notes stop before the snatch. The low texture remains continuous beneath the rain,
    // rather than fading to a hole and reappearing at the wood.
  } else throw Error(`Unknown proposal ${name}`);
  return notes.sort((a, b) => a.at - b.at);
}

export const palette = {
  air: { attack: 2.4, release: 2.6, cutoff: 1350, partials: [[1,1],[2,.07],[3,.035]], vibrato: 0 },
  halo: { attack: 3, release: 3.1, cutoff: 2100, partials: [[1,.8],[2,.12],[3,.035],[4,.012]], vibrato: 1.3 },
  starlight: { attack: .75, release: 2.6, cutoff: 3400, partials: [[1,1],[2,.085],[3,.018]], vibrato: .8 },
  glass: { attack: .085, release: 1.6, cutoff: 2700, partials: [[1,1],[2,.13],[3,.075],[4,.016]], vibrato: 0 },
  reflection: { attack: .32, release: 2, cutoff: 1300, partials: [[1,1],[2,.07],[3,.025]], vibrato: 0 },
  bloom: { attack: 2.8, release: 3.8, cutoff: 2600, partials: [[1,1],[2,.065],[3,.02]], vibrato: 1 },
  'water-string': { attack: 2.2, release: 2.5, cutoff: 950, partials: [[1,1],[2,.12],[3,.06],[4,.014]], vibrato: 1.5 },
  cello: { attack: .55, release: 1.35, cutoff: 1500, partials: [[1,1],[2,.2],[3,.1],[4,.04],[5,.014]], vibrato: 3 },
  felt: { attack: .045, release: 1.6, cutoff: 1450, partials: [[1,1],[2,.19],[3,.055],[4,.012]], vibrato: 0 },
  undertow: { attack: 3.2, release: 3.2, cutoff: 700, partials: [[1,.7],[2,.3],[3,.12],[4,.045],[5,.02]], vibrato: 2.5 },
};

export function scheduleStudy(name, ctx, bus, epoch = 0) {
  const notes = composition(name), sources = new Set();
  // Dark, quiet reflections widen only the new mirror voices. No feedback loop or pitch shifting.
  const echoIn = name === 'mirror' ? ctx.createGain() : null;
  const echoes = [];
  if (echoIn) for (const [seconds, level, position] of [[.73,.20,.48],[1.47,.115,-.42],[2.21,.065,.3]]) {
    const delay = ctx.createDelay(3), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    delay.delayTime.value = seconds; filter.type='lowpass'; filter.frequency.value=1900; filter.Q.value=.4;
    gain.gain.value=level; pan.pan.value=position;
    echoIn.connect(delay).connect(filter).connect(gain).connect(pan).connect(bus);
    echoes.push(delay,filter,gain,pan);
  }
  for (const n of notes) {
    const patch = palette[n.voice], at = epoch + n.at, end = at + n.duration;
    const pan = ctx.createStereoPanner(); pan.pan.value = n.pan; pan.connect(bus);
    if (echoIn && ['starlight','bloom','reflection'].includes(n.voice)) pan.connect(echoIn);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .45;
    filter.frequency.value = patch.cutoff; filter.connect(pan);
    const env = ctx.createGain(); env.connect(filter);
    const struck = ['glass', 'reflection', 'felt','starlight'].includes(n.voice);
    env.gain.setValueAtTime(0, at);
    // A rounded onset with zero slope at contact, followed by the natural decay of the note.
    env.gain.setValueCurveAtTime(new Float32Array([0,.038,.146,.309,.5,.691,.854,.962,1])
      .map(v => v * n.level), at, patch.attack);
    if (struck) env.gain.exponentialRampToValueAtTime(n.level * .24, end - patch.release);
    else env.gain.linearRampToValueAtTime(n.level * .84, end - patch.release);
    env.gain.linearRampToValueAtTime(0, end);
    let left = patch.partials.length;
    const lfo = patch.vibrato ? ctx.createOscillator() : null;
    const depth = lfo ? ctx.createGain() : null;
    if (lfo) {
      lfo.frequency.value = name === 'mirror' ? .13 + (n.midi % 5) * .019 : 4.1; depth.gain.value = patch.vibrato;
      lfo.connect(depth); lfo.start(at); lfo.stop(end + .01);
    }
    for (const [ratio, level] of patch.partials) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.value = 440 * 2 ** ((n.midi - 69) / 12) * ratio;
      g.gain.value = level; osc.connect(g).connect(env); depth?.connect(osc.detune);
      sources.add(osc); osc.start(at); osc.stop(end + .015);
      osc.onended = () => {
        sources.delete(osc); osc.disconnect(); g.disconnect();
        if (--left === 0) { env.disconnect(); filter.disconnect(); pan.disconnect(); lfo?.disconnect(); depth?.disconnect(); }
      };
    }
  }
  return { notes, sources, dispose: () => { echoIn?.disconnect(); for (const node of echoes) node.disconnect(); } };
}

const clamp = x => Math.max(0, Math.min(1, x));
export function sceneState(name, t, base) {
  const s = { ...base, music: name, pianoActive: true, flockChatter: false,
    land: 0, overLand: false, meadow: 0, cold: 0, cues: [] };
  if (name === 'mirror') return { ...s, breeze: .025, sea: .35, night: .6, hush: .5,
    gust: [19,22,39,43,60,65].some(at => t >= at && t < at + .625) ? 5 : 0,
    charge: [29,49,69].some(at => t >= at && t < at + 1.25) ? .14 : 0 };
  const stopped = t >= 32 && t < 46, storm = clamp((t - 62) / 14);
  return { ...s, breeze: stopped ? .02 : t < 62 ? .7 : 1, sea: 1,
    night: .1 + storm * .8, shower: storm, hush: stopped ? .92 : t >= 84 ? .9 : .3 + storm * .45,
    gust: [38,40,42,44].some(at => t >= at && t < at + .625) ? 9 : 0 };
}

// Illustrative input/foley events, not a gameplay recording. These use production instruments.
export function contextSchedule(name) {
  const events = [];
  if (name === 'mirror') {
    for (const at of [19,22,39,43,60,65]) events.push({ at, type: 'gesture', midi: 74, velocity: .3 });
    for (const at of [29,49,69]) for (let i = 0; i < 2; i++)
      events.push({ at: at + .625 * i, type: 'gesture', midi: 69 + i * 5, velocity: .25 });
    // The proposed star blooms replace the two generic delight cues; there is no third jingle.
  } else {
    events.push({ at: 32, type: 'cue', cue: 'becalmed' }, { at: 46, type: 'cue', cue: 'restored' });
    for (const at of [38,40,42,44]) {
      events.push({ at, type: 'gesture', midi: 66, velocity: .32 }, { at, type: 'material', material: 'sail', level: .055 });
    }
    for (let at = 1; at < 106; at += 2.25) events.push({ at, type: 'material', material: 'water',
      level: at >= 32 && at < 46 ? .035 : .12 });
    events.push({ at: 78, type: 'thunder', level: .22 }, { at: 84, type: 'material', material: 'paper', level: .18 });
  }
  return events.sort((a, b) => a.at - b.at);
}

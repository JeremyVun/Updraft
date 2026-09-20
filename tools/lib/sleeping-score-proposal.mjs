// Listening study only. Runtime integration must follow story states, never these condensed times.
export const sleepingStudy = {
  seconds: 108, label: 'Sleeping — shelter, cold, courage, morning',
  intent: 'An unfinished bedside phrase, music-free cold and summit pauses, sparse company on the climb, and a warmer answer after the flight cue.',
  phases: [[0, 'shelter beside the fire'], [18, 'the fire dies; the call is unanswered'],
    [36, 'following the feather through winter'], [54, 'the healed wing and the ribbon'],
    [70, 'the bird releases morning'], [89, 'back together']],
  // Windows after instrument/reverb tails have cleared; gesture feedback and physical sound remain.
  musicRests: [[24, 35], [58, 69]],
};

const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function sleepingState(time, base) {
  const cold = smooth(time, 16, 23) * (1 - smooth(time, 70, 83));
  const morning = smooth(time, 70, 83);
  const stroke = at => time >= at && time < at + 0.6 ? 8 : 0;
  return { ...base, flockChatter: false, meadow: 0, pianoActive: false, cues: [],
    cygnet: { active: true, pan: -0.25, distance: 16 },
    music: time < 70 ? 'wood' : 'sea', hush: time < 18 ? 0.5 : time < 70 ? 0.8 : 0.3 - 0.2 * morning,
    life: 0.22 + 0.78 * morning, night: 1 - 0.8 * morning, land: 1, sea: 0.12, cold,
    breeze: 0.22 + cold * 0.24, winterGust: cold * Math.max(0, Math.sin(time * 0.55)) * 0.5,
    gust: Math.max(stroke(32), stroke(41), stroke(49), stroke(64)), pan: -0.2,
    charge: time >= 66 && time < 69 ? 0.3 : 0,
  };
}

export function sleepingEvents(tick, sound, foley, state) {
  const time = tick / 8;
  if (tick === 25 * 8) state.cues.push('calling');
  if (tick === 32 * 8) state.cues.push('feather');
  if (tick === 70 * 8) state.cues.push('lifted');
  if (foley) {
    // The approved hearth goes out and stays out; the clock has no alarm voice.
    foley.hearth(1 - smooth(time, 16, 21), 0.6, 0.35);
    foley.frost(smooth(time, 16, 23) * (1 - smooth(time, 70, 83)));
    if (time >= 36 && time < 53 && tick % 8 === 0) foley.step('grass', 0.4, -0.25);
    if (time >= 70 && time < 78 && tick % 6 === 0) foley.flap(0.25, -0.25);
  }
}

export function sleepingMusic({ pad, key }) {
  // Shelter is an open voicing, with no major/minor third declaring how safe this bed is.
  pad(0, 9.5, [50, 57, 64, 69], 0.0055);
  pad(10, 5, [43, 55, 62, 69], 0.0042);
  [[2.5, 69, 0.29], [6, 64, 0.25], [10.5, 62, 0.27], [14, 57, 0.22]]
    .forEach(([at, midi, velocity]) => key(at, midi, velocity));
  // No bed beneath the unanswered call. Do not fill either pause with a quiet drone.
  // On the ascent the familiar descending shape contracts into the Wood gesture scale.
  pad(36, 8, [50, 57, 62, 65], 0.0032);
  pad(45, 5, [46, 53, 57, 62], 0.0028);
  [[38, 65], [42, 64], [47, 62], [50, 57]].forEach(([at, midi]) => key(at, midi, 0.22));
  // From the summit to commitment, cloth, wing movement, wind and the player's chimes carry the scene.
  // The existing lifted cue starts at 70. Sustained warmth enters late under its tail; no competing tune.
  pad(75, 8, [50, 57, 62, 66], 0.005);
  pad(83, 8, [43, 54, 59, 62], 0.0055);
  pad(92, 8, [50, 57, 64, 66], 0.0055);
  pad(101, 3.5, [50, 57, 62, 64], 0.0045);
  // The bedside phrase can now find its major third and settle. The flight is the only full reward phrase.
  [[89, 69], [92, 64], [94.5, 66], [98, 62], [102, 64], [104, 62]]
    .forEach(([at, midi]) => key(at, midi, 0.3));
}

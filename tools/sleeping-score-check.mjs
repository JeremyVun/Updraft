// The former synthesised score, kept for studies (reference timbres, continuous shelter/journey, frost silence, stalls),
// and the chapter's score phases. Its playback in the game is `sleeping-music-check.mjs`.
// node tools/sleeping-score-check.mjs (Vite on port 5230, or BASE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { SleepingScore, SLEEPING_AUDITION_NOTES, SLEEPING_SECTIONS } = await import('/src/audio/sleeping-score.ts');
    const { SleepingChapter } = await import('/src/story/sleeping.ts');
    const { scheduleProposal } = await import('/tools/lib/island-score-proposals.mjs');
    const { tuning } = await productionModule('/src/tuning.ts');
    const { takeCues } = await productionModule('/src/story/cues.ts');
    const { PianoStrings } = audioModule;
    const passed = [], check = (ok, message) => { if (!ok) throw Error(message); passed.push(message); };
    const shelter = SLEEPING_SECTIONS.shelter;
    check(shelter.chords.every((chord, i) => (shelter.chords[i + 1]?.at ?? shelter.seconds) - chord.at <= 10),
      'Bedtime never fills a long gap by holding one chord');
    check(shelter.variants.every(notes => notes.some(n => n.voice === 'piano' && n.at >= shelter.seconds / 2)),
      'Every bedtime verse carries its melody into the second half');
    const morning = SLEEPING_SECTIONS.morning, lastMorningNote = Math.max(...morning.notes.map(n => n.at));
    check(morning.notes.every(n => n.voice !== 'pad' || n.at + n.duration <= lastMorningNote + 1),
      'The morning answer ends with its melody instead of holding its last chord until the repeat');
    const piano = out => { const p = new PianoStrings(); p.setOutput(out); return p; };
    const output = ctx => ({ ctx, bus: ctx.destination, reverb: ctx.createGain() });
    const canonical = notes => notes.map(n => n.voice === 'pad'
      ? { voice: n.voice, midi: n.midi, at: n.at, duration: n.duration, level: n.level }
      : { voice: n.voice, midi: n.midi, at: n.at, velocity: n.velocity })
      .sort((a, b) => a.at - b.at || a.midi - b.midi);
    const seedRandom = () => {
      let seed = 926417;
      Math.random = () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    };
    const originalRandom = Math.random;
    let relativeError, buffer;
    try {
      const referenceCtx = new OfflineAudioContext(2, 111 * 24000, 24000), referenceOut = output(referenceCtx);
      const reference = scheduleProposal('sleeping', referenceCtx, referenceOut.bus, 0, 'refined');
      check(JSON.stringify(canonical(reference.notes)) === JSON.stringify(canonical(SLEEPING_AUDITION_NOTES)),
        'Every approved pitch, timing, duration and dynamic matches the listening study');
      seedRandom(); const referencePiano = piano(referenceOut);
      for (const n of reference.piano) referencePiano.note(n.midi, n.velocity, 0, .32, n.at);
      const expected = await referenceCtx.startRendering();
      const actualCtx = new OfflineAudioContext(2, 111 * 24000, 24000), actualOut = output(actualCtx);
      const score = new SleepingScore(actualOut, piano), part = { out: actualOut, piano: piano(actualOut), voices: new Set(), stopped: false };
      seedRandom();
      for (const n of SLEEPING_AUDITION_NOTES) score.play(part, n, n.at);
      const actual = buffer = await actualCtx.startRendering();
      let error = 0, power = 0;
      for (let ch = 0; ch < 2; ch++) {
        const a = actual.getChannelData(ch), b = expected.getChannelData(ch);
        for (let i = 0; i < a.length; i++) { error += (a[i] - b[i]) ** 2; power += b[i] ** 2; }
      }
      relativeError = Math.sqrt(error / power);
      check(relativeError < .0001, `Production pad and piano match the approved waveform (${relativeError})`);
      check(part.voices.size === 0, 'All pad and piano sources finish and disconnect');
    } finally { Math.random = originalRandom; }
    check(Math.abs(20 * Math.log10(tuning.audio.sleepingScoreLevel) - 16.9) < .02,
      'Mix uses the approved music gain without the preview playback boost');

    const phase = Object.getOwnPropertyDescriptor(SleepingChapter.prototype, 'sleepingScore').get;
    const story = { beat: 'asleep', t: tuning.sleeping.winterBeginsAt - .01 };
    check(phase.call(story) === 'shelter', 'Settling into bed keeps shelter until the frost actually begins');
    story.t += .02;
    check(phase.call(story) === 'cold', 'Frost starts the first music-free passage before the unanswered call');
    for (const [beats, expected] of [
      [['feather', 'edge'], 'cold'], [['climb', 'snow', 'step', 'mist', 'catchFeather', 'crest'], 'climb'],
      [['unbinding', 'hilltop', 'reachRibbon', 'pullRibbon'], 'summit'],
      [['glide', 'waking', 'lap', 'toBoat', 'push', 'aboard'], 'morning'],
    ]) for (const beat of beats) { story.beat = beat; check(phase.call(story) === expected, `${beat} selects ${expected}`); }
    // Exercise the real one-way landing transition. Its only former musical effect was restored.
    takeCues();
    const sleeping = { laneOpen: 0, dawn: 0, fog: 1, frost: 1, ribbon: { released: false }, cold: 1 };
    const landing = { cast: { cygnet: { state: 'perched', sailing: 1, yaw: 0 }, sleeping }, t: tuning.sleeping.glideFor,
      hush: .35, warmed: 1, to(beat) { this.beat = beat; } };
    SleepingChapter.prototype.gliding.call(landing, .016);
    check(landing.beat === 'waking' && takeCues().length === 0, 'Landing reaches waking without a second full reward phrase');

    for (const fps of [10, 60, 144]) {
      const ctx = new OfflineAudioContext(2, 24000, 24000), score = new SleepingScore(output(ctx), piano), events = [];
      score.play = (part, note, at) => events.push({ phase: part.phase, note, at });
      for (let tick = 0; tick < fps * 250; tick++) {
        const now = tick / fps;
        if (now > 15 && now < 18) continue;
        Object.defineProperty(ctx, 'currentTime', { configurable: true, value: now });
        score.update(now < 50 ? 'shelter' : now < 100 ? 'cold' : now < 150 ? 'climb' : now < 200 ? 'summit' : 'morning', 1);
      }
      check(events.every(e => e.phase !== 'cold'), `Frost schedules no score even during long player waits at ${fps} Hz`);
      check(events.some(e => e.phase === 'summit'), `The journey continues through the summit at ${fps} Hz`);
      check(events.filter(e => e.phase === 'morning')[0].at >= 205, `Flight retains its five-second lead at ${fps} Hz`);
      check(events.filter(e => e.phase === 'morning' && e.note.voice === 'piano')[0].at >= 219,
        `Piano answer waits until after the flight at ${fps} Hz`);
      check(events.filter(e => e.at >= 18 && e.at < 18.1).length <= 1, `Stalls skip missed attacks at ${fps} Hz`);
      check(new Set(events.map(e => `${e.phase}:${e.note.voice}:${e.note.midi}:${e.at.toFixed(5)}`)).size === events.length,
        `No duplicate notes at ${fps} Hz`);
      score.stop(); const count = events.length; score.update('shelter', 1);
      check(count === events.length && score.parts.size === 0, `Stopped scores cannot restart at ${fps} Hz`);
      delete ctx.currentTime;
    }

    return { passed, relativeError, ...encodeAudio(buffer) };
  });
  assert(result.clipped === 0 && result.peakDbFS < -.1, 'The study score must not clip');
  fs.writeFileSync('/tmp/updraft-sleeping-score-check.wav', wav(Buffer.from(result.pcm, 'base64')));
  console.log(JSON.stringify({ checks: result.passed.length, passed: result.passed, relativeError: result.relativeError,
    peakDbFS: result.peakDbFS, clipped: result.clipped }, null, 2));
} finally { await browser.close(); }

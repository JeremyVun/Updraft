// Approved-note/timbre parity, story-paced silence, feedback and score lifecycle in real Web Audio.
// node tools/sleeping-score-check.mjs (Vite on port 5230, or BASE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { SleepingScore, SLEEPING_AUDITION_NOTES } = await import('/src/audio/sleeping-score.ts');
    const { SleepingChapter } = await import('/src/story/sleeping.ts');
    const { scheduleProposal } = await import('/tools/lib/island-score-proposals.mjs');
    const { tuning } = await productionModule('/src/tuning.ts');
    const { takeCues } = await productionModule('/src/story/cues.ts');
    const { PianoStrings } = audioModule;
    const passed = [], check = (ok, message) => { if (!ok) throw Error(message); passed.push(message); };
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
    let relativeError;
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
      const actual = await actualCtx.startRendering();
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
      [['feather', 'edge'], 'cold'], [['climb', 'snow', 'mist', 'catchFeather'], 'climb'],
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
      check(events.every(e => e.phase !== 'cold' && e.phase !== 'summit'), `Long player waits schedule no score in either rest at ${fps} Hz`);
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

    // Full production mix for feedback/lifecycle, followed by the same music alone to measure both rests.
    let buffer;
    for (const musicOnly of [false, true]) {
    const { ctx, sound } = offlineSound(50);
    if (musicOnly) for (const fn of ['chime', 'cricket', 'owl', 'skylark', 'peep', 'bugle']) sound[fn] = () => {};
    let score, resumed, chimes = 0, retired;
    const chime = sound.chime.bind(sound); sound.chime = (...args) => { chimes++; chime(...args); };
    const update = tick => {
      const now = tick / 8, phase = now < 9 ? 'shelter' : now < 20 ? 'cold' : now < 27 ? 'climb'
        : now < 37 ? 'summit' : now < 45 ? 'morning' : now < 47 ? undefined : 'morning';
      sound.update(.125, { ...baseState, music: now < 37 ? 'wood' : 'sea', sleepingScore: phase,
        night: 1, cold: .8, hush: .8, gust: now >= 16 && now < 16.5 || now >= 34 && now < 34.5 ? 9 : 0,
        charge: now >= 35 && now < 35.5 ? .5 : 0, silence: now >= 48 });
      if (tick === 0) { score = sound.sleepingScore; retired = score.current; }
      if (tick === 15 * 8 && !musicOnly) check(retired.voices.size === 0 && !score.parts.has(retired), 'Shelter voices and buses retire before the unanswered call');
      if (tick === 34 * 8 && !musicOnly) check(score.current.voices.size === 0 && sound.padGain.gain.value < 1e-8, 'Summit rest has no replacement drone');
      if (tick === 45 * 8 && !musicOnly) check(score.stopped && !sound.sleepingScore, 'Chapter exit stops Sleeping');
      if (tick === 47 * 8) { resumed = sound.sleepingScore; if (!musicOnly) check(resumed !== score && resumed.current.phase === 'morning', 'A morning entry starts directly in the warm arrangement'); }
      if (tick === 48 * 8 && !musicOnly) check(resumed.stopped && !sound.sleepingScore, 'Permanent silence stops Sleeping');
      if (musicOnly) for (const name of ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
        sound[name].gain.cancelScheduledValues(ctx.currentTime); sound[name].gain.value = 0;
      }
    };
    update(0); let pause = ctx.suspend(.125); const render = ctx.startRendering();
    for (let tick = 1; tick < 50 * 8; tick++) {
      await pause; update(tick);
      if (tick + 1 < 50 * 8) pause = ctx.suspend((tick + 1) / 8);
      await ctx.resume();
    }
    const rendered = await render;
    if (!musicOnly) {
      buffer = rendered;
      check(chimes > 3, 'Both music-free passages retain playable wind and updraft chimes');
      check(score.parts.size === 0 && resumed.parts.size === 0, 'Departed scores release every piano, pad and phase bus');
    } else for (const [from, to] of [[16, 19], [34, 36.5]]) {
      let power = 0, count = 0;
      for (let ch = 0; ch < 2; ch++) for (const sample of rendered.getChannelData(ch).slice(from * 24000, to * 24000)) {
        power += sample * sample; count++;
      }
      const rms = 10 * Math.log10(Math.max(1e-20, power / count));
      check(rms < -90, `Actual score and shared reverb settle below −90 dBFS during ${from}–${to}s (${rms})`);
    }
    }
    return { passed, relativeError, ...encodeAudio(buffer) };
  });
  assert(result.clipped === 0 && result.peakDbFS < -.1, 'Score, environment and gesture mix must not clip');
  fs.writeFileSync('/tmp/updraft-sleeping-score-check.wav', wav(Buffer.from(result.pcm, 'base64')));
  console.log(JSON.stringify({ checks: result.passed.length, passed: result.passed, relativeError: result.relativeError,
    peakDbFS: result.peakDbFS, clipped: result.clipped }, null, 2));
} finally { await browser.close(); }

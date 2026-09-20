// Approved-note/timbre parity, story phases, wind feedback and preservation of the existing pad transitions.
// node tools/meadow-score-check.mjs (Vite on 5230, or BASE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { MeadowScore, MEADOW_AUDITION_NOTES, MEADOW_SECTIONS } = await import('/src/audio/meadow-score.ts');
    const { MeadowChapter } = await import('/src/story/meadow.ts');
    const { scheduleProposal } = await import('/tools/lib/island-score-proposals.mjs');
    const { tuning } = await productionModule('/src/tuning.ts');
    const { takeCues } = await productionModule('/src/story/cues.ts');
    const passed = [], check = (ok, message) => { if (!ok) throw Error(message); passed.push(message); };
    const canonical = notes => notes.map(({ voice, midi, at, duration, level }) => ({ voice, midi, at, duration, level }))
      .sort((a, b) => a.at - b.at || a.midi - b.midi);
    const refCtx = new OfflineAudioContext(2, 75 * 24000, 24000);
    const ref = scheduleProposal('meadow', refCtx, refCtx.destination);
    check(JSON.stringify(canonical(ref.notes)) === JSON.stringify(canonical(MEADOW_AUDITION_NOTES)),
      'Every approved pitch, timing, duration and instrument strength matches');
    const expected = await refCtx.startRendering();
    const parityCtx = new OfflineAudioContext(2, 75 * 24000, 24000), score = new MeadowScore(parityCtx, parityCtx.destination);
    const part = { bus: parityCtx.destination, voices: new Set(), stopped: false };
    for (const note of MEADOW_AUDITION_NOTES) score.play(part, note, note.at);
    const actual = await parityCtx.startRendering();
    let error = 0, power = 0;
    for (let ch = 0; ch < 2; ch++) {
      const a = actual.getChannelData(ch), b = expected.getChannelData(ch);
      for (let i = 0; i < a.length; i++) { error += (a[i] - b[i]) ** 2; power += b[i] ** 2; }
    }
    const relativeError = Math.sqrt(error / power);
    check(relativeError < .0001, `Production instruments match the approved waveform (${relativeError})`);
    check(part.voices.size === 0, 'Every audition voice completes and disconnects');
    check(Math.abs(20 * Math.log10(tuning.audio.meadowScoreLevel) - 17.9) < .01,
      'Runtime preserves the approved balance without preview playback normalization');

    const phase = Object.getOwnPropertyDescriptor(MeadowChapter.prototype, 'meadowScore').get;
    const story = { piano: { at: 'ahead' }, beat: 'walk', crestDone: false };
    for (const at of ['ahead', 'walking', 'looking', 'sitting', 'seated', 'leaving']) {
      story.piano.at = at;
      check(phase.call(story) === undefined, `${at}: approach and piano remain free of the new score`);
    }
    story.piano.at = 'done';
    check(phase.call(story) === 'walk', 'The completed duet begins the Meadow walk arrangement');
    for (const [beat, wanted] of [['crest','flock'], ['down','flock'], ['pond','pond'], ['gather','return'],
      ['toBoat',undefined], ['push',undefined], ['aboard',undefined]]) {
      story.beat = beat; check(phase.call(story) === wanted, `${beat}: selects ${wanted ?? 'the original departure pad'}`);
    }
    story.beat = 'walk'; story.crestDone = true;
    check(phase.call(story) === 'return', 'Walking after the paddle cannot replay the opening phrase');
    for (const checkpoint of ['piano', 'pond']) {
      let cleared = false;
      const restored = Object.assign(Object.create(MeadowChapter.prototype), {
        piano: { at: 'ahead', restoreDone() { this.at = 'done'; } }, cast: { flock: { clear() { cleared = true; } } },
      });
      takeCues(); restored.restoreCheckpoint(checkpoint, [3, 1000, 0, .3, .3]);
      check(restored.meadowScore === (checkpoint === 'pond' ? 'return' : 'walk') && takeCues().length === 0,
        `${checkpoint} checkpoint selects the correct score without a reward replay`);
      if (checkpoint === 'pond') check(cleared, 'Restoring past the pond retains the departed flock');
    }
    for (const fps of [10, 60, 144]) {
      const ctx = new OfflineAudioContext(2, 24000, 24000), scheduler = new MeadowScore(ctx, ctx.destination), events = [];
      scheduler.play = (part, note, at) => events.push({ phase: part.phase, note, at });
      for (let tick = 0; tick < fps * 210; tick++) {
        const now = tick / fps;
        if (now > 18 && now < 21) continue;
        Object.defineProperty(ctx, 'currentTime', { configurable: true, value: now });
        scheduler.update(now < 50 ? 'walk' : now < 100 ? 'flock' : now < 150 ? 'pond' : 'return', 1);
      }
      check(events.filter(e => ['flock','pond'].includes(e.phase)).every(e => e.note.voice === 'pad'),
        `Long flock and pond waits stay accompaniment-only at ${fps} Hz`);
      const first = MEADOW_SECTIONS.walk.notes[0], repeats = events.filter(e => e.note === first);
      check(repeats.length === 3 && Math.abs(repeats[1].at - repeats[0].at - 24) < .02,
        `The walk repeats without clock drift at ${fps} Hz`);
      check(events.filter(e => e.phase === 'return' && e.note.voice !== 'pad')[0].at >= 155.5,
        `Return melody leaves the completion cue room at ${fps} Hz`);
      check(events.filter(e => e.at >= 21 && e.at < 21.1).length === 0, `Missed notes are not bunched after a stall at ${fps} Hz`);
      check(new Set(events.map(e => `${e.phase}:${e.note.voice}:${e.note.midi}:${e.at.toFixed(5)}`)).size === events.length,
        `No duplicate attacks at ${fps} Hz`);
      const count = events.length; scheduler.stop(); scheduler.update('walk', 1);
      check(events.length === count && scheduler.parts.size === 0, `Stopped schedulers stay stopped at ${fps} Hz`);
      delete ctx.currentTime;
    }

    const { ctx, sound } = offlineSound(46), glides = [], chords = [];
    let live, retired, resumed;
    const feedback = [], chime = sound.chime.bind(sound);
    sound.chime = (...args) => { feedback.push(ctx.currentTime); chime(...args); };
    const parameter = sound.padVoices[0].osc[0].frequency, setTarget = parameter.setTargetAtTime.bind(parameter);
    parameter.setTargetAtTime = (...args) => { glides.push(args); return setTarget(...args); };
    const update = tick => {
      const now = tick / 8;
      const phase = now < 2 ? undefined : now < 12 ? 'walk' : now < 18 ? 'flock'
        : now < 25 ? 'pond' : now < 33 ? 'return' : now < 42 ? undefined : 'walk';
      const music = now >= 40 && now < 42 ? 'birches' : 'meadow';
      sound.update(.125, { ...baseState, music, meadowScore: phase, hush: now >= 12 && now < 25 ? .45 : 0,
        gust: now >= 16 && now < 16.5 ? 9 : 0, charge: now >= 21 && now < 21.5 ? .5 : 0, silence: now >= 44 });
      chords.push({ now, chord: sound.chord, music });
      if (tick === 2 * 8) { live = sound.meadowScore; retired = live.current; }
      if (tick === 15 * 8) check(!retired.voices.size && !live.parts.has(retired), 'The melodic walk releases its voices at the flock scene');
      if (tick === 17 * 8) check(sound.padGain.gain.value < .00001, 'The old background is not layered under the new arrangement');
      if (tick === 33 * 8) check(!sound.meadowScore && live.stopped, 'Boarding stops the new arrangement before the island transition');
      if (tick === 39 * 8) check(sound.padGain.gain.value > .055, 'The original pad is audible again before departure');
      if (tick === 42 * 8) { resumed = sound.meadowScore; check(resumed !== live, 'A new chapter entry gets a new scheduler'); }
      if (tick === 44 * 8) check(!sound.meadowScore && resumed.stopped, 'Permanent silence stops the Meadow scheduler');
    };
    update(0); let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
    for (let tick = 1; tick < 46 * 8; tick++) {
      await pause; update(tick);
      if (tick + 1 < 46 * 8) pause = ctx.suspend((tick + 1) / 8);
      await ctx.resume();
    }
    const buffer = await rendering;
    check(feedback.some(at => at >= 16 && at < 17) && feedback.some(at => at >= 21 && at < 22),
      'Wind and updraft chimes stay playable during the quiet flock and pond phases');
    check(live.parts.size === 0 && resumed.parts.size === 0, 'Departed scores release all voices and buses');
    check(chords.every(s => s.chord === Math.floor(s.now / (s.music === 'meadow' ? 8.5 : 11)) % 4),
      'The original global chord clock continues unchanged while the new score plays');
    check(glides.some(([, at, seconds]) => at === 40 && seconds === 3.5), 'Departure retains the original 3.5-second pitch-slide response');
    check(glides.filter(([, at]) => at > 0 && at < 40).every(([, , seconds]) => seconds === 1.2),
      'Existing internal pad pitch glides are unchanged');
    return { passed, relativeError, ...encodeAudio(buffer) };
  });
  assert(result.clipped === 0 && result.peakDbFS < -.1, 'Score and wind mix must not clip');
  fs.writeFileSync('/tmp/updraft-meadow-score-check.wav', wav(Buffer.from(result.pcm, 'base64')));
  const { pcm, ...report } = result;
  fs.writeFileSync('/tmp/updraft-meadow-score-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: result.passed.length, ...report }, null, 2));
} finally { await browser.close(); }

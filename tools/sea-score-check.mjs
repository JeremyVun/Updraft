// Approved-note/timbre parity, adaptive timing, restore and lifecycle checks in real Web Audio.
// Usage: node tools/sea-score-check.mjs (Vite on port 5230, or BASE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { SeaScore, SEA_AUDITION_NOTES, SEA_SECTIONS } = await import('/src/audio/sea-score.ts');
    const { scheduleProposal } = await import('/tools/lib/island-score-proposals.mjs');
    const { CrossingChapter } = await import('/src/story/crossing.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const passed = [], check = (ok, message) => { if (!ok) throw Error(message); passed.push(message); };
    const canonical = notes => notes.map(({ voice, midi, at, duration, level }) => ({ voice, midi, at, duration, level }))
      .sort((a, b) => a.at - b.at || a.midi - b.midi);

    // Render both instrument implementations without the mixer: copying pitches alone is insufficient.
    const referenceCtx = new OfflineAudioContext(2, 65 * 24000, 24000);
    const reference = scheduleProposal('sea', referenceCtx, referenceCtx.destination, 0, 'refined');
    check(JSON.stringify(canonical(reference.notes)) === JSON.stringify(canonical(SEA_AUDITION_NOTES)),
      'Approved pitches, timings, durations and quiet melody levels are unchanged');
    const expected = await referenceCtx.startRendering();
    const parityCtx = new OfflineAudioContext(2, 65 * 24000, 24000);
    const parity = new SeaScore(parityCtx, parityCtx.destination);
    const part = { bus: parityCtx.destination, voices: new Set(), stopped: false };
    for (const note of SEA_AUDITION_NOTES) parity.play(part, note, note.at);
    const actual = await parityCtx.startRendering();
    let error = 0, power = 0;
    for (let ch = 0; ch < 2; ch++) {
      const a = actual.getChannelData(ch), b = expected.getChannelData(ch);
      for (let i = 0; i < a.length; i++) { error += (a[i] - b[i]) ** 2; power += b[i] ** 2; }
    }
    const relativeError = Math.sqrt(error / power);
    check(relativeError < 0.0001, `Production instruments match the audition waveform (${relativeError})`);
    check(part.voices.size === 0, 'Completed instruments release all oscillators');
    check(Math.abs(20 * Math.log10(tuning.audio.seaScoreLevel) - 16) < 0.01,
      'Runtime gain preserves the approved mix without the preview playback boost');

    const phase = Object.getOwnPropertyDescriptor(CrossingChapter.prototype, 'seaScore').get;
    const story = { wantsDolphins: true, swim: 'before', time: 999, podLeftAt: null };
    check(phase.call(story) === 'open', 'Elapsed time alone cannot trigger the swim music');
    for (const beat of ['restless', 'side', 'in', 'drying']) {
      story.swim = beat; check(phase.call(story) === 'swim', `${beat} keeps the quiet accompaniment`);
    }
    story.swim = 'done'; check(phase.call(story) === 'return', 'Music returns after the bird settles in the arms');
    story.podLeftAt = story.time; check(phase.call(story) === 'arrival', 'Music moves to the final harmony once the pod has left');
    story.swim = 'in'; check(phase.call(story) === 'swim', 'An unfinished swim retains priority near shore even after the pod has left');
    story.wantsDolphins = false; check(phase.call(story) === undefined, 'Ordinary crossings retain their original music');
    const restored = Object.assign(Object.create(CrossingChapter.prototype), {
      wantsDolphins: true, route: [{ x: 0, y: 0 }, { x: 100, y: 0 }], cruiseSpeed: 10,
      cast: { sealife: { resumeDolphinsAfterSwim() {} }, boat: { position: { x: 40, z: 0 }, mooring: {} } }, progress: () => 0.5,
      podLeftAt: null,
    });
    restored.restoreCheckpoint('swim', [0, 88]);
    check(restored.seaScore === 'return', 'A restored swim checkpoint starts after the swim, without replaying its lead-in');

    for (const fps of [10, 60, 144]) {
      const { ctx, sound } = offlineSound(1), score = new SeaScore(ctx, sound.musicBus), events = [];
      score.play = (part, note, at) => events.push({ phase: part.phase, note, at });
      for (let tick = 0; tick < fps * 190; tick++) {
        const now = tick / fps;
        if (now > 16 && now < 18) continue;
        Object.defineProperty(ctx, 'currentTime', { configurable: true, value: now });
        score.update(now < 50 ? 'open' : now < 105 ? 'swim' : now < 150 ? 'return' : 'arrival', 1);
      }
      check(events.filter(e => e.phase === 'swim' || e.phase === 'arrival').every(e => e.note.voice === 'pad'),
        `Swim and approach have no automated melody at ${fps} Hz`);
      const first = SEA_SECTIONS.open.notes[0], repeats = events.filter(e => e.phase === 'open' && e.note.voice === first.voice && e.note.midi === first.midi && e.note.at === first.at);
      check(repeats.length === 2 && Math.abs(repeats[1].at - repeats[0].at - 36) < 0.02,
        `Long opening loops steadily at ${fps} Hz`);
      check(events.filter(e => e.at >= 18 && e.at < 18.1).length <= 1,
        `A stalled frame creates no catch-up chord at ${fps} Hz`);
      check(new Set(events.map(e => `${e.phase}:${e.note.midi}:${e.note.voice}:${e.at.toFixed(5)}`)).size === events.length,
        `No duplicate scheduled notes at ${fps} Hz`);
      const before = events.length; score.stop(); score.update('open', 1);
      check(events.length === before && score.parts.size === 0, `Stopping prevents new phrases at ${fps} Hz`);
      delete ctx.currentTime;
    }

    const { ctx, sound } = offlineSound(17);
    let score, returned, chimes = 0, retired = [];
    const chime = sound.chime.bind(sound); sound.chime = (...args) => { chimes++; chime(...args); };
    const update = tick => {
      const now = tick / 8;
      const phase = now < 3 ? 'open' : now < 7 ? 'swim' : now < 10 ? 'return' : now < 12 ? 'arrival' : now < 14 ? undefined : 'return';
      sound.update(0.125, { ...baseState, music: now >= 12 && now < 14 ? 'mirror' : 'sea', seaScore: phase,
        gust: now >= 4 && now < 4.5 ? 12 : 0, charge: now >= 5 && now < 5.5 ? 0.7 : 0, silence: now >= 15 });
      if (tick === 0) score = sound.seaScore;
      if (tick === 8) retired.push(sound.seaScore.current);
      if (tick === 24) check(retired[0].stopped && sound.seaScore.current.phase === 'swim', 'Entering swim releases the preceding melody');
      if (tick === 48) check(retired[0].voices.size === 0, 'Old phase voices are disconnected after the crossfade');
      if (tick === 96) check(sound.seaScore === null && score.stopped, 'Arriving at the mirror stops the sea scheduler');
      if (tick === 112) { returned = sound.seaScore; check(returned !== score && returned.current.phase === 'return', 'Resumed passage can start directly in its return phase'); }
      if (tick === 120) check(sound.seaScore === null && returned.stopped, 'Permanent ending silence stops the sea score');
    };
    update(0); let pause = ctx.suspend(0.125), render = ctx.startRendering();
    for (let tick = 1; tick < 17 * 8; tick++) {
      await pause; update(tick);
      if (tick + 1 < 17 * 8) pause = ctx.suspend((tick + 1) / 8);
      await ctx.resume();
    }
    const buffer = await render;
    // Cursor chimes are limited to the opening island, the forest and the Sleeping climb (docs/contracts/audio.md);
    // the long crossing is none of those, so gusts and updrafts stay silent even during the quiet swim.
    check(chimes === 0, 'Gusts and updrafts stay silent during the crossing, including the quiet swim');
    check(score.parts.size === 0 && returned.parts.size === 0, 'Departed score releases all phase buses and voices');
    return { passed, relativeError, ...encodeAudio(buffer) };
  });
  assert(result.clipped === 0 && result.peakDbFS < -0.1, 'The live score/gesture mix must not clip');
  fs.writeFileSync('/tmp/updraft-sea-score-check.wav', wav(Buffer.from(result.pcm, 'base64')));
  console.log(JSON.stringify({ checks: result.passed.length, passed: result.passed, relativeError: result.relativeError,
    peakDbFS: result.peakDbFS, clipped: result.clipped }, null, 2));
} finally { await browser.close(); }

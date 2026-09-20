// Verify the approved Little Boats score, timing, transitions and voice cleanup in real Web Audio.
// Usage: node tools/boats-score-check.mjs (Vite on port 5230, or BASE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { BOATS_NOTES, LittleBoatsScore } = await import('/src/audio/little-boats-score.ts');
    const { scheduleProposal } = await import('/tools/lib/island-score-proposals.mjs');
    const passed = [], check = (ok, text) => { if (!ok) throw Error(text); passed.push(text); };
    const comparison = offlineSound(40);
    const approved = scheduleProposal('boats', comparison.ctx, comparison.sound.musicBus).notes;
    const canonical = notes => notes.map(({ voice, midi, at, duration, level }) => ({ voice, midi, at, duration, level }))
      .sort((a, b) => a.at - b.at || a.midi - b.midi);
    check(JSON.stringify(canonical(BOATS_NOTES)) === JSON.stringify(canonical(approved)),
      'All approved pitches, timings, durations and dynamics are preserved');

    // Exercise the real scheduler at several frame rates, including a missing second of frames.
    for (const fps of [10, 30, 60, 144]) {
      const { ctx, sound } = offlineSound(1);
      const score = new LittleBoatsScore(ctx, sound.musicBus), notes = [];
      score.play = (note, at) => notes.push({ note, at });
      for (let tick = 0; tick < fps * 75; tick++) {
        const at = tick / fps;
        if (at > 15 && at < 16) continue;
        Object.defineProperty(ctx, 'currentTime', { configurable: true, value: at }); score.update(1);
      }
      check(notes.every(n => n.at >= 0.08), `Local entry clock at ${fps} Hz`);
      check(new Set(notes.map(n => `${n.at.toFixed(5)}:${n.note.midi}:${n.note.voice}`)).size === notes.length,
        `No duplicate notes at ${fps} Hz`);
      const firstNotes = notes.filter(n => n.note === BOATS_NOTES[0]);
      check(firstNotes.length === 3 && Math.abs(firstNotes[2].at - firstNotes[0].at - 72) < 0.03,
        `Complete phrase repeats without clock drift at ${fps} Hz`);
      check(notes.filter(n => n.at >= 16 && n.at < 16.1).length <= 2, `No catch-up burst after a stalled frame at ${fps} Hz`);
      score.stop(); const before = notes.length; score.update(1);
      check(notes.length === before, `No new notes after departure at ${fps} Hz`);
      delete ctx.currentTime;
    }

    const { ctx, sound } = offlineSound(13);
    let score, released, restarted, chimes = 0;
    const chime = sound.chime.bind(sound); sound.chime = (...args) => { chimes++; chime(...args); };
    const update = tick => {
      const t = tick / 8, boats = t < 6 || t >= 9 && t < 10;
      sound.update(0.125, { ...baseState, music: boats ? 'boats' : 'sea', hush: 0.28,
        gust: t >= 2 && t < 2.5 ? 12 : 0, charge: t >= 3 && t < 3.5 ? 0.7 : 0,
        cues: tick === 32 ? ['restored'] : [], silence: t >= 10 });
      if (tick === 0) score = sound.boatsScore;
      if (tick === 32) check(sound.boatsCueUntil > t, 'Completion cue gets space in the score');
      if (tick === 49) released = sound.boatsScore === null && score.stopped;
      if (tick === 72) restarted = sound.boatsScore;
      if (tick === 81) check(sound.boatsScore === null && restarted.stopped, 'Permanent music cut stops the chapter score');
    };
    update(0);
    let pause = ctx.suspend(0.125), rendering = ctx.startRendering();
    for (let tick = 1; tick < 13 * 8; tick++) {
      await pause; update(tick);
      if (tick + 1 < 13 * 8) pause = ctx.suspend((tick + 1) / 8);
      await ctx.resume();
    }
    const buffer = await rendering;
    check(chimes > 2, 'Gust and updraft chimes remain audible alongside the score');
    check(released, 'Leaving Little Boats stops its scheduler');
    check(restarted !== score && restarted.epoch > 9, 'Re-entry starts a fresh phrase');
    check(score.voices.size === 0 && restarted.voices.size === 0, 'Departed score releases every oscillator');
    return { passed, ...encodeAudio(buffer) };
  });
  assert(result.peakDbFS < -0.1 && result.clipped === 0, 'Mixed score/gestures/cues must not clip');
  fs.writeFileSync('/tmp/updraft-boats-score-check.wav', wav(Buffer.from(result.pcm, 'base64')));
  console.log(JSON.stringify({ checks: result.passed.length, passed: result.passed,
    peakDbFS: result.peakDbFS, clipped: result.clipped }, null, 2));
} finally { await browser.close(); }

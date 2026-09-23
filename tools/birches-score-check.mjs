// Approved audition parity, player-paced sections, gesture harmony and unchanged island transitions.
// node tools/birches-score-check.mjs (Vite on 5230, or BASE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async () => {
    const { BirchesScore, BIRCHES_AUDITION_NOTES, BIRCHES_SECTIONS } = await import('/src/audio/birches-score.ts');
    const { BirchesChapter } = await import('/src/story/birches.ts');
    const { scheduleProposal } = await import('/tools/lib/island-score-proposals.mjs');
    const { tuning } = await productionModule('/src/tuning.ts');
    const { takeCues } = await productionModule('/src/story/cues.ts');
    const passed = [], check = (ok, message) => { if (!ok) throw Error(message); passed.push(message); };
    const canonical = notes => notes.map(({ voice, midi, at, duration, level }) => ({ voice, midi, at, duration, level }))
      .sort((a, b) => a.at - b.at || a.midi - b.midi);
    const refCtx = new OfflineAudioContext(2, 88 * 24000, 24000);
    const ref = scheduleProposal('birches', refCtx, refCtx.destination, 0, 'refined');
    check(JSON.stringify(canonical(ref.notes)) === JSON.stringify(canonical(BIRCHES_AUDITION_NOTES)),
      'Every approved pitch, onset, duration and instrument strength matches the revision');
    const expected = await refCtx.startRendering();
    const parityCtx = new OfflineAudioContext(2, 88 * 24000, 24000), score = new BirchesScore(parityCtx, parityCtx.destination);
    const part = { bus: parityCtx.destination, voices: new Set(), stopped: false };
    for (const note of BIRCHES_AUDITION_NOTES) score.play(part, note, note.at);
    const actual = await parityCtx.startRendering();
    let error = 0, power = 0;
    for (let ch = 0; ch < 2; ch++) {
      const a = actual.getChannelData(ch), b = expected.getChannelData(ch);
      for (let i = 0; i < a.length; i++) { error += (a[i] - b[i]) ** 2; power += b[i] ** 2; }
    }
    const relativeError = Math.sqrt(error / power);
    check(relativeError < .0001, `Production instruments match the approved waveform (${relativeError})`);
    check(part.voices.size === 0, 'All audition oscillators finish');
    check(Math.abs(20 * Math.log10(tuning.audio.birchesScoreLevel) - 20.3) < .01,
      'Runtime preserves the approved music balance without the playback boost');

    const phase = Object.getOwnPropertyDescriptor(BirchesChapter.prototype, 'birchesScore').get;
    const scarf = { completed: 0, finished: false }, story = { beat: 'wonder', cast: { birches: { scarf } } };
    for (const beat of ['ashore','wonder','walk','toScarf','scarf']) {
      story.beat = beat; check(phase.call(story) === 'walk', `${beat}: the first loop keeps the opening phrase`);
    }
    scarf.completed = 1;
    for (const beat of ['walk','swingOffer','toScarf','scarf','unravelling']) {
      story.beat = beat; check(phase.call(story) === 'scarf', `${beat}: later scarf work leaves room for gestures`);
    }
    for (const beat of ['toSwing','swinging']) {
      story.beat = beat; check(phase.call(story) === 'swing', `${beat}: only an accepted swing starts its phrase`);
    }
    scarf.completed = 4; scarf.finished = true;
    story.beat = 'unravelling'; check(phase.call(story) === 'scarf', 'The last release does not add another melody over the cue');
    for (const beat of ['walk','gathering','toBoat']) {
      story.beat = beat; check(phase.call(story) === 'return', `${beat}: the completed sail selects the final walking phrase`);
    }
    for (const beat of ['push','aboard']) {
      story.beat = beat; check(phase.call(story) === 'return', `${beat}: the final phrase continues through departure`);
    }
    for (const count of [0,1,2,3,4]) {
      const restoredScarf = { restore(n) { this.completed = n; this.finished = n === 4; } };
      const restored = Object.assign(Object.create(BirchesChapter.prototype), { cast: {
        birches: { scarf: restoredScarf }, boat: {}, child: { stop() {} },
      } });
      takeCues(); restored.restoreCheckpoint(`scarf4-${count}`, [2,1,.65,count]);
      check(restored.birchesScore === (count === 0 ? 'walk' : count === 4 ? 'return' : 'scarf') && !takeCues().length,
        `Checkpoint with ${count} freed tangles resumes the right section without a reward`);
    }
    for (const fps of [10,60,144]) {
      const ctx = new OfflineAudioContext(2, 24000, 24000), scheduler = new BirchesScore(ctx, ctx.destination), events = [];
      scheduler.play = (part, note, at) => events.push({ phase: part.phase, note, at });
      for (let tick = 0; tick < fps * 210; tick++) {
        const now = tick / fps; if (now > 10 && now < 13) continue;
        Object.defineProperty(ctx, 'currentTime', { configurable: true, value: now });
        scheduler.update(now < 50 ? 'walk' : now < 100 ? 'swing' : now < 150 ? 'scarf' : 'return', 1);
      }
      check(events.filter(e => e.phase === 'scarf').every(e => e.note.role !== 'melody'), `Long scarf waits remain without lead melody at ${fps} Hz`);
      const first = BIRCHES_SECTIONS.walk.notes[0], repeats = events.filter(e => e.phase === 'walk' && e.note.voice === first.voice && e.note.midi === first.midi && e.note.at === first.at);
      check(repeats.length === 3 && Math.abs(repeats[1].at - repeats[0].at - 22) < .02, `Opening repeats without clock drift at ${fps} Hz`);
      check(events.some(e => e.phase === 'swing' && e.at > 75 && e.note.role === 'melody'), `An extended swing keeps its own phrase at ${fps} Hz`);
      check(!events.some(e => e.at >= 13 && e.at < 13.1), `A stalled frame does not bunch missed notes at ${fps} Hz`);
      check(new Set(events.map(e => `${e.phase}:${e.note.voice}:${e.note.midi}:${e.at.toFixed(5)}`)).size === events.length,
        `No duplicate attacks at ${fps} Hz`);
      for (const phase of Object.keys(BIRCHES_SECTIONS)) {
        scheduler.update(phase, 1);
        const epoch = scheduler.current.epoch, pattern = BIRCHES_SECTIONS[phase];
        check(pattern.chords.every(c => JSON.stringify(scheduler.chordAt(epoch + pattern.seconds * 3 + c.at + .001)) === JSON.stringify(c.tones)),
          `${phase}: updraft harmony follows the section through repeated loops at ${fps} Hz`);
      }
      const count = events.length; scheduler.stop(); scheduler.update('walk', 1);
      check(events.length === count && scheduler.parts.size === 0, `Stopped scores cannot restart at ${fps} Hz`);
      delete ctx.currentTime;
    }

    const { ctx, sound } = offlineSound(65), glides = [], chords = [], feedback = [], updraft = [];
    let live, retired, resumed;
    const chime = sound.chime.bind(sound);
    sound.chime = (...args) => {
      feedback.push({ now: ctx.currentTime, midi: args[0], duration: args[4] });
      if (args[4] === 1.6 && sound.birchesScore) updraft.push({ midi: args[0], chord: [...sound.birchesScore.chordAt(args[3])] });
      chime(...args);
    };
    const parameter = sound.padVoices[0].osc[0].frequency, setTarget = parameter.setTargetAtTime.bind(parameter);
    parameter.setTargetAtTime = (...args) => { glides.push(args); return setTarget(...args); };
    const update = tick => {
      const now = tick / 8;
      const phase = now < 4 ? undefined : now < 18 ? 'walk' : now < 33 ? 'swing' : now < 46 ? 'scarf'
        : now < 54 ? 'return' : now < 60 ? undefined : 'walk';
      const music = now >= 58 && now < 60 ? 'drowned' : 'birches';
      sound.update(.125, { ...baseState, music, birchesScore: phase,
        gust: [16,22,41].some(at => now >= at && now < at + .5) ? 9 : 0,
        charge: now >= 33 && now < 44 ? .65 : 0, gliderLift: now >= 39 && now < 39.5 ? .6 : 0,
        pianoActive: now >= 42 && now < 42.75, silence: now >= 62, cues: now === 44 ? ['delight'] : [] });
      chords.push({ now, chord: sound.chord, music });
      if (tick === 4 * 8) live = sound.birchesScore;
      if (tick === 32 * 8) retired = live.current;
      if (tick === 36 * 8) check(!retired.voices.size && !live.parts.has(retired), 'The swing melody releases on return to scarf work');
      if (tick === 40 * 8) check(sound.padGain.gain.value < .00001, 'The original pad stays out of the composed score');
      if (tick === 54 * 8) check(!sound.birchesScore && live.stopped, 'Explicitly clearing the score releases its voices');
      if (tick === 57.5 * 8) check(sound.padGain.gain.value > .045, 'An explicit fallback still restores the shared pad');
      if (tick === 60 * 8) { resumed = sound.birchesScore; check(resumed !== live, 'A fresh entry creates a fresh score'); }
      if (tick === 62 * 8) check(!sound.birchesScore && resumed.stopped, 'Permanent silence stops Birches');
    };
    update(0); let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
    for (let tick = 1; tick < 65 * 8; tick++) {
      await pause; update(tick);
      if (tick + 1 < 65 * 8) pause = ctx.suspend((tick + 1) / 8);
      await ctx.resume();
    }
    const buffer = await rendering;
    // Cursor chimes are limited to the opening island, the forest and the Sleeping climb (docs/contracts/audio.md);
    // Birches is none of those, so gusts and held updrafts stay silent across every musical section.
    check(![16,22,41].some(at => feedback.some(e => e.now >= at && e.now < at + .5)), 'Playable strokes stay silent in Birches across the musical sections');
    check(updraft.length === 0, 'Held updrafts do not trigger cursor chimes in Birches either');
    check(!feedback.some(e => e.now >= 42 && e.now < 42.75), 'Piano ownership still suppresses generic gesture notes');
    check(live.parts.size === 0 && resumed.parts.size === 0, 'Exited scores release all oscillators and buses');
    check(chords.every(s => s.chord === Math.floor(s.now / (s.music === 'birches' ? 11 : 13)) % 4),
      'The original shared chord clock continues independently, including at departure');
    check(glides.some(([, at, seconds]) => at === 58 && seconds === 3.5), 'Island departure retains the original pitch glide');
    check(glides.filter(([, at]) => at > 0 && at < 58).every(([, , seconds]) => seconds === 1.2), 'Internal shared-pad pitch glides are unchanged');
    return { passed, relativeError, updraftCount: updraft.length, ...encodeAudio(buffer) };
  });
  assert(result.clipped === 0 && result.peakDbFS < -.1, 'The production score/gesture mix must not clip');
  fs.writeFileSync('/tmp/updraft-birches-score-check.wav', wav(Buffer.from(result.pcm, 'base64')));
  const { pcm, ...report } = result;
  fs.writeFileSync('/tmp/updraft-birches-score-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: result.passed.length, ...report }, null, 2));
} finally { await browser.close(); }

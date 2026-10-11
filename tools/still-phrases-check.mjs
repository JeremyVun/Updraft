// Recorded phrases, real colour readback events, deduplication and reversible drone. Vite on 5230.
import { audioPage } from './lib/audio-render.mjs';
const { browser, page } = await audioPage();
try {
  const checks = await page.evaluate(async () => {
    const { StillPhrases, STILL_PHRASES, STILL_CROSSING } = await productionModule('/src/audio/still-phrases.ts');
    const { StillGestures } = await import('/src/audio/still-gestures.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const fall = offlineSound(1).sound, fallNotes = [];
    fall.chime = (...note) => fallNotes.push(note);
    fall.phrase('fallen'); fall.phrase('landed');
    check(fallNotes.length === 0, 'The recorded opening has no falling or touchdown musical tones');
    tuning.audio.stillFallTones = true;
    fall.phrase('fallen'); fall.phrase('landed');
    check(fallNotes.length === 6, 'The original five-note fall and landing note remain available for comparison');
    tuning.audio.stillFallTones = false;
    const events = new StillGestures(); let colour = .1;
    const step = (flying = false, wind = false, active = true, dt = .125) =>
      events.update(dt, active, flying, wind, 0, 0, () => colour);
    check(step(true) && !step(true), 'Takeoff requests one gesture; sustained flight is timed by the audio clock');
    step(false); check(step(true), 'The next takeoff is a new event');
    check(!step(true, true, false), 'Scripted flights and wind are ignored');
    step(false); colour += .1;
    check(!step(), 'Autonomous colour with no player wind cannot trigger a phrase');
    check(!step(false, true), 'Wind waits for visible colour readback');
    colour += .03; check(step(), 'Colour appearing where wind touched the island triggers a phrase');
    check(!step(), 'The same colour change is consumed once');
    step(false, true); step(false, false, true, 1); colour += .1;
    check(!step(), 'Old wind samples expire without a delayed reward');
    colour = 1; step(false, true);
    check(!step(), 'Wind on restored ground adds no phrase');

    const { ctx, sound } = offlineSound(30);
    sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
    const state = { ...baseState, music: 'still', openingScore: 'wander', startingIsland: true, flockChatter: false };
    sound.update(.125, state); const score = sound.stillPhrases;
    check(!score.trigger(), 'Events while downloading are discarded, not queued');
    await score.ready;
    check(!score.voice && score.next === 0, 'Finishing the download never starts an old event');
    check(STILL_PHRASES.every(([from, to], i) => from < to && to <= score.buffer.duration
      && (!i || from > STILL_PHRASES[i - 1][1])), 'Every phrase range is ordered and inside the original file');
    let first;
    const update = tick => {
      const t = tick / 8;
      if (t === 12) sound.setMusicMuted(true);
      if (t === 14) sound.setMusicMuted(false);
      sound.update(.125, { ...state, stillPhrase: t >= 1 && t < 8 || t === 13 || t === 16,
        scripted: t >= 18 && t < 22, silence: t >= 24 });
      if (t === 1) first = score.voice.source;
      if (t === 5) check(score.voice.source === first && score.next === 1,
        'Requests during the first 4.5 seconds neither restart nor skip ahead');
      if (t === 5.625) check(score.voices.size === 2 && first.buffer && score.next === 2,
        'After 4.5 seconds the next phrase starts while the first tail remains live');
      if (t === 11) check(score.voices.size === 1 && !first.buffer && score.next === 2,
        'The older tail releases without stopping the newer phrase or queuing gestures');
      if (t === 14) check(score.next === 2, 'Music-muted gestures are discarded');
      if (t === 15.875) check(!score.voice && !score.voices.size, 'Finished phrases leave silence with no backlog');
      if (t === 17) check(score.next === 3 && score.voice.source !== first, 'A fresh gesture starts the next phrase');
      if (t === 20) check(!score.voice, 'Story sequences fade out the current phrase');
      if (t === 23) check(!sound.openingScore && sound.padGain.gain.value < 1e-7,
        'The experiment keeps the original drone disabled between phrases');
    };
    let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
    for (let tick = 1; tick < 30 * 8; tick++) {
      await pause; update(tick);
      if (tick + 1 < 30 * 8) pause = ctx.suspend((tick + 1) / 8);
      await ctx.resume();
    }
    const buffer = await rendering, data = buffer.getChannelData(0);
    const power = (from, to) => data.slice(from * 24000, to * 24000).reduce((sum, v) => sum + v * v, 0);
    check(power(1, 4) > .001 && power(16, 18) > .001, 'Both accepted phrases render audible audio');
    check(power(0, .9) === 0 && power(25, 29) === 0, 'The initial rest and chapter exit contain no music');
    check(!score.buffer && !score.voice && !sound.stillPhrases, 'Exit releases the decoded recording and source');

    const tailsCtx = new OfflineAudioContext(2, 8 * 24000, 24000);
    const tails = new StillPhrases(tailsCtx, tailsCtx.destination); await tails.ready;
    tails.trigger();
    const stopTails = tailsCtx.suspend(5.25).then(async () => {
      check(tails.trigger() && tails.voices.size === 2, 'Two tails can be active when leaving the island');
      tails.stop();
      await tailsCtx.resume();
    });
    await tailsCtx.startRendering(); await stopTails;
    check(!tails.voices.size && !tails.buffer, 'Stopping retires every overlapping source and the recording');

    const flight = offlineSound(40), flyingSound = flight.sound;
    flyingSound.update(.125, state);
    const flightScore = flyingSound.stillPhrases; await flightScore.ready;
    let flightPause = flight.ctx.suspend(.125); const flightRender = flight.ctx.startRendering();
    for (let tick = 1; tick < 40 * 8; tick++) {
      await flightPause;
      const t = tick / 8;
      if (t === 25) flyingSound.setMusicMuted(true);
      if (t === 29) flyingSound.setMusicMuted(false);
      flyingSound.update(.125, { ...state, stillPhrase: t === 1 || t === 5.5 || t === 20,
        stillFlying: t >= 1 && t < 14 || t >= 20 && t < 28 || t >= 32, scripted: t >= 32 });
      if (t === 5.625) check(flightScore.next === 2 && flightScore.voices.size === 2,
        'Colour can still start a phrase after 4.5 seconds during a flight');
      if (t === 10) check(flightScore.next === 2, 'The six-second flight interval restarts from the last accepted colour phrase');
      if (t === 11.625) check(flightScore.next === 3 && flightScore.voices.size === 2,
        'An uninterrupted flight starts the next motif after six seconds with its predecessor still ringing');
      if (t === 19) check(flightScore.next === 3, 'A grounded or held plane stops automatic motif requests');
      if (t === 24) check(flightScore.next === 4, 'A fresh takeoff starts another motif');
      if (t === 30) check(flightScore.next === 4, 'Music-muted flight repeats do not queue for a later landing');
      if (t === 38) check(flightScore.next === 4 && !flightScore.voices.size, 'Scripted flight cannot keep the motifs playing');
      if (tick + 1 < 40 * 8) flightPause = flight.ctx.suspend((tick + 1) / 8);
      await flight.ctx.resume();
    }
    await flightRender;

    const lateCtx = new OfflineAudioContext(2, 24000, 24000);
    const decode = lateCtx.decodeAudioData.bind(lateCtx); let release, began;
    const decoding = new Promise(resolve => { began = resolve; });
    lateCtx.decodeAudioData = async bytes => {
      const buffer = await decode(bytes); began();
      await new Promise(resolve => { release = resolve; }); return buffer;
    };
    const late = new StillPhrases(lateCtx, lateCtx.destination);
    await decoding; late.stop(); release(); await late.ready;
    check(!late.buffer && !late.trigger(), 'Leaving during decode cannot retain or start the recording later');

    const crossing = offlineSound(120), sailed = crossing.sound;
    const crossingState = { ...state, stillFlying: true, stillDepartureSoon: true };
    sailed.update(.125, crossingState);
    const passage = sailed.preparedScore; await passage.ready;
    check(passage.track === 'stillDeparture' && !passage.source, 'The second recording decodes before the throw without playing');
    let crossingSource;
    const crossingUpdate = tick => {
      const t = tick / 8;
      sailed.update(.125, { ...crossingState, stillDeparture: t >= 1, startingIsland: t < 20,
        scripted: t >= 18, stillPhrase: true, stillCrossingTime: t >= 20 ? t - 41 : undefined,
        arrivalMusic: t >= 63 ? 'lines' : undefined });
      if (t === 1) {
        crossingSource = passage.source;
        check(!!crossingSource && !crossingSource.loop && passage.offset === 8 && !sailed.stillPhrases,
          'The first post-bandage throw starts still_2 once and retires gesture motifs');
      }
      if (t === 20) check(passage.source === crossingSource, 'Boarding and the crossing preserve the same recording source');
      if (t === 37) check(passage.source === crossingSource, 'The recording continues while the title and whale take their turns');
      if (t === 62) check(passage.source === crossingSource && !sailed.stillPhrases, 'Later gestures never restart music or revive motifs');
      if (t === 68 || t === 110) check(passage.source === crossingSource && sailed.backgroundGate.gain.value === 1,
        'An early Lines request cannot add another fade before the authored 1:58 cutoff');
      if (t === 112) check(!passage.source && !passage.buffer, 'The recording retires at its authored cutoff before the musical rest');
    };
    let crossingPause = crossing.ctx.suspend(.125); const crossingRender = crossing.ctx.startRendering();
    for (let tick = 1; tick < 120 * 8; tick++) {
      await crossingPause; crossingUpdate(tick);
      await sailed.preparedScore?.ready; await sailed.linesScore?.ready;
      if (tick + 1 < 120 * 8) crossingPause = crossing.ctx.suspend((tick + 1) / 8);
      await crossing.ctx.resume();
    }
    await crossingRender;
    check(!!sailed.linesScore?.source && !sailed.stillDepartureScore && !sailed.stillPhrases, 'Lines takes over after the crossing');

    const { RecordedScore } = await productionModule('/src/audio/recorded-score.ts');
    const endCtx = new OfflineAudioContext(2, 112 * 24000, 24000);
    const ending = new RecordedScore(endCtx, endCtx.destination, 'stillDeparture');
    await ending.ready;
    const referenceEnd = ending.buffer.getChannelData(0);
    ending.update('departure', 1, 8);
    const endPause = endCtx.suspend(107), endRender = endCtx.startRendering();
    await endPause; ending.update('departure', 1, 8); await endCtx.resume();
    const endedAudio = (await endRender).getChannelData(0);
    for (const [time, gain] of [[106, 1], [108, .5], [109.5, .125]]) {
      let error = 0, power = 0;
      for (let i = Math.round(time * 24000); i < (time + .02) * 24000; i++) {
        const ref = referenceEnd[i + 8 * 24000];
        error += (endedAudio[i] - ref * gain) ** 2; power += ref * ref;
      }
      check(error / power < .0001, `Departure fade has expected gain ${gain} at source ${time + 8}s, even after a level update`);
    }
    check(endedAudio.slice(110 * 24000).every(v => v === 0), 'No audio from still_2 plays after source 1:58');
    ending.update('departure', 1, 8);
    check(!ending.source && !ending.buffer, 'The natural cutoff releases the source and cannot restart on later updates');

    const restoredCtx = new OfflineAudioContext(2, 3 * 24000, 24000);
    const restored = new StillPhrases(restoredCtx, restoredCtx.destination); await restored.ready;
    const original = restored.buffer.getChannelData(0);
    restored.crossing(10); const restoredSource = restored.voice.source;
    restored.crossing(11);
    check(restored.voice.source === restoredSource, 'The preserved horn experiment starts only once');
    const restoredAudio = (await restoredCtx.startRendering()).getChannelData(0);
    let difference = 0, reference = 0;
    const offset = (STILL_CROSSING[0] + 10) * 24000, gain = 10 ** (tuning.audio.stillPhraseDb / 20);
    for (let i = 24000; i < 48000; i++) {
      difference += (restoredAudio[i] - original[offset + i] * gain) ** 2;
      reference += (original[offset + i] * gain) ** 2;
    }
    check(difference / reference < 1e-8, 'The preserved horn experiment retains its elapsed-sample restore');
    restored.stop();

    tuning.audio.stillPhraseExperiment = false;
    try {
      const original = offlineSound(1);
      original.sound.update(.125, state);
      check(!!original.sound.openingScore && !original.sound.stillPhrases,
        'One tuning switch restores the preserved opening drone');
      await original.ctx.startRendering();
    } finally { tuning.audio.stillPhraseExperiment = true; }
    return checks;
  });
  console.log(JSON.stringify({ checks }, null, 2));
} finally { await browser.close(); }

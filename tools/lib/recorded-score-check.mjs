// Shared production checks for the supplied chapter recordings; called by their score gates.
export async function checkRecordedScore(page, track) {
  return page.evaluate(async track => {
    const { RecordedScore } = await productionModule('/src/audio/recorded-score.ts');
    const { HOME_ENDING } = await productionModule('/src/story/home-ending.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const field = track === 'home' ? 'summitScore' : track === 'lines' ? 'linesScore' : track === 'boats' ? 'boatsScore' : 'birchesScore';
    const phases = track === 'home' ? ['approach', 'flight', 'farewell', 'home'] : track === 'lines' ? ['first', 'second', 'third', 'family', 'door', 'shore'] : track === 'boats' ? ['play'] : ['walk', 'swing', 'scarf', 'return'];
    const state = { ...baseState, music: track, [field]: phases[0], flockChatter: false };
    const power = (buffer, from, to) => {
      const data = buffer.getChannelData(0);
      let sum = 0;
      for (let i = Math.ceil(from * buffer.sampleRate); i < Math.floor(to * buffer.sampleRate); i++) sum += data[i] ** 2;
      return sum / ((to - from) * buffer.sampleRate);
    };

    const { ctx, sound } = offlineSound(24);
    // Keep the music preference and arrival gates, isolating recordings from wildlife and weather.
    sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
    const wet = ctx.createChannelMerger(2);
    sound.wetDuck.disconnect(); sound.wetDuck.connect(wet, 0, 1); wet.connect(ctx.destination);
    const cues = [];
    sound.chime = (...args) => cues.push(args);
    sound.update(.125, state);
    await sound[field].ready;
    const score = sound[field], source = score.source, epoch = score.epoch;
    const trackDuration = source?.buffer?.duration;
    check(score instanceof RecordedScore && source?.buffer?.duration > 0, `${track}: the supplied full recording is decoded`);
    check(source.loop && source.playbackRate.value === 1, `${track}: native-speed playback loops for a lingering player`);
    const update = tick => {
      const t = tick / 8;
      if (t === 6) sound.setMusicMuted(true);
      if (t === 11) sound.setMusicMuted(false);
      sound.update(.125, { ...state, [field]: phases[Math.min(phases.length - 1, Math.floor(t / 3))],
        gust: 15, charge: .8, gliderLift: .8, silence: t >= 20 });
      if (t === 16) {
        check(sound[field] === score && score.source === source && score.epoch === epoch,
          `${track}: story phases and music mute never restart the recording`);
        check(sound.padGain.gain.value < 1e-6, `${track}: the synthetic pad stays silent`);
      }
    };
    let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
    for (let tick = 1; tick < 24 * 8; tick++) {
      await pause; update(tick);
      if (tick + 1 < 24 * 8) pause = ctx.suspend((tick + 1) / 8);
      await ctx.resume();
    }
    const buffer = await rendering;
    check(power(buffer, 3, 5) > 1e-7 && power(buffer, 14, 16) > 1e-7, `${track}: recorded music is audible before and after music mute`);
    check(power(buffer, 9, 10) < 1e-12, `${track}: music mute silences the recording`);
    check(power(buffer, 22, 23) === 0, `${track}: permanent silence leaves no recorded tail`);
    check(!score.source && !score.buffer && !sound[field], `${track}: exit releases the decoded audio and source`);
    check(cues.length === 0, `${track}: gestures add no notes over the recording`);

    // Decode directly as well, so an actual loop is compared against the original samples.
    const loopCtx = new OfflineAudioContext(2, Math.ceil((trackDuration + 4) * 24000), 24000);
    const loop = new RecordedScore(loopCtx, loopCtx.destination, track);
    await loop.ready;
    const original = loop.buffer, duration = original.duration;
    loop.update(phases[0], 1);
    const looped = await loopCtx.startRendering();
    const a = original.getChannelData(0), b = looped.getChannelData(0);
    let error = 0, reference = 0;
    for (let i = 24000; i < 3 * 24000; i++) {
      error += (b[original.length + i] - a[i]) ** 2; reference += a[i] ** 2;
    }
    check(error / reference < 1e-8, `${track}: the next loop preserves the supplied samples (${duration.toFixed(2)} seconds)`);
    loop.stop(0);

    const { ctx: liveCtx, sound: live } = (() => {
      const sound = new audioModule.Soundscape(); sound.start(); return { ctx: sound.ctx, sound };
    })();
    await liveCtx.resume();
    live.update(.1, state); await live[field].ready;
    const liveSource = live[field].source;
    live.setMuted(true); await liveCtx.suspend();
    const frozen = liveCtx.currentTime;
    await new Promise(resolve => setTimeout(resolve, 80));
    check(liveCtx.currentTime === frozen && live[field].source === liveSource, `${track}: mute-all freezes playback without replacing the source`);
    live.setMuted(false); await liveCtx.resume();
    live.setHidden(true); await liveCtx.suspend();
    check(!live.running && live[field].source === liveSource, `${track}: hiding the page suspends the same recording`);
    live.setHidden(false); await liveCtx.resume();
    check(live.running && live[field].source === liveSource, `${track}: returning to the page resumes the recording`);
    live.update(.1, { ...state, silence: true });
    await liveCtx.close();

    const lateCtx = new AudioContext();
    const decode = lateCtx.decodeAudioData.bind(lateCtx);
    let release, decoded;
    const held = new Promise(resolve => { release = resolve; });
    const decoding = new Promise(resolve => { decoded = resolve; });
    lateCtx.decodeAudioData = async bytes => {
      const buffer = await decode(bytes); decoded(); await held; return buffer;
    };
    const late = new RecordedScore(lateCtx, lateCtx.destination, track);
    late.update(phases[0], 1);
    await decoding;
    late.stop(0); release(); await late.ready;
    check(!late.source && !late.buffer, `${track}: leaving during a slow decode cannot start late music or retain its buffer`);
    await lateCtx.close();

    if (track === 'home') {
      const { ctx, sound } = offlineSound(6);
      sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
      const update = t => sound.update(.125, { ...state, summitScore: 'home', homeEndingTime: HOME_ENDING.fadeFrom - 2 + t,
        silence: t >= HOME_ENDING.musicEndsAt - HOME_ENDING.fadeFrom + 2 });
      update(0); await sound.summitScore.ready;
      check(sound.summitScore.offset === HOME_ENDING.fadeFrom - 2, 'Home: a restored ending starts at its checkpoint offset');
      let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
      for (let tick = 1; tick < 48; tick++) {
        await pause; update(tick / 8);
        if (tick + 1 < 48) pause = ctx.suspend((tick + 1) / 8);
        await ctx.resume();
      }
      const buffer = await rendering;
      check(power(buffer, .5, 1.5) > 1e-7 && power(buffer, 3, 5) === 0, 'Home: the recording fades out at the existing ending deadline');
    }
    return checks;
  }, track);
}

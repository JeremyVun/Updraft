// Shared production checks for the supplied chapter recordings; called by their score gates.
export async function checkRecordedScore(page, track) {
  return page.evaluate(async track => {
    const { RecordedScore } = await productionModule('/src/audio/recorded-score.ts');
    const { HOME_ENDING, homeEndingPosition } = await productionModule('/src/story/home-ending.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const field = track === 'home' ? 'summitScore' : track === 'mirror' ? 'mirrorScore' : track === 'lines' ? 'linesScore' : track === 'boats' ? 'boatsScore' : 'birchesScore';
    const phases = track === 'home' ? ['approach', 'flight', 'farewell', 'home'] : track === 'mirror' ? ['approach', 'search', 'one', 'two', 'three', 'constellation', 'depart'] : track === 'lines' ? ['first', 'second', 'third', 'family', 'door', 'shore'] : track === 'boats' ? ['play'] : ['walk', 'swing', 'scarf', 'return'];
    // Birches loops only on its island and the approach to it (`village-music-check` covers its play-out).
    const state = { ...baseState, music: track, [field]: phases[0], flockChatter: false, ...(track === 'birches' ? { birchesLoop: true } : {}) };
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
      const { tuning } = await productionModule('/src/tuning.ts');
      const { ctx, sound } = offlineSound(6);
      sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
      const restoredAt = HOME_ENDING.musicEndsAt - 2;
      const update = t => sound.update(.125, { ...state, summitScore: 'home', homeEndingTime: restoredAt + t,
        silence: t >= 2 });
      update(0); await sound.summitScore.ready;
      check(Math.abs(sound.summitScore.offset - homeEndingPosition(restoredAt)) < 1e-9, 'Home: a restored ending starts where the ending\'s music would be');
      let pause = ctx.suspend(.125); const rendering = ctx.startRendering();
      for (let tick = 1; tick < 48; tick++) {
        await pause; update(tick / 8);
        if (tick + 1 < 48) pause = ctx.suspend((tick + 1) / 8);
        await ctx.resume();
      }
      const buffer = await rendering;
      check(power(buffer, .5, 1.5) > 1e-9 && power(buffer, 3, 5) < 1e-11, 'Home: the recording is cut at the ending\'s silence, already rung out');

      // The ending's passages take over attack to attack on its clock, on time and with no gap.
      const { homeEndingNext } = await productionModule('/src/story/home-ending.ts');
      for (let next = homeEndingNext(0); next; next = homeEndingNext(next.at)) {
        const from = next.at - 1.5, run = offlineSound(3.5);
        run.sound.master.disconnect(); run.sound.musicDryGain.connect(run.ctx.destination);
        const step = t => run.sound.update(.125, { ...state, summitScore: 'home', homeEndingTime: from + t });
        step(0); await run.sound.summitScore.ready;
        let pause = run.ctx.suspend(.125), after; const rendering = run.ctx.startRendering();
        for (let tick = 1; tick < 28; tick++) {
          await pause; step(tick / 8);
          if (tick === 20) after = run.sound.summitScore.position(run.ctx.currentTime) - homeEndingPosition(from + 2.5);
          if (tick + 1 < 28) pause = run.ctx.suspend((tick + 1) / 8);
          await run.ctx.resume();
        }
        const out = await rendering, join = 1.5, label = `Home: the passage from ${next.from} s at ${next.at.toFixed(2)} s`;
        check(Math.abs(after) < 128 / 24000, `${label} takes over on the ending's clock`);
        check(power(out, join - .02, join) > power(out, join - .4, join - .3) / 30 && power(out, join + .02, join + .3) > 1e-9, `${label} leaves no gap`);
      }

      // As the cygnet is set down Home goes on at a cycle seam into its quiet opening, which loops while it asks; at
      // the success the opening hands over at its next exit to the ending's attack, which the ending's clock is set by.
      const { HOME_SEAMS, HOME_CYCLE_SEAMS, HOME_ASK } = await productionModule('/src/audio/home-seams.ts');
      {
        // Measured as Sleeping's seams are: 30 ms before an attack out of a rest at least 5 dB under the median, not
        // rising into it, the attack's loudest 50 ms at least 9 dB over it, nothing begun by the seam itself.
        const decoded = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await (await fetch('/assets/music/home.ogg')).arrayBuffer());
        const rate = decoded.sampleRate, left = decoded.getChannelData(0), right = decoded.getChannelData(1);
        const sum = new Float64Array(decoded.length + 1);
        for (let i = 0; i < decoded.length; i++) sum[i + 1] = sum[i] + (left[i] ** 2 + right[i] ** 2) / 2;
        const db = (a, b) => { const i = Math.max(0, Math.floor(a * rate)), j = Math.min(decoded.length, Math.floor(b * rate));
          return 10 * Math.log10((j > i ? (sum[j] - sum[i]) / (j - i) : 0) + 1e-20); };
        const frames = []; for (let t = 0; t + .05 < decoded.duration; t += .05) frames.push(db(t, t + .05));
        const sounding = frames.filter(v => v > -80).sort((a, b) => a - b), median = sounding[sounding.length >> 1];
        const seam = at => { const attack = at + .03, rest = db(attack - .3, attack); let peak = -Infinity;
          for (let t = attack; t < attack + .3; t += .01) peak = Math.max(peak, db(t, t + .05));
          return { at, under: median - rest, rise: peak - rest, falling: db(attack - .6, attack - .3) - rest,
            early: Math.min(db(at - .03, at) - rest, db(at - .03, at) + 43) }; };
        const failing = [...new Set([...HOME_SEAMS, ...HOME_CYCLE_SEAMS, HOME_ASK.to, HOME_ENDING.passages[0][0]])].map(seam)
          .filter(s => !(s.under >= 5 && s.falling >= -3 && s.rise >= 9 && s.early < 3));
        check(!failing.length, `Home: every seam, and the ending's entrance, is 30 ms before an attack out of a rest (${JSON.stringify(failing)})`);
        check(HOME_SEAMS.every((at, i) => !i || at - HOME_SEAMS[i - 1] >= 2), 'Home: seams ordered and at least 2 s apart');
        check(db(0, HOME_ASK.from) < -60 && db(HOME_ASK.from + .03, HOME_ASK.from + .1) > -30, `Home: the opening is silent until 30 ms after the ask begins, then its first note (${db(0, HOME_ASK.from).toFixed(1)}, ${db(HOME_ASK.from + .03, HOME_ASK.from + .1).toFixed(1)} dB)`);
        check(db(decoded.duration - 2, decoded.duration) < -60, 'Home: the file rings out to silence, so its end serves as a seam');
        const ends = homeEndingPosition(HOME_ENDING.musicEndsAt), tail = db(ends - .5, ends);
        check(tail < -55, `Home: rung out under −55 dB by the ending's silence (${tail.toFixed(1)} dB)`);
      }
      const entrance = tuning.audio.homeJumpAt, setDown = tuning.summit.setDownAt, tries = setDown + 6.72, HOME_JUMP_LEAD = .03;
      const opening = HOME_ASK.to - HOME_ASK.from;
      // [where the island's pass is as they sit, how long the cygnet asks, where the opening should begin]
      for (const [sat, asked, askBegins] of [[83.45, 7, 114.8], [83.45, 14, 114.8], [83.45, 40, 114.8], [68.83, 8, 86.4], [12, 14, 29.95], [110, 10, null]]) {
        const success = tries + asked, total = success + 14;
        const run = offlineSound(total);
        run.sound.master.disconnect(); run.sound.musicDryGain.connect(run.ctx.destination);
        run.sound.homeFrom = run.ctx.currentTime - sat;
        let endingAt = null, returnIn, askAt, inOpening = [], landed;
        const step = t => {
          if (endingAt === null && t >= success) { returnIn = run.sound.homeReturnIn; endingAt = t + (returnIn ?? entrance) - entrance; }
          run.sound.update(.125, { ...state, summitScore: 'approach', homeAsk: t >= tries && t < success,
            homeSetDownIn: endingAt === null ? Math.max(0, setDown - t) : undefined, homeEndingTime: endingAt === null ? undefined : t - endingAt });
          askAt ??= run.sound.homeAskAt;
        };
        step(0); await run.sound.summitScore.ready;
        let next = run.ctx.suspend(.125); const rendered = run.ctx.startRendering();
        for (let tick = 1; tick < total * 8; tick++) {
          await next; step(tick / 8);
          const now = run.ctx.currentTime;
          if (askAt !== undefined && now > askAt + .2 && now < success) inOpening.push(run.sound.summitScore.position(now));
          if (endingAt !== null && Math.abs(now - endingAt - (entrance + 3)) < .06) landed = run.sound.summitScore.position(now) - homeEndingPosition(now - endingAt);
          if (tick + 1 < total * 8) next = run.ctx.suspend((tick + 1) / 8);
          await run.ctx.resume();
        }
        const out = await rendered, label = `Home: sat at ${sat} s, asked ${asked} s`;
        if (askBegins !== null) check(Math.abs(askAt - (askBegins - sat)) < 1e-6, `${label}, the opening begins at the ${askBegins} s seam`);
        else check(Math.abs(askAt - tries - tuning.audio.fogFade) < .13, `${label}, with no cycle seam near, the opening follows a fade as it asks`);
        if (success < askAt) check(Math.abs(endingAt + entrance - HOME_JUMP_LEAD - askAt) < .01, `${label}, answered before the opening, the ending takes its seam`);
        else check(inOpening.length && inOpening.every(p => p >= HOME_ASK.from && p < HOME_ASK.to), `${label}, the opening loops while it asks`);
        if (asked * 1 + tries - askAt > opening) check(inOpening.some((p, i) => i && p < inOpening[i - 1]), `${label}, the opening comes round again`);
        check(returnIn !== undefined && returnIn > .3 && returnIn < 5.1, `${label}, the music's return is ${returnIn?.toFixed(2)} s after the success`);
        check(Math.abs(landed) < 128 / 24000, `${label}, the ending's music runs at the ending's time`);
        const attack = endingAt + entrance;
        if (askBegins !== null) check(power(out, askAt - 1, askAt + 4) > 1e-6 && power(out, askAt + .1, askAt + 1) > 1e-7, `${label}, the music plays on into the opening`);
        check(power(out, attack - .1, attack - .01) < power(out, attack + .02, attack + .3) / 8, `${label}, the opening's tail is under the ending's attack`);
        check(power(out, success, attack) > 1e-8, `${label}, the music sounds until the ending's attack`);
      }
    }
    return checks;
  }, track);
}

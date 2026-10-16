// Birches' play-out, the stairs song, the village's approach and the quiet after it, rendered offline through the production
// soundscape: Birches (`red_door.ogg`) goes round on its island, resting between passes and coming in again as on arrival,
// plays its pass out once they have sailed and never begins after,
// ending `stairsSongRest` before the stairs song can begin; the stairs song loops under the cloud, fading over
// `stairsSongCloudFade` in the white and never starting again; `village_approach.ogg` starts from its top at the
// village's handoff at full level, ends faded at its seam just before the bass, never restarts; then no music through
// the village and the storm, the shared pad silent; then `belfry.ogg` from the fourth ring, coming in slowly and playing
// once into the storm, handing over sample-aligned to `belfry_ending.ogg` and its faded ritardando; the wood's drone at
// `woodDroneDb`. Also the seams on the decoded samples, the starts and downloads, late joins after music mute, restores
// and the rescue's quiet. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const checks = await page.evaluate(async () => {
    const { tuning } = await productionModule('/src/tuning.ts');
    const { RecordedScore } = await productionModule('/src/audio/recorded-score.ts');
    const { ARRIVAL_MUSIC } = await productionModule('/src/audio/arrival-music.ts');
    const { musicForStart, nextMusicForChapter } = await productionModule('/src/audio/music-loading.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const RATE = 24000, STEP = 1 / 8, once = tuning.audio.recordedMusicOnce.villageApproach;
    const gain = 10 ** (tuning.audio.recordedMusicDb.villageApproach / 20);
    const starts = new WeakMap();
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      const length = this.buffer?.duration ?? 0;
      const track = Math.abs(length - 192.87) < .05 ? 'village' : Math.abs(length - 143.92) < .05 ? 'belfry'
        : Math.abs(length - 9.03) < .05 ? 'belfryEnding' : Math.abs(length - 238.89) < .05 ? 'birches' : Math.abs(length - 224.08) < .05 ? 'stairs' : null;
      if (track) (starts.get(this.context) ?? starts.set(this.context, []).get(this.context)).push({ track, when, offset, node: this });
      return native.call(this, when, offset, duration);
    };
    const power = (buffer, from, to) => {
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let sum = 0;
      for (let i = Math.max(0, Math.ceil(from * buffer.sampleRate)); i < Math.min(buffer.length, Math.floor(to * buffer.sampleRate)); i++) sum += (left[i] ** 2 + right[i] ** 2) / 2;
      return sum / Math.max(1, (to - from) * buffer.sampleRate);
    };
    const db = p => 10 * Math.log10(Math.max(p, 1e-20));

    check(musicForStart('drowned') === 'villageApproach' && musicForStart('village') === 'villageApproach'
      && musicForStart({ chapter: 'drowned' }) === 'villageApproach', 'a village start fetches village_approach.ogg');
    check(['roofs', 'church', 'belfry'].every(c => musicForStart(c) === null)
      && ['sail', 'roofs', 'church', 'belfry'].every(point => musicForStart({ chapter: 'drowned', point }) === null),
    'every later start in the village up to the bells is silent and fetches nothing at load');
    check(nextMusicForChapter('stairs', 'under') === 'clouds' && ['cloud', 'above', 'sail', 'fog', 'down'].every(p => nextMusicForChapter('stairs', p) === 'villageApproach')
      && nextMusicForChapter('drowned') === 'belfry',
    'the village is the next download once clouds.ogg is in hand up in the white');

    const air = phase => ({ phase, cloud: phase === 'cloud' ? 1 : 0, climb: phase === 'under' ? 0 : 1,
      open: phase === 'under' || phase === 'cloud' ? 0 : 1, fog: phase === 'fog' ? 1 : 0, speed: phase === 'sail' || phase === 'fog' ? 4 : 0,
      clear: phase !== 'under' && phase !== 'cloud' });
    const birches = (loop = true) => ({ ...baseState, music: 'birches', birchesScore: 'return', birchesLoop: loop, hush: .3 });
    const stairs = phase => ({ ...baseState, music: 'birches', stairsSong: true, hush: .35, stairsAir: air(phase), arrivalMusic: phase === 'fog' || phase === 'down' ? 'drowned' : undefined });
    const village = (phase = 'drift', quiet = false) => ({ ...baseState, music: 'drowned', drownedScore: phase, hush: .3, arrivalMusic: 'drowned', drownedQuiet: quiet });
    // Drive a soundscape through `seconds`, `state(t)` each eighth of a second; `watch(t, sound)` after each update.
    // `background` hears only the background and its reverb send; `setup` runs before the first update.
    const render = async (seconds, state, { watch = () => {}, background = false, setup = () => {} } = {}) => {
      const { ctx, sound } = offlineSound(seconds);
      setup(sound);
      if (background) backgroundOnly(ctx, sound);
      else {
        sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
        const wet = ctx.createChannelMerger(2);
        sound.wetDuck.disconnect(); sound.wetDuck.connect(wet, 0, 1); wet.connect(ctx.destination);
      }
      const step = async t => {
        sound.update(STEP, state(t));
        await sound.preparedScore?.ready; await sound.villageScore?.ready; await sound.birchesScore?.ready; await sound.stairsScore?.ready; await sound.belfryScore?.ready;
        watch(t, sound);
      };
      await step(0);
      let pause = ctx.suspend(STEP); const rendering = ctx.startRendering();
      for (let tick = 1; tick < seconds / STEP; tick++) {
        await pause; await step(tick * STEP);
        if (tick + 1 < seconds / STEP) pause = ctx.suspend((tick + 1) * STEP);
        await ctx.resume();
      }
      return { sound, buffer: await rendering, starts: starts.get(ctx) ?? [] };
    };

    // The seam, on the decoded samples: the last note rung down, the bass's attack straight after it.
    {
      const ctx = new OfflineAudioContext(2, RATE, RATE);
      const score = new RecordedScore(ctx, ctx.destination, 'villageApproach');
      await score.ready;
      const raw = score.buffer;
      score.stop(0);
      const windows = [];
      for (let t = 0; t + .3 <= 60; t += .3) windows.push(db(power(raw, t, t + .3)));
      const median = [...windows].sort((a, b) => a - b)[windows.length >> 1];
      const before = db(power(raw, once.end - .3, once.end)), attack = db(power(raw, once.end + .03, once.end + .13));
      check(before < median - 10, `the last note has rung down at the seam (${before.toFixed(1)} dB, ${(median - before).toFixed(1)} under the opening's median)`);
      check(attack > before + 12, `the bass attacks just after it (${(attack - before).toFixed(1)} dB up within 130 ms)`);
      check(db(power(raw, once.end - .03, once.end)) < before + 3, 'nothing has begun to attack by the seam itself');
      check(db(power(raw, 0, .2)) < -55 && db(power(raw, .25, .45)) > median + 6, 'the file opens on 0.2 s of silence, then its loudest note');
    }

    // Birches: goes round on its island, plays its pass out once they have sailed, the same source.
    {
      let source = null, held = null, entrance = [], same = true, released = null;
      const level = 10 ** (tuning.audio.recordedMusicDb.birches / 20), tau = tuning.audio.recordedMusicFadeIn.birches;
      await render(4, t => birches(t < 2), { watch: (t, sound) => {
        const s = sound.birchesScore?.source;
        if (!s) return;
        source ??= s; same &&= s === source;
        if (t === 1) held = !s.loop && !!sound.birchesScore.buffer;
        if (t === 1 || t === 2) entrance.push(sound.birchesScore.bus.gain.value / level);
        released = sound.birchesScore.buffer === null;
      } });
      check(held === true, 'on the Birches island and its approach the recording is held to go round again, not looped sample to sample');
      check(entrance.every((g, i) => Math.abs(g - (1 - Math.exp(-(i + 1) / tau))) < .04),
        `it comes in over its own ${tau} s time constant (${entrance.map(g => g.toFixed(2)).join(', ')} at 1 and 2 s)`);
      check(same && source.loop === false && released, 'once they have sailed, the pass under way plays out: the same source, its recording released');
      let fetched = false;
      const late = await render(1, () => birches(false), { watch: (t, sound) => { fetched ||= !!sound.birchesScore || sound.preparedScore?.track === 'birches'; } });
      check(late.starts.length === 0 && !fetched, 'it never begins once they have sailed (a toStairs start is quiet until the stairs song)');
    }
    {
      // The end of the file: a played-out pass stops there.
      const out = new OfflineAudioContext(2, 10 * RATE, RATE);
      const a = new RecordedScore(out, out.destination, 'birches');
      await a.ready;
      const length = a.buffer.duration;
      a.update('return', 1, length - 5);
      a.playOut();
      const ended = await out.startRendering();
      check(power(ended, 1, 4) > 1e-7 && power(ended, 5.05, 10) === 0, `played out, it stops at the end of the file (${length.toFixed(1)} s)`);
    }
    {
      // On the island the pass ends, rests, and the next comes in from its top as on arrival; sailing in a rest, none does.
      const tail = 4, { rest } = tuning.audio.recordedMusicLoop.birches, tau = tuning.audio.recordedMusicFadeIn.birches;
      const level = 10 ** (tuning.audio.recordedMusicDb.birches / 20);
      const setup = sound => {
        sound.birchesScore = new RecordedScore(sound.ctx, sound.ctx.destination, 'birches');
        sound.birchesScore.update('return', level, 238.893 - tail);
      };
      let heldInRest = null, raw = null;
      const round = await render(tail + rest + 3, () => birches(true), { setup, watch: (t, sound) => {
        if (t === tail + 1) { heldInRest = !sound.birchesScore.source && !!sound.birchesScore.buffer; raw = sound.birchesScore.buffer; }
      } });
      const next = round.starts.filter(s => s.track === 'birches').at(-1);
      check(heldInRest && round.starts.length === 2 && next.offset === 0 && next.when >= tail + rest - .05 && next.when <= tail + rest + STEP + .05
        && power(round.buffer, tail + .05, tail + rest - .05) === 0 && power(round.buffer, tail + rest + 1, tail + rest + 3) > 1e-8,
        `on the island the pass ends, rests ${rest} s with its recording held, and goes round from its top (at ${next?.when} s)`);
      const gain = (a, b) => Math.sqrt(power(round.buffer, next.when + a, next.when + b) / power(raw, a, b)) / level;
      const expected = (a, b) => { let sum = 0; for (let i = 0; i < 100; i++) sum += (1 - Math.exp(-(a + (b - a) * (i + .5) / 100) / tau)) ** 2; return Math.sqrt(sum / 100); };
      const windows = [[0, .25], [.75, 1.25], [1.75, 2.25], [2.5, 2.75]];
      check(windows.every(([a, b]) => Math.abs(gain(a, b) - expected(a, b)) < .05),
        `the next pass comes in from silence over ${tau} s, as on arrival (${windows.map(([a, b]) => gain(a, b).toFixed(2)).join(', ')} of full)`);
      let released = null;
      const sailed = await render(tail + rest + 3, t => birches(t < tail + 1), { setup, watch: (t, sound) => {
        if (t === tail + 2) released = sound.birchesScore?.buffer === null;
      } });
      check(sailed.starts.length === 1 && released && power(sailed.buffer, tail + .05, tail + rest + 3) === 0,
        'sailing during the rest, nothing more plays and the recording is released');
    }
    {
      // Sailing to the stairs (from 2 s), the stairs song due at 20 s: a pass that would still sound then fades over
      // `birchesSailFade` to end `stairsSongRest` before it, settled once; one ending sooner simply ends.
      const { stairsSongRest: rest, birchesSailFade: fade } = tuning.audio, DUE = 20, END = DUE - rest;
      const sail = t => t < 2 ? birches(true) : { ...birches(false), arrivalIn: Math.max(0, DUE - t) };
      const early = await render(DUE, sail);
      const level = (from, to) => power(early.buffer, from, to);
      check(level(END - fade - 1, END - fade) > 1e-7 && level(END - fade / 2 - .2, END - fade / 2) < level(END - fade - .5, END - fade) / 2
        && level(END + .02, DUE) === 0, `early in its pass, it fades from ${END - fade} s and is silent from ${END} s, ${rest} s before the stairs song`);
      const tail = 6;
      let finishing = null;
      const ending = await render(DUE, sail, { setup: sound => {
        sound.birchesScore = new RecordedScore(sound.ctx, sound.backgroundDry, 'birches');
        sound.birchesScore.update('return', 10 ** (tuning.audio.recordedMusicDb.birches / 20), 238.893 - tail);
      }, watch: (t, sound) => { if (t === END) finishing = sound.birchesScore?.finishing; } });
      const raw = (from, to) => power(ending.buffer, from, to);
      check(finishing === false && raw(tail - 2.5, tail - 2) > 1e-9 && raw(tail + .05, DUE) === 0,
        `a pass ending ${tail} s in, before the rest, ends on its own with no fade`);
      // Gusts bring the handoff on early: asked for at 9 s and ready at once, the song still waits out the rest.
      const gusted = await render(DUE + 2, t => t < 9 ? sail(t)
        : { ...birches(false), arrivalIn: 0, arrivalMusic: 'stairs', arrivalReady: true });
      const song = gusted.starts.filter(s => s.track === 'stairs');
      check(song.length === 1 && song[0].when >= END + rest - STEP && song[0].offset === 0,
        `a boat sped on by gusts: the song still begins ${rest} s after the birches end (${song[0]?.when} s)`);
    }
    {
      // Up into the white (past the song's quiet first seconds): its fade, then never again, even if a frame says it is
      // under the cloud.
      const UP = 10;
      let gone = null, restarted = false;
      const white = await render(UP + 5, t => stairs(t < UP || (t >= UP + 2 && t < UP + 2.5) ? 'under' : 'cloud'), { watch: (t, sound) => {
        if (t >= UP && gone === null && !sound.stairsScore) gone = t;
        if (t > UP) restarted ||= !!sound.stairsScore || sound.preparedScore?.track === 'stairs';
      } });
      const fade = tuning.audio.stairsSongCloudFade, song = white.starts.filter(s => s.track === 'stairs');
      check(gone === UP && !restarted && song.length === 1 && song[0].offset === 0 && song[0].node.loop,
        'the stairs song loops under the cloud from its top; going up into the white stops it for good');
      check(power(white.buffer, UP - 1, UP) > 1e-7 && power(white.buffer, UP + fade / 2 - .1, UP + fade / 2) < power(white.buffer, UP - .5, UP) / 2
        && power(white.buffer, UP + fade + .02, UP + 5) === 0, `over a ${fade} s fade`);
    }

    // The handoff from the stairs' fog, clouds.ogg already over (its hold is `clouds-music-check`): the ordinary fade and
    // rest, then the village from its top, on through the rescue, the bell, the farewell and the storm.
    const HANDOFF = tuning.audio.arrivalFadeOut + tuning.audio.arrivalQuiet, END = HANDOFF + once.end;
    const fog = phase => ({ ...stairs(phase), stairsAir: { ...air(phase), clear: false } });
    const scene = t => t < 8 ? fog(t < 7 ? 'fog' : 'down')
      : village(t < 14 ? 'drift' : t < 24 ? 'fog' : t < 30 ? 'refuge' : t < 34 ? 'home' : t < 38 ? 'farewell' : 'storm');
    let stages = [], pad = 0, source = null, raw = null, same = true, prepared = null, leftover = null;
    const handoff = await render(END + 6, scene, { watch: (t, sound) => {
      const stage = sound.arrivalTransition.stage;
      if (stages.at(-1)?.stage !== stage) stages.push({ t, stage });
      pad = Math.max(pad, sound.padGain.gain.value);
      if (t < HANDOFF) prepared ??= sound.preparedScore?.track ?? null;
      if (sound.villageScore?.source) {
        source ??= sound.villageScore.source; raw ??= source.buffer;
        same &&= sound.villageScore.source === source;
      }
      if (t >= END + 5 && !leftover) leftover = { score: !!sound.villageScore, prepared: !!sound.preparedScore };
    } });
    const v = handoff.starts.filter(s => s.track === 'village');
    check(prepared === 'villageApproach', 'it is decoded while the village waits, before the handoff');
    const entry = stages.find(s => s.stage === 'incoming')?.t;
    check(v.length === 1 && entry - HANDOFF <= STEP + 1e-6 && Math.abs(v[0].when - entry) < .01 && v[0].offset === 0 && !v[0].node.loop,
      `village_approach.ogg starts once, from its top, as the rest ends (${JSON.stringify(v.map(s => [s.when, s.offset]))}; ${JSON.stringify(stages)})`);
    check(same, 'the village beats, the rescue phases and landing never restart or seek it');
    {
      const at = v[0].when, ratio = (from, to) => Math.sqrt(power(handoff.buffer, at + from, at + to) / power(raw, from, to)) / gain;
      check(Math.abs(ratio(.25, .45) - 1) < .03, `its first note is at full level (${tuning.audio.recordedMusicDb.villageApproach} dB): no fade-in swallows it (${ratio(.25, .45).toFixed(3)})`);
      check(Math.abs(ratio(10, 30) - 1) < .02, `and it stays there (${ratio(10, 30).toFixed(3)})`);
      check(ratio(once.end - .2, once.end - .02) < .4 && ratio(once.end - 1.2, once.end - .6) > .97, `it fades over its last ${once.fadeOut} s`);
    }
    check(power(handoff.buffer, v[0].when + once.end + .01, END + 6) === 0, `silent from the seam at ${once.end} s on, through the bell, the farewell and the storm`);
    check(pad < 1e-6, 'the shared pad stays silent through the village and the storm');
    check(!leftover.score && !leftover.prepared, 'nothing of it is kept or fetched again once it is over');

    // A village start: no handoff, it begins with the chapter.
    const direct = await render(2, () => village());
    check(direct.starts.length === 1 && direct.starts[0].when < 1e-6 && direct.starts[0].offset === 0, '?chapter=drowned starts it with the chapter, from its top');

    // Music off at the handoff and on 6 s later: it joins at its own time; after the seam, nothing.
    let joined = null;
    const late = await render(10, () => village(), { setup: sound => sound.setMusicMuted(true), watch: (t, sound) => {
      if (t === 6) sound.setMusicMuted(false);
      joined ??= sound.villageScore?.source ? t : null;
    } });
    check(joined === 6 + STEP && Math.abs(late.starts[0].offset - 6 - STEP) < .01, `music switched on later joins at its own time (${late.starts[0]?.offset} s in)`);
    const endShort = once.end;
    once.end = 3;
    try {
      const after = await render(6, () => village(), { setup: sound => sound.setMusicMuted(true), watch: (t, sound) => {
        if (t === 4) sound.setMusicMuted(false);
      } });
      check(after.starts.length === 0, 'switched on after the seam, nothing plays');
    } finally { once.end = endShort; }

    // Later starts and restores never play it; the rescue's quiet lets it go for good.
    for (const phase of ['fog', 'refuge', 'home', 'farewell', 'storm']) {
      let fetched = false, belfry = false;
      const later = await render(1.5, () => village(phase), { watch: (t, sound) => {
        fetched ||= sound.preparedScore?.track === 'villageApproach' || !!sound.villageScore;
        belfry ||= sound.preparedScore?.track === 'belfry';
      } });
      check(later.starts.length === 0 && !fetched, `${phase}: a start there is silent and fetches no approach`);
      check(belfry === (phase === 'refuge' || phase === 'home'), `${phase}: the belfry's goodbye is ${belfry ? '' : 'not '}decoded ahead of the bell`);
    }
    const sail = await render(1.5, t => village(t < .5 ? 'drift' : 'fog', true));
    check(sail.starts.length === 0, 'a restore after the rescue (the quiet already on) never plays it');
    let quietAt = null;
    const quiet = await render(12, t => village(t < 8 ? 'drift' : 'fog', t >= 4 && t < 7), { watch: (t, sound) => {
      if (t >= 4 && quietAt === null && !sound.villageScore) quietAt = t;
    } });
    const musicFade = tuning.drowned.rescue.musicFade;
    check(quietAt === 4 && quiet.starts.length === 1 && power(quiet.buffer, 4 + musicFade + .02, 12) === 0,
      `a rescue under it fades it over ${musicFade} s, and it never comes back`);

    // The belfry's goodbye. Its seams on the decoded samples: from just before an attack; the ending taking over just
    // before the next, the same passage sample for sample until its ritardando, and faded to silence.
    const bell = tuning.audio.recordedMusicOnce.belfry, bellGain = 10 ** (tuning.audio.recordedMusicDb.belfry / 20);
    const { at: handover, from: endingFrom, crossfade } = bell.ending;
    let endingRaw;
    {
      const ctx = new OfflineAudioContext(2, RATE, RATE);
      const score = new RecordedScore(ctx, ctx.destination, 'belfry');
      await score.ready;
      const raw = score.buffer;
      endingRaw = score.ending;
      score.stop(0);
      // Both attacks are low notes under a sustained texture: read them below 250 Hz.
      const low = async (from, to) => {
        const c = new OfflineAudioContext(2, Math.ceil((to - from + .5) * raw.sampleRate), raw.sampleRate);
        const source = c.createBufferSource(), filter = c.createBiquadFilter();
        source.buffer = raw; filter.type = 'lowpass'; filter.frequency.value = 250;
        source.connect(filter).connect(c.destination); source.start(0, from - .5);
        return db(power(await c.startRendering(), .5, .5 + to - from));
      };
      const [beforeStart, afterStart] = [await low(bell.from - .07, bell.from), await low(bell.from + .04, bell.from + .11)];
      const [beforeHandover, afterHandover] = [await low(handover - .03, handover + crossfade), await low(handover + .05, handover + .12)];
      check(afterStart > beforeStart + 6, `it begins ${bell.from} s in, just before an attack (${(afterStart - beforeStart).toFixed(1)} dB up below 250 Hz)`);
      check(afterHandover > beforeHandover + 6,
        `the ending takes over at ${handover} s, crossfading over ${crossfade * 1000} ms just before the next (${(afterHandover - beforeHandover).toFixed(1)} dB up below 250 Hz)`);
      const R = raw.sampleRate, a = raw.getChannelData(0), e = endingRaw.getChannelData(0), shift = Math.round(endingFrom * R), W = Math.round(.25 * R);
      const correlation = lag => {
        let ae = 0, aa = 0, ee = 0;
        for (let i = Math.round(handover * R) - W; i < Math.round(handover * R) + W; i++) {
          const x = a[i], y = e[i - shift + lag];
          ae += x * y; aa += x * x; ee += y * y;
        }
        return ae / Math.sqrt(aa * ee);
      };
      const lags = Array.from({ length: 41 }, (_, i) => i - 20), best = lags.reduce((m, lag) => correlation(lag) > correlation(m) ? lag : m, 0);
      check(best === 0 && correlation(0) > .999,
        `across the handover the ending is the same passage, sample-aligned (best lag ${best}, correlation ${correlation(0).toFixed(5)})`);
      const tail = power(endingRaw, endingRaw.duration - .02, endingRaw.duration) / power(endingRaw, 0, endingRaw.duration);
      check(Math.abs(endingFrom + endingRaw.duration - bell.end) < .002 && db(tail) < -50,
        `the ending carries the time line on to ${bell.end} s and is faded to silence there (${db(tail).toFixed(0)} dB)`);
    }
    check(musicForStart('storm') === 'belfry' && musicForStart({ chapter: 'drowned', point: 'storm' }) === 'belfry'
      && musicForStart('belfry') === null && nextMusicForChapter('drowned') === 'belfry' && musicForStart('wood') === null,
    'a storm save fetches the goodbye to start on load; in the village it is the next download');
    // The fourth ring at 6 s; aboard at 10; the storm from 16.
    const RING = 6, LENGTH = bell.end - bell.from;
    const goodbye = t => ({ ...village(t < 3 ? 'refuge' : t < 10 ? 'home' : t < 16 ? 'farewell' : 'storm'),
      bellsRung: t >= RING, hush: t < 16 ? .3 : .85 });
    let bellRaw = null, bellPad = 0;
    const bellSources = [];
    const rung = await render(RING + LENGTH + 4, goodbye, { watch: (t, sound) => {
      const source = sound.belfryScore?.source;
      if (source && bellSources.at(-1)?.source !== source) bellSources.push({ source, t });
      bellRaw ??= source?.buffer;
      bellPad = Math.max(bellPad, sound.padGain.gain.value);
    } });
    const b = rung.starts.filter(s => s.track === 'belfry'), e = rung.starts.filter(s => s.track === 'belfryEnding');
    check(b.length === 1 && Math.abs(b[0].when - RING) < .01 && Math.abs(b[0].offset - bell.from) < .01 && !b[0].node.loop,
      `the fourth ring starts belfry.ogg once, ${bell.from} s in (${JSON.stringify(b.map(s => [s.when, s.offset]))})`);
    const handoverAt = b[0].when + handover - b[0].offset;
    check(e.length === 1 && Math.abs(e[0].when - handoverAt) < 1e-9 && Math.abs(e[0].offset - (handover - endingFrom)) < 1e-9,
      `its ending is scheduled once on the audio clock, ${(handover - bell.from).toFixed(2)} s after it, from ${(handover - endingFrom).toFixed(2)} s in (${JSON.stringify(e.map(s => [+s.when.toFixed(4), +s.offset.toFixed(4)]))})`);
    {
      const at = b[0].when, ratio = (from, to, raw = bellRaw, rawFrom = bell.from) => Math.sqrt(power(rung.buffer, at + from, at + to) / power(raw, rawFrom + from, rawFrom + to)) / bellGain;
      const half = ratio(bell.enterOver / 2 - .2, bell.enterOver / 2 + .2), full = ratio(bell.enterOver + 1, 30);
      check(ratio(.2, .6) < .15 && Math.abs(half - .5) < .08 && Math.abs(full - 1) < .02,
        `it comes in slowly over ${bell.enterOver} s (${ratio(.2, .6).toFixed(2)}, ${half.toFixed(2)} halfway, ${full.toFixed(3)} after, at ${tuning.audio.recordedMusicDb.belfry} dB)`);
      check(bellSources.length === 2 && bellSources[0].t === RING && bellSources[1].t > handoverAt,
        'boarding, the look back and the storm never cut, seek or restart it; only its ending takes over');
      const H = handover - bell.from, across = ratio(H - .01, H + crossfade + .01), after = ratio(H + .1, LENGTH - 3, endingRaw, bell.from - endingFrom);
      check(Math.abs(across - 1) < .03 && Math.abs(after - 1) < .02,
        `no dip across the handover (${across.toFixed(3)} of belfry.ogg's level) and the ending at the same level after it (${after.toFixed(3)})`);
      const fade = ratio(LENGTH - 2, LENGTH - .02, endingRaw, bell.from - endingFrom);
      check(Math.abs(fade - 1) < .02 && power(rung.buffer, at + LENGTH + .01, RING + LENGTH + 4) === 0,
        `it slows and fades as the ending does (${fade.toFixed(3)}) to silence at ${bell.end} s, and nothing follows`);
    }
    check(bellPad < 1e-6, 'the shared pad stays silent under it');
    let blended = false, kept = null, keptSame = true;
    await render(10, t => ({ ...village('storm'), bellsRung: true, arrivalMusic: t >= 3 ? 'wood' : 'drowned' }), { watch: (t, sound) => {
      blended ||= sound.arrivalTransition.stage === 'blend';
      if (sound.belfryScore?.source) { kept ??= sound.belfryScore.source; keptSame &&= sound.belfryScore.source === kept; }
      else if (kept) keptSame = false;
    } });
    check(blended && keptSame, 'the wood\'s request near the forest beach never cuts it either');
    const saved = await render(2, () => ({ ...village('farewell'), bellsRung: true }));
    saved.starts = saved.starts.filter(s => s.track === 'belfry');
    check(saved.starts.length === 1 && saved.starts[0].when < 1e-6 && Math.abs(saved.starts[0].offset - bell.from) < .01,
      `a storm save starts it on load, with the same slow entrance (${JSON.stringify(saved.starts.map(s => [s.track, s.when, s.offset]))})`);
    const waiting = await render(2, () => village('refuge'));
    check(!waiting.starts.some(s => s.track === 'belfry'), 'in the belfry it waits for the fourth ring');
    const wood = await render(2, () => ({ ...baseState, ...ARRIVAL_MUSIC.wood }));
    check(!wood.starts.length, 'the wood does not play it');
    let back = null;
    const off = await render(10, t => ({ ...village('home'), bellsRung: true }), { setup: sound => sound.setMusicMuted(true), watch: (t, sound) => {
      if (t === 6) sound.setMusicMuted(false);
      back ??= sound.belfryScore?.source ? t : null;
    } });
    check(back === 6 + STEP && Math.abs(off.starts[0].offset - bell.from - 6 - STEP) < .01, `music switched on later joins it at its own time (${off.starts[0]?.offset} s in)`);

    // The storm and the wood: silent until the forest's drone, which enters at its own level.
    const W = 6;
    const forest = await render(W + 14, t => t < W + 8 ? { ...village('storm'), arrivalMusic: t >= W ? 'wood' : 'drowned', hush: .85, night: .9 }
      : { ...baseState, ...ARRIVAL_MUSIC.wood, night: .9, forestWind: true }, { background: true });
    check(power(forest.buffer, 0, W) === 0, 'the storm has no music');
    check(power(forest.buffer, W + 6, W + 14) > 1e-12, 'the wood\'s drone comes in at the forest');
    const drone = async droneDb => {
      const was = tuning.audio.woodDroneDb;
      tuning.audio.woodDroneDb = droneDb;
      try { return power((await render(14, () => ({ ...baseState, ...ARRIVAL_MUSIC.wood, night: .9 }), { background: true })).buffer, 8, 14); }
      finally { tuning.audio.woodDroneDb = was; }
    };
    const original = await drone(0), quietDrone = await drone(tuning.audio.woodDroneDb);
    check(Math.abs(db(quietDrone) - db(original) - tuning.audio.woodDroneDb) < .3,
      `the wood's drone sits ${(db(quietDrone) - db(original)).toFixed(2)} dB from its original level (woodDroneDb ${tuning.audio.woodDroneDb})`);
    check(await drone(-Infinity) === 0, 'woodDroneDb −Infinity silences it');
    return checks;
  });
  console.log(JSON.stringify({ checks }, null, 2));
} finally { await browser.close(); }

// The stairs' recording (`clouds.ogg`), rendered offline through the production soundscape: prepared in the white,
// begun `cloudsMusicDelay` after the view clears on top at half its level and full within `enterOver`, never restarted by phases or
// music mute, faded out by 3:28, and the drowned village's music held until that fade is done, whether the fog or
// the village itself comes first. Also the start downloads, a late join after music mute, silence and the pad.
// Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
try {
  const checks = await page.evaluate(async () => {
    const { tuning } = await productionModule('/src/tuning.ts');
    const { RecordedScore } = await productionModule('/src/audio/recorded-score.ts');
    const { musicForStart, nextMusicForChapter } = await productionModule('/src/audio/music-loading.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const RATE = 24000, STEP = 1 / 8, once = tuning.audio.recordedMusicOnce.clouds;
    const gain = 10 ** (tuning.audio.recordedMusicDb.clouds / 20);
    const starts = new WeakMap();
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      if (this.buffer?.duration > 260) (starts.get(this.context) ?? starts.set(this.context, []).get(this.context)).push({ when, offset, node: this });
      return native.call(this, when, offset, duration);
    };
    const power = (buffer, from, to) => {
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let sum = 0;
      for (let i = Math.ceil(from * buffer.sampleRate); i < Math.floor(to * buffer.sampleRate); i++) sum += (left[i] ** 2 + right[i] ** 2) / 2;
      return sum / Math.max(1, (to - from) * buffer.sampleRate);
    };

    check(musicForStart('stairs') === 'birches' && musicForStart('clouds') === 'birches', 'a stairs start fetches the birches first');
    check(musicForStart('cloud') === 'clouds' && musicForStart({ chapter: 'stairs', point: 'cloud' }) === 'clouds',
      'a start past the loop fetches clouds.ogg instead');
    check(['birches', 'toStairs', 'stairs'].every(c => nextMusicForChapter(c) === 'clouds') && nextMusicForChapter('meadow') === 'birches',
      'clouds.ogg is the next download from Birches on, once the birches recording is in hand');

    const air = phase => ({ phase, cloud: phase === 'cloud' ? 1 : 0, climb: phase === 'under' ? 0 : 1,
      open: phase === 'under' || phase === 'cloud' ? 0 : 1, fog: phase === 'fog' ? 1 : 0, speed: phase === 'sail' || phase === 'fog' ? 4 : 0,
      clear: phase !== 'under' && phase !== 'cloud' });
    const stairs = phase => ({ ...baseState, music: 'birches', birchesScore: 'return', hush: .35, stairsAir: air(phase),
      arrivalMusic: phase === 'fog' || phase === 'down' ? 'drowned' : undefined });
    const village = () => ({ ...baseState, music: 'drowned', drownedScore: 'drift', hush: .3, arrivalMusic: 'drowned' });
    // Drive a soundscape through `seconds`, `state(t)` each eighth of a second; `watch(t, sound)` after each update.
    const render = async (seconds, state, watch = () => {}) => {
      const { ctx, sound } = offlineSound(seconds);
      sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
      const wet = ctx.createChannelMerger(2);
      sound.wetDuck.disconnect(); sound.wetDuck.connect(wet, 0, 1); wet.connect(ctx.destination);
      const step = async t => {
        sound.update(STEP, state(t));
        await sound.preparedScore?.ready; await sound.cloudsScore?.ready; await sound.birchesScore?.ready; await sound.villageScore?.ready;
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

    // Restored past the loop, up through the white, out on top at 3 s, sailing at 8, fog at 12; music muted 12.5 to 16.5.
    // The view clears on the first frame out on top here; the recording begins `cloudsMusicDelay` after that.
    const TOP = 3, START = TOP + tuning.audio.cloudsMusicDelay;
    let prepared = null, birchesInWhite = false, source = null, same = true, pad = 0;
    const top = await render(20, t => {
      return stairs(t < TOP ? 'cloud' : t < 8 ? 'above' : t < 12 ? 'sail' : 'fog');
    }, (t, sound) => {
      if (t < TOP) { prepared ??= sound.preparedScore?.track; birchesInWhite ||= !!sound.birchesScore; }
      if (t === 12.5) sound.setMusicMuted(true);
      if (t === 16.5) sound.setMusicMuted(false);
      if (sound.cloudsScore?.source) { source ??= sound.cloudsScore.source; same &&= sound.cloudsScore.source === source; }
      if (t >= TOP) pad = Math.max(pad, sound.padGain.gain.value);
    });
    check(prepared === 'clouds', 'clouds.ogg is decoded in the white, before they reach the top');
    check(!birchesInWhite, 'the birches recording never starts up in the white (it stops there)');
    check(top.starts.length === 1 && Math.abs(top.starts[0].when - START) < STEP / 2 && top.starts[0].offset < .01,
      `clouds.ogg starts from its top ${tuning.audio.cloudsMusicDelay} s after the view clears on top (${JSON.stringify(top.starts.map(s => [s.when, s.offset]))})`);
    check(!top.starts[0].node.loop, 'it plays once, not looped');
    check(same && top.sound.cloudsScore?.source === source, 'sail, fog and music mute never restart or seek it');
    check(pad < 1e-6, 'the shared pad stays silent under it');
    // Compare the output with the source itself to read the entrance's gain.
    const raw = top.sound.cloudsScore.source.buffer;
    const at = top.starts[0].when - top.starts[0].offset;
    const ratio = (from, to) => Math.sqrt(power(top.buffer, at + from, at + to) / power(raw, from, to));
    const entering = ratio(.55, .75) / gain, full = ratio(2.2, 4.5) / gain;
    const expected = once.enterFrom + (1 - once.enterFrom) * (.65 / once.enterOver);
    check(Math.abs(entering - expected) < .05, `it enters at half level, rising (${entering.toFixed(3)} of full at 0.65 s, ${expected.toFixed(3)} expected)`);
    check(Math.abs(full - 1) < .02, `full level (${tuning.audio.recordedMusicDb.clouds} dB) once entered (${full.toFixed(3)})`);
    check(power(top.buffer, 15.5, 16.5) < 1e-12 && power(top.buffer, 18, 19.5) > 1e-8,
      'music mute silences it and its clock runs on underneath');
    check(top.sound.arrivalTransition.stage === 'wait', 'the fog asks for the village, which waits');

    // The end: from 3:20, faded to nothing by 3:28.3.
    {
      const ctx = new OfflineAudioContext(2, 12 * RATE, RATE);
      const score = new RecordedScore(ctx, ctx.destination, 'clouds');
      await score.ready;
      score.update('top', 1, 200, true);
      const buffer = await ctx.startRendering();
      check(power(buffer, 5, 6) > 1e-6 && power(buffer, 7.6, 8.2) < power(buffer, 5, 6) / 4,
        'the last phrase plays to 3:26 and fades');
      check(power(buffer, once.end - 200 + .01, 12) === 0, `silent from ${once.end} s, before the next phrase at 208.42`);
    }

    // The village's music waits for the end fade, whether the fog or the village water comes first. Shortened end.
    const end = once.end;
    once.end = 14;
    try {
      let drownedFrom = null, cloudsGoneAt = null, doubled = false, stages = [];
      const held = await render(30, t => t < 1 ? stairs('cloud') : t < 5 ? stairs('above') : t < 8 ? stairs('fog')
        : t < 9 ? stairs('down') : village(), (t, sound) => {
        const stage = sound.arrivalTransition.stage;
        if (stages.at(-1)?.stage !== stage) stages.push({ t, stage });
        if (sound.villageScore && drownedFrom === null) drownedFrom = t;
        if (!sound.cloudsScore && cloudsGoneAt === null && t > 2) cloudsGoneAt = t;
        doubled ||= !!sound.cloudsScore && !!sound.villageScore;
      });
      const clouds = held.starts[0].when, until = clouds + 14;
      check(stages.find(s => s.stage === 'wait')?.t === 5 && !stages.some(s => s.stage === 'fade'),
        `the fog's request waits with no fade of its own (${JSON.stringify(stages)})`);
      check(power(held.buffer, 6, 12) > 1e-7 && power(held.buffer, until - 1.5, until - .5) > 0,
        'the recording plays on through the fog and onto the village water');
      check(Math.abs(stages.find(s => s.stage === 'gap').t - until) <= STEP, `the rest begins as its fade ends (${until.toFixed(2)} s)`);
      check(cloudsGoneAt <= until + STEP && !doubled, 'the recording is released before the village music, never both');
      const entry = stages.find(s => s.stage === 'incoming')?.t;
      check(Math.abs(entry - until - tuning.audio.arrivalQuiet) <= STEP && drownedFrom === entry, `village_approach.ogg starts as the rest ends (${drownedFrom} s)`);
      check(power(held.buffer, until + .2, until + tuning.audio.arrivalQuiet) < 1e-12 && power(held.buffer, 25, 29) > 1e-7,
        'a silent rest, then the village');

      // Ended before the fog: the ordinary handoff, straight away.
      once.end = 4;
      stages = []; drownedFrom = null;
      await render(16, t => stairs(t < 1 ? 'cloud' : t < 7 ? 'above' : 'fog'), (t, sound) => {
        const stage = sound.arrivalTransition.stage;
        if (stages.at(-1)?.stage !== stage) stages.push({ t, stage });
        if (sound.villageScore && drownedFrom === null) drownedFrom = t;
      });
      check(stages.find(s => s.stage === 'fade')?.t === 7 && !stages.some(s => s.stage === 'wait'),
        `a recording already over leaves the fog's handoff as it was (${JSON.stringify(stages)})`);
      check(drownedFrom !== null && drownedFrom <= 7 + tuning.audio.arrivalFadeOut + tuning.audio.arrivalQuiet + 2 * STEP, `and the village music follows (${drownedFrom}, ${JSON.stringify(stages)})`);
    } finally { once.end = end; }

    // Music off when they reach the top, on 6 s later: it joins at its own time, without the entrance.
    let joined = null;
    const late = await render(12, t => stairs(t < 1 ? 'cloud' : 'above'), (t, sound) => {
      if (t === 0) sound.setMusicMuted(true);
      if (t === 7) sound.setMusicMuted(false);
      joined ??= sound.cloudsScore?.source ? t : null;
    });
    check(joined === 7 + STEP && Math.abs(late.starts[0].offset - (7 + STEP - 1 - tuning.audio.cloudsMusicDelay)) < .01, `music switched on later joins at its own time (${late.starts[0]?.offset} s in)`);

    let cut = null;
    const silent = await render(8, t => ({ ...stairs(t < 1 ? 'cloud' : 'above'), silence: t >= 4 }), (t, sound) => {
      if (t >= 4 && cut === null && !sound.cloudsScore) cut = t;
    });
    check(cut === 4 && power(silent.buffer, 4.5, 8) === 0, 'permanent silence leaves no tail');
    return checks;
  });
  console.log(JSON.stringify({ checks }, null, 2));
} finally { await browser.close(); }

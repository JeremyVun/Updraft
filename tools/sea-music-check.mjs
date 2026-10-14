// The open sea's recording (`sea.ogg`): cut points, silence from the break, whole phrases in order as the rescue's acts
// begin, the wait between quick acts, no restarts, the release, restores, gates and the Sleeping handoff, rendered offline. The timing in the real game is
// `sea-music-browser-check.mjs`. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
let offline;
try {
  offline = await page.evaluate(async () => {
    const { SeaMusic, SEA_PHRASES, SEA_INTRO_END } = await productionModule('/src/audio/sea-music.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const checks = [], check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const RATE = 24000, STEP = 1 / 8;
    const starts = new WeakMap();
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      (starts.get(this.context) ?? starts.set(this.context, []).get(this.context)).push({ when, offset, duration });
      return native.call(this, when, offset, duration);
    };
    const power = (buffer, from, to) => {
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let sum = 0;
      for (let i = Math.ceil(from * buffer.sampleRate); i < Math.floor(to * buffer.sampleRate); i++) sum += (left[i] ** 2 + right[i] ** 2) / 2;
      return sum / Math.max(1, (to - from) * buffer.sampleRate);
    };
    const db = p => 10 * Math.log10(p + 1e-20);
    // Drive one SeaMusic through `seconds` of story, `cue(t)` giving [recording time, phrase] each eighth of a second.
    const render = async (seconds, cue) => {
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
      const music = new SeaMusic(ctx, ctx.destination);
      await music.ready;
      const update = t => { const [time, phrase] = cue(t); music.update(time, phrase, 1); };
      update(0);
      let pause = ctx.suspend(STEP); const rendering = ctx.startRendering();
      for (let tick = 1; tick < seconds / STEP; tick++) {
        await pause; update(tick * STEP);
        if (tick + 1 < seconds / STEP) pause = ctx.suspend((tick + 1) * STEP);
        await ctx.resume();
      }
      return { music, buffer: await rendering, starts: starts.get(ctx) ?? [] };
    };

    // The supplied recording and its cut points, each in the quiet just before the next attack.
    const sourceCtx = new OfflineAudioContext(2, RATE, RATE);
    const source = new SeaMusic(sourceCtx, sourceCtx.destination);
    await source.ready;
    const original = source.buffer;
    check(original && Math.abs(original.duration - 236.62) < .05, `sea: the supplied recording decodes whole (${original.duration.toFixed(2)} s)`);
    const phrases = SEA_PHRASES.filter(Boolean);
    const cuts = [SEA_INTRO_END, ...phrases.slice(1).map(([from]) => from)];
    const rises = cuts.map(at => db(power(original, at + .005, at + .12)) - db(power(original, at - .04, at)));
    check(rises.every(rise => rise > 5), `sea: every phrase begins just before an attack (rises ${rises.map(r => r.toFixed(1)).join(', ')} dB)`);
    check(phrases.every(([from, to], i) => from < Math.min(to, original.duration) && (i === 0 || from >= phrases[i - 1][1])),
      'sea: phrases are ordered within the recording');
    check(db(power(original, 54.5, SEA_INTRO_END - .03)) < db(power(original, 28, 53)) - 25,
      'sea: the crossing has died away by the break');
    source.stop(0);

    // The crossing ends at the break and nothing plays at rest; each act then plays its whole phrase once.
    const steps = [[62, 0], [80, 1], [96, 2], [112, 3], [128, 4], [146, 5]];
    const run = await render(152, t => [t, steps.reduce((p, [at, phrase]) => t >= at ? phrase : p, -1)]);
    const expect = [[0, 0], ...steps.filter(([, phrase]) => SEA_PHRASES[phrase]).map(([at, phrase]) => [at, SEA_PHRASES[phrase][0]])];
    check(run.starts.length === expect.length, `sea: six clips for the passage, never restarted (${run.starts.length})`);
    check(run.starts.every(({ when, offset }, i) => Math.abs(when - expect[i][0]) <= STEP + 1e-6 && Math.abs(offset - expect[i][1]) < 1e-6),
      'sea: crossing, silence at rest, then the four wind phrases as the net, the fold, her pull and the cygnet\'s pull begin, then the close once free');
    check(run.starts.slice(1, 5).every(({ duration }, i) => Math.abs(duration - (SEA_PHRASES[i + 1][1] - SEA_PHRASES[i + 1][0])) < 1e-6),
      'sea: each rescue phrase plays whole');
    check(db(power(run.buffer, SEA_INTRO_END + .05, 79.9)) < -90, 'sea: silence from the break until the first act');
    check(db(power(run.buffer, 80.1, 84)) > -40, 'sea: the first phrase starts as the net lifts');
    const endOfLast = 128 + SEA_PHRASES[4][1] - SEA_PHRASES[4][0];
    check(db(power(run.buffer, endOfLast + .02, 145.95)) < -90 && db(power(run.buffer, 147, 151)) > -40,
      'sea: the last phrase ends faded, and the release plays the recording\'s close');

    // Coming to rest early changes nothing: the crossing still ends at the break.
    const early = await render(72, t => [t, t >= 40 ? 0 : -1]);
    check(early.starts.length === 1 && db(power(early.buffer, SEA_INTRO_END + .05, 71.9)) < -90,
      'sea: a rest before the break plays nothing over or after the crossing');

    // A quick rescue: each act begun while the last phrase sounds joins it where it ends, and the whole run is the
    // recording itself, from the first phrase through the close.
    const quick = await render(40, t => [100 + t, t >= 6 ? 5 : t >= 4.5 ? 4 : t >= 3 ? 3 : t >= 1.5 ? 2 : t > 0 ? 1 : 0]);
    const first = quick.starts[0]?.when ?? 0;
    check(quick.starts.length === 5 && quick.starts.every(({ when, offset }) => Math.abs(when - first - (offset - SEA_PHRASES[1][0])) < 1e-6),
      'sea: a quick act\'s phrase begins exactly where the last one ends');
    const out = quick.buffer.getChannelData(0), ref = original.getChannelData(0);
    let error = 0, reference = 0;
    const shift = SEA_PHRASES[1][0] - first;
    for (let i = Math.ceil((first + .1) * RATE); i < 39 * RATE; i++) { const j = i + Math.round(shift * RATE); error += (out[i] - ref[j]) ** 2; reference += ref[j] ** 2; }
    check(error / reference < 1e-4, `sea: a quick rescue plays the recording unbroken (error ${(error / reference).toExponential(1)})`);

    // A phrase that does not follow the last one in the recording waits for it to end.
    const apart = await render(12, t => [100 + t, t >= 2 ? 5 : t > 0 ? 3 : 2]);
    check(apart.starts.length >= 2 && apart.starts[1].offset === SEA_PHRASES[4][0], 'sea: phrases always play in order');

    // Restores: at rest silent; mid-rescue silent until the next act; free or gone the close from its start.
    const restRestore = await render(3, () => [84.4, 0]);
    check(restRestore.starts.length === 0, 'sea: a save at rest stays silent until the first act');
    const midRestore = await render(6, t => [100 + t, t >= 3 ? 3 : 2]);
    check(midRestore.starts.length === 1 && Math.abs(midRestore.starts[0].when - 3) <= STEP && midRestore.starts[0].offset === SEA_PHRASES[3][0],
      'sea: a save mid-rescue stays silent until the next act plays its phrase');
    const goneRestore = await render(3, () => [200, 5]);
    check(goneRestore.starts.length === 1 && goneRestore.starts[0].offset === SEA_PHRASES[5][0], 'sea: a save after the release plays the close from its start');
    const swimRestore = await render(3, () => [30, -1]);
    check(swimRestore.starts.length === 1 && swimRestore.starts[0].offset === 30, 'sea: a resumed passage joins the crossing at its own time');

    // Through the soundscape: the Sleeping morning leaves before the recording begins on the passage clock.
    const { ctx, sound } = offlineSound(40);
    sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
    const lead = tuning.audio.seaMusicLead, departAt = 2;
    const morning = { ...baseState, music: 'wood', sleepingScore: 'morning', hush: .1, sea: 1 };
    const passage = t => ({ ...baseState, music: 'sea', seaScore: 'open', arrivalMusic: 'sea', arrivalReady: true, sea: 1,
      seaMusicTime: t - departAt - lead, seaPhrase: -1, whaleCalling: t >= 14 && t < 18 ? 1 : 0 });
    let gateAtStart = null, pad = 0, duckedLevel = null, openLevel = null, introAt = null;
    const update = t => {
      if (t === 24) sound.setMusicMuted(true);
      if (t === 28) sound.setMusicMuted(false);
      sound.update(STEP, t < departAt ? morning : { ...passage(t), silence: t >= 34 });
      if (sound.seaMusic?.voice && introAt === null) { introAt = t; gateAtStart = sound.backgroundGate.gain.value; }
      if (t > departAt + 1) pad = Math.max(pad, sound.padGain.gain.value);
      if (t === 17.5) duckedLevel = sound.seaMusic.output.gain.value;
      if (t === 22) openLevel = sound.seaMusic.output.gain.value;
    };
    update(0);
    let pause = ctx.suspend(STEP); const rendering = ctx.startRendering();
    let decoded = false;
    for (let tick = 1; tick < 40 / STEP; tick++) {
      await pause; update(tick * STEP);
      if (sound.seaMusic && !decoded) { await sound.seaMusic.ready; decoded = true; }
      if (tick + 1 < 40 / STEP) pause = ctx.suspend((tick + 1) * STEP);
      await ctx.resume();
    }
    const mix = await rendering;
    check(introAt !== null && Math.abs(introAt - departAt - lead) <= STEP, `sea: the recording begins ${lead} s into the passage`);
    check(gateAtStart > .99, 'sea: the morning has faded and the gates are open before the recording begins');
    check(db(power(mix, departAt + 3.2, departAt + lead - .05)) < -90, 'sea: a short rest separates the morning from the sea');
    check(pad < 1e-4, 'sea: the generic pad stays silent at sea');
    const room = 20 * Math.log10(duckedLevel / openLevel);
    check(Math.abs(room - tuning.audio.whaleCallRoomDb) < .5, `sea: the recording makes ${room.toFixed(1)} dB room under a whale call`);
    check(db(power(mix, 27, 27.9)) < -100 && db(power(mix, 30, 32)) > -60, 'sea: music mute silences the recording without stopping its clock');
    check(db(power(mix, 36, 39)) < -100 && !sound.seaMusic, 'sea: permanent silence retires the recording');
    return checks;
  });
} finally { await browser.close(); }

console.log(JSON.stringify({ checks: offline }, null, 2));

// The open sea's recording (`sea.ogg`): cut points, silence from the break until the net first lifts (or the crossing
// carried straight on if it lifts sooner), the rescue's bed going round for a slow rescue, the release at the end of
// the phrase the cygnet's pull began in and its ending, restores, gates and the Sleeping handoff, rendered offline. The timing in the real game is
// `sea-music-browser-check.mjs`. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
let offline;
try {
  offline = await page.evaluate(async () => {
    const { SeaMusic, SEA_CROSSING_END, SEA_BED, SEA_RELEASE, SEA_SEAM_FADE } = await productionModule('/src/audio/sea-music.ts');
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
    const near = (a, b, within = 1e-3) => Math.abs(a - b) <= within;
    // Drive one SeaMusic through `seconds` of story, `cue(t)` giving [recording time, rescue] each eighth of a second.
    const render = async (seconds, cue) => {
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
      const music = new SeaMusic(ctx, ctx.destination);
      await music.ready;
      const update = t => { const [time, rescue] = cue(t); music.update(time, rescue, 1); };
      update(0);
      let pause = ctx.suspend(STEP); const rendering = ctx.startRendering();
      for (let tick = 1; tick < seconds / STEP; tick++) {
        await pause; update(tick * STEP);
        if (tick + 1 < seconds / STEP) pause = ctx.suspend((tick + 1) * STEP);
        await ctx.resume();
      }
      return { music, buffer: await rendering, starts: starts.get(ctx) ?? [] };
    };
    const same = (out, original, from, to, shift) => {
      const o = out.getChannelData(0), r = original.getChannelData(0);
      let error = 0, reference = 0;
      for (let i = Math.ceil(from * RATE); i < Math.floor(to * RATE); i++) { const j = i + Math.round(shift * RATE); error += (o[i] - r[j]) ** 2; reference += r[j] ** 2; }
      return error / reference;
    };

    // The supplied recording and its cut points, each in the quiet just before an attack.
    const sourceCtx = new OfflineAudioContext(2, RATE, RATE);
    const source = new SeaMusic(sourceCtx, sourceCtx.destination);
    await source.ready;
    const original = source.buffer;
    check(original && Math.abs(original.duration - 236.62) < .05, `sea: the supplied recording decodes whole (${original.duration.toFixed(2)} s)`);
    const cuts = [...SEA_BED, SEA_RELEASE.from];
    const rises = cuts.map(at => db(power(original, at + .005, at + .12)) - db(power(original, at - .04, at)));
    check(rises.every(rise => rise > 5), `sea: the bed's phrases and the release begin just before an attack (rises ${rises.map(r => r.toFixed(1)).join(', ')} dB)`);
    check(SEA_BED[0] === SEA_CROSSING_END, 'sea: the bed is what follows the crossing in the recording');
    check(db(power(original, 54.5, SEA_CROSSING_END - .03)) < db(power(original, 28, 53)) - 25, 'sea: the crossing has died away by the break');
    check(SEA_RELEASE.to <= 188.3, 'sea: the release ends as its theme resolves, before the recording thickens at 3:08');
    source.stop(0);

    // A prompt rescue: the crossing ends in the break as the boat comes to rest and nothing plays until the net first
    // lifts; the bed then plays its four phrases and goes round, and the release follows the phrase the cygnet's pull
    // began in.
    const stir = 58, pull = 98;
    const run = await render(150, t => [t, t < stir ? 'coming' : t < pull ? 'rescue' : 'freeing']);
    const offsets = run.starts.map(c => c.offset);
    check(offsets.join() === [0, ...SEA_BED.slice(0, 4), SEA_BED[0], SEA_BED[1], SEA_RELEASE.from].join(),
      `sea: crossing, the bed's four phrases, round again, the release (${offsets.map(o => o.toFixed(2)).join(', ')})`);
    check(db(power(run.buffer, SEA_CROSSING_END + .05, stir - .05)) < -90 && near(run.starts[1].when, stir, STEP + 1e-6),
      'sea: silence from the break until the net first lifts, and the bed enters then');
    check(run.starts.slice(2).every((c, i) => near(c.when, run.starts[i + 1].when + run.starts[i + 1].duration)),
      'sea: from there each section begins exactly as the last ends: nothing waits, nothing overlaps');
    const bedAt = run.starts[1].when;
    check(same(run.buffer, original, bedAt + .05, bedAt + SEA_BED[4] - SEA_BED[0] - SEA_SEAM_FADE - .02, SEA_BED[0] - bedAt) < 1e-4,
      'sea: the bed\'s first round is the recording as written');
    const loopAt = bedAt + SEA_BED[4] - SEA_BED[0], releaseAt = run.starts.at(-1).when;
    check(db(power(run.buffer, loopAt - .05, loopAt)) < db(power(original, SEA_BED[4] - .05, SEA_BED[4])) - 6,
      'sea: going round, the last phrase eases off before the first phrase\'s attack');
    const previous = run.starts.at(-2);
    check(releaseAt >= pull && near(releaseAt, previous.when + previous.duration) && releaseAt - pull < SEA_BED[3] - SEA_BED[2] + .01,
      `sea: the release waits for the phrase the pull began in to end (${(releaseAt - pull).toFixed(2)} s)`);
    const releaseEnd = releaseAt + SEA_RELEASE.to - SEA_RELEASE.from;
    check(same(run.buffer, original, releaseAt + .05, releaseEnd - SEA_RELEASE.fade - .05, SEA_RELEASE.from - releaseAt) < 1e-4,
      'sea: the release plays the close as written');
    check(db(power(run.buffer, releaseEnd - .2, releaseEnd)) < db(power(run.buffer, releaseAt + 1, releaseAt + 26)) - 30,
      'sea: the release fades out on its resolution');
    check(db(power(run.buffer, releaseEnd + .02, 149.9)) < -90, 'sea: after the release, silence: nothing goes round again');

    // The net lifted before the break: the crossing carries straight on into the bed, as the recording does.
    const early = await render(90, t => [t, t < 55.4 ? 'coming' : 'rescue']);
    check(early.starts[1]?.offset === SEA_BED[0] && near(early.starts[1].when, SEA_CROSSING_END)
      && same(early.buffer, original, .2, SEA_BED[4] - SEA_SEAM_FADE - .02, 0) < 1e-4,
      'sea: begun before the break, the crossing runs on into the bed unbroken');

    // A slow rescue keeps going round the bed, never cut and never gapped.
    const slow = await render(200, t => [t, t < 60 ? 'coming' : 'rescue']);
    check(slow.starts.slice(2).every((c, i) => near(c.when, slow.starts[i + 1].when + slow.starts[i + 1].duration))
      && slow.starts.filter(c => c.offset === SEA_BED[0]).length >= 5, 'sea: a slow rescue goes round the bed without a gap');

    // Restores: at rest silent until the net lifts; mid-rescue the bed from its first phrase; being freed the release at once; gone silent;
    // a resumed passage joins the crossing at its own time.
    const restRestore = await render(3, () => [84.4, 'coming']);
    check(restRestore.starts.length === 0, 'sea: a save at rest stays silent until the net first lifts');
    const midRestore = await render(3, () => [84.4, 'rescue']);
    check(midRestore.starts.length === 1 && midRestore.starts[0].offset === SEA_BED[0] && midRestore.starts[0].when < STEP + 1e-6,
      'sea: a save mid-rescue begins the bed from its first phrase');
    const freeRestore = await render(3, () => [200, 'freeing']);
    check(freeRestore.starts.length === 1 && freeRestore.starts[0].offset === SEA_RELEASE.from, 'sea: a save once it is free plays the release from its start');
    const goneRestore = await render(3, () => [200, 'gone']);
    check(goneRestore.starts.length === 0, 'sea: a save after the whale has gone stays silent');
    const swimRestore = await render(3, () => [30, 'coming']);
    check(swimRestore.starts.length === 1 && swimRestore.starts[0].offset === 30, 'sea: a resumed passage joins the crossing at its own time');

    // Through the soundscape: the Sleeping morning leaves before the recording begins on the passage clock.
    const { ctx, sound } = offlineSound(40);
    sound.master.disconnect(); sound.musicDryGain.connect(ctx.destination);
    const lead = tuning.audio.seaMusicLead, departAt = 2;
    const morning = { ...baseState, music: 'wood', sleepingScore: 'morning', hush: .1, sea: 1 };
    const passage = t => ({ ...baseState, music: 'sea', seaScore: 'open', arrivalMusic: 'sea', arrivalReady: true, sea: 1,
      seaMusicTime: t - departAt - lead, seaRescue: 'coming', whaleCalling: t >= 14 && t < 18 ? 1 : 0 });
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

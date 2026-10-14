// The open sea's recording (`sea.ogg`): cut points, the hold at the break, phrase order on the rescue's steps, no
// restarts, the release, restores, gates and the Sleeping handoff, rendered offline. The timing in the real game is
// `sea-music-browser-check.mjs`. Vite on 5230, or BASE.
import { audioPage } from './lib/audio-render.mjs';

const { browser, page } = await audioPage();
let offline;
try {
  offline = await page.evaluate(async () => {
    const { SeaMusic, SEA_PHRASES, SEA_INTRO_END, SEA_BREAK } = await productionModule('/src/audio/sea-music.ts');
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
    const cuts = [SEA_INTRO_END, ...SEA_PHRASES.slice(1).map(([from]) => from)];
    const rises = cuts.map(at => db(power(original, at + .005, at + .12)) - db(power(original, at - .04, at)));
    check(rises.every(rise => rise > 5), `sea: every phrase begins just before an attack (rises ${rises.map(r => r.toFixed(1)).join(', ')} dB)`);
    check(SEA_PHRASES.every(([from, to], i) => from < Math.min(to, original.duration) && (i === 0 || from >= SEA_PHRASES[i - 1][1])),
      'sea: phrases are ordered within the recording');
    check(db(power(original, SEA_BREAK, SEA_INTRO_END - .03)) < db(power(original, 28, 53)) - 25,
      'sea: the crossing has died away by the break');
    source.stop(0);

    // Coming to rest late: the crossing plays to the break, waits in silence, then each step plays its phrase once.
    const steps = [[62, 0], [80, 1], [96, 2], [112, 3], [128, 4], [146, 5]];
    const late = await render(152, t => [t, steps.reduce((p, [at, phrase]) => t >= at ? phrase : p, -1)]);
    const expect = [[0, 0], ...steps.map(([at, phrase]) => [at, SEA_PHRASES[phrase][0]])];
    check(late.starts.length === expect.length, `sea: seven clips for the passage, never restarted (${late.starts.length})`);
    check(late.starts.every(({ when, offset }, i) => Math.abs(when - expect[i][0]) <= STEP + 1e-6 && Math.abs(offset - expect[i][1]) < 1e-6),
      'sea: crossing, then A at rest and B to E on the breath, eye, line and heave, then the close once free');
    check(db(power(late.buffer, SEA_INTRO_END + .05, 61.9)) < -90, 'sea: the recording waits in silence at the break');
    check(db(power(late.buffer, 62.1, 66)) > -40, 'sea: phrase A starts as the boat comes to rest');
    const endOfE = 128 + SEA_PHRASES[4][1] - SEA_PHRASES[4][0];
    check(db(power(late.buffer, endOfE - 1.6, endOfE - 1.5)) > db(power(late.buffer, endOfE - .2, endOfE)) + 6
      && db(power(late.buffer, endOfE + .02, 145.95)) < -90 && db(power(late.buffer, 147, 151)) > -40,
      'sea: E closes on its held note, and the release plays the recording\'s close');

    // Coming to rest early: A follows the crossing on the recording's own beat, sample-continuous.
    const early = await render(72, t => [t, t >= 40 ? 0 : -1]);
    check(early.starts.length === 2 && Math.abs(early.starts[1].when - SEA_INTRO_END) < 1e-6 && early.starts[1].offset === SEA_INTRO_END,
      'sea: a rest before the break leaves A to begin where the recording reaches it');
    const out = early.buffer.getChannelData(0), ref = original.getChannelData(0);
    let error = 0, reference = 0;
    for (let i = 57 * RATE; i < 70 * RATE; i++) { error += (out[i] - ref[i]) ** 2; reference += ref[i] ** 2; }
    check(error / reference < 1e-6, 'sea: across the break the crossing and A are the recording itself');

    // Coming to rest in the break cuts only its silence short.
    const inBreak = await render(62, t => [t, t >= 55 ? 0 : -1]);
    check(inBreak.starts.length === 2 && Math.abs(inBreak.starts[1].when - 55) <= STEP && inBreak.starts[1].offset === SEA_PHRASES[0][0],
      'sea: a rest in the break starts A at once');

    // A step finished within the spacing waits for it; a phrase already sounding is never started again.
    const quick = await render(12, t => [100 + t, t >= 2 ? 1 : 0]);
    check(quick.starts.length === 2 && quick.starts[1].when >= tuning.audio.seaPhraseSpacing - 1e-6
      && quick.starts[1].when <= tuning.audio.seaPhraseSpacing + STEP, 'sea: the next phrase begins over the last one\'s tail after the spacing');

    // Restores: at rest A at once; mid-rescue silent until the next step; free or gone the close from its start.
    const restRestore = await render(3, () => [84.4, 0]);
    check(restRestore.starts.length === 1 && restRestore.starts[0].offset === SEA_PHRASES[0][0] && restRestore.starts[0].when < STEP,
      'sea: a save at rest starts A on load, without the crossing');
    const midRestore = await render(6, t => [100 + t, t >= 3 ? 3 : 2]);
    check(midRestore.starts.length === 1 && Math.abs(midRestore.starts[0].when - 3) <= STEP && midRestore.starts[0].offset === SEA_PHRASES[3][0],
      'sea: a save mid-rescue stays silent until the next step plays its phrase');
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

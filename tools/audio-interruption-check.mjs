// Audio lifecycle: story cues through an interruption (a call, Siri), piano voices across mute, the cached output
// graph, Begin synthesis spread over frames, the foghorn prepared before the storm and the pinwheel voice retiring.
// node tools/audio-interruption-check.mjs [/tmp/updraft-audio-interruption.json] (Vite on 5230, or BASE; no GPU).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage } from './lib/audio-render.mjs';

const evidence = process.argv[2] ?? '/tmp/updraft-audio-interruption.json';
const { browser, page } = await audioPage();
try {
  const report = await page.evaluate(async () => {
    const checks = [], metrics = {};
    const check = (ok, message) => { if (!ok) throw Error(message); checks.push(message); };
    const settle = async (ok, message) => {
      for (let i = 0; i < 300 && !ok(); i++) await new Promise(resolve => setTimeout(resolve, 10));
      check(ok(), message);
    };
    const { tuning } = await productionModule('/src/tuning.ts');
    const { Sliced } = await productionModule('/src/audio/sliced.ts');
    const { foghornParts } = await productionModule('/src/audio/foghorn.ts');
    const { Soundscape, PianoStrings } = audioModule;

    // A call or Siri suspends a visible, unmuted real-time context; the system refuses to resume until it ends.
    const sound = new Soundscape();
    sound.start();
    const ctx = sound.ctx;
    await settle(() => ctx.state === 'running', 'Begin creates and resumes a real-time context');
    const pause = () => new Promise(resolve => setTimeout(resolve, 50));
    // Let the context's own start-up statechange pass before simulating calls.
    await pause();
    const heard = [];
    for (const name of ['phrase', 'peep', 'bugle', 'flare', 'foghorn']) {
      sound[name] = cue => { heard.push(typeof cue === 'string' ? cue : name); return null; };
    }
    const frame = (cues = []) => sound.update(1 / 60, { ...baseState, cues });
    const wait = seconds => { for (let i = 0; i < Math.round(seconds * 60); i++) frame(); };
    const nativeResume = ctx.resume.bind(ctx);
    let attempts = 0, callOver = true;
    ctx.resume = () => { attempts++; return callOver ? nativeResume() : Promise.resolve(); };
    const call = async () => {
      callOver = false;
      const before = attempts;
      await ctx.suspend();
      await settle(() => attempts > before, 'An unexpected suspension retries resume from statechange');
      await pause();
    };
    const hangUp = async () => {
      callOver = true;
      window.dispatchEvent(new Event('focus'));
      await settle(() => sound.running, 'Audio runs again once the interruption ends');
    };

    frame(['delight']);
    check(heard.join() === 'delight', 'A cue plays at once while audio runs');
    heard.length = 0;
    await call();
    check(!sound.running && sound.output === null, 'Interrupted audio is not running and offers no output graph');
    frame(['restored']);
    wait(2);
    frame(['foghorn']);
    frame(['unfold']);
    wait(1.5);
    frame(['delight']);
    check(heard.length === 0, 'Nothing plays while the interruption lasts');
    const retries = attempts;
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new PointerEvent('pointerdown'));
    window.dispatchEvent(new PointerEvent('pointerup'));
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
    check(attempts === retries + 4, 'Focus, pointer press, pointer release and pageshow each retry resume');
    await hangUp();
    frame(['home']);
    check(heard.join() === 'unfold,delight,home',
      `Held cues younger than ${tuning.audio.heldCueLife} s play in order before the frame's own; stale ones drop (${heard.join()})`);

    heard.length = 0;
    await call();
    frame(['foghorn']);
    wait(0.1);
    await hangUp();
    frame();
    check(heard.join() === 'foghorn', 'A horn held within its lateness allowance still sounds');

    heard.length = 0;
    await call();
    frame(['delight']);
    sound.setMuted(true);
    sound.setMuted(false);
    await hangUp();
    frame();
    check(heard.length === 0, 'Muting consumes cues held through an interruption');

    const beforeMute = attempts;
    sound.setMuted(true);
    await settle(() => ctx.state === 'suspended', 'Muting suspends the context');
    await pause();
    frame(['delight']);
    check(attempts === beforeMute, 'A muted suspension is not treated as an interruption');
    sound.setMuted(false);
    await settle(() => sound.running, 'Unmuting resumes the context');
    frame();
    check(heard.length === 0, 'Muted audio still consumes cues without replaying them');

    sound.setHidden(true);
    await settle(() => ctx.state === 'suspended', 'A hidden page suspends the context');
    frame(['delight']);
    sound.setHidden(false);
    await settle(() => sound.running, 'A visible page resumes the context');
    frame();
    check(heard.length === 0, 'Hidden-page audio still consumes cues without replaying them');

    const graph = sound.output;
    check(graph && graph === sound.output && graph.ctx === ctx, 'Running audio returns one cached output graph');
    sound.setMuted(true);
    check(sound.output === null, 'Muted audio has no output graph');
    sound.setMuted(false);
    await settle(() => sound.running, 'Unmuting resumes the context');
    check(sound.output === graph, 'Unmuting returns the same output graph');

    // Muting suspends the context with its piano notes still scheduled, so their voices stay reserved.
    const piano = new PianoStrings();
    piano.setOutput(sound.output);
    const at = ctx.currentTime + 1;
    const strike = when => piano.note(62, .4, 0, 1, when).length > 0;
    check(Array.from({ length: 12 }, () => strike(at)).filter(Boolean).length === 10, 'Ten piano voices can be reserved at once');
    sound.setMuted(true);
    piano.setOutput(sound.output);
    sound.setMuted(false);
    await settle(() => sound.running, 'Unmuting resumes the context');
    piano.setOutput(sound.output);
    check(!strike(at), 'Muting and unmuting keep the ten voice reservations');
    check(strike(at + 12), 'Voices free up once their notes have ended');
    const other = new OfflineAudioContext(2, 2400, 24000);
    piano.setOutput({ ctx: other, bus: other.destination, reverb: other.destination });
    check(strike(.05), 'A new audio context starts with free voices');
    ctx.resume = nativeResume;
    await ctx.close();

    // Begin makes only the context and graph. Noise and reverb follow in slices at a steady rate of story time, and
    // the reverb's convolver analyses its impulse on a frame of its own.
    const FRAME = 768 / 48000;
    let steps = 0, analyses = 0;
    const step = Sliced.prototype.step;
    Sliced.prototype.step = function () { if (!this.ready) steps++; return step.call(this); };
    const convolverBuffer = Object.getOwnPropertyDescriptor(ConvolverNode.prototype, 'buffer');
    Object.defineProperty(ConvolverNode.prototype, 'buffer', { ...convolverBuffer,
      set(buffer) { if (buffer) analyses++; convolverBuffer.set.call(this, buffer); } });
    const offline = (seconds, rate = 48000) => {
      const off = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate), made = [];
      const create = off.createBuffer.bind(off);
      off.createBuffer = (...args) => { const buffer = create(...args); made.push(buffer); return buffer; };
      const Native = window.AudioContext;
      window.AudioContext = function () { return off; };
      const s = new Soundscape(), began = performance.now(), before = analyses;
      try { s.start(); } finally { window.AudioContext = Native; }
      Object.defineProperty(s, 'running', { get: () => true });
      return { off, s, made, startMs: performance.now() - began, startAnalyses: analyses - before };
    };
    const render = async (off, seconds, update, period = FRAME) => {
      const frames = Math.floor(seconds / period);
      update(0);
      let pause = off.suspend(period);
      const rendering = off.startRendering();
      for (let i = 1; i < frames; i++) {
        await pause;
        update(i);
        if (i + 1 < frames) pause = off.suspend((i + 1) * period);
        await off.resume();
      }
      return rendering;
    };
    const worstStep = (buffer, from, to) => {
      let worst = 0;
      for (let ch = 0; ch < 2; ch++) {
        const d = buffer.getChannelData(ch);
        for (let i = Math.max(1, Math.floor(from * 48000)); i < Math.min(d.length, to * 48000); i++) worst = Math.max(worst, Math.abs(d[i] - d[i - 1]));
      }
      return worst;
    };
    // Loudness in 5 ms windows: a click or a bed switched on at full level is a sudden rise between windows.
    const envelope = buffer => {
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1), out = [];
      for (let i = 0; i + 240 <= left.length; i += 240) {
        let power = 0;
        for (let j = i; j < i + 240; j++) power += left[j] ** 2 + right[j] ** 2;
        out.push(Math.sqrt(power / 480));
      }
      return out;
    };
    const rise = (env, from, to) => {
      let worst = 0;
      for (let k = Math.max(1, Math.floor(from * 200)); k < Math.min(env.length, to * 200); k++) worst = Math.max(worst, env[k] - env[k - 1]);
      return worst;
    };
    const mean = (env, from, to) => { const part = env.slice(Math.floor(from * 200), Math.floor(to * 200)); return part.reduce((a, b) => a + b, 0) / part.length; };
    const begin = async abrupt => {
      let seed = 51277;
      const random = Math.random;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      try {
        const run = offline(3), { s, off } = run, events = {}, crowded = [], analysedBefore = analyses;
        run.madeAtStart = run.made.length;
        // Silence the slow pad so the beds' own entry is measured; the shower adds bright rain to them.
        s.padGain.gain.setTargetAtTime = () => s.padGain.gain;
        if (abrupt) {
          // Counterfactual: the same beds connected without their entry fade, to show what this measure catches.
          s.startNoise = function () {
            for (const input of this.noiseInputs) {
              const src = off.createBufferSource();
              src.buffer = this.noise; src.loop = true; src.loopStart = .04;
              src.connect(input); src.start(off.currentTime, Math.random() * 5);
            }
            this.noiseInputs = [];
          };
        }
        let mostSteps = 0;
        const buffer = await render(off, 3, () => {
          const stepped = steps, analysed = analyses;
          s.update(FRAME, { ...baseState, music: 'meadow', shower: 1, breeze: 1 });
          mostSteps = Math.max(mostSteps, steps - stepped);
          if (analyses > analysed && (analyses - analysed > 1 || steps - stepped > 1)) crowded.push(off.currentTime);
          if (events.noise === undefined && !s.noiseInputs.length) events.noise = off.currentTime;
          if (events.reverb === undefined && s.reverbConvolver.buffer) events.reverb = off.currentTime;
        });
        return { ...run, buffer, env: envelope(buffer), events, mostSteps, crowded, analysed: analyses - analysedBefore };
      } finally { Math.random = random; }
    };
    const eased = await begin(false), abrupt = await begin(true);
    const { events } = eased;
    check(eased.madeAtStart === 0 && eased.startAnalyses === 0, 'The Begin gesture synthesises no buffers and analyses no convolver');
    check(events.noise > FRAME && events.noise < 1 && events.reverb > events.noise && events.reverb < 1.3,
      `Noise (${events.noise.toFixed(2)} s) and reverb (${events.reverb.toFixed(2)} s) arrive over frames, within about a second`);
    check(eased.mostSteps <= Math.round(FRAME * 240), 'No frame synthesises more than its share');
    check(eased.analysed === 1 && !eased.crowded.length,
      'The one reverb convolver is analysed on a frame of its own, with no synthesis beside it');
    check(eased.s.foghornWork === null, 'The foghorn is not prepared outside Drowned');
    const { env } = eased, noise = events.noise, reverb = events.reverb;
    Object.assign(metrics, { startMs: eased.startMs, noiseReadyAt: noise, reverbReadyAt: reverb,
      mostStepsPerFrame: eased.mostSteps,
      bedEntryRise: rise(env, noise - FRAME, noise + .3), bedSteadyRise: rise(env, noise + .3, noise + 1.3),
      abruptEntryRise: rise(abrupt.env, abrupt.events.noise - FRAME, abrupt.events.noise + .3),
      abruptEntryLevel: mean(abrupt.env, abrupt.events.noise + .01, abrupt.events.noise + .06),
      reverbEntryRise: rise(env, reverb - FRAME, reverb + .3), reverbSteadyRise: rise(env, reverb + .3, reverb + 1.3) });
    check(metrics.abruptEntryRise > metrics.abruptEntryLevel / 2, 'Measured this way, an unfaded entry jumps by over half its level within 5 ms');
    check(metrics.bedEntryRise <= metrics.bedSteadyRise, 'The ambient beds enter with no jump beyond their own flutter');
    check(metrics.reverbEntryRise <= metrics.reverbSteadyRise, 'The reverb enters with no jump beyond the beds\' own flutter');
    let clipped = 0;
    for (let ch = 0; ch < 2; ch++) for (const v of eased.buffer.getChannelData(ch)) if (!Number.isFinite(v) || Math.abs(v) >= 1) clipped++;
    check(clipped === 0, 'The Begin render is finite and unclipped');
    const early = offline(1);
    early.s.thunder(.3, 0);
    early.s.update(FRAME, { ...baseState, cues: ['kindled'] });
    check(early.s.noiseWork.ready, 'Thunder or an ember before the noise is ready finishes it at once, without throwing');

    // An arrival only moves the background's gates: the shared reverb stays, and no convolver is made or analysed.
    const { ARRIVAL_MUSIC } = await productionModule('/src/audio/arrival-music.ts');
    const arrival = offline(18, 24000);
    let reverb = null, arrivalAnalyses = 0, convolvers = 0;
    const createConvolver = arrival.off.createConvolver;
    arrival.off.createConvolver = function () { convolvers++; return createConvolver.call(this); };
    await render(arrival.off, 18, tick => {
      const now = tick / 8, landed = now >= 16, analysed = analyses;
      if (now === 3) { reverb = arrival.s.reverbConvolver; convolvers = 0; }
      arrival.s.update(.125, { ...baseState, music: 'sea', flockChatter: false, ...(landed ? ARRIVAL_MUSIC.lines : {}),
        arrivalMusic: now >= 8 && !landed ? 'lines' : undefined });
      if (now >= 3) arrivalAnalyses += analyses - analysed;
    }, .125);
    check(reverb?.buffer && arrival.s.reverbConvolver === reverb && arrivalAnalyses === 0 && convolvers === 0,
      'The arrival keeps the shared reverb, making and analysing no convolver');

    // The foghorn's buffers and diffuse field are made during Drowned, so the cue's frame only connects nodes.
    const storm = offline(1), drowned = { ...baseState, music: 'drowned', drownedScore: 'gather', sea: 1, land: 0 };
    let frames = 0;
    for (; frames < 400 && !storm.s.foghornWork?.ready; frames++) storm.s.update(FRAME, { ...drowned, cues: [] });
    check(storm.s.foghornWork?.ready, `The horn is prepared ${(frames * FRAME).toFixed(1)} s into Drowned`);
    const real = storm.s.foghorn.bind(storm.s);
    let horn = null;
    storm.s.foghorn = () => (horn = real());
    const made = storm.made.length, analysed = analyses, began = performance.now();
    storm.s.update(FRAME, { ...drowned, cues: ['foghorn'] });
    metrics.foghornPreparedAfter = frames * FRAME;
    metrics.foghornCueFrameMs = performance.now() - began;
    check(horn?.sources.size > 0 && storm.made.length === made && analyses === analysed,
      'The foghorn cue frame plays the horn without synthesising a buffer or analysing a convolver');
    const prepared = storm.s.foghornWork.finish(), fresh = new Sliced(foghornParts(storm.off)).finish();
    check(prepared.diffuse === null, 'The prepared diffuse field serves exactly one call');
    check(['impulse', 'air'].every(key => {
      const a = prepared[key], b = fresh[key];
      return a.numberOfChannels === b.numberOfChannels && Array.from({ length: a.numberOfChannels }).every((_, ch) => {
        const x = a.getChannelData(ch), y = b.getChannelData(ch);
        return x.length === y.length && x.every((v, i) => v === y[i]);
      });
    }), 'Prepared horn buffers are identical to a call synthesised on the spot');
    Sliced.prototype.step = step;
    Object.defineProperty(ConvolverNode.prototype, 'buffer', convolverBuffer);

    // The Lines pinwheel voice retires once its row is out of reach, and a new one returns with the row.
    const { Pinwheels } = await productionModule('/src/world/pinwheels.ts');
    const { LINES_WALK } = await productionModule('/src/world/lines-passage.ts');
    const wind = { calm: 0, sample(x, z, out) { Object.assign(out, { x: 7, z: 0, energy: 1, lift: 0 }); return out; } };
    const wheels = new Pinwheels(wind, LINES_WALK);
    const off = new OfflineAudioContext(2, 5 * 48000, 48000), live = new Set();
    let buffers = 0;
    for (const method of ['createGain', 'createOscillator', 'createBiquadFilter', 'createBufferSource']) {
      const create = off[method].bind(off);
      off[method] = (...args) => {
        const node = create(...args), connect = node.connect.bind(node), disconnect = node.disconnect.bind(node);
        node.connect = (...a) => { live.add(node); return connect(...a); };
        node.disconnect = (...a) => { live.delete(node); return disconnect(...a); };
        return node;
      };
    }
    const createBuffer = off.createBuffer.bind(off);
    off.createBuffer = (...args) => { buffers++; return createBuffer(...args); };
    const out = { ctx: off, bus: off.destination, reverb: off.destination };
    const centre = wheels.centre;
    const near = { position: { x: centre.x, z: centre.z + 20 } }, far = { position: { x: centre.x + 400, z: centre.z } };
    let first = null, second = null, retired = null;
    const buffer = await render(off, 5, i => {
      const t = i * FRAME;
      if (t >= 3.9 && retired === null) retired = { live: live.size, voice: wheels.flutter };
      wheels.update(FRAME, t < 1 || t >= 4 ? near : far, out);
      if (t < 1) first ??= wheels.flutter;
      if (t >= 4) second ??= wheels.flutter;
    });
    check(first !== null, 'The pinwheel voice starts beside the row');
    check(retired.voice === null && retired.live === 0, 'Out of reach, the retired voice stops and disconnects every node');
    check(second !== null && second !== first && buffers === 1, 'A new voice returns with the row, reusing its paper noise');
    metrics.pinwheelStopStep = worstStep(buffer, 1 + 1.5 - .05, 1 + 1.5 + .05);
    check(metrics.pinwheelStopStep < 1e-4, 'The retired voice has faded before its sources stop');
    return { checks, metrics };
  });
  assert(report.checks.length > 30);
  fs.writeFileSync(evidence, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, ...report.metrics }, null, 2));
} finally { await browser.close(); }

// Render this checkout's meadow music through the game's sound, from the walk's last stretch through her sitting, the
// four calls, answers traced at a steady moderate pace, the finale and the warm bed after it.
// Usage: [BASE=http://127.0.0.1:5230/] node tools/meadow-duet-render.mjs [out.wav] [traceSeconds]. Music only;
// WORLD=1 keeps the wind; DEBUG=1 prints progress.
// The timeline follows the duet's own waits (`tuning.windBough`, `tuning.piano`); a player's pauses are not modelled.
import fs from 'node:fs';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.argv[2] ?? '/tmp/updraft-meadow-duet.wav';
const trace = Number(process.argv[3] ?? 2.6);
// BASE uses a running dev server of this checkout; without it a private one starts.
const server = process.env.BASE ? null : await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server?.listen();
let browser;
try {
  const session = await audioPage(process.env.BASE ?? `http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  session.page.on('console', message => { if (process.env.DEBUG) console.log(message.text()); });
  const result = await session.page.evaluate(async ({ trace, world }) => {
    const { tuning } = await productionModule('/src/tuning.ts');
    const { meadowMusic } = await productionModule('/src/audio/meadow-music.ts');
    const { MEADOW_CALLS, MEADOW_FINALE } = await productionModule('/src/audio/meadow-duet.ts');
    // Steps of eight render quanta, so every suspend falls on a quantum boundary.
    const rate = 48000, fps = rate / 1024, inhale = tuning.windBough.inhale, walkFor = 14;
    // The story's waits, in seconds from the start of the render.
    const events = [], marks = [];
    const sits = walkFor, seated = sits + 0.7;
    let bough = seated + 1.4;
    for (const [i, { call, reply }] of MEADOW_CALLS.entries()) {
      events.push({ at: bough + inhale + call.startAt, run: () => meadowMusic.phrase(call.clip, 0, 'call', 0) });
      marks.push({ what: `call ${i + 1}`, at: bough + inhale + call.startAt });
      const from = bough + inhale + call.duration + tuning.windBough.answerAfter + 1.2;
      reply.notes.forEach((note, k) => events.push({ at: from + note.share * trace, run: () => meadowMusic.answerNote(reply, k) }));
      marks.push({ what: `answer ${i + 1}`, at: from });
      bough = from + trace + (i < 3 ? tuning.piano.phraseRest : tuning.windBough.finalRest);
    }
    events.push({ at: bough + inhale + MEADOW_FINALE.startAt, run: () => meadowMusic.phrase(MEADOW_FINALE.clip, 0, 'finale', 0) });
    marks.push({ what: 'finale', at: bough + inhale + MEADOW_FINALE.startAt }, { what: 'greening', at: bough + inhale + MEADOW_FINALE.greenAt });
    const after = bough + inhale + MEADOW_FINALE.duration + tuning.piano.completionRest;
    marks.push({ what: 'warm bed', at: after });
    const seconds = Math.ceil(after + 30), ticks = Math.floor(seconds * fps) - 2;
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
    const Native = window.AudioContext;
    window.AudioContext = function () { return ctx; };
    const sound = new audioModule.Soundscape();
    try { sound.start(); } finally { window.AudioContext = Native; }
    Object.defineProperty(sound, 'running', { get: () => true });
    console.log('decoding');
    await Promise.all(['walk', 'duet', 'after'].map(file => meadowMusic.prepare(file)));
    console.log(`decoded; rendering ${seconds.toFixed(1)} s`);
    const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const update = tick => {
      const t = tick / fps;
      const part = t < sits ? 'walk' : t < after ? 'duet' : 'after';
      const piano = part === 'duet' ? smooth((t - sits) / tuning.piano.fadeOut) : 0;
      sound.update(1 / fps, { ...baseState, music: 'meadow', meadowMusic: part, piano, pianoActive: part === 'duet', meadow: 1 });
      while (events.length && events[0].at <= t + 1e-6) events.shift().run();
      if (!world) for (const name of ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
        sound[name].gain.cancelScheduledValues(ctx.currentTime); sound[name].gain.value = 0;
      }
    };
    events.sort((a, b) => a.at - b.at);
    update(0);
    let pause = ctx.suspend(1 / fps);
    const rendering = ctx.startRendering();
    for (let tick = 1; tick < ticks; tick++) {
      await pause; update(tick);
      if (tick % Math.round(fps * 10) === 0) console.log(`${Math.round(tick / fps)} s`);
      if (tick + 1 < ticks) pause = ctx.suspend((tick + 1) / fps);
      await ctx.resume();
    }
    const rendered = await rendering;
    console.log('rendered');
    const { pcm, ...metrics } = encodeAudio(rendered);
    window.renderedPcm = pcm;
    return { ...metrics, length: pcm.length, rate, marks: marks.map(m => ({ ...m, at: Math.round(m.at * 100) / 100 })) };
  }, { trace, world: process.env.WORLD === '1' });
  // A long render is too large for one message: fetch it in pieces (multiples of 4 base64 characters).
  const pieces = [];
  for (let at = 0; at < result.length; at += 4 << 20) {
    pieces.push(Buffer.from(await session.page.evaluate(([from, n]) => window.renderedPcm.slice(from, from + n), [at, 4 << 20]), 'base64'));
  }
  const samples = Buffer.concat(pieces);
  const header = wav(samples, result.rate);
  fs.writeFileSync(out, header);
  console.log(JSON.stringify({ out, trace, ...result }, null, 1));
} finally {
  if (browser) await browser.close();
  await server?.close();
}

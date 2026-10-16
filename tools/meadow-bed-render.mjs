// Render this checkout's warm bed through the game's sound, from the duet's end to the Birches music: the flowers and
// seeds, the family's calls with the bed lowered under them, the walk to the boat, the push off, the bed going over into
// its close, the crossing, and Birches coming in after it.
// Usage: [BASE=http://127.0.0.1:5230/] node tools/meadow-bed-render.mjs [out.wav]. Seconds from the bed's start:
// LISTEN (the listening rest, default 75), GONE (the family out of sight, 140), PUSH (the push off, 215). Music and
// the swans' calls only; DEBUG=1 prints progress. The crossing's own times are its measured ones (journey-pacing-check).
// `levels` reports the warm bed's own gain each second, which shows its swell and its dip under the family's calls.
import fs from 'node:fs';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.argv[2] ?? '/tmp/updraft-meadow-bed.wav';
const times = { listen: Number(process.env.LISTEN ?? 75), gone: Number(process.env.GONE ?? 140), push: Number(process.env.PUSH ?? 215) };
// toBirches, seconds from leaving: Birches is asked for, the approach is close enough for it, and they land.
const crossing = { board: 4, asks: 13.85, ready: 26.2, lands: 47 };
const server = process.env.BASE ? null : await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server?.listen();
let browser;
try {
  const session = await audioPage(process.env.BASE ?? `http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  session.page.on('console', message => { if (process.env.DEBUG) console.log(message.text()); });
  const result = await session.page.evaluate(async ({ times, crossing }) => {
    const { meadowMusic } = await productionModule('/src/audio/meadow-music.ts');
    const { MEADOW_MEASURED } = await productionModule('/src/audio/meadow-cuts-measured.ts');
    const { ARRIVAL_MUSIC } = await productionModule('/src/audio/arrival-music.ts');
    const rate = 48000, fps = rate / 1024;
    const sail = times.push + crossing.board, land = sail + crossing.lands, seconds = Math.ceil(land + 20);
    const marks = [{ what: 'listening rest', at: times.listen }, { what: 'family out of sight', at: times.gone },
      { what: 'push off', at: times.push }, { what: 'crossing', at: sail }, { what: 'Birches asked for', at: sail + crossing.asks },
      { what: 'approach', at: sail + crossing.ready }, { what: 'landing', at: land }];
    // The family's calls as the story makes them: one at the listening rest, then every 9–14 s up to the crest, closer
    // and every 5.4 s on the rise and the way down, and the cygnet's after them as they go.
    const calls = [];
    const crest = times.listen + (times.gone - times.listen) * 0.55;
    for (let t = times.listen + 2; t < crest; t += 11.5) calls.push({ at: t, cue: 'bugle', distance: 0.75 });
    for (let t = crest; t < times.gone - 12; t += 5.4) calls.push({ at: t, cue: 'bugle', distance: 0.45 });
    for (let t = times.gone - 18; t < times.gone - 7; t += 5.5) calls.push({ at: t, cue: 'calling', distance: 0.1 });
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
    const Native = window.AudioContext;
    window.AudioContext = function () { return ctx; };
    const sound = new audioModule.Soundscape();
    try { sound.start(); } finally { window.AudioContext = Native; }
    Object.defineProperty(sound, 'running', { get: () => true });
    await Promise.all([meadowMusic.prepare('after'), sound.prepareMusic('birches')]);
    const flock = { active: true, distance: 0, pan: -0.2, position: { x: 0, y: 0, z: 0 } };
    const cygnet = { active: true, distance: 0.05, pan: 0.1, position: { x: 0, y: 0, z: 0 } };
    let closing = false;
    const levels = [];
    const update = tick => {
      const t = tick / fps, cues = [];
      while (calls.length && calls[0].at <= t) {
        const call = calls.shift();
        flock.distance = call.distance * 220;
        cues.push(call.cue);
      }
      const meadow = t < times.listen ? 'after' : t < times.gone ? 'swans' : t < times.push ? 'boat' : 'onward';
      const state = t < sail ? { music: 'meadow', meadowMusic: meadow, meadowScore: 'return' }
        : t < land ? { music: 'meadow', meadowScore: 'return', arrivalMusic: t >= sail + crossing.asks ? 'birches' : undefined,
          arrivalReady: t >= sail + crossing.ready }
        : { ...ARRIVAL_MUSIC.birches, birchesLoop: true };
      flock.active = t < times.gone;
      sound.update(1 / fps, { ...baseState, hush: 0, meadow: t < sail ? 1 : 0, land: t < sail ? 1 : 0, sea: t < sail ? 0.3 : 1,
        flock, flockChatter: false, cygnet, cues, ...state });
      for (const name of ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
        sound[name].gain.cancelScheduledValues(ctx.currentTime); sound[name].gain.value = 0;
      }
      if (tick % Math.round(fps) === 0) levels.push([Math.round(t), meadowMusic.bed ? Math.round(20 * Math.log10(meadowMusic.bed.bus.gain.value + 1e-9) * 10) / 10 : null]);
      const closesAt = meadowMusic.state.closesAt;
      if (closesAt !== undefined && !closing) {
        closing = true;
        const { close } = MEADOW_MEASURED.after;
        marks.push({ what: 'into the close', at: closesAt - (close.duration - close.entry) }, { what: 'close ends', at: closesAt });
      }
    };
    update(0);
    let pause = ctx.suspend(1 / fps);
    const rendering = ctx.startRendering();
    const ticks = Math.floor(seconds * fps) - 2;
    for (let tick = 1; tick < ticks; tick++) {
      await pause; update(tick);
      if (tick % Math.round(fps * 20) === 0) console.log(`${Math.round(tick / fps)} s`);
      if (tick + 1 < ticks) pause = ctx.suspend((tick + 1) / fps);
      await ctx.resume();
    }
    const rendered = await rendering;
    const { pcm, ...metrics } = encodeAudio(rendered);
    window.renderedPcm = pcm;
    return { ...metrics, length: pcm.length, rate, levels, marks: marks.sort((a, b) => a.at - b.at).map(m => ({ ...m, at: Math.round(m.at * 100) / 100 })) };
  }, { times, crossing });
  const pieces = [];
  for (let at = 0; at < result.length; at += 4 << 20) {
    pieces.push(Buffer.from(await session.page.evaluate(([from, n]) => window.renderedPcm.slice(from, from + n), [at, 4 << 20]), 'base64'));
  }
  fs.writeFileSync(out, wav(Buffer.concat(pieces), result.rate));
  console.log(JSON.stringify({ out, times, ...result }, null, 1));
} finally {
  if (browser) await browser.close();
  await server?.close();
}

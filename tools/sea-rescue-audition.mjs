// Render this checkout's open-sea recording through the whale rescue, as the game sequences it, for auditions: the end
// of the crossing, the boat coming to rest, the bed under the rescue for as long as it takes, and the release.
// Usage: node tools/sea-rescue-audition.mjs <out.wav> [freedAfter]; freedAfter is the seconds from coming to rest to the
// cygnet starting to pull the last loop off (40 for a prompt player). STIR is the seconds from coming to rest to the
// net over the blowhole first lifting (3.3), FROM the recording second the render starts at (30).
// Music only, 3 dB under the recording's own level: the whale's calls, which make room under it in the game, are not in it. Prints the
// recording's sections as they play.
import fs from 'node:fs';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.argv[2] ?? '/tmp/updraft-sea-rescue.wav';
const freedAfter = Number(process.argv[3] ?? 40);
const from = Number(process.env.FROM ?? 30);
const stir = Number(process.env.STIR ?? 3.3);
// Measured with real gestures: the boat at rest at the recording's 55th second, the loop off 3.9 s into the pull, the
// farewell 12.9 s into it and the whale gone 32.4 s after that.
const REST = 55, FREE_AFTER = 12.9, GONE_AFTER = 32.4, RATE = 48000, STEP = 1 / 30;
const server = await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
let browser;
try {
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  const result = await session.page.evaluate(async ({ from, stir, freedAfter, REST, FREE_AFTER, GONE_AFTER, RATE, STEP }) => {
    const { SeaMusic, SEA_RELEASE } = await productionModule('/src/audio/sea-music.ts');
    const freed = REST + freedAfter, gone = freed + FREE_AFTER + GONE_AFTER;
    const seconds = freed - from + 8 + SEA_RELEASE.to - SEA_RELEASE.from + 4;
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
    const starts = [];
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      starts.push({ at: +(when + from).toFixed(2), from: +offset.toFixed(2), to: +(offset + duration).toFixed(2) });
      return native.call(this, when, offset, duration);
    };
    const music = new SeaMusic(ctx, ctx.destination);
    await music.ready;
    const rescue = t => t < REST + stir ? 'coming' : t < freed ? 'rescue' : t < gone ? 'freeing' : 'gone';
    const level = 10 ** (-3 / 20);
    const update = tick => { const t = from + tick * STEP; music.update(t, rescue(t), level); };
    update(0);
    const ticks = Math.floor(seconds / STEP);
    let pause = ctx.suspend(STEP);
    const rendering = ctx.startRendering();
    for (let tick = 1; tick < ticks; tick++) {
      await pause; update(tick);
      if (tick + 1 < ticks) pause = ctx.suspend((tick + 1) * STEP);
      await ctx.resume();
    }
    const buffer = await rendering;
    return { sections: starts, beats: { rest: REST, stir: REST + stir, pull: freed, loopOff: freed + 3.9, farewell: freed + FREE_AFTER, spout: freed + FREE_AFTER + 6, gone }, ...encodeAudio(buffer) };
  }, { from, stir, freedAfter, REST, FREE_AFTER, GONE_AFTER, RATE, STEP });
  fs.writeFileSync(out, wav(Buffer.from(result.pcm, 'base64'), RATE));
  const { pcm, ...report } = result;
  console.log(JSON.stringify({ out, from, ...report }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}

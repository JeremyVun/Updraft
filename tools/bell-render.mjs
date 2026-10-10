// Renders the belfry bell through the game's own sound (its foley, bus and shared reverb, the sea and a little wind,
// no music) to a WAV for listening: by default four rings about four seconds apart, as a player rings it.
// Usage: node tools/bell-render.mjs [out.wav] ['[{"t":1,"ring":true,"peak":0.45},...]'] [seconds]
//   out.wav defaults to /tmp/updraft-belfry-bell.wav; the rings are times in seconds, a ring or the clapper only
//   touching, and the swing's top (radians), as tools/crossing-film.mjs logs them. Serves the worktree itself.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = path.resolve(process.argv[2] ?? '/tmp/updraft-belfry-bell.wav');
const rings = JSON.parse(process.argv[3] ?? '[{"t":0.6,"ring":true,"peak":0.45},{"t":4.4,"ring":true,"peak":0.42},{"t":8.1,"ring":true,"peak":0.46},{"t":11.9,"ring":true,"peak":0.41}]');
const seconds = Number(process.argv[4] ?? Math.max(...rings.map((r) => r.t)) + 16);

const server = await createServer({ configFile: false, envDir: false, server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  const result = await session.page.evaluate(async ({ rings, seconds }) => {
    const { Foley } = await import('/src/audio/foley.ts');
    const { tuning } = await import('/src/tuning.ts');
    const { ctx, sound } = offlineSound(seconds);
    const foley = new Foley();
    const k = tuning.crossings.bell;
    const strength = (r) => (r.ring ? 0.55 + 0.45 * Math.min(1, Math.max(0, (r.peak - k.ringAt) / (k.fullAt - k.ringAt)))
      : 0.15 + 0.4 * Math.min(1, Math.max(0, (r.peak - k.touchAt) / (k.ringAt - k.touchAt))));
    const tick = 1 / 16;
    const state = { ...baseState, music: 'drowned', silence: true, sea: 1, land: 0.2, overLand: false, breeze: 0.12, night: 0.25, life: 1 };
    const update = () => sound.update(tick, state);
    update();
    let next = 0;
    let pause = ctx.suspend(tick);
    const rendering = ctx.startRendering();
    for (let i = 1; i < Math.round(seconds / tick); i++) {
      await pause;
      foley.setOutput(sound.output);
      while (next < rings.length && rings[next].t <= i * tick) {
        const r = rings[next++];
        foley.material(r.ring ? 'bell' : 'bell-touch', strength(r), -0.1);
      }
      update();
      if (i + 1 < Math.round(seconds / tick)) pause = ctx.suspend((i + 1) * tick);
      await ctx.resume();
    }
    return encodeAudio(await rendering);
  }, { rings, seconds });
  fs.writeFileSync(out, wav(Buffer.from(result.pcm, 'base64')));
  console.log(JSON.stringify({ out, seconds, rings: rings.length, peakDbFS: +result.peakDbFS.toFixed(1), rmsDbFS: +result.rmsDbFS.toFixed(1), clipped: result.clipped }));
} finally {
  await browser?.close();
  await server.close();
}

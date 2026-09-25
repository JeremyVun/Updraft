// Render this checkout's Home ending score from the updraft to the credits, for side-by-side auditions.
// Usage: node tools/ending-audition.mjs <out.wav> [fromSeconds]. Music only; WORLD=1 keeps wind and sea.
import fs from 'node:fs';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.argv[2] ?? '/tmp/updraft-ending-audition.wav';
const from = Number(process.argv[3] ?? 0);
const lead = 10;
const server = await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
let browser;
try {
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  const result = await session.page.evaluate(async ({ lead, from, world }) => {
    const { HOME_ENDING } = await productionModule('/src/story/home-ending.ts');
    const seconds = lead + HOME_ENDING.creditsAt + 4, rate = 60, { ctx, sound } = offlineSound(seconds);
    const smooth = (t, a, b) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
    let started = false;
    const update = tick => {
      const t = tick / rate - lead;
      sound.update(1 / rate, { ...baseState, music: 'home', summitScore: 'approach',
        homeEndingTime: t >= 0 ? t : undefined, night: smooth(t, 80, 92), land: 0, meadow: 0, flockChatter: false,
        silence: t >= HOME_ENDING.musicEndsAt, scripted: true });
      if (!started && sound.summitScore) { sound.summitScore.epoch = ctx.currentTime - 105; started = true; }
      if (!world) for (const name of ['breezeGain','rainGain','patterGain','seaGain','gustGain','whistleGain','rustleGain','liftGain']) {
        sound[name].gain.cancelScheduledValues(ctx.currentTime); sound[name].gain.value = 0;
      }
    };
    update(0);
    let pause = ctx.suspend(1 / rate);
    const rendering = ctx.startRendering();
    for (let tick = 1; tick < seconds * rate; tick++) {
      await pause; update(tick);
      if (tick + 1 < seconds * rate) pause = ctx.suspend((tick + 1) / rate);
      await ctx.resume();
    }
    const rendered = await rendering;
    const start = Math.round((lead + from) * 24000);
    const clip = new AudioBuffer({ numberOfChannels: 2, length: rendered.length - start, sampleRate: 24000 });
    for (let ch = 0; ch < 2; ch++) clip.copyToChannel(rendered.getChannelData(ch).subarray(start), ch);
    return { ...encodeAudio(clip), ending: HOME_ENDING };
  }, { lead, from, world: process.env.WORLD === '1' });
  fs.writeFileSync(out, wav(Buffer.from(result.pcm, 'base64')));
  const { pcm, ...metrics } = result;
  console.log(JSON.stringify({ out, from, ...metrics }));
} finally {
  if (browser) await browser.close();
  await server.close();
}

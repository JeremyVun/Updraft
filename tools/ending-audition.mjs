// Render this checkout's Home from the summit to the credits, for auditions: the family over the hill, the cygnet set
// down and asking, the updraft's success and the ending timed from the music's return.
// Usage: node tools/ending-audition.mjs <out.wav> [fromSeconds]; fromSeconds counts from the success, and by default
// the render starts as they sit on the summit. Music only; WORLD=1 keeps wind and sea, with a stand-in updraft rush
// rising to the success. START is where Home's pass is as they sit (83.45 s on the journey from the Mirror); ASK is how
// long the cygnet asks, from its tries beginning to the success (12). RATE sets the story's frames a second (60).
import fs from 'node:fs';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.argv[2] ?? '/tmp/updraft-ending-audition.wav';
const from = process.argv[3] === undefined ? null : Number(process.argv[3]);
const ask = Number(process.env.ASK ?? 12);
const start = Number(process.env.START ?? 83.45);
// Measured from the journey: the set-down `setDownAt` after they sit, and the tries this long after it.
const triesAfter = 6.72;
const rate = Number(process.env.RATE ?? 60);
const server = await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
let browser;
try {
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  const result = await session.page.evaluate(async ({ from, world, start, ask, triesAfter, rate }) => {
    const { HOME_ENDING } = await productionModule('/src/story/home-ending.ts');
    const { tuning } = await productionModule('/src/tuning.ts');
    const setDown = tuning.summit.setDownAt, tries = setDown + triesAfter, success = tries + ask;
    const jumpAt = tuning.audio.homeJumpAt, longestWait = 6;
    const seconds = success + longestWait + HOME_ENDING.creditsAt + 4, { ctx, sound } = offlineSound(seconds);
    const smooth = (t, a, b) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
    // Home's pass began `start` seconds into the recording as they sat, as if scheduled from the Mirror.
    sound.homeFrom = ctx.currentTime - start;
    let endingAt = null, returnIn, askAt;
    const positions = [];
    const update = tick => {
      const t = tick / rate;
      if (endingAt === null && t >= success) { returnIn = sound.homeReturnIn; endingAt = t + (returnIn ?? jumpAt) - jumpAt; }
      const e = endingAt === null ? undefined : t - endingAt;
      const rush = world ? (t < success ? smooth(t, success - 6, success - .5) * .9 : .9 * Math.exp(-(t - success) / 1.5)) : 0;
      if (tick % (rate / 2) === 0) positions.push([+t.toFixed(2), +(sound.summitScore?.position(ctx.currentTime) ?? NaN).toFixed(3)]);
      sound.update(1 / rate, { ...baseState, music: 'home', summitScore: 'approach', charge: rush,
        homeAsk: t >= tries && t < success, homeSetDownIn: endingAt === null ? Math.max(0, setDown - t) : undefined,
        homeEndingTime: e, night: e === undefined ? 0 : smooth(e, 80, 92), land: 0, meadow: 0, flockChatter: false,
        silence: e !== undefined && e >= HOME_ENDING.musicEndsAt, scripted: true });
      askAt ??= sound.homeAskAt;
      if (!world) for (const name of ['breezeGain','rainGain','patterGain','seaGain','gustGain','whistleGain','rustleGain','liftGain']) {
        sound[name].gain.cancelScheduledValues(ctx.currentTime); sound[name].gain.value = 0;
      }
    };
    update(0);
    await sound.summitScore.ready;
    let pause = ctx.suspend(1 / rate);
    const rendering = ctx.startRendering();
    for (let tick = 1; tick < seconds * rate; tick++) {
      await pause; update(tick);
      if (tick + 1 < seconds * rate) pause = ctx.suspend((tick + 1) / rate);
      await ctx.resume();
    }
    const rendered = await rendering;
    const first = Math.round(Math.max(0, from === null ? 0 : success + from) * 24000);
    const last = Math.min(rendered.length, Math.round((endingAt + HOME_ENDING.creditsAt + 4) * 24000));
    const clip = new AudioBuffer({ numberOfChannels: 2, length: last - first, sampleRate: 24000 });
    for (let ch = 0; ch < 2; ch++) clip.copyToChannel(rendered.getChannelData(ch).subarray(first, last), ch);
    const r = v => +v.toFixed(2), clipStart = first / 24000;
    const near = at => positions.filter(([t]) => Math.abs(t - at) <= 1.01).map(([t, p]) => [r(t - clipStart), p]);
    return { ...encodeAudio(clip), start, ask,
      // Seconds into the render.
      cues: { setDown: r(setDown - clipStart), askBegins: r(askAt - clipStart), tries: r(tries - clipStart),
        success: r(success - clipStart), returnAttack: r(endingAt + jumpAt - clipStart),
        moon: r(endingAt + HOME_ENDING.moonAt - clipStart), credits: r(endingAt + HOME_ENDING.creditsAt - clipStart) },
      waitForMusic: returnIn === undefined ? null : r(returnIn),
      around: { askBegins: near(askAt), returnAttack: near(endingAt + jumpAt) } };
  }, { from, world: process.env.WORLD === '1', start, ask, triesAfter, rate });
  fs.writeFileSync(out, wav(Buffer.from(result.pcm, 'base64')));
  const { pcm, ...metrics } = result;
  console.log(JSON.stringify({ out, ...metrics }));
} finally {
  if (browser) await browser.close();
  await server.close();
}

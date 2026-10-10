import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';
const dir = process.argv[2] ?? '/tmp/updraft-drowned-audio';
fs.mkdirSync(dir, { recursive: true });
const { browser, page } = await audioPage();
try {
  for (const name of ['rescue', 'without-cue', 'storm']) {
    const result = await page.evaluate(async name => {
      let seed = 2026;
      Math.random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
      const tick = 1 / 8, seconds = 38, { ctx, sound } = offlineSound(seconds), heard = [];
      for (const fn of ['cricket', 'owl', 'skylark', 'peep', 'bugle']) sound[fn] = () => {};
      const update = t => {
        const quiet = name !== 'storm' && t >= 8 && t < 25;
        sound.update(tick, { ...baseState, music: 'drowned', drownedQuiet: quiet,
          drownedScore: name === 'storm' ? t < 10 ? 'farewell' : 'storm' : t < 25 ? 'drift' : 'fog',
          sea: 1, land: 0, overLand: false, breeze: 0, night: .3, flockChatter: false, scripted: true,
          cues: name === 'rescue' && t === 10 ? ['becalmed'] : [] });
        for (const field of ['breezeGain', 'seaGain', 'rainGain', 'patterGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
          sound[field].gain.cancelScheduledValues(ctx.currentTime); sound[field].gain.value = 0;
        }
        const phase = sound.drownedScore?.current?.phase ?? null;
        if (heard.at(-1)?.phase !== phase) heard.push({ t, phase });
        if (sound.musicBus.gain.value < .99) throw new Error('Temporary quiet muted the cue bus');
      };
      update(0);
      let pause = ctx.suspend(tick);
      const rendering = ctx.startRendering();
      for (let i = 1; i < seconds / tick; i++) {
        await pause; update(i * tick);
        if (i + 1 < seconds / tick) pause = ctx.suspend((i + 1) * tick);
        await ctx.resume();
      }
      return { ...encodeAudio(await rendering), heard };
    }, name);
    fs.writeFileSync(`${dir}/${name}.wav`, wav(Buffer.from(result.pcm, 'base64')));
    if (name === 'storm') assert(result.heard.find(h => h.phase === 'storm').t <= 10.5, 'dark music follows the storm');
    else {
      assert(result.heard.some(h => h.t === 8 && h.phase === null), 'score fades out at cast off');
      assert(result.heard.some(h => h.t === 25 && h.phase === 'fog'), 'score resumes after the quiet');
    }
    delete result.pcm;
    console.log(name, result);
    fs.writeFileSync(`${dir}/${name}.json`, JSON.stringify(result, null, 2));
  }
  const a = fs.readFileSync(`${dir}/rescue.wav`), b = fs.readFileSync(`${dir}/without-cue.wav`);
  let power = 0, count = 0;
  for (let i = 44 + 11 * 24000 * 4; i < 44 + 20 * 24000 * 4; i += 2) {
    power += ((a.readInt16LE(i) - b.readInt16LE(i)) / 32768) ** 2; count++;
  }
  const cueRms = Math.sqrt(power / count);
  assert(cueRms > .002, `becalming tone missing from rendered output: ${cueRms}`);
  console.log(`Becalming tone rendered at ${(20 * Math.log10(cueRms)).toFixed(1)} dBFS RMS; cue bus remains open.`);
} finally { await browser.close(); }

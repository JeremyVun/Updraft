// The drowned village around the rescue and the storm, through the production soundscape: `village_approach.ogg`
// plays from the start and the rescue's quiet lets it go for good, the air dies in silence with the cue bus open,
// nothing resumes after the quiet, and the storm has no music (no recording, no pad). Writes the renders as wavs.
// Usage: node tools/drowned-audio-regression-check.mjs [outDir]. Vite on 5230, or BASE.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';
const dir = process.argv[2] ?? '/tmp/updraft-drowned-audio';
fs.mkdirSync(dir, { recursive: true });
const { browser, page } = await audioPage();
try {
  for (const name of ['rescue', 'storm']) {
    const result = await page.evaluate(async name => {
      let seed = 2026;
      Math.random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
      const tick = 1 / 8, seconds = 38, { ctx, sound } = offlineSound(seconds), heard = [];
      let pad = 0;
      for (const fn of ['cricket', 'owl', 'skylark', 'peep', 'bugle']) sound[fn] = () => {};
      const update = async t => {
        const quiet = name !== 'storm' && t >= 8 && t < 25;
        sound.update(tick, { ...baseState, music: 'drowned', drownedQuiet: quiet,
          drownedScore: name === 'storm' ? t < 10 ? 'farewell' : 'storm' : t < 25 ? 'drift' : 'fog',
          sea: 1, land: 0, overLand: false, breeze: 0, night: .3, flockChatter: false, scripted: true });
        for (const field of ['breezeGain', 'seaGain', 'rainGain', 'patterGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
          sound[field].gain.cancelScheduledValues(ctx.currentTime); sound[field].gain.value = 0;
        }
        await sound.preparedScore?.ready; await sound.villageScore?.ready;
        const playing = sound.villageScore ? 'approach' : null;
        if (heard.at(-1)?.playing !== playing) heard.push({ t, playing });
        pad = Math.max(pad, sound.padGain.gain.value);
        if (sound.musicBus.gain.value < .99) throw new Error('Temporary quiet muted the cue bus');
      };
      await update(0);
      let pause = ctx.suspend(tick);
      const rendering = ctx.startRendering();
      for (let i = 1; i < seconds / tick; i++) {
        await pause; await update(i * tick);
        if (i + 1 < seconds / tick) pause = ctx.suspend((i + 1) * tick);
        await ctx.resume();
      }
      return { ...encodeAudio(await rendering), heard, pad };
    }, name);
    fs.writeFileSync(`${dir}/${name}.wav`, wav(Buffer.from(result.pcm, 'base64')));
    if (name === 'storm') {
      assert(result.heard.every(h => h.playing === null) && result.pad < 1e-6, 'the storm has no music: no recording and no pad');
      assert(!(result.rmsDbFS > -100), `with the weather beds held off the storm renders silent (${result.rmsDbFS} dBFS)`);
    } else {
      assert(result.heard[0].t === 0 && result.heard[0].playing === 'approach', 'the approach plays from the village\'s start');
      assert(result.heard.some(h => h.t === 8 && h.playing === null), 'the rescue\'s quiet lets it go');
      assert(result.heard.length === 2, `nothing resumes after the quiet: ${JSON.stringify(result.heard)}`);
    }
    delete result.pcm;
    console.log(name, result);
    fs.writeFileSync(`${dir}/${name}.json`, JSON.stringify(result, null, 2));
  }
  const rescue = fs.readFileSync(`${dir}/rescue.wav`);
  const window = (file, from, to) => {
    let power = 0, count = 0;
    for (let i = 44 + from * 24000 * 4; i < 44 + to * 24000 * 4; i += 2) { power += (file.readInt16LE(i) / 32768) ** 2; count++; }
    return power / count;
  };
  assert(window(rescue, 10.5, 38) === 0, 'the air dies in silence, and nothing sounds after the quiet');
  console.log('The rescue\'s quiet lets the approach go; the becalming and everything after it are silent.');
} finally { await browser.close(); }

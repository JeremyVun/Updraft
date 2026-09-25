// Renders the opening's skein, fall and rescue through the production soundscape, offline and without the GPU.
// Usage: node tools/opening-fall-render.mjs <out.wav> [skeinAt]  (Vite on 5230; ffmpeg optional for the mp3)
// The skein defaults to 62 s into the score, so the fall crosses into the E♭ chord at 1:09 that the old cue clashed with.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.argv[2] ?? '/tmp/updraft-opening-fall.wav';
const skeinAt = Number(process.argv[3] ?? 62);
const { browser, page } = await audioPage();
try {
  const result = await page.evaluate(async skeinAt => {
    const { tuning } = await productionModule('/src/tuning.ts');
    const { flight, fall } = tuning.opening;
    const from = skeinAt - 8, droppedAt = skeinAt + flight, landedAt = droppedAt + fall;
    const leavingAt = landedAt + 20, end = leavingAt + 14, step = 1 / 16;
    const { ctx, sound } = offlineSound(end);
    const phase = t => t < skeinAt || t >= leavingAt ? 'wander' : t < droppedAt ? 'home' : 'rest';
    let wanted = 0, chapterHush = 0, hush = 0, nextCall = droppedAt;
    const cygnet = { pan: 0, distance: 12, active: true };
    const update = tick => {
      const t = tick * step, cues = [];
      if (Math.abs(t - droppedAt) < step / 2) cues.push('fallen');
      if (Math.abs(t - landedAt) < step / 2) cues.push('landed');
      if (t >= droppedAt && t < leavingAt - 4 && t >= nextCall) { cues.push('distress'); nextCall = t + (t < landedAt ? 1.35 : 2.2); }
      wanted = t < skeinAt ? 0 : t < droppedAt ? .55 : t < leavingAt ? 1 : .45;
      chapterHush += (wanted - chapterHush) * (1 - Math.exp(-step * .9));
      hush += (chapterHush - hush) * (1 - Math.exp(-step * 1.6));
      sound.update(step, { ...baseState, music: 'still', openingScore: phase(t), startingIsland: true,
        life: Math.min(1, .15 + t / 40), sea: .8, breeze: 0, hush, cygnet, flockChatter: false,
        scripted: t >= skeinAt && t < leavingAt, cues });
    };
    update(0);
    const ticks = Math.floor(end / step);
    let pause = ctx.suspend(step);
    const rendering = ctx.startRendering();
    for (let tick = 1; tick < ticks; tick++) {
      await pause; update(tick);
      if (tick + 1 < ticks) pause = ctx.suspend((tick + 1) * step);
      await ctx.resume();
    }
    const full = await rendering, rate = full.sampleRate, first = Math.floor(from * rate);
    const clip = new AudioBuffer({ numberOfChannels: 2, length: full.length - first, sampleRate: rate });
    for (let ch = 0; ch < 2; ch++) clip.copyToChannel(full.getChannelData(ch).subarray(first), ch);
    return { ...encodeAudio(clip), marks: { skein: skeinAt - from, fall: droppedAt - from, landed: landedAt - from, leaving: leavingAt - from } };
  }, skeinAt);
  fs.writeFileSync(out, wav(Buffer.from(result.pcm, 'base64')));
  if (spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-b:a', '192k', out.replace(/\.wav$/, '.mp3')]).status !== 0) console.warn('ffmpeg unavailable; wrote the wav only');
  delete result.pcm;
  console.log(JSON.stringify(result));
} finally { await browser.close(); }

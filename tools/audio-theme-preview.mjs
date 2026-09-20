// Compare the learned piano melody, current home recognition and a proposed reprise.
// Usage: node tools/audio-theme-preview.mjs [/tmp/updraft-audio-themes]
// Requires the dev server. Only the preview changes the melody; production is untouched.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { audioPage, wav } from './lib/audio-render.mjs';

const dir = path.resolve(process.argv[2] ?? '/tmp/updraft-audio-themes');
fs.mkdirSync(dir, { recursive: true });
const { browser, page } = await audioPage();
try {
  const lullaby = await page.evaluate(async () => {
    const { PianoStop } = await import('/src/story/piano.ts');
    const { piano } = await productionModule('/src/world/piano.ts');
    piano.now = 0;
    PianoStop.prototype.finish.call({ now: 0, releaseHands() {} }, { carry: { unstow() {} } }, true);
    return piano.queue.filter(n => n.active).map(({ at, midi, velocity }) => ({ at, midi, velocity }));
  });
  const reel = [], clips = [];
  for (const kind of ['piano-reference', 'current-home', 'lullaby-reprise']) {
    const result = await page.evaluate(async ({ kind, lullaby }) => {
      const seconds = kind === 'piano-reference' ? 14 : 20;
      const { ctx, sound } = offlineSound(seconds);
      // Solo instruments, with their real reverb and output gains; identical chime velocity in A and B.
      const piano = new audioModule.PianoStrings();
      piano.setOutput(sound.output);
      const { tuning } = await productionModule('/src/tuning.ts');
      if (kind === 'current-home') sound.phrase('unfold');
      if (kind === 'lullaby-reprise') {
        const octave = 12 * Math.round((74 - lullaby[0].midi) / 12);
        let at = 0.02;
        for (let i = 0; i < lullaby.length; i++) {
          // The learned notes, with a breath at each phrase ending, slowed for recognition at home.
          const beats = [3, 7, 11, 15].includes(i) ? 2 : i === lullaby.length - 1 ? 4 : 1;
          sound.chime(lullaby[i].midi + octave, 0.55, 0, at, Math.max(2.2, beats * 0.46 * 3));
          at += beats * 0.46;
        }
      }
      if (kind === 'piano-reference') {
        const pauses = lullaby.map(n => ctx.suspend(n.at));
        const rendered = ctx.startRendering();
        for (let i = 0; i < lullaby.length; i++) {
          await pauses[i];
          piano.note(lullaby[i].midi, lullaby[i].velocity, 0, tuning.piano.loudness);
          await ctx.resume();
        }
        return { seconds, ...encodeAudio(await rendered) };
      }
      return { seconds, ...encodeAudio(await ctx.startRendering()) };
    }, { kind, lullaby });
    const { pcm, ...metrics } = result;
    const samples = Buffer.from(pcm, 'base64');
    fs.writeFileSync(path.join(dir, `${kind}.wav`), wav(samples));
    reel.push(samples, Buffer.alloc(2 * 24000 * 4));
    clips.push({ kind, ...metrics });
  }
  fs.writeFileSync(path.join(dir, 'melody-comparison.wav'), wav(Buffer.concat(reel)));
  const source = Object.fromEntries(['src/audio/audio.ts', 'src/world/piano.ts', 'src/story/piano.ts', 'tools/audio-theme-preview.mjs']
    .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.writeFileSync(path.join(dir, 'comparison.json'), JSON.stringify({ source, lullaby, clips,
    timing: '0:00 piano reference; 0:16 A current home; 0:38 B proposed lullaby reprise. Solo instruments; no normalization.',
    note: 'Production piano and chime synthesis. The proposed reprise changes only this preview. Not a gameplay recording or listening sign-off.' }, null, 2));
  console.log(JSON.stringify({ dir, clips }, null, 2));
} finally { await browser.close(); }

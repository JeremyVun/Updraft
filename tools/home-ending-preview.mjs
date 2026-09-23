// A listening proposal only: the production Home score is unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const output = fs.mkdtempSync('/tmp/updraft-home-ending-');
const server = await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
let browser;
try {
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  const result = await session.page.evaluate(async () => {
    const clips = [];
    for (const door of [22, 55]) {
      const seconds = door + 27.5, { ctx, sound } = offlineSound(seconds);
      let entry;
      const update = tick => {
        const now = tick / 8;
        if (now === door + 2) {
          const score = sound.summitScore;
          const level = score.bus.gain.value;
          entry = { chord: [...score.chordAt()], level, jump: 0 };
          const cadence = [
            [.5, [54,57,61,64], [68,73]],
            [4, [47,57,61,64], [68,73]],
            [7.5, [47,57,63,66], [68,75]],
            [10.25, [47,57,63,67], [72,75]],
            [12.75, [52,56,63,66], [71,76]],
            [15.75, [52,56,61,66], [71,76]],
          ];
          score.voices.forEach((voice, i) => {
            for (const osc of voice.oscillators) {
              const before = osc.frequency.value;
              osc.frequency.cancelAndHoldAtTime(now);
              osc.frequency.setValueAtTime(before, now);
              for (const [at, chord] of cadence) osc.frequency.setTargetAtTime(440 * 2 ** ((chord[i] - 69) / 12), now + at, i === 0 ? .55 : .4);
              entry.jump = Math.max(entry.jump, Math.abs(osc.frequency.value - before));
            }
          });
          // Upper extensions emerge from the same instrument as the harmony opens out.
          for (let i = 0; i < 2; i++) {
            const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(score.bus);
            let remaining = 2;
            for (let k = 0; k < 2; k++) {
              const osc = ctx.createOscillator();
              osc.type = k === 0 ? 'triangle' : 'sine'; osc.detune.value = k === 0 ? -6 : 7;
              osc.frequency.value = 440 * 2 ** ((cadence[0][2][i] - 69) / 12);
              for (const [at, , upper] of cadence) osc.frequency.setTargetAtTime(440 * 2 ** ((upper[i] - 69) / 12), now + at, .5);
              osc.connect(gain); osc.start(now); osc.stop(door + 24);
              osc.onended = () => { osc.disconnect(); if (--remaining === 0) gain.disconnect(); };
            }
            gain.gain.setTargetAtTime(.045, now + .5, 1.5);
            gain.gain.setTargetAtTime(.10, now + 7.5, 2.2);
          }
          score.update = () => {
            const t = ctx.currentTime - door;
            const swell = 1 + .15 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 2) / 21.5)));
            const fade = 1 - Math.min(1, Math.max(0, (t - 20.5) / 3));
            score.bus.gain.setTargetAtTime(level * swell * fade, ctx.currentTime, .3);
          };
        }
        sound.update(.125, { ...baseState, music: 'home', summitScore: 'home', night: 1,
          land: 0, meadow: 0, flockChatter: false, silence: now >= door + 23.5 });
        for (const name of ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
          sound[name].gain.cancelScheduledValues(ctx.currentTime); sound[name].gain.value = 0;
        }
      };
      update(0);
      let pause = ctx.suspend(.125);
      const rendering = ctx.startRendering();
      for (let tick = 1; tick < seconds * 8; tick++) {
        await pause; update(tick);
        if (tick + 1 < seconds * 8) pause = ctx.suspend((tick + 1) / 8);
        await ctx.resume();
      }
      const rendered = await rendering;
      const excerpt = new AudioBuffer({ numberOfChannels: 2, length: 35.5 * 24000, sampleRate: 24000 });
      for (let ch = 0; ch < 2; ch++) excerpt.copyToChannel(rendered.getChannelData(ch).subarray((door - 8) * 24000), ch);
      clips.push({ door, entry, ...encodeAudio(excerpt) });
    }
    return clips;
  });
  const pieces = [];
  for (const [i, clip] of result.entries()) {
    assert.equal(clip.clipped, 0);
    assert.equal(clip.entry.jump, 0, 'The scripted handoff must preserve every oscillator frequency');
    if (i) pieces.push(Buffer.alloc(2 * 24000 * 4));
    pieces.push(Buffer.from(clip.pcm, 'base64'));
  }
  fs.writeFileSync(path.join(output, 'home.wav'), wav(Buffer.concat(pieces)));
  execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(output, 'home.wav'), '-codec:a', 'libmp3lame', '-q:a', '2', path.join(output, 'home.mp3')]);
  const report = { output, excerptStarts: [0, 37.5], doorAt: 8, scriptedEntryAt: 10,
    clips: result.map(({ pcm, ...metrics }) => metrics) };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  if (browser) await browser.close();
  await server.close();
}

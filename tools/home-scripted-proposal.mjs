// Render the accepted production Home ending, including its post-reverb cut.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const output = fs.mkdtempSync('/tmp/updraft-home-scripted-');
const lead = 10;
const events = [
  [0, 'Successful updraft'], [3.017, 'Independent flight'], [20.817, 'Goodbye'],
  [24.05, 'Family departs'], [40.067, 'Walk over the crest'], [53.55, 'Cottage appears'],
  [58.167, 'Unfolding'], [62.383, 'Recognition'], [70.417, 'Refolding'],
  [75.067, 'Paper flies away'], [82.083, 'Walk home'], [90.933, 'Doorway'],
  [95.133, 'Door closes'], [106.55, 'Final harmonic arrival'],
  [114.5, 'Musical silence'], [116.5, 'Credits'],
];
const server = await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
let browser;
try {
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  const result = await session.page.evaluate(async ({ lead }) => {
    const { HOME_ENDING_CHORDS } = await productionModule('/src/audio/summit-score.ts');
    const { HOME_ENDING } = await productionModule('/src/story/home-ending.ts');
    const seconds = lead + 120, rate = 60, { ctx, sound } = offlineSound(seconds);
    const smooth = (t, from, to) => {
      const x = Math.max(0, Math.min(1, (t - from) / (to - from)));
      return x * x * (3 - 2 * x);
    };
    let entry, scoreStarted = false;
    const gate = [];
    const update = tick => {
      const now = tick / rate, t = now - lead;
      const before = now === lead ? sound.summitScore.voices.flatMap(v => v.oscillators.map(o => o.frequency.value)) : null;
      sound.update(1 / rate, { ...baseState, music: 'home', summitScore: 'approach',
        homeEndingTime: t >= 0 ? t : undefined,
        night: smooth(t, 80, 92), land: 0, meadow: 0, flockChatter: false,
        silence: t >= HOME_ENDING.musicEndsAt, scripted: true });
      if (before) {
        const after = sound.summitScore.voices.flatMap(v => v.oscillators.map(o => o.frequency.value));
        entry = { pitchJumpHz: Math.max(...before.map((v,i) => Math.abs(v-after[i]))) };
      }
      if (t >= 113 && t <= 115) gate.push({at:t,gain:sound.backgroundGate.gain.value});
      if (!scoreStarted && sound.summitScore) {
        // Ten seconds from the loved returning phrase demonstrate the live-to-scripted entrance.
        sound.summitScore.epoch = ctx.currentTime - 127.5;
        scoreStarted = true;
      }
      for (const name of ['breezeGain','rainGain','patterGain','seaGain','gustGain','whistleGain','rustleGain','liftGain']) {
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
    const windows = [];
    for (let at = lead + 1; at < lead + 114; at += 1) {
      let power = 0;
      const samples = rendered.getChannelData(0).subarray(at * 24000, (at + 1) * 24000);
      for (const v of samples) power += v * v;
      windows.push({ at: at - lead, rmsDbFS: 10 * Math.log10(power / samples.length) });
    }
    const credit = rendered.getChannelData(0).subarray(Math.round((lead + HOME_ENDING.creditsAt) * 24000), Math.round((lead + HOME_ENDING.creditsAt + 1) * 24000));
    let creditPeak=0; for (const v of credit) creditPeak=Math.max(creditPeak,Math.abs(v));
    return { ...encodeAudio(rendered), entry, keys: HOME_ENDING_CHORDS, windows, gate, creditPeak };
  }, { lead });
  assert.equal(result.clipped, 0, 'The proposal must not clip');
  assert.equal(result.entry.pitchJumpHz, 0, 'Commitment must retain the sounding oscillator pitches');
  assert(result.windows.filter(w => w.at < 111).every(w => w.rmsDbFS > -50), 'No unintended musical rest before the final fade');
  assert(result.gate.filter(p=>p.at>=114.55).every(p=>p.gain===0), 'The short fade must also finish the reverb tail');
  assert(result.creditPeak<.00001, 'Credits begin in musical silence');
  fs.writeFileSync(path.join(output, 'home.wav'), wav(Buffer.from(result.pcm, 'base64')));
  execFileSync('ffmpeg', ['-v','error','-i',path.join(output,'home.wav'),'-codec:a','libmp3lame','-q:a','2',path.join(output,'home.mp3')]);
  execFileSync('ffmpeg', ['-v','error','-ss','78','-i',path.join(output,'home.wav'),'-codec:a','libmp3lame','-q:a','2',path.join(output,'ending.mp3')]);
  execFileSync('ffmpeg', ['-v','error','-ss','100','-i',path.join(output,'home.wav'),'-codec:a','libmp3lame','-q:a','2',path.join(output,'closing.mp3')]);
  const { pcm, ...metrics } = result;
  const report = { output, lead, events: events.map(([at, label]) => ({ at: at + lead, label })), ...metrics };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, entry: result.entry, peakDbFS: result.peakDbFS, clipped: result.clipped, events: report.events }));
} finally {
  if (browser) await browser.close();
  await server.close();
}

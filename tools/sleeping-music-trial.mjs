// Render the current Sleeping arrangement with long player-paced sections and its real flight cue.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage, wav } from './lib/audio-render.mjs';

const output = fs.mkdtempSync('/tmp/updraft-sleeping-trial-');
const server = await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
let browser;
try {
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  const result = await session.page.evaluate(async () => {
    const seconds = 164, { ctx, sound } = offlineSound(seconds);
    const update = tick => {
      const now = tick / 8;
      const phase = now < 40 ? 'shelter' : now < 53 ? 'cold' : now < 109 ? 'climb' : now < 125 ? 'summit' : 'morning';
      sound.update(.125, { ...baseState, music: now < 125 ? 'wood' : 'sea', sleepingScore: phase,
        land: 0, meadow: 0, night: 1, hush: .8, flockChatter: false,
        cues: now === 125 ? ['lifted'] : [], silence: now >= 160 });
      for (const name of ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain']) {
        sound[name].gain.cancelScheduledValues(ctx.currentTime);
        sound[name].gain.value = 0;
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
    const buffer = await rendering;
    const rms = (from, to) => {
      let power = 0, count = 0;
      for (let ch = 0; ch < 2; ch++) for (const v of buffer.getChannelData(ch).slice(from * 24000, to * 24000)) {
        power += v * v; count++;
      }
      return 10 * Math.log10(Math.max(1e-20, power / count));
    };
    return { ...encodeAudio(buffer), frost: rms(49, 52),
      shelter: Array.from({ length: 13 }, (_, i) => rms(12 + i * 2, 14 + i * 2)),
      journey: Array.from({ length: 33 }, (_, i) => rms(57 + i * 2, 59 + i * 2)),
    };
  });
  assert.equal(result.clipped, 0);
  assert(result.frost < -90, 'Frost must retain a genuine musical silence');
  assert(Math.min(...result.shelter) > -60, 'Bedtime must not fade away before frost');
  assert(Math.min(...result.journey) > -60, 'The journey must continue across loops and the summit');
  const { pcm, ...metrics } = result;
  fs.writeFileSync(path.join(output, 'sleeping.wav'), wav(Buffer.from(pcm, 'base64')));
  execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(output, 'sleeping.wav'), '-codec:a', 'libmp3lame', '-q:a', '2', path.join(output, 'sleeping.mp3')]);
  const report = { output, sections: { bedtime: 0, frost: 40, journey: 53, summit: 109, return: 125, fade: 160 }, ...metrics };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  if (browser) await browser.close();
  await server.close();
}

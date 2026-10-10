// Production whale calls through WorldFoley and the shared audio output; no GPU.
// BASE selects a dev server. OUT selects the /tmp evidence prefix. MUTATE=thin proves the speaker-band guard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const out = process.env.OUT ?? '/tmp/updraft-whale-voice';
const { browser, page } = await audioPage();
try {
  if (process.env.MUTATE === 'thin') await page.route('**/src/audio/whale-voice.ts*', async route => {
    const response = await route.fetch(), source = await response.text();
    assert(source.includes('const HARMONICS ='));
    await route.fulfill({ response, body: source.replace(/const HARMONICS = \[[^;]+;/,
      'const HARMONICS = [0, 1, 0.22, 0.08, 0.035, 0.015, 0.006];') });
  });
  const report = [];
  for (const kind of ['whale-moan', 'whale-song', 'whale-goodbye', 'whale-deep']) {
    const r = await page.evaluate(async kind => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { Foley } = await import('/src/audio/foley.ts');
      const { WorldFoley } = await import('/src/audio/world-foley.ts');
      const { ctx, sound } = offlineSound(14);
      await sound.ready;
      sound.master.gain.cancelScheduledValues(0);
      sound.master.gain.setValueAtTime(0.9, 0);
      const foley = new Foley(); foley.setOutput(sound.output);
      const camera = new THREE.PerspectiveCamera();
      camera.updateMatrixWorld();
      new WorldFoley(foley, camera).whale(kind, new THREE.Vector3(0, 0, -40));
      const buffer = await ctx.startRendering();
      const speaker = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);
      const source = speaker.createBufferSource(); source.buffer = buffer;
      const highpass = speaker.createBiquadFilter();
      highpass.type = 'highpass'; highpass.frequency.value = 180; highpass.Q.value = Math.SQRT1_2;
      source.connect(highpass).connect(speaker.destination); source.start();
      const band = encodeAudio(await speaker.startRendering());
      return { ...encodeAudio(buffer), speakerRms: band.rmsDbFS };
    }, kind);
    fs.writeFileSync(`${out}-${kind}.wav`, wav(Buffer.from(r.pcm, 'base64')));
    delete r.pcm; report.push({ kind, ...r });
  }
  fs.writeFileSync(`${out}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  for (const r of report) {
    assert.equal(r.clipped, 0, `${r.kind} clips`);
    assert(r.peakDbFS > -30 && r.peakDbFS < -12, `${r.kind} retains an audible, controlled level`);
  }
  assert(report[0].speakerRms > -44, 'the first low moan must retain body above 180 Hz for small speakers');
} finally {
  await browser.close();
}

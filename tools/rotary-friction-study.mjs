import fs from 'node:fs';
import { audioPage, wav } from './lib/audio-render.mjs';

const prefix = process.env.OUT ?? '/tmp/updraft-procedural-creak';
const { browser, page } = await audioPage();
try {
  const rendered = await page.evaluate(async () => {
    const { rotaryFriction } = await productionModule('/src/audio/rotary-friction.ts');
    const encoded = await (await fetch('/assets/audio-reference/rotary-creak/accepted-clips.json')).json();
    const ctx = new OfflineAudioContext(2, 24000, 24000);
    const result = [];
    for (let variant = 0; variant < 2; variant++) {
      const bytes = Uint8Array.from(atob(encoded.clips[variant]), c => c.charCodeAt(0));
      const pcm = new DataView(bytes.buffer);
      const reference = ctx.createBuffer(2, bytes.length / 2, encoded.sampleRate);
      for (let c = 0; c < 2; c++) for (let i = 0; i < reference.length; i++) reference.getChannelData(c)[i] = pcm.getInt16(i * 2, true) / 32768;
      const start = performance.now(), mono = rotaryFriction(ctx, variant), synthesisMs = performance.now() - start;
      const stereo = ctx.createBuffer(2, mono.length, mono.sampleRate);
      for (let c = 0; c < 2; c++) stereo.copyToChannel(mono.getChannelData(0), c);
      result.push({ variant, synthesisMs, generated: encodeAudio(stereo), reference: encodeAudio(reference) });
    }
    return result;
  });
  const sequence = [];
  for (const take of rendered) {
    for (const kind of ['reference', 'generated']) {
      const pcm = Buffer.from(take[kind].pcm, 'base64');
      fs.writeFileSync(`${prefix}-${take.variant}-${kind}.wav`, wav(pcm));
      sequence.push(Buffer.alloc(24000 * 4 * .25), pcm, Buffer.alloc(24000 * 4 * .5));
      delete take[kind].pcm;
    }
  }
  fs.writeFileSync(`${prefix}-comparison.wav`, wav(Buffer.concat(sequence)));
  console.log(JSON.stringify(rendered, null, 2));
} finally { await browser.close(); }

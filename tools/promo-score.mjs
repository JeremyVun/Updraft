// Render one of the approved score studies whole, at 48 kHz, through the game's own instruments and reverb, as a bed
// for the promo edits. Usage: node tools/promo-score.mjs <sea|meadow|birches|lines> <out.wav>
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { audioPage } from './lib/audio-render.mjs';

const MODULES = { sea: ['sea-score', 'SeaScore', 'SEA_AUDITION_NOTES'], meadow: ['meadow-score', 'MeadowScore', 'MEADOW_AUDITION_NOTES'],
  birches: ['birches-score', 'BirchesScore', 'BIRCHES_AUDITION_NOTES'], lines: ['lines-score', 'LinesScore', 'LINES_AUDITION_NOTES'] };
const [name, out] = process.argv.slice(2);
if (!MODULES[name] || !out) { console.error('usage: node tools/promo-score.mjs <sea|meadow|birches|lines> <out.wav>'); process.exit(1); }

const server = await createServer({ configFile: false, envDir: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
let browser;
try {
  const session = await audioPage(`http://127.0.0.1:${server.httpServer.address().port}/`);
  browser = session.browser;
  const raw = `${out}.f32`;
  fs.rmSync(raw, { force: true });
  await session.page.exposeFunction('saveAudio', b64 => fs.appendFileSync(raw, Buffer.from(b64, 'base64')));
  const report = await session.page.evaluate(async ([file, cls, list]) => {
    const mod = await productionModule(`/src/audio/${file}.ts`), notes = mod[list];
    const seconds = Math.ceil(Math.max(...notes.map(n => n.at + n.duration))) + 6, RATE = 48000;
    const ctx = new OfflineAudioContext(2, seconds * RATE, RATE), Native = window.AudioContext;
    window.AudioContext = function () { return ctx; };
    const sound = new audioModule.Soundscape();
    try { sound.start(); } finally { window.AudioContext = Native; }
    while (!sound.reverbConvolver.buffer) sound.synthesise(1);
    // The background's path in the game: dry, and a 0.9 × 0.55 send into the shared reverb, both under the 0.9 master.
    const dry = ctx.createGain(), send = ctx.createGain(), wet = ctx.createConvolver(), master = ctx.createGain();
    dry.connect(master); send.gain.value = 0.9 * 0.55; dry.connect(send).connect(wet).connect(master);
    wet.buffer = sound.reverbConvolver.buffer; master.gain.value = 0.9; master.connect(ctx.destination);
    const score = new mod[cls](ctx, dry), part = { bus: dry, voices: new Set(), stopped: false };
    for (const note of notes) score.play(part, note, note.at + 0.5);
    const buffer = await ctx.startRendering();
    let peak = 0;
    for (let o = 0; o < buffer.length; o += RATE) {
      const n = Math.min(RATE, buffer.length - o), f = new Float32Array(n * 2), l = buffer.getChannelData(0), r = buffer.getChannelData(1);
      for (let i = 0; i < n; i++) { f[i * 2] = l[o + i]; f[i * 2 + 1] = r[o + i]; peak = Math.max(peak, Math.abs(l[o + i]), Math.abs(r[o + i])); }
      const bytes = new Uint8Array(f.buffer); let bin = '';
      for (let i = 0; i < bytes.length; i += 16384) bin += String.fromCharCode(...bytes.subarray(i, i + 16384));
      await saveAudio(btoa(bin));
    }
    return { seconds, peakDb: 20 * Math.log10(peak), notes: notes.length };
  }, MODULES[name]);
  await new Promise((resolve, reject) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', raw,
    '-c:a', 'pcm_f32le', out]).on('close', c => c ? reject(new Error(`ffmpeg ${c}`)) : resolve()));
  fs.rmSync(raw);
  console.log(JSON.stringify({ out, ...report }));
} finally {
  await browser?.close();
  await server.close();
}

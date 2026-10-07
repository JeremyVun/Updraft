// Renders the cat's calls from the shipping src/creatures/cat/voice.ts to WAV, several takes each, offline in Chrome.
// Usage: node tools/cat-voice.mjs <out-dir> [takes=3] [--calls mew,plea,chirrup,yowl] [--length <s>] [--room] [--rate 48000]
// BASE picks the dev server (default http://127.0.0.1:5230/). Takes are dry by default, for measuring; --room sends
// them through the game's reverb and master compressor as heard in play. Writes <call>-<n>.wav and prints a summary.
import fs from 'node:fs';
import path from 'node:path';
import { audioPage, wav } from './lib/audio-render.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const room = args.includes('--room') && !!args.splice(args.indexOf('--room'), 1);
const calls = (flag('--calls') ?? 'mew,plea,chirrup,yowl').split(',');
const lengthArg = flag('--length');
const length = lengthArg === undefined ? null : Number(lengthArg);
const rate = Number(flag('--rate') ?? 48000);
const [outDir = '/tmp/updraft-cat-voice', takes = '3'] = args;
fs.mkdirSync(outDir, { recursive: true });

const { browser, page } = await audioPage();
try {
  const results = await page.evaluate(async ({ calls, takes, length, room, rate }) => {
    const { CatVoice } = await productionModule('/src/creatures/cat/voice.ts');
    const impulse = (ctx, seconds) => {
      const len = Math.floor(ctx.sampleRate * seconds), buffer = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buffer.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * Math.min(1, i / (ctx.sampleRate * 0.012));
      }
      return buffer;
    };
    const render = async (call, take) => {
      const seconds = room ? 5 : 2.2;
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
      const bus = ctx.createGain(), reverb = ctx.createGain();
      if (room) {
        // The game's master: 0.9 into a gentle compressor, with the shared 4.5 s reverb at 0.55 feeding it.
        const comp = new DynamicsCompressorNode(ctx, { threshold: -18, ratio: 3 });
        bus.gain.value = 0.9;
        bus.connect(comp).connect(ctx.destination);
        reverb.gain.value = 0.55;
        reverb.connect(new ConvolverNode(ctx, { buffer: impulse(ctx, 4.5) })).connect(bus);
      } else bus.connect(ctx.destination);
      const voice = new CatVoice();
      voice.setOutput({ ctx, bus, reverb });
      const len = length ?? null;
      if (call === 'mew') voice.mew(0, 1, 0, len ?? 0.6 + Math.random() * 0.15);
      else if (call === 'plea') { const plea = 0.7 + 0.3 * (0.85 + 0.15 * Math.random()); voice.mew(0, 1, plea, len ?? 0.6 + 0.3 * plea + Math.random() * 0.15); }
      else if (call === 'chirrup') voice.chirrup(0, 1);
      else if (typeof voice[call] === 'function') len === null ? voice[call](0, 1) : voice[call](0, 1, len);
      else return null;
      const buffer = await ctx.startRendering();
      return { call, take, ...encodeAudio(buffer) };
    };
    const out = [];
    for (const call of calls) for (let take = 1; take <= takes; take++) { const r = await render(call, take); if (r) out.push(r); }
    return out;
  }, { calls, takes: Number(takes), length, room, rate });
  for (const r of results) {
    const file = path.join(outDir, `${r.call}-${r.take}.wav`);
    fs.writeFileSync(file, wav(Buffer.from(r.pcm, 'base64'), rate));
    console.log(`${file}  peak ${r.peakDbFS.toFixed(1)} dBFS  rms ${r.rmsDbFS.toFixed(1)} dBFS${r.clipped ? `  clipped ${r.clipped}` : ''}`);
  }
} finally { await browser.close(); }

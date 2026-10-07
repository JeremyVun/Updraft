// Renders the drowned village crossings' sounds from the shipping src/audio/foley.ts to WAV, offline in Chrome,
// through the game's reverb and master compressor as heard in play (--dry for the bare sound).
// Usage: node tools/crossings-foley.mjs <out-dir> [takes=2] [--dry] [--rate 48000] [--also tub,splash,...]
// BASE picks the dev server (default http://127.0.0.1:5230/). Writes, in listening order, each sound's takes and then
// the two crossings as they would be heard, and prints the level of each; --also adds other material sounds after
// them for comparison.
import fs from 'node:fs';
import path from 'node:path';
import { audioPage, wav } from './lib/audio-render.mjs';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const dry = args.includes('--dry') && !!args.splice(args.indexOf('--dry'), 1);
const rate = Number(flag('--rate') ?? 48000);
const also = flag('--also')?.split(',') ?? [];
const [outDir = '/tmp/updraft-crossings-foley', takes = '2'] = args;
fs.mkdirSync(outDir, { recursive: true });

/** Each sound on its own at full strength, then the two crossings in play order: [seconds, sound, strength]. */
const SINGLES = ['tree-creak', 'roots-give', 'root-tear', 'tree-fall', 'swing-creak', 'bough-creak', 'slate-land'];
const SEQUENCES = {
  'tree-sequence': [[0, 'tree-creak', 0.45], [1.6, 'tree-creak', 0.7], [3.2, 'roots-give', 0.95], [4.9, 'tree-creak', 0.5],
    [6.4, 'tree-creak', 0.8], [7.4, 'root-tear', 1], [9.6, 'tree-fall', 1]],
  'swing-sequence': [[0, 'bough-creak', 0.4], [2.9, 'bough-creak', 0.6], [5.8, 'bough-creak', 0.8], [8.6, 'cloth', 0.5],
    [9.5, 'slate-land', 1], [11.6, 'bough-creak', 0.55], [14.5, 'bough-creak', 0.25]],
};

const { browser, page } = await audioPage();
try {
  const results = await page.evaluate(async ({ singles, sequences, also, takes, dry, rate }) => {
    const { Foley } = await productionModule('/src/audio/foley.ts');
    const impulse = (ctx, seconds) => {
      const len = Math.floor(ctx.sampleRate * seconds), buffer = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buffer.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * Math.min(1, i / (ctx.sampleRate * 0.012));
      }
      return buffer;
    };
    const render = async (name, cues, seconds) => {
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
      const bus = ctx.createGain(), reverb = ctx.createGain();
      if (dry) bus.connect(ctx.destination);
      else {
        // The game's master: 0.9 into a gentle compressor, with the shared 4.5 s reverb at 0.55 feeding it.
        const comp = new DynamicsCompressorNode(ctx, { threshold: -18, ratio: 3 });
        bus.gain.value = 0.9;
        bus.connect(comp).connect(ctx.destination);
        reverb.gain.value = 0.55;
        reverb.connect(new ConvolverNode(ctx, { buffer: impulse(ctx, 4.5) })).connect(bus);
      }
      const foley = new Foley();
      foley.setOutput({ ctx, bus, reverb });
      // Foley schedules from the context's clock, so each cue is played from a suspension at its time.
      for (const [t, kind, strength] of cues) {
        if (t === 0) foley.material(kind, strength, 0);
        else ctx.suspend(t).then(() => { foley.material(kind, strength, 0); ctx.resume(); });
      }
      const buffer = await ctx.startRendering();
      return { name, ...encodeAudio(buffer) };
    };
    const out = [];
    for (const kind of singles) for (let take = 1; take <= takes; take++) out.push(await render(`${kind}-${take}`, [[0, kind, 1]], dry ? 3 : 5.5));
    for (const [name, cues] of Object.entries(sequences)) out.push(await render(name, cues, cues.at(-1)[0] + 5));
    for (const kind of also) out.push(await render(kind, [[0, kind, 1]], dry ? 3 : 5.5));
    return out;
  }, { singles: SINGLES, sequences: SEQUENCES, also, takes: Number(takes), dry, rate });
  results.forEach((r, i) => {
    const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}-${r.name}.wav`);
    fs.writeFileSync(file, wav(Buffer.from(r.pcm, 'base64'), rate));
    console.log(`${file}  peak ${r.peakDbFS.toFixed(1)} dBFS  rms ${r.rmsDbFS.toFixed(1)} dBFS${r.clipped ? `  clipped ${r.clipped}` : ''}`);
  });
} finally { await browser.close(); }

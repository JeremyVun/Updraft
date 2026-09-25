// Held silent gains (perf-bakes E1) against the previous graph: the same scripted sequences rendered offline through both
// soundscapes with the same seed must match to below −100 dBFS, and each sequence must hold and release layers.
// BASE=<this checkout's Vite> OLD=<a Vite serving the previous commit> node tools/audio-silence-check.mjs
// REPS=n repeats each pair to time the renders (offline render time is the audio thread's CPU, without the realtime clock).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audioPage } from './lib/audio-render.mjs';

const old = process.env.OLD;
if (!old) throw Error('OLD must point at a Vite server for the previous graph');
const reps = Number(process.env.REPS ?? 1), rate = Number(process.env.RATE ?? 48000);
const { browser, page } = await audioPage();
// Chrome denies a page loopback requests to another port; fetching them outside the page does the same thing.
await page.route(new URL('**', old).href, async route => {
  const response = await route.fetch();
  await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
});
try {
  const result = await page.evaluate(async ({ old, reps, rate }) => {
    const previous = await import(new URL('src/audio/audio.ts', old).href);
    const { ARRIVAL_MUSIC } = await productionModule('/src/audio/arrival-music.ts');
    const smooth = (t, a, b) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
    const bump = (t, a, b, c, d) => smooth(t, a, b) * (1 - smooth(t, c, d));
    const layers = ['breezeGain', 'rainGain', 'patterGain', 'seaGain', 'gustGain', 'whistleGain', 'rustleGain', 'liftGain', 'padGain', 'musicBus', 'backgroundBus'];
    const sequences = {
      // Player wind, lift, a shower, winter weather and the piano taking the pad away, each surrounded by calm.
      wind: { seconds: 100, state: t => ({
        music: 'meadow', land: 1, overLand: t < 70, meadow: 0,
        gust: 22 * bump(t, 8, 9, 10, 11) + 6 * bump(t, 13, 13.5, 14, 14.5),
        charge: .8 * bump(t, 25, 25.5, 27, 28),
        shower: .8 * bump(t, 40, 45, 50, 56),
        winterGust: .9 * bump(t, 62, 63, 66, 67),
        piano: bump(t, 80, 81, 86, 88),
        cues: t === 30 ? ['delight'] : [],
      }) },
      // Composed scores take the pad to 0 and give it back; the sea score's mood has no pad at all.
      scores: { seconds: 90, state: t => t < 25 ? { music: 'meadow', meadowScore: 'walk' }
        : t < 45 ? { music: 'meadow' }
        : t < 70 ? { music: 'sea', seaScore: 'open', sea: 1, land: 0 }
        : { music: 'wood', forestWind: true, land: 1, gust: 18 * bump(t, 75, 75.5, 76, 77) } },
      // Meadow to Birches: the arrival fade, rest and swap to a fresh background echo, sailing with the pad held off.
      arrival: { seconds: 45, state: t => ({ land: 0, ...(t < 28 ? { music: 'meadow', meadowScore: 'walk' } : ARRIVAL_MUSIC.birches),
        arrivalMusic: t >= 20 && t < 28 ? 'birches' : undefined, gust: 16 * bump(t, 33, 33.5, 34, 35) }) },
      // The ending: the music is cut for good and both buses fall to 0 under a live pad.
      ending: { seconds: 60, state: t => ({ music: 'home', summitScore: 'approach', night: smooth(t, 0, 10), land: 0, meadow: 0,
        flockChatter: false, scripted: true, silence: t >= 20, gust: 20 * bump(t, 40, 41, 42, 43) }) },
    };
    const step = 1 / 60;
    async function render(module, sequence, track) {
      let seed = 424242;
      const random = Math.random;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      try {
        const { seconds, state } = sequence;
        const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
        const Native = window.AudioContext;
        window.AudioContext = function () { return ctx; };
        const sound = new module.Soundscape();
        try { sound.start(); } finally { window.AudioContext = Native; }
        Object.defineProperty(sound, 'running', { get: () => true });
        const held = Object.fromEntries(layers.map(k => [k, { seconds: 0, entries: 0, releases: 0 }]));
        const stages = [];
        const update = tick => {
          const t = Math.round(tick * step * 1e6) / 1e6;
          sound.update(step, { ...baseState, breeze: .3, ...state(t) });
          const stage = sound.arrivalTransition.stage;
          if (stage !== stages.at(-1)) stages.push(stage);
          if (!track) return;
          for (const k of layers) {
            const f = sound.fades.get(sound[k].gain), h = held[k];
            if (f?.held) { if (!h.was) h.entries++; h.seconds += step; } else if (h.was) h.releases++;
            h.was = !!f?.held;
          }
        };
        update(0);
        const ticks = Math.floor(seconds / step);
        let pause = ctx.suspend(step);
        const started = performance.now();
        const rendering = ctx.startRendering();
        for (let tick = 1; tick < ticks; tick++) {
          await pause; update(tick);
          if (tick + 1 < ticks) pause = ctx.suspend((tick + 1) * step);
          await ctx.resume();
        }
        const buffer = await rendering;
        for (const h of Object.values(held)) delete h.was;
        return { buffer, ms: performance.now() - started, held, stages };
      } finally { Math.random = random; }
    }
    const report = {};
    for (const [name, sequence] of Object.entries(sequences)) {
      const times = { old: [], new: [] };
      let compared;
      for (let r = 0; r < reps; r++) {
        const a = await render(previous, sequence, false), b = await render(audioModule, sequence, true);
        times.old.push(Math.round(a.ms)); times.new.push(Math.round(b.ms));
        if (compared) continue;
        let max = 0, at = 0, differing = 0, peak = 0, power = 0;
        for (let ch = 0; ch < 2; ch++) {
          const x = a.buffer.getChannelData(ch), y = b.buffer.getChannelData(ch);
          for (let i = 0; i < x.length; i++) {
            const d = Math.abs(x[i] - y[i]);
            peak = Math.max(peak, Math.abs(x[i])); power += x[i] * x[i];
            if (d) differing++;
            if (d > max) { max = d; at = i / rate; }
          }
        }
        compared = { maxDiffDbFS: max ? 20 * Math.log10(max) : -Infinity, maxDiffAt: at, differingSamples: differing,
          samples: a.buffer.length * 2, stages: b.stages, peakDbFS: 20 * Math.log10(peak), rmsDbFS: 10 * Math.log10(power / (a.buffer.length * 2)),
          held: Object.fromEntries(Object.entries(b.held).filter(([, h]) => h.entries).map(([k, h]) => [k, { ...h, seconds: Math.round(h.seconds * 10) / 10 }])) };
      }
      report[name] = { ...compared, renderMs: times };
    }
    return report;
  }, { old, reps, rate });
  fs.writeFileSync('/tmp/updraft-audio-silence.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  for (const [name, r] of Object.entries(result)) {
    assert(r.maxDiffDbFS < -100, `${name}: differs from the previous graph by ${r.maxDiffDbFS.toFixed(1)} dBFS`);
    assert(Object.values(r.held).some(h => h.releases > 0), `${name}: no held layer was released`);
  }
  console.log('audio-silence-check: all sequences match the previous graph below −100 dBFS');
} finally { await browser.close(); }

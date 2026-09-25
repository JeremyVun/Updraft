// Audio rendering cost per chapter: Chrome's CPU with sound on against muted (muting suspends the context), plus a
// census of the nodes running while silent and what disconnecting each group saves. Desktop CPU, not iPad energy.
// node tools/audio-cost.mjs [island meadow sea ...]  WINDOW_S=8 REPS=3 ABLATE=island,meadow,sea OUT=/tmp/updraft-audio-cost
// Windows alternate so drift in the game's own CPU cancels; each row is CPU ms per wall second (1000 = one core).
// Ablations disconnect a group's outputs, so nothing pulls it: pad (8 pad oscillators), noise (the 8 looping noise-layer
// sources), reverbs (the two 4.5 s convolvers' outputs), silent (pad voices and noise layers whose gain is under 1e-4).
// PAIRS=unheld,onereverb adds paired windows for every chapter against the current graph: `unheld` re-targets silent
// gains every frame as before perf-bakes E1; `onereverb` sends the background's echo into the shared reverb, as
// `reverb=one` does once its gates are open. STIR=1 circles the pointer through every window, so the player's wind
// layers sound as they do in play. QUERY adds URL parameters.
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const out = process.env.OUT ?? '/tmp/updraft-audio-cost';
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const WINDOW = Number(process.env.WINDOW_S ?? 8) * 1000, REPS = Number(process.env.REPS ?? 3);
const ablate = (process.env.ABLATE ?? 'island,meadow:walk,sea').split(',').filter(Boolean);
const pairs = (process.env.PAIRS ?? '').split(',').filter(Boolean);
const stir = process.env.STIR === '1', query = process.env.QUERY ? '&' + process.env.QUERY : '';
const chapters = process.argv.slice(2).length ? process.argv.slice(2) : ['island', 'washing', 'meadow:walk', 'birches', 'drowned', 'wood', 'sleeping', 'sea', 'mirror', 'boats', 'jetty'];
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const instrument = () => {
  const reg = window.__audioReg = { nodes: [], live: new Set() };
  const P = BaseAudioContext.prototype;
  for (const name of ['createOscillator', 'createBufferSource', 'createConvolver', 'createBiquadFilter', 'createGain', 'createStereoPanner',
    'createDynamicsCompressor', 'createDelay', 'createConstantSource', 'createWaveShaper']) {
    const make = P[name];
    P[name] = function (...args) { const node = make.apply(this, args); reg.nodes.push({ type: name.slice(6), node }); return node; };
  }
  const S = AudioScheduledSourceNode.prototype, start = S.start;
  S.start = function (...args) { reg.live.add(this); this.addEventListener('ended', () => reg.live.delete(this)); return start.apply(this, args); };
};

const { browser, close } = await openBrowser();
const report = [];
try {
  const cdp = await browser.newBrowserCDPSession();
  const processes = async () => (await cdp.send('SystemInfo.getProcessInfo')).processInfo;
  for (const chapter of chapters) {
    const [entry, fixture] = chapter.split(':');
    const context = await browser.newContext({ viewport: { width: 1376, height: 1032 }, deviceScaleFactor: 2 });
    await context.addInitScript(instrument);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '?shot&start=1&ratio=1.5&msaa=2&analytics=0&progress=0' + query + (entry === 'island' ? '' : '&chapter=' + entry));
    await page.waitForSelector('#veil.ready', { timeout: 120000 }); await page.locator('#begin').click();
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    if (fixture) await page.evaluate(() => __game.story.current.skipToCrest());
    await page.evaluate(() => { __game.sound.setMuted(false); __game.sound.start(); });
    let stirring = true;
    const circling = stir && (async () => {
      for (let a = 0; stirring; a += 0.35) {
        await page.mouse.move(688 + 260 * Math.cos(a), 516 + 200 * Math.sin(a), { steps: 2 }).catch(() => {});
        await page.waitForTimeout(16);
      }
    })();
    await page.waitForTimeout(10000);
    const sample = async () => {
      const list = await processes(), by = {};
      for (const p of list) by[p.type] = (by[p.type] ?? 0) + p.cpuTime * 1000;
      return { at: Date.now(), by };
    };
    const census = () => page.evaluate(() => {
      const s = __game.sound, reg = __audioReg, count = {};
      for (const n of reg.live) { const k = n.constructor.name + (n.loop ? ' (loop)' : ''); count[k] = (count[k] ?? 0) + 1; }
      const g = node => node?.gain.value;
      return {
        state: s.ctx?.state, sampleRate: s.ctx?.sampleRate, created: reg.nodes.length, liveSources: count,
        layers: { breeze: g(s.breezeGain), gust: g(s.gustGain), whistle: g(s.whistleGain), rustle: g(s.rustleGain), lift: g(s.liftGain), sea: g(s.seaGain), rain: g(s.rainGain), patter: g(s.patterGain) },
        pad: { master: g(s.padGain), voices: s.padVoices.map(v => g(v.gain)) },
        held: s.fades ? [...s.fades].filter(([, f]) => f.held).length : null,
        convolvers: reg.nodes.filter(n => n.type === 'Convolver').map(n => ({ seconds: n.node.buffer?.duration ?? null, channels: n.node.buffer?.numberOfChannels ?? null,
          role: n.node === s.reverbConvolver ? 'reverb' : n.node === s.backgroundReverb ? 'background' : n.node === s.spareReverb ? 'spare' : 'other' })),
        scores: ['openingScore', 'summitScore', 'dreamScore', 'linesScore', 'boatsScore', 'meadowScore', 'birchesScore', 'sleepingScore', 'seaScore'].filter(k => s[k]),
      };
    });
    const windows = [];
    const measure = async (state, setup, teardown, settle = 1500) => {
      await setup?.(); await page.waitForTimeout(settle);
      const a = await sample(); await page.waitForTimeout(WINDOW); const b = await sample();
      await teardown?.();
      const s = (b.at - a.at) / 1000, row = { state, seconds: s };
      for (const k of Object.keys(b.by)) row[k] = (b.by[k] - (a.by[k] ?? 0)) / s;
      windows.push(row); console.log(JSON.stringify({ chapter, state, renderer: row.renderer?.toFixed(1), utility: row.utility?.toFixed(1) }));
    };
    const censusOn = await census();
    const mute = m => page.evaluate(m => __game.sound.setMuted(m), m);
    for (let r = 0; r < REPS; r++) {
      await measure('on');
      await measure('muted', () => mute(true), () => mute(false));
    }
    if (ablate.includes(chapter)) {
      const cut = name => page.evaluate(name => __audioCut(name, true), name), restore = () => page.evaluate(() => __audioCut(null, false));
      await page.evaluate(() => {
        const s = __game.sound, noise = __audioReg.nodes.filter(n => n.type === 'BufferSource' && n.node.loop && n.node.buffer === s.noise).slice(0, 8).map(n => n.node);
        const layers = [s.breezeGain, s.gustGain, s.whistleGain, s.rustleGain, s.liftGain, s.seaGain, s.rainGain, s.patterGain];
        const pad = s.padVoices.flatMap(v => v.osc.map(o => ({ node: o, to: v.gain })));
        // A noise source's output is its entry gain (startNoise); find it as the gain created right after the source.
        const entries = noise.map(src => { const i = __audioReg.nodes.findIndex(n => n.node === src); return __audioReg.nodes[i + 1].node; });
        const noiseEdges = noise.map((node, i) => ({ node, to: entries[i], layer: layers[i] }));
        const groups = {
          pad: () => pad,
          noise: () => noiseEdges,
          silent: () => [...pad.filter(e => Math.abs(e.to.gain.value * s.padGain.gain.value) < 1e-4), ...noiseEdges.filter(e => Math.abs(e.layer.gain.value) < 1e-4)],
          reverbs: () => [{ node: s.reverbConvolver, to: s.master }, { node: s.backgroundReverb, to: s.backgroundGate }],
        };
        let cut = [];
        window.__audioCut = (name, on) => {
          if (!on) { for (const e of cut) e.node.connect(e.to); cut = []; return 0; }
          cut = groups[name](); for (const e of cut) e.node.disconnect(e.to); return cut.length;
        };
      });
      for (const name of ['pad', 'noise', 'silent', 'reverbs']) for (let r = 0; r < REPS; r++) {
        await measure('on');
        await measure('cut:' + name, () => cut(name), restore);
      }
    }
    // A disconnected convolver rings for its 4.5 s tail, so these pairs settle for longer before each window.
    const paired = {
      unheld: [() => page.evaluate(() => { const s = __game.sound; s.fade = (param, target, now, tc) => param.setTargetAtTime(target, now, tc); }),
        () => page.evaluate(() => { const s = __game.sound; delete s.fade; s.fades.clear(); })],
      onereverb: [() => page.evaluate(() => { const s = __game.sound; s.backgroundWet.disconnect(s.backgroundReverb); s.backgroundWet.connect(s.reverbConvolver); }),
        () => page.evaluate(() => { const s = __game.sound; s.backgroundWet.disconnect(s.reverbConvolver); s.backgroundWet.connect(s.backgroundReverb); })],
    };
    for (const name of pairs) for (let r = 0; r < REPS; r++) {
      await measure('ref:' + name, null, null, 6000);
      await measure('pair:' + name, paired[name][0], paired[name][1], 6000);
    }
    stirring = false; await circling;
    const censusEnd = await census();
    const summary = {};
    for (const state of [...new Set(windows.map(w => w.state))]) {
      const rows = windows.filter(w => w.state === state);
      summary[state] = { renderer: median(rows.map(r => r.renderer ?? 0)), utility: median(rows.map(r => r.utility ?? 0)), gpu: median(rows.map(r => r.GPU ?? 0)), browser: median(rows.map(r => r.browser ?? 0)) };
    }
    report.push({ chapter, census: censusOn, censusEnd, summary, windows, errors });
    fs.writeFileSync(out + '.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ chapter, summary, census: censusOn }));
    await context.close();
  }
} finally { await close(); }

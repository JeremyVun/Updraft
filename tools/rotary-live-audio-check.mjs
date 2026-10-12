// Sound enabled through the normal shortcut; both creaks must reach the actual game output.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
import { openRotary } from './lib/rotary-gesture.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const { browser, close } = await openBrowser();
const prefix = process.env.OUT ?? '/tmp/updraft-rotary-procedural-live';
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await withoutHotReload(page);
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5243/'}?shot&chapter=rotary&progress=0&ratio=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.evaluate(() => {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(destination, ...args) {
      if (destination === this.context.destination && !window.__audibleOutput) window.__audibleOutput = this;
      return connect.call(this, destination, ...args);
    };
  });
  await page.keyboard.press('m');
  await page.waitForFunction(() => __game.sound.running && window.__audibleOutput, null, { timeout: 15000 });
  await page.waitForTimeout(5000);
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').findLast(r => new URL(r.name).pathname === '/src/audio/foley.ts').name;
    const { Foley } = await import(path);
    const sound = __game.sound, ctx = sound.output.ctx;
    const stream = ctx.createMediaStreamDestination(), stem = ctx.createGain();
    const isolated = ctx.createAnalyser(), mixed = ctx.createAnalyser();
    isolated.fftSize = mixed.fftSize = 2048;
    stem.gain.value = sound.master.gain.value;
    stem.connect(isolated);
    // A silent destination pulls the isolated analysis branch without doubling the heard sound.
    const silence = ctx.createGain(); silence.gain.value = 0;
    isolated.connect(silence).connect(ctx.destination);
    __audibleOutput.connect(mixed); __audibleOutput.connect(stream);
    const recorder = new MediaRecorder(stream.stream), chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();
    const audit = window.__rotaryAudio = { events: [], samples: [], recorder, chunks, ctx, frame: 0 };
    const material = Foley.prototype.material;
    Foley.prototype.material = function(kind, amount, pan, ...rest) {
      if (kind !== 'rotary-creak') return material.call(this, kind, amount, pan, ...rest);
      const event = { at: ctx.currentTime, amount, pan, running: sound.running, output: !!this.out,
        beat: __game.story.current.beat, sources: 0, disconnected: 0 };
      audit.events.push(event);
      const makePan = ctx.createStereoPanner.bind(ctx), makeSource = ctx.createBufferSource.bind(ctx);
      ctx.createStereoPanner = () => { const node = makePan(); node.connect(stem); return node; };
      ctx.createBufferSource = () => {
        const node = makeSource(), disconnect = node.disconnect.bind(node);
        event.sources++;
        node.disconnect = (...args) => { event.disconnected++; return disconnect(...args); };
        return node;
      };
      try { return material.call(this, kind, amount, pan, ...rest); }
      finally { ctx.createStereoPanner = makePan; ctx.createBufferSource = makeSource; }
    };
    const values = new Float32Array(2048);
    const level = analyser => {
      analyser.getFloatTimeDomainData(values);
      let peak = 0, sum = 0;
      for (const v of values) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
      return { peak, rms: Math.sqrt(sum / values.length) };
    };
    const tick = () => {
      audit.samples.push({ at: ctx.currentTime, stem: level(isolated), mix: level(mixed) });
      audit.frame = requestAnimationFrame(tick);
    };
    tick();
  });
  await openRotary(page);
  await page.waitForTimeout(1500);
  const report = await page.evaluate(async () => {
    const a = __rotaryAudio;
    cancelAnimationFrame(a.frame);
    await new Promise(resolve => { a.recorder.onstop = resolve; a.recorder.stop(); });
    const bytes = new Uint8Array(await new Blob(a.chunks).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { events: a.events, samples: a.samples, musicMuted: __game.sound.musicMuted, audio: btoa(binary) };
  });
  fs.writeFileSync(`${prefix}.webm`, Buffer.from(report.audio, 'base64'));
  delete report.audio;
  assert.equal(report.events.length, 2, 'Exactly one real creak per rotary');
  for (const e of report.events) {
    assert(e.running && e.output && e.sources === 1 && e.disconnected === 1, 'Actual generated voice plays and cleans up');
    const during = report.samples.filter(s => s.at >= e.at && s.at < e.at + .8);
    e.peakDbFS = 20 * Math.log10(Math.max(...during.map(s => s.stem.peak)));
    e.mixPeakDbFS = 20 * Math.log10(Math.max(...during.map(s => s.mix.peak)));
    assert(e.peakDbFS > -33 && e.peakDbFS < -19, `Isolated creak at game gain: ${e.peakDbFS} dBFS`);
    assert(e.mixPeakDbFS < -.5, 'Actual mix retains headroom');
  }
  assert.equal(report.musicMuted, false, 'Music stays enabled during the encounter');
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${prefix}.json`, JSON.stringify(report));
  console.log(JSON.stringify({ events: report.events, musicMuted: report.musicMuted, errors, recording: `${prefix}.webm` }));
} finally { await close(); }

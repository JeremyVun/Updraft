// Film one promo shot from the real game: a fixed 60 Hz clock, scripted pointer strokes with the cursor ring visible,
// every frame supersampled, and the game's audio rendered offline in step as two stems (the score, and the rest).
// Usage: node tools/promo-film.mjs <shot> [outDir]. Shots live in tools/promo/shots.mjs.
// env: FORMAT=landscape|portrait (default landscape), PREVIEW=1 (a small JPEG every half second, no audio, fast),
//      SECONDS overrides the shot's length (to stop after the last still),
//      STILLS=<capture seconds, comma-separated> (full-resolution PNGs, cursor ring hidden), FROM=<seconds> overrides the shot's `from`:
//      the story plays (hand, sound and all) from its start and only frames from then on are kept.
// Writes <shot>.mp4 (picture only, 60 fps), <shot>-world.wav, <shot>-score.wav, <shot>-marks.json.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { openBrowser } from './lib/browser.mjs';
import { shots, FORMATS } from './promo/shots.mjs';

const [name, outArg] = process.argv.slice(2);
const shot = shots[name];
assert(shot, `Unknown shot. Shots: ${Object.keys(shots).join(', ')}`);
const format = FORMATS[process.env.FORMAT ?? 'landscape'];
assert(format, `FORMAT must be one of ${Object.keys(FORMATS).join(', ')}`);
const preview = process.env.PREVIEW === '1';
const stills = (process.env.STILLS ?? '').split(',').filter(Boolean).map(Number);
const from = Number(process.env.FROM ?? shot.from ?? 0);
const out = outArg ?? fs.mkdtempSync(`/tmp/updraft-promo-${name}-`);
fs.mkdirSync(out, { recursive: true });
const RATE = 48000, FPS = 60;
const lead = shot.lead ?? 3;
const seconds = Number(process.env.SECONDS ?? shot.seconds);
const dsf = preview ? 1 : format.scale;
const [W, H] = format.viewport;

const server = await createServer({ configFile: false, envDir: false, logLevel: 'error',
  define: { __BUILD_ID__: JSON.stringify('promo-film') },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
await server.listen();
const { browser, close } = await openBrowser();
let encoder;
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(size => { window.__ringSize = size; }, format.ring);
  await page.addInitScript(() => {
    // A seeded Math.random, so a preview and its full-quality take tell the same story.
    let seed = 0x5eed;
    Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => { if (cb.name === 'frame') { window.__nextFrame = cb; return 1; } return raf(cb); };
    window.__drive = () => { window.__clock += 1000 / 60; const cb = window.__nextFrame; window.__nextFrame = null; cb(window.__clock); };
    // The ring's CSS fade runs on wall time, which a frame-stepped capture does not share; the tool fades it instead.
    // It is drawn larger and firmer than in play so a viewer on a phone can follow the hand.
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = `body.shot #cursor { display: block; transition: none; width: ${window.__ringSize}px; height: ${window.__ringSize}px;
        border-width: 2.5px; border-color: rgba(255, 252, 244, 0.95); }`;
      document.head.append(style);
    });
  });
  const query = new URLSearchParams({ shot: '1', ratio: String(dsf), msaa: String(shot.msaa ?? 4), analytics: '0', progress: '0',
    ...(shot.chapter ? { chapter: shot.chapter } : {}), ...(shot.query ?? {}) });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?${query}`);
  await page.waitForFunction(() => !!window.__nextFrame && window.__game, null, { timeout: 180000 });
  await page.evaluate(() => { window.__clock = performance.now() + 100; __drive(); });
  await page.waitForFunction(() => { for (let j = 0; j < 5; j++) if (window.__nextFrame) __drive(); return window.__ready === true; },
    null, { timeout: 180000, polling: 50 });

  await page.evaluate(async () => { window.__heightAt = (await import('/src/world/island.ts')).heightAt; });
  await page.evaluate(() => {
    const g = window.__game, v = new g.rig.camera.position.constructor(), cursor = document.getElementById('cursor');
    const project = p => { if (!p) return null; const q = v.copy(p).project(g.rig.camera); return { x: (q.x + 1) / 2, y: (1 - q.y) / 2, z: q.z }; };
    window.__snapshot = () => {
      const c = g.story.current, snag = g.birches.scarf.snags.findIndex(x => !x.freed);
      const bubble = g.skyMirror.carried ?? g.skyMirror.bubbles.find(b => !b.pop);
      return { chapter: g.story.name, beat: c.beat ?? null, t: c.t ?? null, time: window.__stats?.time, life: +g.story.worldLife.toFixed(3),
        islandLife: c.islandLife ?? null,
        child: project(g.child.position), cygnet: project(g.cygnet.position), plane: project(g.glider.position),
        boat: project(g.boat.position), sail: project(g.boat.sailPoint(v.clone())),
        coax: project(c.coax?.at), wind: project(c.windInvitation), fleet: project(g.littleBoats.invitation),
        feather: project(g.sleeping.feather.position), scarf: snag >= 0 ? project(g.birches.scarf.snags[snag].center) : null, snag,
        bubble: project(bubble?.position), carried: !!g.skyMirror.carried, wand: project(g.skyMirror.wand),
        grey: window.__grey(),
        target: c.target != null && g.skyMirror.stars[c.target] ? project(g.skyMirror.stars[c.target].origin) : null,
        piano: g.piano.expect && c.piano?.at === 'seated' ? { expect: g.piano.expect,
          path: [0, 1].map(k => project(g.piano.guideAlong(k, g.piano.keys.clone()))) } : null };
    };
    // Land on the first island, every 4 m, so a hand can aim for the parts still grey.
    window.__land = [];
    const r = g.life.regions.island;
    for (let x = r.x - r.z; x <= r.x + r.z; x += 4) for (let z = r.y - r.z; z <= r.y + r.z; z += 4) {
      const y = window.__heightAt(x, z);
      if (Math.hypot(x - r.x, z - r.y) < r.z && y > 0.4) window.__land.push(new g.rig.camera.position.constructor(x, y, z));
    }
    window.__grey = () => {
      if (g.story.name !== 'island') return null;
      const out = [];
      for (let i = 0; i < __land.length; i++) {
        const p = __land[i];
        if (g.life.at(p.x, p.z) > 0.45) continue;
        const q = project(p);
        if (q.z < 1 && q.x > 0.05 && q.x < 0.95 && q.y > 0.1 && q.y < 0.9) out.push([+q.x.toFixed(3), +q.y.toFixed(3)]);
      }
      return out.length > 48 ? out.filter((_, i) => i % Math.ceil(out.length / 48) === 0) : out;
    };
    window.__cursorFade = 0;
    window.__afterFrame = () => {
      const shown = parseFloat(cursor.style.opacity) || 0;
      cursor.style.opacity = String(Math.min(1, shown * 1.7) * window.__cursorFade);
    };
    // A stroke that ends and another that starts elsewhere must not read as one enormous gust across the screen.
    window.__lift = () => document.getElementById('view').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', isPrimary: true }));
  });
  if (shot.setup) await page.evaluate(shot.setup);

  const drive = async n => page.evaluate(n => { for (let i = 0; i < n; i++) { __drive(); __afterFrame(); } return __snapshot(); }, n);
  let state = await drive(1);
  const skipLimit = (shot.skipSeconds ?? 0) * FPS + (shot.until ? 240 * FPS : 0);
  for (let f = 0; f < skipLimit; f += 10) {
    if (shot.until && shot.until(state)) break;
    state = await drive(10);
  }
  if (shot.until) assert(shot.until(state), `Never reached the shot's moment: ${JSON.stringify(state)}`);
  if (shot.afterSkip) await page.evaluate(shot.afterSkip);
  console.log(JSON.stringify({ shot: name, format: process.env.FORMAT ?? 'landscape', start: state }));

  if (!preview) {
    await page.exposeFunction('saveAudio', (b64, stem) => fs.appendFileSync(`${out}/${name}-${stem}.f32`, Buffer.from(b64, 'base64')));
    for (const stem of ['world', 'score']) fs.rmSync(`${out}/${name}-${stem}.f32`, { force: true });
    await page.evaluate(({ total, RATE }) => {
      const g = window.__game, s = g.sound;
      const ctx = new OfflineAudioContext(4, Math.ceil(total * RATE), RATE), Native = window.AudioContext;
      window.AudioContext = function () { return ctx; };
      try { s.start(); } finally { window.AudioContext = Native; }
      Object.defineProperty(s, 'running', { get: () => true });
      // Channels 0-1: everything but the score, through the game's own compressor. Channels 2-3: the score.
      const merger = ctx.createChannelMerger(4), score = ctx.createGain(), split = ctx.createChannelSplitter(2);
      merger.connect(ctx.destination);
      Object.assign(score, { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
      score.gain.value = 0.9;
      score.connect(split); split.connect(merger, 0, 2); split.connect(merger, 1, 3);
      s.backgroundDuck.disconnect(); s.backgroundDuck.connect(score);
      const wet = ctx.createConvolver();
      s.wetDuck.disconnect(); s.wetDuck.connect(wet); wet.connect(score);
      let tick = 1, pause = ctx.suspend(tick / 60);
      const rendered = ctx.startRendering();
      window.__advance = async count => {
        let snap;
        for (let i = 0; i < count; i++) {
          await pause;
          if (!wet.buffer && s.reverbConvolver.buffer) wet.buffer = s.reverbConvolver.buffer;
          __drive(); __afterFrame();
          pause = ctx.suspend(++tick / 60);
          await ctx.resume();
        }
        return __snapshot();
      };
      window.__finishAudio = async (fromSec, length) => {
        await pause; await ctx.resume();
        const buffer = await rendered, peaks = [0, 0];
        for (const [stem, a, b] of [['world', 0, 1], ['score', 2, 3]]) {
          const ca = buffer.getChannelData(a), cb = buffer.getChannelData(b), start = Math.round(fromSec * RATE);
          for (let o = 0; o < length * RATE; o += RATE) {
            const n = Math.min(RATE, Math.round(length * RATE) - o), f = new Float32Array(n * 2);
            for (let i = 0; i < n; i++) { f[i * 2] = ca[start + o + i] ?? 0; f[i * 2 + 1] = cb[start + o + i] ?? 0; }
            for (const x of f) peaks[a / 2] = Math.max(peaks[a / 2], Math.abs(x));
            const bytes = new Uint8Array(f.buffer); let bin = '';
            for (let i = 0; i < bytes.length; i += 16384) bin += String.fromCharCode(...bytes.subarray(i, i + 16384));
            await saveAudio(btoa(bin), stem);
          }
        }
        return { worldPeakDb: 20 * Math.log10(peaks[0]), scorePeakDb: 20 * Math.log10(peaks[1]) };
      };
    }, { total: lead + from + seconds + 2, RATE });
  } else {
    await page.evaluate(() => { window.__advance = async count => { for (let i = 0; i < count; i++) { __drive(); __afterFrame(); } return __snapshot(); }; });
  }

  const [OW, OH] = format.output;
  if (!preview) {
    encoder = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0',
      '-vf', `scale=${OW}:${OH}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), `${out}/${name}.mp4`], { stdio: ['pipe', 'ignore', 'pipe'] });
  }
  let ffErrors = ''; encoder?.stderr.on('data', b => ffErrors += b);
  const completed = encoder ? once(encoder, 'close') : null;

  const marks = [];
  let wasDown = null, fade = 0, audioStart = 0;
  const total = Math.round((lead + from + seconds) * FPS);
  for (let frame = 0; frame < total; frame++) {
    const t = frame / FPS - lead;
    const p = shot.pointer ? shot.pointer(t, state) : null;
    if (p) {
      if (!wasDown || Math.hypot(p.x - wasDown.x, p.y - wasDown.y) > 0.12) await page.evaluate(() => __lift());
      await page.mouse.move(p.x * W, p.y * H);
    } else if (wasDown) await page.evaluate(() => __lift());
    wasDown = p;
    fade = p ? Math.min(1, fade + 1 / (0.25 * FPS)) : Math.max(0, fade - 1 / (0.3 * FPS));
    if (frame === Math.round((lead + from) * FPS) && !preview) audioStart = await page.evaluate(() => __game.sound.ctx.currentTime);
    state = await page.evaluate(f => { window.__cursorFade = f; return __advance(1); }, fade);
    if (t < from) continue;
    const at = +(t - from).toFixed(3);
    marks.push({ ...state, beatT: state.t, t: at, pointer: p });
    const f = frame - Math.round((lead + from) * FPS);
    if (preview) {
      if (f % 30 === 0) await page.screenshot({ path: `${out}/${name}-${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 });
      continue;
    }
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 95, timeout: 120000 });
    if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, 'drain');
    if (stills.some(s => Math.round(s * FPS) === f)) {
      await page.evaluate(() => { document.getElementById('cursor').style.visibility = 'hidden'; });
      await page.screenshot({ path: `${out}/${name}-still-${at.toFixed(2)}s.png`, timeout: 120000 });
      await page.evaluate(() => { document.getElementById('cursor').style.visibility = ''; });
    }
    if (f % 60 === 0) console.log(JSON.stringify({ t: at, chapter: state.chapter, beat: state.beat }));
  }
  let audio = {};
  if (!preview) {
    encoder.stdin.end();
    const [code] = await completed; assert.equal(code, 0, ffErrors);
    audio = await page.evaluate(({ a, s }) => __finishAudio(a, s), { a: audioStart, s: seconds });
    for (const stem of ['world', 'score']) {
      await new Promise((resolve, reject) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '2',
        '-i', `${out}/${name}-${stem}.f32`, '-c:a', 'pcm_f32le', `${out}/${name}-${stem}.wav`]).on('close', c => c ? reject(new Error(`ffmpeg ${c}`)) : resolve()));
      fs.rmSync(`${out}/${name}-${stem}.f32`);
    }
  }
  fs.writeFileSync(`${out}/${name}-marks.json`, JSON.stringify({ shot: name, format: process.env.FORMAT ?? 'landscape', seconds, errors, audio, marks }));
  console.log(JSON.stringify({ out, frames: marks.length, errors: errors.length, ...audio }));
} finally {
  encoder?.stdin.destroy();
  await close();
  await server.close();
}

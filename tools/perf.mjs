// Measures the running game in local Chrome (GPU) from inside the page, without screenshots.
// Usage: node tools/perf.mjs <mode> [seconds] [query] ['<json steps>']
//   modes: frames   every rAF interval: percentiles, hitches (>25 ms) with their time, long tasks, __stats
//          gl       which native WebGL calls block the main thread (count, total, max), from page load
//          cpu      CPU profile: top self-time functions and top functions by total time
//          flicker  frame-to-frame image change (screen box-averaged down 8x each frame); reports frames whose
//                   change spikes against their neighbours: pops, flashes, reshuffles
//   query is appended to ?shot=1; steps use tools/play.mjs syntax (wait, swipe, move, down, up, eval).
//   env: BASE (default http://127.0.0.1:5230/), DSF (device scale factor, default 1), W/H viewport (1600x900)
//        WHOLE / BLOCK flicker spike thresholds (default 1.5 / 8; lower them for a frozen world, `hold=`)
// Takes the same machine-wide browser lock as tools/play.mjs. Note that other processes using the GPU
// (another capture, a browser playing video) inflate every number here: check before trusting a run.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const LOCK = '/tmp/updraft-chromium.lock';
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function acquireLock() {
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      fs.writeFileSync(`${LOCK}/pid`, String(process.pid));
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let holder = 0;
      try {
        holder = Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) || 0;
      } catch {}
      let stale = holder ? !alive(holder) : false;
      try {
        if (!holder) stale = Date.now() - fs.statSync(LOCK).mtimeMs > 10000;
      } catch {}
      if (stale) fs.rmSync(LOCK, { recursive: true, force: true });
      else await new Promise((r) => setTimeout(r, 400));
    }
  }
}
process.on('exit', () => {
  try {
    if (Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) === process.pid) fs.rmSync(LOCK, { recursive: true, force: true });
  } catch {}
});

const [mode = 'frames', secsArg = '10', query = '', stepsJson = '[]'] = process.argv.slice(2);
const secs = Number(secsArg);
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600);
const height = Number(process.env.H ?? 900);
const steps = JSON.parse(stepsJson);

const INIT = {
  frames: () => {
    window.__t0 = performance.now();
    window.__frames = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        window.__frames.push(t);
        cb(t);
      });
    window.__long = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]);
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
  },
  gl: () => {
    window.__gl = {};
    const P = WebGL2RenderingContext.prototype;
    const names = ['readPixels', 'getBufferSubData', 'bufferData', 'clientWaitSync', 'fenceSync', 'flush', 'finish', 'drawArrays', 'drawElements', 'drawElementsInstanced', 'drawArraysInstanced', 'texImage2D', 'texSubImage2D', 'linkProgram', 'compileShader', 'getProgramParameter', 'getUniformLocation', 'bufferSubData', 'getError', 'getParameter', 'blitFramebuffer', 'generateMipmap', 'texStorage2D', 'renderbufferStorageMultisample', 'getSyncParameter', 'checkFramebufferStatus'];
    for (const n of names) {
      const orig = P[n];
      if (!orig) continue;
      P[n] = function (...a) {
        const t = performance.now();
        const r = orig.apply(this, a);
        const d = performance.now() - t;
        const s = (window.__gl[n] ??= { n: 0, ms: 0, max: 0 });
        s.n++;
        s.ms += d;
        if (d > s.max) s.max = d;
        return r;
      };
    }
  },
  flicker: () => {
    /** Mip level read back: each texel is the box average of 8x8 screen pixels. A straight 10:1 linear blit samples 4 pixels of every 100, and thin blades then shimmer at 8/255 a frame even in a frozen world. */
    const LEVEL = 3;
    const BX = 16;
    const BY = 9;
    let W = 0;
    let H = 0;
    let gl = null;
    let full = null;
    let small = null;
    let tex = null;
    let prev = null;
    let cur = null;
    window.__flick = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        cb(t);
        if (!window.__game || !window.__ready) return;
        gl ??= window.__game.renderer.getContext();
        const fw = gl.drawingBufferWidth;
        const fh = gl.drawingBufferHeight;
        if (W !== fw >> LEVEL || H !== fh >> LEVEL) {
          W = fw >> LEVEL;
          H = fh >> LEVEL;
          cur = new Uint8Array(W * H * 4);
          prev = null;
          tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texStorage2D(gl.TEXTURE_2D, LEVEL + 1, gl.RGBA8, fw, fh);
          full = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, full);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
          small = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, small);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, LEVEL);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, full);
        gl.blitFramebuffer(0, 0, fw, fh, 0, 0, fw, fh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, small);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, cur);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        window.__game.renderer.resetState();
        if (prev) {
          let sum = 0;
          const blocks = new Float32Array(BX * BY);
          const per = (W / BX) * (H / BY) * 3;
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const i = (y * W + x) * 4;
              const d = Math.abs(cur[i] - prev[i]) + Math.abs(cur[i + 1] - prev[i + 1]) + Math.abs(cur[i + 2] - prev[i + 2]);
              sum += d;
              blocks[Math.floor((y * BY) / H) * BX + Math.floor((x * BX) / W)] += d;
            }
          }
          let maxB = 0;
          let maxI = 0;
          for (let b = 0; b < blocks.length; b++) {
            const v = blocks[b] / per;
            if (v > maxB) {
              maxB = v;
              maxI = b;
            }
          }
          window.__flick.push([t, sum / (W * H * 3), maxB, maxI]);
        }
        prev ??= new Uint8Array(W * H * 4);
        prev.set(cur);
      });
  },
};

await acquireLock();
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: Number(process.env.DSF ?? 1) });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  if (INIT[mode]) await page.addInitScript(INIT[mode]);
  let cdp = null;
  if (mode === 'cpu') {
    cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
  }
  const t0 = Date.now();
  await page.goto(`${base}?shot=1${query ? '&' + query : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const readyMs = Date.now() - t0;
  const px = ([x, y]) => [x * width, y * height];
  for (const s of steps) {
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.move) await page.mouse.move(...px(s.move));
    if (s.down) await page.mouse.down();
    if (s.up) await page.mouse.up();
    if (s.eval) console.log(JSON.stringify(await page.evaluate(s.eval)));
    if (s.swipe) {
      const pts = s.swipe.map(px);
      const ms = s.ms ?? 600;
      const n = Math.max(2, Math.round(ms / 8));
      const seg = pts.length - 1;
      await page.mouse.move(...pts[0]);
      for (let i = 1; i <= n; i++) {
        const f = (i / n) * seg;
        const k = Math.min(seg - 1, Math.floor(f));
        const t = f - k;
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        await page.mouse.move(ax + (bx - ax) * t, ay + (by - ay) * t);
        await page.waitForTimeout(ms / n);
      }
    }
  }
  const remaining = secs * 1000 - (Date.now() - t0 - readyMs);
  if (remaining > 0) await page.waitForTimeout(remaining);
  const stats = await page.evaluate(() => window.__stats ?? null);
  const med = (a) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };

  if (mode === 'frames') {
    const d = await page.evaluate(() => ({ t0: window.__t0, frames: window.__frames, long: window.__long }));
    const f = d.frames;
    const dts = [];
    for (let i = 1; i < f.length; i++) dts.push(f[i] - f[i - 1]);
    const sorted = [...dts].sort((a, b) => a - b);
    const p = (q) => sorted[Math.floor(q * (sorted.length - 1))].toFixed(1);
    console.log(`ready in ${readyMs} ms, first frame ${(f[0] - d.t0).toFixed(0)} ms after script start, ${dts.length} frames`);
    console.log(`interval p50 ${p(0.5)}  p90 ${p(0.9)}  p99 ${p(0.99)}  max ${p(1)} ms;  >25 ms: ${dts.filter((x) => x > 25).length}  >50 ms: ${dts.filter((x) => x > 50).length}  >100 ms: ${dts.filter((x) => x > 100).length}`);
    const hitches = dts.map((x, i) => [((f[i + 1] - f[0]) / 1000).toFixed(2), x.toFixed(0)]).filter(([, x]) => Number(x) > 25);
    console.log('hitches (s after first frame: ms):', hitches.slice(0, 50).map(([t, x]) => `${t}:${x}`).join(' ') || 'none');
    console.log('long tasks:', d.long.slice(0, 20).map(([s, x]) => `${((s - d.t0) / 1000).toFixed(2)}s:${x.toFixed(0)}ms`).join(' ') || 'none');
  } else if (mode === 'gl') {
    const gl = await page.evaluate(() => window.__gl);
    console.log(`native WebGL calls over ${secs} s from load (count, main-thread total, worst)`);
    for (const [k, v] of Object.entries(gl).sort((a, b) => b[1].ms - a[1].ms).slice(0, 12)) {
      console.log(`  ${k.padEnd(28)} n=${String(v.n).padStart(7)}  total ${v.ms.toFixed(0).padStart(6)} ms  max ${v.max.toFixed(1)} ms`);
    }
  } else if (mode === 'cpu') {
    const { profile } = await cdp.send('Profiler.stop');
    const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const self = new Map();
    const total = new Map();
    let sum = 0;
    const short = (n) => `${n.callFrame.functionName || '(anon)'} ${(n.callFrame.url || '').split('/').slice(-1)[0].split('?')[0]}`;
    for (let i = 0; i < profile.samples.length; i++) {
      const id = profile.samples[i];
      const ms = profile.timeDeltas[i] / 1000;
      sum += ms;
      const n = nodes.get(id);
      const key = `${short(n)}:${n.callFrame.lineNumber}`;
      self.set(key, (self.get(key) ?? 0) + ms);
      const seen = new Set();
      for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
        const k = short(nodes.get(cur));
        if (seen.has(k)) continue;
        seen.add(k);
        total.set(k, (total.get(k) ?? 0) + ms);
      }
    }
    console.log(`${(sum / 1000).toFixed(1)} s profiled from load (native WebGL time is charged to the calling function)`);
    console.log('top self time (ms):');
    for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${v.toFixed(0).padStart(6)}  ${k}`);
    console.log('top total time (ms):');
    for (const [k, v] of [...total].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${v.toFixed(0).padStart(6)}  ${k}`);
  } else if (mode === 'flicker') {
    const f = await page.evaluate(() => window.__flick);
    const spikes = [];
    for (let i = 3; i < f.length - 3; i++) {
      const around = (c) => [f[i - 3][c], f[i - 2][c], f[i - 1][c], f[i + 1][c], f[i + 2][c], f[i + 3][c]];
      const whole = f[i][1] - med(around(1));
      const block = f[i][2] - med(around(2));
      if (whole > Number(process.env.WHOLE ?? 1.5) || block > Number(process.env.BLOCK ?? 8)) spikes.push(`${((f[i][0] - f[0][0]) / 1000).toFixed(2)}:${whole.toFixed(1)}/${block.toFixed(0)}@${f[i][3]}`);
    }
    const means = f.map((x) => x[1]);
    console.log(`${f.length} frames; frame-to-frame change (0-255) p50 ${med(means).toFixed(2)} max ${Math.max(...means).toFixed(2)}; spikes: ${spikes.length}`);
    console.log('spikes (s: whole-frame / worst block of a 16x9 grid @ block index):', spikes.slice(0, 60).join(' ') || 'none');
  }
  console.log('stats:', JSON.stringify(stats));
  const unique = [...new Set(errors)].filter((e) => !e.includes('Failed to load resource'));
  if (unique.length) console.log(`${unique.length} console errors/warnings:`, unique.slice(0, 3).map((e) => e.slice(0, 300)).join(' | '));
} finally {
  await browser.close();
}

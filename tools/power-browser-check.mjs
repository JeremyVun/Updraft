// Exercise production pacing in the real renderer with controlled display callbacks.
// This tests work counts and game time; it does not emulate an iPad GPU or measure battery.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
const report = [];
try {
  for (const chapter of ['island', 'birches', 'mirror']) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
    await page.route('**/@vite/client', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch(); let body = await response.text();
      for (const [a, b] of [
        ['frameTiming(params.shot ? 1 / 60 : realDt)', 'frameTiming(realDt)'],
        ['!params.shot && !pacer.due(now, quality.frameRate)', '!pacer.due(now, quality.frameRate)'],
        ['params.shot ? now - last : pacer.intervalMs', 'pacer.intervalMs'],
      ]) { assert(body.includes(a), `Missing production hook: ${a}`); body = body.replace(a, b); }
      body += '\nwindow.__resetPacer = now => { last = now; pacer.reset(now); quality.reset(now); };';
      await route.fulfill({ response, body });
    });
    await page.addInitScript(() => {
      const raf = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => { if (cb.name === 'frame') { window.__nextFrame = cb; return 1; } return raf(cb); };
      window.__drive = ms => { window.__clock += ms; const cb = window.__nextFrame; window.__nextFrame = null; cb(window.__clock); };
    });
    await page.goto('http://127.0.0.1:5230/?shot&analytics=0&progress=0' + (chapter === 'island' ? '' : '&chapter=' + chapter));
    await page.waitForFunction(() => !!window.__nextFrame, null, { timeout: 120000 });
    const rows = await page.evaluate(async () => {
      const g = __game, rows = [];
      window.__clock = performance.now() + 1;
      __resetPacer(__clock);
      __drive(1000 / 60);
      let windTicks = 0, renders = 0, audio = 0, updates = 0;
      const wrap = (obj, key, note) => { const old = obj[key].bind(obj); obj[key] = (...args) => { note(); return old(...args); }; };
      wrap(g.wind, 'substep', () => windTicks++);
      wrap(g.water, 'update', () => renders++);
      wrap(g.sound, 'update', () => audio++);
      wrap(g.story, 'update', () => updates++);
      for (const mode of ['high', 'low']) for (const hz of [120, 144, 60, 30]) {
        g.quality.setMode(mode, __clock);
        // Settle a rate change before establishing the one-second measurement window.
        __drive(1000 / hz); __drive(1000 / g.quality.frameRate);
        __resetPacer(__clock);
        const startTime = __stats.time;
        windTicks = renders = audio = updates = 0;
        for (let i = 0; i < hz; i++) __drive(1000 / hz);
        rows.push({ mode, hz, renders, audio, updates, windTicks, elapsed: __stats.time - startTime, ratio: g.quality.level.ratio,
          finite: [g.child.position, g.cygnet.position, g.glider.position, g.rig.camera.position].every(v => [v.x, v.y, v.z].every(Number.isFinite)) });
        await new Promise(r => setTimeout(r, 0));
      }
      g.quality.setMode('auto', __clock); __resetPacer(__clock);
      const before = __stats.time;
      let hidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      __drive(10000); const paused = before === __stats.time;
      hidden = false;
      const reset = performance.now();
      Object.defineProperty(performance, 'now', { configurable: true, value: () => reset });
      document.dispatchEvent(new Event('visibilitychange')); delete performance.now; window.__clock = reset;
      __drive(1000 / 120); const skipped = before === __stats.time;
      __drive(1000 / 120);
      rows.push({ paused, skipped, resumed: __stats.time - before });
      delete document.hidden;
      return rows;
    });
    for (const row of rows) {
      if (row.hz) {
        assert.equal(row.renders, Math.min(row.hz, row.mode === 'low' ? 30 : 60), JSON.stringify(row));
        assert.equal(row.audio, row.renders); assert(Math.abs(row.windTicks - 60) <= 1, JSON.stringify(row));
        assert.equal(row.ratio, row.mode === 'high' ? 1.5 : .85);
        assert(Math.abs(row.elapsed - 1) < 1e-8, JSON.stringify(row)); assert(row.finite);
      } else { assert(row.paused && row.skipped); assert(Math.abs(row.resumed - 1 / 60) < 1e-8); }
    }
    assert.deepEqual(errors, []); report.push({ chapter, rows }); console.log(JSON.stringify({ chapter, rows }));
    await page.close();
  }
  await fs.writeFile('/tmp/updraft-power-browser.json', JSON.stringify(report, null, 2));
} finally { await close(); }

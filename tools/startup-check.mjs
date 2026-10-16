// Real-time Begin and tab-resume regression: RAF may predate a performance.now() clock reset.
// Usage: node tools/startup-check.mjs [output-prefix]; BASE defaults to localhost:5230.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { holdGpu } from './lib/browser.mjs';

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const prefix = process.argv[2] ?? '/tmp/updraft-startup';
await holdGpu();
const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
try {
  for (const [chapter, stale] of [['mirror', false], ['mirror', true], ['piano', true]]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.stack));
    page.on('console', m => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
    });
    await page.addInitScript(stale => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__startup = { frames: 0, inject: stale, injected: 0 };
      window.requestAnimationFrame = callback => raf(timestamp => {
        if (callback.name === 'frame') {
          window.__startup.frames++;
          if (window.__startup.inject) {
            window.__startup.inject = false;
            window.__startup.injected++;
            timestamp = performance.now() - 100;
          }
        }
        callback(timestamp);
      });
    }, stale);
    try {
      await page.goto(`${process.env.BASE ?? 'http://localhost:5230/'}?chapter=${chapter}`, { waitUntil: 'load' });
      await page.locator('#begin:enabled').waitFor({ timeout: 60000 });
      await page.locator('#begin').click();
      await page.waitForFunction(() => !document.querySelector('#veil') && !document.querySelector('#view').inert, null, { timeout: 15000 });
      if (stale) {
        // The same race can occur when a hidden tab becomes visible again.
        await page.evaluate(() => {
          window.__startup.inject = true;
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      const frames = await page.evaluate(() => window.__startup.frames);
      await page.waitForFunction(frames => window.__startup.frames > frames + 30, frames);
      await page.screenshot({ path: `${prefix}-${chapter}-${stale ? 'stale' : 'normal'}.png` });
      const state = await page.evaluate(() => window.__startup);
      assert.equal(state.injected, stale ? 2 : 0);
      assert.deepEqual(errors, [], 'startup and resumed frames must not throw');
      console.log(JSON.stringify({ chapter, stale, ...state, errors }));
    } finally {
      if (errors.length) console.error(errors.join('\n'));
      await context.close();
    }
  }
} finally {
  await browser.close();
}

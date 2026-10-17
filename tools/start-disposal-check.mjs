// Exercise the actual title and picker DOM without constructing the WebGL game.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
const server = await createServer({ root, configFile: false, envDir: false, define: { __QA__: true },
  server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--disable-gpu'] });
  const page = await browser.newPage();
  const session = await page.context().newCDPSession(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__title*', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.addInitScript(() => {
    localStorage.setItem('updraft.finished.v1', '1');
    window.titleFrames = new Set();
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = request(time => { titleFrames.delete(id); callback(time); });
      titleFrames.add(id);return id;
    };
    window.cancelAnimationFrame = id => { titleFrames.delete(id);cancel(id); };
  });
  const base = server.resolvedUrls.local[0];
  for (const scenario of ['begin', 'chapter', 'pending-images', 'disabled']) {
    await page.goto(`${base}__title?shot&progress=1${scenario === 'disabled' ? '' : '&start=1'}`);
    await page.evaluate(async () => { window.screenUnderTest = (await import('/src/start-screen.ts')).startScreen; });
    if (scenario !== 'disabled') {
      await page.waitForSelector('.chapters-toggle', { state: 'attached' });
      await page.evaluate(pending => {
        if (pending) HTMLImageElement.prototype.decode = () => new Promise(() => {});
        window.starts = [];
        screenUnderTest.ready((sound, pick) => starts.push({ sound, pick }));
      }, scenario === 'pending-images');
      if (scenario !== 'begin') {
        await page.locator('.chapters-toggle').click();
        assert.equal(await page.locator('.chapter').count(), 12);
        await page.locator('.chapter[data-start="stairs"]').hover();
        await page.locator('.chapter[data-start="stairs"]').click();
      } else await page.locator('#begin').click();
      assert.deepEqual(await page.evaluate(() => starts), [{ sound: true, pick: scenario === 'begin' ? undefined : 'stairs' }]);
      await page.evaluate(() => screenUnderTest.reveal());
      await page.waitForSelector('#veil', { state: 'detached' });
    }
    const disposed = await page.evaluate(() => {
      let detachedReads = 0;
      const rect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () { if (!this.isConnected) detachedReads++;return rect.call(this); };
      window.dispatchEvent(new Event('resize'));
      Element.prototype.getBoundingClientRect = rect;
      screenUnderTest.progress('graphics', 1);screenUnderTest.musicLoading(false);screenUnderTest.reveal();screenUnderTest.fail();
      return { ui: screenUnderTest.ui, air: screenUnderTest.air, painting: screenUnderTest.painting,
        shade: screenUnderTest.shade, startOver: screenUnderTest.startOver, start: screenUnderTest.start,
        frames: titleFrames.size, detachedReads, inert: document.getElementById('view').inert };
    });
    assert.deepEqual(disposed, { ui: null, air: null, painting: null, shade: null, startOver: null, start: null,
      frames: 0, detachedReads: 0, inert: false }, scenario);
    const { result } = await session.send('Runtime.evaluate', { expression: 'window' });
    const { listeners } = await session.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    assert.equal(listeners.filter(listener => listener.type === 'resize').length, 0, `${scenario}: no retained resize listeners`);
    await session.send('Runtime.releaseObject', { objectId: result.objectId });
    console.log(`${scenario}: title references, image work, frames and resize handlers released`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}

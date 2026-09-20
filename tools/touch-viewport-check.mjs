// Real touch contacts and canvas sizing through resize/fullscreen. Chrome is not an iPad Safari substitute.
// Usage: node tools/touch-viewport-check.mjs. BASE may select a frozen production build.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const report = { checks: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(base + '?shot=1&ratio=1&progress=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  const cdp = await page.context().newCDPSession(page);
  const contact = (id, x, y) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 });
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const input = () => page.evaluate(() => ({ down: __game.input.down, present: __game.input.present,
    ndc: __game.input.ndc.toArray(), charge: __game.input.charge }));
  await touch('touchStart', [contact(1, 200, 350)]);
  await touch('touchMove', [contact(1, 300, 350)]); await settle();
  const first = await input(); assert(first.down && first.present);
  await touch('touchStart', [contact(1, 300, 350), contact(2, 800, 500)]);
  await touch('touchMove', [contact(1, 300, 350), contact(2, 850, 550)]); await settle();
  assert.deepEqual((await input()).ndc, first.ndc, 'second finger must not reposition the wind');
  await touch('touchEnd', [contact(2, 850, 550)]); await settle();
  assert((await input()).down, 'lifting the second finger must not release the first');
  await touch('touchMove', [contact(1, 400, 400)]); await settle();
  assert.notDeepEqual((await input()).ndc, first.ndc, 'primary contact must still work');
  await touch('touchCancel', []); await settle();
  const cancelled = await input();
  assert(!cancelled.down && !cancelled.present && cancelled.charge === 0);
  report.checks.push('real multi-touch ownership, secondary release, primary continuation and browser cancellation');

  async function matchingViewport(label) {
    await settle();
    const state = await page.evaluate(() => {
      const rect = document.querySelector('#view').getBoundingClientRect();
      return { width: rect.width, height: rect.height, expectedWidth: innerWidth, expectedHeight: innerHeight,
        aspect: __game.rig.camera.aspect, bufferWidth: __game.renderer.domElement.width,
        bufferHeight: __game.renderer.domElement.height, ratio: __game.renderer.getPixelRatio() };
    });
    assert.equal(state.width, state.expectedWidth, label);
    assert.equal(state.height, state.expectedHeight, label);
    assert.equal(state.aspect, state.width / state.height, label);
    assert(Math.abs(state.bufferWidth - state.width * state.ratio) < 1, label);
    assert(Math.abs(state.bufferHeight - state.height * state.ratio) < 1, label);
    report.checks.push(label);
  }
  await matchingViewport('landscape canvas, camera and drawing buffer agree');
  await page.setViewportSize({ width: 768, height: 1024 });
  await matchingViewport('portrait canvas, camera and drawing buffer agree');
  // Model browser chrome reducing innerHeight while legacy 100vh retains the large viewport.
  // This tests the sizing contract, not Safari's native gesture recognition.
  await page.evaluate(() => {
    window.__nativeInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    window.dispatchEvent(new Event('resize'));
  });
  await matchingViewport('browser controls reduce canvas height without stretching the rendered camera');
  await page.evaluate(() => {
    Object.defineProperty(window, 'innerHeight', window.__nativeInnerHeight);
    delete window.__nativeInnerHeight;
    window.dispatchEvent(new Event('resize'));
  });
  await matchingViewport('canvas follows the viewport when browser controls withdraw');

  await page.evaluate(() => document.body.classList.remove('shot'));
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await page.locator('#fullscreen').tap();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await matchingViewport('fullscreen canvas dimensions agree');
    await page.locator('#fullscreen').tap();
    await page.waitForFunction(() => !document.fullscreenElement);
    await matchingViewport('explicit fullscreen exit retains correct canvas dimensions');
    assert.equal(await page.locator('#fullscreen').getAttribute('aria-pressed'), 'false');
  }
  await page.screenshot({ path: '/tmp/updraft-touch-viewport.png' });
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.writeFileSync('/tmp/updraft-touch-viewport.json', JSON.stringify(report, null, 2));
  await close();
}

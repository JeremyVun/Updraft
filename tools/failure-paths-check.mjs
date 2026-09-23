// Fault-injection coverage for the shell parcel's failure paths: a failed audio start must not block
// the frame loop, a frame-loop exception must show the recovery dialog, a blocked entry-module chunk
// must fall back to the start-screen failure state, and a missing float render-target extension must
// show the permanent "couldn't start" state with Try again hidden. Run without another GPU capture.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const { browser, close } = await openBrowser({ allowAutoplay: false });
const report = { checks: [] };

try {
  // 1. A failed AudioContext must not stop requestAnimationFrame(frame) from ever being reached.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.addInitScript(() => {
      class FailingAudioContext { constructor() { throw new DOMException('blocked', 'NotSupportedError'); } }
      // @ts-ignore
      window.AudioContext = FailingAudioContext;
      // @ts-ignore
      window.webkitAudioContext = FailingAudioContext;
    });
    await page.goto(base);
    await page.waitForSelector('#veil.ready', { timeout: 60000 });
    await page.locator('#begin').click();
    // Sound starting was the thing that could have stopped requestAnimationFrame(frame) from running;
    // the veil only detaches once real frames are presented, so this proves the loop kept going.
    await page.waitForSelector('#veil', { state: 'detached', timeout: 15000 });
    assert.equal(await page.locator('#sound').getAttribute('data-on'), 'false', 'sound control switched off after the failed start');
    assert.deepEqual(errors, [], 'the failure must be caught, not escape as a page error');
    await context.close();
    report.checks.push('failed AudioContext does not block Begin; sound switches off');
  }

  // 2. An exception thrown inside the frame loop shows the graphics-recovery dialog and stops scheduling.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '?shot&progress=0');
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    const before = await page.evaluate(() => window.__stats.frame);
    await page.evaluate(() => {
      const wind = window.__game.wind;
      const original = wind.step.bind(wind);
      let thrown = false;
      wind.step = (...args) => {
        if (!thrown) { thrown = true; throw new Error('injected frame fault'); }
        return original(...args);
      };
    });
    await page.waitForFunction(() => document.getElementById('graphics-recovery')?.hidden === false, null, { timeout: 5000 });
    assert(await page.evaluate(() => document.body.classList.contains('graphics-lost')));
    const buttonText = await page.locator('#graphics-recovery button').innerText();
    assert(['Continue from checkpoint', 'Restart game'].includes(buttonText), buttonText);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => window.__stats.frame);
    assert(after - before < 3, `scheduling must stop promptly after the fault (before=${before}, after=${after})`);
    assert.deepEqual(errors, [], 'the exception must be caught, not escape as a page error');
    await context.close();
    report.checks.push('a frame-loop exception shows the recovery dialog and stops scheduling');
  }

  // 3. A blocked entry-module chunk falls back to the inline watchdog's failure state.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    let blocked = 0;
    await page.route(url => /\/(src\/)?entry(-[^/]+)?\.(ts|js)$/.test(url.pathname), route => { blocked++; return route.abort(); });
    await page.goto(base);
    await page.waitForFunction(() => {
      const begin = document.getElementById('begin');
      return begin && !begin.disabled && begin.firstElementChild?.textContent === 'Try again';
    }, null, { timeout: 10000 });
    assert(blocked > 0, 'the fixture actually blocked the entry module');
    assert.equal(await page.locator('#start-status').innerText(), "The game couldn't start. Try again.");
    await page.unrouteAll();
    await page.locator('#begin').click();
    // The click reloads the page; wait for a genuine reboot (not just the same stale DOM) to prove it.
    await page.waitForSelector('#veil.ready', { timeout: 30000 });
    assert.equal(await page.locator('#begin').innerText(), 'Begin');
    report.checks.push('a blocked entry-module chunk shows the watchdog failure state; Try again reloads');
    await context.close();
  }

  // 4. A missing EXT_color_buffer_float shows the permanent failure state with Try again hidden.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await context.addInitScript(() => {
      const proto = WebGL2RenderingContext.prototype;
      const original = proto.getExtension;
      proto.getExtension = function (name) {
        if (name === 'EXT_color_buffer_float') return null;
        return original.call(this, name);
      };
    });
    await page.goto(base);
    await page.waitForFunction(() => document.getElementById('start-status')?.textContent === "The game couldn't start.", null, { timeout: 15000 });
    assert.equal(await page.locator('#begin').isHidden(), true, 'Try again must be hidden: retrying cannot help');
    await context.close();
    report.checks.push('a missing required GL extension shows the permanent failure state with Try again hidden');
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await close();
}

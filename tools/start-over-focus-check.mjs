// Real title-screen events without the 3D world; run against a dev server.
// BROWSER=webkit (default) or chromium. Full restart/save coverage: start-over-check.mjs.
import assert from 'node:assert/strict';
import { webkit } from 'playwright-core';
import { openBrowser } from './lib/browser.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const engine = process.env.BROWSER ?? 'webkit';
const browserRun = engine === 'chromium' ? await openBrowser({ allowAutoplay: false }) : null;
const browser = browserRun?.browser ?? await webkit.launch();
const key = 'updraft.progress.v1';
const saved = {
  version: 1, chapter: 'lines', point: 'entry', data: [],
  child: [0, 0, 0, 0, 0], boat: [0, 0, 0, 0, 0], bird: [0, 0, 0, 0, 0, 0, 1],
  plane: [1, 0], seat: null, life: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
};
const errors = [];
const ask = 'start over and lose your progress?';

async function open(context) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await withoutHotReload(page);
  await page.route('**/src/entry.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `import { startScreen } from '/src/start-screen.ts';
      window.starts = [];
      startScreen.ready((sound, pick) => {
        window.starts.push({ sound, pick: pick ?? null });
        window.audio = new AudioContext();
        void window.audio.resume();
      });`,
  }));
  await page.goto(base + '?progress=1');
  await page.waitForSelector('#veil.ready');
  return page;
}

try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      hasTouch: touch, isMobile: touch,
    });
    await context.addInitScript(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key, saved });
    const page = await open(context);
    const button = page.locator('.start-over');
    const press = () => touch ? button.tap() : button.click();
    await press();
    assert.equal(await button.textContent(), ask);
    assert.deepEqual(await page.evaluate(() => window.starts), []);
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).chapter, key), 'lines');
    await press();
    assert.deepEqual(await page.evaluate(() => window.starts), [{ sound: true, pick: 'island' }],
      `${engine} ${touch ? 'touch' : 'mouse'}: second press must confirm, not cancel and re-arm`);
    await page.waitForFunction(() => window.audio?.state === 'running');
    await page.close();

    if (!touch) {
      const keyboard = await open(context);
      const restart = keyboard.locator('.start-over');
      await restart.focus();
      await keyboard.keyboard.press('Enter');
      assert.equal(await restart.textContent(), ask);
      await keyboard.keyboard.press('Escape');
      assert.equal(await restart.textContent(), 'start over');
      await keyboard.keyboard.press('Space');
      await keyboard.keyboard.press('Shift+Tab');
      assert.equal(await restart.textContent(), 'start over', 'keyboard focus leaving cancels');
      await restart.click();
      await keyboard.locator('#begin').focus();
      assert.equal(await restart.textContent(), 'start over', 'programmatic focus leaving cancels');
      await restart.click();
      await keyboard.waitForFunction(() => !document.querySelector('#veil').classList.contains('asking'));
      assert.deepEqual(await keyboard.evaluate(() => window.starts), [], 'timeout does not start');
      await restart.focus();
      await keyboard.keyboard.press('Enter');
      await keyboard.keyboard.press('Space');
      assert.deepEqual(await keyboard.evaluate(() => window.starts), [{ sound: true, pick: 'island' }]);
      await keyboard.close();
    }

    const elsewhere = await open(context);
    await (touch ? elsewhere.locator('.start-over').tap() : elsewhere.locator('.start-over').click());
    if (touch) await elsewhere.touchscreen.tap(20, 20);
    else await elsewhere.mouse.click(20, 20);
    assert.deepEqual(await elsewhere.evaluate(() => window.starts), [{ sound: true, pick: null }],
      'pressing elsewhere continues the save');
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(`${engine}: restart mouse, touch, keyboard, focus cancellation, timeout and audio unlock pass`);
} finally {
  if (browserRun) await browserRun.close();
  else await browser.close();
}

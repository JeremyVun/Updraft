// Stills of the loading veil's stage line, held at known text, for comparing against the boot-veil comps.
// Usage: BASE=<QA preview> node tools/veil-stills.mjs [out-prefix]   (default /tmp/updraft-veil)
// Writes <prefix>-<device>-<day|night>-<a|c|long>.png at device scale 2: desktop 1440x900, ipad 1180x820,
// phone 390x844; stage A as index.html paints it, C mid-load ("Preparing the graphics 37%") and the longest
// line ("Laying out the ground and grass 96%"). LINES='[["Stage words","41%"],...]' replaces C and long.
// Traps: the game chunk is held with a module that never settles, not aborted (an abort runs startScreen.fail(),
// which fades the line), so the page never races to Begin; the spans get the same textContent writes progress()
// makes, so this shows the look, not the boot's timing. `?shot` would disable the start screen, so it is not used.
// The paddling is paused at one phase so frames compare; the backdrop's colour drift and wind lines still vary.
// Run against a QA preview (`dusk` is QA-only and gives the night veil), and not beside another GPU capture.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const prefix = process.argv[2] ?? '/tmp/updraft-veil';
const lines = process.env.LINES ? JSON.parse(process.env.LINES).map((l, i) => [`line${i + 1}`, ...l])
  : [['c', 'Preparing the graphics', '37%'], ['long', 'Laying out the ground and grass', '96%']];
const devices = { desktop: { width: 1440, height: 900 }, ipad: { width: 1180, height: 820 }, phone: { width: 390, height: 844 } };
const themes = { day: '', night: '&dusk=2' };
const { browser, close } = await openBrowser({ allowAutoplay: false });
const written = [];
try {
  for (const [device, viewport] of Object.entries(devices)) {
    const phone = device === 'phone';
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
    await context.route(url => /\/assets\/main-[^/]+\.js$/.test(url.pathname) || url.pathname.endsWith('/src/main.ts'),
      route => route.fulfill({ contentType: 'application/javascript', body: 'await new Promise(() => {});' }));
    for (const [theme, query] of Object.entries(themes)) {
      const page = await context.newPage();
      await page.goto(`${base}?start=1&progress=0&analytics=0${query}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('#veil').evaluate(e => e.classList.contains('night')), theme === 'night');
      assert.equal(await page.locator('#veil.ready').count(), 0, 'the veil must still be loading');
      await page.locator('.veil-loading').evaluate(e => { for (const a of e.getAnimations({ subtree: true })) { a.pause(); a.currentTime = 0; } });
      for (const [name, stage, percent] of [['a', null, null], ...lines]) {
        if (stage !== null) {
          await page.evaluate(([stage, percent]) => {
            document.querySelector('.progress-stage').textContent = stage;
            document.querySelector('.progress-percent').textContent = percent;
          }, [stage, percent]);
        }
        const box = await page.locator('.loading-text').boundingBox();
        assert(box.height < 30, `${device} ${name}: the line wraps (${box.height}px tall)`);
        assert(box.x >= 0 && box.x + box.width <= viewport.width, `${device} ${name}: the line overflows the screen`);
        const path = `${prefix}-${device}-${theme}-${name}.png`;
        await page.screenshot({ path });
        written.push(path);
      }
      await page.close();
    }
    await context.close();
  }
  console.log(written.join('\n'));
} finally {
  await close();
}

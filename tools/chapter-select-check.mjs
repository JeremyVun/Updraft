// Check title-screen chapter select: hidden and never downloaded for new players, offered after finishing
// (including saves finished before the flag existed), closing without starting, and a pick beginning that room.
// Usage: node tools/chapter-select-check.mjs (BASE defaults to http://127.0.0.1:5230/). Screenshots go to /tmp.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const out = process.env.OUT ?? '/tmp/updraft-chapter-select';
const title = base + '?shot&start=1&progress=1';
const { browser, close } = await openBrowser();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const fetched = [];
  page.on('request', r => { if (r.url().includes('chapter-select')) fetched.push(r.url()); });
  const ready = () => page.waitForSelector('#veil.ready', { timeout: 90000 });
  const started = () => page.evaluate(() => !document.body.classList.contains('starting') || !!document.querySelector('#veil.departing'));

  await page.goto(title);
  await ready();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('.chapters-toggle').count(), 0, 'new players are not offered chapters');
  assert.deepEqual(fetched, [], 'new players never download chapter select');
  await page.screenshot({ path: `${out}-new.png` });

  // A save finished before the flag existed still opens chapter select, and records the flag.
  await page.evaluate(() => localStorage.setItem('updraft.progress.v1', JSON.stringify({ version: 1, point: 'complete' })));
  await page.reload();
  await ready();
  await page.locator('.chapters-toggle').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('updraft.finished.v1')), '1');
  await page.evaluate(() => localStorage.removeItem('updraft.progress.v1'));
  await page.reload();
  await ready();
  await page.locator('.chapters-toggle').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}-title.png` });

  await page.locator('.chapters-toggle').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.chapter-still')].every(i => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}-open.png` });
  await page.keyboard.press('Escape');
  assert(await page.locator('.chapters').isHidden(), 'Escape closes the list');
  assert(!(await started()), 'closing does not begin the game');
  await page.locator('.chapters-toggle').click();
  await page.mouse.click(40, 40);
  assert(await page.locator('.chapters').isHidden(), 'a press beside the stills closes the list');
  assert(!(await started()), 'a press beside the stills does not begin the game');

  await page.locator('.chapters-toggle').click();
  await Promise.all([page.waitForEvent('framenavigated'), page.locator('.chapter', { hasText: 'Dark wood' }).click()]);
  await ready();
  assert.equal(await page.evaluate(() => __game.story.name), 'wood');
  assert.equal(await page.locator('#begin span').textContent(), 'Begin');
  await page.locator('#begin').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.chapter === 'wood', null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => sessionStorage.getItem('updraft.chosen-chapter')), null, 'the pick ends once its entry is saved');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}-wood.png` });
  await page.reload();
  await ready();
  assert.equal(await page.locator('#begin span').textContent(), 'Continue');
  assert.equal(await page.evaluate(() => __game.story.name), 'wood');

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const small = await phone.newPage();
  await small.goto(title);
  await small.evaluate(() => localStorage.setItem('updraft.finished.v1', '1'));
  await small.reload();
  await small.waitForSelector('#veil.ready', { timeout: 90000 });
  await small.locator('.chapters-toggle').tap();
  await small.waitForFunction(() => [...document.querySelectorAll('.chapter-still')].every(i => i.complete && i.naturalWidth > 0));
  await small.waitForTimeout(900);
  await small.screenshot({ path: `${out}-phone.png` });

  assert.deepEqual(errors, []);
  console.log(`chapter select ok; screenshots ${out}-{new,title,open,wood,phone}.png`);
} finally {
  await close();
}

// Check title-screen chapter select: hidden and never downloaded for new players, offered after finishing
// (including saves finished before the flag existed), closing without starting, and a pick starting that room in
// place: no navigation, the story already in the room at the click, audio running within a second of it, and the
// room's entry save replacing the old save on the first frame. Continue then resumes the picked room.
// Usage: node tools/chapter-select-check.mjs (BASE defaults to http://127.0.0.1:5230/). Screenshots go to /tmp.
// A pick matching a fresh `?chapter=` load in every room is tools/chapter-pick-check.mjs.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const out = process.env.OUT ?? '/tmp/updraft-chapter-select';
const key = 'updraft.progress.v1';
const title = base + '?shot&start=1&progress=1';
const { browser, close } = await openBrowser({ allowAutoplay: false });
const errors = [];
const report = {};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(key => {
    const Native = window.AudioContext;
    window.__audio = [];
    window.__audioRunningAt = null;
    window.AudioContext = class extends Native {
      constructor(...a) {
        super(...a);
        window.__audio.push(this);
        const running = () => { if (this.state === 'running') window.__audioRunningAt ??= performance.now(); };
        this.addEventListener('statechange', running);
        running();
      }
    };
    window.__saves = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === key) window.__saves.push({ ...JSON.parse(v), frame: window.__stats?.frame ?? 0 });
      return setItem.call(this, k, v);
    };
    window.__pickAt = null;
    addEventListener('click', e => { if (e.target.closest?.('.chapter')) window.__pickAt = performance.now(); }, true);
  }, key);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  let navigations = 0;
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });
  const fetched = [];
  page.on('request', r => { if (r.url().includes('chapter-select')) fetched.push(r.url()); });
  const ready = () => page.waitForSelector('#veil.ready', { timeout: 90000 });
  const started = () => page.evaluate(() => !document.body.classList.contains('starting') || !!document.querySelector('#veil.departing'));
  const stills = () => page.waitForFunction(() => [...document.querySelectorAll('.chapter-still')].every(i => i.complete && i.naturalWidth > 0));

  await page.goto(title);
  await ready();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('.chapters-toggle').count(), 0, 'new players are not offered chapters');
  assert.deepEqual(fetched, [], 'new players never download chapter select');
  await page.screenshot({ path: `${out}-new.png` });

  // A save finished before the flag existed still opens chapter select, and records the flag.
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, point: 'complete' })), key);
  await page.reload();
  await ready();
  await page.locator('.chapters-toggle').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => localStorage.getItem('updraft.finished.v1')), '1');
  await page.evaluate(key => localStorage.removeItem(key), key);
  await page.reload();
  await ready();
  await page.locator('.chapters-toggle').waitFor({ state: 'visible' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}-title.png` });

  await page.locator('.chapters-toggle').click();
  await stills();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}-open.png` });
  await page.keyboard.press('Escape');
  assert(await page.locator('.chapters').isHidden(), 'Escape closes the list');
  assert(!(await started()), 'closing does not begin the game');
  await page.locator('.chapters-toggle').click();
  await page.mouse.click(40, 40);
  assert(await page.locator('.chapters').isHidden(), 'a press beside the stills closes the list');
  assert(!(await started()), 'a press beside the stills does not begin the game');

  // A save from another room, for the pick to replace.
  await page.goto(base + '?shot&progress=1&chapter=sleeping');
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) ?? 'null')?.chapter === 'sleeping', key, { timeout: 90000 });
  await page.goto(title);
  await ready();
  assert.equal(await page.locator('#begin span').textContent(), 'Continue');
  await page.waitForTimeout(950);
  // Shot mode defaults to silent; the pick itself must still create and unlock audio.
  await page.locator('#sound').evaluate(button => { if (button.dataset.on === 'false') button.click(); });
  assert.equal(await page.evaluate(() => __audio.length), 0, 'no audio before the pick');
  await page.locator('.chapters-toggle').click();
  await stills();
  const before = navigations;
  await page.evaluate(() => { window.__saves.length = 0; });
  await page.locator('.chapter', { hasText: 'Dark wood' }).click();
  assert.equal(await page.evaluate(() => __game.story.name), 'wood', 'the pick starts the room at the click');
  await page.waitForFunction(() => window.__audioRunningAt !== null, null, { timeout: 5000 });
  report.audioMs = await page.evaluate(() => Math.round(window.__audioRunningAt - window.__pickAt));
  assert(report.audioMs < 1000, `audio running ${report.audioMs} ms after the pick`);
  assert.equal(await page.evaluate(() => __audio.length), 1, 'one AudioContext');
  await page.waitForSelector('#veil', { state: 'detached', timeout: 30000 });
  await page.waitForFunction(() => __stats.frame > 30);
  report.navigations = navigations - before;
  assert.equal(report.navigations, 0, 'a pick does not navigate');
  const first = await page.evaluate(() => window.__saves[0]);
  report.firstSave = first && { chapter: first.chapter, point: first.point, framesBefore: first.frame };
  assert.equal(first?.chapter, 'wood', 'the first save after the pick is the picked room');
  assert.equal(first.point, 'entry', "the first save after the pick is the room's entry");
  assert.equal(first.frame, 0, `the entry save waited ${first.frame} frames`);
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).chapter, key), 'wood');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}-wood.png` });
  await page.reload();
  await ready();
  assert.equal(await page.locator('#begin span').textContent(), 'Continue');
  await page.locator('#begin').click();
  assert.equal(await page.evaluate(() => __game.story.name), 'wood', 'Continue resumes the picked room');

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
  console.log(JSON.stringify(report));
  console.log(`chapter select ok; screenshots ${out}-{new,title,open,wood,phone}.png`);
} finally {
  await close();
}

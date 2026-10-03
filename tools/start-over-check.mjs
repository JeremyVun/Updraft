// Check the title screen's start over: never offered without a save; a first press asks without starting; the question
// goes back to `start over` after its wait, on Escape and when focus leaves it; a second press starts the first island in
// place (no navigation, audio running within a second, the island's save replacing the old one, no program first drawn
// in play); a press elsewhere on the veil while it asks still continues the save; a phone tap asks and a second starts.
// Usage: node tools/start-over-check.mjs (BASE defaults to http://127.0.0.1:5230/). Use a QA preview. Screenshots to /tmp.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const out = process.env.OUT ?? '/tmp/updraft-start-over';
const key = 'updraft.progress.v1';
const title = base + '?shot&start=1&progress=1';
const ASK = 'start over and lose your progress?';
const { browser, close } = await openBrowser({ allowAutoplay: false });
const errors = [];
const report = { checks: [] };
const instrument = key => {
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
  window.__pressAt = null;
  addEventListener('click', e => { if (e.target.closest?.('.start-over')) window.__pressAt = performance.now(); }, true);
};
const savedChapter = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null')?.chapter ?? null, key);
const seed = async (page, start, chapter = start) => {
  // A save outranks `?chapter=`, so the old one goes first.
  if (page.url().startsWith(base)) await page.evaluate(key => localStorage.removeItem(key), key);
  await page.goto(`${base}?shot&progress=1&chapter=${start}`);
  await page.waitForFunction(([key, chapter]) => JSON.parse(localStorage.getItem(key) ?? 'null')?.chapter === chapter,
    [key, chapter], { timeout: 90000 });
};
const openTitle = async page => {
  await page.goto(title);
  await page.waitForSelector('#veil.ready', { timeout: 90000 });
  await page.waitForTimeout(950);
  // Shot mode defaults to silent; the press that starts must itself create and unlock audio.
  await page.locator('#sound').evaluate(button => { if (button.dataset.on === 'false') button.click(); });
};
const started = page => page.evaluate(() => !!document.querySelector('#veil.departing') || !document.body.classList.contains('starting'));
const label = page => page.locator('.start-over').textContent();

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(instrument, key);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  let navigations = 0;
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations++; });

  await page.goto(title.replace('progress=1', 'progress=0'));
  await page.waitForSelector('#veil.ready', { timeout: 90000 });
  assert.equal(await page.locator('.start-over').count(), 0, 'Begin offers no start over');
  report.checks.push('no start over without a save');

  await seed(page, 'sleeping');
  await openTitle(page);
  assert.equal(await page.locator('#begin span').textContent(), 'Continue');
  assert.equal(await label(page), 'start over');

  await page.locator('.start-over').click();
  assert.equal(await label(page), ASK, 'the first press asks');
  assert(!(await started(page)), 'the first press does not start');
  assert.equal(await page.evaluate(() => __audio.length), 0, 'the first press starts no audio');
  assert.equal(await savedChapter(page), 'sleeping', 'the first press keeps the save');
  await page.mouse.move(4, 4);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}-asking.png` });
  const since = () => page.evaluate(() => performance.now() - window.__pressAt);
  await page.waitForFunction(() => performance.now() - window.__pressAt > 5600);
  const asking = await label(page);
  report.askingAt = Math.round(await since());
  assert.equal(asking, ASK, `still asking ${report.askingAt} ms after the press`);
  await page.waitForFunction(() => performance.now() - window.__pressAt > 6300);
  assert.equal(await label(page), 'start over', 'the question goes back after 6 s');
  report.checks.push('first press asks without starting; goes back after 6 s');

  await page.locator('.start-over').click();
  assert.equal(await label(page), ASK);
  await page.keyboard.press('Escape');
  assert.equal(await label(page), 'start over', 'Escape takes the question back');
  assert(!(await started(page)));
  await page.locator('.start-over').click();
  assert.equal(await label(page), ASK);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await label(page), 'start over', 'focus leaving takes the question back');
  assert(!(await started(page)));
  report.checks.push('Escape and focus leaving take the question back');

  await page.locator('.start-over').click();
  const before = navigations;
  await page.evaluate(() => { window.__saves.length = 0; });
  await page.locator('.start-over').click();
  const atPress = await page.evaluate(() => __game.story.name);
  assert.equal(atPress, 'island', 'the second press starts the first island');
  await page.waitForFunction(() => window.__audioRunningAt !== null, null, { timeout: 5000 });
  report.audioMs = await page.evaluate(() => Math.round(window.__audioRunningAt - window.__pressAt));
  assert(report.audioMs < 1000, `audio running ${report.audioMs} ms after the press`);
  assert.equal(await page.evaluate(() => __audio.length), 1, 'one AudioContext');
  await page.waitForSelector('#veil', { state: 'detached', timeout: 30000 });
  await page.waitForFunction(() => __stats.frame > 30);
  report.navigations = navigations - before;
  assert.equal(report.navigations, 0, 'start over does not navigate');
  const first = await page.evaluate(() => window.__saves[0]);
  report.firstSave = first && { chapter: first.chapter, point: first.point, framesBefore: first.frame };
  assert.equal(first?.chapter, 'island', 'the first save after start over is the first island');
  assert.equal(await savedChapter(page), 'island', "the island's save replaced the old one");
  await page.waitForTimeout(3000);
  report.playFirstDraws = await page.evaluate(() => window.__stats?.playFirstDraws);
  assert.equal(report.playFirstDraws?.programs, 0, `programs first drawn in play: ${report.playFirstDraws?.names.join(', ')}`);
  await page.screenshot({ path: `${out}-island.png` });
  report.checks.push('second press starts the island in place with sound; its save replaces the old one');

  await seed(page, 'sleeping');
  await openTitle(page);
  await page.locator('.start-over').click();
  assert.equal(await label(page), ASK);
  await page.mouse.click(100, 120);
  assert.equal(await page.evaluate(() => __game.story.name), 'sleeping', 'a press elsewhere continues the save');
  await page.waitForSelector('#veil', { state: 'detached', timeout: 30000 });
  assert.equal(await savedChapter(page), 'sleeping');
  report.checks.push('a press elsewhere on the veil while asking continues the save');
  await context.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await phone.addInitScript(instrument, key);
  const small = await phone.newPage();
  small.on('pageerror', e => errors.push(e.message));
  await seed(small, 'washing', 'lines');
  await small.evaluate(() => localStorage.setItem('updraft.finished.v1', '1'));
  await openTitle(small);
  await small.locator('.chapters-toggle').waitFor({ state: 'visible' });
  const [toggle, button] = await Promise.all(['.chapters-toggle', '.start-over'].map(s => small.locator(s).boundingBox()));
  assert(button.y >= toggle.y + toggle.height - 1, 'a finished player sees start over below chapters');
  assert(button.height >= 44, `start over is ${button.height} px tall`);
  await small.locator('.start-over').tap();
  assert.equal(await label(small), ASK, 'a tap asks');
  assert(!(await started(small)));
  await small.waitForTimeout(600);
  await small.screenshot({ path: `${out}-phone-asking.png` });
  await small.locator('.start-over').tap();
  assert.equal(await small.evaluate(() => __game.story.name), 'island', 'a second tap starts the first island');
  await small.waitForSelector('#veil', { state: 'detached', timeout: 30000 });
  assert.equal(await small.evaluate(() => __audio[0]?.state), 'running');
  report.checks.push('390 px phone: start over under chapters, a tap asks, a second tap starts the island');
  await phone.close();

  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
  console.log(`start over ok; screenshots ${out}-{asking,island,phone-asking}.png`);
} finally {
  await close();
}

// Check title-screen chapter select: hidden and never downloaded for new players, offered after finishing
// (including saves finished before the flag existed), closing without starting, and a pick starting that room in
// place: no navigation, the story already in the room at the click, audio running within a second of it, and the
// room's entry save replacing the old save on the first frame, with the panel fading out over its .45 s rather than
// vanishing. The tiles are the room paintings cut to 400x250. The list opens over the title's own painting, which
// stays; with a hovering pointer, opening fetches every room's painting once, and looking at a tile crossfades that
// room's painting in without the stack ever dropping below full cover. `back`, Escape and a press on empty space close the
// list without starting, `back` returning focus to `chapters`, and a double click on `chapters` leaves it open. On a
// phone the list fits without scrolling. Continue then resumes the picked room.
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
  const paintings = [];
  page.on('request', r => { const m = r.url().match(/\/([a-z]+)-(?:land|port)[^/]*\.webp/); if (m) paintings.push(m[1]); });
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

  assert(await page.locator('#veil').evaluate(e => e.classList.contains('painted')), 'the room painting shows behind the title');
  const titleRoom = await page.locator('.veil-painting').getAttribute('data-room');
  paintings.length = 0;
  await page.locator('.chapters-toggle').click();
  await stills();
  report.tiles = await page.evaluate(() => [...document.querySelectorAll('.chapter-still')].map(i => `${new URL(i.currentSrc).pathname.split('/').pop().split(/[-.]/)[0]} ${i.naturalWidth}x${i.naturalHeight}`));
  assert.equal(report.tiles.length, 12, 'twelve tiles');
  for (const tile of report.tiles) assert.match(tile, / 400x250$/, `tile ${tile}`);
  await page.waitForTimeout(900);
  assert.equal(await page.locator('.veil-painting').evaluate(e => getComputedStyle(e).opacity), '1', 'the painting stays while the list is open');
  assert.equal(await page.locator('.chapters-backdrop').evaluate(e => getComputedStyle(e).opacity), '1', 'the muted painting is up');
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.chapters-painting.shown')].map(e => e.dataset.room));
  assert.deepEqual(await shown(), [titleRoom], "the list opens over the title's own painting");
  await page.waitForFunction(() => document.querySelectorAll('.chapters-painting[data-ready]').length === 12, null, { timeout: 30000 })
    .catch(() => assert.fail(`opening fetches every painting: ${paintings}`));
  await page.screenshot({ path: `${out}-open.png` });

  // Looking at a room crossfades its painting in over the last, which stays whole until covered.
  // Settled once the room's painting alone is shown, the one under it covered.
  const look = async (name, room) => {
    const box = await page.locator('.chapter', { hasText: name }).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .35, { steps: 3 });
    if (!room) return page.waitForTimeout(400);
    const t0 = Date.now();
    await page.waitForFunction(room => {
      const shown = [...document.querySelectorAll('.chapters-painting.shown')];
      return shown.length === 1 && shown[0].dataset.room === room && getComputedStyle(shown[0]).opacity === '1';
    }, room, { timeout: 10000 }).catch(async () => assert.fail(`hovering ${name} brings its painting alone: ${await shown()}`));
    (report.settle ??= []).push(`${room} ${Date.now() - t0} ms`);
  };
  await look('Meadow', 'meadow');
  await page.evaluate(() => {
    window.__cover = [];
    window.__sampling = true;
    const sample = () => {
      const clear = [...document.querySelectorAll('.chapters-painting')].reduce((p, e) => p * (1 - +getComputedStyle(e).opacity), 1);
      window.__cover.push(1 - clear);
      if (window.__sampling) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await look('Sky mirror', 'mirror');
  await look('Meadow', 'meadow');
  // Back before the next painting has covered it.
  await look('Sky mirror');
  await look('Meadow', 'meadow');
  await page.waitForTimeout(800);
  const cover = await page.evaluate(() => { window.__sampling = false; return window.__cover; });
  report.crossfade = { frames: cover.length, minCover: +Math.min(...cover).toFixed(4) };
  assert(cover.length > 60 && report.crossfade.minCover > 0.999, `the crossfade never dips below full cover: ${JSON.stringify(report.crossfade)}`);
  report.paintings = [...paintings];
  assert.equal(paintings.length, new Set(paintings).size, `each painting fetched once: ${paintings}`);

  await page.keyboard.press('Escape');
  assert(await page.locator('.chapters').isHidden(), 'Escape closes the list');
  assert(!(await started()), 'closing does not begin the game');
  await page.locator('.chapters-toggle').click();
  await page.mouse.click(40, 40);
  assert(await page.locator('.chapters').isHidden(), 'a press beside the stills closes the list');
  assert(!(await started()), 'a press beside the stills does not begin the game');
  await page.locator('.chapters-toggle').click();
  const toggleBox = await page.locator('.chapters-toggle').evaluate(e => e.getBoundingClientRect().toJSON());
  const backBox = await page.locator('.chapters-back').boundingBox();
  assert(Math.abs(backBox.y - toggleBox.y) < 1 && Math.abs(backBox.x + backBox.width / 2 - (toggleBox.x + toggleBox.width / 2)) < 1, '`back` stands where `chapters` was');
  await page.locator('.chapters-back').click();
  assert(await page.locator('.chapters').isHidden(), '`back` closes the list');
  assert(!(await started()), '`back` does not begin the game');
  assert(await page.evaluate(() => document.activeElement?.classList.contains('chapters-toggle')), '`back` returns focus to `chapters`');
  await page.locator('.chapters-toggle').dblclick();
  await page.waitForTimeout(300);
  assert(await page.locator('.chapters').isVisible(), 'a double click on `chapters` leaves the list open');
  assert(!(await started()), 'a double click does not begin the game');
  await page.keyboard.press('Escape');

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
  await page.evaluate(() => {
    window.__saves.length = 0;
    window.__panel = [];
    const panel = document.querySelector('.chapters');
    const sample = now => {
      if (window.__pickAt === null) { requestAnimationFrame(sample); return; }
      const opacity = +getComputedStyle(panel).opacity;
      window.__panel.push([Math.round(now - window.__pickAt), opacity]);
      // Timed from the fade's own start, because the room starting can hold the first frames after the click.
      if (opacity < 1) window.__fadeAt ??= now;
      if (window.__fadeAt === undefined || now - window.__fadeAt < 700) requestAnimationFrame(sample);
      else window.__panelDone = true;
    };
    requestAnimationFrame(sample);
  });
  await page.locator('.chapter', { hasText: 'Dark wood' }).click();
  const atClick = await page.evaluate(() => __game.story.name).catch(e => e.message);
  assert.equal(navigations - before, 0, 'a pick does not navigate');
  assert.equal(atClick, 'wood', 'the pick starts the room at the click');
  await page.waitForFunction(() => window.__audioRunningAt !== null, null, { timeout: 5000 });
  report.audioMs = await page.evaluate(() => Math.round(window.__audioRunningAt - window.__pickAt));
  assert(report.audioMs < 1000, `audio running ${report.audioMs} ms after the pick`);
  assert.equal(await page.evaluate(() => __audio.length), 1, 'one AudioContext');
  await page.waitForFunction(() => window.__panelDone, null, { timeout: 5000 });
  report.panel = await page.evaluate(() => window.__panel.map(([t, o]) => `${t}:${o.toFixed(2)}`).join(' '));
  const fading = await page.evaluate(() => window.__panel.filter(([t, o]) => o > 0.05 && o < 0.95).length);
  assert(fading >= 2, `the panel fades rather than vanishing: ${report.panel}`);
  assert.equal(await page.evaluate(() => window.__panel.at(-1)[1]), 0, `the panel has gone by the end of its fade: ${report.panel}`);
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
  report.phone = await small.evaluate(() => {
    const list = document.querySelector('.chapters-list');
    const boxes = [...document.querySelectorAll('.chapters :is(.chapter, .chapters-back)')].map(e => e.getBoundingClientRect());
    return { scroll: [list.scrollHeight, list.clientHeight], span: [Math.min(...boxes.map(b => b.top)), Math.max(...boxes.map(b => b.bottom)), innerHeight] };
  });
  const { scroll, span } = report.phone;
  assert(scroll[0] <= scroll[1] && span[0] >= 0 && span[1] <= span[2], `the list fits a phone without scrolling: ${JSON.stringify(report.phone)}`);
  assert(await small.evaluate(() => document.querySelectorAll('.chapters-painting').length <= 1), 'on touch no other painting is fetched');
  await small.screenshot({ path: `${out}-phone.png` });

  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report));
  console.log(`chapter select ok; screenshots ${out}-{new,title,open,wood,phone}.png`);
} finally {
  await close();
}

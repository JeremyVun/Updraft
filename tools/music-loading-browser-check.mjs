// Held downloads/decodes test the real veil and Begin gesture. Vite on 5230; shared GPU lock.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser({ allowAutoplay: false });
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const report = [];
try {
  for (const mode of ['parallel', 'failure', 'timeout', 'cancel', 'disabled']) {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    let releaseDownload;
    const held = new Promise(resolve => { releaseDownload = resolve; });
    await page.route('**/assets/music/**', async route => {
      if (route.request().resourceType() !== 'fetch') return route.continue();
      requests.push(route.request().url());
      if (mode === 'failure') return route.fulfill({ status: 503, body: 'Unavailable' });
      await held;
      try { await route.continue(); } catch { /* Cancellation may close the page first. */ }
    });
    await page.addInitScript(mode => {
      localStorage.setItem('updraft.music.v1', mode === 'disabled' ? 'off' : 'on');
      window.contexts = 0;
      const Native = window.AudioContext;
      window.AudioContext = class extends Native { constructor(...args) { super(...args); contexts++; } };
      const fetchNative = window.fetch;
      window.musicFetchTimes = [];
      window.fetch = (...args) => {
        if (String(args[0]).includes('.ogg')) musicFetchTimes.push(performance.now());
        return fetchNative(...args);
      };
      if (mode === 'parallel') {
        const decode = BaseAudioContext.prototype.decodeAudioData;
        BaseAudioContext.prototype.decodeAudioData = async function (bytes) {
          const buffer = await decode.call(this, bytes);
          window.decodeWaiting = true;
          await new Promise(resolve => { window.releaseDecode = resolve; });
          return buffer;
        };
      }
    }, mode);
    const shot = mode === 'parallel' || mode === 'disabled' ? '' : 'shot&';
    await page.goto(`${base}?${shot}start=1&progress=0&ratio=1&msaa=2`);
    await page.waitForSelector('#veil.ready', { timeout: 60000 });
    assert.equal(await page.evaluate(() => contexts), 0, 'No context before Begin');
    if (mode === 'parallel') {
      assert.equal(requests.length, 1, 'Only the opening recording downloads during boot');
      assert(await page.evaluate(() => musicFetchTimes[0] < performance.getEntriesByName('boot')[0].startTime),
        'Download starts before shader compilation, which finishes while the download is held');
    }
    await page.evaluate(async mutate => {
      const module = file => import(performance.getEntriesByType('resource')
        .findLast(r => new URL(r.name).pathname === file)?.name ?? file);
      const { Soundscape } = await module('/src/audio/audio.ts');
      if (mutate) Soundscape.prototype.prepareMusic = () => Promise.resolve();
      window.audioUpdates = 0;
      const update = Soundscape.prototype.update;
      Soundscape.prototype.update = function (...args) { audioUpdates++; return update.apply(this, args); };
    }, process.env.MUTATE === 'skip');
    if (mode === 'timeout') await page.evaluate(() => { __game.tuning.audio.musicLoadTimeoutMs = 700; });
    if (shot) await page.locator('#sound').evaluate(button => button.click());
    await page.locator('#begin').click();
    if (mode === 'parallel' || mode === 'cancel') {
      await page.waitForFunction(() => document.querySelector('.progress-stage')?.textContent === 'Preparing music', null, { timeout: 3000 });
      assert.equal(await page.evaluate(() => audioUpdates), 0, 'Gameplay waits for downloaded music');
      assert.equal(await page.locator('#veil.lifted').count(), 0);
      if (mode === 'parallel') {
        releaseDownload();
        await page.waitForFunction(() => window.decodeWaiting);
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => audioUpdates), 0, 'Gameplay also waits for decode');
        await page.evaluate(() => releaseDecode());
      } else {
        await page.locator('#music').evaluate(button => button.click());
      }
    }
    await page.waitForFunction(() => audioUpdates > 0, null, { timeout: 5000 });
    await page.waitForSelector('#veil', { state: 'detached', timeout: 10000 });
    if (mode === 'disabled') assert.equal(requests.length, 0, 'Music-off startup never downloads');
    else {
      assert.equal(requests.filter(url => url.includes('/still.ogg')).length, 1, 'Startup reuses its download without repeated failures');
      assert(requests.every(url => /\/still(?:_2)?\.ogg/.test(url)), 'Only the current and next recording download');
    }
    if (mode === 'cancel') assert(await page.evaluate(() => !__game.sound.stillPhrases));
    assert.deepEqual(errors, []);
    report.push({ mode, requests: requests.length, passed: true });
    releaseDownload();
    await page.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await close(); }

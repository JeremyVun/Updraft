// Real Begin gestures, preference-aware downloads and chapter playback. Vite on 5230, or BASE; shared GPU lock.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser({ allowAutoplay: false });
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const report = [];
try {
  for (const [chapter, track, field] of [['summit', 'home', 'summitScore'], ['birches', 'birches', 'birchesScore'], ['washing', 'lines', 'linesScore'], ['boats', 'boats', 'boatsScore']]) {
    if (process.env.TRACK && process.env.TRACK !== track) continue;
    const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (request.resourceType() === 'fetch' && /\.ogg(?:\?|$)/.test(request.url())) requests.push(request.url());
    });
    await page.goto(`${base}?shot&start=1&progress=0&chapter=${chapter}&ratio=1&msaa=2`);
    await page.waitForSelector('#veil.ready', { timeout: 60000 });
    assert.equal(requests.length, 0, `${track}: sound-off boot downloads no music`);
    await page.locator('#sound').evaluate(button => { if (button.dataset.on === 'false') button.click(); });
    await page.locator('#begin').click();
    try {
      await page.waitForFunction(field => window.__game?.sound[field]?.source?.buffer, field, { timeout: 30000 });
    } catch (error) {
      console.log({ track, requests, errors, state: await page.evaluate(field => {
        const sound = window.__game?.sound;
        return { chapter: window.__game?.story.name, running: sound?.running, context: sound?.ctx?.state,
          muted: sound?.muted, hidden: sound?.hidden, phase: sound?.[field]?.phase,
          stopped: sound?.[field]?.stopped, prepared: sound?.preparedScore?.track };
      }, field) });
      throw error;
    }
    const result = await page.evaluate(field => {
      const sound = __game.sound, score = sound[field];
      const analyser = sound.ctx.createAnalyser(); score.bus.connect(analyser);
      window.recordedAnalyser = analyser;
      return { chapter: __game.story.name, track: score.track, duration: score.source.buffer.duration,
        running: sound.running, loop: score.source.loop };
    }, field);
    await page.waitForFunction(() => {
      const data = new Float32Array(recordedAnalyser.fftSize);
      recordedAnalyser.getFloatTimeDomainData(data);
      return data.some(value => Math.abs(value) > 1e-5);
    }, null, { timeout: 15000 });
    assert(result.running && result.loop);
    assert.equal(result.track, track);
    const file = track === 'birches' ? 'red_door.ogg' : `${track}.ogg`;
    assert.equal(requests.filter(url => url.includes(file)).length, 1, `${track}: startup download is reused`);
    assert(requests.every(url => url.includes(file) || track === 'lines' && url.includes('boats.ogg') || track === 'birches' && url.includes('birches.ogg')),
      `${track}: only the starting recording and next destination may download`);
    assert(requests[0].includes(file));
    assert.deepEqual(errors, []);
    report.push({ ...result, requests, audible: true });
    await page.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await close(); }

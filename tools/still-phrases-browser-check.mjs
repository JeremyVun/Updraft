// Real Begin and wind strokes through the main loop. Vite on 5230; shared GPU lock.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser({ allowAutoplay: false });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.resourceType() === 'fetch' && /\.ogg(?:\?|$)/.test(request.url())) requests.push(request.url());
  });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&start=1&progress=0&ratio=1&msaa=2`);
  await page.waitForSelector('#veil.ready', { timeout: 60000 });
  assert.equal(requests.length, 0);
  await page.locator('#sound').evaluate(button => { if (button.dataset.on === 'false') button.click(); });
  await page.locator('#begin').click();
  await page.waitForFunction(() => __game.sound.stillPhrases?.buffer, null, { timeout: 30000 });
  await page.waitForFunction(() => Number.isFinite(__stats.heightParity));
  const heightParity = await page.evaluate(() => __stats.heightParity);
  assert(heightParity < .02, `CPU and rendered terrain agree after moving Still: ${heightParity}`);
  await page.evaluate(() => {
    window.phraseEvents = [];
    const sound = __game.sound, update = sound.update.bind(sound);
    sound.update = (dt, state) => {
      const before = sound.stillPhrases?.next;
      update(dt, state);
      if (state.stillPhrase || before !== sound.stillPhrases?.next) phraseEvents.push({ before, after: sound.stillPhrases?.next,
        continued: !!state.stillFlying && !state.stillPhrase,
        flying: !__game.glider.held && __game.glider.airborne, at: sound.ctx.currentTime });
    };
  });
  for (let stroke = 0; stroke < 5; stroke++) {
    const points = await page.evaluate(async stroke => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const { heightAt } = await import('/src/world/island.ts');
      const { STILL_SHIFT } = await import('/src/world/geography.ts');
      return [-18, 8].map(x => {
        x += STILL_SHIFT.x;
        const z = -8 + stroke * 3 + STILL_SHIFT.z, p = new THREE.Vector3(x, heightAt(x, z), z).project(__game.rig.camera);
        return { x: (p.x + 1) * 640, y: (1 - p.y) * 400 };
      });
    }, stroke);
    await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
    await page.mouse.move(points[1].x, points[1].y, { steps: 24 }); await page.mouse.up();
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => __game.sound.stillPhrases?.voice, null, { timeout: 10000 });
  const result = await page.evaluate(() => {
    const sound = __game.sound, source = sound.stillPhrases.voice.source;
    const analyser = sound.ctx.createAnalyser(); sound.stillPhrases.voice.gain.connect(analyser);
    window.phraseAnalyser = analyser; window.phraseSource = source;
    return { events: phraseEvents, droneDisabled: !sound.openingScore && sound.padGain.gain.value < 1e-6 };
  });
  await page.waitForFunction(() => {
    const data = new Float32Array(phraseAnalyser.fftSize); phraseAnalyser.getFloatTimeDomainData(data);
    return data.some(v => Math.abs(v) > 1e-5);
  }, null, { timeout: 10000 });
  assert(result.droneDisabled);
  assert(result.events.some(e => e.after === e.before + 1), 'Real input starts a phrase');
  assert(result.events.some(e => e.after === e.before), 'Further real gestures are dropped while busy');
  await page.evaluate(() => __game.sound.setHidden(true));
  await page.waitForFunction(() => __game.sound.ctx.state === 'suspended');
  const frozen = await page.evaluate(() => __game.sound.ctx.currentTime);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => __game.sound.ctx.currentTime), frozen);
  assert(await page.evaluate(() => __game.sound.stillPhrases.voice.source === phraseSource));
  await page.evaluate(() => __game.sound.setHidden(false));
  await page.waitForFunction(() => __game.sound.running);
  await page.waitForFunction(() => phraseEvents.some(event => event.flying), null, { timeout: 20000 });
  result.events = await page.evaluate(() => phraseEvents);
  assert(result.events.some(event => !event.flying), 'Colour growth triggers before the plane flies');
  assert(result.events.some(event => event.flying), 'The real plane takeoff requests a phrase');
  // Keep real plane physics airborne with a controlled updraft, without creating colour gestures.
  await page.evaluate(() => {
    const wind = __game.wind, plane = __game.glider, sample = wind.sample.bind(wind);
    wind.sample = (x, z, out) => {
      const value = sample(x, z, out);
      if (out === plane.sample && !plane.held) value.lift = Math.max(value.lift, .4);
      return value;
    };
    window.restoreFlightWind = () => { wind.sample = sample; };
  });
  await page.waitForFunction(() => phraseEvents.some(event => event.continued && event.after === event.before + 1), null, { timeout: 30000 });
  await page.evaluate(() => restoreFlightWind());
  result.events = await page.evaluate(() => phraseEvents);
  const repeated = result.events.find(event => event.continued && event.after === event.before + 1);
  const previous = result.events.filter(event => event.at < repeated.at && event.after === event.before + 1).at(-1);
  assert(repeated.at - previous.at >= 6 && repeated.at - previous.at < 6.2,
    'A sustained flight through the real main loop repeats six seconds after the last accepted phrase');
  assert.equal(requests.filter(url => url.includes('/still.ogg')).length, 1);
  await page.evaluate(async () => {
    const { BOAT_BERTH } = await import('/src/story/island.ts');
    window.islandPhrases = __game.sound.stillPhrases;
    __game.story.sail(BOAT_BERTH.x, BOAT_BERTH.z, .95); __game.story.begin('toLines');
    __game.story.current.time = 20.5;
  });
  await page.waitForFunction(() => __game.sound.stillDepartureScore?.source && !__game.sound.stillPhrases,
    null, { timeout: 10000 });
  await page.evaluate(() => { window.crossingSource = __game.sound.stillDepartureScore.source; });
  await page.evaluate(() => { __game.story.current.time = 44.5; });
  await page.waitForFunction(() => __game.story.current.whaleCalled, null, { timeout: 10000 });
  assert(await page.evaluate(() => __game.sound.stillDepartureScore.source === crossingSource), 'The second recording continues while the whale surfaces');
  await page.evaluate(() => __game.story.begin('lines'));
  await page.waitForFunction(() => __game.sound.linesScore?.source && !__game.sound.stillPhrases,
    null, { timeout: 10000 });
  assert.equal(requests.filter(url => url.includes('lines.ogg')).length, 1,
    'The crossing prefetch is consumed before the next destination replaces it');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...result, audible: true, hiddenFreezesSameSource: true,
    crossingThroughWhale: true, linesTakesOver: true, requests }, null, 2));
} finally { await close(); }

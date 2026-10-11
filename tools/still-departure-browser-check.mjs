// Real bandaging and secured-plane departure, then crossing continuity and title timing. Uses the shared GPU lock.
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
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&start=1&progress=0&chapter=tree&ratio=1&msaa=2`);
  await page.waitForSelector('#veil.ready', { timeout: 60000 });
  await page.evaluate(() => {
    window.departure = { launches: 0, score: null, premature: false, muted: false, released: false };
    window.sourceOffsets = new WeakMap();
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) { sourceOffsets.set(this, args[1] ?? 0); return start.apply(this, args); };
    const plane = __game.glider, launch = plane.launch.bind(plane);
    plane.launch = (...args) => {
      departure.launches++;
      return launch(...args);
    };
    const sound = __game.sound, update = sound.update.bind(sound);
    sound.update = (...args) => {
      update(...args);
      if (__game.story.name === 'island') {
        departure.muted ||= __game.input.muted;
        departure.released ||= !__game.glider.held;
      }
      if (sound.stillDepartureScore?.source && departure.score === null) {
        departure.score = sound.ctx.currentTime;
        departure.premature = __game.story.current.beat !== 'toBoat';
      }
    };
  });
  await page.locator('#sound').evaluate(button => button.click());
  await page.locator('#begin').click();
  await page.waitForFunction(() => window.departure.score !== null, null, { timeout: 180000 });
  const started = await page.evaluate(() => {
    window.departureSource = __game.sound.stillDepartureScore.source;
    return { ...departure, loop: departureSource.loop, duration: departureSource.buffer.duration, offset: sourceOffsets.get(departureSource),
      motifs: !!__game.sound.stillPhrases, beat: __game.story.current.beat };
  });
  assert(!started.premature && started.launches === 0 && !started.muted && !started.released);
  assert(!started.loop && !started.motifs && started.duration > 174 && started.duration < 175);
  assert.equal(started.offset, 8, 'The native source starts at the second phrase, eight seconds into the original');
  assert.equal(requests.filter(url =>  /\/still_2(?:-[\w-]+)?\.ogg(?:\?|$)/.test(url)).length, 1);
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(280, 490);
    await page.mouse.move(980, 510, { steps: 8 });
    await page.waitForTimeout(100);
  }
  const wind = await page.evaluate(() => ({ gust: __game.input.gust, muted: __game.input.muted, held: __game.glider.held }));
  assert(wind.gust > 0 && !wind.muted && wind.held, 'real pointer wind remains available with the plane secured');
  await page.screenshot({ path: '/tmp/updraft-secured-plane.png' });
  await page.waitForFunction(() => __game.story.name === 'toLines', null, { timeout: 60000 });
  assert(await page.evaluate(() => departure.launches === 0 && !departure.muted && !departure.released));
  const titleAt = async time => {
    await page.evaluate(time => { __game.story.current.time = time; }, time);
    await page.waitForTimeout(80);
    return page.locator('#journey-title').evaluate(node => ({ opacity: Number(getComputedStyle(node).opacity),
      text: node.textContent, pointerEvents: getComputedStyle(node).pointerEvents }));
  };
  assert.equal((await titleAt(20)).opacity, 0);
  assert.equal((await titleAt(33.5)).opacity, 0);
  const rising = await titleAt(35.5);
  assert(rising.opacity > .2 && rising.opacity < .8);
  const full = await titleAt(37.5);
  assert.equal(full.opacity, 1); assert.equal(full.text, 'updraft'); assert.equal(full.pointerEvents, 'none');
  assert.equal((await titleAt(39)).opacity, 1, 'title keeps its extended hold');
  const fading = await titleAt(41.5);
  assert(fading.opacity > 0 && fading.opacity < .5);
  assert(await page.evaluate(() => !__game.story.current.whaleCalled));
  await page.evaluate(() => { __game.story.current.time = 44.8; });
  await page.waitForFunction(() => __game.story.current.whaleCalled, null, { timeout: 10000 });
  assert.equal((await titleAt(45.5)).opacity, 0);
  assert(await page.evaluate(() => __game.sound.stillDepartureScore.source === departureSource && !__game.sound.stillPhrases));
  await page.evaluate(() => __game.story.begin('lines'));
  await page.waitForFunction(() => __game.sound.linesScore?.source && !__game.sound.stillDepartureScore, null, { timeout: 15000 });
  assert.equal((await page.locator('#journey-title').evaluate(node => Number(node.style.opacity))), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...started, titleBeforeWhale: true, sourceContinues: true, linesHandoff: true, requests }, null, 2));
} finally { await close(); }

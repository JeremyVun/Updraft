// In the real game with no input (GPU, shared lock): `?chapter=sea` starts `sea.ogg` from its top, its 55th second
// falls as the boat comes to rest beside the whale and phrase A starts there; `?chapter=whale` plays A on load.
// About 75 s. Vite on 5230, or BASE. The recording's own rules are `sea-music-check.mjs`.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser({ allowAutoplay: false });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.resourceType() === 'fetch' && /\.ogg(?:\?|$)/.test(request.url())) requests.push(new URL(request.url()).pathname);
  });
  const watch = () => page.evaluate(() => {
    window.seaWatch = { rest: null, a: null, intro: null, phrases: [] };
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      const sound = __game.sound;
      if (sound.seaMusic && this.buffer?.duration > 236) {
        const clip = { when, offset, ctx: sound.ctx.currentTime, story: __game.story.current.seaMusicTime };
        if (offset < 54.5) seaWatch.intro ??= clip;
        seaWatch.phrases.push(clip);
      }
      return native.call(this, when, offset, duration);
    };
    const sound = __game.sound, update = sound.update.bind(sound);
    sound.update = (...args) => {
      update(...args);
      const story = __game.story.current;
      if (seaWatch.rest === null && story.seaPhrase === 0) {
        const intro = seaWatch.intro;
        seaWatch.rest = { story: story.seaMusicTime, ctx: sound.ctx.currentTime,
          recording: intro ? intro.offset + sound.ctx.currentTime - intro.when : null };
      }
    };
  });
  const begin = async query => {
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&start=1&progress=0&${query}&ratio=1&msaa=2`);
    await page.waitForSelector('#veil.ready', { timeout: 60000 });
    await watch();
    await page.locator('#sound').evaluate(button => button.click());
    await page.locator('#begin').click();
  };
  await begin('chapter=sea');
  await page.waitForFunction(() => seaWatch.rest && seaWatch.phrases.length >= 2, null, { timeout: 180000 });
  const sea = await page.evaluate(() => {
    const a = seaWatch.phrases.at(-1);
    return { rest: seaWatch.rest, intro: seaWatch.intro, a: { ...a, afterRest: Math.max(a.when, a.ctx) - seaWatch.rest.ctx } };
  });
  console.log(JSON.stringify({ sea, requests }, null, 2));
  assert(requests.filter(url => /\/sea(?:-[\w-]+)?\.ogg$/.test(url)).length === 1
    && requests.every(url => /\/(sea|mirror)(?:-[\w-]+)?\.ogg$/.test(url)), 'the sea downloads once, reused from startup, with only the Mirror next');
  assert(sea.intro && sea.intro.offset === 0, 'the passage starts the recording from its beginning');
  assert(Math.abs(sea.rest.story - 55) <= .6, `the story clock puts recording second ${sea.rest.story.toFixed(2)} at rest`);
  assert(sea.rest.recording >= 54.4 && sea.rest.recording <= 57, `the recording is at ${sea.rest.recording?.toFixed(2)} s at rest`);
  assert(sea.a.offset === 56.43 && sea.a.afterRest >= -.05 && sea.a.afterRest <= .5, `phrase A starts ${sea.a.afterRest.toFixed(2)} s after rest`);
  await begin('chapter=whale');
  await page.waitForFunction(() => seaWatch.phrases.length >= 1, null, { timeout: 60000 });
  const whale = await page.evaluate(() => ({ first: seaWatch.phrases[0], count: seaWatch.phrases.length,
    ctx: __game.sound.ctx.currentTime, phrase: __game.story.current.seaPhrase }));
  assert(whale.first.offset === 56.43 && whale.count === 1, 'starting at rest beside the whale plays A on load');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ whale }, null, 2));
} finally { await close(); }

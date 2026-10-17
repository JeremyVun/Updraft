// In the real game (GPU, shared lock): `sea`, with no input, `?chapter=sea` starts `sea.ogg` from its top, its 55th
// second falls as the boat comes to rest beside the whale and nothing follows it until the net first lifts; `whale`,
// `?chapter=whale` is silent until then; `rescue` plays the rescue promptly with real gestures and reports the
// sections as they play, the bed entering as the net lifts and how long the release waits after the cygnet starts to
// pull. About 9 minutes in all.
// Usage: node tools/sea-music-browser-check.mjs [sea whale rescue]. Vite on 5230, or BASE. The recording's own rules
// are `sea-music-check.mjs`.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
import { away, circle, gameWait, sweepCork, sweepEye, sweepFin, sweepHead } from './lib/whale-gestures.mjs';

const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['sea', 'whale', 'rescue'];

const { browser, close } = await openBrowser({ allowAutoplay: false });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.resourceType() === 'fetch' && /\.ogg(?:\?|$)/.test(request.url())) requests.push(new URL(request.url()).pathname);
  });
  const watch = () => page.evaluate(() => {
    window.seaWatch = { rest: null, intro: null, phrases: [], cues: [], cued: null };
    const native = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      const sound = __game.sound;
      if (sound.seaMusic && this.buffer?.duration > 236) {
        const clip = { when, offset, duration, ctx: sound.ctx.currentTime, story: __game.story.current.time };
        if (offset < 54.5) seaWatch.intro ??= clip;
        seaWatch.phrases.push(clip);
      }
      return native.call(this, when, offset, duration);
    };
    const sound = __game.sound, update = sound.update.bind(sound);
    sound.update = (...args) => {
      update(...args);
      const story = __game.story.current, w = story.whale;
      if (story.seaRescue !== seaWatch.cued) {
        seaWatch.cued = story.seaRescue;
        seaWatch.cues.push({ rescue: story.seaRescue, ctx: sound.ctx.currentTime, story: story.time,
          act: w && { step: w.step, lift: __game.sealife.net.lift, progress: w.progress, fold: w.fold, foldT: w.foldT, haul: w.haul, heaves: w.heaves, bird: w.bird } });
      }
      if (seaWatch.rest === null && story.whale?.step === 'breath') {
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
  const sea = async () => {
    await begin('chapter=sea');
    await page.waitForFunction(() => seaWatch.rest && __game.sound.ctx.currentTime > seaWatch.rest.ctx + 6, null, { timeout: 180000 });
    const sea = await page.evaluate(() => ({ rest: seaWatch.rest, intro: seaWatch.intro, phrases: seaWatch.phrases }));
    console.log(JSON.stringify({ sea, requests }, null, 2));
    assert(requests.filter(url => /\/sea(?:-[\w-]+)?\.ogg$/.test(url)).length === 1
      && requests.every(url => /\/(sea|mirror)(?:-[\w-]+)?\.ogg$/.test(url)), 'the sea downloads once, reused from startup, with only the Mirror next');
    assert(sea.intro && sea.intro.offset === 0, 'the passage starts the recording from its beginning');
    assert(Math.abs(sea.rest.story - 55) <= .6, `the story clock puts recording second ${sea.rest.story.toFixed(2)} at rest`);
    assert(sea.rest.recording >= 54.4 && sea.rest.recording <= 57, `the recording is at ${sea.rest.recording?.toFixed(2)} s at rest`);
    assert(sea.phrases.length === 1, 'nothing plays after the crossing while the boat rests and nobody plays');
  };
  const whale = async () => {
    await begin('chapter=whale');
    await page.waitForFunction(() => __game.story.current.whale?.step === 'breath' && __game.sound.seaMusic, null, { timeout: 60000 });
    await page.waitForTimeout(4000);
    const whale = await page.evaluate(() => ({ phrases: seaWatch.phrases.map(c => c.offset), rescue: __game.story.current.seaRescue }));
    console.log(JSON.stringify({ whale }, null, 2));
    assert(whale.phrases.length === 0 && whale.rescue === 'coming', 'starting at rest beside the whale stays silent until the net lifts');
  };
  const rescue = async () => {
    await begin('chapter=whale');
    const now = () => page.evaluate(() => {
      const w = __game.story.current.whale;
      return { step: w.step, stepTime: w.stepTime, progress: w.progress, foldT: w.foldT, offered: !!w.offered, haul: w.haul,
        heaves: w.heaves, bird: w.bird, birdT: w.birdT, slipT: w.slipT };
    });
    const until = async (test, what, seconds = 120) => {
      const end = Date.now() + seconds * 1000;
      for (;;) {
        const s = await now();
        if (test(s)) return s;
        if (Date.now() > end) throw Error(`timed out waiting for ${what}: ${JSON.stringify(s)}`);
        await page.waitForTimeout(200);
      }
    };
    const strokes = async (sweep, done, most, what) => {
      for (let n = 0; n < most; n++) { if (done(await now())) return; await sweep(page); }
      if (!done(await now())) throw Error(`${most} strokes never ${what}`);
    };
    await until(s => s.step === 'breath' && s.stepTime > 1.2, 'the boat at rest');
    await away(page);
    await circle(page, async () => (await now()).progress >= 1);
    await away(page);
    await until(s => s.step === 'eye' && s.offered, 'the eye asked');
    await strokes(sweepEye, s => s.foldT >= 0, 4, 'flipped the fold');
    await until(s => s.step === 'line' && s.offered, 'the cork asked');
    await strokes(p => sweepCork(p, 1), s => s.haul !== 'out', 4, 'brought the cork');
    await until(s => s.step === 'heave' && s.offered, 'the heave asked');
    await strokes(sweepHead, s => s.step !== 'heave' || s.heaves >= 4 || s.haul === 'letting', 12, 'heaved the net off');
    await until(s => s.step === 'flipper' && s.bird === 'holding' && s.offered, 'the cygnet holding the end');
    await strokes(sweepFin, s => s.slipT >= 0, 4, 'lifted the flipper');
    await until(s => s.step === 'free', 'the release', 90);
    await page.waitForFunction(() => seaWatch.phrases.some(c => c.offset > 150), null, { timeout: 60000 });
    await gameWait(page, 2);
    const { cues, phrases } = await page.evaluate(() => seaWatch);
    const pull = cues.find(c => c.rescue === 'freeing'), release = phrases.find(c => c.offset > 150);
    const report = { sections: phrases.map(c => ({ offset: c.offset, at: +c.story.toFixed(1) })), pull: +pull.story.toFixed(1),
      wait: +(release.when - pull.ctx).toFixed(2), act: pull.act };
    console.log(JSON.stringify({ rescue: report }, null, 2));
    assert.deepEqual(cues.map(c => c.rescue).filter(r => r !== 'coming'), ['rescue', 'freeing'], 'the rest, then the cygnet\'s pull');
    const stir = cues.find(c => c.rescue === 'rescue');
    assert(stir.act.step === 'breath' && stir.act.progress < 1 && stir.act.lift >= .05, 'the bed enters as the net first lifts');
    assert(phrases[0].offset === 56.43 && phrases[0].when - stir.ctx < .1, 'the bed begins at once, from the bass entering');
    assert(pull.act.step === 'flipper' && pull.act.bird === 'pulling', 'freeing as the cygnet starts to pull');
    assert(phrases.slice(1).every((c, i) => Math.abs(c.when - (phrases[i].when + phrases[i].duration)) < 1e-3),
      'each section begins as the last ends');
    assert(release.offset === 159.47 && release.when >= pull.ctx && release.when - pull.ctx < 7.6,
      'the release follows the phrase the pull began in');
  };
  const run = { sea, whale, rescue };
  for (const name of cases) await run[name]();
  assert.deepEqual(errors, []);
} finally { await close(); }

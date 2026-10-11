// Replay the fall and bandaging: turning the camera must not activate the reserve petals.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=tree&progress=0&ratio=1&msaa=0`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  await page.evaluate(() => {
    const { petals, renderer, carry } = __game;
    const count = data => {
      let living = 0;
      for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i]) < 1e5) living++;
      return living;
    };
    const active = () => {
      const { width, height } = petals.pos.read;
      const data = new Float32Array(width * height * 4);
      renderer.readRenderTargetPixels(petals.pos.read, 0, 0, width, height, data);
      return count(data);
    };
    window.petalCheck = {
      initial: active(), homes: [], bandaging: false, final: null,
      expected: Math.round(petals.mesh.geometry.instanceCount * __game.tuning.petals.stillIslandShare),
    };
    const rehome = petals.rehome.bind(petals);
    petals.rehome = (...args) => {
      rehome(...args);
      petalCheck.homes.push({ living: count(petals.home.image.data), moment: carry.playing });
    };
    const update = petals.update.bind(petals);
    petals.update = (...args) => {
      update(...args);
      if (carry.playing.endsWith(':bandage')) petalCheck.bandaging = true;
      if (__game.story.current.beat === 'leaving' && petalCheck.final === null) petalCheck.final = active();
    };
  });
  await page.waitForFunction(() => typeof window.petalCheck?.final === 'number', null, { timeout: 180000 });
  const result = await page.evaluate(() => window.petalCheck);
  console.log(JSON.stringify(result, null, 2));
  assert(result.bandaging, 'The replay must reach the actual bandaging action');
  assert(result.homes.length > 0, 'The camera must move far enough to rehome the petals');
  assert.equal(result.initial, result.expected, 'The island starts with its sparse petal population');
  for (const home of result.homes) {
    assert.equal(home.living, result.expected, `Camera movement must preserve island density during ${home.moment}`);
  }
  assert.equal(result.final, result.expected, 'No reserve petals may materialize during the rescue');
  assert.deepEqual(errors, []);
} finally { await close(); }

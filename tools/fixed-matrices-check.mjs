// Every object fixed in place (src/gl/fixed.ts) keeps the transform it was fixed with, and its world matrix is
// the one a full update would compute. Checked after every scene render while each chapter plays.
// node tools/fixed-matrices-check.mjs [chapter ...]   BASE (dev server or QA preview), FRAMES per chapter (600).
// No browser lock: shot mode steps a fixed 1/60 s a frame, so other GPU work slows the check without changing it.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5230/';
const FRAMES = Number(process.env.FRAMES ?? 600);
const chapters = process.argv.slice(2).length ? process.argv.slice(2)
  : ['island', 'lines', 'boats', 'meadow', 'piano', 'birches', 'stairs', 'drowned', 'wood', 'sleeping', 'sea', 'mirror', 'jetty', 'summit', 'stage'];
const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const failures = [];
try {
  for (const chapter of chapters) {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await withoutHotReload(page);
    await page.goto(`${BASE}?shot&ratio=0.5&analytics=0&progress=0${chapter === 'island' ? '' : '&chapter=' + chapter}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
    const result = await page.evaluate(async (frames) => {
      const { scene, renderer } = __game;
      const M = scene.matrixWorld.constructor;
      const composed = new M(), expected = new M();
      const same = (a, b) => a.elements.every((v, i) => Object.is(v, b.elements[i]));
      const fixed = [];
      scene.traverse(o => { if (o.userData.fixed) fixed.push(o); });
      const name = o => { const path = []; for (let p = o; p && p !== scene; p = p.parent) path.unshift(p.name || p.type); return path.join('/'); };
      const bad = new Map();
      let checks = 0;
      const check = () => {
        checks++;
        for (const o of fixed) {
          if (o.matrixAutoUpdate) bad.set(name(o), 'auto again');
          if (!same(composed.compose(o.position, o.quaternion, o.scale), o.matrix)) bad.set(name(o), 'moved');
          if (o.parent) {
            if (!same(expected.multiplyMatrices(o.parent.matrixWorld, o.matrix), o.matrixWorld)) bad.set(name(o), 'stale world');
          } else if (!same(o.matrix, o.matrixWorld)) bad.set(name(o), 'stale world');
        }
      };
      const render = renderer.render;
      renderer.render = function (s, camera) { render.call(this, s, camera); if (s === scene) check(); };
      const start = __stats.frame;
      while (__stats.frame < start + frames) await new Promise(r => setTimeout(r, 100));
      renderer.render = render;
      return { fixed: fixed.length, total: (() => { let n = 0; scene.traverse(() => n++); return n; })(), checks, bad: [...bad] };
    }, FRAMES);
    console.log(JSON.stringify({ chapter, ...result, errors }));
    if (result.bad.length || errors.length) failures.push(chapter);
    assert(result.fixed > 0 && result.checks > 0, `${chapter}: nothing checked`);
    await page.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(failures, [], 'Fixed objects moved or went stale');
console.log(`Fixed matrices hold in ${chapters.length} chapters.`);

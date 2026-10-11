import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5247/'}?shot&chapter=crossing&progress=0&ratio=1&msaa=2`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.evaluate(() => { __game.params.shot = false; });
  const results = [];
  for (const time of [32, 34, 36, 45.1, 46, 47, 49, 56, 61, 62, 63, 64, 65]) {
    await page.waitForFunction(t => __game.story.current.time >= t, time, { timeout: 90000 });
    const s = await page.evaluate(() => {
      const g = __game, f = g.story.current.gustFront;
      let direction = null;
      if (f) {
        const a = f.at.clone().project(g.rig.camera);
        const b = f.at.clone(); b.x += f.dir.x * 5; b.z += f.dir.y * 5; b.project(g.rig.camera);
        direction = [b.x - a.x, b.y - a.y];
      }
      return { time: g.story.current.time, whale: g.sealife.body.time,
        presence: g.sealife.body.mesh.material.uniforms.uPresence.value,
        visible: g.sealife.body.mesh.visible, direction,
        lines: g.lines.lines.filter(l => l.drive).length };
    });
    results.push(s); console.log(JSON.stringify(s));
    if (time < 40) {
      assert(s.direction?.[0] > 0 && Math.abs(s.direction[1]) < s.direction[0] * .3, 'gust moves horizontally left to right');
      assert(s.lines <= 6, 'only a few authored windlines');
    }
    if ([34, 36, 46, 49, 56, 62, 64].includes(time)) await page.screenshot({ path: `/tmp/updraft-atmosphere-${time}.png` });
  }
  assert(results.some(s => s.lines > 0), 'title shot contains windlines');
  const fadeIn = results.filter(s => s.time >= 45 && s.time < 50);
  for (let i = 1; i < fadeIn.length; i++) assert(fadeIn[i].presence > fadeIn[i - 1].presence, 'appearance eases in');
  const fadeOut = results.filter(s => s.time >= 61);
  for (let i = 1; i < fadeOut.length; i++) assert(fadeOut[i].presence < fadeOut[i - 1].presence, 'underwater silhouette eases away');
  assert.equal(results.at(-1).presence, 0);
  assert.deepEqual(errors, []);
} finally { await close(); }

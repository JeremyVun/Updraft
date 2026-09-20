// Exercise actual chapter constructors at arranged transition boundaries in the real renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
const report = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '?shot=1&chapter=sea&ratio=1&progress=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  for (const [name, x, z, yaw] of [['toSleeping', -132, -1916, -Math.PI / 2], ['toHarbour', -45.3, -1926.25, Math.PI / 2]]) {
    const result = await page.evaluate(({ name, x, z, yaw }) => {
      const g = __game;
      g.story.sail(x, z, yaw); g.story.begin(name); g.story.update(0, __stats.time);
      // Arrange the old chapter's completion; all transition/constructor/view code is production code.
      Object.defineProperty(g.story.current, 'done', { configurable: true, get: () => true });
      const oldShot = g.story.shot, oldFocus = g.story.focus.clone();
      g.rig.cut(oldShot); const eye = g.rig.camera.position.clone();
      g.story.update(1 / 60, __stats.time);
      const retained = g.story.shot === oldShot && g.story.focus.equals(oldFocus);
      const chapter = g.story.name;
      g.rig.update(1 / 60, 0, g.story.shot, g.story.pace);
      const transitionStep = eye.distanceTo(g.rig.camera.position);
      g.story.update(1 / 60, __stats.time + 1 / 60);
      return { from: name, chapter, retained, transitionStep,
        prepared: g.story.shot === g.story.current.shot,
        targetDistance: g.story.shot.target.distanceTo(g.child.position) };
    }, { name, x, z, yaw });
    assert(result.retained, 'first frame must keep the previous prepared camera and habitat focus');
    assert(result.transitionStep < .1, JSON.stringify(result));
    assert(result.prepared && result.targetDistance < 100, 'the next update must supply the new room view');
    report.push(result);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `/tmp/updraft-chapter-view-${result.chapter}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.writeFileSync('/tmp/updraft-chapter-view.json', JSON.stringify({ report, errors }, null, 2));
  await close();
}

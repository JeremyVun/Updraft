// Verify real crossing-to-island handoffs and both rooms' boat visibility in Chrome.
// node tools/landing-check.mjs; BASE overrides the dev server, captures go to /tmp.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const lock = '/tmp/updraft-chromium.lock';
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let holder = 0;
    try { holder = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    let alive = true;
    if (holder) { try { process.kill(holder, 0); } catch { alive = false; } }
    if (holder && !alive) fs.rmSync(lock, { recursive: true, force: true });
    else await new Promise(resolve => setTimeout(resolve, 400));
  }
}
let browser;
const report = [], errors = [];
try {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  for (const [crossing, island] of [['toLines', 'lines'], ['toMeadow', 'meadow'], ['toBirches', 'birches']]) {
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=washing`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await page.evaluate(async ({ crossing, island }) => {
      const { ROUTES } = await import('/src/story/journey.ts');
      const g = __game, route = ROUTES[crossing], target = route.at(-1);
      g.story.sail(target.x, target.y + 16, Math.PI);
      g.story.begin(crossing);
      g.story.current.restoreCheckpoint('entry', [route.length - 1, 0]);
      g.story.current.update(0); g.rig.cut(g.story.shot);
      window.__landing = { frames: 0, missing: 0, mirrorFrames: 0, mirrorMissing: 0 };
      const make = g.story.make.bind(g.story);
      g.story.make = name => {
        const before = g.boat.position.toArray();
        const chapter = make(name);
        if (name === island) Object.assign(window.__landing, { before, after: g.boat.position.toArray() });
        return chapter;
      };
      const render = g.renderer.render.bind(g.renderer);
      g.renderer.render = (scene, camera) => {
        if (scene === g.scene && g.story.name === island) {
          const c = window.__landing;
          if (camera === g.rig.camera) { c.frames++; if (!g.boat.group.visible) c.missing++; }
          else if (camera.layers.mask === 2) { c.mirrorFrames++; if (!g.boat.group.visible) c.mirrorMissing++; }
        }
        render(scene, camera);
      };
    }, { crossing, island });
    await page.waitForFunction(island => __game.story.name === island, island, { timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `/tmp/updraft-landing-${island}.png` });
    const result = await page.evaluate(() => ({ ...window.__landing, position: __game.boat.position.toArray() }));
    assert.deepEqual(result.after, result.before, `${island}: boat teleported during landing`);
    assert.equal(result.position[0], result.before[0], `${island}: boat drifted away`);
    assert.equal(result.position[2], result.before[2], `${island}: boat drifted away`);
    assert(result.frames > 0, `${island}: exercise the main scene`);
    // Later islands can skip the sea reflection when it is outside the engine's coastal range.
    if (island === 'lines') assert(result.mirrorFrames > 0, 'exercise the washing room reflection');
    assert.equal(result.missing + result.mirrorMissing, 0, `${island}: arrival renderer hid boat`);
    report.push({ island, ...result });

    // Stage the inland beat: the boat must be ready before the far shore is revealed.
    const departure = await page.evaluate(async island => {
      const g = __game, c = g.story.current;
      g.child.stop();
      let berth;
      if (island === 'lines') {
        ({ LINES_BERTH: berth } = await import('/src/story/lines.ts'));
        c.to('family');
      } else {
        if (island === 'meadow') {
          const m = await import('/src/story/meadow.ts'); berth = m.FAR_SHORE;
          c.leg = 3; g.child.place(m.ROUTE[3].x, m.ROUTE[3].y, Math.PI);
        } else {
          const m = await import('/src/world/birches.ts'); berth = m.BIRCHES_BERTH;
          c.leg = 2; g.child.place(m.BIRCHES_CLEARING.x, m.BIRCHES_CLEARING.y, Math.PI);
        }
        c.update(0, c.now);
      }
      return { expected: [berth.x, berth.z], actual: [g.boat.position.x, g.boat.position.z] };
    }, island);
    assert.deepEqual(departure.actual, departure.expected, `${island}: missing departure boat`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report, null, 2));
  console.log('Landing continuity, rendered boat visibility and departure placement passed.');
} finally {
  await browser?.close();
  fs.rmSync(lock, { recursive: true, force: true });
}

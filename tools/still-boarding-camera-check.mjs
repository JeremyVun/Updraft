import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const out = process.env.OUT ?? fs.mkdtempSync('/tmp/updraft-boarding-camera-');
fs.mkdirSync(out, { recursive: true });
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=tree&progress=0&ratio=1&msaa=2`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.evaluate(() => {
    window.boardingTrace = [];
    const rig = __game.rig, update = rig.update.bind(rig);
    rig.update = (...args) => {
      update(...args);
      const g = __game, c = g.story.current, cam = rig.camera;
      if (!['kneel', 'gather', 'leaving', 'toBoat', 'push', 'aboard'].includes(c.beat)) return;
      cam.updateMatrixWorld();
      const head = g.child.position.clone(); head.y += 1.9;
      const feet = g.child.position.clone(); feet.y += .1;
      boardingTrace.push({ time: args[1], beat: c.beat, age: c.now - c.beatStart,
        eye: cam.position.toArray(), direction: cam.getWorldDirection(head.clone()).toArray(),
        child: g.child.position.toArray(), head: head.project(cam).toArray(), feet: feet.project(cam).toArray(),
        target: c.shot.target.toArray(), distance: c.shot.distance, height: c.shot.height,
        from: c.shot.from?.toArray() });
    };
  });
  for (const [beat, age] of [['kneel', 7], ['leaving', .5], ['toBoat', .1], ['toBoat', 2], ['toBoat', 5], ['toBoat', 8], ['push', .5]]) {
    await page.waitForFunction(([b, a]) => __game.story.current.beat === b && __game.story.current.now - __game.story.current.beatStart >= a,
      [beat, age], { timeout: 90000 });
    await page.screenshot({ path: `${out}/${beat}-${age}.png` });
  }
  await page.waitForFunction(() => __game.story.name === 'toLines', null, { timeout: 90000 });
  await page.screenshot({ path: `${out}/crossing.png` });
  const trace = await page.evaluate(() => boardingTrace);
  fs.writeFileSync(`${out}/trace.json`, JSON.stringify({ errors, trace }));
  console.log(JSON.stringify({ out, errors, samples: trace.length, worstHead: Math.max(...trace.map(s => Math.max(Math.abs(s.head[0]), Math.abs(s.head[1])))) }));
} finally { await close(); }

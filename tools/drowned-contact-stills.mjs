// Close views of the actual village surfaces and character rigs, one stride at a time.
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const folder = process.argv[2] ?? '/tmp/updraft-contact-stills';
fs.mkdirSync(folder, { recursive: true });
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    const next = requestAnimationFrame.bind(window);
    window.__nativeRAF = next;
    window.requestAnimationFrame = callback => next(t => { if (!window.__freeze) callback(t); });
  });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=roofs&ratio=1`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.evaluate(() => { window.__freeze = true; });
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.requestAnimationFrame = __nativeRAF; });
  await page.evaluate(async () => {
    const W = await import('/src/world/drowned-way.ts');
    const { child, cat, rig, post } = __game;
    const v = child.position.clone(), side = v.clone();
    window.__contact = {
      setup(kind) {
        this.kind = kind;
        if (kind === 'boots') {
          cat.visible = false; cat.update(0);
          const d = W.WAY.laneWall;
          child.decks = [d]; child.dismount(); child.sitting = false;
          child.place(d.x0 * .7 + d.x1 * .3, d.z0 * .7 + d.z1 * .3, Math.atan2(d.x1 - d.x0, d.z1 - d.z0));
          for (let i = 0; i < 120; i++) child.update(1 / 60);
          child.walkTo(d.x1, d.z1);
          for (let i = 0; i < 60; i++) child.update(1 / 60);
        } else {
          cat.visible = true;
          const yaw = Math.atan2(W.CAT_EDGE.x - W.CAT_LANDING.x, W.CAT_EDGE.z - W.CAT_LANDING.z);
          cat.place(W.CAT_LANDING, yaw, { pose: 'stand', floor: W.catRoof });
          cat.run([W.CAT_EDGE], W.catRoof, { pace: 'run', speed: 1.6, then: 'sit' });
        }
        this.step(0);
      },
      step(frames) {
        for (let i = 0; i < frames; i++) this.kind === 'boots' ? child.update(1 / 60) : cat.update(1 / 60);
        const who = this.kind === 'boots' ? child : cat;
        const yaw = this.kind === 'boots' ? child.yaw : cat.heading;
        side.set(Math.cos(yaw), 0, -Math.sin(yaw));
        v.copy(who.position).y += this.kind === 'boots' ? .35 : .3;
        rig.camera.position.copy(v).addScaledVector(side, this.kind === 'boots' ? 2.6 : 2.4);
        rig.camera.position.y += .65;
        rig.camera.lookAt(v); rig.camera.updateMatrixWorld(true);
        post.render(__stats.time);
      },
    };
  });
  for (const kind of ['boots', 'cat']) {
    await page.evaluate(kind => __contact.setup(kind), kind);
    for (let i = 0; i < 24; i++) {
      await page.evaluate(() => __contact.step(10));
      await page.screenshot({ path: `${folder}/${kind}-${String(i).padStart(2, '0')}.png` });
    }
  }
  console.log(folder);
} finally { await close(); }

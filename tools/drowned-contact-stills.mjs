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
    const { tuning } = await import('/src/tuning.ts');
    const { child, cat, rig, post } = __game;
    const v = child.position.clone(), side = v.clone();
    window.__contact = {
      setup(kind) {
        this.kind = kind;
        if (kind.startsWith('mill')) {
          W.WAY.millSlope.followSurface = W.WAY.millRidge.followSurface = kind === 'mill-after';
          cat.visible = false; cat.update(0);
          const route = ['millWall', 'millWallUp', 'millWallOn', 'millSlope', 'millRidge'].map(n => W.WAY[n]);
          child.decks = Object.values(W.WAY); child.dismount(); child.sitting = false;
          child.stroll = tuning.drowned.run.stroll;
          child.place(route[0].x0, route[0].z0, Math.atan2(route[0].x1 - route[0].x0, route[0].z1 - route[0].z0));
          for (let i = 0; i < 120; i++) child.update(1 / 60);
          child.gait = 0;
          let next = 0;
          const go = () => { const d = route[next++]; if (d) child.walkTo(d.x1, d.z1, false, go, 0.12); };
          go();
          for (let i = 0; i < 1800 && child.position.x < W.WAY.millRidge.x0 - 0.45; i++) child.update(1 / 60);
        } else if (kind === 'boots') {
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
        const boots = this.kind !== 'cat';
        for (let i = 0; i < frames; i++) boots ? child.update(1 / 60) : cat.update(1 / 60);
        const who = boots ? child : cat;
        const yaw = boots ? child.yaw : cat.heading;
        side.set(Math.cos(yaw), 0, -Math.sin(yaw));
        v.copy(who.position).y += boots ? .35 : .3;
        rig.camera.position.copy(v).addScaledVector(side, boots ? 2.6 : 2.4);
        rig.camera.position.y += .65;
        if (this.kind.startsWith('mill')) {
          v.set(W.WAY.millRidge.x0, 2, W.WAY.millRidge.z0);
          rig.camera.position.copy(v).add(side.set(-3.2, 0.8, -2));
          rig.camera.fov = 75; rig.camera.updateProjectionMatrix();
        }
        rig.camera.lookAt(v); rig.camera.updateMatrixWorld(true);
        post.render(__stats.time);
      },
    };
  });
  for (const kind of process.env.CASE === 'mill' ? ['mill-before', 'mill-after'] : ['boots', 'cat']) {
    await page.evaluate(kind => __contact.setup(kind), kind);
    for (let i = 0; i < (process.env.CASE === 'mill' ? 48 : 24); i++) {
      await page.evaluate(frames => __contact.step(frames), process.env.CASE === 'mill' ? 2 : 10);
      await page.screenshot({ path: `${folder}/${kind}-${String(i).padStart(2, '0')}.png` });
    }
  }
  console.log(folder);
} finally { await close(); }

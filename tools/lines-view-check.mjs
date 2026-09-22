// Real sweeps through all three curtains; fixed grass heights and clear challenge views in both aspects.
// BASE overrides Vite. Evidence goes to /tmp/updraft-lines-view-<width>-*.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
const report = [];
let currentPage;
let currentPrefix;
try {
  for (const [width, height] of [[1440, 900], [390, 844]].filter(([w]) => !process.env.W || w === Number(process.env.W))) {
    const prefix = `/tmp/updraft-lines-view-${width}`;
    const page = await browser.newPage({ viewport: { width, height } });
    currentPage = page; currentPrefix = prefix;
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push({ text: m.text(), url: m.location().url }); });
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=washing&progress=0&ratio=1&msaa=2`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await page.evaluate(async () => {
      const { grassHeightAt } = await import('/src/world/grass.ts');
      const points = __game.curtains.flatMap(g => [-3, 0, 3].map(dx => [g.center.x + dx, g.center.z]));
      const baseline = points.map(([x,z]) => grassHeightAt(x,z));
      window.linesGround = { frames: 0, maxChange: 0, transitions: [] };
      let last = '';
      const bake = __game.grass.bake.bind(__game.grass);
      __game.grass.bake = (...args) => {
        const check = window.linesGround;
        check.frames++;
        points.forEach(([x,z], i) => { check.maxChange = Math.max(check.maxChange, Math.abs(grassHeightAt(x,z) - baseline[i])); });
        const beat = `${__game.story.current.gate}:${__game.story.current.beat}`;
        if (beat !== last) { check.transitions.push(beat); last = beat; }
        bake(...args);
      };
    });
    for (let gate = 0; gate < 3; gate++) {
      await page.waitForFunction(i => __game.story.current.gate === i && __game.story.current.beat === 'curtain', gate, { timeout: 120000 });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${prefix}-${gate + 1}-waiting.png` });
      const sight = await page.evaluate(async () => {
        const source = await (await fetch('/src/world/atmosphere.ts')).text();
        const THREE = await import(source.match(/from ["']([^"']*three[^"']*)["']/)[1]);
        const g = __game, curtain = g.curtains[g.story.current.gate], eye = g.rig.camera.position;
        const targets = [g.child.position.clone().add(new THREE.Vector3(0, 1.4, 0)), curtain.center];
        return targets.map(target => {
          const ray = new THREE.Raycaster(eye, target.clone().sub(eye).normalize(), .5, eye.distanceTo(target) - .5);
          return ray.intersectObjects(g.washing.group.children.slice(0, 2)).map(hit => hit.distance);
        });
      });
      assert(sight.every(hits => hits.length === 0), `${width}, curtain ${gate + 1}: pole/rope blocks child or challenge: ${JSON.stringify(sight)}`);
      for (let stroke = 0; stroke < 10; stroke++) {
        const y = height * (.37 + stroke % 3 * .08), from = stroke % 2 ? .78 : .22, to = 1 - from;
        await page.mouse.move(from * width, y);
        for (let i = 1; i <= 36; i++) {
          await page.mouse.move((from + (to - from) * i / 36) * width, y);
          await page.waitForTimeout(16);
        }
        if (await page.evaluate(i => __game.curtains[i].cleared, gate)) break;
      }
      await page.waitForFunction(i => __game.curtains[i].cleared, gate, { timeout: 12000 });
      await page.screenshot({ path: `${prefix}-${gate + 1}-open.png` });
      await page.waitForFunction(i => __game.story.current.gate > i, gate, { timeout: 60000 });
      await page.screenshot({ path: `${prefix}-${gate + 1}-passed.png` });
      console.log(`${width}: swept and passed curtain ${gate + 1}`);
    }
    const ground = await page.evaluate(() => window.linesGround);
    assert(ground.frames > 100);
    assert(ground.maxChange < 1e-9, `Grass height changed by ${ground.maxChange}`);
    assert.deepEqual(errors, []);
    report.push({ width, height, ...ground, errors });
    fs.writeFileSync(`${prefix}-report.json`, JSON.stringify(report.at(-1), null, 2));
    await page.close();
  }
  console.log(JSON.stringify(report));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: `${currentPrefix}-failure.png` }).catch(() => {});
  throw error;
} finally { await close(); }

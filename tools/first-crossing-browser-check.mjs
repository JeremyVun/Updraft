import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 },
    ...(process.env.VIDEO ? { recordVideo: { dir: '/tmp/updraft-linen-film', size: { width: 1600, height: 900 } } } : {}) });
  const began = Date.now(); let filmFrom = 0, filmTo = 0;
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5247/'}?shot&chapter=crossing&progress=0&ratio=1&msaa=2`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.evaluate(() => { __game.params.shot = false; });
  const results = [];
  for (const time of [48, 52, 56, 59, 63, 75, 80, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 100, 104, 108, 114]) {
    await page.waitForFunction(t => __game.story.current.time >= t, time, { timeout: 90000 });
    const s = await page.evaluate(() => {
      const g = __game, u = g.terrain.mesh.material.uniforms, clear = u.uHorizonMist.value.x, hidden = u.uHorizonMist.value.y;
      const cover = d => { const t = Math.max(0, Math.min(1, (d - clear) / (hidden - clear))); return t * t * (3 - 2 * t); };
      const whale = [], body = g.sealife.body;
      for (const s of [.1, .3, .5, .7, 1]) {
        const p = g.boat.position.clone(); body.point(0, .6, s, p);
        if (p.y > 0) { const fog = cover(p.distanceTo(g.rig.camera.position));
          whale.push({ fog, screen: p.project(g.rig.camera).toArray() }); }
      }
      const echoes = g.crossingLinen, birds = echoes.birds.geometry.attributes.iPos.array;
      const birdScreens = [];
      for (let i = 0; i < echoes.birds.geometry.instanceCount; i++) birdScreens.push(g.boat.position.clone()
        .set(birds[i * 4], birds[i * 4 + 1], birds[i * 4 + 2]).project(g.rig.camera).toArray());
      const cloth = echoes.linen.map(l => {
        const c = l.cloth, p = g.boat.position.clone(), centre = p.set(0, 0, 0);
        for (let i = 0; i < c.count; i++) { centre.x += c.view[i * 3]; centre.y += c.view[i * 3 + 1]; centre.z += c.view[i * 3 + 2]; }
        centre.multiplyScalar(1 / c.count);
        return { visible: l.mesh.visible, finite: [...c.view].every(Number.isFinite), height: centre.y,
          normal: [...c.normal.slice(0, 3)], screen: centre.project(g.rig.camera).toArray() };
      });
      return { time: g.story.current.time, horizon: [clear, hidden], whale, birds: birdScreens, cloth,
        surge: g.water.mesh.material.uniforms.uSurge.value.toArray() };
    });
    results.push(s); console.log(JSON.stringify(s));
    if (time === 75) filmFrom = (Date.now() - began) / 1000;
    if (time === 104) filmTo = (Date.now() - began) / 1000;
    if (time <= 59) assert(s.whale.length && s.whale.every(p => p.fog < .03), 'whale stays clear through dive');
    if (time >= 63) assert(s.surge[3] > 0, 'dive leaves a physical wave');
    assert(s.cloth.every(c => c.finite), 'cloth solver remains finite');
    await page.screenshot({ path: `/tmp/updraft-first-crossing-${time}.png` });
  }
  const visible = p => Math.abs(p[0]) < .95 && Math.abs(p[1]) < .95 && p[2] > -1 && p[2] < 1;
  assert(results.some(s => s.birds.some(visible)), 'gulls pass through the sailing shot');
  for (let i = 0; i < 5; i++) assert(results.some(s => s.cloth[i].visible && visible(s.cloth[i].screen)),
    `linen piece ${i} is visible from the sailing camera`);
  assert(results.some(s => s.birds.filter(visible).length >= 4 && s.cloth.slice(1).filter(c => c.visible && visible(c.screen)).length >= 3),
    'flock and several loose sheets share the shot');
  assert(results.some(s => {
    const y = s.cloth.slice(1).filter(c => c.visible && visible(c.screen)).map(c => c.screen[1]);
    return y.length >= 3 && Math.max(...y) - Math.min(...y) > .25;
  }), 'sheets occupy distinct heights in the actual camera');
  const order = results.filter(s => s.cloth[1].visible && s.cloth[2].visible && visible(s.cloth[1].screen) && visible(s.cloth[2].screen))
    .map(s => s.cloth[1].screen[0] - s.cloth[2].screen[0]);
  assert(order.some(d => d < -.05) && order.some(d => d > .05), 'a faster sheet overtakes a slower one');
  const normals = results.filter(s => s.cloth[1].visible && visible(s.cloth[1].screen)).map(s => s.cloth[1].normal);
  assert(normals.some(a => normals.some(b => a.reduce((n, v, i) => n + v * b[i], 0) < .3)), 'the loose sheet turns substantially in the air');
  assert.deepEqual(errors, []);
  fs.writeFileSync('/tmp/updraft-first-crossing-visual.json', JSON.stringify(results, null, 2));
  if (process.env.VIDEO) {
    const video = page.video(); await page.close();
    fs.writeFileSync('/tmp/updraft-linen-film.json', JSON.stringify({ path: await video.path(), from: filmFrom, to: filmTo }));
  }
} finally { await close(); }

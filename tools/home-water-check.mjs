// Replay the final approach: loading chapter=jetty alone misses the reflection cutoff at disembark.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const output = process.argv[2] ?? fs.mkdtempSync('/tmp/updraft-home-water-');
fs.mkdirSync(output, { recursive: true });
const cases = [['high', 1440, 900], ['high', 390, 844], ['medium', 1440, 900], ['low', 1440, 900]]
  .filter(([quality, width]) => !process.env.CASE || process.env.CASE === `${quality}-${width}`);
const { browser, close } = await openBrowser();
const report = [];
try {
  for (const [quality, width, height] of cases) {
    const name = `${quality}-${width}`, errors = [];
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const raf = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(function tick(time) {
        if (window.__waterPaused) { raf(tick); return; }
        callback(time);
      });
    });
    await page.goto(`${base}?shot=1&chapter=toHarbour&progress=0&analytics=0`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 90000, polling: 50 });
    await page.evaluate(quality => {
      const g = __game, chapter = g.story.current, boat = g.boat, berth = boat.mooring;
      g.quality.setMode(quality, performance.now());
      g.water.step(1);
      const previous = chapter.route.at(-2);
      boat.position.x = previous.x + (berth.x - previous.x) * 0.3;
      boat.position.z = previous.y + (berth.z - previous.y) * 0.3;
      boat.yaw = Math.atan2(berth.x - boat.position.x, berth.z - boat.position.z);
      boat.speed = 4;
      chapter.restoreCheckpoint('swim', [chapter.route.length - 1, 100]);
      chapter.update(0);
      g.rig.cut(chapter.shot);
      window.__waterSamples = [];
      window.__waterStop = 'before';
      const update = g.water.update.bind(g.water);
      g.water.update = (...args) => {
        update(...args);
        const reflection = g.water.reflection, uniforms = g.water.mesh.material.uniforms;
        const state = {
          frame: __stats.frame, chapter: g.story.name, action: g.child.action?.kind,
          mirror: uniforms.uMirrorOn.value, effects: uniforms.uSeaEffects.value.toArray(),
          rooms: uniforms.uJourneyRooms.value.toArray(), camera: g.rig.camera.position.toArray(),
          quality: g.quality.level.name, buffer: [g.renderer.domElement.width, g.renderer.domElement.height],
          reflectedFrom: reflection.renderedFrom.toArray(), size: [reflection.target.width, reflection.target.height],
          gap: Math.hypot(boat.position.x - berth.x, boat.position.z - berth.z),
        };
        __waterSamples.push(state);
        if ((__waterStop === 'before' && state.chapter === 'toHarbour' && state.gap < 3.2)
          || (__waterStop === 'after' && state.chapter === 'home')
          || (typeof __waterStop === 'number' && state.frame >= __waterStop)) window.__waterPaused = true;
      };
    }, quality);
    for (let i = 0; i < 100 && !await page.evaluate(() => window.__waterPaused); i++) {
      const [x, y] = await page.evaluate(() => {
        const g = __game, p = g.boat.position.clone();
        p.y += 3; p.project(g.rig.camera);
        return [(p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight];
      });
      await page.mouse.move(x - 70, y);
      await page.mouse.move(x + 70, y - 25, { steps: 16 });
      await page.waitForTimeout(150);
    }
    await page.waitForFunction(() => window.__waterPaused, null, { timeout: 15000, polling: 50 });
    await page.screenshot({ path: `${output}/${name}-before.png` });
    await page.evaluate(() => { window.__waterStop = 'after'; window.__waterPaused = false; });
    await page.waitForFunction(() => window.__waterPaused, null, { timeout: 30000, polling: 50 });
    await page.screenshot({ path: `${output}/${name}-landing.png` });
    await page.evaluate(() => { window.__waterStop = __stats.frame + 180; window.__waterPaused = false; });
    await page.waitForFunction(() => window.__waterPaused, null, { timeout: 30000, polling: 50 });
    await page.screenshot({ path: `${output}/${name}-ashore.png` });
    const samples = await page.evaluate(() => __waterSamples);
    fs.writeFileSync(`${output}/${name}-trace.json`, JSON.stringify(samples, null, 2));
    const index = samples.findIndex(sample => sample.chapter === 'home');
    assert(index > 0, `${name}: exercise the crossing-to-home transition`);
    const before = samples[index - 1], after = samples[index], home = samples.slice(index);
    assert.equal(after.quality, quality, `${name}: exercise the requested quality level`);
    assert.equal(after.action, 'alight', `${name}: capture the first disembark frame`);
    assert.equal(before.mirror, 1, `${name}: exercise the outgoing reflection`);
    assert(home.length >= 180, `${name}: follow disembark through the walk onto the jetty`);
    assert(home.every(sample => sample.mirror === (quality === 'low' ? 0 : 1)),
      `${name}: home must retain scene reflections except at Low`);
    assert.deepEqual(after.effects, before.effects, `${name}: no quality change at the handoff`);
    if (quality !== 'low') {
      assert.deepEqual(after.reflectedFrom, after.camera, `${name}: refresh the reflection on the landing frame`);
      assert.deepEqual(after.size, after.buffer.map(size => Math.round(size * 0.25)),
        `${name}: home uses the ordinary sea's quarter-size target`);
      assert(home.some(sample => sample.reflectedFrom.some((value, i) => value !== after.reflectedFrom[i])),
        `${name}: keep updating reflections as the camera moves`);
    }
    assert.deepEqual(errors, [], `${name}: browser errors`);
    report.push({ name, before, after, homeFrames: home.length });
    await page.close();
    console.log(`${name}: arrival and disembark reflection continuity passed`);
  }
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
} finally {
  await close();
}

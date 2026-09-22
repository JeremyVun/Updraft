// Aim a production crossing camera from each departure berth toward its destination and advance the production room/fog handoff, including reflections.
// BASE selects a Vite dev server. Screenshots and report go to /tmp.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const prefix = process.argv[2] ?? '/tmp/updraft-journey-reveal';
const { browser, close } = await openBrowser();
const results = [];
try {
  for (const [from, to, width, height] of [
    ['lines', 'toBoats', 1280, 720], ['meadow', 'toBirches', 1280, 720],
    ['boats', 'toMeadow', 1280, 720], ['wood', 'toSleeping', 1280, 720],
    ['boats', 'toMeadow', 390, 844], ['wood', 'toSleeping', 390, 844],
  ].filter(([from]) => !process.env.CASE || from === process.env.CASE)) {
    const page = await browser.newPage({ viewport: { width, height } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=${from === 'lines' ? 'washing' : from}&ratio=1&progress=0`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
    await page.evaluate(async ({from, to}) => {
      const { journeyReveal, visibleRooms, ROOMS } = await import('/src/world/journey-rooms.ts');
      const { BOATS_BERTH } = await import('/src/world/little-boats-layout.ts');
      const { WOOD_BERTH } = await import('/src/world/wood.ts');
      const { LINES_BERTH } = await import('/src/world/lines-passage.ts');
      const { FAR_SHORE } = await import('/src/story/meadow.ts');
      const g = __game, berth = {boats: BOATS_BERTH, wood: WOOD_BERTH, lines: LINES_BERTH, meadow: FAR_SHORE}[from];
      const destination = visibleRooms(to, berth.z).at(-1), coast = ROOMS[destination];
      const yaw = Math.atan2(coast.x - berth.x, coast.z - berth.z);
      if (from === 'lines') g.doorway.reset(true);
      g.story.sail(berth.x, berth.z, yaw); g.story.begin(to); g.story.update(0, __stats.time);
      g.rig.cut(g.story.shot);
      // Fixture freezes navigation and camera only. Main still advances the real room/fog controller and renders both passes.
      g.rig.update = () => {}; g.story.update = () => {}; g.boat.update = () => {};
      g.story.name = from;
      journeyReveal.ages.clear(); journeyReveal.initialized = false;
      journeyReveal.update(visibleRooms(from, berth.z), 0);
      const target = Object.keys(ROOMS).indexOf(destination);
      window.revealLog = { target, enabled: null, reflections: 0, frames: 0, maxStep: 0, last: 0 };
      const waterUpdate = g.water.update.bind(g.water);
      g.water.update = (camera, before, after) => waterUpdate(camera, mirrorCamera => {
        if (g.story.name === to) revealLog.reflections++;
        before?.(mirrorCamera);
      }, after);
      const before = g.terrain.mesh.onBeforeRender;
      g.terrain.mesh.onBeforeRender = function (...args) {
        before.apply(this, args);
        if (g.story.name !== to) return;
        const u = this.material.uniforms, amount = u.uJourneyVeilAmounts.value.x;
        if (!u.uMirrorPass.value) {
          revealLog.frames++;
          revealLog.maxStep = Math.max(revealLog.maxStep, Math.abs(amount - revealLog.last));
          revealLog.last = amount;
          if (u.uJourneyRooms.value.toArray().includes(target) && revealLog.enabled === null)
            revealLog.enabled = { amount, frame: revealLog.frames };
        }
      };
    }, {from, to});
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${prefix}-${from}-${width}-before.png` });
    await page.evaluate(to => { __game.story.name = to; }, to);
    await page.waitForFunction(() => revealLog.enabled !== null, null, { timeout: 20000 });
    await page.screenshot({ path: `${prefix}-${from}-${width}-covered.png` });
    await page.waitForFunction(() => revealLog.last < .65 && revealLog.last > .2, null, { timeout: 20000 });
    await page.screenshot({ path: `${prefix}-${from}-${width}-emerging.png` });
    await page.waitForFunction(() => revealLog.last === 0, null, { timeout: 20000 });
    await page.screenshot({ path: `${prefix}-${from}-${width}-clear.png` });
    const result = await page.evaluate(() => ({ ...revealLog,
      mirrorEnabled: __game.water.mesh.material.uniforms.uMirrorOn.value > 0 }));
    assert.equal(result.enabled.amount, 1, 'the first rendered island frame must be fully fogged');
    assert(result.maxStep < .04, 'fog must change gradually in the real render loop');
    if (result.mirrorEnabled) assert(result.reflections > 0, 'enabled reflections must share the reveal');
    assert.deepEqual(errors, []);
    results.push({from, to, width, height, ...result, errors});
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
} finally {
  fs.writeFileSync(`${prefix}.json`, JSON.stringify(results, null, 2));
  await close();
}

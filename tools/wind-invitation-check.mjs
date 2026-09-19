// Capture the shared invitations at real game cameras. Fixtures skip travel only; hints and gestures run normally.
// BASE selects a built preview; W/H select desktop or portrait. Output stays in /tmp.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const viewport = { width: Number(process.env.W ?? 1600), height: Number(process.env.H ?? 900) };
const prefix = process.env.OUT ?? `/tmp/updraft-wind-${viewport.width}`;
const lock = '/tmp/updraft-chromium.lock';
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let holder = 0; try { holder = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    if (holder) { try { process.kill(holder, 0); } catch { fs.rmSync(lock, { recursive: true, force: true }); continue; } }
    await new Promise(r => setTimeout(r, 400));
  }
}
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const report = { viewport, states: [], errors: [] };
try {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) report.errors.push(m.text()); });
  for (const scene of (process.env.SCENES ?? 'washing,wood,scarf,wrap,summit,sail,soap,boats,piano').split(',')) {
    const chapter = { scarf: 'birches', wrap: 'birches', sail: 'drowned', moon: 'mirror', soap: 'mirror' }[scene] ?? scene;
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=${chapter}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    assert.deepEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), viewport);
    if (scene === 'washing') await page.evaluate(() => {
      const g = __game, c = g.story.current, p = g.curtains[0];
      g.child.stop(); g.child.place(p.before.x, p.before.z, Math.PI); g.cygnet.release(p.birdBefore);
      g.glider.hold(g.child); c.to('curtain'); c.update(0, c.now); g.rig.cut(c.shot);
    });
    if (scene === 'scarf' || scene === 'wrap') {
      await page.waitForFunction(() => !__game.carry.busy && !__game.child.acting, null, { timeout: 15000 });
      await page.evaluate(index => {
        const g = __game, c = g.story.current, scarf = g.birches.scarf;
        scarf.restore(index); g.child.stop(); const before = scarf.snags[index].before;
        g.child.place(before.x, before.z, Math.PI); g.glider.hold(g.child); g.cygnet.rideIn('satchel');
        c.leg = [1, 3][index]; c.toScarf(); c.update(0, c.now); g.rig.cut(c.shot);
      }, scene === 'wrap' ? 1 : 0);
    }
    if ((scene === 'moon' || scene === 'soap')) await page.evaluate(() => {
      const g = __game, c = g.story.current; c.restoreCheckpoint('moon', [0]); c.update(0, 0); g.rig.cut(c.shot);
    });
    if (scene === 'boats') await page.evaluate(() => {
      const g = __game, c = g.story.current; c.restoreCheckpoint('pool-1', [33]); c.update(0, 0); g.rig.cut(c.shot);
    });
    if (scene === 'sail') await page.evaluate(() => {
      const g = __game, c = g.story.current; c.to('still'); g.boat.becalmed = 1;
    });
    await page.waitForFunction(scene => {
      const g = __game;
      if (scene === 'summit' || scene === 'wrap') return g.swirl.glow > .35 && g.swirl.ghost.strands[0].points.length > 20;
      if (scene === 'sail') return g.scene.getObjectByName('sail-invitation')?.visible;
      if (scene === 'piano') return g.piano.line.batch.mesh.visible && g.piano.line.ribbon.alpha > .4;
      const cue = scene === 'washing' ? g.washingInvitation : scene === 'scarf' ? g.scarfInvitation : g.emberInvitation;
      return cue.batch.mesh.visible && cue.strokes[0].alpha > .45 && cue.strokes[0].points[0].distanceTo(cue.strokes[0].points.at(-1)) > .8;
    }, scene, { timeout: 90000 });
    await page.waitForTimeout(220);
    for (let i = 0; i < 3; i++) {
      await page.screenshot({ path: `${prefix}-${scene}-${i}.png` });
      await page.waitForTimeout(180);
    }
    const state = await page.evaluate(scene => {
      const g = __game;
      return { scene, beat: g.story.current.beat, charge: g.input.charge,
        curtain: scene === 'washing' ? g.curtains[0].charge : undefined,
        scarf: scene === 'scarf' || scene === 'wrap' ? g.birches.scarf.snags[g.birches.scarf.active].target : undefined,
        ember: scene === 'wood' ? { lit: g.story.current.ahead.lit, wake: g.story.current.ahead.wake } : undefined,
        stats: __stats };
    }, scene);
    if (state.curtain !== undefined) assert.equal(state.curtain, 0, 'Invitation must not open washing');
    if (state.scarf !== undefined) assert.equal(state.scarf, 0, 'Invitation must not loosen scarf');
    if (state.ember) { assert.equal(state.ember.lit, false); assert.equal(state.ember.wake, 0); }
    if (scene === 'wood' || (scene === 'moon' || scene === 'soap')) {
      const at = await page.evaluate(scene => {
        const p = ((scene === 'moon' || scene === 'soap') ? __game.skyMirror.wand : __game.story.current.windInvitation).clone().project(__game.rig.camera);
        return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
      }, scene);
      const extent = (scene === 'moon' || scene === 'soap') ? viewport.width * .07 : viewport.height * .09;
      await page.mouse.move(at.x - extent, at.y);
      for (let step = 1; step <= 36; step++) {
        await page.mouse.move(at.x + (step / 36 - .5) * extent * 2, at.y);
        await page.waitForTimeout(18);
      }
      assert(await page.evaluate(() => __game.emberInvitation.alpha < .1), 'Invitation must yield during real fanning');
      await page.screenshot({ path: `${prefix}-${scene}-handover.png` });
      await page.waitForFunction(() => __game.emberInvitation.alpha > .4 && __game.emberInvitation.batch.mesh.visible, null, { timeout: 8000 });
      state.handover = (scene === 'moon' || scene === 'soap') ? 'wand sweeps suppress the soap hint' : 'fades during fanning and returns after inactivity';
    }
    report.states.push(state); console.log(JSON.stringify(state));
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  fs.writeFileSync(`${prefix}-report.json`, JSON.stringify(report, null, 2));
  if (Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true });
}

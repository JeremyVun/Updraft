// Real pointer strokes, idle gates, checkpoint restoration, and the one-time swing.
// Run against Vite: BASE=http://127.0.0.1:5232/ node tools/scarf-check.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const lock = '/tmp/updraft-chromium.lock';
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let pid = 0; try { pid = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    if (pid && !alive(pid)) fs.rmSync(lock, { recursive: true, force: true });
    else await new Promise(r => setTimeout(r, 400));
  }
}
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const prefix = process.env.OUT ?? '/tmp/updraft-scarf';
try {
  const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1600), height: Number(process.env.H ?? 900) } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=birches`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.waitForTimeout(5500);
  await page.waitForFunction(() => !__game.carry.busy && !__game.child.acting);
  for (let index = 0; index < 3; index++) {
    if (process.env.NATURAL) {
      await page.waitForFunction(index => __game.story.current.beat === 'scarf' && __game.birches.scarf.active === index, index, { timeout: 120000 });
    } else await page.evaluate(index => {
      const g = __game, c = g.story.current, scarf = g.birches.scarf;
      scarf.restore(index);
      g.child.stop();
      const before = scarf.snags[index].before;
      g.child.place(before.x, before.z, Math.PI);
      g.glider.hold(g.child);
      g.cygnet.rideIn('satchel');
      c.leg = [1, 3, 4][index];
      c.toScarf(); c.update(0, c.now); g.rig.cut(c.shot);
    }, index);
    await page.waitForTimeout(2200);
    const idle = await page.evaluate(index => ({ work: __game.birches.scarf.snags[index].work, beat: __game.story.current.beat }), index);
    assert.equal(idle.work, 0, `Tangle ${index + 1} solved itself`);
    await page.screenshot({ path: `${prefix}-${index + 1}-tied.png` });
    // Distant gestures must not count either.
    await page.evaluate(() => { __game.input.present = false; });
    await page.waitForTimeout(50);
    await page.mouse.move(30, 50); await page.waitForTimeout(50);
    await page.mouse.move(130, 50, { steps: 10 }); await page.waitForTimeout(50);
    assert.equal(await page.evaluate(index => __game.birches.scarf.snags[index].work, index), 0);
    let strokes = 0;
    while (strokes < 24) {
      const state = await page.evaluate(index => {
        const g = __game, snag = g.birches.scarf.snags[index];
        const p = snag.center.clone().project(g.rig.camera);
        return { work: snag.work, x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
      }, index);
      if (state.work >= 1) break;
      const dir = index === 0 ? [0, -1] : [strokes % 2 ? -1 : 1, 0];
      const start = index === 2 ? [state.x, state.y] : [state.x - dir[0] * 75, state.y - dir[1] * 75];
      const end = [state.x + dir[0] * 75, state.y + dir[1] * 75];
      await page.mouse.move(...start);
      await page.mouse.down();
      for (let j = 1; j <= 16; j++) {
        await page.mouse.move(start[0] + (end[0] - start[0]) * j / 16, start[1] + (end[1] - start[1]) * j / 16);
        await page.waitForTimeout(24);
      }
      await page.mouse.up();
      strokes++;
    }
    await page.waitForFunction(index => __game.birches.scarf.snags[index].freed, index, { timeout: 10000 });
    assert.ok(strokes <= 16, `Tangle ${index + 1} needed ${strokes} strokes`);
    console.log(JSON.stringify({ tangle: index + 1, strokes, idle: 'held', released: true }));
    await page.screenshot({ path: `${prefix}-${index + 1}-free.png` });
    if (index < 2) {
      const point = await page.evaluate(() => ({ name: __game.story.current.checkpoint, data: __game.story.current.saveCheckpoint() }));
      await page.evaluate(point => {
        const g = __game; g.birches.scarf.restore(0); g.story.current.restoreCheckpoint(point.name, point.data);
      }, point);
      assert.equal(await page.evaluate(() => __game.birches.scarf.completed), index + 1);
    }
  }
  await page.waitForFunction(() => __game.birches.scarf.finished, null, { timeout: 18000 });
  assert.equal(await page.evaluate(() => __game.boat.scarfSail), 1);
  await page.screenshot({ path: `${prefix}-sail.png` });
  // Restore by the swing, then test that sustained input can continue past the old fixed timeout.
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    g.child.stop();g.child.place(3,-1116,0);g.glider.hold(g.child);
    c.swings=0;c.toSwing();c.update(0,c.now);g.rig.cut(c.shot);
  });
  await page.waitForFunction(() => __game.story.current.beat === 'swinging');
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    c.beatStart=c.now-60; c.lastSwingInput=c.now; g.input.present=true;g.input.gust=3;
    c.update(1/60,c.now+1/60);
    if(c.beat!=='swinging'||c.leavingSwing)throw Error('Fixed timeout still ends ride');
    g.input.present=false;g.input.gust=0;g.input.charge=0;
  });
  await page.waitForFunction(() => __game.story.current.beat === 'walk', null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => __game.story.current.swings), 1);
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    g.child.stop();g.child.place(3,-1116,0);c.play='hold';c.holdUntil=c.now+20;
    g.wind.addSplat({ax:2.6,az:-1118,bx:2.6,bz:-1118,vx:20,vz:0,radius:5,energy:1,lift:0,swirl:0});
  });
  await page.waitForTimeout(1000);
  assert.notEqual(await page.evaluate(() => __game.story.current.beat), 'toSwing');
  assert.notEqual(await page.evaluate(() => __game.story.current.beat), 'swinging');
  console.log('Checkpoints, red sail, controlled swing exit, and one-time swing passed.');
  // The independent bird must be gathered before the scarf's departure reward can continue.
  await page.evaluate(() => {
    const g=__game,c=g.story.current;
    g.child.stop();g.child.place(-3,-1183,Math.PI);g.glider.hold(g.child);
    c.leg=4;c.resumeWalk();c.lastLegAt=c.now-50;
    g.cygnet.release(g.child.position.clone().add({x:2,y:0,z:1}));
  });
  await page.waitForFunction(() => __game.story.name !== 'birches', null, { timeout: 90000 });
  assert.equal(await page.evaluate(() => __game.cygnet.carried), true);
  assert.equal(await page.evaluate(() => __game.boat.scarfSail), 1);
  console.log('Cygnet gathered and departure continued with the red sail.');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  try { if (Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true }); } catch {}
}

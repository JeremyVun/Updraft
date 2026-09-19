// Real pointer sweeps through the dark wood, plus long-idle and accidental-motion regressions.
// node tools/wood-check.mjs [portrait] [rescue]. Rescue stages the bolt after the first-coal idle/input checks. Captures and report: /tmp/updraft-wood-<mode>-*.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const portrait = process.argv.includes('portrait');
const resumeRescue = process.argv.includes('rescue');
const mode = (portrait ? 'portrait' : 'desktop') + (resumeRescue ? '-rescue' : '');
const prefix = `/tmp/updraft-wood-${mode}`;
const viewport = portrait ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const lock = '/tmp/updraft-chromium.lock';
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let holder = 0;
    try { holder = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    if (holder) {
      try { process.kill(holder, 0); }
      catch { fs.rmSync(lock, { recursive: true, force: true }); continue; }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
let browser;
const report = { mode, beats: [], catches: [], errors: [] };
try {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport, hasTouch: portrait });
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=wood`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.waitForFunction(() => __game.story.current.beat === 'first', null, { timeout: 30000 });
  const state = () => page.evaluate(() => {
    const g = __game, c = g.story.current;
    const target = c.windInvitation?.clone().project(g.rig.camera);
    return { chapter: g.story.name, beat: c.beat, leg: c.leg, chainAt: c.chainAt, t: c.t,
      child: g.child.position.toArray(), moving: g.child.moving, soggy: g.glider.soggy.value,
      target: target && [target.x, target.y, target.z],
      coals: g.embers.coals.filter(c => c.live).map(c => ({ lit: c.lit, wake: c.wake, p: c.p.toArray() })) };
  });
  // Timer jumps test the old 35/75/170-second skips without changing any input or light.
  async function idleCheck(beat) {
    const before = await state();
    await page.evaluate(() => {
      const g = __game, c = g.story.current;
      const start = c.now;
      for (let i = 1; i <= 300; i++) { c.brushDry(0); c.update(1, start + i); }
      // Return the test clock to the render loop's time after probing the old timeout boundaries.
      c.now = start; c.beatStart = start; c.nextCall = start + 3;
    });
    const after = await state();
    assert.equal(after.beat, beat, 'waiting must not skip a mechanic');
    assert.deepEqual(after.coals.map(c => c.lit), before.coals.map(c => c.lit), 'waiting must not light coals');
    if (beat === 'dry') assert.equal(after.soggy, before.soggy, 'the storm must not dry the plane');
    console.log(`300-second idle gate passed: ${beat}`);
  }
  await idleCheck('first');
  await page.waitForFunction(() => __game.emberInvitation.batch.mesh.visible, null, { timeout: 12000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${prefix}-invitation.png` });
  const initial = await state();
  const x = (initial.target[0] + 1) * viewport.width / 2, y = (1 - initial.target[1]) * viewport.height / 2;
  await page.mouse.move(x, y); await page.waitForTimeout(400);
  await page.mouse.move(x + 2, y); await page.waitForTimeout(2500);
  assert((await state()).coals.every(c => !c.lit), 'a tiny motion must not light the first coal');
  report.tinyMotion = await state();
  const touch = portrait ? await page.context().newCDPSession(page) : null;
  async function sweep(target, reverse) {
    const x = (target[0] + 1) * viewport.width / 2;
    const y = (1 - target[1]) * viewport.height / 2;
    const radius = viewport.height * 0.075;
    const start = Math.max(4, Math.min(viewport.width - 4, x + (reverse ? radius : -radius)));
    const end = Math.max(4, Math.min(viewport.width - 4, x + (reverse ? -radius : radius)));
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
    else await page.mouse.move(start, y);
    for (let i = 1; i <= 24; i++) {
      const xx = start + (end - start) * i / 24;
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: xx, y }] });
      else await page.mouse.move(xx, y);
      await page.waitForTimeout(40);
    }
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  if (resumeRescue) await page.evaluate(() => {
    const g = __game, c = g.story.current;
    g.child.stop(); g.child.place(-32, -1773, Math.PI); c.leg = 2; c.chainAt = 95;
    c.bolt(); c.frame(); g.rig.cut(c.shot);
  });
  let lastBeat, strokes = 0, lastCoal = -1;
  process.once('SIGTERM', () => { browser?.close().finally(() => { if (fs.existsSync(`${lock}/pid`) && Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true }); process.exit(143); }); });
  const end = Date.now() + 360000;
  while (Date.now() < end) {
    const s = await state();
    if (s.chapter !== 'wood' || s.beat === 'aboard') { report.completed = s; break; }
    if (s.beat !== lastBeat) {
      lastBeat = s.beat; report.beats.push(s); console.log(`beat ${s.beat}, leg ${s.leg}`);
      await page.screenshot({ path: `${prefix}-${s.beat}.png` });
      if (s.beat === 'lost' || s.beat === 'dry') await idleCheck(s.beat);
    }
    const litCount = s.coals.filter(c => c.lit).length;
    if (s.chainAt !== lastCoal) { lastCoal = s.chainAt; report.catches.push(s); }
    if (s.target && s.target[2] < 1 && Math.abs(s.target[0]) < 0.96 && Math.abs(s.target[1]) < 0.96) {
      await sweep(s.target, strokes++ % 2 === 1);
      if (strokes % 10 === 0) console.log(`sweep ${strokes}: ${JSON.stringify(await state())}`);
    } else await page.waitForTimeout(300);
    if (litCount && !report.litShot) {
      await page.screenshot({ path: `${prefix}-lit.png` }); report.litShot = true;
    }
  }
  report.final = await state();
  report.stats = await page.evaluate(() => window.__stats);
  assert(report.completed, `must reach the departure boat: ${JSON.stringify(report.final)}`);
  assert(report.beats.some(b => b.beat === 'lost'), 'the rescue must be encountered');
  assert(report.beats.some(b => b.beat === 'dry'), 'the plane must be repaired');
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  console.log(`Wood complete with ${strokes} sweeps; no browser errors.`);
} finally {
  fs.writeFileSync(`${prefix}-report.json`, JSON.stringify(report, null, 2));
  await browser?.close();
  if (fs.existsSync(`${lock}/pid`) && Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true });
}

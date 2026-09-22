// Real pointer sweeps through the dark wood, plus long-idle and accidental-motion regressions.
// node tools/wood-check.mjs [portrait] [rescue]. NATURAL=1 skips clock probes; BASE pins a build; PREFIX separates captures.
// Rescue stages the bolt after the first-coal idle/input checks. Captures and report: /tmp/updraft-wood-<mode>-*.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { reviewCapture } from './lib/review-capture.mjs';
const portrait = process.argv.includes('portrait');
const resumeRescue = process.argv.includes('rescue');
const mode = (portrait ? 'portrait' : 'desktop') + (resumeRescue ? '-rescue' : '');
const prefix = process.env.PREFIX ?? `/tmp/updraft-wood-${mode}`;
const videoDir = process.env.VIDEO ? fs.mkdtempSync('/tmp/updraft-wood-video-') : null;
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
let video;
let context;
let stopReview;
const report = { mode, beats: [], catches: [], errors: [] };
try {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  context = await browser.newContext({ viewport, hasTouch: portrait,
    ...(videoDir ? { recordVideo: { dir: videoDir, size: viewport } } : {}) });
  const page = await context.newPage();
  video = page.video();
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=wood`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.waitForFunction(() => __game.story.current.beat === 'first', null, { timeout: 30000 });
  if (process.env.REVIEW === '1') stopReview = reviewCapture(page, prefix);
  const state = () => page.evaluate(() => {
    const g = __game, c = g.story.current;
    const target = c.windInvitation?.clone().project(g.rig.camera);
    return { chapter: g.story.name, beat: c.beat, leg: c.leg, chainAt: c.chainAt, t: c.t,
      child: g.child.position.toArray(), moving: g.child.moving, soggy: g.glider.soggy.value,
      bird: g.cygnet.seating.shown.p.toArray(), birdState: g.cygnet.state, carry: g.carry.playing,
      plane: g.glider.position.toArray(), landed: g.glider.landed,
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
    console.log(`300-second idle gate passed: ${beat}`);
  }
  if (!process.env.NATURAL) await idleCheck('first');
  // Observe the real render-loop camera without advancing story time or changing the shot.
  await page.evaluate(() => {
    const g=__game, original=g.rig.update.bind(g.rig), samples=[], spikes=[];
    let previous=null, frame=0;
    window.__woodCamera={samples,spikes};
    g.rig.update=(dt,time,shot,pace,...rest)=>{
      original(dt,time,shot,pace,...rest);
      const c=g.story.current,p=g.rig.camera.position.toArray(),q=g.rig.camera.quaternion.toArray();
      const sample={time,dt,beat:c.beat,leg:c.leg,chainAt:c.chainAt,eye:p,rotation:q,child:g.child.position.toArray(),
        aim:c.aim?.toArray(),glow:c.glow?.toArray(),fit:g.rig.fitBack};
      if(previous){sample.step=Math.hypot(...p.map((v,i)=>v-previous.eye[i]));
        sample.turn=2*Math.acos(Math.min(1,Math.abs(q.reduce((s,v,i)=>s+v*previous.rotation[i],0))));
        if(sample.step>.3||sample.turn>.04)spikes.push({...sample,previous});}
      if(frame++%12===0)samples.push(sample);
      previous=sample;
    };
  });
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
    g.child.stop(); g.child.place(-18, -1786, Math.PI); c.leg = 2; c.chainAt = 108;
    c.bolt(); c.frame(); g.rig.cut(c.shot);
  });
  let lastBeat, strokes = 0, lastCoal = -1;
  const captured = new Set();
  process.once('SIGTERM', () => { browser?.close().finally(() => { if (fs.existsSync(`${lock}/pid`) && Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true }); process.exit(143); }); });
  const end = Date.now() + 360000;
  while (Date.now() < end) {
    const s = await state();
    if (s.chapter !== 'wood' || s.beat === 'aboard') { report.completed = s; break; }
    if (s.beat !== lastBeat) {
      lastBeat = s.beat; report.beats.push(s); console.log(`beat ${s.beat}, leg ${s.leg}`);
      await page.screenshot({ path: `${prefix}-${s.beat}.png` });
      if (!process.env.NATURAL && s.beat === 'lost') await idleCheck(s.beat);
      if (s.beat === 'out') {
        await page.waitForTimeout(3000);
        const after = await state();
        assert(Math.hypot(after.child[0] - s.child[0], after.child[2] - s.child[2]) > 1,
          'child must walk on after pickup without another gesture');
        await page.screenshot({ path: `${prefix}-walking-with-paper.png` });
        report.afterPickup = after;
        continue;
      }
    }
    assert.notEqual(s.beat, 'dry', 'retrieval must not add a drying puzzle');
    if (s.beat === 'out') {
      assert(await page.evaluate(() => __game.story.current.windInvitation !== __game.glider.position), 'held paper must never ask for wind');
    }
    const detail = s.beat === 'fright' ? `startle-${Math.floor(s.t * 5)}` : s.beat === 'bolt' ? `run-${Math.floor(s.t)}`
      : s.beat === 'found' ? s.carry.replace(':', '-') || (s.t < 1.4 ? 'resolve' : 'approach') : null;
    if (detail && !captured.has(detail)) {
      captured.add(detail);
      await page.screenshot({ path: `${prefix}-${detail}.png` });
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
  report.camera = await page.evaluate(() => window.__woodCamera);
  if(process.env.NATURAL&&!resumeRescue){
    const forest=new Set(['first','walk','compose','fright','bolt','lost','found','plane','snag','fall','pickup','out','toBoat','push']);
    const spikes=report.camera.spikes.filter(s=>forest.has(s.beat));
    assert(spikes.every(s=>s.step<1), 'forest camera must not jump a world unit in one render frame');
    assert(spikes.every(s=>s.turn<.08), 'forest camera must not snap its orientation');
    const walking=report.camera.samples.concat(report.camera.spikes).filter(s=>['walk','out'].includes(s.beat));
    report.maxWalkingTurn=Math.max(...walking.map(s=>(s.turn??0)/s.dt));
    assert(report.maxWalkingTurn<.75, 'returning from the rescue must arc around the child');
  }
  assert(report.completed, `must reach the departure boat: ${JSON.stringify(report.final)}`);
  assert(report.beats.some(b => b.beat === 'lost'), 'the rescue must be encountered');
  assert(report.beats.some(b => b.beat === 'out'), 'retrieval must continue toward the boat');
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  console.log(`Wood complete with ${strokes} sweeps; no browser errors.`);
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await stopReview?.();
  try { report.camera ??= await context?.pages()[0]?.evaluate(()=>window.__woodCamera); } catch {}
  try {
    await context?.close();
    if (video) await video.saveAs(`${prefix}.webm`);
  } catch (error) { report.videoError = error.message; }
  await browser?.close();
  fs.writeFileSync(`${prefix}-report.json`, JSON.stringify(report, null, 2));
  if (fs.existsSync(`${lock}/pid`) && Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true });
}

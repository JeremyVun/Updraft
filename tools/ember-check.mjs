// Real fanning and visual states of the approved orb. node tools/ember-check.mjs [portrait]
// BASE selects the server. PNGs, movie and report go to /tmp/updraft-orb-<mode>-*.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const portrait = process.argv.includes('portrait');
const mode = portrait ? 'portrait' : 'desktop';
const prefix = `/tmp/updraft-orb-${mode}`;
const viewport = portrait ? { width: 390, height: 844 } : { width: 1600, height: 900 };
const lock = '/tmp/updraft-chromium.lock';
for (;;) {
  try { fs.mkdirSync(lock); fs.writeFileSync(`${lock}/pid`, String(process.pid)); break; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let holder = 0;
    try { holder = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    if (holder) { try { process.kill(holder, 0); } catch { fs.rmSync(lock, { recursive: true, force: true }); continue; } }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const report = { mode, sweeps: [], errors: [] };
const videoDir = fs.mkdtempSync('/tmp/updraft-orb-video-');
try {
  const context = await browser.newContext({ viewport, hasTouch: portrait, recordVideo: { dir: videoDir, size: viewport } });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=wood`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  assert.deepEqual(await page.evaluate(() => ({ width: innerWidth, height: innerHeight })), viewport);
  await page.waitForFunction(() => __game.story.current.beat === 'first', null, { timeout: 45000 });
  await page.evaluate(() => { window.__emberSubject = __game.story.current.ahead; });
  const state = () => page.evaluate(() => {
    const c = window.__emberSubject, g = __game, screen = c.p.clone().project(g.rig.camera);
    return { wake: c.wake, lit: c.lit, heat: c.heat, screen: screen.toArray(), beat: g.story.current.beat,
      light: g.embers.brightest(c.p.clone()), illumination: g.embers.illumination(c.p.clone()),
      size: g.embers.mesh.geometry.attributes.aSize.getX(300 + g.embers.coals.indexOf(c)),
      alpha: g.embers.mesh.geometry.attributes.aSpark.getW(300 + g.embers.coals.indexOf(c)), instances: g.embers.mesh.geometry.instanceCount };
  });
  await page.waitForTimeout(2000);
  report.waiting = await state(); assert.equal(report.waiting.lit, false); assert.equal(report.waiting.light, 0);
  await page.screenshot({ path: `${prefix}-waiting.png` });
  await page.waitForFunction(() => __game.emberInvitation.batch.mesh.visible, null, { timeout: 12000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${prefix}-invitation.png` });
  const touch = portrait ? await context.newCDPSession(page) : null;
  for (let stroke = 0; stroke < 7; stroke++) {
    const s = await state();
    const x = (s.screen[0] + 1) * viewport.width / 2, y = (1 - s.screen[1]) * viewport.height / 2;
    const radius = viewport.height * 0.075;
    const start = x + (stroke % 2 ? radius : -radius), end = x + (stroke % 2 ? -radius : radius);
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
    else await page.mouse.move(start, y);
    for (let step = 1; step <= 36; step++) {
      const at = start + (end - start) * step / 36;
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at, y }] });
      else await page.mouse.move(at, y);
      await page.waitForTimeout(20);
    }
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await state(); report.sweeps.push(after);
    if (!after.lit) {
      const previous = report.sweeps.at(-2) ?? report.waiting;
      assert(after.size > previous.size, 'fanning should progressively grow the orb');
      assert(after.alpha > previous.alpha, 'fanning should progressively brighten the orb');
      assert(after.illumination > previous.illumination, 'forest illumination should grow before ignition');
      assert.equal(after.light, 0, 'warming light must not open the story gate');
      await page.screenshot({ path: `${prefix}-sweep-${stroke + 1}.png` });
    }
    if (stroke === 0) { assert(!after.lit, 'one casual pass must not ignite'); await page.screenshot({ path: `${prefix}-fanning.png` }); }
    if (after.lit) break;
  }
  assert(report.sweeps.at(-1).lit, 'deliberate sweeps must light the orb');
  assert(report.sweeps.at(-1).size > report.waiting.size * 2.5, 'resting orb should be much smaller');
  assert(report.sweeps.at(-1).alpha > report.waiting.alpha * 3, 'resting orb should be much dimmer');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${prefix}-lit.png` });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = __game;
    g.rig.update = () => {};
    g.rig.camera.fov = 18;
    g.rig.camera.lookAt(window.__emberSubject.p);
    g.rig.camera.updateProjectionMatrix();
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${prefix}-detail.png` });
  for (let frame = 1; frame <= 2; frame++) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${prefix}-motion-${frame}.png` });
  }
  report.stats = await page.evaluate(() => window.__stats);
  // Isolate only the heart and veils. A fixed camera and black background expose the actual animation.
  await page.evaluate(() => {
    const g = __game, subject = window.__emberSubject;
    const stage = new g.scene.constructor();
    const orb = g.embers.mesh.clone(); stage.add(orb);
    // Keep the real orb surface geometry and uniforms; omit the airborne spark instances.
    const heart = orb.geometry.clone();
    heart.setAttribute('aSpark', g.embers.mesh.geometry.attributes.aSpark.clone());
    for (let i = 0; i < 300; i++) heart.attributes.aSpark.setW(i, 0);
    orb.geometry = heart;
    const camera = g.rig.camera.clone(); camera.aspect = 1; camera.fov = 35;
    camera.position.copy(subject.p).add({ x: 0, y: 0, z: 4.5 });
    camera.lookAt(subject.p); camera.updateProjectionMatrix();
    const renderer = new g.renderer.constructor({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(560, 560); renderer.setClearColor(0x05080e);
    Object.assign(renderer.domElement.style, { position: 'fixed', left: '0', top: '0', zIndex: '9999', width: '100vw', height: '100vh', objectFit: 'contain', background: '#05080e' });
    document.body.append(renderer.domElement);
    const draw = () => { renderer.render(stage, camera); requestAnimationFrame(draw); }; draw();
    window.__emberStage = { renderer };
  });
  for (let frame = 0; frame < 3; frame++) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${prefix}-isolated-${frame}.png` });
  }
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  const video = page.video(); await context.close(); fs.renameSync(await video.path(), `${prefix}.webm`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  fs.writeFileSync(`${prefix}-report.json`, JSON.stringify(report, null, 2));
  fs.rmSync(videoDir, { recursive: true, force: true });
  try { if (Number(fs.readFileSync(`${lock}/pid`, 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true }); } catch {}
}

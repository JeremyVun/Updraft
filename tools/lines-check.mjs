// Play the island of lines with real mouse/touch sweeps, verify all passages and the departure.
// node tools/lines-check.mjs [play|idle|portrait|resume|portrait-resume|door|portrait-door-resume|door-legacy]
// Door modes stage the completed curtains; play/portrait exercise real gestures; idle proves waiting cannot solve the first sheet.
// BASE selects the dev server; captures/report go to /tmp/updraft-lines-<mode>-*. Runs under the play.mjs lock.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const mode = process.argv[2] ?? 'play';
const prefix = `/tmp/updraft-lines-${mode}`;
const lock = '/tmp/updraft-chromium.lock';
// Same mutual exclusion as play.mjs: wait for the GPU capture resource, without launching a second browser.
for (;;) {
  try {
    fs.mkdirSync(lock);
    fs.writeFileSync(`${lock}/pid`, String(process.pid));
    break;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let holder = 0;
    try { holder = Number(fs.readFileSync(`${lock}/pid`, 'utf8')); } catch {}
    let alive = true;
    if (holder) { try { process.kill(holder, 0); } catch { alive = false; } }
    if (holder && !alive) fs.rmSync(lock, { recursive: true, force: true });
    else await new Promise(resolve => setTimeout(resolve, 400));
  }
}
const portrait = mode.includes('portrait');
const resume = mode.includes('resume');
const viewport = portrait ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const report = { mode, passages: [], errors: [] };
let page;
try {
  page = await browser.newPage({ viewport, hasTouch: portrait });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  // The secret shore must already be absent before the washing chapter owns the camera.
  if (mode.includes('door')) {
    report.approach = [];
    for (const chapter of ['island', 'lines']) {
      await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=${chapter}`);
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
      await page.evaluate(chapter => {
        const g = __game;
        if (chapter === 'lines') {
          g.story.sail(60, -195, Math.PI);
          g.story.current.restoreCheckpoint('entry', [5, 90]);
          g.story.current.update(0); g.rig.cut(g.story.current.shot);
        }
        window.__approachChecks = { main: 0, mirror: 0, leaks: 0, missingBoat: 0 };
        const render = g.renderer.render.bind(g.renderer);
        g.renderer.render = (scene, camera) => {
          if (scene === g.scene) {
            const c = window.__approachChecks;
            if (camera === g.rig.camera) {
              c.main++;
              if (!g.boat.group.visible) c.missingBoat++;
            } else if (camera.layers.mask === 2) c.mirror++;
            const room = g.terrain.mesh.material.uniforms.uRoom.value;
            if (g.doorwayView.shoreObjects.some(o => o.visible) || room.z >= 0) c.leaks++;
          }
          render(scene, camera);
        };
      }, chapter);
      await page.waitForTimeout(chapter === 'lines' ? 4500 : 800);
      const checks = await page.evaluate(() => window.__approachChecks);
      assert(checks.main > 0 && checks.mirror > 0, 'check the ordinary view and its reflection');
      assert.equal(checks.leaks, 0, 'secret shore must stay absent before arrival');
      assert.equal(checks.missingBoat, 0, 'concealing the shore must not hide the travelling boat');
      report.approach.push({ chapter, ...checks });
      if (chapter === 'lines') await page.screenshot({ path: `${prefix}-approach.png` });
    }
    console.log('opening and inbound crossing conceal the secret shore');
  }
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=washing&progress=1`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const installChecks = async () => page.evaluate(() => {
    const g = __game;
    window.__objectiveCues = [];
    window.__completionPhrases = 0;
    const soundUpdate = g.sound.update.bind(g.sound);
    g.sound.update = (dt, state) => {
      for (const name of state.cues) if (name === 'restored') window.__objectiveCues.push({ name, beat: g.story.current.beat });
      soundUpdate(dt, state);
    };
    const phrase = g.sound.phrase.bind(g.sound);
    g.sound.phrase = name => { if (name === 'restored') window.__completionPhrases++; phrase(name); };
    g.sound.start();
    window.__doorChecks = { source: 0, portal: 0, shore: 0, boatLeaks: 0, laundryLeaks: 0, reflectionLeaks: 0 };
    window.__doorFrames = []; let lastDoorFrame = 0;
    const render = g.renderer.render.bind(g.renderer);
    g.renderer.render = (scene, camera) => {
      if (scene === g.scene && g.story.name === 'lines') {
        const c = window.__doorChecks;
        const departureBoat = g.boat.position.distanceToSquared(g.doorExit) < 80 * 80;
        if (camera === g.rig.camera) {
          if (g.story.current.beat === 'throughDoor') {
            const now = performance.now(); if (lastDoorFrame) window.__doorFrames.push(now - lastDoorFrame); lastDoorFrame = now;
          }
          if (g.doorway.crossed) { c.shore++; if (g.washing.group.visible || g.pinwheels.group.visible) c.laundryLeaks++; }
          else { c.source++; if ((departureBoat && g.boat.group.visible) || g.kite.group.visible) c.boatLeaks++; }
        } else if (g.renderer.getRenderTarget() === g.doorwayView.target) c.portal++;
        else if (camera.layers.mask === 2 && ((!g.doorway.crossed && departureBoat && g.boat.group.visible) || (g.doorway.crossed && g.washing.group.visible))) c.reflectionLeaks++;
      }
      render(scene, camera);
    };
  });
  await installChecks();
  const state = () => page.evaluate(() => {
    const g = __game, c = g.story.current;
    return { chapter: g.story.name, beat: c.beat, gate: c.gate, t: c.t, now: c.now, held: g.glider.held,
      child: g.child.position.toArray(), bird: g.cygnet.position.toArray(), crossed: g.doorway.crossed, childMoving: g.child.moving, boat: g.boat.position.toArray(), grounded: g.boat.grounded,
      curtains: g.curtains.map(c => ({ charge: c.charge, opening: c.opening, cleared: c.cleared })),
      saved: JSON.parse(localStorage.getItem('updraft.progress.v1'))?.point };
  });
  const touch = portrait ? await page.context().newCDPSession(page) : null;
  async function sweep(reverse, y) {
    const x0 = reverse ? 0.78 : 0.22, x1 = reverse ? 0.22 : 0.78;
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0 * viewport.width, y: y * viewport.height }] });
    else await page.mouse.move(x0 * viewport.width, y * viewport.height);
    for (let i = 1; i <= 36; i++) {
      const x = (x0 + (x1 - x0) * i / 36) * viewport.width;
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y * viewport.height }] });
      else await page.mouse.move(x, y * viewport.height);
      await page.waitForTimeout(16);
    }
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  if (mode.includes('door')) {
    await page.evaluate(() => {
      const g = __game, c = g.story.current;
      g.curtains.forEach(x => x.reset(true));
      g.child.stop(); g.child.place(9.3, -385.7, Math.PI); g.glider.hold(g.child);
      g.cygnet.release(g.child.position.clone().add({ x: 2, y: 0, z: 0 }));
      g.cygnet.seating.snap(); c.gate = 3; c.to('family'); c.frame(); g.rig.cut(c.shot);
    });
  }
  for (let gate = 0; gate < (mode.includes('door') ? 0 : 3); gate++) {
    await page.waitForFunction(gate => __game.story.current.beat === 'curtain' && __game.story.current.gate === gate, gate, { timeout: 120000 });
    await page.waitForTimeout(1800);
    const before = await state();
    assert(before.held, 'plane must stay in the hand during the puzzle');
    await page.screenshot({ path: `${prefix}-${gate + 1}-waiting.png` });
    if (mode === 'idle' && gate === 0) {
      // Beyond the removed 40-second automatic opening, including several invitation cycles.
      await page.waitForFunction(() => __game.story.current.t > 50, null, { timeout: 75000 });
      const idle = await state();
      assert.equal(idle.beat, 'curtain');
      assert.equal(idle.curtains[0].charge, 0, 'the invitation must never contribute puzzle progress');
      assert(!idle.curtains[0].cleared, 'waiting must never open a sheet');
      report.idle = idle;
      console.log('first sheet still closed after 50 seconds without input');
    }
    {
      for (let stroke = 0; stroke < 8; stroke++) {
        await sweep(stroke % 2 === 1, 0.37 + (stroke % 3) * 0.08);
        const current = await state();
        assert(current.held, 'wind over a curtain must never release the plane');
        if (current.curtains[gate].cleared) break;
      }
    }
    await page.waitForFunction(gate => __game.curtains[gate].cleared, gate, { timeout: 12000 });
    const solved = await state();
    if (mode !== 'idle') assert(solved.now - before.now < 12, 'broad sweeps should open the sheet promptly');
    assert.equal(await page.evaluate(() => window.__objectiveCues.length), 0, 'individual sheets are progress, not major completions');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${prefix}-${gate + 1}-open.png` });
    report.passages.push({ gate, before, solved });
    console.log(`opened curtain ${gate + 1}: ${JSON.stringify(solved)}`);
    if (resume && gate < 2) {
      const point = `curtain-${gate + 1}`;
      await page.waitForFunction(point => JSON.parse(localStorage.getItem('updraft.progress.v1'))?.point === point, point, { timeout: 60000 });
      await page.reload(); await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
      await installChecks();
      const restored = await state();
      assert.equal(restored.gate, gate + 1);
      assert(restored.curtains.slice(0, gate + 1).every(g => g.cleared));
      assert(restored.held);
      console.log(`restored ${point}`);
    }
  }
  await page.waitForFunction(() => __game.story.current.beat === 'family', null, { timeout: 60000 });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${prefix}-family.png` });
  report.family = await state();
  report.completion = await page.evaluate(() => ({ cues: window.__objectiveCues, played: window.__completionPhrases }));
  assert.deepEqual(report.completion.cues, [], 'the door opens without the shared completion cue');
  assert.equal(report.completion.played, 0, 'the shared completion phrase must not play at the door');
  assert(report.family.held); console.log('family revealed');
  await page.waitForFunction(() => __game.story.current.beat === 'throughDoor' && __game.story.current.doorElapsed > 9.5, null, { timeout: 60000 });
  assert(!(await state()).crossed, 'camera must remain on the washing side until it reaches the threshold');
  await page.screenshot({ path: `${prefix}-doorway.png` });
  await page.waitForFunction(() => __game.story.current.beat === 'shore', null, { timeout: 60000 });
  report.threshold = await state(); console.log(`crossed doorway: ${JSON.stringify(report.threshold)}`);
  assert(report.threshold.crossed && report.threshold.child[0] > 200 && report.threshold.bird[0] > 200, 'both travellers must reach the separate shore');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${prefix}-shore.png` });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1'))?.point === 'family', null, { timeout: 60000 });
  report.doorChecks = await page.evaluate(() => window.__doorChecks);
  report.doorTiming = await page.evaluate(() => {
    const t = window.__doorFrames.sort((a, b) => a - b);
    return { samples: t.length, p50: t[Math.floor(t.length * 0.5)], p95: t[Math.floor(t.length * 0.95)], worst: t.at(-1) };
  });
  assert(report.doorChecks.source > 0 && report.doorChecks.portal > 0 && report.doorChecks.shore > 0);
  assert.equal(report.doorChecks.boatLeaks, 0, 'departure boat and kite must only be seen through the door');
  assert.equal(report.doorChecks.laundryLeaks, 0, 'ordinary washing must never appear on the far side');
  assert.equal(report.doorChecks.reflectionLeaks, 0, 'reflections must belong to the same room');

  if (resume || mode.includes('legacy')) {
    if (mode.includes('legacy')) await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('updraft.progress.v1'));
      p.child = [11, __game.child.ground(11, -400), -400, Math.PI, 0];
      p.bird[0] = 12; p.bird[1] = __game.child.ground(12, -401); p.bird[2] = -401;
      p.boat = [14, -431, 0.1, 0, 1]; p.seat = null;
      localStorage.setItem('updraft.progress.v1', JSON.stringify(p));
    });
    await page.reload(); await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    await installChecks();
    const restored = await state();
    assert.equal(restored.gate, 3); assert(restored.curtains.every(g => g.cleared));
    assert(restored.crossed && restored.child[0] > 200 && restored.bird[0] > 200, 'reload must restore the far side');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__objectiveCues.length), 0, 'restoring a completed objective must not replay its sound');
    console.log('restored family');
  }
  await page.waitForFunction(() => __game.story.name === 'toMeadow', null, { timeout: 120000 });
  await page.waitForTimeout(6000);
  assert(await page.evaluate(() => !__game.boat.grounded && __game.child.ground(__game.boat.position.x, __game.boat.position.z) < 0), 'boat must leave the sand and sail');
  await page.screenshot({ path: `${prefix}-departure.png` });
  report.departure = await state();
  assert.equal(report.errors.filter(e => !e.includes('Failed to load resource')).length, 0, report.errors.join('\n'));
  console.log(`PASS ${mode}: ${report.passages.length} curtains checked, doorway, family, boat departure; ${JSON.stringify(report.doorTiming)}`);
} catch (error) {
  report.failure = String(error);
  if (page) {
    report.last = await page.evaluate(() => ({chapter: __game.story.name, beat: __game.story.current.beat,
      gate: __game.story.current.gate, bird: __game.cygnet.position.toArray(), child: __game.child.position.toArray(),
      curtains: __game.curtains.map(g => ({ charge: g.charge, cleared: g.cleared }))})).catch(() => null);
    await page.screenshot({ path: `${prefix}-failure.png` }).catch(() => {});
  }
  throw error;
} finally {
  fs.writeFileSync(`${prefix}-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  fs.rmSync(lock, { recursive: true, force: true });
}

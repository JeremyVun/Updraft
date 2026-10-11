import fs from 'node:fs';
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const out = process.env.OUT ?? fs.mkdtempSync('/tmp/updraft-boats-exit-');
fs.mkdirSync(out, { recursive: true });
const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await withoutHotReload(page);
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=boats&progress=0&ratio=1&msaa=2`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  await page.evaluate(() => {
    const g = __game;
    g.params.shot = false;
    g.story.current.skipTo(95);
    window.exitTrace = [];
    window.exitCues = [];
    window.exitImages = {};
    const render = g.post.render.bind(g.post);
    let previousChapter = '';
    g.post.render = (...args) => {
      render(...args);
      if (g.story.current.beat === 'aboard' && g.story.name === 'boats') exitImages.before = g.renderer.domElement.toDataURL();
      if (previousChapter === 'boats' && g.story.name === 'toMeadow') exitImages.after = g.renderer.domElement.toDataURL();
      previousChapter = g.story.name;
    };
    const soundUpdate = g.sound.update.bind(g.sound);
    g.sound.update = (...args) => {
      if (args[1]?.cues?.length) exitCues.push({ chapter: g.story.name, beat: g.story.current.beat, cues: [...args[1].cues] });
      return soundUpdate(...args);
    };
    const update = g.rig.update.bind(g.rig);
    g.rig.update = (...args) => {
      update(...args);
      const c = g.child, b = g.boat, cam = g.rig.camera;
      const u = g.water.mesh.material.uniforms;
      cam.updateMatrixWorld();
      const head = c.position.clone().add({ x: 0, y: 1.9, z: 0 });
      exitTrace.push({ wall: performance.now(), time: args[1], dt: args[0], chapter: g.story.name,
        beat: g.story.current.beat, action: c.action?.kind, age: c.action?.t,
        child: c.position.toArray(), childYaw: c.yaw, head: head.project(cam).toArray(),
        boat: b.position.toArray(), boatYaw: b.yaw, push: b.pushingFor, grounded: b.grounded,
        eye: cam.position.toArray(), target: g.story.shot.target.toArray(),
        sea: u.uSeaState.value, swell: u.uSwell.value, domain: u.uDomain.value.toArray(),
        rooms: u.uJourneyRooms.value.toArray(), veil: u.uVeil.value.toArray(),
        programs: g.renderer.info.programs.length, defines: { ...g.water.mesh.material.defines } });
    };
  });
  console.log('Driving the last pool and plug');
  for (let stroke = 0; stroke < 100; stroke++) {
    const s = await page.evaluate(() => {
      const g = __game, r = g.littleBoats, d = r.drain;
      const plug = d.waiting(r.toys[0].s) === d.plugAt;
      const p = (plug ? d.plugRest : r.invitation).clone().project(g.rig.camera);
      return { chapter: g.story.name, beat: g.story.current.beat, plug, x: (p.x + 1) * 640, y: (1 - p.y) * 400 };
    });
    if (s.chapter !== 'boats' || s.beat === 'reveal' || s.beat === 'gather' || s.beat === 'boarding') break;
    for (let i = 0; i < (s.plug ? 100 : 30); i++) {
      const x = s.x + (s.plug ? Math.cos(i * .3) * 60 : (i / 29 - .5) * 180);
      const y = s.y + (s.plug ? Math.sin(i * .3) * 60 - 35 : 0);
      await page.mouse.move(Math.max(3, Math.min(1277, x)), Math.max(3, Math.min(797, y)));
      await page.waitForTimeout(16);
    }
  }
  await page.mouse.move(1278, 798);
  console.log('Following the exit');
  await page.waitForFunction(() => __game.child.action?.kind === 'board', null, { timeout: 90000 });
  for (const age of [.5, 1.5, 2.5, 3.5, 4.5]) {
    await page.waitForFunction(t => __game.child.action?.kind !== 'board' || __game.child.action.t >= t, age);
    await page.screenshot({ path: `${out}/board-${age}.png` });
  }
  await page.waitForFunction(() => __game.story.name === 'toMeadow' && __game.story.current.time > 5, null, { timeout: 90000 });
  await page.screenshot({ path: `${out}/crossing.png` });
  const result = await page.evaluate(() => ({ trace: exitTrace, cues: exitCues, images: exitImages }));
  for (const [name, image] of Object.entries(result.images)) fs.writeFileSync(`${out}/transition-${name}.png`, Buffer.from(image.split(',')[1], 'base64'));
  delete result.images;
  fs.writeFileSync(`${out}/trace.json`, JSON.stringify({ ...result, errors }));
  const seaStep = Math.max(...result.trace.slice(1).map((s, i) => Math.abs(s.sea - result.trace[i].sea)));
  const handoff = result.trace.findIndex(s => s.chapter === 'toMeadow');
  assert.deepEqual(errors, []);
  assert(!result.cues.some(s => s.cues.includes('restored')), 'Little Boats has no completion phrase');
  assert(seaStep < .04, `water state stays continuous: largest step ${seaStep}`);
  assert.equal(result.trace[handoff].sea, result.trace[handoff - 1].sea, 'crossing inherits the departure sea');
  assert.equal(result.trace[handoff].swell, result.trace[handoff - 1].swell, 'swell cannot jump on boarding');
  assert.deepEqual(result.trace[handoff].defines, result.trace[handoff - 1].defines, 'water shader stays unchanged');
  console.log(JSON.stringify({ out, errors, samples: result.trace.length, cues: result.cues, seaStep }));
} finally { await close(); }

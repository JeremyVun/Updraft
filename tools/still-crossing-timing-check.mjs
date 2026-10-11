// Real-time audio and story clocks from bandaging through the first arrival.
import { openBrowser } from './lib/browser.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { browser, close } = await openBrowser({ allowAutoplay: false });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  console.log('Loading the tree checkpoint');
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5247/'}?shot&start=1&chapter=tree&progress=0&ratio=1&msaa=2`);
  await page.waitForSelector('#veil.ready', { timeout: 60000 });
  console.log('Veil ready');
  await page.evaluate(() => {
    __game.params.shot = false;
    window.timing = { samples: [], phases: [], births: [], ended: null };
    const echoes = __game.crossingLinen, echoUpdate = echoes.update.bind(echoes);
    const inFrame = p => { p.project(__game.rig.camera); return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z >= -1 && p.z <= 1; };
    echoes.update = (...args) => {
      const hadBirds = echoes.birds.geometry.instanceCount > 0, cloth = echoes.linen.map(l => l.mesh.visible);
      echoUpdate(...args);
      if (!hadBirds && echoes.birds.geometry.instanceCount) {
        const positions = echoes.birds.geometry.attributes.iPos.array;
        let visible = false;
        for (let i = 0; i < echoes.birds.geometry.instanceCount; i++) visible ||= inFrame(__game.boat.position.clone().fromArray(positions, i * 4));
        timing.births.push({ kind: 'gulls', at: __game.story.current.time, visible });
      }
      echoes.linen.forEach((l, index) => {
        if (cloth[index] || !l.mesh.visible) return;
        let visible = false;
        for (let i = 0; i < l.cloth.count; i++) visible ||= inFrame(__game.boat.position.clone().fromArray(l.cloth.view, i * 3));
        timing.births.push({ kind: `linen-${index}`, at: __game.story.current.time, visible });
      });
    };
    const sound = __game.sound, update = sound.update.bind(sound); let last = '', sampled = -1;
    sound.update = (...args) => {
      update(...args);
      const g = __game, t = sound.ctx?.currentTime ?? 0, score = sound.stillDepartureScore;
      if (score?.source && timing.start === undefined) {
        timing.start = t; timing.end = score.endsAt;
        score.source.addEventListener('ended', () => { timing.ended = sound.ctx.currentTime; });
      }
      if (g.story.name === 'toLines' && timing.departure === undefined) timing.departure = t;
      if (sound.linesScore?.source && timing.lines === undefined) timing.lines = t;
      const stage = sound.arrivalTransition?.stage;
      if (stage && stage !== last) { timing.phases.push({ at: t, stage }); last = stage; }
      if (g.story.name === 'toLines' && Math.floor(g.story.current.time / 2) !== sampled) {
        sampled = Math.floor(g.story.current.time / 2);
        const body = g.sealife.body, u = g.terrain.mesh.material.uniforms, points = [];
        if (g.sealife.whale) for (const s of [.1, .3, .5, .7, 1]) {
          const p = g.boat.position.clone(); body.point(0, .6, s, p);
          if (p.y > 0) points.push({ distance: p.distanceTo(g.rig.camera.position), at: p.toArray() });
        }
        const visible = p => {
          const distance = p.distanceTo(g.rig.camera.position);
          p.project(g.rig.camera);
          return Math.abs(p.x) < .95 && Math.abs(p.y) < .95 && p.z > -1 && p.z < 1 && distance < u.uHorizonMist.value.x;
        };
        const echoes = g.crossingLinen, positions = echoes.birds.geometry.attributes.iPos.array;
        let birds = 0;
        for (let i = 0; i < echoes.birds.geometry.instanceCount; i++) if (visible(g.boat.position.clone().fromArray(positions, i * 4))) birds++;
        const sheets = echoes.linen.slice(1).filter(l => {
          if (!l.mesh.visible) return false;
          const centre = g.boat.position.clone().set(0, 0, 0), p = centre.clone();
          for (let i = 0; i < l.cloth.count; i++) centre.add(p.fromArray(l.cloth.view, i * 3));
          return visible(centre.multiplyScalar(1 / l.cloth.count));
        }).length;
        timing.samples.push({ at: t, crossing: g.story.current.time, horizon: u.uHorizonMist.value.toArray(),
          veil: u.uVeil.value.toArray(), points, birds, sheets,
          title: Number(document.getElementById('journey-title').style.opacity),
          musicGate: sound.backgroundGate.gain.value });
      }
    };
  });
  await page.locator('#sound').evaluate(b => b.click()); await page.locator('#begin').click();
  console.log('Playing through bandaging and the crossing');
  if (process.env.CAPTURES) {
    fs.mkdirSync(process.env.CAPTURES, { recursive: true });
    for (const time of [39, 41, 64, 68, 72, 78, 84]) {
      await page.waitForFunction(t => __game.story.name === 'toLines' && __game.story.current.time >= t, time, { timeout: 180000 });
      await page.screenshot({ path: `${process.env.CAPTURES}/crossing-${time}.png` });
    }
  }
  await page.waitForFunction(() => timing.lines !== undefined, null, { timeout: 300000 });
  const result = await page.evaluate(() => ({ ...timing, silence: timing.lines - timing.end, boarding: timing.departure - timing.start }));
  result.errors = errors;
  fs.writeFileSync(process.env.OUT ?? '/tmp/updraft-crossing-timing.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ start: result.start, end: result.end, departure: result.departure, lines: result.lines, silence: result.silence, boarding: result.boarding, errors }));
  assert.deepEqual(errors, []);
  assert(result.boarding > 8 && result.boarding < 25, 'authored rescue departure stays within its measured interval');
  assert(result.silence >= 3 && result.silence < 10, 'Lines follows the Still cutoff with a short breath');
  assert(Math.abs(result.ended - result.end) < .15, 'Still source actually ends at 1:58');
  assert(result.samples.filter(s => s.at < result.end).every(s => Math.abs(s.musicGate - 1) < 1e-6),
    'the arrival gate leaves the authored Still fade untouched');
  assert(result.births.length === 6 && result.births.every(b => !b.visible), 'gulls and all five pieces of linen spawn outside the frame');
  const gulls = result.samples.find(s => s.birds > 0), sheets = result.samples.find(s => s.sheets > 0);
  assert(gulls && gulls.crossing >= 66 && gulls.crossing <= 76, 'gulls enter shortly after the whale camera releases');
  assert(sheets && sheets.crossing >= 60, 'loose sheets leave the whale encounter clear');
  assert(result.samples.some(s => s.sheets >= 2 && s.at < result.end - 4), 'several sheets arrive under Still music before its fade');
  console.log(JSON.stringify({ gullsAfterWhale: gulls.crossing,
    firstSheets: sheets.crossing,
    lastMusicCrossing: result.end - result.departure }));
} finally { await close(); }

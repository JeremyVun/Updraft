// Is the Birches room visible anywhere in the Drowned drift (perf-bakes E7)? Drives the drift from its start and, every
// few frames while the room is drawn, redraws the same frozen state with and without the room's objects and compares
// the pixels (a redraw without any change is the control). Every frame also records whether the room's update runs its
// full simulation (camera within the floor range). The sea's reflection is redrawn with each variant.
// BASE=<Vite> node tools/birches-drift-check.mjs [out-prefix]  EVERY=<frames between redraws> SECONDS=<game seconds>
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
import { decodePng } from './lib/png.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const prefix = process.argv[2] ?? '/tmp/updraft-birches-drift';
const every = Number(process.env.EVERY ?? 15), seconds = Number(process.env.SECONDS ?? 150);
const { browser, close } = await openBrowser();
const report = { samples: [], frames: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.addInitScript(() => {
    let seed = 1234567;
    Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await page.goto(`${base}?shot=1&ratio=1&msaa=4&progress=0&analytics=0&chapter=drowned`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
  await page.evaluate(async ({ every, seconds }) => {
    const find = path => performance.getEntriesByType('resource').findLast(r => new URL(r.name).pathname === path)?.name ?? path;
    const { params } = await import(find('/src/params.ts'));
    const { ISLES } = await import(find('/src/world/heightfield.ts'));
    const g = __game, birches = g.birches, camera = g.rig.camera, update = birches.update.bind(birches);
    const isle = ISLES.birches, drowned = ISLES.drowned;
    const Box = camera.position.constructor;
    const state = window.__drift = { frames: [], pending: null, done: false, params };
    const mirror = g.water.mesh.material.uniforms.uMirrorOn;
    state.redraw = () => {
      const frame = g.water.frame;
      g.water.update(camera, c => g.terrain.beginMirror(c), () => g.terrain.endMirror());
      g.water.frame = frame;
    };
    const start = __stats.time;
    let count = 0;
    birches.update = (dt, cam, walker) => {
      update(dt, cam, walker);
      const away = Math.hypot(cam.position.x - isle.x, cam.position.z - isle.z);
      const boat = g.boat.position, t = __stats.time - start;
      const drawn = g.story.name === 'drowned' && boat.z > drowned.z;
      state.frames.push({ t: Math.round(t * 100) / 100, near: away < isle.rx + 90, here: away < isle.rx + 240, drawn, mirror: mirror.value,
        beat: g.story.current.beat, boatZ: Math.round(boat.z * 10) / 10, away: Math.round(away), camYaw: Math.round(Math.atan2(
          cam.getWorldDirection(new Box()).x, cam.getWorldDirection(new Box()).z) * 180 / Math.PI) });
      if (g.story.name !== 'drowned' || t > seconds || !drawn) { state.done = true; return; }
      if (++count % every === 0 && birches.objects.some(o => o.visible)) {
        params.hold = 0;
        state.pending = { t, frame: __stats.frame, boatZ: boat.z, away };
      }
    };
  }, { every, seconds });
  const shot = () => page.screenshot();
  const raf = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const diff = (a, b) => {
    const x = decodePng(a), y = decodePng(b);
    let changed = 0, max = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      let d = 0;
      for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(x.data[i + k] - y.data[i + k]));
      if (d) changed++;
      max = Math.max(max, d);
    }
    return { changed, max };
  };
  for (;;) {
    const status = await page.evaluate(() => ({ done: __drift.done, pending: __drift.pending }));
    if (status.done) break;
    if (!status.pending) { await page.waitForTimeout(50); continue; }
    await page.evaluate(() => __drift.redraw());
    await raf();
    const a = await shot();
    await page.evaluate(() => __drift.redraw());
    await raf();
    const control = await shot();
    await page.evaluate(() => { __drift.hidden = __game.birches.objects.filter(o => o.visible); for (const o of __drift.hidden) o.visible = false; __drift.redraw(); });
    await raf();
    const b = await shot();
    await page.evaluate(() => { for (const o of __drift.hidden) o.visible = true; __drift.pending = null; __drift.params.hold = null; });
    const sample = { ...status.pending, control: diff(a, control), hidden: diff(a, b) };
    if (sample.hidden.changed) fs.writeFileSync(`${prefix}-${sample.frame}-with.png`, a), fs.writeFileSync(`${prefix}-${sample.frame}-without.png`, b);
    report.samples.push(sample);
    console.log(JSON.stringify(sample));
  }
  report.frames = await page.evaluate(() => __drift.frames);
} finally { await close(); }
const near = report.frames.filter(f => f.near && f.drawn);
report.summary = {
  frames: report.frames.length, samples: report.samples.length,
  visibleSamples: report.samples.filter(s => s.hidden.changed).length,
  controlChanged: report.samples.filter(s => s.control.changed).length,
  nearFrames: near.length, nearUntil: near.at(-1)?.t ?? null, drawnUntil: report.frames.filter(f => f.drawn).at(-1)?.t ?? null,
  firstVisible: report.samples.find(s => s.hidden.changed)?.t ?? null, lastVisible: report.samples.filter(s => s.hidden.changed).at(-1)?.t ?? null,
};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary));

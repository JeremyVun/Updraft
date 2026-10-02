// Auto on a throttled GPU, in the real game with real frame pacing: the descent through every level as the load
// grows, holding where a level fits, and the climb back once the load lifts.
// The throttle is real GPU work drawn before each frame's fence (a fragment loop over a target the size of the
// canvas), so it scales with the level's pixels as a weak GPU's frame does. It does not model a weak device's script.
// Needs the dev server (it patches main.ts) and a GPU nobody else is using.
// Usage: node tools/quality-budget-profile.mjs [chapter]   env: BASE, OUT (default /tmp/updraft-quality-budget)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const out = process.env.OUT ?? '/tmp/updraft-quality-budget';
const chapter = process.argv[2] ?? 'island';
const ORDER = ['ultra', 'high', 'medium', 'low'];
const LOAD = `
const loadMaterial = new THREE.ShaderMaterial({
  uniforms: { uLoad: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform int uLoad; varying vec2 vUv; void main() { vec3 c = vec3(vUv, 0.5); for (int i = 0; i < 200000; i++) { if (i >= uLoad) break; c = fract(sin(c.yzx * 12.9898 + float(i)) * 43758.5453); } gl_FragColor = vec4(c, 1.0); }',
});
const loadScene = new THREE.Scene();
const loadQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), loadMaterial);
loadQuad.frustumCulled = false;
loadScene.add(loadQuad);
const loadCamera = new THREE.Camera();
const loadTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
const loadSize = new THREE.Vector2();
const loadGpu = quality.gpu.bind(quality);
quality.gpu = early => { window.__load.fence[early === null ? 'untimed' : early ? 'early' : 'late']++; loadGpu(early); };
window.__load = {
  n: 0, fence: { early: 0, late: 0, untimed: 0 }, frames: 0,
  take() { const taken = { ...this.fence, frames: this.frames }; this.fence = { early: 0, late: 0, untimed: 0 }; this.frames = 0; return taken; },
  draw() {
    this.frames++;
    const n = Math.round(this.n);
    if (n <= 0) return;
    renderer.getDrawingBufferSize(loadSize);
    if (loadTarget.width !== loadSize.x || loadTarget.height !== loadSize.y) loadTarget.setSize(loadSize.x, loadSize.y);
    loadMaterial.uniforms.uLoad.value = n;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(loadTarget);
    renderer.render(loadScene, loadCamera);
    renderer.setRenderTarget(previous);
  },
};`;

const rows = [], changes = [], failedAt = {};
const { browser, close } = await openBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await withoutHotReload(page);
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    let source = await response.text();
    const shot = 'if (QA && params.shot) {', fence = /endFrame\(renderer\);(\s+if \(quality\.probing\))/;
    assert(source.includes(shot) && fence.test(source), 'Missing hook');
    source = source.replaceAll(shot, 'if (true) {').replace(fence, 'window.__load.draw(); endFrame(renderer);$1');
    await route.fulfill({ response, body: source + LOAD });
  });
  await page.goto(`${base}?analytics=0&progress=0${chapter === 'island' ? '' : '&chapter=' + chapter}`);
  await page.waitForSelector('#veil.ready', { timeout: 120000 });
  await page.locator('#begin').click();
  await page.waitForSelector('#veil', { state: 'detached' });
  assert.equal(await page.evaluate(() => __game.quality.mode), 'auto');
  // Compile the throttle's program before anything is judged.
  await page.evaluate(() => new Promise(resolve => { __load.n = 1; setTimeout(() => { __load.n = 0; resolve(); }, 500); }));
  await page.waitForTimeout(4000);

  const state = () => page.evaluate(() => ({ now: performance.now(), name: __game.quality.level.name, n: __load.n, ...__load.take() }));
  const setLoad = n => page.evaluate(n => { __load.n = n; }, n);
  let last = (await state()).name, phase = 'open';
  const started = (await state()).now;
  // One sample every 250 ms: the level in use, frames presented and how their fences were timed, and each change with the load that caused it.
  const sample = async () => {
    const s = await state();
    s.changed = s.name !== last;
    if (s.changed) {
      changes.push({ phase, at: Math.round(s.now - started), from: last, to: s.name, load: Math.round(s.n) });
      console.log(`${phase.padEnd(8)} ${String(Math.round((s.now - started) / 100) / 10).padStart(6)} s  ${last} -> ${s.name}  (load ${Math.round(s.n)})`);
      last = s.name;
    }
    rows.push({ phase, at: Math.round(s.now - started), name: s.name, load: Math.round(s.n), frames: s.frames, early: s.early, late: s.late, untimed: s.untimed });
    return s;
  };
  const watch = async (ms, each) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const s = await sample();
      if (each && await each(s) === false) return;
      await page.waitForTimeout(250);
    }
  };
  const during = name => changes.filter(change => change.phase === name);
  const path = name => [during(name)[0]?.from, ...during(name).map(change => change.to)].join(' ');

  assert.equal(last, 'ultra', 'Auto opens at Ultra on this display');
  await watch(6000);
  assert.equal(changes.length, 0, 'unloaded, Auto holds Ultra');

  // Descent: the load grows slowly, and rests for a while after each step so the new level is judged on its own.
  phase = 'descent';
  let load = 16, restUntil = 0;
  await watch(240000, async s => {
    if (s.changed) {
      failedAt[changes.at(-1).from] ??= load;
      restUntil = Date.now() + 4000;
    }
    if (s.name === 'low') return false;
    if (Date.now() > restUntil) { load *= 1.03; await setLoad(load); }
  });
  assert.equal(path('descent'), ORDER.join(' '), 'under a growing load Auto steps down through every level in order');

  // The load that pushed Medium over stays: Low holds it, with at most one failed look back at Medium.
  phase = 'hold';
  await watch(25000);
  assert(during('hold').length <= 2, `Low holds under the load that needed it: ${path('hold')}`);

  // The load lifts: Auto climbs back through every level and stays at the top.
  phase = 'climb';
  await setLoad(0);
  const liftedAt = (await state()).now - started;
  let topAt = 0;
  await watch(120000, s => { if (s.name === 'ultra') { topAt = s.now - started; return false; } });
  assert(topAt, `Auto did not return to Ultra within two minutes: ${path('climb')}`);
  const climbed = during('climb');
  assert(climbed.every(change => ORDER.indexOf(change.to) === ORDER.indexOf(change.from) - 1), `the climb goes up one level at a time and never back down: ${path('climb')}`);
  phase = 'top';
  await watch(15000);
  assert.equal(during('top').length, 0, 'back at Ultra, Auto stays there');

  // A load Medium cannot carry but Low can: Auto settles at Low and does not swing between them.
  phase = 'boundary';
  await setLoad(failedAt.medium * 1.15);
  await watch(75000);
  const boundary = during('boundary');
  const settled = boundary.findIndex(change => change.to === 'low');
  assert(settled >= 0, `Auto did not settle at Low: ${path('boundary')}`);
  const after = boundary.slice(settled + 1);
  assert(after.every(change => change.to === 'low' || change.to === 'medium'), `a failed climb out of Low returns to Low, never below: ${path('boundary')}`);
  assert(after.filter(change => change.to === 'medium').length <= 2, `failed climbs into Medium back off: ${path('boundary')}`);
  assert.equal(last, 'low', `Auto rests at the level that holds: ${path('boundary')}`);

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ chapter, failedAt: Object.fromEntries(Object.entries(failedAt).map(([k, v]) => [k, Math.round(v)])),
    descent: path('descent'), hold: path('hold') || 'low', climb: path('climb'), climbSeconds: Math.round((topAt - liftedAt) / 100) / 10,
    boundary: path('boundary'), trace: `${out}-auto.json` }));
  console.log('Auto under a throttled GPU: Ultra, High, Medium and Low in order, holding under load, climbing back one level at a time, and resting at Low where Medium cannot hold.');
} finally {
  await fs.writeFile(`${out}-auto.json`, JSON.stringify({ chapter, changes, failedAt, rows: rows.map(row => JSON.stringify(row)) }, null, 1));
  await close();
}

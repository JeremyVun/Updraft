// Paired GPU cost of the distant-height lookup in the window-move bakes and the light bake, loop paused.
// Usage: node tools/terrain-heights-bench.mjs [chapter...]   (default meadow boats)
//   VARIANT=direct  the atlas off (uTerrainHeightsReady 0), so every lookup beyond the window calls worldHeight;
//   VARIANT=const   the step-1 upper bound: the light bake's lookups beyond the window return the open-sea floor.
//   Stages, each timed from submission to GPU completion: a whole forced window move, then height, light, shore
//   and grass-table stages alone, then the light bake with the sun stepped through a sunset arc (a fixed dusk
//   never re-bakes it). Rounds alternate ABBA so both sides share the GPU state; every round's times are kept.
//   env: BASE (default http://127.0.0.1:5230/), ROUNDS (4), COUNT (8 per stage per side), ARC (24 steps),
//        OUT (JSON path). Takes the shared browser lock. Other GPU users inflate every number: check `ps` first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';

const variant = process.env.VARIANT ?? 'direct';
assert(['direct', 'const'].includes(variant), `unknown VARIANT ${variant}`);
const chapters = process.argv.slice(2).length ? process.argv.slice(2) : ['meadow', 'boats'];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const { browser, close } = await openBrowser();
const report = [];
try {
  for (const chapter of chapters) {
    const page = await browser.newPage({ viewport: { width: 1376, height: 1032 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
    await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/src/main.ts*', async (route) => {
      const response = await route.fetch();
      let source = await response.text();
      const hook = 'function frame(now) {';
      assert(source.includes(hook));
      source = source.replace(hook, hook + ' if(window.__benchPaused){requestAnimationFrame(frame);return;}');
      source += '\nwindow.__bench={bakes,water,grass,terrain,atmo};';
      await route.fulfill({ response, body: source });
    });
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&ratio=1.5&msaa=2&analytics=0&progress=0${chapter === 'island' ? '' : '&chapter=' + chapter}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const result = await page.evaluate(async ({ variant, rounds, count, arc }) => {
      window.__benchPaused = true;
      const { renderer, child } = __game, { bakes, water, grass, terrain, atmo } = __bench, gl = renderer.getContext();
      const channel = new MessageChannel();
      const yieldTask = () => new Promise((r) => { channel.port1.onmessage = r; channel.port2.postMessage(0); });
      const idle = async () => {
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        for (;;) {
          const s = gl.clientWaitSync(fence, 0, 0);
          if (s === gl.ALREADY_SIGNALED || s === gl.CONDITION_SATISFIED) break;
          await yieldTask();
        }
        gl.deleteSync(fence);
      };
      const { followWindow, WINDOW } = await import('/src/world/window.ts');
      const light = bakes.groundMat, original = light.fragmentShader;
      const ready = terrain.heights?.uniforms.uTerrainHeightsReady;
      const apply = (on) => {
        if (variant === 'direct') { assert(ready, 'no atlas to switch off'); ready.value = on ? 0 : 1; return; }
        const from = 'return worldHeight(p);';
        if (!original.includes(from)) throw Error('light bake hook missing');
        const source = on ? original.replace(from, 'return -5.1198557;') : original;
        if (light.fragmentShader !== source) { light.fragmentShader = source; light.needsUpdate = true; }
      };
      function assert(v, m) { if (!v) throw Error(m); }
      const x = child.position.x, z = child.position.z;
      const sun = atmo.uniforms.uSunDir.value, sun0 = sun.clone(), az = Math.atan2(sun0.z, sun0.x);
      const stages = {
        move: (i) => followWindow(x + (i % 2 ? 40 : 0), z + (i % 4 < 2 ? 0 : 40), true),
        height: () => { bakes.gpu.run(bakes.heightMat, bakes.heights); bakes.gpu.run(bakes.normalMat, bakes.height); },
        light: () => bakes.gpu.run(bakes.groundMat, bakes.ground),
        shore: () => water.bakeShore(WINDOW.size),
        grass: () => { grass.tablesDirty = true; grass.bake(renderer); },
        sunset: (i) => {
          const e = (30 - 28 * (i % arc) / (arc - 1)) * Math.PI / 180;
          sun.set(Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az));
          bakes.bakeLight({ occluders: [], clearings: [], flowers: [] });
        },
      };
      const times = Object.fromEntries(Object.keys(stages).map((k) => [k, { base: [], variant: [] }]));
      for (const on of [false, true]) { apply(on); for (const run of Object.values(stages)) run(0); sun.copy(sun0); await idle(); }
      for (let round = 0; round < rounds; round++) {
        for (const on of round % 2 ? [true, false, false, true] : [false, true, true, false]) {
          apply(on);
          sun.copy(sun0);
          for (const [name, run] of Object.entries(stages)) {
            const n = name === 'sunset' ? arc : count;
            let total = 0;
            for (let i = 0; i < n; i++) {
              await idle();
              const started = performance.now();
              run(i);
              await idle();
              total += performance.now() - started;
            }
            times[name][on ? 'variant' : 'base'].push(total / n);
          }
        }
      }
      apply(false);
      sun.copy(sun0);
      followWindow(x, z, true);
      await idle();
      window.__benchPaused = false;
      return times;
    }, { variant, rounds: Number(process.env.ROUNDS ?? 4), count: Number(process.env.COUNT ?? 8), arc: Number(process.env.ARC ?? 24) });
    const rows = Object.fromEntries(Object.entries(result).map(([k, v]) => {
      const pairs = [];
      for (let i = 0; i < v.base.length; i += 2) pairs.push({ base: (v.base[i] + v.base[i + 1]) / 2, variant: (v.variant[i] + v.variant[i + 1]) / 2 });
      const saved = pairs.map((p) => p.base - p.variant), baselines = pairs.map((p) => p.base);
      return [k, { baseMs: median(baselines), variantMs: median(pairs.map((p) => p.variant)), savedMs: median(saved),
        percent: median(pairs.map((p) => (1 - p.variant / p.base) * 100)), rangeMs: [Math.min(...saved), Math.max(...saved)],
        baselines, straddle: Math.max(...baselines) / Math.min(...baselines) > 1.4 }];
    }));
    const round = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
    report.push(round({ chapter, variant, rows, raw: result, errors }));
    console.log(JSON.stringify(round({ chapter, variant, rows: Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, { ...r, baselines: undefined }])) })));
    for (const [k, r] of Object.entries(rows)) if (r.straddle) console.warn(`WARNING ${chapter} ${k}: baselines straddle GPU states (${r.baselines.map((b) => b.toFixed(1)).join(', ')}); repeat it`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  await fs.writeFile(process.env.OUT ?? `/tmp/updraft-terrain-heights-bench-${variant}.json`, JSON.stringify(report, null, 2));
} finally {
  await close();
}

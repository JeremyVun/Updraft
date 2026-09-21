// Frozen-camera A/B/B/A completed-work measurements, including the wind solver,
// reflection and post chain. These are throughput costs, not gameplay fps or watts.
// Usage: node tools/power-profile.mjs [island meadow sea mirror wood]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
const report = [];
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
try {
  for (const chapter of process.argv.slice(2).length ? process.argv.slice(2) : ['island', 'meadow', 'sea', 'mirror', 'wood']) {
    const page = await browser.newPage({ viewport: { width: 1376, height: 1032 }, deviceScaleFactor: 2, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
    await page.route('**/@vite/client', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch();
      let body = await response.text();
      const hold = 'if (params.hold !== null && frameIndex >= params.hold) {';
      assert(body.includes(hold));
      body = body.replace(hold, hold + ' if (window.__powerProbe?.paused) { requestAnimationFrame(frame); return; }');
      body += `\nwindow.__powerProbe = { paused: false,
        configure(v) {
          pixelRatio = v.ratio; post.samples = v.samples ?? 2; resize();
          const material = water.mesh.material;
          this.fragment ??= material.fragmentShader;
          material.fragmentShader = this.fragment;
          if (v.fullWater || v.fullFog) material.fragmentShader = material.fragmentShader.replace('if (fog.a == 1.0 && glass <= 0.001)', 'if (false)');
          if (v.fullWater || v.fullMirror) material.fragmentShader = material.fragmentShader.replace('if (glass == 1.0)', 'if (false)');
          material.needsUpdate = true;
        },
        draw(simulate = true) {
          renderer.info.reset();
          if (simulate) wind.step(1/60, time, false);
          water.update(rig.camera, c => terrain.beginMirror(c), () => terrain.endMirror());
          post.render(time);
        }
      };`;
      await route.fulfill({ response, body });
    });
    await page.goto(base + '?shot&hold=120&ratio=1.25&msaa=2&analytics=0&progress=0' + (chapter === 'island' ? '' : '&chapter=' + chapter));
    await page.waitForFunction(() => window.__stats?.frame >= 120, null, { timeout: 120000 });
    await page.evaluate(() => { __powerProbe.paused = true; });
    // The shader change must preserve pixels at an identical resolution and state.
    const pixels = await page.evaluate(() => {
      const gl = __game.renderer.getContext();
      const read = fullWater => {
        __powerProbe.configure({ ratio: 1.25, fullWater }); __powerProbe.draw(false);
        const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
        return data;
      };
      const appearance = __game.water.skyMirrorAppearance;
      const states = [];
      for (const value of [appearance, .999, .5, 0]) {
        __game.water.skyMirrorAppearance = value;
        const a = read(true), b = read(false);
        let changed = 0, sum = 0, max = 0;
        for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) changed++; sum += d; max = Math.max(max, d); }
        states.push({ appearance: value, changed, mean: sum / a.length, max });
      }
      __game.water.skyMirrorAppearance = appearance;
      return { ...states[0], transitions: states.slice(1) };
    });
    for (const state of [pixels, ...pixels.transitions]) {
      assert(state.mean < .05 && state.max <= 3, JSON.stringify({ chapter, state }));
    }
    if (process.env.PAIR === 'parity') {
      report.push({ chapter, pixels });
      console.log(JSON.stringify({ chapter, pixels }));
    }
    for (const [name, ratio] of [['auto', 1.25], ['high', 1.5], ['retina', 2]]) {
      await page.evaluate(ratio => { __powerProbe.configure({ ratio }); __powerProbe.draw(false); }, ratio);
      await page.screenshot({ path: `/tmp/updraft-power-${chapter}-${name}.png` });
    }
    const pairs = [
      { name: 'water-fog', a: { ratio: 1.25, fullFog: true }, b: { ratio: 1.25 } },
      { name: 'mirror-shading', a: { ratio: 1.5, fullMirror: true }, b: { ratio: 1.5 } },
      { name: 'retina-to-auto', a: { ratio: 2, fullWater: true }, b: { ratio: 1.25 } },
      { name: 'retina-to-high', a: { ratio: 2, fullWater: true }, b: { ratio: 1.5 } },
    ];
    for (const pair of pairs.filter(p => !process.env.PAIR || p.name === process.env.PAIR)) {
      const runs = await page.evaluate(async pair => {
        const gl = __game.renderer.getContext();
        async function complete() {
          const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
          const until = performance.now() + 20000;
          try {
            for (;;) {
              const status = gl.clientWaitSync(fence, 0, 0);
              if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return;
              if (status === gl.WAIT_FAILED || performance.now() > until) throw Error('GPU fence failed');
              await new Promise(r => setTimeout(r, 0));
            }
          } finally { gl.deleteSync(fence); }
        }
        async function measure(v) {
          __powerProbe.configure(v);
          for (let i = 0; i < 3; i++) __powerProbe.draw();
          await complete();
          const start = performance.now();
          for (let i = 0; i < 12; i++) __powerProbe.draw();
          await complete();
          return (performance.now() - start) / 12;
        }
        const runs = [];
        for (let round = 0; round < 5; round++) {
          const order = round % 2 ? ['b', 'a', 'a', 'b'] : ['a', 'b', 'b', 'a'];
          const samples = { a: [], b: [] };
          for (const key of order) samples[key].push(await measure(pair[key]));
          const a = (samples.a[0] + samples.a[1]) / 2, b = (samples.b[0] + samples.b[1]) / 2;
          runs.push({ a, b, delta: b - a, percent: (b / a - 1) * 100 });
        }
        return runs;
      }, pair);
      const row = { chapter, pair: pair.name, pixels, beforeMs: median(runs.map(r => r.a)), afterMs: median(runs.map(r => r.b)),
        deltaMs: median(runs.map(r => r.delta)), percent: median(runs.map(r => r.percent)),
        rangeMs: [Math.min(...runs.map(r => r.delta)), Math.max(...runs.map(r => r.delta))], runs };
      report.push(row); console.log(JSON.stringify({ ...row, runs: undefined }));
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  await fs.writeFile(`/tmp/updraft-power-profile${process.env.PAIR ? '-' + process.env.PAIR : ''}.json`, JSON.stringify(report, null, 2));
} finally { await close(); }

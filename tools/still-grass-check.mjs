// Compare relocated Still grass against an independently built, pre-relocation baseline.
// COMPARE_BASE=http://127.0.0.1:5251 BASE=http://127.0.0.1:5252 node tools/still-grass-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';

assert(process.env.COMPARE_BASE, 'COMPARE_BASE must serve a pre-relocation QA build');
const out = process.env.OUT ?? '/tmp/updraft-still-grass';
fs.mkdirSync(out, { recursive: true });
const { browser, close } = await openBrowser();
const captures = [];
try {
  for (const [name, base, shift] of [
    ['accepted', process.env.COMPARE_BASE, 0],
    ...(process.env.BROKEN_BASE ? [['broken', process.env.BROKEN_BASE, 200]] : []),
    ['fixed', process.env.BASE ?? 'http://127.0.0.1:5230', 200],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text()); });
    await page.addInitScript(() => {
      let seed = 1234567;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(time => {
        if (window.__stats?.frame >= 45) { window.__frozen = true; return; }
        callback(time);
      });
    });
    await page.goto(`${base}/?shot=1&ratio=1&msaa=4&grass=1&analytics=0&progress=0`);
    await page.waitForFunction(() => window.__frozen, null, { polling: 50, timeout: 180000 });
    await page.evaluate(shift => {
      const g = __game, camera = g.rig.camera, u = g.grass.lods[0].tableMat.uniforms;
      u.uTrodden.value.w = 0;
      g.life.regions.island.w = 1;
      camera.position.set(20, 48, 55 + shift);
      camera.lookAt(-8, 5, -15 + shift);
      camera.updateMatrixWorld(true);
      g.grass.setQuality(1, 1, true);
      g.terrain.update(camera); g.grass.update(camera);
      g.scene.onBeforeRender(g.renderer, g.scene, camera, null);
      g.grass.bake(g.renderer);
      g.water.update(camera, c => g.terrain.beginMirror(c), () => g.terrain.endMirror());
      g.post.render(__stats.time);
    }, shift);
    await page.screenshot({ path: `${out}/${name}.png` });
    const tables = await page.evaluate(shift => {
      const { grass, renderer } = __game;
      const tiles = [];
      for (let z = -64; z <= 32; z += 24) for (let x = -64; x <= 56; x += 24) tiles.push(x, z + shift);
      for (const lod of grass.lods) {
        lod.tiles.array.set(tiles); lod.tileTex.needsUpdate = true;
        lod.count = tiles.length / 2; lod.dirty = true;
      }
      grass.bake(renderer);
      return grass.lods.map(lod => {
        const blades = lod.count * lod.spec.cols * lod.spec.rows, rows = Math.ceil(blades / 1024);
        return [0, 1, 2, 3].map(attachment => {
          const data = attachment === 2 ? new Uint32Array(1024 * rows * 4) : new Float32Array(1024 * rows * 4);
          renderer.readRenderTargetPixels(lod.table, 0, 0, 1024, rows, data, undefined, attachment);
          if (attachment === 0) for (let i = 1; i < blades * 4; i += 4) data[i] -= shift;
          return Array.from(data.subarray(0, blades * 4));
        });
      });
    }, shift);
    assert.deepEqual(errors, [], `${name}: browser errors`);
    captures.push({ name, tables });
    await page.close();
  }
  const baseline = captures[0].tables, report = [];
  const half = n => { const e = n >> 10 & 31, m = n & 1023; return (n & 32768 ? -1 : 1) * (e ? (1 + m / 1024) * 2 ** (e - 15) : m * 2 ** -24); };
  for (const { name, tables } of captures.slice(1)) {
    const levels = tables.map((attachments, level) => attachments.map((values, attachment) => {
      let max = 0, sum = 0, changed = 0;
      values.forEach((v, i) => {
        const b = baseline[level][attachment][i];
        const d = attachment === 2 ? Math.max(Math.abs(half(v & 65535) - half(b & 65535)), Math.abs(half(v >>> 16) - half(b >>> 16))) : Math.abs(v - b);
        max = Math.max(max, d); sum += d; if (d > 0.001) changed++;
      });
      return { max, mean: sum / values.length, changed };
    }));
    report.push({ name, levels });
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  const fixed = report.find(r => r.name === 'fixed');
  for (const [level, attachments] of fixed.levels.entries()) for (const [attachment, stats] of attachments.entries()) {
    assert(stats.max < (attachment === 2 ? 0.001 : 0.002), `level ${level}, attachment ${attachment}: ${JSON.stringify(stats)}`);
  }
} finally { await close(); }

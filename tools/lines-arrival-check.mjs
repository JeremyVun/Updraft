// Sail into Lines and compare the rendered beach with its unclipped geometry through the chapter handoff.
// BASE=http://127.0.0.1:5243 node tools/lines-arrival-check.mjs /tmp/lines-arrival
// FULL=1 includes the whole crossing; NEGATIVE=1 reinstates the obsolete island cutoff.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const out = process.argv[2] ?? fs.mkdtempSync('/tmp/updraft-lines-arrival-');
fs.mkdirSync(out, { recursive: true });
const { browser, close } = await openBrowser();
const reports = [];
try {
  for (const [width, height] of [[1869, 549], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await withoutHotReload(page);
    await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot&chapter=crossing&progress=0&ratio=1`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await page.evaluate(async ({ full, negative }) => {
      const source = await (await fetch('/src/world/atmosphere.ts')).text();
      const THREE = await import(source.match(/from ["']([^"']*three[^"']*)["']/)[1]);
      const { ISLES } = await import('/src/world/heightfield.ts');
      const g = __game;
      if (!full) {
        g.story.sail(18, -180, Math.PI);
        g.story.current.restoreCheckpoint('entry', [4, 105]);
        g.story.current.update(0, __stats.time);
        g.rig.cut(g.story.current.shot);
      }
      const target = new THREE.WebGLRenderTarget(640, Math.round(640 * innerHeight / innerWidth));
      const actual = new Uint8Array(target.width * target.height * 4);
      const reference = new Uint8Array(actual.length);
      const render = g.renderer.render.bind(g.renderer);
      let last = -Infinity;
      window.__arrivalSamples = [];
      g.renderer.render = (scene, camera) => {
        render(scene, camera);
        if (scene !== g.scene || camera !== g.rig.camera || __stats.time - last < .5
          || g.boat.position.z > -195 || !['toLines', 'lines'].includes(g.story.name)) return;
        last = __stats.time;
        const room = g.terrain.mesh.material.uniforms.uRoom.value;
        const savedRoom = room.clone(), savedTarget = g.renderer.getRenderTarget();
        try {
          if (negative && g.story.name === 'lines') room.set(ISLES.lines.x, ISLES.lines.z, 96);
          g.renderer.setRenderTarget(target);
          render(scene, camera);
          g.renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, actual);
          room.set(0, 0, 0);
          render(scene, camera);
          g.renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, reference);
          let changed = 0, max = 0;
          for (let i = 0; i < actual.length; i += 4) {
            const delta = Math.max(...[0, 1, 2].map(c => Math.abs(actual[i + c] - reference[i + c])));
            if (delta > 3) changed++;
            max = Math.max(max, delta);
          }
          window.__arrivalSamples.push({ time: __stats.time, chapter: g.story.name, beat: g.story.current.beat,
            changed, max, boat: g.boat.position.toArray(), room: savedRoom.toArray() });
        } finally {
          room.copy(savedRoom);
          g.renderer.setRenderTarget(savedTarget);
        }
      };
    }, { full: !!process.env.FULL, negative: !!process.env.NEGATIVE });
    await page.waitForFunction(() => __game.boat.position.z < -197, null, { timeout: 180000 });
    await page.screenshot({ path: `${out}/${width}-approach.png` });
    await page.waitForFunction(() => __game.story.name === 'lines', null, { timeout: 60000 });
    for (let i = 0; i < 12; i++) {
      await page.screenshot({ path: `${out}/${width}-landing-${String(i).padStart(2, '0')}.png` });
      await page.waitForTimeout(250);
    }
    await page.waitForFunction(() => __game.story.current.beat === 'curtain', null, { timeout: 60000 });
    await page.screenshot({ path: `${out}/${width}-ashore.png` });
    const samples = await page.evaluate(() => window.__arrivalSamples);
    reports.push({ width, height, full: !!process.env.FULL, samples, errors });
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(reports, null, 2));
    assert(samples.some(s => s.chapter === 'toLines') && samples.some(s => s.beat === 'ashore'), 'sample both sides of landing');
    assert.deepEqual(errors, []);
    assert.deepEqual(samples.filter(s => s.changed > 0), [], 'room clipping must not remove visible arrival terrain');
    await page.close();
    console.log(`PASS: ${width}×${height} arrival, ${samples.length} rendered comparisons`);
  }
} finally {
  await close();
}

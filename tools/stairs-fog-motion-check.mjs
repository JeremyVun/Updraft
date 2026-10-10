// Compare moving cloud-chapter frames with the original analytic fog at the same world state.
// BASE selects Vite; OUT saves representative before/reference frames. Covers checkpoint cameras and a slow pan.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowser } from './lib/browser.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const prefix = process.env.OUT ?? '/tmp/updraft-stairs-fog-motion';
const { browser, close } = await openBrowser();
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
  await page.route('**/src/main.ts', async route => {
    const response = await route.fetch();
    const body = await response.text();
    assert(body.includes('function drawRooms(') && body.includes('function frame('), 'instrument the real frame loop');
    await route.fulfill({ response, body: body + `
      window.__fogMotion = {
        step() {
          const before = frameIndex;
          frame(Math.max(performance.now(), last + 1000 / 60));
          if (frameIndex !== before + 1) throw new Error('The motion fixture did not advance a game frame');
        },
        draw() {
          terrain.update(rig.camera); grass.update(rig.camera, 0);
          fogLookup.beginFrame(); fogLookup.bake(rig.camera); grass.bake(renderer);
          water.frame = 0;
          drawJourneyRooms(journeyReveal.visible, roomObjects, drawRooms);
        }
      };` });
  });
  await page.addInitScript(() => {
    let seed = 1234567;
    Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      if (window.__frozen) return 0;
      return raf(now => { if (window.__stats?.frame >= 120) window.__frozen = true; else callback(now); });
    };
  });
  await page.goto(`${base}?shot&chapter=stairs&ratio=1&msaa=4&analytics=0&progress=0`);
  await page.waitForFunction(() => window.__frozen, null, { polling: 50, timeout: 180000 });
  await page.evaluate(() => {
    const g = __game;
    window.__fogMaterials = new Map();
    const add = m => { if (m && [m.vertexShader, m.fragmentShader].some(s => s?.includes('vec4 cloudDeck('))) __fogMaterials.set(m, m.defines.FOG_LOOKUP); };
    g.scene.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : [o.material]) add(m); });
    for (const lod of g.grass.lods) { add(lod.frameMat); add(lod.tableMat); }
    window.__fogSelect = analytic => {
      for (const [material, original] of __fogMaterials) {
        const next = analytic ? 0 : original;
        if (next === undefined) delete material.defines.FOG_LOOKUP; else material.defines.FOG_LOOKUP = next;
        material.needsUpdate = true;
      }
    };
    window.__fogRead = () => {
      __fogMotion.draw();
      const gl = g.renderer.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
  });
  for (const [checkpoint, width, height] of [[0, 1920, 1080], [2, 1920, 1080], [3, 1920, 1080], [0, 3776, 1094]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(n => { __game.story.current.restoreCheckpoint(`flight-${n}`, [n]); }, checkpoint);
    for (let k = 0; k < 120; k++) await page.evaluate(() => __fogMotion.step());
    const state = await page.evaluate(() => {
      const g = __game; window.__fogPose = { p: g.rig.camera.position.clone(), q: g.rig.camera.quaternion.clone() };
      return { chapter: g.story.name, beat: g.story.current.beat, camera: g.rig.camera.position.toArray(), mist: g.water.mesh.material.uniforms.uSeaFogShape.value.w };
    });
    assert.equal(state.chapter, 'stairs');
    assert.equal(state.mist, 0, 'the reference differs only in cloud sampling');
    let max = 0, total = 0;
    for (let k = 0; k < 24; k++) {
      const sample = await page.evaluate(k => {
        __fogMotion.step();
        const camera = __game.rig.camera, phase = k / 23 * Math.PI * 2;
        camera.position.copy(__fogPose.p); camera.quaternion.copy(__fogPose.q);
        camera.position.x += Math.sin(phase) * .7; camera.rotateY(Math.sin(phase) * .025); camera.updateMatrixWorld(true);
        __fogSelect(false); const a = __fogRead();
        __fogSelect(true); const b = __fogRead();
        let max = 0, total = 0;
        for (let i = 0; i < a.length; i++) if (i % 4 !== 3) { const d = Math.abs(a[i] - b[i]); max = Math.max(max, d); total += d; }
        return { max, mean: total / (a.length / 4 * 3) };
      }, k);
      max = Math.max(max, sample.max); total += sample.mean;
      if (k === 0) {
        await page.screenshot({ path: `${prefix}-${checkpoint}-${width}-reference.png` });
        await page.evaluate(() => { __fogSelect(false); __fogMotion.draw(); });
        await page.screenshot({ path: `${prefix}-${checkpoint}-${width}-current.png` });
      }
    }
    await page.evaluate(() => __fogSelect(false));
    const entry = { checkpoint, width, height, frames: 24, maxChannelDelta: max, meanChannelDelta: total / 24, state };
    results.push(entry); fs.writeFileSync(prefix + '.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(entry));
    assert(max <= 2, 'cloud motion must match the original per-ray fog, including its edges');
  }
  assert.deepEqual(errors, []);
} finally { await close(); }

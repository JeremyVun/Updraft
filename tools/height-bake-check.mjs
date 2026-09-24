// Checks the two-pass window height bake against the single-pass bake it replaced, texel for texel.
// Windows set across the world (the real move path, loop paused), then real moves during a Meadow walk.
// Usage: node tools/height-bake-check.mjs; env BASE (dev server), OUT (JSON path), WALK_MS (default 60000),
//   MUTATE=margin|half|border breaks the new pass on purpose to prove the check fails.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';

// The single-pass shader as it was at fe07116: the centre and four neighbours at p ± e, all from worldHeight.
const OLD_HEIGHT_FRAG = `
uniform vec4 uDomain;
in vec2 vUv;
void main() {
  vec2 p = vUv / uDomain.zw + uDomain.xy;
  float e = 1.0 / (uDomain.z * 512.0);
  float h = worldHeight(p);
  float hl = worldHeight(p - vec2(e, 0.0));
  float hr = worldHeight(p + vec2(e, 0.0));
  float hb = worldHeight(p - vec2(0.0, e));
  float ht = worldHeight(p + vec2(0.0, e));
  gl_FragColor = vec4(h, normalize(vec3(hl - hr, 2.0 * e, hb - ht)));
}`;
const MUTATIONS = {
  margin: ['ivec2 c = ivec2(gl_FragCoord.xy) + 1;', 'ivec2 c = ivec2(gl_FragCoord.xy) + 2;'],
  half: ['vec2 uv = (gl_FragCoord.xy - 1.0)', 'vec2 uv = (gl_FragCoord.xy - 1.5)'],
  // The margin repeats the edge heights, as a clamped read would: only the border normals go wrong.
  border: ['vec2 uv = (gl_FragCoord.xy - 1.0)', 'vec2 uv = (clamp(gl_FragCoord.xy, 1.5, 512.5) - 1.0)'],
};

const { browser, close } = await openBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1376, height: 1032 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    let source = await response.text();
    const hook = 'function frame(now) {';
    assert(source.includes(hook));
    source = source.replace(hook, hook + ' if(window.__heightPaused){requestAnimationFrame(frame);return;}');
    source += '\nwindow.__heightTest={THREE,bakes};';
    await route.fulfill({ response, body: source });
  });
  const mutation = MUTATIONS[process.env.MUTATE];
  if (process.env.MUTATE) assert(mutation, `unknown MUTATE ${process.env.MUTATE}`);
  if (mutation) await page.route('**/src/world/ground.ts*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    assert(source.includes(mutation[0]), 'mutation hook missing');
    await route.fulfill({ response, body: source.replace(mutation[0], mutation[1]) });
  });
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '?shot&chapter=meadow&analytics=0&progress=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });

  await page.evaluate(async (OLD_HEIGHT_FRAG) => {
    const { THREE, bakes } = window.__heightTest, { renderer } = window.__game;
    const { GpuRunner, simMaterial, simTarget } = await import('/src/gl/gpu.ts');
    const { HEIGHTFIELD_GLSL } = await import('/src/world/heightfield.ts');
    const { atmo } = await import('/src/world/atmosphere.ts');
    const { WINDOW, onWindowMove } = await import('/src/world/window.ts');
    const gpu = new GpuRunner(renderer), RES = 512;
    const old = simMaterial(HEIGHTFIELD_GLSL + OLD_HEIGHT_FRAG, { uDomain: atmo.uniforms.uDomain });
    const target = simTarget(RES, RES, THREE.FloatType, THREE.NearestFilter);
    const a = new Float32Array(RES * RES * 4), b = new Float32Array(RES * RES * 4);
    const results = (window.__heightResults = []);
    window.__heightCompare = (source) => {
      gpu.run(old, target);
      renderer.readRenderTargetPixels(target, 0, 0, RES, RES, a);
      renderer.readRenderTargetPixels(bakes.height, 0, 0, RES, RES, b);
      let heightMax = 0, heightDiffer = 0, normalMax = 0, normalDiffer = 0, normalOver = 0, worst = null;
      for (let t = 0; t < RES * RES; t++) {
        const i = t * 4;
        const dh = Math.abs(a[i] - b[i]);
        if (a[i] !== b[i]) heightDiffer++;
        heightMax = Math.max(heightMax, dh);
        const dn = Math.max(Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3]));
        if (dn > 0) normalDiffer++;
        if (dn > 1e-5) normalOver++;
        if (dn > normalMax) { normalMax = dn; worst = { texel: [t % RES, Math.floor(t / RES)], old: [...a.subarray(i, i + 4)], now: [...b.subarray(i, i + 4)] }; }
        if (!Number.isFinite(b[i]) || !Number.isFinite(b[i + 1])) heightDiffer += 1e9;
      }
      const domain = atmo.uniforms.uDomain.value.toArray(), ground = atmo.uniforms.uGroundDomain.value.toArray();
      results.push({ source, window: [WINDOW.minX, WINDOW.minZ], domainMatches: domain.every((v, k) => v === ground[k]), heightMax, heightDiffer, normalMax, normalDiffer, normalOver, worst });
    };
    // Registered after the bakes' own listener, so it sees each move's fresh bake in the same frame.
    onWindowMove(() => window.__heightCompare(window.__heightPaused ? 'set' : 'walk'));
  }, OLD_HEIGHT_FRAG);

  const positions = await page.evaluate(async () => {
    window.__heightPaused = true;
    window.__heightCompare('boot');
    const hf = await import('/src/world/heightfield.ts');
    const { LITTLE_BOATS } = await import('/src/world/little-boats-layout.ts');
    const { SKY_MIRROR } = await import('/src/world/sky-mirror-layout.ts');
    const { followWindow } = await import('/src/world/window.ts');
    const at = [[0, 0], [hf.DOOR_SHORE.x, hf.DOOR_SHORE.z], [LITTLE_BOATS.x, LITTLE_BOATS.z], [hf.BANK.x, hf.BANK.crest],
      [hf.POND.x, hf.POND.z], [hf.BIRCH_RISE.x, hf.BIRCH_RISE.z], [hf.SLEEP_HILL.x, hf.SLEEP_HILL.z],
      [SKY_MIRROR.x, SKY_MIRROR.z], [hf.COTTAGE.x, hf.COTTAGE.z], [hf.LAST_HILL.x, hf.LAST_HILL.z], [-1234, -2987], [905, 640]];
    for (const [x, z] of at) followWindow(x, z, true);
    const child = __game.child.position;
    followWindow(child.x, child.z, true);
    window.__heightPaused = false;
    return at;
  });
  await page.waitForTimeout(Number(process.env.WALK_MS ?? 60000));
  const results = await page.evaluate(() => { window.__heightPaused = true; return window.__heightResults; });
  const summary = {
    windows: results.length,
    walkMoves: results.filter((r) => r.source === 'walk').length,
    heightMax: Math.max(...results.map((r) => r.heightMax)),
    heightDiffer: results.reduce((s, r) => s + r.heightDiffer, 0),
    normalMax: Math.max(...results.map((r) => r.normalMax)),
    normalDiffer: results.reduce((s, r) => s + r.normalDiffer, 0),
    normalOver: results.reduce((s, r) => s + r.normalOver, 0),
    texels: results.length * 512 * 512,
  };
  const report = { mutate: process.env.MUTATE ?? null, summary, positions, results, errors };
  await fs.writeFile(process.env.OUT ?? '/tmp/updraft-height-bake-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(summary));
  for (const r of results) console.log(JSON.stringify({ ...r, worst: undefined }));
  assert.deepEqual(errors, []);
  assert(summary.walkMoves > 0, 'the walk moved the window at least once');
  for (const r of results) {
    assert(r.domainMatches, `bake domain follows the window ${JSON.stringify(r.window)}`);
    assert.equal(r.heightDiffer, 0, `heights identical at ${JSON.stringify(r.window)}`);
    assert(r.normalMax <= 1e-5, `normals within 1e-5 at ${JSON.stringify(r.window)}: ${r.normalMax}`);
  }
} finally {
  await close();
}

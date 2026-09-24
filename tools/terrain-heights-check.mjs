// Checks the distant-height atlas on the GPU against worldHeight, and its open-sea floor on the CPU.
// GPU: every texel of every patch at four quarter-points and one random point, through terrainHeightAt exactly as the
// terrain and light bake call it: height error, and the normal the terrain makes from h, hx, hz at 1, 2 and 4 m.
// Gates where the ground is above -2 m (deeper ground lies under the sea): height <= 5 cm, 2 m normal <= 0.01.
// Open sea: a 4 m sweep with random offsets across the whole world, lookup against worldHeight (float rounding only).
// CPU: worldHeight equals seaFloor wherever the lookup does not read the atlas outright, including the blend bands:
// the whole world at 2 m, and every patch's edge band at 0.5 m.
// Usage: node tools/terrain-heights-check.mjs; env BASE (dev server), OUT (JSON path),
//   MUTATE=flags|offset|sea breaks the lookup on purpose to prove the check fails.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { transformSync } from 'rolldown/utils';
import { openBrowser } from './lib/browser.mjs';

// The shared TypeScript hook would also rewrite playwright's own extensionless requires; keep it to the game source.
registerHooks({
  resolve(specifier, context, next) {
    const game = context.parentURL?.includes('/src/') || specifier.includes('/src/');
    return next(game && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? specifier + '.ts' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: transformSync(new URL(url).pathname, fs.readFileSync(new URL(url), 'utf8')).code };
  },
});

globalThis.location = { search: '' };
const { worldHeight } = await import('../src/world/heightfield.ts');
const { TERRAIN_HEIGHT_PATCHES, HEIGHT_TEXEL, HEIGHT_LAYOUT } = await import('../src/world/terrain-heights.ts');

const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function seaFloor(x, z) {
  const across = ((x + 164.56) * 2 + (z + 1925.88)) / Math.sqrt(5), along = ((x + 164.56) - 2 * (z + 1925.88)) / Math.sqrt(5);
  let h = smax(Math.max(smax(smax(-9.0, -9.4, 6), -9.8, 2), -9.6), -9.6, 6);
  h = smax(h, -9.6 - 4.5 * ss(1.65, 3.8, across) * (1 - ss(2.2, 5.5, Math.abs(along))), 6);
  for (const v of [-8.5, -8.5, -9.5, -9.6]) h = smax(h, v, 6);
  return Math.max(h, -11.025);
}
/** The lookup's own choice: the largest margin in texels from a patch's outermost texel centres. */
function margin(x, z) {
  let best = -1;
  for (const p of TERRAIN_HEIGHT_PATCHES) {
    const qx = (x - p.minX) / HEIGHT_TEXEL - 0.5, qz = (z - p.minZ) / HEIGHT_TEXEL - 0.5;
    best = Math.max(best, Math.min(qx, qz, p.width - 1 - qx, p.height - 1 - qz));
  }
  return best;
}
const cpu = { points: 0, band: 0, worst: 0, at: null };
const test = (x, z) => {
  if (margin(x, z) >= 2) return;
  cpu.points++;
  const d = Math.abs(worldHeight(x, z) - seaFloor(x, z));
  if (d > cpu.worst) { cpu.worst = d; cpu.at = [x, z]; }
};
for (let z = -3200; z <= 600; z += 2) for (let x = -1200; x <= 1200; x += 2) test(x, z);
for (const p of TERRAIN_HEIGHT_PATCHES) {
  const x0 = p.minX - 4, x1 = p.minX + p.width * HEIGHT_TEXEL + 4, z0 = p.minZ - 4, z1 = p.minZ + p.height * HEIGHT_TEXEL + 4, band = 3 * HEIGHT_TEXEL + 4;
  for (let z = z0; z <= z1; z += 0.5) for (let x = x0; x <= x1; x += 0.5) {
    if (x - x0 > band && x1 - x > band && z - z0 > band && z1 - z > band) continue;
    cpu.band++;
    test(x, z);
  }
}
console.log(JSON.stringify({ openSea: cpu }));

const MUTATIONS = {
  flags: ['if (a < ${f(FLAGGED / 2)}) {', 'a = a > 500.0 ? a - 1000.0 : a; if (true) {'],
  offset: ['/ ${f(HEIGHT_TEXEL)} - 0.5;', '/ ${f(HEIGHT_TEXEL)} - 0.25;'],
  sea: ['return max(h, -11.025);', 'return max(h, -11.025) + 0.01;'],
};
const mutation = MUTATIONS[process.env.MUTATE];
if (process.env.MUTATE) assert(mutation, `unknown MUTATE ${process.env.MUTATE}`);

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
    source = source.replace(hook, hook + ' if(window.__heightsPaused){requestAnimationFrame(frame);return;}');
    source += '\nwindow.__heightsTest={THREE,terrainHeights};';
    await route.fulfill({ response, body: source });
  });
  if (mutation) await page.route('**/src/world/terrain-heights.ts*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    assert(source.includes(mutation[0]), `hook missing: ${mutation[0]}`);
    await route.fulfill({ response, body: source.replace(mutation[0], mutation[1]) });
  });
  await page.goto((process.env.BASE ?? 'http://127.0.0.1:5230/') + '?shot&chapter=meadow&analytics=0&progress=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const gpu = await page.evaluate(async () => {
    window.__heightsPaused = true;
    const { THREE, terrainHeights } = window.__heightsTest, { renderer } = window.__game;
    const { GpuRunner, simMaterial } = await import('/src/gl/gpu.ts');
    const { HEIGHTFIELD_GLSL } = await import('/src/world/heightfield.ts');
    const { TERRAIN_HEIGHTS_GLSL, TERRAIN_HEIGHT_PATCHES, HEIGHT_TEXEL } = await import('/src/world/terrain-heights.ts');
    const gpu = new GpuRunner(renderer);
    const material = simMaterial(HEIGHTFIELD_GLSL + TERRAIN_HEIGHTS_GLSL + `
      uniform vec4 uArea;
      uniform vec3 uPhase;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uPhase.z) * 43758.5453); }
      float normalError(vec2 p, float e) {
        float h = worldHeight(p), hx = worldHeight(p + vec2(e, 0.0)), hz = worldHeight(p + vec2(0.0, e));
        float a = terrainHeightAt(p), ax = terrainHeightAt(p + vec2(e, 0.0)), az = terrainHeightAt(p + vec2(0.0, e));
        vec3 d = abs(normalize(vec3(h - hx, e, h - hz)) - normalize(vec3(a - ax, e, a - az)));
        return max(d.x, max(d.y, d.z));
      }
      void main() {
        vec2 cell = floor(gl_FragCoord.xy);
        vec2 f = uPhase.z > 0.0 ? vec2(hash(cell), hash(cell + 17.0)) : uPhase.xy;
        vec2 p = uArea.xy + (cell + f) * uArea.zw;
        float h = worldHeight(p);
        float top = max(h, max(worldHeight(p + vec2(2.0, 0.0)), worldHeight(p + vec2(0.0, 2.0))));
        gl_FragColor = vec4(abs(terrainHeightAt(p) - h), normalError(p, 2.0), top, max(normalError(p, 1.0), normalError(p, 4.0)));
      }`, { ...terrainHeights.uniforms, uArea: { value: new THREE.Vector4() }, uPhase: { value: new THREE.Vector3() } });
    const phases = [[0.25, 0.25, 0], [0.75, 0.5, 0], [0.5, 0.75, 0], [0.5, 0.5, 0], [0, 0, 1.7]];
    const rows = [];
    const outside = (x, z) => TERRAIN_HEIGHT_PATCHES.every((p) => {
      const qx = (x - p.minX) / HEIGHT_TEXEL - 0.5, qz = (z - p.minZ) / HEIGHT_TEXEL - 0.5;
      return Math.min(qx, qz, p.width - 1 - qx, p.height - 1 - qz) < 0;
    });
    const run = (name, minX, minZ, w, h, step) => {
      const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, depthBuffer: false });
      const data = new Float32Array(w * h * 4);
      const row = { name, samples: 0, sea: 0, seaMax: 0, visible: 0, heightMax: 0, heightVisibleMax: 0, normal2Max: 0, normalOtherMax: 0, over: 0, worst: null };
      for (const phase of name === 'world' ? phases.slice(0, 4) : phases) {
        material.uniforms.uArea.value.set(minX, minZ, step, step);
        material.uniforms.uPhase.value.fromArray(phase);
        gpu.run(material, target);
        renderer.readRenderTargetPixels(target, 0, 0, w, h, data);
        for (let i = 0; i < w * h; i++) {
          const [dh, n2, top, n14] = data.subarray(i * 4, i * 4 + 4);
          row.samples++;
          row.heightMax = Math.max(row.heightMax, dh);
          if (name === 'world' && outside(minX + ((i % w) + phase[0]) * step, minZ + (Math.floor(i / w) + phase[1]) * step)) { row.sea++; row.seaMax = Math.max(row.seaMax, dh); }
          if (top <= -2) continue;
          row.visible++;
          row.heightVisibleMax = Math.max(row.heightVisibleMax, dh);
          row.normal2Max = Math.max(row.normal2Max, n2);
          row.normalOtherMax = Math.max(row.normalOtherMax, n14);
          if (dh > 0.05 || n2 > 0.01) { row.over++; if (!row.worst || dh > row.worst.dh) row.worst = { at: [minX + (i % w) * step, minZ + Math.floor(i / w) * step], dh, n2, phase }; }
        }
      }
      target.dispose();
      rows.push(row);
    };
    for (const [k, p] of TERRAIN_HEIGHT_PATCHES.entries()) run('patch ' + k, p.minX, p.minZ, p.width, p.height, HEIGHT_TEXEL);
    run('world', -1200, -3200, 600, 950, 4);
    material.dispose();
    const w = terrainHeights.target.width, h = terrainHeights.target.height, atlas = new Float32Array(w * h * 4);
    const read = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, depthBuffer: false });
    // The atlas is single-channel; copy it to RGBA to read it back portably.
    const copy = simMaterial('uniform sampler2D uAtlas; void main(){ gl_FragColor = vec4(texelFetch(uAtlas, ivec2(gl_FragCoord.xy), 0).r, 0.0, 0.0, 1.0); }', { uAtlas: { value: terrainHeights.target.texture } });
    gpu.run(copy, read);
    renderer.readRenderTargetPixels(read, 0, 0, w, h, atlas);
    read.dispose(); copy.dispose();
    let flagged = 0;
    for (let i = 0; i < w * h; i++) if (atlas[i * 4] > 500) flagged++;
    return { rows, atlas: { width: w, height: h, bytes: w * h * 4, flagged }, ready: terrainHeights.uniforms.uTerrainHeightsReady.value };
  });
  const report = { mutate: process.env.MUTATE ?? null, openSea: cpu, gpu, layout: { width: HEIGHT_LAYOUT.width, height: HEIGHT_LAYOUT.height, MiB: HEIGHT_LAYOUT.width * HEIGHT_LAYOUT.height * 4 / 2 ** 20 }, errors };
  fs.writeFileSync(process.env.OUT ?? '/tmp/updraft-terrain-heights-check.json', JSON.stringify(report, null, 2));
  for (const r of gpu.rows) console.log(JSON.stringify(r));
  console.log(JSON.stringify({ atlas: gpu.atlas, layout: report.layout }));
  assert.deepEqual(errors, []);
  assert.equal(gpu.ready, 1, 'the atlas baked before Begin');
  assert(cpu.worst < 1e-9, `worldHeight leaves the sea floor outside the patches: ${JSON.stringify(cpu)}`);
  for (const r of gpu.rows) {
    if (r.name === 'world') assert(r.sea > 400000 && r.seaMax < 1e-4, `the open-sea floor matches worldHeight on the GPU: ${JSON.stringify(r)}`);
    assert(r.heightVisibleMax <= 0.05, `height within 5 cm in ${r.name}: ${JSON.stringify(r)}`);
    assert(r.normal2Max <= 0.01, `2 m normals within 0.01 in ${r.name}: ${JSON.stringify(r)}`);
  }
} finally {
  await close();
}

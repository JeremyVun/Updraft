// The wind field bit for bit against another build: both servers run the same scripted 600 ticks (a stroke that
// circles, swirls and lifts, a crowd of sources that needs a second force pass, held breeze, two window moves) on a
// fresh WindField at full and lite resolution, and every texel of velocity, grass lean and sway is compared as raw
// float bits. A build against itself reads 0.
// BASE=<changed dev server> COMPARE_BASE=<unchanged dev server> node tools/wind-exact-check.mjs
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5230/';
const COMPARE_BASE = process.env.COMPARE_BASE ?? BASE;
const TICKS = Number(process.env.TICKS ?? 600);

async function run(browser, base) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/__wind-exact', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(new URL('__wind-exact', base).href);
  const fields = await page.evaluate(async ticks => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { WindField } = await import('/src/wind/field.ts');
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(16, 16);
    const out = {};
    for (const options of [{ res: 256, iterations: 24 }, { res: 128, iterations: 12 }]) {
      const wind = new WindField(renderer, options);
      wind.breeze.set(2.2, -0.7);
      for (let f = 0; f < ticks; f++) {
        const t = (f + 1) / 60, prev = f / 60;
        const stroke = { source: 'stroke', trail: true, radius: 9 + 4 * Math.sin(t), energy: 0.02, swirl: 0.6, lift: 0.4,
          ax: Math.sin(prev * 1.3) * 40, az: Math.cos(prev * 0.9) * 30, bx: Math.sin(t * 1.3) * 40, bz: Math.cos(t * 0.9) * 30,
          vx: Math.cos(t * 1.3) * 52, vz: -Math.sin(t * 0.9) * 27 };
        if (f % 240 < 150) wind.addSplat(stroke);
        if (f % 97 === 5) wind.addSplat({ source: 'gust', impulse: true, ax: -20, az: 10, bx: -12, bz: 18, vx: 30, vz: 12, radius: 14, energy: 0.7, swirl: 2, lift: 3 });
        if (f >= 300 && f < 420) for (let i = 0; i < 11; i++)
          wind.addSplat({ source: 'crowd-' + i, ax: 60 + i * 3, az: -40, bx: 62 + i * 3, bz: -36, vx: 6, vz: 9, radius: 5, energy: 0.01, swirl: 0.3, lift: 0.2 });
        // Twice a frame now and then, as at a low frame rate, with sustained sources split between ticks.
        wind.step(f % 50 === 7 ? 1 / 30 : 1 / 60, t, false);
        if (f === 200) wind.shift(16, -8);
        if (f === 450) wind.shift(-24, 32);
      }
      const copy = new THREE.ShaderMaterial({
        vertexShader: 'out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D uSrc; void main() { gl_FragColor = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); }',
        uniforms: { uSrc: { value: null } }, depthTest: false, depthWrite: false,
      });
      const target = new THREE.WebGLRenderTarget(options.res, options.res, { type: THREE.FloatType, depthBuffer: false,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copy);
      const camera = new THREE.Camera();
      for (const [name, texture] of [['vel', wind.texture], ['bend', wind.bendTexture], ['sway', wind.swayTexture]]) {
        copy.uniforms.uSrc.value = texture;
        renderer.setRenderTarget(target);
        renderer.render(quad, camera);
        renderer.setRenderTarget(null);
        const data = new Float32Array(options.res * options.res * 4);
        renderer.readRenderTargetPixels(target, 0, 0, options.res, options.res, data);
        out[options.res + '/' + name] = Array.from(new Uint32Array(data.buffer));
      }
    }
    return out;
  }, TICKS);
  await page.close();
  assert.deepEqual(errors, [], base + ' page errors');
  return fields;
}

const { browser, close } = await openBrowser();
try {
  const here = await run(browser, BASE);
  const there = await run(browser, COMPARE_BASE);
  const rows = [];
  for (const key of Object.keys(here)) {
    const a = here[key], b = there[key];
    let differing = 0, worst = 0, nonzero = 0;
    const f = new Float32Array(new Uint32Array(a).buffer), g = new Float32Array(new Uint32Array(b).buffer);
    for (let i = 0; i < a.length; i++) {
      if (f[i] !== 0) nonzero++;
      if (a[i] !== b[i]) { differing++; worst = Math.max(worst, Math.abs(f[i] - g[i])); }
    }
    rows.push({ field: key, texels: a.length / 4, nonzero, differing, worst });
  }
  console.log(JSON.stringify({ base: BASE, against: COMPARE_BASE, ticks: TICKS, rows }));
  assert(rows.every(r => r.nonzero > r.texels), 'a field stayed empty: the script did not drive the wind');
  assert(rows.every(r => r.differing === 0), 'the wind fields differ');
  console.log('Wind field bit for bit: ' + rows.map(r => r.field).join(', ') + ' identical after ' + TICKS + ' ticks.');
} finally { await close(); }

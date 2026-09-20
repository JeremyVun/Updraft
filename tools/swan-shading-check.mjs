// GPU regression: distant swans must not emit MSAA lighting spikes as their wings beat.
// Requires the dev server. Compare the same geometry/pose with the previous unbounded shader.
import assert from 'node:assert/strict';
import { openBrowser } from './lib/browser.mjs';

const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=summit&ratio=1&msaa=4`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { SwanFlock } = await import('/src/creatures/flock.ts');
    const flock = new SwanFlock(), renderer = __game.renderer, scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1200 / 675, 0.1, 2000);
    scene.add(flock.mesh);
    scene.background = new THREE.Color(0, 0, 0);
    const targets = [0, 4].map(samples => new THREE.WebGLRenderTarget(1200, 675, {
      type: THREE.HalfFloatType, samples,
    }));
    const pixels = new Uint16Array(1200 * 675 * 4);
    const fixed = flock.mesh.material.fragmentShader;
    const previous = fixed.replace('float under = clamp(vUnder, 0.0, 1.0);', 'float under = vUnder;');
    if (previous === fixed) throw new Error('Previous shader comparison was not constructed');
    const totals = { fixedPeak: 0, previousPeak: 0, unchangedMaxDifference: 0, frames: 0 };
    const random = Math.random;
    let seed = 12345;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    try {
      // Close view as well as three distances along the farewell flight.
      for (const distance of [15, 70, 150, 280]) {
        flock.pass(-30, -2060 - distance, 90 + distance * 0.1, Math.PI, 13, 0, false);
        flock.speed = 0;
        camera.position.set(-30, 76, -2060);
        camera.lookAt(-30, 90 + distance * 0.1, -2060 - distance);
        camera.updateMatrixWorld();
        for (let frame = 0; frame < 16; frame++) {
          flock.update(1 / 32, frame / 32);
          for (const target of targets) {
            let reference;
            for (const [name, shader] of [['previous', previous], ['fixed', fixed]]) {
              flock.mesh.material.fragmentShader = shader;
              flock.mesh.material.needsUpdate = true;
              renderer.setRenderTarget(target);
              renderer.render(scene, camera);
              renderer.readRenderTargetPixels(target, 0, 0, 1200, 675, pixels);
              for (let i = 0; i < pixels.length; i++) {
                if (i % 4 === 3) continue;
                const value = THREE.DataUtils.fromHalfFloat(pixels[i]);
                if (!Number.isFinite(value)) throw new Error(`${name}: non-finite light`);
                if (target.samples) totals[`${name}Peak`] = Math.max(totals[`${name}Peak`], value);
                else if (reference) totals.unchangedMaxDifference = Math.max(
                  totals.unchangedMaxDifference, Math.abs(value - THREE.DataUtils.fromHalfFloat(reference[i])),
                );
              }
              if (!target.samples && name === 'previous') reference = pixels.slice();
            }
          }
          totals.frames++;
        }
      }
    } finally {
      Math.random = random;
      renderer.setRenderTarget(null);
      for (const target of targets) target.dispose();
      flock.mesh.geometry.dispose();
      flock.mesh.material.dispose();
      flock.wake.geometry.dispose();
      flock.wake.material.dispose();
    }
    return totals;
  });
  assert.equal(errors.length, 0, errors.join('\n'));
  assert(result.previousPeak > 4, 'Fixture did not reproduce the original sparkle');
  assert(result.fixedPeak < 1, `Lighting spike remains: ${result.fixedPeak}`);
  assert(result.unchangedMaxDifference < 0.002, 'Ordinary shading changed without MSAA extrapolation');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await close();
}

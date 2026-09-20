// Frozen GPU checks for reversible grass quality changes and stable allocations.
// Uses play.mjs's shared GPU lock. Usage: node tools/grass-quality-check.mjs [chapter]
import { spawnSync } from 'node:child_process';

async function check() {
  const source = await (await fetch('/src/world/atmosphere.ts')).text();
  const THREE = await import(source.match(/from ["']([^"']*three[^"']*)["']/)[1]);
  const { renderer, scene, rig, grass } = __game;
  const target = new THREE.WebGLRenderTarget(400, 225, { type: THREE.HalfFloatType, depthBuffer: true });
  const read = () => {
    grass.update(rig.camera); grass.bake(renderer);
    renderer.setRenderTarget(target); renderer.render(scene, rig.camera);
    const data = new Uint16Array(400 * 225 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 400, 225, data);
    renderer.setRenderTarget(null);
    return data;
  };
  const diff = (a, b) => {
    let total = 0, changed = 0, max = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(THREE.DataUtils.fromHalfFloat(a[i]) - THREE.DataUtils.fromHalfFloat(b[i]));
      if (!Number.isFinite(d)) throw new Error('Non-finite rendered pixel');
      if (d) changed++;
      total += d; max = Math.max(max, d);
    }
    return { mean: total / a.length, max, changed };
  };
  try {
    grass.setQuality(1, 1, true);
    const full = read(), fullBlades = grass.bladesDrawn;
    const tables = grass.lods.map(l => l.table);
    const results = [];
    for (const [density, reach] of [[0.55, 0.85], [0.25, 0.7], [0.55, 0.85], [1, 1]]) {
      const before = read();
      grass.setQuality(density, reach);
      const start = diff(before, read());
      // The first frame must preserve the image, before the transition advances.
      if (start.mean > 0.00002) throw new Error(`Quality change popped at start: ${JSON.stringify(start)}`);
      let previous = read(), worst = 0, endpointJump = 0;
      for (let i = 0; i < 61; i++) {
        grass.update(rig.camera, 1 / 60); grass.bake(renderer);
        const current = read(), delta = diff(previous, current);
        worst = Math.max(worst, delta.mean);
        if (i === 59) endpointJump = delta.mean;
        previous = current;
      }
      if (Math.abs(grass.quality.density - density) > 1e-6 || Math.abs(grass.quality.reach - reach) > 1e-6) throw new Error('Quality did not settle');
      if (grass.lods.some((l, i) => l.table !== tables[i] || l.count >= l.spec.maxTiles)) throw new Error('Grass pool replaced or exhausted');
      // Keep frozen transitions below 0.8/255 average HDR change per frame.
      if (worst > 0.003) throw new Error(`Grass transition spike: ${density}, ${worst}, endpoint ${endpointJump}`);
      results.push({ density, reach, blades: grass.bladesDrawn, worst, endpointJump, start });
    }
    const restored = diff(full, read());
    if (restored.changed) throw new Error(`Restoring full grass changed pixels: ${JSON.stringify(restored)}`);
    if (!results.some(r => r.blades < fullBlades * 0.7)) throw new Error('Low quality did not reduce submitted blade work');
    return { fullBlades, results, restored };
  } finally {
    grass.setQuality(1, 1, true); grass.update(rig.camera); grass.bake(renderer);
    renderer.setRenderTarget(null); target.dispose();
  }
}
const chapter = process.argv[2] ?? 'meadow';
const prefix = `/tmp/updraft-grass-quality-${chapter}`;
const steps = [
  { eval: 'new Promise(resolve => { const check = () => __stats.frame >= 120 ? resolve() : requestAnimationFrame(check); check(); })' },
  { shot: 'full' },
  { eval: `(${check.toString()})()` },
  { eval: '__game.grass.setQuality(.25,.7,true); __game.grass.update(__game.rig.camera); __game.grass.bake(__game.renderer)' },
  { shot: 'low' },
  { eval: '__game.grass.setQuality(1,1,true); __game.grass.update(__game.rig.camera); __game.grass.bake(__game.renderer)' },
  { shot: 'restored' },
];
const run = spawnSync(process.execPath, ['tools/play.mjs', prefix, JSON.stringify(steps)], {
  env: { ...process.env, QUERY: `chapter=${chapter}&hold=120&ratio=1&msaa=2` }, stdio: 'inherit',
});
process.exit(run.status ?? 1);

// Actual forest, with a held lightning peak for visual inspection. BASE, W and H pass through to play.mjs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const prefix = process.argv[2] ?? '/tmp/updraft-wood-floor';
fs.rmSync(`${prefix}-console.log`, { force: true });
const steps = [
  // Wait for the actual first ember, rather than a wall-clock delay during shader warm-up.
  { eval: `new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      if (__game.story.current.beat === 'first') resolve(true);
      else if (performance.now() - started > 60000) reject(new Error('Did not reach the first ember'));
      else requestAnimationFrame(check);
    }; check();
  })` },
  { wait: 2000 }, { shot: 'quiet' },
  { eval: `(() => {
    const w = __game.stormWeather, update = w.update.bind(w);
    w.next = Infinity;
    w.update = (dt, storm, heading, scale, shade) => { w.age = 0.12; w.strength = 0.9; update(dt, storm, heading, scale, shade); };
  })()` },
  { wait: 500 }, { shot: 'sheltered-flash' },
  { eval: `(() => {
    const light = __game.boat.sailMat.uniforms.uLightning.value.w;
    if (light <= 0 || light > 0.2) throw new Error('Wood flash is not subdued: ' + light);
    return { flash: light, blades: __game.grass.bladesDrawn };
  })()` },
  // An intentionally unsheltered flash proves the floor itself holds up, too.
  { eval: `(() => { const w = __game.stormWeather, update = w.update.bind(w); w.flashScale = 1; w.update = (dt, storm, heading, scale, shade) => update(dt, storm, heading, 1, shade); })()` },
  { wait: 150 }, { shot: 'full-flash-surface-check' },
];
const child = spawn(process.execPath, ['tools/play.mjs', prefix, JSON.stringify(steps)], {
  stdio: 'inherit', env: { ...process.env, QUERY: 'chapter=wood' },
});
child.on('exit', code => {
  const errors = fs.existsSync(`${prefix}-console.log`) && fs.readFileSync(`${prefix}-console.log`, 'utf8').includes('[error]');
  process.exit(errors ? 1 : code ?? 1);
});

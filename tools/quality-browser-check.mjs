// Every level applied to the real world on an emulated coarse pointer, and Auto's ladder with deterministic frame intervals.
import { spawnSync } from 'node:child_process';
function check() {
  const { quality, grass, water, terrain, wind, rig, renderer, post } = __game;
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  // The table in docs/engine.md, Quality governor, at this display's device pixel ratio of 1.
  const LEVELS = {
    ultra: { ratio: 1, density: 1, reach: 1.15, split: 1.6, mirrorEvery: 1, mirrorScale: .75, bloom: 'full', sea: '1111' },
    high: { ratio: 1, density: 1, reach: 1.15, split: 1.6, mirrorEvery: 1, mirrorScale: .75, bloom: 'full', sea: '1111' },
    medium: { ratio: 1, density: 1, reach: 1, split: 1.35, mirrorEvery: 1, mirrorScale: .625, bloom: 'full', sea: '0111' },
    low: { ratio: .85, density: 1, reach: 1, split: 1.1, mirrorEvery: 2, mirrorScale: .5, bloom: 'off', sea: '0000' },
  };
  const near = (a, b) => typeof a === 'string' ? a === b : Math.abs(a - b) < 1e-6;
  const sea = () => ['HULL_COLLAR', 'LANTERN_GLINT', 'SEABED_DETAIL', 'SEA_REFLECTION'].map(name => water.mesh.material.defines[name]).join('');
  const applied = name => {
    grass.update(rig.camera, 1); grass.bake(renderer); terrain.update(rig.camera);
    // The sea fades its effects over a second before dropping their variants.
    for (let i = 0; i < 61; i++) water.step(1 / 60);
    const want = LEVELS[name];
    const got = { name: quality.level.name, ratio: renderer.getPixelRatio(), density: grass.quality.density,
      reach: grass.quality.reach, split: terrain.detail, mirrorEvery: water.mirrorEvery, mirrorScale: water.mirrorScale, bloom: post.bloomLevel, sea: sea(),
      indicator: document.getElementById('quality').title };
    assert(got.name === name && Object.keys(want).every(key => near(got[key], want[key])), `${name} is not applied as the table has it: ${JSON.stringify(got)}`);
    assert(got.indicator.includes(name[0].toUpperCase() + name.slice(1)), `The indicator does not name the level: ${got.indicator}`);
    return got;
  };
  const drive = (from, to, interval) => {
    const seen = [];
    for (let now = from; now < to; now += interval()) {
      quality.frame(now, interval());
      if (seen[seen.length - 1] !== quality.level.name) seen.push(quality.level.name);
    }
    return seen.join(' ');
  };
  assert(matchMedia('(pointer: coarse)').matches, 'Touch emulation missing');
  assert(wind.res === 256, 'Touch must not force the cheaper solver');
  const report = { opening: applied('ultra') };
  quality.reset(0);
  drive(0, 90000, () => 1000 / 60);
  applied('ultra');
  for (const mode of ['high', 'medium', 'low', 'ultra']) {
    quality.setMode(mode, 95000);
    report[mode] = applied(mode);
  }
  quality.setMode('auto', 99000);
  quality.reset(100000);
  report.descent = drive(100000, 130000, () => 20);
  assert(report.descent === 'ultra medium low', `Auto did not step down through its levels: ${report.descent}`);
  report.bottom = applied('low');
  const render = water.reflection.render, camera = rig.camera.clone();
  camera.position.set(0, 8, 80);
  let renders = 0;
  water.reflection.render = (...args) => { renders++; render.apply(water.reflection, args); };
  try {
    water.update(camera);
    renders = 0;
    for (let i = 0; i < 8; i++) water.update(camera);
    assert(renders === 0, `The ordinary sea's reflection must not be drawn at Low: ${renders} of 8`);
  } finally { water.reflection.render = render; }
  quality.reset(140000);
  report.climb = drive(140000, 330000, () => 1000 / 60);
  assert(report.climb === 'low medium ultra', `Auto did not climb back through its levels: ${report.climb}`);
  water.update(rig.camera);
  applied('ultra');
  water.reflection.render = (...args) => { renders++; render.apply(water.reflection, args); };
  try {
    water.update(camera);
    renders = 0;
    for (let i = 0; i < 8; i++) water.update(camera);
    assert(renders === 4, `The ordinary sea's reflection must be redrawn on alternate frames at Ultra: ${renders} of 8`);
  } finally { water.reflection.render = render; }
  return report;
}
const steps = [
  { eval: 'new Promise(resolve => { const check = () => __stats.frame >= 120 ? resolve() : requestAnimationFrame(check); check(); })' },
  { eval: `(${check.toString()})()` },
  { shot: 'full' },
];
const run = spawnSync(process.execPath, ['tools/play.mjs', process.env.OUT ?? '/tmp/updraft-quality-touch', JSON.stringify(steps)], {
  env: { ...process.env, TOUCH: '1', W: '1376', H: '1032', QUERY: 'chapter=meadow&hold=120' }, stdio: 'inherit',
});
process.exit(run.status ?? 1);

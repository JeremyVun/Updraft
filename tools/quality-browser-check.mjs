// Governor wiring on an emulated coarse pointer, with deterministic frame intervals.
import { spawnSync } from 'node:child_process';
function check() {
  const { quality, grass, water, terrain, wind, rig } = __game;
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  assert(matchMedia('(pointer: coarse)').matches, 'Touch emulation missing');
  assert(wind.res === 256, 'Touch must not force the cheaper solver');
  assert(quality.level.detail <= 1, 'Touch should open conservatively');
  quality.reset(0);
  for (let now = 0; now < 90000; now += 1000 / 60) quality.frame(now, 1000 / 60);
  grass.update(rig.camera, 1); grass.bake(__game.renderer);
  terrain.update(rig.camera);
  const full = { level: { ...quality.level }, grass: grass.quality, leaves: terrain.leaves };
  assert(full.level.detail === 2 && full.grass.density === 1 && full.grass.reach === 1, 'Touch failed to reach full grass');
  quality.reset(100000);
  for (let now = 100000; now < 115000; now += 33.3) quality.frame(now, 33.3);
  grass.update(rig.camera, 1); grass.bake(__game.renderer); terrain.update(rig.camera);
  const low = { level: { ...quality.level }, grass: grass.quality, leaves: terrain.leaves };
  assert(low.level.detail === 0 && low.grass.density === .25 && low.grass.reach === .7, 'Overload failed to lower world detail');
  assert(terrain.detail === 1.1 && water.mirrorEvery === 2 && water.mirrorScale === .5, 'Terrain/reflection budget did not follow');
  const render = water.reflection.render, camera = rig.camera.clone();
  camera.position.set(0, 8, 80);
  let renders = 0;
  water.reflection.render = () => { renders++; };
  try {
    for (let i = 0; i < 4; i++) water.update(camera);
    assert(renders === 2, 'Low reflection cadence must halve render work');
    renders = 0; water.mirrorEvery = 1;
    for (let i = 0; i < 4; i++) water.update(camera);
    assert(renders === 4, 'Full reflection cadence must recover');
  } finally { water.reflection.render = render; }
  quality.reset(120000);
  for (let now = 120000; now < 310000; now += 1000 / 60) quality.frame(now, 1000 / 60);
  grass.update(rig.camera, 1); grass.bake(__game.renderer); terrain.update(rig.camera); water.update(rig.camera);
  assert(quality.level.detail === 2 && grass.quality.density === 1, 'World detail did not recover');
  assert(terrain.detail === 1.6 && water.mirrorEvery === 1 && water.mirrorScale === .75, 'Other world settings did not recover');
  return { full, low, recovered: { ...quality.level } };
}
const steps = [
  { eval: 'new Promise(resolve => { const check = () => __stats.frame >= 120 ? resolve() : requestAnimationFrame(check); check(); })' },
  { eval: `(${check.toString()})()` },
  { shot: 'full' },
];
const run = spawnSync(process.execPath, ['tools/play.mjs', '/tmp/updraft-quality-touch', JSON.stringify(steps)], {
  env: { ...process.env, TOUCH: '1', W: '1376', H: '1032', QUERY: 'chapter=meadow&hold=120' }, stdio: 'inherit',
});
process.exit(run.status ?? 1);

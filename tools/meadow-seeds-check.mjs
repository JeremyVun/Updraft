// The flower bed keeps every flower it has woken and finishes as soon as it is nearly all up; lifted down never settles.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
const { MeadowSeeds } = await import('../src/world/meadow-seeds.ts');
const { tuning } = await import('../src/tuning.ts');
const T = tuning.meadowEchoes;

for (const fps of [30, 60, 120]) {
  const dt = 1 / fps, n = 40, seen = Array.from({ length: n }, (_, i) => i % 10 !== 9);
  const s = new MeadowSeeds(n, seen);
  s.release();
  for (let i = 0; i < fps * 40; i++) s.update(dt);
  assert.equal(s.completed, 0, 'idle cannot complete');
  assert.equal(s.progress, 0, 'idle cannot wake a flower');
  for (let i = 0; i < fps * 3; i++) { s.stir(0, -dt); s.stir(1, NaN); s.lift(dt); s.update(dt); }
  assert.equal(s.progress, 0, 'lift and invalid effort cannot wake the bed');
  s.stir(0, .3); s.update(dt);
  assert(s.wake[0] > 0 && s.wake[0] <= T.wakeCap + 1e-6, 'one frame of a sweep wakes a flower partly, never all at once');
  for (let i = 0; i < fps * 3; i++) { s.stir(0, dt); s.update(dt); }
  assert.equal(s.wake[0], 1);
  for (let i = 0; i < fps * 40; i++) s.update(dt);
  assert.equal(s.wake[0], 1, 'a woken flower stays awake');
  assert.equal(s.completed, 0, 'one flower is not the bed');
  let k = 1;
  while (s.progress < T.bedAwake - .05) { if (seen[k]) for (let i = 0; i < fps; i++) { s.stir(k, dt); s.update(dt); } k++; }
  for (let i = 0; i < fps * 10; i++) s.update(dt);
  assert.equal(s.completed, 0, 'a bed short of awake waits for the wind, however long');
  const before = s.wake.slice();
  for (; s.finishing < 0; k++) if (seen[k]) for (let i = 0; i < fps && s.finishing < 0; i++) { s.stir(k, dt); s.update(dt); }
  assert(s.progress >= T.bedAwake);
  assert(before.some((w, i) => seen[i] && w === 0), 'sleepers remain when the bed comes up');
  let took = 0;
  while (s.active) { s.update(dt); took += dt; assert(took < T.bedFinish + .1, 'the last sleepers rise at once, no hidden wait'); }
  assert.equal(s.completed, 1);
  assert(s.wake.every(w => w === 1), 'the whole bed is up when the play ends');
  for (let i = 0; i < fps * 20; i++) { s.lift(dt); s.update(dt); }
  assert.equal(s.progress, 0, 'the seeds wait for the child');
  s.release();
  for (let i = 0; i < fps * 40; i++) s.update(dt);
  assert.equal(s.progress, 0, 'idle lifts no down');
  for (let i = 0; i < fps; i++) { s.lift(dt * .3); s.update(dt); }
  const partial = s.progress;
  assert(partial > .25 && partial < .35, 'a little updraft lifts a little down');
  for (let i = 0; i < fps * 60; i++) s.update(dt);
  assert.equal(s.progress, partial, 'lifted down never sinks back');
  for (let i = 0; i < fps * 12 && s.active; i++) { s.lift(dt * .4); s.update(dt); }
  assert.equal(s.completed, 2); assert(!s.active);
  for (let i = 0; i < fps * 60; i++) s.update(dt);
  assert.equal(s.completed, 2, 'completion persists');
  s.reset(1); s.release(); assert(s.active); assert(s.wake.every(w => w === 1), 'a seed save keeps the bed awake');
  s.reset(2); s.release(); assert(!s.active, 'completed saves never replay');
  console.log(`PASS ${fps}fps: woken flowers kept, idle and invalid input, prompt finish, retained lift, restoration.`);
}

// The flower phrase remembers each cluster; lifted seeds settle when the wind rests.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
const { MeadowSeeds } = await import('../src/world/meadow-seeds.ts');

for (const fps of [30, 60, 120]) {
  const s = new MeadowSeeds(), dt = 1 / fps;
  s.release();
  for (let i = 0; i < fps * 40; i++) {
    if (process.env.NEGATIVE) for (let j = 0; j < 3; j++) s.sweep(j, dt * .3);
    s.update(dt);
  }
  assert.equal(s.completed, 0, 'idle cannot complete');
  assert.equal(s.progress, 0, 'ambient wind cannot open a flower phrase');
  for (let i = 0; i < fps * 3; i++) { s.sweep(0, -dt); s.lift(dt); s.update(dt); }
  assert.equal(s.progress, 0, 'lift and negative effort cannot play flowers');
  for (let i = 0; i < fps * 3; i++) { s.sweep(0, dt * .3); s.update(dt); }
  assert.equal(s.blooms[0], 1);
  for (let i = 0; i < fps * 40; i++) s.update(dt);
  assert.equal(s.blooms[0], 1, 'a played cluster stays open');
  assert.equal(s.completed, 0, 'one cluster alone is not the whole phrase');
  for (let j = 1; j < 3; j++) for (let i = 0; i < fps * 3; i++) { s.sweep(j, dt * .3); s.update(dt); }
  assert.equal(s.completed, 1); assert(!s.active);
  for (let i = 0; i < fps * 20; i++) { s.lift(dt); s.update(dt); }
  assert.equal(s.progress, 0, 'the next encounter waits for the child');
  s.release();
  for (let i = 0; i < fps * 3; i++) { s.lift(dt * .15); s.update(dt); }
  assert(s.progress > .4 && s.progress < .5, 'a gentle lift has visible partial progress');
  for (let i = 0; i < fps * 50; i++) s.update(dt);
  assert.equal(s.progress, 0, 'unattended seeds settle back onto the heads');
  for (let i = 0; i < fps * 12 && s.active; i++) { s.lift(dt * .2); s.update(dt); }
  assert.equal(s.completed, 2); assert(!s.active);
  for (let i = 0; i < fps * 60; i++) s.update(dt);
  assert.equal(s.completed, 2, 'completion persists');
  s.reset(1); s.release(); assert(s.active); assert(s.blooms.every(v => v === 1));
  s.reset(2); s.release(); assert(!s.active, 'completed saves never replay');
  console.log(`PASS ${fps}fps: three remembered clusters, lift/hold/settle, idle, activation and restoration.`);
}

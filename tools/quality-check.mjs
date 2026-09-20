// Startup, exact QA overrides and suspend/resume behavior without a renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'rolldown/utils';
const source = fs.readFileSync(new URL('../src/gl/quality.ts', import.meta.url), 'utf8');
const { Quality } = await import('data:text/javascript;base64,' + Buffer.from(transformSync('quality.ts', source).code).toString('base64'));
globalThis.location = { search: '' };
const create = (ratio, width, height, locked = false, start = ratio, detail = 2) => {
  const changes = [];
  const quality = new Quality(ratio, 4, width, height, start, locked, level => changes.push({ ...level }), detail);
  return { quality, changes };
};
for (const ratio of [0.5, 0.85, 1, 1.5, 2]) {
  const { quality, changes } = create(ratio, 3840, 2160, true, 1.25);
  assert.deepEqual(quality.level, { ratio, samples: 4, detail: 2 });
  for (let now = 0; now < 20000; now += 40) quality.frame(now, 40);
  assert.equal(changes.length, 0, 'locked levels must stay exact');
}
const large = create(2, 7680, 4320).quality;
assert.deepEqual(large.level, { ratio: 0.72, samples: 2, detail: 0 }, 'over-budget screens start at the lowest rung');
const zoom = create(0.8, 1600, 900).quality;
assert.equal(zoom.level.ratio, 0.8, 'browser zoom below DPR 1 must not increase render scale');
const { quality, changes } = create(2, 1600, 900);
const opening = { ...quality.level };
quality.reset(60000);
for (let now = 60000; now < 71000; now += 1000 / 60) quality.frame(now, 1000 / 60);
assert.deepEqual(quality.level, opening, 'waiting to begin must not pay the climb delay');
for (let now = 71000; now < 74500; now += 1000 / 60) quality.frame(now, 1000 / 60);
assert(changes.length > 0, 'a real smooth stretch earns a quality increase');
quality.reset(200000);
const resumed = { ...quality.level };
for (let now = 200000; now < 210000; now += 1000 / 60) quality.frame(now, 1000 / 60);
assert.deepEqual(quality.level, resumed, 'hidden time must not earn an immediate increase');
const slow = create(2, 1600, 900);
slow.quality.reset(0);
for (let now = 0; now < 6000; now += 33.3) slow.quality.frame(now, 33.3);
assert(slow.quality.level.ratio < opening.ratio, 'sustained missed frames lower quality');
// A coarse pointer chooses only the opening rung; it has the same ceiling as a mouse.
const touch = create(2, 1376, 1032, false, 1.25, 1);
assert.equal(touch.quality.level.detail, 1);
touch.quality.reset(0);
for (let now = 0; now < 85000; now += 1000 / 60) touch.quality.frame(now, 1000 / 60);
assert.deepEqual(touch.quality.level, { ratio: 2, samples: 4, detail: 2 });
// Rendering at DPR 1 must still shed geometry/reflection work, and recover it later.
const geometry = create(1, 1024, 768);
geometry.quality.reset(0);
for (let now = 0; now < 11000; now += 33.3) geometry.quality.frame(now, 33.3);
assert.equal(geometry.quality.level.detail, 0);
assert(geometry.changes.some(l => l.detail < 2 && l.ratio === 1));
for (let now = 11000; now < 100000; now += 1000 / 60) geometry.quality.frame(now, 1000 / 60);
assert.deepEqual(geometry.quality.level, { ratio: 1, samples: 4, detail: 2 });
// Touch no longer enables the simulation/graphics lite preset behind the governor.
const paramsSource = transformSync('params.ts', fs.readFileSync(new URL('../src/params.ts', import.meta.url), 'utf8')).code;
for (const [search, lite] of [['', false], ['?lite=0', false], ['?lite=1', true]]) {
  globalThis.location.search = search;
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  const { params } = await import('data:text/javascript;base64,' + Buffer.from(paramsSource + '// ' + search).toString('base64'));
  assert.equal(params.lite, lite);
  assert.equal(params.mirror, null, 'no implicit reflection cadence override');
}
console.log('Quality overrides, startup/resume, touch promotion, geometry fallback/recovery and explicit lite passed.');

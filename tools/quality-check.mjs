// Startup, exact QA overrides and suspend/resume behavior without a renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'rolldown/utils';
const source = fs.readFileSync(new URL('../src/gl/quality.ts', import.meta.url), 'utf8');
const { Quality } = await import('data:text/javascript;base64,' + Buffer.from(transformSync('quality.ts', source).code).toString('base64'));
globalThis.location = { search: '' };
const create = (ratio, width, height, locked = false, start = ratio, detail = 2, autoRatio = ratio) => {
  const changes = [];
  const quality = new Quality(ratio, 4, width, height, start, locked, level => changes.push({ ...level }), detail, 'auto', autoRatio);
  return { quality, changes };
};
for (const ratio of [0.5, 0.85, 1, 1.5, 2]) {
  const { quality, changes } = create(ratio, 3840, 2160, true, 1.25);
  assert.deepEqual(quality.level, { ratio, samples: 4, detail: 2 });
  for (let now = 0; now < 20000; now += 40) quality.frame(now, 40);
  assert.equal(changes.length, 0, 'locked levels must stay exact');
}
const large = create(2, 7680, 4320).quality;
assert.deepEqual(large.level, { ratio: 0.72, samples: 2, detail: 0, grassDensity: .25, grassReach: .7 }, 'over-budget screens start at the lowest rung');
const zoom = create(0.8, 1600, 900).quality;
assert.equal(zoom.level.ratio, 0.8, 'browser zoom below DPR 1 must not increase render scale');
const { quality, changes } = create(2, 1600, 900);
const opening = { ...quality.level };
quality.reset(60000);
for (let now = 60000; now < 71000; now += 1000 / 60) quality.frame(now, 1000 / 60);
assert.deepEqual(quality.level, opening, 'waiting to begin must not pay the climb delay');
for (let now = 71000; now < 74500; now += 1000 / 60) quality.frame(now, 1000 / 60);
assert.deepEqual(quality.level, opening, 'smooth vsync cannot exceed the sustained pixel budget');
quality.reset(200000);
const resumed = { ...quality.level };
for (let now = 200000; now < 210000; now += 1000 / 60) quality.frame(now, 1000 / 60);
assert.deepEqual(quality.level, resumed, 'hidden time must not earn an immediate increase');
const slow = create(2, 1600, 900);
slow.quality.reset(0);
for (let now = 0; now < 6000; now += 33.3) slow.quality.frame(now, 33.3);
assert(slow.quality.level.ratio < opening.ratio, 'sustained missed frames lower quality');
// Touch restores full grass before spending its sustained budget on resolution.
const touch = create(2, 1376, 1032, false, 1.25, 1, 1.25);
assert.equal(touch.quality.level.detail, 1);
touch.quality.reset(0);
for (let now = 0; now < 85000; now += 1000 / 60) touch.quality.frame(now, 1000 / 60);
assert.deepEqual(touch.quality.level, { ratio: 1.25, samples: 4, detail: 2 });
touch.quality.setMode('high', 90000);
assert.equal(touch.quality.level.ratio, 2, 'High uses the caller-provided maximum');
touch.quality.setMode('auto', 90001);
assert.equal(touch.quality.level.ratio, 1.25, 'Auto immediately reapplies its budget');
touch.quality.resize(1920, 1200, 90002);
assert.equal(touch.quality.level.ratio, 1, 'fullscreen must respect the pixel budget');
touch.quality.resize(1376, 1032, 90003);
for (let now = 90003; now < 110000; now += 1000 / 60) touch.quality.frame(now, 1000 / 60);
assert.equal(touch.quality.level.ratio, 1.25, 'smaller viewport can recover resolution');
touch.quality.setMode('high', 110001);
touch.quality.resize(1920, 1200, 110002);
assert.equal(touch.quality.level.ratio, 2, 'manual quality survives resize');
const phone = create(2, 390, 844, false, 1.25, 1, 1.25);
for (let now = 0; now < 100000; now += 1000 / 60) phone.quality.frame(now, 1000 / 60);
assert.equal(phone.quality.level.ratio, 1.25, 'small touch screens also retain headroom');
// Rendering at DPR 1 must still shed geometry/reflection work, and recover it later.
const geometry = create(1, 1024, 768);
geometry.quality.reset(0);
for (let now = 0; now < 11000; now += 33.3) geometry.quality.frame(now, 33.3);
assert.equal(geometry.quality.level.detail, 0);
assert(geometry.changes.some(l => l.detail < 2 && l.ratio === 1));
for (let now = 11000; now < 100000; now += 1000 / 60) geometry.quality.frame(now, 1000 / 60);
assert.deepEqual(geometry.quality.level, { ratio: 1, samples: 4, detail: 2 });
// Player presets hold even through overload or spare capacity. Auto resumes from
// the chosen level, forgetting any timing collected before the switch.
const manual = create(2, 1600, 900);
for (const [mode, expected] of [
  ['high', { ratio: 2, samples: 4, detail: 2 }],
  ['medium', { ratio: 1, samples: 2, detail: 1 }],
  ['low', { ratio: .85, samples: 2, detail: 0 }],
]) {
  manual.quality.setMode(mode, 0);
  assert.equal(manual.quality.mode, mode);
  assert.equal(manual.quality.frameRate, mode === 'low' ? 30 : 60);
  assert.deepEqual(manual.quality.level, expected);
  for (let now = 0; now < 20000; now += 40) manual.quality.frame(now, 40);
  for (let now = 20000; now < 45000; now += 1000 / 120) manual.quality.frame(now, 1000 / 120);
  assert.deepEqual(manual.quality.level, expected, `${mode} must not adapt`);
}
manual.quality.setMode('auto', 50000);
for (let now = 50000; now < 61000; now += 1000 / 60) manual.quality.frame(now, 1000 / 60);
assert.equal(manual.quality.level.ratio, .85, 'manual time cannot earn an immediate climb');
for (let now = 61000; now < 65000; now += 1000 / 60) manual.quality.frame(now, 1000 / 60);
assert(manual.quality.level.ratio > .85, 'Auto must climb again');
manual.quality.setMode('high', 65000);
manual.quality.setMode('auto', 65000);
for (let now = 65000; now < 72000; now += 40) manual.quality.frame(now, 40);
assert(manual.quality.level.ratio < 2, 'Auto must lower quality again');
const saved = new Quality(2, 2, 1376, 1032, 1.25, false, () => {}, 1, 'high');
assert.deepEqual(saved.level, { ratio: 2, samples: 2, detail: 2 }, 'saved High overrides conservative touch startup');
const fixed = create(.85, 1600, 900, true).quality;
fixed.setMode('low', 0);
assert.deepEqual(fixed.level, { ratio: .85, samples: 4, detail: 2 }, 'manual selection cannot alter QA locks');
const preferenceSource = transformSync('quality-preference.ts', fs.readFileSync(new URL('../src/gl/quality-preference.ts', import.meta.url), 'utf8')).code;
const { readQualityMode, saveQualityMode } = await import('data:text/javascript;base64,' + Buffer.from(preferenceSource).toString('base64'));
let stored = 'invalid';
globalThis.localStorage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
assert.equal(readQualityMode(), 'auto');
saveQualityMode('high'); assert.equal(readQualityMode(), 'high');
globalThis.localStorage = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
assert.equal(readQualityMode(), 'auto');
assert.doesNotThrow(() => saveQualityMode('low'));
// Touch no longer enables the simulation/graphics lite preset behind the governor.
const paramsSource = transformSync('params.ts', fs.readFileSync(new URL('../src/params.ts', import.meta.url), 'utf8')).code;
for (const [search, lite] of [['', false], ['?lite=0', false], ['?lite=1', true]]) {
  globalThis.location.search = search;
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  const { params } = await import('data:text/javascript;base64,' + Buffer.from(paramsSource + '// ' + search).toString('base64'));
  assert.equal(params.lite, lite);
  assert.equal(params.mirror, null, 'no implicit reflection cadence override');
}
console.log('Quality overrides, startup/resume, touch promotion, geometry fallback/recovery, manual presets, persistence and explicit lite passed.');

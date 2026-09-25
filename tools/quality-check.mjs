// Startup, exact QA overrides and suspend/resume behavior without a renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'rolldown/utils';
const source = fs.readFileSync(new URL('../src/gl/quality.ts', import.meta.url), 'utf8');
const { Quality } = await import('data:text/javascript;base64,' + Buffer.from(transformSync('quality.ts', source).code).toString('base64'));
globalThis.location = { search: '' };
const create = (ratio, width, height, locked = false, autoRatio = ratio, samples = 4) => {
  const changes = [];
  const quality = new Quality(ratio, samples, width, height, locked, level => changes.push({ ...level }), 'auto', autoRatio);
  return { quality, changes };
};
for (const ratio of [0.5, 0.85, 1, 1.5, 2]) {
  const { quality, changes } = create(ratio, 3840, 2160, true);
  assert.deepEqual(quality.level, { ratio, samples: 4, detail: 2 });
  for (let now = 0; now < 20000; now += 40) quality.frame(now, 40);
  assert.equal(changes.length, 0, 'locked levels must stay exact');
}
const large = create(2, 7680, 4320).quality;
assert.deepEqual(large.level, { ratio: 0.5, samples: 2, detail: 0, grassDensity: .25, grassReach: .7 }, 'over-budget screens start at the lowest rung');
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
// Touch Auto opens at its ceiling with full grass, and holds it while frames are smooth.
const touch = create(2, 1376, 1032, false, 1.25);
assert.deepEqual(touch.quality.level, { ratio: 1.25, samples: 4, detail: 2 });
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
const phone = create(2, 390, 844, false, 1.25);
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
const saved = new Quality(2, 2, 1376, 1032, false, () => {}, 'high', 1.25);
assert.deepEqual(saved.level, { ratio: 2, samples: 2, detail: 2 }, 'saved High overrides touch Auto startup');
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

// Very large viewports: a rung at the pixel budget (never below 0.5), rebuilt on resize; presets unaffected.
const pixels = level => level.ratio * level.ratio;
const uhd = create(1, 3840, 2160);
assert(Math.abs(pixels(uhd.quality.level) * 3840 * 2160 - 2.4e6) < 1, `4K at DPR 1 reaches the pixel budget: ${uhd.quality.level.ratio}`);
assert.equal(uhd.quality.level.grassDensity, .25);
uhd.quality.reset(0);
for (let now = 0; now < 30000; now += 1000 / 60) uhd.quality.frame(now, 1000 / 60);
assert(uhd.quality.level.ratio < .72, 'smooth frames cannot climb past the 4K budget');
for (let now = 30000; now < 40000; now += 50) uhd.quality.frame(now, 50);
assert(uhd.quality.level.ratio < .72, 'overload holds the budget rung');
uhd.quality.resize(7680, 4320, 40000);
assert.equal(uhd.quality.level.ratio, .5, 'the budget rung is rebuilt on resize, with a deliberate minimum');
uhd.quality.resize(1920, 1080, 40001);
assert.equal(uhd.quality.level.ratio, .72, 'a smaller viewport drops the budget rung');
uhd.quality.reset(40001);
for (let now = 40001; now < 200000; now += 1000 / 60) uhd.quality.frame(now, 1000 / 60);
assert.deepEqual(uhd.quality.level, { ratio: 1, samples: 4, detail: 2 }, 'and climbs back to its own ceiling');
uhd.quality.resize(3840, 2160, 200001);
assert(Math.abs(pixels(uhd.quality.level) * 3840 * 2160 - 2.4e6) < 1, 'growing again returns to the budget rung');
for (const [mode, expected] of [['high', { ratio: 1, samples: 4, detail: 2 }], ['medium', { ratio: 1, samples: 2, detail: 1 }], ['low', { ratio: .85, samples: 2, detail: 0 }]]) {
  uhd.quality.setMode(mode, 200002);
  assert.deepEqual(uhd.quality.level, expected, `${mode} ignores the budget rung`);
}
const small = create(2, 1600, 900);
small.quality.setMode('low', 0);
assert.deepEqual(small.quality.level, { ratio: .85, samples: 2, detail: 0 }, 'Low is unchanged on ordinary screens');

// A 30 fps presentation cap (iOS Low Power Mode) is judged against 30 fps once the GPU proves it had time to spare.
const run = (q, from, to, interval, early) => {
  for (let now = from; now < to; now += interval) {
    q.frame(now, interval);
    if (q.probing && early !== null) q.gpu(early);
  }
};
const capped = create(2, 1600, 900);
const top = { ...capped.quality.level };
capped.quality.reset(0);
run(capped.quality, 0, 30000, 1000 / 30, true);
assert.deepEqual(capped.quality.level, top, 'a capped display with GPU to spare keeps its quality');
assert.equal(capped.changes.length, 0);
run(capped.quality, 30000, 40000, 50, true);
assert(capped.quality.level.ratio < top.ratio, 'overload at the cap still steps down');
const lowered = capped.quality.level.ratio;
run(capped.quality, 40000, 70000, 1000 / 30, true);
assert(capped.quality.level.ratio >= lowered, 'a smooth capped cadence does not step down further');
run(capped.quality, 70000, 200000, 1000 / 60, null);
assert.deepEqual(capped.quality.level, top, 'lifting the cap returns to 60 fps judgement and recovers');
run(capped.quality, 200000, 210000, 1000 / 60, null);
assert(!capped.quality.probing, '60 Hz frames at the ceiling are never timed');
const saturated = create(2, 1600, 900);
saturated.quality.reset(0);
run(saturated.quality, 0, 6000, 1000 / 30, false);
assert(saturated.quality.level.ratio < top.ratio, 'a GPU missing every other 60 Hz refresh still steps down');
const untimed = create(2, 1600, 900);
untimed.quality.reset(0);
run(untimed.quality, 0, 6000, 1000 / 30, null);
assert(untimed.quality.level.ratio < top.ratio, 'without GPU timings a steady 33 ms is still overload');
const jitter = create(2, 1600, 900);
jitter.quality.reset(0);
for (let now = 0, i = 0; now < 6000; i++) { const interval = i % 2 ? 1000 / 60 : 1000 / 30; now += interval; jitter.quality.frame(now, interval); if (jitter.quality.probing) jitter.quality.gpu(true); }
assert(jitter.quality.level.ratio < top.ratio, 'alternating 16.7/33 ms intervals are overload, not a cap');
// Through the real pacer: display callbacks at a capped 30 Hz, and at 60/120/144 Hz, which must never be timed.
const pacerSource = transformSync('frame-pacer.ts', fs.readFileSync(new URL('../src/gl/frame-pacer.ts', import.meta.url), 'utf8')).code;
const { FramePacer } = await import('data:text/javascript;base64,' + Buffer.from(pacerSource).toString('base64'));
for (const hz of [30, 60, 120, 144]) {
  const { quality: q, changes: seen } = create(2, 1600, 900);
  const pacer = new FramePacer();
  q.reset(0); pacer.reset(0);
  let timed = 0;
  for (let i = 1; i <= hz * 40; i++) {
    const now = i * 1000 / hz;
    if (!pacer.due(now, q.frameRate)) continue;
    q.frame(now, pacer.intervalMs);
    if (q.probing) { timed++; q.gpu(true); }
  }
  assert.deepEqual(q.level, top, `${hz} Hz with GPU to spare keeps its quality`);
  assert.equal(seen.length, 0);
  assert.equal(timed > 0, hz === 30, `${hz} Hz timing requests`);
}
console.log('Budget rung for very large viewports and 30 fps presentation caps passed.');

// A GPU-bound iPad-sized touch device: frame work scales with pixels and eases with world detail, and a frame that
// misses a refresh waits for the next one (`cap` 2 for a 30 fps display). Work is timed from submission; the model's
// script takes no time. `fence` false stands for frames that
// can't be timed; `lie` for headroom timings that claim room the next rung doesn't have.
const REFRESH = 1000 / 60;
const touchDevice = () => create(2, 1376, 1032, false, 1.25, 2);
const play = (q, from, to, ms, { fence = true, lie = false, cap = 1 } = {}) => {
  const seen = [];
  let interval = REFRESH * cap;
  for (let now = from; now < to; now += interval) {
    q.frame(now, interval);
    const work = ms(q.level, now) * q.level.ratio ** 2 * [.7, .85, 1][q.level.detail];
    if (q.probing && fence) { const deadline = q.probeDeadline(0, 0); q.gpu(work <= deadline || lie && deadline < REFRESH); }
    interval = Math.max(cap, Math.ceil(work / REFRESH - 1e-6)) * REFRESH;
    seen.push({ now, ratio: q.level.ratio, detail: q.level.detail });
  }
  return seen;
};
const atTop = row => row.ratio === 1.25 && row.detail === 2;
{
  // 17.2 ms at the ceiling misses every other refresh; 11 ms at 1× is smooth but too close to prove room for 1.25×.
  const { quality: q } = touchDevice();
  q.reset(0);
  const seen = play(q, 0, 300000, () => 11);
  const firstDrop = seen.find(row => !atTop(row)).now;
  assert(firstDrop <= 4000, `overloaded touch steps down from the top within seconds: ${firstDrop}`);
  assert(!seen.some(row => row.now > firstDrop && atTop(row)), 'truthful timings never climb back into overload');
  assert.deepEqual({ ratio: q.level.ratio, detail: q.level.detail }, { ratio: 1, detail: 2 }, 'but it recovers the rung that fits');
  assert(q.probing && q.probeDeadline(0, 0) === 10, 'below the ceiling it keeps timing frames against the headroom deadline');
}
{
  // Timings that lie: every climb back fails, and the waits between them double.
  const { quality: q } = touchDevice();
  q.reset(0);
  const seen = play(q, 0, 300000, () => 11, { lie: true });
  const returns = seen.filter((row, i) => i && atTop(row) && !atTop(seen[i - 1])).map(row => row.now);
  const gaps = returns.slice(1).map((t, i) => t - returns[i]);
  assert(returns.length <= 5 && gaps.every((gap, i) => !i || gap > gaps[i - 1]), `failed climbs back off: ${returns.map(Math.round)}`);
}
{
  // Headroom at the ceiling (6 ms of work at 1×), pushed down by a four-times load for ten seconds.
  const lifted = fence => {
    const { quality: q } = touchDevice();
    q.reset(0);
    const seen = play(q, 0, 60000, (_, now) => now < 10000 ? 24 : 6, { fence });
    assert(seen.some(row => row.now < 10000 && row.ratio < 1), 'the load pushes it well down');
    return seen.find(row => row.now >= 10000 && atTop(row)).now - 10000;
  };
  const timed = lifted(true), untimed = lifted(false);
  assert(timed <= 8000, `a device with headroom climbs back within seconds once load lifts: ${Math.round(timed)} ms`);
  assert(untimed > 12000, `without GPU timings the smooth window is the fallback: ${Math.round(untimed)} ms`);
}
{
  // A 30 fps display: the cap is recognised at the ceiling, which then stops timing frames.
  const { quality: q, changes } = touchDevice();
  q.reset(0);
  play(q, 0, 60000, () => 8, { cap: 2 });
  assert.equal(changes.length, 0, 'a capped touch display with GPU to spare keeps the ceiling');
  assert(!q.probing, 'a proven cap at the ceiling is not timed');
  // Pushed down at the cap, it climbs back against the doubled headroom deadline.
  play(q, 60000, 70000, () => 30, { cap: 2 });
  assert(!atTop(q.level), 'overload at the cap steps down');
  const seen = play(q, 70000, 90000, () => 8, { cap: 2 });
  assert(!q.probing, 'back at the ceiling, frames are no longer timed');
  assert(seen.find(atTop).now - 70000 <= 8000, 'and climbs back within seconds once load lifts');
}
console.log('Touch Auto: opening at the ceiling, stepping down under overload without looping back, climbing on GPU headroom within seconds, and 30 fps caps passed.');

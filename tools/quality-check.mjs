// The four levels, Auto's ladder between them, exact QA overrides and suspend/resume behaviour, without a renderer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'rolldown/utils';
const load = name => import('data:text/javascript;base64,' + Buffer.from(transformSync(name, fs.readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')).code).toString('base64'));
const { Quality, WORLD_QUALITY } = await load('gl/quality.ts');
globalThis.location = { search: '' };
const create = (ratio, width, height, { locked = false, autoRatio = ratio, samples = 4, mode = 'auto' } = {}) => {
  const changes = [];
  const quality = new Quality(ratio, samples, width, height, locked, level => changes.push({ ...level }), mode, autoRatio);
  return { quality, changes };
};
const names = changes => changes.map(level => level.name).join(' ');
const REFRESH = 1000 / 60;
const steady = (q, from, to, interval) => { for (let now = from; now < to; now += interval) q.frame(now, interval); };
// `early`: whether each timed frame's GPU work met the governor's deadline; null where frames can't be timed.
const run = (q, from, to, interval, early) => {
  for (let now = from; now < to; now += interval) {
    q.frame(now, interval);
    if (q.probing && early !== null) q.gpu(early);
  }
};

// The table in docs/backlog/perf-final/design.md section 3.
assert.deepEqual(WORLD_QUALITY, {
  ultra: { grassDensity: 1, grassReach: 1.15, terrainSplit: 1.6, mirrorEvery: 1, mirrorScale: .75, bloom: 'full', sea: 'all' },
  high: { grassDensity: 1, grassReach: 1.15, terrainSplit: 1.6, mirrorEvery: 1, mirrorScale: .75, bloom: 'full', sea: 'all' },
  medium: { grassDensity: 1, grassReach: 1, terrainSplit: 1.35, mirrorEvery: 1, mirrorScale: .625, bloom: 'half', sea: 'noCollar' },
  low: { grassDensity: 1, grassReach: 1, terrainSplit: 1.1, mirrorEvery: 2, mirrorScale: .5, bloom: 'off', sea: 'plain' },
});
const PRESETS = {
  1.5: { ultra: [1.5, 4], high: [1.25, 4], medium: [1, 2], low: [.85, 2] },
  1.1: { ultra: [1.1, 4], high: [1.1, 4], medium: [1, 2], low: [.85, 2] },
  .8: { ultra: [.8, 4], high: [.8, 4], medium: [.8, 2], low: [.8 * .85, 2] },
};
for (const [ratio, presets] of Object.entries(PRESETS)) {
  // A 4K viewport: manual levels never fit themselves to Auto's pixel budget, and never react to frame timing.
  const manual = create(Number(ratio), 3840, 2160);
  for (const [mode, [scale, samples]] of Object.entries(presets)) {
    const expected = { name: mode, ratio: scale, samples };
    manual.quality.setMode(mode, 0);
    assert.equal(manual.quality.mode, mode);
    assert.deepEqual(manual.quality.level, expected);
    steady(manual.quality, 0, 20000, 60);
    steady(manual.quality, 20000, 45000, 1000 / 120);
    manual.quality.resize(1280, 720, 45000);
    manual.quality.resize(3840, 2160, 45001);
    assert.deepEqual(manual.quality.level, expected, `${mode} must not adapt`);
    assert.deepEqual(create(Number(ratio), 1376, 1032, { mode, autoRatio: 1.25 }).quality.level, expected, `a saved ${mode} overrides Auto's opening`);
  }
}
assert.deepEqual(create(1.5, 1280, 800, { samples: 2 }).quality.level, { name: 'ultra', ratio: 1.5, samples: 2 }, 'the scene default MSAA is kept at the top');

// QA locks are exact, with Ultra's world settings.
for (const ratio of [0.5, 0.85, 1, 1.5, 2]) {
  const { quality, changes } = create(ratio, 3840, 2160, { locked: true });
  assert.deepEqual(quality.level, { name: 'ultra', ratio, samples: 4 });
  steady(quality, 0, 20000, 40);
  quality.setMode('low', 20000);
  quality.resize(7680, 4320, 20001);
  assert.deepEqual(quality.level, { name: 'ultra', ratio, samples: 4 }, 'locked levels must stay exact');
  assert.equal(changes.length, 0);
  assert(!quality.probing);
}

// Auto opens at Ultra, or at High under the touch ceiling, and smooth vsync never takes it past its opening.
const desktop = create(1.5, 1280, 800);
assert.deepEqual(desktop.quality.level, { name: 'ultra', ratio: 1.5, samples: 4 });
const touch = create(1.5, 1376, 1032, { autoRatio: 1.25 });
assert.deepEqual(touch.quality.level, { name: 'high', ratio: 1.25, samples: 4 });
touch.quality.reset(0);
steady(touch.quality, 0, 85000, REFRESH);
assert.equal(touch.changes.length, 0, 'touch Auto holds High while frames are smooth');
assert(!touch.quality.probing, 'and is not timed at its ceiling');
touch.quality.setMode('ultra', 90000);
assert.equal(touch.quality.level.ratio, 1.5, 'Ultra uses the caller-provided maximum');
touch.quality.setMode('auto', 90001);
assert.deepEqual(touch.quality.level, { name: 'high', ratio: 1.25, samples: 4 }, 'Auto immediately returns under its ceiling');
const phone = create(1.5, 390, 844, { autoRatio: 1.25 });
steady(phone.quality, 0, 100000, REFRESH);
assert.equal(phone.quality.level.name, 'high', 'small touch screens keep the touch ceiling');
assert.equal(create(1, 1024, 768, { autoRatio: 1.25 }).quality.level.name, 'ultra', 'a touch display under the ceiling opens at Ultra');
assert.equal(create(.8, 1600, 900).quality.level.ratio, .8, 'browser zoom below DPR 1 must not increase render scale');

// Waiting behind Begin or in a hidden tab earns nothing.
{
  const { quality } = create(1.5, 1280, 800);
  quality.setMode('low', 0); quality.setMode('auto', 1);
  steady(quality, 1, 11000, REFRESH);
  quality.reset(60000);
  steady(quality, 60000, 61400, REFRESH);
  assert.equal(quality.level.name, 'low', 'a reset restarts the evidence');
}

// Over the pixel budget Auto lowers the render scale of the level it is on, never below 0.5, and nothing else.
const pixels = (level, width, height) => level.ratio * level.ratio * width * height;
{
  const { quality: wide, changes } = create(1.5, 1600, 900);
  assert.equal(wide.level.name, 'ultra');
  assert(Math.abs(pixels(wide.level, 1600, 900) - 2.4e6) < 1, `Ultra is fitted to the budget: ${wide.level.ratio}`);
  wide.resize(1280, 720, 0);
  assert.deepEqual(wide.level, { name: 'ultra', ratio: 1.5, samples: 4 }, 'a smaller viewport returns the level to its own scale at once');
  wide.resize(1920, 1200, 1);
  assert(Math.abs(pixels(wide.level, 1920, 1200) - 2.4e6) < 1, 'fullscreen must respect the pixel budget');
  assert.equal(names(changes), 'ultra ultra');
  const uhd = create(1, 3840, 2160);
  const budget = Math.sqrt(2.4e6 / (3840 * 2160));
  assert.deepEqual(uhd.quality.level, { name: 'ultra', ratio: budget, samples: 4 }, '4K at DPR 1 opens at Ultra on the pixel budget');
  uhd.quality.reset(0);
  steady(uhd.quality, 0, 30000, REFRESH);
  assert.equal(uhd.changes.length, 0, 'smooth frames cannot climb past the budget');
  steady(uhd.quality, 30000, 60000, 80);
  assert.deepEqual(uhd.quality.level, { name: 'low', ratio: budget, samples: 2 }, 'every level below keeps the fitted scale');
  // Ultra, High and Medium all fit to the same scale here; High would render as Ultra does, so it is no step.
  assert(!uhd.changes.some(level => level.name === 'high'), `a level that renders as the one above is skipped: ${names(uhd.changes)}`);
  uhd.quality.resize(7680, 4320, 60000);
  assert.equal(uhd.quality.level.ratio, .5, 'the fit has a deliberate minimum');
  uhd.quality.resize(1920, 1080, 60001);
  assert.deepEqual(uhd.quality.level, { name: 'low', ratio: .85, samples: 2 }, 'within the budget the level has its own scale');
  const tiny = create(.5, 7680, 4320).quality;
  tiny.setMode('low', 0); tiny.setMode('auto', 1);
  assert.equal(tiny.level.ratio, .5 * .85, 'the minimum never raises a level above its own scale');
}

// Auto's ladder is the four levels in order, one at a time while frames are only a little long.
{
  const { quality, changes } = create(1.5, 1280, 800);
  quality.reset(0);
  let now = 0;
  for (; now < 60000; now += 20) quality.frame(now, 20);
  assert.deepEqual(changes, [
    { name: 'high', ratio: 1.25, samples: 4 },
    { name: 'medium', ratio: 1, samples: 2 },
    { name: 'low', ratio: .85, samples: 2 },
  ], 'the descent visits every level');
  changes.length = 0;
  for (; now < 400000; now += REFRESH) quality.frame(now, REFRESH);
  assert.equal(names(changes), 'medium high ultra', 'and the climb returns through every level');
}
{
  // On a display at DPR 1 High is Ultra, so Auto has three levels.
  const { quality, changes } = create(1, 1280, 800);
  quality.reset(0);
  for (let now = 0; now < 60000; now += 20) quality.frame(now, 20);
  assert.equal(names(changes), 'medium low');
  quality.setMode('high', 60000); quality.setMode('auto', 60001);
  assert.equal(quality.level.name, 'ultra', 'from a manual High that is Ultra, Auto stands at Ultra');
  steady(quality, 60001, 64000, 20);
  assert.equal(quality.level.name, 'medium');
}
{
  // However far over budget, Auto steps down one level at a time.
  const far = create(1.5, 1280, 800);
  far.quality.reset(0);
  steady(far.quality, 0, 4500, 2 * REFRESH);
  assert.equal(names(far.changes), 'high', 'a 60 fps level missing every other refresh drops one level');
  steady(far.quality, 4500, 13500, 2 * REFRESH);
  assert.equal(names(far.changes), 'high medium low', 'and on through every level to Low');
  run(far.quality, 13500, 40000, 100, false);
  assert.equal(names(far.changes), 'high medium low', 'there is nothing below it');
  const deep = create(1.5, 1280, 800);
  deep.quality.setMode('medium', 0); deep.quality.setMode('auto', 1);
  deep.changes.length = 0;
  steady(deep.quality, 1, 5000, 60);
  assert.equal(names(deep.changes), 'low', 'even far over budget, Medium steps only to Low');
}

// A 30 fps presentation cap (iOS Low Power Mode) is judged against 30 fps once the GPU proves it had time to spare.
const top = { name: 'ultra', ratio: 1.5, samples: 4 };
const capped = create(1.5, 1280, 800);
capped.quality.reset(0);
run(capped.quality, 0, 30000, 1000 / 30, true);
assert.deepEqual(capped.quality.level, top, 'a capped display with GPU to spare keeps its quality');
assert.equal(capped.changes.length, 0);
run(capped.quality, 30000, 32000, 50, true);
assert.equal(capped.quality.level.name, 'high', 'overload at the cap still steps down');
run(capped.quality, 32000, 70000, 1000 / 30, false);
assert.equal(capped.quality.level.name, 'high', 'a smooth capped cadence does not step down further');
run(capped.quality, 70000, 200000, REFRESH, null);
assert.deepEqual(capped.quality.level, top, 'lifting the cap returns to 60 fps judgement and recovers');
run(capped.quality, 200000, 210000, REFRESH, null);
assert(!capped.quality.probing, '60 Hz frames at the ceiling are never timed');
for (const [early, why] of [[false, 'a GPU missing every other 60 Hz refresh still steps down'], [null, 'without GPU timings a steady 33 ms is still overload']]) {
  const { quality } = create(1.5, 1280, 800);
  quality.reset(0);
  run(quality, 0, 6000, 1000 / 30, early);
  assert.notEqual(quality.level.name, 'ultra', why);
}
const jitter = create(1.5, 1280, 800);
jitter.quality.reset(0);
for (let now = 0, i = 0; now < 6000; i++) { const interval = i % 2 ? REFRESH : 1000 / 30; now += interval; jitter.quality.frame(now, interval); if (jitter.quality.probing) jitter.quality.gpu(true); }
assert.notEqual(jitter.quality.level.name, 'ultra', 'alternating 16.7/33 ms intervals are overload, not a cap');
{
  // Below the ceiling every frame is timed for the climb.
  const { quality: q, changes } = create(1.5, 1280, 800);
  q.setMode('low', 0); q.setMode('auto', 1);
  changes.length = 0;
  run(q, 1, 30000, REFRESH, false);
  assert.equal(changes.length, 0, 'Low at a steady 60 fps holds, and frames that are not early never climb');
  assert(q.probing);
  assert.equal(q.probeDeadline(0, 5), 15, 'the climb from Low to Medium asks for frames within 10 ms of submission');
  // A busy main thread leaves some frames untimed.
  for (let now = 30000, i = 0; now < 60000; now += REFRESH, i++) { q.frame(now, REFRESH); q.gpu(i % 5 < 2 ? null : false); }
  assert.equal(changes.length, 0, 'the late frames that were timed still rule the climb out');
  run(q, 60000, 66000, 2 * REFRESH, false);
  assert.equal(changes.length, 0, 'Low missing every other refresh has nowhere lower to go');
  run(q, 66000, 70000, REFRESH, true);
  assert.equal(changes[0]?.name, 'medium', `frames with room climb off Low within seconds, one level at a time: ${names(changes)}`);
}

// Through the real pacer: display callbacks at a capped 30 Hz, and at 60/120/144 Hz, which must never be timed.
const { FramePacer } = await load('gl/frame-pacer.ts');
for (const hz of [30, 60, 120, 144]) {
  const { quality: q, changes: seen } = create(1.5, 1280, 800);
  const pacer = new FramePacer();
  q.reset(0); pacer.reset(0);
  let timed = 0;
  for (let i = 1; i <= hz * 40; i++) {
    const now = i * 1000 / hz;
    if (!pacer.due(now)) continue;
    q.frame(now, pacer.intervalMs);
    if (q.probing) { timed++; q.gpu(true); }
  }
  assert.deepEqual(q.level, top, `${hz} Hz with GPU to spare keeps its quality`);
  assert.equal(seen.length, 0);
  assert.equal(timed > 0, hz === 30, `${hz} Hz timing requests`);
}
for (const hz of [60, 120, 144]) {
  // Auto at Low: the pacer's deliberate waits on a fast display are not overload, and the climb comes on fence evidence.
  const { quality: q, changes: seen } = create(1.5, 1280, 800);
  q.setMode('low', 0); q.setMode('auto', 1);
  seen.length = 0;
  const pacer = new FramePacer();
  q.reset(1); pacer.reset(1);
  let presented = 0, climbedAt = 0;
  for (let i = 1; i <= hz * 30; i++) {
    const now = 1 + i * 1000 / hz;
    if (!pacer.due(now)) continue;
    const at = q.level.name;
    q.frame(now, pacer.intervalMs);
    // Frames are late until 8 s, then early: nothing before that may climb.
    if (q.probing) q.gpu(now > 8000);
    if (at === 'low' && q.level.name === 'medium') climbedAt = now;
    presented++;
  }
  assert(climbedAt > 8000 && climbedAt < 12000, `${hz} Hz: Auto at Low holds, then climbs on fence evidence: ${climbedAt}`);
  assert(Math.abs(presented - 30 * 60) <= 2, `${hz} Hz: every level presents at 60 fps: ${presented}`);
  assert.equal(names(seen), 'medium high ultra');
}
console.log('Levels, QA locks, Auto opening and ceiling, budget fit, ladder order, presentation caps and pacing passed.');

// A GPU-bound device: frame work scales with pixels and eases with the world settings, and a frame that misses a
// refresh waits for the next one (`cap` 2 for a 30 fps display). Work is timed from submission; the model's script
// takes no time. `fence` false stands for frames that can't be timed; `lie` for headroom timings that claim room the
// next level doesn't have.
const WORLD_COST = { ultra: 1, high: 1, medium: .9, low: .8 };
const ORDER = ['low', 'medium', 'high', 'ultra'];
const play = (q, from, to, ms, { fence = true, lie = false, cap = 1, late = 0 } = {}) => {
  const seen = [];
  let interval = REFRESH * cap, frame = 0;
  for (let now = from; now < to; now += interval) {
    q.frame(now, interval);
    const work = ms(q.level, now) * q.level.ratio ** 2 * WORLD_COST[q.level.name];
    // `late` is the share of frames that finish after the deadline whatever the level, as heavier alternate frames do.
    const reportedLate = frame++ % 10 < late * 10;
    if (q.probing && fence) { const deadline = q.probeDeadline(0, 0); q.gpu(!reportedLate && work <= deadline || lie && deadline < REFRESH); }
    interval = Math.max(cap, Math.ceil(work / REFRESH - 1e-6)) * REFRESH;
    seen.push({ now, name: q.level.name });
  }
  return seen;
};
const visits = (seen, name) => seen.filter((row, i) => i && row.name === name && seen[i - 1].name !== name).map(row => row.now);
const backOff = (returns, why) => {
  const gaps = returns.slice(1).map((t, i) => t - returns[i]);
  assert(returns.length >= 2 && returns.length <= 5 && gaps.every((gap, i) => !i || gap > gaps[i - 1]), `${why}: ${returns.map(Math.round)}`);
};
const touchDevice = () => create(1.5, 1376, 1032, { autoRatio: 1.25, samples: 2 });
{
  // 18.8 ms at High misses every other refresh; 10.8 ms at Medium is smooth but too close to prove room for High.
  const { quality: q } = touchDevice();
  q.reset(0);
  const seen = play(q, 0, 300000, () => 12);
  const firstDrop = seen.find(row => row.name !== 'high').now;
  assert(firstDrop <= 4000, `overloaded touch steps down from the top within seconds: ${firstDrop}`);
  assert(!seen.some(row => row.now > firstDrop && row.name === 'high'), 'truthful timings never climb back into overload');
  assert.equal(q.level.name, 'medium', 'but it recovers the level that fits');
  assert(q.probing && q.probeDeadline(0, 0) === 10, 'below the ceiling it keeps timing frames against the headroom deadline');
  assert(visits(seen, 'low').length <= 1, 'without wandering below');
}
{
  // Timings that lie: every climb back fails, the waits between them double, and each failure returns one level.
  const { quality: q } = touchDevice();
  q.reset(0);
  const seen = play(q, 0, 300000, () => 12, { lie: true });
  backOff(visits(seen, 'high'), 'failed climbs back off');
  const settled = seen.findIndex(row => row.name === 'medium');
  assert(seen.slice(settled).every(row => row.name === 'medium' || row.name === 'high'), 'a failed climb returns to the level that held, no lower');
}
{
  // Low holds 60 fps (12 ms) but Medium needs 18.9 ms. Where frames can't be
  // timed the smooth window tries Medium, fails, and tries ever less often; truthful timings never try.
  const weak = () => { const made = create(1.5, 1280, 800); made.quality.setMode('low', 0); made.quality.setMode('auto', 1); made.quality.reset(1); return made.quality; };
  const untimed = play(weak(), 1, 300000, () => 21, { fence: false });
  backOff(visits(untimed, 'medium'), 'failed climbs out of Low back off');
  assert(untimed.every(row => row.name === 'low' || row.name === 'medium'), 'and fall back to Low');
  assert(untimed.filter(row => row.name === 'medium').length < untimed.length * .05, 'so nearly all the time is spent at the level that holds');
  const timed = play(weak(), 1, 300000, () => 21);
  assert(timed.every(row => row.name === 'low'), 'frames that finish after 10 ms rule the climb out');
}
{
  // Headroom at the ceiling (6 ms of work at 1×), pushed down by a five-times load for ten seconds.
  const lifted = (fence, late = 0) => {
    const { quality: q } = touchDevice();
    q.reset(0);
    const seen = play(q, 0, 90000, (_, now) => now < 10000 ? 30 : 6, { fence, late });
    assert(seen.some(row => row.now < 10000 && row.name === 'low'), 'the load pushes it well down');
    const climb = seen.filter(row => row.now >= 10000);
    assert(climb.every((row, i) => !i || ORDER.indexOf(row.name) >= ORDER.indexOf(climb[i - 1].name)), 'the climb never steps back down');
    return climb.find(row => row.name === 'high').now - 10000;
  };
  const timed = lifted(true), untimed = lifted(false), unclear = lifted(true, .5);
  assert(timed <= 8000, `a device with headroom climbs back within seconds once load lifts: ${Math.round(timed)} ms`);
  assert(untimed > 12000, `without GPU timings the smooth window is the fallback: ${Math.round(untimed)} ms`);
  assert.equal(unclear, untimed, 'half the frames late (alternate-frame reflections) neither proves nor rules out headroom');
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
  assert.notEqual(q.level.name, 'high', 'overload at the cap steps down');
  const seen = play(q, 70000, 90000, () => 8, { cap: 2 });
  assert(!q.probing, 'back at the ceiling, frames are no longer timed');
  assert(seen.find(row => row.name === 'high').now - 70000 <= 8000, 'and climbs back within seconds once load lifts');
}
console.log('Auto under load: stepping down without looping back, failed climbs backing off (also out of Low), climbing on GPU headroom within seconds, and 30 fps caps passed.');

const { readQualityMode, saveQualityMode } = await load('gl/quality-preference.ts');
const store = {};
globalThis.localStorage = { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = value; } };
assert.equal(readQualityMode(), 'auto');
for (const [old, mode] of [['high', 'ultra'], ['medium', 'medium'], ['low', 'low'], ['ultra', 'auto'], ['invalid', 'auto']]) {
  store['updraft.quality.v1'] = old;
  assert.equal(readQualityMode(), mode, `a stored ${old} from before the four levels`);
}
store['updraft.quality.v1'] = 'high';
for (const mode of ['high', 'ultra', 'medium', 'low']) {
  saveQualityMode(mode);
  assert.equal(store['updraft.quality.v2'], mode);
  assert.equal(readQualityMode(), mode, 'a new choice wins over the old key');
}
assert.equal(store['updraft.quality.v1'], 'high', 'the old key is left as it was');
saveQualityMode('auto');
assert.equal(readQualityMode(), 'auto', 'choosing Auto is a choice too');
globalThis.localStorage = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
assert.equal(readQualityMode(), 'auto');
assert.doesNotThrow(() => saveQualityMode('low'));
// Touch does not enable the simulation/graphics lite preset behind the governor.
const { readQaParams } = await load('params-qa.ts');
for (const [search, lite] of [['', false], ['?lite=0', false], ['?lite=1', true]]) {
  globalThis.location.search = search;
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  const params = readQaParams();
  assert.equal(params.lite, lite);
  assert.equal(params.mirror, null, 'no implicit reflection cadence override');
}
console.log('Saved choices (old High reads as Ultra) and explicit lite passed.');

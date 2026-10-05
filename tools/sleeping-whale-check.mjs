// The whale asleep across the way, played with real pointer gestures in Chrome for Testing (GPU): sweeps across its
// back only ever tickle it; circles over the blowhole wake it; left alone it is woken only by the gull, after the
// safety valve; a save from before it wakes resumes with it asleep, one from after resumes without it.
// Usage: BASE=http://127.0.0.1:5230/ node tools/sleeping-whale-check.mjs [sweeps] [circles] [idle] [saves]
// Runs against a dev or QA preview server. The idle case waits out the valve (about 90 s of game time).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = 1600;
const H = 900;
const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['sweeps', 'circles', 'idle', 'saves'];

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

/** Everything the check reads from the running game, in one place. */
const STATE = `(() => {
  const c = __game.story.current, s = __game.sealife.sleeper, w = c.sleeper, b = __game.boat;
  return { chapter: __game.story.name, time: c.time, phase: s.phase, awake: s.awake, visible: s.mesh.visible,
    tickles: s.tickles, slaps: s.slaps, gull: s.gull.state, pecked: s.gull.pecked, progress: w ? w.progress : null,
    still: w ? w.still : 0, remaining: w ? w.remaining() : null, speed: b.speed, limit: b.speedLimit,
    checkpoint: c.checkpoint, coax: !!c.coax };
})()`;

async function open(context, query) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&chapter=toMeadow${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  return { page, errors };
}

const read = (page) => page.evaluate(STATE);

async function until(page, test, what, wallSeconds = 240) {
  const end = Date.now() + wallSeconds * 1000;
  for (;;) {
    const s = await read(page);
    if (test(s)) return s;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(s)}`);
    await page.waitForTimeout(250);
  }
}

const atRest = (page) => until(page, (s) => s.phase === 'asleep' && s.still > 1.2, 'the boat at rest beside it');

/** Where a point on the whale is on screen, in pixels: `s` along it from snout (0) to flukes (1), on its back. */
async function onScreen(page, s, up = 0) {
  return page.evaluate(([s, up]) => {
    const w = __game.sealife.sleeper;
    const p = s === 'blowhole' ? w.blowhole.clone() : w.point(0, 1.1, s, w.blowhole.clone());
    p.y += up;
    p.project(__game.rig.camera);
    return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
  }, [s, up]);
}

async function stroke(page, points, ms) {
  const n = Math.max(2, Math.round(ms / 8));
  await page.mouse.move(...points[0]);
  for (let i = 1; i <= n; i++) {
    const f = (i / n) * (points.length - 1);
    const k = Math.min(points.length - 2, Math.floor(f));
    const t = f - k;
    await page.mouse.move(points[k][0] + (points[k + 1][0] - points[k][0]) * t, points[k][1] + (points[k + 1][1] - points[k][1]) * t);
    await page.waitForTimeout(ms / n);
  }
}

/** Round and round over the blowhole, re-aimed each turn, until `done` or the wall clock runs out. */
async function circle(page, done, wallSeconds = 40) {
  const end = Date.now() + wallSeconds * 1000;
  let a = 0;
  for (;;) {
    const [cx, cy] = await onScreen(page, 'blowhole', 1.2);
    for (let i = 0; i < 24; i++) {
      a += (Math.PI * 2) / 24;
      await page.mouse.move(cx + Math.cos(a) * 70, cy + Math.sin(a) * 55);
      await page.waitForTimeout(28);
    }
    const s = await read(page);
    if (done(s)) return s;
    if (Date.now() > end) throw new Error(`circling never got there: ${JSON.stringify(s)}`);
  }
}

const results = {};

async function sweeps() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  await atRest(page);
  let woke = null;
  for (let i = 0; i < 16; i++) {
    const s = 0.15 + (i % 8) * 0.1;
    const [x, y] = await onScreen(page, s);
    if (i % 2 === 0) await stroke(page, [[x - 30, y - 140], [x + 30, y + 140]], 260);
    else {
      const [x2, y2] = await onScreen(page, Math.min(0.95, s + 0.3));
      await stroke(page, [[x - 60, y - 10], [x2 + 60, y2 - 10]], 320);
    }
    await page.mouse.move(W - 10, 10);
    await page.waitForTimeout(500);
    const now = await read(page);
    if (now.phase !== 'asleep') { woke = now; break; }
  }
  await page.waitForTimeout(3000);
  const end = await read(page);
  results.sweeps = { tickles: end.tickles, slaps: end.slaps, phase: end.phase, progress: end.progress, gull: end.gull };
  assert(!woke, `sweeps woke it: ${JSON.stringify(woke)}`);
  assert(end.phase === 'asleep', 'sweeps alone never wake it');
  assert.equal(end.progress, 0, 'sweeps put nothing toward waking it');
  assert(end.tickles > 0, 'sweeps across its back tickle it');
  assert(end.slaps > 0, 'a tickle is answered by a flipper slap');
  assert.deepEqual(errors, []);
  await context.close();
}

async function circles() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const rest = await atRest(page);
  const woke = await circle(page, (s) => s.phase !== 'asleep');
  await page.mouse.move(W - 10, 10);
  const gone = await until(page, (s) => s.phase === 'gone' && s.speed > 1, 'it to go and the boat to sail on', 120);
  results.circles = { restAt: +rest.time.toFixed(1), wokeAt: +woke.time.toFixed(1), awake: woke.awake, slaps: woke.slaps,
    sailingOnAt: +gone.time.toFixed(1), gull: woke.gull };
  assert(woke.phase === 'waking' || woke.phase === 'leaving', 'circles over the blowhole wake it');
  assert.equal(woke.pecked, false, 'the player woke it, not the gull');
  assert.deepEqual(errors, []);
  await context.close();
}

async function idle() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const rest = await atRest(page);
  const restAt = rest.time - rest.still;
  const walking = await until(page, (s) => s.gull !== 'asleep' || s.phase !== 'asleep', 'the gull to go and peck', 600);
  assert(walking.phase === 'asleep', `left alone it woke before the gull went to peck: ${JSON.stringify(walking)}`);
  const woke = await until(page, (s) => s.phase !== 'asleep', 'the gull to wake it', 120);
  results.idle = { restAt: +restAt.toFixed(1), gullWalksAt: +walking.time.toFixed(1), wokeAt: +woke.time.toFixed(1),
    tickles: woke.tickles, progress: woke.progress };
  assert(walking.time - restAt >= 88, `the gull went before the valve: ${(walking.time - restAt).toFixed(1)} s at rest`);
  assert.equal(woke.pecked, true, 'idle, only the gull wakes it');
  assert.equal(woke.tickles, 0, 'the ambient breeze never tickles it');
  assert.equal(woke.progress, 0, 'the ambient breeze never winds it toward waking');
  assert.deepEqual(errors, []);
  await context.close();
}

async function saves() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point ?? null);
  let { page, errors } = await open(context, '&progress=1');
  await atRest(page);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point === 'whale-asleep', null, { timeout: 30000 });
  await page.close();
  ({ page, errors } = await open(context, '&progress=1'));
  const asleep = await read(page);
  assert.equal(asleep.chapter, 'toMeadow');
  assert.equal(asleep.phase, 'asleep', 'a save from before it wakes resumes with it asleep');
  assert.equal(asleep.visible, true);
  assert(asleep.remaining < 2.5 && asleep.speed < 0.5, `resumed beside it: ${JSON.stringify(asleep)}`);
  await circle(page, (s) => s.phase !== 'asleep');
  await page.mouse.move(W - 10, 10);
  await until(page, (s) => s.checkpoint === 'whale-gone', 'the after-whale checkpoint', 120);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point === 'whale-gone', null, { timeout: 30000 });
  const point = await saved(page);
  await page.close();
  ({ page, errors } = await open(context, '&progress=1'));
  const gone = await read(page);
  assert.equal(gone.phase, 'gone', 'a save from after it woke resumes without it');
  assert.equal(gone.visible, false);
  const sailing = await until(page, (s) => s.speed > 2, 'the boat to sail on after the resumed save', 60);
  results.saves = { before: { phase: asleep.phase, remaining: +asleep.remaining.toFixed(2) }, after: { point, phase: gone.phase, speed: +sailing.speed.toFixed(2) } };
  assert.deepEqual(errors, []);
  await context.close();
}

const run = { sweeps, circles, idle, saves };
let failed = false;
for (const name of cases) {
  try {
    await run[name]();
    console.log(`ok   ${name} ${JSON.stringify(results[name])}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name}: ${error.message}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);

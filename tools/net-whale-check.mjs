// The whale in the net on the open sea, played with real pointer gestures in Chrome for Testing (GPU). The breath:
// sweeps across its back only ever tickle it and lift nothing; circles over the blowhole lift the patch of net off it,
// it draws its first full breath, its eye opens on her and the sequence goes on to the line; left alone, under a
// breeze three times the sea's, nothing lifts until the safety valve, whose dolphin leaps and lifts the mesh; a save
// at rest resumes beside it lying there, one after its breath resumes with the patch up and its eye open, and one
// from after it has gone resumes without it, sailing on.
// Usage: BASE=http://127.0.0.1:5230/ node tools/net-whale-check.mjs [sweeps] [circles] [idle] [saves]
// Runs against a dev or QA preview server, starting at rest beside the whale (`?chapter=whale`, as the save there
// resumes). The idle case waits out the valve (about 90 s of game time). `tools/sea-check.mjs` sails the whole way.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = Number(process.env.W ?? 1600);
const H = Number(process.env.H ?? 900);
const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['sweeps', 'circles', 'idle', 'saves'];

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

/** Everything the check reads from the running game, in one place. */
const STATE = `(() => {
  const c = __game.story.current, s = __game.sealife.sleeper, w = c.whale, b = __game.boat;
  return { chapter: __game.story.name, time: c.time, step: w ? w.step : null, stepTime: w ? w.stepTime : 0,
    phase: s.phase, awake: s.awake, visible: s.mesh.visible, tickles: s.tickles, lifts: s.lifts,
    progress: w ? w.progress : null, remaining: w ? w.remaining() : null, speed: b.speed, limit: b.speedLimit,
    checkpoint: c.checkpoint, coax: !!c.coax, lift: __game.sealife.net.lift, net: __game.sealife.net.shown,
    liftedBy: w ? w.liftedBy : null, valveT: w ? w.valveT : -1, eye: s.awake && s.phase === 'woken' && s.time > 3 };
})()`;

async function open(context, query) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&chapter=whale${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  return { page, errors };
}

const read = (page) => page.evaluate(STATE);

async function until(page, test, what, wallSeconds = 300) {
  const end = Date.now() + wallSeconds * 1000;
  for (;;) {
    const s = await read(page);
    if (test(s)) return s;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(s)}`);
    await page.waitForTimeout(250);
  }
}

const atRest = (page) => until(page, (s) => s.step === 'breath' && s.stepTime > 1.2, 'the boat at rest beside it');

/** Where a point on the whale is on screen, in pixels: the blowhole, or `s` along its back (0 snout, 1 flukes). */
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
async function circle(page, done, wallSeconds = 60) {
  const end = Date.now() + wallSeconds * 1000;
  let a = 0;
  for (;;) {
    const [cx, cy] = await onScreen(page, 'blowhole', 1.2);
    for (let i = 0; i < 24; i++) {
      a += (Math.PI * 2) / 24;
      await page.mouse.move(cx + Math.cos(a) * 60, cy + Math.sin(a) * 50);
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
  }
  await page.waitForTimeout(3000);
  const end = await read(page);
  results.sweeps = { tickles: end.tickles, lifts: end.lifts, step: end.step, progress: end.progress };
  assert.equal(end.step, 'breath', 'sweeps alone never move it on');
  assert.equal(end.progress, 0, 'sweeps put nothing toward its breath');
  assert.equal(end.lift, 0, 'sweeps lift none of the net');
  assert.equal(end.net, true, 'the net lies on it');
  assert(end.tickles > 0, 'sweeps across its back tickle it');
  assert(end.lifts > 0, 'a tickle is answered by a lazy lift of the flipper');
  assert.deepEqual(errors, []);
  await context.close();
}

async function circles() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const rest = await atRest(page);
  // Reaching the blowhole from wherever the pointer was is a sweep of its own; only the circling itself is judged.
  const [sx, sy] = await onScreen(page, 'blowhole', 1.2);
  await stroke(page, [[W - 10, 10], [sx + 60, sy]], 400);
  await page.waitForTimeout(1000);
  const before = await read(page);
  const breathed = await circle(page, (s) => s.progress >= 1);
  await page.mouse.move(W - 10, 10);
  const looked = await until(page, (s) => s.eye, 'its eye to open on her', 30);
  const line = await until(page, (s) => s.step === 'line', 'the breath to hand on to the line', 30);
  const free = await until(page, (s) => s.step === 'free', 'it to be free', 60);
  const gone = await until(page, (s) => s.step === 'gone' && s.speed > 1, 'it to go and the boat to sail on', 120);
  results.circles = { restAt: +rest.time.toFixed(1), breathAt: +breathed.time.toFixed(1), eyeAt: +looked.time.toFixed(1),
    lineAt: +line.time.toFixed(1), freeAt: +free.time.toFixed(1), sailingOnAt: +gone.time.toFixed(1), lifts: breathed.lifts - before.lifts };
  assert.equal(before.progress, 0, 'nothing lifted before the circling');
  assert.equal(breathed.liftedBy, 'circles', 'the circles lifted the net');
  assert(looked.phase === 'woken' && looked.lift > 0.9, 'clear of the net, its first full breath, and its eye opens');
  assert.equal(line.lift > 0.95, true, 'the patch stays up after the breath');
  assert.equal(breathed.tickles, before.tickles, 'circles over the blowhole never tickle it');
  assert.deepEqual(errors, []);
  await context.close();
}

async function idle() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const rest = await atRest(page);
  const restAt = rest.time - rest.stepTime;
  // A breeze three times the sea's own, the whole time: it may move the water, never the net.
  await page.evaluate(() => { __game.story.current.breeze = 3; });
  const coaxed = await until(page, (s) => s.coax || s.progress > 0, 'the drawn spiral', 60);
  const sent = await until(page, (s) => s.valveT >= 0 || s.progress > 0, 'the valve to send its dolphin', 300);
  const moving = await until(page, (s) => s.progress > 0, 'the dolphin to lift the net', 60);
  results.idle = { restAt: +restAt.toFixed(1), invitedAt: +coaxed.time.toFixed(1), sentAt: +sent.time.toFixed(1),
    liftedAt: +moving.time.toFixed(1), by: moving.liftedBy, tickles: moving.tickles };
  assert(coaxed.coax && coaxed.progress === 0, 'the spiral invites before anything moves');
  assert(sent.time - restAt >= 88 && sent.progress === 0 && sent.lift === 0, `it moved before the valve: ${(sent.time - restAt).toFixed(1)} s at rest`);
  assert.equal(moving.liftedBy, 'dolphin', 'the valve is the dolphin lifting the mesh');
  assert.equal(moving.tickles, 0, 'the breeze never tickles it');
  await until(page, (s) => s.eye, 'its eye to open after the dolphin', 60);
  await until(page, (s) => s.step === 'line', 'the breath to hand on', 60);
  assert.deepEqual(errors, []);
  await context.close();
}

async function saves() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point ?? null);
  let { page, errors } = await open(context, '&progress=1');
  await atRest(page);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point === 'whale-rest', null, { timeout: 30000 });
  await page.close();
  ({ page, errors } = await open(context, '&progress=1'));
  const resting = await read(page);
  assert.equal(resting.chapter, 'toMirror');
  assert.equal(resting.step, 'breath', 'a save at rest resumes beside it');
  assert.equal(resting.phase, 'resting', 'lying there still');
  assert.equal(resting.visible, true);
  assert(resting.remaining < 3 && resting.speed < 0.5, `resumed at rest: ${JSON.stringify(resting)}`);
  await page.waitForTimeout(1500);
  await circle(page, (s) => s.progress >= 1);
  await page.mouse.move(W - 10, 10);
  await until(page, (s) => s.checkpoint === 'whale-breath', 'the checkpoint after its breath', 60);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point === 'whale-breath', null, { timeout: 30000 });
  await page.close();
  ({ page, errors } = await open(context, '&progress=1'));
  const breathed = await read(page);
  assert.equal(breathed.chapter, 'toMirror');
  assert.equal(breathed.step, 'line', 'a save after its breath resumes at the line');
  assert(breathed.phase === 'woken' && breathed.eye, 'awake, its eye open on her');
  assert(breathed.lift === 1 && breathed.net, 'the patch up off the blowhole');
  assert(breathed.remaining < 3 && breathed.speed < 0.5, `resumed at rest: ${JSON.stringify(breathed)}`);
  await until(page, (s) => s.checkpoint === 'whale-gone', 'the after-whale checkpoint', 120);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point === 'whale-gone', null, { timeout: 30000 });
  const point = await saved(page);
  await page.close();
  ({ page, errors } = await open(context, '&progress=1'));
  const gone = await read(page);
  assert.equal(gone.step, 'gone', 'a save from after it has gone resumes without it');
  assert.equal(gone.visible, false);
  const sailing = await until(page, (s) => s.speed > 2, 'the boat to sail on after the resumed save', 60);
  results.saves = { rest: { step: resting.step, remaining: +resting.remaining.toFixed(2) }, breath: { step: breathed.step, lift: breathed.lift },
    after: { point, step: gone.step, speed: +sailing.speed.toFixed(2) } };
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

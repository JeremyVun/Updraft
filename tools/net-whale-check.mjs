// The whale in the net on the open sea, played with real pointer gestures in Chrome for Testing (GPU).
// The whale's body never answers the wind: sweeps across it and the breeze move nothing on it; only its breath moves it,
// and its flipper when a sweep along it asks.
// The breath: sweeps across its back do nothing and lift nothing; circles over the blowhole lift the patch of
// net off it, it draws its first full breath, its eye opens on her and the sequence goes on to the line; left alone,
// under a breeze three times the sea's, nothing lifts until the safety valve, whose dolphin leaps and lifts the mesh.
// The line: sweeps across the near cork toward the boat bring it to her, she takes it and hauls, each pull peeling the
// net further off into the water, and lets it go; strokes the wrong way only nudge it, held near by its tether; left
// alone under three times the breeze, with sweeps across its back that do nothing, the cork stays where it is
// until the valve, whose dolphin noses it in to her.
// The flipper: the cygnet goes in at once, swims to the loop's free end and holds it; sweeps along the flipper lift it
// and the loop comes off into the bird's pull, the line running unbroken through its bill, the bird never within a
// metre of the flipper; it swims back and is lifted in, and the whale is free. A sweep before the bird has the end
// lifts the flipper but leaves the loop on. Left alone under three times the breeze, with sweeps across its back that
// do nothing and scrubs across the flipper, nothing lifts until the valve, whose dolphin noses the flipper up.
// Saves: one at rest resumes beside it lying there, one after its breath with the patch up and its eye open, one after
// the line with the net off its head and the line let go, one after the flipper with the net loose on the water and
// the cygnet in the satchel as it goes free, and one from after it has gone without it, sailing on.
// The whole open sea from its start (`full`, and `fullidle` with nobody playing): the swim, the lead, the three steps
// by real gestures (or their valves), the release and the mooring at the mirror, with the moment of each.
// Usage: BASE=http://127.0.0.1:5230/ node tools/net-whale-check.mjs [sweeps] [circles] [idle] [line] [wrongway] [lineidle]
//   [fin] [finearly] [finidle] [saves] [full] [fullidle]
// Runs against a dev or QA preview server, starting at rest beside the whale (`?chapter=whale`, as the save there
// resumes); the line's cases resume after its breath and the flipper's after the line. Each idle case waits out a valve
// (about 90 s of game time); `fullidle` waits out all three (about eight minutes of game time) and is not in the default
// set. Run the cases a few at a time: the default set takes over twenty minutes.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = Number(process.env.W ?? 1600);
const H = Number(process.env.H ?? 900);
const cases = process.argv.slice(2).length ? process.argv.slice(2)
  : ['sweeps', 'circles', 'idle', 'line', 'wrongway', 'lineidle', 'fin', 'finearly', 'finidle', 'saves', 'full'];

const browser = await chromium.launch({
  channel: 'chromium',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});

/** Everything the check reads from the running game, in one place. */
const STATE = `(() => {
  const c = __game.story.current, s = __game.sealife.sleeper, w = c.whale, b = __game.boat, n = __game.sealife.net;
  return { chapter: __game.story.name, time: c.time, step: w ? w.step : null, stepTime: w ? w.stepTime : 0,
    phase: s.phase, awake: s.awake, visible: s.mesh.visible, answers: window.__body?.answers ?? 0, lifts: s.lifts,
    progress: w ? w.progress : null, remaining: w ? w.remaining() : null, speed: b.speed, limit: b.speedLimit,
    checkpoint: c.checkpoint, coax: !!c.coax, lift: __game.sealife.net.lift, net: __game.sealife.net.shown,
    liftedBy: w ? w.liftedBy : null, valveT: w ? w.valveT : -1, eye: s.awake && s.phase === 'woken' && s.time > 3,
    haul: w ? w.haul : null, hauledIn: w ? w.hauledIn : 0, broughtBy: w ? w.broughtBy : null, peel: n.peel, gripped: n.grip !== null,
    cork: Math.hypot(n.float.position.x - b.position.x, n.float.position.z - b.position.z),
    corkAt: [n.float.position.x, n.float.position.z], foot: Math.hypot(n.foot.x - b.position.x, n.foot.z - b.position.z),
    tether: Math.hypot(n.float.position.x - n.foot.x, n.float.position.z - n.foot.z), length: n.lineLength,
    invited: w ? !!w.windInvitation : false, bird: w ? w.bird : null, birdT: w ? w.birdT : 0, slipT: w ? w.slipT : -1,
    finnedBy: w ? w.finnedBy : null, loop: n.loop, held: n.held !== null, seat: __game.cygnet.seat, swimming: __game.cygnet.state === 'swimming',
    drift: n.drift, spouting: s.spouting };
})()`;

async function open(context, query) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&chapter=whale${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await watchBody(page);
  return { page, errors };
}

const read = (page) => page.evaluate(STATE);

/**
 * Every frame, whether anything on its body moved other than its breathing: a flipper lifted or swept, or the body
 * rolled off its rest. Read as `answers`, the frames it did.
 */
const watchBody = (page) => page.evaluate(() => {
  const body = window.__body = { answers: 0 };
  const roll = __game.tuning.netWhale.roll;
  const tick = () => {
    const u = __game.sealife.sleeper.uniforms;
    if (__game.sealife.sleeper.phase === 'resting' || __game.sealife.sleeper.phase === 'woken') {
      if (u.uSlap.value.y !== 0 || u.uSlap.value.z !== 0 || Math.abs(u.uRoll.value - roll) > 1e-6) body.answers++;
    }
    requestAnimationFrame(tick);
  };
  tick();
});

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

/** At rest beside it, resumed as the save after its first breath does, the camera settled on the line's hold. */
async function atLine(page) {
  await atRest(page);
  // Parked in the corner by the boat before the line asks anything: the pointer's first move is a stroke too.
  await stroke(page, [[W / 2, 10], [W - 10, 10], [W - 10, H - 10]], 600);
  await page.evaluate(() => { const c = __game.story.current; c.restoreCheckpoint('whale-breath', [c.leg, c.time]); });
  return until(page, (s) => s.step === 'line' && s.stepTime > 6, 'the line, held');
}

/** A point in the world on screen, in pixels. */
const screenOf = (page, expr) => page.evaluate((e) => {
  const p = eval(e).clone().project(__game.rig.camera);
  return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
}, expr);

/** One sweep across the near cork on screen, `way` 1 toward the boat or -1 away from it, from well short to well past. */
async function sweepCork(page, way = 1) {
  const [cx, cy] = await screenOf(page, '__game.sealife.net.float.position');
  const [bx, by] = await screenOf(page, '__game.boat.position');
  const d = Math.hypot(bx - cx, by - cy) || 1;
  const ux = ((bx - cx) / d) * way, uy = ((by - cy) / d) * way;
  await stroke(page, [[cx - ux * 110, cy - uy * 110], [cx + ux * 150, cy + uy * 150]], 240);
  await page.mouse.move(W - 10, H - 10);
  await page.waitForTimeout(1200);
}

/** Sweeps the cork in toward the boat until she reaches for it. */
async function bringCork(page, wallSeconds = 60) {
  const end = Date.now() + wallSeconds * 1000;
  for (;;) {
    const s = await read(page);
    if (s.haul !== 'out') return s;
    if (Date.now() > end) throw new Error(`the sweeps never brought the cork in: ${JSON.stringify(s)}`);
    await sweepCork(page, 1);
  }
}

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

/**
 * The pointer taken off the window and brought back in at (x, y), as a hand leaves the mouse and comes back: no stroke
 * in between. A bare move from wherever it was parked is a stroke of its own across whatever lies between.
 */
async function jumpTo(page, x, y) {
  await page.evaluate(() => __game.renderer.domElement.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
  await page.mouse.move(x, y);
  await page.waitForTimeout(100);
}

/** Off the window: nothing it does is wind. */
const away = (page) => page.evaluate(() => __game.renderer.domElement.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));

/** Points `t` of the way out along the near flipper (0 root .. 1 tip) on screen, in pixels. */
const finOnScreen = (page, ...ts) => page.evaluate((ts) => {
  const s = __game.sealife.sleeper;
  return ts.map((t) => {
    const p = s.finRoot.clone().lerp(s.finTip, t).project(__game.rig.camera);
    return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
  });
}, ts);

/**
 * One sweep along the flipper on screen, from inside its outer half out past its tip; or, `across`, a scrub back and
 * forth across it, which stays on it as long as a sweep along it does.
 */
async function sweepFin(page, across = false) {
  const [[ax, ay], [bx, by]] = await finOnScreen(page, 0.5, 1);
  const d = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / d, uy = (by - ay) / d;
  const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
  const half = Math.max(160, d * 0.65);
  const points = across ? Array.from({ length: 9 }, (_, i) => [mx - uy * 45 * (i % 2 ? 1 : -1) + ux * (i - 4) * 12, my + ux * 45 * (i % 2 ? 1 : -1) + uy * (i - 4) * 12])
    : [[mx - ux * half, my - uy * half], [mx + ux * half, my + uy * half]];
  await jumpTo(page, ...points[0]);
  await stroke(page, points, across ? 640 : 320, true);
  await away(page);
  await page.waitForTimeout(900);
}

/** Sweeps along the flipper until it lifts the loop off. */
async function freeFin(page, wallSeconds = 60) {
  const end = Date.now() + wallSeconds * 1000;
  for (;;) {
    const s = await read(page);
    if (s.slipT >= 0 || s.step !== 'flipper') return s;
    if (Date.now() > end) throw new Error(`the sweeps never lifted the loop off: ${JSON.stringify(s)}`);
    await sweepFin(page);
  }
}

/** At rest beside it, resumed as the save after the line does, until the cygnet holds the loop's end. */
async function atFlipper(page, holding = true) {
  await atRest(page);
  await away(page);
  await page.evaluate(() => { const c = __game.story.current; c.restoreCheckpoint('whale-line', [c.leg, c.time]); });
  await watchBird(page);
  return holding ? until(page, (s) => s.bird === 'holding' && s.birdT > 2.5, 'the cygnet to hold the loop\'s end', 120)
    : until(page, (s) => s.bird === 'out', 'the cygnet to go in', 60);
}

/**
 * How far the flipper reaches from its line (m) at sixteenths of the way from root to tip, on whichever side is wider:
 * `FIN_HALF_CHORD` in `anatomy.ts` at the dream size, turned on its edge, with its bow, droop and knobs.
 */
const FIN_HALF = [0.56, 0.72, 0.9, 1.19, 1.32, 1.37, 1.37, 1.34, 1.28, 1.21, 1.13, 1.03, 0.92, 0.8, 0.67, 0.32, 0.06];
/**
 * Every frame of the flipper step: the least clear water between the cygnet's body and the flipper (its own half-chord
 * round the line from root to tip), and the widest gap between the loop's free end and the bill while it holds it.
 */
const watchBird = (page) => page.evaluate((HALF) => {
  const watch = window.__bird = { clear: Infinity, gap: 0, frames: 0 };
  const half = (t) => { const f = t * 16, i = Math.min(15, Math.floor(f)); return HALF[i] + (HALF[i + 1] - HALF[i]) * (f - i) + 0.05; };
  const bill = new __game.cygnet.position.constructor();
  const p = bill.clone();
  const tick = () => {
    const w = __game.story.current.whale, s = __game.sealife.sleeper, k = __game.cygnet;
    if (w?.step === 'flipper' && k.state === 'swimming') {
      watch.frames++;
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        p.copy(s.finRoot).lerp(s.finTip, t);
        const clear = p.distanceTo(k.position) - half(t) - 0.3;
        if (clear < watch.clear) { watch.clear = clear; watch.at = t; watch.bird = `${w.bird} lift ${s.flipperLift.toFixed(2)}`; }
      }
      if ((w.bird === 'holding' && w.birdT > 1) || w.bird === 'pulling') watch.gap = Math.max(watch.gap, k.billTip(bill).distanceTo(__game.sealife.net.loopEnd));
    }
    requestAnimationFrame(tick);
  };
  tick();
}, FIN_HALF);
const birdWatch = (page) => page.evaluate(() => ({ clear: +window.__bird.clear.toFixed(2), clearAt: window.__bird.at, clearWhen: window.__bird.bird, gap: +window.__bird.gap.toFixed(3), frames: window.__bird.frames }));

async function stroke(page, points, ms, started = false) {
  const n = Math.max(2, Math.round(ms / 8));
  if (!started) await page.mouse.move(...points[0]);
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
  results.sweeps = { answers: end.answers, lifts: end.lifts, step: end.step, progress: end.progress };
  assert.equal(end.step, 'breath', 'sweeps alone never move it on');
  assert.equal(end.progress, 0, 'sweeps put nothing toward its breath');
  assert.equal(end.lift, 0, 'sweeps lift none of the net');
  assert.equal(end.net, true, 'the net lies on it');
  assert.equal(end.answers, 0, 'its body never answers the sweeps');
  assert.equal(end.lifts, 0, 'nor does its flipper');
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
  const line = await until(page, (s) => s.step === 'line' && s.stepTime > 5, 'the breath to hand on to the line', 40);
  await bringCork(page);
  await until(page, (s) => s.step === 'flipper', 'the haul to finish', 60);
  await until(page, (s) => s.bird === 'holding' && s.birdT > 2.5, 'the cygnet to hold the loop\'s end', 120);
  await freeFin(page);
  await away(page);
  const free = await until(page, (s) => s.step === 'free', 'it to be free', 60);
  const gone = await until(page, (s) => s.step === 'gone' && s.speed > 1, 'it to go and the boat to sail on', 120);
  results.circles = { restAt: +rest.time.toFixed(1), breathAt: +breathed.time.toFixed(1), eyeAt: +looked.time.toFixed(1),
    lineAt: +line.time.toFixed(1), freeAt: +free.time.toFixed(1), sailingOnAt: +gone.time.toFixed(1), lifts: breathed.lifts - before.lifts };
  assert.equal(before.progress, 0, 'nothing lifted before the circling');
  assert.equal(breathed.liftedBy, 'circles', 'the circles lifted the net');
  assert(looked.phase === 'woken' && looked.lift > 0.9, 'clear of the net, its first full breath, and its eye opens');
  assert.equal(line.lift > 0.95, true, 'the patch stays up after the breath');
  assert.equal(breathed.answers, before.answers, 'circles over the blowhole move nothing on its body but its breath');
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
    liftedAt: +moving.time.toFixed(1), by: moving.liftedBy, answers: moving.answers };
  assert(coaxed.coax && coaxed.progress === 0, 'the spiral invites before anything moves');
  assert(sent.time - restAt >= 88 && sent.progress === 0 && sent.lift === 0, `it moved before the valve: ${(sent.time - restAt).toFixed(1)} s at rest`);
  assert.equal(moving.liftedBy, 'dolphin', 'the valve is the dolphin lifting the mesh');
  assert.equal(moving.answers, 0, 'the breeze never moves its body');
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
  await until(page, (s) => s.stepTime > 6, 'the line, held', 30);
  await bringCork(page);
  await until(page, (s) => s.checkpoint === 'whale-line', 'the checkpoint after the line', 60);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point === 'whale-line', null, { timeout: 30000 });
  await page.close();
  ({ page, errors } = await open(context, '&progress=1'));
  const hauled = await read(page);
  assert.equal(hauled.chapter, 'toMirror');
  assert.equal(hauled.step, 'flipper', 'a save after the line resumes at the flipper');
  assert(hauled.phase === 'woken' && hauled.eye, 'awake, its eye open on her');
  assert(hauled.peel === 1 && hauled.net, 'the net off its head in the water');
  assert(!hauled.gripped && hauled.haul === 'letting', 'the line let go');
  assert(hauled.remaining < 3 && hauled.speed < 0.5, `resumed at rest: ${JSON.stringify(hauled)}`);
  await until(page, (s) => s.bird === 'holding' && s.birdT > 2.5, 'the cygnet to hold the loop\'s end', 120);
  await freeFin(page);
  await away(page);
  await until(page, (s) => s.checkpoint === 'whale-flipper', 'the checkpoint after the flipper', 60);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point === 'whale-flipper', null, { timeout: 30000 });
  await page.close();
  ({ page, errors } = await open(context, '&progress=1'));
  const finned = await read(page);
  assert.equal(finned.chapter, 'toMirror');
  assert.equal(finned.step, 'free', 'a save after the flipper resumes as it goes free');
  assert(finned.peel === 1 && finned.loop === 1 && !finned.held, 'the net loose on the water');
  assert.equal(finned.seat, 'satchel', 'the cygnet in the satchel');
  assert(finned.remaining < 3 && finned.speed < 0.5, `resumed at rest: ${JSON.stringify(finned)}`);
  const spouted = await until(page, (s) => s.phase === 'free' && s.drift > 0.02, 'it to go free and the net to drift', 30);
  assert.equal(spouted.seat, 'satchel', 'still in the satchel as it goes');
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
    line: { step: hauled.step, peel: hauled.peel }, flipper: { step: finned.step, seat: finned.seat },
    after: { point, step: gone.step, speed: +sailing.speed.toFixed(2) } };
  assert.deepEqual(errors, []);
  await context.close();
}

/**
 * Sweeps across the cork toward the boat bring it to her; she takes the line and hauls it in, each pull peeling the
 * net further off its head, and lets it go; none of those sweeps move the whale behind the cork.
 */
async function line() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const start = await atLine(page);
  const brought = await bringCork(page);
  // Each pull: the line comes in by a pull's length and the net comes that much further off.
  const pulls = [];
  for (;;) {
    const s = await read(page);
    if (s.haul === 'hauling' || s.haul === 'letting') pulls.push([s.hauledIn, s.peel]);
    if (s.step !== 'line') break;
    await page.waitForTimeout(150);
  }
  const after = await until(page, (s) => s.step === 'flipper', 'the haul to finish', 30);
  results.line = { corkFrom: +start.cork.toFixed(2), caughtAt: +brought.cork.toFixed(2), footFrom: +start.foot.toFixed(1), footTo: +after.foot.toFixed(1),
    hauled: +after.hauledIn.toFixed(2), samples: pulls.length, answers: after.answers - start.answers };
  assert.equal(start.haul, 'out');
  assert.equal(start.peel, 0, 'the net lies on its head until she hauls');
  assert.equal(brought.broughtBy, 'sweeps', 'the sweeps brought the cork in');
  assert(brought.cork < start.cork - 1, `the cork came in toward the boat: ${start.cork.toFixed(2)} to ${brought.cork.toFixed(2)}`);
  assert(pulls.length > 10, 'the haul is seen');
  const whole = after.hauledIn;
  for (const [hauled, peel] of pulls) assert(Math.abs(peel * whole - hauled) < 0.05, `the net peels as the line comes in: ${hauled} in, ${peel} peeled`);
  // Between pulls her mittens go back out along the line and nothing comes in: the haul is a few pulls, not a slide.
  const held = new Set(pulls.filter(([h], i) => i > 0 && h > 0 && h < whole && h === pulls[i - 1][0]).map(([h]) => h.toFixed(3)));
  assert(held.size >= 3, `it comes in pull by pull: ${[...held].join(', ')}`);
  assert.equal(after.peel, 1, 'by the end the head is bare');
  assert(after.foot < start.foot - 2, `the hauled corner came toward her: ${start.foot.toFixed(1)} to ${after.foot.toFixed(1)} m`);
  assert.equal(after.answers, start.answers, 'sweeps at the cork never move the whale behind it');
  assert.equal(after.checkpoint, 'whale-line', 'the save after the line');
  assert.deepEqual(errors, []);
  await context.close();
}

/** Strokes across the cork the wrong way only nudge it, and its tether to the net keeps it near; nothing is caught. */
async function wrongway() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const start = await atLine(page);
  let far = start.cork;
  for (let i = 0; i < 6; i++) {
    await sweepCork(page, -1);
    const s = await read(page);
    far = Math.max(far, s.cork);
  }
  await page.waitForTimeout(3000);
  const end = await read(page);
  results.wrongway = { corkFrom: +start.cork.toFixed(2), farthest: +far.toFixed(2), tether: +end.tether.toFixed(2), of: end.length };
  assert.equal(end.haul, 'out', 'nothing is caught');
  assert.equal(end.peel, 0, 'nothing peels');
  assert(far > start.cork + 0.1, 'a stroke the wrong way still moves it a little');
  assert(far < start.cork + 2.5, `the wrong way only nudges it: ${start.cork.toFixed(2)} to ${far.toFixed(2)} m from the boat`);
  assert(end.tether <= end.length + 0.05, 'its tether to the net keeps it near');
  await bringCork(page);
  assert.deepEqual(errors, []);
  await context.close();
}

/**
 * Left alone under three times the sea's breeze, with sweeps across its back that do nothing, the cork stays out
 * where it floats and nothing peels until the valve; then its dolphin noses the cork in to her and she hauls.
 */
async function lineidle() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const start = await atLine(page);
  const lineAt = start.time - start.stepTime;
  await page.evaluate(() => { __game.story.current.breeze = 3; });
  for (let i = 0; i < 10; i++) {
    const s = 0.3 + (i % 5) * 0.12;
    const [x, y] = await onScreen(page, s);
    await stroke(page, [[x - 40, y - 120], [x + 40, y + 60]], 260);
    await page.mouse.move(W - 10, 10);
    await page.waitForTimeout(500);
  }
  const swept = await read(page);
  const invited = await until(page, (s) => s.invited || s.haul !== 'out', 'the drawn sweep', 60);
  const sent = await until(page, (s) => s.valveT >= 0 || s.haul !== 'out', 'the valve to send its dolphin', 300);
  const caught = await until(page, (s) => s.haul !== 'out', 'the dolphin to bring the cork', 60);
  results.lineidle = { lineAt: +lineAt.toFixed(1), answers: swept.answers - start.answers, invitedAt: +(invited.time - lineAt).toFixed(1),
    sentAt: +(sent.time - lineAt).toFixed(1), caughtAt: +(caught.time - lineAt).toFixed(1), drift: +Math.hypot(sent.corkAt[0] - start.corkAt[0], sent.corkAt[1] - start.corkAt[1]).toFixed(2) };
  assert.equal(swept.answers, start.answers, 'sweeps across its back do nothing to it');
  assert.equal(swept.haul, 'out');
  assert(invited.invited && invited.haul === 'out', 'the sweep is drawn before anything comes');
  assert(sent.time - lineAt >= 88 && sent.haul === 'out' && sent.peel === 0, `it moved before the valve: ${(sent.time - lineAt).toFixed(1)} s into the line`);
  assert(Math.hypot(sent.corkAt[0] - start.corkAt[0], sent.corkAt[1] - start.corkAt[1]) < 0.5, 'neither the breeze nor the sweeps on its back moved the cork');
  assert.equal(caught.broughtBy, 'dolphin', 'the valve is the dolphin nosing the cork in');
  await until(page, (s) => s.step === 'flipper' && s.peel === 1, 'the haul after the dolphin', 60);
  assert.deepEqual(errors, []);
  await context.close();
}

/**
 * The cygnet holds the loop's end; sweeps along the flipper lift it and the loop comes off into the bird's pull; it
 * lets go, swims back and is lifted in, and the whale is free.
 */
async function fin() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const start = await atFlipper(page);
  const slipped = await freeFin(page);
  await away(page);
  const off = await until(page, (s) => s.loop >= 1, 'the loop to come off', 30);
  const aboard = await until(page, (s) => s.step === 'free', 'the cygnet back aboard and the whale free', 60);
  const watch = await birdWatch(page);
  results.fin = { holdAt: +(start.stepTime).toFixed(1), liftedAt: +(slipped.stepTime).toFixed(1), offAt: +off.stepTime.toFixed(1),
    freeAt: +(aboard.time - start.time + start.stepTime).toFixed(1), lifts: slipped.lifts - start.lifts, ...watch };
  assert.equal(start.loop, 0, 'the loop is on until it lifts');
  assert.equal(slipped.finnedBy, 'sweeps', 'the sweeps lifted the flipper');
  assert.equal(slipped.lifts - start.lifts, 1, 'one lazy lift takes the loop off');
  assert.equal(aboard.lifts, slipped.lifts, 'the one lift is all its body answers');
  assert(!aboard.held && aboard.seat === 'satchel', 'the line let go and the cygnet back in the satchel before it goes free');
  assert.equal(aboard.checkpoint, 'whale-flipper', 'the save after the flipper');
  assert(watch.clear >= 1, `a metre of clear water between the cygnet and the flipper: ${watch.clear} m`);
  assert(watch.gap < 0.06, `the line runs into the bill while it holds it: ${watch.gap} m`);
  assert.deepEqual(errors, []);
  await context.close();
}

/** Before the cygnet has the loop's end, a sweep along the flipper lifts it lazily but the loop stays on. */
async function finearly() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const start = await atFlipper(page, false);
  for (let i = 0; i < 2; i++) await sweepFin(page);
  const swept = await read(page);
  assert(swept.slipT < 0 && swept.loop === 0, 'the loop stays on while the cygnet has not got the end');
  const holding = await until(page, (s) => s.bird === 'holding' && s.birdT > 2.5, 'the cygnet to hold the loop\'s end', 120);
  await page.waitForTimeout(6000);
  const still = await read(page);
  results.finearly = { lifts: swept.lifts - start.lifts, bird: swept.bird, loop: still.loop };
  assert(swept.lifts > start.lifts, 'a sweep before the cygnet has the end still lifts the flipper');
  assert.notEqual(swept.bird, 'holding', 'it was swept before the cygnet had the end');
  assert(holding.loop === 0 && still.loop === 0 && still.slipT < 0, 'the loop stays on');
  await freeFin(page);
  await until(page, (s) => s.loop >= 1, 'the loop to come off with the end held', 30);
  assert.deepEqual(errors, []);
  await context.close();
}

/**
 * Left alone under three times the sea's breeze, with sweeps across its back that do nothing and scrubs across
 * the flipper, the flipper never lifts and the loop stays on until the valve; then its dolphin noses the flipper up.
 */
async function finidle() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const { page, errors } = await open(context, '');
  const start = await atFlipper(page);
  const holdAt = start.time - start.birdT;
  await page.evaluate(() => { __game.story.current.breeze = 3; });
  for (let i = 0; i < 10; i++) {
    const s = 0.3 + (i % 5) * 0.12;
    const [x, y] = await onScreen(page, s);
    await jumpTo(page, x - 40, y - 120);
    await stroke(page, [[x - 40, y - 120], [x + 40, y + 60]], 260, true);
    await away(page);
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 4; i++) await sweepFin(page, true);
  const swept = await read(page);
  const invited = await until(page, (s) => s.invited || s.slipT >= 0, 'the drawn strokes', 60);
  const sent = await until(page, (s) => s.valveT >= 0 || s.slipT >= 0, 'the valve to send its dolphin', 300);
  const lifted = await until(page, (s) => s.slipT >= 0, 'the dolphin to lift the flipper', 60);
  await until(page, (s) => s.step === 'free', 'it to be free after the dolphin', 90);
  results.finidle = { answers: swept.answers - start.answers, lifts: swept.lifts - start.lifts, invitedAt: +(invited.time - holdAt).toFixed(1),
    sentAt: +(sent.time - holdAt).toFixed(1), liftedAt: +(lifted.time - holdAt).toFixed(1), clear: (await birdWatch(page)).clear };
  assert(sent.time - holdAt >= 88 && sent.slipT < 0 && sent.loop === 0, `it lifted before the valve: ${(sent.time - holdAt).toFixed(1)} s held`);
  assert.equal(swept.answers, start.answers, 'sweeps across its back and scrubs across the flipper move nothing on its body');
  assert.equal(swept.lifts, start.lifts, 'nothing but a sweep along it lifts the flipper');
  assert.equal(swept.loop, 0);
  assert(invited.invited && invited.slipT < 0, 'the strokes are drawn before anything lifts');
  assert.equal(sent.lifts, start.lifts, 'neither the breeze nor the sweeps lifted it');
  assert.equal(lifted.finnedBy, 'dolphin', 'the valve is the dolphin nosing the flipper up');
  assert.deepEqual(errors, []);
  await context.close();
}

/**
 * The whole open sea from its start with real gestures, or (`idle`) with nobody playing: the swim, the lead, the three
 * steps, the release and the mooring at the mirror, with the moment of each in game seconds.
 */
async function voyage(idle) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&chapter=sea`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await away(page);
  const at = {};
  const mark = (name, s) => { at[name] = +s.time.toFixed(1); };
  const rest = await until(page, (s) => s.step === 'breath' && s.stepTime > 1.2, 'the boat at rest beside it', 400);
  mark('rest', { time: rest.time - rest.stepTime });
  if (!idle) {
    await page.waitForTimeout(1500);
    const [sx, sy] = await onScreen(page, 'blowhole', 1.2);
    await jumpTo(page, sx + 60, sy);
    await circle(page, (s) => s.progress >= 1);
    await away(page);
  }
  const line = await until(page, (s) => s.step === 'line', 'the breath to hand on to the line', idle ? 300 : 60);
  mark('breath', line);
  if (!idle) {
    await until(page, (s) => s.stepTime > 6, 'the line, held', 30);
    await bringCork(page);
    await away(page);
  }
  const flipper = await until(page, (s) => s.step === 'flipper', 'the haul to finish', idle ? 300 : 60);
  mark('line', flipper);
  await watchBird(page);
  if (!idle) {
    await until(page, (s) => s.bird === 'holding' && s.birdT > 2.5, 'the cygnet to hold the loop\'s end', 120);
    await freeFin(page);
    await away(page);
  }
  const free = await until(page, (s) => s.step === 'free', 'the flipper and the cygnet back aboard', idle ? 300 : 90);
  mark('flipper', free);
  const spout = await until(page, (s) => s.spouting || s.step === 'gone', 'it to spout free', 30);
  mark('free', spout);
  const gone = await until(page, (s) => s.step === 'gone', 'it to go under', 60);
  mark('gone', gone);
  // The mirror's chapter takes over the moment the boat is moored, so the crossing's own clock is kept as it ends.
  await page.evaluate(() => {
    const m = window.__moored = { at: null, last: 0 };
    const tick = () => {
      const story = __game.story;
      if (story.name === 'toMirror') m.last = story.current.time;
      if (m.at === null && (story.name !== 'toMirror' || story.current.done)) m.at = m.last;
      if (m.at === null) requestAnimationFrame(tick);
    };
    tick();
  });
  await page.waitForFunction(() => window.__moored.at !== null, null, { timeout: 300000, polling: 250 });
  mark('moored', { time: await page.evaluate(() => window.__moored.at) });
  const watch = await birdWatch(page);
  results[idle ? 'fullidle' : 'full'] = { ...at, by: [free.liftedBy, free.broughtBy, free.finnedBy].join('/'), clear: watch.clear };
  const by = idle ? 'dolphin' : null;
  assert.equal(free.liftedBy, by ?? 'circles');
  assert.equal(free.broughtBy, by ?? 'sweeps');
  assert.equal(free.finnedBy, by ?? 'sweeps');
  assert(watch.clear >= 1, `the cygnet keeps clear of the flipper: ${watch.clear} m at ${watch.clearAt} along it, ${watch.clearWhen}`);
  assert.deepEqual(errors, []);
  await context.close();
}
const full = () => voyage(false);
const fullidle = () => voyage(true);

const run = { sweeps, circles, idle, line, wrongway, lineidle, fin, finearly, finidle, saves, full, fullidle };
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

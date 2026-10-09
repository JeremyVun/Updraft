// The whale in the net on the open sea, played with real pointer gestures in Chrome for Testing (GPU).
// The whale's body never answers the wind: only its breath moves it, and its flipper when a stroke at it asks.
// Five steps, each asked by its own drawn gesture and done by any stroke (or about two loops) over a wide area round
// its target: the breath (circles over the blowhole), the eye (a stroke over it lifts the fold off), the line (a
// stroke across the cork brings it to her), the heave (strokes over the net on its head billow it so she hauls; four
// heaves bring it off) and the flipper (a stroke at it or the bird lifts it and the loop comes off into the bill).
// Each idle case leaves its step under three times the breeze, with strokes elsewhere, until its valve's dolphin does
// the same act. `child` plays every step with strokes in random directions across the scene, as a child does.
// Saves: rest, breath (the fold over its eye), eye (the fold off, the cork out), line (the cork in her mittens),
// heave (the line let go), flipper (free) and gone each resume.
// Usage: BASE=http://127.0.0.1:5230/ node tools/net-whale-check.mjs [case ...]
//   cases: sweeps steps child idle eye eyeidle line anyway lineidle heave heaveidle fin finearly finidle saves full fullidle
//   BREAK=<case> loosens that case's guard (a valve sent at 10 s, or strokes counted anywhere) to prove it bites.
// The default set takes about 25 minutes; `fullidle` waits out every valve and is not in it.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';


const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = Number(process.env.W ?? 1600);
const H = Number(process.env.H ?? 900);
const cases = process.argv.slice(2).length ? process.argv.slice(2)
  : ['sweeps', 'steps', 'child', 'idle', 'eye', 'eyeidle', 'line', 'anyway', 'lineidle', 'heave', 'heaveidle', 'fin', 'finearly', 'finidle', 'saves', 'full'];
const BREAK = process.env.BREAK ?? '';

const { browser, close } = await openBrowser();

/** Everything the check reads from the running game, in one place. */
const STATE = `(() => {
  const c = __game.story.current, s = __game.sealife.sleeper, w = c.whale, b = __game.boat, n = __game.sealife.net;
  return { chapter: __game.story.name, time: c.time, step: w ? w.step : null, stepTime: w ? w.stepTime : 0,
    phase: s.phase, awake: s.awake, visible: s.mesh.visible, answers: window.__body?.answers ?? 0, lifts: s.lifts,
    progress: w ? w.progress : null, remaining: w ? w.remaining() : null, speed: b.speed, limit: b.speedLimit,
    checkpoint: c.checkpoint, coax: !!c.coax, lift: __game.sealife.net.lift, net: __game.sealife.net.shown,
    liftedBy: w ? w.liftedBy : null, valveT: w ? w.valveT : -1, eye: s.awake && s.phase === 'woken' && s.skin.uEye.value > 0.8,
    haul: w ? w.haul : null, hauledIn: w ? w.hauledIn : 0, broughtBy: w ? w.broughtBy : null, peel: n.peel, gripped: n.grip !== null,
    cork: Math.hypot(n.float.position.x - b.position.x, n.float.position.z - b.position.z),
    corkAt: [n.float.position.x, n.float.position.z], foot: Math.hypot(n.foot.x - b.position.x, n.foot.z - b.position.z),
    tether: Math.hypot(n.float.position.x - n.foot.x, n.float.position.z - n.foot.z), length: n.lineLength,
    invited: w ? !!w.offered || !!c.coax : false, bird: w ? w.bird : null, birdT: w ? w.birdT : 0, slipT: w ? w.slipT : -1,
    finnedBy: w ? w.finnedBy : null, loop: n.loop, held: n.held !== null, seat: __game.cygnet.seat, swimming: __game.cygnet.state === 'swimming',
    drift: n.drift, spouting: s.spouting, fold: w ? w.fold : 0, foldT: w ? w.foldT : -1, foldedBy: w ? w.foldedBy : null,
    flap: n.flap, lid: s.skin.uEye.value, eyeT: w ? w.eyeT : -1, heaves: w ? w.heaves : 0, heavedBy: w ? w.heavedBy : null,
    billow: n.billow, offered: w ? !!w.offered : false };
})()`;

async function open(context, query) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&chapter=whale${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await watchBody(page);
  await page.evaluate((b) => {
    const k = __game.tuning.netWhale;
    if (b.endsWith('idle')) k.valveAfter = 10;
    else if (b) k.foldRadius = k.corkRadius = k.heaveRadius = k.finRadius = 9;
  }, BREAK);
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

/** At rest beside it, resumed at the save `point` (the pointer parked off the window), until `ready`. */
async function resume(page, point, ready, what) {
  await atRest(page);
  await away(page);
  await page.evaluate((p) => { const c = __game.story.current; c.restoreCheckpoint(p, [c.leg, c.time]); }, point);
  return until(page, ready, what, 120);
}
const atLine = (page) => resume(page, 'whale-eye', (s) => s.step === 'line' && s.stepTime > 6, 'the line, held');
const atEye = (page) => resume(page, 'whale-breath', (s) => s.step === 'eye' && s.offered, 'the eye asked');
const atHeave = (page) => resume(page, 'whale-line', (s) => s.step === 'heave' && s.stepTime > 3, 'the heave, braced');

/** One stroke up across its eye from below the fold, a long one or (`weak`) a short slow one. */
async function sweepEye(page, weak = false) {
  const [ex, ey] = await screenOf(page, '__game.sealife.sleeper.eye');
  const L = weak ? 50 : 260;
  await jumpTo(page, ex - 20, ey + L * 0.5);
  await stroke(page, [[ex - 20, ey + L * 0.5], [ex + 20, ey - L * 0.6]], weak ? 300 : 280, true);
  await away(page);
  await page.waitForTimeout(700);
}

/** One stroke from the net on its head toward her, over the water between. */
async function sweepHead(page) {
  const [hx, hy] = await screenOf(page, '(() => { const s = __game.sealife.sleeper; return s.eye.clone().lerp(s.blowhole, 0.45); })()');
  const [bx, by] = await screenOf(page, '__game.boat.position');
  await jumpTo(page, hx, hy);
  await stroke(page, [[hx, hy], [(hx + bx) / 2, (hy + by) / 2]], 300, true);
  await away(page);
  await page.waitForTimeout(500);
}

/** Strokes until `done`, at most `most` of them; the number it took. */
async function strokesUntil(page, sweep, done, most, what) {
  for (let n = 0; n <= most; n++) {
    if (done(await read(page))) return n;
    if (n === most) break;
    await sweep(page);
  }
  throw new Error(`${most} strokes never ${what}: ${JSON.stringify(await read(page))}`);
}

/** A point in the world on screen, in pixels. */
const screenOf = (page, expr) => page.evaluate((e) => {
  const p = eval(e).clone().project(__game.rig.camera);
  return [(p.x * 0.5 + 0.5) * innerWidth, (0.5 - p.y * 0.5) * innerHeight];
}, expr);

/**
 * One sweep across the near cork on screen, `way` 1 toward the boat or -1 away from it, from well short to well past.
 * The pointer comes in at the start and leaves at the end, as a hand does: a bare move to or from a parked corner is
 * a stroke of its own, back across the cork.
 */
async function sweepCork(page, way = 1) {
  const [cx, cy] = await screenOf(page, '__game.sealife.net.float.position');
  const [bx, by] = await screenOf(page, '__game.boat.position');
  const d = Math.hypot(bx - cx, by - cy) || 1;
  const ux = ((bx - cx) / d) * way, uy = ((by - cy) / d) * way;
  await jumpTo(page, cx - ux * 110, cy - uy * 110);
  await stroke(page, [[cx - ux * 110, cy - uy * 110], [cx + ux * 150, cy + uy * 150]], 240, true);
  await away(page);
  await page.mouse.move(W - 10, H - 10);
  await page.waitForTimeout(1200);
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

/** At rest beside it, resumed as the save after the line does, until the cygnet holds the loop's end. */
async function atFlipper(page, holding = true) {
  await atRest(page);
  await away(page);
  await page.evaluate(() => { const c = __game.story.current; c.restoreCheckpoint('whale-heave', [c.leg, c.time]); });
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
const ctx = () => browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const loops = { n: 0 };
const counted = (page, done) => circle(page, (s) => { loops.n++; return done(s); });

async function sweeps() {
  const context = await ctx();
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
  assert.equal(end.answers, 0, 'its body never answers the sweeps');
  assert.equal(end.lifts, 0, 'nor does its flipper');
  assert.deepEqual(errors, []);
  await context.close();
}

/** The five steps from rest with real gestures: how many loops or strokes each took, and that each was the player's. */
async function steps() {
  const context = await ctx();
  const { page, errors } = await open(context, '');
  const rest = await atRest(page);
  await until(page, (s) => s.coax, 'the drawn spiral', 10);
  const [sx, sy] = await onScreen(page, 'blowhole', 1.2);
  await jumpTo(page, sx + 60, sy);
  loops.n = 0;
  await counted(page, (s) => s.progress >= 1);
  const loopsTaken = loops.n;
  await away(page);
  await until(page, (s) => s.step === 'eye' && s.offered, 'the eye asked', 30);
  const eye = await strokesUntil(page, sweepEye, (s) => s.foldT >= 0, 4, 'lifted the fold off its eye');
  const opened = await until(page, (s) => s.eye, 'its eye open on her', 20);
  await until(page, (s) => s.step === 'line' && s.offered, 'the line asked', 40);
  const line = await strokesUntil(page, (p) => sweepCork(p, 1), (s) => s.haul !== 'out', 4, 'brought the cork');
  await until(page, (s) => s.step === 'heave' && s.haul === 'bracing', 'the heave', 20);
  const heave = await strokesUntil(page, sweepHead, (s) => s.haul === 'letting' || s.step === 'flipper', 10, 'heaved the net off');
  const heaved = await read(page);
  await until(page, (s) => s.bird === 'holding' && s.birdT > 1, 'the cygnet to hold the loop\'s end', 120);
  const fin = await strokesUntil(page, sweepFin, (s) => s.slipT >= 0 || s.step !== 'flipper', 4, 'lifted the flipper');
  const free = await until(page, (s) => s.step === 'free', 'it to be free', 60);
  results.steps = { loops: loopsTaken, eye, line, heave, fin, eyeAt: +(opened.time - rest.time).toFixed(1), freeAt: +(free.time - rest.time).toFixed(1) };
  assert(loopsTaken <= 3, `about two loops lift the patch: ${loopsTaken}`);
  assert(eye <= 2 && line <= 3 && fin <= 3, 'one to three strokes a step');
  assert(heave <= 6, `about four heaves, a stroke each: ${heave}`);
  assert.deepEqual([free.liftedBy, free.foldedBy, free.broughtBy, free.heavedBy, free.finnedBy], ['circles', 'sweeps', 'sweeps', 'sweeps', 'sweeps']);
  assert.equal(heaved.answers, rest.answers, 'nothing on its body answers the wind before its flipper');
  assert.deepEqual(errors, []);
  await context.close();
}

/** A child's play: strokes in random directions across the middle of the scene, and circles somewhere near the blowhole. */
async function child() {
  let seed = Number(process.env.SEED ?? 7);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const context = await ctx();
  const { page, errors } = await open(context, '');
  await atRest(page);
  const tries = {};
  for (let n = 0; n < 200; n++) {
    const s = await read(page);
    if (s.step === 'free') break;
    const asking = (s.step === 'breath' && s.progress < 1) || (s.step === 'eye' && s.foldT < 0) || (s.step === 'line' && s.haul === 'out')
      || (s.step === 'heave' && s.haul === 'bracing') || (s.step === 'flipper' && s.bird === 'holding' && s.slipT < 0);
    if (!asking) { await page.waitForTimeout(400); continue; }
    tries[s.step] = (tries[s.step] ?? 0) + 1;
    if (s.step === 'breath') {
      const [cx, cy] = await onScreen(page, 'blowhole', 1.2);
      const x = cx + (rnd() - 0.5) * W * 0.25, y = cy + (rnd() - 0.5) * H * 0.25, r = Math.min(W, H) * (0.04 + 0.06 * rnd()), way = rnd() < 0.5 ? 1 : -1;
      await jumpTo(page, x + r, y);
      for (let i = 1; i <= 48; i++) { await page.mouse.move(x + Math.cos(way * i * Math.PI / 12) * r, y + Math.sin(way * i * Math.PI / 12) * r); await page.waitForTimeout(30); }
    } else {
      const x = W * (0.15 + 0.7 * rnd()), y = H * (0.2 + 0.65 * rnd()), a = rnd() * Math.PI * 2, L = Math.min(W, H) * (0.15 + 0.3 * rnd());
      await jumpTo(page, x, y);
      await stroke(page, [[x, y], [x + Math.cos(a) * L, y + Math.sin(a) * L]], 200 + rnd() * 300, true);
    }
    await away(page);
    await page.waitForTimeout(300);
  }
  const end = await read(page);
  results.child = { ...tries, by: [end.liftedBy, end.foldedBy, end.broughtBy, end.heavedBy, end.finnedBy].join('/') };
  assert.equal(end.step, 'free', 'a child\'s play frees it');
  assert.deepEqual([end.liftedBy, end.foldedBy, end.broughtBy, end.heavedBy, end.finnedBy], ['circles', 'sweeps', 'sweeps', 'sweeps', 'sweeps']);
  assert((tries.breath ?? 0) <= 2, `two goes of circling lift the patch: ${tries.breath}`);
  for (const step of ['eye', 'line', 'flipper']) assert((tries[step] ?? 0) <= 8, `a few random strokes do the ${step}: ${tries[step]}`);
  assert((tries.heave ?? 0) <= 16, `a few random strokes a heave: ${tries.heave}`);
  assert.deepEqual(errors, []);
  await context.close();
}

/** Strokes far along its back, away from every target, under three times the sea's breeze. */
async function elsewhere(page) {
  await page.evaluate(() => { __game.story.current.breeze = 3; });
  for (let i = 0; i < 8; i++) {
    const [x, y] = await onScreen(page, 0.5 + (i % 4) * 0.07);
    await jumpTo(page, x - 40, y - 100);
    await stroke(page, [[x - 40, y - 100], [x + 40, y + 40]], 260, true);
    await away(page);
    await page.waitForTimeout(400);
  }
}

/** Left to itself after `at`, nothing does the step until its valve, whose dolphin does what a stroke would. */
async function idleStep(name, at, moved, by, from = (s) => s.time - s.stepTime) {
  const context = await ctx();
  const { page, errors } = await open(context, '');
  const start = await at(page);
  const t0 = from(start);
  await elsewhere(page);
  const swept = await read(page);
  const offered = await until(page, (s) => s.invited || moved(s), 'the drawn gesture', 60);
  const sent = await until(page, (s) => s.valveT >= 0 || moved(s), 'the valve to send its dolphin', 300);
  const done = await until(page, moved, 'the dolphin to do it', 60);
  results[name] = { offeredAt: +(offered.time - t0).toFixed(1), sentAt: +(sent.time - t0).toFixed(1), doneAt: +(done.time - t0).toFixed(1), by: done[by] };
  assert(!moved(swept), 'the breeze and strokes elsewhere do nothing');
  assert(offered.invited && !moved(offered), 'the gesture is drawn before anything moves');
  assert(sent.time - t0 >= 88 && !moved(sent), `it moved before the valve: ${(sent.time - t0).toFixed(1)} s`);
  assert.equal(done[by], 'dolphin', 'the valve is the dolphin doing it');
  assert.equal(swept.answers, start.answers, 'its body never answers');
  assert.deepEqual(errors, []);
  await context.close();
}
const idle = () => idleStep('idle', atRest, (s) => s.progress > 0, 'liftedBy');
const eyeidle = () => idleStep('eyeidle', atEye, (s) => s.fold > 0, 'foldedBy');
const lineidle = () => idleStep('lineidle', atLine, (s) => s.haul !== 'out', 'broughtBy');
const heaveidle = () => idleStep('heaveidle', atHeave, (s) => s.heaves > 0 || s.haul === 'heaving', 'heavedBy');
const finidle = () => idleStep('finidle', atFlipper, (s) => s.slipT >= 0, 'finnedBy', (s) => s.time - s.birdT);

/** Its lid struggles under the fold; a weak stroke lifts it part way and it sags back; a good one flips it off and its eye opens on her. */
async function eye() {
  const context = await ctx();
  const { page, errors } = await open(context, '');
  const start = await atEye(page);
  let lid = 0;
  for (let i = 0; i < 16; i++) { lid = Math.max(lid, (await read(page)).lid); await page.waitForTimeout(250); }
  await sweepEye(page, true);
  const weak = await read(page);
  await page.waitForTimeout(1500);
  const sagged = await read(page);
  const good = await strokesUntil(page, sweepEye, (s) => s.foldT >= 0, 3, 'flipped the fold');
  const opened = await until(page, (s) => s.eye, 'its eye open on her', 15);
  const line = await until(page, (s) => s.step === 'line', 'the look to hand on to the line', 20);
  results.eye = { tries: +lid.toFixed(2), weak: +weak.fold.toFixed(2), flap: [+weak.flap.toFixed(2), +sagged.flap.toFixed(2)], good, openAfter: +opened.foldT.toFixed(1) };
  assert(lid > 0.15 && !start.eye, `its lid tries to lift under the fold: ${lid}`);
  assert(weak.fold > 0 && weak.fold < 1 && weak.foldT < 0, `a weak stroke lifts it part way: ${weak.fold}`);
  assert(sagged.flap < weak.flap && sagged.flap > 0, 'and it sags back a little');
  assert(good <= 2, `one or two good strokes flip it: ${good}`);
  assert.equal(opened.foldedBy, 'sweeps');
  assert.equal(opened.answers, start.answers, 'only the net moves, never its body');
  assert.equal(line.checkpoint, 'whale-eye', 'the save after its eye');
  assert.deepEqual(errors, []);
  await context.close();
}

async function line() {
  const context = await ctx();
  const { page, errors } = await open(context, '');
  const start = await atLine(page);
  const strokes = await strokesUntil(page, (p) => sweepCork(p, 1), (s) => s.haul !== 'out', 3, 'brought the cork');
  const braced = await until(page, (s) => s.step === 'heave', 'her to take the line', 20);
  results.line = { strokes, corkFrom: +start.cork.toFixed(2), checkpoint: braced.checkpoint };
  assert.equal(braced.broughtBy, 'sweeps');
  assert(braced.gripped && braced.peel === 0, 'the cork in her mittens, the net on its head');
  assert.equal(braced.checkpoint, 'whale-line', 'the save with the cork in her mittens');
  assert.equal(braced.answers, start.answers, 'strokes at the cork never move the whale');
  assert.deepEqual(errors, []);
  await context.close();
}

/** A stroke the other way across the cork still brings it toward her: its direction only bends its path. */
async function anyway() {
  const context = await ctx();
  const { page, errors } = await open(context, '');
  const start = await atLine(page);
  await sweepCork(page, -1);
  await page.waitForTimeout(1500);
  const after = await read(page);
  results.anyway = { corkFrom: +start.cork.toFixed(2), corkTo: +after.cork.toFixed(2), haul: after.haul };
  assert(after.haul !== 'out' || after.cork < start.cork - 0.4, `a stroke away from the boat still brings it: ${start.cork.toFixed(2)} to ${after.cork.toFixed(2)} m`);
  assert.deepEqual(errors, []);
  await context.close();
}

/** Braced, the net will not come; each stroke over its head billows it and she heaves; four heaves bring it off. */
async function heave() {
  const context = await ctx();
  const { page, errors } = await open(context, '');
  const start = await atHeave(page);
  await page.waitForTimeout(3000);
  const stuck = await read(page);
  const pulls = [];
  let strokes = 0;
  for (; strokes < 12; strokes++) {
    const s = await read(page);
    if (s.haul === 'letting' || s.step === 'flipper') break;
    await sweepHead(page);
    for (let i = 0; i < 6; i++) { const t = await read(page); pulls.push([t.heaves, t.peel, t.billow]); await page.waitForTimeout(150); }
  }
  const after = await until(page, (s) => s.step === 'flipper', 'the line let go and the bird to see the loop', 20);
  results.heave = { strokes, heaves: after.heaves, billowed: +Math.max(...pulls.map((p) => p[2])).toFixed(2) };
  assert(stuck.gripped && stuck.haul === 'bracing' && stuck.peel === 0, 'braced, the net will not come');
  assert.equal(after.heaves, 4, 'four heaves');
  assert(strokes <= 6, `a stroke a heave: ${strokes}`);
  assert.equal(after.peel, 1, 'the net off its head');
  const peels = [...new Set(pulls.filter((p) => p[1] > 0 && p[1] < 1).map((p) => p[1].toFixed(2)))];
  assert(peels.length >= 3, 'it comes off heave by heave');
  assert.equal(after.heavedBy, 'sweeps');
  assert.equal(after.answers, start.answers, 'only the net moves on its head');
  assert.deepEqual(errors, []);
  await context.close();
}

async function fin() {
  const context = await ctx();
  const { page, errors } = await open(context, '');
  const start = await atFlipper(page);
  const strokes = await strokesUntil(page, sweepFin, (s) => s.slipT >= 0, 3, 'lifted the flipper');
  const slipped = await read(page);
  const aboard = await until(page, (s) => s.step === 'free', 'the cygnet back aboard and the whale free', 60);
  const watch = await birdWatch(page);
  results.fin = { strokes, lifts: slipped.lifts - start.lifts, ...watch };
  assert.equal(slipped.finnedBy, 'sweeps');
  assert.equal(aboard.lifts - start.lifts, 1, 'one lazy lift takes the loop off');
  assert(!aboard.held && aboard.seat === 'satchel', 'the cygnet back in the satchel before it goes free');
  assert.equal(aboard.checkpoint, 'whale-flipper');
  assert(watch.clear >= 1, `a metre of clear water between the cygnet and the flipper: ${watch.clear} m`);
  assert(watch.gap < 0.06, `the line runs into the bill while it holds it: ${watch.gap} m`);
  assert.deepEqual(errors, []);
  await context.close();
}

/** Before the cygnet has the loop's end, a stroke at the flipper lifts it lazily but the loop stays on. */
async function finearly() {
  const context = await ctx();
  const { page, errors } = await open(context, '');
  const start = await atFlipper(page, false);
  await sweepFin(page);
  const swept = await read(page);
  const holding = await until(page, (s) => s.bird === 'holding' && s.birdT > 2.5, 'the cygnet to hold the loop\'s end', 120);
  results.finearly = { lifts: swept.lifts - start.lifts, bird: swept.bird, loop: holding.loop };
  assert(swept.lifts > start.lifts && swept.bird !== 'holding', 'a stroke before the cygnet has the end still lifts the flipper');
  assert(holding.loop === 0 && holding.slipT < 0, 'the loop stays on');
  await strokesUntil(page, sweepFin, (s) => s.slipT >= 0, 4, 'lifted the flipper with the end held');
  assert.deepEqual(errors, []);
  await context.close();
}

async function saves() {
  const context = await ctx();
  const point = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point ?? null);
  const kept = (page, p) => page.waitForFunction((p) => JSON.parse(localStorage.getItem('updraft.progress.v1') ?? 'null')?.point === p, p, { timeout: 60000 });
  let { page, errors } = await open(context, '&progress=1');
  const reopen = async (p) => { await kept(page, p); await page.close(); ({ page, errors } = await open(context, '&progress=1')); await page.waitForTimeout(1500); return read(page); };
  await atRest(page);
  const rest = await reopen('whale-rest');
  assert(rest.step === 'breath' && rest.phase === 'resting' && rest.remaining < 3, `rest: ${JSON.stringify(rest)}`);
  const [sx, sy] = await onScreen(page, 'blowhole', 1.2);
  await jumpTo(page, sx + 60, sy);
  await circle(page, (s) => s.progress >= 1);
  await away(page);
  await until(page, (s) => s.step === 'eye', 'the eye', 30);
  const breath = await reopen('whale-breath');
  assert(breath.step === 'eye' && breath.fold === 0 && !breath.eye && breath.lift === 1, `breath: the fold over its eye, ${JSON.stringify(breath)}`);
  await until(page, (s) => s.offered, 'the eye asked', 20);
  await strokesUntil(page, sweepEye, (s) => s.foldT >= 0, 4, 'flipped the fold');
  await until(page, (s) => s.step === 'line', 'the line', 30);
  const eyed = await reopen('whale-eye');
  assert(eyed.step === 'line' && eyed.eye && eyed.flap === 1 && eyed.haul === 'out', `eye: the fold off and its eye open, ${JSON.stringify(eyed)}`);
  await until(page, (s) => s.stepTime > 6, 'the line held', 20);
  await strokesUntil(page, (p) => sweepCork(p, 1), (s) => s.haul !== 'out', 4, 'brought the cork');
  await until(page, (s) => s.step === 'heave', 'the heave', 20);
  const lined = await reopen('whale-line');
  assert(lined.step === 'heave' && lined.gripped && lined.haul === 'bracing' && lined.peel === 0, `line: the cork in her mittens, ${JSON.stringify(lined)}`);
  await strokesUntil(page, sweepHead, (s) => s.haul === 'letting' || s.step === 'flipper', 10, 'heaved it off');
  const heaved = await reopen('whale-heave');
  assert(heaved.step === 'flipper' && heaved.peel === 1 && !heaved.gripped && heaved.eye, `heave: the line let go, ${JSON.stringify(heaved)}`);
  await until(page, (s) => s.bird === 'holding' && s.birdT > 1, 'the cygnet to hold the end', 120);
  await strokesUntil(page, sweepFin, (s) => s.slipT >= 0, 4, 'lifted the flipper');
  const finned = await reopen('whale-flipper');
  assert(finned.step === 'free' && finned.seat === 'satchel', `flipper: ${JSON.stringify(finned)}`);
  await until(page, (s) => s.checkpoint === 'whale-gone', 'the after-whale checkpoint', 120);
  const gone = await reopen('whale-gone');
  assert(gone.step === 'gone' && !gone.visible, 'a save from after it has gone resumes without it');
  await until(page, (s) => s.speed > 2, 'the boat to sail on', 60);
  results.saves = { points: ['rest', 'breath', 'eye', 'line', 'heave', 'flipper', 'gone'], last: await point(page) };
  assert.deepEqual(errors, []);
  await context.close();
}

/** The whole open sea from its start with real gestures, or (`idle`) with nobody playing, with the moment of each step. */
async function voyage(idle) {
  const context = await ctx();
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
  const wait = idle ? 300 : 60;
  if (!idle) {
    const [sx, sy] = await onScreen(page, 'blowhole', 1.2);
    await jumpTo(page, sx + 60, sy);
    await circle(page, (s) => s.progress >= 1);
    await away(page);
  }
  mark('breath', await until(page, (s) => s.step === 'eye', 'the eye', wait));
  if (!idle) { await until(page, (s) => s.offered, 'the eye asked', 20); await strokesUntil(page, sweepEye, (s) => s.foldT >= 0, 4, 'flipped the fold'); }
  mark('eye', await until(page, (s) => s.step === 'line', 'the line', wait));
  if (!idle) { await until(page, (s) => s.stepTime > 6, 'the line held', 20); await strokesUntil(page, (p) => sweepCork(p, 1), (s) => s.haul !== 'out', 4, 'brought the cork'); }
  mark('line', await until(page, (s) => s.step === 'heave', 'the heave', wait));
  if (!idle) await strokesUntil(page, sweepHead, (s) => s.haul === 'letting' || s.step === 'flipper', 10, 'heaved it off');
  mark('heave', await until(page, (s) => s.step === 'flipper', 'the flipper', wait));
  await watchBird(page);
  if (!idle) { await until(page, (s) => s.bird === 'holding' && s.birdT > 1, 'the cygnet to hold the end', 120); await strokesUntil(page, sweepFin, (s) => s.slipT >= 0, 4, 'lifted the flipper'); }
  const free = await until(page, (s) => s.step === 'free', 'the flipper and the cygnet back aboard', idle ? 300 : 90);
  mark('flipper', free);
  mark('gone', await until(page, (s) => s.step === 'gone', 'it to go under', 90));
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
  const by = [free.liftedBy, free.foldedBy, free.broughtBy, free.heavedBy, free.finnedBy];
  results[idle ? 'fullidle' : 'full'] = { ...at, by: by.join('/'), clear: watch.clear };
  assert.deepEqual(by, idle ? Array(5).fill('dolphin') : ['circles', 'sweeps', 'sweeps', 'sweeps', 'sweeps']);
  assert(watch.clear >= 1, `the cygnet keeps clear of the flipper: ${watch.clear} m`);
  assert.deepEqual(errors, []);
  await context.close();
}
const full = () => voyage(false);
const fullidle = () => voyage(true);

const run = { sweeps, steps, child, idle, eye, eyeidle, line, anyway, lineidle, heave, heaveidle, fin, finearly, finidle, saves, full, fullidle };
let failed = false;
for (const name of cases) {
  try {
    await run[name]();
    console.log(`ok   ${name} ${JSON.stringify(results[name])}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name}: ${error.message} ${JSON.stringify(results[name] ?? {})}`);
  }
  // A failed case's page would keep playing, and a second running page slows the next boot's compiles past the wait.
  for (const context of browser.contexts()) await context.close();
}
await close();
process.exit(failed ? 1 : 0);

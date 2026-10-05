// The drowned village's stranded cat, played with real pointer gestures in Chrome for Testing against a running dev
// server: the boat comes round to the cat and waits, strokes across the wash-tub on screen carry it to the cat's roof,
// the cat gets in, more strokes bring the tub to the bow, the cat jumps aboard and the boat sails on, comes to rest
// against the cottage, the dark comes on, the cat bolts over the roof and the child climbs out after it to the ridge.
// Fails if waiting moves the tub toward the roof, if no drawn gust is offered, or if any of those steps does not happen.
// Usage: node tools/drowned-roofs-check.mjs   env: BASE (default http://127.0.0.1:5230/), SHOTS=<prefix> saves stills,
//        W/H viewport (default 1600x900), IDLE seconds of waiting at the tub first (default 14), VALVE=1 instead
//        waits out the safety valve with no input at all (both trips), DEBUG=1 prints each stroke.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600), height = Number(process.env.H ?? 900);
const shots = process.env.SHOTS ?? null;
const idle = Number(process.env.IDLE ?? 14);

const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?shot=1&chapter=drowned&ratio=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const state = () => page.evaluate(() => {
    const s = __game.story.current, c = s.cat, t = __game.village.tub, r = (v) => v.toArray().map((x) => +x.toFixed(2));
    return { time: +__stats.time.toFixed(1), beat: s.beat, step: c.step, tub: r(t.position), docked: t.docked, carried: !!t.carry,
      goal: r(c.goal), invited: !!s.windInvitation, heading: s.invitationHeading, boat: r(__game.boat.position),
      speed: +__game.boat.speed.toFixed(2), cat: r(__game.cat.position), child: r(__game.child.position),
      seat: __game.cygnet.seat };
  });
  const shot = async (name) => { if (shots) { await page.screenshot({ path: `${shots}-${name}.png` }); console.log(`${shots}-${name}.png`); } };
  const waitFor = (test, timeout, what) => page.waitForFunction(test, null, { timeout, polling: 100 })
    .catch(async () => assert.fail(`${what} did not happen: ${JSON.stringify(await state())}`));
  /** Where a world point is on screen, as a fraction of the viewport. */
  const screen = (expr) => page.evaluate((e) => {
    const p = eval(e).clone().project(__game.rig.camera);
    return [(p.x + 1) / 2, (1 - p.y) / 2];
  }, expr);
  let at = [0.5, 0.97];
  /** Drift over to a place too slowly to make any wind on the way. */
  const drift = async ([x, y]) => {
    const steps = Math.ceil(Math.hypot((x - at[0]) * width, (y - at[1]) * height) / 1.5);
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move((at[0] + (x - at[0]) * i / steps) * width, (at[1] + (y - at[1]) * i / steps) * height);
      await page.waitForTimeout(16);
    }
    at = [x, y];
    await page.waitForTimeout(300);
  };
  /** Moves through the points over `ms` of real time, however long each move takes to deliver. */
  const glide = async (points, ms) => {
    await drift(points[0]);
    const start = Date.now();
    for (;;) {
      const done = Math.min(1, (Date.now() - start) / ms);
      const f = done * (points.length - 1), k = Math.min(points.length - 2, Math.floor(f)), t = f - k;
      const [ax, ay] = points[k], [bx, by] = points[k + 1];
      at = [ax + (bx - ax) * t, ay + (by - ay) * t];
      await page.mouse.move(at[0] * width, at[1] * height);
      if (done >= 1) break;
      await page.waitForTimeout(12);
    }
  };
  /** One stroke across the tub on screen, from a little behind it toward where it has to go. */
  const push = async () => {
    const [tx, ty] = await screen('__game.village.tub.position.clone().setY(__game.village.tub.position.y + 0.15)');
    const [gx, gy] = await screen('__game.story.current.cat.goal');
    let dx = (gx - tx) * width, dy = (gy - ty) * height;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const back = 0.07, on = 0.11;
    await glide([[tx - dx * back * height / width, ty - dy * back], [tx + dx * on * height / width, ty + dy * on]], 240);
    await page.waitForTimeout(650);
    if (process.env.DEBUG) console.log('  push', JSON.stringify(await state()));
  };
  /** Strokes at the tub until `test` holds of the state, at most `limit` of them; returns how many it took. */
  const bring = async (test, limit, what) => {
    for (let i = 0; i < limit; i++) {
      if (test(await state())) return i;
      await push();
    }
    const s = await state();
    assert(test(s), `${what} did not happen in ${limit} strokes: ${JSON.stringify(s)}`);
    return limit;
  };
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const ORDER = ['stranded', 'seen', 'easing', 'waiting', 'coming', 'ferried', 'boarding', 'aboard', 'bolting', 'waits', 'climbing', 'ridge'];
  /** Waits until the cat has got at least as far as `step`; a slow machine may have carried it past. */
  const reach = (step, timeout) => page.waitForFunction((at) => at.order.indexOf(__game.story.current.cat.step) >= at.order.indexOf(at.step),
    { order: ORDER, step }, { timeout, polling: 100 }).catch(async () => assert.fail(`${step} did not happen: ${JSON.stringify(await state())}`));
  /** True if the cat is still at `step`, so a still of it can be taken. */
  const still = async (step) => (await state()).step === step;

  await reach('seen', 40000);
  console.log('seen', JSON.stringify(await state()));
  await reach('waiting', 60000);
  let s = await state();
  const start = s.tub, began = s.time;
  console.log('waiting', JSON.stringify(s));
  await page.waitForTimeout(3500);
  await shot('1-cat-on-chimney');

  if (process.env.VALVE) {
    // Nobody is stranded: with no input at all the air carries the tub to the roof, and later to the boat.
    await reach('coming', 240000);
    s = await state();
    assert(s.time - began > 85, `the first valve opened after only ${(s.time - began).toFixed(0)}s`);
    console.log(`valve: the tub reached the roof by itself after ${(s.time - began).toFixed(0)}s of nothing`);
    await reach('ferried', 30000);
    const second = (await state()).time;
    await reach('boarding', 240000);
    s = await state();
    assert(s.time - second > 85, `the second valve opened after only ${(s.time - second).toFixed(0)}s`);
    console.log(`valve: the tub reached the boat by itself after ${(s.time - second).toFixed(0)}s of nothing`);
    await reach('aboard', 20000);
    console.log('valve: aboard', JSON.stringify(await state()));
    process.exit(0);
  }

  // Waiting does nothing but bring the drawn gust: the breeze alone never carries the tub toward the roof.
  await page.waitForTimeout(Math.max(0, idle - 3.5) * 1000);
  s = await state();
  assert.equal(s.step, 'waiting', 'still waiting on the tub after idling');
  const roofGoal = s.goal;
  assert(distance(s.tub, start) < 1, `the tub drifted ${distance(s.tub, start).toFixed(2)}m by itself: ${JSON.stringify(s)}`);
  assert(s.invited && s.heading !== null, `no drawn gust after ${idle}s of nothing: ${JSON.stringify(s)}`);
  console.log(`idle ${idle}s: the tub moved ${distance(s.tub, start).toFixed(2)}m, invitation heading ${s.heading.toFixed(2)}`);
  await shot('2-invited');

  let strokes = await bring((x) => x.docked || x.step !== 'waiting' || distance(x.tub, roofGoal) < 2.2, 30, 'the tub nearing the roof');
  await shot('3-tub-arriving');
  strokes += await bring((x) => x.docked || x.step !== 'waiting', 12, 'the tub reaching the roof');
  console.log(`tub at the roof after ${strokes} strokes`);
  await reach('coming', 5000);
  await waitFor(() => __game.story.current.cat.step !== 'coming' || __game.story.current.cat.t > 2.6, 20000, 'the cat coming down');
  if (await still('coming')) await shot('4-cat-coming-down');
  await reach('ferried', 20000);
  await page.waitForTimeout(1200);
  await shot('5-cat-in-tub');
  s = await state();
  assert(s.cat[1] < 0.6 && distance(s.cat, s.tub) < 0.4, `the cat is not in the tub: ${JSON.stringify(s)}`);

  strokes = await bring((x) => x.docked || x.step !== 'ferried', 40, 'the tub reaching the boat');
  console.log(`tub at the bow after ${strokes} strokes`);
  await reach('boarding', 5000);
  await waitFor(() => __game.story.current.cat.step !== 'boarding' || __game.story.current.cat.t > 1.35, 10000, 'the cat springing');
  if (await still('boarding')) await shot('6-cat-jumping-aboard');
  await reach('aboard', 10000);
  s = await state();
  assert.equal(s.seat, 'satchel', 'the cygnet ducked into the satchel');
  console.log('aboard', JSON.stringify(s));
  await page.waitForTimeout(3000);
  await shot('7-cat-at-bow');
  await waitFor(() => __game.boat.speed > 1.5, 20000, 'the boat sailing on');
  await page.waitForTimeout(6000);
  await shot('8-sailing-with-cat');
  await waitFor(() => __game.story.current.beat === 'still', 90000, 'the air dying');
  console.log('still', JSON.stringify(await state()));
  await page.waitForTimeout(8000);
  await shot('9-at-rest');
  await reach('bolting', 120000);
  console.log('bolting', JSON.stringify(await state()));
  await waitFor(() => __game.story.current.cat.step !== 'bolting' || __game.story.current.cat.t > 1.6, 10000, 'the cat leaping');
  if (await still('bolting')) await shot('10-bolt');
  await reach('waits', 30000);
  await page.waitForTimeout(1000);
  if (await still('waits')) await shot('11-cat-at-gap');
  await reach('climbing', 30000);
  await waitFor(() => __game.story.current.cat.step !== 'climbing' || __game.story.current.cat.t > 1.3, 10000, 'her stepping out');
  if (await still('climbing')) await shot('12-climbing-out');
  await reach('ridge', 40000);
  await page.waitForTimeout(1500);
  await shot('13-on-ridge');
  s = await state();
  console.log('ridge', JSON.stringify(s));
  assert(s.child[1] > 1.5, `she is not up on the ridge: ${JSON.stringify(s)}`);
  assert(errors.length === 0, `page errors: ${errors.join('\n')}`);
  console.log('drowned roofs check passed');
} finally {
  await browser.close();
}

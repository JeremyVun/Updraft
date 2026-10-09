// The drowned village's stranded cat, played with real pointer gestures in Chrome for Testing against a running dev
// server: the boat comes round to the cat and waits, the cat comes down to the water's edge where the tub must come,
// strokes across the wash-tub on screen carry it there, the cat gets in, more strokes bring the tub to the bow, the cat
// jumps aboard and comes to her, the air dies and the becalmed boat ghosts slowly on onto the first roof's slates
// while the player's strokes make no wind at all, the dark comes on, the cat bolts over the roof and the child climbs
// out after it to the ridge, and the untended boat stays where it stuck as she goes on.
// Fails if waiting moves the tub toward the roof, if no drawn gust is offered, if the tub's puzzle leaves the frame, if
// the becalmed drift is fast or short or answers a stroke, or if any of those steps does not happen.
// Usage: node tools/drowned-roofs-check.mjs   env: BASE (default http://127.0.0.1:5230/), SHOTS=<prefix> saves stills,
//        W/H viewport (default 1600x900), IDLE seconds of waiting at the tub first (default 18), VALVE=1 instead
//        waits out the safety valve with no input at all (both trips), DEBUG=1 prints each stroke, NEAR=1 starts the
//        boat on the drift's last leg 70 m short of the cat, STRIP=<dir> saves a frame every half second of game time
//        from the cat seen to the boat aground (<dir>/0000.jpg on).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600), height = Number(process.env.H ?? 900);
const shots = process.env.SHOTS ?? null;
const idle = Number(process.env.IDLE ?? 18);

const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?shot=1&chapter=drowned&ratio=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  if (process.env.NEAR) await page.evaluate(async () => {
    const { CAT_HOLD, STRAND } = await import('/src/world/drowned-way.ts');
    const s = __game.story.current, b = __game.boat, dx = STRAND.x - CAT_HOLD.x, dz = STRAND.y - CAT_HOLD.y, d = Math.hypot(dx, dz);
    s.leg = 3;
    s.beat = 'drift';
    b.steerFor = STRAND;
    b.beach(CAT_HOLD.x - dx / d * 70, CAT_HOLD.y - dz / d * 70, Math.atan2(dx, dz));
    b.launch();
    b.speed = 4.5;
    s.cameraCut++;
  });
  let filming = !!process.env.STRIP, frames = 0;
  const filmed = (async () => {
    if (!filming) return;
    fs.mkdirSync(process.env.STRIP, { recursive: true });
    await page.waitForFunction(() => __game.story.current.cat?.step !== 'stranded', null, { timeout: 300000, polling: 100 });
    let next = await page.evaluate(() => __stats.time);
    while (filming) {
      const t = await page.evaluate(() => __stats.time);
      if (t >= next) {
        await page.screenshot({ path: `${process.env.STRIP}/${String(frames++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 70 });
        next += 0.5;
      } else await page.waitForTimeout(15);
    }
  })().catch(() => {});
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
  /** Waits until `seconds` more of game time have gone by, however slowly the machine renders them. */
  const play = async (seconds) => {
    const until = (await page.evaluate(() => __stats.time)) + seconds;
    await page.waitForFunction((t) => __stats.time >= t, until, { timeout: seconds * 4000 + 20000, polling: 200 });
  };
  const ORDER = ['stranded', 'seen', 'easing', 'waiting', 'coming', 'ferried', 'boarding', 'aboard', 'bolting', 'waits', 'climbing', 'ridge'];
  /** Waits until the cat has got at least as far as `step`; a slow machine may have carried it past. */
  const reach = (step, timeout) => page.waitForFunction((at) => at.order.indexOf(__game.story.current.cat.step) >= at.order.indexOf(at.step),
    { order: ORDER, step }, { timeout, polling: 100 }).catch(async () => assert.fail(`${step} did not happen: ${JSON.stringify(await state())}`));
  /** True if the cat is still at `step`, so a still of it can be taken. */
  const still = async (step) => (await state()).step === step;
  /** Where her head, the cat, the tub and the edge it waits at are on screen, as fractions of the viewport. */
  const framed = () => page.evaluate(async () => {
    const { CAT_EDGE } = await import('/src/world/drowned-way.ts');
    const cam = __game.rig.camera, scr = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2, (1 - p.y) / 2]; };
    const head = __game.child.position.clone(); head.y += 1.1;
    return { her: scr(head), cat: scr(__game.cat.position), tub: scr(__game.village.tub.position), edge: scr(CAT_EDGE) };
  });
  const inFrame = (at, what) => assert(at[0] > 0.02 && at[0] < 0.98 && at[1] > 0.02 && at[1] < 0.98, `${what} is out of frame at ${at.map((v) => v.toFixed(2))}`);

  await reach('seen', 120000);
  console.log('seen', JSON.stringify(await state()));
  await reach('waiting', 60000);
  let s = await state();
  const start = s.tub, began = s.time;
  console.log('waiting', JSON.stringify(s));
  await play(3.5);
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

  // Waiting does nothing but bring the cat down to the edge and the drawn gust: the breeze alone never carries the tub.
  await play(Math.max(0, idle - 3.5));
  s = await state();
  assert.equal(s.step, 'waiting', 'still waiting on the tub after idling');
  const roofGoal = s.goal;
  assert(distance(s.tub, start) < 1, `the tub drifted ${distance(s.tub, start).toFixed(2)}m by itself: ${JSON.stringify(s)}`);
  assert(s.invited && s.heading !== null, `no drawn gust after ${idle}s of nothing: ${JSON.stringify(s)}`);
  assert(distance(s.cat, roofGoal) < 1.2, `the cat is not waiting at the water's edge where the tub must come: ${JSON.stringify(s)}`);
  const view = await framed();
  for (const [what, at] of Object.entries(view)) inFrame(at, what);
  console.log(`idle ${idle}s: the tub moved ${distance(s.tub, start).toFixed(2)}m, invitation heading ${s.heading.toFixed(2)}, `
    + `the cat at the edge ${distance(s.cat, roofGoal).toFixed(2)}m from where the tub docks; on screen ${JSON.stringify(Object.fromEntries(Object.entries(view).map(([k, v]) => [k, v.map((x) => +x.toFixed(2))])))}`);
  await shot('2-invited');

  let strokes = await bring((x) => x.docked || x.step !== 'waiting' || distance(x.tub, roofGoal) < 2.2, 30, 'the tub nearing the roof');
  await shot('3-tub-arriving');
  strokes += await bring((x) => x.docked || x.step !== 'waiting', 12, 'the tub reaching the roof');
  console.log(`tub at the roof after ${strokes} strokes`);
  await reach('coming', 5000);
  const docked = (await state()).time;
  await reach('ferried', 6000);
  console.log(`the cat in the tub ${((await state()).time - docked).toFixed(1)}s after it docked`);
  await page.waitForTimeout(1200);
  await shot('5-cat-in-tub');
  s = await state();
  assert(s.cat[1] < 0.6 && distance(s.cat, s.tub) < 0.4, `the cat is not in the tub: ${JSON.stringify(s)}`);

  for (const [what, at] of Object.entries(await framed())) inFrame(at, `on its way back, ${what}`);
  strokes = await bring((x) => x.docked || x.step !== 'ferried', 40, 'the tub reaching the boat');
  console.log(`tub at the bow after ${strokes} strokes`);
  await reach('boarding', 5000);
  await waitFor(() => __game.story.current.cat.step !== 'boarding' || __game.story.current.cat.t > 1.05, 10000, 'the cat springing');
  if (await still('boarding')) await shot('6-cat-jumping-aboard');
  await reach('aboard', 10000);
  s = await state();
  assert.equal(s.seat, 'satchel', 'the cygnet ducked into the satchel');
  console.log('aboard', JSON.stringify(s));
  await page.waitForTimeout(3000);
  await shot('7-cat-at-bow');

  // Once it has come to her the air dies, and the becalmed boat ghosts slowly onto the slates; nothing the player does
  // makes any wind: no gust, no fill in the sail, nothing in the water.
  await waitFor(() => __game.story.current.beat === 'still', 40000, 'the air dying');
  const calm = await state();
  console.log('still', JSON.stringify(calm));
  let fastest = 0, gust = 0, fill = 0, unmuted = 0, strokesAcross = 0;
  const drifting = async () => {
    const x = await page.evaluate(() => {
      const b = __game.boat, out = { x: 0, z: 0, energy: 0, lift: 0 };
      let energy = 0;
      for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) energy = Math.max(energy, __game.wind.sample(b.position.x + dx, b.position.z + dz, out).energy);
      return { beat: __game.story.current.beat, speed: b.speed, made: b.sailWind.made, energy, muted: __game.input.muted,
        time: __stats.time, at: [b.position.x, b.position.z] };
    });
    if (process.env.DEBUG) console.log('  drift', JSON.stringify(x));
    fastest = Math.max(fastest, x.speed);
    if (x.beat === 'still') { gust = Math.max(gust, x.energy); fill = Math.max(fill, x.made); if (!x.muted) unmuted++; }
    return x.beat;
  };
  let half = false, way = 1;
  await drift(await screen('__game.boat.position.clone().setY(1.2)'));
  while (await drifting() === 'still') {
    /** Brisk sweeps to and fro across the boat and its sail, each straight on from the last. */
    const [bx, by] = await screen('__game.boat.position.clone().setY(1.6)');
    const from = [bx - 0.14 * way, by + 0.06 * way], to = [bx + 0.14 * way, by - 0.06 * way];
    for (let i = 0; i <= 12; i++) {
      at = [from[0] + (to[0] - from[0]) * i / 12, from[1] + (to[1] - from[1]) * i / 12];
      await page.mouse.move(at[0] * width, at[1] * height);
      await page.waitForTimeout(16);
    }
    way = -way;
    strokesAcross++;
    await drifting();
    if (!half && (await state()).time - calm.time > 9) { half = true; await shot('8-becalmed-drift'); }
    await page.waitForTimeout(250);
    assert((await state()).time - calm.time < 45, 'the becalmed boat never ran aground');
  }
  const aground = await state();
  const ghosted = distance(aground.boat, calm.boat);
  const took = await page.evaluate(() => { const c = __game.story.current; return c.beatStart - c.stillAt; });
  console.log(`becalmed drift: ${ghosted.toFixed(1)}m in ${took.toFixed(1)}s, fastest ${fastest.toFixed(2)}m/s; through ${strokesAcross} strokes `
    + `the most wind at the boat ${gust.toFixed(3)}, the most fill in the sail ${fill.toFixed(3)}, input live ${unmuted} times`);
  assert(fastest < 1.3, `the becalmed boat went ${fastest.toFixed(2)}m/s`);
  assert(took > 12 && took < 32, `the becalmed drift took ${took.toFixed(1)}s`);
  assert(gust < 0.02 && fill < 0.05 && unmuted === 0, 'a stroke made wind while the air was dead');
  await page.waitForTimeout(4000);
  filming = false;
  await filmed;
  if (process.env.STRIP) console.log(`${frames} frames in ${process.env.STRIP}`);
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
  assert(s.child[1] > 1.3, `she is not up on the ridge: ${JSON.stringify(s)}`);

  // The untended boat stays where it ran aground while she goes on over the roofs.
  const strand = s.boat;
  await play(30);
  const late = await state();
  await shot('14-boat-stuck');
  console.log(`stuck: ${distance(late.boat, strand).toFixed(2)}m off where it ran aground after 30s`);
  assert(distance(late.boat, strand) < 1.5, `the boat has left where it ran aground: ${JSON.stringify(late)}`);
  assert(errors.length === 0, `page errors: ${errors.join('\n')}`);
  console.log('drowned roofs check passed');
} finally {
  await browser.close();
}

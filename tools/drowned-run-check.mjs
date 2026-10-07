// The drowned village's run over the roofs, played with real pointer gestures in Chrome for Testing against a running
// dev server: from the drift (strokes bring the wash-tub to the cat and back), the air dying, the dark coming on, the
// cat's bolt and her climb out, then her way over the roofs after the cat: strokes push the dead tree down across the
// lane, circles round the hub turn the mill's sail to carry her up, strokes pump the swing until she lets go over the
// nave, and she walks on to the tower's foot. Reports the run's time and each stretch of it, and fails if she ever
// leaves the decks, stalls on her own way, or the fog reaches her; checks the cat ends at the tower and the boat at its
// tree. Usage: node tools/drowned-run-check.mjs
//   env: BASE (default http://127.0.0.1:5230/), FROM=roofs starts on the ridge after the cat (skips the tub and the
//        becalming), SHOTS=<prefix> saves stills (one at each piece and two between), FILM=<seconds> with SHOTS also
//        saves a still every that many seconds of the run, W/H viewport (default 1600x900), LENS=1 also fails on the
//        lens's measures (a roof hiding her, her walking toward it, her out of frame, it inside a roof).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600), height = Number(process.env.H ?? 900);
const shots = process.env.SHOTS ?? null;
const fromRoofs = process.env.FROM === 'roofs';

const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?shot=1&chapter=${fromRoofs ? 'roofs' : 'drowned'}&ratio=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

  const frame = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done())));
  const seconds = (s) => page.evaluate((n) => new Promise((done) => {
    let i = 0;
    const tick = () => (++i >= n ? done() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), Math.max(1, Math.round(s * 60)));
  const shot = async (name) => { if (shots) { await page.screenshot({ path: `${shots}-${name}.png` }); console.log(`  ${shots}-${name}.png`); } };
  const film = Number(process.env.FILM ?? 0);
  let filmed = -1, filmFrom = null;
  /** A still every `FILM` seconds of the run, once it has begun. */
  const reel = async () => {
    if (!film || !shots || filmFrom === null) return;
    const t = await page.evaluate(() => __stats.time);
    const n = Math.floor((t - filmFrom) / film);
    if (n > filmed) { filmed = n; await page.screenshot({ path: `${shots}-film-${String(n).padStart(3, '0')}.png` }); }
  };
  const state = () => page.evaluate(() => {
    const st = __game.story.current, r = st.run, f = (v) => v.toArray().map((x) => +x.toFixed(2));
    return { time: +__stats.time.toFixed(1), beat: st.beat, step: st.cat.step, stage: r.stage, along: +r.along.toFixed(1),
      child: f(__game.child.position), cat: f(__game.cat.position), tree: r.tree.phase, fallen: r.tree.tree.state,
      mill: r.mill.phase, swing: r.swing.phase, boatLeft: +st.adriftLeft.toFixed(1) };
  });
  /** Waits, in game time, until `test` holds of the state, at most `limit` game seconds. */
  const until = async (test, limit, what) => {
    for (let t = 0; t < limit; t += 0.25) {
      const s = await state();
      if (test(s)) return s;
      await seconds(0.25);
      await reel();
    }
    assert.fail(`${what} did not happen in ${limit} s: ${JSON.stringify(await state())}`);
  };

  let pointer = [0.5, 0.97];
  /** Over to a place slowly enough to make no wind, along the bottom of the screen. */
  const drift = async ([x, y]) => {
    for (const [ax, ay] of [[pointer[0], 0.99], [x, 0.99], [x, y]]) {
      await page.mouse.move(ax * width, ay * height);
      await frame();
    }
    pointer = [x, y];
  };
  /** A stroke through screen point `at` (fractions) along screen angle `heading`, `length` screen heights over `frames` frames. */
  const stroke = async (at, heading, length, frames) => {
    const aspect = width / height;
    const dx = (Math.cos(heading) * length) / aspect, dy = -Math.sin(heading) * length;
    const from = [at[0] - dx / 2, at[1] - dy / 2];
    await drift(from);
    for (let i = 1; i <= frames; i++) {
      pointer = [from[0] + dx * i / frames, from[1] + dy * i / frames];
      await page.mouse.move(pointer[0] * width, pointer[1] * height);
      await frame();
    }
    await reel();
  };
  const onScreen = (expr) => page.evaluate((e) => {
    const p = eval(e).clone().project(__game.rig.camera);
    return [(p.x + 1) / 2, (1 - p.y) / 2];
  }, expr);

  if (!fromRoofs) {
    // The tub: strokes across it on screen carry it to the cat's roof, and then to the bow.
    const ORDER = ['stranded', 'seen', 'easing', 'waiting', 'coming', 'ferried', 'boarding', 'aboard', 'bolting', 'waits', 'climbing', 'ridge'];
    const reach = (step, limit) => until((s) => ORDER.indexOf(s.step) >= ORDER.indexOf(step), limit, step);
    const push = async () => {
      const t = await onScreen('__game.village.tub.position.clone().setY(__game.village.tub.position.y + 0.15)');
      const g = await onScreen('__game.story.current.cat.goal');
      const heading = Math.atan2(-(g[1] - t[1]) * height, (g[0] - t[0]) * width);
      await stroke(t, heading, 0.18, 14);
      await seconds(0.6);
    };
    await reach('waiting', 120);
    for (let i = 0; i < 40 && (await state()).step === 'waiting'; i++) await push();
    await reach('ferried', 30);
    for (let i = 0; i < 50 && (await state()).step === 'ferried'; i++) await push();
    await reach('aboard', 30);
    console.log('the cat is aboard', JSON.stringify(await state()));
    await until((s) => s.beat === 'still', 120, 'the air dying');
    await reach('ridge', 150);
    console.log('she is up on the ridge after the cat', JSON.stringify(await state()));
  }
  filmFrom = (await state()).time;
  await until((s) => s.beat === 'run', 30, 'her setting off');

  // Watches every frame from here: her feet on the decks, her progress, and the fog behind her.
  await page.evaluate(async () => {
    const D = await import('/src/world/decks.ts');
    const W = await import('/src/world/drowned-way.ts');
    const w = window.__runWatch = { frames: 0, offWorst: 0, offAt: '', fogAlong: Infinity, fogNear: Infinity, fogAt: '',
      stallWorst: 0, stallAt: '', last: -1, since: 0, facing: 0, facingRun: 0, facingWorst: 0, facingAt: '', unseen: 0, unseenRun: 0,
      unseenWorst: 0, unseenAt: '', inside: 0, insideAt: '' };
    const front = W.DARK_WAY[0].clone();
    const tick = () => {
      const st = __game.story.current, r = st.run, c = __game.child, p = c.position;
      if (!r || r.stage === 'off') { requestAnimationFrame(tick); return; }
      w.frames++;
      const flying = c.action?.kind === 'leap' || c.riding || r.swing.phase === 'boarding' || r.swing.phase === 'riding' || r.swing.phase === 'flying';
      if (!flying) {
        const beyond = D.beyondDecks(c.decks, p.x, p.z, p.y);
        const under = D.deckGround(c.decks, p.x, p.z, p.y);
        const off = Math.max(beyond === Infinity ? 99 : beyond, Math.abs(under - p.y));
        if (off > w.offWorst) { w.offWorst = off; w.offAt = `${r.stage} at ${p.toArray().map((v) => v.toFixed(2))}`; }
      }
      const dark = __game.village.dark;
      W.darkWayPoint(dark.reach, front);
      const along = r.darkAt - dark.reach, near = Math.hypot(p.x - front.x, p.z - front.y);
      if (along < w.fogAlong) w.fogAlong = along;
      if (near < w.fogNear) { w.fogNear = near; w.fogAt = `${r.stage} at ${p.toArray().map((v) => v.toFixed(2))}`; }
      /** Never toward the lens: on her own way she never faces it, and she is always in the frame. */
      const cam = __game.rig.camera.position, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      const tx = cam.x - p.x, tz = cam.z - p.z, tl = Math.hypot(tx, tz) || 1;
      const toward = (fx * tx + fz * tz) / tl > 0.5 && r.stage === 'walk' && c.moving;
      w.facingRun = toward ? w.facingRun + 1 / 60 : 0;
      if (toward) w.facing += 1 / 60;
      if (w.facingRun > w.facingWorst) { w.facingWorst = w.facingRun; w.facingAt = `at ${r.along.toFixed(1)} m, ${p.toArray().map((v) => v.toFixed(2))}`; }
      const head = p.clone().setY(p.y + 1.2).project(__game.rig.camera);
      const out = Math.abs(head.x) > 0.95 || Math.abs(head.y) > 0.95 || head.z > 1;
      w.unseenRun = out ? w.unseenRun + 1 / 60 : 0;
      if (out) w.unseen += 1 / 60;
      if (w.unseenRun > w.unseenWorst) { w.unseenWorst = w.unseenRun; w.unseenAt = `${r.stage} at ${r.along.toFixed(1)} m`; }
      /** Under a roof's slates, or a roof between the lens and her: a march along the line of sight. */
      const under = (x, z) => [...W.PLACED, W.NAVE].reduce((top, h) => Math.max(top, W.roofUnder(h, x, z) ?? -Infinity), -Infinity);
      if (cam.y < under(cam.x, cam.z) + 0.2) { w.inside += 1 / 60; w.insideAt = `${r.stage} at ${r.along.toFixed(1)} m`; }
      let hidden = false;
      for (let i = 1; i < 24 && !hidden; i++) {
        const u = i / 24, x = cam.x + (p.x - cam.x) * u, z = cam.z + (p.z - cam.z) * u, y = cam.y + (p.y + 1.4 - cam.y) * u;
        if (Math.hypot(x - p.x, z - p.z) > 0.8 && y < under(x, z) - 0.05) hidden = true;
      }
      w.hiddenRun = hidden && !flying ? (w.hiddenRun ?? 0) + 1 / 60 : 0;
      if (w.hiddenRun > (w.hiddenWorst ?? 0)) { w.hiddenWorst = w.hiddenRun; w.hiddenAt = `${r.stage} at ${r.along.toFixed(1)} m`; }
      if (r.stage === 'walk' && !c.action) {
        if (r.along > w.last + 0.05) { w.last = r.along; w.since = 0; } else w.since += 1 / 60;
        if (w.since > w.stallWorst) { w.stallWorst = w.since; w.stallAt = `at ${r.along.toFixed(1)} m, ${p.toArray().map((v) => v.toFixed(2))}`; }
      } else w.since = 0;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const started = (await state()).time;
  const shotsBetween = [];
  const snapBetween = async (name, at) => {
    shotsBetween.push({ name, at });
  };
  await snapBetween('between-1', 0.32);
  await snapBetween('between-2', 0.72);
  const runLength = await page.evaluate(() => __game.story.current.run.length);
  /** On her own way: waits for the next piece, taking the stills between pieces as she passes their places. */
  const walkTo = async (stage, limit) => {
    for (let t = 0; t < limit; t += 0.25) {
      const s = await state();
      const due = shotsBetween.find((b) => !b.taken && s.along >= b.at * runLength && s.stage === 'walk');
      if (due) { due.taken = true; await shot(due.name); }
      if (s.stage === stage) return s;
      await seconds(0.25);
      await reel();
    }
    assert.fail(`she never reached the ${stage}: ${JSON.stringify(await state())}`);
  };

  // The tree: firm strokes across it the way it can fall, until it goes over; she walks over it.
  await walkTo('tree', 60);
  await seconds(2.5);
  await shot('tree');
  let pushes = 0;
  for (; pushes < 8 && (await state()).fallen === 'standing'; pushes++) {
    const aim = await page.evaluate(() => {
      const r = __game.story.current.run, cam = __game.rig.camera;
      const p = r.tree.tree.trunkAt(0.5, cam.position.clone()).project(cam);
      return { at: [(p.x + 1) / 2, (1 - p.y) / 2], heading: r.tree.tree.fallHeading(cam) };
    });
    await stroke(aim.at, aim.heading, 0.62, 15);
    await seconds(1.8);
  }
  console.log(`the tree went over after ${pushes} strokes`);

  // The mill: broad circles round its hub on screen, clockwise the way the sails turn, until she is off on the high roof.
  await walkTo('mill', 120);
  await seconds(1.5);
  let circled = 0, rode = false;
  for (; circled < 240 && (await state()).stage === 'mill'; circled++) {
    const hub = await onScreen('__game.story.current.run.mill.mill.hub');
    for (let i = 0; i < 39; i++) {
      const a = ((circled * 39 + i) / 78) * Math.PI * 2;
      const r = 0.22 * (1 + 0.18 * Math.sin(a * 1.7));
      await page.mouse.move((hub[0] + (Math.cos(a) * r * height) / width) * width, (hub[1] + Math.sin(a) * r * 1.1) * height);
      await frame();
    }
    await reel();
    if (!rode && (await state()).mill === 'riding') { rode = true; await seconds(1.2); await shot('mill'); }
  }
  console.log(`she was carried up after ${(circled / 2).toFixed(1)} turns of circling`);

  // The swing: strokes across the seat the way it swings out, until she lets go.
  await walkTo('swing', 120);
  await until((s) => s.swing === 'riding', 10, 'her getting on the swing');
  let pumps = 0, swung = false;
  for (; pumps < 40 && (await state()).swing === 'riding'; pumps++) {
    const aim = await page.evaluate(() => {
      const r = __game.story.current.run, cam = __game.rig.camera, s = r.swing.swing;
      const at = s.seat(cam.position.clone());
      const a = at.clone().project(cam), b = at.clone().set(at.x + s.toward.x * 2, at.y, at.z + s.toward.y * 2).project(cam);
      return { at: [(a.x + 1) / 2, (1 - a.y) / 2], heading: Math.atan2(b.y - a.y, (b.x - a.x) * cam.aspect) };
    });
    await stroke(aim.at, aim.heading, 0.5, 12);
    await seconds(0.8);
    if (!swung && pumps === 4) { swung = true; await shot('swing'); }
  }
  console.log(`she let go of the swing after ${pumps} pumping strokes`);

  await until((s) => s.beat === 'nave', 60, 'her reaching the tower\'s foot');
  await seconds(3);
  await shot('nave');
  const end = await state();
  const report = await page.evaluate(() => {
    const st = __game.story.current, r = st.run, w = window.__runWatch;
    return { stretches: r.stretches, time: r.time, length: r.length, watch: { ...w } };
  });
  const w = report.watch;
  console.log(`run: ${report.length.toFixed(0)} m of way in ${report.time.toFixed(1)} s (game time from setting off to the tower's foot)`);
  for (const s of report.stretches) console.log(`  ${s.name}: ${s.seconds} s`);
  const onFoot = report.stretches.filter((s) => s.name.startsWith('her way') || s.name === 'the nave').reduce((a, s) => a + s.seconds, 0);
  console.log(`  on foot ${onFoot.toFixed(1)} s, at the pieces ${(report.time - onFoot).toFixed(1)} s`);
  console.log(`her feet stayed within ${w.offWorst.toFixed(3)} m of the decks (worst ${w.offAt}); longest stall on her own way ${w.stallWorst.toFixed(1)} s`);
  console.log(`the fog came within ${w.fogAlong.toFixed(1)} m of her along its way, ${w.fogNear.toFixed(1)} m as the crow flies (${w.fogAt})`);
  console.log(`at the end: cat at ${end.cat.join(', ')}, her at ${end.child.join(', ')}, the boat ${end.boatLeft} m short of its tree`);
  const towerSouth = await page.evaluate(() => { const c = window.__game.cat.position; return Math.hypot(c.x - 16.5, c.z - (-1561 + 2.6)); });
  console.log(`she faced the lens on her way for ${w.facing.toFixed(1)} s in all (longest ${w.facingWorst.toFixed(1)} s ${w.facingAt}); out of frame ${w.unseen.toFixed(1)} s (longest ${w.unseenWorst.toFixed(1)} s ${w.unseenAt}); lens inside a roof ${w.inside.toFixed(1)} s ${w.insideAt}`);
  console.log(`a roof hid her for at most ${(w.hiddenWorst ?? 0).toFixed(1)} s at a time (${w.hiddenAt ?? ''})`);
  /** The lens's measures are reported, and fail only with LENS=1 until its polish pass makes them hold. */
  const lens = [[(w.hiddenWorst ?? 0) < 1, `a roof hid her for ${(w.hiddenWorst ?? 0).toFixed(1)} s (${w.hiddenAt})`],
    [w.facingWorst < 1, `she walked toward the lens for ${w.facingWorst.toFixed(1)} s (${w.facingAt})`],
    [w.unseenWorst < 0.5, `she was out of the frame for ${w.unseenWorst.toFixed(1)} s (${w.unseenAt})`],
    [w.inside < 0.2, `the lens was inside a roof for ${w.inside.toFixed(1)} s (${w.insideAt})`]];
  for (const [ok, what] of lens) {
    if (process.env.LENS) assert(ok, what);
    else if (!ok) console.log(`  lens: ${what}`);
  }
  assert(w.offWorst < 0.4, `she left the decks: ${w.offWorst.toFixed(2)} m (${w.offAt})`);
  assert(w.stallWorst < 3, `she stalled on her own way for ${w.stallWorst.toFixed(1)} s (${w.stallAt})`);
  assert(w.fogAlong > 5 && w.fogNear > 5, `the fog reached her: ${w.fogAlong.toFixed(1)} m along, ${w.fogNear.toFixed(1)} m (${w.fogAt})`);
  assert(towerSouth < 1.5, `the cat is not at the tower's south face (${towerSouth.toFixed(2)} m off)`);
  assert(end.boatLeft < 1, `the boat is still ${end.boatLeft} m short of its tree`);
  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
  console.log(`drowned run check passed (started at game time ${started})`);
} finally {
  await browser.close();
}

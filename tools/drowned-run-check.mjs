// The drowned village's run over the roofs, played with real pointer gestures in Chrome for Testing against a running
// dev server: from the drift (strokes bring the wash-tub to the cat and back), the air dying, the dark coming on, the
// cat's bolt and her climb out, then her way over the roofs after the cat: strokes push the dead tree down across the
// lane, circles round the hub turn the mill's sail to carry her up, strokes pump the swing until she lets go over the
// nave, and she walks on to the tower's foot. Reports the run's time and each stretch of it, and fails if she ever
// leaves the decks, stalls on her own way, or the fog reaches her; checks the cat ends at the tower and the boat at its
// tree. Then the church: the cat climbs the ivy into the belfry, the fog closes round, strokes across the boat's sail
// bring it from its tree to the nave, she steps down into it and looks back at the cat as the storm begins; it plays on
// to the forest beach and reports when the storm's beats fall and where the boat is then, failing if anything stalls or
// she leaves the decks. Usage: node tools/drowned-run-check.mjs
//   env: BASE (default http://127.0.0.1:5230/), FROM=stairs starts on the stairs and docks their flights first, FROM=roofs starts on the ridge after the cat (skips the tub and the
//        becalming), FROM=church at the tower's foot (skips the run too), FROM=storm with her just seated aboard at the
//        nave (skips the church too), SHOTS=<prefix> saves stills (at each piece,
//        two between, and through the church), FILM=<seconds> with SHOTS also
//        saves a still every that many seconds from the air dying (from the ridge with FROM=roofs) to the tower,
//        W/H viewport (default 1600x900), LENS=1 also fails on the lens's measures (a roof hiding her, her walking
//        toward it, her out of frame, it inside a roof).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600), height = Number(process.env.H ?? 900);
const shots = process.env.SHOTS ?? null;
const fromStairs = process.env.FROM === 'stairs';
const fromStorm = process.env.FROM === 'storm';
const fromChurch = process.env.FROM === 'church' || fromStorm;
const fromRoofs = process.env.FROM === 'roofs' || fromChurch;

const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?shot=1&chapter=${fromStorm ? 'storm' : fromChurch ? 'church' : fromRoofs ? 'roofs' : fromStairs ? 'stairs' : 'drowned'}&ratio=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

  /** The lens's own motion every frame from the start: its fastest turn and fastest move, and where they fell. */
  await page.evaluate(() => {
    const w = window.__lensWatch = { turn: 0, turnAt: '', move: 0, moveAt: '' };
    let last = null;
    const tick = () => {
      const st = __game.story.current, cam = __game.rig.camera, t = __stats.time;
      const d = cam.getWorldDirection(cam.position.clone()), p = cam.position.clone();
      const where = () => `${st.beat ?? __game.story.name}${st.run && st.run.stage !== 'off' ? '/' + st.run.stage : ''}${st.church && st.church.step !== 'off' ? '/' + st.church.step : ''} at ${t.toFixed(1)} s`;
      if (last && t > last.t && (last.cut === st.cameraCut || last.story !== st)) {
        const dt = t - last.t, turn = Math.acos(Math.min(1, d.dot(last.d))) * 180 / Math.PI / dt, move = p.distanceTo(last.p) / dt;
        if (turn > w.turn) { w.turn = turn; w.turnAt = where(); }
        if (move > w.move) { w.move = move; w.moveAt = where(); }
      }
      last = { t, d, p, cut: st.cameraCut, story: st };
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

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

  /**
   * The church: the cat up the ivy into the belfry, the fog closing round, strokes across the boat's sail bringing it
   * from its tree to the nave, her stepping down into it and looking back at the cat; then the storm on to the beach.
   */
  const church = async () => {
    const look = () => page.evaluate(() => {
      const st = __game.story.current, ch = st.church, b = __game.boat, c = __game.child, f = (v) => v.toArray().map((x) => +x.toFixed(2));
      if (!ch) return { landed: true, time: +__stats.time.toFixed(1), boat: f(b.position), storm: NaN };
      return { time: +__stats.time.toFixed(1), beat: st.beat, step: ch.step, close: +ch.close.toFixed(2), aboardFor: +ch.aboardFor.toFixed(1),
        carrying: ch.carrying, boat: f(b.position), child: f(c.position), cat: f(__game.cat.position), riding: c.riding,
        storm: +st.stormTime.toFixed(1), grounded: b.grounded, out: st.out, leg: st.leg };
    });
    const wait = async (test, limit, what) => {
      for (let t = 0; t < limit; t += 0.25) {
        const s = await look();
        if (test(s)) return s;
        await seconds(0.25);
        await reel();
      }
      assert.fail(`${what} did not happen in ${limit} s: ${JSON.stringify(await look())}`);
    };
    await page.evaluate(async () => {
      const D = await import('/src/world/decks.ts');
      const w = window.__churchWatch = { offWorst: 0, offAt: '' };
      const tick = () => {
        const ch = __game.story.current.church, c = __game.child, p = c.position;
        if (ch && ch.step !== 'off' && ch.step !== 'board' && ch.aboardFor < 0 && !c.riding && !c.action) {
          const beyond = D.beyondDecks(c.decks, p.x, p.z, p.y), under = D.deckGround(c.decks, p.x, p.z, p.y);
          const off = Math.max(beyond === Infinity ? 99 : beyond, Math.abs(under - p.y));
          if (off > w.offWorst) { w.offWorst = off; w.offAt = `${ch.step} at ${p.toArray().map((v) => v.toFixed(2))}`; }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const T = await page.evaluate(async () => {
      const { tuning } = await import('/src/tuning.ts');
      const W = await import('/src/world/drowned-way.ts');
      const { DROWNED_CHANNEL, LIGHTHOUSE } = await import('/src/world/drowned.ts');
      const { WOOD_LANDING } = await import('/src/world/wood.ts');
      const last = DROWNED_CHANNEL[DROWNED_CHANNEL.length - 1];
      return { out: tuning.storm.lighthouseOutAt, way: W.STORM_WAY.map((p) => [p.x, p.y]), last: [last.x, last.y], beach: [WOOD_LANDING.x, WOOD_LANDING.y],
        light: [LIGHTHOUSE.x, LIGHTHOUSE.z], north: W.BELFRY_NORTH.toArray(), legs: DROWNED_CHANNEL.length + 2 };
    });
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const xz = (p) => [p[0], p[2]];
    const toBeach = (s) => {
      const p = xz(s.boat);
      if (s.landed) return d(p, T.beach);
      if (s.leg === undefined) return NaN;
      if (s.out < T.way.length) {
        const ahead = [...T.way.slice(s.out), T.last, T.beach];
        return ahead.reduce((sum, q, i) => sum + d(i ? ahead[i - 1] : p, q), 0);
      }
      return s.leg < T.legs - 1 ? d(p, T.last) + d(T.last, T.beach) : d(p, T.beach);
    };

    /**
     * From her seated aboard to the forest beach: her look back at the cat, the light going out, the cygnet's shaking,
     * the first lightning, the plane taken, the landing. Reports when each falls and where the boat is then, and the
     * frame's mean brightness each second; fails if the light goes out while the lighthouse is out of frame, if the
     * frame brightens past the look back's outside a lightning flash, or if the landing comes late.
     */
    const storm = async (aboard, atNave) => {
      const sharp = (await import('sharp')).default;
      const probe = () => page.evaluate(() => {
        const st = __game.story.current, cam = __game.rig.camera, light = __game.village.lighthouse;
        if (!st.church) return { landed: true, time: +__stats.time.toFixed(2) };
        const lamp = light.object.position.clone().project(cam);
        return { time: +__stats.time.toFixed(2), storm: +st.stormTime.toFixed(2), aboardFor: +st.church.aboardFor.toFixed(2), beat: st.beat,
          power: light.strength.value, lamp: [lamp.x, lamp.y, lamp.z], flash: __game.boat.sailMat.uniforms.uLightning.value.w,
          shook: st.shook, sheltered: st.sheltered, horn: st.hornPassed, plane: __game.glider.group.visible };
      });
      const brightness = async () => (await sharp(await page.screenshot({ type: 'jpeg', quality: 70 })).greyscale().stats()).channels[0].mean;
      const beats = [{ what: 'aboard', at: 0, toBeach: toBeach(aboard) }];
      const mark = (what, s, b = s) => beats.push({ what, at: s.time - aboard.time, toBeach: toBeach(b) });
      const trace = [];
      let was = { beat: 'gather', shook: false, sheltered: false, horn: false, flash: 0, plane: true }, cat = null, out = null, unseen = null;
      let second = -1, still = -1;
      for (let t = 0; t < 120; t += 0.25) {
        const [p, s] = [await probe(), await look()];
        if (p.landed) { mark('landed', p, s); break; }
        const since = p.time - aboard.time;
        if (since >= 2.6 && !cat) { cat = s.cat; await shot('church-look-back'); }
        if (since >= 8 && since < 8.3) assert(s.riding && s.beat === 'gather', `she is not riding the boat into the storm: ${JSON.stringify(s)}`);
        if (p.beat !== was.beat) mark(p.beat, p, s);
        if (p.beat === 'snatch' && was.beat !== 'snatch') { await seconds(1); await shot('storm-plane'); }
        if (p.power < 0.6 && was.power >= 0.6) await shot('storm-light');
        if (p.shook && !was.shook) mark('the cygnet shakes', p, s);
        if (p.horn && !was.horn) mark('the foghorn', p, s);
        if (p.sheltered && !was.sheltered) mark('the cygnet startles at the light going', p, s);
        if (p.flash > 0.01 && was.flash <= 0.01) {
          mark('lightning', p, s);
          if (!beats.some((x, i) => x.what === 'lightning' && i < beats.length - 1)) await shot('storm-lightning');
        }
        if (!p.plane && was.plane && p.beat === 'after') mark('the plane gone', p, s);
        const inFrame = p.lamp[2] < 1 && Math.abs(p.lamp[0]) < 0.95 && Math.abs(p.lamp[1]) < 0.95;
        if (p.power < 0.97 && p.power > 0.001 && !inFrame && !unseen) unseen = { ...p, since };
        if (p.power <= 0.001 && !out) { out = { ...p, since, inFrame, boat: s.boat }; mark('the light out', p, s); }
        if (Math.floor(since) > second) {
          second = Math.floor(since);
          trace.push({ second, mean: +(await brightness()).toFixed(1), flash: p.flash > 0.01 || was.flash > 0.01 });
        }
        if (Math.floor(since / 5) > still) { still = Math.floor(since / 5); await shot(`storm-${String(still * 5).padStart(2, '0')}`); }
        was = p;
        await seconds(0.25);
      }
      const landed = beats.at(-1);
      assert(landed.what === 'landed', `the boat never reached the forest beach: ${JSON.stringify(await look())}`);
      /** On into the wood chapter's first seconds, so a cut at the hand-off shows in the trace. */
      for (let i = 1; i <= 4; i++) {
        await seconds(1);
        trace.push({ second: second + i, mean: +(await brightness()).toFixed(1), flash: false, ashore: true });
        if (i === 3) await shot('storm-ashore');
      }
      console.log(`storm from aboard at the nave: ${toBeach(aboard).toFixed(0)} m to the forest beach`);
      for (const b of beats) console.log(`  ${b.at.toFixed(1).padStart(5)} s  ${b.what}, ${b.toBeach.toFixed(0)} m from the beach`);
      if (out) console.log(`  the light went out ${d(xz(out.boat), T.light).toFixed(0)} m from the lighthouse, its lamp ${out.inFrame ? 'in' : 'out of'} frame at ${out.lamp.slice(0, 2).map((v) => v.toFixed(2)).join(', ')}`);
      if (atNave !== null) console.log(`  landed ${landed.at.toFixed(1)} s after she was aboard, ${(aboard.time - atNave + landed.at).toFixed(1)} s after the tower's foot`);
      const back = trace.filter((r) => r.second >= 2 && r.second <= 5 && !r.flash);
      const lookBack = back.reduce((a, r) => a + r.mean, 0) / Math.max(1, back.length);
      const lit = trace.filter((r) => r.second > 5 && !r.flash);
      const brightest = lit.reduce((a, r) => (r.mean > a.mean ? r : a), { mean: -1, second: -1 });
      console.log(`  mean brightness each second from aboard: ${trace.map((r) => `${r.second}:${r.mean.toFixed(0)}${r.flash ? '*' : r.ashore ? '+' : ''}`).join(' ')}`);
      const cut = trace.slice(1).reduce((worst, r, i) => (r.flash || trace[i].flash ? worst : Math.max(worst, Math.abs(r.mean - trace[i].mean))), 0);
      console.log(`  the look back ${lookBack.toFixed(1)}; brightest after it ${brightest.mean.toFixed(1)} at ${brightest.second} s; the most it changed in a second ${cut.toFixed(1)} (* a lightning flash, + ashore in the wood)`);
      assert(out, 'the light never went out');
      assert(!unseen, `the light was going out with the lighthouse out of frame at ${unseen?.since.toFixed(1)} s (${unseen?.lamp.map((v) => v.toFixed(2)).join(', ')})`);
      assert(out.inFrame, 'the light went out with the lighthouse out of frame');
      assert(landed.at < 60, `the landing came ${landed.at.toFixed(1)} s after she was aboard`);
      assert(cut < 12, `the frame's brightness jumped by ${cut.toFixed(1)} in a second`);
      assert(brightest.mean < lookBack + 6, `the storm brightened the frame to ${brightest.mean.toFixed(1)} at ${brightest.second} s against ${lookBack.toFixed(1)} at the look back`);
      return cat;
    };
    if (fromStorm) {
      await storm(await wait((s) => s.aboardFor >= 0, 5, 'her aboard'), null);
      return;
    }
    const atNave = (await wait((s) => s.step !== 'off', 30, 'the church beginning')).time;
    await wait((s) => s.cat[1] > 4, 30, 'the cat halfway up the ivy');
    await shot('church-climbing');
    const up = await wait((s) => s.step === 'up', 30, 'the cat in the belfry');
    await seconds(1.5);
    await shot('church-belfry');
    const fog = await wait((s) => s.step === 'fog', 10, 'the fog coming');
    await wait((s) => s.close > 0.12, 30, 'the fog closing round');
    await shot('church-fog');
    const bring = await wait((s) => s.step === 'bring', 30, 'the boat being hers to bring');
    await seconds(7);
    await shot('church-invitation');
    let strokes = 0;
    for (; strokes < 80; strokes++) {
      const s = await look();
      if (s.step !== 'bring' || s.grounded) break;
      const aim = await page.evaluate(() => {
        const b = __game.boat, cam = __game.rig.camera;
        const at = b.sailPoint(cam.position.clone());
        const a = at.clone().project(cam), ahead = at.clone().set(at.x + Math.sin(b.yaw) * 2, at.y, at.z + Math.cos(b.yaw) * 2).project(cam);
        return { at: [(a.x + 1) / 2, (1 - a.y) / 2], heading: Math.atan2(ahead.y - a.y, (ahead.x - a.x) * cam.aspect) };
      });
      await stroke(aim.at, aim.heading, 0.35, 12);
      await seconds(0.7);
      if (strokes === 5) await shot('church-bring');
    }
    const berthed = await wait((s) => s.step === 'board', 40, 'her stepping down into the boat');
    const berth = (await look()).boat;
    await seconds(1.0);
    await shot('church-boarding');
    const aboard = await wait((s) => s.aboardFor >= 0, 15, 'her seated aboard');
    const pushed = d(xz(aboard.boat), xz(berth));
    const w = await page.evaluate(() => window.__churchWatch);
    const cat = await storm(aboard, atNave);
    console.log(`church: the cat up the ivy ${(up.time - atNave).toFixed(1)} s after the tower's foot; the fog came ${(fog.time - atNave).toFixed(1)} s, the boat hers to bring ${(bring.time - atNave).toFixed(1)} s`);
    console.log(`  the boat brought in ${(berthed.time - bring.time).toFixed(1)} s (7 s of it idle, for the drawn invitation) with ${strokes} strokes; aboard ${(aboard.time - atNave).toFixed(1)} s after the tower's foot${berthed.carrying ? ' (the safety valve carried it)' : ''}`);
    console.log(`  her step aboard moved the boat ${pushed.toFixed(2)} m; her feet stayed within ${w.offWorst.toFixed(3)} m of the decks (worst ${w.offAt})`);
    assert(w.offWorst < 0.4, `she left the decks at the church: ${w.offWorst.toFixed(2)} m (${w.offAt})`);
    assert(!berthed.carrying, 'the strokes never brought the boat: the safety valve carried it');
    assert(pushed < 0.6, `her step aboard pushed the boat ${pushed.toFixed(2)} m`);
    assert(Math.hypot(cat[0] - T.north[0], cat[1] - T.north[1], cat[2] - T.north[2]) < 0.5, `the cat is not on the belfry's north sill (${cat.join(', ')})`);
  };

  if (fromStairs) {
    // The stairs as a player docks them (each loose flight swept onto its landing), then down through the cloud.
    const stairs = () => page.evaluate(() => {
      const g = __game, c = g.story.current, cam = g.rig.camera;
      const on = (p) => { const q = p.clone().project(cam); return [(q.x + 1) / 2, (1 - q.y) / 2, q.z]; };
      const piece = g.story.name === 'stairs' ? g.cloudStairs.waiting : null;
      const home = piece?.flight.bottom.clone().lerp(piece.flight.landing, 0.5);
      return { chapter: g.story.name, beat: c.beat, time: __stats.time,
        flight: piece && !piece.settling ? { at: on(g.cloudStairs.pointOn(piece, home.clone(), home.clone())), to: on(home) } : null,
        wind: c.windInvitation ? on(c.windInvitation) : null };
    });
    const inFrame = (p) => p && p[2] < 1 && p[0] > 0.02 && p[0] < 0.98 && p[1] > 0.02 && p[1] < 0.98;
    let st = await stairs(), shotDown = false;
    for (let i = 0; i < 2000 && st.chapter === 'stairs'; i++) {
      if (st.beat === 'waiting' && st.flight && inFrame(st.flight.to)) {
        const [ax, ay] = st.flight.at, [bx, by] = st.flight.to;
        await stroke([(ax + bx) / 2, (ay + by) / 2], Math.atan2(-(by - ay) * height, (bx - ax) * width), Math.max(0.1, Math.hypot((bx - ax) * width / height, by - ay)), 40);
      } else if (st.beat === 'loop' && inFrame(st.wind)) await stroke(st.wind, 0.2, 0.38, 24);
      else await seconds(0.5);
      if (!shotDown && st.beat !== 'waiting' && st.beat !== 'loop' && i > 10) { shotDown = true; await shot('stairs-leaving'); }
      st = await stairs();
    }
    assert.equal(st.chapter, 'drowned', `the stairs never let the boat down into the drowned village (${JSON.stringify(st)})`);
    console.log(`into the drowned village from the stairs at ${st.time.toFixed(1)} s`);
    await seconds(4);
    await shot('arrival');
    await seconds(8);
    await shot('arrival-drift');
  }
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
    await shot('cat');
    for (let i = 0; i < 40 && (await state()).step === 'waiting'; i++) await push();
    await reach('ferried', 30);
    for (let i = 0; i < 50 && (await state()).step === 'ferried'; i++) {
      await push();
      if (i === 3) await shot('tub');
    }
    await reach('aboard', 30);
    console.log('the cat is aboard', JSON.stringify(await state()));
    await until((s) => s.beat === 'still', 120, 'the air dying');
    filmFrom = (await state()).time;
    await seconds(4);
    await shot('air-dies');
    await until((s) => s.beat === 'becalmed', 30, 'the boat at rest');
    await seconds(14);
    await shot('fog-rising');
    await reach('climbing', 150);
    await seconds(2);
    await shot('climb');
    await reach('ridge', 150);
    console.log('she is up on the ridge after the cat', JSON.stringify(await state()));
  }
  if (!fromChurch) {
    filmFrom ??= (await state()).time;
    await until((s) => s.beat === 'run', 30, 'her setting off');
    await frame();
    const hand = await page.evaluate(() => { const r = __game.story.current.run, c = __game.child.position;
      return { t: r.handT, off: r.handFrom ? Math.hypot(r.handFrom.x - c.x, r.handFrom.z - c.z) : null }; });
    console.log(`the run took the lens ${hand.t === Infinity ? 'by the rig' : 'by its hand-over'} from ${hand.off?.toFixed(1)} m off her`);

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
    await until((s) => s.tree === 'crossing', 30, 'her on the trunk');
    await seconds(1.5);
    await shot('tree-crossing');

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
  }
  await church();
  for (let t = 0; t < 30 && (await page.evaluate(() => __game.story.name)) !== 'wood'; t += 0.25) await seconds(0.25);
  assert.equal(await page.evaluate(() => __game.story.name), 'wood', 'the landing never handed on to the dark wood');
  await seconds(3);
  await shot('wood');
  console.log(`on into the dark wood at ${(await page.evaluate(() => __stats.time)).toFixed(1)} s`);
  const motion = await page.evaluate(() => window.__lensWatch);
  console.log(`the lens turned at most ${motion.turn.toFixed(1)} deg/s (${motion.turnAt}) and moved at most ${motion.move.toFixed(1)} m/s (${motion.moveAt})`);
  if (process.env.LENS) assert(motion.turn < 60, `the lens whipped round at ${motion.turn.toFixed(0)} deg/s (${motion.turnAt})`);
  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
  console.log('drowned run check passed');
} finally {
  await browser.close();
}

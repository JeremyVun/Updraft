// The drowned village's run over the roofs, played with real pointer gestures in Chrome for Testing against a running
// dev server: from the drift (strokes bring the wash-tub to the cat and back, the cat comes to her and she kneels to
// it), the air dying and the boat running aground, the fog coming on, the cat's bolt and her climb out, then her way
// over the roofs after the cat: at the dead tree (where she must wait clear of it, look across to the barn more than up at
// it, be shown the drawn gust within seconds and again after a wrong-way try, which must rock it back, and the frame
// must hold her, its crown and the barn) strokes back and forth across it, as an eager player makes them, must push it
// down across the lane within ten, and she walks up it; strokes up the
// sheet's line fill it to carry her over, circles round the hub turn the mill's sails to wind her up its hoist,
// strokes pump the swing until she lets go over the nave, and she walks on to the tower's foot. Reports the run's
// time, each walk's seconds on foot, how long she waits on the cat at each piece, the fog's nearest approach and how
// soon each roof she goes on from goes under, and fails if she leaves the decks, stalls, the fog reaches her or (in a
// landscape frame) drops out of a walk's frame, a roof she left is not taken, or the boat leaves where it ran aground. Then (unless TO=nave) the
// church: the cat runs up the ivy into the belfry and she climbs after it to the kittens, the fog stops under the sills,
// strokes across the bell ring it four times while the lost boat's lantern answers nearer each time, strokes across its
// sail bring it the last stretch to the nave, she climbs down and the cat comes down the ivy after her to the nave's
// ridge, she steps aboard and looks back up at it and it blinks, then it goes home up the ivy; the storm plays on to
// the forest beach. Reports when each beat falls, the boat's distance home after each ring, when the cat is down and
// home again, how tall it stands on screen at the blink and where she is then, and when the storm's beats fall,
// failing if anything stalls, she leaves the decks, the lantern is out of frame when it answers or comes no nearer, the
// cat is not on the ridge (or the kitten not on the sill) at the slow blink, or the cat is not home on the sill by the
// time the storm's lens takes over.
// Usage: node tools/drowned-run-check.mjs
//   env: BASE (default http://127.0.0.1:5230/), FROM=stairs starts on the stairs and docks their flights first, FROM=roofs starts on the ridge after the cat (skips the tub and the
//        becalming), FROM=church at the tower's foot (skips the run too), FROM=belfry in the belfry with the bell to
//        ring, FROM=storm with her just seated aboard at the nave (skips the church too), SHOTS=<prefix> saves stills (at each piece,
//        two between, and through the church), FILM=<seconds> with SHOTS also
//        saves a still every that many seconds from the air dying (FILMFROM=cat from the tub's puzzle; from the ridge
//        with FROM=roofs, the tower's foot with FROM=church) to the storm, and with FROM=stairs through the descent in the white and 30 s on,
//        TO=nave stops at the tower's foot, TO=tree once she is over the tree and the lens has gone round to the sheet, TO=swing once
//        she is on the swing (with the walks' measures), TO=ridge once she is up on the first roof after the cat, VIDEO=<dir> records the whole play as a webm there, W/H viewport
//        (default 1600x900), LENS=1 also fails on the lens's measures (a roof hiding her, her walking toward it, her
//        out of frame, it inside a roof, it whipping round; and at the church, from the tower's foot until the
//        storm's frame takes over, her out of frame or hidden by the church or a roof).
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600), height = Number(process.env.H ?? 900);
const shots = process.env.SHOTS ?? null;
const fromStairs = process.env.FROM === 'stairs';
const fromStorm = process.env.FROM === 'storm';
const fromBelfry = process.env.FROM === 'belfry';
const fromChurch = process.env.FROM === 'church' || fromBelfry || fromStorm;
const fromRoofs = process.env.FROM === 'roofs' || fromChurch;
const toRidge = process.env.TO === 'ridge';
const toTree = process.env.TO === 'tree';
const toSwing = process.env.TO === 'swing';
const toNave = process.env.TO === 'nave' || toRidge || toTree || toSwing;

const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const video = process.env.VIDEO ?? null;
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
  ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {}) });
let page = null;
/** When the recording began, so what is heard and the lens's trace can be laid under it. */
let recordedFrom = 0;
try {
  page = await context.newPage();
  recordedFrom = Date.now();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?shot=1&chapter=${fromStorm ? 'storm' : fromBelfry ? 'belfry' : fromChurch ? 'church' : fromRoofs ? 'roofs' : fromStairs ? 'stairs' : 'drowned'}&ratio=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

  /** The lens's own motion every frame in the drowned village and on into the wood: its fastest turn and move, and where. */
  await page.evaluate(() => {
    const w = window.__lensWatch = { turn: 0, turnAt: '', move: 0, moveAt: '', cuts: [], stretches: {}, trace: [] };
    let last = null, sampled = -1, from = null;
    const tick = () => {
      const st = __game.story.current, cam = __game.rig.camera, t = __stats.time;
      const d = cam.getWorldDirection(cam.position.clone()), p = cam.position.clone();
      const stretch = `${st.beat ?? __game.story.name}${st.run && st.run.stage !== 'off' ? '/' + st.run.stage : ''}${st.church && st.church.step !== 'off' ? '/' + st.church.step : ''}`;
      const where = () => `${stretch} at ${t.toFixed(1)} s`;
      const ours = __game.story.name === 'drowned' || last?.name === 'drowned';
      from ??= t;
      if (ours && last && last.story === st && last.cut !== st.cameraCut && t - from > 3) w.cuts.push(where());
      /** A start straight into the room settles the lens over its first moments; that is not play. */
      if (ours && last && t > last.t && t - from > 3 && (last.cut === st.cameraCut || last.story !== st)) {
        const dt = t - last.t, turn = Math.acos(Math.min(1, d.dot(last.d))) * 180 / Math.PI / dt, move = p.distanceTo(last.p) / dt;
        if (turn > w.turn) { w.turn = turn; w.turnAt = `${where()}, the lens at ${p.toArray().map((v) => v.toFixed(1))} over ${(dt * 1000).toFixed(0)} ms`; }
        if (move > w.move) { w.move = move; w.moveAt = where(); }
        const s = w.stretches[stretch] ??= { turn: 0, at: 0 };
        if (turn > s.turn) { s.turn = turn; s.at = t; }
        /** Every quarter second: how far off her, how high over her feet, the angle down to her head, the field, the turn. */
        if (t - sampled >= 0.25 && st.beat) {
          sampled = t;
          const c = __game.child.position, head = c.y + 1.2;
          const flat = Math.hypot(p.x - c.x, p.z - c.z);
          w.trace.push({ t: +t.toFixed(2), wall: Math.round(performance.timeOrigin + performance.now()), where: stretch, flat: +flat.toFixed(2), over: +(p.y - c.y).toFixed(2),
            down: +(Math.atan2(p.y - head, flat) * 180 / Math.PI).toFixed(1), fov: +cam.fov.toFixed(1), turn: +turn.toFixed(1),
            lens: p.toArray().map((v) => +v.toFixed(2)), her: c.toArray().map((v) => +v.toFixed(2)), along: st.run ? +st.run.along.toFixed(1) : null,
            fogOut: window.__runWatch ? +window.__runWatch.fogGoneRun.toFixed(2) : null, fog: [+__game.village.dark.front.toFixed(1), +__game.village.dark.ahead.x.toFixed(3), +__game.village.dark.ahead.y.toFixed(3), +__game.village.dark.level.toFixed(2)], look: d.toArray().map((v) => +v.toFixed(3)), toward: window.__runWatch ? +window.__runWatch.facingRun.toFixed(2) : null,
            cat: window.__runWatch?.catLast ?? null, catAt: __game.cat.position.toArray().map((v) => +v.toFixed(2)) });
        }
      }
      last = { t, d, p, cut: st.cameraCut, story: st, name: __game.story.name };
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
  /** Each still's lens: how far off her (flat), how high over her feet, the angle down to her head and the vertical field. */
  const measures = {};
  const measure = (name) => page.evaluate(() => {
    const st = __game.story.current, cam = __game.rig.camera, p = cam.position, c = __game.child.position;
    const flat = Math.hypot(p.x - c.x, p.z - c.z);
    return { t: +__stats.time.toFixed(1), where: `${st.beat}${st.run && st.run.stage !== 'off' ? '/' + st.run.stage : ''}${st.church && st.church.step !== 'off' ? '/' + st.church.step : ''}`,
      flat: +flat.toFixed(1), over: +(p.y - c.y).toFixed(1), down: +(Math.atan2(p.y - c.y - 1.2, flat) * 180 / Math.PI).toFixed(1), fov: +cam.fov.toFixed(0) };
  }).then((m) => { measures[name] = m; });
  const keep = async () => { if (shots) (await import('node:fs')).writeFileSync(`${shots}-measures.json`, JSON.stringify(measures)); };
  const shot = async (name) => { if (shots) { await page.screenshot({ path: `${shots}-${name}.png` }); await measure(name); await keep(); console.log(`  ${shots}-${name}.png`); } };
  const film = Number(process.env.FILM ?? 0);
  let filmed = -1, filmFrom = null;
  /** A still every `FILM` seconds of the run, once it has begun. */
  const reel = async () => {
    if (!film || !shots || filmFrom === null) return;
    const t = await page.evaluate(() => __stats.time);
    const n = Math.floor((t - filmFrom) / film);
    if (n > filmed) {
      filmed = n;
      const name = `film-${String(n).padStart(3, '0')}`;
      await page.screenshot({ path: `${shots}-${name}.png` });
      await measure(name);
      await keep();
    }
  };
  const state = () => page.evaluate(() => {
    const st = __game.story.current, r = st.run, f = (v) => v.toArray().map((x) => +x.toFixed(2));
    return { time: +__stats.time.toFixed(1), beat: st.beat, step: st.cat.step, stage: r.stage, along: +r.along.toFixed(1),
      child: f(__game.child.position), cat: f(__game.cat.position), tree: r.tree.phase, fallen: r.tree.tree.state,
      sheet: r.sheet.phase, clear: r.sheet.clear, mill: r.mill.phase, swing: r.swing.phase, boat: f(__game.boat.position),
      front: +__game.village.dark.front.toFixed(1), level: +__game.village.dark.level.toFixed(2) };
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
        storm: +st.stormTime.toFixed(1), grounded: b.grounded, out: st.out, leg: st.leg, rings: ch.rings, answered: ch.answered,
        bell: +ch.bell.angle.toFixed(3), level: +__game.village.dark.level.toFixed(2), kitten: f(__game.village.kittens.cats[0].position) };
    });
    const sharp = (await import('sharp')).default;
    /**
     * Whether she reads in the frame: her raincoat's warmth (red over blue) against what stands round her, in a box
     * about her on screen, every half second from the tower's foot until the lens has given way to the storm's.
     */
    const sight = { lostRun: 0, lostWorst: 0, lostAt: '', last: -1, trace: [] };
    const seen = async () => {
      const at = await page.evaluate(() => {
        const ch = __game.story.current.church, cam = __game.rig.camera, p = __game.child.position;
        if (!ch || ch.step === 'off' || ch.aboardFor >= __leaveBy) return null;
        const c = __game.child, foot = p.clone().project(cam), head = (c.riding ? c.face(p.clone()) : p.clone().setY(p.y + 1.15)).project(cam);
        return { time: __stats.time, step: ch.step, aboardFor: ch.aboardFor, foot: [foot.x, foot.y, foot.z], head: [head.x, head.y, head.z] };
      });
      if (!at || at.time - sight.last < 0.5) return;
      sight.last = at.time;
      const px = (q) => [(q[0] + 1) / 2 * width, (1 - q[1]) / 2 * height];
      const [hx, hy] = px(at.head), [fx, fy] = px(at.foot);
      const tall = Math.max(12, fy - hy), cx = (hx + fx) / 2, cy = (hy + fy) / 2;
      const x0 = Math.max(0, Math.round(cx - tall)), x1 = Math.min(width, Math.round(cx + tall));
      const y0 = Math.max(0, Math.round(cy - tall)), y1 = Math.min(height, Math.round(cy + tall));
      let warmth = 0;
      if (at.head[2] < 1 && x1 - x0 > 4 && y1 - y0 > 4) {
        const { data } = await sharp(await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } })).removeAlpha().raw()
          .toBuffer({ resolveWithObject: true });
        const warm = [];
        for (let i = 0; i < data.length; i += 3) warm.push(data[i] - data[i + 2]);
        warm.sort((a, b) => a - b);
        warmth = warm[Math.floor(warm.length * 0.97)] - warm[Math.floor(warm.length * 0.5)];
      }
      const where = `${at.step}${at.aboardFor >= 0 ? ` ${at.aboardFor.toFixed(1)} s aboard` : ''}, until ${at.time.toFixed(1)} s`;
      sight.trace.push(`${at.time.toFixed(1)}:${warmth}`);
      const lost = warmth < 24;
      sight.lostRun = lost ? sight.lostRun + 0.5 : 0;
      if (sight.lostRun > sight.lostWorst) { sight.lostWorst = sight.lostRun; sight.lostAt = where; }
    };
    const wait = async (test, limit, what) => {
      for (let t = 0; t < limit; t += 0.25) {
        const s = await look();
        if (test(s)) return s;
        await seconds(0.25);
        await reel();
        await seen();
      }
      assert.fail(`${what} did not happen in ${limit} s: ${JSON.stringify(await look())}`);
    };
    await page.evaluate(async () => {
      const D = await import('/src/world/decks.ts');
      const W = await import('/src/world/drowned-way.ts');
      const { tuning } = await import('/src/tuning.ts');
      const k = tuning.drownedCamera.church;
      window.__leaveBy = tuning.drowned.church.lookUpFor + k.leaveFrom + k.leaveFor;
      const w = window.__churchWatch = { offWorst: 0, offAt: '', unseenRun: 0, unseenWorst: 0, unseenAt: '', hiddenRun: 0, hiddenWorst: 0, hiddenAt: '',
        catGoes: null, catDown: null, catHome: null, herDown: null, seated: null };
      const roofs = [...W.PLACED, W.NAVE];
      /** A roof or the tower between the lens and her. */
      const solid = (x, y, z) => Math.abs(x - W.TOWER.x) < W.TOWER.half && Math.abs(z - W.TOWER.z) < W.TOWER.half && y < W.TOWER.sill + 3.5
        || roofs.some((h) => y < (W.roofUnder(h, x, z) ?? -Infinity) - 0.05);
      const tick = () => {
        const ch = __game.story.current.church, c = __game.child, p = c.position;
        /** When the cat sets off down after her, is down on the ridge, and is home on the sill again; when she is down and seated. */
        if (ch && ch.step !== 'off') {
          const t = __stats.time, cat = __game.cat;
          if (ch.catAt === 'down' && w.catGoes === null) w.catGoes = t;
          if (ch.catAt === 'ridge' && w.catDown === null) w.catDown = t;
          if (ch.catAt === 'home' && w.catHome === null && !cat.busy && cat.position.y > W.TOWER.sill - 0.1) w.catHome = t;
          if (ch.step === 'wait' && w.herDown === null) w.herDown = t;
          if (ch.aboardFor >= 0 && w.seated === null) w.seated = t;
        }
        if (ch && ch.step !== 'off' && ch.step !== 'board' && ch.aboardFor < 0 && !c.riding && !c.action && !c.climbing) {
          const beyond = D.beyondDecks(c.decks, p.x, p.z, p.y), under = D.deckGround(c.decks, p.x, p.z, p.y);
          const off = Math.max(beyond === Infinity ? 99 : beyond, Math.abs(under - p.y));
          if (off > w.offWorst) { w.offWorst = off; w.offAt = `${ch.step} at ${p.toArray().map((v) => v.toFixed(2))}`; }
        }
        /** She stays in the frame and in sight from the tower's foot until the lens has given way to the storm's. */
        if (ch && ch.step !== 'off' && ch.aboardFor < window.__leaveBy) {
          /** Seated, her head is her face's height over the boards, not a standing child's. */
          const cam = __game.rig.camera, e = cam.position, head = c.riding ? c.face(p.clone()) : p.clone().setY(p.y + 1.1);
          const q = head.clone().project(cam);
          const out = Math.abs(q.x) > 0.95 || Math.abs(q.y) > 0.95 || q.z > 1;
          let hidden = false;
          for (let i = 1; i < 32 && !hidden; i++) {
            const u = i / 32, x = e.x + (head.x - e.x) * u, y = e.y + (head.y - e.y) * u, z = e.z + (head.z - e.z) * u;
            if (Math.hypot(x - p.x, z - p.z) > 0.8 && solid(x, y, z)) hidden = true;
          }
          const where = `${ch.step}${ch.aboardFor >= 0 ? ` ${ch.aboardFor.toFixed(1)} s aboard` : ''}, until ${__stats.time.toFixed(1)} s`;
          w.unseenRun = out ? w.unseenRun + 1 / 60 : 0;
          if (w.unseenRun > w.unseenWorst) { w.unseenWorst = w.unseenRun; w.unseenAt = where; }
          w.hiddenRun = hidden && !out ? w.hiddenRun + 1 / 60 : 0;
          if (w.hiddenRun > w.hiddenWorst) { w.hiddenWorst = w.hiddenRun; w.hiddenAt = where; }
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
        light: [LIGHTHOUSE.x, LIGHTHOUSE.z], sill: W.IVY_SILL.toArray(), legs: DROWNED_CHANNEL.length + 2,
        ridge: [W.IVY_FOOT.x - tuning.drowned.church.catRidge, W.IVY_FOOT.y, W.IVY_FOOT.z],
        leaveBy: tuning.drowned.church.lookUpFor + tuning.drownedCamera.church.leaveFrom,
        berth: [W.NAVE_BERTH.x, W.NAVE_BERTH.z], home: [...W.HOME_WAY, ...W.BRING_WAY].map((p) => [p.x, p.y]),
        rings: tuning.drowned.church.rings, blinkAt: tuning.drowned.church.blinkAt, lookUpFor: tuning.drowned.church.lookUpFor };
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
        if (since >= T.lookUpFor + 2.5 && since < T.lookUpFor + 2.8) assert(s.riding && s.beat === 'gather', `she is not riding the boat into the storm: ${JSON.stringify(s)}`);
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
        await seen();
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
      const back = trace.filter((r) => r.second >= trace[0].second && r.second <= T.lookUpFor && !r.flash);
      const lookBack = back.reduce((a, r) => a + r.mean, 0) / Math.max(1, back.length);
      const lit = trace.filter((r) => r.second > T.lookUpFor && !r.flash);
      const brightest = lit.reduce((a, r) => (r.mean > a.mean ? r : a), { mean: -1, second: -1 });
      console.log(`  mean brightness each second from aboard: ${trace.map((r) => `${r.second}:${r.mean.toFixed(0)}${r.flash ? '*' : r.ashore ? '+' : ''}`).join(' ')}`);
      /**
       * Once the lens has come down from the cat on the sill, 3 s into the storm: that move brings the frame from the
       * lit stone down to the dark water, continuously; a cut anywhere after it still shows.
       */
      const cut = trace.slice(1).reduce((worst, r, i) => (r.flash || trace[i].flash || r.second <= T.lookUpFor + 3 ? worst
        : Math.max(worst, Math.abs(r.mean - trace[i].mean))), 0);
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
    /** How far the boat still has to come home along its way to the berth, from where it is. */
    const homeLeft = (p) => {
      let best = Infinity, at = 0;
      for (let i = 1; i < T.home.length; i++) {
        const a = T.home[i - 1], b = T.home[i], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez;
        const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[2] - a[1]) * ez) / l2));
        const dd = Math.hypot(p[0] - a[0] - ex * u, p[2] - a[1] - ez * u);
        if (dd < best) { best = dd; at = i; }
      }
      let left = d(xz(p), T.home[at]);
      for (let i = at + 1; i < T.home.length; i++) left += d(T.home[i - 1], T.home[i]);
      return left;
    };
    const atNave = (await wait((s) => s.step !== 'off', 30, 'the church beginning')).time;
    filmFrom ??= atNave;
    const beats = {};
    if (!fromBelfry) {
      await wait((s) => s.cat[1] > 4, 30, 'the cat halfway up the ivy');
      await shot('church-cat-ivy');
      beats.climbFrom = (await wait((s) => s.step === 'climb', 30, 'her following the cat up the ivy')).time;
      await wait((s) => s.step === 'climb' && s.child[1] > 5.6, 30, 'her halfway up the ivy');
      await shot('refuge-climb');
      beats.nest = (await wait((s) => s.step === 'nest', 30, 'her in the opening over the kittens')).time;
      await seconds(3.4);
      await shot('refuge-kittens');
      beats.sea = (await wait((s) => s.step === 'sea', 20, 'her looking out over the fog sea')).time;
      await seconds(3);
      await shot('refuge-fog-sea');
    }
    beats.ring = (await wait((s) => s.step === 'ring', 30, 'the bell hers to ring')).time;
    await page.evaluate(() => {
      const b = __game.story.current.church.bell, was = b.onRing;
      window.__heard = [];
      b.onRing = (strength) => { __heard.push({ at: performance.timeOrigin + performance.now(), peak: b.peak }); was?.(strength); };
    });
    await seconds(1);
    await shot('bell');
    /** Strokes across the bell, each once it has come back near rest, until the lantern has answered four rings. */
    const rang = [];
    let bellStrokes = 0;
    for (; bellStrokes < 40; bellStrokes++) {
      const s = await look();
      if (s.step !== 'ring' || s.rings >= T.rings) break;
      for (let i = 0; i < 24 && Math.abs((await look()).bell) > 0.08; i++) await seconds(0.25);
      const aim = await page.evaluate(() => {
        const b = __game.story.current.church.bell, cam = __game.rig.camera;
        const a = b.middle(cam.position.clone()).project(cam);
        return { at: [(a.x + 1) / 2, (1 - a.y) / 2], heading: b.screenHeading(cam) };
      });
      await stroke(aim.at, aim.heading, 0.42, 9);
      await seconds(0.6);
      await seen();
      const after = await look();
      if (after.rings > s.rings) {
        const before = homeLeft(after.boat);
        for (let i = 0; i < 20 && (await look()).answered < after.rings; i++) await seconds(0.25);
        await seconds(2.2);
        const lantern = await page.evaluate(() => {
          const l = __game.story.current.church, cam = __game.rig.camera;
          const q = l.homeAt.clone().project(cam);
          return [+q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(3)];
        });
        const s2 = await look();
        rang.push({ ring: after.rings, time: after.time, boatBefore: before, boatAfter: homeLeft(s2.boat), level: s2.level, lantern });
        await shot(`ring-${after.rings}`);
      }
    }
    const heard = await page.evaluate(() => window.__heard);
    console.log(`  the rings heard, seconds into the recording: ${JSON.stringify(heard.map((h) => ({ t: +((h.at - recordedFrom) / 1000).toFixed(2), ring: true, peak: +h.peak.toFixed(3) })))}`);
    for (const r of rang) {
      console.log(`  ring ${r.ring} at ${(r.time - beats.ring).toFixed(1)} s: the boat ${r.boatBefore.toFixed(1)} m from the berth, ${r.boatAfter.toFixed(1)} m after it answered; the fog's top ${r.level} m; the lantern on screen at ${r.lantern.slice(0, 2).join(', ')}`);
    }
    assert.equal(rang.length, T.rings, `the bell rang ${rang.length} times in ${bellStrokes} strokes`);
    for (let i = 1; i < rang.length; i++) assert(rang[i].boatAfter < rang[i - 1].boatAfter - 2, `the lantern did not come nearer at ring ${rang[i].ring}`);
    for (const r of rang) assert(r.lantern[2] < 1 && Math.abs(r.lantern[0]) < 0.95 && Math.abs(r.lantern[1]) < 0.95, `the lantern was out of frame when it answered ring ${r.ring}`);
    const bring = await wait((s) => s.step === 'down', 20, 'the boat hers to sail home');
    for (let i = 0; i < 6; i++) {
      await seconds(0.5);
      await seen();
    }
    await shot('church-invitation');
    let strokes = 0;
    for (; strokes < 80; strokes++) {
      const s = await look();
      if (s.grounded || !(s.step === 'down' || s.step === 'wait')) break;
      const aim = await page.evaluate(() => {
        const b = __game.boat, cam = __game.rig.camera;
        if (!__game.story.current.invitesSail) return null;
        const at = b.sailPoint(cam.position.clone());
        const a = at.clone().project(cam), ahead = at.clone().set(at.x + Math.sin(b.yaw) * 2, at.y, at.z + Math.cos(b.yaw) * 2).project(cam);
        return { at: [(a.x + 1) / 2, (1 - a.y) / 2], heading: Math.atan2(ahead.y - a.y, (ahead.x - a.x) * cam.aspect) };
      });
      if (!aim) { await seconds(0.5); continue; }
      await stroke(aim.at, aim.heading, 0.35, 12);
      await seen();
      await seconds(0.7);
      await seen();
      if (strokes === 4) await shot('church-bring');
    }
    const home = await wait((s) => s.grounded, 40, 'the boat at the tower\'s foot');
    await shot('boat-at-foot');
    const berthed = await wait((s) => s.step === 'board', 40, 'her stepping down into the boat');
    const berth = (await look()).boat;
    await seconds(1.0);
    await shot('church-boarding');
    const aboard = await wait((s) => s.aboardFor >= 0, 15, 'her seated aboard');
    const pushed = d(xz(aboard.boat), xz(berth));
    const blink = await wait((s) => s.aboardFor >= T.blinkAt + 0.5, 10, 'the cat\'s slow blink');
    await shot('slow-blink');
    /** How tall the cat stands on screen at the blink, feet to ear tips by its bones, and where it and she are in the frame. */
    const seenAtBlink = await page.evaluate(async () => {
      const B = await import('/src/creatures/cat/body.ts');
      const cat = __game.cat, cam = __game.rig.camera, c = __game.child, v = cat.position.clone(), tail = new Set(B.TAIL);
      let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
      for (let i = 1; i < B.BONES; i++) {
        if (tail.has(i)) continue;
        cat.rig.joint(i, v);
        if (i === B.EAR_L || i === B.EAR_R) v.y += 0.035 * cat.scale;
        const p = v.project(cam), x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
        top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
      }
      const f = c.face(c.position.clone()).project(cam);
      return { px: bottom - top, cat: [(left + right) / 2 / innerWidth, (top + bottom) / 2 / innerHeight], her: [(f.x + 1) / 2, (1 - f.y) / 2] };
    });
    const onRidge = Math.hypot(blink.cat[0] - T.ridge[0], blink.cat[2] - T.ridge[2]);
    const kittenSill = Math.hypot(blink.kitten[0] - T.sill[0], blink.kitten[1] - T.sill[1], blink.kitten[2] - T.sill[2]);
    await storm(aboard, atNave);
    const w = await page.evaluate(() => window.__churchWatch);
    if (!fromBelfry) {
      console.log(`church: she followed the cat up the ivy ${(beats.climbFrom - atNave).toFixed(1)} s after the tower's foot, was in over the kittens at ${(beats.nest - atNave).toFixed(1)} s, looking out over the fog sea at ${(beats.sea - atNave).toFixed(1)} s, the bell hers at ${(beats.ring - atNave).toFixed(1)} s and first rung at ${(rang[0].time - atNave).toFixed(1)} s`);
    }
    console.log(`  the bell rang four times in ${bellStrokes} strokes over ${(rang[rang.length - 1].time - rang[0].time).toFixed(1)} s; the sail hers ${(bring.time - rang[rang.length - 1].time).toFixed(1)} s after the last ring`);
    console.log(`  the boat home ${(home.time - bring.time).toFixed(1)} s after it was hers to sail, with ${strokes} strokes; her aboard ${(aboard.time - bring.time).toFixed(1)} s after${berthed.carrying ? ' (the safety valve carried it)' : ''}; the storm ${(aboard.time - atNave).toFixed(1)} s + the look up after the tower's foot`);
    console.log(`  the cat set off down after her ${(w.catGoes - bring.time).toFixed(1)} s after the sail was hers, was down on the ridge ${(w.catDown - w.herDown).toFixed(1)} s after she was off the ivy and ${(w.seated - w.catDown).toFixed(1)} s before she sat down, and home on the sill ${(w.catHome - w.seated).toFixed(1)} s after she sat down`);
    console.log(`  at the slow blink the cat was ${onRidge.toFixed(2)} m from its place on the ridge, ${seenAtBlink.px.toFixed(0)} px tall at ${seenAtBlink.cat.map((v) => v.toFixed(2)).join(', ')} in the frame, her face at ${seenAtBlink.her.map((v) => v.toFixed(2)).join(', ')}; the kitten ${kittenSill.toFixed(2)} m from the sill of her light`);
    console.log(`  her step aboard moved the boat ${pushed.toFixed(2)} m; her feet stayed within ${w.offWorst.toFixed(3)} m of the decks (worst ${w.offAt})`);
    console.log(`  through the church she was out of frame for at most ${w.unseenWorst.toFixed(1)} s at a time (${w.unseenAt}), hidden by the church or a roof for at most ${w.hiddenWorst.toFixed(1)} s (${w.hiddenAt})`);
    console.log(`  her raincoat's warmth against what stands round her each half second: ${sight.trace.join(' ')}`);
    console.log(`  she was lost in the frame (the fog or the dark over her) for at most ${sight.lostWorst.toFixed(1)} s at a time (${sight.lostAt})`);
    const lens = [[w.unseenWorst < 0.5, `she was out of the frame at the church for ${w.unseenWorst.toFixed(1)} s (${w.unseenAt})`],
      [sight.lostWorst < 1.5, `she was lost in the frame at the church for ${sight.lostWorst.toFixed(1)} s (${sight.lostAt})`],
      [w.hiddenWorst < 1, `the church or a roof hid her for ${w.hiddenWorst.toFixed(1)} s (${w.hiddenAt})`]];
    for (const [ok, what] of lens) {
      if (process.env.LENS) assert(ok, what);
      else if (!ok) console.log(`  lens: ${what}`);
    }
    assert(w.offWorst < 0.4, `she left the decks at the church: ${w.offWorst.toFixed(2)} m (${w.offAt})`);
    assert(!berthed.carrying, 'the strokes never brought the boat: the safety valve carried it');
    assert(pushed < 0.6, `her step aboard pushed the boat ${pushed.toFixed(2)} m`);
    assert(onRidge < 0.5 && Math.abs(blink.cat[1] - T.ridge[1]) < 0.3, `the cat is not on the ridge at the slow blink (${blink.cat.join(', ')})`);
    assert(kittenSill < 0.8, `the kitten is not on the sill at the slow blink (${blink.kitten.join(', ')})`);
    assert(w.catHome !== null && w.catHome - w.seated < T.leaveBy, `the cat was not home on the sill by the time the storm's lens took over (${w.catHome === null ? 'never' : (w.catHome - w.seated).toFixed(1) + ' s after she sat'})`);
    const inside = (p) => p[0] > 0.02 && p[0] < 0.98 && p[1] > 0.02 && p[1] < 0.98;
    if (process.env.LENS && width > height) assert(seenAtBlink.px >= 80 && inside(seenAtBlink.cat) && inside(seenAtBlink.her), `at the blink the cat was ${seenAtBlink.px.toFixed(0)} px tall at ${seenAtBlink.cat.map((v) => v.toFixed(2))} and her face at ${seenAtBlink.her.map((v) => v.toFixed(2))}`);
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
    let st = await stairs(), shotDown = false, descentShot = -Infinity;
    for (let i = 0; i < 2000 && st.chapter === 'stairs'; i++) {
      if (st.beat === 'waiting' && st.flight && inFrame(st.flight.to)) {
        const [ax, ay] = st.flight.at, [bx, by] = st.flight.to;
        await stroke([(ax + bx) / 2, (ay + by) / 2], Math.atan2(-(by - ay) * height, (bx - ax) * width), Math.max(0.1, Math.hypot((bx - ax) * width / height, by - ay)), 40);
      } else if (st.beat === 'loop' && inFrame(st.wind)) await stroke(st.wind, 0.2, 0.38, 24);
      else await seconds(0.5);
      if (!shotDown && st.beat !== 'waiting' && st.beat !== 'loop' && i > 10) { shotDown = true; await shot('stairs-leaving'); }
      if (film && shots && ['fog', 'thin', 'down'].includes(st.beat) && st.time - descentShot >= film) {
        descentShot = st.time;
        await page.screenshot({ path: `${shots}-descent-${st.beat}-${st.time.toFixed(0).padStart(4, '0')}.png` });
      }
      st = await stairs();
    }
    /** On from the stairs into the village, the stills going on as it comes out of the white. */
    for (let t = 0; film && shots && t < 30; t += film) {
      await page.screenshot({ path: `${shots}-descent-drowned-${(await page.evaluate(() => __stats.time)).toFixed(0).padStart(4, '0')}.png` });
      await seconds(film);
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
    if (process.env.FILMFROM === 'cat') filmFrom = (await state()).time;
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
    filmFrom ??= (await state()).time;
    for (let t = 0; t < 4; t += 0.25) {
      await seconds(0.25);
      await reel();
    }
    await shot('air-dies');
    await until((s) => s.beat === 'becalmed', 30, 'the boat at rest');
    for (let t = 0; t < 14; t += 0.25) {
      await seconds(0.25);
      await reel();
    }
    await shot('fog-rising');
    await reach('climbing', 150);
    await seconds(2);
    await shot('climb');
    await reach('ridge', 150);
    console.log('she is up on the ridge after the cat', JSON.stringify(await state()));
  }
  run: if (!fromChurch && !toRidge) {
    filmFrom ??= (await state()).time;
    await until((s) => s.beat === 'run', 30, 'her setting off');
    await frame();

    // Watches every frame from here: her feet on the decks, her progress, the fog behind her and in the frame, the
    // roofs she leaves going under it, the boat where it lies, and how long she waits on the cat at a piece.
    await page.evaluate(async () => {
      const D = await import('/src/world/decks.ts');
      const W = await import('/src/world/drowned-way.ts');
      const { tuning } = await import('/src/tuning.ts');
      const w = window.__runWatch = { frames: 0, offWorst: 0, offAt: '', fogAhead: Infinity, fogNear: Infinity, fogAt: '',
        stallWorst: 0, stallAt: '', last: -1, since: 0, facing: 0, facingRun: 0, facingWorst: 0, facingAt: '', unseen: 0, unseenRun: 0,
        unseenWorst: 0, unseenAt: '', inside: 0, insideAt: '', fogGoneRun: 0, fogGoneWorst: 0, fogGoneAt: '', boatMoved: 0,
        roofs: {}, waits: {}, levelAt: [], fogByWalk: {}, catByWalk: {}, catLostRun: 0, catPxByWalk: {} };
      const front = W.DARK_WAY[0].clone();
      const strand = { x: __game.boat.position.x, z: __game.boat.position.z };
      const placed = W.PLACED.map((h, i) => ({ h, i }));
      const cam = __game.rig.camera;
      const probe = cam.position.clone();
      const B = await import('/src/creatures/cat/body.ts');
      const tail = new Set(B.TAIL), bone = cam.position.clone();
      /**
       * How big the cat stands on the screen (its box's diagonal by its bones, feet to ear tips and nose to rump, px), and
       * whether it is in the frame and clear of every roof.
       */
      const catSeen = () => {
        const cat = __game.cat;
        let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity, behind = false;
        for (let i = 1; i < B.BONES; i++) {
          if (tail.has(i)) continue;
          cat.rig.joint(i, bone);
          if (i === B.EAR_L || i === B.EAR_R) bone.y += 0.035 * cat.scale;
          bone.project(cam);
          if (bone.z > 1) behind = true;
          top = Math.min(top, bone.y); bottom = Math.max(bottom, bone.y); left = Math.min(left, bone.x); right = Math.max(right, bone.x);
        }
        const px = Math.hypot((right - left) * innerWidth / 2, (bottom - top) * innerHeight / 2);
        const inFrame = !behind && Math.abs((left + right) / 2) < 0.95 && Math.abs((top + bottom) / 2) < 0.95;
        const at = cat.position, e = cam.position;
        let hidden = false;
        for (let i = 1; i < 24 && !hidden; i++) {
          const u = i / 24, x = e.x + (at.x - e.x) * u, z = e.z + (at.z - e.z) * u, y = e.y + (at.y + 0.15 - e.y) * u;
          if (Math.hypot(x - at.x, z - at.z) > 0.5 && [...W.PLACED, W.NAVE].some((h) => y < (W.roofUnder(h, x, z) ?? -Infinity) - 0.05)) hidden = true;
        }
        return { px, inFrame, hidden };
      };
      window.__catPx = 40 * Math.min(innerWidth, innerHeight) / 900;
      const tick = () => {
        const st = __game.story.current, r = st.run, c = __game.child, p = c.position, t = __stats.time;
        if (!r || r.stage === 'off') { requestAnimationFrame(tick); return; }
        w.frames++;
        const flying = c.action?.kind === 'leap' || c.riding || r.swing.phase === 'boarding' || r.swing.phase === 'riding' || r.swing.phase === 'flying'
          || r.sheet.hanging || r.sheet.phase === 'landing' || r.mill.phase === 'riding';
        if (!flying) {
          const beyond = D.beyondDecks(c.decks, p.x, p.z, p.y);
          const under = D.deckGround(c.decks, p.x, p.z, p.y);
          const off = Math.max(beyond === Infinity ? 99 : beyond, Math.abs(under - p.y));
          if (off > w.offWorst) { w.offWorst = off; w.offAt = `${r.stage} at ${p.toArray().map((v) => v.toFixed(2))}`; }
        }
        /** The fog: how far ahead of its front's line she is, and its front in the frame on her own way. */
        const dark = __game.village.dark;
        W.darkWayPoint(dark.front, front);
        const dx = dark.ahead.x, dz = dark.ahead.y, dl = 1;
        const ahead = ((p.x - front.x) * dx + (p.z - front.y) * dz) / dl, near = Math.hypot(p.x - front.x, p.z - front.y);
        if (ahead < w.fogAhead) { w.fogAhead = ahead; w.fogNear = near; w.fogAt = `${r.stage} at ${r.along.toFixed(1)} m, ${t.toFixed(1)} s`; }
        if (r.stage === 'walk') {
          let seen = false;
          /** Its body low down or its top, which is what a lens up on the high roofs sees of it. */
          for (let a = -40; a <= 40 && !seen; a += 5) {
            for (const deep of [0, 6, 14]) {
              for (const y of [Math.min(2.5, dark.level * 0.5), dark.level * 0.85]) {
                probe.set(front.x - (dz / dl) * a - (dx / dl) * deep, y, front.y + (dx / dl) * a - (dz / dl) * deep).project(cam);
                if (probe.z < 1 && Math.abs(probe.x) < 0.98 && Math.abs(probe.y) < 0.98) { seen = true; break; }
              }
              if (seen) break;
            }
          }
          w.fogGoneRun = seen ? 0 : w.fogGoneRun + 1 / 60;
          const f = (v) => v.toArray().map((x) => x.toFixed(1)).join(',');
          const walk = `her way to the ${['tree', 'sheet', 'mill', 'swing'].find((piece) => r[piece].phase !== 'over') ?? 'nave'}`;
          w.fogByWalk[walk] = Math.max(w.fogByWalk[walk] ?? 0, w.fogGoneRun);
          if (w.fogGoneRun > w.fogGoneWorst) {
            w.fogGoneWorst = w.fogGoneRun;
            w.fogGoneAt = `at ${r.along.toFixed(1)} m, until ${t.toFixed(1)} s; her at ${f(p)}, the lens at ${f(cam.position)}, the front at ${front.x.toFixed(1)},${front.y.toFixed(1)} coming ${dx.toFixed(2)},${dz.toFixed(2)}, its top ${dark.level.toFixed(1)} m`;
          }
        } else w.fogGoneRun = 0;
        /**
         * The cat on her own way: in the frame, clear of the roofs and big enough to read as a cat (but while she looks
         * back at the boat or down at the fog, where the lens looks away from it by design).
         */
        const looking = (r.lookingBack >= 0 && r.lookingBack < tuning.drowned.run.lookBackFor)
          || (r.lookingDown >= 0 && r.lookingDown < tuning.drowned.run.lookDownFor);
        if (r.stage === 'walk' && !looking) {
          const walk = `her way to the ${['tree', 'sheet', 'mill', 'swing'].find((piece) => r[piece].phase !== 'over') ?? 'nave'}`;
          const seen = catSeen(), readable = seen.inFrame && !seen.hidden && seen.px >= window.__catPx;
          w.catLostRun = readable ? 0 : w.catLostRun + 1 / 60;
          w.catLast = [Math.round(seen.px), +seen.inFrame, +seen.hidden];
          w.catByWalk[walk] = Math.max(w.catByWalk[walk] ?? 0, w.catLostRun);
          if (w.frames % 6 === 0) (w.catPxByWalk[walk] ??= []).push(seen.inFrame && !seen.hidden ? Math.round(seen.px) : 0);
        } else w.catLostRun = 0;
        /**
         * The roofs she has been on: when she went on from each and where, and when the fog has that place under it,
         * front and top.
         */
        for (const { h, i } of placed) {
          const top = W.roofUnder(h, p.x, p.z);
          const rec = w.roofs[i];
          if (top !== null && Math.abs(top - p.y) < 0.6) {
            w.roofs[i] = { name: i, left: t, x: p.x, z: p.z, under: null, ridge: W.ridgeTop(h) };
            continue;
          }
          if (!rec || rec.under !== null) continue;
          /** Beside it in the mill's basket, or looking back from just off it, she has not yet gone on from it. */
          if ((r.stage === 'mill' && Math.hypot(rec.x - p.x, rec.z - p.z) < 3) || (r.lookingBack >= 0 && r.lookingBack < tuning.drowned.run.lookBackFor)) rec.left = t;
          const behind = (rec.x - front.x) * dx + (rec.z - front.y) * dz < -2;
          if (behind && dark.level > rec.ridge) rec.under = t;
        }
        w.boatMoved = Math.max(w.boatMoved, Math.hypot(__game.boat.position.x - strand.x, __game.boat.position.z - strand.z));
        /** Waiting on the cat at the sheet and the mill: from her coming to it until it is clear for her. */
        for (const piece of ['sheet', 'mill']) {
          const x = r[piece];
          if (r.stage === piece && x.phase === 'waiting' && !x.clear) w.waits[piece] = (w.waits[piece] ?? 0) + 1 / 60;
        }
        /** Never toward the lens: on her own way she never faces it, and she is always in the frame. */
        const lens = cam.position, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
        const tx = lens.x - p.x, tz = lens.z - p.z, tl = Math.hypot(tx, tz) || 1;
        const toward = (fx * tx + fz * tz) / tl > 0.5 && r.stage === 'walk' && c.moving;
        w.facingRun = toward ? w.facingRun + 1 / 60 : 0;
        if (toward) w.facing += 1 / 60;
        if (w.facingRun > w.facingWorst) {
          w.facingWorst = w.facingRun;
          w.facingAt = `at ${r.along.toFixed(1)} m, ${p.toArray().map((v) => v.toFixed(2))}, the lens at ${lens.toArray().map((v) => v.toFixed(1))}`;
        }
        const head = p.clone().setY(p.y + 1.2).project(cam);
        const out = Math.abs(head.x) > 0.95 || Math.abs(head.y) > 0.95 || head.z > 1;
        w.unseenRun = out ? w.unseenRun + 1 / 60 : 0;
        if (out) w.unseen += 1 / 60;
        if (w.unseenRun > w.unseenWorst) { w.unseenWorst = w.unseenRun; w.unseenAt = `${r.stage} at ${r.along.toFixed(1)} m, until ${t.toFixed(1)} s`; }
        /** Under a roof's slates, or a roof between the lens and her: a march along the line of sight. */
        const under = (x, z) => [...W.PLACED, W.NAVE].reduce((top, h) => Math.max(top, W.roofUnder(h, x, z) ?? -Infinity), -Infinity);
        if (lens.y < under(lens.x, lens.z) + 0.2) {
          w.inside += 1 / 60;
          w.insideAt = `${r.stage} at ${r.along.toFixed(1)} m, the lens at ${lens.toArray().map((v) => v.toFixed(1))}`;
        }
        let hidden = false;
        for (let i = 1; i < 24 && !hidden; i++) {
          const u = i / 24, x = lens.x + (p.x - lens.x) * u, z = lens.z + (p.z - lens.z) * u, y = lens.y + (p.y + 1.4 - lens.y) * u;
          if (Math.hypot(x - p.x, z - p.z) > 0.8 && y < under(x, z) - 0.05) hidden = true;
        }
        w.hiddenRun = hidden && !flying ? (w.hiddenRun ?? 0) + 1 / 60 : 0;
        if (w.hiddenRun > (w.hiddenWorst ?? 0)) { w.hiddenWorst = w.hiddenRun; w.hiddenAt = `${r.stage} at ${r.along.toFixed(1)} m`; }
        if (r.stage === 'walk' && !c.action && r.lookingBack !== undefined) {
          if (r.along > w.last + 0.05) { w.last = r.along; w.since = 0; } else w.since += 1 / 60;
          const k = tuning.drowned.run;
          const looking = (r.lookingBack >= 0 && r.lookingBack < k.lookBackFor) || (r.lookingDown >= 0 && r.lookingDown < k.lookDownFor)
            || (r.lookingSwing >= 0 && r.lookingSwing < k.lookSwingFor);
          if (!looking && w.since > w.stallWorst) { w.stallWorst = w.since; w.stallAt = `at ${r.along.toFixed(1)} m, ${p.toArray().map((v) => v.toFixed(2))}`; }
          if (looking) w.since = 0;
        } else w.since = 0;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const shotsBetween = [];
    const snapBetween = async (name, at) => {
      shotsBetween.push({ name, at });
    };
    await snapBetween('between-1', 0.18);
    await snapBetween('between-2', 0.55);
    await snapBetween('between-3', 0.78);
    const runLength = await page.evaluate(() => __game.story.current.run.length);
    /**
     * Her own way so far: the fog in each walk's frame, the cat readable in it (in frame, clear of the roofs, at least
     * 40 px across its box at a 900 px short side), her facing the lens, out of frame or hidden; the lens's measures
     * fail only with LENS=1.
     */
    const walksReport = async () => {
      const w = await page.evaluate(() => ({ ...window.__runWatch }));
      const median = (v) => { const o = [...v].sort((a, b) => a - b); return o.length ? o[Math.floor(o.length / 2)] : 0; };
      console.log(`her feet stayed within ${w.offWorst.toFixed(3)} m of the decks (worst ${w.offAt}); longest stall on her own way ${w.stallWorst.toFixed(1)} s`);
      console.log(`on her own way the fog was out of the frame for at most ${w.fogGoneWorst.toFixed(1)} s at a time (${w.fogGoneAt})`);
      console.log(`  on each walk at most ${Object.entries(w.fogByWalk).map(([k, v]) => `${v.toFixed(1)} s on ${k}`).join(', ')}`);
      console.log(`the cat unreadable (out of frame, behind a roof or under 40 px) for at most ${Object.entries(w.catByWalk).map(([k, v]) => `${v.toFixed(1)} s on ${k}`).join(', ')}`);
      console.log(`  its size in px (0 out of frame or hidden), least and median: ${Object.entries(w.catPxByWalk).map(([k, v]) => `${k} ${Math.min(...v)}/${median(v)}`).join(', ')}`);
      console.log(`she faced the lens on her way for ${w.facing.toFixed(1)} s in all (longest ${w.facingWorst.toFixed(1)} s ${w.facingAt}); out of frame ${w.unseen.toFixed(1)} s (longest ${w.unseenWorst.toFixed(1)} s ${w.unseenAt}); lens inside a roof ${w.inside.toFixed(1)} s ${w.insideAt}`);
      console.log(`a roof hid her for at most ${(w.hiddenWorst ?? 0).toFixed(1)} s at a time (${w.hiddenAt ?? ''})`);
      const catWorst = Math.max(0, ...Object.values(w.catByWalk));
      const lens = [[(w.hiddenWorst ?? 0) < 1, `a roof hid her for ${(w.hiddenWorst ?? 0).toFixed(1)} s (${w.hiddenAt})`],
        [w.facingWorst < 1, `she walked toward the lens for ${w.facingWorst.toFixed(1)} s (${w.facingAt})`],
        [w.unseenWorst < 0.5, `she was out of the frame for ${w.unseenWorst.toFixed(1)} s (${w.unseenAt})`],
        [w.inside < 0.2, `the lens was inside a roof for ${w.inside.toFixed(1)} s (${w.insideAt})`],
        [catWorst < 2, `the cat was unreadable on a walk for ${catWorst.toFixed(1)} s`]];
      for (const [ok, what] of lens) {
        if (process.env.LENS) assert(ok, what);
        else if (!ok) console.log(`  lens: ${what}`);
      }
      assert(w.offWorst < 0.4, `she left the decks: ${w.offWorst.toFixed(2)} m (${w.offAt})`);
      assert(w.stallWorst < 3, `she stalled on her own way for ${w.stallWorst.toFixed(1)} s (${w.stallAt})`);
      assert(w.fogAhead > 4, `the fog reached her: ${w.fogAhead.toFixed(1)} m ahead of its front (${w.fogAt})`);
      assert(w.fogGoneWorst < 2, `the fog was out of a walk's frame for ${w.fogGoneWorst.toFixed(1)} s (${w.fogGoneAt})`);
      return w;
    };
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

    // The tree. She stops clear of it at the wall's end, looking across to the barn and up at it now and then; the
    // drawn gust across its crown comes within seconds, the frame holding her, its crown and the barn. A try the wrong
    // way rocks it back and the gust comes again; then strokes the way it falls, back and forth without a pause as an
    // eager player makes them, bring it down within a few, and she walks up it.
    await walkTo('tree', 60);
    await page.evaluate(() => {
      const r = __game.story.current.run, c = __game.child, cam = __game.rig.camera, from = __stats.time;
      const root = r.tree.tree.spot.root, over = r.tree.tree.spot.over, fall = r.tree.tree.fall;
      const w = window.__treeWatch = { root: Math.hypot(c.position.x - root.x, c.position.z - root.z), quiet: true, looks: 0, up: 0,
        across: 0, invited: null, lens: [] };
      const tick = () => {
        if (r.tree.phase !== 'waiting') return;
        const t = __stats.time - from, p = c.position;
        w.lens.push([t, Math.hypot(cam.position.x - p.x, cam.position.z - p.z)]);
        /**
         * Where she looks before the player does anything: steeply up at the tree, or out across the lane, where it will
         * take her and the cat goes (or at the cygnet on her back, which is neither).
         */
        if (c.lookAt && w.quiet) {
          w.looks++;
          const l = c.lookAt, steep = Math.atan2(l.y - p.y - 1.2, Math.hypot(l.x - p.x, l.z - p.z)) > 0.6;
          if (steep && Math.hypot(l.x - root.x, l.z - root.z) < 3) w.up++;
          else if (!steep && (l.x - over.x) * fall.x + (l.z - over.z) * fall.y > 0.5) w.across++;
        }
        if (w.invited === null && r.tree.invitation && __game.emberInvitation.alpha > 0.5) w.invited = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await seconds(6);
    await shot('tree');
    /** Once the lens has come round: how far out toward the frame's edge (1) her head, the top of the crown and the barn's ridge stand. */
    const framed = await page.evaluate(() => {
      const r = __game.story.current.run, cam = __game.rig.camera, p = __game.child.position;
      window.__treeWatch.quiet = false;
      const edge = (q) => { q.project(cam); return q.z > 1 ? 9 : Math.max(Math.abs(q.x), Math.abs(q.y)); };
      return { her: edge(p.clone().setY(p.y + 1.2)), crown: edge(r.tree.tree.trunkAt(0.95, p.clone())), barn: edge(r.tree.tree.spot.rest.clone()) };
    });
    /** Across the trunk where it is on the screen, as high up it into the crown as is in the frame. */
    const crown = () => page.evaluate(() => {
      const r = __game.story.current.run, cam = __game.rig.camera;
      let p = null;
      for (const share of [0.72, 0.6, 0.5, 0.4, 0.3, 0.2]) {
        p = r.tree.tree.trunkAt(share, cam.position.clone()).project(cam);
        if (Math.abs(p.y) < 0.7 && Math.abs(p.x) < 0.8) break;
      }
      return { at: [(p.x + 1) / 2, (1 - p.y) / 2], heading: r.tree.tree.fallHeading(cam) };
    });
    const lean = () => page.evaluate(() => __game.story.current.run.tree.tree.lean);
    const invited = () => page.evaluate(() => !!__game.story.current.run.tree.invitation && __game.emberInvitation.alpha > 0.5);
    const upright = await lean();
    let aim = await crown();
    await stroke(aim.at, aim.heading + Math.PI, 0.5, 8);
    let rocked = upright;
    for (let t = 0; t < 1.5; t += 0.25) { await seconds(0.25); rocked = Math.min(rocked, await lean()); }
    let again = null;
    for (let t = 1.5; t < 6 && again === null; t += 0.25) { if (await invited()) again = t; else await seconds(0.25); }
    await shot('tree-again');
    /** The pointer straight on from where it is to `to` over `frames` frames, making wind all the way. */
    const sweepTo = async (to, frames) => {
      const from = pointer;
      for (let i = 1; i <= frames; i++) {
        pointer = [from[0] + (to[0] - from[0]) * i / frames, from[1] + (to[1] - from[1]) * i / frames];
        await page.mouse.move(pointer[0] * width, pointer[1] * height);
        await frame();
      }
      await reel();
    };
    aim = await crown();
    const ax = (Math.cos(aim.heading) * 0.25 * height) / width, ay = -Math.sin(aim.heading) * 0.25;
    await drift([aim.at[0] - ax, aim.at[1] - ay]);
    let pushes = 0;
    for (; pushes < 12 && (await state()).fallen === 'standing'; pushes++) {
      await sweepTo([aim.at[0] + ax, aim.at[1] + ay], 5);
      await sweepTo([aim.at[0] - ax, aim.at[1] - ay], 8);
    }
    const tw = await page.evaluate(() => window.__treeWatch);
    const lensFrom = tw.lens[0]?.[1] ?? 0, lensTo = tw.lens.at(-1)?.[1] ?? 0, near = Math.min(...tw.lens.map((l) => l[1])), far = Math.max(...tw.lens.map((l) => l[1]));
    const inAndOut = Math.max(Math.min(lensFrom - near, lensTo - near), Math.min(far - lensFrom, far - lensTo));
    console.log(`the tree: she waited ${tw.root.toFixed(1)} m from its foot; before any stroke she looked steeply up ${(100 * tw.up / tw.looks).toFixed(0)}% of the time and across the lane ${(100 * tw.across / tw.looks).toFixed(0)}%;`
      + ` the drawn gust ${tw.invited === null ? 'never came' : `came ${tw.invited.toFixed(1)} s after she stopped`}; ${Object.entries(framed).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')} out to the frame's edge;`
      + ` a wrong-way try rocked it back ${(upright - rocked).toFixed(3)} rad and the gust came again ${again === null ? 'never' : `${again.toFixed(1)} s after`};`
      + ` ${(await state()).fallen === 'standing' ? 'it still stood' : 'it went over'} after ${pushes} strokes back and forth; the lens came round from ${lensFrom.toFixed(1)} m off her to ${lensTo.toFixed(1)} m (in and out ${inAndOut.toFixed(2)} m)`);
    assert(tw.root >= 4, `she waited under the tree, ${tw.root.toFixed(1)} m from its foot`);
    assert(tw.up < tw.looks * 0.4, `she looked steeply up at the tree ${(100 * tw.up / tw.looks).toFixed(0)}% of the time she waited`);
    assert(tw.across > tw.looks * 0.4, `she looked across the lane only ${(100 * tw.across / tw.looks).toFixed(0)}% of the time she waited`);
    assert(tw.invited !== null && tw.invited < 3.5, `the drawn gust did not come within 3.5 s of her stopping (${tw.invited})`);
    assert(Object.values(framed).every((v) => v < 0.95), `the tree's view did not hold her, the crown and the barn: ${JSON.stringify(framed)}`);
    assert(upright - rocked > 0.02, `a stroke the wrong way did not rock it back (${(upright - rocked).toFixed(3)} rad)`);
    assert(again !== null, 'the drawn gust did not come again after a wrong-way try');
    assert(pushes <= 10, `${pushes} strokes back and forth the way it falls did not bring it down`);
    assert(inAndOut < 1, `the lens went in and out by ${inAndOut.toFixed(2)} m coming round to the tree's view`);
    await until((s) => s.tree === 'crossing', 30, 'her on the trunk');
    await seconds(1.5);
    await shot('tree-crossing');
    if (toTree) {
      await until((s) => s.tree === 'over', 30, 'her over the tree');
      await seconds(9);
      await shot('tree-over');
      const w = await page.evaluate(() => window.__runWatch);
      console.log(`her feet stayed within ${w.offWorst.toFixed(3)} m of the decks (worst ${w.offAt}); out of the frame at most ${w.unseenWorst.toFixed(1)} s;`
        + ` a roof hid her at most ${(w.hiddenWorst ?? 0).toFixed(1)} s; the lens inside a roof ${w.inside.toFixed(1)} s`);
      assert(w.offWorst < 0.4, `she left the decks: ${w.offWorst.toFixed(2)} m (${w.offAt})`);
      if (process.env.LENS) {
        assert(w.unseenWorst < 0.5, `she was out of the frame for ${w.unseenWorst.toFixed(1)} s (${w.unseenAt})`);
        assert((w.hiddenWorst ?? 0) < 1, `a roof hid her for ${(w.hiddenWorst ?? 0).toFixed(1)} s (${w.hiddenAt})`);
        assert(w.inside < 0.2, `the lens was inside a roof for ${w.inside.toFixed(1)} s (${w.insideAt})`);
      }
      break run;
    }

    // The sheet: firm strokes up the line across it, until she has been carried over and set down.
    await walkTo('sheet', 60);
    await shot('sheet');
    let fills = 0;
    for (; fills < 40 && ['waiting', 'taking', 'carried'].includes((await state()).sheet); fills++) {
      const aim = await page.evaluate(() => {
        const r = __game.story.current.run, cam = __game.rig.camera;
        const p = r.sheet.sheet.middle(cam.position.clone()).project(cam);
        return { at: [(p.x + 1) / 2, (1 - p.y) / 2], heading: r.sheet.sheet.heading(cam) };
      });
      await stroke(aim.at, aim.heading, 0.6, 14);
      await seconds(0.5);
      if (fills === 6) await shot('sheet-carried');
    }
    console.log(`she was carried over the sheet's lane after ${fills} strokes`);

    // The mill: broad circles round its hub on screen, the way the sails turn, until she is off on the granary.
    await walkTo('mill', 120);
    await seconds(1.0);
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
    console.log(`she was wound up the mill after ${(circled / 2).toFixed(1)} turns of circling`);

    // The swing: strokes across the seat the way it swings out, until she lets go.
    await walkTo('swing', 120);
    await until((s) => s.swing === 'riding', 10, 'her getting on the swing');
    if (toSwing) {
      await seconds(2);
      await shot('swing-start');
      await walksReport();
      break run;
    }
    let pumps = 0, swung = false;
    for (; pumps < 40 && (await state()).swing === 'riding'; pumps++) {
      /**
       * As a player pumps: each stroke as the seat starts out toward the far side again, once it has swung back from
       * the last (or at once, while it hangs nearly still).
       */
      const seat = () => page.evaluate(() => { const s = __game.story.current.run.swing.swing; return { v: s.speed, a: s.angle }; });
      for (let i = 0; i < 60 && pumps > 0 && (await seat()).v > 0.02; i++) await seconds(0.05);
      for (let i = 0; i < 60 && (await seat()).v <= 0.02 && Math.abs((await seat()).v) + Math.abs((await seat()).a) > 0.05; i++) await seconds(0.05);
      const aim = await page.evaluate(() => {
        const r = __game.story.current.run, cam = __game.rig.camera, s = r.swing.swing;
        const at = s.seat(cam.position.clone());
        const a = at.clone().project(cam), b = at.clone().set(at.x + s.toward.x * 2, at.y, at.z + s.toward.y * 2).project(cam);
        return { at: [(a.x + 1) / 2, (1 - a.y) / 2], heading: Math.atan2(b.y - a.y, (b.x - a.x) * cam.aspect) };
      });
      await stroke(aim.at, aim.heading, 0.5, 12);
      await seconds(0.3);
      if (!swung && pumps === 4) { swung = true; await shot('swing'); }
    }
    console.log(`she let go of the swing after ${pumps} pumping strokes`);

    await until((s) => s.beat === 'nave', 60, 'her reaching the tower\'s foot');
    /** Where the run leaves the cat for the church: on the railings below the tower's south face. */
    const towerSouth = await page.evaluate(() => { const c = window.__game.cat.position; return Math.hypot(c.x - 16.5, c.z - (-1561 + 2.6)); });
    await seconds(3);
    await shot('nave');
    const end = await state();
    const report = await page.evaluate(() => {
      const st = __game.story.current, r = st.run, w = window.__runWatch;
      return { stretches: r.stretches, time: r.time, length: r.length, watch: { ...w } };
    });
    const w = await walksReport();
    console.log(`run: ${report.length.toFixed(0)} m of way in ${report.time.toFixed(1)} s (game time from setting off to the tower's foot)`);
    for (const s of report.stretches) console.log(`  ${s.name}: ${s.seconds} s`);
    const walks = report.stretches.filter((s) => s.name.startsWith('her way') || s.name === 'the nave');
    const onFoot = walks.reduce((a, s) => a + s.seconds, 0);
    console.log(`  on foot ${onFoot.toFixed(1)} s (longest walk ${Math.max(...walks.map((s) => s.seconds)).toFixed(1)} s), at the pieces ${(report.time - onFoot).toFixed(1)} s`);
    console.log(`  she waited on the cat ${Object.entries(w.waits).map(([k, v]) => `${v.toFixed(1)} s at the ${k}`).join(', ') || 'never'}`);
    console.log(`the fog's front came within ${w.fogAhead.toFixed(1)} m of her across its line, ${w.fogNear.toFixed(1)} m as the crow flies (${w.fogAt}); its level ${end.level} m at the end, its front ${end.front} m`);
    const names = await page.evaluate(() => import('/src/world/drowned-way.ts').then((W) => W.PLACED.map((h) => `${h.x.toFixed(0)},${h.z.toFixed(0)}`)));
    const roofs = Object.values(w.roofs);
    for (const r of roofs) console.log(`  the roof at ${names[r.name]} (ridge ${r.ridge.toFixed(1)} m) ${r.under === null ? 'not under yet' : `under ${(r.under - r.left).toFixed(1)} s after she went on from it`}`);
    console.log(`the boat moved ${w.boatMoved.toFixed(2)} m from where it ran aground`);
    console.log(`at the end: cat at ${end.cat.join(', ')}, her at ${end.child.join(', ')}`);
    /** Each roof she went on from is taken within 14 s, but for the one the fog waits short of at the tower's foot. */
    const waits = (r) => r.under === null && Math.hypot(r.x - end.child[0], r.z - end.child[2]) < 22;
    const late = roofs.filter((r) => !waits(r) && (r.under ?? end.time) - r.left > 14);
    assert(!late.length, `a roof she left was not taken by the fog in time: ${late.map((r) => names[r.name]).join('; ')}`);
    assert(w.boatMoved < 1.5, `the boat moved ${w.boatMoved.toFixed(2)} m from where it ran aground`);
    assert(towerSouth < 1.5, `the cat is not at the tower's south face (${towerSouth.toFixed(2)} m off)`);
  }
  if (!toNave) {
    await church();
    for (let t = 0; t < 30 && (await page.evaluate(() => __game.story.name)) !== 'wood'; t += 0.25) await seconds(0.25);
    assert.equal(await page.evaluate(() => __game.story.name), 'wood', 'the landing never handed on to the dark wood');
    await seconds(3);
    await shot('wood');
    console.log(`on into the dark wood at ${(await page.evaluate(() => __stats.time)).toFixed(1)} s`);
  }
  const motion = await page.evaluate(() => window.__lensWatch);
  console.log(`the lens turned at most ${motion.turn.toFixed(1)} deg/s (${motion.turnAt}) and moved at most ${motion.move.toFixed(1)} m/s (${motion.moveAt})`);
  console.log(`  its fastest turn in each stretch: ${Object.entries(motion.stretches).map(([k, v]) => `${k} ${v.turn.toFixed(1)} (${v.at.toFixed(1)} s)`).join('; ')}`);
  console.log(`  cuts in play: ${motion.cuts.length ? motion.cuts.join('; ') : 'none'}`);
  if (process.env.LENS) {
    assert(motion.turn < 30, `the lens whipped round at ${motion.turn.toFixed(0)} deg/s (${motion.turnAt})`);
    assert(!motion.cuts.length, `the lens cut in play: ${motion.cuts.join('; ')}`);
  }
  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
  console.log('drowned run check passed');
} finally {
  if (process.env.TRACE && page) {
    const motion = await page.evaluate(() => window.__lensWatch).catch(() => null);
    if (motion) {
      (await import('node:fs')).writeFileSync(process.env.TRACE, JSON.stringify({ ...motion, recordedFrom }));
      console.log(`the lens traced every quarter second: ${process.env.TRACE}`);
    }
  }
  const recorded = video ? context.pages()[0]?.video() : null;
  await context.close();
  if (recorded) console.log(`video: ${await recorded.path()}`);
  await browser.close();
}

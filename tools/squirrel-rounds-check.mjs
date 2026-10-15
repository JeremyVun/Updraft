// The birches' squirrel hide-and-seek with real pointer strokes: each round found on the right heap once the wind has
// uncovered it, by a stroke and by an updraft, wrong heaps first, a child's random swipes, a stalled player through the
// hint and the drawn updraft, heaps held against strokes until it is in (and the drift and trunk fallbacks), the leap
// into a deep drift and through a bare hollow, resumed saves at every new checkpoint and from names saved before the
// game, and stills of each round's frame with the squirrel's height on screen and how much of it shows buried tail in.
// Usage: BASE=http://127.0.0.1:5244/ node tools/squirrel-rounds-check.mjs [right updraft wrong random stall flat leap bare resume frames]
// W/H set the viewport (default 1600x900; frames also takes 390x844 portrait); OUT prefixes the stills; SCALE sets
// the squirrel's size at runtime.
// Cases run in one browser in the order given; split them across calls to stay under a tool's time limit.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = Number(process.env.W ?? 1600), H = Number(process.env.H ?? 900);
const out = process.env.OUT ?? '/tmp/updraft-squirrel-rounds';
const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['right', 'updraft', 'wrong', 'random', 'stall', 'flat', 'leap', 'bare', 'resume', 'frames'];
const { browser, close } = await openBrowser();
const errors = [];
const results = {};
let page;

async function load(query = '') {
  page?.close();
  page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.goto(`${base}?shot=1&chapter=birches${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  await page.evaluate(async () => {
    const [rounds, world, points, scarf, island] = await Promise.all([import('/src/story/birches-rounds.ts'), import('/src/world/birches.ts'),
      import('/src/story/checkpoint-data.ts'), import('/src/world/birch-scarf.ts'), import('/src/world/island.ts')]);
    window.__sq = { ...rounds, ...world, ...points, SCARF_SNAGS: scarf.SCARF_SNAGS, heightAt: island.heightAt };
    window.__inviteRadius = (await import('/src/tuning.ts')).tuning.birches.squirrel.inviteRadius;
    window.__screen = (p) => { const v = p.clone().project(__game.rig.camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; };
  });
  if (process.env.SCALE) await page.evaluate((scale) => { __game.squirrel.scale = scale; }, Number(process.env.SCALE));
  await page.waitForTimeout(3000);
}

const state = () => page.evaluate(() => {
  const g = __game, c = g.story.current, q = c.squirrel, h = q?.hideout;
  return { beat: c.beat, round: c.round, rounds: q?.rounds, mode: q?.mode, station: q?.station, action: g.squirrel.action,
    hide: h && { heap: h.heap, trunk: h.trunk, screen: window.__screen(h.at.clone().setY(Math.max(0, __sq.heightAt(h.at.x, h.at.z)) + 0.05)) }, tangles: g.birches.scarf.completed,
    child: g.child.action?.kind ?? null, sitting: g.child.sitting, chapter: g.story.name };
});
const __heaps = (round) => [1, 2, 3][round];
const until = (fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });

/** Puts her just short of round `round`'s heaps with everything before it done, and waits for her to kneel there. */
async function jump(round, patch = null) {
  await page.evaluate(({ round, patch }) => {
    const g = __game, c = g.story.current, r = __sq.ROUNDS[round];
    if (patch === 'trunk') g.birches.depthAt = async (points) => points.map(() => 0);
    /** Drifts but no heaps where it chooses; under it, the drift it chose (the few points felt over its back). */
    if (patch === 'drift') g.birches.depthAt = async (points) => points.map((_, i) => (i < r.hides.length && points.length > 5 ? 0 : 0.7));
    /** Off the ride beside her stand, clear of every heap, so she walks in without wading through one. */
    g.child.stop(); g.child.place(r.stand.x + [-2, 2, 2][round], r.stand.z + 1, Math.PI); g.glider.hold(g.child);
    if (!g.cygnet.carried) g.cygnet.rideIn('satchel');
    c.restoreCheckpoint(__sq.birchesPoint(round, round, round === 2), [[0, 2, 4][round], round === 2 ? 1 : 0, 0.62, round, round]);
    c.update(0, c.now);
    g.rig.cut(c.shot);
  }, { round, patch });
  await until(() => __game.story.current.beat === 'round' && __game.story.current.squirrel.hideout, null, 30000);
  await page.evaluate(() => __game.rig.cut(__game.story.current.shot));
  await page.waitForTimeout(800);
}

/** Forces the hide into heap `heap` of the round being played, so a case can choose which heaps are wrong. */
const hideIn = (heap) => page.evaluate(async (heap) => {
  const g = __game, c = g.story.current, r = __sq.ROUNDS[c.round], at = r.hides[heap].clone();
  const [depth] = await g.birches.depthAt([at]);
  c.squirrel.hide({ round: c.round, heap, at, sink: depth - g.birches.buryDepth(at.x, at.z, depth), reach: __sq.BIRCH_PILES[r.heaps[heap]].r, trunk: null }, true);
}, heap);

/** A stroke on screen across heap `heap` of the round, `span` times its width on screen, through `off` of it to the side. */
const acrossHeap = (heap, span = 1.4, off = 0) => page.evaluate(({ heap, span, off }) => {
  const c = __game.story.current, r = __sq.ROUNDS[c.round], p = __sq.BIRCH_PILES[r.heaps[heap]], y = r.hides[heap].y + 0.3;
  const at = (x, z) => window.__screen(r.hides[heap].clone().set(x, y, z));
  const mid = at(p.x, p.z), a = at(p.x - p.r, p.z), b = at(p.x + p.r, p.z), d = at(p.x, p.z - p.r), e = at(p.x, p.z + p.r);
  const half = Math.max(Math.abs(b[0] - a[0]), Math.abs(e[0] - d[0])) / 2;
  return [[mid[0] - half * span + off * half, mid[1]], [mid[0] + half * span + off * half, mid[1]]];
}, { heap, span, off });

/** A stroke through the screen points, lifted first so getting to its start is not a gust (as a finger comes down). */
async function stroke([a, b], ms = 380, lift = true) {
  const steps = Math.max(8, Math.round(ms / 16));
  if (lift) await page.evaluate(() => { __game.input.present = false; });
  await page.mouse.move(a[0] * W, a[1] * H);
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move((a[0] + (b[0] - a[0]) * i / steps) * W, (a[1] + (b[1] - a[1]) * i / steps) * H);
    await page.waitForTimeout(ms / steps);
  }
}

/** Where heap `heap` of the round is on screen. */
const heapOnScreen = (heap) => page.evaluate((heap) => {
  const c = __game.story.current, r = __sq.ROUNDS[c.round], p = __sq.BIRCH_PILES[r.heaps[heap]];
  return window.__screen(r.hides[heap].clone().set(p.x, r.hides[heap].y + 0.3, p.z));
}, heap);

/** The ground circle `size` times the radius of heap `heap` of the round, on screen. */
const heapLoop = (heap, size) => page.evaluate(({ heap, size }) => {
  const c = __game.story.current, r = __sq.ROUNDS[c.round], p = __sq.BIRCH_PILES[r.heaps[heap]], y = r.hides[heap].y + 0.3;
  size ??= window.__inviteRadius;
  return Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return window.__screen(r.hides[heap].clone().set(p.x + Math.cos(a) * p.r * size, y, p.z + Math.sin(a) * p.r * size));
  });
}, { heap, size });

/** Real circles round heap `heap`, `size` times its radius on the ground as the drawn updraft shows, until it is found or `loops` are drawn. */
async function circleOver(heap, round, loops = 6, size = null) {
  const ring = await heapLoop(heap, size);
  await page.evaluate(() => { __game.input.present = false; });
  let drawn = 0;
  await page.mouse.move(ring[0][0] * W, ring[0][1] * H);
  for (; drawn < loops; drawn++) {
    for (let i = 1; i <= 24; i++) {
      const [x, y] = ring[i % 24];
      await page.mouse.move(x * W, y * H);
      await page.waitForTimeout(28);
    }
    if (await found(round, 20)) return drawn + 1;
  }
  return (await found(round, 1500)) ? drawn : null;
}

/** Flushed out of its hide in this round (it is counted found once it has scolded her and set off). */
const found = async (round, ms = 1500) => {
  try {
    await until((round) => { const q = __game.story.current.squirrel; return q.rounds > round || (q.mode === 'flushed' && __game.story.current.round === round); }, round, ms);
    return true;
  } catch { return false; }
};

/** Found: the walk goes on (or the leap begins), and the squirrel is off along its way. */
async function afterFind(round) {
  const s = await state();
  await until((round) => ['walk', 'leap'].includes(__game.story.current.beat), round, 20000);
  return s;
}

const cased = {
  async right() {
    await load();
    const rows = [];
    for (const round of [0, 1, 2]) {
      if (round === 0) await until(() => __game.story.current.beat === 'round' && __game.story.current.squirrel.hideout, null, 90000);
      else await jump(round);
      const { hide } = await state();
      const line = hide.heap >= 0 ? await acrossHeap(hide.heap) : [[hide.screen[0] - 0.12, hide.screen[1]], [hide.screen[0] + 0.12, hide.screen[1]]];
      const began = await page.evaluate(() => __game.story.current.now);
      let strokes = 0;
      while (strokes < 3 && !(await found(round, 50))) {
        await stroke(strokes % 2 ? [line[1], line[0]] : line);
        strokes++;
        await found(round, 1500);
      }
      assert.ok(await found(round), `round ${round + 1}: three strokes across the right heap did not uncover it`);
      const at = await page.evaluate(() => __game.story.current.now);
      await page.screenshot({ path: `${out}-right-${round + 1}.png` });
      await afterFind(round);
      rows.push({ round: round + 1, heap: hide.heap, strokes, foundAfter: +(at - began).toFixed(2), next: (await state()).beat });
    }
    return rows;
  },

  /**
   * Circles over the right heap uncover it in about two loops; in round 3, two loops over the far wrong heap first do
   * not. A column is wider than the gap between neighbouring heaps, so circles over the heap next to it can uncover it.
   */
  async updraft() {
    await load();
    const rows = [];
    for (const round of [0, 1, 2]) {
      if (round === 0) await until(() => __game.story.current.beat === 'round' && __game.story.current.squirrel.hideout, null, 90000);
      else await jump(round);
      if (round > 0) await hideIn(0);
      const { hide } = await state();
      const wrongs = [];
      if (round === 2) for (const heap of [2]) {
        const loops = await circleOver(heap, round, 2);
        wrongs.push({ heap, found: loops !== null });
        await page.waitForTimeout(1500);
      }
      assert.ok(wrongs.every((w) => !w.found), `round ${round + 1}: an updraft over a wrong heap found it: ${JSON.stringify(wrongs)}`);
      const lift = await page.evaluate(() => { const h = __game.story.current.squirrel.hideout; return h ? +__game.wind.sample(h.at.x, h.at.z, { x: 0, z: 0, energy: 0, lift: 0 }).lift.toFixed(2) : null; });
      const loops = await circleOver(hide.heap, round);
      assert.ok(loops !== null && loops <= 4, `round ${round + 1}: circling the right heap took ${loops} loops`);
      await page.screenshot({ path: `${out}-updraft-${round + 1}.png` });
      rows.push({ round: round + 1, heap: hide.heap, loops, wrongs, liftBefore: lift });
      await afterFind(round);
    }
    return rows;
  },

  /** Each arrangement on a fresh floor: a wrong heap blown in one is a thin one to hide in for the next. */
  async wrong() {
    const rows = [];
    for (const round of [1, 2]) {
      const heaps = round === 1 ? 2 : 3;
      for (let right = 0; right < heaps; right++) {
        await load();
        await jump(round);
        await hideIn(right);
        const wrongs = [];
        for (let heap = 0; heap < heaps; heap++) {
          if (heap === right) continue;
          /** Away from the right heap, as a player aiming at this one does: a stroke's air carries on metres past its end. */
          const [a, b] = await acrossHeap(heap), [rx] = await heapOnScreen(right);
          await stroke(rx > a[0] ? [b, a] : [a, b]);
          await page.waitForTimeout(1500);
          wrongs.push({ heap, found: await found(round, 50) });
        }
        assert.ok(wrongs.every((w) => !w.found), `round ${round + 1}: a wrong heap found it: ${JSON.stringify(wrongs)}`);
        let strokes = 0;
        if (!wrongs.some((w) => w.found)) {
          while (strokes < 3 && !(await found(round, 50))) {
            await stroke(await acrossHeap(right));
            strokes++;
            await found(round, 2000);
          }
          assert.ok(await found(round), `round ${round + 1}: three strokes across the right heap after the wrong ones did not uncover it`);
        }
        rows.push({ round: round + 1, right, wrongs, strokes });
        await afterFind(round);
      }
    }
    return rows;
  },

  async random() {
    await load();
    const rows = [];
    let seed = Number(process.env.SEED ?? 7);
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const round of [0, 1, 2]) {
      if (round === 0) await until(() => __game.story.current.beat === 'round', null, 90000);
      else await jump(round);
      let strokes = 0;
      let at = [0.05 + rand() * 0.9, 0.3 + rand() * 0.6];
      await page.evaluate(() => { __game.input.present = false; });
      await page.mouse.move(at[0] * W, at[1] * H);
      while (!(await found(round, 50)) && strokes < 40) {
        const angle = rand() * Math.PI * 2, length = 0.08 + rand() * 0.35;
        const to = [Math.min(0.97, Math.max(0.03, at[0] + Math.cos(angle) * length * H / W)), Math.min(0.95, Math.max(0.25, at[1] + Math.sin(angle) * length))];
        await stroke([at, to], 150 + rand() * 450, false);
        at = to;
        strokes++;
        await page.waitForTimeout(rand() * 700);
      }
      assert.ok(await found(round, 3000), `round ${round + 1}: forty random swipes never found it`);
      rows.push({ round: round + 1, strokes });
      await afterFind(round);
    }
    return rows;
  },

  async stall() {
    await load();
    await jump(1);
    await hideIn(0);
    await page.evaluate(() => { __game.input.present = false; });
    await page.mouse.move(W - 2, 2);
    const began = await page.evaluate(() => __game.story.current.now);
    const timeline = { hint: null, invitation: null };
    for (let i = 0; i < 60; i++) {
      const s = await page.evaluate(() => {
        const g = __game, c = g.story.current, q = c.squirrel, h = q.hideout, r = __sq.ROUNDS[c.round], p = __sq.BIRCH_PILES[r.heaps[h.heap]];
        return { t: c.now, bird: Math.hypot(g.cygnet.position.x - p.x, g.cygnet.position.z - p.z), r: p.r, stay: g.cygnet.stay,
          invitation: !!c.coax && g.swirl.glow > 0.2, rounds: q.rounds };
      });
      const t = s.t - began;
      if (timeline.hint === null && s.stay && s.bird < s.r + 1.2) { timeline.hint = +t.toFixed(1); await page.screenshot({ path: `${out}-stall-hint.png` }); }
      if (timeline.invitation === null && s.invitation) { timeline.invitation = +t.toFixed(1); await page.screenshot({ path: `${out}-stall-invitation.png` }); }
      assert.ok(s.rounds === 1 && !(await found(1, 20)), 'the stalled round solved itself');
      if (t > 30) break;
      await page.waitForTimeout(500);
    }
    assert.ok(timeline.hint !== null && timeline.hint >= 9.5 && timeline.hint < 16, `the cygnet's hint: ${timeline.hint}`);
    assert.ok(timeline.invitation !== null && timeline.invitation >= 17.5 && timeline.invitation < 21, `the drawn updraft: ${timeline.invitation}`);
    const loops = await circleOver(0, 1);
    assert.ok(loops !== null, 'an updraft after the invitation did not find it');
    return { ...timeline, loops };
  },

  /**
   * Every heap of the round blown at hard before the squirrel gets there: real strokes over each heap while she waits
   * short of them. The heaps hold until it is in, so it still hides in one. Its fallbacks for heaps blown away after
   * it is in are forced, with a floor that reads drifts but no heaps (a drift), and one that reads bare everywhere
   * (a trunk).
   */
  async flat() {
    const rows = [];
    for (const kind of ['blown', 'drift', 'trunk']) {
      await load();
      for (const round of [1, 2]) {
        let before = null, after = null;
        if (kind === 'blown') {
          await page.evaluate((round) => {
            const g = __game, c = g.story.current, r = __sq.ROUNDS[round];
            c.updateWalk = () => {};
            c.frame = () => { __sq.frameShot(r.frames, innerWidth / innerHeight, c.shot); };
            c.beat = 'walk'; c.play = 'hold';
            g.child.stop(); g.child.place(r.stand.x, r.stand.z + 6, Math.PI); g.glider.hold(g.child);
            c.update(0, c.now); g.rig.cut(c.shot);
          }, round);
          await page.waitForTimeout(2500);
          const read = () => page.evaluate((round) => __game.birches.depthAt(__sq.ROUNDS[round].hides).then((d) => d.map((v) => +v.toFixed(2))), round);
          before = await read();
          for (let pass = 0; pass < 4; pass++) {
            for (let heap = 0; heap < __heaps(round); heap++) {
              const ends = await page.evaluate(({ round, heap }) => {
                const r = __sq.ROUNDS[round], p = __sq.BIRCH_PILES[r.heaps[heap]], y = r.hides[heap].y + 0.3;
                return [window.__screen(r.hides[heap].clone().set(p.x - p.r * 1.6, y, p.z)), window.__screen(r.hides[heap].clone().set(p.x + p.r * 1.6, y, p.z))];
              }, { round, heap });
              await stroke(pass % 2 ? [ends[1], ends[0]] : ends, 220);
            }
          }
          await page.waitForTimeout(3000);
          after = await read();
          await page.evaluate(() => { const c = __game.story.current; delete c.updateWalk; delete c.frame; });
        }
        await jump(round, kind === 'blown' ? null : kind);
        const s = await state();
        await page.screenshot({ path: `${out}-flat-${kind}-${round + 1}.png` });
        if (kind === 'blown') {
          assert.ok(after.every((d, i) => d >= before[i] * 0.85), `round ${round + 1}: heaps blown before it was in did not hold: ${JSON.stringify({ before, after })}`);
          assert.ok(s.hide.heap >= 0, `round ${round + 1}: the held heaps should still hide it`);
        }
        if (kind === 'trunk') assert.ok(s.hide.trunk, `round ${round + 1}: a bare floor should send it behind a trunk`);
        if (kind === 'drift') assert.ok(s.hide.heap < 0 && !s.hide.trunk, `round ${round + 1}: drifts but no heaps should bury it in a drift`);
        if (kind !== 'blown') assert.ok(s.hide.screen.every((v) => v > 0.05 && v < 0.95), `round ${round + 1}: the ${kind} hide is out of the frame`);
        /** The forced drift is only on the readback; the real floor there is thin, so the stroke finds it uncovered. */
        if (kind === 'drift') await page.evaluate(() => { delete __game.birches.depthAt; });
        let strokes = 0;
        while (!(await found(round, 1500)) && strokes < 4) {
          const [x, y] = (await state()).hide?.screen ?? s.hide.screen;
          await stroke([[x - 0.16, y + 0.02], [x + 0.16, y - 0.02]]);
          strokes++;
        }
        assert.ok(await found(round, 1500), `round ${round + 1}: the ${kind} hide was never found: ${JSON.stringify({ before, after, s, now: await state() })}`);
        rows.push({ kind, round: round + 1, before, after, hid: s.hide.trunk ? 'trunk' : s.hide.heap < 0 ? 'drift' : `heap ${s.hide.heap}`, strokes });
        await afterFind(round);
      }
    }
    return rows;
  },

  async leap() {
    await load();
    await jump(2);
    const { hide } = await state();
    await stroke(await acrossHeap(Math.max(0, hide.heap)));
    assert.ok(await found(2), 'round 3 not found');
    await until(() => __game.story.current.beat === 'leap', null, 10000);
    const began = await page.evaluate(() => __game.story.current.now);
    await until(() => __game.child.action?.kind === 'leap', null, 15000);
    await page.screenshot({ path: `${out}-leap-run.png` });
    await until(() => __game.child.action?.kind === 'leap' && __game.child.sitting, null, 5000);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}-leap-landed.png` });
    await until(() => __game.child.action === null && __game.child.sitting, null, 5000);
    await page.screenshot({ path: `${out}-leap-sitting.png` });
    await until(() => __game.story.current.beat === 'walk', null, 15000);
    const ended = await page.evaluate(() => __game.story.current.now);
    return { leap: +(ended - began).toFixed(1), station: (await state()).station };
  },

  async bare() {
    await load();
    await jump(2);
    const { hide } = await state();
    await stroke(await acrossHeap(Math.max(0, hide.heap)));
    assert.ok(await found(2), 'round 3 not found');
    await page.evaluate(() => { __game.birches.depthAt = async (points) => points.map(() => 0); });
    await until(() => __game.story.current.beat === 'leap', null, 10000);
    const began = await page.evaluate(() => __game.story.current.now);
    await until(() => __game.story.current.squirrel.leap === 'kicking', null, 5000);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}-bare-kicking.png` });
    await until(() => __game.story.current.beat === 'walk', null, 20000);
    return { run: +((await page.evaluate(() => __game.story.current.now)) - began).toFixed(1) };
  },

  async resume() {
    await load();
    const expect = {
      'squirrel1-scarf0': [[0, 0, 0.6, 0, 1], 'tangle1', 'idle'], 'squirrel1-scarf1': [[1, 0, 0.6, 1, 1], 'round2', 'hidden'],
      'squirrel2-scarf1': [[2, 0, 0.6, 1, 2], 'swing', 'idle'], 'squirrel2-scarf1-swing': [[3, 1, 0.6, 1, 2], 'tangle2', 'idle'],
      'squirrel2-scarf2-swing': [[3, 1, 0.6, 2, 2], 'round3', 'hidden'], 'squirrel3-scarf2-swing': [[4, 1, 0.6, 2, 3], 'tangle3', 'idle'],
      'squirrel3-scarf3-swing': [[4, 1, 0.6, 3, 3], 'tangle4', 'idle'], 'squirrel3-scarf4-swing': [[5, 1, 0.7, 4, 3], 'goodbye', 'idle'],
      'scarf4-1': [[1, 0, 0.6, 1], 'round2', 'hidden'], 'scarf4-1-swing': [[3, 1, 0.6, 1], 'tangle2', 'idle'],
      'scarf4-2': [[3, 0, 0.6, 2], 'round3', 'hidden'], 'scarf4-3': [[4, 0, 0.6, 3], 'tangle4', 'idle'],
      'scarf4-4-swing': [[5, 1, 0.7, 4], 'goodbye', 'idle'], 'scarf-2': [[3, 0, 0.6, 2], 'round3', 'hidden'],
      'scarf-3': [[4, 0, 0.6, 3], 'goodbye', 'idle'], swing: [[3, 1, 0.6], 'tangle2', 'idle'], leaves: [[3, 0, 0.6], 'round3', 'hidden'],
    };
    const rows = [];
    for (const [point, [data, station, mode]] of Object.entries(expect)) {
      const s = await page.evaluate(async ({ point, data, mode }) => {
        const g = __game, c = g.story.current;
        c.restoreCheckpoint(point, data);
        for (let t = 0; t < 30 && c.squirrel.mode !== mode; t++) await new Promise((r) => setTimeout(r, 100));
        await new Promise((r) => setTimeout(r, 150));
        const spec = { tangle1: __sq.TANGLE_PERCHES[0], swing: __sq.SWING_PERCH, tangle2: __sq.TANGLE_PERCHES[1], tangle3: __sq.TANGLE_PERCHES[2],
          tangle4: __sq.TANGLE_PERCHES[3], goodbye: __sq.GOODBYE }[c.squirrel.station];
        const want = spec && (spec.action === 'climb' ? __sq.onTrunk(g.birches, spec.trunk).at : spec.at);
        const off = want ? +g.squirrel.position.distanceTo(want).toFixed(2) : null;
        return { rounds: c.squirrel.rounds, station: c.squirrel.station, mode: c.squirrel.mode, visible: g.squirrel.visible, off };
      }, { point, data, mode });
      if (station === 'goodbye') await until(() => ['goodbye'].includes(__game.story.current.squirrel.station), null, 3000).catch(() => {});
      rows.push({ point, ...s });
      assert.equal(s.station, station, `${point} resumes the squirrel at ${s.station}, not ${station}`);
      if (station !== 'goodbye') assert.equal(s.mode, mode, `${point}: ${s.mode}`);
      assert.ok(s.visible, `${point}: squirrel hidden from view`);
      assert.ok(s.off === null || s.off < 0.5, `${point}: ${s.off} m from its place at ${s.station}`);
    }
    /** Two real reloads through the save: one made by this build, one made before it. */
    for (const [point, data, rounds] of [['squirrel2-scarf1-swing', [3, 1, 0.6, 1, 2], 2], ['scarf4-2', [3, 0, 0.6, 2], 2]]) {
      await page.evaluate(async ({ point, data }) => {
        const { saveProgress } = await import('/src/story/progress.ts');
        const g = __game, snag = __sq.SCARF_SNAGS?.[1];
        const at = point === 'scarf4-2' ? { x: snag?.stopX ?? -45, z: snag?.stopZ ?? -1150 } : { x: __sq.BIRCHES_CLEARING.x, z: __sq.BIRCHES_CLEARING.y };
        g.child.place(at.x, at.z, Math.PI);
        saveProgress('birches', point, data, g.story.cast);
      }, { point, data });
      await page.goto(`${base}?shot=1&progress=1`);
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
      await page.waitForTimeout(1500);
      const s = await page.evaluate(() => {
        const c = __game.story.current;
        return { chapter: __game.story.name, rounds: c.squirrel?.rounds, station: c.squirrel?.station, mode: c.squirrel?.mode, visible: __game.squirrel.visible };
      });
      rows.push({ reload: point, ...s });
      assert.equal(s.chapter, 'birches', `reloading ${point}`);
      assert.equal(s.rounds, rounds, `reloading ${point}: rounds ${s.rounds}`);
      await page.evaluate(() => localStorage.removeItem('updraft.progress.v1'));
      await load();
    }
    return rows;
  },

  async frames() {
    await load();
    const rows = [];
    for (const round of [0, 1, 2]) {
      await jump(round);
      await page.evaluate(() => { const q = __game.story.current.squirrel; q.lying = () => {}; q.seek = () => {}; __game.cygnet.errand = null; });
      await page.waitForTimeout(3500);
      const row = await page.evaluate(async () => {
        const g = __game, c = g.story.current, s = g.squirrel, cam = g.rig.camera, r = __sq.ROUNDS[c.round];
        const mul = (e, x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
        /** Its skinned outline's height on screen, counting only what stands above `above` (the top of the leaves). */
        const tall = (above = -Infinity) => {
          const a = s.mesh.geometry.attributes, v = s.position.clone();
          cam.updateMatrixWorld();
          let y0 = Infinity, y1 = -Infinity;
          for (let i = 0; i < a.position.count; i += 2) {
            const m = Math.round(a.aMat.getX(i));
            if (m === 5 || (m === 6 && !s.lookNow.nut)) continue;
            const x = a.position.getX(i), y = a.position.getY(i), z = a.position.getZ(i), k = a.aSkin.getZ(i);
            const p = mul(s.rig.bones[a.aSkin.getX(i)].elements, x, y, z);
            const q = k > 0 ? mul(s.rig.bones[a.aSkin.getY(i)].elements, x, y, z).map((w, j) => p[j] + (w - p[j]) * k) : p;
            if (q[1] < above) continue;
            v.set(q[0], q[1], q[2]).project(cam);
            const yy = (0.5 - v.y * 0.5) * innerHeight;
            y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
          }
          return y1 > y0 ? Math.round(y1 - y0) : 0;
        };
        const settle = () => { for (let i = 0; i < 40; i++) s.update(1 / 30, 100 + i / 30); };
        /** Pixels that differ with it drawn and without, the world held still between the two. */
        const showing = () => {
          const R = g.renderer, size = R.getDrawingBufferSize(cam.position.clone()), w = size.x, h = size.y;
          const target = new g.post.sceneTarget.constructor(w, h), a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4);
          const draw = (into) => { R.setRenderTarget(target); R.render(g.scene, cam); R.readRenderTargetPixels(target, 0, 0, w, h, into); };
          s.mesh.visible = true; draw(a);
          s.mesh.visible = false; draw(b);
          s.mesh.visible = true; R.setRenderTarget(null); target.dispose();
          let n = 0;
          for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) n++;
          return n;
        };
        const depths = await g.birches.depthAt(r.hides);
        const sit = [], peek = [], tailIn = [], tailOut = [];
        r.hides.forEach((h, i) => {
          s.act('sit', { at: h, yaw: Math.atan2(cam.position.x - h.x, cam.position.z - h.z), floor: () => h.y, look: null, nut: true });
          settle(); sit.push(tall());
          c.squirrel.hide({ round: c.round, heap: i, at: h.clone(), sink: depths[i] - g.birches.buryDepth(h.x, h.z, depths[i]), reach: 1, trunk: null }, true);
          c.squirrel.mode = 'hidden';
          s.act('buried', { tailOut: false }); settle(); tailIn.push(showing());
          s.act('buried', { tailOut: true }); settle(); tailOut.push(showing());
          s.act('peek', { for: 30, tailOut: true }); settle(); peek.push(tall(h.y + depths[i]));
        });
        const face = g.child.face(g.child.position.clone()), head = window.__screen(face.clone().setY(face.y + 0.55)), feet = window.__screen(g.child.position.clone());
        const inFrame = ([u, w]) => u > 0.04 && u < 0.96 && w > 0.03 && w < 0.97;
        s.act('sit', { at: r.hides[0], yaw: Math.atan2(cam.position.x - r.hides[0].x, cam.position.z - r.hides[0].z), floor: () => r.hides[0].y, look: null, nut: true });
        settle();
        return { sit, peekAboveLeaves: peek, tailInPx: tailIn, tailOutPx: tailOut, leafTop: depths.map((d) => +d.toFixed(2)), childWhole: inFrame(head) && inFrame(feet),
          heapsIn: r.heaps.map((i) => inFrame(window.__screen(r.hides[0].clone().set(__sq.BIRCH_PILES[i].x, r.hides[0].y, __sq.BIRCH_PILES[i].z)))),
          lens: +cam.position.distanceTo(r.stand).toFixed(1) };
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}-frame-${round + 1}-${W}x${H}.png` });
      rows.push({ round: round + 1, ...row });
      assert.ok(row.tailInPx.every((n) => n <= 6), `round ${round + 1}: buried tail in, it shows ${row.tailInPx} px`);
      await page.evaluate(() => { const q = __game.story.current.squirrel; delete q.lying; delete q.seek; });
    }
    return rows;
  },
};

try {
  for (const name of cases) {
    const began = Date.now();
    results[name] = await cased[name]();
    console.log(JSON.stringify({ [name]: results[name], seconds: Math.round((Date.now() - began) / 1000) }));
  }
  assert.deepEqual(errors, []);
} finally {
  await close();
}

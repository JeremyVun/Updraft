// The birches' squirrel hide-and-seek with real pointer strokes and circles. Heaps yield only to updrafts: hard strokes
// across the right heap leave it standing and never find it, and circles over it find it in a few loops; wrong heaps
// first (round 2's burst, round 3's stand and only lift their tops) with the right heap answering; heaps eroding each
// on its own under circles; a child's random swipes taking nothing, then sloppy circles finding it (counted per
// round); a stalled player through the hint and the drawn updraft; every heap held against strokes and circles until
// it is in, from the boat, at the meeting and before rounds 2 and 3 (and the drift and trunk fallbacks); free-play
// heaps standing against strokes and taken by circles; round 3's shuffle (its plan, its frame, the heaps held through
// it, her and the cygnet watching); the leap into a standing heap and through a bare hollow; resumed saves at every new
// checkpoint and from names saved before the game; and stills of each round's frame with the squirrel's height on
// screen and how much of it shows buried tail in.
// Usage: BASE=http://127.0.0.1:5244/ node tools/squirrel-rounds-check.mjs [right updraft wrong answer apart random shuffle plans stall early flat free leap bare resume frames]
// W/H set the viewport (default 1600x900; frames also takes 390x844 portrait); OUT prefixes the stills; SCALE sets
// the squirrel's size at runtime; ROUND=2 or 3 runs only that round of `wrong`, EARLY=toBirches or birches only that
// start of `early`.
// Cases run in one browser in the order given; split them across calls to stay under a tool's time limit.
import { openBrowser } from './lib/browser.mjs';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = Number(process.env.W ?? 1600), H = Number(process.env.H ?? 900);
const out = process.env.OUT ?? '/tmp/updraft-squirrel-rounds';
const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['right', 'updraft', 'wrong', 'answer', 'apart', 'random', 'shuffle', 'plans', 'stall', 'early', 'flat', 'free', 'leap', 'bare', 'resume', 'frames'];
const { browser, close } = await openBrowser();
const errors = [];
const results = {};
let page;

async function load(query = '', chapter = 'birches') {
  page?.close();
  page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.goto(`${base}?shot=1&chapter=${chapter}${query}`);
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
    if (patch === 'drift') g.birches.depthAt = async (points) => points.map((_, i) => (i < r.hides.length && points.length !== 5 ? 0 : 0.7));
    /** Off the ride beside her stand, clear of every heap, so she walks in without wading through one. */
    g.child.stop(); g.child.place(r.stand.x + [-2, -0.7, 2][round], r.stand.z + [1, 3.4, 1][round], Math.PI); g.glider.hold(g.child);
    if (!g.cygnet.carried) g.cygnet.rideIn('satchel');
    c.restoreCheckpoint(__sq.birchesPoint(round, round, round === 2), [[0, 2, 4][round], round === 2 ? 1 : 0, 0.62, round, round]);
    c.update(0, c.now);
    g.rig.cut(c.shot);
  }, { round, patch });
  await until(() => __game.story.current.beat === 'round' && __game.story.current.squirrel.hideout, null, 60000)
    .catch(async (e) => { throw new Error(`round ${round + 1} never began: ${JSON.stringify(await state())} ${e.message}`); });
  await page.evaluate(() => __game.rig.cut(__game.story.current.shot));
  await page.waitForTimeout(800);
}

/** Every tell the squirrel gives from now on, by the story's clock. */
const watchTells = () => page.evaluate(() => {
  const s = __game.squirrel, told = (window.__told = []);
  if (!s.__tell) { s.__tell = s.tell; s.tell = function (...a) { const ok = s.__tell.apply(this, a); if (ok) window.__told.push(__game.story.current.now); return ok; }; }
  return told.length;
});

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

/**
 * Real circles round heap `heap`, `size` times its radius on the ground as the drawn updraft shows, until it is found
 * or `loops` are drawn; `shot` names a still taken after the loop `shotAt`.
 */
async function circleOver(heap, round, loops = 6, size = null, { shot = null, shotAt = 2, perLoop = 0.67 } = {}) {
  return circleRing(await heapLoop(heap, size), round, loops, { shot, shotAt, perLoop });
}

async function circleRing(ring, round, loops, { shot = null, shotAt = 2, perLoop = 0.67 } = {}) {
  await page.evaluate(() => { __game.input.present = false; });
  let drawn = 0;
  await page.mouse.move(ring[0][0] * W, ring[0][1] * H);
  for (; drawn < loops; drawn++) {
    for (let i = 1; i <= 24; i++) {
      const [x, y] = ring[i % 24];
      await page.mouse.move(x * W, y * H);
      await page.waitForTimeout(perLoop * 1000 / 24);
    }
    if (shot && drawn + 1 === shotAt) await page.screenshot({ path: `${out}-${shot}.png` });
    if (round >= 0 && (await found(round, 20))) return drawn + 1;
  }
  return round >= 0 && (await found(round, 1500)) ? drawn : null;
}

/** Circles on screen round `at` (fractions), `r` screen heights across. */
const screenRing = (at, r = 0.06) => Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2;
  return [at[0] + Math.cos(a) * r * H / W, at[1] + Math.sin(a) * r];
});

/** How high the leaves stand at the middle of each of `heaps` (`BIRCH_PILES` indices; a round's by default). */
const depthsOf = (heaps = null) => page.evaluate((heaps) => {
  heaps ??= __sq.ROUNDS[__game.story.current.round].heaps;
  return __game.birches.depthAt(heaps.map((i) => __sq.BIRCH_PILES[i])).then((d) => d.map((v) => +v.toFixed(2)));
}, heaps);

/** Where heap `heap` (a `BIRCH_PILES` index) is on screen, with a hard stroke's ends across it; null when off screen. */
const pileOnScreen = (heap) => page.evaluate((heap) => {
  const p = __sq.BIRCH_PILES[heap], y = Math.max(0, __sq.heightAt(p.x, p.z)) + 0.3;
  const at = (x, z) => { const v = __game.squirrel.position.clone().set(x, y, z).project(__game.rig.camera); return [(v.x + 1) / 2, (1 - v.y) / 2, v.z]; };
  const m = at(p.x, p.z), a = at(p.x - p.r * 1.6, p.z), b = at(p.x + p.r * 1.6, p.z);
  if (!(m[2] < 1 && m[0] > 0.08 && m[0] < 0.92 && m[1] > 0.15 && m[1] < 0.92)) return null;
  const ring = Array.from({ length: 24 }, (_, i) => { const t = (i / 24) * Math.PI * 2; return at(p.x + Math.cos(t) * p.r * 0.8, p.z + Math.sin(t) * p.r * 0.8).slice(0, 2); });
  return { m: m.slice(0, 2), a: a.slice(0, 2), b: b.slice(0, 2), ring };
}, heap);

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
  /**
   * Hard strokes across the right heap take none of it and never find it (it peeks at them); circles over it then
   * find it in a few loops.
   */
  async right() {
    await load();
    const rows = [];
    for (const round of [0, 1, 2]) {
      if (round === 0) await until(() => __game.story.current.beat === 'round' && __game.story.current.squirrel.hideout, null, 90000);
      else await jump(round);
      const { hide } = await state();
      const heap = Math.max(0, hide.heap), before = await depthsOf();
      const line = await acrossHeap(heap, 1.8);
      for (let i = 0; i < 3; i++) { await stroke(i % 2 ? [line[1], line[0]] : line, 260); await page.waitForTimeout(600); }
      await page.waitForTimeout(1500);
      const stroked = await depthsOf();
      assert.ok(!(await found(round, 50)), `round ${round + 1}: strokes across the right heap found it`);
      assert.ok(stroked[heap] >= before[heap] * 0.85, `round ${round + 1}: strokes took the right heap: ${JSON.stringify({ before, stroked })}`);
      const began = await page.evaluate(() => __game.story.current.now);
      const loops = await circleOver(heap, round);
      assert.ok(loops !== null && loops <= 4, `round ${round + 1}: circling the right heap took ${loops} loops`);
      const at = await page.evaluate(() => __game.story.current.now);
      await page.screenshot({ path: `${out}-right-${round + 1}.png` });
      await afterFind(round);
      rows.push({ round: round + 1, heap: hide.heap, before: before[heap], afterStrokes: stroked[heap], loops, foundAfter: +(at - began).toFixed(2), next: (await state()).beat });
    }
    return rows;
  },

  /**
   * Circles over the right heap uncover it in about two loops; in round 3, two loops over the far wrong heap first do
   * not, and that heap stands, its top lifted. A column is wider than the gap between neighbouring heaps.
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
        const before = await depthsOf();
        const loops = await circleOver(heap, round, 2, null, { shot: 'updraft-wrong-lifted', shotAt: 2 });
        await page.waitForTimeout(1500);
        const after = await depthsOf();
        wrongs.push({ heap, found: loops !== null, before: before[heap], after: after[heap] });
      }
      assert.ok(wrongs.every((w) => !w.found), `round ${round + 1}: an updraft over a wrong heap found it: ${JSON.stringify(wrongs)}`);
      assert.ok(wrongs.every((w) => w.after >= w.before * 0.85), `round ${round + 1}: a wrong heap did not stand: ${JSON.stringify(wrongs)}`);
      const lift = await page.evaluate(() => { const h = __game.story.current.squirrel.hideout; return h ? +__game.wind.sample(h.at.x, h.at.z, { x: 0, z: 0, energy: 0, lift: 0 }).lift.toFixed(2) : null; });
      const loops = await circleOver(hide.heap, round);
      assert.ok(loops !== null && loops <= 4, `round ${round + 1}: circling the right heap took ${loops} loops`);
      await page.screenshot({ path: `${out}-updraft-${round + 1}.png` });
      rows.push({ round: round + 1, heap: hide.heap, loops, wrongs, liftBefore: lift });
      await afterFind(round);
    }
    return rows;
  },

  /**
   * Each arrangement on a fresh floor: circles over each wrong heap first (round 2's burst apart, round 3's stand with
   * their tops lifted), then over the right heap.
   */
  async wrong() {
    const rows = [];
    for (const round of process.env.ROUND ? [Number(process.env.ROUND) - 1] : [1, 2]) {
      const heaps = round === 1 ? 2 : 3;
      for (let right = 0; right < heaps; right++) {
        await load();
        await jump(round);
        await hideIn(right);
        const wrongs = [];
        for (let heap = 0; heap < heaps; heap++) {
          if (heap === right) continue;
          const before = await depthsOf();
          const loops = await circleOver(heap, round, 3);
          await page.waitForTimeout(1500);
          const after = await depthsOf();
          wrongs.push({ heap, found: loops !== null || (await found(round, 50)), before: before[heap], after: after[heap] });
          await page.waitForTimeout(2000);
        }
        assert.ok(wrongs.every((w) => !w.found), `round ${round + 1}: a wrong heap found it: ${JSON.stringify(wrongs)}`);
        if (round === 1) assert.ok(wrongs.every((w) => w.after < w.before * 0.5), `round 2: a wrong heap did not burst apart: ${JSON.stringify(wrongs)}`);
        else assert.ok(wrongs.every((w) => w.after >= w.before * 0.85), `round 3: a wrong heap did not stand: ${JSON.stringify(wrongs)}`);
        const loops = await circleOver(right, round);
        assert.ok(loops !== null && loops <= 4, `round ${round + 1}: circles over the right heap after the wrong ones took ${loops} loops: ${JSON.stringify({ right, wrongs })}`);
        rows.push({ round: round + 1, right, wrongs, loops });
        await afterFind(round);
      }
    }
    return rows;
  },

  /**
   * A child's random swipes over the frame take no heap and never find it; then a child's sloppy circles over the right
   * heap (drawn on the screen off its middle, too big or too small, squashed, too fast or too slow) find it, counted in
   * loops, for each of `SEEDS`.
   */
  async random() {
    const rows = [];
    for (const start of (process.env.SEEDS ?? process.env.SEED ?? '7,11,23').split(',').map(Number)) {
      await load();
      let seed = start;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const row = { seed: start };
      for (const round of [0, 1, 2]) {
        if (round === 0) await until(() => __game.story.current.beat === 'round' && __game.story.current.squirrel.hideout, null, 90000);
        else await jump(round);
        const before = await depthsOf();
        let at = [0.05 + rand() * 0.9, 0.3 + rand() * 0.6];
        await page.evaluate(() => { __game.input.present = false; });
        await page.mouse.move(at[0] * W, at[1] * H);
        /** Each swipe goes from where the last ended to anywhere in the frame below the canopy, never aimed. */
        for (let strokes = 0; strokes < 20; strokes++) {
          const to = [0.05 + rand() * 0.9, 0.3 + rand() * 0.6];
          await stroke([at, to], 150 + rand() * 450, false);
          at = to;
          await page.waitForTimeout(rand() * 700);
        }
        await page.waitForTimeout(1500);
        const after = await depthsOf();
        assert.ok(!(await found(round, 50)), `seed ${start}, round ${round + 1}: random swipes found it`);
        assert.ok(after.every((d, i) => d >= before[i] * 0.85), `seed ${start}, round ${round + 1}: random swipes took a heap: ${JSON.stringify({ before, after })}`);
        const heap = Math.max(0, (await state()).hide?.heap ?? 0);
        /** Drawn round on the screen as a hand draws, not on the ground: off the heap's middle, any size, squashed a little. */
        const [mx, my] = await heapOnScreen(heap), [a, b] = await acrossHeap(heap, 1), half = (b[0] - a[0]) / 2;
        const off = [(rand() - 0.5) * half, (rand() - 0.5) * half * 0.6], size = 0.04 + rand() * 0.08, squash = 0.6 + rand() * 0.6, perLoop = 0.6 + rand() * 0.8;
        const ring = Array.from({ length: 24 }, (_, i) => {
          const t = (i / 24) * Math.PI * 2;
          return [mx + off[0] + Math.cos(t) * size * H / W, my + off[1] + Math.sin(t) * size * squash];
        });
        const loops = await circleRing(ring, round, 8, { perLoop });
        row[`round${round + 1}`] = { loops, off: off.map((v) => +v.toFixed(3)), size: +size.toFixed(3), squash: +squash.toFixed(2), perLoop: +perLoop.toFixed(2) };
        if (loops === null) {
          await page.screenshot({ path: `${out}-random-lost-${start}-${round + 1}.png` });
          assert.fail(`seed ${start}, round ${round + 1}: eight sloppy loops never found it: ${JSON.stringify(row)}`);
        }
        await afterFind(round);
      }
      rows.push(row);
    }
    const all = rows.flatMap((r) => [r.round1.loops, r.round2.loops, r.round3.loops]);
    assert.ok(all.every((n) => n <= 5), `sloppy circles took up to ${Math.max(...all)} loops: ${JSON.stringify(rows)}`);
    return { rows, mean: +(all.reduce((a, b) => a + b, 0) / all.length).toFixed(1), most: Math.max(...all) };
  },

  /**
   * Round 3's heaps, the squirrel in the middle one: hard strokes across each take none of them, and circles over the
   * middle one take it and find it, leaving the near and far ones standing.
   */
  async apart() {
    await load();
    await jump(2);
    await hideIn(1);
    await page.waitForTimeout(1500);
    const before = await depthsOf();
    for (const heap of [0, 1, 2]) await stroke(await acrossHeap(heap, 1.8), 260);
    await page.waitForTimeout(2000);
    const stroked = await depthsOf();
    const loops = await circleOver(1, 2, 6);
    await page.waitForTimeout(3000);
    const circled = await depthsOf([6, 7, 8]);
    assert.ok(stroked.every((d, i) => d >= before[i] * 0.9), `strokes took a heap: ${JSON.stringify({ before, stroked })}`);
    assert.ok(loops !== null && circled[1] < before[1] * 0.6 && circled[0] >= before[0] * 0.85 && circled[2] >= before[2] * 0.85, `circles over the middle heap: ${JSON.stringify({ loops, before, circled })}`);
    return { before, stroked, loops, circled };
  },

  /** Wind on a wrong heap: the right one answers with a tell at once, with no tells of its own due, and she looks at it. */
  async answer() {
    const rows = [];
    for (const round of [1, 2]) {
      await load();
      await jump(round);
      await hideIn(0);
      await watchTells();
      await page.evaluate(() => { __game.story.current.squirrel.nextTell = Infinity; });
      await page.waitForTimeout(1800);
      const [a, b] = await acrossHeap(1), [rx] = await heapOnScreen(0);
      const began = await page.evaluate(() => __game.story.current.now);
      await page.evaluate(() => { window.__told.length = 0; });
      await stroke(rx > a[0] ? [b, a] : [a, b]);
      /** How far from its heap she is looking, a few times a second while it answers. */
      const looks = [];
      for (let i = 0; i < 9; i++) {
        await page.waitForTimeout(200);
        looks.push(await page.evaluate(() => { const g = __game, h = g.story.current.squirrel.hideout, l = g.child.lookAt; return l && h ? +Math.hypot(l.x - h.at.x, l.z - h.at.z).toFixed(1) : null; }));
      }
      const r = await page.evaluate(() => {
        const c = __game.story.current;
        return { told: window.__told.slice(), found: c.squirrel.rounds > c.round || c.squirrel.mode !== 'hidden' };
      });
      const after = r.told.map((t) => +(t - began).toFixed(2)), looked = looks.filter((d) => d !== null && d < 1).length * 0.2;
      rows.push({ round: round + 1, after, found: r.found, lookedAtIt: +looked.toFixed(1) });
      assert.ok(!r.found, `round ${round + 1}: the wrong heap found it`);
      assert.ok(looked >= 1, `round ${round + 1}: she did not look at the heap that answered: ${looks}`);
      assert.ok(after.length >= 1 && after[0] < 1.6, `round ${round + 1}: the right heap did not answer: ${JSON.stringify(after)}`);
    }
    return rows;
  },

  /**
   * Round 3 from the walk in: no counting; it waits sitting up in the frame; she stands and watches; it dives in, moves
   * heap to heap (neighbours only, the last one or two under the leaves) and settles, never found on the way however
   * hard the heaps are blown; she and the cygnet follow it with their eyes; every heap and the squirrel stay in frame.
   */
  async shuffle() {
    await load();
    await page.evaluate(async () => {
      const g = __game, c = g.story.current;
      g.child.stop(); g.child.place(-143.2, -1196, Math.PI); g.glider.hold(g.child);
      if (!g.cygnet.carried) g.cygnet.rideIn('satchel');
      c.restoreCheckpoint(__sq.birchesPoint(2, 2, true), [4, 1, 0.62, 2, 2]);
      c.update(0, c.now); g.rig.cut(c.shot);
    });
    const log = [];
    const sample = () => page.evaluate(() => {
      const g = __game, c = g.story.current, q = c.squirrel, s = g.squirrel, r = __sq.ROUNDS[2];
      const pts = r.heaps.flatMap((i) => { const p = __sq.BIRCH_PILES[i], y = Math.max(0, __sq.heightAt(p.x, p.z));
        return [[p.x - p.r, p.z], [p.x + p.r, p.z], [p.x, p.z - p.r], [p.x, p.z + p.r]].map(([x, z]) => window.__screen(s.position.clone().set(x, y, z))); });
      const face = g.child.face(g.child.position.clone());
      return { t: c.now, beat: c.beat, mode: q.mode, step: q.shuffle?.step ?? null, move: q.shuffle?.move ?? null, order: q.shuffle?.order ?? null, under: q.shuffle?.under ?? null,
        visible: s.visible, at: window.__screen(s.position.clone().setY(s.position.y + 0.3)), tracked: window.__screen(q.tracked.clone()),
        herEyes: g.child.lookAt === q.tracked, birdEyes: g.cygnet.mind.told === q.tracked, hump: g.birches.burrowing.w,
        heaps: pts, head: window.__screen(face.setY(face.y + 0.55)), feet: window.__screen(g.child.position.clone()), found: q.rounds > 2, lens: +c.lensSpeed.toFixed(2) };
    });
    for (let i = 0; i < 600; i++) {
      const s = await sample();
      log.push(s);
      assert.notEqual(s.beat, 'counting', 'she counted before round 3');
      if (s.beat === 'round') break;
      if (s.step === 'rest' && s.move === 1 && !log.some((l) => l.blown)) {
        s.blown = true;
        const before = await page.evaluate(() => __game.birches.depthAt(__sq.ROUNDS[2].hides).then((d) => d.map((v) => +v.toFixed(2))));
        for (const heap of [0, 1, 2]) await stroke(await acrossHeap(heap, 1.8), 260);
        for (const heap of [0, 1, 2]) await circleRing(await heapLoop(heap, 0.8), -1, 2);
        await page.waitForTimeout(1500);
        const after = await page.evaluate(() => __game.birches.depthAt(__sq.ROUNDS[2].hides).then((d) => d.map((v) => +v.toFixed(2))));
        s.held = { before, after };
        assert.ok(after.every((d, i) => d >= before[i] * 0.85), `the heaps did not hold through the shuffle: ${JSON.stringify(s.held)}`);
      }
      await page.waitForTimeout(100);
    }
    const shuffling = log.filter((l) => l.mode === 'shuffling');
    const plan = shuffling.find((l) => l.order)?.order;
    const end = log[log.length - 1];
    assert.equal(end.beat, 'round', 'the shuffle never settled');
    const hide = await page.evaluate(() => __game.story.current.squirrel.hideout.heap);
    const inFrame = ([u, v]) => u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98;
    const watched = shuffling.filter((l) => l.step && l.step !== 'dare');
    const outside = shuffling.filter((l) => (l.visible ? !inFrame(l.at) : !inFrame(l.tracked)) || !l.heaps.every(inFrame) || !inFrame(l.head) || !inFrame(l.feet));
    const humps = shuffling.filter((l) => l.step === 'burrow');
    assert.ok(plan && plan.length >= 4 && plan.length <= 5, `plan ${plan}`);
    assert.ok(plan.every((h, i) => i === 0 || Math.abs(h - plan[i - 1]) === 1), `a move skipped a heap: ${plan}`);
    assert.equal(hide, plan[plan.length - 1], 'it did not stay where it settled');
    assert.ok(!shuffling.some((l) => l.found), 'found while it shuffled');
    assert.ok(humps.length > 0 && humps.every((l) => !l.visible) && humps.filter((l) => l.hump > 0).length >= humps.length / 2, 'no hump under the leaves');
    assert.ok(watched.every((l) => l.herEyes && l.birdEyes), 'she or the cygnet looked away from it');
    if (process.env.TRACE) for (const l of log.filter((_, i) => i % 10 === 0)) console.log(JSON.stringify({ t: +l.t.toFixed(1), step: l.step, minx: +Math.min(...l.heaps.map((p) => p[0])).toFixed(2), maxx: +Math.max(...l.heaps.map((p) => p[0])).toFixed(2), maxy: +Math.max(...l.heaps.map((p) => p[1])).toFixed(2), feet: l.feet.map((v) => +v.toFixed(2)), lens: l.lens }));
    assert.ok(outside.length === 0, `out of frame: ${JSON.stringify(outside.slice(0, 3))}`);
    const dare = shuffling[0].t;
    await page.screenshot({ path: `${out}-shuffle-settled-${W}x${H}.png` });
    return { plan, under: shuffling.find((l) => l.under !== null)?.under, hide, seconds: +(end.t - dare).toFixed(1), held: log.find((l) => l.held)?.held, samples: log.length };
  },

  /** The shuffle's plans: three or four moves to a heap beside the one it is in, the last one or two under, ending anywhere. */
  async plans() {
    await load();
    return page.evaluate(() => {
      const q = __game.story.current.squirrel, ends = [0, 0, 0], moves = {}, unders = {};
      for (let i = 0; i < 600; i++) {
        const p = q.plan(2, [1, 1, 1]);
        if (!p.order.every((h, j) => j === 0 || Math.abs(h - p.order[j - 1]) === 1)) throw new Error(`plan ${p.order}`);
        ends[p.order[p.order.length - 1]]++;
        moves[p.order.length - 1] = (moves[p.order.length - 1] ?? 0) + 1;
        unders[p.under] = (unders[p.under] ?? 0) + 1;
        if (p.under < 1 || p.under > 2 || p.order.length - 1 - p.under < 2) throw new Error(`under ${p.under} of ${p.order}`);
      }
      if (ends.some((n) => n < 60)) throw new Error(`it ends in some heaps too rarely: ${ends}`);
      return { ends, moves, unders };
    });
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
    assert.ok(timeline.hint !== null && timeline.hint >= 6.5 && timeline.hint < 12, `the cygnet's hint: ${timeline.hint}`);
    assert.ok(timeline.invitation !== null && timeline.invitation >= 11.5 && timeline.invitation < 15, `the drawn updraft: ${timeline.invitation}`);
    const loops = await circleOver(0, 1);
    assert.ok(loops !== null, 'an updraft after the invitation did not find it');
    return { ...timeline, loops };
  },

  /**
   * Every heap of the round blown at hard before the squirrel gets there: real strokes and circles over each heap while
   * she waits short of them. The heaps hold until it is in, so it still hides in one. Its fallbacks for heaps taken
   * after it is in are forced, with a floor that reads drifts but no heaps (a drift), and one that reads bare
   * everywhere (a trunk); circles find it at either.
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
          for (let heap = 0; heap < __heaps(round); heap++) await circleRing(await heapLoop(heap, 0.8), -1, 3);
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
        /** The forced drift is only on the readback; the real floor there is thin, so it is found uncovered once read. */
        if (kind === 'drift') await page.evaluate(() => { delete __game.birches.depthAt; });
        let loops = null;
        if (kind === 'trunk') {
          const line = [[s.hide.screen[0] - 0.16, s.hide.screen[1] + 0.02], [s.hide.screen[0] + 0.16, s.hide.screen[1] - 0.02]];
          for (let i = 0; i < 3; i++) await stroke(i % 2 ? [line[1], line[0]] : line);
          assert.ok(!(await found(round, 1500)), `round ${round + 1}: strokes flushed it from behind its trunk`);
        }
        if (!(await found(round, 1500))) loops = await circleRing(screenRing((await state()).hide?.screen ?? s.hide.screen), round, 6);
        assert.ok(await found(round, 1500), `round ${round + 1}: the ${kind} hide was never found: ${JSON.stringify({ before, after, s, now: await state() })}`);
        rows.push({ kind, round: round + 1, before, after, hid: s.hide.trunk ? 'trunk' : s.hide.heap < 0 ? 'drift' : `heap ${s.hide.heap}`, loops });
        await afterFind(round);
      }
    }
    return rows;
  },

  /** Found after a wrong guess (circles over a heap it is not in, which stands): she leaps into a heap still standing. */
  async leap() {
    await load();
    await jump(2);
    const { hide } = await state();
    const wrong = hide.heap === 0 ? 1 : 0;
    await circleOver(wrong, 2, 3);
    await page.waitForTimeout(1500);
    assert.ok((await circleOver(Math.max(0, hide.heap), 2)) !== null, 'round 3 not found');
    await until(() => __game.story.current.beat === 'leap', null, 10000);
    const began = await page.evaluate(() => __game.story.current.now);
    await until(() => ['waiting', 'running', 'flying', 'kicking'].includes(__game.story.current.squirrel.leap), null, 10000);
    const into = await page.evaluate(async () => {
      const q = __game.story.current.squirrel, land = q.land, heaps = __sq.ROUNDS[2].heaps;
      const near = heaps.map((i) => { const p = __sq.BIRCH_PILES[i]; return Math.hypot(p.x - land.x, p.z - land.z) - p.r; });
      const heap = near.indexOf(Math.min(...near));
      const [depth] = await __game.birches.depthAt([__sq.BIRCH_PILES[heaps[heap]]]);
      return { leap: q.leap, heap, inside: near[heap] < 0, depth: +depth.toFixed(2) };
    });
    assert.ok(into.leap !== 'kicking' && into.inside && into.heap !== hide.heap && into.depth >= 0.56, `she did not leap into a standing heap: ${JSON.stringify({ into, hide: hide.heap, wrong })}`);
    await until(() => __game.child.action?.kind === 'leap', null, 15000);
    await page.screenshot({ path: `${out}-leap-run.png` });
    await until(() => __game.child.action?.kind === 'leap' && __game.child.sitting, null, 5000);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}-leap-landed.png` });
    await until(() => __game.child.action === null && __game.child.sitting, null, 5000);
    await page.screenshot({ path: `${out}-leap-sitting.png` });
    await until(() => __game.story.current.beat === 'walk', null, 15000);
    const ended = await page.evaluate(() => __game.story.current.now);
    return { leap: +(ended - began).toFixed(1), into, station: (await state()).station };
  },

  async bare() {
    await load();
    await jump(2);
    const { hide } = await state();
    assert.ok((await circleOver(Math.max(0, hide.heap), 2)) !== null, 'round 3 not found');
    await page.evaluate(() => { __game.birches.depthAt = async (points) => points.map(() => 0); });
    await until(() => __game.story.current.beat === 'leap', null, 10000);
    const began = await page.evaluate(() => __game.story.current.now);
    await until(() => __game.story.current.squirrel.leap === 'kicking', null, 5000);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}-bare-kicking.png` });
    await until(() => __game.story.current.beat === 'walk', null, 20000);
    return { run: +((await page.evaluate(() => __game.story.current.now)) - began).toFixed(1) };
  },

  /**
   * No heap can be taken before the squirrel is in it: hard strokes and circles over the first heap whenever it is on
   * screen from the boat (`toBirches`) and from landing through the meeting until it dives in (round 2's and 3's
   * heaps before they are in are in `flat` and `shuffle`).
   */
  async early() {
    const rows = [];
    for (const chapter of process.env.EARLY ? [process.env.EARLY] : ['toBirches', 'birches']) {
      await load('', chapter);
      const first = (await depthsOf([0]))[0];
      let blown = 0, least = first, n = 0;
      for (let t = Date.now(); Date.now() - t < 150000; n++) {
        const st = await page.evaluate(() => ({ name: __game.story.name, wentIn: __game.story.current.squirrel?.wentIn ?? -1 }));
        if (st.name === 'birches' && st.wentIn >= 0) break;
        const at = await pileOnScreen(0);
        if (!at) { await page.waitForTimeout(400); continue; }
        if (n % 2) await circleRing(at.ring, -1, 2);
        else await stroke(n % 4 ? [at.b, at.a] : [at.a, at.b], 220);
        blown++;
        const [depth] = await depthsOf([0]);
        /** A blow the squirrel dived in during is over a heap it is in, which is free to go. */
        if ((await page.evaluate(() => __game.story.current.squirrel?.wentIn ?? -1)) < 0) least = Math.min(least, depth);
      }
      rows.push({ chapter, first, least, blown });
      assert.ok(blown > 0, `${chapter}: the first heap was never on screen to blow`);
      assert.ok(least >= first * 0.85, `${chapter}: the first heap was taken before the squirrel was in: ${JSON.stringify(rows)}`);
    }
    return rows;
  },

  /** The free-play heaps (1, 2 and 3) stand against hard strokes and go to a few loops of circles, wherever one is on screen. */
  async free() {
    const rows = [];
    for (const round of [1, 2]) {
      await load();
      await jump(round);
      await page.evaluate(() => { const q = __game.story.current.squirrel; q.lying = () => {}; q.seek = () => {}; });
      for (const heap of [1, 2, 3]) {
        const at = await pileOnScreen(heap);
        if (!at || rows.some((r) => r.heap === heap)) continue;
        const before = (await depthsOf([heap]))[0];
        for (let i = 0; i < 3; i++) await stroke(i % 2 ? [at.b, at.a] : [at.a, at.b], 220);
        await page.waitForTimeout(1500);
        const stroked = (await depthsOf([heap]))[0];
        await circleRing(at.ring, -1, 4);
        await page.waitForTimeout(2000);
        const circled = (await depthsOf([heap]))[0];
        rows.push({ heap, from: `round ${round + 1}`, before, stroked, circled });
        assert.ok(stroked >= before * 0.85, `free heap ${heap} went to strokes: ${JSON.stringify(rows)}`);
        assert.ok(circled < before * 0.5, `free heap ${heap} stood against four loops: ${JSON.stringify(rows)}`);
      }
    }
    assert.ok(rows.length > 0, 'no free-play heap was on screen');
    return rows;
  },

  async resume() {
    await load();
    const expect = {
      'squirrel1-scarf0': [[0, 0, 0.6, 0, 1], 'tangle1', 'idle'], 'squirrel1-scarf1': [[1, 0, 0.6, 1, 1], 'round2', 'hidden'],
      'squirrel2-scarf1': [[2, 0, 0.6, 1, 2], 'swing', 'idle'], 'squirrel2-scarf1-swing': [[3, 1, 0.6, 1, 2], 'tangle2', 'idle'],
      'squirrel2-scarf2-swing': [[3, 1, 0.6, 2, 2], 'round3', 'waiting'], 'squirrel3-scarf2-swing': [[4, 1, 0.6, 2, 3], 'tangle3', 'idle'],
      'squirrel3-scarf3-swing': [[4, 1, 0.6, 3, 3], 'tangle4', 'idle'], 'squirrel3-scarf4-swing': [[5, 1, 0.7, 4, 3], 'goodbye', 'idle'],
      'scarf4-1': [[1, 0, 0.6, 1], 'round2', 'hidden'], 'scarf4-1-swing': [[3, 1, 0.6, 1], 'tangle2', 'idle'],
      'scarf4-2': [[3, 0, 0.6, 2], 'round3', 'waiting'], 'scarf4-3': [[4, 0, 0.6, 3], 'tangle4', 'idle'],
      'scarf4-4-swing': [[5, 1, 0.7, 4], 'goodbye', 'idle'], 'scarf-2': [[3, 0, 0.6, 2], 'round3', 'waiting'],
      'scarf-3': [[4, 0, 0.6, 3], 'goodbye', 'idle'], swing: [[3, 1, 0.6], 'tangle2', 'idle'], leaves: [[3, 0, 0.6], 'round3', 'waiting'],
    };
    const rows = [];
    for (const [point, [data, station, mode]] of Object.entries(expect)) {
      const s = await page.evaluate(async ({ point, data, mode }) => {
        const g = __game, c = g.story.current;
        c.restoreCheckpoint(point, data);
        for (let t = 0; t < 30 && c.squirrel.mode !== mode; t++) await new Promise((r) => setTimeout(r, 100));
        await new Promise((r) => setTimeout(r, 150));
        const spec = { tangle1: __sq.TANGLE_PERCHES[0], swing: __sq.SWING_PERCH, tangle2: __sq.TANGLE_PERCHES[1], tangle3: innerWidth >= innerHeight ? __sq.TANGLE_3_WIDE : __sq.TANGLE_PERCHES[2],
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
        /** Pixels that differ with it drawn and without, the world held still between the two, as many samples as the game draws with (leaf cards cover by them). */
        const showing = () => {
          const R = g.renderer, size = R.getDrawingBufferSize(cam.position.clone()), w = size.x, h = size.y;
          const target = new g.post.sceneTarget.constructor(w, h, { samples: g.post.samples }), a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4);
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

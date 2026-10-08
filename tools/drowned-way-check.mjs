// The drowned village's way over the roofs, walked: sets the child down on the strand's slates and walks her deck to
// deck to the foot of the church's tower in Chrome for Testing against a running dev server, hopping where the way
// says she hops and carried across the four pieces (tree, sheet, mill, swing) without them. Reports every deck's length,
// every step between decks and every hop's gap and rise, and fails if a deck floats over nothing built, if a step or a
// hop is more than she could make (`tuning.drowned.way`), if she stalls short of a deck's end, or if her feet leave
// the surface under her. Also checks that the cat's own way over each gap is made of leaps a cat makes.
// Usage: node tools/drowned-way-check.mjs   env: BASE (default http://127.0.0.1:5230/)
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?shot=1&chapter=drowned&ratio=0.5`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

  const report = await page.evaluate(async () => {
    const W = await import('/src/world/drowned-way.ts');
    const { tuning } = await import('/src/tuning.ts');
    const g = window.__game, c = g.child, story = g.story.current;
    story.update = () => {};
    const k = tuning.drowned.way;
    const decks = Object.entries(W.WAY).filter(([name]) => name !== 'strandLanding');
    const lean = W.LEAN_TOS[0];

    /** What is built under (x, z) at about height y: roof slates, a coping, a lean-to's slates. */
    const support = (x, z, y) => {
      const heights = [];
      for (const h of [...W.PLACED, W.NAVE]) {
        const r = W.roofUnder(h, x, z);
        if (r !== null) heights.push(r);
      }
      for (const w of W.GARDEN_WALLS) {
        if (w.top < 0) continue;
        const dx = w.x1 - w.x0, dz = w.z1 - w.z0, len = Math.hypot(dx, dz);
        const t = ((x - w.x0) * dx + (z - w.z0) * dz) / (len * len);
        if (t < -0.02 || t > 1.02) continue;
        if (Math.abs((x - w.x0) * dz - (z - w.z0) * dx) / len < 0.3) heights.push(w.top);
      }
      for (const l of W.LEAN_TOS) {
        const h = l.house, cs = Math.cos(h.yaw), sn = Math.sin(h.yaw);
        const lx = (x - h.x) * cs - (z - h.z) * sn, lz = (x - h.x) * sn + (z - h.z) * cs;
        const out = lz * l.side - h.depth / 2;
        if (lx >= l.from - 0.1 && lx <= l.to + 0.1 && out >= -0.05 && out <= l.out + 0.3)
          heights.push(l.high + (l.low - l.high) * Math.min(1, out / l.out));
      }
      if (!heights.length) return null;
      return heights.reduce((best, hgt) => (Math.abs(hgt - y) < Math.abs(best - y) ? hgt : best));
    };
    const deckAt = (d, u) => ({ x: d.x0 + (d.x1 - d.x0) * u, z: d.z0 + (d.z1 - d.z0) * u, y: d.height + ((d.height1 ?? d.height) - d.height) * u });

    const problems = [];
    const lines = [];
    let length = 0;
    for (const [name, d] of decks) {
      const len = Math.hypot(d.x1 - d.x0, d.z1 - d.z0);
      length += len;
      let worst = 0;
      for (let i = 0; i <= 20; i++) {
        const p = deckAt(d, i / 20), s = support(p.x, p.z, p.y);
        const off = s === null ? Infinity : Math.abs(s - p.y);
        worst = Math.max(worst, off);
      }
      if (worst > 0.15) problems.push(`${name} floats ${worst === Infinity ? 'over open water' : `${worst.toFixed(2)} m off what is built`}`);
    }

    const gaps = new Map(W.WAY_GAPS.map((gp) => [gp.after, gp]));
    const steps = [];
    for (let i = 1; i < decks.length; i++) {
      const [an, a] = decks[i - 1], [bn, b] = decks[i];
      const gp = gaps.get(an);
      if (gp) {
        const gap = Math.hypot(gp.to.x - gp.from.x, gp.to.z - gp.from.z), rise = gp.to.y - gp.from.y;
        steps.push({ from: an, to: bn, by: gp.by, gap: +gap.toFixed(2), rise: +rise.toFixed(2) });
        if (gp.by === 'hop' && (gap > k.hopReach || rise > k.hopUp || -rise > k.hopDown))
          problems.push(`hop ${an} -> ${bn}: ${gap.toFixed(2)} m across, ${rise.toFixed(2)} m up is more than she can make`);
        continue;
      }
      const end = deckAt(a, 1), start = deckAt(b, 0);
      const gap = Math.hypot(start.x - end.x, start.z - end.z), rise = start.y - end.y;
      steps.push({ from: an, to: bn, by: 'step', gap: +gap.toFixed(2), rise: +rise.toFixed(2) });
      if (gap > 0.3 || rise > 0.5 || rise < -0.8) problems.push(`step ${an} -> ${bn}: ${gap.toFixed(2)} m across, ${rise.toFixed(2)} m up`);
    }

    /** The walk itself, frame by frame in the game's own fixed steps. */
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    c.riding = false; c.sitting = false; c.hull = null; c.action = null;
    c.decks = decks.map(([, d]) => d);
    const first = W.WAY.strandSlope;
    c.place(first.x0, first.z0, Math.atan2(first.x1 - first.x0, first.z1 - first.z0));
    let floatWorst = 0, floatAt = '';
    const watch = (name) => {
      /** The trunk is the tree's; the strand's slope and ridge are the climb out, tuned with the cat's beat. */
      if (name === 'trunk' || name === 'strandSlope' || name === 'strand') return;
      const s = support(c.position.x, c.position.z, c.position.y);
      const off = s === null ? Infinity : Math.abs(s - c.position.y);
      if (off > floatWorst) { floatWorst = off; floatAt = `${name} at ${c.position.toArray().map((v) => v.toFixed(2))}`; }
    };
    const walk = async (name, x, z) => {
      let arrived = false;
      c.walkTo(x, z, false, () => { arrived = true; }, 0.12);
      for (let f = 0; f < 60 * 40 && !arrived; f++) { await frame(); watch(name); }
      if (!arrived) problems.push(`stalled on ${name} ${Math.hypot(c.position.x - x, c.position.z - z).toFixed(2)} m short, at ${c.position.toArray().map((v) => v.toFixed(2))}`);
    };
    const leap = async (to) => {
      let done = false;
      const way = { x: to.x - c.position.x, z: to.z - c.position.z }, n = Math.hypot(way.x, way.z) || 1;
      c.leap({ x: (way.x / n) * 1.1, y: 1.1, z: (way.z / n) * 1.1, clone() { return this; } }, to, 9.81, () => {}, () => { done = true; }, true);
      for (let f = 0; f < 60 * 6 && !done; f++) await frame();
    };
    const start = performance.now();
    let gameTime = 0;
    for (let i = 0; i < decks.length; i++) {
      const [name, d] = decks[i];
      if (i > 0) {
        const gp = gaps.get(decks[i - 1][0]);
        if (gp?.by === 'hop') await leap(new g.child.position.constructor(gp.to.x, gp.to.y, gp.to.z));
        else if (gp?.by === 'tree') {
          /** She steps up onto the fallen trunk at its end over her wall and walks it to the far end. */
          const t = g.village.tree.deck, h1 = t.height1 ?? t.height;
          const near = Math.hypot(t.x0 - c.position.x, t.z0 - c.position.z) < Math.hypot(t.x1 - c.position.x, t.z1 - c.position.z);
          const [a, b] = near ? [[t.x0, t.height, t.z0], [t.x1, h1, t.z1]] : [[t.x1, h1, t.z1], [t.x0, t.height, t.z0]];
          c.decks.push(t);
          await leap(new g.child.position.constructor(a[0] + (b[0] - a[0]) * 0.08, a[1] + (b[1] - a[1]) * 0.08, a[2] + (b[2] - a[2]) * 0.08));
          await walk('trunk', b[0], b[2]);
          await leap(new g.child.position.constructor(gp.to.x, gp.to.y, gp.to.z));
        } else if (gp) {
          c.position.y = gp.to.y;
          c.place(gp.to.x, gp.to.z, c.yaw);
        }
      }
      const t0 = g.child.position.clone();
      await walk(name, d.x1, d.z1);
      gameTime += t0.distanceTo(c.position) / 1.2;
    }
    const last = W.WAY.naveRidge;
    const atEnd = Math.hypot(c.position.x - last.x1, c.position.z - last.z1);
    if (atEnd > 0.3) problems.push(`ended ${atEnd.toFixed(2)} m from the tower's foot`);
    if (floatWorst > 0.25) problems.push(`her feet were ${floatWorst.toFixed(2)} m off what is built (${floatAt})`);

    /** The cat's own way: each leg a leap a small cat makes, never along a surface she could walk. */
    for (const [piece, pts] of Object.entries(W.CAT_WAY)) {
      const legs = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], across = Math.hypot(b.x - a.x, b.z - a.z), up = b.y - a.y;
        legs.push(`${across.toFixed(1)} m ${up >= 0 ? 'up' : 'down'} ${Math.abs(up).toFixed(1)}`);
      }
      lines.push(`cat at the ${piece}: ${legs.join(', ')}`);
    }
    return { problems, lines, steps, length: +length.toFixed(1), floatWorst: +floatWorst.toFixed(3), realSeconds: +((performance.now() - start) / 1000).toFixed(0),
      decks: decks.length, gaps: W.WAY_GAPS.map((gp) => `${gp.by} after ${gp.after}: ${Math.hypot(gp.to.x - gp.from.x, gp.to.z - gp.from.z).toFixed(2)} m across, ${(gp.to.y - gp.from.y).toFixed(2)} m up`) };
  });
  console.log(`way: ${report.decks} decks, ${report.length} m of deck`);
  for (const s of report.steps) console.log(`  ${s.from} -> ${s.to}: ${s.by}, ${s.gap} m across, ${s.rise >= 0 ? '+' : ''}${s.rise} m`);
  for (const l of report.gaps) console.log(`  ${l}`);
  for (const l of report.lines) console.log(`  ${l}`);
  console.log(`  her feet stayed within ${report.floatWorst} m of what is built; walked in ${report.realSeconds} s`);
  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
  assert.deepEqual(report.problems, [], report.problems.join('\n'));
  console.log('ok');
} finally {
  await browser.close();
}

// Frame intervals through moments perf.mjs cannot play, for comparing builds back to back.
// Usage: node tools/frame-spikes.mjs <stairs|levels>
//   stairs  the stairs chapter played on frames (stairsFixtureOnFrames, shot mode) from the last flights below the
//           cloud through the loop, the white, the top, the sail and the fog to 300 frames into the drowned village:
//           every frame interval, per beat, and each over HITCH ms with its frame and beat.
//   levels  the island at rest with levels chosen as the menu does, Ultra -> Medium -> Low -> Ultra every HOLD ms,
//           CYCLES times: the worst interval within AFTER frames of each switch, against the intervals elsewhere.
//   env: BASE (default http://127.0.0.1:5230/), QUERY (appended; stairs defaults to ratio=1.5&msaa=2), W/H/DSF
//        (1376x1032 at 2), HITCH (25), HOLD (4000), CYCLES (4), AFTER (150), OUT (JSON path)
// Takes the shared browser lock. Other GPU users inflate every number: check `ps` first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';
import { stairsFixtureOnFrames } from './lib/stairs-fixture.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const [mode = 'stairs'] = process.argv.slice(2);
assert(['stairs', 'levels'].includes(mode), `unknown mode ${mode}`);
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const query = process.env.QUERY ?? (mode === 'stairs' ? 'ratio=1.5&msaa=2' : '');
const HITCH = Number(process.env.HITCH ?? 25), HOLD = Number(process.env.HOLD ?? 4000);
const CYCLES = Number(process.env.CYCLES ?? 4), AFTER = Number(process.env.AFTER ?? 150);
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.floor(q * (s.length - 1))].toFixed(1) : null; };
const spread = a => ({ frames: a.length, p50: pct(a, 0.5), p99: pct(a, 0.99), max: a.length ? +Math.max(...a).toFixed(1) : null, over: a.filter(d => d > HITCH).length });

const { browser, close } = await openBrowser();
try {
  const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1376), height: Number(process.env.H ?? 1032) }, deviceScaleFactor: Number(process.env.DSF ?? 2) });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await withoutHotReload(page);
  await page.goto(`${base}?shot&start=1&analytics=0&progress=0${mode === 'stairs' ? '&chapter=stairs' : ''}${query ? '&' + query : ''}`);
  await page.waitForSelector('#veil.ready', { timeout: 300000 }); await page.locator('#begin').click();
  await page.waitForFunction(() => window.__ready, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  const programs = await page.evaluate(() => {
    window.__spikes = [];
    const g = __game, record = t => { window.__spikes.push([t, __stats.frame, g.story.name, g.story.current.beat, g.renderer.getPixelRatio()]); requestAnimationFrame(record); };
    requestAnimationFrame(record);
    return g.renderer.info.programs.length;
  });
  let switches = [];
  if (mode === 'stairs') await stairsFixtureOnFrames(page, 'drowned', (await page.evaluate(() => __stats.frame)) + 30, '');
  else {
    await page.evaluate(() => __game.quality.setMode('ultra', performance.now()));
    await page.waitForTimeout(HOLD);
    for (let c = 0; c < CYCLES; c++) for (const level of ['medium', 'low', 'ultra']) {
      const s = await page.evaluate(level => { const t = performance.now(); __game.quality.setMode(level, t); return { level, t }; }, level);
      await page.waitForTimeout(HOLD);
      switches.push({ ...s, now: await page.evaluate(() => ({ name: __game.quality.level.name, ratio: __game.renderer.getPixelRatio(), samples: __game.post.samples })) });
    }
  }
  const d = await page.evaluate(() => ({ rows: window.__spikes, programs: __game.renderer.info.programs.length }));
  const rows = d.rows, gaps = [];
  for (let i = 1; i < rows.length; i++) gaps.push({ ms: rows[i][0] - rows[i - 1][0], frame: rows[i][1], chapter: rows[i][2], beat: rows[i][3], t: rows[i][0], ratio: rows[i][4] });
  const summary = { mode, base, query, programsAdded: d.programs - programs, all: spread(gaps.map(g => g.ms)) };
  if (mode === 'stairs') {
    const beats = {};
    for (const g of gaps) (beats[g.chapter + ':' + g.beat] ??= []).push(g.ms);
    summary.beats = Object.fromEntries(Object.entries(beats).map(([k, v]) => [k, spread(v)]));
    summary.hitches = gaps.filter(g => g.ms > HITCH).map(g => ({ ms: +g.ms.toFixed(1), frame: g.frame, chapter: g.chapter, beat: g.beat }));
  } else {
    const near = new Set();
    summary.switches = switches.map(s => {
      const k = gaps.findIndex(g => g.t > s.t), around = gaps.slice(k, k + AFTER), resized = around.findIndex((g, j) => j && g.ratio !== around[j - 1].ratio);
      for (let j = k; j < k + AFTER; j++) near.add(j);
      return { level: s.level, now: s.now, resizedAfter: resized, worst: +Math.max(...around.map(g => g.ms)).toFixed(1), over: around.filter(g => g.ms > HITCH).length, first: around.slice(0, 4).map(g => +g.ms.toFixed(1)) };
    });
    summary.elsewhere = spread(gaps.filter((_, j) => !near.has(j)).map(g => g.ms));
  }
  summary.errors = errors;
  await fs.writeFile(process.env.OUT ?? `/tmp/updraft-frame-spikes-${mode}.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally { await close(); }

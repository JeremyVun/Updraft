// Frame gaps at world-window moves while travelling, for comparing two builds back to back.
// Usage: node tools/window-hitch.mjs <meadow|boats|bench> [seconds]
//   meadow  the Meadow walk as the story plays it (the child throws the plane and follows it);
//   boats   the little-boats room sailed with real pointer strokes, then the crossing that follows;
//   bench   loop paused: forced window moves, then the height, light and shore bakes alone, each timed from
//           submission to GPU completion.
//   env: BASE (default http://127.0.0.1:5230/), W/H viewport (1600x900), WARMUP (ms after ready, 1500),
//        AFTER (frames after the move's own frame counted as its gaps, default 5), OUT (JSON path)
// Takes the shared browser lock. Other GPU users inflate every number: check `ps` first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';

const [fixture = 'meadow', secsArg = '90'] = process.argv.slice(2);
assert(['meadow', 'boats', 'bench'].includes(fixture), `unknown fixture ${fixture}`);
const secs = Number(secsArg);
const width = Number(process.env.W ?? 1600), height = Number(process.env.H ?? 900);
const after = Number(process.env.AFTER ?? 5);
const chapter = fixture === 'boats' ? 'boats' : 'meadow';

const { browser, close } = await openBrowser();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__frames = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { window.__frames.push(t); cb(t); });
  });
  if (fixture === 'bench') await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    let source = await response.text();
    const hook = 'function frame(now) {';
    assert(source.includes(hook));
    source = source.replace(hook, hook + ' if(window.__hitchPaused){requestAnimationFrame(frame);return;}');
    source += '\nwindow.__hitchBakes={bakes,water};';
    await route.fulfill({ response, body: source });
  });
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=${chapter}&analytics=0&progress=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(Number(process.env.WARMUP ?? 1500));
  await page.evaluate(async () => {
    const { WINDOW, onWindowMove } = await import('/src/world/window.ts');
    window.__moves = [];
    onWindowMove(() => window.__moves.push([performance.now(), WINDOW.minX, WINDOW.minZ]));
    window.__programs = __game.renderer.info.programs.length;
    window.__frames = [];
  });

  let bench = null;
  if (fixture === 'bench') {
    bench = await page.evaluate(async (count) => {
      window.__hitchPaused = true;
      const { renderer, child } = __game, gl = renderer.getContext();
      // Fence status only changes between tasks; a message is the shortest yield.
      const channel = new MessageChannel();
      const yieldTask = () => new Promise((r) => { channel.port1.onmessage = r; channel.port2.postMessage(0); });
      const { followWindow } = await import('/src/world/window.ts');
      const idle = async () => {
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const started = performance.now();
        for (;;) {
          const s = gl.clientWaitSync(fence, 0, 0);
          if (s === gl.ALREADY_SIGNALED || s === gl.CONDITION_SATISFIED) break;
          await yieldTask();
        }
        gl.deleteSync(fence);
        return performance.now() - started;
      };
      const x = child.position.x, z = child.position.z, times = { moves: [] };
      for (let i = 0; i < count; i++) {
        await idle();
        const started = performance.now();
        followWindow(x + (i % 2 ? 40 : 0), z + (i % 4 < 2 ? 0 : 40), true);
        const cpu = performance.now() - started;
        await idle();
        times.moves.push({ cpu, total: performance.now() - started });
      }
      // Each stage of a move alone; the two-pass build has an intermediate target and a normals pass.
      const { bakes, water } = window.__hitchBakes, { WINDOW } = await import('/src/world/window.ts');
      const stages = {
        height: () => {
          if (bakes.normalMat) { bakes.gpu.run(bakes.heightMat, bakes.heights); bakes.gpu.run(bakes.normalMat, bakes.height); }
          else bakes.gpu.run(bakes.heightMat, bakes.height);
        },
        light: () => bakes.gpu.run(bakes.groundMat, bakes.ground),
        shore: () => water.bakeShore(WINDOW.size),
      };
      for (const [name, run] of Object.entries(stages)) {
        const each = [];
        for (let i = 0; i < count; i++) {
          await idle();
          const started = performance.now();
          run();
          await idle();
          each.push(performance.now() - started);
        }
        times[name] = each;
      }
      window.__hitchPaused = false;
      return times;
    }, Math.max(8, Math.round(secs)));
  } else if (fixture === 'meadow') {
    await page.waitForTimeout(secs * 1000);
  } else {
    const end = Date.now() + secs * 1000;
    await page.waitForFunction(() => __game.story.current.beat === 'sailing', null, { timeout: 60000 });
    while (Date.now() < end) {
      const state = await page.evaluate(() => {
        const g = __game, r = g.littleBoats;
        const p = (g.story.name === 'boats' ? r.invitation : g.boat.position).clone().project(g.rig.camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, room: g.story.name === 'boats' };
      });
      const cx = state.x * width, cy = state.y * height;
      for (let i = 0; i <= 30; i++) {
        const x = Math.max(4, Math.min(width - 4, cx + (i / 30 - 0.5) * 200));
        const y = Math.max(4, Math.min(height - 4, cy + Math.sin((i / 30) * Math.PI) * 6));
        await page.mouse.move(x, y);
        await page.waitForTimeout(16);
      }
      await page.mouse.move(width - 3, height - 3);
      await page.waitForTimeout(220);
    }
  }

  const d = await page.evaluate(() => ({ frames: window.__frames, moves: window.__moves, programsBefore: window.__programs,
    programsAfter: __game.renderer.info.programs.length, chapter: __game.story.name }));
  const f = d.frames, dts = [];
  for (let i = 1; i < f.length; i++) dts.push(f[i] - f[i - 1]);
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(q * (s.length - 1))] : NaN; };
  const near = new Set();
  const moves = fixture === 'bench' ? [] : d.moves.map(([t, minX, minZ]) => {
    let k = 0;
    while (k + 1 < f.length && f[k + 1] <= t) k++;
    const gaps = dts.slice(k, k + after + 1);
    for (let j = k; j < Math.min(dts.length, k + after + 1); j++) near.add(j);
    return { at: +((t - f[0]) / 1000).toFixed(2), window: [minX, minZ], worst: +Math.max(...gaps).toFixed(1), gaps: gaps.map((g) => +g.toFixed(1)) };
  });
  const nearGaps = [...near].map((j) => dts[j]), otherGaps = dts.filter((_, j) => !near.has(j));
  const summary = {
    fixture, secs, chapterAtEnd: d.chapter, frames: dts.length, moves: fixture === 'bench' ? d.moves.length : moves.length,
    newPrograms: d.programsAfter - d.programsBefore,
    all: { p50: pct(dts, 0.5), p99: pct(dts, 0.99), max: Math.max(...dts) },
    atMoves: moves.length ? { worst: Math.max(...moves.map((m) => m.worst)), medianWorst: pct(moves.map((m) => m.worst), 0.5), p99: pct(nearGaps, 0.99), p90: pct(nearGaps, 0.9) } : null,
    elsewhere: { p99: pct(otherGaps, 0.99), max: Math.max(...otherGaps) },
    bench: bench && {
      move: { cpuMedian: pct(bench.moves.map((b) => b.cpu), 0.5), median: pct(bench.moves.map((b) => b.total), 0.5), min: Math.min(...bench.moves.map((b) => b.total)), max: Math.max(...bench.moves.map((b) => b.total)) },
      ...Object.fromEntries(['height', 'light', 'shore'].map((k) => [k, { median: pct(bench[k], 0.5), min: Math.min(...bench[k]), max: Math.max(...bench[k]) }])),
    },
  };
  const round = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
  await fs.writeFile(process.env.OUT ?? `/tmp/updraft-window-hitch-${fixture}.json`, JSON.stringify(round({ summary, moves, bench, errors }), null, 2));
  console.log(JSON.stringify(round(summary)));
  for (const m of moves) console.log(JSON.stringify(m));
  if (errors.length) console.log('errors:', errors.slice(0, 3).join(' | '));
} finally {
  await close();
}

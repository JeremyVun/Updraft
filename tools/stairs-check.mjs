// Plays the stairs in the clouds with real pointer gestures: brings each loose flight home, follows the climb into
// the cloud, the top landing, boarding and the sail over the cloud until the boat is down on the drowned village's
// water. Captures stills at each beat.
// Usage: node tools/stairs-check.mjs <out-prefix>   env: BASE (default http://127.0.0.1:5230/), W/H, QUERY
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const LOCK = '/tmp/updraft-chromium.lock';
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function acquireLock() {
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      fs.writeFileSync(`${LOCK}/pid`, String(process.pid));
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let holder = 0;
      try { holder = Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) || 0; } catch {}
      if (holder && !alive(holder)) fs.rmSync(LOCK, { recursive: true, force: true });
      else await new Promise((r) => setTimeout(r, 400));
    }
  }
}
const releaseLock = () => {
  try { if (Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) === process.pid) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {}
};
process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(130));

const prefix = process.argv[2] ?? '/tmp/updraft-stairs';
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600);
const height = Number(process.env.H ?? 900);

await acquireLock();
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const errors = [];
const log = (...a) => console.log(...a);
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&chapter=stairs${process.env.QUERY ? '&' + process.env.QUERY : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const shot = async (name) => { await page.screenshot({ path: `${prefix}-${name}.png` }); log(`${prefix}-${name}.png`); };
  const state = () => page.evaluate(() => {
    const g = window.__game;
    const s = g.story.current;
    return { chapter: g.story.name, beat: s.beat, docked: g.cloudStairs.docked, child: g.child.position.toArray().map((v) => +v.toFixed(2)),
      bird: g.cygnet.position.toArray().map((v) => +v.toFixed(2)), boat: g.boat.position.toArray().map((v) => +v.toFixed(2)) };
  });
  const until = async (test, ms, every = 500) => {
    const end = Date.now() + ms;
    for (;;) {
      const s = await state();
      if (test(s)) return s;
      if (Date.now() > end) return s;
      await page.waitForTimeout(every);
    }
  };
  const swipe = async (from, to, ms = 420) => {
    const n = Math.max(2, Math.round(ms / 8));
    await page.mouse.move(from[0], from[1]);
    for (let i = 1; i <= n; i++) {
      await page.mouse.move(from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n);
      await page.waitForTimeout(ms / n);
    }
  };
  /** Where the waiting flight is on screen now, and where its gold drawing is, both at the flight's own level. */
  const aim = (n) => page.evaluate(([w, h, n]) => {
    const g = window.__game;
    const piece = g.cloudStairs.pieces[n];
    if (!piece || piece.docked) return null;
    const cam = g.rig.camera;
    const scr = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * w, (0.5 - p.y * 0.5) * h]; };
    const f = piece.flight;
    const home = f.bottom.clone().lerp(f.landing, 0.5);
    const now = g.cloudStairs.pointOn(piece, home.clone(), home.clone());
    return { at: scr(now), to: scr(home), far: +now.distanceTo(home).toFixed(2), settling: piece.settling,
      turn: +piece.offset.y.toFixed(2), off: [+piece.offset.x.toFixed(2), +piece.offset.z.toFixed(2)] };
  }, [width, height, n]);

  // Every change of beat, with the time, so a skipped or hurried beat shows up in the log.
  await page.evaluate(() => {
    window.__beats = [];
    let last = '';
    setInterval(() => {
      const s = window.__game.story;
      const now = `${s.name}:${s.current.beat}`;
      if (now !== last) window.__beats.push(`${(performance.now() / 1000).toFixed(1)} ${now}`);
      last = now;
    }, 100);
  });
  await page.waitForTimeout(2500);
  await shot('01-arrive');
  const first = Number(process.env.FROM ?? 0);
  if (first) await page.evaluate((n) => window.__game.story.current.restoreCheckpoint(`flight-${n}`, [n]), first);
  let s = await until((x) => x.beat === 'climb', 20000);
  await page.waitForTimeout(3000);
  await shot('02-climb');
  const last = Number(process.env.UNTIL ?? 3);
  for (let n = first; n < last; n++) {
    s = await until((x) => x.beat === 'waiting', 60000);
    log('waiting', JSON.stringify(s));
    await page.waitForTimeout(1500);
    await shot(`03-wait-${n + 1}`);
    let strokes = 0;
    for (; strokes < 60; strokes++) {
      const a = await aim(n);
      if (!a || a.settling > 0) break;
      if (strokes % 5 === 0) log('  stroke', strokes, JSON.stringify({ off: a.off, turn: a.turn }));
      // Take hold of it where it is and draw it over its gold drawing, the way you would by hand.
      const dx = a.to[0] - a.at[0], dy = a.to[1] - a.at[1];
      const len = Math.hypot(dx, dy) || 1;
      await swipe([a.at[0] - dx / len * 30, a.at[1] - dy / len * 30], a.to, 500 + Math.min(900, len * 2.5));
      await page.waitForTimeout(700);
      if (strokes === 1) await shot(`04-push-${n + 1}`);
    }
    log('strokes', strokes);
    if (process.env.TRACE) {
      for (let i = 0; i < 16; i++) {
        log('  trace', await page.evaluate(() => window.__game.cloudStairs.pieces.map((p) => [p.docked ? 'D' : p.settling > 0 ? 'S' : '-',
          p.offset.x.toFixed(2), p.offset.z.toFixed(2), p.offset.y.toFixed(2), p.velocity.x.toFixed(2), p.velocity.z.toFixed(2), p.handled.toFixed(1)].join(',')).join(' | ')));
        await page.waitForTimeout(250);
      }
    }
    s = await until((x) => x.docked > n, 8000);
    log('docked', JSON.stringify(s));
    await page.waitForTimeout(900);
    await shot(`05-docked-${n + 1}`);
  }
  s = await until((x) => x.beat === 'hesitate', 60000, 100);
  await page.waitForTimeout(1800);
  await shot('06-hesitate');
  s = await until((x) => x.beat === 'birdFirst', 20000, 100);
  await page.waitForTimeout(7000);
  await shot('07-bird-first');
  s = await until((x) => x.beat === 'follow', 30000, 100);
  await page.waitForTimeout(4500);
  await shot('08-in-cloud');
  s = await until((x) => x.beat === 'loop', 60000, 100);
  for (let i = 1; i <= 12; i++) {
    await page.waitForTimeout(1500);
    const now = await state();
    if (now.beat !== 'loop') break;
    await shot(`08-ring-${String(i).padStart(2, '0')}`);
  }
  s = await until((x) => x.beat === 'emerge', 90000, 100);
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(900);
    await shot(`09-emerge-${i}`);
  }
  s = await until((x) => x.beat === 'nest', 40000, 100);
  await page.waitForTimeout(3500);
  await shot('10-nest');
  s = await until((x) => x.beat === 'skein', 40000, 100);
  await page.waitForTimeout(5000);
  await shot('11-skein');
  s = await until((x) => x.beat === 'sail', 60000);
  await page.waitForTimeout(2000);
  await shot('12-aboard');
  for (let i = 0; i < 180; i++) {
    s = await state();
    if (s.beat !== 'sail') break;
    // Sweep across the sail, toward the way they are going.
    const at = await page.evaluate(([w, h]) => {
      const g = window.__game;
      const p = g.boat.position.clone(); p.y += 1.5;
      const q = p.clone().project(g.rig.camera);
      return [(q.x * 0.5 + 0.5) * w, (0.5 - q.y * 0.5) * h];
    }, [width, height]);
    await swipe([at[0] - 60, at[1] + 140], [at[0] + 20, at[1] - 160], 380);
    await page.waitForTimeout(400);
    if (i % 8 === 4) await shot(`13-sail-${String(i).padStart(2, '0')}`);
  }
  s = await until((x) => x.beat === 'fog' || x.chapter !== 'stairs', 90000);
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(1200);
    await shot(`14-fog-${i}`);
    log('  fog', await page.evaluate(() => {
      const g = window.__game, s = g.story.current, u = g.cloudStairs.cloud.top.material.uniforms;
      const r = (v) => v.toArray().map((x) => +x.toFixed(2));
      return JSON.stringify({ beat: `${g.story.name}:${s.beat}`, deck: r(u.uCloudDeck.value), deckY: r(u.uCloudDeckY.value), bubble: r(u.uCloudBubble.value),
        cam: r(g.rig.camera.position), boat: r(g.boat.position) });
    }));
  }
  s = await until((x) => x.chapter !== 'stairs', 60000);
  log('after', JSON.stringify(s));
  await page.waitForTimeout(4000);
  await shot('15-village');
  await page.waitForTimeout(8000);
  await shot('16-village-clear');
  log('beats:\n' + (await page.evaluate(() => window.__beats.join('\n'))));
} finally {
  await browser.close();
  if (errors.length) log('errors:\n' + [...new Set(errors)].slice(0, 6).join('\n'));
}

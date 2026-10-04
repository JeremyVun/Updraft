// Plays the stairs in the clouds with real pointer gestures: brings each loose flight home, follows the climb into
// the cloud, the top landing, boarding and the sail over the cloud into the bank of mist, until the boat has sailed
// out of it onto the drowned village's water. Captures stills at each beat.
// Usage: node tools/stairs-check.mjs <out-prefix>   env: BASE (default http://127.0.0.1:5230/), W/H, QUERY
// NOSHOTS=1 skips the stills (a timed run); each beat is logged with wall and game seconds.
// Exits 1 if a beat is never reached or the page reports an error.
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
  channel: 'chromium',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const errors = [];
const misses = [];
const log = (...a) => console.log(...a);
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?shot=1&chapter=stairs${process.env.QUERY ? '&' + process.env.QUERY : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const shot = async (name) => { if (process.env.NOSHOTS === '1') return; await page.screenshot({ path: `${prefix}-${name}.png` }); log(`${prefix}-${name}.png`); };
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
      if (Date.now() > end) { misses.push(`${test} after ${ms / 1000} s at ${JSON.stringify(s)}`); return s; }
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
      if (now !== last) window.__beats.push(`${(performance.now() / 1000).toFixed(1)} game ${(window.__stats?.time ?? 0).toFixed(1)} ${now}`);
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
  // Watch the bird go round the loop, and once the sweep is drawn over the cloud on its far corner, blow it off.
  for (let i = 1; i <= 60; i++) {
    await page.waitForTimeout(1500);
    const now = await state();
    if (now.beat !== 'loop') break;
    if (i <= 24) await shot(`08-loop-${String(i).padStart(2, '0')}`);
    const bank = await page.evaluate(([w, h]) => {
      const g = window.__game;
      const hint = g.story.current.windInvitation;
      if (!hint) return null;
      const p = hint.clone().project(g.rig.camera);
      return [(p.x * 0.5 + 0.5) * w, (0.5 - p.y * 0.5) * h];
    }, [width, height]);
    if (bank) {
      log('  blowing the bank', i, JSON.stringify(bank));
      await swipe([bank[0] - 160, bank[1] + 40], [bank[0] + 180, bank[1] - 30], 450);
    }
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
  // Over the cloud: push the boat along with sweeps through the hull the way it is going, and shoot each framing
  // of the lens's way round it as the boat comes to it (by how far it has come), then the bank, the white, the
  // swap onto the sea and the white thinning off the water.
  const sweep = async () => {
    const at = await page.evaluate(([w, h]) => {
      const g = window.__game, b = g.boat, cam = g.rig.camera;
      const scr = (v) => { const q = v.clone().project(cam); return [(q.x * 0.5 + 0.5) * w, (0.5 - q.y * 0.5) * h]; };
      const f = { x: Math.sin(b.yaw), y: 0, z: Math.cos(b.yaw) };
      const p = b.position.clone(); p.y += 0.3;
      return { at: scr(p), back: scr(p.clone().addScaledVector(f, -3)), fore: scr(p.clone().addScaledVector(f, 4)) };
    }, [width, height]);
    let a = at.back, z = at.fore;
    if (Math.hypot(z[0] - a[0], z[1] - a[1]) < 120) { a = [at.at[0] - 180, at.at[1] + 30]; z = [at.at[0] + 180, at.at[1] - 30]; }
    const inside = (q) => [Math.min(Math.max(q[0], 20), width - 20), Math.min(Math.max(q[1], 20), height - 20)];
    await swipe(inside(a), inside(z), 380);
  };
  const voyage = () => page.evaluate(() => {
    const g = window.__game, s = g.story.current, f = g.cloudStairs.cloud.fog, b = g.boat;
    return { chapter: g.story.name, beat: s.beat, t: +(s.now - s.beatStart).toFixed(1), sailed: Math.round(s.sailed ?? 0),
      depth: +f.depthOf(b.position.x, b.position.z).toFixed(1), speed: +b.speed.toFixed(1) };
  });
  const moments = [[8, 'leaving'], [30, 'stair-behind'], [75, 'faces'], [135, 'rising'], [190, 'wide'], [228, 'descent'], [262, 'bank-looms']];
  let v = await voyage();
  for (let i = 0; i < 400 && v.beat === 'sail'; i++) {
    await sweep();
    await page.waitForTimeout(250);
    v = await voyage();
    while (moments.length && v.sailed >= moments[0][0]) {
      const [, name] = moments.shift();
      await shot(`13-sail-${name}`);
      log('  sail', JSON.stringify(v));
    }
  }
  s = await until((x) => x.beat === 'fog' || x.chapter !== 'stairs', 90000);
  let taken = 0;
  for (let i = 0; i < 200; i++) {
    v = await voyage();
    if (v.chapter !== 'stairs' || v.beat === 'down') break;
    if (v.beat === 'fog') await sweep(); else await page.waitForTimeout(300);
    if (i % 3 === 0) {
      await shot(`14-${v.beat}-${String(taken++).padStart(2, '0')}`);
      log('  fog', JSON.stringify(v), await page.evaluate(() => {
        const u = window.__game.cloudStairs.cloud.top.material.uniforms;
        const r = (x) => x.toArray().map((y) => +y.toFixed(2));
        return JSON.stringify({ deckY: r(u.uCloudDeckY.value), bubble: r(u.uCloudBubble.value), bank: r(u.uFogBankShape.value), light: r(u.uFogBankLight.value),
          cam: r(window.__game.rig.camera.position), boat: r(window.__game.boat.position) });
      }));
    }
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
  if (misses.length) log('never reached:\n' + misses.join('\n'));
}
if (errors.length || misses.length) process.exit(1);
log('stairs-check passed');

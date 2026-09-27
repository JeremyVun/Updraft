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
  /** Where the waiting flight's two ends are on screen now, and where they belong. */
  const aim = () => page.evaluate(([w, h]) => {
    const g = window.__game;
    const piece = g.cloudStairs.waiting;
    if (!piece) return null;
    const cam = g.rig.camera;
    const scr = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * w, (0.5 - p.y * 0.5) * h]; };
    const f = piece.flight;
    const bottomNow = g.cloudStairs.pointOn(piece, f.bottom.clone(), f.bottom.clone());
    const topNow = g.cloudStairs.pointOn(piece, f.landing.clone(), f.landing.clone());
    return { bottomNow: scr(bottomNow), topNow: scr(topNow), bottom: scr(f.bottom.clone()), top: scr(f.landing.clone()),
      turned: piece.offset.y, gap: Math.hypot(bottomNow.x - f.bottom.x, bottomNow.z - f.bottom.z), settling: piece.settling };
  }, [width, height]);

  await page.waitForTimeout(2500);
  await shot('01-arrive');
  let s = await until((x) => x.beat === 'climb', 20000);
  await page.waitForTimeout(3000);
  await shot('02-climb');
  for (let n = 0; n < 3; n++) {
    s = await until((x) => x.beat === 'waiting', 60000);
    log('waiting', JSON.stringify(s));
    await page.waitForTimeout(1500);
    await shot(`03-wait-${n + 1}`);
    let strokes = 0;
    for (; strokes < 60; strokes++) {
      const a = await aim();
      if (!a || a.settling > 0) break;
      // Push whichever end is further from home, along the way it needs to go.
      const eb = [a.bottom[0] - a.bottomNow[0], a.bottom[1] - a.bottomNow[1]];
      const et = [a.top[0] - a.topNow[0], a.top[1] - a.topNow[1]];
      const useTop = Math.hypot(...et) > Math.hypot(...eb);
      const at = useTop ? a.topNow : a.bottomNow;
      const e = useTop ? et : eb;
      const len = Math.hypot(...e) || 1;
      const d = [e[0] / len, e[1] / len];
      const reach = Math.min(160, 40 + len * 0.6);
      await swipe([at[0] - d[0] * 60, at[1] - d[1] * 60], [at[0] + d[0] * reach, at[1] + d[1] * reach], 260 + Math.min(300, len));
      await page.waitForTimeout(650);
      if (strokes === 4) await shot(`04-push-${n + 1}`);
    }
    log('strokes', strokes);
    s = await until((x) => x.docked > n, 8000);
    log('docked', JSON.stringify(s));
    await page.waitForTimeout(900);
    await shot(`05-docked-${n + 1}`);
  }
  s = await until((x) => x.beat === 'hesitate', 60000);
  await page.waitForTimeout(2200);
  await shot('06-hesitate');
  s = await until((x) => x.beat === 'birdFirst', 20000);
  await page.waitForTimeout(5000);
  await shot('07-bird-first');
  s = await until((x) => x.beat === 'follow', 30000);
  await page.waitForTimeout(6000);
  await shot('08-in-cloud');
  s = await until((x) => x.beat === 'emerge', 90000);
  await page.waitForTimeout(3000);
  await shot('09-emerge');
  s = await until((x) => x.beat === 'nest', 40000);
  await page.waitForTimeout(4000);
  await shot('10-nest');
  s = await until((x) => x.beat === 'skein', 40000);
  await page.waitForTimeout(4000);
  await shot('11-skein');
  s = await until((x) => x.beat === 'sail', 60000);
  await page.waitForTimeout(2000);
  await shot('12-aboard');
  for (let i = 0; i < 80; i++) {
    s = await state();
    if (s.beat !== 'sail') break;
    await swipe([width * 0.3, height * 0.55], [width * 0.7, height * 0.45], 380);
    await page.waitForTimeout(400);
    if (i === 10) await shot('13-sail');
  }
  s = await until((x) => x.beat === 'descend' || x.chapter !== 'stairs', 60000);
  await page.waitForTimeout(3500);
  await shot('14-descend');
  s = await until((x) => x.chapter !== 'stairs', 60000);
  log('after', JSON.stringify(s));
  await page.waitForTimeout(4000);
  await shot('15-village');
  await page.waitForTimeout(8000);
  await shot('16-village-clear');
} finally {
  await browser.close();
  if (errors.length) log('errors:\n' + [...new Set(errors)].slice(0, 6).join('\n'));
}

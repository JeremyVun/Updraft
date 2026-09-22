// Complete the little-boats room with real mouse or touch strokes. Captures under /tmp.
// Usage: node tools/little-boats-check.mjs [prefix]; TOUCH=1 uses a 390x844 touch viewport.
// Inherits the shared browser lock and GPU launch from play.mjs.
// BASE overrides the dev server. Uses the shared /tmp/updraft-chromium.lock.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const LOCK = '/tmp/updraft-chromium.lock';
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function acquireLock() {
  for (;;) {
    try {
      fs.mkdirSync(LOCK);
      fs.writeFileSync(`${LOCK}/pid`, String(process.pid));
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let holder = 0;
      try {
        holder = Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) || 0;
      } catch {}
      let stale = holder ? !alive(holder) : false;
      try {
        if (!holder) stale = Date.now() - fs.statSync(LOCK).mtimeMs > 10000;
      } catch {}
      if (stale) fs.rmSync(LOCK, { recursive: true, force: true });
      else await new Promise((r) => setTimeout(r, 400));
    }
  }
}
function releaseLock() {
  try {
    if (Number(fs.readFileSync(`${LOCK}/pid`, 'utf8')) === process.pid) fs.rmSync(LOCK, { recursive: true, force: true });
  } catch {}
}
process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const prefix = process.argv[2] ?? '/tmp/updraft-little-boats';
const touch = process.env.TOUCH === '1',
  width = touch ? 390 : 1600,
  height = touch ? 844 : 900;
await acquireLock();
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
});
const cdp = await context.newCDPSession(page);
try {
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}?shot=1&chapter=boats`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  await page.evaluate(() => {
    const room = __game.littleBoats, update = room.update.bind(room);
    window.__toyMotion = { maxDeceleration: 0, backwards: 0 };
    room.update = (dt, ...args) => {
      const s = room.toys[0].s, speed = room.toys[0].speed;
      update(dt, ...args);
      if (!room.launched || room.progress < 6 || room.departing || dt <= 0) return;
      __toyMotion.maxDeceleration = Math.max(__toyMotion.maxDeceleration, (speed - room.toys[0].speed) / dt);
      if (room.toys[0].s < s - 1e-8) __toyMotion.backwards++;
    };
  });
  for (const [beat, elapsed] of [
    ['notice', 0.3],
    ['pickup', 1.8],
    ['holdToy', 1.5],
    ['launch', 1.8],
  ]) {
    await page.waitForFunction(
      ({ beat, elapsed }) => __game.story.current.beat === beat && __game.story.current.elapsed > elapsed,
      { beat, elapsed },
      { timeout: 45000 },
    );
    await page.screenshot({ path: `${prefix}-${beat}.png` });
  }
  await page.waitForFunction(() => __game.story.current.beat === 'sailing', null, { timeout: 45000 });
  const start = await page.evaluate(() => __game.littleBoats.progress);
  await page.waitForTimeout(5000);
  const idle = await page.evaluate(() => __game.littleBoats.progress);
  if (Math.abs(start - idle) > 0.001) throw new Error('The room advanced without a gesture');
  await page.screenshot({ path: `${prefix}-first-pool.png` });
  let pool = 0,
    swimmingShot = false,
    finished = false;
  for (let stroke = 0; stroke < 260; stroke++) {
    const state = await page.evaluate(() => {
      const g = __game,
        r = g.littleBoats;
      const p = r.invitation.clone().project(g.rig.camera);
      return {
        chapter: g.story.name,
        beat: g.story.current.beat,
        s: r.progress,
        x: (p.x + 1) / 2,
        y: (1 - p.y) / 2,
        swimming: g.cygnet.state === 'swimming',
        swims: g.cygnet.swims,
        swimPhase: g.story.current.swim,
        child: g.child.position.toArray(),
        bird: g.cygnet.position.toArray(),
      };
    });
    if (state.chapter !== 'boats') {
      finished = true;
      break;
    }
    if (state.beat === 'reveal') {
      await page.screenshot({ path: `${prefix}-reveal.png` });
      await page.waitForFunction(() => __game.story.name !== 'boats', null, { timeout: 45000 });
      finished = true;
      break;
    }
    if (state.swimming && !swimmingShot && state.s > 14) {
      await page.screenshot({ path: `${prefix}-swimming.png` });
      swimmingShot = true;
    }
    if (state.s > 32 && pool === 0) {
      await page.screenshot({ path: `${prefix}-middle-pool.png` });
      pool = 1;
    }
    if (state.s > 68 && pool === 1) {
      await page.screenshot({ path: `${prefix}-last-pool.png` });
      pool = 2;
    }
    if (stroke % 30 === 0) console.log(JSON.stringify({ stroke, ...state }));
    const cx = state.x * width,
      cy = state.y * height;
    const reach = touch ? 45 : 100;
    for (let i = 0; i <= 30; i++) {
      const x = Math.max(4, Math.min(width - 4, cx + (i / 30 - 0.5) * reach * 2)),
        y = Math.max(4, Math.min(height - 4, cy + Math.sin((i / 30) * Math.PI) * 6));
      if (touch)
        await cdp.send('Input.dispatchTouchEvent', {
          type: i === 0 ? 'touchStart' : 'touchMove',
          touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
        });
      else await page.mouse.move(x, y);
      await page.waitForTimeout(16);
    }
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.move(width - 3, height - 3);
    await page.waitForTimeout(220);
  }
  if (!finished) throw new Error('Pointer strokes did not finish the room');
  const swims = await page.evaluate(() => __game.cygnet.swims);
  if (swims !== 3) throw new Error(`Expected three pool swims, got ${swims}`);
  const motion = await page.evaluate(() => __toyMotion);
  if (motion.backwards || motion.maxDeceleration > 5)
    throw new Error(`Orange boat reset during pointer play: ${JSON.stringify(motion)}`);
  console.log(JSON.stringify({ test: 'orange-boat momentum', ...motion }));
  await page.screenshot({ path: `${prefix}-departed.png` });
  if (errors.length) throw new Error(errors.join('\n').slice(0, 3000));
  console.log(JSON.stringify(await page.evaluate(() => ({ chapter: __game.story.name, stats: __stats })), null, 2));
} finally {
  await browser.close();
  releaseLock();
}

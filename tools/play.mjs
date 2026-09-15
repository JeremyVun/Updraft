// Drive the real game with pointer gestures in local Chrome (GPU) and capture frames for visual QA.
// Usage: node tools/play.mjs <out-prefix> '<json steps>'
//   steps: [{"wait":ms} | {"shot":"name"} | {"move":[x,y]} | {"down":true} | {"up":true}
//           | {"swipe":[[x1,y1],[x2,y2],...], "ms":600} | {"eval":"js"} | {"burst":"name","n":4,"every":120}]
//   Coordinates are fractions of the viewport (0..1). "swipe" moves through the points over "ms" with fine steps.
//   "burst" takes n screenshots every <every> ms named <name>-1..n.
//   env: BASE (default http://127.0.0.1:5230/), QUERY (appended), W/H viewport (default 1600x900),
//        VIDEO=1 records <prefix>.webm of the whole session (headless screencast, lower quality than shots)
// Prints stats (`window.__stats`) at the end and writes <prefix>-console.log on errors.
// Runs take a machine-wide lock (/tmp/updraft-chromium.lock) so parallel agents capture one at a time.
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

const [prefix, stepsJson = '[{"shot":"still"}]'] = process.argv.slice(2);
if (!prefix) {
  console.error("usage: node tools/play.mjs <out-prefix> '<json steps>'");
  process.exit(1);
}
const steps = JSON.parse(stepsJson);
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
const videoDir = process.env.VIDEO ? fs.mkdtempSync('/tmp/updraft-video-') : null;
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  ...(videoDir ? { recordVideo: { dir: videoDir, size: { width, height } } } : {}),
});
try {
  const page = await context.newPage();
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(`${base}?shot=1${process.env.QUERY ? '&' + process.env.QUERY : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const px = ([x, y]) => [x * width, y * height];
  for (const s of steps) {
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.move) await page.mouse.move(...px(s.move));
    if (s.down) await page.mouse.down();
    if (s.up) await page.mouse.up();
    if (s.swipe) {
      const pts = s.swipe.map(px);
      const ms = s.ms ?? 600;
      const n = Math.max(2, Math.round(ms / 8));
      const seg = pts.length - 1;
      await page.mouse.move(...pts[0]);
      for (let i = 1; i <= n; i++) {
        const f = (i / n) * seg;
        const k = Math.min(seg - 1, Math.floor(f));
        const t = f - k;
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        await page.mouse.move(ax + (bx - ax) * t, ay + (by - ay) * t);
        await page.waitForTimeout(ms / n);
      }
    }
    if (s.eval) console.log(JSON.stringify(await page.evaluate(s.eval)));
    if (s.shot) {
      await page.screenshot({ path: `${prefix}-${s.shot}.png` });
      console.log(`${prefix}-${s.shot}.png`);
    }
    if (s.burst) {
      for (let i = 1; i <= (s.n ?? 4); i++) {
        await page.screenshot({ path: `${prefix}-${s.burst}-${i}.png` });
        console.log(`${prefix}-${s.burst}-${i}.png`);
        await page.waitForTimeout(s.every ?? 120);
      }
    }
  }
  console.log(JSON.stringify(await page.evaluate(() => window.__stats ?? null)));
  if (videoDir) {
    const video = page.video();
    await context.close();
    fs.renameSync(await video.path(), `${prefix}.webm`);
    fs.rmSync(videoDir, { recursive: true, force: true });
    console.log(`${prefix}.webm`);
  }
} finally {
  await browser.close();
  const unique = [...new Set(errors)].filter((e) => !e.includes('Failed to load resource'));
  if (unique.length) {
    fs.writeFileSync(`${prefix}-console.log`, unique.join('\n\n'));
    console.log(`${unique.length} console errors/warnings -> ${prefix}-console.log`);
    console.log(unique.slice(0, 4).map((e) => e.slice(0, 600)).join('\n'));
  }
}

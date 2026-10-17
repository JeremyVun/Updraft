// Drive the real game with pointer gestures in Chrome for Testing (GPU) and capture frames for visual QA.
// Usage: node tools/play.mjs <out-prefix> '<json steps>'
//   steps: [{"wait":ms} | {"shot":"name"} | {"move":[x,y]} | {"down":true} | {"up":true}
//           | {"swipe":[[x1,y1],[x2,y2],...], "ms":600} | {"eval":"js"} | {"burst":"name","n":4,"every":120}
//           | {"circle":"js returning [x,y]","until":"js condition","radius":0.05,"seconds":40}]
//   Coordinates are fractions of the viewport (0..1). "swipe" moves through the points over "ms" with fine steps.
//   "circle" draws circles round the point the expression gives (fractions; re-read every turn) until the condition
//   holds, and fails after "seconds".
//   "burst" takes n screenshots every <every> ms named <name>-1..n.
//   env: BASE (default http://127.0.0.1:5230/), QUERY (appended), W/H viewport (default 1600x900),
//        TOUCH=1 emulates a coarse primary pointer; it does not emulate GPU performance.
//        VIDEO=1 records <prefix>.webm of the whole session (headless screencast, lower quality than shots)
// Prints stats (`window.__stats`) at the end and writes <prefix>-console.log on errors.
// Waits and gestures run on game time, so a shared GPU slows a capture without changing what it plays.
// Shares the GPU with other captures; timing checks wait for it to themselves. ANGLE can override the platform's normal backend for comparisons.
import { openBrowser } from './lib/browser.mjs';
import { gameTime } from './lib/game-time.mjs';
import fs from 'node:fs';

const [prefix, stepsJson = '[{"shot":"still"}]'] = process.argv.slice(2);
if (!prefix) {
  console.error("usage: node tools/play.mjs <out-prefix> '<json steps>'");
  process.exit(1);
}
const steps = JSON.parse(stepsJson);
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600);
const height = Number(process.env.H ?? 900);

const { browser, close } = await openBrowser();
const errors = [];
const videoDir = process.env.VIDEO ? fs.mkdtempSync('/tmp/updraft-video-') : null;
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  hasTouch: process.env.TOUCH === '1',
  ...(videoDir ? { recordVideo: { dir: videoDir, size: { width, height } } } : {}),
});
try {
  const page = await context.newPage();
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(`${base}?shot=1${process.env.QUERY ? '&' + process.env.QUERY : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const px = ([x, y]) => [x * width, y * height];
  const game = gameTime(page);
  for (const s of steps) {
    if (s.wait) await game.wait(s.wait);
    if (s.move) await page.mouse.move(...px(s.move));
    if (s.down) await page.mouse.down();
    if (s.up) await page.mouse.up();
    if (s.swipe) {
      const pts = s.swipe.map(px);
      const ms = s.ms ?? 600;
      const n = Math.max(2, Math.round(ms / 8));
      const seg = pts.length - 1;
      await page.mouse.move(...pts[0]);
      const at = await game.start();
      for (let i = 1; i <= n; i++) {
        const f = (i / n) * seg;
        const k = Math.min(seg - 1, Math.floor(f));
        const t = f - k;
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        await page.mouse.move(ax + (bx - ax) * t, ay + (by - ay) * t);
        await at((i * ms) / n);
      }
    }
    if (s.circle) {
      const end = ((await game.frame()) ?? 0) + (s.seconds ?? 40) * 60;
      const r = s.radius ?? 0.05;
      let a = 0;
      for (;;) {
        const [cx, cy] = px(await page.evaluate(s.circle));
        const at = await game.start();
        for (let i = 0; i < 24; i++) {
          a += (Math.PI * 2) / 24;
          await page.mouse.move(cx + Math.cos(a) * r * height, cy + Math.sin(a) * r * height);
          await at((i + 1) * 28);
        }
        if (s.until && (await page.evaluate(s.until))) break;
        if (((await game.frame()) ?? 0) > end) throw new Error(`circling never got there: ${s.until}`);
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
        await game.wait(s.every ?? 120);
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
  await close();
  const unique = [...new Set(errors)].filter((e) => !e.includes('Failed to load resource'));
  if (unique.length) {
    fs.writeFileSync(`${prefix}-console.log`, unique.join('\n\n'));
    console.log(`${unique.length} console errors/warnings -> ${prefix}-console.log`);
    console.log(unique.slice(0, 4).map((e) => e.slice(0, 600)).join('\n'));
  }
}

// Video of the Birches scarf in play at a true 60 fps, one webm per moment, with the same gestures as scarf-check.mjs.
// BASE=http://127.0.0.1:5230/ OUT=/tmp/updraft-scarf-video SUFFIX=before node tools/scarf-video.mjs [names...]
// Names: tied tied-close brush release-1 release-2 release-3 release-4 gathering-close. release-4 runs on through
// the gathering, which is also cut out as 07-gathering. W/H set the viewport (default 1280x720).
// After the chapter has loaded and the tangle is set up, the page's animation frames are stepped one at a time and
// every frame is captured, so playback is exactly real time whatever the machine's load. Shot mode advances the game
// 1/60 s per frame, and pointer speed is measured per frame, so each gesture moves the pointer a fixed amount per
// frame: the same stroke in game time on every build. <OUT>/<file>-<SUFFIX>.json logs the frames of each mark.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openBrowser } from './lib/browser.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const out = process.env.OUT ?? '/tmp/updraft-scarf-video';
const suffix = process.env.SUFFIX ?? 'clip';
const width = Number(process.env.W ?? 1280), height = Number(process.env.H ?? 720);
const all = ['tied', 'tied-close', 'brush', 'release-1', 'release-2', 'release-3', 'release-4', 'gathering-close'];
const names = process.argv.slice(2).length ? process.argv.slice(2) : all;
const files = { tied: '01-tied-in-wind', 'tied-close': '01b-tied-in-wind-close', brush: '02-brushed-by-wind',
  'release-1': '03-release-1-lift', 'release-2': '04-release-2-unwind', 'release-3': '05-release-3-slip',
  'release-4': '06-release-4-bow', 'gathering-close': '07b-gathering-close' };
/** Fixed close cameras (x,y,z,tx,ty,tz): drapes crossing the ride, and the last lengths running to the boat. */
const cams = { 'tied-close': '-3,12.6,-1105,9,14.5,-1118', 'gathering-close': '7,5.5,-1180,-5,1.5,-1192' };
fs.mkdirSync(out, { recursive: true });

const manual = () => {
  const real = window.requestAnimationFrame.bind(window);
  let stepping = false, queue = [], now = 0;
  window.requestAnimationFrame = callback => {
    if (!stepping) return real(callback);
    queue.push(callback);
    return queue.length;
  };
  window.__manual = () => { stepping = true; now = performance.now() + 200; };
  window.__step = () => { const q = queue; queue = []; now += 1000 / 60; for (const c of q) c(now); return q.length; };
};

const { browser, close } = await openBrowser();
try {
  for (const name of names) {
    const frames = fs.mkdtempSync('/tmp/updraft-scarf-video-');
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.addInitScript(manual);
    let frame = 0;
    const marks = {};
    const step = async (count = 1) => {
      for (let i = 0; i < count; i++) {
        await page.evaluate(() => window.__step());
        await page.screenshot({ path: `${frames}/f-${String(++frame).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 92 });
      }
    };
    const cam = cams[name] ? `&cam=${cams[name]}` : '';
    await page.goto(`${base}?shot=1&chapter=birches&ratio=1&msaa=4${cam}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await page.waitForTimeout(5500);
    await page.waitForFunction(() => !__game.carry.busy && !__game.child.acting);
    const index = name.startsWith('release-') ? Number(name.slice(8)) - 1 : name === 'gathering-close' ? 3 : 0;
    await page.evaluate(index => {
      const g = __game, c = g.story.current, scarf = g.birches.scarf;
      scarf.restore(index);
      g.child.stop();
      const before = scarf.snags[index].before;
      g.child.place(before.x, before.z, Math.PI);
      g.glider.hold(g.child);
      g.cygnet.rideIn('satchel');
      c.leg = [1, 3, 4, 4][index];
      c.toScarf(); c.update(0, c.now); g.rig.cut(c.shot);
    }, index);
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__manual());
    await page.waitForTimeout(300);
    await step(30);
    marks.start = frame;
    const centre = () => page.evaluate(index => {
      const g = __game, snag = g.birches.scarf.snags[index];
      const p = snag.center.clone().project(g.rig.camera);
      return { work: snag.target, x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
    }, index);
    const stroke = async (from, to, count = 23) => {
      await page.mouse.move(...from); await page.mouse.down();
      for (let j = 1; j <= count; j++) {
        await page.mouse.move(from[0] + (to[0] - from[0]) * j / count, from[1] + (to[1] - from[1]) * j / count);
        await step();
      }
      await page.mouse.up();
      await step();
    };
    if (name === 'tied' || name === 'tied-close') await step(600);
    if (name === 'brush') {
      await step(90);
      // Broad sweeps across the hanging lengths, not the tangle's own gesture.
      for (let sweep = 0; sweep < 6; sweep++) {
        const y = height * (.3 + .08 * (sweep % 3));
        const [a, b] = sweep % 2 ? [width * .85, width * .15] : [width * .15, width * .85];
        await stroke([a, y], [b, y + height * .06], 42);
        await step(15);
      }
      marks.calm = frame;
      await step(480);
    }
    if (name.startsWith('release-')) {
      let strokes = 0;
      while (strokes < 24) {
        const state = await centre();
        if (state.work >= 1) break;
        if (index === 1) {
          const radius = height * .078;
          await page.mouse.move(state.x + radius, state.y); await page.mouse.down();
          for (let f = 1; f <= 51; f++) {
            const angle = f / 51 * Math.PI * 2;
            await page.mouse.move(state.x + Math.cos(angle) * radius, state.y - Math.sin(angle) * radius);
            await step();
          }
          await page.mouse.up();
          await step();
        } else {
          const dir = index === 0 ? [0, -1] : index === 2 ? [1, 0] : [strokes % 2 ? -1 : 1, 0];
          const start = index === 3 ? [state.x, state.y] : [state.x - dir[0] * 75, state.y - dir[1] * 75];
          await stroke(start, [state.x + dir[0] * 75, state.y + dir[1] * 75]);
        }
        strokes++;
      }
      marks.strokes = strokes;
      while (!await page.evaluate(index => __game.birches.scarf.snags[index].work >= 1, index)) await step();
      marks.solved = frame;
      while (!await page.evaluate(index => __game.birches.scarf.snags[index].freed, index)) await step();
      marks.freed = frame;
    }
    if (name === 'gathering-close') {
      await step(30);
      await page.evaluate(() => { __game.birches.scarf.snags[3].target = 1; });
      while (!await page.evaluate(() => __game.birches.scarf.snags[3].freed)) await step();
      marks.freed = frame;
    }
    if (index === 3) {
      while (!await page.evaluate(() => __game.birches.scarf.finished)) await step();
      await step(90);
    } else if (name.startsWith('release-')) await step(540);
    marks.end = frame;
    await page.close();
    const encode = (file, from, to) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60',
      '-start_number', String(from), '-i', `${frames}/f-%06d.jpg`, '-frames:v', String(to - from + 1),
      '-c:v', 'libvpx-vp9', '-b:v', '8M', '-pix_fmt', 'yuv420p', `${out}/${file}-${suffix}.webm`]);
    encode(files[name], marks.start, marks.end);
    if (name === 'release-4') encode('07-gathering', marks.freed, marks.end);
    fs.writeFileSync(`${out}/${files[name]}-${suffix}.json`, JSON.stringify({ fps: 60, marks }, null, 1));
    console.log(JSON.stringify({ name, marks }));
    fs.rmSync(frames, { recursive: true, force: true });
  }
} finally {
  await close();
}

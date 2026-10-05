// The drowned village's sea fog at each stage of its progression, beside Astra's paintings of it
// (docs/backlog/path-puzzles/comps/fog): the becalmed boat against the cottage, landscape and upright, at `?fog=`
// 0 (clear dusk), 0.3 (risen far off), 0.6 (close, the sun taken) and 1 (closed round into night); then one frame
// looking along the run toward the church from beside her on the ridge, with the fog holding behind her as the story
// leaves it. Writes <prefix>-<view>-<stage>.png and a side-by-side <prefix>-<view>-<stage>-sheet.png with the
// painting, and prints a probe of each frame: the far roofs' contrast against the fog round them and the warmth of
// the boat. The probe is a mirror, not a gate.
// Usage: node tools/drowned-fog-check.mjs [prefix]   (default /tmp/updraft-drowned-fog-check)
//   env: BASE (default http://127.0.0.1:5230/), COMPS (the paintings' folder), ONLY=landscape|upright|church
// Traps:
//   - It reaches the stranding by putting the boat on the drift's last leg with the cat aboard (the checkpoint the
//     story restores) about 28 m short of the strand, so the air dies at once; the story then plays the coast in
//     and the lens coming round as in play. Each stage is taken with the story's clock stopped (its update called
//     with no time), so the cat never bolts and the lens holds while `params.fog` is changed under it.
//   - The church frame lets the story run on to the ridge with `params.fog` cleared, so the fog stands where the
//     story puts it, then places the lens itself (`rig.fixed`).
//   - The sea's mirror is redrawn on alternate frames and the palette eases nothing for `fog`, so a few frames after
//     a change are enough; the frame is taken after 20.
//   - Runs in `shot` mode against a dev server: an edit under src reloads the page mid-run.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const prefix = process.argv[2] ?? '/tmp/updraft-drowned-fog-check';
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const comps = process.env.COMPS ?? path.resolve('docs/backlog/path-puzzles/comps/fog');
const only = process.env.ONLY ?? null;
const STAGES = [['clear', 0, 'today.jpg'], ['far', 0.3, 'fog-far.jpg'], ['near', 0.6, 'fog-near.jpg'], ['arrives', 1, 'fog-arrives.jpg']];
const VIEWS = { landscape: [1600, 900], upright: [852, 1846] };

const browser = await chromium.launch({ channel: 'chromium', headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function open(width, height) {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?shot=1&chapter=drowned&ratio=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  return page;
}

/** Waits `n` rendered frames. */
const frames = (page, n) => page.evaluate((count) => new Promise((done) => {
  const until = __stats.frame + count;
  const tick = () => (__stats.frame >= until ? done() : requestAnimationFrame(tick));
  tick();
}), n);

/** Puts the boat on the last leg of the drift with the cat aboard and waits for it to lie becalmed against the roof. */
async function strand(page) {
  await page.evaluate(() => {
    const s = __game.story.current, b = __game.boat;
    s.restoreCheckpoint('', [3]);
    b.position.set(3.5, b.position.y, -1373);
    b.yaw = Math.atan2(-0.4472, -0.8944);
    b.speed = 2;
    __game.rig.cut(s.shot);
  });
  await page.waitForFunction(() => __game.story.current.beat === 'becalmed' && __game.story.current.t > 9, null,
    { timeout: 120000, polling: 200 });
}

/** Stops the story's clock, so the cat stays put and the lens holds, while everything else lives on. */
const freeze = (page) => page.evaluate(() => {
  const s = __game.story.current;
  s.frozenUpdate ??= s.update;
  s.update = (dt, time) => s.frozenUpdate.call(s, 0, time);
});
const thaw = (page) => page.evaluate(() => {
  const s = __game.story.current;
  if (s.frozenUpdate) s.update = s.frozenUpdate;
});

/**
 * Where the probe looks, as fractions of the frame: the boat's hull, and the top of each roof between 40 and 260 m
 * off with the pixels just over it (fog or sky), for the roofs' contrast against what is round them.
 */
const probePoints = (page) => page.evaluate(() => {
  const { rig, boat, village } = __game;
  const cam = rig.camera, eye = cam.position;
  const screen = (p) => {
    const s = p.clone().project(cam);
    return s.z < 1 && Math.abs(s.x) < 0.95 && Math.abs(s.y) < 0.95 ? [(s.x + 1) / 2, (1 - s.y) / 2] : null;
  };
  const roofs = [];
  for (const box of village.cameraObstacles) {
    const c = box.getCenter(box.min.clone()).setY(box.max.y);
    const d = Math.hypot(c.x - eye.x, c.z - eye.z);
    if (d < 40 || d > 260 || box.max.y < 2) continue;
    const top = screen(c), over = screen(c.clone().setY(c.y + 1.5 + d * 0.01));
    if (top && over) roofs.push([top, over]);
  }
  return { hull: screen(boat.position.clone().setY(boat.position.y + 0.35)), roofs, progress: +village.dark.progress.toFixed(2) };
});

/** The game's frame and the painting side by side, at the game frame's height, and the probe read from the frame. */
async function sheet(file, painting, out, points) {
  const page = await (await browser.newContext({ viewport: { width: 400, height: 300 } })).newPage();
  const data = (f) => `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(f).toString('base64')}`;
  const imgs = [file, painting].filter((f) => f && fs.existsSync(f));
  await page.setContent(`<body style="margin:0;background:#111;display:flex;gap:8px">${imgs.map((f) =>
    `<img src="${data(f)}" style="height:900px;display:block">`).join('')}</body>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const width = await page.evaluate(() => document.body.scrollWidth);
  await page.setViewportSize({ width, height: 900 });
  await page.screenshot({ path: out });
  const read = await page.evaluate((pts) => {
    const img = document.images[0], w = img.naturalWidth, h = img.naturalHeight;
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const g = canvas.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, w, h).data;
    const mean = ([fx, fy], r) => {
      const cx = Math.round(fx * w), cy = Math.round(fy * h);
      const sum = [0, 0, 0];
      let n = 0;
      for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
          const i = (y * w + x) * 4;
          sum[0] += px[i]; sum[1] += px[i + 1]; sum[2] += px[i + 2]; n++;
        }
      }
      return sum.map((v) => v / Math.max(1, n));
    };
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const hull = pts.hull ? mean(pts.hull, 5) : null;
    const contrasts = pts.roofs.map(([top, over]) => Math.abs(lum(mean(top, 1)) - lum(mean(over, 1))));
    return {
      progress: pts.progress,
      hullWarmth: hull ? +(hull[0] / Math.max(1, hull[2])).toFixed(2) : null,
      hullLum: hull ? Math.round(lum(hull)) : null,
      farRoofs: contrasts.length,
      farRoofContrast: contrasts.length ? Math.round(contrasts.reduce((a, b) => a + b, 0) / contrasts.length) : null,
    };
  }, points);
  await page.close();
  return read;
}

try {
  for (const [view, [width, height]] of Object.entries(VIEWS)) {
    if (only && only !== view && !(only === 'church' && view === 'landscape')) continue;
    const page = await open(width, height);
    await strand(page);
    await freeze(page);
    if (only !== 'church') {
      for (const [stage, fog, painting] of STAGES) {
        await page.evaluate((f) => { __game.params.fog = f; }, fog);
        await frames(page, 20);
        const file = `${prefix}-${view}-${stage}.png`;
        await page.screenshot({ path: file });
        const comp = view === 'upright' ? (stage === 'near' ? 'fog-portrait.jpg' : null) : painting;
        const read = await sheet(file, comp && path.join(comps, comp), `${prefix}-${view}-${stage}-sheet.png`, await probePoints(page));
        console.log(view, stage, JSON.stringify(read), `${prefix}-${view}-${stage}-sheet.png`);
      }
    }
    if (view === 'landscape' && (!only || only === 'church')) {
      await page.evaluate(() => { __game.params.fog = null; __game.village.dark.close = 0; });
      await thaw(page);
      await page.waitForFunction(() => __game.story.current.cat.step === 'ridge' && __game.story.current.cat.t > 2, null,
        { timeout: 120000, polling: 200 });
      await freeze(page);
      await page.evaluate(() => {
        const { rig, child } = __game;
        const c = child.position, church = { x: 14, z: -1436 };
        const dx = church.x - c.x, dz = church.z - c.z, len = Math.hypot(dx, dz);
        const fx = dx / len, fz = dz / len;
        rig.fixed = true;
        // From the side of the run away from the fog, so the church stands on one side of the frame and the fog on the other.
        const wx = fz, wz = -fx;
        rig.camera.position.set(c.x + wx * 12 - fx * 3, c.y + 0.6, c.z + wz * 12 - fz * 3);
        rig.camera.lookAt(c.x + fx * 10 - wx * 8, c.y + 1, c.z + fz * 10 - wz * 8);
      });
      await frames(page, 20);
      const file = `${prefix}-church.png`;
      await page.screenshot({ path: file });
      console.log('church', JSON.stringify(await sheet(file, null, `${prefix}-church-sheet.png`, await probePoints(page))), file);
    }
    await page.context().close();
  }
  if (errors.length) console.log(`page errors:\n${errors.join('\n')}`);
} finally {
  await browser.close();
}

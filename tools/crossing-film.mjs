// Films a drowned-village crossing on its QA stage yard with real pointer gestures, for judging motion rather than
// poses: a frame every 1/FPS s of game time from the yard's own lens, laid out in time order with the time on each,
// several frames to a sheet.
// Usage: node tools/crossing-film.mjs <mill|sheet|bell> <out-prefix>
//   mill: broad circles round the hub on screen until she steps off at the top, then on a while; also PAUSE=<s>
//         stops circling for that long once she is a third of the way up, to show the coast and the pawl holding.
//   sheet: firm strokes up the line across the sheet until she is set down on the far roof.
//   bell: BELL=climb (default) films her climb up the ivy, and her kneeling in the opening over the nest until she
//         stands to ring; BELL=down her climb back out and down; BELL=ring
//         firm strokes across the bell until it has rung RINGS times (default 4), then on while the waves roll out.
//         VIEW=climb-near|climb-far|... holds the yard's lens on one of its views. CLIP=<file.mp4> also writes every
//         frame at 30 fps to a clip, with the bell's rings rendered into its sound track where they fell.
//   env: BASE (default http://127.0.0.1:5230/), W/H viewport (default 1600x900; 720x1280 for upright), FPS (10),
//        COLS (5), ROWS (4), WIDTH of a frame in the sheet (default 384, or 216 upright), QUERY extra params.
import { openBrowser } from './lib/browser.mjs';
import sharp from 'sharp';
import fs from 'node:fs';

const [what, prefix] = process.argv.slice(2);
if (!['mill', 'sheet', 'bell'].includes(what) || !prefix) {
  console.error('usage: node tools/crossing-film.mjs <mill|sheet|bell> <out-prefix>');
  process.exit(1);
}
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const width = Number(process.env.W ?? 1600), height = Number(process.env.H ?? 900);
const fps = Number(process.env.FPS ?? 10), every = Math.max(1, Math.round(60 / fps));
const cols = Number(process.env.COLS ?? 5), rows = Number(process.env.ROWS ?? 4);
const cell = Number(process.env.WIDTH ?? (width > height ? 384 : 216));
const pause = Number(process.env.PAUSE ?? 0);
const bellFrom = process.env.BELL ?? 'climb';
const clip = process.env.CLIP ?? null;
const clipEvery = 2;
const clipDir = clip ? fs.mkdtempSync('/tmp/updraft-belfry-clip-') : null;
let clipNo = 0;
const rings = [];

const { browser, close } = await openBrowser();
const frames = [];
const log = [];
let frameNo = 0;
try {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const extra = what === 'bell' ? `&bell=${bellFrom}${process.env.VIEW ? `&bellView=${process.env.VIEW}` : ''}` : '';
  await page.goto(`${base}?shot=1&chapter=stage&gap=${what}${extra}${process.env.QUERY ? '&' + process.env.QUERY : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await page.waitForFunction((y) => window.__game?.story?.current?.[y]?.playing, what, { timeout: 30000 });
  const state = () => page.evaluate((y) => window.__game.story.current[y].state, what);
  let t0 = null, next = 0, now = 0;
  /** One rendered frame; one every 1/FPS s of game time is kept, the world held still while it is photographed. */
  let lastRings = 0;
  const tick = async () => {
    now = await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(window.__stats.time))));
    t0 ??= now;
    if (what === 'bell') {
      const heard = await page.evaluate(() => {
        const b = window.__game.story.current.bell.bell;
        return { rings: b.rings + b.touches, ring: b.rings, peak: b.peak };
      });
      if (heard.rings > lastRings) rings.push({ t: now - t0, ring: heard.ring > (rings.filter((r) => r.ring).length), peak: heard.peak });
      lastRings = heard.rings;
    }
    if (clipDir && Math.round((now - t0) * 60) % clipEvery === 0) {
      await page.evaluate(() => { window.__game.params.hold = window.__stats.frame; });
      fs.writeFileSync(`${clipDir}/${String(clipNo++).padStart(5, '0')}.png`, await page.screenshot());
      await page.evaluate(() => { window.__game.params.hold = null; });
    }
    if (now - t0 < next - 1e-4) return;
    next += every / 60;
    const st = await page.evaluate((y) => {
      window.__game.params.hold = window.__stats.frame;
      return window.__game.story.current[y].state;
    }, what);
    const png = await page.screenshot();
    await page.evaluate(() => { window.__game.params.hold = null; });
    frames.push({ t: now - t0, png, note: st.phase });
    log.push(`${(now - t0).toFixed(1)} ${JSON.stringify(st)}`);
  };
  const ticks = async (seconds) => { const until = now + seconds; while (now < until) await tick(); };
  const onScreen = (expr) => page.evaluate((e) => {
    const p = eval(e).clone().project(window.__game.rig.camera);
    return [(p.x + 1) / 2, (1 - p.y) / 2];
  }, expr);
  for (let i = 0; i < 60; i++) await tick();

  if (what === 'mill') {
    const perTurn = 1.25, r = 0.22;
    let from = null, paused = false;
    for (let guard = 0; guard < 60 * 90; guard++) {
      const s = await page.evaluate(() => {
        const yard = window.__game.story.current.mill, p = yard.crossing.mill.hub.clone().project(window.__game.rig.camera), st = yard.state;
        return { hub: [(p.x + 1) / 2, (1 - p.y) / 2], phase: st.phase, wound: st.wound, full: st.full };
      });
      if (s.phase === 'leaving' || s.phase === 'over') break;
      if (pause && !paused && s.phase === 'riding' && s.wound > s.full / 3) {
        paused = true;
        const until = now + pause;
        while (now < until) await tick();
        from = null;
      }
      from ??= now;
      const a = ((now - from) / perTurn) * Math.PI * 2;
      const rr = r * (1 + 0.15 * Math.sin(a * 1.7));
      await page.mouse.move((s.hub[0] + (Math.cos(a) * rr * height) / width) * width, (s.hub[1] + Math.sin(a) * rr) * height);
      await tick();
    }
    const until = now + 4;
    while (now < until) await tick();
  } else if (what === 'bell' && bellFrom !== 'ring') {
    const done = bellFrom === 'down' ? (s) => s.phase === 'below' : (s) => s.phase === 'ringing';
    for (let guard = 0; guard < 60 * 40; guard++) {
      if (done(await state())) break;
      await tick();
    }
    await ticks(1.5);
  } else if (what === 'bell') {
    const want = Number(process.env.RINGS ?? 4);
    let pointer = null;
    await ticks(1);
    for (let n = 0; n < 12; n++) {
      const s = await state();
      if (s.bell.rings >= want) break;
      const aim = await page.evaluate(() => {
        const yard = window.__game.story.current.bell, camera = window.__game.rig.camera;
        const p = yard.bell.middle(camera.position.clone()).project(camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, heading: yard.bell.screenHeading(camera), aspect: camera.aspect };
      });
      const len = 0.42, dx = (Math.cos(aim.heading) * len) / aim.aspect, dy = -Math.sin(aim.heading) * len;
      const from = [aim.x - dx / 2, aim.y - dy / 2];
      if (pointer) {
        await page.mouse.move(pointer[0] * width, 0.99 * height);
        await page.mouse.move(from[0] * width, 0.99 * height);
      }
      await page.mouse.move(from[0] * width, from[1] * height);
      await tick();
      for (const start = now; now - start < 0.22;) {
        const u = Math.min(1, (now - start + 1 / 60) / 0.22);
        await page.mouse.move((from[0] + dx * u) * width, (from[1] + dy * u) * height);
        await tick();
      }
      pointer = [from[0] + dx, from[1] + dy];
      await page.mouse.move(pointer[0] * width, 0.99 * height);
      await ticks(Number(process.env.EVERY ?? 3.4) - 0.22);
    }
    await ticks(5);
  } else {
    let pointer = null;
    for (let n = 0; n < 40; n++) {
      const s = await state();
      if (['landing', 'landed', 'leaving', 'over'].includes(s.phase)) break;
      const aim = await page.evaluate(() => {
        const yard = window.__game.story.current.sheet, camera = window.__game.rig.camera;
        const p = yard.crossing.sheet.middle(camera.position.clone()).project(camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, heading: yard.crossing.sheet.heading(camera), aspect: camera.aspect };
      });
      const len = 0.6, dx = (Math.cos(aim.heading) * len) / aim.aspect, dy = -Math.sin(aim.heading) * len;
      const from = [aim.x - dx / 2, aim.y - dy / 2];
      if (pointer) {
        await page.mouse.move(pointer[0] * width, 0.99 * height);
        await page.mouse.move(from[0] * width, 0.99 * height);
      }
      await page.mouse.move(from[0] * width, from[1] * height);
      await tick();
      for (const start = now; now - start < 0.25;) {
        const u = Math.min(1, (now - start + 1 / 60) / 0.25);
        await page.mouse.move((from[0] + dx * u) * width, (from[1] + dy * u) * height);
        await tick();
      }
      pointer = [from[0] + dx, from[1] + dy];
      await ticks(0.5);
    }
    await ticks(3);
  }
  if (errors.length) console.error(`page errors: ${errors.slice(0, 3).join(' | ')}`);
} finally {
  await close();
}

fs.writeFileSync(`${prefix}.log`, log.join('\n'));
if (what === 'bell') fs.writeFileSync(`${prefix}-rings.json`, JSON.stringify(rings));
if (clipDir) {
  const { execFileSync } = await import('node:child_process');
  const picture = `${clipDir}/picture.mp4`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(60 / clipEvery), '-i', `${clipDir}/%05d.png`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', picture]);
  const sound = `${clipDir}/sound.wav`;
  execFileSync('node', ['tools/bell-render.mjs', sound, JSON.stringify(rings), String(clipNo * clipEvery / 60 + 1)], { stdio: 'inherit', env: process.env });
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', picture, '-i', sound, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', clip]);
  fs.rmSync(clipDir, { recursive: true, force: true });
  console.log(clip);
}
const ch = Math.round((cell * height) / width);
const per = cols * rows;
for (let sheet = 0; sheet * per < frames.length; sheet++) {
  const some = frames.slice(sheet * per, (sheet + 1) * per);
  const tiles = await Promise.all(some.map(async (f) => {
    const label = Buffer.from(`<svg width="${cell}" height="${ch}"><rect x="0" y="0" width="${Math.min(cell, 150)}" height="20" fill="black" fill-opacity="0.55"/>`
      + `<text x="5" y="15" font-family="Helvetica" font-size="13" fill="white">${f.t.toFixed(1)} s ${f.note ?? ''}</text></svg>`);
    return sharp(f.png).resize(cell, ch).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
  }));
  const path = `${prefix}-${String(sheet + 1).padStart(2, '0')}.png`;
  await sharp({ create: { width: cols * cell, height: Math.ceil(some.length / cols) * ch, channels: 3, background: '#111' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * cell, top: Math.floor(i / cols) * ch })))
    .png().toFile(path);
  console.log(`${path}  ${some[0].t.toFixed(1)}–${some[some.length - 1].t.toFixed(1)} s`);
}

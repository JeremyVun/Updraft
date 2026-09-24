// Regression evidence for the distant-height atlas: old (uTerrainHeightsReady 0, worldHeight beyond the window, as
// before phase 3) against new, rendered from the very same state with the light bake re-run for each side.
// Only the light bake and the terrain's vertices read heights beyond the window; the window's height, shore and
// grass-table bakes never do, so they are the same on both sides.
//
//   stills <frame-profile prefix> <out>  per-chapter difference maps from `ABLATIONS=heights-direct CAPTURE=1
//        node tools/frame-profile.mjs ...` captures (baseline = new, variant = old): the new frame, a heatmap of the
//        per-pixel max channel difference over a dimmed copy, stats, and enlarged crops of the worst regions.
//   motion <meadow|boats|pan> <out>      a real play-through (Meadow walk as the story plays it; the boats room sailed
//        with frame-locked pointer strokes) or a slow pan across the window's west edge with the world held.
//        Every captured frame is drawn twice, old then new, from one simulation, so the only difference is the
//        heights: old.webm, new.webm, side-by-side.webm, diff.webm (amplified) and per-frame stats, including the
//        frame-to-frame change of each side (crawling or swimming shows as a difference between the two).
//   index <out>                          writes index.html over everything in <out>.
// env: BASE (dev server), W/H (motion viewport, 1280x720), SECONDS (game seconds, meadow 40, boats 40),
//      EVERY (capture every n-th frame, 2), STEPS (pan frames, 240).
// Heatmaps: any changed pixel is drawn, 1/255 as yellow rising to red at 6/255 and above, each spread to 3x3 pixels
// so single pixels survive the page's downscaling. The difference videos use the same colours.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { decodePng, encodePng } from './lib/png.mjs';

const [mode, ...args] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5230/';

function diffOf(a, b, n) {
  const d = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    d[i] = Math.max(Math.abs(a[o] - b[o]), Math.abs(a[o + 1] - b[o + 1]), Math.abs(a[o + 2] - b[o + 2]));
  }
  return d;
}
function statsOf(d) {
  let max = 0, sum = 0, changed = 0, over1 = 0, over2 = 0;
  for (const v of d) { if (v) { changed++; sum += v; if (v > 1) over1++; if (v > 2) over2++; } if (v > max) max = v; }
  return { max, meanOverFrame: sum / d.length, changed, over1, over2 };
}
/** Dimmed grey copy of the frame with every changed pixel coloured, spread to 3x3. */
function heatmap(frame, d, w, h, channels = 4) {
  const out = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const g = (frame[i * channels] * 0.3 + frame[i * channels + 1] * 0.59 + frame[i * channels + 2] * 0.11) * 0.35;
    out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = g;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = d[y * w + x];
    if (!v) continue;
    const t = Math.min(1, (v - 1) / 5), rgb = [255, Math.round(230 * (1 - t)), 0];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const o = (yy * w + xx) * 3;
      if (out[o] === 255 && out[o + 1] <= rgb[1]) continue;
      out.set(rgb, o);
    }
  }
  return out;
}
function crop(src, w, x0, y0, size, scale, channels) {
  const out = new Uint8Array(size * scale * size * scale * 3);
  for (let y = 0; y < size * scale; y++) for (let x = 0; x < size * scale; x++) {
    const s = ((y0 + Math.floor(y / scale)) * w + x0 + Math.floor(x / scale)) * channels, o = (y * size * scale + x) * 3;
    out[o] = src[s]; out[o + 1] = src[s + 1]; out[o + 2] = src[s + 2];
  }
  return out;
}
function amplified(d, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = Math.min(255, d[i] * 40); out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255; }
  return out;
}

if (mode === 'stills') {
  const [prefix, out] = args;
  fs.mkdirSync(`${out}/stills`, { recursive: true });
  const chapters = ['island', 'washing', 'meadow:walk', 'birches', 'drowned', 'wood', 'sleeping', 'boats', 'jetty', 'sea', 'mirror'];
  const rows = [], blocks = [];
  for (const chapter of chapters) {
    const now = decodePng(fs.readFileSync(`${prefix}-${chapter}-heights-direct-baseline.png`));
    const old = decodePng(fs.readFileSync(`${prefix}-${chapter}-heights-direct-variant.png`));
    const { width: w, height: h } = now, d = diffOf(old.data, now.data, w * h), name = chapter.replace(':', '-');
    fs.writeFileSync(`${out}/stills/${name}-new.png`, encodePng(w, h, toRgb(now.data, w, h)));
    fs.writeFileSync(`${out}/stills/${name}-old.png`, encodePng(w, h, toRgb(old.data, w, h)));
    fs.writeFileSync(`${out}/stills/${name}-heatmap.png`, encodePng(w, h, heatmap(now.data, d, w, h)));
    const s = statsOf(d);
    rows.push({ chapter, name, width: w, height: h, ...s });
    console.log(JSON.stringify({ chapter, ...s }));
    const B = 32;
    for (let by = 0; by + B <= h; by += B) for (let bx = 0; bx + B <= w; bx += B) {
      let max = 0, sum = 0;
      for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) { const v = d[y * w + x]; sum += v; if (v > max) max = v; }
      if (max) blocks.push({ chapter, name, bx, by, max, sum, w, h, old, now, d });
    }
  }
  blocks.sort((a, b) => b.max - a.max || b.sum - a.sum);
  const worst = [];
  for (const b of blocks) {
    if (worst.length >= 5) break;
    if (worst.some((o) => o.chapter === b.chapter && Math.abs(o.bx - b.bx) < 128 && Math.abs(o.by - b.by) < 128)) continue;
    worst.push(b);
  }
  const regions = worst.map((b, i) => {
    const size = 96, x0 = Math.max(0, Math.min(b.w - size, b.bx + 16 - size / 2)), y0 = Math.max(0, Math.min(b.h - size, b.by + 16 - size / 2));
    const base = `${out}/stills/worst-${i + 1}-${b.name}`;
    fs.writeFileSync(`${base}-old.png`, encodePng(size * 4, size * 4, crop(b.old.data, b.w, x0, y0, size, 4, 4)));
    fs.writeFileSync(`${base}-new.png`, encodePng(size * 4, size * 4, crop(b.now.data, b.w, x0, y0, size, 4, 4)));
    fs.writeFileSync(`${base}-diff-x40.png`, encodePng(size * 4, size * 4, crop(amplified(b.d, b.w, b.h), b.w, x0, y0, size, 4, 4)));
    return { rank: i + 1, chapter: b.chapter, name: b.name, at: [x0, y0], size, max: b.max, sum: b.sum };
  });
  fs.writeFileSync(`${out}/stills/stills.json`, JSON.stringify({ rows, regions }, null, 2));
  console.log(JSON.stringify(regions));
} else if (mode === 'motion') {
  const [fixture, out] = args;
  assert(['meadow', 'boats', 'pan'].includes(fixture), `unknown fixture ${fixture}`);
  await motion(fixture, out);
} else if (mode === 'index') {
  writeIndex(args[0]);
} else {
  throw new Error('usage: stills <prefix> <out> | motion <meadow|boats|pan> <out> | index <out>');
}

function toRgb(rgba, w, h) {
  const out = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { out[i * 3] = rgba[i * 4]; out[i * 3 + 1] = rgba[i * 4 + 1]; out[i * 3 + 2] = rgba[i * 4 + 2]; }
  return out;
}

function encoder(file, w, h, fps) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-c:v', 'libvpx-vp9', '-b:v', '3M', '-crf', '32', '-deadline', 'realtime', '-cpu-used', '8', '-threads', '2', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (c) => (c ? reject(new Error(`ffmpeg ${c}`)) : resolve())));
  return {
    write: (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r))),
    end: () => { ff.stdin.end(); return done; },
  };
}

async function motion(fixture, out) {
  const { openBrowser } = await import('./lib/browser.mjs');
  const W = Number(process.env.W ?? 1280), H = Number(process.env.H ?? 720), every = Number(process.env.EVERY ?? 2);
  const seconds = Number(process.env.SECONDS ?? 40), steps = Number(process.env.STEPS ?? 240);
  const dir = `${out}/motion`;
  fs.mkdirSync(dir, { recursive: true });
  const { browser, close } = await openBrowser();
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
    await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/src/main.ts*', async (route) => {
      const response = await route.fetch();
      let source = await response.text();
      const hook = 'function frame(now) {', draw = 'drawJourneyRooms(rooms, roomObjects, drawRooms);';
      assert(source.includes(hook) && source.split(draw).length === 2);
      source = source.replace(hook, hook + ' if(window.__evidencePaused){requestAnimationFrame(frame);return;}');
      source = source.replace(draw, draw + ' window.__evidence?.frame(() => drawJourneyRooms(rooms, roomObjects, drawRooms));');
      source += `
window.__evidence = {
  on: false, count: 0, every: 1, pending: null, lastDraw: null,
  frame(draw) {
    this.lastDraw = draw;
    if (!this.on || this.count++ % this.every) return;
    this.capture(draw);
    window.__evidencePaused = true;
  },
  side(ready, draw) {
    terrainHeights.uniforms.uTerrainHeightsReady.value = ready;
    bakes.bakeLight(bakeInputs);
    draw();
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px;
  },
  capture(draw) {
    const old = this.side(0, draw), now = this.side(1, draw);
    const gl = renderer.getContext();
    this.pending = { old, now, w: gl.drawingBufferWidth, h: gl.drawingBufferHeight, frame: frameIndex, camera: rig.camera.position.toArray(), window: [WINDOW.minX, WINDOW.minZ] };
  },
  hold(pose) {
    rig.camera.position.fromArray(pose.position);
    rig.camera.lookAt(new THREE.Vector3().fromArray(pose.target));
    rig.camera.updateMatrixWorld();
    terrain.update(rig.camera);
    grass.update(rig.camera, 0);
    grass.bake(renderer);
    this.capture(this.lastDraw);
  },
  take() {
    const p = this.pending, flip = (px) => { const out = new Uint8Array(px.length), row = p.w * 4;
      for (let y = 0; y < p.h; y++) out.set(px.subarray(y * row, (y + 1) * row), (p.h - 1 - y) * row); return out; };
    const b64 = (px) => { let s = ''; for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000)); return btoa(s); };
    this.pending = null;
    return { old: b64(flip(p.old)), now: b64(flip(p.now)), w: p.w, h: p.h, frame: p.frame, camera: p.camera, window: p.window };
  },
};`;
      await route.fulfill({ response, body: source });
    });
    const chapter = fixture === 'boats' ? 'boats' : 'meadow';
    await page.goto(`${BASE}?shot&chapter=${chapter}&ratio=1&msaa=2&analytics=0&progress=0`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await page.waitForTimeout(1000);
    const videos = Object.fromEntries(['old', 'new', 'diff'].map((k) => [k, encoder(`${dir}/${fixture}-${k}.webm`, W, H, 60 / every)]));
    const sbs = encoder(`${dir}/${fixture}-side-by-side.webm`, W * 2, H, 60 / every);
    const frames = [];
    let prev = null;
    const consume = async (r) => {
      const old = Buffer.from(r.old, 'base64'), now = Buffer.from(r.now, 'base64');
      assert.equal(r.w, W); assert.equal(r.h, H);
      const d = diffOf(old, now, W * H), s = statsOf(d);
      const temporal = prev ? { old: meanChange(prev.old, old), now: meanChange(prev.now, now) } : null;
      prev = { old, now };
      frames.push({ index: frames.length, frame: r.frame, camera: r.camera.map((v) => +v.toFixed(2)), window: r.window, ...s, temporal });
      const oldRgb = toRgb(old, W, H), nowRgb = toRgb(now, W, H);
      await videos.old.write(Buffer.from(oldRgb));
      await videos.new.write(Buffer.from(nowRgb));
      await videos.diff.write(Buffer.from(heatmap(now, d, W, H)));
      const pair = Buffer.alloc(W * 2 * H * 3);
      for (let y = 0; y < H; y++) { Buffer.from(oldRgb.buffer, y * W * 3, W * 3).copy(pair, y * W * 6); Buffer.from(nowRgb.buffer, y * W * 3, W * 3).copy(pair, y * W * 6 + W * 3); }
      await sbs.write(pair);
      if (s.max > (frames.worst?.max ?? -1)) {
        frames.worst = { index: frames.length - 1, max: s.max };
        fs.writeFileSync(`${dir}/${fixture}-worst-old.png`, encodePng(W, H, oldRgb));
        fs.writeFileSync(`${dir}/${fixture}-worst-new.png`, encodePng(W, H, nowRgb));
        fs.writeFileSync(`${dir}/${fixture}-worst-heatmap.png`, encodePng(W, H, heatmap(now, d, W, H)));
      }
    };
    if (fixture === 'pan') {
      // The window held where the walk's crest put it; the camera stands inside it and turns to face its west edge.
      const setup = await page.evaluate(async () => {
        window.__evidencePaused = true;
        await new Promise((r) => setTimeout(r, 100));
        const { WINDOW, followWindow } = await import('/src/world/window.ts');
        const { worldHeight } = await import('/src/world/heightfield.ts');
        followWindow(10, -760, true);
        return { window: [WINDOW.minX, WINDOW.minZ, WINDOW.size], ground: worldHeight(-60, -760) };
      });
      const edgeX = setup.window[0], eye = [edgeX + 150, 0, -760];
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1), yaw = (-50 + 100 * t) * Math.PI / 180;
        const pose = await page.evaluate(async ({ eye, yaw }) => {
          const { worldHeight } = await import('/src/world/heightfield.ts');
          const y = worldHeight(eye[0], eye[2]) + 9;
          const target = [eye[0] - Math.cos(yaw) * 100, y - 4, eye[2] + Math.sin(yaw) * 100];
          window.__evidence.hold({ position: [eye[0], y, eye[2]], target });
          return window.__evidence.take();
        }, { eye, yaw });
        await consume(pose);
      }
    } else {
      await page.evaluate((every) => { window.__evidence.every = every; window.__evidence.count = 0; window.__evidence.on = true; }, every);
      if (fixture === 'boats') await page.waitForFunction(() => __game.story.current.beat === 'sailing', null, { timeout: 60000 });
      const total = Math.round((seconds * 60) / every);
      let stroke = 0;
      for (let i = 0; i < total; i++) {
        await page.waitForFunction(() => window.__evidence.pending, null, { timeout: 60000, polling: 16 });
        const r = await page.evaluate(() => window.__evidence.take());
        await consume(r);
        if (fixture === 'boats') {
          // One pointer step per captured frame, so the strokes land on the same frames in every run.
          const at = await page.evaluate(() => {
            const g = __game, p = (g.story.name === 'boats' ? g.littleBoats.invitation : g.boat.position).clone().project(g.rig.camera);
            return [(p.x + 1) / 2, (1 - p.y) / 2];
          });
          const k = stroke++ % 40;
          if (k <= 30) await page.mouse.move(Math.max(4, Math.min(W - 4, at[0] * W + (k / 30 - 0.5) * 200)), Math.max(4, Math.min(H - 4, at[1] * H + Math.sin((k / 30) * Math.PI) * 6)));
          else await page.mouse.move(W - 3, H - 3);
        }
        await page.evaluate(() => { window.__evidencePaused = false; });
      }
      await page.evaluate(() => { window.__evidence.on = false; window.__evidencePaused = false; });
    }
    await Promise.all([...Object.values(videos).map((v) => v.end()), sbs.end()]);
    const summary = {
      fixture, frames: frames.length, size: [W, H], every,
      changedFrames: frames.filter((f) => f.changed).length, max: Math.max(...frames.map((f) => f.max)),
      worstFrame: frames.worst, maxChanged: Math.max(...frames.map((f) => f.changed)),
      temporalGap: Math.max(0, ...frames.filter((f) => f.temporal).map((f) => Math.abs(f.temporal.now - f.temporal.old))),
      errors,
    };
    fs.writeFileSync(`${dir}/${fixture}.json`, JSON.stringify({ summary, frames }, null, 1));
    console.log(JSON.stringify(summary));
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
}

function meanChange(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return sum / (a.length / 4 * 3);
}

function writeIndex(out) {
  const stills = fs.existsSync(`${out}/stills/stills.json`) ? JSON.parse(fs.readFileSync(`${out}/stills/stills.json`, 'utf8')) : null;
  const motions = ['meadow', 'boats', 'pan'].filter((f) => fs.existsSync(`${out}/motion/${f}.json`)).map((f) => JSON.parse(fs.readFileSync(`${out}/motion/${f}.json`, 'utf8')));
  const notes = fs.existsSync(`${out}/notes.html`) ? fs.readFileSync(`${out}/notes.html`, 'utf8') : '';
  const chart = (m) => {
    const w = 900, h = 120, n = m.frames.length, top = Math.max(1, ...m.frames.map((f) => f.changed));
    const pts = m.frames.map((f, i) => `${(i / Math.max(1, n - 1)) * w},${h - (f.changed / top) * h}`).join(' ');
    return `<svg width="${w}" height="${h + 20}" style="background:#111"><polyline fill="none" stroke="#fb0" points="${pts}"/><text x="4" y="${h + 15}" fill="#aaa" font-size="11">changed pixels per frame (0 to ${top}); frames 0 to ${n - 1}</text></svg>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><title>Distant-height atlas: where the picture changes</title>
<style>body{font:15px/1.45 system-ui;background:#1b1b1b;color:#ddd;max-width:1400px;margin:24px auto;padding:0 16px}
img,video{max-width:100%;display:block;image-rendering:auto}.crop img{image-rendering:pixelated}
table{border-collapse:collapse}td,th{padding:3px 10px;border-bottom:1px solid #333;text-align:right}th:first-child,td:first-child{text-align:left}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
h2{margin-top:40px;border-top:1px solid #444;padding-top:16px}figcaption{color:#999;font-size:13px}</style>
<h1>Distant-height atlas (perf-bakes phase 3): where the picture changes</h1>
${notes}
<p><b>Old</b> is the game as it is on main: every ground height beyond the 320 m window comes from the full height
function. <b>New</b> reads a height atlas baked before Begin. Both sides are rendered from the same frozen state with
the shadows re-marched for each. Heatmaps: the frame dimmed, and every pixel that differs drawn over it, 1/255 in
yellow rising to red at 6/255 or more, each spread to 3x3 so single pixels stay visible.</p>
${stills ? `<h2>Per-chapter difference maps (frozen frame, 2064x1548)</h2>
<table><tr><th>Chapter</th><th>Changed pixels</th><th>Over 1/255</th><th>Over 2/255</th><th>Max</th><th>Mean over frame</th></tr>
${stills.rows.map((r) => `<tr><td><a href="#${r.name}">${r.chapter}</a></td><td>${r.changed}</td><td>${r.over1}</td><td>${r.over2}</td><td>${r.max}/255</td><td>${r.meanOverFrame.toExponential(1)}</td></tr>`).join('')}</table>
${stills.regions.length ? `<h2>The worst regions, enlarged 4x (old, new, difference x40)</h2>${stills.regions.map((g) => `<h3>${g.rank}. ${g.chapter}, pixels ${g.at[0]}..${g.at[0] + g.size}, ${g.at[1]}..${g.at[1] + g.size}: max ${g.max}/255</h3>
<div class="three crop"><figure><img src="stills/worst-${g.rank}-${g.name}-old.png"><figcaption>old</figcaption></figure><figure><img src="stills/worst-${g.rank}-${g.name}-new.png"><figcaption>new</figcaption></figure><figure><img src="stills/worst-${g.rank}-${g.name}-diff-x40.png"><figcaption>difference x40</figcaption></figure></div>`).join('')}` : '<p>No pixel differs in any chapter, so there are no worst regions to show.</p>'}
${stills.rows.map((r) => `<h3 id="${r.name}">${r.chapter}: ${r.changed ? `${r.changed} pixels differ, max ${r.max}/255` : 'identical'}</h3>
<div class="pair"><figure><img src="stills/${r.name}-new.png" loading="lazy"><figcaption>new frame</figcaption></figure><figure><img src="stills/${r.name}-heatmap.png" loading="lazy"><figcaption>difference heatmap over the dimmed frame</figcaption></figure></div>`).join('')}` : ''}
${motions.map((m) => `<h2>Motion: ${m.summary.fixture}</h2>
<p>${m.summary.frames} frames (every ${m.summary.every}${m.summary.fixture === 'pan' ? ', world held' : ' of the game at 60 fps'}), ${m.summary.size.join('x')}.
${m.summary.changedFrames} frames have any changed pixel; the most in one frame is ${m.summary.maxChanged}; max ${m.summary.max}/255.
Largest gap between the two sides' frame-to-frame change (crawling or swimming): ${m.summary.temporalGap.toFixed(4)}/255 per channel.</p>
${chart(m)}
<div class="pair"><figure><video src="motion/${m.summary.fixture}-side-by-side.webm" controls loop muted></video><figcaption>old left, new right</figcaption></figure>
<figure><video src="motion/${m.summary.fixture}-diff.webm" controls loop muted></video><figcaption>difference heatmap, frame by frame</figcaption></figure></div>
<p>Separately: <a href="motion/${m.summary.fixture}-old.webm">old.webm</a>, <a href="motion/${m.summary.fixture}-new.webm">new.webm</a>.
Worst frame (#${m.summary.worstFrame?.index}): <a href="motion/${m.summary.fixture}-worst-old.png">old</a>, <a href="motion/${m.summary.fixture}-worst-new.png">new</a>, <a href="motion/${m.summary.fixture}-worst-heatmap.png">heatmap</a>.</p>`).join('')}
<h2>Accuracy maps (CPU, before any shader work)</h2>
<p>Red: bilinear height error over 5 cm; yellow: 2 m normal over 0.01; orange both; magenta: cells the atlas flags for the
direct calculation. One pixel per metre, patches packed as in a 2 m layout, blue is ground under -2 m.</p>
<div class="pair"><figure><img src="error-map/error-map-1m-f32.png"><figcaption>1 m texels, R32F, plain bilinear</figcaption></figure>
<figure><img src="error-map/flags-1m-f32.png"><figcaption>1 m texels, R32F, as built: flagged cells (magenta) are calculated directly; nothing left over a gate</figcaption></figure></div>
<div class="pair"><figure><img src="error-map/error-map-2m-f32.png"><figcaption>2 m texels, R32F, plain bilinear</figcaption></figure>
<figure><img src="error-map/flags-2m-f32.png"><figcaption>2 m texels, R32F, flagged (not chosen: a third of the land would be direct)</figcaption></figure></div>
`;
  fs.writeFileSync(`${out}/index.html`, html);
  console.log(`${out}/index.html`);
}

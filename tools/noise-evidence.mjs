// Evidence for perf-bakes phase 6 (the fine ground noise as tiling textures): the same game frames drawn with the
// tiled noise (new) and with the procedural noise it replaces (old), in an iPad-like page (1376x1032 CSS, device
// scale 2, render scale 1.5, MSAA 2). Adapted from look-lever-evidence.mjs.
//
//   capture <out> <moment...>  plays each moment with the page's animation frames stepped one at a time (1/60 s of
//        game a frame). After every step the frame is drawn again for each side from the same state, switching the
//        shaders' NOISE_LIVE define, and read back losslessly: <out>/raw/<moment>-<side>.mkv and <moment>.json.
//   derive <out> [moment...]   playback mp4s, side-by-side crop videos (new|old) and still crops, 2x of the iPad
//        screen, with frame-to-frame change per crop (shimmer and crawl add to it).
//   index <out>                writes <out>/index.html (notes from <out>/notes.html and <out>/moment-notes.json).
// Moments: wood sleeping meadow beach. env: BASE, FRAMES.
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';

const [mode, ...args] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = 1376, H = 1032, DSF = 2, RATIO = 1.5, MSAA = 2;
const SIDES = { new: 'New: tiled noise textures', old: 'Old: procedural noise (as on main)' };

const sweep = (i, period, from, to, rest = 0) => {
  const k = i % (period + rest);
  if (k >= period) return null;
  const t = k / (period - 1), e = t * t * (3 - 2 * t);
  return [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + Math.sin(t * Math.PI) * 18];
};

const MOMENTS = {
  wood: {
    label: 'The Wood: walking the path through the dark wood, fanning the embers',
    query: 'chapter=wood', frames: 600, warm: 60,
    setup: async (page) => {
      await page.waitForTimeout(3000);
      await page.evaluate(() => { const c = __game.story.current; c.restoreCheckpoint('found'); });
      await page.waitForTimeout(1500);
    },
    pointer: 'wind',
  },
  sleeping: {
    label: 'The sleeping island at dawn: the frosted hill as the lane of morning comes down it and the frost goes',
    query: 'chapter=sleeping', frames: 600, warm: 90,
    setup: async (page) => {
      await page.waitForTimeout(3000);
      await page.evaluate(() => { const c = __game.story.current; c.restoreCheckpoint('feather'); });
      await page.waitForTimeout(2500);
    },
    // The glide that brings the morning, started after a second of the frosted night.
    at: { 60: () => __game.story.current.away() },
  },
  meadow: {
    label: 'The Meadow walk through the grass toward the crest',
    query: 'chapter=meadow', frames: 600, warm: 120,
    setup: async (page) => {
      await page.evaluate(() => { const c = __game.story.current; c.skipToCrest(); c.update(0, c.now); __game.rig.cut(c.shot); });
      await page.waitForTimeout(1500);
    },
  },
  beach: {
    label: 'The opening island\'s beach: sand, shallows and surf, as the wind wakes the island',
    query: '', frames: 600, warm: 30,
    pointer: (i) => sweep(i, 90, [W * 0.12, H * (0.42 + 0.05 * (Math.floor(i / 120) % 3))], [W * 0.85, H * 0.46], 30),
  },
};

function manualFrames() {
  const real = window.requestAnimationFrame.bind(window);
  let stepping = false, queue = [], now = 0;
  window.requestAnimationFrame = (callback) => {
    if (!stepping) return real(callback);
    queue.push(callback);
    return queue.length;
  };
  window.__manual = () => { stepping = true; now = performance.now() + 200; };
  window.__step = () => { const q = queue; queue = []; now += 1000 / 60; for (const c of q) c(now); return q.length; };
}

async function capture(out, names) {
  for (const name of names) assert(MOMENTS[name], `unknown moment ${name}`);
  fs.mkdirSync(`${out}/raw`, { recursive: true });
  const { openBrowser } = await import('./lib/browser.mjs');
  const { browser, close } = await openBrowser();
  try {
    for (const name of names) await captureMoment(browser, name, out);
  } finally {
    await close();
  }
}

async function captureMoment(browser, name, out) {
  const moment = MOMENTS[name];
  const frames = Number(process.env.FRAMES ?? moment.frames);
  const encoders = {};
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: 1 << 26 });
  server.on('connection', (socket) => {
    let header = null, queue = Promise.resolve();
    socket.on('message', (data, binary) => {
      if (!binary) { header = JSON.parse(data.toString()); return; }
      const { side, w, h } = header;
      assert.equal(data.length, w * h * 4);
      queue = queue.then(async () => {
        encoders[side] ??= lossless(`${out}/raw/${name}-${side}.mkv`, w, h);
        await encoders[side].write(data);
        socket.send('ok');
      });
    });
  });
  await new Promise((r) => server.on('listening', r));
  const sink = `ws://127.0.0.1:${server.address().port}`;
  const errors = [], log = [];
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  try {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
    await page.addInitScript(manualFrames);
    await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.route('**/src/main.ts*', async (route) => {
      const response = await route.fetch();
      let source = await response.text();
      const draw = 'drawJourneyRooms(rooms, roomObjects, drawRooms);';
      assert(source.split(draw).length === 2);
      source = source.replace(draw, `${draw} if (window.__evidence) window.__evidence.redraw = () => drawJourneyRooms(rooms, roomObjects, drawRooms);`);
      source += `
window.__evidence = {
  redraw: null, socket: null, acks: [], live: false,
  /** Flips every shader between the tiles and the procedural noise; the blades' fragment programs never call it. */
  setNoise(live) {
    if (live === this.live) return;
    this.live = live;
    const from = '#define NOISE_LIVE ' + (live ? 0 : 1), to = '#define NOISE_LIVE ' + (live ? 1 : 0);
    const blades = new Set(grass.group.children.filter((o) => o.isMesh).map((o) => o.material));
    const mats = new Set([terrain.mesh.material, water.mesh.material, ...grass.lods.map((l) => l.tableMat)]);
    scene.traverse((o) => { for (const m of [o.material].flat()) if (m?.fragmentShader) mats.add(m); });
    let tables = false;
    for (const m of mats) for (const key of ['vertexShader', 'fragmentShader']) {
      if (key === 'fragmentShader' && blades.has(m)) continue;
      if (!m[key].includes(from)) continue;
      m[key] = m[key].split(from).join(to); m.needsUpdate = true;
      tables ||= grass.lods.some((l) => l.tableMat === m);
    }
    if (tables) { grass.tablesDirty = true; grass.bake(renderer); }
  },
  async capture(sink) {
    if (!this.socket) {
      this.socket = new WebSocket(sink);
      this.socket.binaryType = 'arraybuffer';
      this.socket.onmessage = () => this.acks.shift()();
      await new Promise((r) => { this.socket.onopen = r; });
    }
    const gl = renderer.getContext();
    for (const side of ['new', 'old']) {
      this.setNoise(side === 'old');
      this.redraw();
      gl.finish();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const ack = new Promise((r) => this.acks.push(r));
      this.socket.send(JSON.stringify({ side, w, h }));
      this.socket.send(px);
      await ack;
    }
    this.setNoise(false);
  },
};`;
      await route.fulfill({ response, body: source });
    });
    await page.goto(`${BASE}?shot&${moment.query}&ratio=${RATIO}&msaa=${MSAA}&analytics=0&progress=0`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await page.waitForTimeout(1000);
    if (moment.setup) await moment.setup(page);
    await page.evaluate(() => window.__manual());
    await page.waitForTimeout(300);
    const step = () => page.evaluate(() => window.__step());
    for (let i = 0; i < moment.warm; i++) await step();
    const t0 = Date.now();
    let swept = 0;
    for (let i = 0; i < frames; i++) {
      if (moment.at?.[i]) await page.evaluate(moment.at[i]);
      let at = null;
      if (moment.pointer === 'wind') {
        const p = await page.evaluate(() => { const g = __game, w = g.story.current.windInvitation; if (!w) return null; const q = w.clone().project(g.rig.camera); return q.z < 1 ? [(q.x + 1) / 2, (1 - q.y) / 2] : null; });
        if (p) { const k = swept++ % 40, t = k / 39; at = [p[0] * W + (Math.floor(swept / 40) % 2 ? 1 - t : t) * 240 - 120, p[1] * H + Math.sin(t * Math.PI) * 10]; }
      } else if (moment.pointer) at = moment.pointer(i);
      if (at) await page.mouse.move(Math.max(4, Math.min(W - 4, at[0])), Math.max(4, Math.min(H - 4, at[1])));
      await step();
      await page.evaluate((sink) => window.__evidence.capture(sink), sink);
      if (i % 60 === 0) {
        const state = await page.evaluate(() => ({ story: __game.story.name, beat: __game.story.current.beat ?? null, camera: __game.rig.camera.position.toArray().map((v) => +v.toFixed(2)) }));
        log.push({ frame: i, ...state });
        console.log(JSON.stringify({ name, frame: i, ...state, perFrameMs: Math.round((Date.now() - t0) / (i + 1)) }));
      }
    }
  } finally {
    await page.close();
    server.close();
    await Promise.all(Object.values(encoders).map((e) => e.end()));
  }
  fs.writeFileSync(`${out}/raw/${name}.json`, JSON.stringify({ name, label: moment.label, frames, viewport: [W, H], dsf: DSF, ratio: RATIO, msaa: MSAA, log, errors }, null, 1));
  assert.deepEqual(errors, []);
}

function lossless(file, w, h) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', '60', '-i', '-',
    '-vf', 'vflip', '-c:v', 'ffv1', '-level', '3', '-threads', '8', '-slices', '16', '-pix_fmt', 'gbrp', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (c) => (c ? reject(new Error(`ffmpeg ${c}`)) : resolve())));
  return {
    write: (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r))),
    end: () => { ff.stdin.end(); return done; },
  };
}

function ff(argv) {
  return execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...argv], { maxBuffer: 1 << 28 }).toString();
}

/** Crops in CSS pixels of the 1376x1032 page, from <out>/crops.json ({moment: [{label, x, y, frame}]}). */
const crops = (out) => (fs.existsSync(`${out}/crops.json`) ? JSON.parse(fs.readFileSync(`${out}/crops.json`, 'utf8')) : {});
const GAP = 16;

function cropChain(r, scale = 2) {
  const px = (v) => Math.round(v * RATIO);
  return `crop=${px(r.w)}:${px(r.h)}:${px(r.x)}:${px(r.y)},scale=${r.w * DSF}:${r.h * DSF}:flags=bilinear,scale=${r.w * DSF * scale}:${r.h * DSF * scale}:flags=neighbor`;
}

const H264 = (crf) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-g', '30', '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart'];
const TO_YUV = 'scale=out_color_matrix=bt709:out_range=tv';

function psnrOf(a, b) {
  const luma = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv444p';
  const r = spawnSync('ffmpeg', ['-hide_banner', '-r', '60', '-i', a, '-r', '60', '-i', b, '-lavfi',
    `[0:v]${luma}[x];[1:v]${luma}[y];[x][y]psnr`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = /PSNR y:([0-9.]+|inf)/.exec(r.stderr);
  assert(m, r.stderr.slice(-2000));
  return m[1] === 'inf' ? Infinity : +(+m[1]).toFixed(1);
}

function flickerOf(file, chain) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `${chain},format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`,
    '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const v = [...r.stdout.matchAll(/YAVG=([0-9.]+)/g)].map((m) => +m[1]);
  assert(v.length > 100, r.stderr);
  return +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2);
}

function derive(out, only) {
  const moments = (only.length ? only : Object.keys(MOMENTS)).filter((m) => fs.existsSync(`${out}/raw/${m}.json`));
  for (const dir of ['video', 'crops']) fs.mkdirSync(`${out}/${dir}`, { recursive: true });
  for (const m of moments) {
    const meta = JSON.parse(fs.readFileSync(`${out}/raw/${m}.json`, 'utf8'));
    const raw = (s) => `${out}/raw/${m}-${s}.mkv`;
    const report = { label: MOMENTS[m].label, frames: meta.frames, videos: {}, crops: [] };
    for (const s of Object.keys(SIDES)) {
      const file = `${out}/video/${m}-${s}.mp4`;
      if (!fs.existsSync(file)) ff(['-i', raw(s), '-vf', TO_YUV, ...H264(12), file]);
      report.videos[s] = { file: `video/${m}-${s}.mp4`, mb: +(fs.statSync(file).size / 1e6).toFixed(1), encodePsnr: psnrOf(raw(s), file) };
    }
    report.newVsOldPsnr = psnrOf(raw('new'), raw('old'));
    (crops(out)[m] ?? []).map((r) => ({ w: 320, h: 240, ...r })).forEach((r, i) => {
      const id = `${m}-${i + 1}`;
      const crop = { ...r, id, stills: {}, flicker: {} };
      for (const s of Object.keys(SIDES)) {
        crop.flicker[s] = flickerOf(raw(s), cropChain(r, 1));
        const png = `${out}/crops/${id}-${s}.png`;
        if (!fs.existsSync(png)) ff(['-ss', String(r.frame / 60), '-i', raw(s), '-frames:v', '1', '-vf', cropChain(r), png]);
        crop.stills[s] = `crops/${id}-${s}.png`;
      }
      const file = `${out}/crops/${id}-new-vs-old.mp4`;
      if (!fs.existsSync(file)) ff(['-i', raw('new'), '-i', raw('old'), '-filter_complex',
        `[0:v]${cropChain(r)},pad=iw+${GAP}:ih:0:0:0x202020[x];[1:v]${cropChain(r)}[y];[x][y]hstack,${TO_YUV}`, ...H264(10), file]);
      crop.video = `crops/${id}-new-vs-old.mp4`;
      report.crops.push(crop);
      console.log(JSON.stringify({ crop: id, flicker: crop.flicker }));
    });
    fs.writeFileSync(`${out}/report-${m}.json`, JSON.stringify(report, null, 1));
    console.log(JSON.stringify({ moment: m, psnr: report.newVsOldPsnr, crops: report.crops.length }));
  }
}

function writeIndex(out) {
  const report = Object.fromEntries(Object.keys(MOMENTS).filter((m) => fs.existsSync(`${out}/report-${m}.json`))
    .map((m) => [m, JSON.parse(fs.readFileSync(`${out}/report-${m}.json`, 'utf8'))]));
  const notes = fs.existsSync(`${out}/notes.html`) ? fs.readFileSync(`${out}/notes.html`, 'utf8') : '';
  const momentNotes = fs.existsSync(`${out}/moment-notes.json`) ? JSON.parse(fs.readFileSync(`${out}/moment-notes.json`, 'utf8')) : {};
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fine ground noise as tiling textures: before and after</title>
<style>
body{font:15px/1.5 system-ui;background:#181818;color:#ddd;max-width:1420px;margin:24px auto;padding:0 16px}
h2{margin-top:48px;border-top:1px solid #444;padding-top:16px}h3{margin:28px 0 8px}
.stage{position:relative;width:100%;max-width:1376px;aspect-ratio:1376/1032;background:#000}
.stage.actual{width:1376px;max-width:none}
.stage video{position:absolute;inset:0;width:100%;height:100%;opacity:0}.stage video.on{opacity:1}
.bar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center}
button{font:inherit;background:#333;color:#eee;border:1px solid #555;border-radius:6px;padding:4px 10px;cursor:pointer}
button.on{background:#c9a227;color:#111;border-color:#c9a227}
.showing{font-weight:600;color:#fc6;min-width:24em}
.crop img{width:100%;image-rendering:pixelated;display:block}.two{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
video.pair{width:100%;display:block;background:#000}figure{margin:0}figcaption{color:#999;font-size:13px}
table{border-collapse:collapse}td,th{padding:3px 10px;border-bottom:1px solid #333;text-align:right}td:first-child,th:first-child{text-align:left}
.note{background:#222;border-left:3px solid #c9a227;padding:8px 14px;margin:10px 0}
</style>
<h1>Fine ground noise as tiling textures: before and after</h1>
${notes}
<h2>How this was made</h2>
<p>Each moment was played once in headless Chrome (Metal) at 1376x1032, device scale 2, render scale 1.5 with MSAA 2
(High, as on the iPad), with the page's animation frames stepped one at a time: every frame is 1/60 s of game, so the
clips play in real time at 60 fps. After each frame the game drew the same frame twice more from the same state, once
with the tiled noise (new) and once with the procedural noise it replaces (old, as on main), and each was read back
losslessly. So new and old are the very same moment; only the noise differs. Encoding: H.264 CRF 12 (full frames) and
CRF 10 (crops). Crops are 320x240 CSS pixels, scaled to the iPad's 2 device pixels per CSS pixel, then enlarged 2x.</p>
<table><tr><th>Moment</th><th>Encode vs lossless, new / old</th><th>New vs old</th></tr>
${Object.entries(report).map(([m, r]) => `<tr><td><a href="#${m}">${r.label}</a></td><td>${r.videos.new.encodePsnr} / ${r.videos.old.encodePsnr} dB</td><td>${r.newVsOldPsnr} dB</td></tr>`).join('')}
</table>
<p style="color:#999;font-size:13px">Luma PSNR in dB over every frame: higher is closer.</p>
<h2>Controls</h2>
<p>Keys work on the player under the pointer: <b>1</b> new, <b>2</b> old, <b>space</b> play or pause, <b>,</b> and
<b>.</b> step one frame, <b>f</b> flips between new and old every half second. Paused, both show the identical frame.</p>
${Object.entries(report).map(([m, r]) => `<h2 id="${m}">${r.label}</h2>
${momentNotes[m] ? `<div class="note">${momentNotes[m]}</div>` : ''}
<p>${r.frames} frames, ${(r.frames / 60).toFixed(0)} s of game at 60 fps.</p>
<div class="player">
<div class="bar"><button data-play>Play</button><button data-side="new">New: tiles</button><button data-side="old">Old: procedural</button><button data-flip>Flip</button><button data-back>&lt; frame</button><button data-next>frame &gt;</button><button data-actual>1:1 as on the iPad</button><span class="showing"></span></div>
<div class="stage">${Object.keys(SIDES).map((s) => `<video data-v="${s}" src="${r.videos[s].file}" muted loop playsinline preload="auto"></video>`).join('')}</div>
</div>
${r.crops.map((c) => `<h3>${c.label}</h3>
<p style="color:#999;font-size:13px">Frame-to-frame change in this window (shimmer and crawl add to it): new ${c.flicker.new}, old ${c.flicker.old}.</p>
<div class="two crop">${Object.keys(SIDES).map((s) => `<figure><img src="${c.stills[s]}" loading="lazy"><figcaption>${SIDES[s]}, frame ${c.frame}, 2x of the iPad screen</figcaption></figure>`).join('')}</div>
<figure><video class="pair" src="${c.video}" controls muted loop playsinline preload="metadata"></video><figcaption>In motion, new left and old right, 2x of the iPad screen, frame-locked</figcaption></figure>`).join('')}`).join('')}
<script>
const label = ${JSON.stringify(SIDES)};
let hovered = null;
for (const p of document.querySelectorAll('.player')) {
  const vids = Object.fromEntries([...p.querySelectorAll('video')].map((v) => [v.dataset.v, v]));
  const show = p.querySelector('.showing');
  let current = 'new', flip = null;
  const master = () => vids[current];
  const set = (s) => {
    const t = master().currentTime;
    current = s;
    for (const [k, v] of Object.entries(vids)) v.classList.toggle('on', k === s);
    if (Math.abs(master().currentTime - t) > 0.004) master().currentTime = t;
    for (const b of p.querySelectorAll('[data-side]')) b.classList.toggle('on', b.dataset.side === s);
    show.textContent = label[s];
  };
  const seek = (t) => { for (const v of Object.values(vids)) v.currentTime = t; };
  const frameOf = () => Math.round(master().currentTime * 60 - 0.5);
  const step = (d) => { for (const v of Object.values(vids)) v.pause(); seek((Math.max(0, frameOf() + d) + 0.5) / 60); p.querySelector('[data-play]').textContent = 'Play'; };
  const toggle = () => {
    const playing = !master().paused;
    if (playing) { for (const v of Object.values(vids)) v.pause(); seek(master().currentTime); }
    else { seek(master().currentTime); for (const v of Object.values(vids)) v.play(); }
    p.querySelector('[data-play]').textContent = playing ? 'Play' : 'Pause';
  };
  const sync = () => {
    const m = master();
    if (!m.paused) for (const v of Object.values(vids)) if (v !== m && Math.abs(v.currentTime - m.currentTime) > 0.03) v.currentTime = m.currentTime;
    requestAnimationFrame(sync);
  };
  requestAnimationFrame(sync);
  const setFlip = (on) => {
    clearInterval(flip); flip = null;
    if (on) flip = setInterval(() => set(current === 'new' ? 'old' : 'new'), 500);
    p.querySelector('[data-flip]').classList.toggle('on', !!on);
  };
  p.querySelector('[data-play]').onclick = toggle;
  for (const b of p.querySelectorAll('[data-side]')) b.onclick = () => set(b.dataset.side);
  p.querySelector('[data-flip]').onclick = () => setFlip(!flip);
  p.querySelector('[data-back]').onclick = () => step(-1);
  p.querySelector('[data-next]').onclick = () => step(1);
  p.querySelector('[data-actual]').onclick = (e) => { e.target.classList.toggle('on', p.querySelector('.stage').classList.toggle('actual')); };
  p.addEventListener('pointerenter', () => { hovered = { set, toggle, step, setFlip, flipping: () => !!flip }; });
  set('new');
}
addEventListener('keydown', (e) => {
  if (!hovered) return;
  const k = e.key;
  if (k === '1') hovered.set('new'); else if (k === '2') hovered.set('old');
  else if (k === ' ') { e.preventDefault(); hovered.toggle(); } else if (k === ',') hovered.step(-1); else if (k === '.') hovered.step(1);
  else if (k === 'f') hovered.setFlip(!hovered.flipping());
});
</script>`;
  fs.writeFileSync(`${out}/index.html`, html);
  console.log(`${out}/index.html`);
}

if (mode === 'capture') await capture(args[0], args.slice(1));
else if (mode === 'derive') derive(args[0], args.slice(1));
else if (mode === 'index') writeIndex(args[0]);
else throw new Error('usage: capture <out> <moment...> | derive <out> [moment...] | index <out>');

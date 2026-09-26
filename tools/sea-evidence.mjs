// Evidence for the sea (perf-bakes phase S), in an iPad-like page (1376x1032 CSS, device scale 2, ratio 1.5, MSAA 2).
//
//   capture <out> <moment...>  plays each moment with the page's animation frames stepped one at a time (shot mode:
//        1/60 s of game per frame, so the clips are real time at 60 fps whatever the machine's load). After every
//        step the frame is drawn again once per side from the same state and read back losslessly:
//        <out>/raw/<moment>-<side>.mkv (RGB, FFV1) and <moment>.json, with each side's per-frame difference from the first.
//   derive <out> [moment...]   playback mp4s, side-by-side crops and the frame-to-frame change per side (judder).
//   index <out>                <out>/index.html (notes from <out>/notes.html and <out>/moment-notes.json).
// Sides:
//   alt    the game's own frame: the ordinary sea's reflection redrawn every other frame (S1), the sky mirror every frame.
//   every  the same frame with the reflection redrawn now into a spare target, as before S1. The game's own target,
//          matrix and cadence are restored afterwards, so the alt side never sees it.
//   fine   the game's own frame (the sea's fog per pixel); coarse the same frame with COARSE_FOG (S4, `seafog=coarse`).
// Moments: sail mirror approach (S1), horizon crossing island (S4). env: BASE, FRAMES.
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';

const [mode, ...args] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = 1376, H = 1032, DSF = 2, RATIO = 1.5, MSAA = 2;
const SIDES = {
  every: 'Before: the sea\'s reflection redrawn every frame',
  alt: 'After (S1): redrawn every other frame',
  fine: 'Today: the sea\'s haze worked out per pixel',
  coarse: 'S4: the haze worked out per vertex and blended (seafog=coarse)',
};

/** Pointer path in CSS pixels for frame i of the capture, or null to leave the pointer where it is. */
const MOMENTS = {
  sail: {
    part: 'S1', label: 'Sailing past the kite island, the boat and island reflected, the camera panning 20 degrees either way',
    query: 'chapter=crossing', frames: 600, warm: 240, pointer: 'boat', turn: { amp: 20, period: 4 }, sides: ['every', 'alt'], video: true,
  },
  mirror: {
    part: 'S1', label: 'The sky mirror, on the flat, panning', query: 'chapter=mirror', frames: 240, warm: 180,
    turn: { amp: 20, period: 4 }, sides: ['every', 'alt'], video: false,
  },
  approach: {
    part: 'S1', label: 'The open sea toward the mirror (the mirror journey), panning', query: 'chapter=sea', frames: 240, warm: 180,
    turn: { amp: 20, period: 4 }, sides: ['every', 'alt'], video: false,
  },
  horizon: {
    part: 'S4', label: 'The open sea toward the horizon at night, the camera panning slowly', query: 'chapter=sea', frames: 600, warm: 240,
    turn: { amp: 15, period: 10 }, sides: ['fine', 'coarse'], video: true,
  },
  crossing: {
    part: 'S4', label: 'A crossing: sailing past the kite island', query: 'chapter=crossing', frames: 600, warm: 240,
    pointer: 'boat', sides: ['fine', 'coarse'], video: true,
  },
  island: {
    part: 'S4', label: 'The first island from the water, a still camera', query: 'chapter=crossing&cam=40,3.5,-235,0,6,-40', frames: 480, warm: 120,
    sides: ['fine', 'coarse'], video: true,
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

const PAGE = `
window.__evidence = {
  redraw: null, socket: null, acks: [], turned: 0, count: 0, turnSpec: null,
  unturn(camera) { if (this.turned) camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -this.turned); this.turned = 0; },
  turn(camera) {
    const s = this.turnSpec; if (!s) return;
    this.turned = THREE.MathUtils.degToRad(s.amp) * Math.sin(2 * Math.PI * this.count++ / 60 / s.period);
    camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), this.turned);
    camera.updateMatrixWorld();
  },
  still(draw) { water.update = () => {}; try { draw(); } finally { delete water.update; } },
  side(name) {
    const mat = water.mesh.material;
    if (name === 'alt' || name === 'fine') return this.still(this.redraw);
    if (name === 'coarse') {
      mat.defines.COARSE_FOG = 1; mat.needsUpdate = true;
      try { this.still(this.redraw); } finally { delete mat.defines.COARSE_FOG; mat.needsUpdate = true; }
      return;
    }
    const refl = water.reflection;
    const saved = { frame: water.frame, target: refl.target, matrix: refl.matrix.clone(), from: refl.renderedFrom.clone(),
      look: refl.renderedLook.clone(), rendered: refl.rendered, rooms: water.renderedRooms.clone(), room: water.renderedRoom.clone(),
      every: water.seaMirrorEvery };
    this.spare ??= refl.target.clone();
    refl.target = this.spare; mat.uniforms.uMirror.value = this.spare.texture; water.seaMirrorEvery = 1;
    try { this.redraw(); } finally {
      refl.target = saved.target; mat.uniforms.uMirror.value = saved.target.texture; refl.matrix.copy(saved.matrix);
      refl.renderedFrom.copy(saved.from); refl.renderedLook.copy(saved.look); refl.rendered = saved.rendered;
      water.frame = saved.frame; water.renderedRooms.copy(saved.rooms); water.renderedRoom.copy(saved.room); water.seaMirrorEvery = saved.every;
    }
  },
  async capture(sides, sink, stream) {
    if (stream && !this.socket) {
      this.socket = new WebSocket(sink);
      this.socket.binaryType = 'arraybuffer';
      this.socket.onmessage = () => this.acks.shift()();
      await new Promise((r) => { this.socket.onopen = r; });
    }
    const gl = renderer.getContext(), diffs = {};
    let first = null;
    for (const side of sides) {
      this.side(side);
      gl.finish();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (!first) first = px;
      else {
        let max = 0, changed = 0, total = 0;
        for (let i = 0; i < px.length; i++) { const d = Math.abs(px[i] - first[i]); if (d) { changed++; total += d; if (d > max) max = d; } }
        diffs[side] = { max, changed, mean: total / px.length };
      }
      if (stream) {
        const ack = new Promise((r) => this.acks.push(r));
        this.socket.send(JSON.stringify({ side, w, h }));
        this.socket.send(px);
        await ack;
      }
    }
    const boat = __game.boat.position.clone().project(rig.camera);
    return { diffs, boat: [(boat.x + 1) / 2, (1 - boat.y) / 2] };
  },
};`;

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
  const errors = [], log = [], perFrame = [];
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
      const prepare = '  prepareFrame(dt);\n  // The boat belongs';
      const poll = '  pollReadbacks();\n  input.beginFrame();';
      for (const hook of [draw, prepare, poll]) assert.equal(source.split(hook).length, 2, `hook ${hook}`);
      source = source.replace(draw, `${draw} if (window.__evidence) window.__evidence.redraw = () => drawJourneyRooms(rooms, roomObjects, drawRooms);`)
        .replace(prepare, `  window.__evidence?.turn(rig.camera);\n${prepare}`)
        .replace(poll, `  window.__evidence?.unturn(rig.camera);\n${poll}`);
      await route.fulfill({ response, body: source + PAGE });
    });
    await page.goto(`${BASE}?shot&${moment.query}&ratio=${RATIO}&msaa=${MSAA}&analytics=0&progress=0`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__manual());
    await page.waitForTimeout(300);
    const step = () => page.evaluate(() => window.__step());
    for (let i = 0; i < moment.warm; i++) await step();
    await page.evaluate((turn) => { window.__evidence.turnSpec = turn ?? null; }, moment.turn);
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      if (moment.pointer === 'boat') {
        const p = await page.evaluate(() => { const g = __game, p = g.boat.position.clone().project(g.rig.camera); return [(p.x + 1) / 2, (1 - p.y) / 2]; });
        const k = i % 50;
        const at = k <= 36 ? [p[0] * W + (k / 36 - 0.5) * 260, p[1] * H + 40 + Math.sin((k / 36) * Math.PI) * 8] : [W - 3, H - 3];
        await page.mouse.move(Math.max(4, Math.min(W - 4, at[0])), Math.max(4, Math.min(H - 4, at[1])));
      }
      await step();
      const result = await page.evaluate(({ sides, sink, stream }) => window.__evidence.capture(sides, sink, stream), { sides: moment.sides, sink, stream: moment.video });
      perFrame.push(result);
      if (i % 60 === 0) {
        const state = await page.evaluate(() => ({ story: __game.story.name, camera: __game.rig.camera.position.toArray().map((v) => +v.toFixed(2)), boat: __game.boat.position.toArray().map((v) => +v.toFixed(1)) }));
        log.push({ frame: i, ...state });
        console.log(JSON.stringify({ name, frame: i, ...state, diffs: result.diffs, perFrameMs: Math.round((Date.now() - t0) / (i + 1)) }));
      }
    }
  } finally {
    await page.close();
    server.close();
    await Promise.all(Object.values(encoders).map((e) => e.end()));
  }
  fs.writeFileSync(`${out}/raw/${name}.json`, JSON.stringify({ name, label: moment.label, frames, viewport: [W, H], dsf: DSF, ratio: RATIO, msaa: MSAA, sides: moment.sides, log, perFrame, errors }));
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

/** Regions to enlarge, in CSS pixels of the 1376x1032 page: x, y of a 320x240 window. */
const CROPS = {
  sail: [{ label: 'The boat and its reflection, followed as the camera pans', track: 'boat', w: 400, h: 300 }, { label: 'The middle of the frame: the island\'s shore, its reflection and the sea', x: 488, y: 330, w: 400, h: 300 }],
  horizon: [{ label: 'The horizon', x: 520, y: 170 }, { label: 'Far water under the haze', x: 120, y: 260 }],
  crossing: [{ label: 'The horizon behind the boat', x: 520, y: 150 }, { label: 'Far water and the island\'s edge', x: 60, y: 250 }],
  island: [{ label: 'The island\'s foot and the water before it', x: 520, y: 360 }, { label: 'The horizon beside the island', x: 1000, y: 330 }],
};

const H264 = (crf) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-g', '30', '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart'];
const TO_YUV = 'scale=out_color_matrix=bt709:out_range=tv';
const GAP = 16;

function cropChain(r, scale = 2) {
  const px = (v) => Math.round(v * RATIO);
  const crop = r.commands ? `sendcmd=f=${r.commands},crop@c=${px(r.w)}:${px(r.h)}:0:0` : `crop=${px(r.w)}:${px(r.h)}:${px(r.x)}:${px(r.y)}`;
  return `${crop},scale=${r.w * DSF}:${r.h * DSF}:flags=bilinear,scale=${r.w * DSF * scale}:${r.h * DSF * scale}:flags=neighbor`;
}

/** Frame-to-frame mean luma change (0-255) in the crop, per frame. */
function changeSeries(file, chain) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `${chain},format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`,
    '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const v = [...r.stdout.matchAll(/YAVG=([0-9.]+)/g)].map((m) => +m[1]);
  assert(v.length > 100, r.stderr);
  return v;
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

function derive(out, only) {
  const moments = (only.length ? only : Object.keys(MOMENTS)).filter((m) => fs.existsSync(`${out}/raw/${m}.json`));
  for (const dir of ['video', 'crops']) fs.mkdirSync(`${out}/${dir}`, { recursive: true });
  for (const m of moments) {
    const meta = JSON.parse(fs.readFileSync(`${out}/raw/${m}.json`, 'utf8'));
    const [a, b] = meta.sides;
    const report = { part: MOMENTS[m].part, label: meta.label, frames: meta.frames, sides: meta.sides, videos: {}, crops: [], diff: {} };
    const d = meta.perFrame.map((f) => f.diffs[b]);
    report.diff = { max: Math.max(...d.map((x) => x.max)), framesChanged: d.filter((x) => x.changed).length,
      meanChanged: Math.round(mean(d.map((x) => x.changed / 4))), worstChanged: Math.max(...d.map((x) => x.changed / 4)) };
    if (MOMENTS[m].video) {
      const raw = (s) => `${out}/raw/${m}-${s}.mkv`;
      for (const s of meta.sides) {
        const file = `${out}/video/${m}-${s}.mp4`;
        if (!fs.existsSync(file)) ff(['-i', raw(s), '-vf', TO_YUV, ...H264(12), file]);
        report.videos[s] = { file: `video/${m}-${s}.mp4`, mb: +(fs.statSync(file).size / 1e6).toFixed(1) };
      }
      const diffFile = `${out}/video/${m}-difference.mp4`;
      if (!fs.existsSync(diffFile)) ff(['-i', raw(a), '-i', raw(b), '-filter_complex', `[0:v][1:v]blend=all_mode=difference,lutrgb=r=val*8:g=val*8:b=val*8,${TO_YUV}`, ...H264(16), diffFile]);
      report.videos.difference = { file: `video/${m}-difference.mp4`, mb: +(fs.statSync(diffFile).size / 1e6).toFixed(1) };
      (CROPS[m] ?? []).forEach((c, i) => {
        const r = { w: 320, h: 240, ...c };
        const id = `${m}-${i + 1}`;
        if (c.track) {
          // The window follows the boat (its reflection below it), moved frame by frame with sendcmd.
          r.commands = `${out}/crops/${id}.cmd`;
          const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
          fs.writeFileSync(r.commands, meta.perFrame.map((f, k) => {
            const x = Math.round(clamp(f.boat[0] * W - r.w / 2, 0, W - r.w) * RATIO), y = Math.round(clamp(f.boat[1] * H - r.h * 0.4, 0, H - r.h) * RATIO);
            return `${(k / 60).toFixed(4)} crop@c x ${x}, crop@c y ${y};`;
          }).join('\n'));
        }
        const crop = { label: c.label, id, w: r.w, h: r.h, change: {} };
        for (const s of meta.sides) {
          const series = changeSeries(raw(s), cropChain(r, 1));
          const even = series.filter((_, k) => k % 2 === 0), odd = series.filter((_, k) => k % 2 === 1);
          crop.change[s] = { mean: +mean(series).toFixed(3), even: +mean(even).toFixed(3), odd: +mean(odd).toFixed(3) };
        }
        const file = `${out}/crops/${id}.mp4`;
        if (!fs.existsSync(file)) ff(['-i', raw(a), '-i', raw(b), '-filter_complex',
          `[0:v]${cropChain(r, r.w > 320 ? 1 : 2)},pad=iw+${GAP}:ih:0:0:0x202020[x];[1:v]${cropChain(r, r.w > 320 ? 1 : 2)}[y];[x][y]hstack,${TO_YUV}`, ...H264(10), file]);
        crop.video = `crops/${id}.mp4`;
        report.crops.push(crop);
      });
    }
    fs.writeFileSync(`${out}/report-${m}.json`, JSON.stringify(report, null, 1));
    console.log(JSON.stringify({ moment: m, ...report }));
  }
}

function writeIndex(out) {
  const report = Object.fromEntries(Object.keys(MOMENTS).filter((m) => fs.existsSync(`${out}/report-${m}.json`))
    .map((m) => [m, JSON.parse(fs.readFileSync(`${out}/report-${m}.json`, 'utf8'))]));
  const notes = fs.existsSync(`${out}/notes.html`) ? fs.readFileSync(`${out}/notes.html`, 'utf8') : '';
  const momentNotes = fs.existsSync(`${out}/moment-notes.json`) ? JSON.parse(fs.readFileSync(`${out}/moment-notes.json`, 'utf8')) : {};
  const player = (m, r) => `<div class="player">
<div class="bar"><button data-play>Play</button>${r.sides.map((s, i) => `<button data-side="${s}">${i + 1}: ${SIDES[s]}</button>`).join('')}<button data-side="difference">3: difference x8</button><button data-flip>Flip</button><button data-back>&lt; frame</button><button data-next>frame &gt;</button><span class="showing"></span></div>
<div class="stage">${[...r.sides, 'difference'].map((s) => `<video data-v="${s}" data-label="${s === 'difference' ? 'The two sides\' difference, 8 times brighter' : SIDES[s]}" src="${r.videos[s].file}" muted loop playsinline preload="auto"></video>`).join('')}</div>
</div>`;
  const section = (m, r) => `<h3 id="${m}">${r.label}</h3>
${momentNotes[m] ? `<div class="note">${momentNotes[m]}</div>` : ''}
<p>${r.frames} frames, ${(r.frames / 60).toFixed(0)} s at 60 fps. The two sides differ by at most ${r.diff.max}/255, in ${r.diff.framesChanged} of ${r.frames} frames
(${r.diff.meanChanged.toLocaleString()} pixels a frame on average, ${r.diff.worstChanged.toLocaleString()} at worst, of ${(W * RATIO * H * RATIO).toLocaleString()}).</p>
${Object.keys(r.videos).length ? player(m, r) : ''}
${r.crops.map((c) => `<h4>${c.label}</h4><figure><video class="pair" src="${c.video}" controls muted loop playsinline preload="metadata"></video>
<figcaption>${SIDES[r.sides[0]]} left, ${SIDES[r.sides[1]]} right; ${c.w ?? 320}x${c.h ?? 240} CSS pixels at ${(c.w ?? 320) > 320 ? '1x' : '2x'} of the iPad screen, frame-locked. Frame-to-frame change here (mean luma, even / odd frames):
${r.sides.map((s) => `${s} ${c.change[s].mean} (${c.change[s].even} / ${c.change[s].odd})`).join(', ')}</figcaption></figure>`).join('')}`;
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The sea: S1 reflection cadence and S4 coarser haze</title>
<style>
body{font:15px/1.5 system-ui;background:#181818;color:#ddd;max-width:1420px;margin:24px auto;padding:0 16px}
h2{margin-top:48px;border-top:1px solid #444;padding-top:16px}h3{margin:36px 0 8px}h4{margin:18px 0 6px;color:#bbb}
.stage{position:relative;width:100%;max-width:1376px;aspect-ratio:1376/1032;background:#000}
.stage video{position:absolute;inset:0;width:100%;height:100%;opacity:0}.stage video.on{opacity:1}
.bar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center}
button{font:inherit;background:#333;color:#eee;border:1px solid #555;border-radius:6px;padding:4px 10px;cursor:pointer}
button.on{background:#c9a227;color:#111;border-color:#c9a227}
.showing{font-weight:600;color:#fc6}
video.pair{width:100%;display:block;background:#000}figure{margin:0}figcaption{color:#999;font-size:13px}
table{border-collapse:collapse}td,th{padding:3px 10px;border-bottom:1px solid #333;text-align:right}td:first-child,th:first-child{text-align:left}
.note{background:#222;border-left:3px solid #c9a227;padding:8px 14px;margin:10px 0}
</style>
<h1>The sea: S1 reflection cadence and S4 coarser haze</h1>
${notes}
<h2>How this was made</h2>
<p>Each moment was played once in headless Chrome (Metal) at the iPad's size (1376x1032 CSS, 2 device pixels per CSS pixel,
High: 1.5x render scale, MSAA 2), with the page's animation frames stepped one at a time: every frame is 1/60 s of game, so the
clips play in real time at 60 fps. After each frame the game drew the same frame again once per side and each was read back
losslessly, so both sides are the very same moment. For S1 the "before" side redraws the reflection into a spare target and then
puts the game's own reflection, matrix and cadence back, so the "after" side runs exactly as the game does. Encoding: H.264, CRF 12
for full frames, CRF 10 for the enlarged crops (2x of the iPad screen, frame-locked side by side).</p>
<p>Keys work on the player under the pointer: <b>1</b> and <b>2</b> the two sides, <b>3</b> the difference, <b>space</b> play or pause,
<b>,</b> and <b>.</b> step a frame, <b>f</b> flips between the two sides every half second.</p>
<h2>S1: the ordinary sea's reflection every other frame</h2>
${Object.entries(report).filter(([, r]) => r.part === 'S1').map(([m, r]) => section(m, r)).join('')}
<h2>S4: coarser haze on the sea (evidence only; not the default)</h2>
${Object.entries(report).filter(([, r]) => r.part === 'S4').map(([m, r]) => section(m, r)).join('')}
<script>
let hovered = null;
for (const p of document.querySelectorAll('.player')) {
  const vids = Object.fromEntries([...p.querySelectorAll('video')].map((v) => [v.dataset.v, v]));
  const names = Object.keys(vids), show = p.querySelector('.showing');
  let current = names[0], flip = null;
  const master = () => vids[current];
  const set = (s) => {
    const t = master().currentTime;
    current = s;
    for (const [k, v] of Object.entries(vids)) v.classList.toggle('on', k === s);
    if (Math.abs(master().currentTime - t) > 0.004) master().currentTime = t;
    for (const b of p.querySelectorAll('[data-side]')) b.classList.toggle('on', b.dataset.side === s);
    show.textContent = vids[s].dataset.label;
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
    if (on) flip = setInterval(() => set(current === names[0] ? names[1] : names[0]), 500);
    p.querySelector('[data-flip]').classList.toggle('on', !!on);
  };
  p.querySelector('[data-play]').onclick = toggle;
  for (const b of p.querySelectorAll('[data-side]')) b.onclick = () => set(b.dataset.side);
  p.querySelector('[data-flip]').onclick = () => setFlip(!flip);
  p.querySelector('[data-back]').onclick = () => step(-1);
  p.querySelector('[data-next]').onclick = () => step(1);
  p.addEventListener('pointerenter', () => { hovered = { set, names, toggle, step, setFlip, flipping: () => !!flip }; });
  set(names[0]);
}
addEventListener('keydown', (e) => {
  if (!hovered) return;
  const k = e.key;
  if (k === '1' || k === '2' || k === '3') hovered.set(hovered.names[+k - 1]);
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

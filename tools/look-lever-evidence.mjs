// Evidence for the look levers (perf-bakes phase V): the same game frames rendered at High (A: 1.5x, MSAA 2),
// at 1.25x with MSAA 2 (L1) and at 1.5x without MSAA (L2), in an iPad-like page (1376x1032 CSS, device scale 2).
//
//   capture <out> <moment...>  plays each moment with the page's animation frames stepped one at a time (shot mode:
//        1/60 s of game per frame, so the clip is real time whatever the machine's load). After every step the
//        frame is drawn again for each side from the same state, switching render scale and MSAA as the quality
//        ladder does, and read back losslessly: <out>/raw/<moment>-<side>.mkv (RGB, FFV1) and <moment>.json.
//   derive <out> [moment...] from the lossless clips: playback mp4s at each side's own render size, side-by-side
//        crop videos (A|L1, A|L2) and enlarged still crops for the regions in CROPS, plus encode-error numbers.
//   index <out>             writes <out>/index.html (notes from <out>/notes.html).
// Moments: meadow washing sailing birches summit. env: BASE, FRAMES (captured frames, default per moment),
// SIDES (comma list, default A,L1,L2).
// Crops are cut in CSS pixels, scaled bilinearly to the iPad's 2 device pixels per CSS pixel (as the browser
// scales the canvas on screen), then enlarged 2x with square pixels.
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';

const [mode, ...args] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5230/';
const W = 1376, H = 1032, DSF = 2;
const SIDES = {
  A: { name: 'A', ratio: 1.5, msaa: 2, label: 'High today: 1.5x render scale, MSAA 2' },
  L1: { name: 'L1', ratio: 1.25, msaa: 2, label: 'L1: 1.25x render scale, MSAA 2 (about 16.6% less GPU work)' },
  L2: { name: 'L2', ratio: 1.5, msaa: 0, label: 'L2: 1.5x render scale, no MSAA (about 15.8% less GPU work)' },
  /** A drawn again after the others: a check that switching sides leaves nothing behind. */
  A2: { name: 'A2', ratio: 1.5, msaa: 2, label: 'A again' },
};

/** Pointer path in CSS pixels for frame i of the capture, or null to leave the pointer where it is. */
const sweep = (i, period, from, to, rest = 0) => {
  const k = i % (period + rest);
  if (k >= period) return null;
  const t = k / (period - 1), e = t * t * (3 - 2 * t);
  return [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + Math.sin(t * Math.PI) * 18];
};

const MOMENTS = {
  meadow: {
    label: 'Meadow walk through the grass, woken, toward the crest',
    query: 'chapter=meadow', frames: 600, warm: 120,
    setup: async (page) => {
      await page.evaluate(() => { const c = __game.story.current; c.skipToCrest(); c.update(0, c.now); __game.rig.cut(c.shot); });
      await page.waitForTimeout(1500);
    },
  },
  washing: {
    label: 'Washing lines, blown with slow sweeps',
    query: 'chapter=washing', frames: 600, warm: 240,
    pointer: (i) => (Math.floor(i / 150) % 2
      ? sweep(i, 110, [W * 0.85, H * 0.26], [W * 0.1, H * 0.2], 40)
      : sweep(i, 110, [W * 0.1, H * 0.2], [W * 0.85, H * 0.26], 40)),
  },
  sailing: {
    label: 'Sailing: mast, rigging and sail, blown along',
    query: 'chapter=crossing', frames: 600, warm: 240,
    pointer: 'boat',
  },
  birches: {
    label: 'Birches: the red scarf tied through the trees, brushed by the wind',
    query: 'chapter=birches', frames: 600, warm: 30,
    setup: async (page) => {
      await page.waitForTimeout(5500);
      await page.waitForFunction(() => !__game.carry.busy && !__game.child.acting, null, { timeout: 60000 });
      await page.evaluate(() => {
        const g = __game, c = g.story.current, scarf = g.birches.scarf;
        scarf.restore(0);
        g.child.stop();
        const before = scarf.snags[0].before;
        g.child.place(before.x, before.z, Math.PI);
        g.glider.hold(g.child);
        g.cygnet.rideIn('satchel');
        c.leg = 1;
        c.toScarf(); c.update(0, c.now); g.rig.cut(c.shot);
      });
      await page.waitForTimeout(1500);
    },
    pointer: (i) => {
      if (i < 60) return null;
      const n = Math.floor((i - 60) / 60), y = H * (0.3 + 0.08 * (n % 3));
      return n % 2 ? sweep(i - 60, 42, [W * 0.85, y], [W * 0.15, y + H * 0.06], 18) : sweep(i - 60, 42, [W * 0.15, y], [W * 0.85, y + H * 0.06], 18);
    },
  },
  summit: {
    label: 'Summit: the last climb to the hilltop against the sky, then swans over the sea',
    query: 'chapter=summit', frames: 600, warm: 360,
    pointer: (i) => sweep(i, 150, [W * 0.2, H * 0.55], [W * 0.8, H * 0.5], 90),
  },
};

if (mode === 'capture') await capture(args[0], args.slice(1));
else if (mode === 'derive') derive(args[0], args.slice(1));
else if (mode === 'index') writeIndex(args[0]);
else throw new Error('usage: capture <out> <moment...> | derive <out> | index <out>');

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
  const sides = (process.env.SIDES ?? 'A,L1,L2').split(',').map((s) => SIDES[s]);
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
        assert.equal(encoders[side].size, `${w}x${h}`);
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
  redraw: null, socket: null, acks: [],
  ms: { draw: 0, read: 0, send: 0 },
  async capture(sides, sink) {
    if (!this.socket) {
      this.socket = new WebSocket(sink);
      this.socket.binaryType = 'arraybuffer';
      this.socket.onmessage = () => this.acks.shift()();
      await new Promise((r) => { this.socket.onopen = r; });
    }
    const gl = renderer.getContext();
    for (const side of sides) {
      let t = performance.now();
      if (pixelRatio !== side.ratio || post.samples !== side.msaa) { pixelRatio = side.ratio; post.samples = side.msaa; resize(); }
      this.redraw();
      gl.finish();
      this.ms.draw += performance.now() - t; t = performance.now();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      this.ms.read += performance.now() - t; t = performance.now();
      const ack = new Promise((r) => this.acks.push(r));
      this.socket.send(JSON.stringify({ side: side.name, w, h }));
      this.socket.send(px);
      await ack;
      this.ms.send += performance.now() - t;
    }
  },
};`;
      await route.fulfill({ response, body: source });
    });
    const first = sides[0];
    await page.goto(`${BASE}?shot&${moment.query}&ratio=${first.ratio}&msaa=${first.msaa}&analytics=0&progress=0`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await page.waitForTimeout(1000);
    if (moment.setup) await moment.setup(page);
    await page.evaluate(() => window.__manual());
    await page.waitForTimeout(300);
    const step = () => page.evaluate(() => window.__step());
    for (let i = 0; i < moment.warm; i++) await step();
    const t0 = Date.now(), ms = { pointer: 0, step: 0, capture: 0 };
    let tick = Date.now();
    const lap = (k) => { const now = Date.now(); ms[k] += now - tick; tick = now; };
    for (let i = 0; i < frames; i++) {
      tick = Date.now();
      let at = null;
      if (moment.pointer === 'boat') {
        const p = await page.evaluate(() => { const g = __game, p = g.boat.position.clone().project(g.rig.camera); return [(p.x + 1) / 2, (1 - p.y) / 2]; });
        const k = i % 50;
        at = k <= 36 ? [p[0] * W + (k / 36 - 0.5) * 260, p[1] * H + 40 + Math.sin((k / 36) * Math.PI) * 8] : [W - 3, H - 3];
      } else if (moment.pointer) at = moment.pointer(i);
      if (at) await page.mouse.move(Math.max(4, Math.min(W - 4, at[0])), Math.max(4, Math.min(H - 4, at[1])));
      lap('pointer');
      await step();
      lap('step');
      await page.evaluate(({ sides, sink }) => window.__evidence.capture(sides, sink), { sides, sink });
      lap('capture');
      if (i % 60 === 0) {
        const state = await page.evaluate(() => ({ inPage: Object.fromEntries(Object.entries(window.__evidence.ms).map(([k, v]) => [k, Math.round(v)])), story: __game.story.name, beat: __game.story.current.beat ?? null, camera: __game.rig.camera.position.toArray().map((v) => +v.toFixed(2)) }));
        log.push({ frame: i, ...state });
        console.log(JSON.stringify({ name, frame: i, ...state, perFrameMs: Math.round((Date.now() - t0) / (i + 1)), ms }));
      }
    }
  } finally {
    await page.close();
    server.close();
    await Promise.all(Object.values(encoders).map((e) => e.end()));
  }
  fs.writeFileSync(`${out}/raw/${name}.json`, JSON.stringify({ name, label: moment.label, frames, viewport: [W, H], dsf: DSF, sides, log, errors }, null, 1));
  assert.deepEqual(errors, []);
}

function lossless(file, w, h) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', '60', '-i', '-',
    '-vf', 'vflip', '-c:v', 'ffv1', '-level', '3', '-threads', '8', '-slices', '16', '-pix_fmt', 'gbrp', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (c) => (c ? reject(new Error(`ffmpeg ${c}`)) : resolve())));
  return {
    size: `${w}x${h}`,
    write: (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r))),
    end: () => { ff.stdin.end(); return done; },
  };
}

function ff(argv) {
  return execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...argv], { maxBuffer: 1 << 28 }).toString();
}

/** Places where the levers show, in CSS pixels of the 1376x1032 page, with the frame (0-based) for the still. */
const CROPS = {
  meadow: [
    { label: 'Reeds at the pond\'s edge, swans on the water', x: 560, y: 260, frame: 400 },
    { label: 'The kite, its string and a far sail on the sea horizon', x: 700, y: 100, frame: 400 },
    { label: 'Near grass', x: 520, y: 700, frame: 400 },
  ],
  washing: [
    { label: 'Washing lines and posts against the sky', x: 480, y: 160, frame: 200 },
    { label: 'Far lines, pegs and cloth edges', x: 80, y: 160, frame: 200 },
  ],
  sailing: [
    { label: 'Sail and mast, with the child seen through the sail', x: 160, y: 590, frame: 150 },
    { label: 'The kite string over the island\'s grass', x: 600, y: 300, frame: 150 },
    { label: 'Sun glints on the water', x: 560, y: 620, frame: 150 },
  ],
  summit: [
    { label: 'Hilltop grass against the sky', x: 900, y: 480, frame: 150 },
    { label: 'Swans flying over the sea horizon', x: 300, y: 330, frame: 450 },
  ],
  birches: [
    { label: 'The red scarf\'s knot on the fallen birch, falling leaves', x: 780, y: 340, frame: 300 },
    { label: 'Far scarves and birch trunks in the haze', x: 260, y: 200, frame: 300 },
    { label: 'Canopy: leaves and twigs', x: 1000, y: 20, frame: 300 },
  ],
};

const PAIRS = [['A', 'L1'], ['A', 'L2']];
const GAP = 16;

function cropChain(side, r, scale = 2) {
  const k = SIDES[side].ratio, px = (v) => Math.round(v * k);
  return `crop=${px(r.w)}:${px(r.h)}:${px(r.x)}:${px(r.y)},scale=${r.w * DSF}:${r.h * DSF}:flags=bilinear,scale=${r.w * DSF * scale}:${r.h * DSF * scale}:flags=neighbor`;
}

const H264 = (crf) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-g', '30', '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart'];
const TO_YUV = 'scale=out_color_matrix=bt709:out_range=tv';

/** Mean PSNR (dB) over the clip, compared in RGB after each side's chain. */
function psnrOf(a, b, chainA = 'null', chainB = 'null') {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi',
    `[0:v]${chainA},format=gbrp[x];[1:v]${chainB},format=gbrp[y];[x][y]psnr`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = /average:([0-9.]+|inf)/.exec(r.stderr);
  assert(m, r.stderr.slice(-2000));
  return m[1] === 'inf' ? Infinity : +(+m[1]).toFixed(1);
}

function derive(out, only) {
  const moments = (only.length ? only : Object.keys(MOMENTS)).filter((m) => fs.existsSync(`${out}/raw/${m}.json`));
  for (const dir of ['video', 'crops']) fs.mkdirSync(`${out}/${dir}`, { recursive: true });
  const report = {};
  for (const m of moments) {
    const meta = JSON.parse(fs.readFileSync(`${out}/raw/${m}.json`, 'utf8'));
    const raw = (s) => `${out}/raw/${m}-${s}.mkv`;
    const sides = ['A', 'L1', 'L2'].filter((s) => fs.existsSync(raw(s)));
    report[m] = { label: MOMENTS[m].label, frames: meta.frames, videos: {}, crops: [] };
    for (const s of sides) {
      const file = `${out}/video/${m}-${s}.mp4`;
      if (!fs.existsSync(file)) ff(['-i', raw(s), '-vf', TO_YUV, ...H264(12), file]);
      const k = SIDES[s].ratio;
      report[m].videos[s] = {
        file: `video/${m}-${s}.mp4`, size: [Math.round(W * k), Math.round(H * k)], mb: +(fs.statSync(file).size / 1e6).toFixed(1),
        encodePsnr: psnrOf(raw(s), file),
      };
    }
    const toScreen = (s) => `scale=${W * DSF}:${H * DSF}:flags=bilinear`;
    for (const [a, b] of PAIRS) if (sides.includes(b)) report[m][`${a}vs${b}Psnr`] = psnrOf(raw(a), raw(b), toScreen(a), toScreen(b));
    (CROPS[m] ?? []).map((r) => ({ w: 320, h: 240, ...r })).forEach((r, i) => {
      const id = `${m}-${i + 1}`;
      const crop = { ...r, id, stills: {}, videos: {} };
      for (const s of sides) {
        const png = `${out}/crops/${id}-${s}.png`;
        ff(['-ss', String(r.frame / 60), '-i', raw(s), '-frames:v', '1', '-vf', cropChain(s, r), png]);
        crop.stills[s] = `crops/${id}-${s}.png`;
      }
      for (const [a, b] of PAIRS) {
        if (!sides.includes(b)) continue;
        const file = `${out}/crops/${id}-${a}-vs-${b}.mp4`;
        ff(['-i', raw(a), '-i', raw(b), '-filter_complex',
          `[0:v]${cropChain(a, r)},pad=iw+${GAP}:ih:0:0:0x202020[x];[1:v]${cropChain(b, r)}[y];[x][y]hstack,${TO_YUV}`, ...H264(10), file]);
        crop.videos[`${a}-${b}`] = `crops/${id}-${a}-vs-${b}.mp4`;
      }
      report[m].crops.push(crop);
      console.log(JSON.stringify({ crop: id }));
    });
    console.log(JSON.stringify({ moment: m, ...report[m], crops: report[m].crops.length }));
  }
  const file = `${out}/report.json`, all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const m of moments) all[m] = report[m];
  const ordered = Object.fromEntries(Object.keys(MOMENTS).filter((m) => all[m]).map((m) => [m, all[m]]));
  fs.writeFileSync(file, JSON.stringify(ordered, null, 1));
}

function writeIndex(out) {
  const report = JSON.parse(fs.readFileSync(`${out}/report.json`, 'utf8'));
  const notes = fs.existsSync(`${out}/notes.html`) ? fs.readFileSync(`${out}/notes.html`, 'utf8') : '';
  const momentNotes = fs.existsSync(`${out}/moment-notes.json`) ? JSON.parse(fs.readFileSync(`${out}/moment-notes.json`, 'utf8')) : {};
  const side = (s) => SIDES[s].label;
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Look levers L1 and L2: what they change</title>
<style>
body{font:15px/1.5 system-ui;background:#181818;color:#ddd;max-width:1420px;margin:24px auto;padding:0 16px}
h2{margin-top:48px;border-top:1px solid #444;padding-top:16px}h3{margin:28px 0 8px}
.stage{position:relative;width:100%;max-width:1376px;aspect-ratio:1376/1032;background:#000}
.stage.actual{width:1376px;max-width:none}
.stage video{position:absolute;inset:0;width:100%;height:100%;opacity:0}.stage video.on{opacity:1}
.bar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center}
button{font:inherit;background:#333;color:#eee;border:1px solid #555;border-radius:6px;padding:4px 10px;cursor:pointer}
button.on{background:#c9a227;color:#111;border-color:#c9a227}
.showing{font-weight:600;color:#fc6;min-width:30em}
.crop img{width:100%;image-rendering:pixelated;display:block}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
video.pair{width:100%;display:block;background:#000}figure{margin:0}figcaption{color:#999;font-size:13px}
table{border-collapse:collapse}td,th{padding:3px 10px;border-bottom:1px solid #333;text-align:right}td:first-child,th:first-child{text-align:left}
.note{background:#222;border-left:3px solid #c9a227;padding:8px 14px;margin:10px 0}
</style>
<h1>Look levers L1 and L2: what they change</h1>
<p>Jeremy plays on <b>High</b>: 1.5x render scale with MSAA 2, on an M5 iPad Pro (1376x1032 CSS, 2 device pixels per
CSS pixel). Two battery levers change the look:</p>
<ul><li><b>A</b>: ${side('A')}.</li><li><b>${side('L1')}</b>.</li><li><b>${side('L2')}</b>.</li></ul>
<p>The GPU savings are shares of the whole playthrough's measured GPU work (round 2 profile). They are not battery
points: the display and system floor take about 8 of the 15 to 18 points, so a 16% GPU cut is worth at most about
1.1 to 1.6 points, and less once CPU and audio are counted.</p>
${notes}
<h2>How this was made</h2>
<p>Each moment was played once in headless Chrome (Metal) at 1376x1032, device scale 2, with the page's animation
frames stepped one at a time: every frame is 1/60 s of game, so the clips play in real time at 60 fps whatever the
capture speed. After each frame the game drew the same frame three more times from the same state, once per setting,
switching render scale and MSAA the way the quality ladder does, and each was read back losslessly. So A, L1 and L2
are the very same moment; only the setting differs.</p>
<p>Full-frame clips are at each setting's own render size (A and L2 2064x1548, L1 1720x1290) and are drawn at the same
size on this page, so the browser scales them up as the iPad scales the canvas. Press <b>1:1 as on the iPad</b> to show
them at 1376 CSS pixels wide: on this page opened on the iPad itself, or on a Retina Mac (about the iPad's pixel
density), that is the size you play at. Encoding: H.264 High, CRF 12 (full frames) and CRF 10 (crops), preset slow,
4:2:0, a keyframe every half second. The table shows how far the encode is from the lossless frames (PSNR against
the lossless capture) next to how far each lever is from A: the encode error is much smaller than the lever's
difference, so compression is not hiding it.</p>
<p>Crops are cut from the lossless frames: 320x240 CSS pixels, scaled bilinearly to the iPad's 2 device pixels per
CSS pixel (what the screen shows), then enlarged 2x with square pixels. So one screen pixel of the iPad is a 2x2 block.</p>
<table><tr><th>Moment</th><th>Encode PSNR A / L1 / L2</th><th>A vs L1 PSNR</th><th>A vs L2 PSNR</th></tr>
${Object.entries(report).map(([m, r]) => `<tr><td><a href="#${m}">${r.label}</a></td><td>${['A', 'L1', 'L2'].map((s) => r.videos[s]?.encodePsnr ?? '').join(' / ')} dB</td><td>${r.AvsL1Psnr ?? ''} dB</td><td>${r.AvsL2Psnr ?? ''} dB</td></tr>`).join('')}
</table>
<p style="color:#999;font-size:13px">PSNR: higher is closer. Lever PSNR compares the lossless frames scaled to the
iPad's screen size. Every frame of every clip is compared.</p>
<h2>Controls</h2>
<p>Keys work on the player under the pointer: <b>1</b> A, <b>2</b> L1, <b>3</b> L2, <b>space</b> play or pause,
<b>,</b> and <b>.</b> step one frame back or forward, <b>f</b> flips between A and the last lever chosen every half
second. Paused, all three show the identical frame.</p>
${Object.entries(report).map(([m, r]) => `<h2 id="${m}">${r.label}</h2>
${momentNotes[m] ? `<div class="note">${momentNotes[m]}</div>` : ''}
<p>${r.frames} frames, ${(r.frames / 60).toFixed(0)} s of game at 60 fps.</p>
<div class="player" data-moment="${m}">
<div class="bar"><button data-play>Play</button><button data-side="A">A: High today</button><button data-side="L1">L1: 1.25x</button><button data-side="L2">L2: no MSAA</button><button data-flip>Flip A and lever</button><button data-back>&lt; frame</button><button data-next>frame &gt;</button><button data-actual>1:1 as on the iPad</button><span class="showing"></span></div>
<div class="stage">${['A', 'L1', 'L2'].filter((s) => r.videos[s]).map((s) => `<video data-v="${s}" src="${r.videos[s].file}" muted loop playsinline preload="auto"></video>`).join('')}</div>
</div>
<p style="color:#999;font-size:13px">Files: ${['A', 'L1', 'L2'].filter((s) => r.videos[s]).map((s) => `<a href="${r.videos[s].file}">${s} (${r.videos[s].size.join('x')}, ${r.videos[s].mb} MB)</a>`).join(', ')}</p>
${r.crops.map((c) => `<h3>${c.label}</h3>
<div class="three crop">${['A', 'L1', 'L2'].filter((s) => c.stills[s]).map((s) => `<figure><img src="${c.stills[s]}" loading="lazy"><figcaption>${s === 'A' ? 'A: High today' : s === 'L1' ? 'L1: 1.25x, MSAA 2' : 'L2: 1.5x, no MSAA'}, frame ${c.frame}, 2x of the iPad screen</figcaption></figure>`).join('')}</div>
${Object.entries(c.videos).map(([k, f]) => `<figure><video class="pair" src="${f}" controls muted loop playsinline preload="metadata"></video><figcaption>In motion, A left and ${k.split('-')[1]} right (${k.split('-')[1] === 'L1' ? 'L1: 1.25x, MSAA 2' : 'L2: 1.5x, no MSAA'}), 2x of the iPad screen, frame-locked</figcaption></figure>`).join('')}`).join('')}`).join('')}
<script>
const label = { A: 'A: High today (1.5x, MSAA 2)', L1: 'L1: 1.25x, MSAA 2 (-16.6% GPU)', L2: 'L2: 1.5x, no MSAA (-15.8% GPU)' };
let hovered = null;
for (const p of document.querySelectorAll('.player')) {
  const vids = Object.fromEntries([...p.querySelectorAll('video')].map((v) => [v.dataset.v, v]));
  const show = p.querySelector('.showing');
  let current = 'A', lever = 'L1', flip = null;
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
    if (on) flip = setInterval(() => set(current === 'A' ? lever : 'A'), 500);
    p.querySelector('[data-flip]').classList.toggle('on', !!on);
  };
  const choose = (s) => { if (s !== 'A') lever = s; set(s); if (flip) setFlip(true); };
  p.querySelector('[data-play]').onclick = toggle;
  for (const b of p.querySelectorAll('[data-side]')) b.onclick = () => choose(b.dataset.side);
  p.querySelector('[data-flip]').onclick = () => setFlip(!flip);
  p.querySelector('[data-back]').onclick = () => step(-1);
  p.querySelector('[data-next]').onclick = () => step(1);
  p.querySelector('[data-actual]').onclick = (e) => { e.target.classList.toggle('on', p.querySelector('.stage').classList.toggle('actual')); };
  p.addEventListener('pointerenter', () => { hovered = { choose, toggle, step, setFlip, flipping: () => !!flip }; });
  set('A');
}
addEventListener('keydown', (e) => {
  if (!hovered) return;
  const k = e.key;
  if (k === '1') hovered.choose('A'); else if (k === '2') hovered.choose('L1'); else if (k === '3') hovered.choose('L2');
  else if (k === ' ') { e.preventDefault(); hovered.toggle(); } else if (k === ',') hovered.step(-1); else if (k === '.') hovered.step(1);
  else if (k === 'f') hovered.setFlip(!hovered.flipping());
});
</script>`;
  fs.writeFileSync(`${out}/index.html`, html);
  console.log(`${out}/index.html`);
}

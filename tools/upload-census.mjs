// Uploads made in the middle of a render pass: texture and buffer writes issued after a draw into the bound framebuffer
// and before it is unbound. On ANGLE's Metal backend (Chrome and Safari) such a write to a resource the GPU is still
// using can end the pass early, so the multisampled target is stored and loaded again.
// node tools/upload-census.mjs [island sea ...]   BASE (dev server or QA preview), RATIO, MSAA, FRAMES (120), QUERY.
import { openBrowser } from './lib/browser.mjs';
import { withoutHotReload } from './lib/vite-client-stub.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5230/', FRAMES = Number(process.env.FRAMES ?? 120);
const chapters = process.argv.slice(2).length ? process.argv.slice(2) : ['island'];

const hook = () => {
  const P = WebGL2RenderingContext.prototype, census = { on: false, frames: 0, rows: {} };
  let drawn = false;
  const label = () => {
    Error.stackTraceLimit = 60;
    const lines = (new Error().stack ?? '').split('\n').slice(1).map(l => l.trim()).filter(l => !l.includes('<anonymous>'));
    const ours = lines.find(l => /\/src\//.test(l) && !/three/.test(l)) ?? lines.find(l => !/three/.test(l)) ?? lines[0] ?? '?';
    const near = [...lines].reverse().find(l => /three/.test(l)) ?? '';
    return ours.replace(/^at /, '').replace(/https?:\/\/[^/]+/, '').replace(/\?[^:]*/, '') + ' <- ' + (near.match(/at (\S+)/)?.[1] ?? '');
  };
  const wrapDraw = name => { const f = P[name]; P[name] = function (...a) { drawn = true; return f.apply(this, a); }; };
  ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements'].forEach(wrapDraw);
  const fb = P.bindFramebuffer;
  P.bindFramebuffer = function (target, framebuffer) { if (target !== this.READ_FRAMEBUFFER) drawn = false; return fb.call(this, target, framebuffer); };
  const wrapUpload = (name, bytes) => {
    const f = P[name];
    P[name] = function (...a) {
      if (census.on) {
        const key = (drawn ? 'mid-pass ' : 'between passes ') + name + ' ' + (census.object ? 'drawing ' + census.object + ' in ' : '') + label();
        const row = census.rows[key] ??= { calls: 0, bytes: 0 };
        row.calls++; row.bytes += bytes(a);
      }
      return f.apply(this, a);
    };
  };
  const size = v => v?.byteLength ?? 0;
  wrapUpload('bufferSubData', a => size(a[2]) - (a[3] ?? 0) * (a[2]?.BYTES_PER_ELEMENT ?? 1));
  wrapUpload('bufferData', a => typeof a[1] === 'number' ? a[1] : size(a[1]));
  wrapUpload('texSubImage2D', a => a.length >= 9 ? a[4] * a[5] * 4 : 0);
  wrapUpload('texImage2D', a => a.length >= 9 ? a[3] * a[4] * 4 : 0);
  wrapUpload('texSubImage3D', a => a[5] * a[6] * a[7] * 4);
  window.__uploads = census;
};

const { browser, close } = await openBrowser();
try {
  for (const chapter of chapters) {
    const page = await browser.newPage({ viewport: { width: 1376, height: 1032 }, deviceScaleFactor: 2 });
    await withoutHotReload(page);
    await page.addInitScript(hook);
    await page.goto(BASE + '?shot&start=1&ratio=' + (process.env.RATIO ?? '0.85') + '&msaa=' + (process.env.MSAA ?? '2') +
      '&analytics=0&progress=0' + (chapter === 'island' ? '' : '&chapter=' + chapter) + (process.env.QUERY ? '&' + process.env.QUERY : ''));
    await page.waitForSelector('#veil.ready', { timeout: 300000 }); await page.locator('#begin').click();
    await page.waitForFunction(() => window.__ready, null, { timeout: 300000 });
    await page.waitForTimeout(1500);
    const result = await page.evaluate(frames => new Promise(done => {
      const c = window.__uploads, start = __stats.frame, r = __game.renderer, direct = r.renderBufferDirect.bind(r);
      const nameOf = o => { const names = []; for (let p = o; p && names.length < 3; p = p.parent) if (p.name) names.push(p.name); return (names.join('<') || o.type) + ':' + (o.geometry?.attributes?.position?.count ?? 0) + 'v'; };
      r.renderBufferDirect = (camera, scene, geometry, material, object, group) => { c.object = nameOf(object); try { return direct(camera, scene, geometry, material, object, group); } finally { c.object = null; } };
      c.rows = {}; c.on = true;
      const tick = () => { if (__stats.frame - start >= frames) { c.on = false; done({ frames: __stats.frame - start, rows: c.rows }); } else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }), FRAMES);
    const rows = Object.entries(result.rows).map(([key, r]) => ({ key, perFrame: +(r.calls / result.frames).toFixed(2), kib: +(r.bytes / result.frames / 1024).toFixed(1) }))
      .sort((a, b) => (b.key.startsWith('mid') - a.key.startsWith('mid')) || b.perFrame - a.perFrame);
    console.log(JSON.stringify({ chapter, frames: result.frames }));
    for (const r of rows) console.log(`${chapter}\t${r.perFrame}/frame\t${r.kib} KiB\t${r.key}`);
    await page.close();
  }
} finally { await close(); }

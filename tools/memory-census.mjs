// Graphics memory census: every texture, render target (colour, multisampled colour and depth renderbuffers), data
// texture and GPU buffer the running game holds, with dimensions, format and estimated bytes, named by the object
// that owns it, and whether anything used it over the frames watched at each chapter.
// node tools/memory-census.mjs [island meadow:walk stairs:sail sea ...]
// RATIO=1.5 MSAA=2 DETAIL=0|1|2 FRAMES=120 BASE=http://127.0.0.1:5230/ OUT=/tmp/updraft-memory-census
// How: WebGL2 calls are wrapped before the page loads, so every allocation is sized from the call that stores it
// (texImage*, texStorage*, renderbufferStorage*, bufferData); deleted objects drop out. Owners come from a
// breadth-first walk of main.ts's module scope (its declarations and imports), matched to GL objects through
// three's renderer.properties and the typed array a buffer was filled from; anything unmatched is named by the first
// src/ frame of the stack that allocated it. "Used" means a drawn material or geometry referenced it, or it was a
// render target, during the watched frames. Sizes are what GL was asked for: the driver may pad (a D24S8 depth is
// Depth32Float_Stencil8 on Apple GPUs) and the canvas's own buffers are estimated separately.
import fs from 'node:fs/promises';
import { openBrowser } from './lib/browser.mjs';
import { stairsFixture } from './lib/stairs-fixture.mjs';
import { stubViteClient } from './lib/vite-client-stub.mjs';

const out = process.env.OUT ?? '/tmp/updraft-memory-census';
const base = process.env.BASE ?? 'http://127.0.0.1:5230/';
const FRAMES = Number(process.env.FRAMES ?? 120);

const hooks = () => {
  const M = window.__mem = { objs: new Map(), next: 1, active: 0x84C0, tex: {}, rb: null, buf: {} };
  const P = WebGL2RenderingContext.prototype;
  const idOf = o => { if (!o) return 0; if (!o.__memId) o.__memId = M.next++; return o.__memId; };
  const where = () => {
    const lines = (new Error().stack || '').split('\n').slice(2);
    const src = lines.filter(l => l.includes('/src/') && !l.includes('node_modules'));
    return (src[0] || lines.find(l => !l.includes('node_modules')) || lines[0] || '').trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, '');
  };
  const SIZED = {
    0x8058: 4, 0x8051: 3, 0x881A: 8, 0x881B: 6, 0x8814: 16, 0x8815: 12, 0x8229: 1, 0x822B: 2, 0x822D: 2, 0x822E: 4, 0x822F: 4,
    0x8230: 8, 0x8C3A: 4, 0x8C43: 4, 0x81A5: 2, 0x81A6: 4, 0x8CAC: 4, 0x88F0: 4, 0x8CAD: 8, 0x8D7C: 4, 0x8D76: 8, 0x8D70: 16,
    0x8236: 4, 0x823C: 8, 0x8234: 2, 0x8235: 4, 0x8D82: 16, 0x8059: 4, 0x8D48: 1, 0x8232: 1, 0x8238: 2, 0x823A: 2, 0x8D8E: 4,
  };
  const NAMES = {
    0x8058: 'RGBA8', 0x8051: 'RGB8', 0x881A: 'RGBA16F', 0x881B: 'RGB16F', 0x8814: 'RGBA32F', 0x8815: 'RGB32F', 0x8229: 'R8', 0x822B: 'RG8',
    0x822D: 'R16F', 0x822E: 'R32F', 0x822F: 'RG16F', 0x8230: 'RG32F', 0x8C3A: 'R11G11B10F', 0x8C43: 'SRGB8_A8', 0x81A5: 'DEPTH16',
    0x81A6: 'DEPTH24', 0x8CAC: 'DEPTH32F', 0x88F0: 'DEPTH24_STENCIL8', 0x8CAD: 'DEPTH32F_STENCIL8', 0x8D7C: 'RGBA8UI', 0x8D76: 'RGBA16UI',
    0x8D70: 'RGBA32UI', 0x8236: 'R32UI', 0x8D82: 'RGBA32I', 0x8D48: 'STENCIL8', 0x1908: 'RGBA', 0x1907: 'RGB', 0x1903: 'RED', 0x8227: 'RG',
    0x1902: 'DEPTH', 0x84F9: 'DEPTH_STENCIL',
  };
  const TYPE = { 0x1401: 1, 0x1406: 4, 0x140B: 2, 0x8D61: 2, 0x1403: 2, 0x1405: 4, 0x84FA: 4 };
  const CHANNELS = { 0x1908: 4, 0x1907: 3, 0x1903: 1, 0x8227: 2, 0x1902: 1, 0x84F9: 1, 0x1909: 1, 0x190A: 2, 0x1906: 1, 0x8D99: 4, 0x8D94: 1 };
  const bpp = (internal, format, type) => SIZED[internal] ?? (CHANNELS[format ?? internal] ?? 4) * (TYPE[type] ?? 1);
  const fname = (internal, format, type) => NAMES[internal] ? NAMES[internal] + (SIZED[internal] ? '' : '/' + (type === 0x1406 ? 'F32' : type === 0x140B || type === 0x8D61 ? 'F16' : 'U8')) : '0x' + internal.toString(16);
  const bytesOf = r => Object.values(r.levels).reduce((a, b) => a + b, 0);
  const faceTarget = t => (t >= 0x8515 && t <= 0x851A ? 0x8513 : t);
  const bound = target => M.tex[M.active + ':' + faceTarget(target)];
  const wrap = (name, after) => { const f = P[name]; P[name] = function (...a) { const r = f.apply(this, a); after.call(this, a, r); return r; }; };
  wrap('createTexture', (a, t) => { M.objs.set(idOf(t), { kind: 'texture', id: t.__memId, levels: {}, alive: true }); });
  wrap('createRenderbuffer', (a, t) => { M.objs.set(idOf(t), { kind: 'renderbuffer', id: t.__memId, levels: {}, alive: true }); });
  wrap('createBuffer', (a, t) => { M.objs.set(idOf(t), { kind: 'buffer', id: t.__memId, levels: {}, alive: true }); });
  for (const n of ['deleteTexture', 'deleteRenderbuffer', 'deleteBuffer']) wrap(n, a => { if (a[0]?.__memId) M.objs.delete(a[0].__memId); });
  wrap('activeTexture', a => { M.active = a[0]; });
  wrap('bindTexture', a => { M.tex[M.active + ':' + a[0]] = a[1]; });
  wrap('bindRenderbuffer', a => { M.rb = a[1]; });
  wrap('bindBuffer', a => { M.buf[a[0]] = a[1]; });
  const rec = o => o && M.objs.get(o.__memId);
  const note = (r, fields) => { if (!r) return; Object.assign(r, fields); r.where ??= where(); r.bytes = bytesOf(r); };
  wrap('texImage2D', function (a) {
    const t = bound(a[0]), r = rec(t); if (!r) return;
    let w, h, internal = a[2], format, type;
    if (a.length >= 8 && typeof a[3] === 'number') { w = a[3]; h = a[4]; format = a[6]; type = a[7]; }
    else { const s = a[5]; w = s?.width ?? s?.videoWidth ?? 0; h = s?.height ?? s?.videoHeight ?? 0; format = a[3]; type = a[4]; }
    r.levels[a[0] + ':' + a[1]] = w * h * bpp(internal, format, type);
    if (a[1] === 0) note(r, { target: faceTarget(a[0]) === 0x8513 ? 'cube' : '2d', w, h, d: 1, format: fname(internal, format, type), cube: faceTarget(a[0]) === 0x8513 });
    else note(r, {});
  });
  wrap('texImage3D', function (a) {
    const t = bound(a[0]), r = rec(t); if (!r) return;
    const [target, level, internal, w, h, d, , format, type] = a;
    r.levels[level] = w * h * d * bpp(internal, format, type);
    if (level === 0) note(r, { target: target === 0x806F ? '3d' : '2d-array', w, h, d, format: fname(internal, format, type) }); else note(r, {});
  });
  wrap('texStorage2D', function (a) {
    const [target, levels, internal, w, h] = a, r = rec(bound(target)); if (!r) return;
    const faces = target === 0x8513 ? 6 : 1;
    for (let i = 0; i < levels; i++) r.levels['s' + i] = Math.max(1, w >> i) * Math.max(1, h >> i) * bpp(internal) * faces;
    note(r, { target: faces === 6 ? 'cube' : '2d', w, h, d: 1, mips: levels, format: fname(internal), immutable: true });
  });
  wrap('texStorage3D', function (a) {
    const [target, levels, internal, w, h, d] = a, r = rec(bound(target)); if (!r) return;
    for (let i = 0; i < levels; i++) r.levels['s' + i] = Math.max(1, w >> i) * Math.max(1, h >> i) * (target === 0x806F ? Math.max(1, d >> i) : d) * bpp(internal);
    note(r, { target: target === 0x806F ? '3d' : '2d-array', w, h, d, mips: levels, format: fname(internal), immutable: true });
  });
  wrap('generateMipmap', function (a) {
    const r = rec(bound(a[0])); if (!r || r.immutable) return;
    const base = Object.entries(r.levels).filter(([k]) => /(^|:)0$/.test(k)).reduce((s, [, v]) => s + v, 0);
    r.levels.mips = Math.round(base / 3); r.mips = 'generated'; r.bytes = bytesOf(r);
  });
  wrap('copyTexImage2D', function (a) { const r = rec(bound(a[0])); if (!r) return; r.levels[a[0] + ':' + a[1]] = a[5] * a[6] * bpp(a[2]); note(r, { target: '2d', w: a[5], h: a[6], d: 1, format: fname(a[2]) }); });
  wrap('renderbufferStorage', function (a) { const r = rec(M.rb); if (!r) return; r.levels = { 0: a[2] * a[3] * bpp(a[1]) }; note(r, { w: a[2], h: a[3], samples: 0, format: fname(a[1]) }); });
  wrap('renderbufferStorageMultisample', function (a) { const r = rec(M.rb); if (!r) return; r.levels = { 0: a[3] * a[4] * bpp(a[2]) * Math.max(1, a[1]) }; note(r, { w: a[3], h: a[4], samples: a[1], format: fname(a[2]) }); });
  wrap('bufferData', function (a) {
    const r = rec(M.buf[a[0]]); if (!r) return;
    const [target, data, , offset, length] = a;
    const size = typeof data === 'number' ? data : length ? length * (data.BYTES_PER_ELEMENT ?? 1) : data.byteLength - (offset ?? 0) * (data.BYTES_PER_ELEMENT ?? 1);
    r.levels = { 0: size }; r.src = typeof data === 'number' ? null : data;
    note(r, { target: target === 0x8893 ? 'index' : target === 0x8892 ? 'vertex' : target === 0x88EB || target === 0x88EC ? 'pixel' : target === 0x8A11 ? 'uniform' : '0x' + target.toString(16) });
  });
};

// Appended to main.ts: its module scope, for the owner walk, and the draw hooks that record what a frame uses.
const tail = names => `
window.__memScope = {${names.map(n => `${JSON.stringify(n)}: (() => { try { return ${n}; } catch { return undefined; } })()`).join(',\n')}};
window.__memAudit = {
  fastRatio: null,
  fast(on) { if (on) { this.fastRatio ??= pixelRatio; pixelRatio = 0.5; resize(); } else if (this.fastRatio) { pixelRatio = this.fastRatio; this.fastRatio = null; resize(); } },
  detail(level) { applyWorldQuality({ ratio: pixelRatio, samples: post.samples, detail: level }, true); return { detail: level, grass: { ...grass.quality }, mirrorScale: water.mirrorScale, mirrorEvery: water.mirrorEvery }; },
  used: null,
  start() { this.used = { textures: new Set(), targets: new Set(), geometries: new Set(), arrays: new Set() }; },
  stop() { const u = this.used; this.used = null; return u; },
};
{
  const direct = renderer.renderBufferDirect.bind(renderer);
  const texturesOf = (m, into) => {
    if (!m) return;
    for (const v of Object.values(m)) if (v?.isTexture) into.add(v);
    for (const u of Object.values(m.uniforms ?? {})) {
      const v = u?.value; if (!v) continue;
      if (v.isTexture) into.add(v); else if (Array.isArray(v)) for (const x of v) if (x?.isTexture) into.add(x);
    }
  };
  renderer.renderBufferDirect = (camera, s, geometry, material, object, group) => {
    const u = window.__memAudit.used;
    if (u) {
      texturesOf(material, u.textures);
      if (object?.skeleton?.boneTexture) u.textures.add(object.skeleton.boneTexture);
      if (geometry) {
        u.geometries.add(geometry);
        if (geometry.index) u.arrays.add(geometry.index.array);
        for (const a of Object.values(geometry.attributes)) u.arrays.add(a.isInterleavedBufferAttribute ? a.data.array : a.array);
        for (const list of Object.values(geometry.morphAttributes ?? {})) for (const a of list) u.arrays.add(a.array);
      }
      for (const a of ['instanceMatrix', 'instanceColor', 'morphTexture']) { const v = object?.[a]; if (v?.isTexture) u.textures.add(v); else if (v?.array) u.arrays.add(v.array); }
    }
    return direct(camera, s, geometry, material, object, group);
  };
  const setTarget = renderer.setRenderTarget.bind(renderer);
  renderer.setRenderTarget = (target, ...rest) => { if (target && window.__memAudit.used) window.__memAudit.used.targets.add(target); return setTarget(target, ...rest); };
}
`;

// In the page: walk the scope for three textures, render targets and geometry arrays; match them to the GL records.
const survey = () => {
  const scope = window.__memScope, last = ['scene', 'renderer', 'rig'];
  const roots = [...Object.keys(scope).filter(k => !last.includes(k)), ...last.filter(k => k in scope)];
  const seen = new Set(), textures = new Map(), targets = new Map(), arrays = new Map(), paths = new Map();
  const add = (map, o, path) => { const l = map.get(o); if (!l) map.set(o, [path]); else if (l.length < 3) l.push(path); };
  let queue = roots.map(k => [scope[k], k]), visited = 0;
  const renderer = scope.renderer;
  for (let depth = 0; depth < 14 && queue.length && visited < 4e6; depth++) {
    const next = [];
    for (const [o, path] of queue) {
      if (!o || (typeof o !== 'object' && typeof o !== 'function')) continue;
      if (o.isTexture) add(textures, o, path);
      if (o.isRenderTarget || o.isWebGLRenderTarget) add(targets, o, path);
      if ((o.isBufferAttribute || o.isInterleavedBuffer) && o.array) add(arrays, o.array, path);
      if (seen.has(o)) continue;
      seen.add(o); visited++;
      if (ArrayBuffer.isView(o) || o instanceof ArrayBuffer || o === window || o === renderer || (typeof Node !== 'undefined' && o instanceof Node)
        || o[Symbol.toStringTag] === 'Module' || (typeof AudioNode !== 'undefined' && (o instanceof AudioNode || o instanceof BaseAudioContext || o instanceof AudioBuffer || o instanceof AudioParam))
        || (typeof WebGLObject !== "undefined" && o instanceof WebGLObject) || typeof o === 'function') continue;
      if (o instanceof Map || o instanceof Set) { let i = 0; for (const v of o.values()) next.push([v, path + '{' + (i++) + '}']); continue; }
      let keys; try { keys = Object.keys(o); } catch { continue; }
      if (Array.isArray(o) && keys.length > 64) keys = keys.slice(0, 64);
      for (const k of keys) {
        if (k === 'parent' || k.startsWith('_') && k !== '_fsQuad') continue;
        let v; try { v = o[k]; } catch { continue; }
        if (v && (typeof v === 'object' || typeof v === 'function')) next.push([v, Array.isArray(o) ? path + '[' + k + ']' : path + '.' + k]);
      }
    }
    queue = next;
  }
  const props = renderer.properties, gl = {};
  const own = (glObject, owner, role, three) => {
    if (!glObject?.__memId) return;
    const r = window.__mem.objs.get(glObject.__memId); if (!r) return;
    if (!r.owner) { r.owner = owner; r.role = role; r.three = three; }
  };
  for (const [rt, ps] of targets) {
    const p = props.get(rt);
    const texs = rt.textures ?? [rt.texture];
    texs.forEach((t, i) => own(props.get(t).__webglTexture, ps[0], texs.length > 1 ? 'colour ' + i : 'colour', { samples: rt.samples, type: t.type }));
    if (rt.depthTexture) own(props.get(rt.depthTexture).__webglTexture, ps[0], 'depth texture');
    for (const rb of [p.__webglColorRenderbuffer].flat()) own(rb, ps[0], 'msaa colour');
    for (const rb of [p.__webglDepthRenderbuffer, p.__webglDepthbuffer].flat()) own(rb, ps[0], rt.samples > 0 ? 'msaa depth' : 'depth');
  }
  for (const [t, ps] of textures) own(props.get(t).__webglTexture, ps[0], t.isDataTexture || t.isData3DTexture ? 'data texture' : t.isRenderTargetTexture ? 'target texture' : 'texture', { paths: ps });
  const objects = [...window.__mem.objs.values()].map(r => {
    const owner = r.owner ?? (r.src && arrays.get(r.src)?.[0]);
    return { id: r.id, kind: r.kind, target: r.target, w: r.w, h: r.h, d: r.d, samples: r.samples, mips: r.mips, format: r.format, bytes: r.bytes ?? 0,
      owner: owner ?? null, role: r.role ?? (r.kind === 'buffer' && owner ? r.target : null), where: r.where, paths: r.three?.paths };
  });
  window.__memMatch = { textures, targets, arrays };
  return { visited, objects, info: { ...renderer.info.memory }, canvas: [renderer.domElement.width, renderer.domElement.height], attributes: renderer.getContext().getContextAttributes() };
};

// Which of them the watched frames touched.
const usage = () => {
  const u = window.__memAudit.stop(), m = window.__memMatch, props = window.__memScope.renderer.properties, ids = new Set();
  const mark = o => { if (o?.__memId) ids.add(o.__memId); };
  for (const t of u.textures) mark(props.get(t).__webglTexture);
  for (const rt of u.targets) {
    const p = props.get(rt);
    for (const t of rt.textures ?? [rt.texture]) mark(props.get(t).__webglTexture);
    if (rt.depthTexture) mark(props.get(rt.depthTexture).__webglTexture);
    for (const rb of [p.__webglColorRenderbuffer, p.__webglDepthRenderbuffer, p.__webglDepthbuffer].flat()) mark(rb);
  }
  for (const r of window.__mem.objs.values()) if (r.kind === 'buffer' && r.src && u.arrays.has(r.src)) ids.add(r.id);
  return { ids: [...ids], drawnGeometries: u.geometries.size, textures: u.textures.size, targets: u.targets.size };
};

const { browser, close } = await openBrowser();
const report = [];
try {
  for (const chapter of process.argv.slice(2).length ? process.argv.slice(2) : ['island', 'meadow:walk', 'stairs:sail', 'sea']) {
    const [entry, fixture] = chapter.split(':');
    const page = await browser.newPage({ viewport: { width: 1376, height: 1032 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(hooks);
    await stubViteClient(page);
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch(), source = await response.text(), names = new Set();
      for (const m of source.matchAll(/^(?:export\s+)?(?:const|let|var|class|function|async function)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
      for (const m of source.matchAll(/^(?:const|let)\s+\{([^}]*)\}\s*=/gm)) for (const n of m[1].split(',')) { const k = n.split(':').pop().trim(); if (/^[A-Za-z_$][\w$]*$/.test(k)) names.add(k); }
      for (const m of source.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/gm)) {
        const spec = m[1];
        const braces = spec.match(/\{([\s\S]*)\}/)?.[1] ?? '';
        for (const part of braces.split(',')) { const p = part.trim(); if (!p || p.startsWith('type ')) continue; names.add(p.split(/\s+as\s+/).pop().trim()); }
        const def = spec.replace(/\{[\s\S]*\}/, '').replace(/\*\s+as\s+\w+/, '').replace(/,/g, '').trim();
        if (/^[A-Za-z_$][\w$]*$/.test(def) && def !== 'type') names.add(def);
      }
      names.delete('THREE');
      await route.fulfill({ response, body: source + tail([...names]) });
    });
    await page.goto(base + '?shot&start=1&ratio=' + (process.env.RATIO ?? '1.5') + '&msaa=' + (process.env.MSAA ?? '2') + '&analytics=0&progress=0' + (entry === 'island' ? '' : '&chapter=' + entry));
    await page.waitForSelector('#veil.ready', { timeout: 300000 }); await page.locator('#begin').click();
    await page.waitForFunction(() => window.__ready, null, { timeout: 300000 });
    if (entry === 'stairs' && fixture) await stairsFixture(page, fixture, on => page.evaluate(on => __memAudit.fast(on), on));
    else if (fixture) await page.evaluate(fixture => { const c = __game.story.current; c.skipToCrest(); if (fixture !== 'walk') c.reveal(); }, fixture);
    const detail = process.env.DETAIL ? await page.evaluate(d => __memAudit.detail(d), Number(process.env.DETAIL)) : undefined;
    await page.waitForTimeout(2500);
    const census = await page.evaluate(survey);
    await page.evaluate(() => __memAudit.start());
    const f0 = await page.evaluate(() => __stats.frame);
    await page.waitForFunction(n => __stats.frame >= n, f0 + FRAMES, { timeout: 120000 });
    const used = await page.evaluate(usage);
    const usedIds = new Set(used.ids);
    for (const o of census.objects) o.used = usedIds.has(o.id);
    const group = o => (o.owner ?? ('unmatched ' + (o.where ?? '?').replace(/:\d+:\d+\)?$/, '').replace(/^.*\((?=src)/, ''))).replace(/\[\d+\]/g, '[]');
    const byOwner = {};
    for (const o of census.objects) {
      const top = group(o).split('.').slice(0, 2).join('.');
      const g = byOwner[top] ??= { bytes: 0, unused: 0, count: 0, kinds: {} };
      g.bytes += o.bytes; g.count++; g.kinds[o.kind] = (g.kinds[o.kind] ?? 0) + o.bytes; if (!o.used) g.unused += o.bytes;
    }
    const totals = {};
    for (const o of census.objects) { const t = totals[o.kind] ??= { bytes: 0, unused: 0, count: 0 }; t.bytes += o.bytes; t.count++; if (!o.used) t.unused += o.bytes; }
    const row = { chapter, ratio: process.env.RATIO ?? '1.5', msaa: process.env.MSAA ?? '2', detail, frames: FRAMES, canvas: census.canvas, contextAttributes: census.attributes,
      info: census.info, visited: census.visited, used: { ...used, ids: undefined }, totals, byOwner, objects: census.objects.sort((a, b) => b.bytes - a.bytes), errors };
    report.push(row);
    await fs.writeFile(out + '.json', JSON.stringify(report, null, 2));
    const MiB = b => (b / 1048576).toFixed(1);
    console.log(JSON.stringify({ chapter, totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, { MiB: MiB(v.bytes), unusedMiB: MiB(v.unused), count: v.count }])) }));
    for (const [k, v] of Object.entries(byOwner).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 30)) console.log('  ' + k.padEnd(46) + MiB(v.bytes).padStart(8) + ' MiB  unused ' + MiB(v.unused).padStart(7) + '  (' + v.count + ')');
    await page.close();
  }
} finally { await close(); }

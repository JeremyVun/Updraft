// CPU error map of the distant-height atlas, before any GPU work: for every patch, the atlas's bilinear height
// (stored as R16F or R32F) against worldHeight at sub-texel points, and the terrain normal the vertex shader makes
// from h, hx and hz at leaf vertex spacings of 1, 2 and 4 m (only where that ground is above -2 m).
// Samples: a lattice at a quarter of a 1 m texel (it contains every quarter-point of both 1 m and 2 m texels),
// plus random points. "Visible" rows keep only points whose exact height is above -2 m: deeper ground is under
// the sea, which beyond the window shades its bed as if 12 m deep, and the light bake clamps heights at 0.
// Fallback: a bilinear cell is flagged for the direct calculation when, at its quarter-points and edge midpoints
// (the points the GPU bake tests), the atlas misses worldHeight by more than FLAG (1 cm), and any of those points
// or its corners is above FLAG_ABOVE (-4 m: a normal at visible ground can reach 2 m down a steep bank). "final" rows are the lookup as built: exact in flagged cells, bilinear elsewhere.
// Usage: node tools/terrain-heights-errors.mjs [outDir]   (default /tmp/updraft-terrain-heights-errors)
//   ONLY=1m-f32,2m-f16 limits the configurations. Writes summary.json and maps per configuration, one pixel per metre over shaded relief (blue under -2 m):
//   error-map-*: red where the bilinear height error exceeds 5 cm, yellow where the 2 m normal exceeds 0.01, orange
//   both; flags-*: magenta for flagged cells, and red/yellow for anything the fallback still leaves over a gate.
import './lib/typescript.mjs';
import fs from 'node:fs';
import { encodePng } from './lib/png.mjs';

globalThis.location = { search: '' };
const { worldHeight } = await import('../src/world/heightfield.ts');
const { layoutHeightPatches, smallestHeightLayout, HEIGHT_FLAG_METRES, HEIGHT_FLAG_ABOVE, HEIGHT_TESTED } = await import('../src/world/terrain-heights.ts');
const out = process.argv[2] ?? '/tmp/updraft-terrain-heights-errors';
fs.mkdirSync(out, { recursive: true });

const S = 0.25, VISIBLE = -2, HEIGHT_GATE = 0.05, NORMAL_GATE = 0.01, SPACINGS = [1, 2, 4], RANDOM = 40000;
const FLAG = HEIGHT_FLAG_METRES, FLAG_ABOVE = HEIGHT_FLAG_ABOVE;
const TESTED = HEIGHT_TESTED;
const CONFIGS = [[1, 'f16'], [1, 'f32'], [2, 'f16'], [2, 'f32']].filter(([t, s]) => !process.env.ONLY || process.env.ONLY.split(',').includes(t + 'm-' + s));
const store = { f16: Math.f16round, f32: Math.fround };
const { patches, width: atlasW, height: atlasH } = layoutHeightPatches(2, 1024);
const mapW = atlasW * 2, mapH = atlasH * 2;
const maps = Object.fromEntries(CONFIGS.flatMap(([t, s]) => [[`error-map-${t}m-${s}`, new Uint8Array(mapW * mapH * 3)], [`flags-${t}m-${s}`, new Uint8Array(mapW * mapH * 3)]]));
const pct = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0);
const stats = (values) => { const a = Float32Array.from(values).sort(); return { max: a.length ? a[a.length - 1] : 0, p99: pct(a, 0.99), n: a.length }; };
let seed = 12345;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

function normalError(e, a0, a1, a2, b0, b1, b2) {
  const la = Math.hypot(a0 - a1, e, a0 - a2), lb = Math.hypot(b0 - b1, e, b0 - b2);
  return Math.max(Math.abs((a0 - a1) / la - (b0 - b1) / lb), Math.abs(e / la - e / lb), Math.abs((a0 - a2) / la - (b0 - b2) / lb));
}

const summary = [];
const started = performance.now();
for (const [index, p] of patches.entries()) {
  const W = p.width * 2 * 4 - 3, H = p.height * 2 * 4 - 3;
  const exact = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) exact[j * W + i] = worldHeight(p.minX + i * S, p.minZ + j * S);
  for (const [texel, format] of CONFIGS) {
    const k = texel / S, tw = Math.floor((W - 1) / k - 0.5) + 1, th = Math.floor((H - 1) / k - 0.5) + 1;
    const stored = new Float64Array(tw * th);
    for (let b = 0; b < th; b++) for (let a = 0; a < tw; a++) stored[b * tw + a] = store[format](exact[Math.round((b + 0.5) * k) * W + Math.round((a + 0.5) * k)]);
    const cellOf = (x, z) => {
      const qx = (x - p.minX) / texel - 0.5, qz = (z - p.minZ) / texel - 0.5;
      const a = Math.min(Math.max(Math.floor(qx), 0), tw - 2), b = Math.min(Math.max(Math.floor(qz), 0), th - 2);
      return [a, b, qx - a, qz - b];
    };
    const bilinear = (x, z) => {
      const [a, b, tx, tz] = cellOf(x, z);
      const s0 = stored[b * tw + a], s1 = stored[b * tw + a + 1], s2 = stored[(b + 1) * tw + a], s3 = stored[(b + 1) * tw + a + 1];
      return (s0 + (s1 - s0) * tx) + ((s2 + (s3 - s2) * tx) - (s0 + (s1 - s0) * tx)) * tz;
    };
    const flags = new Uint8Array(tw * th);
    let visibleCells = 0, flaggedCells = 0;
    for (let b = 0; b < th - 1; b++) for (let a = 0; a < tw - 1; a++) {
      const ci = (a + 0.5) * k, cj = (b + 0.5) * k;
      let worst = 0, top = Math.max(exact[cj * W + ci], exact[cj * W + ci + k], exact[(cj + k) * W + ci], exact[(cj + k) * W + ci + k]);
      for (const [fx, fz] of TESTED) {
        const at = (cj + fz * k) * W + ci + fx * k, x = p.minX + (ci + fx * k) * S, z = p.minZ + (cj + fz * k) * S;
        worst = Math.max(worst, Math.abs(bilinear(x, z) - exact[at]));
        top = Math.max(top, exact[at]);
      }
      if (top > VISIBLE) visibleCells++;
      if (top > FLAG_ABOVE && worst > FLAG) { flags[b * tw + a] = 1; flaggedCells++; }
    }
    const lookup = (x, z, direct) => { const [a, b] = cellOf(x, z); return flags[b * tw + a] ? direct() : bilinear(x, z); };
    const i0 = Math.round(0.5 * k), i1 = Math.round((tw - 0.5) * k), j0 = Math.round(0.5 * k), j1 = Math.round((th - 0.5) * k);
    const approx = new Float32Array(W * H), final = new Float32Array(W * H);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const x = p.minX + i * S, z = p.minZ + j * S;
      approx[j * W + i] = bilinear(x, z);
      final[j * W + i] = lookup(x, z, () => exact[j * W + i]);
    }
    const raw = { height: [], visible: [], normals: Object.fromEntries(SPACINGS.map((e) => [e, []])) };
    const fin = { height: [], visible: [], normals: Object.fromEntries(SPACINGS.map((e) => [e, []])) };
    const cw = Math.ceil(W / 4), rawCell = new Uint8Array(cw * Math.ceil(H / 4)), finCell = new Uint8Array(rawCell.length);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const at = j * W + i, h = exact[at], c = (j >> 2) * cw + (i >> 2);
      for (const [set, values, cell] of [[raw, approx, rawCell], [fin, final, finCell]]) {
        const err = Math.abs(values[at] - h);
        set.height.push(err);
        if (h > VISIBLE) { set.visible.push(err); if (err > HEIGHT_GATE) cell[c] |= 1; }
        for (const e of SPACINGS) {
          const d = e / S;
          if (i + d >= i1 || j + d >= j1 || Math.max(h, exact[at + d], exact[at + d * W]) <= VISIBLE) continue;
          const ne = normalError(e, h, exact[at + d], exact[at + d * W], values[at], values[at + d], values[at + d * W]);
          set.normals[e].push(ne);
          if (e === 2 && ne > NORMAL_GATE) cell[c] |= 2;
        }
      }
    }
    const randomRaw = [], randomFinal = [];
    for (let r = 0; r < RANDOM; r++) {
      const x = p.minX + (i0 + random() * (i1 - i0 - 1)) * S, z = p.minZ + (j0 + random() * (j1 - j0 - 1)) * S, h = worldHeight(x, z);
      if (h <= VISIBLE) continue;
      randomRaw.push(Math.abs(bilinear(x, z) - h));
      randomFinal.push(Math.abs(lookup(x, z, () => h) - h));
    }
    for (let cz = 0; cz < Math.ceil(H / 4); cz++) for (let cx = 0; cx < cw; cx++) {
      const mx = p.x * 2 + cx, mz = p.y * 2 + cz;
      if (mx >= mapW || mz >= mapH) continue;
      const h = exact[Math.min(H - 1, cz * 4) * W + Math.min(W - 1, cx * 4)], o = (mz * mapW + mx) * 3;
      const grey = Math.max(0, Math.min(255, 70 + h * 4)), base = h > VISIBLE ? [grey, grey, grey] : [20, 40, 90];
      const colour = (flag) => (flag === 3 ? [255, 140, 0] : flag === 1 ? [230, 30, 30] : flag === 2 ? [255, 230, 0] : null);
      maps[`error-map-${texel}m-${format}`].set(colour(rawCell[cz * cw + cx]) ?? base, o);
      const [a, b] = cellOf(p.minX + cx * 4 * S + 0.5, p.minZ + cz * 4 * S + 0.5);
      maps[`flags-${texel}m-${format}`].set(colour(finCell[cz * cw + cx]) ?? (flags[b * tw + a] ? [220, 0, 220] : base), o);
    }
    const summarise = (set, randoms) => ({
      height: stats(set.height), heightVisible: stats(set.visible), random: stats(randoms),
      over5cm: set.visible.filter((v) => v > HEIGHT_GATE).length / Math.max(1, set.visible.length),
      normal: Object.fromEntries(SPACINGS.map((e) => [e, { ...stats(set.normals[e]), over: set.normals[e].filter((v) => v > NORMAL_GATE).length / Math.max(1, set.normals[e].length) }])),
    });
    const row = {
      patch: index, minX: p.minX, minZ: p.minZ, metres: [p.width * 2, p.height * 2], texel, format,
      cells: (tw - 1) * (th - 1), visibleCells, flaggedCells, flaggedOfVisible: flaggedCells / Math.max(1, visibleCells),
      raw: summarise(raw, randomRaw), final: summarise(fin, randomFinal),
    };
    summary.push(row);
    const r = (v) => +v.toFixed(4), brief = (s) => ({ h: [r(s.heightVisible.max), r(s.heightVisible.p99)], rand: r(s.random.max), n1: [r(s.normal[1].max), r(s.normal[1].p99)], n2: [r(s.normal[2].max), r(s.normal[2].p99), r(s.normal[2].over)], n4: [r(s.normal[4].max), r(s.normal[4].p99)] });
    console.log(JSON.stringify({ patch: index, at: [p.minX, p.minZ], m: row.metres, texel, format, flagged: r(row.flaggedOfVisible), raw: brief(row.raw), final: brief(row.final) }));
  }
}
for (const [name, pixels] of Object.entries(maps)) fs.writeFileSync(`${out}/${name}.png`, encodePng(mapW, mapH, pixels));
const memory = Object.fromEntries(CONFIGS.map(([t, s]) => {
  const l = smallestHeightLayout(t);
  return [t + 'm-' + s, { texels: [l.width, l.height], MiB: +(l.width * l.height * (s === 'f16' ? 2 : 4) / 2 ** 20).toFixed(2) }];
}));
const totals = Object.fromEntries(CONFIGS.map(([t, s]) => {
  const rows = summary.filter((row) => row.texel === t && row.format === s);
  return [t + 'm-' + s, { visibleCells: rows.reduce((n, row) => n + row.visibleCells, 0), flaggedCells: rows.reduce((n, row) => n + row.flaggedCells, 0) }];
}));
fs.writeFileSync(`${out}/summary.json`, JSON.stringify({ flagMetres: FLAG, memory, totals, rows: summary, seconds: (performance.now() - started) / 1000 }, null, 2));
console.log(JSON.stringify({ memory, totals, seconds: +((performance.now() - started) / 1000).toFixed(1) }));

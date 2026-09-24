// Objective mirrors for how the scarf moves: bounce, settling time, creep, stretch, the tied lengths' drift, and
// jitter (per-vertex second difference of the mesh between frames) tied in wind, through a release and in the gathering.
// ROOT=/path/to/checkout node tools/scarf-feel-probe.mjs   (default: this checkout). No browser.
import './lib/typescript.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.location = { search: '?shot' };
const root = path.resolve(process.env.ROOT ?? fileURLToPath(new URL('..', import.meta.url)));
const { BirchScarf } = await import(path.join(root, 'src/world/birch-scarf.ts'));
const island = await import(path.join(root, 'src/world/island.ts'));
const trees = JSON.parse(fs.readFileSync(new URL('./lib/birch-trees.json', import.meta.url), 'utf8'))
  .map(([x, y, z, scale]) => ({ x, y, z, scale }));
{
  const res = 400, size = 200, minX = -100, minZ = -1230, data = new Float32Array(res * res);
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) data[z * res + x] = island.heightAt(minX + (x + .5) / res * size, minZ + (z + .5) / res * size);
  island.setHeightGrid({ data, res, size, minX, minZ, stride: 1 });
}
const wind = {
  t: 0, calm: false,
  sample(x, z, out) {
    if (this.calm) { out.x = out.z = out.energy = out.lift = 0; return out; }
    const t = this.t;
    out.x = 1.6 + .7 * Math.sin(x * .21 + t * .9) + .4 * Math.sin(z * .17 - t * 1.3);
    out.z = -.8 + .6 * Math.sin(z * .23 + t * .7) + .3 * Math.cos(x * .19 + t * 1.1);
    out.lift = .15 * Math.sin(x * .3 + z * .2 + t * 1.7); out.energy = .05;
    return out;
  },
};
const scarf = new BirchScarf();
scarf.setTrees(trees, false);
for (const _ of scarf.settle()) { /* startup */ }
let time = 0, frame = 0, mast;
// The CPU wind copy changes only when a readback lands, every other frame; the boat bobs at the shore.
const step = (seconds, dt = 1 / 60) => {
  for (let f = 0; f < Math.round(seconds / dt); f++) {
    time += dt; frame++; wind.t = Math.floor(frame / 2) * 2 / 60;
    if (mast) mast.set(-4 + .06 * Math.sin(time * 1.3), 3.1 + .08 * Math.sin(time * .9), -1197 + .04 * Math.sin(time * 1.1));
    scarf.update(dt, wind, mast);
  }
};
const jitter = (seconds) => {
  const p = scarf.mesh.geometry.attributes.position.array, n = p.length;
  const a = new Float32Array(n), b = new Float32Array(n), all = [];
  let worstRow = 0, worst = 0;
  for (let f = 0; f < Math.round(seconds * 60); f++) {
    a.set(b); b.set(p); step(1 / 60);
    if (f < 2 || !scarf.mesh.visible) continue;
    let sum = 0;
    for (let v = 0; v < n; v += 3) {
      const d = Math.hypot(p[v] - 2 * b[v] + a[v], p[v + 1] - 2 * b[v + 1] + a[v + 1], p[v + 2] - 2 * b[v + 2] + a[v + 2]);
      sum += d;
      if (d > worst) { worst = d; worstRow = Math.floor(v / 3 / 24); }
    }
    all.push(sum / (n / 3));
  }
  all.sort((x, y) => x - y);
  const mm = v => +(v * 1000).toFixed(3);
  return { meanMm: mm(all.reduce((s, v) => s + v, 0) / all.length), p95FrameMm: mm(all[Math.floor(all.length * .95)]), worstVertexMm: mm(worst), worstRow };
};
const clothOf = index => index === 0 ? scarf.firstCloth : scarf.releasedCloth.get(index)?.cloth;
const speed = cloth => cloth.report().speed;

// Tied: how far authored rows wander, and how much of that is a wave running along the strip.
const rows = [];
for (let i = scarf.firstEnd + 1; i < 1100; i += 7) rows.push(i);
const tiedTrace = rows.map(() => []);
for (let f = 0; f < 600; f++) { step(1 / 60); rows.forEach((i, r) => tiedTrace[r].push(scarf.centre[i].y)); }
const spread = a => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
const tiedSway = tiedTrace.map(spread);
// The drawn-in strip keeps to its path while rows slide along it, so the surface is also compared at fixed places on
// the path (rows interpolated to the same point of the route each frame), which is what the eye follows.
const surfaceJitter = (seconds) => {
  const p = scarf.mesh.geometry.attributes.position.array, R = 1140, ring = 24;
  const history = [], all = [];
  for (let f = 0; f < Math.round(seconds * 60); f++) {
    step(1 / 60);
    if (!scarf.mesh.visible) break;
    const d = gatherDrawn();
    const frame = new Map();
    for (let r = Math.ceil(d * (R - 1)) + 1; r < R - 21; r += 3) {
      const at = (r - d * (R - 1)) / (1 - d), i = Math.min(R - 2, Math.floor(at)), t = at - i;
      const ringAt = new Float32Array(ring * 3);
      for (let j = 0; j < ring * 3; j++) ringAt[j] = p[i * ring * 3 + j] * (1 - t) + p[(i + 1) * ring * 3 + j] * t;
      frame.set(r, ringAt);
    }
    history.push(frame);
    if (history.length < 3) continue;
    const [a, b, c] = history.slice(-3);
    let sum = 0, n = 0;
    for (const [r, now] of c) {
      const one = b.get(r), two = a.get(r);
      if (!one || !two) continue;
      for (let j = 0; j < now.length; j += 3) { sum += Math.hypot(now[j] - 2 * one[j] + two[j], now[j + 1] - 2 * one[j + 1] + two[j + 1], now[j + 2] - 2 * one[j + 2] + two[j + 2]); n++; }
    }
    if (n) all.push(sum / n);
  }
  all.sort((x, y) => x - y);
  const mm = v => +(v * 1000).toFixed(3);
  return { meanMm: mm(all.reduce((s, v) => s + v, 0) / all.length), p95FrameMm: mm(all[Math.floor(all.length * .95)]), maxFrameMm: mm(all[all.length - 1]) };
};
const { tuning } = await import(path.join(root, 'src/tuning.ts'));
const gatherDrawn = () => { const x = Math.min(1, scarf.gathering / tuning.birches.scarf.gatherSeconds); return x * x * x * (x * (x * 6 - 15) + 10); };
const jitterTied = jitter(8);
const result = { root, jitter: { tied: jitterTied }, tied: { meanVerticalSway: +(tiedSway.reduce((s, v) => s + v, 0) / tiedSway.length).toFixed(4), maxVerticalSway: +Math.max(...tiedSway).toFixed(4) } };

function release(index, gesture) {
  const s = scarf.snags[index];
  scarf.active = index;
  let peakStretch = 1;
  while (!s.freed) { s.target = Math.min(1, s.target + gesture); step(1 / 60); const c = clothOf(index); if (c) peakStretch = Math.max(peakStretch, c.report().stretch); }
  const cloth = clothOf(index);
  // Height of a few material points along the released length: count reversals of their fall.
  const probes = [.3, .5, .7].map(u => ({ u, ys: [] }));
  const speeds = [];
  const p = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
  for (let f = 0; f < 60 * 30; f++) {
    step(1 / 60);
    peakStretch = Math.max(peakStretch, cloth.report().stretch);
    for (const probe of probes) { cloth.sample(cloth.length * probe.u, p); probe.ys.push(p.y); }
    speeds.push(speed(cloth));
  }
  const reversals = probes.map(({ ys }) => {
    let count = 0, dir = 0;
    for (let i = 6; i < ys.length; i += 6) {
      const d = ys[i] - ys[i - 6];
      if (Math.abs(d) < .004) continue;
      const sign = Math.sign(d);
      if (dir && sign !== dir) count++;
      dir = sign;
    }
    return count;
  });
  const under = (limit) => { const i = speeds.findIndex((v, k) => speeds.slice(k).every(w => w < limit)); return i < 0 ? null : +(i / 60).toFixed(2); };
  return { peakStretch: +peakStretch.toFixed(3), reversals, settledBelow20cm: under(.2), settledBelow5cm: under(.05),
    speedAt: { s5: +speeds[299].toFixed(3), s10: +speeds[599].toFixed(3), s30: +speeds[1799].toFixed(3) } };
}
result.releases = [release(0, .02), release(1, .01), release(2, .015)];
wind.calm = true;
step(30);
result.calmCreep = [0, 1, 2].map(i => +speed(clothOf(i)).toFixed(4));
wind.calm = false;
{
  mast = new (await import('three')).Vector3();
  const s = scarf.snags[3];
  scarf.active = 3;
  while (s.work < 1) { s.target = Math.min(1, s.target + .015); step(1 / 60); }
  result.jitter.bowRelease = jitter(2.6);
  const saved = { gathering: scarf.gathering, time, frame };
  result.jitter.gathering = jitter(9);
  scarf.restore(3); scarf.active = 3;
  while (s.work < 1) { s.target = 1; step(1 / 60); }
  result.jitter.gatheringSurface = surfaceJitter(9);
}
console.log(JSON.stringify(result, null, 1));

// Bit-exact scarf parity with another checkout: the same scripted gestures, wind, checkpoint restores and height
// grids drive both builds' BirchScarf in lockstep, and every frame's mesh positions, normals and cloth particles
// must be identical. No browser; the wind is a deterministic stand-in for the CPU wind copy.
// BASELINE=/path/to/checkout node tools/scarf-exact-check.mjs
// PERTURB=<frame> nudges one normal of this build at that frame to prove the comparison fails.
// OUT=/tmp/updraft-scarf-exact.json
import './lib/typescript.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

globalThis.location = { search: '?shot' };
const here = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const there = process.env.BASELINE && path.resolve(process.env.BASELINE);
if (!there) throw new Error('Set BASELINE to the checkout to compare against');
const trees = JSON.parse(fs.readFileSync(new URL('./lib/birch-trees.json', import.meta.url), 'utf8'))
  .map(([x, y, z, scale]) => ({ x, y, z, scale }));

async function load(root) {
  const { BirchScarf, SCARF_SNAGS } = await import(path.join(root, 'src/world/birch-scarf.ts'));
  const island = await import(path.join(root, 'src/world/island.ts'));
  return { BirchScarf, SCARF_SNAGS, island };
}
const builds = [await load(here), await load(there)];
if (builds[0].island === builds[1].island) throw new Error('BASELINE resolves to this checkout');

// Real play replaces the height grid as the window moves, so the run switches grids part way through.
const grids = [0, 1].map(shift => {
  const res = 400, size = 200, minX = -100 + shift * 13.7, minZ = -1230 + shift * 9.1, data = new Float32Array(res * res);
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
    data[z * res + x] = builds[0].island.heightAt(minX + (x + .5) / res * size, minZ + (z + .5) / res * size);
  }
  return { data, res, size, minX, minZ, stride: 1 };
});
const setGrid = g => { for (const b of builds) b.island.setHeightGrid(grids[g]); };
setGrid(0);

const snags = builds[0].SCARF_SNAGS;
function makeWind() {
  return {
    t: 0, calm: false, gust: null,
    sample(x, z, out) {
      if (this.calm) { out.x = out.z = out.energy = out.lift = 0; return out; }
      const t = this.t;
      let wx = 1.6 + .7 * Math.sin(x * .21 + t * .9) + .4 * Math.sin(z * .17 - t * 1.3);
      let wz = -.8 + .6 * Math.sin(z * .23 + t * .7) + .3 * Math.cos(x * .19 + t * 1.1);
      let lift = .15 * Math.sin(x * .3 + z * .2 + t * 1.7), energy = .05;
      const g = this.gust;
      if (g) {
        const d2 = (x - g.x) ** 2 + (z - g.z) ** 2, f = Math.exp(-d2 / (g.r * g.r));
        wx += g.vx * f; wz += g.vz * f; lift += g.lift * f; energy += .6 * f;
      }
      out.x = wx; out.z = wz; out.lift = lift; out.energy = energy;
      return out;
    },
  };
}

const irregular = [1 / 60, .0137, .021, 1 / 60, .0094, .033, 1 / 60, .0171];
const script = [
  { name: 'tied-wind', frames: 240 },
  { name: 'tied-gust', frames: 150, gust: 0 },
  { name: 'tied-calm', frames: 150, calm: true },
  { name: 'tied-30hz', frames: 60, dt: 1 / 30 },
  { name: 'grid-moved', frames: 40, grid: 1 },
  { name: 'lift-partial', frames: 110, gesture: 0, rate: .007, gust: 0 },
  { name: 'lift-holds', frames: 60 },
  { name: 'lift-finish', frames: 120, gesture: 0, rate: .012, gust: 0 },
  { name: 'release-and-slip', frames: 420 },
  { name: 'released-calm', frames: 180, calm: true, grid: 0 },
  { name: 'unwind', frames: 220, gesture: 1, rate: .008 },
  { name: 'unwind-release-irregular-dt', frames: 320, dt: 'irregular' },
  { name: 'restore-1', frames: 150, restore: 1 },
  { name: 'pull-partial', frames: 90, gesture: 2, rate: .007, gust: 2 },
  { name: 'restore-2-mid-pull', frames: 60, restore: 2 },
  { name: 'pull', frames: 200, gesture: 2, rate: .01, gust: 2 },
  { name: 'pull-release', frames: 260 },
  { name: 'bow-partial', frames: 80, gesture: 3, rate: .008 },
  { name: 'restore-3-mid-bow', frames: 90, restore: 3 },
  { name: 'bow', frames: 160, gesture: 3, rate: .01, gust: 3 },
  { name: 'gathering', frames: 720, mast: true },
  { name: 'restore-0', frames: 200, restore: 0 },
  { name: 'restore-2', frames: 200, restore: 2, dt: 1 / 30 },
  { name: 'restore-4', frames: 20, restore: 4 },
];

const instances = builds.map(b => {
  const scarf = new b.BirchScarf();
  scarf.setTrees(trees, false);
  for (const _ of scarf.settle()) { /* startup settles in batches */ }
  return { scarf, wind: makeWind(), times: [] };
});

const packCloth = scarf => {
  const out = [];
  const add = cloth => { for (const list of [cloth.positions, cloth.previous]) for (const p of list) out.push(p.x, p.y, p.z); };
  add(scarf.firstCloth);
  for (const index of [...scarf.releasedCloth.keys()].sort()) add(scarf.releasedCloth.get(index).cloth);
  return Float64Array.from(out);
};
const worst = { positions: 0, normals: 0, cloth: 0 };
const failures = [];
let frames = 0, compared = 0;
function compare(label, a, b) {
  compared += a.length;
  if (a.length !== b.length) { failures.push({ frame: frames, label, lengths: [a.length, b.length] }); worst[label] = Infinity; return; }
  const ua = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), ub = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  if (Buffer.compare(ua, ub) === 0) return;
  let max = 0, count = 0, first = -1;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) {
    count++; if (first < 0) first = i;
    max = Math.max(max, Number.isNaN(a[i] - b[i]) ? Infinity : Math.abs(a[i] - b[i]));
  }
  worst[label] = Math.max(worst[label], max);
  if (failures.length < 20) failures.push({ frame: frames, label, count, max, first });
}

const perturb = process.env.PERTURB ? Number(process.env.PERTURB) : -1;
const phases = [];
for (const phase of script) {
  if (phase.grid !== undefined) setGrid(phase.grid);
  for (const { scarf } of instances) if (phase.restore !== undefined) scarf.restore(phase.restore);
  const before = failures.length;
  for (let f = 0; f < phase.frames; f++) {
    const dt = phase.dt === 'irregular' ? irregular[f % irregular.length] : phase.dt ?? 1 / 60;
    for (const inst of instances) {
      const { scarf, wind } = inst;
      // The CPU wind copy changes only when a readback lands, every other frame.
      wind.t = Math.floor(frames / 2) * 2 / 60;
      wind.calm = !!phase.calm;
      const g = phase.gust, c = g !== undefined && scarf.snags[g].center;
      wind.gust = c ? { x: c.x + Math.sin(frames * .05) * 4, z: c.z, r: 3.5, vx: 14 * Math.cos(frames * .03), vz: -9, lift: phase.gesture === 0 ? 3 : 0 } : null;
      if (phase.gesture !== undefined) {
        const s = scarf.snags[phase.gesture];
        scarf.active = phase.gesture;
        if (!s.freed && f % 3 !== 2) {
          s.target = Math.min(1, s.target + phase.rate);
          s.brushAge = 0;
          s.impulse = Math.min(1, s.impulse + .06);
        }
      }
      const mast = phase.mast ? new THREE.Vector3(-4 + Math.sin(frames * .02) * .3, 3.1, -1197 + f * .002) : undefined;
      const start = performance.now();
      scarf.update(dt, wind, mast);
      inst.times.push(performance.now() - start);
    }
    const [mine, theirs] = instances.map(i => i.scarf);
    const geometry = s => s.mesh.geometry.attributes;
    if (frames === perturb) geometry(mine).normal.array[3001] += 1e-6;
    compare('positions', geometry(mine).position.array, geometry(theirs).position.array);
    compare('normals', geometry(mine).normal.array, geometry(theirs).normal.array);
    compare('cloth', packCloth(mine), packCloth(theirs));
    if (mine.mesh.visible !== theirs.mesh.visible) failures.push({ frame: frames, label: 'visible' });
    frames++;
  }
  const s = instances[0].scarf;
  phases.push({ name: phase.name, frames: phase.frames, freed: s.completed, woven: +s.woven.toFixed(3),
    released: [...s.releasedCloth.keys()], exact: failures.length === before });
}

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const report = {
  exact: failures.length === 0, frames, valuesCompared: compared, maxDifference: worst, phases, failures,
  updateMs: { current: median(instances[0].times), baseline: median(instances[1].times) },
};
fs.writeFileSync(process.env.OUT ?? '/tmp/updraft-scarf-exact.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ exact: report.exact, frames, valuesCompared: compared, maxDifference: worst,
  updateMs: report.updateMs, failures: failures.slice(0, 5) }));
if (!report.exact) process.exit(1);

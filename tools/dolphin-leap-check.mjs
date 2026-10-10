// Real pod movement at 30/60 fps, both camera sides and widths. MUTATE=old restores the faulty launch in memory.
import './lib/typescript.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { transformSync } from 'rolldown/utils';
import * as THREE from 'three';

if (process.env.MUTATE === 'old') registerHooks({ load(url, context, next) {
  if (!url.endsWith('/src/fx/sealife/dolphin.ts')) return next(url, context);
  const source = execFileSync('git', ['show', '893c316f:src/fx/sealife/dolphin.ts'], { encoding: 'utf8' });
  return { format: 'module', shortCircuit: true, source: transformSync(new URL(url).pathname, source).code };
} });
globalThis.location = { search: '?shot' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { Dolphins } = await import('../src/fx/sealife/dolphin.ts');

const results = [];
for (const portrait of [false, true]) for (const side of [-1, 1]) for (const fps of [30, 60]) {
  for (const initial of [1, 42, 147, 729]) {
    let seed = initial;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const camera = new THREE.PerspectiveCamera(50, portrait ? 430 / 932 : 1600 / 900, 0.1, 1000);
    const pod = new Dolphins(camera), boat = new THREE.Vector3();
    let start, end, previous, worstError = 0, leastClear = Infinity;
    for (let i = 0; i < fps * 35; i++) {
      const time = i / fps;
      boat.z = time * 4.5;
      pod.run(boat, 0, side, false, true);
      pod.update(1 / fps, time);
      const s = pod.stunt;
      if (s?.kind !== 'leap') continue;
      const d = s.d;
      if (d.seg === 'air' && d.kind === 'leap') {
        const row = { time, along: d.along, across: d.across, x: d.x, z: d.z, yaw: d.yaw, pace: d.pace };
        start ??= row; end = row;
        leastClear = Math.min(leastClear, d.across * side);
        if (previous) worstError = Math.max(worstError, Math.hypot(
          d.x - previous.x - Math.sin(previous.yaw) * previous.pace / fps,
          d.z - previous.z - Math.cos(previous.yaw) * previous.pace / fps));
        previous = row;
      }
      if (start && s.phase === 'back') break;
    }
    const context = JSON.stringify({ portrait, side, fps, seed: initial, start, end, leastClear, worstError });
    assert(start && end && end.time - start.time > 0.8, `The actual dolphin makes its leap: ${context}`);
    assert(leastClear > 2.8, `The flight stays on its side, clear of the hull: ${context}`);
    assert(end.along - start.along > 1.3, `The dolphin overtakes the boat through the leap: ${context}`);
    assert(worstError < 1e-6, `The flight preserves its velocity without hull clamping: ${context}`);
    results.push({ portrait, side, fps, seed: initial, takeoff: start.time, gain: end.along - start.along, leastClear, worstError });
  }
}
console.log(JSON.stringify(results));
console.log('Dolphin launch, overtaking flight and hull clearance passed.');

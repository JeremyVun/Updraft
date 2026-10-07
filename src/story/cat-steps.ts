import * as THREE from 'three';
import type { Cat } from '../creatures/cat';
import type { CatStep } from '../world/crossings/cat-way';

/** The height along a run of points, under (x, z): what the cat runs on between them. */
export function lineFloor(points: readonly THREE.Vector3[]): (x: number, z: number) => number {
  return (x, z) => {
    let best = Infinity, y = points[0].y;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
      const u = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const d = Math.hypot(x - a.x - dx * u, z - a.z - dz * u);
      if (d < best) { best = d; y = a.y + (b.y - a.y) * u; }
    }
    return y;
  };
}

/**
 * QA yards' stand-in for the room's cat driving: the cat through a piece's steps one after another, `onStep` as each
 * begins, then sitting looking at `look` and `onDone`.
 */
export function playCatSteps(cat: Cat, steps: readonly CatStep[], look: THREE.Vector3, speeds: { run: number; narrow: number },
  onStep: (i: number) => void, onDone: () => void): void {
  const step = (i: number) => {
    const m = steps[i];
    if (!m) {
      cat.rest('sit', look);
      onDone();
      return;
    }
    onStep(i);
    const on = () => step(i + 1);
    const last = i === steps.length - 1;
    if ('run' in m) {
      const from = cat.position.clone();
      cat.run(m.run, m.floor ?? lineFloor([from, ...m.run]), { pace: 'run', speed: m.narrow ? speeds.narrow : speeds.run, narrow: m.narrow,
        then: last ? 'sit' : 'stand', look: last ? look : null }, on);
    } else if ('hop' in m) cat.hop(m.hop, { then: last ? 'sit' : 'stand', arc: 0.25, look: last ? look : null }, on);
    else cat.leap(m.leap, { then: last ? 'sit' : 'stand', arc: 0.35, look: last ? look : null }, on);
  };
  step(0);
}

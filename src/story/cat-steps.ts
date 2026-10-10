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

/** Where a cat being driven through a piece's steps has got to: the step it is on or waiting to start, all done at the end. */
export interface CatSteps {
  readonly step: number;
  /** Call every frame: a step that waits on something starts once it holds. */
  update(): void;
}

/**
 * The cat through a piece's steps one after another, `onStep` as each begins, then sitting looking at `look` and
 * `onDone`; with `stand` it stays on its feet at the end instead, ready to go on.
 */
export function playCatSteps(cat: Cat, steps: readonly CatStep[], look: THREE.Vector3, speeds: { run: number; narrow: number },
  onStep: (i: number) => void, onDone: () => void, stand = false): CatSteps {
  let at = 0, pending = false;
  const go = (i: number) => {
    const m = steps[i];
    if (!m) {
      if (!stand) cat.rest('sit', look);
      onDone();
      return;
    }
    onStep(i);
    const on = () => step(i + 1);
    const last = i === steps.length - 1;
    const then = last && !stand ? 'sit' : m.frame ? 'crouch' : 'stand';
    const sight = last ? look : null;
    if ('run' in m) {
      const from = cat.position.clone();
      cat.run(m.run, m.floor ?? lineFloor([from, ...m.run]), { pace: 'run', speed: m.narrow ? speeds.narrow : speeds.run, narrow: m.narrow,
        then, look: sight }, on);
    } else if ('hop' in m) cat.hop(m.hop, { frame: m.frame, upright: m.upright, then, arc: m.frame ? undefined : 0.25, look: sight, gather: m.gather, yaw: m.yaw, floor: m.floor }, on);
    else cat.leap(m.leap, { frame: m.frame, upright: m.upright, then, arc: m.frame ? undefined : 0.35, look: sight, gather: m.gather, yaw: m.yaw, floor: m.floor }, on);
  };
  const step = (i: number) => {
    at = i;
    pending = !!steps[i]?.when && !steps[i].when!();
    if (!pending) go(i);
  };
  step(0);
  return {
    get step() { return at; },
    update() {
      if (pending && steps[at].when!()) {
        pending = false;
        go(at);
      }
    },
  };
}

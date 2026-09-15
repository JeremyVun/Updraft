import { fieldAt, type FieldSample } from './fields';
import { COTTAGE } from './heightfield';
import { GRASS_LINE, heightAt, slopeAt } from './island';
import { mulberry32 } from './noise';

export interface Rock {
  x: number;
  z: number;
  /** Footprint radius; grass does not grow inside it. */
  radius: number;
  height: number;
  yaw: number;
  seed: number;
}

export const TREE = { x: -15, z: -31 } as const;
export const TREE_CLEARING = 3.2;

function scatter(cx: number, cz: number, count: number, spread: number, size: number, seed: number): Rock[] {
  const rand = mulberry32(seed);
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * spread;
    const radius = size * (0.45 + rand() * 0.8) * (i === 0 ? 1.5 : 1);
    rocks.push({
      x: cx + (i === 0 ? 0 : Math.cos(a) * d),
      z: cz + (i === 0 ? 0 : Math.sin(a) * d),
      radius,
      height: radius * (0.55 + rand() * 0.5),
      yaw: rand() * Math.PI * 2,
      seed: rand() * 1000,
    });
  }
  return rocks;
}

export const ROCKS: Rock[] = [
  ...scatter(34, -8, 5, 7, 2.6, 11),
  ...scatter(-52, 6, 4, 6, 2.2, 12),
  ...scatter(62, 30, 3, 4, 2.4, 13),
  ...scatter(-8, -52, 3, 5, 2.0, 14),
  ...scatter(18, 28, 2, 3, 1.4, 15),
  ...scatter(-34, -14, 2, 3, 1.3, 16),
].filter((r) => heightAt(r.x, r.z) > -0.8);

export interface FlowerPatch {
  x: number;
  z: number;
  radius: number;
}

/** Where wildflowers grow: petals rest here, and butterflies and rabbits visit. */
export const FLOWER_PATCHES: FlowerPatch[] = (() => {
  const rand = mulberry32(7);
  const patches: FlowerPatch[] = [];
  while (patches.length < 34) {
    const x = -62 + rand() * 120;
    const z = -58 + rand() * 96;
    if (heightAt(x, z) > GRASS_LINE + 2.2) patches.push({ x, z, radius: 2 + rand() * 3.5 });
  }
  return patches;
})();

/** 0 inside a rock or the tree's footprint, 1 in the open. */
export function openGround(x: number, z: number): number {
  let open = Math.min(1, Math.hypot(x - TREE.x, z - TREE.z) / TREE_CLEARING);
  for (const r of ROCKS) {
    const d = Math.hypot(x - r.x, z - r.z) / (r.radius * 0.95);
    if (d < 1) open = Math.min(open, d * d);
  }
  return open;
}

/** Wildflower patches in the pastures either side of a path across the mainland, clear of walls and the cottage. */
export function wildflowersAlong(path: readonly { x: number; y: number }[], perLeg = 9, spread = 42): FlowerPatch[] {
  const rand = mulberry32(19);
  const field: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 };
  const patches: FlowerPatch[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    for (let made = 0, tries = 0; made < perLeg && tries < perLeg * 12; tries++) {
      const t = rand();
      const x = a.x + (b.x - a.x) * t + (rand() * 2 - 1) * spread;
      const z = a.y + (b.y - a.y) * t + (rand() * 2 - 1) * spread;
      const radius = 2 + rand() * 2.5;
      const f = fieldAt(x, z, field);
      if (f.wall && f.edge < radius + 1.5) continue;
      if (slopeAt(x, z) > 0.6 || Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < COTTAGE.radius + 8) continue;
      patches.push({ x, z, radius });
      made++;
    }
  }
  return patches;
}

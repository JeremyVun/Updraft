import type { Vector3 } from 'three';

interface Position { x: number; y: number; z: number }

/** Population order breaks exact-distance ties; callers retain the same live state arrays between queries. */
export function nearestCreature(populations: readonly (readonly Position[])[], x: number, z: number,
  radius: number, out: Vector3): boolean {
  let best = radius * radius;
  let found = false;
  for (const population of populations) for (const animal of population) {
    const d = (animal.x - x) ** 2 + (animal.z - z) ** 2;
    if (d < best) {
      best = d;
      out.set(animal.x, animal.y + 0.35, animal.z);
      found = true;
    }
  }
  return found;
}

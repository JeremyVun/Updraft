import type { Box3, Vector3 } from 'three';

/** Height needed to see the primary over static scenery. Scalar slab checks; no raycasts or allocations. */
export function sceneryLift(eye: Vector3, subject: Vector3, boxes: readonly Box3[], padding: number): number {
  const dx = subject.x - eye.x, dz = subject.z - eye.z;
  let lift = 0;
  for (const box of boxes) {
    let enter = 0, exit = 0.92;
    if (Math.abs(dx) < 1e-6) {
      if (eye.x < box.min.x - padding || eye.x > box.max.x + padding) continue;
    } else {
      const a = (box.min.x - padding - eye.x) / dx, b = (box.max.x + padding - eye.x) / dx;
      enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    }
    if (Math.abs(dz) < 1e-6) {
      if (eye.z < box.min.z - padding || eye.z > box.max.z + padding) continue;
    } else {
      const a = (box.min.z - padding - eye.z) / dz, b = (box.max.z + padding - eye.z) / dz;
      enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    }
    if (enter > exit) continue;
    const top = box.max.y + 0.75;
    lift = Math.max(lift, (top - eye.y - (subject.y - eye.y) * enter) / (1 - enter),
      (top - eye.y - (subject.y - eye.y) * exit) / (1 - exit));
  }
  return lift;
}

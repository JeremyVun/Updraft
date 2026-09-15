/**
 * The square of the world that is simulated and baked in detail: the wind field, the height and shadow bakes,
 * the grass and the petals all cover it. It follows the camera in whole steps; systems that hold data in
 * window space listen for moves and shift or re-bake. See docs/contracts/wind.md.
 */

export const WINDOW_SIZE = 320;
/** Moves snap to this, a whole number of texels for every window texture. */
const STEP = 10;
/** The window recentres once the wanted centre drifts this far. */
const SLACK = 30;

export const WINDOW = { minX: -WINDOW_SIZE / 2, minZ: -WINDOW_SIZE / 2, size: WINDOW_SIZE };

type MoveListener = (dx: number, dz: number) => void;
const listeners: MoveListener[] = [];

export function onWindowMove(listener: MoveListener): void {
  listeners.push(listener);
}

export function windowCentre(): [number, number] {
  return [WINDOW.minX + WINDOW.size / 2, WINDOW.minZ + WINDOW.size / 2];
}

/** Recentres on (x, z) if it has drifted past the slack, or always when `force` is set. Returns whether it moved. */
export function followWindow(x: number, z: number, force = false): boolean {
  const [cx, cz] = windowCentre();
  if (!force && Math.abs(x - cx) < SLACK && Math.abs(z - cz) < SLACK) return false;
  const minX = Math.round((x - WINDOW.size / 2) / STEP) * STEP;
  const minZ = Math.round((z - WINDOW.size / 2) / STEP) * STEP;
  const dx = minX - WINDOW.minX;
  const dz = minZ - WINDOW.minZ;
  if (dx === 0 && dz === 0 && !force) return false;
  WINDOW.minX = minX;
  WINDOW.minZ = minZ;
  for (const l of listeners) l(dx, dz);
  return true;
}

export function inWindow(x: number, z: number, margin = 0): boolean {
  return (
    x >= WINDOW.minX + margin &&
    z >= WINDOW.minZ + margin &&
    x <= WINDOW.minX + WINDOW.size - margin &&
    z <= WINDOW.minZ + WINDOW.size - margin
  );
}

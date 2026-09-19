/** A waypoint is rounded by proximity, or by crossing its arrival line within the channel. */
export function roundedWaypoint(
  x: number, z: number,
  fromX: number, fromZ: number,
  toX: number, toZ: number,
  radius: number,
): boolean {
  const dx = x - toX;
  const dz = z - toZ;
  if (Math.hypot(dx, dz) < radius) return true;
  const vx = toX - fromX;
  const vz = toZ - fromZ;
  const length = Math.hypot(vx, vz);
  return length > 0.01 && dx * vx + dz * vz >= 0 && Math.abs(dx * vz - dz * vx) / length < radius * 2;
}

/** Shared by surface lighting and the fog simulation so their morning lane has identical edges. */
export const LANE_GLSL = /* glsl */ `
uniform vec4 uLane;
uniform vec2 uLaneOpen;
/**
 * The lane the morning comes down the hill: 1 in the middle of it, 0 off it, and it opens from its first point
 * toward its last, so whatever comes down it arrives with the light rather than after it.
 */
float laneAt(vec2 xz) {
  if (uLaneOpen.y <= 0.0) return 0.0;
  vec2 ab = uLane.zw - uLane.xy;
  float t = clamp(dot(xz - uLane.xy, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float d = distance(xz, uLane.xy + ab * t);
  return (1.0 - smoothstep(uLaneOpen.x * 0.45, uLaneOpen.x, d)) * (1.0 - smoothstep(uLaneOpen.y - 0.08, uLaneOpen.y + 0.08, t));
}
`;

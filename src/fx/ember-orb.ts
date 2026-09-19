/** Only the warm heart and soft halo; the outer wisps are independent surfaces in ember-veils.ts. */
export const EMBER_ORB_GLSL = /* glsl */ `
vec4 emberOrb(vec2 uv, float seed, vec2 air, float wake, float heat) {
  float pulse = sin(uTime * 1.3 + seed) * 0.7 + sin(uTime * 2.1 + seed) * 0.3;
  vec2 q = uv / (1.0 + pulse * 0.025);
  float r2 = dot(q, q);
  float heart = exp(-r2 * 150.0);
  float warmth = exp(-r2 * 28.0);
  float halo = exp(-r2 * 9.0);
  vec3 colour = mix(vec3(1.0, 0.30, 0.06), vec3(1.0, 0.76, 0.29), heart);
  float alpha = heart * 0.78 + warmth * 0.15 + halo * 0.025;
  return vec4(colour * (1.0 + wake * 0.24 + heat * 0.15), alpha);
}
`;

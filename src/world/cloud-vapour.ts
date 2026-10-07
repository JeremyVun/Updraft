/**
 * The light of thin vapour over the top of the cloud: white from the sky, gold from the low sun across it, and
 * bright against the sun, where the light comes through it. rd is the sightline, thin how little there is of it.
 */
export const VAPOUR_GLSL = /* glsl */ `
vec3 vapourLight(vec3 world, vec3 rd, float thin) {
  vec3 L = normalize(uSunDir);
  float toward = pow(max(dot(rd, L), 0.0), 4.0);
  vec3 col = cloudShade(1.0);
  col += cloudGold() * vec3(0.6, 0.5, 0.33) * (0.7 + 0.3 * thin);
  col += cloudGlow() * vec3(1.0, 0.92, 0.8) * toward * (0.25 + 0.9 * thin);
  return col;
}`;

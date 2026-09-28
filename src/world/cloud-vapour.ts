/**
 * The light of thin vapour over the top of the cloud: lilac from the sky, peach from the low sun across it, and
 * bright against the sun, where the light comes through it. rd is the sightline, thin how little there is of it.
 */
export const VAPOUR_GLSL = /* glsl */ `
vec3 vapourLight(vec3 world, vec3 rd, float thin) {
  vec3 L = normalize(uSunDir);
  float toward = pow(max(dot(rd, L), 0.0), 4.0);
  vec3 col = uSkyAmbient * vec3(1.3, 1.02, 1.22) + uGroundBounce * 0.25;
  col += uSunColor * vec3(0.44, 0.33, 0.3) * (0.7 + 0.3 * thin);
  col += uSunColor * vec3(1.0, 0.88, 0.72) * toward * (0.25 + 0.9 * thin);
  return col;
}`;

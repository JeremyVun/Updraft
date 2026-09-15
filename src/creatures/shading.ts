/** Shared creature GLSL: part rotations, the grass-depth nudge and soft backlit shading. Include after ATMO_GLSL. */
export const CREATURE_GLSL = /* glsl */ `
vec3 rotX(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}
vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
vec3 rotZ(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

/**
 * Moves a vertex toward the camera along its own view ray, so the screen position is unchanged but blades just in
 * front of it stop hiding it. Small creatures in tall grass stay readable from afar and are truly occluded up close.
 */
vec4 nudgedView(vec3 world, float amount) {
  vec4 view = viewMatrix * vec4(world, 1.0);
  float d = length(view.xyz);
  float k = amount * smoothstep(9.0, 34.0, d);
  view.xyz *= 1.0 - min(k, d * 0.4) / d;
  return view;
}

/** Soft painterly light: wrapped sun, sky and bounce ambient, light through thin parts, and a warm rim when backlit. */
vec3 shadeCreature(vec3 alb, vec3 N, vec3 world, float ao, float fuzz, float thin, float air) {
  vec3 V = normalize(cameraPosition - world);
  float sun = mix(groundAt(world.xz).w, 1.0, air) * cloudShadow(world.xz);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 2.0);
  float edge = 1.0 - clamp(dot(N, V), 0.0, 1.0);
  float rim = pow(edge, 2.0);
  vec3 bounce = mix(vec3(0.2, 0.17, 0.07) * (1.0 - air * 0.6), uSkyAmbient * 1.05, N.y * 0.5 + 0.5);
  vec3 col = alb * (bounce * ao + uSunColor * wrap * wrap * sun * 0.8);
  col += alb * uSunColor * sun * (thin * back * 0.9 + fuzz * back * edge * 0.3);
  col += uSunColor * rim * fuzz * (0.1 + 1.1 * back) * smoothstep(-0.5, 0.45, ndl) * sun * (0.3 + 0.7 * alb);
  return col;
}

/** Mirrors the canopy sway in world/tree.ts, so perched birds ride the swaying leaves. Returns the offset. */
vec3 treeSway(vec3 base, vec3 p, float seed) {
  vec2 w = texture(uWindTex, domainUv(base.xz)).xy;
  float k = pow(max(p.y - base.y, 0.0) / 16.0, 1.6);
  vec2 lean = w * 0.09 + vec2(sin(uTime * 0.9 + seed), cos(uTime * 0.7 + seed * 1.3)) * (0.12 + length(w) * 0.03);
  return vec3(lean.x, -dot(lean, lean) * 0.02, lean.y) * k;
}

/** A catchlight that always faces the camera, so small eyes read as alive. */
float catchlight(vec3 N, vec3 world) {
  vec3 V = normalize(cameraPosition - world);
  return pow(max(dot(N, normalize(V + vec3(0.0, 0.7, 0.0) + uSunDir * 0.4)), 0.0), 36.0);
}
`;

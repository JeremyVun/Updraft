import * as THREE from 'three';
import { glsl } from '../tuning';

export const FOG_VIEW = new THREE.Vector2(160, 96);
export const FOG_SPHERE = new THREE.Vector2(32, 16);
export const FOG_GUARD = 1.25;
export const FOG_SIZE = new THREE.Vector2(FOG_VIEW.x, FOG_VIEW.y + FOG_SPHERE.y);
export const FOG_TILES = 8;
export const FOG_SLICES = FOG_TILES * FOG_TILES;
export const FOG_NEAR = 0.25;
export const FOG_FAR = 8192;
export const fogLookupUniforms = {
  uMistLookup: { value: null as THREE.Texture | null },
  uFogLookupView: { value: new THREE.Matrix3() },
  uFogLookupProjection: { value: new THREE.Vector2(1, 1) },
};

export const FOG_LOOKUP_GLSL = /* glsl */ `
uniform sampler2D uMistLookup;
uniform mat3 uFogLookupView;
uniform vec2 uFogLookupProjection;
vec2 fogLookupPixel(vec3 direction) {
  vec3 view = uFogLookupView * direction;
  vec2 uv = view.xy / max(-view.z, 0.00001) * uFogLookupProjection / ${glsl(FOG_GUARD)} * 0.5 + 0.5;
  // A pixel's own sightline lies inside the guard band, so pixel shaders (three's prefix defines gl_FragDepthEXT
  // only there) need no way round it, unless they fog other points (FOG_OFF_SCREEN); vertex shaders keep it.
#if defined(gl_FragDepthEXT) && !defined(FOG_OFF_SCREEN)
  return clamp(uv, 0.0, 1.0) * vec2(${glsl(FOG_VIEW.x - 1)}, ${glsl(FOG_VIEW.y - 1)}) + 0.5;
#else
  if (view.z < 0.0 && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))))
    return uv * vec2(${glsl(FOG_VIEW.x - 1)}, ${glsl(FOG_VIEW.y - 1)}) + 0.5;
  uv = vec2(atan(direction.z, direction.x) / 6.28318530718 + 0.5, asin(clamp(direction.y, -1.0, 1.0)) / 3.14159265359 + 0.5);
  return uv * vec2(${glsl(FOG_SPHERE.x - 1)}, ${glsl(FOG_SPHERE.y - 1)}) + vec2(0.5, ${glsl(FOG_VIEW.y + 0.5)});
#endif
}
vec2 fogLookupUv(vec2 pixel, float slice) {
  vec2 tile = vec2(mod(slice, ${FOG_TILES}.0), floor(slice / ${FOG_TILES}.0));
  return (tile + pixel / vec2(${FOG_SIZE.x}.0, ${FOG_SIZE.y}.0)) / ${FOG_TILES}.0;
}
vec4 sampleFog(sampler2D atlas, vec3 dir, float dist) {
  vec2 uv = fogLookupPixel(dir);
  float layer = clamp(log(max(dist, ${FOG_NEAR}) / ${FOG_NEAR}) / log(${FOG_FAR / FOG_NEAR}.0), 0.0, 1.0) * ${FOG_SLICES - 1}.0;
  float a = floor(layer), b = min(a + 1.0, ${FOG_SLICES - 1}.0);
  float near = ${FOG_NEAR} * pow(${FOG_FAR / FOG_NEAR}.0, a / ${FOG_SLICES - 1}.0);
  float far = ${FOG_NEAR} * pow(${FOG_FAR / FOG_NEAR}.0, b / ${FOG_SLICES - 1}.0);
  vec4 fog = mix(textureLod(atlas, fogLookupUv(uv, a), 0.0), textureLod(atlas, fogLookupUv(uv, b), 0.0), clamp((dist - near) / max(far - near, 0.0001), 0.0, 1.0));
  // Exact opacity preserves the terrain and water's surface-shading early exits.
  return vec4(fog.rgb / max(fog.a, 0.000001), fog.a >= 13.8 ? 1.0 : 1.0 - exp(-fog.a));
}`;

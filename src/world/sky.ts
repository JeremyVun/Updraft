import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';

const VERT = /* glsl */ `
out vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uRainbow;
in vec3 vDir;

vec3 spectrum(float t) {
  return clamp(vec3(1.6 - abs(t - 0.95) * 3.0, 1.4 - abs(t - 0.55) * 3.2, 1.3 - abs(t - 0.12) * 3.4), 0.0, 1.0);
}

/** Light added by a rainbow round the point opposite the sun: the bright primary bow, a faint reversed secondary, and the darker band between. */
vec3 rainbow(vec3 d, vec3 sky) {
  float a = degrees(acos(clamp(dot(d, -uSunDir), -1.0, 1.0)));
  float p = (a - 40.2) / 2.6;
  float primary = smoothstep(0.0, 0.25, p) * smoothstep(1.0, 0.7, p);
  float q = (53.8 - a) / 3.2;
  float secondary = smoothstep(0.0, 0.4, q) * smoothstep(1.0, 0.6, q) * 0.16;
  float inside = smoothstep(40.5, 30.0, a) * smoothstep(0.0, 20.0, a) * 0.05;
  float gap = smoothstep(42.4, 43.4, a) * smoothstep(51.0, 50.0, a) * 0.07;
  float along = atan(d.x + uSunDir.x, d.z + uSunDir.z);
  float patchy = 0.55 + 0.45 * smoothstep(0.3, 0.7, fbm(vec2(along * 2.2, uTime * 0.004)));
  float fade = smoothstep(-0.01, 0.05, d.y) * patchy * uRainbow;
  vec3 light = uSunColor * 0.16;
  return (spectrum(clamp(p, 0.0, 1.0)) * primary + spectrum(clamp(q, 0.0, 1.0)) * secondary) * light * fade * 1.8 + sky * (inside - gap) * fade;
}

float cloudDensity(vec2 p) {
  float n = fbm(p * vec2(0.55, 1.1)) * 0.7 + fbm(p * 2.3 + 7.0) * 0.3;
  return smoothstep(0.52, 0.8, n);
}

void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyColor(d);
  float sd = dot(d, uSunDir);
  col += uSunColor * smoothstep(0.99955, 0.99975, sd) * 14.0;
  if (uRainbow > 0.0) col += rainbow(d, col);

  if (d.y > 0.0) {
    vec2 p = d.xz / (d.y + 0.06) * 1.2 + uCloudShift * 0.003;
    float c = cloudDensity(p);
    vec2 toSun = normalize(uSunDir.xz) * 0.25;
    float thick = cloudDensity(p + toSun);
    float band = smoothstep(0.015, 0.07, d.y) * (1.0 - smoothstep(0.3, 0.6, d.y));
    c *= band;
    float glow = pow(max(sd, 0.0), 5.0);
    vec3 shade = mix(uSkyHorizon * vec3(0.78, 0.76, 0.86), uSkyHorizonSun * 0.9, glow * 0.8);
    vec3 lit = uSkyHorizonSun * 1.15 + uSunColor * 0.35 * glow;
    vec3 cloudCol = mix(lit, shade, smoothstep(0.1, 0.9, thick));
    col = mix(col, cloudCol, c * 0.9);
  }
  if (uNight > 0.0 && d.y > 0.0) {
    vec3 sd3 = d * 260.0;
    vec3 cell = floor(sd3);
    float h = hash12(cell.xy * 1.37 + cell.z * 7.13);
    float star = step(0.9965, h) * smoothstep(0.55, 0.1, length(fract(sd3) - 0.5));
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + h * 4.0) + h * 40.0);
    float band = smoothstep(0.35, 0.0, abs(dot(d, normalize(vec3(0.55, 0.3, -0.78))))) * fbm(d.xz * 9.0 + d.y * 4.0);
    col += (vec3(0.9, 0.93, 1.0) * star * twinkle * 3.5 + vec3(0.45, 0.5, 0.75) * band * 0.18) * uNight * smoothstep(0.0, 0.12, d.y);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...atmo.uniforms, uRainbow: atmo.uniforms.uRainbow },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.layers.enable(REFLECTION_LAYER);
  return mesh;
}

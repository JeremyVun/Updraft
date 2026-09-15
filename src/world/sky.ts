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
in vec3 vDir;

float cloudDensity(vec2 p) {
  float n = fbm(p * vec2(0.55, 1.1)) * 0.7 + fbm(p * 2.3 + 7.0) * 0.3;
  return smoothstep(0.52, 0.8, n);
}

void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyColor(d);
  float sd = dot(d, uSunDir);
  col += uSunColor * smoothstep(0.99955, 0.99975, sd) * 14.0;

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
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...atmo.uniforms },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.layers.enable(REFLECTION_LAYER);
  return mesh;
}

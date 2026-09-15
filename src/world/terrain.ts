import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { GRASS_LINE, makeTerrainGeometry } from './island';

const VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uSand;
uniform vec3 uWetSand;
uniform vec3 uGround;
uniform vec3 uRock;
in vec3 vWorld;
in vec3 vNormal;

void main() {
  vec3 n = normalize(vNormal);
  float h = vWorld.y;
  float grain = vnoise(vWorld.xz * 1.7) * 0.5 + vnoise(vWorld.xz * 6.0) * 0.5;
  float ripples = sin(dot(vWorld.xz, vec2(0.9, 0.45)) * 2.2 + vnoise(vWorld.xz * 0.3) * 6.0) * 0.5 + 0.5;
  vec3 sand = uSand * (0.9 + 0.12 * grain) * (0.96 + 0.06 * ripples);
  float grassMask = smoothstep(${GRASS_LINE.toFixed(2)} + 0.1, ${GRASS_LINE.toFixed(2)} + 1.4, h + (grain - 0.5) * 0.5);
  vec3 alb = mix(sand, uGround * (0.85 + 0.3 * grain), grassMask);
  float wet = smoothstep(0.45, 0.05, h) * (1.0 - grassMask);
  alb = mix(alb, uWetSand, wet * 0.8);
  float slope = 1.0 - n.y;
  alb = mix(alb, uRock * (0.8 + 0.4 * grain), smoothstep(0.42, 0.6, slope));

  float ndl = max(dot(n, uSunDir), 0.0);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(n) + uSunColor * ndl * sun);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createTerrain(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...atmo.uniforms,
      uSand: { value: new THREE.Color('#e6d2a6') },
      uWetSand: { value: new THREE.Color('#a48c66') },
      uGround: { value: new THREE.Color('#2e3f22') },
      uRock: { value: new THREE.Color('#857a6c') },
    },
  });
  return new THREE.Mesh(makeTerrainGeometry(), mat);
}

import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';

const VERT = /* glsl */ `
uniform float uCurl;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vUv = uv;
  float bend = (uv.x - 0.5) * (uv.x - 0.5) * uCurl;
  vec3 p = position + vec3(0.0, 0.0, bend);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * vec3(-(uv.x - 0.5) * uCurl * 1.6, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/**
 * A child's crayon drawing on ruled notebook paper: the sun, two green hills, a stone wall, a white cottage with a
 * red door and a lit window, a little yellow figure with a red scarf, and a paper plane in the sky. Crayon strokes
 * are scribbled fills with waxy gaps.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;

float scribble(vec2 uv, float angle, float freq, float cover) {
  vec2 d = vec2(cos(angle), sin(angle));
  float wobble = vnoise(uv * 14.0) * 2.4 + vnoise(uv * 40.0) * 0.8;
  float s = sin(dot(uv, d) * freq + wobble) * 0.5 + 0.5;
  float wax = smoothstep(0.35, 0.75, vnoise(uv * vec2(90.0, 60.0)));
  return smoothstep(1.0 - cover, 1.0 - cover + 0.18, s) * mix(0.55, 1.0, wax);
}

float stroke(float d, float width) {
  return 1.0 - smoothstep(width * 0.6, width, abs(d));
}

vec3 layer(vec3 base, vec3 crayon, float amount) {
  return mix(base, crayon, clamp(amount, 0.0, 1.0));
}

void main() {
  vec2 uv = vUv;
  vec2 jitter = vec2(vnoise(uv * 23.0), vnoise(uv * 23.0 + 7.0)) * 0.006;
  vec2 p = uv + jitter;
  vec3 paper = vec3(0.96, 0.93, 0.86) * (0.97 + 0.03 * vnoise(uv * 120.0));
  paper = mix(paper, vec3(0.62, 0.74, 0.92), (1.0 - smoothstep(0.0, 0.006, abs(fract(uv.y * 11.0) - 0.5) - 0.47)) * 0.35);
  paper = mix(paper, vec3(0.9, 0.45, 0.45), (1.0 - smoothstep(0.0, 0.004, abs(uv.x - 0.09))) * 0.45);
  vec3 col = paper;

  float back = 0.56 + 0.07 * sin(p.x * 5.2 + 0.6) + 0.03 * sin(p.x * 13.0);
  float front = 0.36 + 0.09 * sin(p.x * 3.4 + 2.1) + 0.02 * sin(p.x * 11.0);
  float sky = step(back, p.y);
  col = layer(col, vec3(0.5, 0.72, 0.93), sky * scribble(p, 0.35, 260.0, 0.42));

  vec2 sunC = vec2(0.2, 0.8);
  float sunD = length((p - sunC) * vec2(1.3, 1.0));
  col = layer(col, vec3(0.98, 0.72, 0.18), (1.0 - smoothstep(0.075, 0.085, sunD)) * scribble(p, 1.2, 320.0, 0.75));
  float rays = step(0.1, sunD) * step(sunD, 0.16) * step(0.72, sin(atan(p.y - sunC.y, (p.x - sunC.x) * 1.3) * 11.0) * 0.5 + 0.5);
  col = layer(col, vec3(0.97, 0.62, 0.15), rays * 0.9);

  float backHill = step(p.y, back) * step(front, p.y);
  col = layer(col, vec3(0.5, 0.74, 0.3), backHill * scribble(p, -0.4, 240.0, 0.6));
  col = layer(col, vec3(0.28, 0.5, 0.18), stroke(p.y - back, 0.006));
  float frontHill = step(p.y, front);
  col = layer(col, vec3(0.2, 0.52, 0.22), frontHill * scribble(p, 0.9, 230.0, 0.66));

  float wallY = 0.24 + 0.05 * sin(p.x * 6.5 + 0.4);
  float dash = step(0.35, fract(p.x * 42.0));
  col = layer(col, vec3(0.45, 0.45, 0.46), stroke(p.y - wallY, 0.012) * dash);

  vec2 h = p - vec2(0.68, 0.5);
  float walls = step(abs(h.x), 0.07) * step(-0.045, h.y) * step(h.y, 0.02);
  col = layer(col, vec3(0.97, 0.96, 0.92), walls);
  col = layer(col, vec3(0.3, 0.28, 0.27), walls * (1.0 - step(abs(h.x), 0.064) * step(-0.039, h.y) * step(h.y, 0.014)));
  float roof = step(0.02, h.y) * step(h.y, 0.02 + (0.085 - abs(h.x)) * 0.8) * step(abs(h.x), 0.085);
  col = layer(col, vec3(0.68, 0.48, 0.2), roof * scribble(p, 2.2, 400.0, 0.8));
  col = layer(col, vec3(0.8, 0.2, 0.16), step(abs(h.x - 0.005), 0.012) * step(-0.045, h.y) * step(h.y, -0.012));
  col = layer(col, vec3(0.98, 0.82, 0.3), step(abs(h.x + 0.04), 0.011) * step(abs(h.y + 0.012), 0.009));
  col = layer(col, vec3(0.98, 0.82, 0.3), step(abs(h.x - 0.045), 0.011) * step(abs(h.y + 0.012), 0.009));
  vec2 smoke = p - vec2(0.735, 0.575);
  col = layer(col, vec3(0.6, 0.6, 0.62), stroke(length(smoke * vec2(1.0, 1.4)) - 0.018 - 0.01 * sin(atan(smoke.y, smoke.x) * 3.0), 0.005) * step(0.0, smoke.y));

  vec2 k = p - vec2(0.38, 0.29);
  float body = step(abs(k.x), 0.025 - k.y * 0.3) * step(-0.05, k.y) * step(k.y, 0.0);
  col = layer(col, vec3(0.93, 0.68, 0.16), body * scribble(p, 1.6, 500.0, 0.85));
  col = layer(col, vec3(0.97, 0.8, 0.66), 1.0 - smoothstep(0.013, 0.016, length(k - vec2(0.0, 0.018))));
  col = layer(col, vec3(0.85, 0.2, 0.16), stroke(k.y - 0.002 + (k.x - 0.02) * 0.3, 0.005) * step(-0.02, k.x) * step(k.x, 0.05));
  col = layer(col, vec3(0.2, 0.15, 0.12), (1.0 - smoothstep(0.002, 0.003, length(k - vec2(-0.005, 0.02)))) + (1.0 - smoothstep(0.002, 0.003, length(k - vec2(0.006, 0.02)))));

  vec2 pl = p - vec2(0.5, 0.78);
  float plane = step(abs(pl.y), 0.02 - abs(pl.x) * 0.35) * step(abs(pl.x), 0.05);
  col = layer(col, vec3(0.35, 0.35, 0.4), stroke(abs(pl.y) - (0.02 - abs(pl.x) * 0.35), 0.004) * step(abs(pl.x), 0.05));
  col = layer(col, vec3(0.99, 0.99, 0.97), plane * 0.6);
  col = layer(col, vec3(0.45, 0.45, 0.5), stroke(pl.y + 0.03 + 0.012 * sin(pl.x * 60.0), 0.003) * step(0.05, -pl.x) * step(-pl.x, 0.2) * step(0.5, fract(pl.x * 30.0)));

  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float through = max(-ndl, 0.0) * 0.55;
  vec3 lit = col * (hemiLight(N) * 1.1 + uSunColor * (max(ndl, 0.0) * 0.7 + through) * 0.8);
  if (!gl_FrontFacing) lit = paper * (hemiLight(N) + uSunColor * (max(-dot(N, uSunDir), 0.0) * 0.7 + max(dot(N, uSunDir), 0.0) * 0.5) * 0.8);
  gl_FragColor = vec4(applyFog(lit, vWorld), 1.0);
}`;

/** The unfolded paper plane. */
export class Drawing {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  /** 0 folded away, 1 fully open. */
  open = 0;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uCurl: { value: 0.18 } },
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2, 12, 1), this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }

  /** Holds the sheet at `at`, facing `toward`, open by `this.open`. */
  place(at: THREE.Vector3, toward: THREE.Vector3, time: number): void {
    this.mesh.visible = this.open > 0.01;
    this.mesh.position.copy(at);
    this.mesh.lookAt(toward);
    const k = this.open;
    this.mesh.scale.set(Math.max(0.05, k), Math.max(0.05, k * k), 1);
    this.material.uniforms.uCurl.value = 0.14 + Math.sin(time * 2.1) * 0.03 + (1 - k) * 0.6;
  }
}

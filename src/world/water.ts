import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { mulberry32 } from './noise';

const VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSeabed;
uniform vec3 uFoam;
in vec3 vWorld;

vec2 swellGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  const int N = 5;
  vec2 dirs[N] = vec2[](vec2(0.94, 0.34), vec2(0.62, 0.78), vec2(0.99, -0.12), vec2(0.35, 0.94), vec2(0.8, -0.6));
  float freqs[N] = float[](0.21, 0.34, 0.52, 0.77, 1.13);
  float amps[N] = float[](0.09, 0.06, 0.045, 0.03, 0.02);
  for (int i = 0; i < N; i++) {
    float ph = dot(dirs[i], p) * freqs[i] - t * sqrt(9.8 * freqs[i]) * 0.55;
    g += dirs[i] * amps[i] * freqs[i] * cos(ph) * 3.0;
  }
  return g;
}

uniform sampler2D uRipple;

vec2 rippleGrad(vec2 p, float t, vec2 flow) {
  vec2 a = texture(uRipple, p * 0.043 - flow * t * 0.004 + vec2(t * 0.011, 0.0)).rg * 2.0 - 1.0;
  vec2 b = texture(uRipple, p * 0.117 - flow * t * 0.009 - vec2(0.0, t * 0.019)).rg * 2.0 - 1.0;
  return a * 1.1 + b * 0.8;
}

void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 xz = vWorld.xz;
  vec2 uv = domainUv(xz);
  bool inDomain = all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)));

  vec4 wind = texture(uWindTex, clamp(uv, 0.0, 1.0));
  float windSp = length(wind.xy);
  float gustRough = smoothstep(3.0, 14.0, windSp);
  float near = exp(-dist * 0.0032);

  float swellVar = 0.45 + 0.9 * vnoise(xz * 0.013 + vec2(uTime * 0.03, 0.0));
  vec2 g = swellGrad(xz, uTime) * mix(0.35, 1.0, near) * swellVar;
  g += rippleGrad(xz, uTime, wind.xy) * (0.06 + 0.2 * gustRough) * mix(0.35, 1.0, near);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

  float ground = inDomain ? texture(uHeightTex, uv).r : -12.0;
  float depth = max(-ground, 0.0);

  float sh = cloudShadow(xz) * groundAt(xz).w;
  vec3 light = hemiLight(vec3(0.0, 1.0, 0.0)) * 0.8 + uSunColor * max(uSunDir.y, 0.0) * 0.9 * sh;
  vec3 body = mix(uShallow, uDeep, 1.0 - exp(-depth * 0.32));
  body = mix(uSeabed, body, smoothstep(0.0, 1.6, depth) * 0.75 + 0.25);
  body *= light;
  body *= 1.0 - gustRough * 0.18;

  float cosV = max(dot(N, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
  vec3 R = reflect(-V, N);
  vec3 refl = skyColor(normalize(vec3(R.x, max(abs(R.y), mix(0.16, 0.0, near)), R.z)));

  float sharp = mix(160.0, 2200.0, near);
  float spec = pow(max(dot(R, uSunDir), 0.0), sharp) * mix(2.5, 14.0, near);
  spec += pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.25;

  vec3 col = mix(body, refl, F) + uSunColor * spec * sh;

  float shoreBand = smoothstep(1.4, 0.0, depth) * (inDomain ? 1.0 : 0.0);
  float waves = sin(depth * 5.0 - uTime * 1.6 + vnoise(xz * 0.35) * 5.0) * 0.5 + 0.5;
  float foam = shoreBand * smoothstep(0.55, 0.95, waves * (0.6 + 0.6 * vnoise(xz * 2.2 + uTime * 0.2)));
  foam = max(foam, smoothstep(0.28, 0.0, depth) * (inDomain ? 0.85 : 0.0) * (0.6 + 0.4 * vnoise(xz * 3.0 - uTime * 0.5)));
  col = mix(col, uFoam * light, clamp(foam, 0.0, 1.0));

  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Tiling ripple slopes from a sum of waves with whole-number wave counts, so the texture wraps seamlessly. */
function rippleTexture(res = 256): THREE.DataTexture {
  const rand = mulberry32(3);
  const waves: [number, number, number, number][] = [];
  while (waves.length < 56) {
    const kx = Math.round((rand() * 2 - 1) * 26);
    const ky = Math.round((rand() * 2 - 1) * 26);
    const k = Math.hypot(kx, ky);
    if (k < 3) continue;
    waves.push([kx, ky, 1 / Math.pow(k, 1.25), rand() * Math.PI * 2]);
  }
  const gx = new Float32Array(res * res);
  const gy = new Float32Array(res * res);
  let max = 0;
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const u = i / res;
      const v = j / res;
      let dx = 0;
      let dy = 0;
      for (const [kx, ky, a, ph] of waves) {
        const c = Math.cos(2 * Math.PI * (kx * u + ky * v) + ph) * a;
        dx += c * kx;
        dy += c * ky;
      }
      gx[j * res + i] = dx;
      gy[j * res + i] = dy;
      max = Math.max(max, Math.abs(dx), Math.abs(dy));
    }
  }
  const data = new Uint8Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    data[i * 4] = Math.round((gx[i] / max) * 127.5 + 127.5);
    data[i * 4 + 1] = Math.round((gy[i] / max) * 127.5 + 127.5);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function createWater(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ...atmo.uniforms,
      uRipple: { value: rippleTexture() },
      uDeep: { value: new THREE.Color('#0c4262') },
      uShallow: { value: new THREE.Color('#33aca6') },
      uSeabed: { value: new THREE.Color('#d8c9a0') },
      uFoam: { value: new THREE.Color('#f4efe4') },
    },
  });
  const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

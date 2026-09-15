import * as THREE from 'three';
import { params } from '../params';
import { ATMO_GLSL, atmo } from './atmosphere';
import { GRASS_LINE, heightAt, slopeAt } from './island';
import { openGround } from './landmarks';
import { createNoise2D, fbm, mulberry32, smoothstep } from './noise';

const SEGMENTS = 6;

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec4 aRoot;
in vec4 aShape;
in vec4 aTint;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSideDir;
out vec3 vGroundN;
out vec3 vTint;
out vec4 vFog;
out float vT;
out float vBend;
out float vFringe;
out float vSun;

void main() {
  float side = position.x;
  float t = position.y;
  float seed = aRoot.w;
  float h = aShape.x;
  vec2 uv = domainUv(aRoot.xz);
  vec4 ground = groundAt(aRoot.xz);
  vec4 bend = texture(uBendTex, uv);
  vec4 wind = texture(uWindTex, uv);
  float sp = length(wind.xy);

  vec2 facing = vec2(cos(aShape.z), sin(aShape.z));
  float ph = seed * 43.1;
  float flutterAmp = (0.04 + 0.012 * sp) * (0.6 + 0.4 * t);
  vec2 flutter = vec2(sin(uTime * (2.7 + seed * 2.1) + ph), sin(uTime * (2.1 + seed * 1.6) + ph * 1.7)) * flutterAmp;
  vec2 wb = bend.xy + flutter;
  float wa = length(wb);
  vec2 wdir = wa > 1e-4 ? wb / wa : facing;
  vec2 align = dot(facing, wdir) >= 0.0 ? wdir : -wdir;
  facing = normalize(mix(facing, align, smoothstep(0.2, 1.0, wa) * 0.75));

  vec2 lean = wb + facing * aShape.w;
  float ll = length(lean);
  float A = clamp(ll, 1e-3, 1.5);
  vec2 dir = ll > 1e-4 ? lean / ll : facing;
  float s = t * A;
  float horiz = h * (1.0 - cos(s)) / A;
  float vert = h * sin(s) / A;
  vec3 spine = vec3(dir.x * horiz, vert, dir.y * horiz);
  vec3 tangent = vec3(dir.x * sin(s), cos(s), dir.y * sin(s));
  vec3 sideDir = vec3(-facing.y, 0.0, facing.x);
  float width = aShape.y * (1.0 - smoothstep(0.3, 1.0, t) * 0.85);
  vec3 world = aRoot.xyz + spine + sideDir * side * width * 0.5;

  vec3 nrm = cross(sideDir, tangent);
  vNormal = length(nrm) > 1e-4 ? normalize(nrm) : vec3(0.0, 1.0, 0.0);
  vSideDir = sideDir * side;
  vGroundN = ground.xyz;
  vTint = aTint.rgb;
  vFringe = aTint.a;
  vSun = mix(ground.w, 1.0, t * t * 0.3) * cloudShadow(aRoot.xz);
  vFog = fogOf(world);
  vWorld = world;
  vT = t;
  vBend = wa;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundBounce;
uniform vec3 uRoot;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vSideDir;
in vec3 vGroundN;
in vec3 vTint;
in vec4 vFog;
in float vT;
in float vBend;
in float vFringe;
in float vSun;

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0) N = -N;
  N = normalize(N + vSideDir * 0.35 + vec3(0.0, 1e-3, 0.0));
  N = normalize(mix(N, vGroundN, 0.5) + vec3(0.0, 1e-3, 0.0));

  vec3 root = mix(vTint * 0.55, uRoot, vFringe);
  vec3 alb = mix(root, vTint, smoothstep(0.0, 0.95, vT));
  float flattened = smoothstep(0.3, 1.0, vBend) * vT;
  alb = mix(alb, alb * 1.45 + vec3(0.05, 0.06, 0.035), flattened);

  float ao = mix(mix(0.7, 0.22, vFringe), 1.0, smoothstep(0.0, 0.8, vT));
  float diff = clamp(dot(N, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 4.0);
  vec3 trans = uSunColor * vTint * back * vT * vT * 0.9;
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 24.0) * (0.16 + 0.5 * flattened) * vT;
  vec3 ambient = mix(uGroundBounce, uSkyAmbient, N.y * 0.5 + 0.5);

  vec3 col = alb * ambient * ao + (alb * uSunColor * diff * ao + trans + uSunColor * spec) * vSun;
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), 1.0);
}`;

function bladeTemplate(): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / SEGMENTS;
    pos.push(-1, t, 0, 1, t, 0);
  }
  pos.push(0, 1, 0);
  const index: number[] = [];
  for (let i = 0; i < SEGMENTS - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (SEGMENTS - 1) * 2;
  index.push(last, last + 1, last + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

export interface GrassField {
  mesh: THREE.Mesh;
  count: number;
}

const TIP_LUSH = new THREE.Color('#7d9a3c');
const TIP_DRY = new THREE.Color('#c4a152');
const TIP_COOL = new THREE.Color('#4a8660');

export function createGrass(): GrassField {
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const density = 17 * (params.grass ?? (touch ? 0.55 : 1));
  const cell = 1 / Math.sqrt(density);
  const rand = mulberry32(42);
  const lushNoise = createNoise2D(5);
  const patchNoise = createNoise2D(11);
  const dryNoise = createNoise2D(23);
  const coolNoise = createNoise2D(29);
  const tuftNoise = createNoise2D(37);
  const roots: number[] = [];
  const shapes: number[] = [];
  const tints: number[] = [];
  const tip = new THREE.Color();

  for (let z = -100; z < 80; z += cell) {
    for (let x = -95; x < 90; x += cell) {
      const px = x + (rand() - 0.5) * cell * 1.6;
      const pz = z + (rand() - 0.5) * cell * 1.6;
      const h = heightAt(px, pz);
      if (h < GRASS_LINE - 0.6) continue;
      const edge = smoothstep(GRASS_LINE - 0.6, GRASS_LINE + 1.2, h);
      const tufts = smoothstep(0.1, 0.45, tuftNoise(px * 0.35, pz * 0.35));
      const slope = slopeAt(px, pz);
      const keep = (edge > 0.85 ? 1 : edge ** 2 * tufts) * (1 - smoothstep(1.2, 1.6, slope)) * openGround(px, pz);
      if (rand() > keep) continue;
      const lush = fbm(lushNoise, px * 0.035, pz * 0.035, 3) * 0.5 + 0.5;
      const short = smoothstep(0.48, 0.66, fbm(patchNoise, px * 0.05, pz * 0.05, 2) * 0.5 + 0.5);
      const fringe = smoothstep(GRASS_LINE - 0.6, GRASS_LINE + 2.2, h);
      const height = (1.1 + 1.5 * lush + 0.55 * rand()) * (0.2 + 0.8 * fringe * fringe) * (1 - short * 0.5);
      const width = 0.15 + 0.1 * rand();
      const seed = rand();
      roots.push(px, h - 0.12, pz, seed);
      shapes.push(height, width, rand() * Math.PI * 2, 0.12 + 0.28 * rand());

      const dry = smoothstep(0.52, 0.72, fbm(dryNoise, px * 0.022, pz * 0.022, 3) * 0.5 + 0.5);
      const cool = smoothstep(0.56, 0.76, fbm(coolNoise, px * 0.04, pz * 0.04, 2) * 0.5 + 0.5) * (1 - dry);
      tip.copy(TIP_LUSH).lerp(TIP_DRY, dry * 0.85).lerp(TIP_COOL, cool * 0.45).multiplyScalar(0.8 + 0.4 * rand());
      tints.push(tip.r, tip.g, tip.b, smoothstep(GRASS_LINE - 0.5, GRASS_LINE + 1.4, h));
    }
  }

  const count = roots.length / 4;
  const template = bladeTemplate();
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = template.index;
  geo.setAttribute('position', template.attributes.position);
  geo.setAttribute('aRoot', new THREE.InstancedBufferAttribute(new Float32Array(roots), 4));
  geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(shapes), 4));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tints), 4));
  geo.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...atmo.uniforms, uRoot: { value: new THREE.Color('#15291d') } },
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, count };
}

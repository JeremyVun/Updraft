import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { TREE } from './landmarks';
import { createNoise2D, mulberry32 } from './noise';
import { REFLECTION_LAYER } from './water/reflection';

interface Limb {
  curve: THREE.QuadraticBezierCurve3;
  r0: number;
  r1: number;
}

export interface Canopy {
  centre: THREE.Vector3;
  radius: number;
}

/** Bends everything above the base with the wind at the tree, more toward the top. */
const SWAY_GLSL = /* glsl */ `
uniform vec3 uBase;
vec3 sway(vec3 p, float seed) {
  vec2 w = texture(uWindTex, domainUv(uBase.xz)).xy;
  float h = max(p.y - uBase.y, 0.0);
  float k = pow(h / 16.0, 1.6);
  vec2 lean = w * 0.09 + vec2(sin(uTime * 0.9 + seed), cos(uTime * 0.7 + seed * 1.3)) * (0.12 + length(w) * 0.03);
  return p + vec3(lean.x, -dot(lean, lean) * 0.02, lean.y) * k;
}
`;

const BARK_VERT = /* glsl */ `
${ATMO_GLSL}
${SWAY_GLSL}
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec3 p = sway(position, 0.0);
  vWorld = p;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const BARK_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
uniform vec3 uBase;
void main() {
  vec3 n = normalize(vNormal);
  float around = atan(n.z, n.x);
  float fissures = smoothstep(0.35, 0.75, vnoise(vec2(around * 5.0, vWorld.y * 0.6)) * 0.7 + vnoise(vec2(around * 14.0, vWorld.y * 2.5)) * 0.3);
  vec3 alb = mix(vec3(0.05, 0.035, 0.028), vec3(0.17, 0.13, 0.1), fissures);
  float ndl = max(dot(n, uSunDir), 0.0);
  float sun = cloudShadow(vWorld.xz);
  float canopyShade = smoothstep(uBase.y + 3.0, uBase.y + 9.0, vWorld.y) * 0.6 + 0.4;
  float ao = smoothstep(uBase.y - 0.8, uBase.y + 2.0, vWorld.y) * 0.6 + 0.4;
  vec3 V = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 6.0) * max(dot(-V, uSunDir), 0.0);
  vec3 col = alb * (hemiLight(n) * 0.8 * ao + uSunColor * ndl * sun * canopyShade) + uSunColor * rim * 0.06 * sun;
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

const LEAF_VERT = /* glsl */ `
${ATMO_GLSL}
${SWAY_GLSL}
uniform vec3 uCrown;
in vec4 aLeaf;
in vec4 aShade;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;
out float vDepth;
out float vSeed;
void main() {
  float seed = aLeaf.w;
  vec2 w = texture(uWindTex, domainUv(uBase.xz)).xy;
  float flutter = sin(uTime * (7.0 + seed * 5.0) + seed * 40.0) * (0.08 + length(w) * 0.02);
  vec3 centre = sway(aLeaf.xyz, aShade.w * 6.0);
  float roll = seed * 6.2831 + flutter * 3.0;
  vec2 c = vec2(cos(roll), sin(roll));
  vec2 corner = vec2(position.x * c.x - position.y * c.y, position.x * c.y + position.y * c.x);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float size = 0.7 + fract(seed * 7.1) * 0.45;
  vec3 world = centre + (right * corner.x + up * corner.y) * size;
  vUv = position.xy;
  vWorld = world;
  vNormal = aShade.xyz;
  vDepth = clamp(length(aLeaf.xyz - uCrown) / 11.0, 0.0, 1.0);
  vSeed = seed;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const LEAF_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;
in float vDepth;
in float vSeed;
void main() {
  vec2 p = vUv;
  float leaf = length(vec2(p.x * 1.7, p.y + p.x * p.x * 0.35));
  if (leaf > 1.0) discard;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
  vec3 deep = vec3(0.03, 0.06, 0.045);
  vec3 lit = mix(vec3(0.17, 0.27, 0.07), vec3(0.3, 0.33, 0.08), fract(vSeed * 3.3));
  vec3 alb = mix(deep, lit, smoothstep(0.3, 1.0, vDepth) * (0.55 + 0.45 * wrap));
  float back = pow(max(dot(-V, uSunDir), 0.0), 3.0) * smoothstep(0.5, 1.0, vDepth);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = alb * hemiLight(N) * mix(0.35, 1.0, vDepth) + alb * uSunColor * pow(wrap, 2.5) * sun * 1.3;
  col += vec3(0.45, 0.55, 0.1) * uSunColor * back * sun * 0.3;
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

function tube(limb: Limb, radial = 8, segments = 10): THREE.BufferGeometry {
  const frames = limb.curve.computeFrenetFrames(segments, false);
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    limb.curve.getPointAt(t, p);
    const flare = 1 + Math.max(0, 0.25 - t) * 3.2;
    const r = THREE.MathUtils.lerp(limb.r0, limb.r1, Math.pow(t, 0.8)) * flare;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nrm.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  return geo;
}

function limbTo(start: THREE.Vector3, dir: THREE.Vector3, length: number, droop: number, r0: number, r1: number): Limb {
  const end = start.clone().addScaledVector(dir, length);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += length * droop;
  return { curve: new THREE.QuadraticBezierCurve3(start.clone(), mid, end), r0, r1 };
}

function grow(base: THREE.Vector3): { limbs: Limb[]; canopy: Canopy[] } {
  const rand = mulberry32(99);
  const limbs: Limb[] = [];
  const canopy: Canopy[] = [];
  const top = base.clone().add(new THREE.Vector3(1.4, 8.2, 0.6));
  const trunk: Limb = {
    curve: new THREE.QuadraticBezierCurve3(base.clone().add(new THREE.Vector3(0, -0.8, 0)), base.clone().add(new THREE.Vector3(-0.4, 4.5, -0.3)), top),
    r0: 1.25,
    r1: 0.55,
  };
  limbs.push(trunk);
  const mains = 6;
  for (let i = 0; i < mains; i++) {
    const a = (i / mains) * Math.PI * 2 + rand() * 0.6;
    const t = 0.62 + rand() * 0.34;
    const start = trunk.curve.getPointAt(t);
    const spread = 0.75 + rand() * 0.25;
    const dir = new THREE.Vector3(Math.cos(a) * spread, 0.5 + rand() * 0.45, Math.sin(a) * spread).normalize();
    const len = 5.5 + rand() * 3;
    const main = limbTo(start, dir, len, 0.12, 0.5, 0.16);
    limbs.push(main);
    canopy.push({ centre: main.curve.getPointAt(1).add(new THREE.Vector3(0, 1.2, 0)), radius: 3.4 + rand() * 1.0 });
    for (let k = 0; k < 2; k++) {
      const s = main.curve.getPointAt(0.45 + rand() * 0.4);
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(k === 0 ? 1 : -1);
      const sd = dir.clone().multiplyScalar(0.6).addScaledVector(side, 0.6).add(new THREE.Vector3(0, 0.5, 0)).normalize();
      const sub = limbTo(s, sd, 2.5 + rand() * 2, 0.1, 0.17, 0.06);
      limbs.push(sub);
      canopy.push({ centre: sub.curve.getPointAt(1).add(new THREE.Vector3(0, 0.8, 0)), radius: 2.5 + rand() * 0.9 });
    }
  }
  canopy.push({ centre: top.clone().add(new THREE.Vector3(0, 3.2, 0)), radius: 4.4 });
  canopy.push({ centre: top.clone().add(new THREE.Vector3(-1.5, 1.5, 1.5)), radius: 3.8 });
  return { limbs, canopy };
}

export interface Tree {
  group: THREE.Group;
  canopy: Canopy[];
}

export function createTree(): Tree {
  const base = new THREE.Vector3(TREE.x, heightAt(TREE.x, TREE.z), TREE.z);
  const { limbs, canopy } = grow(base);
  const crown = canopy.reduce((acc, c) => acc.add(c.centre), new THREE.Vector3()).divideScalar(canopy.length);
  const shared = { ...atmo.uniforms, uBase: { value: base }, uCrown: { value: crown } };

  const barkGeo = limbs.map((l, i) => tube(l, i === 0 ? 12 : 7, i === 0 ? 14 : 8));
  const bark = new THREE.Mesh(
    mergeGeometries(barkGeo),
    new THREE.ShaderMaterial({ vertexShader: BARK_VERT, fragmentShader: BARK_FRAG, uniforms: shared }),
  );
  bark.frustumCulled = false;

  const rand = mulberry32(7);
  const leaves: number[] = [];
  const shades: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const lumps = createNoise2D(17);
  for (const [ci, c] of canopy.entries()) {
    const count = Math.round(c.radius * c.radius * 40);
    for (let i = 0; i < count; i++) {
      n.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
      if (n.lengthSq() > 1 || n.lengthSq() < 1e-4) {
        i--;
        continue;
      }
      n.normalize();
      const lump = 0.75 + 0.35 * lumps(n.x * 1.6 + ci * 3.1, n.z * 1.6 + n.y * 1.3);
      const r = c.radius * lump * (0.5 + 0.5 * Math.sqrt(rand()));
      p.copy(c.centre).addScaledVector(n, r);
      if (p.y < c.centre.y - c.radius * 0.55) p.y = c.centre.y - c.radius * 0.55 + rand() * 0.4;
      outward.subVectors(p, crown).normalize();
      n.lerp(outward, 0.55).normalize();
      leaves.push(p.x, p.y, p.z, rand());
      shades.push(n.x, n.y, n.z, ci / canopy.length);
    }
  }
  const quad = new THREE.PlaneGeometry(2, 2);
  const leafGeo = new THREE.InstancedBufferGeometry();
  leafGeo.index = quad.index;
  leafGeo.setAttribute('position', quad.attributes.position);
  leafGeo.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(new Float32Array(leaves), 4));
  leafGeo.setAttribute('aShade', new THREE.InstancedBufferAttribute(new Float32Array(shades), 4));
  leafGeo.instanceCount = leaves.length / 4;
  const leafMat = new THREE.ShaderMaterial({
    vertexShader: LEAF_VERT,
    fragmentShader: LEAF_FRAG,
    uniforms: shared,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
  });
  const foliage = new THREE.Mesh(leafGeo, leafMat);
  foliage.frustumCulled = false;

  const group = new THREE.Group();
  group.add(bark, foliage);
  group.traverse((o) => o.layers.enable(REFLECTION_LAYER));
  return { group, canopy };
}

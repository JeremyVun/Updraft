import * as THREE from 'three';
import { GpuRunner, PingPong, simMaterial } from '../gl/gpu';
import { ATMO_GLSL, NOISE_GLSL, atmo } from '../world/atmosphere';
import { GRASS_LINE, heightAt } from '../world/island';
import { FLOWER_PATCHES, type FlowerPatch } from '../world/landmarks';
import { mulberry32 } from '../world/noise';

const W = 128;
const H = 64;
const COUNT = W * H;

/** Petals rest among the grass, lift when a gust or updraft passes, and drift down again. */
const VEL_FRAG = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uWindTex;
uniform sampler2D uHeightTex;
uniform vec4 uDomain;
uniform float uDt;
uniform float uTime;
uniform vec4 uUpdraft;
in vec2 vUv;
${NOISE_GLSL}

void main() {
  vec4 p = texture(uPos, vUv);
  vec4 v = texture(uVel, vUv);
  float seed = v.w;
  vec2 uv = (p.xz - uDomain.xy) * uDomain.zw;
  vec4 w = texture(uWindTex, uv);
  float ground = texture(uHeightTex, uv).r;
  bool sea = ground < 0.0;
  float above = p.y - max(ground, 0.0);
  float sp = length(w.xy);

  float lift = w.z * (3.5 + 4.0 * seed) + smoothstep(9.0, 20.0, sp) * 2.5 + w.w * (3.0 + 2.0 * seed);
  float resting = step(above, 0.35);
  bool grabbed = resting < 0.5 || lift > 0.8 + seed * 0.8 || (sea && above < 0.2);

  vec2 turb = vec2(vnoise(p.xz * 0.35 + uTime * 0.8 + seed * 17.0), vnoise(p.zx * 0.35 - uTime * 0.7 + seed * 29.0)) - 0.5;
  vec2 hTarget = w.xy * (sea && above < 0.2 ? 0.25 : 0.95) + turb * (2.5 + sp * 0.35);
  float vyTarget = lift * (0.7 + 0.6 * fract(seed * 13.7)) - (0.45 + 0.4 * seed) + turb.x * 1.6;
  vec3 target = vec3(hTarget.x, vyTarget, hTarget.y);

  // The updraft is a funnel: petals are drawn in along the ground, spiral up a cone that widens with height, and spill out at the top.
  vec2 rel = p.xz - uUpdraft.xy;
  float dist = length(rel);
  float influence = uUpdraft.z * (1.0 - smoothstep(uUpdraft.w * 1.1, uUpdraft.w * 2.6, dist));
  if (influence > 0.001) {
    vec2 radial = rel / max(dist, 1e-3);
    vec2 tangent = vec2(-radial.y, radial.x);
    float funnel = 1.0 + above * 0.24 + seed * 1.6;
    float spill = smoothstep(9.0 + seed * 5.0, 15.0 + seed * 6.0, above);
    vec2 h = tangent * (7.0 + 5.0 * seed) * (1.0 - 0.5 * spill) + radial * mix((funnel - dist) * 2.2, 5.0, spill);
    float vy = mix(6.0 + 6.0 * seed, -0.6, spill);
    target = mix(target, vec3(h.x, vy, h.y), influence);
    grabbed = grabbed || influence > 0.15;
  }
  float k = 1.0 - exp(-uDt * (1.6 + seed * 1.2 + influence * 3.0));
  v.xyz = grabbed ? mix(v.xyz, target, k) : v.xyz * exp(-uDt * 8.0);
  gl_FragColor = v;
}`;

const POS_FRAG = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uHome;
uniform sampler2D uHeightTex;
uniform vec4 uDomain;
uniform float uDt;
uniform float uTime;
in vec2 vUv;
${NOISE_GLSL}

void main() {
  vec4 p = texture(uPos, vUv);
  vec4 v = texture(uVel, vUv);
  p.xyz += v.xyz * uDt;
  vec2 uv = (p.xz - uDomain.xy) * uDomain.zw;
  float ground = texture(uHeightTex, uv).r;
  float rest = ground < 0.0 ? 0.04 : 0.2;
  float floorY = max(ground, 0.0) + rest;
  bool airborne = p.y > floorY + 0.3;
  p.y = max(p.y, floorY);
  p.y = min(p.y, 60.0);
  p.w -= uDt * (airborne ? 0.6 : (ground < 0.0 ? 2.0 : 0.25));
  bool outside = any(lessThan(uv, vec2(0.02))) || any(greaterThan(uv, vec2(0.98)));
  if (p.w <= 0.0 || outside) {
    vec4 home = texture(uHome, vUv);
    p = vec4(home.xyz, 25.0 + hash12(vUv * 91.0 + uTime) * 50.0);
  }
  gl_FragColor = p;
}`;

const RENDER_VERT = /* glsl */ `
${ATMO_GLSL}
uniform sampler2D uPos;
uniform sampler2D uVel;
in vec2 aRef;
out vec2 vCorner;
out vec3 vWorld;
out vec3 vNormal;
out float vSeed;
out float vKind;
out float vLife;

void main() {
  vec4 p = texture(uPos, aRef);
  vec4 v = texture(uVel, aRef);
  float seed = v.w;
  float ground = max(texture(uHeightTex, domainUv(p.xz)).r, 0.0);
  float above = clamp((p.y - ground - 0.3) / 1.5, 0.0, 1.0);
  float speed = length(v.xyz);
  float spin = uTime * (1.5 + seed * 3.0) * (0.3 + min(speed, 12.0) * 0.12) + seed * 40.0;
  vec3 tumble = normalize(vec3(sin(spin) * 0.9, cos(spin * 0.7) + 0.4, sin(spin * 1.3 + 2.0)));
  vec3 n = normalize(mix(vec3(0.0, 1.0, 0.0), tumble, above));
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  float kind = step(0.8, fract(seed * 7.31));
  float size = (kind > 0.5 ? 0.13 : 0.21 + seed * 0.11) * smoothstep(0.45, 0.85, lifeAt(p.xz));
  vec3 world = p.xyz + (t1 * position.x + t2 * position.y * 0.62) * size;
  vCorner = position.xy;
  vWorld = world;
  vNormal = n;
  vSeed = seed;
  vKind = kind;
  vLife = clamp(p.w / 3.0, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const RENDER_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vCorner;
in vec3 vWorld;
in vec3 vNormal;
in float vSeed;
in float vKind;
in float vLife;

void main() {
  float r = length(vCorner * vec2(1.0, 1.25));
  if (r > 1.0 || vLife <= 0.01) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0) N = -N;
  float pick = fract(vSeed * 3.7);
  vec3 petal = pick < 0.34 ? vec3(1.0, 0.6, 0.62) : pick < 0.66 ? vec3(1.0, 0.95, 0.88) : pick < 0.9 ? vec3(1.0, 0.8, 0.3) : vec3(0.78, 0.68, 0.98);
  vec3 alb = vKind > 0.5 ? vec3(1.0, 0.95, 0.82) : petal * (1.0 - 0.2 * r);
  float sun = max(groundAt(vWorld.xz).w * cloudShadow(vWorld.xz), 0.25);
  float wrap = abs(dot(N, uSunDir)) * 0.35 + 0.45;
  float back = pow(max(dot(-V, uSunDir), 0.0), 2.0);
  vec3 H = normalize(uSunDir + V);
  float glint = pow(abs(dot(N, H)), 60.0) * 1.8;
  vec3 col = alb * (hemiLight(vec3(0.0, 1.0, 0.0)) * 0.7 + uSunColor * (wrap + back * 0.6) * sun * 0.55);
  col += uSunColor * glint * sun;
  if (vKind > 0.5) col += uSunColor * (0.4 + back) * sun;
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Petals live in flower patches, so a gust over a patch throws up a burst of colour. */
function seedHomes(patches: readonly FlowerPatch[], pos: Float32Array, share = 1): void {
  const rand = mulberry32(7);
  const living = Math.round(COUNT * share);
  for (let i = 0; i < COUNT; i++) {
    if (i >= living) {
      pos.set([0, -80, 0, 1e4], i * 4);
      continue;
    }
    let x = 0;
    let z = 0;
    let h = -1;
    for (let tries = 0; tries < 30 && h < GRASS_LINE + 1.2; tries++) {
      const { x: px, z: pz, radius: r } = patches[Math.floor(rand() * patches.length)];
      const a = rand() * Math.PI * 2;
      const d = r * Math.sqrt(-2 * Math.log(1 - rand() * 0.95)) * 0.6;
      x = px + Math.cos(a) * d;
      z = pz + Math.sin(a) * d;
      h = heightAt(x, z);
    }
    pos.set([x, h + 0.2, z, 5 + rand() * 70], i * 4);
  }
}

function initialState(): { pos: Float32Array; vel: Float32Array } {
  const rand = mulberry32(11);
  const pos = new Float32Array(COUNT * 4);
  const vel = new Float32Array(COUNT * 4);
  seedHomes(FLOWER_PATCHES, pos);
  for (let i = 0; i < COUNT; i++) vel.set([0, 0, 0, rand()], i * 4);
  return { pos, vel };
}

function dataTexture(data: Float32Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  return tex;
}

export class Petals {
  readonly mesh: THREE.Mesh;
  private readonly gpu: GpuRunner;
  private readonly pos = new PingPong(W, H, THREE.FloatType, THREE.NearestFilter);
  private readonly vel = new PingPong(W, H, THREE.FloatType, THREE.NearestFilter);
  private readonly velMat: THREE.ShaderMaterial;
  private readonly posMat: THREE.ShaderMaterial;
  private readonly renderMat: THREE.ShaderMaterial;
  /** x, z, strength 0..1, radius. */
  private readonly updraft = new THREE.Vector4(0, 0, 0, 8);
  private readonly home: THREE.DataTexture;

  constructor(renderer: THREE.WebGLRenderer) {
    this.gpu = new GpuRunner(renderer);
    const { pos, vel } = initialState();
    const home = dataTexture(pos.slice());
    this.home = home;
    const copy = simMaterial(`uniform sampler2D uSrc; in vec2 vUv; void main() { gl_FragColor = texture(uSrc, vUv); }`, {
      uSrc: { value: null },
    });
    for (const [target, data] of [[this.pos, pos], [this.vel, vel]] as const) {
      const tex = dataTexture(data);
      copy.uniforms.uSrc.value = tex;
      this.gpu.run(copy, target.read);
      tex.dispose();
    }
    copy.dispose();

    const shared = {
      uWindTex: atmo.uniforms.uWindTex,
      uHeightTex: atmo.uniforms.uHeightTex,
      uDomain: atmo.uniforms.uDomain,
      uTime: atmo.uniforms.uTime,
      uDt: { value: 1 / 60 },
    };
    this.velMat = simMaterial(VEL_FRAG, { ...shared, uPos: { value: null }, uVel: { value: null }, uUpdraft: { value: this.updraft } });
    this.posMat = simMaterial(POS_FRAG, { ...shared, uPos: { value: null }, uVel: { value: null }, uHome: { value: home } });

    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    const refs = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      refs[i * 2] = ((i % W) + 0.5) / W;
      refs[i * 2 + 1] = (Math.floor(i / W) + 0.5) / H;
    }
    geo.setAttribute('aRef', new THREE.InstancedBufferAttribute(refs, 2));
    geo.instanceCount = COUNT;
    this.renderMat = new THREE.ShaderMaterial({
      vertexShader: RENDER_VERT,
      fragmentShader: RENDER_FRAG,
      uniforms: { ...atmo.uniforms, uPos: { value: null }, uVel: { value: null } },
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.renderMat);
    this.mesh.frustumCulled = false;
  }

  /** `at` is the updraft centre while the player holds; the funnel fades out over a second or two after release. */
  /**
   * Moves the petals' patches to `patches` (the flowers near the window), so gusts inland lift petals too.
   * `share` is how many of them live there; the rest wait out of sight, for sparser flowers in the short pasture.
   */
  rehome(patches: readonly FlowerPatch[], share = 1): void {
    if (!patches.length) return;
    seedHomes(patches, this.home.image.data as Float32Array, share);
    this.home.needsUpdate = true;
  }

  update(dt: number, at: THREE.Vector3 | null, charge: number): void {
    if (at && charge > 0) {
      this.updraft.x += (at.x - this.updraft.x) * (this.updraft.z < 0.05 ? 1 : 1 - Math.exp(-dt * 6));
      this.updraft.y += (at.z - this.updraft.y) * (this.updraft.z < 0.05 ? 1 : 1 - Math.exp(-dt * 6));
      this.updraft.z = Math.max(this.updraft.z, Math.min(1, charge * 1.6));
      this.updraft.w = 6 + charge * 4;
    } else {
      this.updraft.z = Math.max(0, this.updraft.z - dt * 0.7);
    }
    this.velMat.uniforms.uDt.value = dt;
    this.velMat.uniforms.uPos.value = this.pos.texture;
    this.velMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.velMat, this.vel.write);
    this.vel.swap();

    this.posMat.uniforms.uPos.value = this.pos.texture;
    this.posMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.posMat, this.pos.write);
    this.pos.swap();

    this.renderMat.uniforms.uPos.value = this.pos.texture;
    this.renderMat.uniforms.uVel.value = this.vel.texture;
  }
}

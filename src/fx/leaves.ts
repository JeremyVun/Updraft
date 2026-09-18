import * as THREE from 'three';
import { GpuRunner, PingPong, simMaterial } from '../gl/gpu';
import { ATMO_GLSL, NOISE_GLSL, atmo } from '../world/atmosphere';
import { ISLES } from '../world/heightfield';
import { mulberry32 } from '../world/noise';
import { glsl, tuning } from '../tuning';

const W = 192;
const H = 192;
const ISLE = ISLES.birches;

/**
 * How far out of the birch island a point lies: 1 at its own coast. Nothing of this room is allowed past it, so
 * a leaf that goes out over the water thins away and is gone rather than turning up in the next room's grass.
 */
const ISLE_GLSL = /* glsl */ `
float birchIsleR(vec2 xz) {
  return length((xz - vec2(${glsl(ISLE.x)}, ${glsl(ISLE.z)})) / vec2(${glsl(ISLE.rx)}, ${glsl(ISLE.rz)}));
}`;
/** How many leaves of the birch island are simulated at once: the ones that come off and the ones on the floor. */
export const LEAF_COUNT = W * H;

/** The gold of a birch in deep autumn, shared by the leaves still on the tree and the ones coming off it. */
export const LEAF_TINT_GLSL = /* glsl */ `
vec3 birchLeaf(float pick, float depth) {
  vec3 pale = vec3(0.97, 0.84, 0.44);
  vec3 gold = vec3(0.93, 0.66, 0.17);
  vec3 amber = vec3(0.80, 0.45, 0.13);
  vec3 russet = vec3(0.52, 0.26, 0.10);
  vec3 late = vec3(0.60, 0.60, 0.18);
  vec3 c = pick < 0.42 ? mix(pale, gold, pick * 2.4)
         : pick < 0.84 ? gold
         : pick < 0.94 ? amber
         : pick < 0.99 ? russet
         : late;
  return mix(c * 0.5, c, depth);
}`;

/**
 * One leaf drawn on a card that runs from the stalk at −1 to the tip at 1: ovate, pointed and finely toothed,
 * with a midrib and side veins, and curled across itself so it never reads as a flat scrap of paper.
 */
export const LEAF_SHAPE_GLSL = /* glsl */ `
float birchLeafEdge(vec2 c, float seed) {
  float t = clamp(c.y * 0.5 + 0.5, 0.0, 1.0);
  float wide = 0.72 * pow(1.0 - t, 0.8) * pow(min(t * 2.6, 1.0), 0.5);
  wide *= 1.0 - 0.12 * sin(t * (21.0 + 9.0 * seed) + seed * 31.0);
  return max(wide, step(t, 0.11) * 0.045) - abs(c.x);
}
vec3 leafVeins(vec3 col, vec2 c) {
  float rib = 1.0 - smoothstep(0.015, 0.07, abs(c.x));
  float side = smoothstep(0.4, 0.5, abs(fract(c.y * 3.1 + abs(c.x) * 1.5) - 0.5));
  return col * (1.0 - 0.2 * rib - 0.09 * side);
}
/** A leaf is never flat: it keeps a curl across the midrib, so one edge takes the sun and the other does not. */
vec3 leafCurl(vec3 n, vec3 side, vec2 c, float amount) {
  return normalize(n + side * c.x * amount);
}`;

/**
 * Whether a leaf still on the tree lets go this frame. The player's gusts take them off in clouds; the prevailing
 * breeze alone only trickles; and the branch a swing hangs from shakes its own down. Nothing ever puts one back.
 */
const RELEASE_GLSL = /* glsl */ `
uniform vec4 uShake;
uniform float uDt;
uniform float uTime;
bool letsGo(vec4 w, vec2 xz, float seed) {
  float grip = 0.3 + 0.85 * seed;
  if (w.z > grip * ${glsl(tuning.birches.gripEnergy)} || length(w.xy) > ${glsl(tuning.birches.gripSpeed)} + grip * 9.0) return true;
  float shake = uShake.w * (1.0 - smoothstep(0.0, uShake.z, length(xz - uShake.xy)));
  float chance = (${glsl(tuning.birches.trickle)} + shake) / 20.0;
  return hash12(vec2(seed * 977.0, floor(uTime * 20.0))) < chance;
}`;

const VEL_FRAG = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uWindTex;
uniform sampler2D uHeightTex;
uniform vec4 uDomain;
uniform vec4 uWade;
in vec2 vUv;
${NOISE_GLSL}
vec2 domainUv(vec2 xz) { return (xz - uDomain.xy) * uDomain.zw; }
bool insideUv(vec2 uv) { return all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))); }
${RELEASE_GLSL}

void main() {
  vec4 p = texture(uPos, vUv);
  vec4 v = texture(uVel, vUv);
  float seed = v.w;
  vec2 uv = domainUv(p.xz);
  if (p.w > 1.5 || !insideUv(uv)) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, seed);
    return;
  }
  vec4 w = texture(uWindTex, uv);
  float ground = texture(uHeightTex, uv).r;
  float sp = length(w.xy);

  if (p.w < 0.5) {
    /** Still on the branch: it holds on until the air takes it, and then it goes out on the gust that took it. */
    if (letsGo(w, p.xz, seed)) {
      vec2 gone = w.xy * (0.9 + 0.7 * seed);
      gl_FragColor = vec4(gone.x, 2.4 + w.z * 4.5, gone.y, seed);
      return;
    }
    gl_FragColor = vec4(0.0, 0.0, 0.0, seed);
    return;
  }

  float above = p.y - max(ground, 0.0);
  float resting = step(above, 0.14);
  float lift = w.z * (2.8 + 2.2 * seed) + smoothstep(6.0, 17.0, sp) * 2.2 + w.w * (2.2 + 1.6 * seed);
  /** A child walking into a drift of them sends the lot up round their knees. */
  float wade = uWade.w * (1.0 - smoothstep(uWade.z * 0.45, uWade.z, length(p.xz - uWade.xy)));
  bool grabbed = resting < 0.5 || lift > 0.5 + seed * 0.5 || wade > 0.25;

  vec2 turb = vec2(vnoise(p.xz * 0.4 + uTime * 0.9 + seed * 17.0), vnoise(p.zx * 0.4 - uTime * 0.8 + seed * 29.0)) - 0.5;
  bool afloat = ground < 0.0 && above < 0.25;
  /** A leaf never makes the speed of the air that took it: it lags, and what it loses it turns into tumbling. */
  vec2 hTarget = w.xy * (afloat ? 0.12 : 0.55 + 0.3 * seed) + turb * (1.3 + sp * 0.3);
  float fall = afloat ? 0.0 : 0.62 + 0.45 * seed;
  vec3 target = vec3(hTarget.x, lift * (0.8 + 0.5 * fract(seed * 13.7)) - fall + turb.y * 1.2, hTarget.y);
  if (wade > 0.25) {
    vec2 away = normalize(p.xz - uWade.xy + vec2(1e-3));
    target = vec3(away.x * (2.0 + 3.0 * seed), 2.2 + 2.4 * seed, away.y * (2.0 + 3.0 * seed));
  }
  float k = 1.0 - exp(-uDt * (1.3 + seed * 1.2 + wade * 6.0));
  v.xyz = grabbed ? mix(v.xyz, target, k) : v.xyz * exp(-uDt * 9.0);
  gl_FragColor = v;
}`;

const POS_FRAG = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uWindTex;
uniform sampler2D uHeightTex;
uniform vec4 uDomain;
in vec2 vUv;
${NOISE_GLSL}
${ISLE_GLSL}
vec2 domainUv(vec2 xz) { return (xz - uDomain.xy) * uDomain.zw; }
bool insideUv(vec2 uv) { return all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))); }
${RELEASE_GLSL}

void main() {
  vec4 p = texture(uPos, vUv);
  vec4 v = texture(uVel, vUv);
  vec2 uv = domainUv(p.xz);
  if (p.w > 1.5 || !insideUv(uv)) {
    gl_FragColor = p;
    return;
  }
  if (p.w < 0.5) {
    vec4 w = texture(uWindTex, uv);
    /** The same test the velocity pass just made, on the same textures, so the two never disagree. */
    if (letsGo(w, p.xz, v.w)) p.w = 1.0;
    gl_FragColor = p;
    return;
  }
  p.xyz += v.xyz * uDt;
  float ground = texture(uHeightTex, uv).r;
  /** On the sea they lie flat on the water and go with it, the way they do over the village further north. */
  p.y = max(p.y, max(ground, 0.0) + (ground < 0.0 ? 0.03 : 0.06));
  p.y = min(p.y, 70.0);
  if (birchIsleR(p.xz) > 1.3) p.w = 2.0;
  gl_FragColor = p;
}`;

const RENDER_VERT = /* glsl */ `
${ATMO_GLSL}
${ISLE_GLSL}
uniform sampler2D uPos;
uniform sampler2D uVel;
in vec2 aRef;
out vec2 vCorner;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSide;
out float vSeed;

void main() {
  vec4 p = texture(uPos, aRef);
  vec4 v = texture(uVel, aRef);
  if (p.w < 0.5 || p.w > 1.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float seed = v.w;
  float ground = max(texture(uHeightTex, domainUv(p.xz)).r, 0.0);
  float above = clamp((p.y - ground - 0.1) / 1.2, 0.0, 1.0);
  float speed = length(v.xyz);
  /** Lying flat when it is down; end over end while it is up, faster the harder it is going. */
  float spin = uTime * (1.8 + seed * 3.4) * (0.35 + min(speed, 14.0) * 0.14) + seed * 40.0;
  vec3 tumble = normalize(vec3(sin(spin) * 0.95, cos(spin * 0.8) + 0.35, sin(spin * 1.4 + 2.0)));
  vec3 n = normalize(mix(vec3(0.0, 1.0, 0.0), tumble, above));
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  /** Half, because this card is two units across where the litter's is one; bigger while it is in the air. */
  float size = ${glsl(tuning.birches.leafSize)} * 0.5 * (0.85 + 0.7 * fract(seed * 5.7)) * (1.0 + 0.55 * above);
  /** One leaf on the lens is a gold blind across the whole room, so the last metre of them thins away. */
  float away = distance(cameraPosition, p.xyz);
  size *= smoothstep(0.5, 2.6, away);
  /** The player's gusts land a long way up the ride, and a cloud that far off has to be drawn bigger to read. */
  size *= 1.0 + 1.1 * smoothstep(18.0, 75.0, away);
  /** And one blown out over the water goes to nothing before it is far enough out to be somebody else's leaf. */
  size *= 1.0 - smoothstep(1.06, 1.28, birchIsleR(p.xz));
  vWorld = p.xyz + (t1 * position.x * 1.45 + t2 * position.y) * size;
  vCorner = position.xy;
  vNormal = n;
  vSide = t1;
  vSeed = seed;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const RENDER_FRAG = /* glsl */ `
${ATMO_GLSL}
${LEAF_TINT_GLSL}
${LEAF_SHAPE_GLSL}
in vec2 vCorner;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vSide;
in float vSeed;

void main() {
  vec2 c = vCorner;
  if (birchLeafEdge(c, vSeed) < 0.0) discard;
  vec3 N = leafCurl(normalize(vNormal), normalize(vSide), c, 0.55);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  vec3 alb = leafVeins(birchLeaf(fract(vSeed * 7.13), 1.0), c);
  float sun = max(groundAt(vWorld.xz).w * cloudShadow(vWorld.xz), 0.3);
  float wrap = abs(dot(N, uSunDir)) * 0.4 + 0.42;
  float through = pow(max(dot(-V, uSunDir), 0.0), 2.5) * (0.4 + 0.6 * (1.0 - abs(dot(N, uSunDir))));
  vec3 col = alb * (hemiLight(N) * 0.8 + uSunColor * wrap * sun * 0.6);
  col += alb * alb * uSunColor * through * sun * 1.1;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function dataTexture(data: Float32Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  return tex;
}

/** What is shaking leaves loose besides the wind: a point (x, z), how far it reaches and how hard. */
export interface Shake {
  x: number;
  z: number;
  radius: number;
  strength: number;
}

/**
 * The leaves of the birch island, from the branch to the floor and along it. Every one of them starts on a tree;
 * the wind takes it off, it rides and tumbles and settles, and later gusts run it along the ground. Nothing ever
 * goes back up, which is the whole point of the room: what the player takes off the year does not come back.
 */
export class FallenLeaves {
  readonly mesh: THREE.Mesh;
  private readonly gpu: GpuRunner;
  private readonly pos = new PingPong(W, H, THREE.FloatType, THREE.NearestFilter);
  private readonly vel = new PingPong(W, H, THREE.FloatType, THREE.NearestFilter);
  private readonly velMat: THREE.ShaderMaterial;
  private readonly posMat: THREE.ShaderMaterial;
  private readonly renderMat: THREE.ShaderMaterial;
  /** Where somebody is wading through them: x, z, how far it reaches, how fast they are going. */
  private readonly wade = new THREE.Vector4(1e6, 1e6, 1.6, 0);
  private readonly shake = new THREE.Vector4(1e6, 1e6, 6, 0);

  /** `state` is four floats per leaf: where it hangs, and 0 if it is still on the tree or 1 if it is not. */
  constructor(renderer: THREE.WebGLRenderer, state: Float32Array) {
    this.gpu = new GpuRunner(renderer);
    const vel = new Float32Array(LEAF_COUNT * 4);
    const rand = mulberry32(6101);
    for (let i = 0; i < LEAF_COUNT; i++) vel[i * 4 + 3] = rand();
    const copy = simMaterial(`uniform sampler2D uSrc; in vec2 vUv; void main() { gl_FragColor = texture(uSrc, vUv); }`, {
      uSrc: { value: null },
    });
    for (const [target, data] of [[this.pos, state], [this.vel, vel]] as const) {
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
      uShake: { value: this.shake },
    };
    this.velMat = simMaterial(VEL_FRAG, { ...shared, uPos: { value: null }, uVel: { value: null }, uWade: { value: this.wade } });
    this.posMat = simMaterial(POS_FRAG, { ...shared, uPos: { value: null }, uVel: { value: null } });

    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    const refs = new Float32Array(LEAF_COUNT * 2);
    for (let i = 0; i < LEAF_COUNT; i++) {
      refs[i * 2] = ((i % W) + 0.5) / W;
      refs[i * 2 + 1] = (Math.floor(i / W) + 0.5) / H;
    }
    geo.setAttribute('aRef', new THREE.InstancedBufferAttribute(refs, 2));
    geo.instanceCount = LEAF_COUNT;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.renderMat = new THREE.ShaderMaterial({
      vertexShader: RENDER_VERT,
      fragmentShader: RENDER_FRAG,
      uniforms: { ...atmo.uniforms, uPos: { value: null }, uVel: { value: null } },
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    });
    this.mesh = new THREE.Mesh(geo, this.renderMat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Nothing is simulated or drawn anywhere but on the island: everywhere else these leaves are not in the world. */
  update(dt: number, here: boolean, wader: THREE.Vector3 | null, waderSpeed: number, shake: Shake | null): void {
    this.mesh.visible = here;
    if (!here) return;
    if (wader) this.wade.set(wader.x, wader.z, 1.7, Math.min(1, waderSpeed * 0.55));
    else this.wade.w = 0;
    if (shake) this.shake.set(shake.x, shake.z, shake.radius, shake.strength);
    else this.shake.w = 0;

    this.velMat.uniforms.uDt.value = dt;
    this.velMat.uniforms.uPos.value = this.pos.texture;
    this.velMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.velMat, this.vel.write);
    this.vel.swap();

    this.posMat.uniforms.uDt.value = dt;
    this.posMat.uniforms.uPos.value = this.pos.texture;
    this.posMat.uniforms.uVel.value = this.vel.texture;
    this.gpu.run(this.posMat, this.pos.write);
    this.pos.swap();

    this.renderMat.uniforms.uPos.value = this.pos.texture;
    this.renderMat.uniforms.uVel.value = this.vel.texture;
  }
}

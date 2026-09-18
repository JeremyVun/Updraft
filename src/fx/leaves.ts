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

/** The grid the litter field is kept on, and the piece of the world it covers: the island and a margin of sea. */
const LITTER_RES = 256;
const MARGIN = 14;
export const LITTER_SIDE = LITTER_RES;
export const LITTER_BOX = {
  x: ISLE.x - ISLE.rx - MARGIN,
  z: ISLE.z - ISLE.rz - MARGIN,
  sx: (ISLE.rx + MARGIN) * 2,
  sz: (ISLE.rz + MARGIN) * 2,
};

/** Reading the litter field: shared by the sim, the floor of leaves and anything that wants to know how deep it lies. */
export const LITTER_GLSL = /* glsl */ `
uniform sampler2D uLitterTex;
vec2 litterUv(vec2 xz) {
  return (xz - vec2(${glsl(LITTER_BOX.x)}, ${glsl(LITTER_BOX.z)})) / vec2(${glsl(LITTER_BOX.sx)}, ${glsl(LITTER_BOX.sz)});
}
vec2 litterWorld(vec2 uv) {
  return vec2(${glsl(LITTER_BOX.x)}, ${glsl(LITTER_BOX.z)}) + uv * vec2(${glsl(LITTER_BOX.sx)}, ${glsl(LITTER_BOX.sz)});
}
/** How deep the leaves lie here: 0 swept bare, about 1 an ordinary autumn floor, 2 and over a heap to jump into. */
float litterDepth(vec2 xz) {
  vec2 uv = litterUv(xz);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture(uLitterTex, uv).r;
}`;

const LITTER_SIM_FRAG = /* glsl */ `
uniform sampler2D uField;
uniform sampler2D uWindTex;
uniform vec4 uDomain;
uniform vec4 uWade;
uniform float uDt;
in vec2 vUv;
${LITTER_GLSL}
vec2 domainUv(vec2 xz) { return (xz - uDomain.xy) * uDomain.zw; }
bool insideUv(vec2 uv) { return all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0))); }

vec4 airAt(vec2 xz) {
  vec2 uv = domainUv(xz);
  return insideUv(uv) ? texture(uWindTex, uv) : vec4(0.0);
}

/** How hard the air is working on the floor here: enough of this and the leaves stop being on the ground at all. */
float lifting(vec4 w) {
  return smoothstep(${glsl(tuning.birches.litterTakes * 0.75)}, ${glsl(tuning.birches.litterTakes * 2.4)}, length(w.xy))
       + min(w.z * 1.7, 1.5) + min(w.w * 0.9, 1.1);
}

void main() {
  vec2 p = litterWorld(vUv);
  float d = texture(uField, vUv).r;
  vec4 w = airAt(p);
  /** What the air takes off this patch of floor this frame, and what the patch upwind of it has just sent over. */
  float goes = d * min(0.9, lifting(w) * ${glsl(tuning.birches.litterSweep)} * uDt);
  vec2 back = p - w.xy * uDt * ${glsl(tuning.birches.litterCarry)};
  float db = texture(uField, litterUv(back)).r;
  d += db * min(0.9, lifting(airAt(back)) * ${glsl(tuning.birches.litterSweep)} * uDt) - goes;
  /** A heap only ever settles: it never stands up again, so what a burst leaves is lower and wider every time. */
  float px = 1.0 / ${glsl(LITTER_RES)};
  float around = 0.25 * (texture(uField, vUv + vec2(px, 0.0)).r + texture(uField, vUv - vec2(px, 0.0)).r
                       + texture(uField, vUv + vec2(0.0, px)).r + texture(uField, vUv - vec2(0.0, px)).r);
  d = mix(d, around, min(0.7, ${glsl(tuning.birches.litterSlump)} * smoothstep(0.7, 2.0, max(d, around)) * uDt));
  /** And feet scuff a way through it: a walk over this island leaves a track in the leaves behind it. */
  float tread = uWade.w * (1.0 - smoothstep(uWade.z * 0.4, uWade.z, distance(p, uWade.xy)));
  d -= d * min(0.9, tread * 2.4 * uDt);
  gl_FragColor = vec4(max(d, 0.0), 0.0, 0.0, 1.0);
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

  float above = max(p.y - max(ground, 0.0), 0.0);
  /** A child walking into a drift of them sends the lot up round their knees. */
  float wade = uWade.w * (1.0 - smoothstep(uWade.z * 0.45, uWade.z, length(p.xz - uWade.xy)));
  /**
   * What it takes to move a leaf that is lying on the floor. A leaf is not a blade of grass rooted in the ground:
   * anything much over the everyday breeze picks it up altogether and it goes, and where it comes down is not
   * where it started. This one number is the difference between litter that behaves and litter that sticks.
   */
  float takes = ${glsl(tuning.birches.litterTakes)} * (0.6 + 0.85 * seed);
  float taken = smoothstep(takes * 0.55, takes, sp) + min(w.z * 2.4, 1.5) + smoothstep(0.15, 0.9, w.w) + wade * 3.0;
  float down = 1.0 - smoothstep(0.1, 0.55, above);
  if (down > 0.5 && taken < 0.32) {
    /** At rest, and staying at rest: nothing half-hearted, or the whole floor crawls under the breeze all day. */
    gl_FragColor = vec4(v.xyz * exp(-uDt * 11.0), seed);
    return;
  }

  /**
   * Off the ground it is a leaf and nothing else: it lags the air, it turns what it loses into tumbling, it rides
   * the rising part of a gust up, and on the way down it rocks from edge to edge instead of dropping like a stone.
   */
  bool afloat = ground < 0.0 && above < 0.25;
  float rise = w.z * (3.4 + 2.6 * seed) + smoothstep(7.0, 19.0, sp) * 2.6 + w.w * (3.6 + 2.8 * seed);
  /** Along the floor it barely leaves the ground: it skips, catches, and skips again, which is what skittering is. */
  float skip = down * clamp(sp / 7.0, 0.0, 1.5) * max(0.0, sin(uTime * (5.0 + 7.0 * seed) + seed * 61.0));
  float lift = rise + skip * 3.4;
  vec2 turb = vec2(vnoise(p.xz * 0.4 + uTime * 0.9 + seed * 17.0), vnoise(p.zx * 0.4 - uTime * 0.8 + seed * 29.0)) - 0.5;
  /** Close to the ground it very nearly makes the speed of the air; up in the open it falls behind it and tumbles. */
  float keeps = mix(0.9, 0.5 + 0.35 * seed, clamp(above, 0.0, 1.0));
  vec2 hTarget = w.xy * (afloat ? 0.12 : keeps) + turb * (1.3 + sp * 0.3);
  float fall = afloat ? 0.0 : 0.62 + 0.45 * seed;
  /** The rock of a falling leaf: side to side across the way it is going, widest when the air is slowest. */
  float rock = sin(uTime * (1.7 + 2.3 * seed) + seed * 43.0);
  vec2 across = sp > 0.5 ? vec2(-w.y, w.x) / sp : vec2(1.0, 0.0);
  hTarget += across * rock * (0.5 + 2.0 * (1.0 - clamp(sp / 9.0, 0.0, 1.0))) * min(above, 1.2);
  fall *= 0.7 + 0.4 * abs(rock);
  vec3 target = vec3(hTarget.x, lift * (0.8 + 0.5 * fract(seed * 13.7)) - fall + turb.y * 1.2, hTarget.y);
  if (wade > 0.25) {
    vec2 away = normalize(p.xz - uWade.xy + vec2(1e-3));
    target = vec3(away.x * (2.4 + 3.6 * seed), 2.6 + 3.0 * seed, away.y * (2.4 + 3.6 * seed));
  }
  float k = 1.0 - exp(-uDt * (1.6 + seed * 1.4 + sp * 0.12 + wade * 6.0));
  v.xyz = mix(v.xyz, target, k);
  gl_FragColor = v;
}`;

const POS_FRAG = /* glsl */ `
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform sampler2D uWindTex;
uniform sampler2D uHeightTex;
uniform vec4 uDomain;
uniform vec4 uFocus;
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

  /**
   * The walk over this island is a long one and there are only so many leaves. One that has settled far behind the
   * player, or that has gone out over the water where it is already fading to nothing, is of no use to anybody
   * there, so it is quietly moved back round them: mostly onto the floor ahead, and now and then up into the
   * crowns to come down out of them. It only ever happens outside what can be seen.
   */
  float away = distance(p.xz, uFocus.xy);
  if ((away > uFocus.z && length(v.xyz) < 1.2) || birchIsleR(p.xz) > 1.2) {
    float roll = hash12(vec2(v.w * 331.0, floor(uTime * 4.0)));
    float a = hash12(vec2(v.w * 77.0, floor(uTime * 4.0) + 3.0)) * 6.2831;
    vec2 to = uFocus.xy + vec2(cos(a), sin(a)) * (14.0 + 30.0 * roll);
    vec2 toUv = domainUv(to);
    float h = insideUv(toUv) ? texture(uHeightTex, toUv).r : -1.0;
    /** Never onto the beaches, never into the sea, and never anywhere the floor of this wood does not reach. */
    if (h > 1.4 && birchIsleR(to) < 0.86) {
      p.xz = to;
      p.y = h + (roll < 0.72 ? 0.06 : 7.0 + 6.0 * hash12(vec2(v.w * 53.0, 11.0)));
      p.w = 1.0;
    }
  }
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
  float above = clamp((p.y - ground - 0.06) / 0.8, 0.0, 1.0);
  float speed = length(v.xyz);
  /** Lying flat when it is down; end over end while it is up, faster the harder it is going. */
  float spin = uTime * (1.8 + seed * 3.4) * (0.35 + min(speed, 14.0) * 0.14) + seed * 40.0;
  vec3 tumble = normalize(vec3(sin(spin) * 0.95, cos(spin * 0.8) + 0.35, sin(spin * 1.4 + 2.0)));
  vec3 n = normalize(mix(vec3(0.0, 1.0, 0.0), tumble, above));
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  /** Half, because this card is two units across where the litter's is one: a settled one is a leaf of the litter. */
  float size = ${glsl(tuning.birches.leafSize)} * 0.5 * (1.2 + 0.85 * fract(seed * 5.7)) * (1.0 + 0.4 * above);
  /** One leaf on the lens is a gold blind across the whole room, so the last metre of them thins away. */
  float fromEye = distance(cameraPosition, p.xyz);
  size *= smoothstep(0.5, 2.6, fromEye);
  /** A cloud of them in the air a long way up the ride has to be drawn bigger to read; a settled one is litter. */
  size *= 1.0 + 1.1 * smoothstep(18.0, 75.0, fromEye) * above;
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

function dataTexture(data: Float32Array, w: number, h: number): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
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
 * The litter field: how deep the leaves lie, everywhere on the island, kept from one frame to the next. It is the
 * floor's memory. A gust lifts depth off the ground where it blows and puts it down again downwind, so the play
 * leaves swept bare ground behind it and heaps where the air ran out; a heap the wind has just burst slumps into a
 * lower, wider one rather than standing up like a snowdrift; and feet scuff a track through it. Whoever owns the
 * island seeds it once (`LITTER_SIDE` squared, r is the depth in leaves), and after that it is the room's own.
 */
export class LitterField {
  readonly uniforms: Record<string, THREE.IUniform>;
  private readonly gpu: GpuRunner;
  private readonly field = new PingPong(LITTER_RES, LITTER_RES, THREE.HalfFloatType, THREE.LinearFilter);
  private readonly mat: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, seed: Float32Array, wade: THREE.Vector4) {
    this.gpu = new GpuRunner(renderer);
    const copy = simMaterial(`uniform sampler2D uSrc; in vec2 vUv; void main() { gl_FragColor = texture(uSrc, vUv); }`, { uSrc: { value: null } });
    const tex = dataTexture(seed, LITTER_RES, LITTER_RES);
    copy.uniforms.uSrc.value = tex;
    this.gpu.run(copy, this.field.read);
    this.gpu.run(copy, this.field.write);
    tex.dispose();
    copy.dispose();
    this.uniforms = { uLitterTex: { value: this.field.texture } };
    this.mat = simMaterial(LITTER_SIM_FRAG, {
      uField: { value: null },
      uLitterTex: { value: null },
      uWindTex: atmo.uniforms.uWindTex,
      uDomain: atmo.uniforms.uDomain,
      uDt: { value: 1 / 60 },
      uWade: { value: wade },
    });
  }

  update(dt: number): void {
    this.mat.uniforms.uDt.value = dt;
    this.mat.uniforms.uField.value = this.field.texture;
    this.gpu.run(this.mat, this.field.write);
    this.field.swap();
    this.uniforms.uLitterTex.value = this.field.texture;
  }
}

/**
 * The leaves of the birch island, from the branch to the floor and along it. Every one of them starts on a tree or
 * already down; the wind takes it off, it rides and tumbles and settles, and later gusts run it along the floor to
 * somewhere else. Nothing ever goes back up, which is the whole point of the room: what the player takes off the
 * year does not come back.
 */
export class FallenLeaves {
  readonly mesh: THREE.Mesh;
  private readonly gpu: GpuRunner;
  private readonly pos = new PingPong(W, H, THREE.FloatType, THREE.NearestFilter);
  private readonly vel = new PingPong(W, H, THREE.FloatType, THREE.NearestFilter);
  private readonly velMat: THREE.ShaderMaterial;
  private readonly posMat: THREE.ShaderMaterial;
  private readonly renderMat: THREE.ShaderMaterial;
  private readonly shake = new THREE.Vector4(1e6, 1e6, 6, 0);
  /** Where the leaves are wanted: the child, and how far out a settled one has to be before it is moved back. */
  private readonly focus = new THREE.Vector4(0, 0, 58, 0);

  /** `state` is four floats per leaf: where it starts, and 0 if it is still on the tree or 1 if it is not. */
  constructor(renderer: THREE.WebGLRenderer, state: Float32Array, wade: THREE.Vector4) {
    this.gpu = new GpuRunner(renderer);
    const vel = new Float32Array(LEAF_COUNT * 4);
    const rand = mulberry32(6101);
    for (let i = 0; i < LEAF_COUNT; i++) vel[i * 4 + 3] = rand();
    const copy = simMaterial(`uniform sampler2D uSrc; in vec2 vUv; void main() { gl_FragColor = texture(uSrc, vUv); }`, {
      uSrc: { value: null },
    });
    for (const [target, data] of [[this.pos, state], [this.vel, vel]] as const) {
      const tex = dataTexture(data, W, H);
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
    this.velMat = simMaterial(VEL_FRAG, { ...shared, uPos: { value: null }, uVel: { value: null }, uWade: { value: wade } });
    this.posMat = simMaterial(POS_FRAG, { ...shared, uPos: { value: null }, uVel: { value: null }, uFocus: { value: this.focus } });

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
  update(dt: number, here: boolean, focus: THREE.Vector3, shake: Shake | null): void {
    this.mesh.visible = here;
    if (!here) return;
    this.focus.x = focus.x;
    this.focus.y = focus.z;
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

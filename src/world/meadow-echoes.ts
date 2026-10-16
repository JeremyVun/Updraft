import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glsl, tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { POND } from './heightfield';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import type { WindField, WindSample } from '../wind/field';
import { MeadowSeeds } from './meadow-seeds';
import { mulberry32 } from './noise';

const T = tuning.meadowEchoes;
/** The way the bed's invitation sweeps across it. */
const ACROSS = new THREE.Vector3(10, 0, 0);

/**
 * Bed flowers (`uFlower` 1) read `aState.x` as how awake they are: asleep they stand short with the stem arched
 * over and the petals folded into a hanging bud; awake they stand tall, head up and wide open. Seed heads read it
 * as how much of their down has gone. `aState.yz` is the lean a passing sweep gave the plant.
 */
const VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aTint;
in float aPetal;
in vec4 aState;
uniform vec2 uAir;
uniform float uFlower;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;

void arch(inout vec3 p, inout vec3 n, float tip, float bow) {
  float foot = tip * .35, len = tip - foot;
  if (p.y <= foot || bow < 1e-3) return;
  float a = bow * clamp(p.y - foot, 0., len) / len, r = len / bow, c = cos(a), s = sin(a);
  vec2 q = vec2(r * (1. - c), foot + r * s) + vec2(c, -s) * p.x + vec2(s, c) * max(p.y - tip, 0.);
  p.xy = q;
  n.xy = vec2(n.x * c + n.y * s, -n.x * s + n.y * c);
}

void main() {
  mat4 transform = modelMatrix * instanceMatrix;
  vec3 root = (transform * vec4(0., 0., 0., 1.)).xyz;
  vec3 p = position, n = normal;
  float open = 1.;
  if (uFlower > .5) {
    float wake = max(aState.x, 0.);
    open = smoothstep(.3, 1., wake) * (1. + .5 * max(wake - 1., 0.));
    vec3 heart = vec3(-.035, 1.02, 0.);
    vec3 q = p - heart;
    float k = mix(.16, 1.08, open), r = length(q.xz);
    q.xz *= k; q.y += r * max(1. - k, 0.) * .7;
    p = mix(p, heart + q, aPetal);
    float stand = mix(${glsl(T.sleepHeight)}, 1., smoothstep(0., .65, wake));
    p.y = p.y <= 1. ? p.y * stand : stand + p.y - 1.;
    arch(p, n, stand, ${glsl(T.sleepBow)} * (.75 + .5 * aState.w) * (1. - smoothstep(.05, .6, wake)));
  } else {
    vec3 heart = vec3(-.035, 1.06, 0.);
    p = mix(p, heart + (p - heart) * (1. - aState.x * .86), aPetal);
  }
  vec4 w = transform * vec4(p, 1.);
  float h = w.y - root.y;
  vec2 bend = uAir * ${glsl(T.stemBend)} / (1. + length(uAir) * ${glsl(T.stemSaturation)});
  w.xz += (bend + aState.yz / (1. + length(aState.yz) * ${glsl(T.stemSaturation * 8)}) + vec2(sin(uTime * 1.4 + root.x * .7 + root.z * .3), cos(uTime * .95 + root.z)) * .04) * h * h;
  vWorld = w.xyz;
  vNormal = normalize(mat3(transform) * n);
  vec3 petal = aTint * instanceColor;
  vTint = mix(aTint, mix(petal * petal * vec3(1.05, .78, 1.1), petal, open), aPetal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTint;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1. : -1.);
  float sun = dot(N, uSunDir);
  vec3 col = vTint * (uSkyAmbient * 1.45 + uSunColor * (max(sun, 0.) * .65 + max(-sun, 0.) * .72));
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.);
}`;

/** Loose down and petals: thin, so the low sun comes through them, with a glint off whichever filament faces it. */
const LOOSE_VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aTint;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.);
  vWorld = w.xyz;
  vNormal = normalize(mat3(m) * normal);
  vTint = aTint * instanceColor;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const LOOSE_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uGlow;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTint;
void main() {
  vec3 V = normalize(cameraPosition - vWorld), N = normalize(vNormal);
  if (dot(N, V) < 0.) N = -N;
  float through = pow(max(dot(-V, uSunDir), 0.), 3.);
  float glint = pow(abs(dot(N, halfVector(uSunDir, V))), 20.);
  vec3 col = vTint * (hemiLight(N) * .85 + uSunColor * (.5 + abs(dot(N, uSunDir)) * .35 + through * .5));
  col += uSunColor * glint * uGlow;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.);
}`;

function painted(g: THREE.BufferGeometry, color: string, petal = 0): THREE.BufferGeometry {
  const c = new THREE.Color(color), n = g.attributes.position.count;
  const tint = new Float32Array(n * 3), part = new Float32Array(n);
  for (let i = 0; i < n; i++) { c.toArray(tint, i * 3); part[i] = petal; }
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  g.setAttribute('aPetal', new THREE.BufferAttribute(part, 1));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

function stemGeometry(): THREE.BufferGeometry[] {
  const stem = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(), new THREE.Vector3(.045, .5, .025), new THREE.Vector3(-.035, 1, 0),
  ]), 8, .013, 4, false);
  const parts = [painted(stem, '#607b3d')];
  for (let k = 0; k < 3; k++) {
    const p = [], ind = [], a = k * 2.4;
    for (let j = 0; j <= 6; j++) {
      const t = j / 6, w = Math.sin(t * Math.PI) * .065;
      for (const side of [-1, 1]) p.push(Math.sin(a) * t * .3 + Math.cos(a) * w * side,
        .2 + k * .18 + t * .16 + Math.sin(t * Math.PI) * .025, Math.cos(a) * t * .3 - Math.sin(a) * w * side);
      if (j < 6) { const i = j * 2; ind.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(ind); g.computeVertexNormals(); parts.push(painted(g, '#78914d'));
  }
  return parts;
}

function flowerGeometry(): THREE.BufferGeometry {
  const parts = stemGeometry();
  for (let k = 0; k < 7; k++) {
    const p = [], indices = [], a = k * Math.PI * 2 / 7;
    for (let j = 0; j <= 6; j++) {
      const t = j / 6, reach = .045 + t * .3;
      for (let s = 0; s <= 4; s++) {
        const v = s / 2 - 1, w = Math.pow(Math.sin(t * Math.PI), .6) * .115 * v;
        p.push(-.035 + Math.sin(a) * reach + Math.cos(a) * w,
          1 + .06 * t + .075 * t * t + v * v * .025, Math.cos(a) * reach - Math.sin(a) * w);
        if (j < 6 && s < 4) { const i = j * 5 + s; indices.push(i, i + 5, i + 1, i + 1, i + 5, i + 6); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(indices); g.computeVertexNormals(); parts.push(painted(g, '#f8e9df', 1));
  }
  parts.push(painted(new THREE.SphereGeometry(.057, 8, 4).scale(1, .4, 1).translate(-.035, 1.024, 0), '#b59347'));
  return mergeGeometries(parts)!;
}

function tuftGeometry(head: boolean): THREE.BufferGeometry {
  const p: number[] = [], indices: number[] = [];
  const ribbon = (a: THREE.Vector3, b: THREE.Vector3, width: number) => {
    const side = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3(.3, .6, 1)).normalize().multiplyScalar(width);
    const n = p.length / 3;
    for (const [v, sign] of [[a, -1], [a, 1], [b, -1], [b, 1]] as const) p.push(v.x + side.x * sign, v.y + side.y * sign, v.z + side.z * sign);
    indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  };
  if (head) for (let i = 0; i < 95; i++) {
    const y = 1 - 2 * (i + .5) / 95, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    const end = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(.22);
    ribbon(end.clone().multiplyScalar(.65), end, .0025);
    for (let j = 0; j < 3; j++) {
      const tip = end.clone().multiplyScalar(1.12).add(new THREE.Vector3(Math.cos(j * 2.094 + a), .2, Math.sin(j * 2.094 + a)).multiplyScalar(.045));
      ribbon(end, tip, .002);
    }
  } else {
    ribbon(new THREE.Vector3(0, -.11, 0), new THREE.Vector3(), .006);
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI * 2 / 9;
      ribbon(new THREE.Vector3(), new THREE.Vector3(Math.cos(a) * .085, .065, Math.sin(a) * .085), .005);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(indices); g.computeVertexNormals(); return painted(g, head ? '#bcc3b0' : '#fff8ea', 1);
}

interface Plant {
  /** Where a sweep on screen is tested against it. */
  at: THREE.Vector3;
  shown: number;
  speed: number;
  lean: THREE.Vector2;
  leanSpeed: THREE.Vector2;
  seen: boolean;
  /** Inside the lens this frame, so the invitation never points at sleepers off the edge of a narrow screen. */
  framed: boolean;
  color: THREE.Color;
  opened: boolean;
}

interface Petal { at: THREE.Vector3; v: THREE.Vector3; age: number; life: number; spin: number }

export class MeadowEchoes {
  readonly group = new THREE.Group();
  readonly seeds: MeadowSeeds;
  readonly stands = T.stands.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z), z));
  readonly patches = T.patches.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 1.3, z));
  readonly sectors = T.bedPoints.map(([dx, dz]) => {
    const p = this.patches[0]; return new THREE.Vector3(p.x + dx, heightAt(p.x + dx, p.z + dz) + 1.2, p.z + dz);
  });
  /** The heart of the lifted down, which the child watches and the updraft stands under. */
  readonly seed = new THREE.Vector3();
  /** The top of the rising column, kept in the camera's frame. */
  readonly crown = new THREE.Vector3();
  readonly heard = new THREE.Vector3();
  heardAt = -Infinity;
  /** The last time the player's updraft was taking down. */
  workedAt = -Infinity;
  enabled = false;
  private lastReceived = -Infinity;
  private now = 0;
  private readonly material: THREE.ShaderMaterial;
  private readonly headMaterial: THREE.ShaderMaterial;
  private readonly blooms: THREE.InstancedMesh;
  private readonly heads: THREE.InstancedMesh;
  private readonly down: THREE.InstancedMesh;
  private readonly petals: THREE.InstancedMesh;
  private readonly bedState: THREE.InstancedBufferAttribute;
  private readonly headState: THREE.InstancedBufferAttribute;
  private readonly flowers: Plant[] = [];
  private readonly seedHeads: Plant[] = [];
  private readonly piece = new THREE.Object3D();
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly air = new THREE.Vector2();
  private readonly seedAir = new THREE.Vector2();
  /** Each mote of down: where it waits on its head, where it is, how it moves, and in what order the wind takes it. */
  private readonly home: Float32Array;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly rnd: Float32Array;
  private readonly order: Float32Array;
  private readonly headOf: Uint16Array;
  /** 0 on its head, 1 flying, 2 gone. */
  private readonly phase: Uint8Array;
  private readonly perHead: Uint16Array;
  private readonly gone: Uint16Array;
  private readonly column = new THREE.Vector3();
  /** Which way the released down drifts, chosen as it goes from where it is watched. */
  private readonly away = new THREE.Vector2(-0.46, -0.89);
  private readonly toward = new THREE.Vector3();
  private readonly mean = new THREE.Vector3();
  private readonly asleep = new THREE.Vector3();
  private readonly lens = new THREE.Vector3();
  private updraft = 0;
  private effort = 0;
  private turning = 1;
  private readonly lastMove = new THREE.Vector2();
  private readonly flurry: Petal[] = [];
  private nextPetal = 0;
  private readonly rand = mulberry32(9127);

  constructor() {
    this.group.name = 'meadow-echoes';
    const material = (air: THREE.Vector2, flower: number) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uAir: { value: air }, uTime: { value: 0 }, uFlower: { value: flower } },
      vertexColors: true, side: THREE.DoubleSide });
    this.material = material(this.air, 1);
    const rand = mulberry32(4731), colors = ['#dfb5cf', '#b9b9e0', '#eed8c4', '#d4b5d4'];
    const flowerShape = flowerGeometry();
    this.bedState = new THREE.InstancedBufferAttribute(new Float32Array(T.flowers * 4), 4).setUsage(THREE.DynamicDrawUsage);
    flowerShape.setAttribute('aState', this.bedState);
    this.blooms = new THREE.InstancedMesh(flowerShape, this.material, T.flowers);
    const [x, z, rx, rz] = T.patches[0];
    for (let i = 0; i < this.blooms.count; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()), px = x + Math.cos(a) * r * rx, pz = z + Math.sin(a) * r * rz;
      this.piece.position.set(px, heightAt(px, pz), pz);
      this.piece.rotation.set((rand() - .5) * .24, rand() * Math.PI * 2, (rand() - .5) * .24);
      const scale = .85 + rand() * .8;
      const stand = this.stands[0], seen = Math.hypot(px - stand.x, pz - stand.z) >= 3.2;
      this.piece.scale.setScalar(seen ? scale : 0);
      this.piece.updateMatrix();
      const color = new THREE.Color(colors[i % colors.length]);
      this.blooms.setMatrixAt(i, this.piece.matrix); this.blooms.setColorAt(i, color);
      this.flowers.push(this.plant(px, this.piece.position.y + scale * .8, pz, seen, color));
      this.bedState.setW(i, this.rand());
    }
    this.seeds = new MeadowSeeds(T.flowers, this.flowers.map(f => f.seen));
    this.headMaterial = material(this.seedAir, 0);
    const stems = mergeGeometries(stemGeometry())!;
    const head = tuftGeometry(true).translate(-.035, 1.06, 0);
    const heart = new THREE.SphereGeometry(.16, 10, 8);
    const hp = heart.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), r = .94 + .08 * Math.sin(x * 79 + y * 93 + z * 67);
      hp.setXYZ(i, x * r, y * r, z * r);
    }
    heart.computeVertexNormals(); heart.translate(-.035, 1.06, 0);
    const headShape = mergeGeometries([stems, head, painted(heart, '#d5d2b7', 1)])!;
    this.headState = new THREE.InstancedBufferAttribute(new Float32Array(T.seedHeads * 4), 4).setUsage(THREE.DynamicDrawUsage);
    headShape.setAttribute('aState', this.headState);
    this.heads = new THREE.InstancedMesh(headShape, this.headMaterial, T.seedHeads);
    const [sx, sz, srx, srz] = T.patches[1];
    const tops: THREE.Vector3[] = [], sizes: number[] = [];
    for (let i = 0; i < this.heads.count; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()), px = sx + Math.cos(a) * r * srx, pz = sz + Math.sin(a) * r * srz;
      this.piece.position.set(px, heightAt(px, pz), pz); this.piece.rotation.set(0, rand() * Math.PI * 2, (rand() - .5) * .12);
      this.piece.scale.setScalar(1.1 + rand() * .7); this.piece.updateMatrix();
      this.heads.setMatrixAt(i, this.piece.matrix); this.heads.setColorAt(i, new THREE.Color('#fff6e2'));
      tops.push(new THREE.Vector3(px, this.piece.position.y + this.piece.scale.y * 1.06, pz)); sizes.push(this.piece.scale.y);
      this.seedHeads.push(this.plant(px, this.piece.position.y + this.piece.scale.y * .9, pz, true, new THREE.Color()));
    }
    const n = T.down;
    this.home = new Float32Array(n * 3); this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.rnd = new Float32Array(n); this.order = new Float32Array(n); this.headOf = new Uint16Array(n);
    this.phase = new Uint8Array(n); this.perHead = new Uint16Array(T.seedHeads); this.gone = new Uint16Array(T.seedHeads);
    const centre = this.patches[1], rank: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const h = i % tops.length, top = tops[h], a = this.rand() * Math.PI * 2, y = .1 + this.rand() * .9, r = Math.sqrt(1 - y * y);
      this.home.set([top.x + Math.cos(a) * r * .22 * sizes[h], top.y + y * .22 * sizes[h], top.z + Math.sin(a) * r * .22 * sizes[h]], i * 3);
      this.headOf[i] = h; this.perHead[h]++; this.rnd[i] = this.rand();
      rank.push([i, Math.hypot((top.x - centre.x) / srx, (top.z - centre.z) / srz) + this.rand() * .45]);
    }
    rank.sort((a, b) => a[1] - b[1]).forEach(([i], k) => { this.order[i] = k / n * .985; });
    const looseMaterial = new THREE.ShaderMaterial({ vertexShader: LOOSE_VERT, fragmentShader: LOOSE_FRAG,
      uniforms: { ...atmo.uniforms, uGlow: { value: .8 } }, vertexColors: true, side: THREE.DoubleSide });
    this.down = new THREE.InstancedMesh(tuftGeometry(false), looseMaterial, n);
    this.petals = new THREE.InstancedMesh(painted(new THREE.SphereGeometry(.065, 5, 3).scale(1, .18, 1.7), '#ffffff', 1), looseMaterial, 240);
    for (const mesh of [this.down, this.petals]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, new THREE.Color('#ffffff'));
      mesh.frustumCulled = false;
    }
    for (let i = 0; i < this.petals.count; i++) this.flurry.push({ at: new THREE.Vector3(), v: new THREE.Vector3(), age: 1, life: 0, spin: 0 });
    for (const mesh of [this.blooms, this.heads]) mesh.frustumCulled = false;
    this.group.add(this.blooms, this.heads, this.down, this.petals);
    this.reset();
  }

  private plant(x: number, y: number, z: number, seen: boolean, color: THREE.Color): Plant {
    return { at: new THREE.Vector3(x, y, z), shown: 0, speed: 0, lean: new THREE.Vector2(), leanSpeed: new THREE.Vector2(), seen, framed: false, color, opened: false };
  }

  get source(): THREE.Vector3 { return this.patches[Math.min(this.seeds.completed, 1)]; }
  get receiver(): THREE.Vector3 { return this.toward.copy(this.patches[0]).add(ACROSS); }
  /** Where the bed still sleeps: round its sleepiest flower, so the sweep shown passes over the sleepers. */
  get invitation(): THREE.Vector3 {
    if (this.seeds.completed !== 0) return this.patches[1];
    const framed = this.flowers.some(f => f.seen && f.framed);
    const offered = (f: Plant): boolean => f.seen && (f.framed || !framed);
    let least = 0;
    this.flowers.forEach((f, i) => { if (offered(f) && (!offered(this.flowers[least]) || this.seeds.wake[i] < this.seeds.wake[least])) least = i; });
    const from = this.flowers[least].at, mean = this.asleep.set(0, 0, 0);
    let n = 0;
    this.flowers.forEach((f, i) => {
      if (offered(f) && this.seeds.wake[i] < .7 && f.at.distanceTo(from) < 3) { mean.add(f.at); n++; }
    });
    return n ? mean.divideScalar(n) : mean.copy(from);
  }
  get receivedAt(): number { return this.lastReceived; }

  reset(completed = 0): void {
    this.seeds.reset(completed); this.enabled = false;
    this.lastReceived = this.heardAt = this.workedAt = -Infinity;
    this.updraft = this.effort = 0;
    this.flowers.forEach((f, i) => { f.shown = this.seeds.wake[i]; f.speed = 0; f.lean.set(0, 0); f.leanSpeed.set(0, 0); f.opened = f.shown > .8; });
    const bald = this.seeds.completed >= 2 ? 1 : 0;
    for (const h of this.seedHeads) { h.shown = bald; h.speed = 0; h.lean.set(0, 0); h.leanSpeed.set(0, 0); }
    this.phase.fill(bald ? 2 : 0);
    for (const p of this.flurry) p.age = p.life = 0;
    this.column.copy(this.patches[1]);
    this.seed.copy(this.patches[1]);
    this.crown.copy(this.patches[1]);
    this.down.visible = this.petals.visible = false;
    this.writePlants();
  }

  release(): void { this.seeds.release(); }

  update(dt: number, time: number, camera: THREE.PerspectiveCamera, input: PointerInput, active: boolean, wind?: WindField): void {
    if (!active) return;
    this.now = time;
    const ease = 1 - Math.exp(-dt * 2);
    for (const [i, air] of [this.air, this.seedAir].entries()) {
      if (wind) wind.sample(this.patches[i].x, this.patches[i].z, this.sample);
      air.x += (this.sample.x - air.x) * ease; air.y += (this.sample.z - air.y) * ease;
    }
    this.material.uniforms.uTime.value = this.headMaterial.uniforms.uTime.value = time;
    this.effort = 0;
    if (this.seeds.active && this.seeds.completed === 0) for (const f of this.flowers) {
      const p = this.lens.copy(f.at).project(camera);
      f.framed = p.z < 1 && Math.abs(p.x) < .9 && Math.abs(p.y) < .9;
    }
    if (this.seeds.active && this.enabled) this.brush(dt, camera, input, wind);
    const finishing = this.seeds.finishing >= 0;
    if (this.seeds.update(dt)) {
      this.lastReceived = time;
      if (this.seeds.completed === 2) this.aimDrift(camera);
    }
    if (!finishing && this.seeds.finishing >= 0) this.flourish();
    this.grow(dt);
    this.fly(dt, time);
    this.flutter(dt);
  }

  private brush(dt: number, camera: THREE.PerspectiveCamera, input: PointerInput, wind?: WindField): void {
    if (!input.present || input.muted) return;
    const dx = (input.ndc.x - input.prevNdc.x) * camera.aspect, dy = input.ndc.y - input.prevNdc.y;
    const movement = Math.hypot(dx, dy);
    if (movement > 1e-4) {
      const turn = this.lastMove.x * dy - this.lastMove.y * dx;
      if (Math.abs(turn) > 1e-7) this.turning += (Math.sign(turn) - this.turning) * Math.min(1, dt * 3);
      this.lastMove.set(dx, dy);
    }
    const stroke = input.gust > tuning.pointer.minGust && movement > 1e-4;
    const plants = this.seeds.completed === 0 ? this.flowers : this.seedHeads;
    let best = 0;
    if (stroke) plants.forEach((f, i) => {
      if (!f.seen) return;
      const hit = screenBrush(camera, f.at, input.prevNdc, input.ndc, T.brush);
      if (hit < .01) return;
      if (plants === this.flowers) this.seeds.stir(i, movement * hit * T.wakeGain);
      const push = hit * T.sweepPush * dt;
      f.leanSpeed.x += input.gustDir.x * push; f.leanSpeed.y += input.gustDir.y * push;
      if (hit > best) { best = hit; if (this.now - this.heardAt > 1.1) this.heard.copy(f.at); }
    });
    if (best > 0) {
      if (this.now - this.heardAt > 1.1) this.heardAt = this.now;
      const speed = Math.min(input.gust, 14) * Math.sqrt(best), g = input.gustDir;
      wind?.addSplat({ source: this, ax: this.heard.x - g.x * 2.5, az: this.heard.z - g.y * 2.5, bx: this.heard.x + g.x * 2.5,
        bz: this.heard.z + g.y * 2.5, vx: g.x * speed, vz: g.y * speed, radius: 3, energy: Math.min(.5, speed / 25), swirl: 0, lift: 0 });
    }
    if (this.seeds.completed !== 1) return;
    const p = this.patches[1];
    if (Math.hypot(input.updraftAt.x - p.x, input.updraftAt.z - p.z) > T.liftReach) return;
    this.effort = THREE.MathUtils.smoothstep(input.charge, T.chargeFrom, T.chargeFull);
    if (this.effort > 0) { this.seeds.lift(this.effort * dt / T.releaseTime); this.workedAt = this.now; }
    this.column.x += (THREE.MathUtils.clamp(input.updraftAt.x, p.x - 4, p.x + 4) - this.column.x) * Math.min(1, dt);
    this.column.z += (THREE.MathUtils.clamp(input.updraftAt.z, p.z - 4, p.z + 4) - this.column.z) * Math.min(1, dt);
  }

  private grow(dt: number): void {
    this.flowers.forEach((f, i) => {
      f.speed += ((this.seeds.wake[i] - f.shown) * T.wakeStiffness - f.speed * T.wakeDamping) * dt;
      f.shown += f.speed * dt;
      if (!f.opened && f.shown > .8) {
        f.opened = true;
        if (f.seen && this.rand() < .3) this.shed(f.at, f.color, .8);
      }
      this.sway(f, dt);
    });
    const released = this.seeds.completed >= 2 ? 1 : 0;
    const gone = this.gone.fill(0);
    for (let i = 0; i < this.phase.length; i++) if (this.phase[i] || released) gone[this.headOf[i]]++;
    this.seedHeads.forEach((h, i) => {
      h.shown += (gone[i] / Math.max(1, this.perHead[i]) - h.shown) * (1 - Math.exp(-dt * 3));
      this.sway(h, dt);
    });
    this.writePlants();
  }

  private sway(f: Plant, dt: number): void {
    f.leanSpeed.x += (-f.lean.x * 30 - f.leanSpeed.x * 5) * dt; f.leanSpeed.y += (-f.lean.y * 30 - f.leanSpeed.y * 5) * dt;
    f.lean.x += f.leanSpeed.x * dt; f.lean.y += f.leanSpeed.y * dt;
  }

  private writePlants(): void {
    this.flowers.forEach((f, i) => this.bedState.setXYZ(i, f.shown, f.lean.x, f.lean.y));
    this.seedHeads.forEach((h, i) => this.headState.setXYZ(i, h.shown, h.lean.x, h.lean.y));
    this.bedState.needsUpdate = this.headState.needsUpdate = true;
  }

  /** The bed's last sleepers come up all together, and petals lift off the whole of it. */
  private flourish(): void {
    for (let k = 0; k < 150; k++) {
      const f = this.flowers[Math.floor(this.rand() * this.flowers.length)];
      if (f.seen) this.shed(f.at, f.color, 2.2);
    }
  }

  private shed(at: THREE.Vector3, color: THREE.Color, lift: number): void {
    const i = this.nextPetal = (this.nextPetal + 1) % this.flurry.length, p = this.flurry[i];
    p.at.copy(at); p.at.y += .3;
    p.v.set((this.rand() - .5) * .8 + this.air.x * .08, lift * (.8 + this.rand() * .7), (this.rand() - .5) * .8 + this.air.y * .08);
    p.age = 0; p.life = 3.5 + this.rand() * 2; p.spin = this.rand() * 6;
    this.petals.setColorAt(i, color);
    this.petals.instanceColor!.needsUpdate = true;
  }

  private flutter(dt: number): void {
    let any = false;
    this.flurry.forEach((p, i) => {
      p.age += dt;
      const alive = p.age < p.life, flap = Math.sin(p.age * 5 + p.spin);
      any ||= alive;
      if (alive) {
        const k = 1 - Math.exp(-dt * 1.5);
        p.v.x += (this.air.x * .1 + flap * .35 - p.v.x) * k;
        p.v.y += (-.3 - p.v.y) * k * .6;
        p.v.z += (this.air.y * .1 + Math.cos(p.age * 3.7 + p.spin) * .35 - p.v.z) * k;
        p.at.addScaledVector(p.v, dt);
        p.at.y = Math.max(p.at.y, heightAt(p.at.x, p.at.z) + .15);
      }
      this.piece.position.copy(p.at);
      this.piece.rotation.set(p.age * 2.3 + p.spin, p.spin, flap * .6);
      this.piece.scale.setScalar(alive ? Math.min(1, p.age * 4, (p.life - p.age) * 1.5) * 1.7 : 0);
      this.piece.updateMatrix();
      this.petals.setMatrixAt(i, this.piece.matrix);
    });
    this.petals.visible = any;
    this.petals.instanceMatrix.needsUpdate = true;
  }

  /**
   * The released down drifts away from the lens over the land, turned `driftTurn` off the side the pond is on, so
   * the gaze that follows it never goes looking toward the family.
   */
  private aimDrift(camera: THREE.Camera): void {
    const ax = this.column.x - camera.position.x, az = this.column.z - camera.position.z, length = Math.hypot(ax, az);
    if (length < 1e-3) return;
    const toPond = new THREE.Vector2(POND.x - this.column.x, POND.z - this.column.z), centre = new THREE.Vector2();
    const [left, right] = [T.driftTurn, -T.driftTurn].map(turn => new THREE.Vector2(ax / length, az / length).rotateAround(centre, turn));
    this.away.copy(left.dot(toPond) < right.dot(toPond) ? left : right);
  }

  /** Down rides the column the player winds: drawn in, round and up, spilling out over the top. */
  private fly(dt: number, time: number): void {
    const s = this.seeds, done = s.completed >= 2, released = s.completed === 1 ? s.progress : done ? 1 : 0;
    const since = time - this.lastReceived;
    const after = done ? 1 - THREE.MathUtils.smoothstep(since, T.afterlift, T.afterlift + 4) : 0;
    const want = Math.max(this.effort, after);
    this.updraft += (want - this.updraft) * (1 - Math.exp(-dt * (want > this.updraft ? 1.8 : .4)));
    const c = this.column, ground = c.y - 1.3, driftX = this.away.x * T.drift, driftZ = this.away.y * T.drift;
    const top = done ? T.releaseTop : T.columnTop;
    let shown = 0, sx = 0, sy = 0, sz = 0, highest = 0;
    for (let i = 0; i < this.phase.length; i++) {
      if (this.phase[i] === 2) continue;
      const r = this.rnd[i], j = i * 3;
      if (this.phase[i] === 0) {
        if (s.completed !== 1 || released <= this.order[i]) continue;
        this.phase[i] = 1;
        this.pos.set(this.home.subarray(j, j + 3), j);
        this.vel.set([(this.home[j] - c.x) * .2, .6 + r * .6, (this.home[j + 2] - c.z) * .2], j);
      }
      let x = this.pos[j], y = this.pos[j + 1], z = this.pos[j + 2];
      const rx = x - c.x, rz = z - c.z, d = Math.max(Math.hypot(rx, rz), 1e-3), ux = rx / d, uz = rz / d, h = y - ground;
      const funnel = T.columnRadius + h * T.columnSpread + r * .9;
      const spill = THREE.MathUtils.smoothstep(h, top - 2 + r * 3, top + 1.5 + r * 3);
      // Drawn in low across the whole bed of heads, and only climbing once in the funnel: a cone of down, not a haze.
      const reach = this.updraft * (1 - THREE.MathUtils.smoothstep(d, funnel + 6, funnel + 15));
      const near = 1 - THREE.MathUtils.smoothstep(d, funnel, funnel * 2.5 + 1);
      const swirl = T.columnSwirl * (.6 + .8 * r) * (1 - .5 * spill) * (.35 + .65 * near) * this.turning;
      const inward = THREE.MathUtils.clamp((funnel - d) * .9, -2.5, 2) * (1 - spill) + spill * (1 + r);
      const cx = uz * swirl + ux * inward, cz = -ux * swirl + uz * inward;
      const cy = T.columnRise * (.7 + .6 * r) * (.2 + .8 * near) * (1 - spill) + .3 * spill;
      const wx = Math.sin(time * .7 + r * 40) * .3, wz = Math.cos(time * .53 + r * 23) * .3;
      let fx: number, fy: number, fz: number;
      if (done) {
        fx = driftX * (.6 + .7 * r) + wx; fz = driftZ * (.6 + .7 * r) + wz; fy = T.driftRise * (.5 + r);
      } else {
        const hover = 2.2 + r * 3, settle = T.hoverHeight + r * 2.5;
        fx = uz * .45 * this.turning + ux * (hover - d) * .25 + wx; fz = -ux * .45 * this.turning + uz * (hover - d) * .25 + wz;
        fy = Math.max(.04, (settle - h) * .35);
      }
      const k = 1 - Math.exp(-dt * (.9 + 1.6 * reach));
      this.vel[j] += (fx + (cx - fx) * reach - this.vel[j]) * k;
      this.vel[j + 1] += (fy + (cy - fy) * reach - this.vel[j + 1]) * k;
      this.vel[j + 2] += (fz + (cz - fz) * reach - this.vel[j + 2]) * k;
      x += this.vel[j] * dt; y += Math.max(0, this.vel[j + 1]) * dt; z += this.vel[j + 2] * dt;
      this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
      const fade = done ? 1 - THREE.MathUtils.smoothstep(since, T.downFade + r * 8, T.downFade + 6 + r * 8) : 1;
      if (fade <= 0) { this.phase[i] = 2; continue; }
      this.piece.position.set(x, y, z);
      this.piece.rotation.set(THREE.MathUtils.clamp(this.vel[j + 2] * .25, -.6, .6), time * (.3 + r) + r * 9, THREE.MathUtils.clamp(-this.vel[j] * .25, -.6, .6));
      this.piece.scale.setScalar(fade * Math.min(1, (y - this.home[j + 1]) * 3 + .3) * (1.3 + r * .6));
      this.piece.updateMatrix();
      this.down.setMatrixAt(shown++, this.piece.matrix);
      sx += x; sy += y; sz += z; highest = Math.max(highest, y);
    }
    this.down.count = shown;
    this.down.visible = shown > 0;
    this.down.instanceMatrix.needsUpdate = true;
    if (shown) {
      this.seed.lerp(this.mean.set(sx / shown, sy / shown, sz / shown), 1 - Math.exp(-dt * 1.5));
      this.crown.set(c.x, Math.min(highest, ground + top + 2), c.z);
    }
  }
}

export const meadowEchoes = new MeadowEchoes();

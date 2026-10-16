import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rabbits } from '../creatures/rabbits';
import type { Habitat } from '../creatures/habitat';
import type { Stimuli } from '../creatures/stimuli';
import { Voices } from '../creatures/voices';
import type { PointerInput } from '../input/pointer';
import type { WindField } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { grassHeightAt } from './grass';
import { SLEEP_OUTCROP, SLEEP_STEP } from './heightfield';
import { heightAt, slopeAt } from './island';
import { createNoise2D, mulberry32, smoothstep } from './noise';
import { SLEEP_TRICKLE, sleepPathAt } from './sleeping-layout';
import { SNOW_AT } from './sleeping-trail';

type Rand = () => number;
const range = (rand: Rand, lo: number, hi: number) => lo + (hi - lo) * rand();
const UP = new THREE.Vector3(0, 1, 0);
/** The night wind's way across the island (`main.ts` breeze), which the hawthorn has grown bent along. */
const DOWNWIND = new THREE.Vector2(Math.cos(-0.31), Math.sin(-0.31));
/** Bent nearly along the coast: the wind off the sea is turned by the hill before it reaches the slope. */
const LEAN = new THREE.Vector3(0.99, 0, -0.14).normalize();
const THORN = new THREE.Vector3(-158.6, 0, -1923.8);
/** Bare ground in the lee of the hawthorn's crown, where no tussock grows. */
const LEE = new THREE.Vector2(THORN.x + 0.8, THORN.z - 0.15);
/** The rabbit's form, under the hawthorn's crown on the side the climb passes, so no stem crosses it from the lens. */
const FORM = new THREE.Vector2(THORN.x + 0.6, THORN.z + 0.7);
/** Lying side-on to the lens on the lower slope, so it reads as a loaf with its ears along its back. */
const FORM_FACING = 0.6;
const RABBIT_SIZE = 0.4;
/** Seconds the morning may lie on the rabbit unseen before it wakes anyway. */
const WAKE_UNSEEN = 30;
const asleep = () => 0;

const BANK_U = new THREE.Vector2(SLEEP_STEP.ux, SLEEP_STEP.uz);
const BANK_V = new THREE.Vector2(-SLEEP_STEP.uz, SLEEP_STEP.ux);
/** Where the bank's riser is at its middle, `along` its uphill axis, for a point `across` it (the heightfield's lip). */
const lipAlong = (across: number) => 0.3 * Math.sin(across * 0.9 + 0.6) + 0.05 * across * across;
function bankPoint(across: number, along: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = lipAlong(across) + along;
  out.set(SLEEP_STEP.x + BANK_U.x * a + BANK_V.x * across, 0, SLEEP_STEP.z + BANK_U.y * a + BANK_V.y * across);
  out.y = heightAt(out.x, out.z);
  return out;
}

/** Stone, turf and bark all take the same light; `info` is (frost it holds, how far it bends, a thin blade lit through). */
const PLANT_VERT = /* glsl */ `
${ATMO_GLSL}
uniform float uGust;
in vec3 color;
in vec3 aInfo;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec3 vInfo;
void main() {
  vec3 p = position;
  float wave = sin(uTime * 1.7 + p.x * 0.9 + p.z * 0.6) * 0.5 + 0.5;
  p.xz += vec2(${DOWNWIND.x.toFixed(4)}, ${DOWNWIND.y.toFixed(4)}) * aInfo.y * (0.25 + 0.75 * wave) * (0.05 + 0.16 * uGust);
  vWorld = p;
  vNormal = normal;
  vColor = color;
  vInfo = aInfo;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const PLANT_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec3 vInfo;
void main() {
  vec3 n = normalize(vNormal);
  bool thin = vInfo.z > 0.5;
  if (!gl_FrontFacing && !thin) n = -n;
  float ndl = dot(n, uSunDir);
  float frost = frostAt(vWorld.xz) * vInfo.x * smoothstep(-0.15, 0.7, thin ? 0.8 : n.y);
  float grain = 0.9 + 0.2 * vnoise(vWorld.xz * 9.0 + vWorld.y * 7.0);
  vec3 alb = mix(vColor * grain, vec3(0.8, 0.86, 0.93), frost * 0.88);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  float lit = thin ? 0.35 + 0.45 * abs(ndl) : max(ndl, 0.0) * 0.8 + max(ndl * 0.5 + 0.5, 0.0) * 0.2;
  float ao = mix(0.6, 1.0, smoothstep(0.0, 0.5, vWorld.y - texture(uHeightTex, domainUv(vWorld.xz)).r));
  vec3 col = alb * (hemiLight(thin ? vec3(0.0, 1.0, 0.0) : n) * ao * 1.15 + uSunColor * lit * sun + lampLight(vWorld, n) + dawnLight(vWorld, n));
  col *= mix(vec3(1.0), vec3(0.86, 0.97, 1.2), (1.0 - max(ndl, 0.0) * sun) * 0.5);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const ROCK_VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vWorld = position;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

/** The island's rock (`rocks.ts`) in winter: frost lodged on every ledge, lichen in the shelter, cracks the frost opened. */
const ROCK_FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uStone;
uniform vec3 uLichen;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  float grain = vnoise(vWorld.xz * 2.1 + vWorld.y * 1.3) * 0.6 + vnoise(vWorld.xy * 5.0) * 0.4;
  float strata = sin(vWorld.y * 7.0 + vnoise(vWorld.xz * 0.6) * 4.0) * 0.5 + 0.5;
  vec3 alb = uStone * (0.72 + 0.38 * grain) * (0.9 + 0.14 * strata);
  float lichen = smoothstep(0.62, 0.74, vnoise(vWorld.xz * 3.3 + vWorld.y * 2.7)) * smoothstep(-0.3, 0.4, n.y);
  alb = mix(alb, uLichen * (0.85 + 0.3 * grain), lichen * 0.55);
  float crack = 1.0 - smoothstep(0.0, 0.02, abs(vnoise(vWorld.xz * 1.7 + vWorld.y * 0.8) - 0.5));
  alb *= 1.0 - crack * smoothstep(0.55, 0.7, vnoise(vWorld.xz * 0.9 + 3.0)) * 0.35;
  float lodged = smoothstep(0.15, 0.7, n.y + (grain - 0.5) * 0.35);
  float rime = max(0.0, dot(n.xz, -vec2(${DOWNWIND.x.toFixed(4)}, ${DOWNWIND.y.toFixed(4)}))) * 0.35;
  float frost = frostAt(vWorld.xz) * min(1.0, lodged + rime);
  alb = mix(alb, vec3(0.8, 0.86, 0.93), frost * 0.9);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  float ao = mix(0.5, 1.0, smoothstep(0.0, 1.2, vWorld.y - texture(uHeightTex, domainUv(vWorld.xz)).r));
  vec3 col = alb * (hemiLight(n) * ao + uSunColor * mix(ndl, wrap, 0.25) * sun + lampLight(vWorld, n) + dawnLight(vWorld, n));
  col *= mix(vec3(1.0), vec3(0.86, 0.97, 1.22), (1.0 - ndl * sun) * 0.75);
  float rim = pow(1.0 - clamp(dot(n, normalize(cameraPosition - vWorld)), 0.0, 1.0), 4.0);
  col += uSunColor * rim * 0.12 * sun * max(dot(-normalize(cameraPosition - vWorld), uSunDir), 0.0);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** Ground marks: sheep trods darken what lies under them (kind 0); the trickle is ice (kind 1). */
const MARK_VERT = /* glsl */ `
in vec3 aMark;
out vec3 vWorld;
out vec3 vMark;
void main() {
  vWorld = position;
  vMark = aMark;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const TROD_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vMark;
void main() {
  float across = abs(vMark.x);
  float edge = 1.0 - smoothstep(0.1 + 0.3 * vnoise(vWorld.xz * 3.0), 1.0, across);
  float worn = edge * vMark.z * (0.75 + 0.25 * vnoise(vWorld.xz * 1.7));
  vec3 tint = mix(vec3(1.0), vec3(0.52, 0.54, 0.6), worn * (0.55 + 0.45 * frostAt(vWorld.xz)));
  gl_FragColor = vec4(mix(tint, vec3(1.0), fogOf(vWorld).a), 1.0);
}`;

const ICE_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vMark;
void main() {
  float across = abs(vMark.x);
  // Matt and no paler than the frost round it, so the rill reads as a seam in the hillside rather than a drawn line.
  float rimed = max(smoothstep(0.35, 0.9, across), 0.7 * smoothstep(0.4, 0.75, vnoise(vec2(vMark.y * 1.6, across * 2.0) + 3.1)));
  vec3 alb = mix(vec3(0.2, 0.26, 0.34), vec3(0.8, 0.86, 0.93) * 0.75, rimed) * (0.92 + 0.12 * vnoise(vWorld.xz * 9.0));
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 col = alb * (hemiLight(n) + uSunColor * max(uSunDir.y, 0.0) * cloudShadow(vWorld.xz) * 0.8 + lampLight(vWorld, n) + dawnLight(vWorld, n));
  float alpha = 1.0 - smoothstep(0.7, 1.0, across);
  gl_FragColor = vec4(applyFog(col, vWorld), alpha * vMark.z);
}`;

/** One merged mesh of parts carrying a colour per vertex and the plant shader's `info`. */
class Batch {
  private readonly parts: THREE.BufferGeometry[] = [];

  /** `color` may be left out when the geometry is already painted. */
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation | ((p: THREE.Vector3) => THREE.Color) | null, info: readonly number[]): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count, colors = new Float32Array(count * 3), infos = new Float32Array(count * 3);
    const fixed = typeof color === 'function' || color === null ? null : new THREE.Color(color);
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      infos.set(info, i * 3);
      if (color === null) continue;
      const c = fixed ?? (color as (p: THREE.Vector3) => THREE.Color)(p.fromBufferAttribute(g.attributes.position as THREE.BufferAttribute, i));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    if (color !== null) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(infos, 3));
    this.parts.push(g);
  }

  /** A blade or sprig whose sway grows toward its tip. */
  addBent(geo: THREE.BufferGeometry, color: (p: THREE.Vector3, t: number) => THREE.Color, frost: number, root: THREE.Vector3, reach: number, bend: number, thin: number): void {
    this.add(geo, (p) => color(p, Math.min(1, p.distanceTo(root) / reach)), [frost, 0, thin]);
    const g = this.parts[this.parts.length - 1], pos = g.attributes.position as THREE.BufferAttribute, info = g.attributes.aInfo as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, p.fromBufferAttribute(pos, i).distanceTo(root) / reach);
      info.setXY(i, frost * (thin ? 0.3 + 0.7 * t : 1), bend * t * t);
    }
  }

  build(): THREE.BufferGeometry {
    return mergeGeometries(this.parts);
  }
}

/** A tapering tube bowed by `lift` at its middle, as the drowned village grows its limbs. */
function limb(a: THREE.Vector3, b: THREE.Vector3, lift: THREE.Vector3, r0: number, r1: number, radial: number, segments: number): THREE.BufferGeometry {
  const curve = new THREE.QuadraticBezierCurve3(a.clone(), a.clone().lerp(b, 0.5).add(lift), b.clone());
  const frames = curve.computeFrenetFrames(segments, false);
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, p);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(i / segments, 0.75));
    for (let k = 0; k <= radial; k++) {
      const ang = (k / radial) * Math.PI * 2;
      n.copy(frames.normals[i]).multiplyScalar(Math.cos(ang)).addScaledVector(frames.binormals[i], Math.sin(ang));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nrm.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < segments; i++)
    for (let k = 0; k < radial; k++) {
      const q = i * (radial + 1) + k;
      idx.push(q, q + 1, q + radial + 1, q + radial + 1, q + 1, q + radial + 2);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  return geo;
}

/** A thin curved blade from `root`, leaning out along `out`, `length` long; its normal faces the sky. */
function blade(root: THREE.Vector3, out: THREE.Vector3, length: number, width: number, droop: number): THREE.BufferGeometry {
  const side = new THREE.Vector3().crossVectors(out, UP).normalize();
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  const steps = 3, p = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, w = width * (1 - t * 0.92);
    p.copy(root).addScaledVector(out, length * t).addScaledVector(UP, -droop * t * t * length);
    pos.push(p.x - side.x * w, p.y, p.z - side.z * w, p.x + side.x * w, p.y, p.z + side.z * w);
    nrm.push(0, 1, 0, 0, 1, 0);
  }
  for (let i = 0; i < steps; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  return geo;
}

/**
 * Weathered rock that frost has split: a lumpy boulder (`rocks.ts`) cut by a few fracture planes, so it shows flat
 * broken faces between its rounded weathered ones.
 */
function shattered(rand: Rand, detail: number, split: number): THREE.BufferGeometry {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const noise = createNoise2D(Math.floor(rand() * 1e6));
  const cuts = Array.from({ length: 4 + Math.floor(rand() * 4) }, () => {
    const a = rand() * Math.PI * 2, tilt = range(rand, -0.35, 0.9);
    return { n: new THREE.Vector3(Math.cos(a) * Math.cos(tilt), Math.sin(tilt), Math.sin(a) * Math.cos(tilt)), d: range(rand, 0.42, 0.78) };
  });
  const pos = geo.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + noise(v.x * 1.3 + v.y * 0.7, v.z * 1.3 - v.y * 0.5) * 0.2 + noise(v.x * 3.4, v.z * 3.4 + v.y) * 0.06);
    for (const c of cuts) {
      const k = v.dot(c.n);
      if (k > c.d) v.addScaledVector(c.n, -(k - c.d) * split);
    }
    if (v.y < -0.45) v.y = -0.45 + (v.y + 0.45) * 0.5;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Sets a rock into the slope at (x, z) half buried, tipped with the ground, and returns its geometry in place. */
function setRock(rand: Rand, x: number, z: number, size: THREE.Vector3, bury: number, detail = 3): THREE.BufferGeometry {
  const geo = shattered(rand, detail, size.y > 0.4 ? 0.45 : 0.8);
  const r = Math.max(size.x, size.z);
  let low = heightAt(x, z), sum = low;
  for (let i = 0; i < 4; i++) {
    const h = heightAt(x + Math.cos(i * 1.57) * r * 0.8, z + Math.sin(i * 1.57) * r * 0.8);
    low = Math.min(low, h);
    sum += h;
  }
  const gx = (heightAt(x + 0.3, z) - heightAt(x - 0.3, z)) / 0.6, gz = (heightAt(x, z + 0.3) - heightAt(x, z - 0.3)) / 0.6;
  const tilt = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(-gx, 1.6, -gz).normalize());
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, Math.min(sum / 5 - size.y * bury, low + size.y * 0.25), z),
    tilt.multiply(new THREE.Quaternion().setFromAxisAngle(UP, rand() * Math.PI * 2)),
    size,
  );
  return geo.applyMatrix4(m);
}

/** 1 on the drift's ground, which the drift's own module dresses. */
function inDrift(x: number, z: number): number {
  const dx = x - SNOW_AT.x, dz = z - SNOW_AT.z;
  return (dx / 4.2) ** 2 + (dz / 3.7) ** 2;
}

/** The morning on the hill (atmosphere's `morningAt`), read back from the same uniforms. */
function morningAt(x: number, z: number): number {
  const u = atmo.uniforms, dawn = u.uDawn.value.x, lane = u.uLane.value, open = u.uLaneOpen.value;
  if (dawn <= 0.12) return 0;
  let along = 0;
  if (open.y > 0) {
    const abx = lane.z - lane.x, abz = lane.w - lane.y;
    const t = Math.max(0, Math.min(1, ((x - lane.x) * abx + (z - lane.y) * abz) / Math.max(abx * abx + abz * abz, 1e-4)));
    const d = Math.hypot(x - lane.x - abx * t, z - lane.y - abz * t);
    along = (1 - smoothstep(open.x * 0.45, open.x, d)) * (1 - smoothstep(open.y - 0.08, open.y + 0.08, t));
  }
  const spread = smoothstep(0.55, 1, dawn), radius = spread * 110;
  const island = spread * (1 - smoothstep(radius - 10, radius + 10, Math.hypot(x - lane.x, z - lane.y)));
  return Math.max(along * u.uDawnSource.value.w, island);
}

/**
 * The hillside at the bird's scale: the outcrop by the notch and the rock lip of the step's bank with its turf curled
 * over, frost-split stones, frosted tussocks and heather, sheep trods across the steep face, the frozen trickle, and a
 * lone wind-bent hawthorn with a rabbit asleep under it. Nothing in it lines the bird's way.
 */
export class SleepingDressing {
  readonly objects: THREE.Object3D[] = [];
  private readonly gust = { value: 0 };
  private readonly rabbits: Rabbits;
  private readonly stimuli: Stimuli;
  /** How long the morning has lain on the form: the rabbit waits a while to wake where it can be watched. */
  private unwatched = 0;
  private readonly form = new THREE.Vector3();

  constructor(wind: WindField, private readonly input: PointerInput, private readonly bed: THREE.Vector3, private readonly window: THREE.Vector3) {
    const rocks: THREE.BufferGeometry[] = [], plants = new Batch();
    const rand = mulberry32(73311);
    this.outcrop(rand, rocks);
    this.bank(rand, rocks, plants);
    this.stones(rand, rocks);
    this.thorn(rand, plants);
    this.tussocks(rand, plants);
    this.heather(rand, plants);

    const rockMesh = new THREE.Mesh(mergeGeometries(rocks.map((g) => (g.index ? g.toNonIndexed() : g))), new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uStone: { value: new THREE.Color('#958d83') }, uLichen: { value: new THREE.Color('#a5a68e') } },
      vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG,
    }));
    const plantMesh = new THREE.Mesh(plants.build(), new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uGust: this.gust }, vertexShader: PLANT_VERT, fragmentShader: PLANT_FRAG, side: THREE.DoubleSide,
    }));
    const trods = new THREE.Mesh(this.trods(rand), new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms }, vertexShader: MARK_VERT, fragmentShader: TROD_FRAG, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
    }));
    const ice = new THREE.Mesh(this.trickle(rand, rocks), new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms }, vertexShader: MARK_VERT, fragmentShader: ICE_FRAG, transparent: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
    }));
    for (const m of [rockMesh, plantMesh, trods, ice]) m.frustumCulled = false;
    this.objects.push(rockMesh, plantMesh, trods, ice);

    const habitat: Habitat = {
      ground: heightAt,
      grassHeight: grassHeightAt,
      meadow: (x, z) => heightAt(x, z) > 3 && slopeAt(x, z) < 0.75 && Math.hypot(x - bed.x, z - bed.z) > 7,
      forage: () => false,
      flowers: [],
      perches: [],
      treeBase: new THREE.Vector3(0, 1e4, 0),
      canopy: [],
    };
    this.rabbits = new Rabbits(habitat, 1, RABBIT_SIZE);
    this.rabbits.addSleeper(FORM.x, FORM.y, FORM_FACING, 90413);
    this.objects.push(this.rabbits.mesh);
    this.stimuli = {
      wind, sample: { x: 0, z: 0, energy: 0, lift: 0 }, camera: new THREE.PerspectiveCamera(), input, gustAt: null,
      updraft: { x: 0, z: 0, strength: 0 }, glider: null, walker: null, life: asleep, breeze: 1, night: 1, voices: new Voices(),
    };
    this.form.set(FORM.x, heightAt(FORM.x, FORM.y) + 0.2, FORM.y);
  }

  update(dt: number, time: number, camera: THREE.Camera, gust: number): void {
    this.gust.value = gust;
    const s = this.stimuli;
    s.camera = camera;
    s.gustAt = this.input.present && this.input.gust > 4 ? this.input.world : null;
    if (s.life === asleep) {
      const on = this.form.clone().project(camera);
      const watched = on.z < 1 && Math.abs(on.x) < 0.85 && Math.abs(on.y) < 0.85;
      this.unwatched = morningAt(this.form.x, this.form.z) > 0.75 ? this.unwatched + dt : 0;
      if ((watched && this.unwatched > 0) || this.unwatched > WAKE_UNSEEN) s.life = morningAt;
    }
    this.rabbits.update(dt, time, s);
  }

  /** Tall things keep clear of the bird's way, the bed's terrace and the light's way down from the window. */
  private open(x: number, z: number, clearance: number): boolean {
    if (heightAt(x, z) < 2.5 || sleepPathAt(x, z).distance < clearance || inDrift(x, z) < 1.1) return false;
    if (Math.hypot(x - this.bed.x, z - this.bed.z) < 9) return false;
    const ax = this.window.x, az = this.window.z, bx = this.bed.x - ax, bz = this.bed.z - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz)));
    if (Math.hypot(x - ax - bx * t, z - az - bz * t) < clearance + 1.5) return false;
    const across = (x - SLEEP_STEP.x) * BANK_V.x + (z - SLEEP_STEP.z) * BANK_V.y, along = (x - SLEEP_STEP.x) * BANK_U.x + (z - SLEEP_STEP.z) * BANK_U.y;
    return !(Math.abs(across) < 4.5 && Math.abs(along - lipAlong(across)) < 1.3);
  }

  /** A little tor on the knoll by the notch: two blocks split apart, a slab leaning off them, frost-broken clitter below. */
  private outcrop(rand: Rand, rocks: THREE.BufferGeometry[]): void {
    const o = SLEEP_OUTCROP;
    rocks.push(setRock(rand, o.x - 0.15, o.z - 0.1, new THREE.Vector3(0.95, 0.85, 0.75), 0.3));
    rocks.push(setRock(rand, o.x - 0.95, o.z + 0.55, new THREE.Vector3(0.65, 0.7, 0.55), 0.35));
    rocks.push(setRock(rand, o.x + 0.55, o.z - 0.95, new THREE.Vector3(0.5, 0.42, 0.62), 0.4));
    rocks.push(setRock(rand, o.x - 0.6, o.z - 1.1, new THREE.Vector3(0.38, 0.3, 0.42), 0.4));
    for (let i = 0, made = 0; i < 40 && made < 9; i++) {
      const a = range(rand, 0.6, 2.6), d = range(rand, 1.4, 3.4);
      const x = o.x + Math.cos(a) * d - 0.8, z = o.z + Math.sin(a) * d;
      if (sleepPathAt(x, z).distance < 1.3 || inDrift(x, z) < 1.05) continue;
      const s = range(rand, 0.1, 0.28);
      rocks.push(setRock(rand, x, z, new THREE.Vector3(s, s * range(rand, 0.5, 0.8), s * range(rand, 0.7, 1.1)), 0.35, 2));
      made++;
    }
  }

  /**
   * The step's bank: a band of bedded rock in its riser, standing proud of the turf below it and steeper than the slope,
   * buried again at its ends, with the bank's turf curling over its top and hanging in a ragged fringe.
   */
  private bank(rand: Rand, rocks: THREE.BufferGeometry[], plants: Batch): void {
    const noise = createNoise2D(5511), wide = 3.4, ns = 72, nt = 26;
    const blocks = Array.from({ length: 5 }, () => Array.from({ length: 12 }, () => range(rand, -0.06, 0.08)));
    const joints = Array.from({ length: 5 }, () => range(rand, 0, 1));
    const pos: number[] = [], idx: number[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i <= ns; i++) {
      const s = -wide + (2 * wide * i) / ns;
      for (let j = 0; j <= nt; j++) {
        const t = j / nt;
        bankPoint(s, THREE.MathUtils.lerp(-0.34, 0.27, t), p);
        const course = Math.max(0, Math.min(4, Math.floor(t * 4.6 + 0.35 * noise(s * 0.5, 3))));
        const block = blocks[course][Math.floor((s + wide) / 0.62 + joints[course] * 3) % 12];
        const bedding = smoothstep(0.78, 1, (t * 4.6 + 0.35 * noise(s * 0.5, 3)) % 1);
        const end = 2.15 + 0.5 * noise(t * 2.2, s > 0 ? 7 : 11);
        const slump = 1 - smoothstep(0.12, 0.42, Math.abs(s - 1.45 - 0.25 * noise(t * 3, 5)));
        const shown = (1 - smoothstep(end - 0.6, end + 0.15, Math.abs(s))) * smoothstep(0.08, 0.3, t) * (1 - 0.9 * slump);
        const proud = THREE.MathUtils.lerp(-0.12, -0.07 + 0.26 * smoothstep(0.25, 0.95, t) + block * smoothstep(0.25, 0.55, t) - bedding * 0.09 + 0.025 * noise(s * 4, t * 6), shown);
        pos.push(p.x - BANK_U.x * proud, p.y - 0.03 * bedding, p.z - BANK_U.y * proud);
      }
    }
    for (let i = 0; i < ns; i++)
      for (let j = 0; j < nt; j++) {
        const q = i * (nt + 1) + j;
        idx.push(q, q + nt + 1, q + 1, q + 1, q + nt + 1, q + nt + 2);
      }
    const face = new THREE.BufferGeometry();
    face.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    face.setIndex(idx);
    face.computeVertexNormals();
    rocks.push(face);
    for (const s of [-2.55, 2.3]) {
      const at = bankPoint(s, -0.2);
      rocks.push(setRock(rand, at.x - BANK_U.x * 0.2, at.z - BANK_U.y * 0.2, new THREE.Vector3(0.32, 0.26, 0.3), 0.35, 2));
    }

    const grass = new THREE.Color(0.36, 0.37, 0.27), peat = new THREE.Color(0.2, 0.15, 0.11);
    const profile: [number, number, number][] = [[0.75, 0, 0], [0.42, 0.06, 0], [0.2, 0.07, 0], [0.06, 0.02, 0.2], [0.0, -0.08, 0.6], [0.04, -0.15, 1], [0.24, -0.17, 1]];
    const cap: number[] = [], capIdx: number[] = [], capColor: number[] = [];
    const nc = 72, top = new THREE.Vector3(), ground = new THREE.Vector3();
    for (let i = 0; i <= nc; i++) {
      const s = -3.9 + (7.8 * i) / nc;
      const curl = 1 - smoothstep(2.4, 3.8, Math.abs(s));
      const ragged = 0.05 * noise(s * 2.3, 21) + 0.03 * noise(s * 7, 4);
      bankPoint(s, 0.3, top);
      for (const [a, dy, dark] of profile) {
        bankPoint(s, a + ragged * (a < 0.3 ? 1 : 0), ground);
        const y = THREE.MathUtils.lerp(ground.y + 0.015 - (dark > 0.5 ? 0.06 : 0), top.y + dy + ragged * 0.4, curl * (a < 0.6 ? 1 : 0.4));
        cap.push(ground.x, y, ground.z);
        const c = grass.clone().lerp(peat, dark);
        capColor.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < nc; i++)
      for (let j = 0; j < profile.length - 1; j++) {
        const q = i * profile.length + j;
        capIdx.push(q, q + 1, q + profile.length, q + 1, q + profile.length + 1, q + profile.length);
      }
    const capGeo = new THREE.BufferGeometry();
    capGeo.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3));
    capGeo.setAttribute('color', new THREE.Float32BufferAttribute(capColor, 3));
    capGeo.setIndex(capIdx);
    capGeo.computeVertexNormals();
    plants.add(capGeo, null, [1, 0, 0]);

    const straw = (_: THREE.Vector3, t: number) => new THREE.Color(0.33, 0.3, 0.2).lerp(new THREE.Color(0.62, 0.57, 0.42), t);
    const edge = new THREE.Vector3(), out = new THREE.Vector3();
    for (let i = 0; i < 230; i++) {
      const s = range(rand, -3.3, 3.3), curl = 1 - smoothstep(2.3, 3.5, Math.abs(s));
      if (rand() > curl) continue;
      bankPoint(s, 0.02 + 0.05 * noise(s * 2.3, 21), edge);
      bankPoint(s, 0.3, top);
      edge.y = top.y - 0.06 + 0.04 * noise(s * 2.3, 21);
      out.set(-BANK_U.x * range(rand, 0.25, 0.7), -1, -BANK_U.y * range(rand, 0.25, 0.7)).add(new THREE.Vector3(range(rand, -0.3, 0.3), 0, range(rand, -0.3, 0.3))).normalize();
      plants.addBent(blade(edge, out, range(rand, 0.1, 0.3), range(rand, 0.008, 0.016), -0.2), straw, 0.6, edge.clone(), 0.3, 0.25, 1);
    }
    for (let i = 0; i < 28; i++) {
      const s = range(rand, -2.1, 2.1);
      bankPoint(s, 0.0, edge);
      bankPoint(s, 0.3, top);
      edge.y = top.y - 0.12;
      const len = range(rand, 0.05, 0.17);
      const cone = new THREE.ConeGeometry(range(rand, 0.008, 0.016), len, 4).rotateX(Math.PI).translate(edge.x, edge.y - len / 2, edge.z);
      plants.add(cone, '#b7c6d4', [0.4, 0, 0]);
    }
  }

  /** Frost-split stones lying half sunk in the turf: a few gatherings, mostly small, and long stretches of none. */
  private stones(rand: Rand, rocks: THREE.BufferGeometry[]): void {
    const sites: [number, number, number][] = [[-185, -1928, 1.1], [-159, -1944, 2.1], [-172, -1949, 1.8], [-186, -1945, 2.7], [-168, -1932, 1.2], [-162.2, -1926.6, 0.7], [-147.6, -1933.5, 0.9]];
    for (const [cx, cz, size] of sites) {
      const n = 2 + Math.floor(rand() * 4);
      for (let j = 0; j < n; j++) {
        const x = cx + range(rand, -1, 1) * size * 1.4, z = cz + range(rand, -1, 1) * size;
        if (!this.open(x, z, 1.8)) continue;
        const s = size * (j === 0 ? 0.55 : range(rand, 0.15, 0.4));
        rocks.push(setRock(rand, x, z, new THREE.Vector3(s, s * range(rand, 0.65, 0.95), s * range(rand, 0.6, 1)), range(rand, 0.25, 0.45), s > 0.4 ? 3 : 2));
      }
    }
    for (let i = 0, made = 0; i < 300 && made < 34; i++) {
      const x = range(rand, -195, -142), z = range(rand, -1950, -1915);
      if (!this.open(x, z, 1.3)) continue;
      const s = range(rand, 0.07, 0.2);
      rocks.push(setRock(rand, x, z, new THREE.Vector3(s, s * range(rand, 0.75, 1), s * range(rand, 0.7, 1.2)), 0.3, 1));
      made++;
    }
  }

  /** The lone hawthorn: a short gnarled trunk bent downwind, its crown combed flat and streaming the same way, a few haws left. */
  private thorn(rand: Rand, plants: Batch): void {
    const base = THORN.clone().setY(heightAt(THORN.x, THORN.z) - 0.1);
    const side = new THREE.Vector3().crossVectors(LEAN, UP).normalize();
    const bark = new THREE.Color('#3a322d'), reach = 2.4;
    const crownTop = (p: THREE.Vector3) => base.y + 2.2 - 0.28 * Math.max(0, p.clone().sub(base).dot(LEAN));
    const tube = (a: THREE.Vector3, b: THREE.Vector3, lift: THREE.Vector3, r0: number, r1: number, radial: number, segs: number) =>
      plants.addBent(limb(a, b, lift, r0, r1, radial, segs), () => bark, 0.4, base, reach, 0.3, 0);
    const up = (y: number) => new THREE.Vector3(0, y, 0);
    const knee = base.clone().addScaledVector(LEAN, 0.3).addScaledVector(side, -0.08).add(up(0.75));
    const fork = knee.clone().addScaledVector(LEAN, 0.55).addScaledVector(side, 0.1).add(up(0.42));
    tube(base, knee, LEAN.clone().multiplyScalar(-0.14).addScaledVector(side, 0.06), 0.1, 0.075, 7, 6);
    tube(knee, fork, LEAN.clone().multiplyScalar(-0.07).add(up(0.06)), 0.075, 0.055, 6, 4);
    const stem = base.clone().addScaledVector(LEAN, 0.5).addScaledVector(side, 0.32).add(up(0.62));
    tube(base.clone().addScaledVector(side, 0.07), stem, side.clone().multiplyScalar(0.07).add(LEAN.clone().multiplyScalar(-0.08)), 0.065, 0.04, 6, 5);
    const end = new THREE.Vector3(), mid = new THREE.Vector3(), tip = new THREE.Vector3();
    const twig = (from: THREE.Vector3, dir: THREE.Vector3, length: number, r0: number) => {
      end.copy(from).addScaledVector(dir, length);
      end.y = Math.min(end.y, crownTop(end) + range(rand, -0.12, 0.04));
      tube(from, end, up(range(rand, -0.04, 0.05)).addScaledVector(side, range(rand, -0.04, 0.04)), r0, r0 * 0.35, 3, 2);
      return end.clone();
    };
    const sprout = (along: THREE.Vector3, spread: number, lift: number) =>
      along.clone().multiplyScalar(range(rand, 0.5, 1)).addScaledVector(side, range(rand, -spread, spread)).add(up(range(rand, -0.3, lift))).normalize();
    for (let i = 0; i < 11; i++) {
      const from = (i < 6 ? fork : i < 9 ? knee : stem).clone();
      const dir = LEAN.clone().multiplyScalar(range(rand, 0.5, 1)).addScaledVector(side, range(rand, -0.75, 0.75)).add(up(range(rand, 0.1, 0.5))).normalize();
      mid.copy(from).addScaledVector(dir, range(rand, 0.7, 1.45));
      mid.y = Math.min(mid.y, crownTop(mid));
      tube(from, mid, up(0.1).addScaledVector(side, range(rand, -0.08, 0.08)), 0.04, 0.018, 5, 4);
      for (let k = 0; k < 8; k++) {
        tip.copy(from).lerp(mid, range(rand, 0.3, 1));
        const shoot = twig(tip, sprout(dir, 1.2, 0.5), range(rand, 0.25, 0.55), 0.016);
        for (let j = 0; j < 5; j++) {
          const small = twig(shoot.clone().lerp(tip, range(rand, 0, 0.6)), sprout(dir, 1.5, 0.7), range(rand, 0.1, 0.26), 0.008);
          if (rand() < 0.22)
            for (let h = 0; h < 3; h++)
              plants.add(new THREE.SphereGeometry(0.018, 5, 4).translate(small.x + range(rand, -0.03, 0.03), small.y - range(rand, 0, 0.04), small.z + range(rand, -0.03, 0.03)), '#6a1d1b', [0.2, 0, 0]);
        }
      }
    }
    for (let i = 0; i < 4; i++) twig(knee.clone().lerp(base, range(rand, 0, 0.4)), LEAN.clone().negate().addScaledVector(side, range(rand, -0.9, 0.9)).add(up(0.35)).normalize(), range(rand, 0.15, 0.32), 0.018);
  }

  /** A clump of last year's grass: a dark matted heart and long pale blades falling over it, the wind's way most. */
  private tussock(rand: Rand, plants: Batch, x: number, z: number, scale: number): void {
    const y = heightAt(x, z), root = new THREE.Vector3(x, y - 0.02, z), out = new THREE.Vector3();
    const tone = range(rand, 0, 1);
    const straw = (_: THREE.Vector3, t: number) => new THREE.Color(0.2, 0.19, 0.13).lerp(new THREE.Color(0.62 + tone * 0.08, 0.55 + tone * 0.05, 0.38), Math.min(1, t * 1.3));
    const heart = mergeVertices(new THREE.IcosahedronGeometry(1, 1).deleteAttribute('normal').deleteAttribute('uv')).scale(0.08 * scale, 0.06 * scale, 0.08 * scale).translate(x, y, z);
    heart.computeVertexNormals();
    plants.add(heart, new THREE.Color(0.25, 0.23, 0.16), [0.5, 0, 0]);
    const count = 26 + Math.floor(rand() * 14);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, lean = range(rand, 0.15, 0.7);
      out.set(Math.cos(a) * lean + DOWNWIND.x * 0.4, 1, Math.sin(a) * lean + DOWNWIND.y * 0.4).normalize();
      const from = root.clone().add(new THREE.Vector3(Math.cos(a) * 0.06 * scale, 0, Math.sin(a) * 0.06 * scale));
      const length = range(rand, 0.28, 0.5) * scale;
      plants.addBent(blade(from, out, length, range(rand, 0.014, 0.022) * scale, range(rand, 0.12, 0.45)), straw, 0.75, root, length, 0.8, 1);
    }
  }

  /** Tussocks gather where the turf is rough: in clumps along the slopes, a few singly, none on the bird's way. */
  private tussocks(rand: Rand, plants: Batch): void {
    const sites: [number, number][] = [[-157.2, -1923.4], [-161.8, -1923.2], [-163, -1916.6], [-166.5, -1923], [-156, -1915.6], [-148, -1918], [-146.6, -1924], [-147.5, -1929.5], [-152.2, -1935.2], [-157, -1938.4], [-162.4, -1940.4], [-166, -1934], [-160, -1931.5], [-183, -1925.5], [-188, -1932], [-172.5, -1945], [-167.5, -1942.5], [-185, -1918]];
    for (const [cx, cz] of sites) {
      const n = 3 + Math.floor(rand() * 5);
      for (let j = 0; j < n; j++) {
        const x = cx + range(rand, -1.6, 1.6), z = cz + range(rand, -1.2, 1.2);
        if (!this.open(x, z, 1.1) || Math.hypot(x - THORN.x, z - THORN.z) < 0.5 || Math.hypot(x - LEE.x, z - LEE.y) < 0.45) continue;
        this.tussock(rand, plants, x, z, range(rand, 0.85, 1.4));
      }
    }
  }

  /** Low dark mounds of heather, frost on their tops, mostly up on the drier back of the hill. */
  private heather(rand: Rand, plants: Batch): void {
    const sites: [number, number][] = [[-160.5, -1928.6], [-164, -1931], [-150, -1937.4], [-170, -1946], [-178, -1947], [-189, -1938], [-182, -1932], [-158.6, -1940.6]];
    const shade = () => new THREE.Color('#2f2329').lerp(new THREE.Color('#4a3c2c'), rand());
    for (const [cx, cz] of sites) {
      const n = 2 + Math.floor(rand() * 4);
      for (let j = 0; j < n; j++) {
        const x = cx + range(rand, -1.5, 1.5), z = cz + range(rand, -1.2, 1.2);
        if (!this.open(x, z, 1.2)) continue;
        const w = range(rand, 0.22, 0.42), h = w * range(rand, 0.45, 0.65), y = heightAt(x, z);
        const dome = mergeVertices(new THREE.IcosahedronGeometry(1, 2).deleteAttribute('normal').deleteAttribute('uv')).scale(w, h, w * range(rand, 0.8, 1.1)).translate(x, y - h * 0.15, z);
        const dp = dome.attributes.position as THREE.BufferAttribute;
        for (let v = 0; v < dp.count; v++) dp.setY(v, Math.max(dp.getY(v), y - 0.05) + range(rand, -0.02, 0.02));
        dome.computeVertexNormals();
        const tint = shade();
        plants.add(dome, tint, [0.9, 0, 0]);
        const root = new THREE.Vector3(x, y, z);
        for (let k = 0; k < 26; k++) {
          const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * w * 0.9;
          const from = new THREE.Vector3(x + Math.cos(a) * r, y + h * 0.85 * Math.sqrt(Math.max(0, 1 - (r / w) ** 2)) - 0.03, z + Math.sin(a) * r);
          const out = new THREE.Vector3(Math.cos(a) * r / w * 0.6, 1, Math.sin(a) * r / w * 0.6).normalize();
          const sprig = tint.clone().multiplyScalar(range(rand, 0.9, 1.4));
          plants.addBent(blade(from, out, range(rand, 0.06, 0.12), 0.012, 0.1), () => sprig, 0.9, root, 0.5, 0.15, 1);
        }
      }
    }
  }

  /** Narrow ways worn across the steep face by sheep going along it, not up it: broken, wandering, now and then joining. */
  private trods(rand: Rand): THREE.BufferGeometry {
    const noise = createNoise2D(8807);
    const pos: number[] = [], mark: number[] = [], idx: number[] = [];
    const strip = (raw: THREE.Vector3[], width: number) => {
      if (raw.length < 3) return;
      const points = raw.map((_, i) => {
        const near = raw.slice(Math.max(0, i - 3), i + 4);
        return near.reduce((sum, q) => sum.add(q), new THREE.Vector3()).divideScalar(near.length);
      });
      const first = pos.length / 3;
      for (let i = 0; i < points.length; i++) {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
        const fade = Math.min(1, i / 6, (points.length - 1 - i) / 6);
        for (const side of [-1, 1]) {
          const x = points[i].x - (dz / len) * width * side, z = points[i].z + (dx / len) * width * side;
          pos.push(x, heightAt(x, z) + 0.02, z);
          mark.push(side, i, fade);
        }
      }
      for (let i = 0; i < points.length - 1; i++) {
        const q = first + i * 2;
        idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
      }
    };
    for (const [level, from, to] of [[8.4, -191, -170], [9.6, -188, -166], [11.2, -194, -172], [12.5, -186, -168.5], [14.2, -191, -173], [15.6, -187, -176]] as const) {
      let run: THREE.Vector3[] = [];
      for (let x = from; x <= to; x += 0.35) {
        const want = level + 0.35 * noise(x * 0.11, level);
        let found: THREE.Vector3 | null = null;
        for (let z = -1938; z < -1914 && heightAt(x, -1938) > want; z += 0.2) {
          const h = heightAt(x, z);
          if (h < want) {
            const above = heightAt(x, z - 0.2);
            found = new THREE.Vector3(x, 0, z - 0.2 + (0.2 * (above - want)) / Math.max(above - h, 1e-4));
            break;
          }
        }
        const keep = found && slopeAt(found.x, found.z) > 0.3 && noise(x * 0.2, level * 3) > -0.45 && Math.hypot(found.x - this.bed.x, found.z - this.bed.z) > 9
          && Math.hypot(found.x - this.window.x, found.z - this.window.z) > 3.5 && sleepPathAt(found.x, found.z).distance > 2.5;
        if (keep) run.push(found!);
        else {
          strip(run, range(rand, 0.14, 0.2));
          run = [];
        }
      }
      strip(run, range(rand, 0.14, 0.2));
    }
    /** The rabbit's form: a scrape worn through the frost to the earth, a little longer than the rabbit. */
    const lie = new THREE.Vector3(Math.sin(FORM_FACING), 0, Math.cos(FORM_FACING));
    strip(Array.from({ length: 15 }, (_, i) => new THREE.Vector3(FORM.x, 0, FORM.y).addScaledVector(lie, (i / 14 - 0.5) * 0.95)), 0.3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aMark', new THREE.Float32BufferAttribute(mark, 3));
    geo.setIndex(idx);
    return geo;
  }

  /** The trickle down across the lower slope, frozen in its narrow bed: it follows the fall of the ground through the crossing. */
  private trickle(rand: Rand, rocks: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const noise = createNoise2D(3301);
    const fall = (x: number, z: number) => new THREE.Vector2(heightAt(x - 0.3, z) - heightAt(x + 0.3, z), heightAt(x, z - 0.3) - heightAt(x, z + 0.3)).normalize();
    const trace = (dir: 1 | -1, metres: number) => {
      const out: THREE.Vector2[] = [];
      const p = new THREE.Vector2(SLEEP_TRICKLE[0], SLEEP_TRICKLE[1]);
      for (let d = 0; d < metres; d += 0.25) {
        const f = fall(p.x, p.y).multiplyScalar(dir), wander = 0.6 * noise(d * 0.25 * dir, 2);
        p.add(f.rotateAround(new THREE.Vector2(), wander).multiplyScalar(0.25));
        out.push(p.clone());
      }
      return out;
    };
    const above = trace(-1, 1.75).reverse();
    const line = [...above, new THREE.Vector2(SLEEP_TRICKLE[0], SLEEP_TRICKLE[1]), ...trace(1, 1.75)];
    const pos: number[] = [], mark: number[] = [], idx: number[] = [];
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.y - a.y, len = Math.hypot(dx, dz) || 1;
      const width = 0.065 + 0.025 * noise(i * 0.13, 9) + 0.035 * Math.max(0, noise(i * 0.05, 4));
      const crossing = Math.abs(i - above.length) < 2;
      const fade = Math.min(1, i / 2, (line.length - 1 - i) / 2, crossing ? 1 : smoothstep(-0.55, -0.2, noise(i * 0.45, 17)));
      for (const side of [-1, 1]) {
        const x = line[i].x - (dz / len) * width * side, z = line[i].y + (dx / len) * width * side;
        pos.push(x, heightAt(x, z) + 0.012, z);
        mark.push(side, i * 0.25, fade);
      }
      if (i > 0) {
        const q = (i - 1) * 2;
        idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
      }
      if (i % 7 === 3 && rand() < 0.6 && sleepPathAt(line[i].x, line[i].y).distance > 0.9) {
        const side = rand() < 0.5 ? -1 : 1, s = range(rand, 0.05, 0.11);
        const x = line[i].x - (dz / len) * (width + s) * side, z = line[i].y + (dx / len) * (width + s) * side;
        rocks.push(setRock(rand, x, z, new THREE.Vector3(s, s * 0.6, s), 0.4, 1));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aMark', new THREE.Float32BufferAttribute(mark, 3));
    geo.setIndex(idx);
    return geo;
  }
}

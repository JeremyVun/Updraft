import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glsl, tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import type { AudioOut } from '../creatures/voices';
import type { WindField, WindSample } from '../wind/field';
import { meadowBreath } from '../audio/meadow-breath';
import { MeadowSeeds } from './meadow-seeds';
import { mulberry32 } from './noise';

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aTint;
in float aPetal;
uniform vec2 uAir;
uniform float uFlower;
uniform float uShed;
uniform vec3 uBloom;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
void main() {
  mat4 transform = modelMatrix * instanceMatrix;
  vec3 root = (transform * vec4(0., 0., 0., 1.)).xyz;
  vec3 p = position;
  p = mix(p, vec3(-.035, 1.06, 0.) + (p - vec3(-.035, 1.06, 0.)) * (1. - uShed), aPetal * (1. - uFlower));
  vec3 reach = vec3(${tuning.meadowEchoes.clusters.map(([dx, dz]) => `distance(root.xz, vec2(${glsl(tuning.meadowEchoes.patches[0][0] + dx)}, ${glsl(tuning.meadowEchoes.patches[0][1] + dz)}))`).join(', ')});
  float bloom = reach.x < min(reach.y, reach.z) ? uBloom.x : reach.y < reach.z ? uBloom.y : uBloom.z;
  p.xz *= mix(1., .64 + bloom * .36, aPetal * uFlower);
  vec4 w = transform * vec4(p, 1.);
  float h = w.y - root.y;
  vec2 bend = uAir * ${glsl(tuning.meadowEchoes.stemBend)} / (1. + length(uAir) * ${glsl(tuning.meadowEchoes.stemSaturation)});
  w.xz += (bend + vec2(sin(uTime * 1.4 + root.x * .7 + root.z * .3), cos(uTime * .95 + root.z)) * .04) * h * h;
  vWorld = w.xyz;
  vNormal = normalize(mat3(transform) * normal);
  vTint = mix(aTint, aTint * instanceColor, aPetal);
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
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      ribbon(new THREE.Vector3(), new THREE.Vector3(Math.cos(a) * .085, .06, Math.sin(a) * .085), .004);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(indices); g.computeVertexNormals(); return painted(g, head ? '#bcc3b0' : '#f6eedc', 1);
}

export class MeadowEchoes {
  readonly group = new THREE.Group();
  readonly seeds = new MeadowSeeds();
  readonly stands = tuning.meadowEchoes.stands.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z), z));
  readonly patches = tuning.meadowEchoes.patches.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 1.3, z));
  readonly sectors = tuning.meadowEchoes.clusters.map(([dx, dz]) => {
    const p = this.patches[0]; return new THREE.Vector3(p.x + dx, heightAt(p.x + dx, p.z + dz) + 1.2, p.z + dz);
  });
  readonly seed = new THREE.Vector3();
  readonly heard = new THREE.Vector3();
  heardAt = -Infinity;
  enabled = false;
  private lastReceived = -Infinity;
  private now = 0;
  private readonly material: THREE.ShaderMaterial;
  private readonly blooms: THREE.InstancedMesh;
  private readonly heads: THREE.InstancedMesh;
  private readonly down: THREE.InstancedMesh;
  private readonly petals: THREE.InstancedMesh;
  private readonly origins: THREE.Vector3[] = [];
  private readonly piece = new THREE.Object3D();
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly air = new THREE.Vector2();
  private readonly seedAir = new THREE.Vector2();
  private readonly dot = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();
  private readonly ringing = [0, 0, 0];
  private readonly nextNote = [0, 0, 0];
  private readonly soundQueue: { midi: number; at: number; point: THREE.Vector3 }[] = [];

  constructor() {
    this.group.name = 'meadow-echoes';
    const material = (air: THREE.Vector2, flower: number) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uAir: { value: air }, uTime: { value: 0 }, uFlower: { value: flower }, uShed: { value: 0 }, uBloom: { value: new THREE.Vector3() } },
      vertexColors: true, side: THREE.DoubleSide });
    this.material = material(this.air, 1);
    const rand = mulberry32(4731), colors = ['#dfb5cf', '#b9b9e0', '#eed8c4', '#d4b5d4'];
    this.blooms = new THREE.InstancedMesh(flowerGeometry(), this.material, tuning.meadowEchoes.flowers);
    const [x, z, rx, rz] = tuning.meadowEchoes.patches[0];
    for (let i = 0; i < this.blooms.count; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()), px = x + Math.cos(a) * r * rx, pz = z + Math.sin(a) * r * rz;
      this.piece.position.set(px, heightAt(px, pz), pz);
      this.piece.rotation.set((rand() - .5) * .24, rand() * Math.PI * 2, (rand() - .5) * .24);
      const scale = .85 + rand() * .8;
      const stand = this.stands[0];
      this.piece.scale.setScalar(Math.hypot(px - stand.x, pz - stand.z) < 3.2 ? 0 : scale);
      this.piece.updateMatrix();
      this.blooms.setMatrixAt(i, this.piece.matrix); this.blooms.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    const seedMaterial = material(this.seedAir, 0);
    const stems = mergeGeometries(stemGeometry())!;
    const head = tuftGeometry(true).translate(-.035, 1.06, 0);
    const heart = new THREE.SphereGeometry(.16, 10, 8);
    const hp = heart.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), r = .94 + .08 * Math.sin(x * 79 + y * 93 + z * 67);
      hp.setXYZ(i, x * r, y * r, z * r);
    }
    heart.computeVertexNormals(); heart.translate(-.035, 1.06, 0);
    this.heads = new THREE.InstancedMesh(mergeGeometries([stems, head, painted(heart, '#d5d2b7', 1)])!, seedMaterial, tuning.meadowEchoes.seedHeads);
    const [sx, sz, srx, srz] = tuning.meadowEchoes.patches[1];
    for (let i = 0; i < this.heads.count; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()), px = sx + Math.cos(a) * r * srx, pz = sz + Math.sin(a) * r * srz;
      this.piece.position.set(px, heightAt(px, pz), pz); this.piece.rotation.set(0, rand() * Math.PI * 2, (rand() - .5) * .12);
      this.piece.scale.setScalar(1.1 + rand() * .7); this.piece.updateMatrix();
      this.heads.setMatrixAt(i, this.piece.matrix); this.heads.setColorAt(i, new THREE.Color('#fff6e2'));
      this.origins.push(new THREE.Vector3(px, this.piece.position.y + this.piece.scale.y * 1.06, pz));
    }
    const looseMaterial = material(this.seedAir, 0);
    this.down = new THREE.InstancedMesh(tuftGeometry(false), looseMaterial, 240);
    this.petals = new THREE.InstancedMesh(painted(new THREE.SphereGeometry(.065, 5, 3).scale(1, .18, 1.7), '#f3d1e2', 1), looseMaterial, 90);
    for (const mesh of [this.down, this.petals]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, new THREE.Color('#ffffff'));
      mesh.frustumCulled = false;
    }
    this.group.add(this.blooms, this.heads, this.down, this.petals);
    this.reset();
  }

  get source(): THREE.Vector3 { return this.patches[Math.min(this.seeds.completed, 1)]; }
  get receiver(): THREE.Vector3 {
    return this.seeds.completed === 0 ? this.toward.copy(this.source).add(new THREE.Vector3(10, 0, 0))
      : this.toward.copy(this.patches[1]).add(new THREE.Vector3(0, tuning.meadowEchoes.seedHeight, 0));
  }
  get invitation(): THREE.Vector3 {
    if (this.seeds.completed === 0) return this.sectors[this.seeds.blooms.findIndex(v => v < 1)] ?? this.sectors[1];
    return this.seed;
  }
  get receivedAt(): number { return this.lastReceived; }

  reset(completed = 0): void {
    this.seeds.reset(completed); this.enabled = false; this.soundQueue.length = 0;
    this.lastReceived = this.heardAt = -Infinity;
    this.ringing.fill(0); this.nextNote.fill(0);
    this.seed.copy(this.source);
    this.down.visible = this.petals.visible = false;
  }

  release(time: number): void {
    this.seeds.release();
    this.soundQueue.push({ midi: this.seeds.completed === 0 ? 62 : 69, at: time + .5, point: this.source });
  }

  update(dt: number, time: number, camera: THREE.PerspectiveCamera, input: PointerInput,
    output: AudioOut | null, active: boolean, wind?: WindField): void {
    if (!active) { this.soundQueue.length = 0; return; }
    this.now = time;
    const ease = 1 - Math.exp(-dt * 2);
    for (const [i, air] of [this.air, this.seedAir].entries()) {
      if (wind) wind.sample(this.patches[i].x, this.patches[i].z, this.sample);
      air.x += (this.sample.x - air.x) * ease; air.y += (this.sample.z - air.y) * ease;
    }
    this.material.uniforms.uTime.value = time;
    (this.heads.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    (this.down.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    if (this.seeds.active && this.enabled) this.brush(dt, camera, input);
    if (this.seeds.update(dt)) {
      this.lastReceived = time;
      const notes = this.seeds.completed === 1 ? [64, 66, 69] : [71, 69, 66, 62];
      notes.forEach((midi, i) => this.soundQueue.push({ midi, at: time + .35 + i * .55, point: this.patches[this.seeds.completed - 1] }));
    }
    this.material.uniforms.uBloom.value.fromArray(this.seeds.blooms);
    for (let i = 0; i < 3; i++) this.ringing[i] = Math.max(0, this.ringing[i] - dt * .25);
    const lift = this.seeds.completed >= 2 ? 1 + Math.min(1, (time - this.lastReceived) / 8) : this.seeds.completed === 1 ? this.seeds.progress : 0;
    (this.heads.material as THREE.ShaderMaterial).uniforms.uShed.value = Math.min(1, lift);
    const gone = this.seeds.completed >= 2 ? Math.max(0, 1 - (time - this.lastReceived - 7) / 11) : 1;
    this.seed.copy(this.patches[1]); this.seed.y += lift * tuning.meadowEchoes.seedHeight;
    this.down.visible = lift > .005;
    for (let i = 0; i < this.down.count; i++) {
      const root = this.origins[i % this.origins.length], a = i * 2.399963 + time * .18, r = 1.4 + (i % 11) * .28;
      this.piece.position.copy(root).lerp(this.patches[1], Math.min(.65, lift * .65));
      this.piece.position.x += Math.cos(a) * r * lift;
      this.piece.position.z += Math.sin(a) * r * lift;
      this.piece.position.y += lift * (tuning.meadowEchoes.seedHeight * (.55 + (i % 17) / 25)) + Math.sin(a * 1.7) * .12;
      this.piece.rotation.set(.4 * Math.sin(a), a, .25 * Math.cos(a));
      this.piece.scale.setScalar(gone * Math.min(1, lift * 5) * (.85 + i % 4 * .15)); this.piece.updateMatrix();
      this.down.setMatrixAt(i, this.piece.matrix);
    }
    this.down.instanceMatrix.needsUpdate = true;
    this.petals.visible = this.ringing.some(v => v > .01);
    for (let i = 0; i < this.petals.count; i++) {
      const sector = i % 3, a = i * 2.399963 + time * .8, energy = this.ringing[sector];
      this.piece.position.copy(this.sectors[sector]);
      this.piece.position.x += Math.sin(a) * (1 + i % 5);
      this.piece.position.z += Math.cos(a * .7) * (1 + i % 4);
      this.piece.position.y += ((time * .45 + i * .37) % 2.5) * energy;
      this.piece.rotation.set(a, a * 1.3, a * .4); this.piece.scale.setScalar(energy); this.piece.updateMatrix();
      this.petals.setMatrixAt(i, this.piece.matrix);
    }
    this.petals.instanceMatrix.needsUpdate = true;
    this.soundQueue.sort((a, b) => a.at - b.at);
    while (this.soundQueue.length && this.soundQueue[0].at <= time) {
      const note = this.soundQueue.shift()!;
      if (output && time - note.at < .2) meadowBreath(output, note.midi, this.dot.copy(note.point).project(camera).x);
    }
  }

  private brush(dt: number, camera: THREE.PerspectiveCamera, input: PointerInput): void {
    if (!input.present || input.muted) return;
    const t = tuning.meadowEchoes;
    const dx = (input.ndc.x - input.prevNdc.x) * camera.aspect, dy = input.ndc.y - input.prevNdc.y;
    const movement = Math.hypot(dx, dy);
    if (this.seeds.completed === 0 && input.gust > .03) {
      for (let i = 0; i < 3; i++) {
        const hit = screenBrush(camera, this.sectors[i], input.prevNdc, input.ndc, t.brush);
        if (hit < .01 || movement < .0001) continue;
        this.seeds.sweep(i, movement * Math.sqrt(hit) * t.strokeGain);
        this.ringing[i] = Math.min(1, this.ringing[i] + movement * hit * 12);
        if (this.now > this.nextNote[i]) {
          this.soundQueue.push({ midi: [62, 66, 69][i], at: this.now, point: this.sectors[i] });
          this.nextNote[i] = this.now + 1.1; this.heard.copy(this.sectors[i]); this.heardAt = this.now;
        }
      }
    } else if (this.seeds.completed === 1) {
      const hit = Math.max(screenBrush(camera, this.patches[1], input.prevNdc, input.ndc, .22),
        screenBrush(camera, this.seed, input.prevNdc, input.ndc, .2));
      if (input.gust > .03 && hit > .01) this.seeds.lift(Math.max(0, dy + Math.abs(dx) * .16) * Math.sqrt(hit) * t.sweepLift);
      if (input.charge > .1 && input.updraftAt.distanceTo(this.patches[1]) < t.liftReach) this.seeds.lift(input.charge * dt * t.liftGain);
    }
  }
}

export const meadowEchoes = new MeadowEchoes();

import * as THREE from 'three';
import { tuning } from '../tuning';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import type { AudioOut } from '../creatures/voices';
import { meadowBreath } from '../audio/meadow-breath';
import { MeadowSeeds } from './meadow-seeds';

const VERT = /* glsl */ `
${ATMO_GLSL}
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
void main() {
  mat4 transform = modelMatrix;
  #ifdef USE_INSTANCING
    transform *= instanceMatrix;
  #endif
  vec4 w = transform * vec4(position, 1.);
  vWorld = w.xyz;
  vNormal = normalize(mat3(transform) * normal);
  vLocal = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uColor;
uniform float uAlpha;
uniform float uPetal;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1. : -1.);
  float sun = dot(N, uSunDir);
  float vein = pow(max(0., cos(atan(vLocal.x, vLocal.z) * 10. + sin(vLocal.y * 3.) * .18)), 18.);
  vec3 color = mix(uColor, uColor * (.76 + .38 * (1. - smoothstep(-1.65, 0., vLocal.y))) * (1. - vein * .08), uPetal);
  vec3 col = color * (uSkyAmbient * 1.5 + uSunColor * (max(sun, 0.) * .65 + max(-sun, 0.) * .6));
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), uAlpha);
}`;
function material(color: string, petal = 0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { ...atmo.uniforms, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uPetal: { value: petal } },
    side: THREE.DoubleSide });
}

function bellGeometry(): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  const rings = 16, sides = 40;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const radius = 0.12 + Math.sin(Math.min(1, t * 2.3) * Math.PI * 0.5) * 0.49 + Math.pow(t, 6) * 0.29;
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * Math.PI * 2;
      const lobe = Math.cos(a * 5) * Math.pow(t, 6);
      positions.push(Math.sin(a) * (radius + lobe * 0.1), -t * 1.65 + lobe * 0.1, Math.cos(a) * (radius + lobe * 0.1));
      if (j < rings && i < sides) {
        const n = j * (sides + 1) + i;
        indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

interface Bloom {
  root: THREE.Group;
  bell: THREE.Mesh;
  mouth: THREE.Vector3;
  stand: THREE.Vector3;
  open: number;
  stem: THREE.BufferGeometry;
  rest: Float32Array;
  height: number;
  bow: number;
}

export class MeadowEchoes {
  readonly group = new THREE.Group();
  readonly seeds = new MeadowSeeds();
  readonly flowers: Bloom[] = [];
  readonly plume = new THREE.Group();
  readonly seed = new THREE.Vector3();
  readonly prelude: Bloom;
  enabled = false;
  private lastReceived = -Infinity;
  private readonly dot = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly motes: THREE.InstancedMesh;
  private readonly mote = new THREE.Object3D();
  private readonly stemMaterial = material('#5d8053');
  private readonly bellMaterial = material('#9da8da', 1);
  private readonly seedMaterial = material('#fff0cf');
  private readonly soundQueue: { midi: number; at: number; bloom: number }[] = [];

  constructor() {
    this.group.name = 'meadow-echoes';
    const geometry = bellGeometry();
    for (const spec of tuning.meadowEchoes.flowers) {
      this.flowers.push(this.bloom(spec, geometry));
      for (let i = 0; i < 2; i++) {
        this.bloom([spec[0] - 1.7 + i * 3.5, spec[1] - 1.4 - i * 0.8, spec[2] * (0.35 + i * 0.16)], geometry, 0.34 + i * 0.1);
      }
    }
    this.prelude = this.bloom(tuning.meadowEchoes.prelude, geometry, 0.65);
    const seedGeometry = new THREE.SphereGeometry(0.07, 5, 3);
    this.motes = new THREE.InstancedMesh(seedGeometry, this.seedMaterial, 35);
    this.motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.motes.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    this.plume.add(this.motes);
    this.group.add(this.plume);
    this.plume.visible = false;
    this.reset();
  }

  private bloom(spec: number[], geometry: THREE.BufferGeometry, scale = 1): Bloom {
    const [x, z, h] = spec, root = new THREE.Group();
    root.position.set(x, heightAt(x, z), z);
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(), new THREE.Vector3(-0.2, h * 0.38, 0),
      new THREE.Vector3(-0.35, h * 0.85, 0),
      new THREE.Vector3(0.45, h + 0.3, 0), new THREE.Vector3(0.8, h, 0),
    ]);
    const stem = new THREE.TubeGeometry(path, 24, 0.055 * scale, 6, false);
    (stem.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    root.add(new THREE.Mesh(stem, this.stemMaterial));
    const bell = new THREE.Mesh(geometry, this.bellMaterial);
    bell.position.set(0.8, h, 0); bell.scale.setScalar(scale);
    root.add(bell);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), this.stemMaterial);
      leaf.scale.set(0.12, 0.04, 0.7);
      leaf.position.set(i % 2 ? -0.3 : 0.25, h * (0.13 + i * 0.16), 0);
      leaf.rotation.set(-0.8, i * 2.3, 0.4); root.add(leaf);
    }
    this.group.add(root);
    return { root, bell, open: 0, stem, rest: new Float32Array(stem.attributes.position.array), height: h, bow: 0,
      mouth: new THREE.Vector3(x + 0.8, root.position.y + h - 2.05 * scale, z),
      stand: new THREE.Vector3(x + tuning.meadowEchoes.standAside, heightAt(x + tuning.meadowEchoes.standAside, z + tuning.meadowEchoes.standBack), z + tuning.meadowEchoes.standBack) };
  }

  reset(completed = 0): void {
    this.seeds.reset(completed);
    this.enabled = false;
    this.soundQueue.length = 0;
    this.lastReceived = -Infinity;
    for (let i = 0; i < this.flowers.length; i++) {
      this.flowers[i].open = i <= completed ? 1 : 0;
      this.flowers[i].bow = 0;
    }
    this.seed.copy(this.flowers[Math.min(completed, 2)].mouth);
  }

  release(time: number): void {
    this.seeds.release();
    this.seed.copy(this.flowers[this.seeds.completed].mouth);
    this.soundQueue.push({ midi: [62, 66][this.seeds.completed], at: time, bloom: this.seeds.completed });
  }

  get receiver(): THREE.Vector3 { return this.flowers[Math.min(2, this.seeds.completed + 1)].mouth; }
  get source(): THREE.Vector3 { return this.flowers[Math.min(2, this.seeds.completed)].mouth; }
  get receivedAt(): number { return this.lastReceived; }
  bow(index: number, amount: number): void { this.flowers[index].bow = amount; }

  update(dt: number, time: number, camera: THREE.PerspectiveCamera, input: PointerInput,
    output: AudioOut | null, active: boolean): void {
    if (!active) { this.plume.visible = false; this.soundQueue.length = 0; return; }
    if (this.seeds.active && this.enabled) this.brush(dt, camera, input);
    if (this.seeds.update(dt)) {
      this.lastReceived = time;
      const notes = this.seeds.completed === 1 ? [64, 66] : [66, 69, 71];
      notes.forEach((midi, i) => this.soundQueue.push({ midi, at: time + 0.3 + i * 0.55, bloom: this.seeds.completed }));
    }
    if (this.seeds.active) {
      const p = this.seeds.progress;
      this.seed.lerpVectors(this.source, this.receiver, p);
      this.seed.y += Math.sin(Math.PI * p) * (this.seeds.completed === 0 ? 1.5 : 3);
      this.seed.x += Math.sin(time * 1.2) * 0.15 * Math.sin(Math.PI * p);
    }
    if (!this.seeds.active && time - this.lastReceived < 1.6) {
      this.seed.lerp(this.source, 1 - Math.exp(-dt * 4));
    }
    const dock = this.seeds.active ? 1 : Math.max(0, 1 - (time - this.lastReceived) / 1.6);
    this.plume.visible = dock > 0;
    this.plume.position.copy(this.seed);
    this.plume.scale.setScalar(dock);
    for (let i = 0; i < this.motes.count; i++) {
      const a = i * 2.399963 + time * (0.24 + i % 3 * 0.05);
      const r = tuning.meadowEchoes.seedSize * Math.sqrt((i + 1) / this.motes.count);
      this.mote.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.75, Math.sin(i * 4.13 + time * 0.5) * r);
      this.mote.scale.set(0.6, 1.8 + i % 3 * 0.3, 0.6);
      this.mote.rotation.z = a * 0.25;
      this.mote.updateMatrix();
      this.motes.setMatrixAt(i, this.mote.matrix);
    }
    this.motes.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.flowers.length; i++) {
      const f = this.flowers[i];
      f.open += ((i <= this.seeds.completed ? 1 : 0.2) - f.open) * (1 - Math.exp(-dt * 1.5));
      f.bell.scale.set(0.65 + f.open * 0.45, 1, 0.65 + f.open * 0.45);
      f.root.rotation.z = Math.sin(time * 0.8 + i * 1.8) * 0.028;
      f.bell.rotation.z = Math.sin(time * 1.15 + i * 1.8) * 0.09;
      const lowered = (f.height - (f.stand.y - f.root.position.y + 3.2)) * f.bow;
      const pos = f.stem.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const t = Math.min(1, f.rest[j * 3 + 1] / f.height);
        pos.setXYZ(j, f.rest[j * 3], f.rest[j * 3 + 1] - lowered * t * t,
          f.rest[j * 3 + 2] + f.bow * 0.8 * t * t);
      }
      pos.needsUpdate = true;
      f.bell.position.set(0.8, f.height - lowered, f.bow * 0.8);
      f.root.updateMatrixWorld(true);
      f.mouth.set(0, -2.05, 0).applyMatrix4(f.bell.matrixWorld);
    }
    this.prelude.root.rotation.z = Math.sin(time * 0.85) * 0.025;
    while (this.soundQueue.length && this.soundQueue[0].at <= time) {
      const note = this.soundQueue.shift()!;
      if (output && time - note.at < 0.2) meadowBreath(output, note.midi,
        this.dot.copy(this.flowers[note.bloom].mouth).project(camera).x);
    }
  }

  private brush(dt: number, camera: THREE.PerspectiveCamera, input: PointerInput): void {
    if (!input.present || input.muted) return;
    this.from.copy(this.seed).project(camera);
    this.to.copy(this.receiver).project(camera);
    const dx = (this.to.x - this.from.x) * camera.aspect, dy = this.to.y - this.from.y;
    const len = Math.max(0.01, Math.hypot(dx, dy));
    const movement = this.tip.set((input.ndc.x - input.prevNdc.x) * camera.aspect, input.ndc.y - input.prevNdc.y, 0);
    const hit = screenBrush(camera, this.seed, input.prevNdc, input.ndc, tuning.meadowEchoes.brush);
    if (hit > 0.01 && input.gust > 0.03) {
      const along = (movement.x * dx + movement.y * dy) / len;
      this.seeds.blow(along * Math.sqrt(hit) * tuning.meadowEchoes.strokeGain);
    }
    if (input.charge > 0.1 && input.updraftAt.distanceTo(this.seed) < tuning.meadowEchoes.liftReach) {
      this.seeds.blow(input.charge * dt * tuning.meadowEchoes.lift);
    }
  }
}

export const meadowEchoes = new MeadowEchoes();

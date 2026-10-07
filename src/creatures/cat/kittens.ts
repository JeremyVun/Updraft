import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Cat, type CatSound } from '../cat';
import { CREATURE_GLSL } from '../shading';
import type { Coat } from './shader';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';

/** A kitten beside its mother: about a third of her size. */
const KITTEN = 0.62;
/**
 * Lighter than their mother so they read in the belfry's half light: a ginger, a grey with white socks to its knees,
 * and a pale tabby. Each has a voice of its own, all high.
 */
const LITTER: { coat: Coat; voice: number }[] = [
  { coat: { fawn: [0.47, 0.25, 0.095], back: [0.41, 0.205, 0.07], stripe: [0.25, 0.11, 0.04], socks: 0 }, voice: 1.55 },
  { coat: { fawn: [0.38, 0.365, 0.345], back: [0.3, 0.29, 0.28], stripe: [0.13, 0.125, 0.12], socks: 0.052 }, voice: 1.8 },
  { coat: { fawn: [0.4, 0.31, 0.225], back: [0.33, 0.25, 0.18], stripe: [0.15, 0.105, 0.08], socks: 0 }, voice: 1.67 },
];
/** How far from the middle of the straw they wander while they play. */
const ROOM = 0.38;

const STRAW_VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aTint;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vTint;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vTint = aTint;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const STRAW_FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vTint;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 col = shadeCreature(vTint, N, vWorld, 1.0, 0.0, 0.0, 1.0) + vTint * uSkyAmbient * 0.5;
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

/** Old straw heaped in a shallow ring about `radius` across, its stalks lying every way. */
function strawGeometry(radius: number): THREE.BufferGeometry {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const parts: THREE.BufferGeometry[] = [];
  const tint = (g: THREE.BufferGeometry, c: [number, number, number]) => {
    const n = g.attributes.position.count;
    const t = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) t.set(c, i * 3);
    g.setAttribute('aTint', new THREE.BufferAttribute(t, 3));
    g.deleteAttribute('uv');
    return g.index ? g.toNonIndexed() : g;
  };
  parts.push(tint(new THREE.SphereGeometry(radius, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.12, 1), [0.2, 0.15, 0.07]));
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius * 1.15;
    const len = 0.12 + rand() * 0.16;
    const shade = 0.75 + rand() * 0.45;
    const stalk = new THREE.BoxGeometry(0.008, 0.006, len)
      .rotateX((rand() - 0.5) * 0.5)
      .rotateY(rand() * Math.PI)
      .translate(Math.cos(a) * r, radius * 0.12 * (1 - (r / radius / 1.15) ** 2) + rand() * 0.015, Math.sin(a) * r);
    parts.push(tint(stalk, [0.36 * shade, 0.27 * shade, 0.12 * shade]));
  }
  return mergeGeometries(parts);
}

type Doing = 'nestle' | 'tumble';

/**
 * The cat's three kittens in their straw: asleep in a heap, curled against their mother or each other, or awake and
 * tumbling, pouncing on each other, batting and bowled over. One can be sent to sit beside her on a sill. Each is a
 * `Cat` at a kitten's size, so everything a cat can do, a kitten can.
 */
export class Kittens {
  readonly cats = LITTER.map(({ coat }) => new Cat({ coat, kitten: true })) as [Cat, Cat, Cat];
  readonly straw: THREE.Mesh;
  /** What they did this frame that makes a sound (pats, tiny mews); whoever plays them empties the list. */
  readonly heard: CatSound[] = [];
  readonly centre = new THREE.Vector3();
  private doing: Doing = 'nestle';
  private readonly next = [0, 0, 0];
  private away = -1;
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();

  constructor() {
    for (const [i, k] of this.cats.entries()) {
      k.scale = KITTEN;
      k.voice = LITTER[i].voice;
    }
    this.straw = new THREE.Mesh(strawGeometry(0.55), new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms }, vertexShader: STRAW_VERT, fragmentShader: STRAW_FRAG, side: THREE.DoubleSide,
    }));
    this.straw.visible = false;
  }

  get objects(): THREE.Object3D[] {
    return [this.straw, ...this.cats.flatMap((k) => k.objects)];
  }

  set visible(on: boolean) {
    this.straw.visible = on;
    for (const k of this.cats) k.visible = on;
  }

  /** The straw's middle, on whatever it lies on. */
  lay(at: THREE.Vector3): void {
    this.centre.copy(at);
    this.straw.position.copy(at);
  }

  private floor = (): number => this.centre.y + 0.03;

  /**
   * Asleep in a heap, each curled up: pressed into the curve of `mother` if she is given and curled there, otherwise
   * against each other in the middle of the straw.
   */
  nestle(mother: Cat | null = null): void {
    this.doing = 'nestle';
    this.away = -1;
    const at = mother ? mother.hollow(this.v) : this.v.copy(this.centre);
    const yaw = mother ? mother.yaw : 0;
    const spots: [number, number, number][] = [[0.0, 0.02, 0.4], [0.09, -0.08, 2.2], [-0.03, 0.12, -1.6]];
    for (const [i, k] of this.cats.entries()) {
      const [x, z, turn] = spots[i];
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const p = this.w.set(at.x + x * c + z * s, this.floor(), at.z - x * s + z * c);
      k.unease = 0;
      k.curious = null;
      k.place(p, yaw + turn, { pose: 'curl', floor: this.floor });
      k.look(null);
    }
  }

  /** Awake and playing: they pounce on each other, bat, roll over and scamper about the straw. */
  tumble(): void {
    this.doing = 'tumble';
    this.away = -1;
    for (const [i, k] of this.cats.entries()) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      k.place(this.w.set(this.centre.x + Math.cos(a) * 0.2, this.floor(), this.centre.z + Math.sin(a) * 0.2), a + Math.PI * 0.8, { pose: i === 1 ? 'sit' : 'stand', floor: this.floor });
      this.next[i] = 0.3 + i * 0.45;
    }
  }

  /**
   * Kitten `i` goes to `to` (a sill beside its mother): it scampers to below it across the straw and hops up, then
   * sits looking at `look`, and `onDone`. The other two go on as they were.
   */
  toSill(i: 0 | 1 | 2, to: THREE.Vector3, look: THREE.Vector3 | null, onDone?: () => void): void {
    const k = this.cats[i];
    this.away = i;
    const below = this.v.copy(to).sub(k.position).setY(0);
    const span = below.length();
    below.multiplyScalar(Math.max(0, span - 0.18) / Math.max(span, 1e-3)).add(k.position);
    k.run([below.clone()], this.floor, { pace: 'trot', speed: 0.7, then: 'stand' }, () => {
      k.hop(to.clone(), { then: 'sit', look }, () => {
        k.mew(0.4);
        onDone?.();
      });
    });
  }

  update(dt: number): void {
    for (const [i, k] of this.cats.entries()) {
      k.update(dt);
      this.heard.push(...k.heard);
      k.heard.length = 0;
      if (this.doing !== 'tumble' || i === this.away || k.busy) continue;
      this.next[i] -= dt;
      if (this.next[i] > 0) continue;
      this.next[i] = 0.6 + Math.random() * 1.6;
      this.play(i);
    }
  }

  private play(i: number): void {
    const k = this.cats[i];
    const others = this.cats.filter((o, j) => j !== i && j !== this.away);
    const other = others[Math.floor(Math.random() * others.length)];
    const r = Math.random();
    const near = other && other.position.distanceTo(k.position) < 0.2;
    if (other && near && r < 0.4) {
      k.look(other.position);
      k.bat(this.v.copy(other.position).setY(other.position.y + 0.05));
    } else if (other && r < 0.7) {
      /** A pounce: a wiggle, a spring onto the other one, which is bowled over. */
      const to = this.w.copy(other.position).sub(k.position).setY(0);
      const d = to.length();
      to.multiplyScalar(Math.max(0, d - 0.08) / Math.max(d, 1e-3)).add(k.position);
      to.y = this.floor();
      k.leap(to.clone(), { floor: this.floor, then: 'stand', gather: 0.7, look: other.position }, () => {
        if (!other.busy) other.topple();
      });
    } else if (r < 0.9) {
      const a = Math.random() * Math.PI * 2, rr = ROOM * Math.sqrt(Math.random());
      k.look(null);
      k.run([this.w.set(this.centre.x + Math.cos(a) * rr, 0, this.centre.z + Math.sin(a) * rr).clone()], this.floor, { pace: 'trot', speed: 0.55, then: Math.random() < 0.5 ? 'sit' : 'stand' });
    } else {
      k.mew(0.3);
    }
  }
}

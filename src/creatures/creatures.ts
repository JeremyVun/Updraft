import * as THREE from 'three';
import type { PointerInput } from '../input/pointer';
import type { WindField } from '../wind/field';
import { mulberry32 } from '../world/noise';
import { Butterflies } from './butterflies';
import { Gulls } from './gulls';
import type { Habitat } from './habitat';
import type { Rng } from './motion';
import { Rabbits } from './rabbits';
import { Sheep } from './sheep';
import { Songbirds } from './songbirds';
import type { Stimuli } from './stimuli';
import { Voices, type AudioOut } from './voices';

export interface SpawnRegion {
  x: number;
  z: number;
  radius: number;
  rabbits?: number;
  songbirds?: number;
  gulls?: number;
  butterflies?: number;
  /** One flock of this many, lambs among them, in the pasture field nearest the region's centre. */
  sheep?: number;
  seed?: number;
}

export interface CreatureEnv {
  camera: THREE.Camera;
  input: PointerInput;
  glider: THREE.Vector3 | null;
  walker: THREE.Vector3 | null;
  life(x: number, z: number): number;
  breeze: number;
  night: number;
  audio: AudioOut | null;
}

/** Every animal in the world, one draw call per species. Spawn them into regions of a habitat. */
export class Creatures {
  readonly group = new THREE.Group();
  readonly rabbits: Rabbits;
  readonly songbirds: Songbirds;
  readonly gulls: Gulls;
  readonly butterflies: Butterflies;
  readonly sheep: Sheep;
  private readonly voices = new Voices();
  private readonly stimuli: Stimuli;
  private readonly gustPoint = new THREE.Vector3();

  constructor(
    wind: WindField,
    private readonly habitat: Habitat,
    input: PointerInput,
    camera: THREE.Camera,
  ) {
    this.rabbits = new Rabbits(habitat);
    this.songbirds = new Songbirds(habitat);
    this.gulls = new Gulls(habitat);
    this.butterflies = new Butterflies(habitat);
    this.sheep = new Sheep(habitat);
    this.group.add(this.rabbits.mesh, this.songbirds.mesh, this.gulls.mesh, this.butterflies.mesh, this.sheep.mesh);
    this.stimuli = {
      wind,
      sample: { x: 0, z: 0, energy: 0, lift: 0 },
      camera,
      input,
      gustAt: null,
      updraft: { x: 0, z: 0, strength: 0 },
      glider: null,
      walker: null,
      life: () => 1,
      breeze: 1,
      night: 0,
      voices: this.voices,
    };
  }

  spawn(region: SpawnRegion): void {
    const rand = mulberry32(region.seed ?? 1);
    const meadow = (x: number, z: number) => this.habitat.meadow(x, z);
    const rabbits = region.rabbits ?? 0;
    const warrens = this.spots(rand, region, Math.ceil(rabbits / 2), 14, meadow, (x, z) => this.warrenScore(x, z));
    for (let i = 0; i < rabbits && warrens.length; i++) {
      const [x, z] = warrens[i % warrens.length];
      this.rabbits.add(x, z, Math.floor(rand() * 1e9), i === 2);
    }
    const birds = region.songbirds ?? 0;
    const flocks = Math.ceil(birds / 4);
    const forage = (x: number, z: number) => this.habitat.forage(x, z);
    const grounds = this.spots(rand, region, flocks, 12, forage, (x, z) => -2 * this.habitat.grassHeight(x, z));
    grounds.forEach(([x, z], i) => {
      const size = Math.floor(birds / flocks) + (i < birds % flocks ? 1 : 0);
      this.songbirds.addFlock(x, z, size, region.radius, Math.floor(rand() * 1e9));
    });
    for (let i = 0; i < (region.gulls ?? 0); i++) this.gulls.add(region.x, region.z, region.radius, Math.floor(rand() * 1e9));
    const butterflies = region.butterflies ?? 0;
    const patches = this.habitat.flowers
      .filter((f) => Math.hypot(f.x - region.x, f.z - region.z) < region.radius)
      .sort((a, b) => Math.hypot(a.x - region.x, a.z - region.z) - Math.hypot(b.x - region.x, b.z - region.z))
      .slice(0, Math.ceil(butterflies / 3));
    for (let i = 0; i < butterflies && patches.length; i++) {
      const kind = i % 20 < 9 ? 0 : i % 20 < 15 ? 1 : 2;
      this.butterflies.add(patches[i % patches.length], kind, Math.floor(rand() * 1e9));
    }
    const sheep = region.sheep ?? 0;
    const [fold] = sheep ? this.spots(rand, region, 1, 0, (x, z) => this.sheep.pasture(x, z), (x, z) => this.sheep.room(x, z)) : [];
    if (fold) this.sheep.addFlock(fold[0], fold[1], sheep, Math.floor(rand() * 1e9));
  }

  private warrenScore(x: number, z: number): number {
    const flowers = this.habitat.flowers.filter((f) => Math.hypot(f.x - x, f.z - z) < 12).length;
    return Math.min(flowers, 3) * 0.4 - this.habitat.grassHeight(x, z);
  }

  /** Picks well-scored points in the region that satisfy `accept`, at least `gap` apart. */
  private spots(
    rand: Rng,
    region: SpawnRegion,
    count: number,
    gap: number,
    accept: (x: number, z: number) => boolean,
    score: (x: number, z: number) => number,
  ): [number, number][] {
    const candidates: [number, number, number][] = [];
    for (let i = 0; i < count * 60; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * region.radius;
      const x = region.x + Math.cos(a) * d;
      const z = region.z + Math.sin(a) * d;
      if (accept(x, z)) candidates.push([x, z, score(x, z) + rand() * 0.6]);
    }
    candidates.sort((a, b) => b[2] - a[2]);
    const picked: [number, number][] = [];
    for (const [x, z] of candidates) {
      if (picked.length >= count) break;
      if (picked.every(([px, pz]) => Math.hypot(px - x, pz - z) > gap)) picked.push([x, z]);
    }
    return picked;
  }

  update(dt: number, time: number, env: CreatureEnv): void {
    const s = this.stimuli;
    const input = env.input;
    this.voices.setOutput(env.audio);
    s.camera = env.camera;
    s.glider = env.glider;
    s.walker = env.walker;
    s.life = env.life;
    s.breeze = env.breeze;
    s.night = env.night;
    s.gustAt = input.present && input.gust > 4 ? this.gustPoint.copy(input.world) : null;
    const up = s.updraft;
    if (input.present && input.charge > 0) {
      const snap = up.strength < 0.05 ? 1 : 1 - Math.exp(-dt * 6);
      up.x += (input.updraftAt.x - up.x) * snap;
      up.z += (input.updraftAt.z - up.z) * snap;
      up.strength = Math.max(up.strength, input.charge);
    } else {
      up.strength = Math.max(0, up.strength - dt * 0.7);
    }
    this.rabbits.update(dt, time, s);
    this.songbirds.update(dt, time, s);
    this.gulls.update(dt, time, s);
    this.butterflies.update(dt, time, s);
    this.sheep.update(dt, time, s);
  }
}

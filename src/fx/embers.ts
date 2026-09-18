import * as THREE from 'three';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';

const SPARKS = 300;
const COALS = 10;
const COUNT = SPARKS + COALS;
/** How far from the child sparks are kept; any that get further away are quietly moved back in. */
const RANGE = 34;
/** Below this a spark is out, and anything brighter counts toward a light the child can follow. */
const LIT = 0.24;
/** The most heat a spark woken out of bare litter can hold: cinders, never a fire on their own. */
const CINDER = 0.3;

const VERT = /* glsl */ `
in vec4 aSpark;
in float aSize;
out vec2 vUv;
out float vHeat;
out vec3 vWorld;
out float vCoal;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vWorld = aSpark.xyz + (right * position.x + up * position.y) * aSize;
  vUv = position.xy;
  vHeat = aSpark.w;
  vCoal = aSize > 0.2 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in float vHeat;
in vec3 vWorld;
in float vCoal;
void main() {
  float r = length(vUv);
  float core = 1.0 - smoothstep(0.0, 0.3 + vCoal * 0.12, r);
  float halo = (1.0 - smoothstep(0.05, 1.0, r)) * (0.4 + vCoal * 0.45);
  float a = (core + halo) * vHeat;
  if (a < 0.004) discard;
  /** Hot at the heart, going red as it cools, so a dying ember reads as dying rather than as a dimmer lamp. */
  vec3 col = mix(vec3(1.0, 0.22, 0.04), vec3(1.0, 0.66, 0.26), smoothstep(0.15, 0.9, vHeat));
  col = mix(col, vec3(1.0, 0.86, 0.6), vCoal * smoothstep(0.7, 1.6, vHeat) * 0.3);
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(col * (1.0 + (2.2 - vCoal * 1.35) * vHeat) * (1.0 - f.a * 0.75), a);
}`;

interface Spark {
  p: THREE.Vector3;
  v: THREE.Vector3;
  heat: number;
  max: number;
  seed: number;
}

/**
 * One coal in the leaf litter: the thing the player blows on. Unlit it breathes a faint red, just enough to be
 * seen and gone for in the dark; a gust across it takes it, and then it burns down again unless it is fanned.
 */
export interface Coal {
  readonly p: THREE.Vector3;
  /** How steadily it is burning, 0 to 1. */
  heat: number;
  /** The rush of a gust across it, on top of the heat: what throws the light and the sparks. */
  flare: number;
  lit: boolean;
  /** How much breath an unlit coal has had, 0 to 1. */
  wake: number;
  live: boolean;
  /** When it was laid: the gust that lit the last one must not run straight on into this one. */
  laid: number;
  seed: number;
}

/**
 * Embers in the leaf litter of the dark wood. In every other room the wind is seen in the grass; here there is no
 * grass and no light, and the wind is seen only in what it does to fire: a gust wakes a coal and it goes up in a
 * rush of sparks, and the child walks toward wherever the player has made it bright. The light is the only path.
 *
 * The room lays the coals (`lay`) one ahead of the last, so there is always exactly one obvious thing to blow on.
 * Anywhere else a gust still stirs cinders out of the wet leaves: the wind always answers, it just cannot walk a
 * child anywhere without a coal.
 */
export class Embers {
  readonly mesh: THREE.Mesh;
  /** 0 nothing showing, 1 fully awake: the story fades them in with the wood and out again with the dawn. */
  presence = 0;
  readonly coals: Coal[] = [];
  private readonly sparks: Spark[] = [];
  private readonly attr: THREE.InstancedBufferAttribute;
  private readonly sizes: THREE.InstancedBufferAttribute;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private readonly centre = new THREE.Vector3();
  private readonly near = new THREE.Vector3();
  private readonly caught: Coal[] = [];
  private lit = 0;
  private clock = 0;

  constructor(private readonly wind: WindField) {
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.sizes = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSpark', this.attr);
    geo.setAttribute('aSize', this.sizes);
    geo.instanceCount = COUNT;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    for (let i = 0; i < SPARKS; i++) {
      this.sparks.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), heat: 0, max: CINDER, seed: Math.random() * 6.28 });
    }
    for (let i = 0; i < COALS; i++) {
      this.coals.push({ p: new THREE.Vector3(), heat: 0, flare: 0, lit: false, wake: 0, live: false, laid: 0, seed: Math.random() * 6.28 });
    }
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: atmo.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Lays an unlit coal in the litter, taking the oldest slot back if they are all in use. */
  lay(x: number, z: number): Coal {
    let coal = this.coals.find((c) => !c.live);
    if (!coal) {
      coal = this.coals[0];
      for (const c of this.coals) if (c.heat + c.wake < coal.heat + coal.wake) coal = c;
    }
    coal.p.set(x, Math.max(heightAt(x, z), 0) + 0.07, z);
    coal.heat = 0;
    coal.flare = 0;
    coal.wake = 0;
    coal.lit = false;
    coal.live = true;
    coal.laid = this.clock;
    return coal;
  }

  /** Puts fire in a coal without the player, for the moments the room has to light itself. */
  blow(coal: Coal, amount = 1): void {
    coal.lit = true;
    coal.wake = 1;
    coal.heat = Math.max(coal.heat, amount);
    coal.flare = Math.max(coal.flare, amount * 1.4);
    this.throwSparks(coal, Math.round(10 * amount));
    this.caught.push(coal);
  }

  /** The coals that caught since the last call: the room answers them with light, sound and the next one. */
  takeCaught(): Coal[] {
    return this.caught.splice(0, this.caught.length);
  }

  /** Takes a coal out of play, for when the room needs the only thing glowing to be somewhere else. */
  douse(coal: Coal): void {
    coal.live = false;
    coal.lit = false;
    coal.heat = 0;
    coal.flare = 0;
    coal.wake = 0;
  }

  clearCoals(): void {
    for (const c of this.coals) {
      c.live = false;
      c.lit = false;
      c.heat = 0;
      c.flare = 0;
      c.wake = 0;
    }
  }

  /**
   * Wakes a few cinders somewhere on its own, without the player. The wood does this only when they have been
   * left with nothing to go on for a long time — it is the room breathing, not a hint.
   */
  kindle(x: number, z: number, radius: number, count: number, heat: number): void {
    let woken = 0;
    for (const s of this.sparks) {
      if (woken >= count) break;
      if (s.heat > LIT) continue;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      s.p.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
      s.p.y = Math.max(heightAt(s.p.x, s.p.z), 0) + 0.1 + Math.random() * 0.22;
      s.v.set(0, 0, 0);
      s.max = 1;
      s.heat = heat * (0.85 + Math.random() * 0.3);
      woken++;
    }
  }

  private throwSparks(coal: Coal, count: number): void {
    const w = this.wind.sample(coal.p.x, coal.p.z, this.sample);
    let thrown = 0;
    for (const s of this.sparks) {
      if (thrown >= count) break;
      if (s.heat > LIT) continue;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.5;
      s.p.set(coal.p.x + Math.cos(a) * r, coal.p.y + 0.05, coal.p.z + Math.sin(a) * r);
      s.v.set(w.x * 0.5 + Math.cos(a) * 0.7, 1.6 + Math.random() * 2.4, w.z * 0.5 + Math.sin(a) * 0.7);
      s.max = 1;
      s.heat = 0.55 + Math.random() * 0.45;
      thrown++;
    }
  }

  /**
   * Where the light is, for the child to walk toward. Not the centroid of everything burning — with a chain of
   * coals up a path that lands between two of them, in the dark — but the one best light near the child: the
   * brightest thing close enough to see by, which is the coal they just lit.
   */
  brightest(out: THREE.Vector3): number {
    if (this.lit > 0) out.copy(this.centre);
    return this.lit;
  }

  /**
   * How much fire there is within `radius` of a point. The centroid is the wrong question for "is that corner of
   * the wood lit" — a wide gust averages out to the middle of nowhere — so this asks about the corner itself.
   */
  heatNear(x: number, z: number, radius: number): number {
    if (this.presence <= 0.01) return 0;
    let sum = 0;
    const r2 = radius * radius;
    for (const s of this.sparks) {
      if (s.heat <= LIT) continue;
      const dx = s.p.x - x;
      const dz = s.p.z - z;
      if (dx * dx + dz * dz < r2) sum += s.heat - LIT;
    }
    for (const c of this.coals) {
      if (!c.live || !c.lit) continue;
      const dx = c.p.x - x;
      const dz = c.p.z - z;
      if (dx * dx + dz * dz < r2) sum += (c.heat + c.flare) * 2.5;
    }
    return sum * this.presence;
  }

  private stepCoals(dt: number, time: number): void {
    const t = tuning.wood;
    for (const c of this.coals) {
      if (!c.live) continue;
      const w = this.wind.sample(c.p.x, c.p.z, this.sample);
      /**
       * Only the player's own breath counts. Gust energy is written by their strokes alone, so the storm blowing
       * through the wood all night can never light a coal for them: the light in this room is theirs or nobody's.
       */
      const breath = w.energy;
      if (!c.lit) {
        if (time - c.laid < 1.4) continue;
        c.wake = Math.min(1, c.wake + breath * dt * t.catchRate);
        c.heat = c.wake * 0.12;
        if (c.wake >= 1) {
          c.lit = true;
          c.heat = 1;
          c.flare = 1.8;
          this.throwSparks(c, 26);
          this.caught.push(c);
        }
        continue;
      }
      /** Fanning a fire that is already going makes it roar up, throw more light, and burn down again after. */
      if (breath > 0.12) {
        c.flare = Math.min(t.flareMax, c.flare + breath * dt * 3.4);
        c.heat = Math.min(1, c.heat + breath * dt * 0.9);
        if (Math.random() < breath * dt * 6) this.throwSparks(c, 2);
      }
      c.flare *= Math.exp(-dt * 0.85);
      c.heat -= dt / t.burnFor;
      if (Math.random() < dt * (0.9 + c.flare)) this.throwSparks(c, 1);
      /** Burnt right out: it stops being anything at all, so the only glimmer left is the next one to blow on. */
      if (c.heat <= 0) {
        c.heat = 0;
        c.lit = false;
        c.live = false;
      }
      /** The flame leans downwind and rises and falls, so a lit coal is never a static lamp. */
      c.heat = Math.min(1, c.heat + 0.0004 * Math.sin(time * 3.1 + c.seed));
    }
  }

  private scatter(s: Spark, near: THREE.Vector3): void {
    const a = Math.random() * Math.PI * 2;
    const r = 2 + Math.sqrt(Math.random()) * RANGE;
    s.p.set(near.x + Math.cos(a) * r, 0, near.z + Math.sin(a) * r);
    s.p.y = Math.max(heightAt(s.p.x, s.p.z), 0) + 0.08 + Math.random() * 0.3;
    s.v.set(0, 0, 0);
    s.heat = 0;
    s.max = CINDER;
  }

  update(dt: number, near: THREE.Vector3, presence: number): void {
    this.clock += dt;
    const time = this.clock;
    this.presence += (presence - this.presence) * (1 - Math.exp(-dt * 0.7));
    this.mesh.visible = this.presence > 0.01;
    if (!this.mesh.visible) {
      this.lit = 0;
      return;
    }
    this.near.copy(near);
    this.stepCoals(dt, time);
    const t = tuning.wood;
    const data = this.attr.array as Float32Array;
    const sizes = this.sizes.array as Float32Array;
    for (let i = 0; i < SPARKS; i++) {
      const s = this.sparks[i];
      if (s.p.distanceToSquared(near) > RANGE * RANGE * 1.8 || (s.heat < 0.02 && Math.random() < dt * 0.5)) {
        this.scatter(s, near);
      }
      const w = this.wind.sample(s.p.x, s.p.z, this.sample);
      /** A gust is breath on a coal, and away from the coals it still turns up cinders out of the wet leaves. */
      s.heat = Math.min(s.max, s.heat + (w.energy * t.stir + w.lift * 1.3) * dt);
      s.heat *= Math.exp(-dt * (0.16 + 0.22 * s.heat + (s.max < 1 ? 0.5 : 0)));
      const ground = Math.max(heightAt(s.p.x, s.p.z), 0);
      const drag = 1 - Math.exp(-dt * 2.4);
      s.v.x += (w.x * 0.85 - s.v.x) * drag;
      s.v.z += (w.z * 0.85 - s.v.z) * drag;
      /** Hot ones ride their own heat upward and cold ones settle back into the litter. */
      s.v.y += (w.lift * 2.2 + s.heat * 1.15 - 0.55 - s.v.y * 1.6) * dt * 2.2;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < ground + 0.06) {
        s.p.y = ground + 0.06;
        s.v.y = Math.max(0, s.v.y);
      }
      const j = i * 4;
      data[j] = s.p.x;
      data[j + 1] = s.p.y;
      data[j + 2] = s.p.z;
      data[j + 3] = s.heat * this.presence;
      sizes[i] = 0.035 + s.heat * 0.1;
    }

    /** The light the child follows: the best single fire near them, not the average of the ones behind. */
    let best = 0;
    for (let i = 0; i < COALS; i++) {
      const c = this.coals[i];
      const j = (SPARKS + i) * 4;
      const breathe = c.live && !c.lit ? (0.42 + 0.2 * Math.sin(time * 1.6 + c.seed)) * (0.6 + 0.4 * c.wake) : 0;
      const shown = c.live ? (c.lit ? Math.min(1.2, c.heat + c.flare * 0.35) : breathe) * this.presence : 0;
      const size = c.live ? (c.lit ? 0.42 + c.heat * 0.16 + c.flare * 0.22 : 0.36) : 0;
      sizes[SPARKS + i] = size;
      data[j] = c.p.x;
      /** Stood clear of the floor, because a glow centred on the ground is cut in half by it. */
      data[j + 1] = c.p.y + size * 0.8;
      data[j + 2] = c.p.z;
      data[j + 3] = shown;
      if (!c.live || !c.lit) continue;
      const power = (c.heat + c.flare * t.flareLight) * t.coalLight;
      /** Falls off with distance, so a fire left far behind stops counting as light to walk by. */
      const reach = power / (1 + c.p.distanceToSquared(near) * 0.0025);
      if (reach > best) {
        best = reach;
        this.centre.copy(c.p);
        this.lit = reach;
      }
    }
    if (best <= 0) {
      /** No coal burning: the light is whatever cinders there are, which is never enough to walk toward. */
      this.centre.set(0, 0, 0);
      let weight = 0;
      for (const s of this.sparks) {
        if (s.heat <= LIT) continue;
        const k = s.heat - LIT;
        this.centre.addScaledVector(s.p, k);
        weight += k;
      }
      if (weight > 0) this.centre.divideScalar(weight);
      else this.centre.copy(near);
      this.lit = weight * this.presence;
    }
    this.attr.needsUpdate = true;
    this.sizes.needsUpdate = true;
  }
}

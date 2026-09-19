import * as THREE from 'three';
import { screenBrush } from '../creatures/motion';
import type { PointerInput } from '../input/pointer';
import { tuning } from '../tuning';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';

const SPARKS = 300;
const COALS = 10;
const CHIPS = 9;
const COUNT = SPARKS + COALS * CHIPS;
/** How far from the child sparks are kept; any that get further away are quietly moved back in. */
const RANGE = 34;
/** Below this a spark is out, and anything brighter counts toward a light the child can follow. */
const LIT = 0.24;
/** The most heat a spark woken out of bare litter can hold: cinders, never a fire on their own. */
const CINDER = 0.3;

const VERT = /* glsl */ `
in vec4 aSpark;
in float aSize;
in vec2 aShape;
out vec2 vUv;
out float vHeat;
out vec3 vWorld;
out vec2 vShape;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // A coal is a low splinter in a bed of ash; airborne sparks are long, fine flecks.
  vec2 scale = mix(vec2(0.48, 1.25), vec2(1.0, 0.48), aShape.y);
  vWorld = aSpark.xyz + (right * position.x * scale.x + up * position.y * scale.y) * aSize;
  vUv = position.xy;
  vHeat = aSpark.w;
  vShape = aShape;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in float vHeat;
in vec3 vWorld;
in vec2 vShape;
void main() {
  float seed = vShape.x;
  float coal = vShape.y;
  float angle = seed + sin(uTime * 2.0 + seed) * (1.0 - coal) * 0.5;
  vec2 q = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * vUv;
  float edge = abs(q.x) * 0.85 + abs(q.y) * 1.2;
  edge += coal * sin(q.x * 15.0 + seed) * sin(q.y * 11.0 - seed) * 0.1;
  float body = 1.0 - smoothstep(0.48, 0.85, edge);
  float crack = exp(-abs(q.y + sin(q.x * 8.0 + seed) * 0.13) * 32.0);
  float heart = (1.0 - smoothstep(0.05, 0.58, length(q))) * 0.4 + crack * coal * 0.45;
  float halo = exp(-dot(vUv, vUv) * 5.0) * 0.065;
  float pulse = 0.88 + 0.12 * sin(uTime * (3.0 + seed * 0.2) + seed);
  float a = (body * (0.6 + heart * 0.4) + halo) * min(vHeat, 1.0) * pulse;
  if (a < 0.004) discard;
  vec3 col = mix(vec3(0.9, 0.1, 0.015), vec3(1.0, 0.48, 0.09), smoothstep(0.15, 0.95, vHeat));
  col = mix(col, vec3(1.0, 0.78, 0.32), heart * smoothstep(0.4, 1.2, vHeat));
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(col * (1.2 + vHeat * 0.8) * (1.0 - f.a * 0.75), a);
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
  breath: number;
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
  private readonly caught: Coal[] = [];
  private readonly chipPositions = new Float32Array(COALS * CHIPS * 3);
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
    const shapes = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      shapes[i * 2] = Math.random() * Math.PI * 2;
      shapes[i * 2 + 1] = i >= SPARKS ? 1 : 0;
    }
    geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(shapes, 2));
    geo.instanceCount = COUNT;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    for (let i = 0; i < SPARKS; i++) {
      this.sparks.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), heat: 0, max: CINDER, seed: Math.random() * 6.28 });
    }
    for (let i = 0; i < COALS; i++) {
      this.coals.push({ p: new THREE.Vector3(), heat: 0, flare: 0, lit: false, wake: 0, live: false, laid: 0, breath: 0, seed: Math.random() * 6.28 });
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
    coal.breath = 0;
    coal.lit = false;
    coal.live = true;
    coal.laid = this.clock;
    const slot = this.coals.indexOf(coal);
    for (let chip = 0; chip < CHIPS; chip++) {
      const angle = chip * 2.39996 + coal.seed;
      const radius = chip === 0 ? 0 : 0.24 + Math.sqrt(chip / CHIPS) * 0.48;
      const x = coal.p.x + Math.cos(angle) * radius;
      const z = coal.p.z + Math.sin(angle) * radius;
      const j = (slot * CHIPS + chip) * 3;
      this.chipPositions[j] = x;
      this.chipPositions[j + 1] = Math.max(heightAt(x, z), 0) + 0.13;
      this.chipPositions[j + 2] = z;
    }
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
    this.caught.length = 0;
    this.lit = 0;
    for (const c of this.coals) {
      c.live = false;
      c.lit = false;
      c.heat = 0;
      c.flare = 0;
      c.wake = 0;
      c.breath = 0;
    }
  }

  /** Only motion across the visible coal feeds ignition; a distant gust or its fading wake cannot. */
  brush(camera: THREE.Camera, input: PointerInput, target: THREE.Vector3 | null, dt: number): number {
    for (const coal of this.coals) coal.breath = 0;
    if (!target || input.muted || !input.present) return 0;
    const t = tuning.wood;
    const aspect = (camera as THREE.PerspectiveCamera).aspect ?? 1;
    const travel = Math.hypot((input.ndc.x - input.prevNdc.x) * aspect, input.ndc.y - input.prevNdc.y);
    if (travel < t.brushTravelMin || dt <= 0) return 0;
    const touch = screenBrush(camera, target, input.prevNdc, input.ndc, t.brushRadius);
    // Accumulate distance brushed across the ember, independent of terrain projection or event rate.
    // Cap a single event so entering the canvas or a cursor jump cannot finish a coal.
    const breath = Math.sqrt(touch) * Math.min(travel, t.brushStepMax) / dt;
    const coal = this.coals.find(c => c.live && c.p === target);
    if (coal) coal.breath = breath;
    return breath;
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

  private stepCoals(dt: number, time: number): void {
    const t = tuning.wood;
    for (const c of this.coals) {
      if (!c.live) continue;
      const w = this.wind.sample(c.p.x, c.p.z, this.sample);
      // The field fans existing fires. Ignition additionally needs a fresh stroke across this coal.
      const breath = w.energy;
      if (!c.lit) {
        if (time - c.laid < 1.4) continue;
        c.wake = THREE.MathUtils.clamp(c.wake + (c.breath > 0 ? c.breath * t.catchRate : -t.wakeCool) * dt, 0, 1);
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
      const breathe = c.live && !c.lit ? (0.42 + 0.2 * Math.sin(time * 1.6 + c.seed)) * (0.6 + 0.4 * c.wake) : 0;
      const shown = c.live ? (c.lit ? Math.min(1.2, c.heat + c.flare * 0.35) : breathe) * this.presence : 0;
      for (let chip = 0; chip < CHIPS; chip++) {
        const index = SPARKS + i * CHIPS + chip;
        const j = index * 4;
        const ground = (i * CHIPS + chip) * 3;
        sizes[index] = c.live ? 0.16 + (0.5 + 0.5 * Math.sin(chip * 4.7 + c.seed)) * 0.14 : 0;
        data[j] = this.chipPositions[ground];
        data[j + 1] = this.chipPositions[ground + 1];
        data[j + 2] = this.chipPositions[ground + 2];
        data[j + 3] = shown * (0.65 + 0.35 * Math.sin(chip * 2.7 + time * 0.8 + c.seed) ** 2);
      }
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
    // Decorative cinders can never supply enough light to bypass an unlit coal.
    this.lit = best * this.presence;
    if (best <= 0) this.centre.copy(near);
    this.attr.needsUpdate = true;
    this.sizes.needsUpdate = true;
  }
}

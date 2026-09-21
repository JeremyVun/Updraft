import type * as THREE from 'three';
import { screenPan } from '../creatures/motion';
import { tuning } from '../tuning';
import type { Foley, MaterialSound } from './foley';
import type { WhaleSound } from '../fx/sealife/wake';
import { feltWind, Sway, type WindField, type WindSample } from '../wind/field';

interface Motion {
  value: number;
  active: boolean;
  next: number;
  strength: number;
}

/** Read actual visible motion; entry/resume establishes a baseline and never replays an action. */
export class WorldFoley {
  private sources = new WeakMap<object, Map<MaterialSound, Motion>>();
  private time = 0;
  private lastSplash = -Infinity;
  private lastSurface = -Infinity;
  private readonly clothSway = new WeakMap<THREE.Vector3, Sway>();
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };

  constructor(private readonly foley: Foley, private readonly camera: THREE.Camera) {}

  update(dt: number): void { this.time += dt; }

  /** Nearby laundry uses the same wind spring and flutter thresholds as the cloth shader. */
  cloth(points: readonly THREE.Vector3[], wind: WindField, dt: number, active: boolean): void {
    if (!active) return;
    const nearby = points.filter(at => this.camera.position.distanceToSquared(at) < tuning.audio.clothReach ** 2)
      .sort((a, b) => this.camera.position.distanceToSquared(a) - this.camera.position.distanceToSquared(b))
      .slice(0, tuning.audio.clothSources);
    for (const at of nearby) {
      let sway = this.clothSway.get(at);
      if (!sway) { sway = new Sway(); this.clothSway.set(at, sway); }
      const air = feltWind(wind.sample(at.x, at.z, this.air), wind.calm);
      sway.update(air.x, air.z, dt);
      const k = Math.max(0, Math.min(1, (Math.hypot(sway.x, sway.z) - tuning.washing.flutterFrom)
        / (tuning.washing.flutterFull - tuning.washing.flutterFrom)));
      this.flow(at, 'cloth', at, k * k * (3 - 2 * k) * tuning.audio.clothLevel, true);
    }
  }

  private heard(at: THREE.Vector3, near = tuning.audio.materialNear, far = tuning.audio.materialFar): number {
    const t = Math.max(0, Math.min(1, (this.camera.position.distanceTo(at) - near) / (far - near)));
    return 1 - t * t * (3 - 2 * t);
  }

  private state(source: object, kind: MaterialSound, value: number): Motion {
    let kinds = this.sources.get(source);
    if (!kinds) { kinds = new Map(); this.sources.set(source, kinds); }
    let state = kinds.get(kind);
    if (!state) { state = { value, active: false, next: 0, strength: 0 }; kinds.set(kind, state); }
    return state;
  }

  motion(source: object, kind: MaterialSound, at: THREE.Vector3, value: number, dt: number, active: boolean): void {
    const state = this.state(source, kind, value);
    const before = state.value;
    state.value = value;
    const wasActive = state.active;
    state.active = active;
    if (!active || !wasActive || dt <= 0) { state.strength = 0; return; }
    const speed = Math.abs(value - before) / dt;
    if (kind === 'door' && before >= 0.02 && value < 0.02) {
      this.foley.material('door', this.heard(at) * 0.7, screenPan(this.camera, at), true);
    }
    this.play(state, kind, at, Math.min(1, speed * 1.5));
  }

  flow(source: object, kind: MaterialSound, at: THREE.Vector3, strength: number, active: boolean): void {
    const state = this.state(source, kind, 0);
    const wasActive = state.active;
    state.active = active;
    if (kind === 'sail') {
      // A sustained luff is already carried by the wind. Sound only a fresh rise in tension,
      // with hysteresis so the squall's small oscillations cannot become a flapping loop.
      const before = state.value;
      state.value = strength;
      if (!active || !wasActive) { state.strength = strength; return; }
      state.strength = Math.min(state.strength, strength);
      const rise = strength - state.strength;
      if (strength <= before || rise < tuning.audio.sailRise) return;
      state.strength = strength;
      if (this.time < state.next) return; // Expire masked gusts; never replay them later.
      state.next = this.time + tuning.audio.sailEvery;
      const level = Math.min(1, rise) * tuning.audio.sailLevel * this.heard(at);
      if (level > 0.015) this.foley.material(kind, level, screenPan(this.camera, at));
      return;
    }
    if (!active) { state.strength = 0; return; }
    this.play(state, kind, at, strength);
  }

  private play(state: Motion, kind: MaterialSound, at: THREE.Vector3, strength: number): void {
    state.strength = Math.max(state.strength, strength);
    if (this.time < state.next) return;
    const level = state.strength * this.heard(at);
    if (level > 0.015) this.foley.material(kind, level, screenPan(this.camera, at));
    state.strength = 0;
    state.next = this.time + (kind === 'water' ? tuning.audio.waterEvery : tuning.audio.materialEvery);
  }

  splash(at: THREE.Vector3, strength: number, surfacing = false): void {
    const level = this.heard(at) * strength;
    const last = surfacing ? this.lastSurface : this.lastSplash;
    const every = surfacing ? tuning.audio.dolphinSurfaceEvery : tuning.audio.splashEvery;
    if (level < 0.015 || this.time - last < every) return;
    if (surfacing) this.lastSurface = this.time;
    else this.lastSplash = this.time;
    this.foley.material(surfacing ? 'dolphin-surface' : 'splash', level, screenPan(this.camera, at));
  }

  whale(kind: WhaleSound, at: THREE.Vector3): void {
    const level = this.heard(at, tuning.audio.whaleNear, tuning.audio.whaleFar) * tuning.audio.whaleLevel;
    if (level < 0.015) return;
    this.foley.material(kind, level, screenPan(this.camera, at));
  }
}

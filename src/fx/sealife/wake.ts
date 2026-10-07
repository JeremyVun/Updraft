import * as THREE from 'three';
import { BLOWHOLE, BOTTOM, FLUKE_HALF_SPAN, LENGTH, TOP, flukeEdges, halfWidthAt } from './anatomy';
import { FOAM, Marks, RING, SLICK } from './marks';
import { DROP, MIST, SPLASH, Spray } from './spray';
import { SPINE_N, SPINE_STEP, type WhaleRig } from './whale';

const DRIP_SPAN = 9;
const DRIP_CHORD = 4;
const DRIP_POINTS = DRIP_SPAN * DRIP_CHORD;
const rand = (lo: number, hi: number) => lo + (hi - lo) * Math.random();

export type WhaleSound = 'whale-surface' | 'whale-blow' | 'whale-drain' | 'whale-dive';

/**
 * Where the whale meets the sea: white water where the body breaks the surface or slides under, a calm slick
 * behind it, its breath, water pouring off the lifted flukes, and the splash as they slip under.
 */
export class WhaleWake {
  /** Fired with the visible water/breath event, wherever this whale surfaces in the journey. */
  onSound: ((kind: WhaleSound, x: number, y: number, z: number) => void) | null = null;
  private readonly prevTop = new Float32Array(SPINE_N);
  private readonly emergedAt = new Float32Array(SPINE_N);
  private readonly dripRest: { x: number; s: number }[] = [];
  private readonly dripNow = Array.from({ length: DRIP_POINTS }, () => new THREE.Vector3());
  private readonly dripPrev = Array.from({ length: DRIP_POINTS }, () => new THREE.Vector3());
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Vector3();
  private lastBlow = -1e9;
  private blowWas = -1;
  private notchWas = -1;
  private flukesUpAt = -1;
  private headBroke = false;
  /** Lying at the surface rather than travelling: no bow wave pushed ahead of the head. */
  private lying = false;
  private slickAt = 0;
  private fresh = true;
  /** Splashes, breath and drips grow more slowly than the body: a dream-sized whale is seen from far off. */
  private readonly size: number;
  /** World time of the last breath, so whoever is watching can answer it. */
  blewAt = -1e9;

  constructor(
    private readonly whale: WhaleRig,
    private readonly spray: Spray,
    private readonly foam: Marks,
    private readonly slicks: Marks,
  ) {
    this.size = Math.sqrt(whale.scale);
    for (let i = 0; i < DRIP_SPAN; i++) {
      const t = -0.95 + (1.9 * i) / (DRIP_SPAN - 1);
      const { lead, trail } = flukeEdges(t);
      for (let j = 0; j < DRIP_CHORD; j++) {
        const z = lead + ((trail - lead) * (j + 0.5)) / DRIP_CHORD;
        this.dripRest.push({ x: t * FLUKE_HALF_SPAN, s: -z / LENGTH });
      }
    }
  }

  /** `lying`: the whale is already at the surface, so its first frame is no surfacing and no breath. */
  reset(lying = false): void {
    this.prevTop.fill(lying ? 10 : -10);
    this.emergedAt.fill(-1e9);
    this.lastBlow = -1e9;
    this.blowWas = lying ? 1e9 : -1;
    this.notchWas = -1;
    this.flukesUpAt = -1;
    this.headBroke = lying;
    this.lying = lying;
    this.fresh = true;
  }

  update(dt: number, time: number): void {
    const w = this.whale;
    if (!w.active || dt <= 0) return;
    const k = w.scale;
    const hx = w.heading.x;
    const hz = w.heading.z;
    const angle = Math.atan2(hz, hx);
    let first = -1;
    let cx = 0;
    let cz = 0;
    let widest = 0;
    let shallow = 0;
    for (let i = 0; i < SPINE_N; i++) {
      const s = (i * SPINE_STEP) / LENGTH;
      const P = w.spine[i];
      const c = Math.cos(P.w);
      const top = P.y + TOP(Math.min(s, 1)) * c * k;
      const bottom = P.y + BOTTOM(Math.min(s, 1)) * c * k;
      if (top > 0 && this.prevTop[i] <= 0) this.emergedAt[i] = time;
      const rising = this.fresh ? 0 : (top - this.prevTop[i]) / dt;
      this.prevTop[i] = top;
      w.wet[i] = top > 0 ? Math.exp(-(time - this.emergedAt[i]) / 1.6) : 1;
      if (s > 0.97) continue;
      if (top > -0.35 && bottom < 0) {
        shallow++;
        cx += P.x;
        cz += P.z;
      }
      if (top <= 0 || bottom >= 0) continue;
      if (first < 0) first = i;
      const half = halfWidthAt(s, -P.y / (c * k)) * k;
      widest = Math.max(widest, half);
      const churn = 0.12 + Math.min(1.6, Math.abs(rising)) * 0.9 + (i === first && !this.lying ? 1.2 : 0);
      if (Math.random() < churn * dt) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const out = half + rand(0.2, 0.9);
        const along = rand(-0.5, 0.5) * SPINE_STEP * k;
        const strong = Math.min(0.85, 0.3 + Math.abs(rising) * 0.35);
        this.foam.add(FOAM, P.x + hz * side * out + hx * along, P.z - hx * side * out + hz * along, rand(0.4, 1.0), rand(3, 6), time, rand(0.6, 1) * strong, rand(0.15, 0.4), Math.random() * 6.28, rand(1, 1.8));
      }
      if (i === first && !this.lying && Math.random() < dt * 5) {
        this.foam.add(FOAM, P.x + hx * rand(0.2, 0.9), P.z + hz * rand(0.2, 0.9), rand(0.5, 1.0), rand(2, 3.5), time, 0.9, 0.35, angle, 1.6);
      }
    }

    if (shallow > 0 && time - this.slickAt > 1.1) {
      this.slickAt = time;
      this.slicks.add(SLICK, cx / shallow + rand(-0.5, 0.5), cz / shallow + rand(-0.5, 0.5), Math.max(widest, 1.2) + 1.0 + shallow * 0.03, rand(16, 22), time, 0.55, 0.08, angle + rand(-0.3, 0.3), rand(1.3, 1.8));
    }

    const blow = w.point(0, TOP(BLOWHOLE), BLOWHOLE, this.p);
    if (blow.y > 0.05 && this.blowWas <= 0.05 && time - this.lastBlow > 5) {
      this.lastBlow = this.blewAt = time;
      this.spray.blow(blow, w.heading, this.size);
      this.onSound?.('whale-blow', blow.x, blow.y, blow.z);
      this.ring(blow.x, blow.z, 1.2 * this.size, time, 0.8);
    }
    this.blowWas = blow.y;

    if (!this.headBroke && first >= 0 && (first * SPINE_STEP) / LENGTH < 0.3) {
      this.headBroke = true;
      const P = w.spine[first];
      this.onSound?.('whale-surface', P.x, 0, P.z);
      this.spray.splash(P.x + hx * 0.5 * k, P.z + hz * 0.5 * k, 1.2 * this.size, 0.45);
      this.burst(P.x, P.z, 2.2 * this.size, 10, time);
    }

    this.flukes(dt, time);
    this.fresh = false;
  }

  private flukes(dt: number, time: number): void {
    const w = this.whale;
    const notch = w.point(0, 0, 1, this.q);
    let lowest = 1e9;
    let highest = -1e9;
    for (let i = 0; i < DRIP_POINTS; i++) {
      this.dripPrev[i].copy(this.dripNow[i]);
      const p = w.point(this.dripRest[i].x, 0, this.dripRest[i].s, this.dripNow[i]);
      lowest = Math.min(lowest, p.y);
      highest = Math.max(highest, p.y);
    }
    const up = notch.y > 0.05;
    if (up && this.notchWas <= 0.05 && this.notchWas > -5) {
      this.flukesUpAt = time;
      this.onSound?.('whale-drain', notch.x, notch.y, notch.z);
      for (let k = 0; k < 50; k++) {
        const e = this.dripNow[Math.floor(Math.random() * DRIP_POINTS)];
        this.spray.emit(MIST, e.x, Math.max(e.y, 0.1), e.z, rand(-0.5, 0.5) * this.size, rand(0.3, 2) * this.size, rand(-0.5, 0.5) * this.size,
          0.22 * this.size, rand(1.5, 2.5), 0.4 * this.size, 0.2);
      }
    }
    if (!up && this.notchWas > 0.05 && this.flukesUpAt > 0) {
      this.onSound?.('whale-dive', notch.x, 0, notch.z);
      this.spray.splash(notch.x, notch.z, 1.4 * this.size, 0.75);
      this.burst(notch.x, notch.z, 2 * this.size, 10, time);
      this.slicks.add(SLICK, notch.x, notch.z, 3 * this.size, 30, time, 0.8, 0.09);
      this.ring(notch.x, notch.z, 1.8 * this.size, time, 0.9);
      this.flukesUpAt = -1;
    }
    this.notchWas = notch.y;
    if (this.flukesUpAt < 0 || dt <= 0) return;

    const since = time - this.flukesUpAt;
    const pour = 60 + 520 * Math.exp(-since / 1.0);
    const n = Math.floor(pour * dt + Math.random());
    const drain = Math.max(highest - lowest, 0.5);
    for (let k = 0; k < n; k++) {
      const i = Math.floor(Math.random() * DRIP_POINTS);
      const e = this.dripNow[i];
      // Water drains down the flukes, so it leaves from their lowest parts.
      if (e.y < 0.12 || Math.random() > 1 - (e.y - lowest) / drain) continue;
      const prev = this.dripPrev[i];
      const f = 0.2 / dt;
      this.spray.emit(
        DROP,
        e.x + rand(-0.06, 0.06),
        e.y,
        e.z + rand(-0.06, 0.06),
        (e.x - prev.x) * f + rand(-0.25, 0.25),
        (e.y - prev.y) * f - rand(0.1, 0.8),
        (e.z - prev.z) * f + rand(-0.25, 0.25),
        rand(0.018, 0.038) * this.size,
        2,
        0,
        rand(0.5, 0.9),
      );
    }
    if (Math.random() < dt * 10 * Math.exp(-since / 1.5)) {
      const e = this.dripNow[Math.floor(Math.random() * DRIP_POINTS)];
      if (e.y > 0.3) this.spray.emit(SPLASH, e.x, e.y, e.z, 0, -0.6, 0, 0.1 * this.size, 0.8, 0.12 * this.size, 0.3);
    }
  }

  private burst(x: number, z: number, radius: number, count: number, time: number): void {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + Math.random() * 0.5;
      const r = radius * rand(0.4, 1);
      this.foam.add(FOAM, x + Math.cos(a) * r, z + Math.sin(a) * r, rand(0.5, 1), rand(3, 5.5), time, rand(0.5, 0.85), rand(0.2, 0.4), a, rand(1, 1.6));
    }
    this.foam.add(FOAM, x, z, radius * 0.6, 3.5, time, 0.7, 0.3);
  }

  private ring(x: number, z: number, radius: number, time: number, strength: number): void {
    this.foam.add(RING, x, z, radius, 4, time, strength * 0.7, 1.2);
  }
}

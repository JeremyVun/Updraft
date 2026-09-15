import * as THREE from 'three';
import { atmo } from '../../world/atmosphere';
import { FLUKE_HINGE, LENGTH, SPINE_END, whaleGeometry } from './anatomy';
import { curve } from './curve';
import { GHOST_FRAG, GHOST_VERT, SPINE_N, WHALE_FRAG, WHALE_VERT } from './whaleShader';

export { SPINE_N };
export const SPINE_STEP = (SPINE_END * LENGTH) / (SPINE_N - 1);

/** The snout's track through the water, side on: along the heading (u) and up (y), from `at`. */
const TRACK: [number, number][] = [
  [-12, -5.0], [-7, -2.6], [-3, -0.8], [0, -0.05], [2.4, 0.18], [4.8, -0.25], [7.5, -1.2], [10.5, -2.0], [14, -2.0],
  [17, -1.0], [19.5, -0.1], [21.6, 0.22], [23.8, -0.2], [25.8, -1.3], [27.4, -3.2], [28.6, -6.1], [29.4, -10],
  [29.9, -16], [30.2, -24],
];
const START_U = -4.5;

/** Speed along the track over the surfacing, in units per second. */
const SPEED = curve([[0, 2.2], [3, 1.8], [5, 1.6], [9, 1.7], [12, 1.8], [15, 2.0], [17, 2.1], [19.5, 1.95], [23, 1.8], [27, 2.0]]);
/** The whole body lifts to breathe and sinks between breaths, so the tail stays down while the head is up. */
const RISE = curve([[0, 0], [4, 0], [6.5, -0.3], [8.5, -0.8], [10, -1.2], [11.5, -1.1], [13, -0.3], [14, 0], [15, 0.3], [18, 0.35], [21, 0.2]]);
/** Tail stock lifted against the track (radians): the flukes rise clear as the body tips down. */
const TAIL = curve([[0, 0], [18, 0], [19.5, -0.55], [21.5, -0.95], [23, -0.8], [25, 0]]);
const FLUKE = curve([[0, 0], [18, 0], [19.5, 0.35], [21.5, -0.08], [23, -0.22], [25, 0]]);
export const WHALE_DURATION = 29;

/** Arc-length samples of the track, extended straight beyond its ends. */
class Track {
  readonly length: number;
  private readonly u: Float32Array;
  private readonly y: Float32Array;
  private readonly step: number;

  constructor(points: [number, number][]) {
    const c = new THREE.CatmullRomCurve3(points.map(([u, y]) => new THREE.Vector3(u, y, 0)), false, 'centripetal');
    this.length = c.getLength();
    const n = Math.ceil(this.length / 0.1) + 1;
    const pts = c.getSpacedPoints(n - 1);
    this.u = new Float32Array(pts.map((p) => p.x));
    this.y = new Float32Array(pts.map((p) => p.y));
    this.step = this.length / (n - 1);
  }

  /** Writes u, y and the angle of travel at distance d along the track. */
  at(d: number, out: { u: number; y: number; angle: number }): void {
    const n = this.u.length;
    const k = Math.min(Math.max(Math.floor(d / this.step), 0), n - 2);
    const du = this.u[k + 1] - this.u[k];
    const dy = this.y[k + 1] - this.y[k];
    const t = (d - k * this.step) / this.step;
    out.u = this.u[k] + du * t;
    out.y = this.y[k] + dy * t;
    out.angle = Math.atan2(dy, du);
  }

  distanceTo(u: number): number {
    let k = 0;
    while (k < this.u.length - 1 && this.u[k + 1] < u) k++;
    return k * this.step;
  }
}

const TRACK_PATH = new Track(TRACK);
/** Snout distance along the track by time, integrated once from the speed curve. */
const TRAVEL = (() => {
  const dt = 1 / 30;
  const out = new Float32Array(Math.ceil(WHALE_DURATION / dt) + 2);
  let d = TRACK_PATH.distanceTo(START_U);
  for (let i = 0; i < out.length; i++) {
    out[i] = d;
    d += SPEED(i * dt) * dt;
  }
  return (t: number) => {
    const x = Math.min(Math.max(t / dt, 0), out.length - 1.001);
    const i = Math.floor(x);
    return out[i] + (out[i + 1] - out[i]) * (x - i);
  };
})();


/** A humpback surfacing: it rolls up to breathe twice, arches, lifts its flukes and dives. */
export class Whale {
  readonly mesh: THREE.Mesh;
  /** The same body under the surface, seen faintly through the water. */
  readonly ghost: THREE.Mesh;
  /** Seconds into the current surfacing; above WHALE_DURATION it is gone. */
  time = WHALE_DURATION;
  /** Spine samples from the snout back through the flukes: world position and pitch of the body there. */
  readonly spine = Array.from({ length: SPINE_N }, () => new THREE.Vector4());
  /** How freshly each part of the back has come out of the water (1 streaming, 0 dry). */
  readonly wet = new Float32Array(SPINE_N);
  readonly heading = new THREE.Vector3(0, 0, 1);
  private readonly origin = new THREE.Vector3();
  private readonly pitch = new Float32Array(SPINE_N);
  private readonly sample = { u: 0, y: 0, angle: 0 };
  private readonly uniforms;

  constructor() {
    this.uniforms = {
      uSpine: { value: this.spine },
      uWet: { value: this.wet },
      uHeading: { value: this.heading },
      uRoll: { value: 0 },
      uFin: { value: new THREE.Vector2() },
      uCurl: { value: 0 },
    };
    const skin = {
      uBack: { value: new THREE.Color('#2f3b48') },
      uBelly: { value: new THREE.Color('#e3e7df') },
    };
    const geometry = whaleGeometry();
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: WHALE_VERT,
        fragmentShader: WHALE_FRAG,
        uniforms: { ...atmo.uniforms, ...this.uniforms, ...skin, uSeaTint: { value: new THREE.Color('#5a8a9a') } },
        side: THREE.DoubleSide,
      }),
    );
    this.ghost = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader: GHOST_VERT,
        fragmentShader: GHOST_FRAG,
        uniforms: {
          ...atmo.uniforms,
          ...this.uniforms,
          ...skin,
          uDeep: { value: new THREE.Color('#0d4a66') },
          uAbsorb: { value: new THREE.Vector3(0.5, 0.13, 0.1) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      }),
    );
    for (const m of [this.mesh, this.ghost]) {
      m.frustumCulled = false;
      m.visible = false;
    }
    this.ghost.renderOrder = 1;
  }

  get active(): boolean {
    return this.time < WHALE_DURATION;
  }

  start(at: THREE.Vector3, heading: number): void {
    this.origin.set(at.x, 0, at.z);
    this.heading.set(Math.sin(heading), 0, Math.cos(heading));
    this.time = 0;
    this.pose();
  }

  update(dt: number): void {
    if (!this.active) return;
    this.time += dt;
    this.pose();
  }

  /** World position of a point on the body given across (x), up (y) and along (s) the rest pose. */
  point(x: number, y: number, s: number, out: THREE.Vector3): THREE.Vector3 {
    const fi = Math.min(Math.max(s / SPINE_END, 0), 1) * (SPINE_N - 1);
    const i = Math.min(Math.floor(fi), SPINE_N - 2);
    const t = fi - i;
    const a = this.spine[i];
    const b = this.spine[i + 1];
    const pitch = a.w + (b.w - a.w) * t;
    const roll = this.uniforms.uRoll.value;
    const rx = Math.cos(roll) * x - Math.sin(roll) * y;
    const ry = Math.sin(roll) * x + Math.cos(roll) * y;
    const h = this.heading;
    const c = Math.cos(pitch);
    const sn = Math.sin(pitch);
    // S = cross(U, F) with F = H c + Y sn and U = -H sn + Y c, which is the horizontal side vector (h.z, 0, -h.x).
    out.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    out.x += h.z * rx + -h.x * sn * ry;
    out.y += c * ry;
    out.z += -h.x * rx + -h.z * sn * ry;
    return out;
  }

  private pose(): void {
    const t = this.time;
    this.mesh.visible = this.ghost.visible = this.active;
    const head = TRAVEL(t);
    const rise = RISE(t);
    const tail = TAIL(t);
    const fluke = FLUKE(t);
    const beat = Math.sin(t * 1.7) * 0.05 * (1 - Math.min(1, Math.abs(tail) * 3));
    for (let i = 0; i < SPINE_N; i++) {
      const s = (i / (SPINE_N - 1)) * SPINE_END;
      TRACK_PATH.at(head - s * LENGTH, this.sample);
      const tailward = Math.min(Math.max((s - 0.55) / 0.4, 0), 1);
      const bend = tailward * tailward * (3 - 2 * tailward);
      this.pitch[i] = this.sample.angle + (tail + beat) * bend + (s > FLUKE_HINGE ? fluke : 0);
    }
    TRACK_PATH.at(head, this.sample);
    let u = this.sample.u;
    let y = this.sample.y + rise;
    for (let i = 0; i < SPINE_N; i++) {
      const p = this.spine[i];
      p.set(this.origin.x + this.heading.x * u, y, this.origin.z + this.heading.z * u, this.pitch[i]);
      if (i < SPINE_N - 1) {
        const mid = (this.pitch[i] + this.pitch[i + 1]) / 2;
        u -= Math.cos(mid) * SPINE_STEP;
        y -= Math.sin(mid) * SPINE_STEP;
      }
    }
    this.uniforms.uRoll.value = Math.sin(t * 0.4 + 1) * 0.05;
    this.uniforms.uFin.value.set(Math.sin(t * 0.6) * 0.12, 0.15 + Math.sin(t * 0.8 + 1) * 0.1);
    this.uniforms.uCurl.value = fluke * 0.3;
  }
}


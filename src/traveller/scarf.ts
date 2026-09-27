import * as THREE from 'three';
import type { WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { PALETTE } from './body';
import { KNIT_GLSL } from './child/shader';

/** Across the strip, as a flattened loop: wide faces front and back, rounded edges. */
const SECTION = 10;
const WIDTH = 0.2;
const THICK = 0.07;

const VERT = /* glsl */ `
in vec2 aSurf;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vSurf;
void main() {
  vWorld = position;
  vNormal = normal;
  vSurf = aSurf;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uColor;
uniform vec3 uGroundPos;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vSurf;
${KNIT_GLSL}
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float sun = groundAt(uGroundPos.xz).w * cloudShadow(uGroundPos.xz);
  /** Wool lets the low sun through its thin edges and glows red when the light is behind it. */
  float through = max(-ndl, 0.0) * 0.55 + pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.45;
  float st = knit(vSurf, 1.0);
  vec3 alb = uColor * (0.8 + 0.3 * st);
  float wrap = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
  float ground = mix(0.55, 1.0, smoothstep(0.0, 1.2, vWorld.y - uGroundPos.y));
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  float ao = ground * 0.85;
  vec3 col = alb * (hemiLight(N) * 1.05 * ao + uSunColor * (wrap * wrap * 0.9 * mix(0.6, 1.0, ao) + through * 0.4) * sun);
  col += uSunColor * alb * rim * 0.6 * sun;
  col += alb * (emberLight(vWorld, N) + lampLight(vWorld, N) + dawnLight(vWorld, N));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

interface End {
  pts: THREE.Vector3[];
  prev: THREE.Vector3[];
  /** Each point's sideways direction last frame, so the strip turns smoothly rather than flipping. */
  side: THREE.Vector3[];
  segment: number;
  /** Where on the knot it leaves from, in the frame of the child's body. */
  root: THREE.Vector3;
  /** A little of its own timing, so the two ends never move as one. */
  phase: number;
  offset: number;
}

/**
 * The scarf's two loose ends: knitted strips that hang from the knot on a chain of points. Not a cloth simulation:
 * each end streams where the air round the child would carry it, lags behind their moves and settles softly, with
 * a slow wave running down it in a breeze.
 */
export class Scarf {
  readonly mesh: THREE.Mesh;
  private readonly ends: End[];
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly geo = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly out = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly rootAt = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly face = new THREE.Vector3();
  private time = 0;

  constructor() {
    const end = (count: number, segment: number, root: THREE.Vector3, phase: number): End => ({
      pts: Array.from({ length: count }, (_, i) => new THREE.Vector3(0, -i * segment, 0)),
      prev: Array.from({ length: count }, (_, i) => new THREE.Vector3(0, -i * segment, 0)),
      side: Array.from({ length: count }, () => new THREE.Vector3(1, 0, 0)),
      segment,
      root,
      phase,
      offset: 0,
    });
    this.ends = [end(11, 0.105, new THREE.Vector3(0.03, -0.02, 0.01), 0), end(8, 0.095, new THREE.Vector3(-0.035, 0.005, 0.025), 2.1)];
    let verts = 0;
    for (const e of this.ends) {
      e.offset = verts;
      verts += (e.pts.length + 1) * SECTION + 2;
    }
    this.positions = new Float32Array(verts * 3);
    this.normals = new Float32Array(verts * 3);
    const surf = new Float32Array(verts * 2);
    const index: number[] = [];
    for (const e of this.ends) {
      const rings = e.pts.length + 1;
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < SECTION; j++) {
          const v = e.offset + i * SECTION + j;
          surf[v * 2] = (Math.min(i, e.pts.length - 1) * e.segment) / 1.12;
          surf[v * 2 + 1] = j / SECTION;
          if (i < rings - 1) {
            const a = e.offset + i * SECTION + j;
            const b = e.offset + i * SECTION + ((j + 1) % SECTION);
            index.push(a, b, a + SECTION, b, b + SECTION, a + SECTION);
          }
        }
      }
      /** The square-cut end, and the start tucked into the knot. */
      const cap = e.offset + rings * SECTION;
      for (const [c, ring, flip] of [[cap, rings - 1, false], [cap + 1, 0, true]] as const) {
        for (let j = 0; j < SECTION; j++) {
          const a = e.offset + ring * SECTION + j;
          const b = e.offset + ring * SECTION + ((j + 1) % SECTION);
          if (flip) index.push(c, b, a);
          else index.push(c, a, b);
        }
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSurf', new THREE.BufferAttribute(surf, 2));
    this.geo.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms, uColor: { value: PALETTE.scarf }, uGroundPos: { value: new THREE.Vector3() } },
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
  }

  /** Snaps both ends to hang from the knot (after teleporting the child). */
  reset(anchor: THREE.Vector3, body?: THREE.Matrix4): void {
    for (const e of this.ends) {
      this.rootAt.copy(anchor);
      if (body) this.rootAt.add(this.tmp.copy(e.root).transformDirection(body).multiplyScalar(e.root.length()));
      e.pts.forEach((p, i) => p.copy(this.rootAt).add(this.tmp.set(0, -i * e.segment * 0.8, i * e.segment * 0.5)));
      e.prev.forEach((p, i) => p.copy(e.pts[i]));
    }
  }

  /**
   * `anchor` is the knot, `body` the child's body frame, `keepOut` moves a point to the outside of the child,
   * `wind` is the air at the child, `ground` the surface height below.
   */
  update(dt: number, anchor: THREE.Vector3, body: THREE.Matrix4, keepOut: (p: THREE.Vector3) => void, wind: WindSample, ground: number, groundPos: THREE.Vector3): void {
    this.time += dt;
    const h = Math.min(Math.max(dt, 1e-4), 1 / 30);
    const speed = Math.hypot(wind.x, wind.z);
    const gust = Math.min(1, speed / 14 + wind.energy * 0.5);
    /** Sideways to the wind, for the wave that runs down a streaming end. */
    const crossX = speed > 1e-3 ? -wind.z / speed : 1;
    const crossZ = speed > 1e-3 ? wind.x / speed : 0;
    for (const e of this.ends) {
      this.rootAt.copy(anchor).add(this.tmp.copy(e.root).transformDirection(body).multiplyScalar(e.root.length()));
      const n = e.pts.length;
      e.pts[0].copy(this.rootAt);
      e.prev[0].copy(this.rootAt);
      for (let i = 1; i < n; i++) {
        const p = e.pts[i];
        const q = e.prev[i];
        const f = i / (n - 1);
        const t = this.time * (2.6 + gust * 3) - i * 0.4 + e.phase;
        /** A slow wave down the length, growing toward the free end: wool is heavy, it undulates, it does not flap. */
        const wave = Math.sin(t) * (0.3 + gust * 1.7) * f;
        const vx = (p.x - q.x) / h;
        const vy = (p.y - q.y) / h;
        const vz = (p.z - q.z) / h;
        /** The air takes it: its own velocity is drawn toward the wind's, strongly, so it streams and settles. */
        const drag = 2.6;
        const ax = (wind.x * 1.3 - vx) * drag + wave * crossX * 1.4;
        const az = (wind.z * 1.3 - vz) * drag + wave * crossZ * 1.4;
        const ay = -7.5 + gust * 6 + wind.lift * 5 + Math.sin(t * 0.7 + 1.3) * (0.4 + gust * 1.6) * f - vy * 1.2;
        this.tmp.copy(p);
        p.x += vx * h * 0.94 + ax * h * h;
        p.y += vy * h * 0.94 + ay * h * h;
        p.z += vz * h * 0.94 + az * h * h;
        q.copy(this.tmp);
      }
      for (let k = 0; k < 5; k++) {
        e.pts[0].copy(this.rootAt);
        for (let i = 1; i < n; i++) {
          const a = e.pts[i - 1];
          const b = e.pts[i];
          this.dir.subVectors(b, a);
          const len = this.dir.length() || 1e-5;
          b.copy(a).addScaledVector(this.dir, e.segment / len);
          if (i > 1) keepOut(b);
          if (b.y < ground + 0.04) b.y = ground + 0.04;
        }
        /** Knitted wool is heavy and soft: no kinks, however the points were pushed about. */
        for (let i = 1; i < n - 1; i++) {
          this.a.addVectors(e.pts[i - 1], e.pts[i + 1]).multiplyScalar(0.5);
          e.pts[i].lerp(this.a, 0.3);
        }
      }
    }
    this.write(groundPos);
    this.material.uniforms.uGroundPos.value.copy(groundPos);
  }

  private write(axis: THREE.Vector3): void {
    const P = this.positions;
    const N = this.normals;
    for (const e of this.ends) {
      const n = e.pts.length;
      const rings = n + 1;
      /**
       * The strip's broad face is carried down its length from the knot, turning only as much as the length turns,
       * so it can never flip edge-on from one point to the next. At the knot it lies against the child.
       */
      this.dir.subVectors(e.pts[1], e.pts[0]).normalize();
      this.out.set(e.pts[0].x - axis.x, 0, e.pts[0].z - axis.z);
      if (this.out.lengthSq() < 1e-6) this.out.set(0, 0, 1);
      this.out.addScaledVector(this.dir, -this.out.dot(this.dir)).normalize();
      this.n.copy(this.out);
      for (let i = 0; i < rings; i++) {
        const k = Math.min(i, n - 1);
        const a = e.pts[Math.max(0, k - 1)];
        const b = e.pts[Math.min(n - 1, k + 1)];
        this.tmp.subVectors(b, a).normalize();
        this.turn.setFromUnitVectors(this.dir, this.tmp);
        this.n.applyQuaternion(this.turn);
        this.dir.copy(this.tmp);
        this.n.addScaledVector(this.dir, -this.n.dot(this.dir)).normalize();
        let side = this.a.crossVectors(this.dir, this.n).normalize();
        if (i === 0 && side.dot(e.side[k]) < 0) {
          this.n.negate();
          side = this.a.crossVectors(this.dir, this.n).normalize();
        }
        side.lerp(e.side[k], 0.5).normalize();
        e.side[k].copy(side);
        const f = k / (n - 1);
        side.applyAxisAngle(this.dir, Math.sin(this.time * 1.7 + k * 0.3 + e.phase) * 0.14 * f);
        const face = this.face.crossVectors(side, this.dir).normalize();
        /** The last ring is pulled back along the strip to square off the end. */
        const centre = this.b.copy(e.pts[k]);
        if (i === rings - 1) centre.addScaledVector(this.dir, 0.02);
        /** Knitted wool stretches and gathers: the width breathes a little along it. */
        const w = WIDTH * 0.5 * (k === 0 ? 0.6 : 1 + 0.07 * Math.sin(k * 1.3 + this.time * 1.9 + e.phase));
        for (let j = 0; j < SECTION; j++) {
          const ang = (j / SECTION) * Math.PI * 2;
          const c = Math.cos(ang);
          const s = Math.sin(ang);
          /** A flattened loop: nearly flat across the faces, rounded at the edges. */
          const edge = Math.sign(c) * Math.pow(Math.abs(c), 0.35);
          const across = edge * w;
          /** A slight curl across it, edges turned toward the face, the way a knitted strip rolls. */
          const through = s * THICK * 0.5 + edge * edge * 0.018;
          const o = (e.offset + i * SECTION + j) * 3;
          P[o] = centre.x + side.x * across + face.x * through;
          P[o + 1] = centre.y + side.y * across + face.y * through;
          P[o + 2] = centre.z + side.z * across + face.z * through;
          const nx = side.x * c * 0.5 + face.x * s;
          const ny = side.y * c * 0.5 + face.y * s;
          const nz = side.z * c * 0.5 + face.z * s;
          const l = Math.hypot(nx, ny, nz) || 1;
          N[o] = nx / l;
          N[o + 1] = ny / l;
          N[o + 2] = nz / l;
        }
      }
      const cap = e.offset + rings * SECTION;
      for (const [c, k] of [[cap, n - 1], [cap + 1, 0]] as const) {
        this.dir.subVectors(e.pts[Math.min(n - 1, k + 1)], e.pts[Math.max(0, k - 1)]).normalize();
        const p = this.b.copy(e.pts[k]);
        if (k === n - 1) p.addScaledVector(this.dir, 0.02);
        const o = c * 3;
        P[o] = p.x;
        P[o + 1] = p.y;
        P[o + 2] = p.z;
        const sign = k === 0 ? -1 : 1;
        N[o] = this.dir.x * sign;
        N[o + 1] = this.dir.y * sign;
        N[o + 2] = this.dir.z * sign;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
}

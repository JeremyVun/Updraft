import * as THREE from 'three';
import { tuning } from '../tuning';
import type { WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { PALETTE } from './body';
import { KNIT_GLSL } from './child/shader';

/** Across the strip, as a flattened loop: wide faces front and back, rounded edges. */
const SECTION = 10;
const WIDTH = 0.25;
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
  /** Where it left the knot last frame, so the root travels smoothly through the steps in between. */
  from: THREE.Vector3;
  /** How far round from straight behind toward the knot's side the breeze carries it, and how well the air holds
   * it up: the two ends splay apart, the shorter one lower. */
  splay: number;
  lift: number;
  /** A little of its own timing, so the two ends never move as one. */
  phase: number;
  /** How far the ripple running down it stands out of its face, by how hard the air is streaming past. */
  ripple: number;
  offset: number;
}

/** Steps no longer than this, so the ends swing alike at any frame rate. */
const STEP = 1 / 60;
/** Faster than the child ever goes: a jump in the knot's position is a teleport, not a speed. */
const MAX_CARRY = 15;
/** How far each step draws a point toward its neighbours: enough to smooth a kink, not to stiffen the wave. */
const SOFT = 0.06;

/**
 * The scarf's two loose ends: knitted strips on a chain of points, streaming from the knot. Not a cloth simulation:
 * each end is carried by the air round the child, a breeze of the dream's own that always lifts them out behind,
 * the air of their walking, and any gust the player makes; they lag behind turns, starts and stops and settle
 * softly, with a slow wave running down them.
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
  private readonly rootNow = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly face = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  /** The child's velocity over the ground, smoothed of the bob in their stride. */
  private readonly carried = new THREE.Vector3();
  private readonly gust = new THREE.Vector3();
  private readonly lastAnchor = new THREE.Vector3();
  private anchored = false;
  private lastStep = STEP;
  private wave = 0;
  private time = 0;

  constructor() {
    const end = (count: number, segment: number, root: THREE.Vector3, splay: number, lift: number, phase: number): End => ({
      pts: Array.from({ length: count }, (_, i) => new THREE.Vector3(0, -i * segment, 0)),
      prev: Array.from({ length: count }, (_, i) => new THREE.Vector3(0, -i * segment, 0)),
      side: Array.from({ length: count }, () => new THREE.Vector3(1, 0, 0)),
      segment,
      root,
      from: new THREE.Vector3(),
      splay,
      lift,
      phase,
      ripple: 0,
      offset: 0,
    });
    this.ends = [
      end(13, 0.1, new THREE.Vector3(0.03, -0.02, 0.01), 0.75, 1, 0),
      end(9, 0.1, new THREE.Vector3(-0.035, 0.005, 0.025), 1.2, 0.7, 2.1),
    ];
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
      this.dir.set(Math.sin(e.splay) * 0.5, -0.75, -Math.cos(e.splay) * 0.5);
      if (body) this.dir.transformDirection(body);
      e.pts.forEach((p, i) => p.copy(this.rootAt).addScaledVector(this.dir, i * e.segment));
      e.prev.forEach((p, i) => p.copy(e.pts[i]));
      e.from.copy(this.rootAt);
    }
    this.lastAnchor.copy(anchor);
    this.carried.set(0, 0, 0);
    this.gust.set(0, 0, 0);
    this.anchored = true;
  }

  /**
   * `anchor` is the knot, `body` the child's body frame, `keepOut` moves a point to the outside of the child,
   * `wind` is the air at the child, `ground` the surface height below, `facing` the child's heading, and `still`
   * how far they are tucked up in bed, out of the breeze.
   */
  update(dt: number, anchor: THREE.Vector3, body: THREE.Matrix4, keepOut: (p: THREE.Vector3) => void, wind: WindSample,
    ground: number, groundPos: THREE.Vector3, facing: number, still: number): void {
    if (!this.anchored) this.reset(anchor, body);
    const k = tuning.scarf;
    const span = Math.min(Math.max(dt, 1e-4), 0.1);
    this.time += span;
    this.tmp.set((anchor.x - this.lastAnchor.x) / span, 0, (anchor.z - this.lastAnchor.z) / span);
    if (this.tmp.length() > MAX_CARRY) this.tmp.copy(this.carried);
    this.tmp.lerpVectors(this.carried, this.tmp, 1 - Math.exp(-span * 8));
    /** Starting and stopping swing the ends back and forward, but only a share of what the child's own speed would. */
    const lurchX = ((this.carried.x - this.tmp.x) / span) * k.inertia;
    const lurchZ = ((this.carried.z - this.tmp.z) / span) * k.inertia;
    this.carried.copy(this.tmp);
    this.lastAnchor.copy(anchor);
    const moveX = this.carried.x;
    const moveZ = this.carried.z;

    /**
     * Only air with a gust in it counts: the rest round the child is mostly the air they drag along themselves. A
     * gust is caught at once and let go slowly, so its passing is seen.
     */
    const arrived = THREE.MathUtils.smoothstep(wind.energy, tuning.wind.arriveFrom, tuning.wind.arriveFull);
    const gx = wind.x * arrived;
    const gz = wind.z * arrived;
    const catching = gx * gx + gz * gz > this.gust.x * this.gust.x + this.gust.z * this.gust.z;
    this.tmp.set(gx, 0, gz);
    this.gust.lerp(this.tmp, 1 - Math.exp(-span * (catching ? k.gustCatch : k.gustRelease)));
    const gust = Math.hypot(this.gust.x, this.gust.z);
    const swell = 1 + k.breezeSwell * (0.6 * Math.sin(this.time * 0.63) + 0.4 * Math.sin(this.time * 1.37 + 2));
    const breeze = k.breeze * swell * (1 - still);
    const cos = Math.cos(facing);
    const sin = Math.sin(facing);
    const takeover = Math.min(1, gust / k.gustTakeover);
    /**
     * The way the gust blows in the child's frame, from straight behind round to their left; the cut is ahead and
     * to their right, where the ends never lie.
     */
    let gustAngle = Math.atan2(this.gust.x * cos - this.gust.z * sin, -(this.gust.x * sin + this.gust.z * cos));
    if (gustAngle < -2.4) gustAngle += Math.PI * 2;
    const pace = Math.hypot(this.carried.x, this.carried.z) * k.carry;
    const steps = Math.max(1, Math.ceil(span / STEP - 1e-3));
    const h = span / steps;
    let rate = 0;

    for (const e of this.ends) {
      /**
       * The air past the child that the end streams on, in their frame: the breeze, out behind and round toward the
       * knot's side, and the air of their going, straighter behind. A gust swings it round to its own way and never
       * weakens it, so the ends follow a gust rather than falling slack where it meets the breeze.
       */
      const left = Math.sin(e.splay) * breeze + Math.sin(e.splay * 0.5) * pace;
      const back = Math.cos(e.splay) * breeze + Math.cos(e.splay * 0.5) * pace;
      const own = Math.hypot(left, back);
      const angle = THREE.MathUtils.lerp(Math.atan2(left, back), gustAngle, takeover);
      const strength = THREE.MathUtils.lerp(own, Math.max(gust, own), takeover);
      const bx = Math.sin(angle) * strength;
      const bz = -Math.cos(angle) * strength;
      const flowX = bx * cos + bz * sin;
      const flowZ = bz * cos - bx * sin;
      const flow = Math.hypot(flowX, flowZ);
      const full = Math.min(1, flow / k.liftSpeed);
      const lift = k.lift * e.lift * full * (2 - full);
      rate = Math.max(rate, THREE.MathUtils.lerp(k.waveRate, k.waveRateFast, full));
      /** Sideways to the air going past, for the wave; in still air, across the child. */
      const crossX = flow > 1e-3 ? -flowZ / flow : cos;
      const crossZ = flow > 1e-3 ? flowX / flow : -sin;
      const breathe = 0.75 + 0.25 * Math.sin(this.time * 0.31 + e.phase);
      const swing = (k.wave * Math.min(1, flow / k.breeze) + k.waveFast * full) * breathe;
      e.ripple = k.ripple * Math.min(1, flow / k.breeze) * (0.5 + 0.5 * full) * breathe;
      this.rootNow.copy(anchor).add(this.tmp.copy(e.root).transformDirection(body).multiplyScalar(e.root.length()));
      const n = e.pts.length;
      let last = this.lastStep;
      for (let s = 1; s <= steps; s++) {
        this.rootAt.lerpVectors(e.from, this.rootNow, s / steps);
        e.pts[0].copy(this.rootAt);
        e.prev[0].copy(this.rootAt);
        const carry = h / last;
        for (let i = 1; i < n; i++) {
          const p = e.pts[i];
          const q = e.prev[i];
          const f = i / (n - 1);
          /** A slow wave down the length, growing toward the free end: wool is heavy, it undulates, it does not flap. */
          const t = this.wave - i * 0.7 + e.phase;
          const across = Math.sin(t) * swing * f;
          const rise = Math.sin(t * 0.7 + 1.1) * swing * 0.3 * f;
          const vx = (p.x - q.x) / last;
          const vy = (p.y - q.y) / last;
          const vz = (p.z - q.z) / last;
          /** Near the knot the child's body shelters it from the air. */
          const open = 0.4 + 0.6 * f;
          const ax = (flowX * open - vx) * k.drag + crossX * across + lurchX;
          const az = (flowZ * open - vz) * k.drag + crossZ * across + lurchZ;
          /**
           * The air holds up the middle of an end more than the part near the knot, so it droops from the knot and
           * then streams, and a little more than the very end, which dips.
           */
          const held = 0.3 + 0.7 * THREE.MathUtils.smoothstep(f, 0, 0.6) * (1 - 0.3 * THREE.MathUtils.smoothstep(f, 0.6, 1));
          const ay = -k.gravity * (1 - lift * held) - vy * k.drag + rise + wind.lift * k.updraft;
          /** It moves in the child's company: the chain keeps only its own motion from step to step, not theirs. */
          this.tmp.set(p.x + moveX * h, p.y, p.z + moveZ * h);
          p.x += (p.x - q.x) * carry + ax * h * h + moveX * h;
          p.y += (p.y - q.y) * carry + ay * h * h;
          p.z += (p.z - q.z) * carry + az * h * h + moveZ * h;
          q.copy(this.tmp);
        }
        for (let it = 0; it < 2; it++) {
          /** Knitted wool is heavy and soft: no kinks, however the points were pushed about. */
          for (let i = 1; i < n - 1; i++) {
            this.a.addVectors(e.pts[i - 1], e.pts[i + 1]).multiplyScalar(0.5);
            e.pts[i].lerp(this.a, SOFT);
          }
          for (let i = 1; i < n; i++) {
            const a = e.pts[i - 1];
            const b = e.pts[i];
            this.dir.subVectors(b, a);
            const len = this.dir.length() || 1e-5;
            b.copy(a).addScaledVector(this.dir, e.segment / len);
            if (i > 1) keepOut(b);
            if (b.y < ground + 0.04) b.y = ground + 0.04;
          }
        }
        last = h;
      }
      e.from.copy(this.rootNow);
    }
    this.lastStep = h;
    this.wave += rate * span;
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
        /** The strip turns a little about its length as the wave runs down it, showing more of its face, then less. */
        side.applyAxisAngle(this.dir, Math.sin(this.wave * 0.8 - k * 0.5 + e.phase) * 0.3 * f);
        const face = this.face.crossVectors(side, this.dir).normalize();
        /** A ripple running down it through its face, the way a streaming strip of wool billows. */
        const ph = this.wave * 1.25 - k * 0.9 + e.phase * 1.7;
        const amp = e.ripple * Math.pow(f, 1.3);
        const centre = this.b.copy(e.pts[k]).addScaledVector(face, amp * Math.sin(ph));
        face.addScaledVector(this.dir, (amp * 0.9 * Math.cos(ph)) / e.segment).normalize();
        /** The last ring is pulled back along the strip to square off the end. */
        if (i === rings - 1) {
          centre.addScaledVector(this.dir, 0.02);
          this.tip.copy(centre);
        }
        /** Knitted wool stretches and gathers: the width breathes a little along it. */
        const w = WIDTH * 0.5 * (k === 0 ? 0.6 : 1 + 0.07 * Math.sin(k * 1.3 + this.time * 1.9 + e.phase)) * (1 + 0.12 * f * f);
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
        const p = k === 0 ? this.b.copy(e.pts[0]) : this.b.copy(this.tip);
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

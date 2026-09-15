import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import type { FlowerPatch } from '../world/landmarks';
import { mulberry32 } from '../world/noise';
import type { Habitat } from './habitat';
import { ease, easeAngle, range, type Rng } from './motion';
import { CREATURE_GLSL } from './shading';
import { Instances, blob, flipWinding, merge, tag } from './shapes';
import type { Stimuli } from './stimuli';

const WING_L = 0;
const WING_R = 1;
const BODY = 2;

const VERT = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in float aPart;
in vec2 aMat;
in vec4 iPos;
in vec4 iAtt;
in vec4 iLook;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
out float vPart;
out vec2 vLook;

void main() {
  int part = int(aPart + 0.5);
  vec3 p = position * iLook.y;
  vec3 n = normal;
  if (part != ${BODY}) {
    float side = part == ${WING_L} ? 1.0 : -1.0;
    float hind = 1.0 - smoothstep(0.35, 0.6, aMat.y);
    float a = side * (iAtt.x - hind * 0.12);
    p = rotZ(p, a);
    n = rotZ(n, a);
  }
  p = rotZ(rotX(p, iAtt.y), iAtt.z);
  n = rotZ(rotX(n, iAtt.y), iAtt.z);
  vec3 world = rotY(p, iPos.w) + iPos.xyz;
  vWorld = world;
  vNormal = rotY(n, iPos.w);
  vUv = aMat;
  vPart = aPart;
  vLook = iLook.xz;
  gl_Position = projectionMatrix * nudgedView(world, iLook.w);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${CREATURE_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
in float vPart;
in vec2 vLook;

float ellipse(vec2 p, vec2 c, vec2 r, float a) {
  vec2 d = p - c;
  d = vec2(cos(a) * d.x + sin(a) * d.y, -sin(a) * d.x + cos(a) * d.y) / r;
  return length(d);
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  int kind = int(vLook.x + 0.5);
  vec3 alb;
  float thin;
  float alpha = 1.0;
  if (vPart > 1.5) {
    alb = vec3(0.08, 0.07, 0.06);
    thin = 0.0;
  } else {
    vec2 uv = vUv;
    float fore = ellipse(uv, vec2(0.46, 0.66), vec2(0.56, 0.3), 0.45);
    float hind = ellipse(uv, vec2(0.33, 0.3), vec2(0.36, 0.3), -0.2);
    float shape = min(fore, hind);
    float aa = fwidth(shape) * 1.2;
    alpha = 1.0 - smoothstep(1.0 - aa, 1.0, shape);
    if (alpha < 0.02) discard;
    float veins = smoothstep(0.85, 1.0, abs(sin(atan(uv.y - 0.48, uv.x) * 11.0))) * 0.12 * (1.0 - shape);
    float rim = smoothstep(0.78, 0.98, shape);
    bool top = gl_FrontFacing;
    if (kind == 0) {
      alb = vec3(0.96, 0.95, 0.9);
      alb = mix(alb, vec3(0.2, 0.2, 0.22), smoothstep(0.62, 0.75, uv.x) * smoothstep(0.62, 0.8, uv.y) * step(fore, hind) * (top ? 1.0 : 0.3));
      alb = mix(alb, vec3(0.22, 0.2, 0.2), (1.0 - smoothstep(0.05, 0.075, length(uv - vec2(0.52, 0.6)))) * (top ? 1.0 : 0.5));
    } else if (kind == 1) {
      alb = mix(vec3(1.0, 0.93, 0.5), vec3(0.95, 0.96, 0.62), uv.y);
      alb = mix(alb, vec3(1.0, 0.55, 0.15), 1.0 - smoothstep(0.03, 0.05, length(uv - vec2(0.45, 0.55))));
    } else {
      alb = top ? mix(vec3(0.34, 0.5, 0.95), vec3(0.55, 0.7, 1.0), uv.x) : vec3(0.78, 0.76, 0.72);
      alb = mix(alb, vec3(0.97, 0.96, 0.94), rim * 0.9);
      if (!top) alb = mix(alb, vec3(1.0, 0.55, 0.2), (1.0 - smoothstep(0.03, 0.05, abs(shape - 0.82))) * step(hind, fore) * 0.8);
    }
    alb *= 1.0 - veins;
    thin = 1.0;
  }
  vec3 col = shadeCreature(alb, N, vWorld, 1.0, 0.3, thin, 0.6);
  gl_FragColor = vec4(applyFog(col, vWorld), alpha);
}`;

function butterflyGeometry(): THREE.BufferGeometry {
  const wings = [WING_L, WING_R].map((part) => {
    const side = part === WING_L ? 1 : -1;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0.5, 0, 0);
    geo.scale(0.25 * side, 1, 0.3);
    if (side < 0) flipWinding(geo);
    geo.translate(0, 0, 0.02);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = Math.abs(pos.getX(i)) / 0.25;
      uv[i * 2 + 1] = (pos.getZ(i) - 0.02) / 0.3 + 0.5;
    }
    geo.deleteAttribute('uv');
    geo.setAttribute('aMat', new THREE.BufferAttribute(uv, 2));
    return tag(geo, part);
  });
  const body = blob({ part: BODY, mat: 0, at: [0, 0, 0.0], size: [0.016, 0.016, 0.1], detail: 1 });
  return merge([...wings.map((w) => w.toNonIndexed()), body.toNonIndexed()]);
}

type State = 'flutter' | 'rest';

interface Butterfly {
  rand: Rng;
  seed: number;
  kind: number;
  size: number;
  patch: FlowerPatch;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  tx: number;
  tz: number;
  lift: number;
  state: State;
  timer: number;
  flapPhase: number;
  flap: number;
  yaw: number;
  pitch: number;
  roll: number;
  tumble: number;
  carried: number;
}

const GRAVITY = 3.2;

/** Butterflies flutter over the flower patches, get tumbled away by gusts and lifted by updrafts, then find flowers again. */
export class Butterflies {
  readonly mesh: THREE.Mesh;
  private readonly instances: Instances;
  private readonly list: Butterfly[] = [];

  constructor(
    private readonly habitat: Habitat,
    capacity = 48,
  ) {
    this.instances = new Instances(butterflyGeometry(), capacity, ['iPos', 'iAtt', 'iLook']);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...atmo.uniforms },
      side: THREE.DoubleSide,
      alphaToCoverage: true,
    });
    this.mesh = new THREE.Mesh(this.instances.geometry, material);
    this.mesh.frustumCulled = false;
  }

  get count(): number {
    return this.list.length;
  }

  add(patch: FlowerPatch, kind: number, seed: number): void {
    if (this.list.length >= this.instances.capacity) return;
    const rand = mulberry32(seed);
    const a = rand() * Math.PI * 2;
    const d = rand() * patch.radius;
    const x = patch.x + Math.cos(a) * d;
    const z = patch.z + Math.sin(a) * d;
    this.list.push({
      rand,
      seed: rand(),
      kind,
      size: range(rand, 0.95, 1.2),
      patch,
      x,
      y: this.top(x, z) + range(rand, 0.3, 1.5),
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      tx: x,
      tz: z,
      lift: range(rand, 0.4, 1.6),
      state: 'flutter',
      timer: range(rand, 0.2, 3),
      flapPhase: rand() * Math.PI * 2,
      flap: 0.6,
      yaw: rand() * Math.PI * 2,
      pitch: 0,
      roll: 0,
      tumble: 0,
      carried: 0,
    });
  }

  private top(x: number, z: number): number {
    return Math.max(this.habitat.ground(x, z), 0) + this.habitat.grassHeight(x, z);
  }

  update(dt: number, time: number, s: Stimuli): void {
    const up = s.updraft;
    this.list.forEach((b, i) => {
      const rand = b.rand;
      const w = s.wind.sample(b.x, b.z, s.sample);
      const speed = Math.hypot(w.x, w.z);
      const toUp = Math.hypot(up.x - b.x, up.z - b.z);
      const funnel = up.strength > 0.02 ? up.strength * (1 - THREE.MathUtils.smoothstep(toUp, 7, 16)) : 0;
      const carry = Math.min(1.5, THREE.MathUtils.smoothstep(speed, 4.5, 11) + w.energy * 1.4 + w.lift * 0.5 + funnel);
      b.carried = Math.max(carry, b.carried - dt * 0.35);
      const top = this.top(b.x, b.z);

      if (b.state === 'rest') {
        b.timer -= dt;
        b.y = top;
        b.flap = 1.35 - Math.max(0, Math.sin(time * 1.4 + b.seed * 20)) * 0.9;
        if (b.timer <= 0 || carry > 0.25) {
          b.state = 'flutter';
          b.vy = 1.5;
          b.timer = range(rand, 2, 6);
        }
      } else {
        const period = 1 / (9 + b.seed * 4);
        const prevPhase = b.flapPhase;
        b.flapPhase += dt / period;
        if (Math.floor(b.flapPhase) > Math.floor(prevPhase)) this.stroke(b, top);
        b.flap = 0.55 + Math.sin(b.flapPhase * Math.PI * 2) * 0.8;
        b.vy -= GRAVITY * dt;
        const drag = Math.exp(-dt * 2.4);
        b.vx *= drag;
        b.vy *= drag;
        b.vz *= drag;
        if (carry > 0.05) {
          const k = 1 - Math.exp(-dt * carry * 3);
          b.vx += (w.x - b.vx) * k;
          b.vz += (w.z - b.vz) * k;
          b.vy += (w.lift * 2.5 + w.energy * 2 + funnel * 7) * dt;
          if (funnel > 0.05) {
            const rx = (b.x - up.x) / Math.max(toUp, 0.5);
            const rz = (b.z - up.z) / Math.max(toUp, 0.5);
            b.vx += (-rz * 5 - rx * (toUp - 4) * 0.6) * funnel * dt * 3;
            b.vz += (rx * 5 - rz * (toUp - 4) * 0.6) * funnel * dt * 3;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        const floor = top + 0.4;
        if (b.y < floor) {
          b.y = floor;
          b.vy = Math.max(b.vy, 0.5);
        }
        const ceiling = Math.max(this.habitat.ground(b.x, b.z), 0) + 28;
        if (b.y > ceiling) b.vy = Math.min(b.vy, 0);

        b.timer -= dt;
        if (b.timer <= 0 && b.carried < 0.1) this.decide(b, top);
      }

      const hs = Math.hypot(b.vx, b.vz);
      if (hs > 0.25) b.yaw = easeAngle(b.yaw, Math.atan2(b.vx, b.vz), 3 + hs, dt);
      b.tumble += dt * b.carried * (5 + b.seed * 6);
      const sway = Math.sin(time * 3.1 + b.seed * 17) * 0.25;
      b.pitch = ease(b.pitch, b.state === 'rest' ? 0 : -0.35 + Math.sin(b.tumble * 0.7) * b.carried * 1.2, 6, dt);
      b.roll = ease(b.roll, b.state === 'rest' ? 0 : sway + Math.sin(b.tumble) * b.carried * 1.6, 6, dt);
      const nudge = b.state === 'rest' ? 1.2 : 0.4;
      this.instances.set(0, i, b.x, b.y, b.z, b.yaw);
      this.instances.set(1, i, b.flap, b.pitch, b.roll, 0);
      this.instances.set(2, i, b.kind, b.size, b.seed, nudge);
    });
    this.instances.commit(this.list.length);
  }

  /** A wingbeat: a hop up and a nudge toward where it wants to be. */
  private stroke(b: Butterfly, top: number): void {
    const rand = b.rand;
    const dx = b.tx - b.x;
    const dz = b.tz - b.z;
    const d = Math.hypot(dx, dz);
    const pull = Math.min(1, d / 2) * (0.5 + b.carried * 0.2);
    const above = b.y - top;
    const want = b.lift - above;
    b.vx += (dx / Math.max(d, 1e-3)) * pull + (rand() - 0.5) * 1.3;
    b.vz += (dz / Math.max(d, 1e-3)) * pull + (rand() - 0.5) * 1.3;
    b.vy += 0.55 + THREE.MathUtils.clamp(want, -0.8, 1) * 0.5 + (rand() - 0.5) * 0.4;
  }

  private decide(b: Butterfly, top: number): void {
    const rand = b.rand;
    const fromHome = Math.hypot(b.x - b.patch.x, b.z - b.patch.z);
    if (fromHome > b.patch.radius + 6) {
      const near = this.habitat.flowers.reduce((best, f) =>
        Math.hypot(f.x - b.x, f.z - b.z) < Math.hypot(best.x - b.x, best.z - b.z) ? f : best,
      );
      if (Math.hypot(near.x - b.x, near.z - b.z) < fromHome * 0.6) b.patch = near;
    }
    const nearTarget = Math.hypot(b.tx - b.x, b.tz - b.z) < 0.8 && b.y - top < 1.2;
    if (nearTarget && rand() < 0.35) {
      b.state = 'rest';
      b.timer = range(rand, 2, 6);
      b.vx = b.vy = b.vz = 0;
      return;
    }
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * b.patch.radius;
    b.tx = b.patch.x + Math.cos(a) * r;
    b.tz = b.patch.z + Math.sin(a) * r;
    b.lift = range(rand, 0.6, 2.2);
    b.timer = range(rand, 1.2, 4);
  }

  get state(): { x: number; y: number; z: number; state: State; carried: number }[] {
    return this.list.map((b) => ({ x: b.x, y: b.y, z: b.z, state: b.state, carried: b.carried }));
  }
}

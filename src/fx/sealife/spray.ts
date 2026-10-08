import * as THREE from 'three';
import type { WindField, WindSample } from '../../wind/field';
import { ATMO_GLSL, atmo } from '../../world/atmosphere';

const MAX = 2400;
export const MIST = 0;
export const DROP = 1;
export const SPLASH = 2;
/** The soft round puffs of a column of breath, lit as solid shapes: gold on the sun's side, cool on the other. */
export const COLUMN = 3;

/** How fast each kind settles into the air around it (per second), and how strongly it falls. */
const DRAG = [1.5, 0.15, 0.9, 1.1];
const GRAVITY = [0.4, 9.8, 6.5, 0.3];

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec4 iA;
in vec4 iB;
in vec4 iC;
out vec2 vQ;
out vec3 vWorld;
out float vKind;
out float vAlpha;
out float vSeed;
out float vAge;
out vec3 vRight;
out vec3 vUp;
out float vSide;
void main() {
  vec3 p = iA.xyz;
  float size = iA.w;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 along = up;
  vec3 across = right;
  float stretch = 1.0;
  if (abs(iB.w - ${DROP}.0) < 0.5) {
    vec3 toCam = normalize(cameraPosition - p);
    vec3 across2d = iB.xyz - dot(iB.xyz, toCam) * toCam;
    float speed = length(across2d);
    if (speed > 0.01) {
      along = across2d / speed;
      across = normalize(cross(along, toCam));
      stretch = 1.0 + speed * 0.03 / size;
    }
  }
  vec2 q = position.xy;
  if (iB.w < 0.5) {
    float a = iC.y * 6.2832;
    q = mat2(cos(a), -sin(a), sin(a), cos(a)) * (q * vec2(1.0, 0.7 + 0.5 * fract(iC.y * 5.7)));
  }
  vec3 world = p + (across * q.x + along * q.y * stretch) * size;
  vRight = right;
  vUp = up;
  vSide = iC.w;
  vQ = position.xy;
  vWorld = world;
  vKind = iB.w;
  vAlpha = iC.x;
  vSeed = iC.y;
  vAge = iC.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
/** Mist in its own shade: the sky's brightness without its colours, cool down in its folds, paler open to the sky. */
vec3 mistShade(float open) {
  return lumaOf(uSkyAmbient) * mix(vec3(1.05, 1.0, 1.12), vec3(1.58, 1.55, 1.58), open);
}
in vec2 vQ;
in vec3 vWorld;
in float vKind;
in float vAlpha;
in float vSeed;
in float vAge;
in vec3 vRight;
in vec3 vUp;
in float vSide;
void main() {
  float r = length(vQ);
  if (r > 1.0) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  float toSun = max(dot(-V, uSunDir), 0.0);
  float sun = cloudShadow(vWorld.xz);
  vec3 sky = uSkyAmbient * 1.25 + uGroundBounce * 0.4;
  vec3 col;
  float a;
  float additive;
  if (vKind < 0.5) {
    vec2 w = vQ * 1.6 + vSeed * 31.0;
    float wisp = vnoise(w + uTime * 0.2) * 0.55 + vnoise(w * 2.3 - uTime * 0.3) * 0.3 + vnoise(w * 5.1) * 0.15;
    float torn = vAge * 0.55;
    a = pow(1.0 - r, 1.3) * smoothstep(0.3 + torn, 0.75 + torn, wisp + 0.35 - r * 0.45) * vAlpha;
    float glow = min(pow(toSun, 12.0) * 1.8 + pow(toSun, 4.0) * 0.8, 1.2) * (0.7 + 0.6 * fract(vSeed * 7.3));
    col = mistShade(0.7) + cloudGlow() * (0.22 + glow) * sun;
    additive = 0.12;
  } else if (vKind > 2.5) {
    vec2 w = vQ * 1.2 + vSeed * 23.0;
    float lumps = vnoise(w + uTime * 0.15) * 0.6 + vnoise(w * 2.4 - uTime * 0.2) * 0.4;
    // Soft all the way from the middle, so overlapping puffs add up to one body of mist, never rings of discs.
    float body = 1.0 - smoothstep(0.0, 0.75 + 0.35 * lumps, r);
    a = pow(body, 1.5) * smoothstep(vAge * 0.6, vAge * 0.6 + 0.5, lumps + 0.2) * vAlpha;
    // Each puff a soft ball, a little of the column's own side in it.
    float k = min(r, 1.0);
    float facing = sqrt(max(0.0, 1.0 - k * k));
    vec3 ball = normalize(vRight * vQ.x + vUp * vQ.y + V * facing);
    float side = vSide * 6.2832;
    vec3 N = normalize(mix(ball, vec3(cos(side), 0.2, sin(side)), 0.3));
    float wrap = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
    // The low sun comes through where it is thin, so it glows from behind; where it is thick it is in its own shade.
    float through = pow(toSun, 3.0) * (0.3 + 0.7 * (1.0 - facing));
    // The sky's brightness without its colours, whose blue and orange together go lilac: white, cool grey-blue in its
    // shade, gold where the sun reaches it.
    col = mistShade(clamp(0.5 + 0.35 * N.y + 0.25 * wrap, 0.0, 1.0)) + cloudGlow() * (wrap * wrap * 0.8 + through) * sun;
    // Thinning, it takes on the warmth of the morning it is going into rather than greying against it.
    col *= mix(vec3(1.0), vec3(1.1, 0.98, 0.9), smoothstep(0.3, 0.9, vAge));
    additive = 0.04;
  } else if (vKind < 1.5) {
    a = (1.0 - smoothstep(0.0, 1.0, r)) * vAlpha;
    float glint = pow(toSun, 8.0) * 2.5 + 0.45;
    col = sky * 1.1 + uSunColor * glint * sun;
    additive = 0.7;
  } else {
    float lumps = vnoise(vQ * 3.0 + vSeed * 17.0);
    a = (1.0 - smoothstep(0.35, 1.0, r + (lumps - 0.5) * 0.5)) * vAlpha;
    col = vec3(0.92, 0.9, 0.84) * (sky + uSunColor * (0.45 + pow(toSun, 4.0) * 2.5) * sun);
    additive = 0.25;
  }
  a *= smoothstep(-0.05, 0.3, vWorld.y);
  if (a < 0.003) discard;
  vec4 fog = fogOf(vWorld);
  col = mix(col, fog.rgb, fog.a);
  gl_FragColor = vec4(col * a, a * (1.0 - additive));
}`;

/**
 * Water in the air: the whale's blow, drips and streams off its flukes, splashes. Soft, luminous particles that
 * glow gold when the low sun is behind them; mist drifts off on the live wind and dissolves.
 */
export class Spray {
  readonly mesh: THREE.Mesh;
  private count = 0;
  private readonly p = new Float32Array(MAX * 3);
  private readonly v = new Float32Array(MAX * 3);
  private readonly age = new Float32Array(MAX);
  private readonly life = new Float32Array(MAX);
  private readonly size = new Float32Array(MAX);
  private readonly grow = new Float32Array(MAX);
  private readonly opacity = new Float32Array(MAX);
  private readonly kind = new Uint8Array(MAX);
  private readonly seed = new Float32Array(MAX);
  /** Seconds a particle is thrown clear of the wind before the air takes it. */
  private readonly calm = new Float32Array(MAX);
  /** Which side of its column a puff left from, as a share of a turn. */
  private readonly side = new Float32Array(MAX);
  /** Mist carried on its own way rather than the wind's, slowing as it goes (m/s), and whether it is. */
  private readonly carry = new Float32Array(MAX * 3);
  private readonly carried = new Uint8Array(MAX);
  private readonly a: THREE.InstancedBufferAttribute;
  private readonly b: THREE.InstancedBufferAttribute;
  private readonly c: THREE.InstancedBufferAttribute;
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly air: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };

  constructor(private readonly wind: WindField) {
    const quad = new THREE.PlaneGeometry(2, 2);
    this.geo.index = quad.index;
    this.geo.setAttribute('position', quad.attributes.position);
    const attr = () => new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.a = attr();
    this.b = attr();
    this.c = attr();
    this.geo.setAttribute('iA', this.a);
    this.geo.setAttribute('iB', this.b);
    this.geo.setAttribute('iC', this.c);
    this.geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...atmo.uniforms },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
  }

  emit(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, grow = 0, opacity = 1, calm = 0): void {
    if (this.count >= MAX) return;
    const i = this.count++;
    const o = i * 3;
    this.p[o] = x;
    this.p[o + 1] = y;
    this.p[o + 2] = z;
    this.v[o] = vx;
    this.v[o + 1] = vy;
    this.v[o + 2] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.grow[i] = grow;
    this.opacity[i] = opacity;
    this.kind[i] = kind;
    this.seed[i] = Math.random();
    this.calm[i] = calm;
    this.side[i] = 0;
    this.carried[i] = 0;
  }

  /** A whale's breath: a bushy column of fine mist, a few heavier drops falling out of it, `size` times a 14 m whale's. */
  blow(at: THREE.Vector3, heading: THREE.Vector3, size = 1): void {
    for (let i = 0; i < 150; i++) {
      const jet = Math.random();
      const up = (4 + jet * 10) * size;
      const spread = (0.25 + jet * jet * 2.2 * Math.random()) * size;
      const a = Math.random() * Math.PI * 2;
      const lean = (0.4 + Math.random() * 0.5) * size;
      this.emit(
        MIST,
        at.x + (Math.random() - 0.5) * 0.3 * size,
        at.y + Math.random() * 0.2,
        at.z + (Math.random() - 0.5) * 0.3 * size,
        Math.cos(a) * spread + heading.x * lean,
        up,
        Math.sin(a) * spread + heading.z * lean,
        (0.22 + Math.random() * 0.22) * size,
        2.5 + Math.random() * 3,
        (0.35 + jet * 0.7 + Math.random() * 0.3) * size,
        0.045 + Math.random() * 0.05,
      );
    }
    // Slower, wider puffs that pile up into the bushy crown of the blow.
    for (let i = 0; i < 45; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = (1.2 + Math.random() * 1.8) * size;
      this.emit(MIST, at.x, at.y + 0.5 * size, at.z, Math.cos(a) * out + heading.x * 0.5 * size, (5.5 + Math.random() * 4) * size,
        Math.sin(a) * out + heading.z * 0.5 * size, (0.45 + Math.random() * 0.35) * size, 3 + Math.random() * 2.5,
        (0.7 + Math.random() * 0.7) * size, 0.03 + Math.random() * 0.035);
    }
    for (let i = 0; i < 32; i++) {
      this.emit(DROP, at.x, at.y + 0.3, at.z, (Math.random() - 0.5) * 2.4 * size, (4 + Math.random() * 6) * size,
        (Math.random() - 0.5) * 2.4 * size, (0.016 + Math.random() * 0.018) * size, 2.5, 0, 0.55);
    }
  }

  /**
   * One frame of a spout held for a while: a tall column of mist thrown `height` high, straight up clear of the
   * breeze until it slows and opens into a crown, with drops falling back out of it.
   */
  jet(at: THREE.Vector3, height: number, strength: number, dt: number): void {
    const n = Math.floor(strength * 600 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const reach = 0.3 + 0.7 * Math.sqrt(Math.random());
      const crown = THREE.MathUtils.smoothstep(reach, 0.7, 1);
      const out = 0.06 + reach * 0.3 * Math.random() + crown * (0.8 + Math.random() * 1.8);
      const up = height * DRAG[MIST] * reach * strength * (1.05 + Math.random() * 0.12);
      this.emit(MIST, at.x + Math.cos(a) * 0.1, at.y, at.z + Math.sin(a) * 0.1, Math.cos(a) * out, up, Math.sin(a) * out,
        0.18 + Math.random() * 0.2, 2.6 + Math.random() * 1.8, 0.2 + reach * 0.5 + crown * 0.9, 0.09 + Math.random() * 0.1,
        1.1 + crown * 0.5);
    }
    const m = Math.floor(strength * 160 * dt + Math.random());
    for (let i = 0; i < m; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.sqrt(2 * GRAVITY[DROP] * height * (0.35 + Math.random() * 0.65)) * strength;
      const out = 0.4 + Math.random() * 1.6;
      this.emit(DROP, at.x, at.y + 0.1, at.z, Math.cos(a) * out, v, Math.sin(a) * out, 0.04 + Math.random() * 0.04, 2.6, 0, 0.8);
    }
  }

  /**
   * One frame of a soft column of breath, `height` high: big round puffs thrown straight up clear of the breeze,
   * slowing and opening as they rise, then taken by it and drifting off as they settle and thin.
   */
  column(at: THREE.Vector3, height: number, strength: number, dt: number, wide = 1): void {
    const n = Math.floor(strength * 340 * wide * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const reach = 0.25 + 0.75 * Math.sqrt(Math.random());
      const crown = THREE.MathUtils.smoothstep(reach, 0.7, 1);
      const out = (0.3 + reach * 0.8 * Math.random() + crown * (1.2 + Math.random() * 1.8)) * wide;
      const up = height * DRAG[COLUMN] * reach * strength * (1 + Math.random() * 0.1);
      this.emit(COLUMN, at.x + Math.cos(a) * 0.5 * wide, at.y + 0.2, at.z + Math.sin(a) * 0.5 * wide, Math.cos(a) * out, up, Math.sin(a) * out,
        (0.8 + Math.random() * 0.5) * wide, 6 + Math.random() * 2.5, (0.35 + reach * 0.4 + crown * 0.6) * wide, 0.5 + Math.random() * 0.3,
        1.6 + crown * 0.8 + Math.random() * 0.6);
      this.side[this.count - 1] = a / (Math.PI * 2);
    }
  }

  /**
   * One frame of a slow sigh seen from far off: a soft plume of round puffs `scale` times the size of a near one,
   * rising clear of the breeze from the blowhole and standing a while before it drifts and thins.
   */
  plume(at: THREE.Vector3, scale: number, strength: number, dt: number): void {
    const n = Math.floor(strength * 30 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const reach = 0.3 + 0.7 * Math.sqrt(Math.random());
      const out = (0.08 + reach * 0.24) * scale;
      const up = reach * 2.8 * scale * DRAG[COLUMN] * strength * (0.9 + Math.random() * 0.2);
      this.emit(COLUMN, at.x + Math.cos(a) * 0.2 * scale, at.y, at.z + Math.sin(a) * 0.2 * scale, Math.cos(a) * out, up, Math.sin(a) * out,
        (0.36 + Math.random() * 0.22) * scale, 6.5 + Math.random() * 2.5, (0.12 + reach * 0.14) * scale, 0.36 + Math.random() * 0.2, 2.4);
      this.side[this.count - 1] = a / (Math.PI * 2);
    }
  }

  /**
   * One frame of a spout's mist coming down: soft veils from high in its plume, `height` over `at`, carried down over
   * `onto` and slowing there as they spread and thin, with a few fine drops catching the light as they fall.
   */
  veil(at: THREE.Vector3, height: number, onto: THREE.Vector3, strength: number, dt: number): void {
    const n = Math.floor(strength * 60 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 3.5;
      const x = at.x + Math.cos(a) * r;
      const y = at.y + height * (0.3 + 0.5 * Math.random());
      const z = at.z + Math.sin(a) * r;
      const b = Math.random() * Math.PI * 2;
      const spread = 7 * Math.sqrt(Math.random());
      const life = 7 + Math.random() * 3;
      // Slowing as the square of the life it has left, it covers a third of its first pace's worth of its life, most
      // of it early: so it comes over the boat while it still shows, and lingers there thinning.
      const vx = (3 * (onto.x + Math.cos(b) * spread - x)) / life;
      const vy = (3 * (onto.y + 1.2 + Math.random() * 3.5 - y)) / life;
      const vz = (3 * (onto.z + Math.sin(b) * spread - z)) / life;
      this.emit(MIST, x, y, z, vx, vy, vz, 1.4 + Math.random() * 1.4, life, 0.35 + Math.random() * 0.4, 0.06 + Math.random() * 0.05);
      this.carryOn(vx, vy, vz);
    }
    const m = Math.floor(strength * 40 * dt + Math.random());
    for (let i = 0; i < m; i++) {
      const b = Math.random() * Math.PI * 2;
      const spread = 5 * Math.sqrt(Math.random());
      const vx = (Math.random() - 0.5) * 0.4;
      const vz = (Math.random() - 0.5) * 0.4;
      this.emit(DROP, onto.x + Math.cos(b) * spread, onto.y + 4 + Math.random() * 5, onto.z + Math.sin(b) * spread, vx, -0.6, vz,
        0.012 + Math.random() * 0.01, 5, 0, 0.5 + Math.random() * 0.4);
      this.carryOn(vx, -0.7 - Math.random() * 0.5, vz);
    }
  }

  /** The last particle goes its own way from here, rather than the wind's. */
  private carryOn(vx: number, vy: number, vz: number): void {
    const i = this.count - 1;
    this.carried[i] = 1;
    this.carry[i * 3] = vx;
    this.carry[i * 3 + 1] = vy;
    this.carry[i * 3 + 2] = vz;
  }

  /** White water thrown up where something heavy breaks the surface. */
  splash(x: number, z: number, radius: number, strength: number): void {
    const n = Math.round(20 + 90 * strength);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * Math.sqrt(Math.random());
      const out = (0.5 + Math.random() * 1.6) * strength;
      const cx = x + Math.cos(a) * r;
      const cz = z + Math.sin(a) * r;
      const up = (1.5 + Math.random() * 4) * (0.4 + strength * 0.8);
      if (i % 4 === 0) this.emit(SPLASH, cx, 0.05, cz, Math.cos(a) * out, up * 0.7, Math.sin(a) * out, 0.08 + Math.random() * 0.1 * strength, 0.8 + Math.random() * 0.6, 0.4, 0.25);
      this.emit(DROP, cx, 0.05, cz, Math.cos(a) * out * 1.3, up, Math.sin(a) * out * 1.3, 0.018 + Math.random() * 0.02, 1.5, 0, 0.75);
    }
    for (let i = 0; i < 20 * strength; i++) {
      const a = Math.random() * Math.PI * 2;
      this.emit(MIST, x + Math.cos(a) * radius * 0.5, 0.3, z + Math.sin(a) * radius * 0.5, Math.cos(a) * 0.8, 1 + Math.random() * 2.5 * strength, Math.sin(a) * 0.8, 0.3, 1.8 + Math.random(), 0.6, 0.1);
    }
  }

  /** The small splash of a fish leaving or entering the water. */
  plip(x: number, z: number, strength: number): void {
    for (let i = 0; i < 22 * strength; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = 0.4 + Math.random() * 1.1;
      this.emit(DROP, x, 0.03, z, Math.cos(a) * out, 1.5 + Math.random() * 2.5, Math.sin(a) * out, 0.01 + Math.random() * 0.008, 1, 0, 0.6);
    }
    for (let i = 0; i < 3; i++) this.emit(SPLASH, x + (Math.random() - 0.5) * 0.2, 0.05, z + (Math.random() - 0.5) * 0.2, 0, 1 + Math.random(), 0, 0.07, 0.5, 0.3, 0.5 * strength);
  }

  update(dt: number): void {
    const p = this.p;
    const v = this.v;
    const air = this.air;
    for (let i = 0; i < this.count; ) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i] || (this.kind[i] !== MIST && p[i * 3 + 1] < -0.05 && v[i * 3 + 1] < 0)) {
        this.remove(i);
        continue;
      }
      const k = this.kind[i];
      const o = i * 3;
      if (this.carried[i]) {
        const slowing = k === MIST ? (1 - this.age[i] / this.life[i]) ** 2 : 1;
        const settle = 1 - Math.exp(-dt * 1.5);
        v[o] += (this.carry[o] * slowing - v[o]) * settle;
        v[o + 1] += (this.carry[o + 1] * slowing - v[o + 1]) * settle;
        v[o + 2] += (this.carry[o + 2] * slowing - v[o + 2]) * settle;
      } else {
        if (k === DROP || this.age[i] < this.calm[i]) air.x = air.z = air.lift = 0;
        else this.wind.sample(p[o], p[o + 2], air);
        const settle = 1 - Math.exp(-dt * DRAG[k]);
        v[o] += (air.x - v[o]) * settle;
        v[o + 1] += (air.lift * 1.5 - v[o + 1]) * settle - GRAVITY[k] * dt * (k === MIST ? Math.min(1, this.age[i]) : 1);
        v[o + 2] += (air.z - v[o + 2]) * settle;
      }
      p[o] += v[o] * dt;
      p[o + 1] += v[o + 1] * dt;
      p[o + 2] += v[o + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      i++;
    }
    const A = this.a.array as Float32Array;
    const B = this.b.array as Float32Array;
    const C = this.c.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      const t = this.age[i] / this.life[i];
      const fade = Math.min(1, this.age[i] * 8) * (1 - t) ** 1.6;
      const k = i * 4;
      A[k] = p[o];
      A[k + 1] = p[o + 1];
      A[k + 2] = p[o + 2];
      A[k + 3] = this.size[i];
      B[k] = v[o];
      B[k + 1] = v[o + 1];
      B[k + 2] = v[o + 2];
      B[k + 3] = this.kind[i];
      C[k] = fade * this.opacity[i];
      C[k + 1] = this.seed[i];
      C[k + 2] = t;
      C[k + 3] = this.side[i];
    }
    for (const attr of [this.a, this.b, this.c]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * 4);
      attr.needsUpdate = true;
    }
    this.geo.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
  }

  private remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.p.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.v.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size[i] = this.size[last];
    this.grow[i] = this.grow[last];
    this.opacity[i] = this.opacity[last];
    this.kind[i] = this.kind[last];
    this.seed[i] = this.seed[last];
    this.calm[i] = this.calm[last];
    this.side[i] = this.side[last];
    this.carried[i] = this.carried[last];
    this.carry.copyWithin(i * 3, last * 3, last * 3 + 3);
  }
}

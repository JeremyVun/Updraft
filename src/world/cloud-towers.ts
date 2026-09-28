import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { tuning } from '../tuning';

/** The swell of the deck round a tower's foot, in tower sizes: full inside FOOT_IN, gone beyond FOOT_OUT, this high. */
export const TOWER_FOOT = { in: 0.5, out: 1.6, rise: 0.2 } as const;
const FOOT_IN = TOWER_FOOT.in.toFixed(3), FOOT_OUT = TOWER_FOOT.out.toFixed(3), FOOT_RISE = TOWER_FOOT.rise.toFixed(3);

/** How many round lumps a tower is built of. */
const LUMPS = 11;
const NOISE = 32;

function fract(x: number): number {
  return x - Math.floor(x);
}

/** Tiling value noise in three dimensions: r smooth billows, g finer cells, for fraying the towers' edges. */
function bakeNoise(): THREE.Data3DTexture {
  const n = NOISE;
  const lattice = (period: number, seed: number) => {
    const v = new Float32Array(period ** 3);
    for (let i = 0; i < v.length; i++) v[i] = fract(Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453);
    return (x: number, y: number, z: number) => {
      const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      const fx = x - ix, fy = y - iy, fz = z - iz;
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
      const at = (a: number, b: number, c: number) => v[(((iz + c) % period) * period + ((iy + b) % period)) * period + ((ix + a) % period)];
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      return lerp(lerp(lerp(at(0, 0, 0), at(1, 0, 0), ux), lerp(at(0, 1, 0), at(1, 1, 0), ux), uy),
        lerp(lerp(at(0, 0, 1), at(1, 0, 1), ux), lerp(at(0, 1, 1), at(1, 1, 1), ux), uy), uz);
    };
  };
  const a = lattice(4, 1), b = lattice(8, 2), c = lattice(16, 3), d = lattice(32, 4);
  const data = new Uint8Array(n ** 3 * 4);
  for (let z = 0, i = 0; z < n; z++) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++, i++) {
        const u = x / n, v = y / n, w = z / n;
        const smooth = a(u * 4, v * 4, w * 4) * 0.55 + b(u * 8, v * 8, w * 8) * 0.3 + c(u * 16, v * 16, w * 16) * 0.15;
        const fine = c(u * 16, v * 16, w * 16) * 0.6 + d(u * 32, v * 32, w * 32) * 0.4;
        data[i * 4] = Math.round(smooth * 255);
        data[i * 4 + 1] = Math.round(fine * 255);
        data[i * 4 + 2] = 0;
        data[i * 4 + 3] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, n, n, n);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * A tower of cumulus standing up out of the sea of cloud: round lumps heaped on each other, their edges frayed,
 * marched through the box round them. Lit as the top of the cloud is: gold where the low sun reaches it through
 * little cloud, lilac and violet in its own shade and low down, bright at its thin edges against the sun.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform highp sampler3D uTowerNoise;
uniform vec4 uLumps[${LUMPS}];
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform float uFloor;
uniform float uSize;
uniform float uAmount;
uniform vec3 uDriftAt;
uniform vec3 uFoot;
in vec3 vWorld;

/** The swell of the sea of cloud round the tower's foot, which the top of the cloud rises by too. */
float skirt(vec2 xz) {
  float k = 1.0 - smoothstep(uFoot.z * ${FOOT_IN}, uFoot.z * ${FOOT_OUT}, length(xz - uFoot.xy));
  return uFloor + uFoot.z * ${FOOT_RISE} * k * k * (3.0 - 2.0 * k);
}

float body(vec3 p) {
  float d = -1.0;
  for (int i = 0; i < ${LUMPS}; i++) {
    vec3 o = (p - uLumps[i].xyz) / uLumps[i].w;
    d = max(d, 1.0 - length(o));
  }
  return d;
}

float density(vec3 p) {
  float b = body(p);
  if (b < -0.35) return 0.0;
  vec3 q = (p + uDriftAt) / uSize;
  float n = texture(uTowerNoise, q * 0.8).r;
  float f = texture(uTowerNoise, q * 2.4 + 0.37).g;
  // Round billows with a soft edge, broken by finer ones; it goes down into the swell of the deck at its foot.
  float d = b + (n - 0.5) * 0.34 + (f - 0.5) * 0.1;
  float s = skirt(p.xz);
  return smoothstep(0.0, 0.12, d) * smoothstep(s - 1.0, s + uSize * 0.12, p.y);
}

float phase(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5) * 0.0796;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec3 inv = 1.0 / (rd + vec3(equal(rd, vec3(0.0))) * 1e-6);
  vec3 a = (uBoxMin - ro) * inv, b = (uBoxMax - ro) * inv;
  vec3 lo = min(a, b), hi = max(a, b);
  float t0 = max(max(max(lo.x, lo.y), lo.z), 0.0), t1 = min(min(hi.x, hi.y), hi.z);
  // Nothing under the deck's top: the sightline stops where it goes into the cloud below the tower.
  if (rd.y < 0.0) t1 = min(t1, (uFloor - 1.0 - ro.y) / rd.y);
  // Only the stretch of the sightline that passes through the lumps, a little swollen for their frayed edges.
  float s0 = 1e9, s1 = -1e9;
  for (int i = 0; i < ${LUMPS}; i++) {
    vec3 o = ro - uLumps[i].xyz;
    float r = uLumps[i].w * 1.4;
    float b = dot(o, rd), h = b * b - dot(o, o) + r * r;
    if (h <= 0.0) continue;
    h = sqrt(h);
    s0 = min(s0, -b - h);
    s1 = max(s1, -b + h);
  }
  t0 = max(t0, s0);
  t1 = min(t1, s1);
  if (t1 <= t0) discard;
  const int STEPS = ${tuning.stairs.towerSteps};
  float dt = (t1 - t0) / float(STEPS);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 L = normalize(uSunDir);
  float c = dot(rd, L);
  float ph = mix(phase(c, 0.55), phase(c, -0.2), 0.4) * 4.0;
  vec3 lilac = uSkyAmbient * vec3(1.3, 1.02, 1.2) + uGroundBounce * 0.3;
  vec3 violet = uSkyAmbient * vec3(0.84, 0.7, 1.04);
  float sigma = 6.0 / uSize;
  float T = 1.0;
  vec3 light = vec3(0.0);
  float seen = 0.0, at = 0.0;
  for (int i = 0; i < STEPS; i++) {
    float t = t0 + dt * (float(i) + jitter);
    vec3 p = ro + rd * t;
    if (p.y < skirt(p.xz) - 1.0) break;
    float d = density(p);
    if (d <= 0.0) continue;
    float s = 1.0 - exp(-sigma * d * dt);
    // How much of the tower lies between here and the sun, and over here: its shade, and its crowns open to the sky.
    float sunT = exp(-2.2 * density(p + L * uSize * 0.2));
    // Each billow is open to the sky over its crown and goes lilac underneath, where the next sits over it.
    float over = density(p + vec3(0.0, uSize * 0.09, 0.0));
    float up = clamp((p.y - uFloor) / (uSize * 1.4), 0.0, 1.0);
    vec3 shade = mix(violet, lilac, up * (1.0 - 0.6 * over) + 0.25 * (1.0 - over)) + uSunColor * vec3(0.1, 0.065, 0.075) * (0.4 + 0.6 * up);
    vec3 col = mix(shade, uSunColor * vec3(0.54, 0.39, 0.36) + shade * 0.35, sunT) + uSunColor * vec3(1.0, 0.85, 0.65) * sunT * ph * (0.12 + 0.6 * (1.0 - d));
    light += T * s * col;
    seen += T * s;
    at += T * s * t;
    T *= 1.0 - s;
    if (T < 0.02) break;
  }
  float alpha = (1.0 - T) * uAmount;
  if (alpha < 0.003) discard;
  vec4 fog = fogOf(ro + rd * (at / max(seen, 1e-4)));
  light = mix(light, fog.rgb * (1.0 - T), fog.a) * uAmount;
  gl_FragColor = vec4(light, alpha);
}`;

interface Tower { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform>; centre: THREE.Vector3; size: number }

/**
 * A few towers of cumulus standing out of the sea of cloud along the way, where the lens sees them: heaped well
 * above the floor, round-headed, soft-edged, lit gold and lilac by the low sun. Placed from the way itself, off
 * either side of it, so they move with it.
 */
export class CloudTowers {
  readonly group = new THREE.Group();
  readonly towers: Tower[] = [];
  private shown = 0;
  private readonly drift = new THREE.Vector3();

  constructor(route: readonly THREE.Vector2[], gate: { from: THREE.Vector2; to: THREE.Vector2 }, berth: THREE.Vector2, floor: number) {
    this.group.name = 'cloud-towers';
    const noise = bakeNoise();
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const places: { x: number; z: number; size: number }[] = [];
    // Along the way, off to one side and then the other; and a few far out toward the horizon.
    const length = route.reduce((sum, p, i) => (i ? sum + p.distanceTo(route[i - 1]) : 0), 0);
    const at = (s: number) => {
      for (let i = 1; i < route.length; i++) {
        const seg = route[i].distanceTo(route[i - 1]);
        if (s <= seg || i === route.length - 1) {
          const k = Math.min(1, s / seg);
          const p = route[i - 1].clone().lerp(route[i], k);
          const dir = route[i].clone().sub(route[i - 1]).normalize();
          return { p, side: new THREE.Vector2(-dir.y, dir.x) };
        }
        s -= seg;
      }
      return { p: route[route.length - 1].clone(), side: new THREE.Vector2(1, 0) };
    };
    // Where the way runs between towers: two either side of it, close enough to stand behind the travellers.
    const gateDir = gate.to.clone().sub(gate.from).normalize();
    [0.15, 0.4, 0.65, 0.9].forEach((k, i) => {
      const off = (40 + rnd() * 12) * (i % 2 ? 1 : -1);
      const p = gate.from.clone().lerp(gate.to, k);
      places.push({ x: p.x - gateDir.y * off, z: p.y + gateDir.x * off, size: 15 + rnd() * 6 });
    });
    const spots = tuning.stairs.towers;
    for (let k = 0; k < spots; k++) {
      const s = length * (0.12 + 0.7 * (k + rnd() * 0.5) / spots);
      const { p, side } = at(s);
      const far = k % 3 === 2;
      const off = (far ? 220 + rnd() * 200 : 70 + rnd() * 60) * (k % 2 ? 1 : -1);
      const x = p.x + side.x * off, z = p.y + side.y * off;
      if (Math.hypot(x - berth.x, z - berth.y) < 90) continue;
      places.push({ x, z, size: far ? 30 + rnd() * 14 : 17 + rnd() * 9 });
    }
    for (const place of places) {
      const size = place.size;
      const centre = new THREE.Vector3(place.x, floor, place.z);
      const lumps: THREE.Vector4[] = [];
      // A broad foot of big lumps, smaller ones heaped on it, and round heads on top, leaning a little.
      const lean = new THREE.Vector2(rnd() - 0.5, rnd() - 0.5).multiplyScalar(size * 0.25);
      const tiers = [
        { n: 4, ring: 0.55, y: 0.18, r: 0.5 },
        { n: 4, ring: 0.36, y: 0.55, r: 0.42 },
        { n: 3, ring: 0.22, y: 0.9, r: 0.33 },
      ];
      for (const tier of tiers) {
        const turn = rnd() * Math.PI * 2;
        for (let i = 0; i < tier.n && lumps.length < LUMPS; i++) {
          const t = turn + (i / tier.n) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
          const ring = size * tier.ring * (0.8 + 0.4 * rnd());
          lumps.push(new THREE.Vector4(
            centre.x + Math.cos(t) * ring + lean.x * tier.y,
            centre.y + size * tier.y * (0.9 + 0.2 * rnd()),
            centre.z + Math.sin(t) * ring + lean.y * tier.y,
            size * tier.r * (0.85 + 0.3 * rnd())));
        }
      }
      while (lumps.length < LUMPS) lumps.push(lumps[0].clone());
      const lo = new THREE.Vector3(Infinity, floor - 1, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const l of lumps) {
        lo.set(Math.min(lo.x, l.x - l.w * 1.4), lo.y, Math.min(lo.z, l.z - l.w * 1.4));
        hi.set(Math.max(hi.x, l.x + l.w * 1.4), Math.max(hi.y, l.y + l.w * 1.4), Math.max(hi.z, l.z + l.w * 1.4));
      }
      const uniforms: Record<string, THREE.IUniform> = {
        ...atmo.uniforms,
        uTowerNoise: { value: noise },
        uLumps: { value: lumps },
        uBoxMin: { value: lo },
        uBoxMax: { value: hi },
        uFloor: { value: floor },
        uSize: { value: size },
        uAmount: { value: 0 },
        uDriftAt: { value: this.drift },
        uFoot: { value: new THREE.Vector3(centre.x, centre.z, size) },
      };
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }));
      mesh.position.copy(lo).add(hi).multiplyScalar(0.5);
      mesh.scale.subVectors(hi, lo);
      mesh.name = 'cloud-tower';
      mesh.frustumCulled = true;
      mesh.renderOrder = 3;
      mesh.visible = false;
      this.group.add(mesh);
      this.towers.push({ mesh, uniforms, centre, size });
    }
  }

  /** Where the towers stand and how big they are, for the swell of the top of the cloud round their feet: xz, size. */
  feet(out: THREE.Vector4[]): void {
    out.forEach((v, i) => {
      const t = this.towers[i];
      if (t) v.set(t.centre.x, t.centre.z, t.size, 1);
      else v.set(0, 0, 0, 0);
    });
  }

  update(dt: number, visible: boolean): void {
    this.shown += ((visible ? 1 : 0) - this.shown) * (1 - Math.exp(-dt * 1.5));
    if (!visible && this.shown < 0.01) this.shown = 0;
    this.drift.x += dt * 0.25;
    this.drift.y += dt * 0.08;
    for (const t of this.towers) {
      t.uniforms.uAmount.value = this.shown;
      t.mesh.visible = this.shown > 0.005;
    }
  }
}

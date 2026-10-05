import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';
import { mulberry32 } from './noise';
import { tuning } from '../tuning';
import { DARK_WAY, darkWayPoint } from './drowned-way';

const VERT = /* glsl */ `
${ATMO_GLSL}
in vec2 aCorner;
in vec4 aPuff;
in vec4 aLook;
in vec4 aShape;
out vec2 vCorner;
out vec3 vWorld;
out vec4 vLook;
out vec4 vShape;
out vec4 vFog;
out float vSun;
void main() {
  vec3 c = aPuff.xyz;
  float r = aPuff.w;
  if (aLook.x <= 0.002 || r <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vCorner = aCorner * 1.3;
  vWorld = c + (right * vCorner.x * aShape.x + up * vCorner.y * aShape.y) * r;
  vLook = aLook;
  vShape = aShape;
  float reach = r * max(aShape.x, aShape.y);
  // A ball the lens is inside of would fill the screen with one flat smear: it thins away first.
  vLook.x *= smoothstep(reach * 0.5 + 0.5, reach * 1.3 + 2.0, distance(c, cameraPosition));
  vec4 f = fogOf(c);
  f.a *= aLook.w;
  vFog = f;
  vSun = cloudShadow(c.xz);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * Billows of smoke, lumpy at the rim, the lumps turning so that a bank of them rolls. Smoke is near black with blue
 * and violet in it: the sky lights it only a little, from above, and the low sun only catches the rims of its tops.
 * `vShape` stretches a billow (x across, y up), turns its lumps and softens its edge.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform float uWarm;
in vec2 vCorner;
in vec3 vWorld;
in vec4 vLook;
in vec4 vShape;
in vec4 vFog;
in float vSun;
void main() {
  float d = length(vCorner);
  // A pixel and a half of edge however big the billow is on screen, so a near one is as crisp as a far one.
  float pixel = fwidth(d) * 2.0;
  if (d >= 1.3) discard;
  float seed = vLook.z;
  float turn = uTime * vShape.z;
  float ct = cos(turn), st = sin(turn);
  vec2 q = vec2(ct * vCorner.x - st * vCorner.y, st * vCorner.x + ct * vCorner.y);
  float around = atan(q.y, q.x);
  // Lumps along the rim at three sizes, the small ones many: a billow is made of billows.
  float lump = vnoise(vec2(around * 1.6 + seed * 13.0, seed * 7.0))
    + 0.5 * vnoise(vec2(around * 4.2 - seed * 5.0, seed * 3.0 + uTime * 0.05))
    + 0.3 * vnoise(vec2(around * 9.5 + seed * 2.0, seed * 5.0));
  float curl = vnoise(q * 3.4 + vec2(seed * 17.0, 0.0)) * 0.5 + vnoise(q * 7.1 - seed * 11.0) * 0.25;
  float rim = 0.56 + 0.18 * lump + 0.26 * curl;
  float soft = max(vShape.w, pixel);
  float body = 1.0 - smoothstep(rim - soft, rim, d);
  // Toward its edge smoke frays into wisps the sky shows through; the softer the billow, the more it frays.
  float fray = vnoise(q * 8.0 + vec2(seed * 31.0, uTime * 0.12)) * 0.6 + vnoise(q * 17.0 - seed * 7.0) * 0.4;
  body *= mix(1.0, smoothstep(0.3, 0.7, fray), smoothstep(rim - soft - 0.25, rim, d) * smoothstep(0.12, 0.35, soft));
  float a = body * vLook.x;
  if (a <= 0.004) discard;
  float k = min(d, 1.0);
  vec3 nv = vec3(vCorner / max(d, 1.0), sqrt(max(0.0, 1.0 - k * k)));
  // Smaller billows bulge out of the face of each, lit on top and shadowed beneath and between.
  vec2 cell = q * 4.2 + seed * 9.0;
  float bump = vnoise(cell);
  vec2 slope = vec2(vnoise(cell + vec2(0.15, 0.0)) - bump, vnoise(cell + vec2(0.0, 0.15)) - bump) / 0.15;
  nv.xy -= slope * 0.2;
  nv.xy += (vec2(vnoise(q * 2.3 + seed * 9.0), vnoise(q * 2.3 - seed * 4.0)) - 0.5) * 0.5;
  vec3 N = normalize(transpose(mat3(viewMatrix)) * normalize(nv));
  float edge = pow(1.0 - clamp(nv.z, 0.0, 1.0), 1.4);
  float above = N.y * 0.5 + 0.5;
  float hollow = mix(0.65, 1.0, smoothstep(0.2, 0.75, bump));
  // The sky lights it cold whatever the sunset is doing, from above, so each billow is dark beneath and greyer on top.
  vec3 cool = mix(uSkyAmbient, vec3(0.42, 0.42, 0.62) * dot(uSkyAmbient, vec3(0.33)), 0.85);
  vec3 alb = mix(vec3(0.016, 0.015, 0.032), vec3(0.13, 0.12, 0.19), vLook.y);
  vec3 col = alb * cool * mix(0.1, 2.6, pow(above, 2.0)) * hollow;
  // The sky catches the top edge of every billow, so each stands off the darker one behind it.
  col += cool * smoothstep(0.4, 0.95, edge) * smoothstep(0.55, 0.92, above) * 0.08 * vLook.y * vLook.y;
  // The low sun only reaches the rims of the tops on the side it is on: the body of it stays black.
  float wrap = clamp(dot(N, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
  float sunRim = smoothstep(0.3, 0.9, edge) * pow(wrap, 2.0) * smoothstep(0.45, 0.85, above);
  col += uSunColor * (sunRim * 0.22 + pow(wrap, 4.0) * smoothstep(0.55, 0.9, above) * 0.015 * hollow) * vSun * uWarm * (0.3 + 0.7 * vLook.y);
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), a);
}`;

/**
 * Camera-facing billows drawn in one call, sorted far to near every frame so the dark of one never cuts the soft edge
 * of another. Whoever owns a puff writes it each frame with `put`; anything not put that frame is not drawn.
 */
export class Billows {
  readonly mesh: THREE.Mesh;
  /** 1 lets the sun light the billows' rims. */
  readonly warm = { value: 1 };
  private readonly puff: THREE.InstancedBufferAttribute;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly shape: THREE.InstancedBufferAttribute;
  private readonly stage: Float32Array;
  private readonly depth: Float32Array;
  private readonly order: number[] = [];
  private count = 0;

  constructor(readonly capacity: number) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const attribute = () => new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.puff = attribute();
    this.look = attribute();
    this.shape = attribute();
    g.setAttribute('aPuff', this.puff);
    g.setAttribute('aLook', this.look);
    g.setAttribute('aShape', this.shape);
    g.instanceCount = 0;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.stage = new Float32Array(capacity * 12);
    this.depth = new Float32Array(capacity);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, uWarm: this.warm },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.layers.enable(REFLECTION_LAYER);
  }

  begin(): void { this.count = 0; }

  /**
   * `tone` 0 the darkest smoke to 1 the lighter heads of it; `haze` how much of the distance veil it takes, 1 all of
   * it; `wide` and `tall` stretch it; `spin` turns its lumps (radians a second); `soft` is the width of its edge.
   */
  put(x: number, y: number, z: number, r: number, alpha: number, tone: number, seed: number, haze: number,
    wide: number, tall: number, spin: number, soft: number): void {
    if (this.count >= this.capacity || alpha <= 0.002 || r <= 0) return;
    const s = this.stage, k = this.count * 12;
    s[k] = x; s[k + 1] = y; s[k + 2] = z; s[k + 3] = r;
    s[k + 4] = alpha; s[k + 5] = tone; s[k + 6] = seed; s[k + 7] = haze;
    s[k + 8] = wide; s[k + 9] = tall; s[k + 10] = spin; s[k + 11] = soft;
    this.count++;
  }

  end(eye: THREE.Vector3): void {
    const n = this.count, s = this.stage, order = this.order;
    order.length = n;
    for (let i = 0; i < n; i++) {
      const k = i * 12;
      this.depth[i] = (s[k] - eye.x) ** 2 + (s[k + 1] - eye.y) ** 2 + (s[k + 2] - eye.z) ** 2;
      order[i] = i;
    }
    order.sort((a, b) => this.depth[b] - this.depth[a]);
    const p = this.puff.array as Float32Array, l = this.look.array as Float32Array, h = this.shape.array as Float32Array;
    for (let j = 0; j < n; j++) {
      const k = order[j] * 12;
      p.set(s.subarray(k, k + 4), j * 4);
      l.set(s.subarray(k + 4, k + 8), j * 4);
      h.set(s.subarray(k + 8, k + 12), j * 4);
    }
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
    for (const a of [this.puff, this.look, this.shape]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * 4);
      a.needsUpdate = true;
    }
  }
}

/**
 * `skirt` the low rolling front lying on the water; `body` heaped up behind it, leaning out over the skirt as it
 * rolls; `plume` smoke lifting off its heads and thinning; `foot` a thin dark mist where it meets the water;
 * `tendril` creeping on ahead over the glass.
 */
type Layer = 'skirt' | 'body' | 'plume' | 'foot' | 'tendril';

interface Puff { layer: Layer; across: number; back: number; height: number; size: number; seed: number }

/** Where across the bank its columns of smoke lift, -1 to `wing`. */
const columnAt = (i: number) => {
  const k = tuning.drowned.dark;
  return -0.85 + ((i + 0.5) / k.columns) * (0.85 + k.wing * 0.5) + 0.05 * Math.sin(i * 7.3);
};

/** How high the bank heaps at `u` across it: an even rolling top with long low swells in it. */
const crest = (u: number) => 0.8 + 0.2 * Math.sin(u * 4.3 + 1.3) + 0.08 * Math.sin(u * 13 + 0.4);

/**
 * The dark: black smoke lying low on the water, the sea coming back under it. It rises on the horizon where they
 * came from and comes on over the village, swallowing roofs, and wherever it stops it heaves. Its front lies across
 * the way it comes, the flanks a little ahead: a low rolling skirt on the water with fingers of it creeping on over
 * the glass, heaped higher and higher behind.
 */
export class DarkBank {
  readonly billows: Billows;
  /** How far its front has come along `DARK_WAY`, in metres. */
  reach = 0;
  /** 0 nothing on the horizon to 1 risen in full. */
  rise = 0;
  /** The water going dark under it: a point on its front and the way it comes; its half width, flank, strength and wing. */
  readonly water = { front: new THREE.Vector4(), shape: new THREE.Vector4() };
  private readonly puffs: Puff[] = [];
  private readonly ahead = new THREE.Vector2().subVectors(DARK_WAY[1], DARK_WAY[0]).normalize();
  private readonly front = new THREE.Vector2();

  constructor() {
    const k = tuning.drowned.dark;
    const rand = mulberry32(5813);
    const layers: [Layer, number][] = [
      ['skirt', k.skirt], ['body', k.body], ['plume', k.plumes], ['foot', k.foot], ['tendril', k.tendrils],
    ];
    for (const [layer, count] of layers) {
      for (let i = 0; i < count; i++) {
        this.puffs.push({ layer, across: rand() * (1 + k.wing) - 1, back: rand(), height: rand(), size: 0.7 + rand() * 0.6, seed: rand() });
      }
    }
    this.billows = new Billows(this.puffs.length);
  }

  get objects(): THREE.Object3D[] {
    return [this.billows.mesh];
  }

  /** Where its front is, `aside` metres along it from the way (+ to its right as it comes), for whoever watches it. */
  frontAt(out: THREE.Vector2, aside = 0): THREE.Vector2 {
    const k = tuning.drowned.dark, u = aside / k.halfWidth;
    darkWayPoint(this.reach, out);
    return out.set(out.x - this.ahead.y * aside + this.ahead.x * k.flank * u * u, out.y + this.ahead.x * aside + this.ahead.y * k.flank * u * u);
  }

  /** Where a lens at `eye` looking along `view` sees its front, at the height of its skirt: what the depth blur keeps sharp. */
  seenAt(eye: THREE.Vector3, view: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    darkWayPoint(this.reach, this.front);
    const ax = this.ahead.x, az = this.ahead.y;
    const toward = Math.min(view.x * ax + view.z * az, -0.25);
    const along = ((this.front.x - eye.x) * ax + (this.front.y - eye.z) * az) / toward;
    const reach = tuning.drowned.dark.halfWidth * 0.7;
    const aside = THREE.MathUtils.clamp((eye.x + view.x * along - this.front.x) * -az + (eye.z + view.z * along - this.front.y) * ax, -reach, reach);
    this.frontAt(this.front, aside);
    return out.set(this.front.x, 2, this.front.y);
  }

  update(time: number, eye: THREE.Vector3): void {
    const k = tuning.drowned.dark;
    const b = this.billows;
    b.begin();
    const risen = THREE.MathUtils.smootherstep(this.rise, 0, 1);
    darkWayPoint(this.reach, this.front);
    const ax = this.ahead.x, az = this.ahead.y;
    this.water.front.set(this.front.x, this.front.y, ax, az);
    this.water.shape.set(k.halfWidth, k.flank, THREE.MathUtils.smoothstep(risen, 0.2, 0.9), k.wing);
    if (risen > 0.002) {
      const heave = Math.sin(time * k.heaveRate) * k.heave;
      const show = THREE.MathUtils.smoothstep(risen, 0, 0.35);
      for (const p of this.puffs) {
        const u = p.layer === 'plume' ? columnAt(Math.floor(p.seed * k.columns)) + p.across * 0.03 : p.across;
        const side = u * k.halfWidth;
        /** It runs out toward its ends, lower and thinner, and on the church's side it ends soon. */
        const taper = u < 0 ? 1 - THREE.MathUtils.smoothstep(-u, 0.7, 1) : 1 - THREE.MathUtils.smoothstep(u, k.wing * 0.4, k.wing);
        const lead = k.flank * u * u + heave * (0.6 + 0.4 * Math.sin(u * 5 + time * 0.2));
        /** The front is ragged: fingers of it reach on ahead and draw back. */
        const finger = Math.max(0, Math.sin(u * 23 + time * 0.09 + p.seed * 6)) * k.fingers;
        let forward: number, y: number, r: number, wide: number, tall: number, alpha: number, tone: number, soft: number;
        let spin = 0;
        if (p.layer === 'skirt') {
          r = k.skirtSize * p.size * (0.5 + 0.5 * risen);
          forward = lead + finger * (1 - p.back) - p.back * k.skirtDepth;
          /** Sitting low enough that the water cuts it off flat: it lies on the glass rather than floating over it. */
          y = (r * (0.05 + 0.45 * p.height) + p.back * 1.5) * risen;
          wide = 1.9 + p.height;
          tall = 1;
          spin = (0.12 + 0.1 * p.seed) * (p.seed < 0.5 ? -1 : 1);
          alpha = 0.97;
          tone = 0.12 * p.height;
          soft = 0.015;
        } else if (p.layer === 'body') {
          const back = p.back ** 1.8;
          r = THREE.MathUtils.lerp(k.bodySize, k.backSize, back ** 0.7) * p.size * (0.4 + 0.6 * risen);
          const up = (0.15 + 0.85 * p.height) * crest(u) * (0.18 + 0.82 * back ** 0.8);
          y = (r * 0.3 + up * k.heap) * risen;
          /** The higher it is toward the front, the further it leans out over the skirt: the front rolls over. */
          forward = lead * 0.8 - k.skirtDepth * 0.4 - back * k.depth + k.lean * up * (1 - back) ** 2;
          wide = 1.35;
          tall = 1;
          spin = 0.05 * (p.seed < 0.5 ? -1 : 1);
          alpha = 0.97;
          tone = 0.15 + 0.85 * Math.min(1, up * 1.3) * (0.4 + 0.6 * p.height);
          soft = 0.015;
        } else if (p.layer === 'plume') {
          /**
           * Smoke lifting off the bank in a few columns, leaning back the way it came and spreading as it climbs,
           * each puff thinning away as another follows it up.
           */
          const column = Math.floor(p.seed * k.columns);
          const cu = u;
          const back = 0.35 + 0.4 * Math.abs(Math.sin(column * 3.1));
          const life = (p.height + time * k.plumeRate * (0.8 + 0.4 * p.back)) % 1;
          const head = crest(cu) * (0.18 + 0.82 * back ** 0.8) * k.heap;
          r = k.backSize * (0.35 + 0.55 * life) * p.size * (0.4 + 0.6 * risen);
          const lift = life * k.plumeRise * (0.6 + 0.4 * Math.abs(Math.sin(column * 5.7)));
          forward = k.flank * cu * cu * 0.8 - k.skirtDepth * 0.4 - back * k.depth - lift * 0.45;
          y = (head + r * 0.3 + lift) * risen;
          wide = 1.2;
          tall = 1.1;
          spin = 0.08 * (p.seed < 0.5 ? -1 : 1);
          alpha = 0.92 * THREE.MathUtils.smoothstep(life, 0, 0.08) * (1 - life) ** 1.2;
          tone = 0.3 + 0.5 * life;
          soft = 0.06 + 0.2 * life;
        } else if (p.layer === 'foot') {
          r = k.skirtSize * p.size * (0.6 + 0.4 * risen);
          forward = lead + finger * 0.6 + 1.5 - p.back * k.skirtDepth * 0.6;
          y = r * 0.1;
          wide = 3.5 + 2 * p.height;
          tall = 0.45;
          alpha = 0.7 * THREE.MathUtils.smoothstep(risen, 0.3, 0.9);
          tone = 0.05;
          soft = 0.3;
        } else {
          /** Each creeps out from the front over the glass, thinning as it goes, and another follows it. */
          const life = (p.back + time * k.creep * (0.7 + 0.6 * p.seed)) % 1;
          r = k.tendrilSize * p.size * (0.7 + 0.6 * life);
          forward = lead + finger + 1 + life * k.tendrilReach;
          y = r * 0.22;
          wide = 2.5 + 3 * p.height;
          tall = 0.55;
          alpha = 0.8 * Math.sin(Math.PI * life) ** 0.8 * THREE.MathUtils.smoothstep(risen, 0.5, 1);
          tone = 0.2;
          soft = 0.38;
        }
        const wobble = time * 0.05 + p.seed * 40;
        const x = this.front.x + ax * forward - az * side + Math.cos(wobble) * 1.2;
        const z = this.front.y + az * forward + ax * side + Math.sin(wobble * 1.3) * 1.2;
        const distance = Math.hypot(x - eye.x, z - eye.z);
        const haze = THREE.MathUtils.lerp(k.nearHaze, k.farHaze, THREE.MathUtils.smoothstep(distance, 40, 200));
        b.put(x, y * (0.35 + 0.65 * taper), z, r * (0.45 + 0.55 * taper), alpha * THREE.MathUtils.smoothstep(taper, 0, 0.3) * show,
          tone, p.seed, haze, wide, tall, spin, soft);
      }
    }
    b.end(eye);
  }
}

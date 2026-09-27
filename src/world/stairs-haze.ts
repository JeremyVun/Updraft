import * as THREE from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';

/**
 * The haze a staircase rests on: soft, lit vapour hanging under its flights and landings, densest just under the
 * steps and trailing down into thinning wisps that drift and slowly sink. Each piece is a box round its haze,
 * drawn once: its fragments find where their sightline enters and leaves the box and march a few steps through the
 * vapour between. Nothing else of the stair lies inside a box, so no scene depth is needed.
 */

const NOISE = 32;

/** A tiling pseudo-random sequence, so the vapour is the same every time the room is built. */
function sequence(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Gradient noise on a lattice of `period` cells that wraps, so the texture tiles. */
function gradientNoise(period: number, seed: number): (x: number, y: number, z: number) => number {
  const rnd = sequence(seed);
  const g = new Float32Array(period ** 3 * 3);
  for (let i = 0; i < period ** 3; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    g[i * 3] = r * Math.cos(a);
    g[i * 3 + 1] = u;
    g[i * 3 + 2] = r * Math.sin(a);
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const corner = (ix: number, iy: number, iz: number, dx: number, dy: number, dz: number) => {
    const k = ((ix % period) + (iy % period) * period + (iz % period) * period * period) * 3;
    return g[k] * dx + g[k + 1] * dy + g[k + 2] * dz;
  };
  return (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fade(fx), v = fade(fy), w = fade(fz);
    const a = corner(ix, iy, iz, fx, fy, fz) + (corner(ix + 1, iy, iz, fx - 1, fy, fz) - corner(ix, iy, iz, fx, fy, fz)) * u;
    const b = corner(ix, iy + 1, iz, fx, fy - 1, fz) + (corner(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz) - corner(ix, iy + 1, iz, fx, fy - 1, fz)) * u;
    const c = corner(ix, iy, iz + 1, fx, fy, fz - 1) + (corner(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1) - corner(ix, iy, iz + 1, fx, fy, fz - 1)) * u;
    const d = corner(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1) + (corner(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1) - corner(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1)) * u;
    const e = a + (b - a) * v, f = c + (d - c) * v;
    return e + (f - e) * w;
  };
}

/** Cellular noise that wraps: 1 at each cell's point, falling to 0 a cell away. */
function cellNoise(period: number, seed: number): (x: number, y: number, z: number) => number {
  const rnd = sequence(seed);
  const p = new Float32Array(period ** 3 * 3);
  for (let i = 0; i < p.length; i++) p[i] = rnd();
  const wrap = new Int32Array(period + 4);
  for (let i = 0; i < wrap.length; i++) wrap[i] = (i - 2 + period) % period;
  return (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let best = 9;
    for (let cz = iz - 1; cz <= iz + 1; cz++) {
      const wz = wrap[cz + 2] * period * period;
      for (let cy = iy - 1; cy <= iy + 1; cy++) {
        const wy = wz + wrap[cy + 2] * period;
        for (let cx = ix - 1; cx <= ix + 1; cx++) {
          const k = (wy + wrap[cx + 2]) * 3;
          const dx = cx + p[k] - x, dy = cy + p[k + 1] - y, dz = cz + p[k + 2] - z;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < best) best = d;
        }
      }
    }
    return 1 - Math.min(1, Math.sqrt(best));
  };
}

/** Spreads values over 0..1 between their 1st and 99th percentiles. */
function normalise(values: Float32Array): void {
  const sorted = values.slice().sort();
  const lo = sorted[Math.floor(sorted.length * 0.01)], hi = sorted[Math.floor(sorted.length * 0.99)];
  for (let i = 0; i < values.length; i++) values[i] = Math.min(1, Math.max(0, (values[i] - lo) / (hi - lo)));
}

/**
 * A small tiling block of vapour: r its billows (gradient noise carved by cells), g finer cells to fray its edges,
 * b the gradient noise alone, smooth enough to draw out into strands. One texture sample in place of several octaves
 * of noise per step.
 */
function bakeNoise(): THREE.Data3DTexture {
  const n = NOISE;
  const body = new Float32Array(n ** 3);
  const fray = new Float32Array(n ** 3);
  const soft = new Float32Array(n ** 3);
  const s4 = gradientNoise(4, 11), s8 = gradientNoise(8, 18), s16 = gradientNoise(16, 25);
  const c3 = cellNoise(3, 101), c6 = cellNoise(6, 114), c12 = cellNoise(12, 127);
  for (let z = 0, i = 0; z < n; z++) {
    const w = (z + 0.5) / n;
    for (let y = 0; y < n; y++) {
      const v = (y + 0.5) / n;
      for (let x = 0; x < n; x++, i++) {
        const u = (x + 0.5) / n;
        const smooth = (s4(u * 4, v * 4, w * 4) + s8(u * 8, v * 8, w * 8) * 0.5 + s16(u * 16, v * 16, w * 16) * 0.25) * 0.9 + 0.5;
        const b6 = c6(u * 6, v * 6, w * 6);
        const billow = c3(u * 3, v * 3, w * 3) * 0.65 + b6 * 0.35;
        // Gradient noise carved by the cells: rounded billows with soft insides rather than smoke.
        body[i] = (smooth - (billow - 1)) / (2 - billow);
        fray[i] = b6 * 0.55 + c12(u * 12, v * 12, w * 12) * 0.45;
        soft[i] = smooth;
      }
    }
  }
  normalise(body);
  normalise(fray);
  normalise(soft);
  const data = new Uint8Array(n ** 3 * 4);
  for (let i = 0; i < n ** 3; i++) {
    data[i * 4] = Math.round(body[i] * 255);
    data[i * 4 + 1] = Math.round(fray[i] * 255);
    data[i * 4 + 2] = Math.round(soft[i] * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.Data3DTexture(data, n, n, n);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

/** The haze's colour in its own shade, lit through by the sky round it, for surfaces that go into it. After ATMO_GLSL. */
export const HAZE_SHADE_GLSL = /* glsl */ `
vec3 hazeShade() {
  return (uSkyHorizon * 0.55 + uSkyZenith * 0.6 + uSkyAmbient * 0.8) * vec3(0.95, 0.9, 1.0);
}`;

/** How far toward the sun each step looks to see how much vapour shades it. */
const LIGHT_REACH = 0.7;
/** Within this far of the lens a point is outside the box enough for its near side to be drawn. */
const LENS = 0.6;

const VERT = /* glsl */ `
${ATMO_GLSL}
out vec3 vCube;
out vec3 vWorld;
flat out vec3 vEye;
flat out vec3 vSunStep;
void main() {
  mat4 toCube = inverse(modelMatrix);
  vCube = position;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vEye = (toCube * vec4(cameraPosition, 1.0)).xyz;
  vSunStep = mat3(toCube) * uSunDir * ${LIGHT_REACH.toFixed(2)};
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

/**
 * The box is a unit cube about its middle: x across, y from the foot (-0.5) up to the ceiling under the steps
 * (0.5), z along. Its matrix places it, sheared to follow a flight; `uHome` takes it to where it was built, so its
 * vapour keeps to it when it moves.
 */
const FRAG = /* glsl */ `
${ATMO_GLSL}
${HAZE_SHADE_GLSL}
uniform highp sampler3D uHazeNoise;
uniform mat4 uHome;
uniform vec4 uSize;
uniform float uAmount;
uniform vec4 uOpen;
in vec3 vCube;
in vec3 vWorld;
flat in vec3 vEye;
flat in vec3 vSunStep;

vec2 boxSpan(vec3 ro, vec3 rd) {
  vec3 inv = 1.0 / (rd + vec3(equal(rd, vec3(0.0))) * 1e-6);
  vec3 a = (-0.5 - ro) * inv;
  vec3 b = (0.5 - ro) * inv;
  vec3 lo = min(a, b), hi = max(a, b);
  return vec2(max(max(lo.x, lo.y), lo.z), min(min(hi.x, hi.y), hi.z));
}

/** 1 on the sides of the box that are open to the air, 0 on those that meet the next piece's haze. */
vec2 openAt(vec3 c) {
  return vec2(c.x < 0.0 ? uOpen.x : uOpen.y, c.z < 0.0 ? uOpen.z : uOpen.w);
}

/**
 * How much vapour hangs at a point before the noise breaks it up: a band of it hugging the steps' underside, and
 * below that it thins as it hangs, some columns trailing much further down than their neighbours. It draws in from
 * the open sides as it goes down, so the whole is a rounded mass.
 */
float bodyAt(vec3 c, vec3 home) {
  float k = 0.5 - c.y;
  float h = k * uSize.y;
  float lump = vnoise(home.xz * 1.1 + vec2(uTime * 0.02, 7.3));
  float trail = uSize.y * mix(0.1, 0.45, lump);
  float hang = max(exp(-h / trail), 1.0 - smoothstep(0.2, mix(0.5, 1.2, lump), h));
  float ends = smoothstep(0.0, 0.3, h) * (1.0 - smoothstep(0.6, 1.0, k));
  vec2 r = abs(c.xz) * 2.0 * openAt(c);
  r *= r;
  // The edge wavers round the sides and up and down them, always inside the box, so no side of it ever shows.
  float waver = vnoise(vec2(home.x * 1.4 + home.y * 0.8, home.z * 1.4 - home.y * 0.6)) - 0.5;
  float edge = 0.78 - 0.3 * k + waver * 0.3;
  float sides = 1.0 - smoothstep(edge - 0.5, edge, sqrt(sqrt(dot(r, r))));
  return hang * ends * sides;
}

/** Where two pieces meet each fades straight across the other's edge, so that together they make one haze. */
float joinsAt(vec3 c) {
  vec2 ramp = clamp((0.5 - abs(c.xz)) * uSize.xz / (2.0 * uSize.w), 0.0, 1.0);
  vec2 open = openAt(c);
  return mix(ramp.x, 1.0, open.x) * mix(ramp.y, 1.0, open.y);
}

/**
 * The vapour's texture, drifting on the air and sinking slowly so it trails down off the steps: soft billows up by
 * the steps, drawn out into strands lower down.
 */
float bodyNoise(vec3 home, float k) {
  vec3 q = home + vec3(-0.07, 0.11, 0.04) * uTime;
  float billows = texture(uHazeNoise, q * vec3(0.3, 0.22, 0.3)).r;
  // The billows sway the strands, so they hang in wavering skeins rather than straight lines.
  float strands = texture(uHazeNoise, (q + vec3(billows - 0.5, 0.0, 0.5 - billows) * 0.9) * vec3(0.38, 0.13, 0.38) + vec3(0.21, 0.0, 0.63)).b;
  return mix(billows, strands, smoothstep(0.1, 0.5, k));
}

/** Nearly continuous where the body is thick; where it thins, toward its sides and foot, the noise has more say. */
float coverOf(float body, float n) {
  return clamp((n - 0.5 + 0.6 * body) / 0.6, 0.0, 1.0) * pow(body, 0.8);
}

float densityAt(vec3 c, vec3 home) {
  float body = bodyAt(c, home);
  if (body <= 0.004) return 0.0;
  float k = 0.5 - c.y;
  // Finer cells fray its edges, and its cores barely.
  float fray = texture(uHazeNoise, (home + vec3(0.05, 0.19, -0.08) * uTime) * vec3(0.5, 0.35, 0.5) + 0.37).g;
  return coverOf(body, bodyNoise(home, k) + (fray - 0.5) * (0.12 + 0.12 * k)) * joinsAt(c);
}

/** The vapour between a point and the sun, from its billows alone. */
float shadeAt(vec3 c, vec3 home) {
  float body = bodyAt(c, home);
  if (body <= 0.004) return 0.0;
  float billows = texture(uHazeNoise, (home + vec3(-0.07, 0.11, 0.04) * uTime) * vec3(0.3, 0.22, 0.3)).r;
  return coverOf(body, billows) * joinsAt(c);
}

/**
 * The haze parts along the sightline to whoever is climbing (the middle of the cloud deck's pocket round them), so
 * a loose flight hanging over the child never veils them. What hangs under their own steps stays.
 */
float clearing(vec3 world) {
  vec3 subject = uCloudBubble.xyz - vec3(0.0, 0.45, 0.0);
  vec3 sight = subject - cameraPosition;
  float along = clamp(dot(world - cameraPosition, sight) / dot(sight, sight), 0.0, 1.0);
  float off = length(world - cameraPosition - sight * along);
  float near = (1.0 - smoothstep(3.0, 6.0, distance(world, subject))) * smoothstep(-1.1, -0.8, world.y - subject.y);
  return mix(1.0, smoothstep(0.5, 1.4, off), near);
}

/**
 * The cloud deck's underside and top are solid surfaces that cut through the boxes near them, and the haze beyond
 * them would show through along the cut. Seen from under the deck the haze thins out before the bellies hanging from
 * it; seen from over it, into its top. The side is how far the lens is under the deck and how far over it.
 */
float deckCut(float y, vec2 side) {
  float under = 1.0 - smoothstep(uCloudDeckY.x - 3.8, uCloudDeckY.x - 2.3, y);
  float over = smoothstep(uCloudDeckY.y - 0.2, uCloudDeckY.y + 0.6, y);
  return mix(1.0, under, side.x) * mix(1.0, over, side.y);
}

float scatter(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5);
}

void main() {
  vec3 near = vec3(${LENS.toFixed(2)}) / uSize.xyz;
  bool inside = all(lessThan(abs(vEye), vec3(0.5) + near));
  // From outside, the near faces are marched from; from inside, the far ones from the lens.
  if (gl_FrontFacing == inside) discard;
  vec3 rd = vCube - vEye;
  vec2 span = boxSpan(vEye, rd);
  float t0 = max(span.x, 0.0), t1 = span.y;
  if (t1 <= t0) discard;
  float reach = length(vWorld - cameraPosition);
  float far = t0 * reach;
  // Steps a fixed length on from where the sightline enters, so that neighbouring pixels sample the same air and
  // a step is only ever gained or lost at the far wall, where there is no vapour; a change in the count would band.
  float stride = max(mix(0.2, 0.55, smoothstep(12.0, 70.0, far)), (t1 - t0) * reach / 18.0);
  float dt = stride / reach;
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 homeFrom = (uHome * vec4(vEye, 1.0)).xyz;
  vec3 homeRay = mat3(uHome) * rd;
  vec3 sunHome = uSunDir * ${LIGHT_REACH.toFixed(2)};
  vec3 dir = (vWorld - cameraPosition) / reach;
  float c = dot(dir, uSunDir);
  // Mostly forward: the thin edges catch fire looking into the low sun.
  float phase = 0.25 * scatter(c, 0.65) + 0.75 * scatter(c, -0.1);
  vec3 sun = uSunColor * cloudShadow(vWorld.xz) * phase * 0.45;
  vec3 lilac = hazeShade();
  float sigma = 1.6 * mix(0.6, 1.0, min(uAmount, 1.0));
  vec2 side = vec2(smoothstep(1.0, 4.5, uCloudDeckY.x - cameraPosition.y),
    smoothstep(uCloudDeckY.y - 0.6, uCloudDeckY.y - 0.2, cameraPosition.y)) * uCloudDeck.w;
  float T = 1.0;
  vec3 light = vec3(0.0);
  float seen = 0.0, at = 0.0;
  for (int i = 0; i < 18; i++) {
    float t = t0 + dt * (float(i) + jitter);
    if (t > t1 || T < 0.02) break;
    vec3 p = vEye + rd * t;
    vec3 home = homeFrom + homeRay * t;
    vec3 world = cameraPosition + (vWorld - cameraPosition) * t;
    float d = densityAt(p, home) * smoothstep(0.5, 2.5, t * reach) * clearing(world) * deckCut(world.y, side);
    if (d <= 0.0) continue;
    float a = 1.0 - exp(-sigma * d * dt * reach);
    float shade = shadeAt(p + vSunStep, home + sunHome);
    float lit = 0.75 * exp(-sigma * shade * ${LIGHT_REACH.toFixed(2)} * 1.4) + 0.25 * exp(-sigma * shade * 0.2);
    vec3 s = lilac * (0.78 + 0.3 * (0.5 - p.y)) + sun * lit;
    light += T * a * s;
    seen += T * a;
    at += T * a * t;
    T *= 1.0 - a;
  }
  float alpha = 1.0 - T;
  if (alpha < 0.003) discard;
  vec4 fog = fogOf(cameraPosition + (vWorld - cameraPosition) * (at / seen));
  light = mix(light, fog.rgb * (1.0 - T), fog.a);
  gl_FragColor = vec4(light, alpha);
}`;

const BOX = new THREE.BoxGeometry(1, 1, 1);
// Sheared, a box's corners reach further than the usual sphere round its middle allows for.
BOX.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.5);
/** How far a box reaches past its piece on a side that meets the next piece, to fade across that piece's edge. */
const OVERLAP = 0.35;

let noise: THREE.Data3DTexture | null = null;

/** Which sides of a piece meet the next piece's haze: across (x0, x1) and along (z0, z1). The rest are open air. */
export interface HazeJoins { x0?: boolean; x1?: boolean; z0?: boolean; z1?: boolean }

/** How deep the haze hangs under a piece for `amount` of cloud, and how far out it billows past its open sides. */
const hangs = (amount: number) => 0.8 + 2.0 * amount;
const spills = (amount: number) => 0.3 + 0.2 * Math.min(amount, 1);
/** How far a box reaches past a side of its piece. */
const reach = (joined: boolean | undefined, amount: number) => (joined ? OVERLAP : spills(amount));

/** A box of haze: `shape` takes the unit cube to the piece's own frame, `frame` places that frame in the world. */
function hazeBox(frame: THREE.Matrix4, shape: THREE.Matrix4, size: THREE.Vector4, amount: number, joins: HazeJoins, name: string): THREE.Mesh {
  noise ??= bakeNoise();
  const placed = frame.clone().multiply(shape);
  const open = (joined?: boolean) => (joined ? 0 : 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...atmo.uniforms,
      uHazeNoise: { value: noise },
      uHome: { value: placed.clone() },
      uSize: { value: size },
      uAmount: { value: amount },
      uOpen: { value: new THREE.Vector4(open(joins.x0), open(joins.x1), open(joins.z0), open(joins.z1)) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(BOX, material);
  mesh.name = name;
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(placed);
  mesh.matrixWorldNeedsUpdate = true;
  return mesh;
}

/**
 * The haze under a flight. `frame` is the flight's own: its origin at the foot of the first riser, +z up the flight,
 * +y up, +x across. The steps climb `rise` over `run` and are `width` wide; the haze hangs from `soffit` under the
 * line from the foot of the first riser to the nosing of the last. `amount` is how much cloud it rests on: 0.5 a
 * wisp, 1 a full haze, more in the white. By default both ends meet a landing's haze (`hazeUnderLanding`).
 * The mesh's `matrix` places it (a shear, so it is not decomposed); move it or its parent freely after, and its
 * vapour goes with it.
 */
export function hazeUnderFlight(frame: THREE.Matrix4, run: number, rise: number, width: number, amount: number,
  joins: HazeJoins = { z0: true, z1: true }, soffit = 0.3): THREE.Mesh {
  const depth = hangs(amount);
  const across = width + 2 * spills(amount);
  const z0 = -reach(joins.z0, amount), z1 = run + reach(joins.z1, amount);
  const along = z1 - z0, mid = (z0 + z1) / 2;
  const slope = rise / run;
  // Unit cube to the flight's frame: x across, y down from the sloping ceiling, z along, sheared up the slope.
  const shape = new THREE.Matrix4().set(
    across, 0, 0, 0,
    0, depth, slope * along, slope * mid - soffit - depth / 2,
    0, 0, along, mid,
    0, 0, 0, 1,
  );
  return hazeBox(frame, shape, new THREE.Vector4(across, depth, along, OVERLAP), amount, joins, 'stairs-haze-flight');
}

/**
 * The haze under a landing. `frame` is at the middle of the landing's floor, +y up; the floor is `width` across (x)
 * and `depth` along (z), and the haze hangs from `slab` under it. `joins` are the sides where a flight's haze
 * comes in; `amount` as for a flight.
 */
export function hazeUnderLanding(frame: THREE.Matrix4, width: number, depth: number, amount: number,
  joins: HazeJoins = {}, slab = 0.3): THREE.Mesh {
  const hang = hangs(amount);
  const x0 = -width / 2 - reach(joins.x0, amount), x1 = width / 2 + reach(joins.x1, amount);
  const z0 = -depth / 2 - reach(joins.z0, amount), z1 = depth / 2 + reach(joins.z1, amount);
  const shape = new THREE.Matrix4().makeTranslation((x0 + x1) / 2, -slab - hang / 2, (z0 + z1) / 2)
    .multiply(new THREE.Matrix4().makeScale(x1 - x0, hang, z1 - z0));
  return hazeBox(frame, shape, new THREE.Vector4(x1 - x0, hang, z1 - z0, OVERLAP), amount, joins, 'stairs-haze-landing');
}

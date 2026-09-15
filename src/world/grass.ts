import * as THREE from 'three';
import { params } from '../params';
import { ATMO_GLSL, atmo } from './atmosphere';
import { FIELDS_GLSL, fieldAt, type FieldSample } from './fields';
import { COTTAGE, GRASS_LINE, HEIGHTFIELD_GLSL, LAST_HILL } from './heightfield';
import { heightAt } from './island';
import { shaderFbm, smoothstep } from './noise';
import { WINDOW } from './window';

const TILE = 8;

interface LodSpec {
  /** Blades per tile side. */
  side: number;
  segments: number;
  /** Tiles nearer than this (to the camera, on the ground) use this level. */
  reach: number;
  /** Where this level thins toward the next, as fractions of `reach`. */
  thinFrom: number;
  /** Density of the next level relative to this one (0 for the last, which fades out). */
  nextDensity: number;
  widthScale: number;
  maxTiles: number;
}

const LODS: LodSpec[] = [
  { side: 32, segments: 6, reach: 52, thinFrom: 0.72, nextDensity: (17 * 17) / (32 * 32), widthScale: 1, maxTiles: 700 },
  { side: 17, segments: 5, reach: 112, thinFrom: 0.84, nextDensity: (10 * 10) / (17 * 17), widthScale: 1.35, maxTiles: 1100 },
  { side: 10, segments: 4, reach: 176, thinFrom: 0.82, nextDensity: 0, widthScale: 1.9, maxTiles: 1600 },
];

/** The meadow palette and tint pattern, shared with the terrain so far grass matches the blades. */
export const GRASS_GLSL = /* glsl */ `
uniform vec3 uGrassRoot;
uniform vec3 uTipLush;
uniform vec3 uTipDry;
uniform vec3 uTipCool;
/** 1 on the mainland's grazed pasture, 0 on the island's wild meadow. */
float pastureAt(vec2 xz) {
  return smoothstep(-600.0, -660.0, xz.y);
}
vec3 grassTint(vec2 xz) {
  float dry = smoothstep(0.58, 0.76, fbm(xz * 0.022 + vec2(3.1, 7.7)));
  float cool = smoothstep(0.5, 0.68, fbm(xz * 0.041 - vec2(5.3, 1.9))) * (1.0 - dry);
  vec3 meadow = mix(mix(uTipLush, uTipDry, dry * 0.85), uTipCool, cool * 0.5);
  vec3 emerald = mix(vec3(0.16, 0.36, 0.07), vec3(0.3, 0.46, 0.09), fbm(xz * 0.03 + 11.0));
  emerald = mix(emerald, uTipDry * 0.9, dry * 0.35);
  return mix(meadow, emerald, pastureAt(xz));
}
`;

const fieldSample: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 };

/** Typical blade height at (x, z): the vertex shader's formula without the per-blade randomness. */
export function grassHeightAt(x: number, z: number): number {
  const groundH = heightAt(x, z);
  if (groundH < GRASS_LINE - 0.6) return 0;
  const lush = shaderFbm(x * 0.035 + 17, z * 0.035 + 17);
  const shortPatch = smoothstep(0.52, 0.68, shaderFbm(x * 0.05 - 23, z * 0.05 - 23));
  const fringe = smoothstep(GRASS_LINE - 0.6, GRASS_LINE + 2.2, groundH);
  const pasture = smoothstep(-600, -660, z);
  let h = (1.1 + 1.9 * smoothstep(0.3, 0.75, lush) + 0.275) * (0.2 + 0.8 * fringe * fringe) * (1 - shortPatch * 0.5);
  if (pasture <= 0) return h;
  h += (0.41 + 0.26 * lush - h) * pasture;
  const f = fieldAt(x, z, fieldSample);
  const grazed = Math.max(
    1 - smoothstep(45, 95, Math.hypot(x - LAST_HILL.x, z - LAST_HILL.z)),
    1 - smoothstep(14, 30, Math.hypot(x - COTTAGE.x, z - COTTAGE.z)),
  );
  const walled = f.wall && f.presence >= 0.5 ? 1 : 0;
  const hay = (f.kind <= 0.22 ? 1 : 0) * f.presence * (1 - grazed);
  const rush = (f.kind >= 0.86 ? 1 : 0) * f.presence * (1 - grazed);
  const wallTuft = walled * (1 - smoothstep(0.9, 2.4, f.edge));
  return h * (1 + hay * 1.5 + rush * 1.2 + wallTuft * 1.8) * (1 - 0.5 * grazed);
}

export const grassUniforms = {
  uGrassRoot: { value: new THREE.Color('#15291d') },
  uTipLush: { value: new THREE.Color('#7d9a3c') },
  uTipDry: { value: new THREE.Color('#c4a152') },
  uTipCool: { value: new THREE.Color('#4a8660') },
};

const VERT = /* glsl */ `
${ATMO_GLSL}
${HEIGHTFIELD_GLSL}
${FIELDS_GLSL}
${GRASS_GLSL}
in vec2 aTile;
uniform float uSide;
uniform float uTileSize;
uniform float uReach;
uniform float uThinFrom;
uniform float uNextDensity;
uniform float uWidthScale;
uniform float uDensity;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vSideDir;
out vec3 vGroundN;
out vec3 vTint;
out vec4 vFog;
out float vT;
out float vBend;
out float vFringe;
out float vSun;
out float vFar;
out vec4 vFlower;

uint gr_hash(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v.x ^ v.y;
}
float gr_rand(inout uint s) {
  s = s * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return float((w >> 22u) ^ w) / 4294967295.0;
}

void collapse() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}

void main() {
  int side = int(uSide);
  int id = gl_InstanceID % (side * side);
  vec2 cell = vec2(float(id % side), float(id / side));
  vec2 tileCell = floor(aTile / uTileSize + 0.5);
  uvec2 key = uvec2(ivec2(tileCell * uSide + cell) + ivec2(1 << 20));
  uint s = gr_hash(key);
  vec2 root2 = aTile + (cell + vec2(gr_rand(s), gr_rand(s))) * (uTileSize / uSide);
  float rank = gr_rand(s);

  vec2 uv = domainUv(root2);
  if (!insideUv(uv)) { collapse(); return; }
  vec4 hn = texture(uHeightTex, uv);
  float groundH = hn.r;
  float dist = length(root2 - cameraPosition.xz);
  float thin = smoothstep(uReach * uThinFrom, uReach, dist);
  float keep = mix(1.0, uNextDensity, thin) * uDensity;
  float edge = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 1.2).toFixed(2)}, groundH);
  float tufts = smoothstep(0.48, 0.72, vnoise(root2 * 0.35));
  keep *= edge > 0.85 ? 1.0 : edge * edge * tufts;
  keep *= smoothstep(0.55, 0.7, hn.b);
  vec4 surf = surfaceAt(root2);
  keep *= surf.x;
  vec4 fld = fieldAt(root2);
  float walled = fld.z * step(0.5, fld.w);
  if (walled > 0.5 && fld.x < 0.72) keep = 0.0;
  if (rank >= keep) { collapse(); return; }

  float side01 = position.x;
  float t = position.y;
  float seed = gr_rand(s);
  float lush = fbm(root2 * 0.035 + 17.0);
  float shortPatch = smoothstep(0.52, 0.68, fbm(root2 * 0.05 - 23.0));
  float fringe = smoothstep(${(GRASS_LINE - 0.6).toFixed(2)}, ${(GRASS_LINE + 2.2).toFixed(2)}, groundH);
  float life = lifeAt(root2);
  float pasture = pastureAt(root2);
  float h = (1.1 + 1.9 * smoothstep(0.3, 0.75, lush) + 0.55 * gr_rand(s)) * (0.2 + 0.8 * fringe * fringe) * (1.0 - shortPatch * 0.5);
  float tuft = step(0.93, gr_rand(s)) * smoothstep(0.45, 0.8, lush) * step(95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0)));
  h = mix(h, (0.34 + 0.26 * lush + 0.14 * gr_rand(s)) * (1.0 + tuft * 2.2), pasture);
  float grazed = max(1.0 - smoothstep(45.0, 95.0, length(root2 - vec2(${LAST_HILL.x}.0, ${LAST_HILL.z}.0))),
                     1.0 - smoothstep(14.0, 30.0, length(root2 - vec2(${COTTAGE.x}.0, ${COTTAGE.z}.0))));
  float hay = step(fld.y, 0.22) * fld.w * (1.0 - grazed);
  float rush = step(0.86, fld.y) * fld.w * (1.0 - grazed);
  float wallTuft = walled * (1.0 - smoothstep(0.9, 2.4, fld.x));
  h *= (1.0 + hay * 1.5 + rush * 1.2 + wallTuft * 1.8) * mix(1.0, 0.5, grazed);
  h *= mix(0.72, 1.0, life);
  h *= 1.0 - smoothstep(uReach * 0.8, uReach, dist) * step(uNextDensity, 0.001);
  float width = (0.15 + 0.1 * gr_rand(s)) * uWidthScale;
  float angle = gr_rand(s) * 6.2831853;
  float curve = 0.12 + 0.28 * gr_rand(s);
  float flower = step(gr_rand(s), surf.z * 0.28) * step(0.5, life);
  float petal = gr_rand(s);
  h *= 1.0 + flower * 0.18;
  vec3 rootPos = vec3(root2.x, groundH - 0.12, root2.y);

  vec4 ground = groundAt(root2);
  vec4 bend = texture(uBendTex, uv);
  vec4 wind = texture(uWindTex, uv);
  float sp = length(wind.xy);

  vec2 facing = vec2(cos(angle), sin(angle));
  float ph = seed * 43.1;
  float flutterAmp = (0.04 + 0.012 * sp) * (0.6 + 0.4 * t) * mix(0.3, 1.0, life);
  vec2 flutter = vec2(sin(uTime * (2.7 + seed * 2.1) + ph), sin(uTime * (2.1 + seed * 1.6) + ph * 1.7)) * flutterAmp;
  vec2 wb = bend.xy + flutter;
  float wa = length(wb);
  vec2 wdir = wa > 1e-4 ? wb / wa : facing;
  vec2 align = dot(facing, wdir) >= 0.0 ? wdir : -wdir;
  facing = normalize(mix(facing, align, smoothstep(0.2, 1.0, wa) * 0.75));

  vec2 lean = wb + facing * curve;
  float ll = length(lean);
  float A = clamp(ll, 1e-3, 1.5);
  vec2 dir = ll > 1e-4 ? lean / ll : facing;
  float sA = t * A;
  float horiz = h * (1.0 - cos(sA)) / A;
  float vert = h * sin(sA) / A;
  vec3 spine = vec3(dir.x * horiz, vert, dir.y * horiz);
  vec3 tangent = vec3(dir.x * sin(sA), cos(sA), dir.y * sin(sA));
  vec3 sideDir = vec3(-facing.y, 0.0, facing.x);
  float w = width * (1.0 - smoothstep(0.3, 1.0, t) * 0.85);
  w = mix(w, width * (t > 0.72 ? 1.9 : 0.3), flower);
  vec3 world = rootPos + spine + sideDir * side01 * w * 0.5;

  vec3 nrm = cross(sideDir, tangent);
  vNormal = length(nrm) > 1e-4 ? normalize(nrm) : vec3(0.0, 1.0, 0.0);
  vSideDir = sideDir * side01;
  vGroundN = ground.xyz;
  vec3 tint = grassTint(root2) * (0.8 + 0.4 * seed) * (0.92 + 0.16 * fract(fld.y * 7.3) * fld.w);
  tint = mix(tint, vec3(0.62, 0.52, 0.2), hay * 0.55);
  tint = mix(tint, vec3(0.13, 0.24, 0.1), rush * 0.5);
  vTint = mix(stillGrey(tint), tint, life);
  vFringe = smoothstep(${(GRASS_LINE - 0.5).toFixed(2)}, ${(GRASS_LINE + 1.4).toFixed(2)}, groundH);
  vSun = mix(ground.w, 1.0, t * t * 0.3) * cloudShadow(root2);
  vFog = fogOf(world);
  vWorld = world;
  vT = t;
  vBend = wa;
  vFar = smoothstep(60.0, 170.0, dist);
  vec3 bloom = petal < 0.4 ? vec3(1.0, 0.8, 0.14) : petal < 0.7 ? vec3(0.97, 0.95, 0.9) : petal < 0.9 ? vec3(0.93, 0.52, 0.68) : vec3(0.62, 0.46, 0.88);
  vFlower = vec4(mix(stillGrey(bloom), bloom, life), flower);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundBounce;
uniform vec3 uGrassRoot;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vSideDir;
in vec3 vGroundN;
in vec3 vTint;
in vec4 vFog;
in float vT;
in float vBend;
in float vFringe;
in float vSun;
in float vFar;
in vec4 vFlower;

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  if (dot(N, V) < 0.0) N = -N;
  N = normalize(N + vSideDir * 0.35 + vec3(0.0, 1e-3, 0.0));
  N = normalize(mix(N, vGroundN, 0.5) + vec3(0.0, 1e-3, 0.0));

  vec3 root = mix(mix(vTint * 0.55, uGrassRoot, vFringe), mix(uGrassRoot, vTint, 0.62), vFar);
  vec3 alb = mix(root, vTint, smoothstep(0.0, 0.95, vT));
  float flattened = smoothstep(0.3, 1.0, vBend) * vT;
  alb = mix(alb, alb * 1.45 + vec3(0.05, 0.06, 0.035), flattened);
  alb = mix(alb, vFlower.rgb, vFlower.a * smoothstep(0.66, 0.78, vT));

  float ao = mix(mix(mix(0.7, 0.22, vFringe), 1.0, smoothstep(0.0, 0.8, vT)), 1.0, vFar * 0.75);
  float diff = clamp(dot(N, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  float back = pow(max(dot(-V, uSunDir), 0.0), 4.0);
  vec3 trans = uSunColor * vTint * back * vT * vT * 0.9;
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 24.0) * (0.16 + 0.5 * flattened) * vT;
  vec3 ambient = mix(uGroundBounce, uSkyAmbient, N.y * 0.5 + 0.5);

  vec3 col = alb * ambient * ao + (alb * uSunColor * diff * ao + trans + uSunColor * spec) * vSun;
  gl_FragColor = vec4(mix(col, vFog.rgb, vFog.a), 1.0);
}`;

function bladeTemplate(segments: number): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    pos.push(-1, t, 0, 1, t, 0);
  }
  pos.push(0, 1, 0);
  const index: number[] = [];
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (segments - 1) * 2;
  index.push(last, last + 1, last + 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

interface Lod {
  spec: LodSpec;
  geo: THREE.InstancedBufferGeometry;
  tiles: THREE.InstancedBufferAttribute;
  count: number;
}

/**
 * A meadow placed on the GPU in world-anchored tiles around the camera. The CPU only picks visible tiles with
 * land in them; each blade's place, size and colour come from a hash of its world cell, so nothing swims.
 */
export class Grass {
  readonly group = new THREE.Group();
  private readonly lods: Lod[] = [];
  private readonly frustum = new THREE.Frustum();
  private readonly matrix = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private readonly land = new Map<number, boolean>();

  constructor() {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const density = Math.min(1, params.grass ?? (touch ? 0.55 : 1));
    for (const spec of LODS) {
      const template = bladeTemplate(spec.segments);
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = template.index;
      geo.setAttribute('position', template.attributes.position);
      const tiles = new THREE.InstancedBufferAttribute(new Float32Array(spec.maxTiles * 2), 2, false, spec.side * spec.side);
      tiles.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aTile', tiles);
      geo.instanceCount = 0;
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          ...atmo.uniforms,
          ...grassUniforms,
          uSide: { value: spec.side },
          uTileSize: { value: TILE },
          uReach: { value: spec.reach },
          uThinFrom: { value: spec.thinFrom },
          uNextDensity: { value: spec.nextDensity },
          uWidthScale: { value: spec.widthScale },
          uDensity: { value: density },
        },
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.lods.push({ spec, geo, tiles, count: 0 });
    }
  }

  get bladesDrawn(): number {
    return this.lods.reduce((n, l) => n + l.count * l.spec.side * l.spec.side, 0);
  }

  private hasLand(tx: number, tz: number): boolean {
    const key = tx * 100003 + tz;
    let v = this.land.get(key);
    if (v === undefined) {
      const x = tx * TILE;
      const z = tz * TILE;
      v = false;
      for (const [ox, oz] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]]) {
        if (heightAt(x + ox * TILE, z + oz * TILE) > GRASS_LINE - 0.8) {
          v = true;
          break;
        }
      }
      if (this.land.size > 60000) this.land.clear();
      this.land.set(key, v);
    }
    return v;
  }

  update(camera: THREE.Camera): void {
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    const cx = camera.position.x;
    const cz = camera.position.z;
    const reach = LODS[LODS.length - 1].reach;
    for (const l of this.lods) l.count = 0;
    const x0 = Math.floor((Math.max(cx - reach, WINDOW.minX)) / TILE);
    const x1 = Math.floor((Math.min(cx + reach, WINDOW.minX + WINDOW.size)) / TILE);
    const z0 = Math.floor((Math.max(cz - reach, WINDOW.minZ)) / TILE);
    const z1 = Math.floor((Math.min(cz + reach, WINDOW.minZ + WINDOW.size)) / TILE);
    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        const mx = (tx + 0.5) * TILE;
        const mz = (tz + 0.5) * TILE;
        const d = Math.hypot(mx - cx, mz - cz) - TILE * 0.7;
        if (d > reach) continue;
        if (!this.hasLand(tx, tz)) continue;
        this.sphere.center.set(mx, heightAt(mx, mz) + 1.5, mz);
        this.sphere.radius = TILE * 0.75 + 4;
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
        const lod = this.lods.find((l) => d < l.spec.reach) ?? this.lods[this.lods.length - 1];
        if (lod.count >= lod.spec.maxTiles) continue;
        lod.tiles.array[lod.count * 2] = tx * TILE;
        lod.tiles.array[lod.count * 2 + 1] = tz * TILE;
        lod.count++;
      }
    }
    for (const l of this.lods) {
      l.tiles.clearUpdateRanges();
      l.tiles.addUpdateRange(0, l.count * 2);
      l.tiles.needsUpdate = true;
      l.geo.instanceCount = l.count * l.spec.side * l.spec.side;
    }
  }
}

import * as THREE from 'three';
import { params } from '../params';
import { ATMO_GLSL, atmo } from './atmosphere';
import { GRASS_GLSL, RIME_GLSL, grassUniforms } from './grass';
import { FIELDS_GLSL } from './fields';
import { GRASS_LINE, HEIGHTFIELD_GLSL, ISLES } from './heightfield';
import { REFLECTION_LAYER } from './water/reflection';
import { SURF_GLSL, surfUniforms } from './water/surf';

const SEGMENTS = 32;
const ROOT = 2048;
const MIN_NODE = 32;
/** Leaves stop splitting at this distance factor; the lite world splits less, so far hills carry fewer height evaluations. */
const SPLIT = params.lite ? 1.1 : 1.6;
/** The sea's mirror sees the land at quarter size through ripples, so its leaves split far less. */
const MIRROR_SPLIT = params.mirrorlod === 'full' ? SPLIT : 0.7;
const REACH = 4096;
const MAX_LEAVES = 2048;
/** Where the blades thin out; from here the terrain paints the meadow. Matches the grass's last level of detail. */
const FIELD_FROM = 118;
const FIELD_TO = 172;

const VERT = /* glsl */ `
${HEIGHTFIELD_GLSL}
uniform float uMirrorPass;
uniform sampler2D uHeightTex;
uniform vec4 uDomain;
in vec3 aNode;
out vec3 vWorld;
out vec3 vNormal;

/** The window's height bake where it has one (much cheaper than the height function), the function beyond it. */
float groundHeight(vec2 q) {
  vec2 uv = (q - uDomain.xy) * uDomain.zw;
  if (any(lessThan(uv, vec2(0.003))) || any(greaterThan(uv, vec2(0.997)))) return worldHeight(q);
#ifdef HEIGHT_FILTERABLE
  return textureLod(uHeightTex, uv, 0.0).r;
#else
  vec2 size = vec2(textureSize(uHeightTex, 0));
  vec2 t = uv * size - 0.5;
  ivec2 i = ivec2(floor(t));
  vec2 f = fract(t);
  float a = texelFetch(uHeightTex, i, 0).r;
  float b = texelFetch(uHeightTex, i + ivec2(1, 0), 0).r;
  float c = texelFetch(uHeightTex, i + ivec2(0, 1), 0).r;
  float d = texelFetch(uHeightTex, i + ivec2(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
#endif
}

void main() {
  vec2 p = aNode.xy + position.xz * aNode.z;
  float e = aNode.z / ${SEGMENTS}.0;
  float h = groundHeight(p);
  float hx = groundHeight(p + vec2(e, 0.0));
  float hz = groundHeight(p + vec2(0.0, e));
  vNormal = normalize(vec3(h - hx, e, h - hz));
  float meadowTop = uMirrorPass * smoothstep(${GRASS_LINE.toFixed(2)}, ${(GRASS_LINE + 1.5).toFixed(2)}, h) * 1.1;
  vec3 world = vec3(p.x, h + meadowTop - position.y * (0.6 + aNode.z * 0.03), p.y);
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
${HEIGHTFIELD_GLSL}
${FIELDS_GLSL}
${GRASS_GLSL}
${RIME_GLSL}
${SURF_GLSL}
uniform vec3 uSand;
uniform vec3 uWetSand;
uniform vec3 uGround;
uniform vec3 uRock;
uniform vec2 uBreeze;
in vec3 vWorld;
in vec3 vNormal;

/** The land as the sea mirrors it: blurred and broken up by ripples, so flat meadow and sand colours are enough. */
vec3 mirrorShade(vec3 n, vec2 xz, float h) {
  float grassy = smoothstep(${GRASS_LINE.toFixed(2)} + 0.1, ${GRASS_LINE.toFixed(2)} + 1.4, h);
  float life = lifeAt(xz);
  vec3 meadow = mix(uGrassRoot, mix(uTipLush, vec3(0.22, 0.4, 0.09), pastureAt(xz)), 0.62);
  vec3 alb = mix(uSand, meadow, grassy);
  alb = mix(stillGrey(alb), alb, 0.45 + 0.55 * life);
  alb = mix(alb, uRock * 0.9, smoothstep(0.42, 0.6, 1.0 - n.y));
  float sun = groundAt(xz).w * cloudShadow(xz);
  return applyFog(alb * (hemiLight(n) + uSunColor * max(dot(n, uSunDir), 0.0) * sun), vWorld);
}

void main() {
  vec3 n = normalize(vNormal);
  vec2 xz = vWorld.xz;
  float h = vWorld.y;
  if (uMirrorPass > 0.5) {
    gl_FragColor = vec4(mirrorShade(n, xz, h), 1.0);
    return;
  }
  float dist = length(vWorld - cameraPosition);
  float detail = 1.0 - smoothstep(60.0, 260.0, dist);
  float grain = mix(0.5, vnoise(xz * 1.7) * 0.5 + vnoise(xz * 6.0) * 0.5, detail);
  float ripples = mix(0.5, sin(dot(xz, vec2(0.9, 0.45)) * 2.2 + vnoise(xz * 0.3) * 6.0) * 0.5 + 0.5, detail);
  vec3 sand = uSand * (0.9 + 0.12 * grain) * (0.96 + 0.06 * ripples);
  float grassy = smoothstep(${GRASS_LINE.toFixed(2)} + 0.1, ${GRASS_LINE.toFixed(2)} + 1.4, h + (grain - 0.5) * 0.5);
  Footprint fp = footprintOf(xz);
  float shore = h < 2.5 ? shoreDistance(xz) : 1e3;
  bool beach = shore < 6.0 && grassy < 1.0;
  vec4 swash = beach ? beachSwash(xz, shore, -normalize(n.xz + 1e-5), fp) * (1.0 - grassy) : vec4(0.0);
  float wet = max(swash.z, smoothstep(5.0, 0.0, shore) * 0.5) * (1.0 - grassy);
  vec3 alb = mix(sand, uWetSand, wet * 0.85);
  float slope = 1.0 - n.y;

  vec4 surf = surfaceAt(xz);
  alb = mix(alb, uGround * vec3(1.35, 1.05, 0.8) * (0.8 + 0.3 * grain), grassy * (1.0 - surf.x));
  grassy *= smoothstep(0.34, 0.45, 1.0 - slope) * surf.x;
  float far = max(smoothstep(${FIELD_FROM}.0, ${FIELD_TO}.0, length(xz - cameraPosition.xz)), uMirrorPass);
  vec3 tint = grassTint(xz);
  vec4 fld = fieldAt(xz);
  float hay = step(fld.y, 0.22) * fld.w;
  float rush = step(0.86, fld.y) * fld.w;
  tint *= 0.92 + 0.16 * fract(fld.y * 7.3) * fld.w;
  tint = mix(tint, vec3(0.62, 0.52, 0.2), hay * 0.55);
  tint = mix(tint, vec3(0.13, 0.24, 0.1), rush * 0.5);
  vec3 field = mix(uGrassRoot, tint, 0.62) * (0.9 + 0.16 * fbm(xz * 0.09 + 31.0));
  vec2 dUv = domainUv(xz);
  float flattened = insideUv(dUv) ? smoothstep(0.3, 1.0, length(texture(uBendTex, dUv).xy)) : 0.0;
  float waves = fbm(xz * 0.016 - uBreeze * uTime * 0.016);
  field *= 0.88 + 0.24 * waves + 0.35 * flattened;
  vec3 under = uGround * (0.85 + 0.3 * grain);
  float life = lifeAt(xz);
  field = mix(stillGrey(field), field, life);
  under = mix(stillGrey(under), under, life);
  tint = mix(stillGrey(tint), tint, life);
  alb = mix(stillGrey(alb) * 1.04, alb, 0.45 + 0.55 * life);
  alb = mix(alb, mix(under, field, far), grassy);
  /** Under the birches the floor is leaf mould, not soil: what shows between the fallen leaves stays warm. */
  float duff = 1.0 - smoothstep(0.6, 1.02, length((xz - vec2(${ISLES.birches.x}.0, ${ISLES.birches.z}.0)) / vec2(${ISLES.birches.rx}.0, ${ISLES.birches.rz}.0)));
  alb = mix(alb, vec3(0.42, 0.26, 0.12) * (0.82 + 0.5 * grain), grassy * duff * 0.88);
  alb = mix(alb, uRock * (0.8 + 0.4 * grain), smoothstep(0.42, 0.6, slope));
  float lineWidth = max(0.5, dist * 0.0024);
  float wallLine = (1.0 - smoothstep(lineWidth * 0.45, lineWidth, fld.x)) * fld.z * fld.w;
  alb = mix(alb, vec3(0.14, 0.14, 0.12) * mix(1.0, 0.75, far), wallLine * 0.85);

  vec4 g = groundAt(xz);
  float sun = g.w * cloudShadow(xz);
  float ndl = dot(n, uSunDir);
  float lambert = max(ndl, 0.0);
  float wrap = clamp(ndl * 0.6 + 0.4, 0.0, 1.0);
  float lit = mix(lambert, wrap, grassy * far);
  vec3 V = normalize(cameraPosition - vWorld);
  float back = pow(max(dot(-V, uSunDir), 0.0), 4.0) * grassy * far;
  /**
   * The sleeping island's sward is cropped shorter than the gap between one blade and the next, so its ground
   * shows between them and has to be the grass itself rather than the soil under it. The frost then creeps over
   * both together, in the grain of the ground rather than as a wash laid over the top of it.
   */
  alb = mix(alb, mix(under, field, 0.35) * (0.88 + 0.24 * grain), grassy * sleepFloorAt(xz) * 0.92);
  alb = mix(alb, rimeColour() * (0.86 + 0.28 * grain), frostAt(xz) * 0.78);
  vec3 col = alb * (hemiLight(n) + uSunColor * lit * sun + lampLight(vWorld, n) + dawnLight(vWorld, n)) + uSunColor * tint * back * 0.45 * sun;
  if (beach) col = shadeSwash(col, swash, vWorld, sun);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}`;

function leafTemplate(s: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const at = (i: number, j: number) => j * (s + 1) + i;
  for (let j = 0; j <= s; j++) for (let i = 0; i <= s; i++) pos.push(i / s, 0, j / s);
  for (let j = 0; j < s; j++) {
    for (let i = 0; i < s; i++) idx.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
  }
  const border: number[] = [];
  for (let i = 0; i <= s; i++) border.push(at(i, 0));
  for (let j = 1; j <= s; j++) border.push(at(s, j));
  for (let i = s - 1; i >= 0; i--) border.push(at(i, s));
  for (let j = s - 1; j >= 1; j--) border.push(at(0, j));
  const skirtStart = pos.length / 3;
  for (const b of border) pos.push(pos[b * 3], 1, pos[b * 3 + 2]);
  for (let k = 0; k < border.length; k++) {
    const b0 = border[k];
    const b1 = border[(k + 1) % border.length];
    const s0 = skirtStart + k;
    const s1 = skirtStart + ((k + 1) % border.length);
    idx.push(b0, s0, b1, b1, s0, s1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

/**
 * The ground, to the horizon: a quadtree of square leaves around the camera, finer near it, each a 32×32 grid
 * whose heights come from the shared height function on the GPU. Skirts hide cracks between sizes.
 */
interface LeafSet {
  geo: THREE.InstancedBufferGeometry;
  nodes: THREE.InstancedBufferAttribute;
  count: number;
}

export class Terrain {
  readonly mesh: THREE.Mesh;
  private readonly main: LeafSet;
  private readonly mirror: LeafSet;
  private readonly frustum = new THREE.Frustum();
  private readonly matrix = new THREE.Matrix4();
  private readonly box = new THREE.Box3();
  private readonly camPos = new THREE.Vector3();
  private filling: LeafSet;
  private split = SPLIT;

  constructor(breeze: THREE.Vector2, heightFilterable: boolean) {
    const template = leafTemplate(SEGMENTS);
    const makeSet = (): LeafSet => {
      const geo = new THREE.InstancedBufferGeometry();
      geo.index = template.index;
      geo.setAttribute('position', template.attributes.position);
      const nodes = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LEAVES * 3), 3);
      nodes.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aNode', nodes);
      geo.instanceCount = 0;
      return { geo, nodes, count: 0 };
    };
    this.main = makeSet();
    this.mirror = makeSet();
    this.filling = this.main;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        ...atmo.uniforms,
        ...grassUniforms,
        ...surfUniforms,
        uSand: { value: new THREE.Color('#e6d2a6') },
        uWetSand: { value: new THREE.Color('#a48c66') },
        uGround: { value: new THREE.Color('#2e3f22') },
        uRock: { value: new THREE.Color('#857a6c') },
        uBreeze: { value: breeze },
      },
      side: THREE.DoubleSide,
      defines: heightFilterable ? { HEIGHT_FILTERABLE: '' } : {},
    });
    this.mesh = new THREE.Mesh(this.main.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.layers.enable(REFLECTION_LAYER);
  }

  get leaves(): number {
    return this.main.count;
  }

  /** Picks the leaves for the main view. */
  update(camera: THREE.Camera): void {
    this.fill(this.main, camera, SPLIT);
  }

  /** Picks a coarser set of leaves for the sea's mirror camera and draws it until `endMirror`. */
  beginMirror(camera: THREE.Camera): void {
    this.fill(this.mirror, camera, MIRROR_SPLIT);
    this.mesh.geometry = this.mirror.geo;
  }

  endMirror(): void {
    this.mesh.geometry = this.main.geo;
  }

  private fill(set: LeafSet, camera: THREE.Camera, split: number): void {
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    this.camPos.copy(camera.position);
    this.filling = set;
    this.split = split;
    set.count = 0;
    const x0 = Math.floor((this.camPos.x - REACH) / ROOT) * ROOT;
    const z0 = Math.floor((this.camPos.z - REACH) / ROOT) * ROOT;
    for (let z = z0; z < this.camPos.z + REACH; z += ROOT) {
      for (let x = x0; x < this.camPos.x + REACH; x += ROOT) this.visit(x, z, ROOT);
    }
    set.nodes.clearUpdateRanges();
    set.nodes.addUpdateRange(0, set.count * 3);
    set.nodes.needsUpdate = true;
    set.geo.instanceCount = set.count;
  }

  private visit(x: number, z: number, size: number): void {
    this.box.min.set(x, -16, z);
    this.box.max.set(x + size, 110, z + size);
    if (!this.frustum.intersectsBox(this.box)) return;
    const d = this.box.distanceToPoint(this.camPos);
    if (size > MIN_NODE && d < size * this.split) {
      const half = size / 2;
      this.visit(x, z, half);
      this.visit(x + half, z, half);
      this.visit(x, z + half, half);
      this.visit(x + half, z + half, half);
      return;
    }
    const set = this.filling;
    if (set.count >= MAX_LEAVES) return;
    const a = set.nodes.array as Float32Array;
    a[set.count * 3] = x;
    a[set.count * 3 + 1] = z;
    a[set.count * 3 + 2] = size;
    set.count++;
  }
}

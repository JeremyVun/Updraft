import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { fieldAt, type FieldSample } from './fields';
import { hash2 } from './heightfield';
import { heightAt } from './island';

const TILE = 16;
const STEP = 0.62;
const REACH = 150;
const MAX_STONES = 26000;
const TILES_PER_FRAME = 3;

const VERT = /* glsl */ `
in vec4 aPlace;
in vec4 aSize;
out vec3 vWorld;
out vec3 vNormal;
out float vTint;
void main() {
  float c = cos(aPlace.w);
  float s = sin(aPlace.w);
  vec3 p = position * aSize.xyz;
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  vec3 n = normal / aSize.xyz;
  n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
  vWorld = aPlace.xyz + p;
  vNormal = normalize(n);
  vTint = aSize.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in float vTint;
void main() {
  vec3 n = normalize(vNormal);
  vec3 stone = mix(vec3(0.34, 0.33, 0.31), vec3(0.46, 0.43, 0.38), vTint);
  float lichen = smoothstep(0.62, 0.8, vnoise(vWorld.xz * 3.1 + vWorld.y * 2.0));
  stone = mix(stone, vec3(0.62, 0.6, 0.42), lichen * 0.55);
  float moss = smoothstep(0.35, 0.9, n.y) * smoothstep(0.4, 0.7, vnoise(vWorld.xz * 1.3 + 4.0));
  float life = lifeAt(vWorld.xz);
  vec3 mossCol = mix(stillGrey(vec3(0.2, 0.3, 0.08)), vec3(0.2, 0.3, 0.08), life);
  stone = mix(stone, mossCol, moss * 0.7);
  vec4 g = groundAt(vWorld.xz);
  float sun = g.w * cloudShadow(vWorld.xz);
  float ndl = max(dot(n, uSunDir), 0.0);
  float ao = mix(0.55, 1.0, smoothstep(0.0, 1.0, vWorld.y - texture(uHeightTex, domainUv(vWorld.xz)).r));
  vec3 col = stone * (hemiLight(n) * ao + uSunColor * ndl * sun);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function stoneGeometry(): THREE.BufferGeometry {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 1).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.82 + ((hash2(i, 7) & 0xff) / 255) * 0.3;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

interface TileStones {
  data: Float32Array;
  count: number;
}

const rand = (i: number, j: number, k: number) => (hash2(i * 7 + k, j * 13 - k) & 0xffff) / 65535;

/** Stones along the walled field boundaries of one tile: two courses and a row of upright capstones. */
function buildTile(tx: number, tz: number, sample: FieldSample): TileStones {
  const x0 = tx * TILE;
  const z0 = tz * TILE;
  let near = false;
  for (const [ox, oz] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) {
    const f = fieldAt(x0 + ox * TILE, z0 + oz * TILE, sample);
    if (f.presence > 0 && f.edge < TILE * 0.75) near = true;
  }
  if (!near) return { data: new Float32Array(0), count: 0 };
  const out: number[] = [];
  const n = Math.ceil(TILE / STEP);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const gi = tx * n + i;
      const gj = tz * n + j;
      const x = x0 + (i + rand(gi, gj, 1)) * STEP;
      const z = z0 + (j + rand(gi, gj, 2)) * STEP;
      const f = fieldAt(x, z, sample);
      if (!f.wall || f.presence < 0.6 || f.edge > 0.34) continue;
      const e = 0.3;
      const ex = fieldAt(x + e, z, sample).edge - fieldAt(x - e, z, sample).edge;
      const ez = fieldAt(x, z + e, sample).edge - fieldAt(x, z - e, sample).edge;
      const along = Math.atan2(-ex, -ez);
      const ground = heightAt(x, z);
      const tint = rand(gi, gj, 3);
      const r = rand(gi, gj, 4);
      out.push(x, ground + 0.22, z, along + (r - 0.5) * 0.6, 0.46 + r * 0.22, 0.3 + rand(gi, gj, 5) * 0.12, 0.34 + rand(gi, gj, 6) * 0.14, tint);
      out.push(x + (rand(gi, gj, 7) - 0.5) * 0.3, ground + 0.62, z + (rand(gi, gj, 8) - 0.5) * 0.3, along + (rand(gi, gj, 9) - 0.5) * 0.7, 0.4 + rand(gi, gj, 10) * 0.2, 0.26 + rand(gi, gj, 11) * 0.1, 0.3 + rand(gi, gj, 12) * 0.12, 1 - tint);
      if (rand(gi, gj, 13) < 0.8) {
        out.push(x, ground + 0.98, z, along + (rand(gi, gj, 14) - 0.5) * 0.3, 0.12 + rand(gi, gj, 15) * 0.06, 0.22 + rand(gi, gj, 16) * 0.08, 0.3 + rand(gi, gj, 17) * 0.1, rand(gi, gj, 18));
      }
    }
  }
  return { data: new Float32Array(out), count: out.length / 8 };
}

/**
 * Dry-stone walls along the walled field boundaries near the camera. Tiles are built a few per frame and cached;
 * beyond reach the terrain paints the walls as thin lines.
 */
export class Walls {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly place: THREE.InstancedBufferAttribute;
  private readonly size: THREE.InstancedBufferAttribute;
  private readonly cache = new Map<number, TileStones>();
  private readonly sample: FieldSample = { edge: 99, kind: 0, wall: false, presence: 0 };
  private readonly frustum = new THREE.Frustum();
  private readonly matrix = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();

  constructor() {
    const template = stoneGeometry();
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.setAttribute('position', template.attributes.position);
    this.geo.setAttribute('normal', template.attributes.normal);
    this.place = new THREE.InstancedBufferAttribute(new Float32Array(MAX_STONES * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.size = new THREE.InstancedBufferAttribute(new Float32Array(MAX_STONES * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aPlace', this.place);
    this.geo.setAttribute('aSize', this.size);
    this.geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...atmo.uniforms } });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }

  get stones(): number {
    return this.geo.instanceCount;
  }

  update(camera: THREE.Camera): void {
    const cx = camera.position.x;
    const cz = camera.position.z;
    if (cz > -620) {
      this.geo.instanceCount = 0;
      return;
    }
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    let built = 0;
    let count = 0;
    const place = this.place.array as Float32Array;
    const size = this.size.array as Float32Array;
    const t0x = Math.floor((cx - REACH) / TILE);
    const t1x = Math.floor((cx + REACH) / TILE);
    const t0z = Math.floor((cz - REACH) / TILE);
    const t1z = Math.floor((cz + REACH) / TILE);
    for (let tz = t0z; tz <= t1z; tz++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const mx = (tx + 0.5) * TILE;
        const mz = (tz + 0.5) * TILE;
        if (Math.hypot(mx - cx, mz - cz) > REACH) continue;
        this.sphere.center.set(mx, heightAt(mx, mz), mz);
        this.sphere.radius = TILE * 0.75 + 6;
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
        const key = tx * 100003 + tz;
        let tile = this.cache.get(key);
        if (!tile) {
          if (built >= TILES_PER_FRAME) continue;
          tile = buildTile(tx, tz, this.sample);
          this.cache.set(key, tile);
          built++;
        }
        for (let s = 0; s < tile.count && count < MAX_STONES; s++, count++) {
          const d = tile.data;
          const o = s * 8;
          place[count * 4] = d[o];
          place[count * 4 + 1] = d[o + 1];
          place[count * 4 + 2] = d[o + 2];
          place[count * 4 + 3] = d[o + 3];
          size[count * 4] = d[o + 4];
          size[count * 4 + 1] = d[o + 5];
          size[count * 4 + 2] = d[o + 6];
          size[count * 4 + 3] = d[o + 7];
        }
      }
    }
    if (this.cache.size > 4000) this.cache.clear();
    for (const a of [this.place, this.size]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, count * 4);
      a.needsUpdate = true;
    }
    this.geo.instanceCount = count;
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { REFLECTION_LAYER } from './water/reflection';
import { mulberry32 } from './noise';

/**
 * Where the ivy grows: on a wall's face, from where she starts at its foot (on a ridge) up to the middle of the sill
 * she climbs over, both on the face's plane; the face's outward normal; how high the roof under the face stands
 * at a distance across it from the foot (to her right positive), so the old growth comes up out of the slates; and
 * how far the mat spreads either side of her way.
 */
export interface IvySpot {
  from: THREE.Vector3;
  to: THREE.Vector3;
  out: THREE.Vector3;
  roof?: (across: number) => number;
  spread?: number;
}

/** A place on the ivy she climbs by: where a mitten closes round the stem, and where a boot's ankle sits with its toe in the fork. */
export interface IvyHold {
  hand: THREE.Vector3;
  foot: THREE.Vector3;
  /** Its height above the foot of the climb. */
  up: number;
}

const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);
const STEM = lin(0.15, 0.115, 0.08);
const LEAVES = [lin(0.13, 0.18, 0.05), lin(0.18, 0.23, 0.06), lin(0.1, 0.145, 0.045), lin(0.23, 0.25, 0.075)];
const WOOD = 0;
const LEAF_KIND = 1;
/** Her way's two old stems, either side of it, and how thick they are (as her wrist) and how far off the stone. */
const SPAN = 0.4;
const THICK = 0.052;
const OFF = 0.075;
/** A hold every so far up each stem, the right one starting lower so that her hands and feet go up by turns. */
const RUNG = 0.7;
const FIRST = [0.7, 0.35];

/** A broad pointed leaf with two rounded shoulders, as a child would draw ivy: flat, in the plane z = 0, stalk at the origin. */
const LEAF = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(-0.55, 0.05, -0.5, 0.42);
  s.quadraticCurveTo(-0.28, 0.62, 0, 1);
  s.quadraticCurveTo(0.28, 0.62, 0.5, 0.42);
  s.quadraticCurveTo(0.55, 0.05, 0, 0);
  return new THREE.ShapeGeometry(s, 3);
})();

const IVY_VERT = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uOut;
in vec3 color;
in float aKind;
in vec3 aPivot;
in float aSeed;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec3 vLocal;
out float vKind;
void main() {
  vec3 p = position;
  if (aKind > 0.5) {
    /** A leaf nods on its stalk in the evening air, a little more in a gust. */
    vec2 w = texture(uWindTex, domainUv(aPivot.xz)).xy;
    float nod = 0.05 * sin(uTime * (1.1 + aSeed) + aSeed * 40.0) + 0.012 * length(w) * sin(uTime * 7.0 + aSeed * 13.0);
    p += uOut * length(p - aPivot) * nod;
  }
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vColor = color;
  vLocal = position;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const IVY_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec3 vLocal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 alb = vColor;
  bool leaf = vKind > 0.5;
  if (!leaf) alb *= 0.72 + 0.4 * vnoise(vec2(vLocal.y * 9.0, (vLocal.x + vLocal.z) * 40.0)) + 0.1 * vnoise(vLocal.xy * 3.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float sun = cloudShadow(vWorld.xz);
  float ndl = dot(n, uSunDir);
  float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = alb * (hemiLight(n) * 0.95 + uSunColor * wrap * wrap * 0.9 * sun);
  if (leaf) {
    float back = pow(max(dot(-V, uSunDir), 0.0), 2.0);
    col += alb * uSunColor * sun * back * 0.7 * (1.0 - max(ndl, 0.0));
    col += uSunColor * pow(max(dot(n, normalize(uSunDir + V)), 0.0), 28.0) * 0.07 * sun;
  } else {
    col += uSunColor * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.0) * 0.12 * sun;
  }
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** A stem through `points` (in the face's frame), narrowing from r0 to r1 along its length, a little lumpy, as an old stem is. */
function stem(points: THREE.Vector3[], r0: number, r1: number, radial: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const segments = Math.max(6, Math.round(curve.getLength() / 0.08));
  return taper(new THREE.TubeGeometry(curve, segments, 1, radial, false), curve, segments, radial, r0, r1);
}

function taper(tube: THREE.TubeGeometry, curve: THREE.Curve<THREE.Vector3>, segments: number, radial: number, r0: number, r1: number): THREE.BufferGeometry {
  const pos = tube.attributes.position as THREE.BufferAttribute;
  const at = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, at);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(u, 0.7)) * (1 + 0.12 * Math.sin(u * 37 + r0 * 90));
    for (let k = 0; k <= radial; k++) {
      const v = i * (radial + 1) + k;
      p.fromBufferAttribute(pos, v).sub(at).multiplyScalar(r).add(at);
      pos.setXYZ(v, p.x, p.y, p.z);
    }
  }
  tube.computeVertexNormals();
  return tube;
}

/**
 * The ivy she climbs: an old growth over a wall's face from a ridge up to a sill, woody stems as thick as her wrist
 * under a dense mat of the child's-drawing leaves. Her way up is two of the stems either side of a line from the foot
 * to the sill, forking every so often into crotches a boot fits in: those are her holds, the right stem's between the
 * left's, kept clear of leaves so a mitten can be seen to close on them. Laid in world space; the holds are in world
 * space too, low to high, her left stem first.
 */
export class IvyFace {
  readonly mesh: THREE.Mesh;
  readonly holds: [IvyHold[], IvyHold[]] = [[], []];
  readonly spot: IvySpot;
  readonly right = new THREE.Vector3();
  readonly up = new THREE.Vector3(0, 1, 0);
  readonly out = new THREE.Vector3();
  /** How high the climb is, foot to sill, and how far across the face the sill is from the foot. */
  readonly height: number;
  readonly drift: number;
  private readonly frame = new THREE.Matrix4();

  constructor(spot: IvySpot) {
    this.spot = spot;
    this.out.copy(spot.out).setY(0).normalize();
    this.right.crossVectors(this.out, this.up).negate();
    this.frame.makeBasis(this.right, this.up, this.out).setPosition(spot.from);
    const rel = spot.to.clone().sub(spot.from);
    this.height = rel.y;
    this.drift = rel.dot(this.right);
    const rand = mulberry32(2207);
    const parts: THREE.BufferGeometry[] = [];
    const stems: THREE.Vector3[][] = [];
    const add = (g: THREE.BufferGeometry, colour: THREE.Color, kind: number, pivot: THREE.Vector3 | null, seed: number) => {
      const geo = g.index ? g.toNonIndexed() : g;
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3), piv = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col.set([colour.r, colour.g, colour.b], i * 3);
        if (pivot) piv.set([pivot.x, pivot.y, pivot.z], i * 3);
        else piv.set([geo.attributes.position.getX(i), geo.attributes.position.getY(i), geo.attributes.position.getZ(i)], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1));
      geo.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n).fill(seed), 1));
      parts.push(geo);
    };

    const H = this.height;
    const line = (y: number) => this.drift * THREE.MathUtils.smootherstep(y, 0.3, H - 0.4) + 0.05 * Math.sin(y * 1.7 + 0.4);
    const stemX = (side: number, y: number) => line(y) + (side ? 1 : -1) * (SPAN + 0.025 * Math.sin(y * 2.3 + side * 2));
    const crotches: THREE.Vector3[] = [];
    for (const side of [0, 1]) {
      const way: THREE.Vector3[] = [];
      for (let y = -0.35; y < H - 0.12; y += 0.3) way.push(new THREE.Vector3(stemX(side, y), y, OFF + 0.012 * Math.sin(y * 3 + side)));
      way.push(new THREE.Vector3(stemX(side, H - 0.12), H - 0.12, OFF * 0.6));
      stems.push(way);
      add(stem(way, THICK * 1.15, THICK * 0.78, 8), STEM, WOOD, null, 0);
      const out = side ? 1 : -1;
      for (let y = FIRST[side]; y < H - 0.15; y += RUNG) {
        const yy = y + (rand() - 0.5) * 0.04;
        const at = new THREE.Vector3(stemX(side, yy), yy, OFF);
        const branch = [at.clone(), at.clone().add(new THREE.Vector3(out * 0.12, 0.13, 0.025)),
          at.clone().add(new THREE.Vector3(out * 0.3, 0.36, 0.01)), at.clone().add(new THREE.Vector3(out * 0.42, 0.62, -0.02))];
        stems.push(branch);
        add(stem(branch, THICK * 0.82, THICK * 0.3, 6), STEM, WOOD, null, 0);
        add(new THREE.SphereGeometry(THICK * 1.35, 8, 6).scale(1, 1.25, 0.95).translate(at.x, at.y - 0.01, at.z), STEM, WOOD, null, 0);
        crotches.push(at);
        this.holds[side].push({
          hand: this.toWorld(new THREE.Vector3(at.x, at.y + 0.1, OFF + THICK + 0.02)),
          foot: this.toWorld(new THREE.Vector3(at.x + out * 0.03, at.y + 0.11, OFF + 0.13)),
          up: yy,
        });
      }
    }

    const spread = spot.spread ?? 1.5;
    const roof = spot.roof ?? (() => 0);
    for (let i = 0; i < 7; i++) {
      const across = (i / 6 - 0.5) * 2 * spread * 1.05 + (rand() - 0.5) * 0.3;
      if (Math.abs(across - line(0)) < 0.45) continue;
      const base = roof(across) - spot.from.y - 0.2;
      const top = THREE.MathUtils.lerp(H * 0.55, H + 0.3, rand());
      const way: THREE.Vector3[] = [];
      let x = across;
      for (let y = base; y < top; y += 0.35) {
        x += (rand() - 0.5) * 0.18 + (line(y) - x) * 0.02;
        way.push(new THREE.Vector3(x, y, OFF * 0.8));
      }
      if (way.length < 3) continue;
      stems.push(way);
      const r = THICK * (0.55 + 0.35 * rand());
      add(stem(way, r, r * 0.4, 6), STEM, WOOD, null, 0);
      for (let k = 2; k < way.length - 1; k += 3) {
        const from = way[k], s = rand() < 0.5 ? -1 : 1;
        const twig = [from.clone(), from.clone().add(new THREE.Vector3(s * 0.2, 0.22, 0.01)), from.clone().add(new THREE.Vector3(s * 0.35, 0.5, 0))];
        stems.push(twig);
        add(stem(twig, r * 0.6, r * 0.25, 5), STEM, WOOD, null, 0);
      }
    }

    const samples = stems.flatMap((s) => {
      const c = new THREE.CatmullRomCurve3(s);
      return c.getSpacedPoints(Math.max(4, Math.round(c.getLength() / 0.12)));
    });
    const near = (x: number, y: number) => {
      let best = Infinity;
      for (const p of samples) best = Math.min(best, (p.x - x) ** 2 + (p.y - y) ** 2);
      return Math.sqrt(best);
    };
    const grips = [...this.holds[0], ...this.holds[1]].map((h) => this.toFace(h.hand.clone()));
    const clear = (x: number, y: number) => grips.every((g) => Math.hypot(g.x - x, g.y - y) > 0.13)
      && crotches.every((c) => Math.hypot(c.x - x, c.y - y + 0.05) > 0.14);
    const light = { x: this.drift, half: 0.42 };
    let placed = 0;
    for (let tries = 0; tries < 9000 && placed < 820; tries++) {
      const x = line(0) + (rand() * 2 - 1) * (spread + 0.2);
      const base = roof(x) - spot.from.y;
      const y = base - 0.1 + rand() * (H + 0.55 - base);
      const reach = spread * (0.75 + 0.35 * Math.sin(y * 0.9 + 1.2)) * (0.85 + 0.3 * THREE.MathUtils.smoothstep(y, 0, H * 0.4));
      if (Math.abs(x - line(y)) > reach) continue;
      if (y > H - 0.08 && Math.abs(x - light.x) < light.half) continue;
      const d = near(x, y);
      const keep = (1 - THREE.MathUtils.smoothstep(d, 0.12, 0.55)) * (0.55 + 0.45 * Math.sin(x * 3.1 + y * 2.3) ** 2);
      if (rand() > keep || !clear(x, y)) continue;
      const size = 0.25 + rand() * 0.17;
      const g = LEAF.clone();
      g.translate(0, -0.08, 0);
      const away = Math.atan2(x - line(y), 0.6) * 0.8;
      g.rotateZ((rand() - 0.5) * 2.2 - away + (rand() < 0.3 ? Math.PI : 0) * 0.6);
      g.rotateX(-0.15 - rand() * 0.3);
      g.rotateY((rand() - 0.5) * 0.6);
      g.scale(size, size, size);
      const z = (d < 0.09 ? 0.02 : OFF + 0.01) + rand() * 0.1;
      g.translate(x, y, z);
      g.applyMatrix4(this.frame);
      const pivot = this.toWorld(new THREE.Vector3(x, y, z));
      add(g, LEAVES[Math.floor(rand() * LEAVES.length)].clone().multiplyScalar(0.85 + rand() * 0.3), LEAF_KIND, pivot, rand());
      placed++;
    }

    const woody = parts.filter((p) => p.attributes.aKind.getX(0) === WOOD);
    for (const p of woody) p.applyMatrix4(this.frame);
    for (const p of woody) {
      const piv = p.attributes.aPivot as THREE.BufferAttribute;
      const pos = p.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) piv.setXYZ(i, pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    this.mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.ShaderMaterial({
      vertexShader: IVY_VERT, fragmentShader: IVY_FRAG, uniforms: { ...atmo.uniforms, uOut: { value: this.out.clone() } }, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.layers.enable(REFLECTION_LAYER);
  }

  get objects(): THREE.Object3D[] {
    return [this.mesh];
  }

  /** A point in the face's own frame (across to her right, up from the foot, out from the stone) into the world. */
  toWorld(p: THREE.Vector3): THREE.Vector3 {
    return p.applyMatrix4(this.frame);
  }

  toFace(p: THREE.Vector3): THREE.Vector3 {
    return p.applyMatrix4(this.frame.clone().invert());
  }

  /** The cat's way up beside hers, over the leaves on her right, ending at the sill. */
  catWay(): THREE.Vector3[] {
    const way: THREE.Vector3[] = [];
    for (let y = 0.6; y < this.height - 0.2; y += 0.9) way.push(this.toWorld(new THREE.Vector3(this.drift * THREE.MathUtils.smootherstep(y, 0.3, this.height - 0.4) + 0.62, y, 0.2)));
    way.push(this.toWorld(new THREE.Vector3(this.drift + 0.22, this.height - 0.22, 0.2)));
    return way;
  }
}

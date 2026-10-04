import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';

/** The bend where the path turns right, and the way the child comes up to it. */
const BEND = new THREE.Vector2(-44, -1762);
const INTO = new THREE.Vector2(-24, -40).normalize();
/** Just past the bend, straight ahead of her as she comes up the leg: the thing she has to walk past to turn. */
export const WOOD_SHAPE = new THREE.Vector3(BEND.x + INTO.x * 3.6, 0, BEND.y + INTO.y * 3.6);
/** The shape's own frame: `x` her right as she faces it, `z` back toward her. */
export const SHAPE_RIGHT = new THREE.Vector3(-INTO.y, 0, INTO.x);
export const SHAPE_FACING = new THREE.Vector3(-INTO.x, 0, -INTO.y);

/** A point given in the shape's frame (right, up from its foot, toward her), in the world. */
export function shapePoint(x: number, y: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const base = heightAt(WOOD_SHAPE.x, WOOD_SHAPE.z);
  return out.set(WOOD_SHAPE.x, base + y, WOOD_SHAPE.z).addScaledVector(SHAPE_RIGHT, x).addScaledVector(SHAPE_FACING, z);
}

/** The two waiting coals: one on the path right in front of her, one off to the side of the stump. */
export const SHAPE_FRONT_COAL = new THREE.Vector2();
export const SHAPE_SIDE_COAL = new THREE.Vector2();
{
  const front = shapePoint(-0.55, 0, 2.05);
  const side = shapePoint(3.1, 0, 0.75);
  SHAPE_FRONT_COAL.set(front.x, front.z);
  SHAPE_SIDE_COAL.set(side.x, side.z);
}

/** Where the owl sits, down in the fork between the two dead limbs, facing her. */
export const OWL_PERCH_LOCAL = new THREE.Vector3(0, 1.6, 0.02);

const STUMP_CAPS = 23;
export const SHAPE_STUMP_CAPS = STUMP_CAPS;
/** Two more for the owl's body and head, moved every frame, so its shadow leaves with it. */
const CAPS = STUMP_CAPS + 2;

type CapSpec = [number[], number[], number, number];

/**
 * An old dead stump: a hunched trunk broken off at head height with shards of bark standing up in front, a snapped
 * limb jutting forward under the fork like a muzzle, two shoulders broken short, and two dead limbs rising out of
 * the top in tines, like antlers. Given in the shape's frame; one list makes the mesh and the shadow it casts.
 */
const LOCAL: CapSpec[] = [
  [[0, -0.4, 0], [0.03, 0.75, 0.05], 0.52, 0.42],
  [[0.03, 0.75, 0.05], [0, 1.48, 0.06], 0.42, 0.33],
  // The bark shards round the broken top: the front ones stand higher, so the fork is a hollow facing up.
  [[-0.1, 1.38, 0.2], [-0.16, 1.84, 0.27], 0.12, 0.035],
  [[0.17, 1.36, 0.16], [0.22, 1.76, 0.24], 0.1, 0.03],
  // The snapped limb under it.
  [[0.02, 1.22, 0.24], [0.04, 1.08, 0.78], 0.15, 0.085],
  // Shoulders, broken short, and one long limb reaching down to the litter.
  [[-0.28, 1.12, 0.02], [-0.86, 0.92, 0.22], 0.17, 0.09],
  [[0.28, 1.1, 0.0], [0.82, 0.84, 0.28], 0.16, 0.085],
  [[0.82, 0.84, 0.28], [1.28, 0.36, 0.7], 0.085, 0.035],
  // The left limb: a beam rising out and up, a brow tine forward, a tine out, and a fork at the top.
  [[-0.24, 1.48, 0.0], [-0.72, 2.42, 0.1], 0.13, 0.085],
  [[-0.72, 2.42, 0.1], [-0.94, 3.22, -0.04], 0.085, 0.05],
  [[-0.42, 1.96, 0.06], [-0.6, 2.32, 0.52], 0.06, 0.02],
  [[-0.74, 2.5, 0.1], [-1.3, 2.86, 0.24], 0.055, 0.018],
  [[-0.94, 3.22, -0.04], [-0.78, 3.62, 0.04], 0.048, 0.016],
  [[-0.94, 3.22, -0.04], [-1.26, 3.5, -0.08], 0.045, 0.014],
  // The right limb, a little different: its outer tine is snapped off short.
  [[0.24, 1.48, 0.0], [0.7, 2.36, 0.12], 0.13, 0.085],
  [[0.7, 2.36, 0.12], [0.98, 3.12, -0.02], 0.085, 0.05],
  [[0.4, 1.92, 0.06], [0.62, 2.28, 0.5], 0.06, 0.02],
  [[0.74, 2.46, 0.12], [1.08, 2.66, 0.2], 0.055, 0.04],
  [[0.98, 3.12, -0.02], [0.86, 3.56, 0.06], 0.048, 0.016],
  [[0.98, 3.12, -0.02], [1.32, 3.36, -0.06], 0.045, 0.014],
  // Roots splayed into the litter.
  [[0.32, 0.12, 0.3], [0.86, -0.12, 0.76], 0.17, 0.06],
  [[-0.34, 0.1, 0.26], [-0.9, -0.12, 0.62], 0.16, 0.05],
  [[0.0, 0.1, -0.4], [-0.2, -0.15, -1.0], 0.16, 0.05],
];

/**
 * Shadow from the one moving light, worked out per pixel against the stump's capsules and the owl: no shadow map,
 * no extra pass. Only pixels near the stump run the loop. `shapeEyes` is the dream's part of it: while the owl's
 * eyes are blazing, the light that slips past them throws two eyes up into the shadow's head.
 */
export const SHAPE_SHADOW_GLSL = /* glsl */ `
uniform vec4 uShapeA[${CAPS}];
uniform vec4 uShapeB[${CAPS}];
uniform vec4 uShapeAt;
uniform vec4 uShapeEyeL;
uniform vec4 uShapeEyeR;
float shapeShadowCaps(vec3 p, int count) {
  if (uEmberLight.w <= 0.0 || distance(p.xz, uShapeAt.xz) > uShapeAt.w) return 1.0;
  vec3 d1 = uEmberLight.xyz - p;
  float a = dot(d1, d1);
  float lit = 1.0;
  for (int i = 0; i < ${CAPS}; i++) {
    if (i >= count) break;
    float rad0 = uShapeA[i].w, rad1 = uShapeB[i].w;
    if (rad0 <= 0.0) continue;
    vec3 p2 = uShapeA[i].xyz;
    vec3 d2 = uShapeB[i].xyz - p2;
    vec3 r = p - p2;
    float e = max(dot(d2, d2), 1e-6), f = dot(d2, r), c = dot(d1, r), b = dot(d1, d2);
    float den = a * e - b * b;
    float s = den > 1e-6 ? clamp((b * f - c * e) / den, 0.0, 1.0) : 0.0;
    float t = (b * s + f) / e;
    if (t < 0.0) { t = 0.0; s = clamp(-c / a, 0.0, 1.0); }
    else if (t > 1.0) { t = 1.0; s = clamp((b - c) / a, 0.0, 1.0); }
    float dist = distance(p + d1 * s, p2 + d2 * t);
    float rad = mix(rad0, rad1, t);
    float pen = 0.012 + 0.05 * s;
    lit = min(lit, smoothstep(rad - pen, rad + pen, dist));
  }
  return lit;
}
float shapeShadow(vec3 p) { return shapeShadowCaps(p, ${CAPS}); }
float shapeEye(vec3 p, vec4 eye) {
  vec3 d = p - uEmberLight.xyz;
  float s = dot(eye.xyz - uEmberLight.xyz, d) / max(dot(d, d), 1e-6);
  if (s <= 0.05 || s >= 0.9) return 0.0;
  float dist = distance(uEmberLight.xyz + d * s, eye.xyz);
  return 1.0 - smoothstep(eye.w * 0.5, eye.w * 1.6, dist);
}
float shapeEyes(vec3 p) {
  if (uShapeEyeL.w <= 0.0 || uEmberLight.w <= 0.0 || distance(p.xz, uShapeAt.xz) > uShapeAt.w) return 0.0;
  return shapeEye(p, uShapeEyeL) + shapeEye(p, uShapeEyeR);
}
/** What the shadowed light gives back: the stump's shadow, and the two eyes the dream puts in it. */
vec3 shapeLit(vec3 p, vec3 lit) {
  return lit * shapeShadow(p) + vec3(1.0, 0.7, 0.24) * shapeEyes(p) * uShapeAt.y;
}`;

/** Shared by everything that receives the stump's shadow: the stump, the crag behind it, the owl and the floor. */
export const shapeUniforms = {
  uShapeA: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  uShapeB: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  /** xz the stump, y how bright the eyes thrown into its shadow are, w how far round it the shadow is worked out. */
  uShapeAt: { value: new THREE.Vector4(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 18) },
  uShapeEyeL: { value: new THREE.Vector4() },
  uShapeEyeR: { value: new THREE.Vector4() },
};

/** Moves the owl's two shadow capsules: its body and its head, or nothing once it has gone. */
export function setOwlShadow(body: THREE.Vector3 | null, head: THREE.Vector3 | null, bodyR: number, headR: number): void {
  const a = shapeUniforms.uShapeA.value, b = shapeUniforms.uShapeB.value;
  if (body) { a[STUMP_CAPS].set(body.x, body.y, body.z, bodyR); b[STUMP_CAPS].set(body.x, body.y, body.z, bodyR); }
  else { a[STUMP_CAPS].w = 0; b[STUMP_CAPS].w = 0; }
  if (head) { a[STUMP_CAPS + 1].set(head.x, head.y, head.z, headR); b[STUMP_CAPS + 1].set(head.x, head.y, head.z, headR); }
  else { a[STUMP_CAPS + 1].w = 0; b[STUMP_CAPS + 1].w = 0; }
}

/** Where the owl's two eyes are, how large, and how brightly the light slipping past them shows in the shadow. */
export function setShadowEyes(left: THREE.Vector3, right: THREE.Vector3, radius: number, glow: number): void {
  shapeUniforms.uShapeEyeL.value.set(left.x, left.y, left.z, glow > 0.001 ? radius : 0);
  shapeUniforms.uShapeEyeR.value.set(right.x, right.y, right.z, radius);
  shapeUniforms.uShapeAt.value.y = glow;
}

function tube(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, seed: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(rb, ra, len, ra > 0.25 ? 18 : 10, Math.max(2, Math.round(len * 5)), false);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const gnarl = 1 + 0.07 * Math.sin(ang * 3 + y * 2.3 + seed) + 0.05 * Math.sin(ang * 7 - y * 5 + seed * 2);
    pos.setXYZ(i, x * gnarl, y, z * gnarl);
  }
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

function knuckle(at: THREE.Vector3, r: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, 2);
  geo.translate(at.x, at.y, at.z);
  return geo;
}

/** Tags a part with what it is (0 wood, 1 stone) and the direction its grain runs. */
function strip(geo: THREE.BufferGeometry, kind: number, axis: THREE.Vector3): THREE.BufferGeometry {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const g = mergeVertices(geo);
  g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(new Float32Array(n).fill(kind), 1));
  const ax = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) ax.set([axis.x, axis.y, axis.z], i * 3);
  g.setAttribute('aAxis', new THREE.Float32BufferAttribute(ax, 3));
  return g;
}

const SHAPE_VERT = /* glsl */ `${ATMO_GLSL}
in float aKind;
in vec3 aAxis;
out vec3 vWorld; out vec3 vNormal; out float vKind; out vec3 vAxis;
void main() {
  vWorld = position; vNormal = normal; vKind = aKind; vAxis = aAxis;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;

/**
 * Old dead wood and the crag behind it. Light from straight on flattens both into shapes; light from the side
 * rakes the furrows of the bark and the beds of the stone, which is how the stump comes to be plainly a stump.
 */
const SHAPE_FRAG = /* glsl */ `
${ATMO_GLSL}
${SHAPE_SHADOW_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in float vKind;
in vec3 vAxis;
vec3 bump(vec3 n, float h, float k) {
  vec3 dpdx = dFdx(vWorld), dpdy = dFdy(vWorld);
  float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * n - grad * k);
}
void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb;
  float h;
  if (vKind < 0.5) {
    // Bark furrows run with the grain of each limb.
    vec3 axis = normalize(vAxis);
    float along = dot(vWorld, axis);
    vec3 side = normalize(cross(axis, abs(axis.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
    vec3 perp = vWorld - axis * along;
    float around = dot(perp, side) * 9.0 + dot(perp, cross(axis, side)) * 6.0;
    float furrow = vnoise(vec2(around, along * 1.3));
    float fine = vnoise(vec2(around * 3.1, along * 5.0));
    h = smoothstep(0.25, 0.75, furrow) * 0.7 + fine * 0.3;
    float weather = vnoise(vWorld.xz * 1.3 + vWorld.y * 0.8);
    // Dead wood goes silver where the weather gets at it and stays dark brown in the cracks.
    alb = mix(vec3(0.05, 0.038, 0.028), mix(vec3(0.2, 0.17, 0.13), vec3(0.3, 0.29, 0.26), weather), smoothstep(0.15, 0.7, h));
    float moss = smoothstep(0.5, 0.8, vnoise(vWorld.xz * 2.1 + vWorld.y * 1.7)) * smoothstep(0.0, 0.7, n.y);
    alb = mix(alb, vec3(0.1, 0.15, 0.05), moss * 0.85);
    n = bump(n, h, 0.05);
  } else {
    // Bedded stone: soft ledges across it, darker seams, pale lichen, moss along the tops.
    float bed = vWorld.y * 1.4 + vnoise(vWorld.xz * 0.35) * 2.2;
    float ledge = smoothstep(0.0, 0.35, fract(bed)) * (1.0 - smoothstep(0.85, 1.0, fract(bed)));
    float grain = vnoise(vec2(dot(vWorld.xz, vec2(0.7, 0.7)) * 3.0, vWorld.y * 3.0));
    h = ledge * 0.6 + grain * 0.4;
    float weather = vnoise(vWorld.xz * 0.45 + vWorld.y * 0.3);
    alb = mix(vec3(0.15, 0.155, 0.16), vec3(0.27, 0.27, 0.26), weather) * (0.85 + 0.25 * grain);
    alb *= mix(0.55, 1.0, ledge);
    float lichen = smoothstep(0.62, 0.8, vnoise(vWorld.xz * 2.6 + vWorld.y * 2.2));
    alb = mix(alb, vec3(0.36, 0.38, 0.32), lichen * 0.5);
    float moss = smoothstep(0.4, 0.75, vnoise(vWorld.xz * 0.9 + vWorld.y * 0.6)) * smoothstep(0.3, 0.85, n.y);
    alb = mix(alb, vec3(0.07, 0.1, 0.045), moss);
    n = bump(n, h, 0.08);
  }
  vec3 col = alb * hemiLight(n) * 0.75;
  // The sliver of moon: the crag catches it, so the stump is first seen as a shape against it.
  float moon = max(0.0, dot(n, uSunDir)) * 0.6 + 0.4 * max(0.0, dot(n, V));
  col += alb * uSunColor * moon * (vKind > 0.5 ? 1.5 : 0.45) * uNight;
  vec3 warm = (alb + vec3(0.04, 0.025, 0.012)) * emberLight(vWorld, n);
  col += shapeLit(vWorld + n * 0.04, warm);
  gl_FragColor = vec4(max(applyFog(col, vWorld), 0.0), 1.0);
}`;

/** The stump that looms at the bend and the crag it stands in front of. */
export class WoodShape {
  readonly mesh: THREE.Mesh;
  /** A place on the bark she can lay a mitten on, on the near side of the trunk. */
  readonly touch = new THREE.Vector3();
  /** Where no tree may stand: round the stump, and the crag's footprint behind it. */
  static clears(x: number, z: number): boolean {
    const dx = x - WOOD_SHAPE.x, dz = z - WOOD_SHAPE.z;
    const lx = dx * SHAPE_RIGHT.x + dz * SHAPE_RIGHT.z, lz = dx * SHAPE_FACING.x + dz * SHAPE_FACING.z;
    return Math.hypot(lx, lz) < 5.5 || (Math.abs(lx) < 8.5 && lz < 1 && lz > -9);
  }

  constructor() {
    const base = heightAt(WOOD_SHAPE.x, WOOD_SHAPE.z);
    WOOD_SHAPE.y = base;
    const caps = LOCAL.map(([a, b, ra, rb]) => ({ a: shapePoint(a[0], a[1], a[2]), b: shapePoint(b[0], b[1], b[2]), ra, rb }));
    caps.forEach((c, i) => {
      shapeUniforms.uShapeA.value[i].set(c.a.x, c.a.y, c.a.z, c.ra);
      shapeUniforms.uShapeB.value[i].set(c.b.x, c.b.y, c.b.z, c.rb);
    });
    shapeUniforms.uShapeAt.value.set(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 18);
    shapePoint(0.3, 0.95, 0.38, this.touch);

    const parts: THREE.BufferGeometry[] = [];
    caps.forEach((c, i) => {
      const axis = c.b.clone().sub(c.a).normalize();
      parts.push(strip(tube(c.a, c.b, c.ra, c.rb, i * 1.7), 0, axis));
      if (i !== 2 && i !== 3) parts.push(strip(knuckle(c.b, c.rb * 1.04), 0, axis));
    });
    // The ragged broken top inside the shards, which is what the owl sits on.
    parts.push(strip(knuckle(shapePoint(0, 1.42, 0.04), 0.31), 0, new THREE.Vector3(0, 1, 0)));
    this.crag(parts);
    const geo = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...atmo.uniforms, ...shapeUniforms },
      vertexShader: SHAPE_VERT,
      fragmentShader: SHAPE_FRAG,
    }));
    this.mesh.name = 'wood-shape';
    this.mesh.frustumCulled = false;
  }

  /**
   * A crag of bedded stone at the outside of the bend, its face standing square to the way she comes, tall and
   * plain enough to take a shadow: the wall the fear is thrown on. Lower blocks either side and fallen stones at its
   * foot bed it into the wood.
   */
  private crag(parts: THREE.BufferGeometry[]): void {
    const up = new THREE.Vector3(0, 1, 0);
    parts.push(strip(this.block([0.3, 3.4, -3.5], [9.4, 8.6, 2.6], -0.12, 0.07, 1, 0.6), 1, up));
    parts.push(strip(this.block([-5.2, 1.7, -3.0], [3.6, 4.2, 3.0], 0.25, 0.05, 2, 0.5), 1, up));
    parts.push(strip(this.block([5.6, 2.3, -3.6], [3.2, 5.6, 2.8], -0.35, 0.04, 3, 0.5), 1, up));
    parts.push(strip(this.block([0.8, 7.9, -4.4], [6.5, 2.0, 2.6], 0.1, -0.05, 4, 0.7), 1, up));
    parts.push(strip(this.block([-2.7, 0.25, -1.75], [1.5, 1.0, 1.2], 0.6, 0.1, 5, 0.35), 1, up));
    parts.push(strip(this.block([3.0, 0.15, -1.9], [1.1, 0.75, 1.0], -0.4, 0.15, 6, 0.3), 1, up));
    parts.push(strip(this.block([-4.4, 0.1, -0.9], [0.9, 0.55, 0.8], 1.1, 0.2, 7, 0.25), 1, up));
  }

  /** A rounded block of stone, `at` and `size` in the shape's frame, turned by `yaw` and leaning back by `lean`. */
  private block(at: number[], size: number[], yaw: number, lean: number, seed: number, round: number): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(1, 1, 1, Math.ceil(size[0] * 3), Math.ceil(size[1] * 3), Math.ceil(size[2] * 2));
    const pos = geo.getAttribute('position');
    const scale = new THREE.Vector3(size[0], size[1], size[2]);
    const v = new THREE.Vector3(), q = new THREE.Vector3(), out = new THREE.Vector3();
    const half = scale.clone().multiplyScalar(0.5);
    const r = Math.min(round, half.x, half.y, half.z);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).multiply(scale);
      q.set(THREE.MathUtils.clamp(v.x, -half.x + r, half.x - r), THREE.MathUtils.clamp(v.y, -half.y + r, half.y - r),
        THREE.MathUtils.clamp(v.z, -half.z + r, half.z - r));
      out.copy(v).sub(q);
      const len = out.length();
      if (len > 1e-5) { out.divideScalar(len); v.copy(q).addScaledVector(out, r); } else out.set(0, 0, 1);
      const wx = v.x + seed * 7.1, wy = v.y + seed * 3.3, wz = v.z;
      const lump = 0.16 * Math.sin(wx * 0.9 + wy * 0.5) * Math.sin(wz * 0.8 + wy * 0.7 + seed)
        + 0.07 * Math.sin(wx * 2.3 - wy * 1.9 + wz * 1.7) + 0.03 * Math.sin(wx * 5.1 + wy * 4.3 - wz * 3.9);
      // Bedding planes step the face in and out a little, so it reads as layered rock rather than a lump.
      const bed = 0.06 * Math.sign(Math.sin(wy * 2.4 + Math.sin(wx * 0.6) * 0.8));
      v.addScaledVector(out, lump + bed * (1 - Math.abs(out.y)));
      v.z -= lean * (v.y + half.y);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.rotateY(yaw + Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z));
    const centre = shapePoint(at[0], at[1], at[2]);
    geo.translate(centre.x, centre.y, centre.z);
    return geo;
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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

const CAPS = 20;

interface Cap { a: THREE.Vector3; b: THREE.Vector3; ra: number; rb: number }

/**
 * An old broken stump: a hunched trunk with a knob at the top, two dead limbs forked like antlers, one long
 * branch reaching out over the bend with twigs for fingers, and roots splayed into the litter like claws.
 * Given in the shape's frame; one list makes both the mesh and the shadow it casts, so the two always agree.
 */
const LOCAL: [number[], number[], number, number][] = [
  [[0, -0.3, 0], [0.04, 0.85, 0.06], 0.46, 0.34],
  [[0.04, 0.85, 0.06], [0.0, 1.42, 0.3], 0.34, 0.26],
  [[0.0, 1.42, 0.3], [0.0, 1.62, 0.46], 0.25, 0.2],
  [[-0.12, 1.56, 0.3], [-0.58, 2.2, 0.16], 0.09, 0.06],
  [[-0.58, 2.2, 0.16], [-0.86, 2.85, 0.02], 0.06, 0.03],
  [[-0.58, 2.2, 0.16], [-1.08, 2.42, 0.28], 0.045, 0.02],
  [[-0.72, 2.52, 0.1], [-0.52, 3.0, 0.02], 0.035, 0.015],
  [[0.12, 1.56, 0.3], [0.6, 2.12, 0.18], 0.09, 0.06],
  [[0.6, 2.12, 0.18], [0.92, 2.78, 0.06], 0.06, 0.03],
  [[0.6, 2.12, 0.18], [1.12, 2.3, 0.3], 0.045, 0.02],
  [[0.78, 2.46, 0.12], [0.6, 2.95, 0.05], 0.035, 0.015],
  [[0.26, 1.0, 0.1], [0.92, 1.28, 0.46], 0.13, 0.08],
  [[0.92, 1.28, 0.46], [1.5, 1.12, 0.86], 0.08, 0.045],
  [[1.5, 1.12, 0.86], [1.86, 1.24, 1.12], 0.035, 0.012],
  [[1.5, 1.12, 0.86], [1.92, 0.98, 1.0], 0.03, 0.01],
  [[1.5, 1.12, 0.86], [1.72, 0.86, 1.16], 0.03, 0.01],
  [[0.3, 0.12, 0.28], [0.8, -0.12, 0.72], 0.16, 0.06],
  [[-0.32, 0.1, 0.24], [-0.86, -0.12, 0.6], 0.15, 0.05],
  [[-0.2, 0.08, -0.34], [-0.6, -0.15, -0.9], 0.14, 0.05],
  [[0.36, 0.1, -0.2], [0.9, -0.15, -0.5], 0.13, 0.05],
];

function toWorld(v: number[], base: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(WOOD_SHAPE.x, base, WOOD_SHAPE.z)
    .addScaledVector(SHAPE_RIGHT, v[0]).addScaledVector(SHAPE_FACING, v[2]).setY(base + v[1]);
}

/** The capsules in the world, and where the knob with its two pale "eyes" is. */
function capsules(): { caps: Cap[]; head: THREE.Vector3 } {
  const base = heightAt(WOOD_SHAPE.x, WOOD_SHAPE.z);
  WOOD_SHAPE.y = base;
  const caps = LOCAL.map(([a, b, ra, rb]) => ({ a: toWorld(a, base), b: toWorld(b, base), ra, rb }));
  return { caps, head: toWorld([0, 1.6, 0.5], base) };
}

/**
 * Shadow from the one moving light, worked out per pixel against the stump's own capsules: no shadow map, no extra
 * pass. Only pixels within reach of the stump run the loop. `uEmberLight` is whatever is lighting the wood.
 */
export const SHAPE_SHADOW_GLSL = /* glsl */ `
uniform vec4 uShapeA[${CAPS}];
uniform vec4 uShapeB[${CAPS}];
uniform vec4 uShapeAt;
float shapeShadow(vec3 p) {
  if (uEmberLight.w <= 0.0 || distance(p.xz, uShapeAt.xz) > uShapeAt.w) return 1.0;
  vec3 d1 = uEmberLight.xyz - p;
  float a = dot(d1, d1);
  float lit = 1.0;
  for (int i = 0; i < ${CAPS}; i++) {
    vec3 p2 = uShapeA[i].xyz;
    vec3 d2 = uShapeB[i].xyz - p2;
    vec3 r = p - p2;
    float e = dot(d2, d2), f = dot(d2, r), c = dot(d1, r), b = dot(d1, d2);
    float den = a * e - b * b;
    float s = den > 1e-6 ? clamp((b * f - c * e) / den, 0.0, 1.0) : 0.0;
    float t = (b * s + f) / e;
    if (t < 0.0) { t = 0.0; s = clamp(-c / a, 0.0, 1.0); }
    else if (t > 1.0) { t = 1.0; s = clamp((b - c) / a, 0.0, 1.0); }
    float dist = distance(p + d1 * s, p2 + d2 * t);
    float rad = mix(uShapeA[i].w, uShapeB[i].w, t);
    float pen = 0.03 + 0.35 * s;
    lit = min(lit, smoothstep(rad - pen, rad + pen, dist));
  }
  return lit;
}`;

/** Shared by everything that receives the stump's shadow: the stump itself, the stone behind it and the wood's floor. */
export const shapeUniforms = {
  uShapeA: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  uShapeB: { value: Array.from({ length: CAPS }, () => new THREE.Vector4()) },
  uShapeAt: { value: new THREE.Vector4(WOOD_SHAPE.x, 0, WOOD_SHAPE.z, 16) },
  /** How brightly the two pale caps on the knob glow, like eyes in the dark. */
  uShapeEyes: { value: 1 },
};

function tube(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(rb, ra, len, 9, 3, false);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const gnarl = 1 + 0.12 * Math.sin(x * 23 + y * 7) * Math.sin(z * 19 - y * 5);
    pos.setXYZ(i, x * gnarl, y, z * gnarl);
  }
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

function knuckle(at: THREE.Vector3, r: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  geo.translate(at.x, at.y, at.z);
  return geo;
}

/** A shelf fungus on the knob: two of them side by side are a pair of eyes from the front, and brackets from the side. */
function bracket(at: THREE.Vector3, r: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  geo.scale(1, 0.42, 1);
  geo.translate(at.x, at.y, at.z);
  return geo;
}

function strip(geo: THREE.BufferGeometry, kind: number): THREE.BufferGeometry {
  geo.computeVertexNormals();
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(kind), 1));
  return g;
}

const SHAPE_FRAG = /* glsl */ `
${ATMO_GLSL}
${SHAPE_SHADOW_GLSL}
uniform float uShapeEyes;
in vec3 vWorld;
in vec3 vNormal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float grain = vnoise(vec2(dot(vWorld.xz, vec2(3.1, 2.3)) * 1.7, vWorld.y * 9.0)) * 0.6 + vnoise(vWorld.xz * 11.0 + vWorld.y * 4.0) * 0.4;
  vec3 alb;
  if (vKind > 1.5) alb = mix(vec3(0.07, 0.072, 0.075), vec3(0.15, 0.155, 0.16), vnoise(vWorld.xz * 0.9 + vWorld.y * 0.7));
  else if (vKind > 0.5) alb = vec3(0.52, 0.48, 0.36);
  else {
    alb = mix(vec3(0.03, 0.022, 0.016), vec3(0.11, 0.08, 0.05), smoothstep(0.25, 0.8, grain));
    float moss = smoothstep(0.55, 0.85, vnoise(vWorld.xz * 2.3 + vWorld.y * 1.4)) * smoothstep(-0.1, 0.7, n.y);
    alb = mix(alb, vec3(0.05, 0.075, 0.03), moss);
  }
  if (vKind > 1.5) {
    float moss = smoothstep(0.45, 0.8, vnoise(vWorld.xz * 0.8 + vWorld.y * 0.5)) * smoothstep(0.1, 0.8, n.y);
    alb = mix(alb * (0.88 + grain * 0.2), vec3(0.07, 0.09, 0.05), moss * 0.6);
  }
  float rim = pow(1.0 - min(abs(dot(n, V)), 1.0), 3.0);
  vec3 col = alb * (hemiLight(n) * 0.8 + uSunColor * max(0.0, dot(n, uSunDir)) * 0.35);
  // The moon on the stone behind is what the stump is seen against before there is any other light.
  if (vKind > 1.5) col += alb * uSunColor * (0.5 + 0.5 * max(0.0, dot(n, normalize(cameraPosition - vWorld)))) * 2.6 * uNight;
  else col += uSunColor * rim * 0.12 * uNight;
  float shade = shapeShadow(vWorld + n * 0.08);
  col += (alb + vec3(0.07, 0.04, 0.02)) * emberLight(vWorld, n) * shade;
  if (vKind > 0.5 && vKind < 1.5) col += vec3(0.55, 0.95, 0.7) * 1.1 * uShapeEyes * (0.6 + 0.4 * max(0.0, dot(n, V)));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** The stump that looms at the bend, the two foxfire caps that are its eyes, and the pale stone behind it. */
export class WoodShape {
  readonly mesh: THREE.Mesh;
  /** Where the pale caps are: what a frightened child stares at. */
  readonly head = new THREE.Vector3();
  /** A place on the bark she can lay a mitten on, on the near side of the trunk. */
  readonly touch = new THREE.Vector3();

  constructor() {
    const { caps, head } = capsules();
    this.head.copy(head);
    caps.forEach((c, i) => {
      shapeUniforms.uShapeA.value[i].set(c.a.x, c.a.y, c.a.z, c.ra);
      shapeUniforms.uShapeB.value[i].set(c.b.x, c.b.y, c.b.z, c.rb);
    });
    shapeUniforms.uShapeAt.value.set(WOOD_SHAPE.x, WOOD_SHAPE.y, WOOD_SHAPE.z, 16);
    toWorld([0.28, 1.0, 0.32], WOOD_SHAPE.y, this.touch);

    const parts: THREE.BufferGeometry[] = [];
    for (const c of caps) parts.push(strip(tube(c.a, c.b, c.ra, c.rb), 0));
    for (const c of caps.slice(0, 12)) parts.push(strip(knuckle(c.b, c.rb * 1.05), 0));
    parts.push(strip(knuckle(caps[2].b, 0.24), 0));
    for (const side of [-1, 1]) {
      const eye = toWorld([side * 0.11, 1.62, 0.63], WOOD_SHAPE.y);
      parts.push(strip(bracket(eye, 0.08), 1));
    }
    parts.push(strip(this.stone([0.5, 0.75, -3.1], [2.7, 1.6, 0.95], 0.1, 1), 2));
    parts.push(strip(this.stone([-1.9, 0.45, -2.6], [1.3, 1.0, 0.8], -0.2, 4), 2));
    parts.push(strip(this.stone([2.9, 0.35, -2.2], [1.1, 0.7, 0.9], 0.3, 7), 2));
    const geo = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { ...atmo.uniforms, ...shapeUniforms },
      vertexShader: /* glsl */ `${ATMO_GLSL}
        in float aKind;
        out vec3 vWorld; out vec3 vNormal; out float vKind;
        void main() { vWorld = position; vNormal = normal; vKind = aKind; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
      fragmentShader: SHAPE_FRAG,
    }));
    this.mesh.name = 'wood-shape';
    this.mesh.frustumCulled = false;
  }

  /** A weathered boulder behind the stump, pale enough to take a shadow: the wall the fear is thrown on. */
  private stone(at: number[], size: number[], yaw: number, seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const wear = 1 + 0.08 * Math.sin(x * 4.7 + y * 3.1 + z * 4.3 + seed) + 0.04 * Math.sin(z * 9.2 - x * 4.1 + seed * 2);
      pos.setXYZ(i, x * wear * size[0], y * wear * size[1], z * wear * size[2]);
    }
    const centre = toWorld(at, WOOD_SHAPE.y);
    geo.rotateY(Math.atan2(SHAPE_FACING.x, SHAPE_FACING.z) + yaw);
    geo.translate(centre.x, centre.y, centre.z);
    return geo;
  }
}

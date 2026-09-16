import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATMO_GLSL, atmo } from './atmosphere';
import { mulberry32 } from './noise';
import { heightAt } from './island';

/** Washing hung out on a line: pegged along its top edge, swinging up and fluttering in the live wind. */
const CLOTH_VERT = /* glsl */ `
${ATMO_GLSL}
in vec3 aAnchor;
in vec3 aAlong;
in vec4 aShape;
in vec3 aColor;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec2 vUv;
out float vSwing;

void main() {
  vUv = uv;
  float hang = 1.0 - uv.y;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 along = normalize(aAlong);
  vec3 side = normalize(cross(up, along));

  vec3 pegged = aAnchor + along * (position.x * aShape.x);
  if (distance(aAnchor, cameraPosition) > uVeil.x + 40.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vWorld = pegged;
    vNormal = up;
    vColor = aColor;
    vSwing = 0.0;
    return;
  }
  vec2 w = texture(uWindTex, domainUv(pegged.xz)).xy;
  float speed = length(w);
  vec3 gust = speed > 0.001 ? vec3(w.x, 0.0, w.y) / speed : side;
  float lean = dot(gust, side) >= 0.0 ? 1.0 : -1.0;

  /** The sheet hinges on the line: still wind hangs it straight down, a full gust lifts it toward horizontal. */
  float swing = clamp(speed / 9.0, 0.0, 1.0);
  swing *= 0.35 + 0.65 * hang;
  float ripple = sin(uTime * (4.0 + aShape.z) + position.x * 6.5 - hang * 5.0 + aShape.w);
  swing = clamp(swing + ripple * 0.035 * (0.3 + swing), 0.0, 1.05);
  float angle = swing * 1.5708;

  vec3 down = -up * cos(angle) + side * lean * sin(angle);
  vWorld = pegged + down * (hang * aShape.y);
  vWorld += side * lean * ripple * 0.05 * aShape.y * hang;

  vNormal = normalize(cross(along, down)) * lean;
  vColor = aColor;
  vSwing = swing;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const CLOTH_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec2 vUv;
in float vSwing;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  if (!gl_FrontFacing) N = -N;
  float ndl = dot(N, uSunDir);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);

  vec3 cloth = vColor;
  float weave = sin(vUv.x * 240.0) * sin(vUv.y * 190.0) * 0.03;
  cloth *= 1.0 + weave;
  float hem = smoothstep(0.0, 0.02, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  cloth *= 0.86 + hem * 0.14;

  /** Cloth is thin: the sun comes through the back of a sheet as much as it bounces off the front. */
  float through = max(-ndl, 0.0) * 0.55 + pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.3;
  vec3 col = cloth * (hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.55 + through * 0.7) * sun);
  col += cloth * cloth * uSunColor * through * 0.4 * sun;
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const WOOD_VERT = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const WOOD_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec3 N = normalize(vNormal);
  vec3 wood = vec3(0.42, 0.33, 0.25) * (0.85 + vnoise(vWorld.xz * 8.0 + vWorld.y * 3.0) * 0.3);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  vec3 col = wood * (hemiLight(N) + uSunColor * max(dot(N, uSunDir), 0.0) * 0.8 * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * Washed-out linen, not bunting. Mostly whites and creams gone grey with use, with a few faded colours among
 * them; anything saturated reads as flags at a festival rather than somebody's laundry.
 */
const CLOTH_COLOURS = [
  new THREE.Color('#f4efe4'),
  new THREE.Color('#ece6d8'),
  new THREE.Color('#e2dccd'),
  new THREE.Color('#f7f3ea'),
  new THREE.Color('#d9d2c4'),
  new THREE.Color('#c08a7e'),
  new THREE.Color('#d8bb84'),
  new THREE.Color('#9fb0bd'),
  new THREE.Color('#a9b79a'),
  new THREE.Color('#e0bdb6'),
];

export interface LineSpec {
  /** The two pole tops the line runs between. */
  a: THREE.Vector3;
  b: THREE.Vector3;
  /** How far the middle of the line dips below a straight run. */
  sag: number;
}

/** A point on the catenary between the two ends, t from 0 to 1. */
function onLine(spec: LineSpec, t: number, out: THREE.Vector3): THREE.Vector3 {
  out.lerpVectors(spec.a, spec.b, t);
  out.y -= Math.sin(t * Math.PI) * spec.sag;
  return out;
}

function poleGeometry(foot: THREE.Vector3, top: number): THREE.BufferGeometry {
  const height = top - foot.y;
  return new THREE.CylinderGeometry(0.05, 0.075, height, 6).translate(foot.x, foot.y + height / 2, foot.z);
}

function ropeGeometry(spec: LineSpec): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= 10; i++) points.push(onLine(spec, i / 10, p).clone());
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, 0.022, 4, false);
}

/**
 * Lines of washing hung out with nobody there: the first piece of home the dream hands over. Poles and rope are
 * ordinary geometry; every sheet is one instance of a quad that reads the wind field in its vertex shader, so a
 * single gust fills a hundred of them at once.
 */
export class WashingLines {
  readonly group = new THREE.Group();
  private readonly clothMat: THREE.ShaderMaterial;

  constructor(specs: readonly LineSpec[], seed = 91) {
    const rand = mulberry32(seed);
    const woodMat = new THREE.ShaderMaterial({
      uniforms: atmo.uniforms,
      vertexShader: WOOD_VERT,
      fragmentShader: WOOD_FRAG,
    });
    this.clothMat = new THREE.ShaderMaterial({
      uniforms: atmo.uniforms,
      vertexShader: CLOTH_VERT,
      fragmentShader: CLOTH_FRAG,
      side: THREE.DoubleSide,
    });

    const posts: THREE.BufferGeometry[] = [];
    const ropes: THREE.BufferGeometry[] = [];
    const anchors: number[] = [];
    const alongs: number[] = [];
    const shapes: number[] = [];
    const colors: number[] = [];

    const point = new THREE.Vector3();
    const next = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const seen = new Set<string>();

    for (const spec of specs) {
      for (const end of [spec.a, spec.b]) {
        const key = `${end.x.toFixed(1)},${end.z.toFixed(1)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        posts.push(poleGeometry(new THREE.Vector3(end.x, Math.max(heightAt(end.x, end.z), 0), end.z), end.y));
      }
      ropes.push(ropeGeometry(spec));

      const span = spec.a.distanceTo(spec.b);
      let t = 0.05 + rand() * 0.06;
      while (t < 0.94) {
        /** Mostly sheets, wide and long; a third of the pieces are small things pegged up between them. */
        const small = rand() < 0.3;
        const width = small ? 0.5 + rand() * 0.6 : 1.8 + rand() * 1.8;
        const drop = small ? 0.55 + rand() * 0.6 : 1.5 + rand() * 1.5;
        const step = (width + 0.5 + rand() * 1.3) / span;
        if (t + step > 0.96) break;
        onLine(spec, t, point);
        onLine(spec, t + step, next);
        dir.subVectors(next, point).normalize();
        onLine(spec, t + step * 0.5, point);
        anchors.push(point.x, point.y, point.z);
        alongs.push(dir.x, dir.y, dir.z);
        shapes.push(width, drop, rand() * 3, rand() * 6.28);
        const c = CLOTH_COLOURS[Math.floor(rand() * CLOTH_COLOURS.length)];
        colors.push(c.r, c.g, c.b);
        t += step;
      }
    }

    const sheet = new THREE.PlaneGeometry(1, 1, 5, 7).translate(0, 0.5, 0);
    const cloth = new THREE.InstancedBufferGeometry();
    cloth.index = sheet.index;
    cloth.attributes.position = sheet.attributes.position;
    cloth.attributes.uv = sheet.attributes.uv;
    cloth.instanceCount = shapes.length / 4;
    cloth.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(new Float32Array(anchors), 3));
    cloth.setAttribute('aAlong', new THREE.InstancedBufferAttribute(new Float32Array(alongs), 3));
    cloth.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(shapes), 4));
    cloth.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(colors), 3));
    cloth.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    this.group.add(new THREE.Mesh(mergeGeometries(posts), woodMat));
    this.group.add(new THREE.Mesh(mergeGeometries(ropes), woodMat));
    this.group.add(new THREE.Mesh(cloth, this.clothMat));
    this.count = cloth.instanceCount;
  }

  readonly count: number;
}

/** Lines strung all over a hillside, each between two poles, hung the way you would hang washing to dry. */
export function lineField(centre: THREE.Vector2, count: number, spread = 24, seed = 17): LineSpec[] {
  const rand = mulberry32(seed);
  const specs: LineSpec[] = [];
  for (let i = 0; i < count * 4 && specs.length < count; i++) {
    const angle = rand() * Math.PI * 2;
    const reach = spread * Math.sqrt(rand());
    const x = centre.x + Math.cos(angle) * reach;
    const z = centre.y + Math.sin(angle) * reach * 0.8;
    if (heightAt(x, z) < 2.5) continue;
    const run = 9 + rand() * 11;
    /** Lines run roughly across the prevailing wind, the way you would hang washing to dry. */
    const bearing = 1.1 + (rand() - 0.5) * 1.1;
    const ax = x - Math.sin(bearing) * run * 0.5;
    const az = z - Math.cos(bearing) * run * 0.5;
    const bx = x + Math.sin(bearing) * run * 0.5;
    const bz = z + Math.cos(bearing) * run * 0.5;
    const top = 2.9 + rand() * 1.5;
    if (heightAt(ax, az) < 1.6 || heightAt(bx, bz) < 1.6) continue;
    specs.push({
      a: new THREE.Vector3(ax, Math.max(heightAt(ax, az), 0) + top, az),
      b: new THREE.Vector3(bx, Math.max(heightAt(bx, bz), 0) + top * (0.85 + rand() * 0.3), bz),
      sag: 0.18 + rand() * 0.3,
    });
  }
  return specs;
}

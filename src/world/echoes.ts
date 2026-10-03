import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fixInPlace } from '../gl/fixed';
import { ATMO_GLSL, atmo } from './atmosphere';
import { heightAt } from './island';
import type { Room } from './journey-rooms';
import { mulberry32 } from './noise';

/**
 * Something from the room before, washed up on the next arrival beach: a pegged pillowcase from the washing, a
 * rubber duck from the bath, a broken-off run of piano keys, the swing's seat with a few gold leaves. Nobody remarks on it
 * and nothing can be done with it. Each lies half in the sand above the tide line, off the walk, on a damp patch.
 */
interface Echo {
  room: Room;
  x: number;
  z: number;
  yaw: number;
  /** How deep its lowest point has settled into the sand, and its tilt about its own length and width. */
  bury: number;
  roll: number;
  pitch: number;
  /** Radius of the damp patch under it. */
  damp: number;
  parts: () => THREE.BufferGeometry[];
}

const COUNT = 4;

/** x, z, radius of each damp patch, for the terrain. */
export const echoUniforms = {
  uEchoes: { value: Array.from({ length: COUNT }, () => new THREE.Vector3(1e6, 1e6, 0)) },
};

export const ECHO_GLSL = /* glsl */ `
uniform vec3 uEchoes[${COUNT}];

/** 0 dry to 1 soaked: the sand an echo lies in stays damp, darkest under it. */
float echoDamp(vec2 xz) {
  float damp = 0.0;
  for (int i = 0; i < ${COUNT}; i++) {
    vec2 d = xz - uEchoes[i].xy;
    float r = uEchoes[i].z;
    if (dot(d, d) > r * r) continue;
    float edge = r * (0.75 + 0.25 * vnoise(xz * 2.3 + float(i) * 7.0));
    damp = max(damp, 1.0 - smoothstep(edge * 0.35, edge, length(d)));
  }
  return damp;
}
`;

const VERT = /* glsl */ `
in vec3 aColour;
in float aAbove;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColour;
out float vAbove;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vColour = aColour;
  vAbove = aAbove;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
uniform vec3 uSandTint;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColour;
in float vAbove;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  /** Wet and gritty where it meets the sand, dry and clean above. */
  float low = 1.0 - smoothstep(0.0, 0.12, vAbove);
  vec3 paint = vColour * (0.93 + vnoise(vWorld.xz * 7.0 + vWorld.y * 9.0) * 0.14);
  paint = mix(paint, uSandTint, low * 0.35) * mix(1.0, 0.8, low);
  vec3 col = paint * (hemiLight(N) + uSunColor * max(0.0, dot(N, uSunDir) * 0.6 + 0.4) * sun);
  col = mix(stillGrey(col), col, lifeAt(vWorld.xz));
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function coloured(geo: THREE.BufferGeometry, colour: string): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  const c = new THREE.Color(colour);
  const n = g.getAttribute('position').count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(data, i * 3);
  g.setAttribute('aColour', new THREE.BufferAttribute(data, 3));
  return g;
}

/** A pillowcase from the lines, one corner rucked up, a peg still on its hem and another lost beside it. */
function pillowcase(): THREE.BufferGeometry[] {
  const rand = mulberry32(31);
  const cloth = new THREE.PlaneGeometry(1.15, 0.8, 14, 10).rotateX(-Math.PI / 2);
  const p = cloth.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const ruck = 0.13 * Math.exp(-((x - 0.25) ** 2 + (z + 0.1) ** 2) / 0.04);
    const folds = 0.025 * Math.sin(x * 11 + z * 4) + 0.015 * Math.sin(z * 17 - x * 3);
    const lifted = Math.max(0, x - 0.35) * Math.max(0, z - 0.1) * 1.6;
    p.setY(i, 0.02 + ruck + folds + lifted - Math.max(0, -x - 0.3) * 0.25);
  }
  cloth.computeVertexNormals();
  const linen = coloured(cloth, '#ece2cc');
  const col = linen.getAttribute('aColour');
  const pos = linen.getAttribute('position');
  const hem = new THREE.Color('#bf5a45');
  for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > 0.31 && pos.getZ(i) < 0.36) col.setXYZ(i, hem.r, hem.g, hem.b);
  const peg = (spread: number) => mergeGeometries([
    coloured(new THREE.BoxGeometry(0.075, 0.055, 0.42).translate(-0.045, 0, 0).rotateY(spread), '#c79e66'),
    coloured(new THREE.BoxGeometry(0.075, 0.055, 0.42).translate(0.045, 0, 0).rotateY(-spread), '#c79e66'),
    coloured(new THREE.TorusGeometry(0.05, 0.012, 5, 10).rotateY(Math.PI / 2).translate(0, 0, 0.02), '#8a8a86'),
  ]);
  const onHem = peg(0.04).rotateZ(0.25).rotateY(0.3).translate(-0.05, 0.08, 0.36);
  const lost = peg(0.0).rotateZ(Math.PI / 2 - 0.2 + rand() * 0.1).rotateY(1.9).translate(0.78, 0.01, 0.42);
  return [linen, onHem, lost];
}

/** The bath's rubber duck, far too big, as things are that come back in a dream: yellow, an orange bill, tail up. */
function rubberDuck(): THREE.BufferGeometry[] {
  const yellow = '#f3c12e';
  const body = new THREE.SphereGeometry(0.42, 24, 16).scale(1.3, 0.78, 1);
  const p = body.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    // A flat bottom, and the back drawn up into a little pointed tail.
    if (y < -0.2) p.setY(i, -0.2 + (y + 0.2) * 0.35);
    const tail = Math.max(0, -x - 0.25) / 0.3;
    p.setY(i, p.getY(i) + tail * tail * 0.22 * Math.max(0, y + 0.1));
  }
  body.computeVertexNormals();
  const head = new THREE.SphereGeometry(0.27, 20, 14).translate(0.3, 0.42, 0);
  const bill = new THREE.SphereGeometry(0.15, 14, 8).scale(1.25, 0.38, 1).translate(0.58, 0.36, 0);
  const eyes = [-1, 1].map((side) => coloured(new THREE.SphereGeometry(0.035, 8, 6).translate(0.48, 0.5, side * 0.15), '#1c1815'));
  return [coloured(body, yellow), coloured(head, yellow), coloured(bill, '#ec7a24'), ...eyes].map((g) => g.scale(0.55, 0.55, 0.55));
}

/** A run of the piano's keys broken off whole, ivories and ebonies on their wooden bed. */
function pianoKeys(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const white = 0.15;
  const whites = 6;
  const width = white * whites;
  parts.push(coloured(new THREE.BoxGeometry(width + 0.04, 0.09, 1.0).translate(0, -0.02, -0.05), '#8a6a45'));
  for (let i = 0; i < whites; i++) {
    parts.push(coloured(new THREE.BoxGeometry(white - 0.012, 0.075, 0.92).translate(-width / 2 + white * (i + 0.5), 0.06, 0), '#ece0be'));
  }
  for (const i of [0, 1, 3, 4]) {
    parts.push(coloured(new THREE.BoxGeometry(white * 0.58, 0.08, 0.56).translate(-width / 2 + white * (i + 1), 0.13, -0.18), '#1c1815'));
  }
  /** Larger than the piano's own, as things are that come back in a dream. */
  return parts.map((g) => g.scale(1.7, 1.4, 1.7));
}

const LEAF = new THREE.Shape().moveTo(-0.17, 0).quadraticCurveTo(0, 0.13, 0.19, 0).quadraticCurveTo(0, -0.13, -0.17, 0);

/** The swing's seat, its two cords cut short and trailing, with a few of the birches' gold leaves blown round it. */
function swingSeat(): THREE.BufferGeometry[] {
  const rand = mulberry32(53);
  const parts = [coloured(new THREE.BoxGeometry(1.25, 0.12, 0.42), '#705030')];
  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      points.push(new THREE.Vector3(side * (0.55 + t * 0.5 + Math.sin(t * 5 + side) * 0.18), 0.05 - t * 0.04, (t * 1.3 + Math.sin(t * 7) * 0.1) * (side > 0 ? 1 : -0.8)));
    }
    parts.push(coloured(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.04, 5, false), '#725b3c'));
  }
  const golds = ['#e3b23c', '#d99a2b', '#efc858', '#c97f25'];
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.6 + rand() * 0.9;
    const leaf = new THREE.ShapeGeometry(LEAF, 3).rotateX(-Math.PI / 2 + (rand() - 0.5) * 0.5).rotateY(rand() * 6.28);
    parts.push(coloured(leaf.translate(Math.cos(a) * r, 0.04 + (i === 2 ? 0.08 : 0), Math.sin(a) * r * 0.7), golds[i % golds.length]));
  }
  return parts;
}

const ECHOES: Echo[] = [
  { room: 'boats', x: 155.5, z: -376, yaw: 0.6, bury: 0.04, roll: 0.05, pitch: 0.06, damp: 1.5, parts: pillowcase },
  { room: 'meadow', x: 24.5, z: -585.2, yaw: -0.5, bury: 0.07, roll: 0.15, pitch: -1.2, damp: 0.9, parts: rubberDuck },
  { room: 'birches', x: -9, z: -1063.5, yaw: 0.35, bury: 0.15, roll: 0.08, pitch: -0.14, damp: 1.9, parts: pianoKeys },
  { room: 'stairs', x: 78.3, z: -1239.5, yaw: 1.1, bury: 0.05, roll: 0.08, pitch: 0.05, damp: 1.8, parts: swingSeat },
];

/** The echoes, one mesh per room that has one. */
export function dreamEchoes(): Partial<Record<Room, THREE.Mesh>> {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...atmo.uniforms, uSandTint: { value: new THREE.Color('#c9b48a') } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
  });
  const out: Partial<Record<Room, THREE.Mesh>> = {};
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  ECHOES.forEach((e, i) => {
    q.setFromEuler(new THREE.Euler(e.pitch, e.yaw, e.roll, 'YXZ'));
    const geo = mergeGeometries(e.parts()).applyQuaternion(q);
    geo.computeBoundingBox();
    geo.translate(e.x, heightAt(e.x, e.z) - geo.boundingBox!.min.y - e.bury, e.z);
    const pos = geo.getAttribute('position');
    const above = new Float32Array(pos.count);
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      above[k] = v.y - heightAt(v.x, v.z);
    }
    geo.setAttribute('aAbove', new THREE.BufferAttribute(above, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `echo-${e.room}`;
    fixInPlace(mesh);
    out[e.room] = mesh;
    echoUniforms.uEchoes.value[i].set(e.x, e.z, e.damp);
  });
  return out;
}

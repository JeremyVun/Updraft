import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from './atmosphere';
import { COTTAGE, COTTAGE_Y } from './heightfield';

const LENGTH = 8.4;
const DEPTH = 4.8;
const WALL = 3.0;
const RIDGE = 5.9;
const PUFFS = 46;

const VERT = /* glsl */ `
in vec3 color;
in float aGlow;
in float aThatch;
out vec3 vColor;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out float vGlow;
out float vThatch;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vColor = color;
  vWorld = w.xyz;
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vGlow = aGlow;
  vThatch = aThatch;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vColor;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in float vGlow;
in float vThatch;
void main() {
  vec3 n = normalize(vNormal);
  vec3 alb = vColor;
  float grain = vnoise(vLocal.xy * 3.0 + vLocal.z * 2.0) * 0.5 + vnoise(vLocal.zy * 9.0) * 0.5;
  alb *= 0.9 + 0.16 * grain;
  if (vThatch > 0.5) {
    float strands = vnoise(vec2(vLocal.x * 18.0, vLocal.y * 2.5)) * 0.6 + vnoise(vec2(vLocal.x * 41.0, vLocal.y * 5.0)) * 0.4;
    alb *= 0.72 + 0.45 * strands;
  }
  float ndl = max(dot(n, uSunDir), 0.0);
  float wrap = max(dot(n, uSunDir) * 0.5 + 0.5, 0.0);
  float sun = groundAt(vWorld.xz).w * cloudShadow(vWorld.xz);
  float ao = mix(0.6, 1.0, smoothstep(${(COTTAGE_Y - 0.4).toFixed(2)}, ${(COTTAGE_Y + 1.6).toFixed(2)}, vWorld.y));
  vec3 col = alb * (hemiLight(n) * ao + uSunColor * mix(ndl, wrap, 0.3) * sun);
  vec3 lamp = vec3(1.0, 0.62, 0.28) * (0.25 + 4.5 * uNight) * (0.9 + 0.1 * sin(uTime * 3.1 + vLocal.x));
  col = mix(col, lamp, vGlow);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const SMOKE_VERT = /* glsl */ `
in vec4 aPuff;
out vec2 vUv;
out float vFade;
out vec3 vWorld;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float size = 0.3 + aPuff.w * 1.9;
  vWorld = aPuff.xyz + (right * position.x + up * position.y) * size;
  vUv = position.xy;
  vFade = sin(clamp(aPuff.w, 0.0, 1.0) * 3.14159);
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}`;

const SMOKE_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in float vFade;
in vec3 vWorld;
void main() {
  float r = length(vUv);
  float a = (1.0 - smoothstep(0.15, 1.0, r)) * vFade * 0.2;
  if (a < 0.003) discard;
  vec3 col = mix(vec3(0.72, 0.72, 0.74), vec3(0.2, 0.22, 0.3), uNight) * (hemiLight(vec3(0.0, 1.0, 0.0)) + uSunColor * 0.4);
  gl_FragColor = vec4(applyFog(col, vWorld), a);
}`;

type Part = [THREE.BufferGeometry, THREE.Color, number, number];

function part(geo: THREE.BufferGeometry, color: THREE.Color, glow = 0, thatch = 0): Part {
  return [geo, color, glow, thatch];
}

function build(parts: Part[]): THREE.BufferGeometry {
  return mergeGeometries(
    parts.map(([g, c, glow, thatch]) => {
      const geo = (g.index ? g.toNonIndexed() : g).clone();
      geo.deleteAttribute('uv');
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
      geo.setAttribute('aThatch', new THREE.BufferAttribute(new Float32Array(n).fill(thatch), 1));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      return geo;
    }),
  );
}

function houseBody(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-DEPTH / 2, 0);
  s.lineTo(DEPTH / 2, 0);
  s.lineTo(DEPTH / 2, WALL);
  s.lineTo(0, RIDGE - 0.4);
  s.lineTo(-DEPTH / 2, WALL);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: LENGTH, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);
  geo.translate(-LENGTH / 2, 0, 0);
  return geo;
}

function thatch(): THREE.BufferGeometry {
  const t = 0.55;
  const over = 0.55;
  const s = new THREE.Shape();
  s.moveTo(-DEPTH / 2 - over, WALL - 0.45);
  s.quadraticCurveTo(-DEPTH / 4, WALL + 0.9, 0, RIDGE);
  s.quadraticCurveTo(DEPTH / 4, WALL + 0.9, DEPTH / 2 + over, WALL - 0.45);
  s.lineTo(DEPTH / 2 + over - 0.2, WALL - 0.45 - t * 0.7);
  s.quadraticCurveTo(DEPTH / 4, WALL + 0.9 - t, 0, RIDGE - t * 1.1);
  s.quadraticCurveTo(-DEPTH / 4, WALL + 0.9 - t, -DEPTH / 2 - over + 0.2, WALL - 0.45 - t * 0.7);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: LENGTH + 0.9, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 3, curveSegments: 10 });
  geo.rotateY(Math.PI / 2);
  geo.translate(-(LENGTH + 0.9) / 2, 0, 0);
  return geo;
}

const SPILL_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Lamplight falling out of the open door across the grass: brightest at the threshold, spreading and fading. */
const SPILL_FRAG = /* glsl */ `
uniform float uNight;
uniform float uOpen;
in vec2 vUv;
void main() {
  float across = abs(vUv.x - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.25, 1.0, across)) * (1.0 - smoothstep(0.0, 1.0, vUv.y)) * smoothstep(0.0, 0.06, vUv.y);
  gl_FragColor = vec4(vec3(1.0, 0.66, 0.3) * a * a * uOpen * uNight * 1.4, 1.0);
}`;

function spillGeometry(front: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const reach = 7;
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.62, 0.3, front, 0.62, 0.3, front, -2.6, 0.3, front + reach, 2.6, 0.3, front + reach], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geo.setIndex([0, 2, 1, 1, 2, 3]);
  return geo;
}

/**
 * The whitewashed cottage below the last hill: thatch, a red door, windows that glow as night falls, and chimney
 * smoke that drifts with whatever wind is blowing. When the door opens at night, lamplight spills out over the grass.
 */
export class Cottage {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3(COTTAGE.x, COTTAGE_Y, COTTAGE.z);
  /** Where someone standing at the door would be, in world space. */
  readonly doorstep = new THREE.Vector3();
  private readonly door = new THREE.Group();
  private readonly smokeMesh: THREE.Mesh;
  private readonly smoke: THREE.InstancedBufferAttribute;
  private readonly puffs: { p: THREE.Vector3; age: number; life: number }[] = [];
  private readonly chimney = new THREE.Vector3();
  /** The chimney is cold until somebody lights the fire as night comes; then the first puffs come up one after another. */
  smoking = false;
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private doorOpen = 0;
  private doorTarget = 0;
  private readonly spill: THREE.ShaderMaterial;
  private spawn = 0;

  constructor(private readonly wind: WindField) {
    const white = new THREE.Color('#ebe4d4');
    const stone = new THREE.Color('#8a8378');
    const straw = new THREE.Color('#a8864e');
    const red = new THREE.Color('#b5362c');
    const frame = new THREE.Color('#5a4a3c');
    const lampGlass = new THREE.Color('#ffcf85');
    const front = DEPTH / 2 + 0.02;
    const body = build([
      part(houseBody(), white),
      part(new THREE.BoxGeometry(LENGTH + 0.3, 0.45, DEPTH + 0.3).translate(0, 0.2, 0), stone),
      part(thatch(), straw, 0, 1),
      part(new THREE.BoxGeometry(0.9, 2.2, 0.9).translate(LENGTH / 2 - 0.55, RIDGE + 0.1, 0), stone),
      part(new THREE.BoxGeometry(1.1, 0.2, 1.1).translate(LENGTH / 2 - 0.55, RIDGE + 1.25, 0), stone),
      ...[-2.5, 2.5].flatMap((x) => [
        part(new THREE.BoxGeometry(1.0, 0.95, 0.1).translate(x, 1.75, front + 0.02), lampGlass, 1),
        part(new THREE.BoxGeometry(1.2, 0.12, 0.2).translate(x, 1.22, front + 0.05), frame),
        part(new THREE.BoxGeometry(0.08, 0.95, 0.14).translate(x, 1.75, front + 0.06), frame),
      ]),
      part(new THREE.BoxGeometry(1.3, 2.3, 0.08).translate(0, 1.15, front), new THREE.Color('#2a1d16'), 0.85),
    ]);
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...atmo.uniforms } });
    this.group.add(new THREE.Mesh(body, mat));

    const doorGeo = build([part(new THREE.BoxGeometry(1.25, 2.25, 0.12).translate(0.62, 1.12, 0), red)]);
    this.door.add(new THREE.Mesh(doorGeo, mat));
    this.door.position.set(-0.62, 0, front + 0.06);
    this.group.add(this.door);
    this.spill = new THREE.ShaderMaterial({
      vertexShader: SPILL_VERT,
      fragmentShader: SPILL_FRAG,
      uniforms: { uNight: atmo.uniforms.uNight, uOpen: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const spill = new THREE.Mesh(spillGeometry(front + 0.1), this.spill);
    spill.renderOrder = 6;
    this.group.add(spill);

    this.group.position.copy(this.position);
    this.group.rotation.y = Math.atan2(20 - COTTAGE.x, -1520 - COTTAGE.z);
    this.group.updateMatrixWorld(true);
    this.doorstep.set(0, 0, front + 2.2).applyMatrix4(this.group.matrixWorld);
    this.chimney.set(LENGTH / 2 - 0.55, RIDGE + 1.4, 0).applyMatrix4(this.group.matrixWorld);

    const quad = new THREE.PlaneGeometry(2, 2);
    const smokeGeo = new THREE.InstancedBufferGeometry();
    smokeGeo.index = quad.index;
    smokeGeo.setAttribute('position', quad.attributes.position);
    this.smoke = new THREE.InstancedBufferAttribute(new Float32Array(PUFFS * 4), 4).setUsage(THREE.DynamicDrawUsage);
    smokeGeo.setAttribute('aPuff', this.smoke);
    smokeGeo.instanceCount = PUFFS;
    const smokeMesh = new THREE.Mesh(
      smokeGeo,
      new THREE.ShaderMaterial({
        vertexShader: SMOKE_VERT,
        fragmentShader: SMOKE_FRAG,
        uniforms: { ...atmo.uniforms },
        transparent: true,
        depthWrite: false,
      }),
    );
    smokeMesh.frustumCulled = false;
    this.smokeMesh = smokeMesh;
    for (let i = 0; i < PUFFS; i++) this.puffs.push({ p: this.chimney.clone(), age: -i / PUFFS, life: 7 + (i % 5) });
  }

  get objects(): THREE.Object3D[] {
    return [this.group, this.smokeMesh];
  }

  openDoor(open: boolean): void {
    this.doorTarget = open ? 1 : 0;
  }

  get doorOpening(): number { return this.doorOpen; }

  update(dt: number, camera: THREE.Camera): void {
    const far = camera.position.distanceTo(this.position) > 1400;
    this.group.visible = !far;
    this.smokeMesh.visible = !far;
    if (far) return;
    this.doorOpen += (this.doorTarget - this.doorOpen) * (1 - Math.exp(-dt * 2.2));
    this.door.rotation.y = -this.doorOpen * 1.7;
    this.spill.uniforms.uOpen.value = Math.min(1, this.doorOpen * 1.6);

    const w = this.wind.sample(this.chimney.x, this.chimney.z, this.sample);
    if (this.smoking) this.spawn += dt;
    const a = this.smoke.array as Float32Array;
    this.puffs.forEach((puff, i) => {
      if (this.smoking) puff.age += dt / puff.life;
      if (puff.age >= 1) {
        puff.age -= 1;
        puff.p.copy(this.chimney);
      }
      if (puff.age > 0) {
        const rise = 0.9 - puff.age * 0.4;
        puff.p.x += (w.x * (0.4 + puff.age * 0.7) + Math.sin(this.spawn * 0.7 + i) * 0.12) * dt;
        puff.p.z += (w.z * (0.4 + puff.age * 0.7) + Math.cos(this.spawn * 0.6 + i * 1.3) * 0.12) * dt;
        puff.p.y += (rise + w.lift * 2) * dt;
      }
      a[i * 4] = puff.p.x;
      a[i * 4 + 1] = puff.p.y;
      a[i * 4 + 2] = puff.p.z;
      a[i * 4 + 3] = Math.max(0, puff.age);
    });
    this.smoke.needsUpdate = true;
  }
}

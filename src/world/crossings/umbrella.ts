import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../atmosphere';
import { REFLECTION_LAYER } from '../water/reflection';

/**
 * The umbrella's measurements in its own frame, the origin at the top of the crook where a hand holds it and +y up
 * the shaft: the canopy's apex, how far its rim hangs below the apex, the rim's radius, and the crook.
 */
export const UMBRELLA = { apex: 1.3, crown: 0.4, radius: 0.98, ribs: 8, crook: 0.1 } as const;

const RINGS = 9;
const SEGMENTS = 64;
const METAL = 1;
const WOOD = 2;

const CANOPY_VERT = /* glsl */ `
in vec2 aUv;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vUv = aUv;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const CANOPY_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
void main() {
  vec3 n = normalize(vNormal);
  bool inside = !gl_FrontFacing;
  if (inside) n = -n;
  float rib = 1.0 - smoothstep(0.0, 0.035, abs(fract(vUv.y * ${UMBRELLA.ribs.toFixed(1)}) - 0.5) * 2.0 - 0.93);
  vec3 alb = vec3(0.028, 0.027, 0.032) * (0.92 + 0.12 * vnoise(vUv * vec2(6.0, 40.0)));
  alb *= inside ? 0.7 - 0.25 * rib : 1.0 - 0.2 * rib;
  float ndl = max(dot(n, uSunDir), 0.0);
  float sun = cloudShadow(vWorld.xz);
  /** Black cloth with the low sun through it: a warm glow where it is thin against the light. */
  float through = max(dot(-n, uSunDir), 0.0) * (1.0 - rib) * 0.14;
  vec3 col = alb * (hemiLight(n) + uSunColor * ndl * sun) + vec3(0.42, 0.2, 0.08) * uSunColor * through * sun;
  vec3 V = normalize(cameraPosition - vWorld);
  float sheen = pow(max(dot(reflect(-uSunDir, n), V), 0.0), 14.0) * (inside ? 0.0 : 1.0);
  col += uSunColor * sheen * sun * 0.09;
  float rim = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 3.0) * pow(max(dot(-V, uSunDir), 0.0), 2.0);
  col += uSunColor * rim * sun * 0.12;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

const PARTS_VERT = /* glsl */ `
in float aKind;
out vec3 vWorld;
out vec3 vNormal;
out float vKind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * normal;
  vKind = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const PARTS_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vWorld;
in vec3 vNormal;
in float vKind;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  int kind = int(vKind + 0.5);
  vec3 alb = kind == ${WOOD} ? vec3(0.2, 0.11, 0.055) : vec3(0.05, 0.048, 0.05);
  float ndl = max(dot(n, uSunDir), 0.0);
  float sun = cloudShadow(vWorld.xz);
  vec3 col = alb * (hemiLight(n) + uSunColor * ndl * sun);
  vec3 V = normalize(cameraPosition - vWorld);
  col += uSunColor * pow(max(dot(reflect(-uSunDir, n), V), 0.0), 20.0) * sun * (kind == ${WOOD} ? 0.12 : 0.2);
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/**
 * A big black umbrella: eight ribs, a domed canopy whose panels draw in a little between them, a slim shaft and a
 * wooden crook. Rising air under it fills the panels and lifts the rib tips, the rim shivering, at once; set down,
 * it lies on its side on its rim and crook. Where it is and which way its shaft points are set by whoever has it.
 */
export class Umbrella {
  readonly group = new THREE.Group();
  readonly objects: THREE.Object3D[];
  /** How much rising air is under it, 0..1, as the canopy shows it. */
  puff = 0;
  /** How hard its rim shivers, 0..1. */
  flutter = 0;
  private readonly canopy: THREE.BufferGeometry;
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly quat = new THREE.Quaternion();
  private readonly spin = new THREE.Quaternion();

  constructor() {
    this.canopy = new THREE.BufferGeometry();
    const count = (RINGS + 1) * (SEGMENTS + 1);
    this.canopy.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.canopy.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const uv = new Float32Array(count * 2);
    const idx: number[] = [];
    for (let i = 0; i <= RINGS; i++) {
      for (let j = 0; j <= SEGMENTS; j++) {
        uv.set([i / RINGS, j / SEGMENTS], (i * (SEGMENTS + 1) + j) * 2);
        if (i < RINGS && j < SEGMENTS) {
          const a = i * (SEGMENTS + 1) + j, b = a + SEGMENTS + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    this.canopy.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    this.canopy.setIndex(idx);
    const shell = new THREE.Mesh(this.canopy, new THREE.ShaderMaterial({
      vertexShader: CANOPY_VERT, fragmentShader: CANOPY_FRAG, uniforms: { ...atmo.uniforms }, side: THREE.DoubleSide,
    }));
    const parts = new THREE.Mesh(this.parts(), new THREE.ShaderMaterial({
      vertexShader: PARTS_VERT, fragmentShader: PARTS_FRAG, uniforms: { ...atmo.uniforms }, side: THREE.DoubleSide,
    }));
    for (const m of [shell, parts]) {
      m.frustumCulled = false;
      m.layers.enable(REFLECTION_LAYER);
      this.group.add(m);
    }
    this.group.layers.enable(REFLECTION_LAYER);
    this.objects = [this.group];
    this.shape(0);
  }

  /** Held with the top of its crook at `grip` and its shaft along `shaft` (need not be normalised). */
  hold(grip: THREE.Vector3, shaft: THREE.Vector3, turn = 0): void {
    this.group.position.copy(grip);
    this.quat.setFromUnitVectors(this.up, this.group.up.copy(shaft).normalize());
    this.group.up.set(0, 1, 0);
    this.group.quaternion.copy(this.quat).multiply(this.spin.setFromAxisAngle(this.up, turn));
    this.group.updateMatrixWorld(true);
  }

  /**
   * Lying on its side on a surface `floor` high: the crook at `grip`, its shaft heading `toward` (a level direction),
   * tipped up until its rim rests on the surface, rocked by `rock` radians about its shaft.
   */
  lie(grip: THREE.Vector3, toward: THREE.Vector3, floor: number, rock = 0): void {
    const U = UMBRELLA;
    const rimAt = U.apex - U.crown;
    let tilt = 0.5;
    for (let i = 0; i < 12; i++) tilt = Math.atan2(U.radius * Math.cos(tilt) - (grip.y - floor), rimAt);
    const d = new THREE.Vector3(toward.x, 0, toward.z).normalize();
    const shaft = d.multiplyScalar(Math.cos(tilt)).setY(Math.sin(tilt));
    this.hold(grip, shaft, rock);
  }

  /** The middle of the canopy, under its apex, where rising air would gather. */
  middle(out: THREE.Vector3): THREE.Vector3 {
    return this.group.localToWorld(out.set(0, UMBRELLA.apex - UMBRELLA.crown * 0.6, 0));
  }

  update(): void {
    this.shape(atmo.uniforms.uTime.value);
  }

  /** The canopy as it is now: a domed octagon, its panels drawn in a little, filling and shivering with the air under it. */
  private shape(t: number): void {
    const U = UMBRELLA;
    const pos = this.canopy.attributes.position as THREE.BufferAttribute;
    const gore = (Math.PI * 2) / U.ribs;
    const puff = this.puff, shiver = this.flutter;
    for (let i = 0; i <= RINGS; i++) {
      const r = i / RINGS;
      for (let j = 0; j <= SEGMENTS; j++) {
        const a = (j / SEGMENTS) * Math.PI * 2;
        const off = ((a % gore) + gore) % gore - gore / 2;
        const across = Math.sin((off / gore + 0.5) * Math.PI);
        const octagon = Math.cos(gore / 2) / Math.cos(off);
        const reach = U.radius * r * octagon * (1 - 0.05 * r * r * across) * (1 + 0.04 * puff * r);
        let y = U.apex - U.crown * Math.pow(r, 1.7);
        y -= 0.05 * across * Math.sin(Math.PI * r) * (1 - puff);
        y += puff * (0.09 * across * Math.sin(Math.PI * r) + 0.08 * r * r);
        y += shiver * 0.035 * Math.pow(r, 4) * Math.sin(a * 16 + t * 11) * (0.5 + across);
        pos.setXYZ(i * (SEGMENTS + 1) + j, Math.cos(a) * reach, y, Math.sin(a) * reach);
      }
    }
    pos.needsUpdate = true;
    this.canopy.computeVertexNormals();
  }

  /** The shaft, its ferrule, the runner and stretchers under the canopy, the rib tips, and the wooden crook. */
  private parts(): THREE.BufferGeometry {
    const U = UMBRELLA;
    const parts: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, kind: number) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (n.attributes.uv) n.deleteAttribute('uv');
      n.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count).fill(kind), 1));
      parts.push(n);
    };
    add(new THREE.CylinderGeometry(0.016, 0.018, U.apex, 6).translate(0, U.apex / 2, 0), METAL);
    add(new THREE.ConeGeometry(0.022, 0.16, 6).translate(0, U.apex + 0.08, 0), METAL);
    const runner = U.apex - 0.62;
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).translate(0, runner, 0), METAL);
    for (let k = 0; k < U.ribs; k++) {
      const a = (k / U.ribs) * Math.PI * 2;
      const mid = new THREE.Vector3(Math.cos(a) * U.radius * 0.55, U.apex - U.crown * Math.pow(0.55, 1.7) - 0.03, Math.sin(a) * U.radius * 0.55);
      const from = new THREE.Vector3(0, runner, 0);
      const len = from.distanceTo(mid);
      const strut = new THREE.CylinderGeometry(0.006, 0.006, len, 4).translate(0, len / 2, 0);
      strut.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), mid.clone().sub(from).normalize()));
      add(strut.translate(from.x, from.y, from.z), METAL);
      add(new THREE.SphereGeometry(0.018, 5, 4).translate(Math.cos(a) * U.radius, U.apex - U.crown - 0.01, Math.sin(a) * U.radius), METAL);
    }
    const crook = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.06, 0), new THREE.Vector3(0, -0.12, 0), new THREE.Vector3(0.03, -0.2, 0), new THREE.Vector3(0.1, -0.22, 0),
      new THREE.Vector3(0.17, -0.18, 0), new THREE.Vector3(0.19, -0.1, 0),
    ]);
    add(new THREE.TubeGeometry(crook, 16, 0.026, 6, false), WOOD);
    return mergeAll(parts);
  }
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], kind: number[] = [];
  for (const g of parts) {
    const p = g.attributes.position, n = g.attributes.normal, k = g.attributes.aKind;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      kind.push(k.getX(i));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  return geo;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WindField, WindSample } from '../wind/field';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { heightAt } from '../world/island';

const LENGTH = 4.8;
const BEAM = 0.95;
const DEPTH = 0.62;

const HULL_VERT = /* glsl */ `
in vec3 color;
out vec3 vColor;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vColor = color;
  vWorld = w.xyz;
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const HULL_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec3 vColor;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
void main() {
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float plank = smoothstep(0.02, 0.0, abs(fract(vLocal.y * 5.5 + 0.5) - 0.5) - 0.44);
  float grain = vnoise(vec2(vLocal.z * 3.0, vLocal.y * 22.0)) * 0.18;
  vec3 alb = vColor * (0.9 + grain) * (1.0 - plank * 0.35) * (gl_FrontFacing ? 1.0 : 0.72);
  float ndl = dot(N, uSunDir);
  float wrap = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
  float sun = cloudShadow(vWorld.xz);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0) * max(dot(-V, uSunDir), 0.0);
  vec3 col = alb * (hemiLight(N) + uSunColor * wrap * wrap * sun * 0.9) + uSunColor * rim * 0.12 * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

/** The patchwork sail: quilt squares in faded colours, stitched, billowing with the wind and glowing when backlit. */
const SAIL_VERT = /* glsl */ `
uniform float uFill;
uniform float uFlutter;
uniform float uTime;
out vec2 vUv;
out vec3 vWorld;
out vec3 vNormal;
void main() {
  float belly = sin(uv.x * 3.14159) * sin(uv.y * 3.14159 * 0.9);
  float ripple = sin(uTime * 9.0 - uv.x * 7.0 + uv.y * 3.0) * uFlutter * (0.3 + uv.x);
  vec3 p = position + vec3(0.0, 0.0, 1.0) * (belly * uFill + ripple * 0.06);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vUv = uv;
  vWorld = w.xyz;
  vec3 n = normalize(vec3(-belly * uFill * 0.4 * cos(uv.x * 3.14159), 0.0, 1.0));
  vNormal = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SAIL_FRAG = /* glsl */ `
${ATMO_GLSL}
in vec2 vUv;
in vec3 vWorld;
in vec3 vNormal;
void main() {
  vec2 cell = floor(vUv * vec2(4.0, 5.0));
  float pick = hash12(cell + 7.0);
  vec3 cloth = pick < 0.3 ? vec3(0.93, 0.88, 0.76) : pick < 0.52 ? vec3(0.82, 0.38, 0.3) : pick < 0.74 ? vec3(0.9, 0.7, 0.3) : pick < 0.9 ? vec3(0.5, 0.66, 0.78) : vec3(0.62, 0.74, 0.5);
  vec2 f = fract(vUv * vec2(4.0, 5.0));
  float seam = 1.0 - smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  float stitch = seam * step(0.5, fract((vUv.x + vUv.y) * 60.0));
  cloth *= 1.0 - seam * 0.18 - stitch * 0.1;
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float through = max(-ndl, 0.0) * 0.45 + pow(max(dot(-V, uSunDir), 0.0), 3.0) * 0.25;
  float sun = cloudShadow(vWorld.xz);
  vec3 col = cloth * (hemiLight(N) + uSunColor * (max(ndl, 0.0) * 0.6 + through * 0.6) * sun);
  col += cloth * cloth * uSunColor * through * 0.35 * sun;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

function paint(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Hull shell: U-shaped sections along the length, a flat transom at the stern, rising to a point at the bow. */
function hull(): THREE.BufferGeometry {
  const U = 18;
  const T = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  const width = (u: number) => BEAM * (1 - Math.pow(u, 3.2)) * (0.7 + 0.3 * Math.sin(u * Math.PI));
  const depth = (u: number) => DEPTH * (0.8 + 0.2 * Math.sin(u * Math.PI));
  const sheer = (u: number) => 0.28 * u * u;
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const z = (u - 0.45) * LENGTH;
    for (let j = 0; j <= T; j++) {
      const th = (j / T) * Math.PI;
      const x = width(u) * Math.cos(th);
      const y = sheer(u) - depth(u) * Math.pow(Math.sin(th), 0.7) * (1 - 0.5 * u * u);
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < T; j++) {
      const a = i * (T + 1) + j;
      const b = a + T + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const centre = pos.length / 3;
  pos.push(0, sheer(0) - depth(0) * 0.45, -0.45 * LENGTH);
  for (let j = 0; j < T; j++) idx.push(centre, j, j + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function sailGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 10, 12);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getX(i) + 0.5;
    const t = pos.getY(i) + 0.5;
    const x = -s * 2.7 * (1 - t * 0.55);
    const y = 0.75 + t * 3.7 + s * 0.35;
    pos.setXYZ(i, x, y, 0);
  }
  return geo;
}

/**
 * The child's little boat. It waits on a beach, is pushed into the water, and then sails where it is steered,
 * driven by whatever wind fills its patchwork sail.
 */
export class Boat {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  afloat = false;
  /** Where the child steers for; null lets it drift with the wind. */
  steerFor: THREE.Vector2 | null = null;
  /** True once the bow has run up onto a shore while sailing. */
  grounded = false;
  private readonly sailPivot = new THREE.Group();
  private readonly sailMat: THREE.ShaderMaterial;
  private readonly seatLocal = new THREE.Vector3(0, 0.02, -0.25);
  private readonly sample: WindSample = { x: 0, z: 0, energy: 0, lift: 0 };
  private roll = 0;
  private pitch = 0;
  private boom = 0;
  private time = 0;

  constructor(private readonly wind: WindField) {
    const hullMat = new THREE.ShaderMaterial({
      vertexShader: HULL_VERT,
      fragmentShader: HULL_FRAG,
      uniforms: { ...atmo.uniforms },
      side: THREE.DoubleSide,
    });
    const wood = new THREE.Color('#9a6a42');
    const trim = new THREE.Color('#5d3d27');
    const shell = paint(hull(), wood);
    const thwart = paint(new THREE.BoxGeometry(1.7, 0.08, 0.34).translate(0, 0.02, -0.25), trim);
    const mast = paint(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8).translate(0, 2.2, 0.55), trim);
    const boomBar = paint(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6).rotateZ(Math.PI / 2).translate(-1.35, 0.78, 0.55), trim);
    this.group.add(new THREE.Mesh(mergeGeometries([shell, thwart, mast]), hullMat));

    this.sailMat = new THREE.ShaderMaterial({
      vertexShader: SAIL_VERT,
      fragmentShader: SAIL_FRAG,
      uniforms: { ...atmo.uniforms, uFill: { value: 0 }, uFlutter: { value: 0.5 } },
      side: THREE.DoubleSide,
    });
    this.sailPivot.position.set(0, 0, 0.55);
    this.sailPivot.add(new THREE.Mesh(sailGeometry(), this.sailMat));
    this.sailPivot.add(new THREE.Mesh(boomBar.translate(0, 0, -0.55), hullMat));
    this.group.add(this.sailPivot);
  }

  get objects(): THREE.Object3D[] {
    return [this.group];
  }

  beach(x: number, z: number, yaw: number): void {
    this.position.set(x, Math.max(heightAt(x, z), 0) + 0.35, z);
    this.yaw = yaw;
    this.afloat = false;
    this.speed = 0;
    this.pose(0);
  }

  launch(): void {
    this.afloat = true;
    this.grounded = false;
    this.speed = 0.8;
  }

  /** World position of the seat, where the child rides. */
  seat(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return out.copy(this.seatLocal).applyMatrix4(this.group.matrixWorld);
  }

  update(dt: number): void {
    this.time += dt;
    const p = this.position;
    const w = this.wind.sample(p.x, p.z, this.sample);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const along = w.x * fx + w.z * fz;
    const across = w.x * fz - w.z * fx;
    const windSpeed = Math.hypot(w.x, w.z);

    if (this.afloat && !this.grounded) {
      const drive = Math.max(0, along) * 0.62 + Math.abs(across) * 0.3 + 4.2 + w.energy * 6;
      this.speed += (Math.min(drive, 16) - this.speed) * (1 - Math.exp(-dt * 0.45));
      if (this.steerFor) {
        const want = Math.atan2(this.steerFor.x - p.x, this.steerFor.y - p.z);
        let dy = want - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += THREE.MathUtils.clamp(dy, -dt * 0.25, dt * 0.25);
      }
      p.x += (fx * this.speed + w.x * 0.06) * dt;
      p.z += (fz * this.speed + w.z * 0.06) * dt;
      const ahead = heightAt(p.x + fx * 2.2, p.z + fz * 2.2);
      if (ahead > -0.25) {
        this.grounded = true;
        this.speed = 0;
      }
    }

    const heel = this.afloat ? THREE.MathUtils.clamp(across * 0.018, -0.22, 0.22) : 0;
    this.roll += (heel + Math.sin(this.time * 1.3) * (this.afloat ? 0.05 : 0.0) - this.roll) * (1 - Math.exp(-dt * 2));
    this.pitch += ((this.afloat ? Math.sin(this.time * 0.9 + 1) * 0.04 - this.speed * 0.004 : -0.05) - this.pitch) * (1 - Math.exp(-dt * 2));
    const bob = this.afloat ? Math.sin(this.time * 1.1) * 0.12 + Math.sin(this.time * 2.3) * 0.04 : 0;
    p.y = this.afloat ? bob + 0.34 : Math.max(heightAt(p.x, p.z), 0) + 0.45;

    const relX = w.x * fz - w.z * fx;
    const targetBoom = THREE.MathUtils.clamp(-Math.atan2(relX, Math.max(along, 0.5)) * 0.6, -1.1, 1.1);
    this.boom += (targetBoom - this.boom) * (1 - Math.exp(-dt * 1.5));
    const fill = Math.min(1, windSpeed / 9 + w.energy * 0.4) * (this.afloat ? 1 : 0.35);
    this.sailMat.uniforms.uFill.value += ((relX >= 0 ? 1 : -1) * (0.15 + fill * 0.75) - this.sailMat.uniforms.uFill.value) * (1 - Math.exp(-dt * 3));
    this.sailMat.uniforms.uFlutter.value = 0.25 + (1 - fill) * 0.8;
    this.pose(dt);
  }

  private pose(_dt: number): void {
    this.group.position.copy(this.position);
    this.group.rotation.set(0, 0, 0);
    this.group.rotateY(this.yaw);
    this.group.rotateX(this.pitch);
    this.group.rotateZ(this.roll);
    this.sailPivot.rotation.y = this.boom;
    this.group.updateMatrixWorld(true);
  }
}

import * as THREE from 'three';
import { ATMO_GLSL, atmo } from '../world/atmosphere';
import { tuning } from '../tuning';

const COUNT = 2600;
const BOX = new THREE.Vector3(56, 30, 56);
const FALL = 13;

const VERT = /* glsl */ `
uniform float uTime;
uniform vec2 uBreezeDir;
uniform vec3 uBox;
uniform vec3 uCentre;
uniform vec3 uDrift;
uniform float uFall;
uniform float uAmount;
in vec4 aDrop;
out float vAlong;
out float vAcross;
out float vFade;
out vec3 vWorld;
void main() {
  vec3 seed = aDrop.xyz * uBox;
  vec3 p = mod(seed + vec3(uDrift.x, -uTime * uFall * (0.85 + 0.3 * aDrop.w), uDrift.z) - uCentre + uBox * 0.5, uBox) + uCentre - uBox * 0.5;
  vec3 fall = normalize(vec3(uBreezeDir.x, -uFall, uBreezeDir.y));
  vec3 toCam = normalize(cameraPosition - p);
  vec3 side = normalize(cross(fall, toCam));
  float dist = length(cameraPosition - p);
  float width = max(0.012, dist * 0.0011);
  float len = 0.75 + 0.35 * aDrop.w;
  vec3 world = p + fall * position.y * len + side * position.x * width;
  vAlong = position.y;
  vAcross = position.x;
  vFade = uAmount * step(aDrop.w, uAmount) * smoothstep(3.0, 10.0, dist) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, length(p.xz - uCentre.xz)));
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAG = /* glsl */ `
${ATMO_GLSL}
in float vAlong;
in float vAcross;
in float vFade;
in vec3 vWorld;
void main() {
  if (vFade < 0.003) discard;
  vec3 V = normalize(vWorld - cameraPosition);
  float glint = pow(max(dot(V, uSunDir), 0.0), 6.0);
  vec3 col = uSkyAmbient * 0.9 + uSkyHorizon * 0.35 + uSunColor * (0.12 + glint * 1.4);
  float shape = (1.0 - abs(vAcross)) * smoothstep(0.0, 0.35, vAlong + 0.5) * smoothstep(0.0, 0.2, 0.5 - vAlong);
  vec4 f = fogOf(vWorld);
  gl_FragColor = vec4(mix(col, f.rgb, f.a), shape * vFade * 0.32 * (1.0 - f.a * 0.6));
}`;

/** A light shower: thin streaks falling through a box around the view, drifting on the breeze, gold where they catch the low sun. */
export class Rain {
  readonly mesh: THREE.Mesh;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly forward = new THREE.Vector3();
  private readonly drift = new THREE.Vector2();

  constructor() {
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    const drops = new Float32Array(COUNT * 4);
    for (let i = 0; i < drops.length; i++) drops[i] = Math.random();
    geo.setAttribute('aDrop', new THREE.InstancedBufferAttribute(drops, 4));
    geo.instanceCount = COUNT;
    this.uniforms = {
      ...atmo.uniforms,
      uBox: { value: BOX },
      uCentre: { value: new THREE.Vector3() },
      uDrift: { value: new THREE.Vector3() },
      uBreezeDir: { value: new THREE.Vector2() },
      uFall: { value: FALL },
      uAmount: { value: 0 },
    };
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
  }

  /** `amount` 0 dry .. 1 a steady shower; `breeze` is the air's drift, which the drops lean and travel with. */
  update(dt: number, amount: number, camera: THREE.Camera, breeze: THREE.Vector2, storm = 0): void {
    this.mesh.visible = amount > 0.002;
    if (!this.mesh.visible) return;
    const u = this.uniforms;
    u.uAmount.value = amount;
    camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    u.uCentre.value.copy(camera.position).addScaledVector(this.forward, BOX.x * 0.3);
    u.uCentre.value.y = camera.position.y - 4;
    this.drift.copy(breeze).multiplyScalar(1 + storm * tuning.storm.rainLean / Math.max(0.5, breeze.length()));
    u.uDrift.value.x += this.drift.x * dt;
    u.uDrift.value.z += this.drift.y * dt;
    u.uBreezeDir.value.copy(this.drift);
  }
}
